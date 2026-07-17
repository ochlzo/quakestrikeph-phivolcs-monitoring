import * as React from 'react';
import { FilterIcon, LoaderCircleIcon, RotateCcwIcon, SearchIcon, XIcon } from 'lucide-react';

import { NavUser } from '@/components/nav-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from '@/components/ui/sidebar';
import type { EarthquakeMarker } from '@/data/earthquakes';
import { countActiveMapFilters, type EarthquakeMapFilters } from '@/lib/earthquake-map-filters';
import { sanitizeSearchInput } from '@/lib/input-security';
import { REVIEW_STATUS_LABELS, type ReviewStatus } from '@/lib/reviews';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<ReviewStatus | 'NO_FORECAST', string> = {
  NO_FORECAST: 'bg-muted text-muted-foreground',
  PENDING_REVIEW: 'border-amber-300 bg-amber-50 text-amber-800',
  DRAFT: 'border-blue-200 bg-blue-50 text-blue-700',
  REVIEWED_NO_ALERT: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  REVIEWED_FOR_ALERT: 'border-primary/20 bg-accent text-primary',
};

export type EventSidebarPanelProps = {
  events: EarthquakeMarker[];
  selectedEventId: string | null;
  selectionVersion: number;
  searchQuery: string;
  searchLoading: boolean;
  globalSearchActive: boolean;
  error: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  atLimit: boolean;
  filters: EarthquakeMapFilters;
  operator: { name: string; email: string };
  mobileNavigation?: React.ReactNode;
  onSearchQueryChange: (value: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onSelectEvent: (event: EarthquakeMarker) => void;
  onOpenFilters: () => void;
};

export function EventSidebarPanel({
  events,
  selectedEventId,
  selectionVersion,
  searchQuery,
  searchLoading,
  globalSearchActive,
  error,
  loadingMore,
  hasMore,
  atLimit,
  filters,
  operator,
  mobileNavigation,
  onSearchQueryChange,
  onRetry,
  onLoadMore,
  onSelectEvent,
  onOpenFilters,
}: EventSidebarPanelProps) {
  const selectedRowRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const endRef = React.useRef<HTMLLIElement>(null);
  const resultLabel = `${events.length.toLocaleString()} ${events.length === 1 ? 'event' : 'events'}`;

  React.useEffect(() => {
    if (!selectedEventId) return;
    selectedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedEventId, selectionVersion]);

  React.useEffect(() => {
    if (searchLoading || error || !hasMore || loadingMore || atLimit || !endRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { root: listRef.current, rootMargin: '0px 0px 120px' },
    );
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [atLimit, error, hasMore, loadingMore, onLoadMore, searchLoading]);

  const eventList =
    !events.length && (searchLoading || error) ? (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        {searchLoading ? (
          <>
            <LoaderCircleIcon className="size-5 animate-spin" />
            Searching all earthquake events…
          </>
        ) : (
          <>
            <p>{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RotateCcwIcon />
              Retry search
            </Button>
          </>
        )}
      </div>
    ) : !events.length && !hasMore ? (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <p>
          {globalSearchActive
            ? 'No matching earthquake locations found.'
            : 'No earthquakes match the current filters.'}
        </p>
        {atLimit ? <p>Cannot load data more than 2000</p> : null}
      </div>
    ) : (
      <div className="relative min-h-0 flex-1">
        {searchLoading ? (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 border-b border-sidebar-border bg-sidebar/95 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            <LoaderCircleIcon className="size-3.5 animate-spin" />
            Searching all events…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-sidebar p-2 text-xs">
            <span className="text-destructive">{error}</span>
            <Button type="button" variant="ghost" size="xs" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : null}
        <ul ref={listRef} aria-busy={loadingMore} className="h-full space-y-1 overflow-y-auto p-2">
          {events.map((event) => {
            const status =
              event.reviewStatus ?? (event.hasForecast ? 'PENDING_REVIEW' : 'NO_FORECAST');
            return (
              <li key={event.id}>
                <button
                  ref={event.id === selectedEventId ? selectedRowRef : undefined}
                  type="button"
                  aria-pressed={event.id === selectedEventId}
                  onClick={() => onSelectEvent(event)}
                  className={cn(
                    'w-full rounded-lg border border-transparent p-3 text-left text-sm hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    event.id === selectedEventId && 'border-sidebar-border bg-sidebar-accent',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium leading-snug">
                      {event.location ?? 'Unknown location'}
                    </span>
                    <span className="shrink-0 font-medium">M{event.magnitude.toFixed(1)}</span>
                  </div>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {event.date} · {event.depth} km deep
                  </span>
                  <Badge className={cn('mt-2', STATUS_STYLE[status])}>
                    {status === 'NO_FORECAST' ? 'No forecast' : REVIEW_STATUS_LABELS[status]}
                  </Badge>
                </button>
              </li>
            );
          })}
          {hasMore || atLimit ? (
            <li
              ref={endRef}
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground"
            >
              {atLimit ? (
                'Cannot load data more than 2000'
              ) : (
                <>
                  Loading more events...
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                </>
              )}
            </li>
          ) : null}
        </ul>
      </div>
    );

  return (
    <Sidebar collapsible="none" className="flex min-w-0 flex-1">
      <SidebarHeader className="gap-3 border-b p-4">
        <div>
          <p className="font-medium">QuakeStrike PH</p>
          <p className="text-xs text-muted-foreground">PHIVOLCS Monitoring Platform</p>
        </div>
        {mobileNavigation ? <div className="md:hidden">{mobileNavigation}</div> : null}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search earthquake locations"
            placeholder="Search all provinces"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(sanitizeSearchInput(event.target.value))}
            className="px-8 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => onSearchQueryChange('')}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
        <Button type="button" variant="outline" className="justify-start" onClick={onOpenFilters}>
          <FilterIcon />
          Filter earthquakes
          {countActiveMapFilters(filters) ? (
            <Badge className="ml-auto">{countActiveMapFilters(filters)} active</Badge>
          ) : null}
        </Button>
        {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 ? (
          <p className="text-xs text-muted-foreground">Type at least 3 characters.</p>
        ) : null}
        {globalSearchActive ? (
          <p className="text-xs text-muted-foreground">
            Showing matches from all earthquake events.
          </p>
        ) : null}
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="min-h-0 flex-1 p-0">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>{globalSearchActive ? 'Search results' : 'Current map results'}</span>
            <span>{resultLabel}</span>
          </div>
          {eventList}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-3 md:hidden">
        <NavUser user={operator} />
      </SidebarFooter>
    </Sidebar>
  );
}
