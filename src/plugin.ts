import streamDeck from "@elgato/streamdeck";
import { GraphAction } from "./actions/graph";
import { entityItems } from "./ha/model";
import { ha, type HaSettings } from "./ha/service";

type JsonValue = Parameters<typeof streamDeck.ui.sendToPropertyInspector>[0];

streamDeck.logger.setLevel("info");

const graph = new GraphAction();
streamDeck.actions.registerAction(graph);

// New connection settings: every key renders again (or shows "Set up").
ha.on("settings", () => {
  graph.refreshAll();
  sendToPropertyInspector(statusMessage());
});

ha.on("state", () => {
  streamDeck.logger.info(`home assistant connection: ${ha.state}${ha.error ? ` (${ha.error})` : ""}`);
  sendToPropertyInspector(statusMessage());
  if (ha.state === "connected") {
    // An open settings page asked for the entity list before the connection
    // existed (and got nothing); its hot-reloading select picks this up.
    void sendEntities(false);
  }
});

async function sendEntities(force: boolean): Promise<void> {
  let items: JsonValue = [];
  if (ha.isConfigured) {
    try {
      items = entityItems(await ha.states(force));
    } catch (err) {
      streamDeck.logger.warn(`entities: ${(err as Error).message}`);
    }
  }
  sendToPropertyInspector({ event: "getEntities", items });
}

// Messages from the property inspector (ui/graph.html).

type UiMessage = { event: "getEntities" | "getStatus"; isRefresh?: boolean } | { event: "connect"; url: string; token?: string };

streamDeck.ui.onSendToPlugin<UiMessage>(async (ev) => {
  const message = ev.payload;
  switch (message.event) {
    case "getStatus":
      sendToPropertyInspector(statusMessage());
      break;
    case "getEntities":
      await sendEntities(Boolean(message.isRefresh));
      break;
    case "connect": {
      // An empty token keeps the stored one, so the URL can be changed alone.
      const token = message.token?.trim() || ha.settings.token;
      const settings: HaSettings = { url: message.url.trim().replace(/\/+$/, ""), token };
      await streamDeck.settings.setGlobalSettings(settings);
      ha.configure(settings);
      const result = await ha.verify();
      sendToPropertyInspector({ event: "connect", ...result });
      break;
    }
  }
});

function statusMessage(): JsonValue {
  return {
    event: "status",
    state: ha.state,
    url: ha.settings.url ?? "",
    error: ha.error ?? "",
    name: ha.name ?? "",
    configured: ha.isConfigured,
  };
}

function sendToPropertyInspector(payload: JsonValue): void {
  if (streamDeck.ui.action) {
    streamDeck.ui.sendToPropertyInspector(payload).catch(() => undefined);
  }
}

streamDeck.settings.onDidReceiveGlobalSettings<HaSettings>((ev) => ha.configure(ev.settings));

await streamDeck.connect();
ha.configure(await streamDeck.settings.getGlobalSettings<HaSettings>());
if (ha.isConfigured) {
  void ha.verify();
}
