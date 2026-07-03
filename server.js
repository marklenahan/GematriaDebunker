const express = require('express');
const path = require('path');
const { loadEncodings, scoreWord, loadLexiconWords, buildScoreMap, buildGroups, buildDP, buildSuffixDPs, getExamples } = require('./lib');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MAX_K = 8;
const EXAMPLES_BY_K = { 1: 30, 2: 30, 3: 15, 4: 15 };
const MAX_TOTAL = parseInt(process.env.MAX_TOTAL) || 10000;
// Above this total, skip example generation to avoid OOM (suffix DPs are O(n × k × T))
const EXAMPLES_TOTAL_LIMIT = parseInt(process.env.EXAMPLES_TOTAL_LIMIT) || 1000;

console.log('Loading encodings and lexicon...');
const encodings = loadEncodings(path.join(__dirname, 'encodings.json'));
const lexiconWords = loadLexiconWords(
  path.join(__dirname, 'google-10000-english.txt'),
  path.join(__dirname, 'shortwords.txt')
);

// Pre-build a score map for each encoding at startup
const scoreWordsMaps = new Map();
for (const enc of encodings) {
  scoreWordsMaps.set(enc.id, buildScoreMap(lexiconWords, enc));
  console.log(`  Encoding ${enc.id} (${enc.name}): ${scoreWordsMaps.get(enc.id).size} distinct scores`);
}

// Cache only combination counts per encodingId:netTotal — suffix DPs are NOT cached
// because they are O(n × k × T) and would exhaust RAM after a handful of searches.
const searchCache = new Map();

function getOrBuildCache(encodingId, netTotal) {
  const key = `${encodingId}:${netTotal}`;
  if (!searchCache.has(key)) {
    const scoreWords = scoreWordsMaps.get(encodingId);
    const dp = buildDP(scoreWords, netTotal, MAX_K);
    const counts = {};
    for (let k = 1; k <= MAX_K; k++) {
      counts[k] = (dp[k].get(netTotal) || 0n).toString();
    }
    searchCache.set(key, { counts });
  }
  return searchCache.get(key);
}

function resolveEncoding(encodingId) {
  const id = parseInt(encodingId) || encodings[0].id;
  return encodings.find(e => e.id === id) || encodings[0];
}

// Expose server config to the UI
app.get('/api/config', (req, res) => {
  res.json({ maxTotal: MAX_TOTAL });
});

// List available encodings (id and name only)
app.get('/api/encodings', (req, res) => {
  res.json(encodings.map(({ id, name }) => ({ id, name })));
});

// Score words without running the full search
app.post('/api/score', (req, res) => {
  const { plusWords = [], minusWords = [], encodingId } = req.body;
  const encoding = resolveEncoding(encodingId);
  const plusScores = plusWords.map(w => ({ word: w, score: scoreWord(w, encoding) }));
  const minusScores = minusWords.map(w => ({ word: w, score: scoreWord(w, encoding) }));
  const plusTotal = plusScores.reduce((s, x) => s + x.score, 0);
  const minusTotal = minusScores.reduce((s, x) => s + x.score, 0);
  const netTotal = plusTotal - minusTotal;
  res.json({ plusScores, minusScores, plusTotal, minusTotal, netTotal });
});

// Run the DP and return combination counts
app.post('/api/search', (req, res) => {
  const { plusWords = [], minusWords = [], encodingId } = req.body;
  const encoding = resolveEncoding(encodingId);
  const plusScores = plusWords.map(w => ({ word: w, score: scoreWord(w, encoding) }));
  const minusScores = minusWords.map(w => ({ word: w, score: scoreWord(w, encoding) }));
  const plusTotal = plusScores.reduce((s, x) => s + x.score, 0);
  const minusTotal = minusScores.reduce((s, x) => s + x.score, 0);
  const netTotal = plusTotal - minusTotal;

  if (netTotal <= 0) {
    return res.status(400).json({ error: 'Net total must be greater than zero.' });
  }
  if (netTotal > MAX_TOTAL) {
    return res.status(400).json({ error: `Net total ${netTotal.toLocaleString()} exceeds the maximum allowed value of ${MAX_TOTAL.toLocaleString()}.` });
  }

  const { counts } = getOrBuildCache(encoding.id, netTotal);
  res.json({ plusScores, minusScores, plusTotal, minusTotal, netTotal, counts, encodingName: encoding.name });
});

// Return fresh examples for a specific k
app.post('/api/examples', (req, res) => {
  const { netTotal, k, encodingId } = req.body;
  if (!netTotal || !k || netTotal <= 0) {
    return res.status(400).json({ error: 'Invalid netTotal or k.' });
  }
  if (k > 4) return res.json({ examples: [] });
  if (netTotal > EXAMPLES_TOTAL_LIMIT) return res.json({ examples: [], scoreTooLarge: true });

  const encoding = resolveEncoding(encodingId);
  const { counts } = getOrBuildCache(encoding.id, netTotal);
  const scoreWords = scoreWordsMaps.get(encoding.id);
  const groups = buildGroups(scoreWords, netTotal);
  const suffixDps = buildSuffixDPs(groups, netTotal, MAX_K);
  const totalCount = BigInt(counts[k] || '0');
  const exampleCount = EXAMPLES_BY_K[k] || 15;
  const examples = getExamples(k, netTotal, scoreWords, exampleCount, groups, suffixDps, totalCount);
  res.json({ examples, exampleCount });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
