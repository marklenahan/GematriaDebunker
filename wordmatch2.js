#!/usr/bin/env node
const fs = require('fs');

function scoreWord(word) {
  let total = 0;
  for (const ch of word) {
    const code = ch.toUpperCase().charCodeAt(0);
    if (code >= 65 && code <= 90) total += code - 64;
  }
  return total;
}

const words = process.argv.slice(2);
if (words.length === 0) {
  console.error('Usage: wordmatch <word> [word ...]');
  process.exit(1);
}

let inputTotal = 0;
for (const word of words) {
  const score = scoreWord(word);
  inputTotal += score;
  console.log(`${word}: ${score}`);
}
console.log(`total: ${inputTotal}`);
console.log();

const T = inputTotal;
const MAX_K = 6;
const EXAMPLES = 8;

// Load lexicon and build score -> word list map (only scores <= T are useful)
const lexiconLines = fs.readFileSync(`${__dirname}/20k.txt`, 'utf8').trim().split('\n');
const scoreWords = new Map();
for (const w of lexiconLines) {
  const s = scoreWord(w);
  if (s > 0 && s <= T) {
    if (!scoreWords.has(s)) scoreWords.set(s, []);
    scoreWords.get(s).push(w);
  }
}

// C(n, k) using BigInt
function comb(n, k) {
  if (k > n || k < 0) return 0n;
  if (k === 0) return 1n;
  let r = 1n;
  for (let i = 0; i < k; i++) r = r * BigInt(n - i) / BigInt(i + 1);
  return r;
}

// DP: dp[k] = Map<score, BigInt count of unordered k-combinations>
let dp = Array.from({ length: MAX_K + 1 }, () => new Map());
dp[0].set(0, 1n);
for (const [groupScore, groupWords] of scoreWords) {
  const groupCount = groupWords.length;
  const newDp = Array.from({ length: MAX_K + 1 }, () => new Map());
  for (let prevK = 0; prevK <= MAX_K; prevK++) {
    for (const [prevScore, prevCount] of dp[prevK]) {
      for (let j = 0; j <= Math.min(groupCount, MAX_K - prevK); j++) {
        const newScore = prevScore + j * groupScore;
        if (newScore > T) break;
        const newK = prevK + j;
        const add = prevCount * comb(groupCount, j);
        newDp[newK].set(newScore, (newDp[newK].get(newScore) || 0n) + add);
      }
    }
  }
  dp = newDp;
}

// --- Sampling ---

// Pick n distinct random elements from arr via partial Fisher-Yates
function pickRandom(arr, n) {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < n && i < copy.length; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
}

// Number of unordered word combos for a sorted score partition
function partitionWeight(partition) {
  let w = 1n;
  let i = 0;
  while (i < partition.length) {
    const s = partition[i];
    let j = i;
    while (j < partition.length && partition[j] === s) j++;
    w *= comb(scoreWords.get(s)?.length ?? 0, j - i);
    if (w === 0n) return 0n;
    i = j;
  }
  return w;
}

// Pick random words matching a sorted score partition
function sampleFromPartition(partition) {
  const result = [];
  let i = 0;
  while (i < partition.length) {
    const s = partition[i];
    let j = i;
    while (j < partition.length && partition[j] === s) j++;
    result.push(...pickRandom(scoreWords.get(s) ?? [], j - i));
    i = j;
  }
  return result;
}

// Weighted sample from [[item, BigInt weight]] pairs
function weightedSample(pairs) {
  const floats = pairs.map(([, w]) => Number(w));
  const total = floats.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pairs.length; i++) {
    r -= floats[i];
    if (r <= 0) return pairs[i][0];
  }
  return pairs[pairs.length - 1][0];
}

// Enumerate all sorted k-partitions of T using available scores, with weights
function buildWeightedPartitions(k) {
  const scores = [...scoreWords.keys()].sort((a, b) => a - b);
  const pairs = [];

  function recurse(remaining, minIdx, current) {
    if (current.length === k) {
      if (remaining === 0) {
        const w = partitionWeight(current);
        if (w > 0n) pairs.push([[...current], w]);
      }
      return;
    }
    for (let i = minIdx; i < scores.length; i++) {
      const s = scores[i];
      if (s > remaining) break;
      current.push(s);
      recurse(remaining - s, i, current);
      current.pop();
    }
  }

  recurse(T, 0, []);
  return pairs;
}

// Enumerate every word combination for a sorted score partition
function allFromPartition(partition) {
  const groups = [];
  let i = 0;
  while (i < partition.length) {
    const s = partition[i];
    let j = i;
    while (j < partition.length && partition[j] === s) j++;
    groups.push([scoreWords.get(s) ?? [], j - i]);
    i = j;
  }

  const results = [];
  function recurse(gi, current) {
    if (gi === groups.length) { results.push([...current]); return; }
    const [ws, mult] = groups[gi];
    function pick(start, chosen) {
      if (chosen.length === mult) { recurse(gi + 1, current.concat(chosen)); return; }
      for (let x = start; x < ws.length; x++) {
        pick(x + 1, chosen.concat(ws[x]));
      }
    }
    pick(0, []);
  }
  recurse(0, []);
  return results;
}

// Get EXAMPLES random word combinations for k-combinations summing to T
function getExamples(k) {
  const pairs = buildWeightedPartitions(k);
  if (pairs.length === 0) return [];
  return Array.from({ length: EXAMPLES }, () => sampleFromPartition(weightedSample(pairs)));
}

// Get all word combinations when total count is small enough to enumerate
function getAllCombinations(k) {
  const pairs = buildWeightedPartitions(k);
  const all = [];
  for (const [partition] of pairs) all.push(...allFromPartition(partition));
  return all;
}

// Output
let grand = 0n;
console.log(`Lexicon combinations with score ${T}:`);
for (let k = 1; k <= MAX_K; k++) {
  const count = dp[k].get(T) || 0n;
  console.log(`  ${k} word${k > 1 ? 's' : ''}: ${count.toLocaleString()}`);
  if (count > 0n) {
    const examples = count <= EXAMPLES ? getAllCombinations(k) : getExamples(k);
    for (const ex of examples) {
      console.log(`    e.g. ${ex.join(' + ')}`);
    }
  }
  grand += count;
}
console.log(`  total: ${grand.toLocaleString()}`);
