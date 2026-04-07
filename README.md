# 多图床上传小工具

仓库地址：
- https://github.com/YzMzxl/multi-image-uploader

建议 GitHub 仓库描述：
- 多图床上传小工具，支持 SCDN 可视化设置、Lsky Pro+ 多实例、Node 代理与浏览器上传工作流

建议 GitHub Topics：
- `image-upload`
- `image-uploader`
- `file-uploader`
- `scdn`
- `lsky`
- `lsky-pro`
- `nodejs`
- `express`
- `self-hosted`
- `webp`
- `multi-service`

当前版本：
- `v1.3.4`

## 项目简介

一个面向浏览器的多图床上传工具，包含：
- 前端上传界面
- Node.js 本地代理服务
- 多图床上传适配层
- 运行时环境变量配置
- SCDN 可视化设置面板
- Lsky Pro+ 多实例支持

当前内置服务：
- Celine
- IPFS
- ImgBB
- 58IMG
- SCDN
- Lsky Pro+

## 特性

- 拖拽、点击、剪贴板粘贴上传
- 队列化上传与结果复制
- 自动复制 URL / Markdown / HTML / BBCode
- 上传前可选转 WebP
- Node 代理统一处理 CORS、鉴权、错误响应
- 支持通过 `.env` 配置一个或多个 Lsky Pro+ 服务
- SCDN 通过前端设置面板控制输出格式、密码保护和 CDN 域名
- SCDN 设置保存在当前浏览器，无需修改 `.env`

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
|-- CHANGELOG.md
`-- api
    |-- API_IMG_58IMG.js
    |-- API_IMG_CELINE.js
    |-- API_IMG_IMGBB.js
    |-- API_IMG_IPFS.js
    |-- API_IMG_LSKY.js
    `-- API_IMG_SCDN.js
```

说明：
- `app.js` / `index.html` / `styles.css`：前端界面
- `services.json`：基础服务元数据
- `runtime-config.js`：统一环境变量加载与运行时服务生成
- `server.js`：本地开发服务入口
- `index.js`：统一 API 路由层
- `api/API_IMG_*.js`：各上传服务适配模块
- `worker.js`：保留的单文件 Worker 示例，支持部分公共图床接口，但不包含完整的运行时多实例配置能力

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

## SCDN 设置面板

SCDN 通过公共接口上传，Node 代理会向以下地址转发请求：

```text
https://img.scdn.io/api/v1.php
```

支持的可选参数：
- `outputFormat`
- `password_enabled`
- `image_password`
- `cdn_domain`

兼容说明：
- 官方文档标注 `cdn_domain` 为“需在后台配置”的能力
- 实测中，默认上传和不同 `cdn_domain` 取值的稳定性并不一致
- 本项目现在会轮询以下上传候选：
  - 默认上传
  - `img.scdn.io`
  - `cloudflareimg.cdn.sn`
  - `edgeoneimg.cdn.sn`
  - `esaimg.cdn1.vip`
- 一旦其中任意一种上传成功，就提取成功链接的路径
- 最终再按前端面板里选择的“输出域名”改写返回链接
- 输出域名选项包含 `img.scdn.io`

在本项目中，这些设置项由前端可视化面板控制：
- 输出格式
- 密码保护开关
- 图片访问密码
- CDN 域名

特点：
- 设置保存在当前浏览器 `localStorage`
- 修改后即时生效
- 无需修改 `.env`
- 上传时随请求一起发送到本地代理服务

支持的输出格式：
- `auto`
- `jpeg`
- `png`
- `webp`
- `gif`
- `webp_animated`

文档中给出的 CDN 域名包括：
- `img.scdn.io`
- `cloudflareimg.cdn.sn`
- `edgeoneimg.cdn.sn`
- `esaimg.cdn1.vip`

## Lsky Pro+ 配置

### 推荐：多实例配置

`LSKY_PRO_SERVICES` 用一个 JSON 数组描述多个 Lsky 服务，每一项都会在前端显示为一个独立选项。

```env
LSKY_PRO_SERVICES=[{"key":"main","name":"Lsky 主图床","baseUrl":"https://img-a.example.com","token":"token-a","storageId":"1"},{"key":"backup","name":"Lsky 备份图床","baseUrl":"https://img-b.example.com","token":"token-b","storageId":"2","albumId":"5","isPublic":true}]
```

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
- `GET /api/settings`：返回脱敏后的运行时配置与 SCDN 能力信息
- `POST /api/scdn-upload`：SCDN 上传
- `POST /api/lsky-upload/<key>`：指定 Lsky 实例上传
- `POST /api/*`：其他图床上传接口

## 鉴权

设置了 `AUTH_TOKEN` 后，请求需携带以下任一请求头：

- `Authorization: Bearer <token>`
- `X-Auth-Token: <token>`

## 说明

- `58IMG` 为临时图床，不适合长期存储或稳定外链
- Lsky 的 `storageId` 是否可用，取决于当前上传身份是否有权限访问对应存储策略
- 前端默认优先读取 `/api/services`，如果没有 Node 服务则回退到静态 `services.json`

## Changelog

版本变更见：[CHANGELOG.md](./CHANGELOG.md)

## License

MIT，详见 [LICENSE](./LICENSE)
