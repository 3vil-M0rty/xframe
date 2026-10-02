const PDFDocument = require("pdfkit");

const {
  formatDate,
  formatAmount,
  seniorityLabel,
  employeeFullName,
  buildDocumentRef,
  drawLetterhead,
  drawDocumentTitle,
  drawSignatureBlock,
  finalizeFooters,
} = require("./pdfHelpers");

/**
 * ============================================================
 * CONTRAT DE TRAVAIL & REÇU POUR SOLDE DE TOUT COMPTE
 * ============================================================
 * The onboarding/offboarding companions to the attestations in
 * employeeDocumentsPdfService.js:
 *
 *   - Contrat de travail: an employment contract drafted from the
 *     Contract record's own data (type, dates, job title) and the
 *     employee's current salary. Deliberately kept to the clauses
 *     that are the SAME for every employer — duration, remuneration,
 *     workplace, statutory affiliation — and explicitly says so
 *     where something (trial period length, notice period) legally
 *     depends on the employee's category or a collective bargaining
 *     agreement this system has no way to know: those clauses cite
 *     the relevant Code du Travail article instead of asserting a
 *     specific number that might be wrong for this employee. This
 *     is a drafting aid, not a substitute for legal review before
 *     it's actually signed.
 *
 *   - Reçu pour solde de tout compte: the final settlement receipt
 *     handed over alongside the Certificat de travail when
 *     someone leaves — prorated final salary, unused paid leave
 *     payout (from leaveBalanceService), and a REFERENCE severance
 *     figure computed from Article 53's tiered formula. That last
 *     one is explicitly labeled as a reference: severance is only
 *     legally owed in specific termination circumstances (not
 *     resignation, not end of a CDD, not gross misconduct), which
 *     this system has no "termination reason" field to know — HR
 *     confirms whether it actually applies before using this
 *     figure, the document says so directly.
 * ============================================================
 */

function guardEmployeeAndCompany(employee, company) {
  if (!employee) throw new Error("employee is required");
  if (!company) throw new Error("company is required");
}

function legalRepLine(company) {
  const legalRep = company?.owner && `${company.owner.firstName || ""} ${company.owner.lastName || ""}`.trim();
  return legalRep
    ? `${legalRep}, représentant légal de la société ${company?.name || "—"}`
    : `La société ${company?.name || "—"}`;
}

const CONTRACT_TYPE_LABELS = {
  permanent: "à durée indéterminée (CDI)",
  fixed_term: "à durée déterminée (CDD)",
  temporary: "temporaire",
  intern: "de stage",
  apprentice: "d'apprentissage",
  freelance: "de prestation (freelance)",
  part_time: "à temps partiel",
  other: "",
};

function drawParagraph(doc, { colX, width, text, bold = false }) {
  doc.fontSize(10).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor("#000");
  doc.text(text, colX, doc.y, { width, align: "justify", lineGap: 4 });
}

function drawArticleHeading(doc, text, { colX, width }) {
  doc.moveDown(0.7);
  doc.fontSize(10.5).font("Helvetica-Bold").fillColor("#000").text(text, colX, doc.y, { width });
  doc.moveDown(0.2);
}

function generateContratTravail({ employee, company, contract, salary, logoBuffer }) {
  guardEmployeeAndCompany(employee, company);
  if (!contract) throw new Error("contract is required");

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { colX, width } = drawLetterhead(doc, company, { logoBuffer });
  const ref = buildDocumentRef("CTR", employee?.employeeNumber);
  const typeLabel = CONTRACT_TYPE_LABELS[contract.type] || contract.type || "—";
  drawDocumentTitle(doc, `CONTRAT DE TRAVAIL ${typeLabel.toUpperCase()}`, { colX, width, ref });

  drawParagraph(doc, {
    colX,
    width,
    text:
      `Entre les soussignés :\n\n` +
      `${legalRepLine(company)}, ci-après désignée « l'Employeur »,\n\n` +
      `Et\n\n` +
      `${employeeFullName(employee)}, titulaire de la CIN n° ${employee?.cin || "—"}, ` +
      `né(e) le ${formatDate(employee?.dateOfBirth)}, ci-après désigné(e) « le/la Salarié(e) »,\n\n` +
      `Il a été convenu ce qui suit :`,
  });

  drawArticleHeading(doc, "Article 1 — Objet et fonction", { colX, width });
  drawParagraph(doc, {
    colX, width,
    text: `L'Employeur engage le/la Salarié(e) en qualité de ${contract.jobTitle || employee?.jobTitle || "—"}` +
      (contract.department ? `, au sein du département ${contract.department}` : "") + `.`,
  });

  drawArticleHeading(doc, "Article 2 — Durée du contrat", { colX, width });
  drawParagraph(doc, {
    colX, width,
    text: contract.endDate
      ? `Le présent contrat est conclu ${typeLabel}, à compter du ${formatDate(contract.startDate)} et jusqu'au ${formatDate(contract.endDate)}.`
      : `Le présent contrat est conclu ${typeLabel}, à compter du ${formatDate(contract.startDate)}.`,
  });

  drawArticleHeading(doc, "Article 3 — Période d'essai", { colX, width });
  drawParagraph(doc, {
    colX, width,
    text: `Le présent contrat est soumis à une période d'essai conformément aux dispositions des articles 13 et 14 du Code du Travail, dont la durée dépend de la catégorie professionnelle du/de la Salarié(e).`,
  });

  drawArticleHeading(doc, "Article 4 — Rémunération", { colX, width });
  drawParagraph(doc, {
    colX, width,
    text: salary
      ? `En contrepartie de son travail, le/la Salarié(e) percevra un salaire mensuel brut de ${formatAmount(salary.baseSalary)} ${salary.currency || "MAD"}, payable mensuellement, soumis aux cotisations sociales et fiscales en vigueur.`
      : `Les conditions de rémunération seront précisées par avenant au présent contrat.`,
  });

  drawArticleHeading(doc, "Article 5 — Lieu et horaires de travail", { colX, width });
  drawParagraph(doc, {
    colX, width,
    text: `Le/la Salarié(e) exercera ses fonctions ${employee?.workLocation ? `à ${employee.workLocation}` : "au lieu défini par l'Employeur"}, selon l'horaire de travail en vigueur au sein de l'entreprise, dans la limite de la durée légale du travail fixée par l'article 184 du Code du Travail.`,
  });

  drawArticleHeading(doc, "Article 6 — Affiliation sociale", { colX, width });
  drawParagraph(doc, {
    colX, width,
    text: `Le/la Salarié(e) sera affilié(e) à la Caisse Nationale de Sécurité Sociale (CNSS)` +
      (employee?.cnssNumber ? ` sous le numéro ${employee.cnssNumber}` : "") + `, conformément à la législation en vigueur.`,
  });

  drawArticleHeading(doc, "Article 7 — Résiliation", { colX, width });
  drawParagraph(doc, {
    colX, width,
    text: `Toute résiliation du présent contrat sera régie par les dispositions du Code du Travail relatives à la rupture du contrat de travail, notamment en matière de préavis et d'indemnités, selon le cas applicable.`,
  });

  doc.moveDown(1);
  doc.fontSize(8).font("Helvetica-Oblique").fillColor("#888").text(
    "Ce document est généré automatiquement à partir des informations enregistrées dans le système et constitue une base de rédaction. " +
    "Il est recommandé de le faire relire par un professionnel du droit du travail avant signature, notamment pour les clauses dépendant de la convention collective applicable.",
    colX, doc.y, { width, align: "justify" }
  );

  drawSignatureBlock(doc, { city: company?.address?.city, companyName: company?.name, colX, width });
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor("#000").text(
    "Signature du/de la Salarié(e) (précédée de la mention « Lu et approuvé ») :",
    colX, doc.y, { width }
  );

  finalizeFooters(doc, company);
  return doc;
}

/**
 * Article 53 of the Code du Travail's tiered severance formula, in
 * HOURS of salary per year of service:
 *   years 1–5:   96h/year
 *   years 6–10:  144h/year
 *   years 11–15: 192h/year
 *   years 16+:   240h/year
 * Converted here to a monetary reference using a 191h/month
 * standard (the usual conversion for Morocco's 44h/week legal
 * duration) — NOT a definitive legal figure, see the caller.
 */
function estimateSeverance(monthlyGrossSalary, seniorityYears) {
  if (!monthlyGrossSalary || seniorityYears <= 0) return 0;
  const hourlyRate = monthlyGrossSalary / 191;

  let hours = 0;
  const tiers = [
    { upTo: 5, rate: 96 },
    { upTo: 10, rate: 144 },
    { upTo: 15, rate: 192 },
    { upTo: Infinity, rate: 240 },
  ];
  let remaining = seniorityYears;
  let previousUpTo = 0;
  for (const tier of tiers) {
    const yearsInTier = Math.max(0, Math.min(remaining, tier.upTo - previousUpTo));
    hours += yearsInTier * tier.rate;
    remaining -= yearsInTier;
    previousUpTo = tier.upTo;
    if (remaining <= 0) break;
  }

  return Math.round(hourlyRate * hours * 100) / 100;
}

function generateSoldeToutCompte({ employee, company, salary, leaveBalance, terminationDate, logoBuffer }) {
  guardEmployeeAndCompany(employee, company);

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const { colX, width } = drawLetterhead(doc, company, { logoBuffer });
  const ref = buildDocumentRef("STC", employee?.employeeNumber);
  drawDocumentTitle(doc, "REÇU POUR SOLDE DE TOUT COMPTE", { colX, width, ref });

  const endDate = terminationDate || new Date();
  const currency = salary?.currency || "MAD";
  const monthlySalary = salary?.baseSalary || 0;

  // Prorated final month: days actually worked in the departure
  // month over the total days in that month.
  const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  const daysWorked = endDate.getDate();
  const proratedSalary = Math.round((monthlySalary / daysInMonth) * daysWorked * 100) / 100;

  // Unused paid leave, valued at a 26-working-day/month rate — the
  // conventional Moroccan payroll divisor.
  const dailyRate = monthlySalary / 26;
  const leavePayout = leaveBalance ? Math.round(leaveBalance.remainingDays * dailyRate * 100) / 100 : 0;

  const seniorityYears = employee?.hireDate
    ? (endDate.getTime() - new Date(employee.hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;
  const severanceReference = estimateSeverance(monthlySalary, seniorityYears);

  const total = proratedSalary + leavePayout;

  drawParagraph(doc, {
    colX, width,
    text:
      `${legalRepLine(company)} certifie que le compte de tout ce qui est dû à ` +
      `${employeeFullName(employee)}, titulaire de la CIN n° ${employee?.cin || "—"}, employé(e) du ` +
      `${formatDate(employee?.hireDate)} au ${formatDate(endDate)} (soit ${seniorityLabel(employee?.hireDate, endDate)} d'ancienneté), ` +
      `au titre de la rupture de son contrat de travail, se présente comme suit :`,
  });

  doc.moveDown(0.8);

  const rows = [
    ["Salaire du dernier mois (prorata)", `${formatAmount(proratedSalary)} ${currency}`],
    [`Indemnité compensatrice de congés payés (${leaveBalance?.remainingDays ?? 0} jour(s))`, `${formatAmount(leavePayout)} ${currency}`],
  ];

  rows.forEach(([label, amount]) => {
    const y = doc.y;
    doc.fontSize(9.5).font("Helvetica").fillColor("#000").text(label, colX, y, { width: width * 0.65 });
    doc.fontSize(9.5).font("Helvetica-Bold").text(amount, colX + width * 0.65, y, { width: width * 0.35, align: "right" });
    doc.moveDown(0.5);
  });

  doc.moveDown(0.3);
  doc.moveTo(colX, doc.y).lineTo(colX + width, doc.y).lineWidth(0.75).stroke("#999");
  doc.moveDown(0.5);

  const totalY = doc.y;
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text("TOTAL À PAYER", colX, totalY, { width: width * 0.65 });
  doc.fontSize(11).font("Helvetica-Bold").text(`${formatAmount(total)} ${currency}`, colX + width * 0.65, totalY, { width: width * 0.35, align: "right" });

  doc.moveDown(1.2);
  doc.fontSize(8.5).font("Helvetica").fillColor("#555").text(
    `Indemnité de licenciement (référence, article 53 du Code du Travail) : ${formatAmount(severanceReference)} ${currency}`,
    colX, doc.y, { width }
  );
  doc.moveDown(0.3);
  doc.fontSize(8).font("Helvetica-Oblique").fillColor("#888").text(
    "Ce montant est une estimation calculée sur la base du barème légal de l'article 53 et ne constitue pas une indemnité automatiquement due. " +
    "L'indemnité de licenciement n'est légalement exigible que dans certaines circonstances de rupture (licenciement, hors démission, fin de CDD ou faute grave) " +
    "— à valider par l'Employeur avant tout paiement, et à ajouter au total ci-dessus le cas échéant.",
    colX, doc.y, { width, align: "justify" }
  );

  doc.moveDown(1);
  drawParagraph(doc, {
    colX, width,
    text: "Le/la Salarié(e) reconnaît avoir reçu la somme indiquée ci-dessus et n'avoir plus aucune réclamation à formuler à l'égard de l'Employeur au titre de l'exécution ou de la rupture de son contrat de travail.",
  });

  drawSignatureBlock(doc, { city: company?.address?.city, companyName: company?.name, colX, width });
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor("#000").text(
    "Signature du/de la Salarié(e) (précédée de la mention « Pour solde de tout compte ») :",
    colX, doc.y, { width }
  );

  finalizeFooters(doc, company);
  return doc;
}

module.exports = { generateContratTravail, generateSoldeToutCompte, estimateSeverance };
