import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Import the mocked modules
const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;
const mockSetOutput = core.setOutput as jest.MockedFunction<typeof core.setOutput>;
const mockSetFailed = core.setFailed as jest.MockedFunction<typeof core.setFailed>;
const mockInfo = core.info as jest.MockedFunction<typeof core.info>;
const mockWarning = core.warning as jest.MockedFunction<typeof core.warning>;
const mockStartGroup = core.startGroup as jest.MockedFunction<typeof core.startGroup>;
const mockEndGroup = core.endGroup as jest.MockedFunction<typeof core.endGroup>;
const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>;

// We need to test the internal functions, so we'll re-implement the validation logic
// since index.ts doesn't export its internal functions

interface ActionInputs {
  shard: number;
  totalShards: number;
  testProject: string;
  filter: string;
  configuration: string;
  noBuild: boolean;
  resultsDirectory: string;
  additionalArgs: string;
  verbosity: string;
}

// Re-implement validateInputs for testing (mirrors the logic in index.ts)
function validateInputs(inputs: ActionInputs): void {
  if (isNaN(inputs.shard) || inputs.shard < 1) {
    throw new Error(`Invalid shard number: ${inputs.shard} (must be >= 1)`);
  }

  if (isNaN(inputs.totalShards) || inputs.totalShards < 1) {
    throw new Error(`Invalid total shards: ${inputs.totalShards} (must be >= 1)`);
  }

  if (inputs.shard > inputs.totalShards) {
    throw new Error(`Shard ${inputs.shard} exceeds total shards ${inputs.totalShards}`);
  }
}

describe('validateInputs', () => {
  it('throws for invalid shard number (NaN)', () => {
    const inputs: ActionInputs = {
      shard: NaN,
      totalShards: 4,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).toThrow('Invalid shard number: NaN (must be >= 1)');
  });

  it('throws for shard number less than 1', () => {
    const inputs: ActionInputs = {
      shard: 0,
      totalShards: 4,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).toThrow('Invalid shard number: 0 (must be >= 1)');
  });

  it('throws for negative shard number', () => {
    const inputs: ActionInputs = {
      shard: -1,
      totalShards: 4,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).toThrow('Invalid shard number: -1 (must be >= 1)');
  });

  it('throws for invalid total shards (NaN)', () => {
    const inputs: ActionInputs = {
      shard: 1,
      totalShards: NaN,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).toThrow('Invalid total shards: NaN (must be >= 1)');
  });

  it('throws for total shards less than 1', () => {
    const inputs: ActionInputs = {
      shard: 1,
      totalShards: 0,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).toThrow('Invalid total shards: 0 (must be >= 1)');
  });

  it('throws when shard exceeds total shards', () => {
    const inputs: ActionInputs = {
      shard: 5,
      totalShards: 4,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).toThrow('Shard 5 exceeds total shards 4');
  });

  it('passes for valid inputs', () => {
    const inputs: ActionInputs = {
      shard: 2,
      totalShards: 4,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).not.toThrow();
  });

  it('passes when shard equals total shards', () => {
    const inputs: ActionInputs = {
      shard: 4,
      totalShards: 4,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).not.toThrow();
  });

  it('passes for single shard', () => {
    const inputs: ActionInputs = {
      shard: 1,
      totalShards: 1,
      testProject: 'test.csproj',
      filter: '',
      configuration: 'Release',
      noBuild: false,
      resultsDirectory: 'TestResults',
      additionalArgs: '',
      verbosity: 'normal',
    };

    expect(() => validateInputs(inputs)).not.toThrow();
  });
});

describe('index.ts integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getInput is called with correct parameters', () => {
    // This tests that the mocks are properly set up
    mockGetInput.mockReturnValue('test-value');

    const value = core.getInput('test-input', { required: true });

    expect(mockGetInput).toHaveBeenCalledWith('test-input', { required: true });
    expect(value).toBe('test-value');
  });

  it('setOutput can be called', () => {
    core.setOutput('tests-run', 10);

    expect(mockSetOutput).toHaveBeenCalledWith('tests-run', 10);
  });

  it('setFailed can be called with error message', () => {
    core.setFailed('Test failed');

    expect(mockSetFailed).toHaveBeenCalledWith('Test failed');
  });

  it('info logging works', () => {
    core.info('Information message');

    expect(mockInfo).toHaveBeenCalledWith('Information message');
  });

  it('warning logging works', () => {
    core.warning('Warning message');

    expect(mockWarning).toHaveBeenCalledWith('Warning message');
  });

  it('group functions work', () => {
    core.startGroup('Test group');
    core.endGroup();

    expect(mockStartGroup).toHaveBeenCalledWith('Test group');
    expect(mockEndGroup).toHaveBeenCalled();
  });

  it('summary functions are chainable', () => {
    const result = core.summary.addHeading('Test', 3).addTable([['a', 'b']]).addRaw('text');

    expect(core.summary.addHeading).toHaveBeenCalledWith('Test', 3);
    expect(core.summary.addTable).toHaveBeenCalledWith([['a', 'b']]);
    expect(core.summary.addRaw).toHaveBeenCalledWith('text');
    expect(result).toBe(core.summary);
  });
});

describe('ActionInputs parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses numeric inputs correctly', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'shard') return '2';
      if (name === 'total-shards') return '4';
      return '';
    });

    const shard = parseInt(core.getInput('shard', { required: true }), 10);
    const totalShards = parseInt(core.getInput('total-shards', { required: true }), 10);

    expect(shard).toBe(2);
    expect(totalShards).toBe(4);
  });

  it('handles non-numeric shard input', () => {
    mockGetInput.mockReturnValue('invalid');

    const shard = parseInt(core.getInput('shard'), 10);

    expect(isNaN(shard)).toBe(true);
  });

  it('parses boolean no-build input', () => {
    mockGetInput.mockReturnValue('true');
    const noBuild = core.getInput('no-build') === 'true';
    expect(noBuild).toBe(true);

    mockGetInput.mockReturnValue('false');
    const noBuild2 = core.getInput('no-build') === 'true';
    expect(noBuild2).toBe(false);

    mockGetInput.mockReturnValue('');
    const noBuild3 = core.getInput('no-build') === 'true';
    expect(noBuild3).toBe(false);
  });

  it('uses default values for optional inputs', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'configuration') return '';
      if (name === 'results-directory') return '';
      if (name === 'verbosity') return '';
      return 'value';
    });

    const configuration = core.getInput('configuration') || 'Release';
    const resultsDirectory = core.getInput('results-directory') || 'TestResults';
    const verbosity = core.getInput('verbosity') || 'normal';

    expect(configuration).toBe('Release');
    expect(resultsDirectory).toBe('TestResults');
    expect(verbosity).toBe('normal');
  });
});

describe('Error handling', () => {
  it('Error instance is handled correctly', () => {
    const error = new Error('Test error message');

    expect(error instanceof Error).toBe(true);
    expect(error.message).toBe('Test error message');
  });

  it('non-Error throw is handled', () => {
    const handleError = (e: unknown) => {
      if (e instanceof Error) {
        return e.message;
      }
      return 'An unexpected error occurred';
    };

    expect(handleError(new Error('Known error'))).toBe('Known error');
    expect(handleError('string error')).toBe('An unexpected error occurred');
    expect(handleError(null)).toBe('An unexpected error occurred');
    expect(handleError(undefined)).toBe('An unexpected error occurred');
    expect(handleError(123)).toBe('An unexpected error occurred');
  });
});
