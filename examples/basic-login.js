/**
 * Example: Basic Epic EHR login test
 * Run: node examples/basic-login.js
 */
require('dotenv').config();
const puppeteer = require('puppeteer');
const { EpicAuth } = require('../src/auth');
const { SessionManager } = require('../src/session');

async function main() {
  if (!process.env.EPIC_BASE_URL || !process.env.EPIC_USERNAME) {
    console.error('Missing required env vars: EPIC_BASE_URL, EPIC_USERNAME, EPIC_PASSWORD');
    console.error('Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const session = new SessionManager('./sessions');
  const auth = new EpicAuth({
    epicUrl: process.env.EPIC_BASE_URL,
    username: process.env.EPIC_USERNAME,
    password: process.env.EPIC_PASSWORD,
    mfaSecret: process.env.EPIC_MFA_SECRET,
    ssoProvider: process.env.EPIC_SSO_PROVIDER || 'native',
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Try to restore session first
  const restored = await session.restore('epic-session', page);
  if (!restored) {
    console.log('No valid session found — logging in...');
    await auth.login(page);
    await session.save('epic-session', page);
  } else {
    console.log('Session restored — navigating to verify...');
    await page.goto(process.env.EPIC_BASE_URL, { waitUntil: 'networkidle2' });
  }

  console.log('✅ Successfully logged into Epic EHR at:', page.url());
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
