import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { History, Package } from "lucide-react";

import api from "../../services/api";
import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import StatusPill from "../../components/useful/StatusPill";
import { getArticleOrders, getRequests } from "../../services/purchasingService";
import { useCompanyPicker, useCompanyProducts, formatDate, formatMoney, PILL } from "./shared";
import styles from "./Purchasing.module.css";

/**
 * Historique article: pick an inventory article and see every bon de
 * commande it appears on (quantities, prices, what was received) plus
 * its purchase requests. Reachable from an article in Achats >
 * Inventaire (?product=<id>).
 */
export default function ArticleHistory() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const products = useCompanyProducts(companyId);

  const productId = params.get("product") || "";
  const [product, setProduct] = useState(null);
  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) { setProduct(null); setRows([]); setRequests([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/products/${productId}`);
        const p = res.data.data;
        if (cancelled) return;
        setProduct(p);
        // follow the article's company when arriving from a link
        const pCompany = p.company?._id || p.company;
        if (pCompany && pCompany !== companyId) setCompanyId(pCompany);
        const [orders, reqs] = await Promise.all([
          getArticleOrders(productId),
          getRequests({ companyId: pCompany, product: productId, limit: 50 }),
        ]);
        if (cancelled) return;
        setRows(orders);
        setRequests(reqs.requests);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t("purchasing.errors.load"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const selectProduct = (id) => setParams(id ? { product: id } : {});

  const live = rows.filter((r) => r.status !== "cancelled");
  const totalOrdered = live.reduce((s, r) => s + r.quantity, 0);
  const totalReceived = live.reduce((s, r) => s + r.receivedQuantity - r.returnedQuantity, 0);
  const avgPrice = totalOrdered ? live.reduce((s, r) => s + r.quantity * r.unitPrice, 0) / totalOrdered : 0;
  const lastPrice = live[0]?.unitPrice;
  const unit = product?.unit || "";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.history.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><History size={20} /><h1>{t("purchasing.history.title")}</h1></div>
          <p className="pageSubtitle">{t("purchasing.history.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={(v) => { setCompanyId(v); selectProduct(""); }} options={companyOptions} />
        </div>
        <div className="filterGroup" style={{ minWidth: 320 }}>
          <label>{t("purchasing.lines.article")}</label>
          <SearchSelect value={productId} onSelect={selectProduct} icon={Package}
            options={products.map((p) => ({ value: p._id, label: `${p.name}${p.internalReference ? ` (${p.internalReference})` : ""}` }))}
            placeholder={t("purchasing.lines.pickArticle")} noResultsLabel={t("common.noResults")} />
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {!productId && <p className={styles.muted}>{t("purchasing.history.pickHint")}</p>}
      {loading && <p className={styles.muted}>{t("common.loading")}</p>}

      {product && !loading && (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><span>{t("purchasing.history.inStock")}</span><strong>{product.quantity} {unit}</strong></div>
            <div className={styles.summaryCard}><span>{t("purchasing.history.orders")}</span><strong>{live.length}</strong></div>
            <div className={styles.summaryCard}><span>{t("purchasing.history.totalOrdered")}</span><strong>{totalOrdered} {unit}</strong></div>
            <div className={styles.summaryCard}><span>{t("purchasing.history.totalReceived")}</span><strong>{totalReceived} {unit}</strong></div>
            <div className={styles.summaryCard}><span>{t("purchasing.history.averagePrice")}</span><strong>{formatMoney(avgPrice)}</strong></div>
            {lastPrice !== undefined && <div className={styles.summaryCard}><span>{t("purchasing.history.lastPrice")}</span><strong>{formatMoney(lastPrice)}</strong></div>}
          </div>

          <h2 className={styles.subTitle}>{t("purchasing.orders.title")}</h2>
          {rows.length === 0 ? <p className={styles.muted}>{t("purchasing.history.noOrders")}</p> : (
            <div className="dataTable">
              <div className="dataTableHead" style={{ gridTemplateColumns: "120px 90px 1.3fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 1fr" }}>
                <span>{t("purchasing.columns.number")}</span>
                <span>{t("purchasing.columns.date")}</span>
                <span>{t("purchasing.columns.supplier")}</span>
                <span>{t("purchasing.columns.status")}</span>
                <span>{t("purchasing.detail.ordered")}</span>
                <span>{t("purchasing.detail.received")}</span>
                <span>{t("purchasing.detail.returned")}</span>
                <span>{t("purchasing.detail.outstanding")}</span>
                <span>{t("purchasing.lines.unitPrice")}</span>
                <span>{t("purchasing.columns.payment")}</span>
              </div>
              {rows.map((r, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={`${r.orderId}-${i}`} className={`dataTableRow ${styles.clickableRow}`} role="button" tabIndex={0}
                  style={{ gridTemplateColumns: "120px 90px 1.3fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 1fr" }}
                  onClick={() => navigate(`/purchasing/orders/${r.orderId}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/purchasing/orders/${r.orderId}`)}>
                  <span><strong>{r.number}</strong></span>
                  <span className="dataTableCellMuted">{formatDate(r.date)}</span>
                  <span>{r.supplier?.name || "—"}</span>
                  <span><StatusPill status={PILL[r.status]} label={t(`purchasing.orderStatus.${r.status}`)} /></span>
                  <span>{r.quantity}</span>
                  <span>{r.receivedQuantity}</span>
                  <span>{r.returnedQuantity}</span>
                  <span className={r.outstanding > 0 ? styles.amountDue : styles.muted}>{r.outstanding}</span>
                  <span>{formatMoney(r.unitPrice)}</span>
                  <span><StatusPill status={PILL[r.paymentStatus]} label={t(`purchasing.paymentStatus.${r.paymentStatus}`)} /></span>
                </div>
              ))}
            </div>
          )}

          <h2 className={styles.subTitle}>{t("purchasing.requests.title")}</h2>
          {requests.length === 0 ? <p className={styles.muted}>{t("purchasing.history.noRequests")}</p> : (
            <div className="dataTable">
              {requests.map((r) => (
                <div key={r._id} className="dataTableRow" style={{ gridTemplateColumns: "90px 0.8fr 1fr 2fr" }}>
                  <span className="dataTableCellMuted">{formatDate(r.createdAt)}</span>
                  <span>{r.requestedQuantity} {unit}</span>
                  <span><StatusPill status={PILL[r.status]} label={t(`purchasing.requestStatus.${{ approved: "ordered", rejected: "declined" }[r.status] || r.status}`)} /></span>
                  <span className={styles.noteCell}>{r.declineReason || r.purchasingNote || r.notes || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
