// Aus Talos/web/src/components/Messages.tsx übernommen – gleiche Turn-Darstellung,
// gleiche Arbeits-Zeile, gleiche Gedanken und Toolgruppen. Weggelassen ist nur,
// was es im Add-in nicht gibt (Anhänge, Artefakte, Quellen, Pläne, Widgets).
import { CheckIcon, ChevronDownIcon, CopyIcon, MessageCircleQuestionIcon, ScanSearchIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn, copyTextToClipboard, formatDurationMs } from '@/lib/utils';
import { describeStatus, partsToString, toolFamily, type LabelParts } from '@/lib/toolLabels';
import type { UiMessage } from '@/lib/types';
import { useChat } from '@/state/chat';
import { usePrefs } from '@/state/prefs';
import { CitationProvider, citationMap, citedNumbers, WebSourceChips } from './Citations';
import { Markdown } from './Markdown';
import { RollingNumber } from './RollingNumber';
import { TalosLogo } from './TalosLogo';
import { ToolGroup, type GroupEntry } from './ToolGroup';
import { WorkingOrb, type OrbState } from './WorkingOrb';
import { Collapse } from './ui/collapse';
import { Tooltip } from './ui/misc';

const formatWorkingElapsed = (startMs: number, nowMs: number) => formatDurationMs(nowMs - startMs);

/** Self-ticking "Working for Xs" label — updates its own text node each second
 *  so the streaming message tree isn't re-committed every tick (t3code style). */
function WorkingTimer({ startedAt }: { startedAt: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = () => {
      if (ref.current) ref.current.textContent = formatWorkingElapsed(startedAt, Date.now());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span ref={ref} className="tabular-nums">{formatWorkingElapsed(startedAt, Date.now())}</span>;
}

/** Relative timestamp shown under a bubble. */
function MessageTime({ ts }: { ts?: number }) {
  const { t, i18n } = useTranslation();
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return null;
  const diff = Date.now() - ts;
  let label: string;
  if (diff < 60_000) label = t('messages.timeJustNow');
  else if (diff < 3_600_000) label = t('messages.timeMinAgo', { count: Math.floor(diff / 60_000) });
  else if (diff < 86_400_000) label = t('messages.timeHourAgo', { count: Math.floor(diff / 3_600_000) });
  else label = new Date(ts).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: false });
  return <span className="text-xs text-muted-foreground/70 tabular-nums">{label}</span>;
}

/** How long each phrase in `thinking.phases` holds before the status moves on. */
const THINKING_PHRASE_SECONDS = 18;

/** How long the reasoning text may sit unchanged before the status stops
 *  calling it thinking. */
const THINKING_IDLE_MS = 2500;

/** True while reasoning tokens are actually arriving — not merely while the
 *  turn HAS reasoning. */
function useThinkingLive(text: string): boolean {
  const [live, setLive] = useState(false);
  const previous = useRef(text);
  useEffect(() => {
    if (text === previous.current) return;
    previous.current = text;
    setLive(true);
    const id = setTimeout(() => setLive(false), THINKING_IDLE_MS);
    return () => clearTimeout(id);
  }, [text]);
  return live;
}

/** Phrase for a stretch of reasoning, picked by how long it has been going:
 *  straight down `thinking.phases`, then cycled from the second entry. */
function thinkingPhrase(t: ReturnType<typeof useTranslation>['t'], since: number | null): string {
  const phases = t('thinking.phases', { returnObjects: true });
  const list = Array.isArray(phases) && phases.length > 0 ? (phases as string[]) : [t('thinking.thinking')];
  const seconds = since != null ? (Date.now() - since) / 1000 : 0;
  const step = Math.floor(Math.max(seconds, 0) / THINKING_PHRASE_SECONDS);
  const last = list.length - 1;
  return step <= last || last < 1 ? list[Math.min(step, last)] : list[1 + ((step - last - 1) % last)];
}

/** Lower-cases a tool label's leading glyph so it reads as a caption. */
function asCaption(parts: LabelParts): string {
  const at = parts.findIndex((s) => s.kind !== 'name');
  if (at < 0) return partsToString(parts);
  return partsToString(
    parts.map((s, i) => (i === at ? { ...s, text: s.text.charAt(0).toLocaleLowerCase() + s.text.slice(1) } : s)),
  );
}

/** Live status beside the working timer: what the agent is doing *right now*.
 *  Clicking it shows or hides the reasoning text in the turn body. */
function ActivityStatus({
  turn,
  thinkingLive,
  thinkingSince,
  hasThinking,
}: {
  turn: UiMessage[];
  thinkingLive: boolean;
  thinkingSince: number | null;
  hasThinking: boolean;
}) {
  const { t } = useTranslation();
  const showThinking = usePrefs((s) => s.visibility.showThinking);
  const setVisibility = usePrefs((s) => s.setVisibility);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const running = [...turn].reverse().flatMap((m) => [...(m.tools ?? [])].reverse()).find((c) => c.status === 'running');
  const last = turn[turn.length - 1];

  let label: string;
  if (running) label = asCaption([{ text: describeStatus(running, t), kind: 'plain' }]);
  else if (thinkingLive) label = thinkingPhrase(t, thinkingSince);
  else if (last?.streaming && last.content.trim()) label = t('thinking.writing');
  else label = t('thinking.waiting');

  if (!hasThinking) {
    return <span className="block min-w-0 truncate">{label}</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={showThinking}
      title={t(showThinking ? 'thinking.hide' : 'thinking.show')}
      onClick={() => setVisibility('showThinking', !showThinking)}
      className="block min-w-0 truncate text-left transition-colors hover:text-foreground"
    >
      {label}
    </button>
  );
}

/** Which orb animation fits a tool family. */
const FAMILY_ORB: Record<string, OrbState> = {
  selection: 'searching', layouts: 'searching', cellsRead: 'searching',
  pptRead: 'weaving', docRead: 'weaving', bookRead: 'weaving',
  text: 'shaping', textBox: 'shaping', shape: 'shaping', shapeEdit: 'shaping', shapeDelete: 'shaping',
  slideAdd: 'shaping', slideDelete: 'shaping', slideMove: 'shaping', table: 'shaping', format: 'shaping',
  selectionReplace: 'shaping', paragraphsAdd: 'shaping', paragraphEdit: 'shaping', styleSet: 'shaping',
  paragraphsDelete: 'shaping', replace: 'shaping', comment: 'shaping', pageBreak: 'shaping',
  cellsWrite: 'shaping', cellsClear: 'shaping', sheetAdd: 'shaping', chart: 'shaping', sort: 'working',
};

function activityOrbState(turn: UiMessage[], thinkingLive: boolean): OrbState {
  const call = [...turn].reverse().flatMap((m) => [...(m.tools ?? [])].reverse()).find((c) => c.status === 'running');
  if (call) return FAMILY_ORB[toolFamily(call.tool)] ?? 'working';
  if (thinkingLive) return 'solving';
  const last = turn[turn.length - 1];
  if (last?.streaming && last.content.trim()) return 'composing';
  return 'breathing';
}

const SETTLE_FADE_MS = 500;

/** Persistent "still running" indicator shown for the whole assistant turn —
 *  the orb, an elapsed timer, the running output-token count and the activity
 *  status. When the turn ends the orb plays out and dissolves into the resting
 *  Talos logo. */
function Working({
  startedAt,
  phase,
  onFinished,
  tokens,
  turn,
  thinking,
  thinkingLive,
  thinkingSince,
}: {
  startedAt?: number;
  phase: 'running' | 'settling' | 'rest';
  onFinished?: () => void;
  tokens: number;
  turn: UiMessage[];
  thinking: boolean;
  thinkingLive: boolean;
  thinkingSince: number | null;
}) {
  const { t } = useTranslation();
  const running = phase === 'running';
  const [faded, setFaded] = useState(false);
  const [playerGone, setPlayerGone] = useState(false);
  useEffect(() => {
    if (running) {
      setFaded(false);
      setPlayerGone(false);
    }
  }, [running]);
  useEffect(() => {
    if (!faded) return;
    const id = setTimeout(() => setPlayerGone(true), SETTLE_FADE_MS);
    return () => clearTimeout(id);
  }, [faded]);

  const everPlayed = useRef(false);
  if (phase !== 'rest') everPlayed.current = true;

  const showLogo = phase === 'rest' || faded;
  const orbState = activityOrbState(turn, thinkingLive);
  const handleFinished = () => {
    setFaded(true);
    onFinished?.();
  };
  const showPlayer = everPlayed.current && !playerGone;

  return (
    <div
      className="mt-3 flex min-w-0 items-center gap-2 pb-1 text-[11px] text-muted-foreground/70 tabular-nums"
      aria-label={running ? t('messages.generating') : undefined}
    >
      <span aria-hidden className="relative inline-block size-5 shrink-0">
        {showPlayer && (
          <WorkingOrb
            className={cn(
              'absolute inset-0 size-full transition-opacity duration-500',
              faded ? 'opacity-0' : 'opacity-100',
            )}
            state={orbState}
            playing={running}
            onFinished={handleFinished}
          />
        )}
        <TalosLogo
          mono
          className={cn(
            'absolute inset-0 size-full transition-opacity duration-500',
            showLogo ? 'opacity-100' : 'opacity-0',
          )}
        />
      </span>
      {running && <span className="shrink-0 whitespace-nowrap">{startedAt ? <WorkingTimer startedAt={startedAt} /> : t('messages.working')}</span>}
      {running && tokens > 0 && (
        <>
          <span aria-hidden>·</span>
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap" aria-label={t('thinking.tokensLabel', { count: tokens })}>
            <RollingNumber value={tokens} compact />
            <span aria-hidden>{t('thinking.tokensUnit', { count: tokens })}</span>
          </span>
        </>
      )}
      {running && (
        <>
          <span aria-hidden>·</span>
          <ActivityStatus turn={turn} thinkingLive={thinkingLive} thinkingSince={thinkingSince} hasThinking={thinking} />
        </>
      )}
    </div>
  );
}

type TurnSegment =
  | { kind: 'text'; msg: UiMessage }
  | { kind: 'thinking'; id: string; text: string }
  | { kind: 'activity'; id: string; entries: GroupEntry[] };

/** Split a turn into the sequence a reader should see: what the model said, and
 *  — bunched into one collapsible group between those — what it did. */
function buildSegments(turn: UiMessage[], showThinking: boolean): TurnSegment[] {
  const out: TurnSegment[] = [];
  let pending: GroupEntry[] = [];
  let pendingId = '';
  let seq = 0;
  const add = (id: string, entry: GroupEntry) => {
    if (pending.length === 0) pendingId = `${id}-${seq++}`;
    pending.push(entry);
  };
  const flush = () => {
    if (pending.length === 0) return;
    out.push({ kind: 'activity', id: pendingId, entries: pending });
    pending = [];
  };
  for (const m of turn) {
    if (showThinking && m.thinking?.trim()) {
      flush();
      out.push({ kind: 'thinking', id: m.id, text: m.thinking.trim() });
    }
    if (m.content.trim()) {
      flush();
      out.push({ kind: 'text', msg: m });
    }
    for (const call of m.tools ?? []) add(m.id, { kind: 'call', call });
  }
  flush();
  return out;
}

/** Output tokens produced so far, estimated from what has streamed in (chars/4). */
const estimateOutputTokens = (turn: UiMessage[]): number => {
  const chars = turn.reduce((acc, m) => {
    const calls = (m.tools ?? []).reduce((n, c) => n + c.tool.length + (c.command?.length ?? 0), 0);
    return acc + m.content.length + (m.thinking?.length ?? 0) + calls;
  }, 0);
  return Math.round(chars / 4);
};

/** The tick the token count is sampled on. */
const tokenCheckpoint = (turn: UiMessage[]): number =>
  turn.length + turn.reduce((acc, m) => acc + (m.tools ?? []).filter((c) => c.status !== 'running').length, 0);

function useSampledTokens(estimate: number, checkpoint: number): number {
  const [shown, setShown] = useState(estimate);
  const lastCheckpoint = useRef(checkpoint);
  useEffect(() => {
    if (lastCheckpoint.current === checkpoint) return;
    lastCheckpoint.current = checkpoint;
    setShown(estimate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoint]);
  return shown;
}

/** Settled-turn fold: collapses everything the turn did behind a quiet
 *  "Worked for Xs" line, with only the final answer left standing outside it. */
function ActivityFold({ turn, showThinking, durationMs, terminalId }: { turn: UiMessage[]; showThinking: boolean; durationMs: number | null; terminalId?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = durationMs != null ? t('messages.workedFor', { duration: formatDurationMs(durationMs) }) : t('messages.worked');
  return (
    <div className="my-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full select-none items-center gap-1.5 text-[14px] font-medium text-muted-foreground tabular-nums transition-colors hover:text-foreground"
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDownIcon className={`size-3.5 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <Collapse open={open}>
        <div className="mt-1.5">
          <TurnBody turn={turn} showThinking={showThinking} hideContentFor={terminalId} settled />
        </div>
      </Collapse>
    </div>
  );
}

/** Renders a turn's segments. Shared by the streaming and settled branches. */
export function TurnBody({ turn, showThinking, hideContentFor, settled }: { turn: UiMessage[]; showThinking: boolean; hideContentFor?: string; settled?: boolean }) {
  return (
    <>
      {buildSegments(turn, showThinking).map((seg) => {
        if (seg.kind === 'activity') {
          return <ToolGroup key={`act-${seg.id}`} entries={seg.entries} settled={settled} />;
        }
        if (seg.kind === 'thinking') {
          return (
            <div
              key={`think-${seg.id}`}
              className="my-1 text-[14px] leading-relaxed whitespace-pre-wrap text-muted-foreground italic"
            >
              {seg.text}
            </div>
          );
        }
        if (seg.msg.id === hideContentFor) return null;
        return (
          <div key={seg.msg.id} className={seg.msg.error ? 'text-destructive-foreground' : 'text-strong'}>
            <Markdown text={seg.msg.content} streaming={!!seg.msg.streaming} />
          </div>
        );
      })}
    </>
  );
}

function ActionIcon({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function CopyAction({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copyTextToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <ActionIcon label={copied ? t('messages.copied') : t('messages.copy')} onClick={() => void copy()}>
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
    </ActionIcon>
  );
}

/** One assistant turn = the run of consecutive assistant bubbles after a user
 *  message. */
function AssistantTurn({ turn, containsLast }: { turn: UiMessage[]; containsLast: boolean }) {
  const { t } = useTranslation();
  const showThinking = usePrefs((s) => s.visibility.showThinking);
  const showMetrics = usePrefs((s) => s.visibility.messageMetrics);
  const turnStartedAt = useChat((s) => s.turnStartedAt);

  const streaming = turn.some((m) => m.streaming);
  const [windingDown, setWindingDown] = useState(false);
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !streaming) setWindingDown(true);
    if (streaming) setWindingDown(false);
    wasStreaming.current = streaming;
  }, [streaming]);
  const hasThinking = turn.some((m) => !!m.thinking?.trim());
  const thinkingText = turn.map((m) => m.thinking ?? '').join('');
  const thinkingLive = useThinkingLive(thinkingText);
  const thinkingSince = useRef<number | null>(null);
  if (hasThinking) thinkingSince.current ??= Date.now();

  const tokens = useSampledTokens(estimateOutputTokens(turn), tokenCheckpoint(turn));
  const indicator = (streaming || windingDown || containsLast) && (
    <Working
      startedAt={turnStartedAt ?? undefined}
      phase={streaming ? 'running' : windingDown ? 'settling' : 'rest'}
      onFinished={() => setWindingDown(false)}
      tokens={tokens}
      turn={turn}
      thinking={hasThinking}
      thinkingLive={thinkingLive}
      thinkingSince={thinkingSince.current}
    />
  );

  const last = turn[turn.length - 1];
  const citations = citationMap(turn.map((m) => m.citations));
  const copyText = turn.map((m) => m.content.trim()).filter(Boolean).join('\n\n');

  if (streaming) {
    return (
      <CitationProvider citations={citations}>
        <TurnBody turn={turn} showThinking={showThinking} />
        {indicator}
      </CitationProvider>
    );
  }

  const terminal = [...turn].reverse().find((m) => m.content.trim().length > 0);
  const terminalId = terminal?.id;
  const hasFoldedCommentary = turn.some((m) => m.id !== terminalId && m.content.trim().length > 0);
  const hasActivity =
    hasFoldedCommentary || turn.some((m) => (m.thinking && showThinking) || (m.tools?.length ?? 0) > 0);
  const durationMs = last.turnElapsedMs ?? null;
  // Im Antworttext zitierte Webseiten als Zeile „Quellen:“ unter der Antwort (wie Talos)
  const webCited = citedNumbers(terminal?.content ?? '')
    .map((n) => citations.get(n))
    .filter((c): c is NonNullable<typeof c> => !!c && c.kind === 'web');

  return (
    <CitationProvider citations={citations}>
      {hasActivity && (
        <ActivityFold turn={turn} showThinking={showThinking} durationMs={durationMs} terminalId={terminalId} />
      )}
      {terminal && (
        <div className={terminal.error ? 'text-destructive-foreground' : 'text-strong'}>
          <Markdown text={terminal.content} />
        </div>
      )}
      {/* Bilder aus der zugeklappten Toolgruppe (Selbstcheck), wie in Talos unter
          der Antwort wieder sichtbar – nur die jeweils letzte Fassung jeder Folie. */}
      {/* Rückfragen dieses Auftrags (die Antwort folgt als Nutzernachricht) */}
      {turn.filter((m) => m.ask?.length && (m.askDone || m.askClosed)).map((m) => (
        <div key={m.id} className="mt-2 flex flex-col gap-1.5">
          {m.ask!.map((q, i) => (
            <div key={i} className="flex items-start gap-2 text-[14px] text-strong">
              <MessageCircleQuestionIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0">{q.question}</span>
            </div>
          ))}
          {!m.askDone && (
            <button
              type="button"
              onClick={() => useChat.getState().patchMessage(m.id, { askClosed: false })}
              className="ml-6 self-start rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {t('ask.answer')}
            </button>
          )}
        </div>
      ))}
      {webCited.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground/80">{t('messages.sources')}:</span>
          <WebSourceChips citations={webCited} />
        </div>
      )}
      {copyText && (
        <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyAction text={copyText} />
          {showMetrics && <MessageTime ts={last.createdAt} />}
        </div>
      )}
      {indicator}
    </CitationProvider>
  );
}

export function Messages() {
  const { t } = useTranslation();
  const messages = useChat((s) => s.messages);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const syncScrollState = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const atBottom = !hasOverflow || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pinned.current = atBottom;
    setShowScrollToBottom(hasOverflow && !atBottom);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
    syncScrollState();
  }, [messages, syncScrollState]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
      syncScrollState();
    });
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    syncScrollState();
    return () => observer.disconnect();
  }, [syncScrollState]);

  const scrollToBottom = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    pinned.current = true;
    setShowScrollToBottom(false);
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  type Block = { kind: 'user'; msg: UiMessage } | { kind: 'turn'; turn: UiMessage[] };
  const blocks: Block[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    if (m.role === 'user') {
      blocks.push({ kind: 'user', msg: m });
    } else {
      const turn: UiMessage[] = [];
      while (i < messages.length && messages[i].role === 'assistant') {
        turn.push(messages[i]);
        i += 1;
      }
      i -= 1;
      blocks.push({ kind: 'turn', turn });
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scroller} onScroll={syncScrollState} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]" role="log" aria-live="polite">
        <div className="mx-auto flex w-full max-w-[800px] flex-col px-4 pb-6 pt-4">
          {blocks.map((block, index) =>
            block.kind === 'user' ? (
              <div key={block.msg.id} className={`group ml-auto flex w-full max-w-[85%] flex-col items-end gap-0.5 ${index === 0 ? '' : 'mt-3'}`}>
                {block.msg.selection && (
                  <span className="mb-0.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2 py-0.5 text-xs text-muted-foreground">
                    <ScanSearchIcon className="size-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 truncate">{block.msg.selection}</span>
                  </span>
                )}
                <div className="rounded-lg rounded-br-sm bg-bubble px-3 py-1 text-[14px] leading-relaxed whitespace-pre-wrap text-strong">
                  {block.msg.content}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <CopyAction text={block.msg.content} />
                  <MessageTime ts={block.msg.createdAt} />
                </div>
              </div>
            ) : (
              <div key={block.turn[0].id} className={`group w-full ${index === 0 ? '' : 'mt-3'}`}>
                <AssistantTurn turn={block.turn} containsLast={block.turn.some((m) => m.id === lastAssistantId)} />
              </div>
            ),
          )}
        </div>
      </div>
      {showScrollToBottom && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 justify-center">
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label={t('messages.scrollToBottom')}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:cursor-pointer hover:border-foreground/25 hover:text-foreground dark:border-border/60 dark:hover:border-border"
          >
            <ChevronDownIcon className="size-3.5" />
            {t('messages.scrollToBottom')}
          </button>
        </div>
      )}
    </div>
  );
}
