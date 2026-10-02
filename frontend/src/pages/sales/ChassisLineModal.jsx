import { useEffect, useRef, useState } from "react";
import { Calculator, AlertTriangle } from "lucide-react";
import CustomSelect from "../../components/useful/CustomSelect";
import { useI18n } from "../../hooks/useI18n";
import { priceChassis } from "../../services/productionService";
import ChassisConfigurator from "../production/ChassisConfigurator";
import useChassisData from "../production/useChassisData";
import { formatMoney, VAT_RATES } from "./salesShared";
import purch from "../purchasing/Purchasing.module.css";
import prod from "../production/Production.module.css";

/**
 * Adds / edits a CHASSIS line on a devis or invoice: pick a model of the
 * catalogue, its size, colour and options — the price is proposed from
 * the model's pricing rule (cost of materials + lacquer + labour ×
 * coefficient, or per m² / ml / unit) and stays editable.
 */
export default function ChassisLineModal({ companyId, line, onClose, onSave }) {
  const { t } = useI18n();
  const { models, finishes, articles, families, glassTypes, loading } = useChassisData(companyId);
  const [spec, setSpec] = useState(() => (line?.chassis
    ? { ...line.chassis, quantity: line.quantity, model: line.chassis.model?._id || line.chassis.model, finish: line.chassis.finish?._id || line.chassis.finish || "" }
    : { model: "", ref: "", L: 1200, H: 1000, quantity: 1, finish: "", params: {} }));
  const [price, setPrice] = useState(null);
  const [description, setDescription] = useState(line?.description || "");
  const [descTouched, setDescTouched] = useState(!!line);
  const [unitPrice, setUnitPrice] = useState(line?.unitPrice ?? "");
  const [priceTouched, setPriceTouched] = useState(!!line);
  const [vatRate, setVatRate] = useState(line?.vatRate ?? 20);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  // New line: start with the company's default colour.
  useEffect(() => {
    if (line || spec.finish || !finishes.length) return;
    const def = finishes.find((f) => f.isDefault && f.isActive !== false);
    if (def) setSpec((sp) => ({ ...sp, finish: def._id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishes]);

  const compute = async () => {
    if (!spec.model || !(Number(spec.L) > 0) || !(Number(spec.H) > 0)) return;
    setBusy(true);
    setError("");
    try {
      const r = await priceChassis(spec.model, { L: spec.L, H: spec.H, finish: spec.finish || null, params: spec.params });
      setPrice(r);
      if (!descTouched) setDescription(r.description);
      if (!priceTouched) setUnitPrice(r.unitPrice);
      if (!line) setVatRate(r.vatRate ?? 20);
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.price"));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(compute, 450);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.model, spec.L, spec.H, spec.finish, JSON.stringify(spec.params)]);

  const save = () => {
    if (!spec.model) return setError(t("prod.pickModel"));
    if (!(Number(spec.L) > 0 && Number(spec.H) > 0)) return setError(t("prod.errors.size"));
    if (!(Number(spec.quantity) >= 1)) return setError(t("prod.errors.quantity"));
    if (!String(description).trim()) return setError(t("prod.errors.description"));
    const model = models.find((m) => String(m._id) === String(spec.model));
    onSave({
      ...(line || {}),
      product: null,
      description: String(description).trim(),
      quantity: Number(spec.quantity),
      unit: model?.unit || "u",
      unitPrice: Number(unitPrice) || 0,
      discount: line?.discount ?? 0,
      vatRate: Number(vatRate),
      chassis: { model: spec.model, ref: spec.ref || "", L: Number(spec.L), H: Number(spec.H), finish: spec.finish || null, params: spec.params || {} },
    });
  };

  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={prod.modalWide}>
        <h3>{line ? t("prod.editChassisLine") : t("prod.addChassisLine")}</h3>
        {!loading && models.length === 0 && <div className={purch.infoBanner}>{t("prod.noModels")}</div>}
        <ChassisConfigurator value={spec} onChange={setSpec} models={models} finishes={finishes} articles={articles} families={families} glassTypes={glassTypes} />

        <div className={prod.priceBox}>
          {busy && <span className={purch.muted}>{t("prod.pricing")}…</span>}
          {price && (
            <>
              <div><span>{t("prod.cost.materials")}</span><span>{formatMoney(price.cost.materials)}</span></div>
              {price.cost.lacquer > 0 && <div><span>{t("prod.cost.lacquer")}</span><span>{formatMoney(price.cost.lacquer)}</span></div>}
              <div><span>{t("prod.cost.labour")} ({Math.round(price.labourMinutes)} min)</span><span>{formatMoney(price.cost.labour)}</span></div>
              <div><strong>{t("prod.cost.total")}</strong><strong>{formatMoney(price.cost.total)}</strong></div>
              <div className={prod.big}><span>{t("prod.proposedPrice")} <small className={purch.muted}>({price.basis})</small></span><span>{formatMoney(price.unitPrice)}</span></div>
              {price.marginPercent !== null && <div><span>{t("prod.margin")}</span><span>{price.marginPercent} %</span></div>}
              {price.missingPrices?.length > 0 && <div className={prod.unmapped}><span><AlertTriangle size={13} /> {t("prod.missingPrices")}: {price.missingPrices.slice(0, 4).join(", ")}{price.missingPrices.length > 4 ? "…" : ""}</span></div>}
              {price.errors?.length > 0 && <ul className={prod.errList}>{price.errors.slice(0, 5).map((e, i) => <li key={i}>{e.where} — {e.message}</li>)}</ul>}
              {price.warnings?.length > 0 && <ul className={prod.warnList}>{price.warnings.slice(0, 5).map((w, i) => <li key={i}>{w.message}</li>)}</ul>}
            </>
          )}
        </div>

        <div className={purch.formGrid} style={{ marginTop: 12 }}>
          <label className={purch.field} style={{ gridColumn: "1 / -1" }}>{t("sales.lines.description")}
            <textarea className={purch.input} rows={2} value={description} onChange={(e) => { setDescription(e.target.value); setDescTouched(true); }} />
          </label>
          <label className={purch.field}>{t("sales.lines.unitPrice")}
            <input className={purch.input} type="number" step="any" min="0" value={unitPrice} onChange={(e) => { setUnitPrice(e.target.value); setPriceTouched(true); }} />
          </label>
          <label className={purch.field}>{t("sales.lines.vat")}
            <CustomSelect value={String(vatRate)} onSelect={(v) => setVatRate(Number(v))} options={VAT_RATES.map((r) => ({ value: String(r), label: `${r}%` }))} />
          </label>
        </div>
        {price && priceTouched && Number(unitPrice) !== price.unitPrice && (
          <button type="button" className="btnEdit" onClick={() => { setUnitPrice(price.unitPrice); setPriceTouched(false); }}><Calculator size={14} /> {t("prod.useProposed")} ({formatMoney(price.unitPrice)})</button>
        )}
        {error && <div className="errorMessage" style={{ marginTop: 10 }}>{error}</div>}
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btnPrimary" onClick={save}>{line ? t("common.save") : t("prod.addToQuote")}</button>
        </div>
      </div>
    </div>
  );
}
