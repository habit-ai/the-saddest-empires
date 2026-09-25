// Render the animated edition to an MP4, frame by frame (smooth regardless of machine speed).
// 1) python3 -m http.server 8765   (from the repo root)
// 2) mkdir frames && OUT=$PWD/frames node animated/tools/record.js   (W/H env vars set the size; default 1920x1080)
// 3) ffmpeg -framerate 30 -i frames/f%05d.jpg -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart out.mp4
// Virtual time drives requestAnimationFrame, performance.now and every CSS animation/transition.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
const OUT = process.env.OUT, FPS = 30, W = +process.env.W || 1920, H = +process.env.H || 1080;
const LIMIT = +process.env.LIMIT || Infinity;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    let now = 0, id = 0, q = [];
    window.requestAnimationFrame = (cb) => { q.push([++id, cb]); return id; };
    window.cancelAnimationFrame = (x) => { q = q.filter(([i]) => i !== x); };
    performance.now = () => now;
    const seen = new WeakMap();
    window.__tick = (dt) => {
      now += dt;
      const run = q; q = [];
      run.forEach(([, cb]) => cb(now));
      for (const a of document.getAnimations()) {
        if (!seen.has(a)) { a.pause(); seen.set(a, 0); }
        const t = seen.get(a) + dt; seen.set(a, t);
        a.currentTime = t;
      }
    };
  });
  await p.goto('http://localhost:8765/animated/', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1500);

  // Timeline: [seconds, scroll target]. Targets are resolved in the page from real element positions.
  const keys = await p.evaluate(() => {
    const top = (sel) => document.querySelector(sel).getBoundingClientRect().top + scrollY;
    const pinEnd = (sel) => { const el = document.querySelector(sel); return top(sel) + el.offsetHeight - innerHeight; };
    const letter = document.querySelector('.passage');
    const k = [];
    let t = 0; const at = (dur, y) => { t += dur; k.push([t, y]); };
    k.push([0, 0]);
    at(4.5, 0);                                   // title
    at(11, top('.pin-line'));                     // opening prose
    at(17, pinEnd('.pin-line'));                  // THE LINE
    at(2.5, pinEnd('.pin-line'));
    at(6, top('.pin-glass'));
    at(15, pinEnd('.pin-glass'));                 // THE GLASS
    at(2.5, pinEnd('.pin-glass'));
    at(13, top('.letter') - innerHeight * 0.2);   // the argument, at dusk
    at(15, top('.passage') + letter.offsetHeight - innerHeight * 0.55); // the letter, lit sentence by sentence
    at(4, top('.pin-crown'));
    at(15, pinEnd('.pin-crown') - 4);             // THE CROWN
    at(2.5, pinEnd('.pin-crown') - 4);
    return k;
  });
  const clickAt = keys[keys.length - 1][0];
  const total = clickAt + 7;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const yAt = (s) => {
    for (let i = 1; i < keys.length; i++) {
      const [t0, y0] = keys[i - 1], [t1, y1] = keys[i];
      if (s <= t1) return y0 + (y1 - y0) * ease((s - t0) / (t1 - t0));
    }
    return keys[keys.length - 1][1];
  };
  const frames = Math.min(Math.round(total * FPS), LIMIT);
  let clicked = false;
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const s = f / FPS;
    await p.evaluate((y) => { window.scrollTo(0, y); window.dispatchEvent(new Event('scroll')); }, Math.round(yAt(s)));
    if (!clicked && s >= clickAt + 0.6) {
      await p.evaluate(() => document.querySelector('.crown').click()); clicked = true;
    }
    await p.evaluate((dt) => window.__tick(dt), 1000 / FPS);
    await p.screenshot({ path: `${OUT}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (f % 300 === 0) console.log(`frame ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log('frames:', frames, 'seconds:', total.toFixed(1), 'errors:', errs.join('; ') || 'none');
  await b.close();
})();
