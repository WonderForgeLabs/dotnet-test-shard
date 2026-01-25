// Mock for @actions/exec
export const exec = jest.fn().mockImplementation(
  (
    cmd: string,
    args?: string[],
    options?: {
      listeners?: {
        stdout?: (data: Buffer) => void;
        stderr?: (data: Buffer) => void;
      };
      ignoreReturnCode?: boolean;
    }
  ) => {
    if (options?.listeners?.stdout) {
      options.listeners.stdout(Buffer.from(''));
    }
    if (options?.listeners?.stderr) {
      options.listeners.stderr(Buffer.from(''));
    }
    return Promise.resolve(0);
  }
);
export const getExecOutput = jest.fn();
