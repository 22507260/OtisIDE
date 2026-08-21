/**
 * The simulation runtime schedules itself through `window.setTimeout` because it
 * runs in the renderer. Tests exercise it in Node, where the timers exist on the
 * global object instead.
 */
const globalWithWindow = globalThis as { window?: unknown };

if (!globalWithWindow.window) {
  globalWithWindow.window = globalThis;
}
