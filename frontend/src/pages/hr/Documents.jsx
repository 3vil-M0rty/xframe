import { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpen,
  Upload,
  Trash2,
  Edit,
  BriefcaseBusiness,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import ActionModal from "../../components/useful/ActionModal";

import {
  getDocuments,
  uploadDocument,
  updateDocument,
  deleteDocument,
  getExpiringDocuments,
} from "../../services/documentService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./Documents.module.css";

function employeeName(employee) {
  if (!employee) return "—";
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

// Pulls a display extension from either the stored original
// filename or the file URL itself (Cloudinary URLs generally keep
// the real extension at the end, e.g. ".../file.pdf").
function getFileExtension(doc) {
  const source = doc.file?.originalName || doc.file?.url || "";
  const match = source.match(/\.([a-zA-Z0-9]{2,5})(?:\?.*)?$/);
  return match ? match[1].toUpperCase() : "FILE";
}

const DOCUMENT_TYPES = [
  "cin", "passport", "work_permit", "residence_permit",
  "contract", "diploma", "cv", "medical_certificate", "other",
];

export default function Documents() {
  const { t } = useI18n();
  const fileInputRef = useRef(null);

  // ---------- Company ----------
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

  // ---------- Employees (for the upload form + grouping) ----------
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

  // ---------- Documents (fetched all-at-once per company, grouped client-side) ----------
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async () => {
    if (!selectedCompanyId) return;
    const { documents: data } = await getDocuments({ companyId: selectedCompanyId, limit: 500 });
    setDocuments(data);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setDocuments([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { documents: data } = await getDocuments({ companyId: selectedCompanyId, limit: 500 });
        if (cancelled) return;
        setDocuments(data);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("documents.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, t]);

  // Group documents by employee, sorted by employee name.
  const groups = useMemo(() => {
    const byEmployee = new Map();
    for (const doc of documents) {
      const empId = doc.employee?._id || "unknown";
      if (!byEmployee.has(empId)) {
        byEmployee.set(empId, { employee: doc.employee, docs: [] });
      }
      byEmployee.get(empId).docs.push(doc);
    }
    return [...byEmployee.values()].sort((a, b) =>
      employeeName(a.employee).localeCompare(employeeName(b.employee))
    );
  }, [documents]);

  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (empId) =>
    setCollapsedGroups((prev) => ({ ...prev, [empId]: !prev[empId] }));

  // ---------- Expiring-soon banner ----------
  const [expiring, setExpiring] = useState([]);
  useEffect(() => {
    if (!selectedCompanyId) { setExpiring([]); return; }
    getExpiringDocuments({ companyId: selectedCompanyId, withinDays: 30 }).then(setExpiring).catch(() => setExpiring([]));
  }, [selectedCompanyId, documents]);

  // ---------- Upload / Edit form ----------
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null); // null = uploading new; otherwise editing this doc
  const [formEmployee, setFormEmployee] = useState("");
  const [formType, setFormType] = useState("cin");
  const [formLabel, setFormLabel] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const documentTypeOptions = DOCUMENT_TYPES.map((v) => ({ value: v, label: t(`documents.types.${v}`) }));

  const resetForm = () => {
    setFormEmployee("");
    setFormType("cin");
    setFormLabel("");
    setFormExpiryDate("");
    setSelectedFile(null);
    setFormError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openUploadForm = () => {
    setEditingDoc(null);
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (doc) => {
    setEditingDoc(doc);
    setFormEmployee(doc.employee?._id || "");
    setFormType(doc.type);
    setFormLabel(doc.label || "");
    setFormExpiryDate(doc.expiryDate ? doc.expiryDate.slice(0, 10) : "");
    setSelectedFile(null);
    setFormError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDoc(null);
    resetForm();
  };

  const handleSubmitForm = async (event) => {
    event.preventDefault();

    if (editingDoc) {
      setSaving(true);
      setFormError("");
      try {
        await updateDocument(editingDoc._id, {
          type: formType,
          label: formLabel,
          expiryDate: formExpiryDate || null,
          file: selectedFile || undefined,
        });
        closeForm();
        await reload();
      } catch (error) {
        setFormError(error.response?.data?.message || t("documents.errors.actionFailed"));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!formEmployee || !selectedFile) {
      setFormError(t("documents.errors.missingFields"));
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await uploadDocument({
        file: selectedFile,
        company: selectedCompanyId,
        employee: formEmployee,
        type: formType,
        label: formLabel,
        expiryDate: formExpiryDate || undefined,
      });
      closeForm();
      await reload();
    } catch (error) {
      setFormError(error.response?.data?.message || t("documents.errors.uploadFailed"));
    } finally {
      setSaving(false);
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
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("documents.errors.actionFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  const gridColumns = "minmax(140px,1.2fr) 70px minmax(110px,0.9fr) minmax(90px,0.7fr) 1fr";

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
            <button type="button" className="btnPrimary" onClick={openUploadForm}>
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

      {showForm && selectedCompanyId && (
        <form className={styles.uploadForm} onSubmit={handleSubmitForm}>
          <h3>{editingDoc ? t("documents.editDocument") : t("documents.uploadDocument")}</h3>

          {formError && <div className={styles.errorMessage}>{formError}</div>}

          <div className={styles.uploadGrid}>
            {!editingDoc && (
              <div className={styles.uploadField} style={{ gridColumn: "1 / -1" }}>
                <label>{t("documents.fields.employee")}</label>
                <SearchSelect
                  value={formEmployee}
                  onSelect={setFormEmployee}
                  options={employeeOptions}
                  placeholder={t("salaries.fields.employeeSearchPlaceholder")}
                  noResultsLabel={t("common.noResults")}
                />
              </div>
            )}

            {editingDoc && (
              <div className={styles.uploadField} style={{ gridColumn: "1 / -1" }}>
                <label>{t("documents.fields.employee")}</label>
                <div className={styles.readOnlyValue}>{employeeName(editingDoc.employee)}</div>
              </div>
            )}

            <div className={styles.uploadField}>
              <label>{t("documents.fields.type")}</label>
              <CustomSelect value={formType} onSelect={setFormType} options={documentTypeOptions} />
            </div>

            <div className={styles.uploadField}>
              <label>{t("documents.fields.label")}</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder={t("documents.fields.labelPlaceholder")}
                className={styles.textInput}
              />
            </div>

            <div className={styles.uploadField}>
              <label>{t("documents.fields.expiryDate")}</label>
              <input
                type="date"
                value={formExpiryDate}
                onChange={(e) => setFormExpiryDate(e.target.value)}
                className={styles.textInput}
              />
            </div>

            <div className={styles.uploadField}>
              <label>
                {editingDoc ? t("documents.fields.replaceFile") : t("documents.fields.file")}
              </label>
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
            <button type="button" className="btnCancel" onClick={closeForm}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btnPrimary" disabled={saving}>
              {saving ? t("payroll.buttons.saving") : editingDoc ? t("common.update") : t("documents.buttons.upload")}
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

      {selectedCompanyId && !loading && groups.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><FolderOpen size={28} /></div>
          <h2>{t("documents.emptyTitle")}</h2>
          <p>{t("documents.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && groups.length > 0 && (
        <div className={styles.groupList}>
          {groups.map((group) => {
            const empId = group.employee?._id || "unknown";
            const isCollapsed = !!collapsedGroups[empId];

            return (
              <div key={empId} className={styles.group}>
                <button
                  type="button"
                  className={styles.groupHeader}
                  onClick={() => toggleGroup(empId)}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span className={styles.groupName}>{employeeName(group.employee)}</span>
                  <span className={styles.groupCount}>{group.docs.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="dataTable">
                    <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
                      <span>{t("documents.fields.type")}</span>
                      <span>{t("documents.table.file")}</span>
                      <span>{t("documents.fields.expiryDate")}</span>
                      <span></span>
                      <span />
                    </div>

                    {group.docs.map((doc) => (
                      <div key={doc._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                        <span className="dataTableCellMuted">{doc.label || t(`documents.types.${doc.type}`)}</span>
                        <span className={styles.extensionBadge}>{getFileExtension(doc)}</span>
                        <span className="dataTableCellMuted">{doc.expiryDate ? formatDate(doc.expiryDate) : "—"}</span>
                        <a href={doc.file?.url} target="_blank" rel="noopener noreferrer" className={styles.viewLink}>
                          <FileText size={14} />
                          {t("documents.actions.view")}
                        </a>
                        <div className="dataTableActions">
                          <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => openEditForm(doc)}>
                            <Edit size={14} />
                          </button>
                          <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => askDelete(doc)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActionModal isOpen={modal.open} type={modal.type} title={modal.title} message={modal.message} loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirmDelete : undefined} onClose={closeModal} />
    </div>
  );
}
