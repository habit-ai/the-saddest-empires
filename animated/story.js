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
  const { W, H, PI, TAU, clamp, lerp, seg, ease, easeOut, rng, mk, IMG, PAPER, Etch, hatch, ellipsePts, candle, stars } = L;
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
  WORLD.crown = (c, t, o) => {
    L.paper(c, 'first');
    c.save();
    const s = 0.8, ox = 1300 - 700 * s, oy = 250;
    c.translate(ox, oy); c.scale(s, s);
    c.strokeStyle = INK; for (let i = 0; i < 14; i++) { c.globalAlpha = 0.5 - i * 0.032; c.lineWidth = 1.3; const y = 1000 + Math.pow(i, 1.5) * 4.4; c.beginPath(); c.moveTo(-1400, y); c.lineTo(2400, y); c.stroke(); }
    c.globalAlpha = 1;
    c.drawImage(IMG.column, 340, 445, 720, 555);
    const tip = ease(seg(t, 1.6, 2.7)), fall = seg(t, 2.7, 3.7), settle = seg(t, 3.7, 4.5);
    let x = -22 * tip, y = -6 * tip, rot = -16 * tip;
    if (fall > 0) { x = lerp(-22, -420, easeOut(fall)); y = lerp(-6, 290, fall * fall); rot = lerp(-16, -94, easeOut(fall)); }
    if (settle > 0) { const b = Math.sin(settle * PI) * (1 - settle); x = -420 - 14 * easeOut(settle); y = 290 - 38 * b; rot = -94 + 4 * easeOut(settle) - 5 * b; }
    c.fillStyle = `rgba(58,34,24,${0.22 * seg(t, 3.5, 4.5)})`; c.beginPath(); c.ellipse(70, 1004, 210, 16, 0, 0, TAU); c.fill();
    c.save(); c.translate(440 + 250 + x, 93 + 392 + y); c.rotate(rot * PI / 180);
    c.globalAlpha = 0.78; c.drawImage(IMG.crown, -250, -392, 500, 392); c.globalAlpha = 1;
    c.drawImage(L.GOLD_CROWN, -250, -392, 500, 392);
    const gl = o.gleamAt ? seg(t, o.gleamAt - 0.3, o.gleamAt + 2.4) : 0;
    c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.4 + 0.2 * Math.sin(t * 1.3) + (gl > 0 && gl < 1 ? 0.6 * Math.sin(gl * PI) : 0);
    c.drawImage(L.GOLD_CROWN, -250, -392, 500, 392);
    c.restore(); c.restore();
  };

  const MIPS = [IMG.s1, IMG.s2, IMG.s3, IMG.s4, IMG.s5, IMG.s6].map((img) => [16, 32, 64, 128, 256, 480].map((h) => {
    const w = Math.max(1, Math.round((img.width / img.height) * h)), cv = mk(w, h), g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h); return cv;
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
  WORLD.throne = (c, t, o = {}) => {
    L.paper(c, 'day');
    const VX = 960, VY = 470, f = 900, camH = 3.2;
    const X = (x, z) => VX + (f * x) / z, Y = (y, z) => VY + (f * (camH - y)) / z;
    const dr = o.drift ? 1 + 0.045 * ease(clamp(t / o.drift)) : 1;
    c.save(); c.translate(VX, VY); c.scale(dr, dr); c.translate(-VX, -VY);
    // light through the great doors
    c.save(); c.globalCompositeOperation = 'screen';
    const gl = c.createRadialGradient(VX, VY - 30, 0, VX, VY - 30, 820);
    gl.addColorStop(0, 'rgba(255,226,170,.55)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H); c.restore();
    // floor
    c.strokeStyle = 'rgba(43,26,18,.26)'; c.lineWidth = 1;
    for (let x = -10.8; x <= 10.8; x += 1.2) { c.beginPath(); c.moveTo(X(x, 3), Y(0, 3)); c.lineTo(X(x, 60), Y(0, 60)); c.stroke(); }
    for (let z = 3; z < 60; z *= 1.1) { c.beginPath(); c.moveTo(X(-11, z), Y(0, z)); c.lineTo(X(11, z), Y(0, z)); c.stroke(); }
    c.strokeStyle = 'rgba(43,26,18,.45)'; c.beginPath(); c.moveTo(0, VY); c.lineTo(W, VY); c.stroke();
    // the carpet runs from the dais down the aisle to the doors
    const cz = (z) => [[X(-0.8, z), Y(0, z)], [X(0.8, z), Y(0, z)]];
    const [a0, b0] = cz(3.4), [a1, b1] = cz(60);
    c.save(); c.beginPath(); c.moveTo(a0[0], 930); c.lineTo(b0[0], 930); c.lineTo(b1[0], b1[1]); c.lineTo(a1[0], a1[1]); c.closePath(); c.clip();
    const cg = c.createLinearGradient(0, VY, 0, 930); cg.addColorStop(0, 'rgb(112,44,36)'); cg.addColorStop(1, 'rgb(132,40,32)');
    c.fillStyle = cg; c.fillRect(0, VY, W, 930 - VY);
    c.strokeStyle = 'rgba(40,10,8,.35)'; c.lineWidth = 1; for (let z = 3.4; z < 60; z *= 1.06) { c.beginPath(); c.moveTo(X(-2, z), Y(0, z)); c.lineTo(X(2, z), Y(0, z)); c.stroke(); }
    c.restore();
    c.strokeStyle = '#c99a3e'; c.lineWidth = 2; c.beginPath(); c.moveTo(a0[0] + 6, 930); c.lineTo(a1[0], a1[1]); c.moveTo(b0[0] - 6, 930); c.lineTo(b1[0], b1[1]); c.stroke();

    const crowd = (pred) => {
      for (const p2 of CROWD) {
        if (!pred(p2.z)) continue;
        const hp = (f * p2.h) / p2.z, x = X(p2.x, p2.z), yf = Y(0, p2.z);
        const haze = 1 - Math.min(0.65, p2.z / 380);
        if (hp < 3) { c.globalAlpha = haze * (hp < 1.2 ? 0.1 : 0.35); c.fillStyle = INK; c.fillRect(x, yf - hp, 1, Math.max(1, hp)); continue; }
        let bow = 0;
        if (o.bowAt !== undefined) {
          const u = t - o.bowAt - p2.k * 0.045;
          bow = u < 0 ? 0 : u < 0.7 ? ease(u / 0.7) : u < 2.4 ? 1 : 1 - ease(clamp((u - 2.4) / 1.0));
        }
        const img = spriteAt(p2.s, hp), w = (img.width / img.height) * hp;
        c.globalAlpha = haze;
        c.save(); c.translate(x, yf); c.rotate(bow * 0.42 * (p2.x < 0 ? 1 : -1)); c.scale(1, 1 - 0.16 * bow); if (p2.flip) c.scale(-1, 1);
        c.drawImage(img, -w / 2, -hp, w, hp); c.restore();
      }
      c.globalAlpha = 1;
    };
    crowd((z) => z > 60);
    // side walls and the back wall with its great doorway
    const wallFill = 'rgba(244,238,226,1)';
    for (const sgn of [-1, 1]) {
      const poly = [[X(sgn * 11, 5), Y(0, 5)], [X(sgn * 11, 60), Y(0, 60)], [X(sgn * 11, 60), Y(16, 60)], [X(sgn * 11, 5), Y(16, 5)]];
      c.fillStyle = wallFill; c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.fill();
      new Etch().addAll(hatch(poly, 90, 7, 0, 5), 0.6, 0.3).draw(c);
    }
    const back = (x0, x1, y0, y1) => { const poly = [[X(x0, 60), Y(y0, 60)], [X(x1, 60), Y(y0, 60)], [X(x1, 60), Y(y1, 60)], [X(x0, 60), Y(y1, 60)]]; c.fillStyle = wallFill; c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.fill(); new Etch().addAll(hatch(poly, 0, 3.2, 0, 7), 0.6, 0.35).draw(c); return poly; };
    back(-11, -5, 0, 16); back(5, 11, 0, 16); back(-5, 5, 10, 16);
    c.strokeStyle = 'rgba(43,26,18,.7)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(X(-5, 60), Y(0, 60)); c.lineTo(X(-5, 60), Y(10, 60)); c.lineTo(X(5, 60), Y(10, 60)); c.lineTo(X(5, 60), Y(0, 60)); c.stroke();
    crowd((z) => z <= 60);
    // columns, rising out of the frame
    for (const zc of [9, 12.5, 17, 23, 31, 42, 56]) for (const sgn of [-1, 1]) {
      const xc = sgn * 9.4, w = 0.55;
      const x0 = X(xc - w, zc), x1 = X(xc + w, zc), yb = Y(0, zc), yt = Y(16, zc);
      c.fillStyle = wallFill; c.fillRect(x0, yt, x1 - x0, yb - yt);
      c.strokeStyle = 'rgba(43,26,18,.8)'; c.lineWidth = 1.2; c.strokeRect(x0, yt, x1 - x0, yb - yt);
      c.strokeStyle = 'rgba(43,26,18,.35)'; c.lineWidth = 0.8;
      const n = Math.max(3, Math.round((x1 - x0) / 5));
      for (let q = 1; q < n; q++) { const xx = x0 + ((x1 - x0) * q) / n; if (sgn * (q / n - 0.5) > -0.1) { c.beginPath(); c.moveTo(xx, yt); c.lineTo(xx, yb); c.stroke(); } }
      c.fillStyle = 'rgba(43,26,18,.5)'; c.fillRect(x0 - (x1 - x0) * 0.15, yb - (x1 - x0) * 0.3, (x1 - x0) * 1.3, (x1 - x0) * 0.3);
    }
    c.restore();
    // warm the whole hall, and darken its edges
    c.save(); c.globalCompositeOperation = 'multiply';
    const vg = c.createRadialGradient(VX, VY, 250, VX, VY + 100, 1250);
    vg.addColorStop(0, 'rgb(255,246,228)'); vg.addColorStop(0.7, 'rgb(226,200,160)'); vg.addColorStop(1, 'rgb(120,88,58)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H); c.restore();
    // the edge of the dais you sit on: one polished band of dark stone, a gilt rule, the carpet running over it
    const dg = c.createLinearGradient(0, 960, 0, H);
    dg.addColorStop(0, 'rgb(74,52,36)'); dg.addColorStop(1, 'rgb(34,22,14)');
    c.fillStyle = dg; c.fillRect(0, 960, W, H - 960);
    c.fillStyle = 'rgba(255,230,180,.08)'; c.fillRect(0, 962, W, 6);
    const rim = c.createLinearGradient(0, 952, 0, 964); rim.addColorStop(0, '#f0cf82'); rim.addColorStop(1, '#8a5e10');
    c.fillStyle = rim; c.fillRect(0, 952, W, 10);
    const cw0 = X(0.8, 3.4) - VX;
    c.fillStyle = 'rgb(128,38,30)'; c.beginPath(); c.moveTo(VX - cw0, 952); c.lineTo(VX + cw0, 952); c.lineTo(VX + cw0 * 1.25, H); c.lineTo(VX - cw0 * 1.25, H); c.fill();
    c.strokeStyle = '#c99a3e'; c.lineWidth = 2; c.beginPath(); c.moveTo(VX - cw0 + 6, 952); c.lineTo(VX - cw0 * 1.25 + 6, H); c.moveTo(VX + cw0 - 6, 952); c.lineTo(VX + cw0 * 1.25 - 6, H); c.stroke();
  };
  WORLD.bed = (c, t, o = {}) => {
    // First person, like the throne: you look down the length of your own bed. The duvet is drawn the way an
    // engraver draws a landscape, in contour lines; the only light is the moon through the window and the phone.
    L.paper(c, 'dark');
    const moon = 'rgba(176,186,220,', px = 990, py = 700;
    // the wall and the window
    c.strokeStyle = moon + '.10)'; c.lineWidth = 1; c.beginPath();
    for (let x = 0; x < W; x += 9) { c.moveTo(x, 0); c.lineTo(x, 560); } c.stroke();
    const wx = 1290, wy = 90, ww = 330, wh = 380;
    c.save(); c.globalCompositeOperation = 'screen';
    const mg = c.createLinearGradient(wx, wy, wx + ww, wy + wh); mg.addColorStop(0, 'rgba(120,140,190,.55)'); mg.addColorStop(1, 'rgba(60,72,110,.35)');
    c.fillStyle = mg; c.fillRect(wx, wy, ww, wh);
    const mo = c.createRadialGradient(wx + 230, wy + 110, 0, wx + 230, wy + 110, 60); mo.addColorStop(0, 'rgba(240,244,255,.95)'); mo.addColorStop(0.5, 'rgba(200,210,240,.4)'); mo.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = mo; c.fillRect(wx, wy, ww, wh);
    const beam = c.createLinearGradient(wx, wy, 700, 1000); beam.addColorStop(0, 'rgba(150,165,210,.14)'); beam.addColorStop(1, 'rgba(150,165,210,0)');
    c.fillStyle = beam; c.beginPath(); c.moveTo(wx, wy + wh); c.lineTo(wx + ww, wy + wh); c.lineTo(1150, 1080); c.lineTo(250, 1080); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = moon + '.75)'; c.lineWidth = 3; c.strokeRect(wx, wy, ww, wh);
    c.lineWidth = 2; c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh / 2); c.lineTo(wx + ww, wy + wh / 2); c.stroke();
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
    const gl = c.createRadialGradient(px, py - 20, 0, px, py - 20, 620 * (1 + 0.02 * Math.sin(t * 2)));
    gl.addColorStop(0, 'rgba(180,198,240,.55)'); gl.addColorStop(0.3, 'rgba(90,110,160,.18)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H); c.restore();
    c.save(); c.translate(px, py); c.transform(1, 0, -0.18, 0.62, 0, 0);
    c.fillStyle = 'rgba(232,238,252,.97)'; c.fillRect(-46, -84, 92, 168);
    c.strokeStyle = 'rgba(14,14,22,.95)'; c.lineWidth = 4; c.strokeRect(-50, -88, 100, 176);
    c.fillStyle = 'rgba(110,122,160,.6)'; for (let l = 0; l < 7; l++) c.fillRect(-32, -60 + l * 18, 40 + ((l * 23) % 22), 6);
    c.restore();
    // the spoken sentence rises as letters, and becomes a palace in the dark above the bed
    if (o.lettersAt !== undefined) {
      const letters = 'ascripttenpageanalysisadraftofsomethingyouhavebeenmeaningtowriteformonths', r = rng(31);
      c.font = 'italic 38px "IM Fell English"';
      for (let i = 0; i < 170; i++) {
        const born = o.lettersAt + r() * 14, life = 3.4 + r() * 2.2, dx = (r() - 0.5) * 520, sway = r() * TAU;
        const q = (t - born) / life; if (q < 0 || q > 1) { r(); continue; }
        c.globalAlpha = Math.sin(q * PI) * 0.8; c.fillStyle = '#e9eefa';
        c.fillText(letters[i % letters.length], px + dx * easeOut(q) + Math.sin(t * 1.3 + sway) * 16 - 60, py - 110 - q * 480); r();
      }
      c.globalAlpha = 1;
    }
    if (o.buildAt !== undefined && t > o.buildAt) {
      c.save(); c.translate(760, 250); c.scale(0.48, 0.48); c.translate(-W / 2, -540);
      L.FACADE.draw(c, ease(seg(t, o.buildAt, o.buildAt + 9)), 'rgba(228,232,246,.85)');
      c.restore();
    }
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
      c.font = 'italic 400 24px "IM Fell English"'; c.textAlign = 'center'; c.fillStyle = 'rgba(45,28,18,.7)'; c.fillText('Plate I.', PLATE.x + PLATE.w / 2, PLATE.y + PLATE.h + 56); c.textAlign = 'left';
      c.font = '400 22px "IM Fell English SC"'; c.letterSpacing = '5px'; c.textAlign = 'center'; c.fillStyle = 'rgba(45,28,18,.7)';
      c.fillText('The Saddest Empires', 1382, 128); c.letterSpacing = '0px'; c.textAlign = 'left';
    }
    const coverLeaf = () => leaf3d(c, o.coverTheta, cover, marbledImg(), { w: LEAF_W + 22, y0: PAGE.top - 16, h: LEAF_H + 34 });
    const titleLeaf = () => leaf3d(c, o.turnTheta, titlePageImg(), blankLeafImg(), { curl: 0.55 });
    if (o.coverTheta < PI) { titleLeaf(); coverLeaf(); } else { coverLeaf(); titleLeaf(); }
    // once the leaf lies on the left, it is a page you can write on
    if (o.turnTheta >= PI) {
      c.font = '400 22px "IM Fell English SC"'; c.letterSpacing = '5px'; c.textAlign = 'center'; c.fillStyle = 'rgba(45,28,18,.7)';
      c.fillText('I · The Throne', 534, 128); c.letterSpacing = '0px'; c.textAlign = 'left';
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
    g1.addColorStop(0, 'rgb(255,236,206)'); g1.addColorStop(0.35, 'rgb(190,150,110)'); g1.addColorStop(1, 'rgb(0,0,0)');
    lm.fillStyle = g1; lm.fillRect(0, 0, W / 2, H / 2);
    if (o.fill > 0) {
      const [bx, by] = toScreen(o.coverTheta > PI / 2 ? CX : 1382, 540);
      const g2 = lm.createRadialGradient(bx / 2, by / 2, 20, bx / 2, by / 2, 1200 * cam.s / 2);
      g2.addColorStop(0, `rgba(250,222,180,${0.62 * o.fill})`); g2.addColorStop(0.6, `rgba(160,112,66,${0.42 * o.fill})`); g2.addColorStop(1, 'rgba(0,0,0,0)');
      lm.fillStyle = g2; lm.fillRect(0, 0, W / 2, H / 2);
    }
    if (o.white > 0) { lm.globalCompositeOperation = 'source-over'; lm.fillStyle = `rgba(255,255,255,${o.white})`; lm.fillRect(0, 0, W / 2, H / 2); }
    c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(LM, 0, 0, W, H); c.restore();
    // the open pages glow a little, as if lit from within
    if (o.spill > 0) {
      c.save(); c.globalCompositeOperation = 'screen';
      const [bx, by] = toScreen(CX, 540);
      const gs = c.createRadialGradient(bx, by, 40, bx, by, 900 * cam.s);
      gs.addColorStop(0, `rgba(255,196,120,${0.24 * o.spill})`); gs.addColorStop(1, 'rgba(255,170,80,0)');
      c.fillStyle = gs; c.fillRect(0, 0, W, H); c.restore();
    }
    // the candle itself stays bright
    if (o.candle.lit > 0) {
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
  const camInto = (k) => ({ s: lerp(1, W / PLATE.w, k), cx: lerp(CX, PLATE.x + PLATE.w / 2, k), cy: lerp(CY, PLATE.y + PLATE.h / 2, k) });

  /* ============================================================ the story */
  const SC = [], MARKS = [], PASS = [];
  const mark = (name, t, extra = {}) => MARKS.push(Object.assign({ scene: SC.length, name, t }, extra));
  const add = (o) => { SC.push(o); (o.passages || []).forEach((P) => PASS.push({ scene: SC.length - 1, P })); };

  const charAt = (P, word) => { const plain = P.chars.map((c2) => c2.ch).join(''); const i = plain.indexOf(word); return i < 0 ? P.written : P.chars[i].at; };
  if (L.variant === 'opening') {
    // PROLOGUE: a match, a candle, a book
    const p1 = passage({ mode: 'top', at: 3.0, night: true, size: 66, y: 64, cps: 13, text: '*This is the story of an empire.*' });
    const p2 = passage({ mode: 'top', at: p1.written + 0.9, night: true, size: 66, y: 64 + 66 * 1.34, cps: 13, text: '*The greatest the world has ever known.*' });
    p1.out = p2.out = p2.written + 1.6; p1.gone = p2.gone = p2.out + 0.9;
    const openAt = p2.gone - 0.2, turnAt = openAt + 4.2, turnD = 2.2;
    const f1 = passage({ mode: 'bookCentre', at: turnAt + turnD + 0.8, size: 86, cps: 10, text: 'It begins with {you.}', hold: 2.0, sink: true });
    const into = f1.gone + 0.2, travel = 3.8, d = into + travel;
    mark('strike', 1.0); mark('title', p1.at); mark('open', openAt); mark('riffle', turnAt, { d: turnD }); mark('begins', f1.at); mark('zoom', into, { d: travel });
    PASS.push({ scene: SC.length, P: f1 });
    add({ name: 'prologue', d, passages: [p1, p2], draw(c, t) {
      const zoom = lerp(0.62, 1, ease(seg(t, openAt - 1.2, openAt + 2.6)));
      const cam0 = { s: zoom, cx: CX + 420 * (1 - ease(seg(t, openAt - 0.3, openAt + 2.4))), cy: CY - 60 * (1 - zoom) / 0.38 };
      const k = ease(seg(t, into, into + travel));
      const coverTheta = PI * ease(seg(t, openAt, openAt + 2.6));
      const turnTheta = PI * ease(seg(t, turnAt, turnAt + turnD));
      bookScene(c, t, { cam: k > 0 ? camInto(k) : cam0, coverTheta, turnTheta,
        plate: t > turnAt - 0.1 ? (x) => WORLD.throne(x, 0, {}) : null,
        candle: { x: 1905, y: 1010, h: 330, lit: seg(t, 1.0, 1.4), spark: Math.max(0, 1 - Math.abs(t - 1.05) / 0.25) },
        light: ease(seg(t, 1.0, 4.6)), fill: ease(seg(t, openAt + 0.4, openAt + 2.6)), white: k,
        spill: Math.sin(seg(t, openAt + 0.3, turnAt + turnD + 1.5) * PI) * 0.8 * (1 - k),
        dust: (1 - seg(t, turnAt + turnD + 1, turnAt + turnD + 3)) * seg(t, openAt + 0.5, openAt + 1.5), dustAt: openAt + 0.4,
        sheen: seg(t, 4.4, 6.4),
        leftPage: (cc) => drawPassage(cc, f1, t) });
    } });

    // I · THE THRONE
    {
      const q1 = passage({ mode: 'top', at: 1.0, size: 64, text: 'You now sit on the throne.', hold: 1.4 });
      const q2 = passage({ mode: 'top', at: q1.gone + 0.2, text: 'Your servants stand shoulder to shoulder, / as far as the eye can see.', hold: 1.6 });
      const q3 = passage({ mode: 'top', at: q2.gone + 0.2, text: 'They have read everything. They can build anything. / They do not tire, and they do not resent.', hold: 1.8 });
      const q4 = passage({ mode: 'top', at: q3.gone + 0.2, size: 64, text: 'They are waiting for your {instruction.}', hold: 3.8 });
      const bowAt = charAt(q4, 'instruction') + 0.5, d = q4.gone + 0.4;
      mark('throne', 0); mark('bow', bowAt); mark('cut', d);
      add({ name: 'throne', d, passages: [q1, q2, q3, q4], draw(c, t) { WORLD.throne(c, t, { bowAt, drift: d }); scrim(c, 'top', ease(seg(t, 0, 0.9)), false); } });
    }
    // II · THE BED
    {
      const b1 = passage({ mode: 'lower', at: 1.4, night: true, size: 56, text: 'Of course, you are not in a palace.', hold: 1.3 });
      const b2 = passage({ mode: 'lower', at: b1.gone + 0.2, night: true, size: 56, text: 'You are in bed. / You have not brushed your teeth.', hold: 1.5 });
      const b3 = passage({ mode: 'lower', at: b2.gone + 0.2, night: true, size: 52, text: 'You speak a few sentences into the dark, and somewhere, in a place that is not a place, something begins to build for you.', hold: 2.6 });
      const b4 = passage({ mode: 'centre', at: b3.gone + 0.6, night: true, size: 86, cps: 12, text: 'You did not earn this. / You are not dressed.', hold: 3.2 });
      const lettersAt = charAt(b3, 'dark'), buildAt = lettersAt + 2.2;
      mark('bed', 0); mark('dark', lettersAt); mark('earn', b4.at);
      add({ name: 'bed', d: b4.gone + 2.8, passages: [b1, b2, b3, b4], draw(c, t) {
        WORLD.bed(c, t, { lettersAt, buildAt });
        scrim(c, 'lower', 1 - seg(t, b3.out, b3.gone), true);
        const veil = ease(seg(t, b4.at - 0.9, b4.at)) * (1 - ease(seg(t, b4.out, b4.gone)));
        if (veil > 0) { c.fillStyle = `rgba(8,8,14,${0.8 * veil})`; c.fillRect(0, 0, W, H); }
      } });
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
  SC.forEach((s, i) => { const hard = i === 0 || ['morning', 'firstpage', 'epilogue', 'throne', 'bed'].includes(s.name); s.t0 = hard ? acc : acc - XF; s.t1 = s.t0 + s.d; acc = s.t1; s.xf = !hard; });
  const DURATION = acc;
  const out = document.getElementById('film').getContext('2d');
  const bufA = mk(), bufB = mk();
  function renderScene(c, s, t) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    s.draw(c, t);
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
      out.globalAlpha = k === 0 || !s.xf ? 1 : ease(seg(T, s.t0, s.t0 + XF));
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
    cut: L.variant === 'opening' ? 'opening' : 'story', duration: DURATION,
    scenes: SC.map((s) => ({ name: s.name, t0: +s.t0.toFixed(3), d: s.d })),
    passages: PASS.map(({ scene, P }) => ({ t: +(SC[scene].t0 + P.at).toFixed(3), end: +(SC[scene].t0 + P.written).toFixed(3), voice: P.voice, gold: /\{/.test(P.text), scene })),
    marks: MARKS.map((m) => Object.assign({}, m, { t: +(SC[m.scene].t0 + m.t).toFixed(3) })),
  });
  return { render, duration: DURATION, cues };
};
