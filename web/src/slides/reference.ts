// Vorlagen-Modus (nach PPTAgent / Copilot): Eine vorhandene, gut gestaltete Folie
// der Präsentation – z. B. aus der Firmenvorlage – wird dupliziert und ihre
// Textfelder werden neu befüllt. So bleibt das Firmendesign exakt erhalten.
import type { HostTool } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const PowerPoint: any;

const TEXT_TYPES = ['GeometricShape', 'TextBox', 'Placeholder', 'Callout'];
const round = (n: number) => Math.round(n);

async function slideIds(ctx: any): Promise<string[]> {
  const slides = ctx.presentation.slides;
  slides.load('items/id');
  await ctx.sync();
  return slides.items.map((s: any) => s.id as string);
}

/** Formen einer Folie mit Text (falls vorhanden), in Sammlungs-Reihenfolge. */
async function shapesOf(ctx: any, slide: any) {
  const shapes = slide.shapes;
  shapes.load('items/id,items/name,items/type,items/left,items/top,items/width,items/height');
  await ctx.sync();
  const out = [];
  for (const s of shapes.items) {
    let text: string | undefined;
    let size: number | undefined;
    if (TEXT_TYPES.includes(s.type)) {
      try {
        const tr = s.textFrame.textRange;
        tr.load('text,font/size');
        await ctx.sync();
        text = tr.text;
        size = tr.font.size ?? undefined;
      } catch {
        /* ohne Text */
      }
    }
    out.push({ id: s.id as string, name: s.name as string, type: s.type as string, left: s.left, top: s.top, width: s.width, height: s.height, text, size });
  }
  return out;
}

export const referenceTools: HostTool[] = [
  {
    name: 'analyze_template',
    description:
      'Analysiert die Folien der offenen Präsentation als Vorlagen-Bibliothek (z. B. Firmenvorlage): pro Folie Layoutname und Textfelder mit ID, Rolle, Position und Schriftgröße. Grundlage für clone_slide.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'integer', description: 'Erste Folie (Standard 1)' },
        count: { type: 'integer', description: 'Anzahl Folien (Standard 30)' },
      },
    },
    run: (a) =>
      PowerPoint.run(async (ctx: any) => {
        const slides = ctx.presentation.slides;
        slides.load('items/id');
        await ctx.sync();
        const from = Math.max(1, Number(a.from) || 1);
        const count = Math.min(60, Number(a.count) || 30);
        const chosen = slides.items.slice(from - 1, from - 1 + count);
        chosen.forEach((s: any) => s.layout.load('name'));
        await ctx.sync();
        const result = [];
        for (let i = 0; i < chosen.length; i++) {
          const shapes = await shapesOf(ctx, chosen[i]);
          const texts = shapes.filter((s) => s.text !== undefined);
          const maxSize = Math.max(0, ...texts.map((s) => s.size ?? 0));
          result.push({
            slide: from + i,
            layout: chosen[i].layout.name,
            text_fields: texts.map((s) => ({
              shape_id: s.id,
              role: s.size && s.size === maxSize && s.top < 200 ? 'titel' : s.top < 90 ? 'kopf' : 'inhalt',
              text: (s.text ?? '').slice(0, 80),
              pt: s.size ? round(s.size) : undefined,
              box: [round(s.left), round(s.top), round(s.width), round(s.height)],
            })),
            other_shapes: shapes.length - texts.length,
          });
        }
        return {
          slide_count: slides.items.length,
          slides: result,
          hinweis: 'Wähle passende Beispielfolien und befülle sie mit clone_slide. Texte in Länge und Stil an die Vorlage anpassen.',
        };
      }),
  },
  {
    name: 'clone_slide',
    description:
      'Dupliziert eine Beispielfolie der Präsentation (Firmendesign bleibt exakt erhalten) und ersetzt die Texte ausgewählter Textfelder. Textfelder ohne neuen Text, die nicht gebraucht werden, über delete_shape_ids entfernen.',
    parameters: {
      type: 'object',
      properties: {
        source_slide: { type: 'integer', description: 'Nummer der Beispielfolie' },
        after_slide: { type: 'integer', description: 'Einfügen nach dieser Folie (Standard: ans Ende)' },
        texts: {
          type: 'array',
          items: { type: 'object', properties: { shape_id: { type: 'string' }, text: { type: 'string' } }, required: ['shape_id', 'text'] },
          description: 'Neue Texte je shape_id der BEISPIELfolie (aus analyze_template)',
        },
        delete_shape_ids: { type: 'array', items: { type: 'string' }, description: 'Nicht benötigte Formen (IDs der Beispielfolie)' },
      },
      required: ['source_slide', 'texts'],
    },
    run: (a) =>
      PowerPoint.run(async (ctx: any) => {
        const before = await slideIds(ctx);
        const srcId = before[Number(a.source_slide) - 1];
        if (!srcId) throw new Error(`Folie ${a.source_slide} existiert nicht (die Präsentation hat ${before.length} Folien).`);
        const src = ctx.presentation.slides.getItem(srcId);
        const srcShapes = src.shapes;
        srcShapes.load('items/id');
        const exported = src.exportAsBase64();
        await ctx.sync();
        const targetNo = Number(a.after_slide) || before.length;
        const target = before[Math.min(targetNo, before.length) - 1];
        ctx.presentation.insertSlidesFromBase64(exported.value, { formatting: 'KeepSourceFormatting', ...(target ? { targetSlideId: target } : {}) });
        await ctx.sync();
        const after = await slideIds(ctx);
        const newId = after.find((id) => !before.includes(id));
        if (!newId) throw new Error('Die Folie konnte nicht dupliziert werden.');
        const copy = ctx.presentation.slides.getItem(newId);
        const copyShapes = copy.shapes;
        copyShapes.load('items/id');
        await ctx.sync();
        // IDs der Beispielfolie → Formen der Kopie (gleiche Reihenfolge)
        const map = new Map<string, any>();
        srcShapes.items.forEach((s: any, i: number) => {
          if (copyShapes.items[i]) map.set(String(s.id), copyShapes.items[i]);
        });
        const missing: string[] = [];
        for (const t of (a.texts as Array<{ shape_id: string; text: string }>) ?? []) {
          const shape = map.get(String(t.shape_id));
          if (!shape) {
            missing.push(String(t.shape_id));
            continue;
          }
          shape.textFrame.textRange.text = String(t.text ?? '');
        }
        for (const id of (a.delete_shape_ids as string[]) ?? []) map.get(String(id))?.delete();
        await ctx.sync();
        return { new_slide: after.indexOf(newId) + 1, ...(missing.length ? { unbekannte_shape_ids: missing } : {}), hinweis: 'Mit review_slides prüfen, ob die Texte in die Felder passen.' };
      }),
  },
];
