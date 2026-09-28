import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import { getPlanning } from "../../services/projectService";
import { useCompanyPicker, formatDate } from "../sales/salesShared";
import styles from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";

const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const BAR_CLASS = { todo: "barTodo", in_progress: "barInProgress", done: "barDone", blocked: "barBlocked" };

/**
 * Planning: every active project and its tasks on a timeline (weeks
 * ahead), bars coloured by task status, overdue tasks outlined red,
 * today marked. Unscheduled tasks are listed under their project.
 */
export default function Planning() {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [weeks, setWeeks] = useState(6);
  const [start, setStart] = useState(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); // Monday, one week back
    return d;
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const end = useMemo(() => new Date(start.getTime() + weeks * 7 * DAY - 1), [start, weeks]);
  useEffect(() => {
    if (!companyId) return;
    getPlanning(companyId, start.toISOString(), end.toISOString()).then(setData).catch((err) => setError(err.response?.data?.message || t("projects.errors.load")));
  }, [companyId, start, end, t]);

  const days = useMemo(() => Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getTime() + i * DAY)), [start, weeks]);
  const span = weeks * 7 * DAY;
  const pos = (from, to) => {
    const a = Math.max(startOfDay(from).getTime(), start.getTime());
    const b = Math.min(startOfDay(to).getTime() + DAY, start.getTime() + span);
    if (b <= a) return null;
    return { left: `${((a - start.getTime()) / span) * 100}%`, width: `${((b - a) / span) * 100}%` };
  };
  const today = startOfDay(new Date());
  const todayLeft = today >= start && today <= end ? `${((today - start) / span) * 100}%` : null;
  const shift = (w) => setStart(new Date(start.getTime() + w * 7 * DAY));

  const tasksByProject = useMemo(() => {
    const m = new Map();
    for (const tk of data?.tasks || []) {
      const k = String(tk.project);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(tk);
    }
    return m;
  }, [data]);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/projects" }, { label: t("projects.planning.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><CalendarRange size={20} /><h1>{t("projects.planning.title")}</h1></div>
          <p className="pageSubtitle">{t("projects.planning.subtitle")}</p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <div className="filterGroup">
          <label>{t("projects.planning.range")}</label>
          <CustomSelect value={String(weeks)} onSelect={(v) => setWeeks(Number(v))} options={[4, 6, 8, 12].map((w) => ({ value: String(w), label: t("projects.planning.weeks").replace("{n}", w) }))} />
        </div>
        <div className={s.statusBar} style={{ marginBottom: 0 }}>
          <button type="button" className="btnEdit" onClick={() => shift(-1)}><ChevronLeft size={15} /></button>
          <span className={s.muted}>{formatDate(start)} → {formatDate(end)}</span>
          <button type="button" className="btnEdit" onClick={() => shift(1)}><ChevronRight size={15} /></button>
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}

      <div className={s.legend}>
        {["todo", "in_progress", "done", "blocked"].map((st) => <span key={st}><i className={s[BAR_CLASS[st]]} /> {t(`projects.taskStatuses.${st}`)}</span>)}
        <span><i style={{ background: "#e8b93f", width: 3 }} /> {t("projects.planning.today")}</span>
      </div>

      {data && data.projects.length === 0 && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><CalendarRange size={28} /></div><h2>{t("projects.planning.empty")}</h2></div>
      )}

      {data && data.projects.length > 0 && (
        <div className={s.planning}>
          <div className={s.planningGrid}>
            <div className={s.planningHeader}>
              <div className={s.planningLabel}>{t("projects.title")}</div>
              <div className={s.planningDays}>
                {days.map((d) => (
                  <div key={d.getTime()} className={`${s.planningDay} ${d.getDay() === 0 ? s.planningDayWeekend : ""}`}
                    title={d.toLocaleDateString(language || undefined)}>
                    {weeks <= 6 || d.getDay() === 1 ? d.getDate() : ""}
                  </div>
                ))}
              </div>
            </div>
            {data.projects.map((p) => {
              const tasks = tasksByProject.get(String(p._id)) || [];
              const projectPos = p.startDate || p.dueDate ? pos(p.startDate || p.dueDate, p.dueDate || p.startDate) : null;
              return (
                <div key={p._id}>
                  <div className={`${s.planningRow} ${s.projectRow}`}>
                    <div className={s.planningLabel} role="button" tabIndex={0} style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/production/projects/${p._id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/production/projects/${p._id}`)}>
                      {p.number} — {p.name}
                      <small>{p.customer?.name || ""}{p.dueDate ? ` · ${t("projects.due")} ${formatDate(p.dueDate)}` : ""}</small>
                    </div>
                    <div className={s.planningTrack}>
                      {todayLeft && <span className={s.todayLine} style={{ left: todayLeft }} />}
                      {projectPos && <span className={`${s.planningBar} ${s.projectBar}`} style={projectPos} />}
                    </div>
                  </div>
                  {tasks.map((tk) => {
                    const scheduled = tk.startDate || tk.dueDate;
                    const barPos = scheduled ? pos(tk.startDate || tk.dueDate, tk.dueDate || tk.startDate) : null;
                    const late = tk.dueDate && startOfDay(tk.dueDate) < today && tk.status !== "done";
                    const who = (tk.assignees || []).map((a) => a.firstName).join(", ");
                    return (
                      <div key={tk._id} className={s.planningRow}>
                        <div className={s.planningLabel}>
                          {tk.title}
                          <small>{who || "—"}{!scheduled ? ` · ${t("projects.planning.unscheduled")}` : ""}</small>
                        </div>
                        <div className={s.planningTrack}>
                          {todayLeft && <span className={s.todayLine} style={{ left: todayLeft }} />}
                          {barPos && (
                            <span className={`${s.planningBar} ${s[BAR_CLASS[tk.status]]} ${late ? s.barLate : ""}`} style={barPos}
                              title={`${tk.title} · ${formatDate(tk.startDate)} → ${formatDate(tk.dueDate)} · ${t(`projects.taskStatuses.${tk.status}`)}`}>
                              {tk.title}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
