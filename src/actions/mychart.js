/**
 * MyChart patient portal automation
 */
'use strict';
const { humanDelay } = require('../utils');

/**
 * Send a message to a patient via MyChart secure messaging.
 */
async function sendMyChartMessage(page, opts) {
  const { patientPortalId, subject, messageBody, urgency = 'normal' } = opts;
  console.log(`[mychart] Sending message to portal ID ${patientPortalId}`);

  const baseUrl = new URL(page.url()).origin;
  await page.goto(`${baseUrl}/MyChart/messaging/compose`, { waitUntil: 'networkidle2' });
  await humanDelay();

  await page.waitForSelector('#recipient-search, [name="patientPortalId"]', { timeout: 15000 });
  await page.type('#recipient-search, [name="patientPortalId"]', patientPortalId, { delay: 50 });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.recipient-suggestion:first-child', { timeout: 10000 });
  await page.click('.recipient-suggestion:first-child');

  await page.type('#message-subject, [name="subject"]', subject, { delay: 50 });
  await humanDelay(300, 600);

  const bodyField = await page.$('#message-body, textarea[name="messageBody"]');
  if (bodyField) await bodyField.type(messageBody, { delay: 30 });

  if (urgency === 'urgent') {
    const urgentCb = await page.$('#urgent-flag, input[name="urgent"]');
    if (urgentCb) await urgentCb.click();
  }

  await page.click('#send-btn, button[type="submit"]');
  await page.waitForSelector('.message-sent, .success-banner', { timeout: 15000 });
  console.log('[mychart] Message sent successfully');
}

/**
 * Extract MyChart messages for a patient.
 */
async function getMyChartMessages(page, patientPortalId, opts = {}) {
  const { unreadOnly = false, limit = 50 } = opts;
  const baseUrl = new URL(page.url()).origin;
  await page.goto(`${baseUrl}/MyChart/messaging/inbox`, { waitUntil: 'networkidle2' });
  await humanDelay(600, 1200);

  if (unreadOnly) {
    const unreadFilter = await page.$('#filter-unread, [data-filter="unread"]');
    if (unreadFilter) await unreadFilter.click();
  }

  const messages = await page.evaluate((lim) => {
    const rows = Array.from(document.querySelectorAll('.message-row, [data-testid="message-row"]')).slice(0, lim);
    return rows.map(row => ({
      id: row.dataset.messageId || '',
      from: row.querySelector('[data-field="from"]')?.textContent.trim() || '',
      subject: row.querySelector('[data-field="subject"]')?.textContent.trim() || '',
      date: row.querySelector('[data-field="date"]')?.textContent.trim() || '',
      read: !row.classList.contains('unread'),
    }));
  }, limit);

  return messages;
}

module.exports = { sendMyChartMessage, getMyChartMessages };
