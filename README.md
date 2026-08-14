# Compreesor

一个轻量、开源、可商用的图片、SVG、GIF 与视频压缩工具，包含网页版、npm CLI 和 Electron 桌面版。

- 在线使用：[compreesor.mikeywa.icu](https://compreesor.mikeywa.icu/)
- npm CLI：[compreesor-cli](https://www.npmjs.com/package/compreesor-cli)
- 许可证：MIT

## 网页版

- JPG、PNG、WebP、AVIF、JXL、SVG 默认保持原格式，也可统一转为 JPG、WebP 或 PNG
- 全局提供极限、够用、无损三档压缩比例，默认使用够用，并按图片、SVG、GIF、视频与 MP3 分别选择参数
- SVG 使用 SVGO 多轮优化；GIF 保留动画；视频可转 MP4、MOV、透明 MOV，或提取 MP3
- 添加文件后自动处理，静态图片双路并发；显示缩略图、进度和压缩前后体积
- 压缩率使用数字增长动画，结果可单独下载或打包下载
- 下载按钮左侧提供预览；图片和 GIF 在左下角小窗翻页，视频与 MP3 可直接播放
- 文件列表出现后仍可继续拖入，支持简体中文、繁体中文、英文、日文和明暗主题
- 右下角为打赏作者入口，打包下载后自动展开；每次展示会随机送出一条不连续重复的夸赞与祝福，并使用逐词 `spring-scale-in` 入场

静态位图使用 jSquash WebAssembly，SVG 使用 SVGO，GIF 和视频使用 ffmpeg.wasm。若重新编码后体积更大，会保留较小的原文件。

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

桌面版直接复用网页版界面与处理流程，包括三档压缩、图片、SVG、GIF、视频、MP3、透明 MOV、预览、打赏、CLI 说明、作者主页、多语言和明暗主题。拖入后自动处理，并在成功后安全替换原路径文件；转换格式时仍保存在原目录，并同步更改扩展名。

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
```

## License

[MIT](./LICENSE) © 2026 Mikey Wa
