import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
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
export function parseArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (inQuote) {
      if (char === inQuote) {
        // End of quoted section
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      // Start of quoted section
      inQuote = char;
    } else if (char === ' ' || char === '\t') {
      // Whitespace outside quotes - end of argument
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  // Don't forget the last argument
  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Parse test results from a TRX file
 *
 * TRX files contain XML with test counters in the format:
 * <Counters total="X" executed="Y" passed="Z" failed="W" notExecuted="V" .../>
 *
 * Key attributes:
 * - total: Total number of tests discovered
 * - executed: Number of tests that were run
 * - passed: Number of tests that passed
 * - failed: Number of tests that failed
 * - notExecuted: Number of tests that were skipped/not run
 *
 * Note: notExecuted = total - executed (tests filtered or skipped)
 *
 * @param trxPath - Path to the TRX result file
 * @returns Parsed test counts including notExecuted for skipped tests
 */
export function parseTrxResults(trxPath: string): {
  total: number;
  passed: number;
  failed: number;
  executed: number;
  notExecuted: number;
} {
  if (!fs.existsSync(trxPath)) {
    return { total: 0, passed: 0, failed: 0, executed: 0, notExecuted: 0 };
  }

  const content = fs.readFileSync(trxPath, 'utf-8');

  const totalMatch = content.match(/total="(\d+)"/);
  const passedMatch = content.match(/passed="(\d+)"/);
  const failedMatch = content.match(/failed="(\d+)"/);
  const executedMatch = content.match(/executed="(\d+)"/);
  const notExecutedMatch = content.match(/notExecuted="(\d+)"/);

  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  const executed = executedMatch ? parseInt(executedMatch[1], 10) : 0;

  return {
    total,
    passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
    failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
    executed,
    notExecuted: notExecutedMatch
      ? parseInt(notExecutedMatch[1], 10)
      : total - executed,
  };
}

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
export async function runTests(
  testProject: string,
  configuration: string,
  noBuild: boolean,
  filter: string,
  resultsDirectory: string,
  resultFileName: string,
  verbosity: string,
  additionalArgs: string
): Promise<TestRunResult> {
  // Ensure results directory exists
  if (!fs.existsSync(resultsDirectory)) {
    fs.mkdirSync(resultsDirectory, { recursive: true });
  }

  const resultFile = path.join(resultsDirectory, resultFileName);

  // Use --logger trx without LogFileName to let dotnet generate unique filenames per assembly
  // This prevents TRX file overwrites when testing solutions with multiple assemblies
  // Downstream steps use TestResults/**/*.trx glob to find all result files
  const args = [
    'test',
    testProject,
    '--configuration',
    configuration,
    '--verbosity',
    verbosity,
    '--logger',
    'trx',
    '--results-directory',
    resultsDirectory,
  ];

  if (noBuild) {
    args.push('--no-build');
  }

  if (filter) {
    args.push('--filter', filter);
  }

  if (additionalArgs) {
    // Parse additional args respecting quotes (e.g., '--collect:"XPlat Code Coverage"')
    args.push(...parseArgs(additionalArgs));
  }

  const exitCode = await exec.exec('dotnet', args, {
    ignoreReturnCode: true,
  });

  // Aggregate results from all TRX files in the results directory
  // Since we don't specify LogFileName, dotnet creates unique files per assembly
  const allResults = {
    total: 0,
    passed: 0,
    failed: 0,
    executed: 0,
    notExecuted: 0,
  };

  if (fs.existsSync(resultsDirectory)) {
    const trxFiles = fs
      .readdirSync(resultsDirectory)
      .filter((f) => f.endsWith('.trx'));

    for (const file of trxFiles) {
      const filePath = path.join(resultsDirectory, file);
      const fileResults = parseTrxResults(filePath);
      allResults.total += fileResults.total;
      allResults.passed += fileResults.passed;
      allResults.failed += fileResults.failed;
      allResults.executed += fileResults.executed;
      allResults.notExecuted += fileResults.notExecuted;
    }
  }

  return {
    exitCode,
    testsRun: allResults.executed,
    testsPassed: allResults.passed,
    testsFailed: allResults.failed,
    testsSkipped: allResults.notExecuted,
    resultFile: resultsDirectory, // Return directory path since multiple files exist
  };
}
