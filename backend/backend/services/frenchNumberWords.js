/**
 * Amounts in French words, the way Moroccan commercial documents
 * write them: "mille deux cent trente-quatre dirhams et cinquante
 * centimes". Follows the standard (pre-1990) French spelling rules:
 *   - "et" in 21, 31, 41, 51, 61, 71 ("vingt et un", "soixante et onze")
 *   - 70-79 = soixante-dix..., 80 = "quatre-vingts", 81-99 = "quatre-vingt-..."
 *   - "cent" takes an s only when multiplied and final ("deux cents",
 *     but "deux cent un"); "mille" never takes an s; "un mille" -> "mille"
 *   - "million(s)", "milliard(s)" are nouns and do agree
 */

const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function below100(n) {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t];
    if (u === 1) return `${TENS[t]} et un`;
    return `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) {
    // 70-79: soixante-dix, soixante et onze, soixante-douze...
    return n === 71 ? "soixante et onze" : `soixante-${UNITS[n - 60]}`;
  }
  // 80-99
  const rest = n - 80;
  if (rest === 0) return "quatre-vingts";
  return `quatre-vingt-${UNITS[rest]}`;
}

function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return below100(r);
  const hundreds = h === 1 ? "cent" : `${UNITS[h]} cent${r === 0 ? "s" : ""}`;
  return r === 0 ? hundreds : `${hundreds} ${below100(r)}`;
}

/** Integer >= 0 in French words. */
function integerToFrenchWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "zéro";
  const parts = [];
  const scales = [
    [1e9, "milliard", "milliards"],
    [1e6, "million", "millions"],
  ];
  for (const [size, singular, plural] of scales) {
    const count = Math.floor(n / size);
    if (count > 0) {
      parts.push(`${below1000(count)} ${count > 1 ? plural : singular}`);
      n %= size;
    }
  }
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    // "mille", never "un mille"; and a multiplied "cent" before mille
    // drops its s ("deux cent mille").
    const words = thousands === 1 ? "" : below1000(thousands).replace(/cents$/, "cent");
    parts.push(words ? `${words} mille` : "mille");
    n %= 1000;
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(" ");
}

/** "1 234,50" -> "mille deux cent trente-quatre dirhams et cinquante centimes" */
function amountToFrenchWords(amount, { currency = "dirham", subunit = "centime" } = {}) {
  const total = Math.round((Number(amount) || 0) * 100);
  const whole = Math.floor(total / 100);
  const cents = total % 100;
  const wholeWords = `${integerToFrenchWords(whole)} ${currency}${whole > 1 ? "s" : ""}`;
  if (cents === 0) return wholeWords;
  return `${wholeWords} et ${integerToFrenchWords(cents)} ${subunit}${cents > 1 ? "s" : ""}`;
}

module.exports = { integerToFrenchWords, amountToFrenchWords };
