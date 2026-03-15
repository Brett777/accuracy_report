import { useState, useMemo } from 'react';
import type { PropertyResult } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { formatCurrency, formatPct, formatDate } from '../lib/format';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

interface Props {
  properties: PropertyResult[];
}

type SortKey = 'listingId' | 'city' | 'board' | 'subType' | 'closePrice' | 'offMarketQualityErr' | 'offMarketNoQualityErr' | 'compEstimateErr' | 'sqft' | 'beds' | 'baths' | 'quality' | 'closeDate';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

export function PropertyDetailTable({ properties }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('offMarketQualityErr');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const sorted = useMemo(() => {
    const arr = [...properties];
    arr.sort((a, b) => {
      let va: number | string | null = null;
      let vb: number | string | null = null;

      switch (sortKey) {
        case 'listingId': va = a.listingId; vb = b.listingId; break;
        case 'city': va = a.city ?? ''; vb = b.city ?? ''; break;
        case 'board': va = a.board; vb = b.board; break;
        case 'subType': va = a.propertySubType ?? ''; vb = b.propertySubType ?? ''; break;
        case 'closePrice': va = a.closePrice; vb = b.closePrice; break;
        case 'offMarketQualityErr': va = a.errors.offMarketQuality?.pct ?? -1; vb = b.errors.offMarketQuality?.pct ?? -1; break;
        case 'offMarketNoQualityErr': va = a.errors.offMarketNoQuality?.pct ?? -1; vb = b.errors.offMarketNoQuality?.pct ?? -1; break;
        case 'compEstimateErr': va = a.errors.compEstimate?.pct ?? -1; vb = b.errors.compEstimate?.pct ?? -1; break;
        case 'sqft': va = a.sqft ?? 0; vb = b.sqft ?? 0; break;
        case 'beds': va = a.bedrooms ?? 0; vb = b.bedrooms ?? 0; break;
        case 'baths': va = a.bathrooms ?? 0; vb = b.bathrooms ?? 0; break;
        case 'quality': va = a.overallQuality ?? 0; vb = b.overallQuality ?? 0; break;
        case 'closeDate': va = a.closeDate; vb = b.closeDate; break;
      }

      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [properties, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="text-left py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap select-none"
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </th>
  );

  function predCell(p: PropertyResult, modelKey: 'offMarketQuality' | 'offMarketNoQuality' | 'compEstimate') {
    const pred = p.predictions[modelKey];
    const err = p.errors[modelKey];
    if (pred === null) return <td className="py-1.5 px-2 text-muted-foreground">-</td>;
    const errPct = err?.pct ?? 0;
    const color = errPct < 5 ? 'text-green-500' : errPct < 10 ? 'text-yellow-500' : 'text-red-500';
    return (
      <td className="py-1.5 px-2 font-mono text-xs">
        {formatCurrency(pred)} <span className={color}>({formatPct(errPct)})</span>
      </td>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Property Details</CardTitle>
          <span className="text-xs text-muted-foreground">{sorted.length} properties</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <SortHeader label="Listing" k="listingId" />
                <SortHeader label="Close Date" k="closeDate" />
                <SortHeader label="City" k="city" />
                <SortHeader label="Board" k="board" />
                <SortHeader label="Type" k="subType" />
                <SortHeader label="Sqft" k="sqft" />
                <SortHeader label="Beds" k="beds" />
                <SortHeader label="Baths" k="baths" />
                <SortHeader label="Quality" k="quality" />
                <SortHeader label="Close Price" k="closePrice" />
                <SortHeader label="Comp Est" k="compEstimateErr" />
                <SortHeader label="Off-Mkt (Quality)" k="offMarketQualityErr" />
                <SortHeader label="Off-Mkt (No Quality)" k="offMarketNoQualityErr" />
              </tr>
            </thead>
            <tbody>
              {pageData.map(p => (
                <tr key={p.listingId} className="border-b border-border/30 hover:bg-accent/30">
                  <td className="py-1.5 px-2 font-mono">{p.listingId}</td>
                  <td className="py-1.5 px-2">{p.closeDate ? formatDate(p.closeDate) : '-'}</td>
                  <td className="py-1.5 px-2">{p.city ?? '-'}</td>
                  <td className="py-1.5 px-2">{p.board}</td>
                  <td className="py-1.5 px-2">{p.propertySubType ?? '-'}</td>
                  <td className="py-1.5 px-2 font-mono">{p.sqft?.toLocaleString() ?? '-'}</td>
                  <td className="py-1.5 px-2 font-mono">{p.bedrooms ?? '-'}</td>
                  <td className="py-1.5 px-2 font-mono">{p.bathrooms ?? '-'}</td>
                  <td className="py-1.5 px-2 font-mono">{p.overallQuality !== null ? p.overallQuality.toFixed(2) : '-'}</td>
                  <td className="py-1.5 px-2 font-mono">{formatCurrency(p.closePrice)}</td>
                  {predCell(p, 'compEstimate')}
                  {predCell(p, 'offMarketQuality')}
                  {predCell(p, 'offMarketNoQuality')}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 no-print">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Rows per page</label>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="text-xs h-8 px-2 rounded border border-input bg-background text-foreground"
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>

            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground">Page</label>
              <select
                value={page}
                onChange={e => setPage(Number(e.target.value))}
                className="text-xs h-8 px-2 rounded border border-input bg-background text-foreground"
              >
                {Array.from({ length: totalPages }, (_, i) => (
                  <option key={i} value={i}>{i + 1}</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">of {totalPages}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <span className="text-xs text-muted-foreground">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
