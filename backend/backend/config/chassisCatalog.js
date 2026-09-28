/**
 * ============================================================
 * CHASSIS CATALOGUE — every standard aluminium product type
 * ============================================================
 * These are TEMPLATES, not fixed products. A client company imports
 * a template into one of its series (Production → Catalogue), then:
 *   - maps every component ("role") to one of ITS inventory articles
 *     (its own profiles, accessories, gaskets, glass…),
 *   - adjusts the series variables (clearances, overlaps, deductions
 *     — every supplier's system has its own),
 *   - edits, adds or removes components and formulas freely.
 * Nothing below is hard-wired anywhere else: the BOM engine only reads
 * what is saved on the company's ChassisModel.
 *
 * FORMULA VOCABULARY (see services/formulaEngine.js)
 *   L, H          overall width / height of the chassis in mm
 *   parameters    the model's own inputs (n = leaves, ms = fly screen…)
 *   variables     the SERIES variables (jl, rc, dd…) — one set per series
 *   derived       intermediate values computed in order (wv, hv, gw…)
 *   functions     min max ceil floor round(x,d) ceilto(x,step) floorto
 *                 abs sqrt clamp if(c,a,b) sin cos tan hyp ; c ? a : b
 *
 * COMPONENT FIELDS
 *   role       stable key ("rail_haut") — used to map articles
 *   kind       profile | gasket | glass | panel | accessory | consumable | model
 *   measure    length (mm per piece) | area (width × height, mm) | count
 *              (default from kind: profile/gasket → length,
 *               glass/panel → area, others → count)
 *   qty        number of pieces per chassis (formula)
 *   length     cut length in mm (length measure)
 *   width/height  piece size in mm (area measure, or the L/H passed to a sub-model)
 *   angle      cut angles "45/45", "90/90", "45/90" (profiles)
 *   finish     project = takes the colour ordered on the line (painted in
 *              the Laquage workshop when that colour is lacquered in-house)
 *              raw = always raw ; none = colour-independent
 *   workshop   workshop CODE that consumes it (ALU, VIT, LAQ or a custom one)
 *   condition  formula — the component only exists when it is non-zero
 *   waste      % added on top (profiles use bar optimisation instead)
 *   modelParam / productParam  the component comes from a parameter
 *              (e.g. the glass unit chosen on the devis line)
 * ============================================================
 */

const FAMILIES = [
  { key: "coulissant", fr: "Coulissants", en: "Sliding" },
  { key: "ouvrant", fr: "Ouvrants (française, OB, soufflet…)", en: "Casement / tilt / hung" },
  { key: "fixe", fr: "Châssis fixes", en: "Fixed frames" },
  { key: "compose", fr: "Ensembles composés", en: "Combined frames" },
  { key: "porte", fr: "Portes", en: "Doors" },
  { key: "facade", fr: "Façades & verrières", en: "Facades & glazed roofs" },
  { key: "fermeture", fr: "Volets, persiennes & moustiquaires", en: "Shutters & fly screens" },
  { key: "exterieur", fr: "Garde-corps, pergolas & habillage", en: "Railings, pergolas & cladding" },
  { key: "vitrage", fr: "Vitrages (compositions)", en: "Glass units" },
  { key: "remplissage", fr: "Remplissages (panneaux)", en: "Infill panels" },
  { key: "autre", fr: "Autres", en: "Other" },
];

// ------------------------------------------------------------------
// Shared building blocks
// ------------------------------------------------------------------
const P = {
  vitrage: { key: "vitrage", label: "Vitrage", type: "model", family: "vitrage" },
  ms: { key: "ms", label: "Moustiquaire", type: "boolean", default: 0 },
  n: (def, min = 1, max = 8) => ({ key: "n", label: "Nombre de vantaux", type: "number", default: def, min, max }),
  seuil: { key: "seuil", label: "Seuil / traverse basse", type: "boolean", default: 1 },
  fp: { key: "fp", label: "Ferme-porte", type: "boolean", default: 0 },
  rempl: {
    key: "rempl", label: "Remplissage", type: "choice", default: 0,
    options: [{ value: 0, label: "Vitré" }, { value: 1, label: "Plein (panneau)" }, { value: 2, label: "Mixte (soubassement plein)" }],
  },
  hs: { key: "hs", label: "Hauteur soubassement (mm)", type: "number", default: 900, min: 0, max: 2000, unit: "mm" },
  panneau: { key: "panneau", label: "Panneau de remplissage", type: "model", family: "remplissage" },
};

const V = {
  // frame
  jl: { key: "jl", label: "Déduction largeur vantaux (total, mm)", value: 50 },
  rc: { key: "rc", label: "Recouvrement entre vantaux (chicane, mm)", value: 40 },
  jh: { key: "jh", label: "Déduction hauteur vantail (mm)", value: 60 },
  dtr: { key: "dtr", label: "Déduction traverse vantail (mm)", value: 56 },
  dvl: { key: "dvl", label: "Déduction largeur vitrage / vantail (mm)", value: 72 },
  dvh: { key: "dvh", label: "Déduction hauteur vitrage / vantail (mm)", value: 72 },
  dd: { key: "dd", label: "Déduction dormant → ouvrant par côté (mm)", value: 22 },
  dm: { key: "dm", label: "Déduction battement central (mm)", value: 12 },
  dvo: { key: "dvo", label: "Déduction vitrage ouvrant par côté (mm)", value: 56 },
  dvf: { key: "dvf", label: "Déduction vitrage fixe par côté (mm)", value: 36 },
  pcl: { key: "pcl", label: "Parclose : longueur = vitrage + (mm)", value: 8 },
  dt: { key: "dt", label: "Déduction traverse / meneau intermédiaire (mm)", value: 90 },
  hpaum: { key: "hpaum", label: "Hauteur à partir de laquelle on ajoute une 3ᵉ paumelle (mm)", value: 1400 },
  gache: { key: "gache", label: "Une gâche tous les (mm)", value: 600 },
  cart: { key: "cart", label: "Mètres de joint silicone par cartouche", value: 6 },
};

const siliconeLine = (perimeter = "2*(L+H)") => ({
  role: "silicone", label: "Silicone / mastic de pose (cartouches)", kind: "consumable", qty: `${perimeter}/1000/cart`, finish: "none",
});
const screwsLine = (qty) => ({ role: "visserie", label: "Visserie inox (pièces)", kind: "accessory", qty, finish: "none" });
const glassSubModel = (qty, width, height, label = "Vitrage") => ({
  role: "vitrage", label, kind: "model", modelParam: "vitrage", qty, width, height, workshop: "VIT",
});
const setting = (qty) => ({ role: "cales", label: "Cales de vitrage", kind: "accessory", qty: `4*(${qty})`, finish: "none" });
const glazingGaskets = (qty, gw, gh) => [
  { role: "joint_vitrage_ext", label: "Joint de vitrage extérieur", kind: "gasket", qty, length: `2*(${gw}+${gh})`, finish: "none", waste: 5 },
  { role: "joint_vitrage_int", label: "Joint de vitrage intérieur", kind: "gasket", qty, length: `2*(${gw}+${gh})`, finish: "none", waste: 5 },
];
const beads = (qty, gw, gh) => [
  { role: "parclose_h", label: "Parclose horizontale", kind: "profile", qty: `2*(${qty})`, length: `${gw}+pcl`, angle: "90/90", finish: "project" },
  { role: "parclose_v", label: "Parclose verticale", kind: "profile", qty: `2*(${qty})`, length: `${gh}+pcl`, angle: "90/90", finish: "project" },
];
const frame45 = (prefix = "dormant", label = "Dormant", h = "H", l = "L", topBottomSame = true) => (topBottomSame
  ? [
    { role: `${prefix}_h`, label: `${label} horizontal (haut/bas)`, kind: "profile", qty: "2", length: l, angle: "45/45", finish: "project" },
    { role: `${prefix}_v`, label: `${label} vertical`, kind: "profile", qty: "2", length: h, angle: "45/45", finish: "project" },
  ]
  : [
    { role: `${prefix}_haut`, label: `${label} haut`, kind: "profile", qty: "1", length: l, angle: "45/45", finish: "project" },
    { role: `${prefix}_bas`, label: `${label} bas`, kind: "profile", qty: "1", length: l, angle: "45/45", finish: "project" },
    { role: `${prefix}_v`, label: `${label} vertical`, kind: "profile", qty: "2", length: h, angle: "45/45", finish: "project" },
  ]);

// ------------------------------------------------------------------
// COULISSANTS
// ------------------------------------------------------------------
function sliding({ key, name, en, n, nFixed = true, rails = 2, door = false, lift = false, pocket = false, maxL = 6000, maxH = door ? 3000 : 2400 }) {
  const params = [nFixed ? { ...P.n(n, n, n), fixed: true } : P.n(n, 2, 8), P.vitrage, P.ms];
  if (door) params.push(P.seuil);
  return {
    key, family: "coulissant", name, name_en: en,
    description: `${name}. ${rails} rail(s). Formules standard à ajuster aux cotes de votre série.`,
    drawing: { type: "sliding", leaves: n, rails },
    defaultWorkshop: "ALU",
    limits: { minL: 600, maxL, minH: 400, maxH },
    parameters: params,
    variables: [V.jl, V.rc, V.jh, V.dtr, V.dvl, V.dvh, V.cart],
    derived: [
      { key: "wv", label: "Largeur vantail", formula: pocket ? "(L - jl/2 + (n-1)*rc) / n" : "(L - jl + (n-1)*rc) / n" },
      { key: "hv", label: "Hauteur vantail", formula: "H - jh" },
      { key: "gw", label: "Largeur vitrage", formula: "wv - dvl" },
      { key: "gh", label: "Hauteur vitrage", formula: "hv - dvh" },
    ],
    components: [
      { role: "rail_haut", label: `Dormant haut (${rails} rails)`, kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      door
        ? { role: "rail_bas", label: `Rail bas / seuil (${rails} rails)`, kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project", condition: "seuil" }
        : { role: "rail_bas", label: `Dormant bas (${rails} rails)`, kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      { role: "dormant_v", label: "Montant dormant", kind: "profile", qty: pocket ? "1" : "2", length: "H", angle: "45/45", finish: "project" },
      ...(pocket ? [{ role: "caisson", label: "Caisson / galandage (montant de refoulement)", kind: "profile", qty: "2", length: "H", angle: "90/90", finish: "project" }] : []),
      { role: "montant_lateral", label: "Montant latéral vantail", kind: "profile", qty: "2", length: "hv", angle: "90/90", finish: "project" },
      { role: "montant_chicane", label: "Montant de chicane (croisement)", kind: "profile", qty: "2*n - 2", length: "hv", angle: "90/90", finish: "project" },
      { role: "traverse_haute", label: "Traverse haute vantail", kind: "profile", qty: "n", length: "wv - dtr", angle: "90/90", finish: "project" },
      { role: "traverse_basse", label: "Traverse basse vantail", kind: "profile", qty: "n", length: "wv - dtr", angle: "90/90", finish: "project" },
      glassSubModel("n", "gw", "gh"),
      setting("n"),
      { role: "joint_vitrage", label: "Joint de vitrage (U / EPDM)", kind: "gasket", qty: "n", length: "2*(gw+gh)", finish: "none", waste: 5 },
      { role: "joint_brosse", label: "Joint brosse", kind: "gasket", qty: "n", length: "2*(wv+hv)", finish: "none", waste: 5 },
      lift
        ? { role: "kit_levant", label: "Kit levant-coulissant (poignée + crémone + chariots tandem)", kind: "accessory", qty: "n", finish: "none" }
        : { role: "roulettes", label: "Roulettes (paire par vantail)", kind: "accessory", qty: "2*n", finish: "none" },
      { role: "fermeture", label: door ? "Serrure / fermeture multipoints" : "Fermeture (crochet / crémone)", kind: "accessory", qty: "max(1, floor(n/2))", finish: "none" },
      { role: "poignee", label: "Poignée / cuvette", kind: "accessory", qty: "max(1, floor(n/2))", finish: "project" },
      { role: "equerres_dormant", label: "Équerres d'assemblage dormant", kind: "accessory", qty: "4", finish: "none" },
      { role: "embouts", label: "Embouts / kits d'étanchéité de chicane", kind: "accessory", qty: "2*n", finish: "none" },
      { role: "butees", label: "Butées / amortisseurs", kind: "accessory", qty: "2", finish: "none" },
      { role: "busettes", label: "Busettes d'évacuation d'eau", kind: "accessory", qty: "ceil(L/1000) + 1", finish: "none" },
      { role: "ms_profil", label: "Profil cadre moustiquaire", kind: "profile", qty: "1", length: "2*(wv+hv)", angle: "45/45", finish: "project", condition: "ms" },
      { role: "ms_toile", label: "Toile moustiquaire", kind: "panel", measure: "area", qty: "1", width: "wv", height: "hv", finish: "none", condition: "ms", waste: 10 },
      { role: "ms_kit", label: "Kit roulettes moustiquaire", kind: "accessory", qty: "1", finish: "none", condition: "ms" },
      screwsLine("12 + 8*n"),
      siliconeLine(),
    ],
    labour: [{ workshop: "ALU", minutes: `${door ? 90 : 60} + 20*n` }],
    pricing: { mode: "cost_plus", coefficient: 1.8 },
  };
}

// ------------------------------------------------------------------
// OUVRANTS (à la française, oscillo-battant, soufflet, projetant…)
// ------------------------------------------------------------------
function casement({ key, name, en, n, hardware, door = false, maxL = n * 1000, maxH = door ? 2600 : 2200 }) {
  const params = [{ ...P.n(n, n, n), fixed: true }, P.vitrage];
  if (door) params.push(P.seuil);
  const hw = {
    francaise: [
      { role: "paumelles", label: "Paumelles", kind: "accessory", qty: "n * if(ho > hpaum, 3, 2)", finish: "project" },
      { role: "cremone", label: "Crémone / poignée", kind: "accessory", qty: "1", finish: "project" },
      { role: "gaches", label: "Gâches", kind: "accessory", qty: "ceil(ho / gache)", finish: "none" },
      { role: "verrous", label: "Verrous semi-fixe (haut + bas)", kind: "accessory", qty: "2*(n-1)", finish: "none" },
    ],
    ob: [
      { role: "ferrure_ob", label: "Ferrure oscillo-battante (kit)", kind: "accessory", qty: "1", finish: "none" },
      { role: "poignee_ob", label: "Poignée oscillo-battante", kind: "accessory", qty: "1", finish: "project" },
      { role: "paumelles", label: "Paumelles (vantail semi-fixe)", kind: "accessory", qty: "(n-1) * if(ho > hpaum, 3, 2)", finish: "project" },
      { role: "verrous", label: "Verrous semi-fixe", kind: "accessory", qty: "2*(n-1)", finish: "none" },
    ],
    soufflet: [
      { role: "compas", label: "Compas de soufflet (paire)", kind: "accessory", qty: "n", finish: "none" },
      { role: "charnieres", label: "Charnières basses", kind: "accessory", qty: "2*n", finish: "project" },
      { role: "fermeture", label: "Fermeture / poignée haute", kind: "accessory", qty: "n", finish: "project" },
    ],
    projetant: [
      { role: "bras", label: "Bras projetants / à l'italienne (paire)", kind: "accessory", qty: "n", finish: "none" },
      { role: "poignee", label: "Poignée / crémone", kind: "accessory", qty: "n", finish: "project" },
    ],
    basculant: [
      { role: "pivots", label: "Pivots latéraux (kit basculant)", kind: "accessory", qty: "n", finish: "none" },
      { role: "poignee", label: "Poignée / fermeture", kind: "accessory", qty: "n", finish: "project" },
    ],
    pivotant: [
      { role: "pivots", label: "Pivots haut/bas (kit pivotant)", kind: "accessory", qty: "n", finish: "none" },
      { role: "poignee", label: "Poignée / fermeture", kind: "accessory", qty: "n", finish: "project" },
    ],
    porte: [
      { role: "paumelles", label: "Paumelles de porte", kind: "accessory", qty: "n * if(ho > 2100, 4, 3)", finish: "project" },
      { role: "serrure", label: "Serrure (à larder / multipoints)", kind: "accessory", qty: "1", finish: "none" },
      { role: "cylindre", label: "Cylindre", kind: "accessory", qty: "1", finish: "none" },
      { role: "bequille", label: "Béquilles / poignées (jeu)", kind: "accessory", qty: "1", finish: "project" },
      { role: "verrous", label: "Verrous semi-fixe (haut + bas)", kind: "accessory", qty: "2*(n-1)", finish: "none" },
      { role: "ferme_porte", label: "Ferme-porte", kind: "accessory", qty: "n", finish: "project", condition: "fp" },
    ],
  }[hardware];
  if (hardware === "porte") params.push(P.fp);
  return {
    key, family: door ? "porte" : "ouvrant", name, name_en: en,
    description: `${name}. Dormant et ouvrants coupés à 45°, parcloses à 90°.`,
    drawing: { type: door ? "door" : "casement", leaves: n, opening: hardware },
    defaultWorkshop: "ALU",
    limits: { minL: 300, maxL, minH: 300, maxH },
    parameters: params,
    variables: [V.dd, V.dm, V.dvo, V.pcl, V.hpaum, V.gache, V.cart],
    derived: [
      { key: "wo", label: "Largeur ouvrant", formula: "(L - 2*dd - (n-1)*dm) / n" },
      { key: "ho", label: "Hauteur ouvrant", formula: door ? "H - dd - if(seuil, dd, 5)" : "H - 2*dd" },
      { key: "gw", label: "Largeur vitrage", formula: "wo - 2*dvo" },
      { key: "gh", label: "Hauteur vitrage", formula: "ho - 2*dvo" },
    ],
    components: [
      { role: "dormant_haut", label: "Dormant haut", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      door
        ? { role: "dormant_bas", label: "Seuil / dormant bas", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project", condition: "seuil" }
        : { role: "dormant_bas", label: "Dormant bas (appui)", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      { role: "dormant_v", label: "Dormant vertical", kind: "profile", qty: "2", length: "H", angle: "45/45", finish: "project" },
      { role: "ouvrant_h", label: "Ouvrant horizontal", kind: "profile", qty: "2*n", length: "wo", angle: "45/45", finish: "project" },
      { role: "ouvrant_v", label: "Ouvrant vertical", kind: "profile", qty: "2*n", length: "ho", angle: "45/45", finish: "project" },
      { role: "battement", label: "Profil de battement (2 vantaux)", kind: "profile", qty: "n - 1", length: "ho", angle: "90/90", finish: "project" },
      ...beads("n", "gw", "gh"),
      glassSubModel("n", "gw", "gh"),
      setting("n"),
      ...glazingGaskets("n", "gw", "gh"),
      { role: "joint_frappe", label: "Joint de frappe ouvrant", kind: "gasket", qty: "n", length: "2*(wo+ho)", finish: "none", waste: 5 },
      { role: "joint_central", label: "Joint central / de dormant", kind: "gasket", qty: "1", length: "2*(L+H)", finish: "none", waste: 5 },
      { role: "equerres_dormant", label: "Équerres dormant", kind: "accessory", qty: "4", finish: "none" },
      { role: "equerres_ouvrant", label: "Équerres ouvrant", kind: "accessory", qty: "4*n", finish: "none" },
      { role: "busettes", label: "Busettes / déflecteurs d'eau", kind: "accessory", qty: door ? "0" : "2", finish: "project" },
      ...hw,
      screwsLine("16 + 10*n"),
      siliconeLine(),
    ],
    labour: [{ workshop: "ALU", minutes: `${door ? 120 : 75} + 35*n` }],
    pricing: { mode: "cost_plus", coefficient: 1.8 },
  };
}

// ------------------------------------------------------------------
// FIXE
// ------------------------------------------------------------------
const fixed = {
  key: "fixe", family: "fixe", name: "Châssis fixe", name_en: "Fixed window",
  description: "Dormant 45°, parcloses, un vitrage.",
  drawing: { type: "fixed" },
  defaultWorkshop: "ALU",
  limits: { minL: 200, maxL: 4000, minH: 200, maxH: 4000 },
  parameters: [P.vitrage],
  variables: [V.dvf, V.pcl, V.cart],
  derived: [
    { key: "gw", label: "Largeur vitrage", formula: "L - 2*dvf" },
    { key: "gh", label: "Hauteur vitrage", formula: "H - 2*dvf" },
  ],
  components: [
    ...frame45(),
    ...beads("1", "gw", "gh"),
    glassSubModel("1", "gw", "gh"),
    setting("1"),
    ...glazingGaskets("1", "gw", "gh"),
    { role: "equerres_dormant", label: "Équerres dormant", kind: "accessory", qty: "4", finish: "none" },
    screwsLine("10"),
    siliconeLine(),
  ],
  labour: [{ workshop: "ALU", minutes: "40" }],
  pricing: { mode: "cost_plus", coefficient: 1.7 },
};

const fixedGrid = {
  key: "fixe_meneaux", family: "fixe", name: "Châssis fixe à meneaux / traverses", name_en: "Fixed frame with mullions/transoms",
  description: "Grille de nx × ny vitrages séparés par meneaux et traverses.",
  drawing: { type: "grid" },
  defaultWorkshop: "ALU",
  limits: { minL: 400, maxL: 8000, minH: 400, maxH: 4000 },
  parameters: [
    { key: "nx", label: "Nombre de colonnes", type: "number", default: 2, min: 1, max: 12 },
    { key: "ny", label: "Nombre de rangées", type: "number", default: 1, min: 1, max: 12 },
    P.vitrage,
  ],
  variables: [V.dvf, V.dt, V.pcl, V.cart],
  derived: [
    { key: "cw", label: "Largeur d'une case", formula: "(L - (nx-1)*dt) / nx" },
    { key: "ch", label: "Hauteur d'une case", formula: "(H - (ny-1)*dt) / ny" },
    { key: "gw", label: "Largeur vitrage", formula: "cw - 2*dvf + dt/2" },
    { key: "gh", label: "Hauteur vitrage", formula: "ch - 2*dvf + dt/2" },
  ],
  components: [
    ...frame45(),
    { role: "meneau", label: "Meneau (vertical)", kind: "profile", qty: "nx - 1", length: "H - dt", angle: "90/90", finish: "project" },
    { role: "traverse", label: "Traverse (horizontale)", kind: "profile", qty: "(ny - 1) * nx", length: "cw", angle: "90/90", finish: "project" },
    { role: "raccords", label: "Raccords meneau / traverse", kind: "accessory", qty: "2*(nx-1) + 2*(ny-1)*nx", finish: "none" },
    ...beads("nx*ny", "gw", "gh"),
    glassSubModel("nx*ny", "gw", "gh"),
    setting("nx*ny"),
    ...glazingGaskets("nx*ny", "gw", "gh"),
    { role: "equerres_dormant", label: "Équerres dormant", kind: "accessory", qty: "4", finish: "none" },
    screwsLine("10 + 4*nx*ny"),
    siliconeLine(),
  ],
  labour: [{ workshop: "ALU", minutes: "40 + 15*nx*ny" }],
  pricing: { mode: "cost_plus", coefficient: 1.7 },
};

// ------------------------------------------------------------------
// ENSEMBLES COMPOSÉS (a combination of other models of the company)
// ------------------------------------------------------------------
const combo = (key, name, en, parts, extra = []) => ({
  key, family: "compose", name, name_en: en,
  description: `${name}. Chaque partie est un autre modèle de votre catalogue (choisi sur la ligne), assemblé par profil d'accouplement.`,
  drawing: { type: "combo", parts: parts.map((p) => p.position) },
  defaultWorkshop: "ALU",
  limits: { minL: 400, maxL: 8000, minH: 400, maxH: 4000 },
  parameters: [
    ...parts.map((p) => ({ key: p.param, label: p.label, type: "model", family: p.family })),
    ...extra,
  ],
  variables: [{ key: "acc", label: "Épaisseur profil d'accouplement (mm)", value: 0 }, V.cart],
  derived: [],
  components: [
    ...parts.map((p) => ({ role: p.param, label: p.label, kind: "model", modelParam: p.param, qty: "1", width: p.width, height: p.height })),
    { role: "accouplement", label: "Profil d'accouplement / traverse de liaison", kind: "profile", qty: String(parts.length - 1), length: parts[0].position === "left" || parts[0].position === "center" ? "H" : "L", angle: "90/90", finish: "project" },
    siliconeLine(),
  ],
  labour: [{ workshop: "ALU", minutes: "20" }],
  pricing: { mode: "cost_plus", coefficient: 1.8 },
});

// ------------------------------------------------------------------
// PORTES spécifiques
// ------------------------------------------------------------------
function panelDoor({ key, name, en, n }) {
  return {
    key, family: "porte", name, name_en: en,
    description: `${name}. Remplissage vitré, plein (panneau) ou mixte avec soubassement.`,
    drawing: { type: "door", leaves: n },
    defaultWorkshop: "ALU",
    limits: { minL: 700, maxL: n * 1200, minH: 1800, maxH: 3000 },
    parameters: [{ ...P.n(n, n, n), fixed: true }, P.rempl, P.hs, P.vitrage, P.panneau, P.seuil, P.fp],
    variables: [V.dd, V.dm, V.dvo, V.pcl, V.dt, V.cart],
    derived: [
      { key: "wo", label: "Largeur ouvrant", formula: "(L - 2*dd - (n-1)*dm) / n" },
      { key: "ho", label: "Hauteur ouvrant", formula: "H - dd - if(seuil, dd, 5)" },
      { key: "iw", label: "Largeur remplissage", formula: "wo - 2*dvo" },
      { key: "hb", label: "Hauteur partie basse (pleine)", formula: "rempl == 1 ? ho - 2*dvo : (rempl == 2 ? hs - dvo - dt/2 : 0)" },
      { key: "hg", label: "Hauteur partie vitrée", formula: "rempl == 0 ? ho - 2*dvo : (rempl == 2 ? ho - hs - dvo - dt/2 : 0)" },
    ],
    components: [
      { role: "dormant_haut", label: "Dormant haut", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      { role: "seuil", label: "Seuil", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project", condition: "seuil" },
      { role: "dormant_v", label: "Dormant vertical", kind: "profile", qty: "2", length: "H", angle: "45/90", finish: "project" },
      { role: "ouvrant_h", label: "Ouvrant horizontal (haut + plinthe)", kind: "profile", qty: "2*n", length: "wo", angle: "45/45", finish: "project" },
      { role: "ouvrant_v", label: "Ouvrant vertical", kind: "profile", qty: "2*n", length: "ho", angle: "45/45", finish: "project" },
      { role: "traverse_inter", label: "Traverse intermédiaire (soubassement)", kind: "profile", qty: "n * (rempl == 2)", length: "wo - 2*dvo", angle: "90/90", finish: "project" },
      { role: "battement", label: "Profil de battement", kind: "profile", qty: "n - 1", length: "ho", angle: "90/90", finish: "project" },
      { role: "parclose_h", label: "Parclose horizontale", kind: "profile", qty: "2*n*((rempl != 1) + (rempl != 0))", length: "iw + pcl", angle: "90/90", finish: "project" },
      { role: "parclose_v", label: "Parclose verticale", kind: "profile", qty: "2*n", length: "hb + hg + pcl", angle: "90/90", finish: "project" },
      { role: "vitrage", label: "Vitrage", kind: "model", modelParam: "vitrage", qty: "n * (rempl != 1)", width: "iw", height: "hg", workshop: "VIT" },
      { role: "panneau", label: "Panneau plein", kind: "model", modelParam: "panneau", qty: "n * (rempl != 0)", width: "iw", height: "hb" },
      setting("n"),
      { role: "joint_vitrage", label: "Joint de vitrage / remplissage", kind: "gasket", qty: "2*n", length: "2*iw + 2*(hb + hg)", finish: "none", waste: 5 },
      { role: "joint_frappe", label: "Joint de frappe", kind: "gasket", qty: "n", length: "2*(wo+ho)", finish: "none", waste: 5 },
      { role: "plinthe_auto", label: "Plinthe / balai bas de porte", kind: "accessory", qty: "n * (1 - seuil)", finish: "none" },
      { role: "paumelles", label: "Paumelles de porte", kind: "accessory", qty: "n * if(ho > 2100, 4, 3)", finish: "project" },
      { role: "serrure", label: "Serrure", kind: "accessory", qty: "1", finish: "none" },
      { role: "cylindre", label: "Cylindre", kind: "accessory", qty: "1", finish: "none" },
      { role: "bequille", label: "Béquilles / poignée tirage", kind: "accessory", qty: "1", finish: "project" },
      { role: "verrous", label: "Verrous semi-fixe", kind: "accessory", qty: "2*(n-1)", finish: "none" },
      { role: "ferme_porte", label: "Ferme-porte", kind: "accessory", qty: "n", finish: "project", condition: "fp" },
      { role: "equerres", label: "Équerres (dormant + ouvrants)", kind: "accessory", qty: "4 + 4*n", finish: "none" },
      screwsLine("20 + 12*n"),
      siliconeLine("(2*H + L)"),
    ],
    labour: [{ workshop: "ALU", minutes: "120 + 45*n" }],
    pricing: { mode: "cost_plus", coefficient: 1.8 },
  };
}

const doors = [
  panelDoor({ key: "porte_1v", name: "Porte battante 1 vantail", en: "Hinged door, 1 leaf", n: 1 }),
  panelDoor({ key: "porte_2v", name: "Porte battante 2 vantaux", en: "Hinged door, 2 leaves", n: 2 }),
  {
    key: "porte_entree_pleine", family: "porte", name: "Porte d'entrée pleine (tôle + isolant)", name_en: "Solid entrance door",
    description: "Ouvrant plein : tôle extérieure, âme isolante / MDF, tôle intérieure (surfaces en m²).",
    drawing: { type: "door", leaves: 1, solid: true },
    defaultWorkshop: "ALU",
    limits: { minL: 800, maxL: 1400, minH: 1900, maxH: 2800 },
    parameters: [P.seuil, P.fp],
    variables: [V.dd, { key: "dp", label: "Déduction panneau par côté (mm)", value: 60 }, V.cart],
    derived: [
      { key: "wo", label: "Largeur ouvrant", formula: "L - 2*dd" },
      { key: "ho", label: "Hauteur ouvrant", formula: "H - dd - if(seuil, dd, 5)" },
      { key: "pw", label: "Largeur panneau", formula: "wo - 2*dp" },
      { key: "ph", label: "Hauteur panneau", formula: "ho - 2*dp" },
    ],
    components: [
      { role: "dormant_haut", label: "Dormant haut", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      { role: "seuil", label: "Seuil", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project", condition: "seuil" },
      { role: "dormant_v", label: "Dormant vertical", kind: "profile", qty: "2", length: "H", angle: "45/90", finish: "project" },
      { role: "ouvrant_h", label: "Ouvrant horizontal", kind: "profile", qty: "2", length: "wo", angle: "45/45", finish: "project" },
      { role: "ouvrant_v", label: "Ouvrant vertical", kind: "profile", qty: "2", length: "ho", angle: "45/45", finish: "project" },
      { role: "tole_ext", label: "Tôle / panneau décoratif extérieur", kind: "panel", qty: "1", width: "pw", height: "ph", finish: "project", waste: 10 },
      { role: "ame", label: "Âme isolante / MDF", kind: "panel", qty: "1", width: "pw", height: "ph", finish: "none", waste: 10 },
      { role: "tole_int", label: "Tôle / panneau intérieur", kind: "panel", qty: "1", width: "pw", height: "ph", finish: "project", waste: 10 },
      { role: "colle", label: "Colle / mastic de collage (kg)", kind: "consumable", qty: "pw*ph/1e6 * 0.4", finish: "none" },
      { role: "joint_frappe", label: "Joint de frappe", kind: "gasket", qty: "1", length: "2*(wo+ho)", finish: "none", waste: 5 },
      { role: "paumelles", label: "Paumelles / charnières invisibles", kind: "accessory", qty: "if(ho > 2100, 4, 3)", finish: "project" },
      { role: "serrure", label: "Serrure multipoints", kind: "accessory", qty: "1", finish: "none" },
      { role: "cylindre", label: "Cylindre de sécurité", kind: "accessory", qty: "1", finish: "none" },
      { role: "poignee", label: "Barre de tirage / béquille", kind: "accessory", qty: "1", finish: "project" },
      { role: "ferme_porte", label: "Ferme-porte", kind: "accessory", qty: "1", finish: "project", condition: "fp" },
      { role: "equerres", label: "Équerres", kind: "accessory", qty: "8", finish: "none" },
      screwsLine("30"),
      siliconeLine("(2*H + L)"),
    ],
    labour: [{ workshop: "ALU", minutes: "240" }],
    pricing: { mode: "cost_plus", coefficient: 1.9 },
  },
  {
    key: "porte_va_et_vient", family: "porte", name: "Porte va-et-vient", name_en: "Swing door (double action)",
    description: "Vantaux sur pivots de sol avec ferme-porte encastré.",
    drawing: { type: "door", leaves: 2 },
    defaultWorkshop: "ALU",
    limits: { minL: 800, maxL: 2400, minH: 1900, maxH: 3000 },
    parameters: [P.n(2, 1, 2), P.vitrage],
    variables: [V.dd, V.dm, V.dvo, V.pcl, V.cart],
    derived: [
      { key: "wo", formula: "(L - 2*dd - (n-1)*dm) / n" },
      { key: "ho", formula: "H - dd - 10" },
      { key: "gw", formula: "wo - 2*dvo" },
      { key: "gh", formula: "ho - 2*dvo" },
    ],
    components: [
      { role: "dormant_haut", label: "Dormant haut", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      { role: "dormant_v", label: "Dormant vertical", kind: "profile", qty: "2", length: "H", angle: "45/90", finish: "project" },
      { role: "ouvrant_h", label: "Ouvrant horizontal", kind: "profile", qty: "2*n", length: "wo", angle: "45/45", finish: "project" },
      { role: "ouvrant_v", label: "Ouvrant vertical", kind: "profile", qty: "2*n", length: "ho", angle: "45/45", finish: "project" },
      ...beads("n", "gw", "gh"),
      glassSubModel("n", "gw", "gh"),
      setting("n"),
      ...glazingGaskets("n", "gw", "gh"),
      { role: "pivot_sol", label: "Pivot de sol / ferme-porte au sol", kind: "accessory", qty: "n", finish: "none" },
      { role: "pivot_haut", label: "Pivot haut", kind: "accessory", qty: "n", finish: "none" },
      { role: "poignee", label: "Poignée de tirage / plaque de poussée", kind: "accessory", qty: "n", finish: "project" },
      { role: "equerres", label: "Équerres", kind: "accessory", qty: "4 + 4*n", finish: "none" },
      screwsLine("16 + 10*n"),
      siliconeLine("(2*H + L)"),
    ],
    labour: [{ workshop: "ALU", minutes: "150 + 40*n" }],
    pricing: { mode: "cost_plus", coefficient: 1.8 },
  },
  {
    key: "porte_pliante", family: "porte", name: "Porte / baie pliante (accordéon)", name_en: "Bi-fold / folding door",
    description: "n vantaux articulés sur rail haut et chariots.",
    drawing: { type: "folding" },
    defaultWorkshop: "ALU",
    limits: { minL: 1500, maxL: 8000, minH: 1800, maxH: 3000 },
    parameters: [P.n(4, 2, 10), P.vitrage, P.seuil],
    variables: [V.dd, { key: "jp", label: "Jeu entre vantaux pliants (mm)", value: 6 }, V.dvo, V.pcl, V.cart],
    derived: [
      { key: "wo", formula: "(L - 2*dd - (n-1)*jp) / n" },
      { key: "ho", formula: "H - dd - if(seuil, dd, 10)" },
      { key: "gw", formula: "wo - 2*dvo" },
      { key: "gh", formula: "ho - 2*dvo" },
    ],
    components: [
      { role: "rail_haut", label: "Rail haut de roulement", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      { role: "rail_bas", label: "Rail / seuil bas de guidage", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project", condition: "seuil" },
      { role: "dormant_v", label: "Dormant vertical", kind: "profile", qty: "2", length: "H", angle: "45/45", finish: "project" },
      { role: "ouvrant_h", label: "Ouvrant horizontal", kind: "profile", qty: "2*n", length: "wo", angle: "45/45", finish: "project" },
      { role: "ouvrant_v", label: "Ouvrant vertical", kind: "profile", qty: "2*n", length: "ho", angle: "45/45", finish: "project" },
      ...beads("n", "gw", "gh"),
      glassSubModel("n", "gw", "gh"),
      setting("n"),
      ...glazingGaskets("n", "gw", "gh"),
      { role: "chariots", label: "Chariots de roulement", kind: "accessory", qty: "ceil(n/2) * 2", finish: "none" },
      { role: "charnieres", label: "Charnières entre vantaux", kind: "accessory", qty: "(n-1) * 3", finish: "project" },
      { role: "fermeture", label: "Poignée / fermeture", kind: "accessory", qty: "ceil(n/2)", finish: "project" },
      { role: "equerres", label: "Équerres", kind: "accessory", qty: "4 + 4*n", finish: "none" },
      screwsLine("20 + 12*n"),
      siliconeLine(),
    ],
    labour: [{ workshop: "ALU", minutes: "120 + 45*n" }],
    pricing: { mode: "cost_plus", coefficient: 1.9 },
  },
  {
    key: "porte_service_tolee", family: "porte", name: "Porte de service / technique tôlée", name_en: "Sheet-metal service door",
    description: "Cadre aluminium, tôle 2 faces, raidisseurs.",
    drawing: { type: "door", leaves: 1, solid: true },
    defaultWorkshop: "ALU",
    limits: { minL: 600, maxL: 2400, minH: 1800, maxH: 3000 },
    parameters: [P.n(1, 1, 2)],
    variables: [V.dd, V.dm, { key: "rd", label: "Un raidisseur tous les (mm)", value: 600 }, V.cart],
    derived: [
      { key: "wo", formula: "(L - 2*dd - (n-1)*dm) / n" },
      { key: "ho", formula: "H - dd - 10" },
    ],
    components: [
      { role: "dormant_haut", label: "Cadre haut", kind: "profile", qty: "1", length: "L", angle: "45/45", finish: "project" },
      { role: "dormant_v", label: "Cadre vertical", kind: "profile", qty: "2", length: "H", angle: "45/90", finish: "project" },
      { role: "ouvrant_h", label: "Ouvrant horizontal", kind: "profile", qty: "2*n", length: "wo", angle: "45/45", finish: "project" },
      { role: "ouvrant_v", label: "Ouvrant vertical", kind: "profile", qty: "2*n", length: "ho", angle: "45/45", finish: "project" },
      { role: "raidisseur", label: "Raidisseur", kind: "profile", qty: "n * floor(ho / rd)", length: "wo - 40", angle: "90/90", finish: "raw" },
      { role: "tole", label: "Tôle (2 faces)", kind: "panel", qty: "2*n", width: "wo", height: "ho", finish: "project", waste: 8 },
      { role: "paumelles", label: "Paumelles", kind: "accessory", qty: "3*n", finish: "project" },
      { role: "serrure", label: "Serrure", kind: "accessory", qty: "1", finish: "none" },
      { role: "bequille", label: "Béquilles", kind: "accessory", qty: "1", finish: "none" },
      { role: "rivets", label: "Rivets (pièces)", kind: "accessory", qty: "n * ceil(2*(wo+ho)/150) * 2", finish: "none" },
      siliconeLine("(2*H + L)"),
    ],
    labour: [{ workshop: "ALU", minutes: "150 + 60*n" }],
    pricing: { mode: "cost_plus", coefficient: 1.7 },
  },
  {
    key: "porte_garage_basculante", family: "porte", name: "Porte de garage basculante", name_en: "Up-and-over garage door",
    description: "Cadre, panneau tôle ou lames, kit de basculement à ressorts / contrepoids.",
    drawing: { type: "garage" },
    defaultWorkshop: "ALU",
    limits: { minL: 2000, maxL: 5000, minH: 1900, maxH: 3000 },
    parameters: [{ key: "mot", label: "Motorisation", type: "boolean", default: 0 }],
    variables: [{ key: "rd", label: "Un raidisseur tous les (mm)", value: 500 }, V.cart],
    derived: [],
    components: [
      { role: "cadre_h", label: "Cadre horizontal", kind: "profile", qty: "2", length: "L", angle: "45/45", finish: "project" },
      { role: "cadre_v", label: "Cadre vertical", kind: "profile", qty: "2", length: "H", angle: "45/45", finish: "project" },
      { role: "raidisseur", label: "Raidisseur", kind: "profile", qty: "floor(H / rd)", length: "L - 80", angle: "90/90", finish: "raw" },
      { role: "tole", label: "Tôle / lames de remplissage", kind: "panel", qty: "1", width: "L", height: "H", finish: "project", waste: 8 },
      { role: "kit_basculant", label: "Kit de basculement (rails, ressorts, bras)", kind: "accessory", qty: "1", finish: "none" },
      { role: "moteur", label: "Motorisation", kind: "accessory", qty: "1", finish: "none", condition: "mot" },
      { role: "serrure", label: "Serrure / poignée", kind: "accessory", qty: "1", finish: "none" },
      { role: "rivets", label: "Rivets", kind: "accessory", qty: "ceil(2*(L+H)/150)*2", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "300" }],
    pricing: { mode: "cost_plus", coefficient: 1.7 },
  },
  {
    key: "porte_auto_coulissante", family: "porte", name: "Porte automatique coulissante", name_en: "Automatic sliding door",
    description: "Opérateur automatique, vantaux mobiles et fixes latéraux.",
    drawing: { type: "sliding", leaves: 2 },
    defaultWorkshop: "ALU",
    limits: { minL: 1800, maxL: 5000, minH: 2000, maxH: 3000 },
    parameters: [{ key: "nm", label: "Vantaux mobiles", type: "number", default: 2, min: 1, max: 2 }, P.vitrage],
    variables: [{ key: "hop", label: "Hauteur du caisson opérateur (mm)", value: 150 }, V.dvo, V.cart],
    derived: [
      { key: "wo", formula: "L / 4 + 30" },
      { key: "ho", formula: "H - hop - 20" },
      { key: "gw", formula: "wo - 2*dvo" },
      { key: "gh", formula: "ho - 2*dvo" },
    ],
    components: [
      { role: "caisson", label: "Caisson / poutre opérateur", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      { role: "ouvrant_h", label: "Vantail horizontal", kind: "profile", qty: "2*4", length: "wo", angle: "45/45", finish: "project" },
      { role: "ouvrant_v", label: "Vantail vertical", kind: "profile", qty: "2*4", length: "ho", angle: "45/45", finish: "project" },
      glassSubModel("4", "gw", "gh"),
      setting("4"),
      ...glazingGaskets("4", "gw", "gh"),
      { role: "operateur", label: "Opérateur automatique (kit)", kind: "accessory", qty: "1", finish: "none" },
      { role: "radar", label: "Radars / cellules", kind: "accessory", qty: "2", finish: "none" },
      { role: "guides_sol", label: "Guides au sol", kind: "accessory", qty: "nm", finish: "none" },
      screwsLine("40"),
      siliconeLine(),
    ],
    labour: [{ workshop: "ALU", minutes: "480" }],
    pricing: { mode: "cost_plus", coefficient: 1.6 },
  },
];

// ------------------------------------------------------------------
// FAÇADES & VERRIÈRES
// ------------------------------------------------------------------
const facades = [
  {
    key: "mur_rideau", family: "facade", name: "Mur rideau (grille VEC / capot serreur)", name_en: "Curtain wall",
    description: "Montants et traverses sur trame nx × ny, capots, presseurs, pattes de fixation.",
    drawing: { type: "grid" },
    defaultWorkshop: "ALU",
    limits: { minL: 1000, maxL: 50000, minH: 1000, maxH: 30000 },
    parameters: [
      { key: "nx", label: "Nombre de trames horizontales", type: "number", default: 4, min: 1, max: 60 },
      { key: "ny", label: "Nombre de trames verticales", type: "number", default: 3, min: 1, max: 40 },
      P.vitrage,
    ],
    variables: [
      { key: "fm", label: "Largeur vue montant (mm)", value: 52 },
      { key: "dg", label: "Prise en feuillure vitrage par côté (mm)", value: 15 },
      { key: "pf", label: "Une patte de fixation tous les (mm)", value: 3000 },
      V.cart,
    ],
    derived: [
      { key: "tw", label: "Largeur trame", formula: "L / nx" },
      { key: "th", label: "Hauteur trame", formula: "H / ny" },
      { key: "gw", label: "Largeur vitrage", formula: "tw - fm + 2*dg" },
      { key: "gh", label: "Hauteur vitrage", formula: "th - fm + 2*dg" },
    ],
    components: [
      { role: "montant", label: "Montant", kind: "profile", qty: "nx + 1", length: "H", angle: "90/90", finish: "project" },
      { role: "traverse", label: "Traverse", kind: "profile", qty: "nx * (ny + 1)", length: "tw - fm", angle: "90/90", finish: "project" },
      { role: "presseur_v", label: "Presseur vertical", kind: "profile", qty: "nx + 1", length: "H", angle: "90/90", finish: "raw" },
      { role: "presseur_h", label: "Presseur horizontal", kind: "profile", qty: "nx * (ny + 1)", length: "tw - fm", angle: "90/90", finish: "raw" },
      { role: "capot_v", label: "Capot vertical", kind: "profile", qty: "nx + 1", length: "H", angle: "90/90", finish: "project" },
      { role: "capot_h", label: "Capot horizontal", kind: "profile", qty: "nx * (ny + 1)", length: "tw - fm", angle: "90/90", finish: "project" },
      glassSubModel("nx*ny", "gw", "gh"),
      setting("nx*ny"),
      { role: "joint_int", label: "Joint intérieur (montants + traverses)", kind: "gasket", qty: "1", length: "2*((nx+1)*H + nx*(ny+1)*(tw-fm))", finish: "none", waste: 5 },
      { role: "joint_ext", label: "Joint extérieur (presseurs)", kind: "gasket", qty: "1", length: "2*((nx+1)*H + nx*(ny+1)*(tw-fm))", finish: "none", waste: 5 },
      { role: "eclisses", label: "Éclisses / raccords traverse", kind: "accessory", qty: "2 * nx * (ny + 1)", finish: "none" },
      { role: "pattes", label: "Pattes de fixation", kind: "accessory", qty: "(nx + 1) * (ceil(H / pf) + 1)", finish: "none" },
      { role: "vis_presseur", label: "Vis de presseur", kind: "accessory", qty: "ceil(((nx+1)*H + nx*(ny+1)*tw) / 250)", finish: "none" },
      siliconeLine("2*(L+H)"),
    ],
    labour: [{ workshop: "ALU", minutes: "60 * nx * ny / 2 + 120" }],
    pricing: { mode: "per_m2", coefficient: 1.6, pricePerM2: 0, minArea: 1 },
  },
  {
    key: "verriere", family: "facade", name: "Verrière (atelier / intérieure)", name_en: "Glazed partition (atelier style)",
    description: "Cadre fin, petits bois verticaux et horizontaux.",
    drawing: { type: "grid" },
    defaultWorkshop: "ALU",
    limits: { minL: 400, maxL: 10000, minH: 300, maxH: 3500 },
    parameters: [
      { key: "nx", label: "Carreaux en largeur", type: "number", default: 4, min: 1, max: 30 },
      { key: "ny", label: "Carreaux en hauteur", type: "number", default: 2, min: 1, max: 20 },
      P.vitrage,
    ],
    variables: [{ key: "pb", label: "Largeur petit bois (mm)", value: 30 }, { key: "fc", label: "Largeur cadre (mm)", value: 40 }, V.pcl],
    derived: [
      { key: "gw", formula: "(L - 2*fc - (nx-1)*pb) / nx" },
      { key: "gh", formula: "(H - 2*fc - (ny-1)*pb) / ny" },
    ],
    components: [
      ...frame45("cadre", "Cadre"),
      { role: "petit_bois_v", label: "Petit bois vertical", kind: "profile", qty: "nx - 1", length: "H - 2*fc", angle: "90/90", finish: "project" },
      { role: "petit_bois_h", label: "Petit bois horizontal", kind: "profile", qty: "(ny - 1) * nx", length: "gw", angle: "90/90", finish: "project" },
      ...beads("nx*ny", "gw", "gh"),
      glassSubModel("nx*ny", "gw", "gh"),
      { role: "joint", label: "Joint de vitrage", kind: "gasket", qty: "nx*ny", length: "2*(gw+gh)", finish: "none", waste: 5 },
      screwsLine("8 + 4*nx*ny"),
    ],
    labour: [{ workshop: "ALU", minutes: "60 + 10*nx*ny" }],
    pricing: { mode: "per_m2", coefficient: 1.7, pricePerM2: 0, minArea: 1 },
  },
  {
    key: "verriere_toiture", family: "facade", name: "Verrière de toiture / puits de lumière", name_en: "Glass roof / skylight",
    description: "Chevrons et pannes en pente, capots, vitrage feuilleté.",
    drawing: { type: "grid" },
    defaultWorkshop: "ALU",
    limits: { minL: 800, maxL: 20000, minH: 800, maxH: 15000 },
    parameters: [
      { key: "nx", label: "Nombre de travées", type: "number", default: 3, min: 1, max: 40 },
      { key: "pente", label: "Pente (°)", type: "number", default: 10, min: 2, max: 60, unit: "°" },
      P.vitrage,
    ],
    variables: [{ key: "fm", label: "Largeur vue chevron (mm)", value: 60 }, { key: "dg", label: "Prise en feuillure (mm)", value: 15 }, V.cart],
    derived: [
      { key: "rl", label: "Longueur rampant", formula: "H / cos(pente)" },
      { key: "tw", formula: "L / nx" },
      { key: "gw", formula: "tw - fm + 2*dg" },
      { key: "gh", formula: "rl - fm + 2*dg" },
    ],
    components: [
      { role: "chevron", label: "Chevron", kind: "profile", qty: "nx + 1", length: "rl", angle: "90/90", finish: "project" },
      { role: "panne", label: "Panne / sablière", kind: "profile", qty: "2", length: "L", angle: "90/90", finish: "project" },
      { role: "capot", label: "Capot de chevron", kind: "profile", qty: "nx + 1", length: "rl", angle: "90/90", finish: "project" },
      glassSubModel("nx", "gw", "gh"),
      setting("nx"),
      { role: "joint", label: "Joints (haut + bas)", kind: "gasket", qty: "2", length: "2*(nx+1)*rl", finish: "none", waste: 5 },
      { role: "butees", label: "Butées anti-glissement du vitrage", kind: "accessory", qty: "2*nx", finish: "none" },
      siliconeLine("2*(L+H)"),
    ],
    labour: [{ workshop: "ALU", minutes: "120 + 60*nx" }],
    pricing: { mode: "per_m2", coefficient: 1.6, pricePerM2: 0, minArea: 1 },
  },
  {
    key: "cloison_vitree", family: "facade", name: "Cloison vitrée de bureau", name_en: "Glass office partition",
    description: "Rail haut, rail bas, profils de jonction, vitrages toute hauteur.",
    drawing: { type: "grid" },
    defaultWorkshop: "ALU",
    limits: { minL: 800, maxL: 30000, minH: 2000, maxH: 4000 },
    parameters: [{ key: "lv", label: "Largeur max d'un vitrage (mm)", type: "number", default: 1200, min: 500, max: 3000 }, P.vitrage],
    variables: [{ key: "dr", label: "Déduction hauteur vitrage (mm)", value: 60 }, { key: "jv", label: "Joint entre vitrages (mm)", value: 3 }],
    derived: [
      { key: "nv", label: "Nombre de vitrages", formula: "ceil(L / lv)" },
      { key: "gw", formula: "(L - (nv-1)*jv) / nv" },
      { key: "gh", formula: "H - dr" },
    ],
    components: [
      { role: "rail_haut", label: "Rail haut", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      { role: "rail_bas", label: "Rail bas", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      { role: "profil_mural", label: "Profil de départ mural", kind: "profile", qty: "2", length: "H", angle: "90/90", finish: "project" },
      glassSubModel("nv", "gw", "gh"),
      { role: "jonction", label: "Joint / profil de jonction verre-verre", kind: "gasket", qty: "nv - 1", length: "gh", finish: "none", waste: 5 },
      { role: "joint_rail", label: "Joint de rail", kind: "gasket", qty: "4", length: "L", finish: "none", waste: 5 },
      screwsLine("ceil(L/400)*2"),
    ],
    labour: [{ workshop: "ALU", minutes: "30 + 20*ceil(L/1000)" }],
    pricing: { mode: "per_m2", coefficient: 1.6, pricePerM2: 0, minArea: 2 },
  },
  {
    key: "vitrine", family: "facade", name: "Vitrine / devanture de magasin", name_en: "Shopfront",
    description: "Fixe(s) + porte d'accès — composé de modèles de votre catalogue.",
    drawing: { type: "combo", parts: ["left", "center", "right"] },
    defaultWorkshop: "ALU",
    limits: { minL: 1500, maxL: 20000, minH: 2000, maxH: 5000 },
    parameters: [
      { key: "lp", label: "Largeur porte (mm)", type: "number", default: 1000, min: 700, max: 2400, unit: "mm" },
      { key: "porte", label: "Modèle de porte", type: "model", family: "porte" },
      { key: "fixe", label: "Modèle de fixe", type: "model", family: "fixe" },
    ],
    variables: [V.cart],
    derived: [{ key: "lf", label: "Largeur de chaque fixe", formula: "(L - lp) / 2" }],
    components: [
      { role: "porte", label: "Porte", kind: "model", modelParam: "porte", qty: "1", width: "lp", height: "H" },
      { role: "fixes", label: "Fixes latéraux", kind: "model", modelParam: "fixe", qty: "2", width: "lf", height: "H" },
      { role: "accouplement", label: "Profil d'accouplement", kind: "profile", qty: "2", length: "H", angle: "90/90", finish: "project" },
      siliconeLine(),
    ],
    labour: [{ workshop: "ALU", minutes: "60" }],
    pricing: { mode: "cost_plus", coefficient: 1.7 },
  },
];

// ------------------------------------------------------------------
// FERMETURES
// ------------------------------------------------------------------
const closures = [
  {
    key: "volet_roulant", family: "fermeture", name: "Volet roulant", name_en: "Roller shutter",
    description: "Lames aluminium, coulisses, coffre, axe, manœuvre (sangle, manivelle ou moteur).",
    drawing: { type: "shutter" },
    defaultWorkshop: "ALU",
    limits: { minL: 400, maxL: 4500, minH: 400, maxH: 3500 },
    parameters: [
      { key: "man", label: "Manœuvre", type: "choice", default: 0, options: [{ value: 0, label: "Sangle" }, { value: 1, label: "Manivelle" }, { value: 2, label: "Moteur filaire" }, { value: 3, label: "Moteur radio" }] },
      { key: "coffre", label: "Coffre", type: "boolean", default: 1 },
    ],
    variables: [
      { key: "pas", label: "Pas d'une lame (hauteur utile, mm)", value: 39 },
      { key: "hc", label: "Hauteur du coffre (mm)", value: 165 },
      { key: "jc", label: "Jeu lame / coulisse (total, mm)", value: 44 },
      { key: "ea", label: "Déduction axe (mm)", value: 60 },
    ],
    derived: [
      { key: "hl", label: "Hauteur tablier", formula: "H - coffre*hc + 150" },
      { key: "nl", label: "Nombre de lames", formula: "ceil(hl / pas)" },
    ],
    components: [
      { role: "lames", label: "Lames", kind: "profile", qty: "nl", length: "L - jc", angle: "90/90", finish: "project" },
      { role: "lame_finale", label: "Lame finale", kind: "profile", qty: "1", length: "L - jc", angle: "90/90", finish: "project" },
      { role: "coulisses", label: "Coulisses", kind: "profile", qty: "2", length: "H - coffre*hc", angle: "90/90", finish: "project" },
      { role: "coffre", label: "Coffre (face + joues)", kind: "profile", qty: "coffre", length: "L", angle: "90/90", finish: "project" },
      { role: "flasques", label: "Flasques / joues de coffre", kind: "accessory", qty: "2*coffre", finish: "project" },
      { role: "axe", label: "Axe / tube octogonal", kind: "profile", qty: "1", length: "L - ea", angle: "90/90", finish: "raw" },
      { role: "embouts_lames", label: "Embouts / verrous de lames", kind: "accessory", qty: "2*nl", finish: "none" },
      { role: "attaches", label: "Attaches tablier", kind: "accessory", qty: "if(L > 1500, 3, 2)", finish: "none" },
      { role: "butees", label: "Butées de lame finale", kind: "accessory", qty: "2", finish: "none" },
      { role: "joint_coulisse", label: "Joint brosse de coulisse", kind: "gasket", qty: "2", length: "2*(H - coffre*hc)", finish: "none", waste: 5 },
      { role: "kit_sangle", label: "Kit sangle (enrouleur + poulie)", kind: "accessory", qty: "man == 0", finish: "none" },
      { role: "kit_manivelle", label: "Kit manivelle (treuil + genouillère)", kind: "accessory", qty: "man == 1", finish: "none" },
      { role: "moteur", label: "Moteur tubulaire", kind: "accessory", qty: "man >= 2", finish: "none" },
      { role: "inverseur", label: "Inverseur / télécommande", kind: "accessory", qty: "man >= 2", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "45 + 15*(man>=2)" }],
    pricing: { mode: "per_m2", coefficient: 1.7, pricePerM2: 0, minArea: 1.2 },
  },
  {
    key: "persienne", family: "fermeture", name: "Persienne / volet battant à lames", name_en: "Louvred hinged shutter",
    description: "Cadre, lames fixes ou orientables, paumelles, espagnolette.",
    drawing: { type: "louvre" },
    defaultWorkshop: "ALU",
    limits: { minL: 400, maxL: 3000, minH: 400, maxH: 3000 },
    parameters: [P.n(2, 1, 4), { key: "orient", label: "Lames orientables", type: "boolean", default: 0 }],
    variables: [{ key: "dd", label: "Jeu vantail (mm)", value: 6 }, { key: "pas", label: "Pas des lames (mm)", value: 70 }, { key: "fc", label: "Largeur cadre vantail (mm)", value: 55 }],
    derived: [
      { key: "wo", formula: "(L - (n+1)*dd) / n" },
      { key: "ho", formula: "H - 2*dd" },
      { key: "nl", label: "Lames par vantail", formula: "ceil((ho - 2*fc) / pas)" },
    ],
    components: [
      { role: "cadre_h", label: "Cadre vantail horizontal", kind: "profile", qty: "2*n", length: "wo", angle: "45/45", finish: "project" },
      { role: "cadre_v", label: "Cadre vantail vertical", kind: "profile", qty: "2*n", length: "ho", angle: "45/45", finish: "project" },
      { role: "lames", label: "Lames", kind: "profile", qty: "n*nl", length: "wo - 2*fc + 10", angle: "90/90", finish: "project" },
      { role: "embouts", label: "Embouts / pivots de lames", kind: "accessory", qty: "2*n*nl", finish: "none" },
      { role: "tringle", label: "Tringle d'orientation", kind: "profile", qty: "n*orient", length: "ho - 2*fc", angle: "90/90", finish: "project" },
      { role: "paumelles", label: "Paumelles / pentures", kind: "accessory", qty: "n * if(ho > 1400, 3, 2)", finish: "project" },
      { role: "espagnolette", label: "Espagnolette / arrêts", kind: "accessory", qty: "1", finish: "project" },
      { role: "equerres", label: "Équerres", kind: "accessory", qty: "4*n", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "40 + 30*n" }],
    pricing: { mode: "cost_plus", coefficient: 1.8 },
  },
  {
    key: "jalousie", family: "fermeture", name: "Jalousie (lames de verre orientables)", name_en: "Glass louvre window",
    description: "Cadre, mécanisme porte-lames, lames de verre.",
    drawing: { type: "louvre" },
    defaultWorkshop: "ALU",
    limits: { minL: 300, maxL: 1200, minH: 400, maxH: 2000 },
    parameters: [{ key: "verre", label: "Verre des lames", type: "product", materialType: "glass" }],
    variables: [{ key: "pas", label: "Pas des lames (mm)", value: 90 }, { key: "dl", label: "Déduction largeur lame (mm)", value: 40 }],
    derived: [{ key: "nl", formula: "ceil((H - 60) / pas)" }],
    components: [
      ...frame45("cadre", "Cadre"),
      { role: "mecanisme", label: "Mécanisme porte-lames (paire)", kind: "accessory", qty: "1", finish: "none" },
      { role: "lames_verre", label: "Lames de verre", kind: "glass", productParam: "verre", qty: "nl", width: "L - dl", height: "pas + 12", workshop: "VIT", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "45" }],
    pricing: { mode: "cost_plus", coefficient: 1.8 },
  },
  {
    key: "moustiquaire_fixe", family: "fermeture", name: "Moustiquaire fixe / cadre", name_en: "Fixed fly screen",
    description: "Cadre, toile, clips de fixation.",
    drawing: { type: "fixed" },
    defaultWorkshop: "ALU",
    limits: { minL: 200, maxL: 2000, minH: 200, maxH: 2500 },
    parameters: [],
    variables: [],
    derived: [],
    components: [
      ...frame45("cadre", "Cadre moustiquaire"),
      { role: "toile", label: "Toile", kind: "panel", qty: "1", width: "L", height: "H", finish: "none", waste: 10 },
      { role: "jonc", label: "Jonc de maintien", kind: "gasket", qty: "1", length: "2*(L+H)", finish: "none", waste: 5 },
      { role: "equerres", label: "Équerres", kind: "accessory", qty: "4", finish: "none" },
      { role: "clips", label: "Clips / pattes de fixation", kind: "accessory", qty: "4", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "20" }],
    pricing: { mode: "cost_plus", coefficient: 2 },
  },
  {
    key: "moustiquaire_enroulable", family: "fermeture", name: "Moustiquaire enroulable / plissée", name_en: "Roller / pleated fly screen",
    description: "Coffre, coulisses, barre de charge, toile.",
    drawing: { type: "shutter" },
    defaultWorkshop: "ALU",
    limits: { minL: 300, maxL: 2000, minH: 300, maxH: 2600 },
    parameters: [{ key: "sens", label: "Sens", type: "choice", default: 0, options: [{ value: 0, label: "Vertical" }, { value: 1, label: "Latéral" }] }],
    variables: [{ key: "dc", label: "Déduction coffre (mm)", value: 50 }],
    derived: [],
    components: [
      { role: "coffre", label: "Coffre", kind: "profile", qty: "1", length: "sens ? H : L", angle: "90/90", finish: "project" },
      { role: "coulisses", label: "Coulisses", kind: "profile", qty: "2", length: "sens ? L - dc : H - dc", angle: "90/90", finish: "project" },
      { role: "barre", label: "Barre de charge", kind: "profile", qty: "1", length: "sens ? H - 10 : L - 10", angle: "90/90", finish: "project" },
      { role: "toile", label: "Toile", kind: "panel", qty: "1", width: "L", height: "H", finish: "none", waste: 10 },
      { role: "kit", label: "Kit embouts / ressort / clips", kind: "accessory", qty: "1", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "30" }],
    pricing: { mode: "cost_plus", coefficient: 2 },
  },
];

// ------------------------------------------------------------------
// EXTÉRIEUR
// ------------------------------------------------------------------
const outdoor = [
  {
    key: "garde_corps_vitre", family: "exterieur", name: "Garde-corps vitré (poteaux + main courante)", name_en: "Glass balustrade",
    description: "L = longueur (mm), H = hauteur. Poteaux selon entraxe, verre feuilleté entre poteaux.",
    drawing: { type: "railing" },
    defaultWorkshop: "ALU",
    limits: { minL: 500, maxL: 100000, minH: 800, maxH: 1300 },
    parameters: [{ key: "ent", label: "Entraxe max des poteaux (mm)", type: "number", default: 1200, min: 400, max: 2000, unit: "mm" }, P.vitrage],
    variables: [{ key: "dp", label: "Largeur poteau (mm)", value: 50 }, { key: "dv", label: "Jeu vitrage / poteau (total, mm)", value: 30 }, { key: "hv", label: "Déduction hauteur vitrage (mm)", value: 200 }],
    derived: [
      { key: "np", label: "Nombre de travées", formula: "ceil(L / ent)" },
      { key: "gw", formula: "L / np - dp - dv" },
      { key: "gh", formula: "H - hv" },
    ],
    components: [
      { role: "poteaux", label: "Poteaux", kind: "profile", qty: "np + 1", length: "H - 40", angle: "90/90", finish: "project" },
      { role: "main_courante", label: "Main courante", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      { role: "lisse_basse", label: "Lisse basse", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      glassSubModel("np", "gw", "gh"),
      { role: "pinces", label: "Pinces à verre", kind: "accessory", qty: "4*np", finish: "project" },
      { role: "platines", label: "Platines / fixations de poteau", kind: "accessory", qty: "np + 1", finish: "project" },
      { role: "embouts", label: "Embouts de main courante", kind: "accessory", qty: "2", finish: "project" },
      { role: "chevilles", label: "Chevilles chimiques / scellements", kind: "consumable", qty: "4*(np+1)", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "30 + 20*np" }],
    pricing: { mode: "per_ml", coefficient: 1.7, pricePerMl: 0 },
  },
  {
    key: "garde_corps_barreaude", family: "exterieur", name: "Garde-corps barreaudé", name_en: "Balustrade with bars",
    description: "L = longueur, H = hauteur ; barreaux selon l'écartement maximal.",
    drawing: { type: "railing", bars: true },
    defaultWorkshop: "ALU",
    limits: { minL: 500, maxL: 100000, minH: 800, maxH: 1300 },
    parameters: [{ key: "ent", label: "Entraxe max des poteaux (mm)", type: "number", default: 1500, min: 400, max: 2500, unit: "mm" }],
    variables: [{ key: "eb", label: "Écartement max entre barreaux (mm)", value: 110 }, { key: "db", label: "Déduction hauteur barreau (mm)", value: 150 }],
    derived: [{ key: "np", formula: "ceil(L / ent)" }, { key: "nb", label: "Nombre de barreaux", formula: "ceil(L / eb)" }],
    components: [
      { role: "poteaux", label: "Poteaux", kind: "profile", qty: "np + 1", length: "H - 40", angle: "90/90", finish: "project" },
      { role: "main_courante", label: "Main courante", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      { role: "lisse_haute", label: "Lisse haute", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      { role: "lisse_basse", label: "Lisse basse", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      { role: "barreaux", label: "Barreaux", kind: "profile", qty: "nb", length: "H - db", angle: "90/90", finish: "project" },
      { role: "platines", label: "Platines", kind: "accessory", qty: "np + 1", finish: "project" },
      { role: "embouts", label: "Embouts / bouchons", kind: "accessory", qty: "2*nb + 2", finish: "none" },
      screwsLine("4*(np+1) + 2*nb"),
    ],
    labour: [{ workshop: "ALU", minutes: "30 + 20*np + 2*nb" }],
    pricing: { mode: "per_ml", coefficient: 1.7, pricePerMl: 0 },
  },
  {
    key: "pergola_bioclimatique", family: "exterieur", name: "Pergola bioclimatique (lames orientables)", name_en: "Bioclimatic pergola",
    description: "L = largeur, H = avancée (profondeur). Poteaux, poutres, lames orientables, motorisation.",
    drawing: { type: "pergola" },
    defaultWorkshop: "ALU",
    limits: { minL: 1500, maxL: 8000, minH: 1500, maxH: 7000 },
    parameters: [
      { key: "hp", label: "Hauteur de passage (mm)", type: "number", default: 2500, min: 2000, max: 3500, unit: "mm" },
      { key: "mot", label: "Motorisation", type: "boolean", default: 1 },
      { key: "led", label: "Éclairage LED", type: "boolean", default: 0 },
    ],
    variables: [{ key: "pas", label: "Pas des lames (mm)", value: 200 }, { key: "dl", label: "Déduction longueur lame (mm)", value: 180 }, { key: "pmax", label: "Portée max sans poteau intermédiaire (mm)", value: 4500 }],
    derived: [
      { key: "nl", label: "Nombre de lames", formula: "ceil(H / pas)" },
      { key: "npot", label: "Nombre de poteaux", formula: "2 * (ceil(L / pmax) + 1)" },
    ],
    components: [
      { role: "poteaux", label: "Poteaux", kind: "profile", qty: "npot", length: "hp", angle: "90/90", finish: "project" },
      { role: "poutre_l", label: "Poutre (largeur)", kind: "profile", qty: "2", length: "L", angle: "45/45", finish: "project" },
      { role: "poutre_h", label: "Poutre (avancée)", kind: "profile", qty: "2", length: "H", angle: "45/45", finish: "project" },
      { role: "lames", label: "Lames orientables", kind: "profile", qty: "nl", length: "L - dl", angle: "90/90", finish: "project" },
      { role: "embouts_lames", label: "Embouts / pivots de lames", kind: "accessory", qty: "2*nl", finish: "none" },
      { role: "bielle", label: "Bielle de manœuvre", kind: "profile", qty: "1", length: "H - 100", angle: "90/90", finish: "raw" },
      { role: "moteur", label: "Vérin / moteur", kind: "accessory", qty: "mot", finish: "none" },
      { role: "led", label: "Kit LED", kind: "accessory", qty: "led", finish: "none" },
      { role: "platines", label: "Platines de pied", kind: "accessory", qty: "npot", finish: "project" },
      { role: "gouttiere", label: "Descente d'eau / gouttière intégrée", kind: "accessory", qty: "2", finish: "none" },
      screwsLine("40 + 4*nl"),
    ],
    labour: [{ workshop: "ALU", minutes: "240 + 6*nl" }],
    pricing: { mode: "per_m2", coefficient: 1.6, pricePerM2: 0, minArea: 6 },
  },
  {
    key: "brise_soleil", family: "exterieur", name: "Brise-soleil à lames fixes", name_en: "Fixed brise-soleil",
    description: "Lames horizontales ou verticales entre deux supports.",
    drawing: { type: "louvre" },
    defaultWorkshop: "ALU",
    limits: { minL: 500, maxL: 20000, minH: 300, maxH: 10000 },
    parameters: [{ key: "sens", label: "Lames verticales", type: "boolean", default: 0 }],
    variables: [{ key: "pas", label: "Pas des lames (mm)", value: 150 }, { key: "sup", label: "Un support tous les (mm)", value: 1500 }],
    derived: [
      { key: "nl", formula: "ceil((sens ? L : H) / pas)" },
      { key: "ns", formula: "ceil((sens ? H : L) / sup) + 1" },
    ],
    components: [
      { role: "lames", label: "Lames", kind: "profile", qty: "nl", length: "sens ? H : L", angle: "90/90", finish: "project" },
      { role: "supports", label: "Supports / crémaillères", kind: "profile", qty: "ns", length: "sens ? L : H", angle: "90/90", finish: "project" },
      { role: "clips", label: "Clips de lame", kind: "accessory", qty: "nl * ns", finish: "none" },
      { role: "embouts", label: "Embouts", kind: "accessory", qty: "2*nl", finish: "project" },
    ],
    labour: [{ workshop: "ALU", minutes: "30 + 2*nl" }],
    pricing: { mode: "per_m2", coefficient: 1.6, pricePerM2: 0, minArea: 1 },
  },
  {
    key: "habillage_composite", family: "exterieur", name: "Habillage / bardage composite (ACP) ou tôle", name_en: "Composite / sheet cladding",
    description: "Surface L × H en panneaux, ossature en profils, rivets.",
    drawing: { type: "cladding" },
    defaultWorkshop: "ALU",
    limits: { minL: 200, maxL: 100000, minH: 200, maxH: 50000 },
    parameters: [],
    variables: [{ key: "oss", label: "Entraxe ossature (mm)", value: 600 }, { key: "riv", label: "Rivets par m²", value: 12 }],
    derived: [{ key: "no", formula: "ceil(L / oss) + 1" }],
    components: [
      { role: "panneau", label: "Panneau composite / tôle", kind: "panel", qty: "1", width: "L", height: "H", finish: "project", waste: 12 },
      { role: "ossature", label: "Ossature (profil oméga / cornière)", kind: "profile", qty: "no", length: "H", angle: "90/90", finish: "raw" },
      { role: "rivets", label: "Rivets", kind: "accessory", qty: "ceil(L*H/1e6 * riv)", finish: "project" },
      { role: "pattes", label: "Pattes de fixation", kind: "accessory", qty: "no * (ceil(H/1000) + 1)", finish: "none" },
      siliconeLine("2*(L+H)"),
    ],
    labour: [{ workshop: "ALU", minutes: "20 * L*H/1e6 + 30" }],
    pricing: { mode: "per_m2", coefficient: 1.5, pricePerM2: 0, minArea: 1 },
  },
  {
    key: "marquise", family: "exterieur", name: "Marquise / auvent vitré", name_en: "Glass canopy",
    description: "Consoles, profil mural, vitrage feuilleté.",
    drawing: { type: "generic" },
    defaultWorkshop: "ALU",
    limits: { minL: 800, maxL: 8000, minH: 600, maxH: 2000 },
    parameters: [{ key: "ec", label: "Entraxe max des consoles (mm)", type: "number", default: 1000, min: 500, max: 2000 }, P.vitrage],
    variables: [],
    derived: [{ key: "nc", formula: "ceil(L / ec) + 1" }],
    components: [
      { role: "profil_mural", label: "Profil mural", kind: "profile", qty: "1", length: "L", angle: "90/90", finish: "project" },
      { role: "consoles", label: "Consoles / tirants", kind: "accessory", qty: "nc", finish: "project" },
      glassSubModel("1", "L", "H"),
      { role: "joint", label: "Joint", kind: "gasket", qty: "1", length: "L", finish: "none", waste: 5 },
      { role: "chevilles", label: "Chevilles chimiques", kind: "consumable", qty: "2*nc + ceil(L/400)", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "90" }],
    pricing: { mode: "cost_plus", coefficient: 1.7 },
  },
];

// ------------------------------------------------------------------
// VITRAGES (L = largeur du verre, H = hauteur du verre, en mm)
// ------------------------------------------------------------------
const glassUnits = [
  {
    key: "simple_vitrage", family: "vitrage", name: "Simple vitrage", name_en: "Single glazing",
    description: "Un verre coupé à la cote (clair, feuilleté, trempé, imprimé…).",
    drawing: { type: "glass", layers: 1 },
    defaultWorkshop: "VIT",
    limits: { minL: 50, maxL: 6000, minH: 50, maxH: 3500 },
    parameters: [{ key: "verre", label: "Verre", type: "product", materialType: "glass" }],
    variables: [],
    derived: [],
    components: [
      { role: "verre", label: "Verre", kind: "glass", productParam: "verre", qty: "1", width: "L", height: "H", finish: "none" },
    ],
    labour: [{ workshop: "VIT", minutes: "5 + 5*L*H/1e6" }],
    pricing: { mode: "cost_plus", coefficient: 1.6 },
  },
  {
    key: "double_vitrage", family: "vitrage", name: "Double vitrage (ex. 4/16/4)", name_en: "Double glazing unit",
    description: "Deux verres, intercalaire, butyl, dessicant, mastic de scellement.",
    drawing: { type: "glass", layers: 2 },
    defaultWorkshop: "VIT",
    limits: { minL: 150, maxL: 5000, minH: 150, maxH: 3200 },
    parameters: [
      { key: "verre_ext", label: "Verre extérieur", type: "product", materialType: "glass" },
      { key: "verre_int", label: "Verre intérieur", type: "product", materialType: "glass" },
    ],
    variables: [
      { key: "ric", label: "Retrait intercalaire par côté (mm)", value: 6 },
      { key: "dkg", label: "Dessicant (kg par mètre d'intercalaire)", value: 0.03 },
      { key: "mkg", label: "Mastic de scellement (kg par mètre)", value: 0.05 },
    ],
    derived: [{ key: "per", label: "Périmètre intercalaire", formula: "2*((L - 2*ric) + (H - 2*ric))" }],
    components: [
      { role: "verre_ext", label: "Verre extérieur", kind: "glass", productParam: "verre_ext", qty: "1", width: "L", height: "H", finish: "none" },
      { role: "verre_int", label: "Verre intérieur", kind: "glass", productParam: "verre_int", qty: "1", width: "L", height: "H", finish: "none" },
      { role: "intercalaire", label: "Intercalaire — largeur", kind: "profile", qty: "2", length: "L - 2*ric", angle: "90/90", finish: "none" },
      { role: "intercalaire_v", label: "Intercalaire — hauteur", kind: "profile", qty: "2", length: "H - 2*ric", angle: "90/90", finish: "none" },
      { role: "angles", label: "Angles / connecteurs d'intercalaire", kind: "accessory", qty: "4", finish: "none" },
      { role: "butyl", label: "Butyl (mètres, 2 faces)", kind: "gasket", qty: "2", length: "per", finish: "none", waste: 5 },
      { role: "dessicant", label: "Dessicant / tamis moléculaire (kg)", kind: "consumable", qty: "per/1000 * dkg", finish: "none" },
      { role: "mastic", label: "Mastic polysulfure / silicone (kg)", kind: "consumable", qty: "per/1000 * mkg", finish: "none" },
    ],
    labour: [{ workshop: "VIT", minutes: "15 + 10*L*H/1e6" }],
    pricing: { mode: "cost_plus", coefficient: 1.6 },
  },
  {
    key: "triple_vitrage", family: "vitrage", name: "Triple vitrage", name_en: "Triple glazing unit",
    description: "Trois verres, deux intercalaires.",
    drawing: { type: "glass", layers: 3 },
    defaultWorkshop: "VIT",
    limits: { minL: 150, maxL: 4000, minH: 150, maxH: 3000 },
    parameters: [
      { key: "verre_ext", label: "Verre extérieur", type: "product", materialType: "glass" },
      { key: "verre_mil", label: "Verre central", type: "product", materialType: "glass" },
      { key: "verre_int", label: "Verre intérieur", type: "product", materialType: "glass" },
    ],
    variables: [
      { key: "ric", label: "Retrait intercalaire par côté (mm)", value: 6 },
      { key: "dkg", label: "Dessicant (kg/m)", value: 0.03 },
      { key: "mkg", label: "Mastic (kg/m)", value: 0.05 },
    ],
    derived: [{ key: "per", formula: "2*((L - 2*ric) + (H - 2*ric))" }],
    components: [
      { role: "verre_ext", label: "Verre extérieur", kind: "glass", productParam: "verre_ext", qty: "1", width: "L", height: "H", finish: "none" },
      { role: "verre_mil", label: "Verre central", kind: "glass", productParam: "verre_mil", qty: "1", width: "L", height: "H", finish: "none" },
      { role: "verre_int", label: "Verre intérieur", kind: "glass", productParam: "verre_int", qty: "1", width: "L", height: "H", finish: "none" },
      { role: "intercalaire", label: "Intercalaire — largeur", kind: "profile", qty: "4", length: "L - 2*ric", angle: "90/90", finish: "none" },
      { role: "intercalaire_v", label: "Intercalaire — hauteur", kind: "profile", qty: "4", length: "H - 2*ric", angle: "90/90", finish: "none" },
      { role: "angles", label: "Angles d'intercalaire", kind: "accessory", qty: "8", finish: "none" },
      { role: "butyl", label: "Butyl", kind: "gasket", qty: "4", length: "per", finish: "none", waste: 5 },
      { role: "dessicant", label: "Dessicant (kg)", kind: "consumable", qty: "2 * per/1000 * dkg", finish: "none" },
      { role: "mastic", label: "Mastic (kg)", kind: "consumable", qty: "per/1000 * mkg * 1.5", finish: "none" },
    ],
    labour: [{ workshop: "VIT", minutes: "25 + 12*L*H/1e6" }],
    pricing: { mode: "cost_plus", coefficient: 1.6 },
  },
  {
    key: "verre_feuillete", family: "vitrage", name: "Verre feuilleté assemblé (film PVB / EVA)", name_en: "Laminated glass (in-house)",
    description: "Deux verres + film intercalaire, pour les ateliers qui feuillettent eux-mêmes.",
    drawing: { type: "glass", layers: 2 },
    defaultWorkshop: "VIT",
    limits: { minL: 100, maxL: 3200, minH: 100, maxH: 2500 },
    parameters: [
      { key: "verre_1", label: "Verre 1", type: "product", materialType: "glass" },
      { key: "verre_2", label: "Verre 2", type: "product", materialType: "glass" },
      { key: "film", label: "Film PVB / EVA", type: "product", materialType: "consumable" },
    ],
    variables: [],
    derived: [],
    components: [
      { role: "verre_1", label: "Verre 1", kind: "glass", productParam: "verre_1", qty: "1", width: "L", height: "H", finish: "none" },
      { role: "verre_2", label: "Verre 2", kind: "glass", productParam: "verre_2", qty: "1", width: "L", height: "H", finish: "none" },
      { role: "film", label: "Film intercalaire", kind: "panel", productParam: "film", qty: "1", width: "L", height: "H", finish: "none", waste: 10 },
    ],
    labour: [{ workshop: "VIT", minutes: "30 + 15*L*H/1e6" }],
    pricing: { mode: "cost_plus", coefficient: 1.6 },
  },
];

// ------------------------------------------------------------------
// REMPLISSAGES (L × H = dimensions du panneau)
// ------------------------------------------------------------------
const panels = [
  {
    key: "panneau_simple", family: "remplissage", name: "Panneau simple (tôle, MDF, composite…)", name_en: "Single panel",
    description: "Un panneau coupé à la cote.",
    drawing: { type: "panel" },
    defaultWorkshop: "ALU",
    limits: { minL: 50, maxL: 4000, minH: 50, maxH: 3000 },
    parameters: [{ key: "matiere", label: "Matière", type: "product", materialType: "panel" }],
    variables: [],
    derived: [],
    components: [
      { role: "panneau", label: "Panneau", kind: "panel", productParam: "matiere", qty: "1", width: "L", height: "H", finish: "project", waste: 10 },
    ],
    labour: [{ workshop: "ALU", minutes: "10" }],
    pricing: { mode: "cost_plus", coefficient: 1.6 },
  },
  {
    key: "panneau_sandwich", family: "remplissage", name: "Panneau sandwich (tôle + isolant + tôle)", name_en: "Sandwich panel",
    description: "Deux parements et une âme isolante / MDF collés.",
    drawing: { type: "panel" },
    defaultWorkshop: "ALU",
    limits: { minL: 100, maxL: 3000, minH: 100, maxH: 3000 },
    parameters: [
      { key: "parement", label: "Parement (tôle / composite)", type: "product", materialType: "panel" },
      { key: "ame", label: "Âme (isolant / MDF)", type: "product", materialType: "panel" },
    ],
    variables: [{ key: "ckg", label: "Colle (kg/m²)", value: 0.4 }],
    derived: [],
    components: [
      { role: "parement", label: "Parements (2 faces)", kind: "panel", productParam: "parement", qty: "2", width: "L", height: "H", finish: "project", waste: 10 },
      { role: "ame", label: "Âme", kind: "panel", productParam: "ame", qty: "1", width: "L", height: "H", finish: "none", waste: 10 },
      { role: "colle", label: "Colle (kg)", kind: "consumable", qty: "L*H/1e6 * ckg", finish: "none" },
    ],
    labour: [{ workshop: "ALU", minutes: "20 + 10*L*H/1e6" }],
    pricing: { mode: "cost_plus", coefficient: 1.6 },
  },
];

// ------------------------------------------------------------------
// ASSEMBLY
// ------------------------------------------------------------------
const TEMPLATES = [
  // Coulissants
  sliding({ key: "coulissant_2v", name: "Fenêtre coulissante 2 vantaux", en: "Sliding window, 2 leaves", n: 2 }),
  sliding({ key: "coulissant_3v_3r", name: "Fenêtre coulissante 3 vantaux 3 rails", en: "Sliding window, 3 leaves 3 tracks", n: 3, rails: 3 }),
  sliding({ key: "coulissant_4v", name: "Fenêtre coulissante 4 vantaux (2 rails)", en: "Sliding window, 4 leaves", n: 4 }),
  sliding({ key: "coulissant_nv", name: "Coulissant n vantaux (paramétrable)", en: "Sliding, n leaves", n: 2, nFixed: false, rails: 2 }),
  sliding({ key: "baie_coulissante_2v", name: "Baie / porte-fenêtre coulissante 2 vantaux", en: "Sliding patio door, 2 leaves", n: 2, door: true }),
  sliding({ key: "baie_coulissante_4v", name: "Baie coulissante 4 vantaux", en: "Sliding patio door, 4 leaves", n: 4, door: true }),
  sliding({ key: "galandage_1v", name: "Coulissant à galandage 1 vantail", en: "Pocket sliding, 1 leaf", n: 1, pocket: true, door: true }),
  sliding({ key: "galandage_2v", name: "Coulissant à galandage 2 vantaux", en: "Pocket sliding, 2 leaves", n: 2, pocket: true, door: true }),
  sliding({ key: "levant_coulissant", name: "Levant-coulissant (lift & slide)", en: "Lift & slide", n: 2, door: true, lift: true, maxH: 3200 }),
  // Ouvrants
  casement({ key: "francaise_1v", name: "Fenêtre ouvrant à la française 1 vantail", en: "Casement window, 1 leaf", n: 1, hardware: "francaise" }),
  casement({ key: "francaise_2v", name: "Fenêtre ouvrant à la française 2 vantaux", en: "Casement window, 2 leaves", n: 2, hardware: "francaise" }),
  casement({ key: "ob_1v", name: "Fenêtre oscillo-battante 1 vantail", en: "Tilt & turn, 1 leaf", n: 1, hardware: "ob" }),
  casement({ key: "ob_2v", name: "Fenêtre oscillo-battante 2 vantaux", en: "Tilt & turn, 2 leaves", n: 2, hardware: "ob" }),
  casement({ key: "soufflet", name: "Fenêtre à soufflet (abattant)", en: "Bottom-hung (hopper)", n: 1, hardware: "soufflet", maxL: 2000, maxH: 1200 }),
  casement({ key: "projetante", name: "Fenêtre projetante / à l'italienne", en: "Top-hung (awning)", n: 1, hardware: "projetant", maxL: 2000, maxH: 1600 }),
  casement({ key: "basculante", name: "Fenêtre basculante (pivot horizontal)", en: "Horizontal pivot", n: 1, hardware: "basculant", maxL: 2000, maxH: 2000 }),
  casement({ key: "pivotante", name: "Fenêtre / porte pivotante (pivot vertical)", en: "Vertical pivot", n: 1, hardware: "pivotant", maxL: 2000, maxH: 3000 }),
  casement({ key: "porte_fenetre_1v", name: "Porte-fenêtre 1 vantail", en: "French door, 1 leaf", n: 1, hardware: "porte", door: true }),
  casement({ key: "porte_fenetre_2v", name: "Porte-fenêtre 2 vantaux", en: "French door, 2 leaves", n: 2, hardware: "porte", door: true }),
  // Fixes
  fixed,
  fixedGrid,
  // Composés
  combo("ouvrant_imposte", "Ouvrant + imposte fixe", "Opening + fixed transom", [
    { param: "bas", label: "Partie basse (ouvrant)", family: "ouvrant", width: "L", height: "H - hi", position: "bottom" },
    { param: "haut", label: "Imposte (fixe)", family: "fixe", width: "L", height: "hi", position: "top" },
  ], [{ key: "hi", label: "Hauteur imposte (mm)", type: "number", default: 400, min: 150, max: 1500, unit: "mm" }]),
  combo("ouvrant_allege", "Ouvrant + allège fixe", "Opening + fixed bottom panel", [
    { param: "haut", label: "Partie haute (ouvrant)", family: "ouvrant", width: "L", height: "H - ha", position: "top" },
    { param: "bas", label: "Allège (fixe)", family: "fixe", width: "L", height: "ha", position: "bottom" },
  ], [{ key: "ha", label: "Hauteur allège (mm)", type: "number", default: 600, min: 150, max: 1500, unit: "mm" }]),
  combo("coulissant_imposte", "Coulissant + imposte fixe", "Sliding + fixed transom", [
    { param: "bas", label: "Coulissant", family: "coulissant", width: "L", height: "H - hi", position: "bottom" },
    { param: "haut", label: "Imposte (fixe)", family: "fixe", width: "L", height: "hi", position: "top" },
  ], [{ key: "hi", label: "Hauteur imposte (mm)", type: "number", default: 400, min: 150, max: 1500, unit: "mm" }]),
  combo("fixe_ouvrant_fixe", "Fixe + ouvrant + fixe (latéraux)", "Fixed + opening + fixed", [
    { param: "gauche", label: "Fixe gauche", family: "fixe", width: "lf", height: "H", position: "left" },
    { param: "centre", label: "Ouvrant central", family: "ouvrant", width: "L - 2*lf", height: "H", position: "center" },
    { param: "droite", label: "Fixe droit", family: "fixe", width: "lf", height: "H", position: "right" },
  ], [{ key: "lf", label: "Largeur de chaque fixe (mm)", type: "number", default: 500, min: 150, max: 3000, unit: "mm" }]),
  // Portes
  ...doors,
  // Façades
  ...facades,
  // Fermetures
  ...closures,
  // Extérieur
  ...outdoor,
  // Vitrages & remplissages
  ...glassUnits,
  ...panels,
];

// Every template gets the shared variables its formulas use (e.g. the
// silicone line's "cart") without having to list them by hand.
(function addMissingVariables() {
  const { check } = require("../services/formulaEngine");
  const shared = Object.fromEntries(Object.values(V).map((v) => [v.key, v]));
  for (const t of TEMPLATES) {
    const known = new Set(["L", "H", ...t.parameters.map((p) => p.key), ...t.variables.map((v) => v.key), ...t.derived.map((d) => d.key)]);
    const formulas = [...t.derived.map((d) => d.formula), ...t.components.flatMap((c) => [c.qty, c.length, c.width, c.height, c.condition]), ...t.labour.map((l) => l.minutes)].filter(Boolean);
    for (const f of formulas) {
      for (const v of check(f).variables) {
        if (!known.has(v) && shared[v]) { t.variables.push({ ...shared[v] }); known.add(v); }
      }
    }
  }
}());

// ------------------------------------------------------------------
// DELIVERY BREAKDOWN — how one chassis is tracked and delivered.
// Each part: { key, label, kind, qty (formula), condition (formula) }.
// Companies edit this per model (e.g. deliver a curtain wall module by
// module, a sliding window frame first then the sashes).
// ------------------------------------------------------------------
const part = (key, label, kind, qty = "1", condition = "") => ({ key, label, kind, qty, condition });
const GLASS = (qty) => part("vitrages", "Vitrages", "glass", qty, "vitrage");
const DELIVERY_PARTS = {
  sliding: (t) => [
    part("dormant", "Dormant (cadre)", "frame"),
    part("vantaux", "Vantaux", "sash", t.parameters.some((p) => p.key === "n") ? "n" : "2"),
    ...(t.parameters.some((p) => p.key === "vitrage") ? [GLASS(t.parameters.some((p) => p.key === "n") ? "n" : "2")] : []),
    ...(t.parameters.some((p) => p.key === "ms") ? [part("moustiquaire", "Moustiquaire", "screen", "1", "ms")] : []),
  ],
  casement: () => [part("chassis", "Châssis (dormant + ouvrants)", "complete"), GLASS("n")],
  fixed: () => [part("cadre", "Cadre", "frame"), GLASS("1")],
};
const DELIVERY_BY_KEY = {
  fixe_meneaux: [part("cadre", "Cadre + meneaux", "frame"), GLASS("nx*ny")],
  porte_1v: [part("porte", "Porte (dormant + ouvrant)", "complete"), part("vitrages", "Vitrages", "glass", "n", "rempl != 1"), part("panneaux", "Panneaux de remplissage", "panel", "n", "rempl != 0")],
  porte_2v: [part("porte", "Porte (dormant + ouvrants)", "complete"), part("vitrages", "Vitrages", "glass", "n", "rempl != 1"), part("panneaux", "Panneaux de remplissage", "panel", "n", "rempl != 0")],
  porte_entree_pleine: [part("porte", "Porte complète", "complete")],
  porte_va_et_vient: [part("porte", "Porte (dormant + vantaux)", "complete"), part("pivots", "Pivots de sol", "accessory"), GLASS("n")],
  porte_pliante: [part("rails", "Rails + dormant", "frame"), part("vantaux", "Vantaux", "sash", "n"), GLASS("n")],
  porte_service_tolee: [part("porte", "Porte complète", "complete")],
  porte_garage_basculante: [part("porte", "Porte + cadre", "complete"), part("mecanisme", "Kit de basculement / moteur", "accessory")],
  porte_auto_coulissante: [part("caisson", "Caisson opérateur", "frame"), part("vantaux", "Vantaux", "sash", "4"), GLASS("4")],
  mur_rideau: [part("ossature", "Ossature (montants + traverses)", "frame"), part("modules", "Modules vitrés", "module", "nx*ny", "vitrage"), part("capots", "Capots, presseurs & finitions", "accessory")],
  verriere: [part("cadre", "Cadre + petits bois", "frame"), GLASS("nx*ny")],
  verriere_toiture: [part("structure", "Chevrons + pannes", "frame"), GLASS("nx")],
  cloison_vitree: [part("rails", "Rails + profils", "frame"), GLASS("nv")],
  vitrine: [part("porte", "Porte", "complete"), part("fixes", "Fixes latéraux", "complete", "2")],
  volet_roulant: [part("coffre", "Coffre + coulisses", "frame"), part("tablier", "Tablier", "sash"), part("manoeuvre", "Moteur / manœuvre", "accessory", "1", "man >= 2")],
  persienne: [part("vantaux", "Vantaux", "sash", "n")],
  jalousie: [part("cadre", "Cadre + mécanisme", "frame"), part("lames", "Lames de verre", "glass")],
  moustiquaire_fixe: [part("moustiquaire", "Moustiquaire", "complete")],
  moustiquaire_enroulable: [part("moustiquaire", "Moustiquaire", "complete")],
  garde_corps_vitre: [part("structure", "Poteaux + main courante", "frame"), GLASS("np")],
  garde_corps_barreaude: [part("garde_corps", "Garde-corps (travées)", "complete", "np")],
  pergola_bioclimatique: [part("structure", "Poteaux + poutres", "frame"), part("lames", "Lames orientables", "sash"), part("moteur", "Motorisation", "accessory", "1", "mot")],
  brise_soleil: [part("supports", "Supports", "frame"), part("lames", "Lames", "sash")],
  habillage_composite: [part("ossature", "Ossature", "frame"), part("panneaux", "Panneaux", "panel")],
  marquise: [part("structure", "Profil mural + consoles", "frame"), GLASS("1")],
};
for (const t of TEMPLATES) {
  if (t.deliveryParts) continue;
  if (DELIVERY_BY_KEY[t.key]) t.deliveryParts = DELIVERY_BY_KEY[t.key];
  else if (t.family === "coulissant") t.deliveryParts = DELIVERY_PARTS.sliding(t);
  else if (t.family === "ouvrant" || (t.family === "porte" && t.drawing?.type === "casement") || t.key.startsWith("porte_fenetre")) t.deliveryParts = DELIVERY_PARTS.casement(t);
  else if (t.key === "fixe") t.deliveryParts = DELIVERY_PARTS.fixed(t);
  else if (t.family === "compose") t.deliveryParts = t.parameters.filter((p) => p.type === "model").map((p) => part(p.key, p.label, "complete"));
  else if (t.family === "vitrage") t.deliveryParts = [part("vitrage", "Vitrage", "glass")];
  else if (t.family === "remplissage") t.deliveryParts = [part("panneau", "Panneau", "panel")];
  else t.deliveryParts = [part("complet", "Châssis complet", "complete")];
}

// Default measure per kind (a component can override it).
const DEFAULT_MEASURE = { profile: "length", gasket: "length", glass: "area", panel: "area", accessory: "count", consumable: "count", model: "count" };

function findTemplate(key) {
  return TEMPLATES.find((t) => t.key === key) || null;
}

module.exports = { FAMILIES, TEMPLATES, DEFAULT_MEASURE, findTemplate };
