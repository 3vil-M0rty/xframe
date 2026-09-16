import { useEffect, useState } from "react";
import { BarChart3, BriefcaseBusiness, Maximize2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import ChartModal from "./ChartModal";

import {
  getHeadcountReport,
  getTurnoverReport,
  getAbsenteeismReport,
  getPayrollCostReport,
  getCurrentPayrollEstimate,
} from "../../services/reportService";
import { getCompanies } from "../../services/companyService";

import styles from "./Reports.module.css";

const PIE_COLORS = ["#4c8dff", "#4cc38a", "#e8b93f", "#ff6b6b", "#a06bff", "#3ecfcf", "#ff9f4c"];

function formatAmount(amount, currency = "MAD") {
  if (amount === undefined || amount === null) return "—";
  return `${Number(amount).toLocaleString("en-US")} ${currency}`;
}

export default function Reports() {
  const { t } = useI18n();

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setCompaniesLoading(true);
        const data = await getCompanies();
        const list = Array.isArray(data) ? data : [];
        setCompanies(list);
        if (!selectedCompanyId && list.length > 0) setSelectedCompanyId(list[0]._id);
      } catch (error) {
        console.error("Failed to load companies:", error);
      } finally {
        setCompaniesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = companies.map((c) => ({
    value: c._id,
    label: c.name || c.tradeName || t("employees.company.unnamed"),
  }));

  const [headcount, setHeadcount] = useState(null);
  const [turnover, setTurnover] = useState([]);
  const [absenteeism, setAbsenteeism] = useState([]);
  const [payrollCost, setPayrollCost] = useState([]);
  const [currentEstimate, setCurrentEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!selectedCompanyId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");

      // Promise.allSettled (not Promise.all) — one endpoint
      // failing (e.g. the current-payroll-estimate call) used to
      // reject the whole batch, and since the catch block below
      // only logged to console without setting any error state,
      // the page silently rendered NOTHING at all (headcount
      // stayed null, so every chart's render condition was false)
      // — no error message, just a blank page. Each report now
      // loads independently: the ones that succeed still render,
      // and a real error is shown if any of them failed.
      const [hc, tv, ab, pc, est] = await Promise.allSettled([
        getHeadcountReport(selectedCompanyId),
        getTurnoverReport(selectedCompanyId, 12),
        getAbsenteeismReport(selectedCompanyId, 6),
        getPayrollCostReport(selectedCompanyId, 12),
        getCurrentPayrollEstimate(selectedCompanyId),
      ]);

      if (cancelled) return;

      if (hc.status === "fulfilled") setHeadcount(hc.value);
      if (tv.status === "fulfilled") setTurnover(tv.value);
      if (ab.status === "fulfilled") setAbsenteeism(ab.value);
      if (pc.status === "fulfilled") setPayrollCost(pc.value);
      if (est.status === "fulfilled") setCurrentEstimate(est.value);

      const failures = [hc, tv, ab, pc, est].filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        failures.forEach((f) => console.error("Failed to load a report:", f.reason));
        setLoadError(
          failures[0].reason?.response?.data?.message || t("reports.loadError")
        );
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
    return () => { cancelled = true; };
  }, [selectedCompanyId, t]);

  const monthLabel = (index0) => t(`payroll.months.${index0}`).slice(0, 3);

  const departmentData = headcount
    ? Object.entries(headcount.byDepartment).map(([name, value]) => ({ name, value }))
    : [];

  const turnoverData = turnover.map((row) => ({
    label: `${monthLabel(row.month - 1)} ${String(row.year).slice(2)}`,
    hires: row.hires,
    terminations: row.terminations,
  }));

  const absenteeismData = absenteeism.map((row) => ({
    label: `${monthLabel(row.month - 1)} ${String(row.year).slice(2)}`,
    rate: row.ratePercent,
  }));

  const payrollCostData = payrollCost.map((row) => ({
    label: `${monthLabel(row.month - 1)} ${String(row.year).slice(2)}${row.estimated ? " *" : ""}`,
    gross: row.totalGross,
    net: row.totalNet,
  }));

  const hasEstimatedPoint = payrollCost.some((row) => row.estimated);

  // ---------- Full-screen modal state ----------
  const [openChart, setOpenChart] = useState(null); // "turnover" | "absenteeism" | "payrollCost" | null

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("reports.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("reports.breadcrumbs.reports") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <BarChart3 size={20} />
            <h1>{t("reports.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("reports.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading} />
        </div>
      </div>

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {loadError && <div className={styles.errorBanner}>{loadError}</div>}

      {selectedCompanyId && !loading && headcount && (
        <>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>{t("reports.stats.totalHeadcount")}</span>
              <span className={styles.statValue}>{headcount.total}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>{t("reports.stats.activeEmployees")}</span>
              <span className={styles.statValue}>{headcount.active}</span>
            </div>
            {currentEstimate && (
              <>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>{t("reports.stats.currentGross")}</span>
                  <span className={styles.statValue}>{formatAmount(currentEstimate.totalGross)}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>{t("reports.stats.currentNet")}</span>
                  <span className={styles.statValue}>{formatAmount(currentEstimate.totalNet)}</span>
                </div>
              </>
            )}
          </div>

          {currentEstimate && currentEstimate.employeesWithoutSalary > 0 && (
            <div className={styles.noteBanner}>
              {t("reports.stats.missingSalaryNote").replace("{count}", currentEstimate.employeesWithoutSalary)}
            </div>
          )}

          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3>{t("reports.charts.headcountByDepartment")}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={departmentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {departmentData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3>{t("reports.charts.turnover")}</h3>
                <button type="button" className="tableActionBtn" title={t("reports.expand")} onClick={() => setOpenChart("turnover")}>
                  <Maximize2 size={14} />
                </button>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={turnoverData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="hires" name={t("reports.charts.hires")} fill="#4cc38a" />
                  <Bar dataKey="terminations" name={t("reports.charts.terminations")} fill="#ff6b6b" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3>{t("reports.charts.absenteeism")}</h3>
                <button type="button" className="tableActionBtn" title={t("reports.expand")} onClick={() => setOpenChart("absenteeism")}>
                  <Maximize2 size={14} />
                </button>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={absenteeismData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip />
                  <Line type="monotone" dataKey="rate" name={t("reports.charts.absenteeismRate")} stroke="#e8b93f" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3>{t("reports.charts.payrollCost")}</h3>
                <button type="button" className="tableActionBtn" title={t("reports.expand")} onClick={() => setOpenChart("payrollCost")}>
                  <Maximize2 size={14} />
                </button>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={payrollCostData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="gross" name={t("payroll.table.gross")} stroke="#4c8dff" strokeWidth={2} />
                  <Line type="monotone" dataKey="net" name={t("payroll.table.net")} stroke="#4cc38a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              {hasEstimatedPoint && (
                <p className={styles.chartFootnote}>{t("reports.charts.estimatedFootnote")}</p>
              )}
            </div>
          </div>
        </>
      )}

      <ChartModal
        isOpen={openChart === "turnover"}
        onClose={() => setOpenChart(null)}
        title={t("reports.charts.turnover")}
        type="bar"
        monthLabel={monthLabel}
        lines={[
          { key: "hires", name: t("reports.charts.hires"), color: "#4cc38a" },
          { key: "terminations", name: t("reports.charts.terminations"), color: "#ff6b6b" },
        ]}
        fetchSeries={(months) => getTurnoverReport(selectedCompanyId, months)}
      />

      <ChartModal
        isOpen={openChart === "absenteeism"}
        onClose={() => setOpenChart(null)}
        title={t("reports.charts.absenteeism")}
        type="line"
        monthLabel={monthLabel}
        lines={[{ key: "ratePercent", name: t("reports.charts.absenteeismRate"), color: "#e8b93f" }]}
        fetchSeries={(months) => getAbsenteeismReport(selectedCompanyId, months)}
      />

      <ChartModal
        isOpen={openChart === "payrollCost"}
        onClose={() => setOpenChart(null)}
        title={t("reports.charts.payrollCost")}
        type="line"
        monthLabel={monthLabel}
        lines={[
          { key: "totalGross", name: t("payroll.table.gross"), color: "#4c8dff" },
          { key: "totalNet", name: t("payroll.table.net"), color: "#4cc38a" },
        ]}
        fetchSeries={(months) => getPayrollCostReport(selectedCompanyId, months)}
      />
    </div>
  );
}
