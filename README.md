# 文件压缩大救星 · Compressor Studio

一个轻量、开源、可商用的图片、SVG、GIF、PDF 与视频压缩工具，包含网页版、npm CLI 和 Electron 桌面版。

- 在线使用：[compreesor.mikeywa.icu](https://compreesor.mikeywa.icu/)
- npm CLI：[compreesor-cli](https://www.npmjs.com/package/compreesor-cli)
- 许可证：MIT

## 网页版

- JPG、PNG、WebP、AVIF、JXL、SVG 默认保持原格式，也可统一转为 JPG、WebP、PNG 或 PDF；PDF 可按页展开成独立图片任务
- 默认“都试试”会同时生成极限、够用、无损三档结果，列表右侧可逐档悬停查看 1:1 局部并下载
- 也可选择 100KB、500KB、2MB、5MB、10MB 目标体积，自动反推图片尺寸与画质、PDF 页分辨率、视频和音频码率
- PDF 支持无损结构整理与逐页压缩，并提供首页缩略图、预览和打包下载
- SVG 使用 SVGO 多轮优化；GIF 保留动画；视频可转 MP4、MOV、透明 MOV，或提取 MP3
- 添加文件后自动处理，静态图片双路并发；显示缩略图、进度和压缩前后体积
- 压缩率使用数字增长动画，三档显示“极限–无损”体积百分比区间；打包下载会直接收齐当前全部结果
- 下载按钮左侧提供预览；三档图片在左下角并排比较，缩放和拖动同步，视频与 MP3 可直接播放
- 已有结果时更改任一输出偏好，可在偏好栏右侧点击“全部重新处理”；按钮使用后会禁用到下一次偏好变更
- 文件列表出现后仍可继续拖入，支持简体中文、繁体中文、英文、日文和明暗主题
- 右下角为打赏作者入口，打包下载后自动展开；每次展示会随机送出一条不连续重复的夸赞与祝福，并使用逐词 `spring-scale-in` 入场

静态位图使用 jSquash WebAssembly，SVG 使用 SVGO，PDF 使用 PDF.js 与 pdf-lib，GIF 和视频使用 ffmpeg.wasm。若重新编码后体积更大，会保留较小的原文件。

## CLI

```bash
npm install -g compreesor-cli

# 文件或文件夹
compreesor photo.png
compreesor ./图片目录

# 转 WebP
compreesor ./图片目录 --format webp

# 极限 / 够用（默认）/ 无损
compreesor ./图片目录 --preset extreme
compreesor ./图片目录 --preset balanced
compreesor ./图片目录 --preset lossless

# 视频转 720p MP4 / 提取 MP3
compreesor video.mov --format mp4
compreesor video.mov --format mp3

# 成功后在原路径替换
compreesor ./图片目录 --replace --yes
```

GIF 与视频需要本机安装 FFmpeg；macOS 可运行 `brew install ffmpeg`。CLI 的详细说明见 [`packages/cli`](./packages/cli)。

## Electron 桌面版

桌面版直接复用网页版界面与处理流程，包括三档压缩、图片与 PDF 双向转换、目标体积、SVG、GIF、视频、MP3、透明 MOV、同步比较预览、打赏、CLI 说明、作者主页、多语言和明暗主题。单档模式成功后安全替换原路径文件；默认三档模式会把三份结果写入源文件所在文件夹并保留源文件，PDF 拆页会在原文件夹写入逐页图片并保留 PDF。

```bash
cd apps/desktop
npm install
npm start

# 构建 macOS 安装包
npm run dist
```

替换使用同目录临时文件与回滚备份：新文件写入成功后才移除原文件。桌面安装包不内置不可再分发的原生 FFmpeg，GIF 与视频沿用网页内置的 ffmpeg.wasm。详细说明见 [`apps/desktop`](./apps/desktop)。

## 开发与验证

```bash
npm install
npm run dev

npm run lint
npm run build
npm run cli:test
node tests/e2e.mjs
npm run e2e:pdf
```

## License

[MIT](./LICENSE) © 2026 Mikey Wa
