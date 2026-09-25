import { useEffect, useState } from "react";
import { getCompanies } from "../../services/companyService";
import { getProducts } from "../../services/productService";

// Helpers shared by the purchasing (achats) pages.

/** Companies + the selected one (first by default). */
export function useCompanyPicker() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const list = await getCompanies();
        const arr = Array.isArray(list) ? list : [];
        setCompanies(arr);
        if (arr.length) setCompanyId((current) => current || arr[0]._id);
      } catch (err) {
        console.error("Failed to load companies:", err);
      }
    })();
  }, []);
  const options = companies.map((c) => ({ value: c._id, label: c.name }));
  return { companies, companyId, setCompanyId, options };
}

/** Inventory articles of a company, for the article pickers. */
export function useCompanyProducts(companyId) {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    if (!companyId) { setProducts([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { products: list } = await getProducts({ companyId, page: 1, limit: 500 });
        if (!cancelled) setProducts(list);
      } catch (err) {
        console.error("Failed to load products:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);
  return products;
}

export const formatMoney = (value, currency = "MAD") =>
  `${(Number(value) || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "—");
export const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");
export const todayInput = () => new Date().toISOString().slice(0, 10);

/** Maps a business status onto the StatusPill colour variants. */
export const PILL = {
  // purchase requests
  pending: "pending", delayed: "manager_approved", ordered: "accepted", approved: "accepted",
  declined: "rejected", rejected: "rejected", received: "accepted",
  // purchase orders
  draft: "neutral", pending_approval: "pending", sent: "manager_approved", partially_received: "pending", cancelled: "rejected",
  // payment
  unpaid: "rejected", partially_paid: "pending", paid: "accepted",
  // price requests
  answered: "manager_approved", accepted: "accepted",
};

export const PAYMENT_METHODS = ["virement", "cheque", "especes", "effet", "carte", "autre"];

export const lineOutstanding = (l) => Math.max((l.quantity || 0) - ((l.receivedQuantity || 0) - (l.returnedQuantity || 0)), 0);

export function lineTotals(lines, priceKey = "unitPrice") {
  let ht = 0;
  let vat = 0;
  for (const l of lines) {
    const lineHt = (Number(l.quantity) || 0) * (Number(l[priceKey]) || 0);
    ht += lineHt;
    vat += lineHt * ((Number(l.vatRate) || 0) / 100);
  }
  const r = (n) => Math.round(n * 100) / 100;
  return { ht: r(ht), vat: r(vat), ttc: r(ht + vat) };
}

/**
 * The price recorded in the inventory for `product` at `supplierName`
 * (article.prices[].supplierName), or null if that supplier has none.
 */
export function supplierPriceFor(product, supplierName) {
  const entry = product?.prices?.find((p) => p.supplierName === supplierName);
  return entry ? entry.price : null;
}

/**
 * Applies inventory prices to purchase-order lines for the order's
 * supplier. Lines priced by hand (priceSource "manual") and free-text
 * lines (no article) are left alone. Returns { lines, changed }.
 */
export function applySupplierPrices(lines, products, supplierName) {
  if (!supplierName) return { lines, changed: false };
  let changed = false;
  const next = lines.map((l) => {
    if (!l.product || l.priceSource === "manual") return l;
    const product = products.find((p) => p._id === (l.product?._id || l.product));
    const price = supplierPriceFor(product, supplierName);
    const patch = price !== null ? { unitPrice: price, priceSource: "article" } : { unitPrice: "", priceSource: "missing" };
    if (l.unitPrice === patch.unitPrice && l.priceSource === patch.priceSource) return l;
    changed = true;
    return { ...l, ...patch };
  });
  return { lines: next, changed };
}
