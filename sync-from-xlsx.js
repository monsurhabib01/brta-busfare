const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const XLSX_PATH = path.join(__dirname, '112_Local route_With Fare Matrix Chart.xlsx');
const BUS_SERVICE_XLSX_PATH = path.join(__dirname, '112_Local route_With Bus Service Name.xlsx');
const MASTER_XLSX_PATH = path.join(__dirname, '112_LocalRoute_All Locations_Bengali and English.xlsx');
const ROUTES_OUT = path.join(__dirname, 'local_routes_data.json');
const FARE_MATRIX_OUT = path.join(__dirname, 'local_fare_matrix.json');
const DISTANCE_OUT = path.join(__dirname, 'local_routes_distance.json');
const DISTANCE_MATRIX_OUT = path.join(__dirname, 'local_distance_matrix.json');
const BUS_SERVICE_OUT = path.join(__dirname, 'local_bus_services.json');
const STOP_EN_OUT = path.join(__dirname, 'local_stop_en.js');

const BN_DIGITS = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
const DEVA_DIGITS = { '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9' };

function bnToNum(s) {
    if (s === null || s === undefined) return NaN;
    let str = String(s).trim();
    if (!str) return NaN;
    str = str.replace(/[০-৯]/g, d => BN_DIGITS[d]);
    str = str.replace(/[०-९]/g, d => DEVA_DIGITS[d]);
    str = str.replace(/[^\d.\-]/g, '');
    return parseFloat(str);
}

function isBengaliUnicode(s) {
    if (!s) return false;
    const c = s.charCodeAt(0);
    return c >= 0x0980 && c <= 0x09FF;
}

function ensureBengali(s) {
    const str = String(s || '').trim();
    if (!str) return '';
    if (isBengaliUnicode(str)) return str;
    console.warn('  NON-BENGALI CELL SKIPPED: "' + str.substring(0, 40) + '" (first char U+' + str.charCodeAt(0).toString(16).toUpperCase() + ')');
    return '';
}

function isRouteHeader(cell) {
    if (!cell) return false;
    const s = String(cell);
    return /র[ুূ]ট\s*ন[ংঁ]?\s*[-–—]?\s*\(/.test(s) || /র[ুূ]ট\s*ন[ংঁ]?\s*[-–—]?\s*[A-Za-z]/.test(s);
}

function isDistanceRow(cell) {
    if (!cell) return false;
    const s = String(cell);
    return /দূরত্ব/.test(s) && /[\d০-৯]/.test(s);
}

function parseRouteNo(header) {
    let m = header.match(/\(?\s*(এ[-–]?\s*(?:\d+|[০-৯]+)\s*(?:নং)?\s*)\)?/);
    if (m) {
        let numStr = m[1].replace(/\s+/g, '');
        numStr = numStr.replace(/[০-৯]/g, d => BN_DIGITS[d]);
        numStr = numStr.replace(/^এ[-–]?\s*/i, 'A ');
        numStr = numStr.replace(/নং$/, '').trim();
        return numStr;
    }
    m = header.match(/([০-৯\d]+)\s*নং?/);
    if (m) {
        let numStr = m[1].replace(/[০-৯]/g, d => BN_DIGITS[d]);
        return 'A ' + numStr;
    }
    return null;
}

function parseRouteName(header) {
    let name = header.replace(/র[ুূ]ট\s*ন[ংঁ]?\s*[-–—]?\s*\([^)]+\)\s*,?\s*/g, '').trim();
    name = name.replace(/রুটে\s*ডিজেল.*$/g, '').trim();
    name = name.replace(/রুটের?\s*বাস\s*ভাড়ার?\s*চার্ট.*$/g, '').trim();
    return name.trim();
}

function parseTotalDistance(cell) {
    if (!cell) return 0;
    const s = String(cell);
    const m = s.match(/([\d০-৯.]+)\s*(?:কিঃ?মিঃ|কিলোমিটার|কি\.?মি\.?)/);
    if (m) return bnToNum(m[1]);
    const m2 = s.match(/([\d০-৯.]+)/);
    if (m2) return bnToNum(m2[1]);
    return 0;
}

function cleanCellText(s) {
    return String(s || '').replace(/[।]+$/, '').replace(/\s+/g, ' ').trim();
}

// Restore stop names that were manually curated to their full forms in earlier
// commits. The 112 xlsx stores abbreviated/spelling-variant names (মোঃপুর,
// নাঃগঞ্জ, a broken parenthesis in আব্দুল্লাহপুর জেলখানা) — keep the app's
// curated names so both stop display and matrix keys stay consistent.
const NAME_NORMALIZATION = {
    // Fix broken spellings in the fare sheet so every stop maps to exactly one
    // canonical Bengali spelling (matching the master list where it exists).
    'মোঃপুর (জাপান গার্ডেন সিটি)': 'মোহাম্মদপুর (জাপান গার্ডেন সিটি)',
    'মোঃপুর': 'মোহাম্মদপুর',
    'নাঃগঞ্জ লিংক রোড': 'নারায়নগঞ্জ লিংক রোড',
    'মোঃপুর টাউন হল': 'মোহাম্মদপুর টাউন হল',
    'নদ্দা': 'নৰ্দ্দা',
    'মোঃবাসস্ট্যান্ড': 'মোহাম্মদপুর বাসস্ট্যান্ড',
    'আব্দুল্লাহপুর জেলখানা)': 'আব্দুল্লাহপুর (জেলখানা)',
    'নুতন বাজার': 'নতুন বাজার',
    'কালসী': 'কালশী',
    'কালশি': 'কালশী',
    'গুলিস্থান': 'গুলিস্তান',
    'কাঁচপুরব্রীজ': 'কাঁচপুর ব্রীজ',
    'আনসারক্যাম্প': 'আনসার ক্যাম্প',
    'আসাদগেট': 'আসাদ গেট',
    'আসাদগেইট': 'আসাদ গেট',
    'আসাদ গেইট': 'আসাদ গেট',
    'নটরড্যাম কলেজ': 'নটর ডেম কলেজ',
    'নটরডেম কলেজ': 'নটর ডেম কলেজ',
    'কলেজগেট': 'কলেজ গেইট',
    'কলেজগেইট': 'কলেজ গেইট',
    'কাওরানবাজার': 'কাওরান বাজার',
    'নিউমার্কেট': 'নিউ মার্কেট',
    'সাইন্সল্যাব': 'সাইন্সল্যাবঃ',
    'সাইন্সল্যাব:': 'সাইন্সল্যাবঃ',
    'কাকলি': 'কাকলী',
    'বাবুবাজার ব্রীজ': 'বাবু বাজার ব্রীজ',
    'কেরানীগঞ্জ (নতুন জেল খানা)': 'কেরানীগঞ্জ (নতুন জেলখানা)',
    'বাংলামটর': 'বাংলা মটর',
    'বাংলামোটর': 'বাংলা মটর',
    'শঙ্কর': 'শংকর',
    'ধানমন্ডী-১৫': 'ধানমন্ডি-১৫',
    'হাউজবিল্ডিং': 'হাউজ বিল্ডিং',
    'গাবতলি': 'গাবতলী',
    'ধওর': 'ধউর',
    'জিরাব': 'জিরাবো',
    'ফ্যান্টাসী': 'ফ্যান্টাসী কিংডম',
    'ফ্যান্টাসি কিংডম': 'ফ্যান্টাসী কিংডম',
    'ইপিজেট': 'ইপিজেড',
    'নন্দনপার্ক': 'নন্দন পার্ক',
    'নন্দনপাক': 'নন্দন পার্ক',
    'টঙ্গী': 'টংঙ্গী',
    'টংগী': 'টংঙ্গী',
    'প্রগতি সরনী': 'প্রগতি সরণী',
    'মেঘনাঘাট': 'মেঘনা ঘাট',
    'চানখারপুল': 'চাঁনখারপুল',
    'ইসিবি চত্বর': 'ইসিবি চত্ত্বর',
    'খিলগাও ফ্লাইওভার': 'খিলগাঁও ফ্লাইওভার',
    'মোঃ জিলুর রহমান ফ্লাইওভার': 'মোঃ জিল্লুর রহমান ফ্লাইওভার',
    'মোঃ জিলুর রাহমান ফ্লাইওভার': 'মোঃ জিল্লুর রহমান ফ্লাইওভার',
    'অরিজিনাল দশ': 'অরিজিনাল-১০',
    'কাজিপাড়া': 'কাজীপাড়া',
    'সায়দাবাদ': 'সায়েদাবাদ',
    'মিরপুর-১১১/২': 'মিরপুর-১১.৫',
    'মিরপুর সাড়ে ১১': 'মিরপুর-১১.৫',
    'ভিক্টোরিয়াপার্ক': 'ভিক্টোরিয়া পার্ক',
    'দুয়ারিপাড়া': 'দুয়ারীপাড়া',
    'সায়েন্সল্যাব': 'সাইন্সল্যাবঃ',
    'মানিকমিয়া এভিনিউ': 'মানিক মিয়া এভিনিউ',
    'কামারপাড়া': 'কামার পাড়া',
    'বিমানবন্দর': 'এয়ারপোর্ট',
    'ফুলবাড়িয়া': 'ফুলবাড়ীয়া',
    'কোণাবাড়ী': 'কোনাবাড়ী',
    'শনিরআখড়া': 'শনির আখড়া',
    'কালশীর মোড়': 'কালশী মোড়',
    'কালশি মোড়': 'কালশী মোড়',
    'কালশিমোড়': 'কালশী মোড়'
};

// ===========================================================================
// MASTER LOCATION LIST (authoritative Bengali spellings + English names)
// ===========================================================================

function normalizeBnText(s) {
    return String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

// Load the official Bengali<->English location pairs from the master file.
// Each row is a distinct official stop; two rows may share the same English
// (e.g. genuine spelling variants), so the Bengali spelling is the unique key.
function loadMasterLocations() {
    const wb = XLSX.readFile(MASTER_XLSX_PATH, { type: 'file', codepage: 65001 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const master = [];
    for (let i = 1; i < rows.length; i++) {
        const bn = normalizeBnText(rows[i][0]);
        const en = String(rows[i][1] || '').trim();
        if (bn) master.push({ bn, en });
    }
    const byBn = new Map();
    for (const m of master) byBn.set(m.bn, m);
    return { master, byBn };
}
const MASTER = loadMasterLocations();
console.log('Master locations loaded:', MASTER.master.length);

// The previous local_stop_en.js supplies English for data stops that are not
// in the master list, so regenerating keeps every translation. The output
// dictionary contains exactly: master pairs + current data stops.
let EXISTING_STOP_EN = {};
try {
    const src = fs.readFileSync(STOP_EN_OUT, 'utf8');
    const obj = new Function('return ' + src.match(/\{[\s\S]*\}/)[0] + ';')();
    for (const k of Object.keys(obj)) EXISTING_STOP_EN[normalizeBnText(k)] = obj[k];
    console.log('Existing stop translations loaded:', Object.keys(EXISTING_STOP_EN).length);
} catch (e) {
    console.warn('  local_stop_en.js not loadable; dictionary starts from master only:', e.message);
}

// NFC-normalized lookup for the normalization map, so a mapping matches even
// when the fare sheet encodes Bengali conjuncts differently (e.g. ড় as
// precomposed U+09DC vs decomposed U+09A1 U+09BC). NFC normalization keeps
// stop names byte-identical to the app's NFC lookup keys and master entries.
const NAME_NORM_NFC = new Map();
for (const k of Object.keys(NAME_NORMALIZATION)) {
    NAME_NORM_NFC.set(k.normalize('NFC'), NAME_NORMALIZATION[k].normalize('NFC'));
}

function normalizeStopName(name) {
    const cleaned = cleanCellText(name).normalize('NFC');
    return NAME_NORM_NFC.get(cleaned) || cleaned;
}

// Mirrors the browser-side cleanStopName() in script.js so matrix lookup keys
// are byte-identical to what the app computes before lookup.
function cleanStopName(name) {
    return String(name || '')
        .replace(/[।]+$/, '')
        .replace(/[।]+ /g, ', ')
        .replace(/ হয়ে .+/, '')
        .trim();
}

// Same transformation as getLocalExactFare/getLocalExactDistance in script.js:
// cleanStopName(...).normalize('NFC').trim() — critical because Bengali র/ড়
// sequences (e.g. U+09DC vs U+09A1 U+09BC) differ until NFC-normalized.
function stopLookupKey(name) {
    return cleanStopName(name).normalize('NFC').trim();
}

function extractUnicodeCellValue(cell) {
    const raw = String(cell || '').trim();
    if (!raw) return '';
    const cleaned = cleanCellText(raw);
    return ensureBengali(cleaned);
}

// ===========================================================================
// 1. READ FARE MATRIX EXCEL (Bengali data: stops, fares, distances)
// ===========================================================================

console.log('Loading', XLSX_PATH);
const wb = XLSX.readFile(XLSX_PATH, { type: 'file', codepage: 65001 });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log('Loaded', data.length, 'rows from', wb.SheetNames[0]);

const routeBlocks = [];
let i = 0;
while (i < data.length) {
    const cell = data[i] && data[i][0] ? String(data[i][0]) : '';
    if (isRouteHeader(cell)) {
        const block = { headerRowIdx: i, header: cell, stops: [] };

        let headerIdx = -1;
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            const c = data[j] && data[j][0] ? String(data[j][0]) : '';
            if (c.includes('কিঃমিঃ') || c.includes('কিঃ মিঃ')) {
                headerIdx = j;
                break;
            }
        }
        block.stopNamesHeaderIdx = headerIdx;
        block.routeNo = parseRouteNo(cell);
        block.routeNameFull = parseRouteName(cell);

        if (i + 1 < data.length) {
            const distCell = data[i + 1] && data[i + 1][0] ? String(data[i + 1][0]) : '';
            if (isDistanceRow(distCell)) {
                block.totalDistance = parseTotalDistance(distCell);
                block.distanceRowIdx = i + 1;
            }
        }

        let j = block.distanceRowIdx ? block.distanceRowIdx + 1 : i + 2;
        while (j < data.length) {
            const row = data[j];
            if (!row || row.length === 0) break;
            const firstCell = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
            const secondCell = row[1];
            if (!firstCell && (secondCell === undefined || secondCell === null || String(secondCell).trim() === '')) break;
            if (isRouteHeader(firstCell)) break;
            if (firstCell.includes('কিঃমিঃ') || firstCell.includes('কিঃ মিঃ')) break;

            let stopName, kmFromOrigin;
            const col1Num = bnToNum(secondCell);

            if (firstCell && !isNaN(col1Num) && (secondCell === 0 || col1Num > 0 || String(secondCell).includes('০'))) {
                stopName = firstCell;
                kmFromOrigin = col1Num;
            } else {
                const col0Num = bnToNum(firstCell);
                if (!isNaN(col0Num) && secondCell && isNaN(bnToNum(secondCell))) {
                    stopName = String(secondCell).trim();
                    kmFromOrigin = col0Num;
                } else {
                    stopName = firstCell;
                    kmFromOrigin = isNaN(col1Num) ? 0 : col1Num;
                }
            }

            const fares = [];
            for (let c = 2; c < row.length; c++) {
                const val = row[c];
                if (val === null || val === undefined || val === '') {
                    fares.push(null);
                } else if (typeof val === 'number') {
                    fares.push(val);
                } else {
                    const s = String(val).trim();
                    if (/^[০-৯\d.]+$/.test(s)) {
                        fares.push(bnToNum(s));
                    } else {
                        fares.push(null);
                    }
                }
            }

            block.stops.push({ name: stopName, km: kmFromOrigin, fares: fares });
            j++;
        }

        block.endRowIdx = j;
        routeBlocks.push(block);
        i = j;
    } else {
        i++;
    }
}

console.log('\nFound', routeBlocks.length, 'route blocks');

function getColumnStopNames(headerIdx) {
    if (headerIdx < 0) return [];
    const row = data[headerIdx];
    if (!row) return [];
    const names = [];
    for (let c = 2; c < row.length; c++) {
        const val = row[c];
        if (val !== null && val !== undefined && String(val).trim()) {
            names.push(normalizeStopName(String(val).trim()));
        }
    }
    return names;
}

// ===========================================================================
// 2. READ ENGLISH ROUTE NAMES & SERVICE NAMES FROM BUS SERVICE EXCEL
// ===========================================================================

console.log('\n========== READING ENGLISH DATA ==========');
console.log('Loading', BUS_SERVICE_XLSX_PATH);
const svcWb = XLSX.readFile(BUS_SERVICE_XLSX_PATH, { type: 'file', codepage: 65001 });
console.log('Sheets:', svcWb.SheetNames);

const engSheetName = svcWb.SheetNames.find(n => n.toLowerCase().includes('english'));
if (!engSheetName) {
    console.error('ERROR: Could not find English sheet in', BUS_SERVICE_XLSX_PATH);
    process.exit(1);
}
console.log('Using English sheet:', engSheetName);

const engWs = svcWb.Sheets[engSheetName];
const engData = XLSX.utils.sheet_to_json(engWs, { header: 1, defval: '' });
console.log('Loaded', engData.length, 'rows from', engSheetName);
console.log('Header:', JSON.stringify(engData[0]));

// Build English lookup map: normalized route number -> { route_desc_en, service_name_en }
const englishMap = {};

function normalizeRouteNo(routeNo) {
    // Convert Bengali route numbers like "এ-১০১" to "A 101"
    let s = String(routeNo).trim();
    s = s.replace('-', ' ');
    // Bengali letter এ -> A
    s = s.replace(/^এ/, 'A');
    // Bengali digits -> Arabic
    s = s.replace(/[০-৯]/g, d => BN_DIGITS[d]);
    return s;
}

for (let r = 1; r < engData.length; r++) {
    const row = engData[r];
    if (!row || !row[0]) continue;
    const routeNo = normalizeRouteNo(row[0]);
    const routeDesc = String(row[1] || '').trim();
    const serviceName = String(row[2] || '').trim();
    if (routeNo && routeDesc) {
        englishMap[routeNo] = { route_desc_en: routeDesc, service_name_en: serviceName };
    }
}
console.log('English route descriptions loaded:', Object.keys(englishMap).length);

// Read Bengali sheet for Bengali service names
const bnSheetName = svcWb.SheetNames.find(n => n.toLowerCase().includes('bengali'));
const bnServiceMap = {};
if (bnSheetName) {
    console.log('\nUsing Bengali sheet:', bnSheetName);
    const bnWs = svcWb.Sheets[bnSheetName];
    const bnData = XLSX.utils.sheet_to_json(bnWs, { header: 1, defval: '' });
    for (let r = 1; r < bnData.length; r++) {
        const row = bnData[r];
        if (!row || !row[0]) continue;
        const routeNo = normalizeRouteNo(row[0]);
        const serviceCell = String(row[2] || '').trim();
        if (!routeNo || !serviceCell) continue;
        const serviceParts = serviceCell.split(/\r?\n/).map(s => s.trim().replace(/,$/, '')).filter(Boolean);
        if (!bnServiceMap[routeNo]) bnServiceMap[routeNo] = [];
        for (const svc of serviceParts) {
            if (!bnServiceMap[routeNo].includes(svc)) {
                bnServiceMap[routeNo].push(svc);
            }
        }
    }
    console.log('Bengali service routes:', Object.keys(bnServiceMap).length);
}

// ===========================================================================
// 3. BUILD ROUTE DATA (using Bengali stops/fare matrix + English descriptions)
// ===========================================================================

const localRoutes = [];
const fareMatrix = {};
const distanceData = {};
const distanceMatrix = {};

for (const block of routeBlocks) {
    if (!block.routeNo) {
        console.warn('  SKIP: no route number in:', block.header.substring(0, 60));
        continue;
    }
    if (block.stops.length < 2) {
        console.warn('  SKIP', block.routeNo, '- only', block.stops.length, 'stops');
        continue;
    }

    const colStopNames = getColumnStopNames(block.stopNamesHeaderIdx);
    const stopsBn = block.stops.map(s => {
        const cleaned = normalizeStopName(s.name);
        const unicode = ensureBengali(cleaned);
        return unicode || cleaned;
    }).filter(s => s.length > 0);

    if (stopsBn.length < 2) continue;

    // Lookup keys for every row stop, NFC-normalized exactly like the app does.
    const stopKeys = block.stops.map(s => {
        const cleaned = normalizeStopName(s.name);
        const unicode = ensureBengali(cleaned);
        return stopLookupKey(unicode || cleaned);
    });

    // Build exact distance matrix from Column B cumulative kilometer values:
    // distance(pair) = Math.abs(km[i] - km[j]) with the same reverse-lookup key
    // as the fare matrix ([a, b].sort().join('|')).
    const routeDistanceMatrix = {};
    for (let rowIdx = 0; rowIdx < block.stops.length; rowIdx++) {
        const kmA = block.stops[rowIdx].km;
        if (kmA === null || kmA === undefined || isNaN(kmA)) continue;
        for (let colIdx = rowIdx + 1; colIdx < block.stops.length; colIdx++) {
            const kmB = block.stops[colIdx].km;
            if (kmB === null || kmB === undefined || isNaN(kmB)) continue;
            const dist = Math.abs(kmB - kmA);
            if (dist <= 0) continue;
            const key = [stopKeys[rowIdx], stopKeys[colIdx]].sort().join('|');
            if (routeDistanceMatrix[key] === undefined) {
                routeDistanceMatrix[key] = Math.round(dist * 10) / 10;
            }
        }
    }

    const originBn = stopsBn[0];
    const destBn = stopsBn[stopsBn.length - 1];

    const routeFareMatrix = {};
    for (let rowIdx = 0; rowIdx < block.stops.length; rowIdx++) {
        const stop = block.stops[rowIdx];
        for (let colIdx = 0; colIdx < stop.fares.length; colIdx++) {
            const fare = stop.fares[colIdx];
            if (fare !== null && fare !== undefined && fare > 0) {
                // Column index maps positionally to the same stop row in the
                // symmetric grid, so use the ROW stop name (not the header label)
                // to keep keys consistent with stops_bn and the reverse lookup.
                let colKey;
                if (block.stops[colIdx]) {
                    colKey = stopKeys[colIdx];
                } else if (colStopNames[colIdx]) {
                    colKey = stopLookupKey(colStopNames[colIdx]);
                }
                if (!colKey) continue;

                const key = [stopKeys[rowIdx], colKey].sort().join('|');
                if (routeFareMatrix[key] === undefined || fare < routeFareMatrix[key]) {
                    routeFareMatrix[key] = fare;
                }
            }
        }
    }

    let routeNameBn = block.routeNameFull.replace(/\s+/g, ' ').trim();
    if (!routeNameBn) routeNameBn = originBn + ' হতে ' + destBn;

    const totalDist = block.totalDistance || 0;

    // Direct English from the Excel sheet
    const engInfo = englishMap[block.routeNo] || {};
    const routeNameEn = engInfo.route_desc_en || '';

    localRoutes.push({
        route_no: block.routeNo,
        route_name_bn: routeNameBn,
        route_name_en: routeNameEn,
        origin_bn: originBn,
        origin_en: '',
        destination_bn: destBn,
        destination_en: '',
        stops_bn: stopsBn,
        stops_en: [],
        distance_km: totalDist,
        rate_tk: 2.53,
        min_fare: 10
    });

    fareMatrix[block.routeNo] = routeFareMatrix;
    distanceData[block.routeNo] = { distance_km: totalDist, rate_tk: 2.53, min_fare: 10 };
    distanceMatrix[block.routeNo] = routeDistanceMatrix;

    console.log('  ' + block.routeNo + ': ' + stopsBn.length + ' stops, ' + Object.keys(routeFareMatrix).length + ' fare pairs, ' + Object.keys(routeDistanceMatrix).length + ' dist pairs, ' + totalDist + ' km | EN: ' + (routeNameEn || '(none)').substring(0, 60));
}

localRoutes.sort((a, b) => {
    const numA = parseInt(a.route_no.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.route_no.replace(/\D/g, '')) || 0;
    return numA - numB;
});

fs.writeFileSync(ROUTES_OUT, JSON.stringify(localRoutes, null, 2), 'utf8');
fs.writeFileSync(FARE_MATRIX_OUT, JSON.stringify(fareMatrix, null, 2), 'utf8');
fs.writeFileSync(DISTANCE_OUT, JSON.stringify(distanceData, null, 2), 'utf8');
fs.writeFileSync(DISTANCE_MATRIX_OUT, JSON.stringify(distanceMatrix, null, 2), 'utf8');

// ===========================================================================
// 4. BUS SERVICE NAMES (Bengali + English from Excel sheets)
// ===========================================================================

console.log('\n========== BUS SERVICE NAME SYNC ==========');
const busServiceOutput = {};

for (const route of localRoutes) {
    const routeNo = route.route_no;
    const bnServices = bnServiceMap[routeNo] || [];
    const engInfo = englishMap[routeNo] || {};
    const enServiceRaw = engInfo.service_name_en || '';

    if (bnServices.length > 0) {
        // Split English service names by common separators (comma, slash)
        const enParts = enServiceRaw.split(/[,/]/).map(s => s.trim()).filter(Boolean);

        busServiceOutput[routeNo] = bnServices.map((bn, idx) => ({
            bn: bn,
            en: enParts[idx] || enParts[0] || bn
        }));
    } else if (enServiceRaw) {
        // Fallback: use English sheet even without Bengali
        busServiceOutput[routeNo] = [{ bn: '', en: enServiceRaw }];
    }
}

fs.writeFileSync(BUS_SERVICE_OUT, JSON.stringify(busServiceOutput, null, 2), 'utf8');
console.log('Wrote', BUS_SERVICE_OUT);
console.log('Routes with services:', Object.keys(busServiceOutput).length);

// ===========================================================================
// 5. GENERATE local_stop_en.js (superset Bengali->English dictionary)
// ===========================================================================
//
// LOCAL_STOP_EN is a pure lookup: every Bengali spelling (data spelling or
// master spelling) maps to its English name. Distinct spellings may share an
// English name (master lists variants as separate rows), so duplicate values
// are expected. Output = previous dictionary + all master pairs + any data
// stop that gains a translation, so regenerating is idempotent and complete.

console.log('\n========== STOP ENGLISH TRANSLATIONS ==========');

const stopEn = new Map();
for (const m of MASTER.master) {
    stopEn.set(normalizeBnText(m.bn), m.en);
}

let addedFromExisting = 0;
const dataStopSet = new Set();
for (const r of localRoutes) r.stops_bn.forEach(s => dataStopSet.add(s));
for (const s of dataStopSet) {
    const key = normalizeBnText(s);
    if (stopEn.has(key)) continue;
    const en = EXISTING_STOP_EN[key];
    if (en) { stopEn.set(key, en); addedFromExisting++; }
}

const stopEnEntries = [...stopEn.entries()]
    .map(([key, en]) => [key, en === 'Original Dash' ? 'Original-10' : en])
    .sort((a, b) => a[0].localeCompare(b[0], 'bn'));
let stopEnOut = 'const LOCAL_STOP_EN = {\n';
for (const [key, en] of stopEnEntries) {
    stopEnOut += '  ' + JSON.stringify(key) + ': ' + JSON.stringify(en) + ',\n';
}
stopEnOut += '};\n';
fs.writeFileSync(STOP_EN_OUT, stopEnOut, 'utf8');
console.log('Wrote', STOP_EN_OUT, 'with', stopEnEntries.length, 'entries');
console.log('Non-master data stops given existing English:', addedFromExisting);
const uncovered = [...dataStopSet].filter(s => !stopEn.has(normalizeBnText(s)));
console.log('Data stops without any translation:', uncovered.length === 0 ? 0 : uncovered.join(', '));

// Guardrail: warn if any stop still maps to a shared English name, so a new
// fare-sheet spelling variant is caught on every sync instead of silently
// duplicating entries in the app's stop dropdown. Stops are grouped by their
// NFC key (the app dedupes on the NFC key), so pure codepoint-encoding
// variants of the same spelling do not count as duplicates.
const enByName = new Map();
for (const s of dataStopSet) {
    const key = normalizeBnText(s);
    const e = stopEn.get(key);
    if (!e) continue;
    if (!enByName.has(e)) enByName.set(e, new Map());
    enByName.get(e).set(key, s);
}
const dupEn = [...enByName.entries()].filter(([, v]) => v.size > 1);
if (dupEn.length) {
    console.log('WARNING: duplicate English stop names still in data:');
    for (const [e, v] of dupEn) console.log('  ' + e + ' x' + v.size + ' => ' + [...v.values()].join(' | '));
} else {
    console.log('No duplicate English stop names in data.');
}

// ===========================================================================
// 6. SUMMARY
// ===========================================================================

console.log('\n=== SUMMARY ===');
console.log('Routes:', localRoutes.length);
let totalStops = 0;
let totalFares = 0;
let totalDistPairs = 0;
const allStops = new Set();
let enCount = 0;
for (const r of localRoutes) {
    totalStops += r.stops_bn.length;
    r.stops_bn.forEach(s => allStops.add(s));
    totalFares += Object.keys(fareMatrix[r.route_no] || {}).length;
    totalDistPairs += Object.keys(distanceMatrix[r.route_no] || {}).length;
    if (r.route_name_en) enCount++;
}
console.log('Unique stops:', allStops.size);
console.log('Total fare pairs:', totalFares);
console.log('Total distance pairs:', totalDistPairs);
console.log('Routes with English descriptions:', enCount, '/', localRoutes.length);
console.log('\nDistance matrix sample (A 101):');
const d101 = distanceMatrix['A 101'] || {};
Object.keys(d101).slice(0, 10).forEach(k => console.log('  ' + k + ' = ' + d101[k] + ' km'));
console.log('\nSample English names:');
localRoutes.slice(0, 5).forEach(r => {
    console.log('  ' + r.route_no + ': ' + (r.route_name_en || '(none)'));
});
console.log('\nRoute numbers:', localRoutes.map(r => r.route_no).join(', '));
