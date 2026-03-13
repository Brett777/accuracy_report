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
  const [activeModel, setActiveModel] = useState<ModelKey>('offMarketQuality');
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);

  const data = useMemo(() => {
    const points = properties
      .filter(p => p.errors[activeModel] !== null)
      .map(p => ({
        x: p.closePrice,
        y: p.errors[activeModel]!.signedPct,
        listingId: p.listingId,
      }));

    return {
      datasets: [{
        label: MODEL_LABELS[activeModel],
        data: points,
        backgroundColor: MODEL_COLORS[activeModel],
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
      legend: { display: false },
      zoom: zoomOptions,
    },
  }), []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Residuals vs. Price</CardTitle>
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
