import { parseTrxResults } from '../src/runner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
