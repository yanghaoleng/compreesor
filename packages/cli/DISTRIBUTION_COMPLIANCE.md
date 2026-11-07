# CLI / 原生依赖分发检查

这是发布前技术清单，不是法律意见、新授权、源码要约或合规保证。MIT 原文及依赖的原有授权保持不变。

- `files` 白名单包含 `THIRD_PARTY_NOTICES.md`、`DISTRIBUTION_COMPLIANCE.md` 与 `licenses/`，可用 `npm pack --ignore-scripts --json` 生成实际 tarball 并检查。
- npm 包没有捆绑 node_modules，CLI 安装依赖与 Electron 重分发是不同场景。对最终分发的每一种架构分别记录已安装 sharp、@img/sharp-*、@img/sharp-libvips-* 版本和 `versions.json`。
- 核对实际包含的 LGPL 库及其对应源码、必要构建脚本/修改记录；验证允许修改和替换库，以及必要的重新链接/重新组合机制，不能只因 `.so` / `.dylib` 为动态库便认定满足条款。应按适用 LGPL 条款提供所需材料或机制，并检查包装、签名等是否妨碍替换。
- `licenses/sharp-libvips/THIRD-PARTY-NOTICES.md` 是 v1.2.4 上游的组件许可清单。还需按实际平台构建保留各组件的版权、许可全文及必要通知；本次未重建或逐一审计其中全部库。该上游链接不是完整对应源码的替代品。
- `sharp` 的 Apache-2.0 与预编译 libvips 包的 LGPL-3.0-or-later 不可混为一个许可证。不要用根 MIT 覆盖它们，也不要对第三方代码新增非商业限制。
- Electron 最终安装包另需检查 Chromium/Electron 通知、网页 FFmpeg 通知与源码交付；仅验证 CLI tarball 不代表桌面成品已经合规。

历史发布包不会随 Git 文件变更自动修补。本次没有发布新的 npm 版本、构建 macOS 安装包或承诺长期提供源码。若需额外公开自有代码或作出不可撤销新授权/承诺，应另行确认。
