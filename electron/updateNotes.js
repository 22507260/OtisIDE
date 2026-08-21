/**
 * Turns the release notes GitHub returns into the plain text the update prompt
 * renders. Kept apart from updater.js so it can be tested without Electron.
 */

/** GitHub hands release notes over as HTML, but the prompt renders plain text. */
function htmlToText(value) {
  return String(value || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6])\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Keep list items on consecutive lines instead of spreading them out.
    .replace(/\n\n(?=•)/g, '\n')
    .trim();
}

function toVersionInfo(info) {
  if (!info) return null;

  // With fullChangelog the notes arrive as one entry per release, newest first.
  // Each block is labelled so a user skipping several versions can tell them apart.
  const releaseNotes = Array.isArray(info.releaseNotes)
    ? info.releaseNotes
        .map((entry) => {
          if (typeof entry === 'string') return htmlToText(entry);

          const body = htmlToText(entry?.note || '');
          if (!body) return '';
          return entry?.version ? `${entry.version}\n${body}` : body;
        })
        .filter(Boolean)
        .join('\n\n')
    : htmlToText(info.releaseNotes);

  return {
    version: info.version || '',
    releaseName: typeof info.releaseName === 'string' ? info.releaseName : '',
    releaseNotes,
    releaseDate: info.releaseDate || '',
  };
}

module.exports = { htmlToText, toVersionInfo };
