import { Settings2Icon, SquarePenIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getToolset } from '@/toolsets';
import { useTranslation } from 'react-i18next';
import { resetConversation, runAgent, stopTurn } from '@/agent';
import type { HostToolset } from '@/lib/types';
import { useChat } from '@/state/chat';
import { usePrefs } from '@/state/prefs';
import { Composer } from './components/Composer';
import { Messages } from './components/Messages';
import { SettingsDialog } from './components/SettingsDialog';
import { HistoryMenu } from './components/HistoryMenu';
import { QuestionCard } from './components/QuestionCard';
import { commandsFor, expandCommand, useComposerInject } from './lib/commands';
import { loadBrand } from './lib/brand';
import { selectionAttachment, watchSelection } from './lib/selection';
import { Button } from './components/ui/button';
import { Tooltip, TooltipProvider } from './components/ui/misc';

const GREETING_COUNT = 6;

/** "anna.muster" → "Anna" (wie in Talos/Welcome.tsx). */
function firstNameOf(name?: string | null): string | null {
  // Windows-Anmeldenamen können „DOMÄNE\vorname.nachname“ sein.
  const base = (name ?? '').split('\\').pop() ?? '';
  const first = base.split(/[._\-\s@]+/)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Hell/Dunkel: „Wie Office“ folgt dem Office-Design, sonst die feste Wahl. */
function useThemeSync() {
  const theme = usePrefs((s) => s.theme);
  const setResolvedDark = usePrefs((s) => s.setResolvedDark);
  useEffect(() => {
    const apply = () => {
      let dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      if (theme === 'system') {
        const bg: string | undefined = window.Office?.context?.officeTheme?.bodyBackgroundColor;
        if (bg && /^#?[0-9a-f]{6}$/i.test(bg)) {
          const hex = bg.replace('#', '');
          const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
          dark = 0.299 * r + 0.587 * g + 0.114 * b < 128;
        }
      } else {
        dark = theme === 'dark';
      }
      document.documentElement.classList.toggle('dark', dark);
      setResolvedDark(dark);
    };
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', apply);
    try {
      window.Office?.context?.document?.addHandlerAsync?.(window.Office.EventType.OfficeThemeChanged, apply);
    } catch {
      /* nicht unterstützt */
    }
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme, setResolvedDark]);
}

export function App({ hostKey }: { hostKey: string | null }) {
  const { t } = useTranslation();
  const toolset: HostToolset | null = useMemo(() => getToolset(hostKey), [hostKey]);
  const hasMessages = useChat((s) => s.messages.length > 0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [variant] = useState(() => Math.floor(Math.random() * GREETING_COUNT) + 1);
  useThemeSync();

  useEffect(() => {
    void loadBrand();
    fetch('/whoami')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setName(firstNameOf(d?.username)))
      .catch(() => {});
  }, []);

  const greeting = name ? t(`home.greeting${variant}`, { name }) : t('messages.welcome');
  // Markierung im Dokument beobachten (Chip im Composer) und beim Senden mitschicken
  useEffect(() => watchSelection(hostKey), [hostKey]);
  const commands = commandsFor(hostKey);
  const inject = useComposerInject((s) => s.inject);
  const send = (text: string) => {
    // „/befehl …“ → ausführliche Anweisung fürs Modell, im Chat bleibt der Befehl stehen
    const expanded = expandCommand(hostKey, text);
    void (async () => runAgent(expanded ?? text, toolset, await selectionAttachment(), expanded ? text : undefined))();
  };

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <header className="flex h-11 shrink-0 items-center justify-end px-3">
          <div className="flex items-center gap-0.5">
            <Tooltip label={t('history.newChat')}>
              <Button variant="ghost-muted" size="icon-sm" aria-label={t('history.newChat')} onClick={resetConversation}>
                <SquarePenIcon />
              </Button>
            </Tooltip>
            <HistoryMenu host={toolset?.label ?? null} />
            <Tooltip label={t('settings.title')}>
              <Button variant="ghost-muted" size="icon-sm" aria-label={t('settings.title')} onClick={() => setSettingsOpen(true)}>
                <Settings2Icon />
              </Button>
            </Tooltip>
          </div>
        </header>

        {hasMessages ? (
          <Messages />
        ) : (
          // Leerer Chat: Begrüßung und Befehle, das Eingabefeld bleibt unten
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mx-auto mt-auto flex w-full max-w-[800px] flex-col gap-3 px-4 pb-3 pt-6">
              <h1 className="select-none text-xl font-semibold tracking-tight">{greeting}</h1>
              {toolset ? (
                <div className="flex flex-wrap gap-1.5">
                  {/* Drei Befehle als Vorschlag, alle weiteren über „/“ im Eingabefeld */}
                  {commands.slice(0, 3).map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => (c.needsArg ? inject(`/${c.name} `) : send(`/${c.name}`))}
                      className="rounded-lg border border-foreground/10 px-2.5 py-1 font-mono text-[13px] text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                    >
                      /{c.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('messages.notInOffice')}</p>
              )}
            </div>
          </div>
        )}
        <QuestionCard onAnswer={send} />
        <Composer hero={false} hostKey={hostKey} onSend={send} onStop={stopTurn} />
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </TooltipProvider>
  );
}
