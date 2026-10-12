# Streamdeck-HA-Graph

Stream Deck plugin `com.kirkanos.ha-graph`. Status: done, released 1.0.0.

## Goal

The current value of a Home Assistant sensor on a key, with its recent history as a graph in the background. The Home Assistant plugin by cgiesche (`de.perdoctus.streamdeck.homeassistant`) shows only the current state, and Grafana has no Home Assistant data here.

## Key

- **Sensor Graph**: title at the top, value with unit in the middle, filled graph across the lower half. Press opens `/history?entity_id=…` in the browser, long press forces a refresh.

## Data source & API

- `GET /api/states/{entity_id}` for the current state, unit and friendly name.
- `GET /api/history/period/{start}?filter_entity_id={id}&end_time={now}&minimal_response&no_attributes` for the state changes of the time range.
- `GET /api/states` for the sensor picker (numeric entities with a unit), `GET /api/config` to check the token.
- Auth: `Authorization: Bearer <long-lived access token>`.

## Rendering

- The state changes are resampled into 72 time-weighted buckets across the key width; the current state is appended at "now".
- Scale: from zero when the series is power-like (minimum below half the maximum), else min to max; a flat line sits in the middle.

## Settings

- Base URL, long-lived access token (global).
- Sensor (datasource-fed select), title, time range (1h to 24h), refresh interval, color.
