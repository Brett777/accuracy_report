import { useState, useMemo, useRef, useCallback } from 'react';
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
import { MODEL_KEYS, MODEL_LABELS } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/format';
import { ChartContainer } from './ChartContainer';
import { zoomOptions } from './zoomConfig';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, annotationPlugin);

interface Props {
  properties: PropertyResult[];
}

function getPointColor(errorPct: number | undefined): string {
  if (errorPct === undefined) return 'rgba(128,128,128,0.5)';
  if (errorPct < 5) return 'rgba(34,197,94,0.6)';
  if (errorPct < 10) return 'rgba(234,179,8,0.6)';
  return 'rgba(239,68,68,0.6)';
}

export function ScatterPlot({ properties }: Props) {
  const [activeModel, setActiveModel] = useState<ModelKey>('offMarketQuality');
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);

  // Compute maxVal across ALL models so it stays stable when switching
  const maxVal = useMemo(() => {
    let max = 100000;
    for (const p of properties) {
      if (p.closePrice > max) max = p.closePrice;
      for (const key of MODEL_KEYS) {
        const pred = p.predictions[key];
        if (pred !== null && pred > max) max = pred;
      }
    }
    return max;
  }, [properties]);

  const data = useMemo(() => {
    const points = properties
      .filter(p => p.predictions[activeModel] !== null)
      .map(p => ({
        x: p.closePrice,
        y: p.predictions[activeModel]!,
        errorPct: p.errors[activeModel]?.pct,
        listingId: p.listingId,
      }));

    return {
      datasets: [{
        label: MODEL_LABELS[activeModel],
        data: points,
        backgroundColor: points.map(p => getPointColor(p.errorPct)),
        pointRadius: 3,
        pointHoverRadius: 6,
      }],
    };
  }, [properties, activeModel]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    scales: {
      x: {
        title: { display: true, text: 'Actual Close Price' },
        ticks: { callback: (v: number | string) => formatCurrency(Number(v)) },
      },
      y: {
        title: { display: true, text: 'Predicted Value' },
        ticks: { callback: (v: number | string) => formatCurrency(Number(v)) },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const pt = ctx.raw as any;
            return [
              `Listing: ${pt.listingId}`,
              `Actual: ${formatCurrency(pt.x)}`,
              `Predicted: ${formatCurrency(pt.y)}`,
              pt.errorPct !== undefined ? `Error: ${pt.errorPct.toFixed(1)}%` : '',
            ].filter(Boolean);
          },
        },
      },
      annotation: {
        annotations: {
          perfectLine: {
            type: 'line' as const,
            scaleID: 'x',
            borderColor: 'rgba(139,92,246,0.7)',
            borderWidth: 2,
            borderDash: [6, 3],
            xMin: 0, xMax: maxVal, yMin: 0, yMax: maxVal,
          },
          upperBound: {
            type: 'line' as const,
            borderColor: 'rgba(139,92,246,0.2)',
            borderWidth: 1,
            borderDash: [4, 4],
            xMin: 0, xMax: maxVal, yMin: 0, yMax: maxVal * 1.1,
          },
          lowerBound: {
            type: 'line' as const,
            borderColor: 'rgba(139,92,246,0.2)',
            borderWidth: 1,
            borderDash: [4, 4],
            xMin: 0, xMax: maxVal, yMin: 0, yMax: maxVal * 0.9,
          },
        },
      },
      legend: { display: false },
      zoom: zoomOptions,
    },
  }), [maxVal]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Predicted vs Actual</CardTitle>
        <div className="flex flex-wrap gap-1 no-print">
          {MODEL_KEYS.map(key => (
            <Button
              key={key}
              size="sm"
              variant={activeModel === key ? 'default' : 'outline'}
              onClick={() => setActiveModel(key)}
              className="text-xs h-7"
            >
              {MODEL_LABELS[key]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer onResetZoom={resetZoom}>
          <Scatter ref={chartRef} data={data} options={options as any} />
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
