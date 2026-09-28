import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus, FileText, CalendarDays } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchBar from "../../components/useful/SearchBar";
import StatusPill from "../../components/useful/StatusPill";
import { getDeliveryNotes, openDeliveryNotePdf } from "../../services/logisticsService";
import { useCompanyPicker, formatDate, fmtQty, NOTE_PILL } from "./logisticsShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";

const VIEWS = ["upcoming", "today", "late", "delivered", "draft", "cancelled", "all"];
const dayStart = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Bons de livraison — the delivery planning (upcoming, today, late) and history. */
export default function DeliveryNotes() {
  const can = useCan();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    try { setRows(await getDeliveryNotes({ companyId })); } catch (err) { setError(err.response?.data?.message || t("logi.errors.load")); }
  }, [companyId, t]);
  useEffect(() => { load(); }, [load]);

  const today = dayStart();
  const tomorrow = new Date(today.getTime() + 86400000);
  const matches = (n, v) => {
    const d = new Date(n.date);
    const open = ["planned", "shipped"].includes(n.status);
    if (v === "all") return true;
    if (v === "upcoming") return open && d >= today;
    if (v === "today") return open && d >= today && d < tomorrow;
    if (v === "late") return open && d < today;
    return n.status === v;
  };
  const shown = useMemo(() => rows
    .filter((n) => matches(n, view) && (!search || `${n.number} ${n.project?.number} ${n.project?.name} ${n.customer?.name} ${n.transport?.carrier} ${(n.refs || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => (["delivered", "all", "cancelled"].includes(view) ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rows, view, search]);
  const count = (v) => rows.filter((n) => matches(n, v)).length;

  const cols = "130px 110px 1.6fr 1.2fr 1.2fr 80px 120px 40px";
  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.logistics"), href: "/logistics/to-deliver" }, { label: t("logi.notes.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Truck size={20} /><h1>{t("logi.notes.title")}</h1></div>
          <p className="pageSubtitle">{t("logi.notes.subtitle")}</p>
        </div>
        {can("logistics.notes.create") && <button type="button" className="btnPrimary" onClick={() => navigate("/logistics/delivery-notes/new", { state: { companyId } })}><Plus size={15} /> {t("logi.notes.new")}</button>}
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup"><label>{t("employees.toolbar.company")}</label><CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} /></div>
        <SearchBar onSearch={setSearch} onClear={() => setSearch("")} placeholder={t("logi.notes.search")} />
      </div>
      <div className={s.tabs}>
        {VIEWS.map((v) => (
          <button key={v} type="button" className={view === v ? s.tabActive : s.tab} onClick={() => setView(v)}>
            {v === "upcoming" && <CalendarDays size={14} />} {t(`logi.notes.views.${v}`)} <span className={s.count}>{count(v)}</span>
          </button>
        ))}
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {shown.length === 0 ? (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><Truck size={28} /></div><h2>{t("logi.notes.empty")}</h2></div>
      ) : (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: cols }}>
            <span>{t("sales.number")}</span><span>{t("sales.date")}</span><span>{t("sales.project")}</span><span>{t("logi.notes.chassis")}</span><span>{t("logi.notes.transport")}</span><span>{t("logi.pieces")}</span><span>{t("sales.status")}</span><span />
          </div>
          {shown.map((n) => {
            const late = ["planned", "shipped"].includes(n.status) && new Date(n.date) < today;
            return (
              <div key={n._id} className={`dataTableRow ${purch.clickableRow}`} style={{ gridTemplateColumns: cols }} role="button" tabIndex={0}
                onClick={() => navigate(`/logistics/delivery-notes/${n._id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/logistics/delivery-notes/${n._id}`)}>
                <span><strong>{n.number}</strong></span>
                <span className={late ? s.bad : ""}>{formatDate(n.deliveredAt || n.date)}{n.timeSlot && <small className={s.muted} style={{ display: "block" }}>{n.timeSlot}</small>}</span>
                <span>{n.project?.number} — {n.project?.name}<small className={s.muted} style={{ display: "block" }}>{n.customer?.name || ""}</small></span>
                <span className="dataTableCellMuted">{(n.refs || []).join(", ")}</span>
                <span className="dataTableCellMuted">{t(`logi.transportModes.${n.transport?.mode || "own"}`)}{n.transport?.carrier ? ` · ${n.transport.carrier}` : ""}{n.transport?.driver ? ` · ${n.transport.driver}` : ""}</span>
                <span>{fmtQty(n.pieces)}</span>
                <span><StatusPill status={NOTE_PILL[n.status]} label={t(`logi.noteStatus.${n.status}`)} />{late && <span className={`${s.tag} ${s.tagBad}`}>{t("projects.late")}</span>}{n.reserves && <span className={`${s.tag} ${s.tagWarn}`}>{t("logi.notes.reserves")}</span>}</span>
                <span onClick={(e) => e.stopPropagation()} role="presentation"><button type="button" className="tableActionBtn" onClick={() => openDeliveryNotePdf(n._id)}><FileText size={14} /></button></span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
