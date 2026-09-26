// Werkzeuge, mit denen das Modell Word über Office.js liest und bearbeitet.
(function () {
  const BUILTIN_STYLES = {
    normal: "Normal",
    standard: "Normal",
    title: "Title",
    titel: "Title",
    subtitle: "Subtitle",
    untertitel: "Subtitle",
    quote: "Quote",
    zitat: "Quote",
    intensequote: "IntenseQuote",
    listparagraph: "ListParagraph",
    listbullet: "ListBullet",
    bullet: "ListBullet",
    aufzählung: "ListBullet",
    listnumber: "ListNumber",
    numbered: "ListNumber",
    nummerierung: "ListNumber",
  };
  for (let i = 1; i <= 9; i++) {
    BUILTIN_STYLES[`heading${i}`] = `Heading${i}`;
    BUILTIN_STYLES[`überschrift${i}`] = `Heading${i}`;
    BUILTIN_STYLES[`h${i}`] = `Heading${i}`;
  }
  const ALIGN = { left: "Left", center: "Centered", right: "Right", justify: "Justified" };

  function applyStyle(paragraph, style) {
    const key = String(style || "Normal").toLowerCase().replace(/[\s_-]/g, "");
    if (BUILTIN_STYLES[key]) paragraph.styleBuiltIn = BUILTIN_STYLES[key];
    else paragraph.style = style; // benutzerdefinierte oder lokalisierte Formatvorlage
  }

  function applyFont(font, a) {
    if (a.bold != null) font.bold = !!a.bold;
    if (a.italic != null) font.italic = !!a.italic;
    if (a.underline != null) font.underline = a.underline ? "Single" : "None";
    if (a.font_size != null) font.size = Number(a.font_size);
    if (a.font_name) font.name = a.font_name;
    if (a.color) font.color = a.color;
    if (a.highlight_color !== undefined) font.highlightColor = a.highlight_color === "none" ? null : a.highlight_color;
  }

  async function getParagraphs(ctx) {
    const ps = ctx.document.body.paragraphs;
    ps.load("items/text");
    await ctx.sync();
    return ps.items;
  }

  function pick(items, index) {
    const i = Number(index) - 1;
    if (!(i >= 0 && i < items.length)) {
      throw new Error(`Absatz ${index} existiert nicht (das Dokument hat ${items.length} Absätze).`);
    }
    return items[i];
  }

  function rangeOf(items, start, end) {
    const s = Number(start);
    const e = Number(end ?? start);
    pick(items, s);
    pick(items, e);
    return items.slice(s - 1, e);
  }

  const idx = (d) => ({ type: "integer", description: d || "Absatznummer, beginnend bei 1 (aus get_document_overview)" });
  const fontParams = {
    bold: { type: "boolean" },
    italic: { type: "boolean" },
    underline: { type: "boolean" },
    font_size: { type: "number", description: "Schriftgröße in pt" },
    font_name: { type: "string" },
    color: { type: "string", description: "Textfarbe als Hex, z.B. #C00000" },
    highlight_color: { type: "string", description: "Hervorhebung als Hex oder Name (z.B. Yellow), 'none' entfernt sie" },
  };
  const styleParam = {
    type: "string",
    description: "Formatvorlage: Normal, Heading1–Heading9, Title, Subtitle, Quote, ListBullet, ListNumber oder Name einer Dokumentvorlage",
  };

  const tools = [
    {
      name: "get_document_overview",
      description:
        "Liefert die Absätze des Dokuments mit Nummer, Formatvorlage und Text. Immer zuerst aufrufen, bevor du etwas änderst. Bei langen Dokumenten mit start/count blättern.",
      parameters: {
        type: "object",
        properties: {
          start: idx("Erster Absatz (Standard 1)"),
          count: { type: "integer", description: "Anzahl Absätze (Standard 150)" },
          max_chars: { type: "integer", description: "Max. Zeichen pro Absatz (Standard 400)" },
        },
      },
      run: (a) =>
        Word.run(async (ctx) => {
          const ps = ctx.document.body.paragraphs;
          ps.load("items/text,items/style,items/isListItem,items/tableNestingLevel");
          await ctx.sync();
          const start = Math.max(1, Number(a.start || 1));
          const count = Number(a.count || 150);
          const max = Number(a.max_chars || 400);
          const list = ps.items.slice(start - 1, start - 1 + count).map((p, i) => {
            const d = { n: start + i, style: p.style, text: p.text.length > max ? p.text.slice(0, max) + " …" : p.text };
            if (p.isListItem) d.list = true;
            if (p.tableNestingLevel > 0) d.in_table = true;
            return d;
          });
          return { paragraph_count: ps.items.length, paragraphs: list };
        }),
    },
    {
      name: "get_selection",
      description: "Liefert den aktuell markierten Text und die betroffenen Absatznummern.",
      parameters: { type: "object", properties: {} },
      run: () =>
        Word.run(async (ctx) => {
          const sel = ctx.document.getSelection();
          sel.load("text");
          const selParas = sel.paragraphs;
          selParas.load("items/text");
          const all = ctx.document.body.paragraphs;
          all.load("items/text");
          await ctx.sync();
          // Absatznummern über Positionsvergleich ermitteln
          const numbers = [];
          if (selParas.items.length) {
            const cmp = all.items.map((p) => p.getRange().compareLocationWith(selParas.items[0].getRange()));
            await ctx.sync();
            const first = cmp.findIndex((c) => c.value === "Equal");
            if (first >= 0) for (let i = 0; i < selParas.items.length; i++) numbers.push(first + 1 + i);
          }
          return { text: sel.text, paragraphs: numbers };
        }),
    },
    {
      name: "replace_selection",
      description: "Ersetzt den markierten Text durch neuen Text.",
      parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      run: (a) =>
        Word.run(async (ctx) => {
          ctx.document.getSelection().insertText(a.text, "Replace");
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "insert_paragraphs",
      description:
        "Fügt einen oder mehrere Absätze ein – am Anfang, am Ende oder vor/nach einem bestimmten Absatz. Jeder Absatz kann eine Formatvorlage haben (z.B. Heading1, ListBullet).",
      parameters: {
        type: "object",
        properties: {
          paragraphs: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" }, style: styleParam },
              required: ["text"],
            },
          },
          location: { type: "string", enum: ["end", "start", "after", "before"], description: "Standard: end" },
          paragraph_index: idx("Bezugsabsatz bei location after/before"),
        },
        required: ["paragraphs"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          const body = ctx.document.body;
          const location = a.location || "end";
          const items = a.paragraphs || [];
          if (!items.length) throw new Error("paragraphs ist leer.");
          let prev;
          if (location === "end") {
            prev = body.insertParagraph(items[0].text, "End");
          } else if (location === "start") {
            prev = body.insertParagraph(items[0].text, "Start");
          } else {
            const target = pick(await getParagraphs(ctx), a.paragraph_index);
            prev = target.insertParagraph(items[0].text, location === "after" ? "After" : "Before");
          }
          applyStyle(prev, items[0].style);
          for (const item of items.slice(1)) {
            prev = prev.insertParagraph(item.text, "After");
            applyStyle(prev, item.style);
          }
          await ctx.sync();
          return { inserted: items.length };
        }),
    },
    {
      name: "set_paragraph_text",
      description: "Ersetzt den kompletten Text eines Absatzes (Formatvorlage bleibt erhalten).",
      parameters: {
        type: "object",
        properties: { paragraph_index: idx(), text: { type: "string" } },
        required: ["paragraph_index", "text"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          pick(await getParagraphs(ctx), a.paragraph_index).insertText(a.text, "Replace");
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "set_paragraph_style",
      description: "Weist einem oder mehreren Absätzen eine Formatvorlage zu.",
      parameters: {
        type: "object",
        properties: { start: idx(), end: idx("Letzter Absatz (optional)"), style: styleParam },
        required: ["start", "style"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          const ps = rangeOf(await getParagraphs(ctx), a.start, a.end);
          ps.forEach((p) => applyStyle(p, a.style));
          await ctx.sync();
          return { changed: ps.length };
        }),
    },
    {
      name: "format_paragraphs",
      description: "Formatiert Absätze direkt (fett, kursiv, Größe, Farbe, Hervorhebung, Ausrichtung).",
      parameters: {
        type: "object",
        properties: {
          start: idx(),
          end: idx("Letzter Absatz (optional)"),
          ...fontParams,
          alignment: { type: "string", enum: ["left", "center", "right", "justify"] },
        },
        required: ["start"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          const ps = rangeOf(await getParagraphs(ctx), a.start, a.end);
          ps.forEach((p) => {
            applyFont(p.font, a);
            if (a.alignment) p.alignment = ALIGN[a.alignment];
          });
          await ctx.sync();
          return { changed: ps.length };
        }),
    },
    {
      name: "delete_paragraphs",
      description: "Löscht einen oder mehrere Absätze.",
      parameters: {
        type: "object",
        properties: { start: idx(), end: idx("Letzter Absatz (optional)") },
        required: ["start"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          const ps = rangeOf(await getParagraphs(ctx), a.start, a.end);
          ps.reverse().forEach((p) => p.delete());
          await ctx.sync();
          return { deleted: ps.length };
        }),
    },
    {
      name: "search_and_replace",
      description: "Sucht einen Text im ganzen Dokument und ersetzt alle Vorkommen.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Suchtext (max. 255 Zeichen)" },
          replace: { type: "string" },
          match_case: { type: "boolean" },
          whole_word: { type: "boolean" },
        },
        required: ["search", "replace"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          const results = ctx.document.body.search(a.search, { matchCase: !!a.match_case, matchWholeWord: !!a.whole_word });
          results.load("items");
          await ctx.sync();
          results.items.forEach((r) => r.insertText(a.replace, "Replace"));
          await ctx.sync();
          return { replaced: results.items.length };
        }),
    },
    {
      name: "format_text",
      description: "Formatiert alle Vorkommen eines bestimmten Textes (z.B. einen Begriff fett oder farbig machen).",
      parameters: {
        type: "object",
        properties: { search: { type: "string" }, match_case: { type: "boolean" }, ...fontParams },
        required: ["search"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          const results = ctx.document.body.search(a.search, { matchCase: !!a.match_case });
          results.load("items");
          await ctx.sync();
          results.items.forEach((r) => applyFont(r.font, a));
          await ctx.sync();
          return { formatted: results.items.length };
        }),
    },
    {
      name: "insert_table",
      description: "Fügt eine Tabelle ein (erste Zeile = Kopfzeile), am Ende oder nach einem Absatz.",
      parameters: {
        type: "object",
        properties: {
          values: { type: "array", items: { type: "array", items: { type: "string" } }, description: "2D-Array der Zellwerte" },
          after_paragraph: idx("Absatz, nach dem die Tabelle eingefügt wird (optional, sonst am Ende)"),
        },
        required: ["values"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          const rows = a.values.length;
          const cols = Math.max(...a.values.map((r) => r.length));
          const values = a.values.map((r) => Array.from({ length: cols }, (_, i) => String(r[i] ?? "")));
          let table;
          if (a.after_paragraph) {
            table = pick(await getParagraphs(ctx), a.after_paragraph).insertTable(rows, cols, "After", values);
          } else {
            table = ctx.document.body.insertTable(rows, cols, "End", values);
          }
          table.headerRowCount = 1;
          try {
            table.styleBuiltIn = "GridTable4_Accent1";
            await ctx.sync();
          } catch {
            await ctx.sync();
          }
          return { rows, cols };
        }),
    },
    {
      name: "add_comment",
      description: "Fügt einen Kommentar an einem Absatz oder an einer Textstelle ein (z.B. für Feedback statt direkter Änderung).",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Kommentartext" },
          paragraph_index: idx("Absatz (alternativ zu search)"),
          search: { type: "string", description: "Textstelle, die kommentiert werden soll (erstes Vorkommen)" },
        },
        required: ["text"],
      },
      run: (a) =>
        Word.run(async (ctx) => {
          let range;
          if (a.search) {
            const results = ctx.document.body.search(a.search);
            results.load("items");
            await ctx.sync();
            if (!results.items.length) throw new Error(`Text '${a.search}' nicht gefunden.`);
            range = results.items[0];
          } else if (a.paragraph_index) {
            range = pick(await getParagraphs(ctx), a.paragraph_index).getRange();
          } else {
            throw new Error("paragraph_index oder search angeben.");
          }
          range.insertComment(a.text);
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "insert_page_break",
      description: "Fügt nach einem Absatz einen Seitenumbruch ein.",
      parameters: { type: "object", properties: { after_paragraph: idx() }, required: ["after_paragraph"] },
      run: (a) =>
        Word.run(async (ctx) => {
          pick(await getParagraphs(ctx), a.after_paragraph).insertBreak("Page", "After");
          await ctx.sync();
          return { ok: true };
        }),
    },
  ];

  window.HostTools = window.HostTools || {};
  window.HostTools.Word = {
    label: "Word",
    prompt: `Du arbeitest in einem Word-Dokument.
- Rufe zuerst get_document_overview auf (Absatznummern!). Nach Einfügen/Löschen verschieben sich die Nummern – bei Bedarf neu abrufen.
- Nutze Formatvorlagen (Heading1, Heading2, ListBullet, ...) statt manueller Formatierung.
- Schreibe KEIN Markdown (#, **, -) in den Dokumenttext; Struktur kommt über Formatvorlagen.
- Für Überarbeitungsvorschläge ohne direkte Änderung: add_comment.`,
    suggestions: [
      "Fasse dieses Dokument in 5 Stichpunkten zusammen",
      "Verbessere Stil und Rechtschreibung des markierten Texts",
      "Gliedere das Dokument mit sinnvollen Überschriften",
      "Schreibe eine Einleitung für dieses Dokument",
    ],
    tools,
  };
})();
