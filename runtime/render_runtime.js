'use strict';
var portalEffect = require('./portal_effect');
var realSnake = require('./real_snake_runtime');
var portalEffectConfig = portalEffect && portalEffect.config ? portalEffect.config : {};
var foodIconCache = new Map();
var avatarImageCache = new Map();
var stageGradientCache = Object.create(null);
var staticArtCache = Object.create(null);

var UI_FONT = '"Source Han Sans SC", "Noto Sans CJK SC", "\u601d\u6e90\u9ed1\u4f53", "PingFang SC", "Microsoft YaHei", sans-serif';
var UI_NUM = '"Source Han Sans SC", "Noto Sans CJK SC", "Courier New", "Menlo", monospace';

var UI_BUTTON_FRAMES = {
  // 当前 UI 图为 570×570，以下切片由原 384×384 坐标等比例换算。
  restart:  { x: 64,  y: 59,  w: 220, h: 135 },
  pause:    { x: 286, y: 59,  w: 220, h: 135 },
  play:     { x: 177, y: 218, w: 220, h: 125 },
  previous: { x: 64,  y: 361, w: 220, h: 131 },
  next:     { x: 286, y: 361, w: 220, h: 131 }
};

function createRuntimeImage() {
  if (typeof wx !== 'undefined' && wx.createImage) return wx.createImage();
  if (typeof Image !== 'undefined') return new Image();
  return null;
}

function getAvatarAsset(url) {
  url = String(url || '');
  if (!url) return null;
  if (avatarImageCache.has(url)) return avatarImageCache.get(url);
  var image = createRuntimeImage();
  if (!image) return null;
  var asset = { image: image, ready: false, failed: false };
  image.onload = function() { asset.ready = true; };
  image.onerror = function() { asset.failed = true; };
  image.src = url;
  avatarImageCache.set(url, asset);
  return asset;
}

function createOffscreenCanvas() {
  if (typeof wx !== 'undefined' && wx.createCanvas) return wx.createCanvas();
  if (typeof document !== 'undefined' && document.createElement) {
    var c = document.createElement('canvas');
    return c;
  }
  return { width: 40, height: 40, getContext: function() { return {}; } };
}


// 穿越动效已迁移到根目录 portal_effect.js；Shader 源码与参数分别独立维护。

function getFoodIcon(kind, foodArtAssets) {
  if (foodIconCache.has(kind)) return foodIconCache.get(kind);
  // 食物道具整体放大：程序化美术按 40 网格绘制，放大 1.6 倍后画到 64×64 画布，避免拉大后糊掉。
  var FOOD_SCALE = 1.6;
  // [foods-v2] 杭州全部种类统一全画布渲染（128×128 高清源图，大小一致不糊）
  var ART_FULL_SCALE_KINDS = { dingsheng_gao: 1, longjing_xiaren: 1, sushi_lvdoutang: 1, xihu_cuyu: 1, pianercuan: 1, congbaohui: 1, guihuatangou: 1, bubble_tea: 1, red_braised_pork: 1, xionghuangjiu: 1 };
  var c = createOffscreenCanvas();
  c.width = Math.round(40 * FOOD_SCALE); c.height = Math.round(40 * FOOD_SCALE);
  var g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  var art = foodArtAssets ? foodArtAssets[kind] : null;
  if (art && art.ready) {
    if (ART_FULL_SCALE_KINDS[kind]) {
      g.drawImage(art.image, 0, 0, c.width, c.height);
    } else {
      g.drawImage(art.image, 4 * FOOD_SCALE, 4 * FOOD_SCALE, 32 * FOOD_SCALE, 32 * FOOD_SCALE);
    }
    foodIconCache.set(kind, c);
    return c;
  }

  function rect(x, y, w, h, fill, stroke) {
    stroke = stroke || '#1f2433';
    g.fillStyle = stroke; g.fillRect(x, y, w, h);
    g.fillStyle = fill; g.fillRect(x + 2, y + 2, w - 4, h - 4);
  }
  function circle(cx, cy, r, fill, stroke) {
    stroke = stroke || '#1f2433';
    g.fillStyle = stroke; g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  }

  g.save();
  g.scale(FOOD_SCALE, FOOD_SCALE);
  switch (kind) {
    case 'bubble_tea':
      rect(12, 10, 16, 18, '#f1d7b5');
      g.fillStyle = '#73d6ff'; g.fillRect(18, 4, 4, 8);
      g.fillStyle = '#392f2f'; g.fillRect(15, 21, 3, 3); g.fillRect(21, 23, 3, 3);
      break;
    case 'oyster_omelet':
      rect(8, 17, 24, 10, '#fff4b4', '#98783f');
      g.fillStyle = '#7fb666'; g.fillRect(14, 12, 12, 5);
      g.fillStyle = '#ff9191'; g.fillRect(18, 18, 5, 4);
      break;
    case 'lurou_fan':
      rect(8, 17, 24, 10, '#e8e8e8', '#6b645d');
      g.fillStyle = '#8a5a35'; g.fillRect(10, 12, 20, 6);
      g.fillStyle = '#69ab4d'; g.fillRect(24, 10, 5, 3);
      break;
    case 'gua_bao':
      rect(8, 17, 24, 9, '#f5e6c9', '#6f4a28');
      g.fillStyle = '#f6f4e5'; g.fillRect(11, 18, 18, 4);
      g.fillStyle = '#76b45f'; g.fillRect(14, 13, 12, 4);
      break;
    case 'pineapple_cake':
      rect(11, 12, 18, 14, '#f0ca67', '#886228');
      g.fillStyle = '#88b757'; g.fillRect(16, 8, 8, 4);
      break;
    case 'scallion_pancake':
      circle(20, 20, 10, '#dfba78', '#7d5d2b');
      g.fillStyle = '#7ab45d'; g.fillRect(16, 13, 3, 3); g.fillRect(22, 17, 3, 3);
      break;
    case 'taipei_pig_blood_cake':
      g.fillStyle = '#1f2433'; g.fillRect(10, 11, 19, 17);
      g.fillStyle = '#52252a'; g.fillRect(12, 13, 15, 13);
      g.fillStyle = '#d8a04f'; g.fillRect(14, 14, 3, 3); g.fillRect(20, 16, 3, 3); g.fillRect(16, 21, 3, 3);
      g.fillStyle = '#61ad52'; g.fillRect(16, 8, 4, 5); g.fillRect(20, 9, 4, 4);
      g.fillStyle = '#b87b39'; g.fillRect(5, 27, 10, 3);
      break;
    case 'golden_sweet_potato':
      g.save();
      g.translate(20, 20); g.rotate(-0.42);
      g.fillStyle = '#8a5a1f';
      g.beginPath(); g.ellipse(0, 1, 13, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd85f';
      g.beginPath(); g.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff1a0';
      g.beginPath(); g.ellipse(-3, -2, 4, 2.2, -0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#70b84f';
      g.beginPath(); g.moveTo(8, -4); g.lineTo(15, -9); g.lineTo(13, -1); g.closePath(); g.fill();
      g.restore();
      break;
    default:
      circle(20, 20, 9, '#ffffff');
  }
  g.restore();
  if (!art || !art.src || art.failed) foodIconCache.set(kind, c);
  return c;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function createRenderer(ctx, canvas) {
  'use strict';
  var cfg = null;
  var VIEW_W = 540, VIEW_H = 960;
  var dpr = 1, fitScale = 1, offX = 0, offY = 0;
  var cameraY = 0;
  var hotspots = {};
  var artScale = 1;
  var performanceTier = 'high';
  var frameNowSec = 0;
  var canvasFrameInitialized = false;
  var lastFrameScene = '';
  var lastCanvasWidth = 0;
  var lastCanvasHeight = 0;
  function refreshArtScale() {
    var next = Math.max(0.75, Number(dpr * fitScale) || 1);
    if (Math.abs(next - artScale) > 0.01) { artScale = next; staticArtCache = Object.create(null); }
  }
  function createScaledArtCanvas(logicalW, logicalH) {
    var c = createOffscreenCanvas();
    c.width = Math.max(1, Math.ceil(logicalW * artScale));
    c.height = Math.max(1, Math.ceil(logicalH * artScale));
    var g = c.getContext('2d');
    if (g.setTransform) g.setTransform(artScale, 0, 0, artScale, 0, 0);
    g.imageSmoothingEnabled = true;
    return { canvas: c, ctx: g, w: logicalW, h: logicalH };
  }
  function cachedBumperArt(bumper) {
    var r = Math.max(1, Math.round(Number(bumper.r) || 1));
    var hazard = !!bumper.hazard;
    var pad = hazard ? 13 : 4;
    var key = 'bumper:' + artScale.toFixed(2) + ':' + r + ':' + (hazard ? 1 : 0);
    if (staticArtCache[key]) return staticArtCache[key];
    var size = (r + pad) * 2;
    var art = createScaledArtCanvas(size, size);
    var g = art.ctx, cx = r + pad, cy = r + pad;
    g.save(); g.translate(cx, cy);
    if (hazard) {
      g.fillStyle = '#7b4a61'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#27141e'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#ff7f96';
      for (var j = 0; j < 10; j++) {
        var a = j / 10 * Math.PI * 2;
        g.beginPath();
        g.moveTo(Math.cos(a - 0.12) * (r - 2), Math.sin(a - 0.12) * (r - 2));
        g.lineTo(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10));
        g.lineTo(Math.cos(a + 0.12) * (r - 2), Math.sin(a + 0.12) * (r - 2));
        g.closePath(); g.fill();
      }
      g.fillStyle = '#ffdbe5'; g.beginPath(); g.arc(0, 0, r * 0.36, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = '#fff0a0'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff7f91'; g.beginPath(); g.arc(0, 0, r * 0.46, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5c401b'; g.lineWidth = 3; g.stroke();
    }
    g.restore();
    art.pad = pad;
    staticArtCache[key] = art;
    return art;
  }
  function cachedAnchorCore(theme) {
    var forest = theme === 'forest';
    var key = 'anchor:' + artScale.toFixed(2) + ':' + (forest ? 'forest' : 'metal');
    if (staticArtCache[key]) return staticArtCache[key];
    var size = forest ? 70 : 42, center = forest ? 28 : 21;
    var art = createScaledArtCanvas(size, size), g = art.ctx;
    if (forest) {
      g.save(); g.translate(center, center);
      g.fillStyle = '#8f562e'; g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#452a17'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = '#6f3f20'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(12, -8); g.lineTo(24, -18); g.stroke();
      g.fillStyle = '#67a84d'; g.beginPath(); g.ellipse(28, -18, 7, 4, 0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(22, -23, 7, 4, -0.5, 0, Math.PI * 2); g.fill(); g.restore();
    } else {
      g.fillStyle = '#d2d7df'; g.beginPath(); g.arc(center, center, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#66717c'; g.beginPath(); g.arc(center, center, 6, 0, Math.PI * 2); g.fill();
    }
    art.cx = center; art.cy = center;
    staticArtCache[key] = art;
    return art;
  }
  function cachedGoldenGlow() {
    var key = 'goldenGlow:' + artScale.toFixed(2);
    if (staticArtCache[key]) return staticArtCache[key];
    var art = createScaledArtCanvas(68, 68), g = art.ctx;
    var glow = g.createRadialGradient(34, 34, 4, 34, 34, 34);
    glow.addColorStop(0, 'rgba(255,243,133,.92)');
    glow.addColorStop(1, 'rgba(255,216,95,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(34, 34, 34, 0, Math.PI * 2); g.fill();
    staticArtCache[key] = art;
    return art;
  }

  function cachedTopBarArt(height) {
    height = Math.max(1, Math.round(Number(height) || 98));
    var key = 'topbar:' + artScale.toFixed(2) + ':' + height;
    if (staticArtCache[key]) return staticArtCache[key];
    var art = createScaledArtCanvas(VIEW_W, height), g = art.ctx;
    var barGrad = g.createLinearGradient(0, 0, VIEW_W, height);
    barGrad.addColorStop(0, 'rgba(18,31,34,.98)');
    barGrad.addColorStop(0.58, 'rgba(13,24,27,.98)');
    barGrad.addColorStop(1, 'rgba(8,15,18,.99)');
    g.fillStyle = barGrad;
    g.fillRect(0, 0, VIEW_W, height);
    var bottomFade = g.createLinearGradient(0, height - 7, 0, height);
    bottomFade.addColorStop(0, 'rgba(0,0,0,0)');
    bottomFade.addColorStop(1, 'rgba(0,0,0,.42)');
    g.fillStyle = bottomFade;
    g.fillRect(0, height - 7, VIEW_W, 7);
    g.fillStyle = 'rgba(255,255,255,.045)';
    g.fillRect(0, 0, VIEW_W, 1);
    staticArtCache[key] = art;
    return art;
  }

  function cachedScoreLabelArt(width, height) {
    width = Math.max(1, Math.round(Number(width) || 98));
    height = Math.max(1, Math.round(Number(height) || 25));
    var key = 'scoreLabel:' + artScale.toFixed(2) + ':' + width + ':' + height;
    if (staticArtCache[key]) return staticArtCache[key];
    var pad = 5;
    var art = createScaledArtCanvas(width + pad * 2, height + pad * 2), g = art.ctx;
    g.save();
    g.translate(pad, pad);
    if (!lowEffects()) {
      g.shadowColor = 'rgba(0,0,0,.34)';
      g.shadowBlur = 4;
      g.shadowOffsetY = 1;
    }
    roundRect(g, 0, 0, width, height, 6);
    var labelGrad = g.createLinearGradient(0, 0, 0, height);
    labelGrad.addColorStop(0, '#ff5f96');
    labelGrad.addColorStop(1, '#df2d6d');
    g.fillStyle = labelGrad;
    g.fill();
    g.restore();
    art.pad = pad;
    staticArtCache[key] = art;
    return art;
  }

  function cachedWallArt(wall) {
    var w = Math.max(1, Math.round(Number(wall.w) || 1));
    var h = Math.max(1, Math.round(Number(wall.h) || 1));
    var theme = String((cfg.runtimeLevel && cfg.runtimeLevel.theme) || 'forest');
    var spring = !!wall.spring;
    var material = String(wall.material || '');
    var power = !!wall.powerSpring;
    var oneShot = !!wall.oneShot;
    var axis = String(wall.axis || 'horizontal');
    var pad = power && !lowEffects() ? 12 : 3;
    var key = 'wall:' + artScale.toFixed(2) + ':' + performanceTier + ':' + theme + ':' + w + ':' + h + ':' +
      (spring ? 1 : 0) + ':' + material + ':' + (power ? 1 : 0) + ':' + (oneShot ? 1 : 0) + ':' + axis;
    if (staticArtCache[key]) return staticArtCache[key];
    var art = createScaledArtCanvas(w + pad * 2, h + pad * 2), g = art.ctx;
    g.save();
    g.translate(pad, pad);

    if (spring) {
      if (power && !lowEffects()) {
        g.shadowColor = '#ff70df';
        g.shadowBlur = balancedEffects() ? 8 : 14;
      }
      if (power) g.fillStyle = '#ff8be4';
      else if (oneShot) g.fillStyle = '#bba4ff';
      else g.fillStyle = axis === 'vertical' ? '#8be0ff' : '#ffe28a';
      roundRect(g, 0, 0, w, h, 8); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#20354a'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#ffffff';
      if (axis === 'vertical') {
        for (var i2 = 14; i2 <= h - 14; i2 += 26) {
          g.beginPath();
          g.moveTo(w * 0.5 - 6, i2 + 6);
          g.lineTo(w * 0.5 + 6, i2 + 13);
          g.lineTo(w * 0.5 - 6, i2 + 20);
          g.closePath(); g.fill();
        }
      } else {
        for (var i3 = 14; i3 <= w - 14; i3 += 26) {
          g.beginPath();
          g.moveTo(i3 + 13, h * 0.5 - 4);
          g.lineTo(i3 + 7, h * 0.5 + 4);
          g.lineTo(i3 + 19, h * 0.5 + 4);
          g.closePath(); g.fill();
        }
      }
      if (power) {
        g.fillStyle = '#4b1746'; g.font = 'bold 14px ' + UI_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('×2', w * 0.5, h * 0.5 + 1);
      } else if (oneShot) {
        g.fillStyle = '#31245c'; g.font = 'bold 11px ' + UI_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('1 HIT', w * 0.5, h * 0.5 + 1);
      }
    } else if (material === 'stump') {
      g.fillStyle = '#3c2b1e'; roundRect(g, 0, 0, w, h, 8); g.fill();
      g.fillStyle = '#80cb4a'; roundRect(g, 0, 0, w, Math.min(10, h), 8); g.fill();
      g.fillStyle = '#9de85c'; roundRect(g, 6, 2, Math.max(4, w - 12), Math.min(4, h), 4); g.fill();
    } else if (material === 'wall') {
      g.fillStyle = '#f1f3f4'; roundRect(g, 0, 0, w, h, 8); g.fill();
      g.strokeStyle = '#4a5577'; g.lineWidth = 3; g.strokeRect(2, 2, Math.max(0, w - 4), Math.max(0, h - 4));
    } else if (theme === 'forest' || theme === 'rural') {
      g.fillStyle = '#3c2b1e'; roundRect(g, 0, 0, w, h, 8); g.fill();
      g.fillStyle = theme === 'rural' ? '#d4b46f' : '#80cb4a'; roundRect(g, 0, 0, w, Math.min(10, h), 8); g.fill();
      g.fillStyle = theme === 'rural' ? '#f1d98f' : '#9de85c'; roundRect(g, 6, 2, Math.max(4, w - 12), Math.min(4, h), 4); g.fill();
    } else if (theme === 'cave') {
      g.fillStyle = '#57476d'; roundRect(g, 0, 0, w, h, 8); g.fill();
      g.strokeStyle = '#8a7aaa'; g.lineWidth = 2; g.strokeRect(2, 2, Math.max(0, w - 4), Math.max(0, h - 4));
    } else {
      g.fillStyle = '#f1f3f4'; roundRect(g, 0, 0, w, h, 8); g.fill();
      g.strokeStyle = '#4a5577'; g.lineWidth = 2; g.strokeRect(2, 2, Math.max(0, w - 4), Math.max(0, h - 4));
    }
    g.restore();
    art.pad = pad;
    staticArtCache[key] = art;
    return art;
  }

  function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) { t = clamp(t, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function normalizeAngle(rad) { var f = Math.PI * 2; return ((rad % f) + f) % f; }
  function nowSec() { return frameNowSec; }
  function lowEffects() { return performanceTier === 'low'; }
  function balancedEffects() { return performanceTier === 'balanced'; }
  function worldToScreenX(wx, fx) { if (fx === undefined) fx = cfg.cameraX; return wx - fx; }
  function editorViewport() { return (cfg.editorState && cfg.editorState.viewport) || { x: 136, y: 76, w: VIEW_W - 136, h: VIEW_H - 134 }; }
  function editorZoom() { return Math.max(0.025, (cfg.editorState && cfg.editorState.zoom) || 1); }
  function visibleWorldWidth() { return cfg.scene === 'editor' ? editorViewport().w / editorZoom() : VIEW_W; }
  function angleToFrame(rad) {
    var c = (cfg.sprite.manifest && cfg.sprite.manifest.frameCount) || 24;
    return Math.round(normalizeAngle(rad) / (Math.PI * 2) * c) % c;
  }

  function drawCoverImage(asset) {
    if (!asset || !asset.ready) return false;
    var iw = asset.image.naturalWidth || asset.image.width, ih = asset.image.naturalHeight || asset.image.height;
    if (!iw || !ih) return false;
    var s = Math.max(VIEW_W / iw, VIEW_H / ih), dw = iw * s, dh = ih * s;
    var dx = (VIEW_W - dw) * 0.5, dy = (VIEW_H - dh) * 0.5;
    ctx.drawImage(asset.image, dx, dy, dw, dh);
    return { dx: dx, dy: dy, dw: dw, dh: dh, scale: s };
  }

  function drawPlayerAvatar(avatarUrl, nickName, x, y, r, highlight) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    var asset = getAvatarAsset(avatarUrl);
    if (asset && asset.ready) {
      ctx.drawImage(asset.image, x - r, y - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = highlight ? '#2c6657' : '#33404f';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      var name = String(nickName || '微');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.max(12, Math.round(r * 0.92)) + 'px ' + UI_FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name.charAt(0) || '微', x, y + 1);
    }
    ctx.restore();
    ctx.strokeStyle = highlight ? '#6ef0a7' : 'rgba(255,255,255,.42)';
    ctx.lineWidth = highlight ? 3 : 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.textBaseline = 'alphabetic';
  }

  function drawUiSpriteButton(kind, x, y, w, h, pressed) {
    var frame = UI_BUTTON_FRAMES[kind];
    if (!frame) return false;
    var assets = cfg.uiButtonAssets || {};
    var asset = pressed ? assets.pressed : assets.normal;
    if (!asset || !asset.ready || !asset.image) asset = assets.normal;
    if (!asset || !asset.ready || !asset.image) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(asset.image, frame.x, frame.y, frame.w, frame.h, x - w * 0.5, y - h * 0.5, w, h);
    ctx.restore();
    return true;
  }

  // [v78/v81] 玩家微信头像：改为与排行榜共用 getAvatarAsset 缓存（同 URL 只加载一次，
  //   且**不设 crossOrigin**）。原实现用 img.crossOrigin='anonymous' 单独加载，
  //   微信头像 CDN 无 CORS 响应头时必然 onerror → 顶栏永远回退阿蜥肖像
  //   （症状：排行榜能显示微信头像、游戏中左上角仍是阿蜥）。排行榜走的正是非 CORS 路径。
  // [v28 性能·只针对角色] 角色徽章底座（暗色圆 + 投影）预烘焙。
  //   原实现每帧 shadowBlur=8 画一次投影圆 —— shadowBlur 是 Skia 高斯模糊慢路径，
  //   4K 现场每帧都跑一次纯属浪费。底座是纯静态（半径恒 27），烘焙一次每帧 drawImage，
  //   视觉完全一致（烘焙时用同样的 shadow 参数，且按 artScale 输出物理像素更锐）。
  function cachedBadgeBaseArt(radius) {
    radius = Math.max(4, Math.round(Number(radius) || 27));
    var core = radius + 4;      // 底座圆半径（与原 r+4 一致）
    var pad = 22;               // 覆盖 shadowBlur 8 扩散 + offsetY 3
    var key = 'badgeBase:' + artScale.toFixed(2) + ':' + radius;
    if (staticArtCache[key]) return staticArtCache[key];
    var art = createScaledArtCanvas((core + pad) * 2, (core + pad) * 2), g = art.ctx;
    var c = core + pad;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    g.fillStyle = '#0b1215';
    g.beginPath(); g.arc(c, c, core, 0, Math.PI * 2); g.fill();
    g.restore();
    art.pad = pad; art.cx = c; art.cy = c;
    staticArtCache[key] = art;
    return art;
  }

  function drawCharacterBadge() {
    var character = cfg.characterUi || {};
    var portrait = character.portrait || {};
    var asset = cfg.characterPortrait;
    var x = 36, y = 37, r = 27;

    // [v81 用户需求] 顶栏左上角 = 玩家微信头像，昵称在头像**右侧**（原在头像下方）。
    //   资料源优先级：① 网页大屏 window.__kioskPlayerProfile（开局后轮询本会话资料）
    //                ② 小游戏端 cfg.playerProfile（本机已授权微信资料 authorized=true）
    //   两者都没有 → 回退角色肖像 + 角色名（现场一眼看出「资料未成功调用」）。
    // [v92] 小游戏端没有 window（全局是 GameGlobal），网页版才有 window。
    //   两种运行时都要能读到同一个全局键 __kioskPlayerProfile。
    var rg = (typeof window !== 'undefined') ? window
      : (typeof GameGlobal !== 'undefined') ? GameGlobal
      : (typeof globalThis !== 'undefined') ? globalThis : null;
    var profile = (rg && rg.__kioskPlayerProfile) || null;
    var pName = profile && profile.nickname ? String(profile.nickname) : '';
    var pAvatar = profile && profile.avatarUrl ? String(profile.avatarUrl) : '';
    if (!pAvatar) {
      var lp = cfg.playerProfile || null;
      var lpAvatar = (lp && lp.authorized && lp.avatarUrl) ? String(lp.avatarUrl) : '';
      if (lpAvatar) {
        pAvatar = lpAvatar;
        if (!pName) pName = String(lp.nickName || lp.nickname || '');
      }
    }
    var avatarAsset = pAvatar ? getAvatarAsset(pAvatar) : null;
    var kioskAvatarImg = (avatarAsset && avatarAsset.ready && !avatarAsset.failed) ? avatarAsset.image : null;

    // 头像底座：烘焙缓存替代每帧 shadowBlur（[v28 性能·只针对角色]，视觉不变）。
    var badgeBase = cachedBadgeBaseArt(r);
    ctx.drawImage(badgeBase.canvas, x - badgeBase.cx, y - badgeBase.cy, badgeBase.w, badgeBase.h);

    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#f1c453';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    if (kioskAvatarImg) {
      // 微信头像：居中裁切成圆形（cover 效果）
      var aw = kioskAvatarImg.naturalWidth || kioskAvatarImg.width;
      var ah = kioskAvatarImg.naturalHeight || kioskAvatarImg.height;
      if (aw && ah) {
        var aside = Math.min(aw, ah);
        var asx = (aw - aside) * 0.5, asy = (ah - aside) * 0.5;
        ctx.drawImage(kioskAvatarImg, asx, asy, aside, aside, x - r, y - r, r * 2, r * 2);
      }
    } else if (asset && asset.ready && asset.image) {
      var iw = asset.image.naturalWidth || asset.image.width;
      var ih = asset.image.naturalHeight || asset.image.height;
      if (iw && ih) {
        var zoom = clamp(Number(portrait.zoom) || 1, 0.5, 5);
        var side = Math.min(iw, ih) / zoom;
        var focusX = clamp(Number(portrait.focusX), 0, 1);
        var focusY = clamp(Number(portrait.focusY), 0, 1);
        if (!isFinite(focusX)) focusX = 0.5;
        if (!isFinite(focusY)) focusY = 0.46;
        var sx = clamp(focusX * iw - side * 0.5, 0, Math.max(0, iw - side));
        var sy = clamp(focusY * ih - side * 0.5, 0, Math.max(0, ih - side));
        var portraitPixelated = !!portrait.pixelated;
        if (portraitPixelated) ctx.imageSmoothingEnabled = false;
        ctx.drawImage(asset.image, sx, sy, side, side, x - r, y - r, r * 2, r * 2);
        if (portraitPixelated) ctx.imageSmoothingEnabled = true;
      }
    } else if (cfg.sprite.ready && cfg.sprite.manifest) {
      ctx.drawImage(cfg.sprite.image, 0, 0, cfg.sprite.manifest.frameWidth, cfg.sprite.manifest.frameHeight, x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();

    ctx.strokeStyle = '#fff1a2';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#d89b25';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke();

    // [v81] 昵称挪到头像右侧：左对齐、垂直居中对齐头像圆心；
    //   空间到中央星标（x≈204）之前，超宽先自动缩号、再截断加省略号。
    var nameText = pName || String(character.name || '阿蜥AXI');
    var nameX = x + r + 12;
    var nameMaxW = Math.max(56, 200 - nameX);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.shadowColor = 'rgba(0,0,0,.7)';
    ctx.shadowBlur = 3;
    var nameFontSize = 16;
    ctx.font = 'bold ' + nameFontSize + 'px ' + UI_FONT;
    while (nameFontSize > 11 && ctx.measureText(nameText).width > nameMaxW) {
      nameFontSize -= 1;
      ctx.font = 'bold ' + nameFontSize + 'px ' + UI_FONT;
    }
    if (ctx.measureText(nameText).width > nameMaxW) {
      while (nameText.length > 1 && ctx.measureText(nameText + '…').width > nameMaxW) {
        nameText = nameText.slice(0, nameText.length - 1);
      }
      nameText += '…';
    }
    ctx.fillText(nameText, nameX, y + 1);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  function drawStageBackgroundImageOnce(focusX, asset, levelWidthOverride) {
    var iw = asset.image.naturalWidth || asset.image.width;
    var ih = asset.image.naturalHeight || asset.image.height;
    if (!iw || !ih) return false;

    var targetAspect = VIEW_W / VIEW_H;
    var imageAspect = iw / ih;
    var sx = 0, sy = 0, sw = iw, sh = ih;
    var levelW = Math.max(VIEW_W, Number(levelWidthOverride) || Number(cfg.runtimeLevel.width) || VIEW_W);
    var maxCamera = Math.max(1, levelW - VIEW_W);
    var progress = clamp((Number(focusX) || 0) / maxCamera, 0, 1);

    if (imageAspect > targetAspect) {
      sw = ih * targetAspect;
      var maxSourceOffset = Math.max(0, iw - sw);
      var travelRatio = clamp(Number(cfg.runtimeLevel.backgroundTravelRatio) || 0.5, 0, 1);
      var travelDistance = maxSourceOffset * travelRatio;
      sx = clamp(maxSourceOffset * 0.5 + (progress - 0.5) * travelDistance, 0, maxSourceOffset);
    } else if (imageAspect < targetAspect) {
      sh = iw / targetAspect;
      sy = Math.max(0, (ih - sh) * 0.5);
    }

    ctx.drawImage(asset.image, sx, sy, sw, sh, 0, 0, VIEW_W, VIEW_H);
    return true;
  }

  function drawStageBackgroundImage(focusX) {
    var levelName = String((cfg.runtimeLevel && cfg.runtimeLevel.name) || '');
    var asset = cfg.stageBackgroundAssets && cfg.stageBackgroundAssets[levelName];
    if (!asset || !asset.ready || !asset.image) return false;

    var repeatDistance = Math.max(0, Number(cfg.runtimeLevel.roundBaseDistance) || 0);
    var firstFinishX = Number(cfg.runtimeLevel.firstRoundFinishX);
    var baseWidth = Math.max(VIEW_W, Number(cfg.runtimeLevel.roundBaseWidth) || 0);
    var roundNo = Math.max(1, Math.round(Number(cfg.runtimeLevel.roundNumber) || 1));
    if (roundNo <= 1 || repeatDistance <= 0 || !isFinite(firstFinishX) || baseWidth <= 0) {
      return drawStageBackgroundImageOnce(focusX, asset, 0);
    }

    var visibleStart = Number(focusX) || 0;
    var visibleEnd = visibleStart + VIEW_W;
    var firstCycle = visibleStart < firstFinishX ? 0 : Math.floor((visibleStart - firstFinishX) / repeatDistance) + 1;
    var lastCycle = visibleEnd <= firstFinishX ? 0 : Math.floor((visibleEnd - firstFinishX - 0.001) / repeatDistance) + 1;
    firstCycle = Math.max(0, firstCycle);
    lastCycle = Math.max(firstCycle, lastCycle);

    for (var cycle = firstCycle; cycle <= lastCycle; cycle++) {
      var segmentStart = cycle === 0 ? -1000000000 : firstFinishX + (cycle - 1) * repeatDistance;
      var segmentEnd = firstFinishX + cycle * repeatDistance;
      var clipLeft = clamp(segmentStart - visibleStart, 0, VIEW_W);
      var clipRight = clamp(segmentEnd - visibleStart, 0, VIEW_W);
      if (clipRight <= clipLeft) continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(clipLeft, 0, clipRight - clipLeft, VIEW_H); ctx.clip();
      drawStageBackgroundImageOnce(visibleStart - cycle * repeatDistance, asset, baseWidth);
      ctx.restore();
    }
    return true;
  }

  function drawBackground(focusX) {
    // 正式关卡背景为不透明 JPG，成功绘制后无需再铺一层全屏渐变。
    if (drawStageBackgroundImage(focusX)) return;

    var themeKey = cfg.runtimeLevel.theme || 'forest';
    var theme = cfg.THEMES[themeKey] || cfg.THEMES.forest;
    var gradientKey = themeKey + ':' + VIEW_H;
    var g = stageGradientCache[gradientKey];
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, theme.skyTop);
      g.addColorStop(0.55, theme.skyMid);
      g.addColorStop(1, theme.skyBot);
      stageGradientCache[gradientKey] = g;
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (cfg.lowDevice && cfg.lowDeviceBgSkip) return;

    if (cfg.runtimeLevel.theme === 'forest') drawForestBackdrop(focusX);
    else if (cfg.runtimeLevel.theme === 'cave') drawCaveBackdrop(focusX);
    else if (cfg.runtimeLevel.theme === 'rural') drawRuralBackdrop(focusX);
    else if (cfg.runtimeLevel.theme === 'city') drawCityBackdrop(focusX);
    else if (cfg.runtimeLevel.theme === 'venice') drawVeniceBackdrop(focusX);
    else if (cfg.runtimeLevel.theme === 'guangdong' || cfg.runtimeLevel.theme === 'hongkong' || cfg.runtimeLevel.theme === 'tokyo' || cfg.runtimeLevel.theme === 'paris' || cfg.runtimeLevel.theme === 'newyork') drawCityBackdrop(focusX);
    else if (cfg.runtimeLevel.theme === 'egypt' || cfg.runtimeLevel.theme === 'dubai') drawEgyptBackdrop(focusX);
    else if (cfg.runtimeLevel.theme === 'mexico') drawRuralBackdrop(focusX);
    else if (cfg.runtimeLevel.theme === 'taipei_night') drawTaiwanBackdrop(focusX);
    else drawTaiwanBackdrop(focusX);
  }

  function drawForestBackdrop(focusX) {
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    for (var i = 0; i < 7; i++) {
      var x = ((i * 150 - focusX * 0.08) % (VIEW_W + 180)) - 90;
      drawCloud(x, 110 + (i % 3) * 42, 88, 30);
    }
    ctx.fillStyle = 'rgba(108,157,118,.52)';
    ctx.beginPath();
    ctx.moveTo(0, 360);
    for (var x = 0; x <= VIEW_W; x += 36) {
      var y = 352 + Math.sin((x + focusX * 0.06) * 0.018) * 18 + Math.cos((x + focusX * 0.04) * 0.011) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, VIEW_H); ctx.lineTo(0, VIEW_H); ctx.closePath(); ctx.fill();
  }

  function drawCaveBackdrop(focusX) {
    ctx.fillStyle = 'rgba(110,147,255,.06)';
    for (var i = 0; i < 7; i++) {
      var x = ((i * 130 - focusX * 0.08) % (VIEW_W + 160)) - 80;
      drawStalag(x, VIEW_H - 90, 120, 180);
    }
  }

  function drawTaiwanBackdrop(focusX) {
    ctx.fillStyle = 'rgba(255,248,224,.20)';
    for (var i = 0; i < 6; i++) {
      var x = ((i * 160 - focusX * 0.10) % (VIEW_W + 180)) - 90;
      drawCloud(x, 126 + (i % 2) * 30, 84, 26);
    }
  }

  function drawRuralBackdrop(focusX) {
    ctx.fillStyle = 'rgba(255,255,255,.74)';
    for (var i = 0; i < 6; i++) {
      var x = ((i * 140 - focusX * 0.08) % (VIEW_W + 170)) - 85;
      drawCloud(x, 118 + (i % 2) * 30, 88, 26);
    }
    ctx.fillStyle = 'rgba(111,171,89,.35)';
    ctx.beginPath();
    ctx.moveTo(0, 420);
    for (var x = 0; x <= VIEW_W; x += 30) {
      ctx.lineTo(x, 408 + Math.sin((x + focusX * 0.05) * 0.017) * 22);
    }
    ctx.lineTo(VIEW_W, VIEW_H); ctx.lineTo(0, VIEW_H); ctx.closePath(); ctx.fill();

    for (var i = 0; i < 5; i++) {
      var x = ((i * 170 - focusX * 0.16) % (VIEW_W + 220)) - 60;
      var baseY = 520 + (i % 2) * 30;
      ctx.fillStyle = '#6a4b31'; ctx.fillRect(x + 12, baseY - 48, 12, 48);
      ctx.fillStyle = '#d85a4e';
      ctx.beginPath(); ctx.moveTo(x - 8, baseY - 42); ctx.lineTo(x + 38, baseY - 72); ctx.lineTo(x + 84, baseY - 42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff1d4'; ctx.fillRect(x, baseY - 42, 76, 42);
      ctx.fillStyle = '#74a951'; ctx.fillRect(x + 28, baseY - 22, 18, 22);
    }
    ctx.fillStyle = 'rgba(230,198,93,.35)';
    for (var i = 0; i < 8; i++) {
      var x = ((i * 84 - focusX * 0.30) % (VIEW_W + 100)) - 40;
      ctx.fillRect(x, 650 + (i % 2) * 20, 58, 10);
    }
  }

  function drawCityBackdrop(focusX) {
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (var i = 0; i < 6; i++) {
      var x = ((i * 160 - focusX * 0.07) % (VIEW_W + 180)) - 90;
      drawCloud(x, 116 + (i % 2) * 34, 82, 24);
    }
    // 非高档设备降低窗户绘制密度与描边次数，缓解每帧 fillRect/stroke 开销（城市主题关卡逐帧绘制）。
    var winCols = lowEffects() ? 2 : (balancedEffects() ? 3 : 4);
    var winRowStep = lowEffects() ? 44 : (balancedEffects() ? 33 : 30);
    var winSkip = lowEffects() ? 2 : (balancedEffects() ? 1 : 0); // 0=全部, 越大越稀疏
    for (var i = 0; i < 8; i++) {
      var x = ((i * 96 - focusX * 0.16) % (VIEW_W + 120)) - 30;
      var h = 170 + (i % 4) * 55;
      var y = VIEW_H - h - 120;
      ctx.fillStyle = i % 2 ? '#4b567f' : '#5d6995';
      ctx.fillRect(x, y, 68, h);
      ctx.fillStyle = 'rgba(255,230,148,.68)';
      for (var wx = 0; wx < winCols; wx++) {
        for (var wy = 0; wy < Math.floor(h / winRowStep); wy++) {
          if (winSkip > 0 && ((wx + wy + i) % (winSkip + 1) !== 0)) continue;
          ctx.fillRect(x + 8 + wx * 14, y + 12 + wy * winRowStep, 7, 9);
        }
      }
    }
    ctx.fillStyle = 'rgba(33,42,67,.52)';
    ctx.fillRect(0, VIEW_H - 126, VIEW_W, 126);
    ctx.strokeStyle = 'rgba(255,223,118,.58)';
    ctx.lineWidth = 3;
    var laneStep = lowEffects() ? 240 : 120; // 低档减半道路标线绘制次数
    for (var x = -40 - (focusX * 0.48 % laneStep); x < VIEW_W + 60; x += laneStep) {
      ctx.beginPath(); ctx.moveTo(x, VIEW_H - 54); ctx.lineTo(x + 50, VIEW_H - 54); ctx.stroke();
    }
  }

  function waterHash(seed) {
    var x = Math.sin(seed * 91.733 + 17.17) * 43758.5453;
    return x - Math.floor(x);
  }

  function drawVeniceBackdrop(focusX) {
    var surface = Number(cfg.runtimeLevel.waterSurfaceY);
    if (!isFinite(surface)) surface = VIEW_H * 0.5;
    surface = clamp(surface, 220, VIEW_H - 180);
    var t = nowSec();

    ctx.fillStyle = 'rgba(255,255,255,.70)';
    for (var c = 0; c < 5; c++) {
      var cloudX = ((c * 165 - focusX * 0.06) % (VIEW_W + 200)) - 90;
      drawCloud(cloudX, 112 + (c % 2) * 42, 86, 25);
    }
    for (var b = 0; b < 7; b++) {
      var buildingX = ((b * 118 - focusX * 0.20) % (VIEW_W + 170)) - 55;
      var buildingH = 112 + (b % 4) * 34;
      var buildingY = surface - buildingH + 8;
      ctx.fillStyle = b % 3 === 0 ? '#d99772' : (b % 3 === 1 ? '#f0c07d' : '#c57f6c');
      ctx.fillRect(buildingX, buildingY, 88, buildingH);
      ctx.fillStyle = 'rgba(83,116,133,.78)';
      for (var wy = buildingY + 20; wy < surface - 26; wy += 31) {
        ctx.fillRect(buildingX + 13, wy, 14, 20);
        ctx.fillRect(buildingX + 50, wy, 14, 20);
      }
      ctx.fillStyle = '#9a5848';
      ctx.beginPath(); ctx.moveTo(buildingX - 5, buildingY); ctx.lineTo(buildingX + 44, buildingY - 27); ctx.lineTo(buildingX + 93, buildingY); ctx.closePath(); ctx.fill();
    }

    var water = ctx.createLinearGradient(0, surface, 0, VIEW_H);
    water.addColorStop(0, 'rgba(70,190,214,.58)');
    water.addColorStop(0.35, 'rgba(14,126,169,.72)');
    water.addColorStop(1, 'rgba(2,55,92,.90)');
    ctx.fillStyle = water;
    ctx.fillRect(0, surface, VIEW_W, VIEW_H - surface);

    ctx.strokeStyle = 'rgba(222,255,255,.92)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (var sx = -10; sx <= VIEW_W + 10; sx += 10) {
      var sy = surface + Math.sin((sx + focusX * 0.22) * 0.045 + t * 2.3) * 4;
      if (sx === -10) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,250,255,.35)';
    ctx.lineWidth = 1.5;
    for (var ray = 0; ray < 9; ray++) {
      var rx = ((ray * 83 - focusX * 0.08) % (VIEW_W + 100)) - 40;
      ctx.beginPath(); ctx.moveTo(rx, surface + 8); ctx.lineTo(rx + 42, VIEW_H - 42); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(170,151,91,.72)';
    ctx.beginPath(); ctx.moveTo(0, VIEW_H - 56);
    for (var gx = 0; gx <= VIEW_W; gx += 24) ctx.lineTo(gx, VIEW_H - 54 + Math.sin((gx + focusX * 0.16) * 0.04) * 7);
    ctx.lineTo(VIEW_W, VIEW_H); ctx.lineTo(0, VIEW_H); ctx.closePath(); ctx.fill();

    for (var s = 0; s < 14; s++) {
      var seed = waterHash(s + Math.floor(focusX / 190) * 0.37);
      var seaX = ((s * 73 - focusX * 0.32) % (VIEW_W + 100)) - 30;
      var seaH = 42 + seed * 78;
      var sway = Math.sin(t * 1.7 + s * 0.83) * 9;
      ctx.strokeStyle = s % 3 === 0 ? '#3fb96f' : (s % 3 === 1 ? '#258f70' : '#63c66a');
      ctx.lineWidth = 5 + (s % 2);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(seaX, VIEW_H - 48); ctx.quadraticCurveTo(seaX + sway, VIEW_H - 48 - seaH * 0.55, seaX + sway * 0.55, VIEW_H - 48 - seaH); ctx.stroke();
      ctx.lineCap = 'butt';
    }

    for (var f = 0; f < 8; f++) {
      var speed = 16 + waterHash(f + 40) * 24;
      var dir = f % 2 === 0 ? 1 : -1;
      var span = VIEW_W + 180;
      var fishX = ((waterHash(f + 70) * span + dir * t * speed - focusX * 0.10) % span + span) % span - 90;
      var fishY = surface + 80 + waterHash(f + 90) * Math.max(90, VIEW_H - surface - 180);
      var size = 7 + waterHash(f + 110) * 8;
      ctx.save(); ctx.translate(fishX, fishY); ctx.scale(dir, 1);
      ctx.fillStyle = f % 3 === 0 ? '#ffd067' : (f % 3 === 1 ? '#8ee3e8' : '#ff9b83');
      ctx.beginPath(); ctx.ellipse(0, 0, size * 1.5, size, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-size * 1.3, 0); ctx.lineTo(-size * 2.2, -size); ctx.lineTo(-size * 2.2, size); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#20364d'; ctx.beginPath(); ctx.arc(size * 0.7, -size * 0.2, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    var depth = Math.max(120, VIEW_H - surface);
    for (var i = 0; i < 26; i++) {
      var bubbleSpeed = 18 + waterHash(i + 120) * 46;
      var startY = waterHash(i + 160) * depth;
      var travel = (startY - t * bubbleSpeed) % depth;
      if (travel < 0) travel += depth;
      var bubbleY = surface + travel;
      var bubbleX = ((waterHash(i + 200) * (VIEW_W + 80) - focusX * (0.03 + waterHash(i + 240) * 0.05)) % (VIEW_W + 80) + (VIEW_W + 80)) % (VIEW_W + 80) - 40;
      bubbleX += Math.sin(t * 1.4 + i) * 6;
      var radius = 2 + waterHash(i + 280) * 6;
      ctx.strokeStyle = 'rgba(225,255,255,' + (0.38 + waterHash(i + 300) * 0.42) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.arc(bubbleX - radius * 0.35, bubbleY - radius * 0.35, Math.max(1, radius * 0.22), 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawEgyptBackdrop(focusX) {
    ctx.fillStyle = 'rgba(227,174,75,.28)'; ctx.fillRect(0, VIEW_H * 0.64, VIEW_W, VIEW_H * 0.36);
    ctx.fillStyle = 'rgba(180,112,48,.35)';
    for (var i = 0; i < 4; i++) {
      var x = ((i * 230 - focusX * 0.12) % (VIEW_W + 280)) - 100;
      var base = VIEW_H - 120;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + 85, base - 150 - (i % 2) * 40); ctx.lineTo(x + 170, base); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,243,184,.24)';
    for (var s = 0; s < 20; s++) {
      var sx = ((s * 47 - focusX * 0.35) % (VIEW_W + 60)) - 20;
      var sy = 220 + (s % 7) * 82;
      ctx.fillRect(sx, sy, 3, 3);
    }
  }

  function drawCloud(x, y, w, h) {
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.28, h * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.25, y - 10, w * 0.26, h * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.48, y, w * 0.28, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStalag(x, y, w, h, top) {
    ctx.beginPath();
    if (top) {
      ctx.moveTo(x, 0); ctx.lineTo(x + w * 0.5, h); ctx.lineTo(x + w, 0);
    } else {
      ctx.moveTo(x, y); ctx.lineTo(x + w * 0.5, y - h); ctx.lineTo(x + w, y);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawWalls(focusX) {
    var walls = cfg.runtimeLevel.walls || [];
    for (var i = 0; i < walls.length; i++) {
      var wall = walls[i];
      var x = worldToScreenX(wall.x, focusX);
      if (x + wall.w < -60 || x > visibleWorldWidth() + 60) continue;
      if (wall.spring && wall.removed) continue;

      var art = cachedWallArt(wall);
      var pad = Number(art.pad) || 0;
      if (wall.spring) {
        var springAnim = clamp(Number(wall.springAnim) || 0, -0.45, 1.35);
        var positive = Math.max(0, springAnim), negative = Math.max(0, -springAnim);
        var scaleX = 1, scaleY = 1;
        if (wall.axis === 'vertical') {
          scaleX = 1 - positive * 0.34 + negative * 0.18;
          scaleY = 1 + positive * 0.10 - negative * 0.06;
        } else {
          scaleX = 1 + positive * 0.10 - negative * 0.06;
          scaleY = 1 - positive * 0.38 + negative * 0.22;
        }
        var fade = wall.oneShot && wall.used ? clamp((wall.disappearTimer || 0) / 0.46, 0, 1) : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(x + wall.w * 0.5, wall.y + wall.h * 0.5);
        ctx.scale(Math.max(0.28, scaleX), Math.max(0.28, scaleY));
        ctx.drawImage(art.canvas, -wall.w * 0.5 - pad, -wall.h * 0.5 - pad, art.w, art.h);
        ctx.restore();
      } else {
        ctx.drawImage(art.canvas, x - pad, wall.y - pad, art.w, art.h);
      }
    }
  }

  function drawBumpers(focusX) {
    var bumpers = cfg.runtimeLevel.bumpers || [];
    for (var i = 0; i < bumpers.length; i++) {
      var bumper = bumpers[i];
      var x = worldToScreenX(bumper.x, focusX);
      if (x + bumper.r < -50 || x - bumper.r > visibleWorldWidth() + 50) continue;
      var art = cachedBumperArt(bumper);
      var pad = Number(art.pad) || 0;
      ctx.drawImage(art.canvas, x - bumper.r - pad, bumper.y - bumper.r - pad, art.w, art.h);
    }
  }

  var ANCHOR_GUIDE_PINK = '#ff4f9a';

  function drawAnchorGraphic(x, y, highlight) {
    var forest = cfg.runtimeLevel.theme === 'forest';
    var art = cachedAnchorCore(cfg.runtimeLevel.theme);
    ctx.drawImage(art.canvas, x - art.cx, y - art.cy, art.w, art.h);
    if (highlight) {
      ctx.strokeStyle = ANCHOR_GUIDE_PINK; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(x, y, (forest ? 24 : 22) + Math.sin(nowSec() * (forest ? 8 : 7)) * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawAnchors(focusX) {
    var candidate = cfg.scene === 'playing' ? cfg.getAnchorCandidate() : null;
    var anchors = cfg.runtimeLevel.anchors || [];
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var x = worldToScreenX(a.x, focusX);
      if (x < -60 || x > visibleWorldWidth() + 60) continue;
      drawAnchorGraphic(x, a.y, !!candidate && candidate.index === i && cfg.player.attachIndex === null);
    }
  }

  function drawFinishLine(focusX) {
    var finish = cfg.runtimeLevel.finish;
    var x = worldToScreenX(finish.x, focusX);
    if (x < -80 || x > visibleWorldWidth() + 80) return;
    var cell = 22;
    var startY = cfg.scene === 'editor' ? 0 : Math.min(0, Math.floor((cameraY - 80) / cell) * cell);
    var endY = finish.y + finish.h;
    for (var y = startY; y < endY; y += cell) {
      var parity = ((Math.floor(y / cell) % 2) + 2) % 2;
      ctx.fillStyle = parity ? '#111' : '#fff';
      ctx.fillRect(x, y, finish.w * 0.5, cell);
      ctx.fillStyle = parity ? '#fff' : '#111';
      ctx.fillRect(x + finish.w * 0.5, y, finish.w * 0.5, cell);
    }
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(x - 5, startY, 5, endY - startY);
  }

  function drawRoundBoundaryMarker(focusX) {
    var roundNo = Math.max(1, Math.round(Number(cfg.runtimeLevel && cfg.runtimeLevel.roundNumber) || 1));
    var markerWorldX = Number(cfg.runtimeLevel && cfg.runtimeLevel.firstRoundFinishX);
    if (roundNo <= 1 || !isFinite(markerWorldX)) return;
    var x = worldToScreenX(markerWorldX, focusX);
    if (x < -60 || x > visibleWorldWidth() + 60) return;

    ctx.save();
    ctx.fillStyle = 'rgba(45,255,108,.18)';
    ctx.fillRect(x - 8, 0, 16, cfg.runtimeLevel.height);
    ctx.strokeStyle = '#32ff73';
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(20,255,90,.82)';
    ctx.shadowBlur = lowEffects() ? 0 : (balancedEffects() ? 6 : 12);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cfg.runtimeLevel.height); ctx.stroke();
    ctx.shadowBlur = 0;

    var chars = ['第', '一', '轮', '终', '点'];
    var labelY = cameraY + 150;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px ' + UI_FONT;
    for (var i = 0; i < chars.length; i++) {
      var cy = labelY + i * 30;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,45,18,.92)';
      ctx.strokeText(chars[i], x + 24, cy);
      ctx.fillStyle = '#72ff9d';
      ctx.fillText(chars[i], x + 24, cy);
    }
    ctx.restore();
  }

  function drawCrows(focusX) {
    var crows = cfg.crows || [];
    var asset = cfg.crowSprite;
    var sc = cfg.crowSpriteConfig || { frameWidth: 352, frameHeight: 352, frameCount: 12, columns: 4, fps: 10 };
    var fw = Math.max(1, Number(sc.frameWidth) || 352);
    var fh = Math.max(1, Number(sc.frameHeight) || 352);
    var count = Math.max(1, Math.round(Number(sc.frameCount) || 12));
    var columns = Math.max(1, Math.round(Number(sc.columns) || 4));
    var fps = Math.max(1, Number(sc.fps) || 10);
    for (var i = 0; i < crows.length; i++) {
      var crow = crows[i];
      var x = worldToScreenX(crow.x, focusX);
      var size = Math.max(54, Number(crow.size) || 96);
      if (x < -size || x > visibleWorldWidth() + size) continue;
      var frame = Math.floor((Number(crow.animTime) || 0) * fps) % count;
      var col = frame % columns;
      var row = Math.floor(frame / columns);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(crow.y));
      ctx.globalAlpha = crow.hitPlayer ? 0.78 : 1;
      ctx.imageSmoothingEnabled = false;
      if (asset && asset.ready && asset.image) {
        ctx.drawImage(asset.image, col * fw, row * fh, fw, fh, -size * 0.5, -size * 0.5, size, size);
      } else {
        ctx.fillStyle = '#20242c';
        ctx.strokeStyle = '#090b0e';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, size * 0.34, size * 0.20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-size * 0.1, 0); ctx.lineTo(-size * 0.48, -size * 0.26); ctx.lineTo(-size * 0.32, size * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(size * 0.30, -size * 0.03); ctx.lineTo(size * 0.48, size * 0.03); ctx.lineTo(size * 0.30, size * 0.10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(size * 0.12, -size * 0.09, 7, 9);
      }
      ctx.restore();
    }
  }

  // 2026-10-09：小青吃乌鸦掉落的羽毛 —— 飘动 2 秒（不透明）→ 淡出 1 秒。
  // 位置/摇摆/倾角由 core 的 updateFeatherFx 权威驱动，这里只负责画。
  function drawFeathers(focusX) {
    var feathers = cfg.feathers || [];
    if (!feathers.length) return;
    var assets = { A: cfg.featherSpriteA, B: cfg.featherSpriteB };
    for (var i = 0; i < feathers.length; i++) {
      var f = feathers[i];
      if ((Number(f.delay) || 0) > 0) continue;   // 错落：还没到出场时间
      var asset = assets[f.sprite] || assets.A;
      if (!asset || !asset.ready || !asset.image) continue;
      var x = worldToScreenX(f.x, focusX);
      var size = Math.max(20, Number(f.size) || 54);
      if (x < -size * 2 || x > visibleWorldWidth() + size * 2) continue;
      var age = Number(f.age) || 0;
      var floatSec = 2.0;
      var alpha = age <= floatSec ? 1 : Math.max(0, 1 - (age - floatSec) / 1.0);
      if (alpha <= 0) continue;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(f.y));
      ctx.rotate(Number(f.rot) || 0);
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = false;
      var iw = asset.image.width;
      var ih = asset.image.height;
      var dw = size;
      var dh = size * ih / Math.max(1, iw);
      ctx.drawImage(asset.image, -dw * 0.5, -dh * 0.5, dw, dh);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // 2026-10-09：乌鸦被吃掉的消失特效 —— 乌鸦位置闪一组放射线条 1 秒：
  // 线条向外扩张（r 由 core 驱动）+ 高频闪烁，表示乌鸦已经消失。
  function drawCrowVanish(focusX) {
    var fxs = cfg.crowVanishFx || [];
    if (!fxs.length) return;
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (var i = 0; i < fxs.length; i++) {
      var v = fxs[i];
      var x = worldToScreenX(v.x, focusX);
      var y = Number(v.y) || 0;
      if (x < -140 || x > visibleWorldWidth() + 140) continue;
      var pt = (Number(v.age) || 0) / (Number(v.life) || 1);
      if (pt >= 1) continue;
      // 高频闪烁（约 4 次/秒）+ 后半程整体减弱
      var blink = 0.45 + 0.55 * Math.abs(Math.sin(v.age * Math.PI * 8));
      var alpha = blink * (pt < 0.7 ? 1 : 1 - (pt - 0.7) / 0.3);
      var r0 = Math.max(2, Number(v.r) || 6);
      ctx.strokeStyle = '#f2f6ff';
      ctx.globalAlpha = alpha * 0.95;
      var rays = v.rays || [];
      for (var k = 0; k < rays.length; k++) {
        var ray = rays[k];
        var ca = Math.cos(ray.ang);
        var sa = Math.sin(ray.ang);
        var x1 = x + ca * r0;
        var y1 = y + sa * r0;
        var x2 = x + ca * (r0 + ray.len);
        var y2 = y + sa * ray.len + r0;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      // 中心一点亮斑收尾
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 5 * (1 - pt) + 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFoods(focusX) {
    var foods = cfg.runtimeLevel.foods || [];
    for (var i = 0; i < foods.length; i++) {
      var food = foods[i];
      if (food.collected) continue;
      var x = worldToScreenX(food.x, focusX);
      if (x < -60 || x > visibleWorldWidth() + 60) continue;
      var y = food.y + Math.sin(nowSec() * 4 + food.x * 0.02) * 4;
      if ((food.skillItem || food.kind === 'golden_sweet_potato') && !lowEffects()) {
        var pulse = (balancedEffects() ? 0.42 : 0.58) + Math.sin(nowSec() * 6 + food.x * 0.01) * (balancedEffects() ? 0.12 : 0.18);
        ctx.save();
        ctx.globalAlpha = pulse;
        var glowArt = cachedGoldenGlow();
        ctx.drawImage(glowArt.canvas, x - 54, y - 54, 108, 108);
        ctx.restore();
      }
      // 薯王·黄金番薯磁力吸附：吸附本身由 core 的 updatePotatoMagnet 处理（薯王靠近即自动吸过来）。
      // 2026-10-09：移除原来的「紫薯色牵引线」视觉线索——用户要求磁吸时不要出现中间那条线。
      ctx.drawImage(getFoodIcon(food.kind, cfg.foodArtAssets), Math.round(x - 32), Math.round(y - 32), 64, 64);
    }
  }

  function drawTongue(focusX) {
    var mouth = cfg.getMouthWorld();
    var player = cfg.player;
    // 2026-10-13 红线修复：变蛇期间一律不画玩法舌头。小青贪吃舌/回收舌状态若残留，
    // 会从蛇头拖出一条横穿屏幕的粉红线；蛇形自身有 realSnake 的动态蛇信，不需要这条。
    // [v2 修复] core 传来的 isSnakeFormActive 是布尔值（r.isSnakeFormActive = isSnakeFormActive()），
    // 旧写法按函数调用导致守卫从未生效（红线复现）。三种形状全免疫：snakeForm.active / 布尔 / 函数。
    if ((cfg.snakeForm && cfg.snakeForm.active) ||
        cfg.isSnakeFormActive === true ||
        (typeof cfg.isSnakeFormActive === 'function' && cfg.isSnakeFormActive())) return;
    // 2026-10-01 修订：小青伸舌够食物时，这条就是当前唯一的一根舌头 —— 画完直接返回，
    // 避免它和锚点绳同时出现（用户明确要求：一次只能有一根舌头）。
    if (cfg.greedyShotActive && cfg.greedyShot) {
      var gs = cfg.greedyShot;
      drawTongueCurve(
        { x: worldToScreenX(mouth.x, focusX), y: mouth.y },
        { x: worldToScreenX(gs.tipX, focusX), y: gs.tipY },
        false, 0.92
      );
      return;
    }
    if (player.attachIndex !== null) {
      var anchor = cfg.runtimeLevel.anchors[player.attachIndex];
      if (!anchor) { player.attachIndex = null; }
      else {
        var snapPulse = player.attachSnapTimer > 0 && player.attachSnapDuration > 0
          ? Math.sin((1 - player.attachSnapTimer / player.attachSnapDuration) * Math.PI) : 0;
        // 轻微弯曲：模拟真实绳子的摆荡形变（参考悬链线/鞭甩力学）：
        // 弯曲集中在活动端＝靠近角色一侧，向自由端(锚点)渐直；
        // 弯曲方向跟随摆荡方向（从左往右荡则曲面朝右），弯曲幅度随
        // 绳子长度与垂直落差增大而增大（越过阈值后更明显）。
        var adx = anchor.x - player.x, ady = anchor.y - player.y;
        var ad = Math.hypot(adx, ady) || 1;
        var atx = -ady / ad, aty = adx / ad;            // 绳子法向（vx>0 时指向右下）
        var tangentVel = (player.vx || 0) * atx + (player.vy || 0) * aty;
        var ropeLen = player.ropeLength || ad;
        // 角度阈值：绳子偏离垂直方向超过 22.5° 才开始有弯曲（垂直悬挂=直）
        var angleFromVert = Math.abs(Math.atan2(Math.abs(adx), Math.abs(ady))); // 0=垂直, π/2=水平
        var ANGLE_THRESHOLD = Math.PI / 8; // 22.5°
        // 角度因子：22.5°以下=0，22.5~60°从0渐增到1
        var angleF = clamp((angleFromVert - ANGLE_THRESHOLD) / (Math.PI / 3 - ANGLE_THRESHOLD), 0, 1);
        // 长度阈值：约 120px 起弯，300px 后趋于满
        var lenF = clamp((ropeLen - 120) / 180, 0, 1);
        // 高度阈值：锚点相对口腔的垂直落差，约 90px 起、240px 后趋于满
        var heightF = clamp((Math.abs(ady) - 90) / 150, 0, 1);
        // 三项同时满足时弯曲才出现：角度够偏+绳长够长+落差够大
        var threshF = angleF * lenF * (0.35 + 0.65 * heightF);
        var baseBend = 4;
        var swingBend = clamp((baseBend + Math.abs(tangentVel) * 0.06) * threshF, 0, 24);
        var dirSign = tangentVel >= 0 ? 1 : -1;
        var bendVecX = atx * dirSign, bendVecY = aty * dirSign;
        drawTongueSwinging(
          { x: worldToScreenX(mouth.x, focusX), y: mouth.y },
          { x: worldToScreenX(anchor.x, focusX), y: anchor.y },
          1, snapPulse, bendVecX, bendVecY, swingBend
        );
        return;
      }
    }
    var tfx = cfg.tongueFx;
    if (tfx.mode === 'extend' || tfx.mode === 'retract') {
      var prog = tfx.duration > 0 ? clamp(1 - tfx.timer / tfx.duration, 0, 1) : 1;
      var tipP = tfx.mode === 'extend' ? prog : 1 - prog;
      var tipX = lerp(mouth.x, tfx.targetX, tipP);
      var tipY = lerp(mouth.y, tfx.targetY, tipP);
      drawTongueCurve(
        { x: worldToScreenX(mouth.x, focusX), y: mouth.y },
        { x: worldToScreenX(tipX, focusX), y: tipY },
        tfx.mode === 'retract' || tfx.invert, 0.92
      );
    } else if (tfx.mode === 'limp') {
      var remain = tfx.duration > 0 ? clamp(tfx.timer / tfx.duration, 0, 1) : 0;
      var limpProgress = 1 - remain;
      var limpTipX = lerp(mouth.x, tfx.targetX, remain);
      var limpTipY = lerp(mouth.y, tfx.targetY, remain);
      drawTongueLimp(
        { x: worldToScreenX(mouth.x, focusX), y: mouth.y },
        { x: worldToScreenX(limpTipX, focusX), y: limpTipY },
        limpProgress, 0.28 + remain * 0.72
      );
    } else if (tfx.mode === 'rebound') {
      var prog2 = clamp(1 - tfx.timer / tfx.duration, 0, 1);
      var bounce = Math.sin(prog2 * Math.PI);
      var tipX2 = mouth.x + Math.sin(tfx.aimAngle || 0) * 22 * bounce;
      var tipY2 = mouth.y - Math.cos(tfx.aimAngle || 0) * 22 * bounce;
      drawTongueCurve(
        { x: worldToScreenX(mouth.x, focusX), y: mouth.y },
        { x: worldToScreenX(tipX2, focusX), y: tipY2 },
        false, 0.88
      );
    }
  }

  function adjustTongueStartPoint(start, end) {
    // 舌根向人物口腔内缩 2.4px。以舌头延伸方向的反方向位移，
    // 让所有旋转角度都能与精灵图上的粉色舌根自然重合。
    var dx = end.x - start.x, dy = end.y - start.y;
    var len = Math.hypot(dx, dy) || 1;
    var inset = 2.4;
    return { x: start.x - dx / len * inset, y: start.y - dy / len * inset };
  }

  function drawTongueStraightTapered(start, end, alpha, pulse) {
    alpha = alpha || 1; pulse = pulse || 0;
    start = adjustTongueStartPoint(start, end);
    var dx = end.x - start.x, dy = end.y - start.y;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var st = tongueStyle();
    var fillColor = st.fill;
    var oS = (3.2 + pulse * 0.8) * st.w, oM = (2.0 + pulse * 0.3) * st.w, oE = (3.0 + pulse * 0.7) * st.w;

    function polyForWidths(w0, w1, w2) {
      return [
        { x: start.x + nx * w0, y: start.y + ny * w0 },
        { x: start.x + dx * 0.5 + nx * w1, y: start.y + dy * 0.5 + ny * w1 },
        { x: end.x + nx * w2, y: end.y + ny * w2 },
        { x: end.x - nx * w2, y: end.y - ny * w2 },
        { x: start.x + dx * 0.5 - nx * w1, y: start.y + dy * 0.5 - ny * w1 },
        { x: start.x - nx * w0, y: start.y - ny * w0 }
      ];
    }
    function tracePoly(points) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
    }

    var body = polyForWidths(oS, oM, oE);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fillColor;
    tracePoly(body);
    ctx.fill();
    if (st.outline) {                       // 薯王：黑描边，匹配立绘风格
      ctx.strokeStyle = st.outline; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      tracePoly(body); ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(start.x, start.y, (2.2 + pulse * 0.25) * st.cap, 0, Math.PI * 2);
    ctx.fill();

    if (pulse > 0.02) {
      ctx.strokeStyle = 'rgba(255,255,255,.38)';
      ctx.lineWidth = 0.8 + pulse * 0.55;
      ctx.beginPath(); ctx.arc(end.x, end.y, 5.5 + pulse * 4.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(end.x, end.y, (2.6 + pulse * 0.7) * st.cap, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 轻微弯曲舌头——三次贝塞尔曲线，弯曲集中在靠近角色(根部)一侧、向锚点(自由端)渐直，
  // 模拟真实绳子摆荡时的形变：活动端滞后、弯曲量随长度/摆速增大（参考悬链线/鞭甩力学，
  // 弯曲集中于被甩动的固定端附近，自由端近似沿自身轨迹保持直向）。
  function drawTongueSwinging(start, end, alpha, pulse, bendVecX, bendVecY, bendAmount) {
    alpha = alpha || 1; pulse = pulse || 0;
    start = adjustTongueStartPoint(start, end);
    var st = tongueStyle();
    var fillColor = st.fill;
    var oS = (3.2 + pulse * 0.8) * st.w, oM = (2.0 + pulse * 0.3) * st.w, oE = (3.0 + pulse * 0.7) * st.w;
    // 控制点：P1 靠近根(0.22)取满偏移，P2 靠近自由端(0.62)取 0.35 倍偏移
    // → 弯曲集中于根部、向尖端渐直，整体仍指向锚点
    var p1x = lerp(start.x, end.x, 0.22) + bendVecX * bendAmount;
    var p1y = lerp(start.y, end.y, 0.22) + bendVecY * bendAmount;
    var p2x = lerp(start.x, end.x, 0.62) + bendVecX * bendAmount * 0.35;
    var p2y = lerp(start.y, end.y, 0.62) + bendVecY * bendAmount * 0.35;
    var SEG = 14, left = [], right = [];
    for (var i = 0; i <= SEG; i++) {
      var t = i / SEG, mt = 1 - t;
      var bx = mt*mt*mt*start.x + 3*mt*mt*t*p1x + 3*mt*t*t*p2x + t*t*t*end.x;
      var by = mt*mt*mt*start.y + 3*mt*mt*t*p1y + 3*mt*t*t*p2y + t*t*t*end.y;
      var dxv = 3*mt*mt*(p1x-start.x) + 6*mt*t*(p2x-p1x) + 3*t*t*(end.x-p2x);
      var dyv = 3*mt*mt*(p1y-start.y) + 6*mt*t*(p2y-p1y) + 3*t*t*(end.y-p2y);
      var dl = Math.hypot(dxv, dyv) || 1;
      var nX = -dyv / dl, nY = dxv / dl;
      var w = t < 0.5 ? lerp(oS, oM, t / 0.5) : lerp(oM, oE, (t - 0.5) / 0.5);
      left.push({ x: bx + nX * w, y: by + nY * w });
      right.push({ x: bx - nX * w, y: by - nY * w });
    }
    var poly = left.concat(right.reverse());
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (var j = 1; j < poly.length; j++) ctx.lineTo(poly[j].x, poly[j].y);
    ctx.closePath();
    ctx.fill();
    if (st.outline) {
      ctx.strokeStyle = st.outline; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (var j2 = 1; j2 < poly.length; j2++) ctx.lineTo(poly[j2].x, poly[j2].y);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(start.x, start.y, (2.2 + pulse * 0.25) * st.cap, 0, Math.PI * 2); ctx.fill();
    if (pulse > 0.02) {
      ctx.strokeStyle = 'rgba(255,255,255,.38)';
      ctx.lineWidth = 0.8 + pulse * 0.55;
      ctx.beginPath(); ctx.arc(end.x, end.y, 5.5 + pulse * 4.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(end.x, end.y, (2.6 + pulse * 0.7) * st.cap, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 根据精灵帧索引与缩放/旋转，计算嘴部在屏幕上的坐标（复用 sprite_manifest 的 mouthAnchors）。
  // 把 mouthAnchors 沿径向向帧中心内移一点，避免舌头从头顶/额头出来。
  function getDemoMouthPosition(cx, cy, frameIndex, scale, rot) {
    scale = scale || 1; rot = rot || 0;
    var m = (cfg.sprite && cfg.sprite.manifest) || {};
    var fw = m.logicalFrameWidth || m.frameWidth || 128;
    var fh = m.logicalFrameHeight || m.frameHeight || 128;
    var anchors = m.mouthAnchors || [];
    var count = m.frameCount || 24;
    frameIndex = ((Math.round(frameIndex) % count) + count) % count;
    var raw = anchors[frameIndex] || { x: fw * 0.5, y: fh * 0.24 };
    var centerX = fw * 0.5, centerY = fh * 0.5;
    var vx = raw.x - centerX, vy = raw.y - centerY;
    var dist = Math.hypot(vx, vy) || 1;
    // 教学动图「人物在下、舌头在上」，舌头起点必须精确落在嘴部开口处。
    // 用极小的内缩（4px）避免贴到精灵边缘像素，同时保留 mouthAnchors 校准的嘴部朝向。
    var inset = 4;
    var ratio = Math.max(0, (dist - inset) / dist);
    var anchor = { x: centerX + vx * ratio, y: centerY + vy * ratio };
    var dx = (anchor.x - centerX) * scale;
    var dy = (anchor.y - centerY) * scale;
    if (rot !== 0) {
      var c = Math.cos(rot), s = Math.sin(rot);
      return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
    }
    return { x: cx + dx, y: cy + dy };
  }

  function drawTongueLimp(start, end, progress, alpha) {
    progress = clamp(progress || 0, 0, 1); alpha = alpha === undefined ? 1 : alpha;
    start = adjustTongueStartPoint(start, end);
    var dx = end.x - start.x, dy = end.y - start.y;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var sway = Math.min(52, len * 0.24 + 12) * (0.85 + progress * 0.35);
    var sag = Math.min(58, 16 + len * 0.12 + progress * 28);
    var cp1 = { x: start.x + dx * 0.28 + nx * sway, y: start.y + dy * 0.28 + ny * sway + sag * 0.35 };
    var cp2 = { x: start.x + dx * 0.68 - nx * sway, y: start.y + dy * 0.68 - ny * sway + sag };
    var st = tongueStyle();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    if (st.outline) { ctx.strokeStyle = st.outline; ctx.lineWidth = (3.0 - progress * 0.5) * st.w + 1.5; ctx.stroke(); }
    ctx.strokeStyle = st.fill; ctx.lineWidth = (3.0 - progress * 0.5) * st.w;
    ctx.stroke();
    ctx.fillStyle = st.fill;
    ctx.beginPath(); ctx.arc(start.x, start.y, 1.9 * st.cap, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(end.x, end.y + progress * 4, 3.0 * st.cap, 2.0 * st.cap, progress * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTongueCurve(start, end, invert, alpha) {
    invert = invert || false; alpha = alpha === undefined ? 1 : alpha;
    start = adjustTongueStartPoint(start, end);
    var dx = end.x - start.x, dy = end.y - start.y;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var sway = Math.min(34, len * 0.18 + 8);
    var sign = invert ? -1 : 1;
    var cp1 = { x: start.x + dx * 0.30 + nx * sway * sign, y: start.y + dy * 0.30 + ny * sway * sign };
    var cp2 = { x: start.x + dx * 0.72 - nx * sway * sign, y: start.y + dy * 0.72 - ny * sway * sign };
    var st = tongueStyle();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    if (st.outline) { ctx.strokeStyle = st.outline; ctx.lineWidth = 3.6 * st.w + 1.5; ctx.stroke(); }
    ctx.strokeStyle = st.fill; ctx.lineWidth = 3.6 * st.w;
    ctx.stroke();
    ctx.fillStyle = st.fill;
    ctx.beginPath(); ctx.arc(start.x, start.y, 2.0 * st.cap, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(end.x, end.y, 3.0 * st.cap, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTutorialTargetGuides(focusX) {
    var state = cfg.tutorialFlow || {};
    var task = state.currentTask || {};
    if (!cfg.player || !cfg.isTutorialStage()) return;
    var tutorialGuideActive = state.phase === 'active' || state.phase === 'observe';
    if (!(cfg.player.tapGuideTimer > 0) && !tutorialGuideActive) return;
    var target = null;
    if ((cfg.player.tapGuideTimer || 0) > 0 && cfg.runtimeLevel.anchors[cfg.player.tapGuideIndex]) {
      var tapAnchor = cfg.runtimeLevel.anchors[cfg.player.tapGuideIndex];
      target = { x: tapAnchor.x, y: tapAnchor.y, r: 25 };
    } else if (task.id === 'auto_target' && ((state.tapGuideTimer || 0) > 0 || cfg.player.pressOpenTimer > 0)) {
      var idx = Number(state.tapGuideIndex);
      if (!isFinite(idx) || !cfg.runtimeLevel.anchors[idx]) {
        var cand = cfg.getAnchorCandidate(); idx = cand ? cand.index : -1;
      }
      if (idx >= 0 && cfg.runtimeLevel.anchors[idx]) {
        var anchor = cfg.runtimeLevel.anchors[idx]; target = { x: anchor.x, y: anchor.y, r: 25 };
      }
    } else if (task.id === 'props') {
      var routeStep = Math.max(0, Number(state.propRouteStep) || 0);
      var walls = cfg.runtimeLevel.walls || [], bumpers = cfg.runtimeLevel.bumpers || [], anchors = cfg.runtimeLevel.anchors || [];
      var springId = String(cfg.runtimeLevel.tutorialRouteSpringId || 'tutorial_spring');
      var hazardId = String(cfg.runtimeLevel.tutorialRouteHazardId || 'tutorial_hazard');
      var anchorId = String(cfg.runtimeLevel.tutorialRouteAnchorId || 'a3');
      if (routeStep <= 0) {
        for (var wi = 0; wi < walls.length && !target; wi++) if (String(walls[wi].id || '') === springId && !walls[wi].removed) target = { x: walls[wi].x + walls[wi].w * 0.5, y: walls[wi].y + walls[wi].h * 0.5, r: Math.max(28, Math.min(64, Math.max(walls[wi].w, walls[wi].h) * 0.42)) };
      } else if (routeStep === 1) {
        for (var bi = 0; bi < bumpers.length && !target; bi++) if (String(bumpers[bi].id || '') === hazardId) target = { x: bumpers[bi].x, y: bumpers[bi].y, r: bumpers[bi].r + 12 };
      } else {
        for (var ai = 0; ai < anchors.length && !target; ai++) if (String(anchors[ai].id || '') === anchorId) target = { x: anchors[ai].x, y: anchors[ai].y, r: 27 };
      }
    }
    if (!target) return;
    var px = worldToScreenX(cfg.player.x, focusX), py = cfg.player.y;
    var tx = worldToScreenX(target.x, focusX), ty = target.y;
    ctx.save();
    ctx.globalAlpha = 0.74 + Math.sin(nowSec() * 8) * 0.20;
    ctx.strokeStyle = '#ff4f67'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tx, ty, target.r + Math.sin(nowSec() * 7) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // 2026-10-13 用户反馈：原版 7 团横向铺开（ox -34→+36）看着像「往左右两侧喷」。
  // 改为「团簇 + 柔边径向渐变」的云雾：云团聚拢在人物下方、彼此重叠，
  // 缓慢上浮 + 膨胀 + 极轻横向漂移，边缘用 radial gradient 化开成雾，整体像一朵蓬松的云。
  function drawMistPuff(px, py, r, alpha, warm) {
    var outerR = r * 1.75;
    var grad = ctx.createRadialGradient(px, py, r * 0.08, px, py, outerR);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.42, warm ? 'rgba(238,246,255,0.46)' : 'rgba(255,255,255,0.46)');
    grad.addColorStop(1, 'rgba(224,238,255,0)');
    ctx.fillStyle = grad;
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(px, py, outerR, 0, Math.PI * 2); ctx.fill();
  }

  function drawSnakeMaidCloudFart(focusX, player, progress) {
    var cx = worldToScreenX(player.x, focusX);
    var cy = player.y + player.r * 0.5;
    var t = nowSec();
    // 云团按「下-中-上」三层叠成团簇：底层撑起云体，中层向两侧自然蓬开（幅度收敛、彼此重叠），
    // 顶层蓬松；两翼（左右最外）最淡最柔，只作云雾轮廓，不再有「往两侧喷射」的实心球。
    var puffs = [
      { ox: -13, oy: 21, base: 15, seed: 0.4 },   // 底层·左
      { ox: 13, oy: 22, base: 15, seed: 1.1 },    // 底层·右
      { ox: -26, oy: 14, base: 14, seed: 1.8 },   // 中层·左（自然蓬开）
      { ox: 26, oy: 15, base: 14, seed: 2.5 },    // 中层·右
      { ox: 0, oy: 12, base: 18, seed: 3.2 },     // 中层·中（云体核心）
      { ox: -16, oy: 4, base: 12, seed: 3.9 },    // 顶层·左
      { ox: 15, oy: 5, base: 12, seed: 4.6 },     // 顶层·右
      { ox: -36, oy: 13, base: 13, seed: 5.3 },   // 两翼柔雾·左
      { ox: 36, oy: 14, base: 13, seed: 6.0 }     // 两翼柔雾·右
    ];
    ctx.save();
    for (var i = 0; i < puffs.length; i++) {
      var pf = puffs[i];
      var local = clamp(progress * 1.25 - i * 0.05, 0, 1);
      if (local <= 0) continue;
      var rise = local * 19;                                  // 云缓缓往上托
      var sway = Math.sin(t * 1.35 + pf.seed) * 3;            // 极轻横向漂移（不再左右甩）
      var r = pf.base * (0.6 + local * 0.8);                  // 慢慢蓬松开
      var edge = (pf.ox <= -36 || pf.ox >= 36) ? 0.55 : 1;    // 两翼更淡，做云雾柔边
      var a = (local < 0.25 ? local / 0.25 : Math.max(0, 1 - (local - 0.25) / 0.75)) * 0.82 * edge;
      drawMistPuff(cx + pf.ox + sway, cy + pf.oy - rise, r, a, i % 2 === 0);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFartBurst(focusX) {
    var player = cfg.player;
    if (!player || !(player.fartTimer > 0)) return;
    // 蛇娘走独立的白云分支（整段放屁时长都要有云，不能只用旧的 0.48s 窗口）。
    if (cfg.activeSkinId === 'bainiangzi' || cfg.activeSkinId === 'xiaoqing') {
      var fxTotal = (Number(player.fartBoostDuration) || 0.62) + 0.18;
      drawSnakeMaidCloudFart(focusX, player, clamp(1 - player.fartTimer / fxTotal, 0, 1));
      return;
    }
    var progress = clamp(1 - player.fartTimer / 0.48, 0, 1);
    var boostAngle = clamp(Number(player.fartBoostAngle) || 0, -Math.PI / 4, Math.PI / 4);
    var exhaustX = -Math.sin(boostAngle);
    var exhaustY = Math.cos(boostAngle);
    var sideX = -exhaustY;
    var sideY = exhaustX;
    var baseX = worldToScreenX(player.x, focusX) + exhaustX * 28;
    var baseY = player.y + exhaustY * 28;
    ctx.save();
    for (var i = 0; i < 5; i++) {
      var local = clamp(progress * 1.25 - i * 0.12, 0, 1);
      if (local <= 0) continue;
      var distance = i * 14 + local * 22;
      var wobble = Math.sin(nowSec() * 9 + i) * 4;
      var puffX = baseX + exhaustX * distance + sideX * wobble;
      var puffY = baseY + exhaustY * distance + sideY * wobble;
      var r = 7 + i * 2 + local * 5;
      ctx.globalAlpha = (1 - local) * 0.72;
      ctx.fillStyle = i % 2 ? '#c8d477' : '#9fc66c';
      ctx.beginPath(); ctx.arc(puffX, puffY, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function getActiveSkinVisual() {
    var skin = cfg.activeSkin || {};
    if (!skin.id) skin = { id: 'classic', name: '阿蜥', accentA: '#6ef0a7', accentB: '#53b76d', accentC: '#d8ff85' };
    return skin;
  }

  // —— 2026-10-05 用户要求：薯王两处绘制缩放（只影响视觉，不影响碰撞/舌长等几何）——
  // 360 图（挂锚点/瞄准/吐舌回收的空中姿态）绘制时缩小为 90%。
  function skin360DrawScale() {
    var skin = getActiveSkinVisual();
    return skin && skin.id === 'potato' ? 0.90 : 1;
  }
  // 翻滚图（平时滚动的团身球）绘制缩放。
  // 2026-10-05 晚（定稿）：薯王 1.3 倍 —— 视觉球径约 103px，比经典阿蜥(87px)大 18%、与蝠侠(104px)相当。
  // （历程 1.5 偏大 → 0.85 偏小 → 2.0 过大 → 1.4 仍略胖 → 1.3 定稿）
  // 蝠侠保持 1.2 倍。蝠侠的团身球还出现在死亡/放屁/空中(无360表回curl)分支，均乘本 helper 保持一致。
  function skinCurlDrawScale() {
    var skin = getActiveSkinVisual();
    if (!skin) return 1;
    if (skin.id === 'potato') return 1.3;
    if (skin.id === 'bat') return 1.2;
    // [2026-10-16] 白娘子团身球偏小：帧内容 142×120（扁形）、填充率最低，目检约为经典阿蜥的 75%
    //   → 绘制端放大 1.3 倍对齐经典阿蜥。素材端不能放大：最大帧已 142 / 160 格，再放大即越格串帧。
    // [2026-10-17 晚] 白娘子翻滚缩小约 5%（1.3 -> 1.235）。
    if (skin.id === 'bainiangzi') return 1.235;
    // [2026-10-17] 小青翻滚图比照白娘子大小：两表内容宽几乎一致（141 vs 142），
    //   白娘子有 1.3 补偿、小青没有导致屏上偏小 → 同给 1.3。
    if (skin.id === 'xiaoqing') return 1.3;
    return 1;
  }

  // [2026-10-17] 白娘子/小青放屁图调大 ~15%（此前沿用 2026-09-29 全皮肤 0.90 缩小，蛇娘专属图显小）。
  //   仅影响放屁姿态图，其余皮肤保持 1（即维持原 0.90）。
  function skinFartDrawScale() {
    var skin = getActiveSkinVisual();
    if (!skin) return 1;
    if (skin.id === 'bainiangzi' || skin.id === 'xiaoqing') return 1.15;
    return 1;
  }

  // 2026-10-09：过关（victory）表皮肤专属绘制缩放。图集内容已顶满 fit 高度，
  // 放大只能在绘制端做（改图会越格串帧）。薯王「放大一些些」= 1.15；
  // 蝠侠过关用滑翔图（16:29 用户要求）缩小为 1/2 = 0.5。
  function skinVictoryDrawScale() {
    var skin = getActiveSkinVisual();
    if (!skin) return 1;
    if (skin.id === 'potato') return 1.15;
    if (skin.id === 'bat') return 0.5;
    return 1;
  }
  // [2026-10-31 还原] 蝠侠滑翔图已换回原 4 帧动画图（单帧内容 296×196，正常比例）。
  // 之前为新图临时加过的 0.9 / 0.62×0.9 系数一并移除，滑翔缩放回到与其它皮肤一致的 0.62。
  function skinGlideDrawScale() {
    return 0.62;
  }

  // 2026-10-05 薯王：舌头＝从「头顶尖」伸出的一根紫薯色细线（用户要求「和外皮一样的颜色」）。
  // 薯王立绘整体是粗黑描边风格，所以这根线也带一层黑描边，才和身体画风一致。
  // 其它皮肤保持经典粉色舌头。w = 线宽系数（1 = 经典）。
  function tongueStyle() {
    var skin = getActiveSkinVisual();
    if (skin && skin.id === 'potato') {
      return { fill: '#c84860', outline: '#1a1016', w: 0.5, cap: 0.62 };
    }
    return { fill: '#ff6fa9', outline: null, w: 1, cap: 1 };
  }

  // 2026-09-30：改为数据驱动 —— 任何在 cfg.skinSpriteAssets 里登记过的皮肤自动走自己的美术，
  // 不必再为新皮肤加 if (id === 'xxx')。素材走 res_skins 分包按需解码，未 ready 时回退主精灵。
  function getSkinSpriteAsset(skinId) {
    var assets = cfg.skinSpriteAssets;
    if (!skinId || !assets) return null;
    var asset = assets[skinId];
    return (asset && asset.ready && !asset.failed) ? asset : null;
  }
  function getActiveSkinSpriteSource() {
    var skin = getActiveSkinVisual();
    var asset = getSkinSpriteAsset(skin && skin.id);
    if (asset) {
      return {
        asset: asset,
        manifest: (cfg.skinSpriteManifests && cfg.skinSpriteManifests[skin.id]) || (cfg.sprite && cfg.sprite.manifest) || {}
      };
    }
    return { asset: cfg.sprite, manifest: (cfg.sprite && cfg.sprite.manifest) || {} };
  }

  function getActiveAuxSpriteSource(kind, fallbackAsset, fallbackConfig) {
    var skin = getActiveSkinVisual();
    if (skin && skin.id) {
      var assets = cfg.skinAuxSpriteAssets && cfg.skinAuxSpriteAssets[skin.id];
      var configs = cfg.skinAuxConfigs && cfg.skinAuxConfigs[skin.id];
      var asset = assets && assets[kind];
      var config = configs && configs[kind];
      if (asset && asset.ready && !asset.failed && config) return { asset: asset, config: config, custom: true };
    }
    return { asset: fallbackAsset, config: fallbackConfig || {}, custom: false };
  }

  function drawSkinEmblem(type, size) {
    size = size || 14;
    ctx.save();
    if (type === 'crow_warning') {
      ctx.strokeStyle = '#101521'; ctx.lineWidth = Math.max(1.6, size * 0.12);
      for (var i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.moveTo(i * size * 0.75, -size * 0.15); ctx.lineTo(i * size * 0.22, size * 0.10); ctx.lineTo(i * size * 0.58, size * 0.55); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-size * 0.28, -size * 0.08, size * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.28, -size * 0.08, size * 0.16, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'vertical_rebound') {
      ctx.fillStyle = '#f4d35e';
      ctx.beginPath(); ctx.moveTo(0, -size * 0.70); ctx.lineTo(size * 0.18, -size * 0.15); ctx.lineTo(size * 0.72, -size * 0.12); ctx.lineTo(size * 0.26, size * 0.18); ctx.lineTo(size * 0.42, size * 0.72); ctx.lineTo(0, size * 0.35); ctx.lineTo(-size * 0.42, size * 0.72); ctx.lineTo(-size * 0.26, size * 0.18); ctx.lineTo(-size * 0.72, -size * 0.12); ctx.lineTo(-size * 0.18, -size * 0.15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#111722'; ctx.lineWidth = Math.max(1.6, size * 0.10); ctx.stroke();
    } else if (type === 'golden_phase') {
      ctx.fillStyle = '#79d65b'; ctx.beginPath(); ctx.ellipse(-size * 0.18, -size * 0.28, size * 0.25, size * 0.40, -0.55, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(size * 0.18, -size * 0.28, size * 0.25, size * 0.40, 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffbe55'; ctx.beginPath(); ctx.ellipse(0, 0, size * 0.46, size * 0.58, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#93511f'; ctx.lineWidth = Math.max(1.6, size * 0.10); ctx.stroke();
    } else if (type === 'flood_fountain') {
      // 白娘子·水漫金山：一朵向上喷起的大水柱（三股水箭 + 水花底座）
      ctx.strokeStyle = '#8fc9ff'; ctx.lineWidth = Math.max(1.6, size * 0.13); ctx.lineCap = 'round';
      for (var wj = -1; wj <= 1; wj++) {
        ctx.beginPath();
        ctx.moveTo(wj * size * 0.34, size * 0.52);
        ctx.quadraticCurveTo(wj * size * 0.46, -size * 0.10, wj * size * 0.20, -size * 0.74);
        ctx.stroke();
      }
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath(); ctx.ellipse(0, size * 0.62, size * 0.66, size * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3f7fbf'; ctx.lineWidth = Math.max(1.4, size * 0.09); ctx.stroke();
    } else if (type === 'greedy_tongue') {
      // 小青·超级贪吃：一条向外探出的长舌 + 舌尖卷住的小圆点
      ctx.strokeStyle = '#2f9e63'; ctx.lineWidth = Math.max(1.8, size * 0.16); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-size * 0.66, -size * 0.42);
      ctx.quadraticCurveTo(size * 0.06, -size * 0.10, size * 0.62, size * 0.30);
      ctx.stroke();
      ctx.fillStyle = '#7ce0a8';
      ctx.beginPath(); ctx.arc(size * 0.62, size * 0.30, size * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1f6f45'; ctx.lineWidth = Math.max(1.2, size * 0.08); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSkinCostumeOverlay(visual, x, y) {
    var skin = getActiveSkinVisual();
    if (!skin || skin.id === 'classic') return;
    // 2026-09-29 用户要求：有完整专属美术的皮肤不再叠加矢量兜底装扮（蛛侠的红蓝兜底已移除）。
    // 现扩展到蛛侠 / 白娘子 / 小青 —— 四套美术（360/蜷缩/胜利/放屁）齐全，兜底层只会画蛇添足。
    // 素材尚在解码时也直接跳过，避免短暂闪出兜底色块。
    if (cfg.skinSpriteAssets && cfg.skinSpriteAssets[skin.id]) return;
    // 2026-10-05 蝠侠：已有专属翻滚/滑翔美术（SKIN_AUX_SPECS），同样不再叠加矢量兜底装扮
    // （此前空中姿态会在经典阿蜥身上再画一层矢量蝙蝠，正是「替代图」残留）。
    if (cfg.skinAuxConfigs && cfg.skinAuxConfigs[skin.id]) return;
    var mode = visual && visual.mode ? visual.mode : 'sprite';
    var scale = visual && visual.scale ? visual.scale : 0.6;
    var rot = 0;
    if (mode === 'curl') rot = Number(visual.curlRotationOffset) || 0;
    else rot = Number(visual.spriteRotationOffset) || 0;
    if (mode === 'victory') scale = 0.72;
    if (mode === 'dizzy') scale = Math.max(scale, 0.60);
    if (cfg.player && (Number(cfg.player.fartTimer) || 0) > 0) rot = 0;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    ctx.globalAlpha *= 0.88;
    if (mode === 'curl') {
      var rr = 24 + scale * 7;
      ctx.fillStyle = skin.accentA || '#f25353'; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin.accentB || '#3259ff'; ctx.beginPath(); ctx.arc(0, rr * 0.15, rr * 0.78, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(12,14,20,.55)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, rr * 0.96, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(0, -3); drawSkinEmblem(skin.abilityType, 12 + scale * 3); ctx.restore();
      ctx.restore();
      return;
    }
    ctx.scale(scale, scale);
    if (skin.id === 'bat') {
      ctx.fillStyle = 'rgba(31,36,48,.92)'; ctx.beginPath(); ctx.ellipse(0, 6, 31, 28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(19,22,32,.74)'; ctx.beginPath(); ctx.moveTo(-28, -6); ctx.quadraticCurveTo(0, 44, 28, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(139,148,168,.62)'; ctx.beginPath(); ctx.ellipse(0, -18, 22, 16, 0, 0, Math.PI * 2); ctx.fill();
    } else if (skin.id === 'potato') {
      ctx.fillStyle = 'rgba(255,125,58,.92)'; ctx.beginPath(); ctx.ellipse(0, 4, 31, 28, -0.10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,85,.78)'; ctx.beginPath(); ctx.ellipse(2, 0, 22, 18, -0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(121,214,91,.88)'; ctx.beginPath(); ctx.ellipse(-9, -28, 8, 14, -0.55, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(8, -27, 8, 14, 0.55, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.translate(0, skin.id === 'bat' ? 0 : -1); drawSkinEmblem(skin.abilityType, 13); ctx.restore();
    ctx.restore();
  }

  function drawSkinPreviewAvatar(card, cx, cy, scale) {
    scale = scale || 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#5fd569'; ctx.beginPath(); ctx.ellipse(0, 7, 33, 29, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#72eb77'; ctx.beginPath(); ctx.ellipse(0, -12, 24, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-10, -14, 4.6, 0, Math.PI * 2); ctx.arc(10, -14, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#18211c'; ctx.beginPath(); ctx.arc(-10, -14, 2.2, 0, Math.PI * 2); ctx.arc(10, -14, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8aa3'; ctx.beginPath(); ctx.ellipse(0, -2, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (card && card.id !== 'classic') {
      var pseudoVisual = { mode: 'sprite', scale: 1.0, spriteRotationOffset: 0 };
      var previousSkin = cfg.activeSkin;
      cfg.activeSkin = card;
      drawSkinCostumeOverlay(pseudoVisual, 0, 3);
      cfg.activeSkin = previousSkin;
    }
    ctx.restore();
  }

  // 2026-09-30 v4：侧卡缩略图优先使用该皮肤**自己的精灵美术**（蛛侠 / 白娘子 / 小青）。
  // 素材在 res_skins 分包里按需解码，未就绪时返回 false 由调用方回退通用头像。
  // 装进与普通头像相同尺寸的预览槽后再绘制，保证外接框一致。
  // 背景：有专属美术的皮肤 drawSkinCostumeOverlay 直接 return，
  // 若不特判，它们侧卡会退回通用绿身 → 和经典阿蜥长得一模一样。
  // 返回 true 表示已按专属美术绘制；false 时由调用方回退到通用头像。
  function drawSkinOwnSpritePreview(card, cx, cy, boxW, boxH) {
    if (!card) return false;
    // 关键：必须查 cfg.skinSpriteAssets[card.id] 本身。
    // 不能用 getActiveSkinSpriteSource() 的结果 —— 它会对没有专属精灵的皮肤**回退到主精灵**
    // （cfg.sprite 恒 ready），那样蝠侠/番薯侠会把阿蜥的精灵图当自己的缩略图。
    var own = cfg.skinSpriteAssets && cfg.skinSpriteAssets[card.id];
    if (!own || !own.ready || own.failed) {
      // 2026-10-05：无 360 表但有专属翻滚表的皮肤（bat）→ 用翻滚表第 0 帧当头像，
      // 立绘解码间隙也不回落成通用绿色小人（那也是一张「替代图」）。
      var auxAssets = cfg.skinAuxSpriteAssets && cfg.skinAuxSpriteAssets[card.id];
      var auxCfgs = cfg.skinAuxConfigs && cfg.skinAuxConfigs[card.id];
      var curlA = auxAssets && auxAssets.curl, curlC = auxCfgs && auxCfgs.curl;
      if (!(curlA && curlA.ready && !curlA.failed && curlC)) return false;
      var cfw = Number(curlC.frameWidth) || 160, cfh = Number(curlC.frameHeight) || 160;
      var clw = Number(curlC.logicalFrameWidth) || 115.2, clh = Number(curlC.logicalFrameHeight) || 115.2;
      var ck = Math.min(boxW / clw, boxH / clh);
      if (!(ck > 0.0001)) return false;
      ctx.drawImage(curlA.image, 0, 0, cfw, cfh, cx - clw * ck * 0.5, cy - clh * ck * 0.5, clw * ck, clh * ck);
      return true;
    }
    var manifest = (cfg.skinSpriteManifests && cfg.skinSpriteManifests[card.id]) || {};
    var lw = Number(manifest.logicalFrameWidth) || Number(manifest.frameWidth) || 128;
    var lh = Number(manifest.logicalFrameHeight) || Number(manifest.frameHeight) || 128;
    var k = Math.min(boxW / lw, boxH / lh);
    if (!(k > 0.0001)) return false;
    var previousSkin = cfg.activeSkin;
    try {
      cfg.activeSkin = card;
      // frame 0：蛛侠 360 表里正对镜头的一帧，适合当头像。
      drawSpriteFrame(0, cx, cy, k, 0, null);
    } catch (e) { cfg.activeSkin = previousSkin; return false; }
    cfg.activeSkin = previousSkin;
    return true;
  }

  // 2026-09-30 用户要求：皮肤面板改用「正面站姿图」表示角色（不再播 360° 旋转 / 翻滚预览）。
  //   · classic → 开机动图（assets/sprites/axi_warmup_40f_160.png，40 帧循环播放）
  //   · 其余     → 一张正面站姿 PNG（蛛侠/蝠侠/薯王 = 首页图去背；白娘子/小青 = 人物设定稿正面去背）
  // 所有立绘都由「内容高度」归一，因此面板里每个皮肤看起来一样大 —— 这是用户反复提过的点。
  var PORTRAIT_CONTENT_FILL = 0.9375;   // 立绘画布里内容高占比（300 / 320）
  var WARMUP_CONTENT_H = 124;           // 开机动图里「站姿」的内容高（帧 160 内实测；取常见站姿帧 122~128 的中位）
  function drawSkinPortrait(card, cx, cy, boxW, boxH) {
    if (!card) return false;
    boxW = Math.max(1, Number(boxW) || 1);
    boxH = Math.max(1, Number(boxH) || 1);
    if (card.id === 'classic') {
      var spr = cfg.warmupSprite;
      var wc = cfg.warmupConfig || {};
      if (!spr || !spr.ready || !spr.image) return false;
      var fw = Number(wc.frameWidth) || 160;
      var fh = Number(wc.frameHeight) || 160;
      var count = Math.max(1, Number(wc.frameCount) || 40);
      var cols = Math.max(1, Number(wc.columns) || 8);
      var fps = Math.max(1, Number(wc.fps) || 8);
      var frame = Math.floor(nowSec() * fps) % count;
      // 只按「内容高度」归一：帧左上角有透明留白，按帧高缩放会让阿蜥明显比别的皮肤小一圈。
      var k = (boxH * PORTRAIT_CONTENT_FILL) / WARMUP_CONTENT_H;
      var dw = fw * k, dh = fh * k;
      ctx.drawImage(spr.image, (frame % cols) * fw, Math.floor(frame / cols) * fh, fw, fh,
                    cx - dw * 0.5, cy - dh * 0.5, dw, dh);
      return true;
    }
    var own = cfg.skinPortraitAssets && cfg.skinPortraitAssets[card.id];
    if (!own || !own.ready || own.failed || !own.image) return false;
    var iw = Number(own.image.width) || 260;
    var ih = Number(own.image.height) || 320;
    var kk = Math.min(boxW / iw, boxH / ih);
    if (!(kk > 0.0001)) return false;
    ctx.drawImage(own.image, cx - iw * kk * 0.5, cy - ih * kk * 0.5, iw * kk, ih * kk);
    return true;
  }

  // 立绘缺失（分包还没解码完）时的兜底：沿用老的 360 精灵首帧，最后再退到通用头像，
  // 保证面板任何时刻都不会出现空卡片。
  function drawSkinPortraitFallback(card, cx, cy, boxW, boxH) {
    if (drawSkinOwnSpritePreview(card, cx, cy, boxW, boxH)) return true;
    if (card && card.id === 'classic') return false;
    var avatarScale = Math.min(boxW / 66, boxH / ((card && card.id === 'potato') ? 75 : 66));
    drawSkinPreviewAvatar(card, cx, cy, avatarScale);
    return true;
  }

  // [2026-10-31] 需求5：绘制某皮肤指定类型的缩略图（portrait/curl/victory/fart/glide 首帧）
  function drawSkinPreviewThumb(card, kind, cx, cy, size) {
    if (!card) return false;
    if (kind === 'portrait') return drawSkinPortrait(card, cx, cy, size, size);
    var assets = cfg.skinAuxSpriteAssets && cfg.skinAuxSpriteAssets[card.id];
    var cfgs = cfg.skinAuxConfigs && cfg.skinAuxConfigs[card.id];
    var asset = assets && assets[kind];
    var cfgK = cfgs && cfgs[kind];
    if (!asset || !asset.ready || asset.failed || !asset.image || !cfgK) return false;
    var fw = Number(cfgK.frameWidth) || 160, fh = Number(cfgK.frameHeight) || 160;
    var lw = Number(cfgK.logicalFrameWidth) || fw, lh = Number(cfgK.logicalFrameHeight) || fh;
    var k = Math.min(size / lw, size / lh);
    if (!(k > 0.0001)) return false;
    ctx.drawImage(asset.image, 0, 0, fw, fh, cx - lw * k * 0.5, cy - lh * k * 0.5, lw * k, lh * k);
    return true;
  }

  function wrapTextLines(text, maxWidth, maxLines, font) {
    text = String(text || '');
    maxWidth = Math.max(10, Number(maxWidth) || 10);
    maxLines = Math.max(1, Number(maxLines) || 1);
    var oldFont = ctx.font;
    if (font) ctx.font = font;
    var lines = [];
    var current = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
        if (lines.length >= maxLines - 1) break;
      } else current = test;
    }
    if (lines.length < maxLines && current) lines.push(current);
    var used = lines.join('').length;
    if (used < text.length && lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/.$/, '') + '…';
    ctx.font = oldFont;
    return lines;
  }

  // 2026-09-30 起废弃：面板不再播 360° 旋转 / 翻滚预览，统一改走 drawSkinPortrait（正面站姿立绘）。
  // 原 drawSkinAnimatedPreview 保留在此仅作历史记录，已无调用点。
  // function drawSkinAnimatedPreview(card, cx, cy, scale) { ... }

  // 2026-09-30 三侠版：仿 3D 滚轮单张卡片。
  // 2026-09-30 修正：取消横向斜切（skew）——斜切会把卡片四角推出面板边框，
  // 且视觉上像"歪倒"，用户明确要求两侧卡片保持直立。现仅用 scale/alpha/下沉做纵深。
  // 卡面与文字在局部坐标系绘制（随 scale 整体缩放）；
  // 角色预览依赖内部绝对坐标，放在 restore 之后按世界坐标绘制。
  // side：0 = 中央卡；-1 / +1 = 左右侧卡。侧卡内缩在面板里、外侧会被中央卡压住，
  // 因此把文字与角色整体向卡片外侧偏移，使内容落在「可见区」中央，既不被遮挡也贴住面板内壁。
  function drawSkinWheelCard(card, cx, cy, scale, alpha, isCenter, side) {
    if (!card) return;
    scale = Math.max(0.05, Number(scale) || 1);
    var w = 236 * scale, h = 250 * scale;
    var sideShift = isCenter ? 0 : (Number(side) || 0) * w * 0.26;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, Number(alpha) || 1));
    ctx.translate(cx, cy);

    if (isCenter) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22 * scale; ctx.shadowOffsetY = 8 * scale; }
    roundRect(ctx, -w * 0.5, -h * 0.5, w, h, 26 * scale);
    ctx.fillStyle = isCenter ? 'rgba(16,31,47,.99)' : 'rgba(13,24,37,.94)';
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = isCenter
          ? (card.equipped ? 'rgba(110,240,167,.92)' : 'rgba(139,216,255,.58)')
          : 'rgba(139,216,255,.28)';
    ctx.lineWidth = (isCenter ? 3 : 2) * scale;
    ctx.stroke();
    if (isCenter) {
      roundRect(ctx, -w * 0.5 + 8 * scale, -h * 0.5 + 8 * scale, w - 16 * scale, h - 16 * scale, 20 * scale);
      ctx.strokeStyle = 'rgba(255,216,95,.28)'; ctx.lineWidth = 2 * scale; ctx.stroke();
    }

    ctx.textAlign = 'center';
    // 极淡的外侧环绕卡（alpha 很低）不画文字，避免与相邻卡片的名字叠成重影。
    var showText = isCenter || (Number(alpha) || 1) >= 0.32;
    if (showText && (isCenter || card.equipped)) {
      ctx.fillStyle = card.equipped ? '#6ef0a7' : '#8bd8ff';
      ctx.font = 'bold ' + Math.max(9, 13 * scale) + 'px ' + UI_FONT;
      ctx.fillText(isCenter ? (card.equipped ? '当前穿戴' : '皮肤预览') : '已穿戴',
                   sideShift, -h * 0.5 + 27 * scale);
    }
    if (showText) {
      ctx.fillStyle = isCenter ? '#ffffff' : 'rgba(255,255,255,.86)';
      ctx.font = 'bold ' + Math.max(11, 27 * scale) + 'px ' + UI_FONT;
      ctx.fillText(card.name, sideShift, -h * 0.5 + 57 * scale);
      if (isCenter) {
        ctx.fillStyle = '#8bd8ff';
        ctx.font = 'bold ' + Math.max(9, 13 * scale) + 'px ' + UI_FONT;
        ctx.fillText(card.title || '', 0, -h * 0.5 + 78 * scale);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.42)';
        ctx.font = 'bold ' + Math.max(8, 11 * scale) + 'px ' + UI_FONT;
        ctx.fillText('点击切换', sideShift, h * 0.5 - 14 * scale);
      }
    }
    ctx.restore();

    // 角色预览：2026-09-30 起统一走「正面站姿立绘」。
    //   中央卡 → 大立绘（阿蜥播开机动图）
    //   侧卡   → 同一个立绘装进小预览槽
    // 立绘按内容高度归一，所以同屏所有卡片的角色高度完全一致。
    var SIDE_PREVIEW_W = 76;    // 预览槽宽（×scale）
    var SIDE_PREVIEW_H = 72;    // 预览槽高（×scale）
    var SIDE_PREVIEW_DY = 16;   // 槽中心相对卡片中心的偏移（×scale）
    var CENTER_PREVIEW_W = 112; // 中央卡立绘盒（×scale），宽高比与立绘画布 260:320 一致
    var CENTER_PREVIEW_H = 138;
    var CENTER_PREVIEW_DY = 40;
    if (isCenter) {
      var cBoxW = CENTER_PREVIEW_W * scale;
      var cBoxH = CENTER_PREVIEW_H * scale;
      var cCy = cy + CENTER_PREVIEW_DY * scale;
      if (!drawSkinPortrait(card, cx, cCy, cBoxW, cBoxH)) {
        drawSkinPortraitFallback(card, cx, cCy, cBoxW, cBoxH);
      }
    } else {
      var previewCx = cx + sideShift;
      var previewCy = cy + SIDE_PREVIEW_DY * scale;
      var boxW = SIDE_PREVIEW_W * scale;
      var boxH = SIDE_PREVIEW_H * scale;
      if (!drawSkinPortrait(card, previewCx, previewCy, boxW, boxH)) {
        drawSkinPortraitFallback(card, previewCx, previewCy, boxW, boxH);
      }
    }
  }

  function drawSkinPanelOverlay() {
    if (!cfg.skinPanelOpen) return;
    var cards = cfg.skinCards || [];
    if (!cards.length) return;
    var selectedIndex = Math.max(0, Math.min(cards.length - 1, Math.round(Number(cfg.skinPanelIndex) || 0)));
    var selected = cards[selectedIndex] || cards[0];
    // 2026-09-30 三侠版：滚轮不再只取「左中右」三张，改为按连续滚动位置绘制整圈卡片。

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 紧凑版皮肤弹窗：内容结束即收口，不保留大块空白。
    // 2026-09-30 三侠版 v2：去掉顶部「皮肤」大标题与小字说明，内容整体上移，
    // 面板高度同步压缩 610 → 548，使上下留白均匀（顶部 29px / 底部 27px）。
    var panel = { x: 24, y: 82, w: VIEW_W - 48, h: 636 };
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 30);
    ctx.fillStyle = 'rgba(8,17,28,.985)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,216,95,.84)'; ctx.lineWidth = 3; ctx.stroke();

    // 关闭钮刻意向左下避开微信右上系统操作区域；实际点击热区比图形更大。
    hotspots.skinPanelClose = { x: panel.x + panel.w - 48, y: panel.y + 43, r: 34 };
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.arc(hotspots.skinPanelClose.x, hotspots.skinPanelClose.y, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.78)'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(hotspots.skinPanelClose.x - 7, hotspots.skinPanelClose.y - 7); ctx.lineTo(hotspots.skinPanelClose.x + 7, hotspots.skinPanelClose.y + 7);
    ctx.moveTo(hotspots.skinPanelClose.x + 7, hotspots.skinPanelClose.y - 7); ctx.lineTo(hotspots.skinPanelClose.x - 7, hotspots.skinPanelClose.y + 7);
    ctx.stroke();

    // 2026-09-30 三侠版 v2：按用户要求移除顶部「皮肤」大标题与「左右切换皮肤 · 点击穿戴确认使用」小字，
    // 让滚轮直接顶到面板上部，消除顶部空白。
    ctx.textAlign = 'center';

    // 2026-09-30 三侠版：仿 3D 滚轮。以连续滚动位置驱动 —— 中间卡片最大最亮，
    // 两侧按环绕距离连续缩小 / 变暗 / 下沉，形成横向纵深。
    // 2026-09-30 修正：去掉斜切；纵深系数加大（0.34→0.70）让外侧收缩更快，
    // 并加「包围盒硬边界」兜底 —— 侧卡一旦顶到面板内壁就不绘制，保证滚轮两侧永不越出边框。
    // 2026-09-30 三侠版 v2：滚轮上移 74px（原 panel.y+220 → +146），
    // 中央卡顶边距面板顶 29px，与底部留白对称。
    var wheelY = panel.y + 146;
    var wheelCx = VIEW_W * 0.5;
    var wheelCy = wheelY + 8;
    var wheelScroll = Number(cfg.skinWheelScroll);
    if (!isFinite(wheelScroll)) wheelScroll = selectedIndex;
    var wheelCount = cards.length;
    var WHEEL_STEP_X = 196;      // 相邻卡片基础横向间距（再乘透视权重压缩）
    var WHEEL_DEPTH_K = 0.70;    // 纵深衰减系数：越大 → 外侧收缩越快、越不容易顶到边框
    var WHEEL_MAX_DIST = 2.0;    // 超过该环绕距离不再绘制（4 张卡时全部参与环绕）
    var WHEEL_HALF_W = 118;      // 卡片基准半宽（236 / 2）
    var WHEEL_HALF_H = 125;      // 卡片基准半高（250 / 2）
    var WHEEL_INNER_L = panel.x + 6;              // 卡片包围盒硬边界（面板内壁，留 6px 呼吸位）
    var WHEEL_INNER_R = panel.x + panel.w - 6;

    // 先算每张卡的环绕距离，再由远及近绘制，保证中央卡片压在最上层。
    var wheelItems = [];
    for (var ci = 0; ci < wheelCount; ci++) {
      var rawD = ci - wheelScroll;
      var wheelD = rawD - wheelCount * Math.round(rawD / wheelCount);
      if (Math.abs(wheelD) <= WHEEL_MAX_DIST) wheelItems.push({ card: cards[ci], d: wheelD });
    }
    wheelItems.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });

    // 地面椭圆投影：强化「卡片站在同一水平面上旋转」的假 3D 观感。
    // 2026-09-30 v3：左右箭头下移到 y=368 后，原本 rx=208 的椭圆左端(62,340)几乎贴到箭头，
    // 故收窄到 188/144，让弧线与圆钮之间留出呼吸位。
    ctx.strokeStyle = 'rgba(139,216,255,.16)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(wheelCx, wheelCy + 104, 188, 46, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(139,216,255,.07)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(wheelCx, wheelCy + 104, 144, 33, 0, Math.PI, Math.PI * 2); ctx.stroke();

    for (var wi = 0; wi < wheelItems.length; wi++) {
      var wheelItem = wheelItems[wi];
      var wheelAbs = Math.abs(wheelItem.d);
      var wheelDepth = 1 / (1 + wheelAbs * WHEEL_DEPTH_K);   // 透视权重：中心 1 → 越远越小
      var wheelScale = 0.30 + 0.70 * wheelDepth;
      // 压暗 + 越过第一张后快速淡出，避免卡片在边界处突兀消失。
      var wheelAlpha = Math.max(0, Math.min(1, 1 - wheelAbs * 0.22 - Math.max(0, wheelAbs - 1) * 0.45));
      if (wheelAlpha <= 0.02) continue;
      var wheelX = wheelCx + wheelItem.d * WHEEL_STEP_X * wheelDepth;
      var wheelCardY = wheelCy + wheelAbs * 22 * wheelDepth;
      var wheelHalfW = WHEEL_HALF_W * wheelScale;
      var wheelIsCenter = wheelAbs < 0.5;
      // 硬约束：包围盒越出面板内壁的卡片直接跳过（中央卡位置固定，不会触发）。
      if (!wheelIsCenter &&
          (wheelX - wheelHalfW < WHEEL_INNER_L || wheelX + wheelHalfW > WHEEL_INNER_R)) continue;
      var wheelSide = wheelIsCenter ? 0 : (wheelItem.d < 0 ? -1 : 1);
      drawSkinWheelCard(wheelItem.card, wheelX, wheelCardY, wheelScale, wheelAlpha, wheelIsCenter, wheelSide);
    }

    // 点击热区：侧卡「点一下即滚到中间」；中央卡不注册热区，专留给跟手拖拽。
    // 热区只覆盖侧卡的「可见区」（中央卡左/右边界到侧卡外边），既不与中央卡抢点击，
    // 也不把中央卡区域的点按误判成翻页。
    var wheelD1Depth = 1 / (1 + WHEEL_DEPTH_K);
    var wheelSideX = WHEEL_STEP_X * wheelD1Depth;
    var wheelSideScale = 0.30 + 0.70 * wheelD1Depth;
    var wheelSideHalfW = WHEEL_HALF_W * wheelSideScale;
    var wheelSideY = wheelCy + 22 * wheelD1Depth;
    var wheelSideH = WHEEL_HALF_H * wheelSideScale * 2;
    var wheelVisibleInner = wheelCx - WHEEL_HALF_W;                       // 中央卡左边界
    var wheelSideOuter = wheelCx - wheelSideX - wheelSideHalfW;           // 侧卡左边界
    var wheelSideMid = (wheelSideOuter + wheelVisibleInner) * 0.5;
    var wheelSideVisW = Math.max(72, wheelVisibleInner - wheelSideOuter);
    hotspots.skinWheelLeftCard = { x: wheelSideMid, y: wheelSideY, w: wheelSideVisW, h: wheelSideH };
    hotspots.skinWheelRightCard = { x: VIEW_W - wheelSideMid, y: wheelSideY, w: wheelSideVisW, h: wheelSideH };

    // 左右箭头。
    // 2026-09-30 三侠版 v2：用户反馈「左右按钮出框了」。
    // 原圆心 x=47 / r=27 → 左外缘 20，而面板外边界 24、金框内缘 25.5，箭头整体压出弹窗。
    // v2 第一次修到 panel.x+33（外缘 30），距金框内缘仅 4.5px，视觉上仍像贴着边。
    // v2 第二次（当前）：内移到 panel.x+42=66 → 外缘 [39, 93]，距金框内缘 13.5px，
    // 右侧镜像 [447, 501]，左右完全对称，明确落在框内。
    // 与侧卡热区有约 22px 重叠，但 core 端 prev/next 与左/右侧卡是「或」判定且方向一致，
    // 不会产生歧义（见 core_runtime.js handlePress 中 skinWheelPrev || skinWheelLeftCard）。
    // 2026-09-30 v3（用户反馈「左右按键不要与选单重叠」）：
    // 原 y = wheelY+18 = wheelCy+10，正好落在侧卡垂直中心 → 圆钮压在卡片上。
    // 现整体下移到「滚轮最低点」与「能力框顶边(400)」之间的空白带里居中：
    //   侧卡最低点 = wheelCy + 22×0.588 + 125×0.712 ≈ 338，能力框顶 400 → 取 368（圆心）。
    // 半径 27→24（与右上角关闭钮同视觉量级），与卡片留 6px、与能力框留 8px 呼吸位。
    // 点击热区单独放大到 30（触控更友好）；core 端 prev 与左侧卡是「或」判定且方向一致，
    // 热区略大不会产生点击歧义（见 core_runtime.js handlePress）。
    var SKIN_WHEEL_ARROW_INSET = 42;
    var SKIN_WHEEL_ARROW_R = 24;
    var SKIN_WHEEL_ARROW_HIT_R = 30;
    var arrowY = wheelCy + 132;
    var arrowLeft = { x: panel.x + SKIN_WHEEL_ARROW_INSET, y: arrowY, r: SKIN_WHEEL_ARROW_R, dir: -1 };
    var arrowRight = { x: VIEW_W - panel.x - SKIN_WHEEL_ARROW_INSET, y: arrowY, r: SKIN_WHEEL_ARROW_R, dir: 1 };
    hotspots.skinWheelPrev = { x: arrowLeft.x, y: arrowY, r: SKIN_WHEEL_ARROW_HIT_R, drawR: SKIN_WHEEL_ARROW_R };
    hotspots.skinWheelNext = { x: arrowRight.x, y: arrowY, r: SKIN_WHEEL_ARROW_HIT_R, drawR: SKIN_WHEEL_ARROW_R };
    [arrowLeft, arrowRight].forEach(function(btn) {
      ctx.fillStyle = 'rgba(255,216,95,.15)'; ctx.beginPath(); ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,216,95,.68)'; ctx.lineWidth = 2; ctx.stroke();
      // 白色箭头：按半径等比缩放，避免圆钮变小后箭头比例失真。
      var arm = btn.r * 0.36, half = btn.r * 0.22;
      var tipX = btn.x + btn.dir * half, backX = btn.x - btn.dir * (half + 2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(backX, btn.y - arm); ctx.lineTo(tipX, btn.y); ctx.lineTo(backX, btn.y + arm);
      ctx.stroke();
    });

    // 能力说明：放大、居中；不显示解锁状态或自动保存说明。
    // 2026-09-30 三侠版 v2：随滚轮上移，infoY 374 → 318，使滚轮底与能力框保持 10px 呼吸位。
    var infoY = panel.y + 318;
    var infoH = 174;
    roundRect(ctx, panel.x + 34, infoY, panel.w - 68, infoH, 22);
    ctx.fillStyle = 'rgba(255,255,255,.055)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 20px ' + UI_FONT;
    ctx.fillText('能力', VIEW_W * 0.5, infoY + 30);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px ' + UI_FONT;
    var abilityLines = wrapTextLines(selected.description, panel.w - 120, 3, 'bold 18px ' + UI_FONT);
    var abilityStartY = infoY + 62;
    for (var li = 0; li < abilityLines.length; li++) {
      ctx.fillText(abilityLines[li], VIEW_W * 0.5, abilityStartY + li * 25);
    }

    // 居中的“穿戴 / 购买”确认按钮。
    var wearBtn = { x: VIEW_W * 0.5, y: infoY + 145, w: 184, h: 42 };
    hotspots.skinWearButton = wearBtn;
    var wearLabel = selected.equipped ? '✓ 已穿戴' : '穿戴';
    var wearFill, wearStroke, wearText;
    if (selected.owned) {
      wearFill = selected.equipped ? 'rgba(68,178,122,.84)' : '#ffbd32';
      wearStroke = selected.equipped ? '#6ef0a7' : '#fff0a5';
      wearText = selected.equipped ? '#ffffff' : '#3a2300';
    } else if (selected.price > 0) {
      // [2026-10-31] 需求8/116 商业化：定价皮肤展示购买按钮（支付桩预留，当前仍免费解锁）。
      wearLabel = '¥' + selected.price + ' 购买';
      wearFill = 'rgba(110,240,167,.92)';
      wearStroke = '#6ef0a7';
      wearText = '#06351f';
    } else {
      wearFill = 'rgba(255,255,255,.13)';
      wearStroke = 'rgba(255,255,255,.20)';
      wearText = 'rgba(255,255,255,.52)';
    }
    roundRect(ctx, wearBtn.x - wearBtn.w * 0.5, wearBtn.y - wearBtn.h * 0.5, wearBtn.w, wearBtn.h, 18);
    ctx.fillStyle = wearFill;
    ctx.fill();
    ctx.strokeStyle = wearStroke;
    ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = wearText;
    ctx.font = 'bold 19px ' + UI_FONT;
    // 2026-09-29 用户要求：已穿戴时按钮显示「✓ 已穿戴」。
    // 2026-09-30 隐藏角色：按钮置为「未开放」（卡片本身 owned=false，走灰色样式）。
    ctx.fillText(wearLabel, wearBtn.x, wearBtn.y + 7);
    // [2026-10-31] 商业化：定价且未拥有的皮肤，在按钮上方显示「免费获取方式」提示（解锁条件）。
    if (!selected.owned && selected.price > 0 && selected.progressText) {
      ctx.fillStyle = 'rgba(255,255,255,.62)';
      ctx.font = '13px ' + UI_FONT;
      ctx.fillText(selected.progressText, VIEW_W * 0.5, wearBtn.y - wearBtn.h * 0.5 - 12);
    }

    // [2026-10-31] 需求5：当前角色的各种图片（站姿/翻滚/过关/放屁/滑翔）缩略图横排展示
    var pvY = infoY + infoH + 34;
    var pvItems = (selected && selected.previews) || [{ type: 'portrait', label: '站姿' }];
    var pvN = pvItems.length;
    var pvGap = 16;
    var pvThumb = 58;
    var pvTotalW = pvN * pvThumb + (pvN - 1) * pvGap;
    var pvStartX = VIEW_W * 0.5 - pvTotalW * 0.5 + pvThumb * 0.5;
    ctx.textAlign = 'center';
    for (var pvi = 0; pvi < pvN; pvi++) {
      var pv = pvItems[pvi];
      var pxc = pvStartX + pvi * (pvThumb + pvGap);
      roundRect(ctx, pxc - pvThumb * 0.5 - 4, pvY - pvThumb * 0.5 - 4, pvThumb + 8, pvThumb + 8, 10);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,216,95,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (!drawSkinPreviewThumb(selected, pv.type, pxc, pvY, pvThumb)) {
        drawSkinPortraitFallback(selected, pxc, pvY, pvThumb, pvThumb);
      }
      ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 12px ' + UI_FONT;
      ctx.fillText(pv.label, pxc, pvY + pvThumb * 0.5 + 15);
    }

    // 圆点紧贴内容区，不在弹窗底部留下大面积空白。
    var dotY = infoY + infoH + 104;
    var dotStart = VIEW_W * 0.5 - (cards.length - 1) * 13;
    for (var di = 0; di < cards.length; di++) {
      ctx.fillStyle = di === selectedIndex ? '#ffd85f' : 'rgba(255,255,255,.24)';
      ctx.beginPath(); ctx.arc(dotStart + di * 26, dotY, di === selectedIndex ? 6 : 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawCrowWarningOverlay() {
    var warning = cfg.crowWarning || {};
    if (!(warning.timer > 0) || cfg.scene !== 'playing') return;
    // 2026-09-29 二次调整（按用户标注图）：
    //  ① 红框只框游戏场景区：顶边贴 HUD(98px) 下缘、底部留出屏幕底缘，左右小内缩；
    //  ② 框线内外双向红色渐层模糊（向外窄晕 + 向内宽晕）+ 辉光；
    //  ③ 「危险靠近」居中放在红框顶边上方（骑线）；
    //  ④ 新增：闪烁箭头指向乌鸦将出现的一侧与其高度。
    var fadeIn = clamp(Number(warning.timer) / 0.28, 0, 1);
    var blinkPhase = (nowSec() % 0.42) / 0.42;   // 0.42s 周期警报式闪烁
    var blink = blinkPhase < 0.62 ? 1 : 0.22;
    var alpha = fadeIn * blink;

    // 2026-09-29 三次调整（用户反馈）：红框实线紧贴场景区边缘；模糊渐层只保留红框内圈，取消外侧晕与线体外扩辉光。
    var FX = 0;               // 左右紧贴屏幕边缘
    var FT = 98;              // 顶边：贴 HUD(98px) 下缘
    var FB = VIEW_H;          // 底边：贴屏幕底缘
    var IN_GLOW = 70;         // 向内渐层宽度（唯一的模糊效果，只在内圈）
    var fw2 = VIEW_W - FX * 2, fh2 = FB - FT;

    ctx.save();
    var gaIn = (0.34 * alpha).toFixed(3);
    function warnGrad(x0, y0, x1, y1, a0) {
      var g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(255,44,44,' + a0 + ')');
      g.addColorStop(1, 'rgba(255,44,44,0)');
      return g;
    }
    // —— 向内宽渐层（只画框内）——
    ctx.fillStyle = warnGrad(0, FT, 0, FT + IN_GLOW, gaIn);
    ctx.fillRect(FX, FT, fw2, IN_GLOW);
    ctx.fillStyle = warnGrad(0, FB, 0, FB - IN_GLOW, gaIn);
    ctx.fillRect(FX, FB - IN_GLOW, fw2, IN_GLOW);
    ctx.fillStyle = warnGrad(FX, 0, FX + IN_GLOW, 0, gaIn);
    ctx.fillRect(FX, FT, IN_GLOW, fh2);
    ctx.fillStyle = warnGrad(VIEW_W - FX, 0, VIEW_W - FX - IN_GLOW, 0, gaIn);
    ctx.fillRect(VIEW_W - FX - IN_GLOW, FT, IN_GLOW, fh2);

    // —— 红框实线（紧贴边缘、锐利无外扩辉光）——
    ctx.strokeStyle = 'rgba(255,60,60,' + (0.9 * alpha).toFixed(3) + ')';
    ctx.lineWidth = 3;
    ctx.strokeRect(FX, FT, fw2, fh2);

    // —— 「危险靠近」：红框顶边中央、骑线 ——
    var title = String(warning.title || '危险靠近');
    var fs = 25, tracking = 7;
    ctx.font = 'bold ' + fs + 'px ' + UI_FONT;
    var widths = [], total = 0, i;
    for (i = 0; i < title.length; i++) { widths.push(ctx.measureText(title.charAt(i)).width); total += widths[i] + tracking; }
    total -= tracking;
    var boxPadX = 12, boxPadY = 8;
    var boxW = total + boxPadX * 2 + 10;
    var boxH = fs + boxPadY * 2;
    var boxCx = VIEW_W * 0.5;
    var boxTop = FT - boxH * 0.5;
    // 平行四边形暗色 HUD 底板（斜角与文字斜切一致）
    ctx.beginPath();
    ctx.moveTo(boxCx - boxW * 0.5 + 8, boxTop);
    ctx.lineTo(boxCx + boxW * 0.5 + 2, boxTop);
    ctx.lineTo(boxCx + boxW * 0.5 - 8, boxTop + boxH);
    ctx.lineTo(boxCx - boxW * 0.5 - 2, boxTop + boxH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(12,10,16,' + (0.62 * alpha).toFixed(3) + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,86,86,' + (0.6 * alpha).toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    var ty = boxTop + boxH * 0.5 + 1;
    var k = 0.16;
    ctx.transform(1, 0, -k, 1, 0, 0);
    var tx = boxCx - total * 0.5 + k * ty;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    function warnDrawChars(fillStyle, strokeStyle) {
      var x = tx;
      for (i = 0; i < title.length; i++) {
        if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fillText(title.charAt(i), x, ty); }
        if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = 1.2; ctx.strokeText(title.charAt(i), x, ty); }
        x += widths[i] + tracking;
      }
    }
    warnDrawChars('rgba(255,236,236,' + alpha.toFixed(3) + ')', null);
    warnDrawChars(null, 'rgba(255,222,64,' + (0.9 * alpha).toFixed(3) + ')');
    ctx.restore();

    // —— 指向乌鸦出现位置的闪烁箭头（不受文字斜切 transform 影响，单独 save/restore）——
    ctx.save();
    var ay = clamp(Number(warning.y) || VIEW_H * 0.35, FT + 70, FB - 70);
    var fromRight = String(warning.side || 'right') === 'right';
    var ax = fromRight ? (VIEW_W - FX - 34) : (FX + 34);
    var dir = fromRight ? -1 : 1;   // -1：箭头朝左（乌鸦从右侧进入）
    ctx.translate(ax, ay);
    ctx.scale(dir, 1);
    ctx.shadowColor = 'rgba(255,44,44,' + (0.95 * alpha).toFixed(3) + ')';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,64,64,' + alpha.toFixed(3) + ')';
    ctx.beginPath();               // 箭头 = 三角头 + 短箭杆
    ctx.moveTo(-30, 0);
    ctx.lineTo(-2, -19);
    ctx.lineTo(-2, -7);
    ctx.lineTo(30, -7);
    ctx.lineTo(30, 7);
    ctx.lineTo(-2, 7);
    ctx.lineTo(-2, 19);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,222,64,' + (0.75 * alpha).toFixed(3) + ')';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // —— 皮肤能力特效（画在角色之前，作为背景层，不遮挡角色本身）——


  // 2026-10-05 蝠侠·滑翔：身后金色速度线，呼应展翼滑翔的姿态（无文字提示，按用户要求）。
  function drawBatGlideAura(sx, py, alpha) {
    if (!isFinite(sx) || !isFinite(py)) return;
    var t = (typeof cfg.nowSec === 'function' ? Number(cfg.nowSec()) : 0) || 0;
    var dir = (Number(cfg.player.faceDir) || 1) >= 0 ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = '#f4d35e';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var phase = (t * 2.4 + i * 0.5) % 1;
      var len = 26 - phase * 18;
      var off = 14 + phase * 30;
      var yy = py + (i - 1) * 9;
      var x0 = sx - dir * off, x1 = x0 - dir * len;
      ctx.globalAlpha = alpha * 0.5 * (1 - phase);
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
    }
    ctx.restore();
  }

  // 2026-10-01 白娘子·水漫金山：脚下升起的大喷泉（竖向水柱 + 四散水花）。
  function drawFloodFountain(fx) {
    if (!fx || !fx.active) return;
    var life = Math.max(0.001, Number(fx.duration) || 1);
    var p = clamp(Number(fx.timer) / life, 0, 1);
    var sx = worldToScreenX(fx.x);
    var baseY = fx.y;
    var height = 300 * (1 - Math.pow(1 - p, 2));
    ctx.save();
    ctx.globalAlpha = 0.85 * (1 - p * 0.55);
    var grad = ctx.createLinearGradient(0, baseY, 0, baseY - height);
    grad.addColorStop(0, 'rgba(143,201,255,.95)');
    grad.addColorStop(0.55, 'rgba(223,243,255,.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx - 30, baseY);
    ctx.quadraticCurveTo(sx - 16, baseY - height * 0.6, sx - 6, baseY - height);
    ctx.lineTo(sx + 6, baseY - height);
    ctx.quadraticCurveTo(sx + 16, baseY - height * 0.6, sx + 30, baseY);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(63,127,191,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
    // 底座水花
    ctx.fillStyle = 'rgba(234,246,255,.85)';
    ctx.beginPath(); ctx.ellipse(sx, baseY - 4, 46 + p * 26, 14 + p * 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 2026-10-01 杭州彩蛋：漫画风可爱蛇形（蛇头由手指驱动，蛇身跟随摆动）。
  function drawSnakeForm(state) {
    if (!state || !state.active) return;
    // 【真蛇 V1】优先用真实白/青蛇 PNG 做分段蒙皮渲染（S 型摆动 + 蛇信 + 头部刚性）；
    // 素材未加载/失败时返回 false，下方原卡通蛇兜底绘制，绝不黑屏。
    if (realSnake.drawWithStatus(ctx, state, worldToScreenX)) return;
    var qing = state.kind === 'qing';
    var bodyA = qing ? '#2f9e63' : '#dff0fb';
    var bodyB = qing ? '#7ce0a8' : '#ffffff';
    var outline = qing ? '#155c37' : '#4b7fa6';
    var sx = worldToScreenX(state.headX);
    var hy = state.headY;
    var t = Number(state.phase) || 0;
    var facing = Number(state.facing) || 1;

    // 收集蛇身关节点：头 + 各节
    var pts = [{ x: sx, y: hy }];
    var segs = state.segments || [];
    for (var i = 0; i < segs.length; i++) {
      pts.push({ x: worldToScreenX(segs[i].x), y: segs[i].y });
    }
    // 蛇身做正弦摆动，看起来像在游
    for (var w = 1; w < pts.length; w++) {
      var amp = 5 + w * 0.9;
      pts[w].y += Math.sin(t * 7 - w * 0.7) * amp * 0.35;
    }

    ctx.save();
    // 蛇身：由粗到细
    for (var s = pts.length - 1; s >= 1; s--) {
      var a = pts[s], b = pts[s - 1];
      var ratio = 1 - (s - 1) / Math.max(1, pts.length - 1);
      var rad = 4 + 11 * ratio;
      ctx.strokeStyle = outline;
      ctx.lineWidth = rad * 2 + 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = (s % 2 === 0) ? bodyB : bodyA;
      ctx.lineWidth = rad * 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // 蛇头
    var headR = 17;
    ctx.save();
    ctx.translate(sx, hy);
    ctx.scale(facing, 1);
    // 头顶呆毛（小青一片叶、白娘子一朵小花）
    ctx.fillStyle = qing ? '#49c39e' : '#ffd6ea';
    ctx.beginPath();
    ctx.ellipse(-2, -headR - 7, 5.5, 4.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // 头轮廓
    ctx.fillStyle = bodyB;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(0, 0, headR, headR * 0.88, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 眼睛（漫画大眼）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(4, -4, 6.2, 6.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6, -4, 5.2, 6.0, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b2430';
    ctx.beginPath(); ctx.arc(5.6, -3.4, 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-4.8, -3.4, 2.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(6.8, -5.0, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-3.8, -4.8, 0.9, 0, Math.PI * 2); ctx.fill();
    // 腮红
    ctx.fillStyle = qing ? 'rgba(255,140,170,.45)' : 'rgba(255,150,180,.5)';
    ctx.beginPath(); ctx.ellipse(9, 3.6, 4.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-10, 3.0, 3.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    // 嘴（微笑）
    ctx.strokeStyle = outline; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, 6); ctx.quadraticCurveTo(7, 9.5, 12, 5.5); ctx.stroke();
    ctx.restore();

    // 剩余时间小徽章 —— [2026-10-14 需求3] 提示字移除倒计时/操作说明，只写「变身」
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(16,21,33,.72)';
    var bw = 44, bh = 20;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(sx - bw / 2, hy - 46, bw, bh, 10);
    else ctx.rect(sx - bw / 2, hy - 46, bw, bh);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('变身', sx, hy - 35.5);
    ctx.restore();
  }

  // [v30 角色残影·伪动态模糊] 高速移动时在主体之下叠 2 张低透明度历史帧，
  //   减轻重 GPU/弱 GPU 帧间隔不均带来的高速顿挫观感。仅针对角色、成本≈2 次 drawImage；
  //   全屏动态模糊会增加 4K 填充压力（更卡），故不可用，这是替代方案。
  var GHOST_SPEED_MIN = 130;                 // 速度阈值（逻辑px/s）：常规跑动 135~145，弹射更高，均触发
  var _ghostBuf = [];                        // 角色近几帧位置/姿态环形缓冲
  function drawPlayer(focusX) {
    var visual = cfg.getPlayerVisual();
    var player = cfg.player;
    var portal = cfg.portalState || {};
    var enteringPortal = !!portal.entryActive;
    var playerAlpha = enteringPortal ? clamp(Number(portal.playerAlpha), 0, 1) : 1;
    if ((Number(player.crowBlinkTimer) || 0) > 0) {
      var blinkDuration = Math.max(0.1, Number(player.crowBlinkDuration) || 0.56);
      var blinkElapsed = blinkDuration - Number(player.crowBlinkTimer);
      var blinkPhase = Math.floor(Math.max(0, blinkElapsed) / (blinkDuration / 4));
      if (blinkPhase % 2 === 1) playerAlpha *= 0.16;
    }
    var hitDuration = Math.max(0.001, Number(player.hitDuration) || 0.18);
    var hitRemaining = clamp((Number(player.hitTimer) || 0) / hitDuration, 0, 1);
    var hitElapsed = 1 - hitRemaining;
    var hitWobble = hitRemaining > 0 ? Math.sin(hitElapsed * Math.PI * 4.5) * hitRemaining * 0.045 : 0;
    var hitDeform = null;
    if (hitRemaining > 0) {
      var hitWave = Math.sin(hitElapsed * Math.PI * 3.5 + Math.PI * 0.5) * hitRemaining;
      var hitAmount = clamp(hitWave * 0.075 * clamp(Number(player.hitIntensity) || 1, 0.55, 1.35), -0.065, 0.09);
      hitDeform = {
        amount: hitAmount,
        angle: Math.atan2(Number(player.hitNormalY) || 0, Number(player.hitNormalX) || 1)
      };
    }
    var sx = worldToScreenX(player.x, focusX);

    if (enteringPortal) {
      var entryT = clamp((Number(portal.entryTimer) || 0) / Math.max(0.001, Number(portal.entryDuration) || 0.88), 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var glowR = 32 + entryT * 34;
      var pg = ctx.createRadialGradient(sx, player.y, 0, sx, player.y, glowR);
      pg.addColorStop(0, 'rgba(255,255,255,' + (0.76 * playerAlpha) + ')');
      pg.addColorStop(0.28, 'rgba(255,222,120,' + (0.44 * playerAlpha) + ')');
      pg.addColorStop(0.62, 'rgba(255,109,225,' + (0.27 * playerAlpha) + ')');
      pg.addColorStop(1, 'rgba(96,230,255,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(sx, player.y, glowR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 2026-10-01：变蛇期间不画人形态，改画漫画风蛇形（画完直接返回）。
    if (cfg.isSnakeFormActive && cfg.snakeForm) {
      if (!enteringPortal) drawSnakeForm(cfg.snakeForm);
      return;
    }
    // 能力特效：进传送门时角色在发光，叠加特效会糊成一团，故直接跳过。
    if (!enteringPortal && playerAlpha > 0.01) {
      // 蝠侠·滑翔：身后三道金色速度线（纯视觉提示，不画任何文字）
      if (Number(player.gliding) > 0) drawBatGlideAura(sx, player.y, playerAlpha);
    }

    if (playerAlpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= playerAlpha;
    // [v30 角色残影] 仅常规形态（else 分支画 360 表 sprite）、不透明、非传送门、速度达标时启用；
    //   受击闪烁/传送门/翻滚/放屁/眩晕等特殊状态一律不画不采样，速度回落即清缓冲防残影滞留。
    var _ghostBase = ctx.globalAlpha;
    var _gVx = Number(player.vx) || 0, _gVy = Number(player.vy) || 0;
    if (visual.mode === 'normal' && playerAlpha > 0.95 && !enteringPortal && Math.hypot(_gVx, _gVy) > GHOST_SPEED_MIN) {
      _ghostBuf.push({
        x: sx, y: player.y,
        fi: visual.frameIndex,
        sc: visual.scale * 0.97 * skin360DrawScale(),
        rot: hitWobble + (Number(visual.spriteRotationOffset) || 0)
      });
      if (_ghostBuf.length > 6) _ghostBuf.shift();
      if (_ghostBuf.length >= 5) {
        var _g1 = _ghostBuf[_ghostBuf.length - 3];   // 约 2 帧前
        var _g2 = _ghostBuf[_ghostBuf.length - 5];   // 约 4 帧前
        ctx.globalAlpha = _ghostBase * 0.16;
        drawSpriteFrame(_g1.fi, _g1.x, _g1.y, _g1.sc, _g1.rot, null);
        ctx.globalAlpha = _ghostBase * 0.09;
        drawSpriteFrame(_g2.fi, _g2.x, _g2.y, _g2.sc, _g2.rot, null);
        ctx.globalAlpha = _ghostBase;
      }
    } else {
      _ghostBuf.length = 0;
    }
    if (enteringPortal && playerAlpha > 0.7) {
      ctx.shadowColor = 'rgba(255,255,255,.95)';
      ctx.shadowBlur = 10;
    }
    if ((Number(player.fartTimer) || 0) > 0) {
      // 2026-10-05：没有专属 fart 图的皮肤（蝠侠）不回落经典阿蜥放屁图 → 画自己的翻滚表（新图）。
      // 2026-10-05 修正：classic 的放屁图走 cfg.fartSprite 兜底（drawFartPoseFrame 内部解析），必须照常画。
      var _fartSrc = getActiveAuxSpriteSource('fart', null, null);
      var _fartSkin = getActiveSkinVisual();
      if (_fartSrc.custom || !_fartSkin || _fartSkin.id === 'classic') {
        // 2026-09-29 用户要求：放屁图整体缩小为 90%。
        drawFartPoseFrame(sx, player.y, visual.scale * 0.97 * 0.90 * skinFartDrawScale(), Number(player.fartDirection) || Number(player.faceDir) || -1);
      } else {
        drawCurlFrame(visual.curlFrame, sx, player.y, 0.644 * 1.03 * 0.90 * skinCurlDrawScale(), hitWobble + (Number(visual.curlRotationOffset) || 0), Number(player.faceDir) || 1, hitDeform, Number(player.curlBlinkState) || 0);
      }
      // 2026-09-30 用户要求：翻滚（蜷缩）图整体缩小为 90%（与放屁图同一套写法：末尾乘 0.90）。
      // 想还原就把 0.90 改回 1.0。
    } else if (visual.mode === 'glide') drawGlideFrame(sx, player.y, 0.62, Number(player.faceDir) || 1, player.animTime);
    else if (visual.mode === 'curl') drawCurlFrame(visual.curlFrame, sx, player.y, 0.644 * 1.03 * 0.90 * skinCurlDrawScale(), hitWobble + (Number(visual.curlRotationOffset) || 0), Number(player.faceDir) || 1, hitDeform, Number(player.curlBlinkState) || 0);
    else if (visual.mode === 'victory') {
      // 2026-10-05：没有专属 victory 图但有滑翔立绘的皮肤（蝠侠）→ 用滑翔图（展翼=庆祝），不回落经典阿蜥。
      var _victorySrc = getActiveAuxSpriteSource('victory', null, null);
      if (_victorySrc.custom) drawVictoryPoseFrame(cfg.finishState.poseIndex || 0, sx, player.y, 0.74 * skinVictoryDrawScale(), 1);
      else if (getActiveAuxSpriteSource('glide', null, null).custom) drawGlideFrame(sx, player.y, skinGlideDrawScale() * skinVictoryDrawScale(), Number(player.faceDir) || 1, player.animTime);   // 蝠侠过关=滑翔图（0.62 × victory 0.5）
      else drawVictoryPoseFrame(cfg.finishState.poseIndex || 0, sx, player.y, 0.74 * skinVictoryDrawScale(), 1);
    }
    else if (visual.mode === 'dizzy') {
      // 2026-10-05：无专属 360 表的皮肤（bat）死亡眩晕不回落经典阿蜥眩晕图 → 画自己的翻滚表（新图）。
      // 尺寸沿用平时翻滚的视觉尺寸（死亡时大小突变会显得突兀），加 hitWobble 轻微晃动。
      // 2026-10-05 修正：classic 用 axi_dizzy 眩晕图（其 360 表在 sprite.manifest，不在 skinSpriteManifests），必须恢复原判断。
      var _dizzySkin = getActiveSkinVisual();
      // 2026-10-09：蝠侠接入真实 360 表后，上面「有 360 表 → 共用经典眩晕图」的约定会把它切成
      // 经典阿蜥的眩晕图（绿色阿蜥）＝死亡画面串皮。蝠侠死亡继续画自己的团身球，
      // 与它平时滚动的形象一致（它平时就是团成一球的，不是站着的人形）。
      if (!_dizzySkin || _dizzySkin.id === 'classic'
          || (_dizzySkin.id !== 'bat' && cfg.skinSpriteManifests && cfg.skinSpriteManifests[_dizzySkin.id])) {
        drawDizzyFrame(sx, player.y, visual.scale, hitWobble);
      } else {
        drawCurlFrame(visual.curlFrame, sx, player.y, 0.644 * 1.03 * 0.90 * skinCurlDrawScale(), hitWobble + (Number(visual.curlRotationOffset) || 0), Number(player.faceDir) || 1, null, 0);
      }
    }
    else drawSpriteFrame(visual.frameIndex, sx, player.y, visual.scale * 0.97 * skin360DrawScale(), hitWobble + (Number(visual.spriteRotationOffset) || 0), hitDeform);
    drawSkinCostumeOverlay(visual, sx, player.y);
    if (player.pressOpenTimer > 0 && player.attachIndex === null) {
      // 2026-10-05：张嘴贴层按 360 表锚点定位；无专属 360 表的皮肤（bat，空中姿态走翻滚表）不画，避免错位悬空。
      // 2026-10-05 修正：classic 的 360 表在 sprite.manifest（非 skinSpriteManifests），张嘴贴层必须照常绘制。
      var _pressSkin = getActiveSkinVisual();
      // 2026-10-09：蝠侠接入真实 360 表后本会开始画张嘴贴层，但两层原因都不该画 ——
      //   ① 蝠侠戴全罩面头盔，没有「张开的嘴」这个画面可贴；
      //   ② 该贴层内部用的是 cfg.sprite.manifest（经典阿蜥表）的锚点定位，对任何非 classic
      //      皮肤都是错位的绿椭圆（既有实现，改动面大，另案处理）。
      // 故蝠侠显式跳过，维持 2026-10-05「蝠侠不画张嘴贴层」的行为。
      if (_pressSkin && _pressSkin.id !== 'bat'
          && (_pressSkin.id === 'classic' || (cfg.skinSpriteManifests && cfg.skinSpriteManifests[_pressSkin.id]))) {
        drawPressOpenOverlay(sx, player.y, visual);
      }
    }
    ctx.restore();
  }

  function drawSoulSprite(focusX) {
    var soul = cfg.soulState;
    if (!soul || !soul.active) return;
    var duration = Math.max(0.001, soul.duration || 1.5);
    var progress = clamp((soul.timer || 0) / duration, 0, 1);
    var eased = 1 - Math.pow(1 - progress, 2);
    var x = worldToScreenX(soul.x, focusX) + Math.sin(progress * Math.PI * 4) * 5;
    var y = soul.y - eased * 150;
    var alpha = progress < 0.78 ? 0.96 : clamp((1 - progress) / 0.22, 0, 1) * 0.96;
    var pulse = 1 + Math.sin(progress * Math.PI * 8) * 0.055;
    var sc = cfg.soulConfig || { frameWidth: 64, frameHeight: 64, logicalFrameWidth: 64, logicalFrameHeight: 64, frameCount: 4 };
    var fw = sc.frameWidth || 64, fh = sc.frameHeight || 64;
    var lw = sc.logicalFrameWidth || fw, lh = sc.logicalFrameHeight || fh;
    var count = sc.frameCount || 4;
    var frame = Math.floor((soul.timer || 0) * 8) % count;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(pulse, pulse);

    ctx.strokeStyle = '#ffe99b';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -31, 19, 6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha * 0.34;
    ctx.fillStyle = '#fff5b8';
    ctx.beginPath(); ctx.arc(0, -4, 40 + Math.sin(progress * Math.PI * 6) * 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha;

    if (cfg.soulSprite && cfg.soulSprite.ready) {
      ctx.drawImage(cfg.soulSprite.image, frame * fw, 0, fw, fh, -lw * 0.5, -lh * 0.5, lw, lh);
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#dffcff';
      ctx.fillRect(-18, -21, 36, 30);
      ctx.fillRect(-14, 9, 8, 10); ctx.fillRect(-2, 9, 8, 14); ctx.fillRect(10, 9, 8, 8);
      ctx.fillStyle = '#73e6c8'; ctx.fillRect(-10, -7, 7, 7); ctx.fillRect(5, -7, 7, 7);
      ctx.fillStyle = '#173b46'; ctx.fillRect(-8, -5, 3, 3); ctx.fillRect(7, -5, 3, 3);
      ctx.fillStyle = '#ff91b8'; ctx.fillRect(-4, 4, 8, 3);
    }
    ctx.restore();
  }

  function drawSoulDepartureOverlay() {
    var soul = cfg.soulState;
    if (!soul || !soul.active) return;
    var progress = clamp((soul.timer || 0) / Math.max(0.001, soul.duration || 1.5), 0, 1);
    ctx.save();
    var g = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.56, 20, VIEW_W * 0.5, VIEW_H * 0.56, VIEW_H * 0.62);
    g.addColorStop(0, 'rgba(255,248,190,' + (0.10 + progress * 0.08) + ')');
    g.addColorStop(1, 'rgba(4,8,16,' + (0.18 + progress * 0.22) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.68 * Math.sin(progress * Math.PI)) + ')';
    ctx.font = 'bold 20px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.fillText('灵魂升天……', VIEW_W * 0.5, 150);
    ctx.restore();
  }

  function drawPressOpenOverlay(screenX, screenY, visual) {
    var player = cfg.player;
    var t = 1 - clamp(player.pressOpenTimer / Math.max(0.001, player.pressOpenDuration || 0.085), 0, 1);
    var open = 0.35 + t * 0.65;
    var fw = (cfg.sprite.manifest && (cfg.sprite.manifest.logicalFrameWidth || cfg.sprite.manifest.frameWidth)) || 128;
    var fh = (cfg.sprite.manifest && (cfg.sprite.manifest.logicalFrameHeight || cfg.sprite.manifest.frameHeight)) || 128;
    var anchors = (cfg.sprite.manifest && cfg.sprite.manifest.mouthAnchors) || [];
    var anchor = anchors[visual.frameIndex] || { x: fw * 0.5, y: fh * 0.24 };
    var ox = (anchor.x - fw * 0.5) * visual.scale, oy = (anchor.y - fh * 0.5) * visual.scale;
    var rr = Number(visual.spriteRotationOffset) || 0, rc = Math.cos(rr), rs = Math.sin(rr);
    var mouthX = screenX + rc*ox - rs*oy;
    var mouthY = screenY + rs*ox + rc*oy;
    ctx.save();
    ctx.translate(mouthX, mouthY);
    ctx.rotate(visual.angle);
    ctx.scale(visual.scale, visual.scale);
    // 2026-10-13：移除原本的绿色椭圆（#65d74f 外圈 + #7df062 内圈）。
    // 那是张嘴贴层的程序化占位色：按住出舌的第一帧舌头尚未伸出、口腔空着，
    // 绿椭圆裸露在舌根位置，看起来就是一个绿色圆球（用户实测反馈）。
    // 嘴腔本就该是暗红，这里只保留深红口腔，并随按住进度淡入，
    // 首帧不再有任何突发色块。
    ctx.globalAlpha = clamp(t / 0.35, 0, 1);
    ctx.fillStyle = '#7a0622';
    ctx.beginPath(); ctx.ellipse(0, 3 + open * 2, 5 + open * 1.6, 2.4 + open * 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function applyHitDeformation(deform) {
    if (!deform) return;
    var amount = clamp(Number(deform.amount) || 0, -0.08, 0.10);
    if (Math.abs(amount) < 0.0001) return;
    var angle = Number(deform.angle) || 0;
    ctx.rotate(angle);
    ctx.scale(1 - amount, 1 + amount * 0.55);
    ctx.rotate(-angle);
  }

  function drawSpriteFrame(frameIndex, x, y, scale, rot, deform) {
    scale = scale || 1; rot = rot || 0;
    var skinSpriteSource = getActiveSkinSpriteSource();
    var activeSpriteAsset = skinSpriteSource.asset || cfg.sprite;
    var manifest = skinSpriteSource.manifest || { frameWidth: 128, frameHeight: 128, logicalFrameWidth: 128, logicalFrameHeight: 128, frameCount: 24 };
    var fw = manifest.frameWidth || 128, fh = manifest.frameHeight || 128;
    var lw = manifest.logicalFrameWidth || fw, lh = manifest.logicalFrameHeight || fh;
    var count = manifest.frameCount || 24;
    var frame = ((Math.round(frameIndex) % count) + count) % count;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    applyHitDeformation(deform);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    if (activeSpriteAsset && activeSpriteAsset.ready) {
      var columns = Math.max(1, Number(manifest.columns || manifest.sheetColumns) || count);
      var sourceX = (frame % columns) * fw;
      var sourceY = Math.floor(frame / columns) * fh;
      ctx.drawImage(activeSpriteAsset.image, sourceX, sourceY, fw, fh, -lw * 0.5, -lh * 0.5, lw, lh);
    } else {
      ctx.fillStyle = '#61df58';
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawFartPoseFrame(x, y, scale, faceDir) {
    scale = scale || 1;
    var source = getActiveAuxSpriteSource('fart', cfg.fartSprite, cfg.fartConfig || { frameWidth: 110, frameHeight: 110, logicalFrameWidth: 110, logicalFrameHeight: 110 });
    var fc = source.config || {};
    var fw = fc.frameWidth || 134, fh = fc.frameHeight || 128;
    var lw = fc.logicalFrameWidth || fw, lh = fc.logicalFrameHeight || fh;
    var fartAsset = source.asset;
    // 原图用于向左飞；向右飞时只做水平镜像，技能期间保持静态、不旋转。
    var mirrorX = Number(faceDir) > 0 ? -1 : 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale * mirrorX, scale);
    if (fartAsset && fartAsset.ready) {
      // 单帧图若实际像素略有差异（例如导出时裁掉透明边），读取真实像素做源裁剪，逻辑显示尺寸保持不变。
      var sourceW = fartAsset.image && fartAsset.image.width ? fartAsset.image.width : fw;
      var sourceH = fartAsset.image && fartAsset.image.height ? fartAsset.image.height : fh;
      ctx.drawImage(fartAsset.image, 0, 0, sourceW, sourceH, -lw * 0.5, -lh * 0.5, lw, lh);
    } else {
      ctx.scale(mirrorX, 1);
      drawSpriteFrame(0, 0, 0, 1, 0);
    }
    ctx.restore();
  }

  // 2026-10-09 白娘子/小青：翻滚表未定稿 → 用代码画的圆球代替（配色来自 SKIN_DEFS.curlBall）。
  // 在 drawCurlFrame 的变换空间内绘制（ctx 已含位移/hitDeform/滚动 rot/镜像/scale）。
  // r = curl 帧逻辑宽 × 0.43 —— 与经典阿蜥团身球在帧内的占比（138/160 ≈ 0.86 直径）一致，
  // 因此球径自动与经典阿蜥滚动时一样大；_SKIN_DEFS 里删掉 curlBall 字段即可恢复精灵图。
  function drawSkinCurlBall(b, frameLogical) {
    var r = frameLogical * 0.43;
    ctx.fillStyle = b.base;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // 下侧暗面（体积感）
    ctx.fillStyle = b.shade;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.15, Math.PI * 0.85);
    ctx.arc(0, -r * 0.18, r * 0.985, Math.PI * 0.85, Math.PI * 0.15, true);
    ctx.closePath(); ctx.fill();
    // 两段弧形斑纹 —— ctx 已按滚动角 rot 旋转，滚动时斑纹跟着转，球「滚得动」
    ctx.strokeStyle = b.band;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.52, -Math.PI * 0.28, Math.PI * 0.42); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.52, Math.PI * 0.72, Math.PI * 1.42); ctx.stroke();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.ellipse(-r * 0.34, -r * 0.40, r * 0.16, r * 0.10, -0.6, 0, Math.PI * 2); ctx.fill();
    // 描边
    ctx.strokeStyle = b.outline;
    ctx.lineWidth = Math.max(1.2, r * 0.075);
    ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth * 0.5, 0, Math.PI * 2); ctx.stroke();
  }

  function drawCurlFrame(frameIndex, x, y, scale, rot, faceDir, deform, blinkState) {
    scale = (scale || 1) * 0.96; rot = rot || 0; // 2026-09-07：翻滚精灵整体缩至 0.96 倍
    var source = getActiveAuxSpriteSource('curl', cfg.curlSprite, cfg.curlConfig || {});
    var cc = source.config || {};
    var fw = cc.frameWidth || 144, fh = cc.frameHeight || 144;
    var lw = cc.logicalFrameWidth || 128, lh = cc.logicalFrameHeight || 128;
    var count = cc.frameCount || 24;
    var frame = ((Math.round(frameIndex) % count) + count) % count;
    // 2026-09-07：翻滚精灵仅用主图；蛛侠启用时自动切到同规格的专属36帧图集。
    var activeCurlSprite = source.asset;
    // 图1原始朝向为向右；向左移动时对整张离散旋转帧做水平镜像。
    var mirrorX = Number(faceDir) < 0 ? -1 : 1;
    // 子帧旋转 rot 在镜像坐标系下方向与底图帧步进相反，会在每个 cf 边界与 rot 同向跳变（净跳 ~20°）造成回跳卡顿。
    // 镜像时把 rot 反向，使子帧平滑方向与帧步进一致，左向翻滚同样连续。
    if (mirrorX < 0) rot = -rot;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    applyHitDeformation(deform);
    ctx.rotate(rot);
    ctx.scale(scale * mirrorX, scale);
    // 2026-10-09：SKIN_DEFS.curlBall 优先 —— 白娘子/小青翻滚表未定稿，先画代码圆球。
    var _ballSkin = getActiveSkinVisual();
    if (_ballSkin && _ballSkin.curlBall) {
      drawSkinCurlBall(_ballSkin.curlBall, Math.min(lw, lh));
    } else if (activeCurlSprite && activeCurlSprite.ready) {
      var columns = Math.max(1, Number(cc.columns) || count);
      var sourceX = (frame % columns) * fw;
      var sourceY = Math.floor(frame / columns) * fh;
      ctx.drawImage(activeCurlSprite.image, sourceX, sourceY, fw, fh, -lw * 0.5, -lh * 0.5, lw, lh);
    } else {
      ctx.fillStyle = '#61df58';
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 2026-10-05 蝠侠·滑翔：展翼平飞专用立绘（4 帧扇翅循环），底图朝右，向左飞时水平镜像。
  // 与 curl 的差别：不按 player.angle 旋转（滑翔是平飞姿态，旋转反而奇怪），只做镜像 + 帧动画。
  function drawGlideFrame(x, y, scale, faceDir, time) {
    var source = getActiveAuxSpriteSource('glide', cfg.glideSprite, cfg.glideConfig || {});
    var gc = source.config || {};
    var fw = gc.frameWidth || 320, fh = gc.frameHeight || 320;
    var lw = gc.logicalFrameWidth || 320, lh = gc.logicalFrameHeight || 320;
    var count = Math.max(1, Number(gc.frameCount) || 4);
    var columns = Math.max(1, Number(gc.columns) || count);
    var fps = Number(gc.fps) || 7;
    var frame = ((Math.floor((time || 0) * fps) % count) + count) % count;
    var mirrorX = Number(faceDir) < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale * mirrorX, scale);
    if (source.asset && source.asset.ready) {
      var sourceX = (frame % columns) * fw;
      var sourceY = Math.floor(frame / columns) * fh;
      ctx.drawImage(source.asset.image, sourceX, sourceY, fw, fh, -lw * 0.5, -lh * 0.5, lw, lh);
    } else {
      // 图未就绪时的兜底：深色小圆，绝不显示成空气
      ctx.fillStyle = '#3b3b46';
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSprite(name, time, x, y, scale, flip, rot) {
    scale = scale || 1; flip = flip || false; rot = rot || 0;
    var manifest = cfg.sprite.manifest || { animations: {}, frameCount: 24 };
    var animations = manifest.animations || {};
    var anim = animations[name] || animations.air_curl || animations.idle || { start: 0, frames: 1, fps: 1 };
    var localFrame = Math.floor(time * (anim.fps || 1)) % Math.max(1, anim.frames || 1);
    var frame = (anim.start || 0) + localFrame;
    if (flip) frame = ((manifest.frameCount || 24) - frame) % (manifest.frameCount || 24);
    drawSpriteFrame(frame, x, y, scale, rot);
  }

  function drawVictoryPoseFrame(frameIndex, x, y, scale, alpha) {
    scale = scale || 2.2; alpha = alpha === undefined ? 1 : alpha;
    var source = getActiveAuxSpriteSource('victory', cfg.victorySprite, cfg.victoryConfig || {});
    var vc = source.config || {};
    var fw = vc.frameWidth || 180, fh = vc.frameHeight || 180;
    var lw = vc.logicalFrameWidth || fw, lh = vc.logicalFrameHeight || fh;
    var count = vc.frameCount || 5;
    var frame = ((Math.round(frameIndex) % count) + count) % count;
    var victoryAsset = source.asset;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (victoryAsset && victoryAsset.ready) {
      ctx.drawImage(victoryAsset.image, frame * fw, 0, fw, fh, -lw * 0.5, -lh * 0.5, lw, lh);
    } else {
      drawSpriteFrame(0, 0, 0, 1.8, 0);
    }
    ctx.restore();
  }

  function drawDizzyFrame(x, y, scale, rot) {
    scale = scale || 0.448; rot = rot || 0;
    var dc = cfg.dizzyConfig || { frameWidth: 247, frameHeight: 128, logicalFrameWidth: 247, logicalFrameHeight: 128, frameCount: 1 };
    var fw = dc.frameWidth || 247, fh = dc.frameHeight || 128;
    var lw = dc.logicalFrameWidth || fw, lh = dc.logicalFrameHeight || fh;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y - 24));
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    if (cfg.dizzySprite && cfg.dizzySprite.ready) {
      ctx.drawImage(cfg.dizzySprite.image, 0, 0, fw, fh, -lw * 0.5, -lh * 0.5, lw, lh);
    } else {
      ctx.fillStyle = '#65d74f';
      ctx.beginPath(); ctx.ellipse(0, 0, 90, 36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.ellipse(20, 4, 50, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#173b46';
      ctx.font = 'bold 22px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('X', 60, 8); ctx.fillText('X', 100, 8);
      ctx.fillStyle = '#ff6fa9';
      ctx.beginPath(); ctx.ellipse(-78, 6, 16, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles(focusX) {
    ctx.save();
    var particles = cfg.particles || [];
    var step = lowEffects() ? (particles.length > 24 ? 3 : 2) : (balancedEffects() && particles.length > 36 ? 2 : 1);
    for (var i = 0; i < particles.length; i += step) {
      var p = particles[i];
      var pt = p.age / p.life;
      // 2026-10-08：soft 粒子（蛇娘云雾）——先快速淡入再缓慢消散，边缘柔和不生硬。
      var alpha = p.soft
        ? (pt < 0.16 ? pt / 0.16 : Math.max(0, 1 - (pt - 0.16) / 0.84))
        : 1 - pt;
      var pr = p.r + (Number(p.grow) || 0) * p.age;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.soft) {
        // 云朵：外圈淡雾 + 内圈实心的两层叠加，不用渐变（省性能）。
        var sx0 = worldToScreenX(p.x, focusX);
        ctx.globalAlpha = alpha * 0.30;
        ctx.beginPath(); ctx.arc(sx0, p.y, pr * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = alpha * 0.88;
        ctx.beginPath(); ctx.arc(sx0, p.y, pr, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      if (p.confetti) {
        ctx.save();
        ctx.translate(worldToScreenX(p.x, focusX), p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(worldToScreenX(p.x, focusX), p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFloatingTexts(focusX) {
    ctx.save();
    ctx.font = 'bold 20px ' + UI_FONT;
    ctx.textAlign = 'center';
    var texts = cfg.floatingTexts || [];
    for (var i = 0; i < texts.length; i++) {
      var t = texts[i];
      var progress = t.age / t.life;
      ctx.globalAlpha = progress < 0.6 ? 1 : Math.max(0, 1 - (progress - 0.6) / 0.4);
      ctx.fillStyle = t.negative ? '#ff6b6b' : '#fff3a3';
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 4;
      var x = worldToScreenX(t.x, focusX);
      var text = t.customText || (t.label ? (t.label + '+' + t.value) : ('+' + t.value));
      ctx.strokeText(text, x, t.y);
      ctx.fillText(text, x, t.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawTopBar() {
    var h = 98;
    var topBarArt = cachedTopBarArt(h);
    ctx.drawImage(topBarArt.canvas, 0, 0, topBarArt.w, topBarArt.h);

    drawCharacterBadge();

    // [v78 用户要求移除] 顶栏三颗心（血量）不再显示——左上角改为玩家微信头像+昵称。
    //   runStats.hearts 数据保留（救援逻辑不受影响），仅去掉绘制。

    // 中央主信息：星星 + 本局分数，并明确标注“本局得分”。
    var scoreCenterX = 286;
    drawStar(217, 25, 13, '#ffd95c');
    drawDigits(cfg.runStats.score, scoreCenterX, 28, 43, '#ffffff', 'center');

    var scoreLabelW = 98, scoreLabelH = 24, scoreLabelY = 56;
    ctx.save();
    var scoreLabelArt = cachedScoreLabelArt(scoreLabelW, scoreLabelH);
    ctx.drawImage(scoreLabelArt.canvas,
      scoreCenterX - scoreLabelW * 0.5 - scoreLabelArt.pad,
      scoreLabelY - scoreLabelH * 0.5 - scoreLabelArt.pad,
      scoreLabelArt.w, scoreLabelArt.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px ' + UI_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('本局得分', scoreCenterX, scoreLabelY + 0.5);
    ctx.restore();

    // [v61 用户要求移除] 网页版（kiosk 三轮）为单局计分，没有跨局累计概念，
    //   顶栏「累计 xxxx」展示误导（截图反馈：累计 30429），整块移除。
    //   HUD 中央只保留「★ 本局得分」；连击倍率/技能番薯区不受影响。

    // 连击倍率保留为轻量文字提示，不再增加额外边框。
    var comboActive = cfg.runStats.multiplier > 1 && cfg.runStats.comboTimer > 0;
    if (comboActive) {
      ctx.save();
      ctx.fillStyle = '#ff9eb8';
      ctx.font = 'bold 13px ' + UI_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('×' + cfg.runStats.multiplier, 337, 55);
      ctx.restore();
    }

    // 技能区：番薯图标与数量同步放大，数量保持更强的视觉优先级。
    var skillIcon = getFoodIcon('golden_sweet_potato', cfg.foodArtAssets);
    ctx.drawImage(skillIcon, 368, 30, 34, 34);
    drawDigits((cfg.goldenSkillState && cfg.goldenSkillState.points) || 0, 408, 46, 40, '#ffd85f', 'left');

    if (cfg.isTutorialStage()) {
      var skip = { x: VIEW_W - 56, y: 146, w: 76, h: 46, r: 36 };
      hotspots.skip = skip;
      if (!drawUiSpriteButton('next', skip.x, skip.y, skip.w, skip.h, cfg.uiPressVisual === 'next')) {
        ctx.fillStyle = 'rgba(17,25,38,.72)';
        ctx.beginPath(); ctx.arc(skip.x, skip.y, 24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.24)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(skip.x, skip.y, 24, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(skip.x - 11, skip.y - 8); ctx.lineTo(skip.x - 2, skip.y); ctx.lineTo(skip.x - 11, skip.y + 8); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(skip.x - 1, skip.y - 8); ctx.lineTo(skip.x + 8, skip.y); ctx.lineTo(skip.x - 1, skip.y + 8); ctx.closePath(); ctx.fill();
        ctx.fillRect(skip.x + 10, skip.y - 9, 3, 18);
      }
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 14px ' + UI_FONT;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 6;
      ctx.fillText('跳过', skip.x, skip.y + 30);
      ctx.restore();
    }
  }

  function drawHeart(x, y, color, scale, active) {
    scale = Number(scale) || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    if (active && !lowEffects()) {
      ctx.shadowColor = 'rgba(255,91,139,.38)';
      ctx.shadowBlur = balancedEffects() ? 4 : 7;
    }
    ctx.beginPath(); ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-16, -4, -24, 6, 0, 28);
    ctx.bezierCurveTo(24, 6, 16, -4, 0, 10);
    ctx.fill();
    if (active) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,221,231,.30)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStar(x, y, r, color) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      var a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a2) * (r * 0.45), Math.sin(a2) * (r * 0.45));
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function drawDigits(value, x, y, size, color, align) {
    size = size || 28; color = color || '#fff'; align = align || 'center';
    ctx.save();
    ctx.font = 'bold ' + size + 'px ' + UI_NUM;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    var str = String(Math.max(0, value));
    var padLen = align === 'center' ? 4 : 2;
    while (str.length < padLen) str = '0' + str;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function portalDistanceFrame(screenX, frameCount) {
    frameCount = Math.max(2, Number(frameCount) || 8);
    if (screenX > VIEW_W) return frameCount - 1;
    var centerX = VIEW_W * 0.5;
    var normalized = clamp((screenX - centerX) / Math.max(1, VIEW_W - centerX), 0, 1);
    return clamp(Math.round(normalized * Math.max(1, frameCount - 2)), 0, frameCount - 2);
  }

  function drawPortal(focusX) {
    var p = cfg.portalState;
    if (!p || !p.active) return;

    var duration = Math.max(0.1, Number(p.spawnDuration) || 0.35);
    var rawGrow = clamp((Number(p.spawnTimer) || 0) / duration, 0, 1);
    var halfW = Math.max(42, Number(p.halfWidth) || Number(p.radius) || 60);
    var halfH = Math.max(64, Number(p.halfHeight) || 95);
    var x = worldToScreenX(Number(p.x) || 0, focusX);
    var y = Number(p.y) || VIEW_H * 0.5;
    var spriteCfg = cfg.portalSpriteConfig || { frameWidth: 256, frameHeight: 409, frameCount: 8 };
    var frameCount = Math.max(2, Number(spriteCfg.frameCount) || 8);
    var frame = portalDistanceFrame(x, frameCount);
    var entryT = p.entryActive
      ? clamp((Number(p.entryTimer) || 0) / Math.max(0.001, Number(p.entryDuration) || 0.88), 0, 1)
      : 0;

    if (x > VIEW_W + halfW * 2.2 || x < -halfW * 2.2) return;

    ctx.save();
    ctx.translate(x, y);
    var appearScale = 0.88 + easeOutBack(rawGrow) * 0.12;
    var impactScale = entryT > 0 ? 1 + Math.sin(entryT * Math.PI) * 0.055 : 1;
    ctx.scale(appearScale * impactScale, appearScale * impactScale);
    ctx.globalAlpha = clamp(rawGrow * 1.45, 0, 1);

    // 穿越门外围金黄色光晕：只保留单圈柔光，不恢复雾层、粒子流或入门爆光。
    var haloPulse = 0.96 + Math.sin(nowSec() * 4.2 + (Number(p.pulse) || 0) * Math.PI * 2) * 0.04;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.78;
    ctx.scale(haloPulse, haloPulse);
    ctx.strokeStyle = 'rgba(255,210,88,.62)';
    ctx.lineWidth = Math.max(5, halfW * 0.095);
    ctx.shadowColor = 'rgba(255,177,38,.95)';
    ctx.shadowBlur = Math.max(18, halfW * 0.34);
    ctx.beginPath();
    ctx.ellipse(0, 0, halfW * 0.91, halfH * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(255,236,164,.72)';
    ctx.lineWidth = Math.max(1.5, halfW * 0.028);
    ctx.beginPath();
    ctx.ellipse(0, 0, halfW * 0.91, halfH * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (cfg.portalSprite && cfg.portalSprite.ready) {
      var fw = Math.max(1, Number(spriteCfg.frameWidth) || 256);
      var fh = Math.max(1, Number(spriteCfg.frameHeight) || 409);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        cfg.portalSprite.image,
        frame * fw, 0, fw, fh,
        -halfW, -halfH, halfW * 2, halfH * 2
      );
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = 'rgba(255,184,62,.80)';
      ctx.shadowBlur = 24;
      var fallback = ctx.createRadialGradient(0, 0, halfW * 0.10, 0, 0, halfH * 0.88);
      fallback.addColorStop(0, 'rgba(8,5,2,.96)');
      fallback.addColorStop(0.46, 'rgba(44,20,3,.92)');
      fallback.addColorStop(0.72, 'rgba(255,150,34,.72)');
      fallback.addColorStop(1, 'rgba(255,222,113,0)');
      ctx.fillStyle = fallback;
      ctx.beginPath();
      ctx.ellipse(0, 0, halfW * 0.84, halfH * 0.94, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();


    var target = cfg.portalTarget;
    if (target && rawGrow > 0.72 && !p.entryActive && x < VIEW_W + halfW * 0.75) {
      var alpha = clamp((rawGrow - 0.72) / 0.28, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(7,15,34,.82)';
      roundRect(ctx, x - 112, y - halfH - 61, 224, 44, 15); ctx.fill();
      ctx.strokeStyle = 'rgba(255,194,79,.86)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT;
      ctx.fillText('穿越至 第' + target.formalNumber + '关 · ' + target.title, x, y - halfH - 45);
      ctx.fillStyle = 'rgba(255,255,255,.67)'; ctx.font = '10px ' + UI_FONT;
      ctx.fillText(String(target.titleEn || ''), x, y - halfH - 29);
      ctx.restore();
    }
  }

  function drawPortalTransitionOverlay() {
    var state = cfg.scene === 'portal_preview' ? (cfg.portalPreviewState || {}) : (cfg.portalTransitionState || {});
    var t = Math.max(0, Number(state.timer) || 0);
    var travelDuration = Math.max(0.1, Number(state.travelDuration) || 2);
    var whiteDuration = Math.max(0.1, Number(state.whiteDuration) || 1);
    var targetNo = Math.max(1, Math.round(Number(state.formalNumber) || 1));
    var targetTitle = String(state.title || '');
    var targetTitleEn = String(state.titleEn || '');
    var roundAdvance = state.roundAdvance === true;
    var nextRound = Math.max(1, Math.round(Number(state.nextRound) || 1));

    // 传送完成后的白幕：先用柔和彩光洗白，再显示目的地。
    if (t >= travelDuration) {
      var whiteT = clamp((t - travelDuration) / whiteDuration, 0, 1);
      var textIn = easeOutCubic(clamp(whiteT / 0.24, 0, 1));
      var haloFade = clamp(1 - whiteT * 1.25, 0, 1);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      if (haloFade > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = haloFade * 0.48;
        var halo = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.46, 0, VIEW_W * 0.5, VIEW_H * 0.46, VIEW_H * 0.55);
        halo.addColorStop(0, 'rgba(255,255,255,1)');
        halo.addColorStop(0.22, 'rgba(100,235,255,.90)');
        halo.addColorStop(0.48, 'rgba(187,103,255,.70)');
        halo.addColorStop(0.72, 'rgba(255,94,189,.44)');
        halo.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = textIn;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#202638';
      ctx.font = 'bold 30px ' + UI_FONT;
      ctx.fillText(roundAdvance ? '第10关完成' : ('即将进入第' + targetNo + '关'), VIEW_W * 0.5, VIEW_H * 0.44);

      ctx.fillStyle = '#0f1730';
      ctx.font = 'bold 44px ' + UI_FONT;
      ctx.fillText(roundAdvance ? ('进入第' + nextRound + '轮') : (targetTitle || ('第' + targetNo + '关')), VIEW_W * 0.5, VIEW_H * 0.52);

      ctx.fillStyle = 'rgba(32,38,56,.58)';
      ctx.font = 'bold 13px ' + UI_FONT;
      if (roundAdvance) {
        var nextPhysicsRate = 1 + Math.max(0, nextRound - 1) * 0.05;
        var nextCrowRate = nextRound <= 2 ? 1 : 1 + Math.max(0, nextRound - 2) * 0.10;
        var nextCrowText = nextRound === 2 ? '乌鸦全关' : ('乌鸦速度×' + nextCrowRate.toFixed(2));
        ctx.fillText('长度×' + (1 + Math.max(0, nextRound - 1) * 0.5).toFixed(1) + ' · 物理×' + nextPhysicsRate.toFixed(2) + ' · ' + nextCrowText, VIEW_W * 0.5, VIEW_H * 0.575);
      }
      else if (targetTitleEn) ctx.fillText(targetTitleEn, VIEW_W * 0.5, VIEW_H * 0.575);
      ctx.restore();
      return;
    }

    // 穿越阶段由独立 portal_effect.js 绘制；可强制 WebGL / Canvas，并在失败时自动回退。
    var progress = clamp(t / travelDuration, 0, 1);
    var effectResult = portalEffect.render(ctx, {
      time: t,
      duration: travelDuration,
      progress: progress,
      width: VIEW_W,
      height: VIEW_H,
      mode: state.renderMode || portalEffectConfig.mode || 'auto'
    });
    state.lastMode = effectResult && effectResult.mode ? effectResult.mode : 'none';
    state.lastError = effectResult && effectResult.error ? effectResult.error : '';

    ctx.save();
    // 上下边缘仅做轻度压暗；主要明暗可在 portal_effect_config.js 调整。
    var overlayShade = clamp(Number(portalEffectConfig.edgeShade) || 0.10, 0, 0.8);
    var edgeShade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    edgeShade.addColorStop(0, 'rgba(0,0,0,' + Math.min(0.28, overlayShade + 0.06) + ')');
    edgeShade.addColorStop(0.22, 'rgba(0,0,0,0)');
    edgeShade.addColorStop(0.72, 'rgba(0,0,0,0)');
    edgeShade.addColorStop(1, 'rgba(0,0,0,' + Math.min(0.34, overlayShade + 0.16) + ')');
    ctx.fillStyle = edgeShade;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 结尾闪白参数集中在 portal_effect_config.js。
    var flashStart = clamp(Number(portalEffectConfig.flashStart) || 0.84, 0.5, 0.98);
    var flashStrength = clamp(Number(portalEffectConfig.flashStrength) || 0.92, 0, 1);
    var flash = clamp((progress - flashStart) / Math.max(0.001, 1 - flashStart), 0, 1);
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (flash * flash * flashStrength) + ')';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (portalEffectConfig.showTransitText !== false) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.68)';
      ctx.fillStyle = 'rgba(255,255,255,.96)';
      ctx.font = 'bold 20px ' + UI_FONT;
      ctx.strokeText('穿越异空间', VIEW_W * 0.5, VIEW_H - 82);
      ctx.fillText('穿越异空间', VIEW_W * 0.5, VIEW_H - 82);
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(255,255,255,.76)';
      ctx.font = 'bold 11px ' + UI_FONT;
      ctx.strokeText('PORTAL TRANSIT', VIEW_W * 0.5, VIEW_H - 58);
      ctx.fillText('PORTAL TRANSIT', VIEW_W * 0.5, VIEW_H - 58);
    }
    ctx.restore();
  }

  function drawPortalPreviewControls() {
    var state = cfg.portalPreviewState || {};
    var modeLabel = state.renderMode === 'webgl' ? '仅 WebGL' : (state.renderMode === 'canvas' ? '仅 Canvas' : '自动模式');
    var actualMode = String(state.lastMode || 'none').toUpperCase();

    ctx.save();
    ctx.fillStyle = 'rgba(4,11,22,.76)';
    roundRect(ctx, 18, 18, VIEW_W - 36, 66, 16); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 19px ' + UI_FONT;
    ctx.fillText('穿越动效预览', 34, 42);
    ctx.fillStyle = 'rgba(255,255,255,.70)'; ctx.font = 'bold 11px ' + UI_NUM;
    ctx.fillText(actualMode + ' · ' + modeLabel + (state.lastError ? ' · 编译失败' : ''), 34, 65);

    var exit = { x: VIEW_W - 62, y: 51, w: 92, h: 42 };
    hotspots.portalPreviewExit = exit;
    roundRect(ctx, exit.x - exit.w / 2, exit.y - exit.h / 2, exit.w, exit.h, 12);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.fillText('退出', exit.x, exit.y + 1);

    ctx.fillStyle = 'rgba(4,11,22,.84)';
    roundRect(ctx, 18, VIEW_H - 116, VIEW_W - 36, 98, 18); ctx.fill();
    var pause = { x: 76, y: VIEW_H - 69, w: 100, h: 48 };
    var restart = { x: 190, y: VIEW_H - 69, w: 100, h: 48 };
    var speed = { x: 304, y: VIEW_H - 69, w: 100, h: 48 };
    var mode = { x: 438, y: VIEW_H - 69, w: 126, h: 48 };
    hotspots.portalPreviewPause = pause;
    hotspots.portalPreviewRestart = restart;
    hotspots.portalPreviewSpeed = speed;
    hotspots.portalPreviewMode = mode;
    [pause, restart, speed, mode].forEach(function(btn) {
      roundRect(ctx, btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h, 13);
      ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.fillText(state.paused ? '播放' : '暂停', pause.x, pause.y + 1);
    ctx.fillText('重播', restart.x, restart.y + 1);
    ctx.fillText((Number(state.speed) || 1).toFixed(2).replace(/\.00$/, '') + '×', speed.x, speed.y + 1);
    ctx.font = 'bold 13px ' + UI_FONT; ctx.fillText(modeLabel, mode.x, mode.y + 1);
    ctx.restore();
  }

  function drawUnlockGateConfetti(gate) {
    var list = gate && Array.isArray(gate.confetti) ? gate.confetti : [];
    if (!list.length) return;
    ctx.save();
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var age = Number(p.age) || 0;
      var life = Math.max(0.01, Number(p.life) || 1);
      if (age < 0 || age >= life) continue;
      var fadeIn = Math.min(1, age / 0.10);
      var fadeOut = Math.min(1, (life - age) / 0.55);
      ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
      ctx.save();
      ctx.translate(Number(p.x) || 0, Number(p.y) || 0);
      ctx.rotate(Number(p.rot) || 0);
      ctx.fillStyle = p.color || '#ffffff';
      ctx.fillRect(-(Number(p.w) || 7) * 0.5, -(Number(p.h) || 4) * 0.5, Number(p.w) || 7, Number(p.h) || 4);
      if (i % 5 === 0) {
        ctx.strokeStyle = p.color || '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-(Number(p.w) || 7), 0);
        ctx.quadraticCurveTo(0, (i % 2 ? 6 : -6), Number(p.w) || 7, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawMetalStageWheel(gate) {
    var options = gate && Array.isArray(gate.wheelOptions) ? gate.wheelOptions : [];
    var wheel = { x: VIEW_W / 2, y: 558, w: 314, h: 184 };
    hotspots.unlockGateWheel = wheel;

    ctx.save();
    var outer = ctx.createLinearGradient(wheel.x - wheel.w / 2, 0, wheel.x + wheel.w / 2, 0);
    outer.addColorStop(0, '#59636d');
    outer.addColorStop(0.14, '#dce4e8');
    outer.addColorStop(0.34, '#7d8992');
    outer.addColorStop(0.50, '#f7fafb');
    outer.addColorStop(0.66, '#7d8992');
    outer.addColorStop(0.86, '#dce4e8');
    outer.addColorStop(1, '#59636d');
    roundRect(ctx, wheel.x - wheel.w / 2, wheel.y - wheel.h / 2, wheel.w, wheel.h, 28);
    ctx.fillStyle = outer; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.78)'; ctx.lineWidth = 2; ctx.stroke();

    var inner = { x: wheel.x, y: wheel.y, w: wheel.w - 26, h: wheel.h - 24 };
    roundRect(ctx, inner.x - inner.w / 2, inner.y - inner.h / 2, inner.w, inner.h, 21);
    var slot = ctx.createLinearGradient(0, inner.y - inner.h / 2, 0, inner.y + inner.h / 2);
    slot.addColorStop(0, '#111923');
    slot.addColorStop(0.22, '#28323c');
    slot.addColorStop(0.50, '#46535e');
    slot.addColorStop(0.78, '#28323c');
    slot.addColorStop(1, '#101821');
    ctx.fillStyle = slot; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.76)'; ctx.lineWidth = 3; ctx.stroke();

    ctx.save();
    roundRect(ctx, inner.x - inner.w / 2, inner.y - inner.h / 2, inner.w, inner.h, 21);
    ctx.clip();

    var centerBand = ctx.createLinearGradient(0, wheel.y - 31, 0, wheel.y + 31);
    centerBand.addColorStop(0, 'rgba(255,255,255,.05)');
    centerBand.addColorStop(0.44, 'rgba(255,225,126,.18)');
    centerBand.addColorStop(0.50, 'rgba(255,239,177,.28)');
    centerBand.addColorStop(0.56, 'rgba(255,225,126,.18)');
    centerBand.addColorStop(1, 'rgba(0,0,0,.08)');
    ctx.fillStyle = centerBand;
    ctx.fillRect(inner.x - inner.w / 2, wheel.y - 31, inner.w, 62);
    ctx.strokeStyle = 'rgba(255,229,143,.44)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(inner.x - inner.w / 2, wheel.y - 31); ctx.lineTo(inner.x + inner.w / 2, wheel.y - 31); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(inner.x - inner.w / 2, wheel.y + 31); ctx.lineTo(inner.x + inner.w / 2, wheel.y + 31); ctx.stroke();

    var optionCount = options.length;
    var position = Number(gate.wheelPosition) || 0;
    if (optionCount > 0) position = ((position % optionCount) + optionCount) % optionCount;
    var itemGap = 55;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < optionCount; i++) {
      var rel = i - position;
      if (optionCount > 1) {
        if (rel > optionCount / 2) rel -= optionCount;
        else if (rel < -optionCount / 2) rel += optionCount;
      }
      if (Math.abs(rel) > 2.7) continue;
      var d = Math.abs(rel);
      var y = wheel.y + rel * itemGap;
      var opt = options[i] || {};
      var label = '第' + Math.max(1, Number(opt.formalNumber) || 1) + '关 · ' + String(opt.title || '');
      if (d < 0.52) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff2b1';
        ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
        ctx.font = 'bold 25px ' + UI_FONT;
      } else if (d < 1.55) {
        ctx.globalAlpha = 0.68;
        ctx.fillStyle = '#f1f4f6';
        ctx.shadowColor = 'rgba(0,0,0,.72)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
        ctx.font = 'bold 16px ' + UI_FONT;
      } else {
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#d8dee2';
        ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
        ctx.font = '12px ' + UI_FONT;
      }
      ctx.fillText(label, wheel.x, y);
      if (d < 0.52 && opt.titleEn) {
        ctx.globalAlpha = 0.66;
        ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 0;
        ctx.font = '10px ' + UI_FONT;
        ctx.fillText(String(opt.titleEn), wheel.x, y + 21);
      }
    }
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.globalAlpha = 1;

    var topShade = ctx.createLinearGradient(0, inner.y - inner.h / 2, 0, inner.y - 6);
    topShade.addColorStop(0, 'rgba(0,0,0,.92)');
    topShade.addColorStop(0.48, 'rgba(0,0,0,.55)');
    topShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topShade;
    ctx.beginPath();
    ctx.moveTo(inner.x - inner.w / 2, inner.y - inner.h / 2);
    ctx.lineTo(inner.x + inner.w / 2, inner.y - inner.h / 2);
    ctx.lineTo(inner.x + inner.w / 2, inner.y - 20);
    ctx.quadraticCurveTo(inner.x, inner.y + 8, inner.x - inner.w / 2, inner.y - 20);
    ctx.closePath(); ctx.fill();

    var bottomShade = ctx.createLinearGradient(0, inner.y + 6, 0, inner.y + inner.h / 2);
    bottomShade.addColorStop(0, 'rgba(0,0,0,0)');
    bottomShade.addColorStop(0.52, 'rgba(0,0,0,.55)');
    bottomShade.addColorStop(1, 'rgba(0,0,0,.92)');
    ctx.fillStyle = bottomShade;
    ctx.beginPath();
    ctx.moveTo(inner.x - inner.w / 2, inner.y + 20);
    ctx.quadraticCurveTo(inner.x, inner.y - 8, inner.x + inner.w / 2, inner.y + 20);
    ctx.lineTo(inner.x + inner.w / 2, inner.y + inner.h / 2);
    ctx.lineTo(inner.x - inner.w / 2, inner.y + inner.h / 2);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.font = 'bold 17px ' + UI_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(gate.wheelAutoSpin ? '随机滚动中 · 滑动后固定关卡' : '上下滑动选择已解锁关卡', wheel.x, wheel.y + wheel.h / 2 + 21);
    ctx.restore();
  }

  function drawCenteredGateScoreLine(label, valueText, y, valueColor) {
    var labelFont = 'bold 18px ' + UI_FONT;
    var valueFont = 'bold 26px ' + UI_FONT;
    var gap = 7;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = labelFont;
    var labelWidth = ctx.measureText(label).width;
    ctx.font = valueFont;
    var valueWidth = ctx.measureText(valueText).width;
    var startX = (VIEW_W - labelWidth - gap - valueWidth) * 0.5;

    ctx.font = labelFont;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, startX, y);

    ctx.font = valueFont;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.96)';
    ctx.strokeText(valueText, startX + labelWidth + gap, y);
    ctx.fillStyle = valueColor;
    ctx.fillText(valueText, startX + labelWidth + gap, y);
    ctx.restore();
  }

  function drawUnlockGateOverlay() {
    var gate = cfg.unlockGateState || {};
    var score = Math.max(0, Math.round(Number(gate.currentScore) || 0));
    var threshold = Math.max(0, Math.round(Number(gate.threshold) || 0));
    var remaining = Math.max(0, Math.round(Number(gate.remaining) || Math.max(0, threshold - score)));
    var unlocked = gate.unlocked === true || (threshold > 0 && score >= threshold);
    var gateRound = Math.max(1, Math.round(Number(gate.roundNumber) || 1));
    var accent = unlocked ? '#6ef0a7' : '#ffd96a';
    var accentDark = unlocked ? '#103326' : '#3a2c08';

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.66)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    roundRect(ctx, 42, 150, VIEW_W - 84, 650, 30);
    ctx.fillStyle = 'rgba(8,15,27,.97)'; ctx.fill();
    ctx.strokeStyle = unlocked ? 'rgba(110,240,167,.78)' : 'rgba(255,223,112,.72)';
    ctx.lineWidth = 2; ctx.stroke();

    if (gate.celebrating) drawUnlockGateConfetti(gate);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = accent; ctx.font = 'bold 27px ' + UI_FONT;
    ctx.fillText(unlocked ? ('第' + gateRound + '轮 · 解锁第' + (gate.formalNumber || 4) + '关') : ('第' + gateRound + '轮 · 前方尚未解锁'), VIEW_W / 2, 202);
    ctx.fillStyle = 'rgba(255,255,255,.52)'; ctx.font = '11px ' + UI_FONT;
    ctx.fillText(unlocked ? ('LEVEL ' + (gate.formalNumber || 4) + ' UNLOCKED') : 'NEW DESTINATION LOCKED', VIEW_W / 2, 232);

    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 21px ' + UI_FONT;
    ctx.fillText(unlocked ? ('即将前往城市「' + String(gate.title || '') + '」') : ('目标：第' + (gate.formalNumber || 4) + '关 · ' + String(gate.title || '')), VIEW_W / 2, 278);
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = '12px ' + UI_FONT;
    ctx.fillText(String(gate.titleEn || ''), VIEW_W / 2, 304);

    if (unlocked) {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      roundRect(ctx, 78, 344, VIEW_W - 156, 112, 18); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.76)'; ctx.font = 'bold 16px ' + UI_FONT;
      ctx.fillText('本轮累计分', VIEW_W / 2, 370);
      ctx.font = 'bold 36px ' + UI_FONT;
      ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.96)';
      ctx.strokeText(score + ' 分', VIEW_W / 2, 410);
      ctx.fillStyle = '#62f09a';
      ctx.fillText(score + ' 分', VIEW_W / 2, 410);
      ctx.fillStyle = accent; ctx.font = 'bold 16px ' + UI_FONT;
      ctx.fillText('本关解锁条件已达成', VIEW_W / 2, 440);

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      roundRect(ctx, 70, 478, VIEW_W - 140, 116, 18); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '14px ' + UI_FONT;
      ctx.fillText('第' + (gate.formalNumber || 4) + '关「' + String(gate.title || '') + '」解锁分数', 92, 508);
      ctx.textAlign = 'right'; ctx.fillStyle = accent; ctx.font = 'bold 16px ' + UI_NUM;
      ctx.fillText(threshold + ' 分', VIEW_W - 92, 508);

      var hasNext = Number(gate.nextFormalNumber) > 0 && Number(gate.nextThreshold) > 0;
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '14px ' + UI_FONT;
      if (hasNext) {
        ctx.fillText('下一关 第' + gate.nextFormalNumber + '关「' + String(gate.nextTitle || '') + '」', 92, 554);
        ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px ' + UI_NUM;
        ctx.fillText(Math.max(0, Math.round(Number(gate.nextThreshold) || 0)) + ' 分', VIEW_W - 92, 554);
      } else {
        ctx.fillText('已是目前最后一关', 92, 554);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,.68)'; ctx.font = '14px ' + UI_FONT;
      ctx.fillText('点击下一关后，正式开始该关卡', VIEW_W / 2, 630);
      ctx.fillStyle = 'rgba(255,255,255,.44)'; ctx.font = '11px ' + UI_FONT;
      ctx.fillText('目的地已准备完成', VIEW_W / 2, 656);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      roundRect(ctx, 76, 320, VIEW_W - 152, 122, 18); ctx.fill();
      drawCenteredGateScoreLine('本轮累计分', score + ' 分', 348, '#62f09a');
      drawCenteredGateScoreLine('尚需', remaining + ' 分', 389, '#ff78aa');
      ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.font = 'bold 14px ' + UI_FONT;
      ctx.fillText('本轮合计需 ' + threshold + ' 分解锁关卡', VIEW_W / 2, 423);
      ctx.fillStyle = accent; ctx.font = 'bold 14px ' + UI_FONT;
      ctx.fillText('先从已解锁关卡继续累积本轮分数', VIEW_W / 2, 454);
      drawMetalStageWheel(gate);
    }

    var btn = { x: VIEW_W / 2, y: 746, w: 250, h: 64 };
    hotspots.unlockGateConfirm = btn;
    roundRect(ctx, btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h, 20);
    ctx.fillStyle = accent; ctx.fill();
    ctx.fillStyle = accentDark; ctx.font = 'bold 20px ' + UI_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(unlocked ? '下一关' : '确认跳关', btn.x, btn.y + 1);
    ctx.restore();
  }

  function drawPauseButton() {
    var isPaused = cfg.scene === 'paused';
    var kind = isPaused ? 'play' : 'pause';
    var pressed = cfg.uiPressVisual === kind;
    // 暂停按钮在横幅内垂直居中并适度放大，增强触控识别与视觉稳定性。
    var btn = { x: VIEW_W - 39, y: 49, w: 76, h: 60, r: 38 };
    // 视觉按钮保持紧凑，触控热区独立放大，降低高分屏与单手操作时的漏按率。
    hotspots.pause = { x: btn.x, y: btn.y, w: 94, h: 82, r: 47 };
    ctx.save();
    if (pressed) { ctx.translate(btn.x, btn.y); ctx.scale(0.92, 0.92); ctx.translate(-btn.x, -btn.y); }
    ctx.shadowColor = 'rgba(0,0,0,.48)';
    ctx.shadowBlur = pressed ? 3 : 8;
    ctx.shadowOffsetY = pressed ? 1 : 3;
    if (!drawUiSpriteButton(kind, btn.x, btn.y, btn.w, btn.h, pressed)) {
      roundRect(ctx, btn.x - btn.w * 0.5, btn.y - btn.h * 0.5, btn.w, btn.h, 14);
      var grad = ctx.createLinearGradient(btn.x, btn.y - btn.h * 0.5, btn.x, btn.y + btn.h * 0.5);
      grad.addColorStop(0, '#ffc74a');
      grad.addColorStop(1, '#f09c18');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = '#7a4312';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#5b351c';
      ctx.lineWidth = 2;
      if (isPaused) {
        ctx.beginPath(); ctx.moveTo(btn.x - 6, btn.y - 10); ctx.lineTo(btn.x + 11, btn.y); ctx.lineTo(btn.x - 6, btn.y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(btn.x - 8, btn.y - 10, 5, 20);
        ctx.fillRect(btn.x + 3, btn.y - 10, 5, 20);
        ctx.strokeRect(btn.x - 8, btn.y - 10, 5, 20);
        ctx.strokeRect(btn.x + 3, btn.y - 10, 5, 20);
      }
    }
    ctx.restore();
  }

  function drawEditorEnterButton() {
    hotspots.editorEnter = null;
    if (!cfg.editorButtonVisible || cfg.scene === 'loading' || cfg.scene === 'editor') return;
    var pressed = cfg.uiPressVisual === 'editor_enter';
    var btn = { x: VIEW_W - 78, y: 102, w: 126, h: 44 };
    hotspots.editorEnter = btn;
    ctx.save();
    if (pressed) { ctx.translate(btn.x, btn.y); ctx.scale(0.94, 0.94); ctx.translate(-btn.x, -btn.y); }
    ctx.shadowColor = 'rgba(0,0,0,.52)'; ctx.shadowBlur = pressed ? 4 : 11; ctx.shadowOffsetY = pressed ? 2 : 5;
    roundRect(ctx, btn.x - btn.w * 0.5, btn.y - btn.h * 0.5, btn.w, btn.h, 18);
    var grad = ctx.createLinearGradient(btn.x - btn.w * 0.5, btn.y, btn.x + btn.w * 0.5, btn.y);
    grad.addColorStop(0, '#173b42'); grad.addColorStop(1, '#0d252d');
    ctx.fillStyle = grad; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#6ef0a7'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd85f'; ctx.beginPath(); ctx.arc(btn.x - 42, btn.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#15323a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(btn.x - 48, btn.y - 5); ctx.lineTo(btn.x - 42, btn.y - 9); ctx.lineTo(btn.x - 36, btn.y - 5); ctx.lineTo(btn.x - 36, btn.y + 7); ctx.lineTo(btn.x - 48, btn.y + 7); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('编辑地图', btn.x + 14, btn.y + 1);
    ctx.restore();
  }

  function drawEditorGuides(focusX) {
    var selected = cfg.editorState && cfg.editorState.selected;
    var z = editorZoom();
    var line = clamp(2 / z, 1.5, 22);
    var selectedLine = clamp(4 / z, 3, 38);
    var labelR = clamp(11 / z, 8, 96);
    var labelFont = clamp(11 / z, 9, 96);
    function isSelected(kind, index) { return !!selected && selected.kind === kind && selected.index === index; }
    function guideCircle(x, y, r, kind, index, label) {
      ctx.save();
      ctx.strokeStyle = isSelected(kind, index) ? '#6ef0a7' : 'rgba(255,255,255,.76)';
      ctx.lineWidth = isSelected(kind, index) ? selectedLine : line;
      if (!isSelected(kind, index)) ctx.setLineDash([clamp(6 / z, 4, 30), clamp(5 / z, 4, 26)]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(5,14,24,.82)'; ctx.beginPath(); ctx.arc(x, y - r - labelR * 1.1, labelR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold ' + labelFont + 'px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y - r - labelR * 1.1);
      ctx.restore();
    }
    var lv = cfg.runtimeLevel;
    guideCircle(worldToScreenX(lv.start.x, focusX), lv.start.y, 34, 'start', 0, 'S');
    lv.anchors.forEach(function(o, i) { guideCircle(worldToScreenX(o.x, focusX), o.y, 25, 'anchor', i, 'A'); });
    lv.foods.forEach(function(o, i) { guideCircle(worldToScreenX(o.x, focusX), o.y, 25, 'food', i, 'F'); });
    lv.bumpers.forEach(function(o, i) { guideCircle(worldToScreenX(o.x, focusX), o.y, o.r + 7, 'bumper', i, o.hazard ? 'H' : 'B'); });
    lv.walls.forEach(function(o, i) {
      var x = worldToScreenX(o.x, focusX);
      ctx.save(); ctx.strokeStyle = isSelected('wall', i) ? '#6ef0a7' : 'rgba(255,255,255,.76)';
      ctx.lineWidth = isSelected('wall', i) ? selectedLine : line;
      if (!isSelected('wall', i)) ctx.setLineDash([clamp(6 / z, 4, 30), clamp(5 / z, 4, 26)]);
      ctx.strokeRect(x - 5, o.y - 5, o.w + 10, o.h + 10); ctx.setLineDash([]);
      var badgeW = clamp(22 / z, 18, 190), badgeH = clamp(18 / z, 15, 155);
      ctx.fillStyle = 'rgba(5,14,24,.82)'; ctx.fillRect(x + 4, o.y - badgeH - 5, badgeW, badgeH);
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + labelFont + 'px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var wallBadge = o.powerSpring ? '2X' : (o.oneShot ? (o.axis === 'vertical' ? '1V' : '1H') : (o.spring ? (o.axis === 'vertical' ? 'PV' : 'PH') : (o.material === 'stump' ? (o.axis === 'vertical' ? '竖桩' : '横桩') : (o.axis === 'vertical' ? '竖墙' : '横墙'))));
      ctx.fillText(wallBadge, x + 4 + badgeW * 0.5, o.y - badgeH * 0.5 - 5); ctx.restore();
    });
    var finishX = worldToScreenX(lv.finish.x, focusX);
    ctx.save(); ctx.strokeStyle = isSelected('finish', 0) ? '#6ef0a7' : 'rgba(255,255,255,.72)'; ctx.lineWidth = isSelected('finish', 0) ? selectedLine : line;
    ctx.setLineDash([clamp(8 / z, 5, 40), clamp(6 / z, 4, 30)]); ctx.beginPath(); ctx.moveTo(finishX, 0); ctx.lineTo(finishX, lv.height); ctx.stroke(); ctx.setLineDash([]); ctx.restore();

    // [删除选中·就地删除] 2026-10-12：选中物体/道具后，在其右上角画一颗红色 ✕ 徽标，点它即删除该物体。
    // 目的：左侧固定「删除选中」按钮在真机/大屏上不好点、易漏点 → 就地删除彻底解决。
    if (selected && selected.kind !== 'start' && selected.kind !== 'finish') {
      var selC = null;
      if (selected.kind === 'anchor') { var oga = lv.anchors[selected.index]; if (oga) selC = { x: oga.x, y: oga.y }; }
      else if (selected.kind === 'food') { var ogf = lv.foods[selected.index]; if (ogf) selC = { x: ogf.x, y: ogf.y }; }
      else if (selected.kind === 'bumper') { var ogb = lv.bumpers[selected.index]; if (ogb) selC = { x: ogb.x, y: ogb.y }; }
      else if (selected.kind === 'wall') { var ogw = lv.walls[selected.index]; if (ogw) selC = { x: ogw.x + ogw.w * 0.5, y: ogw.y + ogw.h * 0.5 }; }
      if (selC) {
        var vpI = editorViewport(), zI = editorZoom();
        var camYI = (cfg.editorState && cfg.editorState.cameraY) || 0;
        var offXI = Math.max(0, (vpI.w - cfg.runtimeLevel.width * zI) * 0.5);
        var offYI = Math.max(0, (vpI.h - cfg.runtimeLevel.height * zI) * 0.5);
        var brI = 22;   // 屏幕半径（逻辑像素，恒定）
        var scrXI = vpI.x + offXI + (selC.x - cfg.cameraX) * zI + 34;
        var scrYI = vpI.y + offYI + (selC.y - camYI) * zI - 34;
        // 夹在视口内，确保任何位置都看得见、点得到
        scrXI = clamp(scrXI, vpI.x + brI + 6, vpI.x + vpI.w - brI - 6);
        scrYI = clamp(scrYI, vpI.y + brI + 6, vpI.y + vpI.h - brI - 6);
        var localXI = (scrXI - vpI.x - offXI) / zI;
        var localYI = (scrYI - vpI.y - offYI) / zI + camYI;
        var rWI = brI / zI;
        ctx.save();
        ctx.beginPath(); ctx.arc(localXI, localYI, rWI, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,60,82,.96)'; ctx.fill();
        ctx.lineWidth = clamp(3 / zI, 2, 26); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
        var kkI = rWI * 0.40;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = clamp(4 / zI, 2.5, 30); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(localXI - kkI, localYI - kkI); ctx.lineTo(localXI + kkI, localYI + kkI);
        ctx.moveTo(localXI + kkI, localYI - kkI); ctx.lineTo(localXI - kkI, localYI + kkI);
        ctx.stroke();
        ctx.restore();
        hotspots.editorDeleteInline = { x: scrXI, y: scrYI, r: brI + 12 };   // 热区略大，逻辑像素
      }
    }
  }

  function selectedEditorLabel() {
    var sel = cfg.editorState && cfg.editorState.selected;
    if (!sel) return '未选择物品';
    if (sel.kind === 'start') return '起始点（不可删除）';
    if (sel.kind === 'finish') return '终点（不可删除）';
    var obj = null;
    if (sel.kind === 'anchor') obj = cfg.runtimeLevel.anchors[sel.index];
    else if (sel.kind === 'food') obj = cfg.runtimeLevel.foods[sel.index];
    else if (sel.kind === 'bumper') obj = cfg.runtimeLevel.bumpers[sel.index];
    else if (sel.kind === 'wall') obj = cfg.runtimeLevel.walls[sel.index];
    if (sel.kind === 'anchor') return '锚点 ' + ((obj && obj.id) || '');
    if (sel.kind === 'food') return '食物 ' + ((obj && obj.id) || '');
    if (sel.kind === 'bumper') return (obj && obj.hazard ? '危险球 ' : '弹球 ') + ((obj && obj.id) || '');
    if (sel.kind === 'wall') {
      if (obj && obj.powerSpring) return '增强横弹簧垫 ' + (obj.id || '');
      if (obj && obj.oneShot) return (obj.axis === 'vertical' ? '一次竖弹簧垫 ' : '一次横弹簧垫 ') + (obj.id || '');
      if (obj && obj.spring) return (obj.axis === 'vertical' ? '竖向反弹垫 ' : '横向反弹垫 ') + (obj.id || '');
      if (obj && obj.material === 'stump') return (obj.axis === 'vertical' ? '竖的树桩 ' : '横的树桩 ') + (obj.id || '');
      return (obj && obj.axis === 'vertical' ? '竖的墙体 ' : '横的墙体 ') + (obj.id || '');
    }
    return '已选择物品';
  }

  function drawEditorOverlay(focusX) {
    var vp = editorViewport();
    ctx.save();
    ctx.fillStyle = 'rgba(5,14,24,.94)'; ctx.fillRect(0, 0, VIEW_W, 76);
    ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 20px ' + UI_FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('地图编辑器', 16, 28);
    ctx.fillStyle = '#dbe7ef'; ctx.font = '12px ' + UI_FONT; ctx.fillText(selectedEditorLabel(), 16, 54);
    var save = { x: VIEW_W - 86, y: 38, w: 158, h: 48 };
    hotspots.editorSave = save;
    roundRect(ctx, save.x - save.w * 0.5, save.y - save.h * 0.5, save.w, save.h, 15);
    ctx.fillStyle = '#6ef0a7'; ctx.fill();
    ctx.fillStyle = '#103326'; ctx.font = 'bold 18px ' + UI_FONT; ctx.textAlign = 'center'; ctx.fillText('保存/载入', save.x, save.y + 1);
    var portalPreview = { x: VIEW_W - 250, y: 38, w: 142, h: 42 };
    hotspots.editorPortalPreview = portalPreview;
    roundRect(ctx, portalPreview.x - portalPreview.w * 0.5, portalPreview.y - portalPreview.h * 0.5, portalPreview.w, portalPreview.h, 13);
    ctx.fillStyle = 'rgba(128,93,255,.86)'; ctx.fill();
    ctx.strokeStyle = 'rgba(206,190,255,.74)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center'; ctx.fillText('穿越预览', portalPreview.x, portalPreview.y + 1);
    if (cfg.editorState && cfg.editorState.dirty) { ctx.fillStyle = '#ffd95c'; ctx.beginPath(); ctx.arc(8, 28, 4.5, 0, Math.PI * 2); ctx.fill(); }

    // [2026-10-13] 现场三地图（甲/乙/丙）切换标签页 —— 只在现场(kiosk)地图编辑器出现。
    //   [v27 按用户要求] 黄底黑字大按钮（详见下方绘制处），
    //   画在地图区顶部（左栏右侧）；点击真实切换三张地图，各自独立编辑、各自保存
    //   （切图前自动把当前这张落盘）。绘制放在左栏面板之后，避免被面板盖住。
    hotspots.editorMapTabs = null;

    ctx.fillStyle = 'rgba(7,18,29,.96)'; ctx.fillRect(0, 76, vp.x, VIEW_H - 76);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(vp.x - 1, 76); ctx.lineTo(vp.x - 1, VIEW_H); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'left'; ctx.fillText('新增物品', 14, 101);

    // [2026-10-13] 现场三地图（甲/乙/丙）切换按钮 —— 只在现场(kiosk)地图编辑器出现。
    //   [v27 按用户要求] 黄底黑字：上方从左到右「地图甲/地图乙/地图丙」，横排在地图区顶部。
    //   当前地图=实心黄+黑粗边框高亮；非当前=半透明黄底+黑细边。点击真实切换三张地图，
    //   各自独立编辑、各自保存（切图前自动落盘，core __kioskSwitchMapEditor）。
    var rawMapTab = cfg.editorState ? cfg.editorState.mapTab : null;
    // [2026-10-14 v32 修复] 网页版编辑器**一律显示**甲/乙/丙三按钮（用户多次反馈编辑页看不到）：
    //   无论从哪条路径进入编辑器（现场 __kioskOpenMapEditor / 菜单内普通编辑器），
    //   只要 scene==='editor' 就显示；mapTab 为 null 时按 0(甲) 兜底。
    //   本文件是网页版独立快照，不影响小游戏端。
    var mapTabShown = (typeof rawMapTab === 'number' && rawMapTab >= 0) ? (rawMapTab % 3) : 0;
    if (mapTabShown !== null) {
      var mapTabActive = mapTabShown;
      var mapTabNames = ['地图甲', '地图乙', '地图丙'];
      var tabW = 124, tabH = 52, tabGap = 10, tabY = 112;
      var tabSpan = tabW * 3 + tabGap * 2;
      var tabStart = vp.x + (VIEW_W - vp.x - tabSpan) * 0.5 + tabW * 0.5;   // 在地图区内居中
      var tabList = [];
      for (var mti = 0; mti < 3; mti++) {
        var tabX = tabStart + mti * (tabW + tabGap);
        var tab = { x: tabX, y: tabY, w: tabW, h: tabH, index: mti };
        tabList.push(tab);
        var tabOn = (mti === mapTabActive);
        roundRect(ctx, tabX - tabW * 0.5, tabY - tabH * 0.5, tabW, tabH, 12);
        ctx.fillStyle = tabOn ? '#ffd95c' : 'rgba(255,217,92,.62)'; ctx.fill();
        if (tabOn) { ctx.strokeStyle = '#111111'; ctx.lineWidth = 3.5; ctx.stroke(); }
        else { ctx.strokeStyle = 'rgba(17,17,17,.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 23px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(mapTabNames[mti], tabX, tabY + 1);
      }
      hotspots.editorMapTabs = tabList;
    }
    var addDefs = [
      ['anchor', '锚点', 'A'], ['food', '食物', 'F'], ['bumper', '弹球', 'B'], ['hazard', '危险球', 'H'],
      ['springH', '横反弹垫', '↥'], ['springV', '竖反弹垫', '→'],
      ['powerSpringH', '增强横弹簧', '2×'], ['oneShotSpringV', '一次竖弹簧垫', '1V'],
      ['oneShotSpringH', '一次横弹簧垫', '1H'],
      ['wallH', '横的墙体', '横墙'], ['wallV', '竖的墙体', '竖墙'],
      ['stumpH', '横的树桩', '横桩'], ['stumpV', '竖的树桩', '竖桩']
    ];
    hotspots.editorAdd = [];
    for (var i = 0; i < addDefs.length; i++) {
      var y = 123 + i * 29;
      var btn = { x: 68, y: y, w: 116, h: 27, kind: addDefs[i][0] };
      hotspots.editorAdd.push(btn);
      roundRect(ctx, btn.x - btn.w * 0.5, btn.y - btn.h * 0.5, btn.w, btn.h, 10);
      ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center'; ctx.fillText(addDefs[i][2], 27, y + 1);
      ctx.fillStyle = '#ffffff'; ctx.font = '14px ' + UI_FONT; ctx.textAlign = 'left'; ctx.fillText(addDefs[i][1], 43, y + 1);
    }

    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px ' + UI_FONT; ctx.textAlign = 'left'; ctx.fillText('地图缩放', 14, 515);
    var zoomOut = { x: 31, y: 548, w: 40, h: 34 }, zoomIn = { x: 105, y: 548, w: 40, h: 34 };
    hotspots.editorZoomOut = zoomOut; hotspots.editorZoomIn = zoomIn;
    [zoomOut, zoomIn].forEach(function(btn) { roundRect(ctx, btn.x-btn.w/2, btn.y-btn.h/2, btn.w, btn.h, 9); ctx.fillStyle='rgba(255,255,255,.12)';ctx.fill(); });
    ctx.fillStyle='#fff';ctx.font='bold 22px ' + UI_FONT;ctx.textAlign='center';ctx.fillText('−',zoomOut.x,zoomOut.y);ctx.fillText('+',zoomIn.x,zoomIn.y);
    ctx.fillStyle='#9fd9bc';ctx.font='bold 13px ' + UI_NUM;ctx.fillText(Math.round(editorZoom()*100)+'%',68,548);
    var fit = { x: 68, y: 590, w: 116, h: 34 }; hotspots.editorFit = fit;
    roundRect(ctx, fit.x-fit.w/2, fit.y-fit.h/2, fit.w, fit.h, 9);ctx.fillStyle='rgba(110,240,167,.16)';ctx.fill();ctx.strokeStyle='rgba(110,240,167,.5)';ctx.stroke();
    ctx.fillStyle='#baf8d4';ctx.font='bold 14px ' + UI_FONT;ctx.fillText('显示整张地图',fit.x,fit.y+1);

    var selected = cfg.editorState && cfg.editorState.selected;
    var selectedObj = null;
    if (selected && selected.kind === 'wall') selectedObj = cfg.runtimeLevel.walls[selected.index];
    var deletable = !!selected && selected.kind !== 'start' && selected.kind !== 'finish';
    var del = { x: 68, y: 642, w: 132, h: 50 }; hotspots.editorDelete = del;
    roundRect(ctx, del.x-del.w/2, del.y-del.h/2, del.w, del.h, 10);ctx.fillStyle=deletable?'rgba(255,91,111,.86)':'rgba(255,255,255,.08)';ctx.fill();
    ctx.fillStyle=deletable?'#ffffff':'rgba(255,255,255,.35)';ctx.font='bold 15px ' + UI_FONT;ctx.fillText('删除选中',del.x,del.y+1);

    // [v54 现场测试] 快速过关：随机产生三位角色三关分数（各 1000~2000）→ 总分结算画面 → 500 强排行榜。
    //   替代原「选关跳关 / 解锁分数测试」调试块（已按用户要求移除）。
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px ' + UI_FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('测试工具', 14, 672);
    var qc = { x: 68, y: 712, w: 120, h: 46 }; hotspots.editorQuickClear = qc;
    roundRect(ctx, qc.x - qc.w / 2, qc.y - qc.h / 2, qc.w, qc.h, 12);
    ctx.fillStyle = '#ff5b6e'; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('快速过关 ▶', qc.x, qc.y + 1);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = 'bold 12px ' + UI_FONT;
    ctx.fillText('随机三关分数 1000~2000', qc.x, qc.y + 42);
    ctx.fillText('直进总分结算 → 排行榜', qc.x, qc.y + 60);

    ctx.fillStyle = 'rgba(5,14,24,.90)'; ctx.fillRect(vp.x, VIEW_H - 58, VIEW_W - vp.x, 58);
    ctx.fillStyle = '#ffffff'; ctx.font = '13px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.fillText('点击选择 · 拖动移动 · 滚轮缩放 · 空白处拖动浏览', vp.x + vp.w * 0.5, VIEW_H - 34);
    ctx.restore();
  }

  function editorFileDialogText(value, maxChars) {
    var text = String(value || '');
    maxChars = Math.max(8, Number(maxChars) || 30);
    if (text.length <= maxChars) return text;
    return '…' + text.slice(-(maxChars - 1));
  }

  function drawEditorFileDialog() {
    var state = cfg.editorState && cfg.editorState.fileDialog;
    if (!state || !state.open) return;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var view = state.view || 'menu';
    var card = view === 'load'
      ? { x: 46, y: 92, w: VIEW_W - 92, h: 772 }
      : { x: 54, y: view === 'save' ? 142 : 180, w: VIEW_W - 108, h: view === 'save' ? 648 : 566 };
    roundRect(ctx, card.x, card.y, card.w, card.h, 24);
    ctx.fillStyle = 'rgba(8,18,31,.985)'; ctx.fill();
    ctx.strokeStyle = 'rgba(110,240,167,.55)'; ctx.lineWidth = 2; ctx.stroke();

    var close = { x: card.x + card.w - 30, y: card.y + 30, r: 17 };
    hotspots.editorFileClose = close;
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.arc(close.x, close.y, close.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×', close.x, close.y - 1);

    ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 25px ' + UI_FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(view === 'save' ? '另存新檔' : (view === 'load' ? '载入地图' : '保存 / 载入'), card.x + 24, card.y + 37);

    if (view === 'menu') {
      ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = '13px ' + UI_FONT;
      ctx.fillText('完整地图包格式：level_pack.json', card.x + 24, card.y + 76);

      var saveAs = { x: VIEW_W * 0.5, y: card.y + 142, w: card.w - 52, h: 72 };
      var loadMap = { x: VIEW_W * 0.5, y: card.y + 238, w: card.w - 52, h: 72 };
      var quickCopy = { x: VIEW_W * 0.5, y: card.y + 334, w: card.w - 52, h: 72 };
      hotspots.editorFileSaveAs = saveAs; hotspots.editorFileLoadMap = loadMap; hotspots.editorFileQuickCopy = quickCopy;
      [saveAs, loadMap, quickCopy].forEach(function(btn, index) {
        roundRect(ctx, btn.x - btn.w * 0.5, btn.y - btn.h * 0.5, btn.w, btn.h, 18);
        ctx.fillStyle = index === 0 ? 'rgba(110,240,167,.20)' : (index === 1 ? 'rgba(128,93,255,.22)' : 'rgba(255,182,39,.16)'); ctx.fill();
        ctx.strokeStyle = index === 0 ? 'rgba(110,240,167,.70)' : (index === 1 ? 'rgba(190,172,255,.70)' : 'rgba(255,213,114,.68)'); ctx.lineWidth = 1.5; ctx.stroke();
      });
      ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px ' + UI_FONT;
      ctx.fillText('另存新檔', saveAs.x - saveAs.w * 0.5 + 25, saveAs.y - 10);
      ctx.fillStyle = 'rgba(255,255,255,.60)'; ctx.font = '13px ' + UI_FONT;
      ctx.fillText('保存全部地图、导出到电脑或复制完整 JSON', saveAs.x - saveAs.w * 0.5 + 25, saveAs.y + 18);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px ' + UI_FONT;
      ctx.fillText('载入地图', loadMap.x - loadMap.w * 0.5 + 25, loadMap.y - 10);
      ctx.fillStyle = 'rgba(255,255,255,.60)'; ctx.font = '13px ' + UI_FONT;
      ctx.fillText('从 TOOLS 或外部 level_pack.json 载入全部地图', loadMap.x - loadMap.w * 0.5 + 25, loadMap.y + 18);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px ' + UI_FONT;
      ctx.fillText(state.busy ? '复制中…' : '复制 JSON', quickCopy.x - quickCopy.w * 0.5 + 25, quickCopy.y - 10);
      ctx.fillStyle = 'rgba(255,255,255,.60)'; ctx.font = '13px ' + UI_FONT;
      ctx.fillText('复制目前全部地图的完整 level_pack.json 代码', quickCopy.x - quickCopy.w * 0.5 + 25, quickCopy.y + 18);

      var exit = { x: VIEW_W * 0.5, y: card.y + card.h - 50, w: 210, h: 46 };
      hotspots.editorFileExit = exit;
      roundRect(ctx, exit.x - exit.w * 0.5, exit.y - exit.h * 0.5, exit.w, exit.h, 13);
      ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
      ctx.fillStyle = '#dbe7ef'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center'; ctx.fillText('保存并离开编辑器', exit.x, exit.y + 1);
    } else if (view === 'save') {
      ctx.fillStyle = 'rgba(255,255,255,.58)'; ctx.font = '13px ' + UI_FONT; ctx.textAlign = 'left';
      ctx.fillText('游戏内地图目录（固定）', card.x + 24, card.y + 103);
      var pathBtn = { x: VIEW_W * 0.5, y: card.y + 145, w: card.w - 48, h: 64 };
      hotspots.editorFilePath = null;
      roundRect(ctx, pathBtn.x - pathBtn.w * 0.5, pathBtn.y - pathBtn.h * 0.5, pathBtn.w, pathBtn.h, 13);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.20)'; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = '13px ' + UI_NUM; ctx.textAlign = 'left';
      ctx.fillText('TOOLS', pathBtn.x - pathBtn.w * 0.5 + 14, pathBtn.y + 1);
      ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 13px ' + UI_FONT; ctx.textAlign = 'right'; ctx.fillText('统一目录', pathBtn.x + pathBtn.w * 0.5 - 14, pathBtn.y + 1);

      ctx.fillStyle = 'rgba(255,255,255,.58)'; ctx.font = '13px ' + UI_FONT; ctx.textAlign = 'left';
      ctx.fillText('文件名', card.x + 24, card.y + 225);
      var nameBtn = { x: VIEW_W * 0.5, y: card.y + 267, w: card.w - 48, h: 64 };
      hotspots.editorFileName = nameBtn;
      roundRect(ctx, nameBtn.x - nameBtn.w * 0.5, nameBtn.y - nameBtn.h * 0.5, nameBtn.w, nameBtn.h, 13);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.20)'; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = '14px ' + UI_NUM; ctx.textAlign = 'left';
      ctx.fillText(editorFileDialogText(state.filename || 'level.json', 34), nameBtn.x - nameBtn.w * 0.5 + 14, nameBtn.y + 1);
      ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 13px ' + UI_FONT; ctx.textAlign = 'right'; ctx.fillText('修改', nameBtn.x + nameBtn.w * 0.5 - 14, nameBtn.y + 1);

      ctx.fillStyle = 'rgba(255,255,255,.50)'; ctx.font = '12px ' + UI_FONT; ctx.textAlign = 'left';
      ctx.fillText('保存到游戏固定写入 wx.env.USER_DATA_PATH/TOOLS。', card.x + 24, card.y + 324);
      if (state.message) {
        ctx.fillStyle = state.error ? '#ff8ca5' : '#aeeecb'; ctx.font = '13px ' + UI_FONT;
        ctx.fillText(editorFileDialogText(state.message, 48), card.x + 24, card.y + 366);
      }

      var exportPc = { x: card.x + card.w * 0.31, y: card.y + 446, w: card.w * 0.49, h: 56 };
      var copyJson = { x: card.x + card.w * 0.75, y: card.y + 446, w: card.w * 0.35, h: 56 };
      hotspots.editorFileExportPc = exportPc; hotspots.editorFileCopyJson = copyJson;
      roundRect(ctx, exportPc.x - exportPc.w * 0.5, exportPc.y - exportPc.h * 0.5, exportPc.w, exportPc.h, 14);
      ctx.fillStyle = 'rgba(128,93,255,.28)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,172,255,.72)'; ctx.lineWidth = 1.5; ctx.stroke();
      roundRect(ctx, copyJson.x - copyJson.w * 0.5, copyJson.y - copyJson.h * 0.5, copyJson.w, copyJson.h, 14);
      ctx.fillStyle = 'rgba(110,240,167,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(110,240,167,.58)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText(state.busy ? '处理中…' : '导出到电脑', exportPc.x, exportPc.y + 1);
      ctx.fillText('复制 JSON', copyJson.x, copyJson.y + 1);
      ctx.fillStyle = 'rgba(255,255,255,.48)'; ctx.font = '11px ' + UI_FONT; ctx.textAlign = 'left';
      ctx.fillText('导出与复制均包含教学关及第1～10关的全部设定。', card.x + 24, card.y + 492);

      var back = { x: card.x + 92, y: card.y + card.h - 62, w: 112, h: 48 };
      var confirm = { x: card.x + card.w - 105, y: card.y + card.h - 62, w: 150, h: 52 };
      hotspots.editorFileBack = back; hotspots.editorFileConfirmSave = confirm;
      roundRect(ctx, back.x - back.w * 0.5, back.y - back.h * 0.5, back.w, back.h, 13); ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fill();
      roundRect(ctx, confirm.x - confirm.w * 0.5, confirm.y - confirm.h * 0.5, confirm.w, confirm.h, 14); ctx.fillStyle = '#6ef0a7'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center'; ctx.fillText('返回', back.x, back.y + 1);
      ctx.fillStyle = '#103326'; ctx.font = 'bold 17px ' + UI_FONT; ctx.fillText(state.busy ? '保存中…' : '保存到游戏', confirm.x, confirm.y + 1);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.58)'; ctx.font = '13px ' + UI_FONT; ctx.textAlign = 'left';
      ctx.fillText('游戏内地图目录（固定）', card.x + 24, card.y + 89);
      var loadPath = { x: VIEW_W * 0.5, y: card.y + 127, w: card.w - 48, h: 58 };
      hotspots.editorFilePath = null;
      roundRect(ctx, loadPath.x - loadPath.w * 0.5, loadPath.y - loadPath.h * 0.5, loadPath.w, loadPath.h, 12);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.20)'; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = '12px ' + UI_NUM; ctx.textAlign = 'left';
      ctx.fillText('TOOLS', loadPath.x - loadPath.w * 0.5 + 13, loadPath.y + 1);
      ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 12px ' + UI_FONT; ctx.textAlign = 'right'; ctx.fillText('统一目录', loadPath.x + loadPath.w * 0.5 - 13, loadPath.y + 1);

      var browse = { x: card.x + 96, y: card.y + 190, w: 138, h: 40 };
      var refresh = { x: card.x + card.w - 84, y: card.y + 190, w: 108, h: 40 };
      hotspots.editorFileBrowse = browse; hotspots.editorFileRefresh = refresh;
      [browse, refresh].forEach(function(btn) { roundRect(ctx, btn.x-btn.w/2, btn.y-btn.h/2, btn.w, btn.h, 11); ctx.fillStyle='rgba(255,255,255,.09)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.18)';ctx.stroke(); });
      ctx.fillStyle='#ffffff';ctx.font='bold 13px ' + UI_FONT;ctx.textAlign='center';ctx.fillText('选择外部 JSON',browse.x,browse.y+1);ctx.fillText('重新读取',refresh.x,refresh.y+1);

      var files = Array.isArray(state.files) ? state.files : [];
      var pageSize = 6, page = Math.max(0, Number(state.page) || 0);
      var maxPage = Math.max(0, Math.ceil(files.length / pageSize) - 1);
      if (page > maxPage) page = maxPage;
      state.page = page;
      var start = page * pageSize;
      hotspots.editorFileRows = [];
      for (var i = 0; i < pageSize; i++) {
        var idx = start + i;
        var row = { x: VIEW_W * 0.5, y: card.y + 258 + i * 63, w: card.w - 48, h: 52, fileIndex: idx };
        hotspots.editorFileRows.push(row);
        roundRect(ctx, row.x-row.w/2,row.y-row.h/2,row.w,row.h,11);
        var selected = idx === Number(state.selected);
        ctx.fillStyle = selected ? 'rgba(110,240,167,.22)' : 'rgba(255,255,255,.065)'; ctx.fill();
        ctx.strokeStyle = selected ? 'rgba(110,240,167,.72)' : 'rgba(255,255,255,.13)'; ctx.stroke();
        if (idx < files.length) {
          var entry = files[idx] || {};
          ctx.fillStyle = '#ffffff'; ctx.font = '13px ' + UI_NUM; ctx.textAlign = 'left';
          ctx.fillText(editorFileDialogText(entry.name || entry.path || '', 36), row.x - row.w/2 + 14, row.y - 6);
          ctx.fillStyle = 'rgba(255,255,255,.46)'; ctx.font = '11px ' + UI_FONT;
          ctx.fillText(entry.source === 'native' ? '外部电脑文件' : 'TOOLS 地图目录', row.x - row.w/2 + 14, row.y + 15);
        }
      }

      var prev = { x: card.x + 76, y: card.y + card.h - 112, w: 84, h: 38 };
      var next = { x: card.x + card.w - 76, y: card.y + card.h - 112, w: 84, h: 38 };
      hotspots.editorFilePrev = prev; hotspots.editorFileNext = next;
      [prev,next].forEach(function(btn){roundRect(ctx,btn.x-btn.w/2,btn.y-btn.h/2,btn.w,btn.h,10);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fill();});
      ctx.fillStyle='#ffffff';ctx.font='bold 13px ' + UI_FONT;ctx.textAlign='center';ctx.fillText('上一页',prev.x,prev.y+1);ctx.fillText('下一页',next.x,next.y+1);
      ctx.fillStyle='rgba(255,255,255,.50)';ctx.font='12px ' + UI_NUM;ctx.fillText((page+1)+' / '+(maxPage+1),VIEW_W*0.5,prev.y+1);

      if (state.message) {
        ctx.fillStyle = state.error ? '#ff8ca5' : '#aeeecb'; ctx.font = '12px ' + UI_FONT; ctx.textAlign='left';
        ctx.fillText(editorFileDialogText(state.message, 48), card.x + 24, card.y + card.h - 72);
      }
      var backLoad = { x: card.x + 84, y: card.y + card.h - 36, w: 104, h: 44 };
      var confirmLoad = { x: card.x + card.w - 105, y: card.y + card.h - 36, w: 150, h: 48 };
      hotspots.editorFileBack = backLoad; hotspots.editorFileConfirmLoad = confirmLoad;
      roundRect(ctx,backLoad.x-backLoad.w/2,backLoad.y-backLoad.h/2,backLoad.w,backLoad.h,12);ctx.fillStyle='rgba(255,255,255,.09)';ctx.fill();
      roundRect(ctx,confirmLoad.x-confirmLoad.w/2,confirmLoad.y-confirmLoad.h/2,confirmLoad.w,confirmLoad.h,13);ctx.fillStyle=Number(state.selected)>=0?'#6ef0a7':'rgba(255,255,255,.12)';ctx.fill();
      ctx.fillStyle='#ffffff';ctx.font='bold 14px ' + UI_FONT;ctx.textAlign='center';ctx.fillText('返回',backLoad.x,backLoad.y+1);
      ctx.fillStyle=Number(state.selected)>=0?'#103326':'rgba(255,255,255,.38)';ctx.font='bold 16px ' + UI_FONT;ctx.fillText(state.busy?'载入中…':'载入地图',confirmLoad.x,confirmLoad.y+1);
    }

    ctx.restore();
  }

  function drawLoadingScene() {
    var state = cfg.loadingState || { timer: 0, duration: 5 };
    var t = Math.max(0, Number(state.timer) || 0);
    var warmup = cfg.warmupSprite;
    var config = cfg.warmupConfig || {};
    var frameWidth = Math.max(1, Math.round(Number(config.frameWidth) || 160));
    var frameHeight = Math.max(1, Math.round(Number(config.frameHeight) || 160));
    var frameCount = Math.max(1, Math.round(Number(config.frameCount) || 40));
    var columns = Math.max(1, Math.round(Number(config.columns) || 8));
    var fps = Math.max(1, Number(config.fps) || 8);
    // 热身动作只完整播放一遍；播放完后停在最后一帧，直到资源真正就绪。
    var frameIndex = Math.min(frameCount - 1, Math.floor(t * fps));
    var realProgress = clamp(Number(state.progress) || 0, 0, 1);
    var completedFrames = realProgress >= 1 ? frameCount : Math.floor(realProgress * frameCount);
    var percent = realProgress >= 1 ? 100 : Math.floor(realProgress * 100);

    var g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#83c9ff');
    g.addColorStop(0.58, '#bdeab0');
    g.addColorStop(1, '#f8f0c1');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.beginPath(); ctx.ellipse(94, 112, 56, 23, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(282, 82, 66, 25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(472, 136, 58, 23, 0, 0, Math.PI * 2); ctx.fill();

    var displaySize = Math.min(VIEW_W - 72, Math.max(160, Number(config.displaySize) || 320));
    var drawX = Math.round((VIEW_W - displaySize) * 0.5);
    var drawY = Math.round((VIEW_H - displaySize) * 0.5);

    // 动画本体严格置于加载页正中央，并以最近邻方式放大，保持像素边缘。
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (warmup && warmup.ready && warmup.image) {
      var sourceX = (frameIndex % columns) * frameWidth;
      var sourceY = Math.floor(frameIndex / columns) * frameHeight;
      ctx.drawImage(warmup.image, sourceX, sourceY, frameWidth, frameHeight, drawX, drawY, displaySize, displaySize);
    }
    // 不再回退到 axi_curl：指定暖身图未准备好时宁可等待，也绝不播放错误精灵。
    ctx.restore();

    var titleY = Math.min(VIEW_H - 220, drawY + displaySize + 64);
    ctx.fillStyle = '#153a2b';
    ctx.font = 'bold 46px ' + UI_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u963f\u8725\u6696\u8eab\u4e2d', VIEW_W * 0.5, titleY);

    var barX = 48;
    var barY = titleY + 54;
    var barW = VIEW_W - barX * 2;
    var barH = 28;
    ctx.fillStyle = '#153a2b';
    roundRect(ctx, barX, barY, barW, barH, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillRect(barX + 4, barY + 4, barW - 8, barH - 8);

    // 进度格仅显示真实资源加载比例，不再与当前动作帧绑定。
    var gap = 1;
    var blockW = 9;
    var runW = frameCount * blockW + (frameCount - 1) * gap;
    var blockX = Math.round(barX + (barW - runW) * 0.5);
    for (var i = 0; i < frameCount; i++) {
      ctx.fillStyle = i < completedFrames ? '#54e69a' : 'rgba(21,58,43,.12)';
      ctx.fillRect(blockX + i * (blockW + gap), barY + 7, blockW, barH - 14);
    }

    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 20px ' + UI_NUM;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#153a2b';
    ctx.fillText('LOADING', barX, barY + 62);
    ctx.textAlign = 'right';
    ctx.fillText(('000' + percent).slice(-3) + '%', barX + barW, barY + 62);

    // 2026-09-29 新增：启动页底部固定展示「健康游戏忠告 + 适龄提示」。
    // 依据《关于防止未成年人沉迷网络游戏的通知》及微信小游戏上架规范，
    // 游戏须在启动界面显著位置展示健康忠告与适龄提示；软著文档鉴别材料亦要求截图体现。
    drawHealthNotice();
  }

  // 健康游戏忠告 + 适龄提示（启动页 / 主界面共用）
  // 说明：适龄等级常量 HEALTH_NOTICE_AGE_RATING 可整处替换，便于后续按审核要求调整。
  var HEALTH_NOTICE_LINES = [
    '抵制不良游戏，拒绝盗版游戏。',
    '适度游戏益脑，沉迷游戏伤身。',
    '合理安排时间，享受健康生活。'
  ];
  var HEALTH_NOTICE_AGE_RATING = '8+';
  function drawHealthNotice(opts) {
    opts = opts || {};
    var bottomPad = Number(opts.bottomPad) || 14;
    var fontSize = Number(opts.fontSize) || 12;
    var badgeSize = Number(opts.badgeSize) || 30;
    var lineGap = fontSize + 3;
    var totalH = HEALTH_NOTICE_LINES.length * lineGap;
    var startY = VIEW_H - bottomPad - totalH + lineGap * 0.5;

    ctx.save();
    ctx.textBaseline = 'middle';

    // 半透明暗底，保证浅色背景（蓝天/白云）上文字仍清晰可读
    var padY = 9;
    ctx.fillStyle = 'rgba(8,22,18,.42)';
    ctx.fillRect(0, VIEW_H - bottomPad - totalH - padY, VIEW_W, totalH + padY * 2);

    // 适龄提示标：圆角方框 + 等级文字，置于整块左侧
    var badgeX = 16;
    var badgeY = VIEW_H - bottomPad - totalH * 0.5 - badgeSize * 0.5;
    ctx.beginPath();
    roundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 7);
    ctx.fillStyle = '#2f9e6b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.round(badgeSize * 0.5) + 'px ' + UI_NUM;
    ctx.textAlign = 'center';
    ctx.fillText(HEALTH_NOTICE_AGE_RATING, badgeX + badgeSize * 0.5, badgeY + badgeSize * 0.5 + 1);

    // 忠告正文（三行）
    ctx.textAlign = 'left';
    ctx.font = fontSize + 'px ' + UI_FONT;
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    var textX = badgeX + badgeSize + 9;
    for (var i = 0; i < HEALTH_NOTICE_LINES.length; i++) {
      ctx.fillText(HEALTH_NOTICE_LINES[i], textX, startY + i * lineGap);
    }
    ctx.restore();
  }

  function drawDailyLoginPopup() {
    var popup = cfg.dailyLoginPopup || {};
    if (!popup.active || cfg.scene !== 'menu') return;

    var fadeSeconds = Math.max(0.1, Number(popup.fadeSeconds) || 0.45);
    var alpha = Number(popup.timer) < fadeSeconds ? Math.max(0, Number(popup.timer) / fadeSeconds) : 1;
    var title = String(popup.title || '口袋里尚有 0 颗黄金番薯');
    var subtitle = String(popup.subtitle || '');

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,.46)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var panelH = subtitle ? 230 : 180;
    var panel = { x: 58, y: Math.round((VIEW_H - panelH) * 0.5), w: VIEW_W - 116, h: panelH };
    ctx.shadowColor = 'rgba(0,0,0,.46)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 28);
    ctx.fillStyle = 'rgba(8,28,29,.97)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,216,95,.90)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 31px ' + UI_FONT;
    ctx.fillText(title, VIEW_W * 0.5, panel.y + (subtitle ? 76 : 90));

    if (subtitle) {
      if (subtitle.indexOf('黄金番薯') === 0) {
        var goldText = '黄金番薯';
        var tailText = subtitle.substring('黄金番薯'.length); // ' N颗'（数量跟随实际奖励值）
        var icon = cfg.dailyRewardIcon || (cfg.foodArtAssets && cfg.foodArtAssets.golden_sweet_potato) || null;
        var iconReady = !!(icon && icon.ready && icon.image);
        var iconGap = iconReady ? 7 : 0;
        var iconSize = 29;
        ctx.fillStyle = '#ffd85f';
        ctx.font = 'bold 36px ' + UI_FONT;
        var goldW = ctx.measureText(goldText).width;
        var tailW = ctx.measureText(tailText).width;
        var totalW = goldW + tailW + (iconReady ? iconSize + iconGap * 2 : 0);
        var startX = VIEW_W * 0.5 - totalW * 0.5;
        var lineY = panel.y + 145;
        ctx.textAlign = 'left';
        ctx.fillText(goldText, startX, lineY);
        var cursorX = startX + goldW;
        if (iconReady) {
          var iw = icon.image.naturalWidth || icon.image.width || 1;
          var ih = icon.image.naturalHeight || icon.image.height || 1;
          var scale = Math.min(iconSize / iw, iconSize / ih);
          var dw = iw * scale, dh = ih * scale;
          ctx.drawImage(icon.image, cursorX + iconGap, lineY - dh * 0.5, dw, dh);
          cursorX += iconGap * 2 + iconSize;
        }
        ctx.fillText(tailText, cursorX, lineY);
      } else {
        ctx.fillStyle = '#ffd85f';
        ctx.font = 'bold 27px ' + UI_FONT;
        ctx.textAlign = 'center';
        ctx.fillText(subtitle, VIEW_W * 0.5, panel.y + 145);
      }
    }

    ctx.restore();
  }

  function drawMenuScene() {
    var cover = drawCoverImage(cfg.homePoster);
    if (!cover) {
      drawBackground(0);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // [v41 新杭州版封面] PLAY 按钮中心实测 1080×1920 图内 (540,1503) → 视图 0.5/0.7825（旧封面是 0.808）
    hotspots.play = { x: VIEW_W * 0.5, y: VIEW_H * 0.7825, r: 116 };
    if (!cfg.menuIntroOpen) {
      // 首页排行榜使用新封面底部左侧奖杯图标位置的隐形热区，不额外绘制实体按钮。
      // [v41] 新杭州版封面（1080×1920）实测：三图标行 y≈1740/1920=0.906，奖杯 x≈334/1080 → 视图 (167,870)
      hotspots.menuLeaderboard = { x: 167, y: 870, r: 60 };

      roundRect(ctx, 18, 16, 214, 52, 18); ctx.fillStyle = 'rgba(5,14,24,.78)'; ctx.fill();
      ctx.fillStyle = '#ffd95c'; ctx.font = 'bold 13px ' + UI_FONT; ctx.textAlign = 'left'; ctx.fillText('永久累计', 38, 34);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px ' + UI_NUM; ctx.fillText(String(Math.max(0, cfg.progress.totalScore || 0)), 38, 57);
      var eco = cfg.economy || {};
      roundRect(ctx, VIEW_W - 210, 16, 192, 52, 18); ctx.fillStyle = 'rgba(5,14,24,.78)'; ctx.fill();
      // 2026-09-29 用户要求：右上角只有两种状态——恢复中（倒计时）/ 满血复活!（绿字，20 分钟恢复一到就直接变绿）。
      ctx.fillStyle = '#ffd95c'; ctx.font = 'bold 13px ' + UI_FONT; ctx.textAlign = 'left'; ctx.fillText('目前体力', VIEW_W - 192, 36);
      ctx.textAlign = 'right';
      if ((eco.availablePlays || 0) > 0 || eco.recoveryDone) {
        ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 19px ' + UI_FONT;
        ctx.fillText('满血复活!', VIEW_W - 30, 56);
      } else {
        var recSec = (eco.recoverSeconds || 0) > 0 ? eco.recoverSeconds : Math.round((Number(cfg.recoveryFullSeconds) || 1200));
        var mm2 = Math.floor(recSec / 60), ss2 = recSec % 60;
        ctx.fillStyle = '#ff9a6b'; ctx.font = 'bold 22px ' + UI_NUM;
        ctx.fillText(String(mm2).padStart(2,'0') + ':' + String(ss2).padStart(2,'0'), VIEW_W - 30, 57);
      }
      ctx.textAlign = 'left';
      // 使用封面底部中央已经存在的「皮肤」图标，不额外绘制按钮。[v41] 新封面图标行 y≈870
      hotspots.menuSkin = { x: 270, y: 870, r: 58 };
    }
    if (cfg.menuIntroOpen) drawMenuTutorialPopup();
  }


  function drawStageSelectOverlay() {
    if (!cfg.stageSelectOpen) return;
    var info = cfg.stageSelectInfo || {};
    var selectedNo = Math.max(1, Math.round(Number(info.formalNumber) || 1));
    var minNo = Math.max(1, Math.round(Number(cfg.stageSelectMinFormal) || 1));
    var maxNo = Math.max(minNo, Math.round(Number(cfg.stageSelectMaxFormal) || selectedNo));
    var sequential = !!cfg.stageSelectSequential;
    var roundNo = Math.max(1, Math.round(Number(cfg.stageSelectRound) || 1));

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var panel = { x: 38, y: 214, w: VIEW_W - 76, h: 526 };
    ctx.shadowColor = 'rgba(0,0,0,.58)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 28);
    ctx.fillStyle = 'rgba(7,18,28,.97)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,216,95,.82)';
    ctx.lineWidth = 3;
    ctx.stroke();

    hotspots.stageSelectClose = { x: panel.x + panel.w - 34, y: panel.y + 34, r: 25 };
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.beginPath(); ctx.arc(hotspots.stageSelectClose.x, hotspots.stageSelectClose.y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.62)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hotspots.stageSelectClose.x - 7, hotspots.stageSelectClose.y - 7);
    ctx.lineTo(hotspots.stageSelectClose.x + 7, hotspots.stageSelectClose.y + 7);
    ctx.moveTo(hotspots.stageSelectClose.x + 7, hotspots.stageSelectClose.y - 7);
    ctx.lineTo(hotspots.stageSelectClose.x - 7, hotspots.stageSelectClose.y + 7);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd85f';
    ctx.font = 'bold 34px ' + UI_FONT;
    ctx.fillText('选择关卡', VIEW_W * 0.5, panel.y + 62);
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.font = 'bold 14px ' + UI_FONT;
    ctx.fillText(sequential
      ? ('首次挑战须依序通关 · 当前仅开放第' + selectedNo + '关')
      : ('进度已自动保存 · 可选择第' + minNo + '关至第' + maxNo + '关'), VIEW_W * 0.5, panel.y + 91);

    var card = { x: panel.x + 34, y: panel.y + 124, w: panel.w - 68, h: 210 };
    roundRect(ctx, card.x, card.y, card.w, card.h, 24);
    ctx.fillStyle = 'rgba(255,255,255,.075)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,240,167,.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#6ef0a7';
    ctx.font = 'bold 18px ' + UI_NUM;
    ctx.fillText('ROUND ' + roundNo + '  ·  LEVEL ' + selectedNo, VIEW_W * 0.5, card.y + 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px ' + UI_FONT;
    ctx.fillText(String(info.title || ('第' + selectedNo + '关')), VIEW_W * 0.5, card.y + 105);
    ctx.fillStyle = '#8bd8ff';
    ctx.font = 'bold 16px ' + UI_NUM;
    ctx.fillText(String(info.titleEn || ('LEVEL ' + selectedNo)), VIEW_W * 0.5, card.y + 137);
    ctx.fillStyle = 'rgba(255,255,255,.56)';
    ctx.font = 'bold 14px ' + UI_FONT;
    ctx.fillText(sequential
      ? ('完成第 ' + selectedNo + ' 关后，自动解锁下一关')
      : ('第 ' + selectedNo + ' 关 / 已解锁至第 ' + maxNo + ' 关'), VIEW_W * 0.5, card.y + 177);

    var prev = { x: panel.x + 70, y: panel.y + 382, r: 34 };
    var next = { x: panel.x + panel.w - 70, y: panel.y + 382, r: 34 };
    hotspots.stageSelectPrev = prev;
    hotspots.stageSelectNext = next;
    [prev, next].forEach(function(btn, idx) {
      var enabled = !sequential && (idx === 0 ? selectedNo > minNo : selectedNo < maxNo);
      ctx.globalAlpha = enabled ? 1 : 0.28;
      ctx.fillStyle = 'rgba(255,216,95,.18)';
      ctx.beginPath(); ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd85f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (idx === 0) {
        ctx.moveTo(btn.x + 7, btn.y - 12); ctx.lineTo(btn.x - 8, btn.y); ctx.lineTo(btn.x + 7, btn.y + 12);
      } else {
        ctx.moveTo(btn.x - 7, btn.y - 12); ctx.lineTo(btn.x + 8, btn.y); ctx.lineTo(btn.x - 7, btn.y + 12);
      }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    });

    var dotCount = Math.max(1, maxNo - minNo + 1);
    var dotStart = VIEW_W * 0.5 - (dotCount - 1) * 13;
    for (var i = minNo; i <= maxNo; i++) {
      var dx = dotStart + (i - minNo) * 26;
      ctx.fillStyle = i === selectedNo ? '#ffd85f' : 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.arc(dx, panel.y + 382, i === selectedNo ? 7 : 5, 0, Math.PI * 2); ctx.fill();
    }

    var startBtn = { x: VIEW_W * 0.5, y: panel.y + 470, w: 316, h: 68 };
    hotspots.stageSelectStart = startBtn;
    roundRect(ctx, startBtn.x - startBtn.w * 0.5, startBtn.y - startBtn.h * 0.5, startBtn.w, startBtn.h, 20);
    ctx.fillStyle = '#ffbd32';
    ctx.fill();
    ctx.strokeStyle = '#fff0a5'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#3a2300';
    ctx.font = 'bold 26px ' + UI_FONT;
    ctx.fillText((sequential ? '按顺序进入第' : '进入第') + selectedNo + '关', startBtn.x, startBtn.y + 9);

    ctx.fillStyle = 'rgba(255,255,255,.52)';
    ctx.font = '12px ' + UI_FONT;
    ctx.fillText(sequential
      ? 'L1、L2、L3首次挑战不可跳关，须依序通关解锁'
      : '左右切换已解锁关卡，未解锁关卡无法指定', VIEW_W * 0.5, panel.y + 515);
    ctx.restore();
  }

  function drawMenuTutorialPopup() {
    var popup = drawCoverImage(cfg.tutorialPoster);
    if (!popup) return;
    hotspots.menuClose = { x: VIEW_W * 0.904, y: VIEW_H * 0.147, r: 84 };
    hotspots.menuStartTutorial = { x: VIEW_W * 0.5, y: VIEW_H * 0.892, w: VIEW_W * 0.62, h: VIEW_H * 0.12 };
  }

  function drawTutorialComicScene() {
    var comic = cfg.tutorialComicState || {};
    var assets = cfg.tutorialComicAssets || [];
    var total = Math.max(1, Number(comic.totalPages) || Math.max(1, assets.length || 4));
    var page = Math.max(0, Math.min(total - 1, Number(comic.page) || 0));
    // 新布局：不要漫画窗口，直接展示漫画；底部只留圆点与镂空的「直接开始」按钮
    var footerH = 94;
    var dotY = VIEW_H - 68;
    var btnH = 40;
    var btn = { x: 70, y: VIEW_H - 54, w: VIEW_W - 140, h: btnH };
    hotspots.tutorialComicSkip = { x: btn.x + btn.w * 0.5, y: btn.y + btn.h * 0.5, w: btn.w, h: btn.h };

    drawBackground(0);
    var asset = assets[page] || null;
    if (asset && asset.ready) {
      var iw = asset.image.naturalWidth || asset.image.width;
      var ih = asset.image.naturalHeight || asset.image.height;
      if (iw && ih) {
        // 漫画直接全屏 contain 展示，完整不被裁切，尽量放大
        var baseScale = Math.min(VIEW_W / iw, (VIEW_H - footerH) / ih);
        var dw = iw * baseScale;
        var dh = ih * baseScale;
        var dx = (VIEW_W - dw) * 0.5;
        var dy = (VIEW_H - footerH - dh) * 0.5;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(asset.image, dx, dy, dw, dh);
      }
    } else {
      var g = ctx.createLinearGradient(0, 0, 0, VIEW_H - footerH);
      g.addColorStop(0, '#2b4d78');
      g.addColorStop(1, '#14243b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H - footerH);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = 'bold 24px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('教学漫画载入中…', VIEW_W * 0.5, (VIEW_H - footerH) * 0.5);
    }

    // 底部黑色渐变遮罩，让圆点与按钮在浅色漫画上仍然可读
    var footerGrad = ctx.createLinearGradient(0, VIEW_H - footerH - 40, 0, VIEW_H);
    footerGrad.addColorStop(0, 'rgba(0,0,0,0)');
    footerGrad.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = footerGrad;
    ctx.fillRect(0, VIEW_H - footerH - 40, VIEW_W, footerH + 40);

    for (var i = 0; i < total; i++) {
      var dotX = VIEW_W * 0.5 + (i - (total - 1) * 0.5) * 24;
      ctx.beginPath();
      ctx.arc(dotX, dotY, i === page ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === page ? '#ffd85f' : 'rgba(255,255,255,.35)';
      ctx.fill();
    }

    // 镂空「直接开始」按钮：半透明黑底 + 白边框 + 白字
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 20);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.82)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px ' + UI_FONT;
    ctx.textAlign = 'center';
    ctx.fillText('直接开始', VIEW_W * 0.5, btn.y + 27);
  }

  function drawWrappedTutorialText(text, x, y, maxWidth, lineHeight, maxLines, align) {
    text = String(text || '');
    align = align || 'left';
    var chars = text.split('');
    var lines = [], line = '';
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = chars[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines.length - 1;
      while (lines[last].length > 1 && ctx.measureText(lines[last] + '…').width > maxWidth) lines[last] = lines[last].slice(0, -1);
      lines[last] += '…';
    }
    ctx.textAlign = align;
    for (var li = 0; li < lines.length; li++) ctx.fillText(lines[li], x, y + li * lineHeight);
    return lines.length;
  }

  function tutorialDemoDirectionAngle(dx, dy) { return normalizeAngle(Math.atan2(dx, -dy)); }

  function drawTutorialDemoDashedLine(ax, ay, bx, by, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = '#ff4f67'; ctx.lineWidth = 4; ctx.setLineDash([11, 8]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff4f67'; ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTutorialDemoArrowLine(ax, ay, bx, by, alpha) {
    var dx = bx - ax, dy = by - ay;
    var len = Math.hypot(dx, dy) || 1;
    var ux = dx / len, uy = dy / len;
    var endX = bx - ux * 27, endY = by - uy * 27;
    var head = 15, wing = 8;
    var baseX = endX - ux * head, baseY = endY - uy * head;
    var nx = -uy, ny = ux;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = '#ff4f67'; ctx.fillStyle = '#ff4f67';
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(endX, endY); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(baseX + nx * wing, baseY + ny * wing);
    ctx.lineTo(baseX - nx * wing, baseY - ny * wing);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawTutorialDemoSpring(cx, cy, power) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = power ? '#ff8be4' : '#ffe28a';
    roundRect(ctx, -46, -11, 92, 22, 7); ctx.fill();
    ctx.strokeStyle = '#20354a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = power ? '#4b1746' : '#ffffff';
    ctx.font = 'bold 12px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(power ? '×2' : 'SPRING', 0, 1);
    ctx.restore();
  }

  function drawTutorialDemoBumper(cx, cy, hazard) {
    ctx.save(); ctx.translate(cx, cy);
    if (hazard) {
      ctx.fillStyle = '#7b4a61'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7f96';
      for (var j = 0; j < 10; j++) {
        var a = j / 10 * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.13) * 25, Math.sin(a - 0.13) * 25);
        ctx.lineTo(Math.cos(a) * 37, Math.sin(a) * 37);
        ctx.lineTo(Math.cos(a + 0.13) * 25, Math.sin(a + 0.13) * 25); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ffdbe5'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7f91'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5c401b'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  }

  function drawTutorialAnimatedFrame(task, x, y, w, h) {
    task = task || {};
    var assets = cfg.tutorialAnimationAssets || {};
    var asset = assets[task.id];
    if (asset && asset.ready && asset.image && task.sheet) {
      var frameCount = Math.max(1, Number(task.frameCount) || 12);
      var frameW = Math.max(1, Number(task.frameWidth) || 480);
      var frameH = Math.max(1, Number(task.frameHeight) || 270);
      var fps = Math.max(1, Number(task.fps) || 9);
      var frame = Math.floor(nowSec() * fps) % frameCount;
      var columns = Math.max(1, Number(task.sheetColumns) || 4);
      var sourceX = (frame % columns) * frameW;
      var sourceY = Math.floor(frame / columns) * frameH;
      ctx.save();
      roundRect(ctx, x, y, w, h, 20); ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(asset.image, sourceX, sourceY, frameW, frameH, x, y, w, h);
      ctx.restore();
      return true;
    }
    var id = String(task.demo || task.id || '');
    var loop = (nowSec() * 0.55) % 1;
    ctx.save();
    roundRect(ctx, x, y, w, h, 20); ctx.clip();
    ctx.fillStyle = '#102235'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1;
    for (var gx = x; gx <= x + w; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
    for (var gy = y; gy <= y + h; gy += 42) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
    var floorY = y + h - 33;
    ctx.fillStyle = 'rgba(112,154,108,.48)'; ctx.fillRect(x, floorY, w, 33);
    ctx.fillStyle = 'rgba(166,215,139,.60)'; ctx.fillRect(x, floorY, w, 5);

    if (id === 'auto_target') {
      var left = { x: x + w * 0.31, y: y + 74 }, right = { x: x + w * 0.72, y: y + 84 };
      var px = x + 75 + loop * (w - 150), py = floorY - 39;
      var selected = Math.abs(px - left.x) <= Math.abs(px - right.x) ? left : right;
      drawAnchorGraphic(left.x, left.y, selected === left);
      drawAnchorGraphic(right.x, right.y, selected === right);
      var demoCurlCount = Math.max(1, Number(cfg.curlConfig && cfg.curlConfig.frameCount) || 24);
      drawCurlFrame(Math.floor(loop * demoCurlCount * 2) % demoCurlCount, px, py, 0.62, 0, 1, null);
      drawTutorialDemoArrowLine(px + 10, py - 8, selected.x, selected.y, 0.96);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('靠近锚点时，箭头会指向最近的锁定目标', x + w / 2, y + h - 9);
    } else if (id === 'connect_release') {
      var anchor = { x: x + w * 0.47, y: y + 65 };
      drawAnchorGraphic(anchor.x, anchor.y, true);
      var phase = (nowSec() * 0.42) % 1;
      if (phase < 0.64) {
        var swing = -1.05 + (phase / 0.64) * 1.72;
        var radius = 105;
        var sx = anchor.x + Math.sin(swing) * radius, sy = anchor.y + Math.cos(swing) * radius;
        var frame = angleToFrame(tutorialDemoDirectionAngle(anchor.x - sx, anchor.y - sy));
        var mouth = getDemoMouthPosition(sx, sy, frame, 0.62, 0);
      // 先画人物（在下层），再画舌头（在上层），让舌头叠加在人物前面一层
      drawSpriteFrame(frame, sx, sy, 0.62, 0);
      drawTongueStraightTapered(mouth, anchor, 1, 0);
      } else {
        var q = (phase - 0.64) / 0.36;
        var fx = x + w * 0.62 + q * w * 0.28, fy = y + 92 - q * 45 + q * q * 55;
        drawSpriteFrame(angleToFrame(-0.85), fx, fy, 0.62, q * 1.5);
        ctx.fillStyle = '#8bd8ff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center';
        ctx.fillText('放手后保持空中 1 秒', x + w * 0.69, y + h - 13);
      }
    } else if (id === 'shrink') {
      var sa = { x: x + w * 0.72, y: y + 67 };
      drawAnchorGraphic(sa.x, sa.y, true);
      var pull = 0.5 + 0.5 * Math.sin(loop * Math.PI * 2 - Math.PI / 2);
      var spx = x + w * 0.23 + pull * w * 0.25, spy = floorY - 44 - pull * 40;
      var frame = angleToFrame(tutorialDemoDirectionAngle(sa.x - spx, sa.y - spy));
      var mouth = getDemoMouthPosition(spx, spy, frame, 0.62, 0);
      // 先画人物（在下层），再画舌头（在上层），让舌头叠加在人物前面一层
      drawSpriteFrame(frame, spx, spy, 0.62, 0);
      drawTongueStraightTapered(mouth, sa, 1, 0);
      ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 16px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('持续长按，舌头会逐渐缩短', x + w / 2, y + h - 10);
    } else if (id === 'life_rescue') {
      var lr = (nowSec() * 0.36) % 1;
      if (lr < 0.46) {
        var fallQ = lr / 0.46;
        var fallY = y + 58 + fallQ * fallQ * (floorY - y - 92);
        drawSpriteFrame(Math.floor(fallQ * 18), x + w * 0.42, fallY, 0.62, fallQ * Math.PI * 3);
        for (var lhi = 0; lhi < 3; lhi++) {
          var lhx = x + w - 112 + lhi * 33;
          ctx.fillStyle = fallQ < 0.82 || lhi < 2 ? '#ff688f' : '#535963';
          ctx.beginPath(); ctx.arc(lhx - 5, y + 54, 7, 0, Math.PI * 2); ctx.arc(lhx + 5, y + 54, 7, 0, Math.PI * 2);
          ctx.lineTo(lhx, y + 72); ctx.closePath(); ctx.fill();
        }
      } else {
        var rescueQ = (lr - 0.46) / 0.54;
        if (rescueQ < 0.48) {
          var pullQ = rescueQ / 0.48;
          var pullY2 = y + 102 + pullQ * 76;
          ctx.fillStyle = '#ffd85f'; ctx.beginPath(); ctx.ellipse(x + w * 0.48, y + 73, 31, 22, -0.25, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff3a3'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + w * 0.48, y + 82); ctx.lineTo(x + w * 0.48, pullY2); ctx.stroke();
          drawSpriteFrame(0, x + w * 0.48, pullY2, 0.52, 0);
        } else {
          var launchQ = (rescueQ - 0.48) / 0.52;
          var launchX2 = x + w * 0.48 + launchQ * w * 0.31;
          var launchY2 = y + 178 - launchQ * 122 + launchQ * launchQ * 30;
          drawSpriteFrame(angleToFrame(-0.7), launchX2, launchY2, 0.60, launchQ * 2.2);
          for (var lpi = 0; lpi < 5; lpi++) {
            ctx.globalAlpha = 0.55 - lpi * 0.08; ctx.fillStyle = lpi % 2 ? '#c8d477' : '#9fc66c';
            ctx.beginPath(); ctx.arc(launchX2 - 35 - lpi * 15, launchY2 + 25 + lpi * 3, 8 + lpi, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
    } else if (id === 'life') {
      var fall = Math.min(1, (loop * 1.45) % 1);
      var ly = y + 62 + fall * fall * (floorY - y - 100);
      drawSpriteFrame(Math.floor(loop * 24), x + w * 0.43, ly, 0.62, loop * Math.PI * 3);
      for (var hi = 0; hi < 3; hi++) {
        var hx = x + w - 112 + hi * 33, active = fall < 0.82 || hi < 2;
        ctx.fillStyle = active ? '#ff688f' : '#535963';
        ctx.beginPath(); ctx.arc(hx - 5, y + 54, 7, 0, Math.PI * 2); ctx.arc(hx + 5, y + 54, 7, 0, Math.PI * 2);
        ctx.lineTo(hx, y + 72); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ff9baa'; ctx.font = 'bold 16px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('落地后生命 -1', x + w / 2, y + h - 10);
    } else if (id === 'rescue') {
      var rp = (nowSec() * 0.46) % 1;
      if (rp < 0.48) {
        var pullY = y + 105 + (rp / 0.48) * 72;
        ctx.fillStyle = '#ffd85f'; ctx.beginPath(); ctx.ellipse(x + w * 0.50, y + 75, 31, 22, -0.25, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff3a3'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + w * 0.50, y + 83); ctx.lineTo(x + w * 0.50, pullY); ctx.stroke();
        drawSpriteFrame(0, x + w * 0.50, pullY, 0.52, 0);
      } else {
        var rq = (rp - 0.48) / 0.52;
        var rx = x + w * 0.50 + rq * w * 0.30, ry = y + 174 - rq * 118 + rq * rq * 28;
        drawSpriteFrame(angleToFrame(-0.7), rx, ry, 0.60, rq * 2.2);
        for (var pi = 0; pi < 5; pi++) {
          ctx.globalAlpha = 0.55 - pi * 0.08; ctx.fillStyle = pi % 2 ? '#c8d477' : '#9fc66c';
          ctx.beginPath(); ctx.arc(rx - 35 - pi * 15, ry + 25 + pi * 3, 8 + pi, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('弹射出去后观察 1 秒', x + w / 2, y + h - 10);
    } else if (id === 'props') {
      var springX = x + w * 0.24, springY = floorY - 16;
      var hazardX = x + w * 0.60, hazardY = floorY - 60;
      var anchorX = x + w * 0.87, anchorY = y + 72;
      drawTutorialDemoSpring(springX, springY, true);
      drawTutorialDemoBumper(hazardX, hazardY, true);
      drawAnchorGraphic(anchorX, anchorY, true);
      var routePhase = (nowSec() * 0.42) % 1;
      var routeX, routeY;
      var tongueAlpha = 0;
      var routeRot = routePhase * Math.PI * 4;
      if (routePhase < 0.30) {
        var q1 = routePhase / 0.30;
        routeX = x + 42 + q1 * (springX - x - 42);
        routeY = floorY - 50 - Math.sin(q1 * Math.PI) * 12;
        drawTutorialDemoDashedLine(routeX, routeY, springX, springY, 1);
      } else if (routePhase < 0.72) {
        var q2 = (routePhase - 0.30) / 0.42;
        routeX = springX + q2 * (hazardX + 58 - springX);
        routeY = springY - 34 - Math.sin(q2 * Math.PI) * 128;
        drawTutorialDemoDashedLine(routeX, routeY, hazardX, hazardY, 0.82);
      } else {
        var q3 = (routePhase - 0.72) / 0.28;
        routeX = hazardX + 58 + q3 * (anchorX - hazardX - 83);
        routeY = floorY - 84 - q3 * 38;
        drawTutorialDemoDashedLine(routeX, routeY, anchorX, anchorY, 1);
        tongueAlpha = q3 > 0.56 ? Math.min(1, (q3 - 0.56) / 0.18) : 0;
      }
      var routeFrame = Math.floor(routePhase * 24);
      var mouth = getDemoMouthPosition(routeX, routeY, routeFrame, 0.50, routeRot);
      // 先画人物（在下层），再画舌头（在上层），让舌头叠加在人物前面一层
      drawSpriteFrame(routeFrame, routeX, routeY, 0.50, routeRot);
      if (tongueAlpha > 0) drawTongueStraightTapered(mouth, { x: anchorX, y: anchorY }, tongueAlpha, 0);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('弹力垫起跳 → 越过危险球 → 连接任意锚点', x + w / 2, y + h - 10);
    } else if (id === 'tongue_fail') {
      var tfAnchor = { x: x + w * 0.5, y: y + 56 };
      drawAnchorGraphic(tfAnchor.x, tfAnchor.y, true);
      var tfPeriod = 3.6, tfT = (nowSec() % tfPeriod), tfHold = tfT < 3.0;
      var tfProg = Math.min(1, tfT / 3.0);
      var tfp = { x: tfAnchor.x, y: floorY - 96 };
      var tfFrame = angleToFrame(tutorialDemoDirectionAngle(tfAnchor.x - tfp.x, tfAnchor.y - tfp.y));
      var tfMouth = getDemoMouthPosition(tfp.x, tfp.y, tfFrame, 0.62, 0);
      // ±25° 允许范围扇形提示（自锚点向下 ±25°）
      ctx.save();
      ctx.fillStyle = 'rgba(110,240,167,.16)';
      ctx.beginPath(); ctx.moveTo(tfAnchor.x, tfAnchor.y);
      ctx.arc(tfAnchor.x, tfAnchor.y, 132, Math.PI / 2 - 25 * Math.PI / 180, Math.PI / 2 + 25 * Math.PI / 180);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      if (tfHold) {
        drawSpriteFrame(tfFrame, tfp.x, tfp.y, 0.62, 0);
        drawTongueStraightTapered(tfMouth, tfAnchor, 1, 0);
        // 3 秒倒计时进度环
        ctx.strokeStyle = '#ffd85f'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(tfp.x, tfp.y, 48, -Math.PI / 2, -Math.PI / 2 + tfProg * Math.PI * 2);
        ctx.stroke();
      } else {
        var tfq = (tfT - 3.0) / 0.6;
        var tfdx = tfp.x + tfq * 4, tfdy = tfp.y + tfq * tfq * 130;
        drawSpriteFrame(Math.floor(tfq * 16), tfdx, tfdy, 0.62, tfq * 2);
        // 脱落后软塌的舌头
        ctx.strokeStyle = '#ff9bb0'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tfAnchor.x, tfAnchor.y + 6); ctx.quadraticCurveTo(tfAnchor.x + 10, tfAnchor.y + 50, tfAnchor.x + 4, tfAnchor.y + 88); ctx.stroke();
      }
      ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('±25°内持续按住 3 秒，舌头失效一次', x + w / 2, y + h - 10);
    } else {
      ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 30px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('教学 ' + String(task.no || ''), x + w / 2, y + h / 2);
    }
    ctx.restore();
    return true;
  }

  function drawTutorialOverlay() {
    if (!cfg.isTutorialStage()) return;
    var state = cfg.tutorialFlow || {};
    var task = state.currentTask || null;
    var completed = Array.isArray(state.completedIds) ? state.completedIds.length : 0;
    var total = Math.max(1, Number(state.totalTasks) || 1);

    if (Number(state.finishPromptTimer || 0) > 0) {
      var blockedTask = state.finishPromptTask || task || null;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      var blockedCard = { x: 36, y: (VIEW_H - 520) * 0.5, w: VIEW_W - 72, h: 520 };
      roundRect(ctx, blockedCard.x, blockedCard.y, blockedCard.w, blockedCard.h, 30);
      ctx.fillStyle = 'rgba(16,15,24,.985)'; ctx.fill();
      ctx.strokeStyle = '#ff667a'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#ff8293'; ctx.font = 'bold 20px ' + UI_NUM; ctx.textAlign = 'center';
      ctx.fillText('FINISH LOCKED', VIEW_W / 2, blockedCard.y + 42);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 29px ' + UI_FONT;
      ctx.fillText(String(blockedTask && blockedTask.title || '教学尚未完成'), VIEW_W / 2, blockedCard.y + 84);
      if (blockedTask) drawTutorialAnimatedFrame(blockedTask, blockedCard.x + 20, blockedCard.y + 108, blockedCard.w - 40, 286);
      var blockedButton = { x: blockedCard.x + 72, y: blockedCard.y + 426, w: blockedCard.w - 144, h: 58 };
      roundRect(ctx, blockedButton.x, blockedButton.y, blockedButton.w, blockedButton.h, 18);
      ctx.fillStyle = 'rgba(255,102,122,.30)'; ctx.fill();
      ctx.fillStyle = '#ffd8de'; ctx.font = 'bold 18px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('返回教学', VIEW_W / 2, blockedButton.y + 37);
      hotspots.tutorialFinishBlocked = { x: VIEW_W / 2, y: VIEW_H / 2, w: VIEW_W, h: VIEW_H };
      ctx.restore();
      return;
    }

    if ((state.phase === 'active' || state.phase === 'observe') && task) {
      var pill = { x: 18, y: 108, w: 326, h: 58 };
      roundRect(ctx, pill.x, pill.y, pill.w, pill.h, 18);
      ctx.fillStyle = 'rgba(7,14,24,.82)'; ctx.fill();
      ctx.strokeStyle = 'rgba(110,240,167,.30)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 14px ' + UI_NUM; ctx.textAlign = 'left';
      ctx.fillText('教学 ' + (completed + 1) + ' / ' + total, pill.x + 16, pill.y + 21);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px ' + UI_FONT;
      var activeText = task.shortTitle || task.title || '';
      if (state.phase === 'observe') activeText = '观察效果… ' + Math.max(0, 1 - Number(state.observeTimer || 0)).toFixed(1) + ' 秒';
      else if (task.id === 'life') activeText = state.lifeLost ? '操作黄金番薯救援' : '自动落地中…';
      else if (task.id === 'props') {
        var routeLabels = ['1/3 踩到指定弹力垫', '2/3 从危险球上方越过', '3/3 连接任意锚点'];
        activeText = routeLabels[Math.min(2, Math.max(0, Number(state.propRouteStep) || 0))];
      } else if (task.id === 'rescue_only') activeText = '拖拽黄金番薯，调整角度与力度';
      else if (task.id === 'rescue_manual') {
        var rmSteps = ['1/3 下拉黄金番薯到底', '2/3 左右拖动调整角度', '3/3 松手放屁弹射'];
        var rmStep = 0;
        if (tutorialFlow.rescuePulled) rmStep = 1;
        if (tutorialFlow.rescueAimed) rmStep = 2;
        activeText = rmSteps[rmStep];
      } else if (task.id === 'tongue_fail') {
        if (state.phase === 'observe') activeText = '舌头已失效，观察效果…';
        else {
          var tfRemain = Math.max(0, (Number(cfg.tongueFailSeconds) || 3) - Number((cfg.player && cfg.player.tongueFailTimer) || 0));
          activeText = '保持按住 ' + tfRemain.toFixed(1) + ' 秒';
        }
      }
      ctx.fillText(activeText, pill.x + 16, pill.y + 45);
      return;
    }

    if (state.phase !== 'intro' && state.phase !== 'check') return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (state.phase === 'check') {
      var pop = 1 + Math.sin(Math.min(1, Number(state.phaseTimer) || 0) * Math.PI) * 0.08;
      ctx.translate(VIEW_W / 2, VIEW_H / 2); ctx.scale(pop, pop);
      ctx.fillStyle = 'rgba(8,25,22,.96)'; ctx.beginPath(); ctx.arc(0, 0, 122, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6ef0a7'; ctx.lineWidth = 8; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-54, 0); ctx.lineTo(-14, 42); ctx.lineTo(62, -48); ctx.stroke();
      ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 30px ' + UI_FONT; ctx.textAlign = 'center';
      ctx.fillText('教学完成', 0, 174);
      ctx.restore();
      return;
    }

    var card = { x: 32, y: (VIEW_H - 486) * 0.5, w: VIEW_W - 64, h: 486 };
    roundRect(ctx, card.x, card.y, card.w, card.h, 30);
    ctx.fillStyle = 'rgba(8,14,24,.985)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,216,95,.72)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 20px ' + UI_NUM; ctx.textAlign = 'center';
    ctx.fillText('LEARNING ' + String(task && task.no || ''), VIEW_W / 2, card.y + 38);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 29px ' + UI_FONT;
    ctx.fillText(String(task && task.title || '教学内容'), VIEW_W / 2, card.y + 78);

    drawTutorialAnimatedFrame(task || {}, card.x + 18, card.y + 100, card.w - 36, 286);

    var pulse = 0.76 + (Math.sin(nowSec() * 4.2) + 1) * 0.12;
    var startButton = { x: card.x + 72, y: card.y + 410, w: card.w - 144, h: 56 };
    roundRect(ctx, startButton.x, startButton.y, startButton.w, startButton.h, 18);
    ctx.fillStyle = 'rgba(110,240,167,' + pulse.toFixed(2) + ')'; ctx.fill();
    ctx.fillStyle = '#092b20'; ctx.font = 'bold 19px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.fillText('开始', VIEW_W / 2, startButton.y + 36);
    hotspots.tutorialContinue = { x: startButton.x + startButton.w * 0.5, y: startButton.y + startButton.h * 0.5, w: startButton.w, h: startButton.h };
    ctx.restore();
  }

  function drawHazardIcon(x, y, r) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#7b4a61'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff7f96';
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.14) * (r - 2), Math.sin(a - 0.14) * (r - 2));
      ctx.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8));
      ctx.lineTo(Math.cos(a + 0.14) * (r - 2), Math.sin(a + 0.14) * (r - 2));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawPauseAudioIcon(kind, x, y, enabled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = enabled ? 'rgba(255,216,95,.18)' : 'rgba(255,107,136,.16)';
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = enabled ? '#ffd85f' : '#ff7892';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'music') {
      ctx.beginPath(); ctx.moveTo(-5, -12); ctx.lineTo(-5, 10); ctx.moveTo(-5, -12); ctx.lineTo(12, -16); ctx.lineTo(12, 5); ctx.stroke();
      ctx.beginPath(); ctx.arc(-11, 12, 7, 0, Math.PI * 2); ctx.arc(6, 7, 7, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(-14, -7); ctx.lineTo(-6, -7); ctx.lineTo(3, -15); ctx.lineTo(3, 15); ctx.lineTo(-6, 7); ctx.lineTo(-14, 7); ctx.closePath(); ctx.fill();
      if (enabled) {
        ctx.beginPath(); ctx.arc(3, 0, 12, -0.8, 0.8); ctx.stroke();
        ctx.beginPath(); ctx.arc(3, 0, 20, -0.75, 0.75); ctx.stroke();
      }
    }
    if (!enabled) {
      ctx.strokeStyle = '#ff6688'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(18, 18); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPauseSlider(slider, value, enabled, accent) {
    value = clamp(Number(value) || 0, 0, 1);
    var x0 = slider.x - slider.w * 0.5;
    var y = slider.y;
    ctx.fillStyle = 'rgba(255,255,255,.13)';
    roundRect(ctx, x0, y - 7, slider.w, 14, 7); ctx.fill();
    if (value > 0) {
      ctx.fillStyle = enabled ? accent : 'rgba(255,255,255,.28)';
      roundRect(ctx, x0, y - 7, Math.max(14, slider.w * value), 14, 7); ctx.fill();
    }
    var knobX = x0 + slider.w * value;
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = enabled ? '#ffffff' : '#9ba4b2';
    ctx.beginPath(); ctx.arc(knobX, y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = enabled ? accent : '#6e7786'; ctx.lineWidth = 4; ctx.stroke();
  }

  function drawPauseOverlay() {
    var audio = cfg.audioSettings || {};
    var roundNo = Math.max(1, Math.round(Number(cfg.progress && cfg.progress.round) || 1));
    var roundLength = 1 + Math.max(0, roundNo - 1) * 0.5;
    var formalCount = Math.max(1, (Number(cfg.stageCount) || 1) - (Number(cfg.MAIN_STAGE_START) || 0));
    var levelNo = Math.max(1, Math.min(formalCount, (Number(cfg.stageIndex) || 0) - (Number(cfg.MAIN_STAGE_START) || 0) + 1));
    var isTutorial = cfg.isTutorialStage && cfg.isTutorialStage();

    ctx.fillStyle = 'rgba(0,0,0,.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var panel = { x: 38, y: 122, w: VIEW_W - 76, h: 756 };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.62)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 30);
    ctx.fillStyle = 'rgba(8,14,24,.97)'; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,216,95,.72)'; ctx.lineWidth = 3; ctx.stroke();
    roundRect(ctx, panel.x + 8, panel.y + 8, panel.w - 16, panel.h - 16, 24);
    ctx.strokeStyle = 'rgba(110,240,167,.20)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 34px ' + UI_FONT;
    ctx.fillText('游戏暂停', VIEW_W / 2, 174);
    ctx.fillStyle = 'rgba(255,255,255,.54)'; ctx.font = 'bold 13px ' + UI_FONT;
    ctx.fillText('调整后点击「继续游戏」自动保存', VIEW_W / 2, 200);

    var leftCard = { x: 72, y: 218, w: 184, h: 72 };
    var rightCard = { x: 284, y: 218, w: 184, h: 72 };
    [leftCard, rightCard].forEach(function(card) {
      roundRect(ctx, card.x, card.y, card.w, card.h, 17);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255,255,255,.56)'; ctx.font = 'bold 14px ' + UI_FONT;
    ctx.fillText(isTutorial ? '模式' : '目前轮次', leftCard.x + leftCard.w / 2, 242);
    ctx.fillText('目前关卡', rightCard.x + rightCard.w / 2, 242);
    ctx.fillStyle = '#6ef0a7'; ctx.font = isTutorial ? ('bold 26px ' + UI_NUM) : ('bold 17px ' + UI_FONT);
    ctx.fillText(isTutorial ? '教学' : ('第 ' + roundNo + ' 轮 · 长度 ×' + roundLength.toFixed(1)), leftCard.x + leftCard.w / 2, 274);
    ctx.fillStyle = '#8bd8ff';
    ctx.fillText(isTutorial ? String((cfg.runtimeLevel && cfg.runtimeLevel.name) || 'T') : ('第 ' + levelNo + ' 关'), rightCard.x + rightCard.w / 2, 274);

    // —— 2026-10-09 二次改版（Q 版统一规格）：皮肤选择 / 背景音乐选曲 / 排行榜 / 继续游戏
    // 四个主按钮全部同宽同高（292×64 圆角 20），消除大大小小的按钮；缩图贴左、文字紧跟不留大空白。
    var BTN_W = 292, BTN_H = 64, BTN_R = 20;
    var skinBtn = { x: VIEW_W / 2 - BTN_W / 2, y: 302, w: BTN_W, h: BTN_H };
    // 热区为「中心点」基准（pointInRect 按 x±w/2 命中），与绘制用的左上角矩形区分开。
    hotspots.pauseSkin = { x: VIEW_W / 2, y: skinBtn.y + BTN_H / 2, w: BTN_W, h: BTN_H };
    var pressedSkin = cfg.uiPressVisual === 'skin';
    roundRect(ctx, skinBtn.x, skinBtn.y, skinBtn.w, skinBtn.h, BTN_R);
    ctx.fillStyle = pressedSkin ? 'rgba(255,216,95,.24)' : 'rgba(255,216,95,.14)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,216,95,.78)'; ctx.lineWidth = 2.5; ctx.stroke();
    // 缩图槽（按钮内最前面，44×44 圆角，紧贴左缘）
    var thumbCx = skinBtn.x + 32;
    var thumbCy = skinBtn.y + skinBtn.h / 2;
    roundRect(ctx, thumbCx - 24, thumbCy - 24, 48, 48, 12);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save();
    roundRect(ctx, thumbCx - 22, thumbCy - 22, 44, 44, 10); ctx.clip();
    var _skinCardDef = cfg.activeSkin;
    if (!_skinCardDef || !_skinCardDef.id) _skinCardDef = { id: 'classic', name: '阿蜥' };
    if (!drawSkinPortrait(_skinCardDef, thumbCx, thumbCy, 40, 42)) {
      drawSkinPortraitFallback(_skinCardDef, thumbCx, thumbCy, 40, 42);
    }
    ctx.restore();
    // 单行文字紧跟缩图：目前皮肤:XXX（左） + 去换装（右），同一行居中、字体加大
    var tx = thumbCx + 32;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px ' + UI_FONT;
    ctx.fillText('目前皮肤:' + String((cfg.activeSkin && cfg.activeSkin.name) || '阿蜥'), tx, thumbCy + 1);
    // 右端「去换装 ›」
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 16px ' + UI_FONT;
    ctx.fillText('去换装 ›', skinBtn.x + skinBtn.w - 14, thumbCy + 1);
    ctx.textBaseline = 'alphabetic';

    function sectionTitle(text, y) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 18px ' + UI_FONT;
      ctx.fillText(text, 70, y);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(70, y + 10, 400, 2);
    }

    sectionTitle('声音设置', 405);
    var musicSlider = { x: 326, y: 468, w: 244, h: 42 };
    var sfxSlider = { x: 326, y: 560, w: 244, h: 42 };
    hotspots.pauseMusicSlider = musicSlider;
    hotspots.pauseSfxSlider = sfxSlider;

    // [kiosk-audio] 已移除音乐/音效「开启关闭」图标：声音常开，页面不再提供静音切换，仅保留音量微调。
    ctx.textAlign = 'left'; ctx.font = 'bold 17px ' + UI_FONT; ctx.fillStyle = '#ffffff';
    ctx.fillText('音乐', 70, 448); ctx.fillText('音效', 70, 540);
    ctx.textAlign = 'right'; ctx.font = 'bold 14px ' + UI_NUM; ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillText(Math.round(clamp(Number(audio.musicVolume) || 0, 0, 1) * 100) + '%', 468, 448);
    ctx.fillText(Math.round(clamp(Number(audio.sfxVolume) || 0, 0, 1) * 100) + '%', 468, 540);
    drawPauseSlider(musicSlider, audio.musicVolume, true, '#ffd85f');
    drawPauseSlider(sfxSlider, audio.sfxVolume, true, '#6ef0a7');

    sectionTitle('背景音乐', 618);
    // 统一按钮栈：选曲 / 排行榜 / 继续游戏 —— 与皮肤按钮同宽同高（292×64），左右箭头内置进选曲按钮。
    var trackBtn = { x: VIEW_W / 2 - BTN_W / 2, y: 630, w: BTN_W, h: BTN_H };
    var previous = { x: trackBtn.x + 34, y: trackBtn.y + BTN_H / 2, w: 60, h: BTN_H };
    var next = { x: trackBtn.x + BTN_W - 34, y: trackBtn.y + BTN_H / 2, w: 60, h: BTN_H };
    var leaderboardBtn = { x: VIEW_W / 2 - BTN_W / 2, y: 708, w: BTN_W, h: BTN_H };
    var continueBtn = { x: VIEW_W / 2 - BTN_W / 2, y: 784, w: BTN_W, h: BTN_H };
    hotspots.pauseTrackPrevious = { x: previous.x, y: previous.y, w: previous.w, h: previous.h };
    hotspots.pauseTrackNext = { x: next.x, y: next.y, w: next.w, h: next.h };
    hotspots.pauseLeaderboard = { x: VIEW_W / 2, y: leaderboardBtn.y + BTN_H / 2, w: BTN_W, h: BTN_H };
    hotspots.pauseContinue = { x: VIEW_W / 2, y: continueBtn.y + BTN_H / 2, w: BTN_W, h: BTN_H };

    // 选曲按钮：中间曲名 + 序号，两端箭头（热区在按钮内部左右两端）
    roundRect(ctx, trackBtn.x, trackBtn.y, trackBtn.w, trackBtn.h, BTN_R);
    ctx.fillStyle = 'rgba(139,216,255,.10)'; ctx.fill();
    ctx.strokeStyle = 'rgba(139,216,255,.45)'; ctx.lineWidth = 2.5; ctx.stroke();
    var trackName = String(audio.trackName || '未配置背景音乐');
    if (trackName.length > 11) trackName = trackName.slice(0, 10) + '…';
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px ' + UI_FONT;
    ctx.fillText(trackName, VIEW_W / 2, trackBtn.y + 27);
    ctx.fillStyle = 'rgba(255,255,255,.54)'; ctx.font = 'bold 12px ' + UI_FONT;
    var trackCount = Math.max(0, Math.round(Number(audio.trackCount) || 0));
    var trackIndex = Math.max(0, Math.round(Number(audio.trackIndex) || 0));
    ctx.fillText(trackCount ? ((trackIndex + 1) + ' / ' + trackCount) : '请在 bgm_manifest.js 配置 tracks', VIEW_W / 2, trackBtn.y + 48);
    if (!drawUiSpriteButton('previous', previous.x, previous.y, 56, 44, cfg.uiPressVisual === 'previous')) {
      ctx.strokeStyle = cfg.uiPressVisual === 'previous' ? '#ffd85f' : '#eaf6ff';
      ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(previous.x + 10, previous.y - 12); ctx.lineTo(previous.x - 7, previous.y); ctx.lineTo(previous.x + 10, previous.y + 12); ctx.stroke();
    }
    if (!drawUiSpriteButton('next', next.x, next.y, 56, 44, cfg.uiPressVisual === 'next')) {
      ctx.strokeStyle = cfg.uiPressVisual === 'next' ? '#ffd85f' : '#eaf6ff';
      ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(next.x - 10, next.y - 12); ctx.lineTo(next.x + 7, next.y); ctx.lineTo(next.x - 10, next.y + 12); ctx.stroke();
    }

    // 排行榜（同宽同高）
    roundRect(ctx, leaderboardBtn.x, leaderboardBtn.y, leaderboardBtn.w, leaderboardBtn.h, BTN_R);
    ctx.fillStyle = 'rgba(139,216,255,.14)'; ctx.fill();
    ctx.strokeStyle = 'rgba(139,216,255,.72)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#d9f5ff'; ctx.font = 'bold 18px ' + UI_FONT;
    ctx.fillText('排行榜', leaderboardBtn.x + BTN_W / 2, leaderboardBtn.y + BTN_H / 2 + 7);

    // 继续游戏（主按钮，同宽同高；图标在左、文字在右，互不重叠）
    roundRect(ctx, continueBtn.x, continueBtn.y, continueBtn.w, continueBtn.h, BTN_R);
    ctx.fillStyle = cfg.uiPressVisual === 'play' ? 'rgba(79,188,126,.88)' : 'rgba(50,151,103,.94)'; ctx.fill();
    ctx.strokeStyle = '#6ef0a7'; ctx.lineWidth = 3; ctx.stroke();
    if (!drawUiSpriteButton('play', continueBtn.x + 52, continueBtn.y + BTN_H / 2, 64, 44, cfg.uiPressVisual === 'play')) {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(continueBtn.x + 38, continueBtn.y + BTN_H / 2 - 13); ctx.lineTo(continueBtn.x + 64, continueBtn.y + BTN_H / 2); ctx.lineTo(continueBtn.x + 38, continueBtn.y + BTN_H / 2 + 13); ctx.closePath(); ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 21px ' + UI_FONT;
    ctx.fillText('继续游戏', continueBtn.x + 142, continueBtn.y + BTN_H / 2 + 7);
  }


  function drawGoldenSkillOverlay() {
    var state = cfg.goldenSkillState || {};
    var originX = Number(state.originX) || VIEW_W * 0.5;
    var originY = Number(state.originY) || VIEW_H * 0.56;
    var targetX = Number(state.targetX);
    var targetY = Number(state.targetY);
    if (!isFinite(targetX)) targetX = originX;
    if (!isFinite(targetY)) targetY = originY + Math.max(96, Number(state.dockDistance) || 158);

    var phase = String(state.phase || 'ready');
    var lowering = phase === 'lowering';
    var aiming = phase === 'aiming';
    var dockProgress = aiming ? 1 : clamp(Number(state.dockProgress) || 0, 0, 1);
    var dockDistance = Math.max(96, Number(state.dockDistance) || Math.hypot(targetX - originX, targetY - originY) || 158);
    var aim = clamp(Number(state.aimAngle) || 0, -Math.PI / 4, Math.PI / 4);
    var power = clamp(Number(state.power) || 0, 0, 1);
    var armed = !!state.armed;

    // 第一步：按钮从起始位移到人物；第二步：按钮固定在人物，整组上方 UI 沿弧线反向调整。
    var controlX = aiming ? targetX : lerp(originX, targetX, dockProgress);
    var controlY = aiming ? targetY : lerp(originY, targetY, dockProgress);
    var launchDirX = Math.sin(aim);
    var launchDirY = -Math.cos(aim);
    var groupX = aiming ? targetX + launchDirX * dockDistance : originX;
    var groupY = aiming ? targetY + launchDirY * dockDistance : originY;

    // 2026-10-11：移除「不使用」圆圈——该按钮热区不再登记（现场大屏无用且易误触）
    var launch = { x: controlX, y: controlY, r: 66 };
    hotspots.goldenLaunch = launch;

    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 步骤提示。
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px ' + UI_FONT;
    ctx.fillStyle = aiming ? '#fff3a3' : 'rgba(255,255,255,.82)';
    ctx.fillText(
      aiming ? ((typeof window !== 'undefined' && window.__kioskBigScreen && state.kioskAutoSwing) ? '满蓄力 · 方向自动摆动 · 按空格发射' : '步骤 2 · 左右拖动调整方向，松手发射') : '步骤 1 · 向下拖动圆形，直到与角色重叠',
      clamp(groupX, 150, VIEW_W - 150),
      Math.max(94, groupY - 126)
    );
    ctx.restore();

    var headerTop = groupY - 82;
    var titleText = state.trigger === 'vertical' ? '垂吊救援' : '蕃薯救援';
    ctx.font = 'bold 26px ' + UI_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(titleText, groupX, headerTop);
    ctx.fillStyle = '#5ef58c';
    ctx.fillText(titleText, groupX, headerTop);

    var seconds = Math.max(0, Number(state.timer) || 0);
    if (state.kioskAutoSwing) {
      var kRemain = Math.max(0, Number(state.kioskRescueRemain) || 0);
      ctx.font = 'bold 22px ' + UI_NUM;
      ctx.fillStyle = kRemain <= 3 ? '#ff91a8' : '#ffd85f';
      ctx.fillText(kRemain.toFixed(1) + 's', groupX, headerTop + 31);
    } else if (!state.countdownLocked) {
      ctx.font = 'bold 22px ' + UI_NUM;
      ctx.fillStyle = seconds <= 1 ? '#ff91a8' : '#ffffff';
      ctx.fillText(seconds.toFixed(1) + 's', groupX, headerTop + 31);
    }

    // 弓形 UI：弧形弓身 + 两条弓弦，人物位置是固定锚点。
    ctx.save();
    var sideX = -launchDirY;
    var sideY = launchDirX;
    var bowHalf = aiming ? 44 : 36;
    var bowBend = aiming ? 30 : 22;
    var bowA = { x: groupX + sideX * bowHalf, y: groupY + sideY * bowHalf };
    var bowB = { x: groupX - sideX * bowHalf, y: groupY - sideY * bowHalf };
    var bendX = groupX + launchDirX * bowBend;
    var bendY = groupY + launchDirY * bowBend;

    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(255,216,95,.76)';
    ctx.shadowBlur = aiming ? 12 : 7;
    ctx.strokeStyle = aiming ? '#ffd85f' : 'rgba(255,216,95,.72)';
    ctx.lineWidth = aiming ? 5 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bowA.x, bowA.y);
    ctx.quadraticCurveTo(bendX, bendY, bowB.x, bowB.y);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = aiming ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.55)';
    ctx.lineWidth = aiming ? 2.6 : 2;
    ctx.beginPath();
    ctx.moveTo(bowA.x, bowA.y);
    ctx.lineTo(controlX, controlY);
    ctx.lineTo(bowB.x, bowB.y);
    ctx.stroke();
    ctx.restore();

    // 第一步的下拉轨道与进度。
    if (!aiming) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,216,95,.48)';
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 8]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,216,95,.16)';
      ctx.beginPath();
      ctx.arc(targetX, targetY, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,216,95,.64)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(targetX, targetY, 48, 0, Math.PI * 2);
      ctx.stroke();

      var pct = Math.round(dockProgress * 100);
      ctx.fillStyle = '#fff3a3';
      ctx.font = 'bold 12px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lowering ? ('靠近角色 ' + pct + '%') : '下拉到角色', targetX, targetY + 60);
      ctx.restore();
    }

    // 发射方向与轨迹预览，只在第二步出现。
    if (aiming) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,216,95,.96)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX + launchDirX * 82, targetY + launchDirY * 82);
      ctx.stroke();

      var arrowX = targetX + launchDirX * 90;
      var arrowY = targetY + launchDirY * 90;
      var arrowSideX = -launchDirY;
      var arrowSideY = launchDirX;
      ctx.fillStyle = '#ffd85f';
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - launchDirX * 18 + arrowSideX * 9, arrowY - launchDirY * 18 + arrowSideY * 9);
      ctx.lineTo(arrowX - launchDirX * 18 - arrowSideX * 9, arrowY - launchDirY * 18 - arrowSideY * 9);
      ctx.closePath();
      ctx.fill();

      var previewSpeed = 9 + power * 8;
      for (var i = 1; i <= 8; i++) {
        var tt = i * 0.36;
        var px = targetX + launchDirX * previewSpeed * i * 3.2;
        var py = targetY + launchDirY * previewSpeed * i * 3.2 + 2.1 * tt * tt * 12;
        ctx.globalAlpha = 0.82 - i * 0.075;
        ctx.fillStyle = '#fff3a3';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(2.5, 6 - i * 0.38), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 圆形按钮：第一步跟随下拉；第二步锁定并覆盖人物位置，不再绘制重复角色。
    ctx.save();
    var fixedPulse = state.gestureActive ? 1 : (1 + Math.sin(nowSec() * 5) * 0.045);
    ctx.translate(controlX, controlY);
    ctx.scale(fixedPulse, fixedPulse);
    ctx.fillStyle = aiming ? 'rgba(7,18,27,.34)' : (state.gestureActive ? 'rgba(7,18,27,.82)' : 'rgba(255,216,95,.16)');
    ctx.strokeStyle = aiming ? '#ffffff' : '#ffd85f';
    ctx.lineWidth = aiming ? 4.5 : 4;
    ctx.shadowColor = aiming ? 'rgba(255,216,95,.82)' : 'rgba(255,216,95,.45)';
    ctx.shadowBlur = aiming ? 16 : 8;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (!aiming) {
      drawSprite('idle', nowSec(), 0, 0, 0.76, false, 0);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lowering ? '继续下拉' : '按住下拉', 0, 50);
    } else {
      ctx.fillStyle = '#fff3a3';
      ctx.font = 'bold 12px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('角色已锁定', 0, 52);
    }
    ctx.restore();

    // 未操作时的手指动画只演示第一步。
    if (!state.gestureActive && !aiming) {
      var handCycle = (nowSec() % 1.8) / 1.8;
      var handMove;
      var handAlpha;
      if (handCycle < 0.18) {
        handMove = 0;
        handAlpha = handCycle / 0.18;
      } else if (handCycle < 0.34) {
        handMove = 0;
        handAlpha = 1;
      } else if (handCycle < 0.76) {
        var handT = (handCycle - 0.34) / 0.42;
        handT = handT * handT * (3 - 2 * handT);
        handMove = handT * Math.min(dockDistance * 0.82, 136);
        handAlpha = 1;
      } else {
        handMove = Math.min(dockDistance * 0.82, 136);
        handAlpha = Math.max(0, 1 - (handCycle - 0.76) / 0.24);
      }

      var fingerAsset = cfg.fingerPullDownAsset;
      if (fingerAsset && fingerAsset.ready) {
        ctx.save();
        ctx.globalAlpha = handAlpha * 0.94;
        // 素材带透明边距，纵向放大以避免手指 UI 显得扁平。
        var fingerW = 86, fingerH = 120;
        ctx.drawImage(fingerAsset.image, originX - fingerW * 0.5, originY + handMove - fingerH * 0.38, fingerW, fingerH);
        ctx.restore();
      }
    }

    // 2026-10-11：移除「不使用」圆圈按钮（现场大屏无用且易误触）——只保留角色拉拽圆
    ctx.textBaseline = 'alphabetic';
  }

  function drawGoldenSkillAdOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,.52)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    roundRect(ctx, 94, VIEW_H / 2 - 80, VIEW_W - 188, 160, 24);
    ctx.fillStyle = 'rgba(8,18,26,.94)'; ctx.fill();
    ctx.drawImage(getFoodIcon('golden_sweet_potato', cfg.foodArtAssets), VIEW_W / 2 - 24, VIEW_H / 2 - 55, 48, 48);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.fillText('等待广告选择…', VIEW_W / 2, VIEW_H / 2 + 28);
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = '14px ' + UI_FONT;
    ctx.fillText('开发模式会自动模拟完整观看', VIEW_W / 2, VIEW_H / 2 + 56);
  }

  function drawRewardDialogOverlay() {
    var state = cfg.rewardDialog || {};
    if (!state.active) return;
    var mode = state.mode === 'play' ? 'play' : 'revive';
    var claimed = mode === 'revive' && !!state.claimed;
    var adAvailable = !claimed && !!state.adAvailable;
    var shareAvailable = !claimed && mode === 'revive' && !!state.shareAvailable;
    var energyAvailable = !claimed && mode === 'revive' && !!state.energyAvailable;
    var potatoAvailable = !claimed && mode === 'revive' && !!state.potatoAvailable;
    var freeReviveAvailable = !claimed && mode === 'revive' && !!state.freeReviveAvailable;
    var availablePlays = Math.max(0, Math.round(Number(state.availablePlays) || 0));
    var primaryAvailable = adAvailable || shareAvailable;
    var fallbackMode = mode === 'revive' && !primaryAvailable;
    var cardCount = (adAvailable ? 1 : 0) + (shareAvailable ? 1 : 0) + (energyAvailable ? 1 : 0) + (potatoAvailable ? 1 : 0) + (freeReviveAvailable ? 1 : 0);
    // 面板高度按实际内容动态计算，避免卡片/冷却/按钮重叠。
    // 头部区(徽章+标题+副标题+chips)≈228px；每个optionCard=88px+间距14px=102px；
    // 冷却区(仅revive)=72px+间距30px≈102px；取消按钮区≈106px（含底部留白）。
    var reviveCooldownH = mode === 'revive' ? 102 : 0;
    var cancelAreaH = 106;
    var headerH = 228;
    var calculatedH = headerH + (cardCount * 102) + reviveCooldownH + cancelAreaH;
    // play 模式可能还有 fallback 提示区(~72px)，预留余量
    var panelH = claimed ? 520 : Math.max(480, Math.round(calculatedH) + (mode === 'play' ? 20 : 0));
    var panel = { x: 32, y: Math.round((VIEW_H - panelH) * 0.5), w: VIEW_W - 64, h: panelH };
    var pressed = String(cfg.uiPressVisual || '');
    hotspots.rewardAd = null;
    hotspots.rewardShare = null;
    hotspots.rewardEnergy = null;
    hotspots.rewardPotato = null;
    hotspots.rewardCooldown = null;
    hotspots.rewardFreeRevive = null;
    hotspots.rewardCancel = null;
    hotspots.rewardContinue = null;

    function optionCard(id, y, accentA, accentB, iconKind, title, reward, badge) {
      var x = panel.x + 34, w = panel.w - 68, h = 88;
      var isPressed = pressed === id;
      if (isPressed) y += 4;
      var key = id === 'reward_ad' ? 'rewardAd'
        : (id === 'reward_share' ? 'rewardShare'
        : (id === 'reward_cooldown' ? 'rewardCooldown'
        : (id === 'reward_free_revive' ? 'rewardFreeRevive'
        : (id === 'reward_potato' ? 'rewardPotato' : 'rewardEnergy'))));
      hotspots[key] = { x: x + w * 0.5, y: y + h * 0.5, w: w, h: h };
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = isPressed ? 4 : 10; ctx.shadowOffsetY = isPressed ? 2 : 5;
      roundRect(ctx, x, y, w, h, 19);
      var grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, accentA); grad.addColorStop(1, accentB);
      ctx.fillStyle = grad; ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.46)'; ctx.lineWidth = 2; ctx.stroke();

      var ix = x + 45, iy = y + h * 0.5;
      ctx.fillStyle = 'rgba(6,16,22,.30)'; ctx.beginPath(); ctx.arc(ix, iy, 27, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (iconKind === 'ad') {
        roundRect(ctx, ix - 15, iy - 11, 30, 22, 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ix - 4, iy - 7); ctx.lineTo(ix + 8, iy); ctx.lineTo(ix - 4, iy + 7); ctx.closePath(); ctx.fill();
      } else if (iconKind === 'share') {
        ctx.beginPath(); ctx.arc(ix - 11, iy + 7, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ix + 11, iy - 10, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ix + 13, iy + 13, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ix - 6, iy + 4); ctx.lineTo(ix + 6, iy - 7); ctx.moveTo(ix - 6, iy + 9); ctx.lineTo(ix + 8, iy + 12); ctx.stroke();
      } else {
        roundRect(ctx, ix - 16, iy - 12, 32, 24, 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ix - 3, iy - 8); ctx.lineTo(ix + 6, iy - 8); ctx.lineTo(ix + 1, iy - 1); ctx.lineTo(ix + 8, iy - 1); ctx.lineTo(ix - 4, iy + 10); ctx.lineTo(ix, iy + 2); ctx.lineTo(ix - 7, iy + 2); ctx.closePath(); ctx.fill();
      }

      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px ' + UI_FONT; ctx.fillText(title, x + 86, y + 31);
      ctx.fillStyle = 'rgba(255,255,255,.84)'; ctx.font = 'bold 13px ' + UI_FONT; ctx.fillText(reward, x + 86, y + 60);
      if (badge) {
        ctx.font = 'bold 11px ' + UI_FONT;
        var bw = Math.max(72, ctx.measureText(badge).width + 20);
        roundRect(ctx, x + w - bw - 12, y + 10, bw, 26, 13);
        ctx.fillStyle = 'rgba(5,15,20,.34)'; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(badge, x + w - bw * 0.5 - 12, y + 23);
      }
      ctx.restore();
    }

    function statusChip(x, y, w, text, activeColor, dimmed) {
      roundRect(ctx, x, y - 15, w, 30, 15);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
      ctx.fillStyle = dimmed ? 'rgba(255,255,255,.46)' : activeColor;
      ctx.font = 'bold 12px ' + UI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w * 0.5, y);
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    var vignette = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.45, 80, VIEW_W * 0.5, VIEW_H * 0.5, 560);
    vignette.addColorStop(0, 'rgba(27,70,68,.12)'); vignette.addColorStop(1, 'rgba(0,0,0,.38)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.shadowColor = 'rgba(0,0,0,.68)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 30);
    var panelGrad = ctx.createLinearGradient(panel.x, panel.y, panel.x, panel.y + panel.h);
    panelGrad.addColorStop(0, '#17333a'); panelGrad.addColorStop(0.25, '#10252d'); panelGrad.addColorStop(1, '#09171e');
    ctx.fillStyle = panelGrad; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#e1a834'; ctx.lineWidth = 4; ctx.stroke();
    roundRect(ctx, panel.x + 8, panel.y + 8, panel.w - 16, panel.h - 16, 24);
    ctx.strokeStyle = 'rgba(111,240,169,.28)'; ctx.lineWidth = 2; ctx.stroke();

    [panel.x + 22, panel.x + panel.w - 22].forEach(function(rx) {
      ctx.fillStyle = '#76501e'; ctx.beginPath(); ctx.arc(rx, panel.y + 22, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4cc65'; ctx.beginPath(); ctx.arc(rx - 1, panel.y + 20, 2, 0, Math.PI * 2); ctx.fill();
    });

    // 徽章与标题拉开距离；阿蜥图使用 contain 绘制，不再用圆形裁切。
    var badgeX = VIEW_W * 0.5, badgeY = panel.y + 66, badgeR = 42;
    ctx.fillStyle = 'rgba(111,240,169,.14)'; ctx.beginPath(); ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2); ctx.fill();
    if (mode === 'revive' && cfg.dizzySprite && cfg.dizzySprite.ready) {
      var dc = cfg.dizzyConfig || { frameWidth: 247, frameHeight: 128 };
      ctx.drawImage(cfg.dizzySprite.image, 0, 0, Number(dc.frameWidth) || 247, Number(dc.frameHeight) || 128, badgeX - 42, badgeY - 22, 84, 44);
    } else {
      var badgeFood = getFoodIcon('golden_sweet_potato', cfg.foodArtAssets);
      if (badgeFood) ctx.drawImage(badgeFood, badgeX - 25, badgeY - 25, 50, 50);
      else drawSpriteFrame(0, badgeX, badgeY, 0.36, -0.08, null);
    }
    ctx.strokeStyle = '#6ef0a7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2); ctx.stroke();

    if (claimed) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 27px ' + UI_FONT;
      ctx.fillText('黄金番薯已到账！', VIEW_W * 0.5, panel.y + 137);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px ' + UI_FONT;
      ctx.fillText((state.claimSource === 'share' ? '分享' : '广告') + '奖励领取成功', VIEW_W * 0.5, panel.y + 169);

      var pulse = 1 + Math.sin((cfg.nowSec ? cfg.nowSec() : 0) * 7) * 0.035;
      var foodIcon = getFoodIcon('golden_sweet_potato', cfg.foodArtAssets);
      ctx.save();
      ctx.translate(VIEW_W * 0.5, panel.y + 252); ctx.scale(pulse, pulse);
      ctx.shadowColor = 'rgba(255,216,95,.85)'; ctx.shadowBlur = 24;
      ctx.fillStyle = 'rgba(255,216,95,.12)'; ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.fill();
      if (foodIcon) ctx.drawImage(foodIcon, -43, -43, 86, 86);
      ctx.shadowBlur = 0;
      roundRect(ctx, 35, -52, 58, 30, 15); ctx.fillStyle = '#e98b22'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px ' + UI_FONT; ctx.fillText('+1', 64, -37);
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = 'bold 14px ' + UI_FONT;
      ctx.fillText('持有数量  ' + Math.max(0, Number(state.rewardBefore) || 0) + '  →  ' + Math.max(0, Number(state.rewardAfter) || 0), VIEW_W * 0.5, panel.y + 329);
      ctx.fillStyle = 'rgba(255,255,255,.56)'; ctx.font = '12px ' + UI_FONT;
      ctx.fillText('按继续后进入黄金番薯技能，不会自动开局', VIEW_W * 0.5, panel.y + 357);

      var cont = { x: VIEW_W * 0.5, y: panel.y + 415, w: panel.w - 88, h: 58 };
      hotspots.rewardContinue = cont;
      if (pressed === 'reward_continue') cont.y += 4;
      roundRect(ctx, cont.x - cont.w * 0.5, cont.y - cont.h * 0.5, cont.w, cont.h, 18);
      var cgrad = ctx.createLinearGradient(cont.x - cont.w * 0.5, cont.y, cont.x + cont.w * 0.5, cont.y);
      cgrad.addColorStop(0, '#31b889'); cgrad.addColorStop(1, '#1e8791');
      ctx.fillStyle = cgrad; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 19px ' + UI_FONT;
      ctx.fillText('继续游戏', cont.x, cont.y + 1);
      ctx.fillStyle = 'rgba(255,255,255,.44)'; ctx.font = '11px ' + UI_FONT;
      ctx.fillText('继续后启动黄金番薯救援技能', VIEW_W * 0.5, panel.y + panel.h - 18);
      ctx.restore();
      return;
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd85f'; ctx.font = 'bold 27px ' + UI_FONT;
    ctx.fillText(mode === 'revive' ? '阿蜥还能再战！' : '游戏次数不足', VIEW_W * 0.5, panel.y + 132);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px ' + UI_FONT;
    ctx.fillText(mode === 'revive' ? '看完广告立即复活，或等待 20 分钟冷却自动复活' : '看完广告获得 1 次，并立即开始游戏', VIEW_W * 0.5, panel.y + 164);

    var chipY = panel.y + 198;
    if (mode === 'revive') {
      var chipGap = 8, chipX = panel.x + 34, chipW = (panel.w - 68 - chipGap * 2) / 3;
      statusChip(chipX, chipY, chipW, adAvailable ? '广告' : '广告', '#ffcf57', !adAvailable);
      statusChip(chipX + chipW + chipGap, chipY, chipW, state.shareMax > 0 ? ('分享 ' + state.shareRemaining + '/' + state.shareMax) : '分享 已关闭', '#6ef0a7', state.shareMax <= 0);
      statusChip(chipX + (chipW + chipGap) * 2, chipY, chipW, '次数 ' + availablePlays, '#84d9ff', availablePlays <= 0);
    } else {
      var playChipW = (panel.w - 76) * 0.5;
      statusChip(panel.x + 34, chipY, playChipW, adAvailable ? '广告可用' : '广告不可用', '#ffcf57', !adAvailable);
      statusChip(panel.x + 42 + playChipW, chipY, playChipW, '当前次数 ' + availablePlays, '#84d9ff', availablePlays <= 0);
    }

    var y = panel.y + 228;
    if (adAvailable) {
      optionCard('reward_ad', y, '#f6b731', '#d86a1e', 'ad', mode === 'revive' ? '看广告复活' : '看广告获得 1 次', mode === 'revive' ? '领取 +1 条命与 +1 个黄金番薯' : '完整观看后立即开始游戏', mode === 'revive' ? '可重复使用' : '可重复使用');
      y += 102;
    }
    if (shareAvailable) {
      optionCard('reward_share', y, '#29b987', '#18788f', 'share', '分享给微信好友 / 群', '返回后原地复活 +1 黄金番薯 · 勿选文件传输助手', mode === 'revive' ? '今日剩余 ' + state.shareRemaining + '/' + state.shareMax + ' 次' : '每日限 3 次');
      y += 102;
    }
    if (energyAvailable && !state.cooldownText) {
      optionCard('reward_energy', y, '#3689b5', '#3154a2', 'energy', '消耗 1 次游戏机会', '立即复活 +1 条命，不赠送黄金番薯', '剩余 ' + availablePlays + ' 次');
      y += 102;
    }
    if (mode === 'revive') {
      // 冷却 20 分钟已自动启动（开窗即计时），此处只读显示倒计时，无按钮
      roundRect(ctx, panel.x + 34, y, panel.w - 68, 72, 18);
      ctx.fillStyle = 'rgba(124,111,214,.14)'; ctx.fill();
      ctx.strokeStyle = 'rgba(124,111,214,.45)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#c9b8ff'; ctx.font = 'bold 16px ' + UI_FONT;
      ctx.fillText(state.cooldownText ? ('冷却中 ' + state.cooldownText) : '冷却启动中…', VIEW_W * 0.5, y + 27);
      ctx.fillStyle = 'rgba(255,255,255,.50)'; ctx.font = '12px ' + UI_FONT;
      ctx.fillText('到时自动复活 +1 命（可返回首页等待）', VIEW_W * 0.5, y + 50);
      y += 102;
    }
    if (freeReviveAvailable) {
      y += 0;
    }
    if (mode === 'revive' && fallbackMode && !energyAvailable) {
      y += 0;
    } else if (mode === 'play' && !adAvailable) {
      y += 0;
    }

    var cancel = { x: VIEW_W * 0.5, y: panel.y + panel.h - 62, w: panel.w - 88, h: 50 };
    hotspots.rewardCancel = cancel;
    if (pressed === 'reward_cancel') cancel.y += 4;
    roundRect(ctx, cancel.x - cancel.w * 0.5, cancel.y - cancel.h * 0.5, cancel.w, cancel.h, 16);
    var safeReturn = mode === 'play' || fallbackMode;
    ctx.fillStyle = safeReturn ? 'rgba(57,101,88,.34)' : 'rgba(145,63,54,.32)'; ctx.fill();
    ctx.strokeStyle = safeReturn ? 'rgba(110,240,167,.62)' : 'rgba(255,137,116,.64)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px ' + UI_FONT;
    var cancelText = mode === 'play' ? '返回首页' : (fallbackMode ? '返回首页（保留本局分数）' : '放弃复活（本局分数不计入）');
    ctx.fillText(cancelText, cancel.x, cancel.y + 1);

    if (state.busy || state.message) {
      ctx.fillStyle = state.busy ? '#ffe68a' : '#ffb6a6'; ctx.font = 'bold 12px ' + UI_FONT;
      ctx.fillText(String(state.message || '处理中，请稍候…'), VIEW_W * 0.5, cancel.y - 34);
    }

    ctx.fillStyle = 'rgba(255,255,255,.44)'; ctx.font = '11px ' + UI_FONT;
    ctx.fillText(mode === 'revive' ? '看完广告立即复活 · 冷却 20 分钟自动复活 +1 命' : '今日仅 1 次游戏机会（含 1 命）', VIEW_W * 0.5, panel.y + panel.h - 17);
    ctx.restore();
  }

  function drawDeathOverlay() {
    // [v42 现场 2026-11-01] 线下闯关没有复活：不再绘制「失去一条命 / 继续挑战」面板。
    //   否则排行榜收起后会短暂露出这块带可点黄色按钮的面板，顾客误触「继续挑战」会进入
    //   复活分支，最终落到带「重新开始」的游戏结束面板并卡在那里。
    if (cfg.kioskActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      // 把旧热区挪出屏幕，避免上一帧残留的 play 热区仍被点中。
      hotspots.play = { x: -9999, y: -9999, w: 1, h: 1, r: 0 };
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.52)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var hearts = Math.max(0, Math.round(Number(cfg.runStats && cfg.runStats.hearts) || 0));
    var assets = cfg.overlayUiAssets || {};
    var art = hearts <= 1 ? assets.deathOneLife : assets.deathTwoLives;

    // 原始美术为 1254 x 1254 透明 PNG；完整等比缩放，不重新绘制木框和生命状态。
    var panelW = Math.min(VIEW_W - 30, 680);
    var panelH = panelW;
    var panelX = (VIEW_W - panelW) * 0.5;
    var panelY = Math.max(72, (VIEW_H - panelH) * 0.45);
    var pressed = cfg.uiPressVisual === 'play';

    if (art && art.ready) {
      ctx.drawImage(art.image, panelX, panelY, panelW, panelH);

      // 木板中央动态写入本局累计分数。字号会自动缩小，保证不超过木板范围。
      var sx = panelW / 1254;
      var sy = panelH / 1254;
      var score = String(Math.max(0, Math.round(Number(cfg.runStats && cfg.runStats.score) || 0)));
      var label = '本局累计 ';
      var boardCenterX = panelX + 627 * sx;
      var boardCenterY = panelY + 760 * sy;
      var maxTextW = 610 * sx;
      var fontSize = Math.max(18, Math.round(58 * sx));
      var labelW, scoreW, totalW;
      do {
        ctx.font = 'bold ' + fontSize + 'px ' + UI_FONT;
        labelW = ctx.measureText(label).width;
        ctx.font = 'bold ' + fontSize + 'px ' + UI_NUM;
        scoreW = ctx.measureText(score).width;
        totalW = labelW + scoreW;
        if (totalW <= maxTextW || fontSize <= 18) break;
        fontSize -= 2;
      } while (fontSize > 18);

      var textX = boardCenterX - totalW * 0.5;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.font = 'bold ' + fontSize + 'px ' + UI_FONT;
      ctx.lineWidth = Math.max(2, 5 * sx);
      ctx.strokeStyle = '#2f1607';
      ctx.fillStyle = '#ffffff';
      ctx.strokeText(label, textX, boardCenterY);
      ctx.fillText(label, textX, boardCenterY);
      ctx.font = 'bold ' + fontSize + 'px ' + UI_NUM;
      ctx.strokeStyle = '#2f1607';
      ctx.fillStyle = '#ffd11a';
      ctx.strokeText(score, textX + labelW, boardCenterY);
      ctx.fillText(score, textX + labelW, boardCenterY);

      // 播放按钮真实热区，对应素材内黄色按钮。
      var btnLeft = panelX + 395 * sx;
      var btnTop = panelY + 850 * sy;
      var btnW = 464 * sx;
      var btnH = 176 * sy;
      hotspots.play = {
        x: btnLeft + btnW * 0.5,
        y: btnTop + btnH * 0.5,
        w: btnW,
        h: btnH,
        r: btnW * 0.5
      };

      if (pressed) {
        // 按下时增加内阴影，并把按钮本体向下移动，模拟实体按键被压入。
        ctx.save();
        roundRect(ctx, btnLeft + 5 * sx, btnTop + 10 * sy, btnW - 10 * sx, btnH - 6 * sy, 22 * sx);
        ctx.fillStyle = 'rgba(38,18,3,.36)';
        ctx.fill();
        ctx.globalAlpha = 0.98;
        ctx.drawImage(
          art.image,
          395, 850, 464, 176,
          btnLeft, btnTop + 10 * sy, btnW, btnH
        );
        roundRect(ctx, btnLeft + 4 * sx, btnTop + 8 * sy, btnW - 8 * sx, btnH - 6 * sy, 22 * sx);
        ctx.fillStyle = 'rgba(72,35,4,.14)';
        ctx.fill();
        ctx.restore();
      }
    } else {
      // 资源尚未完成时的轻量后备，避免出现空白。
      roundRect(ctx, 74, VIEW_H * 0.34, VIEW_W - 148, 310, 26);
      ctx.fillStyle = '#17191b';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#9a571c';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px ' + UI_FONT;
      ctx.fillText('失去一条命', VIEW_W / 2, VIEW_H * 0.34 + 72);
      ctx.font = 'bold 20px ' + UI_FONT;
      ctx.fillText('本局累计 ' + Math.max(0, Math.round(Number(cfg.runStats && cfg.runStats.score) || 0)), VIEW_W / 2, VIEW_H * 0.34 + 160);
      hotspots.play = { x: VIEW_W / 2, y: VIEW_H * 0.34 + 245, w: 190, h: 86, r: 95 };
      drawUiSpriteButton('play', hotspots.play.x, hotspots.play.y, hotspots.play.w, hotspots.play.h, pressed);
    }
    ctx.restore();
  }

  function drawStatRow(x, y, color, icon, value) {
    ctx.fillStyle = color;
    ctx.font = 'bold 24px ' + UI_FONT;
    ctx.textAlign = 'left';
    ctx.fillText(icon, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px ' + UI_NUM;
    var str = String(Math.max(0, Math.round(Number(value) || 0)));
    while (str.length < 4) str = '0' + str;
    ctx.fillText(str, x + 42, y + 2);
  }

  // 2026-10-10 每日过关飘字：play_run 任务 +1 到账时在结算画面底部弹出两行金色横幅。
  // 由 core 的 activatePlayRewardBanner() 触发，持续约 6 秒自动淡出。
  function drawPlayRewardBanner() {
    var b = cfg.playRewardBanner;
    if (!b || !b.active) return;
    var now = Date.now();
    if (now >= (b.until || 0)) { b.active = false; return; }
    var fadeIn = clamp((now - (b.startedAt || now)) / 320, 0, 1);
    var fadeOut = clamp(((b.until || now) - now) / 480, 0, 1);
    var alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) return;
    var cx = VIEW_W * 0.5;
    var cy = VIEW_H - 34;
    var pop = 0.92 + 0.08 * easeOutBack(fadeIn);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    roundRect(ctx, -112, -27, 224, 54, 18);
    ctx.fillStyle = 'rgba(24,16,4,.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,196,64,.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd95c';
    ctx.font = 'bold 20px ' + UI_FONT;
    ctx.fillText('每日游戏完成', 0, -12);
    ctx.fillStyle = '#fff6d8';
    ctx.font = 'bold 16px ' + UI_FONT;
    ctx.fillText('赠送1颗番薯', 0, 13);
    ctx.restore();
  }

  // 2026-10-10：番薯奖励彩带特效（计分/结算页）。每张奖励横幅激活时喷一发彩带，
  // 用绝对时间驱动（不依赖 render dt），screen 空间绘制，自动随寿命消散。
  var scoreConfetti = [];
  var _confettiBannerStart = 0;
  var CONFETTI_COLORS = ['#ff5c8a', '#ffd95c', '#6ef0a7', '#5cc8ff', '#c08aff', '#ff9a6b', '#ff6f79'];
  function spawnScoreConfetti(now) {
    scoreConfetti = [];
    var n = 52;
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
      var spd = 220 + Math.random() * 360;
      scoreConfetti.push({
        x0: VIEW_W * 0.5 + (Math.random() - 0.5) * 140,
        y0: VIEW_H * 0.40 + (Math.random() - 0.5) * 30,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 11,
        size: 5 + Math.random() * 7,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        bornAt: now,
        life: 1.5 + Math.random() * 0.9,
        sway: Math.random() * Math.PI * 2
      });
    }
  }
  function maybeSpawnScoreConfetti() {
    var b = cfg.playRewardBanner;
    if (b && b.active && Number(b.startedAt) !== Number(_confettiBannerStart)) {
      _confettiBannerStart = Number(b.startedAt) || 0;
      spawnScoreConfetti(Date.now());
    }
  }
  function updateAndDrawScoreConfetti(now) {
    if (!scoreConfetti.length) return;
    var alive = [];
    ctx.save();
    for (var i = 0; i < scoreConfetti.length; i++) {
      var p = scoreConfetti[i];
      var age = (now - p.bornAt) / 1000;
      if (age < 0 || age >= p.life) continue;
      var x = p.x0 + p.vx * age + Math.sin(p.sway + age * 6) * 34 * age;
      var y = p.y0 + p.vy * age + 0.5 * 540 * age * age; // 重力
      var rot = p.rot + p.rotV * age;
      var a = 1 - age / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
      ctx.restore();
      alive.push(p);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    scoreConfetti = alive;
  }

  function drawGameOverOverlay() {
    maybeSpawnScoreConfetti();
    var state = cfg.gameOverState || { timer: 0, hold: 3 };
    var hold = Math.max(0, Number(state.hold) || 3);
    var timer = Math.max(0, Number(state.timer) || 0);
    var art = cfg.overlayUiAssets && cfg.overlayUiAssets.gameOver;
    var panel = { x: 28, y: 104, w: VIEW_W - 56, h: (VIEW_W - 56) * 760 / 611 };
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.50)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (art && art.ready) ctx.drawImage(art.image, panel.x, panel.y, panel.w, panel.h);
    else { roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24); ctx.fillStyle = '#7b4319'; ctx.fill(); }
    var sx = panel.w / 611, sy = panel.h / 760;
    function px(v) { return panel.x + v * sx; }
    function py(v) { return panel.y + v * sy; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, 5 * sx); ctx.strokeStyle = '#6d241d'; ctx.fillStyle = '#ff6f79';
    ctx.font = 'bold ' + Math.round(70 * sx) + 'px ' + UI_NUM;
    var scoreText = String(Math.max(0, Number(cfg.runStats.score) || 0));
    ctx.strokeText(scoreText, px(306), py(314)); ctx.fillText(scoreText, px(306), py(314));
    ctx.lineWidth = Math.max(2, 4 * sx); ctx.strokeStyle = '#18572b'; ctx.fillStyle = '#62d665';
    ctx.font = 'bold ' + Math.round(42 * sx) + 'px ' + UI_NUM;
    var bestText = String(Math.max(0, Number(cfg.progress.bestScore) || 0));
    ctx.strokeText(bestText, px(306), py(414)); ctx.fillText(bestText, px(306), py(414));
    var rankBtn = { x: px(306), y: py(508), w: 390 * sx, h: 76 * sy };
    var restartBtn = { x: px(306), y: py(602), w: 390 * sx, h: 76 * sy };
    var homeBtn = { x: px(306), y: py(691), w: 390 * sx, h: 76 * sy };
    hotspots.gameOverLeaderboard = rankBtn; hotspots.gameOverRestart = restartBtn; hotspots.gameOverHome = homeBtn;
    var remain = Math.max(0, Math.ceil(hold - timer));
    ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.strokeStyle = 'rgba(70,35,12,.92)'; ctx.lineWidth = 3;
    ctx.font = 'bold 13px ' + UI_FONT;
    var hint = timer < hold ? (remain + ' 秒后自动开启排行榜') : '排行榜开启中…';
    var hintY = Math.min(VIEW_H - 24, panel.y + panel.h + 18);
    ctx.strokeText(hint, VIEW_W / 2, hintY); ctx.fillText(hint, VIEW_W / 2, hintY);
    drawPlayRewardBanner();
    updateAndDrawScoreConfetti(Date.now());
    ctx.restore();
  }

  function drawSlowmoOverlay() {
    var g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, 'rgba(255,255,255,.04)');
    g.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (cfg.isTutorialStage()) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(VIEW_W / 2 - 28, 112); ctx.lineTo(VIEW_W / 2 - 8, 132); ctx.lineTo(VIEW_W / 2 + 34, 88); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.86)';
      ctx.font = 'bold 24px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('CLEAR!', VIEW_W / 2, 112);
    }
  }

  function drawTutorialStageSummary() {
    var tasks = Array.isArray(cfg.tutorialStageTasks) ? cfg.tutorialStageTasks : [];
    var n = Math.max(1, tasks.length);

    // 统一排版：面板垂直居中、上下内边距收紧；每个任务只保留一行大字标题；按钮与卡片/文字保持一行间隔。
    var PANEL_PAD_X = 48;
    var PANEL_PAD_Y = 16;        // 上下内边距收紧，减少无意义留白
    var TITLE_BASELINE = 32;     // 标题基线相对面板顶部内边距（标题顶部贴内顶）
    var SUBTITLE_BASELINE = 18;  // 副标题相对标题
    var HEADER_GAP = 16;         // 副标题到第一个卡片的距离
    var TASK_CARD_H = 54;        // 单行标题卡片高度
    var TASK_GAP = 12;           // 卡片默认间距
    var BTN_W = 154, BTN_H = 88; // 与 drawReplayIcon/drawNextIcon 内部精灵图尺寸一致
    var BTN_GAP = 32;            // 两个按钮之间的水平间距
    var BTN_TOP_GAP = 18;        // 最后一个卡片底部到按钮顶部（约一行间隔）
    var FOOTER_TEXT_H = 74;      // 按钮中心到面板底部内边距的距离（含按钮半径+两行文字，英文几乎贴底）

    var taskGap = TASK_GAP;
    if (n >= 5) taskGap = 8;     // 任务多时略压缩间距

    var taskAreaH = n * TASK_CARD_H + (n - 1) * taskGap;
    var contentH = TITLE_BASELINE + SUBTITLE_BASELINE + HEADER_GAP + taskAreaH + BTN_TOP_GAP + BTN_H / 2 + FOOTER_TEXT_H;
    var panelH = contentH + PANEL_PAD_Y * 2;
    var PANEL_TOP = Math.max(48, (VIEW_H - panelH) / 2);

    var titleY = PANEL_TOP + PANEL_PAD_Y + TITLE_BASELINE;
    var subtitleY = titleY + SUBTITLE_BASELINE;
    var taskTop = subtitleY + HEADER_GAP;
    var btnY = taskTop + taskAreaH + BTN_TOP_GAP + BTN_H / 2; // 按钮中心 y

    ctx.fillStyle = 'rgba(0,0,0,.66)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    roundRect(ctx, PANEL_PAD_X, PANEL_TOP, VIEW_W - PANEL_PAD_X * 2, panelH, 28);
    ctx.fillStyle = 'rgba(8,14,24,.97)'; ctx.fill();
    ctx.strokeStyle = 'rgba(110,240,167,.54)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#6ef0a7'; ctx.font = 'bold 32px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.fillText('教学关完成', VIEW_W / 2, titleY);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '13px ' + UI_FONT;
    ctx.fillText(String((cfg.runtimeLevel && cfg.runtimeLevel.name) || 'T') + ' · 本关学习重点', VIEW_W / 2, subtitleY);

    for (var i = 0; i < n; i++) {
      var task = tasks[i] || {};
      var cardY = taskTop + i * (TASK_CARD_H + taskGap);
      var cy = cardY + TASK_CARD_H * 0.5;
      roundRect(ctx, PANEL_PAD_X + 16, cardY, VIEW_W - (PANEL_PAD_X + 16) * 2, TASK_CARD_H, 16);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffd85f'; ctx.beginPath(); ctx.arc(PANEL_PAD_X + 48, cy, 19, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#152033'; ctx.font = 'bold 16px ' + UI_NUM; ctx.textAlign = 'center';
      ctx.fillText(String(task.no || (i + 1)), PANEL_PAD_X + 48, cy + 5);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px ' + UI_FONT; ctx.textAlign = 'left';
      ctx.fillText(String(task.title || ''), PANEL_PAD_X + 82, cy + 6);
    }

    var replay = { x: VIEW_W / 2 - (BTN_W + BTN_GAP) / 2, y: btnY, w: BTN_W, h: BTN_H, r: BTN_H / 2 };
    var next = { x: VIEW_W / 2 + (BTN_W + BTN_GAP) / 2, y: btnY, w: BTN_W, h: BTN_H, r: BTN_H / 2 };
    hotspots.replay = replay; hotspots.nextLevel = next;
    drawReplayIcon(replay.x, replay.y, replay.r);
    drawNextIcon(next.x, next.y, next.r);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.fillText('重新开始', replay.x, btnY + 56);
    ctx.fillText('下一关', next.x, btnY + 56);
    ctx.fillStyle = 'rgba(255,255,255,.44)'; ctx.font = '11px ' + UI_FONT;
    ctx.fillText('RESTART', replay.x, btnY + 74);
    ctx.fillText('NEXT', next.x, btnY + 74);
  }

  function drawScoreTallyLaurelFallback(cx, cy, side, progress) {
    progress = clamp(progress, 0, 1);
    if (progress <= 0) return;
    var p = easeOutBack(progress);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(side * p, p);
    ctx.rotate(-0.18);
    ctx.strokeStyle = '#d99a22';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.quadraticCurveTo(18, 8, 38, -26);
    ctx.stroke();
    for (var i = 0; i < 6; i++) {
      var t = i / 5;
      var bx = 5 + t * 31;
      var by = 22 - t * 47;
      var a = -0.74 + t * 0.25;
      var leafScale = 0.72 + t * 0.22;
      var leafGrad = ctx.createLinearGradient(bx - 8, by - 7, bx + 8, by + 7);
      leafGrad.addColorStop(0, '#fff2a0');
      leafGrad.addColorStop(0.48, '#ffc64d');
      leafGrad.addColorStop(1, '#a86308');
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a);
      ctx.scale(leafScale, leafScale);
      ctx.fillStyle = leafGrad;
      ctx.strokeStyle = '#784109';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(bx - 2, by + 8);
      ctx.rotate(a + 1.12);
      ctx.scale(leafScale * 0.92, leafScale * 0.92);
      ctx.fillStyle = leafGrad;
      ctx.strokeStyle = '#784109';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawScoreTallyLaurel(cx, cy, side, progress) {
    progress = clamp(progress, 0, 1);
    if (progress <= 0) return;
    var ui = cfg.scoreTallyUiAssets || {};
    var asset = side < 0 ? ui.laurelLeft : ui.laurelRight;
    if (asset && asset.ready && asset.image) {
      var p = easeOutBack(progress);
      var turn = (1 - progress) * (side < 0 ? -0.18 : 0.18);
      var w = 70;
      var h = 80;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(p, p);
      ctx.rotate(turn);
      ctx.globalAlpha = clamp(progress * 1.35, 0, 1);
      ctx.imageSmoothingEnabled = true;
      ctx.shadowColor = 'rgba(255,185,45,.52)';
      ctx.shadowBlur = 8 * clamp((progress - 0.2) / 0.8, 0, 1);
      ctx.drawImage(asset.image, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
    drawScoreTallyLaurelFallback(cx, cy, side, progress);
  }

  function drawScoreTallySparkle(x, y, size, alpha) {
    alpha = clamp(alpha, 0, 1);
    if (alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff6b2';
    ctx.shadowColor = '#ffd85f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.22, -size * 0.22);
    ctx.lineTo(size, 0);
    ctx.lineTo(size * 0.22, size * 0.22);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.22, size * 0.22);
    ctx.lineTo(-size, 0);
    ctx.lineTo(-size * 0.22, -size * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawScoreTallyTitle(timer) {
    var flipP = easeOutBack(clamp(timer / 0.58, 0, 1));
    var settle = clamp((timer - 0.46) / 0.28, 0, 1);
    var scaleY = Math.max(0.06, flipP);
    var skew = (1 - clamp(timer / 0.58, 0, 1)) * -0.22;
    var laurelP = clamp((timer - 0.12) / 0.48, 0, 1);

    drawScoreTallyLaurel(VIEW_W / 2 - 108, 89, -1, laurelP);
    drawScoreTallyLaurel(VIEW_W / 2 + 108, 89, 1, laurelP);

    ctx.save();
    ctx.translate(VIEW_W / 2, 94);
    ctx.transform(1, 0, skew, scaleY, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 31px ' + UI_FONT;
    for (var d = 7; d >= 2; d--) {
      ctx.fillStyle = d > 4 ? '#67300a' : '#a95408';
      ctx.fillText('过关计分板', d * 0.22, d * 0.55);
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#44210a';
    ctx.strokeText('过关计分板', 0, 0);
    var titleGrad = ctx.createLinearGradient(0, -18, 0, 18);
    titleGrad.addColorStop(0, '#fff8c9');
    titleGrad.addColorStop(0.30, '#ffe36e');
    titleGrad.addColorStop(0.66, '#ffb321');
    titleGrad.addColorStop(1, '#d56a08');
    ctx.fillStyle = titleGrad;
    ctx.shadowColor = 'rgba(255,184,33,.70)';
    ctx.shadowBlur = 10 * settle;
    ctx.fillText('过关计分板', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,225,118,' + (0.34 + 0.46 * settle) + ')';
    ctx.font = 'bold 10px ' + UI_FONT;
    ctx.fillText('SCORE TALLY', VIEW_W / 2, 123);
    var pulse = (Math.sin(nowSec() * 5.5) + 1) * 0.5;
    drawScoreTallySparkle(VIEW_W / 2 + 72, 68, 5 + pulse * 2, settle * (0.45 + pulse * 0.55));
    drawScoreTallySparkle(VIEW_W / 2 - 67, 115, 3.5 + (1 - pulse) * 1.5, settle * 0.72);
    ctx.restore();
  }

  function drawScoreTallyIconFallback(item, index, x, y, progress) {
    progress = clamp(progress, 0, 1);
    if (progress <= 0) return;
    var pop = easeOutBack(progress);
    var flipX = Math.max(0.08, Math.sin(progress * Math.PI * 0.5));
    var isPenalty = !!item.penalty;
    var isTotal = !!item.total;
    var iconName = String(item.icon || ['food','flight','tongue','height','difficulty','time','crow','fart','total'][index] || 'star');
    var r = isTotal ? 19 : 17;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX * pop, pop);
    ctx.rotate((1 - progress) * -0.32);

    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath();
    ctx.arc(0, 3, r + 3, 0, Math.PI * 2);
    ctx.fill();
    var badge = ctx.createRadialGradient(-5, -7, 2, 0, 0, r + 4);
    badge.addColorStop(0, isTotal ? '#237947' : (isPenalty ? '#60252b' : '#17365d'));
    badge.addColorStop(1, isTotal ? '#0b2f1e' : (isPenalty ? '#241017' : '#071526'));
    ctx.fillStyle = badge;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isTotal ? '#6ef0a7' : (isPenalty ? '#ff786f' : '#eab33b');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (iconName === 'food') {
      var kinds = (cfg.runStats && cfg.runStats.collectedFoodKinds) || [];
      var foodKind = kinds.length ? kinds[0] : 'pineapple_cake';
      var foodIcon = getFoodIcon(foodKind, cfg.foodArtAssets);
      if (foodIcon) ctx.drawImage(foodIcon, -14, -14, 28, 28);
    } else if (iconName === 'flight') {
      ctx.fillStyle = '#f5f7ff';
      ctx.strokeStyle = '#5f88c9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-12, 2); ctx.lineTo(12, -7); ctx.lineTo(5, 1); ctx.lineTo(12, 7); ctx.lineTo(-12, 2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8bd8ff'; ctx.fillRect(-8, 0, 11, 3);
    } else if (iconName === 'tongue') {
      ctx.fillStyle = '#fff4ef';
      ctx.beginPath(); ctx.ellipse(0, -3, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff5b83';
      ctx.beginPath(); ctx.ellipse(0, 5, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a91f47'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(0, 11); ctx.stroke();
    } else if (iconName === 'height') {
      ctx.fillStyle = '#dcefff';
      ctx.beginPath(); ctx.moveTo(-13, 10); ctx.lineTo(-3, -9); ctx.lineTo(4, 1); ctx.lineTo(9, -7); ctx.lineTo(14, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7db8df';
      ctx.beginPath(); ctx.moveTo(-13, 10); ctx.lineTo(-3, -9); ctx.lineTo(1, 2); ctx.lineTo(14, 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd85f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(6, -1); ctx.stroke();
      ctx.fillStyle = '#ff5c5c'; ctx.fillRect(6, -12, 8, 5);
    } else if (iconName === 'difficulty') {
      ctx.fillStyle = '#ffd85f';
      ctx.beginPath(); ctx.moveTo(-9,-10); ctx.lineTo(9,-10); ctx.lineTo(7,2); ctx.quadraticCurveTo(0,10,-7,2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff2ad'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-9,-7); ctx.quadraticCurveTo(-15,-4,-9,2); ctx.moveTo(9,-7); ctx.quadraticCurveTo(15,-4,9,2); ctx.stroke();
      ctx.fillStyle = '#ffd85f'; ctx.fillRect(-2, 7, 4, 5); ctx.fillRect(-7, 11, 14, 3);
    } else if (iconName === 'time') {
      ctx.fillStyle = '#f7fbff'; ctx.beginPath(); ctx.arc(0,1,11,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ffd85f'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#274467'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0,1); ctx.lineTo(0,-6); ctx.moveTo(0,1); ctx.lineTo(6,4); ctx.stroke();
      ctx.fillStyle = '#ffd85f'; ctx.fillRect(-5,-14,10,3);
    } else if (iconName === 'crow') {
      var cAsset = cfg.crowSprite;
      var cCfg = cfg.crowSpriteConfig || { frameWidth: 352, frameHeight: 352 };
      if (cAsset && cAsset.ready && cAsset.image) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cAsset.image, 0, 0, cCfg.frameWidth || 352, cCfg.frameHeight || 352, -15, -15, 30, 30);
      } else {
        ctx.fillStyle = '#222831'; ctx.beginPath(); ctx.ellipse(0,1,11,7,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(-13,-7); ctx.lineTo(-8,5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f7f7f7'; ctx.beginPath(); ctx.arc(5,-2,2.2,0,Math.PI*2); ctx.fill();
      }
    } else if (iconName === 'fart') {
      ctx.fillStyle = '#f4e7c6';
      ctx.beginPath(); ctx.arc(-7,2,6,0,Math.PI*2); ctx.arc(0,-3,7,0,Math.PI*2); ctx.arc(7,2,6,0,Math.PI*2); ctx.arc(1,7,7,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#bb9a68'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = '#fff8e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-13,7); ctx.lineTo(-18,10); ctx.moveTo(-11,11); ctx.lineTo(-16,15); ctx.stroke();
    } else if (iconName === 'total') {
      ctx.fillStyle = '#88ffad';
      ctx.beginPath();
      for (var sp = 0; sp < 10; sp++) {
        var sa = -Math.PI / 2 + sp * Math.PI / 5;
        var sr = sp % 2 ? 6 : 13;
        var sx = Math.cos(sa) * sr, sy = Math.sin(sa) * sr;
        if (sp === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#123d27'; ctx.font = 'bold 13px ' + UI_NUM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Σ', 0, 1);
    }
    ctx.restore();
    ctx.restore();
  }

  function drawScoreTallyIcon(item, index, x, y, progress) {
    progress = clamp(progress, 0, 1);
    if (progress <= 0) return;
    var iconName = String(item.icon || ['food','flight','tongue','height','difficulty','time','crow','fart','total'][index] || 'total');
    var ui = cfg.scoreTallyUiAssets || {};
    var icons = ui.icons || {};
    var asset = icons[iconName];
    if (asset && asset.ready && asset.image) {
      var pop = easeOutBack(progress);
      var flipX = Math.max(0.08, Math.sin(progress * Math.PI * 0.5));
      var size = item.total ? 40 : 38;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flipX * pop, pop);
      ctx.rotate((1 - progress) * -0.22);
      ctx.globalAlpha = clamp(progress * 1.45, 0, 1);
      ctx.imageSmoothingEnabled = true;
      ctx.shadowColor = item.penalty ? 'rgba(255,80,80,.30)' : (item.total ? 'rgba(90,255,145,.35)' : 'rgba(255,191,48,.28)');
      ctx.shadowBlur = 6 * clamp((progress - 0.25) / 0.75, 0, 1);
      ctx.drawImage(asset.image, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }
    drawScoreTallyIconFallback(item, index, x, y, progress);
  }

  function drawScoreTally() {
    if (cfg.isTutorialStage && cfg.isTutorialStage()) { drawTutorialStageSummary(); return; }
    maybeSpawnScoreConfetti();

    var PANEL_X = 38;
    var PANEL_Y = 54;
    var PANEL_H = 864;
    var PANEL_W = VIEW_W - PANEL_X * 2;
    var tallyTimer = Math.max(0, Number(cfg.finishState.tallyTimer) || 0);

    ctx.fillStyle = 'rgba(0,0,0,.60)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // [v18 2026-10-11] 面板高度按内容自适应，整格上下居中（去掉底部空白）
    var tallyRows0 = Math.max(1, (cfg.finishState.scoreItems || []).length);
    var contentBottom0 = 164 + tallyRows0 * 50 - 25;
    if (cfg.runStats && cfg.runStats.collectedFoodKinds && cfg.runStats.collectedFoodKinds.length) contentBottom0 = Math.max(contentBottom0, 652);
    var nextView0 = cfg.nextUnlock || {};
    if (nextView0.wrap || cfg.kioskActive) contentBottom0 = Math.max(contentBottom0, 756);
    else contentBottom0 = Math.max(contentBottom0, 892);
    PANEL_H = contentBottom0 - PANEL_Y + 26;
    var tallyDy = Math.max(12, Math.round((VIEW_H - PANEL_H) / 2)) - PANEL_Y;
    ctx.save();
    ctx.translate(0, tallyDy);
    roundRect(ctx, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 28);
    var panelGrad = ctx.createLinearGradient(PANEL_X, PANEL_Y, PANEL_X, PANEL_Y + PANEL_H);
    panelGrad.addColorStop(0, 'rgba(8,18,35,.98)');
    panelGrad.addColorStop(0.58, 'rgba(7,14,27,.97)');
    panelGrad.addColorStop(1, 'rgba(5,11,21,.98)');
    ctx.fillStyle = panelGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,196,64,.30)';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawScoreTallyTitle(tallyTimer);

    var items = cfg.finishState.scoreItems || [];
    var values = cfg.finishState.tallyValues || [];
    var startY = 164;
    var rowH = 50;
    var iconX = 74;
    var labelX = 103;
    var valueX = VIEW_W - 64;
    var introDelay = 0.64;
    var itemDelay = 0.58;
    var iconDuration = 0.22;
    var textDelay = 0.08;
    var textDuration = 0.24;
    var scoreDelay = 0.28;
    var scoreDuration = 0.46;

    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {};
      var y = startY + i * rowH;
      var isPenalty = !!item.penalty;
      var rawValue = Math.round(values[i] || 0);
      var shown = isPenalty ? Math.min(0, rawValue) : Math.max(0, rawValue);
      var rowStart = introDelay + i * itemDelay;
      var iconP = clamp((tallyTimer - rowStart) / iconDuration, 0, 1);
      var textP = easeOutCubic(clamp((tallyTimer - rowStart - textDelay) / textDuration, 0, 1));
      var scoreP = easeOutCubic(clamp((tallyTimer - rowStart - scoreDelay) / scoreDuration, 0, 1));
      if (cfg.finishState.tallyComplete) iconP = textP = scoreP = 1;
      if (iconP <= 0 && !cfg.finishState.tallyComplete) continue;

      if (item.total) {
        roundRect(ctx, 58, y - 26, VIEW_W - 116, 54, 14);
        var totalGrad = ctx.createLinearGradient(58, y - 26, VIEW_W - 58, y + 28);
        totalGrad.addColorStop(0, 'rgba(26,133,76,.22)');
        totalGrad.addColorStop(0.5, 'rgba(37,174,93,.16)');
        totalGrad.addColorStop(1, 'rgba(19,91,57,.22)');
        ctx.fillStyle = totalGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(110,240,167,.58)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (i > 0) {
        ctx.save();
        ctx.globalAlpha = textP * 0.90;
        ctx.strokeStyle = 'rgba(255,255,255,.075)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(58, y - 28);
        ctx.lineTo(VIEW_W - 58, y - 28);
        ctx.stroke();
        ctx.restore();
      }

      // 每行采用明确的三条水平基线：图标/中文标题共用一条中线，英文说明独立一条，分数使用整行中线。
      // 不再用字体默认 alphabetic baseline 猜测视觉中心，避免 PNG 图标看起来比项目名称偏低。
      var rowTop = y - rowH * 0.5;
      var titleCenterY = rowTop + (item.total ? 18 : 17);
      var subtitleCenterY = rowTop + (item.total ? 39 : 37);
      var valueCenterY = rowTop + rowH * 0.5;
      drawScoreTallyIcon(item, i, iconX, titleCenterY, iconP);

      ctx.save();
      ctx.globalAlpha = textP;
      ctx.translate((1 - textP) * -9, 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = item.total ? '#80ffab' : (isPenalty ? '#ff8585' : '#ffffff');
      ctx.font = item.total ? 'bold 24px ' + UI_FONT : 'bold 21px ' + UI_FONT;
      ctx.shadowColor = item.total ? 'rgba(110,240,167,.42)' : 'rgba(0,0,0,.55)';
      ctx.shadowBlur = item.total ? 7 : 2;
      ctx.fillText(String(item.cn || ''), labelX, titleCenterY);

      ctx.shadowBlur = 0;
      ctx.fillStyle = item.total ? 'rgba(136,255,177,.72)' : (isPenalty ? 'rgba(255,150,150,.66)' : 'rgba(255,255,255,.53)');
      ctx.font = '11px ' + UI_FONT;
      ctx.fillText(String(item.en || ''), labelX, subtitleCenterY);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = scoreP;
      var scoreBounce = 0.94 + 0.06 * easeOutBack(scoreP);
      ctx.translate(valueX, valueCenterY);
      ctx.scale(scoreBounce, scoreBounce);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = item.total ? '#83ffae' : (isPenalty ? '#ff6666' : '#ffd85f');
      ctx.font = item.total ? 'bold 33px ' + UI_NUM : 'bold 25px ' + UI_NUM;
      ctx.lineWidth = item.total ? 3 : 2;
      ctx.strokeStyle = item.total ? '#0c4b2a' : (isPenalty ? '#5e1720' : '#6a3c00');
      var prefix = item.total ? '' : (isPenalty ? '' : '+');
      ctx.strokeText(prefix + shown, 0, 0);
      ctx.shadowColor = item.total ? 'rgba(91,255,149,.62)' : (isPenalty ? 'rgba(255,80,80,.45)' : 'rgba(255,201,57,.45)');
      ctx.shadowBlur = 8;
      ctx.fillText(prefix + shown, 0, 0);
      ctx.restore();

      if (scoreP > 0 && scoreP < 1) {
        var sparkleP = Math.sin(scoreP * Math.PI);
        drawScoreTallySparkle(valueX + 4, valueCenterY - 20, 4 + sparkleP * 3, sparkleP);
      }
    }

    var usedKinds = (cfg.runStats && cfg.runStats.collectedFoodKinds) || [];
    if (usedKinds.length) {
      var showKinds = usedKinds.slice(0, 6);
      var iconSize = 39;
      var step = Math.min(52, (VIEW_W - 116) / Math.max(1, showKinds.length));
      var totalW = (showKinds.length - 1) * step;
      var startX = VIEW_W / 2 - totalW / 2;
      var iconY = 626 + Math.sin(nowSec() * 2.2) * 3;
      ctx.save();
      ctx.globalAlpha = 0.97;
      for (var ik = 0; ik < showKinds.length; ik++) {
        var fkx = startX + ik * step;
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.beginPath();
        ctx.arc(fkx, iconY, iconSize * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(getFoodIcon(showKinds[ik], cfg.foodArtAssets), Math.round(fkx - iconSize / 2), Math.round(iconY - iconSize / 2), iconSize, iconSize);
      }
      ctx.restore();
    }

    var nextView = cfg.nextUnlock || {};
    if (cfg.finishState.tallyComplete && nextView.wrap) {
      ctx.fillStyle = '#ffd95c';
      ctx.font = 'bold 20px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('第10关完成，穿越门即将开启', VIEW_W / 2, 688);
      ctx.fillStyle = 'rgba(255,255,255,.68)';
      ctx.font = '14px ' + UI_FONT;
      ctx.fillText('过场结束后从第1关开始，并进入下一轮', VIEW_W / 2, 718);
      ctx.fillStyle = '#6ef0a7';
      ctx.font = 'bold 15px ' + UI_FONT;
      var upcomingRound = Math.max(1, Math.round(Number(cfg.progress && cfg.progress.round) || 1)) + 1;
      var upcomingPhysicsRate = 1 + Math.max(0, upcomingRound - 1) * 0.05;
      var upcomingCrowRate = upcomingRound <= 2 ? 1 : 1 + Math.max(0, upcomingRound - 2) * 0.10;
      var upcomingCrowText = upcomingRound === 2 ? '乌鸦全关' : ('乌鸦速度×' + upcomingCrowRate.toFixed(2));
      ctx.fillText('长度×' + (1 + Math.max(0, upcomingRound - 1) * 0.5).toFixed(1) + ' · 物理×' + upcomingPhysicsRate.toFixed(2) + ' · ' + upcomingCrowText, VIEW_W / 2, 746);
    } else if (cfg.finishState.tallyComplete && cfg.kioskActive) {
      // [kiosk 2026-10-11 下午] 现场记分板：不显示「下一关/再玩一次」，只提示按空白键推进
      ctx.fillStyle = '#6ef0a7';
      ctx.font = 'bold 24px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('按 空白键 继续', VIEW_W / 2, 716);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.font = '13px ' + UI_FONT;
      ctx.fillText('PRESS SPACE TO CONTINUE', VIEW_W / 2, 748);
    } else if (cfg.finishState.tallyComplete) {
      var replay = { x: VIEW_W / 2 - 92, y: 690 + tallyDy, w: 154, h: 88, r: 77 };
      var next = { x: VIEW_W / 2 + 92, y: 690 + tallyDy, w: 154, h: 88, r: 77 };
      hotspots.replay = replay;
      hotspots.nextLevel = next;
      drawReplayIcon(replay.x, replay.y, replay.r);
      drawNextIcon(next.x, next.y, next.r);

      ctx.fillStyle = 'rgba(255,255,255,.90)';
      ctx.font = 'bold 15px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('再玩一次', replay.x, replay.y + 61);
      ctx.fillText(nextView.locked ? '尚未解锁' : '下一关', next.x, next.y + 61);
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.font = '10px ' + UI_FONT;
      ctx.fillText('REPLAY', replay.x, replay.y + 78);
      ctx.fillText(nextView.locked ? 'LOCKED' : 'NEXT LEVEL', next.x, next.y + 78);

      roundRect(ctx, 62, 786, VIEW_W - 124, 76, 16);
      ctx.fillStyle = nextView.locked ? 'rgba(255,216,95,.10)' : 'rgba(110,240,167,.10)';
      ctx.fill();
      ctx.strokeStyle = nextView.locked ? 'rgba(255,216,95,.36)' : 'rgba(110,240,167,.32)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (nextView.locked) {
        ctx.fillStyle = 'rgba(255,255,255,.88)';
        ctx.font = 'bold 16px ' + UI_FONT;
        ctx.fillText('第' + nextView.formalNumber + '关 ' + nextView.title, VIEW_W / 2, 812);
        ctx.fillStyle = '#ffd85f';
        ctx.font = 'bold 23px ' + UI_FONT;
        ctx.fillText('尚需 ' + nextView.remaining + ' 分解锁', VIEW_W / 2, 843);
      } else {
        ctx.fillStyle = '#6ef0a7';
        ctx.font = 'bold 19px ' + UI_FONT;
        ctx.fillText('第' + nextView.formalNumber + '关 ' + nextView.title + ' 已解锁', VIEW_W / 2, 817);
        ctx.fillStyle = 'rgba(255,255,255,.68)';
        ctx.font = '13px ' + UI_FONT;
        ctx.fillText('点击屏幕任意位置进入下一关', VIEW_W / 2, 843);
      }

      ctx.fillStyle = 'rgba(255,255,255,.38)';
      ctx.font = '11px ' + UI_FONT;
      ctx.fillText(nextView.locked ? '点击后选择已解锁关卡继续' : '左侧“再玩一次”按钮除外', VIEW_W / 2, 884);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.64)';
      ctx.font = '13px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.fillText(cfg.kioskActive ? '按 空白键 直接出计分结果' : '图标出现后依序显示分数 · 点击可跳过', VIEW_W / 2, 704);
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      ctx.font = '10px ' + UI_FONT;
      ctx.fillText('ICON FIRST · SCORE NEXT', VIEW_W / 2, 724);
    }
    ctx.restore();
    drawPlayRewardBanner();
    updateAndDrawScoreConfetti(Date.now());
  }

  function drawCuteCircleButton(x, y, r, topColor, shadowColor, pressed) {
    pressed = pressed || false;
    var offset = pressed ? 10 : 0;
    ctx.fillStyle = shadowColor;
    ctx.beginPath(); ctx.arc(x, y + 12, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = topColor;
    ctx.beginPath(); ctx.arc(x, y + offset, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.26)';
    ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.24 + offset, r * 0.38, 0, Math.PI * 2); ctx.fill();
    return offset;
  }

  function drawReplayIcon(x, y, r) {
    if (drawUiSpriteButton('restart', x, y, 154, 88, cfg.uiPressVisual === 'restart')) return;
    var off = drawCuteCircleButton(x, y, r, '#9deaff', '#4db4cf', cfg.uiPressVisual === 'restart');
    ctx.strokeStyle = '#0c3340'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y + off, r * 0.42, Math.PI * 0.1, Math.PI * 1.62); ctx.stroke();
    ctx.fillStyle = '#0c3340';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.32, y - r * 0.16 + off);
    ctx.lineTo(x - r * 0.01, y - r * 0.36 + off);
    ctx.lineTo(x - r * 0.08, y - r * 0.02 + off);
    ctx.closePath(); ctx.fill();
  }

  function drawNextIcon(x, y, r) {
    if (drawUiSpriteButton('play', x, y, 154, 88, cfg.uiPressVisual === 'next')) return;
    var off = drawCuteCircleButton(x, y, r, '#82f5ad', '#3fb96b', cfg.uiPressVisual === 'next');
    ctx.fillStyle = '#0c3340';
    ctx.beginPath(); ctx.moveTo(x - 16, y - 24 + off); ctx.lineTo(x + 16, y + off); ctx.lineTo(x - 16, y + 24 + off); ctx.closePath(); ctx.fill();
    ctx.fillRect(x + 20, y - 20 + off, 10, 40);
  }

  function drawLeaderboardOverlay() {
    var slotCount = 10;
    var activeTab = cfg.leaderboardTab === 'personal' ? 'personal' : 'total';
    var currentProfile = cfg.playerProfile || { playerId: '', nickName: '微信玩家', avatarUrl: '' };
    var art = cfg.overlayUiAssets && cfg.overlayUiAssets.leaderboard;
    var panel = { x: 14, y: 42, w: VIEW_W - 28, h: (VIEW_W - 28) * 1536 / 1024 };
    if (panel.y + panel.h > VIEW_H - 10) { panel.h = VIEW_H - panel.y - 10; panel.w = panel.h * 1024 / 1536; panel.x = (VIEW_W - panel.w) * 0.5; }
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (art && art.ready) ctx.drawImage(art.image, panel.x, panel.y, panel.w, panel.h);
    else { roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24); ctx.fillStyle = '#9a5c24'; ctx.fill(); }

    var sx = panel.w / 1024, sy = panel.h / 1536;
    function px(v) { return panel.x + v * sx; }
    function py(v) { return panel.y + v * sy; }
    var close = { x: px(930), y: py(205), r: 42 * sx };
    hotspots.leaderboardClose = close;
    hotspots.leaderboardReturn = { x: px(512), y: py(1452), w: 350 * sx, h: 92 * sy };
    hotspots.leaderboardList = { x: px(520), y: py(810), w: 820 * sx, h: 1050 * sy };

    // 底图 ranking_panel.png 已烙印：顶部黄/绿两个 tab 格子、10 行槽位（皇冠/名次徽章/分数木牌）、
    // 底部“排行榜每5分钟更新一次”与“返回”按钮。Canvas 只补：tab 文字与选中态、行内头像/昵称/分数、
    // 个人榜内容。坐标全部按底图实测（1024x1536 设计空间）对齐，不再自绘格子，避免两层错位。
    var tabCells = {
      total:    { cx: 344, cy: 207, w: 288, h: 74 },  // 底图黄格实测 x 200-488, y 172-242
      personal: { cx: 679, cy: 207, w: 272, h: 74 }   // 底图绿格实测 x 543-815, y 172-242
    };
    function drawTabLabel(id, label) {
      var cell = tabCells[id];
      var selected = activeTab === id;
      var pressed = cfg.uiPressVisual === ('leaderboard_' + id);
      // 只在底图格子上写字，不画任何方框；按下时文字整体下沉，呈现“按下去”的效果
      var down = pressed ? 6 * sy : 0;
      var y = py(cell.cy - cell.h / 2) + down;
      var h = cell.h * sy;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(36 * sx) + 'px ' + UI_FONT;
      ctx.lineWidth = Math.max(2, 5 * sx);
      ctx.strokeStyle = pressed ? 'rgba(74,40,15,.55)' : '#4a280f';
      ctx.fillStyle = selected ? (pressed ? 'rgba(255,255,255,.82)' : '#ffffff') : (pressed ? 'rgba(255,255,255,.62)' : 'rgba(255,255,255,.88)');
      ctx.strokeText(label, px(cell.cx), y + h * 0.52);
      ctx.fillText(label, px(cell.cx), y + h * 0.52);
    }
    drawTabLabel('total', '总榜单');
    drawTabLabel('personal', '个人榜');
    // 热点必须用“中心点 + 宽高”语义（pointInRect 按 r.x±w/2 判定），正对底图烙印格子
    hotspots.leaderboardTotalTab = { x: px(tabCells.total.cx), y: py(tabCells.total.cy), w: 330 * sx, h: 112 * sy };
    hotspots.leaderboardPersonalTab = { x: px(tabCells.personal.cx), y: py(tabCells.personal.cy), w: 310 * sx, h: 112 * sy };

    var top10 = (cfg.globalLeaderboardView && cfg.globalLeaderboardView.top10) ? cfg.globalLeaderboardView.top10 : ((cfg.leaderboard || []).slice(0, slotCount));
    var beatPercent = cfg.globalLeaderboardView ? Math.max(0, Math.min(100, Math.round(Number(cfg.globalLeaderboardView.beatPercent) || 0))) : 0;
    var myScore = cfg.globalLeaderboardView ? Math.max(0, Math.round(Number(cfg.globalLeaderboardView.myScore) || 0)) : Math.max(0, Math.round(Number(currentProfile && currentProfile.score) || 0));
    var myRank = cfg.globalLeaderboardView ? Math.max(1, Math.round(Number(cfg.globalLeaderboardView.myRank) || 1)) : 1;
    var totalPlayers = cfg.globalLeaderboardView ? Math.max(1, Math.round(Number(cfg.globalLeaderboardView.totalPlayers) || 1)) : Math.max(1, top10.length);

    // 主体内容区：行槽中心按底图实测（第 1 行高亮条约 y 328，行距 ~105）
    var rowCenters = [330, 435, 540, 646, 752, 858, 963, 1067, 1172, 1276];
    if (activeTab === 'total') {
      // 总榜单：前 50 名，支持下滑滚动。静止时直接画进底图烙印的 10 个槽位；
      // 一旦滚动，铺奶油画板盖住底图槽位，50 行裁剪滚动绘制。
      var rows50 = (cfg.globalLeaderboardView && cfg.globalLeaderboardView.top50 && cfg.globalLeaderboardView.top50.length)
        ? cfg.globalLeaderboardView.top50
        : (top10.length ? top10 : (cfg.leaderboard || []).slice(0, slotCount));
      var listTop = py(272), listBottom = py(1340);
      var rowSpacing = 52.5; // 105 设计px × sy(0.5)
      var extraRows = cfg.leaderboardNotOnList ? 1 : 0; // 未上榜时末尾多一行提示文字
      var maxScroll = Math.max(0, (rows50.length + extraRows) * rowSpacing - (listBottom - listTop));
      var scrollY = clamp(Number(cfg.leaderboardScrollY) || 0, 0, maxScroll);
      function drawTotalRow(entry, cy, showRank, rankNo) {
        var isCurrent = !!entry.isCurrent || (!!entry.playerId && entry.playerId === currentProfile.playerId);
        if (isCurrent) {
          roundRect(ctx, px(132), cy - 44 * sy, px(914) - px(132), 88 * sy, 12 * sx);
          ctx.fillStyle = 'rgba(255,205,92,.32)'; ctx.fill();
        }
        if (showRank) {
          var badgeColor = rankNo === 1 ? '#f6b93b' : (rankNo === 2 ? '#c8cdd4' : (rankNo === 3 ? '#d9a066' : 'rgba(122,84,44,.22)'));
          ctx.fillStyle = badgeColor;
          ctx.beginPath(); ctx.arc(px(215), cy, 21 * sx, 0, Math.PI * 2); ctx.fill();
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = rankNo <= 3 ? '#ffffff' : '#6b4a26';
          ctx.font = 'bold ' + Math.round(24 * sx) + 'px ' + UI_NUM;
          ctx.fillText(String(rankNo), px(215), cy + 1 * sy);
        }
        drawPlayerAvatar(entry.avatarUrl, entry.nickName, px(326), cy, 30 * sx, isCurrent);
        var displayName = String(entry.nickName || '微信玩家');
        if (displayName.length > 9) displayName = displayName.slice(0, 8) + '…';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2d1b0d';
        ctx.font = 'bold ' + Math.round(25 * sx) + 'px ' + UI_FONT;
        ctx.fillText(displayName + (isCurrent ? '（我）' : ''), px(390), cy);
        ctx.textAlign = 'center'; ctx.fillStyle = '#4a210b'; ctx.font = 'bold ' + Math.round(29 * sx) + 'px ' + UI_NUM;
        ctx.fillText(String(Math.max(0, Number(entry.score) || 0)), px(800), cy + 2 * sy);
      }
      if (scrollY <= 0.5) {
        for (var i = 0; i < slotCount; i++) {
          var entry = rows50[i];
          if (!entry) break;
          drawTotalRow(entry, py(rowCenters[i]));
        }
        if (rows50.length > slotCount && !cfg.leaderboardNotOnList) {
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(90,58,26,.62)';
          ctx.font = 'bold ' + Math.round(19 * sx) + 'px ' + UI_FONT;
          ctx.fillText('↓ 下滑查看前 ' + Math.min(50, rows50.length) + ' 名', px(523), py(1318));
        }
      } else {
        // 滚动态：奶油画板盖住底图槽位 + 裁剪滚动绘制 50 行
        var plateX = px(119), plateW = px(927) - plateX;
        roundRect(ctx, plateX, listTop, plateW, listBottom - listTop, 18 * sx);
        ctx.fillStyle = '#f7e6c4'; ctx.fill();
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(2, 3 * sx); ctx.stroke();
        ctx.save();
        ctx.beginPath(); ctx.rect(plateX, listTop, plateW, listBottom - listTop); ctx.clip();
        for (var r = 0; r < rows50.length; r++) {
          var rowCy = listTop + 29 + r * rowSpacing - scrollY; // 首行中心 29 视图px，与静止态 py(330) 对齐
          if (rowCy < listTop - 50 || rowCy > listBottom + 50) continue;
          drawTotalRow(rows50[r], rowCy, true, r + 1);
        }
        // 未上榜：最后一页（第 50 名之后）显示提示
        if (cfg.leaderboardNotOnList) {
          var tipCy = listTop + 29 + rows50.length * rowSpacing - scrollY;
          if (tipCy > listTop - 50 && tipCy < listBottom + 50) {
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#8a5a2b';
            ctx.font = 'bold ' + Math.round(30 * sx) + 'px ' + UI_FONT;
            ctx.fillText('你还没有上榜噢', px(523), tipCy);
            ctx.fillStyle = 'rgba(122,84,44,.75)';
            ctx.font = 'bold ' + Math.round(20 * sx) + 'px ' + UI_FONT;
            ctx.fillText('再吃几个圈就能上榜啦', px(523), tipCy + 40 * sy);
          }
        }
        ctx.restore();
      }
    } else {
      // 个人榜：底图的 10 行槽位是总榜单用的，先铺一块与槽位区同宽的奶油画板盖住格子，
      // 再在其上排版「你已击败XX%的美食家」+ 总分 + 名次，避免文字与底图格子叠在一起。
      var plateX = px(119), plateY = py(272), plateW = px(927) - plateX, plateH = py(1340) - plateY;
      roundRect(ctx, plateX, plateY, plateW, plateH, 18 * sx);
      ctx.fillStyle = '#f7e6c4'; ctx.fill();
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(2, 3 * sx); ctx.stroke();
      var cx = px(520);
      // 头像（与本机玩家一致），置于上方
      drawPlayerAvatar(currentProfile.avatarUrl, currentProfile.nickName || '微信玩家', cx, py(400), 50 * sx, true);
      // 奖牌装饰（仅在玩家进过前 3 时显示）
      var isTop3 = myRank > 0 && myRank <= 3;
      if (isTop3) {
        ctx.fillStyle = '#ffd14a';
        ctx.beginPath();
        ctx.moveTo(cx - 32 * sx, py(452));
        ctx.lineTo(cx + 32 * sx, py(452));
        ctx.lineTo(cx, py(486));
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#a86907'; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#7a3a04'; ctx.font = 'bold ' + Math.round(20 * sx) + 'px ' + UI_FONT;
        ctx.fillText('TOP ' + myRank, cx, py(471));
      }
      // 大字「你已击败 XX% 的美食家」
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4a280f';
      ctx.font = 'bold ' + Math.round(30 * sx) + 'px ' + UI_FONT;
      ctx.fillText('你已击败', cx, py(588));
      // 百分数：超大号高亮
      ctx.fillStyle = '#d72a18';
      ctx.font = 'bold ' + Math.round(92 * sx) + 'px ' + UI_NUM;
      ctx.strokeStyle = 'rgba(74,40,15,.4)'; ctx.lineWidth = Math.max(2, 3 * sx);
      ctx.strokeText(beatPercent + '%', cx, py(716));
      ctx.fillText(beatPercent + '%', cx, py(716));
      // 「美食家」后缀
      ctx.fillStyle = '#4a280f';
      ctx.font = 'bold ' + Math.round(34 * sx) + 'px ' + UI_FONT;
      ctx.fillText('的美食家', cx, py(830));
      // 当前累计总分行
      ctx.fillStyle = '#73512f'; ctx.font = 'bold ' + Math.round(22 * sx) + 'px ' + UI_FONT;
      ctx.fillText('你的总分数', cx, py(952));
      ctx.fillStyle = '#2d1b0d';
      ctx.font = 'bold ' + Math.round(48 * sx) + 'px ' + UI_NUM;
      ctx.fillText(String(myScore), cx, py(1022));
      // 排名副标：基于全部玩家
      ctx.fillStyle = '#73512f'; ctx.font = 'bold ' + Math.round(19 * sx) + 'px ' + UI_FONT;
      var rankText = isTop3 ? ('你目前排在第 ' + myRank + ' 名') : ('全部 ' + totalPlayers + ' 位美食家中排在第 ' + myRank + ' 名');
      ctx.fillText(rankText, cx, py(1108));
      // 鼓励文案（按击败率分段）
      ctx.fillStyle = '#8c633e'; ctx.font = 'bold ' + Math.round(18 * sx) + 'px ' + UI_FONT;
      var cheer;
      if (beatPercent >= 90) cheer = '你已超越绝大多数美食家！';
      else if (beatPercent >= 60) cheer = '继续吃，美食家！';
      else if (beatPercent >= 30) cheer = '加油，再多吃几个圈！';
      else cheer = '舌尖的力量正在觉醒！';
      ctx.fillText(cheer, cx, py(1160));
      // 个人榜不启用列表滚动
      hotspots.leaderboardList = { x: 0, y: 0, w: 0, h: 0 };
    }

    // 底部“排行榜每5分钟更新一次”与“返回”按钮均已烙印在底图中；
    // 仅在没有底图（兜底纯色面板）时才需要补画文字。
    if (!art || !art.ready) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3a2412';
      ctx.font = 'bold ' + Math.round(20 * sx) + 'px ' + UI_FONT;
      ctx.fillText('排行榜每5分钟更新一次', px(512), py(1395));
    }

    ctx.restore();
  }

  function drawPlayerAboveIndicator(focusX) {
    if (!cfg.player || cfg.scene === 'editor') return;
    if (cfg.player.y + cfg.player.r >= 0) return;
    var x = clamp(worldToScreenX(cfg.player.x, focusX), 30, VIEW_W - 30);
    var y = 88;
    var pulse = 1 + Math.sin(nowSec() * 8) * 0.08;
    ctx.save();
    ctx.translate(x, y); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(5,14,24,.78)';
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd85f';
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-10, 4); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(0, 16); ctx.stroke();
    ctx.restore();
  }


  function drawFrame(nextCfg) {
    cfg = nextCfg || {};
    VIEW_W = cfg.VIEW_W || 540;
    VIEW_H = cfg.VIEW_H || 960;
    dpr = cfg.dpr || 1;
    fitScale = cfg.fitScale || 1;
    offX = cfg.offX || 0;
    offY = cfg.offY || 0;
    cameraY = Number(cfg.cameraY) || 0;
    performanceTier = String(cfg.performanceTier || (cfg.lowDevice ? 'low' : 'high'));
    if (performanceTier !== 'low' && performanceTier !== 'balanced' && performanceTier !== 'high') performanceTier = 'high';
    frameNowSec = cfg.nowSec ? Number(cfg.nowSec()) || 0 : Date.now() / 1000;
    hotspots = {};
    refreshArtScale();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  var canvasChanged = canvas.width !== lastCanvasWidth || canvas.height !== lastCanvasHeight;
  var fullCanvasReset = !canvasFrameInitialized || canvasChanged || cfg.forceCanvasReset || lastFrameScene !== cfg.scene;
  if (fullCanvasReset) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    canvasFrameInitialized = true;
    lastCanvasWidth = canvas.width;
    lastCanvasHeight = canvas.height;
  }
  lastFrameScene = cfg.scene;

  ctx.setTransform(dpr * fitScale, 0, 0, dpr * fitScale, dpr * offX, dpr * offY);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, VIEW_H);
  ctx.clip();

  if (cfg.scene === 'loading') {
    drawLoadingScene();
    ctx.restore();
    cfg.setUiHotspots(hotspots);
    return;
  }
  if (cfg.scene === 'menu') {
    try {
      drawMenuScene();
      if (cfg.stageSelectOpen) drawStageSelectOverlay();
      if (cfg.skinPanelOpen) drawSkinPanelOverlay();
      if (cfg.leaderboardOpen) drawLeaderboardOverlay();
      if (cfg.rewardDialog && cfg.rewardDialog.active) drawRewardDialogOverlay();
      if (cfg.dailyLoginPopup && cfg.dailyLoginPopup.active) drawDailyLoginPopup();
      drawEditorEnterButton();
      drawSkinSwitchBanner();
    } catch(menuDrawErr) { console.error('menu draw error:', menuDrawErr && menuDrawErr.message); }
    ctx.restore();
    cfg.setUiHotspots(hotspots);
    return;
  }
  if (cfg.scene === 'tutorial_comic') {
    drawTutorialComicScene();
    drawEditorEnterButton();
    ctx.restore();
    cfg.setUiHotspots(hotspots);
    return;
  }

  var slowmoZoom = cfg.scene === 'finish_slowmo' ? cfg.finishState.zoom : 1;
  var focusX = cfg.scene === 'finish_slowmo'
    ? clamp(cfg.player.x - VIEW_W * 0.50, 0, cfg.runtimeLevel.width - VIEW_W)
    : cfg.cameraX;
  var shakeX = 0;
  var shakeY = 0;

  if (cfg.scene === 'editor') {
    var vp = editorViewport(), z = editorZoom();
    var mapOffsetX = Math.max(0, (vp.w - cfg.runtimeLevel.width * z) * 0.5);
    var mapOffsetY = Math.max(0, (vp.h - cfg.runtimeLevel.height * z) * 0.5);
    ctx.save();
    ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
    ctx.translate(vp.x, vp.y); ctx.scale(vp.w / VIEW_W, vp.h / VIEW_H);
    drawBackground(cfg.cameraX);
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
    ctx.translate(vp.x + mapOffsetX, vp.y + mapOffsetY);
    ctx.scale(z, z);
    ctx.translate(0, -((cfg.editorState && cfg.editorState.cameraY) || 0));
    var worldW = vp.w / z, worldH = vp.h / z;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = clamp(1 / z, 0.8, 8);
    var grid = 100, gx0 = Math.floor(cfg.cameraX / grid) * grid, gy0 = Math.floor((((cfg.editorState && cfg.editorState.cameraY) || 0)) / grid) * grid;
    for (var gx = gx0; gx <= cfg.cameraX + worldW + grid; gx += grid) { var sx = gx - cfg.cameraX; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, cfg.runtimeLevel.height); ctx.stroke(); }
    for (var gy = gy0; gy <= ((cfg.editorState && cfg.editorState.cameraY) || 0) + worldH + grid; gy += grid) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(worldW, gy); ctx.stroke(); }
    ctx.restore();
    drawRoundBoundaryMarker(focusX);
    drawWalls(focusX);
    drawBumpers(focusX);
    drawFinishLine(focusX);
    drawAnchors(focusX);
    drawFoods(focusX);
    drawPlayer(focusX);
    drawEditorGuides(focusX);
    ctx.restore();
  } else {
    drawBackground(focusX);
    ctx.save();
    if (slowmoZoom !== 1) {
      var playerScreenX = worldToScreenX(cfg.player.x, focusX);
      var playerScreenY = cfg.player.y - cameraY;
      var focusScreenY = VIEW_H * 0.56;
      ctx.translate(VIEW_W * 0.5, focusScreenY);
      ctx.scale(slowmoZoom, slowmoZoom);
      ctx.translate(-playerScreenX, -playerScreenY);
    }
    ctx.translate(shakeX, shakeY);
    ctx.translate(0, -cameraY);
    drawRoundBoundaryMarker(focusX);
    drawWalls(focusX);
    drawBumpers(focusX);
    drawFinishLine(focusX);
    drawAnchors(focusX);
    drawFoods(focusX);
    drawCrows(focusX);
    drawFeathers(focusX);
    drawCrowVanish(focusX);
    drawTutorialTargetGuides(focusX);
    drawFartBurst(focusX);
    drawPortal(focusX);
    drawFloodFountain(cfg.floodFountainFx);   // 2026-10-01 白娘子·水漫金山：画在角色之下
    drawPlayer(focusX);
    if (cfg.scene === 'soul_departure') drawSoulSprite(focusX);
    drawTongue(focusX);
    drawParticles(focusX);
    drawFloatingTexts(focusX);
    ctx.restore();
  }

  drawPlayerAboveIndicator(focusX);

  if (cfg.scene === 'editor') { drawEditorOverlay(focusX); drawEditorFileDialog(); }
  else if (cfg.scene !== 'portal_transition' && cfg.scene !== 'portal_preview') {
    drawTopBar();
    // 2026-10-11：网页大屏移除右上角暂停键（用户要求；现场只有一颗 USB 实体键）。
    var kioskHidePause = false;
    try { kioskHidePause = typeof window !== 'undefined' && window.__kioskBigScreen === true; } catch (e) {}
    if (cfg.scene === 'playing' && !kioskHidePause) drawPauseButton();
  }

  if (cfg.scene === 'playing') drawCrowWarningOverlay();

  if (cfg.isTutorialStage() && cfg.scene === 'playing') drawTutorialOverlay();
  if (cfg.scene === 'paused') { drawPauseOverlay(); drawPauseButton(); }
  if (cfg.scene === 'golden_skill') drawGoldenSkillOverlay();
  if (cfg.scene === 'golden_skill_ad') drawGoldenSkillAdOverlay();
  if (cfg.scene === 'death') drawDeathOverlay();
  // [v42 现场 2026-11-01] 线下闯关不出现「游戏结束」面板（排行榜 / 重新开始 / 返回首页）。
  //   core 侧已拦截进入，这里再兜一层：万一残留，也只画暗化层并清空三个热区。
  if (cfg.scene === 'game_over') {
    if (cfg.kioskActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      hotspots.gameOverLeaderboard = { x: -9999, y: -9999, w: 1, h: 1, r: 0 };
      hotspots.gameOverRestart = { x: -9999, y: -9999, w: 1, h: 1, r: 0 };
      hotspots.gameOverHome = { x: -9999, y: -9999, w: 1, h: 1, r: 0 };
      ctx.restore();
    } else {
      drawGameOverOverlay();
    }
  }
  if (cfg.scene === 'soul_departure') drawSoulDepartureOverlay();
  if (cfg.scene === 'finish_slowmo') drawSlowmoOverlay();
  if (cfg.scene === 'score_tally') drawScoreTally();
  if (cfg.scene === 'unlock_gate') drawUnlockGateOverlay();
  if (cfg.scene === 'portal_transition' || cfg.scene === 'portal_preview') drawPortalTransitionOverlay();
  if (cfg.scene === 'portal_preview') drawPortalPreviewControls();
  if (cfg.leaderboardOpen) drawLeaderboardOverlay();
  if (cfg.rewardDialog && cfg.rewardDialog.active) drawRewardDialogOverlay();
  if (cfg.skinPanelOpen && cfg.scene !== 'menu') drawSkinPanelOverlay();
  drawEditorEnterButton();
  drawSkinSwitchBanner();

  ctx.restore(); // 移除裁剪
  cfg.setUiHotspots(hotspots);
  }

  // 2026-10-10 切换皮肤弹层：可爱圆体、画面顶部 1/3、黄色半透明、无外框。
  // 出现后停留 holdMs(1s)，随后在 riseMs(1s) 内向上移动并淡出。由 core 的 activateSkinSwitchBanner 触发。
  var SKIN_BANNER_FONT = 'bold 24px "Yuanti SC","YuanTi SC","Hiragino Sans GB","PingFang SC","Microsoft YaHei",sans-serif';
  function drawSkinSwitchBanner() {
    var b = cfg.skinSwitchBanner;
    if (!b || !b.active) return;
    var now = Date.now();
    var t = now - (b.startedAt || now);
    var total = (b.holdMs || 1000) + (b.riseMs || 1000);
    if (t < 0 || t >= total) { b.active = false; return; }
    var hold = b.holdMs || 1000;
    var rise = b.riseMs || 1000;
    var fade, dy;
    if (t <= hold) { fade = 1; dy = 0; }
    else {
      var k = (t - hold) / rise;
      fade = Math.max(0, 1 - k);
      dy = -(b.riseDist || 70) * k;
    }
    if (fade <= 0) { b.active = false; return; }
    var cx = VIEW_W * 0.5;
    var cy = VIEW_H / 3 + dy;
    ctx.save();
    ctx.globalAlpha = 0.82 * fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d98a00';
    ctx.font = SKIN_BANNER_FONT;
    ctx.fillText(b.text, cx, cy);
    ctx.restore();
  }

  return drawFrame;
}

var cachedRenderer = null;
var cachedRendererContext = null;
var cachedRendererCanvas = null;
function draw(ctx, canvas, cfg) {
  if (!cachedRenderer || cachedRendererContext !== ctx || cachedRendererCanvas !== canvas) {
    cachedRendererContext = ctx;
    cachedRendererCanvas = canvas;
    cachedRenderer = createRenderer(ctx, canvas);
  }
  cachedRenderer(cfg);
}


module.exports = {
  foodIconCache: foodIconCache,
  draw: draw,
  getFoodIcon: getFoodIcon
};
