# Soumee Sailesh documentary: project files

Everything is built from code, so any change can be made in the scripts and rebuilt.

| File | What it does |
|---|---|
| `src/script_data.py` | Hindi narration and English captions, sentence by sentence; interview bites with timings, Bengali text and English captions |
| `src/vo_select.py` | QC for ElevenLabs takes: back-transcribes, scores, picks the better take, trims, finds sentence boundaries (`03_VOICEOVER/narration_qc.json`) |
| `src/map_anim.py` | Map animations (`python3 map_anim.py out.mp4 full\|short\|vertical\|intro\|locator`) |
| `src/lib.py`, `src/scenes.py` | Visual identity, fonts, lower thirds, cards, scene types |
| `src/build.py` | Edit decision lists for the three videos, renderer, audio mix, captions, final encode |

Build: `cd src && python3 build.py full` (also `short`, `vertical`). Add `--plan` to print the scene list.
Re-render only some scene types: `ONLY=CardScene,EndCard python3 build.py full`.

Needs: ffmpeg with libass, Python 3 with Pillow, numpy, shapely, pyloudnorm; faster-whisper for the QC
step; Natural Earth GeoJSON files (ne_10m_admin_0_countries_ind, ne_10m_admin_1_states_provinces) in
`GEO_DIR`. Fonts: Inter, DejaVu Serif.
