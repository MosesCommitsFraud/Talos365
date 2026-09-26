// Werkzeuge, mit denen das Modell PowerPoint über Office.js liest und bearbeitet.
(function () {
  const TEXT_SHAPE_TYPES = ["GeometricShape", "TextBox", "Placeholder", "Callout"];
  const ALIGN = { left: "Left", center: "Center", right: "Right", justify: "Justify" };
  const round = (n) => Math.round(n * 10) / 10;

  async function getSlides(ctx) {
    const slides = ctx.presentation.slides;
    slides.load("items/id");
    await ctx.sync();
    return slides.items;
  }

  async function getSlide(ctx, number) {
    const slides = await getSlides(ctx);
    const i = Number(number) - 1;
    if (!(i >= 0 && i < slides.length)) {
      throw new Error(`Folie ${number} existiert nicht (die Präsentation hat ${slides.length} Folien).`);
    }
    return slides[i];
  }

  // Liest die Texte der Formen. Schlägt ein Sammel-Sync fehl, wird Form für Form gelesen.
  async function loadShapeTexts(ctx, shapes) {
    const texts = new Map();
    const candidates = shapes.filter((s) => TEXT_SHAPE_TYPES.includes(s.type));
    const ranges = candidates.map((s) => {
      const tr = s.textFrame.textRange;
      tr.load("text");
      return [s, tr];
    });
    try {
      await ctx.sync();
      ranges.forEach(([s, tr]) => texts.set(s.id, tr.text));
    } catch {
      for (const s of candidates) {
        try {
          const tr = s.textFrame.textRange;
          tr.load("text");
          await ctx.sync();
          texts.set(s.id, tr.text);
        } catch {
          /* Form ohne Text */
        }
      }
    }
    return texts;
  }

  function describeShapes(shapes, texts) {
    return shapes.map((s) => {
      const d = {
        id: s.id,
        name: s.name,
        type: s.type,
        left: round(s.left),
        top: round(s.top),
        width: round(s.width),
        height: round(s.height),
      };
      if (texts.has(s.id)) d.text = texts.get(s.id);
      return d;
    });
  }

  const SHAPE_PROPS = "items/id,items/name,items/type,items/left,items/top,items/width,items/height";

  function applyFont(font, a) {
    if (a.font_size != null) font.size = Number(a.font_size);
    if (a.bold != null) font.bold = !!a.bold;
    if (a.italic != null) font.italic = !!a.italic;
    if (a.underline != null) font.underline = a.underline ? "Single" : "None";
    if (a.color) font.color = a.color;
    if (a.font_name) font.name = a.font_name;
  }

  const slideParam = { type: "integer", description: "Foliennummer, beginnend bei 1" };
  const shapeParam = { type: "string", description: "ID der Form (aus get_presentation_overview)" };
  const fontParams = {
    font_size: { type: "number", description: "Schriftgröße in pt" },
    bold: { type: "boolean" },
    italic: { type: "boolean" },
    underline: { type: "boolean" },
    color: { type: "string", description: "Textfarbe als Hex, z.B. #1F4E79" },
    font_name: { type: "string", description: "Schriftart, z.B. Segoe UI" },
    align: { type: "string", enum: ["left", "center", "right", "justify"] },
  };
  const boxParams = {
    left: { type: "number", description: "Abstand vom linken Rand in pt" },
    top: { type: "number", description: "Abstand vom oberen Rand in pt" },
    width: { type: "number", description: "Breite in pt" },
    height: { type: "number", description: "Höhe in pt" },
  };

  const tools = [
    {
      name: "get_presentation_overview",
      description:
        "Liefert alle Folien mit Layout und allen Formen (ID, Name, Typ, Position, Größe, Text). Immer zuerst aufrufen, bevor du etwas änderst.",
      parameters: { type: "object", properties: {} },
      run: () =>
        PowerPoint.run(async (ctx) => {
          const slides = await getSlides(ctx);
          slides.forEach((s) => {
            s.layout.load("name");
            s.shapes.load(SHAPE_PROPS);
          });
          await ctx.sync();
          const allShapes = slides.flatMap((s) => s.shapes.items);
          const texts = await loadShapeTexts(ctx, allShapes);
          return {
            slide_count: slides.length,
            hinweis: "Koordinaten in pt. Standard-Foliengröße 16:9 = 960 x 540 pt (4:3 = 720 x 540).",
            slides: slides.map((s, i) => ({
              number: i + 1,
              id: s.id,
              layout: s.layout.name,
              shapes: describeShapes(s.shapes.items, texts),
            })),
          };
        }),
    },
    {
      name: "get_selection",
      description: "Liefert die aktuell markierten Folien, Formen und ggf. den markierten Text.",
      parameters: { type: "object", properties: {} },
      run: () =>
        PowerPoint.run(async (ctx) => {
          const all = await getSlides(ctx);
          const selSlides = ctx.presentation.getSelectedSlides();
          selSlides.load("items/id");
          const selShapes = ctx.presentation.getSelectedShapes();
          selShapes.load(SHAPE_PROPS);
          await ctx.sync();
          const texts = await loadShapeTexts(ctx, selShapes.items);
          let selectedText = null;
          try {
            const tr = ctx.presentation.getSelectedTextRange();
            tr.load("text");
            await ctx.sync();
            selectedText = tr.text || null;
          } catch {
            /* kein Text markiert */
          }
          return {
            selected_slides: selSlides.items.map((s) => all.findIndex((a) => a.id === s.id) + 1),
            selected_shapes: describeShapes(selShapes.items, texts),
            selected_text: selectedText,
          };
        }),
    },
    {
      name: "list_layouts",
      description: "Listet die verfügbaren Folienlayouts (z.B. 'Titelfolie', 'Titel und Inhalt') der Präsentation.",
      parameters: { type: "object", properties: {} },
      run: () =>
        PowerPoint.run(async (ctx) => {
          const masters = ctx.presentation.slideMasters;
          masters.load("items/id,items/name");
          await ctx.sync();
          masters.items.forEach((m) => m.layouts.load("items/id,items/name"));
          await ctx.sync();
          return masters.items.map((m) => ({ master: m.name, layouts: m.layouts.items.map((l) => l.name) }));
        }),
    },
    {
      name: "add_slide",
      description:
        "Fügt eine neue Folie hinzu. Gibt die Foliennummer und die Platzhalter-Formen (mit IDs) zurück, die du danach mit set_shape_text befüllen kannst.",
      parameters: {
        type: "object",
        properties: {
          layout: { type: "string", description: "Name des Layouts aus list_layouts (optional)" },
          position: { type: "integer", description: "Gewünschte Foliennummer der neuen Folie (optional, Standard: am Ende)" },
        },
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const options = {};
          if (a.layout) {
            const masters = ctx.presentation.slideMasters;
            masters.load("items/id");
            await ctx.sync();
            masters.items.forEach((m) => m.layouts.load("items/id,items/name"));
            await ctx.sync();
            const wanted = a.layout.toLowerCase();
            let found = null;
            const names = [];
            for (const m of masters.items) {
              for (const l of m.layouts.items) {
                names.push(l.name);
                if (!found && l.name.toLowerCase() === wanted) found = { layoutId: l.id, slideMasterId: m.id };
              }
            }
            if (!found) {
              for (const m of masters.items) {
                const l = m.layouts.items.find((x) => x.name.toLowerCase().includes(wanted));
                if (l) {
                  found = { layoutId: l.id, slideMasterId: m.id };
                  break;
                }
              }
            }
            if (!found) throw new Error(`Layout '${a.layout}' nicht gefunden. Verfügbar: ${names.join(", ")}`);
            Object.assign(options, found);
          }
          ctx.presentation.slides.add(options);
          await ctx.sync();
          let slides = await getSlides(ctx);
          let slide = slides[slides.length - 1];
          let number = slides.length;
          let note;
          if (a.position && Number(a.position) < slides.length) {
            try {
              slide.moveTo(Number(a.position) - 1);
              await ctx.sync();
              number = Number(a.position);
            } catch (e) {
              note = "Verschieben wird von dieser PowerPoint-Version nicht unterstützt; Folie liegt am Ende.";
            }
          }
          slide.shapes.load(SHAPE_PROPS);
          await ctx.sync();
          const texts = await loadShapeTexts(ctx, slide.shapes.items);
          return { number, id: slide.id, shapes: describeShapes(slide.shapes.items, texts), note };
        }),
    },
    {
      name: "delete_slide",
      description: "Löscht eine Folie.",
      parameters: { type: "object", properties: { slide: slideParam }, required: ["slide"] },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          slide.delete();
          await ctx.sync();
          return { deleted_slide: a.slide };
        }),
    },
    {
      name: "move_slide",
      description: "Verschiebt eine Folie an eine neue Position.",
      parameters: {
        type: "object",
        properties: { slide: slideParam, new_position: { type: "integer", description: "Neue Foliennummer" } },
        required: ["slide", "new_position"],
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          slide.moveTo(Number(a.new_position) - 1);
          await ctx.sync();
          return { moved: a.slide, to: a.new_position };
        }),
    },
    {
      name: "set_shape_text",
      description:
        "Ersetzt den Text einer Form oder eines Platzhalters. Zeilenumbrüche mit \\n erzeugen neue Absätze (z.B. für Aufzählungen im Inhaltsplatzhalter).",
      parameters: {
        type: "object",
        properties: { slide: slideParam, shape_id: shapeParam, text: { type: "string" } },
        required: ["slide", "shape_id", "text"],
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          slide.shapes.getItem(String(a.shape_id)).textFrame.textRange.text = a.text;
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "format_text",
      description: "Formatiert den gesamten Text einer Form (Größe, fett, Farbe, Schriftart, Ausrichtung).",
      parameters: {
        type: "object",
        properties: { slide: slideParam, shape_id: shapeParam, ...fontParams },
        required: ["slide", "shape_id"],
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          const tr = slide.shapes.getItem(String(a.shape_id)).textFrame.textRange;
          applyFont(tr.font, a);
          if (a.align) tr.paragraphFormat.horizontalAlignment = ALIGN[a.align];
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "add_text_box",
      description: "Fügt ein Textfeld auf einer Folie hinzu.",
      parameters: {
        type: "object",
        properties: { slide: slideParam, text: { type: "string" }, ...boxParams, ...fontParams },
        required: ["slide", "text", "left", "top", "width", "height"],
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          const shape = slide.shapes.addTextBox(a.text, {
            left: Number(a.left),
            top: Number(a.top),
            width: Number(a.width),
            height: Number(a.height),
          });
          applyFont(shape.textFrame.textRange.font, a);
          if (a.align) shape.textFrame.textRange.paragraphFormat.horizontalAlignment = ALIGN[a.align];
          shape.load("id");
          await ctx.sync();
          return { shape_id: shape.id };
        }),
    },
    {
      name: "add_shape",
      description: "Fügt eine geometrische Form hinzu (z.B. Rechteck, Ellipse, Pfeil), optional mit Füllfarbe und Text.",
      parameters: {
        type: "object",
        properties: {
          slide: slideParam,
          shape_type: {
            type: "string",
            enum: ["Rectangle", "RoundRectangle", "Ellipse", "Triangle", "Diamond", "RightArrow", "LeftArrow", "Chevron", "Pentagon", "Hexagon", "Star5"],
          },
          ...boxParams,
          fill_color: { type: "string", description: "Füllfarbe als Hex" },
          line_color: { type: "string", description: "Rahmenfarbe als Hex oder 'none'" },
          text: { type: "string" },
          ...fontParams,
        },
        required: ["slide", "shape_type", "left", "top", "width", "height"],
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          const shape = slide.shapes.addGeometricShape(a.shape_type, {
            left: Number(a.left),
            top: Number(a.top),
            width: Number(a.width),
            height: Number(a.height),
          });
          if (a.fill_color) shape.fill.setSolidColor(a.fill_color);
          if (a.line_color === "none") shape.lineFormat.visible = false;
          else if (a.line_color) shape.lineFormat.color = a.line_color;
          if (a.text) {
            shape.textFrame.textRange.text = a.text;
            applyFont(shape.textFrame.textRange.font, a);
            if (a.align) shape.textFrame.textRange.paragraphFormat.horizontalAlignment = ALIGN[a.align];
          }
          shape.load("id");
          await ctx.sync();
          return { shape_id: shape.id };
        }),
    },
    {
      name: "add_table",
      description: "Fügt eine Tabelle auf einer Folie ein. Erste Zeile = Kopfzeile.",
      parameters: {
        type: "object",
        properties: {
          slide: slideParam,
          values: { type: "array", items: { type: "array", items: { type: "string" } }, description: "2D-Array der Zellwerte" },
          left: boxParams.left,
          top: boxParams.top,
          width: boxParams.width,
        },
        required: ["slide", "values"],
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          const rows = a.values.length;
          const cols = Math.max(...a.values.map((r) => r.length));
          const values = a.values.map((r) => Array.from({ length: cols }, (_, i) => String(r[i] ?? "")));
          const options = { values };
          if (a.left != null) options.left = Number(a.left);
          if (a.top != null) options.top = Number(a.top);
          if (a.width != null) options.width = Number(a.width);
          const shape = slide.shapes.addTable(rows, cols, options);
          shape.load("id");
          await ctx.sync();
          return { shape_id: shape.id };
        }),
    },
    {
      name: "update_shape",
      description: "Verschiebt, skaliert, benennt oder färbt eine vorhandene Form.",
      parameters: {
        type: "object",
        properties: {
          slide: slideParam,
          shape_id: shapeParam,
          ...boxParams,
          fill_color: { type: "string", description: "Füllfarbe als Hex oder 'none'" },
          line_color: { type: "string", description: "Rahmenfarbe als Hex oder 'none'" },
          name: { type: "string" },
        },
        required: ["slide", "shape_id"],
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          const shape = slide.shapes.getItem(String(a.shape_id));
          for (const k of ["left", "top", "width", "height"]) if (a[k] != null) shape[k] = Number(a[k]);
          if (a.name) shape.name = a.name;
          if (a.fill_color === "none") shape.fill.clear();
          else if (a.fill_color) shape.fill.setSolidColor(a.fill_color);
          if (a.line_color === "none") shape.lineFormat.visible = false;
          else if (a.line_color) shape.lineFormat.color = a.line_color;
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "delete_shape",
      description: "Löscht eine Form von einer Folie.",
      parameters: {
        type: "object",
        properties: { slide: slideParam, shape_id: shapeParam },
        required: ["slide", "shape_id"],
      },
      run: (a) =>
        PowerPoint.run(async (ctx) => {
          const slide = await getSlide(ctx, a.slide);
          slide.shapes.getItem(String(a.shape_id)).delete();
          await ctx.sync();
          return { ok: true };
        }),
    },
  ];

  window.HostTools = window.HostTools || {};
  window.HostTools.PowerPoint = {
    label: "PowerPoint",
    prompt: `Du arbeitest in einer PowerPoint-Präsentation.
- Rufe zuerst get_presentation_overview auf, um Folien, Formen und deren IDs zu kennen.
- Neue Folien: list_layouts → add_slide mit passendem Layout → Platzhalter mit set_shape_text füllen. Leere, nicht benötigte Platzhalter löschen.
- Aufzählungen im Inhaltsplatzhalter: Punkte mit \\n trennen, KEINE Aufzählungszeichen oder Markdown (**, #) in den Text schreiben.
- Achte auf ein sauberes Layout: nichts außerhalb der Folie (960 x 540 pt), keine Überlappungen, einheitliche Schriftgrößen.
- Halte Folientexte knapp (max. ca. 6 Punkte pro Folie).`,
    suggestions: [
      "Erstelle 5 Folien über die Vorteile lokaler KI",
      "Fasse diese Präsentation zusammen",
      "Mach die Titel auf allen Folien einheitlich",
      "Prüfe alle Folien auf Rechtschreibfehler",
    ],
    tools,
  };
})();
