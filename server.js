const express = require('express');
const path = require('path');
const { scoreWord, loadLexicon, buildGroups, buildDP, buildSuffixDPs, getExamples } = require('./lib');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MAX_K = 6;
const EXAMPLES = 15;

console.log('Loading lexicon...');
const scoreWords = loadLexicon(path.join(__dirname, '20k.txt'));
console.log(`Lexicon loaded: ${[...scoreWords.values()].reduce((a, b) => a + b.length, 0)} words across ${scoreWords.size} scores.`);

// Cache DP results and suffix DPs per netTotal so repeated searches and
// multiple /api/examples calls for the same total don't recompute everything.
const searchCache = new Map();

function getOrBuildCache(netTotal) {
  if (!searchCache.has(netTotal)) {
    const groups = buildGroups(scoreWords, netTotal);
    const dp = buildDP(scoreWords, netTotal, MAX_K);
    const suffixDps = buildSuffixDPs(groups, netTotal, MAX_K);
    const counts = {};
    for (let k = 1; k <= MAX_K; k++) {
      counts[k] = (dp[k].get(netTotal) || 0n).toString();
    }
    searchCache.set(netTotal, { groups, suffixDps, counts });
  }
  return searchCache.get(netTotal);
}

// Score words without running the full search
app.post('/api/score', (req, res) => {
  const { plusWords = [], minusWords = [] } = req.body;
  const plusScores = plusWords.map(w => ({ word: w, score: scoreWord(w) }));
  const minusScores = minusWords.map(w => ({ word: w, score: scoreWord(w) }));
  const plusTotal = plusScores.reduce((s, x) => s + x.score, 0);
  const minusTotal = minusScores.reduce((s, x) => s + x.score, 0);
  const netTotal = plusTotal - minusTotal;
  res.json({ plusScores, minusScores, plusTotal, minusTotal, netTotal });
});

// Run the DP and return combination counts
app.post('/api/search', (req, res) => {
  const { plusWords = [], minusWords = [] } = req.body;
  const plusScores = plusWords.map(w => ({ word: w, score: scoreWord(w) }));
  const minusScores = minusWords.map(w => ({ word: w, score: scoreWord(w) }));
  const plusTotal = plusScores.reduce((s, x) => s + x.score, 0);
  const minusTotal = minusScores.reduce((s, x) => s + x.score, 0);
  const netTotal = plusTotal - minusTotal;

  if (netTotal <= 0) {
    return res.status(400).json({ error: 'Net total must be greater than zero.' });
  }

  const { counts } = getOrBuildCache(netTotal);
  res.json({ plusScores, minusScores, plusTotal, minusTotal, netTotal, counts });
});

// Return fresh examples for a specific k
app.post('/api/examples', (req, res) => {
  const { netTotal, k } = req.body;
  if (!netTotal || !k || netTotal <= 0) {
    return res.status(400).json({ error: 'Invalid netTotal or k.' });
  }

  if (k > 4) return res.json({ examples: [] });

  const { groups, suffixDps, counts } = getOrBuildCache(netTotal);
  const totalCount = BigInt(counts[k] || '0');
  const examples = getExamples(k, netTotal, scoreWords, EXAMPLES, groups, suffixDps, totalCount);
  res.json({ examples });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
