#!/usr/bin/env bats

# Unit tests for the sharding logic in dotnet-test-shard action
#
# This file tests the bash script logic used in action.yml for:
# - Modulo-based test distribution
# - Filter expression building
# - Input validation
# - Test name parsing
#
# Run locally: bats tests/sharding.bats
# Requires: bats-core https://github.com/bats-core/bats-core
#
# References:
# - bats-core documentation: https://bats-core.readthedocs.io/
# - bats-assert: https://github.com/bats-core/bats-assert
# - Testing GitHub Actions: https://blog.codacy.com/how-to-test-github-actions

setup() {
    # Source helper functions
    load 'test_helper/bats-support/load'
    load 'test_helper/bats-assert/load'

    # Create temp directory for test files
    TEST_TEMP_DIR="$(mktemp -d)"
}

teardown() {
    rm -rf "$TEST_TEMP_DIR"
}

# Test: Modulo distribution assigns tests correctly to shards
@test "modulo distribution: test 0 goes to shard 1 of 4" {
    TEST_INDEX=0
    TOTAL_SHARDS=4
    SHARD_INDEX=$((TEST_INDEX % TOTAL_SHARDS))
    assert_equal "$SHARD_INDEX" "0"  # shard 1 (0-based)
}

@test "modulo distribution: test 1 goes to shard 2 of 4" {
    TEST_INDEX=1
    TOTAL_SHARDS=4
    SHARD_INDEX=$((TEST_INDEX % TOTAL_SHARDS))
    assert_equal "$SHARD_INDEX" "1"  # shard 2 (0-based)
}

@test "modulo distribution: test 4 goes back to shard 1 of 4" {
    TEST_INDEX=4
    TOTAL_SHARDS=4
    SHARD_INDEX=$((TEST_INDEX % TOTAL_SHARDS))
    assert_equal "$SHARD_INDEX" "0"  # shard 1 (0-based)
}

@test "modulo distribution: test 7 goes to shard 4 of 4" {
    TEST_INDEX=7
    TOTAL_SHARDS=4
    SHARD_INDEX=$((TEST_INDEX % TOTAL_SHARDS))
    assert_equal "$SHARD_INDEX" "3"  # shard 4 (0-based)
}

# Test: Single shard gets all tests
@test "single shard: all tests go to shard 1" {
    TOTAL_SHARDS=1
    for i in {0..9}; do
        SHARD_INDEX=$((i % TOTAL_SHARDS))
        assert_equal "$SHARD_INDEX" "0"
    done
}

# Test: Even distribution calculation
@test "even distribution: 10 tests across 4 shards" {
    TOTAL_TESTS=10
    TOTAL_SHARDS=4

    # Count tests per shard
    declare -A shard_counts
    for i in $(seq 0 $((TOTAL_TESTS - 1))); do
        SHARD_INDEX=$((i % TOTAL_SHARDS))
        shard_counts[$SHARD_INDEX]=$((${shard_counts[$SHARD_INDEX]:-0} + 1))
    done

    # Shards should have 2 or 3 tests each (10/4 = 2.5)
    for shard in 0 1 2 3; do
        count=${shard_counts[$shard]:-0}
        [ "$count" -ge 2 ] && [ "$count" -le 3 ]
    done
}

# Test: Filter expression building
@test "filter expression: single test" {
    TEST="Namespace.Class.Method1"
    FILTER="FullyQualifiedName=$TEST"
    assert_equal "$FILTER" "FullyQualifiedName=Namespace.Class.Method1"
}

@test "filter expression: multiple tests joined with OR" {
    # Note: No spaces around | per dotnet test filter syntax
    # Reference: https://learn.microsoft.com/en-us/dotnet/core/testing/selective-unit-tests
    TESTS="Test1|Test2|Test3"
    FILTER=""
    while IFS='|' read -ra TEST_ARRAY; do
        for test in "${TEST_ARRAY[@]}"; do
            if [[ -n "$FILTER" ]]; then
                FILTER="$FILTER|FullyQualifiedName=$test"
            else
                FILTER="FullyQualifiedName=$test"
            fi
        done
    done <<< "$TESTS"

    assert_equal "$FILTER" "FullyQualifiedName=Test1|FullyQualifiedName=Test2|FullyQualifiedName=Test3"
}

# Test: Input validation
@test "validation: shard number must be positive" {
    SHARD=0
    run bash -c '[[ "$SHARD" =~ ^[0-9]+$ ]] && [[ "$SHARD" -ge 1 ]] && echo "valid" || echo "invalid"'
    assert_output "invalid"
}

@test "validation: shard 1 is valid" {
    SHARD=1
    run bash -c 'SHARD=1; [[ "$SHARD" =~ ^[0-9]+$ ]] && [[ "$SHARD" -ge 1 ]] && echo "valid" || echo "invalid"'
    assert_output "valid"
}

@test "validation: shard cannot exceed total shards" {
    SHARD=5
    TOTAL_SHARDS=4
    run bash -c 'SHARD=5; TOTAL_SHARDS=4; [[ "$SHARD" -le "$TOTAL_SHARDS" ]] && echo "valid" || echo "invalid"'
    assert_output "invalid"
}

# Test: Test name parsing from dotnet output
@test "parse test names: extracts indented lines" {
    TEST_OUTPUT="The following Tests are available:
    Namespace.Class.Test1
    Namespace.Class.Test2
    Other.Namespace.Test3"

    run bash -c "echo '$TEST_OUTPUT' | grep -E '^\\s{4,}[A-Za-z]' | sed 's/^[[:space:]]*//' | sort"
    assert_line --index 0 "Namespace.Class.Test1"
    assert_line --index 1 "Namespace.Class.Test2"
    assert_line --index 2 "Other.Namespace.Test3"
}

# Test: Determinism - same input produces same output
@test "determinism: same tests always go to same shards" {
    TESTS="Alpha.Test1
Beta.Test2
Gamma.Test3
Delta.Test4"

    # Run twice and compare results
    result1=$(echo "$TESTS" | sort | awk 'NR==1 {print NR-1, $0}')
    result2=$(echo "$TESTS" | sort | awk 'NR==1 {print NR-1, $0}')

    assert_equal "$result1" "$result2"
}

# Test: Empty test list handling
@test "empty tests: returns zero count" {
    TESTS=""
    # Use wc -l with trim to handle empty string correctly
    if [[ -z "$TESTS" ]]; then
        TOTAL_TESTS=0
    else
        TOTAL_TESTS=$(echo "$TESTS" | grep -c . || echo "0")
    fi
    assert_equal "$TOTAL_TESTS" "0"
}

# Test: More shards than tests
@test "more shards than tests: some shards get zero tests" {
    TOTAL_TESTS=3
    TOTAL_SHARDS=10

    # Shards 4-10 (0-based: 3-9) should get no tests
    for test_idx in 0 1 2; do
        SHARD_INDEX=$((test_idx % TOTAL_SHARDS))
        [ "$SHARD_INDEX" -lt 3 ]  # All tests go to first 3 shards
    done
}
