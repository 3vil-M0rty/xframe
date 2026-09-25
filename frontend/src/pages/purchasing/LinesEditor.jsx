import { useEffect } from "react";
import { Plus, Trash2, Package, AlertTriangle } from "lucide-react";
import SearchSelect from "../../components/useful/SearchSelect";
import CustomSelect from "../../components/useful/CustomSelect";
import { useI18n } from "../../hooks/useI18n";
import { lineTotals, formatMoney, supplierPriceFor, applySupplierPrices } from "./shared";
import styles from "./Purchasing.module.css";

/**
 * Editable order lines, shared by purchase orders and price requests.
 * Each line is either an inventory article (stock moves on reception)
 * or free text (a service, a one-off item — no stock).
 *   priceKey: "unitPrice" (order) | "quotedUnitPrice" (price request)
 *   priceOptional: price requests start without prices
 */
export const emptyLine = () => ({ product: "", description: "", quantity: 1, unit: "", unitPrice: "", quotedUnitPrice: "", vatRate: 20 });

// showPrices=false: a price request being written — you're ASKING the
// supplier for prices, so there's nothing to fill in yet.
//
// supplierName (purchase orders): the order's supplier. An article's
// price is then TAKEN FROM THE INVENTORY — the price recorded on that
// article for that supplier — instead of being typed again. Changing
// the supplier re-applies it. A price the user typed themselves
// (line.priceSource === "manual") is never overwritten.
//   line.priceSource: "article" (auto-filled) | "missing" (article has
//   no price for this supplier) | "manual" | undefined (not set yet)
export default function LinesEditor({ lines, onChange, products, priceKey = "unitPrice", priceOptional = false, showPrices = true, supplierName }) {
  const { t } = useI18n();
  const autoPrice = priceKey === "unitPrice" && supplierName !== undefined;

  const articlePrice = (productId) => supplierPriceFor(products.find((x) => x._id === (productId?._id || productId)), supplierName);

  // Re-apply inventory prices when the supplier (or the article list)
  // changes — only on lines that weren't priced by hand.
  useEffect(() => {
    if (!autoPrice || !supplierName) return;
    const { lines: next, changed } = applySupplierPrices(lines, products, supplierName);
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierName, products, lines.length]);
  const productOptions = products.map((p) => ({
    value: p._id,
    label: `${p.name}${p.internalReference ? ` (${p.internalReference})` : ""}`,
  }));

  const update = (index, patch) => onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const pickProduct = (index, productId) => {
    const p = products.find((x) => x._id === productId);
    const patch = { product: productId, description: p?.name || "", unit: p?.unit || "" };
    if (autoPrice && supplierName) {
      const price = articlePrice(productId);
      Object.assign(patch, price !== null ? { unitPrice: price, priceSource: "article" } : { unitPrice: "", priceSource: "missing" });
    } else if (autoPrice) {
      Object.assign(patch, { unitPrice: "", priceSource: undefined }); // filled once a supplier is chosen
    }
    update(index, patch);
  };

  const missingCount = autoPrice && supplierName ? lines.filter((l) => l.product && l.priceSource === "missing").length : 0;

  const totals = lineTotals(lines, priceKey);

  return (
    <div className={styles.linesEditor}>
      <div className={showPrices ? styles.linesHead : styles.linesHeadNoPrice}>
        <span>{t("purchasing.lines.article")}</span>
        <span>{t("purchasing.lines.description")}</span>
        <span>{t("purchasing.lines.quantity")}</span>
        <span>{t("purchasing.lines.unit")}</span>
        {showPrices && <span>{priceKey === "unitPrice" ? t("purchasing.lines.unitPrice") : t("purchasing.lines.quotedPrice")}</span>}
        {showPrices && <span>{t("purchasing.lines.vat")}</span>}
        <span />
      </div>
      {lines.map((line, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className={showPrices ? styles.lineRow : styles.lineRowNoPrice}>
          <SearchSelect
            value={line.product?._id || line.product || ""}
            onSelect={(v) => pickProduct(index, v)}
            options={productOptions}
            icon={Package}
            placeholder={t("purchasing.lines.pickArticle")}
            noResultsLabel={t("common.noResults")}
          />
          <input className={styles.cellInput} value={line.description} placeholder={t("purchasing.lines.descriptionPlaceholder")}
            onChange={(e) => update(index, { description: e.target.value })} />
          <input className={styles.cellInput} type="number" min="0" step="any" value={line.quantity}
            onChange={(e) => update(index, { quantity: e.target.value })} />
          <input className={styles.cellInput} value={line.unit || ""} onChange={(e) => update(index, { unit: e.target.value })} />
          {showPrices && (
            <input
              className={`${styles.cellInput} ${autoPrice && line.priceSource === "missing" ? styles.cellMissing : ""} ${autoPrice && line.priceSource === "article" ? styles.cellFromArticle : ""}`}
              type="number" min="0" step="any" value={line[priceKey] ?? ""}
              title={autoPrice && line.priceSource === "article" ? t("purchasing.lines.priceFromArticle") : undefined}
              placeholder={autoPrice && line.priceSource === "missing" ? t("purchasing.lines.noPriceShort") : priceOptional ? "—" : "0.00"}
              onChange={(e) => update(index, { [priceKey]: e.target.value, ...(autoPrice ? { priceSource: "manual" } : {}) })} />
          )}
          {showPrices && (
            <CustomSelect value={String(line.vatRate)} onSelect={(v) => update(index, { vatRate: Number(v) })}
              options={[20, 14, 10, 7, 0].map((r) => ({ value: String(r), label: `${r}%` }))} />
          )}
          <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")}
            disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, i) => i !== index))}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {autoPrice && !supplierName && lines.some((l) => l.product) && (
        <p className={styles.muted}>{t("purchasing.lines.pickSupplierForPrices")}</p>
      )}
      {missingCount > 0 && (
        <p className={styles.priceWarning}>
          <AlertTriangle size={13} /> {t("purchasing.lines.missingPrices").replace("{count}", missingCount).replace("{supplier}", supplierName)}
        </p>
      )}
      <div className={styles.linesFooter}>
        <button type="button" className="btnEdit" onClick={() => onChange([...lines, emptyLine()])}>
          <Plus size={14} /> {t("purchasing.lines.addLine")}
        </button>
        {showPrices && <div className={styles.totals}>
          <span>{t("purchasing.totals.ht")}: <strong>{formatMoney(totals.ht)}</strong></span>
          <span>{t("purchasing.totals.vat")}: <strong>{formatMoney(totals.vat)}</strong></span>
          <span>{t("purchasing.totals.ttc")}: <strong>{formatMoney(totals.ttc)}</strong></span>
        </div>}
      </div>
    </div>
  );
}
