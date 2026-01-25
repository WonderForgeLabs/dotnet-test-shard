import { parseTrxResults, runTests } from '../src/runner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as exec from '@actions/exec';

// Get the mocked exec function
const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>;

describe('parseTrxResults', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses test counts from TRX file', () => {
    const trxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <ResultSummary outcome="Completed">
    <Counters total="10" executed="10" passed="8" failed="1" error="0" timeout="0" aborted="0" inconclusive="0" passedButRunAborted="0" notRunnable="0" notExecuted="0" disconnected="0" warning="0" completed="0" inProgress="0" pending="0" />
  </ResultSummary>
</TestRun>`;
    const trxPath = path.join(tempDir, 'results.trx');
    fs.writeFileSync(trxPath, trxContent);

    const result = parseTrxResults(trxPath);

    expect(result.total).toBe(10);
    expect(result.passed).toBe(8);
    expect(result.failed).toBe(1);
    expect(result.executed).toBe(10);
  });

  it('returns zeros for non-existent file', () => {
    const result = parseTrxResults('/nonexistent/path.trx');

    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.executed).toBe(0);
  });

  it('returns zeros for file without counters', () => {
    const trxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <ResultSummary outcome="Completed">
  </ResultSummary>
</TestRun>`;
    const trxPath = path.join(tempDir, 'empty.trx');
    fs.writeFileSync(trxPath, trxContent);

    const result = parseTrxResults(trxPath);

    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.executed).toBe(0);
  });

  it('handles partial counters', () => {
    const trxContent = `<Counters total="5" passed="3" />`;
    const trxPath = path.join(tempDir, 'partial.trx');
    fs.writeFileSync(trxPath, trxContent);

    const result = parseTrxResults(trxPath);

    expect(result.total).toBe(5);
    expect(result.passed).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.executed).toBe(0);
  });
});

describe('runTests', () => {
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runTests-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates results directory if it does not exist', async () => {
    const resultsDir = path.join(tempDir, 'new-results');
    mockExec.mockResolvedValue(0);

    await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      resultsDir,
      'results.trx',
      'normal',
      ''
    );

    expect(fs.existsSync(resultsDir)).toBe(true);
  });

  it('builds correct arguments for basic test run', async () => {
    mockExec.mockResolvedValue(0);

    await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      ''
    );

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      [
        'test',
        'MyProject.csproj',
        '--configuration',
        'Release',
        '--verbosity',
        'normal',
        '--logger',
        'trx;LogFileName=results.trx',
        '--results-directory',
        tempDir,
      ],
      expect.objectContaining({ ignoreReturnCode: true })
    );
  });

  it('includes --no-build flag when noBuild is true', async () => {
    mockExec.mockResolvedValue(0);

    await runTests(
      'MyProject.csproj',
      'Debug',
      true,
      '',
      tempDir,
      'results.trx',
      'minimal',
      ''
    );

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      expect.arrayContaining(['--no-build']),
      expect.any(Object)
    );
  });

  it('includes --filter parameter when filter is provided', async () => {
    mockExec.mockResolvedValue(0);

    await runTests(
      'MyProject.csproj',
      'Release',
      false,
      'Category=Unit',
      tempDir,
      'results.trx',
      'normal',
      ''
    );

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      expect.arrayContaining(['--filter', 'Category=Unit']),
      expect.any(Object)
    );
  });

  it('splits additionalArgs on spaces and adds them', async () => {
    mockExec.mockResolvedValue(0);

    await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      '--blame --collect:"XPlat Code Coverage"'
    );

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      expect.arrayContaining(['--blame', '--collect:"XPlat', 'Code', 'Coverage"']),
      expect.any(Object)
    );
  });

  it('handles multiple spaces in additionalArgs', async () => {
    mockExec.mockResolvedValue(0);

    await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      '--blame   --parallel'
    );

    // Should filter out empty strings from split
    const callArgs = mockExec.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--blame');
    expect(callArgs).toContain('--parallel');
    expect(callArgs.filter((a) => a === '')).toHaveLength(0);
  });

  it('returns correct result with TRX file parsing', async () => {
    const trxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <ResultSummary outcome="Completed">
    <Counters total="10" executed="10" passed="8" failed="1" />
  </ResultSummary>
</TestRun>`;
    const trxPath = path.join(tempDir, 'test-results.trx');
    fs.writeFileSync(trxPath, trxContent);

    mockExec.mockResolvedValue(0);

    const result = await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'test-results.trx',
      'normal',
      ''
    );

    expect(result.exitCode).toBe(0);
    expect(result.testsRun).toBe(10);
    expect(result.testsPassed).toBe(8);
    expect(result.testsFailed).toBe(1);
    expect(result.testsSkipped).toBe(1); // 10 executed - 8 passed - 1 failed = 1 skipped
    expect(result.resultFile).toBe(trxPath);
  });

  it('returns exit code from exec', async () => {
    mockExec.mockResolvedValue(1);

    const result = await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      ''
    );

    expect(result.exitCode).toBe(1);
  });

  it('handles missing TRX file gracefully', async () => {
    mockExec.mockResolvedValue(0);

    const result = await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'nonexistent.trx',
      'normal',
      ''
    );

    expect(result.testsRun).toBe(0);
    expect(result.testsPassed).toBe(0);
    expect(result.testsFailed).toBe(0);
    expect(result.testsSkipped).toBe(0);
  });

  it('calculates skipped tests correctly when executed exceeds passed+failed', async () => {
    const trxContent = `<Counters total="10" executed="10" passed="5" failed="2" />`;
    const trxPath = path.join(tempDir, 'results.trx');
    fs.writeFileSync(trxPath, trxContent);

    mockExec.mockResolvedValue(0);

    const result = await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      ''
    );

    // skipped = executed - passed - failed = 10 - 5 - 2 = 3
    expect(result.testsSkipped).toBe(3);
  });

  it('does not return negative skipped count', async () => {
    // Edge case where passed + failed > executed (shouldn't happen but handle gracefully)
    const trxContent = `<Counters total="10" executed="5" passed="4" failed="3" />`;
    const trxPath = path.join(tempDir, 'results.trx');
    fs.writeFileSync(trxPath, trxContent);

    mockExec.mockResolvedValue(0);

    const result = await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      ''
    );

    // skipped should be 0, not negative (Math.max(0, 5 - 4 - 3) = 0)
    expect(result.testsSkipped).toBe(0);
  });

  it('combines noBuild and filter parameters', async () => {
    mockExec.mockResolvedValue(0);

    await runTests(
      'MyProject.csproj',
      'Release',
      true,
      'FullyQualifiedName~Test1',
      tempDir,
      'results.trx',
      'normal',
      ''
    );

    const callArgs = mockExec.mock.calls[0][1] as string[];
    expect(callArgs).toContain('--no-build');
    expect(callArgs).toContain('--filter');
    expect(callArgs).toContain('FullyQualifiedName~Test1');
  });

  it('uses different verbosity levels', async () => {
    mockExec.mockResolvedValue(0);

    await runTests(
      'MyProject.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'detailed',
      ''
    );

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      expect.arrayContaining(['--verbosity', 'detailed']),
      expect.any(Object)
    );
  });
});
