import { useReportData } from './hooks/useReportData';
import { ReportHeader } from './components/ReportHeader';
import { FilterBar } from './components/FilterBar';
import { MetricsSummary } from './components/MetricsSummary';
import { ScatterPlot } from './components/charts/ScatterPlot';
import { ErrorHistogram } from './components/charts/ErrorHistogram';
import { ErrorByPriceBand } from './components/charts/ErrorByPriceBand';
import { ErrorOverTime } from './components/charts/ErrorOverTime';
import { CompositionCharts } from './components/charts/CompositionCharts';
import { CumulativeErrorCDF } from './components/charts/CumulativeErrorCDF';
import { WinRateMatrix } from './components/charts/WinRateMatrix';
import { ErrorByPropertyType } from './components/charts/ErrorByPropertyType';
import { ResidualScatter } from './components/charts/ResidualScatter';
import { PropertyDetailTable } from './components/PropertyDetailTable';

export default function App() {
  const report = useReportData();

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
            <ErrorByPriceBand properties={report.filteredProperties} />
          </section>
          <section>
            <ErrorOverTime properties={report.filteredProperties} />
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <ErrorByPropertyType properties={report.filteredProperties} />
          </section>
          <section>
            <WinRateMatrix properties={report.filteredProperties} />
          </section>
        </div>

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
