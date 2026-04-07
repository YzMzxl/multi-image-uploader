# Changelog

## v1.3.4

将 SCDN 上传策略改为完整轮询模式。

### Changed

- SCDN 上传阶段不再只尝试默认和单一回退域名
- 现在会轮询：
  - 默认上传
  - `img.scdn.io`
  - `cloudflareimg.cdn.sn`
  - `edgeoneimg.cdn.sn`
  - `esaimg.cdn1.vip`
- 只要其中任意一种上传成功，就使用成功链接的路径作为结果基准
- 最终输出链接再根据前端选择的输出域名改写

### Result

- 上传通道和输出域名彻底解耦
- 可以适应上游不同时间点、不同 CDN 通道成功率不一致的问题
- 输出域名选项重新包含 `img.scdn.io`

## v1.3.3

重构 SCDN 的 CDN 域名上传兼容策略。

### Changed

- SCDN 上传不再只依赖“默认上传成功”这一条路径
- 现在会优先尝试默认上传
- 默认上传失败时，自动回退到 `esaimg.cdn1.vip` 作为上传通道
- 上传成功后，再把返回链接改写成当前选中的 CDN 域名

### Result

- `cloudflareimg.cdn.sn` 可通过回退策略获得可用链接
- `edgeoneimg.cdn.sn` 可通过回退策略获得可用链接
- `esaimg.cdn1.vip` 继续保持可用
- 默认模式在上游不稳定时也能自动回退

## v1.3.2

修复另外两个 SCDN CDN 域名上传失败的问题。

### Fixed

- 通过抓包确认，失败请求的共同点是直接向上游发送了 `cdn_domain`
- 现在 SCDN 统一先用默认域名完成上传
- 上传成功后，再把返回链接改写成用户选中的 CDN 域名
- 避免上游对 `cloudflareimg.cdn.sn` 和 `esaimg.cdn1.vip` 直接重置连接

### Result

- `cloudflareimg.cdn.sn` 可正常返回改写后的链接
- `edgeoneimg.cdn.sn` 保持可用
- `esaimg.cdn1.vip` 可正常返回改写后的链接

## v1.3.1

修复 SCDN 默认官方域名导致的上传失败问题。

### Fixed

- 根据抓包确认，成功请求只发送 `outputFormat=auto`
- 失败请求额外发送了 `cdn_domain=img.scdn.io`
- 现在会把 `img.scdn.io` 视为默认域名，不再显式透传 `cdn_domain`
- 前端 CDN 选项调整为“默认域名（img.scdn.io）”
- Node 与 Worker 代理层都增加了同样的兜底逻辑

### Result

- 默认域名模式下，请求体只会发送必要字段
- 避免再次触发上游 `fetch failed`

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
