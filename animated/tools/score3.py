"""The score for the story cut (film.html?cut=story), written as notes and played on sampled instruments.

    python3 score3.py cues-story.json out.wav

Sections follow the film's named scenes. The empire theme (A-G-F-D) is heard first as a music box when
the story is offered, opens the book, and only resolves to D major on "Pick it up." as the book closes.
The Line gains layers as the servants multiply, the glass phrase stops one note short, the letter is a
cello alone, and "no cause." is silence. Each passage of narration begins on a soft note.
"""
import json
import subprocess
import sys
import wave

import mido
import numpy as np

SR = 44100
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
cues = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
DUR = cues["duration"] + 1.5
S = {s["name"]: s for s in cues["scenes"]}
t0 = lambda n: S[n]["t0"]
t1 = lambda n: S[n]["t0"] + S[n]["d"]
marks = cues["marks"]
M = lambda name: [m for m in marks if m["name"] == name]

PIANO, STR, CELLO, CEL, HARP, BASS, BOX = 0, 1, 2, 3, 4, 5, 6
PROGRAM = {PIANO: 0, STR: 49, CELLO: 42, CEL: 8, HARP: 46, BASS: 32, BOX: 10}
events, chords = [], []


def note(ch, t, dur, pitch, vel):
    if t < 0 or t >= DUR:
        return
    events.append((t, ch, "on", pitch, max(1, min(127, int(vel)))))
    events.append((min(DUR, t + dur), ch, "off", pitch, 0))


def cc(ch, t, num, val):
    events.append((t, ch, "cc", num, int(val)))


def swell(ch, a, b, v0, v1, steps=24):
    for k in range(steps + 1):
        u = k / steps
        cc(ch, a + (b - a) * u, 11, v0 + (v1 - v0) * (0.5 - 0.5 * np.cos(np.pi * u)))


N = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
p = lambda name: 12 * (int(name[-1]) + 1) + N[name[:-1]]


def pad(t, dur, names, vel=40):
    chords.append((t, [p(n) for n in names]))
    for n in names:
        note(STR, t, dur + 0.6, p(n), vel)


def pads(a, b, seq, vel=40):
    step = (b - a) / len(seq)
    for k, names in enumerate(seq):
        pad(a + k * step, step, names, vel)


def chord_at(t):
    cur = chords[0][1]
    for ct, ps in sorted(chords):
        if ct <= t:
            cur = ps
    return cur


def motif(t, ch=PIANO, major=False, vel=52, step=0.62, octave=0):
    names = ["A4", "G4", "F#4" if major else "F4", "D4"]
    for k, n in enumerate(names):
        note(ch, t + k * step, step * (3 if k == 3 else 1.1), p(n) + 12 * octave, vel - k * 2)
    if ch == PIANO:
        note(PIANO, t + 3 * step, step * 3, p("D3"), vel - 12)


def arpeggio(t, names, ch=HARP, gap=0.09, vel=40, dur=2.5):
    for k, n in enumerate(names):
        note(ch, t + k * gap, dur, p(n), vel)


for ch in PROGRAM:
    cc(ch, 0, 91, 92); cc(ch, 0, 93, 16)
    cc(ch, 0, 7, {PIANO: 100, STR: 90, CELLO: 74, CEL: 82, HARP: 88, BASS: 84, BOX: 70}[ch]); cc(ch, 0, 11, 110)

# PROLOGUE: a music box offers the story; the book opens on a harp
pad(0.2, M("open")[0]["t"] - 0.2, ["D3", "A3", "F4"], 34)
swell(STR, 0, 4, 20, 100)
motif(M("title")[0]["t"], ch=BOX, vel=60, step=0.55, octave=1)
op = M("open")[0]["t"]
arpeggio(op, ["D3", "A3", "D4", "F4", "A4", "D5", "F5", "A5"], vel=44)
pad(op, t1("prologue") - op + 0.5, ["Bb2", "F3", "D4"], 38)
# FIRST PAGE: the theme on the piano, then a rising swell as the camera travels into the plate
motif(t0("firstpage") + 0.4, vel=48)
zoom_in = M("zoom")[0]
pads(t0("firstpage"), zoom_in["t"], [["D3", "A3", "F4"], ["G2", "D3", "Bb3"]], 36)
pad(zoom_in["t"], zoom_in["d"] + 0.8, ["A2", "E3", "A3", "C#4"], 40)
swell(STR, zoom_in["t"], zoom_in["t"] + zoom_in["d"], 60, 118)
arpeggio(zoom_in["t"] + zoom_in["d"] - 1.0, ["A3", "C#4", "E4", "A4", "C#5", "E5"], gap=0.14, vel=38)
# MORNING
pads(t0("morning"), t1("morning"), [["D3", "A3", "F4"], ["Bb2", "F3", "D4"], ["F2", "C3", "A3"], ["G2", "D3", "Bb3"]], 38)
# SIMON: the candle; tension arrives with "poverty of attention"
dim = M("dim")[0]["t"]
pads(t0("simon"), dim, [["Eb3", "Bb3", "G4"], ["G2", "D3", "Bb3", "D4"]], 40)
pad(dim, t1("simon") - dim, ["A2", "E3", "G3", "C#4"], 44)
# THE LINE: an ostinato that gains a layer as the servants multiply
a, d = t0("line"), S["line"]["d"]
roots = [("D3", ["D3", "A3", "F4"]), ("Bb2", ["Bb2", "F3", "D4"]), ("F2", ["F2", "C3", "A3"]), ("C3", ["C3", "G3", "E4"])]
seg = d / 4
for k, (root, names) in enumerate(roots):
    pad(a + k * seg, seg, names, 34 + k * 5)
    if k >= 1:
        for b in np.arange(0, seg, 0.56):
            note(CELLO, a + k * seg + b, 0.5, p(root) - 12, 48 + k * 4)
fig, step, t, i = ["D4", "A4", "F4", "A4"], 0.28, a + 0.6, 0
while t < a + d - 0.8:
    u = (t - a) / d
    root = roots[min(3, int((t - a) / seg))][0]
    sh = p(root) - p("D3"); sh = sh - 12 if sh > 6 else sh
    note(PIANO, t, step * 0.9, p(fig[i % 4]) + sh, 34 + 20 * u)
    if u > 0.55:
        note(PIANO, t, step * 0.9, p(fig[i % 4]) + sh + 12, 20 + 24 * (u - 0.55) / 0.45)
    if u > 0.75 and i % 2 == 0:
        note(CEL, t, 0.5, p(fig[(i + 1) % 4]) + sh + 24, 32)
    t += step; i += 1
note(BASS, a + seg, d - seg, p("D2"), 40)
# THE GLASS: a rising phrase that stops one note short
gap = M("gap")[0]["t"]
pads(t0("glass"), gap - 3.6, [["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["F2", "A2", "C3", "F3"], ["C3", "E3", "G3"]], 36)
pad(gap - 3.6, 3.6, ["G2", "Bb2", "D3", "G3"], 38)
for k, n in enumerate(["D4", "E4", "F4", "G4", "A4", "Bb4"]):
    note(PIANO, gap - 3.3 + k * 0.52, 0.7, p(n), 40 + k * 3)
note(PIANO, gap, 5.5, p("C#5"), 58)
pad(gap, t1("glass") - gap + 0.5, ["A2", "E3", "G3", "C#4"], 44)
# THE LETTER: a cello alone, then silence
silence = M("silence")[0]
pad(t0("letter"), silence["t"] - t0("letter"), ["D2", "A2"], 30)
t = t0("letter") + 1.0
for n, dur in [("D3", 3.2), ("F3", 2.2), ("E3", 3.0), ("A2", 3.4), ("D3", 2.6), ("C#3", 3.4), ("D3", 3.0), ("E3", 3.0)]:
    if t + dur > silence["t"]:
        break
    note(CELLO, t, dur, p(n), 52); t += dur
chords.append((t0("letter"), [p("D3"), p("F3"), p("A3")]))
# THE CROWN
land = M("land")[0]["t"]
pad(silence["t"] + silence["d"], land - silence["t"] - silence["d"], ["Bb2", "D3", "F3"], 36)
note(BASS, land, 3, p("D2"), 70)
pad(land + 0.2, t1("crown") - land, ["F2", "C3", "A3"], 40)
# EPILOGUE: back out into the book; the theme resolves on "Pick it up."; the book closes
zo = M("zoom")[-1]
arpeggio(zo["t"] + 0.3, ["A5", "F5", "D5", "A4", "F4", "D4"], gap=0.16, vel=34)
pick = M("pick")[0]["t"]
pad(zo["t"], pick - zo["t"], ["G2", "D3", "Bb3", "D4"], 40)
pad(pick, DUR - pick, ["D2", "A2", "D3", "F#3", "A3", "D4"], 42)
motif(pick + 0.4, major=True, vel=58, step=0.75)
for k, n in enumerate(["A5", "D6", "F#6", "A6", "D7"]):
    note(CEL, pick + 0.2 + k * 0.16, 2.5, p(n), 38 - k * 3)
close = M("close")[0]["t"]
motif(close + 1.8, ch=BOX, major=True, vel=50, step=0.6, octave=1)
swell(STR, DUR - 6, DUR - 0.5, 110, 0); swell(PIANO, DUR - 5, DUR - 0.5, 110, 0)

# each passage of narration begins on a soft note from the chord of the moment
for k, ps in enumerate(cues["passages"]):
    t = ps["t"]
    if silence["t"] - 0.2 < t < silence["t"] + silence["d"]:
        continue
    tones = sorted(set(x % 12 for x in chord_at(t)))
    pc = tones[k % len(tones)]
    pitch = 72 + pc if pc >= 2 else 84 + pc
    ch, vel = {"narrator": (HARP, 40), "quote": (HARP, 44), "hand": (CEL, 40)}[ps["voice"]]
    note(ch, t, 2.4, pitch, vel)
    if ps["gold"]:
        note(ch, ps["end"] - 0.4, 2.4, pitch + 7, vel - 4)

# ---------------------------------------------------------------- render
TPB = 480
mid = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mid.tracks.append(tr)
tr.append(mido.MetaMessage("set_tempo", tempo=1_000_000, time=0))
for ch, prog in PROGRAM.items():
    tr.append(mido.Message("program_change", channel=ch, program=prog, time=0))
order = {"cc": 0, "off": 1, "on": 2}
last = 0
for t, ch, kind, x, y in sorted(events, key=lambda e: (e[0], order[e[2]])):
    tick = int(round(t * TPB)); dt = tick - last; last = tick
    if kind == "on":
        tr.append(mido.Message("note_on", channel=ch, note=x, velocity=y, time=dt))
    elif kind == "off":
        tr.append(mido.Message("note_off", channel=ch, note=x, velocity=0, time=dt))
    else:
        tr.append(mido.Message("control_change", channel=ch, control=x, value=max(0, min(127, y)), time=dt))
mid.save(OUT + ".mid")
subprocess.run(["fluidsynth", "-ni", "-g", "0.45", "-r", str(SR), "-o", "synth.reverb.active=1", "-o", "synth.reverb.room-size=0.82",
                "-o", "synth.reverb.damp=0.35", "-o", "synth.reverb.width=0.9", "-o", "synth.reverb.level=0.7",
                "-F", OUT + ".music.wav", SF2, OUT + ".mid"], check=True, capture_output=True)
with wave.open(OUT + ".music.wav") as w:
    music = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(float) / 32768
n = int(DUR * SR)
mix = np.zeros((n, 2))
rms = np.sqrt(np.mean(music[np.abs(music).sum(axis=1) > 1e-4] ** 2))
mix[: min(n, len(music))] += music[:n] * (10 ** (-20 / 20) / rms)

# ---------------------------------------------------------------- foley, quiet
rng = np.random.default_rng(5)
lowpass = lambda x, k: np.convolve(x, np.ones(k) / k, mode="same")


def put(sig, t, gain, pan=0.0):
    i0 = int(t * SR)
    if i0 >= n:
        return
    sig = sig[: n - i0]
    mix[i0:i0 + len(sig), 0] += sig * gain * (1 - pan) ** 0.5
    mix[i0:i0 + len(sig), 1] += sig * gain * (1 + pan) ** 0.5


def env(length, a=0.05, r=0.3):
    tt = np.arange(length) / SR
    return np.minimum(1, tt / a) * np.clip((length / SR - tt) / r, 0, 1)


def paper_sound(t, length=0.8, gain=0.03, pan=0.2):
    L_ = int(length * SR); x = rng.standard_normal(L_); x = x - lowpass(x, 6)
    x = lowpass(x, 3) * env(L_, 0.02, 0.5) * (0.5 + 0.5 * np.sin(np.linspace(0, 9, L_)) ** 2)
    put(x, t, gain, pan)


def thud(t, gain, ring=True):
    L_ = int(2.8 * SR); tt = np.arange(L_) / SR
    body = np.sin(2 * np.pi * (46 + 30 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 4)
    r = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt * dc) for f, a, dc in ((523, 0.5, 2.2), (1241, 0.35, 3.0), (2017, 0.22, 4.5), (3140, 0.12, 6.0))) if ring else 0
    put(body * 0.8 + (r * 0.25 if ring else 0), t, gain)


paper_sound(M("open")[0]["t"], 1.4, 0.04)          # the cover lifting
for m in M("card"):
    paper_sound(m["t"], 0.9, 0.035)                  # the page turning
thud(M("close")[0]["t"] + 2.3, 0.22, ring=False)   # the book shutting
for m in M("pour"):
    L_ = int((m["d"] + 0.4) * SR)
    x = lowpass(rng.standard_normal(L_), 14) * (0.6 + 0.4 * np.sin(np.arange(L_) / SR * 2 * np.pi * (9 + 5 * rng.random(L_))))
    put(x * env(L_, 0.15, 0.3), m["t"], 0.06, 0.4)
for m in M("write"):
    L_ = int(m["d"] * SR); x = rng.standard_normal(L_); x = x - lowpass(x, 5)
    strokes = lowpass((np.sin(np.arange(L_) / SR * 2 * np.pi * 6.5 + rng.random() * 6) > 0.1).astype(float), 400)
    put(x * strokes * env(L_, 0.05, 0.2), m["t"], 0.012, -0.2)
thud(land, 0.28)

tt = np.arange(n) / SR
s0, s1 = silence["t"], silence["t"] + silence["d"]
gate = np.where(tt < s0, 1.0, np.clip(1 - (tt - s0) / 0.9, 0, 1))
gate = np.where(tt > s1, np.clip((tt - s1) / 1.2, 0, 1), gate)
mix *= gate[:, None]
fade = np.clip(np.minimum(tt / 1.2, (DUR - tt) / 3.5), 0, 1)
mix *= fade[:, None]
loud = np.sqrt(np.mean(mix[mix.any(axis=1)] ** 2))
mix *= 10 ** (-19 / 20) / max(loud, 1e-9)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
pcm = (np.clip(mix, -1, 1) * 32767 * 0.95).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", OUT, f"{DUR:.1f}s")
