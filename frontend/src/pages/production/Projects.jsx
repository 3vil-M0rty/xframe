import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, X } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchBar from "../../components/useful/SearchBar";
import StatusPill from "../../components/useful/StatusPill";
import { canManageProjects, canSeeFinancials, can } from "../../utils/permissions";
import { getProjects, createProject, getProjectPeople } from "../../services/projectService";
import { getFinishes } from "../../services/productionService";
import { getCustomers } from "../../services/salesService";
import { useCompanyPicker, formatMoney, formatDate, SALES_PILL } from "../sales/salesShared";
import styles from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";

const FILTERS = ["active", "planned", "in_progress", "on_hold", "completed", "cancelled", ""];

/** Projects (affaires / chantiers): progress, cost and margin at a glance. */
export default function Projects() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = canManageProjects(user);
  const money = canSeeFinancials(user);
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [people, setPeople] = useState([]);
  const [finishes, setFinishes] = useState([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setProjects(await getProjects({ companyId, status, search }));
    } catch (err) {
      setError(err.response?.data?.message || t("projects.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [companyId, status, search, t]);
  useEffect(() => { load(); }, [load]);

  const openForm = () => {
    setForm({ name: "", customer: "", startDate: "", dueDate: "", manager: "", location: "", finish: "", budget: { revenue: "", materials: "", labour: "", purchases: "", other: "" } });
    getCustomers(companyId, { active: "true" }).then(setCustomers).catch(() => setCustomers([]));
    getProjectPeople(companyId).then(setPeople).catch(() => setPeople([]));
    getFinishes(companyId).then((f) => {
      setFinishes(f.filter((x) => x.isActive !== false));
      const def = f.find((x) => x.isDefault && x.isActive !== false);
      if (def) setForm((cur) => (cur && !cur.finish ? { ...cur, finish: def._id } : cur));
    }).catch(() => setFinishes([]));
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const p = await createProject({ ...form, company: companyId });
      navigate(`/production/projects/${p._id}`);
    } catch (err) {
      setError(err.response?.data?.message || t("projects.errors.save"));
    }
  };

  const columns = money ? "120px 1.6fr 1.1fr 130px 1fr 1fr 1fr 120px" : "120px 2fr 1.4fr 160px 140px";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/projects" }, { label: t("projects.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><FolderKanban size={20} /><h1>{t("projects.title")}</h1></div>
          <p className="pageSubtitle">{t("projects.subtitle")}</p>
        </div>
        {companyId && (Array.isArray(user?.permissions) ? can(user, "projects.projects.create") : canEdit) && <button type="button" className="btnPrimary" onClick={openForm}><Plus size={15} /> {t("projects.new")}</button>}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <SearchBar onSearch={setSearch} onClear={() => setSearch("")} placeholder={t("projects.search")} />
        <div className={styles.tabs}>
          {FILTERS.map((f) => (
            <button key={f || "all"} type="button" className={status === f ? styles.tabActive : styles.tab} onClick={() => setStatus(f)}>
              {f ? t(`projects.statuses.${f}`) : t("sales.all")}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}

      {form && (
        <form className={styles.panel} onSubmit={save}>
          <div className={styles.sectionHeader}>
            <h3>{t("projects.new")}</h3>
            <button type="button" className="tableActionBtn" onClick={() => setForm(null)}><X size={14} /></button>
          </div>
          <p className={s.muted}>{t("projects.fromQuoteHint")}</p>
          <div className={styles.formGrid}>
            <label className={styles.field}>{t("projects.name")}<input className={styles.input} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className={styles.field}>{t("sales.customer")}
              <CustomSelect value={form.customer} onSelect={(v) => setForm({ ...form, customer: v })} placeholder={t("projects.noCustomer")}
                options={customers.map((c) => ({ value: c._id, label: c.name }))} />
            </label>
            <label className={styles.field}>{t("projects.manager")}
              <CustomSelect value={form.manager} onSelect={(v) => setForm({ ...form, manager: v })} placeholder={t("projects.pickManager")}
                options={people.map((p) => ({ value: p._id, label: `${p.firstName} ${p.lastName}` }))} />
            </label>
            <label className={styles.field}>{t("projects.startDate")}<input className={styles.input} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label className={styles.field}>{t("projects.dueDate")}<input className={styles.input} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
            <label className={styles.field}>{t("projects.location")}<input className={styles.input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
            <label className={styles.field}>{t("cv.projectFinish")}
              <CustomSelect value={form.finish} onSelect={(v) => setForm({ ...form, finish: v })} placeholder={t("prod.noFinish")}
                options={[{ value: "", label: t("prod.noFinish") }, ...finishes.map((f) => ({ value: f._id, label: `${f.code}${f.name ? ` — ${f.name}` : ""}` }))]} />
            </label>
          </div>
          {money && <>
          <h4 className={styles.subTitle}>{t("projects.budget.title")}</h4>
          <div className={styles.formGrid}>
            {["revenue", "materials", "labour", "purchases", "other"].map((k) => (
              <label key={k} className={styles.field}>{t(`projects.budget.${k}`)}
                <input className={styles.input} type="number" min="0" step="0.01" value={form.budget[k]} onChange={(e) => setForm({ ...form, budget: { ...form.budget, [k]: e.target.value } })} />
              </label>
            ))}
          </div>
          </>}
          <div className={styles.formActions}>
            <button type="button" className="btnCancel" onClick={() => setForm(null)}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary">{t("projects.create")}</button>
          </div>
        </form>
      )}

      {!loading && projects.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><FolderKanban size={28} /></div>
          <h2>{t("projects.emptyTitle")}</h2>
          <p>{t("projects.emptyMessage")}</p>
        </div>
      )}

      {projects.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: columns }}>
            <span>{t("sales.number")}</span><span>{t("projects.name")}</span><span>{t("sales.customer")}</span><span>{t("projects.progress")}</span>
            {money && <><span>{t("projects.revenue")}</span><span>{t("projects.actualCost")}</span><span>{t("projects.margin")}</span></>}<span>{t("sales.status")}</span>
          </div>
          {projects.map((p) => (
            <div key={p._id} className={`dataTableRow ${styles.clickableRow}`} style={{ gridTemplateColumns: columns }}
              role="button" tabIndex={0} onClick={() => navigate(`/production/projects/${p._id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/production/projects/${p._id}`)}>
              <span><strong>{p.number}</strong></span>
              <span>
                {p.name}
                <small className={s.muted} style={{ display: "block" }}>{p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : ""}{p.dueDate ? ` · ${t("projects.due")} ${formatDate(p.dueDate)}` : ""}</small>
              </span>
              <span className="dataTableCellMuted">{p.customer?.name || "—"}</span>
              <span className={s.progressCell}><span className={s.progress}><span style={{ width: `${p.progress}%` }} /></span>{p.progress}%</span>
              {money && <>
              <span>{formatMoney(p.revenue, "")}</span>
              <span className={p.overBudget ? s.bad : ""}>{formatMoney(p.actualCost, "")}</span>
              <span className={p.actualMargin.amount < 0 ? s.bad : s.good}>
                {formatMoney(p.actualMargin.amount, "")}{p.actualMargin.percent !== null && <small> ({p.actualMargin.percent}%)</small>}
              </span>
              </>}
              <span>
                <StatusPill status={SALES_PILL[p.status]} label={t(`projects.statuses.${p.status}`)} />
                {p.late && <span className={`${s.tag} ${s.tagBad}`}>{t("projects.late")}</span>}
                {p.overBudget && <span className={`${s.tag} ${s.tagWarn}`}>{t("projects.overBudget")}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
