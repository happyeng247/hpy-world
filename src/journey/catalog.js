import { ENCOUNTERS } from '../world/encounters.js';

// Shared by the interface and server. This catalog contains no private progress.
export const REGION_IDS = ['talk', 'landscape', 'compass', 'replay', 'skills', 'wisdom'];

export const WORLD_CHAPTERS = [
  {
    id: 'arrival',
    level: 1,
    title: 'Arrival Garden',
    subtitle: 'Notice what is here',
    description: 'Find words, notice your inner weather, and choose a direction. Six small places to begin where you are.',
    theme: 'meadow',
    modules: ENCOUNTERS,
  },
  {
    id: 'practice',
    level: 2,
    title: 'Twilight Woods',
    subtitle: 'Make room for another response',
    description: 'Follow familiar patterns with curiosity. Practice a boundary, try another perspective, and leave room for choice.',
    theme: 'dusk',
    modules: {
      talk: {
        title: 'The thread beneath the words',
        subtitle: 'Listening cove · notice a pattern',
        invitation: 'A familiar moment can hold a fresh question. Choose a small real or imagined example; you can keep the details private.',
        activityLabel: 'Follow a familiar thread',
        deepLabel: 'Keep talking it through',
        steps: [
          { prompt: 'When this kind of moment comes around, what tends to happen in your thoughts or words?', placeholder: 'Something I sometimes notice is…' },
          { prompt: 'What might those words be trying to express, ask for, or protect?', placeholder: 'Underneath it, something that matters might be…' },
        ],
        completion: 'A pattern is something you noticed, not a verdict about who you are.',
      },
      landscape: {
        title: 'More than one reflection',
        subtitle: 'Mirror pool · hold a little uncertainty',
        invitation: 'The pool can hold several reflections at once. Bring a moment you can explore at a comfortable distance.',
        activityLabel: 'Look from another angle',
        deepLabel: 'Explore your inner landscape',
        steps: [
          { prompt: 'What did you directly see or hear, and what meaning did you find yourself adding?', placeholder: 'What I know… and what I’m interpreting…' },
          { prompt: 'What else could be possible, and what remains unknown?', placeholder: 'Another possibility, or something I simply don’t know…' },
        ],
        completion: 'You don’t have to choose a reassuring story. Making room for what is unknown is an observation of its own.',
      },
      compass: {
        title: 'A boundary with a direction',
        subtitle: 'Compass hill · make room for your limits',
        invitation: 'Choose a small situation where a yes, a no, or a not-yet could matter to you. An imagined situation works, too.',
        activityLabel: 'Explore a caring limit',
        deepLabel: 'Explore your values',
        steps: [
          { prompt: 'What value or need would you like a boundary to make room for?', placeholder: 'What matters to me here is…' },
          { prompt: 'How could you express that limit clearly, without needing to control the other person’s reaction?', placeholder: 'A possible boundary in my own words…' },
        ],
        completion: 'These are words to practice with. You decide whether the situation calls for a conversation, distance, or support.',
      },
      replay: {
        title: 'Another take is possible',
        subtitle: 'Rehearsal theatre · response flexibility',
        invitation: 'Pick a low-stakes scene: a changed plan, a delayed reply, or one of your own. Nothing is sent to the person in this scene.',
        activityLabel: 'Rehearse another response',
        deepLabel: 'Open the rehearsal room',
        steps: [
          { prompt: 'What response comes up first, and what matters to you underneath it?', placeholder: 'My first impulse… and what it is about for me…' },
          { prompt: 'What other response could make room for that same concern?', placeholder: 'I could ask, say, pause, or choose…' },
        ],
        completion: 'You made room for another option. You can still take time before choosing what to do.',
      },
      skills: {
        title: 'Find the space between',
        subtitle: 'Stillwater garden · observe and choose',
        invitation: 'Bring an everyday moment when you feel pulled to react. You can work with a made-up example and keep any personal details to yourself.',
        activityLabel: 'Practice a moment of choice',
        deepLabel: 'Explore the skills toolkit',
        steps: [
          { prompt: 'What early signal could tell you it is time for a pause?', placeholder: 'A thought, an urge, something I notice around me…' },
          { prompt: 'What could give you a little space to observe before acting?', placeholder: 'A pause that could fit this situation…' },
          { prompt: 'After that pause, what would you want to consider before your next move?', placeholder: 'My priorities, my limits, the facts I know…' },
        ],
        completion: 'A pause need not make the feeling disappear. This was a chance to consider what you want to do with it.',
      },
      wisdom: {
        title: 'Steady while things move',
        subtitle: 'Wisdom grove · a reflection on samatva',
        invitation: 'A modern reflection inspired by Bhagavad Gita 2.48 and its teaching on evenness in success and difficulty. Explore without asking yourself to suppress a feeling.',
        activityLabel: 'Sit with steadiness',
        deepLabel: 'Explore the teaching and its source',
        steps: [
          { prompt: 'What is changing here, and what would you like to stay connected to?', placeholder: 'Something I can care for as the situation changes…' },
          { prompt: 'What could steadiness look like while allowing your actual feelings and respecting your limits?', placeholder: 'For me, in this moment, it might look like…' },
        ],
        completion: 'This is a contemporary reflection within a much wider teaching. Steadiness does not require certainty, agreement, or enduring harm.',
      },
    },
  },
  {
    id: 'integration',
    level: 3,
    title: 'Golden Grove',
    subtitle: 'Carry a little practice into life',
    description: 'Explore a small real-life action, a possible repair, and a kinder way to meet yourself when the outcome is uncertain.',
    theme: 'autumn',
    modules: {
      talk: {
        title: 'Words to take into your day',
        subtitle: 'Listening cove · make room for connection',
        invitation: 'Think of something you might want to express. It can be ordinary, imagined, or private; sharing it with anyone is your choice.',
        activityLabel: 'Find words for real life',
        deepLabel: 'Keep talking it through',
        steps: [
          { prompt: 'What would you like to be able to say in your own voice?', placeholder: 'Something I might want to express…' },
          { prompt: 'What would help you decide whether, when, and with whom to share it?', placeholder: 'The conditions or support I would want…' },
        ],
        completion: 'The words belong to you. Finding them does not create an obligation to share them.',
      },
      landscape: {
        title: 'Room for a changing day',
        subtitle: 'Mirror pool · return with kindness',
        invitation: 'Picture a day when things don’t unfold as you hoped. You can choose a very small example.',
        activityLabel: 'Make room for an imperfect day',
        deepLabel: 'Explore your inner landscape',
        steps: [
          { prompt: 'When things feel difficult, what kind of self-talk tends to show up?', placeholder: 'A familiar thought, without needing to judge it…' },
          { prompt: 'What response to yourself could be both kind and believable?', placeholder: 'Something I could actually stand behind saying…' },
        ],
        completion: 'Kindness can be honest. You don’t need to turn this moment into a positive one.',
      },
      compass: {
        title: 'One small step beyond the hill',
        subtitle: 'Compass hill · bring a value into life',
        invitation: 'Choose a quality you want to practice in one ordinary moment. Keep the experiment small enough to fit your actual life.',
        activityLabel: 'Choose a small experiment',
        deepLabel: 'Explore your values',
        steps: [
          { prompt: 'Where in your day could you try one action that expresses a value you care about?', placeholder: 'In this moment, I could try…' },
          { prompt: 'If it doesn’t go as planned, how could you adjust without turning it into a judgment about yourself?', placeholder: 'A gentler next attempt or a change of plan…' },
        ],
        completion: 'An experiment is allowed to teach you something unexpected. You can adapt the next step.',
      },
      replay: {
        title: 'A little room for repair',
        subtitle: 'Rehearsal theatre · care after a difficult moment',
        invitation: 'Use a low-stakes real or imagined misunderstanding. Repair may include a conversation, changed behavior, or space; you decide what fits.',
        activityLabel: 'Explore a possible repair',
        deepLabel: 'Open the rehearsal room',
        steps: [
          { prompt: 'What part could you honestly acknowledge, without taking responsibility for everything?', placeholder: 'Something that is mine to recognize…' },
          { prompt: 'What possible next step could express care while respecting both people’s limits?', placeholder: 'An acknowledgement, a request, a change, or space…' },
        ],
        completion: 'A repair is an offer or an action you can consider. It cannot guarantee another person’s response.',
      },
      skills: {
        title: 'A practice for the next moment',
        subtitle: 'Stillwater garden · make your own reminder',
        invitation: 'Choose one small practice you want to remember: a pause, an observation, a clear request, or something you have found useful.',
        activityLabel: 'Build a small reminder',
        deepLabel: 'Return to the skills toolkit',
        steps: [
          { prompt: 'What everyday moment could remind you to try this practice?', placeholder: 'When I notice…' },
          { prompt: 'What is the smallest version you could try in that moment?', placeholder: 'A step that fits the time and energy I have…' },
          { prompt: 'If you forget or it doesn’t help, what would you like your next response to yourself to be?', placeholder: 'A way to return without a penalty…' },
        ],
        completion: 'This reminder is yours to change. Missing a moment does not erase the practice you have made room for.',
      },
      wisdom: {
        title: 'Care without a guarantee',
        subtitle: 'Wisdom grove · action amid uncertainty',
        invitation: 'Return to a modern question inspired by Bhagavad Gita 2.47: how might you care for your action while allowing its outcome to remain uncertain?',
        activityLabel: 'Carry a question into life',
        deepLabel: 'Explore the teaching and its source',
        steps: [
          { prompt: 'What sincere effort could you make without being able to promise the result?', placeholder: 'Something within my part of the situation…' },
          { prompt: 'As the outcome unfolds, how could you remain open to learning and caring for yourself?', placeholder: 'A way I might respond, reflect, or seek support…' },
        ],
        completion: 'The next chapter belongs to your life. You can care about consequences, act with intention, and continue learning.',
      },
    },
  },
];

export const getWorld = id => WORLD_CHAPTERS.find(world => world.id === id);
export const getModule = (worldId, regionId) => REGION_IDS.includes(regionId) ? getWorld(worldId)?.modules[regionId] : undefined;
