import { parseTrxResults, parseArgs } from '../src/runner';
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
    expect(result.notExecuted).toBe(0);
  });

  it('parses notExecuted attribute for skipped tests', () => {
    const trxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <ResultSummary outcome="Completed">
    <Counters total="15" executed="10" passed="8" failed="2" notExecuted="5" />
  </ResultSummary>
</TestRun>`;
    const trxPath = path.join(tempDir, 'skipped.trx');
    fs.writeFileSync(trxPath, trxContent);

    const result = parseTrxResults(trxPath);

    expect(result.total).toBe(15);
    expect(result.executed).toBe(10);
    expect(result.passed).toBe(8);
    expect(result.failed).toBe(2);
    expect(result.notExecuted).toBe(5);
  });

  it('calculates notExecuted from total - executed when attribute is missing', () => {
    const trxContent = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <ResultSummary outcome="Completed">
    <Counters total="20" executed="15" passed="14" failed="1" />
  </ResultSummary>
</TestRun>`;
    const trxPath = path.join(tempDir, 'no-notexecuted.trx');
    fs.writeFileSync(trxPath, trxContent);

    const result = parseTrxResults(trxPath);

    expect(result.total).toBe(20);
    expect(result.executed).toBe(15);
    expect(result.passed).toBe(14);
    expect(result.failed).toBe(1);
    expect(result.notExecuted).toBe(5); // 20 - 15 = 5
  });

  it('returns zeros for non-existent file', () => {
    const result = parseTrxResults('/nonexistent/path.trx');

    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.executed).toBe(0);
    expect(result.notExecuted).toBe(0);
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
    expect(result.notExecuted).toBe(0);
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
    expect(result.notExecuted).toBe(5); // 5 - 0 = 5 (fallback calculation)
  });
});

describe('parseArgs', () => {
  it('parses simple arguments without quotes', () => {
    const result = parseArgs('--foo --bar baz');
    expect(result).toEqual(['--foo', '--bar', 'baz']);
  });

  it('parses arguments with double quotes', () => {
    const result = parseArgs('--foo "hello world" --bar');
    expect(result).toEqual(['--foo', 'hello world', '--bar']);
  });

  it('parses arguments with single quotes', () => {
    const result = parseArgs("--foo 'hello world' --bar");
    expect(result).toEqual(['--foo', 'hello world', '--bar']);
  });

  it('parses XPlat Code Coverage format', () => {
    const result = parseArgs('--collect:"XPlat Code Coverage"');
    expect(result).toEqual(['--collect:XPlat Code Coverage']);
  });

  it('handles multiple quoted arguments', () => {
    const result = parseArgs('--foo "first value" --bar "second value"');
    expect(result).toEqual(['--foo', 'first value', '--bar', 'second value']);
  });

  it('handles empty string', () => {
    const result = parseArgs('');
    expect(result).toEqual([]);
  });

  it('handles whitespace-only string', () => {
    const result = parseArgs('   ');
    expect(result).toEqual([]);
  });

  it('handles mixed tabs and spaces', () => {
    const result = parseArgs('--foo\t\t--bar   --baz');
    expect(result).toEqual(['--foo', '--bar', '--baz']);
  });

  it('preserves colons in arguments', () => {
    const result = parseArgs('--logger:trx --collect:coverage');
    expect(result).toEqual(['--logger:trx', '--collect:coverage']);
  });
});
