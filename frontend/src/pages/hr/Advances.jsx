import { useEffect, useState } from "react";
import {
  HandCoins,
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
  getAdvances,
  createAdvance,
  reviewAdvance,
  updateAdvance,
  deleteAdvance,
} from "../../services/advanceService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./Advances.module.css";

const ADVANCES_PAGE_SIZE = 15;

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

function employeeName(employee) {
  if (!employee) return "—";
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

function formatAmount(amount, currency) {
  if (amount === undefined || amount === null) return "—";
  return `${Number(amount).toLocaleString("en-US")} ${currency || "MAD"}`;
}

export default function Advances() {
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

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: ADVANCES_PAGE_SIZE,
    pages: 1,
  });

  useEffect(() => {
    setPage(1);
  }, [selectedCompanyId, statusFilter]);

  // ========================================
  // LOAD ADVANCES
  // ========================================

  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reloadAdvances = async (targetPage = page) => {
    if (!selectedCompanyId) return;

    const { advances: data, pagination: paginationData } = await getAdvances({
      companyId: selectedCompanyId,
      status: statusFilter || undefined,
      page: targetPage,
      limit: ADVANCES_PAGE_SIZE,
    });

    setAdvances(data || []);
    setPagination(paginationData);
  };

  useEffect(() => {
    if (!selectedCompanyId) {
      setAdvances([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadAdvances = async () => {
      try {
        setLoading(true);
        setError("");

        const { advances: data, pagination: paginationData } =
          await getAdvances({
            companyId: selectedCompanyId,
            status: statusFilter || undefined,
            page,
            limit: ADVANCES_PAGE_SIZE,
          });

        if (cancelled) return;

        setAdvances(data || []);
        setPagination(paginationData);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load advances:", err);
        setError(
          err.response?.data?.message || t("advances.errors.fetchFailed")
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAdvances();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, statusFilter, page, t]);

  // ========================================
  // CREATE FORM
  // ========================================

  const [showCreateForm, setShowCreateForm] = useState(false);

  const advanceFields = [
    {
      name: "employee",
      label: t("advances.fields.employee"),
      type: "search-select",
      options: employeeOptions,
      placeholder: t("advances.fields.employeeSearchPlaceholder"),
      noResultsLabel: t("common.noResults"),
      required: true,
      fullWidth: true,
    },
    {
      name: "amount",
      label: t("advances.fields.amount"),
      type: "number",
      required: true,
      placeholder: "0",
    },
    {
      name: "requestDate",
      label: t("advances.fields.requestDate"),
      type: "date",
    },
    {
      name: "reason",
      label: t("advances.fields.reason"),
      type: "textarea",
      fullWidth: true,
      placeholder: t("advances.fields.reasonPlaceholder"),
    },
  ];

  const advanceButtons = [
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
      label: t("advances.buttons.create"),
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
      title: t("advances.createTitle"),
      message: t("advances.createSureMessage"),
    });
  };

  const askReview = (advance, status) => {
    setPendingData({ id: advance._id, status });
    setModalAction("review");
    setModal({
      open: true,
      type: "confirm",
      title:
        status === "accepted"
          ? t("advances.acceptTitle")
          : t("advances.rejectTitle"),
      message:
        status === "accepted"
          ? t("advances.acceptSureMessage")
          : t("advances.rejectSureMessage"),
    });
  };

  const askMarkRepaid = (advance) => {
    setPendingData({ id: advance._id });
    setModalAction("repay");
    setModal({
      open: true,
      type: "confirm",
      title: t("advances.markRepaidTitle"),
      message: t("advances.markRepaidSureMessage"),
    });
  };

  const askDelete = (advance) => {
    setPendingData({ id: advance._id });
    setModalAction("delete");
    setModal({
      open: true,
      type: "confirm",
      title: t("advances.deleteTitle"),
      message: t("advances.deleteSureMessage"),
    });
  };

  const handleConfirm = async () => {
    setActionLoading(true);

    try {
      if (modalAction === "create") {
        await createAdvance({
          ...pendingData,
          company: selectedCompanyId,
        });
        setShowCreateForm(false);
        setPage(1);
        await reloadAdvances(1);

        setModal({
          open: true,
          type: "success",
          title: t("advances.createSuccessTitle"),
          message: t("advances.createSuccessMessage"),
        });
      } else if (modalAction === "review") {
        const updated = await reviewAdvance(pendingData.id, {
          status: pendingData.status,
        });
        setAdvances((prev) =>
          prev.map((item) => (item._id === updated._id ? updated : item))
        );
        setModal((prev) => ({ ...prev, open: false }));
        setModalAction(null);
        setPendingData(null);
      } else if (modalAction === "repay") {
        const target = advances.find((item) => item._id === pendingData.id);
        const updated = await updateAdvance(pendingData.id, {
          repaidAmount: target?.amount,
          repaid: true,
        });
        setAdvances((prev) =>
          prev.map((item) => (item._id === updated._id ? updated : item))
        );
        setModal((prev) => ({ ...prev, open: false }));
        setModalAction(null);
        setPendingData(null);
      } else if (modalAction === "delete") {
        await deleteAdvance(pendingData.id);
        setAdvances((prev) =>
          prev.filter((item) => item._id !== pendingData.id)
        );
        setModal((prev) => ({ ...prev, open: false }));
        setModalAction(null);
        setPendingData(null);
      }
    } catch (error) {
      console.error("Advance action failed:", error);
      setModal({
        open: true,
        type: "error",
        title: t("common.fail"),
        message:
          error.response?.data?.message || t("advances.errors.actionFailed"),
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  const gridColumns =
    "minmax(160px,1.4fr) minmax(100px,0.7fr) minmax(100px,0.7fr) 110px minmax(90px,0.6fr) 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs
        items={[
          { label: t("advances.breadcrumbs.hr"), href: "/hr/employees" },
          { label: t("advances.breadcrumbs.advances") },
        ]}
      />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <HandCoins size={20} />
            <h1>{t("advances.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("advances.subtitle")}</p>
        </div>

        {selectedCompanyId && (
          <div className="pageHeaderActions">
            <button
              type="button"
              className="btnPrimary"
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              <Plus size={16} />
              {t("advances.addAdvance")}
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
          <label>{t("advances.fields.status")}</label>
          <CustomSelect
            value={statusFilter}
            onSelect={setStatusFilter}
            options={[
              { value: "", label: t("advances.filters.allStatuses") },
              { value: "pending", label: t("advances.status.pending") },
              { value: "accepted", label: t("advances.status.accepted") },
              { value: "rejected", label: t("advances.status.rejected") },
            ]}
          />
        </div>
      </div>

      {showCreateForm && selectedCompanyId && (
        <CollapsibleForm
          title={t("advances.addAdvance")}
          icon={<HandCoins size={16} />}
          fields={advanceFields}
          buttons={advanceButtons}
          onSubmit={handleSubmitCreate}
          defaultOpen
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

      {selectedCompanyId && !loading && advances.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon">
            <HandCoins size={28} />
          </div>
          <h2>{t("advances.emptyTitle")}</h2>
          <p>{t("advances.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && advances.length > 0 && (
        <>
          <div className="dataTable">
            <div
              className="dataTableHead"
              style={{ gridTemplateColumns: gridColumns }}
            >
              <span>{t("advances.fields.employee")}</span>
              <span>{t("advances.fields.amount")}</span>
              <span>{t("advances.table.remaining")}</span>
              <span>{t("advances.fields.requestDate")}</span>
              <span>{t("advances.fields.status")}</span>
              <span />
            </div>

            {advances.map((advance) => (
              <div
                key={advance._id}
                className="dataTableRow"
                style={{ gridTemplateColumns: gridColumns }}
              >
                <span>{employeeName(advance.employee)}</span>

                <span>{formatAmount(advance.amount, advance.currency)}</span>

                <span className="dataTableCellMuted">
                  {advance.status === "accepted"
                    ? advance.repaid
                      ? t("advances.table.fullyRepaid")
                      : formatAmount(
                          advance.remainingAmount ??
                            advance.amount - (advance.repaidAmount || 0),
                          advance.currency
                        )
                    : "—"}
                </span>

                <span className="dataTableCellMuted">
                  {formatDate(advance.requestDate)}
                </span>

                <StatusPill
                  status={advance.status}
                  label={t(`advances.status.${advance.status}`)}
                />

                <div className="dataTableActions">
                  {advance.status === "pending" && (
                    <>
                      <button
                        type="button"
                        className="tableActionBtn tableActionBtnAccept"
                        title={t("advances.actions.accept")}
                        onClick={() => askReview(advance, "accepted")}
                      >
                        <Check size={15} />
                      </button>

                      <button
                        type="button"
                        className="tableActionBtn tableActionBtnReject"
                        title={t("advances.actions.reject")}
                        onClick={() => askReview(advance, "rejected")}
                      >
                        <X size={15} />
                      </button>
                    </>
                  )}

                  {advance.status === "accepted" && !advance.repaid && (
                    <button
                      type="button"
                      className="tableActionBtn tableActionBtnAccept"
                      title={t("advances.actions.markRepaid")}
                      onClick={() => askMarkRepaid(advance)}
                    >
                      <Check size={15} />
                    </button>
                  )}

                  <button
                    type="button"
                    className="tableActionBtn tableActionBtnDanger"
                    title={t("common.delete")}
                    onClick={() => askDelete(advance)}
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
