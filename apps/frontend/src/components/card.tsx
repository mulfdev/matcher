import clsx from 'clsx';
import type React from 'react';

export function Card({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'rounded-xl border border-zinc-950/10 bg-white text-zinc-950 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-white'
      )}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'px-6 py-5')} />;
}

export function CardTitle({ className, ...props }: React.ComponentPropsWithoutRef<'h3'>) {
  return <h3 {...props} className={clsx(className, 'text-lg font-semibold')} />;
}

export function CardDescription({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return (
    <p {...props} className={clsx(className, 'mt-1 text-sm text-zinc-500 dark:text-zinc-400')} />
  );
}

export function CardContent({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'px-6 py-5 pt-0')} />;
}

export function CardFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex items-center px-6 py-4 border-t border-zinc-950/10 dark:border-white/10'
      )}
    />
  );
}
