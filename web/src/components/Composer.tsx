// Aus Talos/web/src/components/Composer.tsx: gleiche Box, gleiche Steuerelemente,
// gleiche Höhenanimation, Diktat und Auswahl-Chip. Anhänge und Slash-Befehle gibt es im Add-in nicht.
import { ArrowUpIcon, CornerDownLeftIcon, Loader2Icon, MicIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useChat } from '@/state/chat';
import { clearSelection, useSelection } from '@/lib/selection';
import { useBrand } from '@/lib/brand';
import { commandsFor, useComposerInject } from '@/lib/commands';
import { useDictation } from '@/lib/useDictation';
import { ComposerAddMenu } from './ComposerAddMenu';
import { ModelEffortPicker } from './ModelEffortPicker';
import { Tooltip } from './ui/misc';

/** How tall the input may grow before it starts scrolling. */
const MAX_INPUT_HEIGHT = 220;
/** Plate size for the controls pinned inside the input box. */
const INLINE_CONTROL = 'size-[1.625rem]';
/** Gap the text keeps from the controls pinned inside the box. */
const CONTROL_GAP = 8;
/** Typography shared by the input and its measuring twin. */
const INPUT_TEXT = 'text-[15px] leading-relaxed';

/** Diktat-Knopf (wie Talos MicButton) */
function MicButton({ status, onClick, hero }: { status: 'idle' | 'starting' | 'recording' | 'finalizing'; onClick: () => void; hero?: boolean }) {
  const { t } = useTranslation();
  const label = status === 'recording' ? t('composer.dictateStop') : t('composer.dictate');
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        onClick={onClick}
        disabled={status === 'finalizing' || status === 'starting'}
        aria-label={label}
        className={cn(
          'flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors active:scale-95',
          hero ? 'size-8 [&_svg]:size-4' : `${INLINE_CONTROL} [&_svg]:size-4`,
          status === 'recording'
            ? 'animate-pulse bg-red-500/10 text-red-500 hover:bg-red-500/20'
            : 'text-foreground/45 hover:bg-accent hover:text-foreground/70 disabled:opacity-50 dark:text-foreground/35 dark:hover:text-foreground/60',
        )}
      >
        {status === 'finalizing' || status === 'starting' ? <Loader2Icon className="animate-spin" /> : <MicIcon />}
      </button>
    </Tooltip>
  );
}

/** Kopfzeile der Auswahl-Leiste: „Folie 2 ausgewählt“ ×. Die Leiste umschließt den Composer. */
function SelectionHeader({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-1.5 ps-3.5 pe-1.5 text-[13px] text-foreground/75">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button
        type="button"
        aria-label={t('composer.removeSelection')}
        title={t('composer.removeSelection')}
        onClick={clearSelection}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground [&_svg]:size-4"
      >
        <XIcon />
      </button>
    </div>
  );
}

/** Stop control shown while a turn streams. */
function StopButton({ onClick, hero }: { onClick: () => void; hero?: boolean }) {
  const { t } = useTranslation();
  return (
    <Tooltip label={t('composer.stop')} side="top">
      <button
        type="button"
        onClick={onClick}
        aria-label={t('composer.stop')}
        className={cn(
          'flex shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground/20 transition-colors hover:bg-accent active:scale-95 group-focus-within/composer:text-foreground/40 dark:text-foreground/10 dark:group-focus-within/composer:text-foreground/20',
          hero ? 'size-8' : INLINE_CONTROL,
        )}
      >
        <svg width={hero ? 16 : 15} height={hero ? 16 : 15} viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
    </Tooltip>
  );
}

export function Composer({
  hero,
  hostKey,
  onSend,
  onStop,
}: {
  /** Leerer Chat: große Box mit eigener Steuerzeile (Talos „new chat“). */
  hero: boolean;
  hostKey: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const streaming = useChat((s) => s.streaming);
  const [text, setText] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const inputRow = useRef<HTMLDivElement>(null);
  const inputBox = useRef<HTMLDivElement>(null);
  const inputTrail = useRef<HTMLDivElement>(null);
  const inputLead = useRef<HTMLDivElement>(null);

  // Markenname ausdrücklich einsetzen: Die Texte werden sonst vor dem Laden des Brandings
  // mit „Talos“ zwischengespeichert.
  const brand = useBrand((s) => s.name);
  const brandLoaded = useBrand((s) => s.loaded);
  const placeholders = useMemo(() => {
    const raw = t(`composer.placeholders.${hostKey ?? 'none'}`, { returnObjects: true, brand });
    let list = Array.isArray(raw) && raw.length > 0 ? (raw as string[]) : [t('composer.placeholder', { brand })];
    // Solange das Branding lädt, keine Texte mit Markennamen (sonst blitzt „Talos“ auf)
    if (!brandLoaded) list = list.filter((p) => !p.includes(brand));
    return list.length ? list : ['Beschreib, was du brauchst…'];
  }, [t, hostKey, brand, brandLoaded]);
  const empty = text.length === 0;
  const [placeholder, setPlaceholder] = useState(() => placeholders[Math.floor(Math.random() * placeholders.length)]);
  // Neu wählen, sobald die Texte wechseln (z. B. Markenname nach dem Laden des Brandings)
  useEffect(() => {
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
  }, [placeholders]);
  // A fresh prompt each time the box empties again.
  const wasEmpty = useRef(empty);
  useEffect(() => {
    if (empty && !wasEmpty.current) {
      setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
    }
    wasEmpty.current = empty;
  }, [empty, placeholders]);

  // Diktat (wie Talos): während der Aufnahme steht der Live-Text kursiv an Stelle des
  // Eingabefelds; das erste Enter übernimmt ihn, das zweite sendet. Escape verwirft.
  const dictation = useDictation((spoken) => {
    setText((prev) => (prev.trim() ? prev.replace(/\s+$/, '') + ' ' : '') + spoken);
  });
  const dictating = dictation.status !== 'idle';
  const wasDictating = useRef(false);
  useEffect(() => {
    if (wasDictating.current && !dictating) {
      autoresize();
      const el = textarea.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    }
    wasDictating.current = dictating;
  });
  useEffect(() => {
    if (!dictating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (dictation.status === 'recording') dictation.confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dictation.cancel();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [dictating, dictation]);

  const selection = useSelection((s) => s.info);
  const showStop = streaming && !text.trim();

  // Height is measured on a hidden twin rather than by resetting the textarea
  // to `height:auto` (see Talos Composer).
  const autoresize = () => {
    const el = textarea.current;
    const twin = mirror.current;
    const row = inputRow.current;
    const box = inputBox.current;
    if (!el) return;
    if (!twin || !row || !box) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
      return;
    }
    twin.textContent = `${el.value}\n`;
    const pad = getComputedStyle(row);
    const inner = row.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    const trail = inputTrail.current?.offsetWidth ?? 0;
    const lead = inputLead.current?.offsetWidth ?? 0;
    const measure = (width: number) => {
      twin.style.width = `${Math.max(1, width)}px`;
      return twin.scrollHeight;
    };
    const lanePad = (lead ? lead + CONTROL_GAP : 0) + (trail ? trail + CONTROL_GAP : 0);
    const laneHeight = measure(inner - lanePad);
    const lineHeight = parseFloat(getComputedStyle(twin).lineHeight) || laneHeight;
    const overflows = laneHeight > lineHeight + 1;
    const height = Math.min(overflows ? measure(inner) : laneHeight, MAX_INPUT_HEIGHT);
    box.style.marginInlineStart = overflows || !lead ? '0px' : `${lead + CONTROL_GAP}px`;
    box.style.marginInlineEnd = overflows || !trail ? '0px' : `${trail + CONTROL_GAP}px`;
    const controlRow = Math.max(inputLead.current?.offsetHeight ?? 0, inputTrail.current?.offsetHeight ?? 0);
    box.style.marginBottom = overflows && controlRow ? `${controlRow + CONTROL_GAP}px` : '0px';
    el.style.height = `${height}px`;
    el.style.overflowY = height >= MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  };

  useEffect(() => {
    autoresize();
    const onResize = () => autoresize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, showStop]);

  /** Skill aus dem „+“-Menü: Hinweis vor den Text setzen */
  const pickSkill = (name: string) => {
    setText((v) => `Nutze den Skill „${name}“: ${v.replace(/^Nutze den Skill „[^“]*“: /, '')}`);
    requestAnimationFrame(() => {
      autoresize();
      const el = textarea.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const submit = () => {
    const value = text.trim();
    if (!value || streaming) return;
    onSend(value);
    setText('');
    requestAnimationFrame(autoresize);
  };

  // ── Befehle („/…“) ──
  const commands = useMemo(() => commandsFor(hostKey), [hostKey]);
  const slashMatch = /^\/([\w-]*)$/.exec(text);
  const slashItems = slashMatch ? commands.filter((c) => c.name.startsWith(slashMatch[1].toLowerCase())) : [];
  const [slashIndex, setSlashIndex] = useState(0);
  useEffect(() => setSlashIndex(0), [slashMatch?.[1]]);
  const focusEnd = () =>
    requestAnimationFrame(() => {
      autoresize();
      const el = textarea.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  const chooseCommand = (name: string, sendNow: boolean) => {
    if (sendNow && !streaming) {
      onSend(`/${name}`);
      setText('');
      requestAnimationFrame(autoresize);
      return;
    }
    setText(`/${name} `);
    focusEnd();
  };
  // Befehl aus dem Startbildschirm übernehmen
  const injectNonce = useComposerInject((s) => s.nonce);
  useEffect(() => {
    if (!injectNonce) return;
    setText(useComposerInject.getState().value);
    focusEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectNonce]);

  return (
    <div className={cn('relative mx-auto w-full max-w-[800px]', hero ? 'px-4' : 'px-3 pb-2')}>
      {slashItems.length > 0 && (
        <div role="listbox" className="absolute inset-x-3 bottom-full z-30 mb-1.5 overflow-hidden rounded-xl border bg-popover p-1 shadow-lg">
          {slashItems.map((c, i) => (
            <button
              key={c.name}
              type="button"
              role="option"
              aria-selected={i === slashIndex}
              onMouseEnter={() => setSlashIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => chooseCommand(c.name, !c.needsArg)}
              className={cn("grid w-full grid-cols-[auto_1fr] items-baseline gap-x-2.5 rounded-lg px-2.5 py-1.5 text-left", i === slashIndex && "bg-accent")}
            >
              <span className="shrink-0 font-mono text-[13px] text-foreground">/{c.name}</span>
              <span className="min-w-0 text-[12.5px] leading-snug text-muted-foreground">{c.description}{c.argHint ? ` · ${c.argHint}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      <div className={cn(selection && 'rounded-[12px] border border-foreground/12 bg-muted/80 dark:border-foreground/10 dark:bg-foreground/[0.06]')}>
      {selection && <SelectionHeader label={selection.label} />}
      <div
        className={cn(
          'group/composer relative rounded-[10px] border border-foreground/14 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_-8px_rgba(0,0,0,0.07)] transition-colors duration-200 focus-within:border-foreground/32 dark:border-foreground/10 dark:bg-card dark:shadow-none dark:focus-within:border-foreground/20',
          selection && '-mx-px -mb-px',
        )}
      >
        <div ref={inputRow} className={cn('relative', hero ? 'px-3 pb-1 pt-2' : 'p-2')}>
          <div ref={inputBox} className="relative min-w-0 transition-[margin] duration-150 ease-out">
            {dictating && (
              <div aria-live="polite" className={cn('w-full overflow-y-auto break-words whitespace-pre-wrap', INPUT_TEXT, hero && 'min-h-[3.25rem]')} style={{ maxHeight: MAX_INPUT_HEIGHT }}>
                {text.trim() && <span>{text.replace(/\s+$/, '')} </span>}
                <span className="text-muted-foreground italic">
                  {dictation.interim || (dictation.status === 'finalizing' ? t('composer.transcribing') : dictation.status === 'starting' ? t('composer.micStarting') : t('composer.listening'))}
                </span>
                <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse rounded-full bg-muted-foreground/70" />
              </div>
            )}
            <div
              ref={mirror}
              aria-hidden="true"
              className={cn('pointer-events-none invisible absolute left-0 top-0 break-words whitespace-pre-wrap', INPUT_TEXT)}
            />
            <textarea
              hidden={dictating}
              ref={textarea}
              value={text}
              rows={hero ? 2 : 1}
              autoFocus
              placeholder={placeholder}
              aria-label={t('composer.messageInput')}
              onChange={(e) => {
                setText(e.target.value);
                autoresize();
              }}
              onKeyDown={(e) => {
                if (slashItems.length) {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSlashIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + slashItems.length) % slashItems.length);
                    return;
                  }
                  if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                    e.preventDefault();
                    const c = slashItems[Math.min(slashIndex, slashItems.length - 1)];
                    chooseCommand(c.name, e.key === 'Enter' && !c.needsArg);
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setText('');
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className={cn(
                'relative block w-full resize-none bg-transparent text-strong outline-none transition-[height] duration-150 ease-out placeholder:text-muted-foreground/65 dark:placeholder:text-muted-foreground',
                INPUT_TEXT,
              )}
              style={{ maxHeight: MAX_INPUT_HEIGHT }}
            />
          </div>
          {!hero && (
            <div ref={inputLead} className="absolute bottom-2 start-2">
              <ComposerAddMenu onPickSkill={pickSkill} className={INLINE_CONTROL} />
            </div>
          )}
          {!hero && (
            <div ref={inputTrail} className="absolute bottom-2 end-2 flex items-center gap-1">
              <MicButton
                status={dictation.status}
                onClick={() => {
                  if (dictation.status === 'recording') dictation.confirm();
                  else if (dictation.status === 'idle') void dictation.start();
                }}
              />
              {showStop ? (
                <StopButton onClick={onStop} />
              ) : (
                <button
                  type="button"
                  aria-label={t('composer.send')}
                  onClick={() => (dictation.status === 'recording' ? dictation.confirm() : submit())}
                  className={cn(
                    'flex shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground/20 transition-colors group-focus-within/composer:text-foreground/40 hover:bg-accent active:scale-95 dark:text-foreground/10 dark:group-focus-within/composer:text-foreground/20',
                    INLINE_CONTROL,
                  )}
                >
                  <CornerDownLeftIcon aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {hero && (
          <div className="flex min-w-0 items-center gap-1 ps-1.5 pe-2 pb-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <ComposerAddMenu onPickSkill={pickSkill} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ModelEffortPicker />
              {showStop ? (
                <StopButton hero onClick={onStop} />
              ) : empty && !dictating ? (
                <MicButton hero status={dictation.status} onClick={() => void dictation.start()} />
              ) : (
                <button
                  type="button"
                  aria-label={t('composer.send')}
                  onClick={() => (dictation.status === 'recording' ? dictation.confirm() : submit())}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-primary text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95"
                >
                  <ArrowUpIcon aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {dictation.error && !dictating && (
        <p className="mt-1 text-center text-[11px] leading-tight text-red-500">
          {t(`composer.dictationError.${dictation.error}`)}
        </p>
      )}
      {!hero && (
        <div className="mt-2 flex min-w-0 flex-nowrap items-center justify-between gap-3">
          <p className="min-w-0 truncate ps-1 text-xs text-muted-foreground/70">{t('composer.aiDisclaimer')}</p>
          <div className="me-2 flex shrink-0 flex-nowrap items-center justify-end gap-1">
            <ModelEffortPicker placement="outside" />
          </div>
        </div>
      )}
    </div>
  );
}
