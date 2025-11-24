const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to Fetch & Merge
function updateService(name, command, fileName) {
    const filePath = path.join(ROOT_DIR, 'data', fileName);
    console.log(`\n📊 Processing ${name}...`);

    // 1. Fetch
    console.log(`   Fetching fresh data...`);
    let freshData;
    try {
        // Echo 'y' to handle installation prompts automatically
        const output = execSync(`echo "y" | ${command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
        const jsonStart = output.indexOf('{');
        if (jsonStart === -1) throw new Error("No JSON output found.");
        freshData = JSON.parse(output.substring(jsonStart));
    } catch (e) {
        console.error(`❌ Failed to fetch ${name}: ${e.message}`);
        return; 
    }

    // 2. Load Existing History
    let history = { daily: [] };
    if (fs.existsSync(filePath)) {
        try {
            history = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.warn(`   ⚠️ Could not read existing history, starting fresh.`);
        }
    }

    // 3. Merge (Deduplicate by Date)
    const map = new Map();
    // Load old history (Normalize date keys to YYYY-MM-DD)
    (history.daily || []).forEach(d => {
        const key = new Date(d.date).toISOString().split('T')[0];
        map.set(key, d);
    });
    // Overlay fresh data
    (freshData.daily || []).forEach(d => {
        const key = new Date(d.date).toISOString().split('T')[0];
        map.set(key, d);
    });

    // 4. Sort & Save
    const sorted = Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    history.daily = sorted;
    history.lastUpdated = new Date().toISOString();

    const dataDir = path.dirname(filePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
    
    console.log(`✅ ${name} history updated (${sorted.length} days).`);
}

// --- EXECUTION ---
console.log('📡 Syncing with Remote...');
try { execSync('git pull', { stdio: 'ignore', cwd: ROOT_DIR }); } catch (e) {}

// Update Claude (Legacy file: usage_history.json)
updateService('Claude', 'npx ccusage@latest --json', 'usage_history.json');

// Update Codex (New file: codex_history.json)
updateService('Codex', 'npx @ccusage/codex@latest --json', 'codex_history.json');

console.log('\n🚀 Pushing data to GitHub...');
try {
    execSync('git add data/*.json', { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('git commit -m "data: update AI usage history" || echo "No changes"', { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('git push', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('✅ Done. GitHub Action will generate graphs.');
} catch (e) {
    console.log('ℹ️ Push failed or no changes.');
}
