# 举个铁子 · GitHub 同步与静态托管

仓库：https://github.com/HectorGao/big3

[项目首页](../README.md) · [文档导航](README.md) · [后端部署边界](../server/README.md)

## 已配置的同步方式

用户确认采用“每次修改完成并通过测试后提交、推送”，不是每次保存文件都自动发布。

1. 在本地完成需求，保留档案和进行中训练。
2. 运行 `npm run build:static`：源码路径/敏感模式检查、全部共享与后端测试、白名单构建、发布目录校验。涉及界面时另跑对应浏览器测试。
3. 审查修改，只暂存已确认的具体文件；运行 `npm run check:repo -- --staged --history` 检查暂存区和将公开的分支历史。
4. 提交后推送 `origin main:main`。不强制推送，不推送 `sites`、本地恢复快照或其他引用。
5. GitHub Actions 自动重复检查，并提供 `big3-static-提交哈希` 下载产物。检查失败时不会产出新的成功发布包。

自动检查不等于托管平台已经连接或网站已经上线。Actions 仅需仓库内容读取权限，不使用管理员口令、数据库、云厂商密钥，也不执行部署。平台的 Git 集成通常会自行触发构建，并不自动等待这个检查任务；因此平台构建命令也必须使用下方含测试的 `build:static`，失败则保留上一版。

后续只推送审查后的主分支。远程出现其他修改时先获取并比较，不能覆盖；登录失效或测试失败时保留本地代码、报告失败。

## Cloudflare Pages

如果已按 [Cloudflare 发布记录](cloudflare-deployment.md) 建立 Workers Static Assets 站点，应优先复用该 Worker，再单独配置它的 Git 构建；不要为本次源码同步重复创建站点。下方是 Pages 的备选接入参数，不代表更改现有 Worker。

在 Cloudflare 创建 Pages 项目并连接此 GitHub 仓库，然后配置：

| 项目 | 值 |
| --- | --- |
| 仓库 | `HectorGao/big3` |
| 生产分支 | `main` |
| 框架 | 无 / None |
| 根目录 | 仓库根目录 |
| 构建命令 | `npm ci && npm run build:static` |
| 构建输出目录 | `dist` |
| Node.js | `24`，项目已提供 `.nvmrc` |

这是自定义构建项目，不能把根目录、`preview/` 或微信源码直接作为发布目录。Pages 的 GitHub 集成可在后续推送后构建更新；首次连接仓库、授权和绑定域名仍需在平台完成。本轮未连接平台、未更改 DNS。

官方依据：[静态 HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)、[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[GitHub 集成](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)。

## 国内静态平台

腾讯云 EdgeOne Pages 可使用同一份仓库；`edgeone.json` 已声明：安装 `npm ci`，构建 `npm run build:static`，输出 `dist`。选择 `main` 和 Node.js 24。其他静态平台也可以按相同构建参数，或使用 GitHub Actions 的静态产物。具体区域可用性、域名准入与账户要求以所选平台实际控制台为准，本轮未进行平台验证。

官方配置：[EdgeOne Pages edgeone.json](https://edgeone.cloud.tencent.com/pages/document/162936771610066944)。

也可在 GitHub 仓库的 Actions 中打开成功任务，下载 `big3-static-提交哈希` ZIP。解压后应直接看到 `index.html`、`preview/`、`miniprogram/` 和 `release.json`，仅这些静态产物可上传；不要上传整个源码仓库。

## 功能边界

- 静态站点：训练规划、图谱、教学图、访客本机训练记录。
- 另需后端：注册登录、跨设备同步、管理员查看与备份、共享回声和研究导出。现有 Node/SQLite 服务不能通过上传静态目录自动变成 Cloudflare 或 EdgeOne 的数据库服务。
- 后续多用户部署需独立持久化后端、HTTPS、数据库备份及同源 `/api/` 接入；不要把 SQLite 文件放在公开静态目录。
- 换域名会切换浏览器本地存储空间。上线前先备份旧地址的训练资料；发布不清空记录。

## 密码与公开源码

没有默认管理员密码。新环境的本地 demo 通过 `npm run seed:demo` 生成随机密码，仅写入返回的私密凭证文件（权限 0600），不写到源码或日志；重复生成不更改既有账号密码。生产环境拒绝 demo 数据库和调试入口。

`runtime/`、账号数据、备份、研究样本、原始图片、凭证文件和测试截图均在 Git 忽略范围内。源码检查覆盖明确路径和高风险凭证模式，不能保证发现所有形式的敏感信息，因此仍需提交前人工审查。旧的本地恢复快照不作为分支推送，禁止 `git push --mirror`。
