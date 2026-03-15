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
  const qualityRef = useRef<any>(null);
  const resetSubType = useCallback(() => { subTypeRef.current?.resetZoom(); }, []);
  const resetCity = useCallback(() => { cityRef.current?.resetZoom(); }, []);
  const resetBoard = useCallback(() => { boardRef.current?.resetZoom(); }, []);
  const resetQuality = useCallback(() => { qualityRef.current?.resetZoom(); }, []);
  const TYPE_LABELS: Record<string, string> = {
    'Single Family Residence': 'Single Family',
    'Manufactured Home': 'Mfg Home',
    'Unimproved Land': 'Vacant Land',
  };
  const subTypeData = useMemo(() => {
    const counts = countBy(properties.map(p => p.propertySubType));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(s => TYPE_LABELS[s[0]] ?? s[0]),
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

  const qualityData = useMemo(() => {
    const counts = countBy(properties.map(p =>
      p.overallQuality !== null ? String(Math.round(p.overallQuality)) : null
    ));
    const sorted = [...counts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
    return {
      labels: sorted.map(s => s[0]),
      datasets: [{
        label: 'Count',
        data: sorted.map(s => s[1]),
        backgroundColor: 'rgba(34,197,94,0.6)',
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Properties by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer height={Math.max(200, subTypeData.labels.length * 30)} onResetZoom={resetSubType}>
              <Bar ref={subTypeRef} data={subTypeData} options={barOpts} />
            </ChartContainer>
            <p className="text-xs text-muted-foreground mt-3">Breakdown by property sub-type. Shows sample size behind each type's accuracy metrics.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Properties by Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer height={Math.max(200, qualityData.labels.length * 30)} onResetZoom={resetQuality}>
              <Bar ref={qualityRef} data={qualityData} options={barOpts} />
            </ChartContainer>
            <p className="text-xs text-muted-foreground mt-3">Distribution by image-derived quality score (1-6). Shows sample size behind each quality level.</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Properties by City (Top 15)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer height={Math.max(200, cityData.labels.length * 30)} onResetZoom={resetCity}>
              <Bar ref={cityRef} data={cityData} options={barOpts} />
            </ChartContainer>
            <p className="text-xs text-muted-foreground mt-3">Geographic distribution of evaluated properties. Top 15 cities by count.</p>
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
            <p className="text-xs text-muted-foreground mt-3">Distribution by MLS board. Shows which boards contribute the most data.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
