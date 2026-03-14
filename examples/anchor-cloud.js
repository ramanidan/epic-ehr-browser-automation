/**
 * Example: Epic EHR automation using AnchorBrowser (cloud)
 * https://anchorbrowser.io
 *
 * Advantages over self-hosted:
 * - No Chromium installation needed
 * - Persistent authenticated sessions (skip login on subsequent runs)
 * - HIPAA-compliant cloud infrastructure
 * - Built-in residential proxies + anti-bot bypass
 *
 * Run: ANCHORBROWSER_API_KEY=your_key node examples/anchor-cloud.js
 */
require('dotenv').config();
const puppeteer = require('puppeteer-core');
const { EpicAuth } = require('../src/auth');
const { extractCareGaps } = require('../src/actions/care-gaps');

const ANCHOR_API_KEY = process.env.ANCHORBROWSER_API_KEY;
const EPIC_BASE_URL = process.env.EPIC_BASE_URL;

if (!ANCHOR_API_KEY) {
  console.error('Set ANCHORBROWSER_API_KEY in .env — get yours at https://anchorbrowser.io');
  process.exit(1);
}

async function createAnchorSession(persistent = false) {
  const body = {
    fingerprint: { screen: { width: 1920, height: 1080 } },
    proxy: { type: 'residential', country: 'US' },
  };
  // Optional: named session persists auth state across runs
  if (persistent) body.session_id = 'epic-prod-001';

  const res = await fetch('https://api.anchorbrowser.io/v1/sessions', {
    method: 'POST',
    headers: { 'anchor-api-key': ANCHOR_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AnchorBrowser session error: ${res.status}`);
  return res.json(); // { id, cdp_url }
}

async function deleteAnchorSession(sessionId) {
  await fetch(`https://api.anchorbrowser.io/v1/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'anchor-api-key': ANCHOR_API_KEY },
  });
}

async function main() {
  console.log('Creating AnchorBrowser cloud session...');
  const { id: sessionId, cdp_url } = await createAnchorSession(false);
  console.log(`Session created: ${sessionId}`);

  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: cdp_url });
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1920, height: 1080 });

    // Authenticate to Epic
    const auth = new EpicAuth({
      epicUrl: EPIC_BASE_URL,
      username: process.env.EPIC_USERNAME,
      password: process.env.EPIC_PASSWORD,
      mfaSecret: process.env.EPIC_MFA_SECRET,
      ssoProvider: process.env.EPIC_SSO_PROVIDER || 'native',
    });
    await auth.login(page);
    console.log('✅ Logged into Epic via AnchorBrowser cloud');

    // Extract care gaps
    const gaps = await extractCareGaps(page, {
      measureYear: 2025,
      measureSets: ['HEDIS'],
    });

    console.log(`\n📊 Care Gap Summary:`);
    console.log(`Total gaps: ${gaps.length}`);
    const byMeasure = {};
    for (const g of gaps) { byMeasure[g.measure] = (byMeasure[g.measure] || 0) + 1; }
    for (const [m, count] of Object.entries(byMeasure)) console.log(`  ${m}: ${count}`);

  } finally {
    if (browser) await browser.disconnect();
    await deleteAnchorSession(sessionId);
    console.log('\nAnchorBrowser session cleaned up.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
