// scripts/update-stats.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const WEB_REPO_PATH = path.resolve(__dirname, '../../unsu0707.github.io'); // Adjust if repo is elsewhere
const PROFILE_REPO_PATH = path.resolve(__dirname, '..');
const JSON_DEST = path.join(WEB_REPO_PATH, 'data', 'claude_usage.json');
const SVG_DEST = path.join(PROFILE_REPO_PATH, 'assets', 'claude_usage.svg');
// ---------------------

function runCommand(command, cwd) {
    try {
        return execSync(command, { encoding: 'utf-8', stdio: 'pipe', cwd });
    } catch (e) {
        console.error(`Command failed: ${command}`);
        console.error(e.stderr);
        process.exit(1);
    }
}

// 1. Fetch Data
console.log('🔄 Fetching Claude usage data (this uses your local auth)...');
// We pass 'y' to confirm the "Ok to proceed?" prompt if ccusage asks
let rawData;
try {
    rawData = execSync('echo "y" | npx ccusage@latest --json', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
} catch (e) {
    console.error("Failed to run ccusage. Make sure you are logged in.");
    process.exit(1);
}

// ccusage might output "Need to install..." or other text before the JSON.
// We need to find the start of the JSON object.
const jsonStartIndex = rawData.indexOf('{');
const jsonString = rawData.substring(jsonStartIndex);
const usageData = JSON.parse(jsonString);

console.log('✅ Data fetched successfully.');

// 2. Generate SVG (GitHub Contribution Style)
console.log('🎨 Generating Heatmap SVG...');

const dailyStats = usageData.daily || [];
const dateMap = {};
let maxCost = 0;

dailyStats.forEach(day => {
  dateMap[day.date] = day.totalCost;
  if (day.totalCost > maxCost) maxCost = day.totalCost;
});

// Config: 53 weeks wide, 7 days high. Cell size 10px, padding 2px.
const cellSize = 10;
const cellPadding = 2;
const width = 53 * (cellSize + cellPadding) + 20;
const height = 7 * (cellSize + cellPadding) + 40; // Increased height for footer

let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .day { shape-rendering: geometricPrecision; }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10px; fill: #768390; }
    .label { font-weight: 600; }
  </style>
  <rect width="100%" height="100%" fill="#0d1117" rx="6" />
  <g transform="translate(14, 25)">`;

// Calculate date range (Last 365 days aligned to end on today)
const today = new Date();
const endDate = new Date(today);
const startDate = new Date(today);
startDate.setDate(startDate.getDate() - 364);

// Find offset to ensure the grid starts correctly aligned (GitHub starts on Sunday)
const startDay = startDate.getDay(); 

const formatDate = (d) => d.toISOString().split('T')[0];
const getColor = (cost) => {
  if (!cost || cost === 0) return '#161b22';
  const intensity = cost / (maxCost > 0 ? maxCost : 1);
  // GitHub-like greens
  if (intensity < 0.25) return '#0e4429'; 
  if (intensity < 0.50) return '#006d32'; 
  if (intensity < 0.75) return '#26a641'; 
  return '#39d353'; 
};

let currentWeek = 0;
for (let i = 0; i < 365 + startDay; i++) {
  // Logic to align the first week if startDate isn't Sunday
  if (i < startDay) continue;

  const currentDate = new Date(startDate);
  currentDate.setDate(startDate.getDate() + (i - startDay));
  
  const dayOfWeek = currentDate.getDay(); // 0-6
  const dateStr = formatDate(currentDate);
  const cost = dateMap[dateStr] || 0;
  
  const x = currentWeek * (cellSize + cellPadding);
  const y = dayOfWeek * (cellSize + cellPadding);

  svgContent += `<rect class="day" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" ry="2" fill="${getColor(cost)}">
    <title>${dateStr}: $${cost.toFixed(2)}</title>
  </rect>`;

  if (dayOfWeek === 6) currentWeek++;
}

svgContent += `</g>
  <text x="14" y="15" class="label">Claude & Codex Usage Cost</text>
  <text x="${width - 15}" y="15" text-anchor="end">Max Daily: $${maxCost.toFixed(2)}</text>
  <text x="14" y="${height - 10}" font-size="9">Updated: ${formatDate(today)}</text>
</svg>`;

// 3. Write Files
// Ensure directories exist
const assetsDir = path.dirname(SVG_DEST);
const dataDir = path.dirname(JSON_DEST);
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(SVG_DEST, svgContent);
console.log(`✅ SVG saved to: ${SVG_DEST}`);

fs.writeFileSync(JSON_DEST, JSON.stringify(usageData, null, 2));
console.log(`✅ JSON saved to: ${JSON_DEST}`);

// 4. Git Operations
console.log('🚀 Pushing changes to GitHub...');

// Push Profile Repo
console.log('...Pushing Profile Repo');
runCommand(`git add "${SVG_DEST}"`, PROFILE_REPO_PATH);
try {
    runCommand('git commit -m "chore: update claude usage graph"', PROFILE_REPO_PATH);
    runCommand('git push', PROFILE_REPO_PATH);
} catch (e) {
    console.log('   (No changes to commit in Profile Repo)');
}

// Push Web Repo
console.log('...Pushing Web Repo');
runCommand(`git add "${JSON_DEST}"`, WEB_REPO_PATH);
try {
    runCommand('git commit -m "data: update claude usage stats"', WEB_REPO_PATH);
    runCommand('git push', WEB_REPO_PATH);
} catch (e) {
    console.log('   (No changes to commit in Web Repo)');
}

console.log('🎉 Done! Data updated on both repositories.');

