# Changelog

## v1.3.0

将 SCDN 的上传参数改为前端可视化设置面板控制。

### Added

- 新增 SCDN 可视化设置面板
- 新增浏览器本地持久化的 SCDN 设置存储
- 新增上传时随请求透传的 SCDN 参数：
  - `outputFormat`
  - `password_enabled`
  - `image_password`
  - `cdn_domain`
- 新增 Node 路由层对非文件表单字段的统一透传
- 新增 Worker 示例对 SCDN 表单字段的基础支持

### Changed

- SCDN 不再依赖 `.env` 控制上传设置
- SCDN 服务说明更新为前端设置面板模式
- `/api/settings` 中的 SCDN 配置改为输出能力和默认值信息

### Improved

- 前端会在开启密码保护但未填写密码时提前阻止上传
- 设置修改后即时生效，无需重启本地服务
- 版本提升至 `v1.3.0`

## v1.2.0

新增 SCDN 图床接入。

### Added

- 新增 `SCDN` Node 代理上传模块
- 新增 `POST /api/scdn-upload` 上传接口
- 新增 SCDN 运行时设置项：
  - `SCDN_OUTPUT_FORMAT`
  - `SCDN_PASSWORD_ENABLED`
  - `SCDN_IMAGE_PASSWORD`
  - `SCDN_CDN_DOMAIN`
  - `SCDN_MAX_FILE_SIZE_BYTES`
- 新增 `/api/settings` 中的 `scdn` 配置输出
- 新增 Worker 示例中的 SCDN 基础上传支持

### Improved

- 前端服务列表新增 `SCDN`
- `.env.example` 补充 SCDN 中文注释
- README 补充 SCDN 配置说明
- 版本提升至 `v1.2.0`

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
