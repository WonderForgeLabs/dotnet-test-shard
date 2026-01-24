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
export declare function parseTestOutput(output: string): string[];
/**
 * Discover all tests in a test project using dotnet test --list-tests
 *
 * @param testProject - Path to the test project or solution
 * @param configuration - Build configuration (Debug, Release)
 * @param noBuild - Skip building the project
 * @param filter - Optional test filter expression
 * @returns Discovery result with test names and count
 */
export declare function discoverTests(testProject: string, configuration: string, noBuild: boolean, filter: string): Promise<DiscoveryResult>;
