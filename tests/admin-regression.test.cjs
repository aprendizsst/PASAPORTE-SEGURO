const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'passport-admin-tests-'));
process.on('exit', () => fs.rmSync(buildDir, { recursive: true, force: true }));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--project', path.join(root, 'tsconfig.json'), '--noEmit', 'false', '--module', 'commonjs', '--moduleResolution', 'bundler', '--rootDir', path.join(root, 'src'), '--outDir', buildDir], { stdio: 'inherit' });

function loadSource(name, overrides = {}, cache = new Map()) {
  const filename = path.join(root, 'src', name);
  if (cache.has(filename)) return cache.get(filename);
  let code = fs.readFileSync(path.join(buildDir, name.replace(/\.tsx?$/, '.js')), 'utf8');
  if (name === 'App.tsx') code += '\nmodule.exports.AdminPage = AdminPage;';
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id in overrides) return overrides[id];
    if (id.startsWith('./')) {
      const file = [id + '.ts', id + '.tsx'].find((candidate) => fs.existsSync(path.join(root, 'src', candidate)));
      return loadSource(file, overrides, cache);
    }
    return require(id);
  };
  const sandbox = { exports: module.exports, module, require: localRequire, console, Error, ...overrides.globals };
  vm.runInNewContext(code, sandbox, { filename });
  cache.set(filename, module.exports);
  return module.exports;
}

const { audienceKey, missionAssignedTo, pageOf } = loadSource('adminData.ts');
const clean = (value) => JSON.parse(JSON.stringify(value));

function backend() {
  const data = {
    Usuarios: [
      { Id: 'a', Nombre: 'Ana', Cedula: '10001', UAD: ' UAD CHIQUINQUIRA ', Activo: true, Rol: 'USER', SessionVersion: '1' },
      { Id: 'b', Nombre: 'Bruno', Cedula: '10002', UAD: 'UAD Duitama', Activo: true, Rol: 'USER', SessionVersion: '1' },
      { Id: 'admin', Nombre: 'Admin', Cedula: '99999', UAD: 'Sede Central', Activo: true, Rol: 'ADMIN', SessionVersion: '1' },
    ],
    Catalogos: [{ Tipo: 'UAD', Valor: 'UAD Chiquinquirá', Activo: true }, { Tipo: 'UAD', Valor: 'UAD Duitama', Activo: true }],
    Misiones: [
      { Id: 1, Audiencia: 'Todas las UAD', Activa: true, CodigoSello: 'SECRET1' },
      { Id: 2, Audiencia: 'uad  chiquinquirá', Activa: true, CodigoSello: 'SECRET2' },
      { Id: 3, Audiencia: 'UAD Duitama', Activa: true, CodigoSello: 'SECRET3' },
      { Id: 4, Audiencia: '', Activa: true, CodigoSello: 'SECRET4' },
      { Id: 5, Audiencia: 'Todas las UAD', Activa: false },
    ],
    Progreso: [], Bonus: [], Evidencias: [], Insignias: [],
  };
  for (const rows of Object.values(data)) rows.forEach((row, i) => row._row = i + 2);
  const cache = new Map();
  const properties = new Map();
  const lock = () => ({ tryLock: () => true, releaseLock() {} });
  const scriptCache = {
    get: (key) => cache.get(key) ?? null,
    put: (key, value) => cache.set(key, String(value)),
    putAll: (values) => Object.entries(values).forEach(([key, value]) => cache.set(key, String(value))),
    remove: (key) => cache.delete(key),
    removeAll: (keys) => keys.forEach((key) => cache.delete(key)),
  };
  const scriptProperties = {
    getProperty: (key) => properties.get(key) ?? null,
    setProperty: (key, value) => properties.set(key, String(value)),
    deleteProperty: (key) => properties.delete(key),
  };
  const toBuffer = (value) => Buffer.isBuffer(value) ? value : Array.isArray(value) ? Buffer.from(value) : Buffer.from(String(value));
  const ctx = vm.createContext({
    console,
    LockService: { getScriptLock: lock, getDocumentLock: lock },
    CacheService: { getScriptCache: () => scriptCache },
    PropertiesService: { getScriptProperties: () => scriptProperties },
    Utilities: {
      Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', String(key)).update(String(value)).digest()],
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()],
      base64EncodeWebSafe: (value) => toBuffer(value).toString('base64url'),
      base64DecodeWebSafe: (value) => [...Buffer.from(String(value), 'base64url')],
      newBlob: (value) => ({ getDataAsString: () => toBuffer(value).toString('utf8') }),
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8'), ctx);
  const nativeRequireSession = ctx.requireSession_;
  ctx.sheetObjects_ = (name) => data[name].map((row) => ({ ...row }));
  ctx.findObjectsByField_ = (name, field, value, normalizer) => data[name]
    .filter((row) => normalizer(row[field]) === normalizer(value))
    .map((row) => ({ ...row }));
  ctx.requireSession_ = (token) => {
    const user = data.Usuarios.find((user) => user.Id === token && user.Activo);
    if (!user) throw Error('Sesión no válida');
    return user;
  };
  ctx.appendObject_ = (name, row) => data[name].push({ ...row, _row: data[name].length + 2 });
  ctx.updateObjectRow_ = (name, number, update) => Object.assign(data[name].find((row) => row._row === number), update);
  ctx.generateUniqueMissionCode_ = () => 'NEW123';
  ctx.activeBadges_ = () => [];
  return { ctx, data, nativeRequireSession, cache };
}

test('paginación: límites 0, 10, 11, 20, 21 y sin elementos duplicados', () => {
  for (const count of [0, 1, 10, 11, 20, 21, 103]) {
    const source = Array.from({ length: count }, (_, i) => i);
    const result = [];
    for (let page = 1; page <= Math.max(1, Math.ceil(count / 10)); page++) {
      const part = pageOf(source, page);
      assert.ok(part.items.length <= 10);
      result.push(...part.items);
    }
    assert.deepEqual(result, source);
  }
  assert.equal(pageOf([], 99).page, 1);
  assert.equal(pageOf(Array(20), 3).page, 2); // Last item on page 3 deleted.
  assert.equal(pageOf(Array(21), -1).page, 1);
});

test('normalización compartida sin ampliar permisos a otras UAD', () => {
  const { ctx } = backend();
  for (const [audience, uad, expected] of [
    ['UAD Chiquinquirá', ' uad\u00a0 CHIQUINQUIRA ', true],
    [' todas  las UAD ', 'UAD Duitama', true],
    ['UAD Duitama', 'UAD Chiquinquirá', false],
    ['UAD Duitama', 'Duitama', false],
    ['', '', false], [null, null, false], ['Todas', 'UAD Duitama', false],
  ]) {
    assert.equal(missionAssignedTo(audience, uad), expected);
    assert.equal(ctx.missionAssignedTo_(audience, uad), expected);
    assert.equal(ctx.audienceKey_(audience), audienceKey(audience));
  }
});

test('sesión, menús, progreso administrativo y validación de sello usan la misma asignación', () => {
  const { ctx, data } = backend();
  const user = data.Usuarios[0];
  const initial = ctx.userBundle_(user);
  const fresh = ctx.missionsApi_({ token: 'a' });
  assert.deepEqual(clean(initial.missions.map((m) => m.id)), [1, 2]);
  assert.deepEqual(clean(fresh.missions.map((m) => m.id)), [1, 2]);
  assert.equal(fresh.missions.filter((m) => missionAssignedTo(m.audience, user.UAD)).length, 2);
  assert.ok(fresh.missions.every((m) => !('sealCode' in m)));
  assert.equal(ctx.allowedMission_(user, 2).Id, 2);
  assert.throws(() => ctx.allowedMission_(user, 3), /no está disponible/);
  assert.equal(ctx.buildAdminPeople_()[0].total, 2);
  assert.throws(() => ctx.missionsApi_({ token: 'invalid' }), /Sesión/);
  assert.ok(ctx.missionsApi_({ token: 'admin' }).missions[0].sealCode);
});

const missionInput = { title: 'Reto asignado', station: 'Estación Salud', description: 'Actividad de prueba', audience: 'UAD Chiquinquirá', duration: '8 min', points: 100 };

test('crear, reasignar y retirar actualiza sesiones abiertas e invalida caché', () => {
  const { ctx } = backend();
  ctx.missionsApi_({ token: 'a' }); // Warm the cache before writing.
  const created = ctx.adminCreateMissionApi_({ token: 'admin', mission: { ...missionInput, audience: ' uad chiquinquira ' } });
  assert.equal(created.audience, 'UAD Chiquinquirá');
  assert.ok(ctx.missionsApi_({ token: 'a' }).missions.some((m) => m.id === created.id));
  assert.ok(!ctx.missionsApi_({ token: 'b' }).missions.some((m) => m.id === created.id));
  ctx.adminEditMissionApi_({ token: 'admin', mission: { ...missionInput, id: created.id, audience: 'UAD Duitama' } });
  assert.ok(!ctx.missionsApi_({ token: 'a' }).missions.some((m) => m.id === created.id));
  assert.ok(ctx.missionsApi_({ token: 'b' }).missions.some((m) => m.id === created.id));
  ctx.adminDeleteMissionApi_({ token: 'admin', missionId: created.id });
  assert.ok(!ctx.missionsApi_({ token: 'b' }).missions.some((m) => m.id === created.id));
});

test('audiencias inválidas se rechazan; UAD reales fuera del catálogo se conservan', () => {
  const { ctx, data } = backend();
  for (const audience of ['', 'No existe', undefined]) {
    assert.throws(() => ctx.validateMissionInput_({ ...missionInput, audience }), /UAD|audiencia/i);
  }
  data.Usuarios.push({ Id: 'extra', UAD: 'UAD Nueva', Activo: true });
  assert.equal(ctx.validateMissionAudience_('uad nueva'), 'UAD Nueva');
  assert.equal(ctx.validateMissionAudience_('TODAS LAS UAD'), 'Todas las UAD');
  assert.throws(() => ctx.adminCreateMissionApi_({ token: 'a', mission: missionInput }), /administrador/i);
  assert.deepEqual(clean(ctx.assignmentUads_()), ['UAD Chiquinquirá', 'UAD Duitama', 'Sede Central', 'UAD Nueva']);
});

test('actualización administrativa recupera cambios directos en la hoja y catálogo', () => {
  const { ctx, data } = backend();
  ctx.adminDashboardApi_({ token: 'admin' });
  data.Misiones[1].Audiencia = 'UAD Duitama';
  data.Catalogos.push({ Tipo: 'UAD', Valor: 'UAD Nueva', Activo: true });
  const dashboard = ctx.adminDashboardApi_({ token: 'admin', force: true });
  assert.equal(dashboard.missions[1].audience, 'UAD Duitama');
  assert.equal(dashboard.people[0].total, 1);
  assert.ok(dashboard.uads.includes('UAD Nueva'));
});

test('render administrativo: 10 elementos por lista y búsqueda en páginas posteriores', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  let tab = 'missions', page = 1, userSearch = '', stateIndex = 0;
  const react = { ...React, useEffect() {}, useMemo: (cb) => cb(), useState: (initial) => {
    const index = stateIndex++;
    if (index === 0) return [tab, () => {}];
    if (index === 10) return [userSearch, () => {}];
    if (initial && typeof initial === 'object' && 'page' in initial) return [{ page, search: '' }, () => {}];
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  } };
  const { AdminPage } = loadSource('App.tsx', { react });
  const props = {
    missions: Array.from({ length: 21 }, (_, id) => ({ ...missionInput, id, color: '#43d17d', sealCode: 'ABC123' })),
    people: Array.from({ length: 21 }, (_, id) => ({ id: String(id), name: `Persona ${id}`, cedula: String(id), email: `${id}@example.test`, uad: 'UAD Duitama', completed: 0, total: 1, points: 100 })),
    badges: Array.from({ length: 21 }, (_, id) => ({ id: String(id), title: `Insignia ${id}`, description: 'Prueba', icon: 'star', criterion: 'MISSIONS', goal: 1, primaryColor: '#12335a', secondaryColor: '#4ab2fb' })),
    records: Array.from({ length: 21 }, (_, id) => ({ id: String(id), gameId: 'forest-run', gameName: 'Bosque', userName: `Persona ${id}`, uad: 'UAD Duitama', score: 100, record: 200 })),
    evidence: [], uadOptions: ['UAD Duitama'], busyAction: '',
  };
  const render = () => { stateIndex = 0; return renderToStaticMarkup(React.createElement(AdminPage, props)); };
  for (const nextTab of ['missions', 'badges', 'users', 'records']) {
    tab = nextTab;
    page = 1;
    assert.equal((render().match(/<article\b/g) || []).length, 10, nextTab);
    page = 3;
    assert.equal((render().match(/<article\b/g) || []).length, 1, nextTab);
    assert.match(render(), /21–21 de 21/);
  }
  tab = 'overview'; page = 1;
  assert.equal((render().match(/class="table-row"/g) || []).length, 10);
  tab = 'users'; page = 3; userSearch = 'Persona 20';
  const found = render();
  assert.equal((found.match(/<article\b/g) || []).length, 1);
  assert.match(found, /Persona 20/);
  assert.doesNotMatch(found, /admin-pagination/);
});

// Small deterministic hook runner: checks state/effect cleanup without a browser.
function hookRunner(moduleName, hookName, globals = {}) {
  let slots = [], cursor = 0, effects = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] || (slots[index] = { current: initial }); },
    useCallback(fn, deps) { const index = cursor++; if (!equal(slots[index]?.deps, deps)) slots[index] = { deps, fn }; return slots[index].fn; },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!equal(slots[index]?.deps, deps)) {
        effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      }
    },
  };
  const hook = loadSource(moduleName, { react, globals })[hookName];
  return {
    render(...args) { cursor = 0; effects = []; const value = hook(...args); effects.forEach((fn) => fn()); return value; },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}

test('página vuelve a 1 al buscar y se ajusta tras borrar el último resultado', () => {
  const runner = hookRunner('AdminPagination.tsx', 'useAdminPage');
  let result = runner.render(Array(21), '');
  result.onPage(3);
  result = runner.render(Array(21), '');
  assert.equal(result.page, 3);
  result = runner.render(Array(20), '');
  assert.equal(result.page, 2);
  result = runner.render(Array(21), '');
  assert.equal(result.page, 2); // Do not resurrect a deleted last page.
  result = runner.render(Array(21), 'Ana');
  assert.equal(result.page, 1);
  result = runner.render([], 'no existe');
  assert.equal(result.total, 0);
  assert.equal(result.page, 1);
});

const flush = () => new Promise((resolve) => setImmediate(resolve));
function eventTarget(extra = {}) {
  const events = new Map();
  return {
    ...extra, events,
    addEventListener(name, cb) { const set = events.get(name) || new Set(); set.add(cb); events.set(name, set); },
    removeEventListener(name, cb) { events.get(name)?.delete(cb); },
    emit(name) { events.get(name)?.forEach((cb) => cb()); },
  };
}

test('sincronización: deduplica, pausa en Bonus, limpia eventos e ignora respuestas antiguas', async () => {
  let now = 100000;
  let timerId = 0;
  const timers = new Map();
  const window = eventTarget({
    setTimeout(cb, delay) { const id = ++timerId; timers.set(id, { cb, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const document = eventTarget({ hidden: false });
  const navigator = { onLine: true };
  const runner = hookRunner('useMissionSync.ts', 'useMissionSync', { window, document, navigator, Date: class extends Date { static now() { return now; } } });
  const reads = [], synced = [];
  let props = { token: 'a', active: true, view: 'missions', load: (token) => new Promise((resolve, reject) => reads.push({ token, resolve, reject })), onSync: (data) => synced.push(data) };
  let result = runner.render(props);
  assert.equal(reads.length, 0); // El bundle de login ya trae las misiones.
  assert.equal(timers.size, 1);
  assert.ok([...timers.values()][0].delay >= 120000 && [...timers.values()][0].delay <= 210000);
  void result.refresh(); void result.refresh();
  assert.equal(reads.length, 1);
  reads[0].resolve('original'); await flush();
  assert.deepEqual(synced, ['original']);
  window.emit('focus');
  assert.equal(reads.length, 1);
  now += 60000;
  window.emit('focus');
  assert.equal(reads.length, 2);
  props = { ...props, view: 'bonus', active: false };
  runner.render(props);
  assert.equal(timers.size, 0);
  assert.ok([...window.events.values(), ...document.events.values()].every((set) => set.size === 0));
  reads[1].resolve('late response'); await flush();
  assert.deepEqual(synced, ['original']);
  props = { ...props, token: 'b', view: 'missions', active: true };
  result = runner.render(props);
  assert.equal(reads.length, 2);
  void result.refresh();
  assert.equal(reads[2].token, 'b');
  reads[2].reject(Error('Sin respuesta')); await flush();
  result = runner.render(props);
  assert.match(result.error, /Sin respuesta/);
  assert.deepEqual(synced, ['original']);
  void result.refresh();
  reads[3].resolve('new assignments'); await flush();
  assert.deepEqual(synced, ['original', 'new assignments']);
  result = runner.render(props);
  assert.equal(result.error, '');
  assert.equal(result.loading, false);
  navigator.onLine = false;
  await result.refresh();
  assert.equal(reads.length, 4);
  assert.match(runner.render(props).error, /conexión/);
  navigator.onLine = true;
  document.hidden = true;
  now += 60000;
  document.emit('visibilitychange');
  assert.equal(reads.length, 4);
  document.hidden = false;
  document.emit('visibilitychange');
  assert.equal(reads.length, 5);
  runner.unmount();
  reads[4].resolve('after unmount'); await flush();
  assert.equal(synced.length, 2);
  assert.equal(timers.size, 0);
});

test('300 dispositivos distribuyen la sincronización periódica sin una ráfaga común', () => {
  const { missionSyncDelay } = loadSource('useMissionSync.ts');
  const seconds = Array.from({ length: 300 }, (_, index) => Math.floor(missionSyncDelay(`session-${index}`, 0) / 1000));
  assert.ok(seconds.every((second) => second >= 120 && second <= 210));
  const buckets = new Map();
  seconds.forEach((second) => buckets.set(second, (buckets.get(second) || 0) + 1));
  assert.ok(Math.max(...buckets.values()) <= 8, `ráfaga inesperada: ${Math.max(...buckets.values())} solicitudes/s`);
  assert.ok(buckets.size >= 70, `distribución insuficiente: ${buckets.size} segundos usados`);
});

test('sesiones firmadas no escriben por login y se revocan al cambiar su versión', () => {
  const { ctx, data, nativeRequireSession } = backend();
  const user = data.Usuarios[0];
  const token = ctx.createSessionToken_(user, new Date(Date.now() + 60000));
  assert.match(token, /^ps2\./);
  assert.equal(nativeRequireSession(token).Id, user.Id);
  user.SessionVersion = '2';
  ctx.invalidateUserCache_(user);
  assert.throws(() => nativeRequireSession(token), /revocada/);
  const source = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');
  const loginBody = source.slice(source.indexOf('function loginApi_'), source.indexOf('function sessionApi_'));
  assert.doesNotMatch(loginBody, /appendObject_\(SHEETS\.SESSIONS/);
});

test('progreso completado es monotónico y los reintentos comparten un resultado', () => {
  const { ctx, data } = backend();
  data.Progreso.push({ Id: 'p1', UsuarioId: 'a', MisionId: 1, Estado: 'COMPLETADA', IniciadaEn: new Date(), CompletadaEn: new Date(), _row: 2 });
  ctx.progressForUser_ = (userId) => data.Progreso.filter((row) => row.UsuarioId === userId).map((row) => ({ ...row }));
  ctx.upsertProgress_('a', 1, 'INICIADA');
  assert.equal(data.Progreso[0].Estado, 'COMPLETADA');
  const key = 'pasaporte:request:completeBonus:req-1';
  assert.equal(ctx.claimRequest_(key).repeated, false);
  assert.throws(() => ctx.claimRequest_(key), (error) => error.retryable === true);
  ctx.completeRequest_(key, { saved: true });
  assert.deepEqual(clean(ctx.claimRequest_(key)), { repeated: true, data: { saved: true } });
});

test('preparación del evento sirve progreso y Bonus sin búsquedas por participante', () => {
  const { ctx, data } = backend();
  data.Progreso.push({ Id: 'p2', UsuarioId: 'a', MisionId: 2, Estado: 'INICIADA', _row: 2 });
  data.Bonus.push({ Id: 'b2', UsuarioId: 'a', JuegoId: 'sudoku', Puntaje: 120, Record: 120, _row: 2 });
  const snapshot = ctx.warmActivitySnapshots_();
  assert.equal(snapshot.ready, true);
  ctx.findObjectsByField_ = () => { throw Error('No debe consultar la hoja durante el pico'); };
  assert.equal(ctx.progressForUser_('a')[0].MisionId, 2);
  assert.equal(ctx.bonusForUser_('a')[0].JuegoId, 'sudoku');
  assert.deepEqual(clean(ctx.progressForUser_('usuario-sin-datos')), []);
});

test('la conexión de Apps Script solo puede provenir de la configuración publicada', () => {
  const source = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(source, /Revisar conexión con Apps Script|Validar y guardar|pasaporte_apps_script_url/);
  assert.doesNotMatch(source, /probeApiConnection|saveApiConnection|connectionOpen|connectionUrl/);
  assert.doesNotMatch(source, /Demo1234/);
  const getApiUrlBody = source.slice(source.indexOf('function getApiUrl'), source.indexOf('function featureEnabled'));
  assert.match(getApiUrlBody, /window\.PASSPORT_CONFIG\?\.apiUrl/);
  assert.doesNotMatch(getApiUrlBody, /localStorage/);
  assert.match(main, /new URL\("\.\/config\.js", document\.baseURI\)/);
  assert.match(main, /Date\.now\(\)/);
  assert.match(main, /configScript\.onload = renderApp/);
  assert.doesNotMatch(html, /<script[^>]+config\.js/);
});
