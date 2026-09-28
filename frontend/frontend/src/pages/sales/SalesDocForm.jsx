import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FileSignature, Receipt, Save } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import SalesLinesEditor from "./SalesLinesEditor";
import { getCustomers, getQuote, createQuote, updateQuote, getInvoice, createInvoice, updateInvoice } from "../../services/salesService";
import { useCompanyPicker, useCompanyProducts, emptySalesLine, cleanLines, toInputDate, todayInput } from "./salesShared";
import styles from "../purchasing/Purchasing.module.css";

/**
 * Create / edit a devis (kind="quote") or a draft invoice / credit note
 * (kind="invoice"). Same form: customer, dates, subject, lines, terms.
 */
export default function SalesDocForm({ kind }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isQuote = kind === "quote";
  const { companyId: pickedCompany, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [companyId, setLocalCompany] = useState(location.state?.companyId || "");
  const effectiveCompany = companyId || pickedCompany;
  const products = useCompanyProducts(effectiveCompany);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState({
    customer: location.state?.customerId || "",
    date: todayInput(),
    validUntil: "",
    dueDate: "",
    subject: "",
    type: location.state?.type || "invoice",
    lines: [emptySalesLine()],
    paymentTerms: "",
    notes: "",
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const d = isQuote ? await getQuote(id) : await getInvoice(id);
        setLocalCompany(d.company);
        setDoc({
          customer: d.customer?._id || d.customer,
          date: toInputDate(d.date),
          validUntil: toInputDate(d.validUntil),
          dueDate: toInputDate(d.dueDate),
          subject: d.subject || "",
          type: d.type,
          lines: d.lines.map((l) => ({ ...l, product: l.product?._id || l.product || "" })),
          paymentTerms: d.paymentTerms || "",
          notes: d.notes || "",
        });
      } catch (err) {
        setError(err.response?.data?.message || t("sales.errors.load"));
      }
    })();
  }, [id, isQuote, t]);

  useEffect(() => {
    if (!effectiveCompany) return;
    getCustomers(effectiveCompany, { active: "true" }).then(setCustomers).catch(() => setCustomers([]));
  }, [effectiveCompany]);

  const set = (k) => (e) => setDoc({ ...doc, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        customer: doc.customer,
        date: doc.date,
        subject: doc.subject,
        lines: cleanLines(doc.lines),
        paymentTerms: doc.paymentTerms,
        notes: doc.notes,
        ...(isQuote ? { validUntil: doc.validUntil || undefined } : { dueDate: doc.dueDate || undefined, type: doc.type }),
      };
      let saved;
      if (isQuote) saved = id ? await updateQuote(id, payload) : await createQuote({ ...payload, company: effectiveCompany });
      else saved = id ? await updateInvoice(id, payload) : await createInvoice({ ...payload, company: effectiveCompany });
      navigate(isQuote ? `/sales/quotes/${saved._id}` : `/sales/invoices/${saved._id}`);
    } catch (err) {
      setError(err.response?.data?.message || t("sales.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const title = isQuote
    ? (id ? t("sales.quotes.edit") : t("sales.quotes.new"))
    : (id ? t("sales.invoices.edit") : doc.type === "credit_note" ? t("sales.invoices.newCredit") : t("sales.invoices.new"));
  const Icon = isQuote ? FileSignature : Receipt;

  return (
    <div className="pageShell">
      <Breadcrumbs items={[
        { label: t("sidebar.sales"), href: "/sales/quotes" },
        { label: isQuote ? t("sales.quotes.title") : t("sales.invoices.title"), href: isQuote ? "/sales/quotes" : "/sales/invoices" },
        { label: title },
      ]} />
      <div className="pageHeader">
        <div className="pageTitleRow"><Icon size={20} /><h1>{title}</h1></div>
      </div>

      {error && <div className="errorMessage">{error}</div>}

      <form onSubmit={save}>
        <div className={styles.formGrid}>
          {!id && !location.state?.companyId && (
            <label className={styles.field}>{t("employees.toolbar.company")}
              <CustomSelect value={pickedCompany} onSelect={setCompanyId} options={companyOptions} />
            </label>
          )}
          <label className={styles.field}>{t("sales.customer")}
            <SearchSelect value={doc.customer} onSelect={(v) => setDoc({ ...doc, customer: v })}
              options={customers.map((c) => ({ value: c._id, label: c.name }))} placeholder={t("sales.pickCustomer")} noResultsLabel={t("sales.noCustomer")} />
          </label>
          <label className={styles.field}>{t("sales.date")}<input className={styles.input} type="date" required value={doc.date} onChange={set("date")} /></label>
          {isQuote
            ? <label className={styles.field}>{t("sales.validUntil")}<input className={styles.input} type="date" value={doc.validUntil} onChange={set("validUntil")} placeholder={t("sales.quotes.validDefault")} /></label>
            : doc.type !== "credit_note" && <label className={styles.field}>{t("sales.dueDate")}<input className={styles.input} type="date" value={doc.dueDate} onChange={set("dueDate")} /></label>}
          <label className={styles.field} style={{ gridColumn: "span 2" }}>{t("sales.subject")}<input className={styles.input} value={doc.subject} onChange={set("subject")} /></label>
        </div>
        {isQuote && !doc.validUntil && <p className={styles.muted}>{t("sales.quotes.validDefault")}</p>}
        {!isQuote && doc.type !== "credit_note" && !doc.dueDate && <p className={styles.muted}>{t("sales.invoices.dueDefault")}</p>}

        <h2 className={styles.subTitle}>{t("sales.lines.title")}</h2>
        <SalesLinesEditor lines={doc.lines} onChange={(lines) => setDoc({ ...doc, lines })} products={products}
          companyId={effectiveCompany} allowChassis />

        <div className={styles.formGrid}>
          <label className={styles.field} style={{ gridColumn: "span 2" }}>{t("sales.paymentTerms")}
            <input className={styles.input} value={doc.paymentTerms} onChange={set("paymentTerms")} placeholder={t("sales.paymentTermsPlaceholder")} />
          </label>
          <label className={styles.field} style={{ gridColumn: "span 2" }}>{t("sales.notes")}
            <textarea className={styles.input} rows={2} value={doc.notes} onChange={set("notes")} />
          </label>
        </div>

        <div className={styles.formActions}>
          <button type="button" className="btnCancel" onClick={() => navigate(-1)}>{t("common.cancel")}</button>
          <button type="submit" className="btnPrimary" disabled={saving || !doc.customer}><Save size={15} /> {t("common.save")}</button>
        </div>
      </form>
    </div>
  );
}
