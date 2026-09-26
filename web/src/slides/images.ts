// Fotos für Folien: Suche über den lokalen Server (Openverse, frei lizenziert:
// kommerzielle Nutzung und Bearbeitung erlaubt), Laden über /img/fetch (gleiche
// Herkunft → der Zuschnitt im Canvas funktioniert). Treffer bekommen kurze IDs
// („img3“), die das Modell in den Folien verwendet.

export interface ImageHit {
  id: string;
  url: string;
  thumb: string;
  width: number | null;
  height: number | null;
  title: string;
  creator: string;
  license: string;
  source: string;
  page: string;
}

const registry = new Map<string, ImageHit>();
let counter = 0;

/** Bildnachweis (CC-Lizenzen verlangen Urheber + Lizenz) */
export function creditOf(hit: Pick<ImageHit, 'creator' | 'license' | 'source'>): string {
  const who = hit.creator || hit.source || 'unbekannt';
  const lic = hit.license.toUpperCase();
  const label = !lic ? '' : lic.startsWith('CC0') ? 'CC0' : lic.startsWith('PDM') ? 'Public Domain' : `CC ${hit.license}`;
  return `Foto: ${who}${label ? ` · ${label}` : ''}`;
}

/** Bildquelle für <img>: IDs und Web-Adressen laufen über den Server, data:-URLs direkt. */
export function imageSrc(ref: string | undefined): string {
  if (!ref) return '';
  const hit = registry.get(ref.trim());
  const url = hit?.url ?? ref.trim();
  if (url.startsWith('data:') || url.startsWith('/img/')) return url;
  if (/^https?:\/\//i.test(url)) return `/img/fetch?url=${encodeURIComponent(url)}`;
  return '';
}

/** ID → dauerhafte Angaben (URL + Nachweis) für die gespeicherte Folien-Spezifikation. */
export function resolveImageRef(ref: unknown): { url: string; credit?: string } | null {
  if (typeof ref !== 'string' || !ref.trim()) return null;
  const hit = registry.get(ref.trim());
  if (hit) return { url: hit.url, credit: creditOf(hit) };
  if (/^(https?:\/\/|data:image\/)/i.test(ref.trim())) return { url: ref.trim() };
  return null;
}

export function isKnownImageId(ref: unknown) {
  return typeof ref === 'string' && registry.has(ref.trim());
}

export async function searchImages(query: string, n = 6, aspect?: 'wide' | 'tall' | 'square'): Promise<ImageHit[]> {
  const params = new URLSearchParams({ q: query, n: String(n) });
  if (aspect) params.set('aspect', aspect);
  const res = await fetch(`/img/search?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Bildsuche fehlgeschlagen (HTTP ${res.status})`);
  const hits: ImageHit[] = (data.results ?? []).map((r: Omit<ImageHit, 'id'>) => {
    // Gleiches Bild → gleiche ID
    for (const [id, h] of registry) if (h.url === r.url) return { ...r, id };
    const id = `img${++counter}`;
    const hit = { ...r, id };
    registry.set(id, hit);
    return hit;
  });
  return hits;
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 15000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/** Kontaktbogen: alle Treffer in einem Bild mit ihrer ID – so sieht das Modell die
 *  Auswahl mit einer einzigen Bildnachricht. */
export async function contactSheet(all: ImageHit[]): Promise<{ url: string; hits: ImageHit[] } | null> {
  if (!all.length) return null;
  // Vorschaubild, notfalls das Original; nicht ladbare Treffer fallen weg
  const loaded = await Promise.all(all.map(async (h) => (h.thumb ? await loadImg(imageSrc(h.thumb)) : null) ?? loadImg(imageSrc(h.url))));
  const hits = all.filter((_, i) => loaded[i]);
  const imgs = loaded.filter((x): x is HTMLImageElement => !!x);
  if (!hits.length) return null;
  const cols = Math.min(3, hits.length);
  const rows = Math.ceil(hits.length / cols);
  const tw = 360;
  const th = 240;
  const pad = 8;
  const canvas = document.createElement('canvas');
  canvas.width = cols * (tw + pad) + pad;
  canvas.height = rows * (th + pad) + pad;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#222';
  g.fillRect(0, 0, canvas.width, canvas.height);
  imgs.forEach((img, i) => {
    const x = pad + (i % cols) * (tw + pad);
    const y = pad + Math.floor(i / cols) * (th + pad);
    if (img) {
      const s = Math.max(tw / img.width, th / img.height);
      const w = img.width * s;
      const h = img.height * s;
      g.save();
      g.beginPath();
      g.rect(x, y, tw, th);
      g.clip();
      g.drawImage(img, x + (tw - w) / 2, y + (th - h) / 2, w, h);
      g.restore();
    } else {
      g.fillStyle = '#555';
      g.fillRect(x, y, tw, th);
    }
    const label = hits[i].id;
    g.font = 'bold 22px Segoe UI';
    const lw = g.measureText(label).width + 16;
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(x, y, lw, 32);
    g.fillStyle = '#fff';
    g.fillText(label, x + 8, y + 24);
  });
  return { url: canvas.toDataURL('image/jpeg', 0.82), hits };
}

/** Wartet, bis alle Fotos einer gerenderten Folie geladen sind; liefert die fehlgeschlagenen. */
export async function waitForImages(root: HTMLElement): Promise<HTMLImageElement[]> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  const failed: HTMLImageElement[] = [];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            if (!img.naturalWidth) failed.push(img);
            return resolve();
          }
          const timer = setTimeout(() => {
            failed.push(img);
            resolve();
          }, 20000);
          img.onload = () => {
            clearTimeout(timer);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timer);
            failed.push(img);
            resolve();
          };
        }),
    ),
  );
  return failed;
}
