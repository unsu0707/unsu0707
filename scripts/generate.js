// scripts/generate.js
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'usage_history.json');
const SVG_FILE = path.join(ROOT_DIR, 'usage.svg');

if (!fs.existsSync(DATA_FILE)) {
    console.error("❌ No data file found.");
    process.exit(1);
}

const history = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const daily = history.daily || [];

console.log(`🎨 Generating Graph for ${daily.length} days of history...`);

// --- CONFIG ---
const colors = { bg: '#ffffff', empty: '#ebedf0', l1: '#9be9a8', l2: '#40c463', l3: '#30a14e', l4: '#216e39', text: '#24292f', meta: '#57606a' };
const boxSize = 10; const boxMargin = 3; const weekWidth = 13;
const width = 730; const height = 160;

// Stats Calculation (Last 365 Days)
const today = new Date();
const cutoff = new Date(today); cutoff.setDate(today.getDate() - 366);
let totalCost = 0, totalTokens = 0, activeDays = 0, maxCost = 0;
const dateMap = {};

daily.forEach(day => {
    dateMap[day.date] = day;
    const d = new Date(day.date);
    if (d >= cutoff) {
        if (day.totalCost > maxCost) maxCost = day.totalCost;
        if (day.totalCost > 0) {
            totalCost += day.totalCost;
            totalTokens += (day.totalTokens || 0);
            activeDays++;
        }
    }
});

const getColor = (c) => {
    if (!c) return colors.empty;
    const i = c / (maxCost || 10);
    return i < 0.25 ? colors.l1 : i < 0.5 ? colors.l2 : i < 0.75 ? colors.l3 : colors.l4;
};
const fmt = (n) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'k' : n;

// SVG Construction
let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<style>text{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:10px;fill:${colors.text}}.meta{fill:${colors.meta}}.bold{font-weight:600;font-size:12px}</style>
<rect width="100%" height="100%" fill="${colors.bg}" rx="6"/>
<g transform="translate(30, 30)">`;

const startDate = new Date(today); startDate.setDate(today.getDate() - (52 * 7) - today.getDay());
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
let curMonth = -1;

for (let w = 0; w < 53; w++) {
    const x = w * weekWidth;
    const weekD = new Date(startDate); weekD.setDate(startDate.getDate() + (w * 7));
    if (weekD.getMonth() !== curMonth && w < 52) {
        curMonth = weekD.getMonth();
        svg += `<text x="${x}" y="-10" class="meta">${months[curMonth]}</text>`;
    }
    for (let d = 0; d < 7; d++) {
        const curD = new Date(startDate); curD.setDate(startDate.getDate() + (w * 7) + d);
        if (curD > today) continue;
        const dateStr = curD.toISOString().split('T')[0];
        const data = dateMap[dateStr] || { totalCost: 0, totalTokens: 0 };
        svg += `<rect x="${x}" y="${d * 13}" width="${boxSize}" height="${boxSize}" rx="2" fill="${getColor(data.totalCost)}"><title>${dateStr}: $${data.totalCost.toFixed(2)}</title></rect>`;
    }
}

svg += `</g>
<text x="5" y="52" class="meta">Mon</text><text x="5" y="78" class="meta">Wed</text><text x="5" y="104" class="meta">Fri</text>
<line x1="30" y1="130" x2="${width-20}" y2="130" stroke="${colors.empty}"/>
<text x="30" y="150" class="meta">Total Cost (1y)</text><text x="105" y="150" class="bold">$${totalCost.toFixed(2)}</text>
<text x="180" y="150" class="meta">Tokens</text><text x="220" y="150" class="bold">${fmt(totalTokens)}</text>
<text x="280" y="150" class="meta">Active Days</text><text x="340" y="150" class="bold">${activeDays}</text>
<text x="${width-20}" y="150" text-anchor="end" class="meta">Updated: ${today.toISOString().split('T')[0]}</text>
</svg>`;

fs.writeFileSync(SVG_FILE, svg);
console.log('✅ SVG Generated.');

