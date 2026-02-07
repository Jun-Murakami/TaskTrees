#!/usr/bin/env bash
set -euo pipefail

if [ -d "/opt/homebrew/opt/openjdk@21" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

EMULATOR_PORT=9000
EMULATOR_PID=""

cleanup() {
  if [ -n "$EMULATOR_PID" ] && kill -0 "$EMULATOR_PID" 2>/dev/null; then
    echo "Stopping Firebase Emulator (PID $EMULATOR_PID)..."
    kill "$EMULATOR_PID" 2>/dev/null || true
    wait "$EMULATOR_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if lsof -i :$EMULATOR_PORT -t >/dev/null 2>&1; then
  echo "Port $EMULATOR_PORT is already in use. Killing existing process..."
  lsof -i :$EMULATOR_PORT -t | xargs kill -9 2>/dev/null || true
  sleep 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting Firebase Emulator (database on port $EMULATOR_PORT)..."
firebase emulators:start --only database --project tasktrees-test --config "$PROJECT_DIR/firebase.emulator.json" &
EMULATOR_PID=$!

echo "Waiting for emulator to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while ! curl -s "http://127.0.0.1:$EMULATOR_PORT/.json" >/dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Emulator did not start within ${MAX_RETRIES}s"
    exit 1
  fi
  sleep 1
done

echo "Emulator ready. Running tests..."
npx vitest run "$@"
TEST_EXIT=$?

echo "Tests finished with exit code $TEST_EXIT"
exit $TEST_EXIT
