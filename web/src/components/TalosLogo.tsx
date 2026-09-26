import { useEffect, useState } from 'react';
import { logoSvg, useBrand } from '@/lib/brand';
import { cn } from '@/lib/utils';

/** Logo eines Branding-Profils, inline eingebunden: Flächen mit `fill: currentColor`
 *  nehmen die Textfarbe des Designs an (wie Talos BrandImage). */
export function BrandImage({ src, className, mono }: { src: string; className?: string; mono?: boolean }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    void logoSvg(src).then((t) => alive && setSvg(t));
    return () => {
      alive = false;
    };
  }, [src]);
  if (!svg) return <img src={src} alt="" className={cn(className, 'object-contain', mono && 'grayscale')} />;
  // Feste Größe aus dem SVG entfernen – die Box bestimmt die Größe
  const inline = svg.replace(/<svg([^>]*)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*)\sheight="[^"]*"/, '<svg$1');
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex items-center justify-center [&>svg]:h-full [&>svg]:w-full', mono && '[&_svg_*]:fill-current', className)}
      dangerouslySetInnerHTML={{ __html: inline }}
    />
  );
}

/** The Talos mark (matches the favicon): two stacked sails over a wave.
 *  Ein Branding-Profil ersetzt es durch sein `logo-small` – wie in Talos.
 *  `mono` färbt ein Marken-Logo einfarbig (für den ruhenden Chat-Marker). */
export function TalosLogo({ className, mono = false }: { className?: string; mono?: boolean }) {
  const logo = useBrand((s) => s.logoSmall);
  const loaded = useBrand((s) => s.loaded);
  // Bis das Branding geladen ist, nichts zeigen (sonst blitzt kurz das Talos-Logo auf)
  if (!loaded) return <span aria-hidden="true" className={cn('inline-block', className)} />;
  if (logo) return <BrandImage src={logo} className={cn(className, !mono && 'text-foreground')} mono={mono} />;
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M16 4L16 22L6 22Z" fill="currentColor" />
      <path d="M16 8L16 22L24 22Z" fill="currentColor" opacity="0.6" />
      <path d="M4 24Q10 20 16 24Q22 28 28 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Breites Logo (Kopfzeile), fällt auf Zeichen + Name zurück. */
export function BrandWordmark({ className }: { className?: string }) {
  const { logoLarge, name, loaded } = useBrand();
  if (!loaded) return <span aria-hidden="true" className={cn('inline-block', className)} />;
  if (logoLarge) return <BrandImage src={logoLarge} className={cn('text-foreground', className)} />;
  return (
    <span className="flex items-center gap-2">
      <TalosLogo className="size-5 shrink-0 text-primary" />
      <span className="text-[15px] font-semibold tracking-tight">{name}</span>
    </span>
  );
}
