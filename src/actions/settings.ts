import { DEFAULT_TIME_RANGE, isTimeRange, type TimeRange } from "../ha/model";

/** Settings of a Sensor Graph key, as stored by the property inspector. */
export type GraphSettings = {
  entityId?: string;
  /** Shown above the value; the friendly name of the entity when empty. */
  title?: string;
  timeRange?: string;
  /** Seconds between two updates; select values arrive as strings. */
  refreshSeconds?: string | number;
  color?: string;
};

export const DEFAULT_REFRESH_SECONDS = 30;
export const MIN_REFRESH_SECONDS = 10;
export const DEFAULT_COLOR = "#F59E0B";
/** Points of the graph across the key width. */
export const SAMPLES = 72;

export function refreshIntervalMs(settings: GraphSettings): number {
  const seconds = Number(settings.refreshSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_REFRESH_SECONDS * 1000;
  }
  return Math.max(MIN_REFRESH_SECONDS, seconds) * 1000;
}

export function timeRangeOf(settings: GraphSettings): TimeRange {
  return isTimeRange(settings.timeRange) ? settings.timeRange : DEFAULT_TIME_RANGE;
}

export function colorOf(settings: GraphSettings): string {
  return typeof settings.color === "string" && /^#[0-9a-f]{6}$/i.test(settings.color) ? settings.color : DEFAULT_COLOR;
}

export function entityIdOf(settings: GraphSettings): string | undefined {
  const id = settings.entityId?.trim();
  return id ? id : undefined;
}

/** Title of the key: the configured one, else the friendly name, else the object id. */
export function titleOf(settings: GraphSettings, friendlyName: string | undefined, entityId: string): string {
  const custom = settings.title?.trim();
  if (custom) {
    return custom;
  }
  return friendlyName?.trim() || entityId.replace(/^[^.]+\./, "");
}
