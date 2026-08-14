export type Locale = 'zh' | 'zh-Hant' | 'en' | 'ja'
export type Theme = 'light' | 'dark'

export type Messages = {
  brandSubtitle: string
  outputPreferences: string
  compressionLevel: string
  extreme: string
  balanced: string
  lossless: string
  allQualities: string
  target100k: string
  target500k: string
  target2m: string
  target5m: string
  target10m: string
  image: string
  video: string
  pdf: string
  splittingPdf: string
  pdfSplitFailed: string
  imageOriginal: string
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
  pdfKind: string
  threeResults: string
  waiting: string
  processing: string
  failed: string
  retry: string
  download: string
  reveal: string
  preview: string
  closePreview: string
  previousPreview: string
  nextPreview: string
  zoomOut: string
  zoomReset: string
  zoomIn: string
  dragZoomHint: string
  unsupported: string
  tooLarge: string
  ignored: string
  maxFiles: string
  packageFailed: string
  dragMore: string
  reprocessAll: string
  donateTitle: string
  donateIntro: string
  donatePraises: string[]
  donateRequest: string
  alipay: string
  wechat: string
  qrAlt: (method: string) => string
  usageGuide: string
  authorHomepage: string
  cliGuide: string
  cliTitle: string
  cliIntro: string
  cliInstallLabel: string
  copyCommand: string
  commandCopied: string
  copyFailed: string
  cliFolderTitle: string
  cliFolderText: string
  cliPresetTitle: string
  cliPresetText: string
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
  progressLabel: (fileName: string) => string
}

export const LANGUAGE_OPTIONS: Array<{ id: Locale; short: string; label: string; htmlLang: string }> = [
  { id: 'zh', short: '简', label: '简体中文', htmlLang: 'zh-CN' },
  { id: 'zh-Hant', short: '繁', label: '繁體中文', htmlLang: 'zh-Hant' },
  { id: 'en', short: 'EN', label: 'English', htmlLang: 'en' },
  { id: 'ja', short: '日', label: '日本語', htmlLang: 'ja' },
]

export const I18N: Record<Locale, Messages> = {
  zh: {
    brandSubtitle: '文件压缩大救星', outputPreferences: '输出偏好', compressionLevel: '压缩比例', extreme: '极限', balanced: '够用', lossless: '无损', allQualities: '都试试',
    target100k: '≤ 100 KB（证照图片 / 报名头像）', target500k: '≤ 500 KB（证件扫描 / 表单附件）', target2m: '≤ 2 MB（报名材料 / 简历附件）', target5m: '≤ 5 MB（办事材料 / 合同附件）', target10m: '≤ 10 MB（PDF 文档 / 长材料）', image: '图片和 PDF', video: '视频', pdf: 'PDF', splittingPdf: '正在按页展开 PDF', pdfSplitFailed: 'PDF 页面转换失败',
    imageOriginal: '压缩为原格式', original: '原格式', jpg: 'JPG', webp: 'WebP', png: 'PNG', mp4: 'MP4', mov: 'MOV',
    movAlpha: 'MOV 透明通道', extractMp3: '提取 MP3', chooseDrop: '选择或拖入文件',
    releaseDrop: '松开即可添加', formats: 'JPG、PNG、WebP、AVIF、JXL、SVG、GIF、PDF 和常见视频',
    chooseFiles: '选择文件', continueUpload: '继续上传', clear: '清空', packageDownload: '打包下载',
    zipping: '正在打包', files: (count) => `${count} 个文件`, processingCount: (count) => `正在处理 ${count} 个`,
    completedSummary: (count, saved) => `${count} 个已完成${saved > 0 ? ` · 节省 ${saved}%` : ''}`,
    imageKind: '图片', videoKind: '视频', gifKind: 'GIF', pdfKind: 'PDF', threeResults: '3 份', waiting: '等待处理', processing: '正在处理',
    failed: '处理失败', retry: '重试', download: '下载', reveal: '在文件夹中显示', preview: '预览', closePreview: '关闭预览', previousPreview: '上一个', nextPreview: '下一个', zoomOut: '缩小', zoomReset: '恢复 1:1', zoomIn: '放大', dragZoomHint: '拖动或滚轮缩放，三个结果同步',
    unsupported: '请选择 JPG、PNG、WebP、AVIF、JXL、SVG、GIF、PDF 或视频文件',
    tooLarge: '图片和 PDF 需小于 100 MB，GIF 或视频需小于 500 MB', ignored: '已忽略不支持的文件',
    maxFiles: '一次最多处理 30 个文件', packageFailed: '打包失败，请先单个下载完成的文件',
    dragMore: '松开即可继续添加文件', reprocessAll: '全部重新处理', donateTitle: '打赏作者',
    donateIntro: '这个工具会一直免费，如果它帮你省了空间和时间，可以随意打赏。',
    donatePraises: [
      '认真整理文件的人，做事通常也很靠谱。愿你今天一路顺手。',
      '你的效率感很漂亮，愿任务越变越小，成就感越攒越大。',
      '你正在让事情变得更轻巧，愿接下来的每一步也都轻松。',
      '你对细节的在意很有分量，愿所有繁琐都被轻轻压缩。',
    ],
    donateRequest: '你也可以给我提要求，我会努力实现！',
    alipay: '支付宝', wechat: '微信', qrAlt: (method) => `${method}收款二维码`,
    usageGuide: '使用说明', authorHomepage: '作者主页', closeUsage: '关闭使用说明', cliGuide: 'CLI 命令行',
    cliTitle: '安装 CLI 批量压缩', cliIntro: '在终端、自动化脚本或能访问本地文件的 AI 助手中批量处理图片、SVG、GIF 和视频。',
    cliInstallLabel: '安装命令', copyCommand: '复制安装命令', commandCopied: '已复制安装命令', copyFailed: '复制失败，请手动复制',
    cliFolderTitle: '压缩文件夹', cliFolderText: '传入文件或文件夹；文件夹会递归查找支持的格式。',
    cliPresetTitle: '选择压缩比例', cliPresetText: '使用 --preset extreme、balanced 或 lossless；默认是 balanced。',
    cliFormatTitle: '统一转格式', cliFormatText: '使用 --format 选择 jpg、png、webp、avif、mp4、mov 或 mp3。',
    cliReplaceTitle: '原路径替换', cliReplaceText: '加 --replace 会在处理成功后替换源文件；再加 --yes 跳过确认。',
    cliAiTip: '也可以把安装命令和目录交给本地 AI 助手，让它安装 CLI 后替你批量处理。', closeCliGuide: '关闭 CLI 说明',
    guideHeading: '图片、GIF、PDF 与视频压缩',
    guideIntro: '选择文件后会自动开始处理。图片、GIF、PDF 和视频可以放在同一个队列中。',
    guideFormatTitle: '先选择输出格式', guideFormatText: '“都试试”会同时生成极限、够用、无损三档；图片可以转成 PDF，PDF 也能按页展开成图片。体积目标会自动调整画质、尺寸与码率。',
    guideQueueTitle: '继续添加文件', guideQueueText: '列表出现后，仍可拖入更多文件，或者点击继续上传。新文件会自动加入队列。',
    guideDownloadTitle: '下载处理结果', guideDownloadText: '每个文件都可单独下载。全部完成后，也可以一次打包下载。',
    themeToggle: (theme) => theme === 'light' ? '切换到暗色模式' : '切换到亮色模式',
    languageMenuLabel: (language) => `当前语言：${language}。打开语言菜单`, languageListLabel: '语言版本',
    homeLabel: '文件压缩大救星首页', progressLabel: (fileName) => `${fileName} 的处理进度`,
  },
  'zh-Hant': {
    brandSubtitle: '檔案壓縮大救星', outputPreferences: '輸出偏好', compressionLevel: '壓縮比例', extreme: '極限', balanced: '夠用', lossless: '無損', allQualities: '都試試',
    target100k: '≤ 100 KB（證照圖片 / 報名頭像）', target500k: '≤ 500 KB（證件掃描 / 表單附件）', target2m: '≤ 2 MB（報名資料 / 履歷附件）', target5m: '≤ 5 MB（辦事資料 / 合約附件）', target10m: '≤ 10 MB（PDF 文件 / 長篇資料）', image: '圖片與 PDF', video: '影片', pdf: 'PDF', splittingPdf: '正在逐頁展開 PDF', pdfSplitFailed: 'PDF 頁面轉換失敗',
    imageOriginal: '壓縮為原格式', original: '原格式', jpg: 'JPG', webp: 'WebP', png: 'PNG', mp4: 'MP4', mov: 'MOV',
    movAlpha: 'MOV 透明通道', extractMp3: '提取 MP3', chooseDrop: '選擇或拖入檔案',
    releaseDrop: '放開即可新增', formats: 'JPG、PNG、WebP、AVIF、JXL、SVG、GIF、PDF 與常見影片',
    chooseFiles: '選擇檔案', continueUpload: '繼續上傳', clear: '清空', packageDownload: '打包下載',
    zipping: '正在打包', files: (count) => `${count} 個檔案`, processingCount: (count) => `正在處理 ${count} 個`,
    completedSummary: (count, saved) => `${count} 個已完成${saved > 0 ? ` · 節省 ${saved}%` : ''}`,
    imageKind: '圖片', videoKind: '影片', gifKind: 'GIF', pdfKind: 'PDF', threeResults: '3 份', waiting: '等待處理', processing: '正在處理',
    failed: '處理失敗', retry: '重試', download: '下載', reveal: '在資料夾中顯示', preview: '預覽', closePreview: '關閉預覽', previousPreview: '上一個', nextPreview: '下一個', zoomOut: '縮小', zoomReset: '恢復 1:1', zoomIn: '放大', dragZoomHint: '拖曳或滾輪縮放，三個結果同步',
    unsupported: '請選擇 JPG、PNG、WebP、AVIF、JXL、SVG、GIF、PDF 或影片檔案',
    tooLarge: '圖片與 PDF 需小於 100 MB，GIF 或影片需小於 500 MB', ignored: '已略過不支援的檔案',
    maxFiles: '一次最多處理 30 個檔案', packageFailed: '打包失敗，請先單獨下載完成的檔案',
    dragMore: '放開即可繼續新增檔案', reprocessAll: '全部重新處理', donateTitle: '打賞作者',
    donateIntro: '這個工具會一直免費，如果它幫你省下空間和時間，可以隨意打賞。',
    donatePraises: [
      '認真整理檔案的人，做事通常也很可靠。願你今天一路順手。',
      '你的效率感很漂亮，願任務越變越小，成就感越積越大。',
      '你正在讓事情變得更輕巧，願接下來的每一步也都輕鬆。',
      '你對細節的在意很有分量，願所有繁瑣都被輕輕壓縮。',
    ],
    donateRequest: '你也可以向我提出要求，我會努力實現！',
    alipay: '支付寶', wechat: '微信', qrAlt: (method) => `${method}收款 QR Code`,
    usageGuide: '使用說明', authorHomepage: '作者首頁', closeUsage: '關閉使用說明', cliGuide: 'CLI 命令列',
    cliTitle: '安裝 CLI 批次壓縮', cliIntro: '在終端、腳本或可存取本機檔案的 AI 助手中批次處理圖片、SVG、GIF 與影片。',
    cliInstallLabel: '安裝指令', copyCommand: '複製安裝指令', commandCopied: '已複製安裝指令', copyFailed: '複製失敗，請手動複製',
    cliFolderTitle: '壓縮資料夾', cliFolderText: '傳入檔案或資料夾；資料夾會遞迴尋找支援格式。',
    cliPresetTitle: '選擇壓縮比例', cliPresetText: '使用 --preset extreme、balanced 或 lossless；預設為 balanced。',
    cliFormatTitle: '統一轉格式', cliFormatText: '使用 --format 選擇 jpg、png、webp、avif、mp4、mov 或 mp3。',
    cliReplaceTitle: '原路徑取代', cliReplaceText: '加上 --replace 會在成功後取代來源檔；再加 --yes 可略過確認。',
    cliAiTip: '也能把安裝指令與資料夾交給本機 AI 助手，讓它安裝 CLI 後批次處理。', closeCliGuide: '關閉 CLI 說明',
    guideHeading: '圖片、GIF、PDF 與影片壓縮',
    guideIntro: '選擇檔案後會自動開始處理。圖片、GIF、PDF 和影片可以放在同一個佇列中。',
    guideFormatTitle: '先選擇輸出格式', guideFormatText: '「都試試」會同時產生極限、夠用、無損三種結果；圖片可轉成 PDF，PDF 也能逐頁展開成圖片。體積目標會自動調整畫質、尺寸與碼率。',
    guideQueueTitle: '繼續新增檔案', guideQueueText: '清單出現後，仍可拖入更多檔案，或點擊繼續上傳。新檔案會自動加入佇列。',
    guideDownloadTitle: '下載處理結果', guideDownloadText: '每個檔案都可單獨下載。全部完成後，也可以一次打包下載。',
    themeToggle: (theme) => theme === 'light' ? '切換到深色模式' : '切換到淺色模式',
    languageMenuLabel: (language) => `目前語言：${language}。開啟語言選單`, languageListLabel: '語言版本',
    homeLabel: '檔案壓縮大救星首頁', progressLabel: (fileName) => `${fileName} 的處理進度`,
  },
  en: {
    brandSubtitle: 'File Compression Lifesaver', outputPreferences: 'Output preferences', compressionLevel: 'Compression', extreme: 'Extreme', balanced: 'Balanced', lossless: 'Lossless', allQualities: 'Try all three',
    target100k: '≤ 100 KB (ID photos / profile photos)', target500k: '≤ 500 KB (ID scans / form files)', target2m: '≤ 2 MB (applications / résumés)', target5m: '≤ 5 MB (service files / contracts)', target10m: '≤ 10 MB (PDFs / long documents)', image: 'Images & PDF', video: 'Video', pdf: 'PDF', splittingPdf: 'Splitting PDF into pages', pdfSplitFailed: 'Could not convert PDF pages',
    imageOriginal: 'Compress in original format', original: 'Original', jpg: 'JPG', webp: 'WebP', png: 'PNG', mp4: 'MP4', mov: 'MOV',
    movAlpha: 'MOV with alpha', extractMp3: 'Extract MP3', chooseDrop: 'Choose or drop files',
    releaseDrop: 'Release to add files', formats: 'JPG, PNG, WebP, AVIF, JXL, SVG, GIF, PDF and common video formats',
    chooseFiles: 'Choose files', continueUpload: 'Add files', clear: 'Clear', packageDownload: 'Download ZIP',
    zipping: 'Creating ZIP', files: (count) => `${count} file${count === 1 ? '' : 's'}`,
    processingCount: (count) => `Processing ${count}`, completedSummary: (count, saved) => `${count} completed${saved > 0 ? ` · ${saved}% smaller` : ''}`,
    imageKind: 'Image', videoKind: 'Video', gifKind: 'GIF', pdfKind: 'PDF', threeResults: '3 results', waiting: 'Waiting', processing: 'Processing',
    failed: 'Failed', retry: 'Retry', download: 'Download', reveal: 'Show in folder', preview: 'Preview', closePreview: 'Close preview', previousPreview: 'Previous', nextPreview: 'Next', zoomOut: 'Zoom out', zoomReset: 'Reset to 1:1', zoomIn: 'Zoom in', dragZoomHint: 'Drag or scroll to inspect all three in sync',
    unsupported: 'Choose JPG, PNG, WebP, AVIF, JXL, SVG, GIF, PDF or video files',
    tooLarge: 'Images and PDFs must be under 100 MB; GIF and video must be under 500 MB', ignored: 'Unsupported files were skipped',
    maxFiles: 'Up to 30 files can be processed at once', packageFailed: 'ZIP creation failed. Download completed files individually.',
    dragMore: 'Release to add more files', reprocessAll: 'Reprocess all', donateTitle: 'Support the author',
    donateIntro: 'This tool will always be free. If it saves you space and time, you’re welcome to leave any amount as a tip.',
    donatePraises: [
      'Anyone this thoughtful with files probably has a great handle on things. Hope everything goes smoothly today.',
      'Efficiency looks good on you. May the tasks get smaller and the wins keep adding up.',
      'You have a knack for making things lighter. May every next step feel just as easy.',
      'Your eye for detail carries weight. May every bit of hassle shrink away.',
    ],
    donateRequest: 'You can also send me requests, and I’ll do my best to make them happen!',
    alipay: 'Alipay', wechat: 'WeChat Pay', qrAlt: (method) => `${method} payment QR code`,
    usageGuide: 'How to use', authorHomepage: 'Author', closeUsage: 'Close usage guide', cliGuide: 'CLI',
    cliTitle: 'Install the batch CLI', cliIntro: 'Batch-process images, SVG, GIF and video from a terminal, automation, or a local AI assistant with file access.',
    cliInstallLabel: 'Install', copyCommand: 'Copy install command', commandCopied: 'Install command copied', copyFailed: 'Could not copy. Please copy it manually.',
    cliFolderTitle: 'Compress a folder', cliFolderText: 'Pass files or folders; folders are scanned recursively for supported formats.',
    cliPresetTitle: 'Choose compression', cliPresetText: 'Use --preset extreme, balanced or lossless. The default is balanced.',
    cliFormatTitle: 'Convert formats', cliFormatText: 'Use --format with jpg, png, webp, avif, mp4, mov or mp3.',
    cliReplaceTitle: 'Replace originals', cliReplaceText: 'Add --replace to replace source files after success, and --yes to skip the prompt.',
    cliAiTip: 'You can also give the install command and folder to a local AI assistant and ask it to run the batch for you.', closeCliGuide: 'Close CLI instructions',
    guideHeading: 'Compress images, GIFs, PDFs and video',
    guideIntro: 'Files start processing automatically. Images, GIFs, PDFs and video can share one queue.',
    guideFormatTitle: 'Choose output formats', guideFormatText: '“Try all three” creates Extreme, Balanced and Lossless results together. Images can become PDFs, and PDFs can expand into one image per page. Size targets tune quality, dimensions and bitrates automatically.',
    guideQueueTitle: 'Add more files', guideQueueText: 'After the list appears, drop more files onto it or use Add files. New items join the queue automatically.',
    guideDownloadTitle: 'Download results', guideDownloadText: 'Download files individually, or download everything as one ZIP after processing finishes.',
    themeToggle: (theme) => theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
    languageMenuLabel: (language) => `Current language: ${language}. Open language menu`, languageListLabel: 'Languages',
    homeLabel: 'File Compression Lifesaver home', progressLabel: (fileName) => `Processing progress for ${fileName}`,
  },
  ja: {
    brandSubtitle: 'ファイル圧縮の救世主', outputPreferences: '出力設定', compressionLevel: '圧縮率', extreme: '極限', balanced: '標準', lossless: 'ロスレス', allQualities: '3種類を試す',
    target100k: '≤ 100 KB（証明写真 / 登録写真）', target500k: '≤ 500 KB（身分証スキャン / フォーム添付）', target2m: '≤ 2 MB（応募書類 / 履歴書）', target5m: '≤ 5 MB（申請資料 / 契約書）', target10m: '≤ 10 MB（PDF / 長い資料）', image: '画像・PDF', video: '動画', pdf: 'PDF', splittingPdf: 'PDF をページごとに展開中', pdfSplitFailed: 'PDF ページの変換に失敗しました',
    imageOriginal: '元の形式で圧縮', original: '元の形式', jpg: 'JPG', webp: 'WebP', png: 'PNG', mp4: 'MP4', mov: 'MOV',
    movAlpha: '透過 MOV', extractMp3: 'MP3 を抽出', chooseDrop: 'ファイルを選択またはドロップ',
    releaseDrop: '離して追加', formats: 'JPG、PNG、WebP、AVIF、JXL、SVG、GIF、PDF、一般的な動画形式',
    chooseFiles: 'ファイルを選択', continueUpload: 'さらに追加', clear: 'クリア', packageDownload: 'まとめてダウンロード',
    zipping: 'ZIP 作成中', files: (count) => `${count} ファイル`, processingCount: (count) => `${count} 件を処理中`,
    completedSummary: (count, saved) => `${count} 件完了${saved > 0 ? ` · ${saved}% 削減` : ''}`,
    imageKind: '画像', videoKind: '動画', gifKind: 'GIF', pdfKind: 'PDF', threeResults: '3 種類', waiting: '待機中', processing: '処理中',
    failed: '処理失敗', retry: '再試行', download: 'ダウンロード', reveal: 'フォルダーに表示', preview: 'プレビュー', closePreview: '閉じる', previousPreview: '前へ', nextPreview: '次へ', zoomOut: '縮小', zoomReset: '1:1 に戻す', zoomIn: '拡大', dragZoomHint: 'ドラッグまたはホイールで3種類を同期操作',
    unsupported: 'JPG、PNG、WebP、AVIF、JXL、SVG、GIF、PDF または動画を選択してください',
    tooLarge: '画像と PDF は 100 MB 未満、GIF と動画は 500 MB 未満にしてください', ignored: '未対応のファイルを除外しました',
    maxFiles: '一度に最大 30 ファイルまで処理できます', packageFailed: 'ZIP 作成に失敗しました。完了したファイルを個別に保存してください。',
    dragMore: '離してファイルを追加', reprocessAll: 'すべて再処理', donateTitle: '作者を応援',
    donateIntro: 'このツールはずっと無料です。容量と時間の節約になったら、お好きな金額で応援していただけます。',
    donatePraises: [
      'ファイルを丁寧に整える人は、きっと物事にも誠実。今日がすいすい進みますように。',
      'その手際のよさ、素敵です。タスクは小さく、達成感は大きくなりますように。',
      '物事を軽やかにするのが上手ですね。この先の一歩一歩も、すんなり進みますように。',
      '細部まで大切にできるのは、素敵なこと。面倒ごとが、ぎゅっと小さくなりますように。',
    ],
    donateRequest: 'ご要望もぜひ教えてください。できる限り実現します！',
    alipay: 'Alipay', wechat: 'WeChat Pay', qrAlt: (method) => `${method} 支払い QR コード`,
    usageGuide: '使い方', authorHomepage: '作者ページ', closeUsage: '使い方を閉じる', cliGuide: 'CLI',
    cliTitle: 'CLI をインストール', cliIntro: 'ターミナル、スクリプト、またはローカルファイルへアクセスできる AI から画像、SVG、GIF、動画を一括処理できます。',
    cliInstallLabel: 'インストール', copyCommand: 'インストールコマンドをコピー', commandCopied: 'インストールコマンドをコピーしました', copyFailed: 'コピーできませんでした。手動でコピーしてください。',
    cliFolderTitle: 'フォルダーを圧縮', cliFolderText: 'ファイルまたはフォルダーを渡すと、対応形式を再帰的に検索します。',
    cliPresetTitle: '圧縮率を選択', cliPresetText: '--preset extreme、balanced、lossless を使用します。既定値は balanced です。',
    cliFormatTitle: '形式を変換', cliFormatText: '--format で jpg、png、webp、avif、mp4、mov、mp3 を選べます。',
    cliReplaceTitle: '元ファイルを置換', cliReplaceText: '--replace は成功後に元ファイルを置換し、--yes で確認を省略します。',
    cliAiTip: 'インストールコマンドとフォルダーをローカル AI に渡して、一括処理を依頼することもできます。', closeCliGuide: 'CLI 説明を閉じる',
    guideHeading: '画像・GIF・PDF・動画を圧縮',
    guideIntro: 'ファイルを選ぶと自動で処理が始まります。画像、GIF、PDF、動画を同じキューに追加できます。',
    guideFormatTitle: '出力形式を選択', guideFormatText: '「3種類を試す」は極限・標準・ロスレスを同時に生成します。画像は PDF に、PDF はページごとの画像に変換できます。容量目標では画質、寸法、ビットレートを自動調整します。',
    guideQueueTitle: 'ファイルを追加', guideQueueText: '一覧表示後もファイルをドロップするか、さらに追加を選択できます。新しいファイルは自動でキューに入ります。',
    guideDownloadTitle: '結果を保存', guideDownloadText: '個別にダウンロードでき、処理完了後はまとめて ZIP で保存できます。',
    themeToggle: (theme) => theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え',
    languageMenuLabel: (language) => `現在の言語：${language}。言語メニューを開く`, languageListLabel: '言語',
    homeLabel: 'ファイル圧縮の救世主ホーム', progressLabel: (fileName) => `${fileName} の処理進捗`,
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
