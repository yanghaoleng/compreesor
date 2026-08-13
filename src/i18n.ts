export type Locale = 'zh' | 'zh-Hant' | 'en' | 'ja'
export type Theme = 'light' | 'dark'

export type Messages = {
  brandSubtitle: string
  outputPreferences: string
  image: string
  video: string
  original: string
  jpg: string
  webp: string
  png: string
  mp4: string
  mov: string
  movAlpha: string
  extractMp3: string
  chooseDrop: string
  releaseDrop: string
  formats: string
  chooseFiles: string
  continueUpload: string
  clear: string
  packageDownload: string
  zipping: string
  files: (count: number) => string
  processingCount: (count: number) => string
  completedSummary: (count: number, saved: number) => string
  imageKind: string
  videoKind: string
  gifKind: string
  waiting: string
  processing: string
  failed: string
  retry: string
  download: string
  preview: string
  closePreview: string
  previousPreview: string
  nextPreview: string
  unsupported: string
  tooLarge: string
  ignored: string
  maxFiles: string
  packageFailed: string
  dragMore: string
  donateTitle: string
  donateDescription: string
  alipay: string
  wechat: string
  qrAlt: (method: string) => string
  usageGuide: string
  authorHomepage: string
  cliGuide: string
  cliTitle: string
  cliIntro: string
  cliInstallLabel: string
  cliFolderTitle: string
  cliFolderText: string
  cliFormatTitle: string
  cliFormatText: string
  cliReplaceTitle: string
  cliReplaceText: string
  cliAiTip: string
  closeCliGuide: string
  closeUsage: string
  guideHeading: string
  guideIntro: string
  guideFormatTitle: string
  guideFormatText: string
  guideQueueTitle: string
  guideQueueText: string
  guideDownloadTitle: string
  guideDownloadText: string
  themeToggle: (theme: Theme) => string
  languageMenuLabel: (language: string) => string
  languageListLabel: string
  homeLabel: string
}

export const LANGUAGE_OPTIONS: Array<{ id: Locale; short: string; label: string; htmlLang: string }> = [
  { id: 'zh', short: '简', label: '简体中文', htmlLang: 'zh-CN' },
  { id: 'zh-Hant', short: '繁', label: '繁體中文', htmlLang: 'zh-Hant' },
  { id: 'en', short: 'EN', label: 'English', htmlLang: 'en' },
  { id: 'ja', short: '日', label: '日本語', htmlLang: 'ja' },
]

export const I18N: Record<Locale, Messages> = {
  zh: {
    brandSubtitle: '文件压缩', outputPreferences: '输出偏好', image: '图片', video: '视频',
    original: '原格式', jpg: 'JPG', webp: 'WebP', png: 'PNG', mp4: 'MP4', mov: 'MOV',
    movAlpha: 'MOV 透明通道', extractMp3: '提取 MP3', chooseDrop: '选择或拖入文件',
    releaseDrop: '松开即可添加', formats: 'JPG、PNG、WebP、AVIF、JXL、SVG、GIF 和常见视频',
    chooseFiles: '选择文件', continueUpload: '继续上传', clear: '清空', packageDownload: '打包下载',
    zipping: '正在打包', files: (count) => `${count} 个文件`, processingCount: (count) => `正在处理 ${count} 个`,
    completedSummary: (count, saved) => `${count} 个已完成${saved > 0 ? ` · 节省 ${saved}%` : ''}`,
    imageKind: '图片', videoKind: '视频', gifKind: 'GIF', waiting: '等待处理', processing: '正在处理',
    failed: '处理失败', retry: '重试', download: '下载', preview: '预览', closePreview: '关闭预览', previousPreview: '上一个', nextPreview: '下一个',
    unsupported: '请选择 JPG、PNG、WebP、AVIF、JXL、SVG、GIF 或视频文件',
    tooLarge: '图片需小于 100 MB，GIF 或视频需小于 500 MB', ignored: '已忽略不支持的文件',
    maxFiles: '一次最多处理 30 个文件', packageFailed: '打包失败，请先单个下载完成的文件',
    dragMore: '松开即可继续添加文件', donateTitle: '打赏作者',
    donateDescription: '如果这个工具帮到了你，可以随意打赏，支持后续维护。',
    alipay: '支付宝', wechat: '微信', qrAlt: (method) => `${method}收款二维码`,
    usageGuide: '使用说明', authorHomepage: '作者主页', closeUsage: '关闭使用说明', cliGuide: 'CLI 命令行',
    cliTitle: '安装 CLI 批量压缩', cliIntro: '在终端、自动化脚本或能访问本地文件的 AI 助手中批量处理图片、SVG、GIF 和视频。',
    cliInstallLabel: '安装命令', cliFolderTitle: '压缩文件夹', cliFolderText: '传入文件或文件夹；文件夹会递归查找支持的格式。',
    cliFormatTitle: '统一转格式', cliFormatText: '使用 --format 选择 jpg、png、webp、avif、mp4、mov 或 mp3。',
    cliReplaceTitle: '原路径替换', cliReplaceText: '加 --replace 会在处理成功后替换源文件；再加 --yes 跳过确认。',
    cliAiTip: '也可以把安装命令和目录交给本地 AI 助手，让它安装 CLI 后替你批量处理。', closeCliGuide: '关闭 CLI 说明',
    guideHeading: '图片、GIF 与视频压缩',
    guideIntro: '选择文件后会自动开始处理。图片、GIF 和视频可以放在同一个队列中。',
    guideFormatTitle: '先选择输出格式', guideFormatText: '图片可保持原格式或转为 JPG、WebP、PNG。视频可转为 MP4、MOV、透明 MOV，也可提取 MP3。',
    guideQueueTitle: '继续添加文件', guideQueueText: '列表出现后，仍可拖入更多文件，或者点击继续上传。新文件会自动加入队列。',
    guideDownloadTitle: '下载处理结果', guideDownloadText: '每个文件都可单独下载。全部完成后，也可以一次打包下载。',
    themeToggle: (theme) => theme === 'light' ? '切换到暗色模式' : '切换到亮色模式',
    languageMenuLabel: (language) => `当前语言：${language}。打开语言菜单`, languageListLabel: '语言版本',
    homeLabel: 'Compreesor 首页',
  },
  'zh-Hant': {
    brandSubtitle: '檔案壓縮', outputPreferences: '輸出偏好', image: '圖片', video: '影片',
    original: '原格式', jpg: 'JPG', webp: 'WebP', png: 'PNG', mp4: 'MP4', mov: 'MOV',
    movAlpha: 'MOV 透明通道', extractMp3: '提取 MP3', chooseDrop: '選擇或拖入檔案',
    releaseDrop: '放開即可新增', formats: 'JPG、PNG、WebP、AVIF、JXL、SVG、GIF 與常見影片',
    chooseFiles: '選擇檔案', continueUpload: '繼續上傳', clear: '清空', packageDownload: '打包下載',
    zipping: '正在打包', files: (count) => `${count} 個檔案`, processingCount: (count) => `正在處理 ${count} 個`,
    completedSummary: (count, saved) => `${count} 個已完成${saved > 0 ? ` · 節省 ${saved}%` : ''}`,
    imageKind: '圖片', videoKind: '影片', gifKind: 'GIF', waiting: '等待處理', processing: '正在處理',
    failed: '處理失敗', retry: '重試', download: '下載', preview: '預覽', closePreview: '關閉預覽', previousPreview: '上一個', nextPreview: '下一個',
    unsupported: '請選擇 JPG、PNG、WebP、AVIF、JXL、SVG、GIF 或影片檔案',
    tooLarge: '圖片需小於 100 MB，GIF 或影片需小於 500 MB', ignored: '已略過不支援的檔案',
    maxFiles: '一次最多處理 30 個檔案', packageFailed: '打包失敗，請先單獨下載完成的檔案',
    dragMore: '放開即可繼續新增檔案', donateTitle: '打賞作者',
    donateDescription: '如果這個工具幫到你，可以隨意打賞，支持後續維護。',
    alipay: '支付寶', wechat: '微信', qrAlt: (method) => `${method}收款 QR Code`,
    usageGuide: '使用說明', authorHomepage: '作者首頁', closeUsage: '關閉使用說明', cliGuide: 'CLI 命令列',
    cliTitle: '安裝 CLI 批次壓縮', cliIntro: '在終端、腳本或可存取本機檔案的 AI 助手中批次處理圖片、SVG、GIF 與影片。',
    cliInstallLabel: '安裝指令', cliFolderTitle: '壓縮資料夾', cliFolderText: '傳入檔案或資料夾；資料夾會遞迴尋找支援格式。',
    cliFormatTitle: '統一轉格式', cliFormatText: '使用 --format 選擇 jpg、png、webp、avif、mp4、mov 或 mp3。',
    cliReplaceTitle: '原路徑取代', cliReplaceText: '加上 --replace 會在成功後取代來源檔；再加 --yes 可略過確認。',
    cliAiTip: '也能把安裝指令與資料夾交給本機 AI 助手，讓它安裝 CLI 後批次處理。', closeCliGuide: '關閉 CLI 說明',
    guideHeading: '圖片、GIF 與影片壓縮',
    guideIntro: '選擇檔案後會自動開始處理。圖片、GIF 和影片可以放在同一個佇列中。',
    guideFormatTitle: '先選擇輸出格式', guideFormatText: '圖片可保持原格式或轉為 JPG、WebP、PNG。影片可轉為 MP4、MOV、透明 MOV，也可提取 MP3。',
    guideQueueTitle: '繼續新增檔案', guideQueueText: '清單出現後，仍可拖入更多檔案，或點擊繼續上傳。新檔案會自動加入佇列。',
    guideDownloadTitle: '下載處理結果', guideDownloadText: '每個檔案都可單獨下載。全部完成後，也可以一次打包下載。',
    themeToggle: (theme) => theme === 'light' ? '切換到深色模式' : '切換到淺色模式',
    languageMenuLabel: (language) => `目前語言：${language}。開啟語言選單`, languageListLabel: '語言版本',
    homeLabel: 'Compreesor 首頁',
  },
  en: {
    brandSubtitle: 'File compressor', outputPreferences: 'Output preferences', image: 'Images', video: 'Video',
    original: 'Original', jpg: 'JPG', webp: 'WebP', png: 'PNG', mp4: 'MP4', mov: 'MOV',
    movAlpha: 'MOV with alpha', extractMp3: 'Extract MP3', chooseDrop: 'Choose or drop files',
    releaseDrop: 'Release to add files', formats: 'JPG, PNG, WebP, AVIF, JXL, SVG, GIF and common video formats',
    chooseFiles: 'Choose files', continueUpload: 'Add files', clear: 'Clear', packageDownload: 'Download ZIP',
    zipping: 'Creating ZIP', files: (count) => `${count} file${count === 1 ? '' : 's'}`,
    processingCount: (count) => `Processing ${count}`, completedSummary: (count, saved) => `${count} completed${saved > 0 ? ` · ${saved}% smaller` : ''}`,
    imageKind: 'Image', videoKind: 'Video', gifKind: 'GIF', waiting: 'Waiting', processing: 'Processing',
    failed: 'Failed', retry: 'Retry', download: 'Download', preview: 'Preview', closePreview: 'Close preview', previousPreview: 'Previous', nextPreview: 'Next',
    unsupported: 'Choose JPG, PNG, WebP, AVIF, JXL, SVG, GIF or video files',
    tooLarge: 'Images must be under 100 MB; GIF and video must be under 500 MB', ignored: 'Unsupported files were skipped',
    maxFiles: 'Up to 30 files can be processed at once', packageFailed: 'ZIP creation failed. Download completed files individually.',
    dragMore: 'Release to add more files', donateTitle: 'Support the author',
    donateDescription: 'If this tool helped, you can leave an optional tip to support future maintenance.',
    alipay: 'Alipay', wechat: 'WeChat Pay', qrAlt: (method) => `${method} payment QR code`,
    usageGuide: 'How to use', authorHomepage: 'Author', closeUsage: 'Close usage guide', cliGuide: 'CLI',
    cliTitle: 'Install the batch CLI', cliIntro: 'Batch-process images, SVG, GIF and video from a terminal, automation, or a local AI assistant with file access.',
    cliInstallLabel: 'Install', cliFolderTitle: 'Compress a folder', cliFolderText: 'Pass files or folders; folders are scanned recursively for supported formats.',
    cliFormatTitle: 'Convert formats', cliFormatText: 'Use --format with jpg, png, webp, avif, mp4, mov or mp3.',
    cliReplaceTitle: 'Replace originals', cliReplaceText: 'Add --replace to replace source files after success, and --yes to skip the prompt.',
    cliAiTip: 'You can also give the install command and folder to a local AI assistant and ask it to run the batch for you.', closeCliGuide: 'Close CLI instructions',
    guideHeading: 'Compress images, GIFs and video',
    guideIntro: 'Files start processing automatically. Images, GIFs and video can share one queue.',
    guideFormatTitle: 'Choose output formats', guideFormatText: 'Keep image formats or convert to JPG, WebP or PNG. Convert video to MP4, MOV, transparent MOV, or extract MP3 audio.',
    guideQueueTitle: 'Add more files', guideQueueText: 'After the list appears, drop more files onto it or use Add files. New items join the queue automatically.',
    guideDownloadTitle: 'Download results', guideDownloadText: 'Download files individually, or download everything as one ZIP after processing finishes.',
    themeToggle: (theme) => theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
    languageMenuLabel: (language) => `Current language: ${language}. Open language menu`, languageListLabel: 'Languages',
    homeLabel: 'Compreesor home',
  },
  ja: {
    brandSubtitle: 'ファイル圧縮', outputPreferences: '出力設定', image: '画像', video: '動画',
    original: '元の形式', jpg: 'JPG', webp: 'WebP', png: 'PNG', mp4: 'MP4', mov: 'MOV',
    movAlpha: '透過 MOV', extractMp3: 'MP3 を抽出', chooseDrop: 'ファイルを選択またはドロップ',
    releaseDrop: '離して追加', formats: 'JPG、PNG、WebP、AVIF、JXL、SVG、GIF、一般的な動画形式',
    chooseFiles: 'ファイルを選択', continueUpload: 'さらに追加', clear: 'クリア', packageDownload: 'まとめてダウンロード',
    zipping: 'ZIP 作成中', files: (count) => `${count} ファイル`, processingCount: (count) => `${count} 件を処理中`,
    completedSummary: (count, saved) => `${count} 件完了${saved > 0 ? ` · ${saved}% 削減` : ''}`,
    imageKind: '画像', videoKind: '動画', gifKind: 'GIF', waiting: '待機中', processing: '処理中',
    failed: '処理失敗', retry: '再試行', download: 'ダウンロード', preview: 'プレビュー', closePreview: '閉じる', previousPreview: '前へ', nextPreview: '次へ',
    unsupported: 'JPG、PNG、WebP、AVIF、JXL、SVG、GIF または動画を選択してください',
    tooLarge: '画像は 100 MB 未満、GIF と動画は 500 MB 未満にしてください', ignored: '未対応のファイルを除外しました',
    maxFiles: '一度に最大 30 ファイルまで処理できます', packageFailed: 'ZIP 作成に失敗しました。完了したファイルを個別に保存してください。',
    dragMore: '離してファイルを追加', donateTitle: '作者を応援',
    donateDescription: 'このツールが役立ったら、今後のメンテナンスを任意で支援できます。',
    alipay: 'Alipay', wechat: 'WeChat Pay', qrAlt: (method) => `${method} 支払い QR コード`,
    usageGuide: '使い方', authorHomepage: '作者ページ', closeUsage: '使い方を閉じる', cliGuide: 'CLI',
    cliTitle: 'CLI をインストール', cliIntro: 'ターミナル、スクリプト、またはローカルファイルへアクセスできる AI から画像、SVG、GIF、動画を一括処理できます。',
    cliInstallLabel: 'インストール', cliFolderTitle: 'フォルダーを圧縮', cliFolderText: 'ファイルまたはフォルダーを渡すと、対応形式を再帰的に検索します。',
    cliFormatTitle: '形式を変換', cliFormatText: '--format で jpg、png、webp、avif、mp4、mov、mp3 を選べます。',
    cliReplaceTitle: '元ファイルを置換', cliReplaceText: '--replace は成功後に元ファイルを置換し、--yes で確認を省略します。',
    cliAiTip: 'インストールコマンドとフォルダーをローカル AI に渡して、一括処理を依頼することもできます。', closeCliGuide: 'CLI 説明を閉じる',
    guideHeading: '画像・GIF・動画を圧縮',
    guideIntro: 'ファイルを選ぶと自動で処理が始まります。画像、GIF、動画を同じキューに追加できます。',
    guideFormatTitle: '出力形式を選択', guideFormatText: '画像は元の形式を維持するか JPG、WebP、PNG に変換できます。動画は MP4、MOV、透過 MOV、または MP3 抽出に対応します。',
    guideQueueTitle: 'ファイルを追加', guideQueueText: '一覧表示後もファイルをドロップするか、さらに追加を選択できます。新しいファイルは自動でキューに入ります。',
    guideDownloadTitle: '結果を保存', guideDownloadText: '個別にダウンロードでき、処理完了後はまとめて ZIP で保存できます。',
    themeToggle: (theme) => theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え',
    languageMenuLabel: (language) => `現在の言語：${language}。言語メニューを開く`, languageListLabel: '言語',
    homeLabel: 'Compreesor ホーム',
  },
}

const LOCALES = new Set<Locale>(LANGUAGE_OPTIONS.map((option) => option.id))

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  if (LOCALES.has(value as Locale)) return value as Locale
  const lower = value.toLowerCase()
  if (lower === 'zh-hant' || lower.startsWith('zh-hant-') || ['zh-tw', 'zh-hk', 'zh-mo'].includes(lower)) return 'zh-Hant'
  if (lower.startsWith('zh')) return 'zh'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('en')) return 'en'
  return null
}

export function getInitialLocale(): Locale {
  const requested = normalizeLocale(new URLSearchParams(window.location.search).get('lang'))
  if (requested) return requested
  try {
    const stored = normalizeLocale(window.localStorage.getItem('compreesor-language'))
    if (stored) return stored
  } catch {
    // Storage can be unavailable in private browsing.
  }
  for (const value of navigator.languages ?? [navigator.language]) {
    const locale = normalizeLocale(value)
    if (locale) return locale
  }
  return 'zh'
}

export function persistLocale(locale: Locale) {
  try {
    window.localStorage.setItem('compreesor-language', locale)
  } catch {
    // Keep the selected language for this page when persistence is unavailable.
  }
  const url = new URL(window.location.href)
  if (locale === 'zh') url.searchParams.delete('lang')
  else url.searchParams.set('lang', locale)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export function getInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem('compreesor-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Fall back to the system preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem('compreesor-theme', theme)
  } catch {
    // The current page still reflects the selected theme.
  }
}
