/**
 * A "From" / "To" date range filter, styled to match the rest of
 * the app's toolbar filters (see the .filterGroup/.dateInput
 * classes in src/styles/global.css). Fully controlled — the
 * caller owns the actual date values and decides what to do with
 * them (usually just passing them straight into a service call's
 * `from`/`to` params).
 */
export default function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = "From",
  toLabel = "To",
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        // Own container, not relying on whatever grid/flex the
        // caller's toolbar uses — keeps the From/To pair from
        // getting squeezed into an overly narrow column when placed
        // alongside other filters.
        minWidth: 280,
      }}
    >
      <div className="filterGroup" style={{ flex: "1 1 130px" }}>
        <label>{fromLabel}</label>
        <input
          type="date"
          className="dateInput"
          style={{ width: "100%" }}
          value={from || ""}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>

      <div className="filterGroup" style={{ flex: "1 1 130px" }}>
        <label>{toLabel}</label>
        <input
          type="date"
          className="dateInput"
          style={{ width: "100%" }}
          value={to || ""}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
    </div>
  );
}
