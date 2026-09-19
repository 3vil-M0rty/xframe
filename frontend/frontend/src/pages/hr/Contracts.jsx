import { useEffect, useState } from "react";
import {
  FileSignature,
  Plus,
  RefreshCw,
  Trash2,
  BriefcaseBusiness,
  AlertTriangle,
  Languages,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import ActionModal from "../../components/useful/ActionModal";
import StatusPill from "../../components/useful/StatusPill";
import TranslationEditorModal from "../../components/useful/TranslationEditorModal";
import SearchBar from "../../components/useful/SearchBar";

import {
  getContracts,
  createContract,
  renewContract,
  deleteContract,
  getExpiringContracts,
} from "../../services/contractService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./Contracts.module.css";

const PAGE_SIZE = 15;

function employeeName(employee) {
  if (!employee) return "—";
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

export default function Contracts() {
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

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });

  useEffect(() => { setPage(1); }, [selectedCompanyId, statusFilter, debouncedSearch]);

  const [contracts, setContracts] = useState([]);

  // ---------- Translations editor (jobTitle, department, notes) ----------
  const [translatingContract, setTranslatingContract] = useState(null);
  const handleTranslationSaved = (field, bucket) => {
    setContracts((prev) =>
      prev.map((c) =>
        c._id === translatingContract?._id
          ? { ...c, translations: { ...c.translations, [field]: bucket } }
          : c
      )
    );
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async (targetPage = page) => {
    if (!selectedCompanyId) return;
    const { contracts: data, pagination: p } = await getContracts({
      companyId: selectedCompanyId, status: statusFilter || undefined, search: debouncedSearch || undefined, page: targetPage, limit: PAGE_SIZE,
    });
    setContracts(data);
    setPagination(p);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setContracts([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { contracts: data, pagination: p } = await getContracts({
          companyId: selectedCompanyId, status: statusFilter || undefined, search: debouncedSearch || undefined, page, limit: PAGE_SIZE,
        });
        if (cancelled) return;
        setContracts(data);
        setPagination(p);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("contracts.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, statusFilter, debouncedSearch, page, t]);

  // Expiring soon banner
  const [expiring, setExpiring] = useState([]);
  useEffect(() => {
    if (!selectedCompanyId) { setExpiring([]); return; }
    getExpiringContracts({ companyId: selectedCompanyId, withinDays: 30 })
      .then(setExpiring)
      .catch(() => setExpiring([]));
  }, [selectedCompanyId, contracts]);

  const [showCreateForm, setShowCreateForm] = useState(false);

  const typeOptions = [
    { value: "permanent", label: t("employees.employmentTypes.permanent") },
    { value: "fixed_term", label: t("employees.employmentTypes.fixed_term") },
    { value: "temporary", label: t("employees.employmentTypes.temporary") },
    { value: "intern", label: t("employees.employmentTypes.intern") },
    { value: "apprentice", label: t("employees.employmentTypes.apprentice") },
    { value: "freelance", label: t("employees.employmentTypes.freelance") },
    { value: "part_time", label: t("employees.employmentTypes.part_time") },
    { value: "other", label: t("employees.employmentTypes.other") },
  ];

  const contractFields = [
    { name: "employee", label: t("contracts.fields.employee"), type: "search-select", options: employeeOptions, placeholder: t("salaries.fields.employeeSearchPlaceholder"), noResultsLabel: t("common.noResults"), required: true, fullWidth: true },
    { name: "type", label: t("contracts.fields.type"), type: "select", options: typeOptions, required: true },
    { name: "startDate", label: t("contracts.fields.startDate"), type: "date", required: true },
    { name: "endDate", label: t("contracts.fields.endDate"), type: "date" },
    { name: "jobTitle", label: t("employees.fields.jobTitle"), type: "text" },
    { name: "notes", label: t("salaries.fields.notes"), type: "textarea", fullWidth: true },
  ];

  const contractButtons = [
    { label: t("common.cancel"), type: "button", variant: "secondary", onClick: () => setShowCreateForm(false) },
    { label: t("contracts.buttons.create"), type: "submit", variant: "primary" },
  ];

  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [modalAction, setModalAction] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const closeModal = () => {
    if (actionLoading) return;
    setModal((p) => ({ ...p, open: false }));
    setModalAction(null);
    setPendingData(null);
  };

  const handleSubmitCreate = (formData) => {
    setPendingData(formData);
    setModalAction("create");
    setModal({ open: true, type: "confirm", title: t("contracts.createTitle"), message: t("contracts.createSureMessage") });
  };

  const askRenew = (contract) => {
    setPendingData({ id: contract._id });
    setModalAction("renew");
    setModal({ open: true, type: "confirm", title: t("contracts.renewTitle"), message: t("contracts.renewSureMessage") });
  };

  const askDelete = (contract) => {
    setPendingData({ id: contract._id });
    setModalAction("delete");
    setModal({ open: true, type: "confirm", title: t("contracts.deleteTitle"), message: t("contracts.deleteSureMessage") });
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      if (modalAction === "create") {
        await createContract({ ...pendingData, company: selectedCompanyId });
        setShowCreateForm(false);
        setPage(1);
        await reload(1);
        setModal({ open: true, type: "success", title: t("contracts.createSuccessTitle"), message: t("contracts.createSuccessMessage") });
      } else if (modalAction === "renew") {
        const target = contracts.find((c) => c._id === pendingData.id);
        const newStart = new Date();
        newStart.setDate(newStart.getDate() + 1);
        await renewContract(pendingData.id, {
          startDate: newStart.toISOString().slice(0, 10),
          type: target?.type,
        });
        await reload();
        setModal((p) => ({ ...p, open: false }));
        setModalAction(null);
        setPendingData(null);
      } else if (modalAction === "delete") {
        await deleteContract(pendingData.id);
        setContracts((prev) => prev.filter((c) => c._id !== pendingData.id));
        setModal((p) => ({ ...p, open: false }));
        setModalAction(null);
        setPendingData(null);
      }
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("contracts.errors.actionFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  const gridColumns = "minmax(150px,1.3fr) minmax(100px,0.8fr) minmax(110px,0.9fr) minmax(110px,0.9fr) minmax(90px,0.7fr) 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("contracts.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("contracts.breadcrumbs.contracts") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <FileSignature size={20} />
            <h1>{t("contracts.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("contracts.subtitle")}</p>
        </div>
        {selectedCompanyId && (
          <div className="pageHeaderActions">
            <button type="button" className="btnPrimary" onClick={() => setShowCreateForm((p) => !p)}>
              <Plus size={16} />
              {t("contracts.addContract")}
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
        <div className={styles.filterGroup}>
          <label>{t("absences.fields.status")}</label>
          <CustomSelect value={statusFilter} onSelect={setStatusFilter} options={[
            { value: "", label: t("absences.filters.allStatuses") },
            { value: "active", label: t("contracts.status.active") },
            { value: "expired", label: t("contracts.status.expired") },
            { value: "terminated", label: t("contracts.status.terminated") },
            { value: "renewed", label: t("contracts.status.renewed") },
          ]} />
        </div>
        <div className={styles.filterGroup}>
          <SearchBar
            placeholder={t("employees.toolbar.searchPlaceholder")}
            onSearch={setSearch}
            onClear={() => setSearch("")}
            isLoading={loading}
          />
        </div>
      </div>

      {expiring.length > 0 && (
        <div className={styles.expiringBanner}>
          <AlertTriangle size={16} />
          <span>{t("contracts.expiringBanner").replace("{count}", expiring.length)}</span>
        </div>
      )}

      {showCreateForm && selectedCompanyId && (
        <CollapsibleForm title={t("contracts.addContract")} icon={<FileSignature size={16} />} fields={contractFields} buttons={contractButtons} onSubmit={handleSubmitCreate} defaultOpen />
      )}

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {selectedCompanyId && !loading && contracts.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><FileSignature size={28} /></div>
          <h2>{t("contracts.emptyTitle")}</h2>
          <p>{t("contracts.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && contracts.length > 0 && (
        <>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
              <span>{t("contracts.fields.employee")}</span>
              <span>{t("contracts.fields.type")}</span>
              <span>{t("contracts.fields.startDate")}</span>
              <span>{t("contracts.fields.endDate")}</span>
              <span>{t("absences.fields.status")}</span>
              <span />
            </div>
            {contracts.map((c) => (
              <div key={c._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                <span>{employeeName(c.employee)}</span>
                <span className="dataTableCellMuted">{t(`employees.employmentTypes.${c.type}`)}</span>
                <span className="dataTableCellMuted">{formatDate(c.startDate)}</span>
                <span className="dataTableCellMuted">{c.endDate ? formatDate(c.endDate) : t("salaries.table.ongoing")}</span>
                <StatusPill status={c.status === "active" ? "accepted" : c.status === "terminated" ? "rejected" : "pending"} label={t(`contracts.status.${c.status}`)} />
                <div className="dataTableActions">
                  {c.status === "active" && (
                    <button type="button" className="tableActionBtn" title={t("contracts.actions.renew")} onClick={() => askRenew(c)}>
                      <RefreshCw size={15} />
                    </button>
                  )}
                  <button type="button" className="tableActionBtn" title={t("contentTranslation.editButton")} onClick={() => setTranslatingContract(c)}>
                    <Languages size={15} />
                  </button>
                  <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => askDelete(c)}>
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
        onConfirm={modal.type === "confirm" ? handleConfirm : undefined} onClose={closeModal} />

      <TranslationEditorModal
        isOpen={!!translatingContract}
        onClose={() => setTranslatingContract(null)}
        resourceType="contract"
        resourceId={translatingContract?._id}
        fields={[
          { key: "jobTitle", label: t("employees.fields.jobTitle") },
          { key: "department", label: t("employees.fields.department") },
          { key: "notes", label: t("salaries.fields.notes") },
        ]}
        onSaved={handleTranslationSaved}
      />
    </div>
  );
}
