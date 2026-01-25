import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import { TestRunResult } from './types';

/**
 * Parse test results from a TRX file
 *
 * TRX files contain XML with test counters in the format:
 * <Counters total="X" passed="Y" failed="Z" .../>
 *
 * @param trxPath - Path to the TRX result file
 * @returns Parsed test counts
 */
export function parseTrxResults(trxPath: string): {
  total: number;
  passed: number;
  failed: number;
  executed: number;
} {
  if (!fs.existsSync(trxPath)) {
    return { total: 0, passed: 0, failed: 0, executed: 0 };
  }

  const content = fs.readFileSync(trxPath, 'utf-8');

  const totalMatch = content.match(/total="(\d+)"/);
  const passedMatch = content.match(/passed="(\d+)"/);
  const failedMatch = content.match(/failed="(\d+)"/);
  const executedMatch = content.match(/executed="(\d+)"/);

  return {
    total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
    passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
    failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
    executed: executedMatch ? parseInt(executedMatch[1], 10) : 0,
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

  const args = [
    'test',
    testProject,
    '--configuration',
    configuration,
    '--verbosity',
    verbosity,
    '--logger',
    `trx;LogFileName=${resultFileName}`,
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
    if (additionalArgs.includes('"') || additionalArgs.includes("'")) {
      core.warning(
        'The additional-args input contains quotes. Arguments with quoted spaces may be incorrectly parsed. ' +
          'Consider using environment variables as a workaround.'
      );
    }
    // Split additional args on spaces (respecting quotes would be more complex)
    args.push(...additionalArgs.split(/\s+/).filter((a) => a));
  }

  const exitCode = await exec.exec('dotnet', args, {
    ignoreReturnCode: true,
  });

  // Parse results from TRX file
  const results = parseTrxResults(resultFile);
  const skipped = Math.max(0, results.executed - results.passed - results.failed);

  return {
    exitCode,
    testsRun: results.executed,
    testsPassed: results.passed,
    testsFailed: results.failed,
    testsSkipped: skipped,
    resultFile,
  };
}
