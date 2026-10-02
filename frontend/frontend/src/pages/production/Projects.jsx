import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Info } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchBar from "../../components/useful/SearchBar";
import StatusPill from "../../components/useful/StatusPill";
import { canSeeFinancials, canAccessSales } from "../../utils/permissions";
import { getProjects } from "../../services/projectService";
import { useCompanyPicker, formatMoney, formatDate, SALES_PILL } from "../sales/salesShared";
import styles from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";

const FILTERS = ["active", "planned", "in_progress", "on_hold", "completed", "cancelled", ""];

/** Projects (affaires / chantiers): progress, cost and margin at a glance. */
export default function Projects() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const money = canSeeFinancials(user);
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const columns = money ? "120px 1.6fr 1.1fr 130px 1fr 1fr 1fr 120px" : "120px 2fr 1.4fr 160px 140px";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/projects" }, { label: t("projects.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><FolderKanban size={20} /><h1>{t("projects.title")}</h1></div>
          <p className="pageSubtitle">{t("projects.subtitle")}</p>
        </div>
        {/* Projects are born from a validated devis (Ventes → Devis → Lancer le projet). */}
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
      {/* One path: devis → validé → lancé → projet → fabrication lancée → ateliers. */}
      <div className={styles.infoBanner}>
        <Info size={14} /> {t("flow.projectsHint")}
        {canAccessSales(user) && <> <button type="button" className={styles.linkButton} onClick={() => navigate("/sales/quotes")}>{t("flow.goToQuotes")}</button></>}
      </div>


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
