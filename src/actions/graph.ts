import streamDeck, {
  action,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  type KeyUpEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { PLUGIN_ID } from "../config";
import { formatValue, historyPoints, historyUrl, numericState, resample, TIME_RANGES } from "../ha/model";
import { errorMessage, ha, HttpError } from "../ha/service";
import { graphKey } from "../render/graph";
import { errorKey, messageKey } from "../render/keys";
import { RefreshScheduler } from "../scheduler";
import { showImage, updates } from "../throttle";
import { colorOf, entityIdOf, type GraphSettings, refreshIntervalMs, SAMPLES, timeRangeOf, titleOf } from "./settings";

/** Holding the key this long forces a refresh instead of opening the history. */
export const LONG_PRESS_MS = 600;

/** A key showing the current value of a sensor with its history as a graph; press opens the history in HA. */
@action({ UUID: `${PLUGIN_ID}.graph` })
export class GraphAction extends SingletonAction<GraphSettings> {
  readonly #settings = new Map<string, GraphSettings>();
  readonly #pressTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #longPressed = new Set<string>();
  readonly #scheduler = new RefreshScheduler((id) => this.#render(id), { maxConcurrent: 2, staggerMs: 300 });

  override onWillAppear(ev: WillAppearEvent<GraphSettings>): void {
    this.#apply(ev.action.id, ev.payload.settings);
  }

  override onWillDisappear(ev: WillDisappearEvent<GraphSettings>): void {
    const id = ev.action.id;
    this.#scheduler.stop(id);
    updates.forget(id);
    this.#settings.delete(id);
    this.#clearPress(id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<GraphSettings>): void {
    this.#apply(ev.action.id, ev.payload.settings);
  }

  override onKeyDown(ev: KeyDownEvent<GraphSettings>): void {
    const id = ev.action.id;
    this.#clearPress(id);
    this.#pressTimers.set(
      id,
      setTimeout(() => {
        this.#pressTimers.delete(id);
        this.#longPressed.add(id);
        this.#scheduler.refresh(id);
      }, LONG_PRESS_MS),
    );
  }

  override async onKeyUp(ev: KeyUpEvent<GraphSettings>): Promise<void> {
    const id = ev.action.id;
    const timer = this.#pressTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.#pressTimers.delete(id);
    }
    if (this.#longPressed.delete(id)) {
      return;
    }
    const entityId = entityIdOf(this.#settings.get(id) ?? ev.payload.settings);
    if (!ha.settings.url || !entityId) {
      await ev.action.showAlert();
      return;
    }
    await streamDeck.system.openUrl(historyUrl(ha.settings.url, entityId));
  }

  /** Re-renders all visible keys, e.g. after the connection settings changed. */
  refreshAll(): void {
    for (const id of this.#settings.keys()) {
      this.#scheduler.refresh(id);
    }
  }

  #apply(id: string, settings: GraphSettings): void {
    this.#settings.set(id, settings);
    this.#scheduler.start(id, refreshIntervalMs(settings));
  }

  #clearPress(id: string): void {
    const timer = this.#pressTimers.get(id);
    if (timer) {
      clearTimeout(timer);
    }
    this.#pressTimers.delete(id);
    this.#longPressed.delete(id);
  }

  async #render(actionId: string): Promise<void> {
    const key = this.actions.find((a) => a.id === actionId);
    const settings = this.#settings.get(actionId);
    if (!key?.isKey() || !settings) {
      return;
    }
    if (!ha.isConfigured) {
      showImage(key, messageKey("Set up", "HA in settings"));
      return;
    }
    const entityId = entityIdOf(settings);
    if (!entityId) {
      showImage(key, messageKey("Select", "a sensor"));
      return;
    }

    const to = new Date();
    const from = new Date(to.getTime() - TIME_RANGES[timeRangeOf(settings)]);
    let image: string;
    try {
      const [state, history] = await Promise.all([ha.entity(entityId), ha.history(entityId, from, to)]);
      const current = numericState(state.state);
      const points = historyPoints(history);
      if (current !== undefined) {
        points.push({ t: to.getTime(), v: current });
      }
      image = graphKey({
        title: titleOf(settings, state.attributes.friendly_name, entityId),
        value: current === undefined ? "–" : formatValue(current),
        unit: state.attributes.unit_of_measurement,
        samples: resample(points, from.getTime(), to.getTime(), SAMPLES),
        color: colorOf(settings),
      });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : undefined;
      if (status === 404) {
        image = errorKey("Not found", truncateId(entityId));
      } else if (status === 401 || status === 403) {
        image = errorKey(`HTTP ${status}`, "check token");
      } else {
        streamDeck.logger.warn(`${entityId}: ${errorMessage(err)}`);
        image = errorKey("Offline", status ? `HTTP ${status}` : "HA not reachable");
      }
    }
    // Settings changed while loading: a render with the new ones is already queued.
    if (this.#settings.get(actionId) === settings) {
      showImage(key, image);
    }
  }
}

function truncateId(entityId: string): string {
  return entityId.length > 18 ? `${entityId.slice(0, 17)}…` : entityId;
}
