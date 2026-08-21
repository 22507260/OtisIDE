/**
 * Monaco ships typings for its public API only. The deeper ESM entry points are
 * imported to leave the language services out of the bundle, so they need to be
 * declared by hand.
 */
declare module 'monaco-editor/esm/vs/editor/edcore.main' {
  export * from 'monaco-editor/esm/vs/editor/editor.api';
}

declare module 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution';
