#!/usr/bin/env bash
# Packages Sudoku on Stream for the public.
#
#   tools/package.sh                     builds dist/sudoku-on-stream.zip
#   tools/package.sh ../tavernworks      also publishes it to the website:
#                                        the hosted game at /sudoku/play/ and
#                                        the zip at /sudoku/sudoku-on-stream.zip
#
# The game has no build step; this only copies the files people need.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(tr -d '[:space:]' < VERSION)"
FILES=(index.html control.html css js README.md "START HERE.txt" VERSION)

rm -rf dist
mkdir -p "dist/sudoku-on-stream"
cp -r "${FILES[@]}" "dist/sudoku-on-stream/"
(cd dist && zip -qrX sudoku-on-stream.zip sudoku-on-stream)
echo "Built dist/sudoku-on-stream.zip (v$VERSION)"

if [ $# -ge 1 ]; then
  SITE="$1"
  [ -f "$SITE/projects.js" ] || { echo "$SITE doesn't look like the tavernworks site" >&2; exit 1; }
  PLAY="$SITE/sudoku/play"
  rm -rf "$PLAY"
  mkdir -p "$PLAY"
  cp -r index.html control.html css js VERSION "$PLAY/"
  cp dist/sudoku-on-stream.zip "$SITE/sudoku/sudoku-on-stream.zip"
  echo "Published v$VERSION to $SITE/sudoku/ (play/ and sudoku-on-stream.zip)"
fi
