import { cn } from '@/src/lib/utils';

interface BrandMarkProps {
  className?: string;
  inverted?: boolean;
  compact?: boolean;
}

export function BrandMark({ className, inverted = false, compact = false }: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 whitespace-nowrap shrink-0', className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="28"
          height="28"
          rx="7"
          fill="#F5B800"
        />
        <path
          d="M8.5 9H15.2C17.2435 9 18.9 10.6565 18.9 12.7C18.9 14.7435 17.2435 16.4 15.2 16.4H8.5V9Z"
          stroke="#0B0B0B"
          strokeWidth="2"
        />
        <path
          d="M8.5 16.4V20M14.3 16.4L18.6 20"
          stroke="#0B0B0B"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span
          className={cn(
            'font-display text-lg font-bold tracking-tight',
            inverted ? 'text-white' : 'text-[var(--rc-fg)]'
          )}
        >
          Resto<span className="text-[var(--rc-gold)]">Connect</span>
        </span>
      )}
    </span>
  );
}
