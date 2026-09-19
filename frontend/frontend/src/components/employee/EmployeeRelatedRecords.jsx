import { useEffect, useState } from "react";
import {
  Wallet,
  CalendarOff,
  HandCoins,
  FileSignature,
  FolderOpen,
  Clock,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import StatusPill from "../useful/StatusPill";
import DateRangeFilter from "../useful/DateRangeFilter";

import { getSalaries } from "../../services/salaryService";
import { getAbsences } from "../../services/absenceService";
import { getAdvances } from "../../services/advanceService";
import { getContracts } from "../../services/contractService";
import { getDocuments } from "../../services/documentService";
import { getAttendance } from "../../services/attendanceService";

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

function formatAmount(amount, currency = "MAD") {
  if (amount === undefined || amount === null) return "—";
  return `${Number(amount).toLocaleString("en-US")} ${currency}`;
}

function getFileExtension(doc) {
  const source = doc.file?.originalName || doc.file?.url || "";
  const match = source.match(/\.([a-zA-Z0-9]{2,5})(?:\?.*)?$/);
  return match ? match[1].toUpperCase() : "FILE";
}

const TABS = [
  { key: "salary", icon: Wallet },
  { key: "absences", icon: CalendarOff },
  { key: "advances", icon: HandCoins },
  { key: "contracts", icon: FileSignature },
  { key: "documents", icon: FolderOpen },
  { key: "attendance", icon: Clock },
];

// These two tabs are inherently date-based and get their own From/
// To filter — they always refetch on tab-activate or filter change
// rather than using the "fetch once, cache forever" behavior the
// other tabs use (their data doesn't depend on a date range, so
// caching it is safe and avoids refetching every time you switch
// back to that tab).
const DATE_FILTERABLE_TABS = ["absences", "attendance"];

/**
 * Everything else the app knows about one employee — salary
 * history, absences, advances, contracts, documents, attendance —
 * in one tabbed panel. Lives inside the employee detail view (see
 * pages/hr/Employees.jsx). Read-only summaries; use the dedicated
 * Salaries/Absences/Advances/... pages for the full create/edit/
 * review workflows.
 */
export default function EmployeeRelatedRecords({ employeeId, companyId }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("salary");
  const [dataByTab, setDataByTab] = useState({});
  const [loadingTab, setLoadingTab] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setDataByTab({});
    setActiveTab("salary");
    setDateFrom("");
    setDateTo("");
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId || !companyId) return;

    const isDateFilterable = DATE_FILTERABLE_TABS.includes(activeTab);
    // Non-date-filterable tabs are fetched once and cached; the two
    // date-filterable ones always refetch (their "cache" would be
    // invalidated by every filter change anyway).
    if (!isDateFilterable && dataByTab[activeTab]) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingTab(activeTab);
        let result;

        if (activeTab === "salary") {
          const { salaries } = await getSalaries({ companyId, employeeId, limit: 50 });
          result = salaries;
        } else if (activeTab === "absences") {
          const { absences } = await getAbsences({
            companyId, employeeId, limit: 50,
            from: dateFrom || undefined, to: dateTo || undefined,
          });
          result = absences;
        } else if (activeTab === "advances") {
          const { advances } = await getAdvances({ companyId, employeeId, limit: 50 });
          result = advances;
        } else if (activeTab === "contracts") {
          const { contracts } = await getContracts({ companyId, employeeId, limit: 50 });
          result = contracts;
        } else if (activeTab === "documents") {
          const { documents } = await getDocuments({ companyId, employeeId, limit: 50 });
          result = documents;
        } else if (activeTab === "attendance") {
          const { records } = await getAttendance({
            companyId, employeeId, limit: 15,
            from: dateFrom || undefined, to: dateTo || undefined,
          });
          result = records;
        }

        if (!cancelled) {
          setDataByTab((prev) => ({ ...prev, [activeTab]: result || [] }));
        }
      } catch (error) {
        console.error(`Failed to load ${activeTab} for employee:`, error);
        if (!cancelled) setDataByTab((prev) => ({ ...prev, [activeTab]: [] }));
      } finally {
        if (!cancelled) setLoadingTab(null);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, employeeId, companyId, dateFrom, dateTo]);

  const rows = dataByTab[activeTab];
  const isLoading = loadingTab === activeTab;

  return (
    <div className="detailSection" style={{ gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 11px",
                borderRadius: 8,
                border: `1px solid ${activeTab === key ? "var(--color-border)" : "transparent"}`,
                background: activeTab === key ? "var(--color-bg-secondary)" : "transparent",
                color: activeTab === key ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Icon size={14} />
              {t(`employees.related.tabs.${key}`)}
            </button>
          ))}
        </div>

        {DATE_FILTERABLE_TABS.includes(activeTab) && (
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            fromLabel={t("common.dateFrom")}
            toLabel={t("common.dateTo")}
          />
        )}
      </div>

      {isLoading && <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>{t("common.loading")}</p>}

      {!isLoading && (!rows || rows.length === 0) && (
        <p style={{ color: "var(--color-text-tertiary)", fontSize: "0.85rem" }}>
          {t("employees.related.empty")}
        </p>
      )}

      {!isLoading && rows && rows.length > 0 && activeTab === "salary" && (
        <SimpleTable
          columns={[t("salaries.table.base"), t("salaries.fields.effectiveDate"), t("salaries.table.endDate")]}
          rows={rows.map((r) => [
            formatAmount(r.baseSalary, r.currency),
            formatDate(r.effectiveDate),
            r.endDate ? formatDate(r.endDate) : t("salaries.table.ongoing"),
          ])}
        />
      )}

      {!isLoading && rows && rows.length > 0 && activeTab === "absences" && (
        <SimpleTable
          columns={[t("absences.fields.type"), t("absences.table.period"), t("absences.fields.status")]}
          rows={rows.map((r) => [
            t(`absences.types.${r.type}`),
            `${formatDate(r.startDate)} — ${formatDate(r.endDate)}`,
            <StatusPill key="s" status={r.status} label={t(`absences.status.${r.status}`)} />,
          ])}
        />
      )}

      {!isLoading && rows && rows.length > 0 && activeTab === "advances" && (
        <SimpleTable
          columns={[t("advances.fields.amount"), t("advances.fields.requestDate"), t("advances.fields.status")]}
          rows={rows.map((r) => [
            formatAmount(r.amount, r.currency),
            formatDate(r.requestDate),
            <StatusPill key="s" status={r.status} label={t(`advances.status.${r.status}`)} />,
          ])}
        />
      )}

      {!isLoading && rows && rows.length > 0 && activeTab === "contracts" && (
        <SimpleTable
          columns={[t("contracts.fields.type"), t("contracts.fields.startDate"), t("contracts.fields.endDate"), t("absences.fields.status")]}
          rows={rows.map((r) => [
            t(`employees.employmentTypes.${r.type}`),
            formatDate(r.startDate),
            r.endDate ? formatDate(r.endDate) : t("salaries.table.ongoing"),
            t(`contracts.status.${r.status}`),
          ])}
        />
      )}

      {!isLoading && rows && rows.length > 0 && activeTab === "documents" && (
        <SimpleTable
          columns={[t("documents.fields.type"), t("documents.table.file"), t("documents.fields.expiryDate")]}
          rows={rows.map((r) => [
            r.label || t(`documents.types.${r.type}`),
            getFileExtension(r),
            r.expiryDate ? formatDate(r.expiryDate) : "—",
          ])}
        />
      )}

      {!isLoading && rows && rows.length > 0 && activeTab === "attendance" && (
        <SimpleTable
          columns={[t("attendance.fields.date"), t("attendance.fields.clockIn"), t("attendance.fields.clockOut"), t("absences.fields.status")]}
          rows={rows.map((r) => [
            formatDate(r.date),
            r.clockIn ? new Date(r.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
            r.clockOut ? new Date(r.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
            t(`attendance.status.${r.status}`),
          ])}
        />
      )}
    </div>
  );
}

function SimpleTable({ columns, rows }) {
  return (
    <div className="dataTable">
      <div
        className="dataTableHead"
        style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
      >
        {columns.map((c) => <span key={c}>{c}</span>)}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="dataTableRow"
          style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
        >
          {row.map((cell, j) => (
            <span key={j} className="dataTableCellMuted">{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
