/**
 * Escape special characters in a test name for use in VSTest filter expressions
 *
 * VSTest filter syntax uses these special characters: ( ) | & ~ ! = < >
 * Backslashes are also escaped since they're the escape character.
 *
 * @param value - The test name to escape
 * @returns The escaped test name safe for use in filter expressions
 */
export declare function escapeFilterValue(value: string): string;
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
export declare function getTestsForShard(tests: string[], shard: number, totalShards: number): string[];
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
export declare function buildFilterExpression(tests: string[]): string;
/**
 * Combine a base filter with a shard filter using AND logic
 *
 * @param baseFilter - User-provided filter expression (may be empty)
 * @param shardFilter - Filter for tests in this shard (may be empty)
 * @returns Combined filter expression
 */
export declare function combineFilters(baseFilter: string, shardFilter: string): string;
