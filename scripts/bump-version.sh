#!/usr/bin/env bash
set -euo pipefail

LEVEL="${1:-patch}"

case "$LEVEL" in
  major|minor|patch) ;;
  *) echo "Usage: $0 [major|minor|patch]  (default: patch)" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

CURRENT=$(node -p "require('$ROOT/package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$LEVEL" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo "==> Running checks before version bump..."
echo ""

echo "[1/3] Type check"
npx tsc --noEmit

echo "[2/3] Lint"
npx eslint .

echo "[3/3] Test"
npx vitest run src/__tests__/unit

echo ""
echo "==> All checks passed. Bumping $CURRENT → $NEW_VERSION"
echo ""

# --- package.json ---
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$ROOT/package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('$ROOT/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  package.json: $NEW_VERSION"

# --- Android: android/app/build.gradle ---
GRADLE="$ROOT/android/app/build.gradle"
if [ -f "$GRADLE" ]; then
  OLD_CODE=$(grep -oE 'versionCode [0-9]+' "$GRADLE" | grep -oE '[0-9]+')
  NEW_CODE=$((OLD_CODE + 1))
  sed -i '' "s/versionCode $OLD_CODE/versionCode $NEW_CODE/" "$GRADLE"
  sed -i '' "s/versionName \"$CURRENT\"/versionName \"$NEW_VERSION\"/" "$GRADLE"
  echo "  Android build.gradle: versionName=$NEW_VERSION  versionCode=$NEW_CODE"
fi

# --- iOS: project.pbxproj ---
PBXPROJ="$ROOT/ios/App/App.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
  OLD_BUILD=$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+' "$PBXPROJ" | grep -oE '[0-9]+')
  NEW_BUILD=$((OLD_BUILD + 1))
  sed -i '' "s/CURRENT_PROJECT_VERSION = $OLD_BUILD/CURRENT_PROJECT_VERSION = $NEW_BUILD/g" "$PBXPROJ"
  sed -i '' "s/MARKETING_VERSION = $CURRENT/MARKETING_VERSION = $NEW_VERSION/g" "$PBXPROJ"
  echo "  iOS project.pbxproj: MARKETING_VERSION=$NEW_VERSION  CURRENT_PROJECT_VERSION=$NEW_BUILD"
fi

echo ""
echo "Done! Version bumped to $NEW_VERSION"
