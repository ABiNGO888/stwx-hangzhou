#!/usr/bin/env node
/* ============================================================================
 * 超级舌阿蜥 · 杭州线下版 —— 发布构建 / 门禁  [A1 2026-11-12]
 *
 *   node _build_release.js            构建：内联占位图 + 按文件内容重写全部 ?v
 *   node _build_release.js --check    只读门禁：不写任何文件，任一校验失败 exit 1
 *   node _build_release.js --root DIR 指定发布目录（默认 = 本脚本所在目录）
 *
 * 为什么要有这个脚本（2026-11-12 现场事故复盘）：
 *   旧流程靠人手工递增 ?v=N，再 bump sw.js 的 CACHE 名来「让新版本生效」。
 *   bump CACHE 会整锅清掉现场几天的缓存 → 190MB 视频从零重下 → 待机视频没了、
 *   进游戏卡死；漏改 ?v 又会永远拿旧 JS。两件事都靠人记，必然复发。
 *   现在：CACHE 名永久固定，所有资源 URL 带「内容哈希」。内容变 → URL 必变 →
 *   SW 精确匹配自然不命中旧条目 → 回源拿新版；内容没变 → URL 不变 → 缓存长期复用。
 *   人工环节只剩「跑一次脚本」，且 --check 会把漏跑/漏改全部挡在发布之前。
 *
 * 覆盖资源：index.html 中所有带版本号的 .js / .mp4，以及关键无版本脚本 wx-shim.js。
 *   （图片/音频由 SW PRECACHE 清单管理，有意不纳入，避免精确匹配失配引起无谓回源。）
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const argv = process.argv.slice(2);
const CHECK = argv.indexOf('--check') >= 0;
const ri = argv.indexOf('--root');
const ROOT = ri >= 0 && argv[ri + 1] ? path.resolve(argv[ri + 1]) : __dirname;

const HTML = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const POSTER = path.join(ROOT, 'assets', 'idle-poster.jpg');
const MANIFEST = path.join(ROOT, '_release_manifest.json');
const HASH_LEN = 10;

// 额外纳入哈希、但当前没有 ?v= 的关键脚本（幂等：第一次加，之后由通用替换维护）
const EXTRA_VERSIONED = ['wx-shim.js'];

const errs = [];
const notes = [];
function fail(msg) { errs.push(msg); }
function ok(msg) { notes.push(msg); }
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
function hashOf(rel) {
  const fp = path.join(ROOT, decodeURIComponent(rel));
  if (!fs.existsSync(fp)) { fail('引用的文件不存在: ' + rel); return null; }
  return md5(fs.readFileSync(fp)).slice(0, HASH_LEN);
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 只匹配「路径 + ?v=...」，引号/&/空白终止；中文文件名同样适用
const RE_VER = /([^"'\s<>=]+\.(?:js|mp4))\?v=[^&"'\s]*/g;

function build(html) {
  let out = html;

  // ① 关键无版本脚本：补上 ?v=<hash>（只在 src="wx-shim.js" 精确形态下生效）
  EXTRA_VERSIONED.forEach(function (rel) {
    const h = hashOf(rel);
    if (!h) return;
    const re = new RegExp('(<script\\s+src=["\'])' + esc(rel) + '(["\'])', 'g');
    out = out.replace(re, function (m, a, b) { return a + rel + '?v=' + h + b; });
  });

  // ② 收集全部版本化路径 → 按文件内容重写 ?v
  const paths = {};
  let m;
  RE_VER.lastIndex = 0;
  while ((m = RE_VER.exec(out)) !== null) paths[m[1]] = true;
  const list = Object.keys(paths).sort();
  if (!list.length) fail('index.html 中没有发现任何版本化资源，脚本可能用错了目录');

  const assets = {};
  list.forEach(function (rel) {
    const h = hashOf(rel);
    if (!h) return;
    const re = new RegExp(esc(rel) + '\\?v=[^&"\'\\s]*', 'g');
    out = out.replace(re, rel + '?v=' + h);
    const fp = path.join(ROOT, decodeURIComponent(rel));
    assets[rel] = { hash: h, md5: md5(fs.readFileSync(fp)), size: fs.statSync(fp).size };
  });

  // ③ 占位图内联：data URI 随 HTML 一起到达，冷启动零请求、离线可用
  if (!fs.existsSync(POSTER)) {
    fail('缺少首屏占位图素材: assets/idle-poster.jpg');
  } else {
    const buf = fs.readFileSync(POSTER);
    const uri = 'data:image/jpeg;base64,' + buf.toString('base64');
    const re = /(<img\s+id=["']bgPoster["'][^>]*?\bsrc=["'])([^"']*)(["'])/i;
    if (!re.test(out)) fail('index.html 里找不到 #bgPoster 的 src');
    else out = out.replace(re, function (all, a, old, b) { return a + uri + b; });
    assets['assets/idle-poster.jpg'] = { hash: md5(buf).slice(0, HASH_LEN), md5: md5(buf), size: buf.length, inline: true };
  }

  return { html: out, assets: assets, list: list };
}

function check(html, sw) {
  // 1. 所有 ?v= 值 = 文件内容哈希（漏跑脚本 / 手工改号都会被抓到）
  const paths = {};
  let m;
  RE_VER.lastIndex = 0;
  while ((m = RE_VER.exec(html)) !== null) paths[m[1]] = true;
  const list = Object.keys(paths).sort();
  if (!list.length) fail('没有发现任何版本化资源');
  list.forEach(function (rel) {
    const want = hashOf(rel);
    if (!want) return;
    const re = new RegExp(esc(rel) + '\\?v=([^&"\'\\s]*)', 'g');
    let mm, seen = 0;
    while ((mm = re.exec(html)) !== null) {
      seen++;
      if (mm[1] !== want) fail('版本号与内容不符: ' + rel + '?v=' + mm[1] + '，应为 ' + want);
    }
    if (!seen) fail('资源没有版本号: ' + rel);
  });
  ok('版本化资源 ' + list.length + ' 项，?v 全部命中内容哈希');

  // 2. 占位图已内联且字节与素材一致
  const pm = /<img\s+id=["']bgPoster["'][^>]*?\bsrc=["']([^"']*)["']/i.exec(html);
  if (!pm) fail('找不到 #bgPoster');
  else if (pm[1].indexOf('data:image/jpeg;base64,') !== 0) fail('#bgPoster 未内联（请先跑构建）');
  else if (fs.existsSync(POSTER)) {
    const raw = Buffer.from(pm[1].slice('data:image/jpeg;base64,'.length), 'base64');
    if (raw.length !== fs.statSync(POSTER).size || md5(raw) !== md5(fs.readFileSync(POSTER)))
      fail('#bgPoster 内联内容与 assets/idle-poster.jpg 不一致');
    else ok('首屏占位图已内联（' + raw.length + ' 字节，随 HTML 到达）');
  }

  // 3. CACHE 名固定、SW 裸注册（历史事故的两条红线）
  if (!/var\s+CACHE\s*=\s*'stwx-hz-main'\s*;/.test(sw)) fail('sw.js 的 CACHE 名不是固定的 stwx-hz-main');
  else ok('CACHE 固定 stwx-hz-main（未 bump）');
  if (/register\(\s*['"]sw\.js\?/.test(html)) fail('发现带 query 的 SW 注册（永生劫持风险）');
  if (!/serviceWorker\.register\(\s*['"]sw\.js['"]\s*\)/.test(html)) fail('没有裸 sw.js 注册');
  else ok('SW 为裸 sw.js 注册');

  // 4. 语法门禁：外部 JS + index.html 内联脚本块（含新增的占位图淡出器）
  ['sw.js', 'web-require.js', 'wx-shim.js', 'game.js', 'runtime-sources.js'].forEach(function (f) {
    const fp = path.join(ROOT, f);
    if (!fs.existsSync(fp)) { fail('关键脚本缺失: ' + f); return; }
    try { new vm.Script(fs.readFileSync(fp, 'utf8'), { filename: f }); }
    catch (e) { fail('语法错误 ' + f + ': ' + e.message); }
  });
  // 先剥离 HTML 注释：注释里出现 <script> 字面量（换片规则等说明文字）会被
  // 正则误当成真标签，把整段 HTML 当 JS 编译 → 假报错。
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
  const reBlock = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let bm, n = 0;
  while ((bm = reBlock.exec(stripped)) !== null) {
    n++;
    try { new vm.Script(bm[1], { filename: 'index.html#inline-' + n }); }
    catch (e) { fail('index.html 内联脚本 #' + n + ' 语法错误: ' + e.message); }
  }
  if (n) ok('脚本语法通过（外部 5 个 + 内联 ' + n + ' 块）');
}

// ---------------------------------------------------------------------------
if (!fs.existsSync(HTML) || !fs.existsSync(SW)) {
  console.error('[build] 目录里没有 index.html / sw.js: ' + ROOT);
  process.exit(1);
}
const original = fs.readFileSync(HTML, 'utf8');
const sw = fs.readFileSync(SW, 'utf8');
// --check 必须校验磁盘上的真实文件，绝不能校验「假如构建之后」的内容
const res = CHECK ? { html: original, assets: {}, list: [] } : build(original);

if (!CHECK) {
  if (res.html !== original) {
    fs.writeFileSync(HTML, res.html, 'utf8');
    ok('已写入 index.html（' + original.length + ' → ' + res.html.length + ' 字符）');
  } else ok('index.html 已是最新（幂等，无改动）');
  const manifest = {
    builtAt: new Date().toISOString(),
    cache: 'stwx-hz-main',
    note: 'CACHE 名永久固定；资源 ?v 为内容 md5 前 ' + HASH_LEN + ' 位。发布前跑 --check。',
    assets: res.assets
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  ok('已写 _release_manifest.json（' + Object.keys(res.assets).length + ' 项）');
}

check(res.html, sw);

notes.forEach(function (s) { console.log('  [ok] ' + s); });
errs.forEach(function (s) { console.error('  [FAIL] ' + s); });
if (errs.length) {
  console.error('\n[build] ' + (CHECK ? '门禁未通过' : '构建后自检未通过') + '：' + errs.length + ' 项');
  process.exit(1);
}
console.log('\n[build] ' + (CHECK ? 'CHECK PASS' : 'BUILD PASS') + ' — ' + ROOT);
