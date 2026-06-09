const fs = require('fs');

// Read the actual normalizeLocation function from script.js
const content = fs.readFileSync('script.js', 'utf-8');

// Find the function
const funcStart = content.indexOf('function normalizeLocation(name)');
const funcEnd = content.indexOf('function normalizeForCompare', funcStart);
const funcText = content.substring(funcStart, funcEnd);

// Extract the regex replacements
console.log('=== normalizeLocation function ===');

// Now test the function
function normalizeLocation(name) {
    let result = name.trim()
        .normalize('NFC')
        .replace(/(\S)\s*\(/g, '$1 (')
        .replace(/\s+\)/g, ')');
    result = result.replace(/সায়েদাবাদ/g, 'সায়দাবাদ');
    return result;
}

// Build all unique locations from ROUTES_DATA
// Find ROUTES_DATA start and end
const dataStart = content.indexOf('const ROUTES_DATA = [');
const dataEnd = content.indexOf('];', dataStart);
const dataText = content.substring(dataStart, dataEnd + 2);

// Extract all from/to values
const fromRegex = /"from": "([^"]+)"/g;
const toRegex = /"to": "([^"]+)"/g;

const froms = new Set();
const tos = new Set();
const allUnique = new Set();

let match;
while ((match = fromRegex.exec(dataText)) !== null) {
    const normalized = normalizeLocation(match[1]);
    froms.add(normalized);
    allUnique.add(normalized);
}
while ((match = toRegex.exec(dataText)) !== null) {
    const normalized = normalizeLocation(match[1]);
    tos.add(normalized);
    allUnique.add(normalized);
}

// Find all entries containing সায়দাবাদ or সায়েদাবাদ
const saydabadEntries = [...allUnique].filter(s => s.includes('\u09B8\u09BE\u09DF') || s.includes('\u09B8\u09BE\u09AF'));
console.log('Saydabad entries in allUniqueLocations:');
saydabadEntries.forEach(s => {
    console.log('  [' + [...s].map(c => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')).join(' ') + ']');
    console.log('  -> ' + s);
});

console.log('\nCount of Saydabad entries: ' + saydabadEntries.length);
console.log('Count of all unique locations: ' + allUnique.size);

// Write detailed results to file
const resultLines = [];
resultLines.push('Saydabad entries: ' + saydabadEntries.length);
saydabadEntries.forEach(s => {
    resultLines.push('  ' + s + ' [' + [...s].map(c => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')).join(' ') + ']');
});
resultLines.push('Total unique locations: ' + allUnique.size);
fs.writeFileSync('test_normalize_result.txt', resultLines.join('\n'), 'utf-8');
console.log('\nResults written to test_normalize_result.txt');
