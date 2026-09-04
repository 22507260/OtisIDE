/**
 * The colours the canvas paints itself with.
 *
 * Everything else in the app reads its colours from CSS custom properties, but
 * Konva draws to a bitmap and cannot see a stylesheet — so the handful of
 * colours the board is made of live here instead, one set per theme, and the
 * canvas picks the set that matches the rest of the window.
 */

export type AppTheme = 'dark' | 'light';

export type CanvasTheme = {
  /** The workspace behind everything. */
  background: string;
  /** The dotted grid on it. */
  grid: string;
  /** The drag-a-box-round-things rectangle. */
  marqueeFill: string;
  marqueeStroke: string;
  /** The plate a pin's name is written on when you hover it. */
  pinLabelFill: string;
  pinLabelText: string;
  /** Current arrows, and the marks on a cable carrying nothing. */
  flowFill: string;
  flowStroke: string;
  flowGlow: string;
  flowIdle: string;
};

const DARK: CanvasTheme = {
  background: '#0e0e1e',
  grid: '#1e1e3a',
  marqueeFill: 'rgba(94, 160, 255, 0.12)',
  marqueeStroke: '#5ea0ff',
  pinLabelFill: 'rgba(8, 20, 16, 0.88)',
  pinLabelText: '#eafff6',
  flowFill: '#9ef7ff',
  flowStroke: '#0b2233',
  flowGlow: '#4aa3ff',
  flowIdle: '#8fa3b0',
};

/**
 * Greys and whites, and the current arrows go dark instead of glowing.
 *
 * A pale cyan arrow that reads beautifully on near-black is invisible on white,
 * so on this side the marks are drawn as dark shapes with a light outline —
 * the same idea inverted rather than the same colours reused.
 */
const LIGHT: CanvasTheme = {
  background: '#f2f5f8',
  grid: '#c8d2dc',
  marqueeFill: 'rgba(31, 111, 196, 0.12)',
  marqueeStroke: '#1f6fc4',
  pinLabelFill: 'rgba(255, 255, 255, 0.94)',
  pinLabelText: '#16232e',
  flowFill: '#0f6ea8',
  flowStroke: '#eaf4fb',
  flowGlow: '#8ec7e8',
  flowIdle: '#8a9aa7',
};

export function getCanvasTheme(theme: AppTheme): CanvasTheme {
  return theme === 'light' ? LIGHT : DARK;
}
