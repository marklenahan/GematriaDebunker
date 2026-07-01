# Mark's Simple Gematria Debunker

A set of JavaScript tools for scoring words using alphabetic letter values (A=1, B=2, … Z=26), counting how many lexicon word combinations share a given total score, and generating random examples of those combinations.

---

## Scoring rules

- Each letter A–Z scores its position in the alphabet: A=1, B=2, C=3 … Z=26
- Upper and lower case score the same
- Non-alphabetic characters (spaces, punctuation, numbers) are ignored and score zero
- A word's score is the sum of its letter scores
- A phrase's score is the sum of its word scores

---

## Files

| File | Purpose |
|---|---|
| `wordscore.js` | CLI: scores words passed as arguments |
| `wordfind.js` | CLI: scores words, supports subtract words, searches lexicon for matching combinations |
| `lib.js` | Shared library used by the web server |
| `server.js` | Express web server |
| `public/index.html` | Browser UI |
| `20k.txt` | Lexicon: 20,000 common English words |

Earlier intermediate versions (`wordmatch.js`, `wordmatch2.js`) were stepping stones and are superseded by `wordfind.js`.

---

## Lexicon

The tools use the **Google 10,000 English** word list (the 20k variant), downloaded from:

> https://github.com/first20hours/google-10000-english

It contains 20,000 common English words, all lowercase, no proper nouns. This is stored locally as `20k.txt`.

The earlier `wordmatch.js` used the macOS system lexicon at `/usr/share/dict/words` (235,976 entries including proper nouns and obscure words). The Google list gives much more recognisable results.

---

## Command-line tools

### wordscore.js

Scores each word passed as an argument, then prints a total.

```
node wordscore.js <word> [word ...]
```

**Example:**
```
$ node wordscore.js Hello World
Hello: 52
World: 72
total: 124
```

---

### wordfind.js

Scores words and searches the lexicon for single words or combinations of 2–6 words with the same total score. Words prefixed with `-` are **subtract words** — their scores are deducted from the total before searching.

```
node wordfind.js <word> [...] [-word ...]
```

**Examples:**

```
$ node wordfind.js Hello World
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
- Subtract words are prefixed with `-` on the command line, e.g. `-test`
- Their scores are shown as negative
- The search uses the net total (plus total minus subtract total)
- If the subtract total is greater than or equal to the plus total, the program exits with an error
- Subtract words are prepended to every example line so you can read the full phrase

**Output behaviour:**
- For each word count (1–6 words), shows the number of matching combinations
- Shows up to 8 example combinations per word count
- If the total number of combinations for a word count is 8 or fewer, all combinations are listed without repeating
- Combinations are **unordered** (so "hello world" and "world hello" count as one) and use **distinct words** (no word repeated)

---

## How the combination counting works

Counting combinations directly would be impossibly slow — for a score of 124, there are over 5 trillion 6-word combinations. Instead the algorithm uses dynamic programming over **score groups**:

1. The lexicon words are grouped by their score (e.g. all words scoring 50 form one group)
2. A DP table tracks: *how many ways can I choose k distinct words with total score s?*
3. For each score group with `n` words, choosing `j` words from it contributes `C(n, j)` combinations (binomial coefficient), without ever enumerating the actual words
4. This runs in milliseconds regardless of how large the counts are

Counts are stored as JavaScript `BigInt` values since they easily exceed JavaScript's safe integer range (the 6-word count for a typical input runs into the quadrillions).

**Random example generation** works by:
1. Enumerating all *score partitions* that sum to the target (e.g. for 2-word combinations summing to 124: pairs like 50+74, 62+62, etc.)
2. Weighting each partition by how many word combinations it represents
3. Sampling a partition with probability proportional to its weight
4. Picking random words from each score bucket within that partition

If the total count is small enough to enumerate exhaustively (≤ 8 for the CLI, ≤ 15 for the web UI), all combinations are listed rather than sampling.

---

## Web server

The web UI provides the same functionality as `wordfind.js` in a browser, with live scoring as you type and collapsible example sections.

### Starting the server

```
node server.js
```

Then open `http://localhost:3000` in a browser. Stop with `Ctrl+C`.

### API endpoints

The server exposes three JSON endpoints:

#### `POST /api/score`
Scores words without running the lexicon search. Called on every keystroke for live feedback.

**Request:**
```json
{ "plusWords": ["Hello", "World"], "minusWords": ["an"] }
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
Runs the full DP and returns combination counts for all word lengths 1–6. Called when the user clicks Search.

**Request:**
```json
{ "plusWords": ["Hello", "World"], "minusWords": ["an"] }
```
**Response:**
```json
{
  "plusScores": [...],
  "minusScores": [...],
  "plusTotal": 124,
  "minusTotal": 15,
  "netTotal": 109,
  "counts": { "1": "87", "2": "1189432", "3": "...", "4": "...", "5": "...", "6": "..." }
}
```
Counts are returned as strings to preserve BigInt precision.

#### `POST /api/examples`
Returns 15 random example combinations for a specific word count. Called once per word-count section when expanded, and again when the user clicks More….

**Request:**
```json
{ "netTotal": 109, "k": 2 }
```
**Response:**
```json
{ "examples": [["milk", "super"], ["faire", "matrix"], ...] }
```

### UI features

- **Live scoring** — totals update as you type, before hitting Search
- **Subtract words** — enter in the second field; their scores are deducted and they appear in pink before every example
- **Collapsible sections** — one section per word count, click the header to expand/collapse
- **More… button** — fetches a fresh set of random examples for that word count
- **Mobile friendly** — layout adapts to narrow screens

### Dependencies

```
npm install express
```

No other dependencies. Node.js built-ins handle everything else.

---

## What is Gematria?

Gematria is the practice of assigning numeric values to letters and words, then claiming that words or phrases with equal scores have a hidden mystical connection. This tool lets you quickly find how many random word combinations share any given score — typically millions or billions — demonstrating that score matches are numerically inevitable rather than meaningful.
