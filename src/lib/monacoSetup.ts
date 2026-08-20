import * as monaco from 'monaco-editor';
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
