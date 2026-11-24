# Sudoku on Stream

A Sudoku that your Twitch chat solves together, made to run as an OBS **Browser Source**.

Viewers type a cell and a number in chat, for example `B7 4` (the space is optional, so `B74` works too). Correct answers appear on the board in the viewer's chat colour with their name, and points go to a live leaderboard.

**No chatbot needed.** The page connects to Twitch chat anonymously and read-only, the same way twitch.tv shows chat to logged-out viewers. There's no bot account, no OAuth token and nothing to host. It never posts to chat.

## Quick start (nothing to download)

Go to **[tavernworks.dev/sudoku](https://tavernworks.dev/sudoku/)**, type your channel name, and paste the link it gives you into an OBS Browser Source (1920 × 1080). The page has the full step-by-step guide.

Prefer to run it from your own computer? Download **[sudoku-on-stream.zip](https://tavernworks.dev/sudoku/sudoku-on-stream.zip)**, unzip it, and open `START HERE.txt`.

## Setup (OBS / Streamlabs)

1. Open `index.html` in a browser. A setup screen appears.
2. Enter your channel name and pick your options, then click **Copy URL**.
3. In OBS, add a **Browser Source**, uncheck "Local file", and paste the URL. Set the size to **1920 × 1080**.
   - You can also host the folder (for example on GitHub Pages) and use that URL.
4. To use the hotkeys, right-click the source and choose **Interact**.

### With GuildScribe's full stream theme

GuildScribe's full stream theme has a **Sudoku on Stream** scene (`&scene=sudoku` on the theme link, or pick it on the `!overlays` page). It gives almost the whole parchment sheet to one big torn window for the game, with Tavern Talk chat and the goldboard on the right. There's no emblem, status strip or subtitle in the way.

1. Add the theme (scene **Sudoku on Stream**) as a 1920 × 1080 Browser Source.
2. Add Sudoku on Stream as a Browser Source **below** the theme, with **Layout: GuildScribe theme** picked on the setup screen (`frame=1` in the URL).
3. Size it **1464 × 912** and place it at **X 40, Y 112**. The theme's torn edge overlaps it slightly; the layout leaves room for that.

`frame=1` fills the window edge to edge: the board is as tall as the window, and the side panel and background match the parchment (wood desk, cream board, dark-glass panel, Cinzel headings).

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

One empty cell always has a dashed outline and shows its real notes: every number that can still go there. The How to play panel shows the exact command that makes those notes (for example `G1?235`), so chat always has a correct example on screen. When that cell is filled, the example moves to another empty cell. Chat can't change the example cell's notes.

Notes are never checked and never score. When a number is placed, that cell's notes disappear, and the number is rubbed out of the notes in every cell it now rules out. Mods can type `!sudoku clearnotes` to wipe them all. Turn notes off with `notes=0` in the URL, or untick the box on the setup screen.

### Scoring

- Right answer: **+10**
- Completing a row, column or 3×3 box: **+5** each
- Placing the last cell of the puzzle: **+10**
- Wrong answer: **−2**, plus a short cooldown for that viewer (default 3 s)
- If nobody gets a correct answer for 60 s, a hint cell is revealed. The bar under the title counts down to it: full after every correct answer, turning gold then red as the hint gets close. (With hints off, `hint=0`, the bar shows puzzle progress instead.)
- When the puzzle is solved, an MVP screen shows, then a new puzzle starts.

Scores for the current puzzle and all-time scores (including wins) are saved in the browser source. The puzzle in progress is saved too, so refreshing the source doesn't lose it.

## Difficulty (1–20)

Every puzzle is graded by a solver that works like a person does, so a level reflects how hard the puzzle is to reason through, not just how many numbers are missing. Every puzzle has exactly one solution, and the givens are placed symmetrically.

| Levels | Names | Givens | Hardest technique needed |
|---|---|---|---|
| 1–8 | Beginner → Medium+ | 48 → 30 | Singles only (one spot left, or one number left) |
| 9–11 | Tricky, Tricky+, Hard | 29 → 27 | Locked candidates |
| 12–14 | Hard+, Harder, Tough | 26 → 24 | Naked / hidden pairs and triples |
| 15–16 | Expert, Expert+ | 24 → 23 | X-wing (when one turns up in time) |
| 17–18 | Master, Grandmaster | as few as possible | Swordfish or XY-wing |
| 19 | Fiendish | as few as possible | Beyond all of the above (trial and error) |
| 20 | Nightmare | as few as possible | The most trial and error found in 1.5 s |

### Difficulty modes

| Mode | What happens |
|---|---|
| **Adaptive** (default) | Starts at the slider's level, then each puzzle adjusts to how chat did on the last one |
| **Fixed** | Always the slider's level |
| **Cycle** | Every level in turn: 1, 2, 3 … 20, then back to 1 |

**How adaptive decides**, after each solved puzzle:

| Chat's result | Next puzzle |
|---|---|
| 90 %+ of answers right and no hints | **up 2** |
| 75 %+ right and hints for at most 10 % of the empty cells | **up 1** |
| under 50 % right, or hints for over 30 % of the cells | **down 2** |
| under 65 % right, or hints for over 15 % of the cells | **down 1** |
| anything in between | same level |
| puzzle skipped before it was solved | **down 1** |

The end screen shows the result, e.g. "Next: level 12 · Hard+ — ▲ up 1 (86% right, 1 hint)". If you set a level yourself during a puzzle, your choice wins over the automatic step.

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
| `!sudoku level 12` | Fixed difficulty for upcoming puzzles (`1`–`20`) |
| `!sudoku level auto` / `!sudoku level auto 8` | Adaptive difficulty (optionally starting at 8) |
| `!sudoku level rotate` | Cycle through every level 1 → 20 |
| `!sudoku variant windoku` | Set the type for upcoming puzzles (`classic`, `diagonal`, `windoku`, `centerdot`, `asterisk` or `mix`) |
| `!sudoku stop` / `!sudoku start` | Pause / resume the game (also `pause` / `resume`) |
| `!sudoku hint` | Reveal one cell |
| `!sudoku clearnotes` | Clear every viewer note on the board |
| `!sudoku resetscores` | Wipe all-time scores |
| `!sudoku solvedtime 30` | Show the solved screen for 30 s (3–600). `!sudoku solvedtime default` goes back to the URL's `next` value |

These only work for the broadcaster and moderators. In **Interact** mode you can also press **N** for a new puzzle, **H** for a hint, or **P** to stop / start.

### Start / Stop

**Stop** (control page button, `!sudoku stop`, or **P**) pauses the game: viewers see a "Paused" card, chat moves and notes are ignored, and the puzzle clock, hint countdown and end-screen countdown all freeze. **Start** carries on exactly where it left off; time spent stopped isn't counted. A stopped game stays stopped if the browser source reloads.

## Control page (`control.html`)

This is a separate page with **Start / Stop** buttons, a **difficulty slider** and **puzzle type** picker for upcoming puzzles, plus buttons for: start a new puzzle now, reveal a hint, clear all notes, set how long the "Solved!" screen shows, reset this puzzle's scores, reset all-time scores, and making a move as yourself. It also shows the game's status and the current top 10.

Add it in OBS as a second Browser Source sized **1920 × 1080**, and uncheck "Shutdown source when not visible". The page is laid out for 1080p and scrolls if it's taller than the window.

OBS only draws a Browser Source while it's visible (eye icon on), and **Interact** shows a blank window for a hidden one. To keep it usable without it appearing on stream, either:

- **Put it in its own scene** (e.g. "Sudoku Control") that you never switch to. Keep it visible there, then right-click it → **Interact**.
- **Or keep it in your main scene but drag it off the canvas**, so its eye stays on but it's outside the area that gets streamed.

Load both sources the same way, as `file:///…` URLs in the URL field (or both from the same website). The control page talks to the game through shared browser storage, so the two must have the same origin.

## URL options

| Param | Default | Meaning |
|---|---|---|
| `channel` | — | Twitch channel to read |
| `mode` | `auto` | `auto` (adaptive), `fixed`, or `rotate` (cycle 1 → 20) |
| `difficulty` | `7` | `1`–`20`: the level for `fixed`, or the starting level for `auto` |
| `variant` | `mix` | `classic`, `diagonal`, `windoku`, `centerdot`, `asterisk`, or `mix` |
| `prefix` | none | Require a prefix such as `!` (so `!B7 4`). Use this if moves are triggering from normal chat |
| `hint` | `60` | Seconds without progress before an automatic hint (`0` = off) |
| `cooldown` | `3` | Seconds a viewer waits after a wrong guess |
| `next` | `45` | Seconds the end screen shows before the next puzzle. A time set from the control page or `!sudoku solvedtime` overrides this until reset to default |
| `max` | `3` | Max moves accepted per chat message |
| `notes` | on | `0` turns off viewer notes |
| `frame` | — | `1` = layout for the Sudoku window of GuildScribe's full stream theme (1464 × 912) |
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
- `css/fonts/`: the Alegreya fonts the overlay uses (SIL Open Font License, see `css/fonts/OFL.txt`), bundled so it works offline

- `START HERE.txt`: short setup steps for people who downloaded the zip
- `tools/package.sh`: builds `dist/sudoku-on-stream.zip`; given a path to the tavernworks site (`tools/package.sh ../tavernworks`) it also publishes the hosted copy to `/sudoku/play/` and the zip to `/sudoku/`

It uses plain HTML/JS with no build step and no dependencies, so it works straight from disk (`file://`).
