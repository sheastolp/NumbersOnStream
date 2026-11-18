# Sudoku on Stream

A Sudoku that your Twitch chat solves together, made to run as an OBS **Browser Source**.

Viewers type a cell and a number in chat, for example `B7 4`. Correct answers appear on the board in the viewer's chat colour with their name, and points go to a live leaderboard.

**No chatbot needed.** The page connects to Twitch chat anonymously and read-only, the same way twitch.tv shows chat to logged-out viewers. There's no bot account, no OAuth token and nothing to host. It never posts to chat.

## Setup (OBS / Streamlabs)

1. Open `index.html` in a browser. A setup screen appears.
2. Enter your channel name and pick your options, then click **Copy URL**.
3. In OBS, add a **Browser Source**, uncheck "Local file", and paste the URL. Set the size to **1920 × 1080**.
   - You can also host the folder (for example on GitHub Pages) and use that URL.
4. To use the hotkeys, right-click the source and choose **Interact**.

To try it with no chat at all, open `index.html?demo=1`. Fake viewers will play.

## How chat plays

| Chat message | What happens |
|---|---|
| `B7 4` (or `b7=4`, `B74`, `ok B7 4 i think`) | Puts a 4 in row B, column 7 |
| `A1 5 C3 2` | Several moves in one message (up to 3) |

- Right answer: **+10**
- Completing a row, column or 3×3 box: **+5** each
- Placing the last cell of the puzzle: **+10**
- Wrong answer: **−2**, plus a short cooldown for that viewer (default 3 s)
- If nobody makes progress for 60 s, a free hint cell is revealed.
- When the puzzle is solved, an MVP screen shows, then a new puzzle starts.

Scores for the current puzzle and all-time scores (including wins) are saved in the browser source. The puzzle in progress is saved too, so refreshing the source doesn't lose it.

## Streamer / mod commands (typed in chat)

| Command | Effect |
|---|---|
| `!sudoku new` | New puzzle (optionally `!sudoku new hard`) |
| `!sudoku hint` | Reveal one cell |
| `!sudoku resetscores` | Wipe all-time scores |

These only work for the broadcaster and moderators. In **Interact** mode you can also press **N** for a new puzzle or **H** for a hint.

## URL options

| Param | Default | Meaning |
|---|---|---|
| `channel` | — | Twitch channel to read |
| `difficulty` | `rotate` | `easy`, `medium`, `hard`, or `rotate` |
| `prefix` | none | Require a prefix such as `!` (so `!B7 4`). Use this if moves are triggering from normal chat |
| `hint` | `60` | Seconds without progress before a free hint (`0` = off) |
| `cooldown` | `3` | Seconds a viewer waits after a wrong guess |
| `next` | `20` | Seconds between puzzles |
| `max` | `3` | Max moves accepted per chat message |
| `bg` | — | `transparent` for a see-through background |
| `demo` | — | `1` = simulated viewers |
| `test` | — | `1` = shows a text box so you can type "chat" messages yourself |

## Files

- `index.html`: the page (setup screen and game)
- `js/sudoku.js`: puzzle generator. Every puzzle has exactly one solution.
- `js/twitch.js`: anonymous read-only Twitch chat client
- `js/game.js`: game rules, scoring, chat parsing and rendering
- `css/style.css`: styling

It uses plain HTML/JS with no build step and no dependencies, so it works straight from disk (`file://`).
