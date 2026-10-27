const { By, Key, until } = require('selenium-webdriver');

class RaceTrackPage {
  constructor(driver) { this.driver = driver; }
  async open(baseUrl) {
    await this.driver.get(baseUrl);
    await this.driver.wait(until.elementLocated(By.css('.event-card')), 15000);
    await this.driver.wait(async () => (await this.driver.findElements(By.css('#category option'))).length > 1, 15000);
  }
  async fill(id, value) {
    const field = await this.driver.findElement(By.id(id));
    // Use keyboard deletion so the browser emits input, as an actual user does.
    await field.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
    if (value) await field.sendKeys(value);
  }
  async click(id) { await this.driver.findElement(By.id(id)).click(); }
  async waitText(id, text) {
    const field = await this.driver.findElement(By.id(id));
    await this.driver.wait(until.elementTextContains(field, text), 15000); return field.getText();
  }
  async login(email, password) {
    await this.fill('email', email); await this.fill('password', password); await this.click('login');
  }
  async select(id, value) {
    await this.driver.findElement(By.css(`#${id} option[value="${value}"]`)).click();
  }
  async register(event, category) {
    await this.select('event', String(event)); await this.select('category', String(category));
    await this.click('submit-registration');
  }
}
module.exports = RaceTrackPage;
