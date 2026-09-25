import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackagePlus, ShoppingCart } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import { getRestockSuggestions } from "../../services/purchasingService";
import { useCompanyPicker, formatMoney } from "./shared";
import styles from "./Purchasing.module.css";
import d from "./PurchaseOrderDetail.module.css";

/**
 * Réapprovisionnement — articles at or below their minimum stock, after
 * counting what's already on order and already requested, grouped by
 * their cheapest supplier. One click turns a group into a pre-filled
 * bon de commande.
 */
export default function Restock() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      setGroups(await getRestockSuggestions(companyId));
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);
  useEffect(() => { load(); }, [load]);

  const createOrder = (group) => navigate("/purchasing/orders/new", {
    state: {
      companyId,
      prefill: {
        supplierName: group.supplierName,
        lines: group.items.map((i) => ({ product: i.productId, description: i.name, unit: i.unit, quantity: i.suggestedQuantity })),
      },
    },
  });

  const cols = "1.6fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.restock.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><PackagePlus size={20} /><h1>{t("purchasing.restock.title")}</h1></div>
          <p className="pageSubtitle">{t("purchasing.restock.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {loading && <p className={styles.muted}>{t("common.loading")}</p>}
      {!loading && groups.length === 0 && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><PackagePlus size={28} /></div><h2>{t("purchasing.restock.empty")}</h2></div>
      )}

      {!loading && groups.map((g) => (
        <section key={g.supplierName || "none"} className={d.card}>
          <header className={d.cardHeader}>
            <h2>
              {g.supplierName || t("purchasing.restock.noSupplier")}
              <span className={d.count}>{g.items.length}</span>
              {g.estimatedHT > 0 && <span className={d.muted}>≈ {formatMoney(g.estimatedHT)} HT</span>}
            </h2>
            <button type="button" className="btnPrimary" onClick={() => createOrder(g)}>
              <ShoppingCart size={14} /> {t("purchasing.restock.createOrder")}
            </button>
          </header>
          <div className={d.cardBody}>
            <div className="dataTable">
              <div className="dataTableHead" style={{ gridTemplateColumns: cols }}>
                <span>{t("purchasing.lines.article")}</span>
                <span>{t("purchasing.restock.stock")}</span>
                <span>{t("purchasing.restock.minimum")}</span>
                <span>{t("purchasing.restock.incoming")}</span>
                <span>{t("purchasing.restock.requested")}</span>
                <span>{t("purchasing.restock.suggested")}</span>
                <span>{t("purchasing.lines.unitPrice")}</span>
              </div>
              {g.items.map((i) => (
                <div key={i.productId} className="dataTableRow" style={{ gridTemplateColumns: cols }}>
                  <span><strong>{i.name}</strong>{i.internalReference && <small className={d.muted}> {i.internalReference}</small>}</span>
                  <span className={styles.amountDue}>{i.quantity} {i.unit}</span>
                  <span className="dataTableCellMuted">{i.threshold}</span>
                  <span className="dataTableCellMuted">{i.incoming || "—"}</span>
                  <span className="dataTableCellMuted">{i.requested || "—"}</span>
                  <span><strong>{i.suggestedQuantity} {i.unit}</strong></span>
                  <span>{i.unitPrice !== null ? formatMoney(i.unitPrice) : <span className={d.muted}>—</span>}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
