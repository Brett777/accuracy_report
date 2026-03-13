import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { FilterState } from '../lib/filters';
import { PRICE_BANDS } from '../types';
import { X } from 'lucide-react';

interface Props {
  filters: FilterState;
  filterOptions: {
    boards: string[];
    cities: string[];
    propertySubTypes: string[];
    priceBands: string[];
  };
  activeFilterCount: number;
  onUpdate: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onReset: () => void;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={selected.length === 1 ? selected[0] : ''}
        onChange={e => {
          const v = e.target.value;
          onChange(v ? [v] : []);
        }}
      >
        <option value="">All</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function FilterBar({ filters, filterOptions, activeFilterCount, onUpdate, onReset }: Props) {
  return (
    <div className="no-print flex flex-wrap items-end gap-4 p-4 rounded-lg border bg-card">
      <MultiSelect
        label="Board"
        options={filterOptions.boards}
        selected={filters.boards}
        onChange={v => onUpdate('boards', v)}
      />
      <MultiSelect
        label="City"
        options={filterOptions.cities}
        selected={filters.cities}
        onChange={v => onUpdate('cities', v)}
      />
      <MultiSelect
        label="Property Type"
        options={filterOptions.propertySubTypes}
        selected={filters.propertySubTypes}
        onChange={v => onUpdate('propertySubTypes', v)}
      />
      <MultiSelect
        label="Price Band"
        options={PRICE_BANDS}
        selected={filters.priceBands}
        onChange={v => onUpdate('priceBands', v)}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Close Date From</label>
        <input
          type="date"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.closeDateFrom}
          onChange={e => onUpdate('closeDateFrom', e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Close Date To</label>
        <input
          type="date"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.closeDateTo}
          onChange={e => onUpdate('closeDateTo', e.target.value)}
        />
      </div>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1">
          <X className="h-3 w-3" />
          Reset
          <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
        </Button>
      )}
    </div>
  );
}
