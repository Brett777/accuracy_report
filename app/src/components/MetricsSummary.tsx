import type { ModelKey, ModelMetrics } from '../types';
import { MODEL_GROUPS, MODEL_LABELS } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatCurrency, formatPct } from '../lib/format';

interface Props {
  metrics: Record<ModelKey, ModelMetrics>;
}

function MetricRow({ label, values, lowerIsBetter }: { label: string; values: { text: string; raw: number; count: number }[]; lowerIsBetter: boolean }) {
  const scored = values.filter(v => v.count > 0);
  const bestVal = scored.length > 0
    ? (lowerIsBetter ? Math.min(...scored.map(v => v.raw)) : Math.max(...scored.map(v => v.raw)))
    : null;

  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-4">
        {values.map((v, i) => {
          const isBest = scored.length > 1 && v.count > 0 && v.raw === bestVal;
          return (
            <span key={i} className={`font-mono w-24 text-right ${isBest ? 'text-green-500 font-semibold' : ''}`}>
              {v.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function GroupCard({ label, keys, metrics }: { label: string; keys: ModelKey[]; metrics: Record<ModelKey, ModelMetrics> }) {
  const metricsArr = keys.map(k => metrics[k]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {keys.length > 1 && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="w-32" />
            {keys.map(k => (
              <span key={k} className="w-24 text-right font-medium">{MODEL_LABELS[k].replace(/^(On|Off)-Market\s*/, '')}</span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5">
        <MetricRow
          label="Median Error"
          lowerIsBetter
          values={metricsArr.map(m => ({ text: formatCurrency(m.medianError), raw: m.medianError, count: m.count }))}
        />
        <MetricRow
          label="Median Error %"
          lowerIsBetter
          values={metricsArr.map(m => ({ text: formatPct(m.medianErrorPct), raw: m.medianErrorPct, count: m.count }))}
        />
        <MetricRow
          label="MAPE"
          lowerIsBetter
          values={metricsArr.map(m => ({ text: formatPct(m.mape), raw: m.mape, count: m.count }))}
        />
        <MetricRow
          label="Within 10%"
          lowerIsBetter={false}
          values={metricsArr.map(m => ({ text: formatPct(m.pctWithin10), raw: m.pctWithin10, count: m.count }))}
        />
        <MetricRow
          label="P95 Error %"
          lowerIsBetter
          values={metricsArr.map(m => ({ text: formatPct(m.p95ErrorPct), raw: m.p95ErrorPct, count: m.count }))}
        />
        <MetricRow
          label="Scored"
          lowerIsBetter={false}
          values={metricsArr.map(m => ({ text: String(m.count), raw: m.count, count: m.count }))}
        />
      </CardContent>
    </Card>
  );
}

export function MetricsSummary({ metrics }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {MODEL_GROUPS.map(group => (
        <GroupCard key={group.label} label={group.label} keys={group.keys} metrics={metrics} />
      ))}
    </div>
  );
}
