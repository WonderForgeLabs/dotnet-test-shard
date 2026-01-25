/**
 * Escape special characters in a test name for use in VSTest filter expressions
 *
 * VSTest filter syntax uses these special characters: ( ) | & ~ ! = < >
 * Backslashes are also escaped since they're the escape character.
 *
 * @param value - The test name to escape
 * @returns The escaped test name safe for use in filter expressions
 */
export function escapeFilterValue(value: string): string {
  return value.replace(/[()&|~!=<>\\]/g, '\\$&');
}

/**
 * Calculate which tests belong to a specific shard using modulo distribution
 *
 * This provides deterministic, even distribution of tests across shards
 * without requiring manual annotations.
 *
 * Algorithm: test at index i goes to shard (i % totalShards) + 1
 *
 * @param tests - Array of test names (should be sorted for determinism)
 * @param shard - Current shard number (1-based)
 * @param totalShards - Total number of shards
 * @returns Array of tests assigned to this shard
 */
export function getTestsForShard(tests: string[], shard: number, totalShards: number): string[] {
  if (totalShards < 1) {
    throw new Error(`Invalid totalShards ${totalShards}: must be >= 1`);
  }

  if (shard < 1 || shard > totalShards) {
    throw new Error(`Invalid shard ${shard}: must be between 1 and ${totalShards}`);
  }

  const shardIndex = shard - 1; // Convert to 0-based
  return tests.filter((_, index) => index % totalShards === shardIndex);
}

/**
 * Build a dotnet test filter expression for the given tests
 *
 * Uses FullyQualifiedName~ (contains) operator to match test methods
 * including all Theory variants. Each condition is wrapped in parentheses
 * for proper VSTest parsing.
 *
 * @param tests - Array of test names to include
 * @returns Filter expression string, or empty string if no tests
 *
 * @example
 * buildFilterExpression(['Ns.Class.Test1', 'Ns.Class.Test2'])
 * // Returns: '(FullyQualifiedName~Ns.Class.Test1)|(FullyQualifiedName~Ns.Class.Test2)'
 */
export function buildFilterExpression(tests: string[]): string {
  if (tests.length === 0) {
    return '';
  }

  return tests.map((test) => `(FullyQualifiedName~${escapeFilterValue(test)})`).join('|');
}

/**
 * Combine a base filter with a shard filter using AND logic
 *
 * @param baseFilter - User-provided filter expression (may be empty)
 * @param shardFilter - Filter for tests in this shard (may be empty)
 * @returns Combined filter expression
 */
export function combineFilters(baseFilter: string, shardFilter: string): string {
  if (baseFilter && shardFilter) {
    return `(${baseFilter})&(${shardFilter})`;
  }
  return baseFilter || shardFilter;
}
