const InventoryMovement = require("../models/InventoryMovement");

/**
 * Records a movement AND keeps Product.quantity in sync in the
 * same call — every quantity change in this file goes through
 * this one function so the two can never drift apart.
 */
async function applyMovement({ product, type, quantity, reason, actorId }) {
  let newQuantity = product.quantity;
  if (type === "in") newQuantity += quantity;
  else if (type === "out") newQuantity -= quantity;
  else newQuantity = quantity; // "adjustment" sets an absolute value

  if (newQuantity < 0) {
    const error = new Error("This would bring the quantity below zero.");
    error.status = 400;
    throw error;
  }

  await InventoryMovement.create({
    company: product.company,
    product: product._id,
    type,
    quantity: type === "adjustment" ? Math.abs(newQuantity - product.quantity) : quantity,
    resultingQuantity: newQuantity,
    reason,
    performedBy: actorId,
  });

  product.quantity = newQuantity;
  product.updatedBy = actorId;
  await product.save();

  return product;
}

module.exports = { applyMovement };
