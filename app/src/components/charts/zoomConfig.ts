import zoomPlugin from 'chartjs-plugin-zoom';
import { Chart as ChartJS } from 'chart.js';

// Register zoom plugin globally
ChartJS.register(zoomPlugin);

/** Standard zoom + pan options for all report charts */
export const zoomOptions = {
  zoom: {
    drag: { enabled: true },
    pinch: { enabled: true },
    mode: 'xy' as const,
  },
};
