import { useCallback, useEffect, useState } from "react";
import { getChassisModels, getFinishes, getCatalogArticles, getCatalog, getGlassTypes } from "../../services/productionService";

let familiesCache = null;

/** Active chassis models, colours, catalogue articles, glass compositions and families of a company. */
export default function useChassisData(companyId, { articles: withArticles = true } = {}) {
  const [state, setState] = useState({ models: [], finishes: [], articles: [], glassTypes: [], families: familiesCache || [], loading: true, error: "" });
  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const [models, finishes, articles, catalog, glassTypes] = await Promise.all([
        getChassisModels({ companyId }),
        getFinishes(companyId),
        withArticles ? getCatalogArticles(companyId, { materialType: "glass,panel,profile,accessory,consumable,gasket,powder" }) : Promise.resolve([]),
        familiesCache ? Promise.resolve({ families: familiesCache }) : getCatalog(),
        getGlassTypes(companyId, { active: "true" }).catch(() => []),
      ]);
      familiesCache = catalog.families;
      setState({ models, finishes, articles, glassTypes, families: catalog.families, loading: false, error: "" });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.response?.data?.message || "error" }));
    }
  }, [companyId, withArticles]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
