# The Saddest Empires — Animated Edition: Plan

_Drafted 2026-09-25. Next up after this: **Because You Let Us** (same pipeline)._

## Status: Phase 1 style frames built (2026-09-25)

`animated/index.html` is the full hosted text, plus three working set pieces, the day-light arc, the margin waves and the
lamplit letter. Serve the repo root locally and open `/animated/`.

- **The Line**: scroll zooms out from one servant at the gate to 3,200 servants reaching the horizon, counted in Roman numerals.
- **The Glass**: the glass draws itself, fills with apple juice, drains, fills with orange to 50%, then 90%, and the missing tenth is outlined in gold.
- **The Crown**: the crown tips off the column and lands on the floor; the closing lines follow; clicking "Pick it up." puts it back on the column.
- The servant, crown and column art is cut from the existing engravings (`assets/`), so no new art was needed yet.
- `prefers-reduced-motion` shows each scene's final frame; mobile has its own layout.

## The film (2026-09-25)

The first MP4 was a screen recording of the scrolling page: mostly paragraphs, with three pictures. Samuel's verdict: useless as a
visual essay. The film is a separate, purpose-built piece:

- `animated/film.html` + `film.js`: 31 full-frame scenes on one 1920×1080 canvas. Every frame is a pure function of time.
  Open it in a browser to preview it in real time (`?t=120` starts at 2:00).
- Every beat of the hosted essay has its own animated image. The text is cut to short lines of the essay's own words, set as titles.
- The art: engravings drawn line by line (palace, tablet, glass, mirror, wall), the servant sprites (the Line, the balance,
  the hierarchy losing resolution), the existing ruins and laptop plates (slow camera moves, a night treatment for the ruins),
  and the crown and column.
- Light follows the essay's day: dark morning, parchment, dusk, night for the letter, first light for the crown.
- Score: `tools/score.py` synthesises an ambient pad from the film's cue times: bells on scene changes, a thud when the crown lands,
  a resolving chord on "Pick it up." It's a placeholder until there's a real composer or licensed track.
- Render: `tools/record-film.js` (frames) → `tools/score.py` (audio) → ffmpeg:
  `ffmpeg -framerate 30 -i frames/f%05d.jpg -i score.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest out.mp4`

### Type study (2026-09-25)

Samuel: the text is the most important element, and it has to be far more legible and beautiful. `film.html?cut=type`
is an 86-second study of five moments built around a typesetting engine in `film.js`:

- The type is **set, not captioned**. Cormorant Garamond 500 at 78–150 px, with lines broken by hand for rhythm.
  Text never sits over the busy part of an image: the image is composed around a text zone.
- **Ink reveal**: each line runs left to right with a soft leading edge that blooms and then sharpens. Lines settle a few pixels
  as they land, and each block holds for reading time, then lifts away.
- `{gold}` marks the emphasis (*2026*, *time to give*, *the shape of the gap*, *no cause*, *Pick it up*); `*italic*` marks stress.
- The type is drawn on its own pass outside the camera drift, so it never scales or shimmers. A paper (or night) glow sits behind the letters.
- If this direction holds, the full film is re-set with this engine.
 the hosted essay is a reworked version of the vault draft. It has a new "mirror / the failure is the king"
passage, and it drops the Tuesday line, the Force Quit dialog, "Everyone is a king" and the Marcus/Simon extended beats.
The storyboard below was written from the vault draft. Rows 10, 14, 18, 20, 24–25 and 32 have no text to hang on in the
hosted version and need re-cutting before Phase 3. New beats to add from the hosted text: *the mirror is accurate, the face is bland*
and *Marcus kneeling before his son*.

## Where we start

- Live today: `habit-ai.github.io/the-saddest-empires/`, one static `index.html` (about 2,300 words), parchment palette,
  Cinzel + Cormorant Garamond, 4 engraving-style raster illustrations (ruins, laptop on a pedestal, servants, crown on a column),
  fade-in-on-scroll only.
- The hosted text is slightly edited from the vault source (`02-Areas/Samuel-Salzer/Writing/the_saddest_empires.md`).
  **The hosted text is canonical.**
- Roadmap role: understudy finale for Season One (W13, Oct 28) if Chris York's OK doesn't land by end of September.

## The concept in one line

**An engraving that comes alive and slowly loses its nerve.** The whole page is one continuous scroll-driven engraved world:
an old-master line drawing that draws itself as you read, where modern things (tabs, a Force Quit dialog,
a blinking cursor) keep breaking through the 18th-century surface. The collision of the two is the essay's argument:
*words that belong to an older physics* versus *a description of a Tuesday*.

### Three visual through-lines

1. **The line of servants.** It appears in Act II, and from then on it is always somewhere in the frame, stretching to the horizon.
   It is procedurally generated, so it can really be infinite. It is the page's pulse.
2. **One day.** The background light follows the essay's own clock: pre-dawn indigo (the morning in bed) → parchment daylight
   (the argument) → amber dusk (bandwidth, overwhelm) → ink-black night (the friend's late-night message) → first grey light
   (the crown on the floor, the question).
3. **Two frequencies.** The essay says the frustration "operates on two frequencies". Two hairline waves, gold (*not being known*)
   and cold blue-grey (*bandwidth*), run in the margin from Act III onward and tighten as tension rises. They go flat
   at the final question.

### Art direction

- Keep and deepen the existing identity: engraving / copperplate line work, sepia ink on warm paper, one accent of real gold leaf
  (animated specular sheen, used sparingly: the crown, the treasury, the final line).
- Motion vocabulary, kept small so the page feels authored, not effect-heavy:
  - **Draw-on**: engraving lines stroke in (SVG `stroke-dashoffset`), hatching fills in after the contours.
  - **Parallax depth**: 3–5 layers per scene (foreground ink, midground, faded background, paper).
  - **Pull-back**: the camera zooms out to reveal scale (the line of servants, the map of crowns).
  - **Intrusion**: a flat modern UI element breaks the engraving (hard edges, system font, no texture), then gets engraved over.
- Typography: Cinzel for titles and carved inscriptions, Cormorant for body. Quotes are set as carved stone (Marcus, Simon) or
  handwriting-by-lamplight (the friend's message).

## Storyboard

Structure: **sticky stage + scrolling text.** On desktop, prose runs in a column on one side while the illustrated stage stays
pinned and animates with scroll progress. Set pieces take the full screen between prose blocks. On mobile, the stage sits
above the text at about 55vh.

### Act I: The Morning

| # | Text beat | Scene | Motion |
|---|---|---|---|
| 0 | Title | Night sky over a sleeping city in engraving. The title is carved into a lintel. | Stars are hatching dots; title lines draw on; gold sheen crosses "Empires". |
| 1 | "You are in bed… you speak a few sentences into the dark" | A bed in a dark room, a phone's cold glow the only light. | The spoken sentence becomes a ribbon of words floating out of the window. |
| 2 | "in a place that is not a place… something begins to build" | The ribbon reaches a void where scaffolding assembles itself into a palace wing. | Construction lines draw on fast, like an architect's time-lapse. |
| 3 | "You did not earn this. You are not dressed." | Cut back to the bed; the palace is visible through the window, finished. | Hold. Quiet beat. |
| 4 | Marcus Aurelius, "is this necessary?" | Marcus writing by lamplight. His quote is carved into a stone tablet. | Tablet lettering chisels in letter by letter. |
| 5 | "the eighth tab… an abandoned wing of a palace" | A palace floor plan (architectural engraving). Eight wings sprout, each a browser tab shape. | Each wing starts building, then freezes half-built and fades to ruins. One is left alive. |

### Act II: The Inversion

| # | Text beat | Scene | Motion |
|---|---|---|---|
| 6 | "servant, tool, assistant — words from an older physics" | The three words in a period typeface on a scroll. | They are struck through and left hanging. |
| 7 | "labor was scarce, attention was cheap… now the reverse" | A balance scale: a pile of labor vs a single candle (attention). | The scale **flips**: labor floods to infinity, the candle becomes the heavy side. |
| 8 | Herbert Simon, 1971 | Lecture hall engraving; the quote on a blackboard. | "a poverty of attention" is underlined in chalk. |
| 9 | "standing in a line that stretches past the castle walls and over the horizon" | **Set piece 1: The Line.** A castle gate. One servant waits at it. | Camera pulls back and back: tens, hundreds, then thousands of servants to a curved horizon (canvas, procedural). A counter in Roman numerals climbs and overflows. |
| 10 | "This is a description of a Tuesday." | Hard cut: a flat modern calendar square, "TUE". | **First intrusion.** No texture, no animation, silence. |

### Act III: Two Frequencies

| # | Text beat | Scene | Motion |
|---|---|---|---|
| 11 | "two frequencies… hot and cold at the same time" | The two margin waves are introduced. | Both waves draw in and stay for the rest of the essay. |
| 12 | Apple juice instead of orange; "ninety percent… reveals the shape of the gap" | **Set piece 2: The Glass.** A servant presents a glass on a tray. | The glass fills orange as you scroll. At 90% the missing 10% is outlined in gold: the shape of the gap. **Optional interaction:** a slider from 50% to 90%, where 90% hurts more than 50%. |
| 13 | "You must describe yourself" | The servant turns the tray: it is now a mirror. | The reader's questions ("What do I actually want?") engrave into the mirror. |
| 14 | "The Socratic method has been automated" | A Socrates bust with an input cursor blinking beside it. | Intrusion #2, smaller. |

### Act IV: Bandwidth (dusk)

| # | Text beat | Scene | Motion |
|---|---|---|---|
| 15 | "You have infinite servants. You have a finite mind." | The king at a desk inside; the line outside the window. | The light goes amber; the blue wave speeds up. |
| 16 | "Who prepares for the day when the granary is infinite?" | A granary whose doors can't close. | Grain pours endlessly past the frame edge. |
| 17 | Bottleneck 1, **context** | A narrow doorway; the king tries to pass a huge scroll through it. | The scroll jams. |
| 18 | Bottleneck 2, **tools** ("the metaphor collapses into… a Force Quit dialog box") | **Set piece 3: The Collapse.** The castle engraving. | Intrusion #3, the big one: the engraving stutters and a real-looking Force Quit dialog opens over it. The engraving then engraves the dialog into itself, in stone. |
| 19 | Bottleneck 3, **organization** ("leverage… lose resolution") | A hierarchy: king → managers → managers → workers. | Each level down is literally lower resolution (line density drops, then pixelates). |
| 20 | "And then you need a bigger server. And then a bigger one." | The castle grows extra towers. | Towers stack faster and faster. |
| 21 | "hit the wall and then build a door" | A stone wall fills the frame. | A doorway is carved into it as you scroll, and dawn-coloured light comes through. The only warm light in Act IV. |

### Act V: The Crown

| # | Text beat | Scene | Motion |
|---|---|---|---|
| 22 | "Your servants are smarter than you." | **Set piece 4: The Court.** A row of full-height portraits: philosopher, historian, engineer, writer. | The courtiers grow in scale while the king shrinks, until only the crown is bigger than him. |
| 23 | "The only thing missing is the king." | An empty throne; the treasury is open. | The gold-leaf sheen runs through the coins. |
| 24 | "Everyone is a king now." | **Set piece 5: The Map of Crowns.** An engraved world map at night. | One crown lights up, then cities, then everywhere, like night lights seen from orbit. |
| 25 | "the largest and most silent test of human character" | An examination sheet with a single question: *What is your cause?* | The answer lines stay empty. |

### Act VI: The Letter (night)

| # | Text beat | Scene | Motion |
|---|---|---|---|
| 26 | The friend's message | **Set piece 6: The Letter.** Full-screen night. The quote is set by lamplight, one or two sentences per scroll step, with the empire behind in faint line. | Each sentence brings its image up: the throne, the serfs "pushing back the horizon", the treasury, the wise serfs. |
| 27 | "all you do is remodel the castle walls" | The castle walls. | The walls rebuild themselves in a loop, bricks moving, the building never going anywhere. |
| 28 | "a perpetual motion machine… yet you move nothing" | An engraved perpetual-motion wheel (a real historical design, e.g. Bhaskara's wheel). | It spins forever, attached to nothing. |
| 29 | "the saddest empires the world has ever known" | Pull back: the whole empire from Acts I–V, idle. | All motion on the page stops at once. |

### Coda: The Question (first light)

| # | Text beat | Scene | Motion |
|---|---|---|---|
| 30 | "The crown is on the floor." | The existing crown-on-column image, rebuilt as vector. | The crown tips and falls to the floor, with a soft settle. |
| 31 | "not *what can I do?*" | The line of servants, facing us, waiting. | The waves go flat. |
| 32 | "It is *what will I do?*" | An empty engraved instruction line with a blinking cursor. | **Optional interaction:** the reader can type; nothing is sent. On Enter, the first servant in line looks up. |
| 33 | "remodel the castle walls" | Final frame: ruins on one side, an unbuilt horizon on the other. | Title card, end. |

## Asset list

The six set pieces and about 25 supporting scenes need roughly **30 illustrations**, in three kinds:

| Kind | Examples | How we make it |
|---|---|---|
| **Figurative** (people, faces, drapery) | Servants (about 12 poses, reused), king, Marcus, Simon, the four courtiers, Socrates bust | Generated as engraving-style images from one fixed style prompt (matching the current 4), then vectorized (vtracer/potrace) and split into layers so they can draw on and move in parallax. |
| **Architectural / objects** | Palace plan, castle, wall and door, granary, scale, glass, mirror, wheel, crown, throne, map | Hand-built SVG with procedural hatching (clipped line fills, contour hatching). Crisp, small, and fully animatable. |
| **Systems** | The infinite line, the map of crowns, the grain, the waves | Canvas 2D / procedural code, instancing the servant sprites for thousands of figures. |
| **Intrusions** | TUE calendar, Force Quit dialog, cursor, tabs | Plain HTML/CSS, deliberately flat. |

Image generation isn't available in this environment, so the figurative images need a generation step on your side
(or an API key added to the environment). I'll write the prompt pack: one style block plus a per-figure line.

## Tech approach

- Stay a **single static page** on GitHub Pages: no framework, no build step. HTML + CSS + vanilla JS.
- **GSAP + ScrollTrigger** (from cdnjs) for scroll-scrubbed timelines and pinning. SVG for drawn scenes, one shared canvas
  for crowds.
- One timeline per scene, lazy-initialized as it nears the viewport; off-screen scenes pause.
- **Reduced motion:** `prefers-reduced-motion` shows each scene's final frame as a still, and the text still reads perfectly.
- **Mobile first-class:** stacked stage/text, touch-friendly optional interactions, the crowd count scaled to the device.
- Budget: under 3 MB total on first load (SVG + WebP), 60 fps on a mid-range phone, no layout shift.
- The text stays real HTML text, so it can be selected, searched, and read aloud by screen readers. OG image and meta carry over.

## Phases

1. **Style frames** (first session): build **3 of the 6 set pieces** as working prototypes (The Line, The Glass,
   The Crown falls) in the real page with placeholder text. Purpose: lock the look and the motion feel before producing 30 assets.
2. **Asset production**: prompt pack → you generate the figures → I vectorize, layer and clean them; hand-build the SVG objects.
3. **Full build**: all acts, the day-light arc, the waves, the intrusions, mobile layout.
4. **Polish**: reduced-motion pass, performance on a real phone, copy check against the hosted text, OG image refresh, deploy.

## Decisions needed

1. **Where it lives**: keep it standalone at `habit-ai.github.io/the-saddest-empires/`, or move it to `surprisal.to`
   (then it would take on the Surprisal ECAL fonts and gold, and lose the parchment identity)?
2. **Interactions**: include the two optional ones (the 90% glass slider, the typed final instruction), or keep it pure scroll?
3. **Figures**: generate the engraving-style figures yourself from my prompt pack, or should I do everything vector-only
   (more stylised, less painterly)?
4. **Text**: frozen as hosted, or is a "rework" pass (the roadmap calls it that) happening in parallel?

## After this: Because You Let Us

Same pipeline, a different world: film-still/cinematic rather than engraving (Tuscany sun → a remote farmhouse →
the quarry). Its through-line is **boundaries eroding one small step at a time**, a scroll-driven "line" that moves a few pixels
per transgression until it's gone. Plan it once Saddest Empires' style frames are locked.
