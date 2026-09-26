// Typen für die gepatchte dom-to-pptx-Kopie (MIT, siehe dom-to-pptx.LICENSE).
import type PptxGenJS from 'pptxgenjs';

export interface ExportOptions {
  fileName?: string;
  skipDownload?: boolean;
  autoEmbedFonts?: boolean;
  svgAsVector?: boolean;
  width?: number;
  height?: number;
  layout?: string;
  /** [Talos-Patch] Wird nach jeder Folie aufgerufen. */
  onSlide?: (slide: PptxGenJS.Slide, root: HTMLElement, pptx: PptxGenJS, index: number) => void | Promise<void>;
}

export function exportToPptx(target: HTMLElement | string | Array<HTMLElement | string>, options?: ExportOptions): Promise<Blob>;
