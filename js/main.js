(function () {
  'use strict';
  var A = window.RhyoAudio, C = window.CFG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== data ambasador dari config.js ===== */
  var wa = function (t) { return 'https://wa.me/' + C.whatsapp + '?text=' + encodeURIComponent(t); };
  var map = { name: C.name, ref: C.refCode, wa: C.waDisplay };
  $$('[data-cfg]').forEach(function (e) { if (map[e.dataset.cfg]) e.textContent = map[e.dataset.cfg]; });
  $$('[data-link]').forEach(function (a) {
    var k = a.dataset.link, u = k === 'wa' ? wa('Halo kak, saya mau tanya soal daftar creator Bstation.')
      : k === 'reg' ? (C.registerUrl || wa('Halo kak, saya mau daftar creator Bstation. Kode ref: ' + C.refCode)) : C[k];
    if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener'; }
    else { var h = a.closest('li') || a; h.hidden = true; }
  });
  $$('[data-copy]').forEach(function (b) { b.dataset.copy = C.refCode || b.dataset.copy; });

  /* ===== toast ===== */
  var toastEl = $('#toast'), toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
  }

  /* ===== gerbang masuk: musik atau tanpa musik ===== */
  var gate = $('#gate');
  function enter(withMusic) {
    A.unlock(); A.play('gate');
    if (withMusic) A.setMusic(true);
    gate.classList.add('is-out');
    document.body.classList.remove('is-locked');
    document.body.classList.add('is-ready');
    window.scrollTo(0, 0);
    setTimeout(function () { gate.remove(); typeHero(); setTimeout(function () { $('#b1').style.width = '100%'; }, 200); }, 650);
    setTimeout(function () { if (window.RhyoMascot) window.RhyoMascot.start(); }, 500);
  }
  $('#gateMusic').addEventListener('click', function () { enter(true); });
  $('#gateQuiet').addEventListener('click', function () { enter(false); });

  /* ===== alat: musik, palu, rapikan ===== */
  var mt = $('#musicToggle');
  mt.addEventListener('click', function () {
    A.unlock(); A.setMusic(!A.isMusic()); A.play('tap');
    toast(A.isMusic() ? 'Musik menyala' : 'Musik dimatikan');
  });
  document.addEventListener('rhyo:music', function (e) {
    mt.classList.toggle('on', e.detail); mt.setAttribute('aria-pressed', e.detail ? 'true' : 'false');
  });
  var hb = $('#hammerToggle');
  hb.addEventListener('click', function () {
    var on = !document.body.classList.contains('hammer');
    document.body.classList.toggle('hammer', on);
    hb.setAttribute('aria-pressed', on ? 'true' : 'false'); hb.classList.toggle('on', on);
    A.play(on ? 'hammer' : 'tap');
    toast(on ? 'Mode palu aktif: ketuk item untuk memukul' : 'Mode palu mati');
    if (window.RhyoMascot) window.RhyoMascot.talk(on ? 'Eh, awas palunya!' : 'Fiuh, aman.', 1800, true);
  });
  $('#tidyBtn').addEventListener('click', function () {
    A.play('whoosh');
    if (window.RhyoPlay) window.RhyoPlay.tidyAll();
    if (window.RhyoMascot) window.RhyoMascot.tidy();
    toast('Semua item dirapikan');
  });

  /* ===== efek suara global ===== */
  var lastHover = 0;
  document.addEventListener('click', function (e) {
    var t = e.target.closest('a,button,.pl,.tag');
    if (!t || t.id === 'gateMusic' || t.id === 'gateQuiet' || t.id === 'musicToggle' || t.id === 'hammerToggle' || t.id === 'tidyBtn') return;
    A.play(t.getAttribute('data-sfx') || 'tap');
  }, true);
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var t = e.target.closest('a,button,.c,.card');
    var n = Date.now();
    if (t && n - lastHover > 90) { lastHover = n; A.play('hover'); }
  });

  /* ===== navigasi dengan tirai warna (tanpa auto-scroll) ===== */
  var wipe = $('#wipe'), busy = false;
  function go(id) {
    var target = document.getElementById(id);
    if (!target || busy) return;
    busy = true; A.play('whoosh');
    wipe.classList.remove('off'); wipe.classList.add('on');
    setTimeout(function () {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      wipe.classList.add('off'); wipe.classList.remove('on');
      setTimeout(function () { wipe.classList.remove('off'); busy = false; }, 450);
    }, reduce ? 0 : 420);
  }
  $$('.dock a, .rb, .brand, [data-nav-jump], .seal').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var h = a.getAttribute('href') || '';
      if (h.charAt(0) !== '#') return;
      e.preventDefault(); go(h.slice(1));
    });
  });
  var links = {};
  $$('.dock a').forEach(function (a) { links[a.dataset.nav] = a; });
  var navIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && links[e.target.id]) {
        $$('.dock a').forEach(function (x) { x.classList.remove('on'); });
        links[e.target.id].classList.add('on');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['home', 'story', 'latih', 'hadiah', 'kategori', 'daftar'].forEach(function (id) { var s = document.getElementById(id); if (s) navIO.observe(s); });

  /* ===== reveal + hitung angka ===== */
  function countUp(el) {
    var to = +el.dataset.count, t0 = null, lastV = 0;
    if (reduce) { el.textContent = to; return; }
    el.textContent = 0;
    function f(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / 1200), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      el.textContent = v;
      if (v !== lastV && v % 25 === 0) A.play('count');
      lastV = v;
      if (p < 1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }
  var revIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      $$('[data-count]', e.target).forEach(countUp);
      revIO.unobserve(e.target);
    });
  }, { threshold: .08 });
  $$('.reveal').forEach(function (el) { revIO.observe(el); });

  /* ===== hero: teks mengetik, huruf RHYO, miring 3D ===== */
  var PHRASES = ['Bagikan passion-mu lewat video.', 'Bangun komunitas creator.', 'Raih hadiah mingguan hingga 50K.', 'Yuk daftar bareng Rhyo!'];
  var typed = false;
  function typeHero() {
    if (typed) return; typed = true;
    var out = $('#bubbleText'), pi = 0, ci = 0, del = false;
    if (reduce) { out.textContent = PHRASES[0]; return; }
    out.textContent = '';
    (function tick() {
      var full = PHRASES[pi];
      if (!del) { ci++; out.textContent = full.slice(0, ci); if (ci === full.length) { del = true; return setTimeout(tick, 1900); } }
      else { ci -= 2; if (ci <= 0) { ci = 0; del = false; pi = (pi + 1) % PHRASES.length; } out.textContent = full.slice(0, ci); }
      setTimeout(tick, del ? 22 : 48);
    })();
  }
  var letters = $$('#heroName b');
  function jump(b) { b.classList.add('jump'); setTimeout(function () { b.classList.remove('jump'); }, 380); }
  letters.forEach(function (b) { b.addEventListener('pointerenter', function () { jump(b); A.play('pop'); }); });
  $('#heroName').addEventListener('click', function () {
    letters.forEach(function (b, i) { setTimeout(function () { jump(b); A.play('hop'); }, i * 110); });
  });
  var tilt = $('#tilt'), photo = tilt && $('.photo', tilt);
  if (photo && !reduce) {
    var onMove = function (e) {
      var r = tilt.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
      var x = (p.clientX - r.left) / r.width - .5, y = (p.clientY - r.top) / r.height - .5;
      photo.style.transform = 'rotateY(' + x * 14 + 'deg) rotateX(' + -y * 12 + 'deg)';
      photo.style.setProperty('--mx', (x + .5) * 100 + '%'); photo.style.setProperty('--my', (y + .5) * 100 + '%');
    };
    var reset = function () { photo.style.transform = ''; };
    tilt.addEventListener('mousemove', onMove);
    tilt.addEventListener('touchmove', onMove, { passive: true });
    tilt.addEventListener('mouseleave', reset); tilt.addEventListener('touchend', reset);
    tilt.addEventListener('pointerdown', function () { A.play('sparkle'); });
  }

  /* ===== tips: centang + progres ===== */
  var tipBtns = $$('.tip');
  tipBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var n = tipBtns.filter(function (x) { return x.getAttribute('aria-pressed') === 'true'; }).length;
      $('#tc').textContent = n === 5 ? 'Lengkap! Kamu siap daftar.' : 'Centang tips yang sudah kamu coba. ' + n + ' dari 5.';
      $('#tb').style.width = n * 20 + '%';
      A.play(on ? 'check' : 'tap');
      if (n === 5 && on && window.RhyoMascot) window.RhyoMascot.talk('Hebat! Tinggal daftar!', 2400, true);
    });
  });

  /* ===== tab kategori ===== */
  var tabs = $$('.tabs button'), panels = $$('.p');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
      panels.forEach(function (p) { p.classList.remove('on', 'entering'); });
      var p = $('#panel-' + t.dataset.tab); p.classList.add('on');
      $$('.c', p).forEach(function (c, i) { c.style.setProperty('--i', i); });
      p.classList.add('entering');
      setTimeout(function () { p.classList.remove('entering'); }, 800);
      A.play('tab');
    });
  });

  /* ===== FAQ ===== */
  $$('.qa__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.parentElement, open = !item.classList.contains('open');
      $$('.qa.open').forEach(function (o) { if (o !== item) { o.classList.remove('open'); $('.qa__q', o).setAttribute('aria-expanded', 'false'); } });
      item.classList.toggle('open', open); q.setAttribute('aria-expanded', open ? 'true' : 'false');
      A.play(open ? 'expand' : 'collapse');
    });
  });

  /* ===== salin kode referral / hashtag ===== */
  function copy(text) {
    var done = function () { A.play('copy'); toast('Disalin: ' + text); };
    var fallback = function () {
      var t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* abaikan */ }
      t.remove(); done();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  $$('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { copy(b.dataset.copy); }); });
  $$('.tag').forEach(function (t) { t.addEventListener('click', function () { copy(t.textContent.trim()); }); });

  /* ===== scrollbar bertema (bisa diseret, klik trek untuk lompat) ===== */
  var scr = $('#scr'), scrT = $('#scrT'), actT = 0, sDrag = null;
  function scrMetrics() {
    var dh = document.documentElement.scrollHeight, vh = innerHeight, tr = scr.clientHeight;
    var tl = Math.max(38, Math.min(tr, tr * vh / dh)), maxS = Math.max(1, dh - vh);
    return { dh: dh, vh: vh, tr: tr, tl: tl, maxS: maxS };
  }
  function scrUpdate() {
    var m = scrMetrics(), p = Math.min(1, Math.max(0, window.scrollY / m.maxS));
    scrT.style.height = m.tl + 'px';
    scrT.style.transform = 'translateY(' + ((m.tr - m.tl) * p).toFixed(1) + 'px)';
    scr.classList.toggle('off', m.dh <= m.vh + 2);
  }
  window.addEventListener('scroll', function () {
    scrUpdate(); scr.classList.add('act'); clearTimeout(actT);
    actT = setTimeout(function () { scr.classList.remove('act'); }, 700);
  }, { passive: true });
  window.addEventListener('resize', scrUpdate);
  if ('ResizeObserver' in window) new ResizeObserver(scrUpdate).observe(document.body);
  scrT.addEventListener('pointerdown', function (e) {
    e.preventDefault(); e.stopPropagation();
    var m = scrMetrics();
    sDrag = { id: e.pointerId, y0: e.clientY, s0: window.scrollY, m: m };
    scr.classList.add('drag'); try { scrT.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
    A.play('pickup');
  });
  scrT.addEventListener('pointermove', function (e) {
    if (!sDrag || e.pointerId !== sDrag.id) return;
    var m = sDrag.m, k = (e.clientY - sDrag.y0) / Math.max(1, m.tr - m.tl);
    window.scrollTo({ top: sDrag.s0 + k * m.maxS, behavior: 'instant' });
    e.preventDefault();
  });
  function scrEnd(e) { if (sDrag && e.pointerId === sDrag.id) { sDrag = null; scr.classList.remove('drag'); } }
  scrT.addEventListener('pointerup', scrEnd); scrT.addEventListener('pointercancel', scrEnd);
  scr.addEventListener('pointerdown', function (e) {
    if (e.target !== scr) return;
    var r = scr.getBoundingClientRect(), m = scrMetrics(), k = (e.clientY - r.top - m.tl / 2) / Math.max(1, m.tr - m.tl);
    window.scrollTo({ top: Math.max(0, Math.min(1, k)) * m.maxS, behavior: 'smooth' });
    A.play('tap');
  });
  scrUpdate();
})();
