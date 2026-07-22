// Makes Jest's globals (describe/it/expect/jest/beforeEach/…) available to
// TypeScript project-wide, so test files type-check under the app tsconfig
// without a fragile `types` array (audit B14).
/// <reference types="jest" />
