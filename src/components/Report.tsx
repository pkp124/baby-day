import { useMemo, useState } from "react";
import type { CareEvent, Settings } from "../lib/types";
import {
  buildReport,
  formatHours,
  formatPct,
  gapLabel,
  normalizeReportRange,
  REPORT_HOURS,
  reportFileStem,
  reportTitle,
  reportWindow,
  type ReportModel,
} from "../lib/report";
import {
  darkChartTheme,
  diaperTrendSvg,
  ganttSvg,
  milkTrendSvg,
  sleepSplitSvg,
  sleepTrendSvg,
  tempHistorySvg,
  weightHistorySvg,
} from "../lib/reportCharts";
import { reportHtml } from "../lib/reportHtml";
import { downloadFile, printHtml } from "../lib/download";
import { formatDuration, fromDatetimeLocalValue, toDatetimeLocalValue } from "../lib/time";
import { formatMl, formatTemp, formatWeight } from "../lib/units";

function Chart({
  markup,
  label,
  scroll,
  trend,
}: {
  markup: string;
  label: string;
  scroll?: boolean;
  trend?: boolean;
}) {
  const className = ["chart-frame", scroll || trend ? "scroll" : "", trend ? "trend" : ""].filter(Boolean).join(" ");
  return <div className={className} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: markup }} />;
}

function LifetimeSection({ report, settings }: { report: ReportModel; settings: Settings }) {
  const { lifetime } = report;
  if (lifetime.dayCount === 0) {
    return (
      <>
        <h2>All days</h2>
        <p className="faint">Trends fill in as you log sleep, milk, diapers, temperature, and weight.</p>
      </>
    );
  }
  return (
    <>
      <h2>All days</h2>
      <p className="muted">
        {lifetime.dayCount} care {lifetime.dayCount === 1 ? "day" : "days"} since first log. Typical day:{" "}
        {formatHours(lifetime.medianSleepHours ?? 0)} sleep · {formatMl(lifetime.medianMilkMl ?? 0, settings.volumeUnit)}{" "}
        · {lifetime.medianDiapers == null ? "—" : `${Math.round(lifetime.medianDiapers * 10) / 10} diapers`}.
      </p>
      <Chart markup={sleepTrendSvg(lifetime.days, darkChartTheme)} label="Sleep hours for every care day" trend />
      <Chart markup={milkTrendSvg(lifetime.days, darkChartTheme, settings)} label="Bottle milk for every care day" trend />
      <Chart markup={diaperTrendSvg(lifetime.days, darkChartTheme)} label="Diapers for every care day" trend />
      <Chart markup={tempHistorySvg(lifetime.temps, darkChartTheme, settings)} label="All temperature readings" />
      <Chart markup={weightHistorySvg(lifetime.weights, darkChartTheme, settings)} label="All weight readings" />
      <p className="faint">* is today, still in progress. Empty days stay on the chart so gaps are visible.</p>
      <div className="trend-table-wrap">
        <table className="trend-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Sleep</th>
              <th>Milk</th>
              <th>Diapers</th>
              <th>Temp</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {[...lifetime.days].reverse().map((day) => (
              <tr key={day.key}>
                <td>
                  {day.label}
                  {day.partial ? "*" : ""}
                </td>
                <td>{formatHours(day.sleepHours)}</td>
                <td>{formatMl(day.milkMl, settings.volumeUnit)}</td>
                <td>
                  {day.diapers}
                  <span className="faint">
                    {" "}
                    ({day.wet}/{day.dirty})
                  </span>
                </td>
                <td>{day.lastTempC == null ? "—" : formatTemp(day.lastTempC, settings.tempUnit)}</td>
                <td>{day.lastWeightGrams == null ? "—" : formatWeight(day.lastWeightGrams, settings.weightUnit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function SeventyTwoCard({
  events,
  settings,
  now,
  onOpen,
}: {
  events: CareEvent[];
  settings: Settings;
  now: Date;
  onOpen: () => void;
}) {
  const report = buildReport(events, settings, now);
  return (
    <section className="report-card">
      <div className="report-card-head">
        <div>
          <div className="kicker">Last {REPORT_HOURS} hours</div>
          <strong>
            {formatPct(report.sleepPct)} asleep · {report.feeds} feeds
          </strong>
          <div className="faint">
            {report.wet} wet · {report.dirty} dirty
            {report.tempSamples.length > 0 && report.tempMinC != null && report.tempMaxC != null
              ? ` · temp ${formatTemp(report.tempMinC, settings.tempUnit)}–${formatTemp(report.tempMaxC, settings.tempUnit)}`
              : ""}
          </div>
        </div>
        <button className="secondary" type="button" onClick={onOpen}>
          Report
        </button>
      </div>
      <Chart markup={sleepSplitSvg(report, darkChartTheme)} label="Sleep versus awake in the last 72 hours" />
    </section>
  );
}

type RangeKind = "24" | "48" | "72" | "7d" | "custom";

const RANGE_PRESETS: { kind: Exclude<RangeKind, "custom">; label: string }[] = [
  { kind: "24", label: "24h" },
  { kind: "48", label: "48h" },
  { kind: "72", label: "72h" },
  { kind: "7d", label: "7d" },
];

function hoursForKind(kind: Exclude<RangeKind, "custom">) {
  switch (kind) {
    case "24":
      return 24;
    case "48":
      return 48;
    case "72":
      return 72;
    case "7d":
      return 168;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function RangeBar({
  timezone,
  now,
  kind,
  startIso,
  endIso,
  onKind,
  onStartIso,
  onEndIso,
}: {
  timezone: string;
  now: Date;
  kind: RangeKind;
  startIso: string;
  endIso: string;
  onKind: (kind: RangeKind) => void;
  onStartIso: (iso: string) => void;
  onEndIso: (iso: string) => void;
}) {
  const maxValue = toDatetimeLocalValue(now.toISOString(), timezone);
  return (
    <div className="report-range">
      <div className="timechips">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.kind}
            type="button"
            className={kind === preset.kind ? "on" : ""}
            onClick={() => onKind(preset.kind)}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" className={kind === "custom" ? "on" : ""} onClick={() => onKind("custom")}>
          Custom
        </button>
      </div>
      {kind === "custom" && (
        <div className="report-range-fields">
          <label className="field">
            Start
            <input
              type="datetime-local"
              step={60}
              max={maxValue}
              value={toDatetimeLocalValue(startIso, timezone)}
              onChange={(e) => {
                if (!e.target.value) return;
                onStartIso(fromDatetimeLocalValue(e.target.value, timezone));
              }}
            />
          </label>
          <label className="field">
            End
            <input
              type="datetime-local"
              step={60}
              max={maxValue}
              value={toDatetimeLocalValue(endIso, timezone)}
              onChange={(e) => {
                if (!e.target.value) return;
                onEndIso(fromDatetimeLocalValue(e.target.value, timezone));
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function ReportPage({
  events,
  settings,
  now,
  onHome,
}: {
  events: CareEvent[];
  settings: Settings;
  now: Date;
  onHome: () => void;
}) {
  const [kind, setKind] = useState<RangeKind>("72");
  const [customStartIso, setCustomStartIso] = useState(() => reportWindow(now).start.toISOString());
  const [customEndIso, setCustomEndIso] = useState(() => now.toISOString());

  function chooseKind(next: RangeKind) {
    if (next === "custom" && kind !== "custom") {
      const win = reportWindow(now, hoursForKind(kind));
      setCustomStartIso(win.start.toISOString());
      setCustomEndIso(win.end.toISOString());
    }
    setKind(next);
  }

  const range = useMemo(() => {
    if (kind === "custom") return normalizeReportRange(new Date(customStartIso), new Date(customEndIso), now);
    return reportWindow(now, hoursForKind(kind));
  }, [kind, customStartIso, customEndIso, now]);

  const report = buildReport(events, settings, now, range);
  const title = reportTitle(report);
  const html = reportHtml(report, settings);

  function saveHtml() {
    downloadFile(`${reportFileStem(report)}.html`, html, "text/html;charset=utf-8");
  }

  function savePdf() {
    printHtml(html);
  }

  return (
    <div className="report-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Report</div>
          <h1 className="baby-name">{settings.babyName || "Baby"}</h1>
        </div>
      </header>
      <p className="muted">
        Pick a time range for sleep, milk, diapers, and the printable file. Trends below still cover every care day on
        this phone. Not medical advice.
      </p>
      <RangeBar
        timezone={settings.timezone}
        now={now}
        kind={kind}
        startIso={customStartIso}
        endIso={customEndIso}
        onKind={chooseKind}
        onStartIso={setCustomStartIso}
        onEndIso={setCustomEndIso}
      />
      <p className="faint">
        {title}
        {kind === "custom" ? ` · ${formatHours(report.hours)}` : ""}
      </p>
      <div className="row" style={{ margin: "12px 0 16px" }}>
        <button className="primary grow" type="button" onClick={saveHtml}>
          Download HTML
        </button>
        <button className="secondary grow" type="button" onClick={savePdf}>
          Print / PDF
        </button>
      </div>

      <StatGrid report={report} settings={settings} />

      <h2>Care timeline</h2>
      <p className="faint">Sleep and feeds are bars. Diapers, pumps, and temperatures are dots. Scroll sideways.</p>
      <Chart markup={ganttSvg(report, darkChartTheme)} label={`${title} care timeline`} scroll />
      <div className="chart-legend">
        <span>
          <i className="swatch sleep" />
          Sleep
        </span>
        <span>
          <i className="swatch feed" />
          Feed
        </span>
        <span>
          <i className="swatch diaper" />
          Diaper
        </span>
        <span>
          <i className="swatch pump" />
          Pump
        </span>
        <span>
          <i className="swatch temp" />
          Temp
        </span>
      </div>

      <h2>{title}</h2>
      <Chart markup={sleepSplitSvg(report, darkChartTheme)} label={`Percent of time asleep, ${title}`} />
      <p className="faint">
        Longest stretch {formatDuration(report.longestSleepSeconds)} asleep, {formatDuration(report.longestAwakeSeconds)}{" "}
        awake. {report.sleepCount} sleep {report.sleepCount === 1 ? "stretch" : "stretches"}. Breast{" "}
        {formatDuration(report.breastSeconds)} · median gap {gapLabel(report.medianFeedGapMinutes)}.
      </p>

      <LifetimeSection report={report} settings={settings} />

      <h2>Vitamins</h2>
      <div className="timeline">
        {report.days.map((day) => (
          <div key={day.key} className="event">
            <div>
              <div className="when">{day.label}</div>
              <div className="who">{day.partial ? "partial day" : "care day"}</div>
            </div>
            <div>
              D {day.vitaminD ? `given ${day.vitaminDAt}` : "not given"}
              <div className="who">K {day.vitaminK ? `given ${day.vitaminKAt}` : "not given"}</div>
            </div>
            <span className={`mark ${day.vitaminD && day.vitaminK ? "sleep" : "temp"}`} />
          </div>
        ))}
      </div>
      <button className="ghost" type="button" onClick={onHome} style={{ marginTop: 16 }}>
        Back to home
      </button>
    </div>
  );
}

function StatGrid({ report, settings }: { report: ReportModel; settings: Settings }) {
  const temp =
    report.tempMinC != null && report.tempMaxC != null
      ? `${formatTemp(report.tempMinC, settings.tempUnit)}–${formatTemp(report.tempMaxC, settings.tempUnit)}`
      : "none";
  const weight =
    report.lastWeightGrams != null ? formatWeight(report.lastWeightGrams, settings.weightUnit) : "—";
  return (
    <div className="glance report-stats">
      <div className="cell">
        <div className="kicker">Asleep</div>
        <strong>{formatPct(report.sleepPct)}</strong>
        <div className="faint">{formatDuration(report.sleepSeconds)}</div>
      </div>
      <div className="cell">
        <div className="kicker">Feeds</div>
        <strong>{report.feeds}</strong>
        <div className="faint">gap {gapLabel(report.medianFeedGapMinutes)}</div>
      </div>
      <div className="cell">
        <div className="kicker">Diapers</div>
        <strong>
          {report.wet} / {report.dirty}
        </strong>
        <div className="faint">wet / dirty</div>
      </div>
      <div className="cell">
        <div className="kicker">Bottles</div>
        <strong>{formatMl(report.bottleMl, settings.volumeUnit)}</strong>
        <div className="faint">{formatMl(report.pumpMl, settings.volumeUnit)} pumped</div>
      </div>
      <div className="cell">
        <div className="kicker">Temp range</div>
        <strong>{temp}</strong>
        <div className="faint">
          {report.tempSamples.length} reading{report.tempSamples.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="cell">
        <div className="kicker">Weight</div>
        <strong>{weight}</strong>
        <div className="faint">last logged</div>
      </div>
    </div>
  );
}
