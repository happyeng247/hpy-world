import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProviderConfig } from './provider-config.mjs';

const fixtureKey = 'sk-fixture_this_is_not_an_actual_api_key';
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hpy-provider-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('credential persists encrypted and a second process sees updates without restart', async t => {
  const dataDir = await fixture(t);
  const first = await createProviderConfig({ dataDir });
  const second = await createProviderConfig({ dataDir });
  assert.deepEqual(first.status(), { configured: false, source: null });
  await first.setKey(fixtureKey);
  assert.equal(second.getKey(), fixtureKey);
  assert.equal(second.status().source, 'host');
  const disk = await fs.readFile(path.join(dataDir, 'openai.enc'), 'utf8');
  assert.ok(!disk.includes(fixtureKey));
  assert.equal((await fs.stat(path.join(dataDir, 'openai.enc'))).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.join(dataDir, 'vault.key'))).mode & 0o777, 0o600);
  assert.ok(!JSON.stringify(second.status()).includes(fixtureKey));
  await first.clearKey();
  assert.equal(second.getKey(), '');
});

test('environment secret wins and cannot be silently replaced from the app', async t => {
  const provider = await createProviderConfig({ dataDir: await fixture(t), apiKey: fixtureKey });
  assert.equal(provider.getKey(), fixtureKey);
  assert.deepEqual(provider.status(), { configured: true, source: 'environment' });
  await assert.rejects(provider.setKey('sk-a_different_fixture_key'), { status: 409 });
  await assert.rejects(provider.clearKey(), { status: 409 });
});

test('invalid input and tampering never expose secret values in errors', async t => {
  const dataDir = await fixture(t);
  const provider = await createProviderConfig({ dataDir });
  await assert.rejects(provider.setKey('account-password'), { status: 400 });
  await provider.setKey(fixtureKey);
  const filename = path.join(dataDir, 'openai.enc');
  const saved = JSON.parse(await fs.readFile(filename));
  saved.ciphertext = Buffer.from('tampered').toString('base64');
  await fs.writeFile(filename, JSON.stringify(saved));
  assert.throws(provider.getKey, { message: 'The OpenAI credential vault could not be opened.' });
});
