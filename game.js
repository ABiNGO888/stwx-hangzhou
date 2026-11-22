// 超级舌阿蜥·三侠版 V5.9.17（番薯账本零操作清污：启动同步发现库存≥50 自动云端 reset 重拉，阈值/有效期/单次三护栏，2026-10-12 失效）
// 【线下网页版·扫码核验】V5.9.13 新增：仅当从线下网页专属小程序码进入时触发——
// 解析会话号 → wx.checkIsAddedToMyMiniProgram 核验「已添加到我的小程序」→ 云函数 offline_session 上报。
// 纯新增旁路，不参与任何游戏逻辑；普通启动（无会话参数）只补码池后跳过。
(function offlineVerifyBootstrap() {
  'use strict';
  var CLOUD_ENV = 'cloud1-d6gu6meu3ce6fd439';
  function cloudReady() {
    if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.init || !wx.cloud.callFunction) return false;
    try { wx.cloud.init({ env: CLOUD_ENV, traceUser: true }); } catch (e) {}
    return true;
  }
  // 每次启动静默补充专属码池（云函数侧低于目标数量才真正生成，副作用可忽略）
  function topupPool() {
    try {
      if (!cloudReady()) return;
      wx.cloud.callFunction({
        name: 'offline_session',
        data: { action: 'topup_qr' },
        success: function () {},
        fail: function () {}
      });
    } catch (e) {}
  }
  function extractSessionId(query) {
    if (!query) return '';
    var sid = query.sessionId || '';
    if (!sid && query.scene) {
      try { sid = decodeURIComponent(String(query.scene)); } catch (e) { sid = String(query.scene); }
      var m = String(sid).match(/(?:^|[&?])sessionId=([^&]+)/);
      if (m) sid = m[1];
    }
    return String(sid).slice(0, 64);
  }
  function report(sid, added, retried) {
    try {
      wx.cloud.callFunction({
        name: 'offline_session',
        data: { action: 'report', sessionId: sid, added: added },
        success: function () {},
        fail: function () { if (added && !retried) setTimeout(function () { report(sid, true, true); }, 3000); }
      });
    } catch (e) {}
  }
  function handleEntry(options) {
    try {
      var sid = extractSessionId(options && options.query);
      if (!sid) { topupPool(); return; }
      if (!cloudReady()) return;
      topupPool();
      var done = false;
      var finish = function (added) { if (done) return; done = true; report(sid, added, false); };
      if (typeof wx.checkIsAddedToMyMiniProgram === 'function') {
        wx.checkIsAddedToMyMiniProgram({
          success: function (res) { finish(!!(res && res.added)); },
          fail: function () { finish(true); } // 接口失败不阻塞：会话专属码本身即配对凭据，云端仍记录身份
        });
      } else {
        finish(true); // 低版本基础库无此接口：保持兼容直接上报
      }
    } catch (e) {}
  }
  try { handleEntry(typeof wx.getLaunchOptionsSync === 'function' ? wx.getLaunchOptionsSync() : null); } catch (e) {}
  try { if (typeof wx.onShow === 'function') wx.onShow(function (res) { handleEntry(res); }); } catch (e) {}
})();
(function (modules, nativeRequire) {
  'use strict';
  var cache = Object.create(null);
  function localRequire(id) {
    if (cache[id]) return cache[id].exports;
    if (!modules[id]) {
      if (typeof nativeRequire === 'function') return nativeRequire(id);
      throw new Error('Module not found: ' + id);
    }
    var module = cache[id] = { exports: {} };
    modules[id](localRequire, module, module.exports);
    return module.exports;
  }
  localRequire('./game');
})({
"./sprite_manifest": function (require, module, exports) {
module.exports = {
  "image": "res_core/sprites/axi_tongue_24_288_grid.png",
  "frameWidth": 288,
  "frameHeight": 288,
  "logicalFrameWidth": 173.70,
  "logicalFrameHeight": 173.70,
  "frameCount": 24,
  "columns": 6,
  "rows": 4,
  "mouthAnchors": [
    { "x": 86.84, "y": 44.31 },
    { "x": 97.85, "y": 45.80 },
    { "x": 108.53, "y": 49.31 },
    { "x": 118.23, "y": 55.47 },
    { "x": 126.32, "y": 64.05 },
    { "x": 131.62, "y": 74.85 },
    { "x": 134.78, "y": 86.84 },
    { "x": 134.51, "y": 99.63 },
    { "x": 130.34, "y": 111.95 },
    { "x": 121.77, "y": 121.77 },
    { "x": 111.83, "y": 130.10 },
    { "x": 100.08, "y": 136.22 },
    { "x": 86.84, "y": 138.08 },
    { "x": 73.55, "y": 136.48 },
    { "x": 61.61, "y": 130.57 },
    { "x": 51.43, "y": 122.27 },
    { "x": 43.25, "y": 112.02 },
    { "x": 39.02, "y": 99.67 },
    { "x": 38.50, "y": 86.86 },
    { "x": 41.62, "y": 74.73 },
    { "x": 47.22, "y": 63.96 },
    { "x": 55.63, "y": 55.63 },
    { "x": 65.30, "y": 49.52 },
    { "x": 75.78, "y": 45.54 }
  ],
  "animations": {
    "idle":       { "row": 0, "start": 0, "frames": 24, "fps": 1 },
    "air_curl":   { "row": 0, "start": 0, "frames": 24, "fps": 12 },
    "tongue_up":  { "row": 0, "start": 0, "frames": 24, "fps": 1 },
    "tongue_mid": { "row": 0, "start": 0, "frames": 24, "fps": 1 },
    "tongue_down":{ "row": 0, "start": 0, "frames": 24, "fps": 1 },
    "hit":        { "row": 0, "start": 0, "frames": 24, "fps": 1 },
    "victory":    { "row": 0, "start": 0, "frames": 24, "fps": 12 }
  }
};
},
"./aux_manifest": function (require, module, exports) {
module.exports = {
  "curl": {
    "image": "res_core/sprites/axi_curl_36_160_grid.png",
    "frameWidth": 160,
    "frameHeight": 160,
    "logicalFrameWidth": 115.2,
    "logicalFrameHeight": 115.2,
    "frameCount": 36,
    "columns": 6,
    "rows": 6,
    // 2026-09-07：翻滚精灵暂只用 axi_curl_36_160_grid.png，闭眼/半闭眼两张先不使用（路径清空即不加载不切换，恢复时填回路径即可）
    "blinkHalfImage": "",
    "blinkClosedImage": "",
    "directional": true,
    "sourceFacing": "right"
  },
  "victory": {
    "image": "res_core/sprites/axi_victory_5_128.png",
    "frameWidth": 228,
    "frameHeight": 128,
    "logicalFrameWidth": 228,
    "logicalFrameHeight": 128,
    "frameCount": 5
  },
  "soul": {
    "image": "res_core/sprites/axi_soul_4_64.png",
    "frameWidth": 64,
    "frameHeight": 64,
    "logicalFrameWidth": 64,
    "logicalFrameHeight": 64,
    "frameCount": 4
  },
  "dizzy": {
    "image": "res_core/sprites/axi_dizzy_1_128.png",
    "frameWidth": 247,
    "frameHeight": 128,
    "logicalFrameWidth": 247,
    "logicalFrameHeight": 128,
    "frameCount": 1
  },
  "fart": {
    "image": "res_core/sprites/axi_fart_1_128.png",
    "frameWidth": 110,
    "frameHeight": 110,
    "logicalFrameWidth": 110,
    "logicalFrameHeight": 110,
    "frameCount": 1
  }
};
},
"./audio_manifest": function (require, module, exports) {
module.exports = {
  masterVolume: 1.0,
  sfx: {
    collision_wall:   'res_core/audio/collision_wall.wav',
    collision_bumper:  'res_core/audio/collision_bumper.wav',
    score_food:        'res_core/audio/score_food.wav',
    tongue_extend:     'res_core/audio/tongue_extend.wav',
    tongue_attach:     'res_core/audio/tongue_attach.wav',
    tongue_detach:     'res_core/audio/tongue_detach.wav',
    spin_loop:         'res_core/audio/spin_loop.wav',
    portal_travel:     'res_core/audio/portal_travel.mp3',
    fart_boost:        'res_core/audio/fart_boost.wav',
    death_8bit:        'res_core/audio/death_8bit.wav',
    soul_ascend_8bit:  'res_core/audio/soul_ascend_8bit.wav',
    finish_applause:   'res_core/audio/finish_applause.wav',
    finish_confetti:   'res_core/audio/finish_confetti.wav',
    voice_wuhoo:       'res_core/audio/voice_wuhoo.wav',
    voice_clear:       'res_core/audio/voice_clear.wav'
  }
};
},
"./bgm_manifest": function (require, module, exports) {
module.exports = {
  tracks: [
    { id: 'fruit_loop_dash', name: 'Fruit Loop Dash', path: 'res_scene/BGM/Fruit Loop Dash-LOOP.mp3' },
    { id: 'pixel_carnival', name: 'Pixel Carnival Stroll', path: 'res_scene/BGM/3.Pixel Carnival Stroll.mp3' }
  ],

  day: 'res_scene/BGM/Fruit Loop Dash-LOOP.mp3',
  night: 'res_scene/BGM/3.Pixel Carnival Stroll.mp3',

  stageTracks: {
    T1: 'day',
    T2: 'day',
    T3: 'day',
    L1: 'day',    // 森林
    L2: 'day',    // 农村
    L3: 'day',    // 上海
    L4: 'day',    // 杭州（2026-10-01 新增，其后关卡整体顺延一位）
    L5: 'day',    // 香港
    L6: 'day',    // 迪拜
    L7: 'night',  // 东京
    L8: 'day',    // 巴黎
    L9: 'night',  // 纽约
    L10: 'day',   // 墨西哥城
    L11: 'night'  // 台北夜市
  },

  nightThemes: ['cave', 'taipei_night', 'newyork', 'tokyo'],

  volume: 0.6
};
},
"./unlock_config": function (require, module, exports) {
'use strict';

module.exports = {
  unlockScores: {
    4: 5000,
    5: 8000,
    6: 12000,
    7: 17000,
    8: 23000,
    9: 30000,
    10: 38000
  },

  // 传送过程完全使用 Canvas + WebAudio 程序化效果，不载入影片。
  portalSprite: 'res_core/sprites/portal_distance_8_320x512.png',
  portalFrameWidth: 256,
  portalFrameHeight: 409,
  portalFrameCount: 8,

  portalWidth: 120,
  portalHeight: 190,

  portalSpawnAhead: 170,
  portalSpawnSeconds: 0.35,

  portalEntrySeconds: 0.72,
  portalTravelSeconds: 2.00,
  portalWhiteSeconds: 1.00
};
},
"./cloud_config": function (require, module, exports) {
// —— 云开发配置（排行榜 + 黄金番薯云端账户）——
// 【只需填一处】把下面 env 换成你的云开发环境 ID（形如 cloud1-xxxxxxxx 或 super-tongue-xxxxxxxx）。
// 填好后 enabled 会自动开启，无需手动改 enabled。
// 环境 ID 获取：微信开发者工具 → 顶部「云开发」→ 环境名称旁的 ID。
// 填完后还需：右键 cloudfunctions/account 与 cloudfunctions/leaderboard → 上传并部署（云端安装依赖）。
var CLOUD_ENV = 'cloud1-d6gu6meu3ce6fd439';   // 云开发环境 ID
module.exports = {
  enabled: CLOUD_ENV.trim() !== '',  // 填了环境 ID 即自动开启
  env: CLOUD_ENV
};
},
"./monetization_config": function (require, module, exports) {
module.exports = {
  // —— 激励视频广告位（主变现位，用于复活 / 额外次数 / 黄金技能）——
  // 真实接通步骤：① 把 rewardedVideoAdUnitId 填为流量主后台审核通过的真实广告位 ID；
  //              ② devGrantRewardedAd 必须置为 false（否则线上会跳过真实广告直接发奖励）。
  // 二者都就位前：rewardedVideoAdUnitId 留空 → UI 显示“广告位申请中”，不发放任何奖励（安全预留态）。
  rewardedVideoAdUnitId: '',
  devGrantRewardedAd: false,
  // —— 插屏广告位（补充变现位，在死亡结算页等自然断点自动弹出，与奖励无关）——
  // 同样需在流量主后台新建“插屏广告”位并填入 ID；devGrantInterstitialAd 置 false 走真实 SDK。
  // 平台对插屏有频次上限，代码已内置 90 秒节流 + 错误兜底，不会打断核心玩法。
  interstitialAdUnitId: '',
  devGrantInterstitialAd: false,
  dailyFreePlays: 1,
  // 每天仅 1 命：取消原本的「每局 3 命」。命用完后只能看广告复活或等 20 分钟冷却。
  livesPerPlay: 1,
  recoveryMinutes: 20,
  // 分享复活每日上限（每次分享消耗 1 次额度，不可选文件传输助手）。
  dailyShareRevives: 3,
  // —— 黄金番薯奖励数值（可调）——
  dailyLoginReward: 1,  // 每日登录基础奖励（个）
  streak7Bonus: 5       // 连续登录满 7 天额外奖励（个）
  // 广告可无限重复使用获取游戏次数/复活（无每日上限、无本局限制）。
};
},
"./character_ui": function (require, module, exports) {
'use strict';

module.exports = {
  name: '阿蜥AXI',
  portrait: {
    image: 'res_ui/ui/axi_avatar_pixel.jpg',
    focusX: 0.50,
    focusY: 0.50,
    zoom: 1.08,
    pixelated: true
  }
};
},
"./open_data_leaderboard": function (require, module, exports) {
'use strict';

var context = null;
var canvasReady = false;
var OPEN_DATA_W = 690;
var OPEN_DATA_H = 1100;
var bestKey = 'super_tongue_axi_open_data_best';
var uidKey = 'super_tongue_axi_leaderboard_uid';
var uid = '';
var testMode = false;
var testRows = [];

function ensureUid() {
  try { uid = String(wx.getStorageSync(uidKey) || ''); } catch (e) {}
  if (!uid) {
    uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    try { wx.setStorageSync(uidKey, uid); } catch (e2) {}
  }
  return uid;
}
function detectDevtools() {
  try {
    var info = wx.getDeviceInfo ? wx.getDeviceInfo() : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : {});
    return String((info && info.platform) || '').toLowerCase() === 'devtools';
  } catch (e) { return false; }
}
function makeTestRows() {
  var names = ['阿蜥本尊','珍珠猎人','水都飞侠','沙漠旅人','舌尖高手','弹簧骑士','天空漫游者','夜市冠军'];
  var rows = [];
  for (var i = 0; i < 50; i++) {
    rows.push({
      nickname: names[i % names.length] + (i > 7 ? String(i + 1) : ''),
      avatarUrl: '',
      score: Math.max(10, 9800 - i * 173),
      city: i % 3 === 0 ? '台北市' : (i % 3 === 1 ? '新北市' : '台中市'),
      uid: i === 11 ? ensureUid() : 'test_' + i,
      source: 'test'
    });
  }
  return rows;
}
function normalizeBridgeRows(rows) {
  rows = Array.isArray(rows) ? rows : [];
  return rows.slice(0, 50).map(function(row, index) {
    row = row || {};
    var current = !!row.isCurrent;
    return {
      nickname: String(row.nickname || row.nickName || ('本地玩家' + (index + 1))).slice(0, 12),
      avatarUrl: String(row.avatarUrl || '').slice(0, 1024),
      score: Math.max(0, Math.floor(Number(row.score) || 0)),
      city: String(row.city || '').slice(0, 24),
      uid: current ? ensureUid() : String(row.uid || row.playerId || ('local_' + index)),
      isCurrent: current,
      source: 'local'
    };
  });
}
function ensureCanvasSize(notifyOpenData) {
  if (!context || !context.canvas) return false;
  var changed = false;
  if (context.canvas.width !== OPEN_DATA_W) { context.canvas.width = OPEN_DATA_W; changed = true; }
  if (context.canvas.height !== OPEN_DATA_H) { context.canvas.height = OPEN_DATA_H; changed = true; }
  canvasReady = true;
  if (notifyOpenData || changed) {
    post({ type: 'resize', canvasWidth: OPEN_DATA_W, canvasHeight: OPEN_DATA_H });
  }
  return true;
}
function init() {
  ensureUid();
  testMode = detectDevtools();
  testRows = makeTestRows();
  try {
    if (wx.getOpenDataContext) {
      context = wx.getOpenDataContext();
      console.log('[排行榜] wx.getOpenDataContext 返回：', context ? '有 context' : 'null');
      if (context && context.canvas) {
        console.log('[排行榜] openDataContext canvas 尺寸：', context.canvas.width, 'x', context.canvas.height);
      } else if (context) {
        console.warn('[排行榜] openDataContext 有 context 但缺少 canvas，尝试兼容获取...');
        try {
          if (typeof sharedCanvas !== 'undefined') context.canvas = sharedCanvas;
          else if (wx.getSharedCanvas) context.canvas = wx.getSharedCanvas();
        } catch (canvasFixErr) {
          console.warn('[排行榜] 兼容获取 canvas 失败：', canvasFixErr && canvasFixErr.message);
        }
      } else {
        console.warn('[排行榜] openDataContext 返回 null，当前环境不支持关系链排行榜');
      }
      ensureCanvasSize(true);
    } else {
      console.warn('[排行榜] 当前环境不存在 wx.getOpenDataContext，无法使用微信关系链排行榜');
      context = null; canvasReady = false;
    }
  } catch (e2) {
    console.error('[排行榜] wx.getOpenDataContext 初始化失败：', e2 && (e2.message || e2.errMsg || String(e2)));
    context = null; canvasReady = false;
  }
  return module.exports;
}
function submitHighestScore(score) {
  score = Math.max(0, Math.floor(Number(score) || 0));
  var old = 0;
  try { old = Math.max(0, Number(wx.getStorageSync(bestKey)) || 0); } catch (e) {}
  if (score > old) {
    try { wx.setStorageSync(bestKey, score); } catch (e2) {}
  }
  if (!wx.setUserCloudStorage) {
    console.log('[排行榜] 当前环境无 setUserCloudStorage（预览/开发者工具），仅使用本地测试成绩，分数=' + Math.max(score, old));
    post({ type: 'testScore', score: Math.max(score, old), uid: ensureUid() });
    return false;
  }
  if (score <= old) {
    console.log('[排行榜] 本次分数 ' + score + ' 未超过历史最高 ' + old + '，不更新微信云端成绩');
    post({ type: 'testScore', score: old, uid: ensureUid() });
    return false;
  }
  console.log('[排行榜] 检测到新最高分 ' + score + '（原 ' + old + '），准备提交微信关系链');
  wx.setUserCloudStorage({
    KVDataList: [
      { key: 'score', value: String(score) },
      { key: 'uid', value: ensureUid() }
    ],
    success: function() {
      console.log('[排行榜] 成绩已提交至微信关系链成功，分数=' + score);
      post({ type: 'refresh' });
    },
    fail: function(err) {
      console.log('[排行榜] 成绩提交失败：' + (err && err.errMsg ? err.errMsg : JSON.stringify(err)) + '，分数=' + score);
      post({ type: 'testScore', score: score, uid: ensureUid() });
    }
  });
  return true;
}
// 手动设置城市已移除：城市由微信根据关系链数据自动提供，玩家无需手动设置；无城市则不计入同城榜。
function setTestMode(enabled, rows) {
  testMode = !!enabled;
  if (Array.isArray(rows) && rows.length) testRows = rows.slice(0, 50);
  else if (!testRows.length) testRows = makeTestRows();
  post({ type: 'testData', enabled: testMode, rows: testRows, uid: ensureUid() });
}
function post(message) {
  if (!context || !context.postMessage) return;
  try { context.postMessage(message || {}); } catch (e) {}
}
function isAvailable() { return !!(context && context.canvas); }
function getCanvas() {
  if (!ensureCanvasSize(false)) return null;
  return context.canvas;
}
function show(tab, localRows, self) {
  ensureCanvasSize(true);
  post({
    type: 'show',
    tab: tab || 'friend',
    uid: ensureUid(),
    testMode: testMode,
    testRows: testRows,
    localRows: normalizeBridgeRows(localRows),
    self: (self && self.nickname) ? {
      nickname: String(self.nickname || '微信玩家').slice(0, 20),
      avatarUrl: String(self.avatarUrl || '').slice(0, 1024),
      score: Math.max(0, Math.floor(Number(self.score) || 0)),
      city: String(self.city || '').slice(0, 24)
    } : null,
    canvasWidth: OPEN_DATA_W,
    canvasHeight: OPEN_DATA_H
  });
}
function hide() { post({ type: 'hide' }); }
function touch(phase, x, y) { post({ type: 'touch', phase: phase, x: Number(x) || 0, y: Number(y) || 0 }); }

module.exports = {
  init: init,
  submitHighestScore: submitHighestScore,
  setTestMode: setTestMode,
  post: post,
  isAvailable: isAvailable,
  getCanvas: getCanvas,
  show: show,
  hide: hide,
  touch: touch
};
},
"./game": function (require, module, exports) {
'use strict';

var canvas = wx.createCanvas();
// [v28 性能] alpha:false —— 这里先于 core_runtime 拿到主画布上下文，getContext 属性由首调决定。
//   游戏每帧都被不透明背景完全铺满（正式关 JPG / 主题渐变），画布永远不需要透明通道；
//   关掉 alpha 免除合成阶段整屏透明混合，弱 GPU 现场（4K 大屏）可显著降合成开销，像素输出不变。
//   注意：此文件三端共用，微信小游戏端的 wx 主画布同样先铺满不透明背景，行为一致。
var ctx = canvas.getContext('2d', { alpha: false });
var sysInfo = wx.getSystemInfoSync();

// —— 微信社交分享：右上角菜单同时开放“发送给朋友”和“分享到朋友圈”。——
// 只补充平台分享入口，不改动既有“分享复活”流程；主动复活分享仍由 core_runtime 独立处理。
// 2026-09-30 三侠版：分享文案与封面同步更新为三侠版海报。
var SOCIAL_SHARE_TITLE = '超级舌阿蜥 · 三侠版：甩出长舌，挑战世界美食关卡！';
// 聊天转发用 5:4 横图；朋友圈缩略图按方形展示，必须用 1:1 方图，
// 否则 LOGO 两侧的「超级」「阿蜥」会被左右居中裁掉。
var SOCIAL_SHARE_IMAGE_FRIEND = 'assets/share_cover_5x4.jpg';
var SOCIAL_SHARE_IMAGE_TIMELINE = 'assets/share_cover_1x1.jpg';
var SOCIAL_SHARE_IMAGE = SOCIAL_SHARE_IMAGE_FRIEND; // 兼容既有引用
function buildSocialSharePayload(source, imageUrl) {
  return {
    title: SOCIAL_SHARE_TITLE,
    imageUrl: imageUrl || SOCIAL_SHARE_IMAGE_FRIEND,
    query: 'from=' + String(source || 'share_menu') + '&ts=' + String(Date.now())
  };
}
function enableWechatSocialShareMenu() {
  if (typeof wx === 'undefined') return;
  try {
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
  } catch (ignoreShowShareMenuError) {}
}
try {
  enableWechatSocialShareMenu();
  // 从聊天/朋友圈/后台返回小游戏时再次刷新分享菜单，避免部分客户端菜单状态失效。
  if (typeof wx.onShow === 'function') {
    wx.onShow(function () { enableWechatSocialShareMenu(); });
  }
  if (typeof wx.onShareAppMessage === 'function') {
    wx.onShareAppMessage(function () {
      return buildSocialSharePayload('friend_share', SOCIAL_SHARE_IMAGE_FRIEND);
    });
  }
  // 部分基础库/终端才提供朋友圈监听，因此必须做能力检测；无此 API 时仍保留系统分享菜单兼容。
  if (typeof wx.onShareTimeline === 'function') {
    wx.onShareTimeline(function () {
      return buildSocialSharePayload('timeline_share', SOCIAL_SHARE_IMAGE_TIMELINE);
    });
  }
} catch (ignoreShareInitError) {}

// 云测试显示性能瓶颈集中在中高档 Android 设备：vivo X100/X200、nova 7 SE、Mate 30、P40 Pro、
// 24129RT7CC 等机型 CPU 均值 10%~21%、部分 FPS 低至 41~44。
// 根因：原分级只看 benchmarkLevel/内存，导致高分辨率(≥2K)机型被误判为 high 档，以 dpr=1.5 满特效
// 运行，canvas2d 的像素填充率成为瓶颈。现加入【屏幕分辨率/像素填充率】维度，并把安卓中端阈值放宽：
// 高分屏或中端机一律降到 balanced（dpr 1.25 / 粒子 76），低内存机降到 low（dpr 1.0 / 粒子 48）。
// 低档请求 45FPS，其余 60FPS；运行时若仍掉帧，core_runtime 会进一步动态降 dpr 兜底。
var PERFORMANCE_TIER = 'high';
var TARGET_FPS = 60;
var LOW_DEVICE = false;
function screenPixels() {
  var w = Number(sysInfo && (sysInfo.screenWidth || sysInfo.windowWidth)) || 0;
  var h = Number(sysInfo && (sysInfo.screenHeight || sysInfo.windowHeight)) || 0;
  if (w > 0 && h > 0) return w * h;
  return 0;
}
try {
  var platformName = String((sysInfo && sysInfo.platform) || '').toLowerCase();
  var benchmarkLevel = Number(sysInfo && sysInfo.benchmarkLevel);
  var memorySizeMB = Number(sysInfo && (sysInfo.memorySize || sysInfo.memorySizeMB)) || 0;
  var pixelRatio = Number(sysInfo && sysInfo.pixelRatio) || 1;
  var hasBenchmark = isFinite(benchmarkLevel) && benchmarkLevel > 0;
  // 像素总量（物理分辨率 × dpr²）是 canvas2d 填充率最直接的瓶颈指标。
  var totalPixels = screenPixels() * pixelRatio * pixelRatio;
  var highRes = totalPixels >= 2500000; // ≈1080p@1.5dpr 或 2K 屏，填充率压力大

  if (platformName === 'android') {
    if ((hasBenchmark && benchmarkLevel <= 10) || (memorySizeMB > 0 && memorySizeMB <= 3072)) {
      PERFORMANCE_TIER = 'low';
    } else if (
      (hasBenchmark && benchmarkLevel <= 25) ||
      (memorySizeMB > 0 && memorySizeMB <= 8192) ||
      highRes
    ) {
      // 放宽中端阈值(跑分≤25/内存≤8G)，并将高分屏纳入 balanced，避免 high 档填充率爆表。
      PERFORMANCE_TIER = 'balanced';
    }
  } else if (platformName === 'ios') {
    if (memorySizeMB > 0 && memorySizeMB <= 3072) PERFORMANCE_TIER = 'balanced';
    else if (highRes) PERFORMANCE_TIER = 'balanced'; // iPhone Plus/Pro Max 高分屏同样降一档
  }

  LOW_DEVICE = PERFORMANCE_TIER === 'low';
  TARGET_FPS = LOW_DEVICE ? 45 : 60;
  if (wx.setPreferredFramesPerSecond) wx.setPreferredFramesPerSecond(TARGET_FPS);
} catch(e) {
  PERFORMANCE_TIER = 'high';
  TARGET_FPS = 60;
  LOW_DEVICE = false;
  try { if (wx.setPreferredFramesPerSecond) wx.setPreferredFramesPerSecond(60); } catch (ignorePreferredFps) {}
}
// [v45 性能] 现场可调档（网页端 platform 恒为 devtools → 自动分级不生效，默认 high）：
//   ?tier=balanced（粒子 76/阴影减半）或 ?tier=low（粒子 48/极简特效）可一键降档；
//   帧率仍不够时的现场杠杆，无需改代码重发。?tier=high 恢复默认。
try {
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    var mTier = /[?&]tier=(low|balanced|high)/.exec(String(window.location.search));
    if (mTier) {
      PERFORMANCE_TIER = mTier[1];
      LOW_DEVICE = PERFORMANCE_TIER === 'low';
      TARGET_FPS = LOW_DEVICE ? 45 : 60;
      try { if (wx.setPreferredFramesPerSecond) wx.setPreferredFramesPerSecond(TARGET_FPS); } catch (ePref) {}
      try { if (typeof window !== 'undefined') window.__sxTierForced = true; } catch (eTF) {}   // [v29] URL 显式指定档位 → 关闭运行时自动降级
    }
  }
} catch (eTier) {}
var LOW_DEVICE_BG_SKIP = 0;

var spriteManifest = require('./sprite_manifest');
var auxManifest = require('./aux_manifest');
var audioManifest = require('./audio_manifest');
var bgmManifest = require('./bgm_manifest');
var unlockConfig = require('./unlock_config');
var cloudConfig = require('./cloud_config');
var monetizationConfig = require('./monetization_config');
var characterUi = require('./character_ui');
var openDataLeaderboardModule = require('./open_data_leaderboard');
var openDataLeaderboardInstance = null;
function ensureOpenDataLeaderboard() {
  if (!openDataLeaderboardInstance) {
    openDataLeaderboardInstance = openDataLeaderboardModule && openDataLeaderboardModule.init ? openDataLeaderboardModule.init() : openDataLeaderboardModule;
  }
  return openDataLeaderboardInstance || {};
}
// 开放数据域直到排行榜/提交成绩真正使用时才初始化，避免冷启动阶段创建额外 Canvas。
var openDataLeaderboard = {};
['submitHighestScore','setTestMode','post','isAvailable','getCanvas','show','hide','touch'].forEach(function(method) {
  openDataLeaderboard[method] = function() {
    var target = ensureOpenDataLeaderboard();
    return target && typeof target[method] === 'function' ? target[method].apply(target, arguments) : (method === 'isAvailable' ? false : null);
  };
});
try { if (typeof GameGlobal !== 'undefined') GameGlobal.openDataLeaderboard = openDataLeaderboard; } catch (ignoreLeaderboardTestBridge) {}
// 关卡数据唯一来源：项目根目录 level_pack.json。
// 不使用 require(JSON)：微信开发者工具会把它改写为 level_pack.json.js，
// 与本项目的自定义模块加载器冲突。改用文件系统同步读取代码包内的 JSON。
// 通过编辑器验证保存的 TOOLS/level_pack.json 可在同一 releaseId 下优先载入；发布版本变更会自动失效旧本地地图。
function loadRootLevelPack() {
  var fs = wx.getFileSystemManager && wx.getFileSystemManager();
  if (!fs || typeof fs.readFileSync !== 'function') {
    throw new Error('[level-pack] 当前环境不支持读取根目录 level_pack.json');
  }

  var candidates = ['level_pack.json', './level_pack.json'];
  var text = '';
  var loadedPath = '';
  var errors = [];

  for (var i = 0; i < candidates.length; i++) {
    try {
      text = fs.readFileSync(candidates[i], 'utf8');
      loadedPath = candidates[i];
      if (text) break;
    } catch (readError) {
      errors.push(candidates[i] + ': ' + String(readError && (readError.errMsg || readError.message) || readError));
    }
  }

  if (!text) {
    var detail = errors.length ? ('；' + errors.join('；')) : '';
    throw new Error('[level-pack] 无法读取项目根目录 level_pack.json' + detail);
  }

  // 兼容带 UTF-8 BOM 的 JSON 文件。
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  var rootPack;
  try {
    rootPack = JSON.parse(text);
  } catch (parseError) {
    throw new Error('[level-pack] 根目录 level_pack.json 解析失败：' + String(parseError && parseError.message || parseError));
  }

  if (!rootPack || !Array.isArray(rootPack.stages) || !rootPack.stages.length) {
    throw new Error('[level-pack] 根目录 level_pack.json 格式错误：stages 必须是非空数组');
  }

  // 启动时固定使用包内根目录 level_pack.json，不再自动覆盖成本地编辑器保存的旧草稿。
  // 手机编辑器「载入地图」按钮（confirmEditorLoad）仍有独立路径可加载本地草稿。
  try {
  } catch (ignoreRootMapLog) {}
  return rootPack;
}
var levelPack = null;
var levelPackLoadError = null;
function ensureRootLevelPackLoaded() {
  if (levelPack) return levelPack;
  try {
    levelPack = loadRootLevelPack();
    levelPackLoadError = null;
  } catch (error) {
    levelPackLoadError = error;
    throw error;
  }
  return levelPack;
}
var core = null;

var booted = false;
var LOADING_COMPLETE_KEY = 'super_tongue_axi_v5810_warmup_metrics';
var BOOT_REVIVE_CHECKPOINT_KEY = 'super_tongue_axi_v5823_revive_checkpoint';
var bootReviveResumeHint = false;
var bootShareReturnLaunch = false;
try {
  var bootLaunchOptions = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : {};
  var bootLaunchQuery = bootLaunchOptions && bootLaunchOptions.query ? bootLaunchOptions.query : {};
  bootShareReturnLaunch = String(bootLaunchQuery.from || '') === 'revive_share' && String(bootLaunchQuery.resume || '') === '1';
  var bootReviveCheckpoint = wx.getStorageSync(BOOT_REVIVE_CHECKPOINT_KEY);
  var bootReviveAction = bootReviveCheckpoint && String(bootReviveCheckpoint.action || '');
  bootReviveResumeHint = !!(bootReviveCheckpoint &&
    (bootReviveAction === 'share_pending' || bootReviveAction === 'ad_pending' ||
     bootReviveAction === 'claimed' || bootReviveAction === 'share_resumed'));
  // “查看分享页”会以分享卡片查询参数重新拉起小游戏；只要同步存档存在，启动层必须走恢复通道。
  if (bootShareReturnLaunch && bootReviveCheckpoint) bootReviveResumeHint = true;
} catch (ignoreBootReviveHint) {}
// 每次启动都显示暖身动画；资源加载完成时间单独记录，不把暖身播放时间计入资源加载测试。
var bootSkipLoadingPage = false;
var bootResourceLoadStartedMs = Date.now();
var bootAssetsReadyMs = 0;

var BOOT_WARMUP_CONFIG = {
  image: 'assets/sprites/axi_warmup_40f_160.png',
  frameWidth: 160,
  frameHeight:   160,
  frameCount: 40,
  columns: 8,
  rows: 5,
  fps: 16,
  duration: 2.6,
  lastFrameHold: 0.1,
  displaySize:  160
};

var bootWarmup = { image: null, ready: false, failed: false, src: BOOT_WARMUP_CONFIG.image };
var bootWarmupAttempt = 0;
var bootWarmupRetryTimer = 0;
var bootAnimationStartMs = 0;
var bootAssetsReady = false;
var bootLoadingProgress = 0;
var bootLoadingLoopStarted = false;
var bootLastDrawnFrame = -1;
var bootSkipRequested = bootReviveResumeHint;
var bootTouchHandler = null;
var BOOT_MIN_VISIBLE_SECONDS = bootReviveResumeHint ? 0.12 : BOOT_WARMUP_CONFIG.duration;
var bootCanvasWidth = 0;
var bootCanvasHeight = 0;
var bootCanvasDpr = 0;
function getMenuFadeAlpha() { return 1; }
function ensureBootCanvasSize(screenW, screenH, dpr) {
  var targetW = Math.max(1, Math.round(screenW * dpr));
  var targetH = Math.max(1, Math.round(screenH * dpr));
  if (bootCanvasWidth !== targetW || bootCanvasHeight !== targetH || bootCanvasDpr !== dpr) {
    canvas.width = targetW;
    canvas.height = targetH;
    bootCanvasWidth = targetW;
    bootCanvasHeight = targetH;
    bootCanvasDpr = dpr;
  }
  if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}


function loadBootWarmupImage() {
  if (bootSkipLoadingPage || booted) return;
  bootWarmupAttempt += 1;
  bootWarmup.ready = false;
  bootWarmup.failed = false;
  var image = wx.createImage();
  bootWarmup.image = image;
  image.onload = function () {
    if (bootWarmup.image !== image || booted) return;
    bootWarmup.ready = true;
    bootWarmup.failed = false;
    bootAnimationStartMs = Date.now();
    bootLastDrawnFrame = -1;
  };
  image.onerror = function () {
    if (bootWarmup.image !== image || booted) return;
    bootWarmup.ready = false;
    bootWarmup.failed = true;
    // 某些基础库对根目录相对路径的写法兼容性不同；仅切换同一个文件的路径形式。
    if (!bootWarmupRetryTimer && typeof setTimeout === 'function') {
      bootWarmupRetryTimer = setTimeout(function () {
        bootWarmupRetryTimer = 0;
        loadBootWarmupImage();
      }, Math.min(1000, 120 + bootWarmupAttempt * 100));
    }
  };
  // 奇数次使用标准相对路径，偶数次使用显式 ./；两者都指向包内唯一的同一张精灵图。
  image.src = bootWarmupAttempt % 2 === 1 ? BOOT_WARMUP_CONFIG.image : './' + BOOT_WARMUP_CONFIG.image;
}

function bootGame() {
  if (booted) return;
  try {
    if (!levelPack) ensureRootLevelPackLoaded();
    if (!core) {
      try { core = require('./runtime/core_runtime.js'); }
      catch (relativeRuntimeError) { core = require('runtime/core_runtime.js'); }
    }
  } catch (runtimeLoadError) {
    try { console.error('[boot] core runtime load failed:', runtimeLoadError && runtimeLoadError.message); } catch (ignoreRuntimeLog) {}
    if (typeof setTimeout === 'function') setTimeout(bootGame, 180);
    return;
  }
  booted = true;
  if (bootTouchHandler) {
    try { wx.offTouchStart(bootTouchHandler); } catch(ignoreTouchOff) {}
    bootTouchHandler = null;
  }
  if (bootWarmupRetryTimer && typeof clearTimeout === 'function') {
    clearTimeout(bootWarmupRetryTimer);
    bootWarmupRetryTimer = 0;
  }
  core.startGame({
    canvas: canvas,
    ctx: ctx,
    sysInfo: sysInfo,
    spriteManifest: spriteManifest,
    auxManifest: auxManifest,
    audioManifest: audioManifest,
    bgmManifest: bgmManifest,
    unlockConfig: unlockConfig,
    cloudConfig: cloudConfig,
    monetizationConfig: monetizationConfig,
    characterUi: characterUi,
    openDataLeaderboard: openDataLeaderboard,
    levelPack: levelPack,
    loadingBaseProgress: 1,
    loadingAnimationStartMs: 0,
    loadingAnimationHasStarted: false,
    // 启动层已经负责完整播放热身动画；核心直接进入主页，避免二次加载页等待图片/音频而卡住。
    skipLoadingPage: true,
    loadingCompleteKey: LOADING_COMPLETE_KEY,
    preloadedWarmupAsset: bootWarmup.ready ? bootWarmup : null,
    lowDevice: LOW_DEVICE,
    performanceTier: PERFORMANCE_TIER,
    targetFps: TARGET_FPS,
    getMenuFadeAlpha: getMenuFadeAlpha
  });
}

function bootRoundRect(context, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawUnifiedAssetLoading(progress) {
  var nativeDpr = Number(sysInfo.pixelRatio) || 1;
  var bootDprCap = PERFORMANCE_TIER === 'low' ? 1.0 : (PERFORMANCE_TIER === 'balanced' ? 1.25 : 1.5);
  var dpr = Math.min(nativeDpr, bootDprCap);
  var screenW = Number(sysInfo.windowWidth || sysInfo.screenWidth) || 375;
  var screenH = Number(sysInfo.windowHeight || sysInfo.screenHeight) || 667;
  var viewW = 540;
  var viewH = 960;
  ensureBootCanvasSize(screenW, screenH, dpr);

  // 上下留黑框，游戏有效画面保持在中间视口。
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, screenW, screenH);
  var scale = Math.min(screenW / viewW, screenH / viewH);
  var offX = (screenW - viewW * scale) * 0.5;
  var offY = (screenH - viewH * scale) * 0.5;
  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  var g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, '#83c9ff');
  g.addColorStop(0.58, '#bdeab0');
  g.addColorStop(1, '#f8f0c1');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.beginPath(); ctx.ellipse(94, 112, 56, 23, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(282, 82, 66, 25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(472, 136, 58, 23, 0, 0, Math.PI * 2); ctx.fill();

  var elapsed = bootAnimationStartMs ? Math.max(0, (Date.now() - bootAnimationStartMs) / 1000) : 0;
  var frameIndex = Math.min(BOOT_WARMUP_CONFIG.frameCount - 1, Math.floor(elapsed * BOOT_WARMUP_CONFIG.fps));
  var displaySize = BOOT_WARMUP_CONFIG.displaySize;
  var drawX = Math.round((viewW - displaySize) * 0.5);
  var drawY = Math.round((viewH - displaySize) * 0.5);
  if (bootWarmup.ready && bootWarmup.image) {
    var sx = (frameIndex % BOOT_WARMUP_CONFIG.columns) * BOOT_WARMUP_CONFIG.frameWidth;
    var sy = Math.floor(frameIndex / BOOT_WARMUP_CONFIG.columns) * BOOT_WARMUP_CONFIG.frameHeight;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bootWarmup.image, sx, sy, BOOT_WARMUP_CONFIG.frameWidth, BOOT_WARMUP_CONFIG.frameHeight,
      drawX, drawY, displaySize, displaySize);
    ctx.restore();
    bootLastDrawnFrame = Math.max(bootLastDrawnFrame, frameIndex);
  }

  var titleY = Math.min(viewH - 220, drawY + displaySize + 64);
  ctx.fillStyle = '#153a2b';
  ctx.font = 'bold 46px "Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bootReviveResumeHint ? '正在返回当前关卡' : (bootWarmup.ready ? '阿蜥暖身中' : '阿蜥准备中'), viewW * 0.5, titleY);

  var barX = 48;
  var barY = titleY + 54;
  var barW = viewW - barX * 2;
  var barH = 28;
  ctx.fillStyle = '#153a2b';
  bootRoundRect(ctx, barX, barY, barW, barH, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.fillRect(barX + 4, barY + 4, barW - 8, barH - 8);

  var realProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  var blockCount = 40;
  var completed = realProgress >= 1 ? blockCount : Math.floor(realProgress * blockCount);
  var gap = 1;
  var blockW = 9;
  var runW = blockCount * blockW + (blockCount - 1) * gap;
  var blockX = Math.round(barX + (barW - runW) * 0.5);
  for (var i = 0; i < blockCount; i++) {
    ctx.fillStyle = i < completed ? '#54e69a' : 'rgba(21,58,43,.12)';
    ctx.fillRect(blockX + i * (blockW + gap), barY + 7, blockW, barH - 14);
  }
  var percent = realProgress >= 1 ? 100 : Math.floor(realProgress * 100);
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 20px "Source Han Sans SC", "Noto Sans CJK SC", "Courier New", "Menlo", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#153a2b';
  ctx.fillText(bootReviveResumeHint ? 'RESTORING' : 'LOADING', barX, barY + 62);
  ctx.textAlign = 'right';
  ctx.fillText(('000' + percent).slice(-3) + '%', barX + barW, barY + 62);

  if (!bootSkipRequested && !bootReviveResumeHint) {
    var enterBtnW = 176, enterBtnH = 46, enterBtnR = 12;
    var enterBtnX = Math.round((viewW - enterBtnW) * 0.5);
    var enterBtnY = Math.round(viewH - enterBtnH - 28);
    ctx.save();
    ctx.globalAlpha = 0.90;
    ctx.fillStyle = '#153a2b';
    bootRoundRect(ctx, enterBtnX, enterBtnY, enterBtnW, enterBtnH, enterBtnR); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bootAssetsReady ? '点击任意位置跳过' : '点击可跳过动画', enterBtnX + enterBtnW * 0.5, enterBtnY + enterBtnH * 0.5);
    ctx.restore();
  }

  ctx.restore();
}

function bootLoadingLoop() {
  if (booted) return;
  var elapsed = bootAnimationStartMs ? Math.max(0, (Date.now() - bootAnimationStartMs) / 1000) : 0;
  var minimumVisibleComplete = elapsed >= BOOT_MIN_VISIBLE_SECONDS;
  var warmupUnavailable = bootWarmup.failed && (Date.now() - bootResourceLoadStartedMs) >= 1600;

  drawUnifiedAssetLoading(bootLoadingProgress);

  // 默认完整播放暖身动画；玩家点击后可跳过。资源仍未就绪时只记录跳过意图，待资源完成再进入。
  if (bootAssetsReady && (bootSkipRequested || minimumVisibleComplete || warmupUnavailable)) {
    bootGame();
    return;
  }
  requestAnimationFrame(bootLoadingLoop);
}

function ensureBootLoadingLoop() {
  if (bootLoadingLoopStarted) return;
  bootLoadingLoopStarted = true;
  bootTouchHandler = function(e) {
    if (booted || bootSkipRequested) return;
    if (!e || !e.touches || e.touches.length === 0) return;
    bootSkipRequested = true;
  };
  try { wx.onTouchStart(bootTouchHandler); } catch(ignoreTouchReg) {}
  // 同步绘制第一帧，避免等待首个 RAF 时画布保持系统默认黑色。
  drawUnifiedAssetLoading(0);
  // 根关卡 JSON 的读取与解析放到首帧提交后，在暖身动画期间完成，避免阻塞首屏。
  if (typeof setTimeout === 'function') {
    setTimeout(function() {
      if (levelPack || booted) return;
      try { ensureRootLevelPackLoaded(); } catch (levelError) {
        try { console.error('[level-pack] deferred load failed:', levelError && levelError.message); } catch (ignoreLevelLog) {}
      }
    }, 32);
  } else {
    try { ensureRootLevelPackLoaded(); } catch (ignoreDeferredLevelLoad) {}
  }
  requestAnimationFrame(bootLoadingLoop);
}

function markAssetsReady() {
  if (bootAssetsReady) return;
  bootAssetsReady = true;
  bootAssetsReadyMs = Date.now();
  bootLoadingProgress = 1;
  // 首页可显示后分层加载高画质资源，避免三个大分包与首帧争抢下载、解压和注入。
  // res_core 优先保证角色；res_scene 紧随其后；大型后续 UI 最后加载。
  if (!bootDeferredSubpackagesStarted) {
    bootDeferredSubpackagesStarted = true;
    loadOneBootSubpackage('res_core');
    if (typeof setTimeout === 'function') {
      setTimeout(function () { loadOneBootSubpackage('res_scene'); }, 90);
      setTimeout(function () { loadOneBootSubpackage('res_ui_extra'); }, 420);
    } else {
      loadOneBootSubpackage('res_scene');
      loadOneBootSubpackage('res_ui_extra');
    }
  }
  try {
    wx.setStorageSync(LOADING_COMPLETE_KEY, {
      resourceLoadMs: Math.max(0, bootAssetsReadyMs - bootResourceLoadStartedMs),
      measuredAt: bootAssetsReadyMs
    });
  } catch (ignoreStartupMetric) {}
}

var BOOT_REQUIRED_SUBPACKAGES = ['runtime', 'res_ui'];
// 首屏只等待约 0.8MB 的运行时代码与首页 UI；高画质角色、关卡、后续 UI 在首页显示后分层加载。
// 2026-09-30：新增 res_skins（皮肤美术，蛛侠/白娘子/小青的 360 与辅助图集），
// 全部挪出主包；按需解码，加载顺序排在最后，不影响首屏。
var BOOT_DEFERRED_SUBPACKAGES = ['res_core', 'res_scene', 'res_ui_extra', 'res_skins'];
var BOOT_SUBPACKAGES = BOOT_REQUIRED_SUBPACKAGES.concat(BOOT_DEFERRED_SUBPACKAGES);
var bootSubpackageProgress = Object.create(null);
var bootSubpackageDone = Object.create(null);
var bootSubpackageLoading = Object.create(null);
var bootSubpackageRetry = Object.create(null);
var bootDeferredSubpackagesStarted = false;

function ensureGlobalPackageBridge() {
  try {
    if (typeof GameGlobal === 'undefined') return null;
    GameGlobal.__superTonguePackageReady = GameGlobal.__superTonguePackageReady || Object.create(null);
    GameGlobal.__superTonguePackageReadyListeners = GameGlobal.__superTonguePackageReadyListeners || Object.create(null);
    return GameGlobal;
  } catch (e) { return null; }
}
function notifyGlobalPackageReady(name) {
  var globalState = ensureGlobalPackageBridge();
  if (!globalState) return;
  globalState.__superTonguePackageReady[name] = true;
  var byName = globalState.__superTonguePackageReadyListeners;
  var listeners = byName && byName[name] ? byName[name].slice() : [];
  if (byName) byName[name] = [];
  for (var i = 0; i < listeners.length; i++) {
    try { listeners[i](); } catch (listenerError) {}
  }
  // Legacy scene bridge retained for compatibility with the existing runtime.
  if (name === 'res_scene') {
    globalState.__superTongueSceneReady = true;
    globalState.__superTongueSceneLoadError = '';
    var legacy = globalState.__superTongueSceneReadyListeners || [];
    for (var li = 0; li < legacy.length; li++) try { legacy[li](); } catch (legacyError) {}
    globalState.__superTongueSceneReadyListeners = [];
  }
}

function refreshSubpackageProgress() {
  var total = 0;
  for (var i = 0; i < BOOT_REQUIRED_SUBPACKAGES.length; i++) {
    var name = BOOT_REQUIRED_SUBPACKAGES[i];
    total += bootSubpackageDone[name] ? 1 : Math.max(0, Math.min(0.99, Number(bootSubpackageProgress[name]) || 0));
  }
  bootLoadingProgress = Math.max(bootLoadingProgress, total / BOOT_REQUIRED_SUBPACKAGES.length);
}

function checkAllSubpackagesReady() {
  for (var i = 0; i < BOOT_REQUIRED_SUBPACKAGES.length; i++) {
    if (!bootSubpackageDone[BOOT_REQUIRED_SUBPACKAGES[i]]) return false;
  }
  markAssetsReady();
  return true;
}

function loadOneBootSubpackage(name) {
  if (bootSubpackageDone[name] || bootSubpackageLoading[name]) return;
  // res_scene 是进入主页后仍需继续加载的延迟分包，不能因 booted=true 而中止。
  // 其他首屏分包在核心启动后无需重复请求。
  var isDeferred = BOOT_DEFERRED_SUBPACKAGES.indexOf(name) >= 0;
  if (booted && !isDeferred) return;
  if (typeof wx === 'undefined' || typeof wx.loadSubpackage !== 'function') {
    console.error('[subpackage] wx.loadSubpackage unavailable:', name);
    return;
  }
  bootSubpackageLoading[name] = true;
  try {
    var globalState = ensureGlobalPackageBridge();
    if (globalState) {
      globalState.__superTonguePackageLoadStarted = globalState.__superTonguePackageLoadStarted || Object.create(null);
      globalState.__superTonguePackageLoadError = globalState.__superTonguePackageLoadError || Object.create(null);
      globalState.__superTonguePackageLoadStarted[name] = true;
      globalState.__superTonguePackageLoadError[name] = '';
      if (name === 'res_scene') {
        globalState.__superTongueSceneLoadStarted = true;
        globalState.__superTongueSceneLoadError = '';
      }
    }
  } catch (packageStartError) {}
  var task;
  try {
    task = wx.loadSubpackage({
      name: name,
      success: function () {
        bootSubpackageLoading[name] = false;
        bootSubpackageDone[name] = true;
        bootSubpackageProgress[name] = 1;
        bootSubpackageRetry[name] = 0;
        notifyGlobalPackageReady(name);
        if (!isDeferred) {
          refreshSubpackageProgress();
          checkAllSubpackagesReady();
        }
      },
      fail: function (error) {
        bootSubpackageLoading[name] = false;
        bootSubpackageProgress[name] = 0;
        refreshSubpackageProgress();
        var count = (bootSubpackageRetry[name] || 0) + 1;
        bootSubpackageRetry[name] = count;
        try {
          var failGlobal = ensureGlobalPackageBridge();
          var failMessage = String(error && (error.errMsg || error.message) || error || 'load failed');
          if (failGlobal) {
            failGlobal.__superTonguePackageLoadError = failGlobal.__superTonguePackageLoadError || Object.create(null);
            failGlobal.__superTonguePackageLoadError[name] = failMessage;
            if (name === 'res_scene') failGlobal.__superTongueSceneLoadError = failMessage;
          }
        } catch (packageFailError) {}
        if (typeof setTimeout === 'function') {
          setTimeout(function () { loadOneBootSubpackage(name); }, Math.min(5000, 500 + count * 400));
        }
      }
    });
  } catch (error) {
    bootSubpackageLoading[name] = false;
    try {
      var catchGlobal = ensureGlobalPackageBridge();
      var catchMessage = String(error && error.message || error);
      if (catchGlobal) {
        catchGlobal.__superTonguePackageLoadError = catchGlobal.__superTonguePackageLoadError || Object.create(null);
        catchGlobal.__superTonguePackageLoadError[name] = catchMessage;
        if (name === 'res_scene') catchGlobal.__superTongueSceneLoadError = catchMessage;
      }
    } catch (packageCatchError) {}
    if (typeof setTimeout === 'function') setTimeout(function () { loadOneBootSubpackage(name); }, 1000);
    return;
  }
  if (task && typeof task.onProgressUpdate === 'function') {
    task.onProgressUpdate(function (res) {
      bootSubpackageProgress[name] = Math.max(0, Math.min(0.99, (Number(res && res.progress) || 0) / 100));
      if (!isDeferred) refreshSubpackageProgress();
    });
  }
}

// 核心运行时可在玩家点击开始、应用回到前台等时机主动确认任意延迟分包。
try {
  var packageBridgeGlobal = ensureGlobalPackageBridge();
  if (packageBridgeGlobal) {
    packageBridgeGlobal.__superTongueEnsurePackage = function (name) {
      if (BOOT_SUBPACKAGES.indexOf(name) >= 0) loadOneBootSubpackage(name);
    };
    packageBridgeGlobal.__superTongueEnsureScenePackage = function () {
      loadOneBootSubpackage('res_scene');
    };
  }
} catch (packageEnsureBridgeError) {}

function loadAssetsAndBoot() {
  // 暖身图与三个资源分包并行加载；暖身播放时长不计入上方记录的资源加载耗时。
  loadBootWarmupImage();
  ensureBootLoadingLoop();
  for (var i = 0; i < BOOT_REQUIRED_SUBPACKAGES.length; i++) {
    bootSubpackageProgress[BOOT_REQUIRED_SUBPACKAGES[i]] = 0;
    loadOneBootSubpackage(BOOT_REQUIRED_SUBPACKAGES[i]);
  }
  for (var di = 0; di < BOOT_DEFERRED_SUBPACKAGES.length; di++) bootSubpackageProgress[BOOT_DEFERRED_SUBPACKAGES[di]] = 0;
  if (bootReviveResumeHint) {
    // 从微信分享页返回时优先准备角色与关卡资源；运行时仍负责去重和失败重试。
    loadOneBootSubpackage('res_core');
    loadOneBootSubpackage('res_scene');
  }
  // 场景包不参与普通首屏门槛；复活恢复时会提前并行加载。
}

loadAssetsAndBoot();
}
}, typeof require === 'function' ? require : null);
