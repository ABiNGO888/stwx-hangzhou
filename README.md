# stwx-hangzhou · 分支 v2-with-l4（含第四关完整版）

> **本分支 = 新上线链接的内容**；`main` 分支 = 原版（旧链接仍在线使用，两版并存）。

- **线上新链接（含第四关）**：https://wbapp-1lm2p8sprfx58zvscs6iu5.app.workbuddy.host/?sharecode=7X6YVMVAKI&kiosk=hz01
- **线上旧链接（原版三关）**：https://stwx-hangzhou.app.workbuddy.host/?sharecode=UTLU3GBTEL&kiosk=hz01
- **每日巡检**：Actions → 每日巡检（本分支的 workflow 监控新链接；main 分支 workflow 监控旧链接）

## 本分支相对 main 增加了什么

| 文件 | 作用 |
|---|---|
| `l4-bridge.js` | 接入桥：三关完成 → 播过场影片 → 弹第四关 → 合并总分 |
| `jiulong.html` | 第四关「九龙救白蛇」v1.05（md5 c30d0a49，独立单文件游戏） |
| `media/l4_transition.mp4` | 第三关结束后的过场影片（35.8MB） |
| `index.html` | 仅插入一行 `<script src="l4-bridge.js">`（换行符 CRLF→LF，内容等价） |

其余文件与 main（hangzhou_web_deploy_20261101 基线）逐字节一致。

## 流程

三侠闯关（三关）完成 → 自动播放过场影片（可跳过）→ 进入第四关九龙救白蛇（前三关累计分随行）→ 第四关结束合并最终总分 → 总分榜。
