import { describe, expect, it } from 'vitest';
import { getHalfBridgeStatus } from '../driverStatus';

const status = (properties: Record<string, string | number | boolean>) =>
  getHalfBridgeStatus('en', properties);

describe('half bridge status', () => {
  it('coasts while neither side is enabled', () => {
    expect(status({ enabledR: false, enabledL: false, pwmR: 255, pwmL: 0 })).toEqual({
      text: 'COAST',
      active: false,
    });
  });

  it('brakes when both sides are enabled and driven the same', () => {
    expect(status({ enabledR: true, enabledL: true, pwmR: 0, pwmL: 0 }).text).toBe('BRAKE');
    expect(status({ enabledR: true, enabledL: true, pwmR: 120, pwmL: 120 }).text).toBe('BRAKE');
  });

  it('names the direction and the duty of the driven side', () => {
    expect(status({ enabledR: true, enabledL: true, pwmR: 200, pwmL: 0 })).toEqual({
      text: 'FORWARD 200',
      active: true,
    });
    expect(status({ enabledR: true, enabledL: true, pwmR: 0, pwmL: 180 })).toEqual({
      text: 'REVERSE 180',
      active: true,
    });
  });

  it('speaks Turkish too', () => {
    expect(getHalfBridgeStatus('tr', { enabledR: true, enabledL: true, pwmR: 90, pwmL: 0 }).text).toBe(
      'İLERİ 90'
    );
    expect(getHalfBridgeStatus('tr', { enabledR: false, enabledL: false }).text).toBe('SERBEST');
  });

  it('survives missing or unreadable values', () => {
    expect(status({}).text).toBe('COAST');
    expect(status({ enabledR: true, enabledL: true, pwmR: 'x', pwmL: 0 }).text).toBe('BRAKE');
  });
});
