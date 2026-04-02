import type { AppLanguage } from '../lib/i18n';
import type { RightTab } from '../models/types';

export type AppVariant = 'ide' | 'learn';

export const BRANCH_APP_VARIANT: AppVariant = 'learn';

const rawVariant = (import.meta.env.VITE_APP_VARIANT || BRANCH_APP_VARIANT)
  .trim()
  .toLowerCase();

export const APP_VARIANT: AppVariant =
  rawVariant === 'ide' ? 'ide' : 'learn';

export const IS_LEARN_APP = APP_VARIANT === 'learn';
export const IS_IDE_APP = APP_VARIANT === 'ide';

export const DEFAULT_RIGHT_TAB: RightTab = IS_LEARN_APP
  ? 'learn'
  : 'properties';

export const SHOW_LEARN_TAB = IS_LEARN_APP;
export const SHOW_LEARNING_ONBOARDING = IS_LEARN_APP;
export const ENABLE_LESSON_GUIDED_PALETTE = IS_LEARN_APP;
export const ENABLE_LESSON_TUTOR_TOOLS = IS_LEARN_APP;

export const getAppDisplayName = (_language: AppLanguage) =>
  IS_LEARN_APP ? 'OtisLearn' : 'OtisIDE';
