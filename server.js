// HTTPS-Server für das Add-in + Proxys zu den KI-Diensten.
// Die Proxys (/llm/*, /talos/mcp, /asr/*) umgehen CORS- und Mixed-Content-Probleme: Das
// Add-in spricht nur mit https://localhost:3000, der Server leitet weiter.
// Die Adressen der Dienste stehen in config.json (in den Einstellungen des Add-ins
// bearbeitbar, nicht im Git) oder in Umgebungsvariablen – es gibt keine fest eingebauten.
// /skills liefert zusätzlich die lokalen Skill-Ordner (SKILL.md).
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const USE_HTTP = process.argv.includes("--http");

// ── Konfiguration ────────────────────────────────────────────────────────────
// Reihenfolge: config.json (Einstellungen im Add-in) → Umgebungsvariable → leer.
const CONFIG_FILE = path.join(__dirname, "config.json");
const CONFIG_FIELDS = {
  llmUrl: { env: "LLM_URL", url: true }, // OpenAI-kompatibler Modellserver, z. B. http://server:8000/v1
  llmApiKey: { env: "LLM_API_KEY", secret: true },
  talosUrl: { env: "TALOS_URL", url: true }, // Talos (Websuche, Skills, Wissensdatenbank), z. B. http://server:7000
  talosToken: { env: "TALOS_TOKEN", secret: true },
  asrUrl: { env: "ASR_URL", url: true }, // Spracherkennung (OpenAI-kompatibel), z. B. http://server:8003/v1
  asrModel: { env: "ASR_MODEL", fallback: "qwen3-asr" },
  brand: { env: "TALOS_BRAND" }, // optionales Branding-Profil aus Talos/branding/<profil>
};
let configCache = { mtime: -1, data: {} };

function readConfigFile() {
  try {
    const stat = fs.statSync(CONFIG_FILE);
    if (stat.mtimeMs !== configCache.mtime) configCache = { mtime: stat.mtimeMs, data: JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) };
  } catch {
    configCache = { mtime: -1, data: {} };
  }
  return configCache.data;
}

/** Aktuelle Konfiguration (wird bei jeder Anfrage frisch gelesen – Änderungen gelten sofort). */
function cfg() {
  const file = readConfigFile();
  const out = {};
  for (const [key, def] of Object.entries(CONFIG_FIELDS)) {
    let v = String(file[key] ?? "").trim() || String(process.env[def.env] ?? "").trim() || def.fallback || "";
    if (def.url) v = v.replace(/\/+$/, "");
    out[key] = v;
  }
  out.brand = out.brand.toLowerCase();
  return out;
}

/** Für die Einstellungen: Geheimnisse werden nicht ausgeliefert, nur ob sie gesetzt sind. */
function publicConfig() {
  const c = cfg();
  const out = {};
  for (const [key, def] of Object.entries(CONFIG_FIELDS)) {
    if (def.secret) out[`${key}Set`] = !!c[key];
    else out[key] = c[key];
  }
  return out;
}

function saveConfig(patch) {
  const current = readConfigFile();
  const next = { ...current };
  for (const [key, def] of Object.entries(CONFIG_FIELDS)) {
    if (!(key in patch)) continue;
    const v = String(patch[key] ?? "").trim();
    // Geheimnisse: leer = unverändert lassen, "-" = löschen
    if (def.secret && !v) continue;
    if (def.secret && v === "-") {
      delete next[key];
      continue;
    }
    if (def.url && v && !/^https?:\/\/[^\s]+$/i.test(v)) throw new Error(`Ungültige Adresse für ${key}: ${v}`);
    if (v) next[key] = v;
    else delete next[key];
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  configCache.mtime = -1;
}

// Talos-Branding und Beispiel-Skills: standardmäßig im Nachbarordner ../Talos
const BRANDING_DIR = process.env.TALOS_BRANDING_DIR || path.join(__dirname, "..", "Talos", "branding");
// Lokale Skill-Ordner (je Unterordner eine SKILL.md), mit ; getrennt ergänzbar
const SKILL_DIRS = [
  ...(process.env.TALOS_SKILLS_DIRS || "").split(";").filter(Boolean),
  path.join(__dirname, "..", "Talos", "sample_skills"),
  path.join(__dirname, "skills"),
];
// Gebaute Seitenleiste (npm run build → web/ nach dist/)
const PUBLIC_DIR = path.join(__dirname, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".xml": "application/xml",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Leitet eine Anfrage an einen Dienst im Intranet weiter (LLM oder Talos-MCP). */
async function proxy(req, res, o) {
  const target = o.base + req.url.slice(o.prefix.length);
  const body = await readBody(req);
  const started = Date.now();
  const log = (msg) =>
    console.log(`${new Date().toLocaleTimeString()}  ${req.method} ${req.url}  ${msg}  (${Date.now() - started} ms)`);
  res.on("close", () => {
    if (!res.writableEnded) log("Verbindung vom Add-in abgebrochen");
  });
  // http(s).request statt fetch: fetch bricht nach 300 s ohne Antwort-Header ab –
  // lange Modellantworten (z. B. Selbstcheck mit vielen Bildern) brauchen länger.
  const url = new URL(target);
  const client = url.protocol === "https:" ? https : http;
  const headers = { "content-type": "application/json", ...o.headers };
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  if (hasBody) headers["content-length"] = body.length;

  const upstream = client.request(url, { method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode || 502, {
      "content-type": up.headers["content-type"] || "application/json",
      "cache-control": "no-store",
    });
    // Streaming (SSE) wird Stück für Stück durchgereicht
    up.pipe(res);
    up.on("end", () => log(`-> ${up.statusCode}`));
  });
  upstream.setTimeout(0);
  upstream.on("error", (err) => {
    if (res.headersSent) return res.end();
    log(`FEHLER ${err.message}`);
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `${o.label} nicht erreichbar unter ${o.base}: ${err.message}` } }));
  });
  res.on("close", () => {
    if (!res.writableEnded) upstream.destroy();
  });
  upstream.end(hasBody ? body : undefined);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (urlPath === "/") urlPath = "/taskpane.html";
  // Menüband-Icons: Office holt sie beim Start – so sieht man, ob es sie bekommen hat
  if (urlPath.startsWith("/assets/icon-")) console.log(`${new Date().toLocaleTimeString()}  Office lädt Icon ${urlPath}`);
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(filePath)] || "application/octet-stream",
      // Office cached Add-in-Dateien sehr aggressiv – während der Entwicklung abschalten.
      "cache-control": "no-store",
    });
    res.end(data);
  });
}

// ── Lokale Skills (SKILL.md-Ordner, z. B. ../Talos/sample_skills) ──

/** Liest name/description aus dem YAML-Kopf einer SKILL.md */
function skillMeta(text) {
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const meta = {};
  if (!m) return meta;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return meta;
}

function localSkills() {
  const found = [];
  for (const dir of SKILL_DIRS) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const file = path.join(dir, e.name, "SKILL.md");
      if (!fs.existsSync(file)) continue;
      const meta = skillMeta(fs.readFileSync(file, "utf8"));
      const refs = [];
      const walk = (d, rel) => {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
          const r = rel ? `${rel}/${f.name}` : f.name;
          if (f.isDirectory()) walk(path.join(d, f.name), r);
          else if (r !== "SKILL.md") refs.push(r);
        }
      };
      walk(path.join(dir, e.name), "");
      found.push({ name: meta.name || e.name, description: meta.description || "", folder: path.join(dir, e.name), references: refs });
    }
  }
  return found;
}

function serveSkills(req, res) {
  const url = new URL(req.url, "http://x");
  const skills = localSkills();
  res.setHeader("cache-control", "no-store");
  if (url.pathname === "/skills") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(skills.map(({ folder, ...s }) => ({ ...s, source: folder }))));
  }
  // /skills/read?name=…&path=… (path optional: Datei unterhalb des Skill-Ordners)
  const skill = skills.find((s) => s.name === url.searchParams.get("name"));
  if (!skill) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Skill nicht gefunden");
  }
  const rel = url.searchParams.get("path") || "SKILL.md";
  const file = path.normalize(path.join(skill.folder, rel));
  if (!file.startsWith(skill.folder) || !fs.existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Datei nicht gefunden");
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(fs.readFileSync(file, "utf8"));
}

// ── Branding (wie Talos core/branding.py) ──
function brandInfo() {
  const brand = cfg().brand;
  // Ohne Profil: Talos mit dem Schiff-Logo (im Add-in eingebaut)
  if (!brand) return { profile: "", name: "Talos", folder: "", small: undefined, large: undefined };
  const folder = path.join(BRANDING_DIR, brand);
  let name = "Talos";
  try {
    name = JSON.parse(fs.readFileSync(path.join(folder, "brand.json"), "utf8")).name || name;
  } catch {
    /* Standard */
  }
  const find = (stem) => [".svg", ".png", ".webp", ".jpg"].map((e) => path.join(folder, stem + e)).find((f) => fs.existsSync(f));
  return { profile: brand, name, folder, small: find("logo-small"), large: find("logo-large") };
}

function serveBrand(req, res) {
  const b = brandInfo();
  if (req.url === "/brand") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    return res.end(JSON.stringify({
      profile: b.profile,
      name: b.name,
      logoSmall: b.small ? "/branding/logo-small" : null,
      logoLarge: b.large ? "/branding/logo-large" : null,
    }));
  }
  const file = req.url.startsWith("/branding/logo-large") ? b.large : b.small;
  if (!file) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(fs.readFileSync(file));
}

// ── Bilder aus dem Internet ──────────────────────────────────────────────────
// Suche über Openverse (frei lizenzierte Bilder mit Urheber- und Lizenzangabe),
// Laden über diesen Server (gleiche Herkunft → Canvas-Zuschnitt im Add-in möglich).

const IMG_MAX_BYTES = 12 * 1024 * 1024;
// Wikimedia verlangt einen aussagekräftigen User-Agent (sonst Drosselung mit HTTP 429)
const UA = "Talos365/1.0 (Office add-in for slide images; local intranet tool) node";

/** Höchstens 2 gleichzeitige Downloads pro Server (Wikimedia/Flickr drosseln sonst) */
const hostSlots = new Map();
async function withHostSlot(host, fn) {
  for (;;) {
    const busy = hostSlots.get(host) || 0;
    if (busy < 2) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  hostSlots.set(host, (hostSlots.get(host) || 0) + 1);
  try {
    return await fn();
  } finally {
    hostSlots.set(host, (hostSlots.get(host) || 1) - 1);
  }
}

/** Kleiner Speicher-Cache für Bilder (Vorschau, Kontaktbogen und Rendern laden dasselbe Bild) */
const imgCache = new Map();
let imgCacheBytes = 0;
function cacheImage(key, type, body) {
  if (imgCache.has(key)) return;
  imgCache.set(key, { type, body });
  imgCacheBytes += body.length;
  while (imgCacheBytes > 200 * 1024 * 1024 && imgCache.size) {
    const [k, v] = imgCache.entries().next().value;
    imgCache.delete(k);
    imgCacheBytes -= v.body.length;
  }
}

/** Bild laden: Cache → Download (mit einem Wiederholversuch bei Drosselung) */
async function fetchImage(target) {
  const hit = imgCache.get(target);
  if (hit) return hit;
  const host = new URL(target).host;
  for (let attempt = 0; ; attempt++) {
    const r = await withHostSlot(host, () => getUrl(target, { accept: "image/jpeg,image/png,image/*;q=0.9,*/*;q=0.5" }));
    const type = String(r.headers["content-type"] || "");
    if (r.status === 200 && type.startsWith("image/")) {
      cacheImage(target, type, r.body);
      return { type, body: r.body };
    }
    if ((r.status === 429 || r.status === 503) && attempt < 2) {
      await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
      continue;
    }
    throw new Error(`Kein Bild (HTTP ${r.status}, ${type || "?"})`);
  }
}

/** GET mit Weiterleitungen; liefert { status, headers, body } */
function getUrl(target, { maxBytes = IMG_MAX_BYTES, redirects = 5, accept = "*/*" } = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(target);
    } catch {
      return reject(new Error("Ungültige Adresse"));
    }
    if (!/^https?:$/.test(url.protocol)) return reject(new Error("Nur http(s)"));
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(url, { headers: { "user-agent": UA, accept }, timeout: 20000 }, (up) => {
      if ([301, 302, 303, 307, 308].includes(up.statusCode) && up.headers.location && redirects > 0) {
        up.resume();
        return resolve(getUrl(new URL(up.headers.location, url).toString(), { maxBytes, redirects: redirects - 1, accept }));
      }
      const chunks = [];
      let size = 0;
      up.on("data", (c) => {
        size += c.length;
        if (size > maxBytes) {
          req.destroy(new Error("Datei zu groß"));
          return;
        }
        chunks.push(c);
      });
      up.on("end", () => resolve({ status: up.statusCode, headers: up.headers, body: Buffer.concat(chunks) }));
      up.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Zeitüberschreitung")));
    req.on("error", reject);
  });
}

/** Wikimedia-Originale sind oft riesig – für Folien reicht eine Vorschau in passender Breite.
 *  Wikimedia rechnet sie selbst (Openverse-Vorschaubilder scheitern hier oft mit HTTP 424). */
// Nur feste Breiten sind erlaubt (z. B. 500, 960, 1920) – andere liefern HTTP 400.
function wikimediaThumb(url, width, target = 1920) {
  const clean = String(url || "").split("?")[0];
  const m = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/.exec(clean);
  if (!m) return url;
  if (!width || width <= target + 80) return clean;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/${target}px-${m[3]}`;
}

async function searchOpenverse(q, n, aspect) {
  // Nur Lizenzen, die kommerzielle Nutzung und Bearbeitung (Zuschnitt) erlauben
  const params = new URLSearchParams({ q, page_size: String(Math.min(20, n * 3)), mature: "false", license_type: "commercial,modification" });
  if (aspect) params.set("aspect_ratio", aspect);
  const r = await getUrl(`https://api.openverse.org/v1/images/?${params}`, { accept: "application/json" });
  if (r.status !== 200) throw new Error(`Openverse HTTP ${r.status}`);
  const data = JSON.parse(r.body.toString("utf8"));
  return (data.results || [])
    .filter((x) => x.url && !/\.svg($|\?)/i.test(x.url))
    .map((x) => ({
      url: wikimediaThumb(x.url, x.width),
      thumb: /upload\.wikimedia\.org/.test(x.url) ? wikimediaThumb(x.url, x.width || 9999, 500) : x.thumbnail || x.url,
      width: x.width || null,
      height: x.height || null,
      title: x.title || "",
      creator: x.creator || "",
      license: `${String(x.license || "").toUpperCase()}${x.license_version ? " " + x.license_version : ""}`.trim(),
      source: x.source || x.provider || "",
      page: x.foreign_landing_url || "",
    }));
}

async function serveImages(req, res) {
  const u = new URL(req.url, "http://x");
  const send = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(obj));
  };
  try {
    if (u.pathname === "/img/search") {
      const q = (u.searchParams.get("q") || "").trim();
      if (!q) return send(400, { error: "q fehlt" });
      const n = Math.max(1, Math.min(12, Number(u.searchParams.get("n")) || 6));
      const aspect = ["wide", "tall", "square"].includes(u.searchParams.get("aspect")) ? u.searchParams.get("aspect") : "";
      let results = await searchOpenverse(q, n, aspect);
      // Reihenfolge = Relevanz; zu kleine Bilder (Folien brauchen ≥ 900 px) aussortieren
      const big = results.filter((r) => !r.width || r.width >= 900);
      results = (big.length >= Math.min(3, n) ? big : results).slice(0, n);
      return send(200, { results });
    }
    if (u.pathname === "/img/fetch") {
      const img = await fetchImage(u.searchParams.get("url") || "");
      res.writeHead(200, { "content-type": img.type, "cache-control": "max-age=3600" });
      return res.end(img.body);
    }
  } catch (err) {
    return send(502, { error: err.message });
  }
  send(404, { error: "unbekannt" });
}

/** Dienst nicht eingetragen → Hinweis auf die Einstellungen (statt eines festen Standardservers) */
function notConfigured(res, what) {
  res.writeHead(503, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: { message: `${what} ist nicht eingetragen – bitte in den Einstellungen des Add-ins (Zahnrad → Server) die Adresse angeben.` } }));
}

function serveConfig(req, res) {
  if (req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(JSON.stringify(publicConfig()));
  }
  if (req.method === "POST") {
    return readBody(req).then((b) => {
      try {
        saveConfig(JSON.parse(b.toString("utf8") || "{}"));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(publicConfig()));
      } catch (err) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  res.writeHead(405);
  res.end();
}

function handler(req, res) {
  if (req.url === "/config") return serveConfig(req, res);
  if (req.url.startsWith("/img/")) return serveImages(req, res);
  if (req.url.startsWith("/asr/")) {
    // Diktat: WAV vom Add-in → /v1/audio/transcriptions (multipart wird unverändert durchgereicht)
    if (!cfg().asrUrl) return notConfigured(res, "Die Spracherkennung (ASR)");
    return proxy(req, res, { base: cfg().asrUrl, prefix: "/asr", label: "Spracherkennung", headers: { "content-type": req.headers["content-type"] || "application/octet-stream" } }).catch((err) => {
      console.error("ASR-Fehler:", err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  }
  if (req.url === "/brand" || req.url.startsWith("/branding/")) return serveBrand(req, res);
  if (req.url.startsWith("/debug/save-icon") && process.env.TALOS_DEBUG_DIR) {
    // Nur zum Erzeugen der Menüband-Icons: speichert ein PNG nach web/public/assets
    const size = Number(new URL(req.url, "http://x").searchParams.get("size"));
    if (![16, 32, 64, 80].includes(size)) {
      res.writeHead(400);
      return res.end();
    }
    return readBody(req).then((b) => {
      const png = Buffer.from(b.toString("utf8").replace(/^data:image\/png;base64,/, ""), "base64");
      fs.writeFileSync(path.join(__dirname, "web", "public", "assets", `icon-${size}.png`), png);
      res.writeHead(204);
      res.end();
    });
  }
  const onError = (err) => {
    console.error("Proxy-Fehler:", err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  };
  if (req.url.startsWith("/llm/")) {
    const c = cfg();
    if (!c.llmUrl) return notConfigured(res, "Der Modellserver (LLM)");
    return proxy(req, res, { base: c.llmUrl, prefix: "/llm", label: "LLM", headers: c.llmApiKey ? { authorization: `Bearer ${c.llmApiKey}` } : {} }).catch(onError);
  }
  if (req.url.startsWith("/talos/mcp")) {
    // Talos-MCP: Websuche (SearXNG), Webseiten lesen, Skill-Bibliothek, Wissensdatenbank
    const c = cfg();
    if (!c.talosUrl) return notConfigured(res, "Talos (Websuche, Skills, Wissensdatenbank)");
    return proxy(req, res, {
      base: `${c.talosUrl}/mcp`,
      prefix: "/talos/mcp",
      label: "Talos",
      headers: { accept: "application/json, text/event-stream", ...(c.talosToken ? { authorization: `Bearer ${c.talosToken}` } : {}) },
    }).catch(onError);
  }
  if (req.url === "/skills" || req.url.startsWith("/skills/read")) return serveSkills(req, res);
  if (req.url === "/debug/pptx" && process.env.TALOS_DEBUG_DIR) {
    // Nur zum Testen der Folien-Engine: speichert ein im Browser gebautes Deck.
    return readBody(req).then((b) => {
      const file = path.join(process.env.TALOS_DEBUG_DIR, `deck-${Date.now()}.pptx`);
      fs.writeFileSync(file, Buffer.from(b.toString("utf8"), "base64"));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ file }));
    });
  }
  if (req.url === "/whoami") {
    // Vorname für die Begrüßung („Willkommen zurück, Anna!“)
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(JSON.stringify({ username: require("os").userInfo().username }));
  }
  if (req.url.startsWith("/log")) {
    // Fehlermeldungen aus dem Add-in in der Serverkonsole anzeigen
    return readBody(req).then((b) => {
      console.log(`${new Date().toLocaleTimeString()}  [Add-in] ${b.toString("utf8")}`);
      res.writeHead(204);
      res.end();
    });
  }
  serveStatic(req, res);
}

async function main() {
  let server;
  if (USE_HTTP) {
    server = http.createServer(handler);
  } else {
    let devCerts;
    try {
      devCerts = require("office-addin-dev-certs");
    } catch {
      console.error("office-addin-dev-certs fehlt. Bitte zuerst 'npm install' ausführen.");
      process.exit(1);
    }
    const options = await devCerts.getHttpsServerOptions();
    server = https.createServer(options, handler);
  }
  // Lange Modellantworten zulassen und Keep-Alive-Verbindungen nicht nach 5 s kappen,
  // sonst verwendet WebView2 bereits geschlossene Sockets ("Failed to fetch").
  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 125_000;
  server.requestTimeout = 0;
  server.listen(PORT, () => {
    const proto = USE_HTTP ? "http" : "https";
    console.log(`Add-in läuft auf ${proto}://localhost:${PORT}`);
    const c = cfg();
    console.log(`Modellserver: ${c.llmUrl || '(nicht eingetragen – Einstellungen im Add-in)'}`);
    console.log(`Talos: ${c.talosUrl || '(nicht eingetragen)'}  ·  Spracherkennung: ${c.asrUrl || '(nicht eingetragen)'}`);
  });
}

process.on("uncaughtException", (err) => console.error("Unerwarteter Fehler:", err));

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
