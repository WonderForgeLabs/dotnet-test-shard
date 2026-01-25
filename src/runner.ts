import * as core from '@actions/core';
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

  // Warn about unclosed quotes
  if (inQuote !== null) {
    core.warning(
      `Unclosed ${inQuote === '"' ? 'double' : 'single'} quote in additional-args: "${argsString}". Arguments may not be parsed correctly.`
    );
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
    core.warning(
      `TRX file not found: ${trxPath}. Expected test results file does not exist.`
    );
    return { total: 0, passed: 0, failed: 0, executed: 0, notExecuted: 0 };
  }

  let content: string;
  try {
    content = fs.readFileSync(trxPath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.error(`Failed to read TRX file ${trxPath}: ${message}`);
    throw new Error(
      `Cannot parse test results from ${trxPath}: ${message}. Check file permissions and ensure the file is not corrupted.`
    );
  }

  // Validate we actually got TRX content
  if (!content.includes('<TestRun') && !content.includes('<Counters')) {
    core.warning(
      `File ${trxPath} does not appear to be a valid TRX file (missing expected XML elements). Results may be inaccurate.`
    );
  }

  const totalMatch = content.match(/total="(\d+)"/);
  const passedMatch = content.match(/passed="(\d+)"/);
  const failedMatch = content.match(/failed="(\d+)"/);
  const executedMatch = content.match(/executed="(\d+)"/);
  const notExecutedMatch = content.match(/notExecuted="(\d+)"/);

  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  const executed = executedMatch ? parseInt(executedMatch[1], 10) : 0;

  // Log if we couldn't find expected attributes
  if (!totalMatch || !executedMatch) {
    core.warning(
      `TRX file ${trxPath} is missing expected 'total' or 'executed' attributes. Results may be incomplete.`
    );
  }

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
  verbosity: string,
  additionalArgs: string
): Promise<TestRunResult> {
  // Ensure results directory exists
  if (!fs.existsSync(resultsDirectory)) {
    try {
      fs.mkdirSync(resultsDirectory, { recursive: true });
      core.info(`Created results directory: ${resultsDirectory}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.error(
        `Failed to create results directory ${resultsDirectory}: ${message}`
      );
      throw new Error(
        `Cannot create results directory ${resultsDirectory}: ${message}. Check directory permissions and available disk space.`
      );
    }
  }

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
  // For solutions with multiple assemblies, this ensures we count ALL test results
  const allResults = {
    total: 0,
    passed: 0,
    failed: 0,
    executed: 0,
    notExecuted: 0,
  };

  if (fs.existsSync(resultsDirectory)) {
    try {
      // Verify it's actually a directory
      const stats = fs.statSync(resultsDirectory);
      if (!stats.isDirectory()) {
        throw new Error(
          `Results path ${resultsDirectory} exists but is not a directory. Please specify a valid directory path.`
        );
      }

      const trxFiles = fs
        .readdirSync(resultsDirectory)
        .filter((f) => f.endsWith('.trx'));

      if (trxFiles.length === 0) {
        core.warning(
          `No TRX files found in ${resultsDirectory}. Tests may not have run or results may not have been generated.`
        );
      } else {
        core.info(`Found ${trxFiles.length} TRX file(s) to aggregate`);
      }

      for (const file of trxFiles) {
        const filePath = path.join(resultsDirectory, file);
        try {
          const fileResults = parseTrxResults(filePath);
          allResults.total += fileResults.total;
          allResults.passed += fileResults.passed;
          allResults.failed += fileResults.failed;
          allResults.executed += fileResults.executed;
          allResults.notExecuted += fileResults.notExecuted;
          core.info(
            `Aggregated ${fileResults.total} tests from ${file} (${fileResults.passed} passed, ${fileResults.failed} failed)`
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          core.error(
            `Failed to parse TRX file ${filePath}: ${message}. This file will be skipped, results may be incomplete.`
          );
          // Continue processing other files instead of failing completely
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.error(
        `Failed to read results directory ${resultsDirectory}: ${message}`
      );
      throw new Error(
        `Cannot aggregate test results: Unable to read directory ${resultsDirectory}. Check directory permissions and ensure tests ran successfully.`
      );
    }
  }

  // Validate aggregated results for consistency
  if (exitCode !== 0 && allResults.failed === 0) {
    core.warning(
      `Test runner exited with code ${exitCode} but no failed tests were found in TRX results. Results may be incomplete or test runner failed before generating results.`
    );
  }

  if (allResults.executed === 0 && exitCode === 0) {
    core.warning(
      'Test runner succeeded but no tests were executed. Check filter expressions and ensure tests are discovered correctly.'
    );
  }

  if (allResults.failed > allResults.executed) {
    core.error(
      `Invalid TRX data: ${allResults.failed} tests failed but only ${allResults.executed} tests executed. TRX files may be corrupted.`
    );
  }

  // Log final aggregated totals for transparency
  core.info(
    `Final results: ${allResults.executed} executed, ${allResults.passed} passed, ${allResults.failed} failed, ${allResults.notExecuted} skipped`
  );

  return {
    exitCode,
    testsRun: allResults.executed,
    testsPassed: allResults.passed,
    testsFailed: allResults.failed,
    testsSkipped: allResults.notExecuted,
    resultFile: resultsDirectory, // Return directory path since multiple files exist
  };
}
