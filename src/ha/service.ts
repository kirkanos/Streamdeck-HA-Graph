import { EventEmitter } from "node:events";
import { type HaState, type HistoryEntry, normalizeBaseUrl } from "./model";

export type HaSettings = { url?: string; token?: string };

export type ConnectionState = "unconfigured" | "connecting" | "connected" | "error";

export type VerifyResult = { ok: true; name: string } | { ok: false; error: string };

const API_TIMEOUT_MS = 15_000;
/** The entity list for the picker is reused for this long. */
const STATES_CACHE_MS = 60_000;

/**
 * Talks to one Home Assistant instance through the REST API with a
 * long-lived access token: entity list for the settings page, current
 * state and history for the keys.
 *
 * Events:
 *   "settings"  the connection settings changed
 *   "state"     the connection state changed
 */
export class HaService extends EventEmitter<{ settings: []; state: [] }> {
  #settings: HaSettings = {};
  #state: ConnectionState = "unconfigured";
  #error: string | undefined;
  #name: string | undefined;
  #states: { at: number; list: HaState[] } | undefined;

  get settings(): HaSettings {
    return this.#settings;
  }

  get state(): ConnectionState {
    return this.#state;
  }

  get error(): string | undefined {
    return this.#error;
  }

  /** Location name of the instance (after a successful verify). */
  get name(): string | undefined {
    return this.#name;
  }

  get isConfigured(): boolean {
    return Boolean(this.#settings.url && this.#settings.token);
  }

  /** Applies new connection settings; the connection is checked with `verify()`. */
  configure(settings: HaSettings): void {
    const url = settings.url ? normalizeBaseUrl(settings.url) : undefined;
    const token = settings.token?.trim() || undefined;
    if (url === this.#settings.url && token === this.#settings.token) {
      return;
    }
    this.#settings = { url, token };
    this.#states = undefined;
    this.#name = undefined;
    this.#setState(this.isConfigured ? "connecting" : "unconfigured");
    this.emit("settings");
  }

  /** Checks URL and token against `/api/config` and updates the connection state. */
  async verify(): Promise<VerifyResult> {
    if (!this.isConfigured) {
      this.#setState("unconfigured");
      return { ok: false, error: "URL and token are not set" };
    }
    this.#setState("connecting");
    const settings = this.#settings;
    try {
      const res = await this.#fetch("/api/config");
      if (settings !== this.#settings) {
        return { ok: false, error: "Settings changed" };
      }
      if (!res.ok) {
        const error = res.status === 401 || res.status === 403 ? `HTTP ${res.status}: token rejected` : `HTTP ${res.status}`;
        this.#setState("error", error);
        return { ok: false, error };
      }
      const body = (await res.json()) as { location_name?: string };
      this.#name = body.location_name || "Home Assistant";
      this.#setState("connected");
      return { ok: true, name: this.#name };
    } catch (err) {
      const error = `Cannot reach ${settings.url}: ${errorMessage(err)}`;
      if (settings === this.#settings) {
        this.#setState("error", error);
      }
      return { ok: false, error };
    }
  }

  /** All entity states (`/api/states`), cached for a minute unless `force`. */
  async states(force = false): Promise<HaState[]> {
    if (!force && this.#states && Date.now() - this.#states.at < STATES_CACHE_MS) {
      return this.#states.list;
    }
    const settings = this.#settings;
    const res = await this.#fetch("/api/states");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const list = (await res.json()) as HaState[];
    if (settings === this.#settings) {
      this.#states = { at: Date.now(), list };
    }
    return list;
  }

  /** Current state of one entity (`/api/states/<id>`). */
  async entity(entityId: string): Promise<HaState> {
    const res = await this.#fetch(`/api/states/${encodeURIComponent(entityId)}`);
    if (!res.ok) {
      throw new HttpError(res.status);
    }
    return (await res.json()) as HaState;
  }

  /** State changes of one entity between `from` and `to`, oldest first. */
  async history(entityId: string, from: Date, to: Date): Promise<HistoryEntry[]> {
    const query = new URLSearchParams({ filter_entity_id: entityId, end_time: to.toISOString() });
    // Flags without a value: only state and time, all changes (not only significant ones).
    const path = `/api/history/period/${encodeURIComponent(from.toISOString())}?${query}&minimal_response&no_attributes`;
    const res = await this.#fetch(path);
    if (!res.ok) {
      throw new HttpError(res.status);
    }
    const body = (await res.json()) as HistoryEntry[][];
    return body[0] ?? [];
  }

  #fetch(path: string): Promise<Response> {
    const { url, token } = this.#settings;
    if (!url || !token) {
      return Promise.reject(new Error("not configured"));
    }
    return fetch(`${url}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  }

  #setState(state: ConnectionState, error?: string): void {
    if (state === this.#state && error === this.#error) {
      return;
    }
    this.#state = state;
    this.#error = error;
    this.emit("state");
  }
}

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Node wraps network errors: "fetch failed" with the real reason in cause.
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) {
      return cause.message;
    }
    return err.message;
  }
  return String(err);
}

export const ha = new HaService();
