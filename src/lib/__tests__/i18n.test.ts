import { describe, expect, it } from 'vitest';
import { COMPONENT_NAME_TR, UI_STRINGS, getDamageLabel, getPinTypeLabel, t } from '../i18n';
import { COMPONENT_CATALOG } from '../../models/types';

describe('Turkish coverage', () => {
  it('says every interface string in both languages', () => {
    // The key type is derived from the English table alone, so a string added
    // to it and forgotten in the other one type-checks perfectly and then
    // prints "undefined" to anyone reading in Turkish.
    const english = Object.keys(UI_STRINGS.en);
    const turkish = Object.keys(UI_STRINGS.tr);

    expect(english.filter((key) => !turkish.includes(key)), 'missing Turkish').toEqual([]);
    expect(turkish.filter((key) => !english.includes(key)), 'missing English').toEqual([]);
  });

  it('leaves no interface string empty', () => {
    for (const [language, table] of Object.entries(UI_STRINGS)) {
      for (const [key, value] of Object.entries(table)) {
        expect(typeof value, `${language}.${key}`).toBe('string');
        expect((value as string).trim(), `${language}.${key}`).not.toBe('');
      }
    }
  });

  it('names every catalog part in Turkish', () => {
    const missing = COMPONENT_CATALOG.filter((item) => !COMPONENT_NAME_TR[item.type]).map(
      (item) => item.type
    );

    expect(missing, 'these parts have no Turkish name').toEqual([]);
  });

  it('translates the pin types that have a Turkish word', () => {
    expect(getPinTypeLabel('tr', 'digital')).toBe('dijital');
    expect(getPinTypeLabel('tr', 'power')).toBe('güç');
    expect(getPinTypeLabel('tr', 'ground')).toBe('toprak');
    expect(getPinTypeLabel('tr', 'passive')).toBe('pasif');

    // English keeps the raw word, and anything unknown passes through.
    expect(getPinTypeLabel('en', 'digital')).toBe('digital');
    expect(getPinTypeLabel('tr', 'nonsense')).toBe('nonsense');
  });

  it('explains every damage reason in both languages', () => {
    for (const reason of ['overcurrent', 'overvoltage', 'overpower']) {
      expect(getDamageLabel('tr', reason)).not.toBe(t('tr', 'burned'));
      expect(getDamageLabel('en', reason)).not.toBe(t('en', 'burned'));
    }

    expect(getDamageLabel('tr', 'nonsense')).toBe(t('tr', 'burned'));
  });
});
