const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf8');

const fromRe = /"from":\s*"([^"]+)"/g;
const toRe = /"to":\s*"([^"]+)"/g;

const locs = new Set();
let m;
while ((m = fromRe.exec(content)) !== null) locs.add(m[1]);
while ((m = toRe.exec(content)) !== null) locs.add(m[1]);

const sorted = Array.from(locs).sort();
console.log('Total unique locations:', sorted.length);
sorted.forEach(l => console.log(l));
