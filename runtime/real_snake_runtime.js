/*
 * 真蛇 S 型游动与绘制 / White & Green Real Snake
 * ES5/CommonJS compatible with WeChat Mini Game Canvas 2D.
 * Pure pose/movement code; lazy image loading, never modifies game logic outside snake mode.
 * Source art: exactly the user's 白蛇.png and 青蛇.png, tongue region removed from draw copies.
 *
 * 2026-10-13 (骨骼版 v1)：以「骨骼链(关节锚点) + 连续三角网格蒙皮」重建整条蛇身。
 *  - 不再把蛇切成「刚体头 + 多段身体条带」，头与身体是同一张连续蒙皮的一部分，
 *    因此头部与颈部不再出现撕裂/错位缝隙。
 *  - 脊柱由 head + segments(FABRIK 链) 构成关节锚点，按弧长重采样为细密关节；
 *    逐关节取源图对应竖条，作为沿切向对齐的十字截面，相邻关节用两个三角面拼接，
 *    三角面经仿射矩阵纹理映射（clip 限定），整条蛇无缝连续。
 *  - 源图自带首尾粗细与轮廓，蒙皮后自然保留 taper，无需额外裁切。
 */
'use strict';
(function (root, build) {
  var api = build();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RealSnakeRuntime = api; // browser standalone demo
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TWO_PI = Math.PI * 2;
  var CONFIG = {
    spriteWidth: 2048, spriteHeight: 682,
    // Raster/head registration in the user-supplied PNGs.
    // 2026-10-13 新版白蛇/青蛇：头更大更靠前（鼻尖 ~2030），身体更肥（~172px），
    // 静态画好的蛇信已从贴图抠除，改由 drawTongue 动态抖动绘制。
    headPivotX: 1890, headPivotY: {bai: 368, qing: 367},
    // 鼻尖源图 x（不取 2048 边缘，避免采样到透明边）
    noseXSrc: 2030,
    sourceTailX: 15, worldPerPixel: 0.18,
    segmentGap: 20, segmentCount: 18,
    // 骨骼版：关节锚点重采样步长（屏幕 px）与三角面拼接时的抗缝膨胀
    subdiv: 9,
    seamExpand: 0.8,
    // 蛇信锚点（嘴角色）
    mouthSrcX: 1970,
    mouthSrcY: {bai: 392, qing: 390},
    waveAmplitude: 12, waveCyclesPerSecond: 1.65,
    waveSpatialFrequency: 0.05,
    turnSpeed: 7.5,
    snakeSpeed: 360,
    tonguePeriod: 1,
    tongueLength: 18,
    assets: {
      bai: 'res_skins/real_snakes/white_body.png',
      qing: 'res_skins/real_snakes/green_body.png'
    }
  };
  // 鼻尖相对头枢轴的「向前」屏幕位移（头枢轴=headPivot 落在 headX 上）
  CONFIG.headFwd = (CONFIG.noseXSrc - CONFIG.headPivotX) * CONFIG.worldPerPixel;
  var spriteCache = {};
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function finite(x, fallback) { return typeof x === 'number' && isFinite(x) ? x : fallback; }
  function angleWrap(x) { return Math.atan2(Math.sin(x), Math.cos(x)); }
  function randomAngle(rng) { return ((rng || Math.random)() * 2 - 1) * Math.PI; }
  function ensureSegments(state, options) {
    var count = Math.max(2, finite(options && options.segmentCount, CONFIG.segmentCount) | 0);
    var gap = Math.max(1, finite(options && options.segmentGap, CONFIG.segmentGap));
    var a = finite(state.heading, finite(state.wanderAngle, 0));
    if (!Array.isArray(state.segments)) state.segments = [];
    if (state.segments.length !== count) {
      state.segments.length = 0;
      for (var k = 0; k < count; k++) state.segments.push({
        x: state.headX - Math.cos(a) * gap * (k + 1),
        y: state.headY - Math.sin(a) * gap * (k + 1)
      });
    }
  }
  function start(state, rng, options) {
    if (!state) return state;
    state.heading = randomAngle(rng);
    state.wanderAngle = state.heading;
    state.phase = 0;
    state.facing = Math.cos(state.heading) >= 0 ? 1 : -1;
    state.vx = 0; state.vy = 0;
    state.wanderTimer = Infinity; // Tap-only: intentionally no periodic direction changes.
    state.segments = [];
    ensureSegments(state, options);
    return state;
  }
  function changeDirection(state, rng) {
    if (!state) return 0;
    var old = finite(state.wanderAngle, finite(state.heading, 0));
    // Direction must genuinely change: minimum 60°, maximum 180°.
    var sign = (rng || Math.random)() < 0.5 ? 1 : -1;
    var delta = Math.PI / 3 + (rng || Math.random)() * (2 * Math.PI / 3);
    state.wanderAngle = angleWrap(old + sign * delta);
    state.wanderTimer = Infinity;
    return state.wanderAngle;
  }
  function step(state, dt, opts) {
    if (!state) return state;
    opts = opts || {};
    dt = clamp(finite(dt, 0), 0, 0.06);
    ensureSegments(state, opts);
    var gameDt = clamp(finite(opts.animationDt, dt), 0, 0.06);
    state.phase = finite(state.phase, 0) + gameDt;
    var angle = finite(state.heading, finite(state.wanderAngle, 0));
    var target = finite(state.wanderAngle, angle);
    var difference = angleWrap(target - angle);
    var maxTurn = finite(opts.turnSpeed, CONFIG.turnSpeed) * dt;
    angle = angleWrap(angle + clamp(difference, -maxTurn, maxTurn));
    var speed = Math.max(0, finite(opts.speed, CONFIG.snakeSpeed));
    var x0 = finite(state.headX, 0), y0 = finite(state.headY, 0);
    var x = x0 + Math.cos(angle) * speed * dt;
    var y = y0 + Math.sin(angle) * speed * dt;
    var minX = finite(opts.minX, finite(opts.radius, 17));
    var maxX = finite(opts.maxX, finite(opts.width, 99999) - minX);
    var minY = finite(opts.minY, -70);
    var maxY = finite(opts.maxY, finite(opts.height, 99999) - finite(opts.radius, 17) - 4);
    // Physical border reflection only: the snake never randomly changes direction by a timer.
    if (x < minX || x > maxX) {
      x = clamp(x, minX, maxX);
      angle = angleWrap(Math.PI - angle);
      state.wanderAngle = angle;
    }
    if (y < minY || y > maxY) {
      y = clamp(y, minY, maxY);
      angle = angleWrap(-angle);
      state.wanderAngle = angle;
    }
    state.heading = angle;
    state.headX = x; state.headY = y;
    state.vx = dt > 0 ? (x - x0) / dt : 0;
    state.vy = dt > 0 ? (y - y0) / dt : 0;
    state.facing = Math.cos(angle) >= 0 ? 1 : -1;
    var px = x, py = y, gap = Math.max(1, finite(opts.segmentGap, CONFIG.segmentGap));
    // Backward FABRIK-style distance constraints. All positions always stay 20 px apart.
    for (var i = 0; i < state.segments.length; i++) {
      var seg = state.segments[i];
      var dx = px - seg.x, dy = py - seg.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-5) {
        dx = Math.cos(angle); dy = Math.sin(angle); len = 1;
      }
      seg.x = px - dx / len * gap;
      seg.y = py - dy / len * gap;
      px = seg.x; py = seg.y;
    }
    return state;
  }
  function bones(state, worldToScreenX) {
    var pts = [{ x: worldToScreenX ? worldToScreenX(state.headX) : state.headX, y: state.headY }];
    (state.segments || []).forEach(function (s) {
      pts.push({ x: worldToScreenX ? worldToScreenX(s.x) : s.x, y: s.y });
    });
    return pts;
  }
  function makeSampler(state, worldToScreenX) {
    var pts = bones(state, worldToScreenX);
    var distances = [0], total = 0;
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
      total += Math.sqrt(dx * dx + dy * dy);
      distances.push(total);
    }
    var heading = finite(state.heading, 0);
    var initialX = Math.cos(heading), initialY = Math.sin(heading);
    function raw(distance) {
      var d = clamp(distance, 0, total);
      for (var j = 1; j < pts.length; j++) {
        if (d <= distances[j] || j === pts.length - 1) {
          var span = distances[j] - distances[j-1];
          var r = span > 1e-4 ? (d - distances[j-1]) / span : 0;
          return { x: pts[j-1].x + (pts[j].x - pts[j-1].x) * r,
                   y: pts[j-1].y + (pts[j].y - pts[j-1].y) * r };
        }
      }
      return pts[0];
    }
    function point(distance) {
      var d = clamp(distance, 0, total);
      var p = raw(d);
      // Smooth traveling wave envelopes: nose stationary, tail gradually amplifies.
      var s = Math.pow(clamp(d / Math.max(1, total), 0, 1), 0.9);
      var phase = finite(state.phase, 0) * CONFIG.waveCyclesPerSecond * TWO_PI;
      var offset = CONFIG.waveAmplitude * s * Math.sin(phase - d * CONFIG.waveSpatialFrequency);
      var a = raw(Math.max(0, d - 2.5)), b = raw(Math.min(total, d + 2.5));
      var tx = a.x - b.x, ty = a.y - b.y; // forward tangent
      var length = Math.hypot(tx, ty);
      tx = length ? tx/length : initialX;
      ty = length ? ty/length : initialY;
      p.x += -ty * offset; p.y += tx * offset;
      return p;
    }
    function tangent(distance) {
      var a = point(Math.max(0, distance - 1.6));
      var b = point(Math.min(total, distance + 1.6));
      var vx = a.x - b.x, vy = a.y - b.y;
      return Math.atan2(vy, vx);
    }
    return { sample: point, tangent: tangent, total: total, points: pts };
  }

  // ---- 骨骼版：关节锚点脊柱 + 连续三角网格蒙皮 ----
  // 把粗略关节（头 + segments）按弧长重采样为细密关节链，保留累计弧长 L。
  function buildFineSpine(coarse, step) {
    var fine = [];
    for (var i = 0; i < coarse.length - 1; i++) {
      var a = coarse[i], b = coarse[i + 1];
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.hypot(dx, dy);
      var n = Math.max(1, Math.round(len / step));
      for (var j = 0; j < n; j++) {
        var t = j / n;
        fine.push({ x: a.x + dx * t, y: a.y + dy * t });
      }
    }
    fine.push({ x: coarse[coarse.length - 1].x, y: coarse[coarse.length - 1].y });
    fine[0].L = 0;
    for (var k = 1; k < fine.length; k++) {
      fine[k].L = fine[k - 1].L + Math.hypot(fine[k].x - fine[k - 1].x, fine[k].y - fine[k - 1].y);
    }
    return fine;
  }
  // 由相邻关节求切向/法向（中央差分，端点用前向/后向）
  function jointFrame(fine, i) {
    var a = fine[Math.max(0, i - 1)], b = fine[Math.min(fine.length - 1, i + 1)];
    var tx = b.x - a.x, ty = b.y - a.y;
    var tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    return { tx: tx, ty: ty, nx: -ty, ny: tx };
  }
  // 仿射矩阵：把源三角 (s0,s1,s2) 映射到目标三角 (d0,d1,d2)。返回 [a,b,c,d,e,f]。
  function solveAffine(s0, s1, s2, d0, d1, d2) {
    var ax = s0.x, ay = s0.y, bx = s1.x, by = s1.y, cx = s2.x, cy = s2.y;
    var det = ax * (by - cy) - ay * (bx - cx) + (bx * cy - by * cx);
    if (Math.abs(det) < 1e-7) return null;
    var id = 1 / det;
    var r0a = (by - cy) * id, r0b = (cy - ay) * id, r0c = (ay - by) * id;
    var r1a = (cx - bx) * id, r1b = (ax - cx) * id, r1c = (bx - ax) * id;
    var r2a = (bx * cy - by * cx) * id, r2b = (ay * cx - ax * cy) * id, r2c = (ax * by - ay * bx) * id;
    var a = r0a * d0.x + r0b * d1.x + r0c * d2.x;
    var c = r1a * d0.x + r1b * d1.x + r1c * d2.x;
    var e = r2a * d0.x + r2b * d1.x + r2c * d2.x;
    var b = r0a * d0.y + r0b * d1.y + r0c * d2.y;
    var d = r1a * d0.y + r1b * d1.y + r1c * d2.y;
    var f = r2a * d0.y + r2b * d1.y + r2c * d2.y;
    return [a, b, c, d, e, f];
  }
  // 把三角目标顶点沿质心外扩 amt px（抗 AA 发丝缝）
  function expandTri(d0, d1, d2, amt) {
    var cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
    function p(pt) {
      var dx = pt.x - cx, dy = pt.y - cy, len = Math.hypot(dx, dy) || 1;
      return { x: pt.x + dx / len * amt, y: pt.y + dy / len * amt };
    }
    return [p(d0), p(d1), p(d2)];
  }
  // 单个三角面：仿射纹理映射 + clip 限定
  function drawTri(ctx, img, d0, d1, d2, s0x, s0y, s1x, s1y, s2x, s2y) {
    var mat = solveAffine({ x: s0x, y: s0y }, { x: s1x, y: s1y }, { x: s2x, y: s2y }, d0, d1, d2);
    if (!mat) return;
    var ex = expandTri(d0, d1, d2, CONFIG.seamExpand);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ex[0].x, ex[0].y); ctx.lineTo(ex[1].x, ex[1].y); ctx.lineTo(ex[2].x, ex[2].y); ctx.closePath();
    ctx.clip();
    ctx.transform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5]);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  // 关节十字截面端点：源 y 映射到沿法向偏移 (srcY - pivotY)*k
  function crossAt(node, srcY, k, pivotY) {
    var off = (srcY - pivotY) * k; // 用 headPivotY 作竖向锚（与旧版一致）
    return { x: node.x + node.nx * off, y: node.y + node.ny * off };
  }
  // 相邻两关节之间拼一个四边形（两三角），源条 [A.sx -> B.sx] × [0 -> spriteHeight]
  function drawQuad(ctx, img, A, B, k, pivotY) {
    var a0 = crossAt(A, 0, k, pivotY), a1 = crossAt(A, CONFIG.spriteHeight, k, pivotY);
    var b0 = crossAt(B, 0, k, pivotY), b1 = crossAt(B, CONFIG.spriteHeight, k, pivotY);
    // 三角 1：(a0, a1, b1) <- 源 ((A.sx,0),(A.sx,H),(B.sx,H))
    drawTri(ctx, img, a0, a1, b1, A.sx, 0, A.sx, CONFIG.spriteHeight, B.sx, CONFIG.spriteHeight);
    // 三角 2：(a0, b1, b0) <- 源 ((A.sx,0),(B.sx,H),(B.sx,0))
    drawTri(ctx, img, a0, b1, b0, A.sx, 0, B.sx, CONFIG.spriteHeight, B.sx, 0);
  }
  function getImage(kind) {
    kind = kind === 'qing' ? 'qing' : 'bai';
    var cached = spriteCache[kind];
    var now = Date.now ? Date.now() : 0;
    if (cached && (cached.ready || (!cached.failed && cached.loading) || now - cached.lastTry < 2500)) return cached.ready ? cached.img : null;
    var img = null;
    try {
      if (typeof wx !== 'undefined' && wx.createImage) img = wx.createImage();
      else if (typeof Image !== 'undefined') img = new Image();
    } catch (e) {}
    if (!img) return null;
    var asset = spriteCache[kind] = {img: img, ready:false, loading:true, failed:false, lastTry: now};
    img.onload = function () { asset.ready = true; asset.loading = false; asset.failed = false; };
    img.onerror = function () { asset.failed = true; asset.loading = false; };
    img.src = CONFIG.assets[kind];
    return null;
  }
  function drawTongue(ctx, state, headX, headY, angle, flipY) {
    var cycle = ((finite(state.phase, 0) % CONFIG.tonguePeriod) + CONFIG.tonguePeriod) % CONFIG.tonguePeriod;
    var extend = cycle < 0.14 ? cycle / 0.14 : (cycle < 0.48 ? 1 : (cycle < 0.72 ? 1 - (cycle - 0.48) / 0.24 : 0));
    extend = clamp(extend, 0, 1);
    if (extend < 0.02) return;
    var jitter = (Math.sin(cycle * TWO_PI * 23) + 0.35 * Math.sin(cycle * TWO_PI * 39)) * extend * 0.95;
    var L = CONFIG.tongueLength * extend;
    ctx.save(); ctx.translate(headX, headY); ctx.rotate(angle);
    if (flipY < 0) ctx.scale(1, -1);   // 2026-10-13：朝左（cos<0）时与头部同样做 y 翻转，蛇信分叉保持向下
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#54192c'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L*0.54, -1.5 + jitter, L, jitter); ctx.stroke();
    ctx.strokeStyle = state.kind === 'qing' ? '#eb5478' : '#ef5376'; ctx.lineWidth = 1.9;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L*0.54, -1.5 + jitter, L, jitter); ctx.stroke();
    ctx.strokeStyle = '#d74973'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(L, jitter); ctx.lineTo(L + 6*extend, -4.2*extend + jitter); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L, jitter); ctx.lineTo(L + 6*extend, 5.1*extend + jitter); ctx.stroke();
    ctx.restore();
  }
  // 骨骼版主绘制：关节链 -> 连续蒙皮（含头），最后单独绘制蛇信。
  function draw(ctx, state, worldToScreenX) {
    if (!ctx || !state || !state.active) return false;
    var img = getImage(state.kind);
    if (!img) return false;
    var w2s = worldToScreenX || function (x) { return x; };
    var k = CONFIG.worldPerPixel;
    var kind = state.kind === 'qing' ? 'qing' : 'bai';
    var pivotY = CONFIG.headPivotY[kind];
    var heading = finite(state.heading, finite(state.wanderAngle, 0));
    var dirx = Math.cos(heading), diry = Math.sin(heading);
    var hx = w2s(state.headX), hy = state.headY;
    // 粗略关节：鼻尖 -> 头枢轴(headX) -> segments（头 -> 尾）
    var coarse = [];
    coarse.push({ x: hx + dirx * CONFIG.headFwd, y: hy + diry * CONFIG.headFwd }); // 鼻尖
    coarse.push({ x: hx, y: hy });                                             // 头枢轴
    var segs = state.segments || [];
    for (var i = 0; i < segs.length; i++) coarse.push({ x: w2s(segs[i].x), y: segs[i].y });
    if (coarse.length < 2) return false;
    var fine = buildFineSpine(coarse, CONFIG.subdiv);
    var total = fine[fine.length - 1].L || 1;
    // 第一遍：沿法向施加行进波（蛇身 S 型摆动），并记录每关节源 x
    var phase = finite(state.phase, 0) * CONFIG.waveCyclesPerSecond * TWO_PI;
    for (var f = 0; f < fine.length; f++) {
      var fr = jointFrame(fine, f);
      var Lf = fine[f].L;
      var s = Math.pow(clamp(Lf / total, 0, 1), 0.85);
      var off = CONFIG.waveAmplitude * s * Math.sin(phase - Lf * CONFIG.waveSpatialFrequency);
      fine[f].x += fr.nx * off; fine[f].y += fr.ny * off;
      var sx = CONFIG.noseXSrc - Lf / k;
      fine[f].sx = clamp(sx, CONFIG.sourceTailX, CONFIG.noseXSrc);
    }
    // 第二遍：波形化后用「真实」切向/法向重算（供截面与拼接使用）。
    // 肚皮朝向（2026-10-13 修 bug）：源贴图腹鳞在身体下侧(y 大)。「向右游」时骨链朝 -x、
    // 关节法向朝屏幕上方，会把腹鳞翻到上面（用户反馈：蛇上下颠倒、肚子朝上）。
    // 故按行进方向取符号 nSign —— 等价于「右半平面纯旋转 + 左半平面上下镜像」，
    // 使腹鳞永远落在屏幕下方（与 drawTongue 的 flipY 同源）。
    var nSign = Math.cos(heading) >= 0 ? -1 : 1;
    for (var g = 0; g < fine.length; g++) {
      var fr2 = jointFrame(fine, g);
      fine[g].tx = fr2.tx; fine[g].ty = fr2.ty;
      fine[g].nx = fr2.nx * nSign; fine[g].ny = fr2.ny * nSign;
    }
    ctx.save();
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = true;
    // 尾 -> 头 逐个四边形拼接（头最后绘制，自然压在最上层）
    for (var q = fine.length - 2; q >= 0; q--) drawQuad(ctx, img, fine[q], fine[q + 1], k, pivotY);
    ctx.restore();
    // 蛇信：复用旧版嘴部配准（headX/heading/flipY），与蒙皮头部位置一致
    var ang = heading;
    var flipY = Math.cos(ang) < 0 ? -1 : 1;
    var mouthDX = (CONFIG.mouthSrcX - CONFIG.headPivotX) * k;
    var mouthDY = (CONFIG.mouthSrcY[kind] - pivotY) * k * flipY;
    drawTongue(ctx, state,
      hx + Math.cos(ang) * mouthDX - Math.sin(ang) * mouthDY,
      hy + Math.sin(ang) * mouthDX + Math.cos(ang) * mouthDY, ang, flipY);
    return true;
  }
  function drawWithStatus(ctx, state, worldToScreenX) {
    if (!draw(ctx, state, worldToScreenX)) return false;
    var sx = worldToScreenX ? worldToScreenX(state.headX) : state.headX;
    var hy = state.headY, remain = Math.max(0, finite(state.timer, 0));
    ctx.save(); ctx.globalAlpha = 0.90;
    ctx.fillStyle = 'rgba(16,21,33,0.70)';
    ctx.fillRect(sx - 72, hy - 55, 144, 24);
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.fillText('蛇形 '+remain.toFixed(1)+'s · 点击随机转向', sx, hy-43);
    ctx.restore();
    return true;
  }
  return { CONFIG: CONFIG, start: start, changeDirection: changeDirection,
    step: step, bones: bones, makeSampler: makeSampler, draw: draw,
    drawWithStatus: drawWithStatus,
    _internals: { angleWrap:angleWrap, clamp:clamp, solveAffine:solveAffine } };
});
