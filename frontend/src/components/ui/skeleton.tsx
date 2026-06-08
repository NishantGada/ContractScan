import { cn } from '@/lib/utils'

/**
 * Placeholder block shown while data is loading. Uses a subtle pulse and the
 * semantic border token so it reads as "content pending" against any surface.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-border/70', className)}
      {...props}
    />
  )
}
