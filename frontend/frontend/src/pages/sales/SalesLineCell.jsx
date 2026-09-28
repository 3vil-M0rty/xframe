import ChassisDrawing from "../production/ChassisDrawing";
import s from "./Sales.module.css";

/**
 * Designation cell of a devis / facture line. Ordinary lines show their
 * text; chassis lines (with `info` from the API's `chassisInfo`) show
 * the schematic or the model's picture, "F1 · Coulissant 2 vantaux" in
 * bold, then the series / L × H / colour as chips and the options in
 * small print — instead of one long sentence.
 */
export default function SalesLineCell({ line, info }) {
  if (!info) return <>{line.chassis?.ref ? <strong>{line.chassis.ref} · </strong> : null}{line.description}</>;
  const own = String(line.description || "").trim();
  const custom = own && own !== info.autoDescription && own !== `${info.ref} · ${info.autoDescription}`;
  return (
    <div className={s.chassisCell}>
      <div className={s.chassisThumb}>
        <ChassisDrawing drawing={info.drawing} L={info.L} H={info.H} params={info.params} image={info.image} width={72} height={58} />
      </div>
      <div className={s.chassisText}>
        <div className={s.chassisTitle}>{info.ref && <span className={s.chassisRef}>{info.ref}</span>}{info.name}</div>
        <div className={s.chassisChips}>
          <span className={s.chip}>{info.size}</span>
          {info.finish && <span className={s.chip}><i className={s.chipDot} style={{ background: info.finishColor || "transparent" }} />{info.finish}</span>}
          {info.series && <span className={s.chip}>{info.series}</span>}
        </div>
        {info.options.length > 0 && (
          <ul className={s.chassisOptions}>
            {info.options.map((o) => <li key={o}>{o}</li>)}
          </ul>
        )}
        {custom && <div className={s.chassisNote}>{own}</div>}
      </div>
    </div>
  );
}
