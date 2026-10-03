import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenTool, Plus } from "lucide-react";

import { useI18n } from "../../../hooks/useI18n";
import CustomSelect from "../../../components/useful/CustomSelect";
import { getChassisModels, getSeries } from "../../../services/productionService";
import { sketchChassis } from "../../../utils/chassisSketch";
import TechShell from "../TechShell";
import purch from "../../purchasing/Purchasing.module.css";
import st from "./Designer.module.css";

/** Technique › Conception: the CAD designs (models drawn in the CAD) and a new one. */
export default function DesignsList() {
  const { t } = useI18n();
  return (
    <TechShell icon={PenTool} title={t("cad.title")} subtitle={t("cad.subtitle")}>
      {(companyId) => <Body companyId={companyId} />}
    </TechShell>
  );
}

function Thumb({ drawing }) {
  const { shapes } = sketchChassis({ drawing, width: 120, height: 100, pad: 6 });
  return (
    <svg viewBox="0 0 120 100" className={st.thumb}>
      {shapes.map((s, i) => (s.t === "rect"
        ? <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} className={s.fill === "glass" ? st.glass : s.fill === "solid" ? st.panel : st.thumbLine} strokeWidth={s.sw * 0.7} strokeDasharray={s.dash?.join(" ")} />
        : s.t === "line" ? <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className={st.thumbLine} strokeWidth={s.sw * 0.7} strokeDasharray={s.dash?.join(" ")} /> : null))}
    </svg>
  );
}

function Body({ companyId }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [series, setSeries] = useState([]);
  const [form, setForm] = useState({ series: "", name: "", from: "" });
  useEffect(() => {
    getChassisModels({ companyId, active: "all" }).then((list) => setModels(list.filter((m) => m.drawing?.type === "design"))).catch(() => setModels([]));
    getSeries(companyId).then((list) => { setSeries(list); setForm((f) => ({ ...f, series: f.series || list[0]?._id || "" })); }).catch(() => setSeries([]));
  }, [companyId]);
  const start = () => navigate(`/technical/designer/new?series=${form.series}&name=${encodeURIComponent(form.name)}${form.from ? `&from=${form.from}` : ""}`);
  return (
    <>
      <div className={purch.panel} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="filterGroup" style={{ minWidth: 180 }}><label>{t("prod.series")}</label>
          <CustomSelect value={form.series} onSelect={(v) => setForm({ ...form, series: v })} options={series.map((x) => ({ value: x._id, label: x.name }))} />
        </div>
        <label className={purch.field} style={{ flex: 1, minWidth: 220 }}>{t("cad.name")}<input className={purch.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("cad.namePlaceholder")} /></label>
        <div className="filterGroup" style={{ minWidth: 220 }}><label>{t("cad.startFrom")}</label>
          <CustomSelect value={form.from} onSelect={(v) => setForm({ ...form, from: v })} options={[{ value: "", label: t("cad.blank") }, ...models.map((m) => ({ value: m._id, label: m.name }))]} />
        </div>
        <button type="button" className="btnPrimary" disabled={!form.series} onClick={start}><Plus size={15} /> {t("cad.newDesign")}</button>
      </div>
      {!series.length && <div className={purch.infoBanner}>{t("cad.noSeriesYet")}</div>}
      <div className={st.grid}>
        {models.map((m) => (
          <button key={m._id} type="button" className={st.tile} onClick={() => navigate(`/technical/designer/${m._id}`)}>
            <Thumb drawing={m.drawing} />
            <strong>{m.name}</strong>
            <small className={st.muted}>{m.series?.name || ""}</small>
          </button>
        ))}
        {!models.length && <p className={st.muted}>{t("cad.noDesigns")}</p>}
      </div>
    </>
  );
}
