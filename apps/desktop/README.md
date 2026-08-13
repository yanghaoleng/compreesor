# Compreesor Desktop

小窗口 Electron 图片压缩器。先选择输出格式与质量，拖入图片后会自动处理，并在成功后直接替换原文件。转换格式时，新文件仍位于原目录，但扩展名会同步更改。

## 开发

```bash
npm install
npm start
```

## 构建 macOS 安装包

```bash
npm run dist
```

桌面端复用 `compreesor-cli` 的压缩核心，并通过临时文件和回滚备份完成替换：只有新文件写入成功后才移除源文件。
