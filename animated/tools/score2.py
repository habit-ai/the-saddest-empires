"""The score for the type study, written as notes and played on sampled instruments.

    python3 score2.py cues-type.json out.wav

cues come from FILM.cues() (film.html?cut=type): scene starts, every line of text as it lands,
and named moments (pour, write, silence, land, pick). Rendered with fluidsynth and the FluidR3 GM
soundfont, then mixed with a little synthesised foley.

The idea in one line: an "empire" theme (A-G-F-D) opens in D minor and only resolves to D major on
"Pick it up."; the Line gains a layer as the servants multiply; the glass phrase stops one note short;
the letter is a cello alone, and "no cause." is silence.
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
sc = [s["t0"] for s in cues["scenes"]]
sd = [s["d"] for s in cues["scenes"]]
marks = cues["marks"]
M = lambda name: [m for m in marks if m["name"] == name]

# ---------------------------------------------------------------- notes
PIANO, STR, CELLO, CEL, HARP, BASS = 0, 1, 2, 3, 4, 5
PROGRAM = {PIANO: 0, STR: 49, CELLO: 42, CEL: 8, HARP: 46, BASS: 32}
events = []  # (time, channel, kind, a, b)


def note(ch, t, dur, pitch, vel):
    if t < 0 or t >= DUR:
        return
    events.append((t, ch, "on", pitch, max(1, min(127, int(vel)))))
    events.append((min(DUR, t + dur), ch, "off", pitch, 0))


def cc(ch, t, num, val):
    events.append((t, ch, "cc", num, int(val)))


def swell(ch, t0, t1, v0, v1, steps=24):
    for k in range(steps + 1):
        u = k / steps
        cc(ch, t0 + (t1 - t0) * u, 11, v0 + (v1 - v0) * (0.5 - 0.5 * np.cos(np.pi * u)))


N = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}


def p(name):
    return 12 * (int(name[-1]) + 1) + N[name[:-1]]


chords = []  # (t, [pitches]) — the harmony the landing notes follow


def pad(t, dur, names, vel=46):
    chords.append((t, [p(n) for n in names]))
    for n in names:
        note(STR, t, dur + 0.6, p(n), vel)


def chord_at(t):
    cur = chords[0][1]
    for ct, ps in sorted(chords):
        if ct <= t:
            cur = ps
    return cur


def motif(t, major=False, vel=52, step=0.62):
    names = ["A4", "G4", "F#4" if major else "F4", "D4"]
    for k, n in enumerate(names):
        note(PIANO, t + k * step, step * (3 if k == 3 else 1.1), p(n), vel - k * 2)
    note(PIANO, t + 3 * step, step * 3, p("D3"), vel - 12)


for ch in PROGRAM:
    cc(ch, 0, 91, 92)   # reverb send
    cc(ch, 0, 93, 18)   # chorus
    cc(ch, 0, 7, {PIANO: 100, STR: 92, CELLO: 74, CEL: 84, HARP: 88, BASS: 84}[ch])
    cc(ch, 0, 11, 110)

# I · card + morning
pad(sc[0] + 0.1, sc[1] + 9 - sc[0], ["D3", "A3", "F4"], 42)
swell(STR, sc[0], sc[0] + 3, 30, 100)
motif(sc[0] + 0.6)
# the rest of the morning moves slowly through the relative keys, however long the scene runs
mseq = [["Bb2", "F3", "D4"], ["F2", "C3", "A3"], ["G2", "D3", "Bb3"], ["Bb2", "D3", "F3"], ["A2", "E3", "C#4"]]
m0, m1 = sc[1] + 9, sc[2] + 1
step_m = (m1 - m0) / len(mseq)
for k, names in enumerate(mseq):
    pad(m0 + k * step_m, step_m, names, 40)
# II · card + Simon
pad(sc[2] + 0.2, sc[3] - sc[2] + 1, ["Eb3", "Bb3", "G4"], 40)
motif(sc[2] + 0.6, vel=44)
dim = M("dim")[0]["t"]
pad(sc[3] + 0.5, dim - sc[3] - 0.5, ["G2", "D3", "Bb3", "D4"], 42)
pad(dim, sc[4] + 1 - dim, ["A2", "E3", "G3", "C#4"], 46)
# II · the Line: an ostinato that gains a layer as the servants multiply
t0, d = sc[4], sd[4]
roots = [("D3", ["D3", "A3", "F4"]), ("Bb2", ["Bb2", "F3", "D4"]), ("F2", ["F2", "C3", "A3"]), ("C3", ["C3", "G3", "E4"])]
seg = d / 4
for k, (root, names) in enumerate(roots):
    pad(t0 + k * seg, seg, names, 34 + k * 5)
    if k >= 1:
        for b in np.arange(0, seg, 0.56):  # cello pulse
            note(CELLO, t0 + k * seg + b, 0.5, p(root) - 12, 50 + k * 4)
fig = ["D4", "A4", "F4", "A4"]
step = 0.28
t = t0 + 0.6
i = 0
while t < t0 + d - 0.8:
    u = (t - t0) / d
    root = roots[min(3, int((t - t0) / seg))][0]
    shift = p(root) - p("D3")
    shift = shift - 12 if shift > 6 else shift
    note(PIANO, t, step * 0.9, p(fig[i % 4]) + shift, 36 + 20 * u)
    if u > 0.55:
        note(PIANO, t, step * 0.9, p(fig[i % 4]) + shift + 12, 22 + 24 * (u - 0.55) / 0.45)
    if u > 0.75 and i % 2 == 0:
        note(CEL, t, 0.5, p(fig[(i + 1) % 4]) + shift + 24, 34)
    t += step
    i += 1
note(BASS, t0 + seg, d - seg, p("D2"), 40)
# III · card + the glass: a rising phrase that stops one note short
pad(sc[5] + 0.2, sc[6] - sc[5] + 1, ["F2", "C3", "A3"], 38)
note(PIANO, sc[5] + 0.6, 2.5, p("A4"), 44)
g0 = sc[6]
gap = M("gap")[0]["t"]
gseq = [["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["F2", "A2", "C3", "F3"], ["C3", "E3", "G3"]]
gstep = (gap - 3.6 - (g0 + 0.3)) / len(gseq)
for k, names in enumerate(gseq):
    pad(g0 + 0.3 + k * gstep, gstep, names, 36)
pad(gap - 3.6, 3.6, ["G2", "Bb2", "D3", "G3"], 38)
for k, n in enumerate(["D4", "E4", "F4", "G4", "A4", "Bb4"]):
    note(PIANO, gap - 3.3 + k * 0.52, 0.7, p(n), 40 + k * 3)
note(PIANO, gap, 5.5, p("C#5"), 58)                       # the leading tone, never resolved
pad(gap, sc[7] + 1 - gap, ["A2", "E3", "G3", "C#4"], 44)
# IV · the letter: a cello alone
pad(sc[7] + 0.2, sc[8] + 2 - sc[7], ["D2", "A2"], 30)
note(CELLO, sc[7] + 0.5, 4.0, p("D2"), 60)
silence = M("silence")[0]
cello = [("D3", 3.2), ("F3", 2.2), ("E3", 3.0), ("A2", 3.4), ("D3", 2.6), ("C#3", 3.4)]
t = sc[8] + 1.2
for n, dur in cello:
    if t + dur > silence["t"]:
        break
    note(CELLO, t, dur, p(n), 52)
    t += dur
chords.append((sc[8], [p("D3"), p("F3"), p("A3")]))
# V · card + the crown
pad(silence["t"] + silence["d"], sc[10] - silence["t"] - silence["d"] + 1.5, ["Bb2", "F3", "D4"], 38)
swell(STR, sc[9], sc[9] + 2.5, 40, 110)
land = M("land")[0]["t"]
pick = M("pick")[0]["t"]
pad(sc[10] + 1, land - sc[10] - 1, ["Bb2", "D3", "F3"], 36)
note(BASS, land, 3, p("D1") + 12, 70)
pad(land + 0.2, 5.5, ["F2", "C3", "A3"], 40)
pad(land + 5.7, pick - land - 5.7, ["G2", "D3", "Bb3", "D4"], 42)
pad(pick, DUR - pick, ["D2", "A2", "D3", "F#3", "A3", "D4"], 40)
motif(pick + 0.3, major=True, vel=58, step=0.75)
for k, n in enumerate(["A5", "D6", "F#6", "A6", "D7"]):
    note(CEL, pick + 0.2 + k * 0.16, 2.5, p(n), 40 - k * 3)
swell(STR, DUR - 7, DUR - 0.5, 110, 0)
swell(PIANO, DUR - 5, DUR - 0.5, 110, 0)

# every line of text lands on a soft note from the chord of the moment
for k, ln in enumerate(cues["lines"]):
    t = ln["t"]
    if silence["t"] - 0.2 < t < silence["t"] + silence["d"]:
        continue
    tones = sorted(set(x % 12 for x in chord_at(t)))
    pc = tones[k % len(tones)]
    pitch = 72 + pc if pc >= 2 else 84 + pc
    ch, vel = {"narrator": (HARP, 38), "quote": (HARP, 42), "hand": (CEL, 40)}[ln["voice"]]
    if ln["gold"]:
        vel += 12
        note(ch, t + 0.12, 2.2, pitch + 7, vel - 10)
    note(ch, t, 2.4, pitch, vel)

# ---------------------------------------------------------------- write MIDI
TPB = 480                    # tempo 60 bpm: one beat = one second
mid = mido.MidiFile(ticks_per_beat=TPB)
track = mido.MidiTrack(); mid.tracks.append(track)
track.append(mido.MetaMessage("set_tempo", tempo=1_000_000, time=0))
for ch, prog in PROGRAM.items():
    track.append(mido.Message("program_change", channel=ch, program=prog, time=0))
order = {"cc": 0, "off": 1, "on": 2}
last = 0
for t, ch, kind, a, b in sorted(events, key=lambda e: (e[0], order[e[2]])):
    tick = int(round(t * TPB))
    dt = tick - last
    last = tick
    if kind == "on":
        track.append(mido.Message("note_on", channel=ch, note=a, velocity=b, time=dt))
    elif kind == "off":
        track.append(mido.Message("note_off", channel=ch, note=a, velocity=0, time=dt))
    else:
        track.append(mido.Message("control_change", channel=ch, control=a, value=max(0, min(127, b)), time=dt))
mid.save(OUT + ".mid")
subprocess.run(["fluidsynth", "-ni", "-g", "0.45", "-r", str(SR),
                "-o", "synth.reverb.active=1", "-o", "synth.reverb.room-size=0.82", "-o", "synth.reverb.damp=0.35",
                "-o", "synth.reverb.width=0.9", "-o", "synth.reverb.level=0.7",
                "-F", OUT + ".music.wav", SF2, OUT + ".mid"], check=True, capture_output=True)

with wave.open(OUT + ".music.wav") as w:
    music = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(float) / 32768
n = int(DUR * SR)
mix = np.zeros((n, 2))
music_rms = np.sqrt(np.mean(music[np.abs(music).sum(axis=1) > 1e-4] ** 2))
mix[: min(n, len(music))] += music[:n] * (10 ** (-20 / 20) / music_rms)   # music first, at -20 dBFS; foley sits under it

# ---------------------------------------------------------------- foley, very quiet
rng = np.random.default_rng(5)


def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def put(sig, t, gain, pan=0.0):
    i0 = int(t * SR)
    if i0 >= n:
        return
    sig = sig[: n - i0]
    mix[i0:i0 + len(sig), 0] += sig * gain * (1 - pan) ** 0.5
    mix[i0:i0 + len(sig), 1] += sig * gain * (1 + pan) ** 0.5


def env(length, a=0.05, r=0.3):
    t = np.arange(length) / SR
    return np.minimum(1, t / a) * np.clip((length / SR - t) / r, 0, 1)


for m in M("card"):                       # a page turning
    L = int(0.7 * SR)
    x = rng.standard_normal(L)
    x = x - lowpass(x, 6)
    x = lowpass(x, 3) * env(L, 0.02, 0.5) * (0.5 + 0.5 * np.sin(np.linspace(0, 9, L)) ** 2)
    put(x, m["t"] - 0.1, 0.03, 0.3)
for m in M("pour"):                       # juice into a glass
    L = int((m["d"] + 0.4) * SR)
    x = lowpass(rng.standard_normal(L), 14) * (0.6 + 0.4 * np.sin(np.arange(L) / SR * 2 * np.pi * (9 + 5 * rng.random(L))))
    put(x * env(L, 0.15, 0.3), m["t"], 0.06, 0.4)
for m in M("write"):                      # a pen on paper
    L = int(m["d"] * SR)
    x = rng.standard_normal(L)
    x = x - lowpass(x, 5)
    strokes = (np.sin(np.arange(L) / SR * 2 * np.pi * 6.5 + rng.random() * 6) > 0.1).astype(float)
    strokes = lowpass(strokes, 400)
    put(x * strokes * env(L, 0.05, 0.2), m["t"], 0.012, -0.2)
for m in M("land"):                       # the crown on stone
    L = int(2.8 * SR)
    t = np.arange(L) / SR
    thud = np.sin(2 * np.pi * (46 + 30 * np.exp(-t * 18)) * t) * np.exp(-t * 4)
    ring = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * dcy) for f, a, dcy in
               ((523, 0.5, 2.2), (1241, 0.35, 3.0), (2017, 0.22, 4.5), (3140, 0.12, 6.0), (4410, 0.06, 8.0)))
    put(thud * 0.8 + ring * 0.25, m["t"], 0.28)

# ---------------------------------------------------------------- silence under "no cause."
t = np.arange(n) / SR
s0, s1 = silence["t"], silence["t"] + silence["d"]
gate = np.clip(1 - (t - s0) / 0.9, 0, 1) * (t >= s0) + (t < s0)
gate = np.where(t > s1, np.clip((t - s1) / 1.2, 0, 1), gate)
mix *= gate[:, None]

# ---------------------------------------------------------------- master
fade = np.clip(np.minimum(t / 1.2, (DUR - t) / 3.5), 0, 1)
mix *= fade[:, None]
loud = np.sqrt(np.mean(mix[mix.any(axis=1)] ** 2))
mix *= 10 ** (-19 / 20) / max(loud, 1e-9)          # about -19 dBFS RMS
mix = np.tanh(mix * 1.1) / np.tanh(1.1)             # a soft ceiling
pcm = (np.clip(mix, -1, 1) * 32767 * 0.95).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", OUT, f"{DUR:.1f}s", "peak", float(np.abs(mix).max()))
