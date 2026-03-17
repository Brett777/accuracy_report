import { useState, useRef, useEffect, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parse,
  isValid,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface CalendarPickerProps {
  label: string;
  value: string;            // YYYY-MM-DD or ''
  onChange: (v: string) => void;
  className?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarPicker({ label, value, onChange, className }: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const validSelected = selectedDate && isValid(selectedDate) ? selectedDate : null;

  const [viewMonth, setViewMonth] = useState(() =>
    validSelected ? startOfMonth(validSelected) : startOfMonth(new Date())
  );

  // Sync view month when value changes externally
  useEffect(() => {
    if (validSelected) setViewMonth(startOfMonth(validSelected));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 }),
  });

  const handleSelect = useCallback((day: Date) => {
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  }, [onChange]);

  return (
    <div className={cn('flex flex-col gap-1 relative', className)} ref={ref}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'h-9 rounded-md border border-input bg-background px-3 text-sm',
          'flex items-center gap-2 text-left transition-colors',
          'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background',
          !value && 'text-muted-foreground',
        )}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="flex-1 truncate">
          {validSelected ? format(validSelected, 'MMM d, yyyy') : 'Pick date'}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleClear}
            className="shrink-0 opacity-40 hover:opacity-100 transition-opacity text-xs leading-none"
          >
            &times;
          </span>
        )}
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div
          className={cn(
            'absolute top-full left-0 z-50 mt-1',
            'w-[280px] rounded-lg border border-border bg-popover p-3 shadow-xl shadow-black/20',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
          )}
        >
          {/* Month navigation header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth(m => subMonths(m, 1))}
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tracking-wide text-foreground">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div
                key={d}
                className="h-8 flex items-center justify-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {days.map(day => {
              const inMonth = isSameMonth(day, viewMonth);
              const selected = validSelected && isSameDay(day, validSelected);
              const today = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={cn(
                    'h-8 w-full rounded-md text-sm transition-colors relative',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:outline-none focus:ring-1 focus:ring-ring',
                    !inMonth && 'text-muted-foreground/40',
                    inMonth && !selected && 'text-foreground',
                    today && !selected && 'font-bold',
                    today && !selected && 'after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary',
                    selected && 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-border flex justify-center">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setViewMonth(startOfMonth(today));
                handleSelect(today);
              }}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
