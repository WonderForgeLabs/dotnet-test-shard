import { parseTestOutput, discoverTests } from '../src/discover';
import * as exec from '@actions/exec';
import * as core from '@actions/core';

jest.mock('@actions/exec');
jest.mock('@actions/core');

describe('parseTestOutput', () => {
  it('extracts test names from indented lines', () => {
    const output = `
The following Tests are available:
    Namespace.Class.Test1
    Namespace.Class.Test2
    Other.Namespace.Test3
`;
    const tests = parseTestOutput(output);
    expect(tests).toEqual([
      'Namespace.Class.Test1',
      'Namespace.Class.Test2',
      'Other.Namespace.Test3',
    ]);
  });

  it('strips Theory parameters to deduplicate', () => {
    const output = `
The following Tests are available:
    Namespace.Class.TheoryTest(value: 1)
    Namespace.Class.TheoryTest(value: 2)
    Namespace.Class.TheoryTest(value: 3)
    Namespace.Class.RegularTest
`;
    const tests = parseTestOutput(output);
    expect(tests).toEqual(['Namespace.Class.RegularTest', 'Namespace.Class.TheoryTest']);
  });

  it('handles complex Theory parameters', () => {
    const output = `
    ShardingTests.Tests.DataDriven(input: "hello", expected: 5)
    ShardingTests.Tests.DataDriven(input: "world", expected: 5)
    ShardingTests.Tests.Simple
`;
    const tests = parseTestOutput(output);
    expect(tests).toEqual(['ShardingTests.Tests.DataDriven', 'ShardingTests.Tests.Simple']);
  });

  it('ignores non-test output lines', () => {
    const output = `
Build started...
Build succeeded.
The following Tests are available:
    MyTests.Test1
    MyTests.Test2
Total: 2 tests
`;
    const tests = parseTestOutput(output);
    expect(tests).toEqual(['MyTests.Test1', 'MyTests.Test2']);
  });

  it('returns empty array for no tests', () => {
    const output = 'No tests found.';
    const tests = parseTestOutput(output);
    expect(tests).toEqual([]);
  });

  it('returns sorted unique test names', () => {
    const output = `
    Zebra.Test
    Alpha.Test
    Beta.Test
    Alpha.Test
`;
    const tests = parseTestOutput(output);
    expect(tests).toEqual(['Alpha.Test', 'Beta.Test', 'Zebra.Test']);
  });

  it('handles various indentation levels', () => {
    const output = `
    Test1
      Test2
        Test3
`;
    const tests = parseTestOutput(output);
    // All should be captured as they have 4+ spaces
    expect(tests.length).toBeGreaterThan(0);
  });
});

describe('discoverTests', () => {
  const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>;
  const mockWarning = core.warning as jest.MockedFunction<typeof core.warning>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws error when no tests found and exit code is non-zero', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('Build failed: missing dependency'));
      }
      return 1; // non-zero exit code
    });

    await expect(
      discoverTests('test.csproj', 'Release', false, '')
    ).rejects.toThrow(/Test discovery failed with exit code 1.*Build failed/);
  });

  it('throws error with stdout when stderr is empty', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('Error: Project not found'));
      }
      return 1;
    });

    await expect(
      discoverTests('test.csproj', 'Release', false, '')
    ).rejects.toThrow(/Test discovery failed with exit code 1.*Project not found/);
  });

  it('warns when tests found but exit code is non-zero', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from('The following Tests are available:\n    Test.Method1\n')
        );
      }
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('Warning: deprecated API'));
      }
      return 1;
    });

    const result = await discoverTests('test.csproj', 'Release', false, '');

    expect(result.tests).toEqual(['Test.Method1']);
    expect(result.totalCount).toBe(1);
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringMatching(/non-zero exit code 1.*Found 1 tests.*deprecated API/)
    );
  });

  it('returns tests without warning when exit code is zero', async () => {
    mockExec.mockImplementation(async (_cmd, _args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from('The following Tests are available:\n    Test.Method1\n    Test.Method2\n')
        );
      }
      return 0;
    });

    const result = await discoverTests('test.csproj', 'Release', false, '');

    expect(result.tests).toEqual(['Test.Method1', 'Test.Method2']);
    expect(result.totalCount).toBe(2);
    expect(mockWarning).not.toHaveBeenCalled();
  });

  it('returns empty result without error when no tests and exit code is zero', async () => {
    mockExec.mockImplementation(async () => 0);

    const result = await discoverTests('test.csproj', 'Release', false, '');

    expect(result.tests).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});
