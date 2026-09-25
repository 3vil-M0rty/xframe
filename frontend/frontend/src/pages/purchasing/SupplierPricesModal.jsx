import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
import { updateSupplierInfo } from "../../services/productService";
import SupplierSelect, { useCompanySuppliers } from "../../components/useful/SupplierSelect";
import styles from "./Purchasing.module.css";

/**
 * The purchasing team's edit of an inventory article: supplier prices
 * and supplier references, plus the internal reference IF the article
 * doesn't have one yet (changing an existing one stays production's —
 * the backend enforces the same rule).
 */
export default function SupplierPricesModal({ product, onClose, onSaved }) {
  const { t } = useI18n();
  const suppliers = useCompanySuppliers(product.company?._id || product.company);
  const hasReference = !!String(product.internalReference || "").trim();
  const [internalReference, setInternalReference] = useState("");
  const [rows, setRows] = useState(
    (product.prices || []).map((p) => ({ supplierName: p.supplierName, supplierReference: p.supplierReference || "", price: p.price }))
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await updateSupplierInfo(product._id, {
        prices: rows.filter((r) => r.supplierName.trim() || r.price !== "").map((r) => ({ ...r, price: Number(r.price) })),
        internalReference: !hasReference && internalReference.trim() ? internalReference : undefined,
      });
      onSaved(saved);
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard} style={{ maxWidth: 620 }}>
        <h3>{product.name}</h3>

        <label className={styles.field}>
          <span>{t("purchasing.supplierPrices.internalReference")}</span>
          {hasReference ? (
            <input className={styles.input} value={product.internalReference} disabled />
          ) : (
            <input className={styles.input} value={internalReference} placeholder={t("purchasing.supplierPrices.internalReferencePlaceholder")}
              onChange={(e) => setInternalReference(e.target.value)} />
          )}
          <small className={styles.muted}>
            {hasReference ? t("purchasing.supplierPrices.referenceLocked") : t("purchasing.supplierPrices.referenceMissing")}
          </small>
        </label>

        <div className={styles.priceHead}>
          <span>{t("purchasing.columns.supplier")}</span>
          <span>{t("purchasing.supplierPrices.supplierReference")}</span>
          <span>{t("purchasing.lines.unitPrice")}</span>
          <span />
        </div>
        {rows.length === 0 && <p className={styles.muted}>{t("purchasing.supplierPrices.none")}</p>}
        {rows.map((row, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className={styles.priceRow}>
            <SupplierSelect suppliers={suppliers} value={row.supplierName}
              onChange={(name) => update(i, { supplierName: name })} />
            <input className={styles.cellInput} value={row.supplierReference} placeholder="—"
              onChange={(e) => update(i, { supplierReference: e.target.value })} />
            <input className={styles.cellInput} type="number" min="0" step="any" value={row.price}
              onChange={(e) => update(i, { price: e.target.value })} />
            <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")}
              onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}><Trash2 size={13} /></button>
          </div>
        ))}
        <button type="button" className="btnEdit" style={{ marginTop: 6 }}
          onClick={() => setRows((r) => [...r, { supplierName: "", supplierReference: "", price: "" }])}>
          <Plus size={14} /> {t("purchasing.supplierPrices.addSupplier")}
        </button>

        {error && <div className="errorMessage" style={{ marginTop: 10 }}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btnPrimary" disabled={saving} onClick={save}>{saving ? t("common.loading") : t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}
