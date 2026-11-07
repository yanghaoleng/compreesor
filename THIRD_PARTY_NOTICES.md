# 第三方许可说明

本项目已有的 [MIT 许可证](LICENSE)保持不变，只适用于其覆盖的项目代码。第三方软件继续遵守其原有条款；根 MIT 不会覆盖或替代 FFmpeg 核心、libvips 及其依赖的许可证。

## ffmpeg.wasm 网页与桌面核心

- `@ffmpeg/core 0.12.10` 的包声明为 **GPL-2.0-or-later**。锁定下载地址与完整性值见 [依赖记录](licenses/DEPENDENCIES.json)。该版本 `dist/esm/ffmpeg-core.js` 和 `ffmpeg-core.wasm` 被复制到 `public/ffmpeg/`，网页会向浏览器分发它们，Electron 安装包亦通过 `web-dist` 包含它们。
- 对实际安装 WASM 执行 `-version` / `-L` 的结果显示：**FFmpeg 5.1.4**，Copyright (c) 2000-2023 the FFmpeg developers；Emscripten 3.1.40；启用了 `--enable-gpl`、`libx264`、`libx265` 等组件。原始输出保存在 [BUILD-INFO.txt](licenses/ffmpeg/BUILD-INFO.txt)。退出日志中的 `Aborted()` 来自该 WASM 命令退出实现，不是一次完整音视频功能测试。
- [GPL v2 全文](licenses/ffmpeg/GPL-2.0.txt)从 FFmpeg n5.1.4 的 `COPYING.GPLv2` 原样保留；实际核心允许按 GPL v2 或其后版本使用。构建脚本还将该全文作为 `ffmpeg/COPYING.GPLv2` 与核心文件一同复制。
- `@ffmpeg/ffmpeg 0.12.15` 与 `@ffmpeg/util 0.12.2` 是 MIT 包装层。Copyright (c) 2019 Jerome Wu，[MIT 全文](licenses/ffmpeg-wrappers/MIT.txt)。**包装层的 MIT 不等于核心是 MIT。**
- 上游：[ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)、[FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4)。已核对的构建配方参考：[Dockerfile at 71aa99d37c02a7b4c435275ca9ef50e612f6efa1](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/Dockerfile)。该提交中的 core manifest 声明 0.12.10，但并未据此证明其所有输入与 npm 二进制逐项对应；配方包含可移动分支引用，不能把此链接当成完整对应源码交付。

FFmpeg 核心按原 GPL 条款提供且无担保。上述通知与链接不替代 GPL 要求的对应源码或其他适用分发条件。对应用与 GPL 核心的组合作用范围应按实际架构判断，本次修复没有把整个仓库改成 GPL，也没有给第三方添加非商业限制。

## CLI 与桌面原生依赖

CLI 使用 `sharp 0.34.5`（**Apache-2.0**）；其预编译 `@img/sharp-libvips-* 1.2.4` 包声明为 **LGPL-3.0-or-later**，不能混称 sharp 本身为 LGPL。详见 [CLI 第三方通知](packages/cli/THIRD_PARTY_NOTICES.md)及其许可证目录。桌面版包含 CLI 及实际平台依赖，需要一并核对。

CLI 调用用户本机安装的 FFmpeg，不等于本仓库提供了该原生 FFmpeg；应按用户实际安装的版本与编译配置核对其许可。

## 分发范围

`prepare:media` 将本通知、`licenses/` 及 [DISTRIBUTION_COMPLIANCE.md](DISTRIBUTION_COMPLIANCE.md)复制到 `public/`，Vite 将其复制到网页与桌面 web 输出。该清单覆盖已核对的重点组件，不是全部 jSquash、PDF、Electron 或其他依赖的完整许可审计。每个实际发布物仍应保留各自的原始版权与许可通知。
