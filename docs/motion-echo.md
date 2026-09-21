# 卡片排序与回声风格

## 本轮范围

网页今日计划保留原有处方与收藏逻辑，仅更新拖拽交互。按住左侧三横线并移动后出现与原卡片等大的半透明预览，原位置保留占位。邻项使用 FLIP / Web Animations 平滑让位，松手约 230 ms 落位后再提交顺序；接近屏幕上下边缘持续自动滚动。拖动时暂停回声动画以减少干扰。

鼠标与触控共用 Pointer Events。捕获放在不被重排的 body 上，避免移动卡片 DOM 造成 capture 丢失。Escape、pointercancel、失焦、窗口尺寸变化及页面切换会取消未提交拖动并恢复原顺序。原有上下移按钮保留，手柄聚焦后方向键也可排序；屏幕阅读器收到位置播报。

只改变 `routineState.order`。不改重量、组次、负荷来源、历史或已经冻结的当前训练。界面重建时清理预览及指针状态，预览副本没有可提交的字段和操作标识。

## 回声四种风格

入口为顶部训练回声的“风格”，使用缩略图单选，立即生效。

| 风格 | 呈现 |
| --- | --- |
| 轻盈横滑 | 顶部半透明横向卡片，约 14 px/s，无背景弹幕 |
| 斜向弹幕 | 顶部卡片加两条低对比度交叉背景，约 8 px/s，背景不拦截操作 |
| 双列上浮 | 固定高度的双列卡片窗口，反向上下流动，不超过 10 px/s；只有一条内容时单列 |
| 静态精选 | 停止自动运动，横向手动浏览 |

四种风格复用相同的已审核显示状态，不新增、改写或伪造留言。顶部仍取最新 8 条，交流窗口可查看最新 100 条。偏好键 `big3-echo-style-v1` 仅保存在当前浏览器，不上传训练档案或改变其他用户偏好。管理员隐藏/恢复在所有风格中生效。

话题增加 emoji 标识；编辑器提供 12 种快捷 emoji，保留字符数限制与纯文本转义，不生成虚假点赞数。键盘和触控均可打开表情菜单。

## 材质与可访问性

毛玻璃用于拖动浮层、导航/训练工具栏和弹窗，训练数字与主要内容保持清晰。采用 CSS `backdrop-filter`，不支持时使用实色背景。减少动态效果时关闭自动轮播、旋转、缩放和落位过渡；减少透明度或增加对比度时使用实色并隐藏背景弹幕。暂停按钮、悬停/聚焦暂停及静态风格仍可用。

设计参考 Apple 的 [Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop)、[Materials](https://developer.apple.com/design/human-interface-guidelines/materials) 和 [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)。这是网页 Pointer Events / CSS 的实现，不是 UIKit 原生材质或 iOS 原生拖放 API。

## 验证

`npm run test:motion-browser` 使用隔离数据库和 QA 档案，检查 1280/768/390/360 px 的真实指针拖动、邻项过渡、落位、取消、键盘顺序、持续边缘滚动、原有处方值不变、风格切换/刷新记忆、动画位移、暂停、减少动态、表情发布及窄屏溢出；390 px 额外模拟浏览器触控移动与 touchCancel。截图在发布排除的 `playwright-report/`。

同时运行原有 routines、echo-debug、workbench 浏览器回归以及 158 项 Node 测试、静态构建与资源检查。浏览器截图已人工检查，但不声称测得所有设备的帧率，也不等同于实体 iPhone/Safari、微信真机或原生 App 验收；本机未安装 Playwright WebKit。本轮没有修改后端业务、清理数据或发布到公网。
