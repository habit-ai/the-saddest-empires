/* The Saddest Empires — the book cut (film.html?cut=book).

   The whole film is one open book. It never moves, so the eye always knows where to look:
   - the LEFT page holds the words, always in the same column;
   - the RIGHT page holds a framed plate, where the illustration lives;
   - words are written into the page, held long enough to read, then sink into the paper and vanish,
     the way ink does in Tom Riddle's diary. Plates dissolve into the page the same way.

   defineBook(lib) is called by film.js once assets and fonts are ready. */
window.defineBook = function (L) {
  const { W, H, PI, TAU, clamp, lerp, seg, ease, easeOut, rng, mk, IMG, PAPER, Etch, hatch, ellipsePts, rect, candle } = L;

  /* ------------------------------------------------------------ the book's fixed geometry */
  const BOOK = { x: 96, y: 58, w: 1728, h: 964 };
  const GUTTER = W / 2;
  const PAGE = { top: 78, bottom: 1002, lx: 116, rx: 1804 };
  const COL = { x: 214, w: 640, top: 250, bottom: 900 };          // the text column: the only place words appear
  const PLATE = { x: 1042, y: 150, w: 690, h: 770 };              // the plate: the only place pictures appear
  const INK = '#1d120b', GOLD_A = '#7a5208', GOLD_B = '#b8841c';

  /* ------------------------------------------------------------ the book, drawn once */
  let base;
  function buildBase() {
    base = mk(); const c = base.getContext('2d');
    // the desk
    c.fillStyle = '#17110c'; c.fillRect(0, 0, W, H);
    c.globalAlpha = 0.18; c.globalCompositeOperation = 'overlay'; c.drawImage(PAPER.dark, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // the page block: stacked edges, then the two pages
    c.fillStyle = 'rgba(0,0,0,.55)'; c.filter = 'blur(18px)'; c.fillRect(BOOK.x + 10, BOOK.y + 26, BOOK.w - 20, BOOK.h - 10); c.filter = 'none';
    c.fillStyle = '#5a3b22'; c.fillRect(BOOK.x - 6, BOOK.y - 4, BOOK.w + 12, BOOK.h + 12);       // the binding
    for (let k = 6; k >= 1; k--) {
      c.fillStyle = k % 2 ? '#d9ccb4' : '#cbbda4';
      c.fillRect(PAGE.lx - k * 2.2, PAGE.top + k * 1.6, PAGE.rx - PAGE.lx + k * 4.4, PAGE.bottom - PAGE.top + k * 1.2);
    }
    c.save(); c.beginPath(); c.rect(PAGE.lx, PAGE.top, PAGE.rx - PAGE.lx, PAGE.bottom - PAGE.top); c.clip();
    c.drawImage(PAPER.day, 0, 0);
    // the gutter: pages curve down into the binding
    const g = c.createLinearGradient(GUTTER - 170, 0, GUTTER + 170, 0);
    g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(0.42, 'rgba(60,40,20,.20)'); g.addColorStop(0.5, 'rgba(40,26,12,.55)');
    g.addColorStop(0.58, 'rgba(60,40,20,.20)'); g.addColorStop(1, 'rgba(60,40,20,0)');
    c.fillStyle = g; c.fillRect(GUTTER - 170, 0, 340, H);
    // outer edges, slightly aged
    const e = c.createLinearGradient(PAGE.lx, 0, PAGE.rx, 0);
    e.addColorStop(0, 'rgba(90,60,30,.22)'); e.addColorStop(0.06, 'rgba(90,60,30,0)'); e.addColorStop(0.94, 'rgba(90,60,30,0)'); e.addColorStop(1, 'rgba(90,60,30,.22)');
    c.fillStyle = e; c.fillRect(0, 0, W, H);
    c.restore();
    // the plate's engraved frame
    c.strokeStyle = 'rgba(40,24,14,.8)'; c.lineWidth = 1.6; c.strokeRect(PLATE.x - 14, PLATE.y - 14, PLATE.w + 28, PLATE.h + 28);
    c.lineWidth = 0.8; c.strokeRect(PLATE.x - 6, PLATE.y - 6, PLATE.w + 12, PLATE.h + 12);
    // running head on the right page, never changes
    c.font = '400 22px "IM Fell English SC"'; c.letterSpacing = '5px'; c.textAlign = 'center'; c.fillStyle = 'rgba(50,32,20,.75)';
    c.fillText('The Saddest Empires', PLATE.x + PLATE.w / 2, 116);
    c.letterSpacing = '0px'; c.textAlign = 'left';
  }

  /* ------------------------------------------------------------ setting text */
  const VOICES = {
    narrator: { font: (s, it) => `${it ? 'italic ' : ''}400 ${s}px "IM Fell English"` },
    quote: { font: (s, it) => `${it ? '' : 'italic '}400 ${s}px "IM Fell English"` },     // quotations run in italic
    hand: { font: (s) => `400 ${s}px "La Belle Aurore"` },
  };
  const scratch = mk(W, 260), sg = scratch.getContext('2d');
  // words with their styles, from markup: {gold}, *italic*, [small caps], and " / " for a hard break
  function tokens(text) {
    const out = []; const re = /(\{[^}]+\}|\*[^*]+\*|\[[^\]]+\])/g; let last = 0, m;
    const push = (s, st) => s.split(/(\s+)/).forEach((w, i) => {
      if (!w) return;
      const prev = out[out.length - 1];
      out.push({ t: w, ...st, glue: i === 0 && prev && !/^\s+$/.test(prev.t) && !/^\s/.test(w) });
    });
    while ((m = re.exec(text))) {
      if (m.index > last) push(text.slice(last, m.index), {});
      const inner = m[0].slice(1, -1);
      push(inner, m[0][0] === '{' ? { gold: true, italic: true } : m[0][0] === '*' ? { italic: true } : { sc: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) push(text.slice(last), {});
    return out;
  }
  const fontOf = (voice, size, tk) => tk.sc ? `400 ${size}px "IM Fell English SC"` : VOICES[voice].font(size, tk.italic);
  // wrap into lines that fit the column (each line may have its own width, for the initial)
  function wrap(text, voice, size, widthOf) {
    const lines = []; let cur = [], w = 0;
    const flush = () => { while (cur.length && /^\s+$/.test(cur[cur.length - 1].t)) cur.pop(); if (cur.length) lines.push(cur); cur = []; w = 0; };
    for (const tk of tokens(text)) {
      if (tk.t.trim() === '/') { flush(); continue; }
      sg.font = fontOf(voice, size, tk);
      const tw = sg.measureText(tk.t).width;
      if (/^\s+$/.test(tk.t)) { if (cur.length) { cur.push({ ...tk, w: tw }); w += tw; } continue; }
      if (cur.length && w + tw > widthOf(lines.length)) {
        const carry = [];
        if (tk.glue) { while (cur.length && !/^\s+$/.test(cur[cur.length - 1].t)) carry.unshift(cur.pop()); }
        flush(); carry.forEach((c2) => { cur.push(c2); w += c2.w; });
      }
      cur.push({ ...tk, w: tw }); w += tw;
    }
    flush();
    return lines;
  }
  function renderLine(toks, voice, size) {
    const pad = Math.round(size * 0.5), base = Math.round(size * 1.05);
    const width = toks.reduce((s, t) => s + t.w, 0);
    const c = mk(Math.ceil(width + pad * 2), Math.ceil(size * 1.45 + pad));
    const g = c.getContext('2d'); g.textBaseline = 'alphabetic'; g.fontKerning = 'normal';
    let x = pad;
    for (const tk of toks) {
      g.font = fontOf(voice, size, tk);
      if (tk.gold) {
        const gr = g.createLinearGradient(x, base - size, x + tk.w, base);
        gr.addColorStop(0, GOLD_A); gr.addColorStop(0.5, GOLD_B); gr.addColorStop(1, GOLD_A);
        g.fillStyle = gr;
      } else g.fillStyle = INK;
      g.fillText(tk.t, x, base); x += tk.w;
    }
    const blur = mk(c.width, c.height), b = blur.getContext('2d');
    b.filter = `blur(${Math.max(2, size * 0.07)}px)`; b.drawImage(c, 0, 0);
    // for the sinking: the letters' alpha, and a field of paper grain that eats them
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const r = rng(c.width * 7 + c.height), noise = new Float32Array(c.width * c.height);
    for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
      noise[yy * c.width + xx] = 0.55 * r() + 0.45 * (0.5 + 0.5 * Math.sin(xx * 0.11 + Math.sin(yy * 0.07) * 3) * Math.sin(yy * 0.13 + xx * 0.02));
    }
    return { c, blur, img, noise, pad, base, width };
  }
  // draw a set line: written left to right (p), then sunk into the paper (k)
  function drawLine(c, Ln, x, baseline, p, k, pen) {
    if (p <= 0) return;
    const { c: img, blur, pad, base, width } = Ln;
    const dx = x - pad, dy = baseline - base;
    if (k > 0) {
      // the diary: the ink darkens and spreads for a moment, then the grain of the paper takes it
      const bleed = Math.sin(clamp(k / 0.35) * PI) * 0.45;
      if (bleed > 0.01) { c.globalAlpha = bleed; c.drawImage(blur, dx, dy); c.globalAlpha = 1; }
      const th = clamp((k - 0.12) / 0.88);
      if (th >= 1) return;
      const src = Ln.img.data, out = sg.createImageData(img.width, img.height), o = out.data, n = Ln.noise;
      for (let i = 0, j = 0; i < n.length; i++, j += 4) {
        const a = src[j + 3]; if (!a) continue;
        const keep = clamp((n[i] - th) / 0.12);
        o[j] = src[j]; o[j + 1] = src[j + 1]; o[j + 2] = src[j + 2]; o[j + 3] = a * keep * (1 - th * 0.35);
      }
      sg.clearRect(0, 0, img.width, img.height); sg.putImageData(out, 0, 0);
      c.drawImage(scratch, 0, 0, img.width, img.height, dx, dy, img.width, img.height);
      return;
    }
    // writing: a narrow wet edge travelling along the line
    const edge = pen ? 26 : 70;
    const pos = pad + lerp(-edge * 0.3, width + edge, p);
    const mask = (src, stops, alpha) => {
      sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, img.width, img.height); sg.drawImage(src, 0, 0);
      sg.globalCompositeOperation = 'destination-in';
      const gr = sg.createLinearGradient(0, 0, img.width, 0);
      stops.forEach(([v, a]) => gr.addColorStop(clamp(v / img.width), `rgba(0,0,0,${a})`));
      sg.fillStyle = gr; sg.fillRect(0, 0, img.width, img.height); sg.globalCompositeOperation = 'source-over';
      c.globalAlpha = alpha; c.drawImage(scratch, 0, 0, img.width, img.height, dx, dy, img.width, img.height); c.globalAlpha = 1;
    };
    mask(img, [[0, 1], [Math.max(0, pos - edge), 1], [pos, 0]], 1);
    if (p < 1) mask(blur, [[Math.max(0, pos - edge * 1.6), 0], [Math.max(0, pos - edge * 0.5), 1], [pos + edge * 0.1, 0]], pen ? 0.5 : 0.8);
  }

  const LINES = [], MARKS = [];
  let sceneIdx = 0;
  // a passage: set in the column, written line by line, held, then sunk
  function passage(o) {
    const P = Object.assign({ voice: 'narrator', size: 54, lh: 1.36, align: 'left', hold: null, top: COL.top }, o);
    const pace = P.voice === 'hand' ? 0.065 : 0.042;
    const indentFor = (i) => (P.initial && i < 3 ? P.initial.w + 22 : 0);
    const lines = wrap(P.text, P.voice, P.size, (i) => COL.w - indentFor(i));
    P.lines = lines.map((toks, i) => ({ L: renderLine(toks, P.voice, P.size), chars: toks.reduce((s, t) => s + t.t.length, 0), gold: toks.some((t) => t.gold), indent: indentFor(i) }));
    let t = P.at;
    P.lines.forEach((ln) => {
      ln.at = t; ln.dur = clamp(ln.chars * pace, 0.8, P.voice === 'hand' ? 3.6 : 2.6);
      t += ln.dur + 0.28;
      LINES.push({ sceneIdx, t: ln.at + ln.dur * 0.6, start: ln.at, dur: ln.dur, voice: P.voice, gold: ln.gold });
    });
    P.written = t - 0.28;
    const words = P.text.split(/\s+/).length;
    P.sinkAt = P.written + (P.hold ?? Math.max(2.0, words * 0.2));
    P.gone = P.sinkAt + 0.15 * (P.lines.length - 1) + 1.4;
    const blockH = P.lines.length * P.size * P.lh;
    P.y0 = P.valign === 'middle' ? (COL.top + COL.bottom) / 2 - blockH / 2 : P.top;
    return P;
  }
  function drawPassage(c, P, t) {
    if (t < P.at || t > P.gone) return;
    P.lines.forEach((ln, i) => {
      const p = P.voice === 'hand' ? clamp((t - ln.at) / ln.dur) : ease(seg(t, ln.at, ln.at + ln.dur));
      const k = seg(t, P.sinkAt + i * 0.15, P.sinkAt + i * 0.15 + 1.25);
      const w = ln.L.width;
      const x = P.align === 'center' ? COL.x + (COL.w - w) / 2 : COL.x + ln.indent;
      const baseline = P.y0 + P.size * 1.0 + i * P.size * P.lh;
      drawLine(c, ln.L, x, baseline, p, k, P.voice === 'hand');
    });
    if (P.initial) {
      const I = P.initial, k = seg(t, P.sinkAt, P.sinkAt + 1.5), a = ease(seg(t, P.at - 0.6, P.at + 0.6)) * (1 - k);
      if (a > 0) {
        const x = COL.x, y = P.y0 + 8, s = I.w;
        c.save(); c.globalAlpha = a;
        c.strokeStyle = 'rgba(122,82,8,.9)'; c.lineWidth = 1.4; c.strokeRect(x, y, s, s); c.lineWidth = 0.7; c.strokeRect(x + 7, y + 7, s - 14, s - 14);
        new Etch().addAll(hatch([[x + 10, y + 10], [x + s - 10, y + 10], [x + s - 10, y + s - 10], [x + 10, y + s - 10]], 45, 8, 0, 3), 0.5, 0.18).draw(c, 1, 'rgba(122,82,8,.9)');
        c.font = `700 ${Math.round(s * 0.78)}px "Cinzel Decorative"`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        const gr = c.createLinearGradient(x, y, x + s, y + s); gr.addColorStop(0, GOLD_A); gr.addColorStop(0.5, '#d2a041'); gr.addColorStop(1, GOLD_A);
        c.fillStyle = gr; c.fillText(I.letter, x + s / 2, y + s * 0.8);
        c.restore(); c.textAlign = 'left';
      }
    }
  }
  // small capitals on the page (running heads, sources, captions)
  function smallcaps(c, text, x, y, size, alpha, align = 'left', spacing = 4) {
    if (alpha <= 0) return;
    c.font = `400 ${size}px "IM Fell English SC"`; c.letterSpacing = spacing + 'px'; c.textAlign = align; c.textBaseline = 'alphabetic';
    c.fillStyle = `rgba(45,28,18,${0.8 * alpha})`; c.fillText(text, x, y);
    c.letterSpacing = '0px'; c.textAlign = 'left';
  }

  /* ------------------------------------------------------------ plates */
  const plate = mk(PLATE.w, PLATE.h), pg = plate.getContext('2d');
  const plateNoise = (() => {
    const r = rng(17), a = new Float32Array(PLATE.w * PLATE.h);
    for (let y = 0; y < PLATE.h; y++) for (let x = 0; x < PLATE.w; x++) a[y * PLATE.w + x] = 0.85 * r() + 0.15 * (0.5 + 0.5 * Math.sin(x * 0.05 + y * 0.02));
    return a;
  })();
  // composite the plate onto the page: printed (multiply), appearing, then sinking into the paper
  function printPlate(c, appear, sink) {
    if (appear <= 0 || sink >= 1) return;
    if (sink > 0) {
      const th = clamp(sink), img = pg.getImageData(0, 0, PLATE.w, PLATE.h), d = img.data;
      for (let i = 0, j = 0; i < plateNoise.length; i++, j += 4) {
        const keep = clamp((plateNoise[i] - th) / 0.14);
        d[j] = 255 - (255 - d[j]) * keep; d[j + 1] = 255 - (255 - d[j + 1]) * keep; d[j + 2] = 255 - (255 - d[j + 2]) * keep;
      }
      pg.putImageData(img, 0, 0);
    }
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = appear * (1 - 0.6 * sink);
    c.drawImage(plate, PLATE.x, PLATE.y); c.restore();
  }
  const clearPlate = () => { pg.setTransform(1, 0, 0, 1, 0, 0); pg.globalAlpha = 1; pg.globalCompositeOperation = 'source-over'; pg.filter = 'none'; pg.fillStyle = '#fff'; pg.fillRect(0, 0, PLATE.w, PLATE.h); };

  /* ------------------------------------------------------------ light */
  function light(c, mood, t) {
    c.save();
    if (mood === 'dawn') {                                   // before dawn: cool, the book barely lit
      c.globalCompositeOperation = 'multiply';
      const g = c.createRadialGradient(W * 0.42, H * 0.5, 200, W * 0.5, H * 0.5, 1150);
      g.addColorStop(0, 'rgb(222,224,236)'); g.addColorStop(1, 'rgb(40,42,60)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    } else if (mood === 'night') {                            // night: one warm pool of candlelight
      c.globalCompositeOperation = 'multiply';
      const fl = 1 + 0.015 * Math.sin(t * 7) + 0.01 * Math.sin(t * 13);
      const g = c.createRadialGradient(W * 0.36, H * 0.46, 120 * fl, W * 0.45, H * 0.5, 1180 * fl);
      g.addColorStop(0, 'rgb(255,236,204)'); g.addColorStop(0.55, 'rgb(170,128,90)'); g.addColorStop(1, 'rgb(22,14,10)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    } else {                                                  // day: soft light from the upper left
      c.globalCompositeOperation = 'multiply';
      const g = c.createRadialGradient(W * 0.38, H * 0.3, 300, W * 0.5, H * 0.5, 1250);
      g.addColorStop(0, 'rgb(255,252,246)'); g.addColorStop(1, mood === 'first' ? 'rgb(150,145,140)' : 'rgb(120,96,72)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    c.restore();
  }

  /* ============================================================ the story, in five chapters */
  const SC = [];
  const chapterName = ['I · The Morning', 'II · The Line', 'III · The Gap', 'IV · The Letter', 'V · The Crown'];
  let chapter = -1;
  function scene(o) { o.idx = SC.length; o.chapter = chapter; SC.push(o); sceneIdx = SC.length; return o; }
  const mark = (name, t, extra = {}) => MARKS.push(Object.assign({ sceneIdx, name, t }, extra));

  function card(n, numeral, title, mood) {
    chapter = n; sceneIdx = SC.length;
    mark('card', 0.3, { numeral });
    scene({ d: 5.2, mood, turn: true, draw(c, t) {
      const a = ease(seg(t, 0.6, 1.8)), k = seg(t, 3.4, 4.9);
      const cx = COL.x + COL.w / 2;
      c.save(); c.globalAlpha = a * (1 - k);
      c.font = '700 150px "Cinzel Decorative"'; c.textAlign = 'center';
      const gr = c.createLinearGradient(cx - 90, 330, cx + 90, 480); gr.addColorStop(0, GOLD_A); gr.addColorStop(0.5, '#cf9d3e'); gr.addColorStop(1, GOLD_A);
      c.fillStyle = gr; c.fillText(numeral, cx, 520);
      c.restore(); c.textAlign = 'left';
      smallcaps(c, title, cx, 620, 44, ease(seg(t, 1.2, 2.4)) * (1 - k), 'center', 9);
      const rl = ease(seg(t, 1.0, 2.2)) * (1 - k);
      c.strokeStyle = `rgba(60,40,24,${0.6 * rl})`; c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx - 170 * rl, 565); c.lineTo(cx + 170 * rl, 565); c.stroke();
    } });
  }

  // I · The Morning
  card(0, 'I', 'The Morning', 'dawn');
  {
    sceneIdx = SC.length;
    const m1 = passage({ at: 1.4, size: 56, initial: { letter: 'T', w: 56 * 1.36 * 3 - 10 }, text: '[here is] a particular kind of morning that belongs to {2026} and no other year in the history of the species.' });
    const m2 = passage({ at: m1.gone + 0.3, size: 56, text: 'You speak a few sentences *into the dark* — and somewhere, in a place that is not a place, something that is not a person begins to build for you.' });
    const m3 = passage({ at: m2.gone + 0.3, size: 56, text: 'You did not earn this. / You are not dressed.', hold: 2.8 });
    mark('initial', 0.8);
    const d = m3.gone + 0.8, buildAt = m2.at + 3;
    scene({ d, mood: 'dawn', plate: [0.2, 1.6, d - 2.0, d - 0.3], passages: [m1, m2, m3], drawPlate(t) {
      // an engraved night: dense hatching, and the glow of a screen in a dark room
      pg.fillStyle = 'rgb(40,42,58)'; pg.fillRect(0, 0, PLATE.w, PLATE.h);
      pg.strokeStyle = 'rgba(12,12,22,.55)'; pg.lineWidth = 1;
      for (let y = 2; y < PLATE.h; y += 4) { pg.beginPath(); pg.moveTo(0, y); pg.lineTo(PLATE.w, y); pg.stroke(); }
      const gx = PLATE.w / 2, gy = 560, pulse = 1 + 0.03 * Math.sin(t * 2);
      const gl = pg.createRadialGradient(gx, gy, 0, gx, gy, 360 * pulse);
      gl.addColorStop(0, 'rgba(236,240,250,.95)'); gl.addColorStop(0.28, 'rgba(160,170,200,.45)'); gl.addColorStop(1, 'rgba(40,42,58,0)');
      pg.fillStyle = gl; pg.fillRect(0, 0, PLATE.w, PLATE.h);
      pg.fillStyle = '#f4f6fb'; pg.fillRect(gx - 70, gy - 118, 140, 236);
      pg.strokeStyle = 'rgba(30,30,44,.9)'; pg.lineWidth = 2; pg.strokeRect(gx - 76, gy - 124, 152, 248);
      pg.fillStyle = 'rgba(30,30,44,.9)'; pg.fillRect(gx - 16, gy - 114, 32, 4);
      pg.fillStyle = 'rgba(120,130,160,.55)';
      for (let l = 0; l < 9; l++) pg.fillRect(gx - 52, gy - 88 + l * 20, 60 + ((l * 37) % 44), 5);
      // the spoken sentence leaves the screen, letter by letter, and becomes a building
      const letters = 'ascripttenpageanalysisadraftofsomethingyouhavebeenmeaningtowriteformonths', r = rng(31);
      pg.font = 'italic 34px "IM Fell English"'; pg.textBaseline = 'middle';
      for (let i = 0; i < 140; i++) {
        const born = m2.at + 0.4 + r() * 12, life = 3.2 + r() * 2, dx = (r() - 0.5) * 520, sway = r() * TAU;
        const q = (t - born) / life; if (q < 0 || q > 1) { r(); continue; }
        pg.globalAlpha = Math.sin(q * PI) * 0.85; pg.fillStyle = '#eef1fa';
        pg.fillText(letters[i % letters.length], gx + dx * easeOut(q) + Math.sin(t * 1.3 + sway) * 14, gy - 140 - q * 380); r();
      }
      pg.globalAlpha = 1;
      if (t > buildAt) {                                     // a palace, drawn in light, above the glow
        pg.save(); pg.translate(PLATE.w / 2, 190); pg.scale(0.44, 0.44); pg.translate(-W / 2, -540);
        L.FACADE.draw(pg, ease(seg(t, buildAt, buildAt + 9)), 'rgba(226,230,244,.9)');
        pg.restore();
      }
    } });
  }

  // II · The Line
  card(1, 'II', 'The Line', 'day');
  {
    sceneIdx = SC.length;
    const q = passage({ at: 1.2, voice: 'quote', size: 54, text: '“In an information-rich world, the wealth of information means a dearth of something else. / Hence a wealth of information creates a {poverty of attention.}”', hold: 3.4 });
    mark('dim', q.written - 1.0);
    const d = q.gone + 0.8;
    scene({ d, mood: 'day', plate: [0.2, 1.4, d - 2.0, d - 0.3], passages: [q], source: { text: 'Herbert Simon, 1971', at: q.written, until: q.sinkAt + 1.2 }, drawPlate(t) {
      candle(pg, PLATE.w / 2, 690, 400, t, 1 - 0.7 * seg(t, q.written - 1, q.sinkAt));
      const r = rng(77), N = Math.floor(Math.min(70, Math.exp(Math.max(0, t - 2.5) * 0.62)));
      for (let k = 0; k < N; k++) {
        let x = r() * PLATE.w, y = r() * PLATE.h * 0.9; const a = (r() - 0.5) * 0.7, w = 100 + r() * 60, h = w * 1.3;
        if (k < 18 && Math.abs(x - PLATE.w / 2) < 120 && y > 250) x = x < PLATE.w / 2 ? x - 220 : x + 220;
        const born = Math.log(k + 1) / 0.62 + 2.5, kk = easeOut(seg(t, born, born + 0.35));
        pg.save(); pg.translate(x, y); pg.rotate(a); pg.globalAlpha = kk;
        pg.fillStyle = '#fbf8f2'; pg.fillRect(-w / 2, -h / 2, w, h); pg.strokeStyle = INK; pg.lineWidth = 1; pg.strokeRect(-w / 2, -h / 2, w, h);
        pg.globalAlpha = kk * 0.45; for (let l = 0; l < 9; l++) { pg.beginPath(); pg.moveTo(-w / 2 + 10, -h / 2 + 18 + l * (h - 30) / 9); pg.lineTo(w / 2 - 12 - r() * 26, -h / 2 + 18 + l * (h - 30) / 9); pg.stroke(); }
        pg.restore();
      }
    } });
  }
  {
    sceneIdx = SC.length;
    const l1 = passage({ at: 1.0, size: 56, text: 'He could not have imagined a world in which information is not merely present, but standing in a line' });
    const l2 = passage({ at: l1.gone + 0.3, size: 56, text: 'that stretches past the castle walls and over the horizon,' });
    const l3 = passage({ at: l2.gone + 0.3, size: 56, text: 'waiting for instructions you do not have {time to give.}', hold: 3.2 });
    const d = l3.gone + 0.8;
    mark('line', 0.3, { d });
    scene({ d, mood: 'day', plate: [0.2, 1.2, d - 2.0, d - 0.3], passages: [l1, l2, l3], drawPlate(t) {
      const p = seg(t, 0.5, d - 2.4), z = ease(seg(p, 0.04, 0.95));
      const lp = L.lineP;
      const visible = p < 0.08 ? 1 : Math.exp(lerp(0, Math.log(lp.o.count), Math.pow(easeOut(seg(p, 0.08, 0.92)), 1.6)));
      lp.set({ zoom: lerp(2.3, 1.0, z), focus: z, visible }); lp.draw();
      pg.drawImage(lp.canvas, 0, 0, PLATE.w, PLATE.h);
    } });
  }

  // III · The Gap
  card(2, 'III', 'The Gap', 'day');
  {
    sceneIdx = SC.length;
    const g1 = passage({ at: 1.0, size: 56, text: 'The first is the agony of not being known: a lifelong servant has brought you apple juice when you wanted orange —' });
    const g2 = passage({ at: g1.gone + 0.3, size: 56, text: 'is ninety percent of the way there,', hold: 2.4 });
    const g3 = passage({ at: g2.gone + 0.3, size: 56, text: 'which is somehow worse than fifty, because it reveals / {the shape of the gap.}', hold: 4.0 });
    const goldLn = g3.lines[g3.lines.length - 1];
    const apple = [g1.lines[2].at, g1.lines[2].at + 2.4], drain = [g1.sinkAt, g1.gone], o50 = [g2.at, g2.at + 1.4], o90 = [g2.written - 0.4, g2.written + 1.0];
    mark('pour', apple[0], { d: 2.4 }); mark('pour', o50[0], { d: 1.4 }); mark('pour', o90[0], { d: 1.4 });
    mark('gap', goldLn.at);
    const d = g3.gone + 0.8;
    scene({ d, mood: 'day', plate: [0.2, 1.2, d - 2.0, d - 0.3], passages: [g1, g2, g3], drawPlate(t) {
      const { G, GS, gX, gY, gP } = L;
      G.cx = PLATE.w / 2; pg.save(); pg.translate(0, -190);
      L.glassP.draw(pg, ease(seg(t, 0.2, 1.8)), INK);
      const BOT = 452, TOP = 186, lvl = (f) => lerp(BOT, TOP, f);
      const aF = ease(seg(t, ...apple)) - ease(seg(t, ...drain));
      const oF = 0.5 * ease(seg(t, ...o50)) + 0.4 * ease(seg(t, ...o90));
      const inside = gP([[214, 186], [232, 446], [300, 458], [368, 446], [386, 186]]);
      const fill = (f, col, line) => {
        if (f <= 0.001) return;
        pg.save(); pg.beginPath(); inside.forEach(([x, y], k) => (k ? pg.lineTo(x, y) : pg.moveTo(x, y))); pg.closePath(); pg.clip();
        const y = gY(lvl(f));
        pg.fillStyle = col; pg.fillRect(0, y, PLATE.w, 2000);
        pg.strokeStyle = line; pg.lineWidth = 1; pg.globalAlpha = 0.7;
        for (let yy = y + 3; yy < gY(460); yy += 5) { pg.beginPath(); pg.moveTo(gX(200), yy); pg.lineTo(gX(400), yy); pg.stroke(); }
        pg.globalAlpha = 1; pg.lineWidth = 1.6; pg.beginPath(); pg.ellipse(G.cx, y, lerp(68, 86, f) * GS, 10 * GS, 0, 0, TAU); pg.stroke();
        pg.restore();
      };
      fill(aF, 'rgb(230,220,150)', '#8f8424');
      fill(oF, 'rgb(242,170,100)', '#b8521a');
      const k = ease(seg(t, goldLn.at, goldLn.at + goldLn.dur + 0.4));
      if (k > 0) {
        pg.save(); pg.shadowColor = 'rgba(210,160,60,.8)'; pg.shadowBlur = 14;
        new Etch().add(gP(ellipsePts(300, 214, 84, 11, PI, PI * 3, 90)), 2.6).add(gP([[214, 186], [216, 214]]), 2.6).add(gP([[386, 186], [384, 214]]), 2.6).draw(pg, k, '#b8841c');
        pg.restore();
      }
      pg.restore(); G.cx = W / 2;
    } });
  }

  // IV · The Letter
  card(3, 'IV', 'The Letter', 'night');
  {
    sceneIdx = SC.length;
    const n0 = passage({ at: 1.2, size: 50, text: '*A friend sent this, late at night:*', hold: 1.2 });
    const h1 = passage({ at: n0.gone + 0.4, voice: 'hand', size: 60, lh: 1.5, text: 'Despite this, they pledge their undying loyalty and eternal labor to your cause.', hold: 1.6 });
    const h2 = passage({ at: h1.gone + 0.6, voice: 'hand', size: 84, lh: 1.4, valign: 'middle', align: 'center', text: 'But you have / {no cause.}', hold: 3.8 });
    mark('write', h1.at, { d: h1.written - h1.at }); mark('write', h2.at, { d: h2.written - h2.at });
    mark('silence', h2.written + 0.2, { d: 4.2 });
    const d = h2.gone + 1.2;
    scene({ d, mood: 'night', plate: [0.2, 1.6, h2.at - 1.6, h2.at + 0.2], passages: [n0, h1, h2], drawPlate(t) {
      // the ruins at night, the whole empire idle
      const img = IMG.ruins, sw = 857 * PLATE.w / PLATE.h, sx = 1000 - sw / 2 + Math.sin(t * 0.05) * 30;
      const zoom = lerp(1.1, 1.0, ease(clamp(t / 20)));
      pg.save(); pg.translate(PLATE.w / 2, PLATE.h / 2); pg.scale(zoom, zoom); pg.translate(-PLATE.w / 2, -PLATE.h / 2);
      pg.drawImage(img, sx, 0, sw, 857, 0, 0, PLATE.w, PLATE.h); pg.restore();
      pg.globalCompositeOperation = 'multiply'; pg.fillStyle = 'rgb(96,98,126)'; pg.fillRect(0, 0, PLATE.w, PLATE.h);
      pg.globalCompositeOperation = 'source-over';
    } });
  }

  // V · The Crown
  card(4, 'V', 'The Crown', 'first');
  {
    sceneIdx = SC.length;
    const k1 = passage({ at: 5.0, size: 58, text: 'The crown is on the floor. / It is heavy. / It was always going to be heavy.', hold: 2.6 });
    const k4 = passage({ at: k1.gone + 0.5, size: 92, valign: 'middle', align: 'center', text: '{Pick it up.}', hold: 4.2 });
    mark('land', 3.7); mark('pick', k4.at);
    const gleamAt = k4.written;
    const d = k4.gone + 1.0;
    scene({ d, mood: 'first', plate: [0.2, 1.2, d - 2.0, d - 0.3], passages: [k1, k4], drawPlate(t) {
      const s = 0.55, ox = PLATE.w / 2 - 455 * s, oy = PLATE.h - 90 - 1000 * s;
      pg.save(); pg.translate(ox, oy); pg.scale(s, s);
      pg.strokeStyle = INK; for (let i = 0; i < 12; i++) { pg.globalAlpha = 0.5 - i * 0.035; pg.lineWidth = 1.6; const y = 1000 + Math.pow(i, 1.5) * 5; pg.beginPath(); pg.moveTo(-600, y); pg.lineTo(2000, y); pg.stroke(); }
      pg.globalAlpha = 1;
      pg.drawImage(IMG.column, 340, 445, 720, 555);
      const tip = ease(seg(t, 1.6, 2.7)), fall = seg(t, 2.7, 3.7), settle = seg(t, 3.7, 4.5);
      let x = -22 * tip, y = -6 * tip, rot = -16 * tip;
      if (fall > 0) { x = lerp(-22, -420, easeOut(fall)); y = lerp(-6, 290, fall * fall); rot = lerp(-16, -94, easeOut(fall)); }
      if (settle > 0) { const b = Math.sin(settle * PI) * (1 - settle); x = -420 - 14 * easeOut(settle); y = 290 - 38 * b; rot = -94 + 4 * easeOut(settle) - 5 * b; }
      pg.fillStyle = `rgba(58,34,24,${0.25 * seg(t, 3.5, 4.5)})`; pg.beginPath(); pg.ellipse(70, 1004, 210, 16, 0, 0, TAU); pg.fill();
      pg.save(); pg.translate(440 + 250 + x, 93 + 392 + y); pg.rotate(rot * PI / 180);
      pg.globalAlpha = 0.8; pg.drawImage(IMG.crown, -250, -392, 500, 392); pg.globalAlpha = 1;
      pg.drawImage(L.GOLD_CROWN, -250, -392, 500, 392);
      const gl = seg(t, gleamAt - 0.3, gleamAt + 2.4);
      if (gl > 0 && gl < 1) { pg.globalCompositeOperation = 'lighter'; pg.globalAlpha = 0.55 * Math.sin(gl * PI); pg.drawImage(L.GOLD_CROWN, -250, -392, 500, 392); }
      pg.restore(); pg.restore();
    } });
  }

  // colophon
  chapter = 5; sceneIdx = SC.length;
  scene({ d: 7, mood: 'first', draw(c, t) {
    const cx = COL.x + COL.w / 2, a = (s) => ease(seg(t, s, s + 1.4)) * (1 - seg(t, 5.2, 6.8));
    smallcaps(c, 'The Saddest Empires', cx, 480, 46, a(0.4), 'center', 8);
    c.font = 'italic 400 34px "IM Fell English"'; c.textAlign = 'center'; c.fillStyle = `rgba(45,28,18,${0.85 * a(1.3)})`; c.fillText('an essay by Samuel Salzer', cx, 550);
    smallcaps(c, 'mmxxvi', cx, 610, 26, a(2.0), 'center', 8); c.textAlign = 'left';
  } });

  /* ------------------------------------------------------------ timeline + render */
  let acc = 0; SC.forEach((s) => { s.t0 = acc; acc += s.d; });
  const DURATION = acc;
  const out = document.getElementById('film').getContext('2d');
  const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx', 'xxi', 'xxii', 'xxiii', 'xxiv'];

  function render(T) {
    const s = SC.find((x) => T >= x.t0 && T < x.t0 + x.d) || SC[SC.length - 1];
    const t = T - s.t0;
    const c = out;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.drawImage(base, 0, 0);
    // running head (left page) and folios: the chapter stays named while it lasts
    if (s.chapter >= 0 && s.chapter < 5) smallcaps(c, chapterName[s.chapter], COL.x + COL.w / 2, 116, 22, 1, 'center', 5);
    c.font = 'italic 400 24px "IM Fell English"'; c.fillStyle = 'rgba(45,28,18,.7)';
    c.textAlign = 'left'; c.fillText(roman[(s.idx * 2) % 24], PAGE.lx + 40, PAGE.bottom - 34);
    c.textAlign = 'right'; c.fillText(roman[(s.idx * 2 + 1) % 24], PAGE.rx - 40, PAGE.bottom - 34); c.textAlign = 'left';
    // the plate
    if (s.drawPlate && s.plate) {
      const [a0, a1, s0, s1] = s.plate;
      clearPlate(); s.drawPlate(t);
      printPlate(c, ease(seg(t, a0, a1)), seg(t, s0, s1));
      const cap = ease(seg(t, a0 + 0.5, a1 + 0.5)) * (1 - seg(t, s0, s1));
      c.font = 'italic 400 24px "IM Fell English"'; c.textAlign = 'center'; c.fillStyle = `rgba(45,28,18,${0.75 * cap})`;
      c.fillText(`Plate ${['I', 'II', 'III', 'IV', 'V'][s.chapter]}.`, PLATE.x + PLATE.w / 2, PLATE.y + PLATE.h + 52); c.textAlign = 'left';
    }
    // the words
    if (s.passages) s.passages.forEach((P) => drawPassage(c, P, t));
    if (s.source) smallcaps(c, '— ' + s.source.text, COL.x + COL.w, 860, 26, ease(seg(t, s.source.at, s.source.at + 1.2)) * (1 - seg(t, s.source.until, s.source.until + 1.2)), 'right', 3);
    if (s.draw) s.draw(c, t);
    // a page turns at every chapter
    if (s.turn && t < 1.2) {
      const u = ease(clamp(t / 1.1)), x = lerp(PAGE.rx, PAGE.lx, u);
      const g = c.createLinearGradient(x - 220, 0, x + 60, 0);
      g.addColorStop(0, 'rgba(40,26,14,0)'); g.addColorStop(0.8, `rgba(40,26,14,${0.35 * Math.sin(u * PI)})`); g.addColorStop(1, 'rgba(40,26,14,0)');
      c.fillStyle = g; c.fillRect(PAGE.lx, PAGE.top, PAGE.rx - PAGE.lx, PAGE.bottom - PAGE.top);
    }
    light(c, s.mood, T);
    // grain, and fades at the very start and end
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.06; c.drawImage(L.GRAIN[Math.floor(T * 24) % 4], 0, 0, W, H);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    const fade = Math.min(seg(T, 0, 1.6), 1 - seg(T, DURATION - 2.2, DURATION));
    if (fade < 1) { c.globalAlpha = 1 - fade; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  }

  buildBase();
  const cues = () => ({
    cut: 'book', duration: DURATION,
    scenes: SC.map((s) => ({ t0: +s.t0.toFixed(3), d: s.d })),
    lines: LINES.map((l) => ({ t: +(SC[l.sceneIdx].t0 + l.t).toFixed(3), start: +(SC[l.sceneIdx].t0 + l.start).toFixed(3), dur: +l.dur.toFixed(3), voice: l.voice, gold: l.gold, scene: l.sceneIdx })),
    marks: MARKS.map((m) => Object.assign({}, m, { t: +(SC[m.sceneIdx].t0 + m.t).toFixed(3) })),
  });
  return { render, duration: DURATION, cues };
};
