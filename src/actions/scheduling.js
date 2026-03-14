/**
 * Patient scheduling actions for Epic EHR
 */
'use strict';
const { humanDelay } = require('../utils');

/**
 * Schedule a patient appointment in Epic.
 * @param {import('puppeteer').Page} page - Authenticated Epic page
 * @param {object} opts
 * @returns {Promise<{appointmentId: string, scheduledDate: string, confirmationNumber: string}>}
 */
async function scheduleAppointment(page, opts) {
  const {
    patientMRN,
    providerNPI,
    appointmentType,
    preferredDate,
    preferredTime,
    department,
    visitReason,
  } = opts;

  console.log(`[scheduling] Scheduling appointment for MRN ${patientMRN}`);

  // Navigate to scheduling module
  await page.goto(`${getBaseUrl(page)}/scheduling/new-appointment`, { waitUntil: 'networkidle2' });
  await humanDelay(500, 1000);

  // Search for patient
  await page.waitForSelector('#patient-search, [data-testid="patient-search"]', { timeout: 15000 });
  await page.type('#patient-search, [data-testid="patient-search"]', patientMRN, { delay: 60 });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.patient-result, [data-testid="patient-result"]', { timeout: 10000 });
  await page.click('.patient-result:first-child, [data-testid="patient-result"]:first-child');
  await humanDelay();

  // Select appointment type
  await page.waitForSelector('#appointment-type, [name="appointmentType"]', { timeout: 10000 });
  await page.select('#appointment-type, [name="appointmentType"]', appointmentType);
  await humanDelay();

  // Select department and provider
  if (department) {
    await page.select('#department, [name="department"]', department).catch(() => {});
    await humanDelay(300, 600);
  }
  if (providerNPI) {
    await page.type('#provider-npi, [name="providerNPI"]', providerNPI, { delay: 50 });
    await humanDelay(300, 600);
  }

  // Set date and time
  const dateInput = await page.$('input[name="preferredDate"], input[type="date"]');
  if (dateInput) {
    await dateInput.click({ clickCount: 3 });
    await dateInput.type(preferredDate);
  }
  if (preferredTime) {
    const timeInput = await page.$('input[name="preferredTime"], input[type="time"]');
    if (timeInput) {
      await timeInput.click({ clickCount: 3 });
      await timeInput.type(preferredTime);
    }
  }

  // Visit reason
  if (visitReason) {
    const reasonField = await page.$('#visit-reason, textarea[name="visitReason"]');
    if (reasonField) await reasonField.type(visitReason, { delay: 40 });
  }

  await humanDelay(500, 1000);

  // Submit
  await page.click('#schedule-btn, button[type="submit"]');
  await page.waitForSelector('.confirmation, [data-testid="appointment-confirmation"]', { timeout: 30000 });

  const appointmentId = await page.$eval('.appointment-id, [data-testid="appointment-id"]', el => el.textContent.trim()).catch(() => 'UNKNOWN');
  const scheduledDate = await page.$eval('.scheduled-date, [data-testid="scheduled-date"]', el => el.textContent.trim()).catch(() => preferredDate);
  const confirmationNumber = await page.$eval('.confirmation-number, [data-testid="confirmation-number"]', el => el.textContent.trim()).catch(() => '');

  console.log(`[scheduling] Appointment scheduled: ${appointmentId}`);
  return { appointmentId, scheduledDate, confirmationNumber };
}

function getBaseUrl(page) {
  const url = new URL(page.url());
  return url.origin;
}

module.exports = { scheduleAppointment };
