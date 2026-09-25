import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Boxes, Plus, Minus, Edit, Trash2, X, Search,
  AlertTriangle, ShoppingCart, BriefcaseBusiness, Package, Languages, Ruler, History, Tags,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { buildUnitOptions, getUnitLabel } from "../../config/units";
import { useAuth } from "../../hooks/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import ActionModal from "../../components/useful/ActionModal";
import IconPicker from "../../components/useful/IconPicker";
import TranslatedText from "../../components/useful/TranslatedText";
import TranslationEditorModal from "../../components/useful/TranslationEditorModal";
import FileInput from "../../components/useful/FileInput";

import {
  getProducts,
  getProductSuggestions,
  createProduct,
  updateProduct,
  adjustProductQuantity,
  uploadProductPhoto,
  deleteProduct,
} from "../../services/productService";
import { getInventoryCategories } from "../../services/inventoryCategoryService";
import { createPurchaseRequest } from "../../services/purchaseRequestService";
import { getCompanies } from "../../services/companyService";
import { getInventoryIcon } from "../../utils/inventoryIcons";
import { canAccessProduction } from "../../utils/permissions";
import SupplierPricesModal from "../purchasing/SupplierPricesModal";
import SupplierSelect, { useCompanySuppliers } from "../../components/useful/SupplierSelect";

import styles from "./Inventory.module.css";

const PAGE_SIZE = 20;

function formatAmount(amount, currency = "MAD") {
  if (amount === undefined || amount === null) return "—";
  return `${Number(amount).toLocaleString("en-US")} ${currency}`;
}

/**
 * readOnly: the purchasing team's view (Achats > Inventaire) — they
 * look articles up and open their purchase history, but never change
 * stock (the backend enforces this too: writes are production-only).
 */
export default function Inventory({ readOnly = false }) {
  const navigate = useNavigate();
  const [pricesProduct, setPricesProduct] = useState(null); // purchasing: supplier prices editor
  const { t } = useI18n();
  const { user: currentUser } = useAuth();

  // ---------- Company ----------
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  // existing suppliers, for the article prices dropdown
  const companySuppliers = useCompanySuppliers(selectedCompanyId);
  const [companiesLoading, setCompaniesLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setCompaniesLoading(true);
        const data = await getCompanies();
        const list = Array.isArray(data) ? data : [];
        setCompanies(list);
        if (!selectedCompanyId && list.length > 0) setSelectedCompanyId(list[0]._id);
      } catch (error) {
        console.error("Failed to load companies:", error);
      } finally {
        setCompaniesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = companies.map((c) => ({
    value: c._id,
    label: c.name || c.tradeName || t("employees.company.unnamed"),
  }));

  // ---------- Categories ----------
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    if (!selectedCompanyId) { setCategories([]); return; }
    getInventoryCategories(selectedCompanyId).then(setCategories).catch(console.error);
  }, [selectedCompanyId]);

  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.name }));

  // ---------- Filters ----------
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [asOfDate, setAsOfDate] = useState("");
  const [page, setPage] = useState(1);

  // ---------- Search suggestions ----------
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef(null);

  useEffect(() => {
    if (!selectedCompanyId || !search.trim()) { setSuggestions([]); return; }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const data = await getProductSuggestions(selectedCompanyId, search.trim());
        if (!cancelled) setSuggestions(data);
      } catch (error) {
        console.error("Failed to load suggestions:", error);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [search, selectedCompanyId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---------- Products ----------
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { setPage(1); }, [selectedCompanyId, debouncedSearch, categoryFilter, lowStockOnly, asOfDate]);

  const reload = async (targetPage = page) => {
    if (!selectedCompanyId) return;
    const { products: data, pagination: p } = await getProducts({
      companyId: selectedCompanyId,
      search: debouncedSearch || undefined,
      category: categoryFilter || undefined,
      lowStockOnly,
      asOfDate: asOfDate || undefined,
      page: targetPage,
      limit: PAGE_SIZE,
    });
    setProducts(data);
    setPagination(p);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setProducts([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { products: data, pagination: p } = await getProducts({
          companyId: selectedCompanyId,
          search: debouncedSearch || undefined,
          category: categoryFilter || undefined,
          lowStockOnly,
          asOfDate: asOfDate || undefined,
          page,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        setProducts(data);
        setPagination(p);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("inventory.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, debouncedSearch, categoryFilter, lowStockOnly, asOfDate, page, t]);

  // ---------- Create / edit product form ----------
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({});
  const [formPrices, setFormPrices] = useState([]);
  const [formFile, setFormFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openCreateForm = () => {
    setEditingProduct(null);
    setFormData({ category: categories[0]?._id || "", name: "", internalReference: "", quantity: "0", unit: "unit", threshold: "0", sellingPrice: "" });
    setFormPrices([]);
    setFormFile(null);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setFormData({
      category: product.category?._id || "",
      name: product.name,
      internalReference: product.internalReference,
      unit: product.unit,
      threshold: String(product.threshold ?? 0),
      sellingPrice: product.sellingPrice ?? "",
    });
    setFormPrices(product.prices || []);
    setFormFile(null);
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  // ---------- Translations editor (name) ----------
  const [translatingProduct, setTranslatingProduct] = useState(null);

  // Patches the just-saved/regenerated translation bucket into the
  // already-loaded product list, so every language switch and every
  // other view of this product reflects it immediately — no refetch.
  const handleTranslationSaved = (field, bucket) => {
    setProducts((prev) =>
      prev.map((p) =>
        p._id === translatingProduct?._id
          ? { ...p, translations: { ...p.translations, [field]: bucket } }
          : p
      )
    );
  };

  const addPriceRow = () => setFormPrices((prev) => [...prev, { supplierName: "", price: "", supplierReference: "" }]);
  const updatePriceRow = (index, field, value) => {
    setFormPrices((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };
  const removePriceRow = (index) => setFormPrices((prev) => prev.filter((_, i) => i !== index));

  const handleSubmitForm = async (event) => {
    event.preventDefault();
    if (!formData.name || !formData.internalReference || !formData.category) {
      setFormError(t("inventory.errors.missingFields"));
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const cleanPrices = formPrices
        .filter((p) => p.supplierName && p.price !== "")
        .map((p) => ({ supplierName: p.supplierName, price: Number(p.price), supplierReference: p.supplierReference || undefined }));

      let product;
      if (editingProduct) {
        product = await updateProduct(editingProduct._id, {
          category: formData.category,
          name: formData.name,
          internalReference: formData.internalReference,
          unit: formData.unit,
          threshold: formData.threshold,
          sellingPrice: formData.sellingPrice === "" ? null : Number(formData.sellingPrice),
          prices: cleanPrices,
        });
      } else {
        product = await createProduct({
          company: selectedCompanyId,
          category: formData.category,
          name: formData.name,
          internalReference: formData.internalReference,
          quantity: formData.quantity,
          unit: formData.unit,
          threshold: formData.threshold,
          sellingPrice: formData.sellingPrice === "" ? null : Number(formData.sellingPrice),
          prices: cleanPrices,
        });
      }

      if (formFile && product) {
        await uploadProductPhoto(product._id, formFile);
      }

      closeForm();
      setPage(1);
      await reload(1);
    } catch (error) {
      setFormError(error.response?.data?.message || t("inventory.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Quantity adjust ----------
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustType, setAdjustType] = useState("in");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  const openAdjust = (product, type) => {
    setAdjustingProduct(product);
    setAdjustType(type);
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustError("");
  };

  const handleAdjustSubmit = async (event) => {
    event.preventDefault();
    if (!adjustQuantity || Number(adjustQuantity) <= 0) {
      setAdjustError(t("inventory.errors.invalidQuantity"));
      return;
    }
    setAdjustLoading(true);
    setAdjustError("");
    try {
      await adjustProductQuantity(adjustingProduct._id, { type: adjustType, quantity: Number(adjustQuantity), reason: adjustReason });
      setAdjustingProduct(null);
      await reload();
    } catch (error) {
      setAdjustError(error.response?.data?.message || t("inventory.errors.adjustFailed"));
    } finally {
      setAdjustLoading(false);
    }
  };

  // ---------- Purchase request ----------
  const [purchasingProduct, setPurchasingProduct] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const openPurchaseRequest = (product) => {
    setPurchasingProduct(product);
    setPurchaseQuantity("");
    setPurchaseNotes("");
    setPurchaseError("");
    setPurchaseSuccess(false);
  };

  const handlePurchaseSubmit = async (event) => {
    event.preventDefault();
    if (!purchaseQuantity || Number(purchaseQuantity) <= 0) {
      setPurchaseError(t("inventory.errors.invalidQuantity"));
      return;
    }
    setPurchaseLoading(true);
    setPurchaseError("");
    try {
      await createPurchaseRequest({
        company: selectedCompanyId,
        product: purchasingProduct._id,
        requestedQuantity: Number(purchaseQuantity),
        notes: purchaseNotes,
      });
      setPurchaseSuccess(true);
    } catch (error) {
      setPurchaseError(error.response?.data?.message || t("inventory.errors.purchaseRequestFailed"));
    } finally {
      setPurchaseLoading(false);
    }
  };

  // ---------- Delete ----------
  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const askDelete = (product) => {
    setPendingDeleteId(product._id);
    setModal({ open: true, type: "confirm", title: t("inventory.deleteTitle"), message: t("inventory.deleteSureMessage") });
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModal((prev) => ({ ...prev, open: false }));
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      await deleteProduct(pendingDeleteId);
      setProducts((prev) => prev.filter((p) => p._id !== pendingDeleteId));
      setModal((prev) => ({ ...prev, open: false }));
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("inventory.errors.deleteFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  // ---------- Expanded image ----------
  const [expandedImage, setExpandedImage] = useState(null);

  return (
    <div className="pageShell">
      <Breadcrumbs items={readOnly
        ? [{ label: t("sidebar.purchasing"), href: "/purchasing/requests" }, { label: t("inventory.title") }]
        : [{ label: t("production.title") }, { label: t("inventory.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Boxes size={20} />
            <h1>{t("inventory.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("inventory.subtitle")}</p>
        </div>
        {selectedCompanyId && !readOnly && (
          <div className="pageHeaderActions">
            <button type="button" className="btnPrimary" onClick={openCreateForm}>
              <Plus size={16} />
              {t("inventory.addProduct")}
            </button>
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading} />
        </div>

        <div className={styles.searchGroup} ref={searchWrapperRef}>
          <label>{t("inventory.fields.search")}</label>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("inventory.searchPlaceholder")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
            />
            {search && (
              <button type="button" className={styles.clearSearch} onClick={() => { setSearch(""); setSuggestions([]); }}>
                <X size={14} />
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className={styles.suggestions}>
              {suggestions.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  className={styles.suggestionItem}
                  onMouseDown={(e) => { e.preventDefault(); setSearch(p.internalReference); setShowSuggestions(false); }}
                >
                  {p.image?.url ? <img src={p.image.url} alt="" /> : <Package size={16} />}
                  <span className={styles.suggestionName}>{p.name}</span>
                  <span className={styles.suggestionRef}>{p.internalReference}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filterGroup">
          <label>{t("inventory.fields.category")}</label>
          <CustomSelect value={categoryFilter} onSelect={setCategoryFilter} options={[
            { value: "", label: t("absences.filters.allTypes") },
            ...categoryOptions,
          ]} />
        </div>

        {/* One date, not a range: stock is shown AS OF this day. (This
            used to reuse the from/to range component with both ends
            bound to the same value, so the same date showed twice.) */}
        <div className="filterGroup">
          <label>{t("inventory.asOfDate")}</label>
          <input
            type="date"
            className="dateInput"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </div>

        <label className={styles.lowStockToggle}>
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          <span>{t("inventory.lowStockOnly")}</span>
        </label>
      </div>

      {asOfDate && (
        <div className={styles.asOfBanner}>{t("inventory.viewingAsOf").replace("{date}", asOfDate)}</div>
      )}

      {showForm && selectedCompanyId && (
        <form className={styles.formCard} onSubmit={handleSubmitForm}>
          <h3>{editingProduct ? t("inventory.editProduct") : t("inventory.addProduct")}</h3>
          {formError && <div className={styles.errorMessage}>{formError}</div>}

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>{t("inventory.fields.category")}</label>
              <CustomSelect value={formData.category} onSelect={(v) => setFormData((p) => ({ ...p, category: v }))} options={categoryOptions} placeholder={t("inventory.fields.selectCategory")} />
            </div>
            <div className={styles.formField}>
              <label>{t("inventory.fields.name")}</label>
              <input type="text" className={styles.textInput} value={formData.name || ""} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className={styles.formField}>
              <label>{t("inventory.fields.internalReference")}</label>
              <input type="text" className={styles.textInput} value={formData.internalReference || ""} onChange={(e) => setFormData((p) => ({ ...p, internalReference: e.target.value }))} />
            </div>
            {!editingProduct && (
              <div className={styles.formField}>
                <label>{t("inventory.fields.quantity")}</label>
                <input type="number" min={0} className={styles.textInput} value={formData.quantity || ""} onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))} />
              </div>
            )}
            <div className={styles.formField}>
              <label>{t("inventory.fields.unit")}</label>
              <SearchSelect
                value={formData.unit || "unit"}
                onSelect={(value) => setFormData((p) => ({ ...p, unit: value }))}
                options={buildUnitOptions(t, formData.unit)}
                placeholder={t("inventory.fields.unit")}
                noResultsLabel={t("common.noResults")}
                icon={Ruler}
              />
            </div>
            <div className={styles.formField}>
              <label>{t("inventory.fields.threshold")}</label>
              <input type="number" min={0} className={styles.textInput} value={formData.threshold || ""} onChange={(e) => setFormData((p) => ({ ...p, threshold: e.target.value }))} />
            </div>
            <div className={styles.formField}>
              <label>{t("inventory.fields.sellingPrice")}</label>
              <input type="number" min={0} className={styles.textInput} value={formData.sellingPrice ?? ""} onChange={(e) => setFormData((p) => ({ ...p, sellingPrice: e.target.value }))} />
            </div>
            <div className={styles.formField}>
              <label>{t("inventory.fields.image")}</label>
              <FileInput
                value={formFile}
                onChange={setFormFile}
                accept="image/*"
                chooseLabel={t("common.chooseFile")}
                emptyLabel={t("common.noFileChosen")}
              />
            </div>
          </div>

          <div className={styles.pricesSection}>
            <div className={styles.pricesHeader}>
              <label>{t("inventory.fields.prices")}</label>
              <button type="button" className="tableActionBtn" onClick={addPriceRow}>
                <Plus size={14} />
              </button>
            </div>
            {formPrices.map((price, index) => (
              <div key={index} className={styles.priceRow}>
                <SupplierSelect suppliers={companySuppliers} value={price.supplierName}
                  onChange={(name) => updatePriceRow(index, "supplierName", name)} />
                <input type="number" min={0} className={styles.textInput} placeholder={t("inventory.fields.price")} value={price.price} onChange={(e) => updatePriceRow(index, "price", e.target.value)} />
                <input type="text" className={styles.textInput} placeholder={t("inventory.fields.supplierReference")} value={price.supplierReference || ""} onChange={(e) => updatePriceRow(index, "supplierReference", e.target.value)} />
                <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => removePriceRow(index)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className={styles.formActions}>
            <button type="button" className="btnCancel" onClick={closeForm}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary" disabled={saving}>{saving ? t("payroll.buttons.saving") : t("common.update")}</button>
          </div>
        </form>
      )}

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {selectedCompanyId && !loading && products.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Boxes size={28} /></div>
          <h2>{t("inventory.emptyTitle")}</h2>
          <p>{t("inventory.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && products.length > 0 && (
        <>
          <div className={styles.productGrid}>
            {products.map((product) => {
              const Icon = getInventoryIcon(product.category?.icon);
              const isLow = product.quantity <= (product.threshold || 0);
              return (
                <div key={product._id} className={styles.productCard} data-low={isLow}>
                  <div className={styles.productImage} onClick={() => product.image?.url && setExpandedImage(product.image.url)}>
                    {product.image?.url ? <img src={product.image.url} alt={product.name} /> : <Icon size={32} />}
                  </div>

                  <div className={styles.productBody}>
                    <div className={styles.productHeader}>
                      <span className={styles.categoryBadge} style={{ color: product.category?.color }}>
                        <Icon size={12} />
                        {product.category?.name}
                      </span>
                      {isLow && (
                        <span className={styles.lowBadge} title={t("inventory.lowStock")}>
                          <AlertTriangle size={12} />
                        </span>
                      )}
                    </div>

                    <div className={styles.productNameRow}>
                      <TranslatedText as="h3" className={styles.productName} doc={product} field="name" />
                      <button
                        type="button"
                        className="tableActionBtn"
                        title={t("contentTranslation.editButton")}
                        onClick={() => setTranslatingProduct(product)}
                      >
                        <Languages size={13} />
                      </button>
                    </div>
                    <span className={styles.productRef}>{product.internalReference || t("purchasing.supplierPrices.noReference")}</span>

                    <div className={styles.quantityRow}>
                      <span className={styles.quantityValue}>{product.quantity}</span>
                      <span className={styles.quantityUnit}>{getUnitLabel(t, product.unit)}</span>
                      <span className={styles.thresholdHint}>{t("inventory.fields.threshold")}: {product.threshold}</span>
                    </div>

                    {product.prices?.length > 0 && (
                      <div className={styles.pricesList}>
                        {product.prices.slice(0, 2).map((p, i) => (
                          <span key={i} className={styles.priceTag}>{p.supplierName}: {formatAmount(p.price, product.currency)}</span>
                        ))}
                      </div>
                    )}

                    {product.sellingPrice != null && (
                      <span className={styles.sellingPrice}>{t("inventory.fields.sellingPrice")}: {formatAmount(product.sellingPrice, product.currency)}</span>
                    )}
                  </div>

                  <div className={styles.productActions}>
                    {readOnly ? (
                      <>
                        {/* The purchasing team's only edit: supplier prices/references
                            (+ a missing internal reference). */}
                        <button type="button" className="tableActionBtn" title={t("purchasing.supplierPrices.open")}
                          onClick={() => setPricesProduct(product)}>
                          <Tags size={14} />
                        </button>
                        <button type="button" className="tableActionBtn" title={t("purchasing.history.openForArticle")}
                          onClick={() => navigate(`/purchasing/article-history?product=${product._id}`)}>
                          <History size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="tableActionBtn tableActionBtnAccept" title={t("inventory.actions.add")} onClick={() => openAdjust(product, "in")}>
                          <Plus size={14} />
                        </button>
                        <button type="button" className="tableActionBtn tableActionBtnReject" title={t("inventory.actions.remove")} onClick={() => openAdjust(product, "out")}>
                          <Minus size={14} />
                        </button>
                        <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => openEditForm(product)}>
                          <Edit size={14} />
                        </button>
                        {/* Production managers ask the purchasing team to buy
                            (was admin-only before the purchasing module). */}
                        {canAccessProduction(currentUser) && (
                          <button type="button" className="tableActionBtn" title={t("inventory.actions.requestPurchase")} onClick={() => openPurchaseRequest(product)}>
                            <ShoppingCart size={14} />
                          </button>
                        )}
                        <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => askDelete(product)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        </>
      )}

      {/* ---------- Adjust quantity modal ---------- */}
      {adjustingProduct && (
        <div className={styles.overlay} onClick={() => setAdjustingProduct(null)}>
          <form className={styles.smallModal} onClick={(e) => e.stopPropagation()} onSubmit={handleAdjustSubmit}>
            <h3>{adjustType === "in" ? t("inventory.actions.add") : t("inventory.actions.remove")} — {adjustingProduct.name}</h3>
            {adjustError && <div className={styles.errorMessage}>{adjustError}</div>}
            <div className={styles.formField}>
              <label>{t("inventory.fields.quantity")}</label>
              <input type="number" min={0} className={styles.textInput} value={adjustQuantity} onChange={(e) => setAdjustQuantity(e.target.value)} autoFocus />
            </div>
            <div className={styles.formField}>
              <label>{t("inventory.fields.reason")}</label>
              <input type="text" className={styles.textInput} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btnCancel" onClick={() => setAdjustingProduct(null)}>{t("common.cancel")}</button>
              <button type="submit" className="btnPrimary" disabled={adjustLoading}>{adjustLoading ? t("payroll.buttons.saving") : t("common.update")}</button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Purchase request modal ---------- */}
      {purchasingProduct && (
        <div className={styles.overlay} onClick={() => setPurchasingProduct(null)}>
          <form className={styles.smallModal} onClick={(e) => e.stopPropagation()} onSubmit={handlePurchaseSubmit}>
            <h3>{t("inventory.actions.requestPurchase")} — {purchasingProduct.name}</h3>
            {purchaseError && <div className={styles.errorMessage}>{purchaseError}</div>}
            {purchaseSuccess ? (
              <>
                <p className={styles.successText}>{t("inventory.purchaseRequestSuccess")}</p>
                <div className={styles.formActions}>
                  <button type="button" className="btnPrimary" onClick={() => setPurchasingProduct(null)}>{t("common.close")}</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.formField}>
                  <label>{t("inventory.fields.orderedQuantity")}</label>
                  <input type="number" min={0} className={styles.textInput} value={purchaseQuantity} onChange={(e) => setPurchaseQuantity(e.target.value)} autoFocus />
                </div>
                <div className={styles.formField}>
                  <label>{t("inventory.fields.notes")}</label>
                  <input type="text" className={styles.textInput} value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} />
                </div>
                <div className={styles.formActions}>
                  <button type="button" className="btnCancel" onClick={() => setPurchasingProduct(null)}>{t("common.cancel")}</button>
                  <button type="submit" className="btnPrimary" disabled={purchaseLoading}>{purchaseLoading ? t("payroll.buttons.saving") : t("inventory.actions.submitRequest")}</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {/* ---------- Expanded image ---------- */}
      {expandedImage && (
        <div className={styles.imageOverlay} onClick={() => setExpandedImage(null)}>
          <button type="button" className={styles.imageCloseBtn} onClick={() => setExpandedImage(null)}>
            <X size={22} />
          </button>
          <img src={expandedImage} alt="" className={styles.expandedImage} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <ActionModal isOpen={modal.open} type={modal.type} title={modal.title} message={modal.message} loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirmDelete : undefined} onClose={closeModal} />

      <TranslationEditorModal
        isOpen={!!translatingProduct}
        onClose={() => setTranslatingProduct(null)}
        resourceType="product"
        resourceId={translatingProduct?._id}
        fields={[{ key: "name", label: t("inventory.fields.name") }]}
        onSaved={handleTranslationSaved}
      />
      {pricesProduct && (
        <SupplierPricesModal
          product={pricesProduct}
          onClose={() => setPricesProduct(null)}
          onSaved={(saved) => {
            setProducts((prev) => prev.map((p) => (p._id === saved._id ? { ...p, ...saved, category: p.category } : p)));
            setPricesProduct(null);
          }}
        />
      )}
    </div>
  );
}
