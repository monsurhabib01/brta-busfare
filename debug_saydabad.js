const fs = require('fs');
const content = fs.readFileSync('script.js', 'utf-8');

// Find LOCATION_EN
const locStart = content.indexOf('const LOCATION_EN = {');
const locEnd = content.indexOf('};', locStart);
const locEnSection = content.substring(locStart, locEnd + 2);

const lines = locEnSection.split('\n');
const saydabadKeys = lines.filter(l => l.includes('\u09B8\u09BE\u09DF') || l.includes('\u09B8\u09BE\u09AF'));
saydabadKeys.forEach(k => {
    const trimmed = k.trim();
    const key = trimmed.split(':')[0].trim().replace(/^'|'$/g, '');
    const val = trimmed.split(':')[1].trim().replace(/,$/, '');
    const codePoints = [...key].map(c => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
    const expected = '\u09A2\u09BE\u0995\u09BE (\u09B8\u09BE\u09DF\u09A6\u09BE\u09AC\u09BE\u09A6)';
    const isMatch = key === expected;
    fs.writeFileSync('debug_saydabad.txt',
        'Key: ' + key + '\nCodePoints: ' + codePoints.join(' ') + '\nValue: ' + val + '\nMatches expected: ' + isMatch + '\n\n',
        { flag: 'a' });
});

const routeLines = content.split('\n');
routeLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if ((trimmed.startsWith('"from":') || trimmed.startsWith('"to":')) &&
        (trimmed.includes('\u09B8\u09BE\u09DF') || trimmed.includes('\u09B8\u09BE\u09AF'))) {
        fs.writeFileSync('debug_saydabad.txt', 'Line ' + (idx + 1) + ': ' + trimmed + '\n', { flag: 'a' });
    }
});

console.log('Done');
