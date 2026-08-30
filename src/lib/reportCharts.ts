import { formatDuration } from "./time";
import { formatMl, formatTemp, formatWeight, gramsToDisplay } from "./units";
import { formatHours, formatPct, type LifetimeDay, type ReportModel, type TempSample, type WeightSample } from "./report";
import type { Settings } from "./types";

export type ChartTheme = {
  ink: string;
  muted: string;
  faint: string;
  line: string;
  band: string;
  bandAlt: string;
  sleep: string;
  feed: string;
  diaper: string;
  pump: string;
  temp: string;
  weight: string;
  vitamin: string;
  awake: string;
  surface: string;
};

export const darkChartTheme: ChartTheme = {
  ink: "#f6efe6",
  muted: "#cbb9a6",
  faint: "#8d7d6d",
  line: "rgba(246, 239, 230, 0.14)",
  band: "rgba(246, 239, 230, 0.04)",
  bandAlt: "rgba(224, 122, 95, 0.08)",
  sleep: "#8fbfa8",
  feed: "#e07a5f",
  diaper: "#e8c27a",
  pump: "#7eb8c9",
  temp: "#e58b7a",
  weight: "#c4a5e0",
  vitamin: "#d4a574",
  awake: "#5a4a40",
  surface: "#1c1712",
};

export const lightChartTheme: ChartTheme = {
  ink: "#1c1712",
  muted: "#5c4e42",
  faint: "#8a7868",
  line: "rgba(28, 23, 18, 0.12)",
  band: "rgba(28, 23, 18, 0.04)",
  bandAlt: "rgba(224, 122, 95, 0.1)",
  sleep: "#4e8f73",
  feed: "#c45c40",
  diaper: "#c49a3a",
  pump: "#4a8ea3",
  temp: "#c45c4a",
  weight: "#8d6bb3",
  vitamin: "#b07a3a",
  awake: "#d9cbb8",
  surface: "#fbf7f1",
};

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

type LaneKey = "sleep" | "feed" | "diaper" | "pump" | "temp";

const LANES: { key: LaneKey; label: string }[] = [
  { key: "sleep", label: "Sleep" },
  { key: "feed", label: "Feed" },
  { key: "diaper", label: "Diaper" },
  { key: "pump", label: "Pump" },
  { key: "temp", label: "Temp" },
];

function laneColor(key: LaneKey, theme: ChartTheme) {
  switch (key) {
    case "sleep":
      return theme.sleep;
    case "feed":
      return theme.feed;
    case "diaper":
      return theme.diaper;
    case "pump":
      return theme.pump;
    case "temp":
      return theme.temp;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

function hourTickLabel(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    hour: "numeric",
  }).format(new Date(ms));
}

export function ganttSvg(model: ReportModel, theme: ChartTheme) {
  const labelW = 56;
  const pxPerHour = 14;
  const laneH = 28;
  const axisH = 20;
  const padTop = 6;
  const padBottom = 8;
  const chartW = model.hours * pxPerHour;
  const width = labelW + chartW + 8;
  const height = padTop + axisH + LANES.length * laneH + padBottom;
  const winStart = model.start.getTime();
  const winEnd = model.end.getTime();
  const span = Math.max(1, winEnd - winStart);
  const xAt = (ms: number) => labelW + ((ms - winStart) / span) * chartW;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="72-hour care timeline">`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="${theme.surface}" />`);

  model.days.forEach((day, i) => {
    const x = xAt(day.sliceStart.getTime());
    const w = Math.max(0, xAt(day.sliceEnd.getTime()) - x);
    parts.push(
      `<rect x="${round(x)}" y="${padTop + axisH}" width="${round(w)}" height="${LANES.length * laneH}" fill="${i % 2 === 0 ? theme.band : theme.bandAlt}" />`,
    );
  });

  const tickMs = 6 * 60 * 60 * 1000;
  const firstTick = Math.ceil(winStart / tickMs) * tickMs;
  for (let t = firstTick; t < winEnd; t += tickMs) {
    const x = xAt(t);
    parts.push(
      `<line x1="${round(x)}" y1="${padTop + axisH}" x2="${round(x)}" y2="${height - padBottom}" stroke="${theme.line}" stroke-width="1" />`,
    );
    parts.push(
      `<text x="${round(x + 3)}" y="${padTop + 12}" fill="${theme.faint}" font-size="9" font-family="system-ui, sans-serif">${escapeXml(hourTickLabel(t, model.timezone))}</text>`,
    );
  }

  LANES.forEach((lane, i) => {
    const y = padTop + axisH + i * laneH;
    parts.push(
      `<text x="4" y="${round(y + 18)}" fill="${theme.muted}" font-size="11" font-family="system-ui, sans-serif">${lane.label}</text>`,
    );
    parts.push(
      `<line x1="${labelW}" y1="${round(y + laneH)}" x2="${labelW + chartW}" y2="${round(y + laneH)}" stroke="${theme.line}" />`,
    );
    const color = laneColor(lane.key, theme);
    if (lane.key === "sleep") {
      for (const spanBar of model.sleepSpans) {
        const x = xAt(spanBar.startMs);
        const w = Math.max(2, xAt(spanBar.endMs) - x);
        parts.push(
          `<rect x="${round(x)}" y="${round(y + 6)}" width="${round(w)}" height="16" rx="4" fill="${color}" opacity="${spanBar.inProgress ? 0.7 : 1}">` +
            `<title>${escapeXml(spanBar.label)}</title></rect>`,
        );
      }
    } else if (lane.key === "feed") {
      for (const spanBar of model.feedSpans) {
        const x = xAt(spanBar.startMs);
        const w = Math.max(3, xAt(spanBar.endMs) - x);
        parts.push(
          `<rect x="${round(x)}" y="${round(y + 7)}" width="${round(w)}" height="14" rx="3" fill="${color}">` +
            `<title>${escapeXml(spanBar.label)}</title></rect>`,
        );
      }
    } else {
      const points =
        lane.key === "diaper" ? model.diapers : lane.key === "pump" ? model.pumps : model.temps;
      for (const point of points) {
        const x = xAt(point.atMs);
        parts.push(
          `<circle cx="${round(x)}" cy="${round(y + 14)}" r="4.5" fill="${color}">` +
            `<title>${escapeXml(point.label)}</title></circle>`,
        );
      }
    }
  });

  parts.push("</svg>");
  return parts.join("");
}

export function sleepSplitSvg(model: ReportModel, theme: ChartTheme) {
  const width = 320;
  const height = 72;
  const asleep = Math.max(0, Math.min(1, model.sleepPct / 100));
  const asleepW = asleep * (width - 16);
  const awakeW = width - 16 - asleepW;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Sleep versus awake">`,
    `<rect width="${width}" height="${height}" fill="${theme.surface}" />`,
    `<rect x="8" y="28" width="${round(asleepW)}" height="18" rx="6" fill="${theme.sleep}" />`,
    `<rect x="${round(8 + asleepW)}" y="28" width="${round(Math.max(0, awakeW))}" height="18" rx="6" fill="${theme.awake}" />`,
    `<text x="8" y="18" fill="${theme.ink}" font-size="13" font-family="system-ui, sans-serif">${escapeXml(formatPct(model.sleepPct))} asleep · ${escapeXml(formatDuration(model.sleepSeconds))}</text>`,
    `<text x="8" y="64" fill="${theme.muted}" font-size="11" font-family="system-ui, sans-serif">${escapeXml(formatPct(100 - model.sleepPct))} awake · ${escapeXml(formatDuration(model.awakeSeconds))}</text>`,
    `</svg>`,
  ].join("");
}

export function tempLineSvg(model: ReportModel, theme: ChartTheme, settings: Settings) {
  const width = 320;
  const height = 140;
  const pad = { l: 36, r: 12, t: 24, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const samples = model.tempSamples;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Temperature trend">`,
    `<rect width="${width}" height="${height}" fill="${theme.surface}" />`,
    `<text x="8" y="16" fill="${theme.muted}" font-size="11" font-family="system-ui, sans-serif">Temperature</text>`,
  ];
  if (samples.length === 0) {
    parts.push(
      `<text x="8" y="72" fill="${theme.faint}" font-size="12" font-family="system-ui, sans-serif">No temperatures in this window</text>`,
    );
    parts.push("</svg>");
    return parts.join("");
  }
  const winStart = model.start.getTime();
  const winEnd = model.end.getTime();
  const minC = (model.tempMinC ?? 36) - 0.3;
  const maxC = (model.tempMaxC ?? 38) + 0.3;
  const range = Math.max(0.6, maxC - minC);
  const xAt = (ms: number) => pad.l + ((ms - winStart) / Math.max(1, winEnd - winStart)) * innerW;
  const yAt = (c: number) => pad.t + ((maxC - c) / range) * innerH;
  const yMin = yAt(minC);
  const yMax = yAt(maxC);
  parts.push(`<line x1="${pad.l}" y1="${round(yMin)}" x2="${pad.l + innerW}" y2="${round(yMin)}" stroke="${theme.line}" />`);
  parts.push(`<line x1="${pad.l}" y1="${round(yMax)}" x2="${pad.l + innerW}" y2="${round(yMax)}" stroke="${theme.line}" />`);
  parts.push(
    `<text x="4" y="${round(yMax + 4)}" fill="${theme.faint}" font-size="10" font-family="system-ui, sans-serif">${escapeXml(formatTemp(maxC, settings.tempUnit))}</text>`,
  );
  parts.push(
    `<text x="4" y="${round(yMin + 4)}" fill="${theme.faint}" font-size="10" font-family="system-ui, sans-serif">${escapeXml(formatTemp(minC, settings.tempUnit))}</text>`,
  );
  if (samples.length > 1) {
    const d = samples.map((s, i) => `${i === 0 ? "M" : "L"} ${round(xAt(s.atMs))} ${round(yAt(s.celsius))}`).join(" ");
    parts.push(`<path d="${d}" fill="none" stroke="${theme.temp}" stroke-width="2" stroke-linejoin="round" />`);
  }
  for (const sample of samples) {
    parts.push(
      `<circle cx="${round(xAt(sample.atMs))}" cy="${round(yAt(sample.celsius))}" r="4" fill="${theme.temp}">` +
        `<title>${escapeXml(formatTemp(sample.celsius, settings.tempUnit))}</title></circle>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

function yTicks(max: number, count = 4) {
  if (max <= 0) return [0];
  const step = max / count;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) ticks.push(step * i);
  return ticks;
}

function dayPlotWidth(dayCount: number) {
  const px = dayCount > 120 ? 8 : dayCount > 40 ? 12 : 16;
  return Math.max(280, dayCount * px);
}

export function lifetimeTrendSvg(
  days: LifetimeDay[],
  theme: ChartTheme,
  series: {
    title: string;
    color: string;
    values: number[];
    format: (n: number) => string;
    empty: string;
  },
) {
  const widthPad = { l: 36, r: 12, t: 26, b: 28 };
  const plotW = dayPlotWidth(days.length);
  const width = widthPad.l + plotW + widthPad.r;
  const height = 168;
  const innerH = height - widthPad.t - widthPad.b;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(series.title)}">`,
    `<rect width="${width}" height="${height}" fill="${theme.surface}" />`,
    `<text x="8" y="16" fill="${theme.muted}" font-size="11" font-family="system-ui, sans-serif">${escapeXml(series.title)}</text>`,
  ];
  if (days.length === 0) {
    parts.push(
      `<text x="8" y="88" fill="${theme.faint}" font-size="12" font-family="system-ui, sans-serif">${escapeXml(series.empty)}</text>`,
    );
    parts.push("</svg>");
    return parts.join("");
  }
  const max = Math.max(1, ...series.values);
  const yAt = (v: number) => widthPad.t + innerH - (v / max) * innerH;
  const xAt = (i: number) => {
    if (days.length === 1) return widthPad.l + plotW / 2;
    return widthPad.l + (i / (days.length - 1)) * plotW;
  };
  for (const tick of yTicks(max)) {
    const y = yAt(tick);
    parts.push(`<line x1="${widthPad.l}" y1="${round(y)}" x2="${widthPad.l + plotW}" y2="${round(y)}" stroke="${theme.line}" />`);
    parts.push(
      `<text x="${widthPad.l - 4}" y="${round(y + 3)}" fill="${theme.faint}" font-size="9" font-family="system-ui, sans-serif" text-anchor="end">${escapeXml(series.format(tick))}</text>`,
    );
  }
  const coords = series.values.map((value, i) => `${round(xAt(i))} ${round(yAt(value))}`);
  const baseY = round(yAt(0));
  if (coords.length === 1) {
    parts.push(
      `<circle cx="${coords[0].split(" ")[0]}" cy="${coords[0].split(" ")[1]}" r="4" fill="${series.color}">` +
        `<title>${escapeXml(`${days[0].label}: ${series.format(series.values[0])}`)}</title></circle>`,
    );
  } else {
    const firstX = round(xAt(0));
    const lastX = round(xAt(days.length - 1));
    parts.push(
      `<path d="M ${firstX} ${baseY} L ${coords.join(" L ")} L ${lastX} ${baseY} Z" fill="${series.color}" opacity="0.22" />`,
    );
    parts.push(
      `<path d="M ${coords.join(" L ")}" fill="none" stroke="${series.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`,
    );
    const showDots = days.length <= 45;
    series.values.forEach((value, i) => {
      if (!showDots && i !== days.length - 1) return;
      parts.push(
        `<circle cx="${round(xAt(i))}" cy="${round(yAt(value))}" r="${i === days.length - 1 ? 4 : 3}" fill="${series.color}">` +
          `<title>${escapeXml(`${days[i].label}: ${series.format(value)}`)}</title></circle>`,
      );
    });
  }
  const labelStep = Math.max(1, Math.ceil(days.length / 6));
  days.forEach((day, i) => {
    if (i % labelStep !== 0 && i !== days.length - 1) return;
    parts.push(
      `<text x="${round(xAt(i))}" y="${height - 8}" fill="${theme.faint}" font-size="9" font-family="system-ui, sans-serif" text-anchor="middle">${escapeXml(day.shortLabel)}${day.partial ? "*" : ""}</text>`,
    );
  });
  parts.push("</svg>");
  return parts.join("");
}

export function sleepTrendSvg(days: LifetimeDay[], theme: ChartTheme) {
  return lifetimeTrendSvg(days, theme, {
    title: "Sleep hours per care day",
    color: theme.sleep,
    values: days.map((day) => day.sleepHours),
    format: formatHours,
    empty: "No days logged yet",
  });
}

export function milkTrendSvg(days: LifetimeDay[], theme: ChartTheme, settings: Settings) {
  return lifetimeTrendSvg(days, theme, {
    title: "Bottle milk per care day",
    color: theme.feed,
    values: days.map((day) => day.milkMl),
    format: (n) => formatMl(n, settings.volumeUnit),
    empty: "No days logged yet",
  });
}

export function diaperTrendSvg(days: LifetimeDay[], theme: ChartTheme) {
  return lifetimeTrendSvg(days, theme, {
    title: "Diapers per care day",
    color: theme.diaper,
    values: days.map((day) => day.diapers),
    format: (n) => String(Math.round(n)),
    empty: "No days logged yet",
  });
}

export function tempHistorySvg(samples: TempSample[], theme: ChartTheme, settings: Settings) {
  return readingsLineSvg({
    title: "Temperature",
    empty: "No temperatures logged",
    theme,
    color: theme.temp,
    samples: samples.map((sample) => ({
      atMs: sample.atMs,
      y: sample.celsius,
      label: formatTemp(sample.celsius, settings.tempUnit),
    })),
    formatY: (y) => formatTemp(y, settings.tempUnit),
    padY: 0.3,
  });
}

export function weightHistorySvg(samples: WeightSample[], theme: ChartTheme, settings: Settings) {
  return readingsLineSvg({
    title: "Weight",
    empty: "No weights logged",
    theme,
    color: theme.weight,
    samples: samples.map((sample) => ({
      atMs: sample.atMs,
      y: gramsToDisplay(sample.grams, settings.weightUnit),
      label: formatWeight(sample.grams, settings.weightUnit),
    })),
    formatY: (y) =>
      `${y.toFixed(settings.weightUnit === "lb" ? 2 : y >= 10 ? 1 : 2)} ${settings.weightUnit === "lb" ? "lb" : "kg"}`,
    padY: settings.weightUnit === "lb" ? 0.2 : 0.05,
  });
}

function readingsLineSvg(opts: {
  title: string;
  empty: string;
  theme: ChartTheme;
  color: string;
  samples: { atMs: number; y: number; label: string }[];
  formatY: (y: number) => string;
  padY: number;
}) {
  const { theme } = opts;
  const width = 320;
  const height = 168;
  const pad = { l: 44, r: 12, t: 26, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeXml(opts.title)}">`,
    `<rect width="${width}" height="${height}" fill="${theme.surface}" />`,
    `<text x="8" y="16" fill="${theme.muted}" font-size="11" font-family="system-ui, sans-serif">${escapeXml(opts.title)}</text>`,
  ];
  if (opts.samples.length === 0) {
    parts.push(
      `<text x="8" y="88" fill="${theme.faint}" font-size="12" font-family="system-ui, sans-serif">${escapeXml(opts.empty)}</text>`,
    );
    parts.push("</svg>");
    return parts.join("");
  }
  const ys = opts.samples.map((s) => s.y);
  const minY = Math.min(...ys) - opts.padY;
  const maxY = Math.max(...ys) + opts.padY;
  const range = Math.max(opts.padY * 2, maxY - minY);
  const minX = opts.samples[0].atMs;
  const maxX = opts.samples[opts.samples.length - 1].atMs;
  const xSpan = Math.max(1, maxX - minX);
  const xAt = (ms: number) => pad.l + ((ms - minX) / xSpan) * innerW;
  const yAt = (y: number) => pad.t + ((maxY - y) / range) * innerH;
  parts.push(
    `<line x1="${pad.l}" y1="${round(yAt(minY))}" x2="${pad.l + innerW}" y2="${round(yAt(minY))}" stroke="${theme.line}" />`,
  );
  parts.push(
    `<line x1="${pad.l}" y1="${round(yAt(maxY))}" x2="${pad.l + innerW}" y2="${round(yAt(maxY))}" stroke="${theme.line}" />`,
  );
  parts.push(
    `<text x="4" y="${round(yAt(maxY) + 4)}" fill="${theme.faint}" font-size="10" font-family="system-ui, sans-serif">${escapeXml(opts.formatY(maxY))}</text>`,
  );
  parts.push(
    `<text x="4" y="${round(yAt(minY) + 4)}" fill="${theme.faint}" font-size="10" font-family="system-ui, sans-serif">${escapeXml(opts.formatY(minY))}</text>`,
  );
  if (opts.samples.length > 1) {
    const d = opts.samples.map((s, i) => `${i === 0 ? "M" : "L"} ${round(xAt(s.atMs))} ${round(yAt(s.y))}`).join(" ");
    parts.push(`<path d="${d}" fill="none" stroke="${opts.color}" stroke-width="2" stroke-linejoin="round" />`);
  }
  for (const sample of opts.samples) {
    parts.push(
      `<circle cx="${round(xAt(sample.atMs))}" cy="${round(yAt(sample.y))}" r="4" fill="${opts.color}">` +
        `<title>${escapeXml(sample.label)}</title></circle>`,
    );
  }
  const first = opts.samples[0];
  const last = opts.samples[opts.samples.length - 1];
  const short = (ms: number) => new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(new Date(ms));
  parts.push(
    `<text x="${pad.l}" y="${height - 8}" fill="${theme.faint}" font-size="9" font-family="system-ui, sans-serif">${escapeXml(short(first.atMs))}</text>`,
  );
  if (last.atMs !== first.atMs) {
    parts.push(
      `<text x="${pad.l + innerW}" y="${height - 8}" fill="${theme.faint}" font-size="9" font-family="system-ui, sans-serif" text-anchor="end">${escapeXml(short(last.atMs))}</text>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}
