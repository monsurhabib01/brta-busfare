const XLSX = require('xlsx');
const fs = require('fs');

const XLSX_PATH = 'Fare chart 2026_All in 1.xlsx';
const SCRIPT_PATH = 'script.js';
const ROUTES_JSON_PATH = 'routes_data.json';
const XLSX_TXT_PATH = 'xlsx_data.txt';
const XLSX_TXT_FULL_PATH = 'xlsx_data_full.txt';
const SW_PATH = 'sw.js';

function bnNumToEn(bnStr) {
    const map = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9','.':'.' };
    return String(bnStr).split('').map(c => map[c] || c).join('');
}

console.log('=== BRTA Fare Syncer ===\n');

// 1. Read xlsx
console.log('Reading xlsx...');
const wb = XLSX.readFile(XLSX_PATH);
const ws = wb.Sheets['Bus Fare_(51, 40, 36)'];
const data = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ''});
console.log('  Rows in xlsx:', data.length - 2);

// 2. Build xlsx route map keyed by Bengali route_no
const xlsxRoutes = {};
for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const routeNo = String(row[1] || '').trim();
    if (!routeNo) continue;
    xlsxRoutes[routeNo] = {
        distance: Math.round((row[3] || 0) * 10) / 10,
        fare_51: Math.round(row[16] || 0),
        fare_40: Math.round(row[17] || 0),
        desc: String(row[2] || ''),
        serial: row[0]
    };
}

// Also build by English route_no and numeric for lookup
function getRouteKeys(routeNo) {
    const keys = [routeNo];
    // Try English equivalent
    if (routeNo.startsWith('\u09A1\u09BF\u09A1\u09BF\u0986\u09B0')) {
        const num = routeNo.replace(/[^\d]/g, '');
        keys.push('DDR-' + num);
    } else {
        const num = routeNo.replace(/[^\d]/g, '');
        keys.push('HQ-' + num);
    }
    return keys;
}

// 3. Read script.js
console.log('Reading script.js...');
let scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');

// 4. Update DDR routes in script.js
console.log('\nUpdating DDR routes in script.js...');
let scriptUpdateCount = 0;

// For each DDR route in xlsx, find and update in script.js
for (const [routeNo, xRoute] of Object.entries(xlsxRoutes)) {
    if (!routeNo.includes('\u09A1\u09BF\u09A1\u09BF\u0986\u09B0')) continue; // Skip non-DDR
    
    const num = routeNo.replace(/[^\d]/g, '');
    const key = 'DDR-' + num;
    
    // Find the route object in script.js by route_no
    const escapedRouteNo = routeNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // First try exact match on the route_no line
    const routeRegex = new RegExp('("route_no"\\s*:\\s*"' + escapedRouteNo + '")');
    const routeMatch = scriptContent.match(routeRegex);
    
    if (!routeMatch) {
        console.log('  WARN: ' + key + ' not found in script.js - SKIPPING');
        continue;
    }
    
    const matchIdx = routeMatch.index;
    
    // Find the object boundaries: go back to find opening '{', forward to find closing '}'
    const objStart = scriptContent.lastIndexOf('{', matchIdx);
    const objEnd = scriptContent.indexOf('}', matchIdx) + 1;
    const oldObj = scriptContent.substring(objStart, objEnd);
    
    // Update the values in the object
    let newObj = oldObj;
    const oldDist = xRoute.distance;
    const oldF51 = xRoute.fare_51;
    const oldF40 = xRoute.fare_40;
    
    // Replace distance, fare_51, fare_40
    newObj = newObj.replace(/"distance":\s*[\d.]+/, '"distance": ' + oldDist);
    newObj = newObj.replace(/"fare_51":\s*\d+/, '"fare_51": ' + oldF51);
    newObj = newObj.replace(/"fare_40":\s*\d+/, '"fare_40": ' + oldF40);
    
    if (newObj !== oldObj) {
        scriptContent = scriptContent.substring(0, objStart) + newObj + scriptContent.substring(objEnd);
        scriptUpdateCount++;
        console.log('  ' + key + ': UPDATED (fare_51=' + oldF51 + ', fare_40=' + oldF40 + ', dist=' + oldDist + ')');
    } else {
        console.log('  ' + key + ': NO CHANGE');
    }
}

console.log('  Total script.js updates:', scriptUpdateCount);

// 5. Update routes_data.json
console.log('\nUpdating routes_data.json...');
let routesData = JSON.parse(fs.readFileSync(ROUTES_JSON_PATH, 'utf8'));
let jsonUpdateCount = 0;

for (const route of routesData) {
    if (!route.route_no || !route.route_no.includes('\u09A1\u09BF\u09A1\u09BF\u0986\u09B0')) continue;
    
    const xRoute = xlsxRoutes[route.route_no];
    if (!xRoute) {
        console.log('  WARN: ' + route.route_no + ' not found in xlsx');
        continue;
    }
    
    let changed = false;
    if (route.distance !== xRoute.distance) {
        route.distance = xRoute.distance;
        changed = true;
    }
    if (route.fare_51 !== xRoute.fare_51) {
        route.fare_51 = xRoute.fare_51;
        changed = true;
    }
    if (route.fare_40 !== xRoute.fare_40) {
        route.fare_40 = xRoute.fare_40;
        changed = true;
    }
    
    if (changed) {
        jsonUpdateCount++;
        console.log('  ' + route.route_no + ': UPDATED (fare_51=' + xRoute.fare_51 + ', fare_40=' + xRoute.fare_40 + ')');
    }
}

// 6. Write updated files
if (scriptUpdateCount > 0) {
    fs.writeFileSync(SCRIPT_PATH, scriptContent, 'utf8');
    console.log('\n  script.js written');
}

if (jsonUpdateCount > 0) {
    fs.writeFileSync(ROUTES_JSON_PATH, JSON.stringify(routesData, null, 4), 'utf8');
    console.log('  routes_data.json written');
}

// 7. Regenerate xlsx text extracts
console.log('\nRegenerating xlsx text extracts...');

// Generate simple format (matches old xlsx_data.txt)
const bnDigits = '০১২৩৪৫৬৭৮৯';
function toBnNum(num) {
    if (num === undefined || num === null) return '';
    const s = typeof num === 'number' ? num.toString() : String(num);
    return s.split('').map(c => bnDigits[c] || c).join('');
}

function formatBnNum(num, decimals) {
    if (typeof num !== 'number') return String(num);
    return toBnNum(num.toFixed(decimals));
}

let simpleLines = [];
let fullLines = [];

for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const serial = row[0];
    const routeNo = String(row[1] || '');
    const desc = String(row[2] || '');
    const dist = row[3];
    const rate = row[4] !== '' ? row[4] : '';
    const fareCalc = row[5] !== '' ? row[5] : '';
    const fareRounded = row[6] !== '' ? row[6] : '';
    const fare40Raw = row[7] !== '' ? row[7] : '';
    const fare36Raw = row[8] !== '' ? row[8] : '';
    const toll = row[9] !== '' ? row[9] : '';
    const ins51 = row[10] !== '' ? row[10] : '';
    const ins40 = row[11] !== '' ? row[11] : '';
    const ins36 = row[12] !== '' ? row[12] : '';
    const tollPer51 = row[13] !== '' ? row[13] : '';
    const tollPer40 = row[14] !== '' ? row[14] : '';
    const tollPer36 = row[15] !== '' ? row[15] : '';
    const final51 = row[16] !== '' ? row[16] : '';
    const final40 = row[17] !== '' ? row[17] : '';
    const final36 = row[18] !== '' ? row[18] : '';

    const colVals = [
        serial !== '' ? toBnNum(serial) : '',
        routeNo,
        desc,
        dist !== '' ? toBnNum(dist) : '',
        rate !== '' ? toBnNum(rate) : '',
        fareCalc !== '' ? toBnNum(fareCalc) : '',
        fareRounded !== '' ? toBnNum(fareRounded) : '',
        fare40Raw !== '' ? toBnNum(fare40Raw) : '',
        fare36Raw !== '' ? toBnNum(fare36Raw) : '',
        toll !== '' ? toBnNum(toll) : '',
        ins51 !== '' ? toBnNum(ins51) : '',
        ins40 !== '' ? toBnNum(ins40) : '',
        ins36 !== '' ? toBnNum(ins36) : '',
        tollPer51 !== '' ? toBnNum(tollPer51) : '',
        tollPer40 !== '' ? toBnNum(tollPer40) : '',
        tollPer36 !== '' ? toBnNum(tollPer36) : '',
        final51 !== '' ? toBnNum(final51) : '',
        final40 !== '' ? toBnNum(final40) : '',
        final36 !== '' ? toBnNum(final36) : ''
    ];

    // Simple format: fewer columns (matching old xlsx_data.txt)
    const simple = '||' + [
        serial !== '' ? toBnNum(serial) : '',
        routeNo,
        desc,
        dist !== '' ? toBnNum(dist) : '',
        rate !== '' ? toBnNum(rate) : '',
        fareCalc !== '' ? toBnNum(fareCalc) : '',
        fareRounded !== '' ? toBnNum(fareRounded) : '',
        fare40Raw !== '' ? toBnNum(fare40Raw) : '',
        fare36Raw !== '' ? toBnNum(fare36Raw) : '',
        toll !== '' ? toBnNum(toll) : '',
        ins51 !== '' ? toBnNum(ins51) : '',
        ins40 !== '' ? toBnNum(ins40) : ''
    ].join('||') + '||';

    // Full format: all columns
    const full = '||' + [
        serial !== '' ? toBnNum(serial) : '',
        routeNo,
        desc,
        dist !== '' ? toBnNum(dist) : '',
        rate !== '' ? toBnNum(rate) : '',
        fareCalc !== '' ? toBnNum(fareCalc) : '',
        fareRounded !== '' ? toBnNum(fareRounded) : '',
        fare40Raw !== '' ? toBnNum(fare40Raw) : '',
        fare36Raw !== '' ? toBnNum(fare36Raw) : '',
        toll !== '' ? toBnNum(toll) : '',
        ins51 !== '' ? toBnNum(ins51) : '',
        ins40 !== '' ? toBnNum(ins40) : '',
        ins36 !== '' ? toBnNum(ins36) : '',
        tollPer51 !== '' ? toBnNum(tollPer51) : '',
        tollPer40 !== '' ? toBnNum(tollPer40) : '',
        tollPer36 !== '' ? toBnNum(tollPer36) : '',
        final51 !== '' ? toBnNum(final51) : '',
        final40 !== '' ? toBnNum(final40) : '',
        final36 !== '' ? toBnNum(final36) : ''
    ].join('||') + '||';

    simpleLines.push(simple);
    fullLines.push(full);
}

fs.writeFileSync(XLSX_TXT_PATH, simpleLines.join('\n'), 'utf8');
fs.writeFileSync(XLSX_TXT_FULL_PATH, fullLines.join('\n'), 'utf8');
console.log('  xlsx text extracts regenerated');

// 8. Bump SW cache version
console.log('\nUpdating service worker cache version...');
let swContent = fs.readFileSync(SW_PATH, 'utf8');
const cacheRegex = /const CACHE_NAME = 'brta-bus-fare-v(\d+)'/;
const cacheMatch = swContent.match(cacheRegex);
if (cacheMatch) {
    const oldVer = parseInt(cacheMatch[1]);
    const newVer = oldVer + 1;
    swContent = swContent.replace(cacheRegex, "const CACHE_NAME = 'brta-bus-fare-v" + newVer + "'");
    fs.writeFileSync(SW_PATH, swContent, 'utf8');
    console.log('  Cache version: v' + oldVer + ' -> v' + newVer);
} else {
    console.log('  WARN: Could not find cache version in sw.js');
}

console.log('\n=== Sync complete ===');
console.log('  script.js: ' + scriptUpdateCount + ' DDR routes updated');
console.log('  routes_data.json: ' + jsonUpdateCount + ' DDR routes updated');
console.log('  Text extracts regenerated');
console.log('  SW cache version bumped');
