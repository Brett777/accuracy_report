import { useMemo } from 'react';
import type { PropertyResult, ModelKey } from '../../types';
import { MODEL_KEYS, MODEL_LABELS } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Props {
  properties: PropertyResult[];
}

function winRate(properties: PropertyResult[], a: ModelKey, b: ModelKey): number | null {
  let wins = 0;
  let total = 0;
  for (const p of properties) {
    const ea = p.errors[a];
    const eb = p.errors[b];
    if (!ea || !eb) continue;
    total++;
    if (ea.pct < eb.pct) wins++;
  }
  return total > 0 ? (wins / total) * 100 : null;
}

function cellColor(pct: number | null): string {
  if (pct === null) return '';
  if (pct >= 65) return 'bg-green-500/20 text-green-700 dark:text-green-400';
  if (pct >= 55) return 'bg-green-500/10 text-green-600 dark:text-green-400';
  if (pct >= 45) return 'bg-muted text-muted-foreground';
  if (pct >= 35) return 'bg-red-500/10 text-red-600 dark:text-red-400';
  return 'bg-red-500/20 text-red-700 dark:text-red-400';
}

export function WinRateMatrix({ properties }: Props) {
  const matrix = useMemo(() => {
    return MODEL_KEYS.map(row =>
      MODEL_KEYS.map(col => row === col ? null : winRate(properties, row, col))
    );
  }, [properties]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Head-to-Head Win Rate</CardTitle>
        <p className="text-xs text-muted-foreground">% of properties where row model has lower error than column model</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-2 text-left font-medium text-muted-foreground"></th>
                {MODEL_KEYS.map(key => (
                  <th key={key} className="py-2 px-2 text-center font-medium text-muted-foreground whitespace-nowrap">
                    {MODEL_LABELS[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODEL_KEYS.map((rowKey, ri) => (
                <tr key={rowKey} className="border-b border-border/30">
                  <td className="py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">
                    {MODEL_LABELS[rowKey]}
                  </td>
                  {MODEL_KEYS.map((colKey, ci) => {
                    const val = matrix[ri][ci];
                    return (
                      <td key={colKey} className={`py-2 px-2 text-center font-mono ${cellColor(val)}`}>
                        {val === null ? '—' : `${val.toFixed(1)}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
