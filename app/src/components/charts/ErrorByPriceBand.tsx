import { useMemo, useRef, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { PropertyResult, ModelKey } from '../../types';
import { CHART_MODEL_KEYS, MODEL_LABELS, PRICE_BANDS } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer } from './ChartContainer';
import { zoomOptions } from './zoomConfig';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MODEL_COLORS: Record<ModelKey, string> = {
  onMarketQuality: 'rgba(139,92,246,0.7)',
  offMarketQuality: 'rgba(59,130,246,0.7)',
  onMarketNoQuality: 'rgba(249,115,22,0.7)',
  offMarketNoQuality: 'rgba(234,179,8,0.7)',
  compEstimate: 'rgba(34,197,94,0.7)',
};

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface Props {
  properties: PropertyResult[];
  yMax?: number;
}

export function ErrorByPriceBand({ properties, yMax }: Props) {
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);
  const data = useMemo(() => {
    const datasets = CHART_MODEL_KEYS.map(key => ({
      label: MODEL_LABELS[key],
      backgroundColor: MODEL_COLORS[key],
      data: PRICE_BANDS.map(band => {
        const bandProps = properties.filter(p => p.priceBand === band && p.errors[key] !== null);
        return median(bandProps.map(p => p.errors[key]!.pct));
      }),
    }));

    return { labels: PRICE_BANDS, datasets };
  }, [properties]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Median Error % by Price Band</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer height={350} onResetZoom={resetZoom}>
          <Bar
            ref={chartRef}
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { title: { display: true, text: 'Price Band' } },
                y: { title: { display: true, text: 'Median Error %' }, max: yMax },
              },
              plugins: {
                legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
                zoom: zoomOptions,
              },
            }}
          />
        </ChartContainer>
        <p className="text-xs text-muted-foreground mt-3">Median error by price range. Identifies which segments are hardest to predict.</p>
      </CardContent>
    </Card>
  );
}
