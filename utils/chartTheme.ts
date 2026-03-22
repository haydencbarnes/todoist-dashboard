/**
 * Shared ECharts theme constants derived from the warm design system.
 *
 * Every chart should import from here instead of hardcoding hex values.
 * This keeps the design-token mapping in one place so palette changes
 * propagate automatically.
 */

// ── Surface & background ─────────────────────────────────────────
export const WARM_BLACK = '#0D0D0D';
export const WARM_CARD = '#1A1A1A';
export const WARM_HOVER = '#202020';
export const WARM_BORDER = '#2A2A2A';

// ── Accent colours ───────────────────────────────────────────────
export const WARM_PEACH = '#FF9B71';
export const WARM_SAGE = '#7FD49E';
export const WARM_BLUE = '#8BB4E8';
export const WARM_GRAY = '#9CA3AF';
export const WARM_DANGER = '#E57373';
export const WARM_WARNING = '#FFB74D';

// ── Derived / computed shades (for emphasis, gradients, heatmaps) ─
export const WARM_PEACH_LIGHT = '#FFB599';
export const WARM_PEACH_DARK = '#E8845A';
export const WARM_BLUE_LIGHT = '#A5C7EF';

// ── Text ─────────────────────────────────────────────────────────
export const TEXT_PRIMARY = '#F5F5F5';

// ── Reusable tooltip config ──────────────────────────────────────
export const CHART_TOOLTIP = {
  backgroundColor: `rgba(26, 26, 26, 0.95)`,  // warm-card @ 95%
  borderColor: WARM_BORDER,
  textStyle: { color: TEXT_PRIMARY },
} as const;

// ── Reusable axis styles ─────────────────────────────────────────
export const AXIS_LABEL = { color: WARM_GRAY } as const;
export const AXIS_LINE = { lineStyle: { color: WARM_BORDER } } as const;
export const SPLIT_LINE = { lineStyle: { color: WARM_BORDER } } as const;
