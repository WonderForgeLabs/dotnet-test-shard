import { TestRunResult } from './types';
/**
 * Parse a string of arguments respecting quoted strings
 *
 * Handles both single and double quotes, allowing spaces within quoted sections.
 * Examples:
 *   '--collect:"XPlat Code Coverage"' -> ['--collect:XPlat Code Coverage']
 *   '--foo bar --baz "hello world"' -> ['--foo', 'bar', '--baz', 'hello world']
 *
 * @param argsString - The string of arguments to parse
 * @returns Array of parsed arguments
 */
export declare function parseArgs(argsString: string): string[];
/**
 * Parse test results from a TRX file
 *
 * TRX files contain XML with test counters in the format:
 * <Counters total="X" passed="Y" failed="Z" .../>
 *
 * @param trxPath - Path to the TRX result file
 * @returns Parsed test counts
 */
export declare function parseTrxResults(trxPath: string): {
    total: number;
    passed: number;
    failed: number;
    executed: number;
};
/**
 * Run dotnet test with the specified parameters
 *
 * @param testProject - Path to the test project or solution
 * @param configuration - Build configuration
 * @param noBuild - Skip building
 * @param filter - Test filter expression
 * @param resultsDirectory - Directory for test results
 * @param resultFileName - Name of the TRX result file
 * @param verbosity - Output verbosity level
 * @param additionalArgs - Additional arguments to pass to dotnet test
 * @returns Test run result with counts and exit code
 */
export declare function runTests(testProject: string, configuration: string, noBuild: boolean, filter: string, resultsDirectory: string, resultFileName: string, verbosity: string, additionalArgs: string): Promise<TestRunResult>;
