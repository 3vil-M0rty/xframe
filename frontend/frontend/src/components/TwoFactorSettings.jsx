import { useState, useEffect } from "react";
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";

import { useI18n } from "../hooks/useI18n";
import {
  getTwoFactorStatus,
  startTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
} from "../services/twoFactorService";

import styles from "./TwoFactorSettings.module.css";

/**
 * Self-contained 2FA enable/disable panel for the Profile page.
 * Three states, driven entirely by local state (no parent
 * involvement needed): not enabled (offer to enable), mid-setup
 * (QR code -> confirm code -> one-time backup codes reveal), and
 * enabled (offer to disable, requires the account password).
 */
export default function TwoFactorSettings() {
  const { t } = useI18n();

  const [status, setStatus] = useState(null); // null while loading
  const [statusError, setStatusError] = useState("");

  // ---------- Enable flow ----------
  const [setupStep, setSetupStep] = useState("idle"); // idle | scanning | backupCodes
  const [setupData, setSetupData] = useState(null); // { qrCodeDataUrl, secret }
  const [setupCode, setSetupCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // ---------- Disable flow ----------
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState("");

  const loadStatus = async () => {
    try {
      const data = await getTwoFactorStatus();
      setStatus(data);
    } catch (err) {
      setStatusError(err.response?.data?.message || t("twoFactor.errors.statusFailed"));
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartSetup = async () => {
    setSetupLoading(true);
    setSetupError("");
    try {
      const data = await startTwoFactorSetup();
      setSetupData(data);
      setSetupStep("scanning");
    } catch (err) {
      setSetupError(err.response?.data?.message || t("twoFactor.errors.setupFailed"));
    } finally {
      setSetupLoading(false);
    }
  };

  const handleConfirmSetup = async (e) => {
    e.preventDefault();
    setSetupLoading(true);
    setSetupError("");
    try {
      const { backupCodes: codes } = await confirmTwoFactorSetup(setupCode);
      setBackupCodes(codes);
      setSetupStep("backupCodes");
    } catch (err) {
      setSetupError(err.response?.data?.message || t("twoFactor.errors.invalidCode"));
    } finally {
      setSetupLoading(false);
    }
  };

  const handleFinishSetup = () => {
    setSetupStep("idle");
    setSetupData(null);
    setSetupCode("");
    setBackupCodes(null);
    setCopiedCodes(false);
    loadStatus();
  };

  const handleCopyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2500);
    } catch {
      // Clipboard access can fail (permissions, insecure context) —
      // the codes are still visible on screen either way, so this
      // isn't a blocking failure, just a missed convenience.
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setDisableLoading(true);
    setDisableError("");
    try {
      await disableTwoFactor(disablePassword);
      setShowDisableForm(false);
      setDisablePassword("");
      await loadStatus();
    } catch (err) {
      setDisableError(err.response?.data?.message || t("twoFactor.errors.disableFailed"));
    } finally {
      setDisableLoading(false);
    }
  };

  if (status === null) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <ShieldCheck size={16} />
          <h3>{t("twoFactor.title")}</h3>
        </div>
        {statusError ? <p className={styles.error}>{statusError}</p> : <p className={styles.hint}>{t("common.loading")}</p>}
      </div>
    );
  }

  // ---------- Backup codes reveal (shown once, right after enabling) ----------
  if (setupStep === "backupCodes") {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <ShieldCheck size={16} />
          <h3>{t("twoFactor.backupCodesTitle")}</h3>
        </div>
        <p className={styles.hint}>{t("twoFactor.backupCodesHint")}</p>
        <div className={styles.backupCodesGrid}>
          {backupCodes.map((code) => (
            <code key={code} className={styles.backupCode}>{code}</code>
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className="btnEdit" onClick={handleCopyBackupCodes}>
            {copiedCodes ? <Check size={14} /> : <Copy size={14} />}
            {copiedCodes ? t("twoFactor.copied") : t("twoFactor.copyBackupCodes")}
          </button>
          <button type="button" className="btnPrimary" onClick={handleFinishSetup}>
            {t("twoFactor.iSavedThem")}
          </button>
        </div>
      </div>
    );
  }

  // ---------- QR code scan + confirm step ----------
  if (setupStep === "scanning") {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <ShieldCheck size={16} />
          <h3>{t("twoFactor.scanTitle")}</h3>
        </div>
        <p className={styles.hint}>{t("twoFactor.scanHint")}</p>

        <img src={setupData.qrCodeDataUrl} alt="2FA QR code" className={styles.qrCode} />

        <p className={styles.manualEntryLabel}>{t("twoFactor.manualEntryLabel")}</p>
        <code className={styles.manualEntryKey}>{setupData.secret}</code>

        <form onSubmit={handleConfirmSetup} className={styles.form}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
            required
            autoFocus
            className={styles.codeInput}
          />
          {setupError && <p className={styles.error}>{setupError}</p>}
          <div className={styles.actions}>
            <button type="button" className="btnCancel" onClick={() => { setSetupStep("idle"); setSetupData(null); setSetupCode(""); setSetupError(""); }}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btnPrimary" disabled={setupLoading}>
              {setupLoading ? <Loader2 size={14} className={styles.spinner} /> : null}
              {setupLoading ? t("twoFactor.verifying") : t("twoFactor.confirmAndEnable")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ---------- Steady state: enabled or not ----------
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {status.enabled ? <ShieldCheck size={16} className={styles.enabledIcon} /> : <ShieldOff size={16} />}
        <h3>{t("twoFactor.title")}</h3>
      </div>

      {status.enabled ? (
        <>
          <p className={styles.hint}>{t("twoFactor.enabledHint")}</p>

          {!showDisableForm ? (
            <button type="button" className="btnCancel" onClick={() => setShowDisableForm(true)}>
              {t("twoFactor.disableButton")}
            </button>
          ) : (
            <form onSubmit={handleDisable} className={styles.form}>
              <label className={styles.label}>{t("twoFactor.confirmPasswordLabel")}</label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                autoFocus
                className={styles.codeInput}
              />
              {disableError && <p className={styles.error}>{disableError}</p>}
              <div className={styles.actions}>
                <button type="button" className="btnCancel" onClick={() => { setShowDisableForm(false); setDisablePassword(""); setDisableError(""); }}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="btnCancel" disabled={disableLoading}>
                  {disableLoading ? <Loader2 size={14} className={styles.spinner} /> : null}
                  {disableLoading ? t("twoFactor.disabling") : t("twoFactor.disableButton")}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          <p className={styles.hint}>{t("twoFactor.disabledHint")}</p>
          {setupError && <p className={styles.error}>{setupError}</p>}
          <button type="button" className="btnPrimary" onClick={handleStartSetup} disabled={setupLoading}>
            {setupLoading ? <Loader2 size={14} className={styles.spinner} /> : null}
            {setupLoading ? t("common.loading") : t("twoFactor.enableButton")}
          </button>
        </>
      )}
    </div>
  );
}
