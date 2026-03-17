import { useMemo } from 'react';
import { useReportData } from './hooks/useReportData';
import { CHART_MODEL_KEYS, PRICE_BANDS } from './types';
import type { PropertyResult } from './types';
import { ReportHeader } from './components/ReportHeader';
import { FilterBar } from './components/FilterBar';
import { MetricsSummary } from './components/MetricsSummary';
import { ScatterPlot } from './components/charts/ScatterPlot';
import { ErrorHistogram } from './components/charts/ErrorHistogram';
import { ErrorByPriceBand } from './components/charts/ErrorByPriceBand';
import { CompositionCharts } from './components/charts/CompositionCharts';
import { CumulativeErrorCDF } from './components/charts/CumulativeErrorCDF';
import { WinRateMatrix } from './components/charts/WinRateMatrix';
import { ErrorByPropertyType } from './components/charts/ErrorByPropertyType';
import { ErrorByBoard } from './components/charts/ErrorByBoard';
import { ErrorByQuality } from './components/charts/ErrorByQuality';
import { ResidualScatter } from './components/charts/ResidualScatter';
import { PropertyDetailTable } from './components/PropertyDetailTable';

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mediansByGroup(
  properties: PropertyResult[],
  groupFn: (p: PropertyResult) => string | null,
  minCount: number,
): number[] {
  const groups = new Map<string, PropertyResult[]>();
  for (const p of properties) {
    const key = groupFn(p) ?? 'Unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const vals: number[] = [];
  for (const [, members] of groups) {
    if (members.length < minCount) continue;
    for (const model of CHART_MODEL_KEYS) {
      const errs = members.filter(p => p.errors[model] !== null).map(p => p.errors[model]!.pct);
      if (errs.length > 0) vals.push(median(errs));
    }
  }
  return vals;
}

export default function App() {
  const report = useReportData();

  const medianYMax = useMemo(() => {
    const props = report.filteredProperties;
    if (!props.length) return undefined;
    const allMedians = [
      // Price Band
      ...mediansByGroup(props, p => p.priceBand, 1),
      // Property Type
      ...mediansByGroup(props, p => p.propertySubType, 5),
      // Board
      ...mediansByGroup(props, p => p.board, 5),
      // Quality
      ...mediansByGroup(props, p => p.overallQuality !== null ? String(Math.round(p.overallQuality)) : null, 3),
    ];
    if (!allMedians.length) return undefined;
    const max = Math.max(...allMedians);
    return Math.ceil(max / 5) * 5; // round up to nearest 5
  }, [report.filteredProperties]);

  if (report.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Loading report data...</p>
      </div>
    );
  }

  if (report.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive text-lg font-semibold">Error loading report</p>
          <p className="text-muted-foreground">{report.error}</p>
          <p className="text-sm text-muted-foreground">Run <code className="bg-muted px-1.5 py-0.5 rounded">npm run generate</code> to create report data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <ReportHeader data={report.data!} filteredCount={report.filteredProperties.length} />
        <FilterBar
          filters={report.filters}
          filterOptions={report.filterOptions}
          activeFilterCount={report.activeFilterCount}
          onUpdate={report.updateFilter}
          onReset={report.resetFilters}
          filteredProperties={report.filteredProperties}
          meta={report.data!.meta}
        />
        <MetricsSummary metrics={report.metrics} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <ScatterPlot properties={report.filteredProperties} />
          </section>
          <section>
            <ErrorHistogram properties={report.filteredProperties} />
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <ErrorByPriceBand properties={report.filteredProperties} yMax={medianYMax} />
          </section>
          <section>
            <ErrorByQuality properties={report.filteredProperties} yMax={medianYMax} />
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <ErrorByPropertyType properties={report.filteredProperties} yMax={medianYMax} />
          </section>
          <section>
            <ErrorByBoard properties={report.filteredProperties} yMax={medianYMax} />
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <CumulativeErrorCDF properties={report.filteredProperties} />
          </section>
          <section>
            <ResidualScatter properties={report.filteredProperties} />
          </section>
        </div>

        <section>
          <WinRateMatrix properties={report.filteredProperties} />
        </section>

        <section>
          <CompositionCharts properties={report.filteredProperties} />
        </section>

        <section className="break-before">
          <PropertyDetailTable properties={report.filteredProperties} />
        </section>
      </div>
    </div>
  );
}
