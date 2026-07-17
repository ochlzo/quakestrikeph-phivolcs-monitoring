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
type SearchStatus = "idle" | "loading" | "ready" | "error"

function replaceStatus(events: EarthquakeMarker[], eventId: string, status: ReviewStatus) {
  return events.map((event) => event.id === eventId ? { ...event, reviewStatus: status } : event)
}

function MapPageContent({ children, operatorEmail, operatorDisplayName }: Props) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar()
  const [filtered, setFiltered] = React.useState<EventState>({ events: [], hasMore: false, atLimit: false, loadingMore: false })
  const [filters, setFilters] = React.useState(createDefaultMapFilters)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchEvents, setSearchEvents] = React.useState<EarthquakeMarker[]>([])
  const [searchOffset, setSearchOffset] = React.useState(0)
  const [searchHasMore, setSearchHasMore] = React.useState(false)
  const [searchAtLimit, setSearchAtLimit] = React.useState(false)
  const [searchStatus, setSearchStatus] = React.useState<SearchStatus>("idle")
  const [searchLoadingMore, setSearchLoadingMore] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [searchRetry, setSearchRetry] = React.useState(0)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [selectionVersion, setSelectionVersion] = React.useState(0)
  const [forecastEvent, setForecastEvent] = React.useState<EarthquakeMarker | null>(null)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [reviewEvent, setReviewEvent] = React.useState<EarthquakeMarker | null>(null)
  const searchRequest = React.useRef(0)
  const searchLoadingMoreRef = React.useRef(false)
  const trimmedSearch = searchQuery.trim()
  const searchReady = trimmedSearch.length >= 3 && searchStatus === "ready"
  const visibleEvents = searchReady ? searchEvents : filtered.events

  React.useEffect(() => {
    const updateEvents = (event: Event) => setFiltered((event as CustomEvent<EventState>).detail)
    const selectEvent = (event: Event) => {
      const selected = (event as CustomEvent<EarthquakeMarker>).detail
      setSelectedEventId(selected.id)
      setSelectionVersion((version) => version + 1)
      if (selected.hasForecast) setFiltersOpen(false)
      setForecastEvent(selected.hasForecast ? selected : null)
      if (selected.hasForecast && isMobile) setOpenMobile(false)
      else if (!isMobile) setOpen(true)
    }
    const reviewForecast = (event: Event) => {
      const selected = (event as CustomEvent<EarthquakeMarker>).detail
      setSelectedEventId(selected.id)
      setSelectionVersion((version) => version + 1)
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
      setSearchStatus("idle")
      setSearchLoadingMore(false)
      searchLoadingMoreRef.current = false
      setSearchError(null)
      return
    }
    setSearchStatus("loading")
    setSearchOffset(0)
    setSearchHasMore(false)
    setSearchAtLimit(false)
    setSearchLoadingMore(false)
    searchLoadingMoreRef.current = false
    setSearchError(null)
    const timer = window.setTimeout(async () => {
      try {
        const page = await searchEarthquakeMarkers(trimmedSearch, filters)
        if (searchRequest.current !== requestId) return
        setSearchEvents(page.events)
        setSearchOffset(page.nextOffset)
        setSearchHasMore(page.hasMore)
        setSearchAtLimit(page.atLimit)
        setSearchStatus("ready")
        document.dispatchEvent(new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, { detail: { events: page.events, fitBounds: true } }))
      } catch (error) {
        if (searchRequest.current !== requestId) return
        setSearchStatus("error")
        setSearchError(error instanceof Error ? error.message : "Could not search earthquake events.")
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [filters, searchRetry, trimmedSearch])

  React.useEffect(() => {
    document.dispatchEvent(new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, { detail: { events: visibleEvents } }))
  }, [visibleEvents])

  function focusEvent(event: EarthquakeMarker) {
    setSelectedEventId(event.id)
    setSelectionVersion((version) => version + 1)
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

  async function loadMoreEvents() {
    if (!searchReady) {
      if (filtered.hasMore && !filtered.loadingMore && !filtered.atLimit) {
        document.dispatchEvent(new Event(EARTHQUAKE_LOAD_MORE_EVENT))
      }
      return
    }
    if (!searchHasMore || searchAtLimit || searchLoadingMoreRef.current) return

    const requestId = searchRequest.current
    searchLoadingMoreRef.current = true
    setSearchLoadingMore(true)
    setSearchError(null)
    try {
      const page = await searchEarthquakeMarkers(trimmedSearch, filters, searchOffset)
      if (searchRequest.current !== requestId) return
      const events = [...searchEvents, ...page.events]
      setSearchEvents(events)
      setSearchOffset(page.nextOffset)
      setSearchHasMore(page.hasMore)
      setSearchAtLimit(page.atLimit)
      document.dispatchEvent(new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, { detail: { events } }))
    } catch (error) {
      if (searchRequest.current === requestId) {
        setSearchError(error instanceof Error ? error.message : "Could not load more earthquake events.")
      }
    } finally {
      searchLoadingMoreRef.current = false
      if (searchRequest.current === requestId) setSearchLoadingMore(false)
    }
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
        activePath="/"
        operator={{ name: operatorDisplayName || "Operator", email: operatorEmail }}
        eventPanel={{
          events: visibleEvents,
          selectedEventId,
          selectionVersion,
          searchQuery,
          searchLoading: searchStatus === "loading",
          globalSearchActive: searchReady,
          error: searchError,
          loadingMore: searchReady ? searchLoadingMore : filtered.loadingMore,
          hasMore: searchReady ? searchHasMore : filtered.hasMore,
          atLimit: searchReady ? searchAtLimit : filtered.atLimit,
          filters,
          onSearchQueryChange: setSearchQuery,
          onRetry: () => setSearchRetry((value) => value + 1),
          onLoadMore: loadMoreEvents,
          onSelectEvent: focusEvent,
          onOpenFilters: openFilters,
        }}
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
