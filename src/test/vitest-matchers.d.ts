import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {
    readonly __customMatchersBrand?: never;
  }
  interface AsymmetricMatchersContaining extends CustomMatchers {
    readonly __customMatchersBrand?: never;
  }
}

interface CustomMatchers<R = void> {
  toBeInTheDocument(): R;
  toBeVisible(): R;
  toBeEnabled(): R;
  toBeDisabled(): R;
  toBeEmptyDOMElement(): R;
  toBeInvalid(): R;
  toBeValid(): R;
  toBeRequired(): R;
  toBePartiallyChecked(): R;
  toHaveAttribute(attr: string, value?: string): R;
  toHaveClass(classname: string): R;
  toHaveFormValues(values: Record<string, unknown>): R;
  toHaveStyle(styles: Record<string, unknown> | string): R;
  toHaveTextContent(text: string | RegExp): R;
  toHaveValue(value: unknown): R;
  toBeChecked(): R;
}
