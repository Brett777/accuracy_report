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
import { MODEL_KEYS, MODEL_LABELS } from '../../types';
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
}

export function ErrorByPropertyType({ properties }: Props) {
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);

  const data = useMemo(() => {
    // Get property types sorted by count
    const typeCounts = new Map<string, number>();
    for (const p of properties) {
      const t = p.propertySubType ?? 'Unknown';
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
    const types = [...typeCounts.entries()]
      .filter(([, count]) => count >= 5)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);

    const datasets = MODEL_KEYS.map(key => ({
      label: MODEL_LABELS[key],
      backgroundColor: MODEL_COLORS[key],
      data: types.map(type => {
        const props = properties.filter(
          p => (p.propertySubType ?? 'Unknown') === type && p.errors[key] !== null
        );
        return median(props.map(p => p.errors[key]!.pct));
      }),
    }));

    return { labels: types, datasets };
  }, [properties]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Median Error % by Property Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer onResetZoom={resetZoom}>
          <Bar
            ref={chartRef}
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false as const,
              scales: {
                x: { title: { display: true, text: 'Property Type' } },
                y: { title: { display: true, text: 'Median Error %' } },
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
