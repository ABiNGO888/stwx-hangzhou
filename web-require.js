/* ============================================================
 * 超级舌阿蜥 · 线下网页版 —— 迷你 CommonJS 加载器
 * game.js 的模块系统会使用全局 require() 解析 './runtime/core_runtime.js'；
 * 这里按路径注册 runtime 目录下 5 个真模块（其余都打包在 game.js 内）。
 * ============================================================ */
(function () {
  'use strict';
  var REGISTRY = {};   // 规范路径 -> { exports, factory }
  var LOADING = {};

  function normalize(p) {
    var s = String(p).replace(/^\.\//, '').replace(/^\//, '');
    if (!/\.js$/.test(s)) s += '.js';
    return s;
  }

  // 2026-10-11 离线缓存修复：页面加载时用「异步 fetch」预取全部模块源码 ——
  // 异步 fetch 才会被 Service Worker 拦截并命中本地缓存；同步 XHR 不会被 SW 拦截，
  // 断网时必然失败（这就是断网重载后 core 模块拉不到、卡在载入页的根因）。
  // 预取完成后模块求值零网络；预取未完成时兜底走原同步 XHR（在线场景）。
  // [2026-11-12 v33 冷启动修复] runtime-sources.js 已把全部 runtime 模块源码内联进
  // window.__SX_SRC，由静态 <script> 在 game.js 之前串行加载完成。boot 时 SRC_CACHE
  // 必然齐全，不再发 6 个并发 fetch，也永不落到同步 XHR —— 后者在平台网关重置 HTTP/2
  // 流时会长时间挂起并冻结主线程，现场表现为「打不开游戏」。
  var SRC_CACHE = window.__SX_SRC || {};

  // 平台分享链接要求 sharecode：任何同源子请求透传当前页的分享码，
  // 避免冷启动 cookie 尚未写入时被网关拒绝。
  var SHARE_CODE = (function () {
    var m = /[?&]sharecode=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  })();
  function withCode(u) {
    if (!SHARE_CODE) return u;
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'sharecode=' + encodeURIComponent(SHARE_CODE);
  }

  // 兜底：仅当某个模块源码确实缺失（例如 bundle 加载失败）才串行补拉，
  // 一次一个请求，避免并发流被网关重置。
  var PRELOAD_LIST = [
    'runtime/core_runtime.js',
    'runtime/render_runtime.js',
    'runtime/real_snake_runtime.js',
    'runtime/portal_effect.js',
    'runtime/portal_effect_config.js',
    'runtime/portal_shader_source.js',
    'runtime/game.js'
  ];
  if (typeof fetch === 'function') {
    (function chain(i) {
      if (i >= PRELOAD_LIST.length) {
        // [v39d] 链路跑完置标志：bootGame 的重试据此判断「可以走同步 XHR 兜底了」
        try { window.__wxPrefetchDone = true; } catch (e) {}
        return;
      }
      var pp = PRELOAD_LIST[i];
      if (SRC_CACHE[pp] != null) { chain(i + 1); return; }
      fetch(withCode(pp + '?v=pre'), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (t) { if (t) SRC_CACHE[pp] = t; chain(i + 1); })
        .catch(function () { chain(i + 1); });
    })(0);
  } else {
    try { window.__wxPrefetchDone = true; } catch (e) {}
  }

  // [v39f 2026-11-12 持续补拉 —— 根治「暖身中 100% 永久卡死」的最后漏洞]
  //   v39d 的兜底补拉是一次性的：如果那一瞬间网络被网关掐掉，失败后永远没有第二次，
  //   bootGame 每 180ms 重试却没人再去拉模块 → 永远 pending。
  //   现在：boot 每次重试 require 都会调用 ensureSrc —— 该模块没有在途请求时
  //   立刻补发一次异步 fetch（带 8s 超时防挂起），失败自动等待下一次重试再发。
  //   网络恢复的那一刻必然有请求成功 → boot 立即继续。全程零同步 XHR。
  var INFLIGHT = {};
  function ensureSrc(path) {
    if (SRC_CACHE[path] != null) return;
    if (INFLIGHT[path]) return;
    INFLIGHT[path] = true;
    var url = withCode(path + '?v=pre&r=' + Math.floor(Date.now() / 4000));
    var done = function (t) { INFLIGHT[path] = false; if (t) SRC_CACHE[path] = t; };
    try {
      var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 8000) : null;
      fetch(url, { credentials: 'same-origin', signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { if (r && r.ok) return r.text(); return ''; })
        .then(function (t) { if (timer) clearTimeout(timer); done(t); })
        .catch(function () { if (timer) clearTimeout(timer); done(''); });
    } catch (e) { INFLIGHT[path] = false; }
  }

  function loadFactory(path) {
    // [v39f] 只认异步补拉：源码没到位 → 踢一次异步 fetch 并立刻抛错，
    //   bootGame 180ms 后重试；只要网络有一次成功，boot 立即继续。
    //   同步 XHR 已彻底移除 —— 它在网关 RST/慢网下会挂起并冻结主线程。
    var src = SRC_CACHE[path];
    if (src == null) {
      ensureSrc(path);
      throw new Error('module pending: ' + path);
    }
    // eslint-disable-next-line no-new-func
    return new Function('module', 'exports', 'require', '__filename', '__dirname',
      src + '\n//# sourceURL=' + path);
  }

  function req(p, fromDir) {
    var key = normalize(p);
    // 相对 require 按调用方目录解析：'./render_runtime' 在 runtime/ 内 → runtime/render_runtime.js
    if (!key.includes('/') && fromDir) key = normalize(fromDir + key);
    var entry = REGISTRY[key];
    if (entry && entry.loaded) return entry.module.exports;
    if (LOADING[key]) throw new Error('circular require: ' + key);
    if (!entry) {
      entry = { module: { exports: {} }, loaded: false };
      REGISTRY[key] = entry;
      LOADING[key] = true;
      try {
        var factory = loadFactory(key);
        var dir = key.indexOf('/') >= 0 ? key.slice(0, key.lastIndexOf('/') + 1) : './';
        // 目录感知的 require：给模块一个绑定了自己 __dirname 的 require
        var localRequire = function (pp) { return req(pp, dir); };
        localRequire.resolve = function (pp) { return pp; };
        factory(entry.module, entry.module.exports, localRequire, './' + key, dir);
      } catch (evalErr) {
        // 2026-10-11：求值失败必须清掉 REGISTRY 条目 —— 否则下一次 require 会命中
        // 「entry 存在但 loaded=false」直接返回空 exports，boot 的重试永远拿到残缺模块。
        delete REGISTRY[key];
        throw evalErr;
      } finally { delete LOADING[key]; }
      entry.loaded = true;
    }
    return entry.module.exports;
  }

  window.__wxRequire = req;
  window.__defineModule = function (path, factory) {
    var key = normalize(path);
    REGISTRY[key] = { module: { exports: {} }, loaded: false, factory: factory };
  };
})();
