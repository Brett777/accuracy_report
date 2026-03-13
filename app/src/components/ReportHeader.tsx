import type { ReportData } from '../types';
import { Badge } from './ui/badge';
import { formatDate } from '../lib/format';

interface Props {
  data: ReportData;
  filteredCount: number;
}

export function ReportHeader({ data, filteredCount }: Props) {
  const { meta } = data;
  return (
    <header className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight">Model Performance Report</h1>
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary">
          {formatDate(meta.dateRange.from)} - {formatDate(meta.dateRange.to)}
        </Badge>
        <Badge variant="outline">
          {filteredCount === meta.totalProperties
            ? `${meta.totalProperties} properties`
            : `${filteredCount} / ${meta.totalProperties} properties`}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Generated {new Date(meta.generatedAt).toLocaleString()}
        </span>
      </div>
    </header>
  );
}
