import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { CalendarPicker } from './ui/calendar-picker';
import type { FilterState } from '../lib/filters';
import type { PropertyResult, ReportData } from '../types';
import { PRICE_BANDS } from '../types';
import { generateCSV, downloadCSV } from '../lib/csvExport';
import { X, Download, ChevronDown, Check } from 'lucide-react';

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
  filteredProperties: PropertyResult[];
  meta: ReportData['meta'];
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const displayValue = selected.length === 1 ? selected[0] : null;

  function handleSelect(value: string) {
    if (value === '') {
      onChange([]);
    } else {
      onChange(selected.includes(value) ? [] : [value]);
    }
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'h-9 min-w-[140px] rounded-md border border-input bg-background px-3 text-sm',
          'flex items-center gap-2 text-left transition-colors',
          'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background',
          !displayValue && 'text-muted-foreground',
        )}
      >
        <span className="flex-1 truncate">{displayValue ?? 'All'}</span>
        {displayValue ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={e => { e.stopPropagation(); onChange([]); }}
            className="shrink-0 opacity-40 hover:opacity-100 transition-opacity text-xs leading-none"
          >
            &times;
          </span>
        ) : (
          <ChevronDown className={cn(
            'h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200',
            open && 'rotate-180',
          )} />
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute top-full left-0 z-50 mt-1',
          'min-w-[180px] max-h-[280px] overflow-y-auto scrollbar-thin rounded-lg border border-border bg-popover p-1 shadow-xl shadow-black/20',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
        )}>
          <button
            type="button"
            onClick={() => handleSelect('')}
            className={cn(
              'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              selected.length === 0 && 'text-primary font-medium',
            )}
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              {selected.length === 0 && <Check className="h-3.5 w-3.5" />}
            </span>
            All
          </button>
          {options.map(o => {
            const isSelected = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => handleSelect(o)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isSelected && 'text-primary font-medium',
                )}
              >
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </span>
                {o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ filters, filterOptions, activeFilterCount, onUpdate, onReset, filteredProperties, meta }: Props) {
  const hasRawFeatures = filteredProperties.some(p => p.rawFeatures != null);

  function handleExport() {
    const csv = generateCSV(filteredProperties);
    const dateRange = `${meta.dateRange.from}_${meta.dateRange.to}`;
    const filename = `external_test_${dateRange}_${filteredProperties.length}props.csv`;
    downloadCSV(csv, filename);
  }

  return (
    <div className="no-print sticky top-0 z-50">
      <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg border bg-card">
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

        <CalendarPicker
          label="Close Date From"
          value={filters.closeDateFrom}
          onChange={v => onUpdate('closeDateFrom', v)}
        />
        <CalendarPicker
          label="Close Date To"
          value={filters.closeDateTo}
          onChange={v => onUpdate('closeDateTo', v)}
        />

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1">
            <X className="h-3 w-3" />
            Reset
            <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
          </Button>
        )}

        {hasRawFeatures && (
          <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>
      <div
        className="pointer-events-none h-8"
        style={{
          background: 'linear-gradient(to bottom, hsl(var(--background)) 0%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />
    </div>
  );
}
