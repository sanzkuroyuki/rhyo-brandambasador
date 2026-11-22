/*
 * play.js: item halaman yang bisa diseret, dilempar, dan dihancurkan.
 *
 * Aturan anti-glitch (kartu ganda):
 *  1. Elemen asli TIDAK pernah dikloning, dipindah di DOM, atau dibuat ulang.
 *     Pecah = elemen disembunyikan (visibility) di slot yang sama, perbaiki = ditampilkan lagi.
 *  2. Setiap elemen punya state machine: ok -> cracked -> broken -> fixing -> ok.
 *     Pecah/perbaiki hanya jalan dari state yang sah, jadi dipukul berkali-kali tidak menumpuk.
 *  3. Serpihan memakai pool tetap (jumlah elemen efek tidak pernah bertambah).
 *  4. Watchdog memaksa elemen yang macet kembali normal.
 */
(function () {
  'use strict';
  var A = window.RhyoAudio || { play: function () {} };
  var SEL = '.btn,.c,.card,.pill,.rb,.seal,.chips li,.tag,.dock a,.bubble,.qa,.brand,.video,.lnk,.lk,.soc a';
  var G = 2600, REST = 0.46, HOME_DELAY = 9000, FIX_MS = 430;
  var reg = new Map();
  var listeners = { 'break': [], crack: [], fixed: [], move: [], rest: [] };
  var cur = null, suppressUntil = 0, lastType = 'mouse';
  var flying = new Set();
  var raf = 0, last = 0;

  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, a, b, c, d, e) {
    var l = listeners[evt] || [], hit = false;
    for (var i = 0; i < l.length; i++) { try { if (l[i](a, b, c, d, e)) hit = true; } catch (er) { /* abaikan */ } }
    return hit;
  }
  var now = function () { return performance.now(); };
  var hammer = function () { return document.body.classList.contains('hammer'); };

  /* ================= state per elemen ================= */
  function S(el) {
    var s = reg.get(el);
    if (!s) {
      s = { el: el, state: 'ok', hp: 2, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, mode: 'rest',
            homeT: 0, homeEnd: 0, fixT: 0, lastHit: 0, brokenAt: 0, crackedAt: 0, fixStart: 0, flyStart: 0, crack: null };
      reg.set(el, s);
    }
    return s;
  }
  function apply(s) {
    s.el.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px) rotate(' + s.r.toFixed(1) + 'deg)';
  }
  function resetPose(s) {
    s.x = s.y = s.r = s.vx = s.vy = s.vr = 0;
    s.el.style.transform = ''; s.el.style.transition = '';
  }

  /* ================= efek serpihan (pool tetap) ================= */
  var fxLayer = document.getElementById('fx');
  if (!fxLayer) { fxLayer = document.createElement('div'); fxLayer.id = 'fx'; document.body.appendChild(fxLayer); }
  var NS = 'http://www.w3.org/2000/svg';
  var shards = [], texts = [];
  (function build() {
    var i, d, svg, poly;
    for (i = 0; i < 64; i++) {
      d = document.createElement('div'); d.className = 'shard';
      svg = document.createElementNS(NS, 'svg'); poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('stroke', '#1b2a8f'); poly.setAttribute('stroke-width', '3'); poly.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(poly); d.appendChild(svg); fxLayer.appendChild(d);
      shards.push({ el: d, svg: svg, poly: poly, use: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, life: 0, max: 1, g: 1 });
    }
    for (i = 0; i < 8; i++) {
      d = document.createElement('div'); d.className = 'fxt'; fxLayer.appendChild(d);
      texts.push({ el: d, use: false, x: 0, y: 0, life: 0 });
    }
  })();
  function take() { for (var i = 0; i < shards.length; i++) if (!shards[i].use) return shards[i]; return null; }
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  function shape(kind, w, h) {
    var p = [], i;
    if (kind === 'star') {
      for (i = 0; i < 8; i++) { var a = i * Math.PI / 4 - Math.PI / 2, rr = (i % 2 ? .38 : 1) * w / 2; p.push((w / 2 + Math.cos(a) * rr).toFixed(1) + ',' + (h / 2 + Math.sin(a) * rr).toFixed(1)); }
    } else if (kind === 'dot') {
      for (i = 0; i < 8; i++) { var b = i * Math.PI / 4; p.push((w / 2 + Math.cos(b) * w / 2).toFixed(1) + ',' + (h / 2 + Math.sin(b) * h / 2).toFixed(1)); }
    } else if (kind === 'quad') {
      p = [rnd(0, w * .3) + ',' + rnd(0, h * .3), rnd(w * .7, w) + ',' + rnd(0, h * .3), rnd(w * .7, w) + ',' + rnd(h * .7, h), rnd(0, w * .3) + ',' + rnd(h * .7, h)];
    } else {
      p = [rnd(0, w) + ',' + rnd(0, h * .4), rnd(0, w) + ',' + rnd(h * .6, h), rnd(w * .4, w) + ',' + rnd(0, h)];
    }
    return p.join(' ');
  }
  function spawn(kind, x, y, w, h, vx, vy, fill, stroke, life, g) {
    var s = take(); if (!s) return null;
    s.use = true; s.x = x - w / 2; s.y = y - h / 2; s.vx = vx; s.vy = vy; s.r = rnd(0, 360); s.vr = rnd(-540, 540);
    s.life = s.max = life; s.g = g == null ? 1 : g;
    s.el.style.width = w + 'px'; s.el.style.height = h + 'px';
    s.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.poly.setAttribute('points', shape(kind, w, h));
    s.poly.setAttribute('fill', fill); s.poly.setAttribute('stroke', stroke || '#1b2a8f');
    s.poly.setAttribute('stroke-width', kind === 'dot' ? '0' : '3');
    s.el.style.display = 'block'; s.el.style.opacity = '1';
    s.el.style.transform = 'translate3d(' + s.x + 'px,' + s.y + 'px,0) rotate(' + s.r + 'deg)';
    kick();
    return s;
  }
  function colorOf(el) {
    var n = el, c;
    for (var i = 0; i < 4 && n && n.nodeType === 1; i++, n = n.parentElement) {
      c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c)) return c;
    }
    return '#ffffff';
  }
  var fx = {
    shards: function (r, color, n) {
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2, i, cols = [color, color, '#ffffff', '#ff5fa8', '#ffd23f'];
      n = n || Math.max(8, Math.min(16, Math.round((r.width * r.height) / 5500)));
      for (i = 0; i < n; i++) {
        var px = rnd(r.left, r.right), py = rnd(r.top, r.bottom), ang = Math.atan2(py - cy, px - cx), sp = rnd(260, 720), sz = rnd(10, Math.min(30, Math.max(14, r.height * .5)));
        spawn(i % 3 ? 'tri' : 'quad', px, py, sz, sz, Math.cos(ang) * sp, Math.sin(ang) * sp - rnd(150, 420), i < 4 ? color : cols[i % cols.length], '#1b2a8f', rnd(.9, 1.4), 1);
      }
    },
    stars: function (x, y, n, big) {
      var cols = ['#ffd23f', '#ff5fa8', '#ffffff', '#5be3ff'];
      for (var i = 0; i < n; i++) {
        var a = rnd(0, Math.PI * 2), sp = rnd(140, big ? 620 : 380), sz = rnd(10, big ? 22 : 16);
        spawn('star', x, y, sz, sz, Math.cos(a) * sp, Math.sin(a) * sp - 120, cols[i % cols.length], '#1b2a8f', rnd(.5, .9), .25);
      }
    },
    dust: function (x, y, n) {
      for (var i = 0; i < n; i++) {
        var dir = i % 2 ? 1 : -1, sz = rnd(10, 20);
        spawn('dot', x + dir * rnd(0, 20), y, sz, sz, dir * rnd(80, 360), rnd(-160, -20), 'rgba(255,255,255,.9)', 'none', rnd(.35, .6), .15);
      }
    },
    text: function (x, y, str, color) {
      for (var i = 0; i < texts.length; i++) if (!texts[i].use) {
        var t = texts[i]; t.use = true; t.x = x; t.y = y; t.life = .75;
        t.el.textContent = str; t.el.style.color = color || '#fff'; t.el.style.display = 'block';
        t.el.style.opacity = '1';
        t.el.style.transform = 'translate3d(' + (x - 30) + 'px,' + y + 'px,0) rotate(' + rnd(-10, 10) + 'deg)';
        t.rot = rnd(-10, 10); kick(); return;
      }
    },
    shake: function () {
      var m = document.querySelector('main'); if (!m) return;
      m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
      setTimeout(function () { m.classList.remove('shake'); }, 420);
    }
  };
  function stepFx(dt) {
    var H = innerHeight, i, s, t, any = false;
    for (i = 0; i < shards.length; i++) {
      s = shards[i]; if (!s.use) continue;
      s.vy += 1900 * s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt; s.life -= dt;
      if (s.y > H - 16 && s.vy > 0) { s.y = H - 16; s.vy *= -.35; s.vx *= .7; s.vr *= .6; }
      if (s.life <= 0) { s.use = false; s.el.style.display = 'none'; continue; }
      any = true;
      s.el.style.opacity = Math.min(1, s.life / .3).toFixed(2);
      s.el.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px,0) rotate(' + s.r.toFixed(0) + 'deg)';
    }
    for (i = 0; i < texts.length; i++) {
      t = texts[i]; if (!t.use) continue;
      t.life -= dt; t.y -= 70 * dt;
      if (t.life <= 0) { t.use = false; t.el.style.display = 'none'; continue; }
      any = true;
      t.el.style.opacity = Math.min(1, t.life / .25).toFixed(2);
      t.el.style.transform = 'translate3d(' + (t.x - 30) + 'px,' + t.y.toFixed(1) + 'px,0) rotate(' + t.rot + 'deg) scale(' + (1 + (.75 - t.life) * .3).toFixed(2) + ')';
    }
    return any;
  }

  /* ================= loop utama ================= */
  function kick() { if (!raf) { last = now(); raf = requestAnimationFrame(loop); } }
  function loop(t) {
    raf = 0;
    var dt = Math.min(0.033, Math.max(0.001, (t - last) / 1000)); last = t;
    flying.forEach(function (s) { stepFly(s, dt); });
    if (cur && cur.started) relaxDrag(cur.s, dt);
    var fxOn = stepFx(dt);
    if (flying.size || fxOn || (cur && cur.started)) raf = requestAnimationFrame(loop);
  }
  function relaxDrag(s, dt) {
    if (s.mode !== 'drag') return;
    s.r *= Math.max(0, 1 - 5 * dt); apply(s);
  }

  function stepFly(s, dt) {
    var el = s.el, r = el.getBoundingClientRect();
    if (!r.width) { flying.delete(s); s.mode = 'rest'; return; }
    var hw = el.offsetWidth / 2, hh = el.offsetHeight / 2;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2, bx = cx - s.x, by = cy - s.y;
    var W = innerWidth, H = innerHeight - 2, hit = 0, floor = false;
    s.vy += G * dt;
    var nx = cx + s.vx * dt, ny = cy + s.vy * dt;
    if (nx - hw < 0) { nx = hw; hit = Math.max(hit, Math.abs(s.vx)); s.vx = Math.abs(s.vx) * REST; s.vr *= -.6; }
    else if (nx + hw > W) { nx = W - hw; hit = Math.max(hit, Math.abs(s.vx)); s.vx = -Math.abs(s.vx) * REST; s.vr *= -.6; }
    if (ny - hh < 0) { ny = hh; hit = Math.max(hit, Math.abs(s.vy)); s.vy = Math.abs(s.vy) * REST; }
    else if (ny + hh > H) {
      ny = H - hh; floor = true;
      var pre = Math.abs(s.vy);
      if (pre < 260) { s.vy = 0; } else { hit = Math.max(hit, pre); s.vy = -pre * REST; s.vr *= .6; }
      var f = Math.min(Math.abs(s.vx), 1500 * dt); s.vx -= Math.sign(s.vx) * f;
    }
    s.x = nx - bx; s.y = ny - by;
    s.r += s.vr * dt; s.vr *= Math.max(0, 1 - .6 * dt);
    if (floor) s.r += (0 - s.r) * Math.min(1, dt * 9);
    apply(s);
    /* tabrakan dengan maskot */
    if (emit('move', nx - hw, ny - hh, hw * 2, hh * 2, { vx: s.vx, vy: s.vy, s: s })) { s.vx *= -.35; s.vy *= .5; }
    if (hit > 380) impact(s, hit);
    if (s.state === 'broken' || s.state === 'fixing') { flying.delete(s); return; }
    if (floor && s.vy === 0 && Math.abs(s.vx) < 30 && Math.abs(s.r) < 1.5) settle(s);
    else if (now() - s.flyStart > 9000) settle(s);
  }
  function settle(s) {
    flying.delete(s);
    s.vx = s.vy = s.vr = 0; s.mode = 'rest';
    s.el.classList.remove('is-fly'); s.el.classList.add('is-home');
    scheduleHome(s);
    emit('rest', s);                 /* maskot akan datang memungut item yang sudah jatuh */
  }

  /* ================= kerusakan ================= */
  function impact(s, speed) {
    var t = now();
    if (t - s.lastHit < 140) return;
    s.lastHit = t;
    if (s.state === 'broken' || s.state === 'fixing') return;
    if (speed >= 1500) shatter(s);
    else if (speed >= 950) { s.hp--; if (s.hp <= 0) shatter(s); else crack(s); }
    else A.play('bounce');
  }
  function ensureCrack(s) {
    if (s.crack) return;
    var svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('class', 'crack'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    var x = rnd(30, 70), y = 0, d = 'M' + x.toFixed(0) + ' 0';
    for (var i = 0; i < 6; i++) { y += rnd(12, 22); x += rnd(-16, 16); d += ' L' + Math.max(4, Math.min(96, x)).toFixed(0) + ' ' + Math.min(100, y).toFixed(0); }
    d += ' M' + (x).toFixed(0) + ' ' + (y * .5).toFixed(0) + ' L' + (x + rnd(14, 30)).toFixed(0) + ' ' + (y * .5 + rnd(8, 18)).toFixed(0);
    path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#1b2a8f');
    path.setAttribute('stroke-width', '3'); path.setAttribute('vector-effect', 'non-scaling-stroke'); path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path); s.el.appendChild(svg); s.crack = svg;
  }
  function crack(s) {
    if (s.state !== 'ok') { if (s.state === 'cracked') { s.hp = 0; shatter(s); } return; }
    s.state = 'cracked'; s.crackedAt = now();
    ensureCrack(s);
    s.el.classList.add('is-cracked', 'is-hit');
    setTimeout(function () { s.el.classList.remove('is-hit'); }, 300);
    A.play('crack');
    var r = s.el.getBoundingClientRect();
    fx.stars(r.left + r.width / 2, r.top + r.height / 2, 5, false);
    fx.text(r.left + r.width / 2, r.top, 'KRAK!', '#ffd23f');
    emit('crack', s);
  }
  function shatter(s) {
    if (s.state === 'broken' || s.state === 'fixing') return false;
    var el = s.el, r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    flying.delete(s); clearTimeout(s.homeT); clearTimeout(s.homeEnd);
    s.mode = 'rest'; s.state = 'broken'; s.brokenAt = now(); s.vx = s.vy = s.vr = 0;
    el.classList.remove('is-drag', 'is-fly', 'is-home', 'is-cracked', 'is-hit');
    el.classList.add('is-broken');
    fx.shards(r, colorOf(el));
    fx.stars(r.left + r.width / 2, r.top + r.height / 2, 6, true);
    fx.text(r.left + r.width / 2, r.top - 6, 'PRANG!', '#ffffff');
    A.play('smash');
    if (r.width * r.height > 30000) fx.shake();
    emit('break', s);
    return true;
  }
  function heal(s) {
    if (s.state !== 'cracked') return false;
    s.state = 'ok'; s.hp = 2;
    s.el.classList.remove('is-cracked');
    var r = s.el.getBoundingClientRect();
    fx.stars(r.left + r.width / 2, r.top + r.height / 2, 4, false);
    A.play('zap');
    return true;
  }
  function repair(el, byMascot) {
    var s = reg.get(el); if (!s) return false;
    if (s.state === 'cracked') return heal(s);
    if (s.state !== 'broken') return false;
    s.state = 'fixing'; s.fixStart = now();
    clearTimeout(s.fixT); clearTimeout(s.homeT); clearTimeout(s.homeEnd);
    flying.delete(s); resetPose(s); s.mode = 'rest'; s.hp = 2;
    el.classList.remove('is-broken', 'is-cracked', 'is-fly', 'is-drag', 'is-home');
    el.classList.add('is-fixing');
    var r = el.getBoundingClientRect();
    fx.stars(r.left + r.width / 2, r.top + r.height / 2, 7, true);
    A.play('fix');
    s.fixT = setTimeout(function () { el.classList.remove('is-fixing'); s.state = 'ok'; }, FIX_MS);
    emit('fixed', s, !!byMascot);
    return true;
  }
  function hammerHit(s) {
    if (s.state === 'broken' || s.state === 'fixing' || s.mode === 'carried') return;
    var r = s.el.getBoundingClientRect();
    A.play('hammer');
    suppressUntil = now() + 500;
    fx.text(r.left + r.width / 2, r.top - 4, 'BONK!', '#ffd23f');
    s.hp--;
    if (s.hp <= 0) shatter(s); else crack(s);
  }

  /* ================= kembali ke posisi asal ================= */
  function scheduleHome(s) { clearTimeout(s.homeT); s.homeT = setTimeout(function () { goHome(s); }, HOME_DELAY); }
  function goHome(s, instant) {
    if (s.mode !== 'rest' && s.mode !== 'home') return;
    if (s.state !== 'ok' && s.state !== 'cracked') return;
    if (cur && cur.s === s) return;
    var el = s.el;
    clearTimeout(s.homeT);
    if (!s.x && !s.y && !s.r) { el.classList.remove('is-home'); el.style.transform = ''; return; }
    if (instant) { resetPose(s); el.classList.remove('is-home'); s.mode = 'rest'; return; }
    s.mode = 'home';
    el.style.transition = 'transform .7s cubic-bezier(.3,1.25,.4,1)';
    s.x = s.y = s.r = 0;
    el.style.transform = 'translate(0px,0px) rotate(0deg)';
    clearTimeout(s.homeEnd);
    s.homeEnd = setTimeout(function () {
      if (s.mode === 'home') { s.mode = 'rest'; el.style.transition = ''; el.style.transform = ''; el.classList.remove('is-home'); }
    }, 780);
  }
  /* ================= dibawa maskot: ambil, bawa, pasang lagi ================= */
  function grab(el) {
    var s = reg.get(el);
    if (!s || s.state === 'broken' || s.state === 'fixing' || s.mode !== 'rest') return false;
    clearTimeout(s.homeT); clearTimeout(s.homeEnd); flying.delete(s);
    s.mode = 'carried'; s.carryAt = now(); s.vx = s.vy = s.vr = 0;
    el.style.transition = 'none';
    el.classList.remove('is-home'); el.classList.add('is-fly');
    return true;
  }
  function carry(el, cx, cy) {
    var s = reg.get(el);
    if (!s || s.mode !== 'carried') return;
    var r = el.getBoundingClientRect();
    var bx = r.left + r.width / 2 - s.x, by = r.top + r.height / 2 - s.y;
    s.x = cx - bx; s.y = cy - by; s.r = Math.sin(now() / 110) * 4;
    apply(s);
  }
  function place(el, instant) {
    var s = reg.get(el);
    if (!s || (s.mode !== 'carried' && !instant)) return false;
    clearTimeout(s.homeT); clearTimeout(s.homeEnd); flying.delete(s);
    resetPose(s); s.mode = 'rest';
    el.classList.remove('is-fly', 'is-home', 'is-drag');
    if (s.state === 'cracked') heal(s);
    if (!instant) {
      el.classList.remove('is-placed'); void el.offsetWidth; el.classList.add('is-placed');
      setTimeout(function () { el.classList.remove('is-placed'); }, 400);
      var r = el.getBoundingClientRect();
      fx.stars(r.left + r.width / 2, r.top + r.height / 2, 4, false);
      A.play('pop');
    }
    return true;
  }
  function release(el) {
    var s = reg.get(el);
    if (!s || s.mode !== 'carried') return;
    s.mode = 'fly'; s.vx = s.vy = s.vr = 0; s.flyStart = now();
    el.classList.add('is-fly'); flying.add(s); kick();
  }

  function tidyAll() {
    reg.forEach(function (s) {
      if (s.state === 'broken') repair(s.el, false);
      else if (s.state === 'cracked') heal(s);
      if (s.mode === 'carried') return;
      if (s.mode === 'fly') { flying.delete(s); s.mode = 'rest'; s.el.classList.remove('is-fly'); }
      if (s.state === 'ok' || s.state === 'cracked') { if (s.mode === 'rest' || s.mode === 'home') goHome(s); }
    });
  }

  /* ================= input: seret / lempar / palu ================= */
  function plOf(t) {
    var el = t && t.closest ? t.closest('.pl') : null;
    return el && !el.closest('.nopl') ? el : null;
  }
  function onDown(e) {
    if (cur) return;
    lastType = e.pointerType || 'mouse';
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (document.body.classList.contains('is-locked')) return;
    var el = plOf(e.target); if (!el) return;
    var s = S(el);
    if (s.state === 'broken' || s.state === 'fixing' || s.mode === 'carried') return;
    var r = el.getBoundingClientRect();
    if (r.height > innerHeight * .75 || r.width > innerWidth * .98) return;
    if (hammer()) { e.preventDefault(); hammerHit(s); return; }
    cur = { s: s, id: e.pointerId, type: e.pointerType || 'mouse', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
            started: false, samples: [{ t: now(), x: e.clientX, y: e.clientY }], lp: 0 };
    if (cur.type !== 'mouse') cur.lp = setTimeout(function () { if (cur && !cur.started) begin(); }, 260);
  }
  function begin() {
    var s = cur.s, el = s.el;
    cur.started = true; cur.px = cur.lx; cur.py = cur.ly;
    clearTimeout(s.homeT); clearTimeout(s.homeEnd);
    if (s.mode === 'home' || s.mode === 'fly') {      /* tangkap di tengah gerak: baca posisi nyata */
      try {
        var m = new DOMMatrix(getComputedStyle(el).transform);
        s.x = m.m41; s.y = m.m42; s.r = Math.atan2(m.m12, m.m11) * 180 / Math.PI;
      } catch (er) { /* pakai nilai terakhir */ }
    }
    flying.delete(s);
    s.mode = 'drag'; cur.x0 = s.x; cur.y0 = s.y;
    el.style.transition = 'none';
    el.classList.remove('is-home', 'is-fly'); el.classList.add('is-drag');
    try { el.setPointerCapture(cur.id); } catch (er) { /* abaikan */ }
    document.body.style.userSelect = 'none'; document.body.style.webkitUserSelect = 'none';
    suppressUntil = now() + 600;
    A.play('pickup');
    if (navigator.vibrate && cur.type !== 'mouse') { try { navigator.vibrate(12); } catch (er) { /* abaikan */ } }
    kick();
  }
  function onMove(e) {
    if (!cur || e.pointerId !== cur.id) return;
    cur.lx = e.clientX; cur.ly = e.clientY;
    var dx = e.clientX - cur.sx, dy = e.clientY - cur.sy;
    if (!cur.started) {
      if (cur.type === 'mouse') { if (Math.hypot(dx, dy) > 5) begin(); else return; }
      else { if (Math.hypot(dx, dy) > 10) { clearTimeout(cur.lp); cur = null; } return; }
    }
    var s = cur.s, t = now();
    cur.samples.push({ t: t, x: e.clientX, y: e.clientY });
    while (cur.samples.length > 2 && t - cur.samples[0].t > 110) cur.samples.shift();
    s.x = cur.x0 + (e.clientX - cur.px); s.y = cur.y0 + (e.clientY - cur.py);
    var a = cur.samples[0], vx = (e.clientX - a.x) / Math.max(.016, (t - a.t) / 1000);
    s.r += (Math.max(-16, Math.min(16, vx / 55)) - s.r) * .3;
    apply(s);
    suppressUntil = t + 600;
    if (e.cancelable) e.preventDefault();
  }
  function velocity() {
    var sm = cur.samples, t = now();
    if (sm.length < 2) return { x: 0, y: 0 };
    var a = sm[0], b = sm[sm.length - 1], dt = (b.t - a.t) / 1000;
    if (dt < .01 || t - b.t > 90) return { x: 0, y: 0 };
    var vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, sp = Math.hypot(vx, vy), cap = 3400;
    if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
    return { x: vx, y: vy };
  }
  function onUp(e) {
    if (!cur || (e && e.pointerId !== cur.id)) return;
    clearTimeout(cur.lp);
    var c = cur; cur = null;
    document.body.style.userSelect = ''; document.body.style.webkitUserSelect = '';
    if (!c.started) return;
    cur = c; var v = velocity(); cur = null;
    var s = c.s, el = s.el;
    try { el.releasePointerCapture(c.id); } catch (er) { /* abaikan */ }
    suppressUntil = now() + 400;
    el.classList.remove('is-drag'); el.classList.add('is-fly');
    s.vx = v.x; s.vy = v.y; s.vr = Math.max(-420, Math.min(420, v.x * .12));
    s.mode = 'fly'; s.flyStart = now(); flying.add(s);
    if (Math.hypot(v.x, v.y) > 700) A.play('throw');
    kick();
  }
  document.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('blur', function () { onUp(); });
  document.addEventListener('touchmove', function (e) { if (cur && cur.started && e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('dragstart', function (e) { if (plOf(e.target)) e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { if (cur && cur.started) e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { if (lastType !== 'mouse' && plOf(e.target)) e.preventDefault(); });
  /* klik setelah seret / mode palu tidak boleh menjalankan aksi tombol */
  document.addEventListener('click', function (e) {
    var el = plOf(e.target);
    if (el && (now() < suppressUntil || hammer())) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  /* ================= watchdog ================= */
  setInterval(function () {
    var t = now();
    reg.forEach(function (s) {
      if (s.state === 'broken' && t - s.brokenAt > 3800) repair(s.el, false);
      else if (s.state === 'cracked' && s.mode === 'rest' && t - s.crackedAt > 7000) heal(s);
      else if (s.state === 'fixing' && t - s.fixStart > 1500) { clearTimeout(s.fixT); s.el.classList.remove('is-fixing'); s.state = 'ok'; }
      if (s.mode === 'fly' && t - s.flyStart > 10000) settle(s);
      if (s.mode === 'carried' && t - s.carryAt > 8000) release(s.el);
    });
  }, 700);

  /* ================= init ================= */
  function init() {
    var list = document.querySelectorAll(SEL);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.closest('.nopl,.gate,.tools')) continue;
      el.classList.add('pl');
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      S(el);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.RhyoPlay = {
    on: on, repair: repair, shatter: function (el) { return shatter(S(el)); }, crack: function (el) { return crack(S(el)); },
    tidyAll: tidyAll, fx: fx, reg: reg, S: S, grab: grab, carry: carry, place: place, release: release,
    stateOf: function (el) { var s = reg.get(el); return s ? s.state : null; },
    homeCenter: function (el) {
      var s = reg.get(el), r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - (s ? s.x : 0), y: r.top + r.height / 2 - (s ? s.y : 0), w: r.width, h: r.height, visible: r.width > 0 };
    },
    hammer: hammer
  };
})();
