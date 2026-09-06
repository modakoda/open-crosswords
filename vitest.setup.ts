import "@testing-library/jest-dom/vitest";

// jsdom ships no ResizeObserver; Radix primitives (ScrollArea, Tooltip) need one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// Radix Select drives its trigger through Pointer Events APIs that jsdom lacks.
const el = globalThis.Element?.prototype as (Element & Record<string, unknown>) | undefined;
if (el) {
  el.hasPointerCapture ??= () => false;
  el.setPointerCapture ??= () => {};
  el.releasePointerCapture ??= () => {};
  el.scrollIntoView ??= () => {};
}
