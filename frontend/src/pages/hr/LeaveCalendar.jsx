import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";

import { getLeaveCalendar } from "../../services/absenceService";
import { getCompanies } from "../../services/companyService";

import styles from "./LeaveCalendar.module.css";

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildMonthGrid(year, month) {
  // month is 0-indexed. Returns a flat array of Date|null, padded so
  // the grid starts on Monday, one entry per calendar cell.
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=Sunday..6=Saturday -> convert to a Monday-first offset.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const cells = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  return cells;
}

export default function LeaveCalendar() {
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
      } catch (err) {
        console.error("Failed to load companies:", err);
      } finally {
        setCompaniesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = companies.map((c) => ({ value: c._id, label: c.name || t("employees.company.unnamed") }));

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedCompanyId) { setAbsences([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const from = toIsoDate(new Date(viewYear, viewMonth, 1));
        const to = toIsoDate(new Date(viewYear, viewMonth + 1, 0));
        const data = await getLeaveCalendar(selectedCompanyId, from, to);
        if (!cancelled) setAbsences(data || []);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("leaveCalendar.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, viewYear, viewMonth, t]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const goToToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  const employeeName = (emp) => `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() || "—";

  // Which employees are on leave for a given day (inclusive range check).
  const absencesForDay = (date) => {
    if (!date) return [];
    const dayTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return absences.filter((a) => {
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      return dayTime >= startDay && dayTime <= endDay;
    });
  };

  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekdayLabels = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`leaveCalendar.weekdays.${i}`));
  const isToday = (date) => date && date.toDateString() === today.toDateString();

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("leaveCalendar.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("leaveCalendar.breadcrumbs.leaveCalendar") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <CalendarDays size={20} />
            <h1>{t("leaveCalendar.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("leaveCalendar.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions} disabled={companiesLoading} />
        </div>

        <div className={styles.monthNav}>
          <button type="button" className="tableActionBtn" onClick={goToPrevMonth} aria-label={t("leaveCalendar.previousMonth")}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className={styles.monthLabel} onClick={goToToday}>
            {monthLabel}
          </button>
          <button type="button" className="tableActionBtn" onClick={goToNextMonth} aria-label={t("leaveCalendar.nextMonth")}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}

      {loading ? (
        <p className={styles.loadingText}>{t("common.loading")}</p>
      ) : (
        <div className={styles.calendar}>
          <div className={styles.weekdayRow}>
            {weekdayLabels.map((label) => (
              <div key={label} className={styles.weekdayCell}>{label}</div>
            ))}
          </div>
          <div className={styles.grid}>
            {cells.map((date, i) => {
              const dayAbsences = absencesForDay(date);
              return (
                <div key={i} className={`${styles.dayCell} ${!date ? styles.dayCellEmpty : ""} ${isToday(date) ? styles.dayCellToday : ""}`}>
                  {date && (
                    <>
                      <span className={styles.dayNumber}>{date.getDate()}</span>
                      <div className={styles.dayAbsences}>
                        {dayAbsences.slice(0, 3).map((a) => (
                          <span key={a._id} className={styles.absenceChip} title={employeeName(a.employee)}>
                            {employeeName(a.employee)}
                          </span>
                        ))}
                        {dayAbsences.length > 3 && (
                          <span className={styles.moreChip}>+{dayAbsences.length - 3}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
