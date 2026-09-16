import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
} from "recharts";

import styles from "./ChartModal.module.css";

/**
 * Full-screen view of a bar/line chart with:
 *  - a range selector (how many months of history to load)
 *  - a monthly/yearly aggregation toggle
 *  - zoom, via recharts' own Brush control (drag the handles under
 *    the chart to zoom into a sub-range; there's no separate
 *    "zoom in/out" button because Brush already covers that
 *    interaction more directly — drag to zoom, drag back out to
 *    reset)
 *
 * `fetchSeries(months)` should return the same monthly series
 * shape the inline chart uses; this component re-fetches whenever
 * the range changes and handles the monthly→yearly aggregation
 * itself so callers don't need two versions of their data.
 */
export default function ChartModal({
  isOpen,
  onClose,
  title,
  type, // "bar" | "line"
  lines, // [{ key, name, color }]
  fetchSeries, // async (months) => [{ month, year, ...values }]
  monthLabel, // (index0based) => "Jan" etc, for x-axis labels
}) {
  const [months, setMonths] = useState(12);
  const [granularity, setGranularity] = useState("monthly");
  const [rawSeries, setRawSeries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchSeries(months);
        if (!cancelled) setRawSeries(data || []);
      } catch (error) {
        console.error("Failed to load chart data:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, months]);

  const chartData = useMemo(() => {
    if (granularity === "monthly") {
      return rawSeries.map((row) => ({
        ...row,
        label: `${monthLabel(row.month - 1)} ${row.year}`,
      }));
    }

    // Yearly: sum every numeric field across all months in that year.
    const byYear = new Map();
    for (const row of rawSeries) {
      const key = row.year;
      if (!byYear.has(key)) byYear.set(key, { year: row.year, label: String(row.year) });
      const bucket = byYear.get(key);
      for (const { key: lineKey } of lines) {
        bucket[lineKey] = (bucket[lineKey] || 0) + (row[lineKey] || 0);
      }
    }
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }, [rawSeries, granularity, lines, monthLabel]);

  if (!isOpen) return null;

  const ChartComponent = type === "bar" ? BarChart : LineChart;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button type="button" className="tableActionBtn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label>Range</label>
            <select
              className={styles.select}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
              <option value={36}>Last 36 months</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label>View</label>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${granularity === "monthly" ? styles.toggleBtnActive : ""}`}
                onClick={() => setGranularity("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${granularity === "yearly" ? styles.toggleBtnActive : ""}`}
                onClick={() => setGranularity("yearly")}
              >
                Yearly
              </button>
            </div>
          </div>

          <span className={styles.hint}>Drag the handles below the chart to zoom in</span>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={480}>
            <ChartComponent data={chartData} margin={{ bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {lines.map((line) =>
                type === "bar" ? (
                  <Bar key={line.key} dataKey={line.key} name={line.name} fill={line.color} />
                ) : (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={2}
                  />
                )
              )}
              <Brush dataKey="label" height={26} stroke="#4c8dff" travellerWidth={10} />
            </ChartComponent>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
