import { describe, expect, it } from 'vitest';
import { COMPONENT_NAME_TR, getDamageLabel, getPinTypeLabel, t } from '../i18n';
import { COMPONENT_CATALOG } from '../../models/types';

describe('Turkish coverage', () => {
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
