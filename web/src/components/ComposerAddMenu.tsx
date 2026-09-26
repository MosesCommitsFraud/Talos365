// Aus Talos/web/src/components/ComposerAddMenu.tsx: das „+“ im Composer mit den
// Schaltern für die nächsten Nachrichten (Websuche, Wissensdatenbank) und der
// Skill-Bibliothek. Anhänge und Mikrofon gibt es im Add-in nicht.
import { BookOpenIcon, CheckIcon, GlobeIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { usePrefs } from '@/state/prefs';
import { allSkills, type SkillInfo } from '@/talos';
import { Menu, MenuItem, MenuLabel, MenuPopup, MenuSeparator, MenuSub, MenuSubPopup, MenuSubTrigger, MenuTrigger } from './ui/menu';

/** Skills als Untermenü: ein Klick schreibt „Nutze den Skill …“ in den Composer. */
function SkillsSubmenu({ onPick }: { onPick: (name: string) => void }) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  return (
    <MenuSub
      onOpenChange={(open) => {
        if (open) void allSkills().then(setSkills).catch(() => setSkills([]));
      }}
    >
      <MenuSubTrigger>
        <SparklesIcon />
        <span className="min-w-0 flex-1 truncate">{t('composer.skills')}</span>
      </MenuSubTrigger>
      <MenuSubPopup className="max-h-80 min-w-52 max-w-72 overflow-y-auto">
        {skills?.length === 0 && <MenuLabel>{t('composer.skillsNone')}</MenuLabel>}
        {skills === null && <MenuLabel>…</MenuLabel>}
        {skills?.map((s) => (
          <MenuItem key={s.name} onSelect={() => onPick(s.name)} title={s.description}>
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
          </MenuItem>
        ))}
      </MenuSubPopup>
    </MenuSub>
  );
}

function ToggleItem({ on, onToggle, icon, label }: { on: boolean; onToggle: () => void; icon: React.ReactNode; label: string }) {
  return (
    <MenuItem
      // Mehrere Schalter hintereinander, ohne das Menü neu zu öffnen
      onSelect={(e) => {
        e.preventDefault();
        onToggle();
      }}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <CheckIcon className={cn('size-3.5 shrink-0 text-primary', on ? 'opacity-100' : 'opacity-0')} />
    </MenuItem>
  );
}

export function ComposerAddMenu({ onPickSkill, className }: { onPickSkill: (name: string) => void; className?: string }) {
  const { t } = useTranslation();
  const useWeb = usePrefs((s) => s.useWeb);
  const useRag = usePrefs((s) => s.useRag);
  const toggle = usePrefs((s) => s.toggle);

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('composer.add')}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-foreground/70 outline-none transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:outline-none dark:text-foreground/60 [&_svg]:size-4',
            className,
          )}
        >
          <PlusIcon />
        </button>
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-48">
        <SkillsSubmenu onPick={onPickSkill} />
        <MenuSeparator />
        <ToggleItem on={useRag} onToggle={() => toggle('useRag')} icon={<BookOpenIcon />} label={t('composer.rag')} />
        <ToggleItem on={useWeb} onToggle={() => toggle('useWeb')} icon={<GlobeIcon />} label={t('composer.webSearch')} />
      </MenuPopup>
    </Menu>
  );
}
