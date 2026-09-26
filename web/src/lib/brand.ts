// Branding-Profil wie in Talos (TALOS_BRAND): Name + Logos kommen vom lokalen Server,
// der sie aus Talos/branding/<profil> liest. Ohne Profil bleibt es „Talos“.
import { create } from 'zustand';
import i18n from '@/i18n';

export interface Brand {
  name: string;
  logoSmall: string | null;
  logoLarge: string | null;
}

export const useBrand = create<Brand & { loaded: boolean }>()(() => ({ name: 'Talos', logoSmall: null, logoLarge: null, loaded: false }));

export async function loadBrand() {
  try {
    const res = await fetch('/brand');
    if (!res.ok) throw new Error();
    const b = (await res.json()) as Brand;
    useBrand.setState({ ...b, loaded: true });
    // {{brand}} in allen Texten („Talos ist KI und kann Fehler machen …“)
    const interp = i18n.options.interpolation ?? {};
    interp.defaultVariables = { ...(interp.defaultVariables ?? {}), brand: b.name };
    i18n.options.interpolation = interp;
    document.title = b.name;
    void i18n.changeLanguage(i18n.language);
  } catch {
    useBrand.setState({ loaded: true });
  }
}

const svgCache = new Map<string, Promise<string>>();

/** SVG-Quelltext eines Logos (für die Inline-Einbindung, damit currentColor greift). */
export function logoSvg(url: string): Promise<string> {
  if (!svgCache.has(url)) {
    svgCache.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.text() : ''))
        .then((t) => (t.trim().startsWith('<svg') || t.includes('<svg') ? t : ''))
        .catch(() => ''),
    );
  }
  return svgCache.get(url)!;
}
