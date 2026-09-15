# 项目维护约定

- 默认只维护网页版与 CLI；Electron 桌面客户端暂停维护。
- 只有用户明确要求手动更新客户端时，才修改 `apps/desktop/` 的客户端实现、升级 Electron 依赖、运行 Electron 专用验证或重新生成安装包。
- 常规网页修改、仓库同步和发布不附带执行 `desktop:dev`、`desktop:dist`、`e2e:electron` 或 `apps/desktop` 下的启动、打包命令。
- 保留客户端源码、锁文件和 `apps/desktop/build/` 图标等构建源材料；`apps/desktop/release/`、`apps/desktop/web-dist/` 与客户端专用 `node_modules/` 均为可重建内容，不提交仓库。
- 用户明确要求手动更新时，再安装客户端依赖并执行对应验证与打包；完成后按需要清理产物，不自动开启周期维护。
