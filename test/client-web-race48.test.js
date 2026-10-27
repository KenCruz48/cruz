const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');

function startServer(t) {
  const server = app.listen(0);

  t.after(() =>
    new Promise((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    })
  );

  return `http://127.0.0.1:${server.address().port}`;
}

test(
  'RACE-48 GET / entrega el cliente web',
  async t => {
    const baseUrl = startServer(t);

    const response =
      await fetch(`${baseUrl}/`);

    const html =
      await response.text();

    assert.equal(
      response.status,
      200
    );

    assert.match(
      response.headers.get('content-type'),
      /text\/html/
    );

    assert.match(
      html,
      /RaceTrack/
    );
  }
);

test(
  'RACE-48 cliente web contiene localizadores estables para Selenium',
  async t => {
    const baseUrl = startServer(t);

    const response =
      await fetch(`${baseUrl}/`);

    const html =
      await response.text();

    const ids = [
      'page-title',
      'login-form',
      'login-email',
      'login-password',
      'login-button',
      'login-message',
      'registration-section',
      'user-name',
      'refresh-data-button',
      'registration-form',
      'events-select',
      'categories-select',
      'register-button',
      'status-message',
    ];

    for (const id of ids) {
      assert.match(
        html,
        new RegExp(`id=["']${id}["']`)
      );
    }
  }
);

test(
  'RACE-48 sirve JavaScript y CSS del cliente',
  async t => {
    const baseUrl = startServer(t);

    const [
      jsResponse,
      cssResponse,
    ] = await Promise.all([
      fetch(`${baseUrl}/app.js`),
      fetch(`${baseUrl}/styles.css`),
    ]);

    const javascript =
      await jsResponse.text();

    const css =
      await cssResponse.text();

    assert.equal(
      jsResponse.status,
      200
    );

    assert.equal(
      cssResponse.status,
      200
    );

    assert.match(
      javascript,
      /\/api\/v1\/users\/login/
    );

    assert.match(
      javascript,
      /\/api\/v1\/registrations/
    );

    assert.match(
      javascript,
      /\/api\/v1\/events/
    );

    assert.match(
      javascript,
      /\/api\/v1\/categories/
    );

    assert.match(
      css,
      /\.success/
    );

    assert.match(
      css,
      /\.error/
    );
  }
);