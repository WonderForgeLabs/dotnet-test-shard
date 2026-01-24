# dotnet-test-shard

A reusable GitHub Action for automatic .NET test sharding without requiring manual test annotations.

## Why This Action Exists

The .NET test ecosystem currently lacks built-in support for automatic test sharding similar to what Playwright offers with `--shard 1/4`. While there's an [open feature request (microsoft/testfx#4068)](https://github.com/microsoft/testfx/issues/4068) for native sharding support in MSTest, this action provides a workaround that works today with any .NET test framework (xUnit, NUnit, MSTest).

### The Problem

Running large test suites in CI can be slow. Parallelization within a single runner only goes so far. True sharding across multiple runners requires either:
- Manually annotating tests with shard IDs (error-prone, maintenance burden)
- Building custom tooling to distribute tests

### The Solution

This action uses **deterministic modulo-based distribution** to automatically assign tests to shards:

1. Discovers all tests using `dotnet test --list-tests`
2. Sorts tests alphabetically for consistency
3. Assigns each test to a shard using `test_index % total_shards`
4. Runs only the tests assigned to the current shard

No manual annotations. No custom test attributes. Just add the action to your workflow.

## Usage

### Basic Example

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4

      - name: Run tests (shard ${{ matrix.shard }}/4)
        uses: ElanHasson/dotnet-test-shard@v1
        with:
          shard: ${{ matrix.shard }}
          total-shards: 4
          test-project: ./tests/MyTests.csproj
```

### Build Once, Test in Shards (Recommended)

For optimal CI performance, build once and run tests in parallel shards:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4

      - name: Build
        run: dotnet build --configuration Release

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: |
            **/bin/Release
            **/obj/Release
          retention-days: 1

  test:
    needs: build
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build

      - name: Run tests (shard ${{ matrix.shard }}/4)
        uses: ElanHasson/dotnet-test-shard@v1
        with:
          shard: ${{ matrix.shard }}
          total-shards: 4
          test-project: ./tests/MyTests.csproj
          no-build: 'true'

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-shard-${{ matrix.shard }}
          path: TestResults/
          retention-days: 7

  report:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Download all test results
        uses: actions/download-artifact@v4
        with:
          pattern: test-results-shard-*
          merge-multiple: true
          path: TestResults

      - name: Publish Test Report
        uses: dorny/test-reporter@v1
        with:
          name: Test Results
          path: TestResults/*.trx
          reporter: dotnet-trx
```

### With Test Filters

You can combine sharding with standard `dotnet test` filter expressions:

```yaml
- name: Run unit tests only
  uses: ElanHasson/dotnet-test-shard@v1
  with:
    shard: ${{ matrix.shard }}
    total-shards: 4
    test-project: ./tests/MyTests.csproj
    filter: 'Category!=Integration'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `shard` | Current shard number (1-based) | Yes | - |
| `total-shards` | Total number of shards | Yes | - |
| `test-project` | Path to the test project or solution | Yes | - |
| `filter` | Test filter expression | No | - |
| `configuration` | Build configuration | No | `Release` |
| `no-build` | Skip building (for pre-built tests) | No | `false` |
| `results-directory` | Directory for test results | No | `TestResults` |
| `additional-args` | Additional dotnet test arguments | No | - |
| `verbosity` | Output verbosity level | No | `normal` |

## Outputs

| Output | Description |
|--------|-------------|
| `tests-run` | Number of tests run in this shard |
| `tests-passed` | Number of tests passed |
| `tests-failed` | Number of tests failed |
| `tests-skipped` | Number of tests skipped |
| `result-file` | Path to the TRX result file |

## How It Works

### Test Discovery

The action runs `dotnet test --list-tests` to discover all test methods. The output format varies slightly by test framework but typically looks like:

```
The following Tests are available:
    MyNamespace.MyClass.Test1
    MyNamespace.MyClass.Test2
    MyNamespace.OtherClass.Test3
```

### Deterministic Distribution

Tests are sorted alphabetically and assigned to shards using modulo arithmetic:

```
Test 0 → Shard (0 % 4) + 1 = Shard 1
Test 1 → Shard (1 % 4) + 1 = Shard 2
Test 2 → Shard (2 % 4) + 1 = Shard 3
Test 3 → Shard (3 % 4) + 1 = Shard 4
Test 4 → Shard (4 % 4) + 1 = Shard 1
...
```

This ensures:
- **Determinism**: Same tests go to same shards across runs
- **Even distribution**: Tests are spread as evenly as possible
- **No coordination**: Each shard independently calculates its tests

### Filter Generation

The action generates a `--filter` expression to run only the assigned tests:

```
FullyQualifiedName=MyNamespace.MyClass.Test1 | FullyQualifiedName=MyNamespace.OtherClass.Test5 | ...
```

## Comparison with Playwright Sharding

This action is inspired by [Playwright's test sharding](https://playwright.dev/docs/test-sharding):

| Feature | Playwright | dotnet-test-shard |
|---------|------------|-------------------|
| Syntax | `--shard 1/4` | `shard: 1`, `total-shards: 4` |
| Distribution | Internal algorithm | Modulo on sorted test names |
| Results | Blob reports | TRX files |
| Aggregation | `merge-reports` | Upload artifacts + test reporter |

## Limitations

- **Discovery overhead**: `dotnet test --list-tests` adds ~5-10 seconds per shard
- **Filter length**: Very large test suites may hit command-line length limits
- **Test ordering**: Tests with identical names in different assemblies may cluster

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT

## Related Links

- [microsoft/testfx#4068](https://github.com/microsoft/testfx/issues/4068) - Native sharding feature request
- [Playwright Test Sharding](https://playwright.dev/docs/test-sharding) - Inspiration for this approach
- [Optimizing .NET Test Runs with Sharding](https://gor-grigoryan.medium.com/optimizing-net-test-runs-in-github-actions-with-test-sharding-for-faster-ci-cd-315e610cf560) - Related article
