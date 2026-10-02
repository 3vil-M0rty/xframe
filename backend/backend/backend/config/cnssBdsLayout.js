/**
 * ============================================================
 * CNSS — DAMANCOM "échange de fichiers" (EDI) record layouts
 * ============================================================
 * ⚠️ VALIDATE BEFORE THE FIRST REAL DECLARATION ⚠️
 * These layouts follow the CNSS cahier des charges for the BDS
 * (Bordereau de Déclaration des Salaires) file exchange, version 2.
 * I could not retrieve the official document to check it field
 * by field while building this. Before the first real declaration:
 *   1. get the current cahier des charges from your Damancom space
 *      (or your CNSS agency) and compare it with the tables below;
 *   2. upload a generated file on Damancom and read the control
 *      report. If CNSS rejects a field, fix it HERE (name, length,
 *      type) — services/damancomService.js reads everything from
 *      this file, nothing else needs to change.
 *
 * Conventions used:
 *   - every line is exactly LINE_LENGTH characters, CRLF-terminated;
 *   - "N" fields: digits only, right-aligned, zero-padded;
 *     amounts in CENTIMES (1 234,56 MAD → 123456);
 *   - "A" fields: left-aligned, space-padded, upper case, no accents;
 *   - "D" fields: dates as AAAAMMJJ.
 *
 * Préétabli (A0x): the file CNSS prepares each month (download it
 * from Damancom) — the list of the company's insured employees with
 * their family allowance lines. The declaration (B0x) must answer
 * it line for line, then list the new employees (entrants).
 * ============================================================
 */

const LINE_LENGTH = 260;

const HEADER_FIELDS = [
  ["N_Num_Affilie", 7, "N"],
  ["L_Periode", 6, "N"], // AAAAMM
  ["L_Raison_Sociale", 40, "A"],
  ["L_Activite", 40, "A"],
  ["L_Adresse", 120, "A"],
  ["L_Ville", 20, "A"],
  ["C_Code_Postal", 6, "A"],
  ["C_Code_Agence", 2, "A"],
  ["D_Date_Emission", 8, "D"],
  ["D_Date_Exig", 8, "D"],
];

const RECORDS = {
  // ---------- préétabli (read) ----------
  A00: [
    ["N_Identif_Transfert", 14, "N"],
    ["L_Cat", 2, "A"],
    ["L_filler", 241, "A"],
  ],
  A01: HEADER_FIELDS,
  A02: [
    ["N_Num_Affilie", 7, "N"],
    ["L_Periode", 6, "N"],
    ["N_Num_Assure", 9, "N"],
    ["L_Nom_Prenom", 60, "A"],
    ["N_Enfants", 2, "N"],
    ["N_AF_A_Payer", 6, "N"],
    ["N_AF_A_Deduire", 6, "N"],
    ["N_AF_Net_A_Payer", 6, "N"],
    ["L_filler", 155, "A"],
  ],
  A03: [
    ["N_Num_Affilie", 7, "N"],
    ["L_Periode", 6, "N"],
    ["N_Nbr_Salaries", 6, "N"],
    ["N_T_Enfants", 6, "N"],
    ["N_T_AF_A_Payer", 12, "N"],
    ["N_T_AF_A_Deduire", 12, "N"],
    ["N_T_AF_Net_A_Payer", 12, "N"],
    ["N_T_Num_Imma", 15, "N"],
    ["L_filler", 181, "A"],
  ],

  // ---------- déclaration (written) ----------
  B00: [
    ["N_Identif_Transfert", 14, "N"],
    ["L_Cat", 2, "A"],
    ["L_filler", 241, "A"],
  ],
  B01: HEADER_FIELDS,
  // one line per insured employee of the préétabli
  B02: [
    ["N_Num_Affilie", 7, "N"],
    ["L_Periode", 6, "N"],
    ["N_Num_Assure", 9, "N"],
    ["L_Nom_Prenom", 60, "A"],
    ["N_Enfants", 2, "N"],
    ["N_AF_A_Payer", 6, "N"],
    ["N_AF_A_Deduire", 6, "N"],
    ["N_AF_Net_A_Payer", 6, "N"],
    ["N_AF_A_Reverser", 6, "N"],
    ["N_Jours_Declares", 2, "N"],
    ["N_Salaire_Reel", 13, "N"],
    ["N_Salaire_Plaf", 9, "N"],
    ["L_Situation", 2, "A"],
    ["S_Ctr", 19, "N"],
    ["L_filler", 104, "A"],
  ],
  // recap of the B02 lines
  B03: [
    ["N_Num_Affilie", 7, "N"],
    ["L_Periode", 6, "N"],
    ["N_Nbr_Salaries", 6, "N"],
    ["N_T_Enfants", 6, "N"],
    ["N_T_AF_A_Payer", 12, "N"],
    ["N_T_AF_A_Deduire", 12, "N"],
    ["N_T_AF_Net_A_Payer", 12, "N"],
    ["N_T_AF_A_Reverser", 12, "N"],
    ["N_T_Num_Imma", 15, "N"],
    ["N_T_Jours_Declares", 6, "N"],
    ["N_T_Salaire_Reel", 15, "N"],
    ["N_T_Salaire_Plaf", 13, "N"],
    ["N_T_Ctr", 19, "N"],
    ["L_filler", 116, "A"],
  ],
  // one line per NEW employee (not in the préétabli)
  B04: [
    ["N_Num_Affilie", 7, "N"],
    ["L_Periode", 6, "N"],
    ["N_Num_Assure", 9, "N"],
    ["L_Nom_Prenom", 60, "A"],
    ["L_Num_CIN", 8, "A"],
    ["N_Nbr_Jours", 2, "N"],
    ["N_Sal_Reel", 13, "N"],
    ["N_Sal_Plaf", 9, "N"],
    ["S_Ctr", 19, "N"],
    ["L_filler", 124, "A"],
  ],
  // recap of the B04 lines
  B05: [
    ["N_Num_Affilie", 7, "N"],
    ["L_Periode", 6, "N"],
    ["N_Nbr_Salaries", 6, "N"],
    ["N_T_Num_Imma", 15, "N"],
    ["N_T_Jours_Declares", 6, "N"],
    ["N_T_Salaire_Reel", 15, "N"],
    ["N_T_Salaire_Plaf", 13, "N"],
    ["N_T_Ctr", 19, "N"],
    ["L_filler", 170, "A"],
  ],
  // global recap (B02 + B04)
  B06: [
    ["N_Num_Affilie", 7, "N"],
    ["L_Periode", 6, "N"],
    ["N_Nbr_Salaries", 6, "N"],
    ["N_T_Num_Imma", 15, "N"],
    ["N_T_Jours_Declares", 6, "N"],
    ["N_T_Salaire_Reel", 15, "N"],
    ["N_T_Salaire_Plaf", 13, "N"],
    ["N_T_Ctr", 19, "N"],
    ["L_filler", 170, "A"],
  ],
};

/**
 * L_Situation — why an insured employee of the préétabli has no (or
 * a partial) salary this month. Blank = normal. The numeric value
 * is the one added into the S_Ctr control sum.
 */
const SITUATIONS = {
  SO: { code: 1, label: "Sortant (a quitté l'entreprise)" },
  DE: { code: 2, label: "Décédé" },
  IT: { code: 3, label: "Maternité" },
  IL: { code: 4, label: "Maladie" },
  AT: { code: 5, label: "Accident de travail" },
  CS: { code: 6, label: "Congé sans solde" },
  MS: { code: 7, label: "Maladie de longue durée (sans solde)" },
  MP: { code: 8, label: "Maladie professionnelle" },
};

// Days declared for a full month (CNSS convention).
const MAX_DAYS = 26;

module.exports = { LINE_LENGTH, RECORDS, SITUATIONS, MAX_DAYS };
