# stwx-hangzhou · 超级舌阿蜥 杭州大屏网页版

「超级舌阿蜥」杭州门店大屏网页版的发布仓库。

- **现场权威入口**（线下大屏二维码指向）：https://stwx-hangzhou.app.workbuddy.host/?sharecode=UTLU3GBTEL&kiosk=hz01
- **GitHub Pages 镜像**：https://abinngo888.github.io/stwx-hangzhou/
- **每日巡检**：GitHub Actions 每天北京时间 09:00 自动只读巡检（页面可达性、双域内容一致性、榜单接口、Service Worker 特征），结果见 **Actions** 标签页。

## 手机上怎么用

| 想做什么 | 在哪做 |
|---|---|
| 看巡检结果 | GitHub App / 网页 → 仓库 → Actions → 最新一次「每日巡检」 |
| 云端改代码 | 网页/GitHub App 直接编辑文件提交 → Pages 自动重新发布 |
| 手动触发巡检 | Actions → 每日巡检 → Run workflow |

## 目录说明

- `index.html` + `game.js` 等为站点根文件；`jieqi/` 为 24 节气待机页；`intro-video/` 为待机轮播视频。
- Service Worker 缓存名固定 `stwx-hz-main`，禁 bump。

## 注意

- 两个域名（workbuddy.host 与 github.io）内容保持一致，巡检会比对哈希。
- 线下大屏二维码仍指向 workbuddy 域；GitHub Pages 为镜像与云端管理入口。
