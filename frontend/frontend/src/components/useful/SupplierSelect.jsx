import { useEffect, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import { getSuppliers } from "../../services/purchasingService";
import CustomSelect from "./CustomSelect";

/** Active suppliers of a company, loaded once per company. */
export function useCompanySuppliers(companyId) {
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => {
    if (!companyId) { setSuppliers([]); return; }
    let cancelled = false;
    getSuppliers(companyId, { active: "true" })
      .then((list) => { if (!cancelled) setSuppliers(list); })
      .catch(() => { if (!cancelled) setSuppliers([]); });
    return () => { cancelled = true; };
  }, [companyId]);
  return suppliers;
}

/**
 * Pick an EXISTING supplier (Achats > Fournisseurs) instead of typing a
 * name. Article prices store the supplier's name, so value/onChange
 * work with the name. A name already saved on an article that isn't in
 * the supplier list (typed before this dropdown existed) stays
 * selectable, marked as such, so existing data never silently vanishes.
 */
export default function SupplierSelect({ suppliers, value, onChange }) {
  const { t } = useI18n();
  const names = suppliers.map((s) => s.name);
  const legacy = value && !names.includes(value);
  const options = [
    ...(legacy ? [{ value, label: `${value} (${t("purchasing.supplierSelect.notInList")})` }] : []),
    ...names.map((name) => ({ value: name, label: name })),
  ];

  return (
    <CustomSelect
      value={value || ""}
      onSelect={onChange}
      options={options}
      placeholder={suppliers.length ? t("purchasing.supplierSelect.choose") : t("purchasing.supplierSelect.none")}
      disabled={options.length === 0}
    />
  );
}
