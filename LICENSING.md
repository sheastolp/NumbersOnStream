# Paid extras and the licensing service

Sudoku on Stream is free to play. Paying unlocks only:

| Plan | Unlocks | Features on the plan |
|---|---|---|
| Offline download | The zip, to run the game from your own computer | `offline` |
| Supporter bundle | The zip **and** every cosmetic (★ looks) | `offline`, `looks` |

Cosmetics are looks only: board themes, solve celebrations, digit fonts and digit styles. **No paid option changes puzzles, moves, scoring, hints, timers, difficulty, puzzle types, layouts, the control page or chat commands.** Every gameplay option stays free and needs no key. The code keeps it that way: `js/cosmetics.js` only adds CSS classes and draws the celebration canvas, and `js/game.js` applies looks after the game is already running.

Anyone can try every look for free in the demo (`?demo=1` with no channel). With a channel, a ★ look needs a key whose plan has the `looks` feature in the link (`&key=…`). Without one the standard look shows and the game plays exactly the same.

## The licensing service

Keys are issued by the [licensing-service](https://github.com/Straconis/licensing-service) WordPress plugin (the `core-plugin`, `payments` and `shopify` branches; API in `docs/API.md`, tokens in `docs/TOKEN.md`). `js/license.js` is a browser client for it that follows the plugin's client contract (`clients/SPEC.md`) and passes its shared token test vectors (`clients/test-vectors/vectors.json`, 32 cases plus the fingerprint check). Token signatures are checked with [TweetNaCl](https://tweetnacl.js.org) 1.0.3 (`js/vendor/nacl-fast.min.js`, public domain), because the Chromium inside OBS doesn't have Ed25519 in WebCrypto.

How the game uses it:

- **Fingerprint**: a browser can't read a machine id, so each browser profile (each OBS, each web browser, the hosted and downloaded copies separately) gets a random id (`lsvc-web:` + 32 hex) in local storage. The server only stores its hash.
- **First use** with a key in a browser: `POST /activate` with label `OBS (tavernworks.dev)`, `OBS (offline copy)` or `Browser (…)`. The signed token and key are saved in local storage.
- **Every load**: the saved token is verified (signature, `fp`, product, issuer, `valid_until`). Before `refresh_after` there's no network call. After it, `POST /refresh`; if the server can't be reached, the saved token keeps working until `valid_until` (the site's offline grace period). If the server refuses the key, the token is deleted and the standard look shows.
- **`not_activated`** (the customer removed this setup on their account page): the game activates again, which counts against the plan's activation limit.
- **Setup pages** (the game's setup screen and tavernworks.dev/sudoku) check a key by activating and then deactivating straight away, so checking a key never uses up a seat.

## Setting it up

### On the licensing site (WordPress)

1. Install the plugin (build it with `bin/build-plugin-zip.sh` from the `shopify` branch) and set **Licensing → Settings**: brand name (e.g. Tavernworks), key prefix (e.g. `TAVN`), support email, offline grace period (the Terms say 7 days by default), token refresh interval (24 hours), and the payment gateway you'll use.
2. Add a product with slug **`sudoku-on-stream`**, and two **one-time** plans:
   - `offline`: features `offline`
   - `supporter`: features `offline`, `looks`

   Set **max activations** generously, or to 0 (unlimited). Every browser and OBS a streamer uses counts as one, and the hosted and downloaded copies count separately. 5 is a reasonable limit if you want one.
3. Make a page with `[lsvc_buy plan="sudoku-on-stream/offline"]`, one with `[lsvc_buy plan="sudoku-on-stream/supporter"]` (or both on one page), and an account page with `[lsvc_account]`.
4. CORS: WordPress already answers cross-site REST requests, including `Origin: null` from the offline copy's `file://` pages, so nothing to add. The site must be on HTTPS (the API refuses plain HTTP).

### In this repo

Fill in `LICENSE_CONFIG` at the top of `js/license.js`:

| Field | What to put there |
|---|---|
| `api` | `https://<licensing site>/wp-json/lsvc/v1`. Empty = paid extras show as "coming soon". |
| `product`, `features` | Only change these if you used a different slug or feature names. |
| `publicKeys` | The keys from `GET <api>/public-keys`, as `{ "<kid>": "<public_key>" }`. If left empty they're fetched at run time. |
| `issuer` | The licensing site's host name (the tokens' `iss`). |
| `store.offline`, `store.supporter` | The buy pages from step 3 and the prices to show on tavernworks.dev/sudoku. |
| `accountUrl` | The `[lsvc_account]` page. |

Then run `tools/package.sh ../tavernworks` to publish.

## Delivering the zip

**The plugin doesn't deliver files yet.** Its purchase email sends the key and a link to the account page, but no download. Until it can, buyers need another way to get the zip. Options:

1. Add download support to the plugin (a file per product, a "Download" button on the account page and a link in the key email, served only to licences whose plan has the `offline` feature). This is the proper fix.
2. Short term: use the plugin's `lsvc_email` filter to add a download link to the key email. The link can be shared, so keep it unlisted and change it now and then.

`tools/package.sh` builds `dist/sudoku-on-stream.zip`. It never puts the zip on the public website.

## What a licence can't stop

- The game is plain HTML and JavaScript. The hosted copy at tavernworks.dev/sudoku/play/ is public, so a determined person can save it and edit out the key check. The licence is a fair-play gate, not DRM (the plugin's spec says the same).
- While this repository is public, anyone can download the source from GitHub. Make it private (or stop publishing new versions to it) before selling the download.
