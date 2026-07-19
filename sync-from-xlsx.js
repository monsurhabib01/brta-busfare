const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const XLSX_PATH = path.join(__dirname, '111_Local route_With Fare Matrix Chart.xlsx');
const BUS_SERVICE_XLSX_PATH = path.join(__dirname, '111_Local route_With Bus Service Name.xlsx');
const ROUTES_OUT = path.join(__dirname, 'local_routes_data.json');
const FARE_MATRIX_OUT = path.join(__dirname, 'local_fare_matrix.json');
const DISTANCE_OUT = path.join(__dirname, 'local_routes_distance.json');
const BUS_SERVICE_OUT = path.join(__dirname, 'local_bus_services.json');

const BN_DIGITS = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };

function bnToNum(s) {
    if (s === null || s === undefined) return NaN;
    let str = String(s).trim();
    if (!str) return NaN;
    str = str.replace(/[০-৯]/g, d => BN_DIGITS[d]);
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
            names.push(String(val).trim());
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
        const cleaned = cleanCellText(s.name);
        const unicode = ensureBengali(cleaned);
        return unicode || cleaned;
    }).filter(s => s.length > 0);

    if (stopsBn.length < 2) continue;

    const originBn = stopsBn[0];
    const destBn = stopsBn[stopsBn.length - 1];

    const routeFareMatrix = {};
    for (let rowIdx = 0; rowIdx < block.stops.length; rowIdx++) {
        const stop = block.stops[rowIdx];
        for (let colIdx = 0; colIdx < stop.fares.length; colIdx++) {
            const fare = stop.fares[colIdx];
            if (fare !== null && fare !== undefined && fare > 0) {
                const colStopName = colStopNames[colIdx] || (block.stops[colIdx] ? block.stops[colIdx].name : null);
                if (!colStopName) continue;

                const a = cleanCellText(stop.name);
                const b = cleanCellText(colStopName);
                const key = [a, b].sort().join('|');
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

    console.log('  ' + block.routeNo + ': ' + stopsBn.length + ' stops, ' + Object.keys(routeFareMatrix).length + ' fare pairs, ' + totalDist + ' km | EN: ' + (routeNameEn || '(none)').substring(0, 60));
}

localRoutes.sort((a, b) => {
    const numA = parseInt(a.route_no.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.route_no.replace(/\D/g, '')) || 0;
    return numA - numB;
});

fs.writeFileSync(ROUTES_OUT, JSON.stringify(localRoutes, null, 2), 'utf8');
fs.writeFileSync(FARE_MATRIX_OUT, JSON.stringify(fareMatrix, null, 2), 'utf8');
fs.writeFileSync(DISTANCE_OUT, JSON.stringify(distanceData, null, 2), 'utf8');

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
// 5. SUMMARY
// ===========================================================================

console.log('\n=== SUMMARY ===');
console.log('Routes:', localRoutes.length);
let totalStops = 0;
let totalFares = 0;
const allStops = new Set();
let enCount = 0;
for (const r of localRoutes) {
    totalStops += r.stops_bn.length;
    r.stops_bn.forEach(s => allStops.add(s));
    totalFares += Object.keys(fareMatrix[r.route_no] || {}).length;
    if (r.route_name_en) enCount++;
}
console.log('Unique stops:', allStops.size);
console.log('Total fare pairs:', totalFares);
console.log('Routes with English descriptions:', enCount, '/', localRoutes.length);
console.log('\nSample English names:');
localRoutes.slice(0, 5).forEach(r => {
    console.log('  ' + r.route_no + ': ' + (r.route_name_en || '(none)'));
});
console.log('\nRoute numbers:', localRoutes.map(r => r.route_no).join(', '));
