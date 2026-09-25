(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const seg = (p, a, b) => clamp((p - a) / (b - a));

  /* ---------- the day arc: one day of light across the essay ---------- */
  const SKY = {
    predawn:    { bg: [27, 31, 46] },
    dawn:       { bg: [226, 214, 204] },
    day:        { bg: [244, 237, 228] },
    dusk:       { bg: [236, 206, 166] },
    night:      { bg: [21, 18, 15] },
    firstlight: { bg: [228, 226, 219] },
  };
  const anchors = [...document.querySelectorAll('[data-sky]')];
  let anchorTops = [];
  function measureAnchors() {
    anchorTops = anchors
      .map((el) => ({ top: el.getBoundingClientRect().top + scrollY, sky: SKY[el.dataset.sky] }))
      .sort((a, b) => a.top - b.top);
  }
  function sky() {
    const y = scrollY + innerHeight * 0.25; // the reading line
    const win = innerHeight * 0.7;           // light changes over most of a screen before each anchor
    let bg = anchorTops[0].sky.bg;
    for (let i = 1; i < anchorTops.length; i++) {
      const a = anchorTops[i];
      const t = clamp((y - (a.top - win)) / win);
      if (t <= 0) break;
      bg = bg.map((c, k) => lerp(c, a.sky.bg[k], ease(t)));
    }
    const lum = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255;
    root.style.setProperty('--bg', `rgb(${bg.map(Math.round).join(',')})`);
    root.style.setProperty('--ink', lum < 0.5 ? '#eadfcb' : '#2c1810');
  }

  /* ---------- reveals ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => (reduced ? el.classList.add('visible') : io.observe(el)));

  /* ---------- stars over the pre-dawn title ---------- */
  function stars() {
    const c = document.querySelector('.stars');
    const r = c.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = r.width * dpr; c.height = r.height * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * r.width, y = rnd() * r.height * 0.85, big = rnd() < 0.08;
      g.fillStyle = `rgba(239,228,210,${0.15 + rnd() * 0.5})`;
      if (big) { // engraved star: a tiny cross
        g.fillRect(x - 3, y - 0.4, 6, 0.8); g.fillRect(x - 0.4, y - 3, 0.8, 6);
      } else g.fillRect(x, y, 1, 1);
    }
  }

  /* ---------- pinned scenes ---------- */
  function progress(pin) {
    if (reduced) return 1;
    const r = pin.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight));
  }
  function captions(pin, p) {
    pin.querySelectorAll('.caption').forEach((c) => {
      c.classList.toggle('on', p >= +c.dataset.in && p < +c.dataset.out);
    });
  }
  const inView = (pin) => { const r = pin.getBoundingClientRect(); return r.bottom > -50 && r.top < innerHeight + 50; };

  // 1 · the line
  const linePin = document.querySelector('.pin-line');
  const line = new LineScene(linePin.querySelector('canvas'));
  const counterEl = linePin.querySelector('.counter-num');
  function roman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; } // past MMMCMXCIX the Ms just keep coming
    return out;
  }
  let lastCount = -1;
  function drawLine() {
    const p = progress(linePin);
    const t = ease(seg(p, 0.04, 0.92));
    // one servant, then tens, hundreds, thousands
    const visible = p < 0.08 ? 1 : Math.exp(lerp(0, Math.log(line.o.count), easeOut(seg(p, 0.08, 0.9)) ** 1.6));
    line.set({ zoom: lerp(3.4, 1, t), focus: t, visible });
    line.draw();
    captions(linePin, p);
    const n = Math.max(1, Math.floor(visible));
    if (n !== lastCount) {
      counterEl.textContent = n >= line.o.count - 1 ? roman(n * 37) : roman(n);
      lastCount = n;
    }
  }

  // 2 · the glass
  const glassPin = document.querySelector('.pin-glass');
  const svg = glassPin.querySelector('svg');
  const drawLines = [...svg.querySelectorAll('.draw .ln')];
  const apple = svg.querySelector('.juice-apple');
  const orange = svg.querySelector('.juice-orange');
  const surface = svg.querySelector('.juice-surface');
  const gaps = [...svg.querySelectorAll('.gap')];
  const gapLabel = svg.querySelector('.gap-label');
  const gapFill = svg.querySelector('.gap-fill');
  const gaugeEl = glassPin.querySelector('.gauge-num');
  const BOTTOM = 452, TOP = 186; // inside of the glass, in SVG units
  const levelY = (f) => lerp(BOTTOM, TOP, f);
  function setJuice(rect, f) {
    const y = levelY(f);
    rect.setAttribute('y', y); rect.setAttribute('height', Math.max(0, BOTTOM + 10 - y));
  }
  function drawGlass() {
    const p = progress(glassPin);
    // the engraving draws itself
    const d = seg(p, 0, 0.09);
    drawLines.forEach((l, i) => {
      const k = seg(d, i / drawLines.length * 0.6, i / drawLines.length * 0.6 + 0.4);
      l.style.strokeDashoffset = 1 - ease(k);
    });
    svg.classList.toggle('drawn', d > 0.8);
    // apple: fills fully, then drains
    const aFill = ease(seg(p, 0.1, 0.26)) - ease(seg(p, 0.34, 0.42));
    // orange: to fifty, a pause, then to ninety
    const oFill = 0.5 * ease(seg(p, 0.44, 0.52)) + 0.4 * ease(seg(p, 0.64, 0.74));
    setJuice(apple, aFill);
    setJuice(orange, oFill);
    const f = Math.max(aFill, oFill);
    const y = levelY(f);
    surface.setAttribute('cy', y);
    surface.setAttribute('rx', lerp(68, 86, f));
    surface.style.stroke = oFill > aFill ? '#c4561a' : '#9c8f2e';
    surface.style.opacity = f > 0.01 ? 1 : 0;
    gaugeEl.textContent = Math.round(f * 100);
    // the shape of the gap
    const g = ease(seg(p, 0.8, 0.92));
    gaps.forEach((el) => (el.style.strokeDashoffset = 1 - g));
    gapFill.style.opacity = g * 0.9;
    gapLabel.style.opacity = g > 0.6 ? 1 : 0;
    captions(glassPin, p);
  }

  // 3 · the crown
  const crownPin = document.querySelector('.pin-crown');
  const world = crownPin.querySelector('.crown-world');
  const crown = crownPin.querySelector('.crown');
  const shadow = crownPin.querySelector('.crown-shadow');
  const lines = [...crownPin.querySelectorAll('.caption-line')];
  const bgCanvas = crownPin.querySelector('.crown-bg');
  const court = new LineScene(bgCanvas, { count: 1400, z0: 14, gate: false, ground: false, firstX: -5.5, horizon: 0.42 });
  const floorG = crownPin.querySelector('.floor-lines');
  for (let i = 0; i < 16; i++) { // engraved floor, lines closing up with distance
    const y = 1000 + Math.pow(i, 1.5) * 4.2;
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', -800); l.setAttribute('x2', 2200); l.setAttribute('y1', y); l.setAttribute('y2', y);
    l.setAttribute('opacity', (0.55 - i * 0.03).toFixed(2));
    floorG.appendChild(l);
  }
  let pickedUp = false, pickT = 0, pickRaf = 0;
  function crownPose(p) {
    // tip over the right edge of the abacus, fall, bounce, settle on its side
    const tip = ease(seg(p, 0.1, 0.2));
    const fall = seg(p, 0.2, 0.33);
    const settle = seg(p, 0.33, 0.4);
    let x = 22 * tip, y = -6 * tip, rot = 16 * tip;
    if (fall > 0) {
      const fx = easeOut(fall), fy = fall * fall;
      x = lerp(22, 400, fx);
      y = lerp(-6, 290, fy);
      rot = lerp(16, 94, easeOut(fall));
    }
    if (settle > 0) {
      const b = Math.sin(settle * Math.PI) * (1 - settle);
      x = 400 + 14 * easeOut(settle);
      y = 290 - 38 * b;
      rot = 94 - 4 * easeOut(settle) + 5 * b;
    }
    return { x, y, rot, down: seg(p, 0.3, 0.4) };
  }
  function drawCrown() {
    const p = progress(crownPin);
    // narrow screens frame the column and the fallen crown, dropping the empty margin on the left
    const narrow = innerWidth < 640;
    const scale = narrow ? innerWidth / 1200 : Math.min(innerWidth / 1400, innerHeight / 1100) * 1.04;
    const shift = narrow ? 250 * scale : 0;
    world.style.transform = `translate(calc(-50% - ${shift}px), -57%) scale(${scale})`;
    let pose = crownPose(p);
    if (pickT > 0) { // the reader picks it up: back onto the column
      const k = ease(pickT);
      pose = { x: lerp(pose.x, 0, k), y: lerp(pose.y, 0, k) - Math.sin(k * Math.PI) * 120, rot: lerp(pose.rot, 0, k), down: pose.down * (1 - k) };
    }
    crown.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rot}deg)`;
    shadow.style.opacity = pose.down;
    lines.forEach((l) => l.classList.toggle('on', p >= +l.dataset.in));
    const canPick = p > 0.85 && !pickedUp;
    crown.classList.toggle('can-pick', canPick);
    crown.tabIndex = canPick ? 0 : -1;
    // the servants gather behind, waiting
    const a = ease(seg(p, 0.5, 0.85));
    bgCanvas.style.opacity = a * 0.6;
    if (a > 0 && inView(crownPin)) { court.set({ zoom: 1, focus: 1, visible: court.o.count }); court.draw(); }
  }
  crown.addEventListener('click', () => {
    if (!crown.classList.contains('can-pick')) return;
    pickedUp = true;
    const t0 = performance.now();
    const step = (t) => {
      pickT = reduced ? 1 : clamp((t - t0) / 1600);
      drawCrown();
      if (pickT < 1) pickRaf = requestAnimationFrame(step);
      else {
        lines[lines.length - 1].textContent = 'It is yours.';
        lines.slice(0, -1).forEach((l) => (l.style.opacity = 0.35));
      }
    };
    cancelAnimationFrame(pickRaf);
    pickRaf = requestAnimationFrame(step);
  });

  /* ---------- two frequencies in the margin ---------- */
  const waves = document.querySelector('.waves');
  const wg = waves.getContext('2d');
  const firstFreq = [...document.querySelectorAll('.content p')].find((p) => p.textContent.startsWith('The frustration operates'));
  const letter = document.querySelector('.letter');
  let wavesOn = false;
  function tension() {
    // 0 before "two frequencies", rising through bandwidth, peaking in the letter, flat at the crown
    const top = (el) => el.getBoundingClientRect().top + scrollY;
    const y = scrollY + innerHeight * 0.5;
    const a = top(firstFreq), b = top(letter), c = top(crownPin);
    if (y < a - innerHeight * 0.3) return { on: 0, t: 0 };
    if (y < b) return { on: 1, t: clamp((y - a) / (b - a)) * 0.7 };
    if (y < c) return { on: 1, t: 0.7 + 0.3 * clamp((y - b) / (c - b)) };
    return { on: clamp(1 - (y - c) / innerHeight), t: 1 };
  }
  function drawWaves(time) {
    const { on, t } = tension();
    waves.style.opacity = on;
    if (!on) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = 80, H = innerHeight;
    if (waves.width !== W * dpr || waves.height !== H * dpr) { waves.width = W * dpr; waves.height = H * dpr; }
    wg.setTransform(dpr, 0, 0, dpr, 0, 0);
    wg.clearRect(0, 0, W, H);
    const ph = reduced ? 0 : time / 1000;
    const flat = on < 1 ? on : 1;
    const draw = (color, cx, amp, freq, speed) => {
      wg.strokeStyle = color; wg.lineWidth = 1;
      wg.beginPath();
      for (let y = 0; y <= H; y += 3) {
        const x = cx + Math.sin(y * freq + ph * speed) * amp * flat;
        y ? wg.lineTo(x, y) : wg.moveTo(x, y);
      }
      wg.stroke();
    };
    draw('rgba(184,134,11,.75)', 34, 6 + 10 * t, 0.012 + 0.03 * t, 0.6 + 2 * t);   // not being known
    draw('rgba(96,112,130,.7)', 46, 4 + 12 * t, 0.02 + 0.05 * t, -0.9 - 3 * t);    // bandwidth
    wavesOn = true;
  }

  /* ---------- the letter lights sentence by sentence ---------- */
  const passage = document.querySelector('.passage p');
  passage.innerHTML = passage.textContent.split(/(?<=[.!?])\s+/).map((s) => `<span class="sentence">${s}</span>`).join(' ');
  const sentences = [...passage.querySelectorAll('.sentence')];
  function drawLetter() {
    if (reduced) { sentences.forEach((s) => s.classList.add('lit')); return; }
    const r = passage.getBoundingClientRect();
    const reading = innerHeight * 0.62;
    sentences.forEach((s) => s.classList.toggle('lit', s.getBoundingClientRect().top < reading || r.bottom < reading));
  }

  /* ---------- loop ---------- */
  let dirty = true;
  const markDirty = () => (dirty = true);
  addEventListener('scroll', markDirty, { passive: true });
  addEventListener('resize', () => {
    measureAnchors(); line.layout(); court.layout(); stars(); dirty = true;
  });
  function frame(time) {
    if (dirty) {
      sky();
      if (inView(linePin)) drawLine();
      if (inView(glassPin)) drawGlass();
      if (inView(crownPin)) drawCrown();
      drawLetter();
      dirty = false;
    }
    drawWaves(time);
    requestAnimationFrame(frame);
  }
  function start() {
    measureAnchors(); stars(); line.layout(); court.layout();
    drawLine(); drawGlass(); drawCrown();
    requestAnimationFrame(frame);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else addEventListener('load', start);
  addEventListener('load', () => { measureAnchors(); dirty = true; });
})();
