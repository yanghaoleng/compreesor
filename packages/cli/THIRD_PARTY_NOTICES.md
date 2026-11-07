# CLI 第三方许可说明

本 CLI 原有 MIT 许可证保持不变。第三方依赖独立适用其原许可，不受本项目 MIT 再授权。

- **sharp 0.34.5**：Apache-2.0，作者 Lovell Fuller 与贡献者。上游：https://github.com/lovell/sharp 。[安装包 LICENSE 全文](licenses/sharp/LICENSE)。
- **@img/sharp-libvips-* 1.2.4**：预编译 libvips 及其依赖，npm 包声明 `LGPL-3.0-or-later`。这不是 sharp JavaScript 层的许可证。保留 [LGPL v3](licenses/LGPL-3.0.txt)与其引用的 [GPL v3](licenses/GPL-3.0.txt)。上游构建配方：https://github.com/lovell/sharp-libvips/tree/20b5e899954907a3039d6e3d4c200aaa0ec52c4c （tag v1.2.4）。[该提交原始第三方通知](licenses/sharp-libvips/THIRD-PARTY-NOTICES.md)按原样保留；它本身是一个清单，不是所有组件许可证全文的合集。
- 本次实际检查了 Linux x64 包，包含 libvips **8.17.3**；其他内置组件版本见 [原包 versions.json](licenses/sharp-libvips/linux-x64-versions.json)。这份 Linux 清单不冒充 macOS 或其他架构的完整核验结果。
- `licenses/DEPENDENCIES.json` 保存锁文件中的 sharp 及已记录平台包版本、下载地址与完整性值。npm 可以按 semver 为使用者解析其他版本，发布/重打包时须以实际安装树重新核对。
- CLI 从系统调用原生 FFmpeg，不在本 npm 包内捆绑该可执行文件。它的许可取决于用户安装的实际版本与编译配置；不得笼统声明所有 FFmpeg 均不可再分发或全部为 MIT。

本 npm 包未把 node_modules 打进 tarball，依赖由 npm 另行安装。桌面应用可能再分发实际平台的依赖。**通知和链接不等于已经满足 LGPL 对应源码、重新链接/替换或所有传递组件的通知义务。**见 [分发检查清单](DISTRIBUTION_COMPLIANCE.md)。
