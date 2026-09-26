// Einstellungen → Server: Adressen der KI-Dienste. Gespeichert im lokalen Server
// (config.json, nicht im Git) – das Add-in selbst kennt keine festen Adressen.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/misc';

interface ServerConfig {
  llmUrl: string;
  llmApiKeySet: boolean;
  talosUrl: string;
  talosTokenSet: boolean;
  asrUrl: string;
  asrModel: string;
  brand: string;
}

const FIELDS: Array<{ key: keyof ServerConfig; secretOf?: string; placeholder: string }> = [
  { key: 'llmUrl', placeholder: 'http://server:8000/v1' },
  { key: 'llmApiKeySet', secretOf: 'llmApiKey', placeholder: '' },
  { key: 'talosUrl', placeholder: 'http://server:7000' },
  { key: 'talosTokenSet', secretOf: 'talosToken', placeholder: '' },
  { key: 'asrUrl', placeholder: 'http://server:8003/v1' },
  { key: 'asrModel', placeholder: 'qwen3-asr' },
  { key: 'brand', placeholder: '' },
];

export function ServerSettings({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<ServerConfig | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');

  useEffect(() => {
    if (!open) return;
    setDraft({});
    setState('idle');
    fetch('/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setCfg(c))
      .catch(() => setCfg(null));
  }, [open]);

  if (!cfg) return <p className="py-3 text-xs text-muted-foreground">{t('settings.server.unavailable')}</p>;

  const save = async () => {
    setState('saving');
    try {
      const res = await fetch('/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setCfg(data);
      setDraft({});
      setState('saved');
      window.setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      setState((err as Error).message);
    }
  };

  return (
    <div className="space-y-2.5 py-3">
      <div>
        <div className="text-sm font-medium">{t('settings.server.title')}</div>
        <p className="text-xs text-muted-foreground">{t('settings.server.hint')}</p>
      </div>
      {FIELDS.map((f) => {
        const secret = !!f.secretOf;
        const name = f.secretOf ?? f.key;
        const isSet = secret && (cfg[f.key] as boolean);
        return (
          <div key={name} className="space-y-1">
            <label className="text-xs font-medium text-foreground/80" htmlFor={`cfg-${name}`}>
              {t(`settings.server.${name}`)}
            </label>
            <Input
              id={`cfg-${name}`}
              type={secret ? 'password' : 'text'}
              spellCheck={false}
              autoComplete="off"
              placeholder={secret ? (isSet ? t('settings.server.secretSet') : t('settings.server.secretEmpty')) : f.placeholder}
              value={draft[name] ?? (secret ? '' : String(cfg[f.key] ?? ''))}
              onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
            />
          </div>
        );
      })}
      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" onClick={() => void save()} disabled={state === 'saving' || !Object.keys(draft).length}>
          {t('common.save')}
        </Button>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {state === 'saved' ? t('settings.server.saved') : state !== 'idle' && state !== 'saving' ? state : ''}
        </span>
      </div>
    </div>
  );
}
