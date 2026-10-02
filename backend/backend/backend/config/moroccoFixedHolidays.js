/**
 * Morocco's FIXED-DATE public holidays (jours fériés chômés et payés),
 * used only to pre-fill the import template for a given year — HR
 * still reviews the file before importing it.
 *
 * NOT included: the religious holidays (Aïd al-Fitr, Aïd al-Adha,
 * 1er Moharram, Aïd al-Mawlid). They follow the lunar calendar,
 * move every year, and are confirmed by official announcement close
 * to the date — HR adds them to the file.
 *
 * 31 October (Fête de l'Unité) was added by royal decision in
 * November 2025 (décret n° 2.26.14 for the private sector).
 */
const MOROCCO_FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: "Nouvel An" },
  { month: 1, day: 11, name: "Manifeste de l'Indépendance" },
  { month: 1, day: 14, name: "Nouvel An Amazigh" },
  { month: 5, day: 1, name: "Fête du Travail" },
  { month: 7, day: 30, name: "Fête du Trône" },
  { month: 8, day: 14, name: "Allégeance Oued Eddahab" },
  { month: 8, day: 20, name: "Révolution du Roi et du Peuple" },
  { month: 8, day: 21, name: "Fête de la Jeunesse" },
  { month: 10, day: 31, name: "Fête de l'Unité" },
  { month: 11, day: 6, name: "Marche Verte" },
  { month: 11, day: 18, name: "Fête de l'Indépendance" },
];

module.exports = { MOROCCO_FIXED_HOLIDAYS };
