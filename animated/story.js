/* The Saddest Empires — the story cut (film.html?cut=story).

   The book is the frame, not the whole film:
   - PROLOGUE: a closed book on a desk by candlelight. "I want to tell you a story…" The book opens.
   - The first page is written, then sinks into the paper. The camera travels into the plate
     on the right-hand page until the engraving fills the screen: we are inside the book.
   - INSIDE: full-frame scenes with narration. Narration flows as one continuous stream, character
     by character at reading pace, and always sits in one of four designated places:
       lower  — a band along the bottom, for running narration
       side   — a column on the left, for longer passages beside a picture on the right
       top    — a band across the sky, when the picture needs the ground
       centre — a single statement on an empty frame
   - EPILOGUE: the camera pulls back out into the book. "Pick it up." is written on the page. The book closes.

   defineStory(lib) is called by film.js once assets and fonts are ready. */
window.defineStory = function (L) {
  const { W, H, PI, TAU, clamp, lerp, seg, ease, easeOut, easeIn, rng, mk, IMG, PAPER, Etch, hatch, ellipsePts, rect, candle, stars, pixelated } = L;
  const CX = W / 2, CY = H / 2;
  const INK = '#1d120b', MOON = '#efe6d6', GOLD_A = '#7a5208', GOLD_B = '#b8841c';

  /* ============================================================ narration: continuous, flowing text */
  const sg = mk(64, 64).getContext('2d');
  const VOICE = {
    narrator: (it) => `${it ? 'italic ' : ''}400 SIZEpx "IM Fell English"`,
    quote: (it) => `${it ? '' : 'italic '}400 SIZEpx "IM Fell English"`,
    hand: () => '400 SIZEpx "La Belle Aurore"',
  };
  const MODES = {
    lower: { x: 180, w: 1180, size: 50, anchor: 'bottom', y: 1000, align: 'left' },
    side: { x: 150, w: 680, size: 58, anchor: 'middle', y: 540, align: 'left' },
    top: { x: CX, w: 1500, size: 54, anchor: 'top', y: 90, align: 'center' },
    centre: { x: CX, w: 1400, size: 84, anchor: 'middle', y: 540, align: 'center' },
    book: { x: 214, w: 640, size: 54, anchor: 'top', y: 250, align: 'left' },            // the left page of the book
    bookCentre: { x: 214 + 320, w: 640, size: 88, anchor: 'middle', y: 560, align: 'center' },
    sheet: { x: 440, w: 1040, size: 64, anchor: 'top', y: 300, align: 'left' },          // the lamplit letter
  };
  function tokens(text) {
    const out = []; const re = /(\{[^}]+\}|\*[^*]+\*|\[[^\]]+\])/g; let last = 0, m;
    const push = (s, st) => s.split(/(\s+)/).forEach((w, i) => {
      if (!w) return; const prev = out[out.length - 1];
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
  // A passage: laid out once into characters with exact positions, then revealed as a flowing stream.
  function passage(o) {
    const M = MODES[o.mode];
    const P = Object.assign({ voice: 'narrator', cps: 17, night: false, lh: 1.34 }, M, o);
    const fontFor = (tk) => (tk.sc ? `400 ${P.size}px "IM Fell English SC"` : VOICE[P.voice](tk.italic).replace('SIZE', P.size));
    // wrap
    const lines = []; let cur = [], w = 0;
    const flush = () => { while (cur.length && /^\s+$/.test(cur[cur.length - 1].t)) cur.pop(); if (cur.length) lines.push(cur); cur = []; w = 0; };
    const indent = (i) => (P.initial && i < 3 ? P.initial + 22 : 0);
    for (const tk of tokens(P.text)) {
      if (tk.t.trim() === '/') { flush(); continue; }
      sg.font = fontFor(tk); const tw = sg.measureText(tk.t).width;
      if (/^\s+$/.test(tk.t)) { if (cur.length) { cur.push({ ...tk, w: tw }); w += tw; } continue; }
      if (cur.length && w + tw > P.w - indent(lines.length)) {
        const carry = []; if (tk.glue) while (cur.length && !/^\s+$/.test(cur[cur.length - 1].t)) carry.unshift(cur.pop());
        flush(); carry.forEach((c2) => { cur.push(c2); w += c2.w; });
      }
      cur.push({ ...tk, w: tw }); w += tw;
    }
    flush();
    // characters, with positions and the moment each one arrives
    const lh = P.size * P.lh, blockH = lines.length * lh;
    const top = P.anchor === 'bottom' ? P.y - blockH : P.anchor === 'middle' ? P.y - blockH / 2 : P.y;
    P.chars = []; let t = P.at;
    lines.forEach((ln, li) => {
      const lw = ln.reduce((s, tk) => s + tk.w, 0);
      let x = (P.align === 'center' ? P.x - lw / 2 : P.x + indent(li));
      const base = top + P.size * 0.98 + li * lh;
      for (const tk of ln) {
        const f = fontFor(tk); sg.font = f;
        for (let k = 0; k < tk.t.length; k++) {
          const ch = tk.t[k];
          const cx = x + sg.measureText(tk.t.slice(0, k)).width;
          P.chars.push({ ch, x: cx, y: base, font: f, gold: tk.gold, at: t });
          t += 1 / P.cps;
          if (/[,;:]/.test(ch)) t += 0.14;
          if (/[.!?—]/.test(ch) && k === tk.t.length - 1) t += 0.34;
        }
        x += tk.w;
      }
      t += 0.04;                                      // a line break costs almost nothing: the flow carries on
    });
    P.written = t;
    const words = P.text.split(/\s+/).length;
    P.out = P.out ?? P.written + (P.hold ?? Math.max(1.8, words * 0.16));
    P.gone = P.out + (P.sink ? 1.6 : 0.9);
    P.top = top; P.blockH = blockH;
    return P;
  }
  const block = mk(W, H), bg = block.getContext('2d');
  const grain = (() => { const r = rng(9), a = new Float32Array(W * 360); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
  function drawPassage(c, P, t) {
    if (t < P.at - 0.01 || t > P.gone) return;
    const fade = P.sink ? 0 : ease(seg(t, P.out, P.gone));
    const target = P.sink && t > P.out ? bg : c;
    if (target === bg) bg.clearRect(0, 0, W, H);
    const drift = fade * -14;
    let lastFont = '';
    for (const ch of P.chars) {
      const a = easeOut(clamp((t - ch.at) / 0.45));
      if (a <= 0) break;
      if (ch.font !== lastFont) { target.font = ch.font; lastFont = ch.font; }
      if (ch.gold) {
        const gr = target.createLinearGradient(ch.x, ch.y - P.size, ch.x + P.size * 0.6, ch.y);
        gr.addColorStop(0, P.night ? '#caa04a' : GOLD_A); gr.addColorStop(1, P.night ? '#f2d58c' : GOLD_B);
        target.fillStyle = gr;
      } else target.fillStyle = P.night ? MOON : INK;
      target.globalAlpha = a * (1 - fade);
      target.fillText(ch.ch, ch.x, ch.y + (1 - a) * P.size * 0.12 + drift);
    }
    target.globalAlpha = 1;
    if (target === bg) {
      // the diary: the ink spreads a moment, then the paper grain takes it
      const k = seg(t, P.out, P.gone), y0 = Math.max(0, Math.floor(P.top - P.size)), h = Math.min(H - y0, Math.ceil(P.blockH + P.size * 1.5));
      const x0 = Math.max(0, Math.floor((P.align === 'center' ? P.x - P.w / 2 : P.x) - 20)), w = Math.min(W - x0, P.w + 60);
      const img = bg.getImageData(x0, y0, w, h), d = img.data, th = clamp((k - 0.15) / 0.85);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const j = (yy * w + xx) * 4; if (!d[j + 3]) continue;
        d[j + 3] *= clamp((grain[(yy % 360) * W + xx] - th) / 0.12) * (1 - 0.3 * th);
      }
      bg.putImageData(img, x0, y0);
      const bleed = Math.sin(clamp(k / 0.3) * PI) * 0.5;
      if (bleed > 0.02) { c.save(); c.filter = 'blur(2.5px)'; c.globalAlpha = bleed; c.drawImage(block, 0, 0); c.restore(); }
      c.drawImage(block, 0, 0);
    }
  }
  // quiet bands behind narration, so the words always have a calm ground
  function scrim(c, mode, a, night) {
    if (a <= 0) return;
    const col = night ? '10,10,16' : '246,240,229';
    let g;
    if (mode === 'lower') { g = c.createLinearGradient(0, H - 360, 0, H); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.45, `rgba(${col},${0.78 * a})`); g.addColorStop(1, `rgba(${col},${0.9 * a})`); c.fillStyle = g; c.fillRect(0, H - 360, W, 360); }
    if (mode === 'top') { g = c.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, `rgba(${col},${0.92 * a})`); g.addColorStop(0.6, `rgba(${col},${0.75 * a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, W, 380); }
    if (mode === 'side') { g = c.createLinearGradient(0, 0, 1050, 0); g.addColorStop(0, `rgba(${col},${0.9 * a})`); g.addColorStop(0.72, `rgba(${col},${0.75 * a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, 1050, H); }
  }

  /* ============================================================ full-frame worlds (also used inside the plate) */
  const WORLD = {};
  WORLD.morning = (c, t, o = {}) => {
    L.paper(c, 'dark'); stars(c, t, 150, 3, 0.6);
    const gx = 1240, gy = 520, pulse = 1 + 0.03 * Math.sin(t * 2);
    c.save(); c.globalCompositeOperation = 'screen';
    const gl = c.createRadialGradient(gx, gy, 0, gx, gy, 620 * pulse);
    gl.addColorStop(0, 'rgba(170,190,235,.55)'); gl.addColorStop(0.35, 'rgba(80,100,150,.16)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H); c.restore();
    c.fillStyle = 'rgba(222,232,250,.95)'; c.fillRect(gx - 100, gy - 175, 200, 350);
    c.strokeStyle = 'rgba(20,20,30,.9)'; c.lineWidth = 3; c.strokeRect(gx - 106, gy - 181, 212, 362);
    c.fillStyle = 'rgba(30,30,44,.9)'; c.fillRect(gx - 22, gy - 166, 44, 6);
    c.fillStyle = 'rgba(110,122,160,.55)'; for (let l = 0; l < 12; l++) c.fillRect(gx - 70, gy - 130 + l * 24, 80 + ((l * 37) % 60), 7);
    if (o.letters !== false) {
      const letters = 'ascripttenpageanalysisadraftofsomethingyouhavebeenmeaningtowriteformonths', r = rng(31);
      c.font = 'italic 40px "IM Fell English"'; c.textBaseline = 'alphabetic';
      for (let i = 0; i < 170; i++) {
        const born = (o.lettersAt ?? 0) + r() * 14, life = 3.6 + r() * 2.4, dx = (r() - 0.6) * 900, sway = r() * TAU;
        const q = (t - born) / life; if (q < 0 || q > 1) { r(); continue; }
        c.globalAlpha = Math.sin(q * PI) * 0.8; c.fillStyle = '#e9eefa';
        c.fillText(letters[i % letters.length], gx + dx * easeOut(q) + Math.sin(t * 1.3 + sway) * 18, gy - 200 - q * 420); r();
      }
      c.globalAlpha = 1;
    }
    if (o.buildAt !== undefined && t > o.buildAt) {
      c.save(); c.translate(760, 300); c.scale(0.62, 0.62); c.translate(-W / 2, -540);
      L.FACADE.draw(c, ease(seg(t, o.buildAt, o.buildAt + 10)), 'rgba(228,232,246,.85)');
      c.restore();
    }
  };
  WORLD.simon = (c, t, o) => {
    L.paper(c, 'day');
    candle(c, 1380, 900, 460, t, 1 - 0.7 * seg(t, o.dimAt, o.dimAt + 5));
    const r = rng(77), N = Math.floor(Math.min(160, Math.exp(Math.max(0, t - 3) * 0.55)));
    for (let k = 0; k < N; k++) {
      let x = 1000 + r() * 950, y = r() * H; const a = (r() - 0.5) * 0.7, w = 130 + r() * 80, h = w * 1.3;
      if (k < 25 && Math.abs(x - 1380) < 170 && y > 340) x += x < 1380 ? -300 : 300;
      const born = Math.log(k + 1) / 0.55 + 3, kk = easeOut(seg(t, born, born + 0.35));
      c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = kk;
      c.fillStyle = 'rgba(251,247,240,.98)'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(-w / 2, -h / 2, w, h);
      c.globalAlpha = kk * 0.42; for (let l = 0; l < 10; l++) { c.beginPath(); c.moveTo(-w / 2 + 12, -h / 2 + 20 + l * (h - 34) / 10); c.lineTo(w / 2 - 14 - r() * 30, -h / 2 + 20 + l * (h - 34) / 10); c.stroke(); }
      c.restore();
    }
  };
  WORLD.line = (c, t, o) => {
    L.paper(c, 'day');
    const p = seg(t, 0.3, o.d - 1), z = ease(seg(p, 0.04, 0.95)), lp = L.lineC;
    const visible = p < 0.08 ? 1 : Math.exp(lerp(0, Math.log(lp.o.count), Math.pow(easeOut(seg(p, 0.08, 0.92)), 1.6)));
    L.drawLine(c, lp, { zoom: lerp(2.3, 1.05, z), focus: z, visible });
  };
  WORLD.glass = (c, t, o) => {
    L.paper(c, 'day');
    const { G, GS, gX, gY, gP } = L;
    // a servant behind the table, who has just set the tray down
    { const img = IMG.s3, h = 900, w = (img.width / img.height) * h; c.save(); c.translate(1790, 1020); c.scale(-1, 1); c.globalAlpha = 0.9; c.drawImage(spriteAt(2, 480).fill, -w / 2, -h, w, h); c.drawImage(img, -w / 2, -h, w, h); c.restore(); c.globalAlpha = 1; }
    // the table: a linen cloth over it, falling in folds at the front
    const top = [[930, 760], [W + 40, 760], [W + 40, 900], [880, 900]];
    c.fillStyle = 'rgb(246,241,231)'; c.beginPath(); top.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
    const et = new Etch().add([...top.slice(0, 1), top[3], [880, 1010]], 1.6).add([[930, 760], [W + 40, 760]], 1.3).add([[880, 900], [W + 40, 900]], 1.6);
    for (let k = 0; k < 16; k++) { const x = 900 + k * 66; et.add([[x, 902], [x + Math.sin(k) * 6, 1080]], 0.9, 0.55); }
    et.addAll(hatch([[880, 902], [W + 40, 902], [W + 40, H], [880, H]], 90, 6, 1.2, 5), 0.5, 0.3);
    et.draw(c, 1, INK);
    G.cx = 1390;
    L.GLASS_R.draw(c, ease(seg(t, 0.2, 1.8)), INK);
    const BOT = 452, TOP = 186, lvl = (f) => lerp(BOT, TOP, f);
    const aF = ease(seg(t, ...o.apple)) - ease(seg(t, ...o.drain));
    const oF = 0.5 * ease(seg(t, ...o.o50)) + 0.4 * ease(seg(t, ...o.o90));
    const inside = gP([[214, 186], [232, 446], [300, 458], [368, 446], [386, 186]]);
    const fill = (f, col, line) => {
      if (f <= 0.001) return;
      c.save(); c.beginPath(); inside.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
      const y = gY(lvl(f)); c.fillStyle = col; c.fillRect(0, y, W, H);
      c.strokeStyle = line; c.lineWidth = 1; c.globalAlpha = 0.7;
      for (let yy = y + 3; yy < gY(460); yy += 5) { c.beginPath(); c.moveTo(gX(200), yy); c.lineTo(gX(400), yy); c.stroke(); }
      c.globalAlpha = 1; c.lineWidth = 1.6; c.beginPath(); c.ellipse(G.cx, y, lerp(68, 86, f) * GS, 10 * GS, 0, 0, TAU); c.stroke();
      c.restore();
    };
    fill(aF, 'rgba(226,214,140,.92)', '#8f8424');
    fill(oF, 'rgba(240,164,92,.94)', '#b8521a');
    const k = ease(seg(t, o.gapAt, o.gapAt + 1.6));
    if (k > 0) {
      c.save(); c.shadowColor = 'rgba(230,180,70,.9)'; c.shadowBlur = 16;
      new Etch().add(gP(ellipsePts(300, 214, 84, 11, PI, PI * 3, 90)), 2.6).add(gP([[214, 186], [216, 214]]), 2.6).add(gP([[386, 186], [384, 214]]), 2.6).draw(c, k, '#c9962e');
      c.restore();
    }
    G.cx = CX;
  };
  WORLD.letter = (c, t, o) => {
    L.paper(c, 'night');
    const light = 1 - seg(t, o.lampOut[0], o.lampOut[1]);
    stars(c, t, 120, 13, 0.35 * light);
    const sheet = { x: 300, y: 150, w: 1320, h: 800, rot: -1.4 };
    c.save(); c.globalCompositeOperation = 'screen';
    const g = c.createRadialGradient(1500, 160, 0, 1500, 160, 1250); g.addColorStop(0, `rgba(255,196,120,${0.32 * light})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    c.save(); c.translate(sheet.x + sheet.w / 2, sheet.y + sheet.h / 2); c.rotate(sheet.rot * PI / 180);
    c.globalAlpha = light * ease(seg(t, o.sheetAt ?? 0, (o.sheetAt ?? 0) + 1.2));
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 40; c.shadowOffsetY = 18;
    c.drawImage(PAPER.day, 200, 100, sheet.w, sheet.h, -sheet.w / 2, -sheet.h / 2, sheet.w, sheet.h);
    c.shadowColor = 'transparent';
    const warm = c.createRadialGradient(sheet.w * 0.25, -sheet.h * 0.5, 50, 0, 0, sheet.w * 0.9);
    warm.addColorStop(0, 'rgba(255,214,150,0)'); warm.addColorStop(1, 'rgba(40,24,10,.45)');
    c.globalCompositeOperation = 'multiply'; c.fillStyle = warm; c.fillRect(-sheet.w / 2, -sheet.h / 2, sheet.w, sheet.h);
    c.restore();
  };
  // the crown, drawn about the bottom centre of its band
  // lying on its side, the crown rests on its band and the tips of two points (measured from the artwork)
  const REST = { rot: 1.4, drop: 188.8, x0: -27, x1: 388 };
  function crownPose(c, x, y, rot, s, t, gleam = 0) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.globalAlpha = 0.8; c.drawImage(IMG.crown, -250, -392, 500, 392); c.globalAlpha = 1;
    c.drawImage(L.GOLD_CROWN, -250, -392, 500, 392);
    c.globalCompositeOperation = 'screen'; c.globalAlpha = clamp(0.35 + 0.15 * Math.sin(t * 1.3) + 0.65 * gleam);
    c.drawImage(L.GOLD_CROWN, -250, -392, 500, 392);
    c.restore();
  }
  // the frontispiece: a crown on a column in a quiet marble hall. With o.fallAt it tips and falls; without, it lies on the floor.
  const FRONT = { px: 1180, pb: 1000, ps: 0.74, sC: 0.56, LX: 1392 };
  WORLD.crown = (c, t, o = {}) => {
    L.paper(c, o.dawn ? 'first' : 'day');
    const VY = 612, f = 900, h = 2.4, P = (x, z) => [960 + (f * x) / z, VY + (f * h) / z];
    c.strokeStyle = 'rgba(43,26,18,.1)'; c.lineWidth = 1;
    for (let y = 70; y < VY; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let row = 0, y = 70; y < VY; y += 30, row++) for (let x = (row % 2) * 90; x < W; x += 180) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 30); c.stroke(); }
    const fl = [P(-40, 1.5), P(40, 1.5), P(40, 60), P(-40, 60)];
    c.fillStyle = 'rgb(240,232,218)'; c.beginPath(); fl.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.fill();
    for (let zi = 1.4; zi < 60; zi += 1.4) {
      const z1 = zi + 1.4, rowH = P(0, zi)[1] - P(0, z1)[1]; if (rowH < 0.6) break;
      for (let xi = -20; xi < 20; xi++) {
        if ((xi + Math.round(zi / 1.4)) % 2 === 0) continue; const x0 = xi * 1.4;
        const q = [P(x0, zi), P(x0 + 1.4, zi), P(x0 + 1.4, z1), P(x0, z1)];
        c.fillStyle = `rgba(150,120,90,${0.12 * Math.min(1, rowH / 6)})`; c.beginPath(); q.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.fill();
      }
    }
    c.strokeStyle = 'rgba(43,26,18,.16)'; c.beginPath();
    for (let x = -28; x <= 28; x += 1.4) { const a = P(x, 1.5), b = P(x, 60); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); } c.stroke();
    c.strokeStyle = 'rgba(43,26,18,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, VY); c.lineTo(W, VY); c.stroke();
    // a pool of light on the column
    c.save(); c.globalCompositeOperation = 'screen';
    const pl = c.createRadialGradient(FRONT.px, 520, 0, FRONT.px, 520, 900); pl.addColorStop(0, 'rgba(255,238,200,.35)'); pl.addColorStop(1, 'rgba(255,238,200,0)');
    c.fillStyle = pl; c.fillRect(0, 0, W, H); c.restore();
    c.fillStyle = 'rgba(58,34,24,.22)'; c.beginPath(); c.ellipse(FRONT.px + 40, FRONT.pb + 2, 250, 20, 0, 0, TAU); c.fill();
    pedestal(c, FRONT.px, FRONT.pb, FRONT.ps);
    // the crown
    const sC = FRONT.sC, top = FRONT.pb - (PED_H - 45) * FRONT.ps, piv = [FRONT.px + 250 * sC, top], LY = FRONT.pb - REST.drop * sC;
    let x = FRONT.LX, y = LY, rot = REST.rot, lying = 1;
    if (o.fallAt !== undefined) {
      const u = t - o.fallAt;
      const tipped = (r) => [piv[0] - 250 * sC * Math.cos(r), piv[1] - 250 * sC * Math.sin(r)];
      if (u < 1.1) { rot = u < 0 ? 0 : 0.3 * easeIn(u / 1.1) + 0.03 * Math.sin(u * 9) * (1 - u / 1.1) * (u > 0 ? 1 : 0); [x, y] = tipped(Math.max(0, rot)); lying = 0; }
      else if (u < 2.0) { const v = (u - 1.1) / 0.9, [x0, y0] = tipped(0.3); x = lerp(x0, FRONT.LX, v); y = y0 + (LY - y0) * v * v; rot = lerp(0.3, REST.rot + 0.16, v); lying = v; }
      else { const w = clamp((u - 2.0) / 0.9), b = Math.sin(w * PI) * (1 - w); y = LY - 26 * b; rot = REST.rot + 0.16 - 0.16 * easeOut(w) + 0.05 * b; }
    }
    c.fillStyle = `rgba(58,34,24,${0.3 * lying})`; c.beginPath(); c.ellipse(FRONT.LX + ((REST.x0 + REST.x1) / 2) * sC, FRONT.pb + 1, ((REST.x1 - REST.x0) / 2) * sC, 10, 0, 0, TAU); c.fill();
    const g = o.gleamAt !== undefined ? Math.sin(clamp(seg(t, o.gleamAt - 0.3, o.gleamAt + 2.4)) * PI) : 0;
    crownPose(c, x, y, rot, sC, t, g);
    if (o.dawn) {                                               // first light, from a high window on the left
      c.save(); c.globalCompositeOperation = 'screen';
      const sh = c.createLinearGradient(200, 0, 1300, 1000); sh.addColorStop(0, 'rgba(255,236,200,.4)'); sh.addColorStop(1, 'rgba(255,236,200,0)');
      c.fillStyle = sh; c.beginPath(); c.moveTo(80, 0); c.lineTo(520, 0); c.lineTo(1700, H); c.lineTo(1000, H); c.closePath(); c.fill(); c.restore();
    }
  };

  // the figures are drawn in line only; a paper-coloured silhouette under each lets the near ones stand in front of the far ones
  function silhouette(cv) {
    const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, r = Math.max(1, Math.round(h / 90));
    const solid = new Uint8Array(w * h), dil = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 24 ? 1 : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!solid[y * w + x]) continue;
      for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) dil[yy * w + xx] = 1;
    }
    const st = [];
    for (let x = 0; x < w; x++) { st.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1); }
    while (st.length) { const i = st.pop(); if (out[i] || dil[i]) continue; out[i] = 1; const x = i % w, y = (i / w) | 0; if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w); }
    // erode back to the drawn outline: this also removes the specks the dilation grew
    const keep = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (out[y * w + x]) continue; let ok = 1;
      for (let yy = Math.max(0, y - r); ok && yy <= Math.min(h - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) if (out[yy * w + xx]) { ok = 0; break; }
      keep[y * w + x] = ok;
    }
    const f = mk(w, h), g = f.getContext('2d'), im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) if (keep[i]) { im.data[i * 4] = 242; im.data[i * 4 + 1] = 235; im.data[i * 4 + 2] = 220; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    return f;
  }
  const MIPS = [IMG.s1, IMG.s2, IMG.s3, IMG.s4, IMG.s5, IMG.s6].map((img) => [16, 32, 64, 128, 256, 480].map((h) => {
    const w = Math.max(1, Math.round((img.width / img.height) * h)), cv = mk(w, h), g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h); cv.fill = silhouette(cv); return cv;
  }));
  const spriteAt = (i, px) => { for (const cv of MIPS[i]) if (cv.height >= px) return cv; return MIPS[i][MIPS[i].length - 1]; };
  const CROWD = (() => {
    const r = rng(21), a = [];
    for (let k = 0; k < 54; k++) {
      const z = 5.2 * Math.pow(1.085, k), far = z > 60, nj = far ? 70 : 7, sp = far ? 1.25 : 1.08;
      if (z < 16 && k % 2) continue;                          // an orderly court: fewer, clearer rows up close
      for (let j = 0; j < nj; j++) for (const sgn of [-1, 1]) {
        const x = sgn * (1.5 + j * sp + (r() - 0.5) * 0.25);
        if (!far && Math.abs(x) > 8.2) continue;
        a.push({ z: z * (1 + (r() - 0.5) * 0.03), x, s: Math.floor(r() * 6), flip: r() < 0.5, h: 1.75 * (0.92 + r() * 0.14), k });
      }
    }
    return a.sort((p2, q) => q.z - p2.z);
  })();
  const CROWD_NEAR = CROWD.filter((p2) => p2.z <= 59), CROWD_FAR = CROWD.filter((p2) => p2.z > 59);
  function armrest(c, side) {
    // a carved, gilded arm of the throne, rising into the frame from a bottom corner
    c.save(); if (side > 0) { c.translate(W, 0); c.scale(-1, 1); }
    const body = [[-40, 1120], [-40, 930], [120, 880], [300, 858], [360, 862]];
    const top = [[360, 862], [420, 870], [452, 905], [440, 950], [398, 968], [360, 950], [350, 915], [380, 900]];
    c.beginPath(); c.moveTo(-40, 1120);
    [...body.slice(1), ...top].forEach(([x, y]) => c.lineTo(x, y));
    c.lineTo(330, 1000); c.lineTo(220, 1040); c.lineTo(120, 1120); c.closePath();
    const g = c.createLinearGradient(0, 860, 0, 1100);
    g.addColorStop(0, '#e2b75a'); g.addColorStop(0.35, '#9c6e1c'); g.addColorStop(1, '#4a3008');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(40,22,6,.9)'; c.lineWidth = 2.2; c.stroke();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(60,34,8,.45)'; c.lineWidth = 1;
    for (let x = -60; x < 480; x += 7) { c.beginPath(); c.moveTo(x, 960); c.lineTo(x + 70, 1120); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(40,22,6,.85)'; c.lineWidth = 1.5;
    c.beginPath(); ellipsePts(410, 918, 30, 30, 0, TAU * 1.6, 60).forEach(([x, y], i) => { const k = 1 - i / 60 * 0.6; const px = 410 + (x - 410) * k, py = 918 + (y - 918) * k; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke();
    c.beginPath(); c.moveTo(0, 915); c.quadraticCurveTo(180, 880, 350, 885); c.stroke();
    c.restore();
  }
  /* ============================================================ the hall: one building, seen from the throne or up the aisle */
  // Everything is placed in world units (x across, y up, z away) and drawn back to front. The nave is lined with an arcade
  // of columns; above the arches a clerestory lets in shafts of light; a coffered barrel vault closes it overhead.
  const BAY = 4.2, COLX = 9.4, COLR = 0.55, CAP = 8, WALLTOP = 14, VR = COLX;
  const STONE = 'rgb(244,238,226)', STONE_D = 'rgb(226,216,198)', LINE = (a) => `rgba(43,26,18,${a})`;
  const BANNER = new Set([1, 3, 5, 7, 9]);
  function hallCam(view, camZ = 0) {
    return view === 'doors' ? { VX: 960, VY: 470, f: 900, h: 3.2, z: camZ, end: 60 } : { VX: 960, VY: 452, f: 1000, h: 1.9, z: camZ, end: 31 };
  }
  const hallP = (K, x, y, z) => [K.VX + (K.f * x) / (z - K.z), K.VY + (K.f * (K.h - y)) / (z - K.z)];
  function poly(c, pts, fill, stroke, lw = 1) {
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  // the pedestal from the first image: the engraved capital, a fluted shaft beneath it, and a moulded base
  const colFill = (() => { let p; return () => { if (!p) { p = mk(720, 555); const g = p.getContext('2d'); g.drawImage(IMG.columnFill, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(246,240,228)'; g.fillRect(0, 0, 720, 555); } return p; }; })();
  const PED_H = 945;                                   // in the column image's pixels: 555 of capital and shaft, 300 more shaft, 90 of base
  function pedestal(c, cx, yb, s, alpha = 1) {
    c.save(); c.globalAlpha = alpha; c.translate(cx, yb); c.scale(s, s); c.translate(-360, -PED_H);
    // the shaft continues below the engraving: its own lower rows, repeated down to the base
    const cf = colFill();
    c.drawImage(cf, 0, 0, 720, 520, 0, 0, 720, 520); c.drawImage(IMG.column, 0, 0, 720, 520, 0, 0, 720, 520);
    for (let y = 520; y < 858; y += 130) { const hh = Math.min(130, 858 - y); c.drawImage(cf, 0, 390, 720, hh, 0, y, 720, hh); c.drawImage(IMG.column, 0, 390, 720, hh, 0, y, 720, hh); }
    // the base: a rounded torus over a square plinth, engraved like the capital
    c.beginPath(); c.moveTo(182, 852); c.lineTo(550, 852); c.quadraticCurveTo(592, 866, 550, 884); c.lineTo(182, 884); c.quadraticCurveTo(140, 866, 182, 852); c.closePath();
    c.fillStyle = 'rgb(246,240,228)'; c.fill(); c.strokeStyle = LINE(0.85); c.lineWidth = 2; c.stroke();
    c.save(); c.clip(); c.strokeStyle = LINE(0.45); c.lineWidth = 1; for (let y = 856; y < 884; y += 3.2) { c.beginPath(); c.moveTo(430 + (y - 868) ** 2 * 0.3, y); c.lineTo(600, y); c.stroke(); }
    for (let y = 874; y < 884; y += 2.5) { c.beginPath(); c.moveTo(150, y); c.lineTo(560, y); c.stroke(); } c.restore();
    poly(c, [[136, 884], [596, 884], [596, 945], [136, 945]], 'rgb(242,235,221)', LINE(0.85), 2);
    c.strokeStyle = LINE(0.5); c.lineWidth = 1; for (let x = 470; x < 596; x += 4.5) { c.beginPath(); c.moveTo(x, 888); c.lineTo(x, 942); c.stroke(); }
    c.strokeStyle = LINE(0.35); c.beginPath(); c.moveTo(136, 892); c.lineTo(596, 892); c.stroke();
    c.restore();
  }
  // the crown, lying on its side on the floor
  function fallenCrown(c, x, y, s, t, gleam = 0) {
    const cx = x + ((REST.x0 + REST.x1) / 2) * s, hw = ((REST.x1 - REST.x0) / 2) * s;
    const sh = c.createRadialGradient(cx, y, 0, cx, y, hw * 1.1); sh.addColorStop(0, 'rgba(58,34,24,.38)'); sh.addColorStop(1, 'rgba(58,34,24,0)');
    c.save(); c.translate(cx, y); c.scale(1, 0.12); c.translate(-cx, -y); c.fillStyle = sh; c.beginPath(); c.arc(cx, y, hw * 1.1, 0, TAU); c.fill(); c.restore();
    crownPose(c, x, y - REST.drop * s, REST.rot, s, t, gleam);
  }
  const DOOR = { w: 5.2, h: 10.4, r: 0.9, y0: 0.4 };
  function doorway(P, z, grow) {
    const w = DOOR.w / 2 + grow, y0 = DOOR.y0 - (grow ? 0 : 0), y1 = DOOR.y0 + DOOR.h + grow, r = DOOR.r + grow * 0.6, p = [];
    const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 8; i++) { const a = lerp(a0, a1, i / 8); p.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); } };
    arc(-w + r, y0 + r, PI, PI * 1.5); arc(w - r, y0 + r, PI * 1.5, TAU); arc(w - r, y1 - r, 0, PI / 2); arc(-w + r, y1 - r, PI / 2, PI);
    return p;
  }
  function drawHall(c, t, o) {
    const K = hallCam(o.view, o.camZ || 0), P = (x, y, z) => hallP(K, x, y, z), near = K.z + 0.7, END = K.end;
    const cols = []; for (let z = 6; z < END - 1.5; z += BAY) cols.push(z);
    L.paper(c, o.paper || 'day');
    // --- the floor: polished marble in large squares, and the carpet
    const zf = Math.max(near, K.z + 0.7);
    poly(c, [P(-COLX, 0, zf), P(COLX, 0, zf), P(COLX, 0, END), P(-COLX, 0, END)], 'rgb(238,230,215)');
    for (let zi = Math.floor(zf / 1.4) * 1.4; zi < END; zi += 1.4) {
      const z0 = Math.max(zf, zi), z1 = Math.min(END, zi + 1.4); if (z1 <= z0) continue;
      const rowH = P(0, 0, z0)[1] - P(0, 0, z1)[1]; if (rowH < 0.6) break;
      for (let xi = -7; xi < 7; xi++) {
        if ((xi + Math.round(zi / 1.4)) % 2 === 0) continue;
        const x0 = xi * 1.4, x1 = x0 + 1.4;
        poly(c, [P(x0, 0, z0), P(x1, 0, z0), P(x1, 0, z1), P(x0, 0, z1)], `rgba(150,120,90,${0.13 * Math.min(1, rowH / 6)})`);
      }
    }
    c.strokeStyle = LINE(0.16); c.lineWidth = 1; c.beginPath();
    for (let x = -COLX + 0.2; x <= COLX; x += 1.4) { const a = P(x, 0, zf), b = P(x, 0, END); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    c.stroke();
    // reflections of the light in the polished floor
    const [lx, ly] = P(0, 0, END);
    c.save(); c.globalCompositeOperation = 'screen';
    const rg = c.createLinearGradient(0, ly, 0, H); rg.addColorStop(0, 'rgba(255,230,180,.28)'); rg.addColorStop(1, 'rgba(255,230,180,0)');
    c.fillStyle = rg; c.beginPath(); const [ax] = P(-2.4, 0, END), [bx] = P(2.4, 0, END), [nx] = P(-6, 0, zf), [mx] = P(6, 0, zf);
    c.moveTo(ax, ly); c.lineTo(bx, ly); c.lineTo(mx, H + 50); c.lineTo(nx, H + 50); c.fill(); c.restore();
    const cz0 = o.carpetFrom ?? zf, cz1 = o.carpetTo ?? END;
    poly(c, [P(-0.9, 0, Math.max(zf, cz0)), P(0.9, 0, Math.max(zf, cz0)), P(0.9, 0, cz1), P(-0.9, 0, cz1)], 'rgb(126,40,32)');
    c.strokeStyle = 'rgba(40,10,8,.28)'; c.lineWidth = 1; c.beginPath();
    for (let z = Math.max(zf, cz0); z < cz1; z *= 1.05) { const a = P(-0.9, 0, z), b = P(0.9, 0, z); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); if (a[1] - P(0, 0, z * 1.05)[1] < 2) break; }
    c.stroke();
    c.strokeStyle = '#c99a3e'; c.lineWidth = 1.6; c.beginPath();
    for (const x of [-0.78, 0.78]) { const a = P(x, 0, Math.max(zf, cz0)), b = P(x, 0, cz1); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    c.stroke();

    // --- everything that stands, sorted far to near
    const Q = [];
    const q = (z, fn) => { if (z > near) Q.push({ z, fn }); };
    // beyond the doors: the horizon
    if (o.view === 'doors') q(1e4, () => { const [, hy] = P(0, 0, 1e4); c.strokeStyle = LINE(0.45); c.lineWidth = 1; c.beginPath(); c.moveTo(0, hy); c.lineTo(W, hy); c.stroke(); });
    // the end wall
    q(END, () => {
      const top = []; for (let i = 0; i <= 40; i++) { const u = PI * i / 40; top.push(P(-VR * Math.cos(u), WALLTOP + VR * Math.sin(u), END)); }
      const wall = [P(-COLX, 0, END), ...top, P(COLX, 0, END)];
      c.save(); c.beginPath(); wall.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      let hole = null;
      if (o.view === 'doors') {                                   // the great doorway: tall, with softened corners, open onto the horizon
        hole = doorway(P, END, 0);
        hole.slice().reverse().forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      }
      c.fillStyle = STONE; c.fill('evenodd'); c.clip('evenodd');
      const bb = [P(-COLX, 0, END), P(COLX, 0, END), P(COLX, WALLTOP + VR, END), P(-COLX, WALLTOP + VR, END)];
      new Etch().addAll(hatch(bb, 0, 3.4, 0, 7), 0.6, 0.3).draw(c);
      c.restore();
      c.strokeStyle = LINE(0.7); c.lineWidth = 1.2; c.beginPath(); wall.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      if (hole) {
        const outer = doorway(P, END, 0.55);
        c.beginPath(); outer.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = STONE_D; c.fill(); c.strokeStyle = LINE(0.85); c.lineWidth = 1.4; c.stroke();
        c.beginPath(); hole.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = 'rgb(252,247,236)'; c.fill();
        const [, hy] = P(0, 0, 1e4); c.save(); c.clip(); c.strokeStyle = LINE(0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(0, hy); c.lineTo(W, hy); c.stroke(); o.beyond && o.beyond(P); c.restore();
        c.beginPath(); hole.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.strokeStyle = LINE(0.9); c.lineWidth = 1.8; c.stroke();
        const th = [P(-3.3, 0, END), P(3.3, 0, END), P(3.3, DOOR.y0, END), P(-3.3, DOOR.y0, END)]; poly(c, th, STONE, LINE(0.8), 1.2);
      }
      if (o.view === 'throne') {                                 // a tall window of first light behind the throne, and a round one above
        const win = [P(-1.9, 4.4, END)]; for (let i = 0; i <= 24; i++) { const u = PI * i / 24; win.push(P(-1.9 * Math.cos(u), 12 + 1.9 * Math.sin(u), END)); } win.push(P(1.9, 4.4, END));
        poly(c, win, 'rgb(255,250,236)', LINE(0.85), 1.6);
        c.strokeStyle = LINE(0.55); c.lineWidth = 1; c.beginPath();
        for (const x of [-0.63, 0.63]) { const a = P(x, 4.4, END), b = P(x, 12 + Math.sqrt(1.9 * 1.9 - x * x), END); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
        for (const y of [6.8, 9.2, 11.6]) { const a = P(-1.9, y, END), b = P(1.9, y, END); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
        c.stroke();
        const [ox, oy] = P(0, 17.6, END), orr = (K.f * 1.4) / (END - K.z);
        c.fillStyle = 'rgb(255,250,236)'; c.beginPath(); c.arc(ox, oy, orr, 0, TAU); c.fill(); c.strokeStyle = LINE(0.85); c.lineWidth = 1.6; c.stroke();
        c.lineWidth = 0.8; for (let k = 0; k < 12; k++) { const a = k * TAU / 12; c.beginPath(); c.moveTo(ox + Math.cos(a) * orr * 0.25, oy + Math.sin(a) * orr * 0.25); c.lineTo(ox + Math.cos(a) * orr, oy + Math.sin(a) * orr); c.stroke(); }
        c.beginPath(); c.arc(ox, oy, orr * 0.25, 0, TAU); c.stroke();
      }
    });
    // bays: the dark side aisle through each arch, the wall above with its clerestory window, and the vault overhead
    cols.forEach((z0, i) => {
      const z1 = z0 + BAY; if (z1 > END) return;
      for (const sg of [-1, 1]) if (z0 > near + 0.2) q((z0 + z1) / 2 + 0.01, () => {
        const X = sg * COLX, a0 = z0 + COLR, a1 = z1 - COLR, r = (a1 - a0) / 2, zm = (a0 + a1) / 2;
        const arch = []; for (let k = 0; k <= 24; k++) { const u = PI * k / 24; arch.push(P(X, CAP + r * Math.sin(u), zm - r * Math.cos(u))); }
        const opening = [P(X, 0, a0), ...arch, P(X, 0, a1)];
        poly(c, opening, 'rgb(216,203,182)');
        const back = [P(X + sg * 4, 0, a0), P(X + sg * 4, 0, a1), P(X + sg * 4, CAP + r, a1), P(X + sg * 4, CAP + r, a0)];
        c.save(); c.beginPath(); opening.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
        new Etch().addAll(hatch(opening, 90, 3.2, 0, i * 2 + (sg > 0 ? 1 : 0)), 0.6, 0.3).draw(c);
        poly(c, back, 'rgba(255,244,222,.35)');
        c.restore();
        const wall = [P(X, CAP, z0), P(X, CAP, a0), ...arch, P(X, CAP, a1), P(X, CAP, z1), P(X, WALLTOP, z1), P(X, WALLTOP, z0)];
        poly(c, wall, STONE_D);
        c.strokeStyle = LINE(0.2); c.lineWidth = 0.8; c.beginPath();
        for (let y = CAP + 0.7; y < WALLTOP; y += 0.7) { const a = P(X, y, z0), b = P(X, y, z1); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
        c.stroke();
        c.beginPath(); arch.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = LINE(0.85); c.lineWidth = 1.4; c.stroke();
        const ext = []; for (let k = 0; k <= 24; k++) { const u = PI * k / 24; ext.push(P(X, CAP + (r + 0.35) * Math.sin(u), zm - (r + 0.35) * Math.cos(u))); }
        c.beginPath(); ext.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineWidth = 0.9; c.stroke();
        const ks = [P(X, CAP + r - 0.05, zm - 0.22), P(X, CAP + r - 0.05, zm + 0.22), P(X, CAP + r + 0.55, zm + 0.3), P(X, CAP + r + 0.55, zm - 0.3)];
        poly(c, ks, STONE, LINE(0.8), 1);
        // the cornice, and a clerestory window
        c.strokeStyle = LINE(0.75); c.lineWidth = 1.3; c.beginPath(); const e0 = P(X, WALLTOP, z0), e1 = P(X, WALLTOP, z1); c.moveTo(e0[0], e0[1]); c.lineTo(e1[0], e1[1]); c.stroke();
        const w = []; w.push(P(X, 11, zm - 0.6)); for (let k = 0; k <= 12; k++) { const u = PI * k / 12; w.push(P(X, 12.8 + 0.6 * Math.sin(u), zm - 0.6 * Math.cos(u))); } w.push(P(X, 11, zm + 0.6));
        poly(c, w, 'rgb(255,250,238)', LINE(0.8), 1);
      });
      q(z1 + 0.02, () => {                                       // the vault between two ribs: coffers
        const ring = (z) => { const a = []; for (let k = 0; k <= 36; k++) { const u = PI * k / 36; a.push(P(-VR * Math.cos(u), WALLTOP + VR * Math.sin(u), z)); } return a; };
        const za = Math.max(z0, near + 0.05), r0 = ring(za), r1 = ring(z1);
        poly(c, [...r0, ...r1.slice().reverse()], 'rgb(236,228,212)');
        c.strokeStyle = LINE(0.3); c.lineWidth = 0.9; c.beginPath();
        for (let k = 3; k < 36; k += 3) { c.moveTo(r0[k][0], r0[k][1]); c.lineTo(r1[k][0], r1[k][1]); }
        for (const f of [0.33, 0.66]) { if (z0 + BAY * f <= near) continue; const rm = ring(z0 + BAY * f); rm.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); }
        c.stroke();
        if (z0 + BAY * 0.33 > near) for (let k = 3; k < 33; k += 6) { const m = ring(z0 + BAY * 0.33), n = ring(z0 + BAY * 0.66); poly(c, [m[k], m[k + 3], n[k + 3], n[k]], LINE(0.07)); }
      });
    });
    // columns, a rib over each pair, and banners on every other one
    cols.forEach((z, i) => {
      for (const sg of [-1, 1]) q(z, () => {
        const X = sg * COLX, [x0, yb] = P(X - COLR, 0, z), [x1, yt] = P(X + COLR, CAP, z), wpx = x1 - x0, u = wpx / (2 * COLR);
        if (x1 < -50 || x0 > W + 50) return;
        const yc = yt;
        poly(c, [[x0 - wpx * 0.2, yb], [x1 + wpx * 0.2, yb], [x1 + wpx * 0.2, yb - 0.32 * u], [x0 - wpx * 0.2, yb - 0.32 * u]], STONE, LINE(0.8), 1.1);
        poly(c, [[x0 - wpx * 0.1, yb - 0.32 * u], [x1 + wpx * 0.1, yb - 0.32 * u], [x1, yb - 0.6 * u], [x0, yb - 0.6 * u]], STONE, LINE(0.8), 1.1);
        poly(c, [[x0, yb - 0.6 * u], [x1, yb - 0.6 * u], [x1, yc + 0.45 * u], [x0, yc + 0.45 * u]], STONE, LINE(0.8), 1.2);
        const n = Math.max(4, Math.round(wpx / 6));
        c.lineWidth = 0.8;
        for (let k = 1; k < n; k++) { const xx = x0 + (wpx * k) / n, sh = sg * (k / n - 0.5); c.strokeStyle = LINE(sh > 0 ? 0.5 : 0.22); c.beginPath(); c.moveTo(xx, yb - 0.6 * u); c.lineTo(xx, yc + 0.45 * u); c.stroke(); }
        poly(c, [[x0, yc + 0.45 * u], [x1, yc + 0.45 * u], [x1 + wpx * 0.25, yc + 0.1 * u], [x0 - wpx * 0.25, yc + 0.1 * u]], STONE, LINE(0.8), 1.1);
        poly(c, [[x0 - wpx * 0.3, yc + 0.1 * u], [x1 + wpx * 0.3, yc + 0.1 * u], [x1 + wpx * 0.3, yc - 0.3 * u], [x0 - wpx * 0.3, yc - 0.3 * u]], STONE, LINE(0.85), 1.1);
        for (const vx of [x0 - wpx * 0.12, x1 + wpx * 0.12]) { c.beginPath(); c.arc(vx, yc + 0.02 * u, wpx * 0.14, 0, TAU); c.fillStyle = STONE; c.fill(); c.strokeStyle = LINE(0.8); c.lineWidth = 1; c.stroke(); }
        // a pilaster runs up from the capital to the vault
        poly(c, [[x0 + wpx * 0.15, yc - 0.3 * u], [x1 - wpx * 0.15, yc - 0.3 * u], [...P(X + COLR * 0.7, WALLTOP, z)], [...P(X - COLR * 0.7, WALLTOP, z)]], STONE, LINE(0.6), 1);
        if (BANNER.has(i)) {                                    // a long banner of the house, hung from the cornice
          const bx0 = X - sg * (COLR + 0.25), bx1 = X - sg * (COLR + 1.45), zb = z - 0.05, top = 12.8, bot = 6.2;
          const sway = Math.sin(t * 0.7 + i) * 0.04;
          const pts = [P(bx0, top, zb), P(bx1, top, zb), P(bx1 + sway, bot, zb), P((bx0 + bx1) / 2 + sway, bot + 0.7, zb), P(bx0 + sway, bot, zb)];
          poly(c, pts, 'rgb(120,34,28)', LINE(0.85), 1);
          const mxp = pts.reduce((a2, p3) => a2 + p3[0], 0) / 5, myp = pts.reduce((a2, p3) => a2 + p3[1], 0) / 5;
          c.strokeStyle = '#d0a24a'; c.lineWidth = 1.2; c.beginPath(); pts.forEach(([x, y], k) => { const px2 = mxp + (x - mxp) * 0.8, py2 = myp + (y - myp) * 0.93; k ? c.lineTo(px2, py2) : c.moveTo(px2, py2); }); c.closePath(); c.stroke();
          const [cx2, cy2] = P((bx0 + bx1) / 2, 10.6, zb), cw = Math.abs(pts[1][0] - pts[0][0]) * 0.5;
          if (cw > 6) c.drawImage(L.GOLD_CROWN, cx2 - cw / 2, cy2 - cw * 0.4, cw, cw * 0.78);
          poly(c, [P(bx0 + 0.05, top + 0.25, zb), P(bx1 - 0.05, top + 0.25, zb), P(bx1 - 0.05, top, zb), P(bx0 + 0.05, top, zb)], '#b8841c');
        }
      });
      q(z - 0.2, () => {                                         // the transverse rib
        const rr = []; for (let k = 0; k <= 36; k++) { const u = PI * k / 36; rr.push(P(-VR * Math.cos(u), WALLTOP + VR * Math.sin(u), z)); }
        c.beginPath(); rr.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = LINE(0.75); c.lineWidth = 2.2; c.stroke();
        const r2 = rr.map(([x, y]) => [x, y + (K.f * 0.3) / (z - K.z)]);
        c.beginPath(); r2.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineWidth = 1; c.stroke();
      });
    });
    // the court
    if (o.crowd) o.crowd.forEach((p2) => q(p2.z, () => o.drawPerson(p2, P)));
    if (o.extra) o.extra.forEach((e) => q(e.z, () => e.draw(P, K)));
    Q.sort((a, b) => b.z - a.z).forEach((it) => it.fn());
    // shafts of light from the clerestory on the left, falling across the nave
    c.save(); c.globalCompositeOperation = 'screen';
    cols.forEach((z0) => {
      const zm = z0 + BAY / 2; if (zm < near + 2 || zm > END - 1) return;
      const d = o.sun || [1.0, -1.05, -0.35];
      const top0 = [-COLX, 13.4, zm - 0.55], top1 = [-COLX, 13.4, zm + 0.55], hit = (p0) => { const k = p0[1] / -d[1]; return [p0[0] + d[0] * k, 0, p0[2] + d[2] * k]; };
      const f0 = hit(top0), f1 = hit(top1);
      if (f0[2] < near + 0.5) return;
      const A = P(...top0), B = P(...top1), C = P(...f1), D = P(...f0);
      const g = c.createLinearGradient(A[0], A[1], C[0], C[1]); g.addColorStop(0, `rgba(255,236,196,${0.16 * (o.shaft ?? 1)})`); g.addColorStop(1, 'rgba(255,236,196,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(C[0], C[1]); c.lineTo(D[0], D[1]); c.closePath(); c.fill();
    });
    const [gx, gy] = o.view === 'doors' ? P(0, 7, END) : P(0, 10, END);
    const gl = c.createRadialGradient(gx, gy, 0, gx, gy, 900);
    gl.addColorStop(0, `rgba(255,228,170,${0.5 * (o.glow ?? 1)})`); gl.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    c.restore();
    return { P, K };
  }
  // a person of the court, standing on the floor of the hall
  function courtier(c, p2, P, bow = 0, haze = 1) {
    const [x, yf] = P(p2.x, 0, p2.z), hp = yf - P(p2.x, p2.h, p2.z)[1];
    if (hp < 3) { c.globalAlpha = haze * (hp < 1.2 ? 0.1 : 0.35); c.fillStyle = INK; c.fillRect(x, yf - hp, 1, Math.max(1, hp)); c.globalAlpha = 1; return; }
    const img = spriteAt(p2.s, hp), w = (img.width / img.height) * hp;
    c.globalAlpha = haze;
    c.save(); c.translate(x, yf); c.rotate(bow * 0.42 * (p2.x < 0 ? 1 : -1)); c.scale(1, 1 - 0.16 * bow); if (p2.flip) c.scale(-1, 1);
    if (img.fill && hp > 14) c.drawImage(img.fill, -w / 2, -hp, w, hp);
    c.drawImage(img, -w / 2, -hp, w, hp); c.restore(); c.globalAlpha = 1;
  }
  WORLD.throne = (c, t, o = {}) => {
    const dr = o.drift ? 1 + 0.045 * ease(clamp(t / o.drift)) : 1;
    c.save(); c.translate(960, 470); c.scale(dr, dr); c.translate(-960, -470);
    const bowOf = (p2) => {
      if (o.kneel !== undefined) return ease(clamp((t - o.kneel - p2.k * 0.03) / 0.8)) * 0.85;
      if (o.bowAt === undefined) return 0;
      const u = t - o.bowAt - p2.k * 0.045; return u < 0 ? 0 : u < 0.7 ? ease(u / 0.7) : u < 2.4 ? 1 : 1 - ease(clamp((u - 2.4) / 1.0));
    };
    const person = (p2, P) => courtier(c, p2, P, bowOf(p2), 1 - Math.min(0.65, p2.z / 380));
    drawHall(c, t, { view: 'doors', glow: o.glow ?? 1, crowd: CROWD_NEAR, drawPerson: person, beyond: (P) => CROWD_FAR.forEach((p2) => person(p2, P)) });
    c.restore();
    c.save(); c.globalCompositeOperation = 'multiply';
    const vg = c.createRadialGradient(960, 470, 250, 960, 570, 1250);
    vg.addColorStop(0, 'rgb(255,248,234)'); vg.addColorStop(0.7, 'rgb(234,214,180)'); vg.addColorStop(1, 'rgb(150,114,80)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H); c.restore();
    // the edge of the dais you sit on: one polished band of dark stone, a gilt rule, the carpet running over it
    const dg = c.createLinearGradient(0, 960, 0, H); dg.addColorStop(0, 'rgb(74,52,36)'); dg.addColorStop(1, 'rgb(34,22,14)');
    c.fillStyle = dg; c.fillRect(0, 960, W, H - 960);
    c.fillStyle = 'rgba(255,230,180,.08)'; c.fillRect(0, 962, W, 6);
    const rim = c.createLinearGradient(0, 952, 0, 964); rim.addColorStop(0, '#f0cf82'); rim.addColorStop(1, '#8a5e10');
    c.fillStyle = rim; c.fillRect(0, 952, W, 10);
    const cw0 = 190;
    c.fillStyle = 'rgb(128,38,30)'; c.beginPath(); c.moveTo(960 - cw0, 952); c.lineTo(960 + cw0, 952); c.lineTo(960 + cw0 * 1.25, H); c.lineTo(960 - cw0 * 1.25, H); c.fill();
    c.strokeStyle = '#c99a3e'; c.lineWidth = 2; c.beginPath(); c.moveTo(960 - cw0 + 14, 952); c.lineTo(960 - cw0 * 1.25 + 16, H); c.moveTo(960 + cw0 - 14, 952); c.lineTo(960 + cw0 * 1.25 - 16, H); c.stroke();
    if (o.night > 0) {                                          // the same hall at night: moonlight, and the court on its knees
      c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = o.night; c.fillStyle = 'rgb(46,52,86)'; c.fillRect(0, 0, W, H);
      c.globalAlpha = 1; c.globalCompositeOperation = 'screen';
      const moonA = o.night * (o.moon ?? 1);
      for (const [x0, x1] of [[260, 700], [1220, 1660]]) { const g = c.createLinearGradient(x0, 0, x1, H); g.addColorStop(0, `rgba(170,184,230,${0.22 * moonA})`); g.addColorStop(1, 'rgba(170,184,230,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 120, 0); c.lineTo(x1 + 220, H); c.lineTo(x1 - 60, H); c.closePath(); c.fill(); }
      const dg2 = c.createRadialGradient(960, 440, 0, 960, 440, 420); dg2.addColorStop(0, `rgba(190,204,240,${0.45 * moonA})`); dg2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = dg2; c.fillRect(0, 0, W, H);
      c.restore();
    }
    if (o.door > 0) {                                           // flying into the light of the doors
      c.save(); c.globalCompositeOperation = 'screen';
      const g = c.createRadialGradient(960, 440, 0, 960, 440, 700);
      g.addColorStop(0, `rgba(255,244,220,${o.door})`); g.addColorStop(1, 'rgba(255,230,190,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    }
  };
  // the same hall at first light, seen up the aisle: the throne empty, the pedestal bare, the crown on the floor
  const HB = { zD: 24.4, throneZ: 27.4, pedX: -1.55, pedZ: 21.6, crownX: -0.15, crownZ: 21.2 };
  const COURT_B = (() => {
    const r = rng(41), a = [];
    for (let z = 7.5; z < 22.5; z += 1.5) for (let j = 0; j < 3; j++) for (const sg of [-1, 1]) a.push({ z: z + (r() - 0.5) * 0.25, x: sg * (2.7 + j * 1.25 + (r() - 0.5) * 0.15), s: Math.floor(r() * 6), flip: sg > 0, h: 1.75 * (0.92 + r() * 0.14) });
    return a;
  })();
  const hallCrownAt = (camZ) => hallP(hallCam('throne', camZ), HB.crownX, 0.3, HB.crownZ);
  function throneAndDais(c, P, K) {
    const steps = 3, sd = 0.7, sh = 0.32, zD = HB.zD, hw = 3.6;
    for (let k = steps - 1; k >= 0; k--) {
      const zf = zD + k * sd, yT = (k + 1) * sh;
      poly(c, [P(-hw, yT, zf), P(hw, yT, zf), P(hw, yT, zf + sd), P(-hw, yT, zf + sd)], 'rgb(238,230,214)');
      poly(c, [P(-hw, yT - sh, zf), P(hw, yT - sh, zf), P(hw, yT, zf), P(-hw, yT, zf)], 'rgb(214,202,180)', LINE(0.8), 1.2);
      const [gx0, gy0] = P(-hw, yT, zf), [gx1] = P(hw, yT, zf); c.fillStyle = '#b8841c'; c.fillRect(gx0, gy0 - 1.2, gx1 - gx0, 2.4);
      poly(c, [P(-0.9, yT - sh, zf), P(0.9, yT - sh, zf), P(0.9, yT, zf), P(0.9, yT, zf + sd), P(-0.9, yT, zf + sd), P(-0.9, yT, zf)], 'rgb(126,40,32)');
    }
    // a canopy of red cloth, swagged from a gilded rod
    const zc = HB.throneZ + 0.9, rodY = 7.4;
    const [r0x, r0y] = P(-2.4, rodY, zc), [r1x] = P(2.4, rodY, zc), u = (K.f) / (zc - K.z);
    for (const sg of [-1, 1]) {
      const pts = []; for (let k = 0; k <= 20; k++) { const v = k / 20; pts.push([lerp(960 + sg * (r1x - 960) * 0.15, 960 + sg * (r1x - 960) * 1.02, v) + (sg * Math.sin(v * PI) * 0.2 * u), r0y + v * v * 0.6 * u + Math.sin(v * PI) * 1.1 * u]); }
      const fall = [P(sg * 2.45, rodY, zc), P(sg * 2.45, 1.0, zc), P(sg * 1.85, 1.0, zc), P(sg * 2.0, 5.2, zc)];
      poly(c, fall, 'rgb(112,30,26)', LINE(0.8), 1);
      c.strokeStyle = 'rgba(30,6,4,.35)'; c.lineWidth = 1; for (let k = 1; k < 5; k++) { const a = P(sg * (2.45 - k * 0.1), rodY, zc), b = P(sg * (2.45 - k * 0.1), 1.2 + k * 0.6, zc); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    }
    const swag = []; for (let k = 0; k <= 30; k++) { const v = k / 30; swag.push(P(lerp(-2.4, 2.4, v), rodY - 0.9 * Math.sin(v * PI), zc - 0.05)); }
    poly(c, [...swag, P(2.4, rodY, zc), P(-2.4, rodY, zc)], 'rgb(126,36,30)', LINE(0.8), 1);
    c.strokeStyle = '#d0a24a'; c.lineWidth = 1.4; c.beginPath(); swag.forEach(([x, y], k) => (k ? c.lineTo(x, y + 3) : c.moveTo(x, y + 3))); c.stroke();
    c.fillStyle = '#c99a3e'; c.fillRect(r0x - 6, r0y - 4, r1x - r0x + 12, 7);
    // the throne
    const tz = HB.throneZ, ty = steps * sh, X = (x) => P(x, 0, tz)[0], Y = (y) => P(0, ty + y, tz)[1];
    const tg = c.createLinearGradient(X(-1.3), 0, X(1.3), 0); tg.addColorStop(0, '#7c5410'); tg.addColorStop(0.45, '#e8c068'); tg.addColorStop(1, '#7c5410');
    const back = [[X(-1.15), Y(0.9)], [X(-1.15), Y(3.2)], ...ellipsePts(X(0), Y(3.2), X(1.15) - X(0), (X(1.15) - X(0)) * 0.7, PI, TAU, 30), [X(1.15), Y(0.9)]];
    poly(c, back, tg, INK, 1.6);
    const inner = back.map(([x, y]) => [X(0) + (x - X(0)) * 0.74, Y(0.95) + (y - Y(0.95)) * 0.86]);
    poly(c, inner, 'rgb(122,32,28)', INK, 1);
    c.save(); c.beginPath(); inner.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.clip(); new Etch().addAll(hatch(inner, 90, 3.4, 0, 3), 0.6, 0.35).draw(c); c.restore();
    const cw = (X(1.15) - X(0)) * 0.9; c.drawImage(L.GOLD_CROWN, X(0) - cw / 2, Y(3.2) - (X(1.15) - X(0)) * 0.7 - cw * 0.72, cw, cw * 0.78);
    poly(c, [[X(-1.45), Y(1.0)], [X(1.45), Y(1.0)], [X(1.45), Y(0.75)], [X(-1.45), Y(0.75)]], tg, INK, 1.2);
    poly(c, [[X(-1.5), Y(0.75)], [X(1.5), Y(0.75)], [X(1.5), Y(0.55)], [X(-1.5), Y(0.55)]], 'rgb(122,32,28)', INK, 1);
    for (const sg of [-1, 1]) {
      poly(c, [[X(sg * 1.5) - 5, Y(1.75)], [X(sg * 1.5) + 5, Y(1.75)], [X(sg * 1.5) + 5, Y(0)], [X(sg * 1.5) - 5, Y(0)]], tg, INK, 1.2);
      c.beginPath(); c.arc(X(sg * 1.5), Y(1.75), 10, 0, TAU); c.fillStyle = '#e0b152'; c.fill(); c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(X(sg * 1.5), Y(1.75), 4.5, 0, TAU); c.stroke();
    }
  }
  const hallBuf = mk(), hbx = hallBuf.getContext('2d');
  WORLD.hallEnd = (c, t, o = {}) => {
    const camZ = o.camZ || 0, focus = o.focus || 0, tgt = focus > 0 ? hbx : c;
    const gl = o.gleamAt !== undefined ? Math.sin(clamp(seg(t, o.gleamAt - 0.3, o.gleamAt + 2.4)) * PI) : 0;
    const crown = (P, K) => { const [x, y] = P(HB.crownX, 0, HB.crownZ); fallenCrown(focus > 0 ? c : tgt, x, y, (K.f * 1.35) / (HB.crownZ - K.z) / 500, t, gl + 0.5 * focus); };
    const drawn = drawHall(tgt, t, { view: 'throne', paper: 'first', camZ, carpetTo: HB.zD, glow: 1.15, shaft: 1.4, sun: [1.0, -0.75, -0.55],
      crowd: focus >= 1 ? [] : COURT_B, drawPerson: (p2, P) => courtier(tgt, p2, P, 0, (1 - Math.min(0.3, p2.z / 80)) * (1 - focus)),
      extra: [
        { z: HB.zD + 1.4, draw: (P, K) => throneAndDais(tgt, P, K) },
        { z: HB.pedZ, draw: (P, K) => { const [x, y] = P(HB.pedX, 0, HB.pedZ); pedestal(tgt, x, y, (K.f * 3.0) / (HB.pedZ - K.z) / PED_H); } },
        ...(focus > 0 ? [] : [{ z: HB.crownZ, draw: crown }]),
      ] });
    tgt.save(); tgt.globalCompositeOperation = 'multiply';
    const vg = tgt.createRadialGradient(960, 520, 300, 960, 560, 1250); vg.addColorStop(0, 'rgb(255,250,240)'); vg.addColorStop(1, 'rgb(150,136,120)');
    tgt.fillStyle = vg; tgt.fillRect(0, 0, W, H); tgt.restore();
    if (focus > 0) {
      // everything but the crown falls away: the court is gone, the hall softens and dims, one light stays on the floor
      c.save(); c.filter = `blur(${(7 * focus).toFixed(1)}px) brightness(${(1 - 0.1 * focus).toFixed(3)}) sepia(${(0.15 * focus).toFixed(3)})`; c.drawImage(hallBuf, 0, 0); c.restore();
      const [x, y] = drawn.P(HB.crownX, 0, HB.crownZ), s2 = (drawn.K.f * 1.35) / (HB.crownZ - drawn.K.z) / 500, cx = x + 180 * s2;
      c.save(); c.globalCompositeOperation = 'screen';
      const sp = c.createRadialGradient(cx, y - 60 * s2, 0, cx, y - 60 * s2, 520 * s2 + 60); sp.addColorStop(0, `rgba(255,220,160,${0.5 * focus})`); sp.addColorStop(1, 'rgba(255,220,160,0)');
      c.fillStyle = sp; c.fillRect(0, 0, W, H); c.restore();
      crown(drawn.P, drawn.K);
    }
  };
  // one window shape for the bedroom and for Marcus's study
  const WIN = { x: 1160, y: 90, w: 330, h: 470, moon: [1400, 240, 26] };
  const winOpening = (g) => [[WIN.x - g, WIN.y + WIN.h], [WIN.x - g, WIN.y + WIN.w / 2], ...ellipsePts(WIN.x + WIN.w / 2, WIN.y + WIN.w / 2, WIN.w / 2 + g, WIN.w / 2 + g, PI, TAU, 48), [WIN.x + WIN.w + g, WIN.y + WIN.h]];
  // a smartphone, face up: the same proportions and corners as the great doorway it is seen through
  const PHONE = { x: 990, y: 690, w: 150, h: 300, r: 26 };
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function phone(c, px, py, t, o = {}) {
    const { w, h, r } = PHONE, x = px - w / 2, y = py - h / 2;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.filter = 'blur(10px)'; rrect(c, x + 6, y + 10, w, h, r); c.fill(); c.filter = 'none';
    rrect(c, x, y, w, h, r); c.fillStyle = '#121218'; c.fill(); c.strokeStyle = 'rgba(150,160,190,.6)'; c.lineWidth = 1.2; c.stroke();
    const sx = x + 6, sy = y + 6, sw = w - 12, sh = h - 12;
    const sg = c.createLinearGradient(0, sy, 0, sy + sh); sg.addColorStop(0, 'rgb(238,242,252)'); sg.addColorStop(1, 'rgb(214,222,242)');
    rrect(c, sx, sy, sw, sh, r - 5); c.fillStyle = sg; c.fill();
    c.save(); rrect(c, sx, sy, sw, sh, r - 5); c.clip();
    rrect(c, px - 22, sy + 7, 44, 11, 5.5); c.fillStyle = '#121218'; c.fill();
    c.fillStyle = 'rgba(40,44,60,.8)'; c.font = '600 8px -apple-system, "Helvetica Neue", Arial, sans-serif'; c.fillText('6:12', sx + 12, sy + 16);
    c.fillRect(sx + sw - 24, sy + 10, 13, 6);
    // a conversation: what you asked, and what is already being built
    const bub = (bx, by, bw, bh, mine) => { rrect(c, bx, by, bw, bh, 8); c.fillStyle = mine ? 'rgb(64,86,150)' : 'rgb(226,230,240)'; c.fill(); c.fillStyle = mine ? 'rgba(236,240,252,.85)' : 'rgba(80,86,110,.7)'; for (let l = 0; l < Math.floor((bh - 8) / 7); l++) c.fillRect(bx + 7, by + 7 + l * 7, (bw - 14) * (l % 2 ? 0.7 : 1), 3); };
    bub(sx + 40, sy + 34, sw - 48, 36, true); bub(sx + 8, sy + 78, sw - 44, 58, false); bub(sx + 56, sy + 144, sw - 64, 22, true); bub(sx + 8, sy + 174, sw - 30, 44, false);
    rrect(c, sx + 8, sy + sh - 34, sw - 16, 24, 12); c.fillStyle = 'rgb(246,248,253)'; c.fill(); c.strokeStyle = 'rgba(120,130,160,.5)'; c.lineWidth = 1; c.stroke();
    const speak = o.lettersAt !== undefined ? clamp((t - o.lettersAt + 1) / 1) * (1 - clamp((t - o.lettersAt - 12) / 2)) : 0;
    c.fillStyle = 'rgb(64,86,150)';
    for (let k = 0; k < 16; k++) { const hh = 2 + speak * 8 * Math.abs(Math.sin(t * 9 + k * 1.7)) * (0.5 + 0.5 * Math.sin(k)); c.fillRect(sx + 18 + k * 5, sy + sh - 22 - hh / 2, 2.4, hh); }
    c.restore();
  }
  WORLD.bed = (c, t, o = {}) => {
    // First person, like the throne: you look down the length of your own bed. The duvet is drawn the way an
    // engraver draws a landscape, in contour lines; the only light is the moon through the window and the phone.
    L.paper(c, 'dark');
    const moon = 'rgba(176,186,220,', px = PHONE.x, py = PHONE.y;
    // the wall and the window
    c.strokeStyle = moon + '.10)'; c.lineWidth = 1; c.beginPath();
    for (let x = 0; x < W; x += 9) { c.moveTo(x, 0); c.lineTo(x, 560); } c.stroke();
    // the window has the same shape as Marcus's, two thousand years apart, under the same moon
    const { x: wx, y: wy, w: ww, h: wh } = WIN, opening = winOpening(0);
    c.save(); c.beginPath(); opening.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
    const mg = c.createLinearGradient(wx, wy, wx + ww, wy + wh); mg.addColorStop(0, 'rgb(62,72,104)'); mg.addColorStop(1, 'rgb(30,36,56)');
    c.fillStyle = mg; c.fillRect(wx, wy, ww, wh);
    stars(c, t, 30, 23, 0.8);
    c.globalCompositeOperation = 'screen';
    const mo = c.createRadialGradient(WIN.moon[0], WIN.moon[1], 0, WIN.moon[0], WIN.moon[1], 110); mo.addColorStop(0, 'rgba(240,244,255,.9)'); mo.addColorStop(0.25, 'rgba(200,210,240,.35)'); mo.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = mo; c.fillRect(wx, wy, ww, wh);
    c.restore();
    c.fillStyle = 'rgb(236,240,252)'; c.beginPath(); c.arc(WIN.moon[0], WIN.moon[1], WIN.moon[2], 0, TAU); c.fill();
    c.save(); c.globalCompositeOperation = 'screen';
    const beam = c.createLinearGradient(wx, wy, 700, 1000); beam.addColorStop(0, 'rgba(150,165,210,.14)'); beam.addColorStop(1, 'rgba(150,165,210,0)');
    c.fillStyle = beam; c.beginPath(); c.moveTo(wx, wy + wh); c.lineTo(wx + ww, wy + wh); c.lineTo(1150, 1080); c.lineTo(250, 1080); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = moon + '.8)'; c.lineWidth = 3; c.beginPath(); opening.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
    c.lineWidth = 1.4; c.beginPath(); winOpening(22).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh * 0.6); c.lineTo(wx + ww, wy + wh * 0.6); c.stroke();
    c.beginPath(); c.moveTo(wx - 40, wy + wh); c.lineTo(wx + ww + 40, wy + wh); c.lineTo(wx + ww + 30, wy + wh + 18); c.lineTo(wx - 30, wy + wh + 18); c.closePath(); c.stroke();
    for (const [cx0, dir] of [[wx - 12, -1], [wx + ww + 12, 1]]) {         // curtains, in folds
      c.strokeStyle = moon + '.35)'; c.lineWidth = 1.2;
      for (let k = 0; k < 9; k++) { c.beginPath(); for (let y = wy - 30; y < 600; y += 10) { const x = cx0 + dir * (k * 9 + Math.sin(y * 0.02 + k) * 4 + (y - wy) * 0.03 * k * 0.3); y === wy - 30 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); }
    }
    // the foot of the bed
    c.strokeStyle = moon + '.7)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(330, 590); c.lineTo(1610, 590); c.moveTo(330, 612); c.lineTo(1610, 612); c.stroke();
    for (const x of [330, 1610]) { c.beginPath(); c.moveTo(x, 640); c.lineTo(x, 540); c.arc(x, 528, 12, PI / 2, PI / 2 + TAU); c.stroke(); }
    c.fillStyle = 'rgba(10,10,18,.9)'; c.fillRect(330, 614, 1280, 30);
    // the duvet: a landscape of contour lines, rising toward you, with two knees
    const hgt = (x, v) => {
      const k1 = Math.exp(-((x - 760) ** 2) / 26000 - ((v - 0.34) ** 2) / 0.016);
      const k2 = Math.exp(-((x - 1210) ** 2) / 24000 - ((v - 0.38) ** 2) / 0.018);
      const body = Math.exp(-((x - 980) ** 2) / 170000) * v * v * 1.3;
      const fold = Math.sin(x * 0.011 + v * 7) * 0.05 * v;
      return 0.9 * k1 + 0.8 * k2 + body + fold;
    };
    const rows = 70;
    c.lineWidth = 1.1;
    for (let i = rows; i >= 0; i--) {
      const v = Math.pow(i / rows, 1.45);
      const yb = lerp(640, 1150, v), amp = lerp(90, 260, v), half = lerp(640, 1020, v);
      c.beginPath();
      for (let x = CX - half; x <= CX + half; x += 6) {
        const y = yb - hgt(x, v) * amp;
        x === CX - half ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      const near = 1 - Math.hypot((px - CX) / 900, (yb - py) / 500);
      c.strokeStyle = moon + (0.16 + 0.34 * clamp(near + v * 0.2)).toFixed(2) + ')';
      c.stroke();
    }
    // the phone, lying in the valley between your knees, lighting the folds around it
    c.save(); c.globalCompositeOperation = 'screen';
    const gl = c.createRadialGradient(px, py, 0, px, py, 620 * (1 + 0.02 * Math.sin(t * 2)));
    gl.addColorStop(0, 'rgba(180,198,240,.55)'); gl.addColorStop(0.3, 'rgba(90,110,160,.18)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H); c.restore();
    phone(c, px, py, t, o);
    // the spoken sentence rises as letters, and becomes a palace in the dark above the bed
    if (o.lettersAt !== undefined) {
      const letters = 'ascripttenpageanalysisadraftofsomethingyouhavebeenmeaningtowriteformonths', r = rng(31);
      c.font = 'italic 38px "IM Fell English"';
      for (let i = 0; i < 170; i++) {
        const born = o.lettersAt + r() * 14, life = 3.4 + r() * 2.2, dx = (r() - 0.5) * 520, sway = r() * TAU;
        const q = (t - born) / life; if (q < 0 || q > 1) { r(); continue; }
        c.globalAlpha = Math.sin(q * PI) * 0.8; c.fillStyle = '#e9eefa';
        c.fillText(letters[i % letters.length], px + dx * easeOut(q) + Math.sin(t * 1.3 + sway) * 16 - 120 * q, py - 170 - q * 440); r();
      }
      c.globalAlpha = 1;
    }
    if (o.buildAt !== undefined && t > o.buildAt) {
      c.save(); c.translate(640, 250); c.scale(0.48, 0.48); c.translate(-W / 2, -540);
      L.FACADE.draw(c, ease(seg(t, o.buildAt, o.buildAt + 9)), 'rgba(228,232,246,.85)');
      c.restore();
    }
  };

  /* ============================================================ the rest of the story: worlds */
  // a chapter's name, small and quiet at the top of its first scene
  function chapterMark(c, t, name, night, y = 58) {
    const a = ease(seg(t, 0.4, 1.6)) * (1 - ease(seg(t, 5.0, 6.4)));
    if (a <= 0) return;
    c.font = '400 24px "IM Fell English SC"'; c.letterSpacing = '6px'; c.textAlign = 'center';
    c.fillStyle = night ? `rgba(233,223,204,${0.75 * a})` : `rgba(45,28,18,${0.7 * a})`;
    c.fillText(name, CX, y); c.letterSpacing = '0px'; c.textAlign = 'left';
  }
  // one warm light in a dark room: everything outside its pool falls away
  function lampLight(c, x, y, r, t, strength = 1) {
    const fl = 1 + 0.02 * Math.sin(t * 6.3) + 0.012 * Math.sin(t * 11.7);
    c.save(); c.globalCompositeOperation = 'multiply';
    const g = c.createRadialGradient(x, y, 20, x, y, r * fl);
    g.addColorStop(0, 'rgb(255,238,208)'); g.addColorStop(0.45, 'rgb(196,150,104)'); g.addColorStop(1, `rgb(${Math.round(20 + 30 * (1 - strength))},14,10)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  }
  function oilLamp(c, x, y, t, lit = 1) {
    const e = new Etch();
    e.add(ellipsePts(x, y, 70, 22, 0, PI), 1.6); e.add([[x - 70, y], [x - 40, y - 26], [x + 40, y - 26], [x + 70, y]], 1.6);
    e.add([[x + 40, y - 26], [x + 110, y - 36], [x + 118, y - 30], [x + 60, y - 12]], 1.4);             // the spout
    e.add([[x - 70, y + 4], [x - 110, y - 20], [x - 96, y - 44]], 1.3);                                  // the handle
    e.addAll(hatch(ellipsePts(x, y, 68, 20, 0, PI, 30), 0, 4), 0.6, 0.6);
    e.draw(c, 1, INK);
    if (lit > 0) {
      const fx = x + 114, fy = y - 40, fh = 46 * (1 + 0.08 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29)) * lit;
      const fg = c.createRadialGradient(fx, fy - fh * 0.3, 0, fx, fy - fh * 0.4, fh * 0.9);
      fg.addColorStop(0, 'rgba(255,252,230,1)'); fg.addColorStop(0.45, 'rgba(255,196,90,1)'); fg.addColorStop(1, 'rgba(230,110,30,0)');
      c.fillStyle = fg; c.beginPath(); c.moveTo(fx, fy - fh);
      c.bezierCurveTo(fx + fh * 0.34, fy - fh * 0.45, fx + fh * 0.3, fy, fx, fy); c.bezierCurveTo(fx - fh * 0.3, fy, fx - fh * 0.34, fy - fh * 0.45, fx, fy - fh); c.fill();
    }
  }
  const STUDY = (() => {
    // built once: the engraved room, without the lamp's flame or the light
    const cv = mk(), c = cv.getContext('2d'), r = rng(19);
    c.drawImage(PAPER.day, 0, 0);
    const e = new Etch();
    // ashlar: courses of dressed stone, each block shaded on its lower edge
    for (let row = 0, y = 0; y < 820; y += 64, row++) {
      e.add([[0, y], [W, y]], 0.9, 0.55);
      for (let x = (row % 2) * 110 - 110; x < W; x += 220) { e.add([[x, y], [x, y + 64]], 0.9, 0.5); e.addAll(hatch([[x + 4, y + 50], [x + 216, y + 50], [x + 216, y + 62], [x + 4, y + 62]], 0, 3.2, 0.6, row * 31 + x), 0.5, 0.35); }
    }
    // the arched window: night outside, in dense cross-hatching (the same window as the bedroom's)
    const { x: wx, y: wy, w: ww, h: wh } = WIN, opening = winOpening(0);
    c.fillStyle = 'rgb(246,240,228)'; c.beginPath(); opening.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
    e.addAll(hatch(opening, 0, 3.0, 0, 3), 0.7, 0.9).addAll(hatch(opening, 90, 5.5, 0, 4), 0.5, 0.55);
    e.add([...opening, opening[0]], 2.4);
    e.add([[wx - 22, wy + wh], [wx - 22, wy + ww / 2], ...ellipsePts(wx + ww / 2, wy + ww / 2, ww / 2 + 22, ww / 2 + 22, PI, TAU, 48), [wx + ww + 22, wy + wh]], 1.4);
    for (let k = 0; k <= 10; k++) { const a = PI + (k / 10) * PI; e.add([[wx + ww / 2 + Math.cos(a) * (ww / 2), wy + ww / 2 + Math.sin(a) * (ww / 2)], [wx + ww / 2 + Math.cos(a) * (ww / 2 + 22), wy + ww / 2 + Math.sin(a) * (ww / 2 + 22)]], 1, 0.8); }
    e.add([[wx - 40, wy + wh], [wx + ww + 40, wy + wh], [wx + ww + 30, wy + wh + 18], [wx - 30, wy + wh + 18], [wx - 40, wy + wh]], 1.6);
    e.add([[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], 1.3); e.add([[wx, wy + wh * 0.6], [wx + ww, wy + wh * 0.6]], 1.3);
    // a tall case of scrolls on the right
    const bx = 1690, by = 150;
    e.add([[bx, 1000], [bx, by], [W + 10, by]], 2);
    for (let row = 0; row < 7; row++) {
      const y = by + 30 + row * 118; e.add([[bx, y], [W, y]], 1.4);
      for (let k = 0; k < 7; k++) { const cx = bx + 30 + k * 34, cy = y + 30 + (k % 2) * 36 + ((row * 7 + k) % 3) * 8; e.add(ellipsePts(cx, cy, 14, 14, 0, TAU, 20), 1); e.add(ellipsePts(cx, cy, 5, 5, 0, TAU, 10), 0.7, 0.8); }
    }
    // a laurel wreath hung on the wall, and a rug under the desk
    for (let k = 0; k < 26; k++) { const a = PI * 0.15 + (k / 25) * PI * 1.7, cx = 1590 + Math.cos(a) * 46, cy = 150 + Math.sin(a) * 46, rot = a + PI / 2;
      e.add(ellipsePts(cx, cy, 11, 4.5, rot - 0.6, rot - 0.6 + TAU, 12), 0.9); }
    e.add([[1560, 196], [1550, 226]], 1); e.add([[1620, 196], [1630, 226]], 1);
    const rug = [[520, 1004], [1880, 1004], [1990, H], [410, H]];
    c.fillStyle = 'rgba(150,62,44,.35)'; c.beginPath(); rug.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.fill();
    e.add([...rug, rug[0]], 1.4).add([[560, 1016], [1840, 1016], [1935, 1070], [465, 1070], [560, 1016]], 1, 0.7);
    e.addAll(hatch(rug, 90, 7, 1, 17), 0.5, 0.35);
    // the floor: large flags in perspective
    for (let k = 0; k < 9; k++) { const y = 1000 + k * k * 1.6 + k * 8; e.add([[0, y], [W, y]], 0.9, 0.6); }
    for (let k = -8; k <= 8; k++) e.add([[960 + k * 160, 1000], [960 + k * 330, H]], 0.8, 0.45);
    // the desk: a heavy table with turned legs and a carved apron
    e.add([[620, 752], [1780, 752], [1792, 770], [608, 770], [620, 752]], 2.2);
    e.add([[640, 770], [1760, 770], [1760, 830], [640, 830], [640, 770]], 1.6);
    e.addAll(hatch([[642, 772], [1758, 772], [1758, 828], [642, 828]], 0, 3.4, 0, 8), 0.6, 0.6);
    for (let k = 0; k < 7; k++) e.add(ellipsePts(760 + k * 160, 800, 26, 12, 0, TAU, 24), 1.1);
    for (const lx of [680, 1720]) {
      e.add([[lx - 18, 830], [lx - 18, 860], [lx - 30, 880], [lx - 18, 905], [lx - 12, 990], [lx - 24, 1010], [lx + 24, 1010], [lx + 12, 990], [lx + 18, 905], [lx + 30, 880], [lx + 18, 860], [lx + 18, 830]], 1.6);
      e.addAll(hatch([[lx + 2, 832], [lx + 16, 832], [lx + 16, 1006], [lx + 2, 1006]], 90, 3), 0.6, 0.6);
    }
    e.add([[680, 960], [1720, 960]], 1.4);
    // on the desk: rolled scrolls, an unrolled one with writing, an inkwell and a reed pen
    for (let k = 0; k < 4; k++) { const sx = 700 + (k % 2) * 30, sy = 744 - k * 16; e.add([[sx, sy], [sx + 170, sy + 4]], 1.2); e.add([[sx, sy + 14], [sx + 170, sy + 18]], 1.2); e.add(ellipsePts(sx + 170, sy + 11, 6, 8, 0, TAU, 14), 1); }
    e.add([[930, 748], [1250, 748], [1262, 740], [918, 740], [930, 748]], 1.3);
    e.add(ellipsePts(918, 744, 9, 13, 0, TAU, 18), 1.2); e.add(ellipsePts(1262, 744, 9, 13, 0, TAU, 18), 1.2);
    e.add(ellipsePts(1310, 740, 18, 7, 0, TAU, 24), 1.2); e.add([[1292, 740], [1294, 718], [1326, 718], [1328, 740]], 1.2);
    e.add([[1300, 716], [1250, 640]], 1.2); e.add([[1254, 646], [1244, 628], [1262, 638]], 0.9);
    e.draw(c, 1, INK);
    c.fillStyle = 'rgba(40,24,14,.5)'; for (let i = 0; i < 6; i++) c.fillRect(950, 742 + (i % 2) * 3, 40 + ((i * 53) % 230), 1.2);
    // the moon, a little of it, through the window
    c.fillStyle = 'rgb(246,240,228)'; c.beginPath(); c.arc(wx + 240, wy + 150, 26, 0, TAU); c.fill();
    c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
    return cv;
  })();
  WORLD.study = (c, t, o = {}) => {
    // Marcus Aurelius at his desk, at night, writing to himself
    c.drawImage(STUDY, 0, 0);
    oilLamp(c, 1400, 752, t);
    c.fillStyle = 'rgba(40,24,14,.28)'; c.beginPath(); c.ellipse(1540, 1062, 190, 18, 0, 0, TAU); c.fill();
    const img = IMG.s1, h = 740, w = (img.width / img.height) * h;
    c.save(); c.translate(1580, 1070); c.scale(-1, 1); c.drawImage(spriteAt(0, 480).fill, -w / 2, -h, w, h); c.drawImage(img, -w / 2, -h, w, h); c.restore();
    lampLight(c, 1480, 700, 1250, t);
    // the moon through the window, as in the bedroom: a pale shaft across the desk
    c.save(); c.globalCompositeOperation = 'screen';
    const mo = c.createRadialGradient(WIN.moon[0], WIN.moon[1], 0, WIN.moon[0], WIN.moon[1], 120); mo.addColorStop(0, 'rgba(236,240,255,.75)'); mo.addColorStop(0.3, 'rgba(180,196,236,.2)'); mo.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = mo; c.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    const beam = c.createLinearGradient(1300, 560, 900, 1080); beam.addColorStop(0, 'rgba(170,186,230,.16)'); beam.addColorStop(1, 'rgba(170,186,230,0)');
    c.fillStyle = beam; c.beginPath(); c.moveTo(WIN.x, WIN.y + WIN.h); c.lineTo(WIN.x + WIN.w, WIN.y + WIN.h); c.lineTo(1250, H); c.lineTo(620, H); c.closePath(); c.fill();
    c.restore();
  };
  WORLD.tablet = (c, t, o = {}) => {
    // the question, cut into stone, lit from the side
    L.paper(c, 'day');
    L.TABLET.draw(c, ease(seg(t, 0.2, 2.0)), INK);
    const lines = ['ASK YOURSELF AT EVERY MOMENT:', 'IS THIS NECESSARY?'];
    c.font = '56px "Cinzel"'; c.textBaseline = 'middle';
    let n = 0; const per = 0.07, start = 1.4;
    lines.forEach((ln, li) => {
      const y = 480 + li * 110, w = [...ln].reduce((a, ch) => a + c.measureText(ch).width + 6, -6); let x = CX - w / 2;
      for (const ch of ln) {
        const k = seg(t, start + n * per, start + n * per + 0.25);
        if (k > 0) { c.globalAlpha = k; c.fillStyle = 'rgba(255,250,240,.9)'; c.fillText(ch, x + 2, y + 2); c.fillStyle = INK; c.fillText(ch, x, y); }
        x += c.measureText(ch).width + 6; n++;
      }
    });
    c.globalAlpha = 1;
    lampLight(c, 1500, 300, 1500, t, 0.6);
  };
  const WINGS = (() => {
    const out = [], r = rng(8);
    for (let i = 0; i < 8; i++) {
      const cx = 150 + i * 231, e = new Etch(), base = 790, cols = 3, sw = 176, top = 470 + r() * 40;
      e.add(rect(cx - sw / 2 - 10, base, sw + 20, 16), 1.3);
      for (let k = 0; k < cols; k++) {
        const x = cx - sw / 2 + 22 + k * ((sw - 44) / (cols - 1));
        e.add([[x - 11, base], [x - 9, top + 14]], 1.3); e.add([[x + 11, base], [x + 9, top + 14]], 1.3);
        e.add([[x - 2, base - 4], [x - 2, top + 18]], 0.7, 0.7);
        e.add(rect(x - 16, top, 32, 14), 1.1);
      }
      e.add(rect(cx - sw / 2 - 6, top - 34, sw + 12, 34), 1.3);
      e.add([[cx - sw / 2 - 16, top - 34], [cx, top - 92], [cx + sw / 2 + 16, top - 34]], 1.4);
      e.addAll(hatch([[cx - sw / 2 + 2, top - 36], [cx, top - 86], [cx + sw / 2 - 2, top - 36]], 0, 5, 1, i), 0.6, 0.5);
      e.addAll(hatch([[cx - sw / 2 + 4, top + 16], [cx + sw / 2 - 4, top + 16], [cx + sw / 2 - 4, base - 2], [cx - sw / 2 + 4, base - 2]], 0, 7, 3, i + 20), 0.5, 0.25);
      const sc = new Etch();
      for (const sx of [cx - sw / 2 - 16, cx - 20, cx + sw / 2 + 16]) sc.add([[sx, base + 14], [sx, top - 110]], 1, 0.8);
      for (let y = base - 40; y > top - 100; y -= 70) { sc.add([[cx - sw / 2 - 26, y], [cx + sw / 2 + 26, y]], 1, 0.8); sc.add([[cx - sw / 2 - 16, y], [cx - 20, y - 70]], 0.7, 0.6); sc.add([[cx + sw / 2 + 16, y], [cx - 20, y - 70]], 0.7, 0.6); }
      out.push({ cx, e, sc, stop: 0.28 + r() * 0.5, label: ['Investor memo', 'Market analysis', 'Launch script', 'Sales dashboard', 'Essay, part II', 'Habit app', 'Q3 plan', 'Reply to Anna'][i] });
    }
    return out;
  })();
  WORLD.tabs = (c, t, o = {}) => {
    L.paper(c, 'day');
    c.strokeStyle = 'rgba(43,26,18,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 806); c.lineTo(W, 806); c.stroke();
    WINGS.forEach((wg, i) => {
      const born = (o.tabsAt ?? 0.6) + i * 0.55, k = easeOut(seg(t, born, born + 0.3));
      if (k <= 0) return;
      // the tab: flat, modern, and out of place in an engraving
      c.globalAlpha = k;
      const active = i === 7;
      c.fillStyle = active ? '#b8841c' : '#2c2420';
      c.beginPath(); c.moveTo(wg.cx - 108, 196); c.lineTo(wg.cx - 94, 146); c.lineTo(wg.cx + 94, 146); c.lineTo(wg.cx + 108, 196); c.closePath(); c.fill();
      c.fillStyle = active ? '#1d140c' : '#f1e8d6'; c.font = '600 19px -apple-system, "Helvetica Neue", Arial, sans-serif'; c.textBaseline = 'middle';
      c.fillText(wg.label, wg.cx - 80, 172); c.globalAlpha = k * 0.6; c.fillText('×', wg.cx + 76, 172); c.globalAlpha = k; c.textBaseline = 'alphabetic';
      // a thread from the tab down to its wing
      c.strokeStyle = 'rgba(43,26,18,.25)'; c.lineWidth = 1; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(wg.cx, 192); c.lineTo(wg.cx, 360); c.stroke(); c.setLineDash([]);
      const grow = ease(seg(t, born + 0.3, born + 2.6)) * wg.stop;
      const gone = seg(t, o.abandonAt + i * 0.25, o.abandonAt + i * 0.25 + 1.6);
      c.fillStyle = `rgba(58,34,24,${0.12 * k})`; c.beginPath(); c.ellipse(wg.cx, 806, 110, 9, 0, 0, TAU); c.fill();
      wg.sc.draw(c, clamp(grow / wg.stop * 1.2), INK, 0.28 * k * (1 - gone));
      wg.e.draw(c, grow, INK, lerp(1, 0.22, gone) * k);
      c.globalAlpha = 1;
    });
  };
  const BAL_FRONT = { x: 476, y: 730 }, LINE_FIRST = { x: 960, y: 620 };
  const BAL_SLOTS = (() => {
    const a = [], r = rng(6);
    for (let row = 0; row < 5; row++) { const order = [0, -1, 1, -2, 2, -3, 3, -4, 4]; order.forEach((j) => a.push({ row, x: j * 30 + (row % 2) * 14 + (r() - 0.5) * 6, flip: r() < 0.5, key: row * 10 + Math.abs(j) })); }
    return a.sort((p2, q) => p2.key - q.key || p2.x - q.x);
  })();
  WORLD.balance = (c, t, o = {}) => {
    L.paper(c, 'day');
    c.save(); c.translate(CX, 1010); c.scale(0.95, 0.95); c.translate(-CX, -960);
    const pv = [CX, 330], Lb = 520;
    const n = Math.round(lerp(1, 46, easeIn(seg(t, o.pourAt, o.pourAt + 4.5))));
    const lit = (j) => t < o.outAt + j * 0.45;
    const m = [0, 1, 2, 3, 4, 5, 6].filter((j) => j === 0 || lit(j)).length;
    const target = clamp((n - m * 3) / 30, -0.2, 0.2);
    const th = lerp(-0.18, target, ease(seg(t, o.pourAt, o.pourAt + 5)));
    const left = [pv[0] - Lb * Math.cos(th), pv[1] + Lb * Math.sin(th)], right = [pv[0] + Lb * Math.cos(th), pv[1] - Lb * Math.sin(th)];
    // post and base, engraved
    const post = [[CX - 12, 930], [CX - 7, 330], [CX + 7, 330], [CX + 12, 930]];
    c.fillStyle = 'rgba(248,242,230,1)'; c.beginPath(); post.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.fill();
    new Etch().add([...post, post[0]], 1.8).addAll(hatch(post, 90, 3), 0.7, 0.5).draw(c);
    const base = [[CX - 170, 960], [CX - 100, 930], [CX + 100, 930], [CX + 170, 960]];
    new Etch().add([...base, base[0]], 1.8).addAll(hatch(base, 0, 4), 0.7, 0.7).draw(c);
    // the beam, gilded
    c.save(); c.translate(pv[0], pv[1]); c.rotate(-th);
    const bg2 = c.createLinearGradient(0, -9, 0, 9); bg2.addColorStop(0, '#e6bf62'); bg2.addColorStop(1, '#7c5410');
    c.fillStyle = bg2; c.fillRect(-Lb - 10, -8, 2 * Lb + 20, 16); c.strokeStyle = INK; c.lineWidth = 1.6; c.strokeRect(-Lb - 10, -8, 2 * Lb + 20, 16);
    c.restore();
    c.fillStyle = '#b8841c'; c.beginPath(); c.arc(pv[0], pv[1], 18, 0, TAU); c.fill(); c.strokeStyle = INK; c.stroke();
    const pan = ([ex, ey], label, fill) => {
      const py = ey + 280;
      c.strokeStyle = INK; c.lineWidth = 1.3;
      for (const dx of [-150, 0, 150]) { c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + dx, py - (dx ? 0 : 60)); c.stroke(); }
      c.fillStyle = 'rgba(248,242,230,1)'; c.beginPath(); c.ellipse(ex, py, 162, 52, 0, 0, PI); c.fill();
      new Etch().add(ellipsePts(ex, py, 162, 22), 2).add(ellipsePts(ex, py, 162, 52, 0, PI), 2).addAll(hatch(ellipsePts(ex, py, 160, 50, 0, PI, 30), 0, 5), 0.6, 0.55).draw(c);
      fill(ex, py);
      c.font = '400 30px "IM Fell English SC"'; c.letterSpacing = '8px'; c.textAlign = 'center'; c.fillStyle = INK; c.fillText(label, ex, py + 108); c.textAlign = 'left'; c.letterSpacing = '0px';
    };
    pan(left, 'Labour', (ex, py) => {
      // servants step onto the pan and stand in ranks, front to back, the way a crowd fills a floor
      const slots = BAL_SLOTS.slice(0, n).map((sl, i) => ({ ...sl, i })).sort((a, b) => b.row - a.row || a.i - b.i);
      for (const sl of slots) {
        const i = sl.i, h = 104 - sl.row * 4, img = spriteAt(i % 6, h), w = (img.width / img.height) * h;
        const k = easeOut(clamp((t - o.pourAt - Math.log(i + 1) * 0.9) / 0.4 + (i === 0 ? 99 : 0)));
        const x = ex + sl.x, y = py + 4 - sl.row * 10 - (1 - k) * 40;
        c.globalAlpha = k; c.save(); c.translate(x, y); if (sl.flip) c.scale(-1, 1); if (img.fill) c.drawImage(img.fill, -w / 2, -h, w, h); c.drawImage(img, -w / 2, -h, w, h); c.restore();
      }
      c.globalAlpha = 1;
    });
    pan(right, 'Attention', (ex, py) => {
      for (let j = 6; j >= 0; j--) {
        const fade = j === 0 ? 1 : 1 - seg(t, o.outAt + j * 0.45, o.outAt + j * 0.45 + 0.4);
        if (fade <= 0) continue;
        candle(c, ex + (j === 0 ? 0 : (j % 2 ? -1 : 1) * Math.ceil(j / 2) * 42), py - 6, 110, t, j === 0 ? 1 : fade);
      }
    });
    c.restore();
  };
  // the court painter's portrait: the same oval frame the mirror will have, on an easel
  const goldFills = {};
  const goldFill = (i) => { if (!goldFills[i]) { const f = MIPS[i][5].fill, g = mk(f.width, f.height), x = g.getContext('2d'); x.drawImage(f, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#d9a640'; x.fillRect(0, 0, f.width, f.height); goldFills[i] = g; } return goldFills[i]; };
  function bust(c, i, cx, top, wpx, alpha, fillImg) {
    const src = MIPS[i][5], y0 = src.height * 0.025, ch = src.height * 0.4, sc = wpx / src.width, img = IMG['s' + (i + 1)], kx = img.width / src.width;
    c.globalAlpha = alpha;
    c.drawImage(fillImg || src.fill, 0, y0, src.width, ch, cx - wpx / 2, top, wpx, ch * sc);
    if (!fillImg) c.drawImage(img, 0, y0 * kx, img.width, ch * kx, cx - wpx / 2, top, wpx, ch * sc);
    c.globalAlpha = 1;
  }
  function portrait(c, t, P) {
    const FL = 1262, sh = P.shakeAt !== undefined ? Math.sin((t - P.shakeAt) * 38) * 9 * Math.max(0, 1 - (t - P.shakeAt) / 0.7) * (t > P.shakeAt ? 1 : 0) : 0;
    // the easel
    c.strokeStyle = INK; c.lineWidth = 3;
    const legs = [[[CX - 190, 300], [CX - 430, FL]], [[CX + 190, 300], [CX + 430, FL]], [[CX, 240], [CX, FL - 30]]];
    for (const [[x0, y0], [x1, y1]] of legs) { c.fillStyle = 'rgb(238,228,210)'; c.beginPath(); c.moveTo(x0 - 9, y0); c.lineTo(x0 + 9, y0); c.lineTo(x1 + 11, y1); c.lineTo(x1 - 11, y1); c.closePath(); c.fill(); c.lineWidth = 1.6; c.stroke();
      c.lineWidth = 0.8; c.strokeStyle = 'rgba(43,26,18,.45)'; for (let k = 0.05; k < 1; k += 0.02) { const x = lerp(x0, x1, k), y = lerp(y0, y1, k); c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + 9, y); c.stroke(); } c.strokeStyle = INK; }
    c.fillStyle = 'rgb(232,220,200)'; c.fillRect(CX - 330, 836, 660, 26); c.lineWidth = 1.6; c.strokeRect(CX - 330, 836, 660, 26);
    c.save(); c.translate(sh, 0);
    // the canvas: dark umber ground, and the painted sitter
    c.save(); c.beginPath(); c.ellipse(CX, 500, 250, 330, 0, 0, TAU); c.clip();
    const bg = c.createRadialGradient(CX - 60, 380, 40, CX, 520, 420); bg.addColorStop(0, 'rgb(128,96,66)'); bg.addColorStop(1, 'rgb(58,40,26)');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const a1 = clamp((t - P.v1At) / 1.2) * (1 - clamp((t - P.swapAt) / 0.8)), a2 = clamp((t - P.swapAt - 0.6) / 1.2);
    const gap = P.gapAt !== undefined ? ease(clamp((t - P.gapAt) / 1.4)) : 0;
    if (gap > 0) { c.save(); c.shadowColor = 'rgba(255,210,110,.95)'; c.shadowBlur = 30; bust(c, 4, CX + 4, 208, 580, 0.9 * gap, goldFill(4)); c.restore(); }
    if (a1 > 0) bust(c, 2, CX, 240, 520, a1);
    if (a2 > 0) bust(c, 4, CX, 236, 520, a2);
    const sheen = c.createLinearGradient(CX - 250, 170, CX + 250, 830); sheen.addColorStop(0, 'rgba(255,240,210,.14)'); sheen.addColorStop(0.5, 'rgba(255,240,210,0)'); c.fillStyle = sheen; c.fillRect(0, 0, W, H);
    c.restore();
    L.MIRROR.draw(c, ease(seg(t, 0.1, 2.4)), INK);
    c.restore();
  }
  WORLD.mirror = (c, t, o = {}) => {
    if (!o.noPaper) L.paper(c, 'dusk');
    c.save(); c.translate(CX, 520); const z = o.portrait ? 1 : lerp(1, 1.08, ease(clamp(t / (o.d || 16)))); c.scale(z, z); c.translate(-CX, -520);
    // the floor, and two servants standing either side of the glass they have brought you
    const FL = 1262;
    c.strokeStyle = 'rgba(43,26,18,.5)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-600, FL); c.lineTo(W + 600, FL); c.stroke();
    c.strokeStyle = 'rgba(43,26,18,.22)'; c.lineWidth = 1; c.beginPath(); for (let k = -10; k <= 10; k++) { c.moveTo(CX + k * 150, FL); c.lineTo(CX + k * 260, FL + 260); } for (let k = 1; k < 6; k++) { c.moveTo(-600, FL + k * k * 9); c.lineTo(W + 600, FL + k * k * 9); } c.stroke();
    c.fillStyle = 'rgba(40,24,14,.2)'; c.beginPath(); c.ellipse(CX, FL + 4, 520, 26, 0, 0, TAU); c.fill();
    for (const [i, x, flip] of [[1, CX - 520, false], [3, CX + 520, true]]) {
      const img = IMG['s' + (i + 1)], h = 820, w = (img.width / img.height) * h;
      c.save(); c.translate(x, FL); if (flip) c.scale(-1, 1); c.drawImage(spriteAt(i, 480).fill, -w / 2, -h, w, h); c.drawImage(img, -w / 2, -h, w, h); c.restore();
    }
    if (o.portrait) { portrait(c, t, o.portrait); c.restore(); return; }
    // the stand: two turned posts, splayed feet, the glass swung between them
    for (const sg of [-1, 1]) {
      const x = CX + sg * 352;
      c.fillStyle = 'rgb(242,235,221)'; c.fillRect(x - 11, 470, 22, FL - 470);
      c.strokeStyle = INK; c.lineWidth = 1.6; c.strokeRect(x - 11, 470, 22, FL - 470);
      c.lineWidth = 0.8; c.strokeStyle = 'rgba(43,26,18,.5)'; for (let y = 474; y < FL; y += 5) { c.beginPath(); c.moveTo(x + 3 * sg, y); c.lineTo(x + 10 * sg, y); c.stroke(); }
      for (const y of [560, 760, 980]) { c.beginPath(); c.ellipse(x, y, 17, 8, 0, 0, TAU); c.fillStyle = 'rgb(242,235,221)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); }
      c.beginPath(); c.moveTo(x, 470); c.lineTo(x - 12, 440); c.quadraticCurveTo(x, 400, x + 12, 440); c.closePath(); c.fillStyle = '#d0a24a'; c.fill(); c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.moveTo(x - 90, FL); c.quadraticCurveTo(x, FL - 40, x + 90, FL); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(x - sg * 18, 520, 7, 0, TAU); c.fillStyle = '#b8841c'; c.fill(); c.stroke();
    }
    const f = o.still ? 1 : seg(t, 0.8, 2.4);
    c.save(); c.beginPath(); c.ellipse(CX, 500, 250, 330, 0, 0, TAU); c.clip();
    const sg3 = c.createLinearGradient(CX - 250, 170, CX + 250, 830);
    sg3.addColorStop(0, `rgba(222,222,218,${f})`); sg3.addColorStop(0.5, `rgba(186,188,188,${f})`); sg3.addColorStop(1, `rgba(214,214,210,${f})`);
    c.fillStyle = sg3; c.fillRect(0, 0, W, H);
    const b = seg(t, o.faceAt ?? 3, (o.faceAt ?? 3) + 3);
    c.filter = 'blur(7px)'; c.globalAlpha = 0.5 * b; c.fillStyle = '#9a9a98';
    c.beginPath(); c.ellipse(CX, 470, 95, 125, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(CX, 800, 230, 170, 0, PI, TAU); c.fill();
    c.filter = 'none'; c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(CX - 170, 260); c.lineTo(CX - 60, 220); c.stroke();
    c.restore();
    L.MIRROR.draw(c, o.still ? 1 : ease(seg(t, 0.1, 2.4)), INK);
    c.restore();
  };
  const TEST = (() => {
    const lv = [{ n: 1, y: 480, h: 170, b: 1 }, { n: 3, y: 680, h: 136, b: 3 }, { n: 9, y: 858, h: 110, b: 6 }, { n: 27, y: 1046, h: 92, b: 11 }];
    const pos = lv.map((l) => Array.from({ length: l.n }, (_, i) => (l.n === 1 ? CX : l.n === 3 ? CX + (i - 1) * 440 : lerp(l.n === 9 ? 230 : 70, W - (l.n === 9 ? 230 : 70), i / (l.n - 1)))));
    const walls = [
      { x: 700, w: 520, y: 520, label: 'Clarity', lv: 1 }, { x: 170, w: 560, y: 706, label: 'Context', lv: 2 }, { x: 1190, w: 560, y: 706, label: 'Tools', lv: 2 },
      { x: 60, w: 820, y: 884, label: 'Structure', lv: 3 }, { x: 1040, w: 820, y: 884, label: 'Time', lv: 3 },
    ];
    return { lv, pos, walls };
  })();
  WORLD.test = (c, t, o = {}) => {
    L.paper(c, 'dusk');
    const { lv, pos, walls } = TEST, SP = [IMG.s1, IMG.s2, IMG.s3, IMG.s4, IMG.s5, IMG.s6];
    const wk = walls.map((wl, i) => ease(clamp((t - o.wallsAt - i * 0.9) / 0.7)));
    const gold = o.goldAt !== undefined ? ease(clamp((t - o.goldAt) / 1.6)) : 0;
    const blocked = (li, x) => walls.some((wl, i) => wl.lv === li && wk[i] > 0.5 && x > wl.x - 40 && x < wl.x + wl.w + 40);
    lv.forEach((l, li) => {
      const k = easeOut(clamp((t - o.levelsAt - li * 1.5) / 1.0)); if (k <= 0) return;
      if (li > 0) pos[li].forEach((x, i) => {
        const px = pos[li - 1][Math.floor(i / 3)], dim = blocked(li, (x + px) / 2) ? 0.35 : 1;
        c.strokeStyle = `rgba(43,26,18,${0.5 * k * dim})`; c.lineWidth = 1.1; c.beginPath(); c.moveTo(px, lv[li - 1].y + 6); c.lineTo(x, l.y - l.h - 6); c.stroke();
      });
      pos[li].forEach((x, i) => {
        const img = pixelated(SP[(i + li) % 6], l.h, l.b), dim = li > 0 && blocked(li, x) ? 0.4 : 1;
        c.globalAlpha = k * dim; c.globalCompositeOperation = 'multiply'; c.drawImage(img, x - img.width / 2, l.y - l.h); c.drawImage(img, x - img.width / 2, l.y - l.h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      });
    });
    const ka = easeOut(clamp((t - o.levelsAt) / 1.0));
    if (ka > 0) { c.globalAlpha = ka; c.drawImage(L.GOLD_CROWN, CX - 40, lv[0].y - lv[0].h - 58, 80, 63); c.globalAlpha = 1; }
    // the walls go up across the lines of command, each with its name cut into it
    walls.forEach((wl, i) => {
      const k = wk[i]; if (k <= 0) return;
      const hh = 34 * k, y = wl.y + 34 - hh;
      const g = c.createLinearGradient(0, y, 0, y + hh);
      g.addColorStop(0, gold > 0 ? `rgb(${lerp(236, 240, gold)},${lerp(226, 200, gold)},${lerp(206, 120, gold)})` : 'rgb(236,226,206)'); g.addColorStop(1, gold > 0 ? `rgb(${lerp(212, 196, gold)},${lerp(198, 150, gold)},${lerp(174, 60, gold)})` : 'rgb(212,198,174)');
      c.fillStyle = g; c.fillRect(wl.x, y, wl.w, hh); c.strokeStyle = INK; c.lineWidth = 1.4; c.strokeRect(wl.x, y, wl.w, hh);
      c.strokeStyle = 'rgba(43,26,18,.4)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(wl.x, y + hh / 2); c.lineTo(wl.x + wl.w, y + hh / 2);
      for (let x = wl.x + 40; x < wl.x + wl.w; x += 80) { c.moveTo(x, y); c.lineTo(x, y + hh / 2); c.moveTo(x + 40, y + hh / 2); c.lineTo(x + 40, y + hh); } c.stroke();
      if (k > 0.8) {
        const lw = 180; c.fillStyle = gold > 0 ? 'rgb(84,54,12)' : 'rgb(246,240,228)'; c.fillRect(wl.x + wl.w / 2 - lw / 2, y + 4, lw, hh - 8);
        c.font = '400 22px "IM Fell English SC"'; c.letterSpacing = '6px'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = gold > 0 ? '#f2d58c' : INK; c.fillText(wl.label, wl.x + wl.w / 2, y + hh / 2 + 1); c.letterSpacing = '0px'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      }
      const hit = Math.sin(clamp((t - o.wallsAt - i * 0.9 - 0.6) / 0.5) * PI);
      if (hit > 0) { c.save(); c.globalCompositeOperation = 'screen'; const hg = c.createRadialGradient(wl.x + wl.w / 2, y, 0, wl.x + wl.w / 2, y, wl.w * 0.6); hg.addColorStop(0, `rgba(255,190,120,${0.4 * hit})`); hg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = hg; c.fillRect(0, 0, W, H); c.restore(); }
      if (gold > 0) { c.save(); c.globalCompositeOperation = 'screen'; c.shadowColor = `rgba(255,210,120,${0.8 * gold})`; c.shadowBlur = 30; c.fillStyle = `rgba(255,220,140,${0.12 * gold})`; c.fillRect(wl.x, y, wl.w, hh); c.restore(); }
    });
    // then one wall, and a door in it, opening onto first light
    const wa = o.wallAt !== undefined ? ease(clamp((t - o.wallAt) / 1.4)) : 0;
    if (wa > 0) {
      c.globalAlpha = wa; L.paper(c, 'dusk'); c.globalAlpha = 1;
      L.WALL.draw(c, ease(seg(t, o.wallAt, o.wallAt + 2.6)), INK, wa);
      const door = L.doorPath(), open = ease(seg(t, o.openAt, o.openAt + 3));
      c.save(); c.beginPath(); door.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      c.fillStyle = `rgba(246,240,228,${wa})`; c.fill(); c.clip();
      if (open > 0) { const g = c.createRadialGradient(CX, 800, 0, CX, 800, 560); g.addColorStop(0, `rgba(255,248,226,${open})`); g.addColorStop(1, `rgba(248,206,128,${open * 0.9})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      c.restore();
      if (open > 0) { c.save(); c.globalCompositeOperation = 'screen'; const rays = c.createRadialGradient(CX, 760, 60, CX, 760, 1000 * open + 1); rays.addColorStop(0, `rgba(255,214,140,${0.55 * open})`); rays.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = rays; c.fillRect(0, 0, W, H); c.restore(); }
      new Etch().add([...door, door[0]], 4).draw(c, ease(seg(t, o.wallAt + 1.4, o.wallAt + 3.2)), INK, wa);
    }
  };
  WORLD.ruins = (c, t, o = {}) => {
    L.paper(c, 'night');
    const img = IMG.ruins, cover = Math.max(W / img.width, H / img.height), k = ease(clamp(t / (o.d || 10)));
    const s = cover * lerp(1.18, 1.0, k), w = img.width * s, h = img.height * s;
    c.save(); c.globalAlpha = 0.95; c.filter = 'invert(1) sepia(.45) brightness(.62) contrast(1.25)';
    c.drawImage(img, (W - w) / 2, (H - h) * lerp(0.4, 0.55, k), w, h); c.restore();
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(118,116,140)'; c.fillRect(0, 0, W, H); c.restore();
    stars(c, t, 90, 17, 0.5);
  };
  /* ============================================================ the book */
  const PAGE = { top: 78, bottom: 1002, lx: 116, rx: 1804 }, SPINE = W / 2;
  const PLATE = { x: 1022, y: 318, w: 720, h: 405 };          // 16:9, so the camera can travel into it exactly
  let bookBase, cover;
  function buildBook() {
    bookBase = mk(); const c = bookBase.getContext('2d');
    c.fillStyle = 'rgba(0,0,0,.55)'; c.filter = 'blur(22px)'; c.fillRect(PAGE.lx - 10, PAGE.top + 30, PAGE.rx - PAGE.lx + 20, PAGE.bottom - PAGE.top); c.filter = 'none';
    c.fillStyle = '#4a2c18'; c.fillRect(PAGE.lx - 22, PAGE.top - 16, PAGE.rx - PAGE.lx + 44, PAGE.bottom - PAGE.top + 34);
    for (let k = 6; k >= 1; k--) { c.fillStyle = k % 2 ? '#d9ccb4' : '#cbbda4'; c.fillRect(PAGE.lx - k * 2.2, PAGE.top + k * 1.6, PAGE.rx - PAGE.lx + k * 4.4, PAGE.bottom - PAGE.top + k * 1.2); }
    c.save(); c.beginPath(); c.rect(PAGE.lx, PAGE.top, PAGE.rx - PAGE.lx, PAGE.bottom - PAGE.top); c.clip();
    c.drawImage(PAPER.day, 0, 0);
    const g = c.createLinearGradient(SPINE - 170, 0, SPINE + 170, 0);
    g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(0.42, 'rgba(60,40,20,.2)'); g.addColorStop(0.5, 'rgba(40,26,12,.55)'); g.addColorStop(0.58, 'rgba(60,40,20,.2)'); g.addColorStop(1, 'rgba(60,40,20,0)');
    c.fillStyle = g; c.fillRect(SPINE - 170, 0, 340, H);
    c.restore();
    // the cover: dark leather, a gilt title and a crown
    cover = mk(PAGE.rx - SPINE + 22, PAGE.bottom - PAGE.top + 34); const k = cover.getContext('2d');
    k.fillStyle = '#3b1f14'; k.fillRect(0, 0, cover.width, cover.height);
    k.globalAlpha = 0.35; k.globalCompositeOperation = 'overlay'; k.drawImage(PAPER.dark, 0, 0); k.globalAlpha = 1; k.globalCompositeOperation = 'source-over';
    const lg = k.createLinearGradient(0, 0, 0, cover.height); lg.addColorStop(0, 'rgba(255,220,180,.08)'); lg.addColorStop(1, 'rgba(0,0,0,.25)');
    k.fillStyle = lg; k.fillRect(0, 0, cover.width, cover.height);
    k.strokeStyle = 'rgba(200,160,80,.7)'; k.lineWidth = 2; k.strokeRect(40, 40, cover.width - 80, cover.height - 80); k.lineWidth = 1; k.strokeRect(52, 52, cover.width - 104, cover.height - 104);
    k.drawImage(L.GOLD_CROWN, cover.width / 2 - 120, 250, 240, 188);
    k.font = '400 50px "IM Fell English SC"'; k.letterSpacing = '8px'; k.textAlign = 'center'; k.fillStyle = '#d6ac55';
    k.fillText('The Saddest', cover.width / 2, 560); k.fillText('Empires', cover.width / 2, 630);
    k.letterSpacing = '0px'; k.font = 'italic 400 28px "IM Fell English"'; k.fillText('Samuel Salzer', cover.width / 2, 760);
  }
  // a leaf turning about the spine: side +1 is lying on the right, -1 on the left
  function leaf(c, side, front, back) {
    const s = clamp(side, -1, 1), w = PAGE.rx - SPINE;
    if (Math.abs(s) < 0.01) return;
    c.save(); c.translate(SPINE, 0); c.scale(s, 1);
    const img = s > 0 ? front : back;
    if (img) { if (s < 0) { c.scale(-1, 1); c.translate(-w, 0); } c.drawImage(img, 0, PAGE.top - (img === cover ? 16 : 0), img === cover ? w + 22 : w, img === cover ? PAGE.bottom - PAGE.top + 34 : PAGE.bottom - PAGE.top); }
    c.restore();
    // shade: darkest when the leaf stands upright
    const sh = 1 - Math.abs(s);
    const x0 = s > 0 ? SPINE : SPINE + w * s, x1 = s > 0 ? SPINE + w * s : SPINE;
    c.fillStyle = `rgba(20,10,4,${0.45 * sh})`; c.fillRect(x0, PAGE.top, x1 - x0, PAGE.bottom - PAGE.top);
  }
  const paperLeaf = (() => { let p; return () => { if (!p) { p = mk(PAGE.rx - SPINE, PAGE.bottom - PAGE.top); p.getContext('2d').drawImage(PAPER.day, 300, 60, p.width, p.height, 0, 0, p.width, p.height); } return p; }; })();
  const endpaper = (() => { let p; return () => { if (!p) { p = mk(PAGE.rx - SPINE + 22, PAGE.bottom - PAGE.top + 34); const g = p.getContext('2d'); g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, p.width, p.height); g.globalAlpha = 0.5; g.globalCompositeOperation = 'overlay'; g.drawImage(PAPER.day, 0, 0); } return p; }; })();
  const printedLeaf = (() => { let p; return () => {
    if (!p) {
      p = mk(PAGE.rx - SPINE, PAGE.bottom - PAGE.top); const g = p.getContext('2d');
      g.drawImage(PAPER.day, 500, 40, p.width, p.height, 0, 0, p.width, p.height);
      const r = rng(8); g.fillStyle = 'rgba(40,26,16,.42)';
      for (let y = 170; y < p.height - 110; y += 36) { const w = 520 + r() * 100 * (y % 7 ? 1 : 0); if (r() < 0.08) continue; g.fillRect(110, y, Math.min(w, p.width - 220), 5); }
      const sh = g.createLinearGradient(0, 0, 120, 0); sh.addColorStop(0, 'rgba(40,26,12,.35)'); sh.addColorStop(1, 'rgba(40,26,12,0)'); g.fillStyle = sh; g.fillRect(0, 0, 120, p.height);
    }
    return p; }; })();
  const sceneCanvas = mk(), scx = sceneCanvas.getContext('2d');
  const plateTmp = mk(720, 405), pt = plateTmp.getContext('2d');
  const plateGrain = (() => { const r = rng(4), a = new Float32Array(720 * 405); for (let i = 0; i < a.length; i++) { const x = i % 720, y = (i / 720) | 0; a[i] = 0.7 * r() + 0.3 * ((x + y * 0.6) / 1000); } return a; })();
  function book(c, t, o) {
    // camera: s scales the world about (cx, cy) placed at screen centre
    const cam = o.cam || { s: 1, cx: CX, cy: CY };
    L.paper(c, 'dark'); c.fillStyle = 'rgba(12,8,5,.75)'; c.fillRect(0, 0, W, H);
    c.save(); c.translate(CX, CY); c.scale(cam.s, cam.s); c.translate(-cam.cx, -cam.cy);
    const open = o.open ?? 1;                        // 0 closed .. 1 open
    if (open > 0) {
      c.drawImage(bookBase, 0, 0);
      if (o.endpaper && open >= 1) leaf(c, -1, cover, endpaper());
      // right page: title page, or the plate
      if (o.titlePage && (o.titleAlpha ?? 1) > 0) {
        c.globalAlpha = o.titleAlpha ?? 1;
        c.font = '400 40px "IM Fell English SC"'; c.letterSpacing = '8px'; c.textAlign = 'center'; c.fillStyle = 'rgba(45,28,18,.85)';
        c.fillText('The Saddest Empires', 1382, 470); c.letterSpacing = '0px';
        c.font = 'italic 400 28px "IM Fell English"'; c.fillText('a story, by Samuel Salzer', 1382, 530); c.textAlign = 'left';
        c.globalAlpha = 1;
      }
      if (o.plate) {
        const pa = o.plateAlpha ?? 1;
        c.strokeStyle = `rgba(40,24,14,${0.8 * pa})`; c.lineWidth = 1.6; c.strokeRect(PLATE.x - 14, PLATE.y - 14, PLATE.w + 28, PLATE.h + 28);
        c.lineWidth = 0.8; c.strokeRect(PLATE.x - 6, PLATE.y - 6, PLATE.w + 12, PLATE.h + 12);
        o.plate(scx, t);
        if (o.plateAppear !== undefined && o.plateAppear < 1) {
          // the plate engraves itself: grains of the picture arrive out of the paper
          pt.clearRect(0, 0, PLATE.w, PLATE.h); pt.drawImage(sceneCanvas, 0, 0, PLATE.w, PLATE.h);
          const img = pt.getImageData(0, 0, PLATE.w, PLATE.h), dd = img.data, ap = o.plateAppear * 1.18;
          for (let i = 0, j = 3; i < plateGrain.length; i++, j += 4) dd[j] = 255 * clamp((ap - plateGrain[i]) / 0.16);
          pt.putImageData(img, 0, 0);
          c.globalAlpha = pa; c.drawImage(plateTmp, PLATE.x, PLATE.y); c.globalAlpha = 1;
        } else { c.globalAlpha = pa; c.drawImage(sceneCanvas, PLATE.x, PLATE.y, PLATE.w, PLATE.h); c.globalAlpha = 1; }
        c.font = 'italic 400 24px "IM Fell English"'; c.textAlign = 'center'; c.fillStyle = `rgba(45,28,18,${0.7 * pa})`;
        c.fillText(o.plateCaption || '', PLATE.x + PLATE.w / 2, PLATE.y + PLATE.h + 56); c.textAlign = 'left';
      }
      if (o.leftPage) o.leftPage(c, t);
      if (o.turn !== undefined) leaf(c, 1 - 2 * o.turn, o.turnFront || paperLeaf(), paperLeaf());   // a page turning right to left
      if (o.riffle) o.riffle.forEach((u) => { if (u > 0 && u < 1) leaf(c, 1 - 2 * u, printedLeaf(), printedLeaf()); });
    }
    // the cover, closed on the right or swung open to the left
    if (open < 1) { if (open === 0) { c.fillStyle = '#281409'; c.fillRect(SPINE - 30, PAGE.top - 16, 30, PAGE.bottom - PAGE.top + 34); } leaf(c, 1 - 2 * open, cover, endpaper()); }
    if (open === 0 && o.sheen > 0 && o.sheen < 1) {             // the candle finds the gilt
      c.save(); c.beginPath(); c.rect(SPINE, PAGE.top - 16, PAGE.rx - SPINE + 22, PAGE.bottom - PAGE.top + 34); c.clip();
      c.globalCompositeOperation = 'screen';
      const bx = lerp(SPINE - 300, PAGE.rx + 300, ease(o.sheen));
      const sg2 = c.createLinearGradient(bx - 220, 0, bx + 220, 300);
      sg2.addColorStop(0, 'rgba(255,220,140,0)'); sg2.addColorStop(0.5, 'rgba(255,220,140,.32)'); sg2.addColorStop(1, 'rgba(255,220,140,0)');
      c.fillStyle = sg2; c.fillRect(SPINE, 0, PAGE.rx, H); c.restore();
    }
    if (o.glow > 0) {                                            // light spills from between the pages
      c.save(); c.globalCompositeOperation = 'screen';
      const gg = c.createRadialGradient(SPINE, 520, 0, SPINE, 520, 900);
      gg.addColorStop(0, `rgba(255,214,140,${0.75 * o.glow})`); gg.addColorStop(0.35, `rgba(255,180,90,${0.28 * o.glow})`); gg.addColorStop(1, 'rgba(255,160,60,0)');
      c.fillStyle = gg; c.fillRect(SPINE - 1000, -400, 2000, 1900);
      for (let r = 0; r < 14; r++) {
        const a = -PI / 2 + (r - 6.5) * 0.19 + Math.sin(t * 0.7 + r) * 0.02, len = 1100;
        c.fillStyle = `rgba(255,220,150,${0.07 * o.glow})`;
        c.beginPath(); c.moveTo(SPINE, 560); c.lineTo(SPINE + Math.cos(a - 0.03) * len, 560 + Math.sin(a - 0.03) * len); c.lineTo(SPINE + Math.cos(a + 0.03) * len, 560 + Math.sin(a + 0.03) * len); c.closePath(); c.fill();
      }
      c.restore();
    }
    let flame = null;
    if (o.candle) { const C = o.candle; flame = [CX + (C.x - cam.cx) * cam.s, CY + (C.y - C.h * 1.08 - cam.cy) * cam.s]; }
    c.restore();
    if (o.light) {
      // a single candle is the only light: it reveals the desk as it catches
      c.save(); c.globalCompositeOperation = 'multiply';
      const fl = 1 + 0.02 * Math.sin(t * 7) + 0.012 * Math.sin(t * 13), R = lerp(40, 1650, o.light.r) * fl;
      const g = c.createRadialGradient(flame[0], flame[1], 10, flame[0], flame[1], R);
      g.addColorStop(0, 'rgb(255,242,218)'); g.addColorStop(0.5, 'rgb(214,172,126)'); g.addColorStop(0.85, 'rgb(70,46,28)'); g.addColorStop(1, 'rgb(0,0,0)');
      c.globalAlpha = o.lightFade ?? 1; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
      if (o.candle.lit > 0) {
        c.save(); c.translate(CX + (o.candle.x - cam.cx) * cam.s, CY + (o.candle.y - cam.cy) * cam.s); c.scale(cam.s, cam.s);
        candle(c, 0, 0, o.candle.h, t, o.candle.lit); c.restore();
        if (o.candle.spark > 0) {                                // the match
          c.save(); c.globalCompositeOperation = 'screen';
          const sp = c.createRadialGradient(flame[0], flame[1], 0, flame[0], flame[1], 160);
          sp.addColorStop(0, `rgba(255,236,190,${o.candle.spark})`); sp.addColorStop(1, 'rgba(255,200,120,0)');
          c.fillStyle = sp; c.fillRect(0, 0, W, H); c.restore();
        }
      }
      return;
    }
    // candlelight on the desk
    c.save(); c.globalCompositeOperation = 'multiply';
    const fl = 1 + 0.015 * Math.sin(t * 7) + 0.01 * Math.sin(t * 13);
    const g = c.createRadialGradient(W * 0.4, H * 0.42, 150 * fl, W * 0.5, H * 0.5, 1250 * fl);
    g.addColorStop(0, 'rgb(255,240,214)'); g.addColorStop(0.6, 'rgb(190,150,110)'); g.addColorStop(1, 'rgb(40,26,16)');
    c.globalAlpha = o.lightAmount ?? 1; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  }
  /* ------------------------------------------------------------ a real book: leaves that lift in perspective */
  const LEAF_W = PAGE.rx - SPINE, LEAF_H = PAGE.bottom - PAGE.top;
  // theta: 0 lying on the right, PI lying on the left. Paper leaves curl as they turn; the cover stays stiff.
  function leaf3d(c, theta, front, back, o = {}) {
    const N = 120, D = 2600, curl = o.curl || 0, w = o.w || LEAF_W, y0 = o.y0 ?? PAGE.top, h = o.h || LEAF_H, cy = y0 + h / 2;
    let x = 0, z = 0; const pts = [[0, 0, theta]];
    for (let i = 1; i <= N; i++) {
      const u = (i - 0.5) / N, phi = theta + curl * Math.sin(PI * u) * Math.sin(theta) * (theta < PI / 2 ? -1 : 1) * 0;
      const bend = curl * Math.sin(theta) * u * u;                // the free edge lags behind, as paper does
      const a = theta - bend;
      x += Math.cos(a) * (w / N); z += Math.sin(a) * (w / N); pts.push([x, z, a]);
    }
    for (let i = 0; i < N; i++) {
      const [x0, z0, a0] = pts[i], [x1, z1] = pts[i + 1];
      const sc0 = D / (D - z0), sc1 = D / (D - z1), scm = (sc0 + sc1) / 2;
      const X0 = SPINE + x0 * sc0, X1 = SPINE + x1 * sc1;
      const faceFront = Math.cos(a0) > -1e-6 ? true : false;       // whichever side faces up
      const showFront = pts[i + 1][2] < PI / 2;
      const img = showFront ? front : back;
      if (!img) continue;
      const u0 = i / N, u1 = (i + 1) / N;
      const sx = showFront ? u0 * img.width : (1 - u1) * img.width, sw = Math.max(1, (u1 - u0) * img.width);
      const left = Math.min(X0, X1), wd = Math.abs(X1 - X0) + 0.8;
      const top = cy - (h / 2) * scm, hh = h * scm;
      c.drawImage(img, sx, 0, sw, img.height, left, top, wd, hh);
      const shade = 1 - Math.abs(Math.cos(pts[i + 1][2]));
      if (shade > 0.02) { c.fillStyle = `rgba(30,18,8,${0.5 * shade})`; c.fillRect(left, top, wd, hh); }
      void faceFront;
    }
  }
  const titlePageImg = (() => { let p; return () => {
    if (!p) {
      p = mk(LEAF_W, LEAF_H); const g = p.getContext('2d');
      g.drawImage(PAPER.day, 300, 60, LEAF_W, LEAF_H, 0, 0, LEAF_W, LEAF_H);
      g.textAlign = 'center'; g.fillStyle = 'rgba(40,24,14,.9)';
      g.drawImage(L.GOLD_CROWN, LEAF_W / 2 - 60, 250, 120, 94);
      g.font = '400 46px "IM Fell English SC"'; g.letterSpacing = '9px'; g.fillText('The Saddest Empires', LEAF_W / 2, 430); g.letterSpacing = '0px';
      g.strokeStyle = 'rgba(40,24,14,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(LEAF_W / 2 - 120, 470); g.lineTo(LEAF_W / 2 + 120, 470); g.stroke();
      g.font = 'italic 400 30px "IM Fell English"'; g.fillText('a story in seven chapters', LEAF_W / 2, 520);
      g.font = '400 24px "IM Fell English SC"'; g.letterSpacing = '5px'; g.fillText('Samuel Salzer · mmxxvi', LEAF_W / 2, LEAF_H - 120);
      const sh = g.createLinearGradient(0, 0, 140, 0); sh.addColorStop(0, 'rgba(60,38,16,.4)'); sh.addColorStop(1, 'rgba(60,38,16,0)'); g.fillStyle = sh; g.fillRect(0, 0, 140, LEAF_H);
    }
    return p; }; })();
  const blankLeafImg = (() => { let p; return () => {
    if (!p) { p = mk(LEAF_W, LEAF_H); const g = p.getContext('2d'); g.drawImage(PAPER.day, 200, 20, LEAF_W, LEAF_H, 0, 0, LEAF_W, LEAF_H);
      const sh = g.createLinearGradient(LEAF_W, 0, LEAF_W - 140, 0); sh.addColorStop(0, 'rgba(60,38,16,.4)'); sh.addColorStop(1, 'rgba(60,38,16,0)'); g.fillStyle = sh; g.fillRect(0, 0, LEAF_W, LEAF_H); }
    return p; }; })();
  const marbledImg = (() => { let p; return () => {
    if (!p) {
      p = mk(LEAF_W + 22, LEAF_H + 34); const g = p.getContext('2d');
      g.fillStyle = '#4a1f18'; g.fillRect(0, 0, p.width, p.height);
      const r = rng(12);
      for (let k = 0; k < 260; k++) {                             // marbled endpaper: combed swirls of gold and cream
        const y0 = r() * p.height, amp = 10 + r() * 30, fr = 0.004 + r() * 0.01, col = r() < 0.5 ? 'rgba(196,150,70,.35)' : 'rgba(232,214,180,.18)';
        g.strokeStyle = col; g.lineWidth = 0.8 + r() * 1.6; g.beginPath();
        for (let x = 0; x <= p.width; x += 6) { const y = y0 + Math.sin(x * fr + k) * amp + Math.sin(x * 0.03 + k * 2) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      g.strokeStyle = 'rgba(200,160,80,.6)'; g.lineWidth = 2; g.strokeRect(20, 20, p.width - 40, p.height - 40);
    }
    return p; }; })();
  const LM = mk(W / 2, H / 2), lm = LM.getContext('2d');
  const MOTES = (() => { const r = rng(33), a = []; for (let i = 0; i < 220; i++) a.push({ x: PAGE.lx + 60 + r() * (PAGE.rx - PAGE.lx - 120), y: PAGE.top + 80 + r() * (LEAF_H - 160), born: r(), life: 2.6 + r() * 2.4, rise: 160 + r() * 260, sway: r() * TAU, size: 1.2 + r() * 2.4 }); return a; })();
  // the prologue's book: desk, candle, cover, title leaf, plate, light
  function bookScene(c, t, o) {
    const cam = o.cam;
    c.fillStyle = '#0d0906'; c.fillRect(0, 0, W, H);
    c.save(); c.translate(CX, CY); c.scale(cam.s, cam.s); c.translate(-cam.cx, -cam.cy);
    // the desk, and the book's shadow on it
    c.globalAlpha = 0.5; c.drawImage(PAPER.dark, -600, -300, W + 1200, H + 600); c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,.6)'; c.filter = 'blur(24px)';
    c.fillRect(o.coverTheta > PI / 2 ? PAGE.lx : SPINE, PAGE.top + 30, o.coverTheta > PI / 2 ? PAGE.rx - PAGE.lx : LEAF_W + 30, LEAF_H + 10); c.filter = 'none';
    // binding and page block
    c.fillStyle = '#3a1d12'; c.fillRect(SPINE - 12, PAGE.top - 16, (o.coverTheta > PI / 2 ? LEAF_W : 0) + 12 + LEAF_W + 22, LEAF_H + 34);
    if (o.coverTheta > PI / 2) c.fillRect(PAGE.lx - 22, PAGE.top - 16, SPINE - PAGE.lx + 22, LEAF_H + 34);
    for (let k = 5; k >= 1; k--) { c.fillStyle = k % 2 ? '#d9ccb4' : '#c9bb9f'; c.fillRect(SPINE, PAGE.top + k * 1.6, LEAF_W + k * 2.4, LEAF_H + k * 1.4); }
    // the right page under everything: the plate
    c.drawImage(bookBase, SPINE, 0, LEAF_W + 40, H, SPINE, 0, LEAF_W + 40, H);
    if (o.plate) {
      c.strokeStyle = 'rgba(40,24,14,.8)'; c.lineWidth = 1.6; c.strokeRect(PLATE.x - 14, PLATE.y - 14, PLATE.w + 28, PLATE.h + 28);
      c.lineWidth = 0.8; c.strokeRect(PLATE.x - 6, PLATE.y - 6, PLATE.w + 12, PLATE.h + 12);
      o.plate(scx, t); c.drawImage(sceneCanvas, PLATE.x, PLATE.y, PLATE.w, PLATE.h);
      c.font = 'italic 400 24px "IM Fell English"'; c.textAlign = 'center'; c.fillStyle = 'rgba(45,28,18,.7)'; c.fillText(o.plateCaption || 'Plate I.', PLATE.x + PLATE.w / 2, PLATE.y + PLATE.h + 56); c.textAlign = 'left';
      c.font = '400 22px "IM Fell English SC"'; c.letterSpacing = '5px'; c.textAlign = 'center'; c.fillStyle = 'rgba(45,28,18,.7)';
      c.fillText('The Saddest Empires', 1382, 128); c.letterSpacing = '0px'; c.textAlign = 'left';
      if (o.plateGlow > 0) {                                   // first light falls across the plate
        c.save(); c.globalCompositeOperation = 'screen'; const g = c.createLinearGradient(PLATE.x, PLATE.y, PLATE.x + PLATE.w, PLATE.y + PLATE.h);
        g.addColorStop(0, `rgba(255,236,200,${0.25 * o.plateGlow})`); g.addColorStop(1, 'rgba(255,236,200,0)'); c.fillStyle = g; c.fillRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h); c.restore();
      }
    }
    const coverLeaf = () => leaf3d(c, o.coverTheta, cover, o.stackBack ? o.stackBack() : marbledImg(), { w: LEAF_W + 22, y0: PAGE.top - 16, h: LEAF_H + 34 });
    const titleLeaf = () => { if (o.leafFront !== false) leaf3d(c, o.turnTheta, o.leafFront ? o.leafFront() : titlePageImg(), blankLeafImg(), { curl: o.leafCurl ?? 0.55 }); };
    if (o.coverTheta < PI / 2) { titleLeaf(); coverLeaf(); } else { coverLeaf(); if (o.underLeft && o.coverTheta >= PI - 1e-6) o.underLeft(c, t); titleLeaf(); }
    // once the leaf lies on the left, it is a page you can write on
    if (o.turnTheta >= PI - 1e-6) {
      c.font = '400 22px "IM Fell English SC"'; c.letterSpacing = '5px'; c.textAlign = 'center'; c.fillStyle = 'rgba(45,28,18,.7)';
      c.fillText(o.head || 'I · The Throne', 534, 128); c.letterSpacing = '0px'; c.textAlign = 'left';
      if (o.leftPage) o.leftPage(c, t);
    }
    // gold dust rising from the open pages
    if (o.dust > 0) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const m of MOTES) {
        const q = ((t - o.dustAt) / m.life - m.born); if (q < 0 || q > 1) continue;
        const a = Math.sin(q * PI) * o.dust;
        c.fillStyle = `rgba(255,${200 + ((m.size * 20) | 0)},120,${0.55 * a})`;
        c.beginPath(); c.arc(m.x + Math.sin(t * 1.2 + m.sway) * 14, m.y - q * m.rise, m.size, 0, TAU); c.fill();
      }
      c.restore();
    }
    c.restore();
    // light: the candle, plus the glow of the open pages, multiplied over everything
    const toScreen = (x, y) => [CX + (x - cam.cx) * cam.s, CY + (y - cam.cy) * cam.s];
    const [fx, fy] = toScreen(o.candle.x, o.candle.y - o.candle.h * 1.08);
    lm.globalCompositeOperation = 'source-over'; lm.fillStyle = '#000'; lm.fillRect(0, 0, W / 2, H / 2);
    lm.globalCompositeOperation = 'lighter';
    const fl = 1 + 0.02 * Math.sin(t * 7) + 0.012 * Math.sin(t * 13), R = lerp(30, 2300 * cam.s, o.light) * fl;
    const g1 = lm.createRadialGradient(fx / 2, fy / 2, 4, fx / 2, fy / 2, R / 2);
    g1.addColorStop(0, 'rgb(255,226,186)'); g1.addColorStop(0.3, 'rgb(214,150,92)'); g1.addColorStop(0.7, 'rgb(96,52,24)'); g1.addColorStop(1, 'rgb(0,0,0)');
    lm.fillStyle = g1; lm.fillRect(0, 0, W / 2, H / 2);
    if (o.fill > 0) {
      const [bx, by] = toScreen(o.coverTheta > PI / 2 ? CX : 1382, 540);
      const g2 = lm.createRadialGradient(bx / 2, by / 2, 20, bx / 2, by / 2, 1200 * cam.s / 2);
      g2.addColorStop(0, `rgba(236,188,132,${0.5 * o.fill})`); g2.addColorStop(0.6, `rgba(150,92,46,${0.36 * o.fill})`); g2.addColorStop(1, 'rgba(0,0,0,0)');
      lm.fillStyle = g2; lm.fillRect(0, 0, W / 2, H / 2);
    }
    if (o.white > 0) { lm.globalCompositeOperation = 'source-over'; lm.fillStyle = `rgba(255,255,255,${o.white})`; lm.fillRect(0, 0, W / 2, H / 2); }
    c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(LM, 0, 0, W, H); c.restore();
    // the open pages glow a little, as if lit from within
    if (o.spill > 0) {
      c.save(); c.globalCompositeOperation = 'screen';
      const [bx, by] = toScreen(CX, 540);
      const gs = c.createRadialGradient(bx, by, 40, bx, by, 900 * cam.s);
      gs.addColorStop(0, `rgba(255,150,70,${0.14 * o.spill})`); gs.addColorStop(1, 'rgba(255,130,50,0)');
      c.fillStyle = gs; c.fillRect(0, 0, W, H); c.restore();
    }
    // the candle itself stays bright
    if (o.candle.lit > 0 || o.candle.always) {
      const [cx0, cy0] = toScreen(o.candle.x, o.candle.y);
      c.save(); c.translate(cx0, cy0); c.scale(cam.s, cam.s); candle(c, 0, 0, o.candle.h, t, o.candle.lit); c.restore();
      if (o.candle.spark > 0) {
        c.save(); c.globalCompositeOperation = 'screen';
        const sp = c.createRadialGradient(fx, fy, 0, fx, fy, 180); sp.addColorStop(0, `rgba(255,236,190,${o.candle.spark})`); sp.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = sp; c.fillRect(0, 0, W, H); c.restore();
      }
    }
    // the gilt title catches the light as it reaches the cover
    if (o.sheen > 0 && o.sheen < 1 && o.coverTheta === 0) {
      const [x0, y0] = toScreen(SPINE, PAGE.top - 16), [x1, y1] = toScreen(PAGE.rx + 22, PAGE.bottom + 18);
      c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); c.globalCompositeOperation = 'screen';
      const bx = lerp(x0 - 300, x1 + 300, ease(o.sheen)), sg2 = c.createLinearGradient(bx - 200, y0, bx + 200, y0 + 300);
      sg2.addColorStop(0, 'rgba(255,220,140,0)'); sg2.addColorStop(0.5, 'rgba(255,220,140,.3)'); sg2.addColorStop(1, 'rgba(255,220,140,0)');
      c.fillStyle = sg2; c.fillRect(x0, y0, x1 - x0, y1 - y0); c.restore();
    }
  }
  // the left-hand stack as seen from above: the cover's leather rim around the title page
  const titleStackImg = (() => { let p; return () => {
    if (!p) {
      p = mk(LEAF_W + 22, LEAF_H + 34); const g = p.getContext('2d');
      g.fillStyle = '#3b1f14'; g.fillRect(0, 0, p.width, p.height);
      for (let k = 4; k >= 1; k--) { g.fillStyle = k % 2 ? '#d9ccb4' : '#c9bb9f'; g.fillRect(22 - k * 2.2, 16 + k * 1.4, LEAF_W, LEAF_H); }
      g.drawImage(PAPER.day, 240, 60, LEAF_W, LEAF_H, 22, 16, LEAF_W, LEAF_H);
      const x0 = 22, cx = x0 + LEAF_W / 2;
      g.textAlign = 'center'; g.fillStyle = 'rgba(40,24,14,.9)';
      g.font = '400 22px "IM Fell English SC"'; g.letterSpacing = '6px'; g.fillText('On Sovereignty', cx, 250); g.letterSpacing = '0px';
      g.font = '400 60px "IM Fell English SC"'; g.letterSpacing = '8px'; g.fillText('The Saddest', cx, 380); g.fillText('Empires', cx, 456); g.letterSpacing = '0px';
      g.strokeStyle = 'rgba(40,24,14,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 130, 500); g.lineTo(cx + 130, 500); g.stroke();
      g.font = 'italic 400 28px "IM Fell English"'; g.fillText('a story in seven chapters', cx, 552);
      g.drawImage(L.GOLD_CROWN, cx - 34, 610, 68, 53);
      g.font = '400 22px "IM Fell English SC"'; g.letterSpacing = '5px'; g.fillText('Samuel Salzer', cx, LEAF_H - 150); g.fillText('mmxxvi', cx, LEAF_H - 116); g.letterSpacing = '0px';
      const sh = g.createLinearGradient(p.width, 0, p.width - 150, 0); sh.addColorStop(0, 'rgba(60,38,16,.42)'); sh.addColorStop(1, 'rgba(60,38,16,0)'); g.fillStyle = sh; g.fillRect(x0, 16, LEAF_W, LEAF_H);
    }
    return p; }; })();
  // the inside of the cover: a page headed The Prophecy, its words written as we watch
  const prophecyStackImg = (() => { let p; return () => {
    if (!p) {
      p = mk(LEAF_W + 22, LEAF_H + 34); const g = p.getContext('2d');
      g.fillStyle = '#3b1f14'; g.fillRect(0, 0, p.width, p.height);
      for (let k = 4; k >= 1; k--) { g.fillStyle = k % 2 ? '#d9ccb4' : '#c9bb9f'; g.fillRect(22 - k * 2.2, 16 + k * 1.4, LEAF_W, LEAF_H); }
      g.drawImage(PAPER.day, 240, 60, LEAF_W, LEAF_H, 22, 16, LEAF_W, LEAF_H);
      const cx = 22 + LEAF_W / 2; g.textAlign = 'center'; g.fillStyle = 'rgba(40,24,14,.85)';
      g.font = '400 24px "IM Fell English SC"'; g.letterSpacing = '8px'; g.fillText('The Prophecy', cx, 200); g.letterSpacing = '0px';
      g.strokeStyle = 'rgba(40,24,14,.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 90, 222); g.lineTo(cx + 90, 222); g.stroke();
      g.drawImage(L.GOLD_CROWN, cx - 30, LEAF_H - 170, 60, 47);
      const sh = g.createLinearGradient(p.width, 0, p.width - 150, 0); sh.addColorStop(0, 'rgba(60,38,16,.42)'); sh.addColorStop(1, 'rgba(60,38,16,0)'); g.fillStyle = sh; g.fillRect(22, 16, LEAF_W, LEAF_H);
    }
    return p; }; })();
  // a right-hand page with a plate on it, composed so it can turn as a leaf
  const leafPage = mk(LEAF_W, LEAF_H), lpg = leafPage.getContext('2d');
  function platePage(drawPlate, t, caption) {
    lpg.drawImage(bookBase, SPINE, PAGE.top, LEAF_W, LEAF_H, 0, 0, LEAF_W, LEAF_H);
    const px = PLATE.x - SPINE, py = PLATE.y - PAGE.top;
    lpg.strokeStyle = 'rgba(40,24,14,.8)'; lpg.lineWidth = 1.6; lpg.strokeRect(px - 14, py - 14, PLATE.w + 28, PLATE.h + 28);
    lpg.lineWidth = 0.8; lpg.strokeRect(px - 6, py - 6, PLATE.w + 12, PLATE.h + 12);
    drawPlate(scx, t); lpg.drawImage(sceneCanvas, px, py, PLATE.w, PLATE.h);
    lpg.font = 'italic 400 24px "IM Fell English"'; lpg.textAlign = 'center'; lpg.fillStyle = 'rgba(45,28,18,.7)'; lpg.fillText(caption, px + PLATE.w / 2, py + PLATE.h + 56);
    lpg.font = '400 22px "IM Fell English SC"'; lpg.letterSpacing = '5px'; lpg.fillText('The Saddest Empires', 1382 - SPINE, 128 - PAGE.top); lpg.letterSpacing = '0px'; lpg.textAlign = 'left';
    return leafPage;
  }
  const camInto = (k) => ({ s: lerp(1, W / PLATE.w, k), cx: lerp(CX, PLATE.x + PLATE.w / 2, k), cy: lerp(CY, PLATE.y + PLATE.h / 2, k) });

  /* ============================================================ the story */
  const SC = [], MARKS = [], PASS = [];
  const mark = (name, t, extra = {}) => MARKS.push(Object.assign({ scene: SC.length, name, t }, extra));
  const add = (o) => { SC.push(o); (o.passages || []).forEach((P) => PASS.push({ scene: SC.length - 1, P })); };

  const charAt = (P, word) => { const plain = P.chars.map((c2) => c2.ch).join(''); const i = plain.indexOf(word); return i < 0 ? P.written : P.chars[i].at; };
  if (L.variant === 'opening' || L.variant === 'complete') {
    const veilOn = (c, t, P, col, amt = 0.8) => { const v = ease(seg(t, P.at - 0.9, P.at)) * (1 - ease(seg(t, P.out, P.gone))); if (v > 0) { c.fillStyle = `rgba(${col},${amt * v})`; c.fillRect(0, 0, W, H); } };
    const EX = 2.6, EN = 2.6, THRU = 1.1;          // a fly-through into, and out of, a scene; and how long the two overlap
    const MATCH = 3.2, HOLD = 0.8;                  // a matched cut: both scenes hold the shared shape while they cross
    // PROLOGUE: a match, a candle, a closed book. It opens on a prophecy, facing a crown on a column. The crown falls.
    {
      const p1 = passage({ mode: 'top', at: 3.0, night: true, size: 66, y: 64, cps: 13, text: '*This is the story of an empire.*' });
      const p2 = passage({ mode: 'top', at: p1.written + 0.9, night: true, size: 66, y: 64 + 66 * 1.34, cps: 13, text: '*The greatest the world has ever known.*' });
      p1.out = p2.out = p2.written + 1.6; p1.gone = p2.gone = p1.out + 0.9;
      const openAt = p2.gone - 0.2, openD = 2.6;
      const pr = passage({ mode: 'book', voice: 'quote', at: openAt + openD + 0.8, size: 44, cps: 15, y: 300, lh: 1.5,
        text: 'In the last age, every one of you / shall be given a kingdom, / and servants past counting, / and a crown. / And the crown shall be heavy, / and many shall let it fall.', hold: 99 });
      const fallAt = charAt(pr, 'fall') + 0.5, land = fallAt + 2.0;
      const turnAt = land + 2.6, turnD = 2.3;
      pr.out = 1e3; pr.gone = 1e3 + 1;
      const f1 = passage({ mode: 'bookCentre', at: turnAt + turnD + 0.8, size: 86, cps: 10, text: 'It begins with {you.}', hold: 2.0, sink: true });
      const into = f1.gone + 0.2, travel = 3.8, d = into + travel;
      mark('strike', 1.0); mark('title', p1.at); mark('open', openAt, { d: openD }); mark('prophecy', pr.at, { d: pr.written - pr.at }); mark('tip', fallAt); mark('land', land);
      mark('riffle', turnAt, { d: turnD }); mark('begins', f1.at); mark('zoom', into, { d: travel });
      PASS.push({ scene: SC.length, P: pr }); PASS.push({ scene: SC.length, P: f1 });
      add({ name: 'prologue', d, passages: [p1, p2], draw(c, t) {
        const crownPlate = (x) => WORLD.crown(x, t, { fallAt });
        const zoom = lerp(0.62, 1, ease(seg(t, openAt - 1.2, openAt + 2.6)));
        const cam0 = { s: zoom, cx: CX + 420 * (1 - ease(seg(t, openAt - 0.3, openAt + 2.4))), cy: CY - 60 * (1 - zoom) / 0.38 };
        const lean = ease(seg(t, fallAt - 1.6, fallAt - 0.2)) * (1 - ease(seg(t, land + 0.8, turnAt - 0.2)));   // lean in to watch the crown fall
        const k = ease(seg(t, into, into + travel));
        const cam = k > 0 ? camInto(k) : lean > 0 ? camInto(0.42 * lean) : cam0;
        const coverTheta = PI * ease(seg(t, openAt, openAt + openD));
        const turnTheta = PI * ease(seg(t, turnAt, turnAt + turnD)), turning = t >= turnAt;
        bookScene(c, t, { cam, coverTheta, stackBack: prophecyStackImg, turnTheta,
          leafFront: turning ? () => platePage(crownPlate, t, 'Frontispiece.') : false,
          plate: turning ? (x) => WORLD.throne(x, 0, {}) : crownPlate, plateCaption: turning ? 'Plate I.' : 'Frontispiece.',
          candle: { x: 1905, y: 1010, h: 330, lit: seg(t, 1.0, 1.4), spark: Math.max(0, 1 - Math.abs(t - 1.05) / 0.25) },
          light: ease(seg(t, 1.0, 4.6)), fill: ease(seg(t, openAt + 0.4, openAt + 2.6)), white: k,
          spill: Math.sin(seg(t, openAt + 0.3, turnAt + turnD + 1.5) * PI) * 0.7 * (1 - k),
          dust: (1 - seg(t, openAt + 5, openAt + 7)) * seg(t, openAt + 0.5, openAt + 1.5), dustAt: openAt + 0.4,
          sheen: seg(t, 4.4, 6.4),
          underLeft: (cc) => drawPassage(cc, pr, t),
          leftPage: (cc) => drawPassage(cc, f1, t) });
      } });
    }
    // I · THE THRONE — ends flying down the aisle into the great doorway, which is shaped like the phone it becomes
    {
      const q1 = passage({ mode: 'top', at: 1.0, size: 64, text: 'Imagine that you find yourself / sitting on a throne.', hold: 1.6 });
      const q2 = passage({ mode: 'top', at: q1.gone + 0.2, text: 'Your servants stand shoulder to shoulder, / as far as the eye can see.', hold: 1.6 });
      const q3 = passage({ mode: 'top', at: q2.gone + 0.2, text: 'They have read everything. They can build anything. / They do not tire, and they do not resent.', hold: 1.8 });
      const q4 = passage({ mode: 'top', at: q3.gone + 0.2, size: 64, text: 'They are waiting for your {instruction.}', hold: 3.6 });
      const bowAt = charAt(q4, 'instruction') + 0.5, d = q4.gone + 0.3 + MATCH;
      // where the doorway sits on screen at the end of the scene, and the zoom that makes it 1000px tall
      const dr = 1.045, dY = 470 + (470 + (900 * (3.2 - (DOOR.y0 + DOOR.h / 2))) / 60 - 470) * dr, dH = ((DOOR.h * 900) / 60) * dr;
      mark('throne', 0); mark('bow', bowAt); mark('fly', d - MATCH, { d: MATCH }); mark('cut', d - 0.5);
      add({ name: 'throne', d, passages: [q1, q2, q3, q4], exit: { x: 960, y: dY, z: 1000 / dH, d: MATCH, hold: HOLD, smooth: true }, xfd: 1.0,
        draw(c, t) { WORLD.throne(c, t, { bowAt, drift: d, door: 0.6 * ease(seg(t, d - MATCH, d)) }); scrim(c, 'top', ease(seg(t, 0, 0.9)) * (1 - seg(t, q4.out, q4.gone)), false); } });
    }
    // II · THE BED — out of the phone's screen; ends flying into the window, which is Marcus's window too
    {
      const b1 = passage({ mode: 'lower', at: MATCH + 0.2, night: true, size: 56, text: 'Of course, you are not in a palace.', hold: 1.3 });
      const b2 = passage({ mode: 'lower', at: b1.gone + 0.2, night: true, size: 56, text: 'You are in bed. / You have not brushed your teeth.', hold: 1.5 });
      const b3 = passage({ mode: 'lower', at: b2.gone + 0.2, night: true, size: 52, text: 'You speak a few sentences into the dark, and somewhere, in a place that is not a place, something begins to build for you.', hold: 2.6 });
      const b4 = passage({ mode: 'centre', at: b3.gone + 0.6, night: true, size: 86, cps: 12, text: 'You did not earn this. / You are not even dressed.', hold: 3.2 });
      const lettersAt = charAt(b3, 'dark'), buildAt = lettersAt + 2.2;
      mark('bed', 0); mark('dark', lettersAt); mark('earn', b4.at);
      const opening = L.variant === 'opening', d = b4.gone + 1.0 + (opening ? 2.2 : MATCH);
      add({ name: 'bed', d, passages: [b1, b2, b3, b4], enter: { x: PHONE.x, y: PHONE.y, z: 1000 / PHONE.h, d: MATCH, hold: HOLD, smooth: true }, xfd: 1.0,
        exit: opening ? null : { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h / 2, z: 2.0, d: MATCH, hold: HOLD, smooth: true },
        draw(c, t) {
          WORLD.bed(c, t, { lettersAt, buildAt });
          scrim(c, 'lower', 1 - seg(t, b3.out, b3.gone), true);
          veilOn(c, t, b4, '8,8,14', 0.8);
        } });
    }
    if (L.variant === 'complete') {
      // III · THE INHERITANCE — out of the same window, two thousand years earlier; into his scroll; out of the stone
      {
        const m1 = passage({ mode: 'side', at: MATCH + 0.4, night: true, size: 56, text: 'The closest thing to the life you’ve been given is the life of an {emperor.}', hold: 1.4 });
        const m2 = passage({ mode: 'side', at: m1.gone + 0.2, night: true, size: 56, text: 'Marcus Aurelius ruled a third of the world. / Every night he wrote himself the same question:', hold: 1.2 });
        mark('chapter', 0); mark('marcus', m1.at);
        add({ name: 'marcus', d: m2.gone + 0.2 + EX, passages: [m1, m2], enter: { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h / 2, z: 2.0, d: MATCH, hold: HOLD, smooth: true }, exit: { x: 1090, y: 744, z: 7, d: EX }, xfd: 1.0,
          draw(c, t) { WORLD.study(c, t); chapterMark(c, t - MATCH + 0.6, 'III · The Inheritance', true); } });
      }
      {
        mark('carve', EN + 0.6, { d: 3.2 });
        add({ name: 'tablet', d: EN + 6.6 + EX, passages: [], enter: { x: 960, y: 535, z: 2.6, d: EN }, exit: { x: 960, y: 535, z: 3.2, d: EX }, xfd: THRU,
          draw(c, t) { WORLD.tablet(c, t - EN + 0.8); } });
      }
      {
        const t1 = passage({ mode: 'lower', at: EN + 0.2, size: 52, text: 'He would recognise your morning: / more power than one mind can direct.', hold: 1.4 });
        const t2 = passage({ mode: 'lower', at: t1.gone + 0.2, size: 52, text: 'Eight tabs open. Eight wings of a palace, / abandoned half-built, {for no one.}', hold: 2.6 });
        const abandonAt = charAt(t2, 'abandoned');
        mark('tabs', EN - 1.0, { d: 4.4 }); mark('abandon', abandonAt);
        add({ name: 'tabs', d: t2.gone + 0.2 + EX, passages: [t1, t2], enter: { x: 960, y: 520, z: 2.4, d: EN }, exit: { x: 843, y: 640, z: 6, d: EX }, xfd: THRU,
          draw(c, t) { WORLD.tabs(c, t, { abandonAt, tabsAt: EN - 1.0 }); scrim(c, 'lower', 1 - seg(t, t2.out, t2.gone), false); } });
      }
      // IV · THE INVERSION — out of the post of the balance; into one servant on the scale; out of the first servant at your gate
      {
        const v1 = passage({ mode: 'top', at: EN + 0.4, size: 50, text: 'For all of history, the limit was {labour.} / You could not build the bridge, or write the symphony, or run the numbers.', hold: 1.6 });
        const v2 = passage({ mode: 'top', at: v1.gone + 0.2, size: 54, text: 'Now labour is endless, / and {attention} is the thing that runs out.', hold: 2.8 });
        const pourAt = v2.at, outAt = charAt(v2, 'attention') + 0.4;
        mark('chapter', 0); mark('pour', pourAt, { d: 4.5 }); mark('out', outAt, { d: 3.2 });
        add({ name: 'balance', d: v2.gone + 0.4 + EX, passages: [v1, v2], enter: { x: 960, y: 760, z: 6, d: EN }, exit: { x: BAL_FRONT.x, y: BAL_FRONT.y, z: 5, d: EX }, xfd: THRU,
          draw(c, t) { WORLD.balance(c, t, { pourAt, outAt }); scrim(c, 'top', 1 - seg(t, v2.out, v2.gone), false); chapterMark(c, t - EN + 0.6, 'IV · The Inversion', false, 1046); } });
      }
      {
        const l0 = passage({ mode: 'top', at: EN - 0.4, size: 58, text: 'And every one of them is waiting / at the gate of your palace.', hold: 1.6 });
        const l1 = passage({ mode: 'top', at: l0.gone + 0.2, text: 'The line runs past the castle walls / and over the horizon,', hold: 1.4 });
        const l2 = passage({ mode: 'top', at: l1.gone + 0.2, size: 58, text: 'waiting for instructions / you do not have {time to give.}', hold: 2.4 });
        const l3 = passage({ mode: 'centre', at: l2.gone + 0.9, size: 84, cps: 12, text: 'The limit is no longer what can be done. / The limit is {you.}', hold: 3.4 });
        const d = l3.gone + 0.6, pull = l0.out - 0.4;
        mark('line', pull, { d: l2.gone - pull }); mark('limit', l3.at);
        add({ name: 'line', d, passages: [l0, l1, l2, l3], enter: { x: LINE_FIRST.x, y: LINE_FIRST.y, z: 4, d: EN }, xfd: THRU,
          draw(c, t) { WORLD.line(c, Math.max(0, t - pull), { d: l2.gone - pull + 1.5 }); scrim(c, 'top', 1 - seg(t, l2.out, l2.gone), false); veilOn(c, t, l3, '246,240,229', 0.9); } });
      }
      // V · THE GAP — the portrait that is almost you; then the same frame, holding a mirror
      const FRAME = { x: 1250, y: 470, z: 2.3 };
      const room = (c, t, o) => { L.paper(c, 'dusk'); c.save(); c.translate(1250, 470); c.scale(0.72, 0.72); c.translate(-960, -500); WORLD.mirror(c, t, { ...o, noPaper: true }); c.restore(); };
      {
        const g1 = passage({ mode: 'side', at: EN + 0.4, size: 52, w: 600, text: 'You ask your court painter for a portrait. / Not a likeness. *You.*', hold: 1.4 });
        const g2 = passage({ mode: 'side', at: g1.gone + 0.2, size: 52, w: 600, text: 'It comes back competent, correct, / and nothing like you.', hold: 1.6 });
        const g3 = passage({ mode: 'side', at: g2.gone + 0.2, size: 50, w: 600, text: 'You send it back. It returns closer: ninety percent right, which is worse than fifty, because now you can see {the shape of the gap.}', hold: 2.4 });
        const g4 = passage({ mode: 'side', at: g3.gone + 0.2, size: 52, w: 600, text: 'So you blame the painter. / They do not listen. / They do not *understand* you.', hold: 1.8 });
        const g5 = passage({ mode: 'side', at: g4.gone + 0.3, size: 48, w: 600, text: 'But maybe the gap is not in them. / It is in the instruction you never gave, / the taste you never formed, / the craft you never learned.', hold: 3.0 });
        const v1At = charAt(g1, 'You.') - 0.6, swapAt = charAt(g3, 'send') + 0.8, gapAt = charAt(g3, 'shape'), shakeAt = charAt(g4, 'blame');
        mark('chapter', 0); mark('portrait', v1At); mark('swap', swapAt); mark('gap', gapAt); mark('blame', shakeAt); mark('maybe', g5.at);
        add({ name: 'portrait', d: g5.gone + 0.2 + MATCH, passages: [g1, g2, g3, g4, g5], enter: { x: FRAME.x, y: FRAME.y + 120, z: 3, d: EN },
          exit: { x: FRAME.x, y: FRAME.y, z: FRAME.z, d: MATCH, hold: HOLD, smooth: true }, xfd: 1.0,
          draw(c, t) { room(c, t, { portrait: { v1At, swapAt, gapAt, shakeAt } }); scrim(c, 'side', 0.5 * (1 - seg(t, g5.out, g5.gone)), false); chapterMark(c, t - EN + 0.6, 'V · The Gap', false); } });
      }
      {
        const r1 = passage({ mode: 'side', at: MATCH + 0.2, size: 54, w: 600, text: 'So they hold up a mirror instead. / It is accurate. / The reflection is bland / because the face is bland.', hold: 2.2 });
        const r2 = passage({ mode: 'centre', at: r1.gone + 0.8, night: true, size: 86, cps: 12, text: 'The failure is not the servant. / It is {the king.}', hold: 3.2 });
        const faceAt = charAt(r1, 'bland') - 0.6, d = r2.gone + 0.8;
        mark('mirror', MATCH); mark('king', r2.at);
        add({ name: 'mirror', d, passages: [r1, r2], enter: { x: FRAME.x, y: FRAME.y, z: FRAME.z, d: MATCH, hold: HOLD, smooth: true }, xfd: 1.0,
          draw(c, t) { room(c, t, { d, faceAt, still: true }); scrim(c, 'side', 0.5 * (1 - seg(t, r1.out, r1.gone)), false); veilOn(c, t, r2, '12,10,14', 0.86); } });
      }
      // VI · THE PLEDGE — the throne hall at night; the court kneels; you have no cause. Then the ruins.
      {
        const n1 = passage({ mode: 'top', at: 1.6, night: true, size: 56, text: 'And still your servants kneel, / and pledge their undying loyalty and eternal labour / to your cause.', hold: 2.0 });
        const n2 = passage({ mode: 'centre', at: n1.gone + 0.8, night: true, size: 104, cps: 9, text: 'But you have {no cause.}', hold: 3.6 });
        const kneel = charAt(n1, 'kneel'), dark = [n2.written + 0.6, n2.written + 3.2];
        mark('chapter', 0); mark('kneel', kneel); mark('silence', n2.written + 0.2, { d: 4.2 });
        const d = n2.gone + 1.0 + EX;
        add({ name: 'pledge', d, passages: [n1, n2], exit: { x: 960, y: 440, z: 4, d: EX }, xfd: THRU,
          draw(c, t) {
            WORLD.throne(c, t, { kneel, night: 1, moon: 1 - 0.8 * ease(seg(t, dark[0], dark[1])), glow: 0.3 });
            scrim(c, 'top', 1 - seg(t, n1.out, n1.gone), true); veilOn(c, t, n2, '8,8,14', 0.7);
            chapterMark(c, t, 'VI · The Pledge', true, 1046);
          } });
      }
      {
        const e0 = passage({ mode: 'top', at: EN + 0.4, night: true, size: 52, text: 'You have the most numerous, most talented subjects / of any sovereign in history.', hold: 1.6 });
        const e1 = passage({ mode: 'top', at: e0.gone + 0.2, night: true, size: 52, text: 'And yet your workforce is idle. / And when it is not, all you do is remodel the castle walls.', hold: 2.2 });
        const e2 = passage({ mode: 'centre', at: e1.gone + 0.8, night: true, size: 76, cps: 12, text: 'We live in an era with / the {saddest empires} / the world has ever known.', hold: 3.6 });
        const d = e2.gone + 0.6 + EX;
        mark('ruins', 0, { d }); mark('saddest', e2.at);
        add({ name: 'ruins', d, passages: [e0, e1, e2], enter: { x: 980, y: 500, z: 3, d: EN }, exit: { x: 960, y: 560, z: 1.6, d: EX }, xfd: THRU,
          draw(c, t) { WORLD.ruins(c, t, { d }); scrim(c, 'top', 1 - seg(t, e1.out, e1.gone), true); veilOn(c, t, e2, '8,8,14', 0.5); } });
      }
      // VII · THE TEST — you delegate, lose resolution, hit every wall; the walls turn out to be the lessons; a door opens onto first light
      {
        const s1 = passage({ mode: 'top', at: EN + 0.4, size: 52, text: 'So you try. You delegate, and delegate again. / At every level you gain leverage and lose resolution.', hold: 1.8 });
        const s2 = passage({ mode: 'top', at: s1.gone + 0.2, size: 52, text: 'You hit the walls: of context, of tools, of structure, of time, / and of your own clarity.', hold: 2.0 });
        const s3 = passage({ mode: 'top', at: s2.gone + 0.2, size: 52, text: 'Until managing the managers / costs more than doing the work yourself.', hold: 1.8 });
        const s4 = passage({ mode: 'centre', at: s3.gone + 0.8, size: 80, cps: 12, text: 'Good. / If you never hit these limits, / you never know where the {true limit} is.', hold: 2.8 });
        const wallAt = s4.gone + 0.2, openAt = wallAt + 3.4;
        const s5 = passage({ mode: 'top', at: wallAt + 1.6, size: 64, cps: 12, text: 'The bottleneck is the {curriculum.} / The overwhelm is the {syllabus.}', hold: 3.2 });
        const levelsAt = EN - 0.6, wallsAt = charAt(s2, 'walls'), goldAt = s4.at + 0.6;
        const d = s5.gone + 0.4 + MATCH;
        mark('chapter', 0); mark('levels', levelsAt, { d: 6 }); mark('walls', wallsAt, { d: 4.5 }); mark('good', s4.at); mark('curriculum', s5.at); mark('door', openAt, { d: 3 });
        add({ name: 'test', d, passages: [s1, s2, s3, s4, s5], enter: { x: 960, y: 560, z: 1.6, d: EN }, exit: { x: 960, y: 725, z: 1.9, d: MATCH, hold: HOLD, smooth: true }, xfd: 1.0,
          draw(c, t) {
            WORLD.test(c, t, { levelsAt, wallsAt, goldAt, wallAt, openAt });
            scrim(c, 'top', (1 - seg(t, s3.out, s3.gone)) + seg(t, s5.at - 1, s5.at) * (1 - seg(t, s5.out, s5.gone)), false);
            veilOn(c, t, s4, '246,240,229', 0.86); chapterMark(c, t - EN + 0.6, 'VII · The Test', false, 1046);
          } });
      }
      // VIII · THE CROWN — through the door into the hall at first light; up the aisle; everything falls away but the crown
      let crownFinal;
      {
        const Z0 = 6.5, Z1 = 16.2;
        const winY = 452 + (1000 * (1.9 - 9.15)) / (31 - Z0), winH = (9.5 * 1000) / (31 - Z0);
        const c1 = passage({ mode: 'lower', at: MATCH + 0.6, size: 58, text: 'The crown is on the floor.', hold: 1.4 });
        const c2 = passage({ mode: 'lower', at: c1.gone + 0.2, size: 58, text: 'It is heavy. / It was always going to be heavy.', hold: 2.2 });
        const c3 = passage({ mode: 'lower', at: c2.gone + 0.4, size: 52, text: 'You are not failing to rule. You are learning to, in real time, / because no one in history has ever had to before.', hold: 2.4 });
        const walkA = c1.at, walkB = c3.gone + 0.6, focusAt = c3.out;
        const pk = passage({ mode: 'centre', at: walkB + 1.4, size: 120, cps: 7, y: 965, text: '{Pick it up.}', hold: 3.6, sink: true });
        const d = pk.gone + 0.8;
        crownFinal = (x, t) => WORLD.hallEnd(x, t, { camZ: Z1, focus: 1 });
        mark('chapter', 0); mark('dawn', 0, { d: MATCH + 2 }); mark('walk', walkA, { d: walkB - walkA }); mark('focus', focusAt, { d: 3 }); mark('pick', pk.at);
        add({ name: 'crown', d, passages: [c1, c2, c3, pk], enter: { x: 960, y: winY, z: 1083 / winH, d: MATCH, hold: HOLD, smooth: true }, xfd: 1.0,
          draw(c, t) {
            const camZ = lerp(Z0, Z1, ease(seg(t, walkA, walkB))), focus = ease(seg(t, focusAt, focusAt + 3));
            WORLD.hallEnd(c, t, { camZ, focus, gleamAt: pk.written });
            scrim(c, 'lower', 1 - seg(t, c3.out, c3.gone), false); chapterMark(c, t - MATCH + 0.6, 'VIII · The Crown', false);
          } });
      }
      // EPILOGUE — back out of the plate into the book; the rest of the book is blank; it closes; the candle goes out
      {
        const pullD = 4.4;
        const te = passage({ mode: 'bookCentre', at: pullD + 0.8, size: 40, cps: 12, y: 560, voice: 'quote', text: 'The rest of this book is blank.', hold: 2.6, sink: true });
        const closeAt = te.gone + 0.4, closeD = 2.8, sheenAt = closeAt + closeD + 0.2, outAt = sheenAt + 2.6, d = outAt + 3.6;
        mark('open', 0, { d: pullD }); mark('blank', te.at); mark('close', closeAt + closeD - 0.15); mark('snuff', outAt);
        PASS.push({ scene: SC.length, P: te });
        add({ name: 'epilogue', d, passages: [], hard: true,
          draw(c, t) {
            const k = 1 - ease(seg(t, 0, pullD));
            const z = ease(seg(t, closeAt - 0.6, closeAt + closeD + 0.6));
            const cam = k > 0 ? camInto(k) : { s: lerp(1, 0.62, z), cx: CX + 420 * z, cy: CY - 60 * z };
            const theta = PI * (1 - ease(seg(t, closeAt, closeAt + closeD)));            // the left half of the book swings shut, all at once
            const lit = 1 - seg(t, outAt, outAt + 0.35);
            bookScene(c, t, { cam, coverTheta: theta, stackBack: prophecyStackImg, turnTheta: theta, leafCurl: 0, head: 'VIII · The Crown', plateCaption: 'Plate VIII.',
              plate: (x) => crownFinal(x, t), candle: { x: 1905, y: 1010, h: 330, lit, spark: 0, always: true },
              light: lerp(1, 0.08, ease(seg(t, outAt, outAt + 1.6))), fill: (1 - ease(seg(t, closeAt - 0.4, closeAt + closeD))) * (1 - k), white: k,
              spill: 0.4 * (1 - k) * (1 - seg(t, closeAt, closeAt + 1)), dust: 0,
              sheen: theta === 0 ? seg(t, sheenAt, sheenAt + 2.2) : 0,
              leftPage: (cc) => drawPassage(cc, te, t) });
            const sm = seg(t, outAt, outAt + 3.2);                 // smoke from the snuffed wick
            if (sm > 0 && sm < 1) {
              const fx = CX + (1905 - cam.cx) * cam.s, fy = CY + (1010 - 330 * 1.02 - cam.cy) * cam.s;
              c.save(); c.strokeStyle = `rgba(200,190,176,${0.35 * Math.sin(sm * PI)})`; c.lineWidth = 2 * cam.s; c.beginPath();
              for (let i = 0; i <= 40; i++) { const u = i / 40, y = fy - u * 260 * cam.s * (0.4 + sm), x = fx + Math.sin(u * 7 + t * 2) * 14 * u * cam.s; i ? c.lineTo(x, y) : c.moveTo(x, y); }
              c.stroke(); c.restore();
            }
          } });
      }
    }
  } else {
  // PROLOGUE: the closed book
  {
    const p0 = passage({ mode: 'top', at: 1.6, size: 60, text: '*I want to tell you a story* / *about the saddest empires.*', hold: 2.2, night: true, y: 70 });
    const openAt = p0.gone + 0.2, turnAt = openAt + 3.6;
    mark('title', p0.at + 1.2); mark('open', openAt); mark('card', turnAt);
    const d = turnAt + 2.2;
    add({ name: 'prologue', d, passages: [p0], draw(c, t) {
      const zoom = lerp(0.62, 1, ease(seg(t, openAt - 1.5, openAt + 2.4)));
      const cam = { s: zoom, cx: CX + 420 * (1 - ease(seg(t, openAt - 0.5, openAt + 2.2))), cy: CY - 60 * (1 - zoom) / 0.38 };
      const open = ease(seg(t, openAt, openAt + 2.4));
      const turning = t > turnAt;
      book(c, t, { cam, open, endpaper: true, titlePage: !turning, lightAmount: 1,
        plate: turning ? (x) => WORLD.morning(x, 0, { letters: false }) : null, plateCaption: 'Plate I.',
        turn: turning ? ease(seg(t, turnAt, turnAt + 1.6)) : undefined });
    } });
  }
  // THE FIRST PAGE, then into the plate
  let travelD;
  {
    const f1 = passage({ mode: 'book', at: 0.9, initial: 54 * 1.34 * 3 - 12, cps: 15, text: '[here is] a particular kind of morning that belongs to {2026} and no other year in the history of the species.', hold: 2.4, sink: true });
    const into = f1.gone + 0.4; travelD = 3.6;
    mark('zoom', into, { d: travelD });
    const d = into + travelD;
    PASS.push({ scene: SC.length, P: f1 });
    add({ name: 'firstpage', d, passages: [], draw(c, t) {
      const k = ease(seg(t, into, into + travelD));
      book(c, t, { cam: camInto(k), plate: (x) => WORLD.morning(x, t, { letters: false }), plateCaption: 'Plate I.', plateAlpha: 1, lightAmount: 1 - k,
        leftPage: (cc) => {
          drawPassage(cc, f1, t);
          const I = f1.initial, a = ease(seg(t, f1.at - 0.6, f1.at + 0.6)) * (1 - seg(t, f1.out, f1.out + 1.5));
          if (a > 0) {
            const x = 214, y = 250 + 6, s2 = I;
            cc.save(); cc.globalAlpha = a; cc.strokeStyle = 'rgba(122,82,8,.9)'; cc.lineWidth = 1.4; cc.strokeRect(x, y, s2, s2); cc.lineWidth = 0.7; cc.strokeRect(x + 7, y + 7, s2 - 14, s2 - 14);
            cc.font = `700 ${Math.round(s2 * 0.78)}px "Cinzel Decorative"`; cc.textAlign = 'center';
            const gr = cc.createLinearGradient(x, y, x + s2, y + s2); gr.addColorStop(0, GOLD_A); gr.addColorStop(0.5, '#d2a041'); gr.addColorStop(1, GOLD_A);
            cc.fillStyle = gr; cc.fillText('T', x + s2 / 2, y + s2 * 0.8); cc.restore(); cc.textAlign = 'left';
          }
          // the chapter's running head
          cc.font = '400 22px "IM Fell English SC"'; cc.letterSpacing = '5px'; cc.textAlign = 'center'; cc.fillStyle = 'rgba(45,28,18,.7)';
          cc.fillText('I · The Morning', 534, 128); cc.fillText('The Saddest Empires', 1382, 128); cc.letterSpacing = '0px'; cc.textAlign = 'left';
        } });
    } });
  }
  // INSIDE: the morning
  {
    const m1 = passage({ mode: 'lower', at: 1.2, night: true, text: 'You speak a few sentences *into the dark* — and somewhere, in a place that is not a place, something that is not a person begins to build for you.', hold: 2.6 });
    const m2 = passage({ mode: 'centre', at: m1.gone + 0.6, night: true, size: 80, text: 'You did not earn this. / You are not dressed.', hold: 2.8, cps: 13 });
    const lettersAt = m1.at + 0.5, buildAt = m1.at + 4;
    add({ name: 'morning', d: m2.gone + 0.6, passages: [m1, m2], draw(c, t) {
      WORLD.morning(c, t, { lettersAt, buildAt });
      scrim(c, 'lower', 1 - seg(t, m1.out, m1.gone), true);
      // a centred statement gets an empty frame: the world dims behind it
      const veil = ease(seg(t, m2.at - 0.9, m2.at)) * (1 - ease(seg(t, m2.out, m2.gone)));
      if (veil > 0) { c.fillStyle = `rgba(8,8,14,${0.8 * veil})`; c.fillRect(0, 0, W, H); }
    } });
  }
  // the quotation
  {
    const q = passage({ mode: 'side', voice: 'quote', at: 1.2, size: 56, text: '“In an information-rich world, the wealth of information means a dearth of something else. Hence a wealth of information creates a {poverty of attention.}”', hold: 3.0 });
    const src = { at: q.written - 0.2 };
    mark('dim', q.written - 1.2);
    add({ name: 'simon', d: q.gone + 0.6, passages: [q], draw(c, t) {
      WORLD.simon(c, t, { dimAt: q.written - 1.4 });
      scrim(c, 'side', 1, false);
    }, after(c, t) {
      const a = ease(seg(t, src.at, src.at + 1.2)) * (1 - ease(seg(t, q.out, q.gone)));
      if (a > 0) { c.font = '400 28px "IM Fell English SC"'; c.letterSpacing = '4px'; c.fillStyle = `rgba(45,28,18,${0.8 * a})`; c.fillText('— Herbert Simon, 1971', q.x, q.top + q.blockH + 60); c.letterSpacing = '0px'; }
    } });
  }
  // the line
  {
    const l0 = passage({ mode: 'top', at: 1.0, text: 'He could not have imagined a world in which information is not merely present, but standing in a line', hold: 1.6 });
    const l1 = passage({ mode: 'top', at: l0.gone + 0.2, text: 'that stretches past the castle walls and over the horizon,', hold: 1.8 });
    const l2 = passage({ mode: 'top', at: l1.gone + 0.2, size: 60, text: 'waiting for instructions you do not have {time to give.}', hold: 3.0 });
    const d = l2.gone + 0.6;
    mark('line', 0, { d });
    add({ name: 'line', d, passages: [l0, l1, l2], draw(c, t) { WORLD.line(c, t, { d }); scrim(c, 'top', 1, false); } });
  }
  // the glass
  {
    const g1 = passage({ mode: 'side', at: 1.0, text: 'The first is the agony of not being known: a lifelong servant has brought you apple juice when you wanted orange —', hold: 1.6 });
    const g2 = passage({ mode: 'side', at: g1.gone + 0.3, text: 'is ninety percent of the way there, which is somehow worse than fifty, because it reveals {the shape of the gap.}', hold: 3.6 });
    const at = (P, word) => { const plain = P.chars.map((c2) => c2.ch).join(''); const i = plain.indexOf(word); return i < 0 ? P.at : P.chars[i].at; };
    const apple = [at(g1, 'apple'), at(g1, 'apple') + 2.2], drain = [g1.out, g1.gone + 0.4];
    const o50 = [at(g2, 'ninety') - 0.4, at(g2, 'ninety') + 1.0], o90 = [at(g2, 'there') - 0.4, at(g2, 'there') + 0.9];
    const gapAt = at(g2, 'shape');
    mark('pour', apple[0], { d: 2.2 }); mark('pour', o50[0], { d: 1.4 }); mark('pour', o90[0], { d: 1.3 }); mark('gap', gapAt);
    add({ name: 'glass', d: g2.gone + 0.6, passages: [g1, g2], draw(c, t) { WORLD.glass(c, t, { apple, drain, o50, o90, gapAt }); scrim(c, 'side', 1, false); } });
  }
  // the letter
  {
    const n0 = passage({ mode: 'centre', at: 1.0, night: true, size: 60, text: '*A friend sent this to me, late at night:*', hold: 1.4 });
    const h1 = passage({ mode: 'sheet', voice: 'hand', at: n0.gone + 0.2, cps: 13, text: 'Despite this, they pledge their undying loyalty and eternal labor to your cause.', hold: 1.8 });
    const h2 = passage({ mode: 'sheet', voice: 'hand', at: h1.gone + 0.4, cps: 9, size: 104, y: 480, text: 'But you have {no cause.}', hold: 4.6 });
    const lampOut = [h2.written + 0.8, h2.written + 3.4];
    mark('write', h1.at, { d: h1.written - h1.at }); mark('write', h2.at, { d: h2.written - h2.at }); mark('silence', h2.written + 0.2, { d: 4.4 });
    add({ name: 'letter', d: h2.gone + 1.0, passages: [n0, h1, h2], rot: -1.4, draw(c, t) { WORLD.letter(c, t, { lampOut, sheetAt: n0.gone - 0.6 }); } });
  }
  // the crown
  let crownD;
  {
    const k1 = passage({ mode: 'top', at: 5.2, size: 60, text: 'The crown is on the floor. It is heavy. / It was always going to be heavy.', hold: 3.0 });
    mark('land', 3.7);
    crownD = k1.gone + 0.8;
    add({ name: 'crown', d: crownD, passages: [k1], draw(c, t) { WORLD.crown(c, t, {}); scrim(c, 'top', 1 - seg(t, k1.out, k1.gone), false); } });
  }
  // EPILOGUE: back out into the book; "Pick it up."; the book closes
  {
    const back = 3.6;
    const pk = passage({ mode: 'bookCentre', at: back + 0.8, cps: 8, text: '{Pick it up.}', hold: 4.4 });
    const closeAt = pk.out + 0.8;
    mark('zoom', 0, { d: back }); mark('pick', pk.at); mark('close', closeAt);
    const d = closeAt + 5.5;
    PASS.push({ scene: SC.length, P: pk });
    add({ name: 'epilogue', d, passages: [], draw(c, t) {
      const k = 1 - ease(seg(t, 0, back));
      const open = 1 - ease(seg(t, closeAt, closeAt + 2.4));
      book(c, t, { cam: camInto(k), open, plate: (x) => WORLD.crown(x, crownD + t, { gleamAt: crownD + pk.written }), plateCaption: 'Plate V.', lightAmount: 1 - k,
        leftPage: (cc) => { drawPassage(cc, pk, t); } });
      // the title on the closed cover catches the light, then darkness
    } });
  }

  }

  /* ------------------------------------------------------------ timeline + render */
  const XF = 1.0;
  let acc = 0;
  SC.forEach((s, i) => {
    const hard = i === 0 || s.hard || (L.variant === 'story' && ['morning', 'firstpage', 'epilogue', 'throne', 'bed', 'marcus'].includes(s.name));
    s.xfd = s.xfd ?? XF; s.t0 = hard ? acc : acc - s.xfd; s.t1 = s.t0 + s.d; acc = s.t1; s.xf = !hard;
  });
  const DURATION = acc;
  const out = document.getElementById('film').getContext('2d');
  const bufA = mk(), bufB = mk();
  // a scene can open out of a point in the frame (enter) and fly into one (exit): the camera travels through one world into the next
  function through(c, t, s, draw) {
    let k = 0, F = null;
    if (s.enter && t < s.enter.d) { F = s.enter; const h = F.hold || 0, u = clamp((t - h) / (F.d - h)); k = F.smooth ? 1 - ease(u) : Math.pow(1 - u, 2.2); }
    else if (s.exit && t > s.d - s.exit.d) { F = s.exit; const h = F.hold || 0, u = clamp((t - (s.d - F.d)) / (F.d - h)); k = F.smooth ? ease(u) : Math.pow(u, 2.2); }
    if (!F || k <= 1e-4) { draw(); return; }
    const z = Math.pow(F.z, k);
    c.save(); c.translate(lerp(F.x, CX, k), lerp(F.y, CY, k)); c.scale(z, z); c.translate(-F.x, -F.y); draw(); c.restore();
  }
  function renderScene(c, s, t) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    through(c, t, s, () => s.draw(c, t));
    (s.passages || []).forEach((P) => {
      if (s.rot && P.mode === 'sheet') { c.save(); c.translate(960, 550); c.rotate(s.rot * PI / 180); c.translate(-960, -550); drawPassage(c, P, t); c.restore(); }
      else drawPassage(c, P, t);
    });
    if (s.after) s.after(c, t);
  }
  function render(T) {
    const active = SC.filter((s) => T >= s.t0 && T < s.t1 + 1e-6).slice(-2);
    out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
    out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
    active.forEach((s, k) => {
      const buf = k ? bufB : bufA, c = buf.getContext('2d');
      c.clearRect(0, 0, W, H);
      renderScene(c, s, T - s.t0);
      out.globalAlpha = k === 0 || !s.xf ? 1 : ease(seg(T, s.t0, s.t0 + s.xfd));
      out.drawImage(buf, 0, 0);
    });
    out.globalAlpha = 1;
    out.globalCompositeOperation = 'overlay'; out.globalAlpha = 0.06; out.drawImage(L.GRAIN[Math.floor(T * 24) % 4], 0, 0, W, H);
    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    const fade = Math.min(seg(T, 0, 1.4), 1 - seg(T, DURATION - 2.6, DURATION));
    if (fade < 1) { out.globalAlpha = 1 - fade; out.fillStyle = '#000'; out.fillRect(0, 0, W, H); out.globalAlpha = 1; }
  }
  buildBook();
  const cues = () => ({
    cut: L.variant, duration: DURATION,
    scenes: SC.map((s) => ({ name: s.name, t0: +s.t0.toFixed(3), d: s.d })),
    passages: PASS.map(({ scene, P }) => ({ t: +(SC[scene].t0 + P.at).toFixed(3), end: +(SC[scene].t0 + P.written).toFixed(3), voice: P.voice, gold: /\{/.test(P.text), scene })),
    marks: MARKS.map((m) => Object.assign({}, m, { t: +(SC[m.scene].t0 + m.t).toFixed(3) })),
  });
  return { render, duration: DURATION, cues };
};
