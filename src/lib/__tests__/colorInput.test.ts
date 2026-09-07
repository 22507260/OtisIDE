import { describe, expect, it } from 'vitest';
import { normalizeHexColor } from '../colorInput';

describe('normalizeHexColor', () => {
  it('takes a six-digit code as it is', () => {
    expect(normalizeHexColor('#00e5ff')).toBe('#00e5ff');
  });

  it('expands a three-digit code', () => {
    expect(normalizeHexColor('#fff')).toBe('#ffffff');
    expect(normalizeHexColor('#0a3')).toBe('#00aa33');
  });

  it('does not insist on the hash', () => {
    expect(normalizeHexColor('00e5ff')).toBe('#00e5ff');
    expect(normalizeHexColor('fff')).toBe('#ffffff');
  });

  it('reads upper case and stores lower', () => {
    expect(normalizeHexColor('#00E5FF')).toBe('#00e5ff');
  });

  it('ignores whitespace picked up with a copied code', () => {
    expect(normalizeHexColor('  #00e5ff \n')).toBe('#00e5ff');
  });

  it('refuses a code that is still being typed', () => {
    // Half-typed values must not be written to the wire, or the colour lurches
    // about while someone types the one they wanted.
    expect(normalizeHexColor('#00e5')).toBeNull();
    expect(normalizeHexColor('#')).toBeNull();
    expect(normalizeHexColor('')).toBeNull();
  });

  it('refuses anything that is not a hex code', () => {
    expect(normalizeHexColor('red')).toBeNull();
    expect(normalizeHexColor('rgb(255, 0, 0)')).toBeNull();
    expect(normalizeHexColor('#00e5fg')).toBeNull();
    expect(normalizeHexColor('#00e5fff')).toBeNull();
  });

  it('refuses a value that is not text at all', () => {
    expect(normalizeHexColor(undefined as unknown as string)).toBeNull();
    expect(normalizeHexColor(null as unknown as string)).toBeNull();
  });
});
