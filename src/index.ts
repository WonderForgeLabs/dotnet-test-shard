import * as core from '@actions/core';
import { ActionInputs, ActionOutputs } from './types';
import { discoverTests } from './discover';
import { getTestsForShard, buildFilterExpression, combineFilters } from './filter';
import { runTests } from './runner';

/**
 * Get action inputs from the workflow
 */
function getInputs(): ActionInputs {
  return {
    shard: parseInt(core.getInput('shard', { required: true }), 10),
    totalShards: parseInt(core.getInput('total-shards', { required: true }), 10),
    testProject: core.getInput('test-project', { required: true }),
    filter: core.getInput('filter'),
    configuration: core.getInput('configuration') || 'Release',
    noBuild: core.getInput('no-build') === 'true',
    resultsDirectory: core.getInput('results-directory') || 'TestResults',
    additionalArgs: core.getInput('additional-args'),
    verbosity: core.getInput('verbosity') || 'normal',
  };
}

/**
 * Set action outputs
 */
function setOutputs(outputs: ActionOutputs): void {
  core.setOutput('tests-run', outputs.testsRun);
  core.setOutput('tests-passed', outputs.testsPassed);
  core.setOutput('tests-failed', outputs.testsFailed);
  core.setOutput('tests-skipped', outputs.testsSkipped);
  core.setOutput('result-file', outputs.resultFile);
}

/**
 * Validate action inputs
 */
function validateInputs(inputs: ActionInputs): void {
  if (isNaN(inputs.shard) || inputs.shard < 1) {
    throw new Error(`Invalid shard number: ${inputs.shard} (must be >= 1)`);
  }

  if (isNaN(inputs.totalShards) || inputs.totalShards < 1) {
    throw new Error(`Invalid total shards: ${inputs.totalShards} (must be >= 1)`);
  }

  if (inputs.shard > inputs.totalShards) {
    throw new Error(`Shard ${inputs.shard} exceeds total shards ${inputs.totalShards}`);
  }
}

/**
 * Write job summary
 */
function writeSummary(
  shard: number,
  totalShards: number,
  testsRun: number,
  testsPassed: number,
  testsFailed: number,
  testsSkipped: number
): void {
  core.summary
    .addHeading(`Shard ${shard}/${totalShards} Results`, 3)
    .addTable([
      [
        { data: 'Metric', header: true },
        { data: 'Count', header: true },
      ],
      ['✅ Passed', testsPassed.toString()],
      ['❌ Failed', testsFailed.toString()],
      ['⏭️ Skipped', testsSkipped.toString()],
      ['📋 Total', testsRun.toString()],
    ])
    .write();
}

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    validateInputs(inputs);

    // When total-shards is 1, skip discovery and filter — run all tests directly.
    // Building a --filter with every test FQN can exceed the OS ARG_MAX limit (E2BIG).
    let combinedFilter = inputs.filter || '';

    if (inputs.totalShards > 1) {
      core.startGroup(`Discovering tests for shard ${inputs.shard} of ${inputs.totalShards}`);

      // Discover all tests
      const discovery = await discoverTests(
        inputs.testProject,
        inputs.configuration,
        inputs.noBuild,
        inputs.filter
      );

      core.info(`Total tests discovered: ${discovery.totalCount}`);

      if (discovery.totalCount === 0) {
        core.warning('No tests discovered');
        setOutputs({
          testsRun: 0,
          testsPassed: 0,
          testsFailed: 0,
          testsSkipped: 0,
          resultFile: '',
        });
        writeSummary(inputs.shard, inputs.totalShards, 0, 0, 0, 0);
        core.endGroup();
        return;
      }

      // Get tests for this shard
      const shardTests = getTestsForShard(discovery.tests, inputs.shard, inputs.totalShards);
      core.info(`Tests in shard ${inputs.shard}: ${shardTests.length}`);

      if (shardTests.length === 0) {
        core.info('No tests assigned to this shard');
        setOutputs({
          testsRun: 0,
          testsPassed: 0,
          testsFailed: 0,
          testsSkipped: 0,
          resultFile: '',
        });
        writeSummary(inputs.shard, inputs.totalShards, 0, 0, 0, 0);
        core.endGroup();
        return;
      }

      core.endGroup();

      // Build filter expression
      const shardFilter = buildFilterExpression(shardTests);
      combinedFilter = combineFilters(inputs.filter, shardFilter);
    } else {
      core.info('Single shard — running all tests without filter (avoids ARG_MAX limit)');
    }

    core.startGroup(`Running tests for shard ${inputs.shard} of ${inputs.totalShards}`);

    // Run tests
    const result = await runTests(
      inputs.testProject,
      inputs.configuration,
      inputs.noBuild,
      combinedFilter,
      inputs.resultsDirectory,
      inputs.verbosity,
      inputs.additionalArgs
    );

    core.endGroup();

    // Set outputs
    setOutputs({
      testsRun: result.testsRun,
      testsPassed: result.testsPassed,
      testsFailed: result.testsFailed,
      testsSkipped: result.testsSkipped,
      resultFile: result.resultFile,
    });

    // Write summary
    writeSummary(
      inputs.shard,
      inputs.totalShards,
      result.testsRun,
      result.testsPassed,
      result.testsFailed,
      result.testsSkipped
    );

    // Determine pass/fail using TRX results as source of truth when available.
    // The dotnet test exit code can be non-zero even when all tests pass (e.g.,
    // Aspire test fixtures that force-exit during teardown cause xUnit to report
    // a "test process crash" to the orchestrator, which returns exit code 1).
    if (result.testsFailed > 0) {
      core.setFailed(
        `${result.testsFailed} test(s) failed (exit code ${result.exitCode})`
      );
    } else if (result.exitCode !== 0 && result.testsRun === 0) {
      core.setFailed(
        `Test runner exited with code ${result.exitCode} and no tests were run`
      );
    } else if (result.exitCode !== 0) {
      core.warning(
        `Test runner exited with code ${result.exitCode} but all ${result.testsRun} tests passed (TRX results used as source of truth)`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
