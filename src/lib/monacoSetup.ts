// The editor core with every editor feature, but none of the languages: the
// full monaco-editor entry point also pulls in the TypeScript, CSS, HTML and
// JSON language services and their web workers, which is nine megabytes of
// installer for a program that only ever edits Arduino C++.
import * as monaco from 'monaco-editor/esm/vs/editor/edcore.main';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline';
import { loader } from '@monaco-editor/react';

/**
 * @monaco-editor/react downloads Monaco from a CDN by default, which leaves the
 * code editor stuck on "Loading editor..." in the packaged desktop app whenever
 * the machine is offline. Bundling Monaco locally and handing it to the loader
 * keeps the editor working without a network connection.
 */
declare const self: Window & {
  MonacoEnvironment?: {
    getWorker: (workerId: string, label: string) => Worker;
  };
};

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });

export default monaco;
