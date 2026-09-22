import { useState } from "react";
import { Upload, Download, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import FileInput from "./FileInput";
import { previewEmployeeBulkImport, commitEmployeeBulkImport } from "../../services/employeeService";

import styles from "./BulkImportModal.module.css";

const TEMPLATE_CSV =
  "firstName,lastName,employeeNumber,cin,email,phone,hireDate,jobTitle,department,employmentType,baseSalary\n" +
  "Yassine,El Amrani,,BE123456,yassine@example.com,+212600000000,2024-01-15,Chef de chantier,Production,permanent,8000\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "employee-import-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Two-step bulk employee import: pick a CSV, preview every row
 * (each shown with its own errors/warnings, nothing written to the
 * database yet), then commit once the file is actually clean.
 * `onImported` is called with the created count after a successful
 * commit, so the caller can refresh its employee list/pagination.
 */
export default function BulkImportModal({ isOpen, onClose, companyId, onImported }) {
  const { t } = useI18n();

  const [file, setFile] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState(null); // { rows, validCount, errorCount, warningCount }

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");
  const [commitResult, setCommitResult] = useState(null); // { createdCount }

  if (!isOpen) return null;

  const reset = () => {
    setFile(null);
    setPreviewing(false);
    setPreviewError("");
    setPreview(null);
    setCommitting(false);
    setCommitError("");
    setCommitResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setPreviewError("");
    setPreview(null);
    try {
      const result = await previewEmployeeBulkImport(companyId, file);
      setPreview(result);
    } catch (err) {
      setPreviewError(err.response?.data?.message || t("employees.bulkImport.previewFailed"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    setCommitError("");
    try {
      const importableRows = preview.rows.filter((r) => r.errors.length === 0);
      const result = await commitEmployeeBulkImport(companyId, importableRows);
      setCommitResult(result);
      onImported?.(result.createdCount);
    } catch (err) {
      setCommitError(err.response?.data?.message || t("employees.bulkImport.commitFailed"));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Upload size={18} />
            <h3>{t("employees.bulkImport.title")}</h3>
          </div>
          <button type="button" className={styles.closeIcon} onClick={handleClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {commitResult ? (
            <div className={styles.resultBlock}>
              <CheckCircle2 size={32} className={styles.successIcon} />
              <p>
                {t("employees.bulkImport.commitSuccess").replace("{count}", String(commitResult.createdCount))}
              </p>
              <button type="button" className="btnPrimary" onClick={handleClose}>
                {t("common.close")}
              </button>
            </div>
          ) : (
            <>
              <p className={styles.helpText}>{t("employees.bulkImport.helpText")}</p>

              <button type="button" className={styles.templateLink} onClick={downloadTemplate}>
                <Download size={13} />
                {t("employees.bulkImport.downloadTemplate")}
              </button>

              <div className={styles.fileRow}>
                <FileInput
                  value={file}
                  onChange={(f) => { setFile(f); setPreview(null); setPreviewError(""); }}
                  accept=".csv"
                  chooseLabel={t("common.chooseFile")}
                  emptyLabel={t("common.noFileChosen")}
                />
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={handlePreview}
                  disabled={!file || previewing}
                >
                  {previewing ? <Loader2 size={14} className={styles.spinner} /> : null}
                  {previewing ? t("employees.bulkImport.previewing") : t("employees.bulkImport.preview")}
                </button>
              </div>

              {previewError && (
                <div className={styles.errorBanner}>
                  <AlertTriangle size={15} />
                  <span>{previewError}</span>
                </div>
              )}

              {preview && (
                <>
                  <div className={styles.summary}>
                    <span className={styles.summaryValid}>
                      {t("employees.bulkImport.summaryValid").replace("{count}", String(preview.validCount))}
                    </span>
                    {preview.errorCount > 0 && (
                      <span className={styles.summaryError}>
                        {t("employees.bulkImport.summaryErrors").replace("{count}", String(preview.errorCount))}
                      </span>
                    )}
                    {preview.warningCount > 0 && (
                      <span className={styles.summaryWarning}>
                        {t("employees.bulkImport.summaryWarnings").replace("{count}", String(preview.warningCount))}
                      </span>
                    )}
                  </div>

                  <div className={styles.previewTable}>
                    <div className={styles.previewHead}>
                      <span>#</span>
                      <span>{t("employees.fields.firstName")}</span>
                      <span>{t("employees.fields.lastName")}</span>
                      <span>{t("employees.fields.employeeNumber")}</span>
                      <span>{t("common.status")}</span>
                    </div>
                    {preview.rows.map((row) => (
                      <div
                        key={row.rowNumber}
                        className={`${styles.previewRow} ${row.errors.length > 0 ? styles.previewRowError : ""}`}
                      >
                        <span>{row.rowNumber}</span>
                        <span>{row.firstName || "—"}</span>
                        <span>{row.lastName || "—"}</span>
                        <span>{row.employeeNumber}</span>
                        <span className={styles.previewNotes}>
                          {row.errors.map((e, i) => (
                            <span key={`e${i}`} className={styles.noteError}>{e}</span>
                          ))}
                          {row.warnings.map((w, i) => (
                            <span key={`w${i}`} className={styles.noteWarning}>{w}</span>
                          ))}
                          {row.errors.length === 0 && row.warnings.length === 0 && (
                            <span className={styles.noteOk}>{t("employees.bulkImport.rowOk")}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {preview.errorCount > 0 && (
                    <div className={styles.errorBanner}>
                      <AlertTriangle size={15} />
                      <span>{t("employees.bulkImport.fixErrorsFirst")}</span>
                    </div>
                  )}

                  {commitError && (
                    <div className={styles.errorBanner}>
                      <AlertTriangle size={15} />
                      <span>{commitError}</span>
                    </div>
                  )}

                  <div className={styles.footer}>
                    <button type="button" className="btnCancel" onClick={handleClose}>
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      className="btnPrimary"
                      onClick={handleCommit}
                      disabled={preview.errorCount > 0 || committing || preview.validCount === 0}
                    >
                      {committing ? <Loader2 size={14} className={styles.spinner} /> : null}
                      {committing
                        ? t("employees.bulkImport.committing")
                        : t("employees.bulkImport.importButton").replace("{count}", String(preview.validCount))}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
