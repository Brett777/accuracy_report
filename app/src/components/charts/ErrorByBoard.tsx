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
import { CHART_MODEL_KEYS, MODEL_LABELS } from '../../types';
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

export function ErrorByBoard({ properties, yMax }: Props) {
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);

  const data = useMemo(() => {
    const boardCounts = new Map<string, number>();
    for (const p of properties) {
      const b = p.board ?? 'Unknown';
      boardCounts.set(b, (boardCounts.get(b) ?? 0) + 1);
    }
    const boards = [...boardCounts.entries()]
      .filter(([, count]) => count >= 5)
      .sort((a, b) => b[1] - a[1])
      .map(([board]) => board);

    const datasets = CHART_MODEL_KEYS.map(key => ({
      label: MODEL_LABELS[key],
      backgroundColor: MODEL_COLORS[key],
      data: boards.map(board => {
        const props = properties.filter(
          p => (p.board ?? 'Unknown') === board && p.errors[key] !== null
        );
        return median(props.map(p => p.errors[key]!.pct));
      }),
    }));

    return { labels: boards, datasets };
  }, [properties]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Median Error % by Board</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer height={350} onResetZoom={resetZoom}>
          <Bar
            ref={chartRef}
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false as const,
              scales: {
                x: { title: { display: true, text: 'MLS Board' } },
                y: { title: { display: true, text: 'Median Error %' }, max: yMax },
              },
              plugins: {
                legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
                zoom: zoomOptions,
              },
            }}
          />
        </ChartContainer>
        <p className="text-xs text-muted-foreground mt-3">Median error by MLS board. Boards with fewer than 5 properties excluded.</p>
      </CardContent>
    </Card>
  );
}
