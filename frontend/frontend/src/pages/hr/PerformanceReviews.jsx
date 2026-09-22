import { useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2, Edit, Send } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import ActionModal from "../../components/useful/ActionModal";
import StatusPill from "../../components/useful/StatusPill";

import {
  getPerformanceReviews,
  createPerformanceReview,
  updatePerformanceReview,
  submitPerformanceReview,
  deletePerformanceReview,
} from "../../services/performanceReviewService";
import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";
import { buildEmployeeSearchOptions } from "../../utils/employeeSearch";

import styles from "./PerformanceReviews.module.css";

const RATING_CRITERIA = ["jobKnowledge", "qualityOfWork", "communication", "teamwork", "initiative", "punctuality"];

// Goals are edited as one line of free text per goal (rather than a
// dynamic add/remove list UI, which CollapsibleForm's plain field
// config doesn't support) — parsed back into the
// [{ description, status }] shape the backend expects on submit,
// each defaulting to "not_started". A goal's status can still be
// changed individually later; this only covers writing the list.
function goalsToText(goals) {
  return (goals || []).map((g) => g.description).join("\n");
}
function textToGoals(text, existingGoals = []) {
  const lines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((description) => {
    const existing = existingGoals.find((g) => g.description === description);
    return { description, status: existing?.status || "not_started" };
  });
}

export default function PerformanceReviews() {
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
      } catch (err) {
        console.error("Failed to load companies:", err);
      } finally {
        setCompaniesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = companies.map((c) => ({ value: c._id, label: c.name || t("employees.company.unnamed") }));

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

  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async () => {
    if (!selectedCompanyId) return;
    const { reviews: data, pagination: p } = await getPerformanceReviews({ companyId: selectedCompanyId, page, limit: 20 });
    setReviews(data || []);
    if (p) setPagination(p);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setReviews([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { reviews: data, pagination: p } = await getPerformanceReviews({ companyId: selectedCompanyId, page, limit: 20 });
        if (cancelled) return;
        setReviews(data || []);
        if (p) setPagination(p);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("performanceReviews.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, page, t]);

  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreateForm = () => { setEditingReview(null); setShowForm(true); };
  const openEditForm = (review) => { setEditingReview(review); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingReview(null); };

  const fields = [
    { name: "employee", label: t("performanceReviews.fields.employee"), type: "search-select", options: employeeOptions, placeholder: t("salaries.fields.employeeSearchPlaceholder"), noResultsLabel: t("common.noResults"), required: true, fullWidth: true },
    { name: "reviewer", label: t("performanceReviews.fields.reviewer"), type: "search-select", options: employeeOptions, placeholder: t("salaries.fields.employeeSearchPlaceholder"), noResultsLabel: t("common.noResults"), required: true, fullWidth: true },
    { name: "periodLabel", label: t("performanceReviews.fields.periodLabel"), type: "text", placeholder: t("performanceReviews.fields.periodLabelPlaceholder"), required: true },
    { name: "reviewDate", label: t("performanceReviews.fields.reviewDate"), type: "date", required: true },
    ...RATING_CRITERIA.map((key) => ({
      name: `rating_${key}`,
      label: t(`performanceReviews.criteria.${key}`),
      type: "select",
      options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
    })),
    { name: "goalsText", label: t("performanceReviews.fields.goals"), type: "textarea", placeholder: t("performanceReviews.fields.goalsPlaceholder"), fullWidth: true },
    { name: "strengths", label: t("performanceReviews.fields.strengths"), type: "textarea", fullWidth: true },
    { name: "areasForImprovement", label: t("performanceReviews.fields.areasForImprovement"), type: "textarea", fullWidth: true },
    { name: "comments", label: t("performanceReviews.fields.comments"), type: "textarea", fullWidth: true },
  ];

  const initialValues = editingReview
    ? {
        employee: editingReview.employee?._id || editingReview.employee || "",
        reviewer: editingReview.reviewer?._id || editingReview.reviewer || "",
        periodLabel: editingReview.periodLabel || "",
        reviewDate: editingReview.reviewDate ? editingReview.reviewDate.substring(0, 10) : "",
        ...Object.fromEntries(RATING_CRITERIA.map((key) => [`rating_${key}`, editingReview.ratings?.[key] ? String(editingReview.ratings[key]) : ""])),
        goalsText: goalsToText(editingReview.goals),
        strengths: editingReview.strengths || "",
        areasForImprovement: editingReview.areasForImprovement || "",
        comments: editingReview.comments || "",
      }
    : {
        employee: "", reviewer: "", periodLabel: "", reviewDate: new Date().toISOString().substring(0, 10),
        ...Object.fromEntries(RATING_CRITERIA.map((key) => [`rating_${key}`, ""])),
        goalsText: "", strengths: "", areasForImprovement: "", comments: "",
      };

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      const ratings = Object.fromEntries(
        RATING_CRITERIA.map((key) => [key, formData[`rating_${key}`] ? Number(formData[`rating_${key}`]) : undefined])
      );
      const payload = {
        company: selectedCompanyId,
        employee: formData.employee,
        reviewer: formData.reviewer,
        periodLabel: formData.periodLabel,
        reviewDate: formData.reviewDate,
        ratings,
        goals: textToGoals(formData.goalsText, editingReview?.goals),
        strengths: formData.strengths,
        areasForImprovement: formData.areasForImprovement,
        comments: formData.comments,
      };
      if (editingReview) await updatePerformanceReview(editingReview._id, payload);
      else await createPerformanceReview(payload);
      closeForm();
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || t("performanceReviews.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async (review) => {
    try {
      await submitPerformanceReview(review._id);
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || t("performanceReviews.errors.submitFailed"));
    }
  };

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deletePerformanceReview(deleteTarget._id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || t("performanceReviews.errors.deleteFailed"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const employeeName = (emp) => `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() || "—";
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
  const statusVariant = (status) => (status === "acknowledged" ? "accepted" : status === "submitted" ? "pending" : "neutral");

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("performanceReviews.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("performanceReviews.breadcrumbs.performanceReviews") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <ClipboardList size={20} />
            <h1>{t("performanceReviews.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("performanceReviews.subtitle")}</p>
        </div>
        {selectedCompanyId && !showForm && (
          <button type="button" className="btnPrimary" onClick={openCreateForm}>
            <Plus size={16} />
            {t("performanceReviews.addReview")}
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
            title={editingReview ? t("performanceReviews.editReview") : t("performanceReviews.addReview")}
            icon={<ClipboardList size={16} />}
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

          {!loading && reviews.length === 0 && (
            <div className="emptyState">
              <p>{t("performanceReviews.emptyTitle")}</p>
              <p className="emptyStateSubtitle">{t("performanceReviews.emptyMessage")}</p>
            </div>
          )}

          {!loading && reviews.length > 0 && (
            <div className={styles.list}>
              {reviews.map((review) => (
                <div key={review._id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.employeeName}>{employeeName(review.employee)}</span>
                      <span className={styles.periodLabel}>{review.periodLabel} — {formatDate(review.reviewDate)}</span>
                    </div>
                    <div className={styles.cardHeaderRight}>
                      {review.averageRating !== null && review.averageRating !== undefined && (
                        <span className={styles.avgRating}>★ {review.averageRating}</span>
                      )}
                      <StatusPill status={statusVariant(review.status)} label={t(`performanceReviews.statuses.${review.status}`)} />
                    </div>
                  </div>
                  <p className={styles.reviewer}>{t("performanceReviews.reviewedBy")} {employeeName(review.reviewer)}</p>
                  <div className={styles.cardFooter}>
                    <span />
                    <div className="dataTableActions">
                      {review.status === "draft" && (
                        <button type="button" className="tableActionBtn" title={t("performanceReviews.submitButton")} onClick={() => handleSubmitReview(review)}>
                          <Send size={14} />
                        </button>
                      )}
                      <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => openEditForm(review)}>
                        <Edit size={14} />
                      </button>
                      <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => setDeleteTarget(review)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && reviews.length > 0 && (
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
          )}
        </>
      )}

      <ActionModal
        isOpen={!!deleteTarget}
        type="confirm"
        title={t("performanceReviews.deleteTitle")}
        message={t("performanceReviews.deleteSureMessage")}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
