import { parseTrxResults, runTests } from '../src/runner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as exec from '@actions/exec';

jest.mock('@actions/exec');

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

  it('throws error for non-existent file', () => {
    expect(() => parseTrxResults('/nonexistent/path.trx')).toThrow(
      /TRX result file not found.*\/nonexistent\/path\.trx/
    );
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

  it('includes helpful message in error for missing TRX file', () => {
    expect(() => parseTrxResults('/some/path/results.trx')).toThrow(
      /This may indicate that the test run failed before producing results/
    );
  });
});

describe('runTests', () => {
  const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>;
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-runner-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws error when TRX file is not created', async () => {
    mockExec.mockResolvedValue(0);

    await expect(
      runTests(
        'test.csproj',
        'Release',
        false,
        '',
        tempDir,
        'results.trx',
        'normal',
        ''
      )
    ).rejects.toThrow(/TRX result file not found/);
  });

  it('successfully parses results when TRX file exists', async () => {
    const trxContent = `<?xml version="1.0"?>
<TestRun>
  <ResultSummary>
    <Counters total="5" executed="5" passed="4" failed="1" />
  </ResultSummary>
</TestRun>`;

    mockExec.mockImplementation(async () => {
      // Simulate dotnet test creating the TRX file
      fs.writeFileSync(path.join(tempDir, 'results.trx'), trxContent);
      return 1; // tests failed
    });

    const result = await runTests(
      'test.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      ''
    );

    expect(result.exitCode).toBe(1);
    expect(result.testsRun).toBe(5);
    expect(result.testsPassed).toBe(4);
    expect(result.testsFailed).toBe(1);
  });

  it('creates results directory if it does not exist', async () => {
    const nestedDir = path.join(tempDir, 'nested', 'results');
    const trxContent = `<Counters total="1" executed="1" passed="1" failed="0" />`;

    mockExec.mockImplementation(async () => {
      fs.writeFileSync(path.join(nestedDir, 'results.trx'), trxContent);
      return 0;
    });

    const result = await runTests(
      'test.csproj',
      'Release',
      false,
      '',
      nestedDir,
      'results.trx',
      'normal',
      ''
    );

    expect(fs.existsSync(nestedDir)).toBe(true);
    expect(result.testsRun).toBe(1);
  });
});
