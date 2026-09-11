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
type Surface = { model: PhoneModel; renderer: WebGLRenderer; draw: () => void }
export type MediaKind = 'image' | 'video'

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
  rotation?: number
  rotationX?: number
  rotationY?: number
  rotationZ?: number
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
  rotation,
  rotationX = 0,
  rotationY,
  rotationZ = 0,
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
  const drag = useRef<{ x: number; value: number; moved: boolean } | undefined>(undefined)
  const suppressClick = useRef(false)
  const [status, setStatus] = useState('Loading Apple model…')
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
    current.model.cover.uniforms.mediaScale.value = coverScale
    current.model.cover.uniforms.mediaOffset.value.set(coverOffsetX, coverOffsetY)
    current.model.left.rotation.y = angle
    current.model.body.position.x = -4.12 * (1 - Math.max(0, Math.cos(angle)))
    current.model.body.rotation.set(
      rotationX * Math.PI / 180,
      resolvedRotationY * Math.PI / 180,
      rotationZ * Math.PI / 180,
    )
    current.model.screen.uniforms.parallax.value = reducedMotion ? 0 : parallax
    current.model.cover.uniforms.parallax.value = reducedMotion ? 0 : parallax
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
  useEffect(() => { update() }, [rotationX, resolvedRotationY, rotationZ, exposure, blur, parallax, screenScale, screenOffsetX, screenOffsetY, coverScale, coverOffsetX, coverOffsetY, reducedMotion])

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const context = element.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true })
    if (!context) { setStatus('WebGL 2 is unavailable. Enable hardware acceleration to view the phone.'); return }
    const renderer = new WebGLRenderer({ canvas: element, context, alpha: true, antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = ACESFilmicToneMapping
    const scene = new Scene()
    const camera = new PerspectiveCamera(30, 1, 0.1, 100)
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
      surface.current = { model, renderer, draw: render }
      resize()
      update()
      setReady(true)
      setStatus('')
    }).catch(() => { if (!disposed) setStatus('The Apple model could not load. Reload to try again.') })
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

    async function loadVideo(src: string, start: number, end: number) {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.loop = false
      video.src = src
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
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      const startAt = Math.min(Math.max(0, start), Math.max(0, duration - 0.05))
      const endAt = end > startAt ? Math.min(end, duration) : duration
      video.currentTime = startAt

      const texture = new VideoTexture(video)
      configureTexture(texture)
      texture.generateMipmaps = true
      texture.minFilter = LinearMipmapLinearFilter
      cleanups.push(() => texture.dispose())

      const keepInRange = () => {
        if (endAt > startAt && video.currentTime >= endAt - 0.02) video.currentTime = startAt
        else if (video.currentTime < startAt - 0.02) video.currentTime = startAt
      }
      const renderFrame = () => {
        if (cancelled || cleaned) return
        keepInRange()
        current.draw()
        if (typeof video.requestVideoFrameCallback === 'function') videoFrame = video.requestVideoFrameCallback(renderFrame)
        else animationFrame = requestAnimationFrame(renderFrame)
      }
      if (typeof video.requestVideoFrameCallback === 'function') videoFrame = video.requestVideoFrameCallback(renderFrame)
      else animationFrame = requestAnimationFrame(renderFrame)

      void video.play().catch(() => setStatus('Click the phone to start video playback.'))
      return { texture, width: video.videoWidth || 1600, height: video.videoHeight || 1120 }
    }

    async function loadMedia(src: string, kind: MediaKind, start: number, end: number) {
      return kind === 'video' ? loadVideo(src, start, end) : loadImage(src)
    }

    Promise.all([
      loadMedia(screenSrc, screenKind, screenStart, screenEnd),
      loadMedia(coverSrc, coverKind, coverStart, coverEnd),
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
    }).catch(() => { if (!cancelled) setStatus('Screen media could not load. Choose another image or video.') })

    return () => {
      cancelled = true
      for (const cleanup of cleanups) cleanup()
    }
  }, [screenSrc, coverSrc, screenKind, coverKind, screenStart, screenEnd, coverStart, coverEnd, ready])

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
      }).catch(() => { if (!cancelled) setStatus('Screen content could not load. Choose another image.') })
    }
    current.draw()
    return () => { cancelled = true; textures.forEach(texture => texture.dispose()) }
  }, [screenOverlaySrc, coverOverlaySrc, revealSrc, ready])

  return <div {...props} className={`duo-device ${className}`} data-progress={amount.toFixed(3)} data-ready={ready}>
    <canvas ref={canvas} aria-hidden="true" />
    <button
      className="duo-device-target"
      type="button"
      aria-label="Fold or unfold phone"
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
