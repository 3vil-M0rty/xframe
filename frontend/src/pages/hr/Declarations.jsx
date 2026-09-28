import { useEffect, useMemo, useState } from "react";
import { FileCheck2, Upload, Download, AlertTriangle, Check, Info, Landmark, Receipt, FileSpreadsheet, ShieldCheck } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import FileInput from "../../components/useful/FileInput";

import { getCompanies } from "../../services/companyService";
import { getPayrollRuns } from "../../services/payrollService";
import {
  previewDamancom,
  downloadDamancomFile,
  getBankTransfer,
  downloadBankTransfer,
  getMonthlyIr,
  getAnnualIr,
  downloadAnnualIr,
} from "../../services/declarationService";

import styles from "./Declarations.module.css";

const TABS = ["cnss", "bank", "irMonthly", "irAnnual"];
const TAB_ICONS = { cnss: ShieldCheck, bank: Landmark, irMonthly: Receipt, irAnnual: FileSpreadsheet };

function Issues({ problems = [], warnings = [], t }) {
  if (!problems.length && !warnings.length) {
    return <div className={styles.okBox}><Check size={15} /> {t("declarations.noProblem")}</div>;
  }
  return (
    <>
      {problems.length > 0 && (
        <div className={styles.problemBox}>
          <strong><AlertTriangle size={15} /> {t("declarations.problemsTitle").replace("{count}", problems.length)}</strong>
          <ul>{problems.map((p, i) => <li key={i}>{p.message}</li>)}</ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className={styles.warningBox}>
          <strong><Info size={15} /> {t("declarations.warningsTitle")}</strong>
          <ul>{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
        </div>
      )}
    </>
  );
}

/**
 * Payroll declarations: Damancom (CNSS) file, salary bank transfer,
 * IR to pay on Simpl-IR each month, annual salaries declaration.
 */
export default function Declarations() {
  const { t, language } = useI18n();
  const currentYear = new Date().getFullYear();

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState("");
  const [tab, setTab] = useState("cnss");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Damancom
  const [preFile, setPreFile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [situationOptions, setSituationOptions] = useState([]);
  const [situations, setSituations] = useState({});
  // Bank
  const [bank, setBank] = useState(null);
  const [executionDate, setExecutionDate] = useState("");
  // IR
  const [irMonth, setIrMonth] = useState(null);
  const [irYear, setIrYear] = useState(currentYear - (new Date().getMonth() < 3 ? 1 : 0));
  const [irAnnual, setIrAnnual] = useState(null);

  const money = (n) => (Number(n) || 0).toLocaleString(language || undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = (d) => (d ? new Date(d).toLocaleDateString(language || undefined) : "—");
  const errMsg = (err, key) => err.response?.data?.message || t(key);

  useEffect(() => {
    (async () => {
      try {
        const list = await getCompanies();
        setCompanies(Array.isArray(list) ? list : []);
        if (list?.length) setCompanyId(list[0]._id);
      } catch (err) {
        setError(errMsg(err, "declarations.errors.load"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        const { runs: data } = await getPayrollRuns({ companyId, limit: 24 });
        setRuns(data);
        setRunId(data[0]?._id || "");
      } catch (err) {
        setError(errMsg(err, "declarations.errors.load"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const run = useMemo(() => runs.find((r) => r._id === runId), [runs, runId]);

  // Reset per-run state when the run changes.
  useEffect(() => {
    setPlan(null);
    setSituations({});
    setBank(null);
    setIrMonth(null);
    setError("");
  }, [runId]);

  // Load the tab's data when needed.
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      try {
        if (tab === "bank" && !bank) {
          const data = await getBankTransfer(runId);
          if (!cancelled) setBank(data);
        }
        if (tab === "irMonthly" && !irMonth) {
          const data = await getMonthlyIr(runId);
          if (!cancelled) setIrMonth(data);
        }
      } catch (err) {
        if (!cancelled) setError(errMsg(err, "declarations.errors.load"));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, runId, bank, irMonth]);

  useEffect(() => {
    if (tab !== "irAnnual" || !companyId) return;
    let cancelled = false;
    (async () => {
      try {
        setIrAnnual(null);
        const data = await getAnnualIr(companyId, irYear);
        if (!cancelled) setIrAnnual(data);
      } catch (err) {
        if (!cancelled) setError(errMsg(err, "declarations.errors.load"));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyId, irYear]);

  const runLabel = (r) => `${String(r.month).padStart(2, "0")}/${r.year}${r.status !== "completed" ? ` — ${t("declarations.draft")}` : ""}`;

  // ---------- actions ----------
  const doAction = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      const problems = err.response?.data?.problems;
      setError(problems?.length ? problems.map((p) => p.message).join(" · ") : errMsg(err, "declarations.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const readPreetabli = (nextSituations = situations) => doAction(async () => {
    const res = await previewDamancom(runId, preFile, nextSituations);
    setPlan(res.plan);
    setSituationOptions(res.situationOptions);
  });

  const chooseSituation = (cnssNumber, code) => {
    const next = { ...situations, [cnssNumber]: code };
    setSituations(next);
    readPreetabli(next);
  };

  const situationSelectOptions = [
    { value: "", label: t("declarations.cnss.situationNone") },
    ...situationOptions.map((s) => ({ value: s.code, label: `${s.code} — ${s.label}` })),
  ];

  const years = [currentYear - 2, currentYear - 1, currentYear].map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.hr"), href: "/hr/employees" }, { label: t("declarations.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <FileCheck2 size={20} />
            <h1>{t("declarations.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("declarations.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companies.map((c) => ({ value: c._id, label: c.name }))} />
        </div>
        {tab !== "irAnnual" ? (
          <div className="filterGroup">
            <label>{t("declarations.payroll")}</label>
            <CustomSelect value={runId} onSelect={setRunId} placeholder={t("declarations.noRun")}
              options={runs.map((r) => ({ value: r._id, label: runLabel(r) }))} />
          </div>
        ) : (
          <div className="filterGroup">
            <label>{t("declarations.year")}</label>
            <CustomSelect value={String(irYear)} onSelect={(v) => setIrYear(Number(v))} options={years} />
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        {TABS.map((k) => {
          const Icon = TAB_ICONS[k];
          return (
            <button key={k} type="button" className={tab === k ? styles.tabActive : styles.tab} onClick={() => setTab(k)}>
              <Icon size={15} /> {t(`declarations.tabs.${k}`)}
            </button>
          );
        })}
      </div>

      {error && <div className="errorMessage">{error}</div>}

      {tab !== "irAnnual" && !runId && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><FileCheck2 size={28} /></div>
          <h2>{t("declarations.noRunTitle")}</h2>
          <p>{t("declarations.noRunMessage")}</p>
        </div>
      )}

      {/* ---------------- CNSS / Damancom ---------------- */}
      {tab === "cnss" && runId && (
        <section className={styles.panel}>
          <ol className={styles.steps}>
            <li>{t("declarations.cnss.step1")}</li>
            <li>{t("declarations.cnss.step2")}</li>
            <li>{t("declarations.cnss.step3")}</li>
          </ol>
          <div className={styles.uploadRow}>
            <FileInput value={preFile} onChange={(f) => { setPreFile(f); setPlan(null); setSituations({}); }} accept=".txt,.dat,text/plain"
              chooseLabel={t("declarations.cnss.choose")} emptyLabel={t("declarations.cnss.noFile")} />
            <button type="button" className="btnEdit" disabled={!preFile || busy} onClick={() => readPreetabli()}>
              <Upload size={15} /> {t("declarations.cnss.check")}
            </button>
          </div>

          {plan && (
            <>
              <div className={styles.kpis}>
                <div><span>{t("declarations.cnss.employees")}</span><strong>{plan.totals.employees}</strong></div>
                <div><span>{t("declarations.cnss.days")}</span><strong>{plan.totals.days}</strong></div>
                <div><span>{t("declarations.cnss.gross")}</span><strong>{money(plan.totals.gross)}</strong></div>
                <div><span>{t("declarations.cnss.capped")}</span><strong>{money(plan.totals.capped)}</strong></div>
              </div>

              <Issues problems={plan.problems} warnings={plan.warnings} t={t} />

              <h3 className={styles.sectionTitle}>{t("declarations.cnss.insuredTitle")}</h3>
              <div className="dataTable">
                <div className="dataTableHead" style={{ gridTemplateColumns: "1.6fr 1fr 0.6fr 1fr 1fr 1.6fr" }}>
                  <span>{t("declarations.cnss.name")}</span><span>{t("declarations.cnss.cnssNumber")}</span>
                  <span>{t("declarations.cnss.daysShort")}</span><span>{t("declarations.cnss.gross")}</span>
                  <span>{t("declarations.cnss.capped")}</span><span>{t("declarations.cnss.situation")}</span>
                </div>
                {plan.insured.map((r) => (
                  <div key={r.cnssNumber} className="dataTableRow" data-error={r.needsSituation}
                    style={{ gridTemplateColumns: "1.6fr 1fr 0.6fr 1fr 1fr 1.6fr" }}>
                    <span>{r.name}</span>
                    <span className="dataTableCellMuted">{r.cnssNumber}</span>
                    <span>{r.days}</span>
                    <span>{money(r.gross)}</span>
                    <span className="dataTableCellMuted">{money(r.capped)}</span>
                    <span>
                      {r.employeeId && !r.situation ? <span className={styles.muted}>{t("declarations.cnss.paid")}</span> : (
                        <CustomSelect value={r.situation} options={situationSelectOptions} onSelect={(v) => chooseSituation(r.cnssNumber, v)} />
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {plan.entrants.length > 0 && (
                <>
                  <h3 className={styles.sectionTitle}>{t("declarations.cnss.entrantsTitle")}</h3>
                  <div className="dataTable">
                    <div className="dataTableHead" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.6fr 1fr 1fr" }}>
                      <span>{t("declarations.cnss.name")}</span><span>{t("declarations.cnss.cnssNumber")}</span>
                      <span>CIN</span><span>{t("declarations.cnss.daysShort")}</span>
                      <span>{t("declarations.cnss.gross")}</span><span>{t("declarations.cnss.capped")}</span>
                    </div>
                    {plan.entrants.map((r) => (
                      <div key={r.cnssNumber} className="dataTableRow" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.6fr 1fr 1fr" }}>
                        <span>{r.name}</span><span className="dataTableCellMuted">{r.cnssNumber}</span>
                        <span className="dataTableCellMuted">{r.cin || "—"}</span><span>{r.days}</span>
                        <span>{money(r.gross)}</span><span className="dataTableCellMuted">{money(r.capped)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className={styles.actions}>
                <button type="button" className="btnPrimary" disabled={!plan.ready || busy}
                  onClick={() => doAction(() => downloadDamancomFile(runId, preFile, situations, `DS_${plan.affiliate}_${plan.period}.txt`))}>
                  <Download size={15} /> {t("declarations.cnss.generate")}
                </button>
              </div>
              <p className={styles.fineprint}>{t("declarations.cnss.formatNote")}</p>
            </>
          )}
        </section>
      )}

      {/* ---------------- Bank transfer ---------------- */}
      {tab === "bank" && runId && (
        <section className={styles.panel}>
          {!bank && <p className={styles.muted}>{t("common.loading")}</p>}
          {bank && (
            <>
              <div className={styles.kpis}>
                <div><span>{t("declarations.bank.count")}</span><strong>{bank.count}</strong></div>
                <div><span>{t("declarations.bank.total")}</span><strong>{money(bank.total)} MAD</strong></div>
                <div><span>{t("declarations.bank.debited")}</span><strong className={styles.mono}>{bank.orderingParty.rib || "—"}</strong></div>
              </div>
              <Issues problems={bank.problems} t={t} />

              <div className="dataTable">
                <div className="dataTableHead" style={{ gridTemplateColumns: "1.5fr 2fr 1.2fr 1fr" }}>
                  <span>{t("declarations.bank.beneficiary")}</span><span>RIB</span>
                  <span>{t("declarations.bank.bank")}</span><span>{t("declarations.bank.amount")}</span>
                </div>
                {bank.transfers.map((tr) => (
                  <div key={tr.employeeId} className="dataTableRow" style={{ gridTemplateColumns: "1.5fr 2fr 1.2fr 1fr" }}>
                    <span>{tr.name}</span><span className={styles.mono}>{tr.rib}</span>
                    <span className="dataTableCellMuted">{tr.bankName || "—"}</span><span>{money(tr.amount)}</span>
                  </div>
                ))}
              </div>

              {bank.otherPayments.length > 0 && (
                <p className={styles.muted}>
                  {t("declarations.bank.otherPayments").replace("{count}", bank.otherPayments.length)
                    .replace("{amount}", money(bank.otherPayments.reduce((s, o) => s + o.amount, 0)))}
                </p>
              )}

              <div className={styles.actions}>
                <label className={styles.inlineField}>
                  {t("declarations.bank.executionDate")}
                  <input type="date" value={executionDate} onChange={(e) => setExecutionDate(e.target.value)} />
                </label>
                <button type="button" className="btnEdit" disabled={!bank.ready || busy}
                  onClick={() => doAction(() => downloadBankTransfer(runId, { format: "csv" }, `virements-salaires-${run?.year}-${String(run?.month).padStart(2, "0")}.csv`))}>
                  <Download size={15} /> CSV
                </button>
                <button type="button" className="btnPrimary" disabled={!bank.ready || busy}
                  onClick={() => doAction(() => downloadBankTransfer(runId, { format: "xlsx", executionDate }, `virements-salaires-${run?.year}-${String(run?.month).padStart(2, "0")}.xlsx`))}>
                  <Download size={15} /> Excel
                </button>
              </div>
              <p className={styles.fineprint}>{t("declarations.bank.note")}</p>
            </>
          )}
        </section>
      )}

      {/* ---------------- Monthly IR ---------------- */}
      {tab === "irMonthly" && runId && (
        <section className={styles.panel}>
          {!irMonth && <p className={styles.muted}>{t("common.loading")}</p>}
          {irMonth && (
            <>
              <div className={styles.kpis}>
                <div><span>{t("declarations.ir.toPay")}</span><strong>{money(irMonth.totalIncomeTax)} MAD</strong></div>
                <div><span>{t("declarations.ir.deadline")}</span><strong>{date(irMonth.deadline)}</strong></div>
                <div><span>{t("declarations.ir.taxed")}</span><strong>{irMonth.taxedEmployees} / {irMonth.employees}</strong></div>
                <div><span>{t("declarations.ir.taxable")}</span><strong>{money(irMonth.totalTaxable)}</strong></div>
              </div>
              {!irMonth.runCompleted && <div className={styles.warningBox}><Info size={15} /> {t("declarations.ir.draftWarning")}</div>}
              <p className={styles.hint}>{t("declarations.ir.howTo")}</p>
              <div className="dataTable">
                <div className="dataTableHead" style={{ gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1fr" }}>
                  <span>{t("declarations.cnss.name")}</span><span>CIN</span><span>{t("declarations.cnss.gross")}</span>
                  <span>{t("declarations.ir.taxableShort")}</span><span>IR</span>
                </div>
                {irMonth.rows.map((r) => (
                  <div key={r.employeeId} className="dataTableRow" style={{ gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1fr" }}>
                    <span>{r.name}</span><span className="dataTableCellMuted">{r.cin || "—"}</span>
                    <span>{money(r.gross)}</span><span className="dataTableCellMuted">{money(r.taxable)}</span><span>{money(r.incomeTax)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------------- Annual IR (état 9421) ---------------- */}
      {tab === "irAnnual" && (
        <section className={styles.panel}>
          {!irAnnual && <p className={styles.muted}>{t("common.loading")}</p>}
          {irAnnual && (
            <>
              <div className={styles.kpis}>
                <div><span>{t("declarations.cnss.employees")}</span><strong>{irAnnual.totals.employees}</strong></div>
                <div><span>{t("declarations.annual.grossTaxable")}</span><strong>{money(irAnnual.totals.grossTaxable)}</strong></div>
                <div><span>{t("declarations.annual.netTaxable")}</span><strong>{money(irAnnual.totals.netTaxable)}</strong></div>
                <div><span>{t("declarations.annual.ir")}</span><strong>{money(irAnnual.totals.incomeTax)}</strong></div>
                <div><span>{t("declarations.ir.deadline")}</span><strong>{date(new Date(new Date(irAnnual.deadline).getTime() - 86400000))}</strong></div>
              </div>
              <Issues problems={irAnnual.problems} warnings={irAnnual.warnings} t={t} />
              <div className="dataTable">
                <div className="dataTableHead" style={{ gridTemplateColumns: "1.8fr 0.9fr 0.6fr 1fr 1fr 1fr 1fr" }}>
                  <span>{t("declarations.cnss.name")}</span><span>CIN</span><span>{t("declarations.annual.months")}</span>
                  <span>{t("declarations.cnss.gross")}</span><span>{t("declarations.annual.deductions")}</span>
                  <span>{t("declarations.annual.netTaxable")}</span><span>IR</span>
                </div>
                {irAnnual.employees.map((e) => (
                  <div key={e.employeeId} className="dataTableRow" style={{ gridTemplateColumns: "1.8fr 0.9fr 0.6fr 1fr 1fr 1fr 1fr" }}>
                    <span>{e.lastName} {e.firstName}</span><span className="dataTableCellMuted">{e.cin || "—"}</span>
                    <span>{e.months}</span><span>{money(e.gross)}</span>
                    <span className="dataTableCellMuted">{money(e.totalDeductions)}</span>
                    <span>{money(e.netTaxable)}</span><span>{money(e.incomeTax)}</span>
                  </div>
                ))}
              </div>
              <div className={styles.actions}>
                <button type="button" className="btnEdit" disabled={busy || !irAnnual.employees.length}
                  onClick={() => doAction(() => downloadAnnualIr(companyId, irYear, "xlsx"))}>
                  <Download size={15} /> Excel
                </button>
                <button type="button" className="btnPrimary" disabled={busy || !irAnnual.ready}
                  onClick={() => doAction(() => downloadAnnualIr(companyId, irYear, "xml"))}>
                  <Download size={15} /> {t("declarations.annual.xml")}
                </button>
              </div>
              <p className={styles.fineprint}>{t("declarations.annual.note")}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
