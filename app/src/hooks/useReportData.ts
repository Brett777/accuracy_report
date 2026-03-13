import { useState, useMemo, useEffect } from 'react';
import type { ReportData, PropertyResult, ModelKey, ModelMetrics } from '../types';
import { MODEL_KEYS } from '../types';
import { computeModelMetrics } from '../lib/metrics';
import { applyFilters, extractFilterOptions, countActiveFilters, EMPTY_FILTERS, type FilterState } from '../lib/filters';

export function useReportData() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/report.json')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load report.json (${res.status})`);
        return res.json();
      })
      .then((d: ReportData) => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const allProperties = data?.properties ?? [];

  const filteredProperties = useMemo(
    () => applyFilters(allProperties, filters),
    [allProperties, filters]
  );

  const filterOptions = useMemo(
    () => extractFilterOptions(allProperties, filters),
    [allProperties, filters]
  );

  const metrics = useMemo(() => {
    const result: Record<ModelKey, ModelMetrics> = {} as any;
    for (const key of MODEL_KEYS) {
      result[key] = computeModelMetrics(filteredProperties, key);
    }
    return result;
  }, [filteredProperties]);

  const activeFilterCount = countActiveFilters(filters);

  const resetFilters = () => setFilters(EMPTY_FILTERS);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Reset cascading filters
      if (key === 'boards') { next.cities = []; next.propertySubTypes = []; }
      if (key === 'cities') { next.propertySubTypes = []; }
      return next;
    });
  };

  return {
    data,
    loading,
    error,
    filters,
    updateFilter,
    resetFilters,
    activeFilterCount,
    filteredProperties,
    filterOptions,
    metrics,
  };
}
