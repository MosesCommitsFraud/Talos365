// Chatverlauf neben „Neuer Chat“: gespeicherte Unterhaltungen dieser App, neueste zuerst.
import { HistoryIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { openConversation } from '@/agent';
import { cn } from '@/lib/utils';
import { useChat } from '@/state/chat';
import { useHistory } from '@/state/history';
import { Button } from './ui/button';
import { Menu, MenuItem, MenuLabel, MenuPopup, MenuTrigger } from './ui/menu';
import { Tooltip } from './ui/misc';

function useRelativeTime() {
  const { t, i18n } = useTranslation();
  return (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return t('messages.timeJustNow');
    if (diff < 3_600_000) return t('messages.timeMinAgo', { count: Math.floor(diff / 60_000) });
    if (diff < 86_400_000) return t('messages.timeHourAgo', { count: Math.floor(diff / 3_600_000) });
    return new Date(ts).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  };
}

export function HistoryMenu({ host }: { host: string | null }) {
  const { t } = useTranslation();
  const all = useHistory((s) => s.chats);
  const currentId = useHistory((s) => s.currentId);
  const remove = useHistory((s) => s.remove);
  const refresh = useHistory((s) => s.refresh);
  const streaming = useChat((s) => s.streaming);
  const relative = useRelativeTime();
  // Nur Unterhaltungen aus derselben App – deren Werkzeuge passen zum Verlauf
  const chats = host ? all.filter((c) => c.host === host) : all;

  return (
    <Menu onOpenChange={(open) => open && refresh()}>
      <Tooltip label={t('history.title')}>
        <MenuTrigger asChild>
          <Button variant="ghost-muted" size="icon-sm" aria-label={t('history.title')}>
            <HistoryIcon />
          </Button>
        </MenuTrigger>
      </Tooltip>
      <MenuPopup align="end" className="max-h-[min(420px,70vh)] w-72 max-w-[calc(100vw-24px)] overflow-y-auto">
        <MenuLabel>{t('history.title')}</MenuLabel>
        {chats.length === 0 && <div className="px-2 pb-2 text-sm text-muted-foreground">{t('history.empty')}</div>}
        {chats.map((c) => (
          <MenuItem
            key={c.id}
            disabled={streaming}
            onSelect={() => openConversation(c.id)}
            className={cn('group/hist pe-1', c.id === currentId && 'bg-accent/60')}
          >
            <span className="min-w-0 flex-1 truncate">{c.title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums group-hover/hist:hidden">{relative(c.updatedAt)}</span>
            <button
              type="button"
              aria-label={t('history.delete')}
              title={t('history.delete')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                remove(c.id);
              }}
              className="hidden size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-destructive-foreground group-hover/hist:flex [&_svg]:size-3.5"
            >
              <Trash2Icon />
            </button>
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
