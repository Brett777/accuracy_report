import { useMemo, useRef, useCallback } from 'react';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import type { PropertyResult, ModelKey } from '../../types';
import { CHART_MODEL_KEYS, MODEL_LABELS } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { formatCurrency } from '../../lib/format';
import { ChartContainer } from './ChartContainer';
import { zoomOptions } from './zoomConfig';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, annotationPlugin);

const MODEL_COLORS: Record<ModelKey, string> = {
  onMarketQuality: 'rgba(139,92,246,0.6)',
  offMarketQuality: 'rgba(59,130,246,0.6)',
  onMarketNoQuality: 'rgba(249,115,22,0.6)',
  offMarketNoQuality: 'rgba(234,179,8,0.6)',
  compEstimate: 'rgba(34,197,94,0.6)',
};

interface Props {
  properties: PropertyResult[];
}

export function ResidualScatter({ properties }: Props) {
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);

  const data = useMemo(() => ({
    datasets: CHART_MODEL_KEYS.map(key => ({
      label: MODEL_LABELS[key],
      data: properties
        .filter(p => p.errors[key] !== null)
        .map(p => ({
          x: p.closePrice,
          y: p.errors[key]!.signedPct,
          listingId: p.listingId,
        })),
      backgroundColor: MODEL_COLORS[key],
      pointRadius: 3,
      pointHoverRadius: 6,
    })),
  }), [properties]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    scales: {
      x: {
        title: { display: true, text: 'Close Price' },
        ticks: { callback: (v: number | string) => formatCurrency(Number(v)) },
      },
      y: {
        title: { display: true, text: 'Signed Error %' },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const pt = ctx.raw as any;
            return [
              `${ctx.dataset.label}`,
              `Listing: ${pt.listingId}`,
              `Price: ${formatCurrency(pt.x)}`,
              `Error: ${pt.y > 0 ? '+' : ''}${pt.y.toFixed(1)}%`,
            ];
          },
        },
      },
      annotation: {
        annotations: {
          zeroLine: {
            type: 'line' as const,
            yMin: 0,
            yMax: 0,
            borderColor: 'rgba(139,92,246,0.5)',
            borderWidth: 1,
            borderDash: [4, 4],
          },
        },
      },
      legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
      zoom: zoomOptions,
    },
  }), []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Residuals vs. Price</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer onResetZoom={resetZoom}>
          <Scatter ref={chartRef} data={data} options={options as any} />
        </ChartContainer>
        <p className="text-xs text-muted-foreground mt-3">Plots each property's signed error percentage against its close price. Points above zero indicate over-prediction, below zero under-prediction. The dashed line marks zero error. Helps detect price-dependent bias -- e.g., if the model consistently over-predicts expensive properties.</p>
      </CardContent>
    </Card>
  );
}
