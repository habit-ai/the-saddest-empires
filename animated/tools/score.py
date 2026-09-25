"""A quiet ambient score for the film, synthesised from scratch (no samples).

    python3 score.py cues.json out.wav

cues.json comes from FILM.cues() in film.js: scene start times plus a few named moments.
"""
import json
import sys

import numpy as np

SR = 44100
cues = json.load(open(sys.argv[1]))
DUR = cues["duration"] + 1.0
N = int(DUR * SR)
t_all = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(7)


def hz(note):
    names = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4, "F#": -3,
             "Gb": -3, "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    n, o = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + (o - 4) * 12) / 12)


def add(sig, start, pan=0.0, gain=1.0):
    i0 = int(start * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0]
    L[i0:i0 + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i0:i0 + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))


def pad(notes, start, length, gain=0.05, bright=0.25):
    """a slow, breathing chord: detuned sines with a touch of second harmonic"""
    n = int((length + 4) * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 3.0) * np.clip((length + 4 - t) / 4.0, 0, 1)
    env *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.11 * t + rng.random() * 6)
    for k, note in enumerate(notes):
        f = hz(note)
        for det, p in ((-0.18, -0.6), (0.0, 0.0), (0.21, 0.6)):
            ph = rng.random() * 6.28
            s = np.sin(2 * np.pi * (f + det) * t + ph) + bright * np.sin(2 * np.pi * 2 * (f + det) * t + ph)
            add(s * env / len(notes), start, pan=p * 0.7, gain=gain)


def bell(note, start, gain=0.06, decay=3.2, pan=0.0):
    f = hz(note)
    n = int(decay * 2.5 * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, d in ((1, 1, 1), (2.01, 0.35, 0.7), (2.76, 0.28, 0.5), (5.4, 0.12, 0.25)):
        s += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (decay * d))
    s *= np.minimum(1, t / 0.004)
    add(s, start, pan=pan, gain=gain)


def thud(start, gain=0.5):
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (48 + 30 * np.exp(-t * 18)) * t) * np.exp(-t * 3.2)
    noise = rng.standard_normal(n) * np.exp(-t * 20)
    noise = np.convolve(noise, np.ones(40) / 40, mode="same")  # dull it
    add(body * 0.9 + noise * 0.8, start, gain=gain)


sc = cues["scenes"]
night, first = cues["night"], cues["firstLight"]
SHORT = cues.get("cut") == "type"

# the harmony follows the essay's day: morning, argument, dusk, night, first light
plan = [
    (0, ["D3", "A3", "F4"]), (8.5, ["Bb2", "F3", "D4"]), (19.5, ["F2", "C3", "A3", "F4"]), (25.5, ["D3", "A3", "F4"]),
    (35, ["Bb2", "D3", "F4"]), (44, ["G2", "D3", "Bb3"]), (55, ["D3", "F3", "A3"]), (65, ["C3", "G3", "E4"]),
    (74, ["Bb2", "F3", "D4"]), (83, ["G2", "D3", "Bb3", "F4"]), (91, ["A2", "E3", "C#4"]), (97, ["D3", "A3", "F4"]),
    (111.5, ["G2", "D3", "Bb3"]), (119, ["Eb3", "Bb3", "G4"]), (126, ["Bb2", "F3", "D4"]), (136.5, ["F2", "C3", "A3"]),
    (145.5, ["G2", "D3", "Bb3", "D4"]), (158, ["Eb3", "G3", "Bb3"]), (164.5, ["C3", "G3", "Eb4"]),
]
if SHORT:  # the type study: one chord family per scene, night and first light as in the film
    plan = [(sc[0], ["D3", "A3", "F4"]), (sc[0] + 7, ["Bb2", "F3", "D4"]), (sc[1], ["F2", "C3", "A3", "F4"]),
            (sc[1] + 9, ["C3", "G3", "E4"]), (sc[2], ["G2", "D3", "Bb3", "F4"]), (sc[2] + 9, ["A2", "E3", "C#4"])]
for i, (start, notes) in enumerate(plan):
    end = plan[i + 1][0] if i + 1 < len(plan) else night
    pad(notes, start, end - start + 1.5, gain=0.05)

# night: a low drone and a high open fifth, almost nothing
pad(["D2", "A2"], night - 2, first - night + 2, gain=0.045, bright=0.1)
pad(["A4", "E5"], night + 1, first - night - 1, gain=0.012, bright=0.0)

# first light: it resolves, but only just
pad(["Bb2", "F3", "D4"], first, 5.5, gain=0.05)
pad(["F2", "C3", "A3", "E4"], first + 5, 6.5, gain=0.05)
pad(["G2", "D3", "Bb3", "D4"], first + 11, 5.5, gain=0.05)
pad(["D2", "A2", "D3", "F#3", "A3"], first + 16, DUR - first - 17, gain=0.058)

# a drone under everything that is not night
drone_t = t_all
drone = np.sin(2 * np.pi * hz("D2") * drone_t) * 0.018
drone *= np.clip(np.minimum(drone_t / 4, (DUR - drone_t) / 5), 0, 1)
L += drone
R += drone

# bells mark each new scene, quieter at night
chord_tones = ["D5", "A4", "F5", "C5", "D5", "E5", "A5", "F5"]
for i, s in enumerate(sc[1:], 1):
    if abs(s - first) < 0.1:
        continue
    at_night = night - 3 < s < first
    bell(chord_tones[i % len(chord_tones)], s + 0.35, gain=0.03 if at_night else 0.045, pan=(i % 3 - 1) * 0.4)

# title shimmer, crown landing, "Pick it up."
for k, n in enumerate(["D5", "F5", "A5", "D6"]):
    bell(n, cues["title"] + k * 0.18, gain=0.035, pan=(k - 1.5) * 0.3)
thud(cues["crownLand"], gain=0.3)
for k, n in enumerate(["A4", "D5", "F#5", "A5"]):
    bell(n, cues["pick"] + k * 0.45, gain=0.05, decay=4.5, pan=(k - 1.5) * 0.25)

# reverb: convolve with a decaying-noise hall, a little different in each ear
def hall(seed):
    r = np.random.default_rng(seed)
    n = int(3.8 * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / 0.9)
    ir = np.convolve(ir, np.ones(6) / 6, mode="same")
    return ir / np.sqrt(np.sum(ir ** 2))


def convolve(x, h):
    m = len(x) + len(h) - 1
    size = 1 << (m - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(h, size), size)[: len(x)]


wetL, wetR = convolve(L, hall(1)), convolve(R, hall(2))
mixL, mixR = L * 0.55 + wetL * 0.45, R * 0.55 + wetR * 0.45

# fade and normalise
fade = np.clip(np.minimum(t_all / 1.5, (DUR - t_all) / 3.0), 0, 1)
mixL *= fade
mixR *= fade
peak = max(np.abs(mixL).max(), np.abs(mixR).max())
mixL, mixR = mixL / peak * 0.7, mixR / peak * 0.7

pcm = (np.stack([mixL, mixR], axis=1) * 32767).astype(np.int16)
import wave
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[2], f"{DUR:.1f}s")
