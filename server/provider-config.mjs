import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWrite } from './config.mjs';

const AAD = Buffer.from('hpy-openai-credential-v1');

function validateKey(value) {
  if (typeof value !== 'string' || !/^sk-[A-Za-z0-9_-]{16,512}$/.test(value.trim())) {
    const error = new Error('Enter an OpenAI project API key beginning with sk-.');
    error.status = 400;
    throw error;
  }
  return value.trim();
}

/** Optional host-side credential storage. Never included in journey exports. */
export async function createProviderConfig({ dataDir, apiKey = '' }) {
  const directory = path.resolve(dataDir);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  const keyFile = path.join(directory, 'vault.key');
  const secretFile = path.join(directory, 'openai.enc');
  // Exclusive creation lets two local app processes share the vault safely.
  try { await fs.writeFile(keyFile, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  await fs.chmod(keyFile, 0o600);
  const encryptionKey = await fs.readFile(keyFile);
  if (encryptionKey.length !== 32) throw new Error('The OpenAI credential vault could not be opened.');
  const environmentKey = typeof apiKey === 'string' ? apiKey.trim() : '';

  function getKey() {
    if (environmentKey) return environmentKey;
    let saved;
    try { saved = JSON.parse(readFileSync(secretFile, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return ''; throw new Error('The OpenAI credential vault could not be opened.'); }
    try {
      if (saved.version !== 1) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(saved.iv, 'base64'));
      decipher.setAAD(AAD);
      decipher.setAuthTag(Buffer.from(saved.tag, 'base64'));
      return validateKey(Buffer.concat([decipher.update(Buffer.from(saved.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
    } catch { throw new Error('The OpenAI credential vault could not be opened.'); }
  }

  return {
    getKey,
    status: () => ({ configured: Boolean(getKey()), source: environmentKey ? 'environment' : getKey() ? 'host' : null }),
    async setKey(value) {
      if (environmentKey) { const error = new Error('This host uses OPENAI_API_KEY. Update the deployment secret to change it.'); error.status = 409; throw error; }
      const key = validateKey(value);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
      cipher.setAAD(AAD);
      const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
      await atomicWrite(secretFile, JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }));
    },
    async clearKey() {
      if (environmentKey) { const error = new Error('Remove OPENAI_API_KEY from the deployment to disconnect it.'); error.status = 409; throw error; }
      await fs.unlink(secretFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
    },
  };
}
