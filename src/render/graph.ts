import { background, escapeXml, FONT, mix, svg, toDataUrl, truncate } from "./svg";
import { THEME } from "./theme";

/** Key images are drawn at 144×144 and scaled by Stream Deck. */
const S = 144;
/** The graph fills the key from this height to the bottom edge. */
const GRAPH_TOP = 74;

export type GraphKey = {
  title: string;
  /** Formatted current value, "–" when the sensor has no number. */
  value: string;
  unit?: string;
  /** Resampled history, oldest first; undefined where nothing is known. */
  samples: (number | undefined)[];
  color: string;
};

/** Smallest and largest value of the graph; power-like series start at zero. */
export function scaleOf(samples: (number | undefined)[]): { min: number; max: number } | undefined {
  const values = samples.filter((v): v is number => v !== undefined);
  if (values.length === 0) {
    return undefined;
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min >= 0 && min < max * 0.5) {
    min = 0;
  }
  if (max - min < 1e-9) {
    // A flat line sits in the middle of the graph.
    const pad = Math.abs(max) > 1e-9 ? Math.abs(max) * 0.5 : 1;
    min -= pad;
    max += pad;
  }
  return { min, max };
}

/** SVG path of the line through the samples, and of the area below it. */
export function graphPaths(samples: (number | undefined)[], top = GRAPH_TOP, bottom = S, width = S): { line: string; area: string } | undefined {
  const scale = scaleOf(samples);
  if (!scale || samples.length < 2) {
    return undefined;
  }
  const height = bottom - top - 6;
  const step = width / (samples.length - 1);
  const points: [number, number][] = [];
  samples.forEach((v, i) => {
    if (v !== undefined) {
      const y = bottom - 2 - ((v - scale.min) / (scale.max - scale.min)) * height;
      points.push([i * step, y]);
    }
  });
  if (points.length < 2) {
    return undefined;
  }
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const first = points[0][0].toFixed(1);
  const last = points[points.length - 1][0].toFixed(1);
  return { line, area: `${line} L${last} ${bottom} L${first} ${bottom} Z` };
}

/** Key with the sensor name, the current value and the history as a filled graph at the bottom. */
export function graphKey(key: GraphKey): string {
  const paths = graphPaths(key.samples);
  const graph = paths
    ? `<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${key.color}" stop-opacity="0.55"/>` +
      `<stop offset="1" stop-color="${key.color}" stop-opacity="0.04"/></linearGradient></defs>` +
      `<path d="${paths.area}" fill="url(#fill)"/>` +
      `<path d="${paths.line}" fill="none" stroke="${key.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
    : "";

  const unit = key.unit && key.value !== "–"
    ? `<tspan font-size="17" font-weight="600" fill-opacity="0.75"> ${escapeXml(key.unit)}</tspan>`
    : "";
  const valueSize = key.value.length > 5 ? 28 : 34;

  return toDataUrl(
    svg(
      S,
      S,
      background("bg", mix(THEME.surface, key.color, 0.12), THEME.base, S, S) +
        graph +
        `<text x="${S / 2}" y="24" font-family="${FONT}" font-size="16" font-weight="600" fill="${THEME.subtle}" text-anchor="middle">${escapeXml(truncate(key.title, 14))}</text>` +
        `<text x="${S / 2}" y="62" font-family="${FONT}" font-size="${valueSize}" font-weight="800" fill="#FFFFFF" text-anchor="middle">${escapeXml(key.value)}${unit}</text>`,
    ),
  );
}
