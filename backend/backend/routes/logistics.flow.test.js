import { describe, it, expect, beforeAll } from "vitest";

/**
 * Chassis tracking + logistics, through the real routes:
 * project ouvrages → units split into parts (frame / sashes / glass) →
 * made / ready → delivery note with the FRAMES ONLY (without glass) →
 * delivered (transport cost into the project) → second note with the
 * sashes + glass → installed → received; partial quantities, over-
 * delivery refused, return (cancel a delivered note), a size change
 * after production (flagged "modified"), a cancelled chassis, and the
 * logistics department's access.
 */
const tenantScope = require("../services/tenantScope");
const fake = require("../test/fakeMongo");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "logistics-flow-secret";

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Notification = require("../models/Notification");
const { findTemplate } = require("../config/chassisCatalog");
const { modelFromTemplate } = require("../services/chassisCatalogService");
const ChassisModel = require("../models/ChassisModel");

let app;
let token;
let logToken;
let salesToken;
let companyId;
let slidingId;
let curtainId;
const h = (t = token) => ({ Authorization: `Bearer ${t}` });
const binary = (res, cb) => { const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => cb(null, Buffer.concat(c))); };

beforeAll(async () => {
  fake.connect();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => tenantScope.bindRequest(req, tenantScope.SYSTEM, next));
  app.use("/api/projects", require("./projects"));
  app.use("/api/tracking", require("./tracking"));
  app.use("/api/logistics", require("./logistics"));
  tenantScope.enableStrictMode(true);
  await tenantScope.runAsSystem(async () => {
    const tenant = await Tenant.create({ name: "T" });
    const admin = await User.create({ firstName: "A", lastName: "A", email: "a@alu.ma", password: "secret12", role: "admin", tenant: tenant._id });
    const company = await Company.create({ name: "Alu", tenant: tenant._id, owner: admin._id, industry: "x", legalForm: "SARL" });
    companyId = String(company._id);
    const log = await User.create({ firstName: "L", lastName: "L", email: "log@alu.ma", password: "secret12", role: "user", department: "logistics", tenant: tenant._id });
    const sales = await User.create({ firstName: "S", lastName: "S", email: "s@alu.ma", password: "secret12", role: "user", department: "sales", tenant: tenant._id });
    // Formulas only — no articles needed for tracking.
    slidingId = String((await ChassisModel.create(modelFromTemplate(findTemplate("coulissant_2v"), { company: company._id }))). _id);
    curtainId = String((await ChassisModel.create(modelFromTemplate(findTemplate("mur_rideau"), { company: company._id }))). _id);
    const glass = await ChassisModel.create(modelFromTemplate(findTemplate("double_vitrage"), { company: company._id }));
    await ChassisModel.updateOne({ _id: slidingId, "parameters.key": "vitrage" }, { $set: { "parameters.$.default": String(glass._id) } });
    await ChassisModel.updateOne({ _id: curtainId, "parameters.key": "vitrage" }, { $set: { "parameters.$.default": String(glass._id) } });
    token = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET);
    logToken = jwt.sign({ id: String(log._id) }, process.env.JWT_SECRET);
    salesToken = jwt.sign({ id: String(sales._id) }, process.env.JWT_SECRET);
  });
});

describe("chassis tracking & logistics", () => {
  let projectId;
  let units;
  const unit = (ref) => units.find((u) => u.ref === ref);
  const part = (ref, key) => unit(ref).parts.find((p) => p.key === key);
  const reload = async () => {
    const r = await request(app).get(`/api/tracking/projects/${projectId}`).set(h());
    expect(r.status).toBe(200);
    units = r.body.data.units;
    return r.body.data;
  };

  it("splits every chassis into deliverable parts", async () => {
    const p = await request(app).post("/api/projects").set(h()).send({ company: companyId, name: "Tour Atlas", location: "Casablanca" });
    projectId = p.body.data._id;
    await request(app).post(`/api/projects/${projectId}/items`).set(h()).send({ model: slidingId, ref: "F1", L: 1800, H: 1250, quantity: 3, params: { ms: 1 } }).expect(201);
    await request(app).post(`/api/projects/${projectId}/items`).set(h()).send({ model: curtainId, ref: "MR", L: 6000, H: 3000, quantity: 1, params: { nx: 4, ny: 3 } }).expect(201);
    const data = await reload();
    expect(units.map((u) => u.ref)).toEqual(["F1-1", "F1-2", "F1-3", "MR"]);
    // Sashes and glass are tracked one by one (per-piece breakdown)
    expect(unit("F1-1").parts.map((x) => [x.label, x.quantity])).toEqual([
      ["Dormant (cadre)", 1], ["Vantail 1", 1], ["Vantail 2", 1], ["Vitrage 1", 1], ["Vitrage 2", 1], ["Moustiquaire", 1],
    ]);
    expect(unit("MR").parts.find((x) => x.key === "modules").quantity).toBe(12); // nx*ny modules
    expect(data.summary.units).toBe(4);
    expect(data.summary.to_make).toBe(4);
  });

  it("moves parts through made / ready, in part or in full", async () => {
    // F1-1 and F1-2 frames ready; sashes made; MR: 4 modules ready out of 12
    await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h()).send({
      action: "ready",
      targets: [
        { unit: unit("F1-1")._id, part: part("F1-1", "dormant")._id },
        { unit: unit("F1-2")._id, part: part("F1-2", "dormant")._id },
        { unit: unit("MR")._id, part: part("MR", "modules")._id, quantity: 4 },
      ],
    }).expect(200);
    await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h()).send({ action: "made", targets: [{ unit: unit("F1-1")._id, part: part("F1-1", "vantaux_1")._id }, { unit: unit("F1-1")._id, part: part("F1-1", "vantaux_2")._id }] }).expect(200);
    await reload();
    expect(part("F1-1", "dormant")).toMatchObject({ madeQty: 1, readyQty: 1, available: 1, status: "ready" });
    expect(part("F1-1", "vantaux_1")).toMatchObject({ madeQty: 1, readyQty: 0, available: 0, status: "made" });
    expect(part("MR", "modules")).toMatchObject({ readyQty: 4, available: 4, status: "in_production" });
    expect(unit("F1-1").status).toBe("in_production"); // least advanced part
    // Logistics is told
    const notes = await tenantScope.runAsSystem(() => Notification.find({ key: "readyToDeliver" }).lean());
    expect(notes).toHaveLength(1);
    // Can't install what isn't delivered
    const bad = await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h()).send({ action: "installed", targets: [{ unit: unit("F1-1")._id }] });
    expect(bad.status).toBe(400);
  });

  let bl1;
  it("frame ready, sash 1 in progress, sash 2 not started", async () => {
    // F1-2: its frame is ready (above); start sash 1 only
    await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h()).send({ action: "started", targets: [{ unit: unit("F1-2")._id, part: part("F1-2", "vantaux_1")._id }] }).expect(200);
    await reload();
    expect(part("F1-2", "dormant").status).toBe("ready");
    expect(part("F1-2", "vantaux_1")).toMatchObject({ startedQty: 1, status: "in_production" });
    expect(part("F1-2", "vantaux_2")).toMatchObject({ startedQty: 0, status: "to_make" });
    expect(unit("F1-2").status).toBe("in_production");
    // Undo "started"
    await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h()).send({ action: "unstarted", targets: [{ unit: unit("F1-2")._id, part: part("F1-2", "vantaux_1")._id }] }).expect(200);
    await reload();
    expect(part("F1-2", "vantaux_1").status).toBe("to_make");
    expect(unit("F1-2").status).toBe("in_production"); // the frame is made
  });

  it("delivers the frames first (without sashes / glass) and 4 curtain-wall modules", async () => {
    const toDeliver = await request(app).get(`/api/logistics/to-deliver?companyId=${companyId}`).set(h(logToken));
    expect(toDeliver.status).toBe(200);
    expect(toDeliver.body.data.projects[0].available).toBe(6); // 2 frames + 4 modules
    // More than available is refused
    const over = await request(app).post("/api/logistics/delivery-notes").set(h(logToken)).send({ project: projectId, lines: [{ unit: unit("MR")._id, part: part("MR", "modules")._id, quantity: 5 }] });
    expect(over.status).toBe(400);
    const created = await request(app).post("/api/logistics/delivery-notes").set(h(logToken)).send({
      project: projectId, status: "planned", date: new Date().toISOString(), timeSlot: "8h–10h",
      transport: { mode: "carrier", carrier: "Transports Atlas", vehicle: "12345-A-6", driver: "Said", driverPhone: "0600000000", cost: 1200 },
      packages: 3, notes: "Décharger côté façade nord",
      lines: [
        { unit: unit("F1-1")._id, part: part("F1-1", "dormant")._id, quantity: 1 },
        { unit: unit("F1-2")._id, part: part("F1-2", "dormant")._id, quantity: 1 },
        { unit: unit("MR")._id, part: part("MR", "modules")._id, quantity: 4 },
      ],
      extraLines: [{ label: "Cartouches silicone", quantity: 10, unit: "u" }],
    });
    expect(created.status).toBe(201);
    bl1 = created.body.data;
    expect(bl1.number).toMatch(/^BL-\d{4}-0001$/);
    expect(bl1.lines.map((l) => l.partLabel)).toContain("Dormant (cadre)");
    // Reserved: nothing left to put on another note
    await reload();
    expect(part("F1-1", "dormant")).toMatchObject({ available: 0, reserved: 1 });
    const dup = await request(app).post("/api/logistics/delivery-notes").set(h(logToken)).send({ project: projectId, lines: [{ unit: unit("F1-1")._id, part: part("F1-1", "dormant")._id, quantity: 1 }] });
    expect(dup.status).toBe(400);

    await request(app).post(`/api/logistics/delivery-notes/${bl1._id}/status`).set(h(logToken)).send({ status: "shipped" }).expect(200);
    const done = await request(app).post(`/api/logistics/delivery-notes/${bl1._id}/status`).set(h(logToken)).send({ status: "delivered", receivedBy: "M. Alami", reserves: "1 module rayé" });
    expect(done.status).toBe(200);
    const data = await reload();
    expect(part("F1-1", "dormant")).toMatchObject({ deliveredQty: 1, status: "delivered" });
    expect(unit("F1-1").status).toBe("partially_delivered");
    expect(part("MR", "modules")).toMatchObject({ deliveredQty: 4, status: "partially_delivered" });
    expect(data.deliveryNotes[0]).toMatchObject({ number: bl1.number, status: "delivered", pieces: 6 });
    // Transport cost → project expenses
    const project = await request(app).get(`/api/projects/${projectId}`).set(h());
    expect(project.body.data.expenses.some((e) => e.amount === 1200 && e.label.includes(bl1.number))).toBe(true);
    // Sales hears about the reserves
    const salesNotes = await tenantScope.runAsSystem(() => Notification.find({ key: "deliveredWithReserves" }).lean());
    expect(salesNotes.length).toBeGreaterThan(0);
    const pdf = await request(app).get(`/api/logistics/delivery-notes/${bl1._id}/pdf`).set(h(logToken)).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.body.slice(0, 4).toString()).toBe("%PDF");
  });

  it("delivers the rest later, installs and receives", async () => {
    await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h()).send({ action: "ready", targets: [{ unit: unit("F1-1")._id }] }).expect(200);
    await reload();
    const lines = unit("F1-1").parts.filter((x) => x.available > 0).map((x) => ({ unit: unit("F1-1")._id, part: x._id, quantity: x.available }));
    expect(lines).toHaveLength(5); // 2 sashes, 2 glass units, fly screen
    const bl2 = await request(app).post("/api/logistics/delivery-notes").set(h(logToken)).send({ project: projectId, lines, transport: { mode: "own", vehicle: "Camion 1" } });
    expect(bl2.status).toBe(201);
    // Each element carries its own size on the note (sash wv × hv, glass gw × gh)
    const sizes = Object.fromEntries(bl2.body.data.lines.map((l) => [l.partLabel, l.size]));
    expect(sizes).toMatchObject({ "Vantail 1": "895 × 1190", "Vitrage 1": "823 × 1118", Moustiquaire: "895 × 1190" });
    await request(app).post(`/api/logistics/delivery-notes/${bl2.body.data._id}/status`).set(h(logToken)).send({ status: "delivered", receivedBy: "Chef de chantier" }).expect(200);
    await reload();
    expect(unit("F1-1").status).toBe("delivered");
    await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h(logToken)).send({ action: "installed", targets: [{ unit: unit("F1-1")._id }] }).expect(200);
    await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h(logToken)).send({ action: "received", targets: [{ unit: unit("F1-1")._id }] }).expect(200);
    await reload();
    expect(unit("F1-1").status).toBe("received");
    // A delivered note whose parts are installed can't be cancelled (return)
    const back = await request(app).post(`/api/logistics/delivery-notes/${bl2.body.data._id}/status`).set(h(logToken)).send({ status: "cancelled", reason: "retour" });
    expect(back.status).toBe(400);
  });

  it("handles a return, a size change after production and a cancelled chassis", async () => {
    // Return of BL1 (cancel a delivered note): deliveredQty goes back, expense removed
    const ret = await request(app).post(`/api/logistics/delivery-notes/${bl1._id}/status`).set(h(logToken)).send({ status: "cancelled", reason: "Retour atelier" });
    expect(ret.status).toBe(400); // F1-1's frame is installed → refused
    // F1-2: change its ouvrage size after its frame was made → flagged "modified"
    const project = await request(app).get(`/api/projects/${projectId}`).set(h());
    const f1 = project.body.data.items.find((i) => i.ref === "F1");
    await request(app).put(`/api/projects/${projectId}/items/${f1._id}`).set(h()).send({ L: 1850 }).expect(200);
    await reload();
    expect(unit("F1-2").modified).toBe(true);
    expect(unit("F1-2").L).toBe(1850);
    expect(part("F1-2", "dormant").deliveredQty).toBe(1); // delivered stays recorded
    expect(unit("F1-3").modified).toBe(false); // not started: silently updated
    // Cancel F1-3: the ouvrage goes from 3 to 2
    const c = await request(app).post(`/api/tracking/units/${unit("F1-3")._id}/cancel`).set(h()).send({ reason: "Supprimé par le client" });
    expect(c.status).toBe(200);
    const data = await reload();
    expect(unit("F1-3").status).toBe("cancelled");
    expect(data.summary.units).toBe(3);
    expect(data.summary.cancelled).toBe(1);
    const p2 = await request(app).get(`/api/projects/${projectId}`).set(h());
    expect(p2.body.data.items.find((i) => i.ref === "F1").quantity).toBe(2);
    // Custom breakdown: split MR modules into "Modules niveau 1" (6) and "niveau 2" (6)
    const mr = unit("MR");
    const modules = mr.parts.find((x) => x.key === "modules");
    const tooSmall = await request(app).put(`/api/tracking/units/${mr._id}/parts`).set(h()).send({ parts: [...mr.parts.filter((x) => x.key !== "modules"), { _id: modules._id, label: "Modules niveau 1", kind: "module", quantity: 3 }, { label: "Modules niveau 2", kind: "module", quantity: 6 }] });
    expect(tooSmall.status).toBe(400); // 4 already delivered
    const ok = await request(app).put(`/api/tracking/units/${mr._id}/parts`).set(h()).send({ parts: [...mr.parts.filter((x) => x.key !== "modules"), { _id: modules._id, label: "Modules niveau 1", kind: "module", quantity: 6 }, { label: "Modules niveau 2", kind: "module", quantity: 6 }] });
    expect(ok.status).toBe(200);
    await reload();
    expect(unit("MR").parts.filter((x) => x.kind === "module").map((x) => [x.label, x.quantity, x.deliveredQty])).toEqual([["Modules niveau 1", 6, 4], ["Modules niveau 2", 6, 0]]);
  });

  it("overview and access rules", async () => {
    const ov = await request(app).get(`/api/tracking/projects?companyId=${companyId}`).set(h(logToken));
    expect(ov.status).toBe(200);
    const row = ov.body.data.find((p) => p._id === projectId);
    expect(row.summary.units).toBe(3);
    expect(row.lastDelivery.number).toMatch(/^BL-\d{4}-0002$/); // the most recent delivered note
    // Sales can read the tracking but not change it, nor use logistics
    expect((await request(app).get(`/api/tracking/projects/${projectId}`).set(h(salesToken))).status).toBe(200);
    expect((await request(app).post(`/api/tracking/projects/${projectId}/actions`).set(h(salesToken)).send({ action: "made", targets: [{ unit: unit("MR")._id }] })).status).toBe(403);
    expect((await request(app).get(`/api/logistics/delivery-notes?companyId=${companyId}`).set(h(salesToken))).status).toBe(403);
    // Logistics can't cancel a chassis (a project decision)
    expect((await request(app).post(`/api/tracking/units/${unit("MR")._id}/cancel`).set(h(logToken)).send({})).status).toBe(403);
  });

  it("untouched chassis follow a model's new breakdown; started ones keep theirs", async () => {
    const p = await request(app).post("/api/projects").set(h()).send({ company: companyId, name: "Résidence" });
    const pid = p.body.data._id;
    await request(app).post(`/api/projects/${pid}/items`).set(h()).send({ model: slidingId, ref: "C", L: 1500, H: 1200, quantity: 2 }).expect(201);
    let tr = (await request(app).get(`/api/tracking/projects/${pid}`).set(h())).body.data.units;
    const c1 = tr.find((u) => u.ref === "C-1");
    await request(app).post(`/api/tracking/projects/${pid}/actions`).set(h()).send({ action: "started", targets: [{ unit: c1._id, part: c1.parts[0]._id }] }).expect(200);
    // The company groups sashes again (no per-piece tracking)
    await tenantScope.runAsSystem(() => ChassisModel.updateOne({ _id: slidingId, "deliveryParts.key": "vantaux" }, { $set: { "deliveryParts.$.perPiece": false } }));
    await request(app).post(`/api/tracking/projects/${pid}/sync`).set(h()).expect(200);
    tr = (await request(app).get(`/api/tracking/projects/${pid}`).set(h())).body.data.units;
    expect(tr.find((u) => u.ref === "C-2").parts.map((x) => x.label)).toContain("Vantaux");
    expect(tr.find((u) => u.ref === "C-1").parts.map((x) => x.label)).toContain("Vantail 1");
  });
});
