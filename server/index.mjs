import http from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, verifyPasscode, rootDir, defaultDataDir } from './config.mjs';
import { EncryptedStore } from './store.mjs';
import { JourneyService } from './journey.mjs';
import { createProviderConfig } from './provider-config.mjs';
import { createOpenAIService } from './openai.mjs';

const COOKIE = 'becoming_session';
// Bound the serialized request separately from character limits so non-Latin writing fits.
const BODY_LIMIT = 512 * 1024;
const DEFAULT_SESSION_TTL = 8 * 60 * 60 * 1000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

class RateLimit {
  constructor(limit, windowMs, maxKeys = 5000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
    this.buckets = new Map();
  }
  take(key) {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.until <= now) {
      if (this.buckets.size >= this.maxKeys) {
        for (const [entryKey, entry] of this.buckets) if (entry.until <= now) this.buckets.delete(entryKey);
        if (this.buckets.size >= this.maxKeys && !bucket) return Math.ceil(this.windowMs / 1000);
      }
      bucket = { count: 0, until: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count > this.limit ? Math.max(1, Math.ceil((bucket.until - now) / 1000)) : 0;
  }
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    throw new HttpError(415, 'Send this request as JSON.');
  }
  if (Number(req.headers['content-length'] || 0) > BODY_LIMIT) {
    throw new HttpError(413, 'This entry is too long. Try a shorter reflection.');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > BODY_LIMIT) throw new HttpError(413, 'This entry is too long. Try a shorter reflection.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new HttpError(400, 'That request could not be read. Please try again.');
  }
}

function stringField(value, label, max, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max) throw new HttpError(400, `${label} must be text, up to ${max} characters.`);
  return value.trim();
}

function stringList(value, label) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 12 || value.some((item) => typeof item !== 'string' || item.length > 60)) {
    throw new HttpError(400, `${label} must contain up to 12 short text items.`);
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function validateEntry(body) {
  const text = stringField(body.body, 'Reflection', 100000);
  if (!text) throw new HttpError(400, 'Write a little something before saving.');
  const entry = {
    id: randomUUID(), title: stringField(body.title, 'Title', 120, 'A moment of becoming') || 'A moment of becoming',
    body: text, mode: stringField(body.mode, 'Mode', 60, 'journal') || 'journal', createdAt: new Date().toISOString(),
  };
  if (body.mood !== undefined) {
    if (typeof body.mood === 'number' && Number.isFinite(body.mood) && body.mood >= 0 && body.mood <= 10) entry.mood = body.mood;
    else entry.mood = stringField(body.mood, 'Mood', 80);
  }
  const tags = stringList(body.tags, 'Tags');
  if (tags) entry.tags = tags;
  return entry;
}

function validatePreferences(body) {
  const preferences = {};
  if (body.name !== undefined) preferences.name = stringField(body.name, 'Name', 80);
  for (const key of ['themes', 'values']) {
    const value = stringList(body[key], key === 'themes' ? 'Themes' : 'Values');
    if (value) preferences[key] = value;
  }
  return preferences;
}

function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}

function sessionHash(token) { return createHash('sha256').update(token).digest('base64'); }

async function resolveExistingPath(filename) {
  try { return await fs.realpath(filename); }
  catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    const parent = path.dirname(filename);
    if (parent === filename) return filename;
    return path.join(await resolveExistingPath(parent), path.basename(filename));
  }
}

const loopbackAddress = (address = '') => address === '::1' || /^127\./.test(address.replace(/^::ffff:/, ''));

export async function createApp(options = {}) {
  const host = options.host ?? process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  const rawOrigin = options.origin ?? process.env.APP_ORIGIN;
  let trustedOrigin;
  if (rawOrigin) {
    const parsed = new URL(rawOrigin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('APP_ORIGIN must be one http:// or https:// origin without a path.');
    }
    trustedOrigin = parsed.origin;
  }
  if (process.env.NODE_ENV === 'production' && !trustedOrigin?.startsWith('https:')) throw new Error('Set APP_ORIGIN to the public HTTPS origin for production.');
  const distDir = path.resolve(options.distDir ?? path.join(rootDir, 'dist'));
  const dataDir = path.resolve(options.dataDir ?? process.env.DATA_DIR ?? defaultDataDir);
  const providerDir = path.resolve(options.openaiConfigDir ?? process.env.OPENAI_CONFIG_DIR ?? path.join(dataDir, 'openai'));
  const publicPath = await resolveExistingPath(distDir);
  for (const [label, directory] of [['DATA_DIR', dataDir], ['OPENAI_CONFIG_DIR', providerDir]]) {
    const privatePath = await resolveExistingPath(directory);
    if (privatePath === publicPath || privatePath.startsWith(publicPath + path.sep)) throw new Error(`${label} must be outside the frontend dist directory.`);
  }
  const config = await loadConfig({ dataDir, passcode: options.passcode ?? process.env.APP_PASSCODE });
  const store = new EncryptedStore(config);
  await store.initialize();
  const provider = await createProviderConfig({ dataDir: providerDir, apiKey: options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '' });
  const openai = options.openaiService ?? createOpenAIService({ apiKey: () => provider.getKey() });
  // Provider hooks are injected explicitly; journey storage never discovers credentials.
  const journey = new JourneyService({
    store, reviewJourney: options.reviewJourney ?? (input => openai.reviewJourney(input)),
    aiReviewAvailable: options.aiReviewAvailable ?? (() => provider.status().configured),
    reviewIntervalMs: options.journeyReviewIntervalMs,
  });
  const journeyMutationLimit = new RateLimit(options.journeyMutationLimit ?? 120, 60 * 1000);
  const journeyReviewLimit = new RateLimit(options.journeyReviewLimit ?? 6, 60 * 1000);
  const voiceSessionLimit = new RateLimit(options.voiceSessionLimit ?? 6, 60 * 1000);
  const voiceConfigLimit = new RateLimit(10, 60 * 1000);
  let activeVoiceSessions = 0;
  const sessions = new Map();
  const ttl = options.sessionTtlMs ?? DEFAULT_SESSION_TTL;
  const ipLimit = new RateLimit(options.unlockLimit ?? 8, options.unlockWindowMs ?? 15 * 60 * 1000);
  const globalLimit = new RateLimit(options.globalUnlockLimit ?? 60, 60 * 1000, 1);
  let activeUnlocks = 0;

  const originFor = (req) => {
    let supplied;
    try { supplied = new URL(`http://${req.headers.host}`); } catch { throw new HttpError(400, 'Invalid host.'); }
    if (supplied.username || supplied.password || supplied.pathname !== '/' || supplied.search || supplied.hash) throw new HttpError(400, 'Invalid host.');
    if (trustedOrigin) {
      if (supplied.host !== new URL(trustedOrigin).host) throw new HttpError(400, 'This host is not configured for the app.');
      return trustedOrigin;
    }
    const expectedPort = String(server.address()?.port ?? options.port ?? 4173);
    const allowedHost = LOOPBACK_HOSTS.has(supplied.hostname) || (host !== '0.0.0.0' && host !== '::' && supplied.hostname === host);
    if (!allowedHost || (supplied.port || '80') !== expectedPort) throw new HttpError(400, 'This host is not configured for the app.');
    return `http://${supplied.host}`;
  };

  const tokenFrom = (req) => {
    const cookies = (req.headers.cookie || '').split(';').map((value) => value.trim());
    const found = cookies.filter((value) => value.startsWith(`${COOKIE}=`));
    if (found.length !== 1) return null;
    const token = found[0].slice(COOKIE.length + 1);
    return /^[a-f0-9]{64}$/.test(token) ? token : null;
  };

  const isAuthenticated = (req) => {
    const token = tokenFrom(req);
    if (!token) return false;
    const key = sessionHash(token);
    const expires = sessions.get(key);
    if (!expires || expires <= Date.now()) { sessions.delete(key); return false; }
    return true;
  };

  const cookie = (value, origin, maxAge) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${origin.startsWith('https:') ? '; Secure' : ''}`;

  const serveStatic = async (req, res, pathname) => {
    if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { throw new HttpError(400, 'Invalid path.'); }
    if (decoded.includes('\0') || decoded.includes('\\')) throw new HttpError(400, 'Invalid path.');
    let filename = path.resolve(distDir, `.${decoded}`);
    if (filename !== distDir && !filename.startsWith(distDir + path.sep)) throw new HttpError(404, 'Not found.');
    let stat;
    try {
      stat = await fs.stat(filename);
      if (stat.isDirectory()) filename = path.join(filename, 'index.html');
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      // Only extensionless app routes fall back to the SPA.
      if (path.extname(decoded)) throw new HttpError(404, 'Not found.');
      filename = path.join(distDir, 'index.html');
    }
    let contents;
    try {
      const realDist = await fs.realpath(distDir);
      const realFile = await fs.realpath(filename);
      if (!realFile.startsWith(realDist + path.sep)) throw new HttpError(404, 'Not found.');
      contents = await fs.readFile(realFile);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR') throw new HttpError(404, 'Build the app with npm run build first.');
      throw error;
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filename)] || 'application/octet-stream', 'Content-Length': contents.length });
    res.end(req.method === 'HEAD' ? undefined : contents);
  };

  const server = http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    try {
      const origin = originFor(req);
      if (origin.startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      const url = new URL(req.url, origin);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') {
          throw new HttpError(403, 'This request must come from your HPY app.');
        }
      }
      if (!url.pathname.startsWith('/api/')) return await serveStatic(req, res, url.pathname);
      if (url.pathname === '/api/session' && req.method === 'GET') {
        return json(res, 200, { authenticated: isAuthenticated(req) });
      }
      if (url.pathname === '/api/unlock' && req.method === 'POST') {
        // Use the socket address, never caller-controlled forwarding headers.
        const retry = ipLimit.take(req.socket.remoteAddress || 'unknown') || globalLimit.take('all');
        if (retry || activeUnlocks >= 4) {
          res.setHeader('Retry-After', String(retry || 10));
          throw new HttpError(429, 'Too many tries. Take a pause and try again later.');
        }
        const body = await readBody(req);
        if (activeUnlocks >= 4) {
          res.setHeader('Retry-After', '10');
          throw new HttpError(429, 'A few unlock attempts are in progress. Try again in a moment.');
        }
        activeUnlocks += 1;
        let verified;
        try { verified = await verifyPasscode(body.passcode, config.credential); }
        finally { activeUnlocks -= 1; }
        if (!verified) throw new HttpError(401, 'That passcode did not match. Try again.');
        const previous = tokenFrom(req);
        if (previous) sessions.delete(sessionHash(previous));
        for (const [key, expires] of sessions) if (expires <= Date.now()) sessions.delete(key);
        if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
        const token = randomBytes(32).toString('hex');
        sessions.set(sessionHash(token), Date.now() + ttl);
        res.setHeader('Set-Cookie', cookie(token, origin, Math.floor(ttl / 1000)));
        return json(res, 200, { authenticated: true });
      }
      if (url.pathname === '/api/lock' && req.method === 'POST') {
        const token = tokenFrom(req);
        if (token) sessions.delete(sessionHash(token));
        res.setHeader('Set-Cookie', cookie('', origin, 0));
        return json(res, 200, { authenticated: false });
      }
      if (!isAuthenticated(req)) throw new HttpError(401, 'Your space is locked. Enter your passcode to continue.');
      const canConfigureVoice = !trustedOrigin && LOOPBACK_HOSTS.has(new URL(origin).hostname) && loopbackAddress(req.socket.remoteAddress);
      const voiceStatus = () => ({ ...openai.status(), ...provider.status(), canConfigure: canConfigureVoice });
      if (url.pathname === '/api/voice/status' && req.method === 'GET') return json(res, 200, voiceStatus());
      if (url.pathname === '/api/voice/config' && ['PUT', 'DELETE'].includes(req.method)) {
        if (!canConfigureVoice) throw new HttpError(403, 'Connect or disconnect the AI provider from this app’s local address on this Mac.');
        const retry = voiceConfigLimit.take(req.socket.remoteAddress || 'unknown');
        if (retry) { res.setHeader('Retry-After', String(retry)); throw new HttpError(429, 'Take a short pause before changing the AI connection again.'); }
        if (req.method === 'PUT') await provider.setKey((await readBody(req)).apiKey);
        else await provider.clearKey();
        await journey.providerChanged();
        return json(res, 200, voiceStatus());
      }
      if (url.pathname === '/api/voice/session' && req.method === 'POST') {
        const retry = voiceSessionLimit.take(req.socket.remoteAddress || 'unknown');
        if (retry || activeVoiceSessions) {
          res.setHeader('Retry-After', String(retry || 10));
          throw new HttpError(429, 'A voice connection is already starting, or you have made several attempts. Try again shortly.');
        }
        const body = await readBody(req);
        const context = await journey.voiceContext(body.worldId, body.regionId);
        if (!provider.status().configured) throw new HttpError(503, 'Connect an OpenAI API key before starting AI voice.');
        if (typeof body.sdp !== 'string' || body.sdp.length > 100000 || !/^v=0(?:\r?\n)/.test(body.sdp)) throw new HttpError(400, 'The browser’s voice connection offer could not be read.');
        if (activeVoiceSessions) { res.setHeader('Retry-After', '10'); throw new HttpError(429, 'Another voice connection is starting. Try again in a moment.'); }
        activeVoiceSessions += 1;
        try {
          const voiceResult = await openai.createVoiceCall({ sdp: body.sdp, context });
          if (!isAuthenticated(req)) throw new HttpError(401, 'Your space locked while voice was connecting. Unlock to try again.');
          return json(res, 200, { ...voiceResult, sessionExpiresAt: sessions.get(sessionHash(tokenFrom(req))) });
        }
        finally { activeVoiceSessions -= 1; }
      }
      if (url.pathname === '/api/journey' && req.method === 'GET') return json(res, 200, await journey.read());
      if (url.pathname === '/api/journey/export' && req.method === 'GET') {
        res.setHeader('Content-Disposition', `attachment; filename="hpy-journey-${new Date().toISOString().slice(0, 10)}.json"`);
        return json(res, 200, { format: 'hpy-journey-v1', exportedAt: new Date().toISOString(), ...(await journey.read()) });
      }
      if (url.pathname.startsWith('/api/journey/') && ['POST', 'DELETE'].includes(req.method)) {
        const limit = url.pathname === '/api/journey/review' ? journeyReviewLimit : journeyMutationLimit;
        const retry = limit.take(req.socket.remoteAddress || 'unknown');
        if (retry) { res.setHeader('Retry-After', String(retry)); throw new HttpError(429, 'Take a short pause before updating your journey again.'); }
        if (req.method === 'DELETE' && url.pathname.startsWith('/api/journey/insights/')) {
          return json(res, 200, await journey.removeInsight(url.pathname.slice('/api/journey/insights/'.length)));
        }
        if (req.method === 'POST') {
          if (url.pathname === '/api/journey/review') return json(res, 202, await journey.requestReview());
          const body = await readBody(req);
          if (url.pathname === '/api/journey/visit') return json(res, 200, await journey.visit(body));
          if (url.pathname === '/api/journey/world') return json(res, 200, await journey.selectWorld(body));
          if (url.pathname === '/api/journey/complete') return json(res, 200, await journey.complete(body));
          if (url.pathname === '/api/journey/insights') return json(res, 201, await journey.addInsight(body));
          if (url.pathname === '/api/journey/settings') return json(res, 200, await journey.settings(body));
        }
      }
      if (url.pathname === '/api/journal' && req.method === 'GET') return json(res, 200, { entries: (await store.read()).entries });
      if (url.pathname === '/api/journal' && req.method === 'POST') {
        const entry = validateEntry(await readBody(req));
        const savedJourney = await store.update((state) => {
          if (state.entries.length >= 2000) throw new HttpError(409, 'Your journal has reached 2,000 entries. Export it before making more room.');
          state.entries.unshift(entry);
          return journey.addJournalInsight(state, entry);
        });
        journey.afterCommit(savedJourney);
        return json(res, 201, { entry, journey: savedJourney });
      }
      if (url.pathname === '/api/journal' && req.method === 'DELETE') {
        const savedJourney = await store.update((state) => { state.entries = []; return journey.removeJournalInsights(state); });
        journey.afterCommit(savedJourney);
        return json(res, 200, { entries: [], ...(savedJourney ? { journey: savedJourney } : {}) });
      }
      if (url.pathname.startsWith('/api/journal/') && req.method === 'DELETE') {
        const id = url.pathname.slice('/api/journal/'.length);
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, 'Entry not found.');
        const deleted = await store.update((state) => {
          const index = state.entries.findIndex((entry) => entry.id === id);
          if (index === -1) return false;
          state.entries.splice(index, 1);
          return { journey: journey.removeJournalInsights(state, [id]) };
        });
        if (!deleted) throw new HttpError(404, 'Entry not found.');
        journey.afterCommit(deleted.journey);
        return json(res, 200, { deleted: true, ...(deleted.journey ? { journey: deleted.journey } : {}) });
      }
      if (url.pathname === '/api/preferences' && req.method === 'GET') return json(res, 200, { preferences: (await store.read()).preferences });
      if (url.pathname === '/api/preferences' && req.method === 'POST') {
        const updates = validatePreferences(await readBody(req));
        const preferences = await store.update((state) => { state.preferences = { ...state.preferences, ...updates }; return state.preferences; });
        return json(res, 200, { preferences });
      }
      throw new HttpError(404, 'Not found.');
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      if (!error.status) console.error('Request failed:', error.code || error.name || 'Error');
      json(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong saving your space. Please try again.' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 50;
  return { server, host, close: async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await journey.close();
  } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const app = await createApp();
    const port = Number(process.env.PORT || 4173);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
    app.server.listen(port, app.host, () => console.log(`HPY is ready at ${process.env.APP_ORIGIN || `http://${app.host}:${port}`}`));
    const shutdown = () => { void app.close().then(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
