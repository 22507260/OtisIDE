import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCanvasTheme } from '../canvasTheme';

const css = readFileSync(new URL('../../styles/global.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const store = readFileSync(new URL('../../store/circuitStore.ts', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../../components/BottomPanel.tsx', import.meta.url), 'utf8');

describe('the chrome is dark, and only dark', () => {
  it('has one palette in the stylesheet and no theme selector', () => {
    // Light is the canvas's setting, not the window's. A stylesheet that
    // switched with it is what made the whole IDE go white.
    expect(css).toContain(':root {');
    expect(css).not.toContain('data-theme');
  });

  it('never writes a theme onto the document', () => {
    for (const source of [store, html]) {
      expect(source).not.toContain('data-theme');
      expect(source).not.toContain('dataset.theme');
    }
  });

  it('leaves the editor on its one theme', () => {
    expect(editor).toContain("theme=\"ai-circuit-dark\"");
    expect(editor).not.toContain('ai-circuit-light');
  });

  it('still reads its surfaces from named colours rather than writing them out', () => {
    // Kept from when this did drive a light mode: a named colour beats the same
    // rgba() copied into nine rules, whether or not it ever changes again.
    for (const marker of ['--page-from', '--canvas-from', '--panel-from', '--chrome-from']) {
      expect(css).toContain(`var(${marker})`);
    }
  });
});

describe('the canvas palette', () => {
  it('gives every surface a colour in both themes', () => {
    const dark = getCanvasTheme('dark');
    const light = getCanvasTheme('light');

    for (const key of Object.keys(dark) as Array<keyof typeof dark>) {
      expect(dark[key], key).toMatch(/^(#|rgba?\()/);
      expect(light[key], key).toMatch(/^(#|rgba?\()/);
      expect(light[key], key).not.toBe(dark[key]);
    }
  });

  it('paints a light workspace light and a dark one dark', () => {
    expect(getCanvasTheme('light').background).not.toBe(getCanvasTheme('dark').background);
    expect(getCanvasTheme('light').grid).not.toBe(getCanvasTheme('dark').grid);
  });
});
