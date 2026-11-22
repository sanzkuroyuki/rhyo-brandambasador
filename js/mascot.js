/*
 * mascot.js: maskot TV (dari proyek quest). Bisa diseret, dibanting, dilempar, dipukul.
 * Kalau ada item pecah, maskot langsung berlari ke tempatnya dan memperbaikinya.
 * Setelah diam 1 detik, maskot merapikan diri ke tepi layar. Tanpa auto-scroll.
 */
(function () {
  'use strict';
  var A = window.RhyoAudio || { play: function () {} };
  var P = window.RhyoPlay;
  var G = 2600, REST = 0.48;
  var st = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, sq: 0, mode: 'idle', started: false, dizzyUntil: 0, soft: false, flyStart: 0 };
  var MS = 92, MH = 99, W = innerWidth, H = innerHeight;
  var el, sayEl, rotEl, bodyEl;
  var raf = 0, last = 0, tw = null, working = false;
  var tidyT = 0, sleepT = 0, faceT = 0, talkT = 0, pumpT = 0, dizzyT = 0, hopT = 0;
  var lastTalk = 0, lastTip = '', lastTipAt = 0, lastHurt = 0, lastItemHit = 0;
  var queue = [], drag = null, hits = [], carrying = null;
  var Q = {
    hello: 'Halo! Aku maskotnya Rhyo. Coba seret, banting, atau lempar aku!',
    brk: ['Eh! Aku perbaiki ya!', 'Tenang, aku datang!', 'Siap, meluncur!'],
    fix: ['Beres!', 'Sudah kembali!', 'Baru lagi!'],
    hurt: ['Aduh!', 'Sakit tau!', 'Hei, pelan-pelan!'],
    slam: ['Aduh!!', 'Kepalaku...', 'Awww!'],
    dizzy: ['Pusiing...', 'Dunia berputar...', 'Bintang-bintang~'],
    punch: ['Auw!', 'Jangan dipukul~', 'Hei!', 'Kok aku sih?'],
    caught: ['Eh?! Lepas!', 'Turunkan aku!', 'Aaa!'],
    thrown: ['Wuaaa!', 'Aku terbang!'],
    place: ['Pasang lagi!', 'Kembali ke tempatnya!', 'Rapi!'],
    grab: ['Kuambil ya!', 'Jangan berserakan~', 'Sini, kurapikan!']
  };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var now = function () { return performance.now(); };

  var SVG = '' +
    '<svg class="mi" viewBox="0 0 200 215" aria-hidden="true">' +
    '<g class="ant"><path d="M78 56L52 18M122 56L150 14" stroke="#1b2a8f" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="14" r="10" fill="#ff5fa8" stroke="#1b2a8f" stroke-width="5"/><circle cx="152" cy="10" r="10" fill="#ffd23f" stroke="#1b2a8f" stroke-width="5"/></g>' +
    '<rect x="18" y="52" width="164" height="124" rx="36" fill="#fff" stroke="#1b2a8f" stroke-width="7"/>' +
    '<rect x="34" y="68" width="132" height="92" rx="24" fill="#bfe0ff" stroke="#1b2a8f" stroke-width="5"/>' +
    '<path d="M46 80Q60 74 78 76" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/>' +
    '<g class="eyes-n"><ellipse cx="72" cy="108" rx="10" ry="14" fill="#1b2a8f"/><ellipse cx="128" cy="108" rx="10" ry="14" fill="#1b2a8f"/><circle cx="68" cy="102" r="4" fill="#fff"/><circle cx="124" cy="102" r="4" fill="#fff"/></g>' +
    '<g class="fx-hurt" stroke="#1b2a8f" stroke-width="7" stroke-linecap="round" fill="none"><path d="M60 96l22 22M82 96l-22 22M118 96l22 22M140 96l-22 22"/></g>' +
    '<g class="fx-dizzy" fill="none" stroke="#1b2a8f" stroke-width="5" stroke-linecap="round"><g class="sp"><circle cx="72" cy="108" r="12" stroke-dasharray="44 30"/></g><g class="sp"><circle cx="128" cy="108" r="12" stroke-dasharray="44 30"/></g></g>' +
    '<g class="fx-scared"><ellipse cx="72" cy="108" rx="14" ry="18" fill="#fff" stroke="#1b2a8f" stroke-width="5"/><ellipse cx="128" cy="108" rx="14" ry="18" fill="#fff" stroke="#1b2a8f" stroke-width="5"/><circle cx="72" cy="110" r="5" fill="#1b2a8f"/><circle cx="128" cy="110" r="5" fill="#1b2a8f"/></g>' +
    '<g class="fx-happy" stroke="#1b2a8f" stroke-width="7" stroke-linecap="round" fill="none"><path d="M58 116Q72 94 86 116M114 116Q128 94 142 116"/></g>' +
    '<g class="fx-sleep" stroke="#1b2a8f" stroke-width="6" stroke-linecap="round"><path d="M58 112h28M114 112h28"/></g>' +
    '<ellipse cx="54" cy="132" rx="10" ry="6" fill="#ff5fa8" opacity=".75"/><ellipse cx="146" cy="132" rx="10" ry="6" fill="#ff5fa8" opacity=".75"/>' +
    '<path class="mo-s" d="M88 130Q100 144 112 130" stroke="#1b2a8f" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<ellipse class="mo-o" cx="100" cy="136" rx="7" ry="9" fill="#1b2a8f"/>' +
    '<path class="mo-sad" d="M86 142Q100 126 114 142" stroke="#1b2a8f" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path class="mo-grin" d="M84 126Q100 154 116 126Z" fill="#1b2a8f" stroke="#1b2a8f" stroke-width="4" stroke-linejoin="round"/>' +
    '<path class="mo-wavy" d="M84 136q8-9 16 0t16 0" stroke="#1b2a8f" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M44 176L100 204L156 176V190Q100 220 44 190Z" fill="#1b2a8f"/><path d="M100 194L80 184V206ZM100 194L120 184V206Z" fill="#ff5fa8" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>' +
    '</svg>';

  /* ================= util posisi ================= */
  function measure() { MS = el.offsetWidth || 92; MH = el.offsetHeight || 99; W = innerWidth; H = innerHeight; }
  function dockRect() { var d = document.getElementById('dock'); return d ? d.getBoundingClientRect() : { left: 0, right: 0, top: H - 86 }; }
  function floorY() { return H - MH; }
  function standY(x) {
    var d = dockRect();
    if (x + MS > d.left + 12 && x < d.right - 12) return Math.min(floorY(), d.top - MH + 6);
    return floorY();
  }
  function edgeX(x) { return (x + MS / 2 < W / 2) ? 8 : W - MS - 26; }
  function render() {
    el.style.transform = 'translate3d(' + st.x.toFixed(1) + 'px,' + st.y.toFixed(1) + 'px,0)';
    rotEl.style.transform = 'rotate(' + st.rot.toFixed(1) + 'deg)';
    bodyEl.style.transform = 'scale(' + (1 + st.sq).toFixed(3) + ',' + (1 - st.sq).toFixed(3) + ')';
  }

  /* ================= wajah, bicara, tidur ================= */
  var FACES = ['hurt', 'dizzy', 'scared', 'happy', 'sleep', 'work'];
  function setFace(f) {
    FACES.forEach(function (n) { el.classList.remove('f-' + n); });
    if (f) el.classList.add('f-' + f);
  }
  function baseFace() {
    if (st.mode === 'held') return 'scared';
    if (now() < st.dizzyUntil) return 'dizzy';
    if (working || st.mode === 'work') return 'work';
    if (el.classList.contains('sleep')) return 'sleep';
    return '';
  }
  function face(f, ms) { clearTimeout(faceT); setFace(f); if (ms) faceT = setTimeout(function () { setFace(baseFace()); }, ms); }
  function talk(msg, ms, force) {
    var t = now();
    if (!force && t - lastTalk < 1100) return;
    lastTalk = t; sayEl.textContent = msg;
    el.classList.remove('say-left', 'say-right', 'say-below');
    if (st.x < 110) el.classList.add('say-left'); else if (st.x > W - MS - 110) el.classList.add('say-right');
    if (st.y < 80) el.classList.add('say-below');
    el.classList.add('talk'); clearTimeout(talkT);
    talkT = setTimeout(function () { el.classList.remove('talk'); }, ms || 2600);
  }
  function wake() {
    clearTimeout(sleepT);
    if (el.classList.contains('sleep')) { el.classList.remove('sleep'); setFace(baseFace()); }
    sleepT = setTimeout(function () {
      if (st.mode === 'idle' && !working && now() > st.dizzyUntil) { el.classList.add('sleep'); setFace('sleep'); }
    }, 25000);
  }

  /* ================= loop ================= */
  function kick() { if (!raf) { last = now(); raf = requestAnimationFrame(tick); } }
  function tick(t) {
    raf = 0;
    var dt = Math.min(.033, Math.max(.001, (t - last) / 1000)); last = t;
    var active = false;
    if (st.mode === 'held') { active = true; stepHeld(dt); }
    else if (st.mode === 'fly') { active = true; stepFly(dt); }
    else if (st.mode === 'work' || st.mode === 'tidy') { active = true; stepTween(t); }
    if (st.sq !== 0) { st.sq *= Math.max(0, 1 - 9 * dt); if (Math.abs(st.sq) < .01) st.sq = 0; active = true; }
    if (st.rot !== 0 && st.mode === 'idle') { st.rot *= Math.max(0, 1 - 8 * dt); if (Math.abs(st.rot) < .3) st.rot = 0; active = true; }
    render();
    if (active) raf = requestAnimationFrame(tick);
  }
  function vel() {
    if (!drag) return { x: 0, y: 0 };
    var sm = drag.samples, b = sm[sm.length - 1], a = sm[0], dt = (b.t - a.t) / 1000;
    if (sm.length < 2 || dt < .01 || now() - b.t > 80) return { x: 0, y: 0 };
    var vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, sp = Math.hypot(vx, vy);
    if (sp > 3400) { vx *= 3400 / sp; vy *= 3400 / sp; }
    return { x: vx, y: vy };
  }
  function stepHeld(dt) {
    var v = vel();
    st.rot += (clamp(v.x / 28, -38, 38) - st.rot) * Math.min(1, dt * 12);
  }
  function stepFly(dt) {
    st.vy += G * dt;
    var nx = st.x + st.vx * dt, ny = st.y + st.vy * dt, hit = 0, floor = false, maxX = W - MS, maxY = floorY();
    if (nx < 0) { nx = 0; hit = Math.max(hit, Math.abs(st.vx)); st.vx = Math.abs(st.vx) * REST; st.vr *= -.6; }
    else if (nx > maxX) { nx = maxX; hit = Math.max(hit, Math.abs(st.vx)); st.vx = -Math.abs(st.vx) * REST; st.vr *= -.6; }
    if (ny < 0) { ny = 0; hit = Math.max(hit, Math.abs(st.vy)); st.vy = Math.abs(st.vy) * REST; }
    else if (ny > maxY) {
      ny = maxY; floor = true;
      var pre = Math.abs(st.vy);
      if (pre < 300) st.vy = 0; else { hit = Math.max(hit, pre); st.vy = -pre * REST; st.vr *= .5; }
      var f = Math.min(Math.abs(st.vx), 1500 * dt); st.vx -= Math.sign(st.vx) * f;
    }
    st.x = nx; st.y = ny; st.rot += st.vr * dt; st.vr *= Math.max(0, 1 - .5 * dt);
    if (floor) st.rot += (0 - st.rot) * Math.min(1, dt * 8);
    if (hit > 300) hurt(hit);
    if ((floor && st.vy === 0 && Math.abs(st.vx) < 30 && Math.abs(st.rot) < 2) || now() - st.flyStart > 12000) land();
  }
  function land() {
    st.mode = 'idle'; st.vx = st.vy = st.vr = 0; st.soft = false; st.y = Math.min(st.y, floorY());
    setFace(baseFace()); wake(); scheduleTidy(); schedulePump(30);
  }
  function fly(vx, vy, vr) {
    cancelTween(); clearTimeout(tidyT);
    st.mode = 'fly'; st.vx = vx; st.vy = vy; st.vr = vr || 0; st.flyStart = now();
    el.classList.remove('idle'); kick();
  }

  /* ================= tween (lari memperbaiki / merapikan diri) ================= */
  function tweenTo(tx, ty, dur, mode, done, arc) {
    tw = null;                       /* tween lama diganti tanpa melepas item yang sedang dibawa */
    st.mode = mode; el.classList.remove('idle');
    tw = { t0: now(), x0: st.x, y0: st.y, x1: tx, y1: ty, dur: dur, done: done, arc: arc || 0, onStep: null };
    kick();
  }
  function stepTween(t) {
    if (!tw) return;
    if (tw.onStep) tw.onStep();
    var p = Math.min(1, (t - tw.t0) / tw.dur), e = 1 - Math.pow(1 - p, 3), dir = tw.x1 >= tw.x0 ? 1 : -1;
    st.x = tw.x0 + (tw.x1 - tw.x0) * e;
    st.y = tw.y0 + (tw.y1 - tw.y0) * e - Math.sin(Math.PI * p) * tw.arc;
    st.rot = dir * 9 * Math.sin(Math.PI * p);
    if (p >= 1) { var d = tw.done; tw = null; st.mode = 'idle'; el.classList.add('idle'); if (d) d(true); }
  }
  /* dipanggil saat maskot diganggu (diseret, dipukul, ditabrak): item yang dibawa dilepas dan jatuh */
  function dropCarry() { if (carrying) { P.release(carrying); carrying = null; } }
  function cancelTween() { if (tw) { tw = null; working = false; } dropCarry(); }

  /* ================= dampak ================= */
  function hurt(speed) {
    var t = now();
    if (t - lastHurt < 200) return;
    lastHurt = t;
    var cx = st.x + MS / 2, cy = st.y + MH / 2;
    if (st.soft && speed < 800) { A.play('bounce'); st.sq = .15; return; }
    if (speed < 600) { A.play('bounce'); st.sq = .2; return; }
    if (speed < 950) { A.play('bonk'); st.sq = .3; face('hurt', 500); P.fx.stars(cx, cy, 3, false); return; }
    if (speed < 1500) {
      A.play('ouch'); st.sq = .4; face('hurt', 900);
      P.fx.stars(cx, cy, 6, true); P.fx.text(cx, st.y - 4, 'BONK!', '#ffd23f'); talk(pick(Q.hurt), 1800);
      return;
    }
    var ko = speed > 2300;
    A.play('slam'); st.sq = .55;
    P.fx.dust(cx, st.y + MH, 8); P.fx.stars(cx, cy, 10, true);
    P.fx.text(cx, st.y - 6, ko ? 'K.O.!' : 'BAM!', '#ffffff'); P.fx.shake();
    dizzy(ko ? 2400 : 1500); talk(pick(Q.slam), 1800, true);
  }
  function dizzy(ms) {
    st.dizzyUntil = now() + ms;
    el.classList.add('dizzy'); face('dizzy'); A.play('dizzy');
    clearTimeout(dizzyT);
    dizzyT = setTimeout(function () {
      if (now() >= st.dizzyUntil - 20) { el.classList.remove('dizzy'); setFace(baseFace()); schedulePump(20); scheduleTidy(); }
    }, ms + 30);
    setTimeout(function () { talk(pick(Q.dizzy), 1600); }, 350);
  }

  /* ================= antrean perbaikan ================= */
  function busy() { return st.mode === 'held' || st.mode === 'fly' || now() < st.dizzyUntil; }
  function enqueue(item, delay) {
    for (var i = 0; i < queue.length; i++) if (queue[i].el === item) return;
    queue.push({ el: item, due: now() + (delay || 0) });
    schedulePump(delay || 0);
  }
  function schedulePump(ms) { clearTimeout(pumpT); pumpT = setTimeout(pump, (ms || 0) + 8); }
  function pump() {
    clearTimeout(pumpT);
    if (!st.started || working) return;
    var t = now(), job = null, kind = null, nextDue = Infinity, i, k;
    /* pekerjaan: repair (item pecah), carry (item jatuh/berpindah), heal (retak di tempat) */
    queue = queue.filter(function (j) { return !!jobKind(j.el, true); });
    for (i = 0; i < queue.length && !job; i++) if (jobKind(queue[i].el) === 'repair') { job = queue[i]; kind = 'repair'; }
    for (i = 0; i < queue.length && !job; i++) {
      k = jobKind(queue[i].el);
      if (k && t >= queue[i].due) { job = queue[i]; kind = k; }
      else nextDue = Math.min(nextDue, k ? queue[i].due : t + 300);
    }
    if (!job) { if (nextDue < Infinity) schedulePump(Math.max(60, nextDue - t)); else scheduleTidy(); return; }
    if (busy()) { schedulePump(160); return; }
    working = true; clearTimeout(tidyT); wake(); el.classList.remove('sleep');
    var finish = function () { queue = queue.filter(function (x) { return x !== job; }); working = false; carrying = null; setFace(baseFace()); schedulePump(40); };
    if (kind === 'carry') { doCarry(job, finish); return; }
    var hc = P.homeCenter(job.el);
    if (!hc.visible) { P.repair(job.el, true); finish(); return; }
    var tx = clamp(hc.x - MS / 2, 4, W - MS - 4), ty = clamp(hc.y - MH / 2, 4, H - MH - 4);
    var dist = Math.hypot(tx - st.x, ty - st.y);
    setFace('work'); A.play('hop');
    tweenTo(tx, ty, Math.max(150, Math.min(340, dist / 2.6)), 'work', function () {
      var q = P.stateOf(job.el);
      if (q === 'broken' || q === 'cracked') { P.repair(job.el, true); face('happy', 700); talk(pick(Q.fix), 1300); P.fx.stars(tx + MS / 2, ty + MH / 2, 5, false); }
      setTimeout(finish, 170);
    }, 28);
  }
  /* jenis pekerjaan untuk satu item; keep=true: hanya cek apakah masih perlu dipertahankan di antrean */
  function jobKind(item, keep) {
    var s = P.reg.get(item);
    if (!s) return null;
    if (s.state === 'broken') return 'repair';
    var moving = s.mode === 'fly' || s.mode === 'drag' || s.mode === 'home';
    var displaced = !!(s.x || s.y || s.r);
    if (moving) return keep ? 'wait' : null;
    if (s.mode === 'carried') return keep ? 'wait' : null;
    if (displaced) return 'carry';
    if (s.state === 'cracked') return 'heal';
    return null;
  }
  /* ambil item yang sudah jatuh, bawa ke tempat asalnya, lalu pasang lagi */
  function doCarry(job, finish) {
    var item = job.el, r = item.getBoundingClientRect();
    if (!r.width) { P.place(item, true); finish(); return; }
    var ix = r.left + r.width / 2, iy = r.top + r.height / 2;
    var tx = clamp(ix - MS / 2, 4, W - MS - 4), ty = clamp(iy - MH / 2, 4, H - MH - 4);
    var dist = Math.hypot(tx - st.x, ty - st.y);
    setFace('work'); A.play('hop');
    tweenTo(tx, ty, Math.max(160, Math.min(420, dist / 2.2)), 'work', function () {
      if (!P.grab(item)) { setTimeout(finish, 60); return; }       /* item sudah berubah: batalkan */
      carrying = item; A.play('pickup'); face('happy', 500); talk(pick(Q.grab), 1300);
      var hc = P.homeCenter(item);
      var gx = clamp(hc.x - MS / 2, 4, W - MS - 4), gy = clamp(hc.y - MH / 2, 4, H - MH - 4);
      var d2 = Math.hypot(gx - st.x, gy - st.y);
      tweenTo(gx, gy, clamp(d2 / 1.3, 360, 800), 'work', function () {
        if (carrying === item) {
          P.place(item); carrying = null;
          face('happy', 800); talk(pick(Q.place), 1300);
          P.fx.stars(st.x + MS / 2, st.y + MH / 2, 5, false);
        }
        setTimeout(finish, 220);
      }, 40);
      tw.onStep = function () {                                     /* tujuan ikut bergerak bila halaman digulir */
        var h = P.homeCenter(item);
        tw.x1 = clamp(h.x - MS / 2, 4, W - MS - 4); tw.y1 = clamp(h.y - MH / 2, 4, H - MH - 4);
        P.carry(item, st.x + MS / 2, st.y + MH / 2 - 4);
      };
    }, 30);
  }

  /* ================= rapikan otomatis (1 detik setelah diam) ================= */
  function scheduleTidy() { clearTimeout(tidyT); tidyT = setTimeout(tidy, 1000); }
  function tidy() {
    if (!st.started || st.mode !== 'idle' || working || busy()) return;
    if (queue.length) { schedulePump(0); return; }
    var tx = edgeX(st.x), ty = standY(tx);
    var dist = Math.hypot(tx - st.x, ty - st.y);
    if (dist < 5) { st.x = tx; st.y = ty; render(); return; }
    A.play('hop');
    tweenTo(tx, ty, clamp(dist / 1.6, 380, 700), 'tidy', function () { scheduleTidy(); }, Math.min(60, dist / 6));
  }

  /* ================= input: seret, banting, lempar, pukul ================= */
  function onDown(e) {
    if (!st.started) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    wake();
    if (P.hammer()) { punch(e, true); return; }
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, samples: [{ t: now(), x: e.clientX, y: e.clientY }], gx: 0, gy: 0, hitCd: 0 };
    try { el.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
  }
  function hold(e) {
    drag.moved = true; cancelTween(); working = false;
    clearTimeout(tidyT); clearTimeout(hopT);
    st.mode = 'held'; st.vx = st.vy = st.vr = 0; st.soft = false;
    drag.gx = e.clientX - st.x; drag.gy = e.clientY - st.y;
    el.classList.add('held'); el.classList.remove('idle', 'sleep');
    setFace('scared'); A.play('pickup'); talk(pick(Q.caught), 1600, true);
    kick();
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) { if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) hold(e); else return; }
    var t = now(), sm = drag.samples;
    sm.push({ t: t, x: e.clientX, y: e.clientY });
    while (sm.length > 2 && t - sm[0].t > 110) sm.shift();
    var wx = e.clientX - drag.gx, wy = e.clientY - drag.gy;
    var nx = clamp(wx, 0, W - MS), ny = clamp(wy, 0, floorY());
    var v = vel(), hitSpeed = 0;
    if (wy > floorY() + 2 && v.y > 700) hitSpeed = v.y;            /* dibanting ke lantai */
    else if (wy < -2 && v.y < -700) hitSpeed = -v.y;               /* dibenturkan ke atas */
    else if (wx < -2 && v.x < -700) hitSpeed = -v.x;
    else if (wx > W - MS + 2 && v.x > 700) hitSpeed = v.x;
    st.x = nx; st.y = ny;
    if (hitSpeed && t - drag.hitCd > 260) { drag.hitCd = t; hurt(hitSpeed); }
    /* guncang kuat = pusing */
    shakeCheck(v.x, t);
    if (e.cancelable) e.preventDefault();
    kick();
  }
  var shakeLog = [];
  function shakeCheck(vx, t) {
    if (Math.abs(vx) < 650) return;
    var s = vx > 0 ? 1 : -1, l = shakeLog[shakeLog.length - 1];
    if (!l || l.s !== s) shakeLog.push({ s: s, t: t });
    shakeLog = shakeLog.filter(function (x) { return t - x.t < 900; });
    if (shakeLog.length >= 5 && now() > st.dizzyUntil) { shakeLog = []; dizzy(1700); }
  }
  function onUp(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; var moved = d.moved, v = vel(); drag = null;
    try { el.releasePointerCapture(d.id); } catch (er) { /* abaikan */ }
    el.classList.remove('held');
    if (!moved) { if (e && e.type === 'pointerup') punch(e, false); return; }
    var sp = Math.hypot(v.x, v.y);
    if (sp > 700) { A.play('throw'); if (sp > 1300) talk(pick(Q.thrown), 1500, true); }
    fly(v.x, v.y, clamp(v.x * .12, -480, 480));
    setFace(baseFace());
  }
  function punch(e, byHammer) {
    var cx = st.x + MS / 2, dir = e.clientX < cx ? 1 : -1;
    working = false; cancelTween();
    fly(dir * (byHammer ? 900 : 300 + Math.random() * 120), byHammer ? -900 : -540, dir * (byHammer ? 520 : 240));
    st.soft = !byHammer;
    face('hurt', byHammer ? 900 : 520);
    A.play(byHammer ? 'hammer' : 'punch');
    P.fx.stars(e.clientX, e.clientY, byHammer ? 8 : 4, byHammer);
    P.fx.text(e.clientX, e.clientY - 20, byHammer ? 'BONK!' : pick(['POW!', 'PUK!', 'DUK!']), '#ffd23f');
    st.sq = .35; talk(pick(Q.punch), 1500);
    var t = now(); hits.push(t); hits = hits.filter(function (x) { return t - x < 3000; });
    if (hits.length >= (byHammer ? 3 : 5)) { hits = []; dizzy(byHammer ? 2000 : 1500); }
  }
  /* item yang dilempar bisa menabrak maskot */
  function onItemMove(x, y, w, h, v) {
    if (!st.started || st.mode === 'held') return false;
    if (x > st.x + MS || x + w < st.x || y > st.y + MH || y + h < st.y) return false;
    var sp = Math.hypot(v.vx, v.vy), t = now();
    if (sp < 420 || t - lastItemHit < 500) return false;
    lastItemHit = t; working = false;
    fly(v.vx * .7, Math.min(-300, v.vy * .4 - 250), clamp(v.vx * .1, -400, 400));
    st.soft = false; hurt(Math.min(sp * .8, 1450)); face('hurt', 800);
    return true;
  }

  /* ================= start / layout ================= */
  function start() {
    if (st.started) return;
    st.started = true; el.style.display = 'block'; measure();
    var x = 8; st.x = x; st.y = Math.max(0, standY(x) - 70); st.vx = 0; st.vy = 0;
    st.soft = true; st.mode = 'fly'; st.flyStart = now(); render(); kick();
    setTimeout(function () { talk(Q.hello, 5200, true); face('happy', 900); }, 500);
    wake();
  }
  function tidyNow() {
    if (!st.started) return;
    cancelTween(); working = false;
    if (st.mode === 'held') return;
    st.mode = 'idle'; face('happy', 700); talk('Semua dirapikan!', 1600, true);
    queue = []; schedulePump(0); scheduleTidy();
  }
  function onResize() {
    measure();
    if (!st.started) return;
    st.x = clamp(st.x, 0, W - MS); st.y = clamp(st.y, 0, floorY());
    render(); if (st.mode === 'idle') scheduleTidy();
  }
  function idleHop() {
    clearTimeout(hopT);
    hopT = setTimeout(function () {
      if (st.started && st.mode === 'idle' && !working && now() > st.dizzyUntil && !el.classList.contains('sleep') && !document.hidden) {
        st.soft = true; fly(0, -480, 0); A.play('hop'); face('happy', 700);
      }
      idleHop();
    }, 9000 + Math.random() * 6000);
  }

  function mount() {
    el = document.createElement('div');
    el.className = 'mascot idle'; el.id = 'mascot'; el.style.display = 'none';
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Maskot TV Bstation Creator. Bisa diseret, dilempar, dan dipukul.');
    el.innerHTML = '<div class="halo" aria-hidden="true"><i></i><i></i><i></i></div><div class="mascot__rot"><div class="mascot__body">' + SVG + '</div></div><div class="mascot__say" aria-hidden="true"></div>';
    rotEl = el.querySelector('.mascot__rot'); bodyEl = el.querySelector('.mascot__body'); sayEl = el.querySelector('.mascot__say');
    document.body.appendChild(el);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    document.addEventListener('touchmove', function (e) { if (drag && drag.moved && e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', function () { onUp(); });
    measure();
    if (P) {
      P.on('break', function (s) { enqueue(s.el, 0); talk(pick(Q.brk), 1500); });
      P.on('crack', function (s) { enqueue(s.el, 1500); });
      P.on('rest', function (s) { enqueue(s.el, 600); });          /* item jatuh dan diam: maskot datang memungutnya */
      P.on('move', onItemMove);
    }
    /* komentar sesuai bagian halaman (tanpa menggulir halaman) */
    var tips = document.querySelectorAll('[data-tip]');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var tip = en.target.getAttribute('data-tip'), t = now();
          if (tip && tip !== lastTip && t - lastTipAt > 5000 && st.started && st.mode === 'idle' && !working && t > st.dizzyUntil && now() - lastTalk > 3000 && t - startedAt() > 7000) {
            lastTip = tip; lastTipAt = t; wake(); talk(tip, 3600);
            st.soft = true; fly(0, -420, 0);
          }
        });
      }, { threshold: .45 });
      for (var i = 0; i < tips.length; i++) io.observe(tips[i]);
    }
    idleHop();
    setInterval(function () { if (queue.length && !working) pump(); }, 500);   /* jaring pengaman */
  }
  var t0 = 0;
  function startedAt() { return t0 || (t0 = now()); }

  window.RhyoMascot = {
    start: function () { t0 = now(); start(); },
    talk: talk, tidy: tidyNow, enqueue: enqueue,
    state: st, queue: function () { return queue.length; },
    rect: function () { return { x: st.x, y: st.y, w: MS, h: MH }; },
    hurt: hurt
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
