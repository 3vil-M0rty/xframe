import { useEffect, useState } from "react";
import { Clock, BriefcaseBusiness, Save } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import ActionModal from "../../components/useful/ActionModal";

import { getWorkSchedule, updateWorkSchedule } from "../../services/workScheduleService";
import { getCompanies } from "../../services/companyService";

import styles from "./WorkSchedule.module.css";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function pad(n) {
  return String(n).padStart(2, "0");
}

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

  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ open: false, type: "success", title: "", message: "" });

  useEffect(() => {
    if (!selectedCompanyId) { setSchedule(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getWorkSchedule(selectedCompanyId);
        if (!cancelled) setSchedule(data);
      } catch (error) {
        console.error("Failed to load work schedule:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  const updateDay = (day, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      const days = {};
      for (const day of DAY_ORDER) days[day] = schedule[day];
      const updated = await updateWorkSchedule(selectedCompanyId, days);
      setSchedule(updated);
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
      <Breadcrumbs items={[{ label: t("workSchedule.title") }]} />

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

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {selectedCompanyId && !loading && schedule && (
        <div className={styles.daysTable}>
          <div className={styles.daysHead}>
            <span>{t("workSchedule.fields.day")}</span>
            <span>{t("workSchedule.fields.workingDay")}</span>
            <span>{t("workSchedule.fields.startTime")}</span>
            <span>{t("workSchedule.fields.workHours")}</span>
            <span>{t("workSchedule.fields.grace")}</span>
          </div>

          {DAY_ORDER.map((day) => {
            const config = schedule[day] || {};
            return (
              <div key={day} className={styles.dayRow} data-disabled={!config.isWorkingDay}>
                <span className={styles.dayName}>{t(`workSchedule.days.${day}`)}</span>

                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={!!config.isWorkingDay}
                    onChange={(e) => updateDay(day, "isWorkingDay", e.target.checked)}
                  />
                  <span>{config.isWorkingDay ? t("workSchedule.working") : t("workSchedule.dayOff")}</span>
                </label>

                <div className={styles.timeInputs}>
                  <input
                    type="number" min={0} max={23} className={styles.numberInput}
                    value={config.startHour ?? 9}
                    disabled={!config.isWorkingDay}
                    onChange={(e) => updateDay(day, "startHour", Number(e.target.value))}
                  />
                  <span>:</span>
                  <input
                    type="number" min={0} max={59} step={5} className={styles.numberInput}
                    value={pad(config.startMinute ?? 0)}
                    disabled={!config.isWorkingDay}
                    onChange={(e) => updateDay(day, "startMinute", Number(e.target.value))}
                  />
                </div>

                <div className={styles.hoursInput}>
                  <input
                    type="number" min={0} max={24} step={0.5} className={styles.numberInput}
                    value={config.workHours ?? 8}
                    disabled={!config.isWorkingDay}
                    onChange={(e) => updateDay(day, "workHours", Number(e.target.value))}
                  />
                  <span>{t("workSchedule.hoursUnit")}</span>
                </div>

                <div className={styles.hoursInput}>
                  <input
                    type="number" min={0} max={180} step={5} className={styles.numberInput}
                    value={config.graceMinutes ?? 10}
                    disabled={!config.isWorkingDay}
                    onChange={(e) => updateDay(day, "graceMinutes", Number(e.target.value))}
                  />
                  <span>{t("workSchedule.minutesUnit")}</span>
                </div>
              </div>
            );
          })}

          <p className={styles.footnote}>{t("workSchedule.footnote")}</p>
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
