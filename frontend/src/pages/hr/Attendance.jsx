import { useEffect, useState } from "react";
import { Clock, BriefcaseBusiness } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import DateRangeFilter from "../../components/useful/DateRangeFilter";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import StatusPill from "../../components/useful/StatusPill";

import { getAttendance } from "../../services/attendanceService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./Attendance.module.css";

const PAGE_SIZE = 20;

function employeeName(employee) {
  if (!employee) return "—";
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

function formatTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_TO_PILL = {
  present: "accepted",
  late: "pending",
  absent: "rejected",
  half_day: "pending",
  holiday: "accepted",
};

export default function Attendance() {
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

  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    if (!selectedCompanyId) { setEmployees([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { employees: data } = await getEmployees({ companyId: selectedCompanyId, page: 1, limit: 500 });
        if (!cancelled) setEmployees(data || []);
      } catch (error) {
        console.error("Failed to load employees:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  const employeeOptions = buildEmployeeSearchOptions(employees);
  const [employeeFilter, setEmployeeFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { setPage(1); }, [selectedCompanyId, employeeFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!selectedCompanyId) { setRecords([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { records: data, pagination: p } = await getAttendance({
          companyId: selectedCompanyId,
          employeeId: employeeFilter || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
          page,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        setRecords(data);
        setPagination(p);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("attendance.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, employeeFilter, dateFrom, dateTo, page, t]);

  const gridColumns = "minmax(140px,1.3fr) minmax(90px,0.7fr) minmax(80px,0.6fr) minmax(80px,0.6fr) minmax(90px,0.7fr) 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("attendance.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("attendance.breadcrumbs.attendance") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Clock size={20} />
            <h1>{t("attendance.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("attendance.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading} />
        </div>
        <div className={styles.filterGroup}>
          <label>{t("attendance.fields.employee")}</label>
          <SearchSelect
            value={employeeFilter}
            onSelect={setEmployeeFilter}
            options={employeeOptions}
            placeholder={t("attendance.filterAllEmployees")}
            noResultsLabel={t("common.noResults")}
          />
        </div>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          fromLabel={t("common.dateFrom")}
          toLabel={t("common.dateTo")}
        />
      </div>

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {selectedCompanyId && !loading && records.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Clock size={28} /></div>
          <h2>{t("attendance.emptyTitle")}</h2>
          <p>{t("attendance.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && records.length > 0 && (
        <>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
              <span>{t("attendance.fields.employee")}</span>
              <span>{t("attendance.fields.date")}</span>
              <span>{t("attendance.fields.clockIn")}</span>
              <span>{t("attendance.fields.clockOut")}</span>
              <span>{t("absences.fields.status")}</span>
              <span />
            </div>
            {records.map((r) => (
              <div key={r._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                <span>{employeeName(r.employee)}</span>
                <span className="dataTableCellMuted">{formatDate(r.date)}</span>
                <span className="dataTableCellMuted">{formatTime(r.clockIn)}</span>
                <span className="dataTableCellMuted">{formatTime(r.clockOut)}</span>
                <StatusPill status={STATUS_TO_PILL[r.status] || "pending"} label={t(`attendance.status.${r.status}`)} />
                <span />
              </div>
            ))}
          </div>
          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
