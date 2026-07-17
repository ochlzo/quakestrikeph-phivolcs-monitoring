import { Input } from "@/components/ui/input"
import type { ForecastFilters } from "@/lib/earthquake-map-filters"

const LIKELIHOODS = ["low", "medium", "high"] as const

type Props = {
  value: ForecastFilters
  onChange: (value: ForecastFilters) => void
}

function toggle(values: string[], value: string, checked: boolean) {
  if (!checked && values.length === 1 && values[0] === value) return values
  return checked ? [...values, value] : values.filter((item) => item !== value)
}

export function ForecastFilterFields({ value, onChange }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">Forecast filters</legend>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 font-medium">24h aftershock likelihood</p>
          {LIKELIHOODS.map((likelihood) => (
            <label key={likelihood} className="flex items-center gap-2 py-0.5 capitalize">
              <input
                type="checkbox"
                checked={value.aftershock24hLikelihoods.includes(likelihood)}
                onChange={(event) => onChange({
                  ...value,
                  aftershock24hLikelihoods: toggle(value.aftershock24hLikelihoods, likelihood, event.target.checked),
                })}
              />
              {likelihood}
            </label>
          ))}
        </div>
        <div>
          <p className="mb-1.5 font-medium">M5+ likelihood</p>
          {LIKELIHOODS.map((likelihood) => (
            <label key={likelihood} className="flex items-center gap-2 py-0.5 capitalize">
              <input
                type="checkbox"
                checked={value.m5PlusLikelihoods.includes(likelihood)}
                onChange={(event) => onChange({
                  ...value,
                  m5PlusLikelihoods: toggle(value.m5PlusLikelihoods, likelihood, event.target.checked),
                })}
              />
              {likelihood}
            </label>
          ))}
        </div>
      </div>
      <Input
        type="number"
        min="0"
        max="10"
        step="0.1"
        aria-label="Minimum estimated strongest aftershock"
        placeholder="Minimum estimated strongest"
        value={value.minimumEstimatedStrongestAftershock ?? ""}
        onChange={(event) => onChange({
          ...value,
          minimumEstimatedStrongestAftershock: event.target.value ? Number(event.target.value) : null,
        })}
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.includeNoForecast}
          onChange={(event) => onChange({ ...value, includeNoForecast: event.target.checked })}
        />
        Include events without forecasts
      </label>
    </fieldset>
  )
}
