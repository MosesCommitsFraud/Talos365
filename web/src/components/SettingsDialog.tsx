import { useTranslation } from 'react-i18next';
import { usePrefs, type Theme } from '@/state/prefs';
import { Dialog, DialogContent, DialogSection } from './ui/dialog';
import { Input, Switch } from './ui/misc';
import { ServerSettings } from './ServerSettings';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const prefs = usePrefs();
  const themes: Array<{ key: Theme; label: string }> = [
    { key: 'system', label: t('settings.themeSystem') },
    { key: 'light', label: t('settings.themeLight') },
    { key: 'dark', label: t('settings.themeDark') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('settings.title')}>
        <DialogSection className="divide-y divide-border">
          <div className="space-y-1.5 pb-3">
            <label className="text-sm font-medium" htmlFor="endpoint">
              {t('settings.endpoint')}
            </label>
            <Input
              id="endpoint"
              value={prefs.endpoint}
              spellCheck={false}
              onChange={(e) => prefs.set({ endpoint: e.target.value.trim() || '/llm' })}
            />
            <p className="text-xs text-muted-foreground">{t('settings.endpointHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 py-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="temperature">
                {t('settings.temperature')}
              </label>
              <Input
                id="temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={prefs.temperature}
                onChange={(e) => prefs.set({ temperature: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="steps">
                {t('settings.maxSteps')}
              </label>
              <Input
                id="steps"
                type="number"
                min={1}
                max={60}
                value={prefs.maxSteps}
                onChange={(e) => prefs.set({ maxSteps: Math.max(1, Number(e.target.value) || 25) })}
              />
            </div>
          </div>
          <Row label={t('settings.confirmWrites')} hint={t('settings.confirmWritesHint')}>
            <Switch checked={prefs.confirmWrites} onCheckedChange={() => prefs.toggle('confirmWrites')} />
          </Row>
          <Row label={t('settings.showThinking')} hint={t('settings.showThinkingHint')}>
            <Switch
              checked={prefs.visibility.showThinking}
              onCheckedChange={(v) => prefs.setVisibility('showThinking', v)}
            />
          </Row>
          <ServerSettings open={open} />
          <Row label={t('settings.theme')}>
            <div className="flex shrink-0 gap-1 rounded-lg bg-muted/50 p-0.5">
              {themes.map((th) => (
                <button
                  key={th.key}
                  type="button"
                  onClick={() => prefs.setTheme(th.key)}
                  className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                    prefs.theme === th.key
                      ? 'bg-background font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {th.label}
                </button>
              ))}
            </div>
          </Row>
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
}
