import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWrite } from './config.mjs';

const associatedData = Buffer.from('becoming-private-journal-v1');

export class EncryptedStore {
  constructor(config) {
    this.filename = path.join(config.dataDir, 'journal.enc');
    this.key = Buffer.from(config.encryptionKey, 'base64');
    this.queue = Promise.resolve();
    this.state = { entries: [], preferences: {} };
  }

  async initialize() {
    try {
      const envelope = JSON.parse(await fs.readFile(this.filename, 'utf8'));
      if (envelope.version !== 1) throw new Error('Unsupported journal version.');
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(associatedData);
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
      const state = JSON.parse(plaintext.toString('utf8'));
      if (!Array.isArray(state.entries) || !state.preferences || typeof state.preferences !== 'object') {
        throw new Error('Invalid journal contents.');
      }
      this.state = state;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error('Could not read the encrypted journal. Restore the matching data/config.json and journal.enc backup.', { cause: error });
      }
    }
  }

  async read() {
    await this.queue;
    return structuredClone(this.state);
  }

  update(mutator) {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state);
      const result = mutator(next);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.key, iv);
      cipher.setAAD(associatedData);
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(next), 'utf8'), cipher.final()]);
      await atomicWrite(this.filename, JSON.stringify({
        version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64'),
      }));
      this.state = next;
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
