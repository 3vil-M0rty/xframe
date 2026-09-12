import { useEffect, useState } from "react";
import {
  Wallet,
  Plus,
  History,
  TrendingUp,
  Trash2,
  X,
  BriefcaseBusiness,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import ActionModal from "../../components/useful/ActionModal";

import {
  getSalaries,
  createSalary,
  deleteSalary,
} from "../../services/salaryService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./Salaries.module.css";

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

function sumItems(items) {
  return (items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
}

export default function Salaries() {
  const { t, tVar } = useI18n();

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
  // CURRENT SALARIES
  // ========================================

  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reloadCurrentSalaries = async () => {
    if (!selectedCompanyId) return;
    const { salaries: data } = await getSalaries({
      companyId: selectedCompanyId,
      current: true,
      limit: 500,
    });
    setSalaries(data || []);
  };

  useEffect(() => {
    if (!selectedCompanyId) {
      setSalaries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const { salaries: data } = await getSalaries({
          companyId: selectedCompanyId,
          current: true,
          limit: 500,
        });

        if (!cancelled) setSalaries(data || []);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load salaries:", err);
        setError(
          err.response?.data?.message || t("salaries.errors.fetchFailed")
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, t]);

  // ========================================
  // HISTORY PANEL (per employee)
  // ========================================

  const [historyEmployee, setHistoryEmployee] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (employee) => {
    setHistoryEmployee(employee);
    setHistoryLoading(true);

    try {
      const { salaries: data } = await getSalaries({
        companyId: selectedCompanyId,
        employeeId: employee._id,
        limit: 100,
      });
      setHistory(data || []);
    } catch (err) {
      console.error("Failed to load salary history:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryEmployee(null);
    setHistory([]);
  };

  // ========================================
  // CREATE / RAISE FORM
  // ========================================

  const [showCreateForm, setShowCreateForm] = useState(false);

  // Which employee to preselect in the "employee" field. Set when
  // opening the form from a row's "Give a raise" button; left empty
  // when opened from the page's main "Add salary" button.
  const [raiseEmployeeId, setRaiseEmployeeId] = useState("");

  const openCreateForm = (employeeId = "") => {
    setRaiseEmployeeId(employeeId);
    setShowCreateForm(true);
  };

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setRaiseEmployeeId("");
  };

  const salaryFields = [
    {
      name: "employee",
      label: t("salaries.fields.employee"),
      type: "search-select",
      options: employeeOptions,
      placeholder: t("salaries.fields.employeeSearchPlaceholder"),
      noResultsLabel: t("common.noResults"),
      required: true,
      fullWidth: true,
    },
    {
      name: "baseSalary",
      label: t("salaries.fields.baseSalary"),
      type: "number",
      required: true,
      placeholder: "0",
    },
    {
      name: "effectiveDate",
      label: t("salaries.fields.effectiveDate"),
      type: "date",
      required: true,
    },
    {
      name: "notes",
      label: t("salaries.fields.notes"),
      type: "textarea",
      fullWidth: true,
      placeholder: t("salaries.fields.notesPlaceholder"),
    },
  ];

  const salaryButtons = [
    {
      label: t("common.cancel"),
      type: "button",
      variant: "secondary",
      onClick: closeCreateForm,
    },
    {
      label: t("common.reset"),
      type: "reset",
      variant: "secondary",
    },
    {
      label: t("salaries.buttons.create"),
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
      title: t("salaries.createTitle"),
      message: t("salaries.createSureMessage"),
    });
  };

  const askDelete = (salary) => {
    setPendingData({ id: salary._id });
    setModalAction("delete");
    setModal({
      open: true,
      type: "confirm",
      title: t("salaries.deleteTitle"),
      message: t("salaries.deleteSureMessage"),
    });
  };

  const handleConfirm = async () => {
    setActionLoading(true);

    try {
      if (modalAction === "create") {
        await createSalary({
          ...pendingData,
          company: selectedCompanyId,
        });
        closeCreateForm();
        await reloadCurrentSalaries();
        if (historyEmployee && historyEmployee._id === pendingData.employee) {
          await openHistory(historyEmployee);
        }

        setModal({
          open: true,
          type: "success",
          title: t("salaries.createSuccessTitle"),
          message: t("salaries.createSuccessMessage"),
        });
      } else if (modalAction === "delete") {
        await deleteSalary(pendingData.id);
        setSalaries((prev) =>
          prev.filter((item) => item._id !== pendingData.id)
        );
        setHistory((prev) =>
          prev.filter((item) => item._id !== pendingData.id)
        );
        setModal((prev) => ({ ...prev, open: false }));
        setModalAction(null);
        setPendingData(null);
      }
    } catch (error) {
      console.error("Salary action failed:", error);
      setModal({
        open: true,
        type: "error",
        title: t("common.fail"),
        message:
          error.response?.data?.message || t("salaries.errors.actionFailed"),
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================

  const gridColumns =
    "minmax(160px,1.4fr) minmax(110px,0.8fr) minmax(110px,0.8fr) minmax(110px,0.8fr) minmax(100px,0.7fr) 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs
        items={[
          { label: t("salaries.breadcrumbs.hr"), href: "/hr/employees" },
          { label: t("salaries.breadcrumbs.salaries") },
        ]}
      />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Wallet size={20} />
            <h1>{t("salaries.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("salaries.subtitle")}</p>
        </div>

        {selectedCompanyId && (
          <div className="pageHeaderActions">
            <button
              type="button"
              className="btnPrimary"
              onClick={() =>
                showCreateForm ? closeCreateForm() : openCreateForm()
              }
            >
              <Plus size={16} />
              {t("salaries.addSalary")}
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
      </div>

      {showCreateForm && selectedCompanyId && (
        <CollapsibleForm
          title={
            raiseEmployeeId
              ? t("salaries.giveRaise")
              : t("salaries.addSalary")
          }
          icon={<Wallet size={16} />}
          fields={salaryFields}
          buttons={salaryButtons}
          onSubmit={handleSubmitCreate}
          defaultOpen
          initialValues={{ employee: raiseEmployeeId }}
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

      {selectedCompanyId && !loading && salaries.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon">
            <Wallet size={28} />
          </div>
          <h2>{t("salaries.emptyTitle")}</h2>
          <p>{t("salaries.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && salaries.length > 0 && (
        <div className="dataTable">
          <div
            className="dataTableHead"
            style={{ gridTemplateColumns: gridColumns }}
          >
            <span>{t("salaries.fields.employee")}</span>
            <span>{t("salaries.table.base")}</span>
            <span>{t("salaries.table.gross")}</span>
            <span>{t("salaries.table.net")}</span>
            <span>{t("salaries.fields.effectiveDate")}</span>
            <span />
          </div>

          {salaries.map((salary) => (
            <div
              key={salary._id}
              className="dataTableRow"
              style={{ gridTemplateColumns: gridColumns }}
            >
              <span>{employeeName(salary.employee)}</span>
              <span>{formatAmount(salary.baseSalary, salary.currency)}</span>
              <span className="dataTableCellMuted">
                {formatAmount(
                  salary.grossSalary ??
                    salary.baseSalary + sumItems(salary.allowances),
                  salary.currency
                )}
              </span>
              <span className="dataTableCellMuted">
                {formatAmount(
                  salary.netSalary ??
                    salary.baseSalary +
                      sumItems(salary.allowances) -
                      sumItems(salary.deductions),
                  salary.currency
                )}
              </span>
              <span className="dataTableCellMuted">
                {formatDate(salary.effectiveDate)}
              </span>

              <div className="dataTableActions">
                <button
                  type="button"
                  className="tableActionBtn"
                  title={t("salaries.giveRaise")}
                  onClick={() => openCreateForm(salary.employee?._id)}
                >
                  <TrendingUp size={15} />
                </button>

                <button
                  type="button"
                  className="tableActionBtn"
                  title={t("salaries.actions.history")}
                  onClick={() => openHistory(salary.employee)}
                >
                  <History size={15} />
                </button>

                <button
                  type="button"
                  className="tableActionBtn tableActionBtnDanger"
                  title={t("common.delete")}
                  onClick={() => askDelete(salary)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================
          HISTORY PANEL
      ================================== */}

      {historyEmployee && (
        <div className={styles.historyPanel}>
          <div className={styles.historyHeader}>
            <h2>
              {tVar("salaries.history.titleFor", {
                name: employeeName(historyEmployee),
              })}
            </h2>

            <button
              type="button"
              className="tableActionBtn"
              onClick={closeHistory}
              title={t("common.close")}
            >
              <X size={16} />
            </button>
          </div>

          {historyLoading && (
            <p className={styles.historyLoading}>{t("common.loading")}</p>
          )}

          {!historyLoading && history.length === 0 && (
            <p className={styles.historyLoading}>
              {t("salaries.history.empty")}
            </p>
          )}

          {!historyLoading && history.length > 0 && (
            <div className="dataTable">
              <div
                className="dataTableHead"
                style={{
                  gridTemplateColumns:
                    "minmax(110px,1fr) minmax(110px,1fr) minmax(110px,1fr) minmax(90px,0.6fr)",
                }}
              >
                <span>{t("salaries.table.base")}</span>
                <span>{t("salaries.fields.effectiveDate")}</span>
                <span>{t("salaries.table.endDate")}</span>
                <span>{t("salaries.table.status")}</span>
              </div>

              {history.map((record) => (
                <div
                  key={record._id}
                  className="dataTableRow"
                  style={{
                    gridTemplateColumns:
                      "minmax(110px,1fr) minmax(110px,1fr) minmax(110px,1fr) minmax(90px,0.6fr)",
                  }}
                >
                  <span>{formatAmount(record.baseSalary, record.currency)}</span>
                  <span className="dataTableCellMuted">
                    {formatDate(record.effectiveDate)}
                  </span>
                  <span className="dataTableCellMuted">
                    {record.endDate
                      ? formatDate(record.endDate)
                      : t("salaries.table.ongoing")}
                  </span>
                  <span className="statusPill statusPillNeutral">
                    {record.endDate
                      ? t("salaries.history.past")
                      : t("salaries.history.current")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
