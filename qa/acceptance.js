const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const newman = require('newman');
const { startFixture } = require('./fixture');
const { runSystem } = require('./system');
const { runSelenium } = require('./selenium');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'evidence', 'team');

function execute(command, args, log) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: process.env, windowsHide: true });
    const stream = fs.createWriteStream(path.join(output, log));
    child.stdout.pipe(stream); child.stderr.pipe(stream);
    child.on('error', reject);
    child.on('close', code => { stream.end(); code === 0 ? resolve() : reject(new Error(`${command} terminó con ${code}; véase ${log}`)); });
  });
}
function report(ticket, name, total, artifacts, details) {
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify({ ticket, status: 'passed', commit,
    generatedAt: new Date().toISOString(), command: 'npm run qa:acceptance',
    environment: 'MongoDB 7.0.14 replica set local desechable; API HTTP real',
    tests: { total, passed: total, failed: 0 }, artifacts: artifacts.map(file => `evidence/team/${file}`), details,
  }, null, 2));
}
async function runPostman(baseUrl) {
  const summary = await new Promise((resolve, reject) => newman.run({
    collection: require('../postman/Racetrack-API.postman_collection.json'),
    envVar: [{ key: 'baseUrl', value: baseUrl }], reporters: ['json'],
    reporter: { json: { export: path.join(output, 'newman-original.json') } },
  }, (error, summary) => error ? reject(error) : resolve(summary)));
  if (summary.run.failures.length) throw new Error(`Newman: ${summary.run.failures.length} fallos`);
  report('RACE-45', 'postman', summary.run.stats.assertions.total, ['newman-original.json'], { requests: summary.run.stats.requests.total });
}
function metrics(file) {
  const rows = fs.readFileSync(path.join(output, file), 'utf8').trim().split(/\r?\n/);
  const headers = rows.shift().split(',');
  const records = rows.map(row => Object.fromEntries(row.split(',').map((v, i) => [headers[i], v])));
  if (!records.length) throw new Error('JMeter no produjo muestras');
  const times = records.map(row => Number(row.elapsed)).sort((a, b) => a - b);
  const failed = records.filter(row => row.success !== 'true').length;
  const start = Math.min(...records.map(row => Number(row.timeStamp)));
  const end = Math.max(...records.map(row => Number(row.timeStamp) + Number(row.elapsed)));
  return { samples: records.length, failed, errorPercent: failed / records.length * 100,
    averageMs: times.reduce((a, b) => a + b, 0) / times.length,
    p95Ms: times[Math.ceil(times.length * .95) - 1], maxMs: times.at(-1),
    throughputPerSecond: records.length * 1000 / (end - start) };
}
async function runJmeter(baseUrl) {
  if (!process.env.JMETER_HOME || !process.env.JAVA_HOME) throw new Error('Configura JMETER_HOME y JAVA_HOME para ejecutar JMeter real');
  const java = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  const url = new URL(baseUrl);
  const results = {};
  for (const [mode, threads, ramp, loops] of [['load', 5, 5, 10], ['stress', 50, 5, 10]]) {
    const jtl = `${mode}.jtl`;
    // Never append an earlier run to a new sample set.
    fs.rmSync(path.join(output, jtl), { force: true });
    await execute(java, ['-jar', path.join(process.env.JMETER_HOME, 'bin', 'ApacheJMeter.jar'),
      '-n', '-t', 'performance/RACE-50-rendimiento.jmx', '-l', path.join(output, jtl),
      '-j', path.join(output, `${mode}-jmeter.log`), `-Jhost=${url.hostname}`, `-Jport=${url.port}`,
      `-Jthreads=${threads}`, `-Jramp=${ramp}`, `-Jloops=${loops}`], `${mode}-console.txt`);
    results[mode] = { threads, rampSeconds: ramp, loops, ...metrics(jtl) };
    if (results[mode].samples !== threads * loops || results[mode].failed) throw new Error(`JMeter ${mode}: muestras incompletas o con errores`);
  }
  fs.writeFileSync(path.join(output, 'jmeter-metrics.json'), JSON.stringify({ results,
    interpretation: 'Carga y estrés en equipo local con datos no vacíos. No se alcanzó necesariamente saturación: estas métricas no estiman capacidad de Atlas ni producción.' }, null, 2));
  report('RACE-50', 'jmeter', results.load.samples + results.stress.samples,
    ['load.jtl', 'stress.jtl', 'jmeter-metrics.json', 'load-jmeter.log', 'stress-jmeter.log'], results);
}
async function run() {
  fs.mkdirSync(output, { recursive: true });
  // A failed rerun must not leave an old passing attestation for this execution.
  for (const name of ['integration', 'postman', 'selenium', 'jmeter']) fs.rmSync(path.join(output, `${name}.json`), { force: true });
  const fixture = await startFixture();
  const failures = [];
  try {
    for (const [name, work] of [
      ['integration', async () => {
        const checks = await runSystem(fixture);
        await execute(process.execPath, ['scripts/verify-ranking-atlas.js'], 'ranking-real.txt');
        await execute(process.execPath, ['scripts/verify-kevin-atlas.js'], 'capacity-real.txt');
        fs.writeFileSync(path.join(output, 'system-checks.json'), JSON.stringify(checks, null, 2));
        report('RACE-46', 'integration', checks.length, ['system-checks.json', 'ranking-real.txt', 'capacity-real.txt'], checks);
      }], ['postman', () => runPostman(fixture.baseUrl)],
      ['selenium', async () => {
        const checks = await runSelenium(fixture, output);
        fs.writeFileSync(path.join(output, 'selenium-checks.json'), JSON.stringify(checks, null, 2));
        report('RACE-49', 'selenium', checks.length, ['selenium-checks.json', 'selenium-registration.png', 'selenium-final.png'], checks);
      }], ['jmeter', () => runJmeter(fixture.baseUrl)],
    ]) {
      try { await work(); console.log(`${name}: PASS`); }
      catch (error) { failures.push({ name, message: error.message, stack: error.stack }); console.error(`${name}: FAIL — ${error.message}`); }
    }
  } finally { await fixture.close(); }
  fs.writeFileSync(path.join(output, 'acceptance-errors.json'), JSON.stringify(failures, null, 2));
  if (failures.length) process.exitCode = 1;
}
run().catch(error => { console.error(error); process.exitCode = 1; });
