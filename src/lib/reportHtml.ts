import { describeEvent } from "./summary";
import { formatDuration } from "./time";
import { formatMl, formatTemp, formatWeight } from "./units";
import { formatPct, formatReportStamp, gapLabel, type ReportModel } from "./report";
import {
  dayBarsSvg,
  escapeXml,
  ganttSvg,
  lightChartTheme,
  sleepSplitSvg,
  tempLineSvg,
} from "./reportCharts";
import type { Settings } from "./types";

function css() {
  return `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Atkinson Hyperlegible", "Segoe UI", sans-serif;
  background: #fbf7f1;
  color: #1c1712;
}
.page { max-width: 880px; margin: 0 auto; padding: 28px 20px 64px; }
h1, h2 { font-family: Fraunces, Georgia, serif; font-weight: 640; margin: 0; }
h1 { font-size: 2rem; letter-spacing: -0.03em; }
h2 { font-size: 1.25rem; margin: 28px 0 10px; }
.eyebrow { color: #8a7868; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; }
.muted { color: #5c4e42; }
.faint { color: #8a7868; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 16px 0; }
.cell { background: #fff; border: 1px solid rgba(28,23,18,0.08); border-radius: 16px; padding: 12px; }
.cell strong { display: block; margin-top: 4px; font-size: 1.15rem; }
.chart { background: #fff; border: 1px solid rgba(28,23,18,0.08); border-radius: 16px; padding: 8px; margin: 10px 0; overflow-x: auto; }
.chart svg { display: block; min-width: 1000px; }
.chart.fit svg { min-width: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 10px 16px; font-size: 0.85rem; color: #5c4e42; margin: 8px 0 0; }
.swatch { display: inline-block; width: 10px; height: 10px; border-radius: 99px; margin-right: 6px; }
table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid rgba(28,23,18,0.08); vertical-align: top; }
th { color: #8a7868; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
.note { font-size: 0.85rem; color: #8a7868; line-height: 1.45; }
.toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
.toolbar button {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 14px;
  border: 0;
  background: #e07a5f;
  color: #1c110e;
  font-weight: 700;
  cursor: pointer;
}
.actions { margin-top: 8px; }
@media print {
  .toolbar { display: none; }
  body { background: #fff; }
  .page { padding: 0; }
  .chart, .cell { break-inside: avoid; }
}
`.trim();
}

export function reportHtml(model: ReportModel, settings: Settings) {
  const from = formatReportStamp(model.start, model.timezone);
  const to = formatReportStamp(model.end, model.timezone);
  const theme = lightChartTheme;
  const vitaminRows = model.days
    .map((day) => {
      const d = day.vitaminD ? day.vitaminDAt : "not given";
      const k = day.vitaminK ? day.vitaminKAt : "not given";
      return `<tr><td>${escapeXml(day.label)}${day.partial ? " *" : ""}</td><td>${escapeXml(d ?? "—")}</td><td>${escapeXml(k ?? "—")}</td></tr>`;
    })
    .join("");
  const log = model.eventLog
    .map((event) => {
      const when = new Intl.DateTimeFormat(undefined, {
        timeZone: settings.timezone,
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(event.time));
      return `<tr><td>${escapeXml(when)}</td><td>${escapeXml(describeEvent(event, settings, model.end))}</td></tr>`;
    })
    .join("");

  const weight =
    model.lastWeightGrams != null
      ? `${formatWeight(model.lastWeightGrams, settings.weightUnit)}${model.lastWeightAt ? ` at ${formatReportStamp(new Date(model.lastWeightAt), settings.timezone)}` : ""}`
      : "—";
  const tempRange =
    model.tempMinC != null && model.tempMaxC != null
      ? `${formatTemp(model.tempMinC, settings.tempUnit)} – ${formatTemp(model.tempMaxC, settings.tempUnit)}`
      : "no readings";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeXml(model.babyName)} — last ${model.hours} hours</title>
  <style>${css()}</style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <button type="button" onclick="window.print()">Print / save PDF</button>
    </div>
    <div class="eyebrow">Baby Day report</div>
    <h1>${escapeXml(model.babyName)} — last ${model.hours} hours</h1>
    <p class="muted">${escapeXml(from)} → ${escapeXml(to)} · ${escapeXml(model.timezone)}</p>
    <p class="note">A family handover snapshot, not medical advice. Care day starts at ${settings.careDayStartHour}:00.</p>

    <div class="grid">
      <div class="cell"><div class="eyebrow">Time asleep</div><strong>${escapeXml(formatPct(model.sleepPct))}</strong><div class="faint">${escapeXml(formatDuration(model.sleepSeconds))} of ${escapeXml(formatDuration(model.durationSeconds))}</div></div>
      <div class="cell"><div class="eyebrow">Longest sleep</div><strong>${escapeXml(formatDuration(model.longestSleepSeconds))}</strong><div class="faint">Longest awake ${escapeXml(formatDuration(model.longestAwakeSeconds))}</div></div>
      <div class="cell"><div class="eyebrow">Feeds</div><strong>${model.feeds}</strong><div class="faint">Median gap ${escapeXml(gapLabel(model.medianFeedGapMinutes))} · breast ${escapeXml(formatDuration(model.breastSeconds))}</div></div>
      <div class="cell"><div class="eyebrow">Diapers</div><strong>${model.wet} wet · ${model.dirty} dirty</strong><div class="faint">${model.sleepCount} sleep stretches</div></div>
      <div class="cell"><div class="eyebrow">Bottle milk</div><strong>${escapeXml(formatMl(model.bottleMl, settings.volumeUnit))}</strong><div class="faint">${escapeXml(formatMl(model.formulaMl, settings.volumeUnit))} formula · ${escapeXml(formatMl(model.expressedMl, settings.volumeUnit))} expressed</div></div>
      <div class="cell"><div class="eyebrow">Pumped</div><strong>${escapeXml(formatMl(model.pumpMl, settings.volumeUnit))}</strong><div class="faint">Fridge estimate ${escapeXml(formatMl(model.fridgeMl, settings.volumeUnit))}</div></div>
      <div class="cell"><div class="eyebrow">Temperature</div><strong>${escapeXml(tempRange)}</strong><div class="faint">${model.tempSamples.length} reading${model.tempSamples.length === 1 ? "" : "s"}</div></div>
      <div class="cell"><div class="eyebrow">Last weight</div><strong>${escapeXml(weight)}</strong><div class="faint">Breast ${model.methods.breast} · formula ${model.methods.formula} · expressed ${model.methods.expressed} · mixed ${model.methods.mixed}</div></div>
    </div>

    <h2>Care timeline</h2>
    <p class="note">Sleep and feeds are spans. Diapers, pumps, and temperatures are dots. Scroll sideways on a phone.</p>
    <div class="chart">${ganttSvg(model, theme)}</div>
    <div class="legend">
      <span><i class="swatch" style="background:#4e8f73"></i>Sleep</span>
      <span><i class="swatch" style="background:#c45c40"></i>Feed</span>
      <span><i class="swatch" style="background:#c49a3a"></i>Diaper</span>
      <span><i class="swatch" style="background:#4a8ea3"></i>Pump</span>
      <span><i class="swatch" style="background:#c45c4a"></i>Temp</span>
    </div>

    <h2>Sleep</h2>
    <div class="chart fit">${sleepSplitSvg(model, theme)}</div>
    <div class="chart fit">${dayBarsSvg(model, theme, "sleep", settings)}</div>

    <h2>Feeding</h2>
    <div class="chart fit">${dayBarsSvg(model, theme, "feeds", settings)}</div>
    <div class="chart fit">${dayBarsSvg(model, theme, "milk", settings)}</div>
    <p class="note">Nursing is counted as a feed, not millilitres. * is a partial care day at the edge of the 72-hour window.</p>

    <h2>Temperature</h2>
    <div class="chart fit">${tempLineSvg(model, theme, settings)}</div>

    <h2>Vitamins by care day</h2>
    <table>
      <thead><tr><th>Care day</th><th>Vitamin D</th><th>Vitamin K</th></tr></thead>
      <tbody>${vitaminRows || `<tr><td colspan="3">None</td></tr>`}</tbody>
    </table>

    <h2>Events</h2>
    <table>
      <thead><tr><th>When</th><th>What</th></tr></thead>
      <tbody>${log || `<tr><td colspan="2">Nothing logged in this window.</td></tr>`}</tbody>
    </table>
    <p class="note">Generated ${escapeXml(formatReportStamp(model.generatedAt, model.timezone))} on this phone. Events do not leave the device when you save this file.</p>
  </div>
</body>
</html>`;
}
