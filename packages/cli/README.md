# compreesor-cli

批量压缩和转换图片、SVG、GIF 与视频的命令行工具。图片由 Sharp 处理，SVG 由 SVGO 优化；GIF 和视频调用本机 FFmpeg。

## 安装

```bash
npm install -g compreesor-cli
```

GIF 和视频功能需要先安装 FFmpeg。macOS 可运行 `brew install ffmpeg`。

## 使用

```bash
# 压缩单个文件或递归压缩文件夹
compreesor photo.png
compreesor ./图片目录

# 图片统一转 WebP
compreesor ./图片目录 --format webp

# 质量预设：极限 / 够用（默认）/ 无损
compreesor photo.png --preset extreme
compreesor photo.png --preset balanced
compreesor photo.png --preset lossless

# 视频压缩为 720p MP4，或提取 MP3
compreesor video.mov --format mp4
compreesor video.mov --format mp3

# 成功后替换原文件；格式转换时会在原目录更换后缀
compreesor ./图片目录 --format webp --replace --yes
```

质量预设会按媒体类型选择合适参数：

- `extreme`（极限）：图片质量 55、最长边 1600；GIF 降至 10fps、最长边 640；视频最高 480p；MP3 96kbps。
- `balanced`（够用，默认）：图片质量 80、最长边 2560；GIF 12fps、最长边 960；视频最高 720p；MP3 160kbps。
- `lossless`（无损）：图片使用无损编码，JPEG 原格式直接保留；SVG 保留几何精度；GIF 原样保留；视频仅封装转换、不重新编码。MP3 格式本身不支持无损，因此映射为最高保真的 320kbps。

原有 `--quality 1-100` 参数仍可用，会覆盖预设中的图片质量和视频 CRF，其他参数继续由预设决定。

不加 `--replace` 时，结果会以 `原文件名-压缩.ext` 写到源文件旁边。重新编码后若体积更大，会保留较小的原内容。

完整源码：[github.com/yanghaoleng/compreesor](https://github.com/yanghaoleng/compreesor)

MIT License
