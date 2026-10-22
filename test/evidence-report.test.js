const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { reviewEvidence } = require('../scripts/regression-report');
const root = path.resolve(__dirname, '..');

test('evidencia ausente o fuera de la carpeta permitida nunca se aprueba', () => {
  assert.equal(reviewEvidence({ path: 'evidence/team/not-delivered-report.json' }).status, 'pending');
  assert.equal(reviewEvidence({ path: 'evidence/team/../../package.json' }).status, 'invalid');
});

test('valida conteos y adjuntos reales sin confundir formato correcto con aprobacion tecnica', t => {
  const base = path.join(root, 'evidence/team');
  fs.mkdirSync(base, { recursive: true });
  const directory = fs.mkdtempSync(path.join(base, 'evidence-validator-'));
  const reportPath = path.join(directory, 'report.json');
  const artifact = path.join(directory, 'run.txt');
  t.after(() => {
    for (const file of [reportPath, artifact]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  });
  fs.writeFileSync(artifact, 'test-only evidence');
  const item = { ticket: 'RACE-45', path: path.relative(root, reportPath) };
  const report = { status: 'passed', ticket: 'RACE-45', commit: 'a'.repeat(40), generatedAt: new Date().toISOString(),
    tests: { total: 2, passed: 2, failed: 0 }, command: 'test-only-command', artifacts: [path.relative(root, artifact)] };
  fs.writeFileSync(reportPath, JSON.stringify(report));
  assert.equal(reviewEvidence(item).status, 'provided');
  assert.match(reviewEvidence(item).reason, /requiere revision tecnica/);
  report.tests.failed = 1;
  fs.writeFileSync(reportPath, JSON.stringify(report));
  assert.equal(reviewEvidence(item).status, 'invalid');
  report.tests.failed = 0;
  report.artifacts = ['README.md'];
  fs.writeFileSync(reportPath, JSON.stringify(report));
  assert.equal(reviewEvidence(item).status, 'invalid');
  fs.writeFileSync(reportPath, 'not-json');
  assert.equal(reviewEvidence(item).status, 'invalid');
});
