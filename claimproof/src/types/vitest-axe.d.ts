import 'vitest';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T = any, Actual = unknown> {
    toHaveNoViolations(): T;
    toBeInTheDocument(): T;
    toHaveValue(expected: unknown): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
    toBeInTheDocument(): void;
    toHaveValue(expected: unknown): void;
  }
}
