import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const defaultDataDir = path.join(rootDir, 'data');

export async function atomicWrite(filename, content) {
  const temporary = `${filename}.${randomBytes(12).toString('hex')}.tmp`;
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporary, filename);
  } finally {
    await handle?.close().catch(() => {});
    await fs.unlink(temporary).catch(() => {});
  }
}

export async function hashPasscode(passcode) {
  if (typeof passcode !== 'string' || passcode.length < 8 || passcode.length > 256) {
    throw new Error('Set APP_PASSCODE to a passcode between 8 and 256 characters.');
  }
  const salt = randomBytes(32).toString('base64');
  const hash = await scrypt(passcode, Buffer.from(salt, 'base64'), 64);
  return { salt, hash: hash.toString('base64') };
}

export async function verifyPasscode(passcode, credential) {
  if (typeof passcode !== 'string' || passcode.length > 256) return false;
  const candidate = await scrypt(passcode, Buffer.from(credential.salt, 'base64'), 64);
  const expected = Buffer.from(credential.hash, 'base64');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function loadConfig({ dataDir = defaultDataDir, passcode = process.env.APP_PASSCODE, resetPasscode = false } = {}) {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  await fs.chmod(dataDir, 0o700);
  const filename = path.join(dataDir, 'config.json');
  let config;
  try {
    config = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (config.version !== 1 || Buffer.from(config.encryptionKey ?? '', 'base64').length !== 32
      || Buffer.from(config.credential?.salt ?? '', 'base64').length !== 32
      || Buffer.from(config.credential?.hash ?? '', 'base64').length !== 64) {
      throw new Error('Invalid data/config.json. Restore a backup; do not delete the encryption key.');
    }
    await fs.chmod(filename, 0o600);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!passcode) throw new Error('Passcode is not configured. Run APP_PASSCODE="your passcode" npm run setup first.');
    config = {
      version: 1,
      encryptionKey: randomBytes(32).toString('base64'),
      credential: await hashPasscode(passcode),
    };
    await atomicWrite(filename, JSON.stringify(config));
  }
  if (passcode) {
    const credential = await hashPasscode(passcode);
    if (resetPasscode) {
      config.credential = credential;
      await atomicWrite(filename, JSON.stringify(config));
    } else {
      // A deployment secret takes precedence without changing existing disk credentials.
      config.credential = credential;
    }
  }
  return { ...config, dataDir };
}
