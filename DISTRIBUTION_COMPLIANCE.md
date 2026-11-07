# 分发检查清单

本文件是技术排查和发布前待办，不是法律意见、合规保证、新授权或源码提供承诺。根 MIT 许可证及第三方原有条款保持不变。

## 已补的构建行为

- `scripts/copy-ffmpeg-core.mjs` 在复制核心时，同时复制 GPL 全文、第三方通知和本清单；检查安装的 core 版本与已审阅依赖记录一致，避免升级后沿用过期通知。
- Vite 的 `public/` 复制机制将上述文件带入网页 `dist/` 和桌面 `web-dist/`。桌面现有 `extraResources` 打包整个 `web-dist`。
- CLI `files` 白名单包含独立的第三方通知、许可证目录和分发清单。sharp 和其 libvips 二进制包采用不同许可，已经分开记录。

## 未完成的 FFmpeg 源码核对

分发 `ffmpeg-core.js` / `.wasm` 是分发核心程序。**只增加 GPL 文本或上游主页链接不足以证明满足 GPL 的对应源码义务。**发布者仍须：

1. 建立与 **@ffmpeg/core 0.12.10 的实际二进制**对应的完整源码集合，包括 FFmpeg、启用的 x264/x265 等库、ffmpeg.wasm 绑定/修改、必要构建和安装脚本、构建版本及修改记录。
2. 核对配方中所有可移动分支的确切提交，不能用今天的 `master` 代替构建当时的源代码；保存可验证的版本与归档校验值。已附的 `-version` / `-L` 输出只证明二进制自报配置，不证明完整可复现性。
3. 选择并落实适用 GPL 版本允许的源码交付方式，与二进制一同发布或满足其他适用条件；验证接收者实际可取得该源码。不要把指向第三方站点的链接自动当成发布者的合格源码提供。
4. 核对全部编入核心的第三方版权、许可文本与必要通知，以及应用与核心的组合方式对分发条件的影响。本清单未穷尽所有编解码库或替任何权利人授权。

本次没有额外公开项目自有源码、改变根许可、签发书面源码要约或作出长期提供源码承诺。若下一步涉及扩大自有代码授权范围或新增承诺，须单独决定并确认。

## CLI / Electron 与其他依赖

- 见 [CLI 分发清单](packages/cli/DISTRIBUTION_COMPLIANCE.md)。Electron 成品需检查其实际架构的 sharp/libvips、Electron 自带 LICENSE 与 LICENSES.chromium.html 等通知，不能以 Linux npm 测试替代 macOS 安装包检查。
- jSquash、PDF 相关 WASM/字体等嵌入代码及全部传递依赖仍须按实际构建核对；顶层包 SPDX 字段不是穷尽的二进制许可清单。
- 不把通知补齐或单次构建通过描述为“已完成 GPL/LGPL 合规”。历史下载包、npm 发布和线上部署需分别检查，Git 提交不会自动修补历史版本。

## 验证命令

```sh
npm ci --ignore-scripts
npm run lint
npm run build
npm --prefix packages/cli ci --ignore-scripts
npm run cli:test
(cd packages/cli && npm pack --ignore-scripts --json)
# 查看真实 tarball，及 dist/ffmpeg/COPYING.GPLv2、dist/licenses/、通知和本清单。
# 桌面成品需另在对应平台执行现有打包流程并检查 web/ 与依赖许可证。
```

这些命令不发布 npm 包，也不部署站点。源码交付、全部依赖通知和桌面成品未核验前，分发检查仍未关闭。
