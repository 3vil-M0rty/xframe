import { useEffect, useState } from "react";
import { Clock, BriefcaseBusiness, Save, Plus, Star, Trash2, Check } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import ActionModal from "../../components/useful/ActionModal";

import {
  getWorkSchedules, createWorkSchedule, saveWorkSchedule, setDefaultWorkSchedule, assignWorkScheduleDepartments, deleteWorkSchedule,
} from "../../services/workScheduleService";
import { getCompanies } from "../../services/companyService";

import styles from "./WorkSchedule.module.css";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function WorkSchedule() {
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

  // Several named schedules per company; the one being edited is `schedule`.
  const [list, setList] = useState({ schedules: [], departments: [] });
  const [selectedId, setSelectedId] = useState("");
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ open: false, type: "success", title: "", message: "" });
  const [creating, setCreating] = useState(null); // { name, copy }

  const applyList = (data, keepId) => {
    setList(data);
    const target = data.schedules.find((x) => x._id === keepId) || data.schedules.find((x) => x.isDefault) || data.schedules[0];
    setSelectedId(target?._id || "");
    setSchedule(target ? JSON.parse(JSON.stringify(target)) : null);
  };
  const fail = (error, fallback) => setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t(fallback) });

  useEffect(() => {
    if (!selectedCompanyId) { setSchedule(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getWorkSchedules(selectedCompanyId);
        if (!cancelled) applyList(data, null);
      } catch (error) {
        console.error("Failed to load work schedules:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  const pick = (id) => {
    const target = list.schedules.find((x) => x._id === id);
    setSelectedId(id);
    setSchedule(target ? JSON.parse(JSON.stringify(target)) : null);
  };
  const create = async (e) => {
    e.preventDefault();
    try {
      const made = await createWorkSchedule(selectedCompanyId, creating.name, creating.copy ? selectedId : undefined);
      setCreating(null);
      applyList(await getWorkSchedules(selectedCompanyId), made._id);
    } catch (error) { fail(error, "workSchedule.saveFailed"); }
  };
  const makeDefault = async () => {
    try { applyList(await setDefaultWorkSchedule(selectedId), selectedId); } catch (error) { fail(error, "workSchedule.saveFailed"); }
  };
  const remove = async () => {
    if (!window.confirm(t("wsMulti.deleteConfirm").replace("{name}", schedule?.name || ""))) return;
    try { applyList(await deleteWorkSchedule(selectedId), null); } catch (error) { fail(error, "workSchedule.saveFailed"); }
  };
  // Departments following this schedule (the default one: those without a schedule of their own).
  const followers = (sch) => list.departments.filter((d) => (sch?.isDefault ? !d.workSchedule : d.workSchedule === sch?._id));
  const toggleDepartment = async (dep) => {
    const current = followers(schedule).map((d) => d._id);
    const on = current.includes(dep._id);
    if (on && schedule.isDefault) return; // leaves the default only by joining another schedule
    const next = on ? current.filter((id) => id !== dep._id) : [...current, dep._id];
    try { applyList(await assignWorkScheduleDepartments(selectedId, schedule.isDefault ? [dep._id] : next), selectedId); } catch (error) { fail(error, "workSchedule.saveFailed"); }
  };
  const scheduleName = (id) => list.schedules.find((x) => x._id === id)?.name;

  const updateDay = (day, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  // ---- time helpers (mirror backend services/attendanceCalc.js) ----
  const toHHMM = (h, m) => `${String(h ?? 0).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
  const parseHHMM = (value) => {
    const [h, m] = String(value || "00:00").split(":").map(Number);
    return { hour: h || 0, minute: m || 0 };
  };
  const minutesOf = (h, m) => (Number(h) || 0) * 60 + (Number(m) || 0);

  // End time for display: schedules saved before end times existed
  // only have start + workHours, so derive it the same way the
  // backend does. Saving writes a real end time from then on.
  const endOf = (config) => {
    if (config.endHour !== null && config.endHour !== undefined) return { hour: config.endHour, minute: config.endMinute ?? 0 };
    const breakLength = config.splitShift
      ? minutesOf(config.breakEndHour ?? 14, config.breakEndMinute) - minutesOf(config.breakStartHour ?? 12, config.breakStartMinute)
      : 0;
    const total = minutesOf(config.startHour ?? 9, config.startMinute) + Math.round((config.workHours ?? 8) * 60) + breakLength;
    return { hour: Math.floor(total / 60) % 24, minute: total % 60 };
  };

  const scheduledMinutes = (config) => {
    const start = minutesOf(config.startHour ?? 9, config.startMinute);
    const end = minutesOf(endOf(config).hour, endOf(config).minute);
    const breakLength = config.splitShift
      ? minutesOf(config.breakEndHour ?? 14, config.breakEndMinute) - minutesOf(config.breakStartHour ?? 12, config.breakStartMinute)
      : 0;
    return end - start - breakLength;
  };

  const isDayValid = (config) => {
    if (!config.isWorkingDay) return true;
    const start = minutesOf(config.startHour ?? 9, config.startMinute);
    const end = minutesOf(endOf(config).hour, endOf(config).minute);
    if (!config.splitShift) return end > start;
    const bs = minutesOf(config.breakStartHour ?? 12, config.breakStartMinute);
    const be = minutesOf(config.breakEndHour ?? 14, config.breakEndMinute);
    return start < bs && bs < be && be < end;
  };

  const formatDuration = (mins) => {
    if (mins <= 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  };

  // Writes an HH:MM value into the day's hour/minute pair of fields.
  const updateTime = (day, hourField, minuteField, value) => {
    const { hour, minute } = parseHHMM(value);
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], [hourField]: hour, [minuteField]: minute } }));
  };

  // Split or continuous applies to every day at once; each day can then
  // be switched on its own (e.g. a Saturday half day in a split schedule).
  const isSplitSchedule = DAY_ORDER.some((day) => schedule?.[day]?.splitShift);
  const setDaySplit = (day, split) => {
    setSchedule((prev) => {
      const cfg = { ...prev[day] };
      const end = endOf(cfg);
      cfg.endHour = end.hour;
      cfg.endMinute = end.minute;
      cfg.splitShift = split;
      if (split) {
        cfg.breakStartHour = cfg.breakStartHour ?? 12;
        cfg.breakStartMinute = cfg.breakStartMinute ?? 0;
        cfg.breakEndHour = cfg.breakEndHour ?? 14;
        cfg.breakEndMinute = cfg.breakEndMinute ?? 0;
      }
      return { ...prev, [day]: cfg };
    });
  };
  const setShiftType = (split) => {
    setSchedule((prev) => {
      const next = { ...prev };
      for (const day of DAY_ORDER) {
        const cfg = { ...prev[day] };
        // Pin the current end time before switching, so it doesn't
        // shift when the break length starts/stops counting.
        const end = endOf(cfg);
        cfg.endHour = end.hour;
        cfg.endMinute = end.minute;
        cfg.splitShift = split;
        if (split) {
          cfg.breakStartHour = cfg.breakStartHour ?? 12;
          cfg.breakStartMinute = cfg.breakStartMinute ?? 0;
          cfg.breakEndHour = cfg.breakEndHour ?? 14;
          cfg.breakEndMinute = cfg.breakEndMinute ?? 0;
        }
        next[day] = cfg;
      }
      return next;
    });
  };

  // Copies one day's times onto every working day.
  const applyToWorkingDays = (sourceDay) => {
    setSchedule((prev) => {
      const src = prev[sourceDay];
      const end = endOf(src);
      const next = { ...prev };
      for (const day of DAY_ORDER) {
        if (!prev[day]?.isWorkingDay || day === sourceDay) continue;
        next[day] = {
          ...prev[day],
          startHour: src.startHour, startMinute: src.startMinute,
          endHour: end.hour, endMinute: end.minute,
          splitShift: src.splitShift,
          breakStartHour: src.breakStartHour, breakStartMinute: src.breakStartMinute,
          breakEndHour: src.breakEndHour, breakEndMinute: src.breakEndMinute,
          graceMinutes: src.graceMinutes,
        };
      }
      return next;
    });
  };

  const updateHoursManagement = (field, value) => {
    setSchedule((prev) => ({
      ...prev,
      hoursManagement: { ...prev.hoursManagement, [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      const invalidDay = DAY_ORDER.find((day) => !isDayValid(schedule[day] || {}));
      if (invalidDay) {
        setModal({
          open: true,
          type: "error",
          title: t("common.fail"),
          message: `${t(`workSchedule.days.${invalidDay}`)}: ${t("workSchedule.invalidTimes")}`,
        });
        return;
      }
      const days = {};
      for (const day of DAY_ORDER) {
        const cfg = { ...schedule[day] };
        const end = endOf(cfg);
        days[day] = { ...cfg, endHour: end.hour, endMinute: end.minute };
      }
      const updated = await saveWorkSchedule(selectedId, { ...days, name: schedule.name, hoursManagement: schedule.hoursManagement });
      setList((prev) => ({ ...prev, schedules: prev.schedules.map((x) => (x._id === updated._id ? updated : x)) }));
      setSchedule(JSON.parse(JSON.stringify(updated)));
      setModal({
        open: true,
        type: "success",
        title: t("workSchedule.savedTitle"),
        message: t("workSchedule.savedMessage"),
      });
    } catch (error) {
      setModal({
        open: true,
        type: "error",
        title: t("common.fail"),
        message: error.response?.data?.message || t("workSchedule.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.organization"), href: "/organization/company" }, { label: t("workSchedule.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Clock size={20} />
            <h1>{t("workSchedule.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("workSchedule.subtitle")}</p>
        </div>

        {selectedCompanyId && schedule && (
          <div className="pageHeaderActions">
            <button type="button" className="btnPrimary" disabled={saving} onClick={handleSave}>
              <Save size={16} />
              {saving ? t("payroll.buttons.saving") : t("common.update")}
            </button>
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading} />
        </div>
      </div>

      {selectedCompanyId && !loading && (
        <div className={styles.schedulesBar}>
          {list.schedules.map((x) => (
            <button key={x._id} type="button" onClick={() => pick(x._id)}
              className={`${styles.scheduleChip} ${x._id === selectedId ? styles.scheduleChipActive : ""}`}>
              {x.isDefault && <Star size={12} />} {x.name}
              <span className={styles.scheduleCount}>{followers(x).length}</span>
            </button>
          ))}
          {creating ? (
            <form className={styles.createForm} onSubmit={create}>
              <input autoFocus required value={creating.name} placeholder={t("wsMulti.namePlaceholder")} onChange={(e) => setCreating({ ...creating, name: e.target.value })} />
              <label className={styles.copyCheck}><input type="checkbox" checked={creating.copy} onChange={(e) => setCreating({ ...creating, copy: e.target.checked })} /> {t("wsMulti.copyCurrent")}</label>
              <button type="submit" className="btnPrimary"><Check size={14} /> {t("common.create")}</button>
              <button type="button" className="btnCancel" onClick={() => setCreating(null)}>{t("common.cancel")}</button>
            </form>
          ) : (
            <button type="button" className="btnEdit" onClick={() => setCreating({ name: "", copy: true })}><Plus size={14} /> {t("wsMulti.new")}</button>
          )}
        </div>
      )}

      {selectedCompanyId && !loading && schedule && (
        <div className={styles.scheduleHeader}>
          <div className={styles.scheduleNameRow}>
            <label className={styles.nameField}>
              <span>{t("wsMulti.name")}</span>
              <input value={schedule.name || ""} onChange={(e) => setSchedule({ ...schedule, name: e.target.value })} />
            </label>
            {schedule.isDefault
              ? <span className={styles.defaultTag}><Star size={12} /> {t("wsMulti.default")}</span>
              : <>
                <button type="button" className="btnEdit" onClick={makeDefault}><Star size={14} /> {t("wsMulti.makeDefault")}</button>
                <button type="button" className="btnDelete" onClick={remove} title={t("common.delete")}><Trash2 size={14} /></button>
              </>}
          </div>
          <div className={styles.departmentsRow}>
            <span className={styles.departmentsLabel}>{t("wsMulti.departments")}</span>
            {list.departments.length === 0 && <span className={styles.muted}>{t("wsMulti.noDepartments")}</span>}
            {list.departments.map((d) => {
              const on = followers(schedule).some((x) => x._id === d._id);
              const elsewhere = !on && (d.workSchedule ? scheduleName(d.workSchedule) : list.schedules.find((x) => x.isDefault)?.name);
              return (
                <button key={d._id} type="button" onClick={() => toggleDepartment(d)}
                  className={`${styles.depChip} ${on ? styles.depChipOn : ""}`}
                  title={on && schedule.isDefault ? t("wsMulti.leaveDefaultHint") : elsewhere ? t("wsMulti.currently").replace("{name}", elsewhere) : ""}>
                  {on && <Check size={12} />} {d.name}{elsewhere ? <small> · {elsewhere}</small> : null}
                </button>
              );
            })}
          </div>
          <p className={styles.muted}>{schedule.isDefault ? t("wsMulti.defaultHint") : t("wsMulti.assignHint")}</p>
        </div>
      )}

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {selectedCompanyId && !loading && schedule && (
        <div className={styles.daysTable}>
          {/* Company-wide shift type: one continuous shift (e.g. 09:00-16:00)
              or a split shift with a midday break (e.g. 08:00-12:00 /
              14:00-18:00, i.e. two clock-ins and two clock-outs). */}
          <div className={styles.shiftTypeBar}>
            <span className={styles.shiftTypeLabel}>{t("workSchedule.shiftType")}</span>
            <div className={styles.segmented} role="radiogroup">
              <button type="button" role="radio" aria-checked={!isSplitSchedule}
                className={!isSplitSchedule ? styles.segmentActive : styles.segment}
                onClick={() => setShiftType(false)}>
                {t("workSchedule.continuous")}
              </button>
              <button type="button" role="radio" aria-checked={isSplitSchedule}
                className={isSplitSchedule ? styles.segmentActive : styles.segment}
                onClick={() => setShiftType(true)}>
                {t("workSchedule.split")}
              </button>
            </div>
            <span className={styles.shiftTypeHint}>
              {isSplitSchedule ? t("workSchedule.splitHint") : t("workSchedule.continuousHint")}
            </span>
          </div>

          {(() => {
            const columns = isSplitSchedule
              ? "1fr 1fr 0.7fr 0.9fr 0.9fr 0.9fr 0.9fr 0.8fr 0.7fr"
              : "1fr 1fr 1fr 1fr 0.8fr 0.7fr";
            return (
              <>
                <div className={styles.daysHead} style={{ "--day-columns": columns }}>
                  <span>{t("workSchedule.fields.day")}</span>
                  <span>{t("workSchedule.fields.workingDay")}</span>
                  {isSplitSchedule && <span>{t("wsMulti.splitDay")}</span>}
                  <span>{t("workSchedule.morningIn")}</span>
                  {isSplitSchedule && <span>{t("workSchedule.middayOut")}</span>}
                  {isSplitSchedule && <span>{t("workSchedule.middayIn")}</span>}
                  <span>{t("workSchedule.finalOut")}</span>
                  <span>{t("workSchedule.fields.grace")}</span>
                  <span>{t("workSchedule.scheduledHours")}</span>
                </div>

                {DAY_ORDER.map((day) => {
                  const config = schedule[day] || {};
                  const off = !config.isWorkingDay;
                  const end = endOf(config);
                  const valid = isDayValid(config);
                  return (
                    <div key={day} className={styles.dayRow} data-disabled={off} data-invalid={!valid}
                      style={{ "--day-columns": columns }}>
                      <span className={styles.dayName}>
                        {t(`workSchedule.days.${day}`)}
                        {!off && (
                          <button type="button" className={styles.applyAll} onClick={() => applyToWorkingDays(day)}
                            title={t("workSchedule.applyToAll")}>
                            {t("workSchedule.applyToAllShort")}
                          </button>
                        )}
                      </span>

                      <label className={styles.toggle}>
                        <input type="checkbox" className="switchToggle" checked={!!config.isWorkingDay}
                          onChange={(e) => updateDay(day, "isWorkingDay", e.target.checked)} />
                        <span>{config.isWorkingDay ? t("workSchedule.working") : t("workSchedule.dayOff")}</span>
                      </label>

                      {isSplitSchedule && (
                        <label className={styles.toggle} title={t("wsMulti.splitDayHint")}>
                          <input type="checkbox" disabled={off} checked={!!config.splitShift} onChange={(e) => setDaySplit(day, e.target.checked)} />
                          <span>{config.splitShift ? t("wsMulti.splitOn") : t("wsMulti.splitOff")}</span>
                        </label>
                      )}

                      <input type="time" step={300} className={styles.timeInput} disabled={off}
                        value={toHHMM(config.startHour ?? 9, config.startMinute)}
                        onChange={(e) => updateTime(day, "startHour", "startMinute", e.target.value)} />

                      {isSplitSchedule && (config.splitShift ? (
                        <input type="time" step={300} className={styles.timeInput} disabled={off}
                          value={toHHMM(config.breakStartHour ?? 12, config.breakStartMinute)}
                          onChange={(e) => updateTime(day, "breakStartHour", "breakStartMinute", e.target.value)} />
                      ) : <span className={styles.muted}>—</span>)}
                      {isSplitSchedule && (config.splitShift ? (
                        <input type="time" step={300} className={styles.timeInput} disabled={off}
                          value={toHHMM(config.breakEndHour ?? 14, config.breakEndMinute)}
                          onChange={(e) => updateTime(day, "breakEndHour", "breakEndMinute", e.target.value)} />
                      ) : <span className={styles.muted}>—</span>)}

                      <input type="time" step={300} className={styles.timeInput} disabled={off}
                        value={toHHMM(end.hour, end.minute)}
                        onChange={(e) => updateTime(day, "endHour", "endMinute", e.target.value)} />

                      <div className={styles.hoursInput}>
                        <input type="number" min={0} max={180} step={5} className={styles.numberInput}
                          value={config.graceMinutes ?? 10} disabled={off}
                          onChange={(e) => updateDay(day, "graceMinutes", Number(e.target.value))} />
                        <span>{t("workSchedule.minutesUnit")}</span>
                      </div>

                      <span className={valid ? styles.hoursValue : styles.hoursInvalid}>
                        {off ? "—" : valid ? formatDuration(scheduledMinutes(config)) : t("workSchedule.invalidShort")}
                      </span>
                    </div>
                  );
                })}
              </>
            );
          })()}

          <p className={styles.footnote}>{t("workSchedule.footnote")}</p>
        </div>
      )}

      {selectedCompanyId && !loading && schedule && (
        <div className={styles.hoursManagement}>
          <h2>{t("workSchedule.hoursManagement.title")}</h2>
          <p className={styles.hoursManagementSubtitle}>{t("workSchedule.hoursManagement.subtitle")}</p>

          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>{t("workSchedule.hoursManagement.payOvertime")}</span>
              <span className={styles.toggleHint}>{t("workSchedule.hoursManagement.payOvertimeHint")}</span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={!!schedule.hoursManagement?.payOvertime}
                onChange={(e) => updateHoursManagement("payOvertime", e.target.checked)}
              />
              <span className={styles.slider} />
            </label>
            {schedule.hoursManagement?.payOvertime && (
              <div className={styles.rateInput}>
                <input
                  type="number" min={1} step={0.05} className={styles.numberInput}
                  value={schedule.hoursManagement?.overtimeRate ?? 1.25}
                  onChange={(e) => updateHoursManagement("overtimeRate", Number(e.target.value))}
                />
                <span>{t("workSchedule.hoursManagement.rateSuffix")}</span>
              </div>
            )}
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>{t("workSchedule.hoursManagement.deductLateArrival")}</span>
              <span className={styles.toggleHint}>{t("workSchedule.hoursManagement.deductLateArrivalHint")}</span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={!!schedule.hoursManagement?.deductLateArrival}
                onChange={(e) => updateHoursManagement("deductLateArrival", e.target.checked)}
              />
              <span className={styles.slider} />
            </label>
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>{t("workSchedule.hoursManagement.deductEarlyLeave")}</span>
              <span className={styles.toggleHint}>{t("workSchedule.hoursManagement.deductEarlyLeaveHint")}</span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={!!schedule.hoursManagement?.deductEarlyLeave}
                onChange={(e) => updateHoursManagement("deductEarlyLeave", e.target.checked)}
              />
              <span className={styles.slider} />
            </label>
          </div>

          {(schedule.hoursManagement?.deductLateArrival || schedule.hoursManagement?.deductEarlyLeave) && (
            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>{t("workSchedule.hoursManagement.deductionRate")}</span>
                <span className={styles.toggleHint}>{t("workSchedule.hoursManagement.deductionRateHint")}</span>
              </div>
              <div className={styles.rateInput}>
                <input
                  type="number" min={0} step={0.05} className={styles.numberInput}
                  value={schedule.hoursManagement?.deductionRate ?? 1}
                  onChange={(e) => updateHoursManagement("deductionRate", Number(e.target.value))}
                />
                <span>{t("workSchedule.hoursManagement.rateSuffix")}</span>
              </div>
            </div>
          )}

          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>{t("workSchedule.hoursManagement.monthlyStandardHours")}</span>
              <span className={styles.toggleHint}>{t("workSchedule.hoursManagement.monthlyStandardHoursHint")}</span>
            </div>
            <div className={styles.rateInput}>
              <input
                type="number" min={1} step={1} className={styles.numberInput}
                value={schedule.hoursManagement?.monthlyStandardHours ?? 191}
                onChange={(e) => updateHoursManagement("monthlyStandardHours", Number(e.target.value))}
              />
              <span>{t("workSchedule.hoursUnit")}</span>
            </div>
          </div>
        </div>
      )}

      <ActionModal
        isOpen={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
