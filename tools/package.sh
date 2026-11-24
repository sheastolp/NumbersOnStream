#!/usr/bin/env bash
# Packages Sudoku on Stream for the public.
#
#   tools/package.sh                     builds dist/sudoku-on-stream.zip (the stream
#                                        version) and dist/sudoku-offline.zip (solo play
#                                        only: no Twitch, no OBS, no internet)
#   tools/package.sh ../tavernworks      also publishes them to the website:
#                                        the hosted game at /sudoku/play/ and
#                                        both zips at /sudoku/
#
# The game has no build step; this only copies the files people need.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(tr -d '[:space:]' < VERSION)"
FILES=(index.html "Play Sudoku.html" control.html css js README.md "START HERE.txt" VERSION)
# The offline zip leaves out the stream-only parts (control page, Twitch client).
OFFLINE=(index.html "Play Sudoku.html" css VERSION)

rm -rf dist
mkdir -p "dist/sudoku-on-stream"
cp -r "${FILES[@]}" "dist/sudoku-on-stream/"
(cd dist && zip -qrX sudoku-on-stream.zip sudoku-on-stream)
echo "Built dist/sudoku-on-stream.zip (v$VERSION)"

mkdir -p "dist/sudoku-offline/js"
cp -r "${OFFLINE[@]}" "dist/sudoku-offline/"
cp js/sudoku.js js/game.js "dist/sudoku-offline/js/"
cp tools/offline-readme.txt "dist/sudoku-offline/READ ME.txt"
# Offline index.html: no Twitch client, and it always opens straight into solo play.
TW='<script src="js/twitch.js"></script>'
grep -qF "$TW" index.html || { echo "index.html no longer loads js/twitch.js the expected way; update package.sh" >&2; exit 1; }
sed "s#$TW#<script>window.SUDOKU_SOLO_ONLY = true;</script>#" index.html > "dist/sudoku-offline/index.html"
(cd dist && zip -qrX sudoku-offline.zip sudoku-offline)
echo "Built dist/sudoku-offline.zip (v$VERSION)"

if [ $# -ge 1 ]; then
  SITE="$1"
  [ -f "$SITE/projects.js" ] || { echo "$SITE doesn't look like the tavernworks site" >&2; exit 1; }
  PLAY="$SITE/sudoku/play"
  rm -rf "$PLAY"
  mkdir -p "$PLAY"
  cp -r index.html "Play Sudoku.html" control.html css js VERSION "$PLAY/"
  cp dist/sudoku-on-stream.zip "$SITE/sudoku/sudoku-on-stream.zip"
  cp dist/sudoku-offline.zip "$SITE/sudoku/sudoku-offline.zip"
  echo "Published v$VERSION to $SITE/sudoku/ (play/, sudoku-on-stream.zip and sudoku-offline.zip)"
fi
