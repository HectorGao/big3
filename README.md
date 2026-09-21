# 举个铁子

面向深蹲、卧推、硬拉的训练规划与记录工具。根据个人档案、实际完成表现和恢复反馈，滚动生成未来 14 天的建议；网页和微信小程序共用核心计算逻辑。

[![检查与构建](https://github.com/HectorGao/big3/actions/workflows/checks.yml/badge.svg)](https://github.com/HectorGao/big3/actions/workflows/checks.yml)

**当前源码版本：v0.2.7 · 20260922.5**。版本来源：[release.js](miniprogram/lib/release.js)；[更新记录](CHANGELOG.md)。源码版本、GitHub 检查通过和网站已部署是不同状态。

[快速开始](#快速开始) · [使用说明](docs/user-guide.md) · [全部文档](docs/README.md) · [部署说明](docs/github-static-hosting.md) · [安全与数据](SECURITY.md)

## 能做什么

- **训练规划**：区分容量、强度、技术、恢复、减量及符合条件的 PB 测试，允许临时换项、延期与跳过。
- **实际记录**：逐组填写重量、次数和余力，支持试重、直接填写、部分完成、放弃组、收藏、调整顺序和事后补录。
- **动作图谱**：正背面肌群选择、器械筛选与动作替换，52 个动作、153 个教学阶段，支持图解放大。
- **成绩与恢复**：区分实际成绩和估算单次能力 e1RM，显示训练趋势、负荷来源、恢复提示和计划调整原因。
- **网页账号**：本地可运行的注册、账号隔离、跨设备同步、管理员查看和导出；另有可管理的“训练回声”。这些功能需要后端。
- **研究准备**：从明确授权的真实用户快照生成质检与离线基线报告；不自动训练模型或改写在线处方。

## 选择运行方式

| 方式 | 可用范围 | 数据位置 / 边界 |
| --- | --- | --- |
| 网页 + Node 后端 | 训练、账号同步、回声、管理与备份 | 浏览器缓存 + 服务端 SQLite；生产部署另需 HTTPS 和持久化服务 |
| 纯静态网页 | 访客训练规划、记录与动作图谱 | 当前浏览器本机；不提供注册、跨设备同步或共享回声 |
| 微信小程序源码 | 共享规划、图谱、记录与本地档案 | 微信本地存储；网页账号尚未接入，开发者工具和真机未验收 |

当前没有 Android / iOS 原生安装包。响应式网页可适配手机屏幕，但不能把网页检查当成原生应用或微信真机验证。

## 快速开始

需要 Git、**Node.js 24** 和随附的 npm。`.nvmrc` 与 GitHub 自动检查使用 Node 24；后端需要 `node:sqlite`。

```sh
git clone https://github.com/HectorGao/big3.git
cd big3
npm ci
npm run start:local
```

打开启动结果中的地址，默认是 **http://127.0.0.1:4173**。端口被占用时可能递增，以打印地址为准。完整图册位于同一地址的 `/preview/figures.html`。

1. 可先以访客身份建立档案、填写 PB 并查看计划。
2. 本地新环境点击“登录 / 注册”创建首个管理员，没有默认密码；之后普通用户自行注册。
3. 登录不会自动上传访客记录，需要在账号窗口明确选择导入。
4. 如需模拟数据，参阅 [后端 README](server/README.md#本地模拟账号)。测试密码只保存在本机私密文件中，不在仓库公开。

服务独立于启动终端运行，但不是开机自启。仅监听本机，手机访问自己设备的 `127.0.0.1` 不会连接这台电脑；公网或局域网接入需另行配置。

| 命令 | 用途 |
| --- | --- |
| `npm run status:local` | 查看运行地址和版本 |
| `npm run restart:local` | 更新本地运行服务 |
| `npm run stop:local` | 停止本地服务 |
| `npm run preview` | 前台运行，便于查看日志 |
| `npm test` | 共享逻辑、存储、后端与微信控制器模拟测试 |
| `npm run build:static` | 源码检查、测试、白名单构建及产物校验 |
| `npm run test:web` | 用 Playwright 验证构建产物，需独立准备浏览器测试环境 |

## 部署与更新

GitHub 同步按 **完成修改 → 测试 → 审查 → 提交 → 推送** 执行，不监听每次保存文件。Actions 自动检查并生成 `big3-static-提交哈希` 下载包，不会自动发布网站或修改 DNS。

| 需求 | 文档 |
| --- | --- |
| Cloudflare / EdgeOne / 国内静态平台 | [GitHub 同步与静态托管](docs/github-static-hosting.md) |
| 既有 Cloudflare 站点 | [已记录的发布结果](docs/cloudflare-deployment.md)，不是最新部署保证 |
| 注册、账号同步和每周备份 | [生产账号与备份](docs/production-accounts-backup.md) + [后端说明](server/README.md) |
| 微信开发者工具导入、素材分包 | [小程序 README](miniprogram/README.md) |

只将构建生成的 **`dist/`** 作为静态发布目录，不上传源码根目录、数据库或 `.env`。静态平台的 Git 集成需要另外接入；网站构建成功也不代表账号后端已经上线。

## 代码与文档

```text
preview/             响应式网页与本地 HTTP 入口
miniprogram/         原生微信页面与动作素材分包
  lib/               两端共用的规划、存储、动作库与版本
server/              Node / SQLite 账号、同步、回声和管理 API
research/            授权数据的离线准备与基线评估
scripts/             构建、发布检查、本地服务与浏览器验证
tests/               自动化测试
docs/                使用、科学依据、部署与历史验收记录
.github/workflows/   GitHub 自动检查和静态产物
```

模块入口：[网页](preview/README.md)、[微信小程序](miniprogram/README.md)、[后端](server/README.md)、[研究准备](research/README.md)。开发与提交约定见 [CONTRIBUTING.md](CONTRIBUTING.md)，完整导航见 [docs/README.md](docs/README.md)。

## 数据与科学边界

- 重量依据来自兼容的同动作成绩；未知辅助重量显示“待试重”，不能由硬拉 PB 推算哑铃卧推能力。实际完成与建议严格分开。
- e1RM 是估算，不等于实测极限。年龄、体重不用于虚构能力修正；恢复提示不是精确生理恢复率。
- 疼痛、高疲劳及恢复不足优先于用户选择的训练类型。PB 测试有独立资格和保护条件，不承诺个人最优效果。
- 文献原则、产品默认规则、需个体校准的参数分别说明，见 [处方依据](docs/prescription-evidence.md) 和 [科学说明](docs/scientific-basis.md)。专业教练审定和个体医疗判断不能由软件替代。
- Git 只保存代码，不备份用户训练记录。换浏览器或域名之前应导出资料；不要通过清除存储排查问题。管理员周备份目前为手动下载，不含密码且不是完整数据库备份。
- 管理备份不是研究授权。研究准备仅接受当前授权快照，排除模拟数据；没有训练或上线深度学习模型，见 [研究流程](docs/local-model-preparation.md)。

## 验证与发布状态

各版本的测试范围见 [更新记录](CHANGELOG.md)，当前提交的自动检查见仓库 Actions。测试次数和历史截图只对应当时版本，不表示后续版本自动通过。

已进行共享逻辑、后端及桌面/手机浏览器视口验证；**微信开发者工具、微信真机、原生 Android/iOS 和专业教练实地审定未完成**。没有提交微信审核。源码中的 `touristappid` 不能用于正式发布。

## 素材与授权

人体图由 [anatomy.js](miniprogram/lib/anatomy.js) 的 Canvas 几何绘制，为简化肌群示意；动作教学图片使用图像生成工具制作，未搬运 MuscleWiki 视频、图片或源码。逐图来源和初步检查意见见 [素材说明](docs/media-sources/README.md)。视觉筛查不能替代专业教学审定。

已提交优化素材，正常运行不需要重新生成。原图 `art-originals/`、私密凭证、数据库、用户备份和研究数据均不进入 Git 或静态产物。Lucide 的第三方许可由构建保留；本仓库目前未声明项目级开源许可证，公开可读不代表授予任意再分发或商用许可。
