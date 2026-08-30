/**
 * Whether a keystroke belongs to whatever the user is typing into, rather than
 * to the canvas shortcuts.
 *
 * This used to be a tag-name check for INPUT and TEXTAREA, which quietly stopped
 * covering the code editor: Monaco 0.55 drives its input through the EditContext
 * API by default, so the focused node is a <div class="native-edit-context">
 * inside the editor rather than the hidden textarea older versions used. The
 * guard fell through, and every canvas shortcut fired while the user was writing
 * code — Ctrl+V pasted circuit parts instead of text, and Backspace deleted the
 * selected part.
 */

/** Just the bits the guard reads, so tests can stand in plain objects. */
export type KeyEventTargetLike = {
  tagName?: unknown;
  isContentEditable?: unknown;
  closest?: (selector: string) => unknown;
};

const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Monaco's root class; the EditContext node lives under its .overflow-guard. */
const CODE_EDITOR_SELECTOR = '.monaco-editor';

export function isTextEntryTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;

  const node = target as KeyEventTargetLike;

  if (typeof node.tagName === 'string' && TEXT_ENTRY_TAGS.has(node.tagName.toUpperCase())) {
    return true;
  }

  if (node.isContentEditable === true) return true;

  if (typeof node.closest === 'function') {
    try {
      if (node.closest(CODE_EDITOR_SELECTOR)) return true;
    } catch {
      // Not an element after all (the window, a text node): nothing to match.
    }
  }

  return false;
}
