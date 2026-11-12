import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// @testing-library/jest-dom/vitest augments the `vitest` module, which only vite-plus can resolve.
declare module 'vite-plus/test' {
    interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}

    interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
