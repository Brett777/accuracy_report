/**
 * Database row from property_clone / property tables.
 * Column names follow RESO naming conventions.
 */
export interface DbPropertyRow {
  ListingId: string;
  StandardStatus: string | null;
  OriginatingSystemName: string;
  ListPrice: string | null;
  ClosePrice: string | null;
  ListingContractDate: string | null;
  CloseDate: string | null;
  CloseDateTimestamp: Date | null;
  City: string | null;
  PostalCode: string | null;
  StreetNumber: string | null;
  StreetName: string | null;
  StreetSuffix: string | null;
  StreetDirSuffix: string | null;
  UnitNumber: string | null;
  Latitude: string | null;
  Longitude: string | null;
  DirectionFaces: string | null;
  PropertyType: string | null;
  PropertySubType: string | null;
  BedroomsTotal: string | null;
  BedroomsPossible: string | null;
  BathroomsFull: string | null;
  BathroomsHalf: string | null;
  AboveGradeFinishedArea: string | null;
  StoriesTotal: string | null;
  YearBuiltDetails: string | null;
  Basement: string | null;
  ConstructionMaterials: string | null;
  Heating: string | null;
  FireplaceYN: string | null;
  LotSizeSquareFeet: string | null;
  LotSizeArea: string | null;
  LotSizeAcres: string | null;
  LotSizeUnits: string | null;
  LotSizeDimensions: string | null;
  LotFeatures: string | null;
  GarageSpaces: string | null;
  ParkingTotal: string | null;
  ParkingFeatures: string | null;
  PoolFeatures: string | null;
  Appliances: string | null;
  InteriorFeatures: string | null;
  PetsAllowed: string | null;
  AssociationFee: string | null;
  AssociationName: string | null;
  AssociationAmenities: string | null;
  TaxAnnualAmount: string | null;
  OverallQuality: string | null;
  LivingRoomQuality: string | null;
  BackOfStructureQuality: string | null;
  FrontOfStructureQuality: string | null;
  DiningRoomQuality: string | null;
  KitchenQuality: string | null;
  BedroomQuality: string | null;
  BathroomQuality: string | null;
  comp_count: number | string | null;
  weighted_comp_estimate: number | string | null;
  FSA_SCF: string | null;
  listing_month: string | null;
  list_month: number | string | null;
  list_week: number | string | null;
  list_quarter: number | string | null;
  list_day_of_year: number | string | null;
  hedonic_index_value: number | string | null;
  json_data: Record<string, unknown> | string | null;
}

export interface DRPredictionRow {
  [featureName: string]: string | number | null | undefined;
}

export interface DRPrediction {
  prediction: number | string;
  rowId?: number;
  predictionValues?: Array<{ label: string | number; value: number }>;
}

export interface DRPredictionResponse {
  data: DRPrediction[];
}

/** Weighted Comp Estimate model input */
export interface WeightedCompEstimateInput {
  ListingId?: string;
  Latitude: number;
  Longitude: number;
  City: string;
  PostalCode: string;
  PropertySubType: string;
  AboveGradeFinishedArea?: number;
  BedroomsPossible?: number;
  BathroomsFull?: number;
  TaxAnnualAmount?: number;
  YearBuiltDetails?: number | string;
  OverallQuality?: number | string;
  ListingContractDate: string;
  ClosePrice?: number;
  StreetName?: string;
}

export interface WeightedCompEstimateResult {
  weighted_comp_estimate: number;
  comp_count: number;
}

/** Hedonic Price Index model types */
export interface HedonicIndexInput {
  CurrentPrice: number;
  LookbackDays: number;
  City: string;
  PropertyType?: string;
  PropertySubType: string;
  ReferenceDate?: string; // YYYY-MM-DD format
}

export interface HedonicTrajectoryPoint {
  month: string;  // YYYY-MM format
  price: number;
  index: number;  // 100 = reference month
}

export interface HedonicIndexResult {
  trajectory: HedonicTrajectoryPoint[];
}

/** Output types for the report JSON */
export type ModelKey = 'onMarketQuality' | 'onMarketNoQuality' | 'offMarketQuality' | 'offMarketNoQuality' | 'compEstimate';

export interface ErrorMetrics {
  absolute: number;
  pct: number;
  signed: number;
  signedPct: number;
}

export interface PropertyResult {
  listingId: string;
  closePrice: number;
  listPrice: number | null;
  closeDate: string;
  city: string | null;
  board: string;
  propertySubType: string | null;
  postalCode: string | null;
  fsa: string | null;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: string | null;
  overallQuality: number | null;
  predictions: Record<ModelKey, number | null>;
  errors: Record<ModelKey, ErrorMetrics | null>;
  priceBand: string;
}

export interface ReportData {
  meta: {
    generatedAt: string;
    dateRange: { from: string; to: string };
    totalProperties: number;
    scriptDurationMs: number;
  };
  properties: PropertyResult[];
}
