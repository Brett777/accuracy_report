import type { DbPropertyRow, DRPredictionRow, WeightedCompEstimateInput } from './types.js';

// ── Helpers ────────────────────────────────────────────────────────────

export function parseNumericValue(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  let cleaned = String(value)
    .replace(/[$,]/g, '')
    .replace(/\s*(sq\.?\s*ft\.?|sqft|square\s*feet|feet|ft|acres?)\s*$/i, '')
    .trim();

  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (!isNaN(low) && !isNaN(high)) return (low + high) / 2;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function formatDateForDR(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

function formatDateTimestamp(dateInput: string | Date | undefined | null): string | null {
  if (!dateInput) return null;
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    const y = date.getUTCFullYear();
    const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const mi = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}000`;
  } catch { return null; }
}

function extractFSA(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null;
  const cleaned = postalCode.replace(/\s/g, '').toUpperCase();
  return cleaned.length >= 3 ? cleaned.substring(0, 3) : null;
}

function getListingDateFeatures(dateStr: string | null | undefined) {
  if (!dateStr) return { list_day_of_year: null, list_month: null, list_quarter: null, list_week: null, listing_month: null };
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { list_day_of_year: null, list_month: null, list_quarter: null, list_week: null, listing_month: null };
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
    const startOfYearDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startOfYearDate.getTime()) / 86400000);
    const weekOfYear = Math.ceil((days + startOfYearDate.getDay() + 1) / 7);
    return { list_day_of_year: dayOfYear, list_month: month, list_quarter: quarter, list_week: weekOfYear, listing_month: String(month) };
  } catch { return { list_day_of_year: null, list_month: null, list_quarter: null, list_week: null, listing_month: null }; }
}

function getYearBuilt(row: DbPropertyRow): string | null {
  if (row.json_data && typeof row.json_data === 'object') {
    const jd = row.json_data as Record<string, unknown>;
    if (jd.YearBuilt) return String(jd.YearBuilt);
  }
  return row.YearBuiltDetails;
}

function parseQualityScore(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(parsed) || parsed === 0) return null;
  return parsed;
}

export function extractDbQualityScores(row: DbPropertyRow) {
  return {
    overallQuality: parseQualityScore(row.OverallQuality),
    frontOfStructureQuality: parseQualityScore(row.FrontOfStructureQuality),
    backOfStructureQuality: parseQualityScore(row.BackOfStructureQuality),
    kitchenQuality: parseQualityScore(row.KitchenQuality),
    livingRoomQuality: parseQualityScore(row.LivingRoomQuality),
    bedroomQuality: parseQualityScore(row.BedroomQuality),
    bathroomQuality: parseQualityScore(row.BathroomQuality),
    diningRoomQuality: parseQualityScore(row.DiningRoomQuality),
  };
}

// ── On-Market (with quality) ──────────────────────────────────────────

export function mapDbRowToOnMarketDRRow(row: DbPropertyRow, daysSinceList: number = 1): DRPredictionRow {
  const q = extractDbQualityScores(row);
  const hasParquetDateFeatures = row.list_month != null || row.list_week != null;
  const dateFeatures = hasParquetDateFeatures
    ? {
        list_day_of_year: parseNumericValue(row.list_day_of_year),
        list_month: parseNumericValue(row.list_month),
        list_quarter: parseNumericValue(row.list_quarter),
        list_week: parseNumericValue(row.list_week),
        listing_month: row.listing_month ?? (row.list_month != null ? String(row.list_month) : null),
      }
    : getListingDateFeatures(row.ListingContractDate);

  return {
    'OverallQuality': q.overallQuality,
    'FrontOfStructureQuality': q.frontOfStructureQuality,
    'BackOfStructureQuality': q.backOfStructureQuality,
    'KitchenQuality': q.kitchenQuality,
    'LivingRoomQuality': q.livingRoomQuality,
    'BedroomQuality': q.bedroomQuality,
    'BathroomQuality': q.bathroomQuality,
    'DiningRoomQuality': q.diningRoomQuality,
    'AboveGradeFinishedArea': parseNumericValue(row.AboveGradeFinishedArea),
    'TaxAnnualAmount': parseNumericValue(row.TaxAnnualAmount),
    'PropertyType': row.PropertyType ?? null,
    'PropertySubType': row.PropertySubType ?? null,
    'ListPrice': parseNumericValue(row.ListPrice),
    'City': row.City ?? null,
    'PostalCode': row.PostalCode ?? null,
    'FSA_SCF': row.FSA_SCF ?? extractFSA(row.PostalCode),
    'StreetNumber': row.StreetNumber ?? null,
    'StreetName': row.StreetName ?? null,
    'StreetSuffix': row.StreetSuffix ?? null,
    'StreetDirSuffix': row.StreetDirSuffix ?? null,
    'UnitNumber': row.UnitNumber ?? null,
    'Latitude': parseNumericValue(row.Latitude),
    'Longitude': parseNumericValue(row.Longitude),
    'BedroomsTotal': parseNumericValue(row.BedroomsTotal),
    'BedroomsPossible': parseNumericValue(row.BedroomsPossible) ?? parseNumericValue(row.BedroomsTotal),
    'BathroomsFull': parseNumericValue(row.BathroomsFull),
    'BathroomsHalf': parseNumericValue(row.BathroomsHalf),
    'LotSizeArea': parseNumericValue(row.LotSizeArea) ?? parseNumericValue(row.LotSizeSquareFeet),
    'LotSizeDimensions': row.LotSizeDimensions ?? null,
    'LotSizeSquareFeet': parseNumericValue(row.LotSizeSquareFeet),
    'LotSizeAcres': parseNumericValue(row.LotSizeAcres),
    'LotSizeUnits': row.LotSizeUnits ?? (row.LotSizeSquareFeet ? 'SquareFeet' : null),
    'LotFeatures': row.LotFeatures ?? null,
    'GarageSpaces': parseNumericValue(row.GarageSpaces),
    'ParkingTotal': parseNumericValue(row.ParkingTotal),
    'ParkingFeatures': row.ParkingFeatures ?? null,
    'Basement': row.Basement ?? null,
    'StoriesTotal': parseNumericValue(row.StoriesTotal),
    'YearBuiltDetails': getYearBuilt(row),
    'ConstructionMaterials': row.ConstructionMaterials ?? null,
    'DirectionFaces': row.DirectionFaces ?? null,
    'Heating': row.Heating ?? null,
    'FireplaceYN': row.FireplaceYN ?? null,
    'InteriorFeatures': row.InteriorFeatures ?? null,
    'Appliances': row.Appliances ?? null,
    'PoolFeatures': row.PoolFeatures ?? null,
    'PetsAllowed': row.PetsAllowed ?? null,
    'AssociationFee': parseNumericValue(row.AssociationFee),
    'AssociationName': row.AssociationName ?? null,
    'AssociationAmenities': row.AssociationAmenities ?? null,
    'Days Since List': daysSinceList,
    'CloseDate': formatDateForDR(row.CloseDate),
    'CloseDateTimestamp': formatDateTimestamp(row.CloseDateTimestamp),
    'ListingContractDate': formatDateForDR(row.ListingContractDate),
    'OriginatingSystemName': row.OriginatingSystemName ?? null,
    'list_day_of_year': dateFeatures.list_day_of_year,
    'list_month': dateFeatures.list_month,
    'list_quarter': dateFeatures.list_quarter,
    'list_week': dateFeatures.list_week,
    'listing_month': dateFeatures.listing_month,
    'comp_count': parseNumericValue(row.comp_count),
    'weighted_comp_estimate': parseNumericValue(row.weighted_comp_estimate),
    'hedonic_index_value': parseNumericValue(row.hedonic_index_value),
  };
}

// ── Off-Market (with quality) ─────────────────────────────────────────

export function mapDbRowToOffMarketDRRow(row: DbPropertyRow, daysSinceList: number = 1): DRPredictionRow {
  const drRow = mapDbRowToOnMarketDRRow(row, daysSinceList);
  delete drRow['ListPrice'];
  delete drRow['FrontOfStructureQuality'];
  delete drRow['BackOfStructureQuality'];
  delete drRow['KitchenQuality'];
  delete drRow['LivingRoomQuality'];
  delete drRow['BedroomQuality'];
  delete drRow['BathroomQuality'];
  delete drRow['DiningRoomQuality'];
  drRow['CloseDate'] = formatDateForDR(row.CloseDate);
  drRow['ListingContractDate'] = formatDateForDR(row.ListingContractDate);
  return drRow;
}

// ── Old On-Market (no quality) ────────────────────────────────────────

export function mapDbRowToOldOnMarketDRRow(row: DbPropertyRow, daysSinceList: number = 1): DRPredictionRow {
  const drRow = mapDbRowToOnMarketDRRow(row, daysSinceList);
  delete drRow['OverallQuality'];
  delete drRow['FrontOfStructureQuality'];
  delete drRow['BackOfStructureQuality'];
  delete drRow['KitchenQuality'];
  delete drRow['LivingRoomQuality'];
  delete drRow['BedroomQuality'];
  delete drRow['BathroomQuality'];
  delete drRow['DiningRoomQuality'];
  return drRow;
}

// ── Old Off-Market (no quality, 40 features) ──────────────────────────

export function mapDbRowToOldOffMarketDRRow(row: DbPropertyRow, daysSinceList: number = 1): DRPredictionRow {
  return {
    'Latitude': parseNumericValue(row.Latitude),
    'Longitude': parseNumericValue(row.Longitude),
    'StreetNumber': row.StreetNumber ?? null,
    'StreetName': row.StreetName ?? null,
    'StreetSuffix': row.StreetSuffix ?? null,
    'StreetDirSuffix': row.StreetDirSuffix ?? null,
    'City': row.City ?? null,
    'PostalCode': row.PostalCode ?? null,
    'UnitNumber': row.UnitNumber ?? null,
    'PropertyType': row.PropertyType ?? null,
    'PropertySubType': row.PropertySubType ?? null,
    'BedroomsTotal': parseNumericValue(row.BedroomsTotal),
    'BedroomsPossible': parseNumericValue(row.BedroomsPossible) ?? parseNumericValue(row.BedroomsTotal),
    'BathroomsFull': parseNumericValue(row.BathroomsFull),
    'BathroomsHalf': parseNumericValue(row.BathroomsHalf),
    'GarageSpaces': parseNumericValue(row.GarageSpaces),
    'ParkingTotal': parseNumericValue(row.ParkingTotal),
    'ParkingFeatures': row.ParkingFeatures ?? null,
    'TaxAnnualAmount': parseNumericValue(row.TaxAnnualAmount),
    'AssociationFee': parseNumericValue(row.AssociationFee),
    'AssociationName': row.AssociationName ?? null,
    'AssociationAmenities': row.AssociationAmenities ?? null,
    'LotSizeDimensions': row.LotSizeDimensions ?? null,
    'LotSizeSquareFeet': parseNumericValue(row.LotSizeSquareFeet),
    'LotSizeUnits': row.LotSizeUnits ?? (row.LotSizeSquareFeet ? 'SquareFeet' : null),
    'LotSizeArea': parseNumericValue(row.LotSizeArea) ?? parseNumericValue(row.LotSizeSquareFeet),
    'LotSizeAcres': parseNumericValue(row.LotSizeAcres),
    'AboveGradeFinishedArea': parseNumericValue(row.AboveGradeFinishedArea),
    'StoriesTotal': parseNumericValue(row.StoriesTotal),
    'YearBuiltDetails': getYearBuilt(row),
    'DirectionFaces': row.DirectionFaces ?? null,
    'FireplaceYN': row.FireplaceYN ?? null,
    'Heating': row.Heating ?? null,
    'ConstructionMaterials': row.ConstructionMaterials ?? null,
    'Basement': row.Basement ?? null,
    'InteriorFeatures': row.InteriorFeatures ?? null,
    'Appliances': row.Appliances ?? null,
    'PoolFeatures': row.PoolFeatures ?? null,
    'PetsAllowed': row.PetsAllowed ?? null,
    'Days Since List': daysSinceList,
  };
}

// ── Weighted Comp Estimate input ──────────────────────────────────────

export function toCompInput(row: DbPropertyRow): WeightedCompEstimateInput {
  return {
    ListingId: row.ListingId,
    Latitude: parseNumericValue(row.Latitude) ?? 0,
    Longitude: parseNumericValue(row.Longitude) ?? 0,
    City: row.City || '',
    PostalCode: row.PostalCode || '',
    PropertySubType: row.PropertySubType || '',
    AboveGradeFinishedArea: parseNumericValue(row.AboveGradeFinishedArea) ?? undefined,
    BedroomsPossible: parseNumericValue(row.BedroomsPossible ?? row.BedroomsTotal) ?? undefined,
    BathroomsFull: parseNumericValue(row.BathroomsFull) ?? undefined,
    TaxAnnualAmount: parseNumericValue(row.TaxAnnualAmount) ?? undefined,
    YearBuiltDetails: row.YearBuiltDetails || undefined,
    OverallQuality: row.OverallQuality ? parseNumericValue(row.OverallQuality) ?? undefined : undefined,
    ListingContractDate: row.ListingContractDate
      ? String(row.ListingContractDate).slice(0, 10)
      : new Date().toISOString().split('T')[0],
    // Do NOT pass ClosePrice — at inference time, the subject property has no close price.
    StreetName: row.StreetName || undefined,
  };
}
