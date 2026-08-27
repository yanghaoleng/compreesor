import type { VideoOutputPreference } from '../mediaCompressor'
import type { CompressionSelection, ImageOutputPreference } from '../jobDomain'
import type { Messages } from '../i18n'
import { CustomSelect } from './CustomSelect'

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
  const compressionOptions: Array<{ value: CompressionSelection; label: string }> = [
    { value: 'all', label: messages.allQualities },
    { value: 'extreme', label: messages.extreme },
    { value: 'balanced', label: messages.balanced },
    { value: 'target-100k', label: messages.target100k },
    { value: 'target-500k', label: messages.target500k },
    { value: 'target-2m', label: messages.target2m },
    { value: 'target-5m', label: messages.target5m },
    { value: 'target-10m', label: messages.target10m },
  ]
  const imageOptions: Array<{ value: ImageOutputPreference; label: string }> = [
    { value: 'original', label: messages.imageOriginal },
    { value: 'jpeg', label: messages.jpg },
    { value: 'webp', label: messages.webp },
    { value: 'png', label: messages.png },
    { value: 'pdf', label: messages.pdf },
  ]
  const videoOptions: Array<{ value: VideoOutputPreference; label: string }> = [
    { value: 'original', label: messages.original },
    { value: 'mp4', label: messages.mp4 },
    { value: 'mov', label: messages.mov },
    { value: 'mov-alpha', label: messages.movAlpha },
    { value: 'mp3', label: messages.extractMp3 },
  ]

  return (
    <section className="preferences" aria-label={messages.outputPreferences}>
      <div className="preference-field preference-compression">
        <span>{messages.compressionLevel}</span>
        <CustomSelect
          value={compressionPreset}
          options={compressionOptions}
          onChange={onCompressionPresetChange}
          ariaLabel={messages.compressionLevel}
        />
      </div>
      <div className="preference-field preference-image">
        <span>{messages.image}</span>
        <CustomSelect
          value={imageOutput}
          options={imageOptions}
          onChange={onImageOutputChange}
          ariaLabel={messages.image}
        />
      </div>
      <div className="preference-field preference-video">
        <span>{messages.video}</span>
        <CustomSelect
          value={videoOutput}
          options={videoOptions}
          onChange={onVideoOutputChange}
          ariaLabel={messages.video}
        />
      </div>
      {showReprocess ? (
        <button className="reprocess-all" type="button" onClick={onReprocess} disabled={reprocessDisabled}>
          {messages.reprocessAll}
        </button>
      ) : null}
    </section>
  )
}
