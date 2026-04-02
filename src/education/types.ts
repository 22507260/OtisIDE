import type { ControllerBoardType } from '../models/arduinoUno';
import type {
  CircuitComponent,
  ComponentType,
  SimulationState,
  Wire,
} from '../models/types';
import type { AppLanguage } from '../lib/i18n';

export const LESSON_REF_PROPERTY = '__lessonRef';

export interface LessonLocaleText {
  en: string;
  tr: string;
}

export interface LessonEndpointRef {
  component: 'arduino' | 'breadboard' | string;
  pin: string;
}

export interface LessonComponentSeed {
  ref: string;
  type: ComponentType;
  x: number;
  y: number;
  rotation?: number;
  properties?: Record<string, string | number | boolean>;
}

export interface LessonWireSeed {
  from: LessonEndpointRef;
  to: LessonEndpointRef;
  color?: string;
}

export interface LessonProjectSeed {
  boardType: ControllerBoardType;
  code: string;
  components: LessonComponentSeed[];
  wires: LessonWireSeed[];
}

type LessonCheckCopy = {
  passText: LessonLocaleText;
  failText: LessonLocaleText;
  hintText?: LessonLocaleText;
};

export type LessonCheck =
  | ({
      id: string;
      type: 'board';
      boardType: ControllerBoardType;
    } & LessonCheckCopy)
  | ({
      id: string;
      type: 'component';
      componentType: ComponentType;
      ref?: string;
      minimum?: number;
    } & LessonCheckCopy)
  | ({
      id: string;
      type: 'connection';
      from: LessonEndpointRef;
      to: LessonEndpointRef;
    } & LessonCheckCopy)
  | ({
      id: string;
      type: 'code';
      patterns: string[];
      mode?: 'all' | 'any';
      regex?: boolean;
    } & LessonCheckCopy)
  | ({
      id: string;
      type: 'simulation';
    } & LessonCheckCopy)
  | ({
      id: string;
      type: 'serial';
      patterns: string[];
      mode?: 'all' | 'any';
    } & LessonCheckCopy);

export interface LessonStep {
  id: string;
  title: LessonLocaleText;
  instruction: LessonLocaleText;
  hint: LessonLocaleText;
  explanation: LessonLocaleText;
  success: LessonLocaleText;
  checks: LessonCheck[];
  solutionProject: LessonProjectSeed;
}

export interface Lesson {
  id: string;
  title: LessonLocaleText;
  description: LessonLocaleText;
  outcome: LessonLocaleText;
  estimatedMinutes: number;
  difficulty: 'starter';
  boardType: ControllerBoardType;
  allowedComponents: ComponentType[];
  starterProject: LessonProjectSeed;
  steps: LessonStep[];
}

export type LessonCheckStatus = 'pass' | 'fail' | 'hint';

export type LessonFocusTarget =
  | { kind: 'board-pin'; pinId: string }
  | { kind: 'component'; componentId: string }
  | { kind: 'component-pin'; componentId: string; pinId: string }
  | { kind: 'code' };

export interface LessonCheckResult {
  checkId: string;
  status: LessonCheckStatus;
  message: string;
  target?: LessonFocusTarget;
}

export interface LessonProgressState {
  completedStepIds: string[];
  completed: boolean;
  startedAt: string;
  completedAt?: string;
}

export interface LessonStateSnapshot {
  components: CircuitComponent[];
  wires: Wire[];
  code: string;
  boardType: ControllerBoardType;
  simulation: SimulationState;
}

export const resolveLessonText = (
  language: AppLanguage,
  value: LessonLocaleText
): string => value[language];

export const getLessonStepById = (
  lesson: Lesson,
  stepId: string | null
): LessonStep | null => {
  if (!stepId) return lesson.steps[0] ?? null;
  return lesson.steps.find((step) => step.id === stepId) ?? lesson.steps[0] ?? null;
};

export const isLessonStepComplete = (results: LessonCheckResult[]) =>
  results.length > 0 && results.every((result) => result.status === 'pass');
