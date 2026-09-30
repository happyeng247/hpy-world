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

Host the Node server behind HTTPS with a persistent disk. A static-only host cannot run this authentication or encrypted storage.

[Deploy HPY to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fhappyeng247%2Fhpy-world)

This [official deployment shortcut](https://render.com/docs/deploy-to-render) opens the public repository's `render.yaml` in your Render account. Review the service and pricing, enter `APP_PASSCODE` privately when prompted, and deploy. Do not put the passcode in the repository. The link opens the setup flow; it is not a live instance of the app.

The Blueprint configures one Node 22 web service on Render's `0.5c-512mb` paid compute plan, with a 1 GB persistent disk mounted at `/var/data`. **The service and persistent disk incur hosting charges.** Render requires a paid service for [persistent disks](https://render.com/docs/disks); check the current charges shown in your account before deploying. The build explicitly installs development dependencies because Vite is needed to build the frontend.

For the standard `onrender.com` address, no manual origin setting is needed: the start command uses Render's [`RENDER_EXTERNAL_URL`](https://render.com/docs/environment-variables) unless you set `APP_ORIGIN` yourself. For a custom domain, set `APP_ORIGIN` to that exact HTTPS origin before using it. The server accepts only the configured hostname; the `/api/session` health check must use the same hostname. On first startup, the server creates its private configuration and an empty journal store on the persistent disk. Local journal data is not uploaded by this deployment.

After Render reports a successful deploy, open the service's HTTPS URL and unlock it with the passcode you configured. Automatic deployments from future source pushes are disabled, following Render's deployment-button guidance. Use **Manual Deploy** in Render when you want to publish a later version. These instructions and the Blueprint do not indicate that a hosted deployment has already been created.

For another host, or to customize the Render service, configure these environment variables:


| Variable | Value |
| --- | --- |
| `APP_PASSCODE` | Your private passcode, stored as a hosting secret |
| `APP_ORIGIN` | The exact public HTTPS origin, without a path; optional for the standard Render URL with the supplied start command |
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


## OpenAI voice and journey review

Set `OPENAI_API_KEY` as a private server environment variable in your hosting service. Use an OpenAI project with billing and model access; never put a key in a `VITE_` variable or the static frontend. Current defaults are `gpt-realtime-2.1` for voice, `gpt-live-transcribe` for voice input transcription, and `gpt-6-luna` for reviews. Override with `OPENAI_REALTIME_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`, and `OPENAI_REVIEW_MODEL` if your project uses another compatible model.

For local setup, unlock at a loopback address and open **My journey → OpenAI connection**. The encrypted key vault defaults to `DATA_DIR/openai`. Optional `OPENAI_CONFIG_DIR` can share the credential between local app instances while keeping their journals separate. The directory must stay outside the served `dist/` tree. Local setup is denied whenever `APP_ORIGIN` is configured, including requests arriving through a local reverse proxy. Configure a hosted deployment through its secret manager instead.

The journal and journey share the existing encrypted store. Back up its config and journal together. OpenAI credentials are separate from the journal and never appear in journey exports. Persistent storage is required for progress and insights to survive redeployment. The single-process store must not be shared by multiple writing replicas.

API status means a key is configured, not that billing or every model has been verified. Use the in-app voice flow to test microphone permissions and model access after connecting your project. AI reviews remain off until the user enables them. New saved reflections then refresh the backend review; disabled or unavailable AI leaves basic descriptive observations in place. This app does not run a clinical assessment, emergency monitor, or continuous microphone recording.
