import type { LessonLocaleText } from './types';

export const lt = (en: string, tr: string): LessonLocaleText => ({ en, tr });

export const EMPTY_SKETCH = `void setup() {
}

void loop() {
}
`;
