import { Layers } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
import { GlassTypesTab } from "../production/Glazing";
import TechShell from "./TechShell";

/** Technique → Compositions de vitrage ("44.2 / 10 / 6", allowed plateaux…). */
export default function GlassTypesPage() {
  const { t } = useI18n();
  return (
    <TechShell icon={Layers} title={t("tech.glassTypesTitle")} subtitle={t("tech.glassTypesSubtitle")}>
      {(companyId) => <GlassTypesTab companyId={companyId} />}
    </TechShell>
  );
}
