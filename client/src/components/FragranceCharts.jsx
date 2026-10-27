import { Clock3, Headphones, Leaf, MoonStar, Snowflake, Sun, Umbrella } from "lucide-react";
import { getAssessmentRows } from "../utils/fragrance";

// Palette from the public Apaniche assessment CSS, checked 28/10/2026.
const seasons = {
  "xuân": { Icon: Leaf, color: "#9fe584" },
  "hạ": { Icon: Umbrella, color: "#fc958a" },
  "thu": { Icon: Leaf, color: "#f9be6e", autumn: true },
  "đông": { Icon: Snowflake, color: "#78d6f0" },
  "đêm": { Icon: MoonStar, color: "#447ba3", time: true },
  "ngày": { Icon: Sun, color: "#fcf487", time: true },
};
const getPercent = value => Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
const formatPercent = value => value.toLocaleString("vi-VN", { maximumFractionDigits: 20 });

function AssessmentMeter({ row, color = "#800000" }) {
  const value = getPercent(row.displayedPercent);
  const description = `${row.label}: ${value === null ? "Chưa có dữ liệu" : `${formatPercent(value)}%`}`;
  return <div className={`perfume-chart-track${value === null ? " is-unknown" : ""}`} title={description} role={value === null ? "img" : "meter"} aria-label={description} aria-valuemin={value === null ? undefined : 0} aria-valuemax={value === null ? undefined : 100} aria-valuenow={value ?? undefined}>
    <span style={{ width: `${value ?? 0}%`, backgroundColor: color }} />
  </div>;
}

function SourceIssue({ row }) {
  if (!row.sourceCountIssue && !row.sourceValueIssue) return null;
  return <em className="perfume-assessment-source">Bản ghi nguồn: {row.sourceRawCount != null ? `${row.sourceRawCount} lượt` : ""}{row.sourceRawCount != null && row.sourceRawPercent != null ? " · " : ""}{row.sourceRawPercent != null ? `${row.sourceRawPercent}%` : ""}</em>;
}

export default function FragranceCharts({ fragrance = {}, showSourceIssues = false }) {
  return <div className="perfume-assessment"><div className="perfume-fragrance-charts">
    {[{ key: "longevity", title: "Lưu hương", short: "Lưu", Icon: Clock3 }, { key: "sillage", title: "Tỏa hương", short: "Tỏa", Icon: Headphones }].map(({ key, title, short, Icon }) => <section className="perfume-chart" key={key} aria-label={title}>
      <h3 className="perfume-chart-legend" aria-label={title}><Icon size={22} strokeWidth={1.5} aria-hidden="true" /><span>{short}</span></h3>
      <div className="perfume-chart-rows">{getAssessmentRows(fragrance, key).map((row, index) => <div className="perfume-chart-row" key={`${row.label}-${index}`}>
        <span>{row.label}</span>
        <small>{Number.isSafeInteger(row.displayedCount) && row.displayedCount >= 0 ? row.displayedCount.toLocaleString("vi-VN") : "—"}</small>
        <AssessmentMeter row={row} />
        {showSourceIssues && <SourceIssue row={row} />}
      </div>)}</div>
    </section>)}
    <section className="perfume-suitability-card" aria-label="Mùa và thời điểm sử dụng"><h3 className="sr-only">Mùa và thời điểm</h3>
      <div className="perfume-suitability">{getAssessmentRows(fragrance, "suitability").map((row, index) => {
        const appearance = seasons[row.label.normalize("NFC").trim().toLocaleLowerCase("vi-VN")] || { Icon: Sun, color: "#888" };
        const Icon = appearance.Icon;
        return <div className={`perfume-suitability-item${appearance.time ? " is-time" : ""}${appearance.autumn ? " is-autumn" : ""}`} key={`${row.label}-${index}`}>
          <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
          <span>{row.label}</span>
          <AssessmentMeter row={row} color={appearance.color} />
          {showSourceIssues && <SourceIssue row={row} />}
        </div>;
      })}</div>
    </section>
  </div></div>;
}
