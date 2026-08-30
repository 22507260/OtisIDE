import { describe, expect, it } from 'vitest';
import { isTextEntryTarget } from '../keyboardTarget';

/** A node that answers closest() the way the DOM would for one ancestor chain. */
const node = (tagName: string, ancestors: string[] = [], extra: object = {}) => ({
  tagName,
  closest: (selector: string) => (ancestors.includes(selector) ? {} : null),
  ...extra,
});

describe('isTextEntryTarget', () => {
  it('claims the form fields that swallow their own keys', () => {
    expect(isTextEntryTarget(node('INPUT'))).toBe(true);
    expect(isTextEntryTarget(node('TEXTAREA'))).toBe(true);
    expect(isTextEntryTarget(node('SELECT'))).toBe(true);
  });

  it('claims the code editor, whose input is a plain div', () => {
    // Monaco 0.55 drives input through the EditContext API, so the focused node
    // is <div class="native-edit-context"> rather than a hidden textarea. This
    // is the case a tag-name check missed, which let Ctrl+V paste circuit parts
    // instead of text and Backspace delete the selected part.
    expect(isTextEntryTarget(node('DIV', ['.monaco-editor']))).toBe(true);
  });

  it('claims anything contenteditable', () => {
    expect(isTextEntryTarget(node('DIV', [], { isContentEditable: true }))).toBe(true);
  });

  it('leaves the canvas and the page alone', () => {
    expect(isTextEntryTarget(node('CANVAS'))).toBe(false);
    expect(isTextEntryTarget(node('DIV'))).toBe(false);
    expect(isTextEntryTarget(node('BODY', ['.properties-panel']))).toBe(false);
  });

  it('survives a target that is not an element', () => {
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(undefined)).toBe(false);
    expect(isTextEntryTarget('input')).toBe(false);
    expect(isTextEntryTarget({})).toBe(false);
    expect(
      isTextEntryTarget({
        tagName: 'DIV',
        closest: () => {
          throw new Error('not an element');
        },
      })
    ).toBe(false);
  });
});
