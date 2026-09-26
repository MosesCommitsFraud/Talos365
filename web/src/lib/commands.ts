// Befehle („/deck-refresh“ …): Kurzform im Composer, dahinter eine ausführliche Anweisung
// für das Modell. Der Chat zeigt, was der Nutzer getippt hat; das Modell bekommt die Anweisung.
import { create } from 'zustand';

export interface Command {
  name: string;
  description: string;
  /** Braucht der Befehl eine Angabe (z. B. ein Thema)? Dann wird er nur eingesetzt, nicht gesendet. */
  needsArg?: boolean;
  argHint?: string;
  /** Anweisung ans Modell; {arg} = Text hinter dem Befehl */
  prompt: string;
}

const COMMANDS: Record<string, Command[]> = {
  PowerPoint: [
    { name: 'deck', description: 'Neue Präsentation zu einem Thema', needsArg: true, argHint: 'Thema, Publikum, Umfang …', prompt: 'Erstelle eine neue Präsentation: {arg}' },
    { name: 'deck-refresh', description: 'Präsentation modern neu gestalten', prompt: 'Gestalte die geöffnete Präsentation modern neu. Lies zuerst alle Folien (get_presentation_overview), übernimm die Inhalte vollständig und sinngemäß, wähle einen passenden Stil und baue die Folien mit create_slides neu am Ende ein. Frage danach mit ask_user, ob die alten Folien gelöscht werden sollen. {arg}' },
    { name: 'analysis', description: 'Präsentation analysieren und Feedback geben', prompt: 'Analysiere die geöffnete Präsentation, ohne etwas zu ändern: Storyline und roter Faden, Kernbotschaften je Folie, Verständlichkeit, Textmenge, Design und Einheitlichkeit. Nenne die wichtigsten Stärken und konkrete Verbesserungen, priorisiert. {arg}' },
    { name: 'summary', description: 'Präsentation auf einer Folie zusammenfassen', prompt: 'Fasse die geöffnete Präsentation auf einer gestalteten Folie zusammen und füge sie am Ende ein. {arg}' },
    { name: 'research', description: 'Thema recherchieren und Folien mit Quellen bauen', needsArg: true, argHint: 'Thema', prompt: 'Recherchiere aktuelle, belastbare Fakten und Zahlen zu folgendem Thema im Internet und erstelle daraus gestaltete Folien mit Quellenangaben in den Notizen: {arg}' },
    { name: 'polish', description: 'Rechtschreibung, Einheitlichkeit und Lesbarkeit verbessern', prompt: 'Prüfe die geöffnete Präsentation auf Rechtschreibung, einheitliche Formulierungen, Lesbarkeit und Konsistenz und korrigiere, was nötig ist. Fasse die Änderungen kurz zusammen. {arg}' },
  ],
  Word: [
    { name: 'summary', description: 'Dokument zusammenfassen', prompt: 'Fasse das Dokument (oder die Auswahl) prägnant zusammen: Kernaussagen, Ergebnisse, offene Punkte. {arg}' },
    { name: 'rewrite', description: 'Text umformulieren', argHint: 'z. B. kürzer, formeller …', prompt: 'Formuliere die Auswahl (oder das Dokument) um: {arg}. Ändere den Text direkt im Dokument.' },
    { name: 'proofread', description: 'Korrekturlesen', prompt: 'Lies das Dokument Korrektur (Rechtschreibung, Grammatik, Zeichensetzung, Stil) und korrigiere direkt. Nenne die wichtigsten Änderungen. {arg}' },
    { name: 'analysis', description: 'Aufbau und Verständlichkeit analysieren', prompt: 'Analysiere das Dokument, ohne es zu ändern: Aufbau, Argumentation, Verständlichkeit, Lücken. Gib priorisierte Verbesserungsvorschläge. {arg}' },
    { name: 'outline', description: 'Gliederung erstellen', needsArg: true, argHint: 'Thema', prompt: 'Erstelle im Dokument eine sinnvolle Gliederung mit Überschriften für: {arg}' },
  ],
  Excel: [
    { name: 'analysis', description: 'Daten analysieren', prompt: 'Analysiere die Daten im aktiven Blatt (oder in der Auswahl): Struktur, Auffälligkeiten, Trends, Ausreißer. Nenne die wichtigsten Erkenntnisse mit Zahlen. {arg}' },
    { name: 'chart', description: 'Passendes Diagramm erstellen', prompt: 'Erstelle für die Daten (Auswahl oder aktives Blatt) ein passendes, gut beschriftetes Diagramm. {arg}' },
    { name: 'formula', description: 'Formel bauen', needsArg: true, argHint: 'Was soll berechnet werden?', prompt: 'Baue die passende Formel und trage sie ein: {arg}' },
    { name: 'clean', description: 'Daten bereinigen', prompt: 'Bereinige die Daten (Auswahl oder aktives Blatt): Leerzeichen, Duplikate, Formate, uneinheitliche Schreibweisen. Beschreibe vorher kurz, was du änderst. {arg}' },
    { name: 'summary', description: 'Zusammenfassung der Tabelle', prompt: 'Fasse den Inhalt der Arbeitsmappe kurz zusammen: Blätter, Zweck, wichtigste Kennzahlen. {arg}' },
  ],
};

export function commandsFor(host: string | null): Command[] {
  return (host && COMMANDS[host]) || [];
}

/** „/befehl rest“ → Anweisung fürs Modell (oder null, wenn kein bekannter Befehl) */
export function expandCommand(host: string | null, text: string): string | null {
  const m = /^\/([\w-]+)\s*([\s\S]*)$/.exec(text.trim());
  if (!m) return null;
  const cmd = commandsFor(host).find((c) => c.name === m[1].toLowerCase());
  if (!cmd) return null;
  return cmd.prompt.replace('{arg}', m[2].trim()).trim();
}

/** Text von außen in den Composer setzen (z. B. Klick auf einen Befehl im Startbildschirm) */
export const useComposerInject = create<{ value: string; nonce: number; inject: (value: string) => void }>()((set) => ({
  value: '',
  nonce: 0,
  inject: (value) => set((s) => ({ value, nonce: s.nonce + 1 })),
}));
