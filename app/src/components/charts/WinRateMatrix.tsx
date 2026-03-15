import { useMemo } from 'react';
import type { PropertyResult, ModelKey } from '../../types';
import { MODEL_LABELS } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Props {
  properties: PropertyResult[];
}

const OFF_MARKET_KEYS: ModelKey[] = ['offMarketQuality', 'offMarketNoQuality'];
const ON_MARKET_KEYS: ModelKey[] = ['onMarketQuality', 'onMarketNoQuality'];

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

/** Short label: strip the "Off-Market " / "On-Market " prefix */
function shortLabel(key: ModelKey): string {
  return MODEL_LABELS[key].replace(/^(?:Off|On)-Market\s*/, '');
}

function WinRateTable({ title, keys, properties }: { title: string; keys: ModelKey[]; properties: PropertyResult[] }) {
  const matrix = useMemo(() => {
    return keys.map(row =>
      keys.map(col => row === col ? null : winRate(properties, row, col))
    );
  }, [properties, keys]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">% of properties where row model has lower error than column model</p>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-3 text-left font-medium text-muted-foreground"></th>
              {keys.map(key => (
                <th key={key} className="py-2 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">
                  {shortLabel(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((rowKey, ri) => (
              <tr key={rowKey} className="border-b border-border/30">
                <td className="py-2 px-3 font-medium text-muted-foreground whitespace-nowrap">
                  {shortLabel(rowKey)}
                </td>
                {keys.map((colKey, ci) => {
                  const val = matrix[ri][ci];
                  return (
                    <td key={colKey} className={`py-2 px-3 text-center font-mono ${cellColor(val)}`}>
                      {val === null ? '—' : `${val.toFixed(1)}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">Each cell shows how often the row model beats the column model (lower absolute error) across all properties where both have predictions. Values above 50% mean the row model wins more often.</p>
      </CardContent>
    </Card>
  );
}

export function WinRateMatrix({ properties }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <WinRateTable title="Win Rate — Off-Market" keys={OFF_MARKET_KEYS} properties={properties} />
      <WinRateTable title="Win Rate — On-Market" keys={ON_MARKET_KEYS} properties={properties} />
    </div>
  );
}
