const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function reviewEvidence(item) {
  const target = path.resolve(root, item.path);
  const allowed = path.join(root, 'evidence', 'team') + path.sep;
  if (!target.startsWith(allowed)) return { ...item, status: 'invalid', reason: 'Ruta fuera de evidence/team' };
  if (!fs.existsSync(target)) return { ...item, status: 'pending', reason: 'Archivo no entregado' };
  try {
    const report = JSON.parse(fs.readFileSync(target, 'utf8'));
    const valid = report.status === 'passed' && report.ticket === item.ticket
      && typeof report.commit === 'string' && /^[a-f0-9]{40}$/i.test(report.commit)
      && typeof report.generatedAt === 'string' && Number.isFinite(Date.parse(report.generatedAt))
      && Date.parse(report.generatedAt) <= Date.now()
      && report.tests?.total > 0 && Number.isSafeInteger(report.tests.total)
      && report.tests.failed === 0 && report.tests.passed === report.tests.total
      && typeof report.command === 'string' && report.command.trim().length > 0
      && Array.isArray(report.artifacts) && report.artifacts.length > 0
      && report.artifacts.every(file => {
        if (typeof file !== 'string') return false;
        const resolved = path.resolve(root, file);
        return resolved.startsWith(allowed) && fs.existsSync(resolved) && fs.statSync(resolved).isFile();
      });
    return { ...item, status: valid ? 'provided' : 'invalid', reason: valid
      ? 'Formato y adjuntos presentes; requiere revision tecnica del Scrum Master'
      : 'Reporte incompleto, fallido o sin adjuntos verificables', commit: report.commit };
  } catch { return { ...item, status: 'invalid', reason: 'JSON ilegible o adjuntos no verificables' }; }
}

function run() {
  const output = path.join(root, 'evidence', 'generated');
  fs.mkdirSync(output, { recursive: true });
  const tested = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], {
    cwd: root, env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(output, 'regression.tap'), tested.stdout || '');
  fs.writeFileSync(path.join(output, 'regression.stderr.txt'), tested.stderr || '');
  const count = name => Number((tested.stdout || '').match(new RegExp(`^# ${name} (\\d+)`, 'm'))?.[1] || 0);
  const tests = { total: count('tests'), passed: count('pass'), failed: count('fail') };
  const corePassed = tested.status === 0 && tests.total > 0 && tests.passed === tests.total && tests.failed === 0;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'evidence/team-manifest.json'), 'utf8'));
  const team = manifest.items.map(reviewEvidence);
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const tree = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  const report = {
    generatedAt: new Date().toISOString(), commit: sha.status === 0 ? sha.stdout.trim() : null,
    worktreeDirty: tree.status === 0 ? Boolean(tree.stdout.trim()) : null,
    kevin: { status: corePassed ? 'passed' : 'failed', tests, evidence: 'evidence/generated/regression.tap' },
    team, readiness: !corePassed ? 'failed' : team.every(item => item.status === 'provided') ? 'ready-for-team-review' : 'pending-team-evidence',
    note: 'La presencia de adjuntos no sustituye la revision tecnica. No certifica Postman, Selenium o JMeter no ejecutados por este comando.',
  };
  fs.writeFileSync(path.join(output, 'regression.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!corePassed) process.exitCode = 1;
  else if (process.argv.includes('--require-team') && team.some(item => item.status !== 'provided')) process.exitCode = 2;
}

if (require.main === module) run();
module.exports = { reviewEvidence };
