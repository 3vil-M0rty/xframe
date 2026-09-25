import { describe, it, expect } from "vitest";
const { integerToFrenchWords: w, amountToFrenchWords: a } = require("./frenchNumberWords");

describe("French number words (amounts on commercial documents)", () => {
  it("the tricky tens: et-un, soixante-dix, quatre-vingts", () => {
    expect(w(21)).toBe("vingt et un");
    expect(w(71)).toBe("soixante et onze");
    expect(w(72)).toBe("soixante-douze");
    expect(w(80)).toBe("quatre-vingts");
    expect(w(81)).toBe("quatre-vingt-un");
    expect(w(91)).toBe("quatre-vingt-onze");
    expect(w(99)).toBe("quatre-vingt-dix-neuf");
  });

  it("cent / cents agreement", () => {
    expect(w(100)).toBe("cent");
    expect(w(200)).toBe("deux cents");
    expect(w(201)).toBe("deux cent un");
    expect(w(280)).toBe("deux cent quatre-vingts");
  });

  it("mille never takes an s, and is never 'un mille'", () => {
    expect(w(1000)).toBe("mille");
    expect(w(2000)).toBe("deux mille");
    expect(w(200000)).toBe("deux cent mille");
    expect(w(1234)).toBe("mille deux cent trente-quatre");
  });

  it("millions agree", () => {
    expect(w(1000000)).toBe("un million");
    expect(w(2500000)).toBe("deux millions cinq cent mille");
  });

  it("amounts in dirhams and centimes", () => {
    expect(a(3000)).toBe("trois mille dirhams");
    expect(a(1)).toBe("un dirham");
    expect(a(1234.5)).toBe("mille deux cent trente-quatre dirhams et cinquante centimes");
    expect(a(0.01)).toBe("zéro dirham et un centime");
    expect(a(3780)).toBe("trois mille sept cent quatre-vingts dirhams");
  });
});
