import type { PropertyResult } from '../types';

export interface FilterState {
  boards: string[];
  cities: string[];
  propertySubTypes: string[];
  priceBands: string[];
  closeDateFrom: string;
  closeDateTo: string;
}

export const EMPTY_FILTERS: FilterState = {
  boards: [],
  cities: [],
  propertySubTypes: [],
  priceBands: [],
  closeDateFrom: '',
  closeDateTo: '',
};

export function applyFilters(properties: PropertyResult[], filters: FilterState): PropertyResult[] {
  return properties.filter(p => {
    if (filters.boards.length > 0 && !filters.boards.includes(p.board)) return false;
    if (filters.cities.length > 0 && (!p.city || !filters.cities.includes(p.city))) return false;
    if (filters.propertySubTypes.length > 0 && (!p.propertySubType || !filters.propertySubTypes.includes(p.propertySubType))) return false;
    if (filters.priceBands.length > 0 && !filters.priceBands.includes(p.priceBand)) return false;
    if (filters.closeDateFrom && p.closeDate < filters.closeDateFrom) return false;
    if (filters.closeDateTo && p.closeDate > filters.closeDateTo) return false;
    return true;
  });
}

export function extractFilterOptions(properties: PropertyResult[], filters: FilterState) {
  const boards = [...new Set(properties.map(p => p.board))].sort();

  // Cascade: cities depend on board selection
  const cityPool = filters.boards.length > 0
    ? properties.filter(p => filters.boards.includes(p.board))
    : properties;
  const cities = [...new Set(cityPool.map(p => p.city).filter(Boolean) as string[])].sort();

  // Cascade: subtypes depend on city selection
  const subTypePool = filters.cities.length > 0
    ? cityPool.filter(p => p.city && filters.cities.includes(p.city))
    : cityPool;
  const propertySubTypes = [...new Set(subTypePool.map(p => p.propertySubType).filter(Boolean) as string[])].sort();

  const priceBands = [...new Set(properties.map(p => p.priceBand))];

  return { boards, cities, propertySubTypes, priceBands };
}

export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.boards.length > 0) count++;
  if (filters.cities.length > 0) count++;
  if (filters.propertySubTypes.length > 0) count++;
  if (filters.priceBands.length > 0) count++;
  if (filters.closeDateFrom) count++;
  if (filters.closeDateTo) count++;
  return count;
}
