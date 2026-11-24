/* 第四关「九龙救白蛇」接入桥（完整版 · 2026-11-24 独立部署）
 * 流程：三侠闯关（地图甲/乙/丙）完成 → __kioskOnRunComplete(summary)
 *       → 【过场影片 media/l4_transition.mp4 全屏播放 10s】
 *       → 播完才弹出第四关 iframe（carry = 三关总分 summary.total）
 *       → 九龙关 jiulong:win 回传 → 最终合计 = carry + 本关分 → 交回原 showWin 展示总分榜
 */
(function () {
  'use strict';
  var LOG = '[L4-BRIDGE]';
  function log() { try { console.log.apply(console, [LOG].concat([].slice.call(arguments))); } catch (e) {} }

  var origOnComplete = window.__kioskOnRunComplete;   // 原 showWin
  var pending = null;        // 三关 summary
  var finished = false;      // 防重复结算

  // —— 第四关浮层 ——
  var ov = document.createElement('div');
  ov.id = 'l4Overlay';
  ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:999999;background:#000;display:none;flex-direction:column;';
  ov.innerHTML =
    // v0.89 — 「首页满屏」:顶栏改成半透明浮层(不占布局高度),iframe 绝对定位铺满整个浮层,
    // 第四关封面/游戏画面真正满屏;顶栏仅一条细带浮在上方,视频层 z-index 更高可完整盖住。
    '<div id="l4Bar" style="position:absolute;left:0;top:0;right:0;z-index:2;min-height:40px;background:linear-gradient(90deg,rgba(22,36,60,.88),rgba(36,70,110,.72));color:#e8f1ff;' +
    'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 16px;font:600 14px/1.4 system-ui,sans-serif;text-shadow:0 1px 3px #000a;">' +
    '<span>第四关 · 九龙救白蛇　|　前三关累计 <b id="l4Carry" style="color:#ffd85f;">0</b> 分</span>' +
    '<span style="display:flex;gap:8px;">' +
    '<button id="l4Replay" type="button" style="padding:4px 11px;border:none;border-radius:7px;background:#3a5f8f;color:#fff;font:600 12px system-ui;cursor:pointer;">重玩本关</button>' +
    '<button id="l4Skip" type="button" style="padding:4px 11px;border:none;border-radius:7px;background:#e8a33d;color:#1a1200;font:700 12px system-ui;cursor:pointer;">跳过 → 看合计</button>' +
    '</span></div>' +
    '<iframe id="l4Frame" tabindex="0" src="about:blank" style="position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:#000;opacity:0;transition:opacity .55s ease;"></iframe>' +
    // —— 过场影片层：三关过关后先播，播完才露出第四关 iframe ——
    '<div id="l4VideoLayer" style="display:none;position:absolute;left:0;top:0;right:0;bottom:0;z-index:5;background:#000;align-items:center;justify-content:center;">' +
    '<video id="l4Video" src="media/l4_transition.mp4" playsinline preload="auto" style="width:100%;height:100%;object-fit:cover;background:#000;"></video>' +
    '<button id="l4VideoSkip" type="button" style="position:absolute;right:18px;bottom:18px;padding:8px 16px;border:none;border-radius:8px;' +
    'background:#e8a33d;color:#1a1200;font:700 14px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.6);">跳过影片 ▶</button>' +
    '</div>';
  document.body.appendChild(ov);
  // v1.13 — 用户「取消按钮全部都用空白键来进行下一步」：隐藏桥接层全部鼠标按钮，
  // v1.16 — 用户「这也都不要了」(顶栏重玩/跳过按钮)：整条顶栏 l4Bar 连同所有按钮一起移除,
  //        右下角预览按钮 l4PreviewBtn 也直接 remove(),不保留 DOM —— 比 display:none 更彻底,
  //        即使有旧逻辑再摸它也不会重现。流程推进全部空格键驱动。
  (function hideBridgeButtons(){
    // 顶栏整条移除(含"第四关·九龙救白蛇 | 前三关累计X分"文字 + 重玩/跳过按钮)
    var bar=document.getElementById('l4Bar');
    if(bar){ bar.style.setProperty('display','none','important'); bar.remove(); }
    // 其余鼠标按钮直接从 DOM 删除
    ['l4Replay','l4Skip','l4VideoSkip','l4PreviewBtn'].forEach(function(id){
      var b=document.getElementById(id);
      if(b){ try{b.remove();}catch(e){ b.style.setProperty('display','none','important'); b.tabIndex=-1; } }
    });
  })();
  var carryEl = document.getElementById('l4Carry');
  var frame = document.getElementById('l4Frame');
  var vLayer = document.getElementById('l4VideoLayer');
  var video = document.getElementById('l4Video');

  // —— v0.86 [预览] 进入第四关：自动聚焦窗口 + 淡入 + 自动全屏 ——
  // 用户痛点：iframe 载入后焦点还留在父页面，空格键要先用鼠标点一下页面才响应；且要求打开即全屏+淡入。
  function focusL4() {
    try {
      frame.focus({ preventScroll: true });                 // 先让 iframe 元素本身拿到焦点
      var w = frame.contentWindow;
      if (w) { try { w.focus(); } catch (e) {} }            // 再让 iframe 内的 window 聚焦（game.js 的 keydown 绑在这里）
      var d = w && w.document;
      if (d) {
        var cv = d.getElementById('game-canvas');
        if (cv) { try { if (cv.tabIndex < 0) cv.tabIndex = 0; cv.focus({ preventScroll: true }); } catch (e) {} }
        try { d.body.focus && d.body.focus({ preventScroll: true }); } catch (e) {}
      }
      log('L4 focused');
    } catch (e) { log('focusL4 err', e); }
  }
  // v0.88 — [空格直接启动] 用户:进入第四关按空格没反应,要「进去就自动点击窗口」。
  // 根因:iframe 加载后键盘焦点还留在父页面/视频跳过按钮上,游戏 window 收不到 keydown。
  // 解法:等 iframe 内游戏脚本就绪(JiulongGame 出现)后,主动把焦点交给 iframe 与 canvas,
  // 并派发一次【无害的自动点击】(落在画布左上角空白,远离选人区/开始按钮)激活 browsing context,
  // 之后玩家直接按空格即可被游戏 window 的 keydown 接收 → intro 阶段 startGame 启动。
  function armSpaceStart() {
    var tries = 0;
    var timer = setInterval(function () {
      var w = null, d = null, ready = false;
      try { w = frame.contentWindow; d = w && w.document; ready = !!(w && w.JiulongGame && w.JiulongGame.getState); } catch (e) {}
      if (ready) {
        clearInterval(timer);
        // v0.89 — 先把父页面所有按钮失焦(尤其 #l4VideoSkip:点过「跳过影片」后焦点滞留此处,
        // 空格会被它的默认行为吃掉)。否则焦点一回到父页按钮,空格就进不了游戏。
        try {
          var pbs = document.querySelectorAll('button');
          for (var bi = 0; bi < pbs.length; bi++) { try { pbs[bi].blur(); } catch (e2) {} }
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        } catch (e) {}
        try { frame.focus({ preventScroll: true }); } catch (e) {}
        try { w.focus(); } catch (e) {}
        var cv = d && d.getElementById('game-canvas');
        if (cv) {
          try { if (cv.tabIndex < 0) cv.tabIndex = 0; cv.focus({ preventScroll: true }); } catch (e) {}
          try {
            var r = cv.getBoundingClientRect();
            var px = r.left + Math.min(30, r.width * 0.05), py = r.top + Math.min(30, r.height * 0.05);
            cv.dispatchEvent(new w.PointerEvent('pointerdown', { clientX: px, clientY: py, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
            cv.dispatchEvent(new w.PointerEvent('pointerup', { clientX: px, clientY: py, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
            cv.dispatchEvent(new w.MouseEvent('click', { clientX: px, clientY: py, bubbles: true, button: 0 }));
          } catch (e) { log('auto-click err', e); }
        }
        // 自动点击可能令焦点漂移,稍后再钉一次
        setTimeout(function () { try { w.focus(); if (cv) cv.focus({ preventScroll: true }); } catch (e) {} }, 80);
        log('L4 space-start armed (auto focus+click)');
        return;
      }
      if (++tries > 80) clearInterval(timer);   // 约 24s 兜底
    }, 300);
  }
  function fadeInL4() {
    if (!frame) return;
    try { frame.style.opacity = '0'; } catch (e) {}
    // 双 rAF 确保浏览器先合成 opacity:0 这一帧，过渡才会生效
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      try { frame.style.opacity = '1'; } catch (e) {}
    }); });
  }
  function fullscreenL4() {
    try {
      var el = ov;
      if (document.fullscreenElement) return;              // 已全屏就不再请求
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (!req) { log('fullscreen API unavailable'); return; }
      var p = req.call(el);
      if (p && typeof p.catch === 'function') p.catch(function (e) { log('fullscreen denied', e && e.name); });
      else log('fullscreen requested');
    } catch (e) { log('fullscreenL4 err', e); }
  }
  // iframe 每次加载（首次进入 / 重玩）都重新淡入、聚焦、请求全屏。
  // 聚焦多做几次延时：standalone 里有图片/音频回调，过早 focus 可能被随后的 DOM 变更抢走。
  try {
    frame.addEventListener('load', function () {
      var src = frame.src || '';
      if (src.indexOf('jiulong') < 0) return;              // about:blank 不处理
      fadeInL4();
      fullscreenL4();
      focusL4();
      setTimeout(focusL4, 120);
      setTimeout(focusL4, 450);
      setTimeout(focusL4, 900);
      armSpaceStart();   // v0.88 — 等游戏就绪后自动点击窗口,让空格键直接启动
      // v0.87 — iframe 导航后 contentWindow 是【新的】window；旧的全屏手势监听绑在 about:blank
      // 的旧 window 上已失效。必须在新 window 上重绑，首次点击/按键才能补请求全屏。
      try {
        var cw = frame.contentWindow;
        ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
          cw.addEventListener(evt, fullscreenOnFirstGesture, { capture: true, passive: true });
        });
      } catch (e) {}
      log('L4 iframe loaded, focus/fade/fullscreen armed');
    });
  } catch (e) { log('frame load bind err', e); }

  // 浏览器要求 requestFullscreen 必须发生在用户手势里：load 回调那种自动请求常被拒。
  // 兜底：第四关已显示、尚未全屏时，用户第一次点击/按键（真机必然发生）立即补请求全屏，一次即可。
  var fsArmed = false;
  function fullscreenOnFirstGesture() {
    if (fsArmed) return;
    try {
      if (ov.style.display !== 'flex') return;              // 第四关还没显示
      if (document.fullscreenElement) { fsArmed = true; return; }
      var req = (ov.requestFullscreen || ov.webkitRequestFullscreen || ov.msRequestFullscreen);
      if (!req) return;
      var p = req.call(ov);
      fsArmed = true;
      if (p && typeof p.catch === 'function') p.catch(function () { fsArmed = false; }); // 失败允许下次手势重试
      else log('fullscreen via first gesture');
    } catch (e) {}
  }
  try {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
      document.addEventListener(evt, fullscreenOnFirstGesture, { capture: true, passive: true });
      try { frame.contentWindow.addEventListener(evt, fullscreenOnFirstGesture, { capture: true, passive: true }); } catch (e) {}
    });
  } catch (e) {}

  // —— v0.87 [空格兜底] 焦点还在父页面时按空格也要能启动/操作第四关 ——
  // iframe 是独立 browsing context：焦点在 iframe 内时父 document 收不到按键（游戏自己处理）；
  // 焦点在父页面时才走这里，把空格成对转发进 iframe。这样两种焦点状态都能响应，不会重复触发。
  function l4SpaceVisible() {
    if (!ov || ov.style.display !== 'flex') return false;
    if (vLayer && vLayer.style.display === 'flex') return false;   // 过场影片播放中不接管
    var src = frame ? (frame.src || '') : '';
    return src.indexOf('jiulong') >= 0;
  }
  function relaySpace(e) {
    if (e.code !== 'Space') return;
    // v1.13 — 过场影片播放中：空格 = 跳过影片(原「跳过影片 ▶」按钮已隐藏)。
    // 影片期间 l4SpaceVisible() 会返回 false,必须先在这里接管,否则空格失效。
    if (vLayer && vLayer.style.display === 'flex') {
      if (e.type === 'keydown' && !e.repeat) {
        e.preventDefault();
        try { fullscreenL4(); } catch (ef) {}
        try { finishTransition(); } catch (ef2) {}
        log('Space skip transition');
      }
      return;
    }
    if (!l4SpaceVisible()) return;
    // v0.89 — 不再因焦点在按钮上就放行：用户点过「跳过影片」后焦点常滞留在按钮,
    // 空格会被按钮默认行为吃掉,游戏收不到 → 表现为「按空格没反应」。
    // 第四关可见且影片不在播时,空格一律接管、成对转发进游戏。
    // 顶栏「重玩/跳过看合计」用鼠标点即可,不靠空格,故这里安全地抢下空格。
    var ae = document.activeElement;
    if (ae && ae.tagName === 'BUTTON') { try { ae.blur(); } catch (e2) {} }
    e.preventDefault();
    try {
      var w = frame.contentWindow;
      if (!w) return;
      // v0.91 — 根治「焦点不在 iframe 时空格进不了游戏」：
      // 启动类阶段(intro/cinema/won)直接 postMessage 命令让游戏走 handleSpace（不依赖键盘焦点/合成事件）；
      // 这类阶段只需 keydown 触发一次，keyup 忽略。
      // 游戏中阶段(select/charge/aim...)仍用成对合成键盘事件，保证蓄力/发射手感不变。
      var phase = '';
      try { phase = (w.JiulongGame && w.JiulongGame.getState && w.JiulongGame.getState().phase) || ''; } catch (e0) {}
      var bootPhase = (phase === 'intro' || phase === 'cinema' || phase === 'won' || phase === 'lost');
      if (bootPhase) {
        if (e.type === 'keydown' && !e.repeat) {
          try { w.postMessage({ source: 'jiulong-host', command: 'space' }, '*'); } catch (e1) {}
        }
      } else {
        var Init = w.KeyboardEvent;
        var ke = new Init(e.type, { code: 'Space', key: ' ', bubbles: true, cancelable: true, repeat: !!e.repeat });
        w.dispatchEvent(ke);
      }
    } catch (err) {}
    focusL4();
  }
  try {
    document.addEventListener('keydown', relaySpace, { capture: true });
    document.addEventListener('keyup', relaySpace, { capture: true });
  } catch (e) {}

  // —— [预览静音] 第四关iframe盖屏时，掐掉父页面(网页版)待机视频/前三关BGM/动态音效 ——
  // 只静音父页面 window 下的媒体，不影响第四关 iframe 内部的九龙关音效。
  var muteTimer = 0, muteObserver = null, muted = false;
  // v0.93 — 待机抑制:网页版自带一条 1.2s 的场景巡检,只要 scene==='menu' 且不在闯关中
  // 就会调 __gmShowVideo() —— 它会把待机视频【连声音一起】重新 play()。第四关是独立 iframe,
  // 宿主这边永远是 menu,于是游戏中待机画面/背景音会反复被拉回来。
  // 只靠「每 120ms 压一次静音」是压不住的(压下去 1.2s 后又起来)。
  // 这里从入口掐断:第四关在场期间 __gmShowVideo 直接变成「收待机」。
  var origShowVideo = null, idleGuardTimer = 0;
  // v0.95 — 「第四关里漏半秒待机声」根因:待机视频的起播不是我们调的(网页版 1.2s 场景巡检
  // __gmShowVideo、榜单收起 __gmResumeVideo、首次手势 soloPlay 解除静音),等 200ms 轮询把
  // 它压静音时,那半秒的声音已经放出去了。改成【入口即拦】:
  //   ① play 事件捕获(一次性装好):第四关在场期间,任何父页面媒体一想开播 → 立刻 pause+mute;
  //   ② __gmShowVideo / __gmResumeVideo 永久包一层:第四关在场 → 改道收待机;不在场 → 原样放行。
  // 待机视频本身的规则(index.html)一行未改,只是「第四关在场」这一个瞬间不让它起播。
  var l4OnScreen = false, audioGuardArmed = false, origResumeVideo = null;
  function armParentAudioGuard() {
    if (audioGuardArmed) return;
    audioGuardArmed = true;
    try {
      document.addEventListener('play', function (ev) {
        if (!l4OnScreen) return;
        var m = ev.target;
        if (!m || m === video) return;
        if (m.id === 'l4Video' || (m.closest && m.closest('#l4VideoLayer'))) return;
        try { m.pause(); m.muted = true; m.volume = 0; } catch (e) {}
      }, true);
    } catch (e) {}
    try {
      if (!origShowVideo) origShowVideo = window.__gmShowVideo || null;
      if (origShowVideo && !origShowVideo.__l4wrapped) {
        var w1 = function () {
          if (l4OnScreen) { try { if (window.__gmHideVideo) window.__gmHideVideo(); } catch (e) {} return; }
          return origShowVideo.apply(window, arguments);
        };
        w1.__l4wrapped = true;
        window.__gmShowVideo = w1;
      }
    } catch (e) {}
    try {
      if (!origResumeVideo) origResumeVideo = window.__gmResumeVideo || null;
      if (origResumeVideo && !origResumeVideo.__l4wrapped) {
        var w2 = function () { if (l4OnScreen) return; return origResumeVideo.apply(window, arguments); };
        w2.__l4wrapped = true;
        window.__gmResumeVideo = w2;
      }
    } catch (e) {}
    log('parent audio guard armed');
  }
  function suppressIdle() {
    l4OnScreen = true;
    armParentAudioGuard();
    try {
      if (typeof window.__gmHideVideo === 'function') window.__gmHideVideo();
    } catch (e) {}
    try {
      clearInterval(idleGuardTimer);
      idleGuardTimer = setInterval(function () {
        // 任何路径把待机翻出来(90s 无人值守保护/场景复位/榜单收起回调)→ 立刻再收一次
        try {
          if (typeof window.__gmVideoVisible === 'function' && window.__gmVideoVisible()) {
            if (typeof window.__gmHideVideo === 'function') window.__gmHideVideo();
          }
        } catch (e) {}
        // 24节气页被重建(它的 iframe 自己会定时重播音乐)→ 再销毁一次
        try {
          var jf = document.getElementById('jieqiFrame');
          if (jf && jf.src && jf.src.indexOf('jieqi') >= 0) killJieqiFrame();
        } catch (e) {}
        silenceParentMedia();
      }, 600);
    } catch (e) {}
  }
  function releaseIdle() {
    l4OnScreen = false;
    try { clearInterval(idleGuardTimer); idleGuardTimer = 0; } catch (e) {}
  }
  function silenceParentMedia() {
    if (!muted) return;
    try {
      var media = document.querySelectorAll('video,audio');
      for (var i = 0; i < media.length; i++) {
        var m = media[i];
        // 过场影片本身要出声，不能被"静音父页面"逻辑掐掉
        if (m.id === 'l4Video' || (m.closest && m.closest('#l4VideoLayer'))) continue;
        try { m.pause(); } catch (e) {}
        try { m.muted = true; } catch (e) {}
        try { m.volume = 0; } catch (e) {}
        // v0.92 — 看门狗会按 v.muted 判断再 unmute;打一个持久标记,即便被改也由 __gmHideVideo 的 visible=false 兜住
      }
    } catch (e) {}
  }
  // v0.92 — 24节气音乐在独立 iframe 里,其子页看门狗会把暂停的音乐重新播起;
  // 唯一彻底的办法:把 iframe src 换成 about:blank,销毁子页上下文。
  function killJieqiFrame() {
    try {
      var jf = document.getElementById('jieqiFrame');
      if (!jf) return;
      try { if (jf.contentWindow) jf.contentWindow.postMessage({ type: 'jieqi_stop' }, '*'); } catch (e) {}
      try { jf.src = 'about:blank'; } catch (e) {}
    } catch (e) {}
  }
  function startMute() {
    if (muted) return;
    muted = true;
    // v0.93 — 先把「待机重新起播」的唯一入口关掉,再静音。顺序很重要:入口没关时
    // 120ms 的静音循环会和 1.2s 的场景巡检抢跑,玩家就听见忽有忽无的待机声。
    suppressIdle();
    // v0.92 — 调网页版自己的「隐藏待机视频」入口:jieqiHide 停乐 + visible=false,
    // 让待机看门狗(每3s会把被静音视频解除静音)直接 return,根治「游戏里一直有待机视频声音」。只调一次。
    try { if (typeof window.__gmHideVideo === 'function') window.__gmHideVideo(); } catch (e) {}
    killJieqiFrame();
    silenceParentMedia();
    // 兜底：网页版会动态 new Audio() 与重新 play()，持续压制（含被看门狗反复 unmute 的待机视频）
    try { clearInterval(muteTimer); muteTimer = setInterval(silenceParentMedia, 200); } catch (e) {}
    try {
      muteObserver = new MutationObserver(function () { silenceParentMedia(); });
      muteObserver.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    log('parent media muted (v0.93: idle suppressed)');
  }
  function stopMute() {
    muted = false;
    try { clearInterval(muteTimer); muteTimer = 0; } catch (e) {}
    try { if (muteObserver) { muteObserver.disconnect(); muteObserver = null; } } catch (e) {}
    releaseIdle();
    log('parent media unmuted');
  }
  // v0.95 — 桥一加载就把守卫装上(不等进第四关):play 捕获与待机入口包装都只改「第四关在场」那一下,
  // 平时原样放行,所以不会影响待机视频的正常轮播。
  try { armParentAudioGuard(); } catch (e) {}

  // —— 过场影片：三关过关 → 全屏播影片 → 播完才进第四关 ——
  var transCallback = null, transTimer = 0, transDone = true;
  function beginTransition(cb) {
    transCallback = cb || null;
    transDone = false;
    if (!video || !vLayer) { finishTransition(); return; }
    vLayer.style.display = 'flex';
    try { video.currentTime = 0; } catch (e) {}
    try { video.muted = false; video.volume = 1; } catch (e) {}
    var p = null;
    try { p = video.play(); } catch (e) { p = null; }
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        // 浏览器拦截有声自动播放 → 静音重试，保证过场仍能推进
        try { video.muted = true; video.play(); } catch (e2) { finishTransition(); }
      });
    }
    clearTimeout(transTimer);
    transTimer = setTimeout(finishTransition, 30000);  // 兜底：影片 10s，30s 仍未结束强制推进
    log('transition video started dur=' + (isFinite(video.duration) ? video.duration : '?'));
  }
  function finishTransition() {
    if (transDone) return;
    transDone = true;
    clearTimeout(transTimer);
    try { video.pause(); } catch (e) {}
    if (vLayer) vLayer.style.display = 'none';
    var cb = transCallback; transCallback = null;
    if (typeof cb === 'function') cb();
  }
  function cancelTransition() { transCallback = null; finishTransition(); }
  try {
    video.addEventListener('ended', finishTransition);
    video.addEventListener('error', finishTransition);
    // v0.87 — "跳过影片"按钮点击是用户手势，借它提前请求全屏（load 自动请求常被浏览器拒）
    // v1.17 — l4VideoSkip 已在 v1.16 被 remove()；判空保护，避免 TypeError 中断本 try 块、
    //         连带 vLayer 的点击跳过也绑不上。空格跳过影片由 relaySpace 接管，不依赖该按钮。
    var _vskip = document.getElementById('l4VideoSkip');
    if (_vskip) _vskip.addEventListener('click', function () { fullscreenL4(); finishTransition(); });
    if (vLayer) vLayer.addEventListener('click', function (e) { if (e.target === vLayer) { fullscreenL4(); finishTransition(); } });
  } catch (e) { log('transition bind err', e); }

  function enter(summary) {
    pending = summary || {};
    finished = false;
    // [2026-11-24] 前三关没走完（中途失败）→ 不进第四关，直接按失败结算（「游戏结束 · 止步第N位」），
    //   与原现场「失败也结算 → 前150 → 18s 回首页」口径一致；只有三关全清才继续第四关。
    if (pending.failed) {
      log('three-stage failed → skip L4', 'reached=' + pending.reachedIndex);
      try { window.__kioskCompleteHoldMs = 18000; } catch (eF) {}
      if (typeof origOnComplete === 'function') origOnComplete(pending);
      return;
    }
    var carry = Math.max(0, Math.round(Number(pending.total) || 0));
    if (carryEl) carryEl.textContent = String(carry);
    log('enter L4 carry=' + carry, 'rows=' + ((pending.results || []).length));
    // 阻止 core 在结算 18s 后自动回首页，避免打断过场影片/第四关
    try { window.__kioskCompleteHoldMs = 3600000; } catch (e) {}
    startMute();   // 预览时静音父页面待机/前三关音效（过场影片除外）
    ov.style.display = 'flex';   // 先显示容器，影片层才能盖住待机画面；iframe 此时仍是 about:blank
    // 先播过场影片，播完才显示第四关 iframe 与其开头画面
    beginTransition(function () {
      if (frame) frame.src = 'jiulong.html?embed=1&l4fill=1&carry=' + carry + '&_t=' + Date.now();
      log('L4 iframe shown after transition');
    });
  }

  function finish(levelScore, title, cleared) {
    if (finished) return;
    finished = true;
    var s = pending || {};
    var carry = Math.max(0, Math.round(Number(s.total) || 0));
    var lv = Math.max(0, Math.round(Number(levelScore) || 0));
    var finalTotal = carry + lv;
    // cleared 未传时按「有分即通过」兜底；只有明确 false 才算失败
    var isCleared = (cleared === undefined) ? lv > 0 : !!cleared;
    var rows = (s.results || []).slice();
    rows.push({
      id: '_l4_jiulong', name: '第四关·九龙救白蛇', title: title || '',
      score: lv, cleared: isCleared
    });
    var merged = {};
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) merged[k] = s[k];
    // [2026-11-24] 第四关未通关 → 交回父页面走失败弹窗（游戏结束 · 止步第4位）；通关才是「恭喜完成破关」。
    merged.failed = !isCleared;
    if (!isCleared) { merged.reachedIndex = 3; merged.reachedName = '第四关·九龙救白蛇'; }
    merged.total = finalTotal;
    merged.results = rows;
    merged.subtitle = '超级舌阿蜥 · 四关合计';
    log('L4 finish level=' + lv + ' carry=' + carry + ' final=' + finalTotal + ' cleared=' + isCleared);
    cancelTransition();   // 若影片仍在播，直接收掉，不再露出第四关
    ov.style.display = 'none';
    if (frame) frame.src = 'about:blank';
    stopMute();   // 第四关结束，恢复父页面音效（回到总分榜/待机）
    try { window.__kioskCompleteHoldMs = 18000; } catch (e2) {}
    if (typeof origOnComplete === 'function') origOnComplete(merged);
  }

  function replay() {
    cancelTransition();   // 重玩不再重播过场影片，直接回第四关
    finished = false;
    startMute();          // v0.93 — 上一轮 finish() 已经解除了静音,重玩必须重新掐住待机
    try { fsArmed = false; } catch (e) {}   // 重玩后允许在首次手势再请求一次全屏
    var carry = pending ? Math.max(0, Math.round(Number(pending.total) || 0)) : 0;
    if (frame) frame.src = 'jiulong.html?embed=1&l4fill=1&carry=' + carry + '&_t=' + Date.now();
    ov.style.display = 'flex';
  }

  // v1.17 — 这两个按钮已在 v1.16 被 remove()。此前直接 addEventListener 抛
  //   TypeError: Cannot read properties of null → 整个 IIFE 在此中断，导致后面的
  //   message 监听 / window.__L4 / jump·qr 自动开局全部没绑定（表现：进不去、按空格没反应）。
  //   判空保护后脚本可完整执行到底。流程全部走空格，按钮监听仅作兼容兜底。
  var _l4SkipBtn = document.getElementById('l4Skip');
  var _l4ReplayBtn = document.getElementById('l4Replay');
  if (_l4SkipBtn) _l4SkipBtn.addEventListener('click', function () { finish(0, '跳过'); });
  if (_l4ReplayBtn) _l4ReplayBtn.addEventListener('click', replay);

  // 接收九龙关 postMessage：{source:'jiulong-baishe', type:'jiulong:win', shots, remain, levelScore, carry, score}
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'jiulong-baishe') return;
    if (d.type === 'jiulong:win') {
      // score 已是 carry+本关 的最终合计，这里只取本关分，避免重复加 carry
      finish(d.levelScore != null ? d.levelScore : d.score, '剩余' + (d.remain || 0) + '人', true);
    } else if (d.type === 'jiulong:lose' || d.type === 'jiulong:fail') {
      // [2026-11-24] 第四关未救出白娘子 → 按失败结算，弹「游戏结束 · 止步第四关」，
      //   不再错报成「恭喜完成破关」（三关分仍计入合计，行内标注未通关）。
      finish(0, '未通关', false);
    }
  });

  // 包装结算回调：真实三关通关也会先走第四关
  window.__kioskOnRunComplete = function (summary) { enter(summary); };

  // 预览按钮：免扫码直接演示（用引擎快速过关，随机三关分走真实链路）
  var btn = document.createElement('button');
  btn.id = 'l4PreviewBtn';
  btn.type = 'button';
  btn.textContent = '预览第四关 ▶';
  btn.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:999998;padding:9px 15px;border:none;' +
    'border-radius:8px;background:#e8a33d;color:#1a1200;font:700 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.55);';
  btn.addEventListener('click', function () {
    try {
      if (typeof window.__kioskQuickClearTest === 'function') { window.__kioskQuickClearTest(); return; }
    } catch (e) { log('quickClear err', e); }
    enter({ failed: false, total: 4000, results: [
      { name: '阿蜥·地图甲', score: 1200, cleared: true },
      { name: '白娘子·地图乙', score: 1500, cleared: true },
      { name: '小青·地图丙', score: 1300, cleared: true }
    ] });
  });
  document.body.appendChild(btn);
  // v1.13 — 「预览第四关 ▶」入口按钮同样取消：jump=l3 直接进第四关，空格推进；入口不需要鼠标点击。
  // v1.16 — 直接从 DOM 删除(不再只是 display:none)，彻底杜绝任何鼠标按钮残留。
  try { btn.remove(); } catch (eb) { try{ btn.style.setProperty('display','none','important'); btn.tabIndex=-1; }catch(e2){} }

  // 供 CDP 自动预览驱动
  window.__L4 = {
    enter: enter,
    finish: finish,
    replay: replay,
    skipVideo: finishTransition,
    videoState: function () {
      return {
        playing: !!vLayer && vLayer.style.display === 'flex',
        paused: video ? video.paused : null,
        muted: video ? video.muted : null,
        t: video ? Math.round(video.currentTime * 100) / 100 : 0,
        dur: video && isFinite(video.duration) ? Math.round(video.duration * 100) / 100 : 0
      };
    },
    state: function () {
      var vplaying = !!vLayer && vLayer.style.display === 'flex';
      return {
        carry: pending ? pending.total : 0, finished: finished,
        visible: ov.style.display === 'flex',
        videoPlaying: vplaying,
        l4Shown: ov.style.display === 'flex' && !vplaying
      };
    }
  };
  log('ready (orig callback wrapped)');

  // —— v1.14 [扫码直达 ?qr=1] 用户要求「进去后弹真实二维码来启动游戏」——
  // 复用网页原生门禁(__kioskShowQr/createSession，连真实微信云，测试码 a1check 不碰现场 hz01)：
  //   打开即出真实可扫二维码 → 手机微信扫码+点「启动现场游戏」→ 云端 confirmed
  //   → 大屏轮询到 verified → 按空格收码授权 → 直接快进三关 → 过场影片 → 第四关。
  // 全程空格推进、零鼠标按钮（桥接层按钮已在上方隐藏）。
  try {
    var isQr = /[?&]qr=1(?:&|$)/.test(location.search || '');
    if (isQr) {
      log('QR direct mode armed');
      // 原生门禁在大屏加载完成会自动出码(__kioskShowQr)。这里确保它一定出，并持续补码防被待机循环收走。
      var qrBootTimer = setInterval(function () {
        try {
          if (window.__kioskSessionAuthorized === true) { clearInterval(qrBootTimer); return; }
          if (window.__kioskQrVisible && !window.__kioskQrVisible() && window.__kioskShowQr) window.__kioskShowQr();
        } catch (eq) {}
      }, 800);
      setTimeout(function () { clearInterval(qrBootTimer); }, 180000);   // 3 分钟兜底
      // 用户要「扫码后进第四关」：扫码确认+空格收码授权后，原生 __kioskAfterQrClosed 会开真实三关。
      // 这里在【授权刚完成】时抢先一步：拦截 afterQrClosed，改为快进三关 → __kioskOnRunComplete → 过场 → 第四关。
      // 用标志位只触发一次，避免与原生开局重复。
      var qrJumpDone = false;
      var qrAuthTimer = setInterval(function () {
        try {
          if (window.__kioskSessionAuthorized !== true || qrJumpDone) return;
          // 等快进函数就绪（core 加载完才有）
          if (typeof window.__kioskQuickClearTest !== 'function') return;
          qrJumpDone = true;
          clearInterval(qrAuthTimer);
          clearInterval(qrBootTimer);
          // 关键：把原生「收码后开真实三关」的回调变成空操作，避免与快进撞车。
          // 此刻 core 已就绪（授权意味着游戏已跑起来），覆盖安全。
          try { window.__kioskAfterQrClosed = function () { return true; }; } catch (eO) {}
          try { window.__kioskCompleteHoldMs = 3600000; } catch (eH) {}
          setTimeout(function () {
            try { window.__kioskQuickClearTest(); }
            catch (eqc) { log('qr quickClear err', eqc); }
          }, 80);
          log('QR authorized → jump to L4');
        } catch (eq2) {}
      }, 200);
      setTimeout(function () { clearInterval(qrAuthTimer); }, 180000);
    }
  } catch (eqr) { log('qr mode err', eqr); }

  // —— [完整体验 ?full=1] 免扫码：授权 + 收起二维码 + 走真实 __kioskRunStart 从第一关开打 ——
  // —— [一键跳关 ?jump=l3] 免扫码：快进三关到第三关结束 → 真实结算链路 → 过场影片 → 第四关 ——
  // 两种模式都免授权/收码；full=1 从第一关真打，jump=l3 直接跳过前三关的游玩。
  // 三关结算后都由包装的 __kioskOnRunComplete 自然衔接：过场影片 → 第四关。
  try {
    var isFull = /[?&]full=1(?:&|$)/.test(location.search || '');
    var isJump = /[?&]jump=l3(?:&|$)/.test(location.search || '');
    if (isFull || isJump) {
      if (btn) btn.style.display = 'none';      // 快捷模式隐藏「预览第四关」按钮（已自动衔接）
      window.__kioskSessionAuthorized = true;   // 直接授权（仅本地预览副本）
      try { window.__guideSeenRun = true; } catch (e) {}   // 跳过说明图
      // 压制二维码浮层（初始化脚本会出码）：持续隐藏直到本轮开局成立
      var hideGate = function () {
        try {
          var gw = document.getElementById('gateWrap'), g = document.getElementById('gate');
          if (gw) gw.classList.add('hidden');
          if (g) g.classList.add('hidden');
        } catch (e) {}
      };
      hideGate();
      var bootTries = 0;
      var bootTimer = setInterval(function () {
        hideGate();

        if (isJump) {
          // 一键跳关：直接调用引擎「快速过关」——随机三关分数走与真实通关完全相同的结算链路。
          // 引擎脚本就绪后 __kioskQuickClearTest 才会出现，故轮询等待。
          if (typeof window.__kioskQuickClearTest !== 'function') {
            if (++bootTries > 200) clearInterval(bootTimer);   // 约 60s 兜底
            return;
          }
          // 已触发过（enter 已把 carry 记下）就不再重复调用
          if (window.__L4 && window.__L4.state && window.__L4.state().carry > 0) {
            clearInterval(bootTimer);
            log('jump L3-end already triggered');
            return;
          }
          // 拉长结算停留，避免 18s 后自动回首页打断过场/第四关
          try { window.__kioskCompleteHoldMs = 3600000; } catch (e) {}
          try { window.__kioskQuickClearTest(); } catch (e) { log('jump quickClear err', e); }
          log('jump → L3 end triggered via __kioskQuickClearTest');
          if (++bootTries > 4) clearInterval(bootTimer);   // 最多补 4 次，防 order 未就绪的空跑
          return;
        }

        // —— 原 full=1：从第一关真实开局 ——
        var rs = null;
        try { rs = window.__kioskRunState ? window.__kioskRunState() : null; } catch (e) {}
        if (rs && rs.active) { clearInterval(bootTimer); log('full run started (real 3 stages)'); return; }
        if (typeof window.__kioskRunStart !== 'function') return;   // 引擎未就绪
        var r = null;
        try { r = window.__kioskRunStart(); } catch (e) { r = { ok: false, reason: String(e) }; }
        if (r && r.ok) { clearInterval(bootTimer); log('full run started via __kioskRunStart'); }
        else if (r && /^bad_scene/.test(r.reason || '')) { /* 等引擎回 menu 再试 */ }
        bootTries++;
        if (bootTries > 120) clearInterval(bootTimer);   // 约 36s 兜底
      }, 300);
    }
  } catch (e) { log('boot err', e); }
})();
