import type { CircuitComponent } from '../models/types';
import { t, type AppLanguage } from './i18n';

const numberOf = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * What a two half bridge driver such as the BTS7960 is doing, read off the pins:
 * a leg that is not enabled is disconnected, two legs driven the same hold the
 * motor still, and otherwise the harder driven side decides which way it turns.
 */
export function getHalfBridgeStatus(
  language: AppLanguage,
  properties: CircuitComponent['properties']
): { text: string; active: boolean } {
  const enabledR = properties.enabledR === true;
  const enabledL = properties.enabledL === true;
  const pwmR = Math.round(numberOf(properties.pwmR));
  const pwmL = Math.round(numberOf(properties.pwmL));

  if (!enabledR && !enabledL) {
    return { text: t(language, 'driverCoast'), active: false };
  }

  if (pwmR === pwmL) {
    return { text: t(language, 'driverBrake'), active: false };
  }

  const forward = pwmR > pwmL;
  return {
    text: `${t(language, forward ? 'driverForward' : 'driverReverse')} ${forward ? pwmR : pwmL}`,
    active: true,
  };
}
