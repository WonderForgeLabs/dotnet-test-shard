import { parseTrxResults, runTests } from '../src/runner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-runner-'));
    (exec.exec as jest.Mock).mockResolvedValue(0);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('emits warning when additional-args contains double quotes', async () => {
    await runTests(
      'test.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      '--blame-hang-timeout "5 min"'
    );

    expect(core.warning).toHaveBeenCalledWith(
      'The additional-args input contains quotes. Arguments with quoted spaces may be incorrectly parsed. ' +
        'Consider using environment variables as a workaround.'
    );
  });

  it('emits warning when additional-args contains single quotes', async () => {
    await runTests(
      'test.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      "--blame-hang-timeout '5 min'"
    );

    expect(core.warning).toHaveBeenCalledWith(
      'The additional-args input contains quotes. Arguments with quoted spaces may be incorrectly parsed. ' +
        'Consider using environment variables as a workaround.'
    );
  });

  it('does not emit warning when additional-args has no quotes', async () => {
    await runTests(
      'test.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      '--blame-hang-timeout 5m'
    );

    expect(core.warning).not.toHaveBeenCalled();
  });

  it('does not emit warning when additional-args is empty', async () => {
    await runTests(
      'test.csproj',
      'Release',
      false,
      '',
      tempDir,
      'results.trx',
      'normal',
      ''
    );

    expect(core.warning).not.toHaveBeenCalled();
  });
});
