// Rückfrage-Popup (ask_user): nummerierte Antworten (auch per Taste 1–9),
// „Etwas anderes“ mit eigenem Eingabefeld, Überspringen und Schließen. Mehrere Fragen werden
// nacheinander gestellt und am Ende gemeinsam gesendet.
import { CheckIcon, ChevronLeftIcon, PencilIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAnswers } from '@/lib/ask';
import { cn } from '@/lib/utils';
import { useChat } from '@/state/chat';
import { Button } from './ui/button';

export function QuestionCard({ onAnswer }: { onAnswer: (text: string) => void }) {
  const { t } = useTranslation();
  const msg = useChat((s) => [...s.messages].reverse().find((m) => m.ask?.length && !m.askDone && !m.askClosed));
  const streaming = useChat((s) => s.streaming);
  const patchMessage = useChat((s) => s.patchMessage);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [other, setOther] = useState('');
  const card = useRef<HTMLDivElement>(null);
  const questions = msg?.ask ?? [];
  const q = questions[step];

  // Neue Rückfrage: von vorn beginnen und die Karte fokussieren (für die Zifferntasten)
  useEffect(() => {
    setStep(0);
    setAnswers([]);
    setPicked(new Set());
    setOther('');
    if (msg) requestAnimationFrame(() => card.current?.focus());
  }, [msg?.id]);

  if (!msg || !q || streaming) return null;

  const total = questions.length;
  const close = () => patchMessage(msg.id, { askClosed: true });
  const finish = (all: string[]) => {
    patchMessage(msg.id, { askDone: true });
    const text = all.every((a) => !a) ? t('ask.skipped') : formatAnswers(questions, all);
    onAnswer(text);
  };
  const answer = (value: string) => {
    const all = [...answers];
    all[step] = value.trim();
    setAnswers(all);
    setPicked(new Set());
    setOther('');
    if (step + 1 >= total) finish(all);
    else {
      setStep(step + 1);
      requestAnimationFrame(() => card.current?.focus());
    }
  };
  const toggle = (label: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  const choose = (label: string) => (q.multi ? toggle(label) : answer(label));
  const multiValue = () => [...q.options.map((o) => o.label).filter((l) => picked.has(l)), ...(other.trim() ? [other.trim()] : [])].join(', ');

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div aria-hidden="true" onClick={close} className="animate-backdrop-in absolute inset-0 bg-black/40 backdrop-blur-[1.5px]" />
      <div className="animate-sheet-in relative mx-auto w-full max-w-[800px] px-3 pb-3">
      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-label={q.question}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).tagName === 'INPUT') return;
          const n = Number(e.key);
          if (n >= 1 && n <= q.options.length) {
            e.preventDefault();
            choose(q.options[n - 1].label);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
        aria-modal="true"
        className="max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-foreground/12 bg-background shadow-[0_2px_4px_rgba(0,0,0,0.06),0_24px_48px_-12px_rgba(0,0,0,0.35)] outline-none dark:border-foreground/10 dark:bg-card"
      >
        <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
          <div className="min-w-0 flex-1">
            {total > 1 && <div className="mb-0.5 text-[11px] font-medium text-muted-foreground">{t('ask.step', { n: step + 1, total })}</div>}
            <div className="text-[15px] leading-snug font-semibold text-strong">{q.question}</div>
            {q.multi && <div className="mt-0.5 text-xs text-muted-foreground">{t('ask.chooseMany')}</div>}
          </div>
          <button
            type="button"
            aria-label={t('ask.close')}
            title={t('ask.close')}
            onClick={close}
            className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex flex-col px-2">
          {q.options.map((o, i) => {
            const on = picked.has(o.label);
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => choose(o.label)}
                className={cn(
                  'group/opt flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent',
                  i > 0 && 'border-t border-foreground/8 hover:border-transparent',
                  on && 'bg-primary/8',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground tabular-nums',
                    on && 'bg-primary text-primary-foreground',
                  )}
                >
                  {on ? <CheckIcon className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-snug text-strong">{o.label}</span>
                  {o.description && <span className="block text-xs leading-snug text-muted-foreground">{o.description}</span>}
                </span>
              </button>
            );
          })}
          {/* Eigene Antwort */}
          <label className={cn('mt-1 flex items-center gap-3 rounded-xl bg-muted/60 px-2 py-2', !q.options.length && 'mt-0')}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/70 text-muted-foreground dark:bg-foreground/5">
              <PencilIcon className="size-3.5" />
            </span>
            <input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (q.multi) {
                    if (multiValue()) answer(multiValue());
                  } else if (other.trim()) answer(other);
                } else if (e.key === 'Escape') {
                  (e.target as HTMLInputElement).blur();
                  card.current?.focus();
                }
              }}
              placeholder={q.options.length ? t('ask.other') : t('ask.otherPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-strong outline-none placeholder:text-muted-foreground/70"
            />
          </label>
        </div>

        <div className="mt-2 flex items-center gap-2 border-t border-foreground/8 px-4 py-2.5">
          {step > 0 && (
            <Button variant="ghost-muted" size="sm" onClick={() => setStep(step - 1)}>
              <ChevronLeftIcon /> {t('ask.back')}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" size="sm" onClick={() => answer('')}>
            {t('ask.skip')}
          </Button>
          {(q.multi || other.trim()) && (
            <Button size="sm" disabled={q.multi ? !multiValue() : !other.trim()} onClick={() => answer(q.multi ? multiValue() : other)}>
              {step + 1 < total ? t('ask.next') : t('ask.send')}
            </Button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
