// Werkzeuge, mit denen das Modell Excel über Office.js liest und bearbeitet.
(function () {
  const MAX_CELLS = 3000;

  function getSheet(ctx, name) {
    return name ? ctx.workbook.worksheets.getItem(name) : ctx.workbook.worksheets.getActiveWorksheet();
  }

  function normalize(values) {
    const cols = Math.max(...values.map((r) => r.length));
    return values.map((r) => Array.from({ length: cols }, (_, i) => (r[i] == null ? "" : r[i])));
  }

  const sheetParam = { type: "string", description: "Name des Arbeitsblatts (optional, Standard: aktives Blatt)" };
  const addrParam = { type: "string", description: "Bereich in A1-Schreibweise, z.B. A1:D10" };

  const tools = [
    {
      name: "get_workbook_overview",
      description:
        "Liefert alle Arbeitsblätter mit genutztem Bereich und einer Vorschau der ersten Zeilen sowie vorhandene Tabellen. Immer zuerst aufrufen.",
      parameters: { type: "object", properties: {} },
      run: () =>
        Excel.run(async (ctx) => {
          const sheets = ctx.workbook.worksheets;
          sheets.load("items/name");
          const active = sheets.getActiveWorksheet();
          active.load("name");
          const tables = ctx.workbook.tables;
          tables.load("items/name");
          await ctx.sync();
          const used = sheets.items.map((s) => {
            const r = s.getUsedRangeOrNullObject(true);
            r.load("address,rowCount,columnCount");
            return r;
          });
          await ctx.sync();
          const previews = used.map((r) => {
            if (r.isNullObject) return null;
            const p = r.getCell(0, 0).getResizedRange(Math.min(r.rowCount, 8) - 1, Math.min(r.columnCount, 12) - 1);
            p.load("address,values");
            return p;
          });
          await ctx.sync();
          return {
            active_sheet: active.name,
            sheets: sheets.items.map((s, i) => ({
              name: s.name,
              used_range: used[i].isNullObject ? null : used[i].address,
              rows: used[i].isNullObject ? 0 : used[i].rowCount,
              columns: used[i].isNullObject ? 0 : used[i].columnCount,
              preview: previews[i] ? { address: previews[i].address, values: previews[i].values } : null,
            })),
            tables: tables.items.map((t) => t.name),
          };
        }),
    },
    {
      name: "get_selection",
      description: "Liefert den markierten Bereich mit Werten und Formeln.",
      parameters: { type: "object", properties: {} },
      run: () =>
        Excel.run(async (ctx) => {
          const r = ctx.workbook.getSelectedRange();
          r.load("address,rowCount,columnCount");
          await ctx.sync();
          if (r.rowCount * r.columnCount > MAX_CELLS) return { address: r.address, note: "Auswahl zu groß – nutze read_range für Teilbereiche." };
          r.load("values,formulas");
          await ctx.sync();
          return { address: r.address, values: r.values, formulas: r.formulas };
        }),
    },
    {
      name: "read_range",
      description: "Liest Werte (und optional Formeln und Zahlenformate) eines Bereichs.",
      parameters: {
        type: "object",
        properties: { sheet: sheetParam, address: addrParam, include_formulas: { type: "boolean" } },
        required: ["address"],
      },
      run: (a) =>
        Excel.run(async (ctx) => {
          const sheet = getSheet(ctx, a.sheet);
          let r = sheet.getRange(a.address);
          r.load("rowCount,columnCount");
          await ctx.sync();
          let note;
          if (r.rowCount * r.columnCount > MAX_CELLS) {
            // Ganze Spalten/Zeilen o.ä.: auf genutzten Bereich beschränken
            r = r.getIntersectionOrNullObject(sheet.getUsedRange(true));
            r.load("rowCount,columnCount");
            await ctx.sync();
            if (r.isNullObject) return { address: a.address, values: [] };
            if (r.rowCount * r.columnCount > MAX_CELLS) {
              const rows = Math.max(1, Math.floor(MAX_CELLS / r.columnCount));
              r = r.getCell(0, 0).getResizedRange(rows - 1, r.columnCount - 1);
              note = `Gekürzt auf die ersten ${rows} Zeilen.`;
            }
          }
          r.load(a.include_formulas ? "address,values,formulas,numberFormat" : "address,values");
          await ctx.sync();
          const out = { address: r.address, values: r.values };
          if (a.include_formulas) {
            out.formulas = r.formulas;
            out.number_format = r.numberFormat;
          }
          if (note) out.note = note;
          return out;
        }),
    },
    {
      name: "write_range",
      description:
        "Schreibt Werte und/oder Formeln ab einer Startzelle. Formeln beginnen mit '=' und verwenden ENGLISCHE Funktionsnamen und Kommas als Trenner (z.B. =SUM(B2:B10), =IF(A2>0,\"ja\",\"nein\")).",
      parameters: {
        type: "object",
        properties: {
          sheet: sheetParam,
          start_cell: { type: "string", description: "Obere linke Zelle, z.B. A1" },
          values: {
            type: "array",
            items: { type: "array", items: { type: ["string", "number", "boolean"] } },
            description: "2D-Array (Zeilen × Spalten)",
          },
        },
        required: ["start_cell", "values"],
      },
      run: (a) =>
        Excel.run(async (ctx) => {
          const values = normalize(a.values);
          const r = getSheet(ctx, a.sheet)
            .getRange(a.start_cell)
            .getCell(0, 0)
            .getResizedRange(values.length - 1, values[0].length - 1);
          r.formulas = values;
          r.load("address");
          await ctx.sync();
          return { written: r.address };
        }),
    },
    {
      name: "format_range",
      description: "Formatiert einen Bereich (Schrift, Farben, Zahlenformat, Rahmen, Ausrichtung, Spaltenbreite).",
      parameters: {
        type: "object",
        properties: {
          sheet: sheetParam,
          address: addrParam,
          bold: { type: "boolean" },
          italic: { type: "boolean" },
          font_size: { type: "number" },
          font_color: { type: "string", description: "Hex, z.B. #FFFFFF" },
          fill_color: { type: "string", description: "Hex oder 'none'" },
          number_format: { type: "string", description: "z.B. '#,##0.00', '0%', 'dd.mm.yyyy', '#,##0 €'" },
          horizontal_alignment: { type: "string", enum: ["Left", "Center", "Right"] },
          wrap_text: { type: "boolean" },
          borders: { type: "boolean", description: "Dünne Rahmenlinien um und innerhalb des Bereichs" },
          autofit_columns: { type: "boolean" },
          column_width: { type: "number", description: "Spaltenbreite in pt" },
        },
        required: ["address"],
      },
      run: (a) =>
        Excel.run(async (ctx) => {
          const r = getSheet(ctx, a.sheet).getRange(a.address);
          r.load("rowCount,columnCount");
          await ctx.sync();
          const f = r.format;
          if (a.bold != null) f.font.bold = !!a.bold;
          if (a.italic != null) f.font.italic = !!a.italic;
          if (a.font_size != null) f.font.size = Number(a.font_size);
          if (a.font_color) f.font.color = a.font_color;
          if (a.fill_color === "none") f.fill.clear();
          else if (a.fill_color) f.fill.color = a.fill_color;
          if (a.number_format) {
            r.numberFormat = Array.from({ length: r.rowCount }, () => Array(r.columnCount).fill(a.number_format));
          }
          if (a.horizontal_alignment) f.horizontalAlignment = a.horizontal_alignment;
          if (a.wrap_text != null) f.wrapText = !!a.wrap_text;
          if (a.borders) {
            const edges = ["EdgeTop", "EdgeBottom", "EdgeLeft", "EdgeRight"];
            if (r.rowCount > 1) edges.push("InsideHorizontal");
            if (r.columnCount > 1) edges.push("InsideVertical");
            edges.forEach((e) => {
              const b = f.borders.getItem(e);
              b.style = "Continuous";
              b.weight = "Thin";
            });
          }
          if (a.column_width != null) f.columnWidth = Number(a.column_width);
          if (a.autofit_columns) f.autofitColumns();
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "clear_range",
      description: "Leert einen Bereich (Inhalte, Formate oder beides).",
      parameters: {
        type: "object",
        properties: { sheet: sheetParam, address: addrParam, what: { type: "string", enum: ["all", "contents", "formats"] } },
        required: ["address"],
      },
      run: (a) =>
        Excel.run(async (ctx) => {
          const map = { all: "All", contents: "Contents", formats: "Formats" };
          getSheet(ctx, a.sheet).getRange(a.address).clear(map[a.what || "contents"]);
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "add_worksheet",
      description: "Legt ein neues Arbeitsblatt an und aktiviert es.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      run: (a) =>
        Excel.run(async (ctx) => {
          const s = ctx.workbook.worksheets.add(a.name);
          s.activate();
          await ctx.sync();
          return { ok: true };
        }),
    },
    {
      name: "create_table",
      description: "Formatiert einen Bereich als Excel-Tabelle (mit Filter und Tabellenformat).",
      parameters: {
        type: "object",
        properties: {
          sheet: sheetParam,
          address: addrParam,
          has_headers: { type: "boolean", description: "Standard: true" },
          name: { type: "string" },
          style: { type: "string", description: "z.B. TableStyleMedium2" },
        },
        required: ["address"],
      },
      run: (a) =>
        Excel.run(async (ctx) => {
          const t = getSheet(ctx, a.sheet).tables.add(a.address, a.has_headers !== false);
          if (a.name) t.name = a.name;
          t.style = a.style || "TableStyleMedium2";
          t.load("name");
          await ctx.sync();
          return { table: t.name };
        }),
    },
    {
      name: "create_chart",
      description: "Erstellt ein Diagramm aus einem Datenbereich (inkl. Kopfzeile/Beschriftungsspalte).",
      parameters: {
        type: "object",
        properties: {
          sheet: sheetParam,
          data_address: addrParam,
          chart_type: {
            type: "string",
            enum: ["ColumnClustered", "BarClustered", "Line", "LineMarkers", "Pie", "Doughnut", "Area", "XYScatter", "ColumnStacked"],
          },
          title: { type: "string" },
          position_cell: { type: "string", description: "Zelle, an der das Diagramm oben links platziert wird, z.B. H2" },
        },
        required: ["data_address", "chart_type"],
      },
      run: (a) =>
        Excel.run(async (ctx) => {
          const sheet = getSheet(ctx, a.sheet);
          const chart = sheet.charts.add(a.chart_type, sheet.getRange(a.data_address), "Auto");
          if (a.title) chart.title.text = a.title;
          if (a.position_cell) chart.setPosition(a.position_cell);
          chart.load("name");
          await ctx.sync();
          return { chart: chart.name };
        }),
    },
    {
      name: "sort_range",
      description: "Sortiert einen Bereich nach einer Spalte.",
      parameters: {
        type: "object",
        properties: {
          sheet: sheetParam,
          address: addrParam,
          column_index: { type: "integer", description: "Spalte innerhalb des Bereichs, beginnend bei 0" },
          ascending: { type: "boolean" },
          has_headers: { type: "boolean" },
        },
        required: ["address", "column_index"],
      },
      run: (a) =>
        Excel.run(async (ctx) => {
          getSheet(ctx, a.sheet)
            .getRange(a.address)
            .sort.apply([{ key: Number(a.column_index), ascending: a.ascending !== false }], false, !!a.has_headers);
          await ctx.sync();
          return { ok: true };
        }),
    },
  ];

  window.HostTools = window.HostTools || {};
  window.HostTools.Excel = {
    label: "Excel",
    prompt: `Du arbeitest in einer Excel-Arbeitsmappe.
- Rufe zuerst get_workbook_overview auf, um Blätter und Datenbereiche zu kennen.
- Formeln: englische Funktionsnamen, Komma als Argumenttrenner, Punkt als Dezimaltrenner (z.B. =ROUND(SUM(B2:B10)*0.19,2)).
- Bevorzuge Formeln statt fest berechneter Werte, damit die Mappe nachvollziehbar bleibt.
- Überschreibe keine vorhandenen Daten, ohne dass der Nutzer es verlangt.`,
    suggestions: [
      "Analysiere die Daten auf diesem Blatt",
      "Erstelle ein Diagramm aus der Auswahl",
      "Formatiere die Tabelle übersichtlich",
      "Füge eine Summenzeile hinzu",
    ],
    tools,
  };
})();
