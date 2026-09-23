import { useEffect, useRef, useState } from "react";
import { CalendarHeart, Download, Upload, Plus, Trash2, AlertTriangle, Check } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import ActionModal from "../../components/useful/ActionModal";

import { getCompanies } from "../../services/companyService";
import {
  getHolidays,
  downloadHolidayTemplate,
  previewHolidayImport,
  commitHolidayImport,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from "../../services/holidayService";

import styles from "./Holidays.module.css";

/**
 * Public holidays (jours fériés). Each year HR downloads the template
 * (fixed-date holidays pre-filled), adds the religious holidays with
 * their announced dates, and imports it. Per holiday: is the company
 * open, and are hours worked that day paid double or normal.
 */
export default function Holidays() {
  const { t, language } = useI18n();
  const currentYear = new Date().getFullYear();

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [year, setYear] = useState(currentYear);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState(null);

  // import flow
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null); // { rows, errorCount, fileName }
  const [importing, setImporting] = useState(false);

  // manual add
  const [showAdd, setShowAdd] = useState(false);
  const [newDay, setNewDay] = useState("");
  const [newName, setNewName] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await getCompanies();
        setCompanies(Array.isArray(list) ? list : []);
        if (list?.length) setCompanyId(list[0]._id);
      } catch (err) {
        setError(err.response?.data?.message || t("holidays.errors.load"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = async () => {
    if (!companyId) return;
    setHolidays(await getHolidays(companyId, year));
  };

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getHolidays(companyId, year);
        if (!cancelled) setHolidays(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t("holidays.errors.load"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, year, t]);

  const formatDay = (day) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(language || undefined, {
      weekday: "long", day: "numeric", month: "long",
    });
  };

  // ---------- per-holiday settings ----------
  const patchHoliday = async (holiday, changes) => {
    setSavingId(holiday._id);
    setError("");
    const previous = holidays;
    setHolidays((list) => list.map((h) => (h._id === holiday._id ? { ...h, ...changes } : h))); // optimistic
    try {
      await updateHoliday(holiday._id, changes);
    } catch (err) {
      setHolidays(previous);
      setError(err.response?.data?.message || t("holidays.errors.save"));
    } finally {
      setSavingId(null);
    }
  };

  // ---------- template ----------
  const handleTemplate = async () => {
    setError("");
    try {
      await downloadHolidayTemplate(year);
    } catch (err) {
      setError(err.response?.data?.message || t("holidays.errors.template"));
    }
  };

  // ---------- import ----------
  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again after fixing it
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const result = await previewHolidayImport(companyId, file);
      setPreview({ ...result, fileName: file.name });
    } catch (err) {
      setError(err.response?.data?.message || t("holidays.errors.read"));
    }
  };

  const handleCommit = async () => {
    if (!preview || preview.errorCount > 0) return;
    setImporting(true);
    setError("");
    try {
      const { created, updated } = await commitHolidayImport(companyId, preview.rows);
      setPreview(null);
      setNotice(t("holidays.importDone").replace("{created}", created).replace("{updated}", updated));
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || t("holidays.errors.import"));
    } finally {
      setImporting(false);
    }
  };

  // ---------- manual add / delete ----------
  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createHoliday({ companyId, day: newDay, name: newName });
      setShowAdd(false);
      setNewDay("");
      setNewName("");
      if (Number(newDay.slice(0, 4)) !== year) setYear(Number(newDay.slice(0, 4)));
      else await reload();
    } catch (err) {
      setError(err.response?.data?.message || t("holidays.errors.save"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteHoliday(deleteTarget._id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setDeleteTarget(null);
      setError(err.response?.data?.message || t("holidays.errors.save"));
    }
  };

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1].map((y) => ({ value: String(y), label: String(y) }));
  const payOptions = [
    { value: "2", label: t("holidays.payDouble") },
    { value: "1", label: t("holidays.payNormal") },
  ];

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.hr"), href: "/hr/employees" }, { label: t("holidays.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <CalendarHeart size={20} />
            <h1>{t("holidays.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("holidays.subtitle")}</p>
        </div>
        {companyId && (
          <div className={styles.headerActions}>
            <button type="button" className="btnEdit" onClick={handleTemplate}>
              <Download size={15} /> {t("holidays.downloadTemplate")}
            </button>
            <button type="button" className="btnEdit" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} /> {t("holidays.import")}
            </button>
            <button type="button" className="btnPrimary" onClick={() => setShowAdd((v) => !v)}>
              <Plus size={15} /> {t("holidays.add")}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv" hidden onChange={handleFileChosen} />
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId}
            options={companies.map((c) => ({ value: c._id, label: c.name }))} />
        </div>
        <div className="filterGroup">
          <label>{t("holidays.year")}</label>
          <CustomSelect value={String(year)} onSelect={(v) => setYear(Number(v))} options={yearOptions} />
        </div>
      </div>

      <p className={styles.hint}>{t("holidays.howItWorks")}</p>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.notice}><Check size={15} /> {notice}</div>}

      {showAdd && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <input type="date" required value={newDay} onChange={(e) => setNewDay(e.target.value)} className={styles.dateInput} />
          <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder={t("holidays.namePlaceholder")} className={styles.nameInput} />
          <button type="submit" className="btnPrimary">{t("common.save")}</button>
          <button type="button" className="btnCancel" onClick={() => setShowAdd(false)}>{t("common.cancel")}</button>
        </form>
      )}

      {/* ---------- import preview ---------- */}
      {preview && (
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <strong>{t("holidays.previewTitle").replace("{file}", preview.fileName)}</strong>
            <span className={preview.errorCount ? styles.previewBad : styles.previewGood}>
              {preview.errorCount
                ? t("holidays.previewErrors").replace("{count}", preview.errorCount)
                : t("holidays.previewReady").replace("{count}", preview.rows.length)}
            </span>
          </div>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: "60px 1.2fr 1.5fr 1fr 1fr 2fr" }}>
              <span>{t("holidays.columns.row")}</span>
              <span>{t("holidays.columns.date")}</span>
              <span>{t("holidays.columns.name")}</span>
              <span>{t("holidays.columns.open")}</span>
              <span>{t("holidays.columns.pay")}</span>
              <span>{t("holidays.columns.check")}</span>
            </div>
            {preview.rows.map((row) => (
              <div key={row.row} className="dataTableRow" data-error={row.errors.length > 0}
                style={{ gridTemplateColumns: "60px 1.2fr 1.5fr 1fr 1fr 2fr" }}>
                <span className="dataTableCellMuted">{row.row}</span>
                <span>{row.day ? formatDay(row.day) : "—"}</span>
                <span>{row.name || "—"}</span>
                <span className="dataTableCellMuted">
                  {row.isWorkingDay === undefined ? t("holidays.defaultClosed") : row.isWorkingDay ? t("holidays.open") : t("holidays.closed")}
                </span>
                <span className="dataTableCellMuted">
                  {row.payRate === undefined ? t("holidays.defaultDouble") : row.payRate === 2 ? t("holidays.payDouble") : t("holidays.payNormal")}
                </span>
                <span className={row.errors.length ? styles.rowError : styles.rowWarning}>
                  {row.errors.length > 0 && <><AlertTriangle size={13} /> {row.errors.join(" · ")}</>}
                  {row.errors.length === 0 && row.warnings.join(" · ")}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.previewActions}>
            <button type="button" className="btnCancel" onClick={() => setPreview(null)}>{t("common.cancel")}</button>
            <button type="button" className="btnPrimary" disabled={importing || preview.errorCount > 0 || preview.rows.length === 0}
              onClick={handleCommit}>
              {importing ? t("common.loading") : t("holidays.confirmImport")}
            </button>
          </div>
        </div>
      )}

      {/* ---------- the year's holidays ---------- */}
      {loading && <p className={styles.hint}>{t("common.loading")}</p>}

      {!loading && holidays.length === 0 && !preview && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><CalendarHeart size={28} /></div>
          <h2>{t("holidays.emptyTitle").replace("{year}", year)}</h2>
          <p>{t("holidays.emptyMessage")}</p>
        </div>
      )}

      {!loading && holidays.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: "1.3fr 1.6fr 1.3fr 1.2fr 50px" }}>
            <span>{t("holidays.columns.date")}</span>
            <span>{t("holidays.columns.name")}</span>
            <span>{t("holidays.columns.open")}</span>
            <span>{t("holidays.columns.pay")}</span>
            <span />
          </div>
          {holidays.map((h) => (
            <div key={h._id} className="dataTableRow" style={{ gridTemplateColumns: "1.3fr 1.6fr 1.3fr 1.2fr 50px" }}>
              <span className={styles.dateCell}>{formatDay(h.day)}</span>
              <span>{h.name}</span>
              <label className={styles.switchCell}>
                <input type="checkbox" className="switchToggle" checked={!!h.isWorkingDay} disabled={savingId === h._id}
                  onChange={(e) => patchHoliday(h, { isWorkingDay: e.target.checked })} />
                <span>{h.isWorkingDay ? t("holidays.open") : t("holidays.closed")}</span>
              </label>
              <CustomSelect value={String(h.payRate)} options={payOptions}
                onSelect={(v) => patchHoliday(h, { payRate: Number(v) })} />
              <span className="dataTableActions">
                <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")}
                  onClick={() => setDeleteTarget(h)}>
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <ActionModal
        isOpen={!!deleteTarget}
        type="confirm"
        title={t("holidays.deleteTitle")}
        message={deleteTarget ? t("holidays.deleteMessage").replace("{name}", deleteTarget.name) : ""}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
