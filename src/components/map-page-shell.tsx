"use client"

import * as React from "react"
import type { CSSProperties, ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { EarthquakeFilterSidebar } from "@/components/earthquake-filter-sidebar"
import { ForecastDetailsSidebar } from "@/components/forecast-details-sidebar"
import { ReviewDialog } from "@/components/review-dialog"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  searchEarthquakeMarkers,
  type EarthquakeMarker,
} from "@/data/earthquakes"
import {
  EARTHQUAKE_EVENTS_REQUEST_EVENT,
  EARTHQUAKE_EVENTS_UPDATED_EVENT,
  EARTHQUAKE_FOCUS_EVENT,
  EARTHQUAKE_LOAD_MORE_EVENT,
  EARTHQUAKE_RENDER_EVENTS_EVENT,
  EARTHQUAKE_REVIEW_STATUS_UPDATED_EVENT,
  EARTHQUAKE_SELECTED_EVENT,
  FORECAST_REVIEW_EVENT,
  createDefaultMapFilters,
  type EarthquakeMapFilters,
} from "@/lib/earthquake-map-filters"
import type { ReviewStatus } from "@/lib/reviews"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  operatorEmail: string
  operatorDisplayName: string
}
type EventState = {
  events: EarthquakeMarker[]
  hasMore: boolean
  atLimit: boolean
  loadingMore: boolean
}

function replaceStatus(events: EarthquakeMarker[], eventId: string, status: ReviewStatus) {
  return events.map((event) => event.id === eventId ? { ...event, reviewStatus: status } : event)
}

function MapPageContent({ children, operatorEmail, operatorDisplayName }: Props) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar()
  const [filtered, setFiltered] = React.useState<EventState>({ events: [], hasMore: false, atLimit: false, loadingMore: false })
  const [filters, setFilters] = React.useState(createDefaultMapFilters)
  const [target, setTarget] = React.useState(50)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchEvents, setSearchEvents] = React.useState<EarthquakeMarker[]>([])
  const [searchOffset, setSearchOffset] = React.useState(0)
  const [searchHasMore, setSearchHasMore] = React.useState(false)
  const [searchAtLimit, setSearchAtLimit] = React.useState(false)
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [searchRetry, setSearchRetry] = React.useState(0)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [forecastEvent, setForecastEvent] = React.useState<EarthquakeMarker | null>(null)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [reviewEvent, setReviewEvent] = React.useState<EarthquakeMarker | null>(null)
  const searchRequest = React.useRef(0)
  const trimmedSearch = searchQuery.trim()
  const searchReady = trimmedSearch.length >= 3 && !searchLoading && !searchError
  const sourceEvents = searchReady ? searchEvents : filtered.events
  const visibleEvents = React.useMemo(() => sourceEvents.slice(0, target), [sourceEvents, target])

  React.useEffect(() => {
    const updateEvents = (event: Event) => setFiltered((event as CustomEvent<EventState>).detail)
    const selectEvent = (event: Event) => {
      const selected = (event as CustomEvent<EarthquakeMarker>).detail
      setSelectedEventId(selected.id)
      if (selected.hasForecast) setFiltersOpen(false)
      setForecastEvent(selected.hasForecast ? selected : null)
      if (selected.hasForecast && isMobile) setOpenMobile(false)
      else if (!isMobile) setOpen(true)
    }
    const reviewForecast = (event: Event) => {
      const selected = (event as CustomEvent<EarthquakeMarker>).detail
      setSelectedEventId(selected.id)
      setFiltersOpen(false)
      setForecastEvent(selected)
      setReviewEvent(selected)
    }
    document.addEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents)
    document.addEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent)
    document.addEventListener(FORECAST_REVIEW_EVENT, reviewForecast)
    document.dispatchEvent(new Event(EARTHQUAKE_EVENTS_REQUEST_EVENT))
    return () => {
      document.removeEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents)
      document.removeEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent)
      document.removeEventListener(FORECAST_REVIEW_EVENT, reviewForecast)
    }
  }, [isMobile, setOpen, setOpenMobile])

  React.useEffect(() => {
    const requestId = ++searchRequest.current
    if (trimmedSearch.length < 3) {
      setSearchEvents([])
      setSearchOffset(0)
      setSearchHasMore(false)
      setSearchAtLimit(false)
      setSearchLoading(false)
      setSearchError(null)
      return
    }
    setSearchLoading(true)
    setSearchError(null)
    const timer = window.setTimeout(async () => {
      try {
        const page = await searchEarthquakeMarkers(trimmedSearch, filters)
        if (searchRequest.current !== requestId) return
        setSearchEvents(page.events)
        setSearchOffset(page.nextOffset)
        setSearchHasMore(page.hasMore)
        setSearchAtLimit(page.atLimit)
        document.dispatchEvent(new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, { detail: { events: page.events, fitBounds: true } }))
      } catch (error) {
        if (searchRequest.current === requestId) setSearchError(error instanceof Error ? error.message : "Could not search earthquake events.")
      } finally {
        if (searchRequest.current === requestId) setSearchLoading(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [filters, searchRetry, trimmedSearch])

  React.useEffect(() => {
    if (searchReady || filtered.events.length >= target || !filtered.hasMore || filtered.atLimit || filtered.loadingMore) return
    document.dispatchEvent(new Event(EARTHQUAKE_LOAD_MORE_EVENT))
  }, [filtered, searchReady, target])

  React.useEffect(() => {
    if (!searchReady || searchEvents.length >= target || !searchHasMore || searchAtLimit || searchLoadingMore) return
    let current = true
    setSearchLoadingMore(true)
    void searchEarthquakeMarkers(trimmedSearch, filters, searchOffset)
      .then((page) => {
        if (!current) return
        setSearchEvents((events) => [...events, ...page.events])
        setSearchOffset(page.nextOffset)
        setSearchHasMore(page.hasMore)
        setSearchAtLimit(page.atLimit)
      })
      .catch((error) => { if (current) setSearchError(error instanceof Error ? error.message : "Could not load more events.") })
      .finally(() => { if (current) setSearchLoadingMore(false) })
    return () => { current = false }
  }, [filters, searchAtLimit, searchEvents.length, searchHasMore, searchLoadingMore, searchOffset, searchReady, target, trimmedSearch])

  React.useEffect(() => {
    document.dispatchEvent(new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, { detail: { events: visibleEvents } }))
  }, [visibleEvents])

  function focusEvent(event: EarthquakeMarker) {
    setSelectedEventId(event.id)
    if (event.hasForecast) setFiltersOpen(false)
    setForecastEvent(event.hasForecast ? event : null)
    document.dispatchEvent(new CustomEvent(EARTHQUAKE_FOCUS_EVENT, { detail: { id: event.id, latitude: event.latitude, longitude: event.longitude } }))
    if (isMobile) setOpenMobile(false)
  }

  function applyFilters(next: EarthquakeMapFilters) {
    setFilters(next)
    setSelectedEventId(null)
    setForecastEvent(null)
    document.dispatchEvent(new CustomEvent("quakestrike:filters", { detail: next }))
    if (isMobile) {
      setFiltersOpen(false)
      setOpenMobile(true)
    }
  }

  function openFilters() {
    setFiltersOpen(true)
    if (isMobile) setOpenMobile(false)
  }

  function closeFilters() {
    setFiltersOpen(false)
    if (isMobile && !forecastEvent) setOpenMobile(true)
  }

  function reviewSaved(eventId: string, status: ReviewStatus) {
    setFiltered((state) => ({ ...state, events: replaceStatus(state.events, eventId, status) }))
    setSearchEvents((events) => replaceStatus(events, eventId, status))
    setForecastEvent((event) => event?.id === eventId ? { ...event, reviewStatus: status } : event)
    setReviewEvent((event) => event?.id === eventId ? { ...event, reviewStatus: status } : event)
    document.dispatchEvent(new CustomEvent(EARTHQUAKE_REVIEW_STATUS_UPDATED_EVENT, { detail: { eventId, status } }))
  }

  return (
    <>
      <AppSidebar
        events={visibleEvents}
        selectedEventId={selectedEventId}
        searchQuery={searchQuery}
        searchLoading={searchLoading}
        error={searchError}
        loadingMore={filtered.loadingMore || searchLoadingMore}
        atLimit={searchReady ? searchAtLimit : filtered.atLimit}
        target={target}
        filters={filters}
        operator={{ name: operatorDisplayName || "Operator", email: operatorEmail }}
        onSearchQueryChange={setSearchQuery}
        onRetry={() => setSearchRetry((value) => value + 1)}
        onSelectEvent={focusEvent}
        onTargetChange={setTarget}
        onOpenFilters={openFilters}
      />
      <div className={cn("fixed inset-0 z-40 overflow-hidden bg-sidebar transition-[width] md:static md:z-auto md:block", filtersOpen || forecastEvent ? "w-full md:w-80 md:border-r" : "pointer-events-none w-0")}>
        {filtersOpen ? (
          <EarthquakeFilterSidebar filters={filters} onApply={applyFilters} onClose={closeFilters} />
        ) : forecastEvent ? (
          <ForecastDetailsSidebar
            event={forecastEvent}
            status={forecastEvent.reviewStatus as ReviewStatus}
            onClose={() => { setForecastEvent(null); if (isMobile) setOpenMobile(true) }}
            onReview={() => setReviewEvent(forecastEvent)}
          />
        ) : null}
      </div>
      <SidebarInset className="isolate flex h-svh min-w-0 flex-col overflow-hidden">
        <header className="relative z-10 flex h-12 shrink-0 items-center bg-background/95 px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="relative z-0 h-[calc(100svh-3rem)] min-h-0 overflow-hidden px-2 pb-2">{children}</div>
      </SidebarInset>
      <ReviewDialog event={reviewEvent} onOpenChange={(open) => { if (!open) setReviewEvent(null) }} onSaved={reviewSaved} />
    </>
  )
}

export function MapPageShell(props: Props) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen style={{ "--sidebar-width": "350px" } as CSSProperties}>
        <MapPageContent {...props} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
