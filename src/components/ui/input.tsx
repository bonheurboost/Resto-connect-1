import * as React from 'react';
import { cn } from '@/src/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] px-3.5 py-2 text-sm text-[var(--rc-fg)] placeholder:text-[var(--rc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-[var(--rc-surface-muted)] disabled:opacity-70',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
