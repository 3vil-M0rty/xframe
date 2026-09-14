import { useEffect, useState } from "react";
import { BarChart3, BriefcaseBusiness } from "lucide-react";
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

import {
  getHeadcountReport,
  getTurnoverReport,
  getAbsenteeismReport,
  getPayrollCostReport,
} from "../../services/reportService";
import { getCompanies } from "../../services/companyService";

import styles from "./Reports.module.css";

const PIE_COLORS = ["#4c8dff", "#4cc38a", "#e8b93f", "#ff6b6b", "#a06bff", "#3ecfcf", "#ff9f4c"];

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompanyId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [hc, tv, ab, pc] = await Promise.all([
          getHeadcountReport(selectedCompanyId),
          getTurnoverReport(selectedCompanyId, 12),
          getAbsenteeismReport(selectedCompanyId, 6),
          getPayrollCostReport(selectedCompanyId, 12),
        ]);
        if (cancelled) return;
        setHeadcount(hc);
        setTurnover(tv);
        setAbsenteeism(ab);
        setPayrollCost(pc);
      } catch (error) {
        console.error("Failed to load reports:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  const departmentData = headcount
    ? Object.entries(headcount.byDepartment).map(([name, value]) => ({ name, value }))
    : [];

  const turnoverData = turnover.map((row) => ({
    label: `${t(`payroll.months.${row.month - 1}`).slice(0, 3)} ${String(row.year).slice(2)}`,
    hires: row.hires,
    terminations: row.terminations,
  }));

  const absenteeismData = absenteeism.map((row) => ({
    label: `${t(`payroll.months.${row.month - 1}`).slice(0, 3)} ${String(row.year).slice(2)}`,
    rate: row.ratePercent,
  }));

  const payrollCostData = payrollCost.map((row) => ({
    label: `${t(`payroll.months.${row.month - 1}`).slice(0, 3)} ${String(row.year).slice(2)}`,
    gross: row.totalGross,
    net: row.totalNet,
  }));

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
          </div>

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
              <h3>{t("reports.charts.turnover")}</h3>
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
              <h3>{t("reports.charts.absenteeism")}</h3>
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
              <h3>{t("reports.charts.payrollCost")}</h3>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
