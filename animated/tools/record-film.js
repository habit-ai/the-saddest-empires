// Render the film (film.html) to numbered JPEG frames, one exact frame at a time.
// 1) python3 -m http.server 8765   (from the repo root)
// 2) OUT=/path/to/frames node animated/tools/record-film.js      (FROM/TO in seconds to render a range)
// 3) python3 animated/tools/score.py cues.json score.wav, then mux with ffmpeg (see PLAN.md)
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const FPS = 30, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // The type must be the real type: reload until both faces are in (Google Fonts can fail transiently).
  for (let attempt = 1; ; attempt++) {
    await p.goto('http://localhost:8765/animated/film.html?record' + (process.env.Q || ''));
    await p.evaluate(() => window.FILM.ready);
    const ok = await p.evaluate(() => document.fonts.check('italic 40px "Cormorant Garamond"') && document.fonts.check('40px "Cinzel"')
      && [...document.fonts].some((f) => f.family.includes('Cormorant') && f.status === 'loaded'));
    if (ok) break;
    if (attempt >= 6) throw new Error('fonts failed to load');
    console.log('fonts missing, reloading');
  }
  const dur = await p.evaluate(() => window.FILM.duration());
  const f0 = Math.round((+process.env.FROM || 0) * FPS), f1 = Math.round((+process.env.TO || dur) * FPS);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await p.evaluate((t) => window.FILM.render(t), f / FPS);
    await p.screenshot({ path: `${OUT}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    if (f % 300 === 0) console.log(`frame ${f}/${f1}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log('done', f1 - f0, 'frames; errors:', errs.join('; ') || 'none');
  await b.close();
})();
