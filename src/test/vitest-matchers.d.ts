import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
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
  toHaveFormValues(values: Record<string, any>): R;
  toHaveStyle(styles: Record<string, any> | string): R;
  toHaveTextContent(text: string | RegExp): R;
  toHaveValue(value: any): R;
  toBeChecked(): R;
}
