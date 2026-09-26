import type { HostToolset } from '@/lib/types';
import { DESIGN_PROMPT, designFinishCheck, designTools, designTurnStart } from '@/slides/tools';
import { TALOS_PROMPT, talosTools } from '@/talos';
import { ASK_PROMPT, askTool } from '@/lib/ask';

/** Werkzeuge je App. Alle Apps bekommen die Talos-Werkzeuge (Websuche über SearXNG,
 *  Skills, Wissensdatenbank). PowerPoint zusätzlich die Design-Engine; die alten
 *  Einzelfolien-Werkzeuge (add_slide, list_layouts) entfallen dort, damit das Modell
 *  neue Folien immer gestaltet statt sie aus Textfeldern zu bauen. */
export function getToolset(hostKey: string | null): HostToolset | null {
  const base = hostKey ? window.HostTools?.[hostKey] : undefined;
  if (!base) return null;
  if (hostKey !== 'PowerPoint') {
    return { ...base, prompt: base.prompt + TALOS_PROMPT + ASK_PROMPT, tools: [...base.tools, ...talosTools, askTool] };
  }
  const keep = base.tools.filter((t) => !['add_slide', 'list_layouts'].includes(t.name));
  return {
    ...base,
    prompt: DESIGN_PROMPT + TALOS_PROMPT + ASK_PROMPT,
    suggestions: [
      'Recherchiere aktuelle Zahlen zur 4-Tage-Woche und mach 8 Folien mit Fotos daraus',
      'Erstelle eine Präsentation über die Vorteile lokaler KI',
      'Mach aus dieser Präsentation ein modernes Design',
      'Fasse diese Präsentation auf einer Folie zusammen',
    ],
    tools: [...designTools, ...talosTools, askTool, ...keep],
    onTurnStart: designTurnStart,
    finishCheck: designFinishCheck,
  };
}
