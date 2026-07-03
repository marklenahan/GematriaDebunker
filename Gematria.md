# Mark's Simple Gematria Debunker

A set of JavaScript tools for scoring words using alphabetic letter values, counting how many lexicon word combinations share a given total score, and generating random examples of those combinations. Multiple encoding schemes are supported.

Live at: https://gematria-debunker.onrender.com
GitHub: https://github.com/marklenahan/GematriaDebunker

---

## Scoring rules

- Each letter A–Z is assigned a numeric value based on the active encoding (see Encodings below)
- Upper and lower case score the same
- Non-alphabetic characters (spaces, punctuation) are ignored and score zero
- A word's score is the sum of its letter values
- A phrase's score is the sum of its word scores
- A token consisting entirely of digits (e.g. `52`) is treated as a literal number and added directly to the total — it is not scored letter-by-letter

---

## Encodings

Four encoding schemes are supported, selectable in the web UI or via the `/N` argument on the CLI:

| ID | Name | Description |
|---|---|---|
| 1 | English (simple) | A=1, B=2, C=3 … Z=26 |
| 2 | Transliterated Hebrew | Based on Hebrew letter values mapped to Latin letters; J=600, W=900, X=300, Y=400, Z=500 |
| 3 | Latin (Christoph Rudolff) | 16th-century Latin cipher; J=0, V=0, others 1–24 |
| 4 | English Test | Test encoding: A=0, E=100, otherwise normal values |

The English (simple) encoding is the default.

Each encoding is defined in `encodings.json` as a 26-element values array (index 0 = A, index 25 = Z).

---

## Files

| File | Purpose |
|---|---|
| `wordscore.js` | CLI: scores words passed as arguments |
| `wordfind.js` | CLI: scores words, supports subtract words, searches lexicon for matching combinations |
| `lib.js` | Shared library used by both CLI tools and the web server |
| `server.js` | Express web server |
| `public/index.html` | Browser UI |
| `encodings.json` | Encoding definitions (id, name, values array) |
| `google-10000-english.txt` | Main lexicon: Google's 10,000 most common English words (frequency-sorted) |
| `shortwords.txt` | Curated 1–3 letter words and well-known initialisms; edit freely to add/remove words |

Earlier intermediate versions (`wordmatch.js`, `wordmatch2.js`) were stepping stones and are superseded by `wordfind.js`.

---

## Lexicon

The lexicon is built from two sources:

**`google-10000-english.txt`** — the Google 10,000 most common English words (frequency-sorted), from:

> https://github.com/first20hours/google-10000-english

Only the top 7,500 entries are used (the tail contains obscure foreign words and acronyms). Words with fewer than 4 letters are excluded from this file entirely. Words that have no vowels (e.g. `http`, `hdtv`) or no consonants (e.g. `ieee`) are also filtered out.

**`shortwords.txt`** — a hand-curated list of 1–3 letter words and well-known initialisms. Edit this file freely to add or remove words; no code change needed. It currently includes:
- 1-letter: `a`, `i`
- 2-letter common words: `me`, `to`, `is`, `be`, `of`, `we`, `he`, `do`, `go`, etc.
- 3-letter common words: `the`, `and`, `for`, `are`, `you`, `can`, `she`, `who`, etc.
- Initialisms: `usa`, `fbi`, `cia`, `nsa`, `nba`, `bbc`, `dna`, `gps`, `irs`, `phd`, etc.

The combined lexicon is ~9,000 words. The smaller, higher-quality list produces much more recognisable example combinations and runs noticeably faster than the previous 20,000-word list.

---

## Command-line tools

### wordscore.js

Scores each word passed as an argument, then prints a total.

```
node wordscore.js <word> [word ...] [/encodingId]
```

**Example:**
```
$ node wordscore.js Hello World
Encoding: English (simple)
Hello: 52
World: 72
total: 124

$ node wordscore.js Hello World /2
Encoding: Transliterated Hebrew
Hello: 52
World: 1072
total: 1124
```

---

### wordfind.js

Scores words and searches the lexicon for single words or combinations of 2–8 words with the same total score. Words prefixed with `-` are **subtract words** — their scores are deducted from the total before searching.

```
node wordfind.js <word> [...] [-word ...] [/encodingId]
```

**Examples:**

```
$ node wordfind.js Hello World
Encoding: English (simple)
Hello: 52
World: 72
total: 124

Lexicon combinations with score 124:
  1 word: 101
    occurrences
    filtration
    ...
  2 words: 1,420,739
    milk super
    faire matrix
    ...
  ...
  total: 901,026,543,276,368
```

With subtract words:
```
$ node wordfind.js Hello World -an -apple
Hello: 52
World: 72
total: 124

-an: 15
-apple: 50
total: -65

net total: 59

Lexicon combinations with score 59:
  1 word: 195
    an apple meridia
    an apple lemon
    ...
```

**Subtract word rules:**
- Subtract words are prefixed with `-` on the command line, e.g. `-test` or `-52`
- Their scores are shown as negative
- The search uses the net total (plus total minus subtract total)
- If the subtract total is greater than or equal to the plus total, the program exits with an error
- Subtract words are prepended to every example line so you can read the full phrase
- A subtract token that is all digits (e.g. `-52`) subtracts that number directly

**Output behaviour:**
- For each word count (1–8 words), shows the number of matching combinations
- Shows up to 30 examples for 1-word and 2-word results; up to 8 for 3-word and 4-word results; no examples for 5–8 words
- If the total number of combinations is at or below the example limit, all combinations are listed without repeating
- Combinations are **unordered** (so "hello world" and "world hello" count as one) and use **distinct words** (no word repeated)

**Limits:**
- `MAX_TOTAL` environment variable caps the maximum net total the CLI will process (default: 10,000). Set higher if needed: `MAX_TOTAL=50000 node wordfind.js ...`

---

## How the combination counting works

Counting combinations directly would be impossibly slow — for a score of 124, there are over 5 trillion 6-word combinations. Instead the algorithm uses dynamic programming over **score groups**:

1. The lexicon words are grouped by their score (e.g. all words scoring 50 form one group)
2. A DP table tracks: *how many ways can I choose k distinct words with total score s?*
3. For each score group with `n` words, choosing `j` words from it contributes `C(n, j)` combinations (binomial coefficient), without ever enumerating the actual words
4. This runs in milliseconds regardless of how large the counts are

Counts are stored as JavaScript `BigInt` values since they easily exceed JavaScript's safe integer range (the 6-word count for a typical input runs into the quadrillions).

**Random example generation** uses a suffix-DP random walk:

1. Score groups are sorted and suffix DPs are built — `suffixDps[i]` is the DP table built from groups `i..n`, capturing how many valid completions exist from that point onward
2. To sample one combination, the algorithm walks forward through score groups; at each group it chooses how many words to take (0 to min(group size, remaining k)) with probability proportional to `C(group_size, j) × suffixDps[i+1][remaining_k - j][remaining_score - j×score]`
3. Words are then picked randomly from the chosen score buckets

This approach samples uniformly at random without ever enumerating all combinations, and replaces an earlier approach that stored all score partitions in memory (which caused out-of-memory crashes for k=5 and k=6 on Render's 512MB free tier).

If the total count is small enough to enumerate exhaustively (at or below the example limit), all combinations are listed rather than sampling.

Examples are only shown for k=1 to k=4. Counts for 5–8 words are computed and displayed but examples are not generated — short-word results at high k tend to be uninteresting.

---

## Web server

The web UI provides the same functionality as `wordfind.js` in a browser, with live scoring as you type and collapsible example sections.

### Starting the server locally

```
node server.js
```

Then open `http://localhost:3000` in a browser. Stop with `Ctrl+C`.

### Deployment

The app is deployed on [Render](https://render.com) connected to the GitHub repository. Every push to the `main` branch triggers an automatic redeploy.

Render configuration:
- **Plan:** Free tier (512MB RAM)
- **Build command:** `npm install`
- **Start command:** `node server.js`
- The server reads its port from `process.env.PORT` (set by Render), falling back to 3000 for local use
- Free tier spins down after 15 minutes of inactivity; the first request after spin-down takes a few seconds to start

### Memory management

The server's memory footprint is carefully bounded to stay within Render's 512MB free tier:

**At startup:** one score map per encoding is prebuilt and held in memory (~10MB total for 4 encodings × ~9k words).

**Cache:** combination counts (8 BigInt strings) are cached per `encodingId:netTotal` key. The counts are tiny and accumulate without eviction — this is fine because they're just strings.

**Suffix DPs are NOT cached.** The suffix DP tables required for example generation are O(numGroups × MAX_K × netTotal) in size. For a Hebrew encoding search at T=1157 this is roughly 4 million BigInt entries (~400MB) — caching even a handful would exhaust available RAM. Instead, suffix DPs are rebuilt fresh for each `/api/examples` call and garbage collected immediately afterwards.

**Example generation limit:** if `netTotal > EXAMPLES_TOTAL_LIMIT` (default: 1000, overridable via the `EXAMPLES_TOTAL_LIMIT` environment variable), example generation is skipped entirely and the UI shows "examples not available (score too large)". Combination counts still work for any total up to `MAX_TOTAL`. This prevents a single large-score search from using hundreds of MB during the suffix DP build.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | HTTP port (set automatically by Render) |
| `MAX_TOTAL` | 10000 | Maximum net total the server will process |
| `EXAMPLES_TOTAL_LIMIT` | 1000 | Maximum net total for which examples are generated |

### API endpoints

All endpoints accept and return JSON.

#### `GET /api/config`
Returns server configuration so the UI can enforce the same limits.

**Response:**
```json
{ "maxTotal": 10000 }
```

#### `GET /api/encodings`
Returns the list of available encodings.

**Response:**
```json
[
  { "id": 1, "name": "English (simple)" },
  { "id": 2, "name": "Transliterated Hebrew" },
  ...
]
```

#### `POST /api/score`
Scores words without running the lexicon search. Called on every keystroke for live feedback.

**Request:**
```json
{ "plusWords": ["Hello", "World"], "minusWords": ["an"], "encodingId": 1 }
```
**Response:**
```json
{
  "plusScores": [{"word": "Hello", "score": 52}, {"word": "World", "score": 72}],
  "minusScores": [{"word": "an", "score": 15}],
  "plusTotal": 124,
  "minusTotal": 15,
  "netTotal": 109
}
```

#### `POST /api/search`
Runs the full DP and returns combination counts for all word lengths 1–8. Returns HTTP 400 if netTotal exceeds `MAX_TOTAL`.

**Request:**
```json
{ "plusWords": ["Hello", "World"], "minusWords": ["an"], "encodingId": 1 }
```
**Response:**
```json
{
  "plusScores": [...],
  "minusScores": [...],
  "plusTotal": 124,
  "minusTotal": 15,
  "netTotal": 109,
  "counts": { "1": "87", "2": "1189432", "3": "...", "4": "...", "5": "...", "6": "...", "7": "...", "8": "..." },
  "encodingName": "English (simple)"
}
```
Counts are returned as strings to preserve BigInt precision.

#### `POST /api/examples`
Returns up to 30 examples for k=1 and k=2, up to 15 for k=3 and k=4. Also returns the `exampleCount` used so the UI can display "showing N of total" accurately. Called once per section when expanded, and again on More… clicks. Returns an empty array for k > 4. Returns `{ "examples": [], "scoreTooLarge": true }` if netTotal exceeds `EXAMPLES_TOTAL_LIMIT`.

**Request:**
```json
{ "netTotal": 109, "k": 2, "encodingId": 1 }
```
**Response:**
```json
{ "examples": [["milk", "super"], ["faire", "matrix"], ...] }
```

### UI features

- **Encoding selector** — dropdown in the search row; changing encoding re-scores live
- **Live scoring** — totals update as you type, before hitting Search
- **Search disabled** when netTotal exceeds the server's `MAX_TOTAL` limit (shown in red)
- **Subtract words** — enter in the second field; their scores are deducted and they appear in pink before every example
- **Collapsible sections** — one section per word count (1–8), click the header to expand/collapse
- **k=1 auto-expanded** on each search
- **Examples for k=1–4 only** — 5–8-word counts are shown but no examples are generated
- **Two-column layout** for 1-word and 2-word example lists (30 examples each)
- **"examples not available (score too large)"** shown for k=1–4 when netTotal > EXAMPLES_TOTAL_LIMIT
- **More… button** — fetches a fresh set of random examples for that word count
- **Mobile friendly** — layout adapts to narrow screens; Encoding dropdown and Search button wrap to separate lines on very narrow viewports
- **Footer** — attribution and links to website, LinkedIn, and GitHub

### Dependencies

```
npm install express
```

No other dependencies. Node.js built-ins handle everything else.

---

## What is Gematria?

Gematria is the practice of assigning numeric values to letters and words, then claiming that words or phrases with equal scores have a hidden mystical connection. This tool lets you quickly find how many random word combinations share any given score — typically millions or billions — demonstrating that score matches are numerically inevitable rather than meaningful.
