import { useEffect, useState } from 'react'
import { useDialKitController } from 'dialkit'
import { SocialLinks } from './SocialLinks'
import { AppleCredit, FoldablePhone, FoldScrubber, FoldToggle, PhoneBackground, PhoneDevice, type MediaKind } from './iphone-duo'

type MediaSource = { src: string; kind: MediaKind; name: string; local?: boolean; custom?: boolean }
type NumericControlProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  suffix?: string
}

const wallpapers = ['lock', 'tide', 'ink'] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function NumericControl({ label, value, min, max, step, onChange, suffix }: NumericControlProps) {
  const commit = (next: number) => {
    if (Number.isFinite(next)) onChange(clamp(next, min, max))
  }

  return <label className="numeric-control">
    <span className="control-label">{label}</span>
    <div className="control-inputs">
      <input type="range" min={min} max={max} step={step} value={value} onChange={event => commit(event.currentTarget.valueAsNumber)} />
      <span className="number-wrap">
        <input type="number" min={min} max={max} step={step} value={value} onChange={event => commit(event.currentTarget.valueAsNumber)} />
        {suffix && <span className="number-suffix">{suffix}</span>}
      </span>
    </div>
  </label>
}

function ToggleControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-control">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.currentTarget.checked)} />
  </label>
}

function builtInMedia(name: typeof wallpapers[number]) {
  const screen = name === 'lock' ? '/wallpapers/apple-desert.avif' : `/wallpapers/${name}.svg`
  const cover = name === 'lock' ? '/wallpapers/apple-desert-cover.avif' : `/wallpapers/${name}.svg`
  return {
    screen: { src: screen, kind: 'image' as const, name, custom: false },
    cover: { src: cover, kind: 'image' as const, name, custom: false },
  }
}

function mediaFromFile(file: File): MediaSource {
  return {
    src: URL.createObjectURL(file),
    kind: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
    local: true,
    custom: true,
  }
}

function seconds(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export default function App() {
  const defaults = builtInMedia('lock')
  const [tuning, setTuning] = useState(false)
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [screenMedia, setScreenMedia] = useState<MediaSource>(defaults.screen)
  const [coverMedia, setCoverMedia] = useState<MediaSource>(defaults.cover)
  const [sameMedia, setSameMedia] = useState(false)
  const [screenStart, setScreenStart] = useState(0)
  const [screenEnd, setScreenEnd] = useState(0)
  const [screenFreezeFrame, setScreenFreezeFrame] = useState(0)
  const [screenPlayDelay, setScreenPlayDelay] = useState(0)
  const [coverStart, setCoverStart] = useState(0)
  const [coverEnd, setCoverEnd] = useState(0)
  const [coverFreezeFrame, setCoverFreezeFrame] = useState(0)
  const [coverPlayDelay, setCoverPlayDelay] = useState(0)
  const [customBackground, setCustomBackground] = useState<string>()
  const [showIcons, setShowIcons] = useState(true)
  const [replayVideoOnAnimation, setReplayVideoOnAnimation] = useState(false)

  const dial = useDialKitController('iPhone Duo', {
    fold: [0, 0, 180, 1],
    duration: [2, 0.2, 4, 0.05],
    blur: [48, 0, 80, 1],
    parallax: [1, 0, 2, 0.05],
    exposure: [1.2, 0.5, 2, 0.05],
    rotationX: [0, -180, 180, 1],
    rotationY: [-6, -180, 180, 1],
    rotationZ: [0, -180, 180, 1],
    innerScale: [1, 0.1, 4, 0.01],
    innerX: [0, -1.5, 1.5, 0.01],
    innerY: [0, -1.5, 1.5, 0.01],
    innerRotateX: [0, -80, 80, 0.1],
    innerRotateY: [0, -80, 80, 0.1],
    innerRotateZ: [0, -180, 180, 0.1],
    coverScale: [1, 0.1, 4, 0.01],
    coverX: [0, -1.5, 1.5, 0.01],
    coverY: [0, -1.5, 1.5, 0.01],
    coverRotateX: [0, -80, 80, 0.1],
    coverRotateY: [0, -80, 80, 0.1],
    coverRotateZ: [0, -180, 180, 0.1],
    foldOffsetX: [-4.12, -12, 12, 0.01],
    foldOffsetY: [0, -12, 12, 0.01],
    cameraDistance: [36, 18, 80, 0.1],
    cameraZoom: [1, 0.5, 2.5, 0.01],
    cameraDistanceMotion: [0, -24, 24, 0.1],
    background: { type: 'select', options: ['Studio', 'Sand', 'Slate', 'Custom'], default: 'Studio' },
  }, { id: 'iphone-duo', persist: true })

  const { values } = dial
  const effectiveCover = sameMedia ? screenMedia : coverMedia

  useEffect(() => () => {
    if (screenMedia.local) URL.revokeObjectURL(screenMedia.src)
  }, [screenMedia])

  useEffect(() => () => {
    if (coverMedia.local) URL.revokeObjectURL(coverMedia.src)
  }, [coverMedia])

  useEffect(() => () => {
    if (customBackground) URL.revokeObjectURL(customBackground)
  }, [customBackground])

  function chooseWallpaper(name: typeof wallpapers[number]) {
    const media = builtInMedia(name)
    setScreenMedia(media.screen)
    setCoverMedia(media.cover)
    setSameMedia(media.screen.src === media.cover.src)
    setShowIcons(name === 'lock')
  }

  function chooseScreenFile(file?: File) {
    if (!file) return
    setScreenMedia(mediaFromFile(file))
    setShowIcons(false)
  }

  function chooseCoverFile(file?: File) {
    if (!file) return
    setCoverMedia(mediaFromFile(file))
    setSameMedia(false)
    setShowIcons(false)
  }

  function chooseBackgroundFile(file?: File) {
    if (!file) return
    setCustomBackground(URL.createObjectURL(file))
    dial.setValue('background', 'Custom')
  }

  function resetVersion() {
    const media = builtInMedia('lock')
    dial.setValues({
      fold: 0,
      duration: 2,
      blur: 48,
      parallax: 1,
      exposure: 1.2,
      rotationX: 0,
      rotationY: -6,
      rotationZ: 0,
      innerScale: 1,
      innerX: 0,
      innerY: 0,
      innerRotateX: 0,
      innerRotateY: 0,
      innerRotateZ: 0,
      coverScale: 1,
      coverX: 0,
      coverY: 0,
      coverRotateX: 0,
      coverRotateY: 0,
      coverRotateZ: 0,
      foldOffsetX: -4.12,
      foldOffsetY: 0,
      cameraDistance: 36,
      cameraZoom: 1,
      cameraDistanceMotion: 0,
      background: 'Studio',
    })
    setScreenMedia(media.screen)
    setCoverMedia(media.cover)
    setSameMedia(false)
    setScreenStart(0)
    setScreenEnd(0)
    setScreenFreezeFrame(0)
    setScreenPlayDelay(0)
    setCoverStart(0)
    setCoverEnd(0)
    setCoverFreezeFrame(0)
    setCoverPlayDelay(0)
    setCustomBackground(undefined)
    setShowIcons(true)
    setReplayVideoOnAnimation(false)
  }

  const lockScreen = screenMedia.src === '/wallpapers/apple-desert.avif' && screenMedia.kind === 'image'
  const customBackgroundStyle = values.background === 'Custom' && customBackground
    ? { backgroundImage: `url(${customBackground})` }
    : undefined

  return <main className={dark ? 'page dark' : 'page'}>
    <FoldablePhone className="phone-study" value={values.fold / 180} onValueChange={value => dial.setValue('fold', value * 180)} duration={values.duration}>
      <div className="phone-stage">
        <PhoneBackground data-background={values.background} style={customBackgroundStyle} />
        <PhoneDevice
          modelSrc="/models/iphone-duo.glb"
          screenSrc={screenMedia.src}
          coverSrc={effectiveCover.src}
          screenKind={screenMedia.kind}
          coverKind={effectiveCover.kind}
          screenStart={screenStart}
          screenEnd={screenEnd}
          screenFreezeFrame={screenFreezeFrame}
          screenPlayDelay={screenPlayDelay}
          coverStart={coverStart}
          coverEnd={coverEnd}
          coverFreezeFrame={coverFreezeFrame}
          coverPlayDelay={coverPlayDelay}
          screenScale={values.innerScale}
          screenOffsetX={values.innerX}
          screenOffsetY={values.innerY}
          screenRotationX={values.innerRotateX}
          screenRotationY={values.innerRotateY}
          screenRotationZ={values.innerRotateZ}
          coverScale={values.coverScale}
          coverOffsetX={values.coverX}
          coverOffsetY={values.coverY}
          coverRotationX={values.coverRotateX}
          coverRotationY={values.coverRotateY}
          coverRotationZ={values.coverRotateZ}
          screenFitAspect={screenMedia.custom === true}
          coverFitAspect={effectiveCover.custom === true}
          replayVideoOnAnimation={replayVideoOnAnimation}
          rotationX={values.rotationX}
          rotationY={values.rotationY}
          rotationZ={values.rotationZ}
          foldOffsetX={values.foldOffsetX}
          foldOffsetY={values.foldOffsetY}
          cameraDistance={values.cameraDistance}
          cameraZoom={values.cameraZoom}
          cameraDistanceMotion={values.cameraDistanceMotion}
          exposure={values.exposure}
          blur={values.blur}
          parallax={values.parallax}
          revealSrc={lockScreen ? '/wallpapers/home-photo.svg' : undefined}
          screenOverlaySrc={showIcons ? '/wallpapers/api-apps.svg' : undefined}
          coverOverlaySrc={showIcons ? '/wallpapers/api-cover.svg' : undefined}
        />
      </div>

      <div className="phone-controls-area">
        <div className="phone-controls">
          <div className="fold-controls">
            <FoldToggle>{values.fold >= 90 ? '折叠' : '展开'}</FoldToggle>
            <FoldScrubber />
            <output aria-label="展开角度">{Math.round(values.fold)}°</output>
          </div>
          <div className="wallpaper-controls" role="group" aria-label="内置壁纸">
            {wallpapers.map(name => {
              const media = builtInMedia(name)
              return <button key={name} type="button" aria-label={`${name} 壁纸`} aria-pressed={screenMedia.src === media.screen.src} onClick={() => chooseWallpaper(name)}>
                <img src={media.cover.src} width="28" height="28" alt="" />
              </button>
            })}
          </div>
        </div>
        <div className="phone-caption"><span>拖动手机或下方滑杆控制折叠。</span><AppleCredit /></div>
      </div>
    </FoldablePhone>

    <nav className="page-actions" aria-label="页面控制">
      <button type="button" onClick={() => setDark(!dark)}>{dark ? '浅色模式' : '深色模式'}</button>
      <a href="https://www.apple.com/iphone-duo/" target="_blank" rel="noopener noreferrer">iPhone Duo</a>
    </nav>
    <SocialLinks />
    <button className="tuning-toggle" type="button" aria-expanded={tuning} aria-controls="phone-tuning" onClick={() => setTuning(!tuning)}>{tuning ? '关闭调节' : '调节'}</button>

    <aside id="phone-tuning" className="tuning-panel" aria-label="手机调节设置" hidden={!tuning}>
      <section className="version-section">
        <div>
          <strong>当前版本</strong>
          <span>重置会恢复默认参数和内置素材，本地上传文件不会保留。</span>
        </div>
        <button type="button" onClick={resetVersion}>重置版本</button>
      </section>

      <section className="control-section media-editor" aria-label="媒体">
        <h2>屏幕媒体</h2>
        <label className="file-control">
          <span>大屏图片 / 视频</span>
          <input type="file" accept="image/*,video/mp4,video/webm" onChange={event => { chooseScreenFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
        </label>
        <div className="media-name" title={screenMedia.name}>{screenMedia.name}</div>
        <div className="time-controls">
          <label>播放起点 <input type="number" min="0" step="0.1" value={screenStart} onChange={event => setScreenStart(seconds(event.currentTarget.valueAsNumber))} /></label>
          <label>播放终点 <input type="number" min="0" step="0.1" value={screenEnd} onChange={event => setScreenEnd(seconds(event.currentTarget.valueAsNumber))} /></label>
        </div>
        <div className="time-controls">
          <label>定格帧 <input type="number" min="0" step="0.001" value={screenFreezeFrame} onChange={event => setScreenFreezeFrame(seconds(event.currentTarget.valueAsNumber))} /></label>
          <label>播放延迟（秒） <input type="number" min="0" step="0.001" value={screenPlayDelay} onChange={event => setScreenPlayDelay(seconds(event.currentTarget.valueAsNumber))} /></label>
        </div>

        <ToggleControl label="小屏使用同一媒体" checked={sameMedia} onChange={setSameMedia} />

        <label className="file-control">
          <span>小屏图片 / 视频</span>
          <input type="file" accept="image/*,video/mp4,video/webm" disabled={sameMedia} onChange={event => { chooseCoverFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
        </label>
        <div className="media-name" title={effectiveCover.name}>{effectiveCover.name}</div>
        <div className="time-controls">
          <label>播放起点 <input type="number" min="0" step="0.1" value={coverStart} onChange={event => setCoverStart(seconds(event.currentTarget.valueAsNumber))} /></label>
          <label>播放终点 <input type="number" min="0" step="0.1" value={coverEnd} onChange={event => setCoverEnd(seconds(event.currentTarget.valueAsNumber))} /></label>
        </div>
        <div className="time-controls">
          <label>定格帧 <input type="number" min="0" step="0.001" value={coverFreezeFrame} onChange={event => setCoverFreezeFrame(seconds(event.currentTarget.valueAsNumber))} /></label>
          <label>播放延迟（秒） <input type="number" min="0" step="0.001" value={coverPlayDelay} onChange={event => setCoverPlayDelay(seconds(event.currentTarget.valueAsNumber))} /></label>
        </div>
        <p className="media-hint">播放终点填 0 时使用视频完整时长。定格帧与播放延迟支持 0.001 秒精度。</p>
        <ToggleControl label="模型动画开始时重播视频" checked={replayVideoOnAnimation} onChange={setReplayVideoOnAnimation} />
        <p className="media-hint">开启后，视频待机停在各自定格帧。自动展开或折叠开始后先等待设定延迟，再从各自播放起点开始播放。手动拖动进度不会触发播放。</p>
        <ToggleControl label="显示应用图标" checked={showIcons} onChange={setShowIcons} />
      </section>

      <section className="control-section">
        <h2>折叠与动画</h2>
        <NumericControl label="展开角度" value={values.fold} min={0} max={180} step={1} suffix="°" onChange={value => dial.setValue('fold', value)} />
        <NumericControl label="动画时长" value={values.duration} min={0.2} max={4} step={0.05} suffix="s" onChange={value => dial.setValue('duration', value)} />
        <NumericControl label="折叠位移 X" value={values.foldOffsetX} min={-12} max={12} step={0.01} onChange={value => dial.setValue('foldOffsetX', value)} />
        <NumericControl label="折叠位移 Y" value={values.foldOffsetY} min={-12} max={12} step={0.01} onChange={value => dial.setValue('foldOffsetY', value)} />
      </section>

      <section className="control-section">
        <h2>模型旋转</h2>
        <NumericControl label="X 轴旋转" value={values.rotationX} min={-180} max={180} step={1} suffix="°" onChange={value => dial.setValue('rotationX', value)} />
        <NumericControl label="Y 轴旋转" value={values.rotationY} min={-180} max={180} step={1} suffix="°" onChange={value => dial.setValue('rotationY', value)} />
        <NumericControl label="Z 轴旋转" value={values.rotationZ} min={-180} max={180} step={1} suffix="°" onChange={value => dial.setValue('rotationZ', value)} />
      </section>

      <section className="control-section">
        <h2>镜头</h2>
        <NumericControl label="镜头距离" value={values.cameraDistance} min={18} max={80} step={0.1} onChange={value => dial.setValue('cameraDistance', value)} />
        <NumericControl label="镜头缩放" value={values.cameraZoom} min={0.5} max={2.5} step={0.01} onChange={value => dial.setValue('cameraZoom', value)} />
        <NumericControl label="镜头距离动画" value={values.cameraDistanceMotion} min={-24} max={24} step={0.1} onChange={value => dial.setValue('cameraDistanceMotion', value)} />
        <p className="control-hint">镜头距离动画为折叠状态相对展开状态的距离偏移。</p>
      </section>

      <section className="control-section">
        <h2>大屏内容</h2>
        <NumericControl label="大小" value={values.innerScale} min={0.1} max={4} step={0.01} onChange={value => dial.setValue('innerScale', value)} />
        <NumericControl label="水平位置" value={values.innerX} min={-1.5} max={1.5} step={0.01} onChange={value => dial.setValue('innerX', value)} />
        <NumericControl label="垂直位置" value={values.innerY} min={-1.5} max={1.5} step={0.01} onChange={value => dial.setValue('innerY', value)} />
        <NumericControl label="内容旋转 X" value={values.innerRotateX} min={-80} max={80} step={0.1} suffix="°" onChange={value => dial.setValue('innerRotateX', value)} />
        <NumericControl label="内容旋转 Y" value={values.innerRotateY} min={-80} max={80} step={0.1} suffix="°" onChange={value => dial.setValue('innerRotateY', value)} />
        <NumericControl label="内容旋转 Z" value={values.innerRotateZ} min={-180} max={180} step={0.1} suffix="°" onChange={value => dial.setValue('innerRotateZ', value)} />
      </section>

      <section className="control-section">
        <h2>小屏内容</h2>
        <NumericControl label="大小" value={values.coverScale} min={0.1} max={4} step={0.01} onChange={value => dial.setValue('coverScale', value)} />
        <NumericControl label="水平位置" value={values.coverX} min={-1.5} max={1.5} step={0.01} onChange={value => dial.setValue('coverX', value)} />
        <NumericControl label="垂直位置" value={values.coverY} min={-1.5} max={1.5} step={0.01} onChange={value => dial.setValue('coverY', value)} />
        <NumericControl label="内容旋转 X" value={values.coverRotateX} min={-80} max={80} step={0.1} suffix="°" onChange={value => dial.setValue('coverRotateX', value)} />
        <NumericControl label="内容旋转 Y" value={values.coverRotateY} min={-80} max={80} step={0.1} suffix="°" onChange={value => dial.setValue('coverRotateY', value)} />
        <NumericControl label="内容旋转 Z" value={values.coverRotateZ} min={-180} max={180} step={0.1} suffix="°" onChange={value => dial.setValue('coverRotateZ', value)} />
      </section>

      <section className="control-section">
        <h2>屏幕效果</h2>
        <NumericControl label="模糊强度" value={values.blur} min={0} max={80} step={1} onChange={value => dial.setValue('blur', value)} />
        <NumericControl label="视差强度" value={values.parallax} min={0} max={2} step={0.05} onChange={value => dial.setValue('parallax', value)} />
        <NumericControl label="曝光" value={values.exposure} min={0.5} max={2} step={0.05} onChange={value => dial.setValue('exposure', value)} />
      </section>

      <section className="control-section">
        <h2>背景</h2>
        <label className="select-control">
          <span>背景类型</span>
          <select value={values.background} onChange={event => dial.setValue('background', event.currentTarget.value as 'Studio' | 'Sand' | 'Slate' | 'Custom')}>
            <option value="Studio">演播室</option>
            <option value="Sand">沙色</option>
            <option value="Slate">岩灰</option>
            <option value="Custom">自定义</option>
          </select>
        </label>
        <label className="file-control">
          <span>上传自定义背景</span>
          <input type="file" accept="image/*" onChange={event => { chooseBackgroundFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
        </label>
      </section>
    </aside>
  </main>
}
