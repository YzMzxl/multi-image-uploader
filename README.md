# 多图床上传小工具

一个面向浏览器的多图床上传工具，提供统一的 Node 代理上传层、SCDN 可视化设置面板，以及 Lsky Pro+ 多实例支持。

仓库：
- https://github.com/YzMzxl/multi-image-uploader

当前版本：
- `v1.4.0`

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YzMzxl/multi-image-uploader)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YzMzxl/multi-image-uploader)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YzMzxl/multi-image-uploader)

说明：
- Cloudflare 按钮默认走 Workers + Static Assets 部署
- 同一仓库也支持直接导入到 Cloudflare Pages
- Vercel 与 Netlify 会使用仓库内已提供的 API 入口和静态资源目录

## 项目简介

项目包含：
- 前端上传界面
- Node.js 本地代理服务
- 多图床上传适配层
- SCDN 输出域名切换与上传通道轮询
- Lsky Pro+ 多实例配置

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
- SCDN 通过前端设置面板控制输出格式、密码保护与输出域名
- SCDN 设置保存在当前浏览器，无需修改 `.env`
- 可直接部署到 Cloudflare Pages / Workers、Vercel、Netlify

## 项目结构

```text
.
|-- .env.example
|-- .gitignore
|-- _worker.js
|-- api
|   `-- [...path].js
|-- public
|   |-- app.js
|   |-- index.html
|   |-- services.json
|   `-- styles.css
|-- providers
|   |-- API_IMG_58IMG.js
|   |-- API_IMG_CELINE.js
|   |-- API_IMG_IMGBB.js
|   |-- API_IMG_IPFS.js
|   |-- API_IMG_LSKY.js
|   `-- API_IMG_SCDN.js
|-- netlify
|   `-- functions
|       `-- api.js
|-- CHANGELOG.md
|-- index.js
|-- netlify.toml
|-- package.json
|-- runtime-config.js
|-- server.js
|-- vercel.json
|-- worker.js
`-- wrangler.jsonc
```

说明：
- `public/`：静态前端资源目录，供 Vercel / Netlify / Cloudflare 静态资源托管使用
- `_worker.js`：Cloudflare Pages / Workers 入口
- `api/[...path].js`：Vercel Serverless API 入口
- `netlify/functions/api.js`：Netlify Functions API 入口
- `providers/`：图床适配模块
- `index.js`：统一 API 路由核心，三平台入口都会复用
- `server.js`：本地 Node 开发服务器

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

## 部署说明

### Cloudflare Pages

支持直接导入 GitHub 仓库部署。

推荐配置：
- Framework preset: `None`
- Build command: 留空
- Build output directory: `.`

说明：
- Pages 会使用根目录 `_worker.js`
- 静态资源实际位于 `public/`
- `_worker.js` 会将非 API 请求转发到 `public/` 中的静态文件

### Cloudflare Workers

仓库内已提供 `wrangler.jsonc`，可直接使用：

```bash
npm install
npx wrangler deploy
```

说明：
- 使用 `_worker.js` 作为 Worker 入口
- 使用 `public/` 作为静态资源目录

### Vercel

仓库内已提供：
- `public/` 静态资源目录
- `api/[...path].js` Serverless 入口
- `vercel.json`

直接导入仓库即可部署。

### Netlify

仓库内已提供：
- `public/` 静态资源目录
- `netlify/functions/api.js` 函数入口
- `netlify.toml`

直接导入仓库即可部署。

## 环境变量

项目启动时会按以下优先级加载配置：
1. 系统环境变量
2. `.env.local`
3. `.env`

常用变量：
- `PORT`
- `AUTH_TOKEN`
- `LSKY_PRO_SERVICES`
- `LSKY_PRO_*`

完整说明见：[.env.example](./.env.example)

## SCDN 设置面板

SCDN 通过以下公共接口上传：

```text
https://img.scdn.io/api/v1.php
```

支持的参数：
- `outputFormat`
- `password_enabled`
- `image_password`
- `cdn_domain`

在本项目中，这些设置通过前端可视化面板控制：
- 输出格式
- 密码保护
- 图片访问密码
- 输出域名

兼容策略：
- 官方文档将 `cdn_domain` 标注为“需在后台配置”
- 实测中，不同 CDN 上传通道的稳定性并不一致
- 项目会轮询以下上传候选：
  - 默认上传
  - `img.scdn.io`
  - `cloudflareimg.cdn.sn`
  - `edgeoneimg.cdn.sn`
  - `esaimg.cdn1.vip`
- 一旦任一候选上传成功，就提取成功链接路径
- 最终再按前端选择的输出域名改写返回链接

支持的输出域名：
- 默认返回域名
- `img.scdn.io`
- `cloudflareimg.cdn.sn`
- `edgeoneimg.cdn.sn`
- `esaimg.cdn1.vip`

支持的输出格式：
- `auto`
- `jpeg`
- `png`
- `webp`
- `gif`
- `webp_animated`

## Lsky Pro+ 配置

### 推荐：多实例配置

```env
LSKY_PRO_SERVICES=[{"key":"main","name":"Lsky 主图床","baseUrl":"https://img-a.example.com","token":"token-a","storageId":"1"},{"key":"backup","name":"Lsky 备份图床","baseUrl":"https://img-b.example.com","token":"token-b","storageId":"2","albumId":"5","isPublic":true}]
```

### 兼容：单实例配置

```env
LSKY_PRO_KEY=default
LSKY_PRO_NAME=Lsky Pro+
LSKY_PRO_BASE_URL=https://img.example.com
LSKY_PRO_TOKEN=your-token
LSKY_PRO_STORAGE_ID=1
```

## 可用接口

- `GET /api/health`
- `GET /api/services`
- `GET /api/settings`
- `POST /api/scdn-upload`
- `POST /api/lsky-upload/<key>`
- `POST /api/*`

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
