/* ============================================================
 * 超级舌阿蜥 · 线下网页版 —— wx 翻译层（浏览器 shim）
 * 原则：游戏代码（game.js + runtime/*.js）一行不改，所有差异在本层消化。
 * 2026-10-09 由 AGENT 生成；配合 web-require.js / index.html 使用。
 * ============================================================ */
(function () {
  'use strict';
  if (typeof window.wx !== 'undefined') return; // 幂等

  // [v23] 自动播放策略自愈：浏览器要求「首次用户手势」后才允许出声。
  // 一旦页面收到任意一次真实手势（点/触/键），后续所有 InnerAudioContext 都改为
  // 有声方式播放，解开「静音预热 → 解不开」的死局——BGM / 游戏音效 / 变身视频因此全部出声。
  // [v24 修正] 大屏/网页常「自动开局」，BGM 在首次手势前就已以静音方式起播并被浏览器拦下
  // （_unmuteBlocked=true），之后即便玩家点击也再无人解静音 → BGM 永久静音。
  // 因此首次真实手势时，主动遍历所有「应当播放却卡在静音」的音频，强制解静音 / resume，
  // 同时恢复所有 WebAudio 上下文（游戏低延迟音效依赖它）。
  var __stwxAudioActivated = false;
  var __stwxAudioResumed = false;
  var __stwxAllInner = [];     // 全部 InnerAudioContext 实例（BGM / 音效用，用于手势后解静音）
  var __stwxAllWebAudio = [];  // 全部 WebAudio AudioContext（用于手势后 resume）
  // [2026-10-14] force=true 时忽略「一次性」标志，可重复执行（手势后阶梯重试要用）。
  function __stwxActivateAudioOnce(force) {
    if (__stwxAudioResumed && !force) return;
    __stwxAudioResumed = true;
    __stwxAllWebAudio.forEach(function (ctx) {
      try { if (ctx && ctx.state && ctx.state !== 'running' && ctx.resume) ctx.resume(); } catch (e) {}
    });
    __stwxAllInner.forEach(function (ic) {
      try {
        if (!ic._wantPlay) return;            // 本来就不该出声的，跳过
        ic._unmuteBlocked = false;
        try { ic._audio.muted = false; } catch (e) {}
        if (ic._audio.paused && !ic._audio.ended) {
          var q = ic._audio.play(); if (q && q.catch) q.catch(function () {});
        }
      } catch (e) {}
    });
  }
  function __stwxKioskRunActive() {
    try { return !!(window.__kioskRunState && (window.__kioskRunState() || {}).active); } catch (e) { return false; }
  }
  function __stwxMarkAudioActivated() {
    // [v25] 大屏音频闸门：未按第 2 下「开声音」（__kioskAudioOn===false）前，任何手势都不激活音频 → 保持静音。
    // [2026-10-13 修复] 但「已经开打」时闸门不该再拦：现场顾客「扫码 → 自动开局」可以一次按键都没按过，
    //   若继续拦，整局所有手势都不会激活音频 → 全程没有音乐音效。对局中一律放行。
    if (typeof window !== 'undefined' && window.__kioskAudioOn === false && !__stwxKioskRunActive()) return;
    __stwxAudioActivated = true;
    __stwxActivateAudioOnce();
    // [2026-10-14 修复] 关键：**手势处理器「内部」同步调用 play() 一定会被 autoplay 策略拒**
    //   （实测 inGesture play → NotAllowedError；手势结束后同一元素 play → resolved）。
    //   所以「手势内补播」是无效动作，必须交给手势**之后**的阶梯重试。见 __stwxPumpAudioRetry。
    try { window.__stwxPumpAudioRetry('gesture'); } catch (e) {}
  }
  // [2026-10-14] 手势之后的阶梯重试：浏览器只在「事件派发结束」后才记录 sticky activation，
  //   因此 play()/resume() 必须稍后重试才可能成功。每轮用 token 去重，避免连点造成重试风暴。
  var __stwxPumpToken = 0;
  var __stwxPumpDelays = [0, 100, 300, 700, 1500, 2600];
  window.__stwxPumpAudioRetry = function (tag) {
    var token = ++__stwxPumpToken;
    __stwxPumpDelays.forEach(function (d, i) {
      try {
        setTimeout(function () {
          if (token !== __stwxPumpToken) return;   // 已有更新的手势 → 丢弃旧的一轮
          if (typeof window !== 'undefined' && window.__kioskAudioOn === false && !__stwxKioskRunActive()) return;
          __stwxAudioActivated = true;
          try { __stwxActivateAudioOnce(true); } catch (e) {}
          try { if (window.__stwxAudioRetryNow) window.__stwxAudioRetryNow(); } catch (e2) {}
        }, d);
      } catch (e3) {}
    });
    return { scheduled: __stwxPumpDelays.length, tag: String(tag || '') };
  };
  // [v25] 大屏第 2 下「开声音」显式强制激活：忽略一次性标志，重扫全部 InnerAudio/WebAudio 解静音。
  // [2026-10-14] 该函数很可能是**在某个手势处理器内**被调用的（按键/点屏），
  //   而手势内的 play() 必被拒 → 这里顺带排一轮手势后阶梯重试，保证真的出声。
  window.__stwxForceActivateAudio = function () {
    __stwxAudioActivated = true;
    __stwxAudioResumed = false;
    __stwxActivateAudioOnce(true);
    try { window.__stwxPumpAudioRetry('force-activate'); } catch (e) {}
    try { if (window.__stwxAudioRetryNow) window.__stwxAudioRetryNow(); } catch (e2) {}
    return { inner: __stwxAllInner.length, web: __stwxAllWebAudio.length };
  };
  ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'].forEach(function (ev) {
    try { window.addEventListener(ev, __stwxMarkAudioActivated, { capture: true, passive: true }); } catch (e) {}
  });

  /* ---------- 画布：首次 createCanvas 返回主画布，后续返回离屏画布 ---------- */
  var mainCanvas = document.getElementById('gameCanvas');
  var mainCanvasGiven = false;
  function makeCanvas() { return document.createElement('canvas'); }

  /* ---------- 图片 ---------- */
  function createImage() {
    var img = new Image();
    // 同源资源，无需 crossOrigin；保留 onerror 原生行为
    return img;
  }

  /* ---------- 系统信息 ---------- */
  function sysInfo() {
    var w = window.innerWidth, h = window.innerHeight;
    return {
      windowWidth: w, windowHeight: h,
      screenWidth: window.screen ? window.screen.width : w,
      screenHeight: window.screen ? window.screen.height : h,
      pixelRatio: window.devicePixelRatio || 1,
      platform: 'devtools',
      system: 'Web ' + (navigator.userAgent || ''),
      language: navigator.language || 'zh_CN',
      benchmarkLevel: 30,
      safeArea: { top: 0, bottom: h, left: 0, right: w, width: w, height: h }
    };
  }
  function deviceInfo() {
    return { platform: 'devtools', system: 'Web', brand: 'web', model: 'browser',
      pixelRatio: window.devicePixelRatio || 1, windowWidth: window.innerWidth, windowHeight: window.innerHeight };
  }

  /* ---------- 存储：localStorage + JSON 序列化（微信 getStorageSync 缺省返回 ''） ---------- */
  // [hangzhou-web] 线下直入：URL 带 hz=1 时，进度存档强制锁定为「教学已完成 + 永远杭州 L4」。
  // 游戏对局中写回的进度一律忽略（线下机不跟随游玩进度，每次进入都是杭州关）。round>=2 = 全关解锁。
  function hangzhouForced() {
    try { return new URLSearchParams(window.location.search).get('hz') === '1'; } catch (e) { return false; }
  }
  // [hangzhou-web] ?skin=bainiangzi|xiaoqing 可指定开局穿戴的皮肤（调试/演示用；缺省 classic）。
  // 只对白娘子/小青生效，其它值一律回退 classic，防止把已裁剪的皮肤带回来。
  function forcedSkinId() {
    try {
      var s = String(new URLSearchParams(window.location.search).get('skin') || '');
      return (s === 'bainiangzi' || s === 'xiaoqing') ? s : 'classic';
    } catch (e) { return 'classic'; }
  }
  function hangzhouProgress() {
    return {
      totalScore: 0, bestScore: 0, runs: 0, totalFood: 0,
      currentStage: 6, unlockedStage: 14, pendingPortalStage: -1,
      tutorialSeen: true, gateTutorialSeen: true, lastCelebratedUnlockStage: 6,
      firstThreeCleared: 3,
      round: 2, pendingRoundTarget: 0,
      roundUnlockBaseScore: 0, roundUnlockRound: 2,
      unlockSystemVersion: 3
    };
  }
  var storage = {
    setStorageSync: function (k, v) {
      if (hangzhouForced() && String(k) === 'super_tongue_axi_v50_progress') return; // 直入模式：不落盘
      try { window.localStorage.setItem(String(k), JSON.stringify({ __wxv: v })); } catch (e) {}
    },
    getStorageSync: function (k) {
      try {
        if (hangzhouForced() && String(k) === 'super_tongue_axi_v50_progress') return hangzhouProgress();
        // [hangzhou-web] 皮肤存档：线下版只有 classic/白娘子/小青 三角色，
        // 强制重置皮肤存档，防止旧档 equipped 指向已裁剪的 spider/bat/potato。
        // 免费皮肤（白娘子/小青）由游戏启动时的 syncFreeSkinOwnership 自动补 owned。
        if (hangzhouForced() && String(k) === 'super_tongue_axi_v5860_skins') {
          var sk = forcedSkinId();
          var owned = { classic: true };
          // 白娘子/小青是 free 皮肤，游戏启动的 syncFreeSkinOwnership 会自动补 owned；这里预置更稳。
          if (sk === 'bainiangzi' || sk === 'xiaoqing') owned[sk] = true;
          return { equipped: sk, owned: owned, unlockedAt: {} };
        }
        var raw = window.localStorage.getItem(String(k));
        if (raw === null || raw === undefined) {
          // 首次无进度时也直入杭州（兼容不带 hz=1 的默认线下场景）
          if (String(k) === 'super_tongue_axi_v50_progress') return hangzhouProgress();
          return '';
        }
        var box = JSON.parse(raw);
        return (box && box.__wxv !== undefined) ? box.__wxv : raw;
      } catch (e) { return ''; }
    },
    removeStorageSync: function (k) { try { window.localStorage.removeItem(String(k)); } catch (e) {} },
    clearStorageSync: function () { /* 不清整个 localStorage，避免误伤门禁标记 */ }
  };

  /* ---------- 音频：InnerAudioContext 包装 HTML Audio ---------- */
  function InnerAudioContext() {
    var audio = new Audio();
    audio.preload = 'auto';
    var self = this;
    this._audio = audio;
    // [2026-10-14 v31 致命修复] src 必须真正传给底层 HTML Audio！
    //   原实现 `this.src` 是普通 JS 属性、从未赋给 audio.src → 媒体元素永远拿到空 src：
    //   load 永不开始、canplay 永不触发 → InnerAudio 通道（BGM + 整个音效池）整条静音，
    //   而 core 的 playInnerAudio 恒返回 true，把 WebAudio 兜底也短路 —— 表现即
    //   「哪一关都没有背景音乐、游戏音效时有时无」（页面直挂的 <video> 不走 shim，所以视频有声）。
    //   改为定义 src setter：赋值即同步 audio.src 立即开始加载（配合 preload='auto'）。
    this.loop = false; this.volume = 1; this.autoplay = false; this.obeyMuteSwitch = true;
    this._src = '';
    Object.defineProperty(this, 'src', {
      get: function () { return self._src; },
      set: function (v) {
        self._src = String(v == null ? '' : v);
        try { audio.src = self._src; } catch (e) {}
      }
    });
    this.autoMutePrime = true; this._wantPlay = false; this._unmuteBound = false;
    this._handlers = {};
    this.playedAt = 0;
    audio.addEventListener('ended', function () { emit('ended'); });
    audio.addEventListener('error', function () { emit('error', { errMsg: 'audio error' }); });
    audio.addEventListener('canplay', function () { emit('canplay'); });
    function emit(name, arg) { var hs = self._handlers[name]; if (hs) for (var i = 0; i < hs.length; i++) { try { hs[i](arg || {}); } catch (e) {} } }
    Object.defineProperty(this, 'currentTime', {
      get: function () { return audio.currentTime || 0; },
      set: function (v) { try { audio.currentTime = v; } catch (e) {} }
    });
    // [v22.4] 自动播放策略绕行：先静音起播（muted autoplay 各浏览器都放行），
    // 首个 'playing' 事件时尝试取消静音；严格策略浏览器（Chrome）取消静音会立刻暂停 →
    // 350ms 内检测到暂停就标记 _unmuteBlocked、恢复静音继续播放（出声交给第一次用户手势）。
    // opts.forceSound = 用户手势内调用：直接有声播放，绕过静音预热。
    this.play = function (opts) {
      var forceSound = !!(opts && opts.forceSound) || __stwxAudioActivated;
      audio.loop = !!self.loop;
      audio.volume = Math.max(0, Math.min(1, self.volume));
      // [2026-10-14 v31] src 已设但资源选择卡在 NETWORK_EMPTY（现场大屏实测会出现：
      //   元素永远 rs=0、play() 永远挂起 → BGM「假播放」）→ load() 强制重启资源选择。
      try { if (audio.src && !audio.currentSrc && audio.networkState === 0) audio.load(); } catch (e) {}
      var p;
      // [2026-10-14 v31 致命修复·BGM 卡死真因] play() 被 autoplay 策略拒绝时，元素的
      //   paused 属性会**停留在 false**（Chrome 行为：rejected play 不回弹 paused）。
      //   而所有恢复链（core audioRecoverOnce / __stwxActivateAudioOnce）都靠
      //   `if (paused) play()` 判断「该不该补播」→ 永远跳过 → BGM 永久卡死。
      //   （音效是一次性的：每次先 stop() 会把 paused 复位 true，所以手势后能活——
      //    这正是现场「第2关起音效有、BGM 永远没有」的完整解释。）
      //   修法：play promise 一旦 reject，立刻 audio.pause() 把 paused 复位回 true，
      //   让既有的全部恢复链重新接管。_stwxPlayRejected 供诊断。
      function guardRejected(pr) {
        if (pr && pr.catch) pr.catch(function () {
          self._playRejected = true;
          try { if (!audio.ended) audio.pause(); } catch (e) {}
        });
      }
      if (self.autoMutePrime && !forceSound) {
        self._wantPlay = true;
        self._playRejected = false;
        try { audio.muted = true; } catch (e) {}
        p = audio.play();
        guardRejected(p);
        if (!self._unmuteBound) {
          self._unmuteBound = true;
          audio.addEventListener('playing', function onFirstPlaying() {
            audio.removeEventListener('playing', onFirstPlaying);
            if (!self._wantPlay || self._unmuteBlocked) return;
            try { audio.muted = false; } catch (e2) {}
            setTimeout(function () {
              if (self._wantPlay && audio.paused && !audio.ended) {
                // 取消静音被拒（浏览器暂停了）→ 保持静音播放，等手势强制出声
                self._unmuteBlocked = true;
                try { audio.muted = true; } catch (e3) {}
                var q = audio.play(); if (q && q.catch) q.catch(function () {});
              }
            }, 350);
          });
        }
      } else {
        // [2026-10-14 修复] 走「直接有声」分支时也必须记下 _wantPlay：
        //   否则若这次 play() 因 autoplay 策略被拒（零手势开局常见），后续手势激活
        //   （__stwxActivateAudioOnce 里 `if (!ic._wantPlay) return;`）会直接跳过它，
        //   这段音频就再也没有机会被手势救回来 —— 现场表现＝整局没有背景音乐。
        self._wantPlay = true;
        self._playRejected = false;
        self._unmuteBlocked = false;
        try { audio.muted = false; } catch (e) {}
        p = audio.play();
        guardRejected(p);
      }
    };
    this.pause = function () { self._wantPlay = false; audio.pause(); };
    this.stop = function () { self._wantPlay = false; try { audio.pause(); audio.currentTime = 0; } catch (e) {} };
    this.destroy = function () { self._wantPlay = false; try { audio.pause(); audio.src = ''; } catch (e) {} };
    this.onPlay = function (f) { push('play', f); audio.addEventListener('play', function () { emit('play'); }); return self; };
    this.onStop = function (f) { push('stop', f); return self; };
    this.onEnded = function (f) { push('ended', f); return self; };
    this.onError = function (f) { push('error', f); return self; };
    this.onCanplay = function (f) { push('canplay', f); return self; };
    this.onPause = function (f) { push('pause', f); audio.addEventListener('pause', function () { emit('pause'); }); return self; };
    this.onWaiting = function () { return self; };
    this.onSeeking = function () { return self; };
    function push(n, f) { (self._handlers[n] = self._handlers[n] || []).push(f); }
    try { __stwxAllInner.push(self); } catch (e) {}
  }

  /* ---------- WebAudio（游戏用它做低延迟音效） ---------- */
  function createWebAudioContext() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      var ctx = new AC();
      ctx.__wx = true;
      try { __stwxAllWebAudio.push(ctx); } catch (e) {}
      return ctx;
    } catch (e) { return null; }
  }

  /* ---------- 文件系统：同源 XHR ---------- */
  function fsReadFileSync(p, encoding) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', p, false); // 同步：仅用于包内小文件（JSON/清单）
    try { xhr.send(null); } catch (e) { throw new Error('fs read fail: ' + p); }
    if (xhr.status !== 200 && xhr.status !== 0) throw new Error('fs not found: ' + p);
    if (encoding === 'utf8' || encoding === 'utf-8') return xhr.responseText;
    // 二进制 → ArrayBuffer
    var buf = xhr.responseText; var len = buf.length; var ab = new ArrayBuffer(len); var u8 = new Uint8Array(ab);
    for (var i = 0; i < len; i++) u8[i] = buf.charCodeAt(i) & 0xff;
    return ab;
  }
  function fsReadFile(opt) {
    var p = opt && opt.filePath; var enc = opt && opt.encoding;
    fetch(p).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return (enc === 'utf8' || enc === 'utf-8') ? r.text() : r.arrayBuffer();
    }).then(function (data) {
      opt.success && opt.success({ data: data });
    }).catch(function () {
      opt.fail && opt.fail({ errMsg: 'readFile fail: ' + p });
    });
  }
  var FSM = {
    readFileSync: fsReadFileSync,
    readFile: fsReadFile,
    writeFileSync: function () {}, writeFile: function (o) { o && o.success && setTimeout(o.success, 0); },
    existsSync: function (p) { try { fsReadFileSync(p, 'utf8'); return true; } catch (e) { return false; } },
    accessSync: function () {}, mkdirSync: function () {}, unlinkSync: function () {},
    readdirSync: function () { return []; }, statSync: function () { return { isFile: function () { return true; }, isDirectory: function () { return false; } }; }
  };

  /* ---------- 分包：全部 JS 已随页面加载，直接成功 ---------- */
  function loadSubpackage(opt) {
    setTimeout(function () { opt && opt.success && opt.success({}); opt && opt.complete && opt.complete({}); }, 0);
    return { onLoad: function () {}, onError: function () {} };
  }

  /* ---------- 触摸/鼠标/键盘桥接（把浏览器事件翻译成 wx 回调） ---------- */
  var touchHandlers = { start: [], move: [], end: [], cancel: [] };
  var mouseHandlers = {}, keyHandlers = [], wheelHandlers = [];
  function toLogicalX(clientX) {
    var r = mainCanvas.getBoundingClientRect();
    return (clientX - r.left) / (r.width || 1) * (window.innerWidth || r.width);
  }
  function toLogicalY(clientY) {
    var r = mainCanvas.getBoundingClientRect();
    return (clientY - r.top) / (r.height || 1) * (window.innerHeight || r.height);
  }
  function fireTouch(list, type) {
    // [hangzhou-web 修复] touchend/cancel 的 touches 必须为空数组——否则 core 的
    // touchActiveCount 会一直停在 1，舌头/按压状态收不了尾（鼠标合成触摸后尤其明显）。
    var ending = (type === 'end' || type === 'cancel');
    var ev = { timeStamp: Date.now(), touches: ending ? [] : list, changedTouches: list };
    var hs = touchHandlers[type] || [];
    for (var i = 0; i < hs.length; i++) { try { hs[i](ev); } catch (e) { console.error('[wx-shim] touch handler', e); } }
  }
  function mkTouch(e, id) { return { identifier: id, x: toLogicalX(e.clientX), y: toLogicalY(e.clientY), clientX: e.clientX, clientY: e.clientY }; }

  function bindInput(el) {
    if (!el) return;
    // 触摸。sawTouch：本会话出现过真实触摸（手机/触屏）后，鼠标合成一律停用，避免双触发。
    var sawTouch = false;
    el.addEventListener('touchstart', function (e) { sawTouch = true; e.preventDefault(); fireTouch(map(e.touches, e), 'start'); }, { passive: false });
    el.addEventListener('touchmove', function (e) { e.preventDefault(); fireTouch(map(e.touches, e), 'move'); }, { passive: false });
    el.addEventListener('touchend', function (e) { fireTouch(map(e.changedTouches, e), 'end'); });
    el.addEventListener('touchcancel', function (e) { fireTouch(map(e.changedTouches, e), 'cancel'); });
    function map(list, e) { var out = []; for (var i = 0; i < list.length; i++) out.push(mkTouch(list[i], list[i].identifier !== undefined ? list[i].identifier : i)); return out; }
    // 鼠标（微信开发者工具同款语义： onMouseDown/Move/Up）
    function fireMouse(name, e) {
      var hs = mouseHandlers[name] || [];
      var arg = { x: toLogicalX(e.clientX), y: toLogicalY(e.clientY), clientX: e.clientX, clientY: e.clientY, button: e.button, timeStamp: Date.now() };
      for (var i = 0; i < hs.length; i++) { try { hs[i](arg); } catch (err) {} }
    }
    // [hangzhou-web] 桌面浏览器（大屏/PC）：把鼠标事件【合成】为触摸事件，
    // 这样整场游戏（引导页/菜单/选人/游玩）用鼠标都能玩，不必依赖触屏。
    // 一旦本会话出现过真实触摸（手机），mouse 合成自动失效，避免同一次点按被处理两次。
    var mouseHeld = false;
    function synthTouch(e, type) { if (sawTouch) return; fireTouch([{ identifier: 1, clientX: e.clientX, clientY: e.clientY }], type); }
    el.addEventListener('mousedown', function (e) {
      fireMouse('down', e);
      if (sawTouch) return;
      mouseHeld = true; synthTouch(e, 'start');
    });
    el.addEventListener('mousemove', function (e) {
      fireMouse('move', e);
      if (sawTouch || !mouseHeld) return;
      synthTouch(e, 'move');
    });
    window.addEventListener('mouseup', function (e) {
      fireMouse('up', e);
      if (sawTouch || !mouseHeld) return;
      mouseHeld = false; synthTouch(e, 'end');
    });
    window.addEventListener('wheel', function (e) {
      var arg = { deltaX: e.deltaX, deltaY: e.deltaY, x: toLogicalX(e.clientX), y: toLogicalY(e.clientY) };
      var hs1 = wheelHandlers[0] || null;
      for (var i = 0; i < wheelHandlers.length; i++) { try { wheelHandlers[i](arg); } catch (err) {} }
      var hs = mouseHandlers.wheel || [];
      for (var j = 0; j < hs.length; j++) { try { hs[j](arg); } catch (err) {} }
    }, { passive: true });
    // 键盘
    window.addEventListener('keydown', function (e) {
      for (var i = 0; i < keyHandlers.length; i++) { try { keyHandlers[i]({ key: e.key, code: e.code, keyCode: e.keyCode, preventDefault: function () { e.preventDefault(); } }); } catch (err) {} }
    });
  }

  /* ---------- UI：toast / modal（DOM 实现） ---------- */
  var toastEl = null, toastTimer = 0;
  function showToast(opt) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:9999;' +
        'background:rgba(0,0,0,.72);color:#fff;padding:10px 18px;border-radius:10px;font-size:15px;pointer-events:none;transition:opacity .25s;opacity:0;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = (opt && opt.title) || '';
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, (opt && opt.duration) || 1500);
  }
  function showModal(opt) {
    return new Promise(function (resolve) {
      var ok = window.confirm((opt && opt.content) || (opt && opt.title) || '');
      resolve({ confirm: !!ok, cancel: !ok });
    });
  }

  /* ---------- 广告/分享/登录：线下场景的诚实桩 ---------- */
  function RewardedVideoAdStub() {
    // [hangzhou-web] 线下体验：无广告 SDK，玩家点「看广告复活/领奖」直接视为完整看完，
    // 立刻触发 onClose({isEnded:true}) 走游戏自己的发奖链路（复活 +1 心 / 任务奖励）。
    var closeCb = null;
    this.load = function () { return Promise.resolve(); };
    this.show = function () {
      setTimeout(function () { try { closeCb && closeCb({ isEnded: true }); } catch (e) {} }, 300);
      return Promise.resolve();
    };
    this.onLoad = function () { return this; };
    this.onError = function () { return this; }; // 桩永不报错，避免游戏跌到「暂无广告」分支
    this.onClose = function (f) { closeCb = f; return this; };
  }
  function InterstitialAdStub() {
    this.load = function () {}; this.show = function () {}; this.destroy = function () {};
    this.onLoad = function () { return this; }; this.onError = function (f) { setTimeout(function () { f && f({ errMsg: 'no ad in web' }); }, 0); return this; }; this.onClose = function () { return this; };
  }
  var openDataCtx = null;
  function getOpenDataContext() {
    if (!openDataCtx) {
      var cv = makeCanvas(); cv.width = 320; cv.height = 200;
      openDataCtx = { __canvas: cv, postMessage: function () {} };
    }
    return openDataCtx;
  }

  /* ---------- 组装 wx ---------- */
  var wx = {
    // 画布
    createCanvas: function () { if (!mainCanvasGiven && mainCanvas) { mainCanvasGiven = true; return mainCanvas; } return makeCanvas(); },
    createImage: createImage,
    // 系统
    getSystemInfoSync: sysInfo, getDeviceInfo: deviceInfo,
    getSystemInfo: function (cb) { setTimeout(function () { cb && cb(sysInfo()); }, 0); },
    // 存储
    setStorageSync: storage.setStorageSync, getStorageSync: storage.getStorageSync,
    removeStorageSync: storage.removeStorageSync, clearStorageSync: storage.clearStorageSync,
    // 音频
    createInnerAudioContext: function () { return new InnerAudioContext(); },
    setInnerAudioOption: function (o) { o && o.success && setTimeout(o.success, 0); },
    createWebAudioContext: createWebAudioContext,
    // 文件
    getFileSystemManager: function () { return FSM; },
    env: { USER_DATA_PATH: 'wxuser://' },
    // 分包
    loadSubpackage: loadSubpackage,
    // 输入
    onTouchStart: function (f) { touchHandlers.start.push(f); },
    onTouchMove: function (f) { touchHandlers.move.push(f); },
    onTouchEnd: function (f) { touchHandlers.end.push(f); },
    onTouchCancel: function (f) { touchHandlers.cancel.push(f); },
    offTouchStart: function (f) { touchHandlers.start = touchHandlers.start.filter(function (h) { return h !== f; }); },
    offTouchEnd: function (f) { touchHandlers.end = touchHandlers.end.filter(function (h) { return h !== f; }); },
    onMouseDown: function (f) { (mouseHandlers.down = mouseHandlers.down || []).push(f); },
    onMouseMove: function (f) { (mouseHandlers.move = mouseHandlers.move || []).push(f); },
    onMouseUp: function (f) { (mouseHandlers.up = mouseHandlers.up || []).push(f); },
    onMouseWheel: function (f) { (mouseHandlers.wheel = mouseHandlers.wheel || []).push(f); },
    onWheel: function (f) { wheelHandlers.push(f); },
    onKeyDown: function (f) { keyHandlers.push(f); },
    // [hangzhou-web] 页面层合成一次点按（引导页自动跳过、大屏无人值守时驱动游戏）
    __simulateTap: function (clientX, clientY) {
      var list = [{ identifier: 1, clientX: clientX, clientY: clientY }];
      fireTouch(list, 'start'); fireTouch(list, 'end');
    },
    // [hangzhou-web 2026-10-10 晚] 合成一次「按住后抬起」。
    // ⚠️ 游玩场景必须用这个而不是 __simulateTap：core 的 handleRelease 里
    //    if (player.pressOpenTimer > 0) 会把「按住时长不足 PRESS_OPEN_DURATION(0.16s)」的
    //    触摸判定成轻点（只出瞄准提示、不发射舌头）→ 实体按钮按一下没反应。
    //    按住 >=0.2s 才会走 attachTongue（伸舌挂钩），抬起时 detachTongue（荡出去）。
    __simulateHold: function (clientX, clientY, holdMs) {
      var list = [{ identifier: 1, clientX: clientX, clientY: clientY }];
      fireTouch(list, 'start');
      setTimeout(function () { fireTouch(list, 'end'); }, Math.max(80, Number(holdMs) || 260));
    },
    // [hangzhou-web 2026-10-10 深夜] 现场只有一颗 USB 空白键：长按要能【持续挂锚点】。
    //   固定时长的 __simulateHold 做不到长按，故拆成两个原语，由页面层在 keydown/keyup 分别调用。
    __simulatePress: function (clientX, clientY) {
      fireTouch([{ identifier: 1, clientX: clientX, clientY: clientY }], 'start');
    },
    __simulateRelease: function (clientX, clientY) {
      fireTouch([{ identifier: 1, clientX: clientX, clientY: clientY }], 'end');
    },
    // 反馈/震动
    vibrateShort: function (o) { try { navigator.vibrate && navigator.vibrate(15); } catch (e) {} o && o.success && setTimeout(o.success, 0); },
    vibrateLong: function (o) { try { navigator.vibrate && navigator.vibrate(60); } catch (e) {} o && o.success && setTimeout(o.success, 0); },
    showToast: showToast, hideToast: function () {},
    showModal: showModal,
    setClipboardData: function (o) { try { navigator.clipboard && navigator.clipboard.writeText(o && o.data || ''); } catch (e) {} o && o.success && setTimeout(o.success, 0); },
    // 分享（线下：直接视为成功，任务「分享」可完成）
    shareAppMessage: function (o) { console.info('[wx-shim] shareAppMessage（网页版直接成功）', o && o.title); o && o.success && setTimeout(function () { o.success({}); }, 60); },
    showShareMenu: function (o) { o && o.success && setTimeout(o.success, 0); },
    onShareAppMessage: function () {}, onShareTimeline: function () {},
    shareFileMessage: function (o) { o && o.success && setTimeout(o.success, 0); },
    // 登录/用户（线下：匿名游客）
    getUserProfile: function (o) { o && o.success && setTimeout(function () { o.success({ userInfo: { nickName: '线下游客', avatarUrl: '' } }); }, 0); },
    getUserInfo: function (o) { o && o.success && setTimeout(function () { o.success({ userInfo: { nickName: '线下游客', avatarUrl: '' } }); }, 0); },
    setUserCloudStorage: function (o) { o && o.success && setTimeout(o.success, 0); },
    checkIsAddedToMyMiniProgram: function (o) { o && o.fail && setTimeout(function () { o.fail({ errMsg: 'not in minigame' }); }, 0); },
    // 广告
    createRewardedVideoAd: function () { return new RewardedVideoAdStub(); },
    createInterstitialAd: function () { return new InterstitialAdStub(); },
    // 开放数据域（好友排行榜沙箱：网页版给个空画布兜底）
    getOpenDataContext: getOpenDataContext,
    getSharedCanvas: function () { return getOpenDataContext().__canvas; },
    // 生命周期
    getLaunchOptionsSync: function () { return { scene: 1047, query: parseQuery(), shareTicket: '' }; },
    onShow: function (f) { window.addEventListener('pageshow', f); document.addEventListener('visibilitychange', function () { if (!document.hidden) f({}); }); },
    onHide: function (f) { document.addEventListener('visibilitychange', function () { if (document.hidden) f({}); }); },
    onError: function (f) { window.addEventListener('error', function (e) { f && f(e.message || 'error'); }); },
    onUnhandledRejection: function (f) { window.addEventListener('unhandledrejection', function (e) { f && f({ reason: String(e.reason) }); }); },
    onAudioInterruptionBegin: function () {}, onAudioInterruptionEnd: function () {},
    // 帧率/性能
    setPreferredFramesPerSecond: function () {},
    getRealtimeLogManager: function () { return { info: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console), setFilterMsg: function () {}, addFilterMsg: function () {} }; },
    // 性能守卫
    getPerformance: function () { return { createObserver: function () { return { observe: function () {}, disconnect: function () {} }; } }; },
    // 云开发：网页版没有 wx.cloud —— 游戏内所有云端分支会自动走本地兜底（代码已护栏）
    // 注意：故意不定义 wx.cloud
  };
  wx.cloud = undefined;

  function parseQuery() {
    var out = {}; var q = window.location.search.replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (kv) {
      var p = kv.split('='); if (!p[0]) return;
      try { out[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); } catch (e) { out[p[0]] = p[1] || ''; }
    });
    return out;
  }

  window.wx = wx;
  if (typeof window.GameGlobal === 'undefined') window.GameGlobal = window;
  window.__wxShimReady = true;
  bindInput(mainCanvas);
})();
