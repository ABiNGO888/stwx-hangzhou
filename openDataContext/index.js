'use strict';

var canvas = null;
try {
  if (typeof sharedCanvas !== 'undefined') canvas = sharedCanvas;
  else if (typeof wx !== 'undefined' && wx.getSharedCanvas) canvas = wx.getSharedCanvas();
} catch (ignoreCanvas) {}

var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
var WIDTH = 690;
var HEIGHT = 1100;
var ROW_H = 108;
var LIST_TOP = 330;
var LIST_BOTTOM = 1018;
var visible = false;
var activeTab = 'friend';
var currentUid = '';
var currentCity = '';
var selfInfo = null;
var rows = [];
var localRows = [];
var testRows = [];
var testMode = false;
var scrollY = 0;
var loading = false;
var statusText = '';
var touchState = { active: false, startY: 0, lastY: 0, scrollStart: 0, moved: false };

function number(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function text(value, fallback) {
  var out = String(value === undefined || value === null ? (fallback || '') : value);
  return out;
}
function roundRect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function setCanvasSize(width, height) {
  if (!canvas) return;
  width = Math.max(1, Math.round(number(width, WIDTH)));
  height = Math.max(1, Math.round(number(height, HEIGHT)));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  WIDTH = width;
  HEIGHT = height;
  LIST_TOP = Math.round(HEIGHT * 0.30);
  LIST_BOTTOM = HEIGHT - 82;
  ctx = canvas.getContext('2d');
}
function getKV(item, key) {
  var list = item && Array.isArray(item.KVDataList) ? item.KVDataList : [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].key === key) return text(list[i].value, '');
  }
  return '';
}
function normalizeRow(item, index, source) {
  item = item || {};
  var uid = text(item.uid || item.playerId || getKV(item, 'uid'), source + '_' + index);
  var score = Math.max(0, Math.floor(number(item.score !== undefined ? item.score : getKV(item, 'score'), 0)));
  return {
    nickname: text(item.nickname || item.nickName, '好友玩家').slice(0, 16),
    avatarUrl: text(item.avatarUrl, '').slice(0, 1024),
    score: score,
    city: text(item.city || getKV(item, 'city'), '').slice(0, 24),
    uid: uid,
    isCurrent: !!item.isCurrent || (!!currentUid && uid === currentUid),
    source: source
  };
}
function normalizeList(list, source) {
  list = Array.isArray(list) ? list : [];
  var out = [];
  for (var i = 0; i < list.length && i < 100; i++) out.push(normalizeRow(list[i], i, source));
  return out;
}
function mergeRows(primary, secondary) {
  var merged = [];
  var seen = Object.create(null);
  function add(row) {
    row = row || {};
    var key = row.uid || ('name:' + row.nickname + ':' + row.score);
    if (seen[key]) {
      if (row.isCurrent) seen[key].isCurrent = true;
      if (!seen[key].city && row.city) seen[key].city = row.city;
      if (row.score > seen[key].score) seen[key].score = row.score;
      return;
    }
    seen[key] = row;
    merged.push(row);
  }
  var i;
  for (i = 0; i < primary.length; i++) add(primary[i]);
  for (i = 0; i < secondary.length; i++) add(secondary[i]);
  merged.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.nickname < b.nickname ? -1 : 1;
  });
  return merged.slice(0, 50);
}
function filteredRows() {
  var out = rows.slice();
  if (activeTab === 'city') {
    if (!currentCity) return [];
    out = out.filter(function(row) { return text(row.city, '') === currentCity; });
  }
  return out;
}
function maxScroll() {
  return Math.max(0, filteredRows().length * ROW_H - (LIST_BOTTOM - LIST_TOP));
}
function clampScroll() { scrollY = clamp(scrollY, 0, maxScroll()); }
function clear() {
  if (!ctx) return;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
}
function buildSubtitle() {
  if (activeTab === 'city') return currentCity ? (currentCity + ' · 同城冒险家') : '暂无同城数据';
  return '微信好友最高分排行';
}
function findCurrentRow(list) {
  for (var i = 0; i < list.length; i++) if (list[i] && list[i].isCurrent) return { row: list[i], rank: i + 1 };
  return null;
}
function drawAvatar(row, x, y, r) {
  var name = text(row.nickname, '友');
  var initial = name ? name.slice(0, 1) : '友';
  var grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  if (row.isCurrent) {
    grad.addColorStop(0, '#ffe18d');
    grad.addColorStop(1, '#ffb54d');
  } else {
    grad.addColorStop(0, '#8bd8ff');
    grad.addColorStop(1, '#5367ff');
  }
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = row.isCurrent ? 'rgba(255,248,209,.98)' : 'rgba(255,255,255,.28)';
  ctx.lineWidth = row.isCurrent ? 4 : 2; ctx.stroke();
  ctx.fillStyle = row.isCurrent ? '#3b2412' : '#ffffff';
  ctx.font = 'bold ' + Math.round(r * 0.95) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(initial, x, y + 1);
  ctx.restore();
}
function drawTab(id, label, x, y, w, h) {
  var selected = activeTab === id;
  roundRect(ctx, x, y, w, h, 24);
  if (selected) {
    var grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#72d9ff');
    grad.addColorStop(1, '#8df3bf');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.08)';
  }
  ctx.fill();
  ctx.strokeStyle = selected ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.15)';
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();
  ctx.fillStyle = selected ? '#12344a' : 'rgba(255,255,255,.76)';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w * 0.5, y + h * 0.5 + 1);
}
function drawMedal(rank, x, y) {
  if (rank > 3) return false;
  var colors = [null, '#ffd95c', '#dce6f2', '#ffb889'];
  var glow = [null, 'rgba(255,217,92,.32)', 'rgba(220,230,242,.28)', 'rgba(255,184,137,.28)'];
  ctx.save();
  ctx.shadowColor = glow[rank];
  ctx.shadowBlur = 18;
  ctx.fillStyle = colors[rank];
  ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = rank === 2 ? '#24344d' : '#3a2307';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(rank), x, y + 1);
  ctx.restore();
  return true;
}
function drawEmpty(message, detail) {
  ctx.save();
  roundRect(ctx, 52, LIST_TOP + 40, WIDTH - 104, 210, 30);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(message, WIDTH * 0.5, LIST_TOP + 126);
  ctx.fillStyle = 'rgba(255,255,255,.54)';
  ctx.font = '20px sans-serif';
  ctx.fillText(detail, WIDTH * 0.5, LIST_TOP + 168);
  ctx.restore();
}
function drawHeader(list) {
  var bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#162949');
  bg.addColorStop(0.55, '#101a31');
  bg.addColorStop(1, '#0a1020');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (var i = 0; i < 18; i++) {
    var sx = ((i * 97) % WIDTH) + 12;
    var sy = 34 + (i % 6) * 26;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,217,92,.20)' : 'rgba(139,216,255,.16)';
    ctx.beginPath(); ctx.arc(sx, sy, i % 2 ? 2.2 : 1.4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('排行榜', WIDTH * 0.5, 66);
  ctx.fillStyle = 'rgba(255,255,255,.56)';
  ctx.font = '20px sans-serif';
  ctx.fillText(buildSubtitle(), WIDTH * 0.5, 98);

  drawTab('friend', '好友榜', 72, 126, 250, 66);
  drawTab('city', '同城榜', 368, 126, 250, 66);

  roundRect(ctx, 34, 214, WIDTH - 68, 88, 24);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  var currentInfo = findCurrentRow(list);
  var selfRow = currentInfo ? currentInfo.row : { nickname: '本机玩家', score: 0, city: currentCity, isCurrent: true };
  drawAvatar(selfRow, 84, 258, 28);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText((selfRow.nickname || '本机玩家') + (selfRow.isCurrent ? '（我）' : ''), 126, 248);
  ctx.fillStyle = 'rgba(255,255,255,.52)';
  ctx.font = '18px sans-serif';
  ctx.fillText(selfRow.city || (activeTab === 'city' ? '未知城市' : '等待同步云数据'), 126, 276);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#6ef0a7';
  ctx.font = 'bold 34px monospace';
  ctx.fillText(String(Math.max(0, Number(selfRow.score) || 0)), WIDTH - 56, 256);
  ctx.fillStyle = currentInfo ? '#ffd95c' : 'rgba(255,255,255,.48)';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(currentInfo ? ('当前第 ' + currentInfo.rank + ' 名') : '尚未入榜', WIDTH - 56, 282);

  ctx.fillStyle = 'rgba(255,255,255,.10)';
  roundRect(ctx, 34, LIST_TOP - 38, WIDTH - 68, 28, 14); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.60)';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('名次', 56, LIST_TOP - 18);
  ctx.fillText('玩家信息', 126, LIST_TOP - 18);
  ctx.textAlign = 'right';
  ctx.fillText('分数', WIDTH - 56, LIST_TOP - 18);
}
function drawList(list) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(26, LIST_TOP, WIDTH - 52, LIST_BOTTOM - LIST_TOP);
  ctx.clip();

  for (var i = 0; i < list.length; i++) {
    var row = list[i];
    var top = LIST_TOP + i * ROW_H - scrollY;
    if (top + ROW_H < LIST_TOP || top > LIST_BOTTOM) continue;

    var cardX = 34;
    var cardY = top + 7;
    var cardW = WIDTH - 68;
    var cardH = ROW_H - 14;
    roundRect(ctx, cardX, cardY, cardW, cardH, 22);
    if (row.isCurrent) {
      var currentGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      currentGrad.addColorStop(0, 'rgba(255,217,92,.22)');
      currentGrad.addColorStop(1, 'rgba(139,216,255,.18)');
      ctx.fillStyle = currentGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,217,92,.75)';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,.060)' : 'rgba(255,255,255,.045)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (!drawMedal(i + 1, 68, top + ROW_H * 0.5)) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.66)';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(String(i + 1), 68, top + ROW_H * 0.5 + 1);
    }

    drawAvatar(row, 142, top + ROW_H * 0.5, 31);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    var displayName = row.nickname || '好友玩家';
    if (displayName.length > 12) displayName = displayName.slice(0, 11) + '…';
    ctx.fillText(displayName + (row.isCurrent ? '（我）' : ''), 188, top + 45);

    ctx.fillStyle = 'rgba(255,255,255,.52)';
    ctx.font = '18px sans-serif';
    ctx.fillText(row.city || (activeTab === 'city' ? '未知城市' : '微信好友'), 188, top + 74);

    var scorePillW = 132;
    roundRect(ctx, WIDTH - 170, top + 24, scorePillW, 42, 21);
    ctx.fillStyle = row.isCurrent ? 'rgba(255,217,92,.18)' : 'rgba(139,216,255,.12)';
    ctx.fill();
    ctx.strokeStyle = row.isCurrent ? 'rgba(255,217,92,.46)' : 'rgba(139,216,255,.30)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = i < 3 ? '#ffd95c' : '#8fe7ff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(String(row.score), WIDTH - 104, top + ROW_H * 0.5 + 2);
  }
  ctx.restore();

  if (maxScroll() > 0) {
    var trackH = LIST_BOTTOM - LIST_TOP;
    var thumbH = Math.max(54, trackH * trackH / (trackH + maxScroll()));
    var thumbY = LIST_TOP + (trackH - thumbH) * (scrollY / maxScroll());
    roundRect(ctx, WIDTH - 16, LIST_TOP, 7, trackH, 4);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill();
    roundRect(ctx, WIDTH - 16, thumbY, 7, thumbH, 4);
    ctx.fillStyle = 'rgba(139,216,255,.58)'; ctx.fill();
  }
}
function draw() {
  if (!ctx || !visible) { clear(); return; }
  clear();

  var list = filteredRows();
  clampScroll();
  drawHeader(list);

  if (loading) {
    drawEmpty('正在读取排行榜', '请稍候');
  } else if (!list.length) {
    if (activeTab === 'city' && !currentCity) drawEmpty('微信未提供所在城市', '暂无同城排行数据');
    else if (activeTab === 'city') drawEmpty('同城暂无成绩', '完成一局后会自动提交最高分');
    else drawEmpty('好友榜暂无成绩', statusText || '开放数据异常时仍可正常游戏');
  } else {
    drawList(list);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.34)';
  ctx.font = '16px sans-serif';
  ctx.fillText(statusText || '左右切换榜单，上下拖动查看完整排行', WIDTH * 0.5, HEIGHT - 24);
}
function applyRows(friendRows, fallbackText) {
  var merged = mergeRows(normalizeList(friendRows, 'friend'), normalizeList(localRows, 'local'));
  // 注入/更新玩家本人行：城市由微信用户资料自动提供，确保同城榜一定有“我”。
  var selfRow = null;
  for (var i = 0; i < merged.length; i++) {
    if (merged[i] && merged[i].isCurrent) { selfRow = merged[i]; break; }
  }
  if (!selfRow && selfInfo && selfInfo.nickname) {
    selfRow = {
      nickname: selfInfo.nickname,
      avatarUrl: selfInfo.avatarUrl,
      score: selfInfo.score,
      city: selfInfo.city,
      uid: currentUid,
      isCurrent: true,
      source: 'self'
    };
    merged.push(selfRow);
  }
  if (selfRow && selfInfo && selfInfo.city) selfRow.city = selfInfo.city;
  rows = merged;
  // 城市优先取玩家本人（来自微信用户资料），其次取好友数据中带 city 的本人行。
  if (selfInfo && selfInfo.city) {
    currentCity = selfInfo.city;
  } else {
    for (var ri = 0; ri < rows.length; ri++) {
      if (rows[ri] && rows[ri].isCurrent && rows[ri].city) { currentCity = rows[ri].city; break; }
    }
  }
  statusText = fallbackText || '';
  loading = false;
  clampScroll();
  draw();
}
function loadFriendRows() {
  loading = true;
  statusText = '';
  draw();
  if (testMode && testRows.length) {
    applyRows(testRows, '开发者工具测试数据');
    return;
  }
  if (typeof wx === 'undefined' || !wx.getFriendCloudStorage) {
    applyRows([], '开放数据接口不可用，已使用本机回退数据');
    return;
  }
  try {
    wx.getFriendCloudStorage({
      keyList: ['score', 'uid', 'city'],
      success: function(res) { applyRows(res && res.data, '好友最高成绩'); },
      fail: function() { applyRows([], '好友数据读取失败，已保留排行榜界面'); }
    });
  } catch (ignoreFriendStorage) {
    applyRows([], '好友数据读取失败，已保留排行榜界面');
  }
}
function switchTab(tab) {
  tab = tab === 'city' ? 'city' : 'friend';
  if (activeTab === tab) return;
  activeTab = tab;
  scrollY = 0;
  draw();
}
function onTouch(message) {
  var phase = text(message.phase, '');
  var x = number(message.x, 0);
  var y = number(message.y, 0);
  if (phase === 'start') {
    if (y >= 126 && y <= 192) {
      if (x >= 72 && x <= 322) { switchTab('friend'); return; }
      if (x >= 368 && x <= 618) { switchTab('city'); return; }
    }
    touchState = { active: true, startY: y, lastY: y, scrollStart: scrollY, moved: false };
  } else if (phase === 'move' && touchState.active) {
    var dy = y - touchState.startY;
    if (Math.abs(y - touchState.lastY) > 1) touchState.moved = true;
    touchState.lastY = y;
    scrollY = clamp(touchState.scrollStart - dy, 0, maxScroll());
    draw();
  } else if (phase === 'end' || phase === 'cancel') {
    touchState.active = false;
  }
}
function onMessage(message) {
  message = message || {};
  var type = text(message.type, '');
  if (type === 'resize') {
    setCanvasSize(message.canvasWidth, message.canvasHeight);
    draw();
  } else if (type === 'show') {
    visible = true;
    activeTab = message.tab === 'city' ? 'city' : 'friend';
    currentUid = text(message.uid, '');
    testMode = !!message.testMode;
    console.log('[排行榜-开放域] show 消息:', activeTab, 'uid=', currentUid, 'testMode=', testMode, 'self.city=', message.self && message.self.city);
    testRows = Array.isArray(message.testRows) ? message.testRows.slice(0, 50) : [];
    selfInfo = (message.self && message.self.nickname) ? {
      nickname: text(message.self.nickname, '微信玩家').slice(0, 20),
      avatarUrl: text(message.self.avatarUrl, '').slice(0, 1024),
      score: Math.max(0, Math.floor(number(message.self.score, 0))),
      city: text(message.self.city, '').slice(0, 24)
    } : null;
    // 开发者工具预览模式：玩家无真实城市时，用测试数据里的城市让同城榜可演示（“我”也会出现在同城榜）。
    if (testMode && (!selfInfo || !selfInfo.city)) {
      var demoCity = '';
      for (var ti = 0; ti < testRows.length; ti++) {
        if (testRows[ti] && testRows[ti].city) { demoCity = testRows[ti].city; break; }
      }
      if (demoCity) {
        if (!selfInfo) selfInfo = { nickname: '本机玩家', avatarUrl: '', score: 0, city: demoCity };
        else selfInfo.city = demoCity;
      }
    }
    currentCity = (selfInfo && selfInfo.city) ? selfInfo.city : '';
    localRows = Array.isArray(message.localRows) ? message.localRows.slice(0, 50) : [];
    scrollY = 0;
    loadFriendRows();
  } else if (type === 'hide') {
    visible = false;
    clear();
  } else if (type === 'refresh') {
    if (visible) loadFriendRows();
  } else if (type === 'testData') {
    testMode = !!message.enabled;
    testRows = Array.isArray(message.rows) ? message.rows.slice(0, 50) : [];
    currentUid = text(message.uid, currentUid);
    if (visible) loadFriendRows();
  } else if (type === 'testScore') {
    var score = Math.max(0, Math.floor(number(message.score, 0)));
    var found = false;
    for (var i = 0; i < localRows.length; i++) {
      if (localRows[i] && (localRows[i].isCurrent || localRows[i].uid === currentUid)) {
        localRows[i].score = Math.max(score, number(localRows[i].score, 0));
        found = true;
      }
    }
    if (!found) localRows.push({ nickname: '本机玩家', score: score, uid: currentUid, city: '', isCurrent: true });
    if (visible) loadFriendRows();
  } else if (type === 'touch') {
    onTouch(message);
  }
}

setCanvasSize(WIDTH, HEIGHT);
clear();
if (typeof wx !== 'undefined' && wx.onMessage) {
  console.log('[排行榜-开放域] 注册 onMessage');
  wx.onMessage(onMessage);
} else {
  console.error('[排行榜-开放域] wx.onMessage 不可用');
}
