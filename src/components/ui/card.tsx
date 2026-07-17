import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentProps<'section'>) {
	return <section className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />;
}
