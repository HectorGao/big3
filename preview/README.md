# 举个铁子 · 网页端

[项目首页](../README.md) · [用户指南](../docs/user-guide.md) · [后端](../server/README.md)

桌面和手机使用同一套响应式页面；训练计算复用 `miniprogram/lib/`，不在网页另写一份算法。

## 本地打开

在仓库根目录、Node.js 24 环境运行：

```sh
npm ci
npm run start:local
```

打开输出地址，默认 `http://127.0.0.1:4173/preview/index.html`。页面入口为 `#overview`、`#today`、`#atlas`、`#history`、`#profile`；`/preview/figures.html` 是完整教学图册。

`npm run status:local` 查看实际端口，`npm run restart:local` 重启新版，日志在 `runtime/local-server.log`。也可使用 `npm run preview` 前台运行。仅监听本机，不是手机局域网或公网服务。

## 构建发布

```sh
npm run build:static
```

仅发布仓库根目录下的 `dist/`。构建复制明确白名单，保留第三方图标许可、生成资源哈希和 `release.json`，不会包含后端、数据库或 README。不要把整个仓库设置为公开网站根目录。

静态版只提供访客本机功能。账号同步与共享回声需要同源 `/api/` 服务；项目尚未提供任意跨域后端配置。详情见 [静态托管](../docs/github-static-hosting.md)。`package:web` 是原 Sites 渠道专用归档，不是通用 Cloudflare 打包命令。

## 模块入口

| 文件 | 职责 |
| --- | --- |
| `app.js`、`coach-ui.js` | 页面状态、日期和训练模式、概览与计划展示 |
| `workbench.js`、`routines.js` | 进行中的训练、动作选择、收藏和补录 |
| `drag-sort.js` | 卡片排序与触控拖动 |
| `sync.js`、`account-ui.js` | 账号隔离、同步、冲突处理和管理员入口 |
| `board.js`、`site-settings.js` | 底部训练回声、背景效果与全站配置 |
| `server.js` | 本地 HTTP 与 API 入口；不会进入静态构建 |

## 验证与排错

- `npm test` 覆盖共享逻辑和后端；`npm run test:web` 验证实际 `dist/`。后者需要自行准备 Playwright 及 Chromium，项目不自动下载浏览器。其他专项脚本见 [package.json](../package.json)。
- 测试使用独立浏览器或 `?qa=名称` 隔离存储，不能把演示记录写进真实档案。
- 站点打不开：先查服务状态和实际端口，不删除 `runtime/`，不清空浏览器存储。
- 静态网页提示账号服务不可用：需部署后端，不是重装网页或让访客启动本地服务。
- 页面未更新：核对顶部版本及构建号；构建产物还可核对 `release.json`。源码提交不会自动更新尚未接入 Git 部署的站点。
- 换网址后看不到训练记录：不同来源的浏览器存储不互通，先在旧地址导出再导入；网页和微信的数据也不会自动互通。
- 桌面/手机视口检查不等于实体手机触控、微信或原生 App 验收。
