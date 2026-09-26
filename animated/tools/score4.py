"""The score for the opening (film.html?cut=opening), derived from the story-cut score.

The score for the story cut (film.html?cut=story), written as notes and played on sampled instruments.

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

PIANO, STR, CELLO, CEL, HARP, BASS, BOX, HORN, TIMP, CHOIR = 0, 1, 2, 3, 4, 5, 6, 7, 8, 10
PROGRAM = {PIANO: 0, STR: 49, CELLO: 42, CEL: 8, HARP: 46, BASS: 32, BOX: 10, HORN: 60, TIMP: 47, CHOIR: 52}
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
    cc(ch, 0, 7, {PIANO: 100, STR: 90, CELLO: 74, CEL: 82, HARP: 88, BASS: 84, BOX: 70, HORN: 78, TIMP: 84, CHOIR: 64}[ch]); cc(ch, 0, 11, 110)

m1 = lambda name: M(name)[0]["t"]
# PROLOGUE: silence, a match, then a low string breath and the theme on a music box
strike, title, op = m1("strike"), m1("title"), m1("open")
pad(strike + 0.4, op - strike - 0.4, ["D2", "A2", "D3"], 40)
swell(STR, strike, strike + 5, 10, 90)
motif(title + 0.4, ch=BOX, vel=62, step=0.62, octave=1)
motif(title + 4.6, ch=BOX, vel=56, step=0.62, octave=1)
arpeggio(op, ["D3", "A3", "D4", "F4", "A4", "D5", "F5", "A5", "D6"], gap=0.1, vel=46)
pad(op, m1("begins") - op, ["Bb2", "F3", "D4", "F4"], 40)
swell(STR, op, op + 2.4, 60, 115)
begins = m1("begins")
pad(begins, M("zoom")[0]["t"] - begins, ["G2", "D3", "Bb3"], 36)
for k, n in enumerate(["D5", "F5", "A5"]):
    note(PIANO, begins + 0.4 + k * 0.7, 2.2, p(n), 42)
zi = M("zoom")[0]
pad(zi["t"], zi["d"] + 0.8, ["A2", "E3", "A3", "C#4"], 42)
swell(STR, zi["t"], zi["t"] + zi["d"], 50, 120)
note(TIMP, zi["t"] + zi["d"] - 1.2, 1.4, p("A2"), 50)
# THE THRONE: the court, in full; everything builds to the bow, then stops dead
th, bow, cut = m1("throne"), m1("bow"), m1("cut")
pad(th, 7, ["D2", "A2", "D3", "F3", "A3"], 50)
for n in ["D3", "A3", "F4"]:
    note(CHOIR, th, 7, p(n), 44)
motif(th + 0.3, ch=HORN, vel=66, step=0.9)
note(HORN, th + 0.3 + 2.7, 3, p("D3"), 60)
note(BASS, th, cut - th, p("D2"), 56)
seq = [["Bb2", "F3", "D4"], ["G2", "D3", "Bb3", "D4"], ["F2", "C3", "A3", "F4"], ["A2", "E3", "C#4", "A4"]]
step_t = (bow - (th + 7)) / len(seq)
for k, names in enumerate(seq):
    pad(th + 7 + k * step_t, step_t, names, 44 + k * 4)
    for n in names[1:3]:
        note(CHOIR, th + 7 + k * step_t, step_t, p(n), 36 + k * 4)
swell(STR, th + 7, bow, 70, 108); swell(CHOIR, th + 7, bow, 60, 104)
for r in np.arange(bow - 3.0, bow, 0.09):                 # a timpani roll into the bow
    note(TIMP, r, 0.12, p("A2"), 30 + 60 * (r - (bow - 3.0)) / 3.0)
pad(bow, cut - bow - 0.3, ["D2", "A2", "D3", "F#3", "A3", "D4"], 54)   # the court bows: a major chord, the only one until the end
for n in ["D3", "F#3", "A3", "D4"]:
    note(HORN, bow, cut - bow - 0.3, p(n), 58); note(CHOIR, bow, cut - bow - 0.3, p(n), 46)
note(TIMP, bow, 1.5, p("D2"), 80)
# THE BED: a small room, a small sound
bed, dark, earn = m1("bed"), m1("dark"), m1("earn")
pad(bed + 1.2, dark - bed - 1.2, ["D3", "A3"], 36)
t = bed + 1.6
for n in ["A5", "F5", "D5", "E5", "C5", "D5"]:
    note(PIANO, t, 2.4, p(n), 46); t += 2.6
arpeggio(dark, ["D5", "F5", "A5", "D6", "F6", "A6"], ch=CEL, gap=0.35, vel=48, dur=3)
pad(dark, earn - dark, ["Bb2", "F3", "D4"], 42)
note(PIANO, earn, 6, p("D2"), 64); note(PIANO, earn, 6, p("A2"), 52); note(PIANO, earn, 6, p("F3"), 46)
pad(earn, DUR - earn, ["D2", "A2", "F3"], 40)
swell(STR, DUR - 5, DUR - 0.5, 110, 0); swell(PIANO, DUR - 4, DUR - 0.5, 110, 0)
silence = {"t": cut, "d": 1.3}
chords.append((0, [p("D3"), p("F3"), p("A3")]))

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


paper_sound(M("open")[0]["t"], 1.6, 0.05)          # the cover lifting
rf = M("riffle")[0]
for k in range(6):
    paper_sound(rf["t"] + k * 0.2 + 0.3, 0.35, 0.03, pan=0.3 - k * 0.1)   # the pages riffling
# the match: a scrape and a flare
L_ = int(0.6 * SR); x = rng.standard_normal(L_); x = x - lowpass(x, 3)
put(x * env(L_, 0.01, 0.4) * np.exp(-np.arange(L_) / SR * 5), M("strike")[0]["t"] - 0.05, 0.05, 0.4)
L_ = int(1.2 * SR); x = lowpass(rng.standard_normal(L_), 30)
put(x * env(L_, 0.08, 0.9), M("strike")[0]["t"] + 0.1, 0.1, 0.4)
# the court bowing: a great rustle of robes
L_ = int(2.4 * SR); x = lowpass(rng.standard_normal(L_), 8)
put(x * env(L_, 0.5, 1.2), M("bow")[0]["t"] - 0.2, 0.05)
for m in []:
    L_ = int((m["d"] + 0.4) * SR)
    x = lowpass(rng.standard_normal(L_), 14) * (0.6 + 0.4 * np.sin(np.arange(L_) / SR * 2 * np.pi * (9 + 5 * rng.random(L_))))
    put(x * env(L_, 0.15, 0.3), m["t"], 0.06, 0.4)
for m in []:
    L_ = int(m["d"] * SR); x = rng.standard_normal(L_); x = x - lowpass(x, 5)
    strokes = lowpass((np.sin(np.arange(L_) / SR * 2 * np.pi * 6.5 + rng.random() * 6) > 0.1).astype(float), 400)
    put(x * strokes * env(L_, 0.05, 0.2), m["t"], 0.012, -0.2)

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
