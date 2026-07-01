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

function partitionWeight(partition, scoreWords) {
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

function buildWeightedPartitions(k, T, scoreWords) {
  const scores = [...scoreWords.keys()].filter(s => s <= T).sort((a, b) => a - b);
  const pairs = [];

  function recurse(remaining, minIdx, current) {
    if (current.length === k) {
      if (remaining === 0) {
        const w = partitionWeight(current, scoreWords);
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

function sampleFromPartition(partition, scoreWords) {
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

function getExamples(k, T, scoreWords, count) {
  const pairs = buildWeightedPartitions(k, T, scoreWords);
  if (pairs.length === 0) return [];
  const total = pairs.reduce((s, [, w]) => s + w, 0n);
  if (total === 0n) return [];
  if (total <= BigInt(count)) {
    const all = [];
    for (const [partition] of pairs) all.push(...allFromPartition(partition, scoreWords));
    return all;
  }
  return Array.from({ length: count }, () => sampleFromPartition(weightedSample(pairs), scoreWords));
}

module.exports = { scoreWord, loadLexicon, buildDP, getExamples };
