/**
 * Chassis whose glass unit (vitrage) was not chosen: a "model" parameter
 * of the vitrage family left empty on the devis / project line. Those
 * chassis produce NO glazing work — this list lets the screens say so
 * and fix them in one go.
 */
const bom = require("./chassisBom");

function missingGlass(project, ctx) {
  const out = [];
  for (const it of project.items || []) {
    const model = ctx.models.get(bom.idOf(it.model));
    if (!model) continue;
    const r = bom.expandItem({ ...it, quantity: 1, finish: it.finish || project.finish || null }, ctx);
    for (const comp of model.components || []) {
      if (comp.kind !== "model" || !comp.modelParam || comp.subModel) continue;
      const param = (model.parameters || []).find((p) => p.key === comp.modelParam);
      if (param && param.family && param.family !== "vitrage") continue;
      if (!r.warnings.some((w) => String(w.message).includes(`« ${comp.label} » : aucun modèle choisi`))) continue;
      out.push({ item: String(it._id), ref: it.ref || "", model: model.name, quantity: it.quantity, param: comp.modelParam, label: comp.label });
    }
  }
  return out;
}

module.exports = { missingGlass };
