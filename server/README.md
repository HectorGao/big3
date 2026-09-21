# 举个铁子 · 账号与同步后端

[项目首页](../README.md) · [正式账号与备份](../docs/production-accounts-backup.md) · [安全说明](../SECURITY.md)

Node.js 24、内置 `node:sqlite` 和本机持久化数据库。HTTP 入口在 [preview/server.js](../preview/server.js)，路由与权限在 [api.js](api.js)。不是 Cloudflare Worker，也不能通过上传静态文件自动部署。

## 本地启动与配置

在仓库根目录执行 `npm ci`、`npm run start:local`，或使用 `npm run preview` 前台调试。首次在本地登录入口创建管理员；已有管理员不会被重复初始化，没有默认密码。

| 环境变量 | 默认 / 行为 |
| --- | --- |
| `PORT` | `4173`；占用时尝试后续端口 |
| `BIG3_STRICT_PORT=1` | 端口冲突时失败，不自动换端口 |
| `BIG3_DB` | 本地 `runtime/big3.sqlite`；生产默认 `runtime/big3-production.sqlite` |
| `NODE_ENV=production` | 开启生产保护，要求设置 `BIG3_ORIGIN` |
| `BIG3_ORIGIN` | 正式 HTTPS 来源，不含路径；设置后同样开启生产保护 |

程序直接读取进程环境，不自动加载 `.env` 文件。只监听 `127.0.0.1`。数据库目录、日志与凭证不能置于公开静态目录。

## 本地模拟账号

需要调试数据时才运行，**不要在生产环境执行**：

```sh
npm run seed:demo
```

生成 `demo`、`demo_beginner`、`demo_strength`、`demo_muscle` 四个模拟账号，每个包含 39 次模拟训练，补足 100 条模拟回声。它们不是管理员，也不是真实研究样本。

新账号的密码随机生成，命令仅返回本机私密凭证文件的位置，文件权限为 `0600`。重复运行保留已存在账号的密码和档案，不提供密码重置功能；如已有数据库，会先保留数据库备份。不要把凭证内容粘贴到 README、Issue、截图或构建日志。

本地管理员也可在用户管理中切换进入模拟账号调试，再返回管理员。该功能只允许模拟成员账号，不能冒充真实用户，且在生产配置下关闭。初始化管理员与生成模拟用户是两个独立步骤。

## 同源 API

读写接口使用 JSON。写请求必须带与服务配置一致的 `Origin`，JSON 请求体需要 `Content-Type: application/json`；账号身份由 HttpOnly Cookie 确定，不接受客户端指定用户角色。

| 方法与路径 | 权限 / 用途 |
| --- | --- |
| `GET /api/health` | 公开；品牌、版本、构建号 |
| `GET /api/auth/me` | 当前身份或未登录状态、本地初始化状态 |
| `POST /api/auth/register` | 注册普通成员；需确认隐私说明，研究授权独立可选 |
| `POST /api/auth/login`、`POST /api/auth/logout` | 登录、退出 |
| `POST /api/auth/setup` | 仅本地且未初始化时创建管理员；生产关闭 |
| `GET /api/state`、`PUT /api/state` | 本人档案快照；写入需当前 `revision` |
| `PATCH /api/account` | 本人修改研究授权 |
| `GET /api/board`、`GET /api/echo-settings` | 公开的未隐藏回声与展示配置 |
| `GET /api/messages`、`POST /api/messages` | 登录后查看消息及发布，纯文本 1–280 字符 |
| `PATCH /api/messages/:id` | 管理员隐藏 / 显示 |
| `DELETE /api/messages/:id` | 作者或管理员删除 |
| `GET /api/admin/users`、`GET /api/admin/users/:id` | 管理员查看用户及其记录，带审计 |
| `GET /api/admin/echo-settings`、`PUT /api/admin/echo-settings` | 管理员读取 / 保存回声配置，带版本比较 |
| `POST /api/admin/backup` | 管理员生成真实用户全量档案备份，调试身份禁止 |
| `GET /api/admin/research-export` | 管理员导出当前授权研究快照，调试身份禁止 |
| `POST /api/admin/debug`、`POST /api/admin/debug/stop` | 仅本地管理员进入 / 退出模拟账号调试 |

同步采用整份状态快照及乐观锁：先读取 `{revision, data}`，再以同一版本提交。旧版本写入返回 `409`，客户端保留冲突副本并让用户选择，不自动覆盖或合并并发训练。前端还用 `X-Big3-Account` 避免多标签页换号时串档。

常见状态：`400` 参数错误，`401` 未登录，`403` 权限或来源不符，`409` 冲突，`413` 数据过大，`429` 限流。单份档案限制 5 MB，网页备份 / 研究导出限制 25 MB；不是无限容量服务。

## 生产运行

在服务器交互终端创建管理员，密码不回显，不能通过命令参数或管道传入：

```sh
NODE_ENV=production BIG3_ORIGIN=https://big3.hectorgao.com npm run admin:create
NODE_ENV=production BIG3_ORIGIN=https://big3.hectorgao.com npm run preview
```

以上域名仅作已选目标的配置示例，**不代表域名或后端已经部署**。两条命令必须使用相同数据库路径；需自定义时均指定 `BIG3_DB`。正式库必须与测试库隔离，含模拟账号的库会被拒绝启动。

需另外配置同源 HTTPS 反向代理、持久化磁盘、进程托管和备份恢复。当前使用单进程 SQLite、整档同步和内存限流；尚未提供多实例协调、自动灾难恢复、密码找回及账号注销流程，不应视作已完成生产安全验收。

管理员周下载是手动的档案 JSON 快照，不含密码，也不含完整消息、配置与登录状态。它不是完整数据库备份，也不能作为单用户备份导入。详情及研究授权区别见 [正式账号与备份](../docs/production-accounts-backup.md)。

## 验证

`npm test` 包含 API、账号隔离、生产拒绝模拟数据、并发冲突、管理导出和隐私测试。浏览器专项脚本使用隔离数据库，不应对真实库生成测试记录。修改后端时还应验证 HTTPS / Cookie / 代理行为；本地通过不代表已完成生产部署。
