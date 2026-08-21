import { describe, expect, it } from 'vitest';
import { htmlToText, toVersionInfo } from '../updateNotes.js';

describe('htmlToText', () => {
  it('turns a GitHub release body into plain text', () => {
    const html =
      '<p>Bu surumle birlikte:</p><ul><li>Birinci madde</li><li>Ikinci madde</li></ul>';

    expect(htmlToText(html)).toBe(
      'Bu surumle birlikte:\n• Birinci madde\n• Ikinci madde'
    );
  });

  it('decodes entities and drops stray markup', () => {
    expect(htmlToText('<p>Ayarlar &amp; notlar &lt;buraya&gt;</p>')).toBe(
      'Ayarlar & notlar <buraya>'
    );
  });

  it('keeps list items on consecutive lines', () => {
    const text = htmlToText('<ul>\n<li>Bir</li>\n<li>Iki</li>\n<li>Uc</li>\n</ul>');
    expect(text.split('\n')).toEqual(['• Bir', '• Iki', '• Uc']);
  });

  it('survives empty input', () => {
    expect(htmlToText(undefined)).toBe('');
    expect(htmlToText('')).toBe('');
  });
});

describe('toVersionInfo', () => {
  it('labels every release when several versions are skipped', () => {
    const info = toVersionInfo({
      version: '1.6.0',
      releaseNotes: [
        { version: '1.6.0', note: '<p>Jumper kablolar</p>' },
        { version: '1.5.2', note: '<p>Polarite duzeltmesi</p>' },
      ],
    });

    expect(info.version).toBe('1.6.0');
    expect(info.releaseNotes).toBe(
      '1.6.0\nJumper kablolar\n\n1.5.2\nPolarite duzeltmesi'
    );
  });

  it('handles a single release given as a string', () => {
    const info = toVersionInfo({ version: '1.6.1', releaseNotes: '<p>Tek surum</p>' });
    expect(info.releaseNotes).toBe('Tek surum');
  });

  it('skips entries with an empty body', () => {
    const info = toVersionInfo({
      version: '2.0.0',
      releaseNotes: [
        { version: '2.0.0', note: '' },
        { version: '1.9.0', note: '<p>Dolu</p>' },
      ],
    });

    expect(info.releaseNotes).toBe('1.9.0\nDolu');
  });

  it('returns null when there is no update info', () => {
    expect(toVersionInfo(null)).toBeNull();
  });
});
