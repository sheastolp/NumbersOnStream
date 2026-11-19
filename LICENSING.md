# Paid extras and the licensing service

Sudoku on Stream is free to play. Paying unlocks only:

| Product | ID | Unlocks |
|---|---|---|
| Offline download | `sudoku-on-stream-offline` | The zip, to run the game from your own computer |
| Supporter bundle | `sudoku-on-stream-supporter` | The zip **and** every cosmetic (★ looks) |

Cosmetics are looks only: board themes, solve celebrations, digit fonts and digit styles. **No paid option changes puzzles, moves, scoring, hints, timers, difficulty, puzzle types, layouts, the control page or chat commands.** Every gameplay option stays free and needs no key. The code keeps it that way: `js/cosmetics.js` only adds CSS classes and draws the celebration canvas, and `js/game.js` applies looks after the game is already running.

Anyone can try every look for free in the demo (`?demo=1` with no channel). With a channel, a ★ look needs a Supporter licence key in the link (`&key=…`). Without one the standard look shows and the game plays exactly the same.

## Setting it up

Everything is in `LICENSE_CONFIG` at the top of `js/license.js`:

| Field | What to put there |
|---|---|
| `api` | Base URL of the licensing service. Leave it empty until the service is live; the paid extras then show as "coming soon". |
| `products` | The product IDs above, if the licensing service uses different ones |
| `store.offline` / `store.supporter` | Checkout page URL and the price to show on tavernworks.dev/sudoku |
| `graceDays` | How long a key that checked out keeps working while the service can't be reached (default 14) |

Then run `tools/package.sh ../tavernworks` to publish, and upload `dist/sudoku-on-stream.zip` to the licensing service as the file for both products. The zip is never put on the public website.

## API the game expects

Both endpoints take JSON and return JSON. They're called from the browser, including from `file://` pages (origin `null`) for the offline copy, so they need CORS: `Access-Control-Allow-Origin: *`, and they must answer the `OPTIONS` preflight for `Content-Type: application/json`.

### `POST {api}/v1/licenses/validate`

Request:

```json
{ "license_key": "XXXX-XXXX-XXXX", "products": ["sudoku-on-stream-offline", "sudoku-on-stream-supporter"] }
```

`products` lists the IDs the game cares about, so one service can serve several apps.

Response, key is good (HTTP 200):

```json
{ "valid": true, "products": ["sudoku-on-stream-supporter"], "expires_at": null }
```

`products` = which of the requested products this key covers. `expires_at` is optional (ISO date, or `null` for lifetime).

Response, key is unknown, refunded, expired or revoked (HTTP 4xx, or 200 with `valid: false`):

```json
{ "valid": false, "message": "This key was refunded." }
```

`message` is optional and is shown to the streamer on the setup screen.

HTTP 5xx and 429 count as "service unreachable", not "invalid". The game then keeps using the last good answer for up to `graceDays`.

### `POST {api}/v1/downloads`

Used by the "Already bought?" box on tavernworks.dev/sudoku to download the zip again.

Request:

```json
{ "license_key": "XXXX-XXXX-XXXX", "products": ["sudoku-on-stream-offline", "sudoku-on-stream-supporter"] }
```

Response (HTTP 200): a short-lived link to the zip.

```json
{ "url": "https://…/sudoku-on-stream-1.1.0.zip?sig=…" }
```

On failure: HTTP 4xx/5xx with an optional `{ "message": "…" }`.

## What a licence can't stop

- The game is plain HTML and JavaScript. The hosted copy at tavernworks.dev/sudoku/play/ is public, so a determined person can save it, and edit out the key check. The licence is a fair-play gate, not DRM.
- While this repository is public, anyone can download the source from GitHub. Make it private (or stop publishing new versions to it) before selling the download.
