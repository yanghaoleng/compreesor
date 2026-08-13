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

# 视频压缩为 720p MP4，或提取 MP3
compreesor video.mov --format mp4
compreesor video.mov --format mp3

# 成功后替换原文件；格式转换时会在原目录更换后缀
compreesor ./图片目录 --format webp --replace --yes
```

不加 `--replace` 时，结果会以 `原文件名-压缩.ext` 写到源文件旁边。重新编码后若体积更大，会保留较小的原内容。

完整源码：[github.com/yanghaoleng/compreesor](https://github.com/yanghaoleng/compreesor)

MIT License
