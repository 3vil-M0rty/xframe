// Builds a CNSS préétabli file (A00–A03) for tests and the demo seed.
const { buildLine } = require("../services/damancomService");

function makePreetabli({ affiliate = "1234567", period = "202609", employees = [], transferId = "00000000012345" } = {}) {
  const swap = (line, type) => type + line.slice(3);
  const lines = [
    swap(buildLine("B00", { N_Identif_Transfert: transferId, L_Cat: "A0" }), "A00"),
    swap(buildLine("B01", {
      N_Num_Affilie: affiliate, L_Periode: period, L_Raison_Sociale: "ATLAS INDUSTRIES", L_Activite: "INDUSTRIE",
      L_Adresse: "ZONE INDUSTRIELLE AIN SEBAA", L_Ville: "CASABLANCA", C_Code_Postal: "20250", C_Code_Agence: "01",
      D_Date_Emission: `${period}01`, D_Date_Exig: `${period}28`,
    }), "A01"),
  ];
  // A02 has the same first fields as B04's… build it field by field instead.
  const { RECORDS } = require("../config/cnssBdsLayout");
  const { formatField } = require("../services/damancomService");
  for (const e of employees) {
    const values = { N_Num_Affilie: affiliate, L_Periode: period, N_Num_Assure: e.cnss, L_Nom_Prenom: e.name, N_Enfants: e.children || 0, N_AF_A_Payer: e.af || 0, N_AF_A_Deduire: 0, N_AF_Net_A_Payer: e.af || 0 };
    lines.push("A02" + RECORDS.A02.map(([n, l, t]) => formatField(values[n], l, t)).join(""));
  }
  const recap = { N_Num_Affilie: affiliate, L_Periode: period, N_Nbr_Salaries: employees.length, N_T_Num_Imma: employees.reduce((s, e) => s + Number(e.cnss), 0) };
  lines.push("A03" + RECORDS.A03.map(([n, l, t]) => formatField(recap[n], l, t)).join(""));
  return lines.join("\r\n") + "\r\n";
}

module.exports = { makePreetabli };
