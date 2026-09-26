import { useEffect, useState } from "react";
import { Settings, Plus, Edit, Trash2, BriefcaseBusiness, Languages } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import ActionModal from "../../components/useful/ActionModal";
import IconPicker from "../../components/useful/IconPicker";
import TranslatedText from "../../components/useful/TranslatedText";
import TranslationEditorModal from "../../components/useful/TranslationEditorModal";

import {
  getInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  deleteInventoryCategory,
} from "../../services/inventoryCategoryService";
import { getCompanies } from "../../services/companyService";
import { getInventoryIcon } from "../../utils/inventoryIcons";

import styles from "./InventorySettings.module.css";

export default function InventorySettings() {
  const { t } = useI18n();

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
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

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!selectedCompanyId) return;
    const data = await getInventoryCategories(selectedCompanyId);
    setCategories(data);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setCategories([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getInventoryCategories(selectedCompanyId);
        if (!cancelled) setCategories(data);
      } catch (error) {
        console.error("Failed to load categories:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("Package");
  const [formDescription, setFormDescription] = useState("");
  // accounting: purchase account of this category + fixed-asset flag
  const [formAccount, setFormAccount] = useState("");
  const [formFixedAsset, setFormFixedAsset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openCreateForm = () => {
    setEditingCategory(null);
    setFormName("");
    setFormIcon("Package");
    setFormDescription("");
    setFormAccount("");
    setFormFixedAsset(false);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormIcon(category.icon || "Package");
    setFormDescription(category.description || "");
    setFormAccount(category.accountingAccount || "");
    setFormFixedAsset(!!category.isFixedAsset);
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  // ---------- Translations editor (name, description) ----------
  const [translatingCategory, setTranslatingCategory] = useState(null);

  const handleTranslationSaved = (field, bucket) => {
    setCategories((prev) =>
      prev.map((c) =>
        c._id === translatingCategory?._id
          ? { ...c, translations: { ...c.translations, [field]: bucket } }
          : c
      )
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formName.trim()) {
      setFormError(t("inventorySettings.errors.nameRequired"));
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editingCategory) {
        await updateInventoryCategory(editingCategory._id, {
          name: formName, icon: formIcon, description: formDescription, accountingAccount: formAccount.trim(), isFixedAsset: formFixedAsset,
        });
      } else {
        await createInventoryCategory({
          company: selectedCompanyId, name: formName, icon: formIcon, description: formDescription, accountingAccount: formAccount.trim(), isFixedAsset: formFixedAsset,
        });
      }
      closeForm();
      await reload();
    } catch (error) {
      setFormError(error.response?.data?.message || t("inventorySettings.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const askDelete = (category) => {
    setPendingDeleteId(category._id);
    setModal({ open: true, type: "confirm", title: t("inventorySettings.deleteTitle"), message: t("inventorySettings.deleteSureMessage") });
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModal((prev) => ({ ...prev, open: false }));
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      await deleteInventoryCategory(pendingDeleteId);
      setCategories((prev) => prev.filter((c) => c._id !== pendingDeleteId));
      setModal((prev) => ({ ...prev, open: false }));
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("inventorySettings.errors.deleteFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("production.title"), href: "/production/inventory" }, { label: t("inventorySettings.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Settings size={20} />
            <h1>{t("inventorySettings.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("inventorySettings.subtitle")}</p>
        </div>
        {selectedCompanyId && (
          <div className="pageHeaderActions">
            <button type="button" className="btnPrimary" onClick={openCreateForm}>
              <Plus size={16} />
              {t("inventorySettings.addCategory")}
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
      </div>

      {showForm && selectedCompanyId && (
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <h3>{editingCategory ? t("inventorySettings.editCategory") : t("inventorySettings.addCategory")}</h3>
          {formError && <div className={styles.errorMessage}>{formError}</div>}

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>{t("inventorySettings.fields.name")}</label>
              <input type="text" className={styles.textInput} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={t("inventorySettings.fields.namePlaceholder")} />
            </div>
            <div className={styles.formField}>
              <label>{t("inventorySettings.fields.icon")}</label>
              <IconPicker value={formIcon} onSelect={setFormIcon} />
            </div>
            <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
              <label>{t("inventorySettings.fields.description")}</label>
              <input type="text" className={styles.textInput} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder={t("inventorySettings.fields.descriptionPlaceholder")} />
            </div>
            {/* Where purchases of this category go in the accounting export */}
            <div className={styles.formField}>
              <label>{t("inventorySettings.fields.accountingAccount")}</label>
              <input type="text" inputMode="numeric" className={styles.textInput} value={formAccount} placeholder="6121"
                onChange={(e) => setFormAccount(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} />
              <small className={styles.fieldHint}>{t("inventorySettings.fields.accountingAccountHint")}</small>
            </div>
            <div className={styles.formField}>
              <label>{t("inventorySettings.fields.fixedAsset")}</label>
              <label className={styles.inlineSwitch}>
                <input type="checkbox" className="switchToggle" checked={formFixedAsset} onChange={(e) => setFormFixedAsset(e.target.checked)} />
                <span>{formFixedAsset ? t("inventorySettings.fields.fixedAssetOn") : t("inventorySettings.fields.fixedAssetOff")}</span>
              </label>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" className="btnCancel" onClick={closeForm}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary" disabled={saving}>
              {saving ? t("payroll.buttons.saving") : editingCategory ? t("common.update") : t("common.create")}
            </button>
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

      {selectedCompanyId && !loading && categories.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Settings size={28} /></div>
          <h2>{t("inventorySettings.emptyTitle")}</h2>
          <p>{t("inventorySettings.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && categories.length > 0 && (
        <div className={styles.categoryGrid}>
          {categories.map((category) => {
            const Icon = getInventoryIcon(category.icon);
            return (
              <div key={category._id} className={styles.categoryCard}>
                <div className={styles.categoryIcon} style={{ color: category.color }}>
                  <Icon size={22} />
                </div>
                <div className={styles.categoryInfo}>
                  <span className={styles.categoryName}>
                    <TranslatedText doc={category} field="name" />
                  </span>
                  {category.description && (
                    <span className={styles.categoryDescription}>
                      <TranslatedText doc={category} field="description" />
                    </span>
                  )}
                </div>
                <div className={styles.categoryActions}>
                  <button type="button" className="tableActionBtn" title={t("contentTranslation.editButton")} onClick={() => setTranslatingCategory(category)}>
                    <Languages size={14} />
                  </button>
                  <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => openEditForm(category)}>
                    <Edit size={14} />
                  </button>
                  <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => askDelete(category)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ActionModal isOpen={modal.open} type={modal.type} title={modal.title} message={modal.message} loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirmDelete : undefined} onClose={closeModal} />

      <TranslationEditorModal
        isOpen={!!translatingCategory}
        onClose={() => setTranslatingCategory(null)}
        resourceType="inventoryCategory"
        resourceId={translatingCategory?._id}
        fields={[
          { key: "name", label: t("inventorySettings.fields.name") },
          { key: "description", label: t("inventorySettings.fields.description") },
        ]}
        onSaved={handleTranslationSaved}
      />
    </div>
  );
}
