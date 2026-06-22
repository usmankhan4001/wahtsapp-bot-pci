// Bitrix24 product-property IDs used by the PCI catalog, and the shapes the
// existing calculator backend returns. Mapping confirmed against the live API
// (https://calcenchancev2.premierchoiceint.online).

export const PROP = {
  PROJECT: 173, // enum: project name  (e.g. 597 = "Box Park-2")
  TYPE: 177, // enum: property type (e.g. 665 = COMMERCIAL, 663 = RESIDENTIAL)
  CATEGORY: 139, // enum: category
  FLOOR: 135, // enum: floor (e.g. 253 = "1ST FLOOR")
  AVAILABILITY: 99, // enum: status; value "155" = available
  BASE_RATE: 115, // numeric string e.g. "22,500.00"
  GROSS_AREA: 113, // numeric string e.g. "170.3"
  NET_AREA: 149, // numeric string
} as const;

/** value "155" on PROPERTY_99 means the unit is available. */
export const AVAILABLE_VALUE = "155";

/** A Bitrix enum option (project / type / floor / category). */
export interface BitrixEnum {
  id: number;
  value: string;
  sort?: number;
  propertyId?: number;
  xmlId?: string;
}

/** A property field on a product, e.g. { valueId, value }. */
export interface BitrixPropValue {
  valueId: string;
  value: string;
}

/** Raw product row from /catalog-products. */
export interface CatalogProduct {
  ID: string;
  NAME: string;
  PRICE: string | null;
  PROPERTY_139?: BitrixPropValue; // category
  PROPERTY_173?: BitrixPropValue; // project
  PROPERTY_177?: BitrixPropValue; // type
}

/** Raw product detail from /product (only the fields we use are typed). */
export interface ProductDetail {
  ID: string;
  NAME: string;
  ACTIVE: string;
  PROPERTY_99?: BitrixPropValue; // availability
  PROPERTY_113?: BitrixPropValue; // gross area
  PROPERTY_115?: BitrixPropValue; // base rate
  PROPERTY_135?: BitrixPropValue; // floor
  PROPERTY_139?: BitrixPropValue; // category
  PROPERTY_149?: BitrixPropValue; // net area
  PROPERTY_173?: BitrixPropValue; // project
  PROPERTY_177?: BitrixPropValue; // type
  [key: string]: unknown;
}

/** Filter accepted by /catalog-products — values are enum IDs (as strings). */
export interface UnitFilter {
  project?: string;
  propertyType?: string;
  propertyCategory?: string;
  propertyFloor?: string;
}

/** Normalized, bot-friendly view of a unit (after resolving enums + price). */
export interface NormalizedUnit {
  id: string;
  name: string;
  projectId?: string;
  projectName?: string;
  typeId?: string;
  typeName?: string;
  categoryId?: string;
  categoryName?: string;
  floorId?: string;
  floorName?: string;
  baseRate?: number;
  grossArea?: number;
  netArea?: number;
  /** baseRate * grossArea (PCI default pricing). */
  totalPrice?: number;
  available?: boolean;
}
