import { parseTestOutput, discoverTests } from '../src/discover';
import * as exec from '@actions/exec';

// Get the mocked exec function
const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>;

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds correct args for basic discovery', async () => {
    mockExec.mockImplementation(async (cmd, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from(`
The following Tests are available:
    Namespace.Test1
    Namespace.Test2
`)
        );
      }
      return 0;
    });

    const result = await discoverTests('MyProject.csproj', 'Release', false, '');

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      ['test', 'MyProject.csproj', '--configuration', 'Release', '--list-tests'],
      expect.any(Object)
    );
    expect(result.tests).toEqual(['Namespace.Test1', 'Namespace.Test2']);
    expect(result.totalCount).toBe(2);
  });

  it('includes --no-build flag when noBuild is true', async () => {
    mockExec.mockImplementation(async (cmd, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(''));
      }
      return 0;
    });

    await discoverTests('MyProject.csproj', 'Debug', true, '');

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      ['test', 'MyProject.csproj', '--configuration', 'Debug', '--list-tests', '--no-build'],
      expect.any(Object)
    );
  });

  it('includes --filter parameter when filter is provided', async () => {
    mockExec.mockImplementation(async (cmd, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(''));
      }
      return 0;
    });

    await discoverTests('MyProject.csproj', 'Release', false, 'Category=Unit');

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      [
        'test',
        'MyProject.csproj',
        '--configuration',
        'Release',
        '--list-tests',
        '--filter',
        'Category=Unit',
      ],
      expect.any(Object)
    );
  });

  it('combines --no-build and --filter when both are provided', async () => {
    mockExec.mockImplementation(async (cmd, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(''));
      }
      return 0;
    });

    await discoverTests('MyProject.csproj', 'Release', true, 'Category=Integration');

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      [
        'test',
        'MyProject.csproj',
        '--configuration',
        'Release',
        '--list-tests',
        '--no-build',
        '--filter',
        'Category=Integration',
      ],
      expect.any(Object)
    );
  });

  it('returns tests even when exit code is non-zero', async () => {
    mockExec.mockImplementation(async (cmd, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from(`
The following Tests are available:
    Test.PartialResult
`)
        );
      }
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('Some warning message'));
      }
      return 1; // Non-zero exit code
    });

    const result = await discoverTests('MyProject.csproj', 'Release', false, '');

    expect(result.tests).toEqual(['Test.PartialResult']);
    expect(result.totalCount).toBe(1);
  });

  it('handles stderr output', async () => {
    mockExec.mockImplementation(async (cmd, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from(`
    ValidTest
`)
        );
      }
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('Warning: something happened'));
      }
      return 0;
    });

    const result = await discoverTests('MyProject.csproj', 'Release', false, '');

    expect(result.tests).toEqual(['ValidTest']);
    expect(result.totalCount).toBe(1);
  });

  it('returns empty array when no tests found', async () => {
    mockExec.mockImplementation(async (cmd, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('No tests found'));
      }
      return 0;
    });

    const result = await discoverTests('MyProject.csproj', 'Release', false, '');

    expect(result.tests).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('uses ignoreReturnCode option', async () => {
    mockExec.mockImplementation(async () => 0);

    await discoverTests('MyProject.csproj', 'Release', false, '');

    expect(mockExec).toHaveBeenCalledWith(
      'dotnet',
      expect.any(Array),
      expect.objectContaining({
        ignoreReturnCode: true,
      })
    );
  });
});
