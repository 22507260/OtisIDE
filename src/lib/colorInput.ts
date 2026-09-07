/**
 * Reading a colour someone typed.
 *
 * The picker beside the field hands back a well-formed `#rrggbb` and needs none
 * of this. The field is for the other way round: pasting a colour from
 * somewhere else, where it arrives as `#FFF`, or `00e5ff`, or with a space on
 * the end from the selection.
 */

const SHORT = /^[0-9a-f]{3}$/;
const LONG = /^[0-9a-f]{6}$/;

/**
 * `text` as a `#rrggbb` colour, or null if it is not one.
 *
 * Accepts three or six hex digits, with or without the hash, in either case.
 * Anything else — a colour name, an `rgb()`, half a code still being typed —
 * is null, which callers show as "not yet" rather than writing to the wire.
 */
export function normalizeHexColor(text: string): string | null {
  if (typeof text !== 'string') return null;

  const body = text.trim().replace(/^#/, '').toLowerCase();

  if (SHORT.test(body)) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
  }
  if (LONG.test(body)) return `#${body}`;

  return null;
}
