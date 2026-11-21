/* Vice Frame — a GTA-poster-style cover art maker.
   Static, offline, no libraries: photos are read from the visitor's own machine
   (file picker or drag-and-drop) and never leave it. The poster is drawn on a
   canvas and exported as a PNG in the three common post sizes. */
'use strict';

/* ---------------- catalogue ---------------- */

const SIZES = {
  wide:     { w: 1920, h: 1080, label: 'Wide 1920×1080' },
  square:   { w: 1080, h: 1080, label: 'Square 1080×1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080×1350' },
};

/* Panel rectangles are fractions of the poster panel region (see regionFor).
   demo[] names the bundled sample portrait that fills the panel, tags[] its
   default role tag. */
const LAYOUTS = {
  poster7: {
    label: 'Poster · 7',
    panels: [
      [0.000, 0.000, 0.292, 0.492],
      [0.000, 0.508, 0.292, 0.492],
      [0.304, 0.000, 0.392, 0.672],
      [0.304, 0.688, 0.392, 0.312],
      [0.708, 0.000, 0.292, 0.320],
      [0.708, 0.336, 0.292, 0.320],
      [0.708, 0.672, 0.292, 0.328],
    ],
    demo: ['driver', 'rider', 'boss', 'lookout', 'mechanic', 'fixer', 'captain'],
    tags: ['THE DRIVER', 'THE RIDER', 'THE BOSS', 'THE LOOKOUT', 'THE MECHANIC', 'THE FIXER', 'THE CAPTAIN'],
  },
  classic6: {
    label: 'Classic · 6',
    panels: [
      [0.000, 0.000, 0.322, 0.492], [0.339, 0.000, 0.322, 0.492], [0.678, 0.000, 0.322, 0.492],
      [0.000, 0.508, 0.322, 0.492], [0.339, 0.508, 0.322, 0.492], [0.678, 0.508, 0.322, 0.492],
    ],
    demo: ['driver', 'boss', 'mechanic', 'rider', 'fixer', 'captain'],
    tags: ['THE DRIVER', 'THE BOSS', 'THE MECHANIC', 'THE RIDER', 'THE FIXER', 'THE CAPTAIN'],
  },
  bold4: {
    label: 'Bold · 4',
    panels: [
      [0.000, 0.000, 0.494, 0.492], [0.506, 0.000, 0.494, 0.492],
      [0.000, 0.508, 0.494, 0.492], [0.506, 0.508, 0.494, 0.492],
    ],
    demo: ['driver', 'boss', 'mechanic', 'captain'],
    tags: ['THE DRIVER', 'THE BOSS', 'THE MECHANIC', 'THE CAPTAIN'],
  },
};

const SAMPLE_FILES = {
  driver: 'samples/driver.jpg',
  boss: 'samples/boss.jpg',
  mechanic: 'samples/mechanic.jpg',
  captain: 'samples/captain.jpg',
  rider: 'samples/rider.jpg',
  fixer: 'samples/fixer.jpg',
  lookout: 'samples/lookout.jpg',
};

/* Colour grades: a canvas filter applied to every photo plus tint overlays
   (stops are [offset, r, g, b, alpha]) laid over the collage. */
const GRADES = {
  sunset: {
    filter: 'saturate(1.30) contrast(1.08) brightness(1.03) sepia(0.12)',
    washes: [
      { mode: 'soft-light', stops: [[0, 255, 122, 26, 0.55], [0.55, 255, 45, 120, 0.30], [1, 26, 4, 64, 0.55]] },
      { mode: 'screen', stops: [[0, 255, 190, 90, 0.20], [0.5, 255, 120, 60, 0.05], [1, 20, 0, 40, 0.0]] },
    ],
  },
  neon: {
    filter: 'saturate(1.45) contrast(1.12) brightness(1.00) hue-rotate(-6deg)',
    washes: [
      { mode: 'overlay', stops: [[0, 0, 229, 255, 0.26], [0.45, 30, 0, 60, 0.05], [1, 255, 45, 150, 0.34]] },
      { mode: 'screen', stops: [[0, 255, 45, 150, 0.14], [0.5, 0, 0, 0, 0.0], [1, 0, 229, 255, 0.14]] },
    ],
  },
  golden: {
    filter: 'sepia(0.38) saturate(1.25) contrast(1.05) brightness(1.06)',
    washes: [
      { mode: 'soft-light', stops: [[0, 255, 176, 66, 0.52], [0.6, 255, 94, 58, 0.26], [1, 43, 16, 4, 0.46]] },
    ],
  },
  noir: {
    filter: 'grayscale(0.88) contrast(1.22) brightness(0.98)',
    washes: [
      { mode: 'soft-light', stops: [[0, 140, 160, 200, 0.28], [1, 0, 0, 0, 0.50]] },
      { mode: 'multiply', stops: [[0, 255, 255, 255, 0.0], [1, 60, 60, 80, 0.35]] },
    ],
  },
};

/* ---------------- state ---------------- */

function blankPanel(tag) {
  return { img: null, name: '', panX: 0.5, panY: 0.5, zoom: 1, tag: tag || '' };
}

const state = {
  size: 'wide',
  layout: 'poster7',
  grade: 'sunset',
  intensity: 1,
  vignette: true,
  grain: true,
  panels: [],
  selected: 0,
  spread: null, // { img, panX, panY, zoom } — one photo sliced across every panel
  words: {
    title: 'SALT & SIRENS',
    subtitle: 'one last sunset job',
    tagline: 'EVERYONE WANTS A CUT OF THE SUNSET',
    quote: "A SUNSET YOU CAN'T OUTRUN",
    quoteBy: 'THE PALM GAZETTE',
    credits: 'VICE FRAME PICTURES · A SALT & SIRENS STORY · STARRING YOU AND YOUR CREW · MUSIC BY THE BOARDWALK KINGS · EDITED BY L. MARLOWE',
    soon: 'COMING SOON',
    vol: 'VOL. 1',
  },
};

/* Faces live in the upper half of a portrait, so wide short panels need a
   higher focal point than tall ones or the crop slices through the eyes. */
function tunePanY(p, idx) {
  const s = SIZES[state.size];
  const R = regionFor(s.w, s.h);
  const r = panelRect(R, LAYOUTS[state.layout].panels[idx], s.w);
  const aspect = r.w / r.h;
  p.panY = aspect > 1.35 ? 0.28 : aspect > 1.0 ? 0.36 : 0.45;
}

function resetPanels() {
  const lay = LAYOUTS[state.layout];
  state.panels = lay.panels.map((_, i) => {
    const p = blankPanel(lay.tags[i]);
    tunePanY(p, i);
    return p;
  });
  state.selected = 0;
}
resetPanels();

/* ---------------- dom ---------------- */

const canvas = document.getElementById('poster');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

function segWire(id, attr, fn) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const x of $(id).querySelectorAll('button')) x.classList.toggle('on', x === b);
    fn(b.dataset[attr]);
  });
}

segWire('sizeSeg', 'size', (v) => { state.size = v; syncCanvasSize(); render(); });
segWire('layoutSeg', 'layout', (v) => { state.layout = v; resetPanels(); syncPanelPanel(); render(); });
segWire('gradeSeg', 'grade', (v) => { state.grade = v; render(); });

$('intensity').addEventListener('input', (e) => {
  state.intensity = Number(e.target.value) / 100;
  $('intensityVal').textContent = e.target.value + '%';
  render();
});
$('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; render(); });
$('grain').addEventListener('change', (e) => { state.grain = e.target.checked; render(); });

const WORD_FIELDS = [
  ['fTitle', 'title'], ['fSubtitle', 'subtitle'], ['fTagline', 'tagline'],
  ['fQuote', 'quote'], ['fQuoteBy', 'quoteBy'], ['fCredits', 'credits'],
  ['fSoon', 'soon'], ['fVol', 'vol'],
];
for (const [id, key] of WORD_FIELDS) {
  $(id).addEventListener('input', (e) => { state.words[key] = e.target.value; render(); });
}

$('fTag').addEventListener('input', (e) => {
  const p = state.panels[state.selected];
  if (p) { p.tag = e.target.value.toUpperCase(); render(); }
});
$('zoom').addEventListener('input', (e) => {
  const t = state.spread || state.panels[state.selected];
  if (!t) return;
  t.zoom = Number(e.target.value) / 100;
  $('zoomVal').textContent = e.target.value + '%';
  render();
});

$('demoBtn').addEventListener('click', () => loadDemo().then(render));
$('spreadBtn').addEventListener('click', () => {
  if (state.spread) {
    state.spread = null;
    $('spreadBtn').classList.remove('on');
    $('spreadBtn').textContent = 'Spread one photo across all panels';
    syncPanelPanel();
    render();
  } else {
    pickFile('spread');
  }
});
$('loadPhotoBtn').addEventListener('click', () => pickFile('panel'));
$('resetPanelBtn').addEventListener('click', () => {
  const t = state.spread || state.panels[state.selected];
  if (t) {
    t.panX = 0.5; t.panY = 0.5; t.zoom = 1;
    if (!state.spread) tunePanY(t, state.selected);
    $('zoom').value = 100; $('zoomVal').textContent = '100%'; render();
  }
});
$('clearPanelBtn').addEventListener('click', () => {
  const p = state.panels[state.selected];
  if (p && !state.spread) { p.img = null; p.name = ''; render(); }
});
$('exportBtn').addEventListener('click', exportPNG);

/* ---------------- photos in ---------------- */

let pickMode = 'panel';
function pickFile(mode) {
  pickMode = mode;
  $('filePicker').value = '';
  $('filePicker').click();
}

$('filePicker').addEventListener('change', (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  if (pickMode === 'spread') {
    loadPhotoFile(files[0]).then((img) => {
      state.spread = { img, panX: 0.5, panY: 0.5, zoom: 1 };
      $('spreadBtn').classList.add('on');
      $('spreadBtn').textContent = 'Spread photo active — click to clear';
      syncPanelPanel();
      render();
    });
  } else {
    fillPanelsFromFiles(files, state.selected);
  }
});

function loadPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function fillPanelsFromFiles(files, startAt) {
  let slot = startAt;
  const jobs = files.map((f) => loadPhotoFile(f).then((img) => {
    while (slot < state.panels.length && state.panels[slot].img) slot++;
    const ti = Math.min(slot, state.panels.length - 1);
    const target = state.panels[ti];
    if (target) { target.img = img; target.name = f.name; target.panX = 0.5; target.zoom = 1; tunePanY(target, ti); }
    slot++;
  }).catch(() => {}));
  Promise.all(jobs).then(() => { syncPanelPanel(); render(); });
}

function loadSample(key) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = SAMPLE_FILES[key];
  });
}

/* Fill the panels with the bundled cast and the default billing words, so the
   first paint is already a finished poster. */
async function loadDemo() {
  const lay = LAYOUTS[state.layout];
  state.spread = null;
  $('spreadBtn').classList.remove('on');
  $('spreadBtn').textContent = 'Spread one photo across all panels';
  const imgs = await Promise.all(lay.demo.map((k) => loadSample(k).catch(() => null)));
  state.panels = lay.panels.map((_, i) => {
    const p = blankPanel(lay.tags[i]);
    p.img = imgs[i];
    p.name = lay.demo[i] + '.jpg';
    tunePanY(p, i);
    return p;
  });
  state.selected = 0;
  syncPanelPanel();
}

/* ---------------- geometry ---------------- */

/* The poster frame: a press strip on top, the panel region in the middle and
   a billing block at the bottom, all inside a small even margin. */
function regionFor(W, H) {
  const pad = Math.round(W * 0.028);
  const stripH = Math.round(H * 0.082);
  const billH = Math.round(H * 0.108);
  const gapY = Math.round(H * 0.018);
  return {
    pad, stripH, billH,
    x: pad,
    y: stripH + gapY,
    w: W - pad * 2,
    h: H - stripH - billH - gapY * 2,
  };
}

function panelRect(region, frac, W) {
  const gap = Math.max(4, Math.round(W * 0.0055));
  return {
    x: region.x + frac[0] * region.w + gap / 2,
    y: region.y + frac[1] * region.h + gap / 2,
    w: frac[2] * region.w - gap,
    h: frac[3] * region.h - gap,
  };
}

/* ---------------- render ---------------- */

let grainTile = null;
function makeGrainTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const data = g.createImageData(256, 256);
  let seed = 1234567;
  for (let i = 0; i < data.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = 96 + (seed % 128);
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  return c;
}

function setSpacing(c, px) {
  try { c.letterSpacing = px + 'px'; } catch (e) { /* older engines: ignore */ }
}

/* Draw one photo into a rect, cover-fit, honouring pan (0..1 focal point) and
   zoom, with the grade's photo filter applied. */
function drawPhotoCover(c, img, r, panX, panY, zoom, filter) {
  const scale = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = r.x - panX * (dw - r.w);
  const dy = r.y - panY * (dh - r.h);
  c.save();
  c.beginPath();
  c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  if (filter) c.filter = filter;
  c.drawImage(img, dx, dy, dw, dh);
  c.restore();
}

function drawEmptyPanel(c, r, W) {
  const grad = c.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  grad.addColorStop(0, '#2a1150');
  grad.addColorStop(0.55, '#43155f');
  grad.addColorStop(1, '#7a1042');
  c.fillStyle = grad;
  c.fillRect(r.x, r.y, r.w, r.h);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const s = Math.max(13, Math.min(30, r.w * 0.075));
  c.font = '800 ' + s + 'px system-ui, Arial, sans-serif';
  c.fillText('+ ADD PHOTO', r.x + r.w / 2, r.y + r.h / 2);
}

function drawPanelTag(c, r, tag, H) {
  if (!tag) return;
  const h = Math.max(17, Math.min(42, H * 0.034));
  const s = h * 0.5;
  c.save();
  c.font = '800 ' + s + 'px system-ui, Arial, sans-serif';
  const tw = c.measureText(tag).width;
  const w = tw + h * 1.15;
  const x = r.x + Math.round(H * 0.008);
  const y = r.y + r.h - h - Math.round(H * 0.008);
  const slant = h * 0.32;
  c.beginPath();
  c.moveTo(x + slant, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w - slant, y + h);
  c.lineTo(x, y + h);
  c.closePath();
  c.fillStyle = 'rgba(9,2,20,0.88)';
  c.fill();
  c.fillStyle = '#f2b33d';
  c.fillRect(x + slant * 0.55, y, h * 0.16, h);
  c.fillStyle = '#ffffff';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(tag, x + h * 0.52, y + h / 2 + 1);
  c.restore();
}

function drawStar(c, cx, cy, r, color) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function paintPoster(c, W, H, forExport) {
  const R = regionFor(W, H);
  const lay = LAYOUTS[state.layout];
  const grade = GRADES[state.grade];
  const inten = state.intensity;

  /* backdrop */
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#160830');
  bg.addColorStop(0.6, '#1d0a38');
  bg.addColorStop(1, '#0d0419');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  /* panels */
  const rects = lay.panels.map((f) => panelRect(R, f, W));
  if (state.spread && state.spread.img) {
    const img = state.spread.img;
    const sp = state.spread;
    const scale = Math.max(R.w / img.naturalWidth, R.h / img.naturalHeight) * sp.zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const ox = R.x - sp.panX * (dw - R.w);
    const oy = R.y - sp.panY * (dh - R.h);
    rects.forEach((r) => {
      c.save();
      c.beginPath();
      c.rect(r.x, r.y, r.w, r.h);
      c.clip();
      c.filter = grade.filter;
      c.drawImage(img, (r.x - ox) / scale, (r.y - oy) / scale, r.w / scale, r.h / scale, r.x, r.y, r.w, r.h);
      c.restore();
    });
  } else {
    rects.forEach((r, i) => {
      const p = state.panels[i];
      if (p && p.img) drawPhotoCover(c, p.img, r, p.panX, p.panY, p.zoom, grade.filter);
      else drawEmptyPanel(c, r, W);
    });
  }

  /* grade washes over the collage */
  for (const wash of grade.washes) {
    const g = c.createLinearGradient(0, R.y, 0, R.y + R.h);
    for (const [off, r, gg, b, a] of wash.stops) {
      g.addColorStop(off, 'rgba(' + r + ',' + gg + ',' + b + ',' + Math.min(1, a * inten).toFixed(3) + ')');
    }
    c.save();
    c.globalCompositeOperation = wash.mode;
    c.fillStyle = g;
    c.fillRect(R.x, R.y, R.w, R.h);
    c.restore();
  }

  /* vignette + grain sit under the lettering so the words stay loud */
  if (state.vignette) {
    const rad = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    rad.addColorStop(0, 'rgba(4,0,12,0)');
    rad.addColorStop(1, 'rgba(4,0,12,0.52)');
    c.fillStyle = rad;
    c.fillRect(0, 0, W, H);
  }
  if (state.grain) {
    if (!grainTile) grainTile = makeGrainTile();
    c.save();
    c.globalAlpha = 0.07;
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = c.createPattern(grainTile, 'repeat');
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  /* gold frames */
  rects.forEach((r) => {
    const fg = c.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    fg.addColorStop(0, '#f7d774');
    fg.addColorStop(0.5, '#c8912a');
    fg.addColorStop(1, '#ffe9a8');
    c.strokeStyle = fg;
    c.lineWidth = Math.max(2, W * 0.0018);
    c.strokeRect(r.x, r.y, r.w, r.h);
  });

  drawPressStrip(c, W, H, R);
  drawTitleBlock(c, W, H, R);
  drawBilling(c, W, H, R);

  /* role tags last, like stickers, so the lettering never swallows one */
  rects.forEach((r, i) => {
    const p = state.panels[i];
    drawPanelTag(c, r, p ? p.tag : '', H);
  });

  if (!forExport) drawSelection(c, rects);
}

function drawPressStrip(c, W, H, R) {
  const cy = R.stripH / 2;
  const starR = H * 0.0135;
  let x = R.pad;
  c.save();
  for (let i = 0; i < 5; i++) {
    drawStar(c, x + starR, cy, starR, '#f2b33d');
    x += starR * 2.45;
  }
  const vol = state.words.vol.trim();
  let volW = 0;
  if (vol) {
    c.font = '800 ' + Math.round(H * 0.0165) + 'px system-ui, Arial, sans-serif';
    volW = c.measureText(vol).width + H * 0.024;
  }
  const quote = state.words.quote.trim();
  const by = state.words.quoteBy.trim();
  if (quote) {
    /* shrink the quote (and, if needed, drop the attribution) so the strip
       never runs into the volume box on narrow posters */
    const qx = x + H * 0.012;
    const avail = W - R.pad - volW - H * 0.02 - qx;
    let qs = H * 0.023;
    const setQ = () => { c.font = 'italic 700 ' + Math.round(qs) + 'px Georgia, "Liberation Serif", "Times New Roman", serif'; };
    setQ();
    const text = '“' + quote + '”';
    while (c.measureText(text).width > avail && qs > 9) { qs *= 0.93; setQ(); }
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = '#fdf6e3';
    c.fillText(text, qx, cy + 1);
    const qw = c.measureText(text).width;
    if (by) {
      c.font = '700 ' + Math.round(H * 0.0145) + 'px system-ui, Arial, sans-serif';
      setSpacing(c, 2);
      const byText = '— ' + by.toUpperCase();
      if (qw + H * 0.014 + c.measureText(byText).width <= avail) {
        c.fillStyle = '#ffd98a';
        c.fillText(byText, qx + qw + H * 0.014, cy + 1);
      }
      setSpacing(c, 0);
    }
  }
  if (vol) {
    c.font = '800 ' + Math.round(H * 0.0165) + 'px system-ui, Arial, sans-serif';
    const bw = volW;
    const bh = H * 0.034;
    const bx = W - R.pad - bw;
    const byy = cy - bh / 2;
    c.strokeStyle = '#f2b33d';
    c.lineWidth = Math.max(1.5, H * 0.0018);
    c.strokeRect(bx, byy, bw, bh);
    c.fillStyle = '#ffd98a';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(vol, bx + bw / 2, cy + 1);
  }
  c.strokeStyle = 'rgba(242,179,61,0.5)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(R.pad, R.stripH + 2);
  c.lineTo(W - R.pad, R.stripH + 2);
  c.stroke();
  c.restore();
}

function drawTitleBlock(c, W, H, R) {
  const words = state.words;
  const cx = W / 2;
  const titleY = R.y + R.h * 0.545;
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';

  /* chrome title: sunset-gradient fill, dark outline, hard drop shadow */
  const title = (words.title || '').toUpperCase();
  if (title) {
    let size = H * 0.118;
    const setFont = () => {
      c.font = 'italic 900 ' + size + 'px "Arial Black", "Liberation Sans", "DejaVu Sans", Arial, sans-serif';
    };
    setFont();
    setSpacing(c, size * 0.01);
    while (c.measureText(title).width > W * 0.94 && size > 20) { size *= 0.94; setFont(); }
    c.save();
    c.translate(cx, titleY);
    c.transform(1, 0, -0.055, 1, 0, 0);
    c.shadowColor = 'rgba(10,0,24,0.85)';
    c.shadowBlur = 0;
    c.shadowOffsetX = size * 0.045;
    c.shadowOffsetY = size * 0.055;
    c.lineJoin = 'round';
    c.strokeStyle = '#1c0530';
    c.lineWidth = size * 0.16;
    c.strokeText(title, 0, 0);
    const tg = c.createLinearGradient(0, -size * 0.92, 0, size * 0.12);
    tg.addColorStop(0, '#fff8d6');
    tg.addColorStop(0.30, '#ffd23e');
    tg.addColorStop(0.55, '#ff8a1e');
    tg.addColorStop(0.78, '#ff2e88');
    tg.addColorStop(1, '#8a2be2');
    c.shadowColor = 'transparent';
    c.fillStyle = tg;
    c.fillText(title, 0, 0);
    c.restore();
  }

  /* neon script subtitle */
  const sub = words.subtitle || '';
  if (sub) {
    const ss = H * 0.040;
    c.save();
    c.translate(cx, titleY + ss * 1.28);
    c.rotate(-0.028);
    c.font = 'italic 700 ' + ss + 'px "Segoe Script", "Brush Script MT", "Apple Chancery", cursive';
    c.shadowColor = '#ff2e88';
    c.shadowBlur = ss * 0.55;
    c.fillStyle = '#ff9ed2';
    c.fillText(sub, 0, 0);
    c.shadowBlur = ss * 0.18;
    c.fillStyle = '#ffe3f4';
    c.fillText(sub, 0, 0);
    c.restore();
  }

  /* tagline ribbon */
  const tag = (words.tagline || '').toUpperCase();
  if (tag) {
    const ts = H * 0.0165;
    c.font = '800 ' + ts + 'px system-ui, Arial, sans-serif';
    setSpacing(c, ts * 0.32);
    const tw = c.measureText(tag).width;
    const rw = Math.min(W * 0.8, tw + H * 0.07);
    const rh = H * 0.036;
    const ry = titleY + H * 0.040 * 1.28 + H * 0.026;
    const rx = cx - rw / 2;
    const slant = rh * 0.5;
    c.beginPath();
    c.moveTo(rx + slant, ry);
    c.lineTo(rx + rw, ry);
    c.lineTo(rx + rw - slant, ry + rh);
    c.lineTo(rx, ry + rh);
    c.closePath();
    c.fillStyle = 'rgba(10,2,24,0.88)';
    c.fill();
    c.strokeStyle = '#f2b33d';
    c.lineWidth = Math.max(1.2, H * 0.0014);
    c.stroke();
    c.fillStyle = '#ffd98a';
    c.textBaseline = 'middle';
    c.fillText(tag, cx, ry + rh / 2 + 1);
    setSpacing(c, 0);
  }
  c.restore();
}

function drawBilling(c, W, H, R) {
  const base = H - R.billH;
  c.save();
  c.strokeStyle = 'rgba(242,179,61,0.5)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(R.pad, base - 2);
  c.lineTo(W - R.pad, base - 2);
  c.stroke();

  const midY = base + R.billH * 0.52;
  c.textBaseline = 'middle';

  const soon = (state.words.soon || '').toUpperCase();
  let soonW = 0;
  if (soon) {
    c.textAlign = 'left';
    c.font = '800 ' + Math.round(H * 0.020) + 'px system-ui, Arial, sans-serif';
    setSpacing(c, H * 0.006);
    soonW = c.measureText(soon).width;
    c.fillStyle = '#ff9a3d';
    c.fillText(soon, R.pad, midY);
    setSpacing(c, 0);
  }

  /* barcode box geometry first: the credits live in the zone between the
     release line and the barcode/seal, and wrap to two lines if they must */
  const bw = W * 0.072;
  const bh = R.billH * 0.54;
  const bx = W - R.pad - bw;
  const byy = base + R.billH * 0.16;

  const credits = state.words.credits || '';
  if (credits) {
    const zx1 = R.pad + soonW + H * 0.022;
    const zx2 = bx - H * 0.115;
    const zc = (zx1 + zx2) / 2;
    const zMax = Math.max(120, zx2 - zx1);
    let cs = H * 0.0138;
    const setC = () => { c.font = '600 ' + cs + 'px system-ui, Arial, sans-serif'; };
    setC();
    setSpacing(c, 1);
    while (c.measureText(credits).width > zMax && cs > 9.5) { cs *= 0.94; setC(); }
    c.textAlign = 'center';
    c.fillStyle = 'rgba(243,236,255,0.88)';
    if (c.measureText(credits).width <= zMax) {
      c.fillText(credits, zc, midY);
    } else {
      const parts = credits.split('·').map((s) => s.trim()).filter(Boolean);
      const half = Math.ceil(parts.length / 2);
      const line1 = parts.slice(0, half).join(' · ');
      const line2 = parts.slice(half).join(' · ');
      c.fillText(line1, zc, midY - cs * 0.62);
      if (line2) c.fillText(line2, zc, midY + cs * 0.62);
    }
    setSpacing(c, 0);
  }
  c.fillStyle = '#ffffff';
  c.fillRect(bx, byy, bw, bh);
  c.fillStyle = '#111111';
  let seed = 987654;
  let x = bx + bw * 0.05;
  const barArea = bw * 0.9;
  let drawn = 0;
  while (drawn < barArea) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const wdt = 1 + (seed % 4);
    if (seed % 3 !== 0) c.fillRect(x, byy + bh * 0.08, wdt, bh * 0.68);
    x += wdt + 1.6;
    drawn += wdt + 1.6;
  }
  let ns = bh * 0.16;
  c.font = '600 ' + Math.round(ns) + 'px Arial, sans-serif';
  while (c.measureText('0 60211 20261 7').width > bw * 0.94 && ns > 6) { ns *= 0.92; c.font = '600 ' + Math.round(ns) + 'px Arial, sans-serif'; }
  c.textAlign = 'center';
  c.fillText('0 60211 20261 7', bx + bw / 2, byy + bh * 0.9);

  /* gold seal, straddling the billing rule at the right */
  const sr = H * 0.046;
  const scx = bx - sr - W * 0.016;
  const scy = base + R.billH * 0.1;
  c.beginPath();
  c.arc(scx, scy, sr, 0, Math.PI * 2);
  c.fillStyle = '#f2b33d';
  c.fill();
  c.beginPath();
  c.arc(scx, scy, sr * 0.8, 0, Math.PI * 2);
  c.fillStyle = '#8a5a00';
  c.fill();
  c.beginPath();
  c.arc(scx, scy, sr * 0.72, 0, Math.PI * 2);
  c.fillStyle = '#2a1503';
  c.fill();
  drawStar(c, scx, scy - sr * 0.3, sr * 0.26, '#ffd98a');
  c.fillStyle = '#ffd98a';
  c.textAlign = 'center';
  c.font = '800 ' + Math.round(sr * 0.30) + 'px system-ui, Arial, sans-serif';
  c.fillText('ORIGINAL', scx, scy + sr * 0.18);
  c.font = '800 ' + Math.round(sr * 0.26) + 'px system-ui, Arial, sans-serif';
  c.fillText('COVER ART', scx, scy + sr * 0.48);
  c.restore();
}

function drawSelection(c, rects) {
  const r = rects[state.selected];
  if (!r) return;
  c.save();
  c.strokeStyle = '#ff4fa3';
  c.lineWidth = 3;
  c.setLineDash([12, 8]);
  c.strokeRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10);
  c.setLineDash([]);
  c.fillStyle = '#ff4fa3';
  const s = 12;
  for (const [hx, hy] of [[r.x - 5, r.y - 5], [r.x + r.w + 5, r.y - 5], [r.x - 5, r.y + r.h + 5], [r.x + r.w + 5, r.y + r.h + 5]]) {
    c.fillRect(hx - s / 2, hy - s / 2, s, s);
  }
  c.restore();
}

/* ---------------- preview + panel controls ---------------- */

function syncCanvasSize() {
  const s = SIZES[state.size];
  canvas.width = s.w;
  canvas.height = s.h;
}

function render() {
  paintPoster(ctx, canvas.width, canvas.height, false);
}

function syncPanelPanel() {
  const p = state.panels[state.selected];
  const lay = LAYOUTS[state.layout];
  $('panelName').textContent = state.spread
    ? '· spread photo'
    : '· ' + (state.selected + 1) + ' of ' + lay.panels.length;
  $('fTag').value = state.spread ? '' : (p ? p.tag : '');
  $('fTag').disabled = !!state.spread;
  const t = state.spread || p;
  const z = t ? Math.round(t.zoom * 100) : 100;
  $('zoom').value = z;
  $('zoomVal').textContent = z + '%';
}

/* ---------------- pointer: select, pan, zoom, drop ---------------- */

function eventPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

function panelAt(pos) {
  const W = canvas.width, H = canvas.height;
  const R = regionFor(W, H);
  const rects = LAYOUTS[state.layout].panels.map((f) => panelRect(R, f, W));
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const pos = eventPos(e);
  const idx = panelAt(pos);
  if (idx < 0) return;
  if (idx !== state.selected) { state.selected = idx; syncPanelPanel(); }
  drag = { x: pos.x, y: pos.y };
  canvas.setPointerCapture(e.pointerId);
  render();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pos = eventPos(e);
  const t = state.spread || state.panels[state.selected];
  if (!t || !t.img) { drag = pos; return; }
  const W = canvas.width, H = canvas.height;
  const R = regionFor(W, H);
  let r;
  if (state.spread) r = R;
  else r = panelRect(R, LAYOUTS[state.layout].panels[state.selected], W);
  const scale = Math.max(r.w / t.img.naturalWidth, r.h / t.img.naturalHeight) * t.zoom;
  const rangeX = Math.max(1, t.img.naturalWidth * scale - r.w);
  const rangeY = Math.max(1, t.img.naturalHeight * scale - r.h);
  t.panX = Math.min(1, Math.max(0, t.panX - (pos.x - drag.x) / rangeX));
  t.panY = Math.min(1, Math.max(0, t.panY - (pos.y - drag.y) / rangeY));
  drag = pos;
  render();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

canvas.addEventListener('wheel', (e) => {
  const pos = eventPos(e);
  const idx = panelAt(pos);
  if (idx < 0) return;
  e.preventDefault();
  if (idx !== state.selected && !state.spread) { state.selected = idx; syncPanelPanel(); }
  const t = state.spread || state.panels[state.selected];
  if (!t) return;
  t.zoom = Math.min(3.2, Math.max(1, t.zoom * (e.deltaY < 0 ? 1.07 : 0.935)));
  $('zoom').value = Math.round(t.zoom * 100);
  $('zoomVal').textContent = Math.round(t.zoom * 100) + '%';
  render();
}, { passive: false });

canvas.addEventListener('dblclick', (e) => {
  const idx = panelAt(eventPos(e));
  if (idx >= 0) { state.selected = idx; syncPanelPanel(); pickFile('panel'); }
});

canvas.addEventListener('dragover', (e) => { e.preventDefault(); });
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  const idx = panelAt(eventPos(e));
  if (idx >= 0) state.selected = idx;
  fillPanelsFromFiles(files, state.selected);
});

/* ---------------- export ---------------- */

function renderExportDataURL(sizeKey) {
  const s = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = s.w;
  off.height = s.h;
  paintPoster(off.getContext("2d"), s.w, s.h, true);
  return off.toDataURL('image/png');
}

function exportPNG() {
  const s = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = s.w;
  off.height = s.h;
  paintPoster(off.getContext("2d"), s.w, s.h, true);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vice-frame-' + state.size + '-' + s.w + 'x' + s.h + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

/* ---------------- screenshot mode + boot ---------------- */

/* ?shot=cover&layout=poster7&size=wide renders the finished poster full-bleed
   with the demo cast; ?shot=editor shows the editor with the cast loaded.
   __vfExport(size) hands back the app's own exported PNG as a data URL. */
window.__vfExport = renderExportDataURL;
window.__vfReady = false;

async function boot() {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const wantDemo = shot || params.get('demo');
  if (params.get('layout') && LAYOUTS[params.get('layout')]) {
    state.layout = params.get('layout');
    resetPanels();
    for (const b of $('layoutSeg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.layout === state.layout);
  }
  if (params.get('size') && SIZES[params.get('size')]) {
    state.size = params.get('size');
    for (const b of $('sizeSeg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.size === state.size);
  }
  if (params.get('grade') && GRADES[params.get('grade')]) {
    state.grade = params.get('grade');
    for (const b of $('gradeSeg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.grade === state.grade);
  }
  syncCanvasSize();
  if (wantDemo) await loadDemo();
  if (shot === 'cover') document.body.classList.add('shot');
  syncPanelPanel();
  render();
  window.__vfReady = true;
}

boot();
