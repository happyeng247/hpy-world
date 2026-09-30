# hpy — your space for becoming

Your personal HPY space: three 3D worlds to wander, with room for uncertainty, conflict, boundaries, and reconnecting. Walk your traveler along garden paths, discover a place to pause, and explore questions without a score or a prescribed answer.

## Open your space

On this Mac, double-click **Open HPY.command**, then open [your HPY space](http://127.0.0.1:4173). Your passcode is unchanged; the delivered local copy is already configured. Keep the launcher’s terminal open while using the app. Press **Control+C** there to stop it, and double-click the launcher whenever you want to return.

This address works on this computer while its server is running. For a permanent link you can access from a phone or another computer, follow [the hosting instructions](server/DEPLOY.md) for an HTTPS server with persistent storage.

## Run a fresh clone

Use Node.js 22 or later. The repository contains the complete source, assets, tests, and deployment configuration. Built files, installed dependencies, passcode configuration, encryption keys, and journal data are intentionally excluded.

```sh
git clone https://github.com/happyeng247/hpy-world.git
cd hpy-world
npm ci --cache node_modules/.cache/npm
npm run build
```

On macOS, double-click **Open HPY.command** to choose a passcode with hidden input and start the app. For other systems, configure your own passcode as described in [the setup instructions](server/DEPLOY.md#local-use), then run `npm start`. Each fresh installation starts with an empty journal and needs its own private configuration. Cloning the repository does not copy the existing local journal.

## Wander your world

The world opens after you unlock. Choose **Let’s wander** to start exploring the island with your traveler. Follow peach paths through trees and gardens, look around, or choose a destination from the map.

| Control | What it does |
| --- | --- |
| **W A S D** or **arrow keys** | Walk in the direction you see on screen. |
| **Click or tap the ground** | Walk to that spot, finding a route around obstacles. |
| **Drag left or right** | Turn the camera around your traveler. |
| **Scroll** or **pinch** | Move the camera closer or farther away. |
| **E** near a place | Open its invitation. You can also use the on-screen button. |
| **Shift** while walking | Run a little. |
| **Space** | Make a small hop, unless Gentler motion is enabled. |
| **Touch joystick** | Drag in the direction you want to walk. |
| **Mobile camera buttons** | Zoom out, reset the view, or zoom in without a gesture. |
| **Map → select a place → Walk here** | Let the traveler find a route to that destination. |

On phones and tablets, a thumb joystick and camera buttons appear automatically. Hold the joystick to walk, release it to stop, and swipe the world with your other thumb to look around. Pinch with two fingers to zoom, or use the **+** and **−** buttons. Tap a nearby place’s invitation to enter. **Controls** shows instructions for your screen, and the map offers a complete alternative to steering. Both portrait and landscape layouts keep the controls within reach.

Six places invite different kinds of practice:

- **Listening Cove:** put an unfinished thought into words.
- **Mirror Pool:** notice your feelings and needs.
- **Compass Hill:** choose a quality you want to bring to a moment.
- **Rehearsal Theatre:** try another way to express yourself in a difficult conversation.
- **Stillwater Garden:** make room to pause, observe, and choose a next move, inspired by STOP.
- **Wisdom Grove:** reflect on your part in an uncertain outcome, inspired by Hindu philosophy.

Each region has a short module. Write a few words, or leave an individual question open. At the end, add your own takeaway and choose **Save insight & complete**. This saves your responses and takeaway in the encrypted backend and grows a flower at that destination. Completing all six modules unlocks the next world. Progress survives server restarts and page reloads.

**My journey** opens your world selector and ongoing reflection history:

1. **Arrival Garden** — a meadow for noticing what is here.
2. **Twilight Woods** — pines and crystals, with modules on patterns, boundaries, and response flexibility.
3. **Golden Grove** — an autumn landscape for repair, uncertainty, and bringing a practice into everyday life.

The chapters represent practices you have completed, not a grade for your mental health or personal worth. Revisit any unlocked world; each has six distinct modules. The map’s **Open module** offers an accessible alternative to walking.

The world menu lets you change your jacket color, turn on **Gentler motion**, reset the camera, or take a pause. Movement stops while a practice or menu is open. The map also offers **Open module** if you want to go directly to an encounter.

## Keep exploring the sections

Your existing sections remain available through **world menu → Browse all sections**, or through a destination’s link to its deeper practice. Choose **Wander your world** in the section navigation to return. If the browser cannot display the 3D world, the fallback offers access to all sections.

- **Talk it through:** write naturally, or try optional voice typing, and follow a question that opens something up.
- **Your inner world:** explore feelings, needs, values, choices, and release through the original reflective island activity.
- **Meet your becoming:** choose values and try a small action that feels like you.
- **The rehearsal room:** revisit a relationship moment and practice another possible response.
- **A little steadier:** explore educational adaptations of DBT and other therapy skills, including STOP, checking the facts, DEAR MAN, and validation.
- **The wisdom grove:** sit with questions inspired by Hindu philosophy, with links to the source texts.
- **My little journal:** keep selected reflections, add your own notes, export a Markdown copy, or delete saved entries.

Text reflection uses scripted prompts selected from themes in your writing. It can miss nuance, so take what helps and leave what doesn’t. Drafting does not call an AI service. Saving a reflection adds it to your private journey; AI review of saved insights is a separate, optional setting. Optional voice typing uses your browser’s speech service, which may process audio online; the app explains this before you enable it. Browser support varies, and typing is always available.

HPY is a reflection and skills practice space. Qualified people can offer context and support an app cannot; the in-app support panel includes ways to reach help.

## Voice and your ongoing journey

Choose **Voice** in the world, or **Explore this out loud** in a module, to open the OpenAI voice companion. Microphone access starts only after you agree and press **Start voice conversation**. You can interrupt, mute, stop, and review the on-screen transcript. Conversations stop after ten minutes, on page hiding/closing, or when the app session expires. HPY does not store raw audio or automatically save a transcript. Edit and explicitly save a takeaway to include it in your journey.

An OpenAI project API key with billing and model access is required. An account password is never needed. On the host computer, open the local app and choose **My journey → OpenAI connection** to enter a project key in the private setup field. The server encrypts it in a separate credential vault; it is never returned to the browser, bundled into JavaScript, exported with reflections, or committed. Hosted deployments can instead set `OPENAI_API_KEY`. `OPENAI_REALTIME_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`, and `OPENAI_REVIEW_MODEL` override the documented defaults. API use can incur charges.

Basic journey observations update after every saved insight without an AI call. They describe word mentions and participation, which can miss context. Enable **AI journey review** to send a bounded selection of saved insights to OpenAI after new saves. Reviews ask tentative questions, cite saved evidence, and show their scope: at most the latest 24 insights, up to 1,500 characters each. They do not grade personal growth or diagnose. The request uses `store: false`; OpenAI’s [API data policies](https://developers.openai.com/api/docs/guides/your-data) still apply. Turn reviews off whenever you want. A key alone does not enable reviews.

Voice uses the [Realtime WebRTC interface](https://developers.openai.com/api/docs/guides/voice-webrtc) through this app’s server. The browser receives a connection answer, never your project key. Voice and review requests are bounded and failures leave saved reflections intact. Live model access and audio behavior require verification with your own enabled API project; the automated suite uses mocked provider responses and simulated microphones.

## Your words, your choice

Discoveries, completed modules, unlocked worlds, saved insights, new journal excerpts, and your current chapter are persisted in the encrypted backend. Your traveler’s color, Gentler motion choice, and encounter drafts stay in the page session. Refreshing or locking clears unsaved drafts. Visiting a region saves only its ID, not private writing.

New journal entries contribute an excerpt of up to 6,000 characters to your journey. Existing journal entries are preserved and are not automatically imported. Deleting a journal entry also removes its linked journey evidence. Deleting an insight in My journey removes it from review evidence and refreshes observations; a separately saved journal original remains until deleted there. Completed modules remain completed after insight deletion. Export the journey as JSON and the journal as Markdown from their respective views.

Saved reflections and personalization are encrypted on the app’s server. Anyone with the shared passcode can access the journal, journey, and connected AI features. Server administrators can access encryption keys. Keep the private `data/` directory and exports or backups safe. Back up `data/config.json` and `data/journal.enc` together; that key is needed to recover the journal and journey. The optional provider vault (`data/openai/` by default, or `OPENAI_CONFIG_DIR`) is separate and must stay outside `dist/` and source control. Public origins cannot change its key through the setup API.

## Run or restart from a terminal

Use Node.js 22 or later. From this directory, the included built app starts with:

```sh
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Stop with **Control+C**; run the same command to restart. Node must be available in your terminal or installed in `/usr/local/bin` or `/opt/homebrew/bin` for the launcher.

If you edit the source, install the dependencies and rebuild:

```sh
npm ci --cache node_modules/.cache/npm
npm run build
npm start
```

The launcher also builds the app if its `dist/` folder is missing. On macOS, the launcher prompts for a passcode with input hidden when private configuration is missing. When starting directly from a terminal, configure APP_PASSCODE with the setup command first. For changing a passcode, deployment, recovery, and security details, see [server/DEPLOY.md](server/DEPLOY.md). Run `npm test` to check the server, reflection engine, and world movement and pathfinding.
