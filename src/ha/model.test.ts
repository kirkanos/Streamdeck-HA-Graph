import { describe, expect, it } from "vitest";
import { entityItems, formatValue, historyPoints, historyUrl, numericState, resample } from "./model";

describe("numericState", () => {
  it("parses numbers and rejects text states", () => {
    expect(numericState("167.65")).toBe(167.65);
    expect(numericState("-3")).toBe(-3);
    expect(numericState("unavailable")).toBeUndefined();
    expect(numericState("unknown")).toBeUndefined();
    expect(numericState("")).toBeUndefined();
    expect(numericState(undefined)).toBeUndefined();
  });
});

describe("historyPoints", () => {
  it("keeps numeric states with a time, sorted", () => {
    const points = historyPoints([
      { state: "20", last_changed: "2026-10-12T10:10:00Z" },
      { state: "unavailable", last_changed: "2026-10-12T10:05:00Z" },
      { state: "10", last_changed: "2026-10-12T10:00:00Z" },
      { state: "30" },
    ]);
    expect(points).toEqual([
      { t: Date.parse("2026-10-12T10:00:00Z"), v: 10 },
      { t: Date.parse("2026-10-12T10:10:00Z"), v: 20 },
    ]);
  });
});

describe("resample", () => {
  it("averages a step series per bucket, weighted by time", () => {
    // 10 until t=50, then 30: buckets [0,50) and [50,100)
    const samples = resample(
      [
        { t: 0, v: 10 },
        { t: 50, v: 30 },
      ],
      0,
      100,
      2,
    );
    expect(samples).toEqual([10, 30]);
  });

  it("weights a change in the middle of a bucket", () => {
    const samples = resample(
      [
        { t: 0, v: 0 },
        { t: 25, v: 100 },
      ],
      0,
      100,
      2,
    );
    expect(samples[0]).toBeCloseTo(50);
    expect(samples[1]).toBe(100);
  });

  it("carries the value from before the range and leaves unknown buckets empty", () => {
    expect(resample([{ t: -10, v: 5 }], 0, 30, 3)).toEqual([5, 5, 5]);
    expect(resample([{ t: 10, v: 5 }], 0, 30, 3)).toEqual([undefined, 5, 5]);
    expect(resample([{ t: 25, v: 5 }], 0, 30, 3)).toEqual([undefined, undefined, 5]);
    expect(resample([], 0, 30, 3)).toEqual([undefined, undefined, undefined]);
  });
});

describe("formatValue", () => {
  it("uses fewer decimals for larger values", () => {
    expect(formatValue(167.65, "en")).toBe("168");
    expect(formatValue(23.64, "en")).toBe("23.6");
    expect(formatValue(1.139, "en")).toBe("1.14");
    expect(formatValue(1.139, "de")).toBe("1,14");
  });
});

describe("entityItems", () => {
  it("lists numeric entities with a unit, sorted by name", () => {
    const items = entityItems([
      { entity_id: "sensor.b", state: "1", attributes: { friendly_name: "Desk", unit_of_measurement: "W" } },
      { entity_id: "sensor.a", state: "1", attributes: { friendly_name: "Attic", unit_of_measurement: "°C" } },
      { entity_id: "sensor.c", state: "on", attributes: { friendly_name: "No unit" } },
      { entity_id: "light.d", state: "on", attributes: { friendly_name: "Lamp", unit_of_measurement: "%" } },
    ]);
    expect(items).toEqual([
      { value: "sensor.a", label: "Attic (°C)" },
      { value: "sensor.b", label: "Desk (W)" },
    ]);
  });
});

describe("historyUrl", () => {
  it("links the history page of the entity", () => {
    expect(historyUrl("https://ha.example.com/", "sensor.desk_power")).toBe("https://ha.example.com/history?entity_id=sensor.desk_power");
  });
});
