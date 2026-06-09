const fs = require('fs');
const content = fs.readFileSync('script.js','utf8');
// Find the position after the last entry and before the reverse map
const revIdx = content.indexOf("// Build reverse map");
console.log("reverse map at:", revIdx);
// Go back to find the closing };
const beforeRev = content.substring(0, revIdx);
const lastClose = beforeRev.lastIndexOf("};");
console.log("closing at:", lastClose);
// Show context
console.log("Context:", JSON.stringify(content.substring(lastClose - 20, lastClose + 80)));
