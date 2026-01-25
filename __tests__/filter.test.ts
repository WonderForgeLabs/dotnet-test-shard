import {
  getTestsForShard,
  buildFilterExpression,
  combineFilters,
  escapeFilterValue,
} from '../src/filter';

describe('getTestsForShard', () => {
  const tests = ['Test0', 'Test1', 'Test2', 'Test3', 'Test4', 'Test5', 'Test6', 'Test7'];

  it('distributes tests using modulo (shard 1 of 4)', () => {
    const result = getTestsForShard(tests, 1, 4);
    expect(result).toEqual(['Test0', 'Test4']);
  });

  it('distributes tests using modulo (shard 2 of 4)', () => {
    const result = getTestsForShard(tests, 2, 4);
    expect(result).toEqual(['Test1', 'Test5']);
  });

  it('distributes tests using modulo (shard 3 of 4)', () => {
    const result = getTestsForShard(tests, 3, 4);
    expect(result).toEqual(['Test2', 'Test6']);
  });

  it('distributes tests using modulo (shard 4 of 4)', () => {
    const result = getTestsForShard(tests, 4, 4);
    expect(result).toEqual(['Test3', 'Test7']);
  });

  it('returns all tests for single shard', () => {
    const result = getTestsForShard(tests, 1, 1);
    expect(result).toEqual(tests);
  });

  it('handles more shards than tests', () => {
    const fewTests = ['Test0', 'Test1', 'Test2'];
    expect(getTestsForShard(fewTests, 1, 10)).toEqual(['Test0']);
    expect(getTestsForShard(fewTests, 2, 10)).toEqual(['Test1']);
    expect(getTestsForShard(fewTests, 3, 10)).toEqual(['Test2']);
    expect(getTestsForShard(fewTests, 4, 10)).toEqual([]);
    expect(getTestsForShard(fewTests, 10, 10)).toEqual([]);
  });

  it('throws for invalid shard number (< 1)', () => {
    expect(() => getTestsForShard(tests, 0, 4)).toThrow('Invalid shard 0');
  });

  it('throws for shard exceeding total', () => {
    expect(() => getTestsForShard(tests, 5, 4)).toThrow('Invalid shard 5');
  });

  it('throws for invalid total shards', () => {
    expect(() => getTestsForShard(tests, 1, 0)).toThrow('Invalid totalShards 0');
  });

  it('is deterministic across calls', () => {
    const result1 = getTestsForShard(tests, 2, 4);
    const result2 = getTestsForShard(tests, 2, 4);
    expect(result1).toEqual(result2);
  });

  it('ensures even distribution', () => {
    const tenTests = Array.from({ length: 10 }, (_, i) => `Test${i}`);
    const shard1 = getTestsForShard(tenTests, 1, 4);
    const shard2 = getTestsForShard(tenTests, 2, 4);
    const shard3 = getTestsForShard(tenTests, 3, 4);
    const shard4 = getTestsForShard(tenTests, 4, 4);

    // All tests should be covered
    const allAssigned = [...shard1, ...shard2, ...shard3, ...shard4].sort();
    expect(allAssigned).toEqual(tenTests);

    // Distribution should be even (2-3 per shard for 10 tests / 4 shards)
    expect(shard1.length).toBeGreaterThanOrEqual(2);
    expect(shard1.length).toBeLessThanOrEqual(3);
  });
});

describe('buildFilterExpression', () => {
  it('builds filter for single test', () => {
    const result = buildFilterExpression(['Ns.Class.Test1']);
    expect(result).toBe('(FullyQualifiedName~Ns.Class.Test1)');
  });

  it('builds filter for multiple tests with OR', () => {
    const result = buildFilterExpression(['Test1', 'Test2', 'Test3']);
    expect(result).toBe(
      '(FullyQualifiedName~Test1)|(FullyQualifiedName~Test2)|(FullyQualifiedName~Test3)'
    );
  });

  it('returns empty string for no tests', () => {
    const result = buildFilterExpression([]);
    expect(result).toBe('');
  });

  it('uses contains operator (~) for Theory support', () => {
    const result = buildFilterExpression(['MyTest']);
    expect(result).toContain('~');
    expect(result).not.toContain('=');
  });

  it('escapes pipe character in test name', () => {
    const result = buildFilterExpression(['Test|WithPipe']);
    expect(result).toBe('(FullyQualifiedName~Test\\|WithPipe)');
  });

  it('escapes ampersand character in test name', () => {
    const result = buildFilterExpression(['Test&WithAmpersand']);
    expect(result).toBe('(FullyQualifiedName~Test\\&WithAmpersand)');
  });

  it('escapes parentheses in test name', () => {
    const result = buildFilterExpression(['Test(With)Parens']);
    expect(result).toBe('(FullyQualifiedName~Test\\(With\\)Parens)');
  });

  it('escapes tilde character in test name', () => {
    const result = buildFilterExpression(['Test~WithTilde']);
    expect(result).toBe('(FullyQualifiedName~Test\\~WithTilde)');
  });

  it('escapes multiple special characters in test name', () => {
    const result = buildFilterExpression(['Test(a|b)&c~d']);
    expect(result).toBe('(FullyQualifiedName~Test\\(a\\|b\\)\\&c\\~d)');
  });

  it('escapes backslash in test name', () => {
    const result = buildFilterExpression(['Test\\WithBackslash']);
    expect(result).toBe('(FullyQualifiedName~Test\\\\WithBackslash)');
  });
});

describe('escapeFilterValue', () => {
  it('escapes pipe character', () => {
    expect(escapeFilterValue('a|b')).toBe('a\\|b');
  });

  it('escapes ampersand character', () => {
    expect(escapeFilterValue('a&b')).toBe('a\\&b');
  });

  it('escapes parentheses', () => {
    expect(escapeFilterValue('(a)')).toBe('\\(a\\)');
  });

  it('escapes tilde character', () => {
    expect(escapeFilterValue('a~b')).toBe('a\\~b');
  });

  it('escapes exclamation mark', () => {
    expect(escapeFilterValue('!a')).toBe('\\!a');
  });

  it('escapes equals sign', () => {
    expect(escapeFilterValue('a=b')).toBe('a\\=b');
  });

  it('escapes less than and greater than', () => {
    expect(escapeFilterValue('a<b>c')).toBe('a\\<b\\>c');
  });

  it('escapes backslash', () => {
    expect(escapeFilterValue('a\\b')).toBe('a\\\\b');
  });

  it('returns unchanged string without special characters', () => {
    expect(escapeFilterValue('Namespace.Class.Method')).toBe('Namespace.Class.Method');
  });

  it('escapes all special characters together', () => {
    expect(escapeFilterValue('(a|b)&c~d!e=f<g>h\\i')).toBe(
      '\\(a\\|b\\)\\&c\\~d\\!e\\=f\\<g\\>h\\\\i'
    );
  });
});

describe('combineFilters', () => {
  it('combines base and shard filters with AND', () => {
    const result = combineFilters('Category=Unit', '(FullyQualifiedName~Test1)');
    expect(result).toBe('(Category=Unit)&((FullyQualifiedName~Test1))');
  });

  it('returns shard filter when no base filter', () => {
    const result = combineFilters('', '(FullyQualifiedName~Test1)');
    expect(result).toBe('(FullyQualifiedName~Test1)');
  });

  it('returns base filter when no shard filter', () => {
    const result = combineFilters('Category=Unit', '');
    expect(result).toBe('Category=Unit');
  });

  it('returns empty when both empty', () => {
    const result = combineFilters('', '');
    expect(result).toBe('');
  });
});
