import { useState, useMemo, useRef, useCallback } from 'react';
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
import { Button } from '../ui/button';
import { ChartContainer } from './ChartContainer';
import { zoomOptions } from './zoomConfig';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BINS = ['-50+', '-40', '-30', '-20', '-10', '0', '+10', '+20', '+30', '+40', '+50+'];
const BIN_EDGES = [-Infinity, -40, -30, -20, -10, 0, 10, 20, 30, 40, Infinity];

const MODEL_COLORS: Record<ModelKey, string> = {
  onMarketQuality: 'rgba(139,92,246,0.7)',
  offMarketQuality: 'rgba(59,130,246,0.7)',
  onMarketNoQuality: 'rgba(249,115,22,0.7)',
  offMarketNoQuality: 'rgba(234,179,8,0.7)',
  compEstimate: 'rgba(34,197,94,0.7)',
};

interface Props {
  properties: PropertyResult[];
}

function binErrors(properties: PropertyResult[], modelKey: ModelKey): number[] {
  const counts = new Array(BINS.length).fill(0);
  for (const p of properties) {
    const err = p.errors[modelKey];
    if (!err) continue;
    const pct = err.signedPct;
    let binIdx = BIN_EDGES.findIndex((edge, i) => i < BIN_EDGES.length - 1 && pct >= edge && pct < BIN_EDGES[i + 1]);
    if (binIdx === -1) binIdx = BINS.length - 1;
    counts[binIdx]++;
  }
  return counts;
}

export function ErrorHistogram({ properties }: Props) {
  const [activeModel, setActiveModel] = useState<ModelKey>('offMarketQuality');
  const chartRef = useRef<any>(null);
  const resetZoom = useCallback(() => { chartRef.current?.resetZoom(); }, []);

  const data = useMemo(() => ({
    labels: BINS,
    datasets: [{
      label: MODEL_LABELS[activeModel],
      data: binErrors(properties, activeModel),
      backgroundColor: MODEL_COLORS[activeModel],
    }],
  }), [properties, activeModel]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Signed Error Distribution</CardTitle>
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
          <Bar
            ref={chartRef}
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false as const,
              scales: {
                x: { title: { display: true, text: 'Signed Error %' } },
                y: { title: { display: true, text: 'Count' } },
              },
              plugins: { legend: { display: false }, zoom: zoomOptions },
            }}
          />
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
