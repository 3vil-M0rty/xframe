import { useState } from "react";
import { Plus, Trash2, Package, Boxes, Pencil } from "lucide-react";
import ChassisLineModal from "./ChassisLineModal";
import SearchSelect from "../../components/useful/SearchSelect";
import CustomSelect from "../../components/useful/CustomSelect";
import { useI18n } from "../../hooks/useI18n";
import { formatMoney, emptySalesLine, salesTotals, lineHT, VAT_RATES } from "./salesShared";
import styles from "./Sales.module.css";

/**
 * Priced lines of a devis or an invoice. A line is an inventory
 * article (its selling price is proposed) or free text (a service,
 * installation, a custom item). Discount is a % off the line.
 */
export default function SalesLinesEditor({ lines, onChange, products = [], companyId = null, allowChassis = false }) {
  const { t } = useI18n();
  // null = closed ; { index: -1 } = new chassis line ; { index } = edit that line
  const [chassisModal, setChassisModal] = useState(null);
  const saveChassis = (line) => {
    if (chassisModal.index === -1) {
      // Replace the empty starter line instead of keeping it.
      const onlyEmpty = lines.length === 1 && !lines[0].description && !lines[0].product && !lines[0].chassis;
      onChange(onlyEmpty ? [line] : [...lines, line]);
    } else onChange(lines.map((l, i) => (i === chassisModal.index ? line : l)));
    setChassisModal(null);
  };
  const productOptions = products.map((p) => ({ value: p._id, label: `${p.name}${p.internalReference ? ` (${p.internalReference})` : ""}` }));
  const update = (index, patch) => onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const pickProduct = (index, productId) => {
    const p = products.find((x) => x._id === productId);
    update(index, {
      product: productId,
      description: p?.name || "",
      unit: p?.unit || "",
      ...(p?.sellingPrice ? { unitPrice: p.sellingPrice } : {}),
    });
  };
  const totals = salesTotals(lines);

  return (
    <div className={styles.linesEditor}>
      <div className={styles.linesHead}>
        <span>{t("sales.lines.article")}</span>
        <span>{t("sales.lines.description")}</span>
        <span>{t("sales.lines.quantity")}</span>
        <span>{t("sales.lines.unit")}</span>
        <span>{t("sales.lines.unitPrice")}</span>
        <span>{t("sales.lines.discount")}</span>
        <span>{t("sales.lines.vat")}</span>
        <span className={styles.right}>{t("sales.lines.totalHT")}</span>
        <span />
      </div>
      {lines.map((line, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className={styles.lineRow}>
          {line.chassis ? (
            <button type="button" className="btnEdit" title={t("prod.editChassisLine")} onClick={() => setChassisModal({ index })} disabled={!companyId}>
              <Boxes size={14} /> {line.chassis.ref ? `${line.chassis.ref} · ` : ""}{line.chassis.L} × {line.chassis.H} <Pencil size={12} />
            </button>
          ) : (
            <SearchSelect value={line.product?._id || line.product || ""} onSelect={(v) => pickProduct(index, v)} options={productOptions}
              icon={Package} placeholder={t("sales.lines.pickArticle")} noResultsLabel={t("common.noResults")} />
          )}
          <input className={styles.cellInput} value={line.description} placeholder={t("sales.lines.descriptionPlaceholder")}
            onChange={(e) => update(index, { description: e.target.value })} />
          <input className={styles.cellInput} type="number" min="0" step="any" value={line.quantity}
            onChange={(e) => update(index, { quantity: e.target.value })} />
          <input className={styles.cellInput} value={line.unit || ""} onChange={(e) => update(index, { unit: e.target.value })} />
          <input className={styles.cellInput} type="number" step="any" value={line.unitPrice ?? ""} placeholder="0.00"
            onChange={(e) => update(index, { unitPrice: e.target.value })} />
          <input className={styles.cellInput} type="number" min="0" max="100" step="any" value={line.discount ?? 0}
            onChange={(e) => update(index, { discount: e.target.value })} />
          <CustomSelect value={String(line.vatRate)} onSelect={(v) => update(index, { vatRate: Number(v) })}
            options={VAT_RATES.map((r) => ({ value: String(r), label: `${r}%` }))} />
          <span className={styles.lineTotal}>{formatMoney(lineHT(line), "")}</span>
          <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")}
            disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, i) => i !== index))}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className={styles.linesFooter}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="btnEdit" onClick={() => onChange([...lines, emptySalesLine()])}>
            <Plus size={14} /> {t("sales.lines.addLine")}
          </button>
          {allowChassis && companyId && (
            <button type="button" className="btnEdit" onClick={() => setChassisModal({ index: -1 })}>
              <Boxes size={14} /> {t("prod.addChassisLine")}
            </button>
          )}
        </div>
        <div className={styles.totals}>
          <span>{t("sales.totals.ht")} <strong>{formatMoney(totals.ht)}</strong></span>
          {totals.breakdown.filter((b) => b.rate > 0).map((b) => (
            <span key={b.rate}>{t("sales.totals.vat")} {b.rate}% <strong>{formatMoney(b.vat)}</strong></span>
          ))}
          <span>{t("sales.totals.ttc")} <strong>{formatMoney(totals.ttc)}</strong></span>
        </div>
      </div>
      {chassisModal && (
        <ChassisLineModal companyId={companyId} line={chassisModal.index === -1 ? null : lines[chassisModal.index]}
          onClose={() => setChassisModal(null)} onSave={saveChassis} />
      )}
    </div>
  );
}
