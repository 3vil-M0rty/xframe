import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Box, Upload, RotateCw, Download, Trash2, GitMerge, Save, AlertTriangle } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import { useDialog } from "../../components/useful/DialogProvider";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SectionViewer from "../../components/dxf/SectionViewer";
import DxfImportModal from "../../components/dxf/DxfImportModal";
import { fmtMm } from "../../components/dxf/geometry";
import FabRulesPanels from "./FabRules";
import { NODE_TYPES } from "./nodes/nodeGeometry";
import { getProfile, saveProfileRules, deleteSection, downloadSectionSource, updateSeriesProfile } from "../../services/productionService";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "../production/Production.module.css";

export const ROLES = { frame: "Dormant", sash: "Ouvrant", mullion: "Meneau / traverse", bead: "Parclose", meeting: "Battement", other: "Autre" };
const ROLE_TRIGGERS = {
  frame: ["piece", "corner", "chassis", "pane"], sash: ["piece", "corner", "leaf", "pane"], mullion: ["piece", "joint"],
  bead: ["piece"], meeting: ["piece", "leaf"], other: ["piece", "chassis"],
};
const LEGACY = [["profileOuterFin", "ae", "Ailette externe"], ["profileChamber", "ch", "Chambre"], ["profileInnerFin", "ai", "Ailette interne"]];

/**
 * PROFILE SHEET (fiche profilé, like LogiKal's article sheet): the DXF
 * section with its dimensions (measure tool), the values read from it
 * (largeur, profondeur, kg/m, périmètre), the accessories and machining
 * that go with the profile, and the nodes it takes part in.
 */
export default function ProfilePage() {
  const { id } = useParams();
  const { t } = useI18n();
  const can = useCan();
  const dialog = useDialog();
  const [p, setP] = useState(null);
  const [importing, setImporting] = useState(null); // "new" | "orient"
  const [legacy, setLegacy] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canEdit = can("production.catalog.edit") || can("inventory.articles.edit");

  const load = useCallback(async () => {
    try {
      const d = await getProfile(id);
      setP(d);
      setLegacy(Object.fromEntries(LEGACY.map(([f]) => [f, d[f] ?? ""])));
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);
  if (!p) return <div className="pageShell">{error ? <div className="errorMessage">{error}</div> : <p className={s.muted}>{t("common.loading")}</p>}</div>;

  const run = async (fn, msg) => { setError(""); setNotice(""); try { await fn(); if (msg) setNotice(msg); await load(); return true; } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); return false; } };
  const seriesId = p.profileSeries?._id || p.profileSeries;
  const m = p.section?.metrics;
  const role = p.profileRole || "other";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.technical"), href: "/technical/catalog" }, ...(p.series ? [{ label: p.series.name, href: `/technical/series/${seriesId}` }] : []), { label: p.name }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Box size={20} /><h1>{p.seriesCode && <span style={{ fontFamily: "monospace", marginRight: 8 }}>{p.seriesCode}</span>}{p.name}</h1></div>
          <p className="pageSubtitle">{[p.internalReference && `Réf. ${p.internalReference}`, p.series && `Série ${p.series.name}`, `Stock ${p.quantity ?? 0} ${p.unit || ""}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="pageHeaderActions">
          {canEdit && <button type="button" className="btnPrimary" onClick={() => setImporting("new")}><Upload size={14} /> {p.section ? "Remplacer le DXF" : "Importer le DXF"}</button>}
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, alignItems: "start" }}>
        <section className={purch.panel} style={{ margin: 0 }}>
          {p.section ? (
            <SectionViewer section={p.section} height={460} title={p.section.fileName}
              extra={canEdit && (
                <>
                  <button type="button" onClick={() => setImporting("orient")} title="Changer l'orientation"><RotateCw size={13} /> Orientation</button>
                  {p.section.hasSource && <button type="button" onClick={() => downloadSectionSource(p._id, p.section.fileName)} title="Télécharger le DXF d'origine"><Download size={13} /></button>}
                  <button type="button" onClick={async () => { if (await dialog.confirm("Supprimer la coupe DXF de ce profilé ?")) run(() => deleteSection(p._id), "Coupe supprimée."); }} title="Supprimer la coupe"><Trash2 size={13} /></button>
                </>
              )} />
          ) : (
            <div style={{ height: 300, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", color: "var(--color-text-tertiary)" }}>
              <AlertTriangle size={22} />
              <span>Pas encore de coupe DXF : importez le fichier du gammiste pour que le CAD et les nœuds dessinent ce profilé.</span>
              {canEdit && <button type="button" className="btnPrimary" onClick={() => setImporting("new")}><Upload size={14} /> Importer le DXF</button>}
            </div>
          )}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section className={purch.panel} style={{ margin: 0 }}>
            <h3 className={purch.subTitle} style={{ marginTop: 0 }}>Profilé</h3>
            <label className={purch.field}>Rôle dans la série
              <CustomSelect value={role} onSelect={(v) => seriesId && run(() => updateSeriesProfile(seriesId, p._id, { role: v }), "Rôle enregistré.")} options={Object.entries(ROLES).map(([k, l]) => ({ value: k, label: l }))} disabled={!canEdit || !seriesId} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 10px", fontSize: "0.82rem" }}>
              <span className={s.muted}>Largeur vue de face</span><strong>{fmtMm(p.profileHeight || m?.width)} mm</strong>
              <span className={s.muted}>Profondeur</span><strong>{fmtMm(p.profileWidth || m?.height)} mm</strong>
              <span className={s.muted}>Poids</span><strong>{fmtMm(p.weightPerMeter, 3)} kg/m</strong>
              <span className={s.muted}>Périmètre laquable</span><strong>{fmtMm(p.perimeter)} mm</strong>
              <span className={s.muted}>Longueur de barre</span><strong>{fmtMm(p.barLength, 0)} mm</strong>
              {m && <><span className={s.muted}>Section</span><strong>{fmtMm(m.area)} mm²</strong></>}
            </div>
            {m && <p className={s.muted} style={{ fontSize: "0.74rem" }}>Lu sur le DXF (alu 2,7 g/cm³). Le poids et le périmètre servent au prix de revient et au laquage.</p>}
          </section>

          <section className={purch.panel} style={{ margin: 0 }}>
            <h3 className={purch.subTitle} style={{ marginTop: 0, display: "flex", gap: 6, alignItems: "center" }}><GitMerge size={15} /> Nœuds</h3>
            {(p.nodes || []).map((n) => (
              <Link key={n._id} to={`/technical/nodes/${n._id}`} className={styles.chip} style={{ marginBottom: 4, display: "inline-flex" }}>
                {n.name || NODE_TYPES[n.type]?.label}{n.stale ? " ⚠" : ""}
              </Link>
            ))}
            {!p.nodes?.length && <p className={s.muted}>Ce profilé n'est encore dans aucun nœud.</p>}
            {seriesId && <div style={{ marginTop: 6 }}><Link to={`/technical/series/${seriesId}`} style={{ fontSize: "0.8rem" }}>Nœuds de la série →</Link></div>}
          </section>

          <details className={purch.panel} style={{ margin: 0 }}>
            <summary style={{ cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Géométrie simplifiée (estimations sans nœud)</summary>
            <p className={s.muted} style={{ fontSize: "0.74rem" }}>Utilisée seulement tant que les nœuds ne sont pas définis (cotes estimées) et dans les formules écrites à la main (CODE.ae…).</p>
            {LEGACY.map(([f, k, label]) => (
              <label key={f} className={purch.field}>{label} ({k})<input type="number" step="any" value={legacy[f]} disabled={!canEdit} onChange={(e) => setLegacy({ ...legacy, [f]: e.target.value })} style={{ padding: "5px 7px" }} /></label>
            ))}
            {canEdit && seriesId && <button type="button" className="btnEdit" onClick={() => run(() => updateSeriesProfile(seriesId, p._id, legacy), "Géométrie enregistrée.")}><Save size={13} /> {t("common.save")}</button>}
          </details>
        </aside>
      </div>

      <div style={{ marginTop: 14 }}>
        <FabRulesPanels
          rules={p.fabRules?.accessories || []} machining={p.fabRules?.machining || []} companyId={p.company} canEdit={canEdit} triggers={ROLE_TRIGGERS[role]}
          accessoriesHint={`Articles qui vont avec ce profilé, ajoutés automatiquement à chaque châssis qui l'utilise : ${role === "frame" ? "équerres de coin, vis de fixation…" : role === "sash" ? "équerres, joint de frappe au mètre, ferrure par vantail (groupes S / M / L par taille et poids), poignée…" : role === "mullion" ? "connecteurs à chaque bout, embouts…" : "embouts, joints…"}`}
          machiningHint="Usinages de ce profilé (drainages, perçages, fraisages…) avec leurs positions sur chaque pièce — imprimés sur la fiche d'usinage."
          onSaveRules={(accessories) => run(() => saveProfileRules(p._id, { accessories }), "Accessoires du profilé enregistrés.")}
          onSaveMachining={(machining) => run(() => saveProfileRules(p._id, { machining }), "Usinages du profilé enregistrés.")} />
      </div>

      {importing && (
        <DxfImportModal productId={p._id} productName={p.name} existing={importing === "orient" ? p.section : null}
          onClose={() => setImporting(null)} onDone={() => { setImporting(null); run(async () => {}, "Coupe DXF enregistrée : la fiche est à jour (largeur, profondeur, poids, périmètre)."); }} />
      )}
    </div>
  );
}
