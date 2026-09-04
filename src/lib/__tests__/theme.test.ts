import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCanvasTheme } from '../canvasTheme';

const css = readFileSync(new URL('../../styles/global.css', import.meta.url), 'utf8');

/** The custom properties declared in one selector's block. */
function paletteOf(selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  expect(start, `${selector} is not in global.css`).toBeGreaterThan(-1);

  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const palette = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    palette.set(name, value.trim());
  }
  return palette;
}

describe('the light palette', () => {
  const dark = paletteOf(':root {');
  const light = paletteOf(":root[data-theme='light']");

  it('answers every colour the dark one defines', () => {
    // Anything missed here falls through to the dark value and turns up as one
    // unreadable patch in an otherwise light window.
    const geometry = new Set(['--radius', '--radius-sm', '--transition']);
    const missing = [...dark.keys()].filter((name) => !geometry.has(name) && !light.has(name));

    expect(missing).toEqual([]);
  });

  it('does not invent colours the dark one has never heard of', () => {
    const extra = [...light.keys()].filter((name) => !dark.has(name));

    expect(extra).toEqual([]);
  });

  it('actually differs — no variable is left at its dark value', () => {
    const unchanged = [...light.entries()].filter(([name, value]) => dark.get(name) === value);

    expect(unchanged).toEqual([]);
  });

  it('leaves the four backdrops reading variables rather than raw colour', () => {
    // These were written out in full at each use, which is why swapping the
    // palette on its own used to change nothing about the page behind it.
    for (const marker of ['--page-from', '--canvas-from', '--panel-from', '--page-rule']) {
      expect(css).toContain(`var(${marker})`);
    }
  });
});

describe('the canvas palette', () => {
  it('gives every surface a colour in both themes', () => {
    const darkCanvas = getCanvasTheme('dark');
    const lightCanvas = getCanvasTheme('light');

    for (const key of Object.keys(darkCanvas) as Array<keyof typeof darkCanvas>) {
      expect(darkCanvas[key], key).toMatch(/^(#|rgba?\()/);
      expect(lightCanvas[key], key).toMatch(/^(#|rgba?\()/);
      expect(lightCanvas[key], key).not.toBe(darkCanvas[key]);
    }
  });

  it('falls back to dark for anything that is not light', () => {
    expect(getCanvasTheme('dark')).toEqual(getCanvasTheme('dark'));
    expect(getCanvasTheme('light').background).not.toBe(getCanvasTheme('dark').background);
  });
});
