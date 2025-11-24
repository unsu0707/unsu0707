// scripts/fetch.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'usage_history.json');

console.log('📡 1. Syncing with Remote...');
try {
    // Ensure we have the latest history from GitHub before merging
    execSync('git pull', { stdio: 'ignore', cwd: ROOT_DIR });
} catch (e) {
    console.warn('⚠️  Git pull failed (maybe no remote yet). Continuing...');
}

console.log('📊 2. Fetching fresh data (Last 30 days)...');
let freshData;
try {
    const output = execSync('echo "y" | npx ccusage@latest --json', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const jsonStart = output.indexOf('{');
    freshData = JSON.parse(output.substring(jsonStart));
} catch (e) {
    console.error('❌ Failed to fetch. Check internet/login.');
    process.exit(1);
}

console.log('🔗 3. Merging History...');
let history = { daily: [] };
if (fs.existsSync(DATA_FILE)) {
    history = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

const map = new Map();
// Load old history
(history.daily || []).forEach(d => map.set(d.date, d));
// Overwrite with fresh data
(freshData.daily || []).forEach(d => map.set(d.date, d));

// Sort and Save
const sorted = Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
history.daily = sorted;
history.lastUpdated = new Date().toISOString();

const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));

console.log('🚀 4. Pushing JSON to GitHub...');
try {
    execSync(`git add "${DATA_FILE}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('git commit -m "data: update claude usage history"', { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('git push', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('✅ JSON pushed. GitHub Action will now generate the graph.');
} catch (e) {
    console.log('ℹ️  No changes to push.');
}
