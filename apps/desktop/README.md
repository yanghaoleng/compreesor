# Compreesor Desktop

## 维护状态

默认暂停客户端维护，只在用户明确要求手动更新时恢复。常规网页版、CLI 与仓库同步任务不自动升级 Electron、执行客户端验证或重新打包。

安装包目录 `release/`、网页打包产物 `web-dist/` 和客户端专用 `node_modules/` 已于 2026-09-15 清理；源码、锁文件和 `build/` 图标保留。下列命令仅用于后续明确要求的手动更新。

Electron 版本直接打包并运行与线上版相同的 Vite 界面，因此布局、打赏、CLI 说明、作者主页、多语言、明暗模式和文件列表行为共用一份实现。

桌面桥提供原生压缩和安全替换：单档模式成功后直接替换原文件；转换格式时，新文件仍位于原目录并同步更改扩展名。默认“两档并行”会把极限和够用两份结果原子写入源文件所在文件夹，并保留源文件。若目标路径已有文件，则拒绝覆盖。

## 开发

```bash
npm install
npm start
```

`npm start` 会先把根目录网页以相对资源路径构建到 `web-dist`，再打开 Electron 窗口。

## 构建 macOS 安装包

```bash
npm run dist
```

桌面端图片与 SVG 复用 `compreesor-cli` 的原生压缩核心；PDF 使用 PDF.js 与 pdf-lib；GIF、视频、MP3 和透明 MOV 复用网页自带的 ffmpeg.wasm，再通过桌面桥原子写入结果。因此安装包不依赖系统 FFmpeg，也不分发含 nonfree 组件的第三方原生 FFmpeg 二进制。

网页静态文件由受限的 `compreesor://app/` 协议提供，只能读取应用内 `web` 目录，同时保持 Electron `webSecurity` 开启。`bridge.d.ts` 记录了网页接入时可使用的 `window.compreesorDesktop` API。
