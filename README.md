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

### Notes (pencil marks)

Chat shares one set of pencil marks. Viewers can jot down which numbers might go in a cell without guessing:

| Chat message | What happens |
|---|---|
| `B7?35` (or `B7? 3 5`, `b7?3,5`) | Pencils small 3 and 5 into B7 |
| `B7?-3` | Rubs out the 3 |
| `B7?x` (or `B7?0`) | Clears all notes in B7 |

Notes are free: they're never checked and never score. When a number is placed, that cell's notes disappear, and the number is rubbed out of the notes in every cell it now rules out. Mods can type `!sudoku clearnotes` to wipe them all. Turn notes off with `notes=0` in the URL, or untick the box on the setup screen.

### Scoring

- Right answer: **+10**
- Completing a row, column or 3×3 box: **+5** each
- Placing the last cell of the puzzle: **+10**
- Wrong answer: **−2**, plus a short cooldown for that viewer (default 3 s)
- If nobody makes progress for 60 s, a free hint cell is revealed.
- When the puzzle is solved, an MVP screen shows, then a new puzzle starts.

Scores for the current puzzle and all-time scores (including wins) are saved in the browser source. The puzzle in progress is saved too, so refreshing the source doesn't lose it.

## Difficulty (1–10)

The difficulty slider on the setup screen and control page picks a level from 1 to 10. Each puzzle is graded by a solver that works like a person does, so the level reflects how hard the puzzle actually is to reason through, not just how many numbers are missing.

| Level | Name | Givens | Hardest technique needed |
|---|---|---|---|
| 1–4 | Beginner, Easy, Casual, Medium | 46 → 32 | Singles only (one spot left, or one number left) |
| 5 | Tricky | ~29 | Locked candidates (sometimes) |
| 6 | Hard | ~27 | Locked candidates |
| 7 | Harder | ~26 | Naked / hidden pairs and triples |
| 8 | Expert | ~24 | Pairs and triples, sometimes X-wing |
| 9 | Master | ~23 | X-wing when one turns up in time; otherwise the hardest found |
| 10 | Fiendish | as few as possible | Beyond X-wing (chat will need to think hard) |

`rotate` cycles levels 3 → 5 → 8. Every puzzle has exactly one solution, and the givens are placed symmetrically.

## Puzzle types

All types use the same 9×9 grid and the same `B7 4` chat input. The extra regions are shaded on the board, and the rule is shown in the side panel.

| Type | Extra rule |
|---|---|
| Classic | none |
| Diagonal | Both long diagonals contain 1–9 once |
| Windoku | Four extra shaded 3×3 windows contain 1–9 once |
| Center Dot | The nine box centres (●) contain 1–9 once |
| Asterisk | The nine starred cells (★) contain 1–9 once |

**Mix** (the default) alternates classic puzzles with each twist in turn. Completing an extra region scores the same +5 as a row, column or box.

## Streamer / mod commands (typed in chat)

| Command | Effect |
|---|---|
| `!sudoku new` | New puzzle. Optional type and/or level: `!sudoku new 7`, `!sudoku new diagonal`, `!sudoku new windoku 9` |
| `!sudoku level 6` | Set the difficulty for upcoming puzzles (`1`–`10` or `rotate`) |
| `!sudoku variant windoku` | Set the type for upcoming puzzles (`classic`, `diagonal`, `windoku`, `centerdot`, `asterisk` or `mix`) |
| `!sudoku hint` | Reveal one cell |
| `!sudoku clearnotes` | Clear every viewer note on the board |
| `!sudoku resetscores` | Wipe all-time scores |

These only work for the broadcaster and moderators. In **Interact** mode you can also press **N** for a new puzzle or **H** for a hint.

## Control page (`control.html`)

This is a separate page with a **difficulty slider** and **puzzle type** picker for upcoming puzzles, plus buttons for: start a new puzzle now, reveal a hint, clear all notes, reset this puzzle's scores, reset all-time scores, and making a move as yourself. It also shows the game's status and the current top 5.

Add it in OBS as a second Browser Source sized **1920 × 1080** and keep it hidden. The page is laid out for 1080p and scrolls on its own if it's taller than the window, even with OBS's default custom CSS. Uncheck "Shutdown source when not visible" so it keeps running, then right-click it and choose **Interact** to use it.

Load both sources the same way, as `file:///…` URLs in the URL field. The control page talks to the game through shared browser storage, so the two must have the same origin.

## URL options

| Param | Default | Meaning |
|---|---|---|
| `channel` | — | Twitch channel to read |
| `difficulty` | `rotate` | `1`–`10`, or `rotate`. `easy`/`medium`/`hard` still work (= 3/5/8) |
| `variant` | `mix` | `classic`, `diagonal`, `windoku`, `centerdot`, `asterisk`, or `mix` |
| `prefix` | none | Require a prefix such as `!` (so `!B7 4`). Use this if moves are triggering from normal chat |
| `hint` | `60` | Seconds without progress before a free hint (`0` = off) |
| `cooldown` | `3` | Seconds a viewer waits after a wrong guess |
| `next` | `20` | Seconds between puzzles |
| `max` | `3` | Max moves accepted per chat message |
| `notes` | on | `0` turns off viewer notes |
| `bg` | — | `transparent` for a see-through background |
| `demo` | — | `1` = simulated viewers |
| `test` | — | `1` = shows a text box so you can type "chat" messages yourself |

## Files

- `index.html`: the page (setup screen and game)
- `control.html`: streamer control panel
- `js/sudoku.js`: puzzle generator, variants and difficulty grader. Every puzzle has exactly one solution.
- `js/twitch.js`: anonymous read-only Twitch chat client
- `js/game.js`: game rules, scoring, chat parsing and rendering
- `css/style.css`: styling

It uses plain HTML/JS with no build step and no dependencies, so it works straight from disk (`file://`).
