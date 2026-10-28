const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const newman = require('newman');
const { startFixture } = require('./fixture');
const { runSystem } = require('./system');
const { runSelenium } = require('./selenium');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'evidence', 'team');
const collectionPath = path.join(root, 'postman', 'Racetrack API - RACE-45.postman_collection.json');
const privateRouteLabels = [
  'POST - Crear evento',
  'POST - Crear inscripción',
  'PATCH - Actualizar evento',
  'GET - Participantes',
  'POST - Registrar resultado',
];
const preparationLabels = [
  'POST - Login organizador',
  'POST - Login corredor',
  'POST - Crear categoría',
];

function execute(command, args, log, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, windowsHide: true });
    const stream = fs.createWriteStream(path.join(output, log));
    child.stdout.pipe(stream);
    child.stderr.pipe(stream);
    child.once('error', error => {
      stream.end();
      reject(error);
    });
    child.once('close', code => {
      stream.end(() => {
        if (code === 0) resolve();
        else reject(new Error(`${command} terminó con ${code}; véase ${log}`));
      });
    });
  });
}

function writeReport(ticket, name, total, artifacts, details) {
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify({
    ticket,
    status: 'passed',
    commit: git.status === 0 ? git.stdout.trim() : null,
    generatedAt: new Date().toISOString(),
    command: 'npm run qa:acceptance',
    environment: 'MongoDB 7.0.14 replica set local desechable; API HTTP real',
    tests: { total, passed: total, failed: 0 },
    artifacts: artifacts.map(file => `evidence/team/${file}`),
    details,
  }, null, 2));
}

function flattenRequests(items, requests = []) {
  for (const item of items || []) {
    if (item.item) flattenRequests(item.item, requests);
    else requests.push(item);
  }
  return requests;
}

async function runPostman(baseUrl, fixture) {
  const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  const requests = flattenRequests(collection.item);
  if (!requests.length) throw new Error('La colección Newman no contiene solicitudes');
  for (const item of requests) {
    const url = typeof item.request?.url === 'string' ? item.request.url : item.request?.url?.raw;
    if (!url || !url.trim()) throw new Error(`Solicitud Newman sin URL: ${item.name}`);
    if (/localhost:3000/i.test(url)) throw new Error(`La solicitud ${item.name} fija localhost:3000`);
    if (!(item.event || []).some(event => event.listen === 'test' && event.script?.exec?.length)) {
      throw new Error(`La solicitud ${item.name} no tiene aserciones`);
    }
  }

  const labels = requests.map(item => item.name);
  for (const name of [
    'POST Login - organizador del fixture',
    'POST Crear categoría para esta ejecución',
    'POST Crear evento como organizador',
    'GET Participantes con JWT del organizador',
    'PATCH Actualizar evento como organizador',
    'PATCH Cancelar evento como organizador',
  ]) {
    if (!labels.includes(name)) throw new Error(`Falta la prueba Newman requerida: ${name}`);
  }

  const reportPath = path.join(output, 'newman-original.json');
  fs.rmSync(reportPath, { force: true });
  const runSummary = await new Promise((resolve, reject) => newman.run({
    collection,
    envVar: [
      { key: 'baseUrl', value: baseUrl },
      { key: 'ownerEmail', value: fixture.owner.email },
      { key: 'ownerPassword', value: fixture.password },
      { key: 'ownerToken', value: '' },
      { key: 'categoryName', value: `Newman-QA-${Date.now()}-${require('node:crypto').randomUUID()}` },
      { key: 'categoryId', value: '' },
      { key: 'fixtureEventId', value: String(fixture.event._id) },
      { key: 'eventName', value: `Evento Newman ${Date.now()}` },
      { key: 'eventId', value: '' },
      { key: 'updatedEventName', value: `Evento Newman actualizado ${Date.now()}` },
    ],
    reporters: ['json'],
    reporter: { json: { export: reportPath } },
  }, (error, summary) => error ? reject(error) : resolve(summary)));

  if (!runSummary || !runSummary.run) throw new Error('Newman no devolvió resultados de ejecución');
  if (!fs.existsSync(reportPath)) throw new Error('Newman no generó evidence/team/newman-original.json');
  const reportText = fs.readFileSync(reportPath, 'utf8')
    .replaceAll(fixture.password, '[REDACTED FIXTURE PASSWORD]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED TEST JWT]');
  fs.writeFileSync(reportPath, reportText);

  const failures = runSummary.run.failures || [];
  const assertions = runSummary.run.stats.assertions;
  if (failures.length) throw new Error(`Newman: ${failures.length} fallos`);
  if (!assertions || assertions.total === 0 || assertions.failed !== 0) {
    throw new Error('Newman no ejecutó aserciones útiles o reportó aserciones fallidas');
  }
  writeReport('RACE-45', 'postman', assertions.total, ['newman-original.json'], {
    requests: runSummary.run.stats.requests.total,
    assertions: assertions.total,
  });
  return { requests: runSummary.run.stats.requests.total, assertions: assertions.total };
}

function parseCsvRow(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  fields.push(value);
  return fields;
}

function readJtl(file) {
  const lines = fs.readFileSync(path.join(output, file), 'utf8').trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`JMeter no produjo muestras en ${file}`);
  const headers = parseCsvRow(lines.shift());
  return lines.map(line => Object.fromEntries(parseCsvRow(line).map((value, index) => [headers[index], value])));
}

function summarizeJmeter(records, mode, threads, loops) {
  const expectedSamples = threads * loops;
  const expectedRouteSamples = expectedSamples * privateRouteLabels.length;
  const scenario = records.filter(record => privateRouteLabels.includes(record.label));
  const preparation = records.filter(record => preparationLabels.includes(record.label));
  const expectedLabels = new Set([...privateRouteLabels, ...preparationLabels]);
  const unexpectedLabels = [...new Set(
    records.map(record => record.label).filter(label => !expectedLabels.has(label))
  )];
  if (unexpectedLabels.length) {
    throw new Error(`JMeter ${mode}: etiquetas inesperadas: ${unexpectedLabels.join(', ')}`);
  }
  const failed = records.filter(record => record.success !== 'true');
  if (failed.length) {
    throw new Error(`JMeter ${mode}: ${failed.length} de ${records.length} muestras, incluida preparación, fallaron`);
  }
  if (scenario.length !== expectedRouteSamples) {
    throw new Error(`JMeter ${mode}: se esperaban ${expectedRouteSamples} muestras privadas; se obtuvieron ${scenario.length}`);
  }
  for (const label of privateRouteLabels) {
    const actual = scenario.filter(record => record.label === label).length;
    if (actual !== expectedSamples) {
      throw new Error(`JMeter ${mode}: ${label} produjo ${actual} muestras; se esperaban ${expectedSamples}`);
    }
  }
  for (const label of preparationLabels) {
    const actual = preparation.filter(record => record.label === label).length;
    if (actual !== 1) {
      throw new Error(`JMeter ${mode}: ${label} produjo ${actual} muestras de preparación; se esperaba 1`);
    }
  }
  const times = scenario.map(record => Number(record.elapsed)).sort((a, b) => a - b);
  const start = Math.min(...scenario.map(record => Number(record.timeStamp)));
  const end = Math.max(...scenario.map(record => Number(record.timeStamp) + Number(record.elapsed)));
  return {
    threads,
    rampSeconds: mode === 'load' ? 5 : 10,
    loops,
    samples: scenario.length,
    totalSamples: records.length,
    samplesPerEndpoint: expectedSamples,
    endpointSamples: Object.fromEntries(privateRouteLabels.map(label => [
      label,
      scenario.filter(record => record.label === label).length,
    ])),
    failed: 0,
    totalFailed: failed.length,
    errorPercent: 0,
    minMs: times[0],
    averageMs: times.reduce((sum, time) => sum + time, 0) / times.length,
    p95Ms: times[Math.ceil(times.length * 0.95) - 1],
    maxMs: times.at(-1),
    throughputPerSecond: scenario.length * 1000 / Math.max(1, end - start),
    preparationSamples: preparation.length,
  };
}

function configureThreadGroup(jmx, name, enabled, { threads, ramp, loops }) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(
    `<ThreadGroup\\b(?=[^>]*\\btestname="${escaped}")[^>]*>[\\s\\S]*?<\\/ThreadGroup>`
  );
  const matches = jmx.match(new RegExp(expression.source, 'g')) || [];
  if (matches.length !== 1) throw new Error(`Se esperaba un grupo JMeter "${name}", se encontraron ${matches.length}`);
  return jmx.replace(expression, group => {
    for (const [property, value] of [
      ['ThreadGroup.num_threads', threads],
      ['ThreadGroup.ramp_time', ramp],
      ['LoopController.loops', loops],
    ]) {
      const propertyName = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const propertyExpression = new RegExp(
        `(<(?:intProp|stringProp) name="${propertyName}">)[^<]*(<\\/(?:intProp|stringProp)>)`
      );
      if ((group.match(new RegExp(propertyExpression.source, 'g')) || []).length !== 1) {
        throw new Error(`El grupo JMeter "${name}" debe contener una propiedad ${property}`);
      }
      group = group.replace(propertyExpression, `$1${value}$2`);
    }
    return group.replace(/<ThreadGroup\b[^>]*>/, tag => {
      const withoutEnabled = tag.replace(/\s+enabled="[^"]*"/, '');
      return withoutEnabled.replace(/>$/, ` enabled="${enabled}">`);
    });
  });
}

function clearResultCollectorFilename(jmx) {
  let collectorCount = 0;
  let filenameCount = 0;
  const updated = jmx.replace(/<ResultCollector\b[^>]*>[\s\S]*?<\/ResultCollector>/g, collector => {
    collectorCount += 1;
    return collector.replace(
      /(<stringProp name="filename">)[\s\S]*?(<\/stringProp>)/,
      (_match, openingTag, closingTag) => {
        filenameCount += 1;
        return `${openingTag}${closingTag}`;
      }
    );
  });
  if (collectorCount === 0 || filenameCount !== collectorCount) {
    throw new Error('El plan JMeter debe tener un nombre de archivo definido para cada ResultCollector');
  }
  return updated;
}

function getJavaMajorVersion(java) {
  const result = spawnSync(java, ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10000,
  });
  if (result.error || result.status !== 0) return null;
  const versionOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = versionOutput.match(/version\s+"(?:1\.)?(\d+)/i)
    || versionOutput.match(/(?:openjdk|java)\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function findJavaExecutable() {
  const executableName = process.platform === 'win32' ? 'java.exe' : 'java';
  const candidates = [];
  const addCandidate = candidate => {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  };

  if (process.env.JAVA_HOME) {
    addCandidate(path.join(process.env.JAVA_HOME.replace(/^"|"$/g, ''), 'bin', executableName));
  }

  const pathEntries = (process.env.PATH || process.env.Path || '').split(path.delimiter);
  for (const entry of pathEntries) {
    addCandidate(path.join(entry.replace(/^"|"$/g, ''), executableName));
  }

  if (process.platform === 'win32') {
    const programFiles = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
    ].filter(Boolean);
    for (const base of programFiles) {
      for (const vendorDirectory of [
        'Java',
        'Eclipse Adoptium',
        'Microsoft',
        'Amazon Corretto',
        'Zulu',
        'BellSoft',
        'Semeru',
      ]) {
        const vendorPath = path.join(base, vendorDirectory);
        if (!fs.existsSync(vendorPath)) continue;
        for (const install of fs.readdirSync(vendorPath, { withFileTypes: true })) {
          if (install.isDirectory()) {
            addCandidate(path.join(vendorPath, install.name, 'bin', executableName));
          }
        }
      }
    }
  }

  const found = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const major = getJavaMajorVersion(candidate);
    if (major) found.push({ executable: candidate, major });
  }

  return {
    compatible: found.find(java => java.major >= 8 && java.major <= 21),
    found,
  };
}

async function runJmeter(baseUrl, fixture) {
  const configuredHome = process.env.JMETER_HOME?.trim().replace(/^"|"$/g, '');
  if (!configuredHome) {
    throw new Error('JMeter no ejecutado: define JMETER_HOME con la carpeta de instalación de Apache JMeter.');
  }
  const jmeterHome = path.resolve(configuredHome);
  const jmeterBatch = path.join(jmeterHome, 'bin', 'jmeter.bat');
  const jmeterJar = path.join(jmeterHome, 'bin', 'ApacheJMeter.jar');
  if (!fs.existsSync(jmeterBatch)) {
    throw new Error(`JMeter no ejecutado: no se encontró ${jmeterBatch}`);
  }
  if (!fs.existsSync(jmeterJar)) {
    throw new Error(`JMeter no ejecutado: no se encontró ${jmeterJar}`);
  }

  const javaDetection = findJavaExecutable();
  if (!javaDetection.compatible) {
    const available = javaDetection.found.map(java => `${java.executable} (Java ${java.major})`);
    const diagnostic = available.length
      ? `Java encontrado, pero JMeter 5.6.3 requiere JDK 8-21 para compatibilidad con Groovy; disponibles: ${available.join('; ')}`
      : 'No se encontró una instalación de Java ejecutable en JAVA_HOME, PATH ni las carpetas estándar de Windows.';
    throw new Error(`JMeter no ejecutado: ${diagnostic}`);
  }
  const { executable: java, major: javaMajorVersion } = javaDetection.compatible;
  const jmeterEnv = {
    ...process.env,
    JAVA_HOME: path.dirname(path.dirname(java)),
    JMETER_HOME: jmeterHome,
    QA_OWNER_EMAIL: fixture.owner.email,
    QA_RUNNER_EMAIL: fixture.runner.email,
    QA_PASSWORD: fixture.password,
  };
  const versionProbe = spawnSync(java, ['-jar', jmeterJar, '-v'], {
    cwd: root,
    env: jmeterEnv,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  });
  const versionOutput = `${versionProbe.stdout || ''}\n${versionProbe.stderr || ''}`;
  if (versionProbe.error || versionProbe.status !== 0 || !versionOutput.includes('5.6.3')) {
    const reason = versionProbe.error?.message || versionOutput.trim() || `código ${versionProbe.status}`;
    throw new Error(`JMeter no pudo validar la instalación en "${jmeterHome}": ${reason}`);
  }

  const url = new URL(baseUrl);
  const sourceJmx = path.join(root, 'performance', 'RACE-50-rendimiento.jmx');
  const original = fs.readFileSync(sourceJmx, 'utf8');
  const results = {};

  try {
    for (const [mode, threads, ramp, loops] of [
      ['load', 5, 5, 10],
      ['stress', 50, 10, 10],
    ]) {
      const jtlFile = `${mode}.jtl`;
      const jtlPath = path.join(output, jtlFile);
      const planPath = path.join(output, `${mode}-plan.jmx`);
      let jmx = configureThreadGroup(original, 'Carga - Rutas privadas', mode === 'load', {
        threads: mode === 'load' ? threads : 5,
        ramp: mode === 'load' ? ramp : 5,
        loops,
      });
      jmx = configureThreadGroup(jmx, 'Estrés - Rutas privadas', mode === 'stress', {
        threads: mode === 'stress' ? threads : 50,
        ramp: mode === 'stress' ? ramp : 10,
        loops,
      });
      jmx = clearResultCollectorFilename(jmx);
      fs.writeFileSync(planPath, jmx);
      fs.rmSync(jtlPath, { force: true });
      await execute(java, [
        '-jar', jmeterJar, '-n', '-t', planPath, '-l', jtlPath,
        '-j', path.join(output, `${mode}-jmeter.log`),
        `-Jhost=${url.hostname}`,
        `-Jport=${url.port || (url.protocol === 'https:' ? '443' : '80')}`,
        `-Jprotocol=${url.protocol.slice(0, -1)}`,
      ], `${mode}-console.txt`, jmeterEnv);
      results[mode] = summarizeJmeter(readJtl(jtlFile), mode, threads, loops);
    }
  } catch (error) {
    fs.writeFileSync(path.join(output, 'jmeter-metrics.json'), JSON.stringify({
      status: 'failed',
      generatedAt: new Date().toISOString(),
      results,
      error: error.message,
    }, null, 2));
    throw error;
  }

  const details = {
    jmeterVersion: '5.6.3',
    jmeterHome,
    javaExecutable: java,
    javaMajorVersion,
    routes: privateRouteLabels,
    results,
    interpretation: 'Resultados de API local con MongoDB temporal; no representan capacidad de producción ni de Atlas.',
  };
  fs.writeFileSync(path.join(output, 'jmeter-metrics.json'), JSON.stringify({
    status: 'passed',
    generatedAt: new Date().toISOString(),
    ...details,
  }, null, 2));
  writeReport('RACE-50', 'jmeter', results.load.samples + results.stress.samples, [
    'load.jtl',
    'stress.jtl',
    'jmeter-metrics.json',
    'load-jmeter.log',
    'stress-jmeter.log',
  ], details);
  return details;
}

function writeComponentFailure(name, error) {
  const ticket = { integration: 'RACE-46', postman: 'RACE-45', selenium: 'RACE-49', jmeter: 'RACE-50' }[name];
  fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify({
    ticket,
    status: 'failed',
    generatedAt: new Date().toISOString(),
    command: 'npm run qa:acceptance',
    error: error.message,
    stack: error.stack,
  }, null, 2));
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const generatedFiles = [
    'acceptance.json', 'acceptance-errors.json', 'integration.json', 'postman.json', 'selenium.json',
    'jmeter.json', 'newman-original.json', 'jmeter-metrics.json', 'load.jtl', 'stress.jtl',
    'load-plan.jmx', 'stress-plan.jmx', 'load-jmeter.log', 'stress-jmeter.log',
    'load-console.txt', 'stress-console.txt', 'system-checks.json', 'selenium-checks.json',
    'selenium-registration.png', 'selenium-final.png', 'selenium-desktop.png', 'selenium-mobile.png', 'ranking-real.txt', 'capacity-real.txt',
  ];
  for (const file of generatedFiles) fs.rmSync(path.join(output, file), { force: true });

  const components = Object.fromEntries(['integration', 'postman', 'selenium', 'jmeter'].map(name => [
    name,
    { status: 'not_run' },
  ]));
  const failures = [];
  let fixture;
  try {
    fixture = await startFixture();
    const work = [
      ['integration', async () => {
        const checks = await runSystem(fixture);
        await execute(process.execPath, ['scripts/verify-ranking-atlas.js'], 'ranking-real.txt');
        await execute(process.execPath, ['scripts/verify-kevin-atlas.js'], 'capacity-real.txt');
        fs.writeFileSync(path.join(output, 'system-checks.json'), JSON.stringify(checks, null, 2));
        writeReport('RACE-46', 'integration', checks.length, [
          'system-checks.json', 'ranking-real.txt', 'capacity-real.txt',
        ], checks);
        return { tests: checks.length, checks };
      }],
      ['postman', () => runPostman(fixture.baseUrl, fixture)],
      ['selenium', async () => {
        const checks = await runSelenium(fixture, output);
        fs.writeFileSync(path.join(output, 'selenium-checks.json'), JSON.stringify(checks, null, 2));
        writeReport('RACE-49', 'selenium', checks.length, [
          'selenium-checks.json', 'selenium-registration.png', 'selenium-final.png', 'selenium-desktop.png', 'selenium-mobile.png',
        ], checks);
        return { tests: checks.length, checks };
      }],
      ['jmeter', () => runJmeter(fixture.baseUrl, fixture)],
    ];
    for (const [name, runComponent] of work) {
      try {
        components[name] = { status: 'passed', details: await runComponent() };
        console.log(`${name}: PASS`);
      } catch (error) {
        components[name] = { status: 'failed', error: error.message };
        failures.push({ name, message: error.message, stack: error.stack });
        writeComponentFailure(name, error);
        console.error(`${name}: FAIL — ${error.message}`);
      }
    }
  } catch (error) {
    components.fixture = { status: 'failed', error: error.message };
    failures.push({ name: 'fixture', message: error.message, stack: error.stack });
    console.error(`fixture: FAIL — ${error.message}`);
  } finally {
    if (fixture) {
      try {
        const cleanup = await fixture.close();
        components.fixtureCleanup = {
          status: 'passed',
          details: cleanup,
        };
      } catch (error) {
        components.fixtureCleanup = { status: 'failed', error: error.message };
        failures.push({ name: 'fixtureCleanup', message: error.message, stack: error.stack });
        console.error(`fixtureCleanup: FAIL — ${error.message}`);
      }
    }
  }

  const status = failures.length === 0 && Object.values(components).every(component => component.status === 'passed')
    ? 'passed'
    : 'failed';
  fs.writeFileSync(path.join(output, 'acceptance-errors.json'), JSON.stringify(failures, null, 2));
  fs.writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify({
    status,
    generatedAt: new Date().toISOString(),
    command: 'npm run qa:acceptance',
    components,
    failures: failures.map(({ name, message }) => ({ name, message })),
  }, null, 2));
  if (status !== 'passed') process.exitCode = 1;
}

if (require.main === module) {
  run().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { summarizeJmeter, clearResultCollectorFilename };
