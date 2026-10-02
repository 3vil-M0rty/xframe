/**
 * ============================================================
 * SEED ACHATS — demo data to test every purchasing feature
 * ============================================================
 * Run AFTER the main seed (npm run seed), on a TEST database:
 *     npm run seed:achats          (or: node scripts/seedAchats.js)
 * Options:  --company=<companyId>   (default: "Atlas Industries")
 *
 * Adds (never wipes anything else). Re-running replaces only its own
 * demo data — everything it creates is tagged "[DEMO ACHATS]" (or
 * internal references starting with "DEMO-"). What each item is for:
 * see scripts/ACHATS_TEST_GUIDE.md.
 * ============================================================
 */
require("../services/tenantScope"); // client-isolation plugin, before models
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const Company = require("../models/Company");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const InventoryCategory = require("../models/InventoryCategory");
const PurchaseOrder = require("../models/PurchaseOrder");
const PriceRequest = require("../models/PriceRequest");
const PurchaseRequest = require("../models/PurchaseRequest");
const { createWithNumber } = require("../services/documentNumberService");
const { deriveReceptionStatus } = require("../services/purchaseOrderCalc");

const TAG = "[DEMO ACHATS]";
const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

const MANAGER_EMAIL = "achats-manager@frame.test";
const MANAGER_PASSWORD = "AchatsManager@123";

async function cleanup(company) {
  const tagRx = /^\[DEMO ACHATS\]/;
  await Promise.all([
    PurchaseOrder.deleteMany({ company: company._id, notes: tagRx }),
    PriceRequest.deleteMany({ company: company._id, notes: tagRx }),
    PurchaseRequest.deleteMany({ company: company._id, notes: tagRx }),
    Supplier.deleteMany({ company: company._id, notes: tagRx }),
    Product.deleteMany({ company: company._id, internalReference: /^DEMO-/ }),
    InventoryCategory.deleteMany({ company: company._id, description: tagRx }),
  ]);
  const dept = await Department.findOne({ company: company._id, description: tagRx });
  if (dept) {
    await Employee.deleteMany({ company: company._id, department: dept._id });
    await dept.deleteOne();
  }
  await User.deleteOne({ email: MANAGER_EMAIL });
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✓ Connected to MongoDB");

  const companyArg = process.argv.find((a) => a.startsWith("--company="));
  const company = companyArg
    ? await Company.findById(companyArg.split("=")[1])
    : (await Company.findOne({ name: "Atlas Industries" })) || (await Company.findOne());
  if (!company) throw new Error("No company found — run `npm run seed` first.");
  console.log(`✓ Company: ${company.name}`);

  const buyer = await User.findOne({ email: "achats@frame.test" });
  const production = await User.findOne({ email: "manager@frame.test" });
  if (!buyer) throw new Error("achats@frame.test not found — run `npm run seed` first.");
  const actor = buyer._id;

  await cleanup(company);
  console.log("✓ Previous demo data removed");

  // ---------------------------------------------------------------
  // 1. Approval threshold + a purchasing department whose manager approves
  // ---------------------------------------------------------------
  company.settings = company.settings || {};
  company.settings.purchaseApprovalThreshold = 20000;
  company.markModified("settings");
  await company.save();

  const dept = await Department.create({
    company: company._id, name: "Achats", description: `${TAG} Service achats (département de démo)`,
    permissionKey: "purchasing", createdBy: actor, updatedBy: actor,
  });
  const managerEmployee = await Employee.create({
    company: company._id, employeeNumber: "EMP-ACH-01", firstName: "Samira", lastName: "Bennani", gender: "female",
    hireDate: daysAgo(900), employmentStatus: "active", employmentType: "permanent",
    jobTitle: "Responsable des Achats", department: dept._id, workEmail: MANAGER_EMAIL,
    createdBy: actor, updatedBy: actor,
  });
  dept.manager = managerEmployee._id;
  await dept.save();
  await User.create({
    firstName: "Samira", lastName: "Bennani", email: MANAGER_EMAIL, password: MANAGER_PASSWORD,
    role: "user", department: "purchasing", employee: managerEmployee._id,
    tenant: company.tenant, // same client as the company
  });
  console.log(`✓ Approval threshold 20 000 MAD TTC; purchasing manager ${MANAGER_EMAIL}`);

  // ---------------------------------------------------------------
  // 2. Suppliers (details, payment terms, documents)
  // ---------------------------------------------------------------
  const upsertSupplier = async (name, fields, demoOwned) => {
    let s = await Supplier.findOne({ company: company._id, name });
    if (!s) s = new Supplier({ company: company._id, name, createdBy: actor });
    Object.assign(s, fields, { updatedBy: actor, isActive: true });
    if (demoOwned) s.notes = `${TAG} fournisseur de démo`;
    await s.save();
    return s;
  };
  const acier = await upsertSupplier("AcierPlus", {
    contactName: "M. Tazi", email: "commercial@acierplus.ma", phone: "0522 00 11 22", city: "Casablanca", address: "45 Bd Moulay Ismail",
    ice: "002233445000067", identifiantFiscal: "33445566", rc: "RC 9911", paymentTerms: "60 jours", paymentDays: 60,
    documents: [
      { type: "attestation_fiscale", number: "AF-2026-778", issueDate: daysAgo(170), expiryDate: daysFromNow(10), uploadedBy: actor }, // expiring soon
      { type: "rib", number: "007 780 0001234567890123 45", uploadedBy: actor },
    ],
  });
  const metal = await upsertSupplier("MetalSud", {
    contactName: "Mme Alami", email: "ventes@metalsud.ma", phone: "0528 11 22 33", city: "Agadir",
    ice: "001122334000055", identifiantFiscal: "22334455", paymentTerms: "90 jours (accord écrit)", paymentDays: 90,
    documents: [{ type: "attestation_fiscale", number: "AF-2025-310", issueDate: daysAgo(190), expiryDate: daysAgo(5), uploadedBy: actor }], // expired
  }, true);
  const equip = await upsertSupplier("EquipPro", {
    contactName: "M. Chraibi", email: "contact@equippro.ma", city: "Tanger", paymentTerms: "30 jours", paymentDays: 30,
    // no ICE / IF on purpose -> flagged in the TVA deduction listing
  }, true);
  const embal = await upsertSupplier("Emballages du Nord", {
    contactName: "Mme Idrissi", email: "commandes@emballagesnord.ma", phone: "0539 00 33 44", city: "Tanger",
    ice: "003344556000071", identifiantFiscal: "44556677", paymentTerms: "Comptant", paymentDays: 60,
  });
  console.log("✓ 4 suppliers (payment terms, documents expiring / expired, one without ICE/IF)");

  // ---------------------------------------------------------------
  // 3. Articles with supplier prices (some below their minimum)
  // ---------------------------------------------------------------
  const category = await InventoryCategory.findOne({ company: company._id, description: { $not: /^\[DEMO ACHATS\]/ } });
  if (!category) throw new Error("No inventory category — run `npm run seed` first.");
  category.accountingAccount = "6121"; // matières premières
  await category.save();
  const assetsCategory = await InventoryCategory.create({
    company: company._id, name: "Équipements (démo)", icon: "Wrench", description: `${TAG} catégorie d'immobilisations`,
    accountingAccount: "2332", isFixedAsset: true, createdBy: actor, updatedBy: actor,
  });
  const steel = await Product.findOne({ company: company._id, internalReference: "RM-STEEL-2MM" });
  if (steel) {
    steel.prices = [
      { supplierName: "AcierPlus", price: 12.5, supplierReference: "AP-2MM-1250" },
      { supplierName: "MetalSud", price: 11.9, supplierReference: "MS-T2" },
    ];
    await steel.save();
  }
  const mkProduct = (fields) => Product.create({ company: company._id, category: category._id, createdBy: actor, updatedBy: actor, ...fields });
  const gloves = await mkProduct({ name: "Gants anti-coupure", internalReference: "DEMO-GANTS", unit: "paire", quantity: 5, threshold: 50,
    prices: [{ supplierName: "EquipPro", price: 18, supplierReference: "EP-GC5" }] });
  const oil = await mkProduct({ name: "Huile de coupe", internalReference: "DEMO-HUILE", unit: "L", quantity: 2, threshold: 10,
    prices: [{ supplierName: "MetalSud", price: 95 }, { supplierName: "AcierPlus", price: 99 }] });
  const box = await mkProduct({ name: "Carton 60x40", internalReference: "DEMO-CARTON", unit: "pièce", quantity: 20, threshold: 200,
    prices: [{ supplierName: "Emballages du Nord", price: 4.5 }] });
  const compressor = await mkProduct({ name: "Compresseur 500 L", internalReference: "DEMO-COMPRESSEUR", unit: "pièce", quantity: 1, threshold: 0,
    category: assetsCategory._id, prices: [{ supplierName: "MetalSud", price: 18000 }] });
  const screws = await mkProduct({ name: "Vis M8 inox", internalReference: "DEMO-VIS", unit: "pièce", quantity: 3000, threshold: 500,
    prices: [{ supplierName: "MetalSud", price: 0.8 }] });
  console.log("✓ Articles with supplier prices (gloves, oil below minimum)");

  // ---------------------------------------------------------------
  // 4. Purchase requests from production
  // ---------------------------------------------------------------
  if (production) {
    await PurchaseRequest.create({ company: company._id, product: gloves._id, requestedQuantity: 50, requestedBy: production._id,
      notes: `${TAG} Stock critique, besoin avant lundi`, history: [{ status: "pending", note: "Stock critique", by: production._id }] });
    await PurchaseRequest.create({ company: company._id, product: box._id, requestedQuantity: 200, requestedBy: production._id, status: "delayed",
      purchasingNote: "Fournisseur en rupture jusqu'au 15 du mois", notes: `${TAG} Cartons pour expédition`,
      history: [{ status: "pending", by: production._id, at: daysAgo(3) }, { status: "delayed", note: "Fournisseur en rupture jusqu'au 15 du mois", by: actor, at: daysAgo(1) }] });
    console.log("✓ 2 purchase requests (1 pending, 1 delayed)");
  }

  // ---------------------------------------------------------------
  // 5. Purchase orders — one per scenario
  // ---------------------------------------------------------------
  const line = (l) => ({ vatRate: 20, receivedQuantity: 0, returnedQuantity: 0, ...l });
  const order = async (scenario, data, mutate) => {
    const o = await createWithNumber(PurchaseOrder, {
      company: company._id, date: daysAgo(30), createdBy: actor, updatedBy: actor, status: "draft",
      notes: `${TAG} ${scenario}`, ...data,
    }, "BC");
    if (mutate) {
      await mutate(o);
      await o.save();
    }
    console.log(`  · ${o.number}  ${o.status.padEnd(18)} ${scenario}`);
    return o;
  };
  const receiveAll = (o, ref, date, qtyFor = (l) => l.quantity) => {
    o.lines.forEach((l) => { l.receivedQuantity = qtyFor(l); });
    o.receptions.push({ type: "reception", reference: ref, date, by: actor, lines: o.lines.map((l) => ({ lineId: l._id, quantity: qtyFor(l) })) });
    o.status = deriveReceptionStatus({ ...o.toObject(), status: "sent" });
  };
  const invoice = (o, number, date, amountTTC, dueDate, type = "invoice", vatBreakdown = []) => o.invoices.push({ type, number, date, dueDate, amountTTC, vatBreakdown, by: actor });
  const pay = (o, amount, method, date, reference) => o.payments.push({ amount, method, date, reference, by: actor });

  console.log("✓ Purchase orders:");
  await order("Brouillon SOUS le seuil — « Marquer comme commandé » passe direct", {
    supplier: equip._id, lines: [line({ product: gloves._id, description: "Gants anti-coupure", quantity: 20, unit: "paire", unitPrice: 18 })],
  });
  await order("Brouillon AU-DESSUS du seuil — « Marquer comme commandé » demande l'approbation", {
    supplier: metal._id, lines: [line({ product: steel?._id, description: "Tôle acier 2mm", quantity: 2000, unit: "kg", unitPrice: 11.9 })],
  });
  await order("EN ATTENTE D'APPROBATION — à approuver par le responsable achats ou le propriétaire", {
    supplier: acier._id, lines: [line({ product: steel?._id, description: "Tôle acier 2mm", quantity: 1800, unit: "kg", unitPrice: 12.5 })],
  }, async (o) => { o.status = "pending_approval"; o.approval = { requestedAt: daysAgo(1), requestedBy: actor }; });
  await order("LIVRAISON EN RETARD — date prévue dépassée (alerte quotidienne + filtre « En retard »)", {
    supplier: embal._id, date: daysAgo(20), expectedDate: daysAgo(5),
    lines: [line({ product: box._id, description: "Carton 60x40", quantity: 1000, unit: "pièce", unitPrice: 4.5 })],
  }, async (o) => { o.status = "sent"; o.emails.push({ to: embal.email, subject: `Bon de commande ${o.number}`, by: actor, simulated: true, at: daysAgo(20) }); });
  await order("RÉCEPTION 69/70 — « Solder » la ligne ; ligne saisie → « Ajouter à l'inventaire »", {
    supplier: equip._id, date: daysAgo(15),
    lines: [line({ description: "Casque de sécurité EN397", quantity: 70, unit: "pièce", unitPrice: 45 })],
  }, async (o) => { o.status = "sent"; receiveAll(o, "BL-DEMO-069", daysAgo(3), () => 69); });
  await order("RETOUR 500 vis — avoir attendu ; délai 90 j (drapeau Loi 69-21)", {
    supplier: metal._id, date: daysAgo(40),
    lines: [line({ product: screws._id, description: "Vis M8 inox", quantity: 5000, unit: "pièce", unitPrice: 0.8 })],
  }, async (o) => {
    o.status = "sent";
    receiveAll(o, "BL-MS-5521", daysAgo(25));
    o.lines[0].returnedQuantity = 500;
    o.receptions.push({ type: "return", reference: "RET-DEMO-01", date: daysAgo(22), notes: "Filetage défectueux", by: actor, lines: [{ lineId: o.lines[0]._id, quantity: 500 }] });
    o.lines[0].closed = true; o.lines[0].closedAt = daysAgo(22); o.lines[0].closedBy = actor; o.lines[0].closeReason = "Retour non remplacé";
    o.status = deriveReceptionStatus(o);
    invoice(o, "F-MS-2026-101", daysAgo(20), 4800, daysFromNow(70)); // full amount: 4 800, but 480 of it was returned
  });
  await order("FACTURÉ EN TROP — facture 1 800 pour 1 500 reçus", {
    supplier: acier._id, date: daysAgo(35),
    lines: [line({ product: steel?._id, description: "Tôle acier 2mm", quantity: 100, unit: "kg", unitPrice: 12.5 })],
  }, async (o) => { o.status = "sent"; receiveAll(o, "BL-AP-3001", daysAgo(30)); invoice(o, "F-AP-2026-201", daysAgo(28), 1800, daysFromNow(32)); });
  await order("ÉCHUE depuis 20 j — balance âgée 1–30 j", {
    supplier: acier._id, date: daysAgo(85),
    lines: [line({ description: "Découpe laser sur mesure", quantity: 1, unit: "forfait", unitPrice: 3000 })],
  }, async (o) => { o.status = "sent"; receiveAll(o, "BL-AP-2890", daysAgo(82)); invoice(o, "F-AP-2026-150", daysAgo(80), 3600, daysAgo(20)); });
  await order("ÉCHUE depuis 45 j, payée en partie — balance âgée 31–60 j", {
    supplier: embal._id, date: daysAgo(110),
    lines: [line({ description: "Palettes bois 120x80", quantity: 50, unit: "pièce", unitPrice: 60 })],
  }, async (o) => {
    o.status = "sent"; receiveAll(o, "BL-EN-777", daysAgo(107)); invoice(o, "F-EN-2026-044", daysAgo(105), 3600, daysAgo(45));
    pay(o, 1600, "virement", daysAgo(50), "VIR-DEMO-0050");
  });
  await order("ÉCHUE depuis 100 j — balance âgée > 90 j", {
    supplier: equip._id, date: daysAgo(135),
    lines: [line({ description: "Extincteurs 6 kg", quantity: 4, unit: "pièce", unitPrice: 900 })],
  }, async (o) => { o.status = "sent"; receiveAll(o, "BL-EQ-120", daysAgo(132)); invoice(o, "F-EQ-2026-009", daysAgo(130), 4320, daysAgo(100)); });
  await order("PAYÉE CE MOIS (virement + chèque) — relevé TVA & export comptable", {
    supplier: acier._id, date: daysAgo(30),
    lines: [line({ product: steel?._id, description: "Tôle acier 2mm", quantity: 400, unit: "kg", unitPrice: 12.5 })],
  }, async (o) => {
    o.status = "sent"; receiveAll(o, "BL-AP-3100", daysAgo(27));
    invoice(o, "F-AP-2026-230", daysAgo(25), 6000, daysFromNow(35), "invoice", [{ rate: 20, baseHT: 5000, vat: 1000 }]);
    pay(o, 3000, "virement", new Date(), "VIR-DEMO-0101"); pay(o, 3000, "cheque", new Date(), "CHQ-0045123");
  });
  await order("PAYÉE CE MOIS en espèces — fournisseur SANS IF/ICE (signalé dans le relevé)", {
    supplier: equip._id, date: daysAgo(12),
    lines: [line({ product: gloves._id, description: "Gants anti-coupure", quantity: 100, unit: "paire", unitPrice: 18 })],
  }, async (o) => {
    o.status = "sent"; receiveAll(o, "BL-EQ-151", daysAgo(10)); invoice(o, "F-EQ-2026-031", daysAgo(10), 2160, daysFromNow(20));
    pay(o, 2160, "especes", new Date(), "");
  });
  await order("FACTURE MULTI-TAUX (20 % + transport 10 %) saisie au détail, payée ce mois — relevé TVA exact", {
    supplier: embal._id, date: daysAgo(14),
    lines: [
      line({ product: box._id, description: "Carton 60x40", quantity: 400, unit: "pièce", unitPrice: 4.5 }),
      line({ description: "Transport", quantity: 1, unit: "forfait", unitPrice: 400, vatRate: 10 }),
    ],
  }, async (o) => {
    o.status = "sent"; receiveAll(o, "BL-EN-801", daysAgo(12));
    invoice(o, "F-EN-2026-061", daysAgo(11), 2600, daysFromNow(49), "invoice", [{ rate: 20, baseHT: 1800, vat: 360 }, { rate: 10, baseHT: 400, vat: 40 }]);
    pay(o, 2600, "virement", new Date(), "VIR-DEMO-0120");
  });
  await order("IMMOBILISATION (compresseur) — export comptable : compte 2332, TVA en 34551", {
    supplier: metal._id, date: daysAgo(9),
    lines: [line({ product: compressor._id, description: "Compresseur 500 L", quantity: 1, unit: "pièce", unitPrice: 18000 })],
  }, async (o) => {
    o.status = "sent"; receiveAll(o, "BL-MS-6010", daysAgo(8));
    invoice(o, "F-MS-2026-140", new Date(), 21600, daysFromNow(90), "invoice", [{ rate: 20, baseHT: 18000, vat: 3600 }]);
  });
  await order("ANNULÉ", {
    supplier: embal._id, date: daysAgo(18), lines: [line({ product: box._id, description: "Carton 60x40", quantity: 300, unit: "pièce", unitPrice: 4.5 })],
  }, async (o) => { o.status = "cancelled"; o.cancelReason = "Doublon avec une autre commande"; });

  // ---------------------------------------------------------------
  // 6. Price requests: a 3-supplier comparison + a single draft
  // ---------------------------------------------------------------
  const group = `CMP-demo${Date.now().toString(36)}`;
  const dpLines = (p1, p2) => [
    { product: steel?._id, description: "Tôle acier 2mm", quantity: 1000, unit: "kg", quotedUnitPrice: p1, vatRate: 20 },
    { product: oil._id, description: "Huile de coupe", quantity: 20, unit: "L", quotedUnitPrice: p2, vatRate: 20 },
  ];
  const dp = (supplier, status, lines, extra = {}) => createWithNumber(PriceRequest, {
    company: company._id, supplier: supplier._id, date: daysAgo(6), responseDeadline: daysFromNow(4), status, lines,
    notes: `${TAG} ${extra.note || "comparaison 3 fournisseurs"}`, comparisonGroup: extra.single ? null : group,
    createdBy: actor, updatedBy: actor,
  }, "DP");
  await dp(acier, "answered", dpLines(12.2, 88));
  await dp(metal, "answered", dpLines(11.8, 92));
  await dp(equip, "sent", dpLines(null, null));
  await dp(embal, "draft", [{ description: "Carton 80x60 double cannelure (nouvel article)", quantity: 500, unit: "pièce", quotedUnitPrice: null, vatRate: 20 }],
    { single: true, note: "brouillon — nouvel article hors inventaire" });
  console.log("✓ Price requests: comparison of 3 suppliers (1 incomplete) + 1 draft for a new article");

  console.log("\n============================================================");
  console.log("SEED ACHATS COMPLETE — see scripts/ACHATS_TEST_GUIDE.md");
  console.log("  Buyer               achats@frame.test          / Achats@123");
  console.log(`  Purchasing manager  ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}  (approves)`);
  console.log("  Owner               owner@frame.test           / Owner@123         (approves)");
  console.log("  Production          manager@frame.test         / Manager@123");
  console.log("Restart the backend to run today's alerts (late delivery, supplier documents, missing invoices).");
  console.log("============================================================");
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch(async (err) => {
    console.error("seed:achats failed:", err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { run, TAG };
