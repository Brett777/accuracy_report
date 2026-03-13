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
} from 'chart.js';
import type { PropertyResult, ModelKey } from '../../types';
import { MODEL_KEYS, MODEL_LABELS } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer } from './ChartContainer';
import { zoomOptions } from './zoomConfig';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const MODEL_COLORS: Record<ModelKey, string> = {
  onMarketQuality: 'rgba(139,92,246,1)',
  offMarketQuality: 'rgba(59,130,246,1)',
  onMarketNoQuality: 'rgba(249,115,22,1)',
  offMarketNoQuality: 'rgba(234,179,8,1)',
  compEstimate: 'rgba(34,197,94,1)',
};

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface Props {
  properties: PropertyResult[];
}

export function ErrorOverTime({ properties }: Props) {
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);
  const data = useMemo(() => {
    // Group by month
    const monthMap = new Map<string, PropertyResult[]>();
    for (const p of properties) {
      if (!p.closeDate) continue;
      const month = p.closeDate.slice(0, 7); // YYYY-MM
      if (!monthMap.has(month)) monthMap.set(month, []);
      monthMap.get(month)!.push(p);
    }
    const months = [...monthMap.keys()].sort();

    const datasets = MODEL_KEYS.map(key => ({
      label: MODEL_LABELS[key],
      borderColor: MODEL_COLORS[key],
      backgroundColor: MODEL_COLORS[key],
      data: months.map(m => {
        const props = monthMap.get(m)!.filter(p => p.errors[key] !== null);
        return median(props.map(p => p.errors[key]!.pct));
      }),
      tension: 0.3,
      pointRadius: 3,
      borderWidth: 2,
    }));

    return { labels: months, datasets };
  }, [properties]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Median Error % Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer onResetZoom={resetZoom}>
          <Line
            ref={chartRef}
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { title: { display: true, text: 'Month' } },
                y: { title: { display: true, text: 'Median Error %' }, beginAtZero: true },
              },
              plugins: {
                legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
                zoom: zoomOptions,
              },
            }}
          />
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
