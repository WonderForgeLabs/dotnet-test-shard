/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  clearMocks: true,
  // Mock @actions packages for unit testing
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/__tests__/mocks/core.ts',
    '^@actions/exec$': '<rootDir>/__tests__/mocks/exec.ts',
  },
};
