#!/usr/bin/env node

function scoreWord(word) {
  let total = 0;
  for (const ch of word) {
    const code = ch.toUpperCase().charCodeAt(0);
    if (code >= 65 && code <= 90) {
      total += code - 64;
    }
  }
  return total;
}

const words = process.argv.slice(2);

if (words.length === 0) {
  console.error('Usage: wordscore <word> [word ...]');
  process.exit(1);
}

let total = 0;
for (const word of words) {
  const score = scoreWord(word);
  total += score;
  console.log(`${word}: ${score}`);
}
console.log(`total: ${total}`);
