import {
  findComponentByLessonRef,
  findComponentsByType,
  resolveLessonEndpoint,
  toLessonFocusTarget,
  wireConnectsEndpoints,
  wireTouchesEndpoint,
} from '../lib/circuitAnalysis';
import type {
  Lesson,
  LessonCheck,
  LessonCheckResult,
  LessonProgressState,
  LessonStateSnapshot,
  LessonStep,
} from './types';
import { resolveLessonText } from './types';
import type { AppLanguage } from '../lib/i18n';

const codePatternMatches = (
  code: string,
  check: Extract<LessonCheck, { type: 'code' }>
) =>
  check.patterns.map((pattern) => {
    if (check.regex) {
      return new RegExp(pattern, 'i').test(code);
    }

    return code.toLowerCase().includes(pattern.toLowerCase());
  });

const textPatternMatches = (
  text: string,
  patterns: string[]
) => patterns.map((pattern) => text.toLowerCase().includes(pattern.toLowerCase()));

const evaluatePatternMode = (
  matches: boolean[],
  mode: 'all' | 'any'
) => (mode === 'any' ? matches.some(Boolean) : matches.every(Boolean));

const somePatternMatched = (matches: boolean[]) => matches.some(Boolean);

const buildResult = (
  checkId: string,
  status: 'pass' | 'fail' | 'hint',
  message: string,
  target?: LessonCheckResult['target']
): LessonCheckResult => ({
  checkId,
  status,
  message,
  target,
});

export const evaluateLessonCheck = (
  check: LessonCheck,
  lesson: Lesson,
  snapshot: LessonStateSnapshot,
  language: AppLanguage
): LessonCheckResult => {
  const passText = resolveLessonText(language, check.passText);
  const failText = resolveLessonText(language, check.failText);
  const hintText = check.hintText
    ? resolveLessonText(language, check.hintText)
    : failText;

  switch (check.type) {
    case 'board':
      return snapshot.boardType === check.boardType
        ? buildResult(check.id, 'pass', passText)
        : buildResult(check.id, 'fail', failText);

    case 'component': {
      if (check.ref) {
        const component = findComponentByLessonRef(snapshot.components, check.ref);
        if (component && component.type === check.componentType) {
          return buildResult(check.id, 'pass', passText, {
            kind: 'component',
            componentId: component.id,
          });
        }

        return buildResult(check.id, 'fail', failText);
      }

      const minimum = check.minimum ?? 1;
      const matching = findComponentsByType(snapshot.components, check.componentType);
      if (matching.length >= minimum) {
        return buildResult(check.id, 'pass', passText, {
          kind: 'component',
          componentId: matching[0].id,
        });
      }

      const status = matching.length > 0 && check.hintText ? 'hint' : 'fail';
      return buildResult(check.id, status, status === 'hint' ? hintText : failText);
    }

    case 'connection': {
      const start = resolveLessonEndpoint(
        check.from,
        snapshot.components,
        snapshot.boardType
      );
      const end = resolveLessonEndpoint(
        check.to,
        snapshot.components,
        snapshot.boardType
      );

      const fallbackTarget =
        toLessonFocusTarget(check.from, snapshot.components, snapshot.boardType) ??
        toLessonFocusTarget(check.to, snapshot.components, snapshot.boardType);

      if (!start || !end) {
        return buildResult(check.id, 'fail', failText, fallbackTarget);
      }

      const exactMatch = snapshot.wires.some((wire) =>
        wireConnectsEndpoints(wire, start, end)
      );
      if (exactMatch) {
        return buildResult(check.id, 'pass', passText, fallbackTarget);
      }

      const partialMatch = snapshot.wires.some(
        (wire) => wireTouchesEndpoint(wire, start) || wireTouchesEndpoint(wire, end)
      );
      const status = partialMatch && check.hintText ? 'hint' : 'fail';
      return buildResult(
        check.id,
        status,
        status === 'hint' ? hintText : failText,
        fallbackTarget
      );
    }

    case 'code': {
      const matches = codePatternMatches(snapshot.code, check);
      const mode = check.mode ?? 'all';
      if (evaluatePatternMode(matches, mode)) {
        return buildResult(check.id, 'pass', passText, { kind: 'code' });
      }

      const status = somePatternMatched(matches) && check.hintText ? 'hint' : 'fail';
      return buildResult(
        check.id,
        status,
        status === 'hint' ? hintText : failText,
        { kind: 'code' }
      );
    }

    case 'simulation':
      if (snapshot.simulation.running) {
        return buildResult(check.id, 'pass', passText);
      }

      return buildResult(
        check.id,
        check.hintText ? 'hint' : 'fail',
        check.hintText ? hintText : failText
      );

    case 'serial': {
      const serialText = snapshot.simulation.serialOutput.join('\n');
      const matches = textPatternMatches(serialText, check.patterns);
      const mode = check.mode ?? 'all';
      if (evaluatePatternMode(matches, mode)) {
        return buildResult(check.id, 'pass', passText);
      }

      const status = somePatternMatched(matches) && check.hintText ? 'hint' : 'fail';
      return buildResult(check.id, status, status === 'hint' ? hintText : failText);
    }
  }
};

export const evaluateLessonStep = (
  lesson: Lesson,
  step: LessonStep,
  snapshot: LessonStateSnapshot,
  language: AppLanguage
) => step.checks.map((check) => evaluateLessonCheck(check, lesson, snapshot, language));

export const summarizeLessonFailures = (
  results: LessonCheckResult[]
) =>
  results
    .filter((result) => result.status !== 'pass')
    .map((result) => result.message)
    .join('\n');

export const getNextLessonStep = (
  lesson: Lesson,
  progress: LessonProgressState | undefined
) =>
  lesson.steps.find(
    (step) => !progress?.completedStepIds.includes(step.id)
  ) ?? null;
