import "@testing-library/jest-dom/vitest";

// jsdom ships no ResizeObserver; Radix primitives (ScrollArea, Tooltip) need one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
