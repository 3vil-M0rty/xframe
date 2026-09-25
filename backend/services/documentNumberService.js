/**
 * Sequential, human-readable document numbers per company and year:
 * BC-2026-0001 (bon de commande), DP-2026-0001 (demande de prix).
 *
 * Reads the highest existing number for the year and adds one. Two
 * simultaneous creations could pick the same number; the models have
 * a unique { company, number } index, so the loser gets E11000 and
 * createWithNumber() simply retries with the next number.
 */
async function nextNumber(Model, companyId, prefix, date = new Date()) {
  const year = new Date(date).getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const last = await Model.findOne({ company: companyId, number: { $regex: pattern } })
    .sort({ number: -1 })
    .select("number")
    .lean();
  const next = last ? Number(last.number.match(pattern)[1]) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

async function createWithNumber(Model, data, prefix, attempts = 5) {
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const number = await nextNumber(Model, data.company, prefix, data.date);
    try {
      // eslint-disable-next-line no-await-in-loop
      return await Model.create({ ...data, number });
    } catch (error) {
      if (error.code !== 11000 || i === attempts - 1) throw error;
    }
  }
  return null;
}

module.exports = { nextNumber, createWithNumber };
