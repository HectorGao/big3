# 举个铁子 · 文档导航

[返回项目首页](../README.md)

这是当前维护入口。模块 README 描述现有实现；`release-*`、审查报告和带日期的验证结果是历史证据，不是当前线上状态保证。版本以 [release.js](../miniprogram/lib/release.js) 为准。

## 使用与运行

| 文档 | 内容 |
| --- | --- |
| [用户指南](user-guide.md) | 建档、训练、试重、保存、收藏、补录、回声和备份 |
| [网页 README](../preview/README.md) | 本地启动、静态构建、模块与常见问题 |
| [微信 README](../miniprogram/README.md) | 导入、共享逻辑、分包和真机验证边界 |
| [后端 README](../server/README.md) | 环境变量、账号、API、数据库与模拟数据 |
| [研究 README](../research/README.md) | 授权数据准备的入口与产物 |
| [参与开发](../CONTRIBUTING.md) | 测试、数据保护、明确文件提交与同步约定 |
| [安全与隐私](../SECURITY.md) | 密码、敏感数据、报告问题与生产边界 |

## 部署与备份

| 文档 | 内容 |
| --- | --- |
| [GitHub 与静态托管](github-static-hosting.md) | Actions、Pages 自动发布、训练记录存储边界、Cloudflare / EdgeOne 配置 |
| [生产账号与每周备份](production-accounts-backup.md) | 正式管理员初始化、生产隔离、手动下载及恢复边界 |
| [Cloudflare 发布记录](cloudflare-deployment.md) | 某次 Workers 静态上传的版本、校验与限制 |
| [Sites 与域名接入](web-deployment.md) | 另一发布渠道的打包流程和 DNS 操作边界 |
| [多端与模型路线](deployment-and-model-roadmap.md) | 后续架构建议；路线不等于已实现 |

## 训练与界面规则

| 文档 | 内容 |
| --- | --- |
| [处方证据分层](prescription-evidence.md) | 研究原则、产品规则和个体校准 |
| [科学计算说明](scientific-basis.md) | PB/e1RM 公式、适用范围与限制 |
| [工作台与账号](ui-upgrade.md) | 训练交互、疲劳细分、器械替代及账号同步 |
| [收藏、补录与回声](routines-community.md) | 自定义动作顺序、补录和交流流程 |
| [拖拽与回声动效](motion-echo.md) | 卡片排序、动画和减少动态效果 |
| [器械偏好与 PB](preferences-pb.md) | 过滤替换、负荷计量和成绩更新 |
| [素材来源](media-sources/README.md) | 原创教学图、动作阶段、审核状态与包体检查 |
| [本地算法研究](local-model-preparation.md) | 授权、质检、评估切分、基线和未实现项 |

## 历史记录

- [版本更新索引](../CHANGELOG.md)：逐版变化与对应验证记录。
- [早期重建进度](rebuild-progress.md)：动作库和规划重建阶段记录。
- [2026-09-17 审查](review-2026-09-17.md)：迁移时的风险和待修复项。
- [早期验证报告](verification.md)：历史浏览器和共享逻辑检查，不作为新版本验收。
- [初始设计方案](superpowers/plans/2026-09-09-muscle.md)：保留的历史文件，不代表当前开发流程或启用任何同名工具。

正式发布需分别确认源码、构建产物、网站版本、后端可用性及原生运行状态。不要用“GitHub 已推送”替代“网站已更新”，或用“静态站点可访问”替代“登录和数据同步已上线”。
