# Cloudflare 发布记录

## 本次记录的线上版本

以下保留 2026-09-22 这次静态发布的实际证据，不保证仍是线上最新版。源码后续更新见 [更新记录](../CHANGELOG.md)，通用 GitHub 构建配置见 [静态托管说明](github-static-hosting.md)。

- 发布日期：2026-09-22（北京时间）
- 网站：https://jugetiezi.hector-aries.workers.dev
- 项目：`jugetiezi`，Cloudflare Workers Static Assets，仅静态资源。
- 应用版本：`0.2.5`，构建：`20260922.3`。
- 控制台版本短 ID：`d6363537`；发布方式：Dashboard 手动上传。
- 控制台：https://dash.cloudflare.com/a0b180c4afd69f185b28892262918dd9/workers/services/view/jugetiezi/production
- 控制台显示纯静态资源请求免费；本次未购买付费套餐或服务器。

Pages 创建接口返回未知错误，项目列表确认无项目后，改用 Workers 的静态文件上传入口并成功部署。因此本次正式地址是 `workers.dev`，不是 `pages.dev`。

## 发布产物与验证

- 归档：`.release-artifacts/cloudflare-20260922-035819/jugetiezi-cloudflare.zip`。
- 归档 SHA-256：`ecace81e3bff61a52a5ff85f205efd052f119f835440656a30e4a1011980b6d5`。
- 共 86 个文件，7,046,167 字节；只包含构建白名单资源。
- 发布前 `npm run build`、`npm run check:web` 成功，`npm test` 191 项通过。
- 发布前再次核实归档及其文件哈希，复用同一归档的测试证据。
- 线上 `release.json` 与归档一致；84 个公开资源的 SHA-256 全部匹配。另一个文件 `_headers` 作为平台配置处理，不作为普通公开资源核验。
- `.git/config`、`.env`、`runtime/big3.sqlite`、`preview/server.js`、`api/auth/me` 均返回 404。
- HTTPS 响应中已确认缓存和安全响应头；浏览器实际验证首页、肌肉图谱、1500×642 动作图片加载及阶段切换。
- 验证结果：`.release-artifacts/cloudflare-20260922-035819/cloudflare-verification.json`。
- Python HTTP 校验首次得到 403；改用 curl 后完成文件比对。一次 TLS 瞬断经有限重试后恢复。此结果不证明中国大陆所有网络可稳定直连。

## 当前边界与后续更新

当前是浏览器本机记录版。账号、跨设备同步和留言板没有上线，不能将本次静态发布视为后端发布。未上传本地数据库、用户训练记录或服务端凭证。

本次发布时尚未绑定 `hectorgao.com` 下的自定义域名，也未修改阿里云 DNS；当时尚未推送 GitHub 或启用自动部署。之后源码已接入 GitHub 检查与静态产物，仍不能据此认定 Worker 已自动更新。后续更新应复用当前 Worker，可接入 GitHub 构建或 Wrangler 发布，避免另建同用途项目。自定义域名必须按 Workers 的实际接入要求另行配置，不能直接套用 Pages 的 CNAME 流程。

本地程序、旧网站和这个新域名各有独立的浏览器存储。需要迁移训练记录时，在旧地址导出，再到新地址导入；不要清除浏览器数据。
