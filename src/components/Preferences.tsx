import type { VideoOutputPreference } from '../mediaCompressor'
import type { CompressionSelection, ImageOutputPreference } from '../jobDomain'
import type { Messages } from '../i18n'

type PreferencesProps = {
  messages: Messages
  compressionPreset: CompressionSelection
  imageOutput: ImageOutputPreference
  videoOutput: VideoOutputPreference
  onCompressionPresetChange: (value: CompressionSelection) => void
  onImageOutputChange: (value: ImageOutputPreference) => void
  onVideoOutputChange: (value: VideoOutputPreference) => void
  showReprocess: boolean
  reprocessDisabled: boolean
  onReprocess: () => void
}

export function Preferences({
  messages,
  compressionPreset,
  imageOutput,
  videoOutput,
  onCompressionPresetChange,
  onImageOutputChange,
  onVideoOutputChange,
  showReprocess,
  reprocessDisabled,
  onReprocess,
}: PreferencesProps) {
  return (
    <section className="preferences" aria-labelledby="page-title">
      <h1 id="page-title">{messages.outputPreferences}</h1>
      <label>
        <span>{messages.compressionLevel}</span>
        <select value={compressionPreset} onChange={(event) => onCompressionPresetChange(event.target.value as CompressionSelection)}>
          <option value="all">{messages.allQualities}</option>
          <option value="extreme">{messages.extreme}</option>
          <option value="balanced">{messages.balanced}</option>
          <option value="lossless">{messages.lossless}</option>
          <option value="target-100k">{messages.target100k}</option>
          <option value="target-500k">{messages.target500k}</option>
          <option value="target-2m">{messages.target2m}</option>
          <option value="target-5m">{messages.target5m}</option>
          <option value="target-10m">{messages.target10m}</option>
        </select>
      </label>
      <label>
        <span>{messages.image}</span>
        <select value={imageOutput} onChange={(event) => onImageOutputChange(event.target.value as ImageOutputPreference)}>
          <option value="original">{messages.imageOriginal}</option>
          <option value="jpeg">{messages.jpg}</option>
          <option value="webp">{messages.webp}</option>
          <option value="png">{messages.png}</option>
          <option value="pdf">{messages.pdf}</option>
        </select>
      </label>
      <label>
        <span>{messages.video}</span>
        <select value={videoOutput} onChange={(event) => onVideoOutputChange(event.target.value as VideoOutputPreference)}>
          <option value="original">{messages.original}</option>
          <option value="mp4">{messages.mp4}</option>
          <option value="mov">{messages.mov}</option>
          <option value="mov-alpha">{messages.movAlpha}</option>
          <option value="mp3">{messages.extractMp3}</option>
        </select>
      </label>
      {showReprocess ? (
        <button className="reprocess-all" type="button" onClick={onReprocess} disabled={reprocessDisabled}>
          {messages.reprocessAll}
        </button>
      ) : null}
    </section>
  )
}
