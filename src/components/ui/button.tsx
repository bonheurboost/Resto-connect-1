import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--rc-primary-btn)] text-[var(--rc-primary-btn-fg)] font-semibold hover:bg-[var(--rc-gold-hover)]',
        accent:
          'bg-[var(--rc-gold-soft)] text-[#0B0B0B] font-semibold hover:bg-[var(--rc-gold)]',
        outline:
          'border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)]',
        secondary:
          'bg-[var(--rc-secondary-btn)] text-[var(--rc-secondary-btn-fg)] hover:opacity-90',
        ghost: 'text-[var(--rc-fg)] hover:bg-[var(--rc-surface-muted)]',
        destructive: 'bg-[#DC2626] text-white hover:bg-[#B91C1C]',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
