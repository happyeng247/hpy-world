// Short invitations discovered while wandering. Longer practices retain their
// source notes in the existing modes; these prompts offer no scored answers.
export const ENCOUNTERS = {
  talk: {
    title: 'Listening cove',
    subtitle: 'A little room for your words',
    invitation: 'The cove can hold an unfinished thought. What did you bring along today?',
    activityLabel: 'Leave a thought by the water',
    deepLabel: 'Keep talking it through',
    steps: [
      { prompt: 'What have you been carrying that hasn’t quite found its words?', placeholder: 'It doesn’t have to come out neatly…' },
      { prompt: 'What would you most like someone to understand about that?', placeholder: 'The part I wish someone understood is…' },
    ],
    completion: 'Your words can stay unfinished. You can take the question with you, too.',
  },
  landscape: {
    title: 'Mirror pool',
    subtitle: 'Notice the weather inside',
    invitation: 'Stop at the water’s edge. There’s room here for more than one feeling.',
    activityLabel: 'Look into the pool',
    deepLabel: 'Explore your inner landscape',
    steps: [
      { prompt: 'If what you’re feeling were weather, what would the pool be reflecting?', placeholder: 'A little fog, a sudden storm, a clear patch…' },
      { prompt: 'What feeling or need might deserve a little attention, just as it is?', placeholder: 'Something I’m noticing…' },
    ],
    completion: 'A feeling can be noticed without being settled. There’s no forecast to get right.',
  },
  compass: {
    title: 'Compass hill',
    subtitle: 'Choose a direction for today',
    invitation: 'From up here, there are many possible paths. Which quality would you like to travel with?',
    activityLabel: 'Find a direction',
    deepLabel: 'Explore your values',
    steps: [
      { prompt: 'What quality matters to you in the moment you’re navigating?', placeholder: 'Honesty, tenderness, courage, patience… or a word of your own.' },
      { prompt: 'What small action could express that quality while making room for your own needs?', placeholder: 'One thing I could try is…' },
    ],
    completion: 'A direction is enough for this moment. You can choose again as life changes.',
  },
  replay: {
    title: 'Rehearsal amphitheatre',
    subtitle: 'Try your words in a quiet place',
    invitation: 'Imagine a conversation you’re finding tricky. Nothing is sent to the person in this scene.',
    activityLabel: 'Try another take',
    deepLabel: 'Open the rehearsal room',
    steps: [
      { prompt: 'In that conversation, what do you wish you could express or ask for?', placeholder: 'What I want to say is…' },
      { prompt: 'How might you say it in words that respect what matters to you?', placeholder: 'Another possible way to say it…' },
    ],
    completion: 'This is one possible response. You get to decide whether, when, and how to use it.',
  },
  skills: {
    title: 'Stillwater garden',
    subtitle: 'A small pause · inspired by STOP',
    invitation: 'Let the next move wait for a moment, if you’d like. You can sit with each question without writing.',
    activityLabel: 'Make a little space',
    deepLabel: 'Practice STOP and other skills',
    steps: [
      { prompt: 'What could wait while you take a small step back?', placeholder: 'A reply, a decision, a thought I keep chasing…' },
      { prompt: 'What do you notice here, around you or within you?', placeholder: 'A sound, a color, a feeling, a thought…' },
      { prompt: 'Given what matters to you, what would you like your next move to be?', placeholder: 'An action, a question, more time…' },
    ],
    completion: 'Nothing needs to feel resolved before you leave this garden.',
  },
  wisdom: {
    title: 'Wisdom grove',
    subtitle: 'Care for your part',
    invitation: 'A modern reflection inspired by Bhagavad Gita 2.47: meet an uncertain outcome with a question about your own action.',
    activityLabel: 'Sit beneath the branches',
    deepLabel: 'Explore the teaching and its source',
    steps: [
      { prompt: 'What outcome are you hoping for that you can’t guarantee?', placeholder: 'Something I care about, but can’t fully control…' },
      { prompt: 'What part is yours to care for, even with that uncertainty?', placeholder: 'An action or intention that belongs to me…' },
    ],
    completion: 'You can care about what happens and leave this question open. The wider teaching and its context are here whenever you want to explore.',
  },
};
