"""Build one deliverable: python3 build.py full|short|vertical [--preview]

1. builds the edit decision list (scenes, audio events, captions) from the
   chosen narration takes (03_VOICEOVER/narration_qc.json),
2. renders every scene in parallel to 07_PREVIEWS/segments/<video>/,
3. mixes the audio (narration, interview, song excerpts, score with ducking),
4. writes English captions (.srt + .ass) and burns them in,
5. encodes H.264/AAC with loudness normalisation to 08_FINAL_EXPORTS.
"""
import os, sys, json, math, subprocess, multiprocessing as mp
import numpy as np
from lib import *
from scenes import *
from script_data import FULL, SHORT, BITES

VO = os.path.join(ROOT, "03_VOICEOVER")
QC = json.load(open(os.path.join(VO, "narration_qc.json")))
SR = 48000
MUSIC = os.path.join(ROOT, "05_AUDIO", "BACKGROUND_MUSIC")
SFX = os.path.join(ROOT, "05_AUDIO", "SOUND_EFFECTS")


def secs_text(sec):
    return (FULL.get(sec) or SHORT.get(sec))


class TL:
    def __init__(self, name, W, H):
        self.name, self.W, self.H = name, W, H
        self.scenes, self.audio, self.caps, self.music = [], [], [], []
        self.t = 0.0
        self.notes = []

    # ---- picture
    def add(self, sc):
        sc.t0 = self.t          # position on the timeline (sc.start is the source seek point)
        self.scenes.append(sc)
        self.t += sc.dur
        return sc

    def S(self, cls, dur, **kw):
        return self.add(cls(dur, self.W, self.H, **kw))

    # ---- sound
    def vo(self, sec, at):
        q = QC[sec]
        f = os.path.join(ROOT, q["file"])
        self.audio.append(dict(kind="vo", file=f, src=0.0, dur=q["duration"], at=at, gain=1.0))
        b = q["sentence_bounds"]
        for i, (hi, en) in enumerate(secs_text(sec)):
            self.cap(at + b[i], at + b[i + 1], en)
        return q["duration"], [at + x for x in b]

    def vo_part(self, sec, i0, i1, at):
        """Place sentences i0..i1-1 of a narration file (split at the sentence pause)."""
        q = QC[sec]
        b = q["sentence_bounds"]
        f = os.path.join(ROOT, q["file"])
        self.audio.append(dict(kind="vo", file=f, src=b[i0], dur=b[i1] - b[i0], at=at, gain=1.0, fin=0.05, fout=0.08))
        for i in range(i0, i1):
            self.cap(at + b[i] - b[i0], at + b[i + 1] - b[i0], secs_text(sec)[i][1])
        return b[i1] - b[i0]

    def bite(self, name, at, s=None, e=None, caps=True):
        s0, e0, bn, subs = BITES[name]
        s = s0 if s is None else s
        e = e0 if e is None else e
        self.audio.append(dict(kind="bite", file=INTERVIEW, src=s, dur=e - s, at=at, gain=1.0))
        if caps:
            for cs, ce, en in subs:
                cs2, ce2 = max(cs, s), min(ce, e)
                if ce2 - cs2 > 0.4:
                    self.cap(at + cs2 - s, at + ce2 - s, en)
        return e - s

    def song(self, src, s, dur, at, gain=1.0, fin=0.25, fout=0.6):
        self.audio.append(dict(kind="song", file=src, src=s, dur=dur, at=at, gain=gain, fin=fin, fout=fout))

    def sfx(self, name, at, gain=1.0):
        self.audio.append(dict(kind="sfx", file=os.path.join(SFX, name), src=0.0, dur=None, at=at, gain=gain))

    def cap(self, s, e, text):
        maxc = 84 if self.W > self.H else 52
        if len(text) <= maxc:
            self.caps.append((s, e, text))
            return
        # split at a comma or space nearest the middle, timing by characters
        mid = len(text) // 2
        commas = [i for i, c in enumerate(text) if c in ",;." and abs(i - mid) < len(text) * 0.22]
        spaces = [i for i, c in enumerate(text) if c == " "]
        k = min(commas or spaces, key=lambda i: abs(i - mid))
        a, b = text[:k + 1].strip(), text[k + 1:].strip()
        if a.endswith(","):
            a = a[:-1]
        tm = s + (e - s) * len(a) / (len(a) + len(b))
        self.cap(s, tm, a)
        self.cap(tm, e, b[0].upper() + b[1:] if b and a.endswith(".") else b)

    def bed(self, track, src, at, dur, gain=1.0):
        self.music.append(dict(file=os.path.join(MUSIC, track), src=src, at=at, dur=dur, gain=gain))


# =============================================================================
def vo_len(sec):
    return QC[sec]["duration"]


def sent(sec, i):
    b = QC[sec]["sentence_bounds"]
    return b[i], b[i + 1]


def edl_full():
    tl = TL("full", 1920, 1080)
    S = tl.S
    LT = "Singer · Chebri, Khowai, Tripura"
    # ---------------- CHAPTER 1: HOOK ----------------
    t0 = tl.t
    a, b = sent("F01", 0)
    S(FileScene, 0.9 + b + 0.6, src=os.path.join(MAPS, "map_intro.mp4"), bug=False)
    tl.vo("F01", t0 + 0.9)
    s2_end = t0 + 0.9 + vo_len("F01")
    sc = S(PhotoScene, s2_end - tl.t + 1.2, photo="red", layout="right", z0=1.0, z1=1.07, c0=(0.5, 0.4), c1=(0.47, 0.36),
           overlays=[side_text_overlay("SOUMEE SAILESH", "Playback singer from Tripura", side="left", start=0.3)])
    # song teaser (official video), song audio featured
    st = tl.t
    S(OfficialScene, 4.2, src=OFFICIAL, start=0.6, overlays=[tag_overlay(OfficialScene.label)])
    tl.song(OFFICIAL, 0.6, 4.2 + 3.4, st, gain=1.0, fin=0.15, fout=1.2)
    # poster + F02 s1 (song continues low under narration)
    pt = tl.t
    a, b = sent("F02", 0)
    S(PromoScene, b + 1.1, part="poster", start=7.0, overlays=[tag_overlay(PromoScene.label)])
    tl.vo("F02", pt + 0.5)
    a2, b2 = sent("F02", 1)
    S(PhotoScene, pt + 0.5 + b2 - tl.t + 1.4, photo="jacket", layout="full", z0=1.0, z1=1.1, c0=(0.5, 0.3), c1=(0.5, 0.26))
    S(TitleCard, 8.5, photo="mic", lines=[("FROM TRIPURA TO BOLLYWOOD", "big"), ("Soumee Sailesh's journey to a Salman Khan film", "small")], fout=0.6)
    tl.sfx("riser.wav", tl.t - 9.1, 0.6)
    ch1_end = tl.t

    # ---------------- CHAPTER 2: ROOTS ----------------
    def slate(num, title, photo):
        st = tl.t
        S(ChapterSlate, 5.0, num=num, title=title, photo=photo, fin=0.4)
        tl.sfx("whoosh.wav", st + 0.1, 0.7)

    slate(2, "ROOTS AND MUSICAL FOUNDATION", "jacket")
    bt = tl.t
    d = tl.bite("B1", bt + 0.3)
    S(InterviewScene, d + 0.8, start=BITES["B1"][0] - 0.3, overlays=[lt_overlay("SOUMEE SAILESH", LT, 0.5, d, y=690)])
    vt = tl.t
    a, b = sent("F03", 0)
    S(PhotoScene, 0.4 + b + 0.6, photo="mic", layout="left",
      overlays=[side_text_overlay("ALSO KNOWN AS", "Sanhita Debnath", side="right", start=0.6)])
    tl.vo("F03", vt + 0.4)
    S(FileScene, vt + 0.4 + vo_len("F03") - tl.t + 0.8, src=os.path.join(MAPS, "map_locator.mp4"), bug=False)
    kt = tl.t
    S(FileScene, vo_len("F04b") + 1.6, src=os.path.join(MAPS, "map_locator.mp4"), start=3.0, bug=False)
    tl.vo("F04b", kt + 0.3)
    mt = tl.t
    S(PhotoScene, vo_len("F04") + 1.8, photo="red", layout="full", z0=1.12, z1=1.0, c0=(0.42, 0.3), c1=(0.45, 0.4),
      overlays=[wave_overlay(0.84, 0.35, 0.4)])
    tl.vo("F04", mt + 0.4)
    bt = tl.t
    d = tl.bite("B2", bt + 0.2)
    S(InterviewScene, d + 1.0, start=BITES["B2"][0] - 0.2, overlays=[tag_overlay("INTERVIEW · BENGALI, ENGLISH SUBTITLES")])
    et = tl.t
    a, b = sent("F05", 0)
    S(EducationCard, 0.4 + b + 0.8)
    tl.vo("F05", et + 0.4)
    S(DegreeCard, et + 0.4 + vo_len("F05") - tl.t + 2.2)
    ht = tl.t
    d1 = tl.vo_part("F06", 0, 2, ht + 0.4)
    d2 = tl.vo_part("F06b", 0, 1, ht + 0.4 + d1 + 0.45)
    S(BurmanCard, 0.4 + d1 + 0.45 + d2 + 0.7, show_rd=0.4 + d1 + 0.3)
    jt = tl.t
    d3 = tl.vo_part("F06", 2, 3, jt + 0.3)
    S(PhotoScene, 0.3 + d3 + 1.2, photo="jacket", layout="framed", z0=1.0, z1=1.05, fout=0.4)

    # ---------------- CHAPTER 3: JOURNEY ----------------
    slate(3, "THE JOURNEY TO MUMBAI", "red")
    mpt = tl.t
    S(FileScene, 22.0, src=os.path.join(MAPS, "map_full.mp4"), bug=False)
    tl.vo("F07", mpt + 11.6)
    tl.sfx("whoosh.wav", mpt + 3.4, 0.5)
    tl.sfx("whoosh.wav", mpt + 9.0, 0.5)
    bt = tl.t
    d = tl.bite("B3", bt + 0.2)
    S(InterviewScene, d + 1.0, start=BITES["B3"][0] - 0.2, side="left",
      overlays=[quote_overlay(["The journey was not easy, but I never lost faith in my dream and in music."], start=0.8)])
    ct = tl.t
    a, b = sent("F08", 1)
    S(PhotoScene, 0.4 + b + 0.8, photo="red", layout="left",
      overlays=[side_text_overlay("MUMBAI", "From 2017", side="right", start=0.5), wave_overlay(0.9, 0.3, 0.3)])
    tl.vo("F08", ct + 0.4)
    S(TimelineCard, max(ct + 0.4 + vo_len("F08") - tl.t + 2.4, 6.5))

    # ---------------- CHAPTER 4: BREAKTHROUGH ----------------
    slate(4, "THE BOLLYWOOD BREAKTHROUGH", "mic")
    ot = tl.t
    a, b = sent("F09", 0)
    S(PromoScene, 0.4 + b + 0.5, part="poster", start=12.0, overlays=[tag_overlay(PromoScene.label)])
    tl.vo("F09", ot + 0.4)
    st = tl.t
    S(OfficialScene, ot + 0.4 + vo_len("F09") - tl.t + 1.0, start=15.4, overlays=[tag_overlay(OfficialScene.label)])
    tl.song(OFFICIAL, 15.4, tl.t - st, st, gain=0.5, fin=0.4, fout=0.6)
    pbt = tl.t
    S(PromoScene, vo_len("F09b") + 1.6, part="film", start=2.0, overlays=[tag_overlay(PromoScene.label)])
    tl.vo("F09b", pbt + 0.4)
    tl.song(PROMO, 2.0, tl.t - pbt, pbt, gain=0.35, fin=0.4, fout=0.6)
    crt = tl.t
    S(CreditsTitle, vo_len("F10") + 3.2, start=5.0)
    tl.vo("F10", crt + 1.2)
    tl.sfx("riser.wav", crt - 0.4, 0.5)
    S(HeroCard, 6.5, photo="red")
    # the musical payoff: song excerpt with no narration
    sx = tl.t
    S(OfficialScene, 8.4, start=0.0, overlays=[tag_overlay(OfficialScene.label), text_overlay([("MADIRAPAN · SONG EXCERPT", GOLD_L)], start=0.6, pos="upper", size=54)])
    tl.song(OFFICIAL, 0.0, 8.4, sx, gain=1.0, fin=0.3, fout=0.8)
    bt = tl.t
    d = tl.bite("B4", bt + 0.2)
    S(InterviewScene, d + 1.0, start=BITES["B4"][0] - 0.2, side="left",
      overlays=[quote_overlay(["This is a very special moment for me."], start=8.0)])
    cr = tl.t
    S(OfficialScene, 5.2, start=35.8, overlays=[tag_overlay(OfficialScene.label)])
    tl.song(OFFICIAL, 35.8, 5.2, cr, gain=1.0, fin=0.3, fout=0.8)
    f11 = tl.t
    S(PhotoScene, vo_len("F11") + 1.8, photo="mic", layout="full", z0=1.0, z1=1.1, c0=(0.55, 0.45), c1=(0.52, 0.5),
      overlays=[wave_overlay(0.86, 0.35, 0.4)])
    tl.vo("F11", f11 + 0.4)
    bt = tl.t
    d = tl.bite("B5", bt + 0.2)
    S(InterviewScene, d + 1.2, start=BITES["B5"][0] - 0.2, side="right",
      overlays=[quote_overlay(["It is the result of many years of dreams, hard work and patience."], start=5.5, side="left")], fout=0.4)

    # ---------------- CHAPTER 5: DREAMS ----------------
    slate(5, "HER DREAMS AND HER MESSAGE", "red")
    dt = tl.t
    a, b = sent("F12", 1)
    S(PhotoScene, 0.4 + b + 0.8, photo="jacket", layout="right",
      overlays=[side_text_overlay("THE NEXT STEP", "A recognised playback singer", side="left", start=0.6)])
    tl.vo("F12", dt + 0.4)
    am = tl.t
    rest12 = dt + 0.4 + vo_len("F12") - am
    tl.vo("F13", dt + 0.4 + vo_len("F12") + 0.5)
    S(AmbitionsCard, rest12 + 0.5 + vo_len("F13") + 2.2,
      item_times=[0.3, 0.6, rest12 + 0.5 + sent("F13", 0)[0] + 1.0, rest12 + 0.5 + sent("F13", 1)[0] + 1.0])
    bt = tl.t
    d = tl.bite("B7", bt + 0.2)
    S(InterviewScene, d + 1.0, start=BITES["B7"][0] - 0.2, side="left",
      overlays=[quote_overlay(["This is only the beginning. My dreams are big."], start=0.5)])
    ms = tl.t
    m0 = sent("F14", 1)[0] + 0.4
    S(MessageCard, vo_len("F14") + 3.2, item_times=[m0, m0 + 1.4, m0 + 2.8, sent("F14", 2)[0] + 0.4])
    tl.vo("F14", ms + 0.4)

    # ---------------- CHAPTER 6: TRIPURA ----------------
    slate(6, "A DAUGHTER OF TRIPURA", "jacket")
    tt = tl.t
    S(FileScene, vo_len("F15") + 1.6, src=os.path.join(MAPS, "map_locator.mp4"), start=1.0, bug=False)
    tl.vo("F15", tt + 0.5)
    bt = tl.t
    d = tl.bite("B6", bt + 0.2)
    S(InterviewScene, d + 0.3, start=BITES["B6"][0] - 0.2, overlays=[lt_overlay("SOUMEE SAILESH", LT, 0.3, 4.5, y=690)])
    bt = tl.t
    d = tl.bite("B8", bt + 0.05)
    S(InterviewScene, d + 1.0, start=BITES["B8"][0] - 0.05, fout=0.3)
    # montage: her photographs and moments from the film (score only)
    S(PhotoScene, 3.2, photo="red", layout="full", z0=1.0, z1=1.08, c0=(0.5, 0.35), c1=(0.5, 0.3), fin=0.3)
    S(InterviewScene, 3.0, start=8.2)
    S(PhotoScene, 3.2, photo="jacket", layout="full", z0=1.08, z1=1.0, c0=(0.5, 0.3), c1=(0.5, 0.3))
    S(PhotoScene, 3.2, photo="mic", layout="full", z0=1.0, z1=1.08, c0=(0.5, 0.42), c1=(0.5, 0.38))
    S(FileScene, 3.4, src=os.path.join(MAPS, "map_intro.mp4"), start=3.4, bug=False,
      overlays=[text_overlay([("CHEBRI · KHOWAI · TRIPURA", GOLD_L)], start=0.3, pos="upper", size=48)])
    ft = tl.t
    a, b = sent("F16", 0)
    S(PhotoScene, 0.4 + b + 0.8, photo="red", layout="full", z0=1.0, z1=1.12, c0=(0.48, 0.35), c1=(0.46, 0.3))
    tl.vo("F16", ft + 0.4)
    S(TitleCard, ft + 0.4 + vo_len("F16") - tl.t + 7.0, photo="mic",
      lines=[("FROM CHEBRI TO BOLLYWOOD", "accent"), ("SOUMEE SAILESH", "name"), ("TRIPURA'S MUSICAL PRIDE", "small")])
    S(EndCard, 10.5, fout=1.2)
    # score bed: three cues, changing at chapter slates
    total = tl.t
    cues = [("score_1.mp3", 0.0), ("score_2.mp3", 0.0), ("score_3.mp3", 0.0)]
    slates = [s.t0 for s in tl.scenes if isinstance(s, ChapterSlate)]
    bounds = [0.0, slates[1], slates[3], total]   # ch1-2 | ch3-4 | ch5-6
    for i, (trk, off) in enumerate(cues):
        a0 = max(0, bounds[i] - (1.5 if i else 0))
        tl.bed(trk, off, a0, bounds[i + 1] - a0 + 1.5)
    return tl


def edl_short():
    tl = TL("short", 1920, 1080)
    S = tl.S
    st = tl.t
    S(OfficialScene, 3.4, start=0.6, overlays=[tag_overlay(OfficialScene.label),
      text_overlay([("FROM TRIPURA TO BOLLYWOOD", WHITE)], start=0.2, pos="upper", size=76)])
    tl.song(OFFICIAL, 0.6, 3.4, st, gain=1.0, fin=0.1, fout=0.6)
    tl.vo("H01", st + 0.6)
    S(PhotoScene, st + 0.6 + vo_len("H01") - tl.t + 0.5, photo="red", layout="right",
      overlays=[side_text_overlay("SOUMEE SAILESH", "Playback singer from Tripura", side="left", start=0.2)])
    mt = tl.t
    S(FileScene, 11.0, src=os.path.join(MAPS, "map_short.mp4"), bug=False)
    tl.vo("H02", mt + 0.3)
    S(PhotoScene, max(0.5, mt + 0.3 + vo_len("H02") - tl.t + 0.5), photo="jacket", layout="framed")
    ct = tl.t
    S(CreditsTitle, vo_len("H03") + 1.6, start=5.0)
    tl.vo("H03", ct + 0.9)
    cr = tl.t
    S(OfficialScene, 5.0, start=35.8, overlays=[tag_overlay(OfficialScene.label)])
    tl.song(OFFICIAL, 35.8, 5.0, cr, gain=1.0, fin=0.3, fout=0.8)
    bt = tl.t
    d = tl.bite("B4", bt + 0.15, s=26.05, e=32.31)
    tl.caps = [c for c in tl.caps if not (bt <= c[0] < bt + d + 0.2)]
    tl.cap(bt + 0.15, bt + 0.15 + 3.42, "My song Madirapan, sung in my voice, has been released.")
    tl.cap(bt + 0.15 + 3.42, bt + 0.15 + d, "This is a very special moment for me.")
    S(InterviewScene, d + 0.4, start=26.05 - 0.15, side="right", overlays=[lt_overlay("SOUMEE SAILESH", "Singer · Chebri, Khowai, Tripura", 0.3, 5.0, y=690)])
    bt = tl.t
    d = tl.bite("B5", bt + 0.15)
    S(InterviewScene, d + 0.5, start=BITES["B5"][0] - 0.15, side="left",
      overlays=[quote_overlay(["It is the result of many years of dreams, hard work and patience."], start=5.0, side="right")])
    ht = tl.t
    a, b = sent("H04", 0)
    S(AmbitionsCard, 0.3 + b + 0.3, item_times=[0.5, 0.9, 1.3, 1.7], photo="red")
    tl.vo("H04", ht + 0.3)
    S(TitleCard, ht + 0.3 + vo_len("H04") - tl.t + 3.5, photo="mic",
      lines=[("FROM CHEBRI TO BOLLYWOOD", "accent"), ("SOUMEE SAILESH", "name"), ("TRIPURA'S MUSICAL PRIDE", "small")])
    S(EndCard, 5.0, fout=0.8)
    tl.bed("score_4.mp3", 20.0, 0.0, tl.t + 1)
    return tl


def edl_vertical():
    tl = TL("vertical", 1080, 1920)
    S = tl.S
    # 0-3 s hook on the song footage, song audio
    st = tl.t
    S(PromoScene, 3.0, part="film", start=2.0, overlays=[tag_overlay("COURTESY: MADIRAPAN PROMO VIDEO"),
      text_overlay([("FROM TRIPURA", WHITE), ("TO BOLLYWOOD", GOLD_L)], start=0.0, pos="upper", size=96)])
    tl.song(PROMO, 2.0, 3.0, st, gain=1.0, fin=0.05, fout=0.5)
    bt = tl.t
    d = tl.bite("B1", bt + 0.1, s=0.30, e=5.95)
    S(InterviewScene, d + 0.3, start=0.2, overlays=[lt_overlay("SOUMEE SAILESH", "Singer · Khowai, Tripura", 0.2, d)])
    mt = tl.t
    S(FileScene, 7.4, src=os.path.join(MAPS, "map_vertical.mp4"), bug=False)
    tl.cap(mt + 0.3, mt + 3.6, "In 2017, she moved to Mumbai to pursue music.")
    tl.cap(mt + 3.6, mt + 7.2, "About 2,000 km from her home in Tripura.")
    ct = tl.t
    S(CreditsTitle, 6.4, start=5.0)
    tl.song(OFFICIAL, 0.6, 6.4, ct, gain=0.9, fin=0.3, fout=0.5)
    bt = tl.t
    d = tl.bite("B4", bt + 0.1, s=21.60, e=31.25, caps=False)
    tl.cap(bt + 0.1, bt + 4.55, "Today, in Bollywood megastar Salman Khan sir's film Maatrubhumi,")
    tl.cap(bt + 4.55, bt + 7.9, "my song Madirapan, sung in my voice, has been released.")
    tl.cap(bt + 7.9, bt + 0.1 + d, "A very special moment for me.")
    S(InterviewScene, d + 0.2, start=21.5)
    cr = tl.t
    S(OfficialScene, 4.4, start=35.85, vcrop=(0, 54, 560, 536), overlays=[tag_overlay("COURTESY: SALMAN KHAN FILMS MUSIC")])
    tl.song(OFFICIAL, 35.85, 4.4, cr, gain=1.0, fin=0.2, fout=0.6)
    bt = tl.t
    d = tl.bite("B5", bt + 0.1, s=39.92, e=46.20, caps=False)
    tl.cap(bt + 0.1, bt + 2.2, "This is not just an achievement for me.")
    tl.cap(bt + 2.2, bt + 0.1 + d, "It is the result of years of dreams, hard work and patience.")
    S(InterviewScene, d + 0.2, start=39.82)
    bt = tl.t
    d = tl.bite("B7", bt + 0.05, s=53.10, e=56.00, caps=False)
    tl.cap(bt + 0.05, bt + 0.05 + d, "This is only the beginning. My dreams are big.")
    S(InterviewScene, d + 0.25, start=53.05)
    S(TitleCard, 4.2, photo="red", lines=[("A JOURNEY FROM TRIPURA TO BOLLYWOOD", "small"), ("SOUMEE SAILESH", "name"), ("CHEBRI, KHOWAI, TRIPURA", "accent")])
    S(EndCard, 2.6, fout=0.5, disclosure=("Song excerpts courtesy Salman Khan Films Music, used for news reporting",))
    tl.bed("score_4.mp3", 60.0, 0.0, tl.t + 1, gain=1.0)
    return tl


# =============================================================================
# Rendering
_TL = None


def _render_one(i):
    sc = _TL.scenes[i]
    out = os.path.join(ROOT, "07_PREVIEWS", "segments", _TL.name, f"{i:03d}.mp4")
    only = os.environ.get("ONLY")
    if only and os.path.exists(out) and not any(isinstance(sc, globals()[c]) for c in only.split(",")):
        return out
    f0 = round(sc.t0 * FPS)
    f1 = round((sc.t0 + sc.dur) * FPS)
    w = Writer(out, _TL.W, _TL.H, crf=15)
    for k in range(f1 - f0):
        t = (f0 + k) / FPS - sc.t0
        w.write(sc.frame(t))
    w.close()
    sc.close()
    return out


def render(tl, procs=4):
    global _TL
    _TL = tl
    ctx = mp.get_context("fork")
    with ctx.Pool(procs) as pool:
        outs = pool.map(_render_one, range(len(tl.scenes)), chunksize=1)
    lst = os.path.join(ROOT, "07_PREVIEWS", "segments", tl.name, "list.txt")
    with open(lst, "w") as f:
        for o in outs:
            f.write(f"file '{o}'\n")
    vid = os.path.join(ROOT, "07_PREVIEWS", f"{tl.name}_video.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", vid], check=True)
    return vid


# =============================================================================
# Audio
def load_audio(path, start=0.0, dur=None, filt=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}"]
    if dur:
        cmd += ["-t", f"{dur:.3f}"]
    cmd += ["-i", path]
    if filt:
        cmd += ["-af", filt]
    cmd += ["-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    a = np.frombuffer(subprocess.check_output(cmd), np.float32).reshape(-1, 2)
    return a.copy()


def lufs(a):
    try:
        import pyloudnorm as pyln
        return pyln.Meter(SR).integrated_loudness(a)
    except Exception:
        return 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)


def fade(a, fin, fout):
    n = len(a)
    if fin > 0:
        k = min(n, int(fin * SR)); a[:k] *= np.linspace(0, 1, k)[:, None]
    if fout > 0:
        k = min(n, int(fout * SR)); a[n - k:] *= np.linspace(1, 0, k)[:, None]
    return a


def mix(tl):
    total = int(tl.t * SR) + SR
    speech = np.zeros((total, 2), np.float32)
    song = np.zeros((total, 2), np.float32)
    other = np.zeros((total, 2), np.float32)
    speech_env = np.zeros(total, np.float32)
    song_env = np.zeros(total, np.float32)
    TARGET = {"vo": -18.0, "bite": -18.5, "song": -20.0}
    for ev in tl.audio:
        k = ev["kind"]
        if k == "bite":
            a = load_audio(ev["file"], ev["src"], ev["dur"], "highpass=f=80,afftdn=nr=8:nf=-45,acompressor=threshold=-24dB:ratio=2.5:attack=10:release=200")
        elif k == "sfx":
            a = load_audio(ev["file"])
        else:
            a = load_audio(ev["file"], ev["src"], ev["dur"])
        if k in TARGET and len(a) > SR * 0.5:
            g = 10 ** ((TARGET[k] - lufs(a)) / 20)
            a *= g
        a *= ev.get("gain", 1.0)
        a = fade(a, ev.get("fin", 0.02), ev.get("fout", 0.03))
        i0 = int(ev["at"] * SR)
        i1 = min(total, i0 + len(a))
        a = a[:i1 - i0]
        if k in ("vo", "bite"):
            speech[i0:i1] += a
            speech_env[i0:i1] = 1
        elif k == "song":
            song[i0:i1] += a
            # song featured (gain >= .9) silences the score; low song only ducks it
            song_env[i0:i1] = np.maximum(song_env[i0:i1], 1.0 if ev["gain"] >= 0.9 else 0.6)
        else:
            other[i0:i1] += a
    # song excerpts duck under speech
    def smooth(env, att=0.12, rel=0.5):
        out = np.empty_like(env); v = 0.0
        a1, r1 = 1 / (att * SR), 1 / (rel * SR)
        for i in range(0, len(env), 480):
            tgt = env[i:i + 480].max()
            v += (tgt - v) * min(1, (a1 if tgt > v else r1) * 480)
            out[i:i + 480] = v
        return out
    senv = smooth(speech_env, 0.15, 0.6)
    song *= (1 - 0.7 * senv)[:, None]
    # score bed
    bed = np.zeros((total, 2), np.float32)
    for m in tl.music:
        a = load_audio(m["file"], m["src"], m["dur"])
        g = 10 ** ((-24.0 - lufs(a)) / 20)
        a *= g * m["gain"]
        a = fade(a, 1.5, 2.0)
        i0 = int(m["at"] * SR); i1 = min(total, i0 + len(a))
        bed[i0:i1] += a[:i1 - i0]
    sgenv = smooth(song_env, 0.3, 0.8)
    duck = 10 ** ((-11.0 * senv) / 20) * (1 - 0.95 * np.clip(sgenv, 0, 1))
    bed *= duck[:, None]
    out = speech + song + bed + other
    peak = np.max(np.abs(out))
    if peak > 0.98:
        out *= 0.98 / peak
    wav = os.path.join(ROOT, "05_AUDIO", "FINAL_MIX", f"{tl.name}_mix_premaster.wav")
    os.makedirs(os.path.dirname(wav), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                    "-t", f"{tl.t:.3f}", "-c:a", "pcm_s24le", wav], input=out.astype(np.float32).tobytes(), check=True)
    return wav


# =============================================================================
# Captions
def ts_srt(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def ts_ass(t):
    cs = int(round(t * 100)); h, cs = divmod(cs, 360000); m, cs = divmod(cs, 6000); s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def write_captions(tl):
    caps = sorted(tl.caps)
    # avoid overlaps; keep a minimum display time
    fixed = []
    for i, (s, e, txt) in enumerate(caps):
        if i + 1 < len(caps):
            e = min(e, caps[i + 1][0] - 0.04)
        fixed.append((s, max(e, s + 0.8), txt))
    base = {"full": "english_captions_full", "short": "english_captions_short", "vertical": "english_captions_vertical"}[tl.name]
    srt = os.path.join(ROOT, "02_TRANSCRIPTS", base + ".srt")
    with open(srt, "w") as f:
        for i, (s, e, txt) in enumerate(fixed, 1):
            f.write(f"{i}\n{ts_srt(s)} --> {ts_srt(e)}\n{txt}\n\n")
    vertical = tl.H > tl.W
    if vertical:
        style = "Style: Cap,Inter SemiBold,64,&H00FFFFFF,&H00FFFFFF,&H96081430,&H96081430,0,0,0,0,100,100,0,0,3,14,0,2,90,90,560,1"
        res = "PlayResX: 1080\nPlayResY: 1920"
    else:
        style = "Style: Cap,Inter SemiBold,46,&H00FFFFFF,&H00FFFFFF,&H96081430,&H96081430,0,0,0,0,100,100,0,0,3,12,0,2,240,240,58,1"
        res = "PlayResX: 1920\nPlayResY: 1080"
    ass = os.path.join(ROOT, "04_GRAPHICS", "SUBTITLES", base + ".ass")
    with open(ass, "w") as f:
        f.write(f"[Script Info]\nScriptType: v4.00+\n{res}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n")
        f.write("[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
        f.write(style + "\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
        for s, e, txt in fixed:
            f.write(f"Dialogue: 0,{ts_ass(s)},{ts_ass(e)},Cap,,0,0,0,,{{\\fad(120,120)}}{txt}\n")
    return srt, ass


# =============================================================================
def master(tl, vid, wav, ass, out):
    # two-pass loudness normalisation to -14 LUFS / -1.5 dBTP (YouTube/Facebook)
    p1 = subprocess.run(["ffmpeg", "-hide_banner", "-i", wav, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                        capture_output=True, text=True).stderr
    js = json.loads(p1[p1.rindex("{"):p1.rindex("}") + 1])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true,aresample=48000")
    fonts = "/usr/share/fonts/opentype/inter"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vid, "-i", wav,
                    "-vf", f"ass={ass}:fontsdir={fonts}", "-af", ln,
                    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
                    "-profile:v", "high", "-movflags", "+faststart",
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", out], check=True)
    return out


if __name__ == "__main__":
    which = sys.argv[1]
    tl = {"full": edl_full, "short": edl_short, "vertical": edl_vertical}[which]()
    print(f"{which}: {len(tl.scenes)} scenes, duration {tl.t:.2f}s", flush=True)
    if "--plan" in sys.argv:
        for sc in tl.scenes:
            print(f"  {sc.t0:7.2f}  {sc.dur:6.2f}  {sc.__class__.__name__}  {getattr(sc, 'photo', '')}  src@{getattr(sc, 'start', '')}")
        sys.exit(0)
    srt, ass = write_captions(tl)
    wav = mix(tl)
    print("audio mixed", flush=True)
    vid = render(tl)
    print("video rendered", flush=True)
    names = {"full": "SOUMEE_FULL_16X9.mp4", "short": "SOUMEE_SHORT_16X9.mp4", "vertical": "SOUMEE_SHORT_9X16.mp4"}
    out = master(tl, vid, wav, ass, os.path.join(ROOT, "08_FINAL_EXPORTS", names[which]))
    print("DONE", out, flush=True)
