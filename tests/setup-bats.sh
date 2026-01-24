#!/bin/bash
# Setup bats-core and helper libraries for testing

set -e

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$TESTS_DIR/test_helper"

# Clone bats-support if not present
if [[ ! -d "$TESTS_DIR/test_helper/bats-support" ]]; then
    git clone --depth 1 https://github.com/bats-core/bats-support.git "$TESTS_DIR/test_helper/bats-support"
fi

# Clone bats-assert if not present
if [[ ! -d "$TESTS_DIR/test_helper/bats-assert" ]]; then
    git clone --depth 1 https://github.com/bats-core/bats-assert.git "$TESTS_DIR/test_helper/bats-assert"
fi

echo "Bats test helpers installed successfully!"
