import { describe, expect, it } from "vitest";
import { graphKey, graphPaths, scaleOf } from "./graph";

const decode = (dataUrl: string) => Buffer.from(dataUrl.replace(/^data:image\/svg\+xml;base64,/, ""), "base64").toString("utf8");

describe("scaleOf", () => {
  it("starts power-like series at zero", () => {
    expect(scaleOf([100, 150, undefined, 300])).toEqual({ min: 0, max: 300 });
  });

  it("keeps the minimum when values stay close together", () => {
    expect(scaleOf([21, 22, 23])).toEqual({ min: 21, max: 23 });
  });

  it("widens a flat line", () => {
    expect(scaleOf([50, 50])).toEqual({ min: 25, max: 75 });
    expect(scaleOf([undefined])).toBeUndefined();
  });
});

describe("graphPaths", () => {
  it("spans the width and closes the area at the bottom", () => {
    const paths = graphPaths([0, 10], 74, 144, 144)!;
    expect(paths.line).toBe("M0.0 142.0 L144.0 78.0");
    expect(paths.area).toBe("M0.0 142.0 L144.0 78.0 L144.0 144 L0.0 144 Z");
  });

  it("needs two known values", () => {
    expect(graphPaths([undefined, 5])).toBeUndefined();
  });
});

describe("graphKey", () => {
  it("draws title, value with unit and graph", () => {
    const svg = decode(graphKey({ title: "Schreibtisch", value: "168", unit: "W", samples: [100, 200, 168], color: "#F59E0B" }));
    expect(svg).toContain(">Schreibtisch</text>");
    expect(svg).toContain("168<tspan");
    expect(svg).toContain("> W</tspan>");
    expect(svg).toContain('stroke="#F59E0B"');
  });

  it("escapes text and omits the unit without a value", () => {
    const svg = decode(graphKey({ title: "A & B", value: "–", unit: "W", samples: [], color: "#F59E0B" }));
    expect(svg).toContain("A &amp; B");
    expect(svg).not.toContain("<tspan");
    expect(svg).not.toContain("<path");
  });
});
