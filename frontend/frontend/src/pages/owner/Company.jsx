import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  uploadCompanyLogo,
  downloadCompanyFichePdf,
  getCompanyQuota,
} from "../../services/companyService";

import { useState, useEffect } from "react";
import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import {
  canCreateCompany,
  canManageCompany,
} from "../../utils/permissions";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import ActionModal from "../../components/useful/ActionModal";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CompanyWorkflowSettings from "../../components/CompanyWorkflowSettings";

import styles from "./Company.module.css";

import {
  Building2,
  Users,
  Pencil,
  Plus,
  Trash2,
  FileDown,
} from "lucide-react";

// ========================================
// MODEL ↔ FORM (models/Company.js is the source of truth)
// ========================================

const LEGAL_FORMS = ["SARL", "SARL_AU", "SA", "SAS", "SASU", "SNC", "SCS", "SCA", "SP", "COOPERATIVE", "ASSOCIATION", "OTHER"];
const SIZES = ["micro", "small", "medium", "large", "enterprise"];
const REGIONS = [
  "Dakhla-Oued Ed-Dahab", "Laâyoune-Sakia El Hamra", "Souss-Massa", "Guelmim-Oued Noun",
  "Drâa-Tafilalet", "Oriental", "Fès-Meknès", "Rabat-Salé-Kénitra", "Béni Mellal-Khénifra",
  "Casablanca-Settat", "Marrakech-Safi", "Tanger-Tétouan-Al Hoceïma",
];

const str = (v) => (v == null ? "" : String(v));
const num = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? undefined : Number(v));
// "+212 6 12-34.56 78" → "+212612345678" (the model only accepts the compact form)
const compactPhone = (v) => str(v).replace(/[\s.\-()]/g, "");

export function companyToForm(c) {
  return {
    name: str(c?.name),
    tradeName: str(c?.tradeName),
    shortName: str(c?.shortName),
    legalForm: c?.legalForm || "SARL",
    legalFormOther: str(c?.legalFormOther),
    industry: str(c?.industry),
    businessActivity: str(c?.businessActivity),
    activityCode: str(c?.activityCode),
    size: c?.size || "small",
    description: str(c?.description),

    ice: str(c?.ice),
    taxId: str(c?.taxId),
    registrationNumber: str(c?.registrationNumber),
    registrationCity: str(c?.registrationCity),
    registrationDate: c?.registrationDate ? String(c.registrationDate).slice(0, 10) : "",
    cnssNumber: str(c?.cnssNumber),
    professionalTaxNumber: str(c?.professionalTaxNumber),
    taxOffice: str(c?.taxOffice),

    email: str(c?.email),
    phone: str(c?.phone),
    secondaryPhone: str(c?.secondaryPhone),
    fax: str(c?.fax),
    website: str(c?.website),

    street: str(c?.address?.street),
    additionalLine: str(c?.address?.additionalLine),
    neighborhood: str(c?.address?.neighborhood),
    city: str(c?.address?.city),
    postalCode: str(c?.address?.postalCode),
    region: str(c?.address?.region),
    country: c?.address?.country || "Morocco",
    countryCode: c?.address?.countryCode || "MA",
    latitude: str(c?.location?.latitude),
    longitude: str(c?.location?.longitude),

    bankName: str(c?.bank?.bankName),
    accountName: str(c?.bank?.accountName),
    rib: str(c?.bank?.rib),
    iban: str(c?.bank?.iban),
    swift: str(c?.bank?.swift),

    currency: c?.currency || "MAD",
    fiscalStartMonth: String(c?.fiscalYear?.startMonth || 1),
    fiscalStartDay: String(c?.fiscalYear?.startDay || 1),
    language: c?.localization?.language || "fr",
    timezone: c?.localization?.timezone || "Africa/Casablanca",
    dateFormat: c?.localization?.dateFormat || "DD/MM/YYYY",
    timeFormat: c?.localization?.timeFormat || "24h",

    primaryColor: c?.branding?.primaryColor || "#3b82f6",
    secondaryColor: c?.branding?.secondaryColor || "#10b981",
    accentColor: c?.branding?.accentColor || "#f59e0b",
    darkMode: c?.branding?.darkMode ?? true,
  };
}

export function buildCompanyPayload(d) {
  const trim = (v) => str(v).trim();
  const address = {
    street: trim(d.street),
    additionalLine: trim(d.additionalLine),
    neighborhood: trim(d.neighborhood),
    city: trim(d.city),
    postalCode: trim(d.postalCode),
    country: trim(d.country) || "Morocco",
    countryCode: (trim(d.countryCode) || "MA").toUpperCase(),
  };
  // region is an enum: an empty value must be left out, not sent as ""
  if (trim(d.region)) address.region = trim(d.region);

  const location = {};
  if (num(d.latitude) !== undefined) location.latitude = num(d.latitude);
  if (num(d.longitude) !== undefined) location.longitude = num(d.longitude);

  return {
    name: trim(d.name),
    tradeName: trim(d.tradeName),
    shortName: trim(d.shortName),
    legalForm: d.legalForm || "SARL",
    legalFormOther: d.legalForm === "OTHER" ? trim(d.legalFormOther) : "",
    industry: trim(d.industry),
    businessActivity: trim(d.businessActivity),
    activityCode: trim(d.activityCode),
    size: d.size || "small",
    description: trim(d.description),

    ice: trim(d.ice).replace(/\s/g, ""),
    taxId: trim(d.taxId),
    registrationNumber: trim(d.registrationNumber),
    registrationCity: trim(d.registrationCity),
    registrationDate: d.registrationDate || null,
    cnssNumber: trim(d.cnssNumber),
    professionalTaxNumber: trim(d.professionalTaxNumber),
    taxOffice: trim(d.taxOffice),

    email: trim(d.email),
    phone: compactPhone(d.phone),
    secondaryPhone: compactPhone(d.secondaryPhone),
    fax: trim(d.fax),
    website: trim(d.website),

    address,
    location,

    bank: {
      bankName: trim(d.bankName),
      accountName: trim(d.accountName),
      rib: trim(d.rib),
      iban: trim(d.iban).toUpperCase(),
      swift: trim(d.swift).toUpperCase(),
    },

    currency: d.currency || "MAD",
    fiscalYear: {
      startMonth: num(d.fiscalStartMonth) || 1,
      startDay: Math.min(31, Math.max(1, num(d.fiscalStartDay) || 1)),
    },
    localization: {
      language: d.language || "fr",
      timezone: trim(d.timezone) || "Africa/Casablanca",
      dateFormat: d.dateFormat || "DD/MM/YYYY",
      timeFormat: d.timeFormat || "24h",
    },
    branding: {
      primaryColor: d.primaryColor || "#3b82f6",
      secondaryColor: d.secondaryColor || "#10b981",
      accentColor: d.accentColor || "",
      darkMode: !!d.darkMode,
    },
  };
}

export default function Company() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { refreshCompanyTheme } = useTheme();

  // ========================================
  // TRANSLATE BACKEND MESSAGES
  // ========================================

  const translateApiMessage = (message) => {
    const messages = {
      "Company not found":
        t("company.errors.notFound"),

      "Not authorized to view this company":
        t("company.errors.viewNotAuthorized"),

      "Not authorized to update this company":
        t("company.errors.updateNotAuthorized"),

      "Not authorized to delete this company":
        t("company.errors.deleteNotAuthorized"),

      "A company with this ICE, tax ID, registration number, or CNSS number already exists":
        t("company.errors.duplicateCompany"),

      "Error creating company":
        t("company.errors.createFailed"),

      "Error updating company":
        t("company.errors.updateFailed"),

      "Error deleting company":
        t("company.errors.deleteFailed"),

      "Company logo not found":
        t("company.errors.logoNotFound"),

      "Please select a logo":
        t("company.errors.logoRequired"),

      "Error uploading company logo":
        t("company.errors.logoUploadFailed"),

      "Error deleting company logo":
        t("company.errors.logoDeleteFailed"),
    };

    return messages[message] || message;
  };

  // ========================================
  // COMPANY
  // ========================================

  const [company, setCompany] = useState(null);
  // A client can have several companies (up to the quota the platform
  // gave it): the list, and the quota { maxCompanies, companies, … }.
  const [companies, setCompanies] = useState([]);
  const [quota, setQuota] = useState(null);
  const refreshQuota = () => getCompanyQuota().then(setQuota).catch(() => setQuota(null));

  const [initialLoading, setInitialLoading] =
    useState(true);

  // ========================================
  // MODE
  // ========================================

  const [mode, setMode] = useState(false);

  // The form only asks for "Autre forme juridique" when OTHER is picked.
  const [legalFormDraft, setLegalFormDraft] = useState("SARL");
  useEffect(() => {
    if (mode) setLegalFormDraft((mode === "create" ? null : company)?.legalForm || "SARL");
  }, [mode, company]);

  // ========================================
  // MODAL
  // ========================================

  const [modal, setModal] = useState({
    open: false,
    type: "confirm",
    title: "",
    message: "",
  });

  // ========================================
  // MODAL ACTION
  // ========================================

  const [modalAction, setModalAction] =
    useState(null);

  // Possible values:
  //
  // "save"
  // "delete"

  // ========================================
  // SUBMIT LOADING
  // ========================================

  const [loading, setLoading] = useState(false);

  // ========================================
  // PENDING FORM DATA
  // ========================================

  const [pendingData, setPendingData] =
    useState(null);

  // ========================================
  // LOAD COMPANY
  // ========================================

  useEffect(() => {
    const loadCompany = async () => {
      try {
        const list = await getCompanies();

        setCompanies(list || []);
        setCompany(list?.[0] || null);
        refreshQuota();
      } catch (error) {
        console.error(
          "Failed to load company:",
          error
        );

        setModal({
          open: true,
          type: "error",
          title: t("company.loadFailTitle"),
          message: translateApiMessage(
            error.response?.data?.message ||
            t("company.loadFailMessage")
          ),
        });
      } finally {
        setInitialLoading(false);
      }
    };

    loadCompany();
  }, [t]);

  // ========================================
  // FORM FIELDS
  // ========================================

  // Every field of the Company model the owner can set, grouped like
  // the model (identity, legal, contact, address, bank, regional,
  // branding). Left out on purpose: owner / tenant / status / audit
  // (server-managed), employeeCount (computed from Employees) and
  // `settings` (edited in the approval-workflow panel and Leave
  // balances, through their own endpoint).
  const opt = (values, prefix) => values.map((v) => ({ value: v, label: t(`${prefix}.${v}`) }));
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleDateString(language || "fr", { month: "long" }),
  }));

  const companyFields = [
    // ---------- IDENTITY ----------
    { name: "_identity", type: "section", label: t("company.section.identity") },
    { name: "name", label: t("company.name"), type: "text", required: true, maxLength: 200 },
    { name: "tradeName", label: t("company.tradeName"), type: "text", maxLength: 200 },
    { name: "shortName", label: t("company.form.shortName"), type: "text", maxLength: 50, helpText: t("company.form.shortNameHint") },
    { name: "legalForm", label: t("company.legalForm"), type: "select", required: true, options: opt(LEGAL_FORMS, "company.form.legalForms") },
    ...(legalFormDraft === "OTHER"
      ? [{ name: "legalFormOther", label: t("company.form.legalFormOther"), type: "text", required: true, maxLength: 100 }]
      : []),
    { name: "industry", label: t("company.industry"), type: "text", required: true },
    { name: "businessActivity", label: t("company.form.businessActivity"), type: "text", maxLength: 500 },
    { name: "activityCode", label: t("company.form.activityCode"), type: "text" },
    { name: "size", label: t("company.form.size"), type: "select", options: opt(SIZES, "company.form.sizes") },
    { name: "description", label: t("company.form.description"), type: "textarea", rows: 3, fullWidth: true, maxLength: 2000 },

    // ---------- LEGAL / TAX ----------
    { name: "_legal", type: "section", label: t("company.section.legal") },
    { name: "ice", label: t("company.ice"), type: "text", placeholder: "000000000000000", helpText: t("company.form.iceHint") },
    { name: "taxId", label: t("company.taxId"), type: "text" },
    { name: "registrationNumber", label: t("company.registrationNumber"), type: "text" },
    { name: "registrationCity", label: t("company.form.registrationCity"), type: "text" },
    { name: "registrationDate", label: t("company.form.registrationDate"), type: "date" },
    { name: "cnssNumber", label: t("company.form.cnssNumber"), type: "text" },
    { name: "professionalTaxNumber", label: t("company.form.professionalTaxNumber"), type: "text" },
    { name: "taxOffice", label: t("company.form.taxOffice"), type: "text" },

    // ---------- CONTACT ----------
    { name: "_contact", type: "section", label: t("company.section.contact") },
    { name: "email", label: t("company.email"), type: "email" },
    { name: "phone", label: t("company.phone"), type: "tel", placeholder: "+212 6XX XXX XXX", helpText: t("company.form.phoneHint") },
    { name: "secondaryPhone", label: t("company.form.secondaryPhone"), type: "tel", placeholder: "05XX XX XX XX" },
    { name: "fax", label: t("company.form.fax"), type: "tel" },
    { name: "website", label: t("company.website"), type: "text", placeholder: "www.exemple.ma" },

    // ---------- ADDRESS ----------
    { name: "_address", type: "section", label: t("company.form.sectionAddress") },
    { name: "street", label: t("company.street"), type: "text", fullWidth: true },
    { name: "additionalLine", label: t("company.form.additionalLine"), type: "text" },
    { name: "neighborhood", label: t("company.form.neighborhood"), type: "text" },
    { name: "city", label: t("company.city"), type: "text" },
    { name: "postalCode", label: t("company.postalCode"), type: "text" },
    { name: "region", label: t("company.form.region"), type: "search-select", options: [{ value: "", label: "—" }, ...REGIONS.map((r) => ({ value: r, label: r }))] },
    { name: "country", label: t("company.form.country"), type: "text" },
    { name: "countryCode", label: t("company.form.countryCode"), type: "text", maxLength: 2 },
    { name: "latitude", label: t("company.form.latitude"), type: "number", step: "any", min: -90, max: 90 },
    { name: "longitude", label: t("company.form.longitude"), type: "number", step: "any", min: -180, max: 180 },

    // ---------- BANK ----------
    { name: "_bank", type: "section", label: t("company.form.sectionBank"), helpText: t("company.form.sectionBankHint") },
    { name: "bankName", label: t("company.form.bankName"), type: "text" },
    { name: "accountName", label: t("company.form.accountName"), type: "text" },
    { name: "rib", label: t("company.form.rib"), type: "text", placeholder: "000 000 0000000000000000 00" },
    { name: "iban", label: t("company.form.iban"), type: "text", placeholder: "MA64 …" },
    { name: "swift", label: t("company.form.swift"), type: "text" },

    // ---------- FISCAL & REGIONAL ----------
    { name: "_regional", type: "section", label: t("company.form.sectionRegional") },
    { name: "currency", label: t("company.form.currency"), type: "select", options: ["MAD", "EUR", "USD"] },
    { name: "fiscalStartMonth", label: t("company.form.fiscalStartMonth"), type: "select", options: MONTHS },
    { name: "fiscalStartDay", label: t("company.form.fiscalStartDay"), type: "number", min: 1, max: 31, step: 1 },
    { name: "language", label: t("company.form.language"), type: "select", options: [{ value: "fr", label: "Français" }, { value: "ar", label: "العربية" }, { value: "en", label: "English" }] },
    { name: "timezone", label: t("company.form.timezone"), type: "text", placeholder: "Africa/Casablanca" },
    { name: "dateFormat", label: t("company.form.dateFormat"), type: "select", options: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"] },
    { name: "timeFormat", label: t("company.form.timeFormat"), type: "select", options: ["24h", "12h"] },

    // ---------- BRANDING ----------
    { name: "_branding", type: "section", label: t("company.form.sectionBranding"), helpText: t("company.form.sectionBrandingHint") },
    { name: "logo", label: t("company.logo"), type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", fullWidth: true },
    { name: "primaryColor", label: t("company.form.primaryColor"), type: "color" },
    { name: "secondaryColor", label: t("company.form.secondaryColor"), type: "color" },
    { name: "accentColor", label: t("company.form.accentColor"), type: "color" },
    { name: "darkMode", label: t("company.form.darkMode"), type: "checkbox", checkboxLabel: t("company.form.darkModeLabel"), helpText: t("company.form.darkModeHint") },
  ];

  // ========================================
  // FORM BUTTONS
  // ========================================

  const companyButtons = [
    {
      label: t("common.cancel"),
      type: "button",
      variant: "secondary",

      onClick: () => {
        setMode(false);
        setPendingData(null);
        setModalAction(null);
      },
    },

    {
      label: t("common.reset"),
      type: "reset",
      variant: "secondary",
    },

    {
      label:
        mode === "create"
          ? t("common.create")
          : t("common.update"),

      type: "submit",
      variant: "primary",
    },
  ];

  // ========================================
  // FORM SUBMIT
  // ========================================

  const handleSubmit = (data) => {
    setPendingData(data);

    setModalAction("save");

    setModal({
      open: true,
      type: "confirm",

      title:
        mode === "create"
          ? t("company.createTitle")
          : `${t("common.update")} ${t(
            "company.title"
          )}`,

      message:
        mode === "create"
          ? t("company.createSureMessage")
          : t("company.updateSureMessage"),
    });
  };

  // ========================================
  // DOWNLOAD FICHE (company fact sheet PDF)
  // ========================================

  const [ficheDownloading, setFicheDownloading] = useState(false);

  const handleDownloadFiche = async () => {
    if (!company) return;
    setFicheDownloading(true);
    try {
      const companyName = company.shortName || company.name || "";
      const safeName = ["Fiche entreprise", companyName]
        .filter(Boolean)
        .join(" - ")
        .replace(/[/\\:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      await downloadCompanyFichePdf(company._id, `${safeName}.pdf`);
    } catch (err) {
      setModal({
        open: true,
        type: "error",
        title: t("common.error"),
        message: translateApiMessage(err.response?.data?.message) || t("company.errors.ficheDownloadFailed"),
      });
    } finally {
      setFicheDownloading(false);
    }
  };

  // ========================================
  // DELETE COMPANY
  // ========================================

  const handleDeleteCompany = () => {
    if (!company) {
      return;
    }

    setModalAction("delete");

    setModal({
      open: true,
      type: "confirm",
      title: t("company.deleteTitle"),
      message: t("company.deleteSureMessage"),
    });
  };

  // ========================================
  // CONFIRM SAVE
  // CREATE OR UPDATE
  // ========================================

  const handleConfirmSave = async () => {
    if (!pendingData) {
      return;
    }

    setLoading(true);

    try {
      // ======================================
      // GET LOGO FILE
      // ======================================

      const logo = pendingData.logo;

      // ======================================
      // COMPANY DATA
      // ======================================

      const payload = buildCompanyPayload(pendingData);

      // ======================================
      // CREATE OR UPDATE COMPANY
      // ======================================

      let savedCompany;

      if (mode === "create") {
        savedCompany =
          await createCompany(payload);
      } else {
        savedCompany =
          await updateCompany(
            company._id,
            payload
          );
      }

      // ======================================
      // UPLOAD LOGO
      // ======================================

      let finalCompany = savedCompany;

      if (logo instanceof File) {
        const logoResponse =
          await uploadCompanyLogo(
            savedCompany._id,
            logo
          );

        finalCompany = logoResponse.data;
      }

      // ======================================
      // UPDATE UI
      // ======================================

      setCompany(finalCompany);
      setCompanies((list) => (mode === "create"
        ? [...list, finalCompany]
        : list.map((c) => (c._id === finalCompany._id ? finalCompany : c))));
      if (mode === "create") refreshQuota();
      // "Thème sombre" may have changed: users following the company see it now
      refreshCompanyTheme();

      setMode(false);

      setPendingData(null);

      setModalAction(null);

      setLoading(false);

      // ======================================
      // SUCCESS
      // ======================================

      setModal({
        open: true,
        type: "success",

        title:
          mode === "create"
            ? t("company.createSuccessTitle")
            : `${t("common.update")} ${t(
              "common.success"
            )}`,

        message:
          mode === "create"
            ? t(
              "company.createSuccessMessage"
            )
            : t(
              "company.updateSuccessMessage"
            ),
      });
    } catch (error) {
      console.error(
        "Failed to save company:",
        error.response?.data || error
      );

      setLoading(false);

      setModal({
        open: true,
        type: "error",

        title:
          mode === "create"
            ? t("company.createFailTitle")
            : `${t("common.update")} ${t(
              "common.fail"
            )}`,

        message: translateApiMessage(
          error.response?.data?.message ||
          error.message ||
          t("company.saveFailMessage")
        ),
      });
    }
  };

  // ========================================
  // CONFIRM DELETE
  // ========================================

  const handleConfirmDelete = async () => {
    if (!company) {
      return;
    }

    setLoading(true);

    try {
      // ======================================
      // DELETE COMPANY
      // ======================================

      await deleteCompany(company._id);

      // ======================================
      // REMOVE COMPANY FROM UI
      // ======================================

      const remaining = companies.filter((c) => c._id !== company._id);
      setCompanies(remaining);
      setCompany(remaining[0] || null);
      refreshQuota();

      // ======================================
      // CLEAR STATE
      // ======================================

      setModalAction(null);

      setPendingData(null);

      setLoading(false);

      // ======================================
      // SUCCESS
      // ======================================

      setModal({
        open: true,
        type: "success",

        title: t(
          "company.deleteSuccessTitle"
        ),

        message: t(
          "company.deleteSuccessMessage"
        ),
      });
    } catch (error) {
      console.error(
        "Failed to delete company:",
        error.response?.data || error
      );

      setLoading(false);

      setModal({
        open: true,
        type: "error",

        title: t(
          "company.deleteFailTitle"
        ),

        message: translateApiMessage(
          error.response?.data?.message ||
          error.message ||
          t("company.deleteFailMessage")
        ),
      });
    }
  };

  // ========================================
  // CONFIRM MODAL ACTION
  // ========================================

  const handleConfirm = async () => {
    if (modalAction === "save") {
      await handleConfirmSave();
      return;
    }

    if (modalAction === "delete") {
      await handleConfirmDelete();
      return;
    }
  };

  // ========================================
  // CLOSE MODAL
  // ========================================

  const handleCloseModal = () => {
    if (loading) {
      return;
    }

    setModal((prev) => ({
      ...prev,
      open: false,
    }));

    if (modal.type === "confirm") {
      setPendingData(null);
      setModalAction(null);
    }
  };

  // ========================================
  // DETAIL CARD (read view of every field)
  // ========================================

  const swatch = (color) => color
    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: color, border: "1px solid rgba(127,127,127,.4)" }} />{color}</span>
    : "";
  const detailSections = (c) => {
    const a = c.address || {};
    const legalForm = c.legalForm === "OTHER" && c.legalFormOther
      ? c.legalFormOther
      : t(`company.form.legalForms.${c.legalForm}`);
    const coords = c.location?.latitude != null && c.location?.longitude != null
      ? `${c.location.latitude}, ${c.location.longitude}` : "";
    const month = c.fiscalYear?.startMonth
      ? new Date(2000, c.fiscalYear.startMonth - 1, 1).toLocaleDateString(language || "fr", { month: "long" }) : "";
    return [
      { key: "identity", title: t("company.section.identity"), rows: [
        [t("company.name"), c.name],
        [t("company.tradeName"), c.tradeName || "—"],
        [t("company.form.shortName"), c.shortName],
        [t("company.legalForm"), legalForm],
        [t("company.industry"), c.industry],
        [t("company.form.businessActivity"), c.businessActivity],
        [t("company.form.activityCode"), c.activityCode],
        [t("company.form.size"), c.size ? t(`company.form.sizes.${c.size}`) : ""],
        [t("company.form.description"), c.description],
      ] },
      { key: "legal", title: t("company.section.legal"), rows: [
        [t("company.ice"), c.ice || "—"],
        [t("company.taxId"), c.taxId || "—"],
        [t("company.registrationNumber"), c.registrationNumber || "—"],
        [t("company.form.registrationCity"), c.registrationCity],
        [t("company.form.registrationDate"), c.registrationDate ? new Date(c.registrationDate).toLocaleDateString(language || "fr") : ""],
        [t("company.form.cnssNumber"), c.cnssNumber],
        [t("company.form.professionalTaxNumber"), c.professionalTaxNumber],
        [t("company.form.taxOffice"), c.taxOffice],
      ] },
      { key: "contact", title: t("company.section.contact"), rows: [
        [t("company.email"), c.email || "—"],
        [t("company.phone"), c.phone || "—"],
        [t("company.form.secondaryPhone"), c.secondaryPhone],
        [t("company.form.fax"), c.fax],
        [t("company.website"), c.website],
      ] },
      { key: "address", title: t("company.form.sectionAddress"), rows: [
        [t("company.street"), [a.street, a.additionalLine].filter(Boolean).join(", ")],
        [t("company.form.neighborhood"), a.neighborhood],
        [t("company.city"), [a.postalCode, a.city].filter(Boolean).join(" ")],
        [t("company.form.region"), a.region],
        [t("company.form.country"), a.country ? `${a.country}${a.countryCode ? ` (${a.countryCode})` : ""}` : ""],
        [t("company.form.gps"), coords],
      ] },
      { key: "bank", title: t("company.form.sectionBank"), rows: [
        [t("company.form.bankName"), c.bank?.bankName],
        [t("company.form.accountName"), c.bank?.accountName],
        [t("company.form.rib"), c.bank?.rib],
        [t("company.form.iban"), c.bank?.iban],
        [t("company.form.swift"), c.bank?.swift],
      ] },
      { key: "regional", title: t("company.form.sectionRegional"), rows: [
        [t("company.form.currency"), c.currency],
        [t("company.form.fiscalYearStart"), month ? `${c.fiscalYear?.startDay || 1} ${month}` : ""],
        [t("company.form.language"), { fr: "Français", ar: "العربية", en: "English" }[c.localization?.language] || ""],
        [t("company.form.timezone"), c.localization?.timezone],
        [t("company.form.dateFormat"), [c.localization?.dateFormat, c.localization?.timeFormat].filter(Boolean).join(" · ")],
      ] },
      { key: "branding", title: t("company.form.sectionBranding"), rows: [
        [t("company.form.primaryColor"), swatch(c.branding?.primaryColor)],
        [t("company.form.secondaryColor"), swatch(c.branding?.secondaryColor)],
        [t("company.form.accentColor"), swatch(c.branding?.accentColor)],
        [t("company.form.darkMode"), c.branding ? (c.branding.darkMode ? t("company.form.yes") : t("company.form.no")) : ""],
      ] },
    ];
  };

  // ========================================
  // INITIAL LOADING
  // ========================================

  if (initialLoading) {
    return (
      <div className="pageShell">
        <div className="loadingState">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  // ========================================
  // INITIAL FORM VALUES
  // ========================================

  // Creating a new company starts from an empty form, not from the
  // company currently shown.
  const formSource = mode === "create" ? null : company;
  const companyFull = quota?.maxCompanies != null && quota.companies >= quota.maxCompanies;

  const initialFormValues = companyToForm(formSource);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.organization") }, { label: t("company.title") }]} />

      {/* ==================================
          HEADER
          ================================== */}

      <div className="pageHeader">

        <div>
          <div className="pageTitleRow">

            <Building2 size={20} />

            <h1>
              {company
                ? company.name
                : t("company.title")}
            </h1>

          </div>

          <p className="pageSubtitle">
            {company
              ? t("company.subtitle")
              : t(
                "company.emptySubtitle"
              )}
          </p>
        </div>

        {/* ==================================
            HEADER ACTIONS
            ================================== */}

        {company && !mode && canManageCompany(user, company) && (
          <div className="pageHeaderActions">

            {/* DOWNLOAD FICHE */}

            <button
              type="button"
              className="btnEdit"
              onClick={handleDownloadFiche}
              disabled={ficheDownloading}
            >
              <FileDown size={16} />

              {ficheDownloading ? t("common.loading") : t("company.downloadFiche")}
            </button>

            {/* EDIT */}

            <button
              type="button"
              className={
                `btnEdit ${styles.editButton}`
              }
              onClick={() =>
                setMode("edit")
              }
            >
              <Pencil size={16} />

              {t("common.edit")}
            </button>

            {/* DELETE */}

            <button
              type="button"
              className={
                "btnDelete"
              }
              onClick={
                handleDeleteCompany
              }
            >
              <Trash2 size={16} />

              {t(
                "company.deleteCompany"
              )}
            </button>

          </div>
        )}

      </div>

      {/* ==================================
          COMPANIES OF THE CLIENT + QUOTA
          ================================== */}

      {companies.length > 0 && !mode && (
        <div className={styles.companyBar}>
          {companies.map((c) => (
            <button key={c._id} type="button" onClick={() => setCompany(c)}
              className={`${styles.companyChip} ${company?._id === c._id ? styles.companyChipActive : ""}`}>
              <Building2 size={13} /> {c.name}
            </button>
          ))}
          {canCreateCompany(user) && (
            <button type="button" className="btnEdit" disabled={companyFull}
              title={companyFull ? t("quota.companiesFull") : ""} onClick={() => setMode("create")}>
              <Plus size={14} /> {t("quota.newCompany")}
              {quota?.maxCompanies != null && <span className={styles.quotaBadge}>{quota.companies} / {quota.maxCompanies}</span>}
            </button>
          )}
          {quota && (quota.maxCompanies != null || quota.maxEmployees != null) && (
            <span className={styles.quotaLine}>
              {t("quota.companies")} : {quota.companies}{quota.maxCompanies != null ? ` / ${quota.maxCompanies}` : ""}
              {" · "}
              {t("quota.employees")} : {quota.employees}{quota.maxEmployees != null ? ` / ${quota.maxEmployees}` : ""}
            </span>
          )}
          {companyFull && <span className={styles.quotaLine}>{t("quota.companiesFull")}</span>}
        </div>
      )}

      {/* ==================================
          EMPTY STATE
          ================================== */}

      {!company && !mode && (
        <div className="emptyStateBlock">

          <div className="emptyStateIcon">
            <Building2 size={28} />
          </div>

          <h2>
            {t(
              "company.emptyTitle"
            )}
          </h2>

          <p>
            {t(
              "company.emptyMessage"
            )}
          </p>

          {canCreateCompany(user) && (
            <button
              type="button"
              className={
                "btnPrimary"
              }
              onClick={() =>
                setMode("create")
              }
            >
              <Plus size={16} />

              {t("company.create")}
            </button>
          )}

        </div>
      )}

      {/* ==================================
          FORM
          ================================== */}

      {mode && (
        <div
          className={
            "formShell"
          }
        >

          <CollapsibleForm
            title={
              mode === "create"
                ? t("company.create")
                : t(
                  "company.editTitle"
                )
            }

            icon={
              <Building2 size={16} />
            }

            defaultOpen

            fields={companyFields}

            buttons={companyButtons}

            onSubmit={handleSubmit}

            onFieldChange={(name, value) => {
              if (name === "legalForm") setLegalFormDraft(value);
            }}

            initialValues={
              initialFormValues
            }
          />

        </div>
      )}

      {/* ==================================
          COMPANY CARD
          ================================== */}

      {company && !mode && (
        <div
          className={
            "detailCard"
          }
        >

          {/* ==================================
              LOGO
              ================================== */}

          {company.logo?.url && (
            <div
              className={
                styles.logoSection
              }
            >
              <img
                src={company.logo.url}
                alt={company.name}
                className={
                  styles.logo
                }
              />
            </div>
          )}

          {detailSections(company).map((section) => {
            const rows = section.rows.filter(([, v]) => v !== "" && v != null && v !== false);
            if (!rows.length) return null;
            return (
              <div key={section.key} className="detailSection">
                <h2>{section.title}</h2>
                <div className="detailGrid">
                  {rows.map(([label, value]) => (
                    <div key={label} className="detailInfo">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* ==================================
              EMPLOYEE COUNT
              ================================== */}

          <div
            className={
              styles.employeeSection
            }
          >

            <div
              className={
                styles.employeeIcon
              }
            >
              <Users size={20} />
            </div>

            <div>

              <span>
                {t(
                  "company.employeeCount"
                )}
              </span>

              <strong>
                {company.activeEmployeeCount ??
                  0}
              </strong>

            </div>

          </div>

        </div>
      )}

      {/* ==================================
          WORKFLOW SETTINGS (sequential approval toggle)
          ================================== */}

      {company && !mode && <CompanyWorkflowSettings company={company} />}

      {/* ==================================
          ACTION MODAL
          ================================== */}

      <ActionModal
        isOpen={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        loading={loading}
        onConfirm={handleConfirm}
        onClose={handleCloseModal}
      />

    </div>
  );
}
