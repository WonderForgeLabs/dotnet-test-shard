import { parseTestOutput } from '../src/discover';

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
