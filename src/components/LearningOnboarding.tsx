import React from 'react';
import { LESSONS } from '../education/lessons';
import { resolveLessonText } from '../education/types';
import { useCircuitStore } from '../store/circuitStore';
import {
  getAppDisplayName,
  SHOW_LEARNING_ONBOARDING,
} from '../config/appVariant';

const LearningOnboarding: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const showLearningOnboarding = useCircuitStore(
    (s) => s.showLearningOnboarding
  );
  const dismissLearningOnboarding = useCircuitStore(
    (s) => s.dismissLearningOnboarding
  );
  const startLesson = useCircuitStore((s) => s.startLesson);

  if (!SHOW_LEARNING_ONBOARDING || !showLearningOnboarding) {
    return null;
  }

  const labels =
    language === 'tr'
      ? {
          title: getAppDisplayName(language),
          subtitle:
            'Baslangic seviyesine uygun bir ders sec ve devreyi adim adim kur.',
          freeMode:
            'Simdilik serbest modda devam et',
          startLesson: 'Dersi Baslat',
          minutes: 'dk',
          quickStart: 'Hizli baslangic',
        }
      : {
          title: getAppDisplayName(language),
          subtitle:
            'Choose a beginner-friendly lesson and build the circuit step by step.',
          freeMode: 'Stay in free mode for now',
          startLesson: 'Start lesson',
          minutes: 'min',
          quickStart: 'Quick start',
        };

  return (
    <div className="learn-onboarding-backdrop">
      <div className="learn-onboarding-card">
        <div className="learn-onboarding-header">
          <div>
            <div className="learn-onboarding-title">{labels.title}</div>
            <div className="learn-onboarding-subtitle">{labels.subtitle}</div>
          </div>
          <button
            className="toolbar-btn"
            onClick={() => dismissLearningOnboarding()}
            type="button"
          >
            {labels.freeMode}
          </button>
        </div>

        <div className="learn-onboarding-grid">
          {LESSONS.map((lesson) => (
            <div className="learn-onboarding-lesson" key={lesson.id}>
              <div className="learn-onboarding-chip">{labels.quickStart}</div>
              <div className="learn-onboarding-lesson-title">
                {resolveLessonText(language, lesson.title)}
              </div>
              <div className="learn-onboarding-lesson-meta">
                {lesson.estimatedMinutes} {labels.minutes}
              </div>
              <p className="learn-copy">
                {resolveLessonText(language, lesson.description)}
              </p>
              <p className="learn-copy muted">
                {resolveLessonText(language, lesson.outcome)}
              </p>
              <button
                className="toolbar-btn success"
                onClick={() => startLesson(lesson.id)}
                type="button"
              >
                {labels.startLesson}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LearningOnboarding;




