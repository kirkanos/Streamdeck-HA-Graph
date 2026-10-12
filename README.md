# HA Graph

A [Home Assistant](https://www.home-assistant.io) sensor on your Elgato Stream Deck: the key shows the current value with its history as a graph behind it.

Unofficial plugin, not affiliated with Home Assistant or Nabu Casa.

## Features

* **Sensor Graph** key: name, current value with unit, and the history of the last 1 to 24 hours as a filled graph, refreshed every 10 seconds to every 5 minutes (default: every 30 seconds).
  * Works with every numeric sensor that has a unit: power, energy, temperature, humidity, battery level and so on.
  * Press the key to open the history of the sensor in Home Assistant.
  * Hold the key to refresh right away.
  * Title, time range, refresh interval and graph color per key.
  * A gray key with a warning icon when the sensor does not exist or Home Assistant is not reachable.
* Sensor picker in the key settings, fed from the Home Assistant API.

The graph is a time-weighted average of the state changes, so a sensor that reports rarely draws steps and a sensor that reports every few seconds draws a smooth line. Power-like series start at zero; series that stay in a narrow band (temperatures) are scaled to that band.

## Installation

Download the [latest release](https://github.com/kirkanos/Streamdeck-HA-Graph/releases/latest) and open `com.kirkanos.ha-graph.streamDeckPlugin`. Requires Stream Deck 7.1 or newer.

## Settings

The connection is shared by all keys and set up once in the settings of any key:

1. In Home Assistant, open your profile, go to *Security* and create a *Long-lived access token*.
2. In the key settings, enter the Home Assistant URL (for example `https://homeassistant.local:8123`) and the token, then click *Save and test connection*. The plugin checks the token against `/api/config` and shows the name of your home.
3. Pick a sensor. Title, time range, refresh interval and color are optional.

The token is stored in the Stream Deck settings on this computer and only sent to the Home Assistant URL you entered.

The key draws its own title, so it shows no Stream Deck title by default. If you type one, untick *Show title* in the key's title settings or leave the title empty, otherwise it covers the value.

## Development

HA Graph is a Node.js plugin built with the official [Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/) (`@elgato/streamdeck`, TypeScript, rollup). The settings page uses [sdpi-components](https://sdpi-components.dev).

| Path | Content |
| --- | --- |
| `src/actions/` | The Sensor Graph action and its settings |
| `src/ha/` | Home Assistant REST API: states, history, connection service; resampling and formatting |
| `src/render/` | SVG key images (graph, "select a sensor", errors) |
| `src/scheduler.ts` | Refresh jobs with bounded concurrency and staggered starts |
| `plugin/` | Static plugin files: manifest, icons, settings page (`ui/`) |
| `assets/` | Plugin icon source (rendered to PNG by the build) |
| `scripts/` | Build |

```sh
npm install
npm test               # unit tests
npm run typecheck

# Development: a parallel-installable copy "HA Graph (dev)"
npm run link:dev       # build + link into Stream Deck (once)
npm run watch:dev      # rebuild and restart the plugin on every change

npm run validate       # build + validate the plugin folder
npm run pack           # Release/com.kirkanos.ha-graph.streamDeckPlugin
```

Linking and restarting need the Stream Deck developer mode (`npx streamdeck dev`, then restart the Stream Deck app once). Plugin logs are written to `dist/<plugin id>.sdPlugin/logs/`.

GitHub Actions builds and tests every push (`.github/workflows/ci.yml`) and publishes a release with the packed plugin for tags like `v1.0.0` (`.github/workflows/release.yml`).

## Troubleshooting

* **Keys show "Set up":** open the settings of a key and enter the Home Assistant URL and a long-lived access token.
* **Keys show "HTTP 401" or "HTTP 403":** the token was rejected; create a new one and enter it again.
* **Keys show "Not found":** the sensor no longer exists in Home Assistant; pick another one.
* **Keys show "Offline":** Home Assistant is not reachable from this computer.
* **The graph is empty or short:** Home Assistant keeps the history for 10 days by default; sensors excluded from the recorder have no history.
* Anything else: [open an issue](https://github.com/kirkanos/Streamdeck-HA-Graph/issues).
