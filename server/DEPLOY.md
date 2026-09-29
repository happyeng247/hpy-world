# Running your private HPY space

Use Node.js 22 or later. The backend has no third-party runtime dependencies. The app is a single-person space: anyone who knows its passcode can read the same journal.

## Local use

The delivered local copy is already configured with the requested passcode. A fresh clone has no passcode configuration or journal. From the app directory, install dependencies and build:

```sh
npm ci --cache node_modules/.cache/npm
npm run build
```

For a fresh installation or to change the saved passcode without changing your journal encryption key, set `APP_PASSCODE` just for setup:

```sh
APP_PASSCODE='your-private-passcode' npm run setup
```

After setup (or when using an already configured local copy), start the server:

```sh
npm start
```

Open `http://127.0.0.1:4173`. Keep that terminal running while using the app. The local server binds only to this computer by default. Every browser on this computer uses the same saved journal after unlocking.

Restart the running server after changing a passcode. An `APP_PASSCODE` environment variable on the server takes precedence over the saved credential. A `.env` file is not loaded automatically; use `node --env-file=.env server/index.mjs` if you choose to keep local configuration in one.

## Access from your phone or another computer

Host the Node server behind HTTPS with a persistent disk. A static-only host cannot run this authentication or encrypted storage. The included `render.yaml` is a deployment starting point for a single Node service with persistent storage. It does not publish the app automatically; hosting plans and availability are determined by the provider.

Configure these environment variables in your host:

| Variable | Value |
| --- | --- |
| `APP_PASSCODE` | Your private passcode, stored as a hosting secret |
| `APP_ORIGIN` | The exact public origin, e.g. `https://your-service.onrender.com`, without a path |
| `DATA_DIR` | A directory on the persistent disk, e.g. `/var/data/becoming` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | Supplied by your host, or `4173` |

Use one server process and one instance. The store serializes writes within that process; it is not a distributed database. The reverse proxy must preserve the public `Host` header. Forwarded IP or protocol headers are intentionally not trusted. Login rate limiting uses the actual connecting address, so clients behind one proxy may share a limit. Successful and unsuccessful unlock attempts both count toward the limit of eight per 15 minutes per address.

The Dockerfile provides an alternative build. Mount `/var/data/becoming` on a persistent volume writable by the container's `node` user, and supply `APP_PASSCODE` and `APP_ORIGIN` securely at runtime. Do not copy your local `data` directory into an image or a public repository.

## Privacy and recovery

The passcode is checked on the server with a salted scrypt hash. Sessions use opaque, expiring HttpOnly cookies with SameSite=Strict; HTTPS deployments also use Secure cookies. Locking revokes the active session. Restarting the server clears all sessions. Cross-origin writes are rejected.

Journal entries and personalization are encrypted with AES-256-GCM before disk writes. The encryption key is in `data/config.json` (or the configured data directory), outside the served frontend. This protects against accidentally exposing the journal file by itself. The running server and anyone with access to both data files can decrypt the journal; this is not end-to-end encryption.

Back up the entire private data directory together, including `config.json` and `journal.enc`. Losing the key means losing the journal. Keep backups private. File permissions restrict the directory and files to the server's user. Never publish the data directory or include it in a downloadable source archive.

```sh
npm test
```

The server tests cover the authentication gate, session revocation and expiry, cross-origin protection, brute-force limits, encrypted persistence, concurrent saves, invalid input, static file boundaries, and tamper detection.
