# Talos365

KI-Assistent als Seitenleiste für **Word, PowerPoint und Excel** – mit einem Modell, das im
eigenen Netz läuft (z. B. vLLM, beliebiger OpenAI-kompatibler Server). Das Modell liest und
bearbeitet das geöffnete Dokument über Werkzeuge (Tool-Calling). Die Oberfläche folgt dem Design
von [Talos](#talos-anbindung-optional): gleicher Composer, gleiche Denk-Animation, gleiche
Darstellung von Gedanken und Werkzeugaufrufen.

In PowerPoint gestaltet eine eigene Design-Engine echte, bearbeitbare Folien (17 Stile, 40 Layouts
mit Varianten, native Diagramme, Office-Icons, optionale Fotos) und prüft sie selbst.

## Voraussetzungen

- Windows mit Microsoft 365 (Word, PowerPoint, Excel) und Node.js ≥ 20
- Ein OpenAI-kompatibler Modellserver mit Tool-Calling, z. B. vLLM
- Optional: [Talos](#talos-anbindung-optional) für Websuche, Skills und Wissensdatenbank,
  ein OpenAI-kompatibler Spracherkennungs-Endpunkt (z. B. Qwen3-ASR) für das Diktat

## Einrichtung

```
npm.cmd run setup      # Abhängigkeiten (Server + Oberfläche)
npm.cmd run build      # Oberfläche nach dist/ bauen
npm.cmd run certs      # lokales HTTPS-Zertifikat (Windows fragt nach)
npm.cmd run register   # Add-in bei Office anmelden
```

## Benutzen

1. `npm.cmd start` – startet den Server auf https://localhost:3000 (vor Office starten)
2. Word / PowerPoint / Excel → Registerkarte **Start** → **Talos**
3. Beim ersten Mal: Zahnrad → **Server** → Adresse des Modellservers eintragen (z. B.
   `http://mein-server:8000/v1`), optional Talos und Spracherkennung → Speichern

Die Adressen liegen nur lokal in `config.json` (nicht im Git). Alternativ Umgebungsvariablen:
`LLM_URL`, `LLM_API_KEY`, `TALOS_URL`, `TALOS_TOKEN`, `ASR_URL`, `ASR_MODEL`, `TALOS_BRAND`.

Nach Änderungen an `manifest.xml` oder den Menüband-Icons (Office vorher schließen):
`npm.cmd run refresh-addin` – meldet ab, leert den Office-Add-in-Cache und meldet neu an.

## Funktionen

- **Befehle:** „/“ im Eingabefeld, z. B. `/deck`, `/deck-refresh`, `/analysis`, `/summary`,
  `/research`, `/polish` (PowerPoint); eigene für Word und Excel (`web/src/lib/commands.ts`).
- **Auswahl:** Was man im Dokument aktiv auswählt (Folien/Formen, Text, Zellbereich), erscheint
  als Leiste über dem Eingabefeld und geht mit der nächsten Nachricht an das Modell – in PowerPoint
  mit Bild der Folie (`web/src/lib/selection.ts`).
- **Rückfragen:** Das Modell kann mit `ask_user` bis zu 3 Fragen mit Antwortoptionen stellen
  (Popup, Klick oder Taste 1–9, eigene Antwort, Überspringen).
- **Diktat:** Mikrofon im Eingabefeld; Audio geht als 16-kHz-WAV an den Spracherkennungs-Endpunkt.
  In der Desktop-App fragt Windows/Office nach dem Mikrofon.
- **Chatverlauf:** lokal gespeichert, je App getrennt.
- **Websuche mit Quellen** (über Talos): nummerierte Quellen, das Modell zitiert mit `[n]`.

## Talos-Anbindung (optional)

Talos ist eine Chat-Plattform mit MCP-Endpunkt. Ist in den Einstellungen eine Talos-Adresse
eingetragen, bekommen alle Apps zusätzlich:

| Werkzeug | Quelle |
|---|---|
| `web_search`, `web_fetch` | Internet über Talos' SearXNG |
| `list_skills`, `read_skill` | Talos-Skill-Bibliothek und lokale Skill-Ordner |
| `knowledge_search` | Talos-Wissensdatenbank (RAG) |

Lokale Skill-Ordner (je Unterordner eine `SKILL.md` mit `name`/`description` im YAML-Kopf):
`skills/` in diesem Projekt, `../Talos/sample_skills` und weitere per `TALOS_SKILLS_DIRS`
(mit `;` getrennt). Optionales Branding-Profil (Name + Logos) aus `../Talos/branding/<profil>`
bzw. `TALOS_BRANDING_DIR`; ohne Profil erscheint das Talos-Schiff.

## Folien-Design (PowerPoint)

Das Modell baut keine Folien aus Einzelformen, sondern beschreibt Layout + Inhalt (JSON); die
Design-Engine (`web/src/slides/`) gestaltet daraus echte PowerPoint-Folien:
HTML/CSS (1280 × 720 px) → im Browser rendern → Text einpassen → prüfen → `dom-to-pptx` wandelt
in native Formen/Textfelder um → native Diagramme per pptxgenjs → `insertSlidesFromBase64`.

| Datei | Zweck |
|---|---|
| `styles.ts` | 17 Stile + 22 Paletten; `style: "auto"` übernimmt Farben/Schriften der offenen Präsentation |
| `layouts.ts` | 40 Layouts, viele mit Varianten; Auswahl über die Design-Signatur der Präsentation |
| `kit.ts` | Bausteine: Text mit Einpassung, Karten, Icons, Illustrationen, Hintergründe, Fotos |
| `check.ts` | Prüfschritte: Kontrast automatisch korrigieren, einheitliche Titel, Einheitlichkeit über das Deck |
| `render.ts` | Render-Pipeline, Qualitätsprüfung (Überlauf, Überlappung, Randabstand), Diagramme |
| `images.ts` | Fotosuche (Openverse, nur Lizenzen mit kommerzieller Nutzung + Bearbeitung), Bildnachweis |
| `icons.ts` | Microsoft Fluent UI Icons |
| `deck.ts` | Einfügen/Ersetzen in PowerPoint; merkt sich die Spezifikation je Folie |
| `reference.ts` | Vorlagen-Modus: vorhandene Folien analysieren und befüllen |
| `tools.ts` | Werkzeuge (plan_deck, search_images, create_slides, review_slides, update_slide, check_deck …) + Design-Anleitung |
| `src/vendor/dom-to-pptx.js` | dom-to-pptx 2.1.2 (MIT) mit markierten Anpassungen |

Schriften: nur Windows-Standardschriften, damit Browser-Messung und PowerPoint übereinstimmen.

## Aufbau

| Pfad | Zweck |
|---|---|
| `manifest.xml` | Add-in-Manifest (Word, PowerPoint, Excel) |
| `server.js` | HTTPS-Server: Oberfläche, Proxys zu Modell, Talos und Spracherkennung, Bildsuche, `/config` |
| `web/src/agent.ts` | Agent-Loop mit Streaming (Gedanken, Text, Tool-Calls) |
| `web/src/components/` | Oberfläche (Messages, Composer, ToolGroup, Einstellungen …) |
| `web/public/tools-*.js` | Office-Werkzeuge je App |

Nach Änderungen an `web/`: `npm.cmd run build`. Ein neues Werkzeug braucht einen Eintrag in
`web/public/tools-*.js`, eine Familie in `web/src/lib/toolLabels.ts` und Texte in `web/src/i18n.ts`.
