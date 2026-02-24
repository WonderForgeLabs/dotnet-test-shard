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

  it('handles interleaved output from parallel assembly discovery', () => {
    // When dotnet lists tests from multiple assemblies in parallel, stdout chunks
    // from different assemblies can be concatenated on the same line without a
    // newline separator, e.g.:
    //   "    Ns.A.TheoryTest(typeof(V1FluxType), \"FluxType\")    Ns.B.OtherTest"
    // The closing ')' is no longer at end-of-string, so the old /\(.*\)$/ regex
    // would silently fail to strip params, emitting the raw '(' into the filter
    // and causing MSB4177 "Invalid property" errors in dotnet test.
    const output = `
The following Tests are available:
    Platform.Entities.Tests.AllKindsShouldHaveCorrectKind(type: typeof(V1FluxType), expectedKind: "FluxType")    WonderForge.Tests.Platform.ApiTests.SomeOtherTest
    WonderForge.Tests.Platform.NormalTest
`;
    const tests = parseTestOutput(output);
    // The interleaved line must be stripped to just the base method name;
    // the trailing "    WonderForge.Tests..." after the ')' is discarded.
    expect(tests).toContain('Platform.Entities.Tests.AllKindsShouldHaveCorrectKind');
    // No parentheses should survive into the output
    expect(tests.every((t) => !t.includes('('))).toBe(true);
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
