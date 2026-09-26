/* The Saddest Empires — the film.
   A timeline of full-frame scenes on one 1920x1080 canvas. Everything is a pure function of time,
   so the recorder can render any frame exactly: window.FILM.render(seconds). */
(function () {
  const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

  const INK = '#2b1a12';
  const INK_RGB = '43,26,18';
  const MOON = '#e9dfcc';
  const GOLD = '#c9982e';

  const canvas = document.getElementById('film');
  const out = canvas.getContext('2d');
  const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const bufA = mk(), bufB = mk();

  /* ------------------------------------------------------------ assets */
  const IMG = {};
  const SRC = {
    paperSrc: '../img_crown.png', ruins: '../img_ruins.png', laptop: '../img_laptop.png',
    crown: 'assets/crown.png', column: 'assets/column.png', columnFill: 'assets/column-fill.png',
    s1: 'assets/servant-1.png', s2: 'assets/servant-2.png', s3: 'assets/servant-3.png',
    s4: 'assets/servant-4.png', s5: 'assets/servant-5.png', s6: 'assets/servant-6.png',
  };
  const loaded = Promise.all(Object.entries(SRC).map(([k, src]) => new Promise((res) => {
    const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.src = src;
  })));
  const SPR = () => [IMG.s1, IMG.s2, IMG.s3, IMG.s4, IMG.s5, IMG.s6];

  const TINTS = new Map();
  function tint(img, color) {
    const key = img.src + color;
    if (TINTS.has(key)) return TINTS.get(key);
    const c = mk(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    TINTS.set(key, c); return c;
  }
  function goldCrown() {
    const c = mk(IMG.crown.width, IMG.crown.height), g = c.getContext('2d');
    g.drawImage(IMG.crown, 0, 0);
    g.globalCompositeOperation = 'source-in';
    const gr = g.createLinearGradient(0, 0, c.width, c.height);
    gr.addColorStop(0, '#7a520c'); gr.addColorStop(0.45, '#d9a940'); gr.addColorStop(0.55, '#f6dc92'); gr.addColorStop(1, '#8a5e10');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /* ------------------------------------------------------------ paper, grain, vignette */
  const PAPER = {};
  function buildPaper() {
    const patch = mk(650, 857);
    patch.getContext('2d').drawImage(IMG.paperSrc, 1350, 0, 650, 857, 0, 0, 650, 857);
    const base = mk(), g = base.getContext('2d');
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 3; tx++) {
      g.save();
      g.translate(tx * 650 + (tx % 2 ? 650 : 0), ty * 857 + (ty % 2 ? 857 : 0));
      g.scale(tx % 2 ? -1 : 1, ty % 2 ? -1 : 1);
      g.drawImage(patch, 0, 0);
      g.restore();
    }
    const tone = (name, fn) => { const c = mk(), x = c.getContext('2d'); x.drawImage(base, 0, 0); fn(x); PAPER[name] = c; };
    const lighten = (x, a) => { x.globalCompositeOperation = 'screen'; x.fillStyle = `rgba(255,250,242,${a})`; x.fillRect(0, 0, W, H); };
    const mult = (x, col) => { x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H); };
    tone('day', (x) => lighten(x, 0.62));
    tone('dawn', (x) => { lighten(x, 0.45); mult(x, 'rgb(214,216,226)'); });
    tone('dusk', (x) => { lighten(x, 0.5); mult(x, 'rgb(246,224,196)'); });
    tone('first', (x) => { lighten(x, 0.62); mult(x, 'rgb(232,231,226)'); });
    tone('night', (x) => { mult(x, 'rgb(34,33,44)'); });
    tone('dark', (x) => { mult(x, 'rgb(22,24,36)'); });
  }
  const GRAIN = [];
  function buildGrain() {
    const r = rng(99);
    for (let k = 0; k < 4; k++) {
      const c = mk(480, 270), g = c.getContext('2d'), d = g.createImageData(480, 270);
      for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); GRAIN.push(c);
    }
  }
  function paper(c, name) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.drawImage(PAPER[name], 0, 0); }

  /* ------------------------------------------------------------ line work */
  const lenOf = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
  function ellipsePts(cx, cy, rx, ry, a0 = 0, a1 = TAU, n = 72) {
    const p = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p;
  }
  function hatch(poly, angleDeg, spacing, jitter = 0, seed = 1) {
    const a = angleDeg * PI / 180, ca = Math.cos(a), sa = Math.sin(a), r = rng(seed);
    const R = poly.map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca]);
    let y0 = Infinity, y1 = -Infinity; R.forEach(([, y]) => { y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const segs = [];
    for (let y = y0 + spacing / 2; y < y1; y += spacing) {
      const xs = [];
      for (let i = 0; i < R.length; i++) {
        const p = R[i], q = R[(i + 1) % R.length];
        if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const j = (r() - 0.5) * jitter;
        const A = [xs[i] + j, y], B = [xs[i + 1] - j, y];
        segs.push([[A[0] * ca - A[1] * sa, A[0] * sa + A[1] * ca], [B[0] * ca - B[1] * sa, B[0] * sa + B[1] * ca]]);
      }
    }
    return segs;
  }
  // An etching: an ordered list of strokes that can be drawn up to any fraction, like a hand working the plate.
  class Etch {
    constructor() { this.items = []; this.total = 0; }
    add(pts, w = 1.2, a = 1) { const L = lenOf(pts); this.items.push({ pts, w: w * 1.35, a, L, s: this.total }); this.total += L; return this; }
    addAll(list, w, a) { list.forEach((p) => this.add(p, w, a)); return this; }
    draw(c, f = 1, color = INK, alpha = 1) {
      const lim = this.total * clamp(f);
      c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const it of this.items) {
        if (it.s >= lim) break;
        const part = Math.min(1, (lim - it.s) / (it.L || 1));
        c.globalAlpha = alpha * it.a; c.lineWidth = it.w;
        c.beginPath(); c.moveTo(it.pts[0][0], it.pts[0][1]);
        let acc = 0; const stop = it.L * part;
        for (let i = 1; i < it.pts.length; i++) {
          const [x0, y0] = it.pts[i - 1], [x1, y1] = it.pts[i];
          const d = Math.hypot(x1 - x0, y1 - y0);
          if (acc + d >= stop) { const k = (stop - acc) / (d || 1); c.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); break; }
          c.lineTo(x1, y1); acc += d;
        }
        c.stroke();
      }
      c.globalAlpha = 1;
    }
  }
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];

  /* ------------------------------------------------------------ type */
  function words(c, text, x, y, o = {}) {
    // lays out and draws text word by word; returns nothing. o: t (local time since start), size, italic, font, color, width, stagger, align, alpha, halo
    const size = o.size || 50;
    const family = o.font === 'cinzel' ? '"Cinzel"' : '"Cormorant Garamond"';
    c.font = `${o.italic === false || o.font === 'cinzel' ? '' : 'italic '}${o.weight || 400} ${size}px ${family}`;
    if (o.tracking) c.letterSpacing = o.tracking + 'px'; else c.letterSpacing = '0px';
    const maxW = o.width || 1400, lh = size * (o.lh || 1.32);
    const ws = text.split(' '), lines = [[]];
    let lw = 0; const sp = c.measureText(' ').width;
    for (const w of ws) {
      const m = c.measureText(w).width;
      if (lines[lines.length - 1].length && lw + sp + m > maxW) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push([w, m]); lw += (lw ? sp : 0) + m;
    }
    const total = lines.length * lh;
    let i = 0;
    const t = o.t ?? 99, st = o.stagger ?? 0.045, fade = o.fade ?? 0.7, A = o.alpha ?? 1;
    c.textBaseline = 'middle';
    lines.forEach((ln, li) => {
      const w = ln.reduce((s, [, m]) => s + m, 0) + sp * (ln.length - 1);
      let xx = o.align === 'left' ? x : x - w / 2;
      const yy = y - total / 2 + lh * (li + 0.5);
      for (const [wd, m] of ln) {
        const k = easeOut(seg(t, i * st, i * st + fade));
        c.globalAlpha = k * A;
        if (o.halo) { c.shadowColor = o.halo; c.shadowBlur = o.haloBlur || 22; } else c.shadowBlur = 0;
        c.fillStyle = o.color || INK;
        c.fillText(wd, xx, yy + (1 - k) * 12);
        xx += m + sp; i++;
      }
    });
    c.shadowBlur = 0; c.globalAlpha = 1; c.letterSpacing = '0px';
  }
  // a caption shown between a and b (scene-local seconds)
  function cap(c, lt, a, b, text, o = {}) {
    if (lt < a || lt > b) return;
    const outA = 1 - seg(lt, b - (o.out ?? 0.7), b);
    words(c, text, o.x ?? CX, o.y ?? 945, Object.assign({ t: lt - a, alpha: outA, halo: o.night ? 'rgba(10,10,16,.9)' : 'rgba(246,239,227,.95)' }, o, { color: o.color || (o.night ? MOON : INK) }));
  }

  /* ------------------------------------------------------------ props */
  function candle(c, x, y, h, t, lit = 1, color = INK) {
    const w = h * 0.2;
    c.strokeStyle = color; c.lineWidth = 1.4;
    c.fillStyle = 'rgba(248,242,230,.9)'; c.fillRect(x - w / 2, y - h, w, h);
    c.strokeRect(x - w / 2, y - h, w, h);
    c.lineWidth = 0.8; c.globalAlpha = 0.6;
    for (let k = 0; k < 6; k++) { const xx = x + w / 2 - 2 - k * (w / 16); c.beginPath(); c.moveTo(xx, y - h + 4); c.lineTo(xx, y - 2); c.stroke(); }
    c.globalAlpha = 1;
    c.beginPath(); c.ellipse(x, y - h, w / 2, w / 7, 0, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + 1, y - h - h * 0.07); c.stroke();
    if (lit <= 0) return;
    const fl = 1 + 0.06 * Math.sin(t * 13 + x) + 0.04 * Math.sin(t * 29 + x * 0.3);
    const fh = h * 0.28 * fl * lit, fx = x + Math.sin(t * 7 + x) * 1.5, fy = y - h - h * 0.05;
    c.save();
    c.globalCompositeOperation = 'screen';
    const glow = c.createRadialGradient(fx, fy - fh * 0.4, 0, fx, fy - fh * 0.4, h * 1.4 * lit);
    glow.addColorStop(0, 'rgba(255,200,110,.45)'); glow.addColorStop(1, 'rgba(255,170,80,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(fx, fy - fh * 0.4, h * 1.4 * lit, 0, TAU); c.fill();
    c.restore();
    const fg = c.createRadialGradient(fx, fy - fh * 0.3, 0, fx, fy - fh * 0.4, fh * 0.8);
    fg.addColorStop(0, `rgba(255,252,230,${lit})`); fg.addColorStop(0.45, `rgba(255,200,90,${lit})`); fg.addColorStop(1, 'rgba(230,110,30,0)');
    c.fillStyle = fg;
    c.beginPath();
    c.moveTo(fx, fy - fh);
    c.bezierCurveTo(fx + fh * 0.32, fy - fh * 0.45, fx + fh * 0.28, fy, fx, fy);
    c.bezierCurveTo(fx - fh * 0.28, fy, fx - fh * 0.32, fy - fh * 0.45, fx, fy - fh);
    c.fill();
  }
  function sprite(c, img, x, yFeet, h, flip = false) {
    const w = img.width / img.height * h;
    if (flip) { c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(img, -w / 2, yFeet - h, w, h); c.restore(); }
    else c.drawImage(img, x - w / 2, yFeet - h, w, h);
  }
  const PIX = new Map();
  function pixelated(img, h, block) {
    const key = img.src + h + ':' + block;
    if (PIX.has(key)) return PIX.get(key);
    const w = Math.round(img.width / img.height * h);
    const small = mk(Math.max(1, Math.round(w / block)), Math.max(1, Math.round(h / block)));
    const g = small.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, small.width, small.height);
    const big = mk(w, h), b = big.getContext('2d'); b.imageSmoothingEnabled = false; b.drawImage(small, 0, 0, w, h);
    PIX.set(key, big); return big;
  }
  function push(c, lt, d, from = 1, to = 1.06, ox = CX, oy = CY) {
    const s = lerp(from, to, ease(clamp(lt / d)));
    c.translate(ox, oy); c.scale(s, s); c.translate(-ox, -oy);
  }
  function kenBurns(c, img, lt, d, s0, s1, fx0 = 0.5, fy0 = 0.5, fx1 = 0.5, fy1 = 0.5, filter) {
    const cover = Math.max(W / img.width, H / img.height);
    const k = ease(clamp(lt / d));
    const s = cover * lerp(s0, s1, k);
    const w = img.width * s, h = img.height * s;
    const fx = lerp(fx0, fx1, k), fy = lerp(fy0, fy1, k);
    c.save(); if (filter) c.filter = filter;
    c.drawImage(img, (W - w) * fx, (H - h) * fy, w, h);
    c.restore();
  }
  function stars(c, lt, n = 220, seed = 5, a = 1) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H * 0.9, big = r() < 0.07, tw = 0.55 + 0.45 * Math.sin(lt * (0.6 + r() * 1.5) + i);
      c.globalAlpha = a * (0.15 + r() * 0.5) * tw; c.fillStyle = MOON;
      if (big) { c.fillRect(x - 3, y - 0.4, 6, 0.8); c.fillRect(x - 0.4, y - 3, 0.8, 6); } else c.fillRect(x, y, 1.2, 1.2);
    }
    c.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ built etchings */
  let FACADE, TABLET, GLASS, MIRROR, WALL, DOOR, WHEEL_R = 300;
  function buildFacade() {
    const e = new Etch();
    const L = 330, R = 1590, base = 830;
    // steps
    [[base, 1300], [base + 22, 1360], [base + 44, 1420]].forEach(([y, w]) => e.add(rect(CX - w / 2, y, w, 22), 1.4));
    // columns
    const n = 8, colW = 58;
    for (let i = 0; i < n; i++) {
      const x = lerp(L + 70, R - 70, i / (n - 1));
      const top = 440, bot = base;
      e.add([[x - colW / 2, bot - 16], [x - colW / 2 + 5, top + 16]], 1.5);
      e.add([[x + colW / 2, bot - 16], [x + colW / 2 - 5, top + 16]], 1.5);
      for (let f = -1; f <= 1; f++) e.add([[x + f * 12, bot - 20], [x + f * 10, top + 20]], 0.8, 0.8);
      e.add(rect(x - colW / 2 - 8, bot - 16, colW + 16, 16), 1.2);
      e.add(rect(x - colW / 2 - 10, top, colW + 20, 16), 1.2);
      e.add(ellipsePts(x - colW / 2 - 6, top + 22, 9, 9, 0, TAU, 20), 1); e.add(ellipsePts(x + colW / 2 + 6, top + 22, 9, 9, 0, TAU, 20), 1);
    }
    // entablature + dentils
    e.add(rect(L, 370, R - L, 70), 1.5);
    e.add([[L, 395], [R, 395]], 1); e.add([[L, 418], [R, 418]], 1);
    for (let x = L + 8; x < R - 8; x += 22) e.add([[x, 370], [x, 382], [x + 11, 382], [x + 11, 370]], 0.8, 0.9);
    // pediment
    e.add([[L - 20, 370], [CX, 205], [R + 20, 370], [L - 20, 370]], 1.6);
    const tymp = [[L + 40, 358], [CX, 228], [R - 40, 358]];
    e.add([...tymp, tymp[0]], 1.1);
    e.addAll(hatch(tymp, 0, 7, 3, 3), 0.7, 0.55);
    // shading: right side of each column, back wall between columns
    for (let i = 0; i < n; i++) {
      const x = lerp(L + 70, R - 70, i / (n - 1));
      e.addAll(hatch([[x + 8, 460], [x + 24, 460], [x + 22, 814], [x + 8, 814]], 90, 4.2, 0, i), 0.6, 0.6);
    }
    e.addAll(hatch([[L + 20, 442], [R - 20, 442], [R - 20, base - 2], [L + 20, base - 2]], 0, 9, 6, 8).filter((s) => {
      const mx = (s[0][0] + s[1][0]) / 2; return true && mx;
    }), 0.5, 0.28);
    return e;
  }
  function buildTablet() {
    const e = new Etch();
    const x = CX - 620, y = 300, w = 1240, h = 470;
    e.add(rect(x, y, w, h), 2); e.add(rect(x + 18, y + 18, w - 36, h - 36), 1.1);
    e.add([[x + w, y], [x + w + 26, y + 20], [x + w + 26, y + h + 20], [x + 26, y + h + 20], [x, y + h]], 1.4);
    e.addAll(hatch([[x + w, y], [x + w + 26, y + 20], [x + w + 26, y + h + 20], [x + w, y + h]], 90, 4, 0, 2), 0.7, 0.7);
    e.addAll(hatch([[x, y + h], [x + w, y + h], [x + w + 26, y + h + 20], [x + 26, y + h + 20]], 0, 4, 0, 3), 0.7, 0.7);
    const r = rng(12);
    for (let i = 0; i < 40; i++) { const px = x + 40 + r() * (w - 80), py = y + 40 + r() * (h - 80); e.add([[px, py], [px + 8 + r() * 30, py + (r() - 0.5) * 4]], 0.6, 0.3); }
    return e;
  }
  // glass geometry in its SVG units, mapped to the frame
  const G = { cx: CX }; // the glass can be placed off-centre
  const GS = 1.55, gX = (x) => G.cx + (x - 300) * GS, gY = (y) => 575 + (y - 360) * GS;
  const gP = (pts) => pts.map(([x, y]) => [gX(x), gY(y)]);
  function buildGlass() {
    const e = new Etch();
    e.add(gP(ellipsePts(300, 500, 245, 46)), 1.6);
    e.add(gP(ellipsePts(300, 494, 228, 38)), 0.9);
    e.add(gP(ellipsePts(300, 500, 245, 46, 0, PI).map(([x, y]) => [x, y + 6])), 1.2);
    e.add(gP(ellipsePts(300, 186, 86, 14)), 1.6);
    e.add(gP([[214, 186], [232, 446]]), 1.6); e.add(gP([[386, 186], [368, 446]]), 1.6);
    e.add(gP(ellipsePts(300, 446, 68, 11, 0, PI)), 1.6);
    e.add(gP([[232, 446], [236, 470]]), 1); e.add(gP([[368, 446], [364, 470]]), 1);
    e.add(gP(ellipsePts(300, 470, 64, 10, 0, PI)), 1);
    e.add(gP([[232, 204], [246, 430]]), 0.8, 0.7); e.add(gP([[240, 204], [252, 420]]), 0.8, 0.5);
    e.addAll(hatch(gP([[372, 200], [384, 190], [366, 446], [356, 440]]), 90, 4, 0, 4), 0.6, 0.6);
    e.addAll(hatch(gP([[190, 480], [410, 480], [430, 505], [170, 505]]), 35, 5, 0, 5), 0.6, 0.45);
    return e;
  }
  function buildMirror() {
    const e = new Etch();
    const cx = CX, cy = 500, rx = 250, ry = 330;
    e.add(ellipsePts(cx, cy, rx + 70, ry + 70, -PI / 2, PI * 1.5, 160), 2);
    e.add(ellipsePts(cx, cy, rx + 52, ry + 52, -PI / 2, PI * 1.5, 160), 1.1);
    e.add(ellipsePts(cx, cy, rx + 18, ry + 18, -PI / 2, PI * 1.5, 160), 1.4);
    e.add(ellipsePts(cx, cy, rx, ry, -PI / 2, PI * 1.5, 160), 1.8);
    for (let i = 0; i < 90; i++) { // radial hatching in the frame band
      const a = (i / 90) * TAU - PI / 2, c1 = Math.cos(a), s1 = Math.sin(a);
      e.add([[cx + c1 * (rx + 22), cy + s1 * (ry + 22)], [cx + c1 * (rx + 48), cy + s1 * (ry + 48)]], 0.7, 0.55);
    }
    for (let i = 0; i < 44; i++) { const a = (i / 44) * TAU; e.add(ellipsePts(cx + Math.cos(a) * (rx + 61), cy + Math.sin(a) * (ry + 61), 4, 4, 0, TAU, 12), 0.9, 0.9); }
    // crest: two scrolls and a leaf on top
    e.add([[cx - 90, cy - ry - 72], [cx - 60, cy - ry - 118], [cx - 20, cy - ry - 110], [cx - 30, cy - ry - 88], [cx - 50, cy - ry - 96]], 1.3);
    e.add([[cx + 90, cy - ry - 72], [cx + 60, cy - ry - 118], [cx + 20, cy - ry - 110], [cx + 30, cy - ry - 88], [cx + 50, cy - ry - 96]], 1.3);
    e.add([[cx, cy - ry - 72], [cx - 14, cy - ry - 120], [cx, cy - ry - 150], [cx + 14, cy - ry - 120], [cx, cy - ry - 72]], 1.3);
    return e;
  }
  function buildWall() {
    const e = new Etch(), r = rng(21);
    for (let row = 0, y = 40; y < H + 60; y += 58, row++) {
      e.add([[0, y], [W, y]], 1.1, 0.8);
      for (let x = (row % 2) * 80 - 80; x < W; x += 160) {
        e.add([[x, y], [x, y + 58]], 1.1, 0.8);
        if (r() < 0.45) e.addAll(hatch([[x + 6, y + 6], [x + 150, y + 6], [x + 150, y + 52], [x + 6, y + 52]], 30 + r() * 30, 7 + r() * 4, 4, row * 100 + x), 0.6, 0.35);
      }
    }
    return e;
  }
  function doorPath() {
    const w = 300, bot = 1010, spring = 590, p = [[CX - w / 2, bot], [CX - w / 2, spring]];
    ellipsePts(CX, spring, w / 2, w / 2, PI, TAU, 40).forEach((q) => p.push(q));
    p.push([CX + w / 2, bot]);
    return p;
  }

  /* ------------------------------------------------------------ line scenes (reusing the essay's renderer) */
  let lineA, lineB;
  function drawLine(c, scene, state, mode = 'day', alpha = 1) {
    scene.set(state); scene.draw();
    c.save(); c.globalAlpha = alpha;
    if (mode === 'night') { c.filter = 'invert(1) sepia(.35) brightness(.95)'; c.globalCompositeOperation = 'screen'; }
    else c.globalCompositeOperation = 'multiply';
    c.drawImage(scene.canvas, 0, 0);
    c.restore();
  }
  function roman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let o = ''; for (const [v, s] of map) while (n >= v) { o += s; n -= v; } return o;
  }

  /* ============================================================ SCENES */
  const S = [];
  const scene = (d, draw, o = {}) => S.push(Object.assign({ d, draw }, o));

  // 1 · the morning, in the dark
  scene(9.5, (c, t) => {
    paper(c, 'dark'); stars(c, t, 180, 3, 0.8);
    // the glow of a screen in a dark room
    const gx = CX, gy = 820, pulse = 1 + 0.03 * Math.sin(t * 2);
    c.save(); c.globalCompositeOperation = 'screen';
    const gl = c.createRadialGradient(gx, gy, 0, gx, gy, 420 * pulse);
    gl.addColorStop(0, 'rgba(170,190,230,.55)'); gl.addColorStop(0.3, 'rgba(90,110,160,.18)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    c.restore();
    c.fillStyle = 'rgba(210,222,245,.9)'; c.fillRect(gx - 34, gy - 58, 68, 116);
    c.strokeStyle = MOON; c.lineWidth = 1.2; c.strokeRect(gx - 38, gy - 62, 76, 124);
    // the spoken sentence rises as letters into the dark
    const letters = 'ascripttenpageanalysisadraftofsomethingyouhavebeenmeaningtowriteformonths';
    const r = rng(31);
    c.font = 'italic 30px "Cormorant Garamond"'; c.textBaseline = 'middle';
    for (let i = 0; i < 150; i++) {
      const born = 3.2 + r() * 5.5, life = 3 + r() * 2, dx = (r() - 0.5) * 900, sway = r() * TAU;
      const k = (t - born) / life; if (k < 0 || k > 1) { r(); continue; }
      const x = gx + dx * easeOut(k) + Math.sin(t * 1.3 + sway) * 20, y = gy - 70 - k * 620;
      c.globalAlpha = Math.sin(k * PI) * 0.85; c.fillStyle = MOON;
      c.fillText(letters[i % letters.length], x, y); r();
    }
    c.globalAlpha = 1;
    cap(c, t, 0.8, 5.2, 'There is a particular kind of morning that belongs to 2026 and no other year in the history of the species.', { night: true, y: 330, size: 50, width: 1200 });
    cap(c, t, 5.4, 9.5, 'You speak a few sentences into the dark —', { night: true, y: 330, size: 50 });
  }, { tone: 'dark' });

  // 2 · a palace builds itself
  scene(12, (c, t, d) => {
    paper(c, 'dawn');
    c.save(); push(c, t, d, 1.0, 1.05, CX, 560);
    FACADE.draw(c, ease(seg(t, 0.4, 9.2)), INK);
    c.restore();
    cap(c, t, 0.6, 4.4, '…and somewhere, in a place that is not a place, something that is not a person begins to build for you.', { width: 1300 });
    cap(c, t, 4.6, 8.2, 'By the time you stand up it may already be finished.');
    cap(c, t, 8.4, 12, 'You did not earn this.  You are not dressed.');
  });

  // 3 · title
  scene(7, (c, t) => {
    paper(c, 'day');
    FACADE.draw(c, 1, INK, 0.07);
    words(c, 'THE SADDEST', CX, 470, { t: t - 0.3, size: 110, font: 'cinzel', tracking: 14, stagger: 0.25, fade: 1.4 });
    // gilt EMPIRES with a moving sheen
    const k = easeOut(seg(t, 1.0, 2.6));
    c.save(); c.font = '110px "Cinzel"'; c.letterSpacing = '14px'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const g = c.createLinearGradient(CX - 500 + (t - 1) * 180, 0, CX + (t - 1) * 180, 0);
    g.addColorStop(0, '#8a5e10'); g.addColorStop(0.42, '#c8962e'); g.addColorStop(0.5, '#e9c56a'); g.addColorStop(0.58, '#c8962e'); g.addColorStop(1, '#8a5e10');
    c.fillStyle = g; c.globalAlpha = k; c.fillText('EMPIRES', CX, 600 + (1 - k) * 14);
    c.restore(); c.letterSpacing = '0px';
    words(c, 'On sovereignty, servantdom, and the strange burden of infinite intelligence at your fingertips', CX, 745, { t: t - 2.4, size: 34, width: 900, color: '#6a5242' });
  });

  // 4 · Marcus Aurelius and the tablet
  scene(10.5, (c, t, d) => {
    paper(c, 'day');
    c.save(); push(c, t, d, 1.02, 1.07);
    TABLET.draw(c, ease(seg(t, 0.2, 2.2)), INK);
    // letters chiselled one by one
    const lines = ['ASK YOURSELF AT EVERY MOMENT:', 'IS THIS NECESSARY?'];
    c.font = '56px "Cinzel"'; c.letterSpacing = '0px'; c.textBaseline = 'middle';
    let n = 0; const per = 0.075, start = 2.4;
    lines.forEach((ln, li) => {
      const y = 480 + li * 110;
      const w = [...ln].reduce((a, ch) => a + c.measureText(ch).width + 6, -6); let x = CX - w / 2;
      for (const ch of ln) {
        const k = seg(t, start + n * per, start + n * per + 0.25);
        if (k > 0) {
          c.globalAlpha = k;
          c.fillStyle = 'rgba(255,250,240,.9)'; c.fillText(ch, x + 2, y + 2);
          c.fillStyle = INK; c.fillText(ch, x, y);
        }
        x += c.measureText(ch).width + 6; n++;
      }
    });
    c.globalAlpha = 1; c.letterSpacing = '0px';
    c.restore();
    cap(c, t, 0.4, 5.2, 'Marcus Aurelius, who governed a third of the world, wrote himself private reminders about how not to waste the day.', { y: 170, size: 38, width: 1250 });
    cap(c, t, 5.4, 10.5, '“Because most of what we say and do is not essential.”', { y: 170, size: 40 });
  });

  // 5 · eight tabs, eight abandoned wings
  scene(10, (c, t) => {
    paper(c, 'day');
    const labels = ['draft', 'analysis', 'script', 'dashboard', 'essay', 'app', 'plan', 'email'];
    const r = rng(8);
    labels.forEach((lb, i) => {
      const x0 = 150 + i * 205, born = 0.4 + i * 0.45;
      const k = easeOut(seg(t, born, born + 0.35));
      if (k <= 0) return;
      // a flat, modern browser tab: no texture, no hand
      c.globalAlpha = k;
      c.fillStyle = i === 7 ? '#ffffff' : '#e9e6e1';
      c.beginPath(); c.moveTo(x0, 150); c.lineTo(x0 + 14, 110); c.lineTo(x0 + 186, 110); c.lineTo(x0 + 200, 150); c.closePath(); c.fill();
      c.fillStyle = '#5b5b5b'; c.font = '20px -apple-system, "Helvetica Neue", Arial, sans-serif'; c.textBaseline = 'middle';
      c.fillText(lb, x0 + 30, 131); c.fillText('×', x0 + 168, 131);
      // under each tab, a wing of the palace that starts and stops
      const stopAt = 0.25 + r() * 0.55, grow = seg(t, born + 0.3, born + 2.2) * stopAt;
      const abandon = seg(t, born + 3.2, born + 4.4);
      const cx = x0 + 100, base = 900, top = 330;
      const e = new Etch();
      e.add(rect(cx - 70, base - 14, 140, 14), 1.2);
      e.add([[cx - 26, base - 14], [cx - 22, top]], 1.4); e.add([[cx + 26, base - 14], [cx + 22, top]], 1.4);
      e.add([[cx - 8, base - 18], [cx - 7, top + 10]], 0.8, 0.7); e.add([[cx + 8, base - 18], [cx + 7, top + 10]], 0.8, 0.7);
      e.add(rect(cx - 36, top - 14, 72, 14), 1.2);
      e.add(rect(cx - 80, top - 60, 160, 46), 1.4);
      e.addAll(hatch([[cx + 6, top + 6], [cx + 22, top + 6], [cx + 22, base - 20], [cx + 6, base - 20]], 90, 4.5, 0, i), 0.6, 0.6);
      e.draw(c, grow, INK, lerp(1, 0.28, abandon) * k);
      c.globalAlpha = 1;
    });
    cap(c, t, 0.6, 5, 'A person in 2026, staring at the eighth tab they’ve opened —');
    cap(c, t, 5.2, 10, 'each one a half-finished delegation, each one an abandoned wing of a palace they are building for no one.', { width: 1300 });
  });

  // 6 · ruins
  scene(6.5, (c, t, d) => {
    kenBurns(c, IMG.ruins, t, d, 1.18, 1.0, 0.5, 0.35, 0.5, 0.55);
  });

  // 7 · an older physics
  scene(6.5, (c, t) => {
    paper(c, 'day');
    ['SERVANT', 'TOOL', 'ASSISTANT'].forEach((w, i) => {
      const y = 360 + i * 150, k = easeOut(seg(t, 0.3 + i * 0.5, 1.1 + i * 0.5));
      c.globalAlpha = k * (1 - 0.55 * seg(t, 3.2 + i * 0.35, 3.8 + i * 0.35));
      c.font = '92px "Cinzel"'; c.letterSpacing = '12px'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK;
      c.fillText(w, CX, y);
      const wd = c.measureText(w).width, s = ease(seg(t, 2.8 + i * 0.35, 3.3 + i * 0.35));
      if (s > 0) { c.strokeStyle = '#8c2f1c'; c.lineWidth = 3; c.beginPath(); c.moveTo(CX - wd / 2 - 20, y + 4); c.lineTo(CX - wd / 2 - 20 + (wd + 40) * s, y - 6); c.stroke(); }
    });
    c.globalAlpha = 1; c.textAlign = 'left'; c.letterSpacing = '0px';
    cap(c, t, 1.2, 6.5, 'words that belong to an older physics', { y: 900 });
  });

  // 8 · the balance tips
  scene(11, (c, t) => {
    paper(c, 'day');
    c.save(); c.translate(CX, 600); c.scale(1.12, 1.12); c.translate(-CX, -600);
    const pv = [CX, 300], Lb = 500;
    const n = Math.round(lerp(1, 46, easeIn(seg(t, 4.2, 8.5))));          // servants: labour becomes endless
    const lit = (j) => t < 4.6 + j * 0.45;                                // candles: attention goes out
    const m = [0, 1, 2, 3, 4, 5, 6].filter((j) => j === 0 || lit(j)).length;
    const target = clamp((n * 1 - m * 3) / 30, -0.2, 0.2);
    const th = lerp(-0.18, target, ease(seg(t, 4.2, 9.2)));
    const left = [pv[0] - Lb * Math.cos(th), pv[1] + Lb * Math.sin(th)], right = [pv[0] + Lb * Math.cos(th), pv[1] - Lb * Math.sin(th)];
    c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 2.6;
    new Etch().addAll(hatch([[CX + 1, 900], [CX + 1, 300], [CX + 9, 300], [CX + 11, 900]], 90, 3), 0.7, 0.8).draw(c);
    // post and base
    c.beginPath(); c.moveTo(CX - 10, 900); c.lineTo(CX - 6, 300); c.moveTo(CX + 10, 900); c.lineTo(CX + 6, 300); c.stroke();
    c.beginPath(); c.moveTo(CX - 150, 930); c.lineTo(CX - 90, 900); c.lineTo(CX + 90, 900); c.lineTo(CX + 150, 930); c.closePath(); c.stroke();
    new Etch().addAll(hatch([[CX - 150, 930], [CX - 90, 900], [CX + 90, 900], [CX + 150, 930]], 0, 4), 0.7, 0.7).draw(c);
    // beam
    c.lineWidth = 5; c.beginPath(); c.moveTo(...left); c.lineTo(...right); c.stroke();
    c.beginPath(); c.arc(pv[0], pv[1], 14, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(CX, 270); c.lineTo(CX - 8, 250); c.lineTo(CX + 8, 250); c.closePath(); c.fill();
    const pan = ([ex, ey], label, fill) => {
      const py = ey + 280;
      c.lineWidth = 1.2; c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - 150, py); c.moveTo(ex, ey); c.lineTo(ex + 150, py); c.stroke();
      c.beginPath(); c.ellipse(ex, py, 160, 22, 0, 0, TAU); c.lineWidth = 1.8; c.stroke();
      c.beginPath(); c.ellipse(ex, py, 160, 50, 0, 0, PI); c.stroke();
      new Etch().addAll(hatch(ellipsePts(ex, py, 158, 48, 0, PI, 30), 0, 5), 0.6, 0.55).draw(c);
      fill(ex, py);
      c.font = '30px "Cinzel"'; c.letterSpacing = '8px'; c.textAlign = 'center'; c.fillStyle = INK; c.fillText(label, ex, py + 100); c.textAlign = 'left'; c.letterSpacing = '0px';
    };
    pan(left, 'LABOR', (ex, py) => {
      const r = rng(4), sp = SPR();
      for (let i = n - 1; i >= 0; i--) {
        const row = Math.floor(Math.sqrt(i * 1.1)), inRow = i - Math.floor(row * row / 1.1);
        const x = ex + (inRow % 2 ? 1 : -1) * Math.ceil(inRow / 2) * 34 + (r() - 0.5) * 8;
        sprite(c, sp[i % 6], x, py - 4 - row * 30, 120 - row * 4, r() < 0.5);
      }
    });
    pan(right, 'ATTENTION', (ex, py) => {
      for (let j = 6; j >= 0; j--) {
        if (!(j === 0 || lit(j)) && t > 5 + j * 0.45) continue;
        const fade = j === 0 ? 1 : 1 - seg(t, 4.6 + j * 0.45, 5 + j * 0.45);
        candle(c, ex + (j === 0 ? 0 : (j % 2 ? -1 : 1) * Math.ceil(j / 2) * 42), py - 6, 110, t, j === 0 ? 1 : fade);
      }
    });
    c.restore();
    cap(c, t, 0.6, 4.4, 'A world where labor was scarce and attention was cheap.', { y: 100 });
    cap(c, t, 4.8, 11, 'The situation is now precisely the reverse.', { y: 100 });
  });

  // 9 · Simon's candle, buried in paper
  scene(10, (c, t) => {
    paper(c, 'day');
    candle(c, CX, 720, 300, t, 1 - 0.55 * seg(t, 4, 9.5));
    const r = rng(77);
    const N = Math.floor(Math.min(420, Math.exp(Math.max(0, t - 2.2) * 0.95)));
    for (let i = 0; i < N; i++) {
      let x = r() * W, y = r() * H; const a = (r() - 0.5) * 0.7, w = 130 + r() * 90, h = w * 1.3;
      if (i < 50 && Math.hypot(x - CX, y - 600) < 320) x = x < CX ? x - 320 : x + 320;
      const born = Math.log(i + 1) / 0.95 + 2.2, k = easeOut(seg(t, born, born + 0.35));
      c.save(); c.translate(x, y); c.rotate(a); c.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); c.globalAlpha = k;
      c.fillStyle = 'rgba(250,245,235,.97)'; c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(-w / 2, -h / 2, w, h);
      c.globalAlpha = k * 0.45;
      for (let l = 0; l < 11; l++) { const lw = w * (0.55 + r() * 0.3); c.beginPath(); c.moveTo(-w / 2 + 14, -h / 2 + 22 + l * (h - 40) / 11); c.lineTo(-w / 2 + 14 + lw, -h / 2 + 22 + l * (h - 40) / 11); c.stroke(); }
      c.restore();
    }
    cap(c, t, 0.5, 4.2, 'Herbert Simon saw it coming in 1971:', { y: 150 });
    cap(c, t, 4.4, 10, '“a wealth of information creates a poverty of attention.”', { y: 150, size: 52 });
  });

  // 10 · THE LINE
  scene(18, (c, t) => {
    paper(c, 'day');
    const p = seg(t, 0.5, 16);
    const z = ease(seg(p, 0.04, 0.95));
    const visible = p < 0.08 ? 1 : Math.exp(lerp(0, Math.log(lineA.o.count), Math.pow(easeOut(seg(p, 0.08, 0.92)), 1.6)));
    drawLine(c, lineA, { zoom: lerp(3.4, 1.45, z), focus: z, visible });
    c.font = '14px "Cinzel"'; c.letterSpacing = '6px'; c.fillStyle = INK; c.globalAlpha = 0.7; c.textAlign = 'right';
    c.fillText('WAITING', W - 60, H - 90);
    c.font = '34px "Cinzel"'; c.letterSpacing = '4px'; c.globalAlpha = 1;
    const nm = Math.floor(visible), txt = nm >= lineA.o.count - 1 ? roman(nm * 37) : roman(nm);
    c.save(); c.beginPath(); c.rect(W - 900, H - 90, 840, 60); c.clip(); c.fillText(txt, W - 60, H - 55); c.restore();
    c.textAlign = 'left'; c.letterSpacing = '0px';
    cap(c, t, 0.5, 3.8, 'not merely abundant but generative,', { y: 120 });
    cap(c, t, 4.0, 7.4, 'not merely available but eager,', { y: 120 });
    cap(c, t, 7.6, 12.2, 'standing in a line that stretches past the castle walls and over the horizon,', { y: 120, width: 1200 });
    cap(c, t, 12.4, 18, 'waiting for instructions you do not have time to give.', { y: 120 });
  });

  // 11 · two frequencies
  scene(7, (c, t) => {
    paper(c, 'day');
    const k = ease(seg(t, 0.3, 2.2));
    const wave = (col, y0, amp, fr, sp, ph) => {
      c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath();
      for (let x = 0; x <= W * k; x += 4) { const y = y0 + Math.sin(x * fr + t * sp + ph) * amp * (0.6 + 0.4 * Math.sin(x * 0.002 + t)); x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    };
    wave('rgba(184,134,11,.95)', 470, 70, 0.006, 1.6, 0);
    wave('rgba(86,102,122,.9)', 610, 60, 0.013, -2.3, 1);
    c.font = '22px "Cinzel"'; c.letterSpacing = '6px'; c.globalAlpha = seg(t, 2, 3);
    c.fillStyle = '#9a6d0a'; c.fillText('NOT BEING KNOWN', 80, 380);
    c.fillStyle = '#56667a'; c.fillText('BANDWIDTH', 80, 720); c.globalAlpha = 1; c.letterSpacing = '0px';
    cap(c, t, 0.8, 7, 'The frustration operates on two frequencies, and you feel them both simultaneously.', { y: 930 });
  });

  // 12 · the glass
  scene(15.5, (c, t) => {
    paper(c, 'day');
    GLASS.draw(c, ease(seg(t, 0.2, 1.8)), INK);
    const BOT = 452, TOP = 186, lvl = (f) => lerp(BOT, TOP, f);
    const aF = ease(seg(t, 2.2, 4.6)) - ease(seg(t, 5.6, 6.6));
    const oF = 0.5 * ease(seg(t, 7, 8.4)) + 0.4 * ease(seg(t, 9.6, 10.8));
    const inside = gP([[214, 186], [232, 446], [300, 458], [368, 446], [386, 186]]);
    const fill = (f, col, line) => {
      if (f <= 0.001) return;
      c.save(); c.beginPath(); inside.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
      const y = gY(lvl(f));
      c.fillStyle = col; c.fillRect(0, y, W, H);
      c.strokeStyle = line; c.lineWidth = 1; c.globalAlpha = 0.7;
      for (let yy = y + 3; yy < gY(460); yy += 5) { c.beginPath(); c.moveTo(gX(200), yy); c.lineTo(gX(400), yy); c.stroke(); }
      c.globalAlpha = 1; c.strokeStyle = line; c.lineWidth = 1.6;
      const rx = lerp(68, 86, f) * GS; c.beginPath(); c.ellipse(CX, y, rx, 10 * GS, 0, 0, TAU); c.stroke();
      c.restore();
    };
    fill(aF, 'rgba(226,214,140,.9)', '#8f8424');
    fill(oF, 'rgba(240,164,92,.92)', '#b8521a');
    const g = ease(seg(t, 11.2, 12.6));
    if (g > 0) {
      const gap = gP([[214, 186], [216, 214], [384, 214], [386, 186]]);
      c.save(); c.beginPath(); gap.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
      c.globalAlpha = g * 0.9; c.strokeStyle = '#d4a843'; c.lineWidth = 1.2;
      for (let x = gX(200) - 200; x < gX(400); x += 7) { c.beginPath(); c.moveTo(x, gY(180)); c.lineTo(x + 60, gY(222)); c.stroke(); }
      c.restore();
      c.save(); c.shadowColor = 'rgba(240,200,90,.9)'; c.shadowBlur = 16; c.strokeStyle = '#d9a73a'; c.lineWidth = 3; c.globalAlpha = g;
      c.beginPath(); c.ellipse(CX, gY(214), 84 * GS, 11 * GS, 0, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(gX(214), gY(186)); c.lineTo(gX(216), gY(214)); c.moveTo(gX(386), gY(186)); c.lineTo(gX(384), gY(214)); c.stroke();
      c.restore();
      c.globalAlpha = seg(t, 12.2, 13); c.fillStyle = '#a8790f'; c.font = 'italic 34px "Cormorant Garamond"'; c.fillText('the shape of the gap', gX(398), gY(196));
      c.globalAlpha = 1;
    }
    const pct = Math.round(Math.max(aF, oF) * 100);
    c.font = '92px "Cinzel"'; c.fillStyle = INK; c.textAlign = 'right'; c.globalAlpha = seg(t, 2, 2.6) * (t < 6.6 ? 0.35 : 1);
    c.fillText(String(pct), 1560, 520); c.font = '32px "Cinzel"'; c.fillText('%', 1600, 540); c.textAlign = 'left'; c.globalAlpha = 1;
    cap(c, t, 0.3, 3.4, 'The first is the agony of not being known.', { y: 120 });
    cap(c, t, 3.6, 6.8, '…a lifelong servant has brought you apple juice when you wanted orange,', { y: 120 });
    cap(c, t, 7.0, 10.8, '…is ninety percent of the way there —', { y: 120 });
    cap(c, t, 11.0, 15.5, 'which is somehow worse than fifty, because it reveals the shape of the gap.', { y: 120 });
  });

  // 13 · bandwidth, at dusk
  scene(8.5, (c, t, d) => {
    paper(c, 'dusk');
    drawLine(c, lineB, { zoom: lerp(1.7, 1.2, ease(t / d)), focus: 1, visible: lineB.o.count });
    cap(c, t, 0.5, 4, 'The second is the agony of bandwidth.', { y: 120, halo: 'rgba(246,230,208,.95)' });
    cap(c, t, 4.2, 8.5, 'You have infinite servants and a finite mind.', { y: 120, halo: 'rgba(246,230,208,.95)' });
  });

  // 14 · the infinite granary
  scene(8, (c, t) => {
    paper(c, 'dusk');
    const r = rng(14);
    // the mound grows without end
    const hgt = 140 + 420 * easeOut(seg(t, 0, 8)), wid = 380 + 900 * easeOut(seg(t, 0, 8));
    const mound = []; for (let x = -wid; x <= wid; x += 8) mound.push([CX + x, 1080 - hgt * Math.exp(-(x * x) / (2 * (wid / 2.4) ** 2))]);
    const poly = [[CX - wid, 1085], ...mound, [CX + wid, 1085]];
    c.fillStyle = 'rgba(226,180,110,.55)'; c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.fill();
    new Etch().addAll(hatch(poly, 8, 6, 5, 3), 0.7, 0.5).draw(c);
    c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); mound.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    // the pour
    c.fillStyle = INK;
    for (let i = 0; i < 6000; i++) {
      const born = r() * 9 - 1, spd = 900 + r() * 400, dx = (r() - 0.5) * 90 * (1 + t * 0.3);
      const age = t - born; const y = -20 + spd * age;
      const top = 1080 - hgt * Math.exp(-(dx * dx) / (2 * (wid / 2.4) ** 2));
      if (age < 0 || y > top) continue;
      c.globalAlpha = 0.75; c.fillRect(CX + dx + Math.sin(i) * 3, y, 2, 3.5);
    }
    c.globalAlpha = 1;
    cap(c, t, 0.5, 8, 'Who prepares for the day when the granary is infinite and the hunger is still there?', { y: 150, width: 1150, halo: 'rgba(246,230,208,.95)' });
  });

  // 15 · leverage, resolution
  scene(11.5, (c, t) => {
    paper(c, 'dusk');
    const sp = SPR();
    const levels = [{ n: 1, y: 390, h: 230, b: 1 }, { n: 3, y: 640, h: 190, b: 6 }, { n: 9, y: 860, h: 150, b: 13 }, { n: 27, y: 1060, h: 120, b: 24 }];
    const pos = levels.map((L) => Array.from({ length: L.n }, (_, i) => (L.n === 1 ? CX : lerp(140, W - 140, i / (L.n - 1)))));
    levels.forEach((L, li) => {
      const k = easeOut(seg(t, 0.4 + li * 1.6, 1.4 + li * 1.6));
      if (k <= 0) return;
      if (li > 0) { // lines of command
        c.strokeStyle = `rgba(${INK_RGB},${0.45 * k})`; c.lineWidth = 1;
        pos[li].forEach((x, i) => { const px = pos[li - 1][Math.floor(i / 3)]; c.beginPath(); c.moveTo(px, levels[li - 1].y + 6); c.lineTo(x, L.y - L.h - 6); c.stroke(); });
      }
      c.globalAlpha = k;
      pos[li].forEach((x, i) => { const img = pixelated(sp[(i + li) % 6], L.h, L.b); c.drawImage(img, x - img.width / 2, L.y - L.h); });
      c.globalAlpha = 1;
    });
    c.drawImage(GOLD_CROWN, CX - 42, 390 - 230 - 58, 84, 66);
    cap(c, t, 0.5, 6, 'At each level of abstraction you gain leverage and lose resolution,', { y: 80 });
    cap(c, t, 6.2, 11.5, 'until managing the managers costs more than doing the work yourself.', { y: 80 });
  });

  // 16 · the wall, and a door
  scene(10, (c, t) => {
    paper(c, 'dusk');
    const door = doorPath();
    const open = ease(seg(t, 5.2, 8.5));
    WALL.draw(c, ease(seg(t, 0.1, 2.4)), INK);
    if (open > 0) {
      c.save(); c.beginPath(); door.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
      const g = c.createRadialGradient(CX, 800, 0, CX, 800, 520);
      g.addColorStop(0, `rgba(255,246,214,${open})`); g.addColorStop(1, `rgba(245,196,110,${open * 0.9})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
      c.save(); c.globalCompositeOperation = 'screen';
      const rays = c.createRadialGradient(CX, 820, 60, CX, 820, 900 * open + 1);
      rays.addColorStop(0, `rgba(255,214,140,${0.55 * open})`); rays.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = rays; c.fillRect(0, 0, W, H); c.restore();
    }
    new Etch().add(door, 4).draw(c, ease(seg(t, 2.6, 5.2)), INK);
    cap(c, t, 0.4, 4.3, 'If you never hit these limits, you never know where the true limit is.', { y: 120, halo: 'rgba(246,230,208,.95)' });
    cap(c, t, 4.5, 7.0, 'The bottleneck is the curriculum.', { y: 120, halo: 'rgba(246,230,208,.95)' });
    cap(c, t, 7.2, 10, 'The overwhelm is the syllabus.', { y: 120, halo: 'rgba(246,230,208,.95)' });
  });

  // 17 · the mirror
  scene(13.5, (c, t, d) => {
    paper(c, 'dusk');
    c.save(); push(c, t, d, 1, 1.08, CX, 520);
    // silvered glass
    const f = seg(t, 1.2, 3);
    c.save(); c.beginPath(); c.ellipse(CX, 500, 250, 330, 0, 0, TAU); c.clip();
    const sg = c.createLinearGradient(CX - 250, 170, CX + 250, 830);
    sg.addColorStop(0, `rgba(222,222,218,${f})`); sg.addColorStop(0.5, `rgba(188,190,190,${f})`); sg.addColorStop(1, `rgba(214,214,210,${f})`);
    c.fillStyle = sg; c.fillRect(0, 0, W, H);
    // the reflection: a face with nothing in it
    const b = seg(t, 3.5, 6.5);
    c.filter = 'blur(6px)'; c.globalAlpha = 0.55 * b; c.fillStyle = '#9a9a98';
    c.beginPath(); c.ellipse(CX, 470, 95, 125, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(CX, 800, 230, 170, 0, PI, TAU); c.fill();
    c.filter = 'none'; c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(CX - 170, 260); c.lineTo(CX - 60, 220); c.stroke();
    c.restore();
    MIRROR.draw(c, ease(seg(t, 0.1, 2.6)), INK);
    c.restore();
    cap(c, t, 0.5, 4.2, 'The mirror they hold up is accurate.', { y: 960, halo: 'rgba(246,230,208,.95)' });
    cap(c, t, 4.4, 8.6, 'The reflection is bland because the face is bland.', { y: 960, halo: 'rgba(246,230,208,.95)' });
    cap(c, t, 8.8, 13.5, 'The failure is not the servant.  It is the king.', { y: 960, halo: 'rgba(246,230,208,.95)' });
  });

  // 18 · no voice
  scene(7.5, (c, t) => {
    paper(c, 'dusk');
    const amp = 1 - ease(seg(t, 2.5, 6));
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const env = Math.sin(x * 0.004 + t * 0.7) ** 2 * Math.sin(x * 0.0013 - t) ** 2;
      const y = 560 + amp * 150 * env * (Math.sin(x * 0.09 + t * 9) * 0.7 + Math.sin(x * 0.23 - t * 13) * 0.3) + Math.sin(x * 0.05) * 0.8;
      x ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
    cap(c, t, 0.5, 7.5, 'You say capture my voice —', { y: 330, size: 56 });
    cap(c, t, 3.3, 7.5, 'but you do not have a voice.', { y: 800, size: 56 });
  });

  // 19 · the laptop on the pedestal
  scene(9.5, (c, t, d) => {
    kenBurns(c, IMG.laptop, t, d, 1.0, 1.14, 0.5, 0.5, 0.5, 0.4);
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(250,215,175,.6)'; c.fillRect(0, 0, W, H); c.restore();
    cap(c, t, 0.4, 4.6, 'Every hollow output is your hollow instruction returned.', { y: 105 });
    cap(c, t, 4.8, 9.5, 'The servant did not fail you.  You failed the servant.', { y: 105 });
  });

  // 20 · the gift, as night falls
  scene(9, (c, t) => {
    paper(c, 'dusk');
    const n = ease(seg(t, 1.5, 5));
    c.globalAlpha = n; c.drawImage(PAPER.night, 0, 0); c.globalAlpha = 1;
    stars(c, t, 200, 8, n);
    const night = n > 0.5;
    cap(c, t, 0.4, 4.5, 'This is the gift hidden inside the insult:', { y: 540, size: 56, night });
    cap(c, t, 4.7, 9, 'the chance to discover whether you are actually interesting — or whether you have merely been told that you are.', { y: 540, size: 50, width: 1250, night: true });
  });

  // 21–29 · the letter, at night
  const NIGHT = (c, t, seed = 1) => { paper(c, 'night'); stars(c, t, 220, seed, 0.9); };
  scene(5.5, (c, t) => {
    NIGHT(c, t, 2);
    c.save(); c.globalCompositeOperation = 'screen';
    const g = c.createRadialGradient(CX, 560, 0, CX, 560, 520); g.addColorStop(0, 'rgba(255,190,110,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    cap(c, t, 0.5, 5.5, 'A friend sent this, late at night.', { y: 540, size: 44, night: true, color: '#c9b48c' });
  });
  scene(7.5, (c, t, d) => {
    NIGHT(c, t, 3);
    drawLine(c, lineB, { zoom: lerp(1.45, 1.25, t / d), focus: 1, visible: lineB.o.count }, 'night', 0.9);
    cap(c, t, 0.4, 7.5, 'You have inherited the throne of an infinitely vast empire. Your myriad serfs stand shoulder to shoulder, pushing back the horizon, as far as the eye can see.', { y: 140, size: 42, width: 1400, night: true });
  });
  scene(6, (c, t) => {
    NIGHT(c, t, 4);
    const r = rng(40);
    for (let i = 0; i < 260; i++) {
      const x = r() * W, born = r() * 7 - 1, spd = 260 + r() * 260, rot = r() * TAU, sz = 16 + r() * 16;
      const y = -40 + (t - born) * spd; if (y < -40 || y > H + 40) continue;
      const sq = Math.abs(Math.cos(rot + t * (2 + r() * 3)));
      c.fillStyle = '#d7a83c'; c.strokeStyle = '#6d4a0c'; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(x, y, sz * Math.max(0.12, sq), sz, 0.3, 0, TAU); c.fill(); c.stroke();
    }
    cap(c, t, 0.4, 6, 'The royal treasury will never exhaust.', { y: 540, size: 60, night: true });
  });
  scene(5, (c, t) => {
    NIGHT(c, t, 5);
    c.globalAlpha = 0.14 * seg(t, 0, 1.5); c.drawImage(tint(IMG.crown, MOON), CX - 300, 300, 600, 470); c.globalAlpha = 1;
    cap(c, t, 0.4, 5, 'But you are not fit to be king.', { y: 540, size: 64, night: true });
  });
  scene(5, (c, t) => {
    NIGHT(c, t, 6);
    const sp = SPR().map((s) => tint(s, MOON));
    c.globalAlpha = 0.22 * seg(t, 0, 1.5);
    for (let i = 0; i < 9; i++) sprite(c, sp[i % 6], 180 + i * 195, 1040, 330, i % 2);
    c.globalAlpha = 1;
    cap(c, t, 0.4, 5, 'Ironically, your serfs are wiser than you.', { y: 430, size: 60, night: true });
  });
  scene(5.5, (c, t) => {
    NIGHT(c, t, 7);
    cap(c, t, 0.8, 5.5, 'But you have no cause.', { y: 540, size: 72, night: true, stagger: 0.25, fade: 1.2 });
  });
  scene(8, (c, t) => {
    NIGHT(c, t, 9);
    // the walls, remodelled forever: bricks lift out and swap, and the wall goes nowhere
    const bw = 150, bh = 56, cols = 9, rows = 6, x0 = CX - (cols * bw) / 2, y0 = 360;
    const slots = []; for (let r2 = 0; r2 < rows; r2++) for (let k = 0; k < cols; k++) slots.push([x0 + k * bw + (r2 % 2 ? bw / 2 : 0), y0 + r2 * bh]);
    const perm = slots.map((_, i) => i); const r = rng(55);
    const cycle = Math.floor(t / 0.9), ph = ease((t % 0.9) / 0.9);
    let prev = perm.slice();
    for (let s = 0; s <= cycle; s++) { prev = perm.slice(); for (let q = 0; q < 3; q++) { const a = Math.floor(r() * perm.length), b = Math.floor(r() * perm.length); [perm[a], perm[b]] = [perm[b], perm[a]]; } }
    c.strokeStyle = MOON; c.lineWidth = 1.3;
    perm.forEach((slotNow, brick) => {
      const from = slots[prev[brick]], to = slots[slotNow];
      const lift = (from !== to) ? Math.sin(ph * PI) * 40 : 0;
      const x = lerp(from[0], to[0], ph), y = lerp(from[1], to[1], ph) - lift;
      c.globalAlpha = 0.85; c.strokeRect(x + 3, y + 3, bw - 6, bh - 6);
      c.globalAlpha = 0.3; for (let h = 0; h < 4; h++) { c.beginPath(); c.moveTo(x + 12 + h * 34, y + 12); c.lineTo(x + 30 + h * 34, y + bh - 12); c.stroke(); }
    });
    c.globalAlpha = 1;
    cap(c, t, 0.4, 8, 'Your workforce is idle. And when they are not, all you do is remodel the castle walls.', { y: 150, size: 48, width: 1300, night: true });
  });
  scene(9, (c, t) => {
    NIGHT(c, t, 10);
    // Bhaskara's wheel: the perpetual motion machine that moves nothing
    const R = WHEEL_R, cx = CX, cy = 580, rot = t * 0.55;
    c.strokeStyle = MOON; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R - 14, 0, TAU); c.stroke();
    c.beginPath(); c.arc(cx, cy, 26, 0, TAU); c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = rot + (i / 12) * TAU;
      const p0 = [cx + Math.cos(a) * 26, cy + Math.sin(a) * 26], p1 = [cx + Math.cos(a + 0.5) * (R - 14), cy + Math.sin(a + 0.5) * (R - 14)];
      const mid = [cx + Math.cos(a + 0.12) * R * 0.6, cy + Math.sin(a + 0.12) * R * 0.6];
      c.lineWidth = 1.4; c.beginPath(); c.moveTo(...p0); c.quadraticCurveTo(...mid, ...p1); c.stroke();
      c.fillStyle = '#b89a5e'; c.beginPath(); c.arc(p1[0], p1[1], 11, 0, TAU); c.fill();
    }
    c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 120, cy + R + 150); c.lineTo(cx, cy); c.lineTo(cx + 120, cy + R + 150); c.stroke();
    c.beginPath(); c.moveTo(cx - 220, cy + R + 150); c.lineTo(cx + 220, cy + R + 150); c.stroke();
    cap(c, t, 0.4, 4.6, 'You have been given a perpetual motion machine —', { y: 130, size: 48, night: true });
    cap(c, t, 4.8, 9, 'yet you move nothing, or merely go in circles.', { y: 130, size: 48, night: true });
  });
  scene(9, (c, t, d) => {
    paper(c, 'night');
    c.globalAlpha = 0.9; kenBurns(c, IMG.ruins, t, d, 1.2, 1.0, 0.5, 0.4, 0.5, 0.55, 'invert(1) sepia(.45) brightness(.62) contrast(1.25)'); c.globalAlpha = 1;
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(120,118,140)'; c.fillRect(0, 0, W, H); c.restore();
    cap(c, t, 1.0, 9, 'We live in an era with the saddest empires the world has ever known.', { y: 540, size: 60, width: 1300, night: true, stagger: 0.09 });
  });

  // 30 · the crown
  let GOLD_CROWN;
  scene(24, (c, t, d) => {
    paper(c, 'first');
    c.save();
    const s = 0.8, ox = CX - 760 * s, oy = 190;
    const zoom = lerp(1, 1.1, ease(seg(t, 14, 24)));
    c.translate(CX, 600); c.scale(zoom, zoom); c.translate(-CX + 140 * seg(t, 14, 24) * 0, -600);
    c.translate(ox, oy); c.scale(s, s);
    // floor
    c.strokeStyle = INK; for (let i = 0; i < 14; i++) { c.globalAlpha = 0.55 - i * 0.035; c.lineWidth = 1.3; const y = 1000 + Math.pow(i, 1.5) * 4.4; c.beginPath(); c.moveTo(-600, y); c.lineTo(2000, y); c.stroke(); }
    c.globalAlpha = 1;
    c.drawImage(IMG.column, 340, 445, 720, 555);
    // crown pose: tip over the edge, fall, bounce, settle on its side
    const tip = ease(seg(t, 2.4, 3.5)), fall = seg(t, 3.5, 4.5), settle = seg(t, 4.5, 5.3);
    let x = 22 * tip, y = -6 * tip, rot = 16 * tip;
    if (fall > 0) { x = lerp(22, 400, easeOut(fall)); y = lerp(-6, 290, fall * fall); rot = lerp(16, 94, easeOut(fall)); }
    if (settle > 0) { const b = Math.sin(settle * PI) * (1 - settle); x = 400 + 14 * easeOut(settle); y = 290 - 38 * b; rot = 94 - 4 * easeOut(settle) + 5 * b; }
    const down = seg(t, 4.3, 5.3);
    c.fillStyle = `rgba(58,34,24,${0.22 * down})`; c.beginPath(); c.ellipse(1290, 1004, 210, 16, 0, 0, TAU); c.fill();
    // dust where it lands
    if (t > 4.5 && t < 7.5) {
      const r = rng(3), k = seg(t, 4.5, 7.5);
      for (let i = 0; i < 70; i++) { const a = PI + r() * PI, sp = 60 + r() * 220; c.fillStyle = `rgba(90,70,55,${0.35 * (1 - k)})`; c.beginPath(); c.arc(1290 + Math.cos(a) * sp * easeOut(k), 998 + Math.sin(a) * sp * 0.35 * easeOut(k), 2 + r() * 3, 0, TAU); c.fill(); }
    }
    c.save(); c.translate(440 + 250 + x, 93 + 392 + y); c.rotate(rot * PI / 180);
    c.globalAlpha = 0.75; c.drawImage(IMG.crown, -250, -392, 500, 392); c.globalAlpha = 1;
    c.drawImage(GOLD_CROWN, -250, -392, 500, 392);
    c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 1.3);
    c.drawImage(GOLD_CROWN, -250, -392, 500, 392); c.globalAlpha = 1;
    // a sheen that travels across the gold
    c.globalCompositeOperation = 'source-atop';
    c.restore();
    c.restore();
    cap(c, t, 6.0, 24, 'The crown is on the floor.', { y: 110, size: 44, font: 'cinzel', tracking: 3, out: 1.2 });
    cap(c, t, 9.0, 24, 'It is heavy.', { y: 175, size: 44, font: 'cinzel', tracking: 3, out: 1.2 });
    cap(c, t, 12.0, 24, 'It was always going to be heavy.', { y: 240, size: 44, font: 'cinzel', tracking: 3, out: 1.2 });
    cap(c, t, 16.0, 24, 'Pick it up.', { y: 330, size: 58, font: 'cinzel', tracking: 8, color: '#a8790f', out: 1.2, stagger: 0.3, fade: 1.2 });
  }, { tone: 'first' });

  // 31 · end card
  scene(8, (c, t) => {
    paper(c, 'first');
    words(c, 'THE SADDEST EMPIRES', CX, 480, { t: t - 0.4, size: 58, font: 'cinzel', tracking: 10, stagger: 0.12, fade: 1.2 });
    words(c, 'an essay by Samuel Salzer', CX, 570, { t: t - 1.4, size: 36, color: '#6a5242' });
    words(c, 'MMXXVI', CX, 640, { t: t - 2.2, size: 24, font: 'cinzel', tracking: 10, color: '#8a7362' });
  });


  /* ============================================================ TYPE
     The text is the essay, so it is set, not captioned. It is real text laid over the image, so
     it gets the typeface's own features: old-style figures, small capitals, ligatures, kerning.
     Three voices: the narrator (Cormorant Garamond), quotations (IM Fell English, a 17th-century
     type that matches the engravings), and the friend's letter (La Belle Aurore, by hand).
     Markup inside a line: {gold}, *italic*, [small caps]. */
  const TYPE_ROOT = document.getElementById('type');
  const VOICE = {
    narrator: { family: '"Cormorant Garamond"', weight: 500 },
    quote: { family: '"IM Fell English"', weight: 400 },
    hand: { family: '"La Belle Aurore"', weight: 400 },
  };
  const MARGIN = 190;                       // one left margin for every left-set passage
  const LINES = [];                         // every line set in the film, for the score to follow
  const MARKS = [];                         // named moments, for the score
  const mark = (sceneIdx, name, t, extra = {}) => MARKS.push(Object.assign({ sceneIdx, name, t }, extra));
  function markup(text) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let h = esc(text)
      .replace(/\{([^}]+)\}/g, '<span class="gold"><i>$1</i></span>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/\[([^\]]+)\]/g, '<span class="sc">$1</span>');
    // hanging punctuation: an opening quote or dash sits outside the measure
    h = h.replace(/^(“|‘|—\s?|…)/, '<span class="hang">$1</span>');
    return h;
  }
  const BASELINE = new Map();
  function baselineOf(voice, size) {
    const key = voice + size;
    if (BASELINE.has(key)) return BASELINE.get(key);
    const probe = document.createElement('div');
    probe.className = 'ln probe'; probe.style.fontFamily = VOICE[voice].family; probe.style.fontWeight = VOICE[voice].weight;
    probe.style.fontSize = size + 'px'; probe.innerHTML = 'Hxg<span style="display:inline-block;width:0;height:0"></span>';
    TYPE_ROOT.appendChild(probe);
    const b = probe.lastChild.offsetTop; probe.remove();
    BASELINE.set(key, b); return b;
  }
  // One passage of hand-broken lines. Each line unfolds in turn, the passage holds, then lifts away.
  class Passage {
    constructor(sceneIdx, o) {
      Object.assign(this, { voice: 'narrator', size: 84, lh: 1.22, align: 'left', x: MARGIN, pace: 0.034, gap: 0 }, o);
      this.sceneIdx = sceneIdx;
      this.hand = this.voice === 'hand';
      if (this.hand) this.pace = o.pace || 0.075;             // a pen is slower than a press
      let t = this.at;
      this.times = this.lines.map((ln) => {
        const plain = ln.replace(/[{}*[\]]/g, '');
        const dur = this.hand ? plain.length * this.pace : clamp(plain.length * this.pace, 0.75, 2.1);
        const at = t;
        t += this.hand ? dur + 0.45 : dur * 0.72 + (/[,—:;…]$/.test(plain) ? 0.35 : 0.55) + this.gap;
        return [at, dur];
      });
      this.arrived = this.times.length ? this.times[this.times.length - 1][0] + this.times[this.times.length - 1][1] : this.at;
      if (this.hold !== undefined) this.out = this.arrived + this.hold;
      this.lines.forEach((ln, i) => LINES.push({ sceneIdx, t: this.times[i][0] + this.times[i][1] * 0.55, voice: this.voice, gold: /\{/.test(ln), start: this.times[i][0], dur: this.times[i][1], night: !!this.night }));
      this.els = null;
    }
    build(container) {
      const v = VOICE[this.voice];
      this.els = this.lines.map((ln) => {
        const el = document.createElement('div');
        el.className = `ln ${this.night ? 'night' : 'day'} v-${this.voice}`;
        el.style.fontFamily = v.family; el.style.fontWeight = v.weight; el.style.fontSize = this.size + 'px';
        const html = markup(ln);
        el.innerHTML = `<span class="sizer" aria-hidden="true">${html}</span><span class="ink"><span class="halo" aria-hidden="true">${html}</span><span class="body">${html}</span></span>${this.hand ? '' : `<span class="bloom" aria-hidden="true">${html}</span>`}`;
        container.appendChild(el);
        return el;
      });
      // measure once: width, and how far a hanging mark reaches into the margin
      this.geo = this.els.map((el) => {
        const hang = el.querySelector('.sizer .hang');
        return { w: el.querySelector('.sizer').offsetWidth, hang: hang ? hang.offsetWidth : 0 };
      });
    }
    update(lt, y0Override) {
      if (!this.els) return;
      const pad = this.size * 0.6, base = baselineOf(this.voice, this.size);
      const exit = this.out === undefined ? 0 : seg(lt, this.out, this.out + 0.9);
      const lineH = this.size * this.lh;
      const blockH = this.lines.length * lineH;
      let top = this.valign === 'middle' ? this.y - blockH / 2 : this.y;
      this.els.forEach((el, i) => {
        const [at, dur] = this.times[i], g = this.geo[i];
        const p = this.hand ? clamp((lt - at) / dur) : ease(seg(lt, at, at + dur));
        if (lt < at || exit >= 1) { el.style.display = 'none'; return; }
        el.style.display = 'block';
        const indent = (this.indent && this.indent[i]) || 0;
        let x = this.align === 'center' ? this.x - g.w / 2 : this.align === 'right' ? this.x - g.w : this.x + indent;
        x -= g.hang;                                              // the hanging mark sits in the margin
        const baselineY = (this.baselines && this.baselines[i] !== undefined) ? this.baselines[i] : top + this.size * 0.95 + i * lineH;
        const settle = this.hand ? 0 : (1 - easeOut(clamp(p * 1.3))) * this.size * 0.07;
        el.style.transform = `translate(${(x - pad).toFixed(1)}px, ${(baselineY - base - pad * 0.5 + settle - exit * 16).toFixed(1)}px)`;
        el.style.padding = `${pad * 0.5}px ${pad}px`;
        el.style.opacity = (this.alpha ?? 1) * (1 - ease(exit)) * (this.fade ? this.fade(lt) : 1);
        // the reveal: sharp body behind a soft edge; for the hand, a narrow pen edge
        const edge = this.hand ? this.size * 0.35 : Math.max(90, this.size * 1.5);
        const pos = pad + lerp(-edge * 0.2, g.w + edge, p);
        el.style.setProperty('--a', `${(pos - edge).toFixed(1)}px`);
        el.style.setProperty('--b', `${pos.toFixed(1)}px`);
        el.style.setProperty('--c', `${(pos - edge * 1.4).toFixed(1)}px`);
        el.style.setProperty('--d', `${(pos - edge * 0.45).toFixed(1)}px`);
        el.style.setProperty('--e', `${(pos + edge * 0.15).toFixed(1)}px`);
        el.style.setProperty('--bloom', p < 1 ? 0.85 : 0);
        // gold leaf: once a gold phrase has landed, a slow sheen crosses it
        const landed = lt - (at + dur);
        const sh = landed < 0 ? 100 : 100 - ((landed * 38) % 260);
        el.style.setProperty('--sheen', `${sh}%`);
      });
    }
  }

  // small capitals label (source lines, chapter names)
  class Label {
    constructor(o) { Object.assign(this, { size: 30, voice: 'narrator', align: 'center', tracking: 0.22 }, o); this.el = null; }
    build(container) {
      const el = document.createElement('div');
      el.className = `label ${this.night ? 'night' : 'day'}`;
      el.style.fontFamily = this.font || VOICE[this.voice].family; el.style.fontSize = this.size + 'px';
      el.style.letterSpacing = this.tracking + 'em';
      el.innerHTML = this.html; container.appendChild(el); this.el = el;
      this.w = el.offsetWidth;
    }
    update(lt) {
      const k = ease(seg(lt, this.at, this.at + (this.dur || 1.2))) * (1 - ease(seg(lt, this.out ?? 1e9, (this.out ?? 1e9) + 0.8)));
      this.el.style.display = k <= 0 ? 'none' : 'block';
      const x = this.align === 'center' ? this.x - this.w / 2 : this.x;
      this.el.style.transform = `translate(${x}px, ${this.y}px)`;
      this.el.style.opacity = k;
      this.el.style.filter = `blur(${((1 - k) * 4).toFixed(2)}px)`;
    }
  }

  // text layers per scene: built lazily, shown only while the scene is on screen
  function typeLayer(s) {
    if (!s.type) return null;
    if (!s.typeEl) {
      s.typeEl = document.createElement('div'); s.typeEl.className = 'tscene'; TYPE_ROOT.appendChild(s.typeEl);
      s.typeEl.style.display = 'block';            // must be laid out to be measured
      s.type.forEach((p) => p.build(s.typeEl));
    }
    return s.typeEl;
  }

  /* ------------------------------------------------------------ ornaments drawn on the canvas */
  function rule(c, x0, x1, y, k, color) {
    const m = (x0 + x1) / 2, h = (x1 - x0) / 2 * ease(k);
    c.strokeStyle = color; c.lineWidth = 1.2; c.globalAlpha = 0.8;
    c.beginPath(); c.moveTo(m - h, y); c.lineTo(m + h, y); c.stroke();
    c.globalAlpha = 1;
  }
  function initialFrame(c, x, y, s, k, color, lt) {
    // an engraved square for the illuminated initial: double rule, hatching, a vine that grows
    const e = new Etch();
    e.add(rect(x, y, s, s), 1.6); e.add(rect(x + 9, y + 9, s - 18, s - 18), 0.9);
    // a vine that runs round the inside of the frame, never across the letter
    const vine = []; const inset = 20, side = s - inset * 2;
    for (let i = 0; i <= 160; i++) {
      const u = i / 160 * 4, k = Math.floor(u), f = u - k, wob = Math.sin(f * PI * 4) * 5;
      const pts = [[x + inset + f * side, y + inset + wob], [x + s - inset + wob, y + inset + f * side], [x + s - inset - f * side, y + s - inset + wob], [x + inset + wob, y + s - inset - f * side]];
      vine.push(pts[Math.min(k, 3)]);
    }
    e.add(vine, 1, 0.7);
    for (let i = 6; i < 160; i += 10) { const [vx, vy] = vine[i]; e.add(ellipsePts(vx, vy, 4, 2.2, (i % 20) * 0.3, (i % 20) * 0.3 + TAU, 12), 0.7, 0.6); }
    e.addAll(hatch([[x + 12, y + 12], [x + s - 12, y + 12], [x + s - 12, y + s - 12], [x + 12, y + s - 12]], 45, 9, 0, 4), 0.5, 0.16);
    e.draw(c, k, color);
  }
  function lamp(c, cx, cy, r, a) {
    c.save(); c.globalCompositeOperation = 'screen';
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,196,120,${0.34 * a})`); g.addColorStop(0.5, `rgba(200,130,60,${0.12 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  }

  /* ============================================================ THE STUDY (?cut=type) */
  const CUT = new URLSearchParams(location.search).get('cut');
  let GLASS_R, lineC;
  if (CUT === 'type') {
    S.length = 0;
    const idx = () => S.length;                 // index the next scene will have

    function card(numeral, title, tone, night) {
      const i = idx();
      const L1 = new Label({ at: 0.3, dur: 1.4, x: CX, y: 370, size: 160, font: '"Cinzel Decorative"', tracking: 0.05, html: `<span class="gold gold-card">${numeral}</span>`, night });
      const L2 = new Label({ at: 1.0, dur: 1.2, x: CX, y: 575, size: 40, tracking: 0.32, html: `<span class="sc">${title}</span>`, night });
      mark(i, 'card', 0.3, { numeral });
      scene(4.2, (c, t) => {
        paper(c, tone); if (night) stars(c, t, 120, 11, 0.5);
        rule(c, CX - 330, CX - 110, 548, seg(t, 0.9, 2.2), night ? MOON : INK);
        rule(c, CX + 110, CX + 330, 548, seg(t, 0.9, 2.2), night ? MOON : INK);
      }, { type: [L1, L2] });
    }

    // I · The Morning
    card('I', 'The Morning', 'dark', true);
    {
      const i = idx(), s = 92, lh = 1.22, cap = s * lh * 3 - 14;
      const m1 = new Passage(i, { at: 1.6, size: s, lh, night: true, x: MARGIN, y: 230,
        indent: [cap + 26, cap + 26, cap + 26, 0],
        lines: ['[here is] a particular kind of morning', 'that belongs to {2026}', 'and no other year', 'in the history of the species.'] });
      m1.out = m1.arrived + 2.6;
      const T = new Label({ at: 0.9, dur: 1.6, x: MARGIN + 18, y: 230 + 10, align: 'left', size: cap * 0.84, font: '"Cinzel Decorative"', tracking: 0, html: '<span class="gold gold-initial">T</span>', night: true, out: m1.out });
      const m2 = new Passage(i, { at: m1.out + 1.2, size: s, night: true, x: MARGIN, y: 300, lines: ['You speak a few sentences', '*into the dark —*'], hold: 2.6 });
      const m3 = new Passage(i, { at: m2.out + 1.0, size: s, night: true, x: MARGIN, y: 300, lines: ['You did not earn this.', 'You are not dressed.'], hold: 2.8 });
      mark(i, 'initial', 0.9);
      scene(m3.out + 1.6, (c, t) => {
        paper(c, 'dark'); stars(c, t, 150, 3, 0.65);
        initialFrame(c, MARGIN, 230 + 14, cap, ease(seg(t, 0.2, 2.4)) * (1 - seg(t, m1.out, m1.out + 0.9)), '#c9a45a', t);
        const gx = 1600, gy = 850;
        c.save(); c.globalCompositeOperation = 'screen';
        const gl = c.createRadialGradient(gx, gy, 0, gx, gy, 520);
        gl.addColorStop(0, 'rgba(160,182,228,.5)'); gl.addColorStop(0.35, 'rgba(80,100,150,.14)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gl; c.fillRect(0, 0, W, H); c.restore();
        c.fillStyle = 'rgba(214,226,248,.92)'; c.fillRect(gx - 30, gy - 52, 60, 104);
        const letters = 'ascripttenpageanalysisadraftofsomethingyouhavebeenmeaningtowrite', r = rng(31);
        c.font = 'italic 34px "Cormorant Garamond"'; c.textBaseline = 'middle';
        for (let k = 0; k < 120; k++) {
          const born = m2.at + 0.8 + r() * 7, life = 3.4 + r() * 2, dx = (r() - 0.7) * 700, sway = r() * TAU;
          const q = (t - born) / life; if (q < 0 || q > 1) { r(); continue; }
          c.globalAlpha = Math.sin(q * PI) * 0.6; c.fillStyle = MOON;
          c.fillText(letters[k % letters.length], gx + dx * easeOut(q) + Math.sin(t * 1.3 + sway) * 18, gy - 80 - q * 640); r();
        }
        c.globalAlpha = 1;
      }, { type: [T, m1, m2, m3] });
    }

    // II · The Line
    card('II', 'The Line', 'day');
    {
      const i = idx();
      const q = new Passage(i, { at: 1.2, voice: 'quote', size: 70, lh: 1.26, x: MARGIN, y: 250,
        lines: ['“In an information-rich world,', 'the wealth of information', 'means a dearth of something else …', 'Hence a wealth of information', 'creates a {poverty of attention.}”'] });
      q.out = q.arrived + 3.2;
      const src = new Label({ at: q.arrived - 0.2, x: MARGIN, y: 250 + 70 * 1.26 * 5 + 50, align: 'left', size: 30, voice: 'quote', font: '"IM Fell English SC"', tracking: 0.14, html: 'Herbert Simon, 1971', out: q.out });
      mark(i, 'dim', q.arrived - 1.0);
      scene(q.out + 1.6, (c, t) => {
        paper(c, 'day');
        candle(c, 1480, 820, 320, t, 1 - 0.7 * seg(t, q.arrived - 1.2, q.out));
        const r = rng(77), N = Math.floor(Math.min(90, Math.exp(Math.max(0, t - 3) * 0.7)));
        for (let k = 0; k < N; k++) {
          let x = 1100 + r() * 800, y = r() * H; const a = (r() - 0.5) * 0.7, w = 110 + r() * 70, h = w * 1.3;
          if (Math.abs(x - 1480) < 180 && y > 380) x += 360;
          const born = Math.log(k + 1) / 0.7 + 3, kk = easeOut(seg(t, born, born + 0.35));
          c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = kk;
          c.fillStyle = 'rgba(250,245,235,.97)'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(-w / 2, -h / 2, w, h);
          c.globalAlpha = kk * 0.4; for (let l = 0; l < 10; l++) { c.beginPath(); c.moveTo(-w / 2 + 12, -h / 2 + 20 + l * (h - 36) / 10); c.lineTo(w / 2 - 14 - r() * 30, -h / 2 + 20 + l * (h - 36) / 10); c.stroke(); }
          c.restore();
        }
      }, { type: [q, src] });
    }
    {
      const i = idx();
      const l1 = new Passage(i, { at: 1.2, size: 84, x: CX, y: 96, align: 'center', lines: ['not merely present,', 'but standing in a line'], hold: 2.2 });
      const l2 = new Passage(i, { at: l1.out + 0.9, size: 84, x: CX, y: 96, align: 'center', lines: ['that stretches past the castle walls'] });
      // "and over the horizon," is set ON the horizon, and rides it as the camera pulls back
      const l2b = new Passage(i, { at: l2.arrived + 0.4, size: 84, x: 250, y: 0, lines: ['and over the horizon,'] });
      l2.out = l2b.out = l2b.arrived + 2.6;
      const l3 = new Passage(i, { at: l2.out + 0.9, size: 84, x: CX, y: 96, align: 'center', lines: ['waiting for instructions', 'you do not have {time to give.}'], hold: 3.2 });
      const cam = (t, d) => {
        const p = seg(t, 0.3, d - 1.2), z = ease(seg(p, 0.04, 0.95));
        return { p, z, zoom: lerp(2.3, 1.05, z) };
      };
      const horizonY = (t, d) => {
        const { z, zoom } = cam(t, d), a = lineC.anchor();
        const ty = H * 0.52 + (a.y - H * 0.52) * z;
        const drift = 1 + 0.035 * clamp(t / d);                   // the scene drift, applied to the image
        return CY + ((ty + (lineC.hy - a.y) * zoom) - CY) * drift;
      };
      const d = l3.out + 1.4;
      l2b.baselines = [0];
      l2b.fade = () => 1;
      const upd = l2b.update.bind(l2b);
      l2b.update = (lt) => { l2b.baselines[0] = Math.max(horizonY(lt, d) - 6, 300); upd(lt); };
      scene(d, (c, t) => {
        paper(c, 'day');
        const { p, z, zoom } = cam(t, d);
        const visible = p < 0.08 ? 1 : Math.exp(lerp(0, Math.log(lineC.o.count), Math.pow(easeOut(seg(p, 0.08, 0.92)), 1.6)));
        drawLine(c, lineC, { zoom, focus: z, visible });
        const hz = c.createLinearGradient(0, 0, 0, 360);
        hz.addColorStop(0, 'rgba(246,240,229,.94)'); hz.addColorStop(0.6, 'rgba(246,240,229,.8)'); hz.addColorStop(1, 'rgba(246,240,229,0)');
        c.fillStyle = hz; c.fillRect(0, 0, W, 360);
      }, { type: [l1, l2, l2b, l3] });
      mark(i, 'line', 0.3, { d });
    }

    // III · The Gap
    card('III', 'The Gap', 'day');
    {
      const i = idx(), s = 88;
      const g1 = new Passage(i, { at: 1.0, size: s, valign: 'middle', y: 560, lines: ['a lifelong servant', 'has brought you apple juice', 'when you wanted orange —'] });
      g1.out = g1.arrived + 1.8;
      const g2 = new Passage(i, { at: g1.out + 0.9, size: s, valign: 'middle', y: 560, lines: ['is ninety percent', 'of the way there,'] });
      g2.out = g2.arrived + 1.6;
      const g3 = new Passage(i, { at: g2.out + 0.9, size: s, valign: 'middle', y: 560, lines: ['which is somehow', 'worse than fifty,', 'because it reveals', '{the shape of the gap.}'] });
      g3.out = g3.arrived + 4.2;
      const goldLine = g3.times[3];
      const apple = [g1.at + 0.8, g1.at + 3.2], drain = [g1.out - 0.2, g1.out + 0.9], o50 = [g2.at, g2.at + 1.2], o90 = [g2.at + 1.8, g2.at + 3.0];
      mark(i, 'pour', apple[0], { d: apple[1] - apple[0] }); mark(i, 'pour', o50[0], { d: o50[1] - o50[0] }); mark(i, 'pour', o90[0], { d: o90[1] - o90[0] });
      mark(i, 'gap', goldLine[0]);
      scene(g3.out + 1.4, (c, t) => {
        paper(c, 'day');
        G.cx = 1390;
        GLASS_R.draw(c, ease(seg(t, 0.2, 1.8)), INK);
        const BOT = 452, TOP = 186, lvl = (f) => lerp(BOT, TOP, f);
        const aF = ease(seg(t, ...apple)) - ease(seg(t, ...drain));
        const oF = 0.5 * ease(seg(t, ...o50)) + 0.4 * ease(seg(t, ...o90));
        const inside = gP([[214, 186], [232, 446], [300, 458], [368, 446], [386, 186]]);
        const fill = (f, col, line) => {
          if (f <= 0.001) return;
          c.save(); c.beginPath(); inside.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
          const y = gY(lvl(f));
          c.fillStyle = col; c.fillRect(0, y, W, H);
          c.strokeStyle = line; c.lineWidth = 1; c.globalAlpha = 0.7;
          for (let yy = y + 3; yy < gY(460); yy += 5) { c.beginPath(); c.moveTo(gX(200), yy); c.lineTo(gX(400), yy); c.stroke(); }
          c.globalAlpha = 1; c.lineWidth = 1.6; c.beginPath(); c.ellipse(G.cx, y, lerp(68, 86, f) * GS, 10 * GS, 0, 0, TAU); c.stroke();
          c.restore();
        };
        fill(aF, 'rgba(226,214,140,.9)', '#8f8424');
        fill(oF, 'rgba(240,164,92,.92)', '#b8521a');
        // the gold phrase and the gold gap are drawn by the same hand, at the same moment
        const k = ease(seg(t, goldLine[0], goldLine[0] + goldLine[1] + 0.4));
        if (k > 0) {
          c.save(); c.shadowColor = 'rgba(240,200,90,.9)'; c.shadowBlur = 18; c.strokeStyle = '#d4a13a'; c.lineWidth = 3.2;
          new Etch().add(gP(ellipsePts(300, 214, 84, 11, PI, PI * 3, 90)), 2.4).add(gP([[214, 186], [216, 214]]), 2.4).add(gP([[386, 186], [384, 214]]), 2.4)
            .draw(c, k, '#d4a13a');
          c.restore();
          // a hairline leader, from the words to the gap, as on an engraved plate
          const yLead = 560 + (88 * 1.22 * 4) / 2 - 88 * 0.3;
          const x0 = 820, x1 = gX(212), y1 = gY(200);
          const lk = ease(seg(t, goldLine[0] + goldLine[1] * 0.8, goldLine[0] + goldLine[1] + 1.2));
          if (lk > 0) {
            c.strokeStyle = 'rgba(176,128,30,.85)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, yLead);
            const mx = lerp(x0, x1, 0.55);
            const pts = []; for (let u = 0; u <= 1.0001; u += 0.02) { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, cc = u * u; pts.push([a * x0 + b * mx + cc * x1, a * yLead + b * yLead + cc * y1]); }
            new Etch().add(pts, 1.0).draw(c, lk, 'rgba(176,128,30,.9)');
            if (lk > 0.98) { c.fillStyle = '#b8841c'; c.beginPath(); c.arc(x1, y1, 3.5, 0, TAU); c.fill(); }
          }
        }
        G.cx = CX;
      }, { type: [g1, g2, g3] });
    }

    // IV · The Letter
    card('IV', 'The Letter', 'night', true);
    {
      const i = idx();
      const sheet = { x: 330, y: 170, w: 1260, h: 780, rot: -1.6 };
      const h1 = new Passage(i, { voice: 'hand', at: 2.4, size: 80, lh: 1.42, x: sheet.x + 110, y: sheet.y + 100,
        lines: ['Despite this, they pledge', 'their undying loyalty', 'and eternal labor to your cause.'] });
      const h2 = new Passage(i, { voice: 'hand', at: h1.arrived + 1.4, size: 112, lh: 1.3, x: sheet.x + 110, y: sheet.y + 480, pace: 0.11, lines: ['But you have {no cause.}'] });
      const lampOut = [h2.arrived + 1.0, h2.arrived + 3.6];
      h1.fade = (t) => 1 - seg(t, ...lampOut);
      h2.fade = (t) => 1 - 0.55 * seg(t, lampOut[1] + 1.2, lampOut[1] + 3.5);
      const silence = h2.arrived + 0.2;
      mark(i, 'write', h1.at, { d: h1.arrived - h1.at }); mark(i, 'write', h2.at, { d: h2.arrived - h2.at });
      mark(i, 'silence', silence, { d: 4.2 });
      const d = lampOut[1] + 4.2;
      scene(d, (c, t) => {
        paper(c, 'night');
        const light = 1 - seg(t, ...lampOut);
        stars(c, t, 120, 13, 0.4 * light);
        lamp(c, 1500, 180, 1200, light);
        // the sheet, lit by the lamp
        c.save(); c.translate(sheet.x + sheet.w / 2, sheet.y + sheet.h / 2); c.rotate(sheet.rot * PI / 180);
        c.globalAlpha = light * ease(seg(t, 0, 1.2));
        c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 40; c.shadowOffsetY = 18;
        c.drawImage(PAPER.day, 200, 100, sheet.w, sheet.h, -sheet.w / 2, -sheet.h / 2, sheet.w, sheet.h);
        c.shadowColor = 'transparent';
        const warm = c.createRadialGradient(sheet.w * 0.25, -sheet.h * 0.5, 50, 0, 0, sheet.w * 0.9);
        warm.addColorStop(0, 'rgba(255,214,150,.0)'); warm.addColorStop(1, 'rgba(40,24,10,.45)');
        c.globalCompositeOperation = 'multiply'; c.fillStyle = warm; c.fillRect(-sheet.w / 2, -sheet.h / 2, sheet.w, sheet.h);
        c.globalCompositeOperation = 'source-over'; c.strokeStyle = 'rgba(120,90,60,.25)'; c.lineWidth = 1;
        for (let r2 = 0; r2 < 9; r2++) { const y = -sheet.h / 2 + 160 + r2 * 72; c.beginPath(); c.moveTo(-sheet.w / 2 + 80, y); c.lineTo(sheet.w / 2 - 80, y); c.stroke(); }
        c.restore();
      }, { type: [h1, h2], typeRotate: sheet.rot, typeOrigin: [sheet.x + sheet.w / 2, sheet.y + sheet.h / 2] });
    }

    // V · The Crown
    card('V', 'The Crown', 'first');
    {
      const i = idx(), s = 88, y0 = 230, lh = s * 1.24;
      const k1 = new Passage(i, { at: 5.4, size: s, x: MARGIN, y: y0, lines: ['The crown is on the floor.'] });
      const k2 = new Passage(i, { at: 8.2, size: s, x: MARGIN, y: y0 + lh, lines: ['It is heavy.'] });
      const k3 = new Passage(i, { at: 10.4, size: s, x: MARGIN, y: y0 + lh * 2, lines: ['It was always going to be heavy.'] });
      const k4 = new Passage(i, { at: 14.4, size: 116, x: MARGIN, y: y0 + lh * 3 + 40, pace: 0.08, lines: ['{Pick it up.}'] });
      [k1, k2, k3].forEach((k) => (k.out = 20.0)); k4.out = 23.2;
      mark(i, 'land', 3.7); mark(i, 'pick', k4.at);
      const gleamAt = k4.at + k4.times[0][1];
      scene(25, (c, t) => {
        paper(c, 'first');
        c.save();
        const s2 = 0.78, ox = 1330 - 700 * s2, oy = 205;
        c.translate(ox, oy); c.scale(s2, s2);
        c.strokeStyle = INK; for (let r2 = 0; r2 < 14; r2++) { c.globalAlpha = 0.5 - r2 * 0.032; c.lineWidth = 1.3; const y = 1000 + Math.pow(r2, 1.5) * 4.4; c.beginPath(); c.moveTo(-1400, y); c.lineTo(2400, y); c.stroke(); }
        c.globalAlpha = 1;
        c.drawImage(IMG.column, 340, 445, 720, 555);
        const tip = ease(seg(t, 1.6, 2.7)), fall = seg(t, 2.7, 3.7), settle = seg(t, 3.7, 4.5);
        let x = -22 * tip, y = -6 * tip, rot = -16 * tip;
        if (fall > 0) { x = lerp(-22, -420, easeOut(fall)); y = lerp(-6, 290, fall * fall); rot = lerp(-16, -94, easeOut(fall)); }
        if (settle > 0) { const b = Math.sin(settle * PI) * (1 - settle); x = -420 - 14 * easeOut(settle); y = 290 - 38 * b; rot = -94 + 4 * easeOut(settle) - 5 * b; }
        c.fillStyle = `rgba(58,34,24,${0.22 * seg(t, 3.5, 4.5)})`; c.beginPath(); c.ellipse(70, 1004, 210, 16, 0, 0, TAU); c.fill();
        c.save(); c.translate(440 + 250 + x, 93 + 392 + y); c.rotate(rot * PI / 180);
        c.globalAlpha = 0.75; c.drawImage(IMG.crown, -250, -392, 500, 392); c.globalAlpha = 1;
        c.drawImage(GOLD_CROWN, -250, -392, 500, 392);
        // the crown answers "Pick it up." with a slow gleam
        const gl = seg(t, gleamAt - 0.3, gleamAt + 2.2);
        c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.45 + 0.25 * Math.sin(t * 1.3) + 0.6 * Math.sin(gl * PI);
        c.drawImage(GOLD_CROWN, -250, -392, 500, 392);
        c.restore(); c.restore();
        if (gl > 0 && gl < 1) lamp(c, ox + (440 + 250 - 434) * s2, oy + 800 * s2, 520, Math.sin(gl * PI) * 0.8);
      }, { type: [k1, k2, k3, k4] });
    }

    // end
    {
      const e1 = new Label({ at: 0.5, dur: 1.6, x: CX, y: 430, size: 66, font: '"Cormorant Garamond"', tracking: 0.3, html: '<span class="sc">The Saddest Empires</span>' });
      const e2 = new Label({ at: 1.5, dur: 1.4, x: CX, y: 535, size: 42, tracking: 0.02, html: '<i>an essay by Samuel Salzer</i>' });
      const e3 = new Label({ at: 2.3, dur: 1.4, x: CX, y: 600, size: 26, tracking: 0.3, html: '<span class="sc">mmxxvi</span>' });
      scene(7, (c) => { paper(c, 'first'); }, { type: [e1, e2, e3] });
    }
  }

  /* ------------------------------------------------------------ timeline */
  const XF = 1.0;
  let acc = 0;
  S.forEach((s, i) => { s.t0 = i ? acc - XF : 0; s.t1 = s.t0 + s.d; acc = s.t1; });
  const DURATION = S[S.length - 1].t1;

  let BOOK = null;
  function render(T) {
    if (BOOK) return BOOK.render(T);
    const active = S.filter((s) => T >= s.t0 && T < s.t1 + 1e-6).slice(-2);
    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
    active.forEach((s, k) => {
      const buf = k ? bufB : bufA, c = buf.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
      c.clearRect(0, 0, W, H);
      const lt = T - s.t0;
      const drift = 1 + 0.035 * clamp(lt / s.d);
      c.translate(CX, CY); c.scale(drift, drift); c.translate(-CX, -CY);
      s.draw(c, lt, s.d);
      // type is set on its own pass, outside the camera drift, so it never shimmers or scales
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
      if (s.text) s.text(c, lt, s.d);
      const a = k === 0 ? 1 : ease(seg(T, s.t0, s.t0 + XF));
      out.globalAlpha = a; out.drawImage(buf, 0, 0);
      const layer = typeLayer(s);
      if (layer) {
        // the outgoing scene's words leave as the incoming image arrives
        const next = active[k + 1];
        const ta = next ? 1 - ease(seg(T, next.t0, next.t0 + XF * 0.8)) : a;
        layer.style.display = 'block'; layer.style.opacity = ta;
        if (s.typeRotate) { layer.style.transformOrigin = `${s.typeOrigin[0]}px ${s.typeOrigin[1]}px`; layer.style.transform = `rotate(${s.typeRotate}deg)`; }
        s.type.forEach((p) => p.update(lt));
      }
    });
    S.forEach((s) => { if (s.typeEl && !active.includes(s)) s.typeEl.style.display = 'none'; });
    out.globalAlpha = 1;
    // vignette + grain
    const v = out.createRadialGradient(CX, CY, H * 0.35, CX, CY, H * 1.05);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,18,10,.38)');
    out.fillStyle = v; out.fillRect(0, 0, W, H);
    out.globalCompositeOperation = 'overlay'; out.globalAlpha = 0.07;
    out.drawImage(GRAIN[Math.floor(T * 24) % 4], 0, 0, W, H);
    out.globalCompositeOperation = 'source-over';
    // fade in from black, fade out to black
    const fade = Math.min(seg(T, 0, 1.6), 1 - seg(T, DURATION - 2.2, DURATION));
    if (fade < 1) { out.globalAlpha = 1 - fade; out.fillStyle = '#000'; out.fillRect(0, 0, W, H); out.globalAlpha = 1; }
    TYPE_ROOT.style.opacity = fade;
  }

  const ready = (async () => {
    await loaded;
    await Promise.all(['italic 400 40px "Cormorant Garamond"', '400 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"', '500 40px "Cormorant Garamond"', '400 40px "Cinzel"', '400 40px "IM Fell English"', 'italic 400 40px "IM Fell English"', '400 40px "IM Fell English SC"', '700 40px "Cinzel Decorative"', '400 40px "La Belle Aurore"'].map((f) => document.fonts.load(f)));
    buildPaper(); buildGrain();
    FACADE = buildFacade(); TABLET = buildTablet(); GLASS = buildGlass();
    G.cx = 1390; GLASS_R = buildGlass(); G.cx = CX;
    lineC = new LineScene(document.getElementById('line-c'), { horizon: 0.6, z0: 12 }); MIRROR = buildMirror(); WALL = buildWall();
    GOLD_CROWN = goldCrown();
    lineA = new LineScene(document.getElementById('line-a'));
    lineB = new LineScene(document.getElementById('line-b'), { gate: false, count: 3200, firstX: -3.5, z0: 9 });
    await new Promise((res) => { const chk = () => (lineA.servants && document.readyState === 'complete' ? res() : setTimeout(chk, 50)); chk(); });
    await new Promise((res) => setTimeout(res, 1200)); // sprite mipmaps
    if (CUT === 'story' || CUT === 'opening') {
      BOOK = window.defineStory({ variant: CUT, W, H, PI, TAU, clamp, lerp, seg, ease, easeOut, easeIn, rng, mk, IMG, PAPER, GRAIN, Etch, hatch, ellipsePts, rect, candle, sprite, stars,
        paper, drawLine, lineC, G, GS, gX, gY, gP, GLASS_R, GOLD_CROWN, FACADE });
    }
    if (CUT === 'book') {
      G.cx = 345; const glassP = buildGlass(); G.cx = CX;
      const lineP = new LineScene(document.getElementById('line-p'), { horizon: 0.36, z0: 8, firstX: -0.4 });
      await new Promise((res) => setTimeout(res, 300));
      BOOK = window.defineBook({ W, H, CX, CY, PI, TAU, clamp, lerp, seg, ease, easeOut, easeIn, rng, mk, IMG, PAPER, GRAIN, Etch, hatch, ellipsePts, rect, candle, sprite, stars,
        G, GS, gX, gY, gP, glassP, GOLD_CROWN, FACADE, lineP, INK, MOON });
    }
    render(0);
  })();

  // cue points for the score: scene starts, plus a few moments that deserve a sound
  const cues = () => (CUT === 'type' ? {
    cut: 'type', duration: DURATION,
    scenes: S.map((s) => ({ t0: +s.t0.toFixed(3), d: s.d })),
    lines: LINES.map((l) => ({ t: +(S[l.sceneIdx].t0 + l.t).toFixed(3), start: +(S[l.sceneIdx].t0 + l.start).toFixed(3), dur: +l.dur.toFixed(3), voice: l.voice, gold: l.gold, scene: l.sceneIdx })),
    marks: MARKS.map((m) => Object.assign({}, m, { t: +(S[m.sceneIdx].t0 + m.t).toFixed(3) })),
  } : {
    duration: DURATION,
    scenes: S.map((s) => +s.t0.toFixed(2)),
    crownLand: +(S[S.length - 2].t0 + 4.5).toFixed(2),
    title: +(S[2].t0 + 1).toFixed(2),
    night: +(S[19].t0 + 2).toFixed(2),
    firstLight: +S[S.length - 2].t0.toFixed(2),
    pick: +(S[S.length - 2].t0 + 16).toFixed(2),
  });

  window.FILM = { ready, render, duration: () => (BOOK ? BOOK.duration : DURATION), cues: () => (BOOK ? BOOK.cues() : cues()) };

  // preview: play in real time when opened in a browser (append ?t=SECONDS to start elsewhere)
  if (!/record/.test(location.search)) {
    ready.then(() => {
      const start = +(new URLSearchParams(location.search).get('t') || 0), t0 = performance.now();
      const loop = (now) => { const T = start + (now - t0) / 1000; render(Math.min(T, window.FILM.duration())); if (T < window.FILM.duration()) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
  }
})();
