import { useMemo, useRef, useState } from "react";
import { X, Upload, RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2, FileUp } from "lucide-react";
import SectionViewer from "./SectionViewer";
import { applyToSection, compose, relative, toMatrix } from "./orientation";
import { fmtMm } from "./geometry";
import { previewSection, uploadSection, updateSection } from "../../services/productionService";
import purch from "../../pages/purchasing/Purchasing.module.css";
import css from "./Dxf.module.css";

/**
 * Import (or re-orient) the DXF section of a profile article.
 * The drawing must read: X = in the plane of the window, the edge towards
 * the frame / wall on the LEFT; Y = depth, EXTERIOR UP — rotate / mirror
 * until it does. Dimensions, kg/m and lacquer perimeter are read from it.
 *   existing  the current section → re-orientation only (no new file)
 */
export default function DxfImportModal({ productId, productName, existing = null, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [base, setBase] = useState(existing ? { paths: existing.paths, metrics: existing.metrics } : null);
  const [layers, setLayers] = useState(existing?.layers || []);
  const [hidden, setHidden] = useState(existing?.hiddenLayers || []);
  const start = existing?.transform || { rot: 0, flipX: false, flipY: false };
  const [transform, setTransform] = useState(start);
  const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  const baseTransform = existing && !file ? start : { rot: 0, flipX: false, flipY: false };
  const shown = useMemo(() => (base ? applyToSection(base, file || !existing ? toMatrix(transform) : relative(baseTransform, transform)) : null), [base, transform, file]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async (f, hiddenLayers = hidden) => {
    setBusy(true); setError("");
    try {
      const r = await previewSection(f, { hiddenLayers });
      setBase({ paths: r.paths, metrics: r.metrics });
      setLayers(r.layers || []);
      if (f !== file) { setFile(f); setTransform({ rot: 0, flipX: false, flipY: false }); }
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };
  const toggleLayer = (name) => {
    const next = hidden.includes(name) ? hidden.filter((x) => x !== name) : [...hidden, name];
    setHidden(next);
    if (file) load(file, next);
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      const r = file
        ? await uploadSection(productId, file, { transform, hiddenLayers: hidden, applyToProduct: apply })
        : await updateSection(productId, { transform, hiddenLayers: hidden, applyToProduct: apply });
      onDone?.(r);
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };
  const m = shown?.metrics;

  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={purch.modalCard} style={{ maxWidth: 980, maxHeight: "94vh", overflow: "auto" }}>
        <div className={purch.sectionHeader}>
          <h3 style={{ margin: 0 }}>Coupe DXF — {productName}</h3>
          <button type="button" className="tableActionBtn" onClick={onClose}><X size={14} /></button>
        </div>
        {error && <div className="errorMessage">{error}</div>}
        <input ref={input} type="file" accept=".dxf,application/dxf" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && load(e.target.files[0], [])} />
        <div className={css.importGrid}>
          <div>
            {shown ? (
              <SectionViewer section={shown} height={430} title={file?.name || existing?.fileName} />
            ) : (
              <div className={css.drop} onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) load(f, []); }}>
                <FileUp size={28} />
                <strong>Glissez le DXF du profilé ici</strong>
                <span>ou cliquez pour choisir le fichier (coupe fournie par le gammiste)</span>
              </div>
            )}
            <div className={css.axis} style={{ marginTop: 6 }}>
              <span>→ X : dans le plan du châssis (côté dormant / mur à gauche)</span>
              <span>↑ Y : profondeur, extérieur en haut</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button type="button" className="btnEdit" onClick={() => input.current?.click()} disabled={busy}><Upload size={14} /> {base ? "Autre fichier…" : "Choisir le fichier DXF"}</button>
            {shown && (
              <>
                <div>
                  <div className={css.hint} style={{ marginBottom: 4 }}>Orientation</div>
                  <div className={css.orient}>
                    <button type="button" onClick={() => setTransform(compose(transform, "rotL"))}><RotateCcw size={13} /> 90°</button>
                    <button type="button" onClick={() => setTransform(compose(transform, "rotR"))}><RotateCw size={13} /> 90°</button>
                    <button type="button" onClick={() => setTransform(compose(transform, "flipX"))}><FlipHorizontal2 size={13} /> Miroir ↔</button>
                    <button type="button" onClick={() => setTransform(compose(transform, "flipY"))}><FlipVertical2 size={13} /> Miroir ↕</button>
                  </div>
                </div>
                <div className={css.metrics}>
                  <span>Largeur vue de face (X)</span><strong>{fmtMm(m.width, 2)} mm</strong>
                  <span>Profondeur (Y)</span><strong>{fmtMm(m.height, 2)} mm</strong>
                  <span>Section</span><strong>{fmtMm(m.area, 1)} mm²</strong>
                  <span>Poids (alu 2,7)</span><strong>{fmtMm(m.kgm, 3)} kg/m</strong>
                  <span>Périmètre extérieur</span><strong>{fmtMm(m.outerPerimeter, 1)} mm</strong>
                  <span>Contours / chambres</span><strong>{m.loops} / {m.holes}</strong>
                  {m.openChains > 0 && <><span style={{ color: "var(--tone-e8b93f)" }}>Lignes non fermées</span><strong style={{ color: "var(--tone-e8b93f)" }}>{m.openChains}</strong></>}
                </div>
                {m.openChains > 0 && <p className={css.hint}>Des lignes ne forment pas de contour fermé (cotes, axes, cartouche ?) : masquez leur couche pour que la section et le poids soient justes.</p>}
                {layers.length > 1 && file && (
                  <div>
                    <div className={css.hint} style={{ marginBottom: 4 }}>Couches</div>
                    <div className={css.layers}>
                      {layers.map((l) => <label key={l.name}><input type="checkbox" checked={!hidden.includes(l.name)} onChange={() => toggleLayer(l.name)} /> {l.name} <span className={css.hint}>({l.count})</span></label>)}
                    </div>
                  </div>
                )}
                <label style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: "0.8rem" }}>
                  <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>Mettre à jour la fiche article : largeur, profondeur, poids au mètre et périmètre laquable lus sur la coupe</span>
                </label>
              </>
            )}
          </div>
        </div>
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>Annuler</button>
          <button type="button" className="btnPrimary" disabled={!shown || busy || (!file && !existing)} onClick={save}>{busy ? "…" : "Enregistrer la coupe"}</button>
        </div>
      </div>
    </div>
  );
}
