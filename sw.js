// 超级舌阿蜥 · 杭州线下版 —— 本地缓存 Service Worker（2026-10-11）
// 作用：首次打开后把全部游戏资源（JS/图片/音频/关卡）缓存在本机，
//       之后每次进入都直接读本地 —— 不走网络、断网也能完整运行，画面不再因加载卡顿。
// ⚠️ 发版规则 [A1 2026-11-12 起]：CACHE 名永久固定为 stwx-hz-main，**禁止再 bump**。
//    换资源 = 改文件 + 跑 _build_release.js（按文件内容写 ?v=<hash>）；URL 变 → 精确缓存
//    自然不命中旧条目 → 回源拿新版，同时老缓存继续服务未变资源。换 CACHE 名会整锅清掉
//    现场几天的缓存，正是 2026-11-12「待机视频没了 / 游戏卡住」事故的根因。
// 视频文件（intro-video/*.mp4 约 78MB、video/*.mp4 变身视频）特意不缓存：交给浏览器自身的 HTTP 缓存。
// [A2 2026-11-13] 上线「现场扫码记录」旁路埋点：本行注释是 sw.js 唯一变更，
//   目的是触发一次 SW 更新 → 现场大屏自动重载拿到新 index.html（由首屏占位图顶住，不黑屏）。
//   CACHE 名与缓存策略一概不动，缓存不清、视频不重下。
// [LB-FIX 2026-11-13 13:2x] 修复 500 强榜单显示分「3→999」反升断崖（仅改 index.html 内联显示逻辑，
//   外部资源哈希未变）。本行注释同样是 sw.js 唯一变更，只为触发一次 SW 更新 → install 里的
//   clients.navigate 让现场大屏自动重载一次，拿到修复后的页面；CACHE 仍固定 stwx-hz-main，
//   缓存不清、视频不重下、游戏逻辑与云函数零改动。
// [LB-RESTORE 2026-11-13 13:4x] 用户确认口径：500 强恢复显示腾讯云真实总分（取消 -1000），
//   虚拟补位行分数恒 >=500，合并后自动按分数排列一次。同样只改 index.html 内联显示逻辑，
//   本行注释仅为触发一次 SW 更新让现场自动重载；CACHE 名与缓存策略一概不动。
// [LB-JANK-FIX 2026-11-19] 修复待机榜 transitionend 僵尸监听器逐局累积导致的掉帧：
//   roll() 每次挂监听但被 cancelRoll 取代的旧监听永不摘除，几小时后闭包堆积卡帧。
//   仅改 index.html 内联逻辑（curOnEnd 登记位 + cancelRoll 无条件移除 + finish 收尾清理）。
//   本行注释为 sw.js 唯一变更，只为触发一次 SW 更新 → clients.navigate 让现场常驻大屏
//   自动重载拿到修复；CACHE 名仍固定 stwx-hz-main，缓存不清、视频不重下。
// [JIEQI-CALENDAR 2026-11-19] 待机轮播新增 24 节气日历页 jieqi.html（每轮视频播完后插一次）。
//   install 里预缓存该 HTML；导航白名单放行 jieqi.html，避免被统一重写成 index.html。
//   本行注释为触发一次 SW 更新用；CACHE 名、缓存策略一概不动。
var CACHE = 'stwx-hz-main';

// 预缓存清单（构建脚本自动生成，全部为本站真实存在的文件）
var PRECACHE = [
  // [2026-11-15] 左下角二维码文案字体（抖音美好体 DouyinSans，SIL OFL 1.1）
  //   改 sw.js 内容即触发一次 SW 更新 → install 用 cache:'reload' 把字体装进包，断网也能正确显示
  'assets/fonts/douyin-sans-qr.woff2',
  'assets/logo_side_l.jpg',
  'assets/logo_side_r.jpg',
  'assets/share_cover_1x1.jpg',
  'assets/share_cover_5x4.jpg',
  'assets/sprites/axi_warmup_40f_160.png',
  'display.html',
  'entry.html',
  'game.js',
  'hangzhou-cover.jpg',
  'index.html',
  // [JIEQI-CALENDAR] 24 节气待机页本体（图片/音频体积大，走运行时缓存，不塞进预缓存）
  'jieqi.html',
  // [v22] 角色玩法说明图（阿蜥/白娘子/小青 各一张，WebP 无损观感、合计约 1.5MB）
  //   开局/变身之前淡入播放，必须断网也能出图 → 纳入预缓存
  'intro-guide/guide_axi.webp',
  'intro-guide/guide_bainiangzi.webp',
  'intro-guide/guide_xiaoqing.webp',
  'kiosk-qr.png',
  // [v94] 地图种子纳入预缓存：原先只在页面运行时按需拉，靠「runtime cache miss」才回源，
  //   一旦 CACHE 没换名就会被旧的 runtime 副本命中（?seed=Date.now() 因 ignoreSearch 失效）。
  //   放进 PRECACHE 后由 install 用 cache:'reload' 无条件回源，换种子＝只改此文件 + CACHE 换名。
  'kiosk_maps_override.json',
  'level_pack.json',
  // [v2 两侧黑边丰富] LOGO 底图素材 + 清单纳入预缓存（清单用 cache:'reload' 装包 → 换素材只需重发+CACHE 换名）
  'logo/manifest.json',
  'logo/LOGO_axi_white.png',
  'logo/LOGO_open_white.png',
  'logo/qr_mini.png',
  'minigame-code.jpg',
  'openDataContext/index.js',
  'res_core/audio/collision_bumper.wav',
  'res_core/audio/collision_wall.wav',
  'res_core/audio/death_8bit.wav',
  'res_core/audio/fart_boost.wav',
  'res_core/audio/finish_applause.wav',
  'res_core/audio/finish_confetti.wav',
  'res_core/audio/portal_travel.mp3',
  'res_core/audio/score_food.wav',
  'res_core/audio/soul_ascend_8bit.wav',
  'res_core/audio/spin_loop.wav',
  'res_core/audio/tongue_attach.wav',
  'res_core/audio/tongue_detach.wav',
  'res_core/audio/tongue_extend.wav',
  'res_core/audio/voice_clear.wav',
  'res_core/audio/voice_wuhoo.wav',
  'res_core/foods/bubble_tea.png',
  'res_core/foods/congbaohui.png',
  'res_core/foods/guihuatangou.png',
  'res_core/foods/pianercuan.png',
  'res_core/foods/cake.png',
  'res_core/foods/char_siu_bao.png',
  'res_core/foods/cola.png',
  'res_core/foods/dingsheng_gao.png',
  'res_core/foods/falafel.png',
  'res_core/foods/fried_chicken.png',
  'res_core/foods/fruit_apple.png',
  'res_core/foods/fruit_grapes.png',
  'res_core/foods/fruit_orange.png',
  'res_core/foods/fruit_watermelon.png',
  'res_core/foods/golden_sweet_potato.png',
  'res_core/foods/gua_bao.png',
  'res_core/foods/hamburger.png',
  'res_core/foods/har_gow.png',
  'res_core/foods/hk_yuanyang_milk_tea.png',
  'res_core/foods/hummus.png',
  'res_core/foods/kebab.png',
  'res_core/foods/longjing_xiaren.png',
  'res_core/foods/lurou_fan.png',
  'res_core/foods/mexico_churro.png',
  'res_core/foods/mexico_taco.png',
  'res_core/foods/mexico_tamale.png',
  'res_core/foods/newyork_cheesecake.png',
  'res_core/foods/newyork_hotdog.png',
  'res_core/foods/newyork_pizza.png',
  'res_core/foods/old_shanghai_scallion_pancake.png',
  'res_core/foods/oyster_omelet.png',
  'res_core/foods/paris_crepe.png',
  'res_core/foods/paris_croissant.png',
  'res_core/foods/paris_macaron.png',
  'res_core/foods/pineapple_cake.png',
  'res_core/foods/red_braised_pork.png',
  'res_core/foods/rice_noodle_roll.png',
  'res_core/foods/roast_chicken.png',
  'res_core/foods/roast_goose.png',
  'res_core/foods/samosa.png',
  'res_core/foods/scallion_oil_noodles.png',
  'res_core/foods/scallion_pancake.png',
  'res_core/foods/shawarma.png',
  'res_core/foods/shengjian_bao.png',
  'res_core/foods/siu_mai.png',
  'res_core/foods/squid_ink_risotto.png',
  'res_core/foods/sushi_lvdoutang.png',
  'res_core/foods/taipei_pig_blood_cake.png',
  'res_core/foods/taipei_stinky_tofu.png',
  'res_core/foods/tiramisu.png',
  'res_core/foods/tofu_pudding.png',
  'res_core/foods/tokyo_sushi.png',
  'res_core/foods/tokyo_taiyaki.png',
  'res_core/foods/tokyo_takoyaki.png',
  'res_core/foods/venice_cicchetti.png',
  'res_core/foods/wonton_noodles.png',
  'res_core/foods/xihu_cuyu.png',
  'res_core/foods/xionghuangjiu.png',
  'res_core/game.js',
  'res_core/sprites/axi_curl_36_160_grid.png',
  'res_core/sprites/axi_dizzy_1_128.png',
  'res_core/sprites/axi_fart_1_128.png',
  'res_core/sprites/axi_soul_4_64.png',
  'res_core/sprites/axi_tongue_24_288_grid.png',
  'res_core/sprites/axi_victory_5_128.png',
  'res_core/sprites/crow_flight_12_352.png',
  'res_core/sprites/feather_dark_1.png',
  'res_core/sprites/feather_dark_2.png',
  'res_core/sprites/portal_distance_8_320x512.png',
  'res_scene/BGM/3.Pixel Carnival Stroll.mp3',
  'res_scene/BGM/Fruit Loop Dash-LOOP.mp3',
  // [2026-10-14 精简] 网页版只保留杭州 3 关卡（甲/乙/丙共用 bg_hangzhou.jpg），
  // 其余 10 城市背景图已删除（super_tongue_wx 权威源留有同名备份），不再预缓存。
  'res_scene/backgrounds/bg_hangzhou.jpg',
  'res_scene/game.js',
  'res_skins/game.js',
  'res_skins/portraits/bainiangzi_portrait.png',
  'res_skins/portraits/xiaoqing_portrait.png',
  'res_skins/real_snakes/green_body.png',
  'res_skins/real_snakes/white_body.png',
  'res_skins/sprites/bainiangzi_360_24_288_grid.png',
  'res_skins/sprites/bainiangzi_curl_36_160_grid.png',
  'res_skins/sprites/bainiangzi_fart_1_128.png',
  'res_skins/sprites/bainiangzi_victory_5_128.png',
  'res_skins/sprites/xiaoqing_360_24_288_grid.png',
  'res_skins/sprites/xiaoqing_curl_36_160_grid.png',
  'res_skins/sprites/xiaoqing_fart_1_128.png',
  'res_skins/sprites/xiaoqing_victory_5_128.png',
  // [2026-10-31] 恢复蛛俠/蝠俠/薯王 精灵表 + 立绘（从 super_tongue_wx 拷回）纳入预缓存，保证离线大屏可加载
  'res_skins/portraits/spider_portrait.png',
  'res_skins/portraits/bat_portrait.png',
  'res_skins/portraits/potato_portrait.png',
  'res_skins/sprites/spider_360_24_288_grid.png',
  'res_skins/sprites/spider_curl_36_160_grid.png',
  'res_skins/sprites/spider_fart_1_128.png',
  'res_skins/sprites/spider_victory_5_128.png',
  'res_skins/sprites/bat_360_24_288_grid.png',
  'res_skins/sprites/bat_curl_36_160_grid.png',
  'res_skins/sprites/bat_glide_4_320_grid.png',
  'res_skins/sprites/potato_360_24_288_grid.png',
  'res_skins/sprites/potato_curl_36_160_grid.png',
  'res_skins/sprites/potato_fart_1_128.png',
  'res_skins/sprites/potato_victory_5_128.png',
  'res_ui/game.js',
  'res_ui/ui/UI-press.png',
  'res_ui/ui/UI.png',
  'res_ui/ui/axi_avatar_pixel.jpg',
  'res_ui/ui/home_poster.jpg',
  'res_ui/ui/tutorial_popup.jpg',
  'res_ui_extra/game.js',
  'res_ui_extra/ui/comic/comic_p1.jpg',
  'res_ui_extra/ui/comic/comic_p2.jpg',
  'res_ui_extra/ui/comic/comic_p3.jpg',
  'res_ui_extra/ui/comic/comic_p4.jpg',
  'res_ui_extra/ui/daily_reward_potato.png',
  'res_ui_extra/ui/death_1_life.png',
  'res_ui_extra/ui/death_2_lives.png',
  'res_ui_extra/ui/finger_pull_down.png',
  'res_ui_extra/ui/gameover_panel.png',
  'res_ui_extra/ui/ranking_panel.png',
  'res_ui_extra/ui/score_tally/icon_crow.png',
  'res_ui_extra/ui/score_tally/icon_difficulty.png',
  'res_ui_extra/ui/score_tally/icon_fart.png',
  'res_ui_extra/ui/score_tally/icon_flight.png',
  'res_ui_extra/ui/score_tally/icon_food.png',
  'res_ui_extra/ui/score_tally/icon_height.png',
  'res_ui_extra/ui/score_tally/icon_time.png',
  'res_ui_extra/ui/score_tally/icon_tongue.png',
  'res_ui_extra/ui/score_tally/icon_total.png',
  'res_ui_extra/ui/score_tally/laurel_left.png',
  'res_ui_extra/ui/score_tally/laurel_right.png',
  'res_ui_extra/ui/tutorial/tutorial_01_auto_target_sheet.png',
  'res_ui_extra/ui/tutorial/tutorial_02_connect_release_sheet.png',
  'res_ui_extra/ui/tutorial/tutorial_03_shrink_sheet.png',
  'res_ui_extra/ui/tutorial/tutorial_06_props_sheet.png',
  'runtime/core_runtime.js',
  'runtime/game.js',
  'runtime/portal_effect.js',
  'runtime/portal_effect_config.js',
  'runtime/portal_shader_source.js',
  'runtime/real_snake_runtime.js',
  'runtime/render_runtime.js',
  'web-require.js',
  'wx-shim.js'
];

self.addEventListener('install', function (e) {
  // [v39e 2026-11-12 自杀开关 —— 清剿上午遗留的旧版 SW 劫持]
  //   现场（杭州大屏）浏览器还控制着旧版 SW（如 sw.js?v=33 / sw.js?sharecode=… 等）：
  //   这些 scriptURL 带 query 的注册，其字节今天从没变过 → 浏览器永远认为「无需更新」→
  //   旧 SW 永生，cache-first 顶掉一切导航，连 fresh=1 清理代码都执行不到
  //   （表现：待机视频黑屏、游戏卡死、地址栏停在 fresh=1 不跳转）。
  //   但它们的更新检查 URL 指向本文件 —— 字节一变就会触发 install 跑到这里。
  //   本段逻辑：注销所有 scriptURL 与自身不一致的注册 + 删掉所有非本版缓存 + 接管 + 强制重载。
  //   结果：现场只需刷新一次，旧劫持者即被注销，页面回到干净的网络加载。
  e.waitUntil((async function () {
    try {
      if (self.navigator && self.navigator.serviceWorker &&
          self.navigator.serviceWorker.getRegistrations) {
        var regs = await self.navigator.serviceWorker.getRegistrations();
        var mine = self.serviceWorker.scriptURL;
        await Promise.all(regs.map(function (r) {
          var urls = [];
          try { if (r.active) urls.push(r.active.scriptURL); } catch (e0) {}
          try { if (r.waiting) urls.push(r.waiting.scriptURL); } catch (e0) {}
          try { if (r.installing) urls.push(r.installing.scriptURL); } catch (e0) {}
          if (urls.indexOf(mine) === -1) { try { return r.unregister(); } catch (e1) {} }
          return null;
        }));
      }
    } catch (e2) {}
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    } catch (e3) {}
    await self.skipWaiting();
    try {
      var cs = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      cs.forEach(function (c) { try { c.navigate(c.url); } catch (e4) {} });
    } catch (e5) {}
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;          // 云函数 API 等跨域请求：直接放行
  if (/\.mp4$/i.test(url.pathname)) return;            // 视频：交回浏览器（含 Range 分段播放）
  // [2026-10-14 v31] 音频也交回浏览器直连：实测 SW respondWith 链路下媒体元素的
  //   资源选择可能卡死（networkState=0、play() 永远挂起 → BGM「假播放」全程无声）。
  //   音频文件都很小且带 HTTP 缓存，直连最稳。
  if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(url.pathname)) return;
  // 导航要保留显示屏 display.html 与入口 entry.html，不能全部改写为 index.html。
  if (req.mode === 'navigate') {
    var file = url.pathname.split('/').pop();
    var target = (file === 'display.html' || file === 'entry.html' || file === 'jieqi.html') ? file : 'index.html';
    // [v39 2026-11-12 关键策略变更 —— 导航改「网络优先，3.5s 超时回退缓存」]
    //   教训：v38 及之前导航是 cache-first（有缓存永远不回源），导致每次发布新 index.html
    //   都必须换 CACHE 名 → activate 删旧缓存 → 现场浏览器几天的缓存被整锅清掉，
    //   190MB 视频从零重下 → 「没有待机视频」。这是 2026-11-12 现场事故的根因。
    //   现在起：CACHE 名固定为 stwx-hz-main 永不再换，导航每次尝试网络（拿最新页面并回填
    //   缓存），网络慢/挂了 3.5s 内回退缓存，断网也照样能打开 —— 发布即刻生效，缓存永不清空。
    e.respondWith((async function () {
      var t0 = Date.now();
      try {
        var net = await Promise.race([
          fetch(req),
          new Promise(function (res) { setTimeout(function () { res(null); }, 3500); })
        ]);
        if (net && net.ok) {
          try { var c = await caches.open(CACHE); c.put(target, net.clone()); } catch (e1) {}
          return net;
        }
        if (net && !net.ok && net.status !== 403) { /* 异常状态也试缓存 */ }
      } catch (e2) { /* 网络失败 → 走缓存 */ }
      var hit = await caches.match(target, { ignoreSearch: true });
      if (hit) return hit;
      // 缓存也没有（首次）且刚才网络没走完 → 再给网络一次完整机会
      if (Date.now() - t0 < 3600) {
        try {
          var resp = await fetch(req);
          try {
            if (resp && resp.ok) {
              caches.open(CACHE).then(function (c) { c.put(target, resp.clone()); }).catch(function () {});
            }
          } catch (e3) {}
          return resp;
        } catch (e4) {}
      }
      return new Response('<h1>离线中，请稍后刷新</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
    })());
    return;
  }
  e.respondWith((async function () {
    // [v39] 先按「含查询串」精确匹配：game.js?v=53 这类带版本号的请求，更新 ?v 后
    //   必须命中新条目而不是旧缓存（v38 及之前的 ignoreSearch:true 会把 ?v=52/53 混在一起，
    //   导致改了 ?v 也永远拿旧 JS —— 这也是以前只能靠换 CACHE 名整锅清缓存的另一个原因）。
    //   精确未命中 → 回源并写入（不带查询串的老条目留在缓存里当断网兜底，不主动清理）。
    var hit = await caches.match(req);
    if (hit) return hit;
    var legacy = await caches.match(req, { ignoreSearch: true });
    var resp = await fetch(req);
    try {
      if (resp && resp.ok && resp.type === 'basic') {
        var c = await caches.open(CACHE);
        c.put(req, resp.clone());
      } else if (!resp || !resp.ok) {
        if (legacy) return legacy;   // 回源失败（网关抖动）→ 用旧版本兜底，页面不白屏
      }
    } catch (err) {
      if (legacy) return legacy;
      throw err;
    }
    return resp;
  })());
});
