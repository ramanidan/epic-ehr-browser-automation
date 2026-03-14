/**
 * Care gap extraction from Epic — HEDIS, UDS, and custom measure sets
 */
'use strict';
const { humanDelay } = require('../utils');

/**
 * Extract care gap data from Epic's reporting module.
 * @param {import('puppeteer').Page} page - Authenticated Epic page
 * @param {object} opts
 * @returns {Promise<Array<{patientMRN: string, measure: string, gapStatus: string, dueDate: string}>>}
 */
async function extractCareGaps(page, opts = {}) {
  const { measureYear = new Date().getFullYear() - 1, measureSets = ['HEDIS'], exportFormat = 'json' } = opts;

  console.log(`[care-gaps] Extracting ${measureSets.join(',')} care gaps for ${measureYear}`);

  const baseUrl = new URL(page.url()).origin;
  await page.goto(`${baseUrl}/analytics/care-gaps`, { waitUntil: 'networkidle2' });
  await humanDelay(800, 1500);

  // Select measure year
  await page.waitForSelector('#measure-year, [name="measureYear"]', { timeout: 15000 });
  await page.select('#measure-year, [name="measureYear"]', String(measureYear));
  await humanDelay();

  // Select measure sets
  for (const ms of measureSets) {
    const cb = await page.$(`input[value="${ms}"], input[name*="measureSet"][value="${ms}"]`);
    if (cb) { const checked = await cb.evaluate(el => el.checked); if (!checked) await cb.click(); }
  }

  // Run report
  await page.click('#run-report, button[data-action="run"]');
  await page.waitForSelector('.care-gap-results, [data-testid="gap-table"]', { timeout: 60000 });
  await humanDelay(1000, 2000);

  // Extract rows
  const gaps = await page.evaluate(() => {
    const rows = document.querySelectorAll('.care-gap-row, [data-testid="gap-row"]');
    return Array.from(rows).map(row => ({
      patientMRN: row.querySelector('[data-field="mrn"]')?.textContent.trim() || '',
      patientName: row.querySelector('[data-field="name"]')?.textContent.trim() || '',
      measure: row.querySelector('[data-field="measure"]')?.textContent.trim() || '',
      gapStatus: row.querySelector('[data-field="status"]')?.textContent.trim() || '',
      dueDate: row.querySelector('[data-field="due-date"]')?.textContent.trim() || '',
    }));
  });

  console.log(`[care-gaps] Found ${gaps.length} care gaps`);
  return gaps;
}

module.exports = { extractCareGaps };
