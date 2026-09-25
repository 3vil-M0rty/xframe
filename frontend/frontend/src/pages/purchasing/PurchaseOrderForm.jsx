import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FileText, ArrowLeft } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import { getSuppliers, getOrder, createOrder, updateOrder } from "../../services/purchasingService";
import LinesEditor, { emptyLine } from "./LinesEditor";
import { useCompanyProducts, todayInput, toInputDate } from "./shared";
import styles from "./Purchasing.module.css";

/**
 * Create or edit a bon de commande. Opened from the request queue it
 * arrives with the selected requests: one line per request is pre-
 * filled, and saving links them (they become "ordered" and production
 * is notified).
 */
export default function PurchaseOrderForm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  const editing = !!id;

  const [companyId, setCompanyId] = useState(state?.companyId || "");
  const [suppliers, setSuppliers] = useState([]);
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(todayInput());
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [linkedRequests, setLinkedRequests] = useState(state?.requests || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const products = useCompanyProducts(companyId);

  // Pre-fill from a restocking suggestion (Réapprovisionnement)
  useEffect(() => {
    if (editing || !state?.prefill?.lines?.length) return;
    setLines(state.prefill.lines.map((l) => ({ ...emptyLine(), ...l })));
  }, [editing, state]);
  useEffect(() => {
    if (editing || !state?.prefill?.supplierName || supplier) return;
    const match = suppliers.find((x) => x.name === state.prefill.supplierName);
    if (match) setSupplier(match._id);
  }, [editing, state, suppliers, supplier]);

  // Pre-fill from selected purchase requests
  useEffect(() => {
    if (editing || !state?.requests?.length) return;
    setLines(state.requests.map((r) => ({
      ...emptyLine(),
      product: r.product?._id || "",
      description: r.product?.name || "",
      unit: r.product?.unit || "",
      quantity: r.requestedQuantity,
    })));
  }, [editing, state]);

  // Editing: load the order
  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const o = await getOrder(id);
        setCompanyId(o.company);
        setSupplier(o.supplier?._id || o.supplier);
        setDate(toInputDate(o.date));
        setExpectedDate(toInputDate(o.expectedDate));
        setNotes(o.notes || "");
        setLines(o.lines.map((l) => ({ ...l, product: l.product?._id || l.product || "", priceSource: "manual" })));
        setLinkedRequests([]);
      } catch (err) {
        setError(err.response?.data?.message || t("purchasing.errors.load"));
      }
    })();
  }, [editing, id, t]);

  useEffect(() => {
    if (!companyId) return;
    getSuppliers(companyId, { active: "true" }).then(setSuppliers).catch(() => setSuppliers([]));
  }, [companyId]);

  const payloadLines = () => lines.map((l) => ({
    product: l.product || null,
    description: l.description,
    quantity: Number(l.quantity),
    unit: l.unit,
    unitPrice: l.unitPrice === "" ? NaN : Number(l.unitPrice),
    vatRate: Number(l.vatRate),
  }));

  const save = async (send) => {
    setError("");
    if (!supplier) { setError(t("purchasing.orders.form.supplierRequired")); return; }
    setSaving(true);
    try {
      const body = { supplier, date, expectedDate: expectedDate || null, notes, lines: payloadLines() };
      const saved = editing
        ? await updateOrder(id, body)
        : await createOrder({ ...body, company: companyId, send, purchaseRequestIds: linkedRequests.map((r) => r._id) });
      navigate(`/purchasing/orders/${saved._id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t("purchasing.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  if (!companyId && !editing) {
    return (
      <div className="pageShell">
        <p className={styles.muted}>{t("purchasing.orders.form.noCompany")}</p>
        <button type="button" className="btnEdit" onClick={() => navigate("/purchasing/orders")}>{t("common.back")}</button>
      </div>
    );
  }

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("purchasing.orders.title"), href: "/purchasing/orders" }, { label: editing ? t("purchasing.orders.form.editTitle") : t("purchasing.orders.new") }]} />
      <button type="button" className="btnBack" onClick={() => navigate(editing ? `/purchasing/orders/${id}` : "/purchasing/orders")}>
        <ArrowLeft size={16} /> {t("common.back")}
      </button>
      <div className="pageHeader">
        <div className="pageTitleRow"><FileText size={20} /><h1>{editing ? t("purchasing.orders.form.editTitle") : t("purchasing.orders.new")}</h1></div>
      </div>

      {linkedRequests.length > 0 && (
        <div className={styles.infoBanner}>
          {t("purchasing.orders.form.fromRequests").replace("{count}", linkedRequests.length)}
        </div>
      )}

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>{t("purchasing.columns.supplier")} *</span>
          <CustomSelect value={supplier} onSelect={setSupplier} placeholder={t("purchasing.orders.form.pickSupplier")}
            options={suppliers.map((s) => ({ value: s._id, label: s.name }))} />
          {suppliers.length === 0 && <small className={styles.muted}>{t("purchasing.orders.form.noSuppliers")}</small>}
        </label>
        <label className={styles.field}>
          <span>{t("purchasing.columns.date")}</span>
          <input type="date" className={styles.input} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>{t("purchasing.orders.form.expectedDate")}</span>
          <input type="date" className={styles.input} value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </label>
      </div>

      <LinesEditor lines={lines} onChange={setLines} products={products}
        supplierName={suppliers.find((s) => s._id === supplier)?.name || ""} />

      <label className={styles.field}>
        <span>{t("purchasing.columns.note")}</span>
        <textarea className={styles.input} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error && <div className="errorMessage">{error}</div>}

      <div className={styles.formActions}>
        <button type="button" className="btnCancel" onClick={() => navigate(-1)}>{t("common.cancel")}</button>
        {editing ? (
          <button type="button" className="btnPrimary" disabled={saving} onClick={() => save(false)}>{t("common.save")}</button>
        ) : (
          <>
            <button type="button" className="btnEdit" disabled={saving} onClick={() => save(false)}>{t("purchasing.orders.form.saveDraft")}</button>
            <button type="button" className="btnPrimary" disabled={saving} onClick={() => save(true)}>{t("purchasing.orders.form.saveAndSend")}</button>
          </>
        )}
      </div>
    </div>
  );
}
