# hpy — your space for becoming

Your personal HPY space: a little 3D world to wander, with room for uncertainty, conflict, boundaries, and reconnecting. Walk your traveler along garden paths, discover a place to pause, and explore questions without a score or a prescribed answer.

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

Each place has a short invitation. Write a few words, or choose **Let it be a question**. **Carry this with me** grows a small flower at that destination for this session. **Keep these words** explicitly saves your written reflection to the journal; carrying a moment alone does not save it.

The world menu lets you change your jacket color, turn on **Gentler motion**, reset the camera, or take a pause. Movement stops while a practice or menu is open. The map also offers **Open practice** if you want to go directly to an activity.

## Keep exploring the sections

Your existing sections remain available through **world menu → Browse all sections**, or through a destination’s link to its deeper practice. Choose **Wander your world** in the section navigation to return. If the browser cannot display the 3D world, the fallback offers access to all sections.

- **Talk it through:** write naturally, or try optional voice typing, and follow a question that opens something up.
- **Your inner world:** explore feelings, needs, values, choices, and release through the original reflective island activity.
- **Meet your becoming:** choose values and try a small action that feels like you.
- **The rehearsal room:** revisit a relationship moment and practice another possible response.
- **A little steadier:** explore educational adaptations of DBT and other therapy skills, including STOP, checking the facts, DEAR MAN, and validation.
- **The wisdom grove:** sit with questions inspired by Hindu philosophy, with links to the source texts.
- **My little journal:** keep selected reflections, add your own notes, export a Markdown copy, or delete saved entries.

Text reflection uses scripted prompts selected from themes in your writing. It can miss nuance, so take what helps and leave what doesn’t. It does not send your writing to an AI service. Optional voice typing uses your browser’s speech service, which may process audio online; the app explains this before you enable it. Browser support varies, and typing is always available.

HPY is a reflection and skills practice space. Qualified people can offer context and support an app cannot; the in-app support panel includes ways to reach help.

## Your words, your choice

Discoveries, flowers, your traveler’s color, the Gentler motion choice, and encounter drafts stay in the current page session while you move between the world and sections. Refreshing the page or explicitly locking the space clears this unsaved state. Walking to a place or carrying a moment does not create a journal entry.

Only reflections you explicitly choose to keep are saved to the journal. Saved reflections and saved personalization, such as your name and practice themes, are encrypted on the app’s server. Anyone with the shared passcode can access the saved journal, and server administrators can access its encryption key. Keep the private `data/` directory and any exports or backups somewhere safe. Back up `data/config.json` and `data/journal.enc` together; the key is needed to recover the journal.

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
