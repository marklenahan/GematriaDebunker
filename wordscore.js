#!/usr/bin/env node
const path = require('path');
const { loadEncodings, scoreWord } = require('./lib');

const encodings = loadEncodings(path.join(__dirname, 'encodings.json'));

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: wordscore <word> [word ...] [/encodingId]');
  process.exit(1);
}

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

const words = args.filter(a => !a.startsWith('/'));
if (words.length === 0) {
  console.error('Usage: wordscore <word> [word ...] [/encodingId]');
  process.exit(1);
}

console.log(`Encoding: ${encoding.name}`);
let total = 0;
for (const word of words) {
  const score = scoreWord(word, encoding);
  total += score;
  console.log(`${word}: ${score}`);
}
console.log(`total: ${total}`);
