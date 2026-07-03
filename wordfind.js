#!/usr/bin/env node
const path = require('path');
const { loadEncodings, scoreWord, loadLexiconWords, buildScoreMap, buildGroups, buildDP, buildSuffixDPs, getExamples } = require('./lib');

const MAX_K = 8;
const EXAMPLES_BY_K = { 1: 30, 2: 30, 3: 8, 4: 8 };
const MAX_TOTAL = parseInt(process.env.MAX_TOTAL) || 10000;

const encodings = loadEncodings(path.join(__dirname, 'encodings.json'));

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: wordfind <word> [...] [-word ...] [/encodingId]');
  process.exit(1);
}

// Parse encoding selector (/N), plus words, and minus words
const encodingArg = args.find(a => a.startsWith('/'));
let encoding = encodings[0];
if (encodingArg) {
  const id = parseInt(encodingArg.slice(1));
  const found = encodings.find(e => e.id === id);
  if (!found) {
    console.error(`Unknown encoding ID: ${id}. Available: ${encodings.map(e => `${e.id} (${e.name})`).join(', ')}`);
    process.exit(1);
  }
  encoding = found;
}

const wordArgs = args.filter(a => !a.startsWith('/'));
const plusWords = wordArgs.filter(a => !a.startsWith('-'));
const minusWords = wordArgs.filter(a => a.startsWith('-')).map(a => a.slice(1));

if (plusWords.length === 0) {
  console.error('Error: no positive words provided.');
  process.exit(1);
}

console.log(`Encoding: ${encoding.name}`);
console.log();

let plusTotal = 0;
for (const word of plusWords) {
  const score = scoreWord(word, encoding);
  plusTotal += score;
  console.log(`${word}: ${score}`);
}
console.log(`total: ${plusTotal}`);

let minusTotal = 0;
if (minusWords.length > 0) {
  console.log();
  for (const word of minusWords) {
    const score = scoreWord(word, encoding);
    minusTotal += score;
    console.log(`-${word}: ${score}`);
  }
  console.log(`total: -${minusTotal}`);
}

if (minusTotal >= plusTotal) {
  console.error(`\nError: minus total (${minusTotal}) is greater than or equal to plus total (${plusTotal}).`);
  process.exit(1);
}

const T = plusTotal - minusTotal;

if (T > MAX_TOTAL) {
  console.error(`\nError: net total ${T.toLocaleString()} exceeds the maximum allowed value of ${MAX_TOTAL.toLocaleString()}.`);
  process.exit(1);
}

if (minusWords.length > 0) console.log(`\nnet total: ${T}`);
console.log();

const lexiconWords = loadLexiconWords(
  path.join(__dirname, 'google-10000-english.txt'),
  path.join(__dirname, 'shortwords.txt')
);
const scoreWords = buildScoreMap(lexiconWords, encoding);
const groups = buildGroups(scoreWords, T);
const dp = buildDP(scoreWords, T, MAX_K);
const suffixDps = buildSuffixDPs(groups, T, MAX_K);

const prefix = minusWords.length > 0 ? minusWords.join(' ') + ' ' : '';

let grand = 0n;
console.log(`Lexicon combinations with score ${T}:`);
for (let k = 1; k <= MAX_K; k++) {
  const count = dp[k].get(T) || 0n;
  console.log(`  ${k} word${k > 1 ? 's' : ''}: ${count.toLocaleString()}`);
  if (count > 0n) {
    const examples = getExamples(k, T, scoreWords, EXAMPLES_BY_K[k] || 0, groups, suffixDps, count);
    for (const ex of examples) {
      console.log(`    ${prefix}${ex.join(' ')}`);
    }
  }
  grand += count;
}
console.log(`  total: ${grand.toLocaleString()}`);
