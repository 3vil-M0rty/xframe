import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, Download, Pencil, AlertTriangle, Check } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import { canManageCompanySettings } from "../../utils/permissions";

import { getCompanies, updateCompanySettings } from "../../services/companyService";
import { getLeaveBalances, setLeaveOpeningBalance, downloadLeaveBalances } from "../../services/declarationService";

import styles from "./LeaveBalances.module.css";

const COLUMNS = "1.7fr 0.9fr 0.8fr 0.9fr 0.9fr 0.8fr 0.8fr 0.9fr 44px";

/**
 * Paid-leave balances for every employee, per the labour code:
 * 1.5 days/month (2 under 18), +1.5 days per 5 years of service,
 * 30 days/year max — plus days the company grants on top.
 * HR enters each employee's opening balance once, when the company
 * starts using the app.
 */
export default function LeaveBalances() {
  const { t, language } = useI18n();
  const { user } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editing, setEditing] = useState(null); // employee id
  const [form, setForm] = useState({ days: "", asOf: "", note: "" });
  const [extraDays, setExtraDays] = useState("0");

  const fmt = (n) => (Number(n) || 0).toLocaleString(language || undefined, { maximumFractionDigits: 2 });
  const date = (d) => (d ? new Date(d).toLocaleDateString(language || undefined) : "—");
  const errMsg = (err, key) => err.response?.data?.message || t(key);

  useEffect(() => {
    (async () => {
      try {
        const list = await getCompanies();
        setCompanies(Array.isArray(list) ? list : []);
        if (list?.length) setCompanyId(list[0]._id);
        else setLoading(false);
      } catch (err) {
        setError(errMsg(err, "leaveBalances.errors.load"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setError("");
      const { rows: data, rules } = await getLeaveBalances(companyId);
      setRows(data);
      setExtraDays(String(rules.extraLeaveDaysPerYear || 0));
    } catch (err) {
      setError(errMsg(err, "leaveBalances.errors.load"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const openEdit = ({ employee, balance }) => {
    setEditing(employee._id);
    setForm({
      days: balance.openingBalance ? String(balance.openingBalance.days) : "",
      asOf: balance.openingBalance ? String(balance.openingBalance.asOf).slice(0, 10) : new Date().toISOString().slice(0, 10),
      note: "",
    });
  };

  const saveOpening = async (e, clear = false) => {
    e?.preventDefault();
    setError("");
    try {
      await setLeaveOpeningBalance(editing, clear ? { clear: true } : { days: Number(form.days), asOf: form.asOf, note: form.note });
      setEditing(null);
      setNotice(t("leaveBalances.saved"));
      await load();
    } catch (err) {
      setError(errMsg(err, "leaveBalances.errors.save"));
    }
  };

  const saveExtraDays = async () => {
    setError("");
    try {
      await updateCompanySettings(companyId, { extraLeaveDaysPerYear: Number(extraDays) || 0 });
      setNotice(t("leaveBalances.policySaved"));
      await load();
    } catch (err) {
      setError(errMsg(err, "leaveBalances.errors.save"));
    }
  };

  const handleExport = async () => {
    try {
      await downloadLeaveBalances(companyId);
    } catch (err) {
      setError(errMsg(err, "leaveBalances.errors.load"));
    }
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.hr"), href: "/hr/employees" }, { label: t("leaveBalances.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <CalendarCheck2 size={20} />
            <h1>{t("leaveBalances.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("leaveBalances.subtitle")}</p>
        </div>
        {companyId && (
          <button type="button" className="btnEdit" onClick={handleExport}>
            <Download size={15} /> Excel
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companies.map((c) => ({ value: c._id, label: c.name }))} />
        </div>
        {canManageCompanySettings(user) && companyId && (
          <div className={styles.policy}>
            <label>{t("leaveBalances.extraDays")}</label>
            <div className={styles.policyRow}>
              <input type="number" min="0" max="30" step="0.5" value={extraDays} onChange={(e) => setExtraDays(e.target.value)} />
              <button type="button" className="btnEdit" onClick={saveExtraDays}>{t("common.save")}</button>
            </div>
          </div>
        )}
      </div>

      <p className={styles.hint}>{t("leaveBalances.rules")}</p>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.notice}><Check size={15} /> {notice}</div>}

      {loading && <p className={styles.hint}>{t("common.loading")}</p>}

      {!loading && rows.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><CalendarCheck2 size={28} /></div>
          <h2>{t("leaveBalances.emptyTitle")}</h2>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: COLUMNS }}>
            <span>{t("leaveBalances.columns.employee")}</span>
            <span>{t("leaveBalances.columns.hired")}</span>
            <span>{t("leaveBalances.columns.perYear")}</span>
            <span>{t("leaveBalances.columns.opening")}</span>
            <span>{t("leaveBalances.columns.accrued")}</span>
            <span>{t("leaveBalances.columns.taken")}</span>
            <span>{t("leaveBalances.columns.thisYear")}</span>
            <span>{t("leaveBalances.columns.remaining")}</span>
            <span />
          </div>
          {rows.map((row) => {
            const { employee: e, balance: b } = row;
            return (
              <div key={e._id}>
                <div className="dataTableRow" style={{ gridTemplateColumns: COLUMNS }}>
                  <span>
                    <strong>{e.lastName} {e.firstName}</strong>
                    <small className={styles.muted}> {e.jobTitle || ""}</small>
                  </span>
                  <span className="dataTableCellMuted">
                    {date(e.hireDate)}
                    {b.seniorityYears > 0 && <small className={styles.muted}> · {t("leaveBalances.years").replace("{n}", b.seniorityYears)}</small>}
                  </span>
                  <span title={b.seniorityBonusDays ? t("leaveBalances.bonusHint").replace("{n}", fmt(b.seniorityBonusDays)) : undefined}>
                    {fmt(b.annualEntitlement)}{b.seniorityBonusDays > 0 && <small className={styles.bonus}> +{fmt(b.seniorityBonusDays)}</small>}
                    {b.isMinor && <small className={styles.muted}> ({t("leaveBalances.minor")})</small>}
                  </span>
                  <span className="dataTableCellMuted">{b.openingBalance ? `${fmt(b.openingBalance.days)} · ${date(b.openingBalance.asOf)}` : "—"}</span>
                  <span>{fmt(b.accruedDays)}</span>
                  <span className="dataTableCellMuted">{fmt(b.usedDays)}</span>
                  <span className="dataTableCellMuted">{fmt(b.takenThisYear)}</span>
                  <span>
                    <strong className={b.remainingDays < 0 ? styles.negative : ""}>{fmt(b.remainingDays)}</strong>
                    {(b.excessCarryOver || b.missingHireDate) && (
                      <span className={styles.alert} title={t(b.missingHireDate ? "leaveBalances.missingHireDate" : "leaveBalances.carryOverHint")}>
                        <AlertTriangle size={13} />
                      </span>
                    )}
                  </span>
                  <span className="dataTableActions">
                    <button type="button" className="tableActionBtn" title={t("leaveBalances.editOpening")} onClick={() => openEdit(row)}>
                      <Pencil size={14} />
                    </button>
                  </span>
                </div>
                {editing === e._id && (
                  <form className={styles.editRow} onSubmit={saveOpening}>
                    <p className={styles.hint}>{t("leaveBalances.openingHint")}</p>
                    <div className={styles.editFields}>
                      <label>
                        {t("leaveBalances.openingDays")}
                        <input type="number" step="0.5" required value={form.days} onChange={(ev) => setForm({ ...form, days: ev.target.value })} />
                      </label>
                      <label>
                        {t("leaveBalances.openingDate")}
                        <input type="date" required value={form.asOf} onChange={(ev) => setForm({ ...form, asOf: ev.target.value })} />
                      </label>
                      <label className={styles.noteField}>
                        {t("leaveBalances.note")}
                        <input value={form.note} onChange={(ev) => setForm({ ...form, note: ev.target.value })} />
                      </label>
                    </div>
                    <div className={styles.editActions}>
                      {b.openingBalance && (
                        <button type="button" className="btnDelete" onClick={(ev) => saveOpening(ev, true)}>{t("leaveBalances.clearOpening")}</button>
                      )}
                      <button type="button" className="btnCancel" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
                      <button type="submit" className="btnPrimary">{t("common.save")}</button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
