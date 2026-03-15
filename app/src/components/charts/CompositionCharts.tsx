import { useMemo, useRef, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import type { PropertyResult } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer } from './ChartContainer';
import { zoomOptions } from './zoomConfig';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface Props {
  properties: PropertyResult[];
}

function countBy(items: (string | null)[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item ?? 'Unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function CompositionCharts({ properties }: Props) {
  const subTypeRef = useRef<any>(null);
  const cityRef = useRef<any>(null);
  const boardRef = useRef<any>(null);
  const resetSubType = useCallback(() => { subTypeRef.current?.resetZoom(); }, []);
  const resetCity = useCallback(() => { cityRef.current?.resetZoom(); }, []);
  const resetBoard = useCallback(() => { boardRef.current?.resetZoom(); }, []);
  const subTypeData = useMemo(() => {
    const counts = countBy(properties.map(p => p.propertySubType));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(s => s[0]),
      datasets: [{
        label: 'Count',
        data: sorted.map(s => s[1]),
        backgroundColor: 'rgba(139,92,246,0.6)',
      }],
    };
  }, [properties]);

  const cityData = useMemo(() => {
    const counts = countBy(properties.map(p => p.city));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top15 = sorted.slice(0, 15);
    return {
      labels: top15.map(s => s[0]),
      datasets: [{
        label: 'Count',
        data: top15.map(s => s[1]),
        backgroundColor: 'rgba(59,130,246,0.6)',
      }],
    };
  }, [properties]);

  const boardData = useMemo(() => {
    const counts = countBy(properties.map(p => p.board ?? null));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(s => s[0]),
      datasets: [{
        label: 'Count',
        data: sorted.map(s => s[1]),
        backgroundColor: 'rgba(234,179,8,0.6)',
      }],
    };
  }, [properties]);

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: { legend: { display: false }, zoom: zoomOptions },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Properties by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer height={Math.max(200, subTypeData.labels.length * 30)} onResetZoom={resetSubType}>
            <Bar ref={subTypeRef} data={subTypeData} options={barOpts} />
          </ChartContainer>
          <p className="text-xs text-muted-foreground mt-3">Breakdown of properties in the dataset by sub-type (e.g., Detached, Condo, Semi-Detached). Shows the sample size behind each property type's accuracy metrics.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Properties by City (Top 15)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer height={Math.max(200, cityData.labels.length * 30)} onResetZoom={resetCity}>
            <Bar ref={cityRef} data={cityData} options={barOpts} />
          </ChartContainer>
          <p className="text-xs text-muted-foreground mt-3">Shows the geographic distribution of evaluated properties. Cities beyond the top 15 are grouped into "Other." Helps assess whether results are driven by a few dominant markets.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Properties by Board</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer height={Math.max(200, boardData.labels.length * 30)} onResetZoom={resetBoard}>
            <Bar ref={boardRef} data={boardData} options={barOpts} />
          </ChartContainer>
          <p className="text-xs text-muted-foreground mt-3">Distribution of properties by MLS board. Reveals which real estate boards contribute the most data and helps contextualize accuracy across different regional markets.</p>
        </CardContent>
      </Card>
    </div>
  );
}
