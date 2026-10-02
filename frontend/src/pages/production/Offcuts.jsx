import { useCallback, useEffect, useState } from "react";
import { Scissors, Plus, Trash2, Package } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import { useDialog } from "../../components/useful/DialogProvider";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import { getOffcuts, createOffcut, deleteOffcut } from "../../services/productionFlowService";
import { getCatalogArticles } from "../../services/productionService";
import { useCompanyPicker, fmtMm, articleLabel } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";

/**
 * Reusable offcuts (chutes): pieces of profile kept after cutting, raw or
 * lacquered. The person issuing bars for a project picks them; the
 * Aluminium workshop puts back the reusable offcuts of its cutting plan.
 */
export default function Offcuts() {
  const { t } = useI18n();
  const can = useCan();
  const dialog = useDialog();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [rows, setRows] = useState([]);
  const [articles, setArticles] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ product: "", length: "", quantity: 1, location: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    try { setRows(await getOffcuts(companyId, filter ? { product: filter } : {})); } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  }, [companyId, filter, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (companyId) getCatalogArticles(companyId, { materialType: "profile", variants: "true" }).then(setArticles).catch(() => setArticles([])); }, [companyId]);
  const options = articles.map((a) => ({ value: a._id, label: articleLabel(a) }));

  const add = async (e) => {
    e.preventDefault();
    setError("");
    try { await createOffcut({ company: companyId, ...form }); setForm({ ...form, length: "", quantity: 1 }); load(); } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const remove = async (row) => {
    if (!(await dialog.confirm(t("flowUi.offcutDeleteConfirm")))) return;
    try { await deleteOffcut(row._id); load(); } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const total = rows.reduce((a, r) => a + r.quantity, 0);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/workshops" }, { label: t("flowUi.offcuts") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Scissors size={20} /><h1>{t("flowUi.offcuts")}</h1></div>
          <p className="pageSubtitle">{t("flowUi.offcutsSubtitle")}</p>
        </div>
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup"><label>{t("employees.toolbar.company")}</label><CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} /></div>
        <div className="filterGroup" style={{ minWidth: 280 }}><label>{t("prod.editor.article")}</label><SearchSelect value={filter} onSelect={(v) => setFilter(v || "")} options={[{ value: "", label: t("sales.all") }, ...options]} icon={Package} placeholder={t("sales.all")} noResultsLabel={t("common.noResults")} /></div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {can("production.flow.offcuts") && (
        <form className={s.inlineForm} onSubmit={add} style={{ marginBottom: 12 }}>
          <label className={s.grow}>{t("prod.editor.article")}<SearchSelect value={form.product} onSelect={(v) => setForm({ ...form, product: v })} options={options} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} /></label>
          <label>{t("cut.length")} (mm)<input type="number" min="1" required value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} /></label>
          <label>{t("prod.quantity")}<input type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
          <label>{t("flowUi.location")}<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Rack A" /></label>
          <button type="submit" className="btnPrimary" disabled={!form.product || !form.length}><Plus size={14} /> {t("flowUi.addOffcut")}</button>
        </form>
      )}
      <p className={s.muted}>{t("flowUi.offcutsCount").replace("{n}", total)}</p>
      <div className={styles.tableWrap}>
        <table className={styles.needTable}>
          <thead><tr><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("cut.length")} (mm)</th><th className={styles.num}>{t("prod.quantity")}</th><th>{t("flowUi.location")}</th><th>{t("flowUi.origin")}</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.product?.name}{r.product?.internalReference && <small>{r.product.internalReference}</small>}</td>
                <td className={styles.num}><strong>{fmtMm(r.length)}</strong></td>
                <td className={styles.num}>{r.quantity}</td>
                <td>{r.location || "—"}</td>
                <td className={s.muted}>{r.sourceProject?.number || r.note || "—"}</td>
                <td>{can("production.flow.offcuts") && <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => remove(r)}><Trash2 size={13} /></button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className={s.muted}>{t("flowUi.noOffcuts")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
