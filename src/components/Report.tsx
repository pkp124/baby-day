import type { CareEvent, Settings } from "../lib/types";
import { buildReport, formatPct, gapLabel, REPORT_HOURS, reportFileStem, type ReportModel } from "../lib/report";
import { darkChartTheme, dayBarsSvg, ganttSvg, sleepSplitSvg, tempLineSvg } from "../lib/reportCharts";
import { reportHtml } from "../lib/reportHtml";
import { downloadFile, printHtml } from "../lib/download";
import { formatDuration } from "../lib/time";
import { formatMl, formatTemp, formatWeight } from "../lib/units";

function Chart({ markup, label, scroll }: { markup: string; label: string; scroll?: boolean }) {
  return (
    <div className={scroll ? "chart-frame scroll" : "chart-frame"} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: markup }} />
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
  const report = buildReport(events, settings, now);
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
          <div className="eyebrow">Last {REPORT_HOURS} hours</div>
          <h1 className="baby-name">{settings.babyName || "Baby"}</h1>
        </div>
      </header>
      <p className="muted">
        A handover snapshot, not medical advice. Save the HTML file, or print it and choose Save as PDF.
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
      <Chart markup={ganttSvg(report, darkChartTheme)} label="72-hour care timeline" scroll />
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

      <h2>Sleep</h2>
      <Chart markup={sleepSplitSvg(report, darkChartTheme)} label="Percent of time asleep" />
      <Chart markup={dayBarsSvg(report, darkChartTheme, "sleep", settings)} label="Sleep share per care day" />
      <p className="faint">
        Longest stretch {formatDuration(report.longestSleepSeconds)} asleep, {formatDuration(report.longestAwakeSeconds)}{" "}
        awake. {report.sleepCount} sleep {report.sleepCount === 1 ? "stretch" : "stretches"}.
      </p>

      <h2>Feeding</h2>
      <Chart markup={dayBarsSvg(report, darkChartTheme, "feeds", settings)} label="Feeds per care day" />
      <Chart markup={dayBarsSvg(report, darkChartTheme, "milk", settings)} label="Bottle milk per care day" />
      <p className="faint">
        Breast {formatDuration(report.breastSeconds)} · median gap {gapLabel(report.medianFeedGapMinutes)}. Nursing is a
        feed count, not millilitres. * is a partial care day.
      </p>

      <h2>Temperature</h2>
      <Chart markup={tempLineSvg(report, darkChartTheme, settings)} label="Temperature trend" />

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
