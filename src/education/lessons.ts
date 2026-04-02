import type { Lesson } from './types';
import { buttonInputLesson } from './lessonButtonInput';
import { buzzerAlarmLesson } from './lessonBuzzerAlarm';
import { ledBlinkLesson } from './lessonLedBlink';
import { temperatureMonitorLesson } from './lessonTemperatureMonitor';
import { trafficLightLesson } from './lessonTrafficLight';

export const LESSONS: Lesson[] = [
  ledBlinkLesson,
  buttonInputLesson,
  trafficLightLesson,
  temperatureMonitorLesson,
  buzzerAlarmLesson,
];

export const LESSONS_BY_ID = Object.fromEntries(
  LESSONS.map((lesson) => [lesson.id, lesson])
) as Record<string, Lesson>;
