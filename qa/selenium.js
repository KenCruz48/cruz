const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const RaceTrackPage = require('./pages/RaceTrackPage');

async function runSelenium(fixture, output) {
  const options = new chrome.Options().addArguments('--headless=new', '--window-size=1400,1100', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage');
  options.setPageLoadStrategy('eager');
  if (process.env.CHROME_BINARY) options.setChromeBinaryPath(process.env.CHROME_BINARY);
  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  if (process.env.CHROMEDRIVER_PATH) builder.setChromeService(new chrome.ServiceBuilder(process.env.CHROMEDRIVER_PATH));
  const driver = await builder.build();
  await driver.manage().setTimeouts({ pageLoad: 30000, script: 30000, implicit: 0 });
  const checks = [];
  const page = new RaceTrackPage(driver);
  try {
    await page.open(fixture.baseUrl);
    await page.login('runner@example.invalid', 'incorrecta');
    await page.waitText('account-status', 'Credenciales invalidas'); checks.push('Login inválido visible');
    await page.login('runner@example.invalid', fixture.password);
    await page.waitText('account-status', 'QA Corredor'); checks.push('Login válido');
    await page.register(fixture.event._id, fixture.category._id);
    await page.waitText('registration-status', 'Inscripción confirmada'); checks.push('Inscripción real desde UI');
    await page.register(fixture.event._id, fixture.category._id);
    await page.waitText('registration-status', 'inscripcion activa'); checks.push('Duplicado rechazado');
    fs.writeFileSync(path.join(output, 'selenium-registration.png'), await driver.takeScreenshot(), 'base64');
    await page.click('cancel-registration');
    await page.waitText('registration-status', 'Inscripción cancelada'); checks.push('Cancelación real desde UI');
    await page.click('logout');
    assert.equal(await driver.executeScript('return window.localStorage.length'), 0);
    await page.waitText('account-status', 'Sesión cerrada'); checks.push('Logout y token fuera de localStorage');
    fs.writeFileSync(path.join(output, 'selenium-final.png'), await driver.takeScreenshot(), 'base64');
    return checks;
  } finally { await driver.quit(); }
}
module.exports = { runSelenium };
