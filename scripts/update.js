const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const ROOT_DIR = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT_DIR, 'usage.svg');
// --------------

console.log('🤖 1. Fetching Claude usage (Local Auth)...');
let usageData;

try {
    // Pipe "y" to handle the confirmation prompt
    const output = execSync('echo "y" | npx ccusage@latest --json', { 
        encoding: 'utf-8', 
        stdio: ['pipe', 'pipe', 'ignore'] 
    });
    
    // Extract JSON from output
    const jsonStart = output.indexOf('{');
    if (jsonStart === -1) throw new Error("No JSON found in output");
    usageData = JSON.parse(output.substring(jsonStart));
} catch (e) {
    console.error("❌ Error fetching data:", e.message);
    console.log("👉 Make sure you are logged in via browser and internet is active.");
    process.exit(1);
}

console.log('🎨 2. Generating SVG Graph...');

// Process Data
const dailyStats = usageData.daily || [];
const dateMap = {};
let maxCost = 0;

dailyStats.forEach(day => {
    dateMap[day.date] = day.totalCost;
    if (day.totalCost > maxCost) maxCost = day.totalCost;
});

// SVG Dimensions (GitHub Contribution Graph Style)
const cellSize = 10;
const cellPadding = 3;
const cols = 53; // 1 year
const rows = 7;
const width = cols * (cellSize + cellPadding) + 20;
const height = rows * (cellSize + cellPadding) + 35; // Extra space for labels

// Helper: Color Scale (GitHub Dark Green Theme)
const getColor = (cost) => {
    if (!cost || cost === 0) return '#161b22'; // Empty/Gray
    const intensity = cost / (maxCost || 1);
    if (intensity < 0.25) return '#0e4429'; 
    if (intensity < 0.50) return '#006d32'; 
    if (intensity < 0.75) return '#26a641'; 
    return '#39d353'; 
};

// Generate SVG String
let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10px; fill: #768390; }
  </style>
  <rect width="100%" height="100%" fill="#0d1117" rx="6" />
  <g transform="translate(10, 25)">`;

// Calculate Dates: Last 365 Days
const today = new Date();
const startDate = new Date(today);
startDate.setDate(startDate.getDate() - 364);

// Align start date to the grid (so the graph flows naturally)
// We simply loop 365 days.
const startOffset = startDate.getDay(); 

let currentWeek = 0;

for (let i = 0; i <= 365; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    
    // Filter out days before the first Sunday to align columns if desired, 
    // or just render straight through. Let's render straight 52 weeks.
    
    const dayOfWeek = d.getDay(); // 0 = Sun
    const dateStr = d.toISOString().split('T')[0];
    const cost = dateMap[dateStr] || 0;

    const x = currentWeek * (cellSize + cellPadding);
    const y = dayOfWeek * (cellSize + cellPadding);

    svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" ry="2" fill="${getColor(cost)}">
        <title>${dateStr}: $${cost.toFixed(2)}</title>
    </rect>`;

    if (dayOfWeek === 6) currentWeek++;
}

svg += `</g>
  <text x="10" y="15" font-weight="bold" fill="#c9d1d9">Claude & Codex Usage</text>
  <text x="${width - 10}" y="15" text-anchor="end">Max: $${maxCost.toFixed(2)}</text>
  <text x="10" y="${height - 8}" font-size="9">Last updated: ${today.toISOString().split('T')[0]}</text>
</svg>`;

// Save SVG
fs.writeFileSync(SVG_PATH, svg);
console.log('✅ SVG saved to root.');

console.log('🚀 3. Committing and Pushing...');
try {
    const gitCwd = { cwd: ROOT_DIR, stdio: 'inherit' };
    execSync('git add usage.svg', gitCwd);
    execSync('git commit -m "chore: update daily usage graph"', gitCwd);
    execSync('git push', gitCwd);
    console.log('🎉 Success! Check your GitHub profile.');
} catch (e) {
    console.log('ℹ️ No changes to commit or push failed.');
}
