# Changelog

## v1.1.0

首个公开发布版本。

### Added

- 新增 Node 运行时配置层，统一从 `.env` / `.env.local` 加载项目配置
- 新增 Lsky Pro+ 上传适配器
- 新增多个 Lsky 实例支持，可通过 `LSKY_PRO_SERVICES` 一次配置多个图床
- 新增单实例 Lsky 自定义名称、路由 key、展示颜色等配置项
- 新增 `GET /api/services` 与 `GET /api/settings` 运行时接口
- 新增 `.env.example` 中文注释示例

### Improved

- 前端优先读取后端运行时服务列表，保留静态 `services.json` 回退
- 项目名称、仓库链接与开源目录 `github-src` 元信息已统一
- 为开源发布补充 README、仓库链接、包元信息和发布准备文件
