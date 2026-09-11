import { useEffect, useEffectEvent, useRef, useState, type ComponentProps } from 'react'
import { useMotionValueEvent, useReducedMotion } from 'motion/react'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  LinearMipmapLinearFilter,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  VideoTexture,
  WebGLRenderer,
  type Texture,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { loadPhone } from './model'
import { foldChoreography } from './fold-choreography'
import { useFoldablePhone } from './FoldablePhone'

type PhoneModel = Awaited<ReturnType<typeof loadPhone>>
type Surface = { model: PhoneModel; renderer: WebGLRenderer; camera: PerspectiveCamera; draw: () => void }
type VideoRange = { start: number; end: number }
export type MediaKind = 'image' | 'video'

function resolveVideoRange(video: HTMLVideoElement, range: VideoRange) {
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  const startAt = Math.min(Math.max(0, range.start), Math.max(0, duration - 0.05))
  const endAt = range.end > startAt ? Math.min(range.end, duration) : duration
  return { startAt, endAt }
}

function keepVideoInRange(video: HTMLVideoElement | undefined, range: VideoRange, forceStart = false) {
  if (!video || video.readyState < 1) return
  const { startAt, endAt } = resolveVideoRange(video, range)
  if (forceStart || video.currentTime < startAt - 0.02 || (endAt > startAt && video.currentTime >= endAt - 0.02)) {
    video.currentTime = startAt
  }
}

export type PhoneDeviceProps = ComponentProps<'div'> & {
  modelSrc: string
  screenSrc: string
  coverSrc?: string
  screenKind?: MediaKind
  coverKind?: MediaKind
  screenStart?: number
  screenEnd?: number
  coverStart?: number
  coverEnd?: number
  screenScale?: number
  screenOffsetX?: number
  screenOffsetY?: number
  coverScale?: number
  coverOffsetX?: number
  coverOffsetY?: number
  screenFitAspect?: boolean
  coverFitAspect?: boolean
  rotation?: number
  rotationX?: number
  rotationY?: number
  rotationZ?: number
  foldOffsetX?: number
  foldOffsetY?: number
  cameraDistance?: number
  cameraZoom?: number
  cameraDistanceMotion?: number
  exposure?: number
  blur?: number
  parallax?: number
  screenOverlaySrc?: string
  coverOverlaySrc?: string
  revealSrc?: string
}

export function PhoneDevice(props: PhoneDeviceProps) {
  return <PhoneDeviceSurface key={props.modelSrc} {...props} />
}

function PhoneDeviceSurface({
  modelSrc,
  screenSrc,
  coverSrc = screenSrc,
  screenKind = 'image',
  coverKind = screenKind,
  screenStart = 0,
  screenEnd = 0,
  coverStart = 0,
  coverEnd = 0,
  screenScale = 1,
  screenOffsetX = 0,
  screenOffsetY = 0,
  coverScale = 1,
  coverOffsetX = 0,
  coverOffsetY = 0,
  screenFitAspect = false,
  coverFitAspect = false,
  rotation,
  rotationX = 0,
  rotationY,
  rotationZ = 0,
  foldOffsetX = -4.12,
  foldOffsetY = 0,
  cameraDistance = 36,
  cameraZoom = 1,
  cameraDistanceMotion = 0,
  exposure = 1.2,
  blur = 28,
  parallax = 1,
  screenOverlaySrc,
  coverOverlaySrc,
  revealSrc,
  className = '',
  ...props
}: PhoneDeviceProps) {
  const { progress, setValue, toggle } = useFoldablePhone()
  const reducedMotion = useReducedMotion()
  const canvas = useRef<HTMLCanvasElement>(null)
  const surface = useRef<Surface | undefined>(undefined)
  const mediaVideos = useRef<Set<HTMLVideoElement>>(new Set())
  const screenVideo = useRef<HTMLVideoElement | undefined>(undefined)
  const coverVideo = useRef<HTMLVideoElement | undefined>(undefined)
  const screenRange = useRef<VideoRange>({ start: screenStart, end: screenEnd })
  const coverRange = useRef<VideoRange>({ start: coverStart, end: coverEnd })
  const drag = useRef<{ x: number; value: number; moved: boolean } | undefined>(undefined)
  const suppressClick = useRef(false)
  const [status, setStatus] = useState('正在加载手机模型…')
  const [ready, setReady] = useState(false)
  const [amount, setAmount] = useState(progress.get())
  const resolvedRotationY = rotationY ?? rotation ?? -6

  const update = useEffectEvent(() => {
    const current = surface.current
    if (!current) return
    const p = Math.max(0, Math.min(1, progress.get()))
    const motion = foldChoreography(p)
    const { angle } = motion
    current.model.screen.uniforms.defocus.value = motion.innerDefocus
    current.model.cover.uniforms.focusEdge.value = motion.coverFocusEdge
    current.model.screen.uniforms.progress.value = p
    current.model.cover.uniforms.progress.value = p
    current.model.screen.uniforms.blur.value = blur
    current.model.cover.uniforms.blur.value = blur
    current.model.screen.uniforms.mediaScale.value = screenScale
    current.model.screen.uniforms.mediaOffset.value.set(screenOffsetX, screenOffsetY)
    current.model.screen.uniforms.mediaFitAspect.value = screenFitAspect ? 1 : 0
    current.model.cover.uniforms.mediaScale.value = coverScale
    current.model.cover.uniforms.mediaOffset.value.set(coverOffsetX, coverOffsetY)
    current.model.cover.uniforms.mediaFitAspect.value = coverFitAspect ? 1 : 0
    current.model.left.rotation.y = angle
    const foldShift = 1 - Math.max(0, Math.cos(angle))
    current.model.body.position.x = foldOffsetX * foldShift
    current.model.body.position.y = foldOffsetY * foldShift
    current.model.body.rotation.set(
      rotationX * Math.PI / 180,
      resolvedRotationY * Math.PI / 180,
      rotationZ * Math.PI / 180,
    )
    current.model.screen.uniforms.parallax.value = reducedMotion ? 0 : parallax
    current.model.cover.uniforms.parallax.value = reducedMotion ? 0 : parallax

    current.camera.position.z = Math.max(10, cameraDistance + cameraDistanceMotion * (1 - p))
    current.camera.zoom = Math.max(0.05, cameraZoom)
    current.camera.updateProjectionMatrix()

    current.model.body.updateMatrixWorld(true)
    current.model.screen.uniforms.bodyInverse.value.copy(current.model.body.matrixWorld).invert()
    current.model.cover.uniforms.bodyInverse.value.copy(current.model.body.matrixWorld).invert()
    current.renderer.toneMappingExposure = exposure
    current.draw()
  })

  function resumeVideos() {
    for (const video of mediaVideos.current) void video.play().catch(() => undefined)
  }

  useMotionValueEvent(progress, 'change', setAmount)
  useEffect(() => { update() }, [
    rotationX,
    resolvedRotationY,
    rotationZ,
    foldOffsetX,
    foldOffsetY,
    cameraDistance,
    cameraZoom,
    cameraDistanceMotion,
    exposure,
    blur,
    parallax,
    screenScale,
    screenOffsetX,
    screenOffsetY,
    coverScale,
    coverOffsetX,
    coverOffsetY,
    screenFitAspect,
    coverFitAspect,
    reducedMotion,
  ])

  useEffect(() => {
    screenRange.current = { start: screenStart, end: screenEnd }
    keepVideoInRange(screenVideo.current, screenRange.current)
  }, [screenStart, screenEnd])

  useEffect(() => {
    coverRange.current = { start: coverStart, end: coverEnd }
    keepVideoInRange(coverVideo.current, coverRange.current)
  }, [coverStart, coverEnd])

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const context = element.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true })
    if (!context) { setStatus('当前浏览器无法使用 WebGL 2，请开启硬件加速。'); return }
    const renderer = new WebGLRenderer({ canvas: element, context, alpha: true, antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = ACESFilmicToneMapping
    const scene = new Scene()
    const camera = new PerspectiveCamera(30, 1, 0.1, 120)
    camera.position.set(0, 0, 36)
    const environment = new RoomEnvironment()
    const generator = new PMREMGenerator(renderer)
    const environmentMap = generator.fromScene(environment)
    scene.environment = environmentMap.texture
    environment.dispose()
    generator.dispose()
    scene.add(new AmbientLight(0xffffff, 1.5))
    const key = new DirectionalLight(0xffffff, 3)
    key.position.set(-8, 12, 20)
    scene.add(key)
    let disposed = false
    let model: PhoneModel | undefined
    const render = () => renderer.render(scene, camera)
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      const span = Math.max(16, 21 / camera.aspect)
      camera.fov = 2 * Math.atan(span / 72) * 180 / Math.PI
      camera.updateProjectionMatrix()
      render()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    const unsubscribe = progress.on('change', () => update())
    loadPhone(modelSrc).then(loaded => {
      if (disposed) { loaded.dispose(); return }
      model = loaded
      scene.add(model.body)
      surface.current = { model, renderer, camera, draw: render }
      resize()
      update()
      setReady(true)
      setStatus('')
    }).catch(() => { if (!disposed) setStatus('手机模型加载失败，请刷新页面重试。') })
    return () => {
      disposed = true
      unsubscribe()
      observer.disconnect()
      surface.current = undefined
      model?.dispose()
      environmentMap.dispose()
      renderer.dispose()
    }
  }, [modelSrc, progress])

  useEffect(() => {
    if (!ready || !surface.current) return
    const current = surface.current
    let cancelled = false
    const cleanups: Array<() => void> = []

    function configureTexture(texture: Texture) {
      texture.colorSpace = SRGBColorSpace
      texture.anisotropy = Math.min(8, current.renderer.capabilities.getMaxAnisotropy())
    }

    async function loadImage(src: string) {
      const texture = await new TextureLoader().loadAsync(src)
      if (cancelled) { texture.dispose(); throw new Error('cancelled') }
      configureTexture(texture)
      cleanups.push(() => texture.dispose())
      return { texture, width: texture.image.width as number, height: texture.image.height as number }
    }

    async function loadVideo(src: string, range: React.MutableRefObject<VideoRange>, slot: React.MutableRefObject<HTMLVideoElement | undefined>) {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.loop = false
      video.src = src
      slot.current = video
      mediaVideos.current.add(video)

      let videoFrame = 0
      let animationFrame = 0
      let cleaned = false
      const cleanup = () => {
        if (cleaned) return
        cleaned = true
        if (videoFrame && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(videoFrame)
        if (animationFrame) cancelAnimationFrame(animationFrame)
        video.pause()
        mediaVideos.current.delete(video)
        if (slot.current === video) slot.current = undefined
        video.removeAttribute('src')
        video.load()
      }
      cleanups.push(cleanup)

      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 1) { resolve(); return }
        const loaded = () => { release(); resolve() }
        const failed = () => { release(); reject(new Error('Video metadata could not load.')) }
        const release = () => {
          video.removeEventListener('loadedmetadata', loaded)
          video.removeEventListener('error', failed)
        }
        video.addEventListener('loadedmetadata', loaded)
        video.addEventListener('error', failed)
        video.load()
      })

      if (cancelled) { cleanup(); throw new Error('cancelled') }
      keepVideoInRange(video, range.current, true)

      const texture = new VideoTexture(video)
      configureTexture(texture)
      texture.generateMipmaps = true
      texture.minFilter = LinearMipmapLinearFilter
      cleanups.push(() => texture.dispose())

      const renderFrame = () => {
        if (cancelled || cleaned) return
        keepVideoInRange(video, range.current)
        current.draw()
        if (typeof video.requestVideoFrameCallback === 'function') videoFrame = video.requestVideoFrameCallback(renderFrame)
        else animationFrame = requestAnimationFrame(renderFrame)
      }
      if (typeof video.requestVideoFrameCallback === 'function') videoFrame = video.requestVideoFrameCallback(renderFrame)
      else animationFrame = requestAnimationFrame(renderFrame)

      void video.play().catch(() => setStatus('点击手机后开始播放视频。'))
      return { texture, width: video.videoWidth || 1600, height: video.videoHeight || 1120 }
    }

    async function loadMedia(src: string, kind: MediaKind, range: React.MutableRefObject<VideoRange>, slot: React.MutableRefObject<HTMLVideoElement | undefined>) {
      return kind === 'video' ? loadVideo(src, range, slot) : loadImage(src)
    }

    Promise.all([
      loadMedia(screenSrc, screenKind, screenRange, screenVideo),
      loadMedia(coverSrc, coverKind, coverRange, coverVideo),
    ]).then(([screen, cover]) => {
      if (cancelled) return
      current.model.screen.uniforms.screenMap.value = screen.texture
      current.model.screen.uniforms.resolution.value.set(screen.width, screen.height)
      current.model.cover.uniforms.screenMap.value = cover.texture
      current.model.cover.uniforms.resolution.value.set(cover.width, cover.height)
      current.model.screen.needsUpdate = true
      current.model.cover.needsUpdate = true
      update()
      setStatus('')
    }).catch(() => { if (!cancelled) setStatus('屏幕媒体加载失败，请选择其他图片或视频。') })

    return () => {
      cancelled = true
      for (const cleanup of cleanups) cleanup()
    }
  }, [screenSrc, coverSrc, screenKind, coverKind, ready])

  useEffect(() => {
    if (!ready || !surface.current) return
    const current = surface.current
    let cancelled = false
    const textures: Texture[] = []
    for (const [src, material, map, enabled] of [
      [screenOverlaySrc, current.model.screen, 'overlayMap', 'hasOverlay'],
      [coverOverlaySrc, current.model.cover, 'overlayMap', 'hasOverlay'],
      [revealSrc, current.model.screen, 'revealMap', 'hasReveal'],
    ] as const) {
      material.uniforms[enabled].value = 0
      if (!src) continue
      new TextureLoader().loadAsync(src).then(texture => {
        if (cancelled) { texture.dispose(); return }
        texture.colorSpace = SRGBColorSpace
        textures.push(texture)
        material.uniforms[map].value = texture
        material.uniforms[enabled].value = 1
        current.draw()
      }).catch(() => { if (!cancelled) setStatus('屏幕叠加内容加载失败。') })
    }
    current.draw()
    return () => { cancelled = true; textures.forEach(texture => texture.dispose()) }
  }, [screenOverlaySrc, coverOverlaySrc, revealSrc, ready])

  return <div {...props} className={`duo-device ${className}`} data-progress={amount.toFixed(3)} data-ready={ready}>
    <canvas ref={canvas} aria-hidden="true" />
    <button
      className="duo-device-target"
      type="button"
      aria-label="折叠或展开手机"
      aria-pressed={amount >= 0.5}
      disabled={!ready}
      onPointerDown={event => {
        resumeVideos()
        if (event.button !== 0) return
        drag.current = { x: event.clientX, value: progress.get(), moved: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        const start = drag.current
        if (!start) return
        const delta = start.x - event.clientX
        if (Math.abs(delta) < 5 && !start.moved) return
        start.moved = true
        setValue(start.value + delta / (event.currentTarget.clientWidth * 0.5))
      }}
      onPointerUp={() => { suppressClick.current = drag.current?.moved ?? false; drag.current = undefined }}
      onPointerCancel={() => { if (drag.current) setValue(drag.current.value); drag.current = undefined; suppressClick.current = true }}
      onClick={event => {
        resumeVideos()
        if (!suppressClick.current) toggle(event.detail === 0)
        suppressClick.current = false
      }}
    />
    {status && <p className="duo-status" role="status">{status}</p>}
  </div>
}
