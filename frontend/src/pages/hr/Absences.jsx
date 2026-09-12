import { useEffect, useState } from "react";
import {
  CalendarOff,
  Plus,
  Check,
  X,
  Trash2,
  BriefcaseBusiness,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import ActionModal from "../../components/useful/ActionModal";
import StatusPill from "../../components/useful/StatusPill";

import {
  getAbsences,
  createAbsence,
  reviewAbsence,
  deleteAbsence,
} from "../../services/absenceService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./Absences.module.css";

const ABSENCES_PAGE_SIZE = 15;

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

function employeeName(employee) {
  if (!employee) return "—";
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

export default function Absences() {
  const { t } = useI18n();

  // ========================================
  // COMPANIES
  // ========================================

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setCompaniesLoading(true);
        const data = await getCompanies();
        const list = Array.isArray(data) ? data : [];
        setCompanies(list);
        if (!selectedCompanyId && list.length > 0) {
          setSelectedCompanyId(list[0]._id);
        }
      } catch (error) {
        console.error("Failed to load companies:", error);
      } finally {
        setCompaniesLoading(false);
      }
    };

    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = companies.map((company) => ({
    value: company._id,
    label: company.name || company.tradeName || t("employees.company.unnamed"),
  }));

  // ========================================
  // EMPLOYEES (for the create-form select)
  // ========================================

  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setEmployees([]);
      return;
    }

    let cancelled = false;

    const loadEmployees = async () => {
      try {
        const { employees: data } = await getEmployees({
          companyId: selectedCompanyId,
          page: 1,
          limit: 500,
        });
        if (!cancelled) setEmployees(data || []);
      } catch (error) {
        console.error("Failed to load employees:", error);
      }
    };

    loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId]);

  const employeeOptions = buildEmployeeSearchOptions(employees);

  // ========================================
  // FILTERS
  // ========================================

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: ABSENCES_PAGE_SIZE,
    pages: 1,
  });

  useEffect(() => {
    setPage(1);
  }, [selectedCompanyId, statusFilter, typeFilter]);

  // ========================================
  // LOAD ABSENCES
  // ========================================

  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedCompanyId) {
      setAbsences([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadAbsences = async () => {
      try {
        setLoading(true);
        setError("");

        const { absences: data, pagination: paginationData } =
          await getAbsences({
            companyId: selectedCompanyId,
            status: statusFilter || undefined,
            type: typeFilter || undefined,
            page,
            limit: ABSENCES_PAGE_SIZE,
          });

        if (cancelled) return;

        setAbsences(data || []);
        setPagination(paginationData);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load absences:", err);
        setError(
          err.response?.data?.message || t("absences.errors.fetchFailed")
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAbsences();

    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, statusFilter, typeFilter, page, t]);

  // ========================================
  // CREATE FORM
  // ========================================

  const [showCreateForm, setShowCreateForm] = useState(false);

  const absenceTypeOptions = [
    { value: "paid_leave", label: t("absences.types.paid_leave") },
    { value: "unpaid_leave", label: t("absences.types.unpaid_leave") },
    { value: "sick_leave", label: t("absences.types.sick_leave") },
    { value: "absence", label: t("absences.types.absence") },
    { value: "other", label: t("absences.types.other") },
  ];

  const absenceFields = [
    {
      name: "employee",
      label: t("absences.fields.employee"),
      type: "search-select",
      options: employeeOptions,
      placeholder: t("absences.fields.employeeSearchPlaceholder"),
      noResultsLabel: t("common.noResults"),
      required: true,
      fullWidth: true,
    },
    {
      name: "type",
      label: t("absences.fields.type"),
      type: "select",
      options: absenceTypeOptions,
      required: true,
    },
    {
      name: "startDate",
      label: t("absences.fields.startDate"),
      type: "date",
      required: true,
    },
    {
      name: "endDate",
      label: t("absences.fields.endDate"),
      type: "date",
      required: true,
    },
    {
      name: "halfDay",
      label: t("absences.fields.halfDay"),
      type: "checkbox",
    },
    {
      name: "justified",
      label: t("absences.fields.justified"),
      type: "checkbox",
    },
    {
      name: "reason",
      label: t("absences.fields.reason"),
      type: "textarea",
      fullWidth: true,
      placeholder: t("absences.fields.reasonPlaceholder"),
    },
  ];

  const absenceButtons = [
    {
      label: t("common.cancel"),
      type: "button",
      variant: "secondary",
      onClick: () => setShowCreateForm(false),
    },
    {
      label: t("common.reset"),
      type: "reset",
      variant: "secondary",
    },
    {
      label: t("absences.buttons.create"),
      type: "submit",
      variant: "primary",
    },
  ];

  // ========================================
  // MODAL
  // ========================================

  const [modal, setModal] = useState({
    open: false,
    type: "confirm",
    title: "",
    message: "",
  });
  const [modalAction, setModalAction] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const closeModal = () => {
    if (actionLoading) return;
    setModal((prev) => ({ ...prev, open: false }));
    setModalAction(null);
    setPendingData(null);
  };

  const handleSubmitCreate = (formData) => {
    setPendingData(formData);
    setModalAction("create");
    setModal({
      open: true,
      type: "confirm",
      title: t("absences.createTitle"),
      message: t("absences.createSureMessage"),
    });
  };

  const askReview = (absence, status) => {
    setPendingData({ id: absence._id, status });
    setModalAction("review");
    setModal({
      open: true,
      type: "confirm",
      title:
        status === "accepted"
          ? t("absences.acceptTitle")
          : t("absences.rejectTitle"),
      message:
        status === "accepted"
          ? t("absences.acceptSureMessage")
          : t("absences.rejectSureMessage"),
    });
  };

  const askDelete = (absence) => {
    setPendingData({ id: absence._id });
    setModalAction("delete");
    setModal({
      open: true,
      type: "confirm",
      title: t("absences.deleteTitle"),
      message: t("absences.deleteSureMessage"),
    });
  };

  const handleConfirm = async () => {
    setActionLoading(true);

    try {
      if (modalAction === "create") {
        await createAbsence({
          ...pendingData,
          company: selectedCompanyId,
        });
        setShowCreateForm(false);
        setPage(1);
        const { absences: data, pagination: paginationData } =
          await getAbsences({
            companyId: selectedCompanyId,
            status: statusFilter || undefined,
            type: typeFilter || undefined,
            page: 1,
            limit: ABSENCES_PAGE_SIZE,
          });
        setAbsences(data || []);
        setPagination(paginationData);

        setModal({
          open: true,
          type: "success",
          title: t("absences.createSuccessTitle"),
          message: t("absences.createSuccessMessage"),
        });
      } else if (modalAction === "review") {
        const updated = await reviewAbsence(pendingData.id, {
          status: pendingData.status,
        });
        setAbsences((prev) =>
          prev.map((item) => (item._id === updated._id ? updated : item))
        );
        setModal((prev) => ({ ...prev, open: false }));
        setModalAction(null);
        setPendingData(null);
      } else if (modalAction === "delete") {
        await deleteAbsence(pendingData.id);
        setAbsences((prev) =>
          prev.filter((item) => item._id !== pendingData.id)
        );
        setModal((prev) => ({ ...prev, open: false }));
        setModalAction(null);
        setPendingData(null);
      }
    } catch (error) {
      console.error("Absence action failed:", error);
      setModal({
        open: true,
        type: "error",
        title: t("common.fail"),
        message:
          error.response?.data?.message || t("absences.errors.actionFailed"),
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  const gridColumns =
    "minmax(160px,1.4fr) minmax(110px,0.8fr) minmax(140px,1fr) 70px 110px 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs
        items={[
          { label: t("absences.breadcrumbs.hr"), href: "/hr/employees" },
          { label: t("absences.breadcrumbs.absences") },
        ]}
      />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <CalendarOff size={20} />
            <h1>{t("absences.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("absences.subtitle")}</p>
        </div>

        {selectedCompanyId && (
          <div className="pageHeaderActions">
            <button
              type="button"
              className="btnPrimary"
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              <Plus size={16} />
              {t("absences.addAbsence")}
            </button>
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect
            value={selectedCompanyId}
            onSelect={setSelectedCompanyId}
            options={companyOptions}
            placeholder={
              companiesLoading
                ? t("employees.toolbar.loadingCompanies")
                : t("employees.toolbar.selectCompany")
            }
            disabled={companiesLoading}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>{t("absences.fields.status")}</label>
          <CustomSelect
            value={statusFilter}
            onSelect={setStatusFilter}
            options={[
              { value: "", label: t("absences.filters.allStatuses") },
              { value: "pending", label: t("absences.status.pending") },
              { value: "accepted", label: t("absences.status.accepted") },
              { value: "rejected", label: t("absences.status.rejected") },
            ]}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>{t("absences.fields.type")}</label>
          <CustomSelect
            value={typeFilter}
            onSelect={setTypeFilter}
            options={[
              { value: "", label: t("absences.filters.allTypes") },
              ...absenceTypeOptions,
            ]}
          />
        </div>
      </div>

      {showCreateForm && selectedCompanyId && (
        <CollapsibleForm
          title={t("absences.addAbsence")}
          icon={<CalendarOff size={16} />}
          fields={absenceFields}
          buttons={absenceButtons}
          onSubmit={handleSubmitCreate}
          defaultOpen
          initialValues={{ justified: true }}
        />
      )}

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon">
            <BriefcaseBusiness size={28} />
          </div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {selectedCompanyId && !loading && absences.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon">
            <CalendarOff size={28} />
          </div>
          <h2>{t("absences.emptyTitle")}</h2>
          <p>{t("absences.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && absences.length > 0 && (
        <>
          <div className="dataTable">
            <div
              className="dataTableHead"
              style={{ gridTemplateColumns: gridColumns }}
            >
              <span>{t("absences.fields.employee")}</span>
              <span>{t("absences.fields.type")}</span>
              <span>{t("absences.table.period")}</span>
              <span>{t("absences.table.days")}</span>
              <span>{t("absences.fields.status")}</span>
              <span />
            </div>

            {absences.map((absence) => (
              <div
                key={absence._id}
                className="dataTableRow"
                style={{ gridTemplateColumns: gridColumns }}
              >
                <span>{employeeName(absence.employee)}</span>

                <span className="dataTableCellMuted">
                  {t(`absences.types.${absence.type}`)}
                  {!absence.justified && (
                    <span className={styles.unjustifiedTag}>
                      {t("absences.unjustified")}
                    </span>
                  )}
                </span>

                <span className="dataTableCellMuted">
                  {formatDate(absence.startDate)} —{" "}
                  {formatDate(absence.endDate)}
                </span>

                <span className="dataTableCellMuted">
                  {absence.daysCount ?? "—"}
                </span>

                <StatusPill
                  status={absence.status}
                  label={t(`absences.status.${absence.status}`)}
                />

                <div className="dataTableActions">
                  {absence.status === "pending" && (
                    <>
                      <button
                        type="button"
                        className="tableActionBtn tableActionBtnAccept"
                        title={t("absences.actions.accept")}
                        onClick={() => askReview(absence, "accepted")}
                      >
                        <Check size={15} />
                      </button>

                      <button
                        type="button"
                        className="tableActionBtn tableActionBtnReject"
                        title={t("absences.actions.reject")}
                        onClick={() => askReview(absence, "rejected")}
                      >
                        <X size={15} />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="tableActionBtn tableActionBtnDanger"
                    title={t("common.delete")}
                    onClick={() => askDelete(absence)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={setPage}
          />
        </>
      )}

      <ActionModal
        isOpen={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirm : undefined}
        onClose={closeModal}
      />
    </div>
  );
}
