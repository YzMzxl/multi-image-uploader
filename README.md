# 多图床上传小工具

仓库地址：
- https://github.com/YzMzxl/multi-image-uploader

建议 GitHub 仓库描述：
- 多图床上传小工具，支持 Lsky Pro+ 多实例、Node 代理与浏览器上传工作流

建议 GitHub Topics：
- `image-upload`
- `image-uploader`
- `file-uploader`
- `lsky`
- `lsky-pro`
- `nodejs`
- `express`
- `self-hosted`
- `webp`
- `multi-service`

当前版本：
- `v1.1.0`

一个面向浏览器的多图床上传工具，包含：
- 前端上传界面
- Node.js 本地代理服务
- 多图床上传适配层
- Lsky Pro+ 运行时配置与多实例支持

当前内置服务：
- Celine
- IPFS
- ImgBB
- 58IMG
- Lsky Pro+（可配置多个实例）

## 特性

- 拖拽、点击、剪贴板粘贴上传
- 队列化上传与结果复制
- 自动复制 URL / Markdown / HTML / BBCode
- 上传前可选转 WebP
- Node 代理统一处理 CORS、鉴权、错误响应
- 支持通过 `.env` 配置一个或多个 Lsky Pro+ 服务

## 项目结构

```text
.
|-- .env.example
|-- app.js
|-- index.html
|-- styles.css
|-- services.json
|-- runtime-config.js
|-- server.js
|-- index.js
|-- worker.js
`-- api
    |-- API_IMG_58IMG.js
    |-- API_IMG_CELINE.js
    |-- API_IMG_IMGBB.js
    |-- API_IMG_IPFS.js
    `-- API_IMG_LSKY.js
```

说明：
- `app.js` / `index.html` / `styles.css`：前端界面
- `services.json`：基础服务元数据
- `runtime-config.js`：统一环境变量加载与运行时服务生成
- `server.js`：本地开发服务入口
- `index.js`：统一 API 路由层
- `api/API_IMG_*.js`：各上传服务适配模块
- `worker.js`：保留的单文件 Worker 示例，不包含完整的运行时多实例配置能力

## 本地运行

要求：
- Node.js 20+

安装依赖：

```bash
npm install
```

复制环境变量示例：

```bash
cp .env.example .env
```

启动开发服务：

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:8000
```

## 环境变量

项目启动时会按以下优先级加载配置：
1. 系统环境变量
2. `.env.local`
3. `.env`

常用变量：
- `PORT`：本地服务端口
- `AUTH_TOKEN`：保护 `/api/*` 上传接口
- `LSKY_PRO_SERVICES`：多个 Lsky 实例的 JSON 数组
- `LSKY_PRO_*`：单个 Lsky 实例的兼容配置

完整说明见：[.env.example](./.env.example)

## Lsky Pro+ 配置

### 推荐：多实例配置

`LSKY_PRO_SERVICES` 用一个 JSON 数组描述多个 Lsky 服务，每一项都会在前端显示为一个独立选项。

```env
LSKY_PRO_SERVICES=[{"key":"main","name":"Lsky 主图床","baseUrl":"https://img-a.example.com","token":"token-a","storageId":"1"},{"key":"backup","name":"Lsky 备份图床","baseUrl":"https://img-b.example.com","token":"token-b","storageId":"2","albumId":"5","isPublic":true}]
```

字段说明：
- `key`：唯一标识，会用于生成路由，例如 `/api/lsky-upload/main`
- `name`：前端显示名称
- `subtitle`：前端副标题
- `baseUrl`：Lsky 站点根地址
- `apiUrl`：可选，自定义 API 基础地址
- `token`：Bearer Token
- `storageId`：默认存储策略 ID
- `albumId`：默认相册 ID
- `expiredAt`：过期时间
- `tags`：标签数组，或逗号分隔字符串
- `isPublic`：是否公开
- `removeExif`：是否移除 EXIF
- `intro`：默认简介
- `maxFileSizeBytes`：前端大小提示
- `accepts`：允许的 MIME 类型列表

### 兼容：单实例配置

如果只需要一个 Lsky 服务，也可以继续使用：

```env
LSKY_PRO_KEY=default
LSKY_PRO_NAME=Lsky Pro+
LSKY_PRO_BASE_URL=https://img.example.com
LSKY_PRO_TOKEN=your-token
LSKY_PRO_STORAGE_ID=1
```

## 可用接口

- `GET /api/health`：健康检查
- `GET /api/services`：返回前端服务列表
- `GET /api/settings`：返回脱敏后的运行时配置
- `POST /api/*`：各图床上传接口
- `POST /api/lsky-upload/<key>`：指定 Lsky 实例上传

## 鉴权

设置了 `AUTH_TOKEN` 后，请求需携带以下任一请求头：

- `Authorization: Bearer <token>`
- `X-Auth-Token: <token>`

## 说明

- `58IMG` 为临时图床，不适合长期存储或稳定外链
- Lsky 的 `storageId` 是否可用，取决于当前上传身份是否有权限访问对应存储策略
- 前端默认优先读取 `/api/services`，如果没有 Node 服务则回退到静态 `services.json`

## License

MIT，详见 [LICENSE](./LICENSE)
