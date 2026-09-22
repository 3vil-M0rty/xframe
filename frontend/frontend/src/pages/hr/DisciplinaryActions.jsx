import { useEffect, useState } from "react";
import { ShieldAlert, Plus, Trash2, Edit } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import ActionModal from "../../components/useful/ActionModal";
import StatusPill from "../../components/useful/StatusPill";

import {
  getDisciplinaryActions,
  createDisciplinaryAction,
  updateDisciplinaryAction,
  deleteDisciplinaryAction,
} from "../../services/disciplinaryActionService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./DisciplinaryActions.module.css";

const TYPES = ["verbal_warning", "written_warning", "final_warning", "suspension", "termination_notice"];

export default function DisciplinaryActions() {
  const { t } = useI18n();

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
      } catch (err) {
        console.error("Failed to load companies:", err);
      } finally {
        setCompaniesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = companies.map((c) => ({ value: c._id, label: c.name || t("employees.company.unnamed") }));

  // ---------- Employees (for the employee/issuedBy pickers) ----------
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    if (!selectedCompanyId) { setEmployees([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { employees: data } = await getEmployees({ companyId: selectedCompanyId, page: 1, limit: 500 });
        if (!cancelled) setEmployees(data || []);
      } catch (err) {
        console.error("Failed to load employees:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);
  const employeeOptions = buildEmployeeSearchOptions(employees);

  // ---------- List ----------
  const [actions, setActions] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async () => {
    if (!selectedCompanyId) return;
    const { actions: data, pagination: p } = await getDisciplinaryActions({ companyId: selectedCompanyId, page, limit: 20 });
    setActions(data || []);
    if (p) setPagination(p);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setActions([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { actions: data, pagination: p } = await getDisciplinaryActions({ companyId: selectedCompanyId, page, limit: 20 });
        if (cancelled) return;
        setActions(data || []);
        if (p) setPagination(p);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("disciplinaryActions.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, page, t]);

  // ---------- Create/edit form ----------
  const [showForm, setShowForm] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreateForm = () => { setEditingAction(null); setShowForm(true); };
  const openEditForm = (action) => { setEditingAction(action); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingAction(null); };

  const fields = [
    { name: "employee", label: t("disciplinaryActions.fields.employee"), type: "search-select", options: employeeOptions, placeholder: t("salaries.fields.employeeSearchPlaceholder"), noResultsLabel: t("common.noResults"), required: true, fullWidth: true },
    {
      name: "type", label: t("disciplinaryActions.fields.type"), type: "select", required: true,
      options: TYPES.map((v) => ({ value: v, label: t(`disciplinaryActions.types.${v}`) })),
    },
    { name: "date", label: t("disciplinaryActions.fields.date"), type: "date", required: true },
    { name: "reason", label: t("disciplinaryActions.fields.reason"), type: "text", required: true, fullWidth: true },
    { name: "description", label: t("disciplinaryActions.fields.description"), type: "textarea", fullWidth: true },
    { name: "suspensionDays", label: t("disciplinaryActions.fields.suspensionDays"), type: "number" },
    { name: "issuedBy", label: t("disciplinaryActions.fields.issuedBy"), type: "search-select", options: employeeOptions, placeholder: t("salaries.fields.employeeSearchPlaceholder"), noResultsLabel: t("common.noResults") },
    { name: "notes", label: t("disciplinaryActions.fields.notes"), type: "textarea", fullWidth: true },
  ];

  const initialValues = editingAction
    ? {
        employee: editingAction.employee?._id || editingAction.employee || "",
        type: editingAction.type || "",
        date: editingAction.date ? editingAction.date.substring(0, 10) : "",
        reason: editingAction.reason || "",
        description: editingAction.description || "",
        suspensionDays: editingAction.suspensionDays || "",
        issuedBy: editingAction.issuedBy?._id || editingAction.issuedBy || "",
        notes: editingAction.notes || "",
      }
    : { employee: "", type: "", date: new Date().toISOString().substring(0, 10), reason: "", description: "", suspensionDays: "", issuedBy: "", notes: "" };

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      const payload = { ...formData, company: selectedCompanyId, suspensionDays: formData.suspensionDays ? Number(formData.suspensionDays) : null };
      if (editingAction) await updateDisciplinaryAction(editingAction._id, payload);
      else await createDisciplinaryAction(payload);
      closeForm();
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || t("disciplinaryActions.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Delete ----------
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteDisciplinaryAction(deleteTarget._id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || t("disciplinaryActions.errors.deleteFailed"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const employeeName = (emp) => `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() || "—";
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("disciplinaryActions.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("disciplinaryActions.breadcrumbs.disciplinaryActions") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <ShieldAlert size={20} />
            <h1>{t("disciplinaryActions.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("disciplinaryActions.subtitle")}</p>
        </div>
        {selectedCompanyId && !showForm && (
          <button type="button" className="btnPrimary" onClick={openCreateForm}>
            <Plus size={16} />
            {t("disciplinaryActions.addAction")}
          </button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions} disabled={companiesLoading} />
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}

      {showForm && (
        <div className="formShell">
          <CollapsibleForm
            title={editingAction ? t("disciplinaryActions.editAction") : t("disciplinaryActions.addAction")}
            icon={<ShieldAlert size={16} />}
            fields={fields}
            initialValues={initialValues}
            defaultOpen
            onSubmit={handleSubmit}
            buttons={[
              { label: t("common.cancel"), type: "button", variant: "secondary", onClick: closeForm },
              { label: saving ? t("common.loading") : t("common.save"), type: "submit", variant: "primary", disabled: saving },
            ]}
          />
        </div>
      )}

      {!showForm && (
        <>
          {loading && <p className={styles.loadingText}>{t("common.loading")}</p>}

          {!loading && actions.length === 0 && (
            <div className="emptyState">
              <p>{t("disciplinaryActions.emptyTitle")}</p>
              <p className="emptyStateSubtitle">{t("disciplinaryActions.emptyMessage")}</p>
            </div>
          )}

          {!loading && actions.length > 0 && (
            <div className={styles.list}>
              {actions.map((action) => (
                <div key={action._id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.employeeName}>{employeeName(action.employee)}</span>
                      <span className={styles.typeLabel}>{t(`disciplinaryActions.types.${action.type}`)}</span>
                    </div>
                    <StatusPill
                      status={action.acknowledgedByEmployee ? "accepted" : "pending"}
                      label={action.acknowledgedByEmployee ? t("disciplinaryActions.acknowledged") : t("disciplinaryActions.notAcknowledged")}
                    />
                  </div>
                  <p className={styles.reason}>{action.reason}</p>
                  <div className={styles.cardFooter}>
                    <span className={styles.date}>{formatDate(action.date)}</span>
                    <div className="dataTableActions">
                      <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => openEditForm(action)}>
                        <Edit size={14} />
                      </button>
                      <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => setDeleteTarget(action)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && actions.length > 0 && (
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
          )}
        </>
      )}

      <ActionModal
        isOpen={!!deleteTarget}
        type="confirm"
        title={t("disciplinaryActions.deleteTitle")}
        message={t("disciplinaryActions.deleteSureMessage")}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
