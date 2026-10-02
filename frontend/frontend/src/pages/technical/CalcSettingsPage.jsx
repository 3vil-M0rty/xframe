import { SlidersHorizontal } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
import { SettingsTab } from "../production/ProductionConfig";
import TechShell from "./TechShell";

/** Technique → Paramètres de calcul & débit (lame, début de barre, plateaux, poudre…). */
export default function CalcSettingsPage() {
  const { t } = useI18n();
  return (
    <TechShell icon={SlidersHorizontal} title={t("tech.settingsTitle")} subtitle={t("tech.settingsSubtitle")}>
      {(companyId) => <SettingsTab companyId={companyId} />}
    </TechShell>
  );
}
