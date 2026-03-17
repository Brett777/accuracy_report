import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  height?: number | string;
  onResetZoom?: () => void;
  toolbar?: ReactNode;
}

export function ChartContainer({ children, height = 400, onResetZoom, toolbar }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {
        setIsFullscreen(true);
      });
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const btnClass =
    'p-1.5 rounded border border-border bg-background hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors';

  return (
    <div
      ref={containerRef}
      className={isFullscreen ? 'fixed inset-0 z-50 bg-background p-6 flex flex-col' : ''}
      style={isFullscreen ? undefined : { height, position: 'relative' }}
    >
      <div className="absolute top-1 right-1 z-10 flex gap-1 no-print">
        {onResetZoom && (
          <button
            onClick={onResetZoom}
            className={btnClass}
            title="Reset zoom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        )}
        <button
          onClick={toggleFullscreen}
          className={btnClass}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          )}
        </button>
      </div>
      {isFullscreen && toolbar && (
        <div className="flex flex-wrap gap-1 mb-3 no-print">
          {toolbar}
        </div>
      )}
      <div className={isFullscreen ? 'flex-1 min-h-0' : 'h-full'}>
        {children}
      </div>
      {isFullscreen && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Click &amp; drag to zoom &middot; Use reset button to restore
        </p>
      )}
    </div>
  );
}
