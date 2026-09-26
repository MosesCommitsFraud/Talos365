// Aus Talos/web/src/components/ModelEffortPicker.tsx: Modell + Denkmodus in einem
// Menü. Die Modelle kommen hier vom OpenAI-kompatiblen Endpunkt (/models).
import { CheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchModels } from '@/agent';
import { cn } from '@/lib/utils';
import { usePrefs } from '@/state/prefs';
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from './ui/menu';

export function QwenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.919 14.545 20.817 9.17l1.47-2.544a.56.56 0 0 0 0-.566l-1.633-2.83a.57.57 0 0 0-.49-.283h-6.207L12.487.402a.57.57 0 0 0-.49-.284H8.732a.56.56 0 0 0-.49.284L5.139 5.775h-2.94a.56.56 0 0 0-.49.284L.077 8.887a.56.56 0 0 0 0 .567L3.18 14.83l-1.47 2.545a.56.56 0 0 0 0 .566l1.634 2.83a.57.57 0 0 0 .49.283h6.205l1.47 2.545a.57.57 0 0 0 .49.284h3.266a.57.57 0 0 0 .49-.284l3.104-5.375h2.94a.57.57 0 0 0 .49-.283l1.634-2.828a.55.55 0 0 0-.004-.568M8.733.686l1.634 2.828-1.634 2.828H21.8L20.164 9.17H7.425L5.63 6.06Zm1.306 19.801-6.205-.002 1.634-2.83h3.265L2.201 6.344h3.267q3.182 5.517 6.367 11.032zm10.124-5.66L18.53 12l-6.532 11.315-1.634-2.83c2.129-3.673 4.25-7.351 6.373-11.028h3.592l3.102 5.374z" />
    </svg>
  );
}

export function ModelEffortPicker({ placement = 'inside' }: { placement?: 'inside' | 'outside' }) {
  const { t } = useTranslation();
  const model = usePrefs((s) => s.model);
  const endpoint = usePrefs((s) => s.endpoint);
  const set = usePrefs((s) => s.set);
  const reasoning = usePrefs((s) => s.reasoning);
  const toggle = usePrefs((s) => s.toggle);
  const [models, setModels] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchModels()
      .then((list) => {
        if (cancelled) return;
        setModels(list);
        if (list.length && !list.includes(usePrefs.getState().model)) set({ model: list[0] });
      })
      .catch(() => !cancelled && setModels([]));
    return () => {
      cancelled = true;
    };
  }, [endpoint, set]);

  const effortLabel = reasoning ? t('composer.reasoning.on') : t('composer.reasoning.off');

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('modelPicker.switchModel')}
          className={cn(
            'flex min-w-0 shrink items-center whitespace-nowrap rounded-lg border border-transparent font-medium text-foreground/80 outline-none transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:outline-none dark:text-foreground/70',
            placement === 'inside' ? 'h-7 gap-1.5 px-2.5 text-sm' : 'h-6 gap-1.5 px-2 text-xs',
          )}
        >
          <QwenIcon className={cn('shrink-0', placement === 'inside' ? 'size-4' : 'size-3.5')} />
          <span className="min-w-0 max-w-32 truncate text-left">{model || t('modelPicker.selectModel')}</span>
          <span className={cn('shrink-0 font-normal', reasoning ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
            {effortLabel}
          </span>
        </button>
      </MenuTrigger>

      <MenuPopup align="end" className="min-w-52">
        {models && models.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">{t('modelPicker.noEndpoints')}</div>
        )}
        {(models ?? []).map((m) => (
          <MenuItem key={m} onSelect={() => set({ model: m })}>
            <QwenIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{m}</span>
            <CheckIcon className={cn('size-3.5 shrink-0 text-primary', m === model ? 'opacity-100' : 'opacity-0')} />
          </MenuItem>
        ))}
        {(models ?? []).length > 0 && <MenuSeparator />}
        <MenuItem onSelect={() => toggle('reasoning')}>
          <span className="min-w-0 flex-1 truncate">{t('composer.reasoning.on')}</span>
          <CheckIcon className={cn('size-3.5 shrink-0 text-primary', reasoning ? 'opacity-100' : 'opacity-0')} />
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
