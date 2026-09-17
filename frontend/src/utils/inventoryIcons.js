import {
  Package, Package2, PackageOpen, Boxes, Box, Archive, Container,
  Warehouse, Factory, Wrench, Hammer, Cog, Truck, ShoppingCart,
  Layers, Beaker, FlaskConical, Droplet, Flame, Leaf, Wheat,
  Shirt, Scissors, PaintBucket, Palette, CircuitBoard, Cpu,
  Battery, Fuel, Nut, Bolt, Gem, Paperclip, Ruler, Hexagon,
  Pill, Milk, Apple, Coffee, Fish, Beef, Egg, Carrot,
  Recycle, Trash2, Dumbbell, Car, Bike, Plane, Ship, Building2,
  Tag, Barcode, ClipboardList, Star,
} from "lucide-react";

/**
 * Name → component lookup, used both by the icon picker (to render
 * the grid of choices) and anywhere a category's stored icon name
 * needs to become an actual <Icon /> (e.g. the Inventory page).
 * Categories store the icon as a plain string (see
 * models/InventoryCategory.js) so the backend never needs to know
 * about Lucide — this map is the only place that connects the two.
 */
export const INVENTORY_ICONS = {
  Package, Package2, PackageOpen, Boxes, Box, Archive, Container,
  Warehouse, Factory, Wrench, Hammer, Cog, Truck, ShoppingCart,
  Layers, Beaker, FlaskConical, Droplet, Flame, Leaf, Wheat,
  Shirt, Scissors, PaintBucket, Palette, CircuitBoard, Cpu,
  Battery, Fuel, Nut, Bolt, Gem, Paperclip, Ruler, Hexagon,
  Pill, Milk, Apple, Coffee, Fish, Beef, Egg, Carrot,
  Recycle, Trash2, Dumbbell, Car, Bike, Plane, Ship, Building2,
  Tag, Barcode, ClipboardList, Star,
};

export const INVENTORY_ICON_NAMES = Object.keys(INVENTORY_ICONS);

/**
 * Resolves a stored icon name to its component, falling back to a
 * generic box icon for names that aren't in the curated set (e.g.
 * if the list here is ever trimmed after a category already used
 * one that got removed).
 */
export function getInventoryIcon(name) {
  return INVENTORY_ICONS[name] || Package;
}
