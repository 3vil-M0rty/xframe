import { useEffect, useState } from "react";
import {
  Building2, Plus, Edit, Trash2, ChevronDown, ChevronRight,
  BriefcaseBusiness, ShieldCheck, Languages,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import ActionModal from "../../components/useful/ActionModal";
import TranslatedText from "../../components/useful/TranslatedText";
import TranslationEditorModal from "../../components/useful/TranslationEditorModal";

import {
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
} from "../../services/departmentService";
import {
  getJobPositions, createJobPosition, updateJobPosition, deleteJobPosition,
} from "../../services/jobPositionService";
import { getCompanies } from "../../services/companyService";

import styles from "./Departments.module.css";

function formatAmount(amount, currency = "MAD") {
  if (amount === undefined || amount === null) return "—";
  return `${Number(amount).toLocaleString("en-US")} ${currency}`;
}

export default function Departments() {
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

  // ---------- Departments ----------
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const reloadDepartments = async () => {
    if (!selectedCompanyId) return;
    const data = await getDepartments(selectedCompanyId);
    setDepartments(data);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setDepartments([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getDepartments(selectedCompanyId);
        if (!cancelled) setDepartments(data);
      } catch (error) {
        console.error("Failed to load departments:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  // ---------- All positions (needed for the reportsTo picker across departments) ----------
  const [allPositions, setAllPositions] = useState([]);
  const reloadAllPositions = async () => {
    if (!selectedCompanyId) return;
    const data = await getJobPositions(selectedCompanyId);
    setAllPositions(data);
  };
  useEffect(() => { reloadAllPositions(); }, [selectedCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = (deptId) => setExpanded((prev) => ({ ...prev, [deptId]: !prev[deptId] }));

  // ---------- Department form ----------
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptName, setDeptName] = useState("");
  const [deptDescription, setDeptDescription] = useState("");
  const [deptPermissionKey, setDeptPermissionKey] = useState("");
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptError, setDeptError] = useState("");

  const openCreateDept = () => {
    setEditingDept(null);
    setDeptName(""); setDeptDescription(""); setDeptPermissionKey("");
    setDeptError("");
    setShowDeptForm(true);
  };

  const openEditDept = (dept) => {
    setEditingDept(dept);
    setDeptName(dept.name); setDeptDescription(dept.description || ""); setDeptPermissionKey(dept.permissionKey || "");
    setDeptError("");
    setShowDeptForm(true);
  };

  const handleDeptSubmit = async (event) => {
    event.preventDefault();
    if (!deptName.trim()) {
      setDeptError(t("departments.errors.nameRequired"));
      return;
    }
    setDeptSaving(true);
    setDeptError("");
    try {
      if (editingDept) {
        await updateDepartment(editingDept._id, { name: deptName, description: deptDescription, permissionKey: deptPermissionKey || null });
      } else {
        await createDepartment({ company: selectedCompanyId, name: deptName, description: deptDescription, permissionKey: deptPermissionKey || null });
      }
      setShowDeptForm(false);
      await reloadDepartments();
    } catch (error) {
      setDeptError(error.response?.data?.message || t("departments.errors.saveFailed"));
    } finally {
      setDeptSaving(false);
    }
  };

  // ---------- Delete modal (shared for departments + positions) ----------
  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [pendingDelete, setPendingDelete] = useState(null); // { kind: "department" | "position", id }
  const [actionLoading, setActionLoading] = useState(false);

  const askDeleteDept = (dept) => {
    setPendingDelete({ kind: "department", id: dept._id });
    setModal({ open: true, type: "confirm", title: t("departments.deleteTitle"), message: t("departments.deleteSureMessage") });
  };

  const askDeletePosition = (position) => {
    setPendingDelete({ kind: "position", id: position._id });
    setModal({ open: true, type: "confirm", title: t("departments.deletePositionTitle"), message: t("departments.deletePositionSureMessage") });
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModal((prev) => ({ ...prev, open: false }));
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      if (pendingDelete.kind === "department") {
        await deleteDepartment(pendingDelete.id);
        await reloadDepartments();
      } else {
        await deleteJobPosition(pendingDelete.id);
        await reloadAllPositions();
      }
      setModal((prev) => ({ ...prev, open: false }));
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("departments.errors.deleteFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  // ---------- Position form ----------
  const [positionFormDept, setPositionFormDept] = useState(null); // department currently adding/editing a position for
  const [editingPosition, setEditingPosition] = useState(null);
  const [posTitle, setPosTitle] = useState("");
  const [posDescription, setPosDescription] = useState("");
  const [posSalaryMin, setPosSalaryMin] = useState("");
  const [posSalaryMax, setPosSalaryMax] = useState("");
  const [posSkills, setPosSkills] = useState("");
  const [posReportsTo, setPosReportsTo] = useState("");
  const [posSaving, setPosSaving] = useState(false);
  const [posError, setPosError] = useState("");

  const openCreatePosition = (dept) => {
    setPositionFormDept(dept);
    setEditingPosition(null);
    setPosTitle(""); setPosDescription(""); setPosSalaryMin(""); setPosSalaryMax(""); setPosSkills(""); setPosReportsTo("");
    setPosError("");
  };

  const openEditPosition = (dept, position) => {
    setPositionFormDept(dept);
    setEditingPosition(position);
    setPosTitle(position.title);
    setPosDescription(position.description || "");
    setPosSalaryMin(position.salaryBandMin ?? "");
    setPosSalaryMax(position.salaryBandMax ?? "");
    setPosSkills((position.requiredSkills || []).join(", "));
    setPosReportsTo(position.reportsTo?._id || "");
    setPosError("");
  };

  const closePositionForm = () => setPositionFormDept(null);

  // ---------- Translations editors (department, position) ----------
  const [translatingDept, setTranslatingDept] = useState(null);
  const [translatingPosition, setTranslatingPosition] = useState(null);

  const handleDeptTranslationSaved = (field, bucket) => {
    setDepartments((prev) =>
      prev.map((d) =>
        d._id === translatingDept?._id
          ? { ...d, translations: { ...d.translations, [field]: bucket } }
          : d
      )
    );
  };

  const handlePositionTranslationSaved = (field, bucket) => {
    setAllPositions((prev) =>
      prev.map((p) =>
        p._id === translatingPosition?._id
          ? { ...p, translations: { ...p.translations, [field]: bucket } }
          : p
      )
    );
  };

  const handlePositionSubmit = async (event) => {
    event.preventDefault();
    if (!posTitle.trim()) {
      setPosError(t("departments.errors.titleRequired"));
      return;
    }
    setPosSaving(true);
    setPosError("");
    try {
      const skills = posSkills.split(",").map((s) => s.trim()).filter(Boolean);
      if (editingPosition) {
        await updateJobPosition(editingPosition._id, {
          title: posTitle, description: posDescription,
          salaryBandMin: posSalaryMin, salaryBandMax: posSalaryMax,
          requiredSkills: skills, reportsTo: posReportsTo || null,
        });
      } else {
        await createJobPosition({
          company: selectedCompanyId, department: positionFormDept._id,
          title: posTitle, description: posDescription,
          salaryBandMin: posSalaryMin, salaryBandMax: posSalaryMax,
          requiredSkills: skills, reportsTo: posReportsTo || null,
        });
      }
      closePositionForm();
      await reloadAllPositions();
    } catch (error) {
      setPosError(error.response?.data?.message || t("departments.errors.saveFailed"));
    } finally {
      setPosSaving(false);
    }
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("departments.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Building2 size={20} />
            <h1>{t("departments.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("departments.subtitle")}</p>
        </div>
        {selectedCompanyId && (
          <div className="pageHeaderActions">
            <button type="button" className="btnPrimary" onClick={openCreateDept}>
              <Plus size={16} />
              {t("departments.addDepartment")}
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

      {showDeptForm && selectedCompanyId && (
        <form className={styles.formCard} onSubmit={handleDeptSubmit}>
          <h3>{editingDept ? t("departments.editDepartment") : t("departments.addDepartment")}</h3>
          {deptError && <div className={styles.errorMessage}>{deptError}</div>}
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>{t("departments.fields.name")}</label>
              <input type="text" className={styles.textInput} value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <label>{t("departments.fields.permissionKey")}</label>
              <CustomSelect value={deptPermissionKey} onSelect={setDeptPermissionKey} options={[
                { value: "", label: t("departments.fields.noSpecialAccess") },
                { value: "hr", label: t("departments.fields.hrAccess") },
                { value: "production", label: t("departments.fields.productionAccess") },
              ]} />
            </div>
            <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
              <label>{t("departments.fields.description")}</label>
              <input type="text" className={styles.textInput} value={deptDescription} onChange={(e) => setDeptDescription(e.target.value)} />
            </div>
          </div>
          <p className={styles.formHint}>{t("departments.fields.permissionKeyHint")}</p>
          <div className={styles.formActions}>
            <button type="button" className="btnCancel" onClick={() => setShowDeptForm(false)}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary" disabled={deptSaving}>{deptSaving ? t("payroll.buttons.saving") : t("common.update")}</button>
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

      {selectedCompanyId && !loading && departments.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Building2 size={28} /></div>
          <h2>{t("departments.emptyTitle")}</h2>
          <p>{t("departments.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && departments.length > 0 && (
        <div className={styles.deptList}>
          {departments.map((dept) => {
            const positions = allPositions.filter((p) => p.department?._id === dept._id);
            const isExpanded = !!expanded[dept._id];
            return (
              <div key={dept._id} className={styles.deptCard}>
                <button type="button" className={styles.deptHeader} onClick={() => toggleExpanded(dept._id)}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className={styles.deptName}><TranslatedText doc={dept} field="name" /></span>
                  {dept.permissionKey && (
                    <span className={styles.permissionBadge} title={t("departments.fields.permissionKeyHint")}>
                      <ShieldCheck size={12} />
                      {dept.permissionKey === "hr" ? t("departments.fields.hrAccess") : t("departments.fields.productionAccess")}
                    </span>
                  )}
                  <span className={styles.positionCount}>{positions.length}</span>
                </button>

                {isExpanded && (
                  <div className={styles.deptBody}>
                    {dept.description && (
                      <p className={styles.deptDescription}><TranslatedText doc={dept} field="description" /></p>
                    )}

                    <div className={styles.deptActions}>
                      <button type="button" className="tableActionBtn" title={t("contentTranslation.editButton")} onClick={() => setTranslatingDept(dept)}>
                        <Languages size={14} />
                      </button>
                      <button type="button" className="btnEdit" onClick={() => openEditDept(dept)}>
                        <Edit size={14} /> {t("common.edit")}
                      </button>
                      <button type="button" className="btnDelete" onClick={() => askDeleteDept(dept)}>
                        <Trash2 size={14} /> {t("common.delete")}
                      </button>
                      <button type="button" className="btnPrimary" onClick={() => openCreatePosition(dept)}>
                        <Plus size={14} /> {t("departments.addPosition")}
                      </button>
                    </div>

                    {positionFormDept?._id === dept._id && (
                      <form className={styles.positionForm} onSubmit={handlePositionSubmit}>
                        <h4>{editingPosition ? t("departments.editPosition") : t("departments.addPosition")}</h4>
                        {posError && <div className={styles.errorMessage}>{posError}</div>}
                        <div className={styles.formGrid}>
                          <div className={styles.formField}>
                            <label>{t("departments.fields.positionTitle")}</label>
                            <input type="text" className={styles.textInput} value={posTitle} onChange={(e) => setPosTitle(e.target.value)} />
                          </div>
                          <div className={styles.formField}>
                            <label>{t("departments.fields.reportsTo")}</label>
                            <CustomSelect value={posReportsTo} onSelect={setPosReportsTo} options={[
                              { value: "", label: t("departments.fields.noReportsTo") },
                              ...allPositions.filter((p) => p._id !== editingPosition?._id).map((p) => ({ value: p._id, label: `${p.title} (${p.department?.name})` })),
                            ]} />
                          </div>
                          <div className={styles.formField}>
                            <label>{t("departments.fields.salaryMin")}</label>
                            <input type="number" min={0} className={styles.textInput} value={posSalaryMin} onChange={(e) => setPosSalaryMin(e.target.value)} />
                          </div>
                          <div className={styles.formField}>
                            <label>{t("departments.fields.salaryMax")}</label>
                            <input type="number" min={0} className={styles.textInput} value={posSalaryMax} onChange={(e) => setPosSalaryMax(e.target.value)} />
                          </div>
                          <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                            <label>{t("departments.fields.requiredSkills")}</label>
                            <input type="text" className={styles.textInput} placeholder={t("departments.fields.requiredSkillsPlaceholder")} value={posSkills} onChange={(e) => setPosSkills(e.target.value)} />
                          </div>
                          <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                            <label>{t("departments.fields.description")}</label>
                            <input type="text" className={styles.textInput} value={posDescription} onChange={(e) => setPosDescription(e.target.value)} />
                          </div>
                        </div>
                        <div className={styles.formActions}>
                          <button type="button" className="btnCancel" onClick={closePositionForm}>{t("common.cancel")}</button>
                          <button type="submit" className="btnPrimary" disabled={posSaving}>{posSaving ? t("payroll.buttons.saving") : t("common.update")}</button>
                        </div>
                      </form>
                    )}

                    {positions.length === 0 ? (
                      <p className={styles.noPositions}>{t("departments.noPositions")}</p>
                    ) : (
                      <div className="dataTable">
                        <div className="dataTableHead" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1.2fr 110px" }}>
                          <span>{t("departments.fields.positionTitle")}</span>
                          <span>{t("departments.fields.salaryBand")}</span>
                          <span>{t("departments.fields.reportsTo")}</span>
                          <span>{t("departments.fields.requiredSkills")}</span>
                          <span />
                        </div>
                        {positions.map((position) => (
                          <div key={position._id} className="dataTableRow" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1.2fr 110px" }}>
                            <span><TranslatedText doc={position} field="title" /></span>
                            <span className="dataTableCellMuted">
                              {position.salaryBandMin != null || position.salaryBandMax != null
                                ? `${formatAmount(position.salaryBandMin, position.currency)} – ${formatAmount(position.salaryBandMax, position.currency)}`
                                : "—"}
                            </span>
                            <span className="dataTableCellMuted">{position.reportsTo?.title || "—"}</span>
                            <span className="dataTableCellMuted">{(position.requiredSkills || []).join(", ") || "—"}</span>
                            <div className="dataTableActions">
                              <button type="button" className="tableActionBtn" title={t("contentTranslation.editButton")} onClick={() => setTranslatingPosition(position)}>
                                <Languages size={13} />
                              </button>
                              <button type="button" className="tableActionBtn" title={t("common.edit")} onClick={() => openEditPosition(dept, position)}>
                                <Edit size={13} />
                              </button>
                              <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => askDeletePosition(position)}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActionModal isOpen={modal.open} type={modal.type} title={modal.title} message={modal.message} loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirmDelete : undefined} onClose={closeModal} />

      <TranslationEditorModal
        isOpen={!!translatingDept}
        onClose={() => setTranslatingDept(null)}
        resourceType="department"
        resourceId={translatingDept?._id}
        fields={[
          { key: "name", label: t("departments.fields.name") },
          { key: "description", label: t("departments.fields.description") },
        ]}
        onSaved={handleDeptTranslationSaved}
      />

      <TranslationEditorModal
        isOpen={!!translatingPosition}
        onClose={() => setTranslatingPosition(null)}
        resourceType="jobPosition"
        resourceId={translatingPosition?._id}
        fields={[
          { key: "title", label: t("departments.fields.positionTitle") },
          { key: "description", label: t("departments.fields.description") },
        ]}
        onSaved={handlePositionTranslationSaved}
      />
    </div>
  );
}
