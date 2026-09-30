import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from './server/index.mjs';

const testPasscode = 'a-test-only-passcode';

async function fixture(t, options = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'becoming-test-'));
  const distDir = path.join(dataDir, 'dist');
  await fs.mkdir(distDir);
  await fs.writeFile(path.join(distDir, 'index.html'), '<!doctype html><h1>Test app</h1>');
  const apps = [];
  t.after(async () => {
    for (const app of apps) if (app.server.listening) await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  const start = async (overrides = {}) => {
    const app = await createApp({ dataDir, distDir, passcode: testPasscode, openaiApiKey: '', ...options, ...overrides });
    await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
    apps.push(app);
    const base = `http://127.0.0.1:${app.server.address().port}`;
    // Node's fetch intentionally rewrites Host; use a raw HTTP client so Host tests exercise the real boundary.
    const request = (route, { body, cookie, headers = {}, ...init } = {}) => new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : undefined;
      const outbound = http.request(base + route, {
        ...init,
        headers: { ...(payload !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: response.statusCode, headers: new Headers(response.headers), text: async () => text, json: async () => JSON.parse(text) });
        });
      });
      outbound.on('error', reject);
      outbound.end(payload);
    });
    const unlock = async () => {
      const response = await request('/api/unlock', { method: 'POST', body: { passcode: testPasscode } });
      assert.equal(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    };
    return { app, base, request, unlock };
  };
  return { ...(await start()), dataDir, distDir, start };
}

test('the gate protects every private API and never exposes the configured passcode', async (t) => {
  const { request } = await fixture(t);
  assert.deepEqual(await (await request('/api/session')).json(), { authenticated: false });
  for (const [route, method, body] of [
    ['/api/journal', 'GET'], ['/api/journal', 'POST', { body: 'private' }],
    ['/api/journal', 'DELETE'], ['/api/journal/00000000-0000-0000-0000-000000000000', 'DELETE'],
    ['/api/preferences', 'GET'], ['/api/preferences', 'POST', { name: 'A' }],
  ]) {
    const response = await request(route, { method, body });
    assert.equal(response.status, 401, `${method} ${route}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.text()).includes(testPasscode), false);
  }
  for (const passcode of ['', 'wrong', null, ['a-test-only-passcode']]) {
    assert.equal((await request('/api/unlock', { method: 'POST', body: { passcode } })).status, 401);
  }
  assert.equal((await request('/api/journal', { cookie: 'becoming_session=' + 'a'.repeat(64) })).status, 401);
});

test('successful unlock sets an HttpOnly Strict cookie, and lock revokes its server session', async (t) => {
  const { request } = await fixture(t);
  const unlocked = await request('/api/unlock', { method: 'POST', body: { passcode: testPasscode } });
  const header = unlocked.headers.get('set-cookie');
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
  assert.match(header, /Path=\//);
  const cookie = header.split(';')[0];
  assert.deepEqual(await (await request('/api/session', { cookie })).json(), { authenticated: true });
  const locked = await request('/api/lock', { method: 'POST', cookie });
  assert.equal(locked.status, 200);
  assert.match(locked.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await request('/api/journal', { cookie })).status, 401);
});

test('cross-origin writes, cross-site requests without Origin, and unconfigured Hosts are rejected', async (t) => {
  const { request, unlock, base } = await fixture(t);
  const cookie = await unlock();
  for (const route of ['/api/unlock', '/api/lock', '/api/journal', '/api/preferences']) {
    const response = await request(route, { method: 'POST', cookie, body: { passcode: testPasscode, body: 'private' }, headers: { Origin: 'https://untrusted.example' } });
    assert.equal(response.status, 403, route);
  }
  assert.equal((await request('/api/lock', { method: 'POST', cookie, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await request('/api/session', { headers: { Host: 'untrusted.example' } })).status, 400);
  assert.equal((await request('/api/journal', { method: 'POST', cookie, body: { body: 'same-origin works' }, headers: { Origin: base } })).status, 201);
});

test('configured HTTPS origins use Secure cookies even behind a proxy', async (t) => {
  const { request } = await fixture(t, { origin: 'https://becoming.example' });
  const response = await request('/api/unlock', { method: 'POST', headers: { Host: 'becoming.example', Origin: 'https://becoming.example' }, body: { passcode: testPasscode } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /; Secure/);
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
});

test('unlock rate limiting cannot be bypassed with forged forwarding headers', async (t) => {
  const { request } = await fixture(t, { unlockLimit: 2 });
  for (let index = 0; index < 2; index += 1) {
    const response = await request('/api/unlock', { method: 'POST', body: { passcode: 'wrong' }, headers: { 'X-Forwarded-For': `192.0.2.${index}` } });
    assert.equal(response.status, 401);
  }
  const limited = await request('/api/unlock', { method: 'POST', body: { passcode: testPasscode }, headers: { 'X-Forwarded-For': '203.0.113.99' } });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('journal and preferences survive restarts and are encrypted at rest', async (t) => {
  const { app, request, unlock, dataDir, start } = await fixture(t);
  const cookie = await unlock();
  const privateText = 'My deeply private feeling about Tuesday';
  const created = await request('/api/journal', { method: 'POST', cookie, body: { title: 'Tuesday', body: privateText, mode: 'reflect', mood: 'tender', tags: ['conflict'] } });
  assert.equal(created.status, 201);
  const { entry } = await created.json();
  assert.equal(entry.body, privateText);
  assert.ok(entry.id && entry.createdAt);
  await request('/api/preferences', { method: 'POST', cookie, body: { name: 'Private Person', themes: ['boundaries'], values: ['kindness'] } });
  const encrypted = await fs.readFile(path.join(dataDir, 'journal.enc'), 'utf8');
  assert.equal(encrypted.includes(privateText), false);
  assert.equal(encrypted.includes('Private Person'), false);
  const configText = await fs.readFile(path.join(dataDir, 'config.json'), 'utf8');
  assert.equal(configText.includes(testPasscode), false);
  assert.equal((await fs.stat(path.join(dataDir, 'config.json'))).mode & 0o777, 0o600);
  await app.close();
  const restarted = await start({ passcode: undefined });
  assert.equal((await restarted.request('/api/journal', { cookie })).status, 401, 'old sessions must not survive restart');
  const newCookie = await restarted.unlock();
  const journal = await (await restarted.request('/api/journal', { cookie: newCookie })).json();
  assert.equal(journal.entries[0].body, privateText);
  assert.deepEqual((await (await restarted.request('/api/preferences', { cookie: newCookie })).json()).preferences, { name: 'Private Person', themes: ['boundaries'], values: ['kindness'] });
  assert.equal((await restarted.request(`/api/journal/${entry.id}`, { method: 'DELETE', cookie: newCookie })).status, 200);
  assert.deepEqual(await (await restarted.request('/api/journal', { cookie: newCookie })).json(), { entries: [] });
});

test('concurrent saves are serialized without lost entries, and deletion persists', async (t) => {
  const { app, request, unlock, start } = await fixture(t);
  const cookie = await unlock();
  const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => request('/api/journal', { method: 'POST', cookie, body: { body: `reflection ${index}` } })));
  assert.ok(responses.every((response) => response.status === 201));
  assert.equal((await (await request('/api/journal', { cookie })).json()).entries.length, 12);
  await request('/api/journal', { method: 'DELETE', cookie });
  await app.close();
  const restarted = await start();
  assert.deepEqual(await (await restarted.request('/api/journal', { cookie: await restarted.unlock() })).json(), { entries: [] });
});

test('expired sessions cannot read the journal', async (t) => {
  const { request, unlock } = await fixture(t, { sessionTtlMs: 30 });
  const cookie = await unlock();
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal((await request('/api/journal', { cookie })).status, 401);
});

test('input limits and static directory boundaries protect private files', async (t) => {
  const { request, unlock, distDir, dataDir } = await fixture(t);
  const cookie = await unlock();
  assert.equal((await request('/api/journal', { method: 'POST', cookie, body: { body: '' } })).status, 400);
  assert.equal((await request('/api/journal', { method: 'POST', cookie, body: { body: 'x'.repeat(100001) } })).status, 400);
  assert.equal((await request('/api/journal', { method: 'POST', cookie, body: { body: 'x'.repeat(600000) } })).status, 413);
  assert.equal((await request('/api/preferences', { method: 'POST', cookie, body: { values: ['x'.repeat(200)] } })).status, 400);
  await fs.symlink(path.join(dataDir, 'config.json'), path.join(distDir, 'leak.json'));
  for (const route of ['/data/config.json', '/server/config.mjs', '/%2e%2e/data/config.json', '/leak.json']) {
    assert.equal((await request(route)).status, 404, route);
  }
  const staticResponse = await request('/');
  assert.equal(staticResponse.status, 200);
  assert.match(staticResponse.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(staticResponse.headers.get('permissions-policy'), /microphone=\(self\)/, 'same-origin optional voice typing must remain available');
});

test('non-Latin journal notes and a long bounded conversation fit the request envelope', async (t) => {
  const { request, unlock } = await fixture(t);
  const cookie = await unlock();
  const note = 'मन'.repeat(7500);
  assert.equal(note.length, 15000);
  assert.ok(Buffer.byteLength(note) > 32768);
  for (const body of [note, '界'.repeat(80000)]) {
    const response = await request('/api/journal', { method: 'POST', cookie, body: { title: 'मेरी बात', body, mode: 'talk' } });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).entry.body, body);
  }
});

test('tampering with the encrypted journal fails closed rather than discarding data', async (t) => {
  const { app, request, unlock, dataDir, start } = await fixture(t);
  await request('/api/journal', { method: 'POST', cookie: await unlock(), body: { body: 'Keep this safe' } });
  await app.close();
  const filename = path.join(dataDir, 'journal.enc');
  const envelope = JSON.parse(await fs.readFile(filename, 'utf8'));
  const bytes = Buffer.from(envelope.data, 'base64');
  bytes[0] ^= 1;
  envelope.data = bytes.toString('base64');
  await fs.writeFile(filename, JSON.stringify(envelope));
  await assert.rejects(start(), /Could not read the encrypted journal/);
});
