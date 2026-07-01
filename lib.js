const fs = require('fs');

function scoreWord(word) {
  let total = 0;
  for (const ch of word) {
    const code = ch.toUpperCase().charCodeAt(0);
    if (code >= 65 && code <= 90) total += code - 64;
  }
  return total;
}

function comb(n, k) {
  if (k > n || k < 0) return 0n;
  if (k === 0) return 1n;
  let r = 1n;
  for (let i = 0; i < k; i++) r = r * BigInt(n - i) / BigInt(i + 1);
  return r;
}

function loadLexicon(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const scoreWords = new Map();
  for (const w of lines) {
    const s = scoreWord(w);
    if (s > 0) {
      if (!scoreWords.has(s)) scoreWords.set(s, []);
      scoreWords.get(s).push(w);
    }
  }
  return scoreWords;
}

// Sorted array of [score, wordList] pairs for scores <= T
function buildGroups(scoreWords, T) {
  return [...scoreWords.entries()]
    .filter(([s]) => s <= T)
    .sort(([a], [b]) => a - b);
}

function buildDP(scoreWords, T, MAX_K) {
  let dp = Array.from({ length: MAX_K + 1 }, () => new Map());
  dp[0].set(0, 1n);
  for (const [groupScore, groupWordList] of scoreWords) {
    if (groupScore > T) continue;
    const groupCount = groupWordList.length;
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
  return dp;
}

// Suffix DPs: suffixDps[i] is the DP built from groups[i..n-1].
// Used for memory-efficient random sampling — instead of enumerating all
// score partitions (which can be millions for k=5/6), we do a random walk
// through the groups, at each step choosing how many words to take based
// on how many valid completions remain (read from the suffix DP).
function buildSuffixDPs(groups, T, MAX_K) {
  const n = groups.length;
  const suffixDps = new Array(n + 1);

  // Base: no groups left, only one state (0 words, score 0)
  suffixDps[n] = Array.from({ length: MAX_K + 1 }, () => new Map());
  suffixDps[n][0].set(0, 1n);

  for (let i = n - 1; i >= 0; i--) {
    const [groupScore, groupWordList] = groups[i];
    const groupCount = groupWordList.length;
    const prev = suffixDps[i + 1];
    const cur = Array.from({ length: MAX_K + 1 }, () => new Map());

    for (let pk = 0; pk <= MAX_K; pk++) {
      for (const [ps, pc] of prev[pk]) {
        for (let j = 0; j <= Math.min(groupCount, MAX_K - pk); j++) {
          const ns = ps + j * groupScore;
          if (ns > T) break;
          const nk = pk + j;
          const add = pc * comb(groupCount, j);
          cur[nk].set(ns, (cur[nk].get(ns) || 0n) + add);
        }
      }
    }
    suffixDps[i] = cur;
  }

  return suffixDps;
}

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

// Sample one random k-combination summing to T via random walk through groups
function sampleOne(groups, T, k, suffixDps) {
  const words = [];
  let remK = k;
  let remScore = T;

  for (let i = 0; i < groups.length && remK > 0; i++) {
    const [groupScore, groupWordList] = groups[i];
    const groupCount = groupWordList.length;
    const next = suffixDps[i + 1];

    // Weight of picking j words from this group = C(groupCount,j) * suffixDps[i+1][remK-j][remScore-j*groupScore]
    const weights = [];
    for (let j = 0; j <= Math.min(groupCount, remK); j++) {
      const ns = remScore - j * groupScore;
      if (ns < 0) break;
      const nk = remK - j;
      const suffix = next[nk]?.get(ns) ?? 0n;
      weights.push(comb(groupCount, j) * suffix);
    }

    const totalW = weights.reduce((a, b) => a + b, 0n);
    if (totalW === 0n) continue;

    // Pick j with probability proportional to weights
    let r = BigInt(Math.floor(Math.random() * Number(totalW)));
    let j = 0;
    for (; j < weights.length - 1; j++) {
      if (r < weights[j]) break;
      r -= weights[j];
    }

    if (j > 0) {
      words.push(...pickRandom(groupWordList, j));
      remK -= j;
      remScore -= j * groupScore;
    }
  }

  return words;
}

// Enumerate all word combinations for a sorted score partition (for small counts)
function allFromPartition(partition, scoreWords) {
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
      for (let x = start; x < ws.length; x++) pick(x + 1, chosen.concat(ws[x]));
    }
    pick(0, []);
  }
  recurse(0, []);
  return results;
}

// Enumerate all score partitions of T into exactly k parts (for exhaustive small-count listing)
function allScorePartitions(k, T, scoreWords) {
  const scores = [...scoreWords.keys()].filter(s => s <= T).sort((a, b) => a - b);
  const partitions = [];
  function recurse(remaining, minIdx, current) {
    if (current.length === k) {
      if (remaining === 0) partitions.push([...current]);
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
  return partitions;
}

// Get up to `count` examples for k-combinations summing to T.
// Uses suffix-DP random walk for sampling (no large partition arrays).
// Falls back to exhaustive listing when total combinations <= count.
function getExamples(k, T, scoreWords, count, groups, suffixDps, totalCount) {
  if (totalCount === 0n) return [];

  if (totalCount <= BigInt(count)) {
    // Enumerate all combinations exactly
    const all = [];
    for (const partition of allScorePartitions(k, T, scoreWords)) {
      all.push(...allFromPartition(partition, scoreWords));
    }
    return all;
  }

  return Array.from({ length: count }, () => sampleOne(groups, T, k, suffixDps));
}

module.exports = { scoreWord, loadLexicon, buildGroups, buildDP, buildSuffixDPs, getExamples };
