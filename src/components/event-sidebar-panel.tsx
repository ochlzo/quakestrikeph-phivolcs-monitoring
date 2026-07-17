import * as React from "react"
import {
  FilterIcon,
  LoaderCircleIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar"
import type { EarthquakeMarker } from "@/data/earthquakes"
import {
  countActiveMapFilters,
  type EarthquakeMapFilters,
} from "@/lib/earthquake-map-filters"
import { sanitizeSearchInput } from "@/lib/input-security"
import { REVIEW_STATUS_LABELS, type ReviewStatus } from "@/lib/reviews"
import { cn } from "@/lib/utils"

const LIMITS = [50, 100, 250, 500, 1000, 2000]
const STATUS_STYLE: Record<ReviewStatus | "NO_FORECAST", string> = {
  NO_FORECAST: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "border-amber-300 bg-amber-50 text-amber-800",
  DRAFT: "border-blue-200 bg-blue-50 text-blue-700",
  REVIEWED_NO_ALERT: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REVIEWED_FOR_ALERT: "border-primary/20 bg-accent text-primary",
}

export type EventSidebarPanelProps = {
  events: EarthquakeMarker[]
  selectedEventId: string | null
  searchQuery: string
  searchLoading: boolean
  error: string | null
  loadingMore: boolean
  atLimit: boolean
  target: number
  filters: EarthquakeMapFilters
  operator: { name: string; email: string }
  mobileNavigation?: React.ReactNode
  onSearchQueryChange: (value: string) => void
  onRetry: () => void
  onSelectEvent: (event: EarthquakeMarker) => void
  onTargetChange: (value: number) => void
  onOpenFilters: () => void
}

export function EventSidebarPanel({
  events,
  selectedEventId,
  searchQuery,
  searchLoading,
  error,
  loadingMore,
  atLimit,
  target,
  filters,
  operator,
  mobileNavigation,
  onSearchQueryChange,
  onRetry,
  onSelectEvent,
  onTargetChange,
  onOpenFilters,
}: EventSidebarPanelProps) {
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
              onClick={() => onSearchQueryChange("")}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
        <Button type="button" variant="outline" className="justify-start" onClick={onOpenFilters}>
          <FilterIcon />
          Filter earthquakes
          {countActiveMapFilters(filters) ? <Badge className="ml-auto">{countActiveMapFilters(filters)}</Badge> : null}
        </Button>
        {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 ? (
          <p className="text-xs text-muted-foreground">Type at least 3 characters.</p>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="min-h-0 flex-1 p-0">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>Earthquake events</span>
            <span>{events.length.toLocaleString()}</span>
          </div>
          {error ? (
            <div role="alert" className="m-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>Try again</Button>
            </div>
          ) : null}
          <ul aria-busy={searchLoading || loadingMore} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {events.map((event) => {
              const status = event.reviewStatus ?? (event.hasForecast ? "PENDING_REVIEW" : "NO_FORECAST")
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    aria-pressed={selectedEventId === event.id}
                    onClick={() => onSelectEvent(event)}
                    className={cn(
                      "w-full rounded-lg border border-transparent p-3 text-left hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selectedEventId === event.id && "border-sidebar-border bg-sidebar-accent",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium leading-snug">{event.location ?? "Unknown location"}</span>
                      <strong className="shrink-0">M{event.magnitude.toFixed(1)}</strong>
                    </div>
                    <span className="mt-1 block text-xs text-muted-foreground">{event.date} · {event.depth} km deep</span>
                    <Badge className={cn("mt-2", STATUS_STYLE[status])}>
                      {status === "NO_FORECAST" ? "No forecast" : REVIEW_STATUS_LABELS[status]}
                    </Badge>
                  </button>
                </li>
              )
            })}
          </ul>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 font-medium">
            Show data
            <select value={target} onChange={(event) => onTargetChange(Number(event.target.value))} className="h-8 rounded-md border bg-background px-2">
              {LIMITS.map((value) => <option value={value} key={value}>{value.toLocaleString()}</option>)}
            </select>
          </label>
          <span className="tabular-nums text-muted-foreground">{events.length.toLocaleString()} / 2,000 max</span>
          {searchLoading || loadingMore ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
        </div>
        {atLimit ? <p className="text-xs text-muted-foreground">Cannot load data more than 2,000.</p> : null}
        <div className="md:hidden"><NavUser user={operator} /></div>
      </SidebarFooter>
    </Sidebar>
  )
}
