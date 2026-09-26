import { ChevronRightIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolCall } from '@/lib/types';
import { describeCall, diffStat, partsToString } from '@/lib/toolLabels';
import { useChat } from '@/state/chat';
import { TOOL_FAIL_CLASS, TOOL_PASS_CLASS, ToolLabel } from './ToolLabel';
import { Button } from './ui/button';
import { Collapse } from './ui/collapse';

/** Line-coloured unified diff, the format `_unified_diff` emits on the backend
 *  for edit_file / write_file. Shown instead of the raw tool output so a code
 *  edit reads as a change rather than as a log line. Renders as a bare section —
 *  the surrounding `CallDetails` box supplies border, background and type. */
export function DiffView({ diff }: { diff: string }) {
  const lines = diff.split('\n');
  return (
    <pre className="max-h-80 overflow-auto py-2">
      {lines.map((line, i) => {
        const kind = line.startsWith('+++') || line.startsWith('---')
          ? 'meta'
          : line.startsWith('@@')
            ? 'hunk'
            : line.startsWith('+')
              ? 'add'
              : line.startsWith('-')
                ? 'del'
                : 'ctx';
        return (
          <div
            key={i}
            className={`px-3 ${
              kind === 'add'
                ? 'bg-success/10 text-success'
                : kind === 'del'
                  ? 'bg-destructive/10 text-destructive-foreground'
                  : kind === 'hunk' || kind === 'meta'
                    ? 'text-muted-foreground/70'
                    : ''
            }`}
          >
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
}

/** Changed-line counter — "+21 -2". Part of the label sentence, not a badge
 *  bolted onto it: it inherits the label's size and typeface so the whole line
 *  reads as one run of text, and only its digits carry the muted pass/fail
 *  tints (the loud --success / --destructive are for alerts). */
export function DiffStatBadge({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="shrink-0 tabular-nums">
      {added > 0 && <span className={TOOL_PASS_CLASS}>+{added}</span>}
      {added > 0 && removed > 0 && ' '}
      {removed > 0 && <span className={TOOL_FAIL_CLASS}>-{removed}</span>}
    </span>
  );
}

/** Command, diff and output as ONE box rather than three stacked ones: a single
 *  border and background, sections split by hairlines. The command reads at
 *  full brightness (it is the thing you scanned for), the output muted below
 *  it, so the pair scans as input → result instead of as two equal blocks. */
function CallDetails({ call }: { call: ToolCall }) {
  const sections: ReactNode[] = [];
  if (call.command) {
    sections.push(
      <pre key="cmd" className="max-h-56 overflow-auto bg-muted/70 px-3 py-2 whitespace-pre-wrap">{call.command}</pre>,
    );
  }
  if (call.diff) sections.push(<DiffView key="diff" diff={call.diff} />);
  if (call.output) {
    sections.push(
      <pre key="out" className="max-h-72 overflow-y-auto px-3 py-2 whitespace-pre-wrap text-muted-foreground">
        {call.output}
      </pre>,
    );
  }
  if (sections.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/25 font-mono text-[12.5px] leading-snug">
      {sections.map((section, i) => (
        // Hairline between sections only — never above the first one, which
        // would double up with the box's own border.
        <div key={i} className={i > 0 ? 'border-t border-border/60' : undefined}>
          {section}
        </div>
      ))}
    </div>
  );
}

/** Freigabe einer Änderung, wenn „Änderungen bestätigen“ an ist. Sitzt in der
 *  Zeile des Aufrufs, damit klar ist, worum es geht. */
function ConfirmBar({ callId }: { callId: string }) {
  const { t } = useTranslation();
  const pending = useChat((s) => s.pendingConfirm);
  if (!pending || pending.callId !== callId) return null;
  return (
    <div className="flex items-center gap-2 px-3 pb-2.5">
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{t('confirm.title')}</span>
      <Button size="sm" variant="outline" onClick={() => pending.resolve(false)}>
        {t('confirm.reject')}
      </Button>
      <Button size="sm" onClick={() => pending.resolve(true)}>
        {t('confirm.run')}
      </Button>
    </div>
  );
}

/** One tool-call row inside a ToolGroup: a readable label ("Read TODO.md"),
 *  expandable to the raw command, its output, and a diff when the call changed
 *  a file. */
export function ToolRow({ call }: { call: ToolCall; compact?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const running = call.status === 'running';
  const label = describeCall(call, t, running ? 'running' : 'past');
  const stat = diffStat(call.diff);
  const awaiting = useChat((s) => s.pendingConfirm?.callId === call.id);
  // Wartet der Aufruf auf Freigabe, gleich die Argumente zeigen.
  useEffect(() => {
    if (awaiting) setOpen(true);
  }, [awaiting]);
  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        // The verb's colour carries pass/fail visually; spell it out for screen
        // readers, which get no colour.
        aria-label={`${partsToString(label)}${call.status === 'error' ? ` — ${t('toolGroup.failed')}` : ''}`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className={`min-w-0 truncate ${running ? 'shimmer-text' : ''}`}>
          <ToolLabel parts={label} failed={call.status === 'error'} />
        </span>
        {stat && <DiffStatBadge added={stat.added} removed={stat.removed} />}
        <ChevronRightIcon className={`size-3.5 shrink-0 opacity-60 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <Collapse open={open}>
        <div className="px-3 pb-2.5">
          <CallDetails call={call} />
        </div>
      </Collapse>
      <ConfirmBar callId={call.id} />
    </div>
  );
}
