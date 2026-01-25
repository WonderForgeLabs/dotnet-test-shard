import * as exec from '@actions/exec';
import * as core from '@actions/core';
import { DiscoveryResult } from './types';

/**
 * Parse test names from dotnet test --list-tests output
 *
 * Test names appear as indented lines (4+ spaces) starting with a letter.
 * Theory tests appear as TestMethod(param: value) - we strip params to dedupe.
 *
 * @param output - Raw output from dotnet test --list-tests
 * @returns Array of unique test names (sorted)
 */
export function parseTestOutput(output: string): string[] {
  const lines = output.split('\n');
  const testNames = new Set<string>();

  for (const line of lines) {
    // Match lines with 4+ leading spaces followed by a letter (test names)
    const match = line.match(/^\s{4,}([A-Za-z].*)$/);
    if (match) {
      let testName = match[1].trim();
      // Strip Theory parameters: TestMethod(value: 1) -> TestMethod
      testName = testName.replace(/\(.*\)$/, '');
      if (testName) {
        testNames.add(testName);
      }
    }
  }

  return Array.from(testNames).sort();
}

/**
 * Discover all tests in a test project using dotnet test --list-tests
 *
 * @param testProject - Path to the test project or solution
 * @param configuration - Build configuration (Debug, Release)
 * @param noBuild - Skip building the project
 * @param filter - Optional test filter expression
 * @returns Discovery result with test names and count
 */
export async function discoverTests(
  testProject: string,
  configuration: string,
  noBuild: boolean,
  filter: string
): Promise<DiscoveryResult> {
  const args = ['test', testProject, '--configuration', configuration, '--list-tests'];

  if (noBuild) {
    args.push('--no-build');
  }

  if (filter) {
    args.push('--filter', filter);
  }

  let output = '';
  let errorOutput = '';

  const exitCode = await exec.exec('dotnet', args, {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
      stderr: (data: Buffer) => {
        errorOutput += data.toString();
      },
    },
    ignoreReturnCode: true,
  });

  // Parse tests even if exit code is non-zero (may have warnings)
  const tests = parseTestOutput(output);

  // If no tests found and exit code is non-zero, throw an error with stderr output
  if (tests.length === 0 && exitCode !== 0) {
    const errorMessage = errorOutput.trim() || output.trim() || 'Unknown error';
    throw new Error(
      `Test discovery failed with exit code ${exitCode}: ${errorMessage}`
    );
  }

  // Warn if exit code is non-zero but tests were found (may indicate partial failure)
  if (tests.length > 0 && exitCode !== 0) {
    core.warning(
      `Test discovery completed with non-zero exit code ${exitCode}. ` +
        `Found ${tests.length} tests but there may have been errors. ` +
        (errorOutput.trim() ? `stderr: ${errorOutput.trim()}` : '')
    );
  }

  return {
    tests,
    totalCount: tests.length,
  };
}
