import { CheckCircle2, Clock, PauseCircle, XCircle, Minus } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type SemanticTone = 'emerald' | 'amber' | 'crimson' | 'neutral';

interface StatusLabelProps {
  label: string;
  tone?: SemanticTone;
  className?: string;
}

const TONE_CLASSES: Record<SemanticTone, string> = {
  emerald: 'text-[var(--rc-success-fg)]',
  amber: 'text-[var(--rc-warn-fg)]',
  crimson: 'text-[var(--rc-danger-fg)]',
  neutral: 'text-[var(--rc-muted)]',
};

export function StatusLabel({ label, tone = 'neutral', className }: StatusLabelProps) {
  const Icon =
    tone === 'emerald'
      ? CheckCircle2
      : tone === 'amber'
        ? Clock
        : tone === 'crimson'
          ? XCircle
          : Minus;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium leading-tight min-w-0',
        TONE_CLASSES[tone],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function LicensePausedIcon() {
  return <PauseCircle className="h-3.5 w-3.5 shrink-0 text-[var(--rc-warn-fg)]" aria-hidden="true" />;
}
