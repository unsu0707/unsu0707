const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const ROOT_DIR = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT_DIR, 'usage.svg');
// ---------------------

console.log('📊 1. Fetching Claude usage data...');

let usageData;
try {
    // Fetch data using local credentials
    const output = execSync('echo "y" | npx ccusage@latest --json', { 
        encoding: 'utf-8', 
        stdio: ['pipe', 'pipe', 'ignore'] 
    });
    const jsonStart = output.indexOf('{');
    if (jsonStart === -1) throw new Error("No JSON found");
    usageData = JSON.parse(output.substring(jsonStart));
} catch (e) {
    console.error("❌ Failed to fetch data. Ensure you are logged in.");
    process.exit(1);
}

console.log('🧮 2. Processing Data...');

// Map Data & Calculate Stats for the visual range (Last 365 Days)
const dateMap = {};
const dailyStats = usageData.daily || [];
let maxCost = 0;
let totalCostYear = 0;
let totalTokensYear = 0;
let activeDays = 0;

// Helper to format large numbers (e.g. 1.2M)
const formatTokens = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

dailyStats.forEach(day => {
    dateMap[day.date] = day.totalCost;
    // We calculate totals here, but we will refine them in the 365-day loop to be exact
});

// --- SVG CONFIGURATION ---
// Style: GitHub Light Mode
const colors = {
    bg: '#ffffff',      // White background
    empty: '#ebedf0',   // Gray
    l1: '#9be9a8',      // Light Green
    l2: '#40c463',      // Medium Green
    l3: '#30a14e',      // Dark Green
    l4: '#216e39',      // Darkest Green
    text: '#24292f',    // Black/Dark Gray text
    meta: '#57606a'     // Light Gray text
};

const boxSize = 10;
const boxMargin = 3;
const weekWidth = boxSize + boxMargin;
const weeks = 53; 
const days = 7;
const headerHeight = 30; // Space for Month labels
const leftMargin = 30;   // Space for Day labels
const footerHeight = 40; // Space for Summary
const width = leftMargin + (weeks * weekWidth) + 20;
const height = headerHeight + (days * weekWidth) + footerHeight;

// Color Scale Function
const getColor = (cost) => {
    if (!cost || cost === 0) return colors.empty;
    // Dynamic scale based on max cost found
    const intensity = cost / (maxCost > 0 ? maxCost : 10); // Default max $10 if 0
    if (intensity < 0.25) return colors.l1;
    if (intensity < 0.50) return colors.l2;
    if (intensity < 0.75) return colors.l3;
    return colors.l4;
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Start SVG Construction
let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10px; fill: ${colors.text}; }
    .meta { fill: ${colors.meta}; }
    .label { font-size: 9px; fill: ${colors.meta}; }
    .stat-value { font-weight: 600; font-size: 12px; }
    .stat-label { font-size: 10px; fill: ${colors.meta}; }
  </style>
  <rect width="100%" height="100%" fill="${colors.bg}" rx="6" />
  <g transform="translate(${leftMargin}, ${headerHeight})">`;

// Calculate Date Range (Last 365 Days ending today)
const today = new Date();
const startDate = new Date(today);
startDate.setDate(today.getDate() - (52 * 7) - today.getDay()); 

let currentMonth = -1;

// --- DRAW GRID ---
for (let w = 0; w < weeks; w++) {
    const x = w * weekWidth;
    
    // Month Labels
    const weekDate = new Date(startDate);
    weekDate.setDate(startDate.getDate() + (w * 7));
    if (weekDate.getMonth() !== currentMonth && w < 52) {
        currentMonth = weekDate.getMonth();
        svg += `<text x="${x}" y="-10" class="label">${monthNames[currentMonth]}</text>`;
    }

    for (let d = 0; d < days; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + (w * 7) + d);
        
        if (currentDate > today) continue;

        const dateStr = currentDate.toISOString().split('T')[0];
        // Find data for this specific day
        const dayData = dailyStats.find(s => s.date === dateStr);
        const cost = dayData ? dayData.totalCost : 0;
        const tokens = dayData ? dayData.totalTokens : 0;

        // Aggregate 365-day Stats
        if (dayData) {
            totalCostYear += cost;
            totalTokensYear += tokens;
            if (cost > 0) activeDays++;
            if (cost > maxCost) maxCost = cost;
        }

        const y = d * weekWidth;
        svg += `<rect x="${x}" y="${y}" width="${boxSize}" height="${boxSize}" rx="2" ry="2" fill="${getColor(cost)}">
            <title>${dateStr}: $${cost.toFixed(2)} (${formatTokens(tokens)} tokens)</title>
        </rect>`;
    }
}
svg += `</g>`;

// --- DRAW DAY LABELS ---
svg += `
  <text x="5" y="${headerHeight + (1 * weekWidth) + 9}" class="label">Mon</text>
  <text x="5" y="${headerHeight + (3 * weekWidth) + 9}" class="label">Wed</text>
  <text x="5" y="${headerHeight + (5 * weekWidth) + 9}" class="label">Fri</text>
`;

// --- SUMMARY FOOTER ---
const footerY = height - 15;
const col1 = leftMargin;
const col2 = leftMargin + 130;
const col3 = leftMargin + 260;

svg += `
  <line x1="${leftMargin}" y1="${height - footerHeight + 5}" x2="${width - 20}" y2="${height - footerHeight + 5}" stroke="${colors.empty}" stroke-width="1" />
  
  <text x="${col1}" y="${footerY}" class="stat-label">Total Cost (1y)</text>
  <text x="${col1 + 75}" y="${footerY}" class="stat-value">$${totalCostYear.toFixed(2)}</text>

  <text x="${col2}" y="${footerY}" class="stat-label">Total Tokens</text>
  <text x="${col2 + 70}" y="${footerY}" class="stat-value">${formatTokens(totalTokensYear)}</text>

  <text x="${col3}" y="${footerY}" class="stat-label">Active Days</text>
  <text x="${col3 + 65}" y="${footerY}" class="stat-value">${activeDays}</text>
  
  <text x="${width - 15}" y="${footerY}" text-anchor="end" class="label">Updated: ${today.toISOString().split('T')[0]}</text>
</svg>`;

// Write File
fs.writeFileSync(SVG_PATH, svg);
console.log(`✅ SVG Generated at: ${SVG_PATH}`);

// Git Operations
console.log('🚀 3. Pushing to GitHub...');
try {
    const gitOptions = { cwd: ROOT_DIR, stdio: 'inherit' };
    execSync(`git add "${SVG_PATH}"`, gitOptions);
    execSync('git commit -m "chore: update usage graph stats"', gitOptions);
    execSync('git push', gitOptions);
    console.log('🎉 Done! Stats updated.');
} catch (e) {
    console.log('ℹ️ No changes to commit.');
}
