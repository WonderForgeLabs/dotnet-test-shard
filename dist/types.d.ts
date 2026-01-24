/**
 * Input parameters for the action
 */
export interface ActionInputs {
    shard: number;
    totalShards: number;
    testProject: string;
    filter: string;
    configuration: string;
    noBuild: boolean;
    resultsDirectory: string;
    additionalArgs: string;
    verbosity: string;
}
/**
 * Output values from the action
 */
export interface ActionOutputs {
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
    testsSkipped: number;
    resultFile: string;
}
/**
 * Result of test discovery
 */
export interface DiscoveryResult {
    tests: string[];
    totalCount: number;
}
/**
 * Result of running tests
 */
export interface TestRunResult {
    exitCode: number;
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
    testsSkipped: number;
    resultFile: string;
}
