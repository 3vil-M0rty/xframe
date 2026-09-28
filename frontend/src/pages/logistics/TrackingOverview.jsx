import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radar, AlertTriangle, Truck } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchBar from "../../components/useful/SearchBar";
import { getTrackingOverview } from "../../services/logisticsService";
import { useCompanyPicker, formatDate, STAGE_COLORS } from "./logisticsShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Logistics.module.css";

const BAR = ["received", "installed", "delivered", "partially_delivered", "ready", "made", "in_production", "to_make"];

/** Suivi des projets: every active project's chassis per stage, deliveries, what's late. */
export default function TrackingOverview() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId) return;
    getTrackingOverview(companyId, status === "all" ? "all" : "").then(setRows).catch((err) => setError(err.response?.data?.message || t("logi.errors.load")));
  }, [companyId, status, t]);

  const shown = rows.filter((r) => {
    if (search && !`${r.number} ${r.name} ${r.customer?.name || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (only === "late") return r.late;
    if (only === "ready") return r.readyPieces > 0;
    if (only === "modified") return r.summary.modified > 0;
    return true;
  });

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/projects" }, { label: t("logi.overview.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Radar size={20} /><h1>{t("logi.overview.title")}</h1></div>
          <p className="pageSubtitle">{t("logi.overview.subtitle")}</p>
        </div>
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup"><label>{t("employees.toolbar.company")}</label><CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} /></div>
        <div className="filterGroup"><label>{t("sales.status")}</label><CustomSelect value={status} onSelect={setStatus} options={[{ value: "active", label: t("projects.statuses.active") }, { value: "all", label: t("sales.all") }]} /></div>
        <SearchBar onSearch={setSearch} onClear={() => setSearch("")} placeholder={t("projects.search")} />
        <div className={purch.tabs}>
          {["", "ready", "late", "modified"].map((f) => <button key={f || "all"} type="button" className={only === f ? purch.tabActive : purch.tab} onClick={() => setOnly(f)}>{f ? t(`logi.overview.filters.${f}`) : t("sales.all")}</button>)}
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      <div className={s.legend}>
        {BAR.slice().reverse().map((k) => <span key={k}><i style={{ background: STAGE_COLORS[k] }} /> {t(`logi.stages.${k}`)}</span>)}
      </div>
      {shown.length === 0 ? (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><Radar size={28} /></div><h2>{t("logi.overview.empty")}</h2></div>
      ) : (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: "1.8fr 90px 2.2fr repeat(4, 70px) 1.1fr" }}>
            <span>{t("projects.title")}</span><span>{t("logi.overview.chassis")}</span><span>{t("logi.overview.progress")}</span>
            <span>{t("logi.pipeline.made")}</span><span>{t("logi.pipeline.ready")}</span><span>{t("logi.pipeline.delivered")}</span><span>{t("logi.pipeline.installed")}</span><span>{t("logi.overview.deliveries")}</span>
          </div>
          {shown.map((r) => {
            const total = r.summary.units || 1;
            return (
              <div key={r._id} className={`dataTableRow ${purch.clickableRow}`} style={{ gridTemplateColumns: "1.8fr 90px 2.2fr repeat(4, 70px) 1.1fr" }}
                role="button" tabIndex={0} onClick={() => navigate(`/production/projects/${r._id}`, { state: { tab: "suivi" } })} onKeyDown={(e) => e.key === "Enter" && navigate(`/production/projects/${r._id}`, { state: { tab: "suivi" } })}>
                <span>
                  <strong>{r.number}</strong> {r.name}
                  <small className={s.muted} style={{ display: "block" }}>{r.customer?.name || ""}{r.dueDate ? ` · ${t("projects.due")} ${formatDate(r.dueDate)}` : ""}</small>
                  {r.late && <span className={`${styles.flag} ${styles.flagBad}`}><AlertTriangle size={10} /> {t("projects.late")}</span>}
                  {r.summary.modified > 0 && <span className={styles.flag}>{r.summary.modified} {t("logi.modified").toLowerCase()}</span>}
                </span>
                <span>{r.summary.units}{r.summary.cancelled ? <small className={s.muted}> (+{r.summary.cancelled} {t("logi.stages.cancelled").toLowerCase()})</small> : null}{!r.tracked && r.chassis > 0 && <small className={s.muted} style={{ display: "block" }}>{t("logi.overview.notTracked")}</small>}</span>
                <span>
                  <span className={styles.stageBar} title={BAR.map((k) => `${t(`logi.stages.${k}`)} ${r.summary[k] || 0}`).join(" · ")}>
                    {BAR.map((k) => (r.summary[k] ? <span key={k} style={{ width: `${(r.summary[k] / total) * 100}%`, background: STAGE_COLORS[k] }} /> : null))}
                  </span>
                  {r.readyPieces > 0 && <small className={s.muted}><Truck size={11} /> {t("logi.overview.readyPieces").replace("{n}", r.readyPieces)}</small>}
                </span>
                <span>{r.summary.percent.made}%</span>
                <span>{r.summary.percent.ready}%</span>
                <span className={r.summary.percent.delivered === 100 ? s.good : ""}>{r.summary.percent.delivered}%</span>
                <span>{r.summary.percent.installed}%</span>
                <span className="dataTableCellMuted">
                  {r.nextDelivery ? <>{t("logi.overview.next")} {formatDate(r.nextDelivery.date)} ({r.nextDelivery.number})</> : r.lastDelivery ? <>{t("logi.overview.last")} {formatDate(r.lastDelivery.deliveredAt || r.lastDelivery.date)}</> : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
