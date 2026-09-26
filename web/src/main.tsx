import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import { App } from './App';

const HOSTS: Record<string, string> = { Word: 'Word', PowerPoint: 'PowerPoint', Excel: 'Excel' };

function mount(host: string | null) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App hostKey={host && HOSTS[host] ? HOSTS[host] : null} />
    </StrictMode>,
  );
}

// ?host=PowerPoint erzwingt im Browser eine App – nur zur Vorschau der Oberfläche.
const previewHost = new URLSearchParams(location.search).get('host');
// ?debug=1: Folien-Engine für Tests im Browser verfügbar machen
if (new URLSearchParams(location.search).has('debug')) {
  void Promise.all([import('./slides/deck'), import('./slides/tools'), import('./slides/render'), import('./slides/styles'), import('./lib/selection')]).then(
    ([deck, tools, render, styles, selection]) => ((window as unknown as { __talos: unknown }).__talos = { ...deck, ...tools, ...render, ...styles, selection }),
  );
}
if (window.Office?.onReady) {
  window.Office.onReady((info: { host?: string | null }) => mount(info.host || previewHost));
} else {
  mount(previewHost);
}
