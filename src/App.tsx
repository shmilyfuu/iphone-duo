import { useEffect, useState } from 'react'
import { DialRoot, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import { SocialLinks } from './SocialLinks'
import { AppleCredit, FoldablePhone, FoldScrubber, FoldToggle, PhoneBackground, PhoneDevice, type MediaKind } from './iphone-duo'

type MediaSource = { src: string; kind: MediaKind; name: string; local?: boolean }

const wallpapers = ['lock', 'tide', 'ink'] as const

function builtInMedia(name: typeof wallpapers[number]) {
  const screen = name === 'lock' ? '/wallpapers/apple-desert.avif' : `/wallpapers/${name}.svg`
  const cover = name === 'lock' ? '/wallpapers/apple-desert-cover.avif' : `/wallpapers/${name}.svg`
  return {
    screen: { src: screen, kind: 'image' as const, name },
    cover: { src: cover, kind: 'image' as const, name },
  }
}

function mediaFromFile(file: File): MediaSource {
  return {
    src: URL.createObjectURL(file),
    kind: file.type.startsWith('video/') ? 'video' : 'image',
    name: file.name,
    local: true,
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
  const [coverStart, setCoverStart] = useState(0)
  const [coverEnd, setCoverEnd] = useState(0)
  const [customBackground, setCustomBackground] = useState<string>()

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
    coverScale: [1, 0.1, 4, 0.01],
    coverX: [0, -1.5, 1.5, 0.01],
    coverY: [0, -1.5, 1.5, 0.01],
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
  }

  function chooseScreenFile(file?: File) {
    if (!file) return
    setScreenMedia(mediaFromFile(file))
  }

  function chooseCoverFile(file?: File) {
    if (!file) return
    setCoverMedia(mediaFromFile(file))
    setSameMedia(false)
  }

  function chooseBackgroundFile(file?: File) {
    if (!file) return
    setCustomBackground(URL.createObjectURL(file))
    dial.setValue('background', 'Custom')
  }

  const lockScreen = screenMedia.src === '/wallpapers/apple-desert.avif' && screenMedia.kind === 'image'
  const lockCover = effectiveCover.src === '/wallpapers/apple-desert-cover.avif' && effectiveCover.kind === 'image'
  const customBackgroundStyle = values.background === 'Custom' && customBackground
    ? { backgroundImage: `url(${customBackground})` }
    : undefined

  return <main className={dark ? 'page dark' : 'page'}>
    <FoldablePhone className="phone-study" value={values.fold / 180} onValueChange={value => dial.setValue('fold', value * 180)} duration={values.duration}>
      <PhoneBackground data-background={values.background} style={customBackgroundStyle} />
      <PhoneDevice
        modelSrc="/models/iphone-duo.glb"
        screenSrc={screenMedia.src}
        coverSrc={effectiveCover.src}
        screenKind={screenMedia.kind}
        coverKind={effectiveCover.kind}
        screenStart={screenStart}
        screenEnd={screenEnd}
        coverStart={coverStart}
        coverEnd={coverEnd}
        screenScale={values.innerScale}
        screenOffsetX={values.innerX}
        screenOffsetY={values.innerY}
        coverScale={values.coverScale}
        coverOffsetX={values.coverX}
        coverOffsetY={values.coverY}
        rotationX={values.rotationX}
        rotationY={values.rotationY}
        rotationZ={values.rotationZ}
        exposure={values.exposure}
        blur={values.blur}
        parallax={values.parallax}
        revealSrc={lockScreen ? '/wallpapers/home-photo.svg' : undefined}
        screenOverlaySrc={lockScreen ? '/wallpapers/api-apps.svg' : undefined}
        coverOverlaySrc={lockCover ? '/wallpapers/api-cover.svg' : undefined}
      />
      <div className="phone-controls">
        <div className="fold-controls"><FoldToggle /><FoldScrubber /><output aria-label="Opening angle">{Math.round(values.fold)}°</output></div>
        <div className="wallpaper-controls" role="group" aria-label="Wallpaper">
          {wallpapers.map(name => {
            const media = builtInMedia(name)
            return <button key={name} type="button" aria-label={`${name} wallpaper`} aria-pressed={screenMedia.src === media.screen.src} onClick={() => chooseWallpaper(name)}>
              <img src={media.cover.src} width="28" height="28" alt="" />
            </button>
          })}
        </div>
      </div>
      <div className="phone-caption"><span>Drag to unfold. Click to open or close.</span><AppleCredit /></div>
    </FoldablePhone>

    <nav className="page-actions" aria-label="Page controls"><button type="button" onClick={() => setDark(!dark)}>{dark ? 'Light mode' : 'Dark mode'}</button><a href="https://www.apple.com/iphone-duo/" target="_blank" rel="noopener noreferrer">iPhone Duo</a></nav>
    <SocialLinks />
    <button className="tuning-toggle" type="button" aria-expanded={tuning} aria-controls="phone-tuning" onClick={() => setTuning(!tuning)}>{tuning ? 'Close controls' : 'Tune'}</button>

    <aside id="phone-tuning" className="tuning-panel" aria-label="Phone settings" hidden={!tuning}>
      <section className="media-editor" aria-label="Local media">
        <h2>Media</h2>
        <label className="file-control">
          <span>Inner screen</span>
          <input type="file" accept="image/*,video/mp4,video/webm" onChange={event => { chooseScreenFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
        </label>
        <div className="media-name" title={screenMedia.name}>{screenMedia.name}</div>
        <div className="time-controls">
          <label>Start <input type="number" min="0" step="0.1" value={screenStart} onChange={event => setScreenStart(seconds(event.currentTarget.valueAsNumber))} /></label>
          <label>End <input type="number" min="0" step="0.1" value={screenEnd} onChange={event => setScreenEnd(seconds(event.currentTarget.valueAsNumber))} /></label>
        </div>

        <label className="same-media-control"><input type="checkbox" checked={sameMedia} onChange={event => setSameMedia(event.currentTarget.checked)} /> Use inner source for cover</label>

        <label className="file-control">
          <span>Cover screen</span>
          <input type="file" accept="image/*,video/mp4,video/webm" disabled={sameMedia} onChange={event => { chooseCoverFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
        </label>
        <div className="media-name" title={effectiveCover.name}>{effectiveCover.name}</div>
        <div className="time-controls">
          <label>Start <input type="number" min="0" step="0.1" value={coverStart} onChange={event => setCoverStart(seconds(event.currentTarget.valueAsNumber))} /></label>
          <label>End <input type="number" min="0" step="0.1" value={coverEnd} onChange={event => setCoverEnd(seconds(event.currentTarget.valueAsNumber))} /></label>
        </div>
        <p className="media-hint">End 0 uses the full video duration.</p>

        <label className="file-control">
          <span>Custom background</span>
          <input type="file" accept="image/*" onChange={event => { chooseBackgroundFile(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
        </label>
      </section>
      <DialRoot mode="inline" defaultOpen theme={dark ? 'dark' : 'light'} productionEnabled />
    </aside>
  </main>
}
