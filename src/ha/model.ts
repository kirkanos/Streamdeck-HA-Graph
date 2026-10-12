/** Pure helpers around the Home Assistant REST API: parsing, sampling and formatting. */

export type HaState = {
  entity_id: string;
  state: string;
  attributes: { friendly_name?: string; unit_of_measurement?: string; device_class?: string; [key: string]: unknown };
  last_changed?: string;
};

/** One state change of the history API with `minimal_response` (only the first entry carries entity_id). */
export type HistoryEntry = { state: string; last_changed?: string; last_updated?: string };

export type Point = { t: number; v: number };

export type TimeRange = "1h" | "3h" | "6h" | "12h" | "24h";

export const TIME_RANGES: Record<TimeRange, number> = {
  "1h": 3_600_000,
  "3h": 3 * 3_600_000,
  "6h": 6 * 3_600_000,
  "12h": 12 * 3_600_000,
  "24h": 24 * 3_600_000,
};

export const DEFAULT_TIME_RANGE: TimeRange = "6h";

export function isTimeRange(value: unknown): value is TimeRange {
  return typeof value === "string" && Object.hasOwn(TIME_RANGES, value);
}

/** "https://ha.example.com/" -> "https://ha.example.com" */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Numeric value of a state; undefined for "unavailable", "unknown" and other text. */
export function numericState(state: string | undefined): number | undefined {
  if (state === undefined || state.trim() === "") {
    return undefined;
  }
  const value = Number(state);
  return Number.isFinite(value) ? value : undefined;
}

/** Numeric points of one entity's history, oldest first. */
export function historyPoints(entries: HistoryEntry[]): Point[] {
  const points: Point[] = [];
  for (const entry of entries) {
    const v = numericState(entry.state);
    const t = Date.parse(entry.last_changed ?? entry.last_updated ?? "");
    if (v !== undefined && Number.isFinite(t)) {
      points.push({ t, v });
    }
  }
  return points.sort((a, b) => a.t - b.t);
}

/**
 * Resamples a step series (each value holds until the next change) into
 * `buckets` evenly spaced, time-weighted averages between `from` and `to`.
 * Buckets before the first known value are undefined.
 */
export function resample(points: Point[], from: number, to: number, buckets: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  if (to <= from || buckets <= 0) {
    return result;
  }
  const width = (to - from) / buckets;
  let i = 0;
  // Value in force at `from`: the last point at or before it.
  let current: number | undefined;
  while (i < points.length && points[i].t <= from) {
    current = points[i].v;
    i++;
  }
  for (let b = 0; b < buckets; b++) {
    const start = from + b * width;
    const end = start + width;
    let weighted = 0;
    let covered = 0;
    let cursor = start;
    while (i < points.length && points[i].t < end) {
      if (current !== undefined) {
        weighted += current * (points[i].t - cursor);
        covered += points[i].t - cursor;
      }
      cursor = points[i].t;
      current = points[i].v;
      i++;
    }
    if (current !== undefined) {
      weighted += current * (end - cursor);
      covered += end - cursor;
    }
    result.push(covered > 0 ? weighted / covered : undefined);
  }
  return result;
}

/** Number of decimals that keeps a value readable on a key: 1234 W, 23.6 °C, 1.14 kW. */
export function decimalsFor(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 100) {
    return 0;
  }
  if (abs >= 10) {
    return 1;
  }
  return 2;
}

export function formatValue(value: number, locale?: string): string {
  const decimals = decimalsFor(value);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(value);
}

/** Items of the entity picker: numeric sensors with a unit, by name. */
export function entityItems(states: HaState[]): { value: string; label: string }[] {
  return states
    .filter((s) => /^(sensor|number|input_number)\./.test(s.entity_id) && s.attributes.unit_of_measurement)
    .map((s) => ({
      value: s.entity_id,
      label: `${s.attributes.friendly_name || s.entity_id} (${s.attributes.unit_of_measurement})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** History page of the entity in the Home Assistant frontend. */
export function historyUrl(baseUrl: string, entityId: string): string {
  return `${normalizeBaseUrl(baseUrl)}/history?entity_id=${encodeURIComponent(entityId)}`;
}
