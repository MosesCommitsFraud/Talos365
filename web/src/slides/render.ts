// Render-Pipeline: HTML-Folien im DOM aufbauen → Text einpassen → Qualität messen →
// mit dom-to-pptx in bearbeitbare PowerPoint-Formen umwandeln → native Diagramme an
// die Platzhalter setzen → Übergänge (Morph/Fade) ins Folien-XML schreiben.
import JSZip from 'jszip';
import type PptxGenJS from 'pptxgenjs';
import { exportToPptx } from '@/vendor/dom-to-pptx';
import { preloadIcons } from './icons';
import { waitForImages } from './images';
import { consistencyChecks, fixContrast, titleSizes, unifyTitles } from './check';
import { H, W } from './kit';
import { iconQueries, slideHtml, type ChartSpec, type SlideSpec } from './layouts';
import { tint, type Design } from './styles';

export interface Warning {
  index: number;
  message: string;
}

const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;
const HERO = new Set(['title', 'section', 'statement', 'big_number', 'quote', 'closing', 'image_hero', 'image_stat', 'image_quote', 'giant']);

const short = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
};

// ── Text einpassen ─────────────────────────────────────────────────────────

function overflows(el: HTMLElement, slack: number) {
  // Ober-/Unterlängen ragen bei engem Zeilenabstand über die Zeilenbox hinaus und
  // zählen in scrollHeight mit – eine echte Zusatzzeile ist aber ~1 Schriftgröße hoch.
  const size = parseFloat(el.style.fontSize) || 16;
  return el.scrollHeight > el.clientHeight * (1 - slack) + size * 0.3 || el.scrollWidth > el.clientWidth * (1 - slack) + 2;
}

function fitSlide(slide: HTMLElement, index: number, slack: number, warn: (w: Warning) => void) {
  const els = Array.from(slide.querySelectorAll<HTMLElement>('[data-fit]'));
  const failed = new Set<HTMLElement>();
  // Zwei Durchgänge: Verkleinern verschiebt den Platz für Nachbarn in Flex-Spalten.
  for (let pass = 0; pass < 2; pass++) {
    for (const el of els) {
      const min = Number(el.dataset.fit) || 12;
      let size = parseFloat(el.style.fontSize) || 16;
      const lines = Number(el.dataset.lines) || 0;
      while (overflows(el, slack) && size > min) {
        size -= size > 40 ? 2 : 1;
        el.style.fontSize = `${size}px`;
        // max-height folgt der Schriftgröße, die Zeilenzahl bleibt gleich
        if (lines) el.style.maxHeight = `${Math.ceil(lines * parseFloat(el.style.lineHeight) * size) + 2}px`;
      }
      if (pass === 1 && overflows(el, slack)) failed.add(el);
    }
    // Gleichrangige Texte (Gruppen) auf dieselbe Größe bringen – Ausreißer ausgenommen
    const groups = new Map<string, HTMLElement[]>();
    for (const el of els) {
      const g = el.dataset.fitGroup;
      if (g) groups.set(g, [...(groups.get(g) ?? []), el]);
    }
    for (const members of groups.values()) {
      const regular = members.filter((m) => !overflows(m, slack));
      if (!regular.length) continue;
      const size = Math.min(...regular.map((m) => parseFloat(m.style.fontSize)));
      for (const m of regular) m.style.fontSize = `${size}px`;
    }
  }
  for (const el of failed) {
    const single = el.scrollWidth > el.clientWidth + 1;
    warn({ index, message: single ? `Text zu breit: „${short(el.textContent ?? '')}“ – kürzer formulieren` : `Text zu lang: „${short(el.textContent ?? '')}“ – kürzen` });
  }
}

// ── Qualität messen (nach AeSlides: Kollisionen, Ränder, Größe, Dichte, Leere) ──

function qualitySlide(slide: HTMLElement, spec: SlideSpec, index: number, warn: (w: Warning) => void) {
  const root = slide.getBoundingClientRect();
  const texts = Array.from(slide.querySelectorAll<HTMLElement>('[data-fit]')).filter((e) => (e.textContent ?? '').trim());
  const rects = texts.map((e) => {
    const r = e.getBoundingClientRect();
    // Tatsächliche Textfläche (Inhalt), nicht die ganze Box
    const h = Math.min(r.height, e.scrollHeight);
    return { e, x: r.left - root.left, y: r.top - root.top, w: Math.min(r.width, e.scrollWidth), h };
  });
  // Ränder
  for (const r of rects) {
    if (r.x < -2 || r.y < -2 || r.x + r.w > W + 2 || r.y + r.h > H + 2) {
      warn({ index, message: `Text ragt über den Folienrand: „${short(r.e.textContent ?? '')}“` });
    }
  }
  // Mindestabstand zum Folienrand (Seitenzahlen ausgenommen)
  const EDGE = 36;
  for (const r of rects) {
    if (r.e.closest('[data-edge]')) continue;
    if (r.x < EDGE - 2 || r.y < EDGE - 12 || r.x + r.w > W - EDGE + 2 || r.y + r.h > H - EDGE + 12) {
      warn({ index, message: `Text zu nah am Folienrand: „${short(r.e.textContent ?? '')}“ – kürzen oder anderes Layout` });
    }
  }
  // Kollisionen zwischen Texten (nicht verschachtelt)
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      if (ix * iy > 0.15 * Math.min(a.w * a.h, b.w * b.h) && ix * iy > 60) {
        warn({ index, message: `Texte überlappen: „${short(a.e.textContent ?? '')}“ und „${short(b.e.textContent ?? '')}“` });
      }
    }
  }
  // Text über Deko-Formen (große Kreise/Flächen der Stile corporate/blocks)
  const decos = Array.from(slide.querySelectorAll<HTMLElement>('[data-deco]')).map((e) => e.getBoundingClientRect());
  for (const r of rects) {
    for (const dr of decos) {
      const ix = Math.max(0, Math.min(r.x + r.w, dr.right - root.left) - Math.max(r.x, dr.left - root.left));
      const iy = Math.max(0, Math.min(r.y + r.h, dr.bottom - root.top) - Math.max(r.y, dr.top - root.top));
      if (ix * iy > 0.15 * r.w * r.h && ix * iy > 200) {
        warn({ index, message: `Text liegt über einer Deko-Form: „${short(r.e.textContent ?? '')}“ – kürzer formulieren oder anderes Layout` });
        break;
      }
    }
  }
  // Schriftgröße
  const tiny = texts.filter((e) => parseFloat(e.style.fontSize) < 14);
  if (tiny.length) warn({ index, message: `Sehr kleine Schrift (unter 10,5 pt): „${short(tiny[0].textContent ?? '')}“ – weniger Text auf die Folie` });
  // Textmenge
  const chars = texts.reduce((n, e) => n + (e.textContent ?? '').length, 0);
  if (chars > 700) warn({ index, message: `Sehr viel Text (${chars} Zeichen) – auf zwei Folien aufteilen oder kürzen` });
  // Leere (nur Inhaltsfolien)
  if (!HERO.has(spec.layout)) {
    const blocks = Array.from(slide.querySelectorAll<HTMLElement>('[data-block],[data-fit],[data-chart]')).map((e) => e.getBoundingClientRect());
    if (blocks.length) {
      const top = Math.min(...blocks.map((r) => r.top)) - root.top;
      const bottom = Math.max(...blocks.map((r) => r.bottom)) - root.top;
      if (bottom - top < H * 0.45) warn({ index, message: 'Folie wirkt leer – mehr Inhalt oder ein Layout mit größeren Elementen (z. B. big_number, statement)' });
    }
  }
}

// ── Native Diagramme ───────────────────────────────────────────────────────

function addChart(slide: PptxGenJS.Slide, c: ChartSpec, box: { x: number; y: number; w: number; h: number }, d: Design) {
  const categories = (c.categories ?? []).map(String);
  let series = (c.series ?? []).filter((s) => s && Array.isArray(s.values)).map((s, i) => ({
    name: s.name || `Reihe ${i + 1}`,
    labels: categories,
    values: (s.values ?? []).map((v) => Number(v) || 0),
  }));
  if (!series.length || !categories.length) return;
  const type = c.type ?? 'column';
  const isPie = type === 'pie' || type === 'doughnut';
  const labelCol = d.style.dark ? 'C9CCDD' : '5B616E';
  const gridCol = d.style.dark ? '2A2D45' : 'E6E8EB';
  const font = d.style.body;
  let colors = d.chart;
  let stackedHighlight = false;
  // Hervorhebung: eine Kategorie in Primärfarbe, der Rest dezent (zwei gestapelte Reihen)
  if (c.highlight && !isPie && series.length === 1 && (type === 'column' || type === 'bar')) {
    const hi = categories.findIndex((x) => x === c.highlight);
    if (hi >= 0) {
      const base = series[0];
      series = [
        { name: base.name, labels: categories, values: base.values.map((v, i) => (i === hi ? 0 : v)) },
        { name: c.highlight, labels: categories, values: base.values.map((v, i) => (i === hi ? v : 0)) },
      ];
      colors = [d.style.dark ? '4A4E6E' : tint(d.primary, 0.72), d.style.dark ? d.accent : d.primary];
      stackedHighlight = true;
    }
  }
  const opts: PptxGenJS.IChartOpts = {
    ...box,
    chartColors: isPie ? d.chart : colors.slice(0, Math.max(series.length, 1)),
    showLegend: (isPie || series.length > 1) && !stackedHighlight,
    legendPos: isPie ? 'r' : 'b',
    legendFontFace: font,
    legendFontSize: 13,
    legendColor: labelCol,
    showValue: true,
    dataLabelFontFace: font,
    dataLabelFontSize: 13,
    dataLabelColor: isPie ? 'FFFFFF' : d.style.dark ? 'FFFFFF' : d.text,
    catAxisLabelColor: labelCol,
    valAxisLabelColor: labelCol,
    catAxisLabelFontFace: font,
    valAxisLabelFontFace: font,
    catAxisLabelFontSize: 14,
    valAxisLabelFontSize: 12,
    catAxisLabelPos: 'low',
    valGridLine: { color: gridCol, size: 0.75 },
    catGridLine: { style: 'none' },
    valAxisHidden: !isPie && series.length === 1,
    catAxisLineShow: false,
    valAxisLineShow: false,
    plotArea: { fill: { color: 'FFFFFF', transparency: 100 } },
  };
  if (c.unit) opts.dataLabelFormatCode = `#,##0"${c.unit.replace(/"/g, '')}"`;
  let chartType: string = type;
  if (!isPie) {
    const bar = type === 'bar' || type === 'stacked_bar';
    if (type === 'column' || type === 'bar' || type.startsWith('stacked')) {
      chartType = 'bar';
      opts.barDir = bar ? 'bar' : 'col';
      opts.barGapWidthPct = 55;
    }
    if (type.startsWith('stacked') || stackedHighlight) {
      opts.barGrouping = 'stacked';
      opts.dataLabelPosition = stackedHighlight ? 'inEnd' : 'ctr';
      opts.dataLabelColor = 'FFFFFF';
      if (stackedHighlight) {
        // Nullwerte nicht beschriften
        opts.dataLabelFormatCode = c.unit ? `#,##0"${c.unit.replace(/"/g, '')}";;;` : '#,##0;;;';
      }
    } else if (chartType === 'bar') {
      opts.dataLabelPosition = 'outEnd';
    }
    if (type === 'line') {
      opts.lineSize = 3;
      opts.lineDataSymbol = 'circle';
      opts.lineDataSymbolSize = 9;
      opts.dataLabelPosition = 't';
    }
    if (type === 'area') opts.dataLabelPosition = 't';
  } else {
    opts.dataLabelPosition = 'bestFit';
    opts.showPercent = true;
    opts.showValue = false;
    if (type === 'doughnut') opts.holeSize = 62;
  }
  slide.addChart(chartType as PptxGenJS.CHART_NAME, series, opts);
}

// ── Übergänge ──────────────────────────────────────────────────────────────

function transitionXml(kind: Design['transition']): string {
  if (kind === 'fade') return '<p:transition spd="med"><p:fade/></p:transition>';
  return (
    '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
    '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">' +
    '<p:transition spd="slow" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" p14:dur="1100"><p159:morph option="byObject"/></p:transition>' +
    '</mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>'
  );
}

/** Weiche Farbflächen: Effekt „Weiche Kanten“ setzen, Morph-Namen vergeben und die
 *  Formen ganz nach hinten legen (sie wurden zuletzt eingefügt). */
function softShapes(xml: string): string {
  const blocks: string[] = [];
  const out = xml.replace(/<p:sp>(?:(?!<p:sp>)[\s\S])*?<\/p:sp>/g, (sp) => {
    const m = /name="__soft_(\d+)__([^"]*)"/.exec(sp);
    if (!m) return sp;
    let fixed = sp.replace(m[0], `name="${m[2]}"`);
    fixed = fixed.replace('</p:spPr>', `<a:effectLst><a:softEdge rad="${m[1]}"/></a:effectLst></p:spPr>`);
    blocks.push(fixed);
    return '';
  });
  if (!blocks.length) return out;
  // Direkt über die erste Form legen – das ist der Folienhintergrund, den dom-to-pptx
  // als flächendeckende Form zeichnet. Alles andere liegt darüber.
  const firstSp = /<p:sp>(?:(?!<p:sp>)[\s\S])*?<\/p:sp>/.exec(out);
  if (!firstSp) return out.replace('</p:grpSpPr>', `</p:grpSpPr>${blocks.join('')}`);
  const at = firstSp.index + firstSp[0].length;
  return out.slice(0, at) + blocks.join('') + out.slice(at);
}

/** Gerundete Fotos: Bildrahmen „Abgerundetes Rechteck“ statt vorgerendeter Maske. */
function roundPictures(xml: string): string {
  return xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => {
    const m = /name="__round_(\d+)__([^"]*)"/.exec(pic);
    if (!m) return pic;
    return pic
      .replace(m[0], `name="${m[2]}"`)
      .replace(/<a:prstGeom prst="rect"><a:avLst\/><\/a:prstGeom>/, `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${m[1]}"/></a:avLst></a:prstGeom>`);
  });
}

async function postProcess(blob: Blob, kinds: Array<Design['transition']>): Promise<string> {
  const zip = await JSZip.loadAsync(blob);
  for (const name of Object.keys(zip.files)) {
    const m = /^ppt\/slides\/slide(\d+)\.xml$/.exec(name);
    if (!m) continue;
    // Übergang dieser Folie (slideN.xml = N-te Folie des Builds)
    const kind = kinds[Number(m[1]) - 1] ?? 'none';
    const xmlT = kind !== 'none' ? transitionXml(kind) : '';
    let xml = await zip.file(name)!.async('string');
    xml = roundPictures(softShapes(xml));
    if (xmlT && !xml.includes('<p:transition') && !xml.includes('p159:morph')) {
      if (xml.includes('</p:clrMapOvr>')) xml = xml.replace('</p:clrMapOvr>', `</p:clrMapOvr>${xmlT}`);
      else xml = xml.replace('</p:cSld>', `</p:cSld>${xmlT}`);
    }
    zip.file(name, xml);
  }
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// ── Gesamtablauf ───────────────────────────────────────────────────────────

export interface BuildResult {
  base64: string;
  warnings: Warning[];
}

/** Rendert Folien offscreen und durchläuft alle Prüfschritte (ohne Export). */
async function prepare(specs: SlideSpec[], d: Design, indices: number[]) {
  const warnings: Warning[] = [];
  const warn = (w: Warning) => {
    if (!warnings.some((x) => x.index === w.index && x.message === w.message)) warnings.push(w);
  };
  const queries = specs.flatMap(iconQueries);
  await Promise.all([preloadIcons(queries, 'regular'), preloadIcons(queries, 'filled')]);

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-30000px;top:0;width:${W}px;pointer-events:none;`;
  host.innerHTML = specs.map((s, i) => slideHtml(s, { d, index: indices[i] })).join('');
  document.body.appendChild(host);
  await document.fonts.ready;
  // Layout abwarten (Timeout statt requestAnimationFrame: läuft auch bei verborgener Seitenleiste)
  await new Promise((r) => setTimeout(r, 30));
  const slides = Array.from(host.querySelectorAll<HTMLElement>(':scope > .slide'));
  // Fotos laden (über /img/fetch); fehlgeschlagene durch eine neutrale Fläche ersetzen
  const failed = await waitForImages(host);
  for (const img of failed) {
    const idx = slides.findIndex((s) => s.contains(img));
    warn({ index: Math.max(0, idx), message: 'Bild konnte nicht geladen werden (' + short(img.dataset.src ?? img.src) + ') – anderes Bild wählen' });
    const box = img.parentElement;
    img.remove();
    if (box) box.style.background = 'linear-gradient(135deg,#9AA0AB 0%,#C9CDD4 100%)';
  }
  // Prüfschritte: einpassen → einheitliche Titel → Kontrast korrigieren → Qualität → Einheitlichkeit
  slides.forEach((s, i) => fitSlide(s, i, d.fontSlack, warn));
  unifyTitles(slides, specs, warn);
  slides.forEach((s, i) => fixContrast(s, i, warn));
  slides.forEach((s, i) => qualitySlide(s, specs[i], i, warn));
  consistencyChecks(specs, titleSizes(slides, specs), warn);
  return { host, slides, warnings };
}

/** Nur prüfen (für check_deck): alle Prüfschritte, kein Export. */
export async function measureDeck(specs: SlideSpec[], d: Design, indices: number[]): Promise<Warning[]> {
  const { host, warnings } = await prepare(specs, d, indices);
  host.remove();
  return warnings;
}

/** Baut Folien und liefert die .pptx als base64 samt Qualitätswarnungen. */
export async function buildDeck(specs: SlideSpec[], d: Design, startIndex = 0): Promise<BuildResult> {
  const { host, slides, warnings } = await prepare(specs, d, specs.map((_, i) => startIndex + i));
  try {
    const blob = await exportToPptx(slides, {
      skipDownload: true,
      autoEmbedFonts: false,
      svgAsVector: true,
      width: SLIDE_W_IN,
      height: SLIDE_H_IN,
      onSlide: (slide, root) => {
        const rr = root.getBoundingClientRect();
        const s = SLIDE_W_IN / rr.width;
        // Weiche Farbflächen als native Ellipsen (Weiche Kanten folgen im XML-Nachlauf)
        root.querySelectorAll<HTMLElement>('[data-soft]').forEach((el) => {
          const b = JSON.parse(el.dataset.soft ?? '{}') as { name: string; x: number; y: number; s: number; color: string; op: number; blur: number };
          const grow = b.blur * 0.9;
          const radEmu = Math.round(b.blur * 1.25 * 0.75 * 12700);
          slide.addShape('ellipse', {
            x: (b.x - grow / 2) * (SLIDE_W_IN / W),
            y: (b.y - grow / 2) * (SLIDE_W_IN / W),
            w: (b.s + grow) * (SLIDE_W_IN / W),
            h: (b.s + grow) * (SLIDE_W_IN / W),
            fill: { color: b.color, transparency: Math.round((1 - b.op) * 100) },
            line: { type: 'none' },
            objectName: `__soft_${radEmu}__${b.name}`,
          } as PptxGenJS.ShapeProps);
        });
        root.querySelectorAll<HTMLElement>('[data-chart]').forEach((el) => {
          const r = el.getBoundingClientRect();
          let spec: ChartSpec = {};
          try {
            spec = JSON.parse(decodeURIComponent(el.dataset.chart ?? ''));
          } catch {
            /* leer */
          }
          addChart(slide, spec, { x: (r.left - rr.left) * s, y: (r.top - rr.top) * s, w: r.width * s, h: r.height * s }, d);
        });
      },
    });
    const base64 = await postProcess(blob, specs.map((s) => s.transition ?? d.transition));
    return { base64, warnings };
  } finally {
    host.remove();
  }
}
