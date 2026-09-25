/* The line of servants: a procedural, perspective-correct queue that runs from the castle gate
   to the horizon. One renderer, used by the Line set piece and as the backdrop of the Crown. */
(function () {
  const INK = '58,34,24';
  const SPRITES = [1, 2, 3, 4, 5, 6].map((n) => `assets/servant-${n}.png`);
  const MIP_HEIGHTS = [16, 32, 64, 128, 256, 600];

  // Deterministic randomness so the line is the same on every visit.
  function rng(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  const sprites = { ready: false, mips: [], onReady: [] };

  function buildMips(img) {
    return MIP_HEIGHTS.map((h) => {
      const w = Math.max(1, Math.round((img.width * h) / img.height));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, h);
      return c;
    });
  }

  let loaded = 0;
  const imgs = SPRITES.map((src) => {
    const img = new Image();
    img.onload = () => {
      if (++loaded === SPRITES.length) {
        sprites.mips = imgs.map(buildMips);
        sprites.ready = true;
        sprites.onReady.forEach((f) => f());
      }
    };
    img.src = src;
    return img;
  });

  function pickMip(mips, px) {
    for (let i = 0; i < mips.length; i++) if (mips[i].height >= px) return mips[i];
    return mips[mips.length - 1];
  }

  class LineScene {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({
        count: 3200,     // servants in the line
        z0: 7,           // depth of the first servant (camera units)
        gap: 1.25,       // spacing in the queue
        horizon: 0.3,    // horizon height as a fraction of the stage
        camH: 4,         // camera height: we look down on the queue, as if from the wall
        figH: 1.75,      // servant height
        firstX: -1.0,    // lateral position of the first servant
        gate: true,      // draw the castle wall and gate
        ground: true,    // draw the engraved ground lines
      }, opts);
      this.state = { zoom: 1, visible: this.o.count, focus: 0, alpha: 1 };
      this.layout();
      this.seed();
      sprites.onReady.push(() => this.draw());
    }

    seed() {
      const r = rng(7);
      const o = this.o;
      this.servants = [];
      for (let i = 0; i < o.count; i++) {
        const z = o.z0 + i * o.gap * (0.85 + r() * 0.35);
        const d = z - o.z0;
        // the queue snakes away but always stays clear of the wall on the left
        const x = o.firstX + 0.12 * d + 3.2 * Math.sin(d / 30) * (1 - Math.exp(-d / 8)) + (r() - 0.5) * 0.22;
        this.servants.push({
          z, x,
          s: i === 0 ? 0 : Math.floor(r() * 6),
          flip: i === 0 ? true : r() < 0.5,
          h: o.figH * (0.9 + r() * 0.16),
        });
      }
    }

    layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      this.W = rect.width; this.H = rect.height; this.dpr = dpr;
      this.canvas.width = Math.round(this.W * dpr);
      this.canvas.height = Math.round(this.H * dpr);
      this.f = Math.min(this.H * 0.95, this.W * 1.1);
      this.hy = this.H * this.o.horizon;
      this.vx = this.W * 0.5;
    }

    // world -> un-zoomed screen
    px(x, z) { return this.vx + (this.f * x) / z; }
    py(yUp, z) { return this.hy + (this.f * (this.o.camH - yUp)) / z; }

    // screen point of the first servant's chest: the zoom anchor
    anchor() {
      const o = this.o;
      return { x: this.px(o.firstX, o.z0), y: this.py(o.figH * 0.72, o.z0) };
    }

    set(state) { Object.assign(this.state, state); }

    draw() {
      const { ctx, W, H, dpr, o } = this;
      const st = this.state;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!sprites.ready) return;

      // camera: zoom about the first servant, easing him from centre-stage to his natural spot
      const a = this.anchor();
      const z = st.zoom;
      const tx = W * 0.5 + (a.x - W * 0.5) * st.focus;
      const ty = H * 0.52 + (a.y - H * 0.52) * st.focus;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (tx - a.x * z), dpr * (ty - a.y * z));
      const lw = 1 / z; // hairlines stay hairlines at every zoom
      ctx.globalAlpha = st.alpha;

      this.bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f4ede4';
      if (o.ground) this.drawGround(lw, z);
      const zHills = 1e9, zGate = o.z0 + 0.6; // hills sit behind everything
      let hillsDone = false, gateDone = !o.gate;
      // far to near: hills hide the line where it crosses the horizon; the wall stands behind the first servant
      const n = Math.min(Math.floor(st.visible), o.count);
      const fade = Math.max(1, n * 0.08);
      for (let i = n - 1; i >= 0; i--) {
        const sv = this.servants[i];
        if (!hillsDone && sv.z < zHills) { ctx.globalAlpha = st.alpha; this.drawHills(lw); hillsDone = true; }
        if (!gateDone && sv.z < zGate) { ctx.globalAlpha = st.alpha; this.drawGate(lw); gateDone = true; }
        const hPx = (this.f * sv.h) / sv.z;
        const onScreen = hPx * z;
        const born = Math.min(1, (st.visible - i) / fade);
        const haze = 1 - Math.min(0.7, (sv.z - o.z0) / 900);
        const x = this.px(sv.x, sv.z);
        const yFeet = this.py(0, sv.z);
        ctx.globalAlpha = st.alpha * born * haze;
        if (onScreen < 3) {
          ctx.globalAlpha *= onScreen < 1.2 ? 0.07 : 0.2 + 0.15 * onScreen; // the far line thins to a thread
          ctx.fillStyle = `rgb(${INK})`;
          ctx.fillRect(x - 0.3 * lw, yFeet - hPx, 0.9 * lw, Math.max(hPx, lw));
          continue;
        }
        const mip = pickMip(sprites.mips[sv.s], onScreen * dpr);
        const w = (mip.width / mip.height) * hPx;
        if (sv.flip) {
          ctx.save();
          ctx.translate(x, 0); ctx.scale(-1, 1);
          ctx.drawImage(mip, -w / 2, yFeet - hPx, w, hPx);
          ctx.restore();
        } else {
          ctx.drawImage(mip, x - w / 2, yFeet - hPx, w, hPx);
        }
      }
      ctx.globalAlpha = st.alpha;
      if (!hillsDone) this.drawHills(lw);
      if (!gateDone) this.drawGate(lw);
      ctx.globalAlpha = 1;
    }

    drawGround(lw) {
      const { ctx, W, H } = this;
      ctx.strokeStyle = `rgba(${INK},0.22)`;
      ctx.lineWidth = lw;
      const span = W * 3;
      for (let k = 0; k < 44; k++) {
        const z = 2.2 * Math.pow(1.16, k);
        const y = this.py(0, z);
        if (y > H * 3) continue;
        ctx.globalAlpha = this.state.alpha * Math.max(0.15, 1 - k / 44);
        ctx.beginPath(); ctx.moveTo(-span, y); ctx.lineTo(W + span, y); ctx.stroke();
      }
      ctx.globalAlpha = this.state.alpha;
      // the horizon itself
      ctx.strokeStyle = `rgba(${INK},0.55)`;
      ctx.beginPath(); ctx.moveTo(-span, this.hy); ctx.lineTo(W + span, this.hy); ctx.stroke();
    }

    drawHills(lw) {
      const { ctx, W } = this;
      const r = rng(11);
      const span = W * 3;
      const pts = [];
      for (let x = -span; x <= W + span; x += 18) {
        const u = x / W;
        pts.push([x, this.hy - this.H * (0.012 + 0.02 * Math.max(0, Math.sin(u * 5.3 + 1)) + 0.008 * Math.sin(u * 17)) - r() * 0.6]);
      }
      ctx.fillStyle = this.bg;
      ctx.beginPath(); ctx.moveTo(pts[0][0], this.hy + 1);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(pts[pts.length - 1][0], this.hy + 1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(${INK},0.5)`; ctx.lineWidth = lw;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      // short engraved strokes on the slopes
      ctx.strokeStyle = `rgba(${INK},0.25)`;
      ctx.beginPath();
      for (let i = 1; i < pts.length; i += 2) {
        const [x, y] = pts[i];
        const d = this.hy - y;
        for (let j = 1; j < d / 2.2; j++) { ctx.moveTo(x - 4, y + j * 2.2); ctx.lineTo(x + 5, y + j * 2.2); }
      }
      ctx.stroke();
    }

    drawGate(lw) {
      const { ctx, o } = this;
      const zc = o.z0 + 0.6;                // the wall stands just behind the first servant
      const X = (x) => this.px(x, zc);
      const Y = (y) => this.py(y, zc);
      const u = this.f / zc;                // pixels per world unit at the wall
      const L = o.firstX - 0.5;              // right edge of the gate tower
      const towerW = 1.1, gateW = 1.3, wallH = 2.5, towerH = 3.5;
      const t2 = L, t1 = L - towerW, g0 = t1 - gateW, t0 = g0 - towerW, far = t0 - 40;

      const bg = this.bg;
      const ink = (a) => `rgba(${INK},${a})`;
      ctx.lineWidth = lw * 1.2;

      const block = (x0, x1, h, crenel) => {
        ctx.beginPath();
        ctx.moveTo(X(x0), Y(0));
        ctx.lineTo(X(x0), Y(h));
        if (crenel) {
          const m = 0.32;
          for (let x = x0; x < x1 - 1e-6; x += m * 2) {
            const xe = Math.min(x + m, x1);
            ctx.lineTo(X(x), Y(h + 0.35)); ctx.lineTo(X(xe), Y(h + 0.35)); ctx.lineTo(X(xe), Y(h));
            ctx.lineTo(X(Math.min(xe + m, x1)), Y(h));
          }
        }
        ctx.lineTo(X(x1), Y(h)); ctx.lineTo(X(x1), Y(0)); ctx.closePath();
        ctx.fillStyle = bg; ctx.fill();
        ctx.strokeStyle = ink(0.85); ctx.stroke();
        // coursed stone: horizontal courses, staggered joints
        ctx.save(); ctx.clip();
        ctx.lineWidth = lw * 0.8;
        const course = 0.22;
        const x0v = Math.max(x0, -12);   // nothing further left is ever on screen
        ctx.strokeStyle = ink(0.33);
        ctx.beginPath();
        for (let k = 0, y = course; y < h + 0.4; y += course, k++) {
          ctx.moveTo(X(x0v), Y(y)); ctx.lineTo(X(x1), Y(y));
          const off = (k % 2) * 0.28;
          for (let x = x0v + off; x < x1; x += 0.56) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y - course)); }
        }
        ctx.stroke();
        // shade the right third with fine vertical hatching
        ctx.strokeStyle = ink(0.22);
        const step = Math.max(2.2 / u, 0.03);
        ctx.beginPath();
        for (let x = x1 - (x1 - x0v) * 0.3; x < x1; x += step) { ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(h + 0.4)); }
        ctx.stroke();
        ctx.restore();
      };

      block(far, t0, wallH, true);
      block(g0, t1, wallH + 0.6, false); // wall above the gate
      // gate opening: dark, densely hatched arch
      const archTop = 2.1;
      ctx.beginPath();
      ctx.moveTo(X(g0), Y(0)); ctx.lineTo(X(g0), Y(archTop - gateW / 2));
      ctx.arc(X((g0 + t1) / 2), Y(archTop - gateW / 2), (gateW / 2) * u, Math.PI, 0);
      ctx.lineTo(X(t1), Y(0)); ctx.closePath();
      ctx.fillStyle = bg; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = ink(0.55); ctx.lineWidth = lw;
      const hs = Math.max(2.4 / u, 0.025);
      ctx.beginPath();
      for (let x = g0 - 3; x < t1 + 3; x += hs) { ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x + 3), Y(archTop + 1)); }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = ink(0.85); ctx.lineWidth = lw * 1.2;
      ctx.beginPath();
      ctx.moveTo(X(g0), Y(0)); ctx.lineTo(X(g0), Y(archTop - gateW / 2));
      ctx.arc(X((g0 + t1) / 2), Y(archTop - gateW / 2), (gateW / 2) * u, Math.PI, 0);
      ctx.lineTo(X(t1), Y(0)); ctx.stroke();
      block(t0, g0, towerH, true);
      block(t1, t2, towerH, true);
      // arrow slits
      [[t0, g0], [t1, t2]].forEach(([a, b]) => {
        const cx = (a + b) / 2;
        ctx.fillStyle = ink(0.55);
        ctx.fillRect(X(cx) - 0.03 * u, Y(3.0), 0.06 * u, 0.45 * u);
      });
    }
  }

  window.LineScene = LineScene;
})();
