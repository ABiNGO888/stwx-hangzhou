'use strict';
var render = require('./render_runtime');
var realSnake = require('./real_snake_runtime');
var portalEffect = require('./portal_effect');
var portalEffectConfig = require('./portal_effect_config');

module.exports = {
  startGame: function (config) {
    'use strict';

    var canvas = config.canvas;
    // [v28 性能] alpha:false —— 画布每帧都被不透明背景完全覆盖（正式关 JPG / 主题渐变先铺满，
    //   停画安全网也是 fillRect 纯黑），画布本身永远不需要透明通道。关掉 alpha 后浏览器合成器
    //   免除整屏透明混合，弱 GPU 现场可显著降合成开销；像素输出与之前完全一致（留边本就是纯黑）。
    var ctx = canvas.getContext('2d', { alpha: false });
    var sysInfo = config.sysInfo;
    var spriteManifestData = config.spriteManifest;
    var auxManifestData = config.auxManifest;
    var audioManifest = config.audioManifest;
    var bgmManifest = config.bgmManifest && typeof config.bgmManifest === 'object' ? config.bgmManifest : null;
    var unlockConfig = config.unlockConfig && typeof config.unlockConfig === 'object' ? config.unlockConfig : {};
    var levelPack = config.levelPack;
    var cloudConfig = config.cloudConfig && typeof config.cloudConfig === 'object' ? config.cloudConfig : { enabled: false, env: '' };
    var monetizationConfig = config.monetizationConfig && typeof config.monetizationConfig === 'object' ? config.monetizationConfig : {};
    var characterUiConfig = config.characterUi && typeof config.characterUi === 'object' ? config.characterUi : { name: '阿蜥AXI', portrait: { image: 'res_ui/ui/home_poster.jpg', focusX: 0.5, focusY: 0.46, zoom: 1 } };
    var openDataLeaderboard = config.openDataLeaderboard && typeof config.openDataLeaderboard === 'object' ? config.openDataLeaderboard : null;
    // 分包阶段由启动层提供真实进度；进入核心后继续统计图片与音频文件的实际完成数。
    var loadingBaseProgress = Math.max(0, Math.min(0.98, Number(config.loadingBaseProgress) || 0));
    var loadingAnimationStartMs = Math.max(0, Number(config.loadingAnimationStartMs) || 0);
    var loadingAnimationHasStarted = config.loadingAnimationHasStarted === true && loadingAnimationStartMs > 0;
    var skipLoadingPage = config.skipLoadingPage === true;
    var loadingCompleteKey = String(config.loadingCompleteKey || 'super_tongue_axi_v585_warmup_mainpkg_once');
    var preloadedWarmupAsset = config.preloadedWarmupAsset && config.preloadedWarmupAsset.image ? config.preloadedWarmupAsset : null;
    var performanceTier = String(config.performanceTier || (config.lowDevice === true ? 'low' : 'high'));
    if (performanceTier !== 'low' && performanceTier !== 'balanced' && performanceTier !== 'high') performanceTier = 'high';
    var lowDevice = performanceTier === 'low';
    var balancedDevice = performanceTier === 'balanced';
    var targetFps = Math.max(30, Math.min(60, Math.round(Number(config.targetFps) || (lowDevice ? 45 : 60))));
    var getMenuFadeAlpha = typeof config.getMenuFadeAlpha === 'function' ? config.getMenuFadeAlpha : function() { return 1; };
    var lowDeviceBgSkip = 0;

    var VIEW_W = 540;
    var VIEW_H = 960;
    var DT = 1 / 60;
    var GAME_SPEED = 0.9;
    var MAX_STEPS = lowDevice || balancedDevice ? 2 : 3;
    var PARTICLE_LIMIT = lowDevice ? 48 : (balancedDevice ? 76 : 112);
    var PARTICLE_EMISSION_SCALE = lowDevice ? 0.58 : (balancedDevice ? 0.82 : 1);
    var GRAVITY = 1400;
    var LEVEL_KEY = 'super_tongue_axi_v50_level';
    var LEVEL_OVERRIDES_KEY = 'super_tongue_axi_v68_level_overrides';
    var LEVEL_PACK_SIGNATURE_KEY = 'super_tongue_axi_v552_root_level_pack_signature';
    var PROGRESS_KEY = 'super_tongue_axi_v50_progress';
    var LEADERBOARD_KEY = 'super_tongue_axi_v56_leaderboard';
    var PLAYER_PROFILE_KEY = 'super_tongue_axi_v58_player_profile';
    var PLAYER_ID_KEY = 'super_tongue_axi_v58_player_id';
    var PENDING_LEADERBOARD_KEY = 'super_tongue_axi_v59_pending_leaderboard';
    var ECONOMY_KEY = 'super_tongue_axi_v62_economy';
    var GIFT_KEY = 'super_tongue_axi_v69_gifts';
    var SKIN_KEY = 'super_tongue_axi_v5860_skins';
    var REVIVE_CHECKPOINT_KEY = 'super_tongue_axi_v5823_revive_checkpoint';
    var REVIVE_CHECKPOINT_MAX_AGE_MS = 15 * 60 * 1000;
    var DAILY_FREE_PLAYS = Math.max(1, Math.round(Number(monetizationConfig.dailyFreePlays) || 3));
    var LIVES_PER_PLAY = Math.max(1, Math.round(Number(monetizationConfig.livesPerPlay) || 1));
    var DAILY_SHARE_REVIVES = Math.max(0, Math.round(Number(monetizationConfig.dailyShareRevives) || 1));
    // —— 黄金番薯奖励数值（可调）——
    // [2026-10-31 需求3] 网页端（杭州线下大屏）独立番薯规则：
    //   · 完全无视云端台账与历史本地存档（本构建连 wx.cloud 都没有，云账户等同于禁用）；
    //   · 每次登入固定 5 颗 —— 页面加载时直接重置为 5，本会话可以消耗，重新登入又是 5 颗。
    var KIOSK_LOGIN_POTATO = 5;
    var DAILY_LOGIN_REWARD = KIOSK_LOGIN_POTATO;   // 每日登录基础奖励（网页端固定 5，不累加）
    var STREAK7_BONUS = 0;                         // 网页端不做连续登录大奖（否则会超过 5 颗）
    var DAILY_AD_PLAYS = Math.max(0, Math.round(Number(monetizationConfig.dailyAdPlays) || 1));
    var BAT_VERTICAL_REBOUND_SPEED = 820;
    var BAT_VERTICAL_REBOUND_FORWARD = 160;
    // 预警提前量（= 乌鸦还有几秒进画面就触发）与红框持续时长，两者保持一致：
    // 这样红框从触发那一刻一直显示到乌鸦飞离画面，不会中途消失再重闪。
    // 2026-09-30 首次改为 3 秒（附截图要求）；同日用户再要求「提早 1 秒」→ 3.0 → 4.0，
    // 文案同步改为「进入画面前 4 秒」（三处：SKIN_DEFS / gen_skin_panel_mockup.py / mock_render_smoke.js）。
    var SPIDER_WARNING_SECONDS = 4.0;           // 红框/箭头持续显示时长
    var SPIDER_WARNING_LOOKAHEAD_SECONDS = 4.0; // 与预警时长一致：乌鸦未来 4 秒内将进画面即触发
    var SPIDER_WARNING_COOLDOWN_SECONDS = 1.25;
    var SKIN_TEST_UNLOCK_ALL = true; // 测试阶段：全部皮肤直接开放，正式版改为 false 即恢复条件判定
    // —— 雄黄酒彩蛋（2026-10-01）：白娘子/小青在杭州关吃到雄黄酒 → 变蛇飞行 ——
    var SNAKE_FORM_DURATION = 5.0;        // 变蛇持续时长（秒）
    // 2026-10-05：蛇形态改为「自动前进 + 按钮转向」（不再手指拖拽）。
    var SNAKE_FORM_FORWARD_SPEED = 360;   // 蛇头前进速度（世界 px/s）
    var SNAKE_FORM_DIR_ANGLE = 30 * Math.PI / 180;  // （保留备用）对角方向相对水平夹角（30°）
    var SNAKE_FORM_WIGGLE_AMP = 150;      // S 形摆动幅度（叠加在对角方向上的垂直正弦）
    var SNAKE_FORM_WIGGLE_FREQ = 2.6;     // S 形摆动频率
    var SNAKE_FORM_SEGMENTS = 18;         // 蛇身节数（真蛇骨骼链，画蛇用）
    var SNAKE_FORM_SEGMENT_GAP = 20;      // 相邻蛇身节间距
    var SNAKE_FORM_TURN_SPEED = 7.5;      // 变蛇期间平滑转向角速度（弧度/秒）
    var SNAKE_FORM_RADIUS = 17;           // 蛇头碰撞半径（吃食物用）
    // 2026-10-12：变蛇期间撞到弹跳道具（bumper / 弹簧）会轻弹，但弹跳系数不高。
    var SNAKE_FORM_BOUNCE_COEF = 0.6;     // 反射恢复系数（<1：撞后只轻弹、不暴冲）
    var SNAKE_FORM_BOUNCE_MIN = 150;      // 反弹后最低离场速度，避免贴着道具卡住
    // —— 白娘子「水漫金山」：每关一次落地不死，脚下升起喷泉把玩家喷回空中 ——
    var FLOOD_FOUNTAIN_LAUNCH_SPEED = 1180;  // 喷泉上抛初速度
    var FLOOD_FOUNTAIN_FORWARD_SPEED = 190;  // 喷泉横向助推，避免原地直上直下
    var FLOOD_FOUNTAIN_RISE_SECONDS = 0.85;  // 上升途中无视障碍的时长
    // —— 小青「超级贪吃」：长按锚定时自动连吃附近食物 ——
    var GREEDY_TONGUE_RADIUS = 240;       // 以锚点为中心的可连吃半径
    var GREEDY_TONGUE_INTERVAL = 0.14;    // 每吃一个之间的间隔（秒），可连按连吃
    // 2026-10-01 修订：贪吃不再是「隔空瞬吃」——舌头必须真实朝食物伸出去、舌尖碰到才算吃到。
    var GREEDY_TONGUE_EXTEND_SPEED = 900;      // 舌头伸出速度（px/s）
    var GREEDY_TONGUE_MIN_EXTEND = 0.07;       // 极近距离时的最短伸出时长
    var GREEDY_TONGUE_TIP_HIT = 26;            // 舌尖判定命中食物的距离
    var GREEDY_TONGUE_RETRACT_SECONDS = 0.12;  // 吃到/落空后的收舌时长
    // 2026-10-05：乌鸦恢复正常行为——移除「杭州关受惊掉头」与「蛇娘首鸦掉头」逻辑（见 updateCrows）。
    var SKIN_DEFS = [
      {
        id: 'classic',
        name: '阿蜥',
        title: '经典原型',
        abilityType: 'none',
        unlock: { type: 'free' },
        description: '原始阿蜥：仅依靠本能的勇者。',
        accentA: '#6ef0a7',
        accentB: '#53b76d',
        accentC: '#d8ff85'
      },
      // —— 2026-10-31 恢复蛛俠/蝠俠/薯王（从「超级舌阿蜥」小游戏工程拷回精灵表 + 立绘）——
      // 解锁条件：连续登录 3 天送蛛俠、连续 7 天送蝠俠；薯王需用 20 颗黄金番薯解锁（自动扣除）。
      {
        id: 'spider',
        name: '蛛侠',
        title: '危险预警',
        abilityType: 'crow_warning',
        unlock: { type: 'login_streak', days: 3 },
        price: 6,   // [2026-10-31] 需求8/116 商业化：皮肤定价（¥），支付接口预留，当前仍走免费解锁
        description: '乌鸦即将进入画面前 4 秒，画面会出现红框警告，并用箭头标示乌鸦即将进入的位置。',
        accentA: '#f25353',
        accentB: '#3259ff',
        accentC: '#ffffff'
      },
      {
        id: 'bat',
        name: '蝠侠',
        title: '收舌反弹',
        abilityType: 'vertical_rebound',
        unlock: { type: 'login_streak', days: 7 },
        price: 12,   // [2026-10-31] 需求8/116 商业化：皮肤定价（¥）
        description: '当舌头在垂直±25°内持续3秒时，不会失效坠落，而是快速收舌并产生强力向上弹射。',
        accentA: '#1f2430',
        accentB: '#f4d35e',
        accentC: '#8b94a8'
      },
      {
        id: 'potato',
        name: '薯王',
        title: '黄金穿透',
        abilityType: 'golden_phase',
        unlock: { type: 'golden_potato', cost: 20 },
        price: 18,   // [2026-10-31] 需求8/116 商业化：皮肤定价（¥）
        description: '使用黄金番薯飞行期间可穿过所有障碍物与乌鸦，飞行结束后恢复正常碰撞。被动能力：靠近吸引番薯。需用 20 颗黄金番薯解锁。',
        accentA: '#ffbe55',
        accentB: '#ff7d3a',
        accentC: '#79d65b'
      },
      // —— 2026-09-30 蛇娘双人组 ——
      // 精灵图取自用户的「真实 360 圆环稿」（白娘子/小青各 24 位姿），
      // 由 gen_ring_sheets.py 抠出正立正面基准位姿后精确旋转合成：
      // 360 表 24 帧 + 蜷缩 36 帧 + 胜利 5 帧 + 放屁 1 帧，帧规格与经典阿蜥一致。
      // 解锁：按用户 2026-09-30 要求「开放，可以真实使用」——无条件直接可用
      // （原来分别是 黄金番薯 60 / 连续登录 14 天，要恢复门槛就把 unlock 换回对应类型）。
      {
        id: 'bainiangzi',
        name: '白娘子',
        title: '水漫金山',
        abilityType: 'flood_fountain',
        unlock: { type: 'venue_grant' },   // [2026-10-31] 需求3「锁定所有皮肤」+ 需求7：白娘子仅杭州现场扫码解锁（大屏为展示用，实际解锁在小程序端账户）
        price: 30,   // [2026-10-31] 需求8/116 商业化：皮肤定价（¥）
        description: '每关一次「落地不死」：本该摔死的落地会被脚下升起的大喷泉接住，把她一路喷回空中，上升途中无视一切障碍。',
        accentA: '#eaf6ff',
        accentB: '#8fc9ff',
        accentC: '#ffffff',
        // 2026-10-16：专属「翻滚」稿到位（用户当日提供）→ 改走 SKIN_AUX_SPECS.curl
        // （bainiangzi_curl_36_160_grid.png）。curlBall 必须删掉——它一旦存在，
        // drawCurlFrame 会优先画代码圆球，把新表盖掉。
      },
      {
        id: 'xiaoqing',
        name: '小青',
        title: '超级贪吃',
        abilityType: 'greedy_tongue',
        unlock: { type: 'login_streak', days: 14 },   // [2026-10-31] 需求3：小青改为连续登录 14 天解锁（原免费开放）
        price: 24,   // [2026-10-31] 需求8/116 商业化：皮肤定价（¥）
        description: '舌头按住不放时，会顺着锚点自动连吃附近的食物，由近到远一个接一个，吃到即收，长按可连续开吃。',
        accentA: '#7ce0a8',
        accentB: '#2f9e63',
        accentC: '#d8ffe6',
        // 2026-10-16：同白娘子，改走专属翻滚表（xiaoqing_curl_36_160_grid.png）。
      }
    ];
    var RECOVERY_MS = Math.max(1, Number(monetizationConfig.recoveryMinutes) || 30) * 60 * 1000;
    var LEADERBOARD_LIMIT = 50;
    // [2026-10-16 需求] 网页版**只用自建的「前 500 强」榜**（index.html 的 #lbWrap ← 云函数 offline_session /
    //   集合 kiosk_leaderboard），不在网页端出现「小游戏端内置排行榜」。
    //   小游戏端内置榜就是本文件这条链：LEADERBOARD_LIMIT=50 + 本地 storage + 云函数 leaderboard；
    //   ⚠ 网页端没有 wx.cloud，cloudLeaderboardReady 恒为 false → ensureGlobalLeaderboardSeed 会退化成
    //   注入 ~1000 名「美食家xxxx」合成假玩家，现场死亡 3s 后自动弹出来（非常穿帮）。
    //   故整体停用三处：①不弹 UI（openLeaderboardAtPlayer）②不连云函数（initCloudLeaderboard）
    //   ③不提交（sendCloudLeaderboardPayload）。小游戏端 core 不受影响（那是另一份文件，
    //   super_tongue_wx/runtime/core_runtime.js，保持原样）。
    var WEB_DISABLE_BUILTIN_LEADERBOARD = true;
    // 滚动几何与渲染端总榜单一致：行距 105 设计px × sy(0.5) = 52.5 视图px；可视区高 1068 设计px × 0.5 = 534
    var LEADERBOARD_ROW_HEIGHT = 52.5;
    var LEADERBOARD_VIEW_HEIGHT = 534;
    var GAME_OVER_HOLD_SECONDS = 3.0;
    var GAME_OVER_FADE_SECONDS = 0;
    var COMBO_WINDOW_SECONDS = 4.0;
    var PRESS_OPEN_DURATION = 0.16;
    var CROW_BLINK_SECONDS = 0.56;
    var CROW_TONGUE_DISABLE_SECONDS = 0.30;
    var CROW_BASE_INTERVAL_SECONDS = 8.8;
    var CROW_MIN_INTERVAL_SECONDS = 2.2;
    var CROW_BASE_SPEED = 305;
    var HORIZONTAL_SPRING_SCALE = 1.0;
    var HORIZONTAL_SPRING_MIN_SPEED = 483;
    var HORIZONTAL_SPRING_MAX_SPEED = 1035;
    var HORIZONTAL_SPRING_PUSH = 57.5;
    var VERTICAL_SPRING_SCALE = 0.828;
    var VERTICAL_SPRING_MIN_SPEED = 414;
    var VERTICAL_SPRING_MAX_SPEED = 782;
    var STUMP_BOUNCE = 0.52;
    var HORIZONTAL_STUMP_BOUNCE = STUMP_BOUNCE * 2.0;
    // 普通横墙、竖墙统一略微增强；树桩仍使用独立参数，不受此倍率影响。
    var WALL_BOUNCE = 0.40;
    var HORIZONTAL_WALL_BOUNCE_SCALE = 1.12;
    var VERTICAL_WALL_BOUNCE_SCALE = 1.15;
    var HORIZONTAL_WALL_MIN_BOUNCE_SPEED = 270;
    var VERTICAL_WALL_MIN_BOUNCE_SPEED = 285;
    var SOLID_MIN_CONTACT_SPEED = 8;
    var STUMP_MIN_BOUNCE_SPEED = 250;
    var HORIZONTAL_STUMP_MIN_BOUNCE_SPEED = STUMP_MIN_BOUNCE_SPEED * 2.0;
    var BUMPER_POWER_SCALE = 0.9;
    var BUMPER_MAX_MULTIPLIER = 1.5;
    var BUMPER_MAX_BOUNCE_SPEED = 1100;
    var STUMP_TANGENTIAL_DAMPING = 0.90;
    var WALL_TANGENTIAL_DAMPING = 0.84;
    var EDITOR_MOUSE_AFTER_TOUCH_IGNORE_MS = 700;
    var EDITOR_MOUSE_EVENT_DEDUP_MS = 60;
    var EDITOR_ADD_DEDUP_MS = 80;
    var SOUL_ASCEND_DURATION = 1.5;
    var TONGUE_FAIL_ANGLE = 25 * Math.PI / 180; // 舌头在 ±25° 范围内（接近竖直向下）长按失效阈值
    var TONGUE_FAIL_SECONDS = 3;                 // 长按超过 3 秒舌头自动失效（失去锚点掉落，非死亡）
    var GOLDEN_SKILL_CHOICE_SECONDS = 4.5;
    var GOLDEN_SKILL_MAX_ANGLE = 45 * Math.PI / 180;
    var GOLDEN_SKILL_MIN_PULL = 28;
    var GOLDEN_SKILL_MAX_PULL = 158;
    var GOLDEN_SKILL_MIN_SPEED = 720;
    var GOLDEN_SKILL_MAX_SPEED = 1120;
    var GOLDEN_SKILL_BOOST_DURATION = 0.62;
    var GOLDEN_SKILL_INPUT_LOCK_SECONDS = 0.28;
    var LIMP_TONGUE_DURATION = 0.30;
    var TONGUE_RETRACT_DURATION = 0.065;
    var TONGUE_REBOUND_DURATION = 0.04;
    var ATTACH_SHORTEN_DELAY = 0.30;
    var EDITOR_VIEWPORT = { x: 136, y: 76, w: VIEW_W - 136, h: VIEW_H - 76 - 58 };
    var EDITOR_MAX_ZOOM = 1.65;

    var nativeDpr = sysInfo.pixelRatio || 1;
    // 540×960 的逻辑画布在手机上已经足够清晰；限制 DPR 可显著减少全屏像素填充与缩放成本。
    var dprCap = lowDevice ? 1.0 : (balancedDevice ? 1.25 : 1.5);
    var dpr = Math.min(nativeDpr, dprCap);
    var screenW = sysInfo.windowWidth || sysInfo.screenWidth || 375;
    var screenH = sysInfo.windowHeight || sysInfo.screenHeight || 667;
    // [v45 性能] 画布像素下限预算：小屏保底 320 万像素足够，避免无谓放大。
    //   ?dpr=0.8 之类可现场手动覆盖，?dpr=native 关闭上限。
    var MAX_CANVAS_PIXELS = 3200000;
    // [2026-11-01 v41 清晰度] 大屏像素上限放宽到 900 万。
    //   旧逻辑只有 320 万上限 → 4K 屏(3840×2160) dpr 被压到 0.62，画布恒为 2385×1342，
    //   中间 9:16 游戏区只有 755 物理像素却要铺满 1215 物理像素（放大 1.6 倍）→ 现场观感偏软，
    //   连 4K 背景图也吃不满（源图 2170 宽只画到 755 像素）。
    //   实测 4K 满像素(830 万/帧)在 SwiftShader 软件渲染下仍稳定 60fps（最差单帧 16.8ms），
    //   真机 GPU 更无压力，故按「屏幕像素数」给预算，最高 900 万兜住超宽屏/8K：
    //     1080p(2160×1080=207万) → 仍走 320 万下限，行为不变
    //     4K(3840×2160=829万)    → dpr=1 满像素，游戏区 1215px 1:1 清晰
    //     8K/拼接屏               → 封顶 900 万，等比降 dpr
    //   现场若机器较弱出现掉帧，可用 ?dpr=0.8 手动降档（无需改代码）。
    var MAX_CANVAS_PIXELS_HQ = 9000000;
    var dprForced = null;
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        var mDpr = /[?&]dpr=([^&]+)/.exec(String(window.location.search));
        if (mDpr) {
          var rawDpr = decodeURIComponent(mDpr[1]);
          if (rawDpr === 'native') dprForced = nativeDpr;
          else { var parsedDpr = parseFloat(rawDpr); if (isFinite(parsedDpr) && parsedDpr > 0.3 && parsedDpr <= 4) dprForced = parsedDpr; }
        }
      }
    } catch (eDpr) {}
    // 按当前屏幕尺寸与上限算最终 dpr（窗口尺寸/全屏变化后要重算 → 抽成函数）
    function computeEffectiveDpr() {
      if (dprForced != null) return Math.min(dprForced, nativeDpr);
      // [2026-11-01 v41] 大屏（桌面/电视，CSS 宽 ≥ 900）放开 dpr 上限：
      //   小屏保持原 cap（省填充、保续航）；大屏靠像素密度保清晰，4K 一律按物理满像素渲染。
      var cap = (screenW >= 900) ? nativeDpr : dprCap;
      var base = Math.min(nativeDpr, cap);
      var raw = screenW * screenH * base * base;
      // 预算按「屏幕物理像素」给（不是 CSS 面积）：CSS 宽高 × nativeDpr² = 物理像素总数。
      var physPixels = screenW * screenH * nativeDpr * nativeDpr;
      var budget = Math.max(MAX_CANVAS_PIXELS, Math.min(physPixels, MAX_CANVAS_PIXELS_HQ));
      if (raw > budget) {
        // 按面积等比降 dpr；下限 0.5（只有超宽拼接屏/8K 才会走到这里）
        return Math.max(0.5, Math.sqrt(budget / (screenW * screenH)));
      }
      return base;
    }
    // [v46 帧率自适应] 动态分辨率（DRS）—— 现场「跳帧」的主因通常是 GPU 填充率不够：
    //   4K 满像素一帧要填 830 万像素，弱核显/软件渲染（SwiftShader）撑不住 60fps，
    //   而旧逻辑只会在掉帧后把「渲染频率」降到 33fps（越降越像卡顿）。
    //   现在改为：分辨率让一步、帧率不让 —— 实测帧间隔超标就按比例缩画布像素（最低 0.5 档），
    //   连续稳定后再逐档升回满清晰度。可用 ?q=0.75 手动锁档排障，?q=1 关闭自适应。
    // [v27 清晰优先] 默认固定满档、不做自动降分辨率。
    //   v26 的 DRS 在现场会在「视频切换 / 榜单插页 / 失焦」这类瞬时掉帧时误判，
    //   降一档只要 0.8s、升一档却要连续 2.4s×3 才回一格 → 实际表现是画布停在低档再也升不回去，
    //   用户看到的就是「比 11/3 糊」。所以默认恢复 11/3 的满档基线（qualityScale 恒 1）。
    //   需要自动降档时显式加 ?q=auto，且规则收紧：只在关卡内、只在画面真在画时采样、下限 0.75。
    var qualityScale = 1;
    var qualityLocked = (dprForced != null);   // 手写了 ?dpr= / ?q=<数字> → 人工锁定
    var autoDrs = false;                       // 仅 ?q=auto 时置 true
    var lastDrsFrameMs = 0;                    // 最近一次 DRS 评估的平均帧间隔（ms）
    var drsAccumMs = 0, drsFrames = 0, drsUpStreak = 0, drsDownStreak = 0;
    var tierDownStreak = 0;                    // [v29] 特效档自动降级判定連续慢评估计数
    var lastDrawSuppressed = false;
    var lastDrawAtMs = 0;
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        var mQ = /[?&]q=([^&]+)/.exec(String(window.location.search));
        if (mQ) {
          var qRaw = decodeURIComponent(mQ[1]);
          var qVal = parseFloat(qRaw);
          if (qRaw === 'auto') { autoDrs = true; qualityLocked = false; qualityScale = 1; }
          else if (qRaw === 'off' || qVal === 1) { qualityLocked = true; qualityScale = 1; }
          else if (isFinite(qVal) && qVal >= 0.35 && qVal <= 1.01) { qualityLocked = true; qualityScale = qVal; }
        }
      }
    } catch (eQ) {}
    // 满档 dpr（不做质量缩放）→ 供 DRS 与失焦/切屏恢复时复用
    function computeBaseDpr() { return Math.max(0.4, computeEffectiveDpr() * qualityScale); }
    dpr = computeBaseDpr();
    var isDevtools = String((sysInfo && sysInfo.platform) || '').toLowerCase() === 'devtools';
    // 2026-10-11：网页大屏支持 cover 铺满 —— 等比放大到整屏、居中裁掉超出部分，
    // 上下左右边缘都与屏幕齐平（用户要求「不要有边框」）。contain = 原行为（留黑边）。
    // 小程序端不存在 window → 恒为 contain，不受影响。触摸换算沿用同一 fitScale/offX/offY。
    var kioskFitMode = 'contain';
    try { if (typeof window !== 'undefined' && window.__kioskFitMode) kioskFitMode = String(window.__kioskFitMode); } catch (e) {}
    // [v25] height = 只按【高度】适配：fitScale = screenH/VIEW_H → 上下与屏幕同高、保持竖屏比例、
    //       宽度按比例居中（左右留边），不裁切上下（大屏默认）。cover=max（旧大屏，裁上下）；contain=min。
    var fitScale = (kioskFitMode === 'cover')
      ? Math.max(screenW / VIEW_W, screenH / VIEW_H)
      : (kioskFitMode === 'height')
        ? (screenH / VIEW_H)
        : Math.min(screenW / VIEW_W, screenH / VIEW_H);
    var offX = (screenW - VIEW_W * fitScale) / 2;
    var offY = (screenH - VIEW_H * fitScale) / 2;
    canvas.width = Math.round(screenW * dpr);
    canvas.height = Math.round(screenH * dpr);
    // DRS 落档：把 qualityScale 折算后的 dpr 写进画布。尺寸真变了才重设（赋值即清屏）。
    function applyCanvasResolution() {
      try {
        dpr = computeBaseDpr();
        var _cw = Math.max(1, Math.round(screenW * dpr));
        var _ch = Math.max(1, Math.round(screenH * dpr));
        if (canvas.width !== _cw || canvas.height !== _ch) {
          canvas.width = _cw; canvas.height = _ch;
          forceCanvasReset = true;
        }
        return dpr;
      } catch (e) { return dpr; }
    }
    // 供现场排障：?perf=1 的浮层读这个
    function perfInfoView() {
      return {
        dpr: +Number(dpr).toFixed(3),
        qualityScale: +Number(qualityScale).toFixed(2),
        autoDrs: autoDrs === true,
        canvas: [canvas.width, canvas.height],
        css: [Math.round(screenW), Math.round(screenH)],
        nativeDpr: nativeDpr,
        lastFrameMs: lastDrsFrameMs ? +lastDrsFrameMs.toFixed(1) : 0,
        measuredFps: lastDrsFrameMs ? +(1000 / lastDrsFrameMs).toFixed(1) : 0,
        tier: performanceTier,
        tierForced: (typeof window !== 'undefined' && window.__sxTierForced === true) === true,
        autoTier: performanceTier !== 'high' && !(typeof window !== 'undefined' && window.__sxTierForced === true),
        scene: String(scene || ''),
        suppressed: (typeof window !== 'undefined') && window.__kioskDrawSuppressed === true
      };
    }

    function nowMs() {
      return Date.now();
    }

    var scaledClockRealStartMs = nowMs();
    var scaledClockStartSec = scaledClockRealStartMs / 1000;

    var THEMES = {
      forest: { skyTop: '#69b0ff', skyMid: '#8fd0ff', skyBot: '#dff1ff', haze: '#d9f4ff', accent: '#2f8f47' },
      cave:   { skyTop: '#080b23', skyMid: '#10194a', skyBot: '#251339', haze: '#2a4d89', accent: '#a47fff' },
      taiwan: { skyTop: '#3b4b98', skyMid: '#826fe2', skyBot: '#f49bc4', haze: '#ffd7a8', accent: '#ffda69' },
      rural:  { skyTop: '#7dc8ff', skyMid: '#b9e99b', skyBot: '#f6e9af', haze: '#ecfbd8', accent: '#5e9d39' },
      city:   { skyTop: '#566bb0', skyMid: '#8a86d9', skyBot: '#f0b2c7', haze: '#e7eaff', accent: '#ffd66e' },
      venice: { skyTop: '#0c7294', skyMid: '#168fb1', skyBot: '#8ed7df', haze: '#d7ffff', accent: '#ffd36e' },
      guangdong: { skyTop: '#e5d8b8', skyMid: '#c7d7c0', skyBot: '#a8c4b5', haze: '#f3ead4', accent: '#b88962' },
      egypt:  { skyTop: '#75bfe6', skyMid: '#f2c66f', skyBot: '#f4a95c', haze: '#fff0bd', accent: '#e8a238' },
      // 杭州·西湖：淡青绿山水的日间色调（2026-10-01 新增杭州关）
      hangzhou: { skyTop: '#8fc4e8', skyMid: '#cfe6df', skyBot: '#eaf3e2', haze: '#f2fbf3', accent: '#4f9e78' },
      hongkong: { skyTop: '#b8ccd5', skyMid: '#d8d0bd', skyBot: '#87a8b4', haze: '#f5ead7', accent: '#d6a85d' },
      dubai:    { skyTop: '#bfc8d8', skyMid: '#eadcc0', skyBot: '#d3b284', haze: '#fff0ce', accent: '#c9954c' },
      tokyo:        { skyTop: '#263a76', skyMid: '#81559d', skyBot: '#e16c93', haze: '#ffc0d6', accent: '#63ddff' },
      paris:        { skyTop: '#7286af', skyMid: '#d6a17e', skyBot: '#8e6d68', haze: '#ffe1bd', accent: '#f2c36b' },
      newyork:      { skyTop: '#0c2048', skyMid: '#243f68', skyBot: '#152d4d', haze: '#9ec7e8', accent: '#ffd15c' },
      mexico:       { skyTop: '#5d9abc', skyMid: '#e99156', skyBot: '#8f5e65', haze: '#ffe2a9', accent: '#49c39e' },
      taipei_night: { skyTop: '#121f4c', skyMid: '#49345f', skyBot: '#1e2945', haze: '#d889d8', accent: '#5de0be' },
    };
    var NORMAL_FOOD_POINTS = 25;
    var GOLDEN_SWEET_POTATO_POINTS = 50;
    var XIONG_HUANG_JIU_POINTS = 200;   // 雄黄酒：彩蛋奖励，给高分
    var FART_SKILL_PENALTY = 100;
    var CROW_COLLISION_PENALTY = 50;
    // 2026-10-09：小青吃乌鸦 —— 身体碰到乌鸦时直接吃掉（不受伤），代价是扣 50 分；
    // 乌鸦被吃掉时落下两根羽毛：飘动 2 秒 → 淡出 1 秒后消失。
    var CROW_EAT_PENALTY = 50;
    var FEATHER_FLOAT_SECONDS = 2.0;   // 飘动时长（不透明）
    var FEATHER_FADE_SECONDS = 1.0;    // 淡出时长
    var FEATHER_LIFE_SECONDS = FEATHER_FLOAT_SECONDS + FEATHER_FADE_SECONDS;
    var TUTORIAL_TASK_DEFINITIONS = [
      { id: 'auto_target', no: 1, stage: 'T1', infoOnly: true, title: '自动锁定最近锚点', shortTitle: '说明：靠近锚点会自动锁定', summary: '阿蜥靠近锚点时，会自动选择当前可连接范围内距离最近的锚点；这一项只作说明，不要求玩家执行指定动作。', lines: ['教学动图会自动循环演示两个锚点之间的锁定切换。', '锚点圆周的红色虚线表示当前锁定目标；箭头由阿蜥指向该锚点。', '无需操作验证，看完后点击“开始”会直接进入下一个教学点。'], demo: 'auto_target', sheet: 'res_ui_extra/ui/tutorial/tutorial_01_auto_target_sheet.png', frameWidth: 480, frameHeight: 270, frameCount: 12, sheetColumns: 4, fps: 9 },
      { id: 'connect_release', no: 2, stage: 'T1', title: '长按连接，高处放手', shortTitle: '连接后在高处放手飞行', summary: '长按屏幕用舌头连接支点，摆荡到高处后放手，并保持在空中 1 秒。', lines: ['长按屏幕，阿蜥会自动连接锁定的支点。', '利用摆荡上升到高处，再放开屏幕。', '放手后保持在空中 1 秒，才算完成。'], demo: 'connect_release', sheet: 'res_ui_extra/ui/tutorial/tutorial_02_connect_release_sheet.png', frameWidth: 480, frameHeight: 270, frameCount: 12, sheetColumns: 4, fps: 9 },
      { id: 'shrink', no: 3, stage: 'T2', title: '持续长按，舌头会逐渐缩短', shortTitle: '保持长按让舌头缩短', summary: '连接后持续长按，舌头会慢慢缩短，把阿蜥拉向支点。', lines: ['连接支点后不要放手。', '观察舌头逐渐缩短并把阿蜥拉近。', '动作达成后继续观察 1 秒，再显示完成。'], demo: 'shrink', sheet: 'res_ui_extra/ui/tutorial/tutorial_03_shrink_sheet.png', frameWidth: 480, frameHeight: 270, frameCount: 12, sheetColumns: 4, fps: 9 },
      { id: 'tongue_fail', no: 4, stage: 'T2', title: '舌头±25°内长按3秒会失效', shortTitle: '±25°内长按3秒，舌头失效一次', summary: '舌头锚点成功后，若持续按住且舌头朝向处于±25°（接近竖直向上）范围内，连续 3 秒后舌头会一次性失效脱离；其他时候舌头都正常工作。失效只是松开舌头，不会死亡，重新连接支点即可继续。', lines: ['连接支点后，让舌头保持接近竖直向上（±25°内）。', '持续按住不要松手，约 3 秒后舌头会一次性失效脱离。', '失效只是松开舌头，不会死亡；重新连接支点即可继续。'], demo: 'tongue_fail' },
      { id: 'life', no: 5, stage: 'T3', title: '落地死亡，番薯救援', shortTitle: '先自动落地，再操作番薯救援', summary: '进入教学后阿蜥会自动落地并失去 1 条生命；死亡后才开放黄金番薯救援操作，弹射成功并观察 1 秒后完成。', lines: [], demo: 'life_rescue' },
      { id: 'props', no: 6, stage: 'T3', title: '利用弹力垫越过危险球', shortTitle: '踩弹力垫，越障后连接任意锚点', summary: '必须使用指定弹力垫起跳，从危险球上方跨过去；越过危险球后，连接任意一个锚点即可。', lines: [], demo: 'props', sheet: 'res_ui_extra/ui/tutorial/tutorial_06_props_sheet.png', frameWidth: 480, frameHeight: 270, frameCount: 12, sheetColumns: 4, fps: 9 },
      { id: 'rescue_only', no: 7, stage: 'T3', title: '黄金番薯救援', shortTitle: '拖拽黄金番薯，弹射回空中', summary: '当阿蜥陷入危机时，可拖拽黄金番薯调整角度与力度，把阿蜥重新弹回空中。弹射成功后观察 1 秒，即完成教学。', lines: [], demo: 'life_rescue' },
      { id: 'rescue_manual', no: 8, stage: 'T3', title: '番薯救援：下拉·调角·发射', shortTitle: '下拉到底，调整角度，放开发射', summary: '当阿蜥陷入危机时，长按黄金番薯往下拉到底蓄力，左右拖动调整发射角度，松手即可放屁弹射回空中。三个步骤都做对即完成教学。', lines: [], demo: 'life_rescue' }
    ];    var TIME_SCORE_BASE = 500;
    var TIME_SCORE_FULL_SECONDS = 5;
    var TIME_SCORE_DECAY_PER_SECOND = 10;
    var POWER_SPRING_MULTIPLIER = 1.2;
    var FOOD_LIBRARY = {
      oyster_omelet:    { label: '蚵仔煎', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/oyster_omelet.png' },
      lurou_fan:        { label: '卤肉饭', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/lurou_fan.png' },
      gua_bao:          { label: '刈包', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/gua_bao.png' },
      pineapple_cake:   { label: '凤梨酥', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/pineapple_cake.png' },
      scallion_pancake: { label: '葱抓饼', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/scallion_pancake.png' },

      bubble_tea:       { label: '龙井茶', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/bubble_tea.png' },
      cake:             { label: '蛋糕', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/cake.png' },
      fruit_apple:      { label: '苹果', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/fruit_apple.png', fruit: true },
      fruit_orange:     { label: '橙子', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/fruit_orange.png', fruit: true },
      fruit_watermelon: { label: '西瓜', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/fruit_watermelon.png', fruit: true },
      fruit_grapes:     { label: '葡萄', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/fruit_grapes.png', fruit: true },

      red_braised_pork: { label: '东坡肉', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/red_braised_pork.png' },
      roast_chicken:    { label: '烤鸡', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/roast_chicken.png' },
      tofu_pudding:     { label: '豆腐脑', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/tofu_pudding.png' },

      hamburger:        { label: '汉堡', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/hamburger.png' },
      fried_chicken:    { label: '炸鸡', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/fried_chicken.png' },
      cola:             { label: '可乐', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/cola.png' },
      scallion_oil_noodles: { label: '葱油拌面', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/scallion_oil_noodles.png' },
      shengjian_bao:    { label: '生煎包', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/shengjian_bao.png' },
      old_shanghai_scallion_pancake: { label: '老上海葱油饼', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/old_shanghai_scallion_pancake.png' },

      squid_ink_risotto:{ label: '墨鱼汁烩饭', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/squid_ink_risotto.png' },
      venice_cicchetti: { label: '威尼斯小食', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/venice_cicchetti.png' },
      tiramisu:         { label: '提拉米苏', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/tiramisu.png' },

      har_gow:          { label: '虾饺', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/har_gow.png' },
      siu_mai:          { label: '烧卖', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/siu_mai.png' },
      char_siu_bao:     { label: '叉烧包', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/char_siu_bao.png' },
      rice_noodle_roll: { label: '肠粉', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/rice_noodle_roll.png' },
      wonton_noodles:   { label: '云吞面', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/wonton_noodles.png' },
      roast_goose:      { label: '烧鹅', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/roast_goose.png' },
      hk_yuanyang_milk_tea: { label: '港式鸳鸯奶茶', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/hk_yuanyang_milk_tea.png' },

      shawarma:         { label: '沙威玛', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/shawarma.png' },
      samosa:           { label: '三角炸饺', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/samosa.png' },
      kebab:            { label: '烤肉串 Kebab', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/kebab.png' },
      falafel:          { label: '炸豆丸子', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/falafel.png' },
      hummus:           { label: '鹰嘴豆泥', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/hummus.png' },

      tokyo_sushi:      { label: '寿司', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/tokyo_sushi.png' },
      tokyo_takoyaki:   { label: '章鱼烧', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/tokyo_takoyaki.png' },
      tokyo_taiyaki:    { label: '鲷鱼烧', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/tokyo_taiyaki.png' },
      paris_croissant:  { label: '牛角面包', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/paris_croissant.png' },
      paris_macaron:    { label: '马卡龙', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/paris_macaron.png' },
      paris_crepe:      { label: '法式可丽饼', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/paris_crepe.png' },
      newyork_pizza:      { label: '纽约披萨', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/newyork_pizza.png' },
      newyork_hotdog:     { label: '热狗', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/newyork_hotdog.png' },
      newyork_cheesecake: { label: '纽约芝士蛋糕', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/newyork_cheesecake.png' },
      mexico_taco:     { label: '塔可', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/mexico_taco.png' },
      mexico_churro:   { label: '吉拿棒', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/mexico_churro.png' },
      mexico_tamale:   { label: '墨西哥粽 Tamale', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/mexico_tamale.png' },
      taipei_stinky_tofu:     { label: '臭豆腐', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/taipei_stinky_tofu.png' },
      taipei_pig_blood_cake: { label: '猪血糕', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/taipei_pig_blood_cake.png' },

      golden_sweet_potato: { label: '黄金蕃薯', points: GOLDEN_SWEET_POTATO_POINTS, image: 'res_core/foods/golden_sweet_potato.png', skillItem: true },
      // 2026-10-01 杭州关彩蛋：雄黄酒（高分），只在杭州关投放 1 盅，白娘子/小青吃到即变蛇。
      xionghuangjiu: { label: '雄黄酒', points: XIONG_HUANG_JIU_POINTS, image: 'res_core/foods/xionghuangjiu.png', eggItem: true },
      // 2026-10-11 杭州专属美食四样（32×32 像素图），现场杭州三图食物全部从这里随机。
      dingsheng_gao:   { label: '定胜糕', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/dingsheng_gao.png' },
      longjing_xiaren: { label: '龙井虾仁', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/longjing_xiaren.png' },
      sushi_lvdoutang: { label: '苏式绿豆汤', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/sushi_lvdoutang.png' },
      xihu_cuyu:       { label: '西湖醋鱼', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/xihu_cuyu.png' },
      // [v81-foods] 2026-10-15 杭州新三样：葱包烩/桂花糖藕/片儿川（每关随机加入各 2 个）
      congbaohui:      { label: '葱包烩', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/congbaohui.png' },
      guihuatangou:    { label: '桂花糖藕', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/guihuatangou.png' },
      pianercuan:      { label: '片儿川', points: NORMAL_FOOD_POINTS, image: 'res_core/foods/pianercuan.png' },
    };
    var FRUIT_FOOD_KINDS = ['fruit_apple', 'fruit_orange', 'fruit_watermelon', 'fruit_grapes'];
    var STAGE_FOOD_POOLS = {
      L1: ['bubble_tea', 'cake', 'fruit', 'bubble_tea', 'red_braised_pork', 'cake', 'fruit'],
      L2: ['red_braised_pork', 'roast_chicken', 'tofu_pudding', 'bubble_tea', 'cake', 'fruit'],
      L3: ['scallion_oil_noodles', 'shengjian_bao', 'old_shanghai_scallion_pancake', 'red_braised_pork', 'bubble_tea', 'cake', 'fruit'],
      // 杭州（2026-10-11）：四样专属美食轮换（定胜糕/龙井虾仁/苏式绿豆汤/西湖醋鱼），雄黄酒走彩蛋投放。
      L4: ['dingsheng_gao','longjing_xiaren','pianercuan','xihu_cuyu','dingsheng_gao','longjing_xiaren','pianercuan','xihu_cuyu','dingsheng_gao','longjing_xiaren','pianercuan','xihu_cuyu','dingsheng_gao','longjing_xiaren','pianercuan','xihu_cuyu','bubble_tea','bubble_tea','red_braised_pork','red_braised_pork','congbaohui','congbaohui','guihuatangou','guihuatangou'],
      L5: ['char_siu_bao', 'roast_goose', 'hk_yuanyang_milk_tea'],
      L6: ['shawarma', 'samosa', 'kebab'],
      L7: ['tokyo_sushi', 'tokyo_takoyaki', 'tokyo_taiyaki'],
      L8: ['paris_croissant', 'paris_macaron', 'paris_crepe'],
      L9: ['newyork_pizza', 'newyork_hotdog', 'newyork_cheesecake'],
      L10: ['mexico_taco', 'mexico_churro', 'mexico_tamale'],
      L11: ['gua_bao', 'pineapple_cake', 'taipei_stinky_tofu', 'lurou_fan', 'taipei_pig_blood_cake']
    };
    // 2026-10-12：编辑器「新增食物」按城市主题随机抽 6 选 1，避免总是奶茶。
    var CITY_THEMED_FOODS = {
      hangzhou: ['dingsheng_gao', 'longjing_xiaren', 'pianercuan', 'xihu_cuyu', 'red_braised_pork', 'congbaohui', 'guihuatangou'],
      taipei:   ['lurou_fan', 'gua_bao', 'pineapple_cake', 'taipei_stinky_tofu', 'taipei_pig_blood_cake', 'oyster_omelet']
    };
    var CITY_THEMED_FALLBACK = ['red_braised_pork', 'tofu_pudding', 'lurou_fan', 'gua_bao', 'pineapple_cake', 'oyster_omelet'];
    function themedFoodPickForEditor(level) {
      var cityId = (level && level.cityId) || '';
      var pool = CITY_THEMED_FOODS[cityId];
      if (!pool || !pool.length) {
        var src = (level && level.name && STAGE_FOOD_POOLS[level.name]) || [];
        var seen = Object.create(null); pool = [];
        src.forEach(function (k) {
          if (k !== 'fruit' && k !== 'bubble_tea' && !seen[k]) { seen[k] = 1; pool.push(k); }
        });
        if (pool.length < 6) {
          CITY_THEMED_FALLBACK.forEach(function (k) { if (!seen[k]) { seen[k] = 1; pool.push(k); } });
        }
        pool = pool.slice(0, 6);
      }
      if (!pool.length) pool = CITY_THEMED_FALLBACK;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    var packageReadyState = Object.create(null);
    var packageImageQueues = Object.create(null);
    var packageReadyCallbacks = Object.create(null);
    function readPackageReady(name) {
      if (!name) return true;
      if (packageReadyState[name]) return true;
      try {
        if (typeof GameGlobal !== 'undefined' && GameGlobal.__superTonguePackageReady && GameGlobal.__superTonguePackageReady[name]) {
          packageReadyState[name] = true;
          return true;
        }
      } catch (e) {}
      return false;
    }
    function packageForAssetPath(src) {
      src = String(src || '').replace(/^\.\//, '');
      // 2026-09-30：皮肤美术（蛛侠/白娘子/小青共 12 张图集）全部移入 res_skins 分包，
      // 主包不再承担这部分体积；资源本身按需解码，分包未就绪时会自动排队。
      if (src.indexOf('res_skins/') === 0) return 'res_skins';
      if (src.indexOf('res_core/') === 0) return 'res_core';
      if (src.indexOf('res_scene/') === 0) return 'res_scene';
      if (src.indexOf('res_ui_extra/') === 0) return 'res_ui_extra';
      if (src.indexOf('res_ui/') === 0) return 'res_ui';
      return '';
    }
    function ensurePackage(name) {
      if (!name || readPackageReady(name)) return;
      try {
        if (typeof GameGlobal !== 'undefined' && typeof GameGlobal.__superTongueEnsurePackage === 'function') {
          GameGlobal.__superTongueEnsurePackage(name);
        }
      } catch (e) {}
    }
    function onPackageReady(name, callback) {
      if (!name || typeof callback !== 'function') return;
      if (readPackageReady(name)) { callback(); return; }
      packageReadyCallbacks[name] = packageReadyCallbacks[name] || [];
      packageReadyCallbacks[name].push(callback);
      try {
        if (typeof GameGlobal !== 'undefined') {
          GameGlobal.__superTonguePackageReadyListeners = GameGlobal.__superTonguePackageReadyListeners || Object.create(null);
          GameGlobal.__superTonguePackageReadyListeners[name] = GameGlobal.__superTonguePackageReadyListeners[name] || [];
          if (!GameGlobal.__superTongueRuntimePackageListenerInstalled) GameGlobal.__superTongueRuntimePackageListenerInstalled = Object.create(null);
          if (!GameGlobal.__superTongueRuntimePackageListenerInstalled[name]) {
            GameGlobal.__superTongueRuntimePackageListenerInstalled[name] = true;
            GameGlobal.__superTonguePackageReadyListeners[name].push(function () { markRuntimePackageReady(name); });
          }
        }
      } catch (e) {}
      ensurePackage(name);
    }
    function markRuntimePackageReady(name) {
      if (!name || packageReadyState[name]) return;
      packageReadyState[name] = true;
      flushQueuedPackageImages(name);
      var callbacks = packageReadyCallbacks[name] || [];
      packageReadyCallbacks[name] = [];
      for (var i = 0; i < callbacks.length; i++) try { callbacks[i](); } catch (e) {}
    }
    // Snapshot packages that were already loaded before the runtime module started.
    ['runtime', 'res_ui', 'res_core', 'res_scene', 'res_ui_extra', 'res_skins'].forEach(function(name) {
      if (readPackageReady(name)) packageReadyState[name] = true;
    });

    var startupImageAssets = [];
    function createImage() {
      if (typeof wx !== 'undefined' && wx.createImage) return wx.createImage();
      return new Image();
    }
    function trackStartupImage(asset) {
      if (asset && asset.src) startupImageAssets.push(asset);
      return asset;
    }
    var deferredImageAssets = [];
    function notifyImageAssetReady(asset) {
      var listeners = asset && asset.readyListeners ? asset.readyListeners.slice() : [];
      if (asset) asset.readyListeners = [];
      for (var i = 0; i < listeners.length; i++) try { listeners[i](asset); } catch (e) {}
    }
    function onImageAssetReady(asset, callback) {
      if (!asset || typeof callback !== 'function') return;
      if (asset.ready) { callback(asset); return; }
      asset.readyListeners = asset.readyListeners || [];
      asset.readyListeners.push(callback);
    }
    function queueImageForPackage(asset, packageName, trackStartup) {
      if (!asset || asset.queuedForPackage) return asset;
      asset.queuedForPackage = packageName;
      asset.trackStartup = asset.trackStartup || !!trackStartup;
      packageImageQueues[packageName] = packageImageQueues[packageName] || [];
      packageImageQueues[packageName].push(asset);
      onPackageReady(packageName, function () { flushQueuedPackageImages(packageName); });
      return asset;
    }
    function startImageAsset(asset, trackStartup) {
      if (!asset || !asset.src || asset.started) return asset;
      var packageName = packageForAssetPath(asset.src);
      if (packageName && !readPackageReady(packageName)) return queueImageForPackage(asset, packageName, trackStartup);
      asset.started = true;
      asset.queuedForPackage = '';
      asset.image = createImage();
      if (trackStartup || asset.trackStartup) trackStartupImage(asset);
      asset.image.onload = function () { asset.ready = true; asset.failed = false; notifyImageAssetReady(asset); };
      asset.image.onerror = function () { asset.ready = false; asset.failed = true; notifyImageAssetReady(asset); };
      asset.image.src = asset.src;
      return asset;
    }
    function flushQueuedPackageImages(packageName) {
      if (!packageName || !readPackageReady(packageName)) return;
      var queue = packageImageQueues[packageName] || [];
      packageImageQueues[packageName] = [];
      var cursor = 0;
      function nextBatch() {
        var end = Math.min(queue.length, cursor + 2);
        for (; cursor < end; cursor++) {
          var asset = queue[cursor];
          if (asset) { asset.queuedForPackage = ''; startImageAsset(asset, asset.trackStartup); }
        }
        if (cursor < queue.length && typeof setTimeout === 'function') setTimeout(nextBatch, 24);
        else if (cursor < queue.length) nextBatch();
      }
      nextBatch();
    }
    function makeImageAsset(src) {
      var asset = { image: null, ready: false, failed: false, started: false, queuedForPackage: '', readyListeners: [], src: src || '' };
      return src ? startImageAsset(asset, true) : asset;
    }
    function makeDeferredImageAsset(src) {
      var asset = { image: null, ready: false, failed: false, started: false, queuedForPackage: '', readyListeners: [], src: src || '' };
      if (src) deferredImageAssets.push(asset);
      return asset;
    }
    function makeOnDemandImageAsset(src) {
      return { image: null, ready: false, failed: false, started: false, queuedForPackage: '', readyListeners: [], src: src || '' };
    }
    function startDeferredImageBatch(batchSize, delayMs) {
      batchSize = Math.max(1, Math.round(Number(batchSize) || 2));
      delayMs = Math.max(0, Math.round(Number(delayMs) || 35));
      var cursor = 0;
      function nextBatch() {
        var end = Math.min(deferredImageAssets.length, cursor + batchSize);
        for (; cursor < end; cursor++) startImageAsset(deferredImageAssets[cursor], false);
        if (cursor < deferredImageAssets.length && typeof setTimeout === 'function') setTimeout(nextBatch, delayMs);
        else if (cursor < deferredImageAssets.length) nextBatch();
      }
      if (typeof setTimeout === 'function') setTimeout(nextBatch, 120);
      else nextBatch();
    }

    var sprite = makeImageAsset(spriteManifestData && spriteManifestData.image ? spriteManifestData.image : '');
    sprite.manifest = spriteManifestData || null;

    // —— 皮肤专属美术资源表（数据驱动）——
    // 每个有专属美术的皮肤登记一条：360 主体表（24 帧，朝上→顺时针）+ 三张辅助表。
    // 帧格与经典阿蜥一致（288×288 / 24 帧 / 6×4），只是图片、逻辑尺寸、嘴部锚点不同。
    // 资源统一放在 res_skins 分包下按需解码：只有用到/浏览到该皮肤时才加载，不占启动预算。
    var SKIN_SPRITE_SPECS = {
      // [hangzhou-web] 线下版只保留 classic/白娘子/小青 三个角色，
      // spider/bat/potato 的精灵表条目与美术资源已一并移除（小游戏工程不受影响）。
      bainiangzi: {
        image: 'res_skins/sprites/bainiangzi_360_24_288_grid.png',
        logical: 180,
        // 2026-09-30 改为「真实 360 圆环稿」基准（取环的底部位姿=正立正面，零重采样）。
        // 2026-10-05 修正：环稿 24 位姿是真实手绘位姿（非刚性旋转拷贝），解析旋转锚点会错位
        // （实测最大偏差 ~20 逻辑px）→ 改为逐帧实测红唇质心（288px 空间检测后 ÷1.6 折算 logical），
        // 背身帧（唇不可见）取邻帧环形插值。实测脚本：蛇娘素材/_lip_anchors_measured.json。
        // 2026-10-09 晚：白娘子换新环稿（白娘子_360_NEW.png，重出表 + 重新逐帧实测，
        // 口径同 10-05：r>=110 且 r>g*1.5 且 r>b*1.5 且 a>=40，最大域>=100px，÷1.6；
        // 帧 12 背面无唇用解析圆兜底）。实测档：蛇娘素材/_lip_anchors_measured_NEW.json，
        // 生成器 蛇娘素材/gen_ring_poses.py（bainiangzi src 已指向新环稿）。
        // 2026-10-09 下午：用户要求「所有图片大小依照原版阿蜥相同配置」——整表逐帧放大
        //   （_rescale_snake_360_to_classic.py：s=max(1, 阿蜥同帧高/本帧高)，只放大不缩小，
        //   封顶 1.35、触边钳 284；缩放绕 alpha>=32 质心）。缩放后逐帧高度与阿蜥包络一致
        //   （0 帧更矮）。锚点随同一变换解析更新（锚点=质心 + (旧锚点-质心)×s），无需重测。
        // 2026-10-14：图更新（量化 192 色 + 逐帧实测红唇，帧 12 解析兜底），同步小游戏端。
        // 2026-10-16：用户报「360 图跑出相邻残图」→ 改用干净「缩放前母版」重出，缩放改绕
        //   格中心(C,C) + 触边钳 + 剔除>=8px 漂浮碎片 + 落盘前 audit；24 帧全部在格内无残片。
        //   锚点在最终落盘文件上重新逐帧实测（f12 解析兜底）。同步小游戏端。
        mouthAnchors: [
          { x: 88.34, y: 51.46 }, { x: 109.84, y: 53.39 }, { x: 119.23, y: 63.13 }, { x: 137.11, y: 69.18 },
          { x: 141.13, y: 77.20 }, { x: 143.72, y: 84.92 }, { x: 146.71, y: 96.48 }, { x: 139.01, y: 113.76 },
          { x: 138.04, y: 121.05 }, { x: 131.48, y: 127.86 }, { x: 125.19, y: 137.54 }, { x: 109.93, y: 141.52 },
          { x: 91.14, y: 126.94 }, { x: 74.35, y: 144.75 }, { x: 60.07, y: 135.60 }, { x: 55.95, y: 126.51 },
          { x: 47.00, y: 123.30 }, { x: 41.38, y: 114.38 }, { x: 34.16, y: 95.85 }, { x: 35.48, y: 83.74 },
          { x: 41.85, y: 77.27 }, { x: 42.44, y: 70.16 }, { x: 59.99, y: 64.13 }, { x: 67.74, y: 53.78 }
        ]
      },
      xiaoqing: {
        image: 'res_skins/sprites/xiaoqing_360_24_288_grid.png',
        logical: 180,
        // 2026-10-17：换用户最新环稿（_rebuild_xq360.py：去白底+清邻格残片+统一0.979缩放防切）；锚点 24/24 帧实测红唇（去背重做，衣服破洞已由
        //   gen_ring_poses 的 fill_enclosed_holes 填回，帧内容最大 243px 不越界）。
        //   ⚠️ 锚点必须逐帧实测红唇（_measure_xq_new_lips.py，口径同白娘子）——
        //   生成器残差阈值 7 误判走解析圆兜底，实测偏差 7~20 逻辑px（舌根悬空在嘴外），
        //   24/24 帧实测有效（232~427px 红唇域），已全部换实测值。
        mouthAnchors: [
          { x: 88.97, y: 47.26 }, { x: 118.50, y: 52.62 }, { x: 127.55, y: 64.44 }, { x: 140.08, y: 70.22 },
          { x: 146.57, y: 77.40 }, { x: 146.85, y: 91.36 }, { x: 149.61, y: 99.19 }, { x: 143.43, y: 116.84 },
          { x: 141.14, y: 126.11 }, { x: 137.70, y: 132.69 }, { x: 122.31, y: 138.86 }, { x: 105.77, y: 146.86 },
          { x: 85.80, y: 157.10 }, { x: 76.04, y: 149.50 }, { x: 59.49, y: 136.92 }, { x: 44.59, y: 131.97 },
          { x: 40.63, y: 121.90 }, { x: 48.80, y: 116.88 }, { x: 34.14, y: 96.61 }, { x: 37.40, y: 89.47 },
          { x: 34.74, y: 75.90 }, { x: 33.28, y: 68.54 }, { x: 43.21, y: 61.76 }, { x: 61.50, y: 53.25 }
        ]
      },
      spider: {
        image: 'res_skins/sprites/spider_360_24_288_grid.png',
        logical: 190,
        mouthAnchors: [
          { x: 95.34, y: 59.30 }, { x: 110.55, y: 60.55 }, { x: 124.19, y: 69.78 }, { x: 128.82, y: 76.66 },
          { x: 134.21, y: 86.31 }, { x: 134.91, y: 95.99 }, { x: 137.01, y: 104.71 }, { x: 136.41, y: 112.04 },
          { x: 132.06, y: 123.45 }, { x: 122.87, y: 132.04 }, { x: 115.09, y: 135.40 }, { x: 102.26, y: 139.63 },
          { x: 95.00, y: 135.38 }, { x: 87.79, y: 139.59 }, { x: 74.35, y: 135.39 }, { x: 66.70, y: 131.90 },
          { x: 58.18, y: 123.19 }, { x: 53.83, y: 112.28 }, { x: 53.66, y: 104.35 }, { x: 55.56, y: 95.46 },
          { x: 56.51, y: 86.33 }, { x: 61.69, y: 76.81 }, { x: 66.57, y: 69.65 }, { x: 80.41, y: 60.21 }
        ]
      },
      potato: {
        image: 'res_skins/sprites/potato_360_24_288_grid.png',
        logical: 180,
        mouthAnchors: [
          { x: 90.61, y: 22.30 }, { x: 114.84, y: 27.35 }, { x: 129.29, y: 33.42 }, { x: 140.39, y: 41.95 },
          { x: 149.85, y: 50.56 }, { x: 158.12, y: 68.56 }, { x: 159.64, y: 90.05 }, { x: 156.66, y: 110.06 },
          { x: 155.27, y: 128.71 }, { x: 148.07, y: 153.72 }, { x: 134.56, y: 162.53 }, { x: 114.69, y: 168.07 },
          { x: 90.69, y: 162.31 }, { x: 66.83, y: 161.60 }, { x: 50.85, y: 159.69 }, { x: 29.34, y: 142.23 },
          { x: 21.23, y: 123.49 }, { x: 23.38, y: 110.15 }, { x: 20.31, y: 90.43 }, { x: 22.14, y: 68.25 },
          { x: 29.73, y: 50.44 }, { x: 39.34, y: 41.41 }, { x: 50.29, y: 34.12 }, { x: 69.46, y: 24.91 }
        ]
      },
      bat: {
        image: 'res_skins/sprites/bat_360_24_288_grid.png',
        logical: 180,
        mouthAnchors: [
          { x: 90.04, y: 54.12 }, { x: 111.17, y: 56.16 }, { x: 120.61, y: 62.99 }, { x: 129.03, y: 66.31 },
          { x: 133.72, y: 81.18 }, { x: 141.13, y: 86.29 }, { x: 141.08, y: 103.39 }, { x: 139.13, y: 114.35 },
          { x: 104.24, y: 126.87 }, { x: 134.34, y: 123.15 }, { x: 105.68, y: 126.01 }, { x: 91.79, y: 129.57 },
          { x: 92.94, y: 121.59 }, { x: 96.33, y: 132.37 }, { x: 78.58, y: 129.18 }, { x: 68.50, y: 120.05 },
          { x: 51.45, y: 121.53 }, { x: 54.94, y: 124.18 }, { x: 41.24, y: 98.42 }, { x: 50.83, y: 97.23 },
          { x: 43.50, y: 74.68 }, { x: 52.05, y: 69.83 }, { x: 63.59, y: 59.13 }, { x: 74.24, y: 55.11 }
        ]
      }
    };
    // 三张辅助动作表同样按皮肤登记；帧规格与经典阿蜥辅助表完全一致，只换图片。
    var SKIN_AUX_SPECS = {
      // 2026-10-31 恢复蛛俠/蝠俠/薯王 辅助表条目（从小游戏工程拷回精灵图）
      spider: {
        curl: 'res_skins/sprites/spider_curl_36_160_grid.png',
        victory: 'res_skins/sprites/spider_victory_5_128.png',
        fart: 'res_skins/sprites/spider_fart_1_128.png'
      },
      potato: {
        curl: 'res_skins/sprites/potato_curl_36_160_grid.png',
        victory: 'res_skins/sprites/potato_victory_5_128.png',
        fart: 'res_skins/sprites/potato_fart_1_128.png'
      },
      bat: {
        curl: 'res_skins/sprites/bat_curl_36_160_grid.png',
        glide: 'res_skins/sprites/bat_glide_4_320_grid.png'
      },
      // 2026-10-16：白娘子/小青 的「翻滚·放屁·过关」换成用户当日提供的专属稿
      //   （去背 + 建表：蛇娘素材/_aux_build.py）。curl 表首次登记；
      //   同时已删除 SKIN_DEFS.curlBall（否则 drawCurlFrame 仍画代码圆球）。与小游戏端一致。
      bainiangzi: {
        curl: 'res_skins/sprites/bainiangzi_curl_36_160_grid.png',
        victory: 'res_skins/sprites/bainiangzi_victory_5_128.png',
        fart: 'res_skins/sprites/bainiangzi_fart_1_128.png'
      },
      xiaoqing: {
        curl: 'res_skins/sprites/xiaoqing_curl_36_160_grid.png',
        victory: 'res_skins/sprites/xiaoqing_victory_5_128.png',
        fart: 'res_skins/sprites/xiaoqing_fart_1_128.png'
      }
    };

    // —— 皮肤面板「正面站姿立绘」（2026-09-30 用户要求）——
    // 面板里不再播 360° 旋转/翻滚预览，改为每个皮肤一张「正面站姿图」：
    //   classic      → 开机动图 assets/sprites/axi_warmup_40f_160.png（40 帧，主包内已有，直接播动画）
    //   spider/bat/potato        → 三侠版首页图（res_ui/ui/home_poster.jpg）去背
    //   bainiangzi/xiaoqing      → 人物设定稿「正面」视图去背
    // 后五张由 皮肤立绘/gen_portraits.py 生成，统一画布 260×320（内容高统一 300），
    // 所以面板里所有皮肤的外接框完全一致（不会再出现缩略图大小不一）。
    var SKIN_PORTRAIT_SPECS = {
      // 2026-10-31 恢复蛛俠/蝠俠/薯王 立绘（从小游戏工程拷回）
      spider: 'res_skins/portraits/spider_portrait.png',
      bat: 'res_skins/portraits/bat_portrait.png',
      potato: 'res_skins/portraits/potato_portrait.png',
      bainiangzi: 'res_skins/portraits/bainiangzi_portrait.png',
      xiaoqing: 'res_skins/portraits/xiaoqing_portrait.png'
    };
    var skinPortraitAssets = {};
    Object.keys(SKIN_PORTRAIT_SPECS).forEach(function (id) {
      skinPortraitAssets[id] = makeOnDemandImageAsset(SKIN_PORTRAIT_SPECS[id]);
    });
    var AUX_SPRITES = auxManifestData || {};
    var curlConfig = AUX_SPRITES.curl || { image: '', frameWidth: 128, frameHeight: 128, logicalFrameWidth: 128, logicalFrameHeight: 128, frameCount: 8 };
    var victoryConfig = AUX_SPRITES.victory || { image: '', frameWidth: 180, frameHeight: 180, logicalFrameWidth: 180, logicalFrameHeight: 180, frameCount: 5 };
    var soulConfig = AUX_SPRITES.soul || { image: 'res_core/sprites/axi_soul_4_64.png', frameWidth: 64, frameHeight: 64, logicalFrameWidth: 64, logicalFrameHeight: 64, frameCount: 4 };
    var dizzyConfig = AUX_SPRITES.dizzy || { image: 'res_core/sprites/axi_dizzy_1_128.png', frameWidth: 247, frameHeight: 128, logicalFrameWidth: 247, logicalFrameHeight: 128, frameCount: 1 };
    // 2026-10-05 修正：axi_fart_1_128.png 实际是 110×110（文件名里的 128 有误导），
    // 旧配置 logical 134×128 会把图横向拉伸 1.22 倍、纵向 1.16 倍（还带变形），
    // 抵消了绘制端 0.90 的缩小导致放屁图偏大。改为按图片真实尺寸 1:1 进入逻辑坐标。
    var fartConfig = AUX_SPRITES.fart || { image: 'res_core/sprites/axi_fart_1_128.png', frameWidth: 110, frameHeight: 110, logicalFrameWidth: 110, logicalFrameHeight: 110, frameCount: 1 };

    // —— 皮肤美术资源实例化 ——
    // 360 主体表按 SKIN_SPRITE_SPECS 逐条 clone 主 manifest 后改写，保证帧数/列行一致；
    // 辅助表沿用经典阿蜥的帧规格与逻辑尺寸，只替换图片路径。
    // 全部走 makeOnDemandImageAsset：真正用到（穿戴中 / 滚轮翻到）才 startImageAsset 解码。
    var skinSpriteManifests = {};
    var skinSpriteAssets = {};
    var skinAuxConfigs = {};
    var skinAuxSprites = {};
    (function buildSkinArtAssets() {
      Object.keys(SKIN_SPRITE_SPECS).forEach(function (id) {
        var spec = SKIN_SPRITE_SPECS[id];
        var m = clone(spriteManifestData || {});
        m.image = spec.image;
        m.frameWidth = 288;
        m.frameHeight = 288;
        // 360 表：24 个角度按“朝上→顺时针”排列；每格人物统一缩放，不混入相邻人物。
        m.logicalFrameWidth = spec.logical;
        m.logicalFrameHeight = spec.logical;
        m.frameCount = 24;
        m.columns = 6;
        m.rows = 4;
        m.mouthAnchors = spec.mouthAnchors;
        skinSpriteManifests[id] = m;
        skinSpriteAssets[id] = makeOnDemandImageAsset(m.image);
      });
      Object.keys(SKIN_AUX_SPECS).forEach(function (id) {
        var imgs = SKIN_AUX_SPECS[id];
        var cfgs = {
          curl: {
            image: imgs.curl,
            frameWidth: Number(curlConfig.frameWidth) || 160,
            frameHeight: Number(curlConfig.frameHeight) || 160,
            logicalFrameWidth: Number(curlConfig.logicalFrameWidth) || 115.2,
            logicalFrameHeight: Number(curlConfig.logicalFrameHeight) || 115.2,
            frameCount: Number(curlConfig.frameCount) || 36,
            columns: Number(curlConfig.columns) || 6,
            rows: Number(curlConfig.rows) || 6,
            directional: true,
            sourceFacing: 'right'
          },
          victory: {
            image: imgs.victory,
            frameWidth: Number(victoryConfig.frameWidth) || 228,
            frameHeight: Number(victoryConfig.frameHeight) || 128,
            logicalFrameWidth: Number(victoryConfig.logicalFrameWidth) || 228,
            logicalFrameHeight: Number(victoryConfig.logicalFrameHeight) || 128,
            frameCount: Number(victoryConfig.frameCount) || 5
          },
          fart: {
            image: imgs.fart,
            frameWidth: Number(fartConfig.frameWidth) || 134,
            frameHeight: Number(fartConfig.frameHeight) || 128,
            logicalFrameWidth: Number(fartConfig.logicalFrameWidth) || 134,
            logicalFrameHeight: Number(fartConfig.logicalFrameHeight) || 128,
            frameCount: 1
          },
          // 2026-10-05 蝠侠·滑翔：4 帧扇翅循环，单行 4 列。
          // 滑翔姿态横向舒展（源图 1328x881 ≈ 1.5:1），故用 320 方形格而非 curl 的 160。
          glide: {
            image: imgs.glide,
            frameWidth: 320,
            frameHeight: 320,
            logicalFrameWidth: 320,
            logicalFrameHeight: 320,
            frameCount: 4,
            columns: 4,
            rows: 1
          }
        };
        skinAuxConfigs[id] = cfgs;
        // ⚠️ 只有实际声明了的图才建 asset —— bat 只声明了 glide，
        // 若无条件 makeOnDemandImageAsset(undefined) 会去加载 undefined 路径。
        var auxAssets = {};
        ['curl', 'victory', 'fart', 'glide'].forEach(function (k) {
          if (imgs[k]) auxAssets[k] = makeOnDemandImageAsset(cfgs[k].image);
        });
        skinAuxSprites[id] = auxAssets;
      });
    })();
    // 只在必要时触发解码；startImageAsset 自身幂等（已 started 直接返回），可放心每帧调用。
    function ensureSkinArt(id) {
      var asset = skinSpriteAssets[id];
      if (asset) startImageAsset(asset, false);
      var portrait = skinPortraitAssets[id];
      if (portrait) startImageAsset(portrait, false);
      var aux = skinAuxSprites[id];
      if (aux) {
        // 逐 key 判断存在性：不同皮肤声明的 aux 图不同（bat 只有 glide）
        if (aux.curl) startImageAsset(aux.curl, false);
        if (aux.victory) startImageAsset(aux.victory, false);
        if (aux.fart) startImageAsset(aux.fart, false);
        if (aux.glide) startImageAsset(aux.glide, false);
      }
    }

    // 三种眼睛状态均改为常规6×6网格图集；睁眼优先，半闭/全闭继续错峰解码。
    var curlSprite = makeImageAsset(curlConfig.image);
    var curlBlinkHalfSprite = makeDeferredImageAsset(curlConfig.blinkHalfImage || '');
    var curlBlinkClosedSprite = makeDeferredImageAsset(curlConfig.blinkClosedImage || '');
    var victorySprite = makeDeferredImageAsset(victoryConfig.image);
    var soulSprite = makeDeferredImageAsset(soulConfig.image);
    var dizzySprite = makeDeferredImageAsset(dizzyConfig.image);
    var fartSprite = makeDeferredImageAsset(fartConfig.image);
    var crowSpriteConfig = {
      image: 'res_core/sprites/crow_flight_12_352.png',
      frameWidth: 352,
      frameHeight: 352,
      frameCount: 12,
      columns: 4,
      fps: 10
    };
    var crowSprite = makeDeferredImageAsset(crowSpriteConfig.image);
    // 2026-10-09：小青吃乌鸦掉落的羽毛（两张，各 3KB，随 res_core 附加批次解码）
    var featherSpriteA = makeDeferredImageAsset('res_core/sprites/feather_dark_1.png');
    var featherSpriteB = makeDeferredImageAsset('res_core/sprites/feather_dark_2.png');
    var gameplayVisualsReady = false;
    var gameplayVisualWaiters = [];
    function checkGameplayVisualsReady() {
      if (gameplayVisualsReady) return true;
      if (!readPackageReady('res_core') || !sprite.ready || !curlSprite.ready) return false;
      gameplayVisualsReady = true;
      var waiters = gameplayVisualWaiters.slice();
      gameplayVisualWaiters.length = 0;
      for (var i = 0; i < waiters.length; i++) try { waiters[i](); } catch (e) {}
      return true;
    }
    function whenGameplayVisualsReady(callback) {
      if (checkGameplayVisualsReady()) { callback(); return true; }
      gameplayVisualWaiters.push(callback);
      ensurePackage('res_core');
      startImageAsset(sprite, true);
      startImageAsset(curlSprite, true);
      return false;
    }
    onImageAssetReady(sprite, checkGameplayVisualsReady);
    onImageAssetReady(curlSprite, checkGameplayVisualsReady);
    onPackageReady('res_core', function () {
      startImageAsset(sprite, true);
      startImageAsset(curlSprite, true);
      checkGameplayVisualsReady();
      // Preserve full blink/death/crow quality, but decode them in small staggered batches.
      var extras = [curlBlinkHalfSprite, curlBlinkClosedSprite, crowSprite, featherSpriteA, featherSpriteB, dizzySprite, soulSprite, fartSprite, victorySprite];
      var cursor = 0;
      function nextExtra() {
        if (cursor >= extras.length) return;
        startImageAsset(extras[cursor++], false);
        if (cursor < extras.length && typeof setTimeout === 'function') setTimeout(nextExtra, 90);
        else if (cursor < extras.length) nextExtra();
      }
      if (typeof setTimeout === 'function') setTimeout(nextExtra, 120);
      else nextExtra();
    });
    var warmupConfig = {
      image: 'assets/sprites/axi_warmup_40f_160.png',
      frameWidth: 160,
      frameHeight:   160,
      frameCount: 40,
      columns: 8,
      rows: 5,
      fps: 8,
      duration: 5.0,
      displaySize:  160
    };
    var warmupSprite = null;
    if (preloadedWarmupAsset) {
      warmupSprite = preloadedWarmupAsset;
      warmupSprite.src = warmupConfig.image;
      trackStartupImage(warmupSprite);
    } else if (!skipLoadingPage) {
      // 仅当核心自身需要显示加载页时才创建暖身图；正常启动由启动层完整播放后直接进入主页。
      warmupSprite = makeImageAsset(warmupConfig.image);
    }
    var foodArtAssets = {};
    var dailyRewardIcon = makeImageAsset('res_ui_extra/ui/daily_reward_potato.png');
    // v36：用户要求线下大屏首页封面改用「杭州限定版」封面（hangzhou-cover.jpg，940×1672，与旧三侠版同比例，
    //      底部奖杯/皮肤/图鉴图标位置一致，热区无需重标）。三侠版 home_poster.jpg 仍保留给角色头像。
    var homePoster = makeImageAsset('hangzhou-cover.jpg');
    var tutorialPoster = makeImageAsset('res_ui/ui/tutorial_popup.jpg');
    var tutorialComicAssets = [
      makeDeferredImageAsset('res_ui_extra/ui/comic/comic_p1.jpg'),
      makeDeferredImageAsset('res_ui_extra/ui/comic/comic_p2.jpg'),
      makeDeferredImageAsset('res_ui_extra/ui/comic/comic_p3.jpg'),
      makeDeferredImageAsset('res_ui_extra/ui/comic/comic_p4.jpg')
    ];
    var tutorialAnimationAssets = {};
    TUTORIAL_TASK_DEFINITIONS.forEach(function(task) { tutorialAnimationAssets[task.id] = makeDeferredImageAsset(task.sheet); });
    var uiButtonAssets = {
      normal: makeImageAsset('res_ui/ui/UI.png'),
      pressed: makeImageAsset('res_ui/ui/UI-press.png')
    };
    var scoreTallyUiAssets = {
      laurelLeft: makeDeferredImageAsset('res_ui_extra/ui/score_tally/laurel_left.png'),
      laurelRight: makeDeferredImageAsset('res_ui_extra/ui/score_tally/laurel_right.png'),
      icons: {
        food: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_food.png'),
        flight: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_flight.png'),
        tongue: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_tongue.png'),
        height: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_height.png'),
        difficulty: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_difficulty.png'),
        time: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_time.png'),
        crow: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_crow.png'),
        fart: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_fart.png'),
        total: makeDeferredImageAsset('res_ui_extra/ui/score_tally/icon_total.png')
      }
    };
    var fingerPullDownAsset = makeDeferredImageAsset('res_ui_extra/ui/finger_pull_down.png');
    // 新版排行榜与 GAME OVER 采用美术底图；文字、头像和分数仍由 Canvas 动态绘制。
    var overlayUiAssets = {
      leaderboard: makeDeferredImageAsset('res_ui_extra/ui/ranking_panel.png'),
      gameOver: makeDeferredImageAsset('res_ui_extra/ui/gameover_panel.png'),
      deathTwoLives: makeDeferredImageAsset('res_ui_extra/ui/death_2_lives.png'),
      deathOneLife: makeDeferredImageAsset('res_ui_extra/ui/death_1_life.png')
    };

    var portalSpriteConfig = {
      image: String((unlockConfig && unlockConfig.portalSprite) || 'res_core/sprites/portal_distance_8_320x512.png'),
      frameWidth: Math.max(1, Math.round(Number(unlockConfig && unlockConfig.portalFrameWidth) || 256)),
      frameHeight: Math.max(1, Math.round(Number(unlockConfig && unlockConfig.portalFrameHeight) || 409)),
      frameCount: Math.max(1, Math.round(Number(unlockConfig && unlockConfig.portalFrameCount) || 8))
    };
    var portalSprite = makeDeferredImageAsset(portalSpriteConfig.image);

    var portraitPath = characterUiConfig && characterUiConfig.portrait && characterUiConfig.portrait.image;
    var characterPortrait = portraitPath === homePoster.src ? homePoster : makeImageAsset(portraitPath || 'res_ui/ui/home_poster.jpg');
    var stageBackgroundAssets = {
      L1: makeOnDemandImageAsset('res_scene/backgrounds/bg_forest.jpg'),
      L2: makeOnDemandImageAsset('res_scene/backgrounds/bg_rural.jpg'),
      L3: makeOnDemandImageAsset('res_scene/backgrounds/bg_city.jpg'),
      // 2026-10-01：插入杭州关（L4），其后关卡整体顺延一位，台北夜市变 L11。
      L4: makeOnDemandImageAsset('res_scene/backgrounds/bg_hangzhou.jpg'),
      L5: makeOnDemandImageAsset('res_scene/backgrounds/bg_hongkong.jpg'),
      L6: makeOnDemandImageAsset('res_scene/backgrounds/bg_dubai.jpg'),
      L7: makeOnDemandImageAsset('res_scene/backgrounds/bg_tokyo.jpg'),
      L8: makeOnDemandImageAsset('res_scene/backgrounds/bg_paris.jpg'),
      L9: makeOnDemandImageAsset('res_scene/backgrounds/bg_newyork.jpg'),
      L10: makeOnDemandImageAsset('res_scene/backgrounds/bg_mexicocity.jpg'),
      L11: makeOnDemandImageAsset('res_scene/backgrounds/bg_taipei_night.jpg')
    };
    function ensureStageBackgroundAsset(levelData) {
      var key = String(levelData && levelData.name || '');
      var asset = stageBackgroundAssets[key];
      if (asset) startImageAsset(asset, false);
      return asset || null;
    }
    Object.keys(FOOD_LIBRARY).forEach(function (key) { foodArtAssets[key] = makeOnDemandImageAsset(FOOD_LIBRARY[key].image || ''); });
    function ensureFoodAssetsForLevel(levelData) {
      var seen = Object.create(null);
      var foods = levelData && Array.isArray(levelData.foods) ? levelData.foods : [];
      for (var i = 0; i < foods.length; i++) {
        var kind = String(foods[i] && foods[i].kind || '');
        if (!kind || seen[kind]) continue;
        seen[kind] = true;
        if (foodArtAssets[kind]) startImageAsset(foodArtAssets[kind], false);
      }
      // Reward/share UI can reference the golden sweet potato even if the current level has none.
      if (foodArtAssets.golden_sweet_potato) startImageAsset(foodArtAssets.golden_sweet_potato, false);
    }

    var audioState = {
      webCtx: null,
      master: null,
      buffers: {},
      inner: {},
      innerReady: {},
      innerPending: {},
      innerFailed: {},
      innerLastUsed: {},
      unlocked: false,
      externalAudioBusy: false, // 外部（其它 App / 通话 / 视频）正在占用音频：游戏 BGM 与音效全部静音
      externalAudioBusySince: 0, // 进入静音的时间戳，供自愈看门狗使用
      lastWoohoo: -10,
      lastCollision: -10,
      lastTongue: -10,
      lastFood: -10,
      spinLoopSource: null,
      spinLoopInner: null,
      portalTransitSound: null,
      warned: {},
      preloadTotal: 0,
      preloadSettled: 0,
      preloadDone: {}
    };
    var hapticState = { lastMs: -10000, warned: false };

    function warnAudioOnce(key, message) {
      if (audioState.warned[key]) return;
      audioState.warned[key] = true;
    }

    function initAudio() {
      try {
        if (!isDevtools && typeof wx !== 'undefined' && wx.setInnerAudioOption) {
          wx.setInnerAudioOption({
            // 遵循系统静音开关（仅 iOS 生效）：玩家打开静音键时游戏完全不出声，可安心听歌
            obeyMuteSwitch: true,
            // 不主动终止其它 App / 微信内的音乐
            mixWithOther: true,
            fail: function (err) { warnAudioOnce('innerOption', '[audio] setInnerAudioOption failed: ' + ((err && err.errMsg) || 'unknown')); }
          });
        }
      } catch (e) {}

      try {
        if (typeof wx !== 'undefined' && wx.createWebAudioContext) audioState.webCtx = wx.createWebAudioContext();
        else if (typeof AudioContext !== 'undefined') audioState.webCtx = new AudioContext();
        else if (typeof webkitAudioContext !== 'undefined') audioState.webCtx = new webkitAudioContext();
      } catch (e) {
        warnAudioOnce('webInit', '[audio] WebAudio init failed; InnerAudio fallback will be used.');
      }
      if (audioState.webCtx) {
        try {
          audioState.master = audioState.webCtx.createGain();
          // [v25] 尊重音频闸门：大屏未开声音时主音量为 0（真正静音）；第 2 下开声音后恢复。
          audioState.master.gain.value = isGameAudioAllowed() ? (0.52 * sfxVolumeNow()) : 0;
          audioState.master.connect(audioState.webCtx.destination);
        } catch (e) {
          audioState.master = null;
        }
      }
    }

    function releaseOldInnerAudio(exceptName) {
      var names = Object.keys(audioState.inner).filter(function (key) { return key !== 'spin_loop' && key !== exceptName; });
      if (names.length < 7) return;
      names.sort(function (a, b) { return (audioState.innerLastUsed[a] || 0) - (audioState.innerLastUsed[b] || 0); });
      var oldName = names[0], old = audioState.inner[oldName];
      if (!old) return;
      try { old.stop(); } catch (e) {}
      try { if (old.destroy) old.destroy(); } catch (e) {}
      delete audioState.inner[oldName];
      delete audioState.innerReady[oldName];
      delete audioState.innerPending[oldName];
      delete audioState.innerFailed[oldName];
      delete audioState.innerLastUsed[oldName];
    }

    function getInnerAudio(name, loop) {
      if (typeof wx === 'undefined' || !wx.createInnerAudioContext) return null;
      if (!audioManifest || !audioManifest.sfx || !audioManifest.sfx[name]) return null;
      if (audioState.inner[name]) { audioState.innerLastUsed[name] = nowMs(); return audioState.inner[name]; }
      releaseOldInnerAudio(name);
      try {
        var inner = wx.createInnerAudioContext();
        inner.autoplay = false;
        inner.loop = !!loop;
        inner.obeyMuteSwitch = true; // 遵循系统静音开关：静音键打开时不出声
        inner.volume = 0.01;
        if (inner.onCanplay) inner.onCanplay(function () {
          audioState.innerReady[name] = true;
          audioState.innerFailed[name] = false;
          if (audioState.innerPending[name]) {
            audioState.innerPending[name] = false;
            try { inner.play(); } catch (e) {}
          }
        });
        if (inner.onError) inner.onError(function (err) {
          audioState.innerFailed[name] = true;
          audioState.innerPending[name] = false;
          warnAudioOnce('inner:' + name, '[audio] failed to load ' + name + ': ' + ((err && err.errMsg) || 'unknown'));
        });
        inner.src = audioManifest.sfx[name];
        audioState.inner[name] = inner;
        audioState.innerLastUsed[name] = nowMs();
        return inner;
      } catch (e) {
        audioState.innerFailed[name] = true;
        warnAudioOnce('innerCreate:' + name, '[audio] unable to create InnerAudioContext for ' + name);
        return null;
      }
    }

    var audioPreloadStarted = false;
    function loadAllAudioFiles() {
      if (audioPreloadStarted) return;
      if (!readPackageReady('res_core')) { onPackageReady('res_core', function () { if (typeof setTimeout === 'function') setTimeout(loadAllAudioFiles, 900); else loadAllAudioFiles(); }); return; }
      if (!audioState.webCtx || typeof wx === 'undefined' || !wx.getFileSystemManager) return;
      audioPreloadStarted = true;
      var fs;
      try { fs = wx.getFileSystemManager(); } catch (e) { return; }
      var names = Object.keys(audioManifest.sfx || {});
      audioState.preloadTotal = names.length;
      audioState.preloadSettled = 0;
      audioState.preloadDone = {};
      var cursor = 0;
      function settleAudioPreload(name) {
        if (audioState.preloadDone[name]) return;
        audioState.preloadDone[name] = true;
        audioState.preloadSettled += 1;
      }
      function loadNext() {
        if (cursor >= names.length) return;
        var name = names[cursor++];
        function continueLater() {
          if (cursor < names.length && typeof setTimeout === 'function') setTimeout(loadNext, 45);
          else if (cursor < names.length) loadNext();
        }
        try {
          fs.readFile({
            filePath: audioManifest.sfx[name],
            success: function (res) {
              settleAudioPreload(name);
              try {
                audioState.webCtx.decodeAudioData(res.data, function (buf) {
                  audioState.buffers[name] = buf;
                }, function () {
                  warnAudioOnce('decode:' + name, '[audio] WebAudio decode failed for ' + name + '; InnerAudio will be used.');
                });
              } catch (e) {}
              continueLater();
            },
            fail: function () { settleAudioPreload(name); continueLater(); }
          });
        } catch (e) { settleAudioPreload(name); continueLater(); }
      }
      if (typeof setTimeout === 'function') setTimeout(loadNext, 180);
      else loadNext();
    }

    function unlockWebAudioFromGesture() {
      var a = audioState.webCtx;
      if (!a) return;
      try {
        // 外部正在播放声音时保持挂起，不在玩家触摸时偷偷恢复音频上下文
        if (a.state === 'suspended' && a.resume && isGameAudioAllowed()) {
          var result = a.resume();
          if (result && result.catch) result.catch(function () {});
        }
        if (!audioState.unlocked && a.createBuffer && a.createBufferSource) {
          var buf = a.createBuffer(1, 1, a.sampleRate || 22050);
          var src = a.createBufferSource();
          src.buffer = buf;
          if (audioState.master) src.connect(audioState.master);
          else src.connect(a.destination);
          src.start(0);
        }
      } catch (e) {}
    }

    function ensureAudio() {
      unlockWebAudioFromGesture();
      audioState.unlocked = true;
      return audioState.webCtx;
    }

    function playInnerAudio(name, volume, rate) {
      if (!isGameAudioAllowed()) return false; // 外部正在播放声音：一律不发声
      if (typeof wx === 'undefined' || !wx.createInnerAudioContext || audioState.innerFailed[name]) return false;
      var inner = getInnerAudio(name, name === 'spin_loop');
      if (!inner) return false;
      audioState.innerLastUsed[name] = nowMs();
      try {
        inner.volume = clamp((volume === undefined ? 1 : volume) * sfxVolumeNow(), 0, 1);
        if ('playbackRate' in inner) inner.playbackRate = clamp(rate || 1, 0.5, 2);
        if (name !== 'spin_loop') {
          try { inner.stop(); } catch (e) {}
        }
        if (audioState.innerReady[name]) inner.play();
        else {
          audioState.innerPending[name] = true;
          try { inner.play(); } catch (e) {}
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    function playBuffer(name, volume, rate) {
      if (!isGameAudioAllowed()) return false; // 外部正在播放声音：一律不发声
      volume = volume === undefined ? 1 : volume;
      rate = rate || 1;
      ensureAudio();
      if (playInnerAudio(name, volume, rate)) return true;
      if (!audioState.webCtx || !audioState.master || !audioState.buffers[name]) return false;
      try {
        var src = audioState.webCtx.createBufferSource();
        src.buffer = audioState.buffers[name];
        src.playbackRate.value = rate;
        var gain = audioState.webCtx.createGain();
        gain.gain.value = clamp(volume, 0, 1);
        src.connect(gain).connect(audioState.master);
        src.start();
        return true;
      } catch(e) { return false; }
    }

    function startSpinLoop(volume, rate) {
      if (!isGameAudioAllowed()) return; // 外部正在播放声音：一律不发声
      if (audioState.spinLoopSource || audioState.spinLoopInner) return;
      ensureAudio();
      if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
        var inner = getInnerAudio('spin_loop', true);
        if (inner && !audioState.innerFailed.spin_loop) {
          try {
            inner.loop = true;
            inner.volume = clamp(volume * sfxVolumeNow(), 0, 1);
            if ('playbackRate' in inner) inner.playbackRate = clamp(rate || 1, 0.5, 2);
            inner.play();
            audioState.spinLoopInner = inner;
            return;
          } catch (e) {}
        }
      }
      if (!audioState.webCtx || !audioState.master || !audioState.buffers['spin_loop']) return;
      try {
        var src = audioState.webCtx.createBufferSource();
        src.buffer = audioState.buffers['spin_loop'];
        src.loop = true;
        src.playbackRate.value = rate;
        var gain = audioState.webCtx.createGain();
        gain.gain.value = clamp(volume, 0, 1);
        src.connect(gain).connect(audioState.master);
        src.start();
        audioState.spinLoopSource = { src: src, gain: gain };
      } catch(e) {}
    }

    function stopSpinLoop() {
      if (audioState.spinLoopInner) {
        try { audioState.spinLoopInner.stop(); } catch (e) {}
        audioState.spinLoopInner = null;
      }
      if (audioState.spinLoopSource) {
        try { audioState.spinLoopSource.src.stop(); } catch(e) {}
        audioState.spinLoopSource = null;
      }
    }

    function updateSpinLoop() {
      if (!isGameAudioAllowed()) { stopSpinLoop(); return; }
      var active = scene === 'playing' && player && player.attachIndex === null;
      var speed = active ? Math.hypot(player.vx, player.vy) : 0;
      var amount = clamp((speed - 90) / 620, 0, 1);
      if (amount > 0.02) {
        var vol = 0.12 + amount * 0.2, rate = 0.88 + amount * 0.44;
        if (!audioState.spinLoopSource && !audioState.spinLoopInner) startSpinLoop(vol, rate);
        else if (audioState.spinLoopInner) {
          try {
            audioState.spinLoopInner.volume = clamp(vol * sfxVolumeNow(), 0, 1);
            if ('playbackRate' in audioState.spinLoopInner) audioState.spinLoopInner.playbackRate = clamp(rate, 0.5, 2);
          } catch (e) {}
        } else {
          audioState.spinLoopSource.gain.gain.value = clamp(vol, 0, 1);
          audioState.spinLoopSource.src.playbackRate.value = rate;
        }
      } else stopSpinLoop();
    }

    function playTone(type, fA, fB, dur, gain, delay) {
      if (!isGameAudioAllowed()) return; // 外部正在播放声音：一律不发声
      gain = gain || 0.08; delay = delay || 0;
      var a = ensureAudio(); if (!a || !audioState.master) return;
      try {
        var t0 = a.currentTime + delay, osc = a.createOscillator(), g = a.createGain();
        osc.type = type; osc.frequency.setValueAtTime(fA, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, fB), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(audioState.master); osc.start(t0); osc.stop(t0 + dur + 0.02);
      } catch (e) {}
    }

    var bgmState = { inner: null, currentPath: '', enabled: true, volume: 0.6 };
    // 进入"外部有声"静音前保存的音频现场，外部声音结束后据此原样恢复
    var externalAudioSnapshot = null;

    var SETTINGS_KEY = 'super_tongue_axi_v60_settings';
    var AUDIO_LEVEL_MODEL_VERSION = 2;

    function musicGainFromLevel(level) {
      level = clamp(Number(level) || 0, 0, 1);
      return level <= 0.5 ? level * 0.5 : 0.25 + (level - 0.5) * 1.5;
    }
    function sfxGainFromLevel(level) {
      level = clamp(Number(level) || 0, 0, 1);
      return level <= 0.5 ? level * 1.2 : 0.6 + (level - 0.5) * 0.8;
    }
    function musicLevelFromGain(gain) {
      gain = clamp(Number(gain) || 0, 0, 1);
      return gain <= 0.25 ? gain / 0.5 : 0.5 + (gain - 0.25) / 1.5;
    }
    function sfxLevelFromGain(gain) {
      gain = clamp(Number(gain) || 0, 0, 1);
      return gain <= 0.6 ? gain / 1.2 : 0.5 + (gain - 0.6) / 0.8;
    }

    function loadSettings() {
      var def = {
        volumeModelVersion: AUDIO_LEVEL_MODEL_VERSION,
        musicLevel: 0.5,
        musicOn: true,
        musicTrackIndex: -1,
        sfxLevel: 0.5,
        sfxOn: true,
        // 外部有声（听歌/看视频/语音通话/其它 App 占用音频）时自动静音，默认开启
        autoMuteExternalAudio: true
      };
      try {
        var s = wx.getStorageSync(SETTINGS_KEY);
        if (s && typeof s === 'object') {
          if (Number(s.volumeModelVersion) === AUDIO_LEVEL_MODEL_VERSION) {
            if (typeof s.musicLevel === 'number') def.musicLevel = clamp(s.musicLevel, 0, 1);
            if (typeof s.sfxLevel === 'number') def.sfxLevel = clamp(s.sfxLevel, 0, 1);
          } else {
            if (typeof s.musicVolume === 'number') def.musicLevel = clamp(musicLevelFromGain(s.musicVolume), 0, 1);
            if (typeof s.sfxVolume === 'number') def.sfxLevel = clamp(sfxLevelFromGain(s.sfxVolume), 0, 1);
          }
          if (typeof s.musicOn === 'boolean') def.musicOn = s.musicOn;
          if (typeof s.musicTrackIndex === 'number') def.musicTrackIndex = Math.round(s.musicTrackIndex);
          if (typeof s.sfxOn === 'boolean') def.sfxOn = s.sfxOn;
          if (typeof s.autoMuteExternalAudio === 'boolean') def.autoMuteExternalAudio = s.autoMuteExternalAudio;
        } else {
          var oldBgm = wx.getStorageSync('super_tongue_axi_v60_bgm_enabled');
          if (typeof oldBgm === 'boolean') def.musicOn = oldBgm;
        }
      } catch (e) {}
      // [kiosk-audio] 网页/大屏：声音默认常开，不读取也不依赖任何「关闭」状态，
      // 避免上一次会话把音乐/音效关掉后本次进网页无声。页面不再提供开启/关闭声音的开关。
      def.musicOn = true;
      def.sfxOn = true;
      // [v27 现场反馈音量太小] 强制音量下限（大屏历史 localStorage 里可能存着 0.5 的低音量，
      //   不抬下限则永远读旧值）：音乐 ≥0.8（增益 0.70）、音效 ≥0.7（增益 0.76），
      //   叠加 game.js masterVolume 1.0 后整体约为此前的 2 倍。
      def.musicLevel = Math.max(def.musicLevel, 0.8);
      def.sfxLevel = Math.max(def.sfxLevel, 0.7);
      return def;
    }
    var settings = loadSettings();
    function saveSettings() {
      settings.volumeModelVersion = AUDIO_LEVEL_MODEL_VERSION;
      settings.musicVolume = musicGainFromLevel(settings.musicLevel);
      settings.sfxVolume = sfxGainFromLevel(settings.sfxLevel);
      try { wx.setStorageSync(SETTINGS_KEY, settings); } catch (e) {}
    }

    bgmState.enabled = settings.musicOn;
    bgmState.volume = musicGainFromLevel(settings.musicLevel);
    // [v46 用户要求] 背景音乐整体调小（只压 BGM，不动音效）：0.5 ≈ -6dB。
    //   现场反馈原音量（musicLevel≥0.8 → 增益 0.70）盖过游戏音，故统一乘一个 BGM 专属衰减系数。
    var BGM_OUTPUT_TRIM = 0.5;
    function bgmOutputVolume() {
      try { return clamp(bgmState.volume * BGM_OUTPUT_TRIM * (audioManifest.masterVolume || 1), 0, 1); } catch (e) { return 0; }
    }
    var sfxState = { volume: sfxGainFromLevel(settings.sfxLevel), enabled: settings.sfxOn };
    saveSettings();

    function bgmTitleFromPath(path) {
      var text = String(path || '').split('/').pop() || '背景音乐';
      return text.replace(/\.[^.]+$/, '').replace(/^\d+[._-]*/, '').replace(/[_-]+/g, ' ').trim() || '背景音乐';
    }
    function buildBgmTracks() {
      var result = [], seen = {};
      function add(item, fallbackName) {
        var path = typeof item === 'string' ? item : (item && (item.path || item.src));
        path = String(path || '');
        if (!path || seen[path]) return;
        seen[path] = true;
        result.push({
          id: String((item && item.id) || ('track_' + result.length)),
          name: String((item && (item.name || item.title)) || fallbackName || bgmTitleFromPath(path)),
          path: path
        });
      }
      function addStageSpec(item) {
        if (!item) return;
        if (typeof item === 'object') {
          if (item.path || item.src) add(item);
          return;
        }
        var ref = String(item || '');
        if (!ref || ref === 'auto' || ref === 'day' || ref === 'night') return;
        if (ref.indexOf('/') >= 0 || /\.(mp3|m4a|aac|wav|ogg)(\?.*)?$/i.test(ref) || /^https?:\/\//i.test(ref)) add(ref);
      }
      var configured = bgmManifest && Array.isArray(bgmManifest.tracks) ? bgmManifest.tracks : [];
      configured.forEach(function(item) { add(item); });
      if (bgmManifest) {
        add(bgmManifest.day, 'Fruit Loop Dash');
        add(bgmManifest.night, 'Pixel Carnival Stroll');
        var stageMap = bgmManifest.stageTracks || bgmManifest.levelTracks || {};
        Object.keys(stageMap).forEach(function(key) { addStageSpec(stageMap[key]); });
      }
      return result;
    }
    var bgmTracks = buildBgmTracks();

    function sfxVolumeNow() { return sfxState.enabled ? (sfxState.volume * (audioManifest.masterVolume || 1)) : 0; }

    // ===== 外部音频占用时全局静音 =====
    // 需求：用户在听歌 / 看视频 / 语音通话 / 其它 App 占用音频时，游戏不发出任何音乐与音效，
    // 让玩家可以在完全静音的状态下正常游玩。
    // 微信没有"查询其它 App 是否正在播放"的接口，因此以官方音频中断事件为准（来电、语音/视频通话、
    // 闹钟、其它 App 抢占音频都会触发 onAudioInterruptionBegin），并配合 obeyMuteSwitch=true
    // 尊重 iOS 静音键，以及游戏内已有的音乐 / 音效开关。
    // [v25] 大屏音频闸门：window.__kioskAudioOn === false 时（大屏尚未按第 2 下「开声音」）
    //       一律不发声（BGM + 音效）。手机端该标志为 true（或 undefined）→ 不受影响。
    // [v36] 但对局中一律放行：闸门只用来约束「待机 / 菜单」阶段的安静，绝不能让游戏过程无声——
    //       否则任何绕过第 2 下的开局路径（连按被 260ms 去抖吞掉、触屏设备无键盘、其它开局入口）
    //       都会让整局没有音乐音效。退出对局回菜单后闸门重新生效，待机依旧安静。
    function isGameAudioAllowed() {
      if (typeof window !== 'undefined' && window.__kioskAudioOn === false) {
        if (!(kioskRun && kioskRun.active)) return false;
      }
      return !audioState.externalAudioBusy;
    }
    // 进入"外部有声"前先给当前音频现场拍一张快照，外部声音结束时按这张快照原样恢复，
    // 保证恢复的就是玩家自己设定的状态（音乐开/关、音效开/关、音量、当前曲目、是否在旋转/传送）。
    function captureAudioSnapshot() {
      return {
        musicOn: !!settings.musicOn,
        sfxOn: !!settings.sfxOn,
        bgmEnabled: !!bgmState.enabled,
        bgmPath: bgmState.currentPath || '',
        bgmPlaying: !!bgmState.inner,
        musicVolume: bgmState.volume,
        sfxVolume: sfxState.volume,
        spinActive: !!(audioState.spinLoopSource || audioState.spinLoopInner),
        portalActive: !!portalState.entryActive,
        scene: scene
      };
    }
    function setExternalAudioBusy(busy) {
      busy = !!busy;
      if (audioState.externalAudioBusy === busy) return;
      audioState.externalAudioBusy = busy;
      if (busy) {
        externalAudioSnapshot = captureAudioSnapshot();
        audioState.externalAudioBusySince = nowMs();
        // 静音：停掉循环音与 BGM，WebAudio 主增益归零并挂起，杜绝任何残留声音
        stopSpinLoop();
        stopPortalTransitSound();
        if (bgmState.inner) { try { bgmState.inner.pause(); } catch (e) {} }
        if (audioState.master && audioState.master.gain) { try { audioState.master.gain.value = 0; } catch (e) {} }
        if (audioState.webCtx && audioState.webCtx.suspend) { try { audioState.webCtx.suspend(); } catch (e) {} }
        return;
      }
      // ===== 外部声音结束：完整还原静音前的设置 =====
      var snap = externalAudioSnapshot;
      externalAudioSnapshot = null;
      audioState.externalAudioBusySince = 0;
      if (audioState.webCtx && audioState.webCtx.resume) { try { audioState.webCtx.resume(); } catch (e) {} }
      // 说明：静音期间只做"暂停 + 增益归零"，从不改写玩家的音乐/音效开关与音量，
      // 所以恢复时按玩家**当前**的设置重新出声即可：关着的绝不会自己打开，
      // 静音期间玩家自己改过的开关与音量同样会被尊重。
      // 1) 音效：按玩家当前的音效开关与音量恢复总增益
      refreshSfxOutput();
      // 2) 音乐：静音前确实在放（或已登记曲目）且玩家当前仍开着音乐 → 从暂停处续播
      //    [2026-10-14 v33] ①只「续播」已有 inner，不再从 currentPath 重建（stopBgm(true) 保留
      //      currentPath，外部声音一停就会把刚停掉的 BGM 整个复活）；②仅限游玩场景。
      var bgmSceneOk = scene === 'playing' || scene === 'paused' || scene === 'golden_skill' ||
        scene === 'golden_skill_ad' || scene === 'finish_slowmo';
      var hadBgm = !snap || !!(snap.bgmPlaying || snap.bgmPath);
      var wantPath = (snap && snap.bgmPath) || bgmState.currentPath || '';
      if (bgmSceneOk && hadBgm && settings.musicOn && bgmState.enabled && wantPath) {
        if (bgmState.inner && bgmState.currentPath === wantPath) {
          try { bgmState.inner.play(); } catch (e) { bgmState.currentPath = ''; playBgmPath(wantPath); }
        } else if (!bgmState.inner) {
          // 内层已销毁（被 v33 场景闸门停掉）→ 不复活，交给下一关 playBgmForLevel
        } else {
          bgmState.currentPath = '';
          playBgmPath(wantPath);
        }
        if (bgmState.inner) {
          try { bgmState.inner.volume = bgmOutputVolume(); } catch (e) {}
        }
      } else if (bgmState.inner) {
        // 玩家本来就没开音乐：确保不会偷偷出声
        try { bgmState.inner.pause(); } catch (e) {}
      }
      // 3) 循环音（舌头旋转 / 传送门穿越）：原本在响的就接回来
      if (snap && snap.spinActive) updateSpinLoop();
      else if (scene === 'playing' && player && !portalState.entryActive) updateSpinLoop();
      if (snap && snap.portalActive && portalState.entryActive) { try { startPortalTransitSound(); } catch (e) {} }
    }
    function setAutoMuteExternalAudio(on) {
      settings.autoMuteExternalAudio = !!on;
      // 关掉这个开关时立刻解除静音，避免卡在"外部有声"状态再也出不了声
      if (!settings.autoMuteExternalAudio) setExternalAudioBusy(false);
      saveSettings();
    }
    // 自愈看门狗：少数机型只触发 onAudioInterruptionBegin、不触发 onAudioInterruptionEnd，
    // 会让游戏一直静音。判定条件：静音已持续 45 秒以上 + 玩家此刻仍在操作游戏
    // （说明不在通话中）→ 认定外部声音已结束，立即恢复原本设置。
    function updateExternalAudioWatchdog() {
      if (!audioState.externalAudioBusy) return;
      var since = audioState.externalAudioBusySince || 0;
      if (!since) { audioState.externalAudioBusySince = nowMs(); return; }
      if (nowMs() - since < 45000) return;
      if (!lastInputAt || (nowMs() - lastInputAt) > 3000) return;
      setExternalAudioBusy(false);
    }
    function refreshSfxOutput() {
      if (audioState.master && audioState.master.gain) {
        // 外部正在播放声音时总增益一律为 0，避免玩家在静音期间改音量导致声音漏出来
        try { audioState.master.gain.value = isGameAudioAllowed() ? (0.52 * sfxVolumeNow()) : 0; } catch (e) {}
      }
      if (!isGameAudioAllowed()) {
        stopSpinLoop();
        stopPortalTransitSound();
        return;
      }
      if (!sfxState.enabled) {
        stopSpinLoop();
        stopPortalTransitSound();
      } else if (scene === 'playing' && player && !portalState.entryActive) {
        updateSpinLoop();
      }
    }
    function findBgmTrackByRef(ref) {
      ref = String(ref || '');
      if (!ref) return null;
      for (var i = 0; i < bgmTracks.length; i++) {
        var track = bgmTracks[i];
        if (track.id === ref || track.path === ref || track.name === ref) return track;
      }
      return null;
    }
    function pathFromBgmSpec(spec) {
      if (!spec) return null;
      if (typeof spec === 'object') {
        if (String(spec.mode || '').toLowerCase() === 'auto') return null;
        if (spec.path || spec.src) return String(spec.path || spec.src);
        spec = spec.track || spec.id || spec.mode || '';
      }
      var ref = String(spec || '').trim();
      if (!ref || ref === 'auto') return null;
      if (ref === 'day') return bgmManifest && (bgmManifest.day || bgmManifest.night || null);
      if (ref === 'night') return bgmManifest && (bgmManifest.night || bgmManifest.day || null);
      var track = findBgmTrackByRef(ref);
      return track ? track.path : ref;
    }
    function resolveConfiguredStageBgm(levelObj, index) {
      if (!bgmManifest) return null;
      levelObj = levelObj || {};
      var direct = pathFromBgmSpec(levelObj.bgm || levelObj.bgmTrack || levelObj.music);
      if (direct) return direct;
      var stageMap = bgmManifest.stageTracks || bgmManifest.levelTracks || {};
      var keys = [];
      if (levelObj.name) keys.push(String(levelObj.name));
      if (isFinite(Number(index))) keys.push(String(Math.round(Number(index))));
      var formalMatch = /^L(\d+)$/.exec(String(levelObj.name || ''));
      if (formalMatch) keys.push('L' + formalMatch[1], String(formalMatch[1]));
      for (var i = 0; i < keys.length; i++) {
        if (Object.prototype.hasOwnProperty.call(stageMap, keys[i])) {
          var configuredPath = pathFromBgmSpec(stageMap[keys[i]]);
          if (configuredPath) return configuredPath;
        }
      }
      return null;
    }
    function resolveBgmPath(theme, levelObj, index) {
      if (!bgmManifest) return null;
      var stagePath = resolveConfiguredStageBgm(levelObj || runtimeLevel, index === undefined ? stageIndex : index);
      if (stagePath) return stagePath;
      var nightThemes = bgmManifest.nightThemes || [];
      var isNight = nightThemes.indexOf(theme) !== -1;
      return isNight ? (bgmManifest.night || bgmManifest.day || null) : (bgmManifest.day || bgmManifest.night || null);
    }
    function isNightStage(levelObj, index) {
      if (!bgmManifest) return false;
      var lv = levelObj || runtimeLevel || {};
      var theme = lv.theme || '';
      if ((bgmManifest.nightThemes || []).indexOf(theme) !== -1) return true;
      var stagePath = resolveConfiguredStageBgm(lv, index === undefined ? stageIndex : index);
      return !!stagePath && stagePath === bgmManifest.night;
    }
    // 夜晚背景强制自动播放「歌曲2」(night 曲目)，不被手动选曲覆盖
    function resolveBgmTrackForStage(levelObj, index) {
      levelObj = levelObj || runtimeLevel || {};
      var idx = (index === undefined ? stageIndex : index);
      if (isNightStage(levelObj, idx)) {
        var nightPath = bgmManifest.night;
        if (nightPath) {
          var t = findBgmTrackByRef(nightPath);
          if (t) {
            var ti = -1;
            for (var k = 0; k < bgmTracks.length; k++) { if (bgmTracks[k].path === nightPath) { ti = k; break; } }
            return { track: t, index: ti, autoMatched: true };
          }
          return { track: { id: 'auto_night', name: bgmTitleFromPath(nightPath), path: nightPath }, index: -1, autoMatched: true };
        }
      }
      var track = getActiveBgmTrack(levelObj.theme, levelObj, idx);
      var tIndex = getActiveBgmTrackIndex(levelObj.theme, levelObj, idx);
      return { track: track, index: tIndex, autoMatched: !(isFinite(Number(settings.musicTrackIndex)) && Number(settings.musicTrackIndex) >= 0) };
    }
    function getActiveBgmTrackIndex(theme, levelObj, index) {
      if (!bgmTracks.length) return -1;
      var saved = Math.round(Number(settings.musicTrackIndex));
      if (isFinite(saved) && saved >= 0) return ((saved % bgmTracks.length) + bgmTracks.length) % bgmTracks.length;
      var autoPath = resolveBgmPath(theme, levelObj || runtimeLevel, index === undefined ? stageIndex : index);
      for (var i = 0; i < bgmTracks.length; i++) if (bgmTracks[i].path === autoPath) return i;
      return 0;
    }
    function getActiveBgmTrack(theme, levelObj, index) {
      var saved = Math.round(Number(settings.musicTrackIndex));
      if (!isFinite(saved) || saved < 0) {
        var autoPath = resolveBgmPath(theme, levelObj || runtimeLevel, index === undefined ? stageIndex : index);
        var autoTrack = findBgmTrackByRef(autoPath);
        if (autoTrack) return autoTrack;
        return autoPath ? { id: 'auto_stage', name: bgmTitleFromPath(autoPath), path: autoPath } : null;
      }
      var activeIndex = getActiveBgmTrackIndex(theme, levelObj, index);
      return activeIndex >= 0 ? bgmTracks[activeIndex] : null;
    }
    function setMusicOn(on) {
      settings.musicOn = !!on;
      bgmState.enabled = settings.musicOn;
      if (settings.musicOn) {
        var r = resolveBgmTrackForStage(runtimeLevel, stageIndex);
        playBgmPath((r.track && r.track.path) || bgmState.currentPath || resolveBgmPath(runtimeLevel && runtimeLevel.theme, runtimeLevel, stageIndex));
      } else stopBgm(true);
    }
    function setSfxOn(on) { settings.sfxOn = !!on; sfxState.enabled = settings.sfxOn; refreshSfxOutput(); }
    function setMusicVolume(v) {
      settings.musicLevel = clamp(v, 0, 1);
      bgmState.volume = musicGainFromLevel(settings.musicLevel);
      if (bgmState.inner) { try { bgmState.inner.volume = bgmOutputVolume(); } catch (e) {} }
    }
    function setSfxVolume(v) {
      settings.sfxLevel = clamp(v, 0, 1);
      sfxState.volume = sfxGainFromLevel(settings.sfxLevel);
      refreshSfxOutput();
    }

    function changeBgmTrack(delta) {
      if (!bgmTracks.length) return null;
      var index = getActiveBgmTrackIndex(runtimeLevel && runtimeLevel.theme, runtimeLevel, stageIndex);
      index = ((index + (delta < 0 ? -1 : 1)) % bgmTracks.length + bgmTracks.length) % bgmTracks.length;
      settings.musicTrackIndex = index;
      playBgmPath(bgmTracks[index].path);
      return bgmTracks[index];
    }
    function getAudioSettingsView() {
      var r = resolveBgmTrackForStage(runtimeLevel, stageIndex);
      return {
        musicVolume: settings.musicLevel,
        musicOn: settings.musicOn,
        sfxVolume: settings.sfxLevel,
        sfxOn: settings.sfxOn,
        autoMuteExternalAudio: settings.autoMuteExternalAudio,
        externalAudioBusy: !!audioState.externalAudioBusy,
        trackIndex: r.index,
        trackCount: bgmTracks.length,
        trackName: r.track ? r.track.name : '未配置背景音乐',
        autoMatched: r.autoMatched
      };
    }

    function stopBgm(keepPath) {
      var rememberedPath = bgmState.currentPath;
      if (bgmState.inner) {
        try { bgmState.inner.stop(); } catch (e) {}
        try { if (bgmState.inner.destroy) bgmState.inner.destroy(); } catch (e) {}
        bgmState.inner = null;
      }
      bgmState.currentPath = keepPath ? rememberedPath : '';
    }

    function playBgmPath(path) {
      if (!path) return;
      if (!bgmState.enabled) { bgmState.currentPath = path; return; }
      if (!isGameAudioAllowed()) { bgmState.currentPath = path; return; } // 外部正在播放声音：只记路径不出声
      if (bgmState.currentPath === path && bgmState.inner) return;
      stopBgm(false);
      if (typeof wx === 'undefined' || !wx.createInnerAudioContext) { bgmState.currentPath = path; return; }
      var inner = wx.createInnerAudioContext();
      inner.loop = true;
      inner.src = path;
      inner.volume = bgmOutputVolume();
      inner.onError(function (err) {
        warnAudioOnce('bgm:' + path, '[bgm] play failed: ' + ((err && err.errMsg) || 'unknown'));
      });
      inner.onCanplay(function () { try { inner.play(); } catch (e) {} });
      try { inner.play(); } catch (e) {}
      bgmState.inner = inner;
      bgmState.currentPath = path;
    }

    function playBgmForLevel(levelObj, index) {
      levelObj = levelObj || runtimeLevel || {};
      // [2026-10-15 v52 现场需求] 大屏三轮 BGM 指定：第1/3轮用第一首(day)，第2轮用第二首(night)。
      //   （原 v31 随机版废弃；关卡若直接配置了具体音频路径仍优先照配。）
      if (typeof window !== 'undefined' && window.__kioskBigScreen === true &&
          bgmManifest && bgmManifest.day && bgmManifest.night && bgmManifest.day !== bgmManifest.night) {
        var explicit = pathFromBgmSpec(levelObj.bgm || levelObj.bgmTrack || levelObj.music);
        if (explicit) {
          playBgmPath(explicit);
          return;
        }
        var ri = Number(window.__kioskRoundIndex) || 0;
        playBgmPath(ri === 1 ? bgmManifest.night : bgmManifest.day);
        return;
      }
      var r = resolveBgmTrackForStage(levelObj, index);
      playBgmPath((r.track && r.track.path) || resolveBgmPath(levelObj.theme, levelObj, index));
    }

    function setBgmEnabled(on) { setMusicOn(on); saveSettings(); }

    function setBgmVolume(v) { setMusicVolume(v); }

    function playNoise(dur, gain, hp, delay) {
      if (!isGameAudioAllowed()) return; // 外部正在播放声音：一律不发声
      dur = dur || 0.12; gain = gain || 0.06; hp = hp || 900; delay = delay || 0;
      var a = ensureAudio(); if (!a || !audioState.master) return;
      try {
        var len = Math.max(1, Math.floor(a.sampleRate * dur));
        var buf = a.createBuffer(1, len, a.sampleRate), data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random()*2-1) * (1 - i/len);
        var src = a.createBufferSource(); src.buffer = buf;
        var filter = a.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = hp;
        var g = a.createGain(), t0 = a.currentTime + delay;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
        src.connect(filter).connect(g).connect(audioState.master); src.start(t0); src.stop(t0+dur+0.01);
      } catch (e) {}
    }

    function playCollisionSound(kind, intensity) {
      kind = kind || 'wall'; intensity = intensity || 1;
      var n = nowSec(); if (n - audioState.lastCollision < 0.06) return;
      audioState.lastCollision = n;
      var key = kind === 'bumper' ? 'collision_bumper' : 'collision_wall';
      if (playBuffer(key, 0.58 + intensity * 0.20, 0.96 + intensity * 0.08)) return;
      playNoise(0.08, 0.06 + intensity * 0.045, 700);
      playTone('triangle', 240 + intensity * 70, 120, 0.08, 0.055 + intensity * 0.03);
    }
    function playTongueSound(kind) {
      kind = kind || 'attach';
      var n = nowSec(); if (n - audioState.lastTongue < 0.05) return;
      audioState.lastTongue = n;
      var key = kind === 'extend' ? 'tongue_extend' : (kind === 'attach' ? 'tongue_attach' : 'tongue_detach');
      if (playBuffer(key, kind === 'extend' ? 0.62 : 0.68, kind === 'attach' ? 1.03 : 1)) return;
      if (kind === 'extend') playTone('sine', 260, 420, 0.10, 0.055);
      else if (kind === 'attach') { playTone('sine', 280, 620, 0.09, 0.065); playTone('triangle', 180, 260, 0.12, 0.045); }
      else { playTone('sine', 460, 180, 0.12, 0.055); playTone('triangle', 220, 120, 0.09, 0.04); }
    }
    function playFoodSound() {
      var n = nowSec(); if (n - audioState.lastFood < 0.04) return; audioState.lastFood = n;
      if (playBuffer('score_food', 0.60, 1)) return;
      playTone('square', 780, 1040, 0.08, 0.055);
    }
    function playFartSound() {
      if (playBuffer('fart_boost', 0.86, 1)) return;
      playNoise(0.30, 0.16, 90, 0);
      playTone('sawtooth', 170, 48, 0.31, 0.12, 0);
      playTone('square', 104, 46, 0.24, 0.060, 0.035);
    }
    function playDeath8BitSound() {
      if (playBuffer('death_8bit', 0.82, 1)) return;
      var notes = [523.25, 392.00, 311.13, 233.08, 174.61];
      for (var i = 0; i < notes.length; i++) playTone('square', notes[i], Math.max(70, notes[i] * 0.86), 0.085, 0.065, i * 0.075);
      playNoise(0.11, 0.035, 1500, 0.31);
    }
    function playSoulAscend8BitSound() {
      if (playBuffer('soul_ascend_8bit', 0.88, 1)) return;
      var notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      for (var i = 0; i < notes.length; i++) {
        playTone(i < 4 ? 'square' : 'triangle', notes[i], notes[i] * 1.015, 0.19, 0.052 + i * 0.003, i * 0.14);
        if (i >= 3) playTone('square', notes[i] * 0.5, notes[i] * 0.505, 0.22, 0.024, i * 0.14);
      }
      playTone('triangle', 1046.50, 1174.66, 0.42, 0.058, 0.98);
    }
    function playApplauseSound() {
      var pa = playBuffer('finish_applause', 0.70, 1), pc = playBuffer('finish_confetti', 0.64, 1);
      if (!pa) for (var i = 0; i < 8; i++) playNoise(0.07, 0.04 + Math.random()*0.02, 1200 + Math.random()*1200, i*0.08);
      if (!pc) { playTone('triangle', 700, 1050, 0.05, 0.05); playTone('triangle', 860, 1280, 0.05, 0.05, 0.04); }
    }
    function sayVoice(text) {
      var cue = text.indexOf('呜呼') >= 0 ? 'voice_wuhoo' : (text.indexOf('过关') >= 0 ? 'voice_clear' : '');
      if (cue) playBuffer(cue, 0.72, 1);
    }
    function playUiClickSound() {
      if (playBuffer('tongue_attach', 0.28, 1.25)) return;
      playTone('square', 620, 840, 0.055, 0.026);
    }
    function playLevelUnlockSound() {
      // 新区域解锁：彩带音效 + 鼓掌 + 欢呼同时出现。
      var confettiOk = playBuffer('finish_confetti', 0.66, 1.06);
      var applauseOk = playBuffer('finish_applause', 0.78, 1);
      if (!confettiOk) {
        playTone('triangle', 700, 1050, 0.08, 0.052);
        playTone('triangle', 860, 1320, 0.10, 0.052, 0.05);
      }
      if (!applauseOk) {
        for (var clap = 0; clap < 9; clap++) {
          playNoise(0.065, 0.036 + Math.random() * 0.018, 1100 + Math.random() * 1700, clap * 0.075);
        }
      }
      setTimeout(function () {
        if (!playBuffer('voice_wuhoo', 0.84, 1)) {
          playTone('triangle', 440, 880, 0.24, 0.072);
          playTone('sine', 660, 1180, 0.30, 0.056, 0.08);
        }
      }, 90);

      var notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
      for (var i = 0; i < notes.length; i++) {
        playTone(i < 3 ? 'triangle' : 'sine', notes[i], notes[i] * 1.018, 0.18, 0.050 + i * 0.004, i * 0.105);
      }
      playTone('triangle', 1046.50, 1174.66, 0.42, 0.060, 0.48);
    }

    function playPortalEntrySound() {
      // 门吸入角色时的短促上升音与空间冲击。
      playNoise(0.34, 0.065, 180, 0);
      playTone('sawtooth', 150, 1320, 0.48, 0.078, 0);
      playTone('sine', 320, 1760, 0.38, 0.058, 0.05);
      playTone('triangle', 980, 180, 0.32, 0.050, 0.20);
    }

    function startPortalTransitSound() {
      stopPortalTransitSound();
      if (!isGameAudioAllowed()) return; // 外部正在播放声音：一律不发声

      // 门内穿越音优先使用外部音频；人物翻滚音只用于角色滚动。
      ensureAudio();
      if (!sfxState.enabled) return;

      if (typeof wx !== 'undefined' && wx.createInnerAudioContext && !audioState.innerFailed.portal_travel) {
        var inner = getInnerAudio('portal_travel', false);
        if (inner) {
          try { inner.stop(); } catch (e) {}
          try { if (inner.seek) inner.seek(0); } catch (e) {}
          try {
            inner.loop = false;
            inner.volume = clamp(0.88 * sfxVolumeNow(), 0, 1);
            if ('playbackRate' in inner) inner.playbackRate = 1;
            if (audioState.innerReady.portal_travel) inner.play();
            else {
              audioState.innerPending.portal_travel = true;
              inner.play();
            }
            audioState.portalTransitSound = { kind: 'inner', inner: inner };
          } catch (e) {
            audioState.portalTransitSound = null;
          }
        }
      }

      if (!audioState.portalTransitSound && audioState.webCtx && audioState.master && audioState.buffers['portal_travel']) {
        try {
          var a = audioState.webCtx;
          var src = a.createBufferSource();
          var gain = a.createGain();
          src.buffer = audioState.buffers['portal_travel'];
          src.playbackRate.value = 1;
          gain.gain.value = clamp(0.88, 0, 1);
          src.connect(gain).connect(audioState.master);
          src.start();
          audioState.portalTransitSound = { kind: 'buffer', src: src, gain: gain };
        } catch (e) {
          audioState.portalTransitSound = null;
        }
      }

      if (!audioState.portalTransitSound) {
        var a = ensureAudio();
        if (sfxState.enabled && a && audioState.master) {
          try {
            var bus = a.createGain();
            var filter = a.createBiquadFilter();
            var oscA = a.createOscillator();
            var oscB = a.createOscillator();
            var lfo = a.createOscillator();
            var lfoDepth = a.createGain();

            bus.gain.setValueAtTime(0.0001, a.currentTime);
            bus.gain.exponentialRampToValueAtTime(0.070, a.currentTime + 0.12);
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(430, a.currentTime);
            filter.frequency.exponentialRampToValueAtTime(1280, a.currentTime + 2.0);
            filter.Q.value = 1.4;

            oscA.type = 'sawtooth';
            oscA.frequency.setValueAtTime(72, a.currentTime);
            oscA.frequency.exponentialRampToValueAtTime(132, a.currentTime + 2.0);
            oscB.type = 'sine';
            oscB.frequency.setValueAtTime(184, a.currentTime);
            oscB.frequency.exponentialRampToValueAtTime(420, a.currentTime + 2.0);

            lfo.type = 'sine';
            lfo.frequency.value = 4.2;
            lfoDepth.gain.value = 0.014;

            oscA.connect(filter);
            oscB.connect(filter);
            filter.connect(bus).connect(audioState.master);
            lfo.connect(lfoDepth).connect(bus.gain);

            oscA.start();
            oscB.start();
            lfo.start();

            audioState.portalTransitSound = {
              kind: 'synth',
              bus: bus,
              nodes: [oscA, oscB, lfo]
            };
          } catch (e) {
            audioState.portalTransitSound = null;
          }
        }

        // 由短音点缀速度变化，即使设备不支持 WebAudio 仍有反馈。
        playTone('sine', 220, 520, 0.42, 0.040, 0.10);
        playTone('triangle', 380, 880, 0.40, 0.035, 0.58);
        playTone('sine', 520, 1240, 0.42, 0.034, 1.06);
        playTone('triangle', 720, 1660, 0.40, 0.032, 1.52);
      }
    }

    function stopPortalTransitSound() {
      stopSpinLoop();
      var sound = audioState.portalTransitSound;
      audioState.portalTransitSound = null;
      if (!sound) return;
      if (sound.kind === 'inner' && sound.inner) {
        try { sound.inner.stop(); } catch (e) {}
        return;
      }
      if (sound.kind === 'buffer' && sound.src) {
        try { sound.src.stop(); } catch (e) {}
        return;
      }
      var a = audioState.webCtx;
      try {
        var stopAt = a ? a.currentTime + 0.10 : 0;
        if (a && sound.bus && sound.bus.gain) {
          sound.bus.gain.cancelScheduledValues(a.currentTime);
          sound.bus.gain.setValueAtTime(Math.max(0.0001, Number(sound.bus.gain.value) || 0.04), a.currentTime);
          sound.bus.gain.exponentialRampToValueAtTime(0.0001, stopAt);
        }
        (sound.nodes || []).forEach(function (node) {
          try { node.stop(stopAt); } catch (ignore) {}
        });
      } catch (e) {
        (sound.nodes || []).forEach(function (node) {
          try { node.stop(); } catch (ignore) {}
        });
      }
    }

    function playPortalArrivalSound() {
      playTone('sine', 740, 1480, 0.28, 0.060);
      playTone('triangle', 1110, 1660, 0.34, 0.050, 0.08);
      playTone('sine', 1480, 1960, 0.24, 0.034, 0.16);
      playNoise(0.10, 0.020, 2600, 0.05);
    }

    function isPhysicalWeChatDevice() {
      if (typeof wx === 'undefined') return false;
      try {
        var info = wx.getDeviceInfo ? wx.getDeviceInfo() : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : null);
        if (info && String(info.platform || '').toLowerCase() === 'devtools') return false;
      } catch (e) {}
      return true;
    }

    function triggerHaptic(kind, force) {
      kind = kind || 'light';
      if (!isPhysicalWeChatDevice()) return;
      var t = nowMs();
      var minGap = kind === 'long' ? 360 : (kind === 'heavy' ? 180 : (kind === 'medium' ? 115 : 70));
      if (!force && t - hapticState.lastMs < minGap) return;
      hapticState.lastMs = t;

      function warnUnavailable() {
        if (hapticState.warned) return;
        hapticState.warned = true;
      }

      try {
        if (kind === 'long') {
          if (wx.vibrateLong) {
            wx.vibrateLong({
              fail: function () {
                if (wx.vibrateShort) {
                  try { wx.vibrateShort({ type: 'heavy' }); } catch (e) { try { wx.vibrateShort({}); } catch (ignore) {} }
                } else warnUnavailable();
              }
            });
            return;
          }
          if (wx.vibrateShort) {
            wx.vibrateShort({ type: 'heavy', fail: function () { try { wx.vibrateShort({}); } catch (e) {} } });
            return;
          }
          warnUnavailable();
          return;
        }

        if (!wx.vibrateShort) { warnUnavailable(); return; }
        var type = kind === 'heavy' ? 'heavy' : (kind === 'medium' ? 'medium' : 'light');
        wx.vibrateShort({
          type: type,
          fail: function () {
            try { wx.vibrateShort({}); } catch (e) { warnUnavailable(); }
          }
        });
      } catch (e) {
        warnUnavailable();
      }
    }

    function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
    function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
    function nowSec() {
      return scaledClockStartSec + ((nowMs() - scaledClockRealStartMs) / 1000) * GAME_SPEED;
    }
    function normalizeAngle(rad) { var f = Math.PI * 2; return ((rad % f) + f) % f; }
    function shortestAngleDelta(from, to) { var d = normalizeAngle(to) - normalizeAngle(from); if (d > Math.PI) d -= Math.PI*2; if (d < -Math.PI) d += Math.PI*2; return d; }
    function directionAngle(dx, dy) { return normalizeAngle(Math.atan2(dx, -dy)); }
    function angleToFrame(rad) { var c = (sprite.manifest && sprite.manifest.frameCount) || 24; return Math.round(normalizeAngle(rad) / (Math.PI*2) * c) % c; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

    var STAGES = Array.isArray(levelPack.stages) && levelPack.stages.length
      ? levelPack.stages.map(function (s) { return clone(s); })
      : [clone(levelPack.defaultLevel || {})];

    // 根目录最新版关卡包内容发生变化时，自动移除旧的本地地图覆盖，确保替换后立即读取新地图。
    function computeLevelPackSignature(stages) {
      var text = '';
      try { text = JSON.stringify(stages || []); } catch (e) { text = String((stages && stages.length) || 0); }
      var hash = 2166136261;
      for (var i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        if (Math.imul) hash = Math.imul(hash, 16777619);
        else hash = (hash * 16777619) | 0;
      }
      return 'map_' + (hash >>> 0).toString(16) + '_' + text.length;
    }
    function syncLevelPackStorage() {
      try {
        var signature = computeLevelPackSignature(STAGES);
        var previous = String(wx.getStorageSync(LEVEL_PACK_SIGNATURE_KEY) || '');
        if (previous !== signature) {
          try { wx.removeStorageSync(LEVEL_OVERRIDES_KEY); } catch (removeOverridesError) {}
          try { wx.removeStorageSync(LEVEL_KEY); } catch (removeLevelError) {}
          wx.setStorageSync(LEVEL_PACK_SIGNATURE_KEY, signature);
        }
      } catch (syncLevelPackError) {
      }
    }
    syncLevelPackStorage();

    var MAIN_STAGE_START = Math.max(0, STAGES.findIndex(function (s) { return !s.isTutorial; }));
    var FORMAL_STAGE_COUNT = Math.max(1, STAGES.length - MAIN_STAGE_START);
    var ALWAYS_UNLOCKED_FORMAL_COUNT = 3;
    var MIN_UNLOCKED_STAGE = Math.min(STAGES.length - 1, MAIN_STAGE_START + ALWAYS_UNLOCKED_FORMAL_COUNT - 1);
    var UNLOCK_SYSTEM_VERSION = 3;
    var unlockScoreTable = unlockConfig && unlockConfig.unlockScores && typeof unlockConfig.unlockScores === 'object'
      ? unlockConfig.unlockScores : { 4: 5000, 5: 8000, 6: 12000, 7: 17000, 8: 23000, 9: 30000, 10: 38000 };
    var portalRadiusFallback = Math.max(48, Number(unlockConfig && unlockConfig.portalRadius) || 60);
    var PORTAL_HALF_WIDTH = Math.max(42, (Number(unlockConfig && unlockConfig.portalWidth) || 120) * 0.5);
    var PORTAL_HALF_HEIGHT = Math.max(64, (Number(unlockConfig && unlockConfig.portalHeight) || 190) * 0.5);
    var PORTAL_RADIUS = PORTAL_HALF_WIDTH; // 兼容旧字段。
    var PORTAL_SPAWN_SECONDS = Math.max(0.20, Number(unlockConfig && unlockConfig.portalSpawnSeconds) || 0.35);
    var PORTAL_SPAWN_AHEAD = Math.max(24, Number(unlockConfig && unlockConfig.portalSpawnAhead) || 170);
    var PORTAL_ENTRY_SECONDS = Math.max(0.45, Number(unlockConfig && unlockConfig.portalEntrySeconds) || 0.72);
    var PORTAL_TRAVEL_SECONDS = Math.max(1.2, Number(unlockConfig && unlockConfig.portalTravelSeconds) || 2.0);
    var PORTAL_WHITE_SECONDS = Math.max(0.55, Number(unlockConfig && unlockConfig.portalWhiteSeconds) || 1.0);
    var PORTAL_TRANSITION_TOTAL_SECONDS = PORTAL_TRAVEL_SECONDS + PORTAL_WHITE_SECONDS;
    var PORTAL_FRAME_COUNT = Math.max(2, portalSpriteConfig.frameCount || 8);
    var PORTAL_FRAME_WIDTH_RATIOS = [0.38, 0.43, 0.51, 0.60, 0.70, 0.79, 0.89, 1.0];

    function formalStageNumber(index) { return Math.max(0, clampStageIndex(index) - MAIN_STAGE_START + 1); }
    function stageIndexForFormal(number) { return clampStageIndex(MAIN_STAGE_START + Math.max(1, Math.round(Number(number) || 1)) - 1); }
    function isFinalFormalStage(index) { return formalStageNumber(index) === FORMAL_STAGE_COUNT; }
    function currentRoundNumber() { return Math.max(1, Math.round(Number(progress && progress.round) || 1)); }
    function roundLengthMultiplierFor(roundNo) {
      roundNo = Math.max(1, Math.round(Number(roundNo) || 1));
      return 1 + (roundNo - 1) * 0.5;
    }
    function currentRoundLengthMultiplier() { return roundLengthMultiplierFor(currentRoundNumber()); }
    function roundPhysicsSpeedMultiplierFor(roundNo) {
      roundNo = Math.max(1, Math.round(Number(roundNo) || 1));
      // 每进入下一轮，主角与关卡内物理位移速度增加 5%：第1轮 1.00、第2轮 1.05、第3轮 1.10……
      return 1 + Math.max(0, roundNo - 1) * 0.05;
    }
    function currentRoundPhysicsSpeedMultiplier() {
      return runtimeLevel && runtimeLevel.isTutorial ? 1 : roundPhysicsSpeedMultiplierFor(currentRoundNumber());
    }
    function crowFlightSpeedMultiplierFor(roundNo) {
      roundNo = Math.max(1, Math.round(Number(roundNo) || 1));
      // 首轮第10关与第2轮维持基础速度；第3轮起每轮再增加 10%。
      return roundNo <= 2 ? 1 : 1 + Math.max(0, roundNo - 2) * 0.10;
    }
    function roundScoreMultiplierFor(roundNo) {
      roundNo = Math.max(1, Math.round(Number(roundNo) || 1));
      // 第1轮 1.00、第2轮 0.95、第3轮 0.90、第4轮 0.85、第5轮 0.80、第6轮 0.75、第7轮 0.70；
      // 第7轮起到 7 折（0.70）封顶，第8轮及以后固定按 7 折计分，不再继续递减。
      // 该折扣仅作用于「其他得分」（飞行/吐舌/高度/难度/时间等分），
      // 食物得分与乌鸦/放屁扣分一律不打折。
      return Math.max(0.70, 1 - Math.max(0, roundNo - 1) * 0.05);
    }
    function currentRoundScoreMultiplier() { return roundScoreMultiplierFor(currentRoundNumber()); }
    function applyRoundScoreBonus(points) {
      var base = Math.max(0, Math.round(Number(points) || 0));
      return Math.max(0, Math.round(base * currentRoundScoreMultiplier()));
    }

    function appendRoundPointItems(targetArray, sourceArray, sourceStart, sourceLength, destStart, roundNo, segmentNo, key) {
      var sourceEnd = sourceStart + sourceLength;
      for (var i = 0; i < sourceArray.length; i++) {
        var original = sourceArray[i];
        var ox = Number(original && original.x);
        if (!isFinite(ox) || ox < sourceStart || ox >= sourceEnd) continue;
        var copy = clone(original);
        copy.x = Math.round(destStart + (ox - sourceStart));
        copy.id = String(copy.id || key || 'item') + '_r' + roundNo + '_s' + segmentNo + '_' + i;
        copy.roundGenerated = true;
        if (Object.prototype.hasOwnProperty.call(copy, 'collected')) copy.collected = false;
        if (Object.prototype.hasOwnProperty.call(copy, 'used')) copy.used = false;
        if (Object.prototype.hasOwnProperty.call(copy, 'removed')) copy.removed = false;
        if (Object.prototype.hasOwnProperty.call(copy, 'disappearTimer')) copy.disappearTimer = 0;
        targetArray.push(copy);
      }
    }

    function appendRoundRectItems(targetArray, sourceArray, sourceStart, sourceLength, destStart, roundNo, segmentNo, key) {
      var sourceEnd = sourceStart + sourceLength;
      for (var i = 0; i < sourceArray.length; i++) {
        var original = sourceArray[i];
        var ox = Number(original && original.x);
        var ow = Math.max(1, Number(original && original.w) || 1);
        if (!isFinite(ox)) continue;
        var overlapStart = Math.max(sourceStart, ox);
        var overlapEnd = Math.min(sourceEnd, ox + ow);
        if (overlapEnd <= overlapStart) continue;
        var copy = clone(original);
        copy.x = Math.round(destStart + (overlapStart - sourceStart));
        copy.w = Math.max(1, Math.round(overlapEnd - overlapStart));
        copy.id = String(copy.id || key || 'rect') + '_r' + roundNo + '_s' + segmentNo + '_' + i;
        copy.roundGenerated = true;
        if (Object.prototype.hasOwnProperty.call(copy, 'used')) copy.used = false;
        if (Object.prototype.hasOwnProperty.call(copy, 'removed')) copy.removed = false;
        if (Object.prototype.hasOwnProperty.call(copy, 'disappearTimer')) copy.disappearTimer = 0;
        targetArray.push(copy);
      }
    }


    function stripRoundLayoutTransientFields(data) {
      var out = clone(data || {});
      delete out.roundNumber;
      delete out.roundLengthMultiplier;
      delete out.firstRoundFinishX;
      delete out.roundBaseDistance;
      delete out.roundBaseWidth;
      delete out.roundBaseStartX;
      delete out.roundBaseTailMargin;
      delete out.editingRoundNumber;
      delete out.roundLayoutSource;
      delete out.roundGenerated;
      delete out.segmentNo;
      delete out.roundVariantSavedAt;
      delete out.roundLayoutDirty;
      delete out.roundLayouts;
      ['anchors','foods','bumpers','walls','windZones'].forEach(function(key) {
        if (!Array.isArray(out[key])) out[key] = [];
        out[key].forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          delete item.roundGenerated;
          delete item.segmentNo;
          delete item.collected;
          delete item.used;
          delete item.removed;
          delete item.disappearTimer;
          delete item.springAnim;
          delete item.springAnimVelocity;
        });
      });
      return out;
    }
    function buildRoundLayoutSnapshot(levelData) {
      return normalizeLevel(stripRoundLayoutTransientFields(clone(levelData || {})));
    }
    function getStoredRoundLayout(stageData, roundNo) {
      if (!stageData || !stageData.roundLayouts || typeof stageData.roundLayouts !== 'object') return null;
      var key = String(Math.max(1, Math.round(Number(roundNo) || 1)));
      var saved = stageData.roundLayouts[key];
      if (!saved || typeof saved !== 'object') return null;
      return buildRoundLayoutSnapshot(saved);
    }
    function applyRoundMetadata(targetLevel, roundNo, lengthMultiplier, startX, originalFinishX, baseDistance, originalWidth, tailMargin) {
      if (!targetLevel || typeof targetLevel !== 'object') return targetLevel;
      targetLevel.roundNumber = roundNo;
      targetLevel.roundLengthMultiplier = lengthMultiplier;
      targetLevel.firstRoundFinishX = originalFinishX;
      targetLevel.roundBaseDistance = baseDistance;
      targetLevel.roundBaseWidth = originalWidth;
      targetLevel.roundBaseStartX = startX;
      targetLevel.roundBaseTailMargin = tailMargin;
      targetLevel.editingRoundNumber = roundNo;
      return targetLevel;
    }

    function applyRoundStageRules(targetLevel) {
      if (!targetLevel || targetLevel.isTutorial) return targetLevel;
      var roundNo = currentRoundNumber();
      var lengthMultiplier = currentRoundLengthMultiplier();

      var startX = Math.max(0, Number(targetLevel.start && targetLevel.start.x) || 0);
      var originalFinishX = Math.max(startX + 400, Number(targetLevel.finish && targetLevel.finish.x) || Number(targetLevel.width) - 160);
      var originalWidth = Math.max(originalFinishX + 90, Number(targetLevel.width) || originalFinishX + 160);
      var baseDistance = Math.max(400, originalFinishX - startX);
      var tailMargin = Math.max(90, originalWidth - originalFinishX);

      if (roundNo <= 1) return applyRoundMetadata(targetLevel, roundNo, lengthMultiplier, startX, originalFinishX, baseDistance, originalWidth, tailMargin);

      var storedRoundLayout = getStoredRoundLayout(targetLevel, roundNo);
      if (storedRoundLayout) {
        storedRoundLayout.roundLayouts = clone(targetLevel.roundLayouts || {});
        return applyRoundMetadata(storedRoundLayout, roundNo, lengthMultiplier, startX, originalFinishX, baseDistance, originalWidth, tailMargin);
      }

      var newFinishX = startX + baseDistance * lengthMultiplier;
      targetLevel.finish.x = Math.round(newFinishX);
      targetLevel.width = Math.max(VIEW_W, Math.round(newFinishX + tailMargin));

      var base = {
        anchors: clone(targetLevel.anchors || []),
        foods: clone(targetLevel.foods || []),
        bumpers: clone(targetLevel.bumpers || []),
        walls: clone(targetLevel.walls || []),
        windZones: clone(targetLevel.windZones || [])
      };
      var remaining = Math.max(0, newFinishX - originalFinishX);
      var sourceStart = Math.max(0, startX - 120);
      var segmentNo = 1;
      while (remaining > 0.5) {
        var segmentLength = Math.min(baseDistance, remaining);
        var destStart = originalFinishX + (segmentNo - 1) * baseDistance;
        appendRoundPointItems(targetLevel.anchors, base.anchors, sourceStart, segmentLength, destStart, roundNo, segmentNo, 'anchor');
        appendRoundPointItems(targetLevel.foods, base.foods, sourceStart, segmentLength, destStart, roundNo, segmentNo, 'food');
        appendRoundPointItems(targetLevel.bumpers, base.bumpers, sourceStart, segmentLength, destStart, roundNo, segmentNo, 'bumper');
        appendRoundRectItems(targetLevel.walls, base.walls, sourceStart, segmentLength, destStart, roundNo, segmentNo, 'wall');
        appendRoundRectItems(targetLevel.windZones, base.windZones, sourceStart, segmentLength, destStart, roundNo, segmentNo, 'wind');
        remaining -= segmentLength;
        segmentNo += 1;
      }
      return applyRoundMetadata(targetLevel, roundNo, lengthMultiplier, startX, originalFinishX, baseDistance, originalWidth, tailMargin);
    }
    // 每一轮都重复使用同一套解锁曲线。排行榜与永久累计总分不清零，
    // 但关卡解锁只读取“本轮累计分数”：永久累计总分 - 本轮起始总分。
    function unlockScoreForStage(index) {
      var no = formalStageNumber(index);
      return no <= ALWAYS_UNLOCKED_FORMAL_COUNT ? 0 : Math.max(0, Math.round(Number(unlockScoreTable[no]) || 0));
    }
    function roundUnlockBaseScoreFor(source) {
      source = source && typeof source === 'object' ? source : {};
      var total = Math.max(0, Math.round(Number(source.totalScore) || 0));
      return clamp(Math.round(Number(source.roundUnlockBaseScore) || 0), 0, total);
    }
    function roundUnlockScoreFor(source) {
      source = source && typeof source === 'object' ? source : {};
      return Math.max(0, Math.round(Number(source.totalScore) || 0) - roundUnlockBaseScoreFor(source));
    }
    function currentRoundUnlockScore() { return roundUnlockScoreFor(progress); }
    function stageDisplayInfo(index) {
      var lv = STAGES[clampStageIndex(index)] || {};
      var no = formalStageNumber(index);
      return {
        stageIndex: clampStageIndex(index),
        formalNumber: no,
        // 2026-10-01：level_pack 已写入 title，这里只作兜底（杭州 = 第 4 关）。
        title: String(lv.title || (no === 1 ? '森林' : (no === 2 ? '农村' : (no === 3 ? '上海' : (no === 4 ? '杭州' : ('第' + no + '关')))))),
        titleEn: String(lv.titleEn || (no === 1 ? 'FOREST' : (no === 2 ? 'COUNTRYSIDE' : (no === 3 ? 'SHANGHAI' : (no === 4 ? 'HANGZHOU' : ''))))),
        threshold: unlockScoreForStage(index)
      };
    }

    var FIRST_SEQUENCE_FORMAL_COUNT = Math.min(3, FORMAL_STAGE_COUNT);
    function firstSequenceClearedCount(source) {
      source = source && typeof source === 'object' ? source : progress;
      return clamp(Math.round(Number(source && source.firstThreeCleared) || 0), 0, FIRST_SEQUENCE_FORMAL_COUNT);
    }
    function firstSequenceLocked(source) {
      source = source && typeof source === 'object' ? source : progress;
      var roundNo = Math.max(1, Math.round(Number(source && source.round) || 1));
      return roundNo === 1 && firstSequenceClearedCount(source) < FIRST_SEQUENCE_FORMAL_COUNT;
    }
    function requiredFirstSequenceStageIndex(source) {
      return stageIndexForFormal(Math.min(FIRST_SEQUENCE_FORMAL_COUNT, firstSequenceClearedCount(source) + 1));
    }
    function lowestSelectableStageIndex() {
      return firstSequenceLocked(progress) ? requiredFirstSequenceStageIndex(progress) : MAIN_STAGE_START;
    }
    function highestSelectableStageIndex() {
      if (firstSequenceLocked(progress)) return requiredFirstSequenceStageIndex(progress);
      return clampStageIndex(Math.max(MIN_UNLOCKED_STAGE, Number(progress && progress.unlockedStage) || MIN_UNLOCKED_STAGE));
    }
    function clampSelectableStageIndex(value) {
      var low = lowestSelectableStageIndex();
      var high = Math.max(low, highestSelectableStageIndex());
      return clampStageIndex(clamp(Number(value) || low, low, high));
    }
    function openStageSelect() {
      stageSelectIndex = clampSelectableStageIndex(progress.currentStage || stageIndex || lowestSelectableStageIndex());
      stageSelectOpen = true;
      skinPanelOpen = false;
      pointerHeld = false;
    }
    function closeStageSelect() {
      stageSelectOpen = false;
    }
    function closeMenuIntroAndOpenStageSelect() {
      if (!progress.tutorialSeen) {
        progress.tutorialSeen = true;
        progress.currentStage = MAIN_STAGE_START;
        progress.firstThreeCleared = firstSequenceClearedCount(progress);
        progress.unlockedStage = Math.max(Number(progress.unlockedStage) || 0, MIN_UNLOCKED_STAGE);
        saveProgress();
      }
      menuIntroOpen = false;
      openStageSelect();
    }
    function adjustStageSelect(delta) {
      var before = stageSelectIndex;
      stageSelectIndex = clampSelectableStageIndex(stageSelectIndex + (Number(delta) || 0));
      if (stageSelectIndex !== before) {
        triggerHaptic('light');
        playUiClickSound();
      }
    }
    function startSelectedStage() {
      var low = lowestSelectableStageIndex();
      var high = highestSelectableStageIndex();
      var requested = clampStageIndex(stageSelectIndex);
      if (requested < low || requested > high) {
        stageSelectIndex = clampSelectableStageIndex(requested);
        showToastMessage('该关卡尚未解锁');
        triggerHaptic('light');
        return;
      }
      var target = clampSelectableStageIndex(requested);
      progress.currentStage = target;
      saveProgress();
      stageSelectOpen = false;
      requestPlayerProfile(function() { requestFormalPlay(target, true); });
    }

    function highestStageAllowedByScore(score, roundNo) {
      roundNo = roundNo === undefined ? currentRoundNumber() : Math.max(1, Math.round(Number(roundNo) || 1));
      // 第2轮起不再需要解锁：所有关卡直接可玩。
      if (roundNo >= 2) return clampStageIndex(STAGES.length - 1);
      var highest = MIN_UNLOCKED_STAGE;
      score = Math.max(0, Math.round(Number(score) || 0));
      for (var i = MIN_UNLOCKED_STAGE + 1; i < STAGES.length; i++) {
        var need = unlockScoreForStage(i);
        if (need > 0 && score >= need) highest = i;
        else break;
      }
      return clampStageIndex(highest);
    }
    function resetRoundUnlockProgress(source, roundNo, baseScore) {
      source = source && typeof source === 'object' ? source : {};
      roundNo = Math.max(1, Math.round(Number(roundNo) || 1));
      source.roundUnlockRound = roundNo;
      // 第2轮起分数沿用前一轮累计（不再重置基准），且所有关卡直接解锁。
      if (roundNo >= 2) {
        source.roundUnlockBaseScore = 0;
        source.unlockedStage = clampStageIndex(STAGES.length - 1);
        source.lastCelebratedUnlockStage = clampStageIndex(STAGES.length - 1);
        source.firstThreeCleared = FIRST_SEQUENCE_FORMAL_COUNT;
      } else {
        source.roundUnlockBaseScore = clamp(
          Math.round(baseScore === undefined ? Number(source.totalScore) || 0 : Number(baseScore) || 0),
          0,
          Math.max(0, Math.round(Number(source.totalScore) || 0))
        );
        source.unlockedStage = MIN_UNLOCKED_STAGE;
        source.lastCelebratedUnlockStage = MIN_UNLOCKED_STAGE;
        source.firstThreeCleared = 0;
      }
      source.pendingPortalStage = -1;
      return source;
    }

    function clampStageIndex(v) { return clamp(Math.round(Number(v) || 0), 0, Math.max(0, STAGES.length - 1)); }
    function resolveInitialStageIndex() {
      var s = clampStageIndex(progress.currentStage || 0);
      if (!progress.tutorialSeen) return s;
      return clampStageIndex(clamp(s, MAIN_STAGE_START, Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE)));
    }
    function getStageTemplate(i) { return normalizeLevel(clone(STAGES[clampStageIndex(i)] || STAGES[0] || {})); }

    function loadProgress() {
      var fb = {
        totalScore: 0, bestScore: 0, runs: 0, totalFood: 0,
        currentStage: 0, unlockedStage: MIN_UNLOCKED_STAGE, pendingPortalStage: -1,
        tutorialSeen: false, gateTutorialSeen: false, lastCelebratedUnlockStage: MIN_UNLOCKED_STAGE,
        firstThreeCleared: 0,
        round: 1, pendingRoundTarget: 0,
        roundUnlockBaseScore: 0, roundUnlockRound: 1,
        unlockSystemVersion: 0
      };
      var out = fb;
      var stored = null;
      var hadStoredProgress = false;
      try {
        stored = wx.getStorageSync(PROGRESS_KEY);
        hadStoredProgress = !!(stored && typeof stored === 'object');
        if (hadStoredProgress) out = Object.assign({}, fb, stored);
      } catch(e) {}
      out.totalScore = Math.max(0, Math.round(Number(out.totalScore) || 0));
      out.round = Math.max(1, Math.round(Number(out.round) || 1));
      out.pendingRoundTarget = Math.max(0, Math.round(Number(out.pendingRoundTarget) || 0));
      if (stored && isFinite(Number(stored.firstThreeCleared))) {
        out.firstThreeCleared = clamp(Math.round(Number(stored.firstThreeCleared) || 0), 0, FIRST_SEQUENCE_FORMAL_COUNT);
      } else if (out.round >= 2) {
        out.firstThreeCleared = FIRST_SEQUENCE_FORMAL_COUNT;
      } else if (hadStoredProgress) {
        var migratedFormalStage = formalStageNumber(clampStageIndex(out.currentStage));
        out.firstThreeCleared = clamp(Math.max(0, migratedFormalStage - 1), 0, FIRST_SEQUENCE_FORMAL_COUNT);
        if (clampStageIndex(out.unlockedStage) > MIN_UNLOCKED_STAGE) out.firstThreeCleared = FIRST_SEQUENCE_FORMAL_COUNT;
      } else {
        out.firstThreeCleared = 0;
      }
      var storedUnlockVersion = Math.round(Number(out.unlockSystemVersion) || 0);
      var storedUnlockedStage = clampStageIndex(Math.max(MIN_UNLOCKED_STAGE, Number(out.unlockedStage) || MIN_UNLOCKED_STAGE));
      var hasMatchingRoundBase = isFinite(Number(out.roundUnlockBaseScore)) &&
        Math.max(1, Math.round(Number(out.roundUnlockRound) || 1)) === out.round;
      var needsProgressResave = !(stored && isFinite(Number(stored.firstThreeCleared)));
      var recoveredPendingRound = false;

      if (out.pendingRoundTarget > out.round) {
        // 第10关已经完成但应用在穿越过场中退出：下次启动仍兑现下一轮，
        // 并从该时刻的永久累计总分重新计算新一轮解锁进度。
        out.round = out.pendingRoundTarget;
        out.currentStage = MAIN_STAGE_START;
        out.pendingRoundTarget = 0;
        resetRoundUnlockProgress(out, out.round, out.totalScore);
        recoveredPendingRound = true;
        needsProgressResave = true;
      } else if (storedUnlockVersion !== UNLOCK_SYSTEM_VERSION) {
        // 旧版本迁移：第1轮从 0 分开始；已在第2轮以上的玩家尽量保留当前已解锁关卡，
        // 之后进入下一轮时再正式按本轮起始分数重置。
        if (out.round <= 1) {
          out.roundUnlockBaseScore = 0;
        } else if (!hasMatchingRoundBase) {
          out.roundUnlockBaseScore = Math.max(0, out.totalScore - unlockScoreForStage(storedUnlockedStage));
        }
        out.roundUnlockBaseScore = clamp(Math.round(Number(out.roundUnlockBaseScore) || 0), 0, out.totalScore);
        out.roundUnlockRound = out.round;
        out.unlockedStage = highestStageAllowedByScore(roundUnlockScoreFor(out), out.round);
        out.pendingPortalStage = -1;
        out.unlockSystemVersion = UNLOCK_SYSTEM_VERSION;
        needsProgressResave = true;
      } else if (!hasMatchingRoundBase) {
        // 防御性修复：轮次与解锁基准不一致时，从当前总分开启该轮并重锁第4关以后。
        resetRoundUnlockProgress(out, out.round, out.totalScore);
        out.unlockSystemVersion = UNLOCK_SYSTEM_VERSION;
        needsProgressResave = true;
      } else {
        out.roundUnlockBaseScore = clamp(Math.round(Number(out.roundUnlockBaseScore) || 0), 0, out.totalScore);
        out.roundUnlockRound = out.round;
        out.unlockedStage = clampStageIndex(Math.max(MIN_UNLOCKED_STAGE, Number(out.unlockedStage) || MIN_UNLOCKED_STAGE));
        out.pendingPortalStage = Number(out.pendingPortalStage) >= 0 ? clampStageIndex(out.pendingPortalStage) : -1;
      }

      if (recoveredPendingRound) out.unlockSystemVersion = UNLOCK_SYSTEM_VERSION;
      if (out.tutorialSeen && clampStageIndex(out.currentStage) > out.unlockedStage) out.currentStage = MAIN_STAGE_START;
      if (!isFinite(Number(out.lastCelebratedUnlockStage))) {
        out.lastCelebratedUnlockStage = clampStageIndex(Math.max(
          MIN_UNLOCKED_STAGE,
          Math.min(clampStageIndex(out.currentStage), clampStageIndex(out.unlockedStage))
        ));
      } else {
        out.lastCelebratedUnlockStage = clampStageIndex(Math.max(
          MIN_UNLOCKED_STAGE,
          Math.min(Number(out.lastCelebratedUnlockStage) || MIN_UNLOCKED_STAGE, Number(out.unlockedStage) || MIN_UNLOCKED_STAGE)
        ));
      }
      // 第2轮起所有关卡直接可玩，无需解锁进度。
      if (out.round >= 2) {
        out.unlockedStage = clampStageIndex(STAGES.length - 1);
        out.lastCelebratedUnlockStage = clampStageIndex(STAGES.length - 1);
        out.firstThreeCleared = FIRST_SEQUENCE_FORMAL_COUNT;
      }
      if (needsProgressResave) {
        try { wx.setStorageSync(PROGRESS_KEY, out); } catch (ignoreProgressMigrationSave) {}
      }
      return out;
    }
    function saveProgress() { try { wx.setStorageSync(PROGRESS_KEY, progress); } catch(e) {} }
    function markFirstSequenceStageCleared(index) {
      if (currentRoundNumber() !== 1 || FIRST_SEQUENCE_FORMAL_COUNT <= 0) return false;
      var formalNo = formalStageNumber(index);
      var cleared = firstSequenceClearedCount(progress);
      if (formalNo < 1 || formalNo > FIRST_SEQUENCE_FORMAL_COUNT || formalNo !== cleared + 1) return false;
      progress.firstThreeCleared = formalNo;
      saveProgress();
      return true;
    }

    function refreshScoreUnlocks(allowRelock) {
      var scoreStage = highestStageAllowedByScore(currentRoundUnlockScore());
      var before = clampStageIndex(Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE));
      var after = allowRelock ? scoreStage : Math.max(before, scoreStage);
      progress.unlockedStage = clampStageIndex(after);
      progress.roundUnlockRound = currentRoundNumber();
      progress.roundUnlockBaseScore = roundUnlockBaseScoreFor(progress);
      progress.unlockSystemVersion = UNLOCK_SYSTEM_VERSION;
      if (after > before) progress.pendingPortalStage = after;
      if (allowRelock && after < before) progress.pendingPortalStage = -1;
      saveProgress();
      if (after > before && typeof maybeSpawnPortal === 'function') maybeSpawnPortal(true);
      return after;
    }

    function localDayKey(ts) {
      var d = new Date(ts || nowMs());
      return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    }
    function createEconomyState() {
      return { dayKey: localDayKey(), dailyPlays: DAILY_FREE_PLAYS, recoveredPlay: 0, recoverAt: 0, dailyShareRevives: DAILY_SHARE_REVIVES, dailyAdPlays: DAILY_AD_PLAYS };
    }
    function sanitizeEconomyState(value) {
      value = value && typeof value === 'object' ? value : {};
      return {
        dayKey: String(value.dayKey || localDayKey()),
        dailyPlays: clamp(Math.round(Number(value.dailyPlays) || 0), 0, DAILY_FREE_PLAYS),
        recoveredPlay: clamp(Math.round(Number(value.recoveredPlay) || 0), 0, 1),
        recoverAt: Math.max(0, Number(value.recoverAt) || 0),
        dailyShareRevives: clamp(Math.round(Number(value.dailyShareRevives) || 0), 0, DAILY_SHARE_REVIVES),
        dailyAdPlays: clamp(Math.round(Number(value.dailyAdPlays) || 0), 0, DAILY_AD_PLAYS)
      };
    }
    function loadEconomyState() {
      try {
        var stored = wx.getStorageSync(ECONOMY_KEY);
        if (stored && typeof stored === 'object') return sanitizeEconomyState(stored);
      } catch (e) {}
      return createEconomyState();
    }
    function saveEconomyState() { try { wx.setStorageSync(ECONOMY_KEY, economyState); } catch (e) {} }
    // 2026-09-29：首页「目前体力」冷却钟持久化——recoverAt=冷却截止时间；0=无冷却。
    function setRecoveryClock(untilMs) {
      economyState.recoverAt = Math.max(0, Math.round(Number(untilMs) || 0));
      saveEconomyState();
    }
    function refreshEconomyState(ts) {
      var t = Number(ts) || nowMs(), changed = false;
      var today = localDayKey(t);
      if (!economyState || economyState.dayKey !== today) {
        economyState = createEconomyState();
        economyState.dayKey = today;
        changed = true;
      }
      // 新规则：每日仅 1 次游戏机会（含 1 命）。生命用尽后通过死亡弹窗的「看广告 / 分享好友 / 消耗黄金番薯 / 20 分钟冷却」补充。
      // 不再在此自动恢复“游戏次数”（recoveredPlay）。
      if (changed) saveEconomyState();
      return economyState;
    }
    function economyView() {
      refreshEconomyState();
      var now = nowMs();
      var remainMs = economyState.recoverAt > 0 ? Math.max(0, economyState.recoverAt - now) : 0;
      // 2026-09-29：真正的冷却钟在 rewardDialog.cooldownUntil（死亡开窗自动启动 20 分钟），一并纳入首页「恢复中」倒计时。
      if (remainMs <= 0 && rewardDialog.cooldownUntil > now) remainMs = rewardDialog.cooldownUntil - now;
      return {
        dailyPlays: economyState.dailyPlays,
        recoveredPlay: economyState.recoveredPlay,
        availablePlays: economyState.dailyPlays + economyState.recoveredPlay,
        recoverAt: economyState.recoverAt,
        recoveryDone: economyState.recoverAt > 0 && now >= economyState.recoverAt, // 20 分钟冷却已走完 → 首页直接绿字「满血复活!」
        recoverSeconds: Math.ceil(remainMs / 1000),
        dailyFreePlays: DAILY_FREE_PLAYS,
        livesPerPlay: LIVES_PER_PLAY,
        dailyShareRevives: economyState.dailyShareRevives,
        dailyShareRevivesMax: DAILY_SHARE_REVIVES,
        dailyAdPlays: economyState.dailyAdPlays,
        dailyAdPlaysMax: DAILY_AD_PLAYS
      };
    }
    function consumePlayEnergy() {
      refreshEconomyState();
      if (economyState.dailyPlays > 0) economyState.dailyPlays -= 1;
      else if (economyState.recoveredPlay > 0) economyState.recoveredPlay = 0;
      else return false;
      saveEconomyState();
      return true;
    }
    function grantAdPlay() {
      refreshEconomyState();
      economyState.recoveredPlay = 1;
      economyState.recoverAt = 0;
      saveEconomyState();
      return true;
    }
    // —— 每日福利 / 黄金番薯库存（本地持久化；每日登录 + 每日任务产出，死亡时消耗复活）——
    function createGiftState() {
      return {
        dayKey: localDayKey(), loginClaimedDay: '', tasks: {},
        potatoBank: 0, totalEarned: 0,
        // 连续登录：streak 为当前连续天数，lastLoginDay 为最近领过的日期，streak7Day 记录最近一次发过 7 天大奖的日期
        loginStreak: 0, lastLoginDay: '', streak7Day: ''
      };
    }
    function sanitizeGiftState(value) {
      value = value && typeof value === 'object' ? value : {};
      var tasks = value.tasks && typeof value.tasks === 'object' ? value.tasks : {};
      return {
        dayKey: String(value.dayKey || localDayKey()),
        loginClaimedDay: String(value.loginClaimedDay || ''),
        tasks: {
          play_run: String(tasks.play_run || ''),
          clear_level: String(tasks.clear_level || ''),
          share: String(tasks.share || '')
        },
        potatoBank: Math.max(0, Math.round(Number(value.potatoBank) || 0)),
        totalEarned: Math.max(0, Math.round(Number(value.totalEarned) || 0)),
        loginStreak: Math.max(0, Math.round(Number(value.loginStreak) || 0)),
        lastLoginDay: String(value.lastLoginDay || ''),
        streak7Day: String(value.streak7Day || '')
      };
    }
    function loadGiftState() {
      try {
        var stored = wx.getStorageSync(GIFT_KEY);
        if (stored && typeof stored === 'object') return sanitizeGiftState(stored);
      } catch (e) {}
      return createGiftState();
    }
    function saveGiftState() { try { wx.setStorageSync(GIFT_KEY, giftState); } catch (e) {} }
    function refreshGiftState() {
      if (!giftState) giftState = loadGiftState();
      var today = localDayKey();
      // 跨天只需更新 dayKey；登录/任务记录按日期字符串比对，自然失效即为次日可再领。
      if (giftState.dayKey !== today) { giftState.dayKey = today; saveGiftState(); }
      return giftState;
    }
    function goldenPotatoBank() { return refreshGiftState().potatoBank; }
    function grantGoldenPotato(count, label, silent) {
      count = Math.max(1, Math.round(Number(count) || 1));
      refreshGiftState();
      giftState.potatoBank += count;
      giftState.totalEarned += count;
      saveGiftState();
      syncGiftToCloud();
      triggerHaptic('light');
      if (!silent) showToastMessage((label ? label + '：' : '') + '黄金番薯 +' + count + '（库存 ' + giftState.potatoBank + '）');
      return giftState.potatoBank;
    }
    function spendGoldenPotato(count) {
      count = Math.max(1, Math.round(Number(count) || 1));
      refreshGiftState();
      if (giftState.potatoBank < count) return false;
      // 2026-09-29 v2：本地先扣（同步返回，不阻塞复活/购买流程），云端原子校验扣减为权威。
      giftState.potatoBank -= count;
      saveGiftState();
      if (giftCloudEnabled() && giftCloudReady && typeof wx !== 'undefined' && wx.cloud && wx.cloud.callFunction) {
        try {
          wx.cloud.callFunction({
            name: 'account',
            data: { action: 'spend', count: count },
            success: function(res) {
              var p = res && res.result ? res.result : res;
              if (p && p.ok === true) {
                // 以服务端扣减结果为准（防止双设备同时消耗）
                giftState.potatoBank = Math.max(0, Math.round(Number(p.potatoBank) || 0));
                giftState.totalEarned = Math.max(0, Math.round(Number(p.totalEarned) || 0));
                saveGiftState();
                refreshMenuStatusPopupBank();
              } else if (p && p.code === 'insufficient') {
                // 云端余额不足（可能在其他设备消耗过）：回滚本地为云端权威值
                giftState.potatoBank = Math.max(0, Math.round(Number(p.potatoBank) || 0));
                saveGiftState();
                showToastMessage('黄金番薯余额已同步云端：库存 ' + giftState.potatoBank);
              }
              // 网络类失败：保留本地扣减（离线兜底），下次 get 会校正
            },
            fail: function() { /* 离线兜底：本地扣减有效 */ }
          });
        } catch (e) {}
      }
      return true;
    }
    // 计算两个 dayKey 是否相差 1 天（用于连续登录判定）
    function dayKeyDiffDays(a, b) {
      var da = Date.parse(String(a || '') + 'T00:00:00');
      var db = Date.parse(String(b || '') + 'T00:00:00');
      if (isNaN(da) || isNaN(db)) return 999;
      return Math.round((db - da) / 86400000);
    }
    // 每日登录奖励：每天首次进入游戏自动发放；连续登录第 7 天额外 +5。
    // 2026-09-29 重构：云端可用时走服务端台账（按 openid+日期幂等，清缓存也无法重复领）；
    // 云端不可用才本地兜底。旧本地发放逻辑是「清缓存刷番薯」漏洞的根源。
    function localClaimDailyLogin(today) {
      // 连续登录天数：昨天领过 → +1；否则从 1 重新计
      var diff = dayKeyDiffDays(giftState.lastLoginDay, today);
      giftState.loginStreak = (diff === 1) ? (giftState.loginStreak + 1) : 1;
      giftState.lastLoginDay = today;

      var streak = giftState.loginStreak;
      // 连续满 7 天的大奖：每连续 7 天发一次（第 7、14、21… 天各发一次），每日只发一次
      var hitStreak7 = streak >= 7 && (streak % 7 === 0) && giftState.streak7Day !== today;
      if (hitStreak7) giftState.streak7Day = today;
      saveGiftState();

      // [2026-10-31 需求3] 网页端每次登入固定 5 颗：不累加，直接把库存重置为 5。
      giftState.potatoBank = KIOSK_LOGIN_POTATO;
      giftState.totalEarned = Math.max(KIOSK_LOGIN_POTATO, Math.round(Number(giftState.totalEarned) || 0));
      saveGiftState();
      dailyLoginPopup.pending = true;
      dailyLoginPopup.active = false;
      syncGiftToCloud();
    }
    function claimDailyLogin(cb) {
      var done2 = function () { if (typeof cb === 'function') { try { cb(); } catch (e) {} } };
      refreshGiftState();
      var today = localDayKey();
      if (giftState.loginClaimedDay === today) { done2(); return false; }
      // 本会话先行占位，防止异步期间重复触发
      giftState.loginClaimedDay = today;
      saveGiftState();
      if (giftCloudEnabled() && giftCloudReady && typeof wx !== 'undefined' && wx.cloud && wx.cloud.callFunction) {
        try {
          wx.cloud.callFunction({
            name: 'account',
            data: { action: 'claim_login' },
            success: function(res) {
              var p = res && res.result ? res.result : res;
              if (p && p.ok === true) {
                // 服务端为权威台账：直接覆盖本地镜像（绝不再取 Math.max，
                // 否则本地测试期污染值永远赢过云端 → 51/52 颗反复出现）
                giftState.potatoBank = Math.max(0, Math.round(Number(p.potatoBank) || 0));
                giftState.totalEarned = Math.max(0, Math.round(Number(p.totalEarned) || 0));
                giftState.loginStreak = Math.max(1, Math.round(Number(p.streak) || 1));
                giftState.lastLoginDay = today;
                if (p.hit7) giftState.streak7Day = today;
                saveGiftState();
                clearPendingGiftSync();
                if (Number(p.granted) > 0) {
                  dailyLoginPopup.pending = true;
                  dailyLoginPopup.active = false;
                }
                refreshMenuStatusPopupBank();
              } else {
                // 2026-10-05 诊断增强：claim_login 返回非 ok（多为 account 云函数部署的是旧版）。
                try { console.warn('[gift] account.claim_login 返回非 ok，走本地兜底：', JSON.stringify(p)); } catch (e) {}
                localClaimDailyLogin(today); // 云端异常 → 本地兜底
              }
              done2();
            },
            fail: function(err) {
              try { console.warn('[gift] account.claim_login 调用失败，走本地兜底：', err && err.errMsg ? err.errMsg : err); } catch (e) {}
              localClaimDailyLogin(today);
              done2();
            }
          });
        } catch (e) { localClaimDailyLogin(today); done2(); }
        return true;
      }
      localClaimDailyLogin(today);
      done2();
      return true;
    }
    // 每日任务：完成即发（每天每个任务限 1 次，各 +1 黄金番薯，次日自动重置）
    var DAILY_TASKS = [
      { id: 'play_run', label: '完成 1 局游戏', reward: 1 },
      { id: 'clear_level', label: '通关 1 个关卡', reward: 1 },
      { id: 'share', label: '分享给好友 1 次', reward: 1 }
    ];
    function creditDailyTask(taskId) {
      var def = null;
      for (var i = 0; i < DAILY_TASKS.length; i++) { if (DAILY_TASKS[i].id === taskId) { def = DAILY_TASKS[i]; break; } }
      if (!def) return false;
      refreshGiftState();
      var today = localDayKey();
      if (giftState.tasks[taskId] === today) return false; // 今日已完成
      // 本会话先行占位，防止异步期间重复触发
      giftState.tasks[taskId] = today;
      saveGiftState();
      // 2026-09-29 v2：云端可用走服务端台账（openid+taskId+日期幂等，清缓存也刷不了），
      // 失败才本地兜底发放。
      if (giftCloudEnabled() && giftCloudReady && typeof wx !== 'undefined' && wx.cloud && wx.cloud.callFunction) {
        try {
          wx.cloud.callFunction({
            name: 'account',
            data: { action: 'credit_task', taskId: taskId },
            success: function(res) {
              var p = res && res.result ? res.result : res;
              if (p && p.ok === true) {
                // 服务端为权威台账：直接覆盖本地镜像
                giftState.potatoBank = Math.max(0, Math.round(Number(p.potatoBank) || 0));
                giftState.totalEarned = Math.max(0, Math.round(Number(p.totalEarned) || 0));
                saveGiftState();
                clearPendingGiftSync();
                if (Number(p.granted) > 0) {
                  // 2026-10-10：过关任务改结算飘字（用户指定文案，两行），其余任务保留 Toast。
                  if (taskId === 'play_run') activatePlayRewardBanner();
                  else showToastMessage('任务完成 · ' + def.label + '：黄金番薯 +' + p.granted + '（库存 ' + giftState.potatoBank + '）');
                  refreshMenuStatusPopupBank();
                }
              } else if (taskId === 'play_run') {
                grantGoldenPotato(Math.max(1, def.reward), '', true); // 云端异常 → 本地兜底（静默，用飘字提示）
                activatePlayRewardBanner();
              } else {
                grantGoldenPotato(Math.max(1, def.reward), '任务完成 · ' + def.label); // 云端异常 → 本地兜底
              }
            },
            fail: function() {
              if (taskId === 'play_run') { grantGoldenPotato(Math.max(1, def.reward), '', true); activatePlayRewardBanner(); }
              else grantGoldenPotato(Math.max(1, def.reward), '任务完成 · ' + def.label);
            }
          });
        } catch (e) {
          if (taskId === 'play_run') { grantGoldenPotato(Math.max(1, def.reward), '', true); activatePlayRewardBanner(); }
          else grantGoldenPotato(Math.max(1, def.reward), '任务完成 · ' + def.label);
        }
        return true;
      }
      if (taskId === 'play_run') { grantGoldenPotato(Math.max(1, def.reward), '', true); activatePlayRewardBanner(); }
      else grantGoldenPotato(Math.max(1, def.reward), '任务完成 · ' + def.label);
      return true;
    }
    var giftState = null;

    function cloneOwnedSkins(owned) {
      // 2026-10-10 修正：白名单改为按 SKIN_DEFS 动态生成 —— 旧硬编码 {classic,spider,bat,potato}
      // 不含 bainiangzi/xiaoqing，loadSkinState→sanitize 时会把存档里的蛇娘 owned 剔掉，
      // 导致 equipped 被强制回退 classic（线下网页版 shim 每次重置存档，必现）。
      var out = {};
      for (var i = 0; i < SKIN_DEFS.length; i++) out[SKIN_DEFS[i].id] = false;
      owned = owned && typeof owned === 'object' ? owned : {};
      for (var key in out) if (Object.prototype.hasOwnProperty.call(owned, key)) out[key] = !!owned[key] || key === 'classic';
      if (SKIN_TEST_UNLOCK_ALL) for (var k2 in out) out[k2] = true;
      out.classic = true;
      return out;
    }
    function createSkinState() {
      return {
        equipped: 'classic',
        owned: cloneOwnedSkins({ classic: true }),
        unlockedAt: {}
      };
    }
    function sanitizeSkinState(value) {
      value = value && typeof value === 'object' ? value : {};
      var out = createSkinState();
      out.equipped = String(value.equipped || 'classic');
      out.owned = cloneOwnedSkins(value.owned);
      out.unlockedAt = value.unlockedAt && typeof value.unlockedAt === 'object' ? clone(value.unlockedAt) : {};
      if (!out.owned[out.equipped]) out.equipped = 'classic';
      return out;
    }
    function loadSkinState() {
      try {
        var stored = wx.getStorageSync(SKIN_KEY);
        if (stored && typeof stored === 'object') return sanitizeSkinState(stored);
      } catch (e) {}
      return createSkinState();
    }
    function saveSkinState() { try { wx.setStorageSync(SKIN_KEY, skinState); } catch (e) {} }
    function getSkinDef(id) {
      id = String(id || 'classic');
      for (var i = 0; i < SKIN_DEFS.length; i++) if (SKIN_DEFS[i].id === id) return SKIN_DEFS[i];
      return SKIN_DEFS[0];
    }
    function activeSkinId() {
      if (!skinState || !skinState.owned || !skinState.owned[skinState.equipped]) return 'classic';
      return String(skinState.equipped || 'classic');
    }
    function activeSkinDef() { return getSkinDef(activeSkinId()); }
    function currentSpriteManifest() {
      var skinId = activeSkinId();
      if (skinSpriteManifests[skinId]) return skinSpriteManifests[skinId];
      return sprite.manifest || {};
    }
    function ownSkin(id) {
      id = String(id || 'classic');
      return !!(skinState && skinState.owned && skinState.owned[id]);
    }
    function isSpiderSkinActive() { return activeSkinId() === 'spider'; }
    function isBatSkinActive() { return activeSkinId() === 'bat'; }
    function isPotatoSkinActive() { return activeSkinId() === 'potato'; }
    function isBainiangziSkinActive() { return activeSkinId() === 'bainiangzi'; }
    function isXiaoqingSkinActive() { return activeSkinId() === 'xiaoqing'; }
    // 2026-10-08：蛇娘（白娘子 / 小青）共用一套「脚下白云」放屁特效，其余皮肤保持原黄绿气体。
    function isSnakeMaidSkinActive() {
      var id = activeSkinId();
      return id === 'bainiangzi' || id === 'xiaoqing';
    }
    // 2026-10-05：移除「蛇娘首鸦掉头」行为，乌鸦恢复正常（不再为白娘子/小青让路）。
    function isPotatoPhaseActive() {
      return isPotatoSkinActive() && player && (Number(player.fartBoostTimer) || 0) > 0;
    }
    // 2026-10-05 新增：薯王被动能力「黄金番薯磁力吸附」。
    // 薯王靠近黄金番薯（距离 ≤ 一个身长）时，黄金番薯自动被磁力拉向薯王并拾取。
    var POTATO_MAGNET_RADIUS = 110;   // 磁力半径 = 一个身长（玩家绘制身长约 108px，留 2px 余量）
    var POTATO_MAGNET_SPEED = 560;    // 吸附最大速度 px/s（范围内越近越快，d→0 时满速）
    function isPotatoMagnetActive() {
      return isPotatoSkinActive() && scene === 'playing';
    }
    function updatePotatoMagnet(motionDt) {
      if (!isPotatoMagnetActive()) return;
      var R = POTATO_MAGNET_RADIUS;
      var list = querySpatial('foods', player.x - R, player.x + R, spatialMagnetQuery);
      for (var i = 0; i < list.length; i++) {
        var f = list[i];
        if (!f || f.collected) continue;
        if (!(f.skillItem || f.kind === 'golden_sweet_potato')) continue; // 仅黄金番薯被吸附
        f.magnetized = false;
        var fx = f.x, fy = f.y + Math.sin(nowSec() * 4 + f.x * 0.01) * 4;
        var dx = player.x - fx, dy = player.y - fy;
        var d = Math.hypot(dx, dy);
        if (d > R || d < 0.001) continue;
        // 范围内：朝薯王拉（越近越快），把它吸到身上后由拾取循环收掉
        var step = Math.min(d, POTATO_MAGNET_SPEED * (1 - d / R) * motionDt);
        f.x += dx / d * step;
        f.y += dy / d * step;
        f.magnetized = true;
      }
    }
    // 2026-10-05 蝠侠能力「滑翔」（改版）：不再由按住按钮触发。
    // 触发条件：蝠侠飞出画面上缘（cameraY 固定为 0，故 world y = screen y，player.y<0 即出框）
    // → 下降回到画面中部时自动启动滑翔；滑翔持续「缓慢前飞 + 缓慢下降」，直到挂上锚点（使用舌头）才恢复正常摆荡。
    var BAT_GLIDE_FORWARD = 205;   // 滑翔前进速度 px/s（缓慢）
    var BAT_GLIDE_DESCENT = 46;    // 滑翔下降速度 px/s（缓慢）
    var BAT_GLIDE_TURN = 2.6;      // 速度趋近平滑系数（越大越快进入滑翔态）
    var BAT_GLIDE_ARM_TOP = 0;     // 出框阈值：player.y < 此值即「超过画面上缘出框」
    var BAT_GLIDE_START_Y = VIEW_H * 0.5; // 启动阈值：下降到 player.y >= 此值（画面中部）时自动启动滑翔
    function isBatGlideActive() {
      return isBatSkinActive() && scene === 'playing' && !isSnakeFormActive()
        && player && player.attachIndex === null && (Number(player.gliding) || 0) > 0;
    }
    function updateBatGlide(dt, motionDt) {
      if (!player) return;
      // 非蝠侠皮肤 / 非玩法 / 变蛇 → 清状态
      if (!isBatSkinActive() || scene !== 'playing' || isSnakeFormActive()) {
        player.gliding = 0; player.glideArmed = 0; return;
      }
      // 挂上锚点（使用舌头）→ 立即恢复正常摆荡，滑翔结束
      if (player.attachIndex !== null) { player.gliding = 0; player.glideArmed = 0; return; }

      // 自动触发：先出框（顶缘之上），再下降到画面中部
      if (player.y < BAT_GLIDE_ARM_TOP) {
        player.glideArmed = 1;                 // 已飞出画面上缘，蓄势
      }
      if (player.glideArmed && player.y >= BAT_GLIDE_START_Y) {
        if (!player.gliding) {
          // 下降到画面中：启动滑翔（仅给一点上扬初速，无文字提示）
          player.gliding = 1;
          player.vy = Math.min(player.vy, -10);
          try { playTongueSound('attach'); } catch (e) {}
          triggerHaptic('light');
        }
        player.glideArmed = 0;                 // 一次性消费
      }

      if (!player.gliding) return;             // 尚未进入滑翔：走正常物理

      // 缓慢下降：把 vy 平滑压到滑翔下降速率（带轻微正弦起伏，像扇翅）
      var flap = Math.sin(player.animTime * 9) * 8;
      var targetVy = BAT_GLIDE_DESCENT + flap;
      player.vy += (targetVy - player.vy) * Math.min(1, BAT_GLIDE_TURN * dt);
      // 往前缓慢飞：沿当前朝向（faceDir）平滑拉到滑翔前进速率。
      // 不固定推向 +x：否则原本向左运动的玩家会被瞬间拽向右、脸也翻转，手感突兀。
      // faceDir 由上一帧 vx 推导（faceDir = vx >= -12 ? 1 : -1），且画速度线也用它，方向天然一致。
      var glideDir = (Number(player.faceDir) || 1) >= 0 ? 1 : -1;
      player.vx += (BAT_GLIDE_FORWARD * glideDir - player.vx) * Math.min(1, BAT_GLIDE_TURN * dt);
      player.mouthOpen = Math.max(player.mouthOpen, 0.35);
    }
    // —— 皮肤能力：把「会被皮肤改写的规则」集中在这里，避免在多处散落 if (skin === ...) ——
    // 2026-10-01：白娘子「水波牵引」/ 小青「青影疾走」已替换为「水漫金山」/「超级贪吃」，
    // 这两条被动加成随之取消（不再有皮肤改写拾取半径与悬挂时长）。
    function foodPickupBonus() { return 0; }
    function tongueFailSeconds() { return TONGUE_FAIL_SECONDS; }
    function comboWindowSeconds() { return COMBO_WINDOW_SECONDS; }
    // 白娘子·水漫金山：本关是否还有「落地不死」的喷泉机会。
    function hasFloodFountain() { return isBainiangziSkinActive() && !floodFountainUsed; }
    // 小青·超级贪吃：长按锚定时自动连吃附近食物。
    function greedyTongueActive() { return isXiaoqingSkinActive(); }
    // —— 关卡判定：杭州关统一用 cityId，别靠中文名或序号字面量 ——
    function currentCityId() { return String((runtimeLevel && runtimeLevel.cityId) || ''); }
    function isHangzhouStage() { return currentCityId() === 'hangzhou'; }
    function isSnakeFormActive() { return !!(snakeForm && snakeForm.active); }
    // 变蛇条件（2026-10-10 放宽：不再限杭州关 —— 用户要求蛇娘皮肤在任何关卡吃到雄黄酒都能变蛇）：
    // 穿戴白娘子/小青 + 非教学关 + 吃到雄黄酒。
    function canTransformSnake() { return !isTutorialStage() && (isBainiangziSkinActive() || isXiaoqingSkinActive()); }
    function snakeKindForSkin() { return isXiaoqingSkinActive() ? 'qing' : 'bai'; }
    function markSkinUnlocked(id) {
      if (!skinState.owned[id]) {
        skinState.owned[id] = true;
        skinState.unlockedAt[id] = nowMs();
        saveSkinState();
      }
      return true;
    }
    function equipSkin(id) {
      id = String(id || 'classic');
      if (!ownSkin(id)) return false;
      skinState.equipped = id;
      saveSkinState();
      ensureSkinArt(id);   // 切到有专属美术的皮肤时立刻开始解码，避免游戏内出现空档
      return true;
    }
    // —— 「无条件开放」的皮肤补进 owned（2026-09-30 修复「白娘子/小青无法穿戴」）——
    // 背景：unlock.type === 'free' 只影响 getSkinRequirementStatus 的文案，
    // 并不会让皮肤落进 skinState.owned。于是面板按钮按 selected.owned 判断会画成灰色
    // （render 里 `selected.owned ? 金色 : rgba(255,255,255,.13)`），
    // 且 triggerSkinCardAction 走 'equip' → equipSkin() 因 !ownSkin(id) 直接 return false —— 点了没反应。
    // 这里在启动时把 free 皮肤视为天然拥有（用户要求「开放，可以真实使用」）。
    // 只补不删：日后把 unlock 改回 golden_potato / login_streak，已经拿到的皮肤不会被收回。
    function syncFreeSkinOwnership() {
      var changed = false;
      for (var i = 0; i < SKIN_DEFS.length; i++) {
        var def = SKIN_DEFS[i];
        if (!def || skinState.owned[def.id]) continue;
        if (!def.unlock || def.unlock.type !== 'free') continue;
        skinState.owned[def.id] = true;
        skinState.unlockedAt[def.id] = nowMs();
        changed = true;
      }
      if (changed) saveSkinState();
      return changed;
    }
    function getSkinRequirementStatus(def) {
      def = def || getSkinDef('classic');
      var unlock = def.unlock || { type: 'free' };
      if (SKIN_TEST_UNLOCK_ALL) return { mode: 'test_open', met: true, progressText: '测试版 · 已解锁', actionLabel: ownSkin(def.id) ? '使用' : '解锁' };
      var streak = Math.max(0, Number(refreshGiftState().loginStreak) || 0);
      var bank = Math.max(0, goldenPotatoBank());
      if (unlock.type === 'free') return { mode: 'free', met: true, progressText: '默认开放', actionLabel: ownSkin(def.id) ? '使用中' : '使用' };
      if (unlock.type === 'login_streak') {
        var days = Math.max(1, Math.round(Number(unlock.days) || 1));
        return {
          mode: 'login_streak',
          met: streak >= days,
          current: streak,
          target: days,
          progressText: '连续登入 ' + streak + '/' + days + ' 天',
          actionLabel: streak >= days ? '解锁' : '未达成'
        };
      }
      if (unlock.type === 'golden_potato') {
        var cost = Math.max(1, Math.round(Number(unlock.cost) || 1));
        return {
          mode: 'golden_potato',
          met: bank >= cost,
          current: bank,
          target: cost,
          cost: cost,
          progressText: '黄金番薯 ' + bank + '/' + cost,
          actionLabel: bank >= cost ? ('消耗 ' + cost + ' 解锁') : '番薯不足'
        };
      }
      if (unlock.type === 'venue_grant') {
        var vOwned = ownSkin(def.id);
        return {
          mode: 'venue_grant',
          met: vOwned,
          progressText: vOwned ? '已通过现场扫码获得' : '杭州现场扫码解锁',
          actionLabel: vOwned ? '解锁' : '现场扫码解锁'
        };
      }
      return { mode: 'locked', met: false, progressText: '敬请期待', actionLabel: '未开放' };
    }
    function skinCardView(def) {
      def = def || SKIN_DEFS[0];
      var owned = ownSkin(def.id);
      var equipped = activeSkinId() === def.id;
      var req = getSkinRequirementStatus(def);
      var actionLabel = '';
      var actionMode = 'disabled';
      if (owned) {
        actionLabel = equipped ? '使用中' : '使用';
        actionMode = equipped ? 'equipped' : 'equip';
      } else if (req.mode === 'login_streak') {
        actionLabel = req.met ? '解锁' : '未达成';
        actionMode = req.met ? 'unlock' : 'disabled';
      } else if (req.mode === 'golden_potato') {
        actionLabel = req.met ? ('消耗 ' + req.cost + ' 解锁') : '番薯不足';
        actionMode = req.met ? 'buy' : 'disabled';
      } else if (req.mode === 'free') {
        actionLabel = '使用';
        actionMode = 'equip';
      } else if (req.mode === 'venue_grant') {
        actionLabel = '杭州现场扫码';
        actionMode = 'disabled';
      } else if (req.mode === 'test_open') {
        // 测试期全开（SKIN_TEST_UNLOCK_ALL）：未拥有的皮肤给「解锁」按钮而不是置灰，
        // 点一下即 markSkinUnlocked + equipSkin（旧版漏了这个分支 → 按钮灰、点不动）。
        actionLabel = '解锁';
        actionMode = 'unlock';
      }
      // [2026-10-31] 需求8/116 商业化：定价皮肤（price>0）未拥有时，主按钮变成「购买」，
      // 点击走 requestSkinPurchase 支付桩（当前按策略仍免费解锁，支付接通后在此扣款）。
      if (!owned && def.price > 0) {
        actionLabel = '¥' + def.price + ' 购买';
        actionMode = 'purchase';
      }
      var previews = [{ type: 'portrait', label: '站姿' }];
      var _aux = (typeof SKIN_AUX_SPECS !== 'undefined' && SKIN_AUX_SPECS[def.id]) || {};
      ['curl', 'victory', 'fart', 'glide'].forEach(function (_k) {
        if (_aux[_k]) {
          previews.push({ type: _k, label: _k === 'curl' ? '翻滚' : _k === 'victory' ? '过关' : _k === 'fart' ? '放屁' : '滑翔' });
        }
      });
      return {
        id: def.id,
        name: def.name,
        title: def.title,
        description: def.description,
        abilityType: def.abilityType,
        accentA: def.accentA,
        accentB: def.accentB,
        accentC: def.accentC,
        owned: owned,
        equipped: equipped,
        actionLabel: actionLabel,
        actionMode: actionMode,
        progressText: req.progressText,
        price: (def.price || 0),   // [2026-10-31] 需求8/116：皮肤售价（¥），0 表示未定价/免费
        previews: previews   // [2026-10-31] 需求5：面板展示该角色的各种图片（站姿/翻滚/过关/放屁/滑翔）
      };
    }
    function buildSkinCardsView() {
      var out = [];
      for (var i = 0; i < SKIN_DEFS.length; i++) out.push(skinCardView(SKIN_DEFS[i]));
      return out;
    }
    function skinIndexById(id) {
      id = String(id || 'classic');
      for (var i = 0; i < SKIN_DEFS.length; i++) if (SKIN_DEFS[i].id === id) return i;
      return 0;
    }
    function normalizeSkinPanelIndex(value) {
      var count = Math.max(1, SKIN_DEFS.length);
      value = Math.round(Number(value) || 0);
      return ((value % count) + count) % count;
    }
    // 把任意距离折算到最短环绕路径，避免为了相邻一张卡而滚过一整圈。
    function shortestWheelDelta(delta, count) {
      count = Math.max(1, count || 1);
      return delta - count * Math.round(delta / count);
    }
    function skinWheelIndexFromScroll(scroll) {
      return normalizeSkinPanelIndex(Number(scroll) || 0);
    }
    function openSkinPanel() {
      var index = skinIndexById(activeSkinId());
      skinPanelIndex = index;
      // 每次打开都从当前皮肤处落位，且不带残留滚动惯性。
      skinWheelScroll = index;
      skinWheelTargetScroll = index;
      skinWheelDragging = false;
      skinWheelDragArmed = false;
      skinWheelPendingTap = '';
      skinPanelOpen = true;
      stageSelectOpen = false;
      pointerHeld = false;
    }
    function closeSkinPanel() {
      skinPanelOpen = false;
      skinWheelDragging = false;
      skinWheelDragArmed = false;
      skinWheelPendingTap = '';
      skinWheelAutoSpin = false;
    }
    // 每帧把连续滚动位置缓动推向吸附目标；帧率无关阻尼，手感是「快速滑到位 + 轻微收尾」。
    function updateSkinWheel(dt) {
      if (!skinPanelOpen) return;
      if (skinWheelDragging) { skinPanelIndex = skinWheelIndexFromScroll(skinWheelScroll); return; }
      var diff = skinWheelTargetScroll - skinWheelScroll;
      if (Math.abs(diff) < 0.0015) {
        skinWheelScroll = skinWheelTargetScroll;
        skinPanelIndex = skinWheelIndexFromScroll(skinWheelScroll);
        return;
      }
      var step = Math.min(1, Math.max(0.001, Number(dt) || 0) * 60 * 0.24);
      skinWheelScroll += diff * step;
      skinPanelIndex = skinWheelIndexFromScroll(skinWheelScroll);
    }
    // [hangzhou-web kiosk] 人物选择转盘「自动循环转动」。
    // 线下大屏只有一个实体按钮：玩家没法自己滑，所以由网页层（__kioskSelectOpen）打开面板时
    // 开启自动转动，玩家按一下按钮 = 选中当前转到的人物并直接开战。
    // 静默步进（不出声不震动，避免大屏一直在响），与 updateSkinWheel 共用同一套缓动。
    var SKIN_WHEEL_AUTO_SPIN_SECONDS = 2.0;   // [2026-10-31] 需求4：皮肤转盘每 2 秒自动向左旋转到下一张
    var skinWheelAutoSpin = false;
    var skinWheelAutoSpinTimer = 0;
    function setSkinWheelAutoSpin(on) {
      skinWheelAutoSpin = !!on;
      skinWheelAutoSpinTimer = 0;
      return skinWheelAutoSpin;
    }
    function updateSkinWheelAutoSpin(dt) {
      if (!skinWheelAutoSpin || !skinPanelOpen || skinWheelDragging) { skinWheelAutoSpinTimer = 0; return; }
      skinWheelAutoSpinTimer += Number(dt) || 0;
      if (skinWheelAutoSpinTimer < SKIN_WHEEL_AUTO_SPIN_SECONDS) return;
      skinWheelAutoSpinTimer = 0;
      skinWheelTargetScroll = Math.round(skinWheelTargetScroll) + 1;
      skinPanelIndex = skinWheelIndexFromScroll(skinWheelTargetScroll);
    }
    // 关闭钮与穿戴钮「按下即响应」且不参与滚轮；其余区域（含侧卡、箭头）一律可跟手拖拽，
    // 若整段触摸没拖动，再按一次「点击」处理 —— 同一片区域既能点、也能拖。
    function skinWheelPointOnControl(px, py) {
      return pointInHotspot(px, py, uiHotspots.skinPanelClose) ||
             pointInHotspot(px, py, uiHotspots.skinWearButton);
    }
    function beginSkinWheelDrag(px, py) {
      if (!skinPanelOpen) return;
      skinWheelPendingTap = '';
      skinWheelDragArmed = !skinWheelPointOnControl(px, py);
      skinWheelDragging = false;
      skinWheelDragStartX = Number(px) || 0;
      skinWheelDragStartScroll = skinWheelScroll;
    }
    // 侧卡 / 箭头点击：只记录意图，等松手时若未发生拖拽再执行。
    function armSkinWheelTap(direction) {
      skinWheelPendingTap = direction;
    }
    function updateSkinWheelDrag(px) {
      if (!skinPanelOpen || !skinWheelDragArmed) return;
      var dx = (Number(px) || 0) - skinWheelDragStartX;
      if (!skinWheelDragging) {
        if (Math.abs(dx) < SKIN_WHEEL_DRAG_ARM_PX) return;
        skinWheelDragging = true;
        skinWheelPendingTap = '';
        skinWheelAutoSpin = false;   // 玩家真的上手拖了 → 交还控制权，停止自动转动
      }
      skinWheelScroll = skinWheelDragStartScroll - dx / SKIN_WHEEL_DRAG_PX_PER_CARD;
      skinWheelTargetScroll = skinWheelScroll;
      skinPanelIndex = skinWheelIndexFromScroll(skinWheelScroll);
    }
    // 松手吸附到最近一张；返回 true 表示本次触摸已被滚轮消费（不再当作点击处理）。
    function endSkinWheelDrag() {
      var wasArmed = skinWheelDragArmed;
      skinWheelDragArmed = false;
      if (!skinPanelOpen) { skinWheelDragging = false; return false; }
      if (!skinWheelDragging) { skinWheelDragging = false; return false; }
      skinWheelDragging = false;
      var before = skinWheelIndexFromScroll(skinWheelDragStartScroll);
      skinWheelTargetScroll = Math.round(skinWheelScroll);
      skinPanelIndex = skinWheelIndexFromScroll(skinWheelTargetScroll);
      if (before !== skinPanelIndex) { triggerHaptic('light'); playUiClickSound(); }
      return wasArmed;
    }
    function rotateSkinWheel(delta) {
      var step = Number(delta) || 0;
      if (!step) return SKIN_DEFS[skinPanelIndex] || SKIN_DEFS[0];
      // 以吸附目标为基准累加，连续快点时不会因动画未收敛而丢步。
      skinWheelDragging = false;
      skinWheelDragArmed = false;
      skinWheelTargetScroll = Math.round(skinWheelTargetScroll) + step;
      skinPanelIndex = skinWheelIndexFromScroll(skinWheelTargetScroll);
      var def = SKIN_DEFS[skinPanelIndex];
      triggerHaptic('light');
      playUiClickSound();
      return def || SKIN_DEFS[0];
    }
    function centerSkinWheelOn(id) {
      var index = skinIndexById(id);
      // 走最短环绕路径居中，避免为了居中而多滚几圈。
      skinWheelScroll += shortestWheelDelta(index - skinWheelScroll, SKIN_DEFS.length);
      skinWheelTargetScroll = skinWheelScroll;
      skinPanelIndex = index;
      skinWheelDragging = false;
      skinWheelDragArmed = false;
      var def = SKIN_DEFS[index];
      triggerHaptic('light');
      playUiClickSound();
      return def;
    }
    function equipSelectedSkinFromPanel() {
      var def = SKIN_DEFS[normalizeSkinPanelIndex(skinPanelIndex)] || SKIN_DEFS[0];
      if (!def) return false;
      // 2026-09-30 修复：原来这里 `if (!ownSkin(def.id)) return false;` 会让
      // 「无条件开放 / 测试期开放 / 可消耗番薯解锁」的卡片点了毫无反应（也不给任何提示）。
      // 改为统一交给 triggerSkinCardAction，按 card.actionMode 走 equip / unlock / buy 三条分支。
      var ok = triggerSkinCardAction(def.id);
      if (!ok) return false;
      // 2026-09-30 用户要求：「按穿戴后就直接确认成已穿戴后进入游戏」。
      // 穿戴成功（含刚解锁/刚购买）→ 立刻收起皮肤面板并直接进游戏，不再要求玩家再点一次 PLAY。
      closeSkinPanel();
      enterGameAfterSkinConfirm(def);
      return true;
    }
    // 穿戴确认后的去向：
    //   · 从暂停面板换装 → 继续本局（不重开）
    //   · 从首页换装     → 2026-10-05 用户反转 V5.9.5 的「直接进游戏」：
    //     只收起皮肤面板并打开选关界面，由玩家自行选关再开始（不再自动进游戏）。
    function enterGameAfterSkinConfirm(def) {
      if (def && def.id) ensureSkinArt(def.id);
      if (scene === 'paused') { resumeFromPause(); return true; }
      if (scene !== 'menu') return false;
      // 首页换装确认：只打开选关界面，不直接开战。玩家选关后才进游戏。
      menuPromptSeenThisSession = true;
      menuIntroOpen = false;
      dailyLoginPopup.active = false;
      dailyLoginPopup.continueToPlay = false;
      openStageSelect();
      return true;
    }
    // [2026-10-31] 需求8/116 商业化：售卖皮肤的支付入口（预留微信支付桩）。
    // 当前策略：支付未接通，点击购买仍按「免费解锁」放行（用户要求保持免费解锁、预留支付接口）。
    // 接入时：在此发起 wx.requestPayment / 云函数下单，支付成功回调里 markSkinUnlocked(def.id)。
    function requestSkinPurchase(def) {
      def = def || {};
      try { showToastMessage('支付接口接入中 · 本皮肤暂免费解锁'); } catch (e) {}
      return { ok: true, paid: false, price: def.price || 0, id: def.id };
    }
    function triggerSkinCardAction(id) {
      var def = getSkinDef(id);
      if (!def) return false;
      var card = skinCardView(def);
      if (card.actionMode === 'equip') {
        equipSkin(def.id);
        triggerHaptic('light');
        playUiClickSound();
        activateSkinSwitchBanner(def.name + '登场');
        return true;
      }
      if (card.actionMode === 'unlock') {
        markSkinUnlocked(def.id);
        equipSkin(def.id);
        triggerHaptic('medium');
        playUiClickSound();
        activateSkinSwitchBanner(def.name + '登场');
        return true;
      }
      if (card.actionMode === 'buy') {
        var unlock = def.unlock || {};
        var cost = Math.max(1, Math.round(Number(unlock.cost) || 1));
        if (!spendGoldenPotato(cost)) {
          showToastMessage('黄金番薯不足');
          triggerHaptic('light');
          return false;
        }
        markSkinUnlocked(def.id);
        equipSkin(def.id);
        triggerHaptic('medium');
        playUiClickSound();
        activateSkinSwitchBanner(def.name + '登场');
        return true;
      }
      if (card.actionMode === 'purchase') {
        var payResult = requestSkinPurchase(def);
        if (!payResult || !payResult.ok) { triggerHaptic('light'); return false; }
        markSkinUnlocked(def.id);
        equipSkin(def.id);
        triggerHaptic('medium');
        playUiClickSound();
        activateSkinSwitchBanner(def.name + '登场');
        return true;
      }
      triggerHaptic('light');
      if (card.progressText) showToastMessage(card.progressText);
      return false;
    }

    var crowWarningState = { timer: 0, cooldown: 0, title: '危险靠近', y: 0, side: 'right', sawCrow: false };
    var crowOnScreenThisFrame = false; // 本帧是否有乌鸦在画面内（updateCrows 写入，updateCrowWarning 读取）
    function clearCrowWarning() { crowWarningState.timer = 0; crowWarningState.cooldown = 0; crowWarningState.sawCrow = false; }
    function updateCrowWarning(dt) {
      if (!isSpiderSkinActive() || scene !== 'playing') { crowWarningState.timer = 0; crowWarningState.cooldown = 0; crowWarningState.sawCrow = false; return; }
      crowWarningState.cooldown = Math.max(0, Number(crowWarningState.cooldown) - dt);
      if (crowWarningState.timer > 0) {
        if (crowOnScreenThisFrame) {
          crowWarningState.sawCrow = true; // 2026-09-29：乌鸦在画面内 → 冻结计时，预警效果持续显示
        } else if (crowWarningState.sawCrow) {
          crowWarningState.timer = 0;      // 乌鸦已飞离画面 → 效果立刻消失
          crowWarningState.sawCrow = false;
        } else {
          crowWarningState.timer = Math.max(0, Number(crowWarningState.timer) - dt); // 尚未进画面：正常倒计时
        }
      }
    }
    function maybeTriggerCrowWarning(crow) {
      if (!isSpiderSkinActive() || scene !== 'playing' || !crow || crowWarningState.timer > 0 || crowWarningState.cooldown > 0) return;
      var futureX = Number(crow.x) + Number(crow.vx || 0) * SPIDER_WARNING_LOOKAHEAD_SECONDS;
      var rightEdge = cameraX + VIEW_W;
      if (Number(crow.x) > rightEdge + 6 && futureX <= rightEdge + 18) {
        crowWarningState.timer = SPIDER_WARNING_SECONDS;
        crowWarningState.cooldown = SPIDER_WARNING_COOLDOWN_SECONDS;
        crowWarningState.sawCrow = false;
        // 2026-09-29：记录乌鸦将出现的高度与来向，供渲染端画指向箭头。
        crowWarningState.y = Number(crow.y) || 0;
        crowWarningState.side = Number(crow.vx || 0) < 0 ? 'right' : 'left';
      }
    }
    function performBatVerticalRebound(anchor) {
      if (!player || player.attachIndex === null || !anchor) return false;
      var mouth = getMouthWorld();
      var aimAngle = directionAngle(anchor.x - player.x, anchor.y - player.y);
      player.attachIndex = null; player.pendingAttachIndex = null; player.pendingAimAngle = null;
      player.pressOpenTimer = 0; player.mouthOpen = 0; player.verticalTongueTimer = 0; player.tongueFailTimer = 0;
      pointerHeld = false;
      tongueFx = {
        mode: 'retract', timer: TONGUE_RETRACT_DURATION, duration: TONGUE_RETRACT_DURATION,
        targetX: anchor.x, targetY: anchor.y, startX: mouth.x, startY: mouth.y,
        invert: false, aimAngle: aimAngle
      };
      player.vy = Math.min(player.vy, -BAT_VERTICAL_REBOUND_SPEED);
      player.vx = Math.max(player.vx, BAT_VERTICAL_REBOUND_FORWARD);
      player.skillInputLock = Math.max(Number(player.skillInputLock) || 0, 0.14);
      floatingTexts.push({
        x: player.x, y: player.y - 40, value: 0, label: '蝠侠能力', age: 0, life: 0.82, customText: '↑ 反弹飞起'
      });
      try { playTongueSound('detach'); } catch (e) {}
      triggerHaptic('heavy');
      return true;
    }
    // 首页 PLAY 状态弹窗：每日赠送 / 今日已领 / 冷却状态统一在这里展示。
    // pending 仅表示“本次启动刚领取了每日奖励”，不会在进入首页时自动弹出。
    var dailyLoginPopup = {
      pending: false,
      active: false,
      title: '',
      subtitle: '',
      timer: 0,
      holdSeconds: 1.0,
      fadeSeconds: 0.25,
      continueToPlay: false
    };
    // —— 黄金番薯云端账户同步（让番薯真实存到用户微信账号，换设备/清缓存也不丢）——
    // 策略：本地账本即时生效（离线可玩），每次变动异步推送到云函数 account；
    //       进游戏时从云端拉取，云端为准合并回本地（取较大值，避免误删玩家已有的番薯）。
    var giftCloudReady = false;
    var giftCloudSyncing = false;
    // 2026-10-10：黄金番薯云端同步完成标志。进游戏时 get+claim_login 是异步链，
    // 在它完成前「每日登录」弹窗若直接读取本地镜像会是陈旧的 0（清缓存后尤甚），
    // 导致「口袋里尚有 0 颗」闪一下、再进才显示真实余额（7 等）。giftReady 为 true 后
    // 才允许弹窗，保证首屏显示的就是同步后的正确值（登录+2 或真实库存）。
    var giftReady = false;
    var giftPendingStatusPopup = false;
    var GIFT_PENDING_KEY = 'super_tongue_axi_v70_gift_pending';
    function giftCloudEnabled() {
      // [2026-10-31 需求3] 网页端无视云端番薯台账：本构建永不走云账户，数量只由本地会话决定。
      return !!(cloudConfig && cloudConfig.enabled === true) && typeof wx !== 'undefined' && wx.cloud && wx.cloud.callFunction;
    }
    // [2026-10-31 需求3] 网页端每次登入固定 5 颗：直接重置本地镜像，不读云端、不累加历史。
    function resetKioskPotatoForSession() {
      var today = localDayKey();
      refreshGiftState();
      giftState.potatoBank = KIOSK_LOGIN_POTATO;
      giftState.totalEarned = KIOSK_LOGIN_POTATO;
      giftState.loginClaimedDay = today;   // 今日登录已在重置时处理，不再额外发放
      giftState.lastLoginDay = today;
      giftState.loginStreak = 1;
      saveGiftState();
      clearPendingGiftSync();
      giftReady = true;
      try { console.info('[gift][web] 本次登入黄金番薯固定 ' + KIOSK_LOGIN_POTATO + ' 颗（无视云端/历史存档）'); } catch (e) {}
    }
    function savePendingGiftSync() {
      try { wx.setStorageSync(GIFT_PENDING_KEY, { bank: giftState.potatoBank, earned: giftState.totalEarned, at: nowMs() }); } catch (e) {}
    }
    function clearPendingGiftSync() { try { wx.removeStorageSync(GIFT_PENDING_KEY); } catch (e) {} }
    // 2026-09-29 v2 账本：客户端只做镜像缓存，不再向云端推送本地余额。
    // 旧 max-merge 推送正是 51/52 颗污染反复回填的通道，已封死。
    // 云端权威值由 get / claim_login / credit_task / spend 的响应直接覆盖本地。
    function syncGiftToCloud() {
      if (!giftCloudEnabled() || !giftState) return;
      savePendingGiftSync();
    }
    function initGiftFromCloud(done) {
      // 2026-10-09 零操作清污护栏：历史测试残留污染值（60→61 颗）一直躺在云端台账里，
      // 手动 __resetPotatoLedger() 始终没执行。改为启动同步时自动检测自动清，
      // 护栏：①阈值 50（正常测试每日 +2、黄金番薯皮肤花 30，不会误伤真实库存）
      //      ②2026-10-12 00:00（北京时间）后自动失效，未来不会误清
      //      ③每次启动最多尝试一次。
      var potatoPurgeAttempted = false;
      var POTATO_PURGE_EXPIRE_TS = Date.UTC(2026, 9, 11, 16, 0, 0); // = 北京时间 2026-10-12 00:00
      function fire() { if (typeof done === 'function') { try { done(); } catch (e) {} } }
      if (!giftCloudEnabled()) { fire(); return; }
      giftCloudReady = true;
      refreshGiftState();
      clearPendingGiftSync(); // v2：旧的待推送余额作废，防止污染值回灌云端
      try {
        wx.cloud.callFunction({
          name: 'account',
          data: { action: 'get' },
          success: function(res) {
            var payload = res && res.result ? res.result : res;
            if (payload && payload.ok === true) {
              // 服务端为权威台账：直接覆盖本地镜像（不再取较大值合并，否则本地测试期污染值
              // 60 始终赢过云端、反复显示）。旧版「今日已领则忽略 get」的 early-return 会把本地污染值
              // 定格显示，已删除。
              giftState.potatoBank = Math.max(0, Math.round(Number(payload.potatoBank) || 0));
              giftState.totalEarned = Math.max(0, Math.round(Number(payload.totalEarned) || 0));
              saveGiftState();
              refreshMenuStatusPopupBank();
              // —— 零操作清污（2026-10-09）：见 initGiftFromCloud 头部护栏注释 ——
              if (!potatoPurgeAttempted && Date.now() < POTATO_PURGE_EXPIRE_TS && giftState.potatoBank >= 50) {
                potatoPurgeAttempted = true;
                try {
                  console.warn('[gift] 检测到疑似污染库存（' + giftState.potatoBank + ' 颗 ≥ 50），自动调用云端 reset 清零…');
                  wx.cloud.callFunction({
                    name: 'account',
                    data: { action: 'reset' },
                    success: function (r2) {
                      var p2 = r2 && r2.result ? r2.result : r2;
                      if (p2 && p2.ok === true) {
                        console.warn('[gift] 自动清零完成（清掉 ' + (p2.cleared || 0) + ' 颗），重新拉取权威库存…');
                        initGiftFromCloud(done); // 重拉后再继续每日登录奖励链
                        return;
                      }
                      console.warn('[gift] 自动清零未生效（account 云函数可能是旧版，请重新上传部署 cloudfunctions/account）：', p2);
                      fire();
                    },
                    fail: function (e2) {
                      console.warn('[gift] 自动清零调用失败：', e2 && e2.errMsg ? e2.errMsg : e2);
                      fire();
                    }
                  });
                  return; // 清污进行中，等回调决定重拉或继续
                } catch (e3) { /* 同步异常则落到下方 fire() 正常继续 */ }
              }
            } else {
              // 2026-10-05 诊断增强：云端 get 成功返回却不是 ok:true —— 极可能是「account」云函数
              // 部署的是旧版（仍读 player_accounts、无 ok 字段），或返回结构不符。此时本地污染值
              // 不会被覆盖，口袋会显示错误数字（如 57）。需重新上传部署 cloudfunctions/account（v2 源码）。
              try { console.warn('[gift] account.get 返回非 ok，未覆盖本地缓存：', JSON.stringify(payload)); } catch (e) {}
            }
            fire(); // 拉完云端余额后，再发每日登录奖励（串行，避免 get 旧快照覆盖 claim_login 奖励）
          },
          fail: function(err) {
            // 2026-10-05 诊断增强：云端 get 调用失败（云函数未部署 / env 不可达 / 当前 appid 无权限）。
            // 客户端会回退到本地 GIFT_KEY 缓存，若那里是测试期污染值则口袋显示错误数字。
            try { console.warn('[gift] account.get 调用失败，回退本地缓存：', err && err.errMsg ? err.errMsg : err); } catch (e) {}
            fire();
          }
        });
      } catch (e) { fire(); }
    }
    // —— 开发者修复工具：清空当前玩家云端番薯台账的污染值（如历史残留的 60 颗）——
    // 仅调用云端 reset（绝对清零、绝不发放），仅影响本人 openid；每玩家数据仍由云端保护。
    // 用法（微信开发者工具 Console）：__resetPotatoLedger()
    // 执行后会自动从云端重新拉取（应显示 0），再正常发每日登录 +2。
    try {
      var _g = (typeof globalThis !== 'undefined') ? globalThis : (typeof global !== 'undefined' ? global : null);
      if (_g) {
        _g.__resetPotatoLedger = function (cb) {
          if (!giftCloudEnabled()) { console.warn('[gift] 云端未启用，无法重置（检查 cloud_config 的 CLOUD_ENV）'); if (cb) cb(false, 'no-cloud'); return; }
          if (!(typeof wx !== 'undefined' && wx.cloud && wx.cloud.callFunction)) { console.warn('[gift] wx.cloud.callFunction 不可用'); if (cb) cb(false, 'no-call'); return; }
          console.warn('[gift] 正在请求云端清零当前玩家番薯台账…');
          wx.cloud.callFunction({
            name: 'account',
            data: { action: 'reset' },
            success: function (res) {
              var p = res && res.result ? res.result : res;
              if (p && p.ok === true) {
                console.warn('[gift] 云端已清零' + (p.cleared ? ('（清掉 ' + p.cleared + ' 颗）') : '') + '，正在重新拉取…');
                initGiftFromCloud(function () { console.warn('[gift] 重新拉取完成，当前库存 ' + Math.max(0, Math.round(Number(goldenPotatoBank()) || 0))); if (cb) cb(true, p); });
              } else {
                console.warn('[gift] 云端清零失败：', p); if (cb) cb(false, p);
              }
            },
            fail: function (e) { console.warn('[gift] 云端清零调用失败：', e); if (cb) cb(false, e); }
          });
        };
      }
    } catch (e) {}
    // —— 开发者诊断工具：查看云端权威台账 + 最近 50 条流水（每颗番薯的来源都可追溯）——
    // 用途：搞清「口袋里的数字到底是哪来的」。云端 get 成功时口袋显示的就是这里的 potatoBank。
    // 用法（微信开发者工具 Console）：__auditPotatoLedger()
    try {
      var _g2 = (typeof globalThis !== 'undefined') ? globalThis : (typeof global !== 'undefined' ? global : null);
      if (_g2) {
        _g2.__auditPotatoLedger = function (cb) {
          if (!giftCloudEnabled()) { console.warn('[gift] 云端未启用（检查 game.js 的 CLOUD_ENV）'); if (cb) cb(false, 'no-cloud'); return; }
          wx.cloud.callFunction({
            name: 'account',
            data: { action: 'audit' },
            success: function (res) {
              var p = res && res.result ? res.result : res;
              if (p && p.ok === true) {
                console.warn('[gift] 云端权威余额 potatoBank =', p.potatoBank, ' 累计获得 totalEarned =', p.totalEarned);
                console.warn('[gift] 最近流水（每颗的来源）：');
                var log = p.grantLog || [];
                for (var i = 0; i < log.length; i++) {
                  console.warn('  #' + (log.length - i), JSON.stringify(log[i]));
                }
                if (!log.length) console.warn('  （无流水记录）');
                console.warn('[gift] 若要清零：Console 执行 __resetPotatoLedger()');
              } else {
                console.warn('[gift] audit 返回异常（很可能 account 云函数是旧版，需重新上传部署 cloudfunctions/account）：', p);
              }
              if (cb) cb(p && p.ok === true, p);
            },
            fail: function (e) {
              console.warn('[gift] audit 调用失败（account 云函数未部署 / 环境不可达）：', e && e.errMsg ? e.errMsg : e);
              if (cb) cb(false, e);
            }
          });
        };
      }
    } catch (e) {}
    // 云端余额回填后，若首页状态弹窗正展示「口袋里尚有 X 颗」则实时刷新数字
    // —— 修复「先弹 0 颗」时序：弹窗出现时云端发放可能还在路上，回填瞬间把标题改对。
    function refreshMenuStatusPopupBank() {
      try {
        if (dailyLoginPopup && dailyLoginPopup.active &&
            typeof dailyLoginPopup.title === 'string' &&
            dailyLoginPopup.title.indexOf('口袋里尚有') === 0) {
          dailyLoginPopup.title = '口袋里尚有 ' + Math.max(0, Math.round(Number(goldenPotatoBank()) || 0)) + ' 颗黄金番薯';
        }
      } catch (e) {}
    }
    function formatRecoveryTime(seconds) {
      seconds = Math.max(0, Math.ceil(Number(seconds) || 0));
      var m = Math.floor(seconds / 60), s = seconds % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    // 2026-10-10 切换皮肤弹层：可爱圆体、画面顶部 1/3、黄色半透明、无外框。
    // 出现后停留 holdMs(1s)，随后在 riseMs(1s) 内边向上移动边淡出。由 render 顶层绘制。
    var skinSwitchBanner = { active: false, text: '', startedAt: 0, holdMs: 1000, riseMs: 1000, riseDist: 70 };
    function activateSkinSwitchBanner(text) {
      skinSwitchBanner.text = String(text || '');
      skinSwitchBanner.active = !!skinSwitchBanner.text;
      skinSwitchBanner.startedAt = Date.now();
    }
    function showToastMessage(text, duration) {
      var msg = String(text || '');
      // 进入实际游玩后不再显示任何会遮挡画面的原生 Toast；
      // 保留内部 toastState 为空，避免广告未开通等提示盖住关卡。
      if (scene === 'playing') {
        toastState = { text: '', timer: 0 };
        return;
      }
      toastState = { text: msg, timer: Math.max(0.8, Number(duration) || 2.2) };
      try { if (wx.showToast) wx.showToast({ title: toastState.text, icon: 'none', duration: Math.round(toastState.timer * 1000) }); } catch(e) {}
    }

    var rewardedVideoAd = null;
    var pendingRewardedCallback = null;
    // —— 插屏广告（补充变现位）——
    var interstitialAd = null;
    var lastInterstitialShownAt = 0;
    var INTERSTITIAL_MIN_INTERVAL = 90 * 1000; // 平台对插屏有频次上限，内置节流避免骚扰
    var pendingShareRewardCallback = null;
    var pendingShareRewardStartedAt = 0;
    // 分享接口无法返回实际收件人或可靠的发送成功结果。
    // 本流程以“原生分享面板已打开，并从微信分享界面返回小游戏”作为复活触发点。
    var shareReviveExternalPhase = 0;
    var shareRewardClaimedAt = 0;
    var shareViewPageResumePending = false;
    var shareReviveHideObserved = false;
    var shareReviveHiddenAt = 0;
    var shareResumeGuardActive = false;
    function completePendingShareReward(ok, message) {
      var cb = pendingShareRewardCallback;
      pendingShareRewardCallback = null;
      pendingShareRewardStartedAt = 0;
      shareReviveHideObserved = false;
      shareReviveHiddenAt = 0;
      // 每日任务：分享给好友 1 次 → +1 黄金番薯（仅真实分享成功时计，每天限 1 次）。
      if (ok) { try { creditDailyTask('share'); } catch (ignoreShareTask) {} }
      if (cb) cb(!!ok, String(message || ''));
    }
    function completeRewardedAd(ok) {
      var cb = pendingRewardedCallback;
      pendingRewardedCallback = null;
      if (cb) cb(!!ok);
    }
    function initRewardedVideoAd() {
      var adUnitId = String(monetizationConfig.rewardedVideoAdUnitId || '');
      if (!adUnitId || typeof wx === 'undefined' || !wx.createRewardedVideoAd) return;
      try {
        rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: adUnitId });
        if (rewardedVideoAd.onClose) rewardedVideoAd.onClose(function(res) { completeRewardedAd(!res || res.isEnded === true); });
        if (rewardedVideoAd.onError) rewardedVideoAd.onError(function() { completeRewardedAd(false); });
        if (rewardedVideoAd.load) rewardedVideoAd.load().catch(function(){});
      } catch(e) { rewardedVideoAd = null; }
    }
    function showRewardedAd(reason, done) {
      done = typeof done === 'function' ? done : function(){};
      if (pendingRewardedCallback) { showToastMessage('广告正在准备中'); done(false); return; }
      if (monetizationConfig.devGrantRewardedAd === true) {
        triggerHaptic('light');
        setTimeout(function(){ done(true); }, 280);
        return;
      }
      if (!rewardedVideoAd) {
        // 到达此分支说明：广告位未申请（无 adUnitId）且非开发模拟 → 预留态，不发放奖励。
        showToastMessage(rewardedAdReserved() ? '广告位申请中，暂不可用' : '广告位尚未配置');
        done(false);
        return;
      }
      pendingRewardedCallback = done;
      try {
        var shown = rewardedVideoAd.show();
        if (shown && shown.catch) shown.catch(function(err) {
          // 区分网络错误与其他错误
          var msg = (err && err.errMsg && (err.errMsg.indexOf('network') >= 0 || err.errMsg.indexOf('Network') >= 0 || err.errMsg.indexOf('timeout') >= 0 || err.errMsg.indexOf('Timeout') >= 0))
            ? '网络不可用，请检查网络后重试'
            : '广告加载失败，请稍后重试';
          showToastMessage(msg);
          if (!rewardedVideoAd.load) { completeRewardedAd(false); return; }
          rewardedVideoAd.load().then(function(){ return rewardedVideoAd.show(); }).catch(function(){ completeRewardedAd(false); });
        });
      } catch(e) { completeRewardedAd(false); }
    }
    function initInterstitialAd() {
      var adUnitId = String(monetizationConfig.interstitialAdUnitId || '');
      if (!adUnitId || typeof wx === 'undefined' || !wx.createInterstitialAd) return;
      try {
        interstitialAd = wx.createInterstitialAd({ adUnitId: adUnitId });
        if (interstitialAd.onError) interstitialAd.onError(function() {}); // 静默兜底，绝不影响玩法
        if (interstitialAd.onClose) interstitialAd.onClose(function() {});
      } catch (e) { interstitialAd = null; }
    }
    // 在死亡结算页等自然断点调用：fire-and-forget，与奖励无关，失败静默。
    function maybeShowInterstitialAd() {
      if (monetizationConfig.devGrantInterstitialAd === true) return; // 开发期不弹真实插屏
      if (!interstitialAd) return;
      var t = nowMs();
      if (t - lastInterstitialShownAt < INTERSTITIAL_MIN_INTERVAL) return; // 频次节流
      lastInterstitialShownAt = t;
      try {
        var p = interstitialAd.show();
        if (p && p.catch) p.catch(function() {
          if (interstitialAd.load) interstitialAd.load().then(function() { return interstitialAd.show(); }).catch(function(){});
        });
      } catch (e) { /* 静默 */ }
    }
    // —— 广告位接入预留（腾讯广告位申请中）——
    // 三态：① 真实广告位已申请（adUnitId 非空且 wx.createRewardedVideoAd 可用）→ 走真实 SDK；
    //       ② 仅开发期模拟（devGrantRewardedAd === true）→ 自动判定成功，无需真实广告；
    //       ③ 未申请且非开发模拟（预留态）→ 不发放任何奖励，UI 提示“申请中”。
    // 向腾讯申请到广告位后的唯二改动：把 rewardedVideoAdUnitId 填为真实 ID，并把 devGrantRewardedAd 置为 false。
    function isRewardedAdLive() {
      return !!String(monetizationConfig.rewardedVideoAdUnitId || '').trim() && typeof wx !== 'undefined' && !!wx.createRewardedVideoAd;
    }
    function rewardedAdReserved() {
      // 广告位尚未申请（无 adUnitId 且非开发模拟）：预留态，不应发放任何奖励。
      return !isRewardedAdLive() && monetizationConfig.devGrantRewardedAd !== true;
    }
    function rewardedAdIsUsable() {
      if (isRewardedAdLive()) return true;                   // 真实广告位已申请
      return monetizationConfig.devGrantRewardedAd === true; // 仅开发期模拟
    }
    function shareRewardIsUsable() {
      return (typeof wx !== 'undefined' && typeof wx.shareAppMessage === 'function') || isDevtoolsRuntime();
    }
    var scenePackageReady = false;
    var scenePackageWaiters = [];
    var scenePlayRequestPending = false;
    try { scenePackageReady = readPackageReady('res_scene') || (typeof GameGlobal !== 'undefined' && GameGlobal.__superTongueSceneReady === true); } catch (sceneReadyReadError) {}
    function markScenePackageReady() {
      if (scenePackageReady) return;
      scenePackageReady = true;
      ensureStageBackgroundAsset(runtimeLevel);
      var waiters = scenePackageWaiters.slice();
      scenePackageWaiters.length = 0;
      for (var i = 0; i < waiters.length; i++) try { waiters[i](); } catch (waiterError) {}
    }
    try {
      if (typeof GameGlobal !== 'undefined') {
        GameGlobal.__superTongueSceneReadyListeners = GameGlobal.__superTongueSceneReadyListeners || [];
        GameGlobal.__superTongueSceneReadyListeners.push(markScenePackageReady);
        onPackageReady('res_scene', markScenePackageReady);
      }
    } catch (sceneListenerError) {}
    function whenScenePackageReady(callback) {
      if (scenePackageReady) { callback(); return true; }
      scenePackageWaiters.push(callback);
      // 主包启动后仍允许重新触发关卡分包；修复网络抖动、切后台或启动竞态后永久等待。
      try {
        if (typeof GameGlobal !== 'undefined' && typeof GameGlobal.__superTongueEnsureScenePackage === 'function') {
          GameGlobal.__superTongueEnsureScenePackage();
        }
      } catch (sceneEnsureError) {}
      showToastMessage('关卡资源加载中…', 1.2);
      return false;
    }

    function beginFormalPlay(stageToLoad, resetSession) {
      if (stageToLoad !== undefined && stageToLoad !== null) {
        var requested = clampStageIndex(stageToLoad);
        if (requested >= MAIN_STAGE_START) requested = Math.min(requested, Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE));
        loadStage(requested);
      }
      startRun(resetSession !== false);
    }
    function rewardRecoveryText() {
      var view = economyView();
      return view.recoverSeconds > 0 ? formatRecoveryTime(view.recoverSeconds) : formatRecoveryTime(Math.max(1, Math.round(RECOVERY_MS / 1000)));
    }
    function syncRewardDialogAvailability(message) {
      if (!rewardDialog.active) return;
      if (rewardDialog.claimed) { if (message !== undefined) rewardDialog.message = String(message || ''); return; }
      refreshEconomyState();
      var view = economyView();
      var reviveMode = rewardDialog.mode === 'revive';
      rewardDialog.adUsed = reviveMode && !!runStats.adReviveUsed;
      rewardDialog.shareUsed = reviveMode && !!runStats.shareReviveUsed;
      // 广告可无限重复使用（无每日/本局限制）；分享受每日 3 次限制。
      rewardDialog.adAvailable = rewardedAdIsUsable();
      rewardDialog.shareAvailable = reviveMode && shareRewardIsUsable() && view.dailyShareRevives > 0;
      rewardDialog.availablePlays = Math.max(0, Math.round(Number(view.availablePlays) || 0));
      rewardDialog.adReserved = rewardedAdReserved(); // 广告位申请中（预留态），UI 应显示"申请中"而非报错
      rewardDialog.shareRemaining = view.dailyShareRevives;
      rewardDialog.shareMax = DAILY_SHARE_REVIVES;
      // 黄金番薯库存复活：只要库存在 revive 模式即可用，独立于广告/分享资源。
      rewardDialog.potatoBank = goldenPotatoBank();
      rewardDialog.potatoAvailable = reviveMode && rewardDialog.potatoBank > 0;
      rewardDialog.energyAvailable = reviveMode && !rewardDialog.adAvailable && !rewardDialog.shareAvailable && rewardDialog.availablePlays > 0;
      // 广告位申请期的免费复活出口：激励视频不可用（申请中/未配置）时，允许免广告复活 +1 命，
      // 避免玩家既无广告可看、又无番薯/分享额度时被卡死。广告接通后自动失效。
      rewardDialog.freeReviveAvailable = false;
      rewardDialog.recoverText = rewardRecoveryText();
      rewardDialog.recoveryMinutes = Math.max(1, Math.round(RECOVERY_MS / 60000));
      rewardDialog.cooldownText = rewardDialog.cooldownUntil > nowMs() ? formatRecoveryTime(Math.ceil((rewardDialog.cooldownUntil - nowMs()) / 1000)) : '';
      if (message !== undefined) rewardDialog.message = String(message || '');
    }
    function closeRewardDialog() {
      rewardDialog.active = false;
      rewardDialog.mode = '';
      rewardDialog.busy = false;
      rewardDialog.message = '';
      rewardDialog.stageToLoad = null;
      rewardDialog.resetSession = true;
      rewardDialog.claimed = false;
      rewardDialog.cooldownUntil = 0;
      rewardDialog.cooldownText = '';
      rewardDialog.claimSource = '';
      rewardDialog.rewardBefore = 0;
      rewardDialog.rewardAfter = 0;
      shareReviveExternalPhase = 0;
      shareRewardClaimedAt = 0;
      shareViewPageResumePending = false;
    }
    function openPlayRewardDialog(stageToLoad, resetSession) {
      rewardDialog.active = true;
      rewardDialog.mode = 'play';
      rewardDialog.busy = false;
      rewardDialog.message = '';
      rewardDialog.stageToLoad = stageToLoad;
      rewardDialog.resetSession = resetSession !== false;
      rewardDialog.claimed = false;
      rewardDialog.claimSource = '';
      rewardDialog.rewardBefore = 0;
      rewardDialog.rewardAfter = 0;
      syncRewardDialogAvailability('');
    }
    function reviveCheckpointIsValid(value) {
      return !!(value && typeof value === 'object' && Number(value.version) === 1 &&
        Number(value.savedAt) > 0 && nowMs() - Number(value.savedAt) <= REVIVE_CHECKPOINT_MAX_AGE_MS &&
        Number(value.stageIndex) >= 0 && value.runtimeLevel && value.runStats && value.player);
    }
    function loadPersistedReviveCheckpoint() {
      var stored = null;
      try { stored = wx.getStorageSync(REVIVE_CHECKPOINT_KEY); } catch (e) {}
      if (!reviveCheckpointIsValid(stored)) {
        try { wx.removeStorageSync(REVIVE_CHECKPOINT_KEY); } catch (ignoreRemoveInvalidReviveCheckpoint) {}
        return null;
      }
      return stored;
    }
    function savePersistedReviveCheckpoint(checkpoint) {
      if (!reviveCheckpointIsValid(checkpoint)) return false;
      try { wx.setStorageSync(REVIVE_CHECKPOINT_KEY, checkpoint); return true; } catch (e) { return false; }
    }
    function clearPersistedReviveCheckpoint() {
      try { wx.removeStorageSync(REVIVE_CHECKPOINT_KEY); } catch (e) {}
    }
    function clearReviveCheckpoint() {
      reviveCheckpoint = null;
      clearPersistedReviveCheckpoint();
    }
    function captureReviveCheckpoint(action) {
      if (!player || !runtimeLevel || stageIndex < 0) return null;
      var checkpoint = {
        version: 1,
        savedAt: nowMs(),
        action: String(action || ''),
        stageIndex: stageIndex,
        level: clone(level),
        runtimeLevel: clone(runtimeLevel),
        progress: clone(progress),
        runStats: clone(runStats),
        player: clone(player),
        cameraX: Number(cameraX) || 0,
        cameraY: Number(cameraY) || 0,
        cameraFollowInitialized: !!cameraFollowInitialized,
        particles: clone((particles || []).slice(-96)),
        floatingTexts: clone((floatingTexts || []).slice(-32)),
        crows: clone((crows || []).slice(-24)),
        deathTimer: Number(deathTimer) || 0,
        deathLeaderboardShown: !!deathLeaderboardShown,
        soulState: clone(soulState),
        tongueFx: clone(tongueFx),
        goldenSkillState: clone(goldenSkillState),
        reviveCause: String(reviveOffer.cause || 'fall'),
        claimSource: String(rewardDialog.claimSource || ''),
        rewardBefore: Math.max(0, Number(rewardDialog.rewardBefore) || 0),
        rewardAfter: Math.max(0, Number(rewardDialog.rewardAfter) || 0),
        cooldownUntil: Math.max(0, Number(rewardDialog.cooldownUntil) || 0),
        resumeDirect: !!shareViewPageResumePending
      };
      reviveCheckpoint = checkpoint;
      if (checkpoint.action) savePersistedReviveCheckpoint(checkpoint);
      return checkpoint;
    }
    function persistReviveCheckpoint(action) {
      return !!captureReviveCheckpoint(action);
    }
    function restoreReviveCheckpoint(preserveCurrentReward) {
      var checkpoint = reviveCheckpointIsValid(reviveCheckpoint) ? reviveCheckpoint : loadPersistedReviveCheckpoint();
      if (!checkpoint) return false;
      var currentAdUsed = !!(runStats && runStats.adReviveUsed);
      var currentShareUsed = !!(runStats && runStats.shareReviveUsed);
      var currentHearts = Math.max(0, Number(runStats && runStats.hearts) || 0);
      var currentGoldenPoints = Math.max(0, Number(goldenSkillState && goldenSkillState.points) || 0);
      stageIndex = clampStageIndex(checkpoint.stageIndex);
      level = normalizeLevel(clone(checkpoint.level || loadLevel(stageIndex)));
      runtimeLevel = clone(checkpoint.runtimeLevel || level);
      progress = clone(checkpoint.progress || progress);
      progress.currentStage = stageIndex;
      runStats = clone(checkpoint.runStats || createRunStats());
      player = clone(checkpoint.player || makePlayer());
      cameraX = Number(checkpoint.cameraX) || 0;
      cameraY = Number(checkpoint.cameraY) || 0;
      cameraFollowInitialized = !!checkpoint.cameraFollowInitialized;
      particles = clone(checkpoint.particles || []);
      floatingTexts = clone(checkpoint.floatingTexts || []);
      crows = clone(checkpoint.crows || []);
      deathTimer = Number(checkpoint.deathTimer) || 0;
      deathLeaderboardShown = !!checkpoint.deathLeaderboardShown;
      soulState = clone(checkpoint.soulState || { active: true, timer: SOUL_ASCEND_DURATION, duration: SOUL_ASCEND_DURATION, x: player.x, y: player.y, particleTimer: 0 });
      tongueFx = clone(checkpoint.tongueFx || { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 });
      // 复活后关卡/食物对象已重建，旧的伸舌目标必须丢弃，否则会伸向一个已不存在的食物引用。
      resetGreedyShot();
      goldenSkillState = clone(checkpoint.goldenSkillState || goldenSkillState);
      shareViewPageResumePending = !!checkpoint.resumeDirect;
      if (preserveCurrentReward) {
        runStats.adReviveUsed = !!runStats.adReviveUsed || currentAdUsed;
        runStats.shareReviveUsed = !!runStats.shareReviveUsed || currentShareUsed;
        runStats.hearts = Math.max(Number(runStats.hearts) || 0, currentHearts);
        goldenSkillState.points = Math.max(Number(goldenSkillState.points) || 0, currentGoldenPoints);
      }
      rewardDialog.cooldownUntil = Math.max(0, Number(checkpoint.cooldownUntil) || 0);
      rewardDialog.cooldownText = rewardDialog.cooldownUntil > nowMs() ? formatRecoveryTime(Math.ceil((rewardDialog.cooldownUntil - nowMs()) / 1000)) : '';
      reviveOffer.cause = String(checkpoint.reviveCause || 'fall');
      reviveOffer.busy = true;
      leaderboardOpen = false;
      leaderboardAutoReturnToMenu = false;
      leaderboardScrollY = 0;
      resetGameOverState();
      rebuildRuntimeSpatialIndex();
      ensureFoodAssetsForLevel(runtimeLevel);
      if (scenePackageReady) {
        ensureStageBackgroundAsset(runtimeLevel);
        playBgmForLevel(runtimeLevel, stageIndex);
      }
      setScene('soul_departure');
      saveProgress();
      return true;
    }
    function openReviveRewardDialog(skipCheckpointCapture) {
      if (!skipCheckpointCapture) captureReviveCheckpoint('');
      rewardDialog.active = true;
      rewardDialog.mode = 'revive';
      rewardDialog.busy = false;
      rewardDialog.message = '';
      rewardDialog.stageToLoad = null;
      rewardDialog.resetSession = true;
      rewardDialog.claimed = false;
      rewardDialog.claimSource = '';
      rewardDialog.rewardBefore = 0;
      rewardDialog.rewardAfter = 0;
      // 自动启动 20 分钟冷却：死亡开窗即计时，无需玩家手动选择
      if (rewardDialog.cooldownUntil <= nowMs()) {
        rewardDialog.cooldownUntil = nowMs() + RECOVERY_MS;
        setRecoveryClock(rewardDialog.cooldownUntil);
        rewardDialog.cooldownText = '';
        captureReviveCheckpoint('cooldown_pending');
      }
      syncRewardDialogAvailability('');
      // 自然断点弹插屏（与奖励无关，失败静默、频次节流）。
      maybeShowInterstitialAd();
    }
    function formalPlayResourcesReady() {
      return scenePackageReady && checkGameplayVisualsReady();
    }
    function requestFormalPlay(stageToLoad, resetSession) {
      if (!formalPlayResourcesReady()) {
        if (scenePlayRequestPending) return;
        scenePlayRequestPending = true;
        ensurePackage('res_core');
        ensurePackage('res_scene');
        showToastMessage('高画质关卡资源准备中…', 1.2);
        var settled = false;
        function retryWhenReady() {
          if (settled || !formalPlayResourcesReady()) return;
          settled = true;
          scenePlayRequestPending = false;
          requestFormalPlay(stageToLoad, resetSession);
        }
        whenGameplayVisualsReady(retryWhenReady);
        whenScenePackageReady(retryWhenReady);
        return;
      }
      // [kiosk] 线下闯关：无广告、无游戏次数 —— 资源就绪即直接开战
      if (kioskRun.active) { beginFormalPlay(stageToLoad, resetSession); return; }
      refreshEconomyState();
      if (consumePlayEnergy()) { beginFormalPlay(stageToLoad, resetSession); return; }
      // —— 广告位申请期兜底：绝不卡住游戏 ——
      // 当激励视频既不可用（广告位申请中/未配置）且玩家已无游戏次数时，直接放行开一局，
      // 保证"广告接通前游戏能正常玩"，不写任何消耗状态、不弹付费/广告窗口。
      // 广告位一旦审核通过（isRewardedAdLive 为 true），此处自动失效，
      // 恢复"必须先看广告拿次数"的正常变现逻辑。
      if (!isRewardedAdLive() && monetizationConfig.devGrantRewardedAd !== true) {
        beginFormalPlay(stageToLoad, resetSession);
        return;
      }
      openPlayRewardDialog(stageToLoad, resetSession);
    }
    function invokeRewardShare(mode, done) {
      done = typeof done === 'function' ? done : function(){};
      if (mode !== 'revive') { done(false, '分享仅用于本局复活'); return; }
      refreshEconomyState();
      if (economyState.dailyShareRevives <= 0) { done(false, '今日分享次数已用完'); return; }
      if (pendingShareRewardCallback) { done(false, '分享面板正在处理中'); return; }
      var canNativeShare = typeof wx !== 'undefined' && typeof wx.shareAppMessage === 'function';
      if (!canNativeShare && isDevtoolsRuntime()) {
        setTimeout(function(){ done(true, ''); }, 320);
        return;
      }
      if (!canNativeShare) { done(false, '当前环境不支持分享'); return; }
      try {
        pendingShareRewardCallback = done;
        pendingShareRewardStartedAt = nowMs();
        shareReviveExternalPhase = 1;
        shareRewardClaimedAt = 0;
        shareViewPageResumePending = false;
        shareReviveHideObserved = false;
        shareReviveHiddenAt = 0;
        wx.shareAppMessage({
          title: '阿蜥还没倒下！帮我续一命继续挑战',
          imageUrl: 'res_core/foods/golden_sweet_potato.png',
          query: 'from=revive_share&resume=1&ts=' + String(nowMs())
        });
        // 不在调用 shareAppMessage 后立刻发奖。等待原生分享界面关闭并回到小游戏，
        // 再从保存的死亡现场直接复活，避免分享过程中切换场景或闪回首页。
      } catch (e) { completePendingShareReward(false, '分享调起失败，请稍后重试'); }
    }
    function grantRewardRevive(source) {
      // 外部广告/分享返回时先恢复死亡现场，避免系统切后台或进程恢复后落回首页。
      restoreReviveCheckpoint(false);
      reviveOffer.busy = true;
      if (source === 'share') {
        runStats.shareReviveUsed = true;
        shareRewardClaimedAt = nowMs();
        if (shareReviveExternalPhase === 0) shareReviveExternalPhase = 1;
        // 扣减每日分享额度
        refreshEconomyState();
        economyState.dailyShareRevives = Math.max(0, economyState.dailyShareRevives - 1);
        saveEconomyState();
      } else runStats.adReviveUsed = true;
      runStats.hearts = 1;
      var before = Math.max(0, Number(goldenSkillState.points) || 0);
      goldenSkillState.points = before + 1;
      rewardDialog.claimed = true;
      rewardDialog.claimSource = source === 'share' ? 'share' : 'ad';
      rewardDialog.rewardBefore = before;
      rewardDialog.rewardAfter = goldenSkillState.points;
      rewardDialog.busy = false;
      rewardDialog.message = '';
      rewardDialog.adAvailable = false;
      rewardDialog.shareAvailable = false;
      rewardDialog.energyAvailable = false;
      rewardDialog.cooldownUntil = 0;
      setRecoveryClock(0); // 提前用广告/分享复活 → 取消进行中的 20 分钟冷却钟
      rewardDialog.cooldownText = '';
      rewardDialogInputLockedUntil = nowMs() + 450;
      persistReviveCheckpoint('claimed');
      triggerHaptic('medium'); playFoodSound();
      showToastMessage('黄金番薯 +1');
    }
    function persistShareResumeGuardCheckpoint() {
      var checkpoint = captureReviveCheckpoint('share_resumed');
      if (!checkpoint) return false;
      checkpoint.claimSource = 'share';
      checkpoint.rewardAfter = Math.max(1, Number(goldenSkillState.points) || 0);
      checkpoint.rewardBefore = Math.max(0, checkpoint.rewardAfter - 1);
      checkpoint.resumeDirect = true;
      checkpoint.savedAt = nowMs();
      reviveCheckpoint = checkpoint;
      return savePersistedReviveCheckpoint(checkpoint);
    }
    function releaseShareResumeGuard() {
      if (!shareResumeGuardActive) return;
      shareResumeGuardActive = false;
      shareViewPageResumePending = false;
      clearReviveCheckpoint();
    }
    function enterRewardReviveStage(showArrivalFeedback, preserveShareResume) {
      if (!restoreReviveCheckpoint(true)) return false;
      var cause = reviveOffer.cause || 'fall';
      var rewardSource = String(rewardDialog.claimSource || '');
      reviveOffer.busy = false;
      runStats.hearts = Math.max(1, Number(runStats.hearts) || 0);
      closeRewardDialog();
      resetSoulState();
      triggerHaptic('medium'); playUiClickSound();
      if (!showGoldenSkillMenu('death', cause, null)) respawnAfterDeath();
      if (showArrivalFeedback && player) {
        floatingTexts.push({
          x: player.x, y: player.y - 72, value: 1, label: '黄金番薯', age: 0, life: 1.8,
          customText: '黄金番薯 +1 · 已在当前关卡复活'
        });
        showToastMessage('黄金番薯 +1，已在当前关卡复活');
      }
      if (preserveShareResume && rewardSource === 'share') {
        shareResumeGuardActive = true;
        shareViewPageResumePending = true;
        persistShareResumeGuardCheckpoint();
      } else {
        shareResumeGuardActive = false;
        clearReviveCheckpoint();
      }
      return true;
    }
    function continueRewardRevive() {
      if (!rewardDialog.active || !rewardDialog.claimed) return;
      if (nowMs() < rewardDialogInputLockedUntil) return;
      enterRewardReviveStage(false, false);
    }
    function grantEnergyRevive() {
      restoreReviveCheckpoint(true);
      reviveOffer.busy = false;
      closeRewardDialog();
      setRecoveryClock(0); // 提前复活 → 取消进行中的冷却钟
      runStats.hearts = 1;
      triggerHaptic('medium'); playUiClickSound();
      showToastMessage('已消耗 1 次游戏机会复活');
      respawnAfterDeath();
      clearReviveCheckpoint();
    }
    function grantCooldownRevive() {
      restoreReviveCheckpoint(true);
      reviveOffer.busy = false;
      closeRewardDialog();
      runStats.hearts = 1;
      rewardDialog.cooldownUntil = 0;
      rewardDialog.cooldownText = '';
      triggerHaptic('medium'); playUiClickSound();
      showToastMessage('冷却结束，复活 +1 命');
      respawnAfterDeath();
      clearReviveCheckpoint();
    }
    // 广告位申请期的免费复活：不发番薯、不消耗额度，仅 +1 命让玩家继续玩。
    // 广告位审核通过后此入口自动消失（freeReviveAvailable 置 false）。
    function grantAdPendingFreeRevive() {
      restoreReviveCheckpoint(true);
      reviveOffer.busy = false;
      closeRewardDialog();
      runStats.hearts = 1;
      rewardDialog.cooldownUntil = 0;
      setRecoveryClock(0); // 申请期免费复活 → 取消进行中的冷却钟
      rewardDialog.cooldownText = '';
      triggerHaptic('medium'); playUiClickSound();
      respawnAfterDeath();
      clearReviveCheckpoint();
    }
    function grantPotatoRevive() {
      if (!spendGoldenPotato(1)) { syncRewardDialogAvailability('黄金番薯不足'); return; }
      restoreReviveCheckpoint(true);
      reviveOffer.busy = false;
      closeRewardDialog();
      setRecoveryClock(0); // 番薯复活 → 取消进行中的冷却钟
      runStats.hearts = 1;
      triggerHaptic('medium'); playUiClickSound();
      showToastMessage('已消耗 1 个黄金番薯复活（库存 ' + goldenPotatoBank() + '）');
      respawnAfterDeath();
      clearReviveCheckpoint();
    }
    function finishReviveOffer(forfeited) {
      reviveOffer.busy = false;
      closeRewardDialog();
      clearReviveCheckpoint();
      if (forfeited) runStats.scoreValid = false;
      beginGameOverSequence();
    }
    function finishReviveToHome() {
      reviveOffer.busy = false;
      closeRewardDialog();
      clearReviveCheckpoint();
      submitRunToLeaderboard('revive_return_home');
      returnToMenuAfterGameOver();
    }
    function handleRewardDialogChoice(choice) {
      if (!rewardDialog.active || rewardDialog.busy) return;
      if (nowMs() < rewardDialogInputLockedUntil) return;
      if (rewardDialog.claimed) {
        if (choice === 'continue') continueRewardRevive();
        return;
      }
      syncRewardDialogAvailability();
      var mode = rewardDialog.mode;
      var primaryAvailable = rewardDialog.adAvailable || rewardDialog.shareAvailable;
      var fallbackMode = mode === 'revive' && !primaryAvailable;
      if (choice === 'cancel') {
        if (mode === 'revive') {
          if (rewardDialog.cooldownUntil > nowMs()) { clearReviveCheckpoint(); rewardDialog.cooldownUntil = 0; setRecoveryClock(0); rewardDialog.cooldownText = ''; }
          if (fallbackMode) finishReviveToHome();
          else finishReviveOffer(true);
        } else closeRewardDialog();
        return;
      }
      if (choice === 'ad') {
        if (!rewardDialog.adAvailable) { syncRewardDialogAvailability('当前广告机会不可用'); return; }
        rewardDialog.busy = true;
        rewardDialog.message = '广告加载中，请完整观看…';
        if (mode === 'revive') persistReviveCheckpoint('ad_pending');
        showRewardedAd(mode === 'revive' ? 'restore_life' : 'restore_play', function(ok) {
          rewardDialog.busy = false;
          if (!ok) {
            if (mode === 'revive') clearPersistedReviveCheckpoint();
            showToastMessage('需完整观看广告才能领取奖励');
            syncRewardDialogAvailability('广告未完整观看，可改用其他方式');
            return;
          }
          if (mode === 'revive') {
            restoreReviveCheckpoint(false);
            runStats.adReviveUsed = true;
            grantRewardRevive('ad');
          } else {
            var stageToLoad = rewardDialog.stageToLoad;
            var resetSession = rewardDialog.resetSession;
            grantAdPlay();
            closeRewardDialog();
            triggerHaptic('medium'); playUiClickSound();
            if (consumePlayEnergy()) beginFormalPlay(stageToLoad, resetSession);
            else { showToastMessage('补充次数失败，请重试'); openPlayRewardDialog(stageToLoad, resetSession); }
          }
        });
        return;
      }
      if (choice === 'share') {
        if (!rewardDialog.shareAvailable) { syncRewardDialogAvailability('今日分享次数已用完'); return; }
        rewardDialog.busy = true;
        rewardDialog.message = '请选择微信好友或群，返回后立即复活…';
        persistReviveCheckpoint('share_pending');
        invokeRewardShare(mode, function(ok, message) {
          rewardDialog.busy = false;
          if (!ok) { clearPersistedReviveCheckpoint(); showToastMessage(message || '分享失败'); syncRewardDialogAvailability(message || '分享失败，请重试'); return; }
          runStats.shareReviveUsed = true;
          grantRewardRevive('share');
          rewardDialogInputLockedUntil = 0;
          // 分享界面返回后直接进入原死亡关卡，不经过首页或二次“继续游戏”按钮。
          enterRewardReviveStage(true, true);
        });
        return;
      }
      if (choice === 'cooldown') {
        if (mode !== 'revive') return;
        if (rewardDialog.cooldownUntil > nowMs()) { syncRewardDialogAvailability('冷却中，请稍候'); return; }
        rewardDialog.cooldownUntil = nowMs() + RECOVERY_MS;
        rewardDialog.cooldownText = '';
        captureReviveCheckpoint('cooldown_pending');
        rewardDialog.message = '已开启 20 分钟冷却，到时自动复活 +1 命';
        syncRewardDialogAvailability('');
        return;
      }
      if (choice === 'energy') {
        if (!rewardDialog.energyAvailable) { syncRewardDialogAvailability('当前没有可消耗的游戏次数'); return; }
        if (!consumePlayEnergy()) { syncRewardDialogAvailability('游戏次数已用完，请返回首页'); return; }
        grantEnergyRevive();
      }
      if (choice === 'potato') {
        if (mode !== 'revive') return;
        if (goldenPotatoBank() <= 0) { syncRewardDialogAvailability('黄金番薯不足'); return; }
        grantPotatoRevive();
      }
      if (choice === 'free_revive') {
        // 广告位申请期专用：免广告复活，不发番薯、不消耗额度。
        if (!rewardDialog.freeReviveAvailable) return;
        grantAdPendingFreeRevive();
      }
    }
    function offerRewardedRevive() {
      if (reviveOffer.busy) return;
      reviveOffer.busy = true;
      if (typeof wx === 'undefined') { finishReviveOffer(false); return; }
      openReviveRewardDialog();
    }
    function resumeStoredReviveCheckpoint(preloadedCheckpoint) {
      if (storedReviveResumeStarted) return;
      var stored = reviveCheckpointIsValid(preloadedCheckpoint) ? preloadedCheckpoint : loadPersistedReviveCheckpoint();
      if (!stored || (stored.action !== 'share_pending' && stored.action !== 'ad_pending' && stored.action !== 'claimed' && stored.action !== 'share_resumed' && stored.action !== 'cooldown_pending')) {
        bootReviveResumePending = false;
        return;
      }
      storedReviveResumeStarted = true;
      bootReviveResumePending = true;
      reviveCheckpoint = stored;
      ensurePackage('res_core');
      ensurePackage('res_scene');
      var resumed = false;
      function resumeWhenReady() {
        if (resumed || !formalPlayResourcesReady()) return;
        resumed = true;
        if (!restoreReviveCheckpoint(false)) {
          // 有有效复活检查点时不允许回落首页。可能只是分包/图片尚未完全就绪，
          // 保持加载场景并重新读取同步存档后重试。
          storedReviveResumeStarted = false;
          bootReviveResumePending = true;
          setScene('loading');
          var retryStored = loadPersistedReviveCheckpoint();
          if (retryStored) reviveCheckpoint = retryStored;
          if (typeof setTimeout === 'function') {
            setTimeout(function() { resumeStoredReviveCheckpoint(retryStored || stored); }, 180);
          }
          return;
        }
        if (stored.action === 'share_resumed') {
          // 玩家在微信“转发成功/查看分享页”流程中导致小游戏重启：
          // 奖励已发放，不重复 +1，直接恢复原关卡黄金番薯操作。
          runStats.shareReviveUsed = true;
          runStats.hearts = Math.max(1, Number(runStats.hearts) || 0);
          reviveOffer.busy = false;
          resetSoulState();
          if (!showGoldenSkillMenu('death', reviveOffer.cause || 'fall', null)) respawnAfterDeath();
          shareResumeGuardActive = true;
          shareViewPageResumePending = true;
          bootReviveResumePending = false;
          if (player) {
            floatingTexts.push({
              x: player.x, y: player.y - 72, value: 1, label: '黄金番薯', age: 0, life: 1.8,
              customText: '已返回当前关卡 · 黄金番薯可用'
            });
          }
          showToastMessage('已返回当前死亡关卡');
          return;
        }
        openReviveRewardDialog(true);
        if (stored.action === 'share_pending') {
          runStats.shareReviveUsed = true;
          grantRewardRevive('share');
          bootReviveResumePending = false;
          enterRewardReviveStage(true, true);
        } else if (stored.action === 'claimed') {
          rewardDialog.claimed = true;
          rewardDialog.claimSource = String(stored.claimSource || 'ad');
          rewardDialog.rewardBefore = Math.max(0, Number(stored.rewardBefore) || 0);
          rewardDialog.rewardAfter = Math.max(rewardDialog.rewardBefore + 1, Number(stored.rewardAfter) || Number(goldenSkillState.points) || 0);
          rewardDialog.adAvailable = false;
          rewardDialog.shareAvailable = false;
          rewardDialog.energyAvailable = false;
          rewardDialogInputLockedUntil = nowMs() + 450;
          bootReviveResumePending = false;
          if (rewardDialog.claimSource === 'share') {
            rewardDialogInputLockedUntil = 0;
            enterRewardReviveStage(true, true);
          } else {
            rewardDialog.message = '已恢复到当前关卡，请按继续游戏';
          }
        } else if (stored.action === 'cooldown_pending') {
          rewardDialog.cooldownUntil = Math.max(0, Number(stored.cooldownUntil) || 0);
          rewardDialog.cooldownText = rewardDialog.cooldownUntil > nowMs() ? formatRecoveryTime(Math.ceil((rewardDialog.cooldownUntil - nowMs()) / 1000)) : '';
          bootReviveResumePending = false;
          if (rewardDialog.cooldownUntil > 0 && nowMs() >= rewardDialog.cooldownUntil) grantCooldownRevive();
          return;
        } else {
          bootReviveResumePending = false;
          rewardDialog.message = '已恢复到当前关卡；广告结果未确认，请重新选择复活方式';
          clearPersistedReviveCheckpoint();
        }
      }
      whenGameplayVisualsReady(resumeWhenReady);
      whenScenePackageReady(resumeWhenReady);
    }
    function getOrCreatePlayerId() {
      var id = '';
      try { id = String(wx.getStorageSync(PLAYER_ID_KEY) || ''); } catch(e) {}
      if (!id) {
        id = 'p_' + String(nowMs()) + '_' + String(Math.floor(Math.random() * 1000000000));
        try { wx.setStorageSync(PLAYER_ID_KEY, id); } catch(e) {}
      }
      return id;
    }
    function sanitizePlayerProfile(profile) {
      profile = profile && typeof profile === 'object' ? profile : {};
      var nick = String(profile.nickName || profile.nickname || '微信玩家').trim();
      if (!nick) nick = '微信玩家';
      return {
        playerId: String(profile.playerId || getOrCreatePlayerId()),
        nickName: nick.slice(0, 20),
        avatarUrl: String(profile.avatarUrl || '').slice(0, 1024),
        // 城市由微信用户资料自动提供（userInfo.city / province），玩家无需手动设置。
        city: String(profile.city || '').slice(0, 24),
        authorized: !!profile.authorized
      };
    }
    function loadPlayerProfile() {
      try {
        var stored = wx.getStorageSync(PLAYER_PROFILE_KEY);
        if (stored && typeof stored === 'object') return sanitizePlayerProfile(stored);
      } catch(e) {}
      return sanitizePlayerProfile({ playerId: getOrCreatePlayerId() });
    }
    function savePlayerProfile() {
      try { wx.setStorageSync(PLAYER_PROFILE_KEY, playerProfile); } catch(e) {}
    }
    function applyUserInfo(userInfo) {
      if (!userInfo || typeof userInfo !== 'object') return false;
      var next = sanitizePlayerProfile({
        playerId: playerProfile.playerId,
        nickName: userInfo.nickName || userInfo.nickname || playerProfile.nickName,
        avatarUrl: userInfo.avatarUrl || playerProfile.avatarUrl,
        // 城市来自微信用户资料，自动填充，无需玩家手动设置。
        city: userInfo.city || userInfo.province || playerProfile.city || '',
        authorized: true
      });
      playerProfile = next;
      savePlayerProfile();
      console.log('[用户资料] 已写入 昵称=' + (playerProfile.nickName || '微信玩家') + ' 城市=' + (playerProfile.city || '(空)'));
      try { var _rl = (typeof wx !== 'undefined' && wx.getRealtimeLogManager && wx.getRealtimeLogManager()); if (_rl && _rl.info) _rl.info('[用户资料] 昵称=' + (playerProfile.nickName || '微信玩家') + ' 城市=' + (playerProfile.city || '(空)')); } catch (e) {}
      return true;
    }
    function isDevtoolsRuntime() {
      var platform = String((sysInfo && sysInfo.platform) || '').toLowerCase();
      var brand = String((sysInfo && sysInfo.brand) || '').toLowerCase();
      return platform === 'devtools' || brand === 'devtools';
    }
    function hasValidLaunchScene() {
      try {
        if (typeof wx === 'undefined' || !wx.getLaunchOptionsSync) return true;
        var options = wx.getLaunchOptionsSync() || {};
        var launchScene = Number(options.scene);
        return isFinite(launchScene) && launchScene >= 0;
      } catch (e) { return false; }
    }
    function requestPlayerProfile(done) {
      done = typeof done === 'function' ? done : function(){};
      console.log('[用户资料] requestPlayerProfile 被调用，当前 authorized=' + playerProfile.authorized + ' city=' + (playerProfile.city || '(空)') + ' profilePromptedThisSession=' + profilePromptedThisSession);
      if (playerProfile.authorized && playerProfile.city) { console.log('[用户资料] 已有授权+城市，直接返回'); done(playerProfile); return; }
      if (profileRequestPending) { console.log('[用户资料] 授权请求进行中，加入队列'); profileRequestQueue.push(done); return; }
      if (profilePromptedThisSession) { console.log('[用户资料] 本次会话已提示过授权，不再重复提示'); done(playerProfile); return; }
      if (playerProfile.authorized && !playerProfile.city) {
        console.log('[用户资料] 已授权但城市为空，尝试重新获取用户资料以补全城市');
      }
      profilePromptedThisSession = true;
      profileRequestPending = true;
      profileRequestQueue = [done];
      var completed = false;
      function finish(info) {
        if (completed) return;
        completed = true;
        if (info) applyUserInfo(info);
        profileRequestPending = false;
        var callbacks = profileRequestQueue.slice();
        profileRequestQueue.length = 0;
        callbacks.forEach(function(callback) { try { callback(playerProfile); } catch(e) {} });
      }
      if (isDevtoolsRuntime() || !hasValidLaunchScene()) { console.log('[用户资料] 当前为开发者工具/无有效启动场景，跳过 getUserProfile'); finish(null); return; }
      try {
        if (typeof wx !== 'undefined' && wx.getUserProfile) {
          console.log('[用户资料] 正在同步调用 wx.getUserProfile 请求授权...');
          wx.getUserProfile({
            desc: '用于排行榜展示你的头像与名称',
            success: function(res) { finish(res && res.userInfo); },
            fail: function() { console.log('[用户资料] 用户拒绝授权或未返回资料'); try { var _rl = (typeof wx !== 'undefined' && wx.getRealtimeLogManager && wx.getRealtimeLogManager()); if (_rl && _rl.info) _rl.info('[用户资料] 用户拒绝授权'); } catch (e) {} finish(null); }
          });
          return;
        }
        if (typeof wx !== 'undefined' && wx.getUserInfo) {
          wx.getUserInfo({
            withCredentials: false,
            success: function(res) { finish(res && res.userInfo); },
            fail: function() { finish(null); }
          });
          return;
        }
      } catch(e) {}
      finish(null);
    }
    function sanitizeLeaderboardEntry(entry) {
      if (!entry || typeof entry !== 'object') return null;
      var nick = String(entry.nickName || entry.nickname || '微信玩家').trim() || '微信玩家';
      return {
        id: String(entry.id || ''),
        playerId: String(entry.playerId || entry.id || ''),
        nickName: nick.slice(0, 20),
        avatarUrl: String(entry.avatarUrl || '').slice(0, 1024),
        score: Math.max(0, Math.round(Number(entry.score) || 0)),
        bestScore: Math.max(0, Math.round(Number(entry.bestScore) || Number(entry.score) || 0)),
        city: String(entry.city || '').slice(0, 24),
        food: Math.max(0, Math.round(Number(entry.food) || 0)),
        stages: Math.max(0, Math.round(Number(entry.stages) || 0)),
        deaths: Math.max(0, Math.round(Number(entry.deaths) || 0)),
        createdAt: Math.max(0, Number(entry.createdAt) || 0),
        updatedAt: Math.max(0, Number(entry.updatedAt) || Number(entry.createdAt) || 0),
        isCurrent: !!entry.isCurrent
      };
    }
    function sortLeaderboard(list) {
      list.sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        if (b.stages !== a.stages) return b.stages - a.stages;
        if (b.food !== a.food) return b.food - a.food;
        return a.updatedAt - b.updatedAt;
      });
      return list;
    }
    function loadLeaderboard() {
      var out = [];
      try {
        var stored = wx.getStorageSync(LEADERBOARD_KEY);
        if (Array.isArray(stored)) stored.forEach(function(entry) { var clean = sanitizeLeaderboardEntry(entry); if (clean) out.push(clean); });
      } catch(e) {}
      return sortLeaderboard(out).slice(0, LEADERBOARD_LIMIT);
    }
    function saveLeaderboard() { try { wx.setStorageSync(LEADERBOARD_KEY, leaderboard.slice(0, LEADERBOARD_LIMIT)); } catch(e) {} }
    function loadPendingLeaderboardSubmission() {
      try {
        var pending = wx.getStorageSync(PENDING_LEADERBOARD_KEY);
        return pending && typeof pending === 'object' ? pending : null;
      } catch (e) { return null; }
    }
    function savePendingLeaderboardSubmission(payload) {
      try { wx.setStorageSync(PENDING_LEADERBOARD_KEY, payload); } catch (e) {}
    }
    function clearPendingLeaderboardSubmission() {
      try { wx.removeStorageSync(PENDING_LEADERBOARD_KEY); } catch (e) {
        try { wx.setStorageSync(PENDING_LEADERBOARD_KEY, null); } catch (e2) {}
      }
    }
    function initCloudLeaderboard() {
      cloudLeaderboardReady = false;
      cloudLeaderboardConnected = false;

      // [2026-10-16 需求] 网页版不连小游戏端 leaderboard 云函数（两套榜互不读写）。
      if (WEB_DISABLE_BUILTIN_LEADERBOARD) return;
      if (!cloudConfig || cloudConfig.enabled !== true) return;

      try {
        if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.init || !wx.cloud.callFunction) return;
        var initOptions = { traceUser: true };
        if (cloudConfig.env) initOptions.env = String(cloudConfig.env);
        wx.cloud.init(initOptions);
        cloudLeaderboardReady = true;
        flushPendingLeaderboardSubmission();
      } catch(e) {
        cloudLeaderboardReady = false;
        cloudLeaderboardConnected = false;
      }
    }
    function applyCloudLeaderboardResult(result) {
      var payload = result && result.result ? result.result : result;
      if (!payload || payload.ok === false || !Array.isArray(payload.list)) return false;
      var next = [];
      payload.list.forEach(function(item) { var clean = sanitizeLeaderboardEntry(item); if (clean) next.push(clean); });
      leaderboard = sortLeaderboard(next).slice(0, LEADERBOARD_LIMIT);
      leaderboardDataVersion++;
      cloudLeaderboardConnected = true;
      var cloudRank = Math.max(0, Math.round(Number(payload.currentRank) || 0));
      lastSubmittedRank = cloudRank;
      if (runStats && runStats.submitted) runStats.rank = cloudRank;
      clampLeaderboardScroll();
      if (leaderboardOpen) scrollLeaderboardToRank(cloudRank);
      saveLeaderboard();
      return true;
    }
    function refreshLeaderboardFromCloud(done) {
      done = typeof done === 'function' ? done : function(){};
      if (!cloudLeaderboardReady) { done(false); return; }
      try {
        wx.cloud.callFunction({
          name: 'leaderboard',
          data: { action: 'list' },
          success: function(res) { done(applyCloudLeaderboardResult(res)); },
          fail: function() { done(false); }
        });
      } catch(e) { done(false); }
    }
    function buildCloudLeaderboardPayload(entry, reason) {
      return {
        action: 'submit',
        nickName: playerProfile.nickName,
        avatarUrl: playerProfile.avatarUrl,
        score: Math.max(0, Math.round(Number(progress.totalScore) || 0)),
        bestScore: Math.max(0, Math.round(Number(progress.bestScore) || 0)),
        city: playerProfile.city || '',
        food: Math.max(0, Math.round(Number(progress.totalFood) || 0)),
        stages: Math.max(0, Math.round(Number(runStats && runStats.stages) || 0)),
        deaths: Math.max(0, Math.round(Number(runStats && runStats.deaths) || 0)),
        lastRunScore: Math.max(0, Math.round(Number(runStats && runStats.score) || 0)),
        entryId: entry && entry.id ? entry.id : '',
        reason: String(reason || 'run_complete'),
        submittedAt: nowMs()
      };
    }
    function sendCloudLeaderboardPayload(payload, done) {
      done = typeof done === 'function' ? done : function(){};
      // [2026-10-16 需求] 网页版不向小游戏端 leaderboard 云函数提交分数。
      if (WEB_DISABLE_BUILTIN_LEADERBOARD) { done(false); return; }
      if (!cloudLeaderboardReady || !payload) { done(false); return; }
      try {
        wx.cloud.callFunction({
          name: 'leaderboard',
          data: payload,
          success: function(res) {
            var ok = applyCloudLeaderboardResult(res);
            if (ok) clearPendingLeaderboardSubmission();
            done(ok);
          },
          fail: function() { done(false); }
        });
      } catch(e) { done(false); }
    }
    function flushPendingLeaderboardSubmission() {
      if (!cloudLeaderboardReady) return;
      var pending = loadPendingLeaderboardSubmission();
      if (pending) sendCloudLeaderboardPayload(pending);
    }
    function submitLeaderboardToCloud(entry, reason) {
      var payload = buildCloudLeaderboardPayload(entry, reason);
      savePendingLeaderboardSubmission(payload);
      if (!cloudConfig || cloudConfig.enabled !== true) return;
      sendCloudLeaderboardPayload(payload);
    }
    function loadLevelOverrideMap() {
      try {
        var stored = wx.getStorageSync(LEVEL_OVERRIDES_KEY);
        return stored && typeof stored === 'object' ? stored : {};
      } catch (e) { return {}; }
    }
    function saveLevelOverrideMap(map) {
      try { wx.setStorageSync(LEVEL_OVERRIDES_KEY, map || {}); } catch (e) {}
    }
    function applyPackStageMetadata(lv, idx) {
      var template = STAGES[idx];
      if (!lv || !template) return lv;
      var nameMatch = /^L(\d+)$/.exec(String(template.name || ''));
      var formalNo = nameMatch ? Number(nameMatch[1]) : 0;
      // ⚠ 2026-10-01：上限必须 ≥ 关卡数。插入杭州关后共 11 关，写死 10 会让 L11（台北夜市）
      //    拿不到 title/theme/backgroundImage 等 metadata，渲染会回退成主题渐变背景。
      if (formalNo < 1 || formalNo > 99) return lv;
      lv.name = template.name;
      lv.cityId = template.cityId || '';   // 判定「当前是不是杭州」统一用 cityId，别靠中文名或序号
      lv.title = template.title;
      lv.titleEn = template.titleEn;
      lv.theme = template.theme;
      lv.backgroundImage = template.backgroundImage;
      lv.backgroundFit = template.backgroundFit;
      lv.backgroundTravelRatio = template.backgroundTravelRatio;
      lv.generatedBy = template.generatedBy;
      lv.generationSeed = template.generationSeed;
      lv.difficulty = template.difficulty;
      // 2026-10-01：原写死 'L4'（当时 L4 = 香港）。杭州插入后香港变 L5，
      // 改用 cityId 判定，避免顺延后这层「香港不是水下关」的兜底错落到杭州身上。
      if (template.cityId === 'hongkong') {
        lv.underwater = false;
        lv.gravityScale = 1;
        lv.waterVelocityScale = 1;
      }
      return lv;
    }
    function loadLevel(index) {
      var idx = clampStageIndex(index);
      // 2026-10-10 恢复编辑器覆盖层自动加载：游戏内编辑器保存的地图写在
      // LEVEL_OVERRIDES_KEY，重启后照常生效（否则「编辑器加的道具再次进入就消失」）。
      // 安全性由 syncLevelPackStorage 的指纹机制保证 —— level_pack.json 一旦变化，
      // 旧覆盖层会被自动清除，新发布地图不会被污染。
      var overrideMap = loadLevelOverrideMap();
      var overridden = overrideMap && overrideMap[String(idx)];
      if (overridden) {
        try { return applyPackStageMetadata(normalizeLevel(clone(overridden)), idx); } catch (e) {}
      }
      return applyPackStageMetadata(getStageTemplate(idx), idx);
    }
    function buildLevelExportPayload(lv) {
      return {
        format: 'super_tongue_axi_level_export_v1',
        stageIndex: stageIndex,
        stageName: String((STAGES[stageIndex] && STAGES[stageIndex].name) || ('stage_' + stageIndex)),
        exportedAt: new Date(nowMs()).toISOString(),
        level: normalizeLevel(clone(lv))
      };
    }
    function buildFullLevelPackPayload() {
      var overrideMap = loadLevelOverrideMap();
      var stages = [];
      for (var i = 0; i < STAGES.length; i++) {
        var source = overrideMap && overrideMap[String(i)] ? overrideMap[String(i)] : STAGES[i];
        if (i === stageIndex && level) source = level;
        var normalized = normalizeLevel(clone(source || STAGES[i] || {}));
        stages.push(normalized);
      }
      var payload = {};
      if (levelPack && typeof levelPack === 'object') {
        for (var key in levelPack) {
          if (!Object.prototype.hasOwnProperty.call(levelPack, key) || key === 'stages' || key === 'defaultLevel') continue;
          payload[key] = clone(levelPack[key]);
        }
      }
      payload.stages = stages;
      payload.defaultLevel = clone((levelPack && levelPack.defaultLevel) || stages[0] || {});
      payload.releaseId = String(payload.releaseId || 'v5.7.9-score-tally-row-alignment-clean-build');
      payload.editorSaved = true;
      payload.editorSavedAt = new Date(nowMs()).toISOString();
      return payload;
    }
    function buildFullLevelPackJson() {
      var payload = buildFullLevelPackPayload();
      return { payload: payload, text: JSON.stringify(payload, null, 2) };
    }
    function safeExportFilePart(value) {
      return String(value || 'level').replace(/[^0-9A-Za-z_\-\u4e00-\u9fa5]/g, '_').slice(0, 48) || 'level';
    }
    function exportTimestampForFile(date) {
      function pad(value, length) {
        var text = String(Math.max(0, Number(value) || 0));
        while (text.length < length) text = '0' + text;
        return text;
      }
      return date.getFullYear()
        + pad(date.getMonth() + 1, 2)
        + pad(date.getDate(), 2) + '_'
        + pad(date.getHours(), 2)
        + pad(date.getMinutes(), 2)
        + pad(date.getSeconds(), 2) + '_'
        + pad(date.getMilliseconds(), 3);
    }
    function exportLevelData(lv) {
      var built = buildFullLevelPackJson();
      var payload = built.payload;
      var text = built.text;
      var result = { payload: payload, text: text, toolsPath: '', latestPath: '', backupPath: '', writeOk: false };
      try {
        var basePath = wx && wx.env && wx.env.USER_DATA_PATH ? wx.env.USER_DATA_PATH : '';
        if (!basePath || !wx.getFileSystemManager) return result;
        var fs = wx.getFileSystemManager();
        var toolsPath = editorEnsureCanonicalMapDirectory();
        var latestPath = toolsPath + '/level_pack.json';
        var backupPath = toolsPath + '/level_pack_' + exportTimestampForFile(new Date(nowMs())) + '.json';
        editorWriteVerifiedLevelPack(latestPath, text);
        editorWriteVerifiedLevelPack(backupPath, text);
        result.toolsPath = toolsPath;
        result.latestPath = latestPath;
        result.backupPath = backupPath;
        result.writeOk = true;
      } catch (e) {
        result.writeOk = false;
      }
      return result;
    }
    var editorNativeToolsChecked = false;
    var editorNativeFs = null;
    var editorNativePath = null;
    var editorNativeDialog = null;
    var editorNativeClipboard = null;
    var EDITOR_MAP_DIRECTORY = 'TOOLS';
    var EDITOR_LEGACY_MAP_DIRECTORIES = ['tools', 'Tools', 'maps', 'Maps', 'MAPS'];
    var editorMapMigrationChecked = false;

    function ensureEditorNativeTools() {
      if (editorNativeToolsChecked) return;
      editorNativeToolsChecked = true;
      try { editorNativeFs = require('fs'); } catch (e0) { editorNativeFs = null; }
      try { editorNativePath = require('path'); } catch (e1) { editorNativePath = null; }
      try {
        var electron = require('electron');
        editorNativeDialog = electron && (electron.dialog || (electron.remote && electron.remote.dialog));
        editorNativeClipboard = electron && (electron.clipboard || (electron.remote && electron.remote.clipboard));
      } catch (e2) { editorNativeDialog = null; editorNativeClipboard = null; }
    }

    function editorCanUseNativeSaveDialog() {
      ensureEditorNativeTools();
      return !!(editorNativeDialog && editorNativeDialog.showSaveDialogSync &&
        editorNativeFs && editorNativeFs.writeFileSync &&
        editorNativePath && editorNativePath.join);
    }
    function editorCanUseNativeOpenDialog() {
      ensureEditorNativeTools();
      return !!(editorNativeDialog && editorNativeDialog.showOpenDialogSync &&
        editorNativeFs && editorNativeFs.readFileSync &&
        editorNativePath && editorNativePath.join);
    }

    function editorUserDataPath() {
      try { return String(wx && wx.env && wx.env.USER_DATA_PATH || ''); } catch (e) { return ''; }
    }
    function editorCanonicalMapDirectory() {
      var base = editorUserDataPath();
      return base ? base.replace(/[\\/]$/, '') + '/' + EDITOR_MAP_DIRECTORY : EDITOR_MAP_DIRECTORY;
    }
    function editorFsPathExists(fs, pathValue) {
      try {
        if (fs && fs.accessSync) { fs.accessSync(pathValue); return true; }
        if (fs && fs.statSync) return !!fs.statSync(pathValue);
      } catch (e) {}
      return false;
    }
    function editorMigrationDestination(fs, targetDir, sourcePath, fileName, legacyName) {
      var directPath = targetDir + '/' + fileName;
      if (!editorFsPathExists(fs, directPath)) return { path: directPath, duplicate: false };
      try {
        var sourceText = String(fs.readFileSync(sourcePath, 'utf8'));
        var targetText = String(fs.readFileSync(directPath, 'utf8'));
        if (sourceText === targetText) return { path: directPath, duplicate: true };
      } catch (compareError) {}
      var stem = String(fileName || 'map').replace(/\.json$/i, '');
      var tag = String(legacyName || 'legacy').toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'legacy';
      var candidate = '';
      for (var suffix = 1; suffix < 10000; suffix++) {
        candidate = targetDir + '/' + stem + '_from_' + tag + (suffix > 1 ? '_' + suffix : '') + '.json';
        if (!editorFsPathExists(fs, candidate)) return { path: candidate, duplicate: false };
      }
      candidate = targetDir + '/' + stem + '_from_' + tag + '_' + String(Date.now()) + '.json';
      return { path: candidate, duplicate: false };
    }
    function editorMoveMapFile(fs, sourcePath, targetPath) {
      try {
        if (fs.renameSync) { fs.renameSync(sourcePath, targetPath); return true; }
      } catch (renameError) {}
      try {
        var text = fs.readFileSync(sourcePath, 'utf8');
        fs.writeFileSync(targetPath, text, 'utf8');
        try { if (fs.unlinkSync) fs.unlinkSync(sourcePath); } catch (unlinkError) {}
        return true;
      } catch (copyError) { return false; }
    }
    function editorRemoveEmptyLegacyMapsDirectory(fs, legacyDir, legacyName) {
      if (String(legacyName || '').toLowerCase() !== 'maps') return;
      try {
        var remaining = fs.readdirSync(legacyDir) || [];
        if (!remaining.length && fs.rmdirSync) fs.rmdirSync(legacyDir);
      } catch (removeLegacyDirError) {}
    }
    function editorEnsureCanonicalMapDirectory() {
      var target = editorCanonicalMapDirectory();
      editorEnsureDirectory(target);
      if (editorMapMigrationChecked) return target;
      editorMapMigrationChecked = true;
      var base = editorUserDataPath();
      if (!base || typeof wx === 'undefined' || !wx.getFileSystemManager) return target;
      var fs = wx.getFileSystemManager();
      for (var d = 0; d < EDITOR_LEGACY_MAP_DIRECTORIES.length; d++) {
        var legacyName = EDITOR_LEGACY_MAP_DIRECTORIES[d];
        if (legacyName === EDITOR_MAP_DIRECTORY) continue;
        var legacyDir = base.replace(/[\\/]$/, '') + '/' + legacyName;
        var names = null;
        try { names = fs.readdirSync(legacyDir); } catch (readLegacyError) { names = null; }
        if (!names || !names.length) {
          editorRemoveEmptyLegacyMapsDirectory(fs, legacyDir, legacyName);
          continue;
        }
        for (var i = 0; i < names.length; i++) {
          var name = String(names[i] || '');
          if (!/\.json$/i.test(name)) continue;
          var sourcePath = legacyDir + '/' + name;
          var destination = editorMigrationDestination(fs, target, sourcePath, name, legacyName);
          if (destination.duplicate) {
            // tools/TOOLS 在部分平台可能指向同一目录，避免误删同一个文件。
            if (String(legacyName).toLowerCase() !== String(EDITOR_MAP_DIRECTORY).toLowerCase()) {
              try { if (fs.unlinkSync) fs.unlinkSync(sourcePath); } catch (unlinkDuplicateError) {}
            }
            continue;
          }
          editorMoveMapFile(fs, sourcePath, destination.path);
        }
        editorRemoveEmptyLegacyMapsDirectory(fs, legacyDir, legacyName);
      }
      return target;
    }
    function editorIsNativeAbsolutePath(value) {
      var text = String(value || '');
      return /^[A-Za-z]:[\\/]/.test(text) || /^\\\\/.test(text) || /^\//.test(text);
    }
    function editorNormalizeFileName(value) {
      var text = String(value || '').trim().replace(/[\\/:*?"<>|]/g, '_');
      if (!text) text = 'level_' + String(stageIndex) + '_' + exportTimestampForFile(new Date(nowMs()));
      if (!/\.json$/i.test(text)) text += '.json';
      return text.slice(0, 120);
    }
    function editorDefaultExportFileName() {
      return 'level_pack.json';
    }
    function editorPathWithinBase(pathValue, baseValue) {
      var pathText = String(pathValue || '').replace(/\\/g, '/').replace(/\/$/, '');
      var baseText = String(baseValue || '').replace(/\\/g, '/').replace(/\/$/, '');
      if (!pathText || !baseText) return false;
      if (/^[A-Za-z]:\//.test(pathText) || /^[A-Za-z]:\//.test(baseText)) {
        pathText = pathText.toLowerCase();
        baseText = baseText.toLowerCase();
      }
      return pathText === baseText || pathText.indexOf(baseText + '/') === 0;
    }
    function editorDirectoryForDisplay(pathValue) {
      var text = String(pathValue || '').replace(/\\/g, '/').replace(/\/$/, '');
      var base = editorUserDataPath();
      if (base && editorPathWithinBase(text, base)) {
        var normalizedBase = String(base).replace(/\\/g, '/').replace(/\/$/, '');
        var relative = text.slice(normalizedBase.length).replace(/^\/+/, '');
        return relative || EDITOR_MAP_DIRECTORY;
      }
      return text || EDITOR_MAP_DIRECTORY;
    }
    function editorJoinPath(dir, name) {
      ensureEditorNativeTools();
      if (editorIsNativeAbsolutePath(dir) && editorNativePath && editorNativePath.join) return editorNativePath.join(dir, name);
      return String(dir || '').replace(/[\\/]$/, '') + '/' + String(name || '').replace(/^[\\/]/, '');
    }
    function editorPathDirname(pathValue) {
      ensureEditorNativeTools();
      var text = String(pathValue || '');
      if (editorIsNativeAbsolutePath(text) && editorNativePath && editorNativePath.dirname) return editorNativePath.dirname(text);
      var normalized = text.replace(/\\/g, '/');
      var idx = normalized.lastIndexOf('/');
      return idx >= 0 ? normalized.slice(0, idx) : '';
    }
    function editorPathBasename(pathValue) {
      ensureEditorNativeTools();
      var text = String(pathValue || '');
      if (editorIsNativeAbsolutePath(text) && editorNativePath && editorNativePath.basename) return editorNativePath.basename(text);
      var normalized = text.replace(/\\/g, '/');
      return normalized.slice(normalized.lastIndexOf('/') + 1);
    }
    function editorEnsureDirectory(pathValue) {
      ensureEditorNativeTools();
      if (editorIsNativeAbsolutePath(pathValue) && editorNativeFs) {
        if (editorNativeFs.existsSync && editorNativeFs.existsSync(pathValue)) return;
        if (editorNativeFs.mkdirSync) {
          try { editorNativeFs.mkdirSync(pathValue, { recursive: true }); return; } catch (e0) {}
        }
      }
      if (typeof wx === 'undefined' || !wx.getFileSystemManager) throw new Error('当前环境没有可用的文件系统');
      var fs = wx.getFileSystemManager();
      try { fs.mkdirSync(pathValue, true); }
      catch (e1) { if (fs.accessSync) fs.accessSync(pathValue); else throw e1; }
    }
    function editorWriteTextFile(pathValue, text) {
      ensureEditorNativeTools();
      if (editorIsNativeAbsolutePath(pathValue) && editorNativeFs && editorNativeFs.writeFileSync && editorNativePath && editorNativePath.join) {
        editorEnsureDirectory(editorPathDirname(pathValue));
        editorNativeFs.writeFileSync(pathValue, text, 'utf8');
        return String(pathValue);
      }

      var userBase = editorUserDataPath();
      if (!userBase) throw new Error('无法取得小游戏用户资料目录');
      var targetPath = String(pathValue || '');
      if (!editorPathWithinBase(targetPath, userBase)) {
        targetPath = editorJoinPath(editorEnsureCanonicalMapDirectory(), editorPathBasename(targetPath) || editorDefaultExportFileName());
      }
      if (typeof wx === 'undefined' || !wx.getFileSystemManager) throw new Error('当前环境没有可用的文件系统');
      editorEnsureDirectory(editorPathDirname(targetPath));
      wx.getFileSystemManager().writeFileSync(targetPath, text, 'utf8');
      return targetPath;
    }
    function editorWriteVerifiedLevelPack(pathValue, text) {
      var actualPath = editorWriteTextFile(pathValue, text);
      var verifyText = editorReadTextFile(actualPath).replace(/^\uFEFF/, '');
      var verify = JSON.parse(verifyText);
      if (!verify || !Array.isArray(verify.stages) || verify.stages.length !== STAGES.length) throw new Error('写入后验证失败：关卡数量不一致');
      var expectedTutorials = STAGES.filter(function(stage) { return !!(stage && stage.isTutorial); }).length;
      var savedTutorials = verify.stages.filter(function(stage) { return !!(stage && stage.isTutorial); }).length;
      if (savedTutorials !== expectedTutorials) throw new Error('写入后验证失败：教学关未完整保存');
      return actualPath;
    }
    function editorReadTextFile(pathValue) {
      ensureEditorNativeTools();
      if (editorIsNativeAbsolutePath(pathValue) && editorNativeFs && editorNativeFs.readFileSync) return String(editorNativeFs.readFileSync(pathValue, 'utf8'));
      if (typeof wx === 'undefined' || !wx.getFileSystemManager) throw new Error('当前环境没有可用的文件系统');
      return String(wx.getFileSystemManager().readFileSync(pathValue, 'utf8'));
    }
    function editorFileModifiedTime(pathValue) {
      ensureEditorNativeTools();
      try {
        if (editorIsNativeAbsolutePath(pathValue) && editorNativeFs && editorNativeFs.statSync) {
          var nativeStat = editorNativeFs.statSync(pathValue);
          return Number(nativeStat && (nativeStat.mtimeMs || (nativeStat.mtime && nativeStat.mtime.getTime && nativeStat.mtime.getTime()))) || 0;
        }
      } catch (nativeStatError) {}
      try {
        if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
          var wxStat = wx.getFileSystemManager().statSync(pathValue);
          return Number(wxStat && (wxStat.lastModifiedTime || wxStat.mtimeMs || wxStat.mtime)) || 0;
        }
      } catch (wxStatError) {}
      return 0;
    }
    function editorListJsonFilesFromDirectory() {
      var resolved = editorEnsureCanonicalMapDirectory();
      var files = [];
      ensureEditorNativeTools();
      var names = null;
      var userBase = editorUserDataPath();
      if (userBase && String(resolved).indexOf(userBase) === 0) editorEnsureDirectory(resolved);
      if (editorIsNativeAbsolutePath(resolved) && editorNativeFs && editorNativeFs.readdirSync) {
        names = editorNativeFs.readdirSync(resolved);
        (names || []).forEach(function(name) {
          if (!/\.json$/i.test(String(name))) return;
          var pathValue = editorJoinPath(resolved, String(name));
          files.push({ name: String(name), path: pathValue, source: 'native', modifiedTime: editorFileModifiedTime(pathValue) });
        });
      } else {
        if (typeof wx === 'undefined' || !wx.getFileSystemManager) throw new Error('当前环境没有可用的文件系统');
        names = wx.getFileSystemManager().readdirSync(resolved);
        (names || []).forEach(function(name) {
          if (!/\.json$/i.test(String(name))) return;
          var pathValue = editorJoinPath(resolved, String(name));
          files.push({ name: String(name), path: pathValue, source: 'user', modifiedTime: editorFileModifiedTime(pathValue) });
        });
      }
      files.sort(function(a, b) {
        var timeDelta = Number(b.modifiedTime || 0) - Number(a.modifiedTime || 0);
        return timeDelta || String(a.name).localeCompare(String(b.name));
      });
      return files;
    }

    function ensureEditorFileDialogState() {
      if (!editorState.fileDialog || typeof editorState.fileDialog !== 'object') {
        editorState.fileDialog = { open: false, view: 'menu', dir: EDITOR_MAP_DIRECTORY, filename: editorDefaultExportFileName(), files: [], selected: -1, page: 0, message: '', error: false, busy: false, exportDir: '' };
      }
      return editorState.fileDialog;
    }
    function closeEditorFileDialog() {
      var state = ensureEditorFileDialogState();
      state.open = false; state.busy = false; state.message = ''; state.error = false;
    }
    function openEditorFileDialog() {
      var state = ensureEditorFileDialogState();
      state.open = true; state.view = 'menu'; state.busy = false; state.message = ''; state.error = false;
      state.filename = state.filename || editorDefaultExportFileName();
      editorState.drag = null;
    }
    function openEditorSaveAsView() {
      var state = ensureEditorFileDialogState();
      state.open = true; state.view = 'save'; state.busy = false; state.message = ''; state.error = false;
      state.dir = EDITOR_MAP_DIRECTORY;
      state.filename = editorDefaultExportFileName();
      try { editorEnsureCanonicalMapDirectory(); } catch (ensureMapDirError) {}
    }
    function refreshEditorLoadFiles() {
      var state = ensureEditorFileDialogState();
      state.busy = true; state.message = ''; state.error = false; state.selected = -1; state.page = 0;
      try {
        state.dir = EDITOR_MAP_DIRECTORY;
        state.files = editorListJsonFilesFromDirectory();
        state.message = state.files.length ? ('找到 ' + state.files.length + ' 个 JSON 地图文件（最新优先）') : 'TOOLS 内没有 .json 地图文件';
      } catch (e) {
        state.files = [];
        state.message = '读取失败：' + String(e && e.message || e);
        state.error = true;
      }
      state.busy = false;
    }
    function openEditorLoadView() {
      var state = ensureEditorFileDialogState();
      state.open = true; state.view = 'load'; state.busy = false; state.message = ''; state.error = false;
      state.dir = EDITOR_MAP_DIRECTORY;
      refreshEditorLoadFiles();
    }

    function promptEditorText(title, currentValue, done) {
      done = typeof done === 'function' ? done : function(){};
      if (typeof wx === 'undefined' || !wx.showModal) { showToastMessage('当前环境不支持文字输入'); return; }
      try {
        wx.showModal({
          title: String(title || '请输入'),
          content: String(currentValue || ''),
          editable: true,
          placeholderText: String(currentValue || ''),
          confirmText: '确定',
          cancelText: '取消',
          success: function(res) {
            if (!res || !res.confirm) return;
            var value = res.content !== undefined ? String(res.content) : String(currentValue || '');
            done(value.trim());
          },
          fail: function() { showToastMessage('输入框开启失败'); }
        });
      } catch (e) { showToastMessage('输入框开启失败'); }
    }

    function editEditorDialogFileName() {
      var state = ensureEditorFileDialogState();
      promptEditorText('输入 JSON 文件名', state.filename || editorDefaultExportFileName(), function(value) {
        state.filename = editorNormalizeFileName(value);
      });
    }

    function saveEditorMapToSpecificPath(pathValue) {
      var state = ensureEditorFileDialogState();
      state.busy = true; state.message = ''; state.error = false;
      try {
        saveLevel(runtimeLevel);
        var built = buildFullLevelPackJson();
        var actualPath = editorWriteVerifiedLevelPack(pathValue, built.text);
        state.dir = EDITOR_MAP_DIRECTORY;
        state.filename = editorPathBasename(actualPath) || state.filename;
        state.message = '完整地图包已保存：' + editorDirectoryForDisplay(actualPath);
        state.error = false;
        editorState.dirty = false;
        showToastMessage('完整地图包已保存');
      } catch (e) {
        state.message = '保存失败：' + String(e && e.message || e);
        state.error = true;
        showToastMessage('地图保存失败');
      }
      state.busy = false;
    }
    function confirmEditorSaveAs() {
      var state = ensureEditorFileDialogState();
      if (state.busy) return;
      var dir = editorEnsureCanonicalMapDirectory();
      var fileName = editorNormalizeFileName(state.filename || editorDefaultExportFileName());
      state.filename = fileName;
      // 优先写本地（小游戏 / 原生桌面环境）。
      // 网页端没有可用的本地文件系统 → saveEditorMapToSpecificPath 会失败，
      // 此时回退为「浏览器下载 JSON 文件」，保证「另存一份 Json」在网页端也能成功。
      saveEditorMapToSpecificPath(editorJoinPath(dir, fileName));
      if (state.error) {
        // 网页端回退链：浏览器下载 JSON 文件 → 剪贴板复制
        try {
          saveLevel(runtimeLevel);
          var built = buildFullLevelPackJson();
          if (editorDownloadJsonInBrowser(fileName, built.text)) {
            state.busy = false; state.error = false;
            state.message = '已下载 JSON 文件：' + fileName + '（本环境不支持本地保存，已改为下载）';
            editorState.dirty = false;
            showToastMessage('地图 JSON 已下载');
            return;
          }
        } catch (e2) {}
        try {
          saveLevel(runtimeLevel);
          var built2 = buildFullLevelPackJson();
          editorCopyTextToClipboard(built2.text, function (ok, message) {
            state.busy = false; state.error = !ok;
            state.message = ok ? ('当前环境无法下载，已复制 JSON：' + fileName) : ('另存失败：' + message);
            if (ok) { editorState.dirty = false; showToastMessage('已复制 JSON'); }
          });
          return;
        } catch (e3) {}
        state.busy = false; state.error = true;
        state.message = '另存失败：当前环境既不支持本地保存也不支持下载';
      }
    }

    function editorBuildCurrentMapJson() {
      saveLevel(runtimeLevel);
      return buildFullLevelPackJson();
    }
    function editorCopyTextToClipboard(text, done) {
      done = typeof done === 'function' ? done : function(){};
      var completed = false;
      function finish(ok, message) {
        if (completed) return;
        completed = true;
        done(!!ok, String(message || ''));
      }
      try {
        if (typeof wx !== 'undefined' && wx.setClipboardData) {
          wx.setClipboardData({
            data: String(text || ''),
            success: function() { finish(true, 'JSON 已复制到系统剪贴板'); },
            fail: function(res) { finish(false, String(res && (res.errMsg || res.message) || '微信剪贴板写入失败')); }
          });
          return true;
        }
      } catch (e0) {}
      ensureEditorNativeTools();
      try {
        if (editorNativeClipboard && editorNativeClipboard.writeText) {
          editorNativeClipboard.writeText(String(text || ''));
          finish(true, 'JSON 已复制到系统剪贴板');
          return true;
        }
      } catch (e1) {}
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          var promise = navigator.clipboard.writeText(String(text || ''));
          if (promise && promise.then) promise.then(function(){ finish(true, 'JSON 已复制到系统剪贴板'); }, function(err){ finish(false, String(err && err.message || '浏览器剪贴板写入失败')); });
          else finish(true, 'JSON 已复制到系统剪贴板');
          return true;
        }
      } catch (e2) {}
      try {
        if (typeof document !== 'undefined' && document.createElement && document.body) {
          var area = document.createElement('textarea');
          area.value = String(text || '');
          area.setAttribute('readonly', 'readonly');
          area.style.position = 'fixed'; area.style.left = '-9999px'; area.style.top = '-9999px';
          document.body.appendChild(area); area.select();
          var copied = !!document.execCommand('copy');
          document.body.removeChild(area);
          finish(copied, copied ? 'JSON 已复制到系统剪贴板' : '浏览器拒绝复制');
          return copied;
        }
      } catch (e3) {}
      finish(false, '当前环境不支持复制到剪贴板');
      return false;
    }
    function editorDownloadJsonInBrowser(fileName, text) {
      try {
        if (typeof document === 'undefined' || !document.createElement || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return false;
        var blob = new Blob([String(text || '')], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url; link.download = editorNormalizeFileName(fileName); link.style.display = 'none';
        if (document.body) document.body.appendChild(link);
        if (link.click) link.click();
        if (document.body && link.parentNode) document.body.removeChild(link);
        setTimeout(function(){ try { URL.revokeObjectURL(url); } catch (e0) {} }, 1000);
        return true;
      } catch (e) { return false; }
    }
    function copyEditorMapJson() {
      var state = ensureEditorFileDialogState();
      if (state.busy) return;
      state.busy = true; state.message = ''; state.error = false;
      var built = null;
      try { built = editorBuildCurrentMapJson(); }
      catch (e0) {
        state.busy = false; state.error = true; state.message = '生成 JSON 失败：' + String(e0 && e0.message || e0); showToastMessage('JSON 生成失败'); return;
      }
      editorCopyTextToClipboard(built.text, function(ok, message) {
        state.busy = false; state.error = !ok;
        state.message = ok ? (message + '，内容为全部地图，可直接保存为 level_pack.json。') : ('复制失败：' + message);
        if (ok) { editorState.dirty = false; showToastMessage('完整地图包已复制'); }
        else showToastMessage('复制 JSON 失败');
      });
    }
    function exportEditorMapToComputer() {
      var state = ensureEditorFileDialogState();
      if (state.busy) return;
      state.busy = true; state.message = ''; state.error = false;
      var built = null;
      var fileName = editorNormalizeFileName(state.filename || editorDefaultExportFileName());
      state.filename = fileName;
      try { built = editorBuildCurrentMapJson(); }
      catch (e0) {
        state.busy = false; state.error = true; state.message = '生成 JSON 失败：' + String(e0 && e0.message || e0); showToastMessage('JSON 生成失败'); return;
      }

      if (editorCanUseNativeSaveDialog()) {
        try {
          var defaultPath = state.exportDir ? editorJoinPath(state.exportDir, fileName) : fileName;
          var result = editorNativeDialog.showSaveDialogSync({ title: '导出地图 JSON 到电脑', defaultPath: defaultPath, filters: [{ name: '地图 JSON', extensions: ['json'] }] });
          if (!result) { state.busy = false; state.message = '已取消导出'; return; }
          var nativePath = /\.json$/i.test(String(result)) ? String(result) : String(result) + '.json';
          editorEnsureDirectory(editorPathDirname(nativePath));
          editorNativeFs.writeFileSync(nativePath, built.text, 'utf8');
          state.exportDir = editorPathDirname(nativePath); state.filename = editorPathBasename(nativePath);
          state.busy = false; state.error = false; state.message = '已导出到电脑：' + nativePath;
          editorState.dirty = false; showToastMessage('地图已导出到电脑'); return;
        } catch (e1) {}
      }

      if (editorDownloadJsonInBrowser(fileName, built.text)) {
        state.busy = false; state.error = false; state.message = '浏览器已开始下载：' + fileName;
        editorState.dirty = false; showToastMessage('地图 JSON 已下载'); return;
      }

      var sharePath = '';
      try {
        var shareDir = editorEnsureCanonicalMapDirectory();
        sharePath = editorWriteTextFile(editorJoinPath(shareDir, fileName), built.text);
      } catch (e2) {}
      if (sharePath && typeof wx !== 'undefined' && wx.shareFileMessage) {
        try {
          wx.shareFileMessage({
            filePath: sharePath,
            fileName: fileName,
            success: function() {
              state.busy = false; state.error = false;
              state.message = '已打开文件分享。请发送到“文件传输助手”，再从电脑微信下载。';
              editorState.dirty = false; showToastMessage('请选择接收位置');
            },
            fail: function() {
              editorCopyTextToClipboard(built.text, function(ok, message) {
                state.busy = false; state.error = !ok;
                state.message = ok ? '文件分享不可用，已改为复制 JSON；请在电脑粘贴保存。' : ('导出失败：' + message);
                if (ok) { editorState.dirty = false; showToastMessage('已改为复制 JSON'); }
                else showToastMessage('地图导出失败');
              });
            }
          });
          return;
        } catch (e3) {}
      }

      editorCopyTextToClipboard(built.text, function(ok, message) {
        state.busy = false; state.error = !ok;
        state.message = ok ? '当前环境不能直接下载，已复制 JSON；请在电脑粘贴并保存为 ' + fileName : ('导出失败：' + message);
        if (ok) { editorState.dirty = false; showToastMessage('已复制 JSON'); }
        else showToastMessage('地图导出失败');
      });
    }

    function editorLooksLikeLevel(value) {
      return !!(value && typeof value === 'object' && value.start && value.finish && (Array.isArray(value.anchors) || Array.isArray(value.walls) || Number(value.width) > 0));
    }
    function parseEditorMapPayload(text, pathValue) {
      var clean = String(text || '').replace(/^\uFEFF/, '');
      var data = JSON.parse(clean);
      var importedStageIndex = -1;
      var importedLevel = null;
      if (data && data.format === 'super_tongue_axi_level_export_v1' && editorLooksLikeLevel(data.level)) {
        importedLevel = data.level;
        if (isFinite(Number(data.stageIndex))) importedStageIndex = clampStageIndex(Number(data.stageIndex));
      } else if (data && editorLooksLikeLevel(data.level)) {
        importedLevel = data.level;
        if (isFinite(Number(data.stageIndex))) importedStageIndex = clampStageIndex(Number(data.stageIndex));
      } else if (data && Array.isArray(data.stages) && data.stages.length) {
        var pick = clampStageIndex(stageIndex);
        var currentName = String((STAGES[stageIndex] && STAGES[stageIndex].name) || '');
        for (var i = 0; i < data.stages.length; i++) {
          if (currentName && String(data.stages[i] && data.stages[i].name || '') === currentName) { pick = i; break; }
        }
        pick = Math.max(0, Math.min(data.stages.length - 1, pick));
        importedLevel = data.stages[pick];
        importedStageIndex = clampStageIndex(pick);
        if (!editorLooksLikeLevel(importedLevel)) throw new Error('level_pack.json 内缺少当前关卡');
        return { level: importedLevel, stageIndex: importedStageIndex, sourcePath: pathValue, pack: data };
      } else if (editorLooksLikeLevel(data)) {
        importedLevel = data;
      }
      if (!editorLooksLikeLevel(importedLevel)) throw new Error('文件不是可识别的地图 JSON');
      return { level: importedLevel, stageIndex: importedStageIndex, sourcePath: pathValue };
    }
    function applyImportedEditorMap(parsed) {
      if (!parsed || !parsed.level) throw new Error('地图内容为空');
      var previousStage = stageIndex;
      if (parsed.pack && Array.isArray(parsed.pack.stages)) {
        var importedStages = parsed.pack.stages;
        var importedByName = {};
        for (var pi = 0; pi < importedStages.length; pi++) {
          var importedName = String(importedStages[pi] && importedStages[pi].name || '');
          if (importedName) importedByName[importedName] = importedStages[pi];
        }
        var fullOverrideMap = {};
        for (var si = 0; si < STAGES.length; si++) {
          var currentName = String(STAGES[si] && STAGES[si].name || '');
          var sourceStage = (currentName && importedByName[currentName]) || importedStages[si];
          if (!editorLooksLikeLevel(sourceStage)) continue;
          var normalizedStage = normalizeLevel(clone(sourceStage));
          STAGES[si] = clone(normalizedStage);
          fullOverrideMap[String(si)] = clone(normalizedStage);
        }
        saveLevelOverrideMap(fullOverrideMap);
        if (levelPack && typeof levelPack === 'object') {
          levelPack.stages = STAGES.map(function(item) { return clone(item); });
          if (parsed.pack.defaultLevel) levelPack.defaultLevel = clone(parsed.pack.defaultLevel);
        }
      }
      if (parsed.stageIndex >= 0) stageIndex = clampStageIndex(parsed.stageIndex);
      if (stageIndex !== previousStage) {
        editorState.returnScene = 'menu';
        editorState.playerSnapshot = null;
        editorState.collectedById = {};
        editorState.cameraSnapshot = 0;
      }
      defaultLevel = clone(STAGES[stageIndex] || STAGES[0] || {});
      level = normalizeLevel(clone((parsed.pack && STAGES[stageIndex]) || parsed.level));
      runtimeLevel = clone(level);
      runtimeLevel = applyRoundStageRules(runtimeLevel) || runtimeLevel;
      rebuildRuntimeSpatialIndex();
      runtimeLevel.foods.forEach(function(f) { f.collected = false; });
      editorState.jumpStage = normalizeEditorJumpStage(stageIndex);
      editorState.selected = null; editorState.drag = null; editorState.dirty = true;
      player = makePlayer();
      cameraX = 0; editorState.cameraY = 0;
      updateEditorZoomBounds();
      fitEditorMap();
      particles = []; floatingTexts = []; screenShake = 0;
    }
    function loadEditorMapFromPath(pathValue) {
      var state = ensureEditorFileDialogState();
      state.busy = true; state.message = ''; state.error = false;
      try {
        if (!/\.json$/i.test(String(pathValue || ''))) throw new Error('只允许载入 .json 文件');
        var parsed = parseEditorMapPayload(editorReadTextFile(pathValue), pathValue);
        applyImportedEditorMap(parsed);
        state.dir = EDITOR_MAP_DIRECTORY;
        state.filename = editorPathBasename(pathValue) || state.filename;
        state.message = '已载入：' + pathValue;
        state.error = false;
        state.open = false;
        showToastMessage(parsed.pack ? '全部地图已载入' : '地图已载入');
      } catch (e) {
        state.message = '载入失败：' + String(e && e.message || e);
        state.error = true;
        showToastMessage('地图载入失败');
      }
      state.busy = false;
    }
    function confirmEditorLoad() {
      var state = ensureEditorFileDialogState();
      if (state.busy) return;
      var index = Number(state.selected);
      if (!isFinite(index) || index < 0 || !state.files[index]) { state.message = '请先选择一个 .json 地图文件'; state.error = true; return; }
      loadEditorMapFromPath(state.files[index].path);
    }
    function tryChooseExternalEditorJson() {
      var state = ensureEditorFileDialogState();
      ensureEditorNativeTools();
      if (editorCanUseNativeOpenDialog()) {
        try {
          var result = editorNativeDialog.showOpenDialogSync({ title: '选择地图 JSON', properties: ['openFile'], filters: [{ name: '地图 JSON', extensions: ['json'] }] });
          if (result && result[0]) loadEditorMapFromPath(String(result[0]));
          return;
        } catch (e0) {}
      }
      if (typeof wx !== 'undefined' && wx.chooseMessageFile) {
        try {
          wx.chooseMessageFile({
            count: 1,
            type: 'file',
            success: function(res) {
              var file = res && res.tempFiles && res.tempFiles[0];
              if (!file || !/\.json$/i.test(String(file.name || file.path || ''))) { state.message = '请选择 .json 地图文件'; state.error = true; return; }
              loadEditorMapFromPath(String(file.path || file.tempFilePath || ''));
            },
            fail: function() { state.message = '未选择外部 JSON 文件'; state.error = false; }
          });
          return;
        } catch (e1) {}
      }
      state.message = '当前环境不支持文件选择；请使用 TOOLS 目录或复制 JSON。';
      state.error = true;
    }

    function handleEditorFileDialogPress(px, py) {
      var state = ensureEditorFileDialogState();
      if (!state.open) return false;
      if (pointInCircle(px, py, uiHotspots.editorFileClose)) { closeEditorFileDialog(); return true; }
      if (state.view === 'menu') {
        if (pointInRect(px, py, uiHotspots.editorFileSaveAs)) { triggerHaptic('light'); playUiClickSound(); openEditorSaveAsView(); return true; }
        if (pointInRect(px, py, uiHotspots.editorFileLoadMap)) { triggerHaptic('light'); playUiClickSound(); openEditorLoadView(); return true; }
        if (pointInRect(px, py, uiHotspots.editorFileQuickCopy)) { triggerHaptic('light'); copyEditorMapJson(); return true; }
        if (pointInRect(px, py, uiHotspots.editorFileExit)) { closeEditorFileDialog(); saveAndExitEditor(); return true; }
        return true;
      }
      if (pointInRect(px, py, uiHotspots.editorFileBack)) { state.view = 'menu'; state.message = ''; state.error = false; return true; }
      if (state.view === 'save') {
        if (pointInRect(px, py, uiHotspots.editorFileName)) { editEditorDialogFileName(); return true; }
        if (pointInRect(px, py, uiHotspots.editorFileExportPc)) { triggerHaptic('medium'); exportEditorMapToComputer(); return true; }
        if (pointInRect(px, py, uiHotspots.editorFileCopyJson)) { triggerHaptic('light'); copyEditorMapJson(); return true; }
        if (pointInRect(px, py, uiHotspots.editorFileConfirmSave)) { triggerHaptic('medium'); confirmEditorSaveAs(); return true; }
        return true;
      }
      if (pointInRect(px, py, uiHotspots.editorFileBrowse)) { tryChooseExternalEditorJson(); return true; }
      if (pointInRect(px, py, uiHotspots.editorFileRefresh)) { refreshEditorLoadFiles(); return true; }
      var rows = uiHotspots.editorFileRows || [];
      for (var i = 0; i < rows.length; i++) {
        if (pointInRect(px, py, rows[i])) {
          var idx = Number(rows[i].fileIndex);
          if (idx >= 0 && state.files[idx]) { state.selected = idx; triggerHaptic('light'); }
          return true;
        }
      }
      var maxPage = Math.max(0, Math.ceil((state.files || []).length / 6) - 1);
      if (pointInRect(px, py, uiHotspots.editorFilePrev)) { state.page = Math.max(0, (Number(state.page) || 0) - 1); return true; }
      if (pointInRect(px, py, uiHotspots.editorFileNext)) { state.page = Math.min(maxPage, (Number(state.page) || 0) + 1); return true; }
      if (pointInRect(px, py, uiHotspots.editorFileConfirmLoad)) { triggerHaptic('medium'); confirmEditorLoad(); return true; }
      return true;
    }

    function saveLevel(lv) {
      var stageSource = normalizeLevel(clone(STAGES[stageIndex] || defaultLevel || {}));
      var sourceLevel = clone(lv || runtimeLevel || level || stageSource);
      var map = loadLevelOverrideMap();
      var editRound = Math.max(1, Math.round(Number(sourceLevel && sourceLevel.editingRoundNumber) || 1));
      var stageToStore;
      if (editRound > 1) {
        stageToStore = normalizeLevel(clone(stageSource));
        stageToStore.roundLayouts = clone(stageToStore.roundLayouts || {});
        stageToStore.roundLayouts[String(editRound)] = buildRoundLayoutSnapshot(sourceLevel);
        level = normalizeLevel(clone(stageToStore));
        runtimeLevel = normalizeLevel(clone(sourceLevel));
        runtimeLevel.roundLayouts = clone(stageToStore.roundLayouts || {});
        runtimeLevel.editingRoundNumber = editRound;
        if (Object.prototype.hasOwnProperty.call(sourceLevel, 'roundNumber')) runtimeLevel.roundNumber = sourceLevel.roundNumber;
        if (Object.prototype.hasOwnProperty.call(sourceLevel, 'roundLengthMultiplier')) runtimeLevel.roundLengthMultiplier = sourceLevel.roundLengthMultiplier;
        if (Object.prototype.hasOwnProperty.call(sourceLevel, 'firstRoundFinishX')) runtimeLevel.firstRoundFinishX = sourceLevel.firstRoundFinishX;
        if (Object.prototype.hasOwnProperty.call(sourceLevel, 'roundBaseDistance')) runtimeLevel.roundBaseDistance = sourceLevel.roundBaseDistance;
        if (Object.prototype.hasOwnProperty.call(sourceLevel, 'roundBaseWidth')) runtimeLevel.roundBaseWidth = sourceLevel.roundBaseWidth;
        if (Object.prototype.hasOwnProperty.call(sourceLevel, 'roundBaseStartX')) runtimeLevel.roundBaseStartX = sourceLevel.roundBaseStartX;
        if (Object.prototype.hasOwnProperty.call(sourceLevel, 'roundBaseTailMargin')) runtimeLevel.roundBaseTailMargin = sourceLevel.roundBaseTailMargin;
      } else {
        stageToStore = normalizeLevel(clone(sourceLevel));
        var preservedLayouts = clone((sourceLevel && sourceLevel.roundLayouts) || stageSource.roundLayouts || {});
        if (preservedLayouts && Object.keys(preservedLayouts).length) stageToStore.roundLayouts = preservedLayouts;
        level = normalizeLevel(clone(stageToStore));
        runtimeLevel = clone(level);
      }
      STAGES[stageIndex] = clone(stageToStore);
      if (levelPack && Array.isArray(levelPack.stages)) levelPack.stages[stageIndex] = clone(stageToStore);
      map[String(stageIndex)] = clone(stageToStore);
      saveLevelOverrideMap(map);
      try { wx.setStorageSync(LEVEL_KEY, { stageIndex: stageIndex, level: level }); } catch(e) {}
    }
    function clearPortalState() {
      portalState.active = false;
      portalState.targetStage = -1;
      portalState.spawnTimer = 0;
      portalState.pulse = 0;
      portalState.triggered = false;
      portalState.entryActive = false;
      portalState.entryTimer = 0;
      portalState.entryDuration = PORTAL_ENTRY_SECONDS;
      portalState.playerAlpha = 1;
      portalState.screenBandY = NaN;
      portalState.baseY = VIEW_H * 0.5;
      portalState.floatOffset = 0;
    }
    function loadStage(index) {
      stageIndex = clampStageIndex(index);
      level = normalizeLevel(loadLevel(stageIndex)); runtimeLevel = clone(level);
      ensureFoodAssetsForLevel(runtimeLevel);
      rebuildRuntimeSpatialIndex();
      if (scenePackageReady) ensureStageBackgroundAsset(runtimeLevel);
      progress.currentStage = stageIndex;
      if (Number(progress.pendingPortalStage) >= 0 && stageIndex >= Number(progress.pendingPortalStage)) progress.pendingPortalStage = -1;
      saveProgress();
      clearPortalState();
      if (scenePackageReady) playBgmForLevel(runtimeLevel, stageIndex);
      else whenScenePackageReady(function() { playBgmForLevel(runtimeLevel, stageIndex); });
    }
    function advanceStage() {
      var wasTut = !!(STAGES[stageIndex] && STAGES[stageIndex].isTutorial);
      var next = stageIndex + 1;
      // 普通跳转、教学流程与编辑器跳关均不得增加轮次；轮次只在正式完成第10关后结算。
      if (next >= STAGES.length) next = MAIN_STAGE_START;
      if (wasTut && next >= MAIN_STAGE_START) progress.tutorialSeen = true;
      loadStage(next);
    }
    function skipTutorialSequence() {
      progress.tutorialSeen = true;
      progress.firstThreeCleared = firstSequenceClearedCount(progress);
      progress.unlockedStage = Math.max(Number(progress.unlockedStage) || 0, MIN_UNLOCKED_STAGE);
      progress.currentStage = MAIN_STAGE_START;
      saveProgress();
      loadStage(MAIN_STAGE_START);
      menuIntroOpen = false;
      setScene('menu');
      openStageSelect();
    }
    function startTutorialSequenceFromComic() {
      if (!scenePackageReady) {
        whenScenePackageReady(function() { startTutorialSequenceFromComic(); });
        return;
      }
      tutorialComicState.active = false;
      tutorialComicState.pageTimer = 0;
      tutorialComicState.entryTouchStartMs = -1;
      var targetStage = clampStageIndex(Number(tutorialComicState.targetStage) || 0);
      loadStage(targetStage);
      startRun(true);
    }
    function openTutorialComic(startStage) {
      tutorialComicState.active = true;
      tutorialComicState.page = 0;
      tutorialComicState.totalPages = 4;
      tutorialComicState.pageTimer = 0;
      tutorialComicState.autoAdvanceSeconds = 5;
      tutorialComicState.targetStage = clampStageIndex(startStage === undefined ? 0 : startStage);
      // 记录打开漫画的那次触摸。菜单“教学”按钮的 touchend 不得继续传递为漫画翻页。
      tutorialComicState.entryTouchStartMs = Number(lastTouchStartMs) || -1;
      pointerHeld = false;
      setScene('tutorial_comic');
    }
    function advanceTutorialComicPage(forceStart) {
      if (!tutorialComicState.active) return false;
      if (forceStart || tutorialComicState.page >= tutorialComicState.totalPages - 1) {
        triggerHaptic('medium');
        playUiClickSound();
        startTutorialSequenceFromComic();
        return true;
      }
      tutorialComicState.page += 1;
      tutorialComicState.pageTimer = 0;
      triggerHaptic('light');
      playUiClickSound();
      return true;
    }
    function createUnlockGateConfetti() {
      var colors = ['#ff5f8f', '#ffd85f', '#6ef0a7', '#73e2ff', '#a983ff', '#ffffff'];
      var pieces = [];
      for (var i = 0; i < 96; i++) {
        var side = i % 3;
        var x = side === 0 ? 34 + Math.random() * 48 : (side === 1 ? VIEW_W - 82 + Math.random() * 48 : VIEW_W * 0.5 + (Math.random() - 0.5) * 150);
        var y = side === 2 ? 118 + Math.random() * 38 : 188 + Math.random() * 120;
        var towardCenter = side === 0 ? 1 : (side === 1 ? -1 : (Math.random() < 0.5 ? -1 : 1));
        pieces.push({
          x: x, y: y,
          vx: towardCenter * (70 + Math.random() * 210) + (Math.random() - 0.5) * 45,
          vy: -(150 + Math.random() * 260),
          gravity: 330 + Math.random() * 170,
          age: -(Math.random() * 0.34),
          life: 2.15 + Math.random() * 1.35,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 11,
          w: 5 + Math.random() * 7,
          h: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
      return pieces;
    }
    function updateUnlockGateCelebration(dt) {
      unlockGateState.celebrationTimer = Math.max(0, Number(unlockGateState.celebrationTimer) || 0) + dt;
      var list = Array.isArray(unlockGateState.confetti) ? unlockGateState.confetti : [];
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        p.age += dt;
        if (p.age < 0) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.vx *= Math.pow(0.985, dt * 60);
        p.rot += p.vr * dt;
      }
      unlockGateState.confetti = list.filter(function(p) {
        return p.age < p.life && p.y < VIEW_H + 48 && p.x > -64 && p.x < VIEW_W + 64;
      });
    }
    function showUnlockGate(targetStage, forcedTutorial) {
      var info = stageDisplayInfo(targetStage);
      var score = currentRoundUnlockScore();
      unlockGateState.active = true;
      unlockGateState.targetStage = info.stageIndex;
      unlockGateState.currentScore = score;
      unlockGateState.roundNumber = currentRoundNumber();
      unlockGateState.threshold = info.threshold;
      unlockGateState.remaining = Math.max(0, info.threshold - score);
      unlockGateState.unlocked = info.threshold <= 0 || score >= info.threshold;
      unlockGateState.forcedTutorial = !!forcedTutorial;
      unlockGateState.formalNumber = info.formalNumber;
      unlockGateState.title = info.title;
      unlockGateState.titleEn = info.titleEn;
      var followingStage = info.stageIndex + 1;
      if (followingStage < STAGES.length) {
        var followingInfo = stageDisplayInfo(followingStage);
        unlockGateState.nextFormalNumber = followingInfo.formalNumber;
        unlockGateState.nextTitle = followingInfo.title;
        unlockGateState.nextTitleEn = followingInfo.titleEn;
        unlockGateState.nextThreshold = followingInfo.threshold;
      } else {
        unlockGateState.nextFormalNumber = 0;
        unlockGateState.nextTitle = '';
        unlockGateState.nextTitleEn = '';
        unlockGateState.nextThreshold = 0;
      }
      unlockGateState.celebrating = unlockGateState.unlocked &&
        info.stageIndex > Math.max(MIN_UNLOCKED_STAGE, Number(progress.lastCelebratedUnlockStage) || MIN_UNLOCKED_STAGE);
      unlockGateState.celebrationTimer = 0;
      unlockGateState.confetti = unlockGateState.celebrating ? createUnlockGateConfetti() : [];
      resetUnlockGateWheel(stageIndex);
      if (info.formalNumber === 4) progress.gateTutorialSeen = true;
      saveProgress();
      pointerHeld = false;
      if (player && (player.attachIndex !== null || tongueFx.mode !== 'none')) detachTongue();
      stopSpinLoop();
      setScene('unlock_gate');
      if (unlockGateState.celebrating) {
        playLevelUnlockSound();
        triggerHaptic('medium');
        setTimeout(function() { triggerHaptic('light', true); }, 150);
        setTimeout(function() { triggerHaptic('light', true); }, 300);
      }
    }
    function getUnlockedStageWheelOptions() {
      var highest = Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE);
      highest = clampStageIndex(highest);
      var options = [];
      for (var i = MAIN_STAGE_START; i <= highest && i < STAGES.length; i++) {
        var info = stageDisplayInfo(i);
        options.push({
          stageIndex: info.stageIndex,
          formalNumber: info.formalNumber,
          title: info.title,
          titleEn: info.titleEn
        });
      }
      return options;
    }
    function wrapUnlockGateWheelIndex(value, length) {
      length = Math.max(0, Math.floor(Number(length) || 0));
      if (!length) return 0;
      value = Math.round(Number(value) || 0);
      return ((value % length) + length) % length;
    }
    function syncUnlockGateWheelSelection() {
      var options = Array.isArray(unlockGateState.wheelOptions) ? unlockGateState.wheelOptions : [];
      if (!options.length) {
        unlockGateState.wheelPosition = 0;
        unlockGateState.wheelTarget = 0;
        unlockGateState.wheelSelectedStage = MAIN_STAGE_START;
        return;
      }
      var index;
      if (unlockGateState.wheelAutoSpin) {
        index = wrapUnlockGateWheelIndex(unlockGateState.wheelPosition, options.length);
      } else {
        index = clamp(Math.round(Number(unlockGateState.wheelTarget) || 0), 0, options.length - 1);
        unlockGateState.wheelTarget = index;
      }
      unlockGateState.wheelSelectedStage = clampStageIndex(options[index].stageIndex);
    }
    function stopUnlockGateWheelAutoSelection() {
      var options = Array.isArray(unlockGateState.wheelOptions) ? unlockGateState.wheelOptions : [];
      if (!options.length) return false;
      var position = Number(unlockGateState.wheelPosition) || 0;
      position = ((position % options.length) + options.length) % options.length;
      unlockGateState.wheelAutoSpin = false;
      unlockGateState.wheelManualSelection = true;
      unlockGateState.wheelPosition = position;
      unlockGateState.wheelTarget = position;
      syncUnlockGateWheelSelection();
      return true;
    }
    function resetUnlockGateWheel(preferredStage) {
      var options = getUnlockedStageWheelOptions();
      var preferred = clampStageIndex(preferredStage);
      var selected = -1;
      for (var i = 0; i < options.length; i++) {
        if (clampStageIndex(options[i].stageIndex) === preferred) { selected = i; break; }
      }
      if (selected < 0) selected = Math.max(0, options.length - 1);
      if (options.length > 1) selected = Math.floor(Math.random() * options.length);
      unlockGateState.wheelOptions = options;
      unlockGateState.wheelPosition = options.length > 1 ? selected + Math.random() * 0.85 : selected;
      unlockGateState.wheelTarget = unlockGateState.wheelPosition;
      unlockGateState.wheelSelectedStage = options.length ? clampStageIndex(options[wrapUnlockGateWheelIndex(unlockGateState.wheelPosition, options.length)].stageIndex) : MAIN_STAGE_START;
      unlockGateState.wheelDragging = false;
      unlockGateState.wheelMoved = false;
      unlockGateState.wheelVelocity = 0;
      unlockGateState.wheelTapOffset = 0;
      unlockGateState.wheelAutoSpin = options.length > 1;
      unlockGateState.wheelManualSelection = false;
      unlockGateState.wheelAutoDirection = Math.random() < 0.5 ? -1 : 1;
      unlockGateState.wheelAutoSpeed = 1.35 + Math.random() * 1.35;
      unlockGateState.wheelAutoTimer = 0.9 + Math.random() * 1.8;
    }
    function beginUnlockGateWheel(py) {
      if (unlockGateState.unlocked || !Array.isArray(unlockGateState.wheelOptions) || !unlockGateState.wheelOptions.length) return false;
      stopUnlockGateWheelAutoSelection();
      unlockGateState.wheelDragging = true;
      unlockGateState.wheelMoved = false;
      unlockGateState.wheelStartY = Number(py) || 0;
      unlockGateState.wheelLastY = Number(py) || 0;
      unlockGateState.wheelLastAt = nowMs();
      unlockGateState.wheelVelocity = 0;
      unlockGateState.wheelTapOffset = ((Number(py) || 0) - Number((uiHotspots.unlockGateWheel && uiHotspots.unlockGateWheel.y) || 558)) / 55;
      return true;
    }
    function updateUnlockGateWheelDrag(py) {
      if (!unlockGateState.wheelDragging) return;
      var now = nowMs();
      var y = Number(py) || 0;
      var dy = y - (Number(unlockGateState.wheelLastY) || y);
      var dt = Math.max(0.008, (now - (Number(unlockGateState.wheelLastAt) || now)) / 1000);
      var options = unlockGateState.wheelOptions || [];
      var units = -dy / 55;
      unlockGateState.wheelPosition = clamp((Number(unlockGateState.wheelPosition) || 0) + units, 0, Math.max(0, options.length - 1));
      unlockGateState.wheelTarget = unlockGateState.wheelPosition;
      unlockGateState.wheelVelocity = clamp(units / dt, -12, 12);
      unlockGateState.wheelLastY = y;
      unlockGateState.wheelLastAt = now;
      if (Math.abs(y - (Number(unlockGateState.wheelStartY) || y)) > 6) unlockGateState.wheelMoved = true;
      var nearest = clamp(Math.round(unlockGateState.wheelPosition), 0, Math.max(0, options.length - 1));
      if (options[nearest]) unlockGateState.wheelSelectedStage = clampStageIndex(options[nearest].stageIndex);
    }
    function endUnlockGateWheel() {
      if (!unlockGateState.wheelDragging) return false;
      var options = unlockGateState.wheelOptions || [];
      var projected = Number(unlockGateState.wheelPosition) || 0;
      if (unlockGateState.wheelMoved) projected += (Number(unlockGateState.wheelVelocity) || 0) * 0.12;
      else projected += Number(unlockGateState.wheelTapOffset) || 0;
      unlockGateState.wheelTarget = clamp(Math.round(projected), 0, Math.max(0, options.length - 1));
      unlockGateState.wheelDragging = false;
      unlockGateState.wheelVelocity = 0;
      syncUnlockGateWheelSelection();
      triggerHaptic('light');
      return true;
    }
    function adjustUnlockGateWheel(delta) {
      var options = unlockGateState.wheelOptions || [];
      if (unlockGateState.unlocked || !options.length || !delta) return false;
      stopUnlockGateWheelAutoSelection();
      var base = Math.round(Number(unlockGateState.wheelTarget) || Number(unlockGateState.wheelPosition) || 0);
      unlockGateState.wheelTarget = clamp(base + (delta > 0 ? 1 : -1), 0, options.length - 1);
      syncUnlockGateWheelSelection();
      triggerHaptic('light');
      return true;
    }
    function updateUnlockGateWheel(dt) {
      if (unlockGateState.wheelDragging) return;
      var options = Array.isArray(unlockGateState.wheelOptions) ? unlockGateState.wheelOptions : [];
      var step = Math.max(0, Number(dt) || 0);
      if (unlockGateState.wheelAutoSpin && options.length > 1) {
        unlockGateState.wheelAutoTimer = (Number(unlockGateState.wheelAutoTimer) || 0) - step;
        if (unlockGateState.wheelAutoTimer <= 0) {
          if (Math.random() < 0.38) unlockGateState.wheelAutoDirection = -(Number(unlockGateState.wheelAutoDirection) || 1);
          unlockGateState.wheelAutoSpeed = 1.25 + Math.random() * 1.55;
          unlockGateState.wheelAutoTimer = 0.8 + Math.random() * 2.0;
        }
        var direction = Number(unlockGateState.wheelAutoDirection) || 1;
        var speed = Math.max(0.6, Number(unlockGateState.wheelAutoSpeed) || 1.8);
        var autoPosition = (Number(unlockGateState.wheelPosition) || 0) + direction * speed * step;
        autoPosition = ((autoPosition % options.length) + options.length) % options.length;
        unlockGateState.wheelPosition = autoPosition;
        unlockGateState.wheelTarget = autoPosition;
        syncUnlockGateWheelSelection();
        return;
      }
      var target = Number(unlockGateState.wheelTarget) || 0;
      var position = Number(unlockGateState.wheelPosition) || 0;
      var amount = 1 - Math.exp(-step * 16);
      position += (target - position) * amount;
      if (Math.abs(target - position) < 0.001) position = target;
      unlockGateState.wheelPosition = position;
    }
    function returnToFirstStageFromGate() {
      unlockGateState.active = false;
      unlockGateState.confetti = [];
      loadStage(MAIN_STAGE_START);
      startRun(false);
    }
    function continueToSelectedStageFromGate() {
      var options = Array.isArray(unlockGateState.wheelOptions) ? unlockGateState.wheelOptions : [];
      var target = clampStageIndex(unlockGateState.wheelSelectedStage);
      var permitted = false;
      for (var i = 0; i < options.length; i++) {
        if (clampStageIndex(options[i].stageIndex) === target) { permitted = true; break; }
      }
      if (!permitted) target = Math.max(MAIN_STAGE_START, Math.min(stageIndex, Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE)));
      unlockGateState.active = false;
      unlockGateState.confetti = [];
      loadStage(target);
      startRun(false);
    }
    function continueToUnlockedStageFromGate() {
      var target = clampStageIndex(unlockGateState.targetStage);
      var permitted = unlockGateState.unlocked === true &&
        target <= Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE);
      if (!permitted) { continueToSelectedStageFromGate(); return; }
      progress.lastCelebratedUnlockStage = Math.max(
        Number(progress.lastCelebratedUnlockStage) || MIN_UNLOCKED_STAGE,
        target
      );
      saveProgress();
      unlockGateState.active = false;
      unlockGateState.confetti = [];
      loadStage(target);
      startRun(false);
    }
    function getNextStageUnlockView() {
      var next = stageIndex + 1;
      if (next >= STAGES.length) return { wrap: true, locked: false, formalNumber: 1, title: '森林', titleEn: 'FOREST', threshold: 0, remaining: 0 };
      var info = stageDisplayInfo(next);
      var score = currentRoundUnlockScore();
      return {
        wrap: false, stageIndex: next, formalNumber: info.formalNumber, title: info.title, titleEn: info.titleEn,
        threshold: info.threshold, remaining: Math.max(0, info.threshold - score),
        locked: next > Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE) || (info.formalNumber === 4 && !progress.gateTutorialSeen)
      };
    }

    function attemptAdvanceAfterTally() {
      // [2026-10-14 v31] 现场闯关的记分板推进只走 kiosk 专用链（空白键 → kioskAfterRoundTally），
      //   普通的「下一关/轮次传送门」入口一律禁用，防止把流程拉出甲→乙→丙轨道。
      if (kioskRun && kioskRun.active) return;
      var next = stageIndex + 1;
      if (next >= STAGES.length) {
        // 唯一允许增加轮次的入口：正式完成最后一关后播放穿越过场。
        launchRoundCompletionPortalTransition();
        return;
      }
      var firstGateTutorial = formalStageNumber(next) === 4 && !progress.gateTutorialSeen;
      var highestUnlocked = Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE);
      if (firstGateTutorial || next > highestUnlocked) {
        showUnlockGate(next, firstGateTutorial);
        return;
      }
      if (formalStageNumber(next) > ALWAYS_UNLOCKED_FORMAL_COUNT &&
          next > Math.max(MIN_UNLOCKED_STAGE, Number(progress.lastCelebratedUnlockStage) || MIN_UNLOCKED_STAGE)) {
        showUnlockGate(next, false);
        return;
      }
      loadStage(next);
      startRun(false);
    }

    function portalFrameForScreenX(screenX) {
      if (screenX > VIEW_W) return PORTAL_FRAME_COUNT - 1;
      var centerX = VIEW_W * 0.5;
      var normalized = clamp((screenX - centerX) / Math.max(1, VIEW_W - centerX), 0, 1);
      return clamp(Math.round(normalized * Math.max(1, PORTAL_FRAME_COUNT - 2)), 0, PORTAL_FRAME_COUNT - 2);
    }

    function randomPortalScreenBandY() {
      var minY = VIEW_H / 3 + PORTAL_HALF_HEIGHT + 16;
      var maxY = VIEW_H * 2 / 3 - PORTAL_HALF_HEIGHT - 16;
      if (maxY <= minY) return VIEW_H * 0.5;
      return minY + Math.random() * (maxY - minY);
    }
    function placePortalAheadOfCurrentView(keepRandomHeight) {
      if (!keepRandomHeight || !isFinite(portalState.screenBandY)) portalState.screenBandY = randomPortalScreenBandY();
      var halfW = Math.max(1, Number(portalState.halfWidth) || PORTAL_HALF_WIDTH);
      var halfH = Math.max(1, Number(portalState.halfHeight) || PORTAL_HALF_HEIGHT);
      var desiredX = cameraX + VIEW_W + PORTAL_SPAWN_AHEAD;
      var maxX = Math.max(cameraX + VIEW_W * 0.72, runtimeLevel.finish.x - halfW - 28);
      portalState.x = Math.min(desiredX, maxX);
      var desiredY = cameraY + portalState.screenBandY;
      portalState.baseY = clamp(desiredY, halfH + 28, Math.max(halfH + 28, runtimeLevel.height - halfH - 38));
      portalState.floatOffset = 0;
      portalState.y = portalState.baseY;
    }
    function maybeSpawnPortal(force) {
      if (!portalState || scene !== 'playing' || !runtimeLevel || runtimeLevel.isTutorial) return false;
      if (firstSequenceLocked(progress)) return false;
      var target = Number(progress.pendingPortalStage);
      if (!isFinite(target) || target < 0) return false;
      target = clampStageIndex(target);
      if (target <= stageIndex || target > Math.max(MIN_UNLOCKED_STAGE, Number(progress.unlockedStage) || MIN_UNLOCKED_STAGE)) return false;
      if (formalStageNumber(target) === 4 && !progress.gateTutorialSeen) return false;
      if (!force && portalState.active && portalState.targetStage === target) return true;
      portalState.active = true;
      portalState.targetStage = target;
      portalState.radius = PORTAL_RADIUS;
      portalState.halfWidth = PORTAL_HALF_WIDTH;
      portalState.halfHeight = PORTAL_HALF_HEIGHT;
      portalState.spawnDuration = PORTAL_SPAWN_SECONDS;
      portalState.spawnTimer = 0;
      portalState.pulse = 0;
      portalState.triggered = false;
      portalState.entryActive = false;
      portalState.entryTimer = 0;
      portalState.entryDuration = PORTAL_ENTRY_SECONDS;
      portalState.playerAlpha = 1;
      portalState.screenBandY = randomPortalScreenBandY();
      portalState.floatPhase = Math.random() * Math.PI * 2;
      portalState.floatAmplitude = 4 + Math.random() * 2;
      portalState.floatSpeed = 1.05 + Math.random() * 0.24;
      portalState.floatOffset = 0;
      placePortalAheadOfCurrentView(true);
      triggerHaptic('medium');
      playTone('triangle', 420, 980, 0.32, 0.055);
      return true;
    }

    function launchPortalTransition() {
      if (!portalState.entryActive) return;
      portalState.entryActive = false;
      portalState.playerAlpha = 0;
      stopBgm(true);

      var target = clampStageIndex(portalState.targetStage);
      var targetInfo = stageDisplayInfo(target);
      portalTransitionState.timer = 0;
      portalTransitionState.targetStage = target;
      portalTransitionState.formalNumber = targetInfo.formalNumber;
      portalTransitionState.title = targetInfo.title;
      portalTransitionState.titleEn = targetInfo.titleEn;
      portalTransitionState.travelDuration = PORTAL_TRAVEL_SECONDS;
      portalTransitionState.whiteDuration = PORTAL_WHITE_SECONDS;
      portalTransitionState.whiteStarted = false;
      portalTransitionState.completing = false;
      portalTransitionState.renderMode = portalEffectConfig.mode || 'auto';
      portalTransitionState.lastMode = 'none';
      portalTransitionState.lastError = '';
      portalTransitionState.roundAdvance = false;
      portalTransitionState.nextRound = currentRoundNumber();

      setScene('portal_transition');
      startPortalTransitSound();
    }

    function launchRoundCompletionPortalTransition() {
      // [2026-10-14 v31] 现场闯关期间绝不允许「轮次 +1」：现场=固定三轮（甲→乙→丙），
      //   任何入口（自动传送门/按钮推进）都不得把 progress.round 推到 2（加长地图）。
      if (kioskRun && kioskRun.active) return false;
      if (!isFinalFormalStage(stageIndex) || scene === 'portal_transition') return false;
      stopBgm(true);

      var target = MAIN_STAGE_START;
      var targetInfo = stageDisplayInfo(target);
      var nextRound = Math.max(currentRoundNumber() + 1, Math.round(Number(progress.pendingRoundTarget) || 0));
      portalTransitionState.timer = 0;
      portalTransitionState.targetStage = target;
      portalTransitionState.formalNumber = targetInfo.formalNumber;
      portalTransitionState.title = targetInfo.title;
      portalTransitionState.titleEn = targetInfo.titleEn;
      portalTransitionState.travelDuration = PORTAL_TRAVEL_SECONDS;
      portalTransitionState.whiteDuration = PORTAL_WHITE_SECONDS;
      portalTransitionState.whiteStarted = false;
      portalTransitionState.completing = false;
      portalTransitionState.renderMode = portalEffectConfig.mode || 'auto';
      portalTransitionState.lastMode = 'none';
      portalTransitionState.lastError = '';
      portalTransitionState.roundAdvance = true;
      portalTransitionState.nextRound = nextRound;
      progress.pendingRoundTarget = nextRound;
      saveProgress();

      pointerHeld = false;
      stopSpinLoop();
      setScene('portal_transition');
      startPortalTransitSound();
      return true;
    }
    function launchStagePortalTransition(targetStage) {
      if (scene === 'portal_transition') return false;
      stopBgm(true);
      targetStage = clampStageIndex(targetStage);
      var targetInfo = stageDisplayInfo(targetStage);
      portalTransitionState.timer = 0;
      portalTransitionState.targetStage = targetStage;
      portalTransitionState.formalNumber = targetInfo.formalNumber;
      portalTransitionState.title = targetInfo.title;
      portalTransitionState.titleEn = targetInfo.titleEn;
      portalTransitionState.travelDuration = PORTAL_TRAVEL_SECONDS;
      portalTransitionState.whiteDuration = PORTAL_WHITE_SECONDS;
      portalTransitionState.whiteStarted = false;
      portalTransitionState.completing = false;
      portalTransitionState.renderMode = portalEffectConfig.mode || 'auto';
      portalTransitionState.lastMode = 'none';
      portalTransitionState.lastError = '';
      portalTransitionState.roundAdvance = false;
      portalTransitionState.nextRound = currentRoundNumber();
      pointerHeld = false;
      stopSpinLoop();
      setScene('portal_transition');
      startPortalTransitSound();
      return true;
    }

    function updatePortal(dt) {
      if (!portalState.active) return;
      portalState.pulse += dt;

      if (portalState.entryActive) {
        portalState.entryTimer = Math.min(PORTAL_ENTRY_SECONDS + 0.2, portalState.entryTimer + dt);
        var entryT = clamp(portalState.entryTimer / Math.max(0.001, portalState.entryDuration || PORTAL_ENTRY_SECONDS), 0, 1);
        var entryFloatFade = clamp(1 - entryT * 1.18, 0, 1);
        var baseEntryY = isFinite(Number(portalState.baseY)) ? Number(portalState.baseY) : Number(portalState.y) || VIEW_H * 0.5;
        portalState.floatOffset = Math.sin(portalState.pulse * (Number(portalState.floatSpeed) || 1.15) + (Number(portalState.floatPhase) || 0)) *
          Math.max(0, Number(portalState.floatAmplitude) || 5) * entryFloatFade;
        portalState.y = baseEntryY + portalState.floatOffset;

        if (player) {
          player.vx = 0; player.vy = 0; player.spin *= 0.78;
          player.x = lerp(player.x, portalState.x, 0.12 + entryT * 0.08);
          player.y = lerp(player.y, portalState.y, 0.12 + entryT * 0.08);
          player.animTime += dt * 0.22;
        }
        if (entryT < 0.56) {
          var blinkPhase = Math.floor(entryT / 0.14);
          portalState.playerAlpha = blinkPhase % 2 === 0 ? 1 : 0.10;
        } else {
          portalState.playerAlpha = clamp(1 - (entryT - 0.56) / 0.24, 0, 1);
        }
        if (entryT >= 1) launchPortalTransition();
        return;
      }

      var baseY = isFinite(Number(portalState.baseY)) ? Number(portalState.baseY) : Number(portalState.y) || VIEW_H * 0.5;
      portalState.floatOffset = Math.sin(portalState.pulse * (Number(portalState.floatSpeed) || 1.15) + (Number(portalState.floatPhase) || 0)) *
        Math.max(0, Number(portalState.floatAmplitude) || 5);
      portalState.y = baseY + portalState.floatOffset;

      if (portalState.triggered) return;
      portalState.spawnTimer = Math.min(PORTAL_SPAWN_SECONDS + 8, portalState.spawnTimer + dt);
      portalState.playerAlpha = 1;
    }
    function completePortalTransition() {
      if (portalTransitionState.completing) return;
      portalTransitionState.completing = true;
      var target = clampStageIndex(portalTransitionState.targetStage);
      var advancedRound = portalTransitionState.roundAdvance === true;
      var nextRound = Math.max(1, Math.round(Number(portalTransitionState.nextRound) || currentRoundNumber()));
      stopPortalTransitSound();
      progress.pendingPortalStage = -1;
      // [2026-10-14 v32] 现场两关之间的穿越过场：穿越完成 → 播变身视频 → 下一关。
      //   不 loadStage/startRun（kioskStartCharacter 会自行装配下一张地图）。
      if (kioskRun && kioskRun.active && kioskRun.portalAdvance) {
        var pa = kioskRun.portalAdvance;
        kioskRun.portalAdvance = null;
        portalTransitionState.roundAdvance = false;
        portalTransitionState.completing = false;
        kioskAdvanceWithVideo(pa.index, pa.video);
        return;
      }
      if (advancedRound && !(kioskRun && kioskRun.active)) {
        // [2026-10-14 v31] 现场闯关期间该分支不可达（入口已全部封死）；双保险：绝不改 round。
        progress.round = Math.max(currentRoundNumber() + 1, nextRound, Math.round(Number(progress.pendingRoundTarget) || 0));
        progress.pendingRoundTarget = 0;
        // 永久累计总分继续保留；新一轮从当前总分建立解锁基准，
        // 第1-3关开放，第4-10关重新依照 5000/8000/12000/17000/23000/30000/38000 解锁。
        resetRoundUnlockProgress(progress, progress.round, progress.totalScore);
        progress.unlockSystemVersion = UNLOCK_SYSTEM_VERSION;
      }
      saveProgress();
      loadStage(target);
      startRun(false);
      portalTransitionState.roundAdvance = false;
      portalTransitionState.completing = false;
      if (advancedRound) showToastMessage('进入第' + currentRoundNumber() + '轮 · 关卡长度 ×' + currentRoundLengthMultiplier().toFixed(1) + ' · 乌鸦频率提升');
    }
    function beginPortalTravel() {
      if (!portalState.active || portalState.triggered) return;
      portalState.triggered = true;
      portalState.entryActive = true;
      portalState.entryTimer = 0;
      portalState.entryDuration = PORTAL_ENTRY_SECONDS;
      portalState.playerAlpha = 1;
      pointerHeld = false;
      if (player && (player.attachIndex !== null || tongueFx.mode !== 'none')) detachTongue();
      if (player) { player.vx = 0; player.vy = 0; }
      stopSpinLoop();
      triggerHaptic('heavy');
      playPortalEntrySound();
    }

    function isTutorialStage() { return !!(runtimeLevel && runtimeLevel.isTutorial); }
    function currentTutorialKind() { return (runtimeLevel && runtimeLevel.tutorialKind) || ''; }
    function tutorialTasksForLevel(lv) {
      lv = lv || runtimeLevel || {};
      var ids = Array.isArray(lv.tutorialTasks) ? lv.tutorialTasks : [];
      var stageName = String(lv.name || '');
      return TUTORIAL_TASK_DEFINITIONS.filter(function(task) {
        return ids.length ? ids.indexOf(task.id) >= 0 : task.stage === stageName;
      }).map(function(task) { return clone(task); });
    }
    function createTutorialFlowState() {
      return {
        tasks: [], taskIndex: 0, phase: 'none', phaseTimer: 0, currentTask: null, totalTasks: 0,
        completedIds: [], holdTimer: 0, attachedHoldTimer: 0, shrinkStartLength: 0, shrinkTimer: 0,
        observeTimer: 0, observeDuration: 1, observeReason: '', observeRequiresAirborne: false,
        tapGuideTimer: 0, tapGuideIndex: -1, touchedPropTypes: [], requiredPropTypes: [],
        propRouteStep: 0, propRouteLastX: 0, propRouteSpringId: '', propRouteHazardId: '', propRouteAnchorId: '',
        lifeLost: false, rescueStarted: false, lifeRescuePhase: '', rescuePulled: false, rescueAimed: false, finishNoticeTimer: 0,
        finishPromptTimer: 0, finishPromptDuration: 0, finishPromptTask: null
      };
    }
    function currentTutorialTask() { return tutorialFlow && tutorialFlow.currentTask ? tutorialFlow.currentTask : null; }
    function tutorialTaskIs(id) { var task = currentTutorialTask(); return !!(isTutorialStage() && task && task.id === id && tutorialFlow.phase === 'active'); }
    function tutorialTaskInProgress(id) { var task = currentTutorialTask(); return !!(isTutorialStage() && task && task.id === id && (tutorialFlow.phase === 'active' || tutorialFlow.phase === 'observe')); }
    function tutorialIncompleteTasks() {
      if (!isTutorialStage() || !tutorialFlow) return [];
      var completed = Array.isArray(tutorialFlow.completedIds) ? tutorialFlow.completedIds : [];
      return (Array.isArray(tutorialFlow.tasks) ? tutorialFlow.tasks : []).filter(function(task) {
        return task && completed.indexOf(task.id) < 0;
      });
    }
    function tutorialStageReadyForFinish() {
      if (!isTutorialStage()) return true;
      var tasks = tutorialFlow && Array.isArray(tutorialFlow.tasks) ? tutorialFlow.tasks : [];
      if (!tasks.length) return true;
      return tutorialFlow.phase === 'done' && tutorialIncompleteTasks().length === 0;
    }
    function currentTutorialFinishRequirement() {
      var current = currentTutorialTask();
      if (current) return current;
      var missing = tutorialIncompleteTasks();
      return missing.length ? missing[0] : null;
    }
    function showTutorialFinishBlockedPrompt() {
      if (!isTutorialStage() || !tutorialFlow) return false;
      var task = currentTutorialFinishRequirement();
      tutorialFlow.finishPromptTask = task ? clone(task) : null;
      tutorialFlow.finishPromptDuration = 3.4;
      tutorialFlow.finishPromptTimer = tutorialFlow.finishPromptDuration;
      tutorialFlow.finishNoticeTimer = 1.2;
      var label = task ? ((task.no ? task.no + '. ' : '') + String(task.shortTitle || task.title || '当前教学')) : '当前教学';
      showToastMessage('教学未完成：' + label, 2.4);
      triggerHaptic('medium');
      return true;
    }
    function resetTutorialPlayerPosition() {
      pointerHeld = false;
      if (player && player.attachIndex !== null) detachTongue();
      player = makePlayer();
      player.vx = 135; player.vy = 0;
      cameraX = 0; cameraY = 0; cameraFollowInitialized = false;
      tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
    }
    function beginTutorialTask(index) {
      if (!isTutorialStage()) return;
      tutorialFlow.taskIndex = Math.max(0, Math.min(tutorialFlow.tasks.length - 1, Number(index) || 0));
      tutorialFlow.currentTask = tutorialFlow.tasks[tutorialFlow.taskIndex] || null;
      tutorialFlow.phase = tutorialFlow.currentTask ? 'intro' : 'none';
      tutorialFlow.phaseTimer = 0; tutorialFlow.observeTimer = 0; tutorialFlow.observeReason = ''; tutorialFlow.observeRequiresAirborne = false;
      tutorialFlow.holdTimer = 0; tutorialFlow.attachedHoldTimer = 0; tutorialFlow.shrinkStartLength = 0; tutorialFlow.shrinkTimer = 0;
      tutorialFlow.tapGuideTimer = 0; tutorialFlow.tapGuideIndex = -1;
      tutorialFlow.finishPromptTimer = 0; tutorialFlow.finishPromptDuration = 0; tutorialFlow.finishPromptTask = null;
      tutorialFlow.touchedPropTypes = [];
      tutorialFlow.requiredPropTypes = [];
      tutorialFlow.propRouteStep = 0;
      tutorialFlow.propRouteSpringId = String(runtimeLevel.tutorialRouteSpringId || 'tutorial_spring');
      tutorialFlow.propRouteHazardId = String(runtimeLevel.tutorialRouteHazardId || 'tutorial_hazard');
      tutorialFlow.propRouteAnchorId = String(runtimeLevel.tutorialRouteAnchorId || 'a3');
      tutorialFlow.lifeLost = false; tutorialFlow.rescueStarted = false; tutorialFlow.lifeRescuePhase = ''; tutorialFlow.rescuePulled = false; tutorialFlow.rescueAimed = false;
      resetTutorialPlayerPosition();
      // 舌头失效教学：把玩家放到锚点正下方并预连接，保证舌头处于 ±25° 内、物理启动后由绳子托住，便于演示「长按3秒失效」
      if (tutorialFlow.currentTask && tutorialFlow.currentTask.id === 'tongue_fail' && player && runtimeLevel && Array.isArray(runtimeLevel.anchors) && runtimeLevel.anchors.length) {
        var tfAnchorIdx = tutorialRouteAnchorIndexById('a2');
        if (tfAnchorIdx < 0) tfAnchorIdx = 0;
        var tfAnchor = runtimeLevel.anchors[tfAnchorIdx];
        if (tfAnchor) {
          player.x = tfAnchor.x; player.y = tfAnchor.y + 150; player.vx = 0; player.vy = 0; player.attachIndex = null;
          attachTongue(tfAnchorIdx);
        }
      }
      tutorialFlow.propRouteLastX = player ? Number(player.x) || 0 : 0;
    }
    function resetTutorialFlowForStage() {
      tutorialFlow = createTutorialFlowState();
      if (!isTutorialStage()) return;
      tutorialFlow.tasks = tutorialTasksForLevel(runtimeLevel);
      tutorialFlow.totalTasks = TUTORIAL_TASK_DEFINITIONS.length;
      tutorialFlow.completedIds = TUTORIAL_TASK_DEFINITIONS.filter(function(task) { return task.no < (tutorialFlow.tasks[0] && tutorialFlow.tasks[0].no || 1); }).map(function(task) { return task.id; });
      beginTutorialTask(0);
    }
    function startTutorialGoldenSkillTraining() {
      var isLifeTask = tutorialTaskIs('life') && tutorialFlow.lifeLost;
      var isRescueOnlyTask = tutorialTaskIs('rescue_only');
      var isRescueManualTask = tutorialTaskIs('rescue_manual');
      if ((!isLifeTask && !isRescueOnlyTask && !isRescueManualTask) || tutorialFlow.rescueStarted) return;
      tutorialFlow.rescueStarted = true;
      tutorialFlow.lifeRescuePhase = (isLifeTask ? 'rescue' : 'practice');
      tutorialFlow.rescuePulled = false; tutorialFlow.rescueAimed = false;
      goldenSkillState.points = Math.max(1, Number(goldenSkillState.points) || 0);
      player.x = clamp(runtimeLevel.start.x + 140, 120, runtimeLevel.width - 120);
      player.y = runtimeLevel.height - player.r - 10;
      player.vx = 0; player.vy = 0;
      centerCameraOnPlayer(999, true);
      if (isRescueManualTask) showToastMessage('长按黄金番薯往下拉到底 · 左右拖动调角度 · 松手发射', 2.6);
      showGoldenSkillMenu('tutorial', 'ground', null, true);
    }
    function dismissTutorialIntro() {
      if (!isTutorialStage() || tutorialFlow.phase !== 'intro') return false;
      var introTask = currentTutorialTask();
      tutorialInputSeen = true; tutorialHintTimer = 0;
      if (introTask && introTask.infoOnly) {
        if (tutorialFlow.completedIds.indexOf(introTask.id) < 0) tutorialFlow.completedIds.push(introTask.id);
        if (tutorialFlow.taskIndex + 1 < tutorialFlow.tasks.length) beginTutorialTask(tutorialFlow.taskIndex + 1);
        else { tutorialFlow.phase = 'done'; tutorialFlow.currentTask = null; showToastMessage('说明已阅读，请越过终点线过关'); }
        return true;
      }
      tutorialFlow.phase = 'active'; tutorialFlow.phaseTimer = 0;
      if (tutorialTaskIs('rescue_manual')) {
        startTutorialGoldenSkillTraining();
        return;
      }
      if (tutorialTaskIs('life') || tutorialTaskIs('rescue_only')) {
        tutorialFlow.lifeRescuePhase = 'falling';
        pointerHeld = false;
        if (player && player.attachIndex !== null) detachTongue();
        player.x = clamp(runtimeLevel.start.x + 80, player.r + 8, runtimeLevel.width - player.r - 8);
        player.y = clamp(runtimeLevel.start.y, 120, runtimeLevel.height - player.r - 180);
        player.vx = 0; player.vy = 30; player.attachIndex = null;
      }
      return true;
    }
    function completeTutorialTask(reason, options) {
      if (!isTutorialStage() || tutorialFlow.phase !== 'active' || !tutorialFlow.currentTask) return false;
      options = options || {};
      // 教学关卡第1关（T1）：动作一完成即允许继续/直接过终点，跳过观察与 check 的等待
      if (String((runtimeLevel && runtimeLevel.name) || '') === 'T1') {
        if (tutorialFlow.completedIds.indexOf(tutorialFlow.currentTask.id) < 0) tutorialFlow.completedIds.push(tutorialFlow.currentTask.id);
        tutorialFlow.phase = 'done'; tutorialFlow.currentTask = null; tutorialFlow.phaseTimer = 0; tutorialFlow.observeRequiresAirborne = false;
        continueTutorialAfterCheck();
        return true;
      }
      tutorialFlow.phase = 'observe'; tutorialFlow.observeTimer = 0;
      tutorialFlow.observeDuration = Math.max(0.25, Number(options.duration) || 1.0);
      tutorialFlow.observeReason = String(reason || 'action');
      tutorialFlow.observeRequiresAirborne = !!options.requireAirborne;
      return true;
    }
    function cancelTutorialObservation(message) {
      if (!isTutorialStage() || tutorialFlow.phase !== 'observe') return;
      tutorialFlow.phase = 'active'; tutorialFlow.observeTimer = 0; tutorialFlow.observeReason = ''; tutorialFlow.observeRequiresAirborne = false;
      if (message) showToastMessage(message);
    }
    function showTutorialTaskCheck() {
      var task = currentTutorialTask();
      if (!task) return;
      if (tutorialFlow.completedIds.indexOf(task.id) < 0) tutorialFlow.completedIds.push(task.id);
      tutorialFlow.phase = 'check'; tutorialFlow.phaseTimer = 0;
      triggerHaptic('medium'); playUiClickSound();
    }
    function continueTutorialAfterCheck() {
      if (tutorialFlow.taskIndex + 1 < tutorialFlow.tasks.length) {
        beginTutorialTask(tutorialFlow.taskIndex + 1);
        return;
      }
      tutorialFlow.phase = 'done'; tutorialFlow.currentTask = null;
      tutorialFlow.phaseTimer = 0;
      var lastTask = tutorialFlow.tasks[tutorialFlow.tasks.length - 1] || {};
      if (lastTask.id === 'rescue_manual') {
        // 番薯救援完成后不再自动播放穿越门，必须让玩家越过终点线再由终点触发 portal 进入下一关
        showToastMessage('番薯救援完成！请越过终点线进入穿越门', 2.6);
      } else if (lastTask.id === 'rescue_only') {
        finishRun();
      } else {
        showToastMessage('教学动作已完成，请越过终点线过关');
      }
    }
    function tutorialRouteWallById(id) {
      var walls = runtimeLevel && Array.isArray(runtimeLevel.walls) ? runtimeLevel.walls : [];
      for (var i = 0; i < walls.length; i++) if (String(walls[i].id || '') === String(id || '')) return walls[i];
      return null;
    }
    function tutorialRouteBumperById(id) {
      var bumpers = runtimeLevel && Array.isArray(runtimeLevel.bumpers) ? runtimeLevel.bumpers : [];
      for (var i = 0; i < bumpers.length; i++) if (String(bumpers[i].id || '') === String(id || '')) return bumpers[i];
      return null;
    }
    function tutorialRouteAnchorIndexById(id) {
      var anchors = runtimeLevel && Array.isArray(runtimeLevel.anchors) ? runtimeLevel.anchors : [];
      for (var i = 0; i < anchors.length; i++) if (String(anchors[i].id || '') === String(id || '')) return i;
      return -1;
    }
    function resetTutorialPropRoute(message) {
      if (!tutorialTaskIs('props')) return;
      tutorialFlow.propRouteStep = 0;
      var spring = tutorialRouteWallById(tutorialFlow.propRouteSpringId);
      pointerHeld = false;
      if (player && player.attachIndex !== null) detachTongue();
      if (player) {
        player.x = spring ? Math.max(player.r + 8, spring.x - 230) : runtimeLevel.start.x;
        player.y = spring ? Math.max(120, spring.y - 260) : runtimeLevel.start.y;
        player.vx = 145; player.vy = 0; player.attachIndex = null;
      }
      tutorialFlow.propRouteLastX = player ? player.x : 0;
      if (message) showToastMessage(message, 2.2);
    }
    function noteTutorialPropInteraction(kind, source) {
      if (!tutorialTaskIs('props')) return '';
      kind = String(kind || 'prop');
      source = source || {};
      var sourceId = String(source.id || '');
      if (sourceId === tutorialFlow.propRouteSpringId && tutorialFlow.propRouteStep === 0) {
        tutorialFlow.propRouteStep = 1;
        floatingTexts.push({ x: player.x, y: player.y - 54, value: 0, label: '', age: 0, life: 1.2, customText: '1/3 已踩到弹力垫' });
        showToastMessage('利用弹力飞过危险球');
        return 'spring';
      }
      if (sourceId === tutorialFlow.propRouteHazardId && tutorialFlow.propRouteStep < 3) {
        resetTutorialPropRoute('碰到危险球了，请重新踩弹力垫越过');
        return 'reset';
      }
      return '';
    }
    function updateTutorialPropRoute() {
      if (!tutorialTaskIs('props') || !player) return;
      if (tutorialFlow.propRouteStep !== 1) { tutorialFlow.propRouteLastX = player.x; return; }
      var hazard = tutorialRouteBumperById(tutorialFlow.propRouteHazardId);
      if (!hazard) return;
      var crossedX = player.x - player.r > hazard.x + hazard.r;
      var safelyAbove = player.y + player.r < hazard.y - hazard.r * 0.18;
      if (crossedX && safelyAbove) {
        tutorialFlow.propRouteStep = 2;
        floatingTexts.push({ x: player.x, y: player.y - 54, value: 0, label: '', age: 0, life: 1.2, customText: '2/3 已越过危险球' });
        showToastMessage('现在连接任意锚点');
      }
      tutorialFlow.propRouteLastX = player.x;
    }
    function noteTutorialAnchorConnected(anchorIndex) {
      if (!tutorialTaskIs('props') || tutorialFlow.propRouteStep !== 2) return;
      var anchors = runtimeLevel && Array.isArray(runtimeLevel.anchors) ? runtimeLevel.anchors : [];
      if (Number(anchorIndex) < 0 || Number(anchorIndex) >= anchors.length) return;
      tutorialFlow.propRouteStep = 3;
      floatingTexts.push({ x: player.x, y: player.y - 54, value: 0, label: '', age: 0, life: 1.2, customText: '3/3 已连接锚点' });
      completeTutorialTask('spring_hazard_anchor_route', { duration: 1.0 });
    }
    // 舌头失效规则闸门：仅在教学关「tongue_fail」任务进行中允许触发，避免打断其它教学（如 shrink 阶段悬垂在±25°内长按会被误判失效）。
    function canTongueFailRule() {
      // [kiosk] 线下闯关：现场只有一颗 USB 空白键，长按 = 持续挂锚点。
      //   必须关掉「舌头接近竖直（±25°）长按超过 3 秒 → 自动失效」这条规则：
      //   按住不放时绳子会收到最短（ropeLength 下限），玩家正好悬在锚点【正下方】，
      //   verticalDeviation≈0° 必然命中规则 → 3 秒后舌头被强制脱落、pointerHeld 也被清掉，
      //   表现为「舌头无法长时间挂住锚点，必须松手重按」。线下模式一律不自动放手。
      //   （代价：蝠侠的竖直回弹能力 vertical_rebound 也走这条闸门，线下不生效；
      //     线下三侠闯关的顺序是 阿蜥/白娘子/小青，不含蝠侠。）
      try { if (kioskRun && kioskRun.active) return false; } catch (e) {}
      if (!isTutorialStage()) return true;
      return tutorialTaskIs('tongue_fail');
    }
    // 舌头因规则失效（连续在±25°内长按3秒）时通知教学流程。
    function noteTutorialTongueFail() {
      if (!tutorialTaskIs('tongue_fail')) return;
      completeTutorialTask('tongue_failed', { duration: 1.0 });
    }
    function handleTutorialLifeLoss(cause) {
      if (tutorialTaskInProgress('connect_release') && tutorialFlow.phase === 'observe' && tutorialFlow.observeRequiresAirborne) {
        resetTutorialPlayerPosition();
        cancelTutorialObservation('放手后需要保持在空中 1 秒，请重新尝试');
        return;
      }
      if (!tutorialTaskIs('life') && !tutorialTaskIs('rescue_only')) { resetTutorialPlayerPosition(); showToastMessage('继续完成当前教学动作'); return; }
      if (tutorialFlow.lifeLost) return;
      tutorialFlow.lifeLost = true;
      tutorialFlow.lifeRescuePhase = 'landed';
      pointerHeld = false;
      runStats.deaths += 1;
      runStats.hearts = Math.max(0, runStats.hearts - 1);
      runStats.combo = 0; runStats.multiplier = 1; runStats.comboTimer = 0;
      player.y = runtimeLevel.height - player.r;
      player.vx = 0; player.vy = 0; player.attachIndex = null;
      floatingTexts.push({ x: player.x, y: runtimeLevel.height - 90, value: 0, label: '', age: 0, life: 1.4, customText: '落地：生命 -1' });
      centerCameraOnPlayer(999, true);
      triggerHaptic('heavy');
      startTutorialGoldenSkillTraining();
    }
    function updateTutorialFlow(dt) {
      if (!isTutorialStage() || !tutorialFlow) return false;
      tutorialFlow.finishNoticeTimer = Math.max(0, Number(tutorialFlow.finishNoticeTimer || 0) - dt);
      tutorialFlow.tapGuideTimer = Math.max(0, Number(tutorialFlow.tapGuideTimer || 0) - dt);
      if (tutorialFlow.finishPromptTimer > 0) {
        tutorialFlow.finishPromptTimer = Math.max(0, tutorialFlow.finishPromptTimer - dt);
        if (tutorialFlow.finishPromptTimer <= 0) tutorialFlow.finishPromptTask = null;
        return true;
      }
      if (tutorialFlow.phase === 'intro') return true;
      if (tutorialFlow.phase === 'observe') {
        if (tutorialFlow.observeRequiresAirborne) {
          var stillAirborne = player && player.y + player.r < runtimeLevel.height - 4;
          if (!stillAirborne) { cancelTutorialObservation('需要在空中保持 1 秒，请重新尝试'); return false; }
        }
        tutorialFlow.observeTimer += dt;
        if (tutorialFlow.observeTimer >= tutorialFlow.observeDuration) showTutorialTaskCheck();
        return false;
      }
      if (tutorialFlow.phase === 'check') {
        tutorialFlow.phaseTimer += dt;
        if (tutorialFlow.phaseTimer >= 1.0) continueTutorialAfterCheck();
        return true;
      }
      if (tutorialFlow.phase !== 'active' || !player) return false;
      var task = currentTutorialTask();
      if (!task) return false;
      if ((task.id === 'life' || task.id === 'rescue_only') && tutorialFlow.lifeRescuePhase === 'falling') {
        pointerHeld = false;
        if (player.attachIndex !== null) detachTongue();
      } else if (task.id === 'connect_release') {
        if (player.attachIndex !== null && pointerHeld) tutorialFlow.attachedHoldTimer += dt;
        else if (player.attachIndex === null) tutorialFlow.attachedHoldTimer = 0;
      } else if (task.id === 'shrink') {
        if (player.attachIndex !== null && pointerHeld) {
          if (!tutorialFlow.shrinkStartLength) tutorialFlow.shrinkStartLength = Math.max(1, Number(player.ropeLength) || 1);
          tutorialFlow.shrinkTimer += dt;
          if (tutorialFlow.shrinkTimer >= 1.5 && tutorialFlow.shrinkStartLength - player.ropeLength >= 32) completeTutorialTask('rope_shrunk');
        } else { tutorialFlow.shrinkStartLength = 0; tutorialFlow.shrinkTimer = 0; }
      } else if (task.id === 'props') {
        updateTutorialPropRoute();
      }
      return tutorialFlow.phase === 'intro' || tutorialFlow.phase === 'check';
    }

    function normalizeLevel(lv) {
      var out = clone(lv || defaultLevel);
      out.version = 43;
      out.theme = THEMES[out.theme] ? out.theme : 'forest';
      out.isTutorial = !!out.isTutorial; out.tutorialKind = out.tutorialKind || '';
      out.width = clamp(Number(out.width) || 3200, out.isTutorial ? 900 : 1600, 20000);
      out.height = Number(out.height) || VIEW_H;
      out.start = out.start || { x: 90, y: 160 };
      out.finish = out.finish || { x: out.width - 160, y: 0, w: 56, h: VIEW_H };
      ['anchors','foods','bumpers','walls','windZones'].forEach(function(k) { if (!Array.isArray(out[k])) out[k] = []; });
      out.anchors.forEach(function(o,i) { if (!o.id) o.id = 'a'+(i+1); });
      out.foods.forEach(function(o,i) {
        if (!o.id) o.id = 'f'+(i+1);
        if (o.type && !o.kind) o.kind = o.type;
        if (!o.kind || !FOOD_LIBRARY[o.kind]) o.kind = 'bubble_tea';
        // 2026-10-01：雄黄酒等彩蛋食物的分数以 FOOD_LIBRARY 为准，别被统一压成 25 分。
        var foodLib = FOOD_LIBRARY[o.kind];
        o.points = (o.skillItem || o.kind === 'golden_sweet_potato')
          ? GOLDEN_SWEET_POTATO_POINTS
          : (foodLib && Number(foodLib.points) ? Number(foodLib.points) : NORMAL_FOOD_POINTS);
      });
      out.bumpers.forEach(function(o,i) {
        if (!o.id) o.id='b'+(i+1);
        o.r=Number(o.r)||40;
        o.power=clamp(Number(o.power)||1.44, 0.1, BUMPER_MAX_MULTIPLIER);
        o.hazard=!!o.hazard;
        o.tutorialPropType=String(o.tutorialPropType || '');
      });
      out.walls.forEach(function(o,i) {
        if (!o.id) o.id='w'+(i+1);
        o.w=Number(o.w)||140; o.h=Number(o.h)||32; o.bounce=Number(o.bounce)||1.16;
        o.spring=!!o.spring; o.axis=o.axis==='vertical'?'vertical':'horizontal';
        o.powerSpring=!!o.powerSpring || o.springType==='power';
        o.oneShot=!!o.oneShot || o.springType==='oneShot';
        if (o.oneShot) o.spring=true;
        o.material=o.material==='stump'?'stump':(o.material==='wall'?'wall':'');
        if (!o.spring && o.material==='stump') o.bounce=o.axis==='horizontal'?HORIZONTAL_STUMP_BOUNCE:STUMP_BOUNCE;
        else if (!o.spring && o.material==='wall') o.bounce=Math.max(WALL_BOUNCE, Number(o.bounce)||WALL_BOUNCE);
        o.powerMultiplier=o.powerSpring?POWER_SPRING_MULTIPLIER:Math.max(1, Number(o.powerMultiplier)||1);
        o.used=false; o.removed=false; o.disappearTimer=0;
        o.springAnim=0; o.springAnimVelocity=0;
        o.tutorialPropType=String(o.tutorialPropType || '');
      });
      // 不再自动生成角色出生点正下方的保命垫。
      // 同时过滤旧地图中的特殊 start_pad，起点区域可由编辑器自由放置其他道具。
      out.walls = out.walls.filter(function(o) {
        return !(o && (o.isStartPad || o.id === 'start_pad'));
      });
      // [hangzhou-web] 线下起点救援垫：正式关起点下方 780px 内没有任何墙时，补一块弹垫，
      // 让线下玩家开局不操作也只是被弹起，而不是自由落体摔死（仅网页副本，小游戏工程不变）。
      if (!out.isTutorial) {
        var _sx = Number(out.start && out.start.x) || 0, _sy = Number(out.start && out.start.y) || 0;
        var _hasFloor = out.walls.some(function(w) {
          return Math.abs((Number(w.x) || 0) - _sx) < 280 && (Number(w.y) || 0) > _sy;
        });
        if (!_hasFloor) {
          out.walls.push({
            id: 'start_rescue_pad', x: _sx, y: out.height - 170, w: 190, h: 32, bounce: 1.24,
            spring: true, axis: 'horizontal', powerSpring: false, powerMultiplier: 1, oneShot: false,
            springType: '', material: 'wall', used: false, removed: false, disappearTimer: 0,
            springAnim: 0, springAnimVelocity: 0, tutorialPropType: ''
          });
        }
      }
      out.windZones.forEach(function(o,i) { if (!o.id) o.id='z'+(i+1); o.w=Number(o.w)||420; o.h=Number(o.h)||360; o.forceX=Number(o.forceX)||45; o.forceY=Number(o.forceY)||-40; });
      out.finish.x = clamp(Number(out.finish.x) || out.width-160, 400, out.width-90);
      out.finish.y = 0; out.finish.h = out.height; out.finish.w = Number(out.finish.w) || 56;
      return out;
    }

    var progress = loadProgress();
    var skinState = loadSkinState();
    // 「无条件开放」的皮肤在启动时即视为已拥有 —— 否则面板按钮置灰、点不动。
    syncFreeSkinOwnership();
    var economyState = loadEconomyState();
    refreshEconomyState();
    var playerProfile = loadPlayerProfile();
    try { console.log('[用户资料] 启动时读取本地档案：authorized=' + playerProfile.authorized + ' city=' + (playerProfile.city || '(空)') + ' nickName=' + (playerProfile.nickName || '(空)')); } catch (e) {}
    var profilePromptedThisSession = false;
    var profileRequestPending = false;
    var profileRequestQueue = [];
    var cloudLeaderboardReady = false;
    var cloudLeaderboardConnected = false;
    var leaderboard = loadLeaderboard();
    var leaderboardDataVersion = 0; // 榜单数据每次变更自增，用于缓存失效（computeGlobalLeaderboardView）
    var leaderboardOpen = false;
    var leaderboardTab = 'total'; // 'total' = 总榜单（前 10 名）｜'personal' = 个人榜（击败百分比）
    var leaderboardPreviousScene = 'menu';
    var leaderboardScrollY = 0;
    var leaderboardAutoReturnToMenu = false;
    var leaderboardDrag = { active: false, startY: 0, lastY: 0, scrollStart: 0, moved: false };
    // 打开总榜单的自动巡览：第 1 名停留 1 秒 → 3 秒内滚到本人名次；未进前 50 则滚到最后一页并提示
    var leaderboardAutoScroll = null; // { timer, holdSec, durSec, fromY, toY }
    var leaderboardNotOnList = false;
    var lastSubmittedRank = 0;
    var globalLeaderboardView = null; // 计算后的视图：{top10, myRank, myScore, totalPlayers, beatPercent}
    var stageIndex = resolveInitialStageIndex();
    var stageSelectOpen = false;
    var skinPanelOpen = false;
    var skinPanelIndex = 0;
    // 2026-09-30 三侠版：皮肤选择改为「中间放大、两侧缩小」的仿 3D 滚轮。
    // skinWheelScroll 为连续渲染位置（单位=卡片数，可越过 0/上界，渲染时按张数环绕取最短路径）；
    // skinWheelTargetScroll 为吸附目标；拖拽中两者跟手同步，松手后由 updateSkinWheel 缓动收敛。
    var skinWheelScroll = 0;
    var skinWheelTargetScroll = 0;
    var skinWheelDragging = false;      // 已超过起始阈值、确实在拖动
    var skinWheelDragArmed = false;     // 本次触摸可能演变成拖拽（起点不在点击控件上）
    var skinWheelDragStartX = 0;
    var skinWheelDragStartScroll = 0;
    var skinWheelPendingTap = '';       // '' | 'prev' | 'next'：侧卡/箭头「先按下、后确认」的点击
    var SKIN_WHEEL_DRAG_PX_PER_CARD = 138; // 横向拖过这么多像素即滚动一张
    var SKIN_WHEEL_DRAG_ARM_PX = 10;       // 超过该位移才判定为拖拽（避免吃掉点击）
    var stageSelectIndex = Math.max(MAIN_STAGE_START, stageIndex);
    var defaultLevel = clone(STAGES[stageIndex] || STAGES[0] || {});
    var level = normalizeLevel(loadLevel(stageIndex));
    var runtimeLevel = clone(level);
    var runtimeSpatial = null;
    var spatialQueryStamp = 1;
    var spatialWallsQuery = [];
    var spatialBumpersQuery = [];
    var spatialFoodsQuery = [];
    var spatialMagnetQuery = [];
    var SPATIAL_CELL_SIZE = 320;
    function addSpatialRange(map, item, minX, maxX) {
      var first = Math.floor(minX / SPATIAL_CELL_SIZE);
      var last = Math.floor(maxX / SPATIAL_CELL_SIZE);
      for (var cell = first; cell <= last; cell++) {
        var bucket = map[cell];
        if (!bucket) bucket = map[cell] = [];
        bucket.push(item);
      }
    }
    function rebuildRuntimeSpatialIndex() {
      var levelData = runtimeLevel || {};
      var spatial = { level: levelData, walls: Object.create(null), bumpers: Object.create(null), foods: Object.create(null) };
      var walls = Array.isArray(levelData.walls) ? levelData.walls : [];
      var bumpers = Array.isArray(levelData.bumpers) ? levelData.bumpers : [];
      var foods = Array.isArray(levelData.foods) ? levelData.foods : [];
      for (var i = 0; i < walls.length; i++) {
        var wall = walls[i]; if (!wall) continue;
        addSpatialRange(spatial.walls, wall, Number(wall.x) || 0, (Number(wall.x) || 0) + Math.max(0, Number(wall.w) || 0));
      }
      for (var j = 0; j < bumpers.length; j++) {
        var bumper = bumpers[j]; if (!bumper) continue;
        var radius = Math.max(0, Number(bumper.r) || 0);
        addSpatialRange(spatial.bumpers, bumper, (Number(bumper.x) || 0) - radius, (Number(bumper.x) || 0) + radius);
      }
      for (var k = 0; k < foods.length; k++) {
        var food = foods[k]; if (!food) continue;
        addSpatialRange(spatial.foods, food, (Number(food.x) || 0) - 40, (Number(food.x) || 0) + 40);
      }
      runtimeSpatial = spatial;
    }
    function querySpatial(kind, minX, maxX, output) {
      output.length = 0;
      if (!runtimeSpatial || runtimeSpatial.level !== runtimeLevel) rebuildRuntimeSpatialIndex();
      var map = runtimeSpatial && runtimeSpatial[kind];
      if (!map) return output;
      var first = Math.floor(minX / SPATIAL_CELL_SIZE);
      var last = Math.floor(maxX / SPATIAL_CELL_SIZE);
      spatialQueryStamp += 1;
      if (spatialQueryStamp > 2000000000) spatialQueryStamp = 1;
      var stamp = spatialQueryStamp;
      for (var cell = first; cell <= last; cell++) {
        var bucket = map[cell];
        if (!bucket) continue;
        for (var i = 0; i < bucket.length; i++) {
          var item = bucket[i];
          if (!item || item.__spatialQueryStamp === stamp) continue;
          item.__spatialQueryStamp = stamp;
          output.push(item);
        }
      }
      return output;
    }
    rebuildRuntimeSpatialIndex();
    var player = null;
    var scene = 'loading';
    var pointerHeld = false;
    var lastInputX = 0, lastInputY = 0;
    var lastInputAt = 0; // 最后一次有效触摸的时间戳（外部音频看门狗用）
    var accumulator = 0;
    var lastTime = nowMs();
    var renderAccumulator = 1 / targetFps;
    var renderInterval = 1 / targetFps;
    // 运行期帧率自适应：当实测帧间隔持续劣于目标时，逐步抬高渲染间隔(减少每秒绘制帧数)，
    // 降低 CPU/GPU 填充压力，让帧率稳住而非跌到 30FPS 以下产生明显卡顿。对 low 档不启用
    // （其 renderInterval 已是 45FPS 的稳定目标，已在初始化时定好）。
    var baseRenderInterval = 1 / targetFps;
    var renderAdaptiveMin = baseRenderInterval;
    var renderAdaptiveMax = lowDevice ? baseRenderInterval : baseRenderInterval * 1.8; // 最多降到约 33FPS(60档)
    var renderSlowStreak = 0;
    var renderFastStreak = 0;
    var lastRenderedScene = '';
    var forceCanvasReset = true;
    var cameraX = 0;
    var cameraY = 0;
    var cameraFollowInitialized = false;
    var screenShake = 0;
    var particles = [];
    var floatingTexts = [];
    var crows = [];
    var featherFx = [];   // 2026-10-09：小青吃乌鸦掉落的羽毛特效（瞬时视觉，不进存档点）
    var crowVanishFx = [];   // 2026-10-09：乌鸦被吃掉时位置的放射闪光线条（1 秒）
    var crowSpawnTimer = 0;
    var crowNextSpawn = 9999;
    var crowSpawnCount = 0;   // 本关已生成的乌鸦数（生成时序号 0 = 本关第一只），切关重置
    var uiHotspots = {};
    var runStats = createRunStats();
    var finishState = createFinishState();
    var deathTimer = 0;
    var deathLeaderboardShown = false;
    var gameOverState = { timer: 0, hold: GAME_OVER_HOLD_SECONDS, fade: GAME_OVER_FADE_SECONDS, leaderboardShown: false };

    // ————— [kiosk 2026-10-10 晚] 线下「三侠闯关」状态 —————
    // 一次游戏 = 按顺序玩三位角色（原版阿蜥 → 白娘子 → 小青），全程无广告/无复活/无选人转盘：
    //   过关 → 出本关记分板（score_tally）→ 变身视频（第1关后）→ 下一位角色；三位全过 → 总记分板 + 云端排名 → 回首页；
    //   阵亡 → 直接回首页（本轮结束）。
    // 2026-10-11 下午（第12版）：现场三轮制 —— ①现场游戏锁第1轮版式（关卡长度 ×1），
    //   不再出现「第一轮终点」绿线标记，越过终点线=本轮过关；②每关过关先出记分板再继续；
    //   ③阿蜥过关后 1/2 概率变身白娘子/小青（页面播 10s 变身视频，视频结束才开下一轮）；
    //   ④第三关记分板后由页面出「三轮总分记分板」+ 云端 500 强排名。
    var KIOSK_CHARACTER_ORDER = ['classic', 'bainiangzi', 'xiaoqing'];
    var KIOSK_START_POTATOES = 5;   // 2026-10-11 下午：现场登录直接送 5 颗番薯（黄金技能），用完即挑战失败
    var KIOSK_LEFTOVER_POTATO_BONUS = 100;   // [2026-10-17 需求] 结算时每颗剩余黄金番薯 +100 分
    var KIOSK_DEATH_RETURN_MS = 3400;   // 阵亡提示「游戏结束 请再次扫码」的停留时长（随后自动回首页）
    var KIOSK_RESCUE_TIMEOUT_MS = 10000;   // 2026-10-12：番薯救援 10 秒未按键 → 挑战失败 → 游戏结束 → 回首页
    var kioskRun = { active: false, index: 0, results: [], dying: false, complete: false, order: [], videoPending: '', roundSnapshot: 0, mapOrder: [], potatoes: 0, portalAdvance: null };
    // 现场运行的实际出场顺序（阿蜥过关后按 1/2 概率变身，决定第2/3位出场）；未变身前=默认序
    function kioskOrder() {
      return (kioskRun.order && kioskRun.order.length === KIOSK_CHARACTER_ORDER.length) ? kioskRun.order : KIOSK_CHARACTER_ORDER;
    }
    var soulState = { active: false, timer: 0, duration: SOUL_ASCEND_DURATION, x: 0, y: 0, particleTimer: 0 };
    var tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
    // —— 2026-10-01 杭州雄黄酒彩蛋：变蛇飞行状态机 ——
    // active 期间：不受重力、不判舌头物理，蛇头由手指位移直接驱动（targetX/targetY）。
    var snakeForm = {
      active: false, kind: 'bai', timer: 0, duration: SNAKE_FORM_DURATION,
      headX: 0, headY: 0, targetX: 0, targetY: 0,
      vx: 0, vy: 0, facing: 1, phase: 0, particleTimer: 0, segments: []
    };
    // 小青·超级贪吃：连吃队列的节流计时
    var greedyTongueTimer = 0;
    // 2026-10-01：贪吃「伸舌」状态机（idle → extend → retract）。
    // 舌尖 tipX/tipY 每帧推进，只有舌尖真正碰到食物才 collectFood（渲染与命中判定共用同一份坐标）。
    var greedyShot = {
      phase: 'idle', food: null,
      timer: 0, duration: 0, progress: 0,
      targetX: 0, targetY: 0, tipX: 0, tipY: 0, cooldown: 0
    };
    // 白娘子·水漫金山：每关 1 次「落地不死」，切关/重开即重置
    var floodFountainUsed = false;
    var floodFountainFx = { active: false, timer: 0, duration: 0.9, x: 0, y: 0, particleTimer: 0 };
    var tutorialHintTimer = 0;
    var tutorialInputSeen = false;
    var tutorialFlow = createTutorialFlowState();
    var menuIntroOpen = false;
    var menuPromptSeenThisSession = false;
    var loadingState = {
      timer: loadingAnimationHasStarted ? Math.max(0, (Date.now() - loadingAnimationStartMs) / 1000) : 0,
      startedAtMs: loadingAnimationHasStarted ? loadingAnimationStartMs : 0,
      waitStartedAtMs: Date.now(),
      duration: Math.max(0.1, Number(warmupConfig.duration) || (Number(warmupConfig.frameCount) || 40) / Math.max(1, Number(warmupConfig.fps) || 8)),
      animationStarted: loadingAnimationHasStarted,
      progress: loadingBaseProgress,
      completeFrameShown: false
    };
    function startupResourceProgress() {
      var imageTotal = startupImageAssets.length;
      var imageSettled = 0;
      for (var i = 0; i < imageTotal; i++) {
        if (startupImageAssets[i].ready || startupImageAssets[i].failed) imageSettled += 1;
      }
      var audioTotal = Math.max(0, Number(audioState.preloadTotal) || 0);
      var audioSettled = Math.max(0, Math.min(audioTotal, Number(audioState.preloadSettled) || 0));
      var total = imageTotal + audioTotal;
      var settled = imageSettled + audioSettled;
      var coreProgress = total > 0 ? settled / total : 1;
      return loadingBaseProgress + (1 - loadingBaseProgress) * coreProgress;
    }
    var uiPressVisual = '';
    var uiPressTimer = 0;
    var pendingUiAction = null;
    var toastState = { text: '', timer: 0 };
    // 2026-10-10 每日游戏完成飘字：玩完 1 局（阵亡或通关）任务 play_run 到账 +1 时，
    // 结算画面弹两行金色横幅「每日游戏完成 / 赠送1颗番薯」并喷彩带。原生 wx.showToast 不支持换行，
    // 且 playing 场景会被 showToastMessage 压制 —— 改为由 render 在结算层顶部绘制。
    var playRewardBanner = { active: false, startedAt: 0, until: 0, duration: 6000 };
    function activatePlayRewardBanner() {
      playRewardBanner.active = true;
      playRewardBanner.startedAt = Date.now();
      playRewardBanner.until = playRewardBanner.startedAt + playRewardBanner.duration;
    }
    var reviveOffer = { busy: false, cause: 'fall' };
    var rewardDialog = {
      active: false, mode: '', busy: false, message: '',
      adAvailable: false, adUsed: false, shareAvailable: false, shareUsed: false,
      energyAvailable: false, availablePlays: 0, adRemaining: 0, adMax: 0, adReserved: false,
      shareRemaining: 0, shareMax: 0,
      potatoAvailable: false, potatoBank: 0,
      recoverText: '--:--', recoveryMinutes: Math.max(1, Math.round(RECOVERY_MS / 60000)),
      cooldownUntil: 0, cooldownText: '',
      stageToLoad: null, resetSession: true,
      claimed: false, claimSource: '', rewardBefore: 0, rewardAfter: 0
    };
    function formatShortCountdown(seconds) {
      seconds = Math.max(0, Math.ceil(Number(seconds) || 0));
      var m = Math.floor(seconds / 60), s = seconds % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    function continueMenuPlayAfterStatus() {
      if (scene !== 'menu') return;
      stageSelectOpen = false;
      menuPromptSeenThisSession = true;
      menuIntroOpen = true;
    }
    function dismissMenuPlayStatusPopup(continueToPlay) {
      if (!dailyLoginPopup.active) return false;
      var shouldContinuePlay = continueToPlay !== false && !!dailyLoginPopup.continueToPlay;
      dailyLoginPopup.timer = 0;
      dailyLoginPopup.active = false;
      dailyLoginPopup.continueToPlay = false;
      if (shouldContinuePlay) continueMenuPlayAfterStatus();
      return true;
    }
    function showMenuPlayStatusPopup() {
      if (scene !== 'menu' || dailyLoginPopup.active) return;
      // 云端同步未完成前不弹窗：避免读到本地陈旧的 0（清缓存后首屏闪 0 再闪真实余额）。
      // 记下待弹标记，等 giftReady 在 update 里补弹一次，确保首屏即正确。
      if (!giftReady) { giftPendingStatusPopup = true; return; }
      refreshEconomyState();
      var eco = economyView();
      var now = nowMs();
      var cooldownSeconds = rewardDialog.cooldownUntil > now
        ? Math.max(0, Math.ceil((rewardDialog.cooldownUntil - now) / 1000))
        : Math.max(0, Number(eco.recoverSeconds) || 0);

      if (dailyLoginPopup.pending) {
        dailyLoginPopup.pending = false;
        dailyLoginPopup.title = '每日登入赠送';
        dailyLoginPopup.subtitle = '黄金番薯 ' + DAILY_LOGIN_REWARD + '颗';
      } else if (cooldownSeconds > 0 && (Number(eco.availablePlays) || 0) <= 0) {
        dailyLoginPopup.title = '冷却20分钟获得一命';
        dailyLoginPopup.subtitle = '剩余 ' + formatShortCountdown(cooldownSeconds);
      } else {
        // 2026-09-29 用户要求：去除「今日赠送已领」，改为展示番薯库存状态。
        dailyLoginPopup.title = '口袋里尚有 ' + Math.max(0, Math.round(Number(goldenPotatoBank()) || 0)) + ' 颗黄金番薯';
        dailyLoginPopup.subtitle = '';
      }
      dailyLoginPopup.timer = dailyLoginPopup.holdSeconds + dailyLoginPopup.fadeSeconds;
      dailyLoginPopup.active = true;
      dailyLoginPopup.continueToPlay = true;
      menuIntroOpen = false;
      stageSelectOpen = false;
    }

    var reviveCheckpoint = null;
    var rewardDialogInputLockedUntil = 0;
    var storedReviveResumeStarted = false;
    var bootReviveResumePending = false;
    var editorSecretTapCount = 0;
    var editorSecretTapStartedAt = 0;
    var editorSecretTapLastAt = 0;
    var editorButtonVisible = false;
    var goldenSkillState = {
      points: 1,
      stageAdUsed: false,
      menuActive: false,
      trigger: '',
      deathCause: '',
      anchorIndex: null,
      originX: VIEW_W * 0.5,
      originY: VIEW_H * 0.62,
      selected: null,
      gestureActive: false,
      phase: 'ready',
      aimAngle: 0,
      pullDistance: 0,
      power: 0,
      armed: false,
      timer: 0,
      countdownLocked: false,
      adBusy: false,
      uiOffsetX: 0,
      uiOffsetY: 0,
      gestureStartX: 0,
      gestureStartY: 0,
      targetX: VIEW_W * 0.5,
      targetY: VIEW_H * 0.78,
      dockDistance: 158,
      dockProgress: 0,
      aimStartX: 0,
      aimStartY: 0,
      aimDragX: 0
    };

    var editorAddGuard = { kind: '', at: 0 };
    var lastEditorMousePress = { at: 0, x: -9999, y: -9999 };
    var editorState = {
      returnScene: 'menu', selected: null, drag: null, dirty: false, cameraSnapshot: 0,
      playerSnapshot: null, collectedById: null, jumpStage: 0,
      mapTab: null,   // [2026-10-13] 现场地图编辑器当前编辑的地图槽（0甲/1乙/2丙）；null=非现场编辑器
      viewport: clone(EDITOR_VIEWPORT), zoom: 1, minZoom: 0.12, maxZoom: EDITOR_MAX_ZOOM,
      cameraY: 0,
      fileDialog: { open: false, view: 'menu', dir: 'TOOLS', filename: '', files: [], selected: -1, page: 0, message: '', error: false, busy: false }
    };
    var unlockGateState = {
      active: false, targetStage: MIN_UNLOCKED_STAGE + 1, currentScore: 0, roundNumber: 1,
      threshold: 0, remaining: 0, unlocked: false, forcedTutorial: false, celebrating: false,
      formalNumber: 0, title: '', titleEn: '',
      nextFormalNumber: 0, nextTitle: '', nextTitleEn: '', nextThreshold: 0,
      celebrationTimer: 0, confetti: [],
      wheelOptions: [], wheelPosition: 0, wheelTarget: 0, wheelSelectedStage: MAIN_STAGE_START,
      wheelDragging: false, wheelMoved: false, wheelVelocity: 0, wheelStartY: 0, wheelLastY: 0, wheelLastAt: 0, wheelTapOffset: 0,
      wheelAutoSpin: false, wheelManualSelection: false, wheelAutoDirection: 1, wheelAutoSpeed: 1.8, wheelAutoTimer: 0
    };
    var tutorialComicState = {
      active: false,
      page: 0,
      totalPages: 4,
      pageTimer: 0,
      autoAdvanceSeconds: 5,
      targetStage: 0,
      entryTouchStartMs: -1
    };

    var portalState = {
      active: false, targetStage: -1, x: 0, y: VIEW_H * 0.5, baseY: VIEW_H * 0.5,
      radius: PORTAL_RADIUS, halfWidth: PORTAL_HALF_WIDTH, halfHeight: PORTAL_HALF_HEIGHT,
      screenBandY: NaN, spawnDuration: PORTAL_SPAWN_SECONDS,
      spawnTimer: 0, pulse: 0, triggered: false,
      floatPhase: 0, floatAmplitude: 5, floatSpeed: 1.15, floatOffset: 0,
      entryActive: false, entryTimer: 0, entryDuration: PORTAL_ENTRY_SECONDS, playerAlpha: 1
    };
    var portalTransitionState = {
      timer: 0,
      targetStage: -1,
      formalNumber: 1,
      title: '',
      titleEn: '',
      travelDuration: PORTAL_TRAVEL_SECONDS,
      whiteDuration: PORTAL_WHITE_SECONDS,
      whiteStarted: false,
      completing: false,
      roundAdvance: false,
      nextRound: 1,
      renderMode: portalEffectConfig.mode || 'auto',
      lastMode: 'none',
      lastError: ''
    };
    var portalPreviewState = {
      timer: 0,
      targetStage: MAIN_STAGE_START,
      formalNumber: 1,
      title: '穿越效果测试',
      titleEn: 'PORTAL EFFECT PREVIEW',
      travelDuration: Math.max(2, Number(portalEffectConfig.previewDuration) || 6),
      whiteDuration: Math.max(0.2, Number(portalEffectConfig.previewWhiteDuration) || 1),
      paused: false,
      speed: 1,
      renderMode: portalEffectConfig.mode || 'auto',
      lastMode: 'none',
      lastError: '',
      returnScene: 'editor'
    };

    var touchActiveCount = 0;
    var lastTouchStartMs = 0;
    var lastTouchStartX = -9999;
    var lastTouchStartY = -9999;
    var lastTouchEndMs = 0;
    var suppressNextRelease = false;
    var pauseSettingsDrag = '';

    function makePlayer() {
      return { x: runtimeLevel.start.x, y: runtimeLevel.start.y, vx: 170, vy: 10, r: 29.9, faceDir: 1,
        attachIndex: null, ropeLength: 0, animTime: 0, mouthOpen: 0, angle: 0, spin: 0.9,
        hitTimer: 0, hitDuration: 0.18, hitNormalX: 1, hitNormalY: 0, hitIntensity: 1, scale: 1,
        crowBlinkTimer: 0, crowBlinkDuration: CROW_BLINK_SECONDS, crowHitCooldown: 0,
        curlBlinkState: 0, curlBlinkTimer: 0.75 + Math.random() * 2.25, curlBlinkRepeats: 0,
        pressOpenTimer: 0, pressOpenDuration: PRESS_OPEN_DURATION, pendingAttachIndex: null, pendingAimAngle: null, tapGuideTimer: 0, tapGuideIndex: -1,
        attachSnapTimer: 0, attachSnapDuration: 0.10, verticalTongueTimer: 0, attachHoldTime: 0, tongueFailTimer: 0,
        skillInputLock: 0, fartTimer: 0, fartSpawnTimer: 0, fartDirection: 0,
        fartBoostTimer: 0, fartBoostDuration: GOLDEN_SKILL_BOOST_DURATION,
        fartBoostAngle: 0, fartBoostPower: 0,
        topEdgeSweetPotatoAt: 0,
        gliding: 0, glideArmed: 0 };
    }
    var CURL_BLINK_HALF_SECONDS = 0.100;
    var CURL_BLINK_CLOSED_SECONDS = 0.150;
    var CURL_BLINK_DOUBLE_GAP_SECONDS = 0.140;
    function nextCurlBlinkDelay() {
      // 平均约3.7秒眨一次，并保留足够随机范围避免机械感。
      return 1.85 + Math.random() * 3.65;
    }
    function updateCurlBlink(dt) {
      if (!player) return;
      player.curlBlinkTimer = Number(player.curlBlinkTimer);
      if (!isFinite(player.curlBlinkTimer)) player.curlBlinkTimer = nextCurlBlinkDelay();
      player.curlBlinkTimer -= Math.max(0, Number(dt) || 0);
      var guard = 0;
      while (player.curlBlinkTimer <= 0 && guard++ < 8) {
        var state = Math.round(Number(player.curlBlinkState) || 0);
        if (state === 0) {
          // 每次眨眼开始时约有16%概率接一次自然的双眨。
          player.curlBlinkRepeats = Math.random() < 0.16 ? 1 : 0;
          player.curlBlinkState = 1;
          player.curlBlinkTimer += CURL_BLINK_HALF_SECONDS;
        } else if (state === 1) {
          player.curlBlinkState = 2;
          player.curlBlinkTimer += CURL_BLINK_CLOSED_SECONDS;
        } else if (state === 2) {
          player.curlBlinkState = 3;
          player.curlBlinkTimer += CURL_BLINK_HALF_SECONDS;
        } else if (state === 3) {
          if ((Number(player.curlBlinkRepeats) || 0) > 0) {
            player.curlBlinkRepeats = Math.max(0, Math.round(Number(player.curlBlinkRepeats) || 0) - 1);
            player.curlBlinkState = 4;
            player.curlBlinkTimer += CURL_BLINK_DOUBLE_GAP_SECONDS;
          } else {
            player.curlBlinkState = 0;
            player.curlBlinkTimer += nextCurlBlinkDelay();
          }
        } else {
          // 双眨之间短暂睁眼，再沿用同一组半闭→全闭→半闭帧；所有阶段按秒计时，与实际刷新率无关。
          player.curlBlinkState = 1;
          player.curlBlinkTimer += CURL_BLINK_HALF_SECONDS;
        }
      }
    }
    function setScene(next) {
      scene = next;
      // [2026-10-14 v33 用户需求] BGM 只在「游戏进行中」播放：
      //   一旦离开游玩场景（记分板 score_tally / 死亡 death / 结算 game_over /
      //   传送门 portal_transition / 变身视频 / 菜单 menu 等）立即停背景音乐，
      //   下一关开局由 playBgmForLevel 重新随机起播 —— 大屏待机/结算/看视频时不再一直放歌。
      if (next !== 'playing' && next !== 'paused' && next !== 'golden_skill' &&
          next !== 'golden_skill_ad' && next !== 'finish_slowmo') {
        try { if (bgmState.inner) stopBgm(true); } catch (eBgmScene) {}
      }
      if (next !== 'menu') {
        stageSelectOpen = false;
        // 任何实际游戏/教学/结算场景都禁止保留首页状态弹窗。
        dailyLoginPopup.active = false;
        dailyLoginPopup.continueToPlay = false;
      }
    }
    function cameraTargetXForPlayer() {
      if (!player || !runtimeLevel) return cameraX;
      return clamp(player.x - VIEW_W * 0.5, 0, Math.max(0, runtimeLevel.width - VIEW_W));
    }
    function sceneUsesPlayerCamera() {
      return scene === 'playing' || scene === 'paused' || scene === 'golden_skill' ||
        scene === 'golden_skill_ad' || scene === 'death' || scene === 'game_over' ||
        scene === 'soul_departure' || scene === 'finish_slowmo' || scene === 'score_tally';
    }
    function updateCameraFollow(dt, immediate) {
      if (!player || !runtimeLevel || !sceneUsesPlayerCamera()) return;
      var maxCameraX = Math.max(0, runtimeLevel.width - VIEW_W);
      var targetX = cameraTargetXForPlayer();
      if (immediate || !cameraFollowInitialized || !isFinite(cameraX)) {
        cameraX = targetX;
        cameraFollowInitialized = true;
      } else {
        // 时间制阻尼：60 / 90 / 120Hz 下速度一致，不依赖物理步数量。
        var followDt = Math.min(0.05, Math.max(0, Number(dt) || 0));
        var followAlpha = 1 - Math.exp(-13.5 * followDt);
        cameraX += (targetX - cameraX) * followAlpha;

        // 严格安全区：即使高速弹射或某个逻辑分支提前结束，角色也不会离开画面。
        var safeLeft = Math.max(58, VIEW_W * 0.18);
        var safeRight = VIEW_W - safeLeft;
        var playerScreenX = player.x - cameraX;
        if (playerScreenX < safeLeft) cameraX = player.x - safeLeft;
        else if (playerScreenX > safeRight) cameraX = player.x - safeRight;
      }
      cameraX = clamp(cameraX, 0, maxCameraX);
      cameraY = 0;
    }
    function centerCameraOnPlayer(lockSeconds, deathLock) {
      // 保留旧调用接口，但不再创建锁定状态；只执行一次立即定位。
      updateCameraFollow(0, true);
    }
    function releaseDeathCameraLock() {
      cameraFollowInitialized = false;
    }
    function createRunStats() {
      return {
        score: 0, food: 0, deaths: 0, hearts: LIVES_PER_PLAY, stages: 0,
        combo: 0, multiplier: 1, comboTimer: 0, stageStartDeaths: 0,
        submitted: false, rank: 0, scoreValid: true, adReviveUsed: false, shareReviveUsed: false,
        foodScore: 0, flightScore: 0, tongueScore: 0, heightScore: 0, levelScore: 0,
        stageFoodScore: 0, stageFlightDistance: 0, stageFlightScore: 0,
        stageTongueCount: 0, stageTongueScore: 0, stageHeightScore: 0,
        stageLevelScore: 0, stageTotalScore: 0,
        stageFartPenalty: 0, stageCrowPenalty: 0, stageTimeScore: 0, stageStartTime: 0,
        collectedFoodKinds: []
    };
    }
    function createFinishState() {
      return {
        timer: 0, zoom: 1, tallyScore: 0, tallyFood: 0, tallyTimer: 0,
        poseIndex: 0, confettiTimer: 0, clearBonus: 0,
        heightScore: 0, heightBand: 0, stageTotal: 0,
        scoreItems: [], tallyValues: [0,0,0,0,0,0,0,0,0], leaderboardShown: false,
        tallyComplete: false, roundPortalTimer: 0, roundPortalStarted: false, kioskHandled: false
      };
    }
    function resetTransientStageState() {
      tutorialInputSeen = false; tutorialHintTimer = runtimeLevel.isTutorial ? 4.5 : 0;
      player = makePlayer(); cameraX = 0; cameraY = 0; cameraFollowInitialized = false; particles = []; floatingTexts = []; screenShake = 0; pointerHeld = false; deathTimer = 0; deathLeaderboardShown = false;
      finishState = createFinishState();
      tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
      runStats.combo = 0; runStats.multiplier = 1; runStats.comboTimer = 0;
      runStats.stageStartDeaths = runStats.deaths;
      runStats.stageFoodScore = 0; runStats.stageFlightDistance = 0; runStats.stageFlightScore = 0;
      runStats.stageTongueCount = 0; runStats.stageTongueScore = 0;
      runStats.stageHeightScore = 0; runStats.stageLevelScore = 0; runStats.stageTotalScore = 0;
      runStats.stageFartPenalty = 0; runStats.stageCrowPenalty = 0; runStats.stageTimeScore = 0; runStats.stageStartTime = nowMs();
      runStats.collectedFoodKinds = [];
      // 2026-10-01：蛇形态 / 水漫金山 / 超级贪吃 的一次性状态，切关与重开都要归零。
      resetSnakeForm();
      floodFountainUsed = false;
      floodFountainFx = { active: false, timer: 0, duration: 0.9, x: 0, y: 0, particleTimer: 0 };
      resetGreedyShot();
      resetCrowState();
      resetTutorialFlowForStage();
    }
    function resetSnakeForm() {
      snakeForm = {
        active: false, kind: 'bai', timer: 0, duration: SNAKE_FORM_DURATION,
        headX: 0, headY: 0, targetX: 0, targetY: 0,
        vx: 0, vy: 0, facing: 1, phase: 0, particleTimer: 0, segments: []
      };
    }
    function resetSoulState() {
      soulState = { active: false, timer: 0, duration: SOUL_ASCEND_DURATION, x: 0, y: 0, particleTimer: 0 };
    }
    function resetGameOverState() {
      gameOverState = { timer: 0, hold: GAME_OVER_HOLD_SECONDS, fade: GAME_OVER_FADE_SECONDS, leaderboardShown: false };
    }
    function returnToMenuAfterGameOver() {
      clearReviveCheckpoint();
      runStats = createRunStats();
      runtimeLevel = clone(level);
      rebuildRuntimeSpatialIndex();
      runtimeLevel.foods.forEach(function(f) { f.collected = false; });
      player = null; cameraX = 0; cameraY = 0; cameraFollowInitialized = false; particles = []; floatingTexts = []; crows = []; featherFx = []; crowVanishFx = []; screenShake = 0; pointerHeld = false;
      tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
      leaderboardOpen = false; leaderboardAutoReturnToMenu = false; leaderboardScrollY = 0; deathTimer = 0; deathLeaderboardShown = false; menuIntroOpen = false; stageSelectOpen = false;
      reviveOffer.busy = false; closeRewardDialog();
      resetSoulState(); resetGameOverState();
      stopBgm();
      setScene('menu');
    }
    function beginGameOverSequence() {
      // [v42 现场 2026-11-01] 线下闯关绝不进入「游戏结束」面板（排行榜 / 重新开始 / 返回首页）：
      //   复活流程被放弃时直接收尾回待机，避免排行榜收起后露出「重新开始」按钮并停留。
      if (kioskRun.active) {
        try { submitRunToLeaderboard('game_over'); } catch (eKgSubmit) {}
        try { kioskEndRun(); } catch (eKgEnd) { returnToMenuAfterGameOver(); }
        return;
      }
      submitRunToLeaderboard('game_over');
      resetSoulState();
      resetGameOverState();
      setScene('game_over');
    }
    function leaderboardMaxScroll() {
      // 未上榜时列表末尾多一 行「你还没有上榜噢」提示，可滚动量相应 +1 行
      var rows = LEADERBOARD_LIMIT + (leaderboardNotOnList ? 1 : 0);
      return Math.max(0, rows * LEADERBOARD_ROW_HEIGHT - LEADERBOARD_VIEW_HEIGHT);
    }
    function clampLeaderboardScroll() {
      leaderboardScrollY = clamp(leaderboardScrollY, 0, leaderboardMaxScroll());
    }
    function startLeaderboardAutoScroll() {
      var view = computeGlobalLeaderboardView();
      var myRank = view ? Math.max(1, Math.round(Number(view.myRank) || 1)) : 1;
      leaderboardNotOnList = myRank > LEADERBOARD_LIMIT;
      var maxScroll = leaderboardMaxScroll();
      var toY;
      if (!leaderboardNotOnList) {
        toY = (myRank - 1) * LEADERBOARD_ROW_HEIGHT - (LEADERBOARD_VIEW_HEIGHT - LEADERBOARD_ROW_HEIGHT) * 0.5;
        toY = clamp(toY, 0, maxScroll);
      } else {
        toY = maxScroll; // 未上榜：滚到最后一页显示提示文字
      }
      leaderboardAutoScroll = { timer: 0, holdSec: 1.0, durSec: 3.0, fromY: 0, toY: toY };
      leaderboardScrollY = 0;
    }
    function updateLeaderboardAutoScroll(dt) {
      var s = leaderboardAutoScroll;
      if (!s) return;
      s.timer += dt;
      if (s.timer <= s.holdSec) { leaderboardScrollY = 0; return; } // 第 1 名停留 1 秒
      var t = Math.min(1, (s.timer - s.holdSec) / s.durSec);
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
      leaderboardScrollY = s.fromY + (s.toY - s.fromY) * e;
      if (t >= 1) leaderboardAutoScroll = null;
    }
    function cancelLeaderboardAutoScroll() { leaderboardAutoScroll = null; }
    function scrollLeaderboardToRank(rank) {
      rank = Math.max(0, Math.round(Number(rank) || 0));
      if (!rank) { leaderboardScrollY = 0; return; }
      leaderboardScrollY = (rank - 1) * LEADERBOARD_ROW_HEIGHT - (LEADERBOARD_VIEW_HEIGHT - LEADERBOARD_ROW_HEIGHT) * 0.5;
      clampLeaderboardScroll();
    }
    function findCurrentPlayerRank() {
      for (var i = 0; i < leaderboard.length; i++) {
        var e = leaderboard[i];
        if (e && (e.isCurrent || (e.playerId && e.playerId === playerProfile.playerId))) return i + 1;
      }
      return lastSubmittedRank || (runStats && runStats.rank) || 0;
    }
    function buildOpenDataLocalRows() {
      var rows = [];
      for (var i = 0; i < leaderboard.length && rows.length < LEADERBOARD_LIMIT; i++) {
        var item = leaderboard[i];
        if (!item) continue;
        rows.push({
          nickname: item.nickName || '微信玩家',
          avatarUrl: item.avatarUrl || '',
          score: Math.max(0, Math.round(Number(item.score) || 0)),
          city: item.city || '',
          playerId: item.playerId || item.id || ('local_' + i),
          isCurrent: !!item.isCurrent || (!!item.playerId && item.playerId === playerProfile.playerId)
        });
      }
      var foundCurrent = false;
      for (var r = 0; r < rows.length; r++) if (rows[r].isCurrent) { foundCurrent = true; break; }
      if (!foundCurrent) {
        rows.push({
          nickname: playerProfile.nickName || '微信玩家',
          avatarUrl: playerProfile.avatarUrl || '',
          score: Math.max(0, Math.round(Number(progress.totalScore) || Number(progress.bestScore) || 0)),
          city: playerProfile.city || '',
          playerId: playerProfile.playerId || 'current_player',
          isCurrent: true
        });
      }
      rows.sort(function(a, b) { return b.score - a.score; });
      return rows.slice(0, LEADERBOARD_LIMIT);
    }
    // 玩家本人的展示信息（来自微信用户资料，城市自动填充），用于开放数据域注入“我”的行。
    function buildSelfInfo() {
      return {
        nickname: playerProfile.nickName || '微信玩家',
        avatarUrl: playerProfile.avatarUrl || '',
        score: Math.max(0, Math.round(Number(progress.bestScore) || Number(progress.totalScore) || 0)),
        city: playerProfile.city || ''
      };
    }
    function hasOpenDataLeaderboard() { return !!(openDataLeaderboard && openDataLeaderboard.isAvailable && openDataLeaderboard.isAvailable()); }
    function postOpenDataLeaderboardTouch(phase, px, py) {
      if (!hasOpenDataLeaderboard() || !openDataLeaderboard.touch) return false;
      var panelX = 44, panelY = 112, panelW = VIEW_W - 88, panelH = 720;
      var x = (px - panelX) / panelW * 690;
      var y = (py - panelY) / panelH * 1100;
      openDataLeaderboard.touch(phase, x, y);
      return true;
    }
    // 同城榜已移除：微信自 2023-10-20 起不再向任何用户资料接口下发省份/城市，无法自动获取玩家城市。
    // 排行榜仅保留好友榜，弹窗始终由本地/云端榜单数据驱动渲染；开放数据域仅作后台同步。
    function openLeaderboardAtPlayer(autoReturn, tab) {
      // [2026-10-16 需求] 网页版不显示小游戏端内置排行榜（死亡/结算后自动弹的那套 50 强榜）。
      //   网页端的名次展示走 index.html 的 window.__kioskShowLeaderboard（前 500 强）。
      if (WEB_DISABLE_BUILTIN_LEADERBOARD) return;
      if (scene !== 'game_over' && scene !== 'paused' && scene !== 'menu' && scene !== 'death') return;
      // 兼容旧调用：'friend' 视为 'total'（旧项目里"好友榜"已合并到"总榜单"维度）。
      var normalized = (tab === 'personal' || tab === 'city') ? 'personal' : 'total';
      leaderboardPreviousScene = scene;
      leaderboardOpen = true;
      leaderboardTab = normalized;
      leaderboardAutoReturnToMenu = !!autoReturn;
      leaderboardDrag.active = false;
      leaderboardScrollY = 0;
      // 先基于本地 / 云端已有数据计算一次视图，再用云端最新结果覆盖（云端优先级最高）。
      computeGlobalLeaderboardView();
      if (normalized === 'total') startLeaderboardAutoScroll(); // 第1名停留1秒 → 3秒滚到本人名次/最后一页
      else { cancelLeaderboardAutoScroll(); leaderboardNotOnList = false; leaderboardScrollY = 0; }
      refreshLeaderboardFromCloud(function() { computeGlobalLeaderboardView(); clampLeaderboardScroll(); });
      if (hasOpenDataLeaderboard()) {
        try { openDataLeaderboard.show('total', buildOpenDataLocalRows(), buildSelfInfo()); } catch (ignoreShow) {}
      }
    }
    function switchLeaderboardTab(tab) {
      var normalized = (tab === 'personal' || tab === 'city') ? 'personal' : 'total';
      if (leaderboardTab === normalized) return;
      leaderboardTab = normalized;
      leaderboardDrag.active = false;
      if (normalized === 'total') startLeaderboardAutoScroll(); // 切回总榜单重新巡览
      else { cancelLeaderboardAutoScroll(); leaderboardNotOnList = false; leaderboardScrollY = 0; }
      if (hasOpenDataLeaderboard()) {
        try { openDataLeaderboard.show(normalized, buildOpenDataLocalRows(), buildSelfInfo()); } catch (ignoreSwitchTab) {}
      }
    }
    // 合成一份"全部美食家"列表（含玩家本人），按总分倒序，取前 10，并把玩家本人插回。
    // testMode / 离线云端情况下，若数据太少（<50 条），会临时注入 ~1000 名虚拟玩家用于榜单占位（不入库）。
    function ensureGlobalLeaderboardSeed(currentRows) {
      var rows = Array.isArray(currentRows) ? currentRows.slice() : [];
      var threshold = 50; // 总玩家数低于这个值就补
      var target = 1000; // 目标占位数
      if (rows.length >= threshold || cloudLeaderboardReady) return rows; // 已启用云端聚合：不再注入假数据
      // 把 playerId+分数 哈希成数字种子（直接 Number(字符串) 会得到 NaN，导致虚拟玩家分数全为 NaN）
      var seedStr = (playerProfile.playerId || 'seed') + ':' + (myBestScoreForLeaderboard() || 0);
      var seed = 0;
      for (var si = 0; si < seedStr.length; si++) { seed = (seed * 31 + seedStr.charCodeAt(si)) % 233280; }
      if (!seed) seed = 12345;
      function rand() {
        // 简易确定性伪随机，便于同一玩家两次会话结果稳定
        seed = (Number(seed) * 9301 + 49297) % 233280;
        return seed / 233280;
      }
      var surnames = ['美食家', '吃货王', '甜品控', '辣味狂', '减肥失败', '街头老饕', '大胃王', '夜市侠', '碳水怪', '清凉一夏'];
      // 虚拟玩家分数上界：玩家本人分数太低（<200）时也强制有合理梯度，避免前 10 全 0 分没看头
      var best = Math.max(0, Math.round(myBestScoreForLeaderboard() || 0));
      var maxOther = Math.max(2400, Math.round(best * 2.4));
      // 分数幂律分布：rand 取 0.05~1 之间，让高分玩家少、低分玩家多（与真实榜接近）
      while (rows.length < target) {
        var u = Math.max(0.05, rand());
        var u2 = Math.max(0.05, rand());
        var v = Math.round(maxOther * (u * u2)); // 平方后差距更明显
        var sk = surnames[Math.floor(rand() * surnames.length)] || '美食家';
        rows.push({
          id: 'synthetic_' + rows.length + '_' + Math.floor(rand() * 1e6),
          playerId: 'synthetic_' + rows.length,
          nickName: sk + (Math.floor(rand() * 9990) + 10),
          avatarUrl: '',
          score: Math.max(0, v),
          bestScore: 0,
          city: '',
          food: 0,
          stages: 0,
          deaths: 0,
          createdAt: 0,
          updatedAt: 0,
          isCurrent: false
        });
      }
      return rows;
    }
    function myBestScoreForLeaderboard() {
      var best = Math.max(Math.max(0, Number(progress.bestScore) || 0), Math.max(0, Number(progress.totalScore) || 0));
      return best;
    }
    // 计算「总榜单 + 个人榜」共用视图：top10 + 玩家本人名次 + 击败百分比。
    // 每帧都会被渲染层调用（含 1000 条注入数据的排序），因此用 数据版本号+本人信息 做缓存，数据未变时直接返回。
    var globalLeaderboardViewCache = null;
    var globalLeaderboardViewCacheKey = '';
    function computeGlobalLeaderboardView() {
      var cacheKey = leaderboardDataVersion + '|' + myBestScoreForLeaderboard() + '|' + (playerProfile.playerId || '') + '|' + (playerProfile.nickName || '') + '|' + (cloudLeaderboardReady ? 1 : 0);
      if (globalLeaderboardViewCache && globalLeaderboardViewCacheKey === cacheKey) return globalLeaderboardViewCache;
      // 1. 已有数据：本地 leaderboard（loadLeaderboard 或云端刷新后）+ 强制插入玩家本人条目（若缺）
      var rows = [];
      try {
        for (var i = 0; i < leaderboard.length && rows.length < 200; i++) {
          var it = leaderboard[i];
          if (!it) continue;
          rows.push({
            id: it.id || '',
            playerId: it.playerId || it.id || '',
            nickName: String(it.nickName || '微信玩家'),
            avatarUrl: String(it.avatarUrl || ''),
            score: Math.max(0, Math.round(Number(it.score) || 0)),
            city: '',
            isCurrent: !!it.isCurrent || (!!it.playerId && it.playerId === playerProfile.playerId)
          });
        }
      } catch (e) {}
      // 2. 把玩家本人强制插入（如果不存在）
      var myId = playerProfile.playerId || 'current_player';
      var myScore = myBestScoreForLeaderboard();
      var myName = playerProfile.nickName || '微信玩家';
      var myAvatar = playerProfile.avatarUrl || '';
      var foundSelf = false;
      for (var j = 0; j < rows.length; j++) {
        if (rows[j].playerId && rows[j].playerId === myId) { rows[j].score = Math.max(rows[j].score, myScore); rows[j].isCurrent = true; foundSelf = true; break; }
      }
      if (!foundSelf) {
        rows.push({ id: '', playerId: myId, nickName: myName, avatarUrl: myAvatar, score: myScore, city: '', isCurrent: true });
      }
      // 3. testMode/云端未启用：注入虚拟玩家到 ~1000
      rows = ensureGlobalLeaderboardSeed(rows);
      // 4. 排序（按 score 倒序，平局按 playerId 字典序稳定）
      rows.sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.playerId || '').localeCompare(String(b.playerId || ''));
      });
      // 5. 找玩家本人名次
      var myRank = 1;
      for (var k = 0; k < rows.length; k++) {
        if (rows[k].isCurrent || (rows[k].playerId && rows[k].playerId === myId)) { myRank = k + 1; break; }
      }
      var totalPlayers = Math.max(1, rows.length);
      // 击败百分比：你击败了 (排名外的人数 / 总人数)；分数相同时仍按名次算
      var beatPercent = Math.round(Math.max(0, Math.min(100, (1 - (myRank - 1) / totalPlayers) * 100)));
      var top10 = rows.slice(0, 10).map(function(e) { return { id: e.id, playerId: e.playerId, nickName: e.nickName, avatarUrl: e.avatarUrl, score: e.score, isCurrent: e.isCurrent }; });
      // 总榜单支持下滑查看前 50 名
      var top50 = rows.slice(0, 50).map(function(e) { return { id: e.id, playerId: e.playerId, nickName: e.nickName, avatarUrl: e.avatarUrl, score: e.score, isCurrent: e.isCurrent }; });
      globalLeaderboardView = {
        top10: top10,
        top50: top50,
        myRank: myRank,
        myScore: myScore,
        totalPlayers: totalPlayers,
        beatPercent: beatPercent
      };
      globalLeaderboardViewCache = globalLeaderboardView;
      globalLeaderboardViewCacheKey = cacheKey;
      return globalLeaderboardView;
    }
    function closeLeaderboard() {
      if (hasOpenDataLeaderboard() && openDataLeaderboard.hide) { try { openDataLeaderboard.hide(); } catch (ignoreHide) {} }
      leaderboardOpen = false;
      leaderboardDrag.active = false;
      cancelLeaderboardAutoScroll();
      if (leaderboardAutoReturnToMenu) returnToMenuAfterGameOver();
      leaderboardAutoReturnToMenu = false;
    }
    function beginLeaderboardDrag(px, py) {
      if (!pointInRect(px, py, uiHotspots.leaderboardList)) return false;
      cancelLeaderboardAutoScroll(); // 玩家手动拖动即接管，停止自动巡览
      leaderboardDrag = { active: true, startY: py, lastY: py, scrollStart: leaderboardScrollY, moved: false };
      return true;
    }
    function updateLeaderboardDrag(py) {
      if (!leaderboardDrag.active) return;
      var dy = py - leaderboardDrag.startY;
      if (Math.abs(py - leaderboardDrag.lastY) > 1) leaderboardDrag.moved = true;
      leaderboardDrag.lastY = py;
      leaderboardScrollY = leaderboardDrag.scrollStart - dy;
      clampLeaderboardScroll();
    }
    function endLeaderboardDrag() { leaderboardDrag.active = false; }

    function shuffledCopy(items) {
      var out = (items || []).slice();
      for (var i = out.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = out[i]; out[i] = out[j]; out[j] = temp;
      }
      return out;
    }

    function resolveFoodPoolKind(token) {
      if (token !== 'fruit') return token;
      return FRUIT_FOOD_KINDS[Math.floor(Math.random() * FRUIT_FOOD_KINDS.length)];
    }

    function applyStageFoodTheme(targetLevel) {
      if (!targetLevel || targetLevel.isTutorial) return;
      var pool = STAGE_FOOD_POOLS[targetLevel.name];
      if (!pool || !pool.length) return;
      var foods = targetLevel.foods || [];
      var bag = [];
      var bagIndex = 0;
      function nextKind() {
        if (bagIndex >= bag.length) {
          bag = shuffledCopy(pool);
          bagIndex = 0;
        }
        return resolveFoodPoolKind(bag[bagIndex++]);
      }
      for (var i = 0; i < foods.length; i++) {
        var food = foods[i];
        if (!food || food.skillItem || food.kind === 'golden_sweet_potato') continue;
        // 2026-10-01：雄黄酒是杭州关彩蛋，不能被关卡食物池随机洗掉。
        if (food.kind === 'xionghuangjiu') continue;
        food.kind = nextKind();
        food.points = NORMAL_FOOD_POINTS;
        food.localThemeFood = true;
      }
    }

    // —— 雄黄酒彩蛋投放（2026-10-10 重写）——
    // 用户规则：只要穿戴白娘子/小青，任何关卡都会出现「有且仅有 1 盅」雄黄酒，位置每局随机。
    // 历史沿革：
    //   2026-10-01 初版只投杭州关；2026-10-09 改为尊重关卡 JSON 的固定设计位（杭州 @1367）；
    //   2026-10-10 用户要求放开到「所有关卡 + 随机位置」，固定位逻辑作废（JSON 里的 f_xionghuangjiu
    //   坐标只作为占位，会在下方被随机落点覆盖）。
    // 未穿戴蛇娘皮肤时把雄黄酒撤掉，避免普通玩家吃到彩蛋酒却没有任何反应（它会是 200 分普通食物）。
    function ensureSnakeMaidEggFood(targetLevel) {
      if (!targetLevel) return;
      var foods = targetLevel.foods || [];
      var egg = null;
      for (var i = 0; i < foods.length; i++) {
        if (foods[i] && foods[i].kind === 'xionghuangjiu') { if (!egg) egg = foods[i]; else foods.splice(i--, 1); }
      }
      if (!snakeMaidEggEnabled()) {
        if (egg) foods.splice(foods.indexOf(egg), 1);
        targetLevel.foods = foods;
        return;
      }
      if (!egg) {
        egg = { id: 'f_xionghuangjiu', x: 0, y: 360, kind: 'xionghuangjiu', points: XIONG_HUANG_JIU_POINTS, collected: false, eggItem: true };
        foods.push(egg);
      }
      var spot = pickRandomEggSpot(targetLevel);
      egg.x = spot.x;
      egg.y = spot.y;
      egg.kind = 'xionghuangjiu';
      egg.points = XIONG_HUANG_JIU_POINTS;
      egg.eggItem = true;
      egg.collected = false;
      targetLevel.foods = foods;
    }

    // 投放条件：穿戴白娘子/小青 + 非教学关（教学关加彩蛋会打断引导）。
    function snakeMaidEggEnabled() {
      return !isTutorialStage() && (isBainiangziSkinActive() || isXiaoqingSkinActive());
    }

    // 随机落点：在关卡可玩区域里采样，尽量避开墙体、离出生点/其它食物有距离。
    // 采样若干次取「离其它食物最远」的候选；一次都不合规则退回 1/3 处（与旧兜底一致）。
    function pickRandomEggSpot(targetLevel) {
      var W = Number(targetLevel.width) || 7000;
      var H = Number(targetLevel.height) || 960;
      var walls = targetLevel.walls || [];
      var foods = targetLevel.foods || [];
      var startX = Number((targetLevel.start && targetLevel.start.x) || 0);
      var minX = Math.min(320, W * 0.25), maxX = Math.max(minX + 1, W - 320);
      var minY = 140, maxY = Math.max(minY + 1, Math.min(H - 140, H * 0.62));
      var best = null;
      for (var t = 0; t < 80; t++) {
        // 先取整再判墙：否则浮点边界（x=墙边+46.4）取整后可能翻到墙内（46 → 47 越界）。
        var x = Math.round(minX + Math.random() * (maxX - minX));
        var y = Math.round(minY + Math.random() * (maxY - minY));
        if (eggSpotHitsWall(x, y, walls)) continue;
        if (Math.abs(x - startX) < 220) continue;
        var d = eggSpotFoodDistance(x, y, foods);
        if (!best || d > best.d) best = { x: x, y: y, d: d };
        if (d >= 130) break;
      }
      if (!best) best = scanEggSpotFallback(targetLevel, minX, maxX, minY, maxY, walls, startX);
      return best;
    }

    // 采样全被拒时的兜底（实测约 0~1% 概率）：从 1/3 处向两侧交替扫描，取第一个不压墙、
    // 离出生点够远的点 —— 保证酒盅不会埋进墙里吃不到。
    function scanEggSpotFallback(targetLevel, minX, maxX, minY, maxY, walls, startX) {
      var seed = clamp((Number(targetLevel.width) || 7000) / 3, minX, maxX);
      var baseY = clamp(360, minY, maxY);
      // 先扫 y=360 这条线；万一整条线都被墙占满（实测约 0.06%），再换几条高度重试，
      // 保证酒盅一定落在可吃的空处。
      var ys = [baseY, baseY - 100, baseY + 100, baseY - 200, baseY + 200, minY + 30, maxY - 30, (minY + maxY) * 0.5];
      var span = Math.max(0, maxX - minX);
      for (var yi = 0; yi < ys.length; yi++) {
        var y = clamp(ys[yi], minY, maxY);
        for (var step = 0; step <= span; step += 60) {
          var cands = step === 0 ? [seed] : [seed - step, seed + step];
          for (var i = 0; i < cands.length; i++) {
            var x = cands[i];
            if (x < minX || x > maxX) continue;
            if (eggSpotHitsWall(x, y, walls)) continue;
            if (Math.abs(x - startX) < 220) continue;
            return { x: Math.round(x), y: Math.round(y), d: 0 };
          }
        }
      }
      return { x: Math.round(seed), y: Math.round(baseY), d: 0 };
    }

    // 墙体是左上角基准 {x,y,w,h}；pad = 食物半径 + 余量，避免酒盅埋进墙里吃不到。
    function eggSpotHitsWall(x, y, walls) {
      var pad = 46;
      for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        if (!w) continue;
        var wx = Number(w.x) || 0, wy = Number(w.y) || 0, ww = Number(w.w) || 0, wh = Number(w.h) || 0;
        if (x >= wx - pad && x <= wx + ww + pad && y >= wy - pad && y <= wy + wh + pad) return true;
      }
      return false;
    }

    function eggSpotFoodDistance(x, y, foods) {
      var best = 1e9;
      for (var i = 0; i < foods.length; i++) {
        var f = foods[i];
        if (!f || f.kind === 'xionghuangjiu') continue;
        var dx = Number(f.x) - x, dy = Number(f.y) - y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < best) best = d;
      }
      return best;
    }

    // 2026-10-05：杭州关「随机放置重新设计」——每局沿全长随机散布锚点与食物，
    // 雄黄酒由 ensureSnakeMaidEggFood 重新投放（2026-10-10 起为随机位置）。地图已加长（level_pack.json 的 L4 width）。
    // 2026-10-09 已停用：用户在关卡编辑器手工设计了固定杭州地图（level_pack.json 的 L4），
    // startRun 不再调用本函数。想恢复随机布局，在 startRun 里恢复调用即可（雄黄酒钉位逻辑
    // 仍由 ensureHangzhouEggFood 兜底，但固定地图版本会尊重 JSON 里的设计位置）。
    function randomizeHangzhouLayout(targetLevel) {
      if (!targetLevel || targetLevel.cityId !== 'hangzhou') return;
      var W = Number(targetLevel.width) || 7000;
      var H = Number(targetLevel.height) || 960;
      // 2026-10-05 用户要求：杭州关锚点一律落在「地图上方 1/3」区域内（y ≤ H/3），不再出现在下方。
      // 2026-10-05 补充：关卡长度已与底图左右对齐（backgroundTravelRatio=1），沿全长加密散布足够多的闯关道具。
      var topZone = H / 3;
      var anchors = [];
      var gap = 230 + Math.random() * 70;
      var x = 360, aIdx = 0;
      while (x < W - 300) {
        anchors.push({ id: 'hz_a' + (aIdx++), x: Math.round(x), y: Math.round(130 + Math.random() * (topZone - 150)) });
        x += gap * (0.8 + Math.random() * 0.5);
      }
      targetLevel.anchors = anchors;
      var foods = [], fIdx = 0;
      for (var ai = 0; ai < anchors.length - 1; ai++) {
        var ax1 = anchors[ai].x, ax2 = anchors[ai + 1].x;
        var n = 2 + (Math.random() < 0.35 ? 1 : 0);
        for (var kk = 0; kk < n; kk++) {
          foods.push({
            id: 'hz_f' + (fIdx++),
            x: Math.round(ax1 + (ax2 - ax1) * ((kk + 1) / (n + 1)) + (Math.random() - 0.5) * 40),
            y: Math.round(140 + Math.random() * (topZone - 160)),
            kind: themedFoodPickForEditor(targetLevel), points: NORMAL_FOOD_POINTS, collected: false
          });
        }
      }
      targetLevel.foods = foods;
    }

    function addRandomVeniceAnchors(targetLevel) {
      if (!targetLevel || targetLevel.theme !== 'venice') return;
      targetLevel.anchors = targetLevel.anchors || [];
      var count = 4 + Math.floor(Math.random() * 4); // 每局随机增加 4–7 个锚点。
      var minX = 420;
      var maxX = Math.max(minX + 1, targetLevel.width - 260);
      var minY = 150;
      var maxY = Math.max(minY + 1, targetLevel.height - 170);
      var made = 0;
      var attempts = 0;
      while (made < count && attempts < 90) {
        attempts += 1;
        var candidate = {
          id: 'venice_random_anchor_' + (made + 1),
          x: Math.round(minX + Math.random() * (maxX - minX)),
          y: Math.round(minY + Math.random() * (maxY - minY)),
          runtimeRandom: true
        };
        var clear = true;
        for (var i = 0; i < targetLevel.anchors.length; i++) {
          var anchor = targetLevel.anchors[i];
          if (dist(candidate.x, candidate.y, anchor.x, anchor.y) < 145) { clear = false; break; }
        }
        if (!clear) continue;
        targetLevel.anchors.push(candidate);
        made += 1;
      }
    }

    function addGoldenSweetPotatoes(targetLevel) {
      if (!targetLevel || targetLevel.isTutorial) return;
      targetLevel.foods = targetLevel.foods || [];
      targetLevel.foods = targetLevel.foods.filter(function(food) {
        return !food || (food.id !== 'golden_sweet_potato_route' && food.id !== 'golden_sweet_potato_sky');
      });
      var anchors = (targetLevel.anchors || []).filter(function(a) {
        return a && a.x > targetLevel.width * 0.20 && a.x < targetLevel.width * 0.82;
      });
      var routeX = targetLevel.width * 0.5;
      var routeY = targetLevel.height * 0.46;
      function routeSpotIsClear(x, y) {
        var walls = targetLevel.walls || [], bumpers = targetLevel.bumpers || [];
        for (var wi = 0; wi < walls.length; wi++) {
          var w = walls[wi];
          if (!w || w.removed) continue;
          if (x >= w.x - 44 && x <= w.x + w.w + 44 && y >= w.y - 44 && y <= w.y + w.h + 44) return false;
        }
        for (var bi = 0; bi < bumpers.length; bi++) {
          var b = bumpers[bi];
          if (b && dist(x, y, b.x, b.y) < (Number(b.r) || 40) + 58) return false;
        }
        return x < targetLevel.finish.x - 120 && dist(x, y, targetLevel.start.x, targetLevel.start.y) > 190;
      }
      for (var routeAttempt = 0; routeAttempt < 36; routeAttempt++) {
        var routeAnchor = anchors.length ? anchors[Math.floor(Math.random() * anchors.length)] : null;
        var candidateX = routeAnchor
          ? clamp(routeAnchor.x + (Math.random() - 0.5) * 170, 260, targetLevel.width - 260)
          : targetLevel.width * (0.30 + Math.random() * 0.44);
        var candidateY = routeAnchor
          ? clamp(routeAnchor.y + 70 + Math.random() * 130, 150, targetLevel.height - 150)
          : clamp(240 + Math.random() * targetLevel.height * 0.42, 150, targetLevel.height - 150);
        routeX = candidateX; routeY = candidateY;
        if (routeSpotIsClear(routeX, routeY)) break;
      }
      targetLevel.foods.push({
        id: 'golden_sweet_potato_route', kind: 'golden_sweet_potato', points: GOLDEN_SWEET_POTATO_POINTS,
        x: Math.round(routeX), y: Math.round(routeY), skillItem: true, goldenRoute: true,
        collected: false, runtimeRandom: true
      });
    }

    function resetGoldenSkillForRun(resetSession) {
      // 2026-10-11 下午：现场登录直接送 5 颗番薯——整个现场闯关共用一个番薯池（用完即挑战失败）；
      // 每轮开始把本关可用番薯同步成剩余额度。普通游玩维持原有 1 颗。
      if (resetSession) goldenSkillState.points = kioskRun.active ? Math.max(0, Number(kioskRun.potatoes) || 0) : 1;
      goldenSkillState.stageAdUsed = false;
      goldenSkillState.menuActive = false;
      goldenSkillState.trigger = '';
      goldenSkillState.deathCause = '';
      goldenSkillState.anchorIndex = null;
      goldenSkillState.selected = null;
      goldenSkillState.gestureActive = false;
      goldenSkillState.phase = 'ready';
      goldenSkillState.aimAngle = 0;
      goldenSkillState.pullDistance = 0;
      goldenSkillState.power = 0;
      goldenSkillState.armed = false;
      goldenSkillState.timer = 0;
      goldenSkillState.countdownLocked = false;
      goldenSkillState.adBusy = false;
      goldenSkillState.uiOffsetX = 0;
      goldenSkillState.uiOffsetY = 0;
      goldenSkillState.gestureStartX = 0;
      goldenSkillState.gestureStartY = 0;
      goldenSkillState.targetX = VIEW_W * 0.5;
      goldenSkillState.targetY = VIEW_H * 0.78;
      goldenSkillState.dockDistance = 158;
      goldenSkillState.dockProgress = 0;
      goldenSkillState.aimStartX = 0;
      goldenSkillState.aimStartY = 0;
      goldenSkillState.aimDragX = 0;
    }

    function crowEnabledForCurrentStage() {
      if (!runtimeLevel) return false;
      var roundNo = currentRoundNumber();
      // 第1轮前六关（T1/T2/T3 教学关 + L1/L2/L3 正式关，即森林 / 农村 / 上海 各两套）不出现乌鸦；
      // 第1轮第7关（L4）起及第2轮以后，所有关卡因难度需求出现乌鸦。
      // 注意：runtimeLevel 是 clone 出来的副本，STAGES.indexOf(runtimeLevel) 永远返回 -1，
      // 因此不能用它反查序号；必须依赖模块级 stageIndex 作为当前关序号的权威来源。
      if (roundNo === 1 && typeof stageIndex === 'number' && stageIndex >= 0 && stageIndex < 6) return false;
      return true;
    }
    function crowSpawnDelay(initial) {
      var roundNo = currentRoundNumber();
      // 第1轮：8-12秒；第2轮：7-11秒；第R轮：(9-R)~(13-R)秒（高度随机由 spawnCrow 决定）。
      var lo = Math.max(2, 9 - roundNo);
      var hi = Math.max(4, 13 - roundNo);
      var delay = lo + Math.random() * (hi - lo);
      if (initial) delay *= 0.62;
      return Math.max(1.2, delay);
    }
    function resetCrowState() {
      crows = [];
      featherFx = [];
      crowVanishFx = [];
      crowSpawnTimer = 0;
      crowSpawnCount = 0;   // 新关卡重新计数，保证「第一只」是本关第一只
      crowNextSpawn = crowEnabledForCurrentStage() ? crowSpawnDelay(true) : 9999;
    }
    function spawnCrow() {
      if (!crowEnabledForCurrentStage()) return false;
      var roundNo = currentRoundNumber();
      var minY = 135;
      var maxY = Math.max(minY + 40, runtimeLevel.height - 145);
      var speed = (CROW_BASE_SPEED + Math.random() * 75) * crowFlightSpeedMultiplierFor(roundNo);
      crows.push({
        id: 'crow_' + nowMs() + '_' + Math.floor(Math.random() * 100000),
        x: cameraX + VIEW_W + 80 + Math.random() * 95,
        y: minY + Math.random() * (maxY - minY),
        vx: -speed,
        size: 92 + Math.random() * 12,
        r: 30,
        animTime: Math.random() * 1.2,
        hitTongue: false,
        hitPlayer: false,
        isFirstCrow: crowSpawnCount === 0   // 本关第一只：小青在杭州会让它飞到画面中央就掉头
      });
      crowSpawnCount += 1;
      return true;
    }
    function activeTongueCollisionSegment() {
      if (!player) return null;
      var mouth = getMouthWorld();
      if (player.attachIndex !== null && runtimeLevel.anchors[player.attachIndex]) {
        var anchor = runtimeLevel.anchors[player.attachIndex];
        return { x1: mouth.x, y1: mouth.y, x2: anchor.x, y2: anchor.y };
      }
      if (tongueFx.mode === 'extend') {
        var progress = tongueFx.duration > 0 ? clamp(1 - tongueFx.timer / tongueFx.duration, 0, 1) : 1;
        return {
          x1: mouth.x,
          y1: mouth.y,
          x2: lerp(mouth.x, tongueFx.targetX, progress),
          y2: lerp(mouth.y, tongueFx.targetY, progress)
        };
      }
      return null;
    }
    function retractTongueFromCrow(crow) {
      pointerHeld = false;
      if (player.pressOpenTimer > 0) {
        player.pressOpenTimer = 0;
        player.pendingAttachIndex = null;
        player.pendingAimAngle = null;
        player.mouthOpen = 0;
      }
      if (player.attachIndex !== null || tongueFx.mode === 'extend') detachTongue();
      triggerHaptic('medium');
    }
    function hitPlayerByCrow(crow) {
      pointerHeld = false;
      if (player.attachIndex !== null || tongueFx.mode === 'extend') detachTongue();
      player.pressOpenTimer = 0;
      player.pendingAttachIndex = null;
      player.pendingAimAngle = null;
      player.mouthOpen = 0;
      player.skillInputLock = Math.max(Number(player.skillInputLock) || 0, CROW_TONGUE_DISABLE_SECONDS);
      player.crowBlinkDuration = CROW_BLINK_SECONDS;
      player.crowBlinkTimer = CROW_BLINK_SECONDS;
      player.crowHitCooldown = 0.82;
      var bodyLength = player.r * 2;
      player.x = clamp(player.x - bodyLength, player.r, Math.max(player.r, runtimeLevel.finish.x - player.r - 4));
      player.vx = -Math.max(120, Math.abs(player.vx) * 0.20);
      player.vy = Math.min(player.vy, -90);
      var crowDeducted = deductScore(CROW_COLLISION_PENALTY);
      runStats.stageCrowPenalty = Math.max(0, Math.round(Number(runStats.stageCrowPenalty) || 0)) + crowDeducted;
      markHit(-1, 0, 1.12);
      floatingTexts.push({
        x: player.x, y: player.y - 46, value: -CROW_COLLISION_PENALTY, label: '', age: 0, life: 1.15, negative: true,
        customText: '-' + CROW_COLLISION_PENALTY
      });
      for (var i = 0; i < 10; i++) spawnParticle(player.x, player.y, 0, false, i % 2 ? '#3d4350' : '#9ca7b9');
      triggerHaptic('heavy');
    }
    // 2026-10-09：小青吃乌鸦 —— 身体接触不受伤，直接把乌鸦吃掉，代价扣 50 分；
    // 乌鸦被吃时落下 3 片羽毛（随机方向、错落先后出现，各飘 2 秒再淡出 1 秒），
    // 同时在乌鸦位置闪一组放射线条 1 秒，表示乌鸦消失。
    function spawnCrowEatFeathers(crow) {
      var cx = Number(crow.x) || 0;
      var cy = Number(crow.y) || 0;
      for (var i = 0; i < 3; i++) {
        var ang = Math.random() * Math.PI * 2;           // 随机方向飘开（不固定左右）
        var speed = 16 + Math.random() * 22;
        var delay = i * 0.14;                            // 错落：三片先后出现
        featherFx.push({
          sprite: Math.random() < 0.5 ? 'A' : 'B',
          x: cx + (Math.random() - 0.5) * 18,
          y: cy + (Math.random() - 0.5) * 16,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 30,                // 任意方向 + 统一一点向上的初速
          delay: delay,                                 // 出现前的延迟（期间不画不动）
          swayPhase: Math.random() * Math.PI * 2,        // 左右摇摆相位
          swayFreq: 2.0 + Math.random() * 0.8,
          swayAmp: 20 + Math.random() * 10,              // 摇摆水平速度幅度 px/s
          rot0: (Math.random() - 0.5) * 1.2,             // 初始倾角
          rotFreq: 1.5 + Math.random() * 0.7,
          rotAmp: 0.42 + Math.random() * 0.24,           // 飘动中的倾角摆幅
          size: 24 + Math.random() * 8,                  // 素材缩小为一半（原 54/47 → 24~32）
          age: 0,
          life: FEATHER_LIFE_SECONDS
        });
      }
    }
    // 乌鸦消失特效：在乌鸦位置闪一组放射线条 1 秒（随机相位 + 高频闪烁 + 向外扩张）。
    function spawnCrowVanishFx(crow) {
      var rays = [];
      var rayCount = 8;
      var baseAng = Math.random() * Math.PI * 2;
      for (var i = 0; i < rayCount; i++) {
        rays.push({
          ang: baseAng + (i / rayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
          len: 16 + Math.random() * 20,                  // 每根线长短不一 → 错落感
          speed: 46 + Math.random() * 34                 // 向外扩张速度 px/s
        });
      }
      crowVanishFx.push({ x: Number(crow.x) || 0, y: Number(crow.y) || 0, rays: rays, age: 0, life: 1.0 });
    }
    function eatCrowByXiaoqing(crow) {
      var deducted = deductScore(CROW_EAT_PENALTY);
      runStats.stageCrowPenalty = Math.max(0, Math.round(Number(runStats.stageCrowPenalty) || 0)) + deducted;
      floatingTexts.push({
        x: player.x, y: player.y - 46, value: -CROW_EAT_PENALTY, label: '', age: 0, life: 1.15, negative: true,
        customText: '-' + CROW_EAT_PENALTY
      });
      spawnCrowEatFeathers(crow);
      spawnCrowVanishFx(crow);
      for (var i = 0; i < 6; i++) spawnParticle(crow.x, crow.y, 0, false, i % 2 ? '#2c313c' : '#4a5162');
      triggerHaptic('medium');
    }
    // 2026-10-05：乌鸦恢复正常行为，下列「受惊掉头」函数已移除：
    //   crowEnteredViewport / scareCrowAway（及 HANGZHOU_CROW_SCARE_RADIUS / SNAKE_MAID_FIRST_CROW_ENTER_INSET）。
    //   现在乌鸦正常飞入画面、正常撞人、可被舌头打。
    function updateCrows(dt) {
      if (!crowEnabledForCurrentStage()) {
        if (crows.length) crows = [];
        return;
      }
      crowSpawnTimer += dt;
      var maxActive = Math.min(4, 1 + Math.floor(Math.max(0, currentRoundNumber() - 2) / 2));
      if (crowSpawnTimer >= crowNextSpawn) {
        if (crows.length < maxActive) spawnCrow();
        crowSpawnTimer = 0;
        crowNextSpawn = crowSpawnDelay(false);
      }

      var tongue = activeTongueCollisionSegment();
      crowOnScreenThisFrame = false;
      for (var i = 0; i < crows.length; i++) {
        var crow = crows[i];
        crow.animTime += dt;
        crow.x += crow.vx * dt;
        // 2026-10-05：乌鸦恢复正常——不再受惊掉头，玩家需正常躲避或用舌头打乌鸦。
        maybeTriggerCrowWarning(crow);
        // 2026-09-29 用户澄清：预警效果持续到乌鸦飞离画面才消失——本帧记录是否有乌鸦在画面内。
        if (crowWarningState.timer > 0) {
          var crowCx = Number(crow.x);
          var crowOnScreen = Number(crow.vx || 0) < 0
            ? (crowCx < cameraX + VIEW_W + 6 && crowCx > cameraX - 40)   // 右侧飞来：在可视区内
            : (crowCx > cameraX - 6 && crowCx < cameraX + VIEW_W + 40);  // 左侧飞来：在可视区内
          if (crowOnScreen) crowOnScreenThisFrame = true;
        }
        // 2026-10-01：变蛇飞行 / 水漫金山上升途中，同样免疫乌鸦。
        if (isPotatoPhaseActive() || isFloodRising() || isSnakeFormActive()) continue;
        if (!crow.scared && !crow.hitTongue && tongue && segmentPointDistance(tongue.x1, tongue.y1, tongue.x2, tongue.y2, crow.x, crow.y) < crow.r + 7) {
          crow.hitTongue = true;
          retractTongueFromCrow(crow);
          tongue = null;
        }
        if (!crow.scared && !crow.hitPlayer && (Number(player.crowHitCooldown) || 0) <= 0 && dist(player.x, player.y, crow.x, crow.y) < player.r + crow.r) {
          crow.hitPlayer = true;
          if (isXiaoqingSkinActive()) {
            // 2026-10-09：小青身体碰乌鸦 = 吃掉（扣 50 分 + 3 片羽毛 + 消失闪光线条），不受伤不受击退。
            crow.eaten = true;
            eatCrowByXiaoqing(crow);
          } else {
            hitPlayerByCrow(crow);
          }
        }
      }
      updateFeatherFx(dt);
      updateCrowVanishFx(dt);
      var crowWrite = 0;
      var crowMinX = cameraX - 190;
      var crowMaxX = cameraX + VIEW_W + 320;
      for (var crowIndex = 0; crowIndex < crows.length; crowIndex++) {
        var activeCrow = crows[crowIndex];
        if (activeCrow.eaten) continue;   // 被小青吃掉的乌鸦直接移除
        if (activeCrow.x > crowMinX && activeCrow.x < crowMaxX) crows[crowWrite++] = activeCrow;
      }
      crows.length = crowWrite;
    }
    // 羽毛物理：随机方向飘开 → 缓慢下落，左右摇摆 + 倾角摆动；错落 = 每片带 delay 先后出现；
    // 寿命 = 2s 飘动 + 1s 淡出（淡出由渲染端按 age 画），delay 期间不计时不动。
    function updateFeatherFx(dt) {
      if (!featherFx.length) return;
      var w = 0;
      for (var i = 0; i < featherFx.length; i++) {
        var f = featherFx[i];
        if (f.delay > 0) { f.delay -= dt; featherFx[w++] = f; continue; }
        f.age += dt;
        if (f.age >= f.life) continue;
        f.vy = Math.min(f.vy + 110 * dt, 58);   // 重力小、终端速度低 → 羽飘感
        var swayVx = Math.sin(f.age * f.swayFreq + f.swayPhase) * f.swayAmp;
        f.x += (f.vx * 0.5 + swayVx) * dt;
        f.y += f.vy * dt;
        f.rot = f.rot0 + Math.sin(f.age * f.rotFreq + f.swayPhase) * f.rotAmp;
        featherFx[w++] = f;
      }
      featherFx.length = w;
    }
    // 乌鸦消失闪光线条：线条从乌鸦位置向外扩张 + 高频闪烁，1 秒后移除（渲染端按 age 画）。
    function updateCrowVanishFx(dt) {
      if (!crowVanishFx.length) return;
      var w = 0;
      for (var i = 0; i < crowVanishFx.length; i++) {
        var v = crowVanishFx[i];
        v.age += dt;
        if (v.age >= v.life) continue;
        v.r = 6 + (v.age / v.life) * 44;   // 扩张半径 6 → 50
        crowVanishFx[w++] = v;
      }
      crowVanishFx.length = w;
    }

    function startRun(resetSession) {
      if (resetSession === undefined) resetSession = true;
      clearReviveCheckpoint();
      ensureAudio();
      if (resetSession) runStats = createRunStats();
      resetSoulState(); resetGameOverState();
      runtimeLevel = clone(level);
      addRandomVeniceAnchors(runtimeLevel);
      applyStageFoodTheme(runtimeLevel);
      // 2026-10-09：杭州关改用编辑器固定地图（level_pack.json 的 L4：21 锚点/30 墙/9 弹床，
      // 由用户在关卡编辑器手工设计导出）——不再每局随机重排，randomizeHangzhouLayout 已停用。
      // 2026-10-10 修正：ensureSnakeMaidEggFood 必须放在 applyRoundStageRules 之后 ——
      //   round>1 时该函数会用 getStoredRoundLayout 的存档布局整体替换关卡（含 foods），
      //   先投的雄黄酒会被旧布局冲掉（实机复现：eggEnabled=true 但 foodKinds 无酒）。
      runtimeLevel = applyRoundStageRules(runtimeLevel) || runtimeLevel;
      ensureSnakeMaidEggFood(runtimeLevel);   // 蛇娘皮肤 → 全关卡随机位雄黄酒（2026-10-10）
      addGoldenSweetPotatoes(runtimeLevel);
      ensureFoodAssetsForLevel(runtimeLevel);
      rebuildRuntimeSpatialIndex();
      runtimeLevel.foods.forEach(function(f) { f.collected = false; });
      resetGoldenSkillForRun(resetSession);
      clearPortalState();
      resetTransientStageState();
      leaderboardOpen = false; leaderboardAutoReturnToMenu = false; leaderboardScrollY = 0; deathTimer = 0; deathLeaderboardShown = false;
      setScene('playing');
      maybeSpawnPortal(true);
      // 每日任务「完成 1 局」不再在开局记功（2026-10-09 用户反馈：没玩就白送 +1）——
      // 改为一局真正打完才记：最终阵亡见 soul_departure 分支、通关见 finish 分支的 creditDailyTask('play_run')。
    }
    function respawnAfterDeath() {
      ensureAudio();
      player = makePlayer(); cameraX = 0; cameraY = 0; cameraFollowInitialized = false; particles = []; floatingTexts = []; screenShake = 0; pointerHeld = false; deathTimer = 0; deathLeaderboardShown = false;
      tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
      runStats.combo = 0; runStats.multiplier = 1; runStats.comboTimer = 0;
      resetCrowState();
      setScene('playing');
    }
    function awardScore(points, label, x, y, alreadyRoundAdjusted) {
      points = Math.max(0, Math.round(Number(points) || 0));
      if (!alreadyRoundAdjusted) points = applyRoundScoreBonus(points);
      if (!points) return 0;
      runStats.score += points;
      progress.totalScore = Math.max(0, Math.round(Number(progress.totalScore) || 0)) + points;
      refreshScoreUnlocks(false);
      if (x !== undefined && y !== undefined) floatingTexts.push({ x: x, y: y, value: points, label: label || '', age: 0, life: 2.5 });
      return points;
    }
    function deductScore(points) {
      points = Math.max(0, Math.round(Number(points) || 0));
      if (!points) return 0;
      var before = Math.max(0, Math.round(Number(progress.totalScore) || 0));
      var deducted = Math.min(points, before);
      if (!deducted) return 0;
      progress.totalScore = before - deducted;
      runStats.score = Math.max(0, Math.round(Number(runStats.score) || 0) - deducted);
      // 扣分不会重新锁住已经开放的关卡，但会影响本轮后续尚未达到的解锁门槛。
      refreshScoreUnlocks(false);
      return deducted;
    }
    function submitRunToLeaderboard(reason) {
      console.log('[排行榜] submitRunToLeaderboard 被调用，playerProfile.city=' + (playerProfile.city || '(空)') + ' scoreValid=' + runStats.scoreValid + ' score=' + runStats.score);
      if (runStats.submitted) return runStats.rank || 0;
      runStats.submitted = true;
      if (!runStats.scoreValid) {
        // 玩家放弃广告复活：本局分数不计入累计分、最佳分和排行榜
        progress.totalScore = Math.max(0, (Number(progress.totalScore) || 0) - Math.max(0, Math.round(Number(runStats.score) || 0)));
        saveProgress();
        return 0;
      }
      progress.bestScore = Math.max(Number(progress.bestScore) || 0, runStats.score);
      progress.runs = Math.max(0, Math.round(Number(progress.runs) || 0)) + 1;
      saveProgress();
      if (openDataLeaderboard && openDataLeaderboard.submitHighestScore) {
        try { openDataLeaderboard.submitHighestScore(progress.bestScore); } catch (ignoreOpenData) {}
      }

      var now = nowMs();
      var candidateScore = Math.max(0, Math.round(Number(progress.totalScore) || 0));
      var entry = null;
      for (var i = 0; i < leaderboard.length; i++) {
        if (leaderboard[i] && leaderboard[i].playerId === playerProfile.playerId) {
          entry = leaderboard[i]; break;
        }
      }

      var qualifiesLocally = true;
      sortLeaderboard(leaderboard);
      if (!entry && leaderboard.length >= LEADERBOARD_LIMIT) {
        var cutoff = leaderboard[LEADERBOARD_LIMIT - 1];
        var cutoffScore = cutoff ? Math.max(0, Math.round(Number(cutoff.score) || 0)) : 0;
        qualifiesLocally = candidateScore > cutoffScore;
      }

      if (entry || qualifiesLocally || leaderboard.length < LEADERBOARD_LIMIT) {
        if (!entry) {
          entry = { id: 'local_' + playerProfile.playerId, playerId: playerProfile.playerId, createdAt: now };
          leaderboard.push(entry);
        }
        entry.nickName = playerProfile.nickName;
        entry.avatarUrl = playerProfile.avatarUrl;
        entry.city = playerProfile.city || '';
        entry.score = candidateScore;
        entry.bestScore = Math.max(0, Math.round(Number(progress.bestScore) || 0));
        entry.food = Math.max(0, Math.round(Number(progress.totalFood) || 0));
        entry.stages = Math.max(Number(entry.stages) || 0, runStats.stages);
        entry.deaths = runStats.deaths;
        entry.updatedAt = now;
        entry.isCurrent = true;
        sortLeaderboard(leaderboard);
        leaderboard = leaderboard.slice(0, LEADERBOARD_LIMIT);
        leaderboardDataVersion++;
      }

      var rank = 0;
      for (var r = 0; r < leaderboard.length; r++) {
        if (leaderboard[r] && leaderboard[r].playerId === playerProfile.playerId) { rank = r + 1; break; }
      }
      runStats.rank = rank;
      lastSubmittedRank = rank;
      saveLeaderboard();

      submitLeaderboardToCloud(entry || { id: '', playerId: playerProfile.playerId }, reason);
      return rank;
    }

    function isGameplayScene(value) {
      return value === 'playing' || value === 'paused' || value === 'death' || value === 'game_over' || value === 'finish_slowmo' || value === 'score_tally' || value === 'next_level';
    }
    function editorVisibleWorldWidth() { return EDITOR_VIEWPORT.w / Math.max(0.001, editorState.zoom); }
    function editorVisibleWorldHeight() { return EDITOR_VIEWPORT.h / Math.max(0.001, editorState.zoom); }
    function editorMapOffset() {
      return {
        x: Math.max(0, (EDITOR_VIEWPORT.w - runtimeLevel.width * editorState.zoom) * 0.5),
        y: Math.max(0, (EDITOR_VIEWPORT.h - runtimeLevel.height * editorState.zoom) * 0.5)
      };
    }
    function clampEditorCamera() {
      cameraX = clamp(cameraX, 0, Math.max(0, runtimeLevel.width - editorVisibleWorldWidth()));
      editorState.cameraY = clamp(editorState.cameraY, 0, Math.max(0, runtimeLevel.height - editorVisibleWorldHeight()));
    }
    function updateEditorZoomBounds() {
      var fit = Math.min(EDITOR_VIEWPORT.w / Math.max(1, runtimeLevel.width), EDITOR_VIEWPORT.h / Math.max(1, runtimeLevel.height));
      editorState.minZoom = clamp(fit, 0.025, 1);
      editorState.maxZoom = Math.max(EDITOR_MAX_ZOOM, editorState.minZoom);
      editorState.zoom = clamp(editorState.zoom, editorState.minZoom, editorState.maxZoom);
      clampEditorCamera();
    }
    function editorScreenToWorld(px, py) {
      var off = editorMapOffset();
      return {
        x: cameraX + (px - EDITOR_VIEWPORT.x - off.x) / editorState.zoom,
        y: editorState.cameraY + (py - EDITOR_VIEWPORT.y - off.y) / editorState.zoom
      };
    }
    function pointInEditorViewport(px, py) {
      return px >= EDITOR_VIEWPORT.x && px <= EDITOR_VIEWPORT.x + EDITOR_VIEWPORT.w && py >= EDITOR_VIEWPORT.y && py <= EDITOR_VIEWPORT.y + EDITOR_VIEWPORT.h;
    }
    function setEditorZoom(nextZoom, px, py) {
      if (scene !== 'editor') return;
      if (px === undefined) px = EDITOR_VIEWPORT.x + EDITOR_VIEWPORT.w * 0.5;
      if (py === undefined) py = EDITOR_VIEWPORT.y + EDITOR_VIEWPORT.h * 0.5;
      var before = editorScreenToWorld(px, py);
      editorState.zoom = clamp(nextZoom, editorState.minZoom, editorState.maxZoom);
      var off = editorMapOffset();
      cameraX = before.x - (px - EDITOR_VIEWPORT.x - off.x) / editorState.zoom;
      editorState.cameraY = before.y - (py - EDITOR_VIEWPORT.y - off.y) / editorState.zoom;
      clampEditorCamera();
    }
    function zoomEditorBy(factor, px, py) { setEditorZoom(editorState.zoom * factor, px, py); }
    function fitEditorMap() {
      editorState.zoom = editorState.minZoom;
      cameraX = 0; editorState.cameraY = 0;
      clampEditorCamera();
    }
    function editorAdjustTotalScore(delta, reset) {
      if (scene !== 'editor') return;
      if (reset) {
        progress.totalScore = 0;
        resetRoundUnlockProgress(progress, currentRoundNumber(), 0);
        progress.gateTutorialSeen = false;
        progress.unlockSystemVersion = UNLOCK_SYSTEM_VERSION;
      } else {
        progress.totalScore = Math.max(0, Math.round(Number(progress.totalScore) || 0) + Math.round(Number(delta) || 0));
        refreshScoreUnlocks(true);
      }
      if (clampStageIndex(progress.currentStage) > progress.unlockedStage) progress.currentStage = MAIN_STAGE_START;
      saveProgress();
      showToastMessage(reset ? '永久累计分数已归零' : ('永久累计 ' + progress.totalScore + ' 分'));
      triggerHaptic('light');
      playUiClickSound();
    }
    function editorResetRound() {
      if (scene !== 'editor') return;
      progress.round = 1;
      progress.pendingRoundTarget = 0;
      progress.roundUnlockBaseScore = 0;
      progress.roundUnlockRound = 1;
      progress.unlockSystemVersion = UNLOCK_SYSTEM_VERSION;
      refreshScoreUnlocks(true);
      saveProgress();
      showToastMessage('轮次已回到第1轮 · 计分无加成');
      triggerHaptic('medium');
      playUiClickSound();
    }
    function normalizeEditorJumpStage(value) {
      var n = Number(value);
      if (!isFinite(n)) n = Math.max(MAIN_STAGE_START, clampStageIndex(stageIndex));
      return Math.max(MAIN_STAGE_START, Math.min(STAGES.length - 1, Math.round(n)));
    }
    function adjustEditorJumpStage(delta) {
      var count = Math.max(1, STAGES.length - MAIN_STAGE_START);
      var current = normalizeEditorJumpStage(editorState.jumpStage);
      var formalOffset = current - MAIN_STAGE_START;
      var direction = Number(delta) < 0 ? -1 : 1;
      var nextOffset = (formalOffset + direction + count) % count;
      var next = normalizeEditorJumpStage(MAIN_STAGE_START + nextOffset);
      editorState.jumpStage = next;
      triggerHaptic('light');
      playUiClickSound();
      showToastMessage('目标：第' + (nextOffset + 1) + '关', 0.9);
      return next;
    }
    function jumpEditorToSelectedStage() {
      if (scene !== 'editor') return false;
      var target = normalizeEditorJumpStage(editorState.jumpStage);
      saveLevel(runtimeLevel);
      editorState.dirty = false;
      if (editorState.fileDialog) editorState.fileDialog.open = false;
      editorState.returnScene = 'menu';
      editorState.playerSnapshot = null;
      editorState.collectedById = {};
      editorState.cameraSnapshot = 0;
      loadStage(target);
      startRun(true);
      showToastMessage('已跳到第' + (target - MAIN_STAGE_START + 1) + '关');
      return true;
    }

    function enterEditor() {
      if (scene === 'loading' || scene === 'editor') return;
      editorButtonVisible = false;
      resetEditorSecretTap();
      var fromScene = scene;
      pointerHeld = false;
      if (player && (player.attachIndex !== null || tongueFx.mode !== 'none')) detachTongue();
      stopSpinLoop();
      editorState.returnScene = fromScene;
      editorState.selected = null; editorState.drag = null; editorState.dirty = false;
      editorState.mapTab = null;   // 普通(非现场)编辑器：不显示 甲/乙/丙 切换标签页
      if (editorState.fileDialog) editorState.fileDialog.open = false;
      editorState.cameraSnapshot = cameraX;
      editorState.playerSnapshot = player ? clone(player) : null;
      editorState.collectedById = {};
      editorState.cameraY = 0;
      editorState.jumpStage = normalizeEditorJumpStage(stageIndex);
      runtimeLevel = clone(level);
      rebuildRuntimeSpatialIndex();
      runtimeLevel.foods.forEach(function(f) { f.collected = false; });
      tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
      player = makePlayer();
      editorState.zoom = 0.72;
      updateEditorZoomBounds();
      cameraX = isGameplayScene(fromScene) ? editorState.cameraSnapshot : 0;
      editorState.cameraY = 0;
      clampEditorCamera();
      particles = []; floatingTexts = []; screenShake = 0;
      setScene('editor');
    }
    function openPortalPreview() {
      var info = stageDisplayInfo(stageIndex);
      portalPreviewState.timer = 0;
      portalPreviewState.targetStage = stageIndex;
      portalPreviewState.formalNumber = Math.max(1, Number(info.formalNumber) || 1);
      portalPreviewState.title = String(info.title || '穿越效果测试');
      portalPreviewState.titleEn = String(info.titleEn || 'PORTAL EFFECT PREVIEW');
      portalPreviewState.travelDuration = Math.max(2, Number(portalEffectConfig.previewDuration) || 6);
      portalPreviewState.whiteDuration = Math.max(0.2, Number(portalEffectConfig.previewWhiteDuration) || 1);
      portalPreviewState.paused = false;
      portalPreviewState.speed = 1;
      portalPreviewState.renderMode = portalEffectConfig.mode || 'auto';
      portalPreviewState.lastMode = 'none';
      portalPreviewState.lastError = '';
      portalPreviewState.returnScene = scene === 'editor' ? 'editor' : 'menu';
      setScene('portal_preview');
    }
    function closePortalPreview() {
      setScene(portalPreviewState.returnScene || 'editor');
    }
    function cyclePortalPreviewSpeed() {
      var values = [0.25, 0.5, 1, 1.5, 2];
      var current = Number(portalPreviewState.speed) || 1;
      var index = values.indexOf(current);
      portalPreviewState.speed = values[(index + 1 + values.length) % values.length];
    }
    function cyclePortalPreviewMode() {
      var values = ['auto', 'webgl', 'canvas'];
      var index = values.indexOf(String(portalPreviewState.renderMode || 'auto'));
      portalPreviewState.renderMode = values[(index + 1 + values.length) % values.length];
      portalPreviewState.timer = 0;
      if (portalEffect && portalEffect.reset) portalEffect.reset();
    }

    function saveAndExitEditor() {
      if (scene !== 'editor') return;
      if (editorState.fileDialog) editorState.fileDialog.open = false;
      // [地图编辑器] 现场地图编辑：写回现场地图池（localStorage）后回到干净的门禁态
      if (kioskEditorTargetIndex !== null && kioskEditorTargetIndex >= 0) {
        // [v37 用户需求] 保存瞬间（用户手势内）弹出系统存档对话框另存三张地图 JSON，默认定位到桌面。
        //   对话框是异步的、不阻塞保存流程；localStorage 落盘照旧（取消对话框也不影响本机保存）。
        try { if (typeof window !== 'undefined' && window.__kioskMapsSaveDialog) window.__kioskMapsSaveDialog('save-btn'); } catch (eSD) {}
        try {
          var kr = kioskLoadMaps();
          kr.maps[kioskEditorTargetIndex % kr.maps.length] = clone(runtimeLevel);
          // [v37] 统一走 kioskMapsSet 写 {maps, savedAt} —— 原先写纯数组没有 savedAt，
          //   发布包种子「谁新用谁」会拿旧种子覆盖现场刚编辑的地图。
          var setR = (typeof window !== 'undefined' && window.__kioskMapsSet) ? window.__kioskMapsSet({ maps: kr.maps }) : { ok: false, reason: 'no_bridge' };
          if (!setR || !setR.ok) throw new Error(setR && setR.reason || '写入失败');
          showToastMessage('现场地图【' + ['甲', '乙', '丙'][kioskEditorTargetIndex % 3] + '】已保存');
        } catch (e) { showToastMessage('保存失败：' + (e && e.message || e)); }
        kioskEditorTargetIndex = null;
        editorState.mapTab = null;   // 退出编辑器 → 收起 甲/乙/丙 切换标签页
        try { if (typeof window !== 'undefined') window.__kioskEditorMode = false; } catch (e3) {}
        // [2026-10-12] 保存后不再 location.reload()：避免「一按保存就退回二维码门禁页」的错觉。
        // 现场地图已真实落入 localStorage（wx.setStorageSync），下一轮 kioskLoadMaps 会读回，
        // 会话保持有效，不会因「二维码验证时间」而把人踢出门禁页。
        setScene('menu');
        return;
      }
      var returnScene = editorState.returnScene || 'menu';
      var savedPlayer = editorState.playerSnapshot;
      var collectedById = editorState.collectedById || {};
      saveLevel(runtimeLevel);
      var editorSaveResult = exportLevelData(level);
      if (editorSaveResult.writeOk) showToastMessage('地图已保存并通过验证');
      else { editorState.dirty = true; showToastMessage('地图仅保存在当前运行，文件写入失败'); }
      runtimeLevel = clone(level);
      addRandomVeniceAnchors(runtimeLevel);
      applyStageFoodTheme(runtimeLevel);
      addGoldenSweetPotatoes(runtimeLevel);
      rebuildRuntimeSpatialIndex();
      runtimeLevel.foods.forEach(function(f) { f.collected = !!collectedById[f.id]; });
      if (isGameplayScene(returnScene) && savedPlayer) {
        player = savedPlayer;
        if (player.attachIndex !== null && !runtimeLevel.anchors[player.attachIndex]) player.attachIndex = null;
        cameraX = clamp(editorState.cameraSnapshot, 0, Math.max(0, runtimeLevel.width - VIEW_W));
        cameraFollowInitialized = false;
        setScene(returnScene);
        clearPortalState();
        if (returnScene === 'playing') maybeSpawnPortal(true);
      } else {
        player = null;
        cameraX = 0;
        cameraFollowInitialized = false;
        setScene(returnScene === 'menu' ? 'menu' : 'menu');
      }
      editorState.selected = null; editorState.drag = null; editorState.dirty = !editorSaveResult.writeOk;
      editorState.mapTab = null;
      suppressNextRelease = true;
    }
    function getEditorObject(selection) {
      if (!selection || !runtimeLevel) return null;
      if (selection.kind === 'start') return runtimeLevel.start;
      if (selection.kind === 'finish') return runtimeLevel.finish;
      var list = selection.kind === 'anchor' ? runtimeLevel.anchors
        : selection.kind === 'food' ? runtimeLevel.foods
        : selection.kind === 'bumper' ? runtimeLevel.bumpers
        : selection.kind === 'wall' ? runtimeLevel.walls : null;
      return list && list[selection.index] ? list[selection.index] : null;
    }
    function nextEditorId(prefix, list) {
      var max = 0;
      (list || []).forEach(function(item) {
        var m = String(item.id || '').match(new RegExp('^' + prefix + '(\\d+)$'));
        if (m) max = Math.max(max, Number(m[1]) || 0);
      });
      return prefix + (max + 1);
    }
    function editorInsertPoint() {
      return {
        x: clamp(cameraX + editorVisibleWorldWidth() * 0.5, 70, runtimeLevel.width - 70),
        y: clamp(editorState.cameraY + editorVisibleWorldHeight() * 0.5, 130, runtimeLevel.height - 70)
      };
    }
    function addEditorItem(kind) {
      if (scene !== 'editor') return;
      var addNow = nowMs();
      if (editorAddGuard.kind === kind && addNow - editorAddGuard.at < EDITOR_ADD_DEDUP_MS) return;
      editorAddGuard.kind = kind;
      editorAddGuard.at = addNow;
      var p = editorInsertPoint(), item, selection;
      if (kind === 'anchor') {
        item = { id: nextEditorId('a', runtimeLevel.anchors), x: Math.round(p.x), y: Math.round(p.y) };
        runtimeLevel.anchors.push(item); selection = { kind: 'anchor', index: runtimeLevel.anchors.length - 1 };
      } else if (kind === 'food') {
        item = { id: nextEditorId('f', runtimeLevel.foods), x: Math.round(p.x), y: Math.round(p.y), kind: themedFoodPickForEditor(runtimeLevel), points: NORMAL_FOOD_POINTS };
        runtimeLevel.foods.push(item); selection = { kind: 'food', index: runtimeLevel.foods.length - 1 };
      } else if (kind === 'bumper' || kind === 'hazard') {
        item = { id: nextEditorId('b', runtimeLevel.bumpers), x: Math.round(p.x), y: Math.round(p.y), r: kind === 'hazard' ? 32 : 40, power: kind === 'hazard' ? 1 : 1.44, hazard: kind === 'hazard' };
        runtimeLevel.bumpers.push(item); selection = { kind: 'bumper', index: runtimeLevel.bumpers.length - 1 };
      } else if (kind === 'wallH' || kind === 'wallV' || kind === 'stumpH' || kind === 'stumpV' || kind === 'wall' || kind === 'springH' || kind === 'springV' || kind === 'powerSpringH' || kind === 'oneShotSpringV' || kind === 'oneShotSpringH') {
        var vertical = kind === 'springV' || kind === 'oneShotSpringV' || kind === 'wallV' || kind === 'stumpV';
        var isPower = kind === 'powerSpringH';
        var isOneShot = kind === 'oneShotSpringV' || kind === 'oneShotSpringH';
        var isSpring = kind === 'springH' || kind === 'springV' || kind === 'powerSpringH' || kind === 'oneShotSpringV' || kind === 'oneShotSpringH';
        var isStump = kind === 'stumpH' || kind === 'stumpV';
        var w, h;
        if (vertical) { w = isSpring ? 30 : 34; h = isSpring ? (isOneShot ? 210 : 190) : 150; }
        else if (kind === 'oneShotSpringH') { w = 150; h = 34; } // 与横树桩同尺寸
        else { w = isSpring ? (isPower ? 220 : 190) : 150; h = isSpring ? 28 : 34; }
        item = {
          id: nextEditorId('w', runtimeLevel.walls),
          x: Math.round(clamp(p.x - w * 0.5, 0, runtimeLevel.width - w)),
          y: Math.round(clamp(p.y - h * 0.5, 86, runtimeLevel.height - h)),
          w: w, h: h,
          bounce: isSpring ? (isOneShot ? 1.72 : (isPower ? 1.52 : 1.24)) : (isStump ? (vertical ? STUMP_BOUNCE : HORIZONTAL_STUMP_BOUNCE) : WALL_BOUNCE),
          spring: isSpring,
          axis: vertical ? 'vertical' : 'horizontal',
          powerSpring: isPower,
          powerMultiplier: isPower ? POWER_SPRING_MULTIPLIER : 1,
          oneShot: isOneShot,
          springType: isPower ? 'power' : (isOneShot ? 'oneShot' : ''),
          material: isStump ? 'stump' : 'wall'
        };
        runtimeLevel.walls.push(item); selection = { kind: 'wall', index: runtimeLevel.walls.length - 1 };
      }
      if (selection) { editorState.selected = selection; editorState.dirty = true; }
    }
    function canDeleteEditorSelection(selection) {
      if (!selection || selection.kind === 'start' || selection.kind === 'finish') return false;
      var obj = getEditorObject(selection);
      return !!obj;
    }
    function deleteEditorSelection() {
      var selection = editorState.selected;
      if (!canDeleteEditorSelection(selection)) return false;
      var list = selection.kind === 'anchor' ? runtimeLevel.anchors
        : selection.kind === 'food' ? runtimeLevel.foods
        : selection.kind === 'bumper' ? runtimeLevel.bumpers
        : selection.kind === 'wall' ? runtimeLevel.walls : null;
      if (!list || !list[selection.index]) return false;
      list.splice(selection.index, 1);
      editorState.selected = null; editorState.drag = null; editorState.dirty = true;
      return true;
    }
    function editorObjectCenter(selection, obj) {
      if (selection.kind === 'wall') return { x: obj.x + obj.w * 0.5, y: obj.y + obj.h * 0.5 };
      if (selection.kind === 'finish') return { x: obj.x, y: VIEW_H * 0.5 };
      return { x: obj.x, y: obj.y };
    }
    function editorHitTest(worldX, worldY) {
      var candidates = [];
      var pad = clamp(12 / Math.max(0.05, editorState.zoom), 12, 92);
      function add(kind, index, score) { candidates.push({ kind: kind, index: index, score: score }); }
      var dStart = dist(worldX, worldY, runtimeLevel.start.x, runtimeLevel.start.y);
      if (dStart <= 30 + pad) add('start', 0, dStart - 30);
      var dFinish = Math.abs(worldX - runtimeLevel.finish.x);
      if (dFinish <= pad + 12) add('finish', 0, dFinish + 12);
      runtimeLevel.anchors.forEach(function(o, i) { var d = dist(worldX, worldY, o.x, o.y); if (d <= 18 + pad) add('anchor', i, d); });
      runtimeLevel.foods.forEach(function(o, i) { var d = dist(worldX, worldY, o.x, o.y); if (d <= 32 + pad) add('food', i, d + 2); });
      runtimeLevel.bumpers.forEach(function(o, i) { var d = dist(worldX, worldY, o.x, o.y); if (d <= o.r + pad) add('bumper', i, Math.max(0, d - o.r)); });
      runtimeLevel.walls.forEach(function(o, i) {
        if (worldX >= o.x - pad && worldX <= o.x + o.w + pad && worldY >= o.y - pad && worldY <= o.y + o.h + pad) {
          var cx = o.x + o.w * 0.5, cy = o.y + o.h * 0.5;
          add('wall', i, Math.hypot(worldX - cx, worldY - cy) * 0.05 + 5);
        }
      });
      if (!candidates.length) return null;
      candidates.sort(function(a, b) { return a.score - b.score; });
      return { kind: candidates[0].kind, index: candidates[0].index };
    }
    function beginEditorDrag(px, py) {
      if (!pointInEditorViewport(px, py)) return;
      var world = editorScreenToWorld(px, py);
      var selection = editorHitTest(world.x, world.y);
      if (!selection) {
        editorState.selected = null;
        editorState.drag = { mode: 'pan', startPx: px, startPy: py, startCameraX: cameraX, startCameraY: editorState.cameraY };
        return;
      }
      var obj = getEditorObject(selection), center = editorObjectCenter(selection, obj);
      editorState.selected = selection;
      editorState.drag = { mode: 'item', selection: selection, offsetX: world.x - center.x, offsetY: world.y - center.y };
    }
    function updateEditorDrag(px, py) {
      var drag = editorState.drag;
      if (!drag || scene !== 'editor') return;
      if (drag.mode === 'pan') {
        cameraX = drag.startCameraX - (px - drag.startPx) / editorState.zoom;
        editorState.cameraY = drag.startCameraY - (py - drag.startPy) / editorState.zoom;
        clampEditorCamera();
        return;
      }
      var selection = drag.selection, obj = getEditorObject(selection);
      if (!obj) return;
      var world = editorScreenToWorld(px, py);
      var worldX = world.x - drag.offsetX;
      var worldY = world.y - drag.offsetY;
      if (selection.kind === 'wall' || selection.kind === 'wind') {
        obj.x = Math.round(clamp(worldX - obj.w * 0.5, 0, Math.max(0, runtimeLevel.width - obj.w)));
        obj.y = Math.round(clamp(worldY - obj.h * 0.5, 86, Math.max(86, runtimeLevel.height - obj.h)));
      } else if (selection.kind === 'finish') {
        obj.x = Math.round(clamp(worldX, 400, runtimeLevel.width - 90));
      } else {
        var radius = selection.kind === 'bumper' ? obj.r : 26;
        obj.x = Math.round(clamp(worldX, radius, runtimeLevel.width - radius));
        obj.y = Math.round(clamp(worldY, 86 + radius, runtimeLevel.height - radius));
        if (selection.kind === 'start' && player) { player.x = obj.x; player.y = obj.y; }
      }
      editorState.dirty = true;
      rebuildRuntimeSpatialIndex();
    }
    function endEditorDrag() { editorState.drag = null; }

    function restartTutorialImmediately() {
      ensureAudio();
      runtimeLevel = clone(level);
      rebuildRuntimeSpatialIndex();
      runtimeLevel.foods.forEach(function(f) { f.collected = false; });
      resetGoldenSkillForRun(false);
      resetTransientStageState();
      setScene('playing');
    }

    function goldenSkillMenuOrigin(trigger) {
      var playerScreenX = player ? player.x - cameraX : VIEW_W * 0.5;
      var playerScreenY = player ? player.y - cameraY : VIEW_H * 0.78;
      var targetX = clamp(playerScreenX, 66, VIEW_W - 66);
      var targetY = clamp(playerScreenY, 300, VIEW_H - 74);
      var dockDistance = clamp(targetY - 156, 116, GOLDEN_SKILL_MAX_PULL);
      return {
        x: targetX,
        y: targetY - dockDistance,
        targetX: targetX,
        targetY: targetY,
        dockDistance: dockDistance
      };
    }

    // 线下大屏“单键放屁”：进入界面即满蓄力，持续左右钟摆，按一次空格发射。
    // 对普通手机网页和正式微信小游戏无影响（只有大屏且三侠闯关中才启用）。
    function kioskAutoGoldenSkillEnabled() {
      try { return typeof window !== 'undefined' && window.__kioskBigScreen === true && kioskRun.active === true; }
      catch (e) { return false; }
    }
    function kioskPrimeGoldenSkill() {
      if (!kioskAutoGoldenSkillEnabled() || !goldenSkillState.menuActive || goldenSkillState.points <= 0) return;
      goldenSkillState.kioskAutoSwing = true;
      goldenSkillState.kioskSwingTime = 0;
      goldenSkillState.phase = 'aiming';
      goldenSkillState.dockProgress = 1;
      goldenSkillState.pullDistance = GOLDEN_SKILL_MAX_PULL;
      goldenSkillState.power = 1;
      goldenSkillState.armed = true;
      goldenSkillState.selected = 'launch';
      goldenSkillState.gestureActive = false;
      goldenSkillState.countdownLocked = true; // 等玩家按键，不自动取消
      goldenSkillState.aimAngle = 0;
      goldenSkillState.kioskRescueDeadline = nowMs() + KIOSK_RESCUE_TIMEOUT_MS;
      goldenSkillState.kioskRescueRemain = KIOSK_RESCUE_TIMEOUT_MS / 1000;
    }
    function showGoldenSkillMenu(trigger, cause, anchorIndex, forceTutorial) {
      if (!player || (isTutorialStage() && !forceTutorial)) return false;
      if (trigger === 'death') centerCameraOnPlayer(1.0, true);
      var origin = goldenSkillMenuOrigin(trigger);
      goldenSkillState.menuActive = true;
      goldenSkillState.trigger = trigger || 'death';
      goldenSkillState.deathCause = cause || '';
      goldenSkillState.anchorIndex = typeof anchorIndex === 'number' ? anchorIndex : null;
      goldenSkillState.originX = origin.x;
      goldenSkillState.originY = origin.y;
      goldenSkillState.targetX = origin.targetX;
      goldenSkillState.targetY = origin.targetY;
      goldenSkillState.dockDistance = origin.dockDistance;
      goldenSkillState.selected = null;
      goldenSkillState.gestureActive = false;
      goldenSkillState.phase = 'ready';
      goldenSkillState.aimAngle = 0;
      goldenSkillState.pullDistance = 0;
      goldenSkillState.power = 0;
      goldenSkillState.armed = false;
      goldenSkillState.timer = forceTutorial ? 999 : GOLDEN_SKILL_CHOICE_SECONDS;
      goldenSkillState.countdownLocked = !!forceTutorial;
      goldenSkillState.adBusy = false;
      goldenSkillState.uiOffsetX = 0;
      goldenSkillState.uiOffsetY = 0;
      goldenSkillState.gestureStartX = 0;
      goldenSkillState.gestureStartY = 0;
      goldenSkillState.dockProgress = 0;
      goldenSkillState.aimStartX = 0;
      goldenSkillState.aimStartY = 0;
      goldenSkillState.aimDragX = 0;
      goldenSkillState.kioskAutoSwing = false;
      goldenSkillState.kioskRescueDeadline = 0;
      goldenSkillState.kioskRescueRemain = 0;
      setScene('golden_skill');
      kioskPrimeGoldenSkill();
      return true;
    }

    function finishGoldenSkillMenu() {
      goldenSkillState.menuActive = false;
      goldenSkillState.selected = null;
      goldenSkillState.gestureActive = false;
      goldenSkillState.phase = 'ready';
      goldenSkillState.aimAngle = 0;
      goldenSkillState.pullDistance = 0;
      goldenSkillState.power = 0;
      goldenSkillState.armed = false;
      goldenSkillState.timer = 0;
      goldenSkillState.countdownLocked = false;
      goldenSkillState.adBusy = false;
      goldenSkillState.uiOffsetX = 0;
      goldenSkillState.uiOffsetY = 0;
      goldenSkillState.gestureStartX = 0;
      goldenSkillState.gestureStartY = 0;
      goldenSkillState.dockProgress = 0;
      goldenSkillState.aimStartX = 0;
      goldenSkillState.aimStartY = 0;
      goldenSkillState.aimDragX = 0;
      goldenSkillState.kioskAutoSwing = false;
      goldenSkillState.kioskSwingTime = 0;
      goldenSkillState.kioskRescueDeadline = 0;
      goldenSkillState.kioskRescueRemain = 0;
    }

    function applyGoldenSkill(angle, power) {
      if (!player || goldenSkillState.points <= 0) return false;
      releaseShareResumeGuard();
      angle = clamp(Number(angle) || 0, -GOLDEN_SKILL_MAX_ANGLE, GOLDEN_SKILL_MAX_ANGLE);
      power = clamp(Number(power) || 0, 0, 1);
      var direction = angle < -0.01 ? -1 : (angle > 0.01 ? 1 : (player.faceDir < 0 ? -1 : 1));
      var launchSpeed = GOLDEN_SKILL_MIN_SPEED + (GOLDEN_SKILL_MAX_SPEED - GOLDEN_SKILL_MIN_SPEED) * power;
      var launchX = Math.sin(angle);
      var launchY = -Math.cos(angle);

      goldenSkillState.points = Math.max(0, goldenSkillState.points - 1);
      if (kioskRun.active) kioskRun.potatoes = goldenSkillState.points;   // 现场番薯池与技能点同步
      pointerHeld = false;
      detachTongue();
      player.y = Math.min(player.y, runtimeLevel.height - player.r - 8);
      player.vx = launchX * launchSpeed;
      player.vy = launchY * launchSpeed;
      player.faceDir = direction;
      player.skillInputLock = GOLDEN_SKILL_INPUT_LOCK_SECONDS;
      player.fartTimer = GOLDEN_SKILL_BOOST_DURATION + 0.18;
      player.fartSpawnTimer = 0;
      player.fartDirection = direction;
      player.fartBoostTimer = GOLDEN_SKILL_BOOST_DURATION;
      player.fartBoostDuration = GOLDEN_SKILL_BOOST_DURATION;
      player.fartBoostAngle = angle;
      player.fartBoostPower = power;
      player.verticalTongueTimer = 0;
      finishGoldenSkillMenu();
      releaseDeathCameraLock();
      centerCameraOnPlayer(0.55, false);
      setScene('playing');

      var exhaustX = -launchX;
      var exhaustY = -launchY;
      var boostBurstCount = lowDevice ? 10 : (balancedDevice ? 14 : 18);
      for (var i = 0; i < boostBurstCount && particles.length < PARTICLE_LIMIT; i++) {
        var color = i % 3 === 0 ? '#d6b05c' : (i % 2 === 0 ? '#9fd36b' : '#dce69a');
        particles.push({
          x: player.x + exhaustX * (player.r * 0.55 + Math.random() * 14),
          y: player.y + exhaustY * (player.r * 0.55 + Math.random() * 14),
          vx: exhaustX * (85 + Math.random() * 180) + (Math.random() - 0.5) * 45,
          vy: exhaustY * (85 + Math.random() * 180) + (Math.random() - 0.5) * 45,
          age: 0, life: 0.42 + Math.random() * 0.34,
          r: 4 + Math.random() * 8, confetti: false, color: color, rot: 0
        });
      }
      floatingTexts.push({
        x: player.x, y: player.y - 46, value: 0, label: '放屁弹射！', age: 0, life: 0.9,
        customText: direction < 0 ? '↖ 放屁弹射' : (direction > 0 ? '放屁弹射 ↗' : '↑ 放屁弹射')
      });
      playFartSound();
      triggerHaptic('heavy');

      runStats.score = Math.max(0, runStats.score - FART_SKILL_PENALTY);
      progress.totalScore = Math.max(0, Math.round(Number(progress.totalScore) || 0) - FART_SKILL_PENALTY);
      runStats.stageFartPenalty += FART_SKILL_PENALTY;
      saveProgress();
      if (isTutorialStage()) {
        var isLifeLaunch = tutorialTaskIs('life') && tutorialFlow.lifeLost;
        var isRescueOnlyLaunch = tutorialTaskIs('rescue_only');
        var isRescueManualLaunch = tutorialTaskIs('rescue_manual') && tutorialFlow.rescuePulled && tutorialFlow.rescueAimed;
        if (isLifeLaunch || isRescueOnlyLaunch || isRescueManualLaunch) {
          tutorialFlow.lifeRescuePhase = 'launched';
          completeTutorialTask('golden_rescue_launched', { duration: 1.0 });
        } else if (tutorialTaskIs('rescue_manual')) {
          // 发射了但没先调整角度：重置步骤并重新打开菜单，避免卡死
          tutorialFlow.rescuePulled = false; tutorialFlow.rescueAimed = false;
          showToastMessage('请先左右拖动调整发射角度', 1.8);
          tutorialFlow.rescueStarted = false;
          startTutorialGoldenSkillTraining();
        }
      }
      return true;
    }

    function completeGoldenSkillWithoutUse() {
      releaseShareResumeGuard();
      var trigger = goldenSkillState.trigger;
      var cause = goldenSkillState.deathCause;
      var anchor = goldenSkillState.anchorIndex !== null ? runtimeLevel.anchors[goldenSkillState.anchorIndex] : null;
      finishGoldenSkillMenu();
      setScene('playing');
      pointerHeld = false;
      if (isTutorialStage() && ((tutorialTaskIs('life') && tutorialFlow.lifeLost) || tutorialTaskIs('rescue_only') || tutorialTaskIs('rescue_manual'))) {
        tutorialFlow.rescueStarted = false;
        goldenSkillState.points = Math.max(1, Number(goldenSkillState.points) || 0);
        startTutorialGoldenSkillTraining();
        return;
      }
      if (trigger === 'vertical') {
        if (anchor && player.attachIndex !== null) releaseVerticalTongue(anchor);
        else detachTongue();
        return;
      }
      queueDeath(cause, true);
    }

    function resolveGoldenSkillSelection(selection) {
      if (!goldenSkillState.menuActive) return;
      if (selection === 'none') { completeGoldenSkillWithoutUse(); return; }
      if (goldenSkillState.armed) {
        applyGoldenSkill(goldenSkillState.aimAngle, goldenSkillState.power);
        return;
      }
      pointerHeld = false;
      goldenSkillState.gestureActive = false;
      goldenSkillState.phase = 'ready';
      goldenSkillState.selected = null;
      goldenSkillState.pullDistance = 0;
      goldenSkillState.power = 0;
      goldenSkillState.armed = false;
      goldenSkillState.uiOffsetX = 0;
      goldenSkillState.uiOffsetY = 0;
      goldenSkillState.gestureStartX = 0;
      goldenSkillState.gestureStartY = 0;
      goldenSkillState.dockProgress = 0;
      goldenSkillState.aimStartX = 0;
      goldenSkillState.aimStartY = 0;
      goldenSkillState.aimDragX = 0;
      showToastMessage('先下拉圆形与角色重叠，再左右拖动调整方向');
    }


    function updateGoldenSkillSelection(px, py) {
      if (!goldenSkillState.menuActive) return;

      var originX = Number(goldenSkillState.originX) || VIEW_W * 0.5;
      var originY = Number(goldenSkillState.originY) || VIEW_H * 0.56;
      var targetX = Number(goldenSkillState.targetX);
      var targetY = Number(goldenSkillState.targetY);
      if (!isFinite(targetX)) targetX = originX;
      if (!isFinite(targetY)) targetY = originY + Math.max(96, Number(goldenSkillState.dockDistance) || 158);
      var dockDistance = Math.max(96, Number(goldenSkillState.dockDistance) || Math.hypot(targetX - originX, targetY - originY) || 158);
      var phase = String(goldenSkillState.phase || 'ready');

      var launchDirX = Math.sin(Number(goldenSkillState.aimAngle) || 0);
      var launchDirY = -Math.cos(Number(goldenSkillState.aimAngle) || 0);
      var groupX = phase === 'aiming' ? targetX + launchDirX * dockDistance : originX;
      var groupY = phase === 'aiming' ? targetY + launchDirY * dockDistance : originY;
      // 2026-10-11：移除「不使用」圆圈按钮（现场大屏无用且易误触）——命中判定一并删除
      var controlProgress = phase === 'aiming' ? 1 : clamp(Number(goldenSkillState.dockProgress) || 0, 0, 1);
      var control = {
        x: lerp(originX, targetX, controlProgress),
        y: lerp(originY, targetY, controlProgress),
        r: phase === 'ready' ? 76 : 68
      };

      if (!goldenSkillState.gestureActive) {
        if (!pointInCircle(px, py, control)) return;

        goldenSkillState.gestureActive = true;
        goldenSkillState.countdownLocked = true;
        goldenSkillState.phase = 'lowering';
        goldenSkillState.selected = null;
        goldenSkillState.armed = false;
        goldenSkillState.power = 0;
        goldenSkillState.pullDistance = 0;
        goldenSkillState.aimAngle = 0;
        goldenSkillState.dockProgress = 0;
        goldenSkillState.gestureStartX = px;
        goldenSkillState.gestureStartY = py;
        goldenSkillState.aimStartX = 0;
        goldenSkillState.aimStartY = 0;
        goldenSkillState.aimDragX = 0;
        triggerHaptic('light');
        return;
      }

      phase = String(goldenSkillState.phase || 'lowering');
      if (phase === 'lowering') {
        var startY = Number(goldenSkillState.gestureStartY);
        if (!isFinite(startY)) startY = originY;
        var down = Math.max(0, py - startY);
        var progress = clamp(down / dockDistance, 0, 1);
        goldenSkillState.dockProgress = progress;
        goldenSkillState.uiOffsetX = 0;
        goldenSkillState.uiOffsetY = 0;
        goldenSkillState.pullDistance = clamp(down, 0, GOLDEN_SKILL_MAX_PULL);
        goldenSkillState.power = 0;
        goldenSkillState.armed = false;
        goldenSkillState.selected = null;

        if (progress >= 0.985) {
          goldenSkillState.phase = 'aiming';
          goldenSkillState.dockProgress = 1;
          goldenSkillState.aimStartX = px;
          goldenSkillState.aimStartY = py;
          goldenSkillState.aimDragX = 0;
          goldenSkillState.aimAngle = 0;
          goldenSkillState.pullDistance = GOLDEN_SKILL_MAX_PULL * 0.84;
          goldenSkillState.power = 0.78;
          goldenSkillState.armed = true;
          goldenSkillState.selected = 'launch';
          triggerHaptic('medium');
        }
        return;
      }

      if (phase === 'aiming') {
        var aimStartX = Number(goldenSkillState.aimStartX);
        if (!isFinite(aimStartX)) aimStartX = px;
        var dragX = clamp(px - aimStartX, -170, 170);
        goldenSkillState.aimDragX = dragX;

        // 手指向前/向后拖时，上方弓形 UI 反向移动；发射方向指向弓形 UI。
        var normalized = clamp(dragX / 150, -1, 1);
        goldenSkillState.aimAngle = clamp(-normalized * GOLDEN_SKILL_MAX_ANGLE, -GOLDEN_SKILL_MAX_ANGLE, GOLDEN_SKILL_MAX_ANGLE);
        goldenSkillState.pullDistance = clamp(GOLDEN_SKILL_MAX_PULL * (0.84 + Math.abs(normalized) * 0.16), GOLDEN_SKILL_MIN_PULL, GOLDEN_SKILL_MAX_PULL);
        goldenSkillState.power = clamp(0.78 + Math.abs(normalized) * 0.22, 0, 1);
        goldenSkillState.armed = true;
        goldenSkillState.selected = 'launch';

        var dirX = Math.sin(goldenSkillState.aimAngle);
        var dirY = -Math.cos(goldenSkillState.aimAngle);
        goldenSkillState.uiOffsetX = targetX + dirX * dockDistance - originX;
        goldenSkillState.uiOffsetY = targetY + dirY * dockDistance - originY;
      }

      if (isTutorialStage() && tutorialTaskIs('rescue_manual')) {
        if (!tutorialFlow.rescuePulled && goldenSkillState.phase === 'aiming') {
          tutorialFlow.rescuePulled = true;
          showToastMessage('1/3 已往下拉到底', 1.3);
        }
        if (tutorialFlow.rescuePulled && !tutorialFlow.rescueAimed && Math.abs(Number(goldenSkillState.aimAngle) || 0) > 0.06) {
          tutorialFlow.rescueAimed = true;
          showToastMessage('2/3 已调整发射角度', 1.3);
        }
      }
    }


    function offerGoldenSkillAd(trigger, cause, anchorIndex) {
      // [kiosk 2026-10-11 下午] 现场无广告：双保险——即使有路径漏进来也绝不弹广告，直接判死。
      if (kioskRun.active) { goldenSkillState.adBusy = false; queueDeath(cause || 'fall', true); return; }
      if (goldenSkillState.adBusy) return;
      if (goldenSkillState.stageAdUsed) {
        showToastMessage('本关广告救援已使用');
        goldenSkillState.trigger = trigger;
        goldenSkillState.deathCause = cause || '';
        goldenSkillState.anchorIndex = typeof anchorIndex === 'number' ? anchorIndex : null;
        completeGoldenSkillWithoutUse();
        return;
      }
      goldenSkillState.adBusy = true;
      goldenSkillState.trigger = trigger;
      goldenSkillState.deathCause = cause || '';
      goldenSkillState.anchorIndex = typeof anchorIndex === 'number' ? anchorIndex : null;
      pointerHeld = false;
      setScene('golden_skill_ad');

      function decline() {
        goldenSkillState.adBusy = false;
        completeGoldenSkillWithoutUse();
      }
      if (typeof wx === 'undefined' || !wx.showModal) { decline(); return; }
      wx.showModal({
        title: '没有黄金蕃薯了',
        content: '观看完整广告可获得 1 次黄金蕃薯技能。本关最多通过广告获得 1 次。',
        confirmText: '看广告',
        cancelText: '放弃救援',
        success: function(res) {
          if (!res || !res.confirm) { decline(); return; }
          showRewardedAd('golden_skill', function(ok) {
            goldenSkillState.adBusy = false;
            if (!ok) { showToastMessage('需完整观看广告才能获得技能'); completeGoldenSkillWithoutUse(); return; }
            goldenSkillState.stageAdUsed = true;
            goldenSkillState.points += 1;
            triggerHaptic('medium'); playFoodSound();
            showGoldenSkillMenu(trigger, cause, anchorIndex);
          });
        },
        fail: decline
      });
    }

    function requestGoldenSkill(trigger, cause, anchorIndex) {
      if (isTutorialStage()) return false;
      if (goldenSkillState.points > 0) return showGoldenSkillMenu(trigger, cause, anchorIndex);
      offerGoldenSkillAd(trigger, cause, anchorIndex);
      return true;
    }

    function requestDeathOrSkill(cause) {
      if (isTutorialStage()) {
        handleTutorialLifeLoss(cause || 'fall');
        return;
      }
      // 2026-10-01 白娘子·水漫金山：本关第一次落地必须被脚下喷泉接住、冲上空中。
      // ⚠ 拦截必须放在 requestGoldenSkill 之前：后者即使没有黄金番薯也会 offerGoldenSkillAd() 后 return true，
      //   于是 `if (!requestGoldenSkill(...)) queueDeath(...)` 几乎永远进不了 queueDeath ——
      //   写在 queueDeath 里的喷泉拦截就永远没机会执行（真实 bug：白娘子落地直接摔死，看不到水漫金山）。
      if (cause === 'ground' && hasFloodFountain() && triggerFloodFountain()) return;
      // [kiosk 2026-10-11 下午] 现场绝无广告：番薯（技能点）>0 → 自动放屁救援；==0 → 直接判死（挑战失败）。
      // （修复：此直连路径原先不查 kiosk，0 番薯时会掉进 offerGoldenSkillAd 弹「等待广告选择」。）
      if (kioskRun.active && goldenSkillState.points <= 0) { queueDeath(cause, true); return; }
      if (cause === 'hazard') { queueDeath(cause, true); return; }
      if (!requestGoldenSkill('death', cause || 'fall', null)) queueDeath(cause, true);
    }

    function queueDeath(cause, bypassSkill) {
      if (scene !== 'playing') return;
      // 2026-10-01 白娘子·水漫金山：本该判死的落地被拦截一次（每关 1 次，与广告/分享复活互不干扰）。
      if (cause === 'ground' && !isTutorialStage() && hasFloodFountain() && triggerFloodFountain()) return;
      // [kiosk 2026-10-11 下午] 现场无广告无复活弹窗：还有番薯 → 自动放屁救援（扣 1 颗）；
      // 番薯用完 → 任何死法都直接判「挑战失败」结束本轮（回首页等下一位）。
      if (kioskRun.active) {
        if (goldenSkillState.points > 0) { requestGoldenSkill('death', cause || 'fall', null); return; }
        kioskOnDeath(cause); return;
      }
      if (!bypassSkill && !isTutorialStage()) { requestDeathOrSkill(cause); return; }
      if (isTutorialStage()) { handleTutorialLifeLoss(cause || 'fall'); return; }
      pointerHeld = false; detachTongue(); deathTimer = 0; deathLeaderboardShown = false;
      centerCameraOnPlayer(1.2, true);
      runStats.deaths += 1;
      runStats.hearts = Math.max(0, runStats.hearts - 1);
      if (cause === 'ground') {
        triggerHaptic('heavy');
        setTimeout(function() { triggerHaptic('long', true); }, 80);
      } else {
        triggerHaptic(runStats.hearts <= 0 ? 'long' : 'heavy');
      }
      runStats.combo = 0; runStats.multiplier = 1; runStats.comboTimer = 0;
      if (runStats.hearts <= 0) {
        reviveOffer.cause = cause || 'fall';
        var soulX = clamp(player.x, player.r, runtimeLevel.width - player.r);
        var landingY = runtimeLevel.height - Math.max(44, player.r + 18);
        player.x = soulX; player.y = landingY; player.vx = 0; player.vy = 0; player.attachIndex = null;
        soulState = { active: true, timer: 0, duration: SOUL_ASCEND_DURATION, x: soulX, y: landingY - 18, particleTimer: 0 };
        centerCameraOnPlayer(999, true);
        setScene('soul_departure');
        playSoulAscend8BitSound();
        // 每日任务「完成 1 局」：最终阵亡（灵魂离体、无复活）才算打完一局 → +1（每天限 1 次）。
        try { creditDailyTask('play_run'); } catch (ignorePlayTask) {}
        for (var si = 0; si < 24; si++) spawnParticle(soulX, landingY - 12, 0, false, si % 3 === 0 ? '#ffe89a' : '#d9fbff');
      } else {
        setScene('death');
        playDeath8BitSound();
        for (var i = 0; i < 18; i++) spawnParticle(player.x, runtimeLevel.height - 24, 0, false, '#ffffff');
      }
    }
    // ————— [kiosk 2026-10-10 晚] 线下「三侠闯关」核心逻辑 —————
    function kioskFindHangzhouStage() {
      for (var i = 0; i < STAGES.length; i++) {
        if (STAGES[i] && String(STAGES[i].cityId || '') === 'hangzhou') return i;
      }
      return -1;
    }

    // ————— [kiosk 2026-10-11 下午] 现场杭州三地图（随机轮换） —————
    // 地图1 = level_pack.json 的杭州关（编辑器设计稿）；地图2/3 = 由地图1横向区段重排派生（保证纵向玩法结构不变）。
    // 现场每一轮随机抽一张（本轮内不重复），背景统一杭州。网页右上角三连击可打开「地图编辑器」
    // 覆盖这三张图（存 localStorage，优先于内置默认）。
    var KIOSK_MAP_STORAGE_KEY = 'super_tongue_axi_hz_kiosk_maps_v1';
    var kioskEditorTargetIndex = null;   // [地图编辑器] 非空=现场地图编辑器正在编辑第 N 张（甲/乙/丙），保存写回该槽
    var KIOSK_MAP_VARIANT_B = {"version":43,"name":"L4","theme":"hangzhou","backgroundImage":"res_scene/backgrounds/bg_hangzhou.jpg","backgroundFit":"viewport-height","backgroundTravelRatio":1,"width":7000,"height":960,"start":{"x":101,"y":180},"finish":{"x":6800,"y":0,"w":56,"h":960},"anchors":[{"id":"a2","x":200,"y":190},{"id":"a3","x":520,"y":150},{"id":"a4","x":840,"y":230},{"id":"a5","x":1160,"y":170},{"id":"a6","x":1480,"y":300},{"id":"a7","x":1800,"y":200},{"id":"a8","x":2120,"y":140},{"id":"a9","x":2440,"y":260},{"id":"a10","x":2760,"y":180},{"id":"a11","x":3080,"y":240},{"id":"a12","x":3400,"y":160},{"id":"a13","x":3720,"y":280},{"id":"a14","x":4040,"y":210},{"id":"a15","x":4360,"y":170},{"id":"a16","x":4680,"y":320},{"id":"a17","x":5000,"y":190},{"id":"a18","x":5320,"y":150},{"id":"a19","x":5640,"y":240},{"id":"a20","x":5960,"y":200},{"id":"a21","x":6280,"y":260},{"id":"a22","x":6600,"y":180}],"foods":[{"id":"f1","x":500,"y":300,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"f2","x":1080,"y":420,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"f3","x":1660,"y":260,"kind":"sushi_lvdoutang","points":25,"collected":false},{"id":"f4","x":2240,"y":380,"kind":"xihu_cuyu","points":25,"collected":false},{"id":"f5","x":2820,"y":340,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"f6","x":3400,"y":450,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"f7","x":3980,"y":280,"kind":"sushi_lvdoutang","points":25,"collected":false},{"id":"f8","x":4560,"y":400,"kind":"xihu_cuyu","points":25,"collected":false},{"id":"f9","x":5140,"y":320,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"f10","x":5720,"y":440,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"f11","x":6300,"y":360,"kind":"sushi_lvdoutang","points":25,"collected":false},{"id":"f_xionghuangjiu","x":6520,"y":380,"kind":"xionghuangjiu","points":200,"collected":false,"eggItem":true},{"id":"fnew1","x":1906,"y":322,"kind":"bubble_tea","points":25,"collected":false},{"id":"fnew2","x":2333,"y":294,"kind":"bubble_tea","points":25,"collected":false},{"id":"fnew3","x":3285,"y":273,"kind":"red_braised_pork","points":25,"collected":false},{"id":"fnew4","x":4425,"y":417,"kind":"red_braised_pork","points":25,"collected":false},{"id":"fnew5","x":1303,"y":388,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"fnew6","x":1730,"y":394,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"fnew7","x":3601,"y":388,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"fnew8","x":3195,"y":446,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"fnew9","x":2822,"y":457,"kind":"sushi_lvdoutang","points":25,"collected":false},{"id":"fnew10","x":2921,"y":431,"kind":"xihu_cuyu","points":25,"collected":false}],"bumpers":[{"id":"b1","x":420,"y":720,"r":40,"power":1.48,"hazard":false,"tutorialPropType":""},{"id":"b2","x":810,"y":640,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b3","x":1260,"y":780,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b4","x":1750,"y":700,"r":40,"power":1.48,"hazard":false,"tutorialPropType":""},{"id":"b5","x":2200,"y":660,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b6","x":2700,"y":740,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b7","x":3300,"y":620,"r":40,"power":1.48,"hazard":true,"tutorialPropType":""},{"id":"b8","x":3900,"y":760,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b9","x":4500,"y":680,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b10","x":5100,"y":720,"r":40,"power":1.48,"hazard":false,"tutorialPropType":""},{"id":"b11","x":5700,"y":700,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""}],"walls":[{"id":"w1","x":350,"y":700,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w2","x":900,"y":640,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w3","x":1750,"y":760,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w4","x":2300,"y":690,"w":190,"h":28,"bounce":1.52,"spring":true,"axis":"horizontal","powerSpring":true,"powerMultiplier":1.2,"oneShot":false,"springType":"power","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w5","x":3150,"y":700,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w6","x":3700,"y":740,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w7","x":4550,"y":760,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w8","x":5100,"y":640,"w":190,"h":28,"bounce":1.52,"spring":true,"axis":"horizontal","powerSpring":true,"powerMultiplier":1.2,"oneShot":false,"springType":"power","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w9","x":5950,"y":700,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w10","x":6350,"y":690,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w11","x":6500,"y":760,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w12","x":6350,"y":740,"w":190,"h":28,"bounce":1.52,"spring":true,"axis":"horizontal","powerSpring":true,"powerMultiplier":1.2,"oneShot":false,"springType":"power","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w13","x":1150,"y":560,"w":30,"h":210,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w14","x":3950,"y":540,"w":30,"h":210,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w15","x":6050,"y":560,"w":30,"h":210,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w16","x":250,"y":750,"w":34,"h":150,"bounce":0.52,"spring":false,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"stump","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w17","x":2850,"y":760,"w":34,"h":150,"bounce":0.52,"spring":false,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"stump","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w18","x":5250,"y":750,"w":34,"h":150,"bounce":0.52,"spring":false,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"stump","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""}],"windZones":[{"id":"z1","x":4600,"y":180,"w":442,"h":520,"forceX":50,"forceY":-30}],"isTutorial":false,"tutorialKind":"","cityId":"hangzhou","title":"杭州","titleEn":"HANGZHOU","kioskVariant":"B"};
    var KIOSK_MAP_VARIANT_C = {"version":43,"name":"L4","theme":"hangzhou","backgroundImage":"res_scene/backgrounds/bg_hangzhou.jpg","backgroundFit":"viewport-height","backgroundTravelRatio":1,"width":7000,"height":960,"start":{"x":101,"y":180},"finish":{"x":6800,"y":0,"w":56,"h":960},"anchors":[{"id":"a2","x":210,"y":160},{"id":"a3","x":525,"y":260},{"id":"a4","x":840,"y":140},{"id":"a5","x":1155,"y":300},{"id":"a6","x":1470,"y":180},{"id":"a7","x":1785,"y":240},{"id":"a8","x":2100,"y":120},{"id":"a9","x":2415,"y":320},{"id":"a10","x":2730,"y":200},{"id":"a11","x":3045,"y":160},{"id":"a12","x":3360,"y":280},{"id":"a13","x":3675,"y":140},{"id":"a14","x":3990,"y":340},{"id":"a15","x":4305,"y":220},{"id":"a16","x":4620,"y":180},{"id":"a17","x":4935,"y":300},{"id":"a18","x":5250,"y":150},{"id":"a19","x":5565,"y":260},{"id":"a20","x":5880,"y":190},{"id":"a21","x":6195,"y":240},{"id":"a22","x":6510,"y":170}],"foods":[{"id":"f1","x":560,"y":340,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"f2","x":1130,"y":280,"kind":"sushi_lvdoutang","points":25,"collected":false},{"id":"f3","x":1700,"y":440,"kind":"xihu_cuyu","points":25,"collected":false},{"id":"f4","x":2270,"y":320,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"f5","x":2840,"y":400,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"f6","x":3410,"y":260,"kind":"sushi_lvdoutang","points":25,"collected":false},{"id":"f7","x":3980,"y":420,"kind":"xihu_cuyu","points":25,"collected":false},{"id":"f8","x":4550,"y":300,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"f9","x":5120,"y":380,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"f10","x":5690,"y":340,"kind":"sushi_lvdoutang","points":25,"collected":false},{"id":"f11","x":6260,"y":300,"kind":"xihu_cuyu","points":25,"collected":false},{"id":"f_xionghuangjiu","x":6640,"y":360,"kind":"xionghuangjiu","points":200,"collected":false,"eggItem":true},{"id":"fnew1","x":4253,"y":409,"kind":"bubble_tea","points":25,"collected":false},{"id":"fnew2","x":2405,"y":448,"kind":"bubble_tea","points":25,"collected":false},{"id":"fnew3","x":6200,"y":461,"kind":"red_braised_pork","points":25,"collected":false},{"id":"fnew4","x":4637,"y":250,"kind":"red_braised_pork","points":25,"collected":false},{"id":"fnew5","x":3158,"y":294,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"fnew6","x":4915,"y":361,"kind":"dingsheng_gao","points":25,"collected":false},{"id":"fnew7","x":423,"y":381,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"fnew8","x":5029,"y":259,"kind":"longjing_xiaren","points":25,"collected":false},{"id":"fnew9","x":3920,"y":254,"kind":"sushi_lvdoutang","points":25,"collected":false},{"id":"fnew10","x":1425,"y":251,"kind":"xihu_cuyu","points":25,"collected":false}],"bumpers":[{"id":"b1","x":560,"y":700,"r":40,"power":1.5,"hazard":false,"tutorialPropType":""},{"id":"b2","x":1050,"y":760,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b3","x":1600,"y":640,"r":40,"power":1.44,"hazard":true,"tutorialPropType":""},{"id":"b4","x":2050,"y":720,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b5","x":2600,"y":680,"r":40,"power":1.5,"hazard":false,"tutorialPropType":""},{"id":"b6","x":3100,"y":780,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b7","x":3700,"y":620,"r":40,"power":1.44,"hazard":true,"tutorialPropType":""},{"id":"b8","x":4150,"y":740,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""},{"id":"b9","x":4700,"y":660,"r":40,"power":1.5,"hazard":false,"tutorialPropType":""},{"id":"b10","x":5250,"y":770,"r":40,"power":1.44,"hazard":true,"tutorialPropType":""},{"id":"b11","x":5900,"y":700,"r":40,"power":1.44,"hazard":false,"tutorialPropType":""}],"walls":[{"id":"w1","x":280,"y":760,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w2","x":980,"y":600,"w":190,"h":28,"bounce":1.52,"spring":true,"axis":"horizontal","powerSpring":true,"powerMultiplier":1.2,"oneShot":false,"springType":"power","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w3","x":1680,"y":800,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w4","x":2380,"y":660,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w5","x":3080,"y":760,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w6","x":3780,"y":720,"w":190,"h":28,"bounce":1.52,"spring":true,"axis":"horizontal","powerSpring":true,"powerMultiplier":1.2,"oneShot":false,"springType":"power","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w7","x":4480,"y":800,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w8","x":5180,"y":600,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w9","x":5880,"y":760,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w10","x":6200,"y":660,"w":190,"h":28,"bounce":1.52,"spring":true,"axis":"horizontal","powerSpring":true,"powerMultiplier":1.2,"oneShot":false,"springType":"power","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w11","x":6450,"y":800,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w12","x":6200,"y":720,"w":190,"h":28,"bounce":1.24,"spring":true,"axis":"horizontal","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w13","x":900,"y":500,"w":30,"h":230,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w14","x":2150,"y":480,"w":30,"h":230,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w15","x":3350,"y":520,"w":30,"h":230,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w16","x":4450,"y":470,"w":30,"h":230,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w17","x":5550,"y":510,"w":30,"h":230,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w18","x":6350,"y":500,"w":30,"h":230,"bounce":1.72,"spring":true,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":true,"springType":"oneShot","material":"wall","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w19","x":1750,"y":770,"w":34,"h":150,"bounce":0.52,"spring":false,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"stump","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""},{"id":"w20","x":4850,"y":760,"w":34,"h":150,"bounce":0.52,"spring":false,"axis":"vertical","powerSpring":false,"powerMultiplier":1,"oneShot":false,"springType":"","material":"stump","used":false,"removed":false,"disappearTimer":0,"springAnim":0,"springAnimVelocity":0,"tutorialPropType":""}],"windZones":[{"id":"z1","x":1500,"y":160,"w":442,"h":520,"forceX":-46,"forceY":-30},{"id":"z2","x":4900,"y":200,"w":442,"h":540,"forceX":58,"forceY":-36}],"isTutorial":false,"tutorialKind":"","cityId":"hangzhou","title":"杭州","titleEn":"HANGZHOU","kioskVariant":"C"};
    function kioskValidateMap(m) {
      if (!m || typeof m !== 'object') return false;
      if (!Array.isArray(m.anchors) || !m.anchors.length) return false;
      if (!Array.isArray(m.foods) || !m.foods.length) return false;
      if (!Array.isArray(m.walls)) return false;
      if (!m.start || !m.finish || !Number(m.width)) return false;
      return true;
    }
    function kioskMapDefaults() {
      var idx = kioskFindHangzhouStage();
      var a = idx >= 0 ? clone(STAGES[idx]) : null;
      if (!kioskValidateMap(a)) a = clone(KIOSK_MAP_VARIANT_B);
      return [a, clone(KIOSK_MAP_VARIANT_B), clone(KIOSK_MAP_VARIANT_C)];
    }
    // 读取三张现场地图：localStorage 覆盖（地图编辑器写入）→ 内置默认。返回 {maps, source, savedAt}
    //   [v35] 存储格式升级为 {maps:[甲,乙,丙], savedAt:时间戳}（兼容旧版纯数组）；savedAt 用于
    //   与发布包 kiosk_maps_override.json 的种子比较：谁的 savedAt 新用谁，双向都不会互相覆盖。
    function kioskLoadMaps() {
      var defaults = kioskMapDefaults();
      try {
        var raw = String(wx.getStorageSync(KIOSK_MAP_STORAGE_KEY) || '');
        if (raw) {
          var parsed = JSON.parse(raw);
          var arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.maps) ? parsed.maps : null);
          if (arr && arr.length === 3 && arr.every(kioskValidateMap)) {
            return {
              maps: arr.map(function (m) { return clone(m); }),
              source: 'editor',
              savedAt: (!Array.isArray(parsed) && Number(parsed.savedAt) > 0) ? Number(parsed.savedAt) : 0
            };
          }
        }
      } catch (e) {}
      return { maps: defaults, source: 'builtin', savedAt: 0 };
    }
    // —— 供网页地图编辑器调用（index.html 右上角三连击） ——
    window.__kioskMapsGet = function () {
      var r = kioskLoadMaps();
      return { source: r.source, maps: r.maps };
    };
    window.__kioskMapsSet = function (arrOrObj) {
      try {
        var arr = Array.isArray(arrOrObj) ? arrOrObj : (arrOrObj && arrOrObj.maps);
        if (!Array.isArray(arr) || arr.length !== 3 || !arr.every(kioskValidateMap)) {
          return { ok: false, reason: '需要长度为 3 的地图数组（anchors/foods/walls/start/finish/width 齐全）' };
        }
        var savedAt = (!Array.isArray(arrOrObj) && Number(arrOrObj.savedAt) > 0) ? Number(arrOrObj.savedAt) : Date.now();
        wx.setStorageSync(KIOSK_MAP_STORAGE_KEY, JSON.stringify({ maps: arr, savedAt: savedAt }));
        return { ok: true, savedAt: savedAt };
      } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    };
    // [v35 用户需求] 地图 JSON 导出/导入：编辑器数据只存本机 localStorage，导出成文件才不会
    // 因清缓存/换机丢失。导出=三张合一（{maps:[甲,乙,丙],savedAt}）；导入=文件内容原样回灌
    // （也接受单张对象数组）。导入后如正在编辑器中，强制重载当前槽位。
    window.__kioskMapsExport = function () {
      try {
        var r = kioskLoadMaps();
        var payload = { app: 'super-tongue-hz-kiosk', savedAt: r.savedAt || Date.now(), exportedAt: Date.now(), maps: r.maps };
        return { ok: true, json: JSON.stringify(payload), maps: r.maps, source: r.source, savedAt: r.savedAt };
      } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    };
    window.__kioskMapsImport = function (text) {
      try {
        var data = typeof text === 'string' ? JSON.parse(text) : text;
        var arr = Array.isArray(data) ? data : (data && Array.isArray(data.maps) ? data.maps : null);
        if (!arr || arr.length !== 3 || !arr.every(kioskValidateMap)) {
          return { ok: false, reason: 'JSON 需为 {maps:[甲,乙,丙]} 或长度为 3 的地图数组' };
        }
        var savedAt = (data && !Array.isArray(data) && Number(data.savedAt) > 0) ? Number(data.savedAt) : Date.now();
        wx.setStorageSync(KIOSK_MAP_STORAGE_KEY, JSON.stringify({ maps: arr, savedAt: savedAt }));
        // 正在编辑器中：重载当前槽位（先置空目标让切图逻辑真正重载）
        try {
          if (scene === 'editor' && typeof kioskEditorTargetIndex === 'number') {
            var cur = kioskEditorTargetIndex;
            kioskEditorTargetIndex = null;
            kioskSwitchMapEditor(cur);
          }
        } catch (eReload) {}
        return { ok: true, savedAt: savedAt };
      } catch (e) { return { ok: false, reason: 'JSON 解析失败：' + String(e && e.message || e) }; }
    };
    // [v35] 发布包种子：index.html 启动时 fetch kiosk_maps_override.json，比 savedAt 后决定是否
    // 采纳（谁新用谁）。这里只暴露写入口，避免 index.html 直接拼存储格式。
    window.__kioskMapsAdoptSeed = function (payload) {
      try {
        var arr = payload && Array.isArray(payload.maps) ? payload.maps : null;
        if (!arr || arr.length !== 3 || !arr.every(kioskValidateMap)) return { ok: false, reason: 'seed 不合法' };
        var cur = kioskLoadMaps();
        var seedAt = Number(payload.savedAt) || 0;
        if (seedAt > (cur.savedAt || 0)) {
          wx.setStorageSync(KIOSK_MAP_STORAGE_KEY, JSON.stringify({ maps: arr, savedAt: seedAt }));
          return { ok: true, adopted: true, seedAt: seedAt, localAt: cur.savedAt || 0 };
        }
        return { ok: true, adopted: false, seedAt: seedAt, localAt: cur.savedAt || 0 };
      } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    };
    window.__kioskMapsReset = function () {
      try { wx.removeStorageSync(KIOSK_MAP_STORAGE_KEY); return { ok: true }; }
      catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    };
    // [地图编辑器] 用游戏内核自带的「同小游戏」可视化编辑器编辑第 mapIndex 张现场地图（甲/乙/丙）。
    //   该编辑器与小游戏完全一致：带背景图、可点选元素后「删除选中」、拖拽改位置、增删道具。
    window.__kioskOpenMapEditor = function (mapIndex) {
      try {
        if (scene === 'editor') return { ok: false, reason: '已在编辑器中' };
        if (typeof mapIndex !== 'number' || mapIndex < 0 || mapIndex > 2) mapIndex = 0;
        var r = kioskLoadMaps();
        var m = r.maps[mapIndex % r.maps.length];
        if (!kioskValidateMap(m)) return { ok: false, reason: '该地图数据不合法' };
        kioskEditorTargetIndex = mapIndex % r.maps.length;
        editorState.mapTab = kioskEditorTargetIndex;   // [2026-10-13] 顶部显示 甲/乙/丙 切换标签页
        if (typeof window !== 'undefined') window.__kioskEditorMode = true;   // 暂停门禁自动显示
        // 隐藏扫码门禁遮罩，露出画布
        try { var gw = document.getElementById('gateWrap'); if (gw) gw.classList.add('hidden'); } catch (e0) {}
        // 进入编辑器（复用 enterEditor 的装配逻辑，但载入现场地图而非内置关）
        editorButtonVisible = false;
        resetEditorSecretTap();
        pointerHeld = false;
        if (player && (player.attachIndex !== null || tongueFx.mode !== 'none')) detachTongue();
        stopSpinLoop();
        editorState.returnScene = 'menu';
        editorState.selected = null; editorState.drag = null; editorState.dirty = false;
        if (editorState.fileDialog) editorState.fileDialog.open = false;
        editorState.cameraSnapshot = cameraX;
        editorState.playerSnapshot = player ? clone(player) : null;
        editorState.collectedById = {};
        editorState.cameraY = 0;
        editorState.jumpStage = normalizeEditorJumpStage(stageIndex);
        runtimeLevel = clone(m);
        if (!runtimeLevel.bumpers) runtimeLevel.bumpers = [];
        if (!runtimeLevel.windZones) runtimeLevel.windZones = [];
        if (!runtimeLevel.walls) runtimeLevel.walls = [];
        if (!runtimeLevel.foods) runtimeLevel.foods = [];
        if (!runtimeLevel.anchors) runtimeLevel.anchors = [];
        rebuildRuntimeSpatialIndex();
        runtimeLevel.foods.forEach(function (f) { f.collected = false; });
        tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
        player = makePlayer();
        editorState.zoom = 0.72;
        updateEditorZoomBounds();
        cameraX = 0; editorState.cameraY = 0;
        clampEditorCamera();
        particles = []; floatingTexts = []; screenShake = 0;
        setScene('editor');
        return { ok: true, index: kioskEditorTargetIndex };
      } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    };
    // [2026-10-13] 把当前正在编辑的现场地图写回它自己的槽位（切图/保存前调用，避免改动丢失）。
    function kioskEditorPersistCurrent(silent) {
      if (scene !== 'editor' || kioskEditorTargetIndex === null || kioskEditorTargetIndex < 0) return false;
      try {
        var kr = kioskLoadMaps();
        kr.maps[kioskEditorTargetIndex % kr.maps.length] = clone(runtimeLevel);
        wx.setStorageSync(KIOSK_MAP_STORAGE_KEY, JSON.stringify(kr.maps));
        return true;
      } catch (e) {
        if (!silent) showToastMessage('保存失败：' + (e && e.message || e));
        return false;
      }
    }
    // [2026-10-13] 编辑器内切换地图（甲/乙/丙）：不退出编辑器，三张各自独立编辑。
    //   切换前先把当前这张落盘（静默），再载入目标图；三张互不影响。
    function kioskSwitchMapEditor(mapIndex) {
      if (scene !== 'editor') return { ok: false, reason: '不在编辑器中' };
      var idx = Number(mapIndex);
      if (!isFinite(idx) || idx < 0 || idx > 2) return { ok: false, reason: '无效的地图序号' };
      idx = idx % 3;
      if (kioskEditorTargetIndex === idx) return { ok: true, index: idx, unchanged: true };
      kioskEditorPersistCurrent(true);            // 先把当前这张的改动落盘
      var r = kioskLoadMaps();
      var m = r.maps[idx];
      if (!kioskValidateMap(m)) { showToastMessage('该地图数据不合法'); return { ok: false, reason: '该地图数据不合法' }; }
      kioskEditorTargetIndex = idx;
      editorState.mapTab = idx;
      runtimeLevel = clone(m);
      if (!runtimeLevel.bumpers) runtimeLevel.bumpers = [];
      if (!runtimeLevel.windZones) runtimeLevel.windZones = [];
      if (!runtimeLevel.walls) runtimeLevel.walls = [];
      if (!runtimeLevel.foods) runtimeLevel.foods = [];
      if (!runtimeLevel.anchors) runtimeLevel.anchors = [];
      rebuildRuntimeSpatialIndex();
      runtimeLevel.foods.forEach(function (f) { f.collected = false; });
      tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
      player = makePlayer();
      editorState.selected = null; editorState.drag = null; editorState.dirty = false;
      editorState.zoom = 0.72;
      updateEditorZoomBounds();
      cameraX = 0; editorState.cameraY = 0;
      clampEditorCamera();
      particles = []; floatingTexts = []; screenShake = 0;
      showToastMessage('已切换到现场地图【' + ['甲', '乙', '丙'][idx] + '】');
      return { ok: true, index: idx };
    }
    window.__kioskSwitchMapEditor = function (mapIndex) {
      try { return kioskSwitchMapEditor(mapIndex); }
      catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    };
    // [地图编辑器] 验收/调试钩子：只读暴露编辑器关键状态
    window.__kioskEditorDebug = function () {
      try {
        return {
          scene: scene,
          targetIndex: kioskEditorTargetIndex,
          editorMode: window.__kioskEditorMode === true,
          selected: editorState && editorState.selected ? clone(editorState.selected) : null,
          zoom: editorState ? editorState.zoom : 0,
          counts: runtimeLevel ? {
            foods: runtimeLevel.foods.length, anchors: runtimeLevel.anchors.length,
            bumpers: runtimeLevel.bumpers.length, walls: runtimeLevel.walls.length
          } : null,
          gateWrapHidden: (typeof document !== 'undefined' && document.getElementById('gateWrap')) ? document.getElementById('gateWrap').classList.contains('hidden') : null,
          mapTab: (editorState && typeof editorState.mapTab === 'number') ? editorState.mapTab : null,
          mapSig: runtimeLevel ? {
            w: runtimeLevel.width,
            anchors: runtimeLevel.anchors.length, foods: runtimeLevel.foods.length,
            walls: runtimeLevel.walls.length, bumpers: runtimeLevel.bumpers.length,
            a0: runtimeLevel.anchors[0] ? [runtimeLevel.anchors[0].x, runtimeLevel.anchors[0].y] : null,
            f0: runtimeLevel.foods[0] ? [runtimeLevel.foods[0].x, runtimeLevel.foods[0].y] : null
          } : null,
          hotspots: {
            del: uiHotspots.editorDelete || null,
            delInline: uiHotspots.editorDeleteInline || null,
            save: uiHotspots.editorSave || null,
            mapTabs: uiHotspots.editorMapTabs || null,
            add: uiHotspots.editorAdd || null
          },
          screenOf: function (sel) {
            try {
              var obj = getEditorObject(sel);
              if (!obj) return null;
              var c = editorObjectCenter(sel, obj);
              var off = editorMapOffset();
              return {
                px: EDITOR_VIEWPORT.x + off.x + (c.x - cameraX) * editorState.zoom,
                py: EDITOR_VIEWPORT.y + off.y + (c.y - editorState.cameraY) * editorState.zoom
              };
            } catch (e2) { return null; }
          }
        };
      } catch (e) { return { err: String(e && e.message || e) }; }
    };
    // 本轮三张现场地图的出场顺序：**每次开局随机洗牌**（甲/乙/丙 三张互不重复）。
    // 角色出场序列恒为「阿蜥→白娘子→小青」（由变身视频钉死，见 KIOSK_CHARACTER_ORDER），
    // 变的只是「地图 ↔ 关卡」的配对——三张地图落到任一关的概率均为 1/3（6 种排列等概率）。
    // 2026-10-12：曾因当次需求（第2关固定地图乙、第3关固定地图丙）改为固定 甲→乙→丙。
    // 2026-10-16：用户要求恢复「随机分配、每轮不重复」，故改回 Fisher-Yates 洗牌。
    function kioskMapOrder() {
      var a = [0, 1, 2];                          // 0=甲 1=乙 2=丙
      for (var i = a.length - 1; i > 0; i--) {     // Fisher-Yates：6 种排列等概率
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    // 把第 mapIndex 张现场地图套到杭州关槽位上（仅现场闯关期间生效，普通游玩不受影响）
    function kioskApplyMap(mapIndex) {
      var r = kioskLoadMaps();
      var mi = ((mapIndex % r.maps.length) + r.maps.length) % r.maps.length;
      var m = r.maps[mi];
      if (!kioskValidateMap(m)) {
        // [v70] 存储槽位数据损坏/不合法 → 回退该槽位的内置默认图。
        //   绝不能静默 return（否则 STAGES 槽位沿用上一关的地图 → 三关全是地图甲）。
        try { m = kioskMapDefaults()[mi]; } catch (eDef) {}
      }
      var idx = kioskFindHangzhouStage();
      if (!kioskValidateMap(m) || idx < 0) return false;
      var copy = clone(m);
      copy.cityId = 'hangzhou';      // 背景/判定统一杭州
      copy.name = 'L4';              // 食物池/编辑器/主题逻辑全部按 L4 走
      copy.kioskVariant = ['甲', '乙', '丙'][mi];
      STAGES[idx] = copy;
      return true;
    }

    // 换上第 i 位角色并直接开战（锁杭州关，跳过选关/转盘/广告/次数）。
    function kioskStartCharacter(i) {
      if (!kioskRun.active) return false;
      var id = kioskOrder()[i];
      if (!id) return false;
      // [v52] 暴露当前轮次（0/1/2）给音频子系统：第2轮(i=1)用第二首 BGM，第1/3轮用第一首
      try { if (typeof window !== 'undefined') window.__kioskRoundIndex = i; } catch (eRI) {}
      // 线下必须真正换上该角色：强制置为已拥有（三位都是 free），再穿戴。
      try { if (!skinState.owned) skinState.owned = {}; skinState.owned[id] = true; } catch (e) {}
      try { ensurePackage('res_skins'); } catch (e) {}
      try { equipSkin(id); } catch (e) {}
      try { ensureSkinArt(id); } catch (e) {}   // 提前触发解码，避免开局瞬间跌到兜底
      var target = kioskFindHangzhouStage();
      if (target < 0) return false;
      // 2026-10-11：现场三地图随机——本轮抽取顺序在开局时洗牌（三张不重复），每轮套用对应地图
      try {
        if (!Array.isArray(kioskRun.mapOrder) || kioskRun.mapOrder.length !== 3) kioskRun.mapOrder = kioskMapOrder();
        kioskApplyMap(kioskRun.mapOrder[Math.min(2, Math.max(0, i))]);
      } catch (mapError) {}
      // 现场三轮制：锁第1轮版式（关卡长度 ×1，终点=原版终点位置），
      // 「第一轮终点」绿线标记只在 round≥2 绘制 → 现场永不再出现；避开点直接由终点判定过关。
      try {
        if (!kioskRun.roundSnapshot) kioskRun.roundSnapshot = Math.max(1, Math.round(Number(progress.round) || 1));
        progress.round = 1;
        progress.pendingRoundTarget = 0;
      } catch (e) {}
      progress.currentStage = target;
      progress.tutorialSeen = true;
      if (Math.round(Number(progress.round) || 1) < 2) {
        progress.unlockedStage = Math.max(clampStageIndex(Number(progress.unlockedStage) || 0), target);
      }
      try { saveProgress(); } catch (e) {}
      stageSelectIndex = target;
      // [2026-10-14 v31] 每轮开局主动跑一轮「手势后补声阶梯」（全幂等）：现场第 1 关经常在
      //   「扫码→自动开局」后零手势进入，Chrome autoplay 会拦掉开局瞬间的一切 play()；
      //   只要此前后有过任何一次真实手势（顾客第一下空白键也算），阶梯重试会在
      //   ~2.6s 内把 BGM 与音效全部拉起（此前只有看门狗 1.2s 周期兜底，开局瞬间不补）。
      try { if (typeof window !== 'undefined' && window.__stwxPumpAudioRetry) window.__stwxPumpAudioRetry('round-start'); } catch (ePump) {}
      try { audioRecoverOnce('round-start'); } catch (eRec) {}
      requestPlayerProfile(function () {
        if (!kioskRun.active) return;          // 期间已结束（如阵亡回首页）→ 不误开新局
        requestFormalPlay(target, true);
      });
      return true;
    }
    // 本轮小结：failed=true 用于阵亡（页面显示「游戏结束 请再次扫码」），否则是三位全过的通关小结。
    function kioskRunSummary(failed) {
      var rows = [];
      for (var i = 0; i < kioskOrder().length; i++) {
        var def = getSkinDef(kioskOrder()[i]);
        var r = kioskRun.results[i] || {};
        rows.push({
          id: def.id, name: def.name, title: def.title || '',
          score: Math.max(0, Math.round(Number(r.score) || 0)), cleared: !!r.cleared
        });
      }
      var total = 0;
      for (var j = 0; j < rows.length; j++) total += rows[j].score;
      // [2026-10-17 需求] 剩余黄金番薯：结算时每颗 +100 分（现场共用番薯池没用完的部分，奖励高效通关）。
      //   记分板加一行「剩余番薯 ×N」，云端提交的 total 同步含此加成。
      var leftoverPotatoes = Math.max(0, Math.round(Number(kioskRun.potatoes) || 0));
      var potatoBonus = leftoverPotatoes * KIOSK_LEFTOVER_POTATO_BONUS;
      if (potatoBonus > 0) {
        rows.push({ id: '_leftover_potatoes', name: '剩余番薯 ×' + leftoverPotatoes, title: '每颗+100', score: potatoBonus, cleared: false, bonus: true });
        total += potatoBonus;
      }
      if (failed) {
        var idx = clamp(Math.round(Number(kioskRun.index) || 0), 0, kioskOrder().length - 1);
        var cur = getSkinDef(kioskOrder()[idx]) || {};
        return {
          failed: true,
          title: '游戏结束', subtitle: '请 再 次 扫 码',
          reachedIndex: idx, reachedName: cur.name || '', reachedTitle: cur.title || '',
          score: Math.max(0, Math.round(Number(runStats.stageTotalScore) || 0)),
          results: rows, total: total
        };
      }
      return { failed: false, title: '恭喜完成破关 杭州限定版本', subtitle: '超级舌阿蜥 · 三位角色全部通关', results: rows, total: total };
    }
    // 结束本轮：清状态 → 回首页（页面侧由 __kioskOnReturnHome 收到通知）
    function kioskEndRun() {
      kioskRun.active = false; kioskRun.dying = false; kioskRun.complete = false;
      kioskRun.index = 0; kioskRun.results = [];
      kioskRun.order = []; kioskRun.videoPending = ''; kioskRun.mapOrder = []; kioskRun.potatoes = 0;
      kioskRun.portalAdvance = null;   // [v32] 收掉未完成的穿越推进标记
      try { if (kioskRun.roundSnapshot) { progress.round = kioskRun.roundSnapshot; progress.pendingRoundTarget = 0; saveProgress(); } } catch (e) {}
      kioskRun.roundSnapshot = 0;
      try { closeRewardDialog(); } catch (e) {}
      try { resetSoulState(); } catch (e) {}
      try { menuIntroOpen = false; stageSelectOpen = false; leaderboardOpen = false; } catch (e) {}
      try { dailyLoginPopup.active = false; dailyLoginPopup.pending = false; dailyLoginPopup.continueToPlay = false; } catch (e) {}
      try { returnToMenuAfterGameOver(); } catch (e) { setScene('menu'); }
      try { if (typeof window !== 'undefined' && window.__kioskOnReturnHome) window.__kioskOnReturnHome(); } catch (e) {}
    }
    // —— [v54 现场测试] 快速过关：编辑器左栏「快速过关 ▶」按钮 ——

    //   随机产生三位角色三关分数（各 1000~2000，均为过关）→ 直接走与真实通关完全相同的
    //   结算链路：三轮总分记分板（showWin）→ 云端提交 → 500 强总榜滚动动画 → hold 后回首页。
    //   不经过任何关卡/视频/传送门，纯测试用。
    function kioskQuickClearTest() {
      var order = kioskOrder();
      if (!order || !order.length) return;
      // 复位一次干净的 kioskRun（若正在对局/已完结都覆盖）
      kioskRun.active = true;
      kioskRun.complete = false;
      kioskRun.dying = false;
      kioskRun.index = 0;
      kioskRun.results = [];
      kioskRun.order = order.slice();
      kioskRun.mapOrder = kioskMapOrder();   // 与真实开局一致：随机三张（仅用于上报/记分板）
      kioskRun.potatoes = 0;
      kioskRun.portalAdvance = null;
      kioskRun.videoPending = '';
      // 随机三关分数：1000 ~ 2000（含两端）
      for (var i = 0; i < order.length; i++) {
        var def = getSkinDef(order[i]) || {};
        var s = 1000 + Math.floor(Math.random() * 1001);
        kioskRun.results[i] = { skinId: def.id, skinName: def.name, score: s, cleared: true };
      }
      try { pointerHeld = false; detachTongue(); } catch (eDet) {}
      try { stopBgm(true); } catch (eBgm) {}
      kioskRun.complete = true;
      var summary = kioskRunSummary();
      try { if (typeof window !== 'undefined' && window.__kioskOnRunComplete) window.__kioskOnRunComplete(summary); } catch (eDone) {}
      // 与真实通关同一套停留时长：页面可用 window.__kioskCompleteHoldMs 覆盖（网页版 18s）
      var holdMs = 11000;
      try { if (typeof window !== 'undefined' && Number(window.__kioskCompleteHoldMs) > 0) holdMs = Math.round(Number(window.__kioskCompleteHoldMs)); } catch (eHold) {}
      setTimeout(function () { if (kioskRun.complete) kioskEndRun(); }, holdMs);
    }
    try { if (typeof window !== 'undefined') window.__kioskQuickClearTest = function () { kioskQuickClearTest(); }; } catch (eExp) {}
    // —— 2026-10-11 下午（第12版）现场三轮推进 ——
    // 记录本角色得分（过关后由 score_tally 记分板流程收尾时调用 advance；阵亡直接结束）
    function kioskFinishCharacter(success) {
      kioskRun.dying = false;
      var idx = kioskRun.index;
      var def = getSkinDef(kioskOrder()[idx]);
      var score = Math.max(0, Math.round(Number(runStats.stageTotalScore) || 0));
      if (idx >= 0) kioskRun.results[idx] = { skinId: def.id, skinName: def.name, score: score, cleared: !!success };
      try { pointerHeld = false; detachTongue(); } catch (e) {}
      if (!success) { kioskEndRun(); return; }
      // 过关：本关记分板（score_tally）已在展示，tally 走完后由 kioskAfterRoundTally 推进（视频/换人/总板）
    }
    // 记分板走完后的推进：①第1关（阿蜥·地图甲）过关 → 白娘子变身视频 → 第2关（地图乙）；
    // ②第2关（地图乙）过关 → 小青变身视频（制作中，先用占位） → 第3关（地图丙）；
    // ③第3关过关 → 页面「三轮总分记分板」+ 云端排名（__kioskOnRunComplete）→ 回首页。
    // 过关推进：先播「变身视频」再开下一轮。视频由页面 __kioskOnTransformVideo(skinId) 承接，
    // 播完回调 __kioskVideoFinished → kioskStartCharacter(nextIndex)。页面无视频通道时短延时直接续局。
    function kioskAdvanceWithVideo(nextIndex, videoSkin) {
      kioskRun.index = nextIndex;
      runStats = createRunStats();
      kioskRun.videoPending = videoSkin;
      var handled = false;
      try {
        if (typeof window !== 'undefined' && window.__kioskOnTransformVideo) {
          window.__kioskOnTransformVideo(videoSkin);
          handled = true;   // 页面视频元素缺失时会同步回调 __kioskVideoFinished（已续局），此处仍安全
        }
      } catch (e) { handled = false; }
      if (handled) return;
      // 异常兜底：短等待后直接继续
      kioskRun.videoPending = '';
      setTimeout(function () { if (kioskRun.active && kioskRun.index === nextIndex) kioskStartCharacter(nextIndex); }, 1200);
    }
    // [2026-10-14 v32 需求2] 现场两关之间的「传送门穿越过场」：过关记分板走完后，
    //   先播穿越动画（标题=下位角色名），穿越完成（completePortalTransition 的 kiosk 分支）
    //   再播变身视频 → 下一关。round 仍钉死为 1（roundAdvance=false），不影响写死三轮。
    function launchKioskPortalAdvance(nextIndex, videoSkin) {
      if (!kioskRun.active) { return false; }
      if (scene === 'portal_transition') return false;
      var target = kioskFindHangzhouStage();
      if (target < 0) { kioskAdvanceWithVideo(nextIndex, videoSkin); return false; }
      var targetInfo = stageDisplayInfo(target);
      var def = getSkinDef(kioskOrder()[nextIndex]) || {};
      stopBgm(true);
      portalTransitionState.timer = 0;
      portalTransitionState.targetStage = target;
      portalTransitionState.formalNumber = targetInfo.formalNumber;
      portalTransitionState.title = def.name || '下一关';
      portalTransitionState.titleEn = String(def.title || '').toUpperCase() || 'NEXT';
      portalTransitionState.travelDuration = PORTAL_TRAVEL_SECONDS;
      portalTransitionState.whiteDuration = PORTAL_WHITE_SECONDS;
      portalTransitionState.whiteStarted = false;
      portalTransitionState.completing = false;
      portalTransitionState.renderMode = portalEffectConfig.mode || 'auto';
      portalTransitionState.lastMode = 'none';
      portalTransitionState.lastError = '';
      portalTransitionState.roundAdvance = false;
      portalTransitionState.nextRound = currentRoundNumber();
      kioskRun.portalAdvance = { index: nextIndex, video: videoSkin };
      pointerHeld = false;
      stopSpinLoop();
      setScene('portal_transition');
      startPortalTransitSound();
      return true;
    }
    function kioskAfterRoundTally() {
      if (!kioskRun.active || kioskRun.complete) return;
      var idx = kioskRun.index;
      var total = kioskOrder().length;
      if (idx >= total - 1) {
        kioskRun.complete = true;
        var summary = kioskRunSummary();
        try { if (typeof window !== 'undefined' && window.__kioskOnRunComplete) window.__kioskOnRunComplete(summary); } catch (e) {}
        // 总板 + 云端总榜动画展示时长：页面可用 window.__kioskCompleteHoldMs 覆盖（网页版第13版设为 18s，
        // 容纳「三轮总分记分板 → 前500强滚动动画 → 名次放大 + 停留」）；默认 11s，随后自动回首页等下一位扫码
        var holdMs = 11000;
        try { if (typeof window !== 'undefined' && Number(window.__kioskCompleteHoldMs) > 0) holdMs = Math.round(Number(window.__kioskCompleteHoldMs)); } catch (eHold) {}
        setTimeout(function () { if (kioskRun.complete) kioskEndRun(); }, holdMs);
        return;
      }
      // [v46 用户要求] 取消两关之间的「穿越异世界」传送门过场：
      //   记分板走完 → 直接播变身视频（白娘子/小青）→ 播完即进入下一张地图（乙/丙）。
      //   不再出现传送门画面，也不再显示「下一关·角色名」标题文字（视频角标只写「变身」）。
      if (idx === 0) {
        kioskAdvanceWithVideo(1, 'bainiangzi');
        return;
      }
      kioskAdvanceWithVideo(2, 'xiaoqing');
    }
    // 页面变身视频播完回调 → 开下一轮
    try {
      window.__kioskVideoFinished = function () {
        if (!kioskRun.active || !kioskRun.videoPending) return { ok: false };
        var next = kioskRun.index;
        kioskRun.videoPending = '';
        kioskStartCharacter(next);
        return { ok: true, skin: kioskOrder()[next] };
      };
    } catch (e) {}
    // [2026-10-16 需求2] 局部结算：没走到终点（阵亡/中途）时，也按「当下进度」算一次本关得分。
    //   计分公式与 finishRun 完全一致（食物 + 飞行 + 吐舌 + 高度 + 关卡 + 时间 − 放屁/乌鸦扣分），
    //   但**只写分数与明细**：不发奖（awardScore）、不提交排行榜（syncStageLeaderboardScore）、
    //   不累计 runStats.stages —— 那些只在真正通关时做。
    //   修复的病根：此前阵亡直接读 runStats.stageTotalScore，而该值只在通关结算里赋值
    //   （每关开始时被清 0）→ 死亡分数恒为 0。
    function computeKioskStageScoreNow() {
      try {
        if (!runtimeLevel) return Math.max(0, Math.round(Number(runStats.stageTotalScore) || 0));
        var rawFlightScore = Math.max(0, Math.floor((Number(runStats.stageFlightDistance) || 0) * 0.1 / 3));
        var rawTongueScore = Math.max(0, Math.floor(Number(runStats.stageTongueCount) || 0));
        var heightRatio = (runtimeLevel.height - player.y) / Math.max(1, runtimeLevel.height);
        var rawHeightScore = Math.round(clamp(heightRatio, 0, 1) * 100);
        var formalStageNumber = runtimeLevel.isTutorial ? 0 : Math.max(1, stageIndex - MAIN_STAGE_START + 1);
        var rawLevelScore = formalStageNumber * 100;
        var elapsedSec = (nowMs() - (runStats.stageStartTime || nowMs())) / 1000;
        var overtime = Math.max(0, elapsedSec - TIME_SCORE_FULL_SECONDS);
        var rawTimeScore = Math.max(0, Math.round(TIME_SCORE_BASE - overtime * TIME_SCORE_DECAY_PER_SECOND));
        runStats.stageFlightScore = applyRoundScoreBonus(rawFlightScore);
        runStats.stageTongueScore = applyRoundScoreBonus(rawTongueScore);
        runStats.stageHeightScore = applyRoundScoreBonus(rawHeightScore);
        runStats.stageLevelScore = applyRoundScoreBonus(rawLevelScore);
        runStats.stageTimeScore = applyRoundScoreBonus(rawTimeScore);
        runStats.stageTotalScore = Math.max(0, runStats.stageFoodScore + runStats.stageFlightScore +
          runStats.stageTongueScore + runStats.stageHeightScore + runStats.stageLevelScore +
          runStats.stageTimeScore - runStats.stageFartPenalty - runStats.stageCrowPenalty);
        finishState.heightScore = rawHeightScore;
        finishState.stageTotal = runStats.stageTotalScore;
        return runStats.stageTotalScore;
      } catch (eNow) {
        return Math.max(0, Math.round(Number(runStats.stageTotalScore) || 0));
      }
    }
    // 阵亡：先播一下 dizzy 死亡画面，随即回首页（无复活、无广告）。
    function kioskOnDeath(cause) {
      pointerHeld = false;
      try { detachTongue(); } catch (e) {}
      deathTimer = 0; deathLeaderboardShown = false;
      runStats.deaths += 1; runStats.hearts = 0;
      try { triggerHaptic('heavy'); } catch (e) {}
      try { playDeath8BitSound(); } catch (e) {}
      setScene('death');
      kioskRun.dying = true;
      // [2026-10-16 需求2] 落盘前先按当下进度结算一次本关得分（否则恒为 0）。
      try { computeKioskStageScoreNow(); } catch (eScoreNow) {}
      // [2026-10-14 需求2] 失败也出总分结算+排行榜：先把本角色得分落盘（cleared=false），
      //   再把「含三轮明细 + 总分」的 summary 交给页面；页面侧 __kioskOnRunFailed
      //   现在渲染与通关同一套总分记分板 + 云端500强榜（明确写出第几名或没上榜）。
      try {
        var dIdx = clamp(Math.round(Number(kioskRun.index) || 0), 0, kioskOrder().length - 1);
        var dDef = getSkinDef(kioskOrder()[dIdx]) || {};
        kioskRun.results[dIdx] = {
          skinId: dDef.id, skinName: dDef.name,
          score: Math.max(0, Math.round(Number(runStats.stageTotalScore) || 0)), cleared: false
        };
      } catch (eRec) {}
      try {
        if (typeof window !== 'undefined' && window.__kioskOnRunFailed) window.__kioskOnRunFailed(kioskRunSummary(true));
      } catch (e) {}
      // [2026-10-14 需求2] 停留时长与通关一致（页面 __kioskCompleteHoldMs=18s：
      //   死亡画面短暂停留 → 三轮总分结算 → 前500强总榜动画），随后回首页等下一位扫码。
      var deathHoldMs = 18000;
      try { if (typeof window !== 'undefined' && Number(window.__kioskCompleteHoldMs) > 0) deathHoldMs = Math.round(Number(window.__kioskCompleteHoldMs)); } catch (eHold2) {}
      setTimeout(function () { if (kioskRun.active && kioskRun.dying) kioskEndRun(); }, deathHoldMs);
    }
    function victoryPoseForHeightScore(score) {
      score = clamp(Math.round(Number(score) || 0), 0, 100);
      if (score >= 81) return 3;
      if (score >= 61) return 2;
      if (score >= 41) return 4;
      if (score >= 21) return 1;
      return 0;
    }
    function syncStageLeaderboardScore() {
      progress.bestScore = Math.max(Math.max(0, Number(progress.bestScore) || 0), Math.max(0, Math.round(runStats.score || 0)));
      saveProgress();
      if (openDataLeaderboard && openDataLeaderboard.submitHighestScore) {
        try { openDataLeaderboard.submitHighestScore(progress.bestScore); } catch (ignoreOpenDataStage) {}
      }
      var current = null;
      for (var li = 0; li < leaderboard.length; li++) {
        if (leaderboard[li] && leaderboard[li].playerId === playerProfile.playerId) { current = leaderboard[li]; break; }
      }
      if (!current) {
        current = { id: 'stage_' + playerProfile.playerId, playerId: playerProfile.playerId, createdAt: nowMs() };
        leaderboard.push(current);
      }
      current.nickName = playerProfile.nickName;
      current.avatarUrl = playerProfile.avatarUrl;
      current.score = progress.bestScore;
      current.bestScore = progress.bestScore;
      current.food = Math.max(0, Math.round(Number(progress.totalFood) || 0));
      current.stages = Math.max(Number(current.stages) || 0, runStats.stages + 1);
      current.updatedAt = nowMs();
      current.isCurrent = true;
      sortLeaderboard(leaderboard);
      leaderboard = leaderboard.slice(0, LEADERBOARD_LIMIT);
      leaderboardDataVersion++;
      saveLeaderboard();
    }

    function finishRun() {
      if (scene !== 'playing') return;
      if (runtimeLevel && runtimeLevel.isTutorial && !tutorialStageReadyForFinish()) {
        showTutorialFinishBlockedPrompt();
        return;
      }
      pointerHeld = false; detachTongue();

      if (runtimeLevel.isTutorial) {
        runStats.stages += 1;
        finishState.tutorialPoints = tutorialTasksForLevel(runtimeLevel);
        finishState.tallyComplete = false;
        finishState.tallyTimer = 0;
        setScene('finish_slowmo');
        finishState.timer = 0; finishState.zoom = 1;
        finishState.poseIndex = 0; finishState.confettiTimer = 0;
        player.vx = Math.max(player.vx, 260); player.vy *= 0.2; player.spin = 0;
        for (var ti = 0; ti < 44; ti++) spawnParticle(player.x, player.y - 10, 0, true, ['#ff6688', '#ffd85f', '#85f3c0', '#8bd8ff'][ti % 4]);
        triggerHaptic('medium'); setTimeout(function () { triggerHaptic('medium', true); }, 100); setTimeout(function () { triggerHaptic('medium', true); }, 200); setTimeout(function () { triggerHaptic('medium', true); }, 300); setTimeout(function () { triggerHaptic('medium', true); }, 400);
        playApplauseSound(); sayVoice('过关啦');
        return;
      }

      var rawFlightScore = Math.max(0, Math.floor(runStats.stageFlightDistance * 0.1 / 3));
      var rawTongueScore = Math.max(0, Math.floor(runStats.stageTongueCount));
      var heightRatio = (runtimeLevel.height - player.y) / Math.max(1, runtimeLevel.height);
      var rawHeightScore = Math.round(clamp(heightRatio, 0, 1) * 100);
      var formalStageNumber = runtimeLevel.isTutorial ? 0 : Math.max(1, stageIndex - MAIN_STAGE_START + 1);
      var rawLevelScore = formalStageNumber * 100;
      var elapsedSec = (nowMs() - (runStats.stageStartTime || nowMs())) / 1000;
      var overtime = Math.max(0, elapsedSec - TIME_SCORE_FULL_SECONDS);
      var rawTimeScore = Math.max(0, Math.round(TIME_SCORE_BASE - overtime * TIME_SCORE_DECAY_PER_SECOND));
      runStats.stageFlightScore = applyRoundScoreBonus(rawFlightScore);
      runStats.stageTongueScore = applyRoundScoreBonus(rawTongueScore);
      runStats.stageHeightScore = applyRoundScoreBonus(rawHeightScore);
      runStats.stageLevelScore = applyRoundScoreBonus(rawLevelScore);
      runStats.stageTimeScore = applyRoundScoreBonus(rawTimeScore);
      runStats.stageTotalScore = Math.max(0, runStats.stageFoodScore + runStats.stageFlightScore +
        runStats.stageTongueScore + runStats.stageHeightScore + runStats.stageLevelScore +
        runStats.stageTimeScore - runStats.stageFartPenalty - runStats.stageCrowPenalty);

      runStats.flightScore += runStats.stageFlightScore;
      runStats.tongueScore += runStats.stageTongueScore;
      runStats.heightScore += runStats.stageHeightScore;
      runStats.levelScore += runStats.stageLevelScore;

      var deferredScore = runStats.stageFlightScore + runStats.stageTongueScore +
        runStats.stageHeightScore + runStats.stageLevelScore + runStats.stageTimeScore;
      awardScore(deferredScore, '', undefined, undefined, true);
      syncStageLeaderboardScore();
      runStats.stages += 1;
      markFirstSequenceStageCleared(stageIndex);
      // 每日任务：通关 1 个正式关卡 → +1 黄金番薯（每天限 1 次）。
      try { creditDailyTask('clear_level'); } catch (ignoreClearTask) {}
      // 每日任务「完成 1 局」：通关打完一局也计（阵亡路径在 soul_departure 分支）→ +1（每天限 1 次）。
      try { creditDailyTask('play_run'); } catch (ignorePlayTask2) {}
      // [2026-10-14 v31] 现场闯关期间不写「下一轮目标」——round 由 kioskStartCharacter 钉死为 1。
      if (!kioskRun.active && isFinalFormalStage(stageIndex)) {
        progress.pendingRoundTarget = Math.max(currentRoundNumber() + 1, Math.round(Number(progress.pendingRoundTarget) || 0));
        saveProgress();
      }

      finishState.heightScore = rawHeightScore;
      finishState.heightBand = clamp(Math.ceil(rawHeightScore / 20) - 1, 0, 4);
      finishState.clearBonus = deferredScore;
      finishState.stageTotal = runStats.stageTotalScore;
      finishState.scoreItems = [
        { en: '25 POINTS · GOLDEN 50', cn: '食物得分', value: runStats.stageFoodScore, icon: 'food' },
        { en: 'FLIGHT DISTANCE ×0.1 ÷3', cn: '飞行距离分', value: runStats.stageFlightScore, icon: 'flight' },
        { en: 'TONGUE COUNT · 1 PT EACH', cn: '吐舌次数分', value: runStats.stageTongueScore, icon: 'tongue' },
        { en: 'FINISH HEIGHT BONUS', cn: '终点高度分', value: runStats.stageHeightScore, icon: 'height' },
        { en: 'LEVEL DIFFICULTY BONUS', cn: '关卡难度分', value: runStats.stageLevelScore, icon: 'difficulty' },
        (function() {
          var deducted = TIME_SCORE_BASE - rawTimeScore;
          var timeEn = elapsedSec <= TIME_SCORE_FULL_SECONDS
            ? 'BASE 500 · ' + elapsedSec.toFixed(1) + 's PERFECT'
            : 'BASE 500 · ' + elapsedSec.toFixed(1) + 's  -' + deducted;
          return { en: timeEn, cn: '时间分（500起）', value: runStats.stageTimeScore, icon: 'time' };
        })(),
        { en: 'CROW HIT · -50 EACH', cn: '乌鸦扣分', value: -runStats.stageCrowPenalty, penalty: true, icon: 'crow' },
        { en: 'FART BOOST · -100 EACH', cn: '放屁扣分', value: -runStats.stageFartPenalty, penalty: true, icon: 'fart' },
        { en: 'TOTAL SCORE', cn: '总分', value: runStats.stageTotalScore, total: true, icon: 'total' }
      ];
      finishState.tallyValues = [0,0,0,0,0,0,0,0,0];
      finishState.tallyComplete = false;

      runStats.combo = 0; runStats.multiplier = 1; runStats.comboTimer = 0;
      setScene('finish_slowmo');
      finishState.timer = 0; finishState.zoom = 1; finishState.poseIndex = victoryPoseForHeightScore(rawHeightScore); finishState.confettiTimer = 0;
      player.vx = Math.max(player.vx, 260); player.vy *= 0.2; player.spin = 0;
      for (var i = 0; i < 44; i++) spawnParticle(player.x, player.y-10, 0, true, ['#ff6688','#ffd85f','#85f3c0','#8bd8ff'][i%4]);
      triggerHaptic('medium'); setTimeout(function() { triggerHaptic('medium', true); }, 100); setTimeout(function() { triggerHaptic('medium', true); }, 200); setTimeout(function() { triggerHaptic('medium', true); }, 300); setTimeout(function() { triggerHaptic('medium', true); }, 400);
      playApplauseSound(); sayVoice('过关啦');
    }

    function primeTongue() {
      if (!player || player.attachIndex !== null || player.skillInputLock > 0) return;
      runStats.stageTongueCount += 1;
      try {
        var cand = getAnchorCandidate();
        player.pendingAttachIndex = cand ? cand.index : null;
        player.pendingAimAngle = cand ? directionAngle(runtimeLevel.anchors[cand.index].x - player.x, runtimeLevel.anchors[cand.index].y - player.y) : player.angle;
        player.pressOpenDuration = PRESS_OPEN_DURATION; player.pressOpenTimer = PRESS_OPEN_DURATION; player.mouthOpen = 0.45;
        var mouth = getMouthWorld(), aim = player.pendingAimAngle != null ? player.pendingAimAngle : player.angle;
        var target = cand ? { x: runtimeLevel.anchors[cand.index].x, y: runtimeLevel.anchors[cand.index].y } : { x: mouth.x + Math.sin(aim)*170, y: mouth.y - Math.cos(aim)*170 };
        if (tutorialTaskIs('auto_target')) {
          tutorialFlow.tapGuideIndex = cand ? cand.index : -1;
          tutorialFlow.tapGuideTimer = 0.35;
        }
        tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: target.x, targetY: target.y, invert: false, aimAngle: aim };
      } catch (e) { console.error('primeTongue error:', e && e.message); }
      try { playTongueSound('extend'); } catch (e) {}
    }
    function attachTongue(forcedIndex) {
      if (!player || player.attachIndex !== null) return;
      // 小青·超级贪吃：正在伸舌够食物的过程中不挂锚点 —— 同一时刻只允许存在一根舌头。
      if (greedyTongueActive() && greedyShot.phase !== 'idle') return;
      try {
        var cand = null;
        if (typeof forcedIndex === 'number' && runtimeLevel.anchors[forcedIndex]) { var a = runtimeLevel.anchors[forcedIndex]; cand = { index: forcedIndex, distance: Math.hypot(a.x-player.x, a.y-player.y) }; }
        else cand = getAnchorCandidate();
        player.pressOpenTimer = 0;
        if (!cand) { player.pendingAttachIndex = null; player.pendingAimAngle = null; return; }
        player.attachIndex = cand.index; player.pendingAttachIndex = null; player.pendingAimAngle = null; player.verticalTongueTimer = 0; player.attachHoldTime = 0; player.tongueFailTimer = 0;
        tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
        player.ropeLength = Math.max(58, cand.distance * 0.93); player.attachSnapDuration = 0.10; player.attachSnapTimer = 0.10;
        player.mouthOpen = 1;
        noteTutorialAnchorConnected(cand.index);
      } catch (e) { console.error('attachTongue error:', e && e.message); }
      try { playTongueSound('attach'); } catch (e) {}
      triggerHaptic('medium');
    }
    function detachTongue() {
      if (!player) return;
      var target = null, aimAngle = player.angle;
      try {
        var mouth = getMouthWorld();
        if (player.attachIndex !== null && runtimeLevel.anchors[player.attachIndex]) {
          var a = runtimeLevel.anchors[player.attachIndex]; target = { x: a.x, y: a.y };
          // 2026-10-09 修正：松手回收时脸朝「刚松开的锚点」——舌根从锚点侧收回进嘴，方向自然。
          // 此前兜底 tongueFx.aimAngle || player.angle：attachTongue 把 aimAngle 清成 0（falsy），
          // 实际落到翻滚累积的 player.angle（随机垃圾角）→ 回收瞬间头朝乱方向、舌从背侧收回。
          aimAngle = directionAngle(a.x - player.x, a.y - player.y);
        }
        else if (tongueFx.mode === 'extend') target = { x: tongueFx.targetX, y: tongueFx.targetY };
        if (target === null) aimAngle = player.pendingAimAngle != null ? player.pendingAimAngle : (tongueFx.aimAngle || player.angle);
      } catch (e) { console.error('detachTongue prep error:', e && e.message); }
      player.attachIndex = null; player.pendingAttachIndex = null; player.pendingAimAngle = null; player.pressOpenTimer = 0; player.mouthOpen = 0; player.verticalTongueTimer = 0; player.tongueFailTimer = 0;
      if (target) tongueFx = { mode: 'retract', timer: TONGUE_RETRACT_DURATION, duration: TONGUE_RETRACT_DURATION, targetX: target.x, targetY: target.y, invert: true, aimAngle: aimAngle };
      try { playTongueSound('detach'); } catch (e) {}
      triggerHaptic('light');
    }
    function releaseVerticalTongue(anchor) {
      if (!player || player.attachIndex === null || !anchor) return;
      var mouth = getMouthWorld();
      var aimAngle = directionAngle(anchor.x - player.x, anchor.y - player.y);
      player.attachIndex = null; player.pendingAttachIndex = null; player.pendingAimAngle = null;
      player.pressOpenTimer = 0; player.mouthOpen = 0; player.verticalTongueTimer = 0; player.tongueFailTimer = 0;
      pointerHeld = false;
      tongueFx = {
        mode: 'limp', timer: LIMP_TONGUE_DURATION, duration: LIMP_TONGUE_DURATION,
        targetX: anchor.x, targetY: anchor.y, startX: mouth.x, startY: mouth.y,
        invert: false, aimAngle: aimAngle
      };
      try { playTongueSound('detach'); } catch (e) {}
    }

    function getAnchorCandidate() {
      var best = null, bestScore = Infinity;
      for (var i = 0; i < runtimeLevel.anchors.length; i++) {
        var a = runtimeLevel.anchors[i], dx = a.x-player.x, dy = a.y-player.y, d = Math.hypot(dx,dy);
        if (d > 360 || dx < -180 || dy > 250) continue;
        var score = d; // 自动选择当前可连接范围内的最近支点
        if (score < bestScore) { bestScore = score; best = { index: i, distance: d }; }
      }
      return best;
    }
    function getPlayerVisual() {
      var angle = player ? player.angle : 0, mode = 'curl';
      if (player && (scene === 'death' || scene === 'soul_departure' || scene === 'game_over')) { mode = 'dizzy'; }
      else if (player && (scene === 'finish_slowmo' || scene === 'score_tally')) { angle = normalizeAngle(player.angle + player.animTime * 1.8); mode = 'victory'; }
      // 2026-10-05 蝠侠·滑翔：正在滑翔 → 用展翼专用立绘。
      // 优先级：高于 curl（滑翔时不该用翻滚表），但**低于挂锚点/瞄准/吐舌** ——
      // 用户要求「使用锚点时恢复正常」，所以 attachIndex 分支必须排在 glide 前面。
      else if (player && player.attachIndex !== null) {
        var t = runtimeLevel.anchors[player.attachIndex];
        if (t) {
          // 经典约定：附挂 = 被舌头吊住 → 头朝支点方向（舌头自然从嘴里连向锚点，绝不穿身）。
          // 2026-10-09 下午：曾试过「头朝运动速度方向（attachFaceVelocity）」，实测舌头穿身、
          //   折返点残留 180° 朝向 → 用户反馈方向乱，已回退（详见 SKIN_DEFS.bat 注释）。
          angle = directionAngle(t.x-player.x, t.y-player.y); mode = 'air';
        } else { player.attachIndex = null; }
      }
      else if (player && (Number(player.gliding) || 0) > 0) { mode = 'glide'; }
      else if (player && player.pressOpenTimer > 0 && player.pendingAimAngle !== null) { angle = player.pendingAimAngle; mode = 'air'; }
      else if (player && (tongueFx.mode === 'retract' || tongueFx.mode === 'rebound' || tongueFx.mode === 'limp')) { angle = tongueFx.aimAngle != null ? tongueFx.aimAngle : player.angle; mode = 'air'; }
      // 2026-10-05 蝠侠：取消经典阿蜥替代图 —— 没有专属 360 表（SKIN_SPRITE_SPECS 未注册）的皮肤，
      // 空中姿态（挂锚点/瞄准/吐舌回收）一律改画自己的翻滚表（新图）。若将来给 bat 注册专属 360 表，本行自动失效。
      // 2026-10-05 修正：classic 走 sprite.manifest（axi_tongue 360 表），必须排除，否则原版阿蜥空中姿态被误切成翻滚球。
      var _airSkinId = activeSkinId();
      if (mode === 'air' && _airSkinId !== 'classic' && !skinSpriteManifests[_airSkinId]) mode = 'curl';
      var fi = angleToFrame(angle);
      var spriteCount = Math.max(1, Number(sprite && sprite.manifest && sprite.manifest.frameCount) || 24);
      var sampledSpriteAngle = fi / spriteCount * Math.PI * 2;
      // 主姿态同样补上离散帧之间的剩余角度，使吐舌瞄准与空中姿态连续旋转，不再在15度边界跳变。
      var spriteRotationOffset = shortestAngleDelta(sampledSpriteAngle, normalizeAngle(angle));
      var curlCount = Math.max(1, Number(curlConfig && curlConfig.frameCount) || 24);
      var curlAngle = normalizeAngle(player ? player.angle : 0);
      var curlFrameFloat = curlAngle / (Math.PI * 2) * curlCount;
      var cf = Math.round(curlFrameFloat) % curlCount;
      // 精灵帧只负责姿态细节，剩余的子帧角度由画布连续旋转补足。
      // 这样不再等待角色每转过 10 度才更新画面，同时仍只绘制一次精灵，避免增加帧开销。
      var sampledCurlAngle = cf / curlCount * Math.PI * 2;
      var curlRotationOffset = shortestAngleDelta(sampledCurlAngle, curlAngle);
      var scale = mode === 'dizzy' ? 0.448 : (scene === 'finish_slowmo' ? 0.78 : 0.74);
      return { angle: angle, frameIndex: fi, spriteRotationOffset: spriteRotationOffset, curlFrame: cf, curlRotationOffset: curlRotationOffset, scale: scale, mode: mode };
    }
    function getMouthWorld() {
      var v = getPlayerVisual(), m = currentSpriteManifest();
      var fw = m.logicalFrameWidth || m.frameWidth || 128, fh = m.logicalFrameHeight || m.frameHeight || 128;
      var anchors = m.mouthAnchors || [], anchor = anchors[v.frameIndex] || { x: fw*0.5, y: fh*0.24 };
      // 2026-10-05 用户要求：薯王 360 图绘制缩小为 90% → 吐舌起点锚点随同收缩，避免舌头悬空在头尖外。
      // 2026-10-05 晚：蝠侠翻滚球放大为 1.2 倍 → 吐舌起点随球缘同步外扩（否则舌根缩进球里 6~7px）。
      // 2026-10-09 修正：蝠侠接入真实 360 表后姿态分两路 —— 空中姿态走 360 表（绘制缩放 1，
      //   见 render skin360DrawScale），团身球仍走 curl 表（缩放 1.2，见 skinCurlDrawScale）。
      //   所以 mouthK 必须按当前姿态取，固定 1.2 会把空中吐舌起点外扩 20%（舌头从脸前飘出去）。
      var _mouthSkinId = activeSkinId();
      var mouthK = _mouthSkinId === 'potato' ? 0.90 : (_mouthSkinId === 'bat' ? (v.mode === 'curl' ? 1.2 : 1) : 1);
      var ox = (anchor.x - fw*0.5) * v.scale * mouthK, oy = (anchor.y - fh*0.5) * v.scale * mouthK;
      var rr = Number(v.spriteRotationOffset) || 0, rc = Math.cos(rr), rs = Math.sin(rr);
      return { x: player.x + rc*ox - rs*oy, y: player.y + rs*ox + rc*oy };
    }

    function markHit(nx, ny, intensity) {
      if (!player) return;
      nx = Number(nx) || 0; ny = Number(ny) || 0;
      var len = Math.hypot(nx, ny);
      if (len < 0.001) {
        var speed = Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0);
        if (speed > 0.001) { nx = -(Number(player.vx) || 0) / speed; ny = -(Number(player.vy) || 0) / speed; }
        else { nx = 1; ny = 0; }
      } else { nx /= len; ny /= len; }
      player.hitDuration = 0.18;
      player.hitTimer = player.hitDuration;
      player.hitNormalX = nx;
      player.hitNormalY = ny;
      player.hitIntensity = clamp(Number(intensity) || 1, 0.55, 1.35);
    }
    function isUnderwaterAt(y) {
      if (!runtimeLevel || !runtimeLevel.underwater) return false;
      var surface = Number(runtimeLevel.waterSurfaceY);
      if (!isFinite(surface)) surface = VIEW_H * 0.5;
      return Number(y) >= surface;
    }
    function segmentPointDistance(x1,y1,x2,y2,px,py) {
      var dx=x2-x1, dy=y2-y1, lenSq=dx*dx+dy*dy;
      var t = lenSq ? clamp(((px-x1)*dx+(py-y1)*dy)/lenSq, 0, 1) : 0;
      return Math.hypot(px-(x1+dx*t), py-(y1+dy*t));
    }
    function collideWall(wall) {
      if (!wall || wall.removed || (wall.oneShot && wall.used)) return;
      if (isPotatoPhaseActive()) return;
      var nX = clamp(player.x, wall.x, wall.x+wall.w), nY = clamp(player.y, wall.y, wall.y+wall.h);
      var dx = player.x-nX, dy = player.y-nY, d = Math.hypot(dx,dy);
      if (d >= player.r || d === 0) return;
      var nx=dx/d, ny=dy/d;
      var landedOnTop = ny < -0.55 && player.vy >= 0;
      var fixedWallBounceApplied = false;
      var appliedWallBounceSpeed = 0;
      player.x = nX+nx*player.r; player.y = nY+ny*player.r;
      var dot = player.vx*nx + player.vy*ny;
      if (wall.spring) {
        wall.springAnim = wall.powerSpring ? 1.25 : 1;
        wall.springAnimVelocity = wall.powerSpring ? -7.5 : -5.5;
        noteTutorialPropInteraction(wall.tutorialPropType || (wall.powerSpring ? 'power_spring' : 'spring'), wall);
        if (wall.axis === 'vertical') {
          var dir = player.x < wall.x+wall.w*0.5 ? -1 : 1;
          var verticalLaunch = clamp(
            (Math.abs(player.vx) * wall.bounce + 150) * VERTICAL_SPRING_SCALE,
            VERTICAL_SPRING_MIN_SPEED,
            VERTICAL_SPRING_MAX_SPEED
          );
          player.vx = dir * verticalLaunch;
          player.vy *= 0.70;
        } else {
          var horizontalLaunch = clamp(
            (Math.abs(player.vy) * wall.bounce + 130) * HORIZONTAL_SPRING_SCALE,
            HORIZONTAL_SPRING_MIN_SPEED,
            HORIZONTAL_SPRING_MAX_SPEED
          );
          if (wall.powerSpring) horizontalLaunch = Math.min(1750, horizontalLaunch * POWER_SPRING_MULTIPLIER);
          player.vy = -horizontalLaunch;
          player.vx += HORIZONTAL_SPRING_PUSH * (wall.powerSpring ? (POWER_SPRING_MULTIPLIER * 0.9) : 1);
        }
        if (wall.oneShot) {
          wall.used = true;
          wall.disappearTimer = 0.46;
        }
      } else if (dot < 0) {
        var stumpBounce = wall.axis === 'horizontal' ? HORIZONTAL_STUMP_BOUNCE : STUMP_BOUNCE;
        var stumpMinBounceSpeed = wall.axis === 'horizontal' ? HORIZONTAL_STUMP_MIN_BOUNCE_SPEED : STUMP_MIN_BOUNCE_SPEED;
        var wallBounceScale = wall.axis === 'vertical' ? VERTICAL_WALL_BOUNCE_SCALE : HORIZONTAL_WALL_BOUNCE_SCALE;
        var wallMinBounceSpeed = wall.axis === 'vertical' ? VERTICAL_WALL_MIN_BOUNCE_SPEED : HORIZONTAL_WALL_MIN_BOUNCE_SPEED;
        var sourceWallBounce = clamp(Number(wall.bounce) || WALL_BOUNCE, 0.05, 1.8);
        var enhancedWallBounce = clamp(sourceWallBounce * wallBounceScale, WALL_BOUNCE, 1.9);
        var solidBounce = wall.material === 'stump' ? stumpBounce : enhancedWallBounce;
        var tangentDamping = wall.material === 'stump' ? STUMP_TANGENTIAL_DAMPING : WALL_TANGENTIAL_DAMPING;
        var incomingNormalSpeed = -dot;
        var outgoingNormalSpeed = incomingNormalSpeed * solidBounce;
        if (wall.material === 'stump' && incomingNormalSpeed >= SOLID_MIN_CONTACT_SPEED) {
          outgoingNormalSpeed = Math.max(outgoingNormalSpeed, stumpMinBounceSpeed);
        } else if (wall.material !== 'stump') {
          outgoingNormalSpeed = Math.max(outgoingNormalSpeed, wallMinBounceSpeed);
          appliedWallBounceSpeed = outgoingNormalSpeed;
          fixedWallBounceApplied = true;
        }
        var normalImpulse = incomingNormalSpeed + outgoingNormalSpeed;
        player.vx += normalImpulse * nx;
        player.vy += normalImpulse * ny;
        if (tangentDamping < 1) {
          var tx = -ny, ty = nx;
          var tangentSpeed = player.vx * tx + player.vy * ty;
          player.vx += tangentSpeed * (tangentDamping - 1) * tx;
          player.vy += tangentSpeed * (tangentDamping - 1) * ty;
        }
      }
      if (isUnderwaterAt(player.y)) {
        var wallWaterScale = clamp(Number(runtimeLevel.collisionVelocityScale) || 0.72, 0.35, 1);
        if (fixedWallBounceApplied) {
          var waterTx = -ny, waterTy = nx;
          var waterTangentSpeed = (player.vx * waterTx + player.vy * waterTy) * wallWaterScale;
          player.vx = nx * appliedWallBounceSpeed + waterTx * waterTangentSpeed;
          player.vy = ny * appliedWallBounceSpeed + waterTy * waterTangentSpeed;
        } else {
          player.vx *= wallWaterScale; player.vy *= wallWaterScale;
        }
      }
      var intensity = clamp(Math.hypot(player.vx,player.vy)/700, 0.45, 1.5);
      markHit(nx, ny, intensity);
      playCollisionSound(wall.spring ? 'bumper' : 'wall', intensity);
      triggerHaptic(wall.powerSpring ? 'heavy' : (wall.spring ? 'medium' : 'light'));
      if (wall.spring) {
        var cx=clamp(player.x,wall.x,wall.x+wall.w), cy=clamp(player.y,wall.y,wall.y+wall.h);
        var particleColor = wall.powerSpring ? '#ff9df2' : (wall.oneShot ? '#c7b0ff' : (wall.axis==='vertical'?'#9eeaff':'#ffe69a'));
        for (var i=0;i<(wall.powerSpring?16:10);i++) spawnParticle(cx,cy,0,false,particleColor);
      }
    }

    function collideBumper(bumper) {
      if (isPotatoPhaseActive()) return;
      var d = dist(player.x,player.y,bumper.x,bumper.y), min = player.r+bumper.r;
      if (d >= min || d === 0) return;
      var nx=(player.x-bumper.x)/d, ny=(player.y-bumper.y)/d;
      player.x = bumper.x+nx*min; player.y = bumper.y+ny*min;
      var sp = Math.max(340, Math.hypot(player.vx,player.vy));
      var tutorialPropResult = noteTutorialPropInteraction(bumper.tutorialPropType || (bumper.hazard ? 'hazard' : 'bumper'), bumper);
      if (tutorialPropResult === 'reset') return;
      if (bumper.hazard) {
        player.vx = nx*Math.max(300, sp*0.92)+30; player.vy = ny*Math.max(300, sp*0.92)-20;
        markHit(nx, ny, 1.18); playCollisionSound('wall', 0.9); triggerHaptic('heavy');
        for (var i=0;i<12;i++) spawnParticle(bumper.x,bumper.y,0,false,'#ff96aa'); return;
      }
      var bumperMultiplier = clamp(Number(bumper.power) || 1, 0.1, BUMPER_MAX_MULTIPLIER);
      var bumperLaunchSpeed = Math.min(BUMPER_MAX_BOUNCE_SPEED, sp * bumperMultiplier * BUMPER_POWER_SCALE);
      player.vx = nx * bumperLaunchSpeed + 90;
      player.vy = ny * bumperLaunchSpeed - 60;
      var bumperResultSpeed = Math.hypot(player.vx, player.vy);
      if (bumperResultSpeed > BUMPER_MAX_BOUNCE_SPEED) {
        player.vx *= BUMPER_MAX_BOUNCE_SPEED / bumperResultSpeed;
        player.vy *= BUMPER_MAX_BOUNCE_SPEED / bumperResultSpeed;
      }
      if (isUnderwaterAt(player.y)) {
        var bumperWaterScale = clamp(Number(runtimeLevel.collisionVelocityScale) || 0.72, 0.35, 1);
        player.vx *= bumperWaterScale; player.vy *= bumperWaterScale;
      }
      var intensity = clamp(Math.hypot(player.vx,player.vy)/700, 0.55, 1.3);
      markHit(nx, ny, intensity);
      playCollisionSound('bumper', intensity);
      triggerHaptic('medium');
      for (var j=0;j<10;j++) spawnParticle(bumper.x,bumper.y,0,false,'#ffe28b');
    }
    function collectFood(food) {
      food.collected = true;
      if (runStats.collectedFoodKinds.indexOf(food.kind) === -1) runStats.collectedFoodKinds.push(food.kind);
      var isGolden = !!(food.skillItem || food.kind === 'golden_sweet_potato');
      var foodInfo = FOOD_LIBRARY[food.kind] || null;
      // 2026-10-01：雄黄酒是高分彩蛋，分数以 FOOD_LIBRARY 为准（默认 25 会把彩蛋奖励吃掉）。
      var base = isGolden ? GOLDEN_SWEET_POTATO_POINTS
        : (foodInfo && Number(foodInfo.points) ? Number(foodInfo.points) : NORMAL_FOOD_POINTS);
      var foodName = foodInfo && foodInfo.label ? foodInfo.label : '食物';

      // 2026-10-01 彩蛋：白娘子/小青 在杭州关吃到雄黄酒 → 变蛇飞行 5 秒。
      if (food.kind === 'xionghuangjiu' && canTransformSnake()) beginSnakeForm();

      runStats.food += 1;
      progress.totalFood = Math.max(0, Math.round(Number(progress.totalFood) || 0)) + 1;

      if (isGolden) {
        goldenSkillState.points += 1;
        if (kioskRun.active) kioskRun.potatoes = goldenSkillState.points;   // [2026-10-17] 现场拾取场上番薯也并入共用池（否则下轮开局被 reset 冲掉）
        var goldenAward = awardScore(base, '黄金蕃薯', food.x, food.y - 12, true);
        runStats.stageFoodScore += goldenAward;
        runStats.foodScore += goldenAward;
        for (var gi = 0; gi < 18; gi++) spawnParticle(food.x, food.y, 0, false, gi % 2 ? '#ffd85f' : '#fff2a8');
        playFoodSound();
        triggerHaptic('medium');
        return;
      }

      runStats.combo = runStats.comboTimer > 0 ? runStats.combo + 1 : 1;
      runStats.comboTimer = comboWindowSeconds();
      runStats.multiplier = Math.min(4, 1 + Math.floor((runStats.combo - 1) / 3));
      var foodAward = awardScore(base, foodName, food.x, food.y - 10, true);
      runStats.stageFoodScore += foodAward;
      runStats.foodScore += foodAward;
      for (var i=0;i<8;i++) spawnParticle(food.x,food.y,0,false,'#fff7bb');
      playFoodSound();
      triggerHaptic('light');
    }
    function spawnParticle(x,y,hue,confetti,color) {
      hue=hue||0; confetti=confetti||false; color=color||'#ffffff';
      if (particles.length >= PARTICLE_LIMIT) return;
      if (PARTICLE_EMISSION_SCALE < 1 && Math.random() > PARTICLE_EMISSION_SCALE) return;
      var angle=Math.random()*Math.PI*2, speed=confetti?90+Math.random()*200:40+Math.random()*120;
      particles.push({ x:x,y:y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-50, age:0, life:confetti?1.2:0.7,
        r:confetti?4+Math.random()*4:2+Math.random()*4, confetti:confetti, color:color, rot:Math.random()*Math.PI });
    }
    function updateParticles(dt) {
      var write = 0;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 4;
        // 2026-10-08：粒子可选自定义重力 / 阻尼（蛇娘的云雾要缓缓上飘并堆积，用 grav<0 + 大 drag）。
        if (p.drag) { var keep = Math.max(0, 1 - Number(p.drag) * dt); p.vx *= keep; p.vy *= keep; }
        p.vy += (p.grav === undefined ? 240 : Number(p.grav)) * dt;
        if (p.age < p.life) particles[write++] = p;
      }
      particles.length = write;
    }

    // =====================================================================
    // 2026-10-01 杭州 · 雄黄酒彩蛋：变蛇飞行
    // =====================================================================
    function beginSnakeForm() {
      if (!player || snakeForm.active) return false;
      try { detachTongue(); } catch (e) {}
      try { resetGreedyShot(); } catch (e) {}   // 2026-10-13 红线修复：清掉残留的贪吃舌状态，避免蛇形期间拖出长舌线
      pointerHeld = false;
      var kind = snakeKindForSkin();
      snakeForm.active = true;
      snakeForm.kind = kind;
      snakeForm.timer = SNAKE_FORM_DURATION;
      snakeForm.duration = SNAKE_FORM_DURATION;
      snakeForm.headX = player.x; snakeForm.headY = player.y;
      snakeForm.vx = player.vx; snakeForm.vy = player.vy;
      snakeForm.facing = player.vx >= 0 ? 1 : -1;
      snakeForm.phase = 0; snakeForm.particleTimer = 0;
      // 【真蛇 V1】用 real_snake_runtime 初始化骨骼链（heading/wanderAngle/segments）。
      realSnake.start(snakeForm, Math.random, {segmentCount:SNAKE_FORM_SEGMENTS, segmentGap:SNAKE_FORM_SEGMENT_GAP});
      var tint = kind === 'qing' ? '#7ce0a8' : '#eaf6ff';
      for (var p = 0; p < 28; p++) spawnParticle(player.x, player.y, 0, false, p % 3 === 0 ? '#fff7bb' : tint);
      screenShake = Math.max(screenShake, 0.55);
      triggerHaptic('heavy');
      // [v86 用户要求] 变蛇提示大字整句取消（含「白蛇/青蛇现身」与后续说明）——不再弹出。
      // 变蛇机制本身不变：点一下随机换向、撞弹跳轻弹照旧。
      return true;
    }
    function endSnakeForm() {
      if (!snakeForm.active) return;
      var kind = snakeForm.kind;
      snakeForm.active = false;
      if (player) {
        player.x = snakeForm.headX; player.y = snakeForm.headY;
        player.vx = clamp(snakeForm.vx, -430, 430);
        player.vy = clamp(snakeForm.vy, -430, 640);
        player.attachIndex = null; player.mouthOpen = 0;
        player.pendingAttachIndex = null; player.pendingAimAngle = null;
        tongueFx = { mode: 'none', timer: 0, duration: 0, targetX: 0, targetY: 0, invert: false, aimAngle: 0 };
      }
      var tint2 = kind === 'qing' ? '#2f9e63' : '#8fc9ff';
      for (var p2 = 0; p2 < 20; p2++) spawnParticle(snakeForm.headX, snakeForm.headY, 0, false, tint2);
      snakeForm.segments = [];
    }
    // 2026-10-12：蛇形态操控改为「保持同一方向飞行；每点按一下屏幕立即随机换方向；取消每秒自动换向」。
    // 撞到弹跳道具（bumper / 弹簧）会轻弹，但弹跳系数不高（SNAKE_FORM_BOUNCE_COEF < 1）。
    function updateSnakeForm(dt) {
      if (!snakeForm.active || !player || !runtimeLevel) return;
      var motionDt = Math.max(0.0001, dt * currentRoundPhysicsSpeedMultiplier());
      snakeForm.timer -= dt;
      snakeForm.phase += dt;
      // 【真蛇 V1】平滑转向：heading 以有限角速度向 wanderAngle 靠拢；点屏只改 wanderAngle。
      var turnDiff = shortestAngleDelta(snakeForm.heading, snakeForm.wanderAngle);
      var maxTurn = SNAKE_FORM_TURN_SPEED * motionDt;
      snakeForm.heading = Math.atan2(
        Math.sin(snakeForm.heading + clamp(turnDiff, -maxTurn, maxTurn)),
        Math.cos(snakeForm.heading + clamp(turnDiff, -maxTurn, maxTurn))
      );
      var ang = snakeForm.heading;
      var base = SNAKE_FORM_FORWARD_SPEED * motionDt;
      var stepX = Math.cos(ang) * base;
      var stepY = Math.sin(ang) * base;
      snakeForm.headX += stepX; snakeForm.headY += stepY;
      snakeForm.vx = stepX / motionDt; snakeForm.vy = stepY / motionDt;
      snakeForm.facing = stepX >= 0 ? 1 : -1;
      // —— 变蛇期间撞弹跳道具轻弹（低系数）—— 用自由飞行速度做反射，反射后重设 wanderAngle ——
      var svx = Math.cos(snakeForm.heading) * SNAKE_FORM_FORWARD_SPEED;
      var svy = Math.sin(snakeForm.heading) * SNAKE_FORM_FORWARD_SPEED;
      var snakeBounced = false;
      // 圆形弹跳道具（bumper，含 hazard）—— 仍会轻弹（变蛇期间无敌，不会因 hazard 阵亡）
      var snakeBumpers = querySpatial('bumpers', snakeForm.headX - 96, snakeForm.headX + 96, spatialBumpersQuery);
      for (var bi = 0; bi < snakeBumpers.length; bi++) {
        var bmp = snakeBumpers[bi];
        if (!bmp) continue;
        var bdx = snakeForm.headX - bmp.x, bdy = snakeForm.headY - bmp.y;
        var bd = Math.hypot(bdx, bdy) || 0.0001;
        var bmin = player.r + bmp.r;
        if (bd < bmin) {
          var bnx = bdx / bd, bny = bdy / bd;            // 由道具指向蛇（外侧）
          snakeForm.headX = bmp.x + bnx * bmin;
          snakeForm.headY = bmp.y + bny * bmin;
          var bvdotn = svx * bnx + svy * bny;
          svx = (svx - 2 * bvdotn * bnx) * SNAKE_FORM_BOUNCE_COEF;
          svy = (svy - 2 * bvdotn * bny) * SNAKE_FORM_BOUNCE_COEF;
          snakeBounced = true;
          for (var bp = 0; bp < 8; bp++) spawnParticle(bmp.x + bnx * bmp.r, bmp.y + bny * bmp.r, 0, false, '#ffe28b');
        }
      }
      // 弹簧墙（spring）：只弹跳类墙体参与，实心墙/树桩保持原「穿行」行为
      var snakeWalls = querySpatial('walls', snakeForm.headX - 110, snakeForm.headX + 110, spatialWallsQuery);
      for (var wi = 0; wi < snakeWalls.length; wi++) {
        var wll = snakeWalls[wi];
        if (!wll || !wll.spring) continue;
        var wcx = clamp(snakeForm.headX, wll.x, wll.x + wll.w);
        var wcy = clamp(snakeForm.headY, wll.y, wll.y + wll.h);
        var wdx = snakeForm.headX - wcx, wdy = snakeForm.headY - wcy;
        var wd = Math.hypot(wdx, wdy) || 0.0001;
        if (wd < player.r) {
          var wnx = wdx / wd, wny = wdy / wd;            // 由墙指向蛇（外侧）
          snakeForm.headX = wcx + wnx * player.r;
          snakeForm.headY = wcy + wny * player.r;
          var wvdotn = svx * wnx + svy * wny;
          svx = (svx - 2 * wvdotn * wnx) * SNAKE_FORM_BOUNCE_COEF;
          svy = (svy - 2 * wvdotn * wny) * SNAKE_FORM_BOUNCE_COEF;
          snakeBounced = true;
          for (var wp = 0; wp < 8; wp++) spawnParticle(wcx, wcy, 0, false, wll.powerSpring ? '#ff9df2' : '#9eeaff');
        }
      }
      if (snakeBounced) {
        var ssp = Math.hypot(svx, svy) || 0.0001;
        if (ssp < SNAKE_FORM_BOUNCE_MIN) { svx = svx / ssp * SNAKE_FORM_BOUNCE_MIN; svy = svy / ssp * SNAKE_FORM_BOUNCE_MIN; }
        var bouncedAng = Math.atan2(svy, svx);
        snakeForm.wanderAngle = bouncedAng;
        snakeForm.heading = bouncedAng;                  // 反弹瞬间立即改向，避免穿入道具
        snakeForm.phase = 0;                              // 重置摆动相位，避免反弹瞬间抖动错乱
        playCollisionSound('bumper', 0.45);
        triggerHaptic('light');
      }
      // 边界反弹（撞墙/上下界）：平滑转向，不越界
      var sfMinX = player.r, sfMaxX = Math.max(player.r, runtimeLevel.width - player.r);
      // [2026-10-14 v32 需求6] 蛇形最多只能超出画框顶部「一个头的高度」（≈2×蛇头半径34px），
      //   再往上立即反弹（下方原有反转逻辑自动把 heading 竖直分量反向），防止飞太高出画。
      var sfMinY = -(SNAKE_FORM_RADIUS * 2), sfMaxY = Math.max(0, runtimeLevel.height - player.r - 4);
      if (snakeForm.headX <= sfMinX) { snakeForm.headX = sfMinX; var wa = Math.atan2(Math.sin(Math.PI - snakeForm.heading), Math.cos(Math.PI - snakeForm.heading)); snakeForm.heading = wa; snakeForm.wanderAngle = wa; }
      else if (snakeForm.headX >= sfMaxX) { snakeForm.headX = sfMaxX; var wa = Math.atan2(Math.sin(Math.PI - snakeForm.heading), Math.cos(Math.PI - snakeForm.heading)); snakeForm.heading = wa; snakeForm.wanderAngle = wa; }
      if (snakeForm.headY <= sfMinY) { snakeForm.headY = sfMinY; var ca = Math.atan2(Math.sin(-snakeForm.heading), Math.cos(-snakeForm.heading)); snakeForm.heading = ca; snakeForm.wanderAngle = ca; }
      else if (snakeForm.headY >= sfMaxY) { snakeForm.headY = sfMaxY; var ca = Math.atan2(Math.sin(-snakeForm.heading), Math.cos(-snakeForm.heading)); snakeForm.heading = ca; snakeForm.wanderAngle = ca; }
      player.x = snakeForm.headX; player.y = snakeForm.headY;
      player.vx = snakeForm.vx; player.vy = snakeForm.vy;
      player.attachIndex = null; player.mouthOpen = 0;
      player.faceDir = snakeForm.facing;
      player.animTime += dt;
      // 蛇身：逐节延迟跟随，形成摆动
      var px = snakeForm.headX, py = snakeForm.headY;
      for (var i = 0; i < snakeForm.segments.length; i++) {
        var seg = snakeForm.segments[i];
        var sdx = px - seg.x, sdy = py - seg.y;
        var sd = Math.hypot(sdx, sdy) || 0.0001;
        if (sd > SNAKE_FORM_SEGMENT_GAP) {
          seg.x = px - sdx / sd * SNAKE_FORM_SEGMENT_GAP;
          seg.y = py - sdy / sd * SNAKE_FORM_SEGMENT_GAP;
        }
        px = seg.x; py = seg.y;
      }
      // 尾迹粒子
      snakeForm.particleTimer += dt;
      while (snakeForm.particleTimer >= 0.07) {
        snakeForm.particleTimer -= 0.07;
        spawnParticle(snakeForm.headX - snakeForm.facing * 12, snakeForm.headY + 4, 0, false,
          snakeForm.kind === 'qing' ? 'rgba(124,224,168,.9)' : 'rgba(234,246,255,.9)');
      }
      // 变蛇期间可以正常吃食物 / 计分
      var snakeFoods = querySpatial('foods', snakeForm.headX - 96, snakeForm.headX + 96, spatialFoodsQuery);
      for (var fi = 0; fi < snakeFoods.length; fi++) {
        var sf = snakeFoods[fi];
        if (!sf || sf.collected) continue;
        if (dist(snakeForm.headX, snakeForm.headY, sf.x, sf.y) < SNAKE_FORM_RADIUS + 24) collectFood(sf);
      }
      if (snakeForm.timer <= 0) { endSnakeForm(); return; }
      if (player.x + player.r >= runtimeLevel.finish.x) { endSnakeForm(); finishRun(); }
    }

    // =====================================================================
    // 2026-10-01 白娘子 · 水漫金山：每关 1 次落地不死
    // =====================================================================
    var floodRiseTimer = 0;   // > 0 表示正在被喷泉托举上升，期间无视障碍与乌鸦
    function isFloodRising() { return floodRiseTimer > 0; }
    function triggerFloodFountain() {
      if (!player || !runtimeLevel || floodFountainUsed) return false;
      floodFountainUsed = true;   // 每关仅首次落地生效，第二次照常摔死
      try { detachTongue(); } catch (e) {}
      // 明确「不放屁」：清掉放屁计时与推进，避免残留的放屁粒子/推进力混进喷泉上升段。
      player.fartTimer = 0; player.fartSpawnTimer = 0;
      player.fartBoostTimer = 0; player.fartBoostPower = 0; player.fartBoostAngle = 0;
      pointerHeld = false;
      player.y = Math.max(player.r, runtimeLevel.height - player.r - 8);
      player.vy = -FLOOD_FOUNTAIN_LAUNCH_SPEED;
      player.vx = Math.max(Math.abs(player.vx) * 0.45, FLOOD_FOUNTAIN_FORWARD_SPEED);
      player.attachIndex = null; player.mouthOpen = 0;
      player.pendingAttachIndex = null; player.pendingAimAngle = null;
      floodRiseTimer = FLOOD_FOUNTAIN_RISE_SECONDS;
      floodFountainFx = { active: true, timer: 0, duration: 1.0, x: player.x, y: runtimeLevel.height - 10, particleTimer: 0 };
      for (var i = 0; i < 26; i++) spawnParticle(player.x + (Math.random() - 0.5) * 46, runtimeLevel.height - 14, 0, false, i % 2 ? '#8fc9ff' : '#eaf6ff');
      screenShake = Math.max(screenShake, 0.7);
      triggerHaptic('heavy');
      floatingTexts.push({
        x: player.x, y: player.y - 60, value: 0, label: '', age: 0, life: 2.0,
        customText: '水漫金山！'
      });
      return true;
    }
    function updateFloodFountain(dt) {
      if (floodRiseTimer > 0) floodRiseTimer = Math.max(0, floodRiseTimer - dt);
      if (!floodFountainFx.active) return;
      floodFountainFx.timer += dt;
      floodFountainFx.particleTimer += dt;
      while (floodFountainFx.particleTimer >= 0.045) {
        floodFountainFx.particleTimer -= 0.045;
        spawnParticle(floodFountainFx.x + (Math.random() - 0.5) * 52, floodFountainFx.y - Math.random() * 26, 0, false,
          Math.random() < 0.5 ? '#8fc9ff' : '#dff3ff');
      }
      if (floodFountainFx.timer >= floodFountainFx.duration) floodFountainFx.active = false;
    }

    // =====================================================================
    // 2026-10-01 小青 · 超级贪吃：长按锚定时自动连吃附近食物
    // =====================================================================
    function resetGreedyShot() {
      greedyShot.phase = 'idle'; greedyShot.food = null;
      greedyShot.timer = 0; greedyShot.duration = 0; greedyShot.progress = 0; greedyShot.cooldown = 0;
      greedyTongueTimer = 0;
    }
    // 与 stepGameplay 里食物渲染/拾取用的浮动一致，保证「看到的食物位置」就是「舌尖要碰的位置」。
    function greedyFoodWaveY(food) {
      return food.y + Math.sin(nowSec() * 4 + food.x * 0.01) * 4;
    }
    // 小青·超级贪吃：食物与锚点都算「伸舌对象」，优先伸向更近的那个。
    // 返回 { kind:'food', food } 或 { kind:'anchor' }。
    function findGreedyTarget() {
      var minX = player.x - GREEDY_TONGUE_RADIUS, maxX = player.x + GREEDY_TONGUE_RADIUS;
      var list = querySpatial('foods', minX, maxX, spatialFoodsQuery);
      var best = null, bestD = Infinity;
      for (var i = 0; i < list.length; i++) {
        var f = list[i];
        if (!f || f.collected) continue;
        var d = dist(player.x, player.y, f.x, f.y);
        if (d > GREEDY_TONGUE_RADIUS || d >= bestD) continue;
        bestD = d; best = f;
      }
      if (!best) return { kind: 'anchor' };
      var anchorCand = getAnchorCandidate();
      var anchorD = anchorCand ? anchorCand.distance : Infinity;
      // 锚点更近（含一样近）就让位给锚点：挂上之后持续晃荡，中途不再分心去够食物。
      if (anchorD <= bestD) return { kind: 'anchor' };
      return { kind: 'food', food: best };
    }
    function updateGreedyTongue(dt) {
      // 已挂在锚点上 → 什么都不做：让它持续晃荡，直到玩家放手才恢复正常。
      // （这条同时保证同一时刻只有一根舌头：挂锚点时不会再伸出去够食物。）
      if (!greedyTongueActive() || !runtimeLevel || !player || player.attachIndex !== null) { resetGreedyShot(); return; }
      var mouth = getMouthWorld();
      var f = greedyShot.food;
      // 目标已被吃掉或关卡已切换 → 立刻收舌，不残留一条空舌头。
      // 注意只在 extend 阶段判：retract 时 food 本来就是 null，若一起判会把 timer 每帧清零、收舌永远结束不了。
      if (greedyShot.phase === 'extend' && (!f || f.collected)) {
        greedyShot.phase = 'retract'; greedyShot.timer = 0; greedyShot.food = null;
        f = null;
      }
      if (greedyShot.phase === 'extend') {
        greedyShot.timer += dt;
        var fx = f.x, fy = greedyFoodWaveY(f);
        greedyShot.targetX = fx; greedyShot.targetY = fy;
        var p = greedyShot.duration > 0 ? clamp(greedyShot.timer / greedyShot.duration, 0, 1) : 1;
        greedyShot.progress = p;
        greedyShot.tipX = lerp(mouth.x, fx, p);
        greedyShot.tipY = lerp(mouth.y, fy, p);
        // 真实命中：舌尖真的碰到食物才吃到（不再是范围内瞬吃）
        if (dist(greedyShot.tipX, greedyShot.tipY, fx, fy) <= GREEDY_TONGUE_TIP_HIT) {
          collectFood(f);
          greedyShot.phase = 'retract'; greedyShot.timer = 0; greedyShot.food = null;
          return;
        }
        if (p >= 1) { greedyShot.phase = 'retract'; greedyShot.timer = 0; greedyShot.food = null; }
        return;
      }
      if (greedyShot.phase === 'retract') {
        greedyShot.timer += dt;
        greedyShot.progress = Math.max(0, 1 - greedyShot.timer / GREEDY_TONGUE_RETRACT_SECONDS);
        greedyShot.tipX = lerp(mouth.x, greedyShot.targetX, greedyShot.progress);
        greedyShot.tipY = lerp(mouth.y, greedyShot.targetY, greedyShot.progress);
        if (greedyShot.timer >= GREEDY_TONGUE_RETRACT_SECONDS) {
          greedyShot.phase = 'idle'; greedyShot.timer = 0; greedyShot.progress = 0;
          greedyShot.cooldown = GREEDY_TONGUE_INTERVAL;
        }
        return;
      }
      // idle：冷却结束后自动瞄准最近的食物，把舌头朝它伸过去
      greedyShot.cooldown = Math.max(0, greedyShot.cooldown - dt);
      greedyShot.tipX = mouth.x; greedyShot.tipY = mouth.y;
      if (greedyShot.cooldown > 0) return;
      var target = findGreedyTarget();
      if (!target || target.kind !== 'food') {
        // 让位给锚点。这里要补一次挂锚点：attachTongue 只在「吐舌窗口」到点时触发一次，
        // 若那一次正好被伸舌挡掉，玩家一直按住也挂不上锚点（除非松手重按），故贪吃结束后补上。
        if (pointerHeld && player.attachIndex === null && player.pendingAttachIndex != null
            && (Number(player.pressOpenTimer) || 0) <= 0) {
          attachTongue(player.pendingAttachIndex);
        }
        return;
      }
      var best = target.food;
      var bx = best.x, by = greedyFoodWaveY(best);
      var bd = dist(mouth.x, mouth.y, bx, by);
      greedyShot.food = best;
      greedyShot.phase = 'extend';
      greedyShot.timer = 0;
      greedyShot.duration = Math.max(GREEDY_TONGUE_MIN_EXTEND, bd / GREEDY_TONGUE_EXTEND_SPEED);
      greedyShot.progress = 0;
      greedyShot.targetX = bx; greedyShot.targetY = by;
      greedyShot.tipX = mouth.x; greedyShot.tipY = mouth.y;
    }

    function stepGameplay(dt) {
      // 只加速游戏内物理位移，不加速 UI、计分计时、乌鸦生成间隔或受击失效时长。
      var motionDt = dt * currentRoundPhysicsSpeedMultiplier();
      // 2026-10-01：变蛇期间接管整帧 —— 不受重力、不跑舌头物理、不碰障碍与乌鸦。
      if (isSnakeFormActive()) { updateFloodFountain(dt); updateSnakeForm(dt); return; }
      updateFloodFountain(dt);
      var prevPlayerX = player.x, prevPlayerY = player.y;
      player.animTime += dt; player.hitTimer = Math.max(0, player.hitTimer-dt);
      player.crowBlinkTimer = Math.max(0, (Number(player.crowBlinkTimer) || 0) - dt);
      player.crowHitCooldown = Math.max(0, (Number(player.crowHitCooldown) || 0) - dt);
      player.tapGuideTimer = Math.max(0, Number(player.tapGuideTimer || 0) - dt);
      player.skillInputLock = Math.max(0, (Number(player.skillInputLock) || 0) - dt);
      player.fartTimer = Math.max(0, (Number(player.fartTimer) || 0) - dt);
      player.fartBoostTimer = Math.max(0, (Number(player.fartBoostTimer) || 0) - dt);
      if (player.fartBoostTimer > 0) {
        var boostDuration = Math.max(0.001, Number(player.fartBoostDuration) || GOLDEN_SKILL_BOOST_DURATION);
        var boostProgress = clamp(1 - player.fartBoostTimer / boostDuration, 0, 1);
        var thrust = (520 + 980 * boostProgress * boostProgress) * (0.72 + 0.28 * (Number(player.fartBoostPower) || 0));
        var boostAngle = clamp(Number(player.fartBoostAngle) || 0, -GOLDEN_SKILL_MAX_ANGLE, GOLDEN_SKILL_MAX_ANGLE);
        var thrustX = Math.sin(boostAngle);
        var thrustY = -Math.cos(boostAngle);
        player.vx += thrustX * thrust * dt;
        player.vy += thrustY * thrust * dt;
      }
      if (player.fartTimer > 0) {
        player.fartSpawnTimer = (Number(player.fartSpawnTimer) || 0) - dt;
        if (player.fartSpawnTimer <= 0) {
          player.fartSpawnTimer = lowDevice ? 0.064 : (balancedDevice ? 0.046 : 0.032);
          var boostAngleFx = clamp(Number(player.fartBoostAngle) || 0, -GOLDEN_SKILL_MAX_ANGLE, GOLDEN_SKILL_MAX_ANGLE);
          var exhaustFxX = -Math.sin(boostAngleFx), exhaustFxY = Math.cos(boostAngleFx);
          if (particles.length < PARTICLE_LIMIT) {
            if (isSnakeMaidSkinActive()) {
              // 2026-10-08 蛇娘：脚下涌出的白色云雾 —— 慢速、膨胀、微微上浮，像踩着云。
              var cloudTones = ['#ffffff', '#f4f9ff', '#e8f2ff', '#dcebff'];
              var cloudTone = (Math.random() * cloudTones.length) | 0;
              if (cloudTone >= cloudTones.length) cloudTone = cloudTones.length - 1;
              particles.push({
                x: player.x + exhaustFxX * (player.r * 0.42) + (Math.random() - 0.5) * 22,
                y: player.y + exhaustFxY * (player.r * 0.55) + (Math.random() - 0.5) * 12,
                vx: exhaustFxX * (16 + Math.random() * 26) + (Math.random() - 0.5) * 30,
                vy: exhaustFxY * (8 + Math.random() * 18) - (10 + Math.random() * 16),
                age: 0, life: 0.72 + Math.random() * 0.46,
                r: 11 + Math.random() * 9, confetti: false,
                color: cloudTones[cloudTone], rot: 0,
                grow: 30,        // 每秒半径增量：慢慢蓬松开
                grav: -30,       // 负值 = 缓缓上飘，不是往下掉
                drag: 2.2,       // 强阻尼：喷出即堆积在脚下
                soft: true       // 渲染层画柔和云边（外圈淡、内圈实）
              });
            } else {
              particles.push({
                x: player.x + exhaustFxX * (player.r * 0.72), y: player.y + exhaustFxY * (player.r * 0.72),
                vx: exhaustFxX * (100 + Math.random() * 115) + (Math.random() - 0.5) * 42,
                vy: exhaustFxY * (100 + Math.random() * 115) + (Math.random() - 0.5) * 42,
                age: 0, life: 0.32 + Math.random() * 0.22,
                r: 4 + Math.random() * 7, confetti: false,
                color: Math.random() < 0.5 ? '#a9d66f' : '#d7c77b', rot: 0
              });
            }
          }
        }
      }
      if (runStats.comboTimer > 0) {
        runStats.comboTimer = Math.max(0, runStats.comboTimer - dt);
        if (runStats.comboTimer <= 0) { runStats.combo = 0; runStats.multiplier = 1; }
      }
      player.attachSnapTimer = Math.max(0, player.attachSnapTimer-dt);
      screenShake = Math.max(0, screenShake-dt*1.6);
      var gameplayWalls = runtimeLevel.walls;
      for (var wallIndex = 0; wallIndex < gameplayWalls.length; wallIndex++) {
        var wall = gameplayWalls[wallIndex];
        if (!wall || !wall.spring) continue;
        if (wall.disappearTimer > 0) {
          wall.disappearTimer = Math.max(0, wall.disappearTimer - dt);
          if (wall.disappearTimer <= 0) wall.removed = true;
        }
        var sx = Number(wall.springAnim) || 0, sv = Number(wall.springAnimVelocity) || 0;
        if (Math.abs(sx) > 0.002 || Math.abs(sv) > 0.002) {
          sv += (-72 * sx - 10 * sv) * dt;
          sx += sv * dt;
          wall.springAnim = sx; wall.springAnimVelocity = sv;
        } else { wall.springAnim = 0; wall.springAnimVelocity = 0; }
      }
      if (player.pressOpenTimer > 0) {
        player.pressOpenTimer = Math.max(0, player.pressOpenTimer-dt);
        if (player.pressOpenTimer <= 0 && pointerHeld && player.attachIndex === null) attachTongue(player.pendingAttachIndex);
      }
      if (player.attachIndex !== null) {
        var a = runtimeLevel.anchors[player.attachIndex];
        if (!a) { player.attachIndex = null; }
        else {
          var dx=player.x-a.x, dy=player.y-a.y, d=Math.hypot(dx,dy)||0.001;
          var nx=dx/d, ny=dy/d, over=d-player.ropeLength;
          player.attachHoldTime += dt;
          // 小青·超级贪吃：一旦挂在锚点开始晃荡，就持续晃荡到玩家放手为止，
          // 中途不再伸舌去够食物（同一时刻只保留一根舌头 = 这根锚点绳）。
          resetGreedyShot();
          var snapPull = 0;
          if (player.attachHoldTime > ATTACH_SHORTEN_DELAY) {
            snapPull = (player.attachSnapTimer>0 && player.attachSnapDuration>0) ? Math.sin((1-(player.attachSnapTimer/player.attachSnapDuration))*Math.PI)*20 : 0;
            player.ropeLength = Math.max(54, player.ropeLength-(26+snapPull)*motionDt);
          }
          if (over > 0) { player.x -= nx*over; player.y -= ny*over; }
          var rv = player.vx*nx+player.vy*ny; if (rv>0) { player.vx -= rv*nx; player.vy -= rv*ny; }
          var tx=-ny, ty=nx, tang=player.vx*tx+player.vy*ty;
          player.vx += tx*tang*0.002+36*dt; player.vy += ty*tang*0.002; player.mouthOpen = 1;
          var verticalDeviation = Math.asin(clamp(Math.abs(dx) / d, 0, 1));
          // 规则：舌头在 ±25° 范围内（接近竖直向下，0°=垂直）长按超过 3 秒 → 自动失效
          if (pointerHeld && verticalDeviation <= TONGUE_FAIL_ANGLE && canTongueFailRule()) {
            player.tongueFailTimer += dt;
            if (player.tongueFailTimer >= tongueFailSeconds()) {
              if (isBatSkinActive()) performBatVerticalRebound(a);
              else releaseVerticalTongue(a);
              noteTutorialTongueFail();
              return;
            }
          } else player.tongueFailTimer = 0;
        }
      } else {
        player.verticalTongueTimer = 0; player.mouthOpen = Math.max(0, player.mouthOpen-dt*8);
        // 小青·超级贪吃：没挂锚点时，长按会朝「更近的那个 —— 食物或锚点」伸舌。
        if (pointerHeld && greedyTongueActive()) updateGreedyTongue(dt);
        else resetGreedyShot();
      }
      if (isNaN(player.x) || isNaN(player.y) || isNaN(player.vx) || isNaN(player.vy)) {
        player.x = runtimeLevel.start.x; player.y = runtimeLevel.start.y;
        player.vx = 170; player.vy = 10; player.attachIndex = null;
      }
      var playerInWater = isUnderwaterAt(player.y);
      var gravityScale = playerInWater ? Math.max(0.05, Number(runtimeLevel.gravityScale) || 0.38) : 1;
      player.vy += GRAVITY * gravityScale * dt; player.vx += 7 * dt; player.vx *= 0.999;
      if (playerInWater) {
        var waterScale = clamp(Number(runtimeLevel.waterVelocityScale) || 0.991, 0.80, 0.9999);
        var waterDrag = Math.pow(waterScale, dt * 60);
        player.vx *= waterDrag; player.vy *= waterDrag;
      }
      // 蝠侠·滑翔：飞出画面上缘再降回中部时自动启动，覆盖重力/水阻，改为缓慢前飞 + 缓慢下降。
      updateBatGlide(dt, motionDt);
      player.x += player.vx*motionDt; player.y += player.vy*motionDt;
      if (player.x < player.r) { player.x=player.r; player.vx=Math.abs(player.vx)*0.75; markHit(1, 0, 0.92); triggerHaptic('medium'); }
      if (player.y + player.r > runtimeLevel.height) {
        player.y = runtimeLevel.height - player.r;
        player.vy = 0;
        centerCameraOnPlayer(1.0, true);
        requestDeathOrSkill('ground');
        return;
      }
      // 白娘子·水漫金山：被喷泉托举上升的这段路上无视所有障碍物。
      if (!isFloodRising()) {
        var nearbyWalls = querySpatial('walls', player.x - player.r - 96, player.x + player.r + 96, spatialWallsQuery);
        for (var collideWallIndex = 0; collideWallIndex < nearbyWalls.length; collideWallIndex++) collideWall(nearbyWalls[collideWallIndex]);
        var nearbyBumpers = querySpatial('bumpers', player.x - player.r - 112, player.x + player.r + 112, spatialBumpersQuery);
        for (var bumperIndex = 0; bumperIndex < nearbyBumpers.length; bumperIndex++) collideBumper(nearbyBumpers[bumperIndex]);
      }
      updateCrows(dt);
      var mouth = getMouthWorld(), attachAnchor = player.attachIndex !== null ? runtimeLevel.anchors[player.attachIndex] : null;
      var foodWaveTime = nowSec() * 4;
      // 拾取半径：保留统一入口（2026-10-01 起无皮肤再改写它，恒为 0），空间查询范围随之计算。
      var pickupBonus = foodPickupBonus();
      var foodMinX = player.x - player.r - 28 - pickupBonus, foodMaxX = player.x + player.r + 28 + pickupBonus;
      if (attachAnchor) { foodMinX = Math.min(foodMinX, mouth.x, attachAnchor.x) - 24; foodMaxX = Math.max(foodMaxX, mouth.x, attachAnchor.x) + 24; }
      var gameplayFoods = querySpatial('foods', foodMinX, foodMaxX, spatialFoodsQuery);
      // 薯王·黄金番薯磁力吸附（被动能力）：在拾取循环前先把它吸过来，本帧即可被收掉
      updatePotatoMagnet(motionDt);
      for (var foodIndex = 0; foodIndex < gameplayFoods.length; foodIndex++) {
        var food = gameplayFoods[foodIndex];
        if (food.collected) continue;
        var fy = food.y + Math.sin(foodWaveTime + food.x * 0.01) * 4;
        var hit = dist(player.x, player.y, food.x, fy) < player.r + 30 + pickupBonus;
        if (!hit && attachAnchor) hit = segmentPointDistance(mouth.x, mouth.y, attachAnchor.x, attachAnchor.y, food.x, fy) < 32 + pickupBonus;
        if (hit) collectFood(food);
      }
      var frameDistance = Math.hypot(player.x - prevPlayerX, player.y - prevPlayerY);
      if (isFinite(frameDistance)) runStats.stageFlightDistance += Math.min(frameDistance, 120);
      runStats.stageFlightScore = Math.max(0, Math.floor(runStats.stageFlightDistance * 0.1 / 3));
      if (portalState.active && !portalState.triggered && portalState.spawnTimer >= PORTAL_SPAWN_SECONDS * 0.78) {
        var portalScale = easeOutCubic(clamp(portalState.spawnTimer / PORTAL_SPAWN_SECONDS, 0, 1));
        var portalScreenX = portalState.x - cameraX;
        var portalFrame = portalFrameForScreenX(portalScreenX);
        var frameRatio = PORTAL_FRAME_WIDTH_RATIOS[Math.min(PORTAL_FRAME_WIDTH_RATIOS.length - 1, portalFrame)] || 1;
        var portalRx = Math.max(25, (Number(portalState.halfWidth) || PORTAL_HALF_WIDTH) * portalScale * 0.76 * frameRatio);
        var portalRy = Math.max(42, (Number(portalState.halfHeight) || PORTAL_HALF_HEIGHT) * portalScale * 0.58);
        var pdx = (player.x - portalState.x) / portalRx;
        var pdy = (player.y - portalState.y) / portalRy;
        if (pdx * pdx + pdy * pdy <= 1) { beginPortalTravel(); return; }
      }
      if (player.x + player.r >= runtimeLevel.finish.x) {
        if (isTutorialStage() && !tutorialStageReadyForFinish()) {
          player.x = runtimeLevel.finish.x - player.r - 8;
          player.vx = -Math.max(120, Math.abs(player.vx) * 0.42);
          if (tutorialFlow.finishPromptTimer <= 0 && tutorialFlow.finishNoticeTimer <= 0) showTutorialFinishBlockedPrompt();
          return;
        }
        finishRun(); return;
      }
      if (player.y - player.r > runtimeLevel.height + 40) { requestDeathOrSkill('fall'); return; }
      player.faceDir = player.vx >= -12 ? 1 : -1;
      if (player.attachIndex !== null) {
        var a2 = runtimeLevel.anchors[player.attachIndex];
        if (a2) { var ta = directionAngle(a2.x-player.x, a2.y-player.y); player.angle = normalizeAngle(player.angle + shortestAngleDelta(player.angle, ta)*0.34); player.spin *= 0.90; }
        else { player.attachIndex = null; }
      } else {
        var ts = clamp(Math.abs((player.vx - player.vy*0.16)/260), 1.6, 3.2);
        player.spin = lerp(player.spin, ts, 0.055); player.angle = normalizeAngle(player.angle + player.spin*motionDt);
      }
      var sp = Math.hypot(player.vx, player.vy);
      if (sp > 760 && nowSec()-audioState.lastWoohoo > 1.9) { audioState.lastWoohoo = nowSec(); sayVoice('呜呼'); }
      if (!runtimeLevel.isTutorial && player.y < 0) {
        var now = nowSec();
        if (!player.topEdgeSweetPotatoAt || now - player.topEdgeSweetPotatoAt >= 2.0) {
          player.topEdgeSweetPotatoAt = now;
          if (Math.random() < (1/3)) {
            goldenSkillState.points = Math.max(0, Number(goldenSkillState.points) || 0) + 1;
            floatingTexts.push({
              x: player.x, y: 24, value: 1, label: '黄金番薯', age: 0, life: 1.6,
              customText: '✦ 出框奖励：黄金番薯 +1'
            });
            triggerHaptic('medium');
          }
        }
      }
    }

    function update(dt) {
      if (uiPressTimer > 0) {
        uiPressTimer = Math.max(0, uiPressTimer-dt);
        if (uiPressTimer === 0 && pendingUiAction) { var action = pendingUiAction; pendingUiAction = null; uiPressVisual = ''; action(); }
      }
      // 黄金番薯同步完成、且用户此前点过「开始」但被延后弹窗 → 补弹一次（显示同步后正确余额）。
      if (giftReady && giftPendingStatusPopup && !dailyLoginPopup.active) {
        giftPendingStatusPopup = false;
        showMenuPlayStatusPopup();
      }
      if (leaderboardOpen) updateLeaderboardAutoScroll(dt);
      updateSkinWheel(dt);
      updateSkinWheelAutoSpin(dt);
      if (scene === 'menu' && dailyLoginPopup.active) {
        dailyLoginPopup.timer = Math.max(0, Number(dailyLoginPopup.timer) - dt);
        if (dailyLoginPopup.timer <= 0) {
          dismissMenuPlayStatusPopup(true);
        }
      }
      updateExternalAudioWatchdog();
      updateCrowWarning(dt);
      if (scene === 'loading') {
        // 只有加载动作资源真正可用后才从第 0 帧起计时，确保用户能完整看到一遍。
        if (!loadingState.animationStarted) {
          var warmupReady = !!(warmupSprite && warmupSprite.ready && warmupSprite.image);
          // 只在指定精灵图解码完成后从第 0 帧开始；载入失败由启动层重试，绝不使用替代动作。
          if (warmupReady) {
            loadingState.animationStarted = true;
            loadingState.startedAtMs = nowMs();
            loadingState.timer = 0;
          }
        } else {
          loadingState.timer = Math.max(0, (nowMs() - loadingState.startedAtMs) / 1000);
        }
        loadingState.progress = Math.max(loadingState.progress, Math.min(1, startupResourceProgress()));
        var animationComplete = loadingState.animationStarted && loadingState.timer >= loadingState.duration;
        var warmupStillReady = !!(warmupSprite && warmupSprite.ready && warmupSprite.image);
        if (loadingState.progress >= 1 && animationComplete && warmupStillReady) {
          // 先绘制一帧 100% 和动作末帧，下一帧记录已加载状态并进入首页。
          if (loadingState.completeFrameShown) {
            try { wx.setStorageSync(loadingCompleteKey, 1); } catch (ignoreLoadingCacheSave) {}
            if (!bootReviveResumePending) setScene('menu');
          } else loadingState.completeFrameShown = true;
        }
        return;
      }
      if (!player && scene !== 'menu') player = makePlayer();
      // 眨眼计时独立于物理旋转：暂停、复活弹窗或技能界面都不会把半闭眼状态冻结。
      if (player) updateCurlBlink(dt);
      if (rewardDialog.active) {
        syncRewardDialogAvailability();
        if (rewardDialog.cooldownUntil > 0 && nowMs() >= rewardDialog.cooldownUntil && !rewardDialog.claimed) {
          grantCooldownRevive();
          return;
        }
        if (rewardDialog.mode === 'play' && !rewardDialog.busy && (economyState.dailyPlays + economyState.recoveredPlay) > 0) {
          var recoveredStage = rewardDialog.stageToLoad;
          var recoveredReset = rewardDialog.resetSession;
          closeRewardDialog();
          if (consumePlayEnergy()) beginFormalPlay(recoveredStage, recoveredReset);
          return;
        }
        return;
      }
      // 全局冷却到期检测：即使弹窗关闭/在首页，冷却到时间也自动复活
      if (rewardDialog.cooldownUntil > 0 && nowMs() >= rewardDialog.cooldownUntil && !rewardDialog.claimed) {
        // 更新 cooldownText 为最终状态
        rewardDialog.cooldownText = '';
        grantCooldownRevive();
        return;
      }
      if (scene === 'playing') {
        var tutorialBlocked = false;
        if (isTutorialStage() && (tutorialFlow.phase === 'intro' || tutorialFlow.phase === 'check' || tutorialFlow.finishPromptTimer > 0)) tutorialBlocked = updateTutorialFlow(dt);
        if (!tutorialBlocked) {
          updatePortal(dt);
          if (scene === 'playing' && !portalState.entryActive) stepGameplay(dt);
          if (scene === 'playing' && isTutorialStage()) updateTutorialFlow(dt);
        }
        if (isTutorialStage() && tutorialInputSeen && tutorialHintTimer > 0) tutorialHintTimer = Math.max(0, tutorialHintTimer-dt);
      }
      else if (scene === 'golden_skill') {
        player.animTime += dt * 0.25;
        if (goldenSkillState.kioskAutoSwing && kioskAutoGoldenSkillEnabled()) {
          // 完整往返周期 2.4s，±45°；实时弓形方向与最终发射角一致。
          goldenSkillState.kioskSwingTime += dt;
          var swing = Math.sin(goldenSkillState.kioskSwingTime * (2 * Math.PI / 2.4));
          goldenSkillState.aimAngle = swing * GOLDEN_SKILL_MAX_ANGLE;
          var dock = Math.max(96, Number(goldenSkillState.dockDistance) || 158);
          goldenSkillState.uiOffsetX = goldenSkillState.targetX + Math.sin(goldenSkillState.aimAngle) * dock - goldenSkillState.originX;
          goldenSkillState.uiOffsetY = goldenSkillState.targetY - Math.cos(goldenSkillState.aimAngle) * dock - goldenSkillState.originY;
          goldenSkillState.kioskRescueRemain = Math.max(0, (goldenSkillState.kioskRescueDeadline - nowMs()) / 1000);
        }
        // [2026-10-12] 番薯救援 10 秒未按键 → 挑战失败 → 游戏结束 → 回首页
        if (kioskAutoGoldenSkillEnabled() && goldenSkillState.menuActive && nowMs() >= goldenSkillState.kioskRescueDeadline) {
          goldenSkillState.menuActive = false;
          try { if (window.__toast) window.__toast('挑战失败 · 未按发射'); else showToastMessage('挑战失败 · 未按发射', 1.6); } catch (e) {}
          kioskOnDeath(goldenSkillState.deathCause || 'fall');
        }
        if (!goldenSkillState.countdownLocked) {
          goldenSkillState.timer = Math.max(0, goldenSkillState.timer - dt);
          if (goldenSkillState.timer <= 0) resolveGoldenSkillSelection('none');
        }
      }
      else if (scene === 'golden_skill_ad') { player.animTime += dt * 0.15; }
      else if (scene === 'editor') {}
      else if (scene === 'portal_preview') {
        if (!portalPreviewState.paused) portalPreviewState.timer += dt * Math.max(0.05, Number(portalPreviewState.speed) || 1);
        var previewTotal = Math.max(0.1, portalPreviewState.travelDuration) + Math.max(0.1, portalPreviewState.whiteDuration);
        if (portalPreviewState.timer >= previewTotal) portalPreviewState.timer %= previewTotal;
      }
      else if (scene === 'tutorial_comic') {
        tutorialComicState.pageTimer += dt;
        if (tutorialComicState.pageTimer >= Math.max(0.1, Number(tutorialComicState.autoAdvanceSeconds) || 5)) {
          advanceTutorialComicPage(false);
        }
      }
      else if (scene === 'paused') {}
      else if (scene === 'unlock_gate') {
        if (unlockGateState.celebrating) updateUnlockGateCelebration(dt);
        updateUnlockGateWheel(dt);
      }
      else if (scene === 'portal_transition') {
        portalTransitionState.timer += dt;
        if (!portalTransitionState.whiteStarted && portalTransitionState.timer >= PORTAL_TRAVEL_SECONDS) {
          portalTransitionState.whiteStarted = true;
          stopPortalTransitSound();
          playPortalArrivalSound();
          triggerHaptic('light', true);
        }
        if (portalTransitionState.timer >= PORTAL_TRANSITION_TOTAL_SECONDS) completePortalTransition();
      }
      else if (scene === 'death') {
        player.animTime += dt;
        if (!leaderboardOpen) deathTimer += dt;
        if (!deathLeaderboardShown && deathTimer >= 3.0) {
          deathLeaderboardShown = true;
          openLeaderboardAtPlayer(false, 'friend');
        }
      }
      else if (scene === 'game_over') {
        player.animTime += dt;
        gameOverState.timer += dt;
        if (!gameOverState.leaderboardShown && gameOverState.timer >= gameOverState.hold + gameOverState.fade) {
          gameOverState.leaderboardShown = true;
          openLeaderboardAtPlayer(false, 'friend');
        }
      }
      else if (scene === 'soul_departure') {
        player.animTime += dt * 0.35;
        soulState.timer = Math.min(soulState.duration, soulState.timer + dt);
        soulState.particleTimer += dt;
        while (soulState.particleTimer >= 0.10) {
          soulState.particleTimer -= 0.10;
          var progressSoul = soulState.duration > 0 ? soulState.timer / soulState.duration : 1;
          var sy = soulState.y - progressSoul * 150;
          spawnParticle(soulState.x + (Math.random() - 0.5) * 42, sy + 18, 0, false, Math.random() < 0.45 ? '#ffe89a' : '#d9fbff');
        }
        if (soulState.timer >= soulState.duration) offerRewardedRevive();
      }
      else if (scene === 'finish_slowmo') {
        var sdt = dt*0.22; finishState.timer += dt; finishState.confettiTimer += dt;
        player.animTime += sdt; player.vx *= 0.989; player.vy *= 0.972; player.vy += GRAVITY*sdt*0.16;
        player.x += player.vx*sdt; player.y += player.vy*sdt;
        player.angle = normalizeAngle(player.angle + player.spin*sdt);
        finishState.zoom = 1 + easeOutCubic(Math.min(1, finishState.timer/1.0))*1.45;
        while (finishState.confettiTimer > 0.05) { finishState.confettiTimer -= 0.05; for (var i=0;i<3;i++) spawnParticle(player.x+(Math.random()-0.5)*180, player.y-180-Math.random()*60, 0, true, ['#ff6688','#ffd85f','#85f3c0','#8bd8ff'][Math.floor(Math.random()*4)]); }
        if (finishState.timer > 1.35) {
          // [kiosk 2026-10-11] 线下闯关：过关同样出记分板（score_tally）——
          // 记分板走完后由 kioskAfterRoundTally 推进（变身视频/换人/总板）。
          setScene('score_tally'); finishState.tallyTimer = 0;
          if (runtimeLevel.isTutorial) finishState.tallyComplete = false;
        }
      } else if (scene === 'score_tally') {
        finishState.tallyTimer += dt;
        if (isTutorialStage()) {
          if (finishState.tallyTimer >= 0.55) finishState.tallyComplete = true;
        } else {
        var tallyIntroDelay = 0.64, itemDelay = 0.58, scoreDelay = 0.28, rollDuration = 0.46;
        var items = finishState.scoreItems || [];
        finishState.tallyValues = finishState.tallyValues || [];
        for (var ti = 0; ti < items.length; ti++) {
          // 每一项先播放圆形图标翻入，再开始滚动该项分数。
          var scoreStart = tallyIntroDelay + ti * itemDelay + scoreDelay;
          var localT = clamp((finishState.tallyTimer - scoreStart) / rollDuration, 0, 1);
          finishState.tallyValues[ti] = Math.round(items[ti].value * easeOutCubic(localT));
        }
        finishState.tallyScore = finishState.tallyValues[items.length - 1] || 0;
        finishState.tallyFood = finishState.tallyValues[0] || 0;
        var tallyEndTime = items.length ? (tallyIntroDelay + (items.length - 1) * itemDelay + scoreDelay + rollDuration + 0.18) : 0.8;
        if (finishState.tallyTimer > tallyEndTime) finishState.tallyComplete = true;
        // [kiosk 2026-10-11 下午] 记分板不再自动推进——由空白键推进（第 1 按出结果、第 2 按下一轮）。
        // [2026-10-14 v31 修复·写死三轮规格] 网页版裁剪后 FORMAL_STAGE_COUNT=1 → 杭州关即「最后一正式关」，
        //   tallyComplete 0.75s 后这里会自动触发「轮次完成传送门」→ progress.round=2（关卡长度 ×1.5）
        //   → 现场表现为「第 1 关过两次、第 2 次变成旧版加长地图」，且完全不需要按键（零手势自动循环）。
        //   现场闯关流程只允许 kioskAfterRoundTally 推进（变身视频→换角色），轮次传送门必须禁用。
        if (finishState.tallyComplete && isFinalFormalStage(stageIndex) && !finishState.roundPortalStarted &&
            !(kioskRun && kioskRun.active)) {
          finishState.roundPortalTimer = Math.max(0, Number(finishState.roundPortalTimer) || 0) + dt;
          if (finishState.roundPortalTimer >= 0.75) {
            finishState.roundPortalStarted = true;
            launchRoundCompletionPortalTransition();
          }
        }
        }
      }
      updateSpinLoop();
      if (tongueFx.mode !== 'none') {
        tongueFx.timer = Math.max(0, tongueFx.timer-dt);
        if (tongueFx.mode === 'retract' && tongueFx.timer <= 0 && player && player.attachIndex === null) { tongueFx.mode='rebound'; tongueFx.duration=TONGUE_REBOUND_DURATION; tongueFx.timer=TONGUE_REBOUND_DURATION; }
        else if (tongueFx.mode === 'rebound' && tongueFx.timer <= 0) tongueFx.mode = 'none';
        else if (tongueFx.timer <= 0 && player && player.attachIndex === null && player.pressOpenTimer <= 0) tongueFx.mode = 'none';
      }
      updateParticles(dt);
      var floatingWrite = 0;
      for (var floatingIndex = 0; floatingIndex < floatingTexts.length; floatingIndex++) {
        var floatingItem = floatingTexts[floatingIndex];
        floatingItem.age += dt;
        floatingItem.y -= 18 * dt;
        if (floatingItem.age < floatingItem.life) floatingTexts[floatingWrite++] = floatingItem;
      }
      floatingTexts.length = floatingWrite;
    }

    function pointInCircle(px,py,c) { return !!c && dist(px,py,c.x,c.y) <= c.r; }
    function pointInRect(px,py,r) { return !!r && px >= r.x-r.w/2 && px <= r.x+r.w/2 && py >= r.y-r.h/2 && py <= r.y+r.h/2; }
    function pointInHotspot(px, py, hotspot) {
      if (!hotspot) return false;
      if (hotspot.w && hotspot.h) return pointInRect(px, py, hotspot);
      return pointInCircle(px, py, hotspot);
    }
    function skinPanelCloseHit(px, py) {
      if (!skinPanelOpen) return false;
      // 首选渲染层热区；同时保留固定的宽松兜底区域，避免真机首帧热区未刷新或右上系统区域抢触控。
      if (pointInHotspot(px, py, uiHotspots.skinPanelClose)) return true;
      var fallbackX = VIEW_W - 72;
      var fallbackY = 125;
      return Math.hypot(Number(px) - fallbackX, Number(py) - fallbackY) <= 52;
    }
    function sliderValueFromX(px, slider) {
      var x0 = slider.x - slider.w * 0.5;
      return clamp((px - x0) / slider.w, 0, 1);
    }
    function updatePauseSettingsDrag(px) {
      if (scene !== 'paused' || !pauseSettingsDrag) return;
      if (pauseSettingsDrag === 'music' && uiHotspots.pauseMusicSlider) setMusicVolume(sliderValueFromX(px, uiHotspots.pauseMusicSlider));
      else if (pauseSettingsDrag === 'sfx' && uiHotspots.pauseSfxSlider) setSfxVolume(sliderValueFromX(px, uiHotspots.pauseSfxSlider));
    }
    function resumeFromPause() {
      pauseSettingsDrag = '';
      skinPanelOpen = false;
      saveSettings();
      saveSkinState();
      setScene('playing');
    }
    function queueUiAction(visual, action, hapticKind) {
      triggerHaptic(hapticKind || 'light');
      playUiClickSound();
      uiPressVisual = visual || '';
      uiPressTimer = 0.08;
      pendingUiAction = action;
    }
    function resetEditorSecretTap() {
      editorSecretTapCount = 0;
      editorSecretTapStartedAt = 0;
      editorSecretTapLastAt = 0;
    }
    function handleEditorSecretTap(px, py) {
      if (scene === 'loading' || scene === 'editor') {
        resetEditorSecretTap();
        return false;
      }
      var zone = { x: VIEW_W - 42, y: 92, w: 84, h: 84 };
      if (!pointInRect(px, py, zone)) {
        if (editorSecretTapCount && nowMs() - editorSecretTapLastAt > 700) resetEditorSecretTap();
        return false;
      }
      var t = nowMs();
      if (!editorSecretTapCount || t - editorSecretTapLastAt > 700 || t - editorSecretTapStartedAt > 1800) {
        editorSecretTapCount = 1;
        editorSecretTapStartedAt = t;
      } else editorSecretTapCount += 1;
      editorSecretTapLastAt = t;
      if (editorSecretTapCount >= 3) {
        resetEditorSecretTap();
        editorButtonVisible = true;
        triggerHaptic('medium');
        playUiClickSound();
        showToastMessage('地图编辑入口已开启');
      }
      return true;
    }

    function handlePress(px, py) {
      // 浏览器层以外再设游戏层门禁：网页按钮/鼠标/模拟触摸不能绕过扫码。
      if (typeof window !== 'undefined' && window.__kioskBigScreen === true) {
        if (window.__kioskSessionAuthorized !== true && scene !== 'loading' && scene !== 'tutorial_comic' && scene !== 'editor') return;
        if (scene === 'golden_skill' && goldenSkillState.kioskAutoSwing) return;
      }
      lastInputX = px; lastInputY = py; lastInputAt = nowMs();
      ensureAudio();
      if (scene === 'loading') return;
      if (editorButtonVisible && pointInHotspot(px, py, uiHotspots.editorEnter)) {
        queueUiAction('editor_enter', function() {
          editorButtonVisible = false;
          if (rewardDialog.active && rewardDialog.claimed) continueRewardRevive();
          else if (rewardDialog.active) { closeRewardDialog(); reviveOffer.busy = false; }
          enterEditor();
        }, 'medium');
        return;
      }
      // 暂停键必须优先于右上角隐藏编辑入口的连点检测。
      // 两个区域原先有重叠，点在暂停键下半部时会被隐藏入口吞掉，表现为偶发无响应。
      var pausePressAllowed = scene === 'paused' || (scene === 'playing' && !portalState.entryActive);
      // 2026-10-11：网页大屏移除右上角暂停键 —— 热区一并失效（按钮不画 + 点了不暂停）。
      var kioskHidePause = false;
      try { kioskHidePause = typeof window !== 'undefined' && window.__kioskBigScreen === true; } catch (e) {}
      if (pausePressAllowed && !kioskHidePause && !leaderboardOpen && !rewardDialog.active && pointInHotspot(px, py, uiHotspots.pause)) {
        if (scene === 'playing') queueUiAction('pause', function() { pauseSettingsDrag = ''; setScene('paused'); }, 'light');
        else queueUiAction('play', resumeFromPause, 'light');
        return;
      }
      if (handleEditorSecretTap(px, py)) return;
      if (rewardDialog.active) {
        if (pointInHotspot(px, py, uiHotspots.rewardContinue)) { queueUiAction('reward_continue', function() { handleRewardDialogChoice('continue'); }, 'medium'); return; }
        if (pointInHotspot(px, py, uiHotspots.rewardAd)) { queueUiAction('reward_ad', function() { handleRewardDialogChoice('ad'); }, 'medium'); return; }
        if (pointInHotspot(px, py, uiHotspots.rewardShare)) { queueUiAction('reward_share', function() { handleRewardDialogChoice('share'); }, 'medium'); return; }
        if (pointInHotspot(px, py, uiHotspots.rewardEnergy)) { queueUiAction('reward_energy', function() { handleRewardDialogChoice('energy'); }, 'medium'); return; }
        if (pointInHotspot(px, py, uiHotspots.rewardPotato)) { queueUiAction('reward_potato', function() { handleRewardDialogChoice('potato'); }, 'medium'); return; }
        if (pointInHotspot(px, py, uiHotspots.rewardFreeRevive)) { queueUiAction('reward_free_revive', function() { handleRewardDialogChoice('free_revive'); }, 'medium'); return; }
        if (pointInHotspot(px, py, uiHotspots.rewardCooldown)) { queueUiAction('reward_cooldown', function() { handleRewardDialogChoice('cooldown'); }, 'medium'); return; }
        if (pointInHotspot(px, py, uiHotspots.rewardCancel)) { queueUiAction('reward_cancel', function() { handleRewardDialogChoice('cancel'); }, 'light'); return; }
        return;
      }
      if (scene === 'portal_preview') {
        if (pointInRect(px, py, uiHotspots.portalPreviewExit)) { triggerHaptic('light'); playUiClickSound(); closePortalPreview(); return; }
        if (pointInRect(px, py, uiHotspots.portalPreviewPause)) { triggerHaptic('light'); portalPreviewState.paused = !portalPreviewState.paused; return; }
        if (pointInRect(px, py, uiHotspots.portalPreviewRestart)) { triggerHaptic('light'); portalPreviewState.timer = 0; portalPreviewState.paused = false; return; }
        if (pointInRect(px, py, uiHotspots.portalPreviewSpeed)) { triggerHaptic('light'); cyclePortalPreviewSpeed(); return; }
        if (pointInRect(px, py, uiHotspots.portalPreviewMode)) { triggerHaptic('light'); cyclePortalPreviewMode(); return; }
        return;
      }
      if (scene === 'tutorial_comic') {
        pointerHeld = true;
        if (pointInRect(px, py, uiHotspots.tutorialComicSkip)) {
          triggerHaptic('medium');
          playUiClickSound();
          suppressNextRelease = true;
          startTutorialSequenceFromComic();
        }
        return;
      }
      if (leaderboardOpen) {
        if (pointInCircle(px, py, uiHotspots.leaderboardClose) || pointInHotspot(px, py, uiHotspots.leaderboardReturn)) {
          queueUiAction('leaderboard_return', closeLeaderboard, 'light'); return;
        }
        if (pointInHotspot(px, py, uiHotspots.leaderboardTotalTab)) { queueUiAction('leaderboard_total', function() { switchLeaderboardTab('total'); }, 'light'); return; }
        if (pointInHotspot(px, py, uiHotspots.leaderboardPersonalTab)) { queueUiAction('leaderboard_personal', function() { switchLeaderboardTab('personal'); }, 'light'); return; }
        // 开放数据域仅做后台同步，不再接管排行榜触摸（否则会吞掉拖动导致列表无法滚动）
        beginLeaderboardDrag(px, py);
        return;
      }
      if (scene === 'golden_skill') {
        // 不在按下阶段清除分享复活检查点。
        // 微信“转发成功”原生弹窗的“查看分享页”触摸在部分机型会穿透到小游戏；
        // 若此处清除存档，随后小游戏被重新拉起时就会错误进入首页。
        // 保护存档只在黄金番薯真正发射，或玩家明确放弃技能时清除。
        pointerHeld = true;
        if (!goldenSkillState.gestureActive) {
          goldenSkillState.selected = null;
          goldenSkillState.armed = false;
          goldenSkillState.power = 0;
          goldenSkillState.pullDistance = 0;
          goldenSkillState.uiOffsetX = 0;
          goldenSkillState.uiOffsetY = 0;
          goldenSkillState.dockProgress = 0;
          goldenSkillState.aimStartX = 0;
          goldenSkillState.aimStartY = 0;
          goldenSkillState.aimDragX = 0;
          goldenSkillState.phase = 'ready';
        }
        updateGoldenSkillSelection(px, py);
        if (!goldenSkillState.gestureActive && goldenSkillState.selected !== 'none') pointerHeld = false;
        return;
      }
      if (scene === 'golden_skill_ad') return;
      if (scene === 'editor') {
        if (handleEditorFileDialogPress(px, py)) return;
        // [删除选中·就地删除] 选中物体旁的红色 ✕ 徽标（优先于拖动/其他按钮，命中即删）
        if (pointInCircle(px, py, uiHotspots.editorDeleteInline)) {
          triggerHaptic('medium'); playUiClickSound();
          if (deleteEditorSelection()) showToastMessage('已删除选中');
          return;
        }
        if (pointInRect(px, py, uiHotspots.editorSave)) {
          triggerHaptic('medium'); playUiClickSound();
          if (kioskEditorTargetIndex !== null && kioskEditorTargetIndex >= 0) saveAndExitEditor();   // 现场编辑：保存并直接写回
          else openEditorFileDialog();
          return;
        }
        if (pointInRect(px, py, uiHotspots.editorPortalPreview)) { triggerHaptic('medium'); playUiClickSound(); openPortalPreview(); return; }
        if (pointInRect(px, py, uiHotspots.editorDelete)) { triggerHaptic('medium'); deleteEditorSelection(); return; }
        if (pointInRect(px, py, uiHotspots.editorFit)) { triggerHaptic('light'); fitEditorMap(); return; }
        if (pointInRect(px, py, uiHotspots.editorZoomIn)) { triggerHaptic('light'); zoomEditorBy(1.24); return; }
        if (pointInRect(px, py, uiHotspots.editorZoomOut)) { triggerHaptic('light'); zoomEditorBy(1 / 1.24); return; }
        var addButtons = uiHotspots.editorAdd || [];
        for (var abi = 0; abi < addButtons.length; abi++) {
          if (pointInRect(px, py, addButtons[abi])) { triggerHaptic('light'); addEditorItem(addButtons[abi].kind); return; }
        }
        // [v54 现场测试] 快速过关：随机三关分数（各 1000~2000）→ 总分结算 → 500 强排行榜
        if (pointInRect(px, py, uiHotspots.editorQuickClear)) {
          triggerHaptic('medium'); playUiClickSound();
          kioskQuickClearTest();
          return;
        }
        // [2026-10-13] 顶部「甲/乙/丙」标签页：点一下即切换到对应现场地图（三张各自独立编辑）
        var editorMapTabs = uiHotspots.editorMapTabs || [];
        for (var emt = 0; emt < editorMapTabs.length; emt++) {
          if (pointInRect(px, py, editorMapTabs[emt])) {
            triggerHaptic('light'); playUiClickSound();
            kioskSwitchMapEditor(editorMapTabs[emt].index);
            return;
          }
        }
        beginEditorDrag(px, py);
        return;
      }
      if (scene === 'unlock_gate') {
        if (!unlockGateState.unlocked && pointInHotspot(px, py, uiHotspots.unlockGateWheel)) {
          beginUnlockGateWheel(py);
          return;
        }
        if (pointInHotspot(px, py, uiHotspots.unlockGateConfirm)) {
          if (unlockGateState.unlocked) queueUiAction('next', continueToUnlockedStageFromGate, 'medium');
          else {
            stopUnlockGateWheelAutoSelection();
            queueUiAction('play', continueToSelectedStageFromGate, 'medium');
          }
        }
        return;
      }
      if (scene === 'portal_transition') return;
      if (scene === 'playing' && portalState.entryActive) return;
      if (scene === 'playing' && isTutorialStage() && tutorialFlow.finishPromptTimer > 0) {
        tutorialFlow.finishPromptTimer = 0; tutorialFlow.finishPromptTask = null;
        triggerHaptic('light'); playUiClickSound();
        return;
      }
      if (scene === 'playing' && isTutorialStage() && tutorialFlow.phase === 'intro') {
        if (pointInHotspot(px, py, uiHotspots.tutorialContinue)) dismissTutorialIntro();
        return;
      }
      if (scene === 'playing' && isTutorialStage() && tutorialFlow.phase === 'check') return;

      if (scene === 'paused') {
        if (skinPanelOpen) {
          if (skinPanelCloseHit(px, py)) { triggerHaptic('light'); playUiClickSound(); closeSkinPanel(); return; }
          if (pointInHotspot(px, py, uiHotspots.skinWearButton)) { equipSelectedSkinFromPanel(); return; }
          // 侧卡/箭头：先记录点击意图，松手时若未发生拖动才翻页 —— 同一片区域既能点、也能跟手拖拽滚轮。
          if (pointInHotspot(px, py, uiHotspots.skinWheelPrev) || pointInHotspot(px, py, uiHotspots.skinWheelLeftCard)) { armSkinWheelTap('prev'); return; }
          if (pointInHotspot(px, py, uiHotspots.skinWheelNext) || pointInHotspot(px, py, uiHotspots.skinWheelRightCard)) { armSkinWheelTap('next'); return; }
          return;
        }
        if (pointInHotspot(px, py, uiHotspots.pauseSkin)) { triggerHaptic('light'); playUiClickSound(); openSkinPanel(); return; }
        // [kiosk-audio] 已移除音乐/音效「开启关闭」开关：声音常开，不再提供静音切换。
        if (pointInHotspot(px, py, uiHotspots.pauseMusicSlider)) {
          pauseSettingsDrag = 'music';
          setMusicVolume(sliderValueFromX(px, uiHotspots.pauseMusicSlider));
          triggerHaptic('light');
          return;
        }
        if (pointInHotspot(px, py, uiHotspots.pauseSfxSlider)) {
          pauseSettingsDrag = 'sfx';
          setSfxVolume(sliderValueFromX(px, uiHotspots.pauseSfxSlider));
          triggerHaptic('light');
          return;
        }
        if (pointInHotspot(px, py, uiHotspots.pauseTrackPrevious)) { queueUiAction('previous', function() { changeBgmTrack(-1); }, 'light'); return; }
        if (pointInHotspot(px, py, uiHotspots.pauseTrackNext)) { queueUiAction('next', function() { changeBgmTrack(1); }, 'light'); return; }
        if (pointInHotspot(px, py, uiHotspots.pauseLeaderboard)) { openLeaderboardAtPlayer(false, 'friend'); return; }
        if (pointInHotspot(px, py, uiHotspots.pauseContinue)) { queueUiAction('play', resumeFromPause, 'medium'); return; }
        return;
      }
      if (scene === 'menu') {
        // PLAY 状态弹窗可再次点击任意位置立即关闭，不强制等待 1 秒。
        if (dailyLoginPopup.active) {
          triggerHaptic('light');
          playUiClickSound();
          dismissMenuPlayStatusPopup(true);
          return;
        }
        if (skinPanelOpen) {
          if (skinPanelCloseHit(px, py)) { triggerHaptic('light'); playUiClickSound(); closeSkinPanel(); return; }
          if (pointInHotspot(px, py, uiHotspots.skinWearButton)) { equipSelectedSkinFromPanel(); return; }
          // 侧卡/箭头：先记录点击意图，松手时若未发生拖动才翻页 —— 同一片区域既能点、也能跟手拖拽滚轮。
          if (pointInHotspot(px, py, uiHotspots.skinWheelPrev) || pointInHotspot(px, py, uiHotspots.skinWheelLeftCard)) { armSkinWheelTap('prev'); return; }
          if (pointInHotspot(px, py, uiHotspots.skinWheelNext) || pointInHotspot(px, py, uiHotspots.skinWheelRightCard)) { armSkinWheelTap('next'); return; }
          return;
        }
        if (stageSelectOpen) {
          if (pointInHotspot(px, py, uiHotspots.stageSelectClose)) { triggerHaptic('light'); playUiClickSound(); closeStageSelect(); return; }
          if (pointInHotspot(px, py, uiHotspots.stageSelectPrev)) { adjustStageSelect(-1); return; }
          if (pointInHotspot(px, py, uiHotspots.stageSelectNext)) { adjustStageSelect(1); return; }
          if (pointInHotspot(px, py, uiHotspots.stageSelectStart)) { queueUiAction('play', startSelectedStage, 'medium'); return; }
          return;
        }
        if (pointInHotspot(px, py, uiHotspots.menuLeaderboard)) { triggerHaptic('light'); playUiClickSound(); openLeaderboardAtPlayer(false, 'friend'); return; }
        if (pointInHotspot(px, py, uiHotspots.menuSkin)) { triggerHaptic('light'); playUiClickSound(); openSkinPanel(); return; }
        if (menuIntroOpen) {
          if (pointInCircle(px,py,uiHotspots.menuClose)) {
            triggerHaptic('light'); playUiClickSound();
            closeMenuIntroAndOpenStageSelect();
            return;
          }
          if (pointInRect(px,py,uiHotspots.menuStartTutorial)) { triggerHaptic('light'); playUiClickSound(); menuIntroOpen = false; requestPlayerProfile(function(){ openTutorialComic(0); }); return; }
          return;
        }
        if (pointInHotspot(px,py,uiHotspots.play)) {
          triggerHaptic('light');
          playUiClickSound();
          showMenuPlayStatusPopup();
        }
        return;
      }
      if (scene === 'score_tally') {
        // [kiosk 2026-10-11 下午] 现场记分板由【空白键】推进：
        //   第 1 按 → 跳过翻牌动画直接出计分结果；第 2 按 → 进入下一轮（变身视频/换人/总板）。
        if (kioskRun.active) {
          if (!finishState.tallyComplete) {
            var kTallyItems = finishState.scoreItems || [];
            finishState.tallyValues = kTallyItems.map(function(item) {
              return Math.round(Number(item.value) || 0);
            });
            finishState.tallyScore = finishState.tallyValues.length ? finishState.tallyValues[finishState.tallyValues.length - 1] : 0;
            finishState.tallyFood = finishState.tallyValues[0] || 0;
            finishState.tallyTimer = 99;
            finishState.tallyComplete = true;
            triggerHaptic('light'); playUiClickSound();
            return;
          }
          if (!finishState.kioskTallyQueued) {
            finishState.kioskTallyQueued = true;   // 防连按重复推进
            triggerHaptic('light'); playUiClickSound();
            // 2026-10-12 修复：普通玩法（非 debug）此处从未记录本轮得分，
            // 导致 kioskRunSummary 合计三轮结果恒为 0/错位。先落盘本轮 score 再推进。
            kioskFinishCharacter(true);
            kioskAfterRoundTally();
          }
          return;
        }
        if (!finishState.tallyComplete) {
          var tallyItems = finishState.scoreItems || [];
          finishState.tallyValues = tallyItems.map(function(item) {
            return Math.round(Number(item.value) || 0);
          });
          finishState.tallyScore = finishState.tallyValues.length ? finishState.tallyValues[finishState.tallyValues.length - 1] : 0;
          finishState.tallyFood = finishState.tallyValues[0] || 0;
          finishState.tallyTimer = 99;
          finishState.tallyComplete = true;
          triggerHaptic('light'); playUiClickSound();
          return;
        }

        if (isTutorialStage()) {
          if (pointInHotspot(px, py, uiHotspots.replay)) {
            queueUiAction('restart', function(){ startRun(true); }, 'medium');
            return;
          }
          if (pointInHotspot(px, py, uiHotspots.nextLevel)) {
            queueUiAction('next', function() {
              var finalTutorial = stageIndex < MAIN_STAGE_START && clampStageIndex(stageIndex + 1) >= MAIN_STAGE_START;
              if (finalTutorial) {
                progress.tutorialSeen = true; progress.currentStage = MAIN_STAGE_START;
                progress.firstThreeCleared = firstSequenceClearedCount(progress);
                progress.unlockedStage = Math.max(Number(progress.unlockedStage) || 0, MIN_UNLOCKED_STAGE);
                saveProgress(); menuIntroOpen = false; launchStagePortalTransition(MAIN_STAGE_START);
              } else { advanceStage(); startRun(true); }
            }, 'medium');
          }
          return;
        }

        if (getNextStageUnlockView().wrap) return;

        if (pointInHotspot(px,py,uiHotspots.replay)) {
          // 过关后的"再玩一次"/"重新开始"不消耗额外游戏次数——玩家已经为本次会话付过费（首页进入时已扣）。
          // 仅从首页点击"开始游戏"才通过 requestFormalPlay() 检查并消耗次数。
          queueUiAction('restart', function(){ submitRunToLeaderboard('restart'); if (isTutorialStage()) startRun(true); else beginFormalPlay(stageIndex, true); }, 'medium');
          return;
        }

        queueUiAction('next', function() {
          var finTut = stageIndex < MAIN_STAGE_START && clampStageIndex(stageIndex+1) >= MAIN_STAGE_START;
          if (finTut) { progress.tutorialSeen=true; progress.currentStage=MAIN_STAGE_START; progress.firstThreeCleared=firstSequenceClearedCount(progress); progress.unlockedStage=Math.max(Number(progress.unlockedStage)||0, MIN_UNLOCKED_STAGE); saveProgress(); menuIntroOpen=false; launchStagePortalTransition(MAIN_STAGE_START); }
          else attemptAdvanceAfterTally();
        }, 'medium');
        return;
      }
      // [v42 现场 2026-11-01] 线下闯关死亡面板不可操作：没有复活，点击一律忽略，
      //   由 kioskOnDeath 的 21s 定时器自动收尾回待机。防止顾客误触「继续挑战」把流程带进
      //   复活分支 → 游戏结束面板（含「重新开始」）→ 榜单收起后卡在那个面板上。
      if (scene === 'death') {
        if (kioskRun.active) return;
        if (pointInHotspot(px,py,uiHotspots.play)) { queueUiAction('play', respawnAfterDeath, 'medium'); } return;
      }
      if (scene === 'game_over') {
        if (kioskRun.active) return;   // 线下闯关：不响应排行榜 / 重新开始 / 返回首页
        if (pointInHotspot(px, py, uiHotspots.gameOverLeaderboard)) {
          gameOverState.leaderboardShown = true;
          openLeaderboardAtPlayer(false, 'friend');
          return;
        }
        if (pointInHotspot(px, py, uiHotspots.gameOverRestart)) {
          queueUiAction('restart', function() { releaseDeathCameraLock(); requestFormalPlay(stageIndex, true); }, 'medium');
          return;
        }
        if (pointInHotspot(px, py, uiHotspots.gameOverHome)) {
          queueUiAction('play', function() { releaseDeathCameraLock(); returnToMenuAfterGameOver(); }, 'medium');
          return;
        }
        return;
      }
      if (scene === 'finish_slowmo') return;
      if (scene !== 'playing') return;
      // 2026-10-01：变蛇期间手指只负责拖拽蛇头，不再触发伸舌。
      if (isSnakeFormActive()) { pointerHeld = false; return; }
      if (isTutorialStage() && pointInHotspot(px,py,uiHotspots.skip)) { queueUiAction('next', function() { skipTutorialSequence(); }, 'medium'); return; }
      if (isTutorialStage() && (tutorialTaskIs('life') || tutorialTaskIs('rescue_only')) && !tutorialFlow.lifeLost) { pointerHeld = false; return; }
      tutorialInputSeen = true; tutorialHintTimer = Math.max(tutorialHintTimer, 2.6);
      pointerHeld = true;
      if (player.attachIndex === null) primeTongue();
    }

    function handleRelease() {
      if (typeof window !== 'undefined' && window.__kioskBigScreen === true) {
        if (window.__kioskSessionAuthorized !== true && scene !== 'loading' && scene !== 'tutorial_comic' && scene !== 'editor') { pointerHeld = false; return; }
        if (scene === 'golden_skill' && goldenSkillState.kioskAutoSwing) { pointerHeld = false; return; }
      }
      if (scene === 'tutorial_comic') {
        // 菜单教学按钮与漫画共用同一次触摸时，只消费 touchend，不翻到第 2 页。
        if (Number(tutorialComicState.entryTouchStartMs) >= 0 && Number(lastTouchStartMs) === Number(tutorialComicState.entryTouchStartMs)) {
          tutorialComicState.entryTouchStartMs = -1;
          pointerHeld = false;
          return;
        }
        var dxComic = (Number(lastInputX) || 0) - (Number(lastTouchStartX) || 0);
        var dyComic = (Number(lastInputY) || 0) - (Number(lastTouchStartY) || 0);
        var tappedSkip = pointInRect(Number(lastTouchStartX) || 0, Number(lastTouchStartY) || 0, uiHotspots.tutorialComicSkip) ||
          pointInRect(Number(lastInputX) || 0, Number(lastInputY) || 0, uiHotspots.tutorialComicSkip);
        pointerHeld = false;
        if (tappedSkip) return;
        if (dxComic > 48 && Math.abs(dyComic) < 84) { advanceTutorialComicPage(false); return; }
        if (Math.abs(dxComic) < 18 && Math.abs(dyComic) < 18) { advanceTutorialComicPage(false); return; }
        return;
      }
      if (scene === 'golden_skill' && goldenSkillState.menuActive) {
        var hadSkillGesture = pointerHeld || goldenSkillState.gestureActive || goldenSkillState.selected === 'none';
        pointerHeld = false;
        var completedDock = goldenSkillState.phase === 'aiming' && Number(goldenSkillState.dockProgress) >= 0.985;
        goldenSkillState.gestureActive = false;
        if (!hadSkillGesture) return;
        if (goldenSkillState.selected === 'none') resolveGoldenSkillSelection('none');
        else if (completedDock && goldenSkillState.armed) resolveGoldenSkillSelection('launch');
        else resolveGoldenSkillSelection('retry');
        return;
      }
      pointerHeld = false;
      if (leaderboardOpen) { endLeaderboardDrag(); return; }
      if (suppressNextRelease) { suppressNextRelease = false; return; }
      if (scene === 'paused') { pauseSettingsDrag = ''; return; }
      if (scene === 'editor') { endEditorDrag(); return; }
      if (scene === 'unlock_gate') { endUnlockGateWheel(); return; }
      if (!player) return;
      try {
        var pendingTapIndex = player.pendingAttachIndex;
        var wasQuickTap = player.pressOpenTimer > 0;
        if (player.pressOpenTimer > 0) { player.pressOpenTimer = 0; player.pendingAttachIndex = null; player.pendingAimAngle = null; player.mouthOpen = 0; }
        if (scene === 'playing') {
          if (wasQuickTap && pendingTapIndex !== null) {
            player.tapGuideIndex = pendingTapIndex; player.tapGuideTimer = 1.0;
          }
          if (tutorialTaskIs('connect_release') && player.attachIndex !== null) {
            var releaseSpeed = Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0);
            var highEnough = player.y < runtimeLevel.height * 0.58;
            if (tutorialFlow.attachedHoldTimer >= 0.35 && highEnough && releaseSpeed >= 165) completeTutorialTask('high_release', { duration: 1.0, requireAirborne: true });
            else if (tutorialFlow.attachedHoldTimer >= 0.35) showToastMessage('再摆荡高一点、速度更快时放手');
          }
          detachTongue();
        }
      } catch (err) { console.error('handleRelease error:', err && err.message); }
    }

    function loop() {
      // [web-debug] 只读状态钩子，供网页版 CDP 调试用（仅 hangzhou_web 副本）
      if (typeof window !== 'undefined' && !window.__tutState) {
        try {
          window.__tutState = function () {
            return {
              scene: scene,
              leaderboardOpen: leaderboardOpen,
              tutorialPhase: tutorialFlow ? tutorialFlow.phase : null,
              tutorialTask: tutorialFlow && tutorialFlow.currentTask ? tutorialFlow.currentTask.id : null,
              attachIndex: player ? player.attachIndex : null,
              pointerHeld: pointerHeld,
              playerXY: player ? [Math.round(player.x), Math.round(player.y)] : null,
              playerV: player ? [Math.round(player.vx), Math.round(player.vy)] : null,
              holdTimer: tutorialFlow ? Number(tutorialFlow.attachedHoldTimer || 0).toFixed(2) : null,
              fitScale: fitScale, offX: offX, offY: offY,
              viewWH: [VIEW_W, VIEW_H],
              stageIndex: stageIndex,
              currentStage: progress && progress.currentStage,
              unlockedStage: progress && progress.unlockedStage,
              round: progress && progress.round,
              skinId: activeSkinId(),
              skinDebug: (function () {
                try {
                  return {
                    equipped: skinState && skinState.equipped,
                    ownedBai: !!(skinState && skinState.owned && skinState.owned.bainiangzi),
                    eggEnabled: snakeMaidEggEnabled(),
                    foodKinds: runtimeLevel ? (runtimeLevel.foods || []).map(function (f) { return f.kind; }) : null
                  };
                } catch (e) { return { err: String(e) }; }
              })(),
              eggFood: (function () {
                try {
                  var fs = (runtimeLevel && runtimeLevel.foods) || [];
                  for (var i = 0; i < fs.length; i++) {
                    if (fs[i] && fs[i].kind === 'xionghuangjiu') return { present: true, x: Math.round(fs[i].x), y: Math.round(fs[i].y), collected: !!fs[i].collected };
                  }
                } catch (e) {}
                return { present: false };
              })(),
            };
          };
        } catch (e) {}

      // [web-kiosk] 线下次数门禁用：网页层在「按空格扣一次次数」后需要进入「选择人物」页。
      // core 内部的 openSkinPanel 不在任何 cfg 桥接项里，网页层无法直接调，故在此暴露一个最小桥。
      // 只做「打开皮肤/人物选择面板」这一件事，逻辑仍留在 core 内（勿把状态搬到网页层）。
      // 放在 __tutState 的 guard 之外：那是调试钩子，可能已被占用/被删，次数功能不能依赖它。
      if (typeof window !== 'undefined' && !window.__openCharacterSelect) {
        try {
          window.__openCharacterSelect = function () {
            try {
              if (scene !== 'menu' && scene !== 'paused') return { ok: false, reason: 'bad_scene:' + scene };
              openSkinPanel();
              return { ok: true, skinPanelOpen: skinPanelOpen };
            } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
          };
          // 供网页层判断「选择人物页是否已打开」，避免重复扣次数
          window.__isCharacterSelectOpen = function () {
            try { return !!skinPanelOpen; } catch (e) { return false; }
          };
          // [web-kiosk] 大屏无人值守「一个按钮」流程：
          //  ① 第一次按键 → 打开人物转盘（自动循环转动），不扣次数；
          //  ② 第二次按键 → 选定当前人物并【直接开战】（跳过选关，锁杭州 L4）。
          window.__kioskSelectOpen = function () {
            try {
              if (scene !== 'menu' && scene !== 'paused') return { ok: false, reason: 'bad_scene:' + scene };
              openSkinPanel();
              setSkinWheelAutoSpin(true);   // 大屏：转盘自动循环转动
              return { ok: true };
            } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
          };
          window.__kioskSelectConfirm = function () {
            try {
              var idx = normalizeSkinPanelIndex(skinPanelIndex);
              var def = SKIN_DEFS[idx] || SKIN_DEFS[0];
              var equipped = false;
              if (def) { try { equipped = !!triggerSkinCardAction(def.id); } catch (e) { equipped = false; } }
              setSkinWheelAutoSpin(false);
              skinPanelOpen = false;
              stageSelectOpen = false;
              menuIntroOpen = false;
              try { dailyLoginPopup.active = false; } catch (e) {}
              var target = -1;
              for (var i = 0; i < STAGES.length; i++) {
                if (STAGES[i] && String(STAGES[i].cityId || '') === 'hangzhou') { target = i; break; }
              }
              if (target < 0) return { ok: false, reason: 'no_hangzhou_stage' };
              // 线下大屏每次进入都是杭州关：直接锁定目标关，避免被历史存档带偏
              progress.currentStage = target;
              if (Math.round(Number(progress.round) || 1) < 2) {
                progress.unlockedStage = Math.max(clampStageIndex(Number(progress.unlockedStage) || 0), target);
              }
              progress.tutorialSeen = true;
              saveProgress();
              stageSelectIndex = target;
              requestPlayerProfile(function () { requestFormalPlay(target, true); });
              return { ok: true, skin: def && def.id, skinName: def && def.name, stage: target, equipped: equipped };
            } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
          };
          // 只读状态：网页层据此切换「等待扫码 / 游戏中 / 回到待机」三态
          // [web-kiosk 2026-10-10 晚 v5] 「一个实体按钮玩通全场」的兜底桥。
          // 人物转盘由 __kioskSelectConfirm 显式桥接；阵亡/结算/失败/暂停/教学漫画/解锁门
          // 这些「需要一个确认动作」的场景也把按键落到该场景主按钮热区上 ——
          // 等价于在该按钮中心点一下（走真实 handlePress/handleRelease 通道，不复制任何业务逻辑）。
          // 热区由渲染模块每帧经 renderSetUiHotspots 写入，运行时必定可用。
          window.__kioskPrimaryTap = function () {
            try {
              // [kiosk 闯关] 阵亡/失败由 core 自动收尾回首页 —— 按键在这两个场景不做事（避免误复活）
              if (kioskRun.active && (scene === 'death' || scene === 'game_over')) {
                return { ok: false, reason: 'kiosk_auto_return' };
              }
              var r = null;
              if (scene === 'death') r = uiHotspots.play;
              else if (scene === 'game_over') r = uiHotspots.gameOverRestart;
              else if (scene === 'score_tally') r = uiHotspots.nextLevel || uiHotspots.replay;
              else if (scene === 'paused') r = uiHotspots.pauseContinue;
              else if (scene === 'tutorial_comic') r = uiHotspots.tutorialComicSkip;
              else if (scene === 'unlock_gate') r = uiHotspots.unlockGateConfirm;
              if (!r || typeof r.x !== 'number' || typeof r.y !== 'number') {
                return { ok: false, reason: 'no_primary:' + scene };
              }
              var px = Number(r.x), py = Number(r.y);
              lastInputX = px; lastInputY = py;
              lastTouchStartX = px; lastTouchStartY = py; lastTouchStartMs = nowMs();
              handlePress(px, py);
              handleRelease();
              return { ok: true, scene: scene };
            } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
          };
          window.__kioskGameState = function () {
            try {
              var def = SKIN_DEFS[normalizeSkinPanelIndex(skinPanelIndex)] || {};
              var kioskHidePause = false;
              try { kioskHidePause = typeof window !== 'undefined' && window.__kioskBigScreen === true; } catch (e) {}
              return {
                scene: scene,
                skinPanelOpen: !!skinPanelOpen,
                stageSelectOpen: !!stageSelectOpen,
                autoSpin: !!skinWheelAutoSpin,
                skinIndex: skinPanelIndex,
                skinId: def.id || '',
                skinName: def.name || '',
                fitScale: fitScale, offX: offX, offY: offY,
                kioskHidePause: kioskHidePause,
                potatoBank: goldenPotatoBank(),   // [2026-10-31] 供验收脚本读取（网页端应恒为本次登入的 5 颗）
                foods: (runtimeLevel && Array.isArray(runtimeLevel.foods))
                  ? runtimeLevel.foods.map(function (f) { return { kind: f.kind, points: f.points }; }) : []
              };
            } catch (e) { return { scene: '', error: String(e && e.message || e) }; }
          };
          // [kiosk 2026-10-10 晚] 线下「三侠闯关」：开始一轮（三位角色按序各打一关杭州）
          window.__kioskRunStart = function () {
            try {
              if (window.__kioskBigScreen === true && window.__kioskSessionAuthorized !== true)
                return { ok: false, reason: 'scan_required' };
              if (scene !== 'menu' && scene !== 'paused') return { ok: false, reason: 'bad_scene:' + scene };
              if (skinPanelOpen) { skinPanelOpen = false; setSkinWheelAutoSpin(false); }
              menuIntroOpen = false; stageSelectOpen = false; leaderboardOpen = false;
              try { dailyLoginPopup.active = false; dailyLoginPopup.pending = false; } catch (e) {}
              kioskRun.active = true; kioskRun.index = 0; kioskRun.results = [];
              kioskRun.dying = false; kioskRun.complete = false;
              // [2026-10-31 需求3] 每位顾客「登入」开局都固定 5 颗黄金番薯：上一个顾客花掉的不继承。
              try { resetKioskPotatoForSession(); } catch (ignoreKioskPotatoReset) {}
              kioskRun.order = KIOSK_CHARACTER_ORDER.slice();   // 固定出场：阿蜥→白娘子→小青
              kioskRun.videoPending = ''; kioskRun.roundSnapshot = 0;
              kioskRun.mapOrder = kioskMapOrder();   // 每轮开局随机分配三张地图（三关不重复）
              kioskRun.potatoes = KIOSK_START_POTATOES;     // 2026-10-11 下午：登录直接送 5 颗番薯
              goldenSkillState.points = KIOSK_START_POTATOES;
              if (!kioskStartCharacter(0)) { kioskRun.active = false; return { ok: false, reason: 'no_hangzhou_stage' }; }
              // [2026-10-13 修复] 开局即对「对局」放声：现场顾客「扫码 → 自动开局」链路可以不碰任何按键，
              //   若此前没人按过「第 2 下 · 开声音」，音频闸门一直是关的 → 整局没有音乐音效。
              //   对局已成立后闸门不该再拦，这里主动把声音拉起来（幂等；页面无该桥时跳过）。
              try { if (window.__kioskAudioOn !== true && window.__kioskEnableAudio) window.__kioskEnableAudio(); } catch (e) {}
              return { ok: true, skin: kioskOrder()[0], total: kioskOrder().length };
            } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
          };
          // 游戏内直接操作同一份技能状态，不依赖模拟滑动（避免误触重置蓄力）。
          window.__kioskGoldenSkillFire = function () {
            if (!kioskAutoGoldenSkillEnabled() || scene !== 'golden_skill' ||
                !goldenSkillState.menuActive || !goldenSkillState.kioskAutoSwing ||
                !goldenSkillState.armed || window.__kioskSessionAuthorized !== true)
              return { ok: false, reason: 'not_armed' };
            return { ok: !!applyGoldenSkill(goldenSkillState.aimAngle, 1) };
          };
          window.__kioskGoldenSkillDebug = function () {
            return { active: !!goldenSkillState.kioskAutoSwing, phase: goldenSkillState.phase,
              armed: !!goldenSkillState.armed, power: goldenSkillState.power,
              dockProgress: goldenSkillState.dockProgress, aimAngle: goldenSkillState.aimAngle,
              menuActive: !!goldenSkillState.menuActive,
              remain: Math.max(0, Number(goldenSkillState.kioskRescueRemain) || 0),
              deadline: Number(goldenSkillState.kioskRescueDeadline) || 0 };
          };
          window.__kioskAudioDebug = function () {
            try {
              var bgmDoc = bgmState.inner && bgmState.inner._audio ? bgmState.inner._audio : null;
              return {
                ctxState: audioState.webCtx ? (audioState.webCtx.state || 'n/a') : 'no-ctx',
                master: !!audioState.master,
                unlocked: !!audioState.unlocked,
                buffers: Object.keys(audioState.buffers || {}).length,
                preloadSettled: audioState.preloadSettled || 0,
                preloadTotal: audioState.preloadTotal || 0,
                bgmEnabled: !!bgmState.enabled,
                bgmCurrent: bgmState.currentPath || '',
                // [v46] BGM 实际输出音量（含 BGM_OUTPUT_TRIM，0.5 衰减）——现场查「音乐是否过响」用
                bgmVolume: bgmOutputVolume(),
                bgmElemVolume: bgmState.inner && bgmState.inner._audio ? Number(bgmState.inner._audio.volume) : null,
                bgmPaused: bgmDoc ? bgmDoc.paused : null,
                bgmMuted: bgmDoc ? bgmDoc.muted : null,
                bgmTime: bgmDoc ? Number(bgmDoc.currentTime || 0) : null,
                bgmVol: bgmDoc ? Number(bgmDoc.volume || 0) : null,
                bgmRs: bgmDoc ? bgmDoc.readyState : null,
                bgmNet: bgmDoc ? bgmDoc.networkState : null,
                bgmReject: bgmState.inner ? !!bgmState.inner._playRejected : null,
                bgmErr: bgmDoc ? (bgmDoc.error && bgmDoc.error.code) || null : null,
                // [2026-10-13] 把「音效到底出不出声」也暴露出来（原先 musicOn 恒为 undefined，
                //   无法判断音效是否被静音）。masterGain>0 且 ctx running ⇒ 音效真的能出声。
                musicOn: !!settings.musicOn,
                sfxOn: !!settings.sfxOn,
                audioAllowed: isGameAudioAllowed(),
                externalBusy: !!audioState.externalAudioBusy,
                // [2026-10-14] 把「浏览器是否已记录过用户激活」暴露出来：sticky activation 是
                //   autoplay 放行的前提，没有它则任何 play()/resume() 都不可能成功。
                hasBeenActive: (function () {
                  try { return !!(navigator.userActivation && navigator.userActivation.hasBeenActive); }
                  catch (e) { return null; }
                })(),
                masterGain: (audioState.master && audioState.master.gain)
                  ? Number(audioState.master.gain.value) : null
              };
            } catch (e) { return { err: String(e) }; }
          };
          // 浏览器 autoplay 策略自愈：首次程序化 play() 可能被拒，之后每次用户手势（index.html 桥接）
          // 都解锁 WebAudio 并把「本该在放却暂停着的 BGM」拉起来。
          // [2026-10-14 v33] BGM 场景闸门（统一口径）：只在「游戏进行中」允许补起/复活 BGM。
          //   记分板/死亡结算/变身视频/传送门/菜单待机一律不放 —— 页面手势桥(index.html kioskAction)、
          //   __kioskEnableAudio、看门狗都会走到这里，此前任何一次按键都会把刚停掉的 BGM 重新拉起。
          function bgmSceneAllowedNow() {
            return scene === 'playing' || scene === 'paused' || scene === 'golden_skill' ||
              scene === 'golden_skill_ad' || scene === 'finish_slowmo';
          }
          window.__stwxUnlockAudio = function () {
            try { unlockWebAudioFromGesture(); } catch (e) {}
            audioState.unlocked = true;
            try {
              // [v23] 若 BGM 还没起（早于 bgmManifest 就绪时用户就先手势），这里补起。
              //   [v33] 仅限游玩场景：待机/结算/看视频期间手势不再把 BGM 拉起来。
              if (bgmSceneAllowedNow() && !bgmState.inner && settings.musicOn && bgmState.enabled && isGameAudioAllowed()) {
                var tr0 = resolveBgmTrackForStage(runtimeLevel, stageIndex);
                var p0 = (tr0 && tr0.track && tr0.track.path) || resolveBgmPath(runtimeLevel && runtimeLevel.theme, runtimeLevel, stageIndex);
                if (p0) playBgmPath(p0);
              }
              var doc = bgmState.inner && bgmState.inner._audio ? bgmState.inner._audio : null;
              // [v25] 只有「声音已开」（大屏按过第 2 下）才取消静音/补播；否则前两下保持静音。
              if (doc && isGameAudioAllowed()) {
                // 手势内取消静音（浏览器放行）；被静音预热卡住的 BGM 用强制有声重播拉起来。
                try { doc.muted = false; } catch (e0) {}
                if (doc.paused && bgmState.currentPath && bgmState.enabled && settings.musicOn) {
                  var p = bgmState.inner.play({ forceSound: true });
                  if (p && p.catch) p.catch(function () {});
                }
              }
              // 变身视频：手势内也取消静音（transform 视频在过关后才播，通常已有激活）
              try {
                var tvs = [document.getElementById('tfVideoBai'), document.getElementById('tfVideoQing')];
                for (var ti = 0; ti < tvs.length; ti++) {
                  if (tvs[ti] && !tvs[ti].paused) { try { tvs[ti].muted = false; } catch (e1) {} }
                }
              } catch (e2) {}
            } catch (e) {}
            return { ctxState: audioState.webCtx ? audioState.webCtx.state : 'no-ctx' };
          };
          // [v25] 大屏第 2 下「开声音」专用：解除音频闸门（__kioskAudioOn=true）→ 强制激活 shim 侧
          //       全部 InnerAudio（解静音重播）+ resume WebAudio + 取消背景视频静音 + 拉起 BGM。
          //       返回诊断信息，便于验收断言「声音确实开了」。
          window.__kioskEnableAudio = function () {
            try { window.__kioskAudioOn = true; } catch (e) {}
            // [2026-10-13 修复] 音效总增益重算：闸门是「先关后开」的，WebAudio 创建时闸门还没开
            //   → master.gain 被锁成 0，而原先没有任何地方在「开声音」时重算它 → 整局听不到音效。
            try { refreshSfxOutput(); } catch (eSfx) {}
            // shim：重扫所有 InnerAudio 解除静音阻塞（强制版，忽略一次性标志）
            try { if (window.__stwxForceActivateAudio) window.__stwxForceActivateAudio(); } catch (e) {}
            // core：resume WebAudio + 补播被拒过的 BGM
            try { if (window.__stwxUnlockAudio) window.__stwxUnlockAudio(); } catch (e) {}
            // 大屏背景视频取消静音
            try { if (window.__kioskUnmuteBgVideo) window.__kioskUnmuteBgVideo(); } catch (e) {}
            // 兜底：确保 BGM 路径已解析并出声（[v33] 仅限游玩场景 —— 待机/结算/看视频不放歌）
            try {
              // [2026-10-15 v64] 恢复路径优先续播当前 BGM（playBgmForLevel 已按轮次选好第2轮 night）。
              //   旧写法每 2.5s 按关卡清单重解析 → 永远解析回第一首 —— 这正是「第2关播2秒被看门狗
              //   切回第1首」的根因（第1/3关本来就放第一首，故只有第2关暴露）。
              var path = bgmState.currentPath ||
                (function () {
                  var tr0 = resolveBgmTrackForStage(runtimeLevel, stageIndex);
                  return (tr0 && tr0.track && tr0.track.path) || resolveBgmPath(runtimeLevel && runtimeLevel.theme, runtimeLevel, stageIndex);
                })();
              if (path && bgmSceneAllowedNow() && isGameAudioAllowed()) playBgmPath(path);
              var doc = bgmState.inner && bgmState.inner._audio ? bgmState.inner._audio : null;
              if (doc) {
                try { doc.muted = false; } catch (e0) {}
                if (doc.paused && bgmState.currentPath) {
                  var pp = bgmState.inner.play({ forceSound: true });
                  if (pp && pp.catch) pp.catch(function () {});
                }
              }
            } catch (e) {}
            var d2 = bgmState.inner && bgmState.inner._audio ? bgmState.inner._audio : null;
            // [2026-10-14] 本函数几乎总是**在手势处理器内部**被调用（按键第 2 下 / 开局兜底），
            //   而手势内的 play() 必被 autoplay 策略拒（实测）→ 必须再排一轮「手势后阶梯重试」。
            try { if (window.__stwxPumpAudioRetry) window.__stwxPumpAudioRetry('kiosk-enable'); } catch (e4) {}
            try { audioRecoverOnce('kiosk-enable'); } catch (e5) {}
            return { ctxState: audioState.webCtx ? audioState.webCtx.state : 'no-ctx',
                     audioOn: !!window.__kioskAudioOn,
                     bgmPath: bgmState.currentPath || '',
                     bgmPaused: d2 ? d2.paused : null,
                     bgmMuted: d2 ? d2.muted : null };
          };
          // ===== [2026-10-14] 音频激活恢复：**唯一补声入口** =====
          // 为什么需要：浏览器 autoplay 策略要求「sticky 用户激活」，且在**手势处理器内部**同步
          //   调用 play()/resume() 依然会被拒（实测：手势内 play → NotAllowedError，手势结束后
          //   同一元素 play → resolved；零手势时 ctx.resume() 永远 pending 不 reject）。
          //   现场「扫码 → 自动开局」可以全程没有任何手势 → 开局时所有 play() 被拒、WebAudio
          //   停在 suspended ⇒ **整局没有音乐也没有音效**（这就是本轮排查出的真因）。
          //   因此把补声集中到「手势之后」与对局期间的持续自愈里。
          function audioRecoverOnce(tag) {
            try {
              // 1) 闸门：待机/菜单还没「开声音」时不补（保持待机安静）；对局中一律放行
              if (typeof window !== 'undefined' && window.__kioskAudioOn === false && !(kioskRun && kioskRun.active)) {
                return { skipped: 'gated' };
              }
              // 2) 音效总增益自愈（闸门「先关后开」时 master.gain 会被锁成 0，需重算）
              if (sfxState.enabled && isGameAudioAllowed()) {
                var gWanted = 0.52 * sfxVolumeNow();
                var gNow = (audioState.master && audioState.master.gain)
                  ? Number(audioState.master.gain.value) : 0;
                if (gWanted > 0 && !(gNow > 0)) refreshSfxOutput();
              }
              // 3) WebAudio resume：零手势时 promise 挂起（无害）；一旦有激活就会 running
              try { unlockWebAudioFromGesture(); } catch (eR) {}
              // 4) 背景音乐：缺则拉起、静音则解除、暂停则补播
              //    [2026-10-14 v33 用户需求] BGM 只在「游戏进行中」放：非游玩场景（记分板/死亡结算/
              //    变身视频/传送门/菜单待机）一律不复活 BGM —— 否则看门狗每 1.2s 会把刚停掉的
              //    BGM 重新拉起，造成「不放游戏也一直有音乐」。游玩场景由 playBgmForLevel 正常起播。
              if (bgmSceneAllowedNow() && bgmState.enabled && settings.musicOn && isGameAudioAllowed()) {
                if (!bgmState.inner) {
                  // [2026-10-15 v64] 同 __kioskEnableAudio：优先续播当前轮次 BGM，勿按清单重解析回第一首
                  var pR = bgmState.currentPath ||
                    (function () {
                      var trR0 = resolveBgmTrackForStage(runtimeLevel, stageIndex);
                      return (trR0 && trR0.track && trR0.track.path) || resolveBgmPath(runtimeLevel && runtimeLevel.theme, runtimeLevel, stageIndex);
                    })();
                  if (pR) playBgmPath(pR);
                }
                var docR = bgmState.inner && bgmState.inner._audio ? bgmState.inner._audio : null;
                if (docR) {
                  if (docR.muted) { try { docR.muted = false; } catch (e0) {} }
                  // [2026-10-14 v31] 「假播放」自愈：paused=false 但资源从未加载（net=0/rs<2）
                  //   → load() 强制重启资源选择 + forceSound 重播（见 wx-shim play-reject 修复）
                  try {
                    if ((docR.networkState || 0) === 0 && !docR.currentSrc && String(bgmState.currentPath || '') !== '') {
                      docR.src = bgmState.currentPath;
                      docR.load();
                    }
                  } catch (eLoad) {}
                  if (docR.paused || (docR.readyState || 0) < 2) {
                    var p3 = bgmState.inner.play({ forceSound: true });
                    if (p3 && p3.catch) p3.catch(function () {});
                  }
                }
              }
              var dR2 = bgmState.inner && bgmState.inner._audio ? bgmState.inner._audio : null;
              return { ctx: audioState.webCtx ? audioState.webCtx.state : 'no-ctx',
                       bgm: bgmState.currentPath || '',
                       bgmPaused: dR2 ? dR2.paused : null,
                       bgmMuted: dR2 ? dR2.muted : null,
                       gain: (audioState.master && audioState.master.gain) ? Number(audioState.master.gain.value) : null };
            } catch (e) { return { err: String(e && e.message || e) }; }
          }
          // 供 wx-shim.js 的「手势后阶梯重试」(__stwxPumpAudioRetry) 调用
          window.__stwxAudioRetryNow = function () { return audioRecoverOnce('retry'); };
          window.__stwxAudioRecover = audioRecoverOnce;
          // [v46 现场排障] 画质/帧率探针：
          //   __perfInfo()        → 当前 dpr / 画布尺寸 / 实测帧间隔 / 是否在省填充
          //   __setQuality(0.75)  → 手动锁档（掉帧时现场可自救，无需改代码/重启）
          //   __setQuality(null)  → 恢复默认（满档锁定，等同 11/3 的清晰基线）
          window.__perfInfo = function () {
            try { return perfInfoView(); } catch (e) { return { err: String(e && e.message || e) }; }
          };
          window.__setQuality = function (q) {
            try {
              if (q == null) { qualityLocked = true; autoDrs = false; qualityScale = 1; }
              else {
                var qq = parseFloat(q);
                if (!isFinite(qq)) return { ok: false, reason: 'bad_q' };
                qualityLocked = true;
                qualityScale = Math.max(0.35, Math.min(1, qq));
              }
              applyCanvasResolution();
              return { ok: true, perf: perfInfoView() };
            } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
          };
          // 看门狗：原 3 秒太慢（现场听感＝音乐迟迟不来），压到 1.2 秒并复用同一补声函数。
          if (typeof setInterval === 'function') {
            setInterval(function () { try { audioRecoverOnce('watchdog'); } catch (e) {} }, 1200);
          }
          // [v22.3] 沉浸式全屏：首按按钮时请求浏览器全屏（隐藏外框），
          // 并把 540×960(9:16) 画面改为 contain 等比居中——不裁切、不拉扯，上下对齐留黑边。
          window.__kioskApplyFit = function () {
            try {
              if (typeof window === 'undefined') return { ok: false };
              screenW = window.innerWidth || screenW;
              screenH = window.innerHeight || screenH;
              // [v25] 按当前适配方式重算：height=只按高度（大屏默认）；cover=max（裁上下）；contain=min。
              try { if (window.__kioskFitMode) kioskFitMode = String(window.__kioskFitMode); } catch (e0) {}
              fitScale = (kioskFitMode === 'cover') ? Math.max(screenW / VIEW_W, screenH / VIEW_H)
                       : (kioskFitMode === 'height') ? (screenH / VIEW_H)
                       : Math.min(screenW / VIEW_W, screenH / VIEW_H);
              offX = (screenW - VIEW_W * fitScale) / 2;
              offY = (screenH - VIEW_H * fitScale) / 2;
              // [v45] 尺寸变化（含进全屏）后按像素上限重算 dpr，防止 4K 屏满像素重绘掉帧
              try { dpr = computeBaseDpr(); } catch (eDprFit) {}
              // [2026-10-31] ⚠️ canvas.width/height 赋值（哪怕赋同一个值）都会清空画布 →
              //   清空那一帧左右留边会透出 CSS 底色，现场就是「两侧闪一下深灰」。
              //   尺寸没变就绝不重设；同时保证任何清空后的下一帧由 drawFrame 的
              //   fullCanvasReset 统一整屏填黑（canvasChanged 判定已覆盖）。
              var wantCanvasW = Math.max(1, Math.round(screenW * dpr));
              var wantCanvasH = Math.max(1, Math.round(screenH * dpr));
              if (canvas.width !== wantCanvasW || canvas.height !== wantCanvasH) {
                canvas.width = wantCanvasW;
                canvas.height = wantCanvasH;
              }
              return { ok: true, fitScale: fitScale, offX: offX, offY: offY, screenW: screenW, screenH: screenH, mode: kioskFitMode };
            } catch (e) { return { ok: false, reason: String(e) }; }
          };
          window.__kioskEnterImmersive = function () {
            // [v35 用户需求] 首按自适应一律「以上下高度为准」：丢弃旧书签/旧缓存遗留的
            //   ?fit=cover（正是「上下被裁切」的来源），仅 ?fit=contain（调试用）保留。
            try {
              var ufitForce = new URLSearchParams(window.location.search).get('fit');
              if (ufitForce !== 'contain') window.__kioskFitMode = 'height';
            } catch (eFitForce2) { window.__kioskFitMode = 'height'; }
            var fit = null;
            try { fit = window.__kioskApplyFit(); } catch (e) {}
            try {
              if (typeof document === 'undefined') return fit || { ok: false };
              var req = null;
              // [2026-10-14 二次需求] 恢复浏览器真实全屏（用户：第 1 下要「满屏、无边框」）：
              //   首按是可信手势 → requestFullscreen（地址栏/窗口框全部隐藏、画面铺满整块屏幕），
              //   内部仍按 __kioskFitMode('height') 保持 9:16。
              //   被拒（iframe 无 allowfullscreen 等）→ 降级为视口内自适应并提示一次。
              try {
                var fsEl = document.documentElement;
                if (fsEl.requestFullscreen) req = fsEl.requestFullscreen();
                else if (fsEl.webkitRequestFullscreen) req = fsEl.webkitRequestFullscreen();
              } catch (e2) {}
              try { if (window.__stwxUnlockAudio) window.__stwxUnlockAudio(); } catch (e3) {}
              if (req && req.catch) {
                req.catch(function (err) {
                  // 被拒（iframe 无 allowfullscreen / 浏览器策略）：9:16 适配已生效，
                  // 仅记录并提示一次，不重试轰炸。
                  window.__kioskFullscreenDenied = true;
                  try { if (window.__toast) window.__toast('当前环境不支持全屏（预览窗格内打开属正常，真机浏览器可按 F11）'); } catch (e4) {}
                });
              }
              return fit || { ok: false };
            } catch (e) { return { ok: false, reason: String(e) }; }
          };
          if (typeof document !== 'undefined') {
            document.addEventListener('fullscreenchange', function () {
              if (document.fullscreenElement && window.__kioskApplyFit) window.__kioskApplyFit();
            });
            if (typeof window !== 'undefined') {
              window.addEventListener('resize', function () {
                // 无论是否真全屏都重算（全屏被拒时 contain 适配照常生效）
                if (window.__kioskApplyFit) window.__kioskApplyFit();
              });
            }
          }
          // [v22.4] 进网页即自动起播：① 反复尝试 resume WebAudio（autoplay 放行的浏览器立刻有声）
          // ② 菜单/门禁页没有关卡 BGM，这里主动把 BGM 拉起来（shim 内静音起播→取消静音出声音）。
          window.__stwxPrimeAudioAutoplay = function () {
            try {
              var tries = 0;
              if (typeof setInterval === 'function') {
                var t = setInterval(function () {
                  tries++;
                  try {
                    if (audioState.webCtx && audioState.webCtx.state === 'suspended' && isGameAudioAllowed()) {
                      var r = audioState.webCtx.resume(); if (r && r.catch) r.catch(function () {});
                    }
                  } catch (e) {}
                  if (tries >= 15) clearInterval(t);
                }, 800);
              }
              // [v23] BGM 在菜单/吸引页也要出声：bgmManifest 可能晚于本函数就绪，做个短重试
              //   [2026-10-14 v33.1 用户需求] 改为只在「游戏进行中」补起：待机/菜单不开机放歌，
              //   也不空转重试 —— 游戏开局由 loadStage→playBgmForLevel 正常起播。
              var bgmTry = 0;
              function startBgmWhenReady() {
                try {
                  if (!(settings.musicOn && bgmState.enabled && isGameAudioAllowed())) return;
                  var inGameScene = scene === 'playing' || scene === 'paused' || scene === 'golden_skill' ||
                    scene === 'golden_skill_ad' || scene === 'finish_slowmo';
                  if (!inGameScene) return;
                  var tr = resolveBgmTrackForStage(runtimeLevel, stageIndex);
                  var path = (tr && tr.track && tr.track.path) || resolveBgmPath(runtimeLevel && runtimeLevel.theme, runtimeLevel, stageIndex);
                  if (!path) { if (bgmTry < 25) { bgmTry++; setTimeout(startBgmWhenReady, 400); } return; }
                  playBgmPath(path);
                } catch (e) {}
              }
              startBgmWhenReady();
              return { ok: true };
            } catch (e) { return { ok: false, reason: String(e) }; }
          };
          window.__kioskRunState = function () {
            try {
              return {
                active: !!kioskRun.active, index: kioskRun.index, total: kioskOrder().length,
                skinId: kioskOrder()[kioskRun.index] || '', dying: !!kioskRun.dying, complete: !!kioskRun.complete,
                videoPending: kioskRun.videoPending || '', round: kioskRun.index + 1,
                potatoes: Math.max(0, Number(kioskRun.potatoes) || 0),
                skillPoints: Math.max(0, Number(goldenSkillState && goldenSkillState.points) || 0),
                mapOrder: (kioskRun.mapOrder || []).slice(), mapVariant: String(runtimeLevel && runtimeLevel.kioskVariant || ''),
                mapWidth: Number(runtimeLevel && runtimeLevel.width) || 0,
                // [v70] 本关实际布局签名（验收三关地图确实不同用）：锚点数/首锚点坐标/食物墙数
                mapSig: (function () {
                  try {
                    return {
                      anchors: runtimeLevel.anchors.length,
                      a0: runtimeLevel.anchors[0] ? [Math.round(runtimeLevel.anchors[0].x), Math.round(runtimeLevel.anchors[0].y)] : null,
                      foods: runtimeLevel.foods.length, walls: (runtimeLevel.walls || []).length,
                      bumpers: (runtimeLevel.bumpers || []).length
                    };
                  } catch (eMS) { return null; }
                })()
              };
            } catch (e) { return { active: false, error: String(e && e.message || e) }; }
          };
          window.__kioskRunStop = function () { kioskEndRun(); return { ok: true }; };
          // [kiosk 2026-10-11 下午] 记分板空白键推进：第 1 按 → 跳过翻牌直接出结果；第 2 按 → 下一轮
          window.__kioskTallyAdvance = function () {
            try {
              if (!kioskRun.active || scene !== 'score_tally') return { ok: false, reason: 'bad_scene:' + scene };
              if (!finishState.tallyComplete) {
                var tallyItems = finishState.scoreItems || [];
                finishState.tallyValues = tallyItems.map(function (item) { return Math.round(Number(item.value) || 0); });
                finishState.tallyScore = finishState.tallyValues.length ? finishState.tallyValues[finishState.tallyValues.length - 1] : 0;
                finishState.tallyFood = finishState.tallyValues[0] || 0;
                finishState.tallyTimer = 99;
                finishState.tallyComplete = true;
                playUiClickSound();
                return { ok: true, stage: 'result' };
              }
              if (finishState.kioskTallyQueued) return { ok: true, stage: 'already' };
              finishState.kioskTallyQueued = true;
              playUiClickSound();
              // [2026-10-13 修复] 现场只有一颗实体键，记分板推进走的就是这条（__kioskTallyAdvance）。
              //   原来这里**只推进、不落盘本轮分数**，导致 kioskRun.results[idx] 恒为空
              //   → 最终「三轮总分」恒为 0（第 1/2 关的分数彻底丢失）。
              //   与触摸路径（pointer 分支）保持一致：先记录本轮 score 再推进。
              kioskFinishCharacter(true);
              kioskAfterRoundTally();
              return { ok: true, stage: 'next' };
            } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
          };
          // [kiosk debug] 仅 ?kioskdebug=1 时暴露：让自动化能直接验证
          //   「过关→换角色」与「阵亡→回首页」两条链路（不参与正常玩法）。
          try {
            if (typeof location !== 'undefined' && /[?&]kioskdebug=1/.test(String(location.search || ''))) {
              window.__kioskDebugClear = function (score, opts) {
                try {
                  if (typeof score === 'number') runStats.stageTotalScore = score;
                  kioskFinishCharacter(true);
                  if (opts && opts.tally) {
                    // 只走到记分板（不推进），供自动化验证「空白键出结果 → 再按下一轮」链路
                    setScene('score_tally'); finishState.tallyTimer = 0; finishState.tallyComplete = false;
                    return true;
                  }
                  kioskAfterRoundTally();   // 第12版：直接推进（视频/换人/总板），供自动化验证全链路
                  return true;
                } catch (e) { return false; }
              };
              window.__kioskDebugSetScore = function (s) {
                try { runStats.stageTotalScore = Math.max(0, Math.round(Number(s) || 0)); return true; } catch (e) { return false; }
              };
              // [2026-10-14 v32 需求6] 蛇形调试钩子：直接变蛇并可指定航向角（-PI/2=正上），
              //   供自动化验证「超出画框顶部一个头高即反弹」。
              window.__kioskDebugSnake = function (dirAngle) {
                try {
                  if (snakeForm.active) return { ok: true, already: true };
                  if (!beginSnakeForm()) return { ok: false, reason: 'begin-failed' };
                  if (typeof dirAngle === 'number' && isFinite(dirAngle)) { snakeForm.wanderAngle = dirAngle; snakeForm.heading = dirAngle; }
                  return { ok: true, headY: Math.round(snakeForm.headY) };
                } catch (e) { return { ok: false, reason: String(e) }; }
              };
              window.__kioskDebugSnakeState = function () {
                try {
                  return { active: !!snakeForm.active, headY: Math.round(snakeForm.headY), heading: +snakeForm.heading.toFixed(2), timer: +Number(snakeForm.timer).toFixed(1) };
                } catch (e) { return { err: String(e) }; }
              };
              window.__kioskDebugDie = function () {
                try {
                  // [2026-10-14] 调试钩子：视作「番薯已用完」再走死亡链路（现场 5 颗番薯会先自动救援，
                  //   自动化无法直接判死；清零后走 requestDeathOrSkill 与真实「番薯耗尽」路径完全一致）。
                  try { goldenSkillState.points = 0; } catch (ePts) {}
                  requestDeathOrSkill('fall');
                  return true;
                } catch (e) { return false; }
              };
              // [回归用] 忠实复现「自然过关 → 记分板」路径：只写本轮分数 + 进 score_tally，
              //   **不写 kioskRun.results、不推进**（与真实过关一致），用于验证「空白键推进」
              //   是否真把本轮分数落进 results（这正是 __kioskTallyAdvance 曾经漏掉的一步）。
              window.__kioskDebugEnterTally = function (score) {
                try {
                  if (typeof score === 'number') runStats.stageTotalScore = score;
                  finishState.kioskTallyQueued = false;
                  finishState.tallyComplete = false;
                  finishState.tallyTimer = 0;
                  setScene('score_tally');
                  return true;
                } catch (e) { return false; }
              };
            }
          } catch (e) {}
        } catch (e) {}
      }
      }
      try {
        var t = nowMs();
        var delta = (t - lastTime) / 1000;
        lastTime = t;
        if (isNaN(delta) || delta < 0) delta = 0;
        if (delta > 0.1) delta = 0.1;
        // [v46 DRS] 动态分辨率：按实测帧间隔给画布分辨率让路，帧率优先。
        //   旧逻辑只会把渲染频率降到 33fps（画面看着一顿一顿），分辨率不动、填充压力不减。
        //   这里反过来：先降分辨率（肉眼几乎无感），把每帧填充量降到 GPU 撑得住的水位。
        drsAccumMs += delta * 1000;
        drsFrames++;
        if (drsFrames >= 48) {                      // 约 0.8s 评估一次
          var _avgMs = drsAccumMs / drsFrames;
          lastDrsFrameMs = _avgMs;
          drsAccumMs = 0; drsFrames = 0;
          // [v27] 默认 autoDrs=false → 整段不生效，画布恒满档（清晰优先）。
          //   ?q=auto 时才走下面这套保守规则：只在真正在画的关卡内、且掉帧要连续两次评估才算数。
          if (autoDrs && !qualityLocked
              && scene === 'playing'
              && !(typeof document !== 'undefined' && document.hidden)
              && !(typeof window !== 'undefined' && window.__kioskDrawSuppressed === true)) {
            if (_avgMs > 26 && qualityScale > 0.7501) {
              // 必须连续两次评估都超 26ms（约 1.6s 持续掉帧）才降一档，防瞬时抖动误判
              drsDownStreak++;
              drsUpStreak = 0;
              if (drsDownStreak >= 2) {
                drsDownStreak = 0;
                // 下限 0.75：4K 屏最低退到 2880×1620，肉眼仍清晰；再往下就是「糊」而不换流畅
                qualityScale = Math.max(0.75, qualityScale * 0.9);
                applyCanvasResolution();
                try { console.log('[DRS] 降档 → q=' + qualityScale.toFixed(2) + ' avg=' + _avgMs.toFixed(1) + 'ms'); } catch (e0) {}
              }
            } else if (_avgMs < 16.5 && qualityScale < 1) {
              // 连续两次（约 1.6s）富余就升一档，升幅 12% → 尽快回到满档
              drsDownStreak = 0;
              drsUpStreak++;
              if (drsUpStreak >= 2) {
                drsUpStreak = 0;
                qualityScale = Math.min(1, qualityScale * 1.12);
                applyCanvasResolution();
                try { console.log('[DRS] 升档 → q=' + qualityScale.toFixed(2) + ' avg=' + _avgMs.toFixed(1) + 'ms'); } catch (e1) {}
              }
            } else {
              drsUpStreak = 0; drsDownStreak = 0;
            }
          }
          // [v29 特效档自动降级] 4K 填充率是弱 GPU 的硬瓶颈，画布分辨率不能动（用户红线：背景/道具像素不减）。
          //   剩下的合法杠杆只有特效强度：high→balanced（光晕 shadowBlur 减半、粒子跳步绘制），任何像素都不降、画面不糊。
          //   规则：画布在真实绘制（非停画、页面可见）即采样，不限 scene（极端降速下对局可能很快结束，
          //   只看 playing 会凑不满连续评估窗）；连续 4 次评估（约 3.2s@60fps）avg>24ms 才降一次，降后不回升（防视觉震荡）。
          //   待机/榜单插播时画布停画、帧耗时极低，不会误触发。URL ?tier= 显式指定档位时不干预（game.js 会置 window.__sxTierForced）。
          if (performanceTier === 'high'
              && !(typeof window !== 'undefined' && window.__sxTierForced === true)
              && !(typeof document !== 'undefined' && document.hidden)
              && !(typeof window !== 'undefined' && window.__kioskDrawSuppressed === true)) {
            if (_avgMs > 24) {
              tierDownStreak++;
              if (tierDownStreak >= 4) {
                performanceTier = 'balanced';
                tierDownStreak = 0;
                try { console.log('[TIER] 特效自动降档 high→balanced avg=' + _avgMs.toFixed(1) + 'ms（像素/背景/道具不变）'); } catch (eT) {}
              }
            } else {
              tierDownStreak = 0;
            }
          }
        }
        // 帧率自适应采样：仅在正式关卡游玩时调节，菜单/过场不干预。
        if (!lowDevice && scene === 'playing') {
          // delta 在 delta>0.1 处已截断，用截断后的真实帧间隔判断。
          if (delta > baseRenderInterval * 1.35) {
            renderSlowStreak++;
            renderFastStreak = 0;
            if (renderSlowStreak >= 45 && renderInterval < renderAdaptiveMax - 0.0001) {
              // [v46] 只在 DRS 已经降到底档（0.5）仍然顶不住时，才允许降渲染频率；
              //   否则「先降帧」会让画面一顿一顿，用户观感比降分辨率差得多。
              if (qualityScale <= 0.7501) {
                renderInterval = Math.min(renderAdaptiveMax, renderInterval * 1.08);
              }
              renderSlowStreak = 0;
            }
          } else if (delta < baseRenderInterval * 1.1) {
            renderFastStreak++;
            renderSlowStreak = 0;
            if (renderFastStreak >= 120 && renderInterval > renderAdaptiveMin + 0.0001) {
              // 连续约 2 秒稳定，逐步回收渲染间隔，回到目标帧率。
              renderInterval = Math.max(renderAdaptiveMin, renderInterval * 0.94);
              renderFastStreak = 0;
            }
          } else {
            renderSlowStreak = 0;
            renderFastStreak = 0;
          }
        }
        accumulator += delta * GAME_SPEED;
        renderAccumulator += delta;
        if (lowDevice && runtimeLevel && !runtimeLevel.backgroundImage) lowDeviceBgSkip = (lowDeviceBgSkip + 1) % 2;
        else lowDeviceBgSkip = 0;
        var steps = 0;
        while (accumulator >= DT && steps < MAX_STEPS) {
          try { update(DT); } catch(e) { console.error('update error:', e && e.message); }
          accumulator -= DT; steps++;
        }
        // 丢弃过量积压，避免低帧后连续追帧造成长时间卡顿；优先保证下一帧及时绘制。
        if (steps >= MAX_STEPS && accumulator >= DT) accumulator = accumulator % DT;
        // 每个实际显示帧只更新一次镜头；不受物理提前 return 或补帧次数影响。
        updateCameraFollow(delta, false);
        // 低档设备以稳定 45FPS 为目标；场景切换及画布恢复时强制立即绘制。
        var sceneChanged = scene !== lastRenderedScene;
        // [v46 省填充] 画布被整屏浮层（500 强榜 / 待机视频 / 说明图 / 变身片）完全盖住时不再重绘：
        //   4K 满像素每帧 830 万像素的填充会与浮层的滚动合成本抢 GPU，正是「榜单滚动跳帧」的元凶。
        //   covered → 直接跳过 draw；浮层收起（covered 变 false）补画一帧，避免残影。
        var _covered = false;
        try { _covered = (typeof window !== 'undefined') && window.__kioskDrawSuppressed === true; } catch (eCov) {}
        if (lastDrawSuppressed && !_covered) forceCanvasReset = true;
        lastDrawSuppressed = _covered;
        var shouldRender = !_covered && (!lowDevice || renderAccumulator + 0.0005 >= renderInterval || sceneChanged || forceCanvasReset);
        // 安全网：万一某条路径把 covered 标记卡住（浮层已收起却没人复位），最多冻 0.4s 必须重画一帧，
        //   绝不允许出现「游戏画面定住」这种比掉帧严重得多的事故。
        if (!shouldRender && (t - lastDrawAtMs) > 400) shouldRender = true;
        if (shouldRender) {
          if (renderAccumulator >= renderInterval) renderAccumulator = renderAccumulator % renderInterval;
          else renderAccumulator = 0;
          try { draw(); } catch(e) { console.error('draw error:', e && e.message); }
          lastRenderedScene = scene;
          lastDrawAtMs = t;
        }
      } catch(e) {
        console.error('loop error:', e && e.message);
      }
      requestAnimationFrame(loop);
    }

    var renderFrameConfig = {};
    var renderEconomyCache = null;
    var renderEconomyCacheAt = 0;
    var renderTutorialTasksLevel = null;
    var renderTutorialTasksCache = [];
    var renderAudioSettingsCache = null;
    var renderWorldToScreenX = function(wx, fx) { if (fx === undefined) fx = cameraX; return wx - fx; };
    var renderSetUiHotspots = function(h) { uiHotspots = h; };

    function draw() {
      var renderNow = nowMs();
      if (!renderEconomyCache || renderNow - renderEconomyCacheAt >= 500) {
        renderEconomyCache = economyView();
        renderEconomyCacheAt = renderNow;
      }
      if (renderTutorialTasksLevel !== runtimeLevel) {
        renderTutorialTasksLevel = runtimeLevel;
        renderTutorialTasksCache = tutorialTasksForLevel(runtimeLevel);
      }
      if (tutorialFlow) tutorialFlow.currentTask = currentTutorialTask();
      if (scene === 'paused' || !renderAudioSettingsCache) renderAudioSettingsCache = getAudioSettingsView();

      var r = renderFrameConfig;
      r.VIEW_W = VIEW_W; r.VIEW_H = VIEW_H; r.dpr = dpr; r.fitScale = fitScale; r.offX = offX; r.offY = offY; r.gameSpeed = GAME_SPEED;
      r.scene = scene; r.player = player; r.runtimeLevel = runtimeLevel; r.cameraX = cameraX; r.cameraY = cameraY; r.screenShake = screenShake;
      r.kioskActive = !!kioskRun.active;   // 2026-10-11：记分板按 kiosk 口径渲染（空白键推进提示、不显示下一关）
      r.particles = particles; r.floatingTexts = floatingTexts; r.uiHotspots = uiHotspots; r.runStats = runStats;
      r.finishState = finishState; r.progress = progress;
      r.leaderboard = leaderboard; r.leaderboardOpen = leaderboardOpen; r.leaderboardTab = leaderboardTab;
      r.globalLeaderboardView = computeGlobalLeaderboardView();
      r.leaderboardScrollY = leaderboardScrollY; r.lastSubmittedRank = lastSubmittedRank;
      r.leaderboardNotOnList = leaderboardNotOnList;
      r.playerProfile = playerProfile; r.gameOverState = gameOverState; r.cloudLeaderboardReady = cloudLeaderboardReady; r.cloudLeaderboardConnected = cloudLeaderboardConnected;
      r.sprite = sprite; r.skinSpriteAssets = skinSpriteAssets; r.skinSpriteManifests = skinSpriteManifests; r.curlSprite = curlSprite; r.curlBlinkHalfSprite = curlBlinkHalfSprite; r.curlBlinkClosedSprite = curlBlinkClosedSprite;
      r.playRewardBanner = playRewardBanner;
      r.skinSwitchBanner = skinSwitchBanner;
      r.victorySprite = victorySprite; r.soulSprite = soulSprite; r.dizzySprite = dizzySprite; r.fartSprite = fartSprite;
      r.curlConfig = curlConfig; r.victoryConfig = victoryConfig; r.soulConfig = soulConfig; r.dizzyConfig = dizzyConfig; r.fartConfig = fartConfig;
      r.skinAuxSpriteAssets = skinAuxSprites; r.skinAuxConfigs = skinAuxConfigs;
      r.skinPortraitAssets = skinPortraitAssets;
      // 穿戴中的皮肤 + 滚轮正中的卡片：按需触发解码（幂等，已加载的不会重复）。
      ensureSkinArt(activeSkinId());
      if (skinPanelOpen) {
        var centerDef = SKIN_DEFS[normalizeSkinPanelIndex(skinPanelIndex)];
        if (centerDef) ensureSkinArt(centerDef.id);
        // 2026-10-09 修复「侧卡预览是一团绿色」：面板打开时只解中央卡的全套美术，
        // 左右侧卡的立绘（portrait）永远不触发解码 → 立绘 / 360 精灵 / 翻滚图全部
        // not ready，render 端从 drawSkinPortrait 一路跌到最底下的矢量兜底（绿团）。
        // 真机才暴露：mock 回归里资源恒 ready，测不出这条链。
        // 这里给**全部**皮肤补触发立绘小图解码（每张 260×320，共 5 张，开销可控；
        // startImageAsset 幂等 + 分包未就绪自动排队，可放心每帧调用）。
        // 360 / curl 等大图仍只随中央卡解（滚到中央或穿戴时 ensureSkinArt 会解）。
        for (var _spi = 0; _spi < SKIN_DEFS.length; _spi++) {
          var _spDef = SKIN_DEFS[_spi];
          if (_spDef && skinPortraitAssets[_spDef.id]) startImageAsset(skinPortraitAssets[_spDef.id], false);
        }
      }
      r.crowSprite = crowSprite; r.crowSpriteConfig = crowSpriteConfig; r.crows = crows;
      r.feathers = featherFx; r.featherSpriteA = featherSpriteA; r.featherSpriteB = featherSpriteB;
      r.crowVanishFx = crowVanishFx;
      r.warmupSprite = warmupSprite; r.warmupConfig = warmupConfig;
      r.foodArtAssets = foodArtAssets; r.foodIconCache = render.foodIconCache; r.dailyRewardIcon = dailyRewardIcon; r.homePoster = homePoster; r.tutorialPoster = tutorialPoster;
      r.tutorialComicAssets = tutorialComicAssets; r.tutorialAnimationAssets = tutorialAnimationAssets; r.tutorialFlow = tutorialFlow; r.tutorialStageTasks = renderTutorialTasksCache;
      r.uiButtonAssets = uiButtonAssets; r.scoreTallyUiAssets = scoreTallyUiAssets; r.fingerPullDownAsset = fingerPullDownAsset; r.overlayUiAssets = overlayUiAssets;
      r.characterUi = characterUiConfig; r.characterPortrait = characterPortrait;
      r.portalSprite = portalSprite; r.portalSpriteConfig = portalSpriteConfig; r.stageBackgroundAssets = stageBackgroundAssets;
      r.THEMES = THEMES; r.FOOD_LIBRARY = FOOD_LIBRARY;
      r.isTutorialStage = isTutorialStage; r.currentTutorialKind = currentTutorialKind; r.getAnchorCandidate = getAnchorCandidate;
      r.getPlayerVisual = getPlayerVisual; r.getMouthWorld = getMouthWorld; r.worldToScreenX = renderWorldToScreenX;
      r.nowSec = nowSec; r.menuIntroOpen = menuIntroOpen; r.dailyLoginPopup = dailyLoginPopup; r.stageIndex = stageIndex; r.MAIN_STAGE_START = MAIN_STAGE_START; r.stageCount = STAGES.length;
      r.stageSelectOpen = stageSelectOpen;
      r.stageSelectInfo = stageSelectOpen ? stageDisplayInfo(clampSelectableStageIndex(stageSelectIndex)) : null;
      r.stageSelectMinFormal = stageSelectOpen ? formalStageNumber(lowestSelectableStageIndex()) : 0;
      r.stageSelectMaxFormal = stageSelectOpen ? formalStageNumber(highestSelectableStageIndex()) : 0;
      r.stageSelectSequential = stageSelectOpen ? firstSequenceLocked(progress) : false;
      r.tongueFailSeconds = tongueFailSeconds();
      r.stageSelectSequenceCleared = stageSelectOpen ? firstSequenceClearedCount(progress) : 0;
      r.stageSelectRound = stageSelectOpen ? currentRoundNumber() : 0;
      r.skinPanelOpen = skinPanelOpen;
      r.skinPanelIndex = skinPanelIndex;
      r.skinWheelScroll = skinWheelScroll;
      r.skinWheelDragging = skinWheelDragging;
      r.skinCards = buildSkinCardsView();
      r.skinTestUnlockAll = SKIN_TEST_UNLOCK_ALL;
      r.activeSkin = activeSkinDef();
      // 2026-10-01：旧的水波圈（tide_pull）/ 疾影拖影（swift_grip）随能力替换一并移除。
      // 渲染端改用下面这批：蛇形态、喷泉、超级贪吃范围圈。
      r.snakeForm = snakeForm;
      r.isSnakeFormActive = isSnakeFormActive();
      r.snakeRemaining = snakeForm.active ? Math.max(0, snakeForm.timer) : 0;
      r.floodFountainFx = floodFountainFx;
      r.floodAvailable = hasFloodFountain();
      // 2026-10-01 修订：贪吃不再绑定锚点 —— 未挂锚点时也能伸舌，候选是「食物 vs 锚点」取近的。
      r.greedyTongueActive = greedyTongueActive() && !!player;
      r.greedyAnchor = null;
      r.greedyCenter = player ? { x: player.x, y: player.y } : null;
      r.greedyRadius = GREEDY_TONGUE_RADIUS;
      r.greedyShot = greedyShot;
      r.greedyShotActive = greedyShot.phase !== 'idle';
      r.isHangzhouStage = isHangzhouStage();
      r.foodPickupBonus = foodPickupBonus();
      r.activeSkinId = activeSkinId();
      r.crowWarning = crowWarningState;
      r.goldenPotatoBank = goldenPotatoBank();
      r.tongueFx = tongueFx; r.soulState = soulState; r.uiPressVisual = uiPressVisual;
      r.loadingState = loadingState; r.tutorialHintTimer = tutorialHintTimer; r.tutorialInputSeen = tutorialInputSeen; r.economy = renderEconomyCache; r.rewardDialog = rewardDialog; r.recoveryFullSeconds = Math.max(60, Math.round(RECOVERY_MS / 1000));
      r.tutorialComicState = tutorialComicState; r.audioSettings = renderAudioSettingsCache; r.goldenSkillState = goldenSkillState;
      r.portalState = portalState; r.portalTarget = portalState.targetStage >= 0 ? stageDisplayInfo(portalState.targetStage) : null;
      r.portalTransitionState = portalTransitionState; r.portalPreviewState = portalPreviewState; r.unlockGateState = unlockGateState;
      r.nextUnlock = (scene === 'score_tally' || scene === 'unlock_gate' || scene === 'menu') && !kioskRun.active ? getNextStageUnlockView() : null;   // kiosk：现场只有杭州，不出「下一关 香港」
      r.unlockScores = unlockScoreTable; r.clampStageIndex = clampStageIndex; r.setUiHotspots = renderSetUiHotspots;
      r.menuFadeAlpha = getMenuFadeAlpha(); r.spawnParticle = spawnParticle;
      r.pointerHeld = pointerHeld; r.touchActiveCount = touchActiveCount;
      r.lastTouchStartMs = lastTouchStartMs; r.lastTouchEndMs = lastTouchEndMs; r.lastInputX = lastInputX; r.lastInputY = lastInputY;
      r.editorState = editorState; r.editorButtonVisible = editorButtonVisible;
      r.lowDevice = lowDevice; r.lowDeviceBgSkip = lowDeviceBgSkip;
      r.performanceTier = performanceTier; r.targetFps = targetFps;
      r.forceCanvasReset = forceCanvasReset;
      render.draw(ctx, canvas, r);
      forceCanvasReset = false;
    }

    function onTouchStart(e) {
      try {
        if (!e || !e.touches || e.touches.length === 0) return;
        // 2026-10-09：变蛇期间任意点按立即随机换一个方向（不再走舌头按下逻辑）。
        if (isSnakeFormActive()) {
          realSnake.changeDirection(snakeForm, Math.random);  // 真蛇：点一下随机换向，方向明显不同，由 heading 平滑转过去
          return;
        }
        var t = e.touches[0];
        var px = (t.clientX - offX) / fitScale;
        var py = (t.clientY - offY) / fitScale;
        var tongueBusy = scene !== 'editor' && scene !== 'golden_skill' && scene !== 'golden_skill_ad' && player && (player.attachIndex !== null || (tongueFx.mode !== 'none' && tongueFx.mode !== 'rebound'));
        if (scene !== 'editor' && scene !== 'golden_skill' && scene !== 'golden_skill_ad' && (pointerHeld || tongueBusy)) {
          handleRelease();
        }
        touchActiveCount = e.touches.length;
        lastTouchStartMs = nowMs();
        lastTouchStartX = px;
        lastTouchStartY = py;
        // 皮肤滚轮：起点不在箭头/侧卡等点击控件上时，本次触摸可演变成跟手拖拽。
        beginSkinWheelDrag(px, py);
        handlePress(px, py);
      } catch (err) { console.error('onTouchStart error:', err && err.message); }
    }
    function onTouchEnd(e) {
      try {
        touchActiveCount = Math.max(0, (e && e.touches ? e.touches.length : 0));
        lastTouchEndMs = nowMs();
        if (skinPanelOpen && (scene === 'menu' || scene === 'paused') && e && e.changedTouches && e.changedTouches.length) {
          var et = e.changedTouches[0];
          var endX = (et.clientX - offX) / fitScale;
          var endY = (et.clientY - offY) / fitScale;
          // 跟手拖拽收尾：吸附到最近一张，并消费掉本次触摸（不再触发点击）。
          if (endSkinWheelDrag()) { skinWheelPendingTap = ''; handleRelease(); return; }
          // 侧卡/箭头点击确认：整段触摸未演变成拖拽，才把它当作一次翻页点击。
          if (skinWheelPendingTap) {
            var pendingDir = skinWheelPendingTap;
            skinWheelPendingTap = '';
            rotateSkinWheel(pendingDir === 'prev' ? -1 : 1);
            handleRelease();
            return;
          }
          // 真机兜底：即使 touchstart 当帧热区尚未刷新，touchend 落在关闭区域也立即关闭。
          if (skinPanelCloseHit(endX, endY)) {
            triggerHaptic('light');
            playUiClickSound();
            closeSkinPanel();
            handleRelease();
            return;
          }
          var swipeDx = endX - lastTouchStartX;
          // 未进入拖拽的快速横扫：用位移兜底翻页，保证轻扫也能滚动滚轮。
          if (lastTouchStartX > 145 && lastTouchStartX < VIEW_W - 145 && Math.abs(swipeDx) >= 54) {
            rotateSkinWheel(swipeDx < 0 ? 1 : -1);
          }
        }
        handleRelease();
      } catch (err) { console.error('onTouchEnd error:', err && err.message); }
    }
    function onTouchCancel(e) {
      try {
        touchActiveCount = 0;
        lastTouchEndMs = nowMs();
        handleRelease();
      } catch (err) { console.error('onTouchCancel error:', err && err.message); }
    }
    function onTouchMove(e) {
      try {
        if (!e || !e.touches) return;
        touchActiveCount = e.touches.length;
        if (e.touches.length) {
          var t = e.touches[0];
          var tx = (t.clientX - offX) / fitScale, ty = (t.clientY - offY) / fitScale;
          lastInputX = tx; lastInputY = ty; lastInputAt = nowMs();
          if (skinPanelOpen && skinWheelDragArmed) updateSkinWheelDrag(tx);
          else if (leaderboardOpen) { updateLeaderboardDrag(ty); }
          else if (scene === 'golden_skill' && !goldenSkillState.kioskAutoSwing) updateGoldenSkillSelection(tx, ty);
          else if (scene === 'paused') updatePauseSettingsDrag(tx);
          else if (scene === 'unlock_gate') updateUnlockGateWheelDrag(ty);
          else if (scene === 'editor' && !(editorState.fileDialog && editorState.fileDialog.open)) updateEditorDrag(tx, ty);
        }
      } catch (err) { console.error('onTouchMove error:', err && err.message); }
    }

    wx.onTouchStart(onTouchStart);
    wx.onTouchEnd(onTouchEnd);
    wx.onTouchCancel(onTouchCancel);
    wx.onTouchMove(onTouchMove);

    var editorMouseDown = false;
    function mousePoint(e) {
      var cx = e && e.clientX !== undefined ? e.clientX : (e && e.x !== undefined ? e.x : screenW * 0.5);
      var cy = e && e.clientY !== undefined ? e.clientY : (e && e.y !== undefined ? e.y : screenH * 0.5);
      return { x: (cx - offX) / fitScale, y: (cy - offY) / fitScale };
    }
    // [hangzhou-web] 网页版（wx-shim）已把鼠标事件合成为触摸事件，全场景都能用鼠标操作。
    // 这里只保留「编辑器」自身需要的鼠标路径，其余场景交给触摸通道，
    // 否则同一个点按会同时走鼠标与合成触摸两条路 → 被处理两次。
    function onEditorMouseDown(e) {
      if (scene !== 'editor') return;
      var p = mousePoint(e);
      var pressNow = nowMs();
      if (pressNow - lastTouchStartMs < EDITOR_MOUSE_AFTER_TOUCH_IGNORE_MS &&
          Math.hypot(p.x - lastTouchStartX, p.y - lastTouchStartY) < 12) return;
      if (pressNow - lastEditorMousePress.at < EDITOR_MOUSE_EVENT_DEDUP_MS &&
          Math.hypot(p.x - lastEditorMousePress.x, p.y - lastEditorMousePress.y) < 3) return;
      lastEditorMousePress.at = pressNow;
      lastEditorMousePress.x = p.x;
      lastEditorMousePress.y = p.y;
      editorMouseDown = true;
      handlePress(p.x, p.y);
    }
    function onEditorMouseMove(e) {
      if (!editorMouseDown || scene !== 'editor') return;
      var p = mousePoint(e); lastInputX = p.x; lastInputY = p.y;
      if (!(editorState.fileDialog && editorState.fileDialog.open)) updateEditorDrag(p.x, p.y);
    }
    function onEditorMouseUp() {
      if (scene !== 'editor') return;
      editorMouseDown = false;
      endEditorDrag();
    }
    function onEditorMouseWheel(e) {
      var p = mousePoint(e);
      var delta = e && e.deltaY !== undefined ? e.deltaY : (e && e.wheelDelta !== undefined ? -e.wheelDelta : (e && e.detail !== undefined ? e.detail * 20 : 0));
      if (!delta) return;
      if (leaderboardOpen) {
        if (!pointInRect(p.x, p.y, uiHotspots.leaderboardList)) return;
        cancelLeaderboardAutoScroll();
        leaderboardScrollY += delta * 0.72; clampLeaderboardScroll(); return;
      }
      if (scene === 'unlock_gate') {
        if (!pointInRect(p.x, p.y, uiHotspots.unlockGateWheel)) return;
        adjustUnlockGateWheel(delta); return;
      }
      if (scene !== 'editor' || (editorState.fileDialog && editorState.fileDialog.open) || !pointInEditorViewport(p.x, p.y)) return;
      zoomEditorBy(Math.exp(-delta * 0.0015), p.x, p.y);
    }
    function onEditorKeyDown(e) {
      if (scene !== 'editor' || (editorState.fileDialog && editorState.fileDialog.open)) return;
      var key = String((e && (e.key || e.code)) || '').toLowerCase();
      var code = e && (e.keyCode || e.which);
      if (key === 'delete' || key === 'backspace' || code === 8 || code === 46) deleteEditorSelection();
    }
    try { if (wx.onMouseDown) wx.onMouseDown(onEditorMouseDown); } catch(e) {}
    try { if (wx.onMouseMove) wx.onMouseMove(onEditorMouseMove); } catch(e) {}
    try { if (wx.onMouseUp) wx.onMouseUp(onEditorMouseUp); } catch(e) {}
    try { if (wx.onMouseWheel) wx.onMouseWheel(onEditorMouseWheel); else if (wx.onWheel) wx.onWheel(onEditorMouseWheel); } catch(e) {}
    try { if (wx.onKeyDown) wx.onKeyDown(onEditorKeyDown); } catch(e) {}
    try {
      if (canvas && canvas.addEventListener) {
        canvas.addEventListener('wheel', onEditorMouseWheel);
        canvas.addEventListener('mousedown', onEditorMouseDown);
        canvas.addEventListener('mousemove', onEditorMouseMove);
        canvas.addEventListener('mouseup', onEditorMouseUp);
      }
    } catch(e) {}

    wx.onHide(function() {
      try { saveProgress(); } catch (ignoreProgressSaveOnHide) {}
      // 进入后台时同样静音（微信会暂停内部音频；这里保证 WebAudio 音效也不残留）
      if (settings.autoMuteExternalAudio) setExternalAudioBusy(true);
      stopSpinLoop();
      stopPortalTransitSound();
      if (scene === 'playing') setScene('paused');
      if (pendingShareRewardCallback) {
        // 原生通讯录/聊天选择界面已打开。保留当前死亡现场，回到小游戏时直接复活。
        shareReviveHideObserved = true;
        shareReviveHiddenAt = nowMs();
        persistReviveCheckpoint('share_pending');
      } else if (shareResumeGuardActive && scene === 'golden_skill') {
        // 玩家点击微信系统“查看分享页”可能导致小游戏进程被回收。
        // 保存已经发奖后的黄金番薯操作现场，冷启动时不重复发奖。
        persistShareResumeGuardCheckpoint();
      }
    });
    wx.onShow(function(options) {
      lastTime = nowMs(); accumulator = 0;
      // 部分 iOS 设备从系统分享页/后台返回时可能得到零尺寸画布；仅在异常时恢复原始高质量尺寸。
      var expectedCanvasW = Math.max(1, Math.round(screenW * dpr));
      var expectedCanvasH = Math.max(1, Math.round(screenH * dpr));
      if (!canvas.width || !canvas.height || canvas.width !== expectedCanvasW || canvas.height !== expectedCanvasH) {
        canvas.width = expectedCanvasW;
        canvas.height = expectedCanvasH;
      }
      forceCanvasReset = true;
      renderAccumulator = renderInterval;
      ensureAudio();
      // 回到前台：外部声音（通话 / 其它 App 的音频）此时已不再占用，按静音前的快照恢复原本设置。
      // 无条件解除，避免玩家中途关掉开关后卡在静音状态。
      setExternalAudioBusy(false);
      refreshEconomyState();
      if (pendingShareRewardCallback) {
        var elapsed = nowMs() - pendingShareRewardStartedAt;
        // 微信不提供可靠的收件人与发送结果。只有经历分享界面的前后台切换后才计奖；
        // 极少数基础库不触发 onHide 时，以停留时间作为兼容兜底。
        if (shareReviveHideObserved || elapsed >= 900) {
          restoreReviveCheckpoint(false);
          rewardDialogInputLockedUntil = 0;
          completePendingShareReward(true, '');
        }
      }
      if (shareResumeGuardActive && scene === 'golden_skill') {
        // 分享返回后原生“转发成功”弹窗仍可能覆盖在游戏上方。
        // 立即刷新保护检查点，保证点击“查看分享页”触发重新载入时仍能恢复原死亡现场。
        shareViewPageResumePending = true;
        persistShareResumeGuardCheckpoint();
      }
      if (rewardDialog.active) syncRewardDialogAvailability();
      flushPendingLeaderboardSubmission();
    });
    // 音频被系统/其它 App 占用（来电、语音或视频通话、闹钟、其它 App 放视频或音乐）：
    // 进入"外部有声"状态，游戏 BGM 与全部音效静音；中断结束后再按玩家自己的开关恢复。
    wx.onAudioInterruptionBegin && wx.onAudioInterruptionBegin(function() {
      if (!settings.autoMuteExternalAudio) { stopSpinLoop(); stopPortalTransitSound(); return; }
      setExternalAudioBusy(true);
    });
    wx.onAudioInterruptionEnd && wx.onAudioInterruptionEnd(function() {
      ensureAudio();
      // 外部声音结束：立刻按快照恢复原本的音乐 / 音效设置
      setExternalAudioBusy(false);
      // 极少数机型在中断结束后内部音频仍处在挂起态，延迟一拍再补一次恢复，确保真的出声。
      if (typeof setTimeout === 'function') {
        setTimeout(function() {
          ensureAudio();
          setExternalAudioBusy(false);
          refreshSfxOutput();
          // 中断期间被系统回收的 BGM 实例在这里补播回来（[v33.1] 仅限游玩场景，待机不放）
          if ((scene === 'playing' || scene === 'paused' || scene === 'golden_skill' ||
            scene === 'golden_skill_ad' || scene === 'finish_slowmo') &&
            settings.musicOn && bgmState.enabled && bgmState.currentPath && !bgmState.inner) playBgmPath(bgmState.currentPath);
          if (scene === 'playing' && player && !portalState.entryActive) updateSpinLoop();
        }, 400);
      }
    });

    initCloudLeaderboard();
    initRewardedVideoAd();
    initInterstitialAd();
    initAudio();
    // [2026-10-31 需求3] 网页端：每次登入黄金番薯固定 5 颗（先重置，再走下面（已禁用的）云端链）。
    try { resetKioskPotatoForSession(); } catch (ignoreKioskPotato) { giftReady = true; }
    // 黄金番薯云端账户：进游戏先从云端拉取权威余额（get 直接覆盖本地，修掉本地污染值 60 泄漏），
    // 拉完再发每日登录奖励（claim_login 服务端幂等，最终余额覆盖本地）。串行避免 get 旧快照覆盖奖励。
    // 整条异步链（get → claim_login）完成才置 giftReady=true，在此之前「每日登录」弹窗不弹，
    // 确保首屏显示的是同步后的正确余额，不再闪现陈旧的「口袋里尚有 0 颗」。
    try {
      initGiftFromCloud(function () {
        try { claimDailyLogin(function () { giftReady = true; }); } catch (ignoreDailyLogin) { giftReady = true; }
      });
    } catch (ignoreGiftCloud) { giftReady = true; }
    // 看门狗：云端异常卡住时最多 3 秒后放行弹窗（回退本地余额），避免清缓存后点「开始」无反应。
    try { if (typeof setTimeout === 'function') setTimeout(function () { giftReady = true; }, 3000); } catch (e) {}
    var bootStoredReviveCheckpoint = loadPersistedReviveCheckpoint();
    bootReviveResumePending = !!(bootStoredReviveCheckpoint &&
      (bootStoredReviveCheckpoint.action === 'share_pending' || bootStoredReviveCheckpoint.action === 'ad_pending' ||
       bootStoredReviveCheckpoint.action === 'claimed' || bootStoredReviveCheckpoint.action === 'share_resumed'));
    if (bootReviveResumePending) reviveCheckpoint = bootStoredReviveCheckpoint;
    setScene(bootReviveResumePending ? 'loading' : (skipLoadingPage ? 'menu' : 'loading'));
    if (scenePackageReady) ensureStageBackgroundAsset(runtimeLevel);
    requestAnimationFrame(loop);
    // 首个可交互画面先提交，再分批解码非首屏图片与音频，避免启动瞬间主线程拥塞。
    startDeferredImageBatch(2, 45);
    onPackageReady('res_core', function () { if (typeof setTimeout === 'function') setTimeout(loadAllAudioFiles, 1200); else loadAllAudioFiles(); });
    resumeStoredReviveCheckpoint(bootStoredReviveCheckpoint);
  }
};
