import { useCallback, useEffect, useState } from "react";
import { Truck, Plus, Pencil, Trash2, FileText, FolderOpen } from "lucide-react";
import { SupplierStatementModal, SupplierDocumentsModal, supplierDocAlert } from "./SupplierPanels";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import StatusPill from "../../components/useful/StatusPill";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../../services/purchasingService";
import { useCompanyPicker } from "./shared";
import styles from "./Purchasing.module.css";

const FIELDS = [
  { key: "name", required: true },
  { key: "contactName" },
  { key: "phone" },
  { key: "email", type: "email" },
  { key: "city" },
  { key: "address" },
  { key: "ice" },
  { key: "identifiantFiscal" },
  { key: "rc" },
  { key: "paymentTerms" },
  // days until an invoice is due (Loi 69-21: 60 by default, 120 max by agreement)
  { key: "paymentDays", type: "number" },
];
const EMPTY = Object.fromEntries([...FIELDS.map((f) => [f.key, ""]), ["paymentDays", 60], ["notes", ""], ["isActive", true]]);

/** Fournisseurs. A supplier with orders is deactivated, never deleted. */
export default function Suppliers() {
  const { t } = useI18n();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [search, setSearch] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | supplier
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [statementFor, setStatementFor] = useState(null);
  const [documentsFor, setDocumentsFor] = useState(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try { setList(await getSuppliers(companyId, { search })); } catch (err) { setError(err.response?.data?.message || t("purchasing.errors.load")); } finally { setLoading(false); }
  }, [companyId, search, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openForm = (supplier) => {
    setEditing(supplier || "new");
    setForm(supplier ? { ...EMPTY, ...supplier } : EMPTY);
    setError("");
    setNotice("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing === "new") await createSupplier({ ...form, company: companyId });
      else await updateSupplier(editing._id, form);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (supplier) => {
    if (!window.confirm(t("purchasing.suppliers.deleteConfirm").replace("{name}", supplier.name))) return;
    try {
      const res = await deleteSupplier(supplier._id);
      setNotice(res.deactivated ? t("purchasing.suppliers.deactivated") : "");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.save"));
    }
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.suppliers.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Truck size={20} /><h1>{t("purchasing.suppliers.title")}</h1></div>
          <p className="pageSubtitle">{t("purchasing.suppliers.subtitle")}</p>
        </div>
        {companyId && !editing && (
          <button type="button" className="btnPrimary" onClick={() => openForm(null)}><Plus size={15} /> {t("purchasing.suppliers.new")}</button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
        <div className="filterGroup">
          <label>{t("purchasing.suppliers.search")}</label>
          <input className={styles.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("purchasing.suppliers.searchPlaceholder")} />
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.infoBanner}>{notice}</div>}

      {editing && (
        <div className={styles.panel}>
          <h3>{editing === "new" ? t("purchasing.suppliers.new") : editing.name}</h3>
          <div className={styles.formGrid}>
            {FIELDS.map((f) => (
              <label key={f.key} className={styles.field}>
                <span>{t(`purchasing.suppliers.fields.${f.key}`)}{f.required && " *"}</span>
                <input className={styles.input} type={f.type || "text"} min={f.type === "number" ? 0 : undefined}
                  value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value })} />
                {f.key === "paymentDays" && Number(form.paymentDays) > 60 && (
                  <small className={Number(form.paymentDays) > 120 ? styles.amountDue : styles.muted}>
                    {Number(form.paymentDays) > 120 ? t("purchasing.legal.over_maxHint") : t("purchasing.legal.needs_agreementHint")}
                  </small>
                )}
              </label>
            ))}
          </div>
          <label className={styles.field}>
            <span>{t("purchasing.columns.note")}</span>
            <textarea className={styles.input} rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          {editing !== "new" && (
            <label className={styles.inlineCheck}>
              <input type="checkbox" className="switchToggle" checked={!!form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>{t("purchasing.suppliers.active")}</span>
            </label>
          )}
          <div className={styles.formActions}>
            <button type="button" className="btnCancel" onClick={() => setEditing(null)}>{t("common.cancel")}</button>
            <button type="button" className="btnPrimary" disabled={saving || !form.name?.trim()} onClick={save}>{t("common.save")}</button>
          </div>
        </div>
      )}

      {loading && <p className={styles.muted}>{t("common.loading")}</p>}
      {!loading && list.length === 0 && (
        <div className="emptyStateBlock"><div className="emptyStateIcon"><Truck size={28} /></div><h2>{t("purchasing.suppliers.empty")}</h2></div>
      )}
      {!loading && list.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 1.2fr 0.8fr 150px" }}>
            <span>{t("purchasing.suppliers.fields.name")}</span>
            <span>{t("purchasing.suppliers.fields.contactName")}</span>
            <span>{t("purchasing.suppliers.fields.phone")}</span>
            <span>{t("purchasing.suppliers.fields.city")}</span>
            <span>{t("purchasing.suppliers.fields.paymentTerms")}</span>
            <span>{t("purchasing.columns.status")}</span>
            <span />
          </div>
          {list.map((s) => (
            <div key={s._id} className="dataTableRow" style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 1.2fr 0.8fr 150px" }}>
              <span><strong>{s.name}</strong>{s.ice && <small className={styles.muted}> ICE {s.ice}</small>}</span>
              <span className="dataTableCellMuted">{s.contactName || "—"}{s.email && <small> · {s.email}</small>}</span>
              <span className="dataTableCellMuted">{s.phone || "—"}</span>
              <span className="dataTableCellMuted">{s.city || "—"}</span>
              <span className="dataTableCellMuted">{s.paymentTerms || "—"}</span>
              <span><StatusPill status={s.isActive ? "accepted" : "neutral"} label={s.isActive ? t("purchasing.suppliers.active") : t("purchasing.suppliers.inactive")} /></span>
              <span className="dataTableActions">
                <button type="button" className="tableActionBtn" title={t("purchasing.statement.title")} onClick={() => setStatementFor(s)}><FileText size={13} /></button>
                <button type="button" className={`tableActionBtn ${supplierDocAlert(s) ? styles[`docBtn_${supplierDocAlert(s)}`] : ""}`}
                  title={supplierDocAlert(s) ? t(`purchasing.supplierDocs.state.${supplierDocAlert(s)}`) : t("purchasing.supplierDocs.title")}
                  onClick={() => setDocumentsFor(s)}><FolderOpen size={13} /></button>
                <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => openForm(s)}><Pencil size={13} /></button>
                <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => remove(s)}><Trash2 size={13} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
      {statementFor && <SupplierStatementModal supplier={statementFor} onClose={() => setStatementFor(null)} />}
      {documentsFor && (
        <SupplierDocumentsModal supplier={documentsFor} onClose={() => setDocumentsFor(null)}
          onChanged={(updated) => setList((l) => l.map((x) => (x._id === updated._id ? updated : x)))} />
      )}
    </div>
  );
}
