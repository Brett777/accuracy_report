import { useMemo, useRef, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { PropertyResult, ModelKey } from '../../types';
import { CHART_MODEL_KEYS, MODEL_LABELS } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer } from './ChartContainer';
import { zoomOptions } from './zoomConfig';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const MODEL_COLORS: Record<ModelKey, string> = {
  onMarketQuality: 'rgba(139,92,246,1)',
  offMarketQuality: 'rgba(59,130,246,1)',
  onMarketNoQuality: 'rgba(249,115,22,1)',
  offMarketNoQuality: 'rgba(234,179,8,1)',
  compEstimate: 'rgba(34,197,94,1)',
};

interface Props {
  properties: PropertyResult[];
}

export function CumulativeErrorCDF({ properties }: Props) {
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);

  const data = useMemo(() => {
    // X-axis: error % thresholds from 0 to 50
    const thresholds = Array.from({ length: 51 }, (_, i) => i);

    const datasets = CHART_MODEL_KEYS.map(key => {
      const errors = properties
        .filter(p => p.errors[key] !== null)
        .map(p => p.errors[key]!.pct);
      const total = errors.length;

      return {
        label: MODEL_LABELS[key],
        borderColor: MODEL_COLORS[key],
        backgroundColor: 'transparent',
        data: thresholds.map(t => total > 0 ? (errors.filter(e => e <= t).length / total) * 100 : 0),
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      };
    });

    return { labels: thresholds.map(t => `${t}%`), datasets };
  }, [properties]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cumulative Error Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer onResetZoom={resetZoom}>
          <Line
            ref={chartRef}
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false as const,
              scales: {
                x: { title: { display: true, text: 'Error Threshold %' } },
                y: {
                  title: { display: true, text: '% of Predictions Within Threshold' },
                  min: 0,
                  max: 100,
                },
              },
              plugins: {
                legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                  callbacks: {
                    label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
                  },
                },
                zoom: zoomOptions,
              },
            }}
          />
        </ChartContainer>
        <p className="text-xs text-muted-foreground mt-3">Shows the cumulative percentage of predictions falling within each error threshold. A steeper curve means more predictions are accurate at lower thresholds. Use this to answer questions like "what percentage of predictions are within 10% of actual?"</p>
      </CardContent>
    </Card>
  );
}
