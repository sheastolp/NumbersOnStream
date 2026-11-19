#!/usr/bin/env bash
# Packages Sudoku on Stream for the public.
#
#   tools/package.sh                     builds dist/sudoku-on-stream.zip
#   tools/package.sh ../tavernworks      also publishes the hosted game to the
#                                        website at /sudoku/play/
#
# The zip is the paid offline download (see "Delivering the zip" in
# LICENSING.md). It is never copied to the website, which is public.
#
# The game has no build step; this only copies the files people need.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(tr -d '[:space:]' < VERSION)"
FILES=(index.html control.html css js README.md "START HERE.txt" LICENCE.txt VERSION)

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
  rm -f "$SITE/sudoku/sudoku-on-stream.zip" # the download is paid now; never publish it
  echo "Published v$VERSION to $SITE/sudoku/play/"
  echo "dist/sudoku-on-stream.zip is the paid download; see LICENSING.md for delivering it."
fi
