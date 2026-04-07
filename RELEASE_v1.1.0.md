# v1.1.0

首个公开发布版本，完成了从单一上传演示到可实际部署的多图床上传工具的整理。

## Highlights

- 支持多个图床接口切换
- 支持 Lsky Pro+ 单实例与多实例配置
- 支持通过 `.env` 管理运行时配置
- 提供统一的 Node 代理上传层
- 前端支持拖拽、粘贴、队列上传、自动复制和 WebP 转换

## Included

- Celine
- IPFS
- ImgBB
- 58IMG
- Lsky Pro+

## Runtime Config

- `GET /api/services`
- `GET /api/settings`
- `POST /api/lsky-upload/<key>`

## Notes

- `58IMG` 为临时图床，不适合长期存储
- Lsky 的 `storageId` 是否可用，取决于当前上传身份是否有权限访问对应存储策略
- `worker.js` 为保留的单文件示例，不包含完整的多实例运行时配置能力
