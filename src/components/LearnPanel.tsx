import React from 'react';
import { LESSONS, LESSONS_BY_ID } from '../education/lessons';
import { getLessonStepById, resolveLessonText } from '../education/types';
import { useCircuitStore } from '../store/circuitStore';

const LearnPanel: React.FC = () => {
  const language = useCircuitStore((s) => s.language);
  const activeLessonId = useCircuitStore((s) => s.activeLessonId);
  const activeStepId = useCircuitStore((s) => s.activeStepId);
  const learningMode = useCircuitStore((s) => s.learningMode);
  const learningAdvancedPalette = useCircuitStore((s) => s.learningAdvancedPalette);
  const lessonProgress = useCircuitStore((s) => s.lessonProgress);
  const lessonCheckResults = useCircuitStore((s) => s.lessonCheckResults);
  const setLearningAdvancedPalette = useCircuitStore(
    (s) => s.setLearningAdvancedPalette
  );
  const startLesson = useCircuitStore((s) => s.startLesson);
  const exitLesson = useCircuitStore((s) => s.exitLesson);
  const applyLessonSolution = useCircuitStore((s) => s.applyLessonSolution);
  const setRightTab = useCircuitStore((s) => s.setRightTab);
  const reopenLearningOnboarding = useCircuitStore(
    (s) => s.reopenLearningOnboarding
  );

  const activeLesson = activeLessonId ? LESSONS_BY_ID[activeLessonId] : null;
  const activeStep = activeLesson
    ? getLessonStepById(activeLesson, activeStepId)
    : null;
  const activeProgress = activeLesson
    ? lessonProgress[activeLesson.id]
    : null;
  const progressCount = activeProgress?.completedStepIds.length ?? 0;
  const progressTotal = activeLesson?.steps.length ?? 0;
  const progressPercent =
    progressTotal > 0 ? Math.round((progressCount / progressTotal) * 100) : 0;

  const labels =
    language === 'tr'
      ? {
          title: 'Ogren',
          introTitle: 'Yonlendirmeli dersler',
          introText:
            'Bir ders sec, adim adim ilerle ve devreyi dogru kurup kod yazarken canli geri bildirim al.',
          activeMode: learningMode ? 'Ders modu acik' : 'Serbest mod',
          outcome: 'Kazanim',
          progress: 'Ilerleme',
          openTutor: 'AI Ogretmeni Ac',
          showSolution: 'Cozumu Goster',
          exitLesson: 'Dersi Bitir',
          browseLessons: 'Dersleri Goster',
          currentStep: 'Su anki adim',
          checks: 'Kontroller',
          steps: 'Adimlar',
          startLesson: 'Dersi Baslat',
          restartLesson: 'Yeniden Baslat',
          minutes: 'dk',
          paletteTitle: 'Palet modu',
          paletteIntro:
            'Ders modunda baslangic seviyesi parcalar one cikarilir. Istersen gelismis gorunumu acabilirsin.',
          guidedPalette: 'Rehberli palet',
          advancedPalette: 'Gelismis palet',
          done: 'Tamamlandi',
          current: 'Aktif',
          pending: 'Bekliyor',
        }
      : {
          title: 'Learn',
          introTitle: 'Guided lessons',
          introText:
            'Pick a lesson, move step by step, and get live feedback while wiring and coding.',
          activeMode: learningMode ? 'Lesson mode on' : 'Free mode',
          outcome: 'Outcome',
          progress: 'Progress',
          openTutor: 'Open AI Tutor',
          showSolution: 'Show Solution',
          exitLesson: 'Exit Lesson',
          browseLessons: 'Show Lessons',
          currentStep: 'Current step',
          checks: 'Checks',
          steps: 'Steps',
          startLesson: 'Start Lesson',
          restartLesson: 'Restart Lesson',
          minutes: 'min',
          paletteTitle: 'Palette mode',
          paletteIntro:
            'Lesson mode favors a beginner-friendly subset. Switch to advanced if you want the full catalog.',
          guidedPalette: 'Guided palette',
          advancedPalette: 'Advanced palette',
          done: 'Done',
          current: 'Current',
          pending: 'Pending',
        };

  if (!activeLesson || !activeStep) {
    return (
      <div className="learn-panel">
        <div className="ai-panel-header">
          <div className="ai-panel-title-wrap">
            <div className="ai-panel-title">{labels.title}</div>
            <div className="ai-panel-subtitle">{labels.introTitle}</div>
          </div>
          <button
            className="toolbar-btn ai-header-btn"
            onClick={() => reopenLearningOnboarding()}
            type="button"
          >
            {labels.browseLessons}
          </button>
        </div>

        <div className="properties-content">
          <div className="property-group">
            <div className="property-group-title">{labels.introTitle}</div>
            <p className="learn-copy">{labels.introText}</p>
          </div>

          {LESSONS.map((lesson) => (
            <div className="property-group lesson-card" key={lesson.id}>
              <div className="lesson-card-top">
                <div>
                  <div className="lesson-card-title">
                    {resolveLessonText(language, lesson.title)}
                  </div>
                  <div className="lesson-card-meta">
                    {lesson.estimatedMinutes} {labels.minutes}
                  </div>
                </div>
                <button
                  className="toolbar-btn success"
                  onClick={() => startLesson(lesson.id)}
                  type="button"
                >
                  {labels.startLesson}
                </button>
              </div>
              <p className="learn-copy">
                {resolveLessonText(language, lesson.description)}
              </p>
              <div className="lesson-card-outcome">
                <strong>{labels.outcome}</strong>
                <span>{resolveLessonText(language, lesson.outcome)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="learn-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title-wrap">
          <div className="ai-panel-title">
            {resolveLessonText(language, activeLesson.title)}
          </div>
          <div className="ai-panel-subtitle">{labels.activeMode}</div>
        </div>
        <div className="ai-panel-actions">
          <button
            className="toolbar-btn ai-header-btn"
            onClick={() => setRightTab('ai')}
            type="button"
          >
            {labels.openTutor}
          </button>
          <button
            className="toolbar-btn ai-header-btn"
            onClick={() => exitLesson()}
            type="button"
          >
            {labels.exitLesson}
          </button>
        </div>
      </div>

      <div className="properties-content">
        <div className="property-group">
          <div className="property-group-title">{labels.progress}</div>
          <div className="learn-progress-row">
            <strong>{progressPercent}%</strong>
            <span>
              {progressCount}/{progressTotal}
            </span>
          </div>
          <div className="learn-progress-bar">
            <div
              className="learn-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="learn-copy">
            {resolveLessonText(language, activeLesson.outcome)}
          </p>
        </div>

        <div className="property-group">
          <div className="property-group-title">{labels.paletteTitle}</div>
          <p className="learn-copy">{labels.paletteIntro}</p>
          <div className="learn-toggle-row">
            <button
              className={`toolbar-btn ${
                !learningAdvancedPalette ? 'active' : ''
              }`}
              onClick={() => setLearningAdvancedPalette(false)}
              type="button"
            >
              {labels.guidedPalette}
            </button>
            <button
              className={`toolbar-btn ${
                learningAdvancedPalette ? 'active' : ''
              }`}
              onClick={() => setLearningAdvancedPalette(true)}
              type="button"
            >
              {labels.advancedPalette}
            </button>
          </div>
        </div>

        <div className="property-group">
          <div className="property-group-title">{labels.currentStep}</div>
          <div className="lesson-card-title">
            {resolveLessonText(language, activeStep.title)}
          </div>
          <p className="learn-copy">
            {resolveLessonText(language, activeStep.instruction)}
          </p>
          <div className="learn-toggle-row">
            <button
              className="toolbar-btn success"
              onClick={() => setRightTab('ai')}
              type="button"
            >
              {labels.openTutor}
            </button>
            <button
              className="toolbar-btn"
              onClick={() => applyLessonSolution()}
              type="button"
            >
              {labels.showSolution}
            </button>
            <button
              className="toolbar-btn"
              onClick={() => startLesson(activeLesson.id)}
              type="button"
            >
              {labels.restartLesson}
            </button>
          </div>
        </div>

        <div className="property-group">
          <div className="property-group-title">{labels.checks}</div>
          <div className="learn-check-list">
            {lessonCheckResults.map((result) => (
              <div
                className={`learn-check-item ${result.status}`}
                key={result.checkId}
              >
                <span className="learn-check-badge">{result.status}</span>
                <span>{result.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="property-group">
          <div className="property-group-title">{labels.steps}</div>
          <div className="learn-step-list">
            {activeLesson.steps.map((step) => {
              const completed =
                activeProgress?.completedStepIds.includes(step.id) ?? false;
              const current = step.id === activeStep.id;
              const statusLabel = completed
                ? labels.done
                : current
                  ? labels.current
                  : labels.pending;

              return (
                <div
                  className={`learn-step-item ${
                    completed ? 'completed' : current ? 'current' : ''
                  }`}
                  key={step.id}
                >
                  <div>
                    <div className="learn-step-title">
                      {resolveLessonText(language, step.title)}
                    </div>
                    <div className="learn-step-copy">
                      {resolveLessonText(language, step.instruction)}
                    </div>
                  </div>
                  <span className="panel-pill">{statusLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearnPanel;




