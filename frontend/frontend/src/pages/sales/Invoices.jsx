import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Plus, FileMinus } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchBar from "../../components/useful/SearchBar";
import StatusPill from "../../components/useful/StatusPill";
import Pagination from "../../components/useful/Pagination";
import { getInvoices } from "../../services/salesService";
import { useCompanyPicker, formatMoney, formatDate, SALES_PILL } from "./salesShared";
import styles from "../purchasing/Purchasing.module.css";
import s from "./Sales.module.css";

const FILTERS = [
  { key: "all", params: {} },
  { key: "unpaid", params: { status: "unpaid" } },
  { key: "overdue", params: { overdue: "true" } },
  { key: "draft", params: { status: "draft" } },
  { key: "paid", params: { status: "paid" } },
  { key: "credit_note", params: { type: "credit_note" } },
];

/** Customer invoices, deposit invoices and credit notes. */
export default function Invoices() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = FILTERS.find((f) => f.key === filter).params;
      const { invoices: list, pagination: p } = await getInvoices({ companyId, ...params, search, page, limit: 20 });
      setInvoices(list);
      setPagination(p);
    } catch (err) {
      setError(err.response?.data?.message || t("sales.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [companyId, filter, search, page, t]);
  useEffect(() => { load(); }, [load]);

  const columns = "130px 110px 90px 1.4fr 110px 110px 110px 120px";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.sales"), href: "/sales/quotes" }, { label: t("sales.invoices.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Receipt size={20} /><h1>{t("sales.invoices.title")}</h1></div>
          <p className="pageSubtitle">{t("sales.invoices.subtitle")}</p>
        </div>
        {companyId && (
          <div className={styles.headerActions}>
            <button type="button" className="btnEdit" onClick={() => navigate("/sales/invoices/new", { state: { companyId, type: "credit_note" } })}>
              <FileMinus size={15} /> {t("sales.invoices.newCredit")}
            </button>
            <button type="button" className="btnPrimary" onClick={() => navigate("/sales/invoices/new", { state: { companyId } })}>
              <Plus size={15} /> {t("sales.invoices.new")}
            </button>
          </div>
        )}
      </div>
      <p className={s.muted} style={{ marginTop: -6, marginBottom: 12 }}>{t("sales.invoices.fromQuoteHint")}</p>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <SearchBar onSearch={(v) => { setSearch(v); setPage(1); }} onClear={() => setSearch("")} placeholder={t("sales.invoices.search")} />
        <div className={styles.tabs}>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={filter === f.key ? styles.tabActive : styles.tab} onClick={() => { setFilter(f.key); setPage(1); }}>
              {t(`sales.invoices.filters.${f.key}`)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}

      {!loading && invoices.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Receipt size={28} /></div>
          <h2>{t("sales.invoices.emptyTitle")}</h2>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: columns }}>
            <span>{t("sales.number")}</span><span>{t("sales.type")}</span><span>{t("sales.date")}</span><span>{t("sales.customer")}</span>
            <span>{t("sales.totals.ttc")}</span><span>{t("sales.invoices.remaining")}</span><span>{t("sales.dueDate")}</span><span>{t("sales.status")}</span>
          </div>
          {invoices.map((i) => (
            <div key={i._id} className={`dataTableRow ${styles.clickableRow}`} style={{ gridTemplateColumns: columns }}
              role="button" tabIndex={0} onClick={() => navigate(`/sales/invoices/${i._id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/sales/invoices/${i._id}`)}>
              <span><strong>{i.number || "—"}</strong></span>
              <span className="dataTableCellMuted">{t(`sales.invoiceTypes.${i.type}`)}</span>
              <span className="dataTableCellMuted">{formatDate(i.date)}</span>
              <span>{i.customer?.name}{i.project && <small className={styles.orderLink}>{i.project.number}</small>}</span>
              <span>{i.type === "credit_note" ? "− " : ""}{formatMoney(i.totalTTC)}</span>
              <span className={i.overdue ? s.bad : ""}>{i.due ? formatMoney(i.due) : "—"}</span>
              <span className={i.overdue ? s.bad : "dataTableCellMuted"}>{i.type === "credit_note" ? "—" : formatDate(i.dueDate)}</span>
              <span>
                <StatusPill status={SALES_PILL[i.status]} label={t(`sales.invoiceStatus.${i.status}`)} />
                {i.overdue && <span className={`${s.tag} ${s.tagBad}`}>{t("sales.invoices.overdue")}</span>}
              </span>
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
