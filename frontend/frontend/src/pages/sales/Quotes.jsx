import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSignature, Plus } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchBar from "../../components/useful/SearchBar";
import StatusPill from "../../components/useful/StatusPill";
import Pagination from "../../components/useful/Pagination";
import { getQuotes } from "../../services/salesService";
import { useCompanyPicker, formatMoney, formatDate, SALES_PILL } from "./salesShared";
import styles from "../purchasing/Purchasing.module.css";

const FILTERS = ["", "draft", "sent", "accepted", "refused", "expired"];

/** Devis: list by status, new devis. */
export default function Quotes() {
  const can = useCan();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [quotes, setQuotes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { quotes: list, pagination: p } = await getQuotes({ companyId, status, search, page, limit: 20 });
      setQuotes(list);
      setPagination(p);
    } catch (err) {
      setError(err.response?.data?.message || t("sales.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [companyId, status, search, page, t]);
  useEffect(() => { load(); }, [load]);

  const columns = "130px 100px 1.4fr 1.6fr 120px 110px 110px";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.sales"), href: "/sales/quotes" }, { label: t("sales.quotes.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><FileSignature size={20} /><h1>{t("sales.quotes.title")}</h1></div>
          <p className="pageSubtitle">{t("sales.quotes.subtitle")}</p>
        </div>
        {companyId && can("sales.quotes.create") && (
          <button type="button" className="btnPrimary" onClick={() => navigate("/sales/quotes/new", { state: { companyId } })}>
            <Plus size={15} /> {t("sales.quotes.new")}
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <SearchBar onSearch={(v) => { setSearch(v); setPage(1); }} onClear={() => setSearch("")} placeholder={t("sales.quotes.search")} />
        <div className={styles.tabs}>
          {FILTERS.map((f) => (
            <button key={f || "all"} type="button" className={status === f ? styles.tabActive : styles.tab} onClick={() => { setStatus(f); setPage(1); }}>
              {f ? t(`sales.quoteStatus.${f}`) : t("sales.all")}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}

      {!loading && quotes.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><FileSignature size={28} /></div>
          <h2>{t("sales.quotes.emptyTitle")}</h2>
          <p>{t("sales.quotes.emptyMessage")}</p>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: columns }}>
            <span>{t("sales.number")}</span><span>{t("sales.date")}</span><span>{t("sales.customer")}</span>
            <span>{t("sales.subject")}</span><span>{t("sales.totals.ttc")}</span><span>{t("sales.validUntil")}</span><span>{t("sales.status")}</span>
          </div>
          {quotes.map((q) => (
            <div key={q._id} className={`dataTableRow ${styles.clickableRow}`} style={{ gridTemplateColumns: columns }}
              role="button" tabIndex={0} onClick={() => navigate(`/sales/quotes/${q._id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/sales/quotes/${q._id}`)}>
              <span><strong>{q.number}</strong>{q.project && <small className={styles.orderLink}>{q.project.number}</small>}</span>
              <span className="dataTableCellMuted">{formatDate(q.date)}</span>
              <span>{q.customer?.name || "—"}</span>
              <span className="dataTableCellMuted">{q.subject || "—"}</span>
              <span>{formatMoney(q.totalTTC)}</span>
              <span className="dataTableCellMuted">{formatDate(q.validUntil)}</span>
              <span><StatusPill status={SALES_PILL[q.status]} label={q.status === "accepted" && q.project ? t("flow.launchedPill") : t(`sales.quoteStatus.${q.status}`)} /></span>
            </div>
          ))}
        </div>
      )}
      {pagination && pagination.pages > 1 && (
        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
      )}
    </div>
  );
}
