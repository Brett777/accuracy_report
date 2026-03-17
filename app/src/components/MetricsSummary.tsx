import { useState, useRef, useEffect } from 'react';
import type { ModelKey, ModelMetrics } from '../types';
import { MODEL_GROUPS, MODEL_LABELS } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatCurrency, formatPct } from '../lib/format';
import { HelpCircle } from 'lucide-react';

interface Props {
  metrics: Record<ModelKey, ModelMetrics>;
}

/* ── Tooltip ──────────────────────────────────────────────────────── */

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-1"
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg leading-relaxed animate-in fade-in-0 zoom-in-95">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border" />
        </div>
      )}
    </span>
  );
}

/* ── Metric row ───────────────────────────────────────────────────── */

function MetricRow({ label, tooltip, values, lowerIsBetter, closestToZero }: {
  label: string;
  tooltip: string;
  values: { text: string; raw: number; count: number }[];
  lowerIsBetter: boolean;
  closestToZero?: boolean;
}) {
  const scored = values.filter(v => v.count > 0);
  let bestVal: number | null = null;
  if (scored.length > 0) {
    if (closestToZero) {
      bestVal = scored.reduce((best, v) => Math.abs(v.raw) < Math.abs(best.raw) ? v : best).raw;
    } else {
      bestVal = lowerIsBetter ? Math.min(...scored.map(v => v.raw)) : Math.max(...scored.map(v => v.raw));
    }
  }

  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground flex items-center">
        {label}
        <Tooltip text={tooltip} />
      </span>
      <div className="flex gap-4">
        {values.map((v, i) => {
          const isBest = scored.length > 1 && v.count > 0 && (closestToZero ? Math.abs(v.raw) === Math.abs(bestVal!) : v.raw === bestVal);
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

/* ── Separator ────────────────────────────────────────────────────── */

function Divider() {
  return <div className="border-t border-border/50 my-1" />;
}

/* ── Metric descriptions ──────────────────────────────────────────── */

const TOOLTIPS = {
  medianError: 'Typical dollar amount the prediction is off by. Lower is better. E.g., $20K means half of predictions are within $20K of the sale price. More reliable than the mean because a single $5M outlier won\'t skew it.',
  medianErrorPct: 'Typical percentage the prediction is off by. Lower is better. E.g., 3% on a $500K home means the model is usually within ~$15K. This is the best single number for "how accurate is this model?"',
  mape: 'Average percentage error across all predictions. Lower is better. Under 5% is excellent, 5-10% is good, over 15% needs investigation. Can be pulled up by a few large misses -- compare with median error % to check.',
  meanError: 'Average dollar error across all predictions. Lower is better. If this is much larger than the median error, a few properties with very large misses are dragging the average up.',
  within5: 'Percentage of predictions that landed within 5% of the actual sale price. Higher is better. This is a strict bar -- above 50% here indicates strong model performance.',
  within10: 'Percentage of predictions that landed within 10% of the actual sale price. Higher is better. This is the industry-standard accuracy threshold. A good valuation model should be above 80%.',
  within20: 'Percentage of predictions that landed within 20% of the actual sale price. Higher is better. Properties outside this range are significant misses worth investigating individually.',
  p95: 'The error level that 95% of predictions fall below. Lower is better. E.g., 15% means only 1 in 20 predictions is off by more than 15%. Helps you understand worst-case scenarios.',
  medianSignedPct: 'Shows whether the model tends to guess too high or too low. Closest to 0% is best. Positive means over-predicting (guessing above sale price), negative means under-predicting. E.g., -3% means the model typically undervalues by 3%.',
  stdErrorPct: 'How consistent the predictions are. Lower is better. A low number means errors are tightly clustered (predictable). A high number means accuracy varies widely -- some predictions are spot-on, others are way off.',
  rmse: 'Like mean error, but penalizes big misses more heavily. Lower is better. If RMSE is much higher than mean error, the model has a few very large misses pulling it up. Useful when large errors are especially costly.',
  scored: 'Number of properties that received a prediction from this model. A low count means the results may not be statistically reliable.',
};

/* ── Group card ───────────────────────────────────────────────────── */

function GroupCard({ label, keys, metrics }: { label: string; keys: ModelKey[]; metrics: Record<ModelKey, ModelMetrics> }) {
  const metricsArr = keys.map(k => metrics[k]);

  const fmt = (getter: (m: ModelMetrics) => number, formatter: (v: number) => string) =>
    metricsArr.map(m => ({ text: formatter(getter(m)), raw: getter(m), count: m.count }));

  const fmtSigned = (getter: (m: ModelMetrics) => number) =>
    metricsArr.map(m => {
      const v = getter(m);
      const sign = v > 0 ? '+' : '';
      return { text: `${sign}${formatPct(v)}`, raw: v, count: m.count };
    });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {keys.length > 1 && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex-1" />
            {keys.map(k => (
              <span key={k} className="w-24 text-right font-medium">{MODEL_LABELS[k].replace(/^(On|Off)-Market\s*/, '')}</span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5">
        {/* Core accuracy */}
        <MetricRow label="Median Error" tooltip={TOOLTIPS.medianError} lowerIsBetter
          values={fmt(m => m.medianError, formatCurrency)} />
        <MetricRow label="Median Error %" tooltip={TOOLTIPS.medianErrorPct} lowerIsBetter
          values={fmt(m => m.medianErrorPct, formatPct)} />
        <MetricRow label="MAPE" tooltip={TOOLTIPS.mape} lowerIsBetter
          values={fmt(m => m.mape, formatPct)} />
        <MetricRow label="Mean Error" tooltip={TOOLTIPS.meanError} lowerIsBetter
          values={fmt(m => m.meanError, formatCurrency)} />
        <MetricRow label="RMSE" tooltip={TOOLTIPS.rmse} lowerIsBetter
          values={fmt(m => m.rmse, formatCurrency)} />

        <Divider />

        {/* Accuracy bands */}
        <MetricRow label="Within 5%" tooltip={TOOLTIPS.within5} lowerIsBetter={false}
          values={fmt(m => m.pctWithin5, formatPct)} />
        <MetricRow label="Within 10%" tooltip={TOOLTIPS.within10} lowerIsBetter={false}
          values={fmt(m => m.pctWithin10, formatPct)} />
        <MetricRow label="Within 20%" tooltip={TOOLTIPS.within20} lowerIsBetter={false}
          values={fmt(m => m.pctWithin20, formatPct)} />

        <Divider />

        {/* Distribution & bias */}
        <MetricRow label="P95 Error %" tooltip={TOOLTIPS.p95} lowerIsBetter
          values={fmt(m => m.p95ErrorPct, formatPct)} />
        <MetricRow label="Std Dev Error %" tooltip={TOOLTIPS.stdErrorPct} lowerIsBetter
          values={fmt(m => m.stdErrorPct, formatPct)} />
        <MetricRow label="Bias (Median)" tooltip={TOOLTIPS.medianSignedPct} lowerIsBetter closestToZero
          values={fmtSigned(m => m.medianSignedPct)} />

        <Divider />

        <MetricRow label="Scored" tooltip={TOOLTIPS.scored} lowerIsBetter={false}
          values={metricsArr.map(m => ({ text: String(m.count), raw: m.count, count: m.count }))} />
      </CardContent>
    </Card>
  );
}

/* ── Export ────────────────────────────────────────────────────────── */

export function MetricsSummary({ metrics }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {MODEL_GROUPS.map(group => (
        <GroupCard key={group.label} label={group.label} keys={group.keys} metrics={metrics} />
      ))}
    </div>
  );
}
