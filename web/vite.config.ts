import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Kopiert die Fluent-Icons (24px, filled + regular) nach dist/icons und legt
 *  eine Namensliste für die Icon-Suche an. */
function fluentIcons(): Plugin {
  return {
    name: 'fluent-icons',
    apply: 'build',
    writeBundle(options) {
      const src = fileURLToPath(new URL('./node_modules/@fluentui/svg-icons/icons', import.meta.url));
      const out = path.join(options.dir ?? 'dist', 'icons');
      fs.mkdirSync(out, { recursive: true });
      const names = new Set<string>();
      for (const file of fs.readdirSync(src)) {
        const m = /^(.+)_24_(regular|filled)\.svg$/.exec(file);
        if (!m) continue;
        fs.copyFileSync(path.join(src, file), path.join(out, file));
        names.add(m[1]);
      }
      fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify([...names].sort()));
    },
  };
}

// Baut die Seitenleiste nach ../dist, von dort liefert server.js sie aus.
export default defineConfig({
  plugins: [react(), tailwindcss(), fluentIcons()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: { taskpane: fileURLToPath(new URL('./taskpane.html', import.meta.url)) },
    },
  },
});
