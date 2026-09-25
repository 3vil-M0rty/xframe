import { useEffect, useState } from "react";
import { Workflow } from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import { updateCompanySettings } from "../services/companyService";

import styles from "./CompanyWorkflowSettings.module.css";

/**
 * Company-level workflow switches. Currently one: whether absence and
 * advance requests need the employee's line manager to approve first
 * and HR to give final approval (sequential), or whether either one
 * can decide alone (default). Saves immediately on toggle — there's
 * no separate "save" step for a single switch.
 */
export default function CompanyWorkflowSettings({ company }) {
  const { t } = useI18n();

  const [enabled, setEnabled] = useState(!!company?.settings?.requireSequentialApproval);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(String(company?.settings?.purchaseApprovalThreshold ?? 0));
  const [thresholdSaved, setThresholdSaved] = useState(false);

  // Keep in sync if the parent switches to a different company.
  useEffect(() => {
    setEnabled(!!company?.settings?.requireSequentialApproval);
    setThreshold(String(company?.settings?.purchaseApprovalThreshold ?? 0));
    setError("");
  }, [company?._id, company?.settings?.requireSequentialApproval]);

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next); // optimistic
    setSaving(true);
    setError("");
    try {
      const saved = await updateCompanySettings(company._id, { requireSequentialApproval: next });
      setEnabled(!!saved?.requireSequentialApproval);
    } catch (err) {
      setEnabled(!next); // roll back
      setError(err.response?.data?.message || t("company.workflow.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // Purchase orders at or above this amount (TTC) need an approver.
  const saveThreshold = async () => {
    const value = Math.max(Number(threshold) || 0, 0);
    if (value === Number(company?.settings?.purchaseApprovalThreshold ?? 0)) return;
    setSaving(true);
    setError("");
    try {
      const saved = await updateCompanySettings(company._id, { purchaseApprovalThreshold: value });
      setThreshold(String(saved?.purchaseApprovalThreshold ?? value));
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 2000);
    } catch (err) {
      setError(err.response?.data?.message || t("company.workflow.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!company?._id) return null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Workflow size={16} />
        <h3>{t("company.workflow.title")}</h3>
      </div>

      <label className={styles.row}>
        <div className={styles.text}>
          <span className={styles.label}>{t("company.workflow.sequentialApproval")}</span>
          <span className={styles.hint}>{t("company.workflow.sequentialApprovalHint")}</span>
        </div>
        <input
          type="checkbox"
          className="switchToggle"
          checked={enabled}
          disabled={saving}
          onChange={handleToggle}
        />
      </label>

      <div className={styles.row} style={{ marginTop: 14, cursor: "default" }}>
        <div className={styles.text}>
          <span className={styles.label}>{t("company.workflow.purchaseThreshold")}</span>
          <span className={styles.hint}>{t("company.workflow.purchaseThresholdHint")}</span>
        </div>
        <div className={styles.thresholdField}>
          <input type="number" min="0" step="100" value={threshold} disabled={saving}
            onChange={(e) => setThreshold(e.target.value)} onBlur={saveThreshold}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
          <span>MAD</span>
          {thresholdSaved && <span className={styles.saved}>✓</span>}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
