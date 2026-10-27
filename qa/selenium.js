const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const RaceTrackPage = require('./pages/RaceTrackPage');

async function runSelenium(fixture, output) {
  const options = new chrome.Options().addArguments('--headless=new', '--window-size=1400,1100', '--no-sandbox');
  if (process.env.CHROME_BINARY) options.setChromeBinaryPath(process.env.CHROME_BINARY);
  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  if (process.env.CHROMEDRIVER_PATH) builder.setChromeService(new chrome.ServiceBuilder(process.env.CHROMEDRIVER_PATH));
  const driver = await builder.build();
  const checks = [];
  const page = new RaceTrackPage(driver);
  try {
    await page.open(fixture.baseUrl);
    const menuRows = await driver.executeScript("return [...document.querySelectorAll('.nav-link')].map(n => Math.round(n.getBoundingClientRect().y))");
    assert.equal(new Set(menuRows).size, 1); checks.push('Menú horizontal en escritorio');
    await page.fill('event-search', 'sin-coincidencias-qa-2026');
    assert.equal((await driver.findElements(By.css('.event-card'))).length, 0);
    await page.fill('event-search', '');
    assert.ok((await driver.findElements(By.css('.event-card'))).length > 0); checks.push('Búsqueda y estado sin coincidencias');
    fs.writeFileSync(path.join(output, 'selenium-desktop.png'), await driver.takeScreenshot(), 'base64');
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
    await driver.manage().window().setRect({ width: 390, height: 844 });
    await driver.get(fixture.baseUrl);
    await driver.wait(async () => (await driver.findElements(By.css('.event-card'))).length > 0, 15000);
    assert.equal(await driver.executeScript('return document.documentElement.scrollWidth > window.innerWidth'), false);
    const mobileRows = await driver.executeScript("return [...document.querySelectorAll('.nav-link')].map(n => Math.round(n.getBoundingClientRect().y))");
    assert.equal(new Set(mobileRows).size, 1); checks.push('Móvil sin desbordamiento y navegación horizontal');
    fs.writeFileSync(path.join(output, 'selenium-mobile.png'), await driver.takeScreenshot(), 'base64');
    return checks;
  } finally { await driver.quit(); }
}
module.exports = { runSelenium };
