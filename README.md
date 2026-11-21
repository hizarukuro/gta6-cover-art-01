# Vice Frame — GTA-Style Cover Art Maker

[![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/hizarukuro/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/hizarukuro/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Vice Frame turns your own photos and a caption into film-poster cover art in
the GTA poster style: a multi-panel collage with thin gold frames, a slanted
role tag on every panel ("THE DRIVER", "THE BOSS", …), a huge chrome-gradient
title with a neon script subtitle, a tagline ribbon, a press strip with five
stars and a quote, and a full billing block with credits, a barcode and a gold
seal — all graded in a sunset (or neon, golden-hour or noir) wash.

## What it does

- **Three panel layouts** — Poster · 7 (hero centre), Classic · 6, Bold · 4 —
  at all three export sizes: **1920×1080**, **1080×1080** and **1080×1350**.
- **Any photo**: click a panel or drop files straight onto the poster; drag to
  pan, scroll or slide to zoom, edit each panel's role tag. One photo can fill
  a single panel, several panels, or be spread across the whole collage.
- **Four colour grades** (Sunset, Neon Nights, Golden Hour, Noir) with an
  intensity slider plus vignette and film-grain toggles.
- **Every word is editable**: title, subtitle, tagline, press quote and source,
  billing credits, release line and volume label.
- **One-click demo cast**: seven bundled sample portraits (made with an image
  model for this app) fill the panels so the first paint is already a finished
  poster.
- **Export** renders the poster to a PNG at the exact chosen size in one click.

Photos are read on your own machine and never uploaded; the app works fully
offline.

## Run it

Serve the `app/` folder with any static file server and open `index.html` in a
desktop browser, e.g.:

```sh
cd app && python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `app/index.html` directly from disk works too. There is no build step
and nothing to install: `app/` is plain HTML, CSS and JavaScript plus the
sample portraits under `app/samples/`.

Shot mode for screenshots: `?shot=cover&layout=poster7&size=wide` renders the
finished poster full-bleed with the demo cast loaded, and `?shot=editor` opens
the editor with the cast loaded.

## How the hand-in works

`main.ts` (with the vendored library in `vendor/`) is the hand-in program: it
copies `app/` and `screenshots/` into the output directory and writes
`dossier.json`, the summary the judges read:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`screenshots/` holds four captures: the exported wide cover, the editor with
the demo cast loaded, and the exported portrait and square covers.

Built with make.fun — referral code c23ct4sn
