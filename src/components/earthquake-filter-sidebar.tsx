import * as React from "react"
import { XIcon } from "lucide-react"

import { ForecastFilterFields } from "@/components/forecast-filter-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createDefaultMapFilters,
  type EarthquakeMapFilters,
  type FilterRange,
} from "@/lib/earthquake-map-filters"
import {
  MAGNITUDE_RANGE_OPTIONS,
  type MagnitudeRange,
} from "@/lib/magnitude-ranges"
import { cn } from "@/lib/utils"

type Props = {
  filters: EarthquakeMapFilters
  onApply: (filters: EarthquakeMapFilters) => void
  onClose: () => void
}

function sameRange(left: MagnitudeRange, right: MagnitudeRange) {
  return left.from === right.from && left.to === right.to && left.upperExclusive === right.upperExclusive
}

function normalizeRange(range: FilterRange | null) {
  return range && (range.from || range.to) ? range : null
}

export function EarthquakeFilterSidebar({ filters, onApply, onClose }: Props) {
  const [draft, setDraft] = React.useState(filters)
  React.useEffect(() => setDraft(filters), [filters])

  function toggleMagnitude(range: MagnitudeRange, checked: boolean) {
    const current = draft.events.magnitude ?? []
    const magnitude = checked
      ? [...current, range]
      : current.filter((item) => !sameRange(item, range))
    setDraft({ ...draft, events: { ...draft.events, magnitude: magnitude.length ? magnitude : null } })
  }

  function setRange(kind: "depth" | "date", key: keyof FilterRange, value: string) {
    setDraft({
      ...draft,
      events: {
        ...draft.events,
        [kind]: { from: draft.events[kind]?.from ?? "", to: draft.events[kind]?.to ?? "", [key]: value },
      },
    })
  }

  const depthInvalid = Boolean(draft.events.depth?.from && draft.events.depth.to && Number(draft.events.depth.from) > Number(draft.events.depth.to))
  const dateInvalid = Boolean(draft.events.date?.from && draft.events.date.to && draft.events.date.from > draft.events.date.to)

  function apply() {
    if (depthInvalid || dateInvalid) return
    onApply({
      ...draft,
      events: {
        ...draft.events,
        depth: normalizeRange(draft.events.depth),
        date: normalizeRange(draft.events.date),
      },
    })
  }

  function reset() {
    const next = createDefaultMapFilters()
    setDraft(next)
    onApply(next)
  }

  return (
    <aside aria-label="Earthquake filters" className="flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground md:w-80">
      <header className="flex items-center justify-between border-b border-sidebar-border p-4">
        <div>
          <h2 className="font-medium">Filter earthquakes</h2>
          <p className="text-xs text-muted-foreground">Narrow the events shown on the map.</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close filters" onClick={onClose}>
          <XIcon />
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <section className="space-y-4">
          <h3 className="font-semibold">Earthquake event filters</h3>
          <fieldset>
            <legend className="mb-2 font-medium">Magnitude</legend>
            <div className="grid grid-cols-2 gap-2">
              {MAGNITUDE_RANGE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(draft.events.magnitude ?? []).some((range) => sameRange(range, option.range))}
                    onChange={(event) => toggleMagnitude(option.range, event.target.checked)}
                  />
                  <span className={cn("size-2.5 rounded-full", option.colorClass)} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <p className="mb-2 font-medium">Depth (km)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min="0" max={draft.events.depth?.to || undefined} aria-invalid={depthInvalid} placeholder="From" value={draft.events.depth?.from ?? ""} onChange={(event) => setRange("depth", "from", event.target.value)} />
              <Input type="number" min={draft.events.depth?.from || "0"} aria-invalid={depthInvalid} placeholder="To" value={draft.events.depth?.to ?? ""} onChange={(event) => setRange("depth", "to", event.target.value)} />
            </div>
            {depthInvalid ? <p role="alert" className="mt-1 text-xs text-destructive">Depth to must be at least depth from.</p> : null}
          </div>
          <div>
            <p className="mb-2 font-medium">Date range</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" max={draft.events.date?.to || undefined} aria-label="Date from" aria-invalid={dateInvalid} value={draft.events.date?.from ?? ""} onChange={(event) => setRange("date", "from", event.target.value)} />
              <Input type="date" min={draft.events.date?.from || undefined} aria-label="Date to" aria-invalid={dateInvalid} value={draft.events.date?.to ?? ""} onChange={(event) => setRange("date", "to", event.target.value)} />
            </div>
            {dateInvalid ? <p role="alert" className="mt-1 text-xs text-destructive">Date to must be on or after date from.</p> : null}
          </div>
        </section>
        <ForecastFilterFields value={draft.forecasts} onChange={(forecasts) => setDraft({ ...draft, forecasts })} />
      </div>

      <footer className="border-t border-sidebar-border p-2">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={reset}>Reset filters</Button>
          <Button type="button" disabled={depthInvalid || dateInvalid} onClick={apply}>Apply filters</Button>
        </div>
      </footer>
    </aside>
  )
}
