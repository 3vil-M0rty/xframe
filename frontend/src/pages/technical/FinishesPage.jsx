import { Palette } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
import { FinishesTab } from "../production/ProductionConfig";
import TechShell from "./TechShell";

/** Technique → Finitions & couleurs (RAL, anodisation, poudre associée…). */
export default function FinishesPage() {
  const { t } = useI18n();
  return (
    <TechShell icon={Palette} title={t("tech.finishesTitle")} subtitle={t("tech.finishesSubtitle")}>
      {(companyId) => <FinishesTab companyId={companyId} />}
    </TechShell>
  );
}
