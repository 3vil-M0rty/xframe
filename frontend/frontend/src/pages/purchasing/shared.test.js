import { describe, it, expect } from "vitest";
import { applySupplierPrices, supplierPriceFor } from "./shared";

const steel = { _id: "p1", name: "Tôle acier 2mm", prices: [
  { supplierName: "AcierPlus", price: 12.5, supplierReference: "AP-2MM" },
  { supplierName: "MetalSud", price: 11.9 },
] };
const gloves = { _id: "p2", name: "Gants", prices: [{ supplierName: "EquipPro", price: 18 }] };
const products = [steel, gloves];

describe("purchase order prices come from the article's supplier price", () => {
  it("reads the price recorded for THAT supplier (not just the first one)", () => {
    expect(supplierPriceFor(steel, "MetalSud")).toBe(11.9);
    expect(supplierPriceFor(steel, "AcierPlus")).toBe(12.5);
    expect(supplierPriceFor(steel, "Unknown")).toBeNull();
  });

  it("fills article lines with the supplier's price; flags articles with no price for it", () => {
    const { lines, changed } = applySupplierPrices(
      [{ product: "p1", quantity: 100 }, { product: "p2", quantity: 10 }], products, "AcierPlus");
    expect(changed).toBe(true);
    expect(lines[0]).toMatchObject({ unitPrice: 12.5, priceSource: "article" });
    expect(lines[1]).toMatchObject({ unitPrice: "", priceSource: "missing" });
  });

  it("changing the supplier re-applies prices on auto-filled lines", () => {
    const first = applySupplierPrices([{ product: "p1" }], products, "AcierPlus").lines;
    const { lines } = applySupplierPrices(first, products, "MetalSud");
    expect(lines[0].unitPrice).toBe(11.9);
  });

  it("never overwrites a price typed by hand, nor touches free-text lines", () => {
    const { lines, changed } = applySupplierPrices(
      [{ product: "p1", unitPrice: 10, priceSource: "manual" }, { product: "", description: "Service", unitPrice: 300 }],
      products, "AcierPlus");
    expect(changed).toBe(false);
    expect(lines[0].unitPrice).toBe(10);
    expect(lines[1].unitPrice).toBe(300);
  });

  it("does nothing until a supplier is chosen", () => {
    const input = [{ product: "p1" }];
    expect(applySupplierPrices(input, products, "")).toEqual({ lines: input, changed: false });
  });
});
