/* Audio: efek suara sintesis (WebAudio) + musik latar generatif. Tanpa file audio eksternal. */
(function () {
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, sfxBus = null, musicBus = null;
  var musicOn = false, timer = null, step = 0, lastPlay = {};

  function init() {
    if (ctx || !AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  }
  function resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function tone(freq, dur, type, vol, when, bus, slide) {
    if (!ctx) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, when, hp) {
    if (!ctx) return;
    var t = ctx.currentTime + (when || 0);
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = ctx.createBufferSource(); s.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 1500;
    var g = ctx.createGain(); g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t);
  }

  var SFX = {
    tap:     function () { tone(660, .08, 'triangle', .28); tone(990, .07, 'sine', .15, .03); },
    hover:   function () { tone(1200, .04, 'sine', .07); },
    pop:     function () { tone(380, .14, 'sine', .35, 0, null, 900); },
    open:    function () { tone(520, .09, 'square', .12); tone(780, .12, 'square', .12, .07); },
    success: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, .22, 'triangle', .26, i * .08); }); },
    whoosh:  function () { noise(.35, .22, 0, 900); tone(220, .3, 'sawtooth', .06, 0, null, 700); },
    tab:     function () { tone(440, .06, 'square', .12); tone(880, .1, 'triangle', .2, .05); },
    expand:  function () { tone(300, .12, 'triangle', .22, 0, null, 600); },
    collapse:function () { tone(600, .12, 'triangle', .2, 0, null, 300); },
    copy:    function () { tone(988, .07, 'square', .14); tone(1318, .14, 'square', .14, .07); },
    gate:    function () { [392, 523, 659, 784, 1046].forEach(function (f, i) { tone(f, .3, 'triangle', .22, i * .07); }); noise(.5, .12, 0, 3000); },
    hop:     function () { tone(300, .18, 'sine', .35, 0, null, 780); },
    giggle:  function () { [900, 1100, 900, 1250].forEach(function (f, i) { tone(f, .06, 'sine', .2, i * .06); }); },
    sparkle: function () { [1500, 1900, 2300].forEach(function (f, i) { tone(f, .1, 'sine', .12, i * .05); }); },
    count:   function () { tone(1400, .02, 'square', .05); },
    check:   function () { tone(700, .07, 'triangle', .22); tone(1050, .12, 'triangle', .22, .06); },
    /* ----- permainan ----- */
    pickup:  function () { tone(520, .06, 'square', .12); tone(780, .08, 'triangle', .18, .04); },
    throw:   function () { noise(.25, .2, 0, 1200); tone(300, .2, 'sawtooth', .06, 0, null, 900); },
    bounce:  function () { tone(180, .1, 'sine', .35, 0, null, 90); },
    crack:   function () { noise(.12, .35, 0, 2500); tone(1800, .05, 'square', .1); },
    smash:   function () { noise(.45, .5, 0, 800); tone(140, .3, 'sawtooth', .25, 0, null, 50); tone(2400, .08, 'square', .08, .02); tone(1900, .1, 'square', .06, .06); },
    fix:     function () { [660, 880, 1175, 1568].forEach(function (f, i) { tone(f, .16, 'triangle', .2, i * .04); }); },
    zap:     function () { tone(900, .12, 'square', .14, 0, null, 1800); },
    punch:   function () { tone(160, .1, 'square', .35, 0, null, 60); noise(.08, .3, 0, 600); },
    hammer:  function () { tone(130, .16, 'square', .4, 0, null, 50); noise(.12, .4, 0, 500); },
    bonk:    function () { tone(220, .14, 'triangle', .4, 0, null, 110); },
    slam:    function () { noise(.5, .55, 0, 300); tone(90, .4, 'sine', .6, 0, null, 40); },
    dizzy:   function () { [700, 600, 500, 420].forEach(function (f, i) { tone(f, .14, 'sine', .16, i * .1); }); },
    ouch:    function () { tone(520, .14, 'square', .2, 0, null, 280); }
  };
  function play(name) {
    if (!SFX[name]) name = 'tap';
    if (!ctx) init();
    if (!ctx) return;
    var now = ctx.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.04) return; /* cegah tumpukan suara identik */
    lastPlay[name] = now;
    if (ctx.state === 'suspended') ctx.resume();
    try { SFX[name](); } catch (e) { /* abaikan */ }
  }

  /* ----- musik: progresi lembut Am - F - C - G ----- */
  var CH = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]];
  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  function musicStep() {
    if (!musicOn || !ctx) return;
    var bar = Math.floor(step / 8) % 4, ch = CH[bar], i = step % 8;
    var arp = [0, 1, 2, 3, 2, 1, 2, 1][i];
    tone(mtof(ch[arp] + 12), .42, 'triangle', .16, 0, musicBus);
    if (i === 0) {
      tone(mtof(ch[0] - 12), 1.8, 'sine', .3, 0, musicBus);
      ch.forEach(function (n) { tone(mtof(n), 1.9, 'sine', .07, 0, musicBus); });
    }
    if (i % 2 === 0) tone(mtof(ch[0]), .07, 'square', .02, 0, musicBus);
    if (i === 4) noise(.06, .04, 0, 6000);
    step++;
  }
  function setMusic(on) {
    init(); if (!ctx) return;
    resume();
    musicOn = !!on;
    var t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(on ? 0.5 : 0, t, 0.35);
    if (on && !timer) { timer = setInterval(musicStep, 330); musicStep(); }
    if (!on && timer) { clearInterval(timer); timer = null; }
    document.dispatchEvent(new CustomEvent('rhyo:music', { detail: on }));
  }

  window.RhyoAudio = {
    play: play, resume: resume, setMusic: setMusic,
    isMusic: function () { return musicOn; },
    unlock: function () { resume(); }
  };
})();
