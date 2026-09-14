import { useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  Upload,
  Trash2,
  BriefcaseBusiness,
  AlertTriangle,
  FileText,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import ActionModal from "../../components/useful/ActionModal";

import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getExpiringDocuments,
} from "../../services/documentService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./Documents.module.css";

const PAGE_SIZE = 15;

function employeeName(employee) {
  if (!employee) return "—";
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

export default function Documents() {
  const { t } = useI18n();
  const fileInputRef = useRef(null);

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

  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    if (!selectedCompanyId) { setEmployees([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { employees: data } = await getEmployees({ companyId: selectedCompanyId, page: 1, limit: 500 });
        if (!cancelled) setEmployees(data || []);
      } catch (error) {
        console.error("Failed to load employees:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  const employeeOptions = buildEmployeeSearchOptions(employees);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { setPage(1); }, [selectedCompanyId]);

  const reload = async (targetPage = page) => {
    if (!selectedCompanyId) return;
    const { documents: data, pagination: p } = await getDocuments({ companyId: selectedCompanyId, page: targetPage, limit: PAGE_SIZE });
    setDocuments(data);
    setPagination(p);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setDocuments([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { documents: data, pagination: p } = await getDocuments({ companyId: selectedCompanyId, page, limit: PAGE_SIZE });
        if (cancelled) return;
        setDocuments(data);
        setPagination(p);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("documents.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, page, t]);

  const [expiring, setExpiring] = useState([]);
  useEffect(() => {
    if (!selectedCompanyId) { setExpiring([]); return; }
    getExpiringDocuments({ companyId: selectedCompanyId, withinDays: 30 }).then(setExpiring).catch(() => setExpiring([]));
  }, [selectedCompanyId, documents]);

  // ---------- Upload form ----------
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadEmployee, setUploadEmployee] = useState("");
  const [uploadType, setUploadType] = useState("cin");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadExpiryDate, setUploadExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const documentTypeOptions = [
    { value: "cin", label: t("documents.types.cin") },
    { value: "passport", label: t("documents.types.passport") },
    { value: "work_permit", label: t("documents.types.work_permit") },
    { value: "residence_permit", label: t("documents.types.residence_permit") },
    { value: "contract", label: t("documents.types.contract") },
    { value: "diploma", label: t("documents.types.diploma") },
    { value: "cv", label: t("documents.types.cv") },
    { value: "medical_certificate", label: t("documents.types.medical_certificate") },
    { value: "other", label: t("documents.types.other") },
  ];

  const resetUploadForm = () => {
    setUploadEmployee("");
    setUploadType("cin");
    setUploadLabel("");
    setUploadExpiryDate("");
    setSelectedFile(null);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadEmployee || !selectedFile) {
      setUploadError(t("documents.errors.missingFields"));
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      await uploadDocument({
        file: selectedFile,
        company: selectedCompanyId,
        employee: uploadEmployee,
        type: uploadType,
        label: uploadLabel,
        expiryDate: uploadExpiryDate || undefined,
      });
      setShowUploadForm(false);
      resetUploadForm();
      setPage(1);
      await reload(1);
    } catch (error) {
      setUploadError(error.response?.data?.message || t("documents.errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  // ---------- Delete ----------
  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const askDelete = (doc) => {
    setPendingDeleteId(doc._id);
    setModal({ open: true, type: "confirm", title: t("documents.deleteTitle"), message: t("documents.deleteSureMessage") });
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModal((p) => ({ ...p, open: false }));
    setPendingDeleteId(null);
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      await deleteDocument(pendingDeleteId);
      setDocuments((prev) => prev.filter((d) => d._id !== pendingDeleteId));
      setModal((p) => ({ ...p, open: false }));
      setPendingDeleteId(null);
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("documents.errors.actionFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  const gridColumns = "minmax(140px,1.2fr) minmax(120px,1fr) minmax(110px,0.9fr) minmax(90px,0.7fr) 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("documents.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("documents.breadcrumbs.documents") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <FolderOpen size={20} />
            <h1>{t("documents.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("documents.subtitle")}</p>
        </div>
        {selectedCompanyId && (
          <div className="pageHeaderActions">
            <button type="button" className="btnPrimary" onClick={() => setShowUploadForm((p) => !p)}>
              <Upload size={16} />
              {t("documents.uploadDocument")}
            </button>
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading} />
        </div>
      </div>

      {expiring.length > 0 && (
        <div className={styles.expiringBanner}>
          <AlertTriangle size={16} />
          <span>{t("documents.expiringBanner").replace("{count}", expiring.length)}</span>
        </div>
      )}

      {showUploadForm && selectedCompanyId && (
        <form className={styles.uploadForm} onSubmit={handleUpload}>
          <h3>{t("documents.uploadDocument")}</h3>

          {uploadError && <div className={styles.errorMessage}>{uploadError}</div>}

          <div className={styles.uploadGrid}>
            <div className={styles.uploadField} style={{ gridColumn: "1 / -1" }}>
              <label>{t("documents.fields.employee")}</label>
              <SearchSelect
                value={uploadEmployee}
                onSelect={setUploadEmployee}
                options={employeeOptions}
                placeholder={t("salaries.fields.employeeSearchPlaceholder")}
                noResultsLabel={t("common.noResults")}
              />
            </div>

            <div className={styles.uploadField}>
              <label>{t("documents.fields.type")}</label>
              <CustomSelect value={uploadType} onSelect={setUploadType} options={documentTypeOptions} />
            </div>

            <div className={styles.uploadField}>
              <label>{t("documents.fields.label")}</label>
              <input
                type="text"
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                placeholder={t("documents.fields.labelPlaceholder")}
                className={styles.textInput}
              />
            </div>

            <div className={styles.uploadField}>
              <label>{t("documents.fields.expiryDate")}</label>
              <input
                type="date"
                value={uploadExpiryDate}
                onChange={(e) => setUploadExpiryDate(e.target.value)}
                className={styles.textInput}
              />
            </div>

            <div className={styles.uploadField}>
              <label>{t("documents.fields.file")}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className={styles.textInput}
              />
            </div>
          </div>

          <div className={styles.uploadActions}>
            <button type="button" className="btnCancel" onClick={() => { setShowUploadForm(false); resetUploadForm(); }}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btnPrimary" disabled={uploading}>
              {uploading ? t("payroll.buttons.saving") : t("documents.buttons.upload")}
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

      {error && <div className={styles.errorMessage}>{error}</div>}

      {selectedCompanyId && !loading && documents.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><FolderOpen size={28} /></div>
          <h2>{t("documents.emptyTitle")}</h2>
          <p>{t("documents.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && documents.length > 0 && (
        <>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
              <span>{t("documents.fields.employee")}</span>
              <span>{t("documents.fields.type")}</span>
              <span>{t("documents.fields.expiryDate")}</span>
              <span></span>
              <span />
            </div>
            {documents.map((doc) => (
              <div key={doc._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                <span>{employeeName(doc.employee)}</span>
                <span className="dataTableCellMuted">{doc.label || t(`documents.types.${doc.type}`)}</span>
                <span className="dataTableCellMuted">{doc.expiryDate ? formatDate(doc.expiryDate) : "—"}</span>
                <a href={doc.file?.url} target="_blank" rel="noopener noreferrer" className={styles.viewLink}>
                  <FileText size={14} />
                  {t("documents.actions.view")}
                </a>
                <div className="dataTableActions">
                  <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => askDelete(doc)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        </>
      )}

      <ActionModal isOpen={modal.open} type={modal.type} title={modal.title} message={modal.message} loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirmDelete : undefined} onClose={closeModal} />
    </div>
  );
}
