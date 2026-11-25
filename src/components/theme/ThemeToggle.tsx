import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import type { ThemePreference } from '@/src/lib/theme/theme';
import { cn } from '@/src/lib/utils';

interface ThemeToggleProps {
  variant?: 'compact' | 'detailed';
  className?: string;
}

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  shortLabel: string;
  icon: typeof Moon;
}> = [
  { value: 'dark', label: 'Mode sombre', shortLabel: 'Sombre', icon: Moon },
  { value: 'light', label: 'Mode clair', shortLabel: 'Clair', icon: Sun },
  { value: 'system', label: 'Automatique (système)', shortLabel: 'Auto', icon: Monitor },
];

export function ThemeToggle({ variant = 'compact', className }: ThemeToggleProps) {
  const { preference, resolvedTheme, setPreference } = useTheme();

  if (variant === 'detailed') {
    return (
      <div className={cn('space-y-2', className)} data-testid="theme-selector-detailed">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--rc-fg)]">
            Apparence de l&apos;interface RestoConnect
          </p>
          <span className="text-[11px] font-mono text-[var(--rc-muted)]">
            Actif : {resolvedTheme === 'dark' ? 'Sombre' : 'Clair'}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Choisir le thème de l'interface"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
        >
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = preference === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreference(opt.value)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer',
                  active
                    ? 'border-[var(--rc-gold)] bg-[var(--rc-gold-tint)] text-[var(--rc-fg)]'
                    : 'border-[var(--rc-border)] bg-[var(--rc-card)] text-[var(--rc-muted)] hover:text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)]'
                )}
              >
                <Icon
                  className={cn('h-4 w-4 shrink-0', active ? 'text-[var(--rc-gold)]' : 'text-[var(--rc-muted)]')}
                  aria-hidden="true"
                />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Sélecteur de thème"
      data-testid="theme-toggle"
      className={cn(
        'inline-flex items-center rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-0.5 shrink-0',
        className
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-label={opt.label}
            aria-pressed={active}
            title={opt.label}
            data-theme-option={opt.value}
            onClick={() => setPreference(opt.value)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap',
              active
                ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline">{opt.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
