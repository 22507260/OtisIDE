import React, { useState } from 'react';
import { normalizeHexColor } from '../lib/colorInput';

type ColorFieldProps = {
  value: string;
  onChange: (color: string) => void;
  /** Tooltip and accessible name; this control never has a visible label. */
  title?: string;
  /** Whether to show the hex box beside the swatch. */
  showHex?: boolean;
};

/**
 * A colour, picked or typed.
 *
 * This replaces a row of seven fixed swatches. Seven was seven more than a
 * breadboard has opinions about, and the row could not grow: it was in the
 * toolbar, where it did not wrap.
 *
 * The swatch is a real `<input type="color">` wearing a round border, so the
 * picker is the platform's own. The hex box beside it is not a nicety — it is
 * the way in for a colour copied from somewhere else, and the way out if the
 * platform's picker ever fails to open.
 */
export function ColorField({ value, onChange, title, showHex = false }: ColorFieldProps) {
  // What has been typed so far, kept apart from the wire's actual colour: a
  // half-typed code is not a colour, and committing each keystroke would send
  // the cable through the spectrum on the way to the one that was meant.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="color-field">
      <label className="color-field-swatch" style={{ background: value }} title={title}>
        <input
          type="color"
          // The native control only accepts `#rrggbb`. A project saved with
          // anything else still draws — Konva is far more forgiving — so fall
          // back rather than letting the picker refuse to open.
          value={normalizeHexColor(value) ?? '#000000'}
          onChange={(event) => {
            setDraft(null);
            onChange(event.target.value);
          }}
          aria-label={title}
        />
      </label>

      {showHex && (
        <input
          className="property-input color-field-hex"
          type="text"
          spellCheck={false}
          value={draft ?? value}
          onChange={(event) => {
            setDraft(event.target.value);
            const color = normalizeHexColor(event.target.value);
            if (color) onChange(color);
          }}
          onBlur={() => setDraft(null)}
          aria-label={title}
        />
      )}
    </div>
  );
}
