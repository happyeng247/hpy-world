// Original reflection exercises, informed by the sources linked on each card.
// These are educational practice prompts, not a therapy protocol or assessment.

export const THEMES = [
  { id: 'relationships', label: 'Connection' },
  { id: 'self-worth', label: 'Self-kindness' },
  { id: 'uncertainty', label: 'Uncertainty' },
  { id: 'boundaries', label: 'Boundaries' },
  { id: 'anger', label: 'Big feelings' },
  { id: 'grief', label: 'Loss & change' },
];

// Optional entry points, shown only when a user chooses to explore a theme.
export const THEME_INVITATIONS = {
  relationships: 'What would you like to explore about connection today?',
  'self-worth': 'What does being on your own side mean to you today?',
  uncertainty: 'What would you like to understand about living with uncertainty?',
  boundaries: 'What would you like to make room for by having a clearer limit?',
  anger: 'Which feeling would you like to understand a little better today?',
  grief: 'What change or loss would you like to make room for, if any?',
};

export const VALUES = [
  'Kindness', 'Honesty', 'Courage', 'Curiosity', 'Patience', 'Playfulness',
  'Self-respect', 'Presence', 'Compassion', 'Reliability', 'Freedom', 'Connection',
];

export const MOODS = [
  { id: 'cloudy', label: 'A little cloudy', emoji: '☁️' },
  { id: 'stormy', label: 'A lot going on', emoji: '🌧️' },
  { id: 'tender', label: 'Feeling tender', emoji: '🌷' },
  { id: 'steady', label: 'Finding my feet', emoji: '🌱' },
  { id: 'sunny', label: 'Room for sunshine', emoji: '☀️' },
];

export const REFLECTION_PROMPTS = [
  'Something is taking up a lot of space in my mind…',
  'I keep replaying a conversation…',
  'I want to respond differently when…',
  'A part of me wants closeness, and another part…',
  'Today I felt most like myself when…',
  'I am learning to make room for…',
];

export const SCENARIOS = [
  {
    id: 'unanswered', title: 'The unanswered message', theme: 'uncertainty',
    description: 'You sent something meaningful. Hours have passed without a reply.',
    opening: 'Before writing a follow-up, what do you actually know, and what is still unknown?',
  },
  {
    id: 'different-needs', title: 'Closeness meets space', theme: 'relationships',
    description: 'Someone you care about wants a quiet evening just as you want connection.',
    opening: 'How might you express the connection you want while leaving room for their answer?',
  },
  {
    id: 'boundary', title: 'A small, honest no', theme: 'boundaries',
    description: 'You are asked for a favor, but your week already feels full.',
    opening: 'What can you freely offer, and where does your capacity end today?',
  },
  {
    id: 'feedback', title: 'Feedback that stings', theme: 'self-worth',
    description: 'Someone says your response hurt them. You feel a rush of defensiveness.',
    opening: 'What part of their experience could you be curious about before explaining your intention?',
  },
  {
    id: 'repair', title: 'The second draft', theme: 'anger',
    description: 'You snapped during a disagreement and want to revisit what happened.',
    opening: 'What would taking responsibility for your part sound like without making a verdict about yourself?',
  },
  {
    id: 'changed-plan', title: 'When plans change', theme: 'grief',
    description: 'A plan you were looking forward to falls through. You feel more disappointed than expected.',
    opening: 'What did that plan represent to you, beyond the plan itself?',
  },
];

const VA_DBT = 'https://www.mirecc.va.gov/visn16/docs/DBT_Visual_Review_Flash_Cards.pdf';

export const SKILLS = [
  {
    id: 'stop', name: 'The pause button', subtitle: 'STOP', category: 'DBT · Distress tolerance',
    duration: '2 min', color: 'peach',
    steps: [
      { title: 'S · Stop', prompt: 'What action or reply could wait for a moment?', helper: 'A pause can be very small. There is no need to force yourself to feel calm.' },
      { title: 'T · Take a step back', prompt: 'What would give you a little space right now?', helper: 'Perhaps a quiet moment, a comfortable breath, or putting down your phone.' },
      { title: 'O · Observe', prompt: 'What do you notice around you, in your body, and in your thoughts?', helper: 'You can describe what is here without deciding what it means yet.' },
      { title: 'P · Proceed mindfully', prompt: 'What next move fits your priorities and the situation?', helper: 'A choice might be an action, a question, or a little more time.' },
    ],
    source: { label: 'Kaiser Permanente · DBT skills, p. 8', url: 'https://mydoctor.kaiserpermanente.org/ncal/Images/IOP%20Section%203%20-%20DBT%20Skills%20v1ms%20ADA%2005092023_tcm75-2182380.pdf' },
  },
  {
    id: 'facts', name: 'Facts & the story', subtitle: 'Check the facts', category: 'DBT · Emotion regulation',
    duration: '4 min', color: 'blue',
    steps: [
      { title: 'Name the feeling', prompt: 'Which emotion is here, and how strong does it feel?', helper: 'A rough description is enough. More than one feeling can be present.' },
      { title: 'What happened?', prompt: 'What did you directly see or hear?', helper: 'There is room for an honest “I don’t know.”' },
      { title: 'What did it mean to you?', prompt: 'Which parts are observations, and which are interpretations or predictions?', helper: 'An interpretation can be accurate; it is simply worth examining.' },
      { title: 'Make room for evidence', prompt: 'What supports your reading, what complicates it, and what remains uncertain?', helper: 'You do not need to invent a reassuring explanation.' },
      { title: 'Look again', prompt: 'How do the emotion and its intensity fit what you know now?', helper: 'Your feeling is real. The next response can reflect the facts and your needs.' },
    ],
    source: { label: 'Manchester University NHS · Emotional regulation', url: 'https://mft.nhs.uk/camhs/advice/emotional-regulation/' },
  },
  {
    id: 'dear-man', name: 'Say what matters', subtitle: 'DEAR MAN', category: 'DBT · Interpersonal skills',
    duration: '5 min', color: 'lavender',
    steps: [
      { title: 'D · Describe', prompt: 'What happened, stated as plainly as you can?', helper: 'A shared starting point can be one specific event.' },
      { title: 'E · Express', prompt: 'How did it affect you?', helper: 'What words describe your experience without claiming to know their intention?' },
      { title: 'A · Assert', prompt: 'What are you asking for, or saying no to?', helper: 'How could someone understand the request in one sentence?' },
      { title: 'R · Reinforce', prompt: 'What useful difference might this make?', helper: 'You can name a benefit while respecting their choice.' },
      { title: 'M · Stay mindful', prompt: 'What is the central point you want to return to?', helper: 'A simple anchor can help if the conversation wanders.' },
      { title: 'A · Appear confident', prompt: 'What pace, posture, or words would help you speak clearly?', helper: 'You can feel nervous and still communicate what matters.' },
      { title: 'N · Negotiate', prompt: 'Where is there flexibility, and where is your boundary?', helper: 'A respectful request can still receive a no.' },
    ],
    source: { label: 'VA MIRECC · DEAR MAN', url: VA_DBT },
  },
  {
    id: 'wise-mind', name: 'Find your middle', subtitle: 'Wise mind', category: 'DBT · Mindfulness',
    duration: '3 min', color: 'sage',
    steps: [
      { title: 'Hear the emotion', prompt: 'What matters to the emotional part of you?', helper: 'It can have information about your wishes, hurt, or care.' },
      { title: 'Hear the reasoning', prompt: 'What does the practical, fact-focused part notice?', helper: 'What are the circumstances and likely consequences?' },
      { title: 'Let both be present', prompt: 'What response makes room for feeling and reason together?', helper: 'You are exploring a perspective, not passing a test.' },
      { title: 'Check the fit', prompt: 'How does that response fit what you care about?', helper: 'You can leave this unfinished and return later.' },
    ],
    source: { label: 'VA MIRECC · Wise mind', url: VA_DBT },
  },
  {
    id: 'validation', name: 'Be on your own side', subtitle: 'Self-validation', category: 'Reflective practice',
    duration: '3 min', color: 'rose',
    steps: [
      { title: 'Make contact', prompt: 'What are you feeling, in your own words?', helper: 'No need to justify it before you acknowledge it.' },
      { title: 'Find the context', prompt: 'What makes this feeling understandable in your situation?', helper: 'Understanding an experience does not require approving every response to it.' },
      { title: 'Offer a little kindness', prompt: 'What could you say to yourself that is both kind and believable?', helper: 'A small, honest sentence can be enough.' },
      { title: 'Leave room for choice', prompt: 'What would caring for yourself look like in the next hour?', helper: 'Your answer can include rest, support, or something you choose to change.' },
    ],
    source: { label: 'NHS Highland · Validation', url: 'https://www.rightdecisions.scot.nhs.uk/personality-disorder-integrated-care-pathway/general-principles-in-treating-personality-disorder/general-treatment-strategies/validation/' },
  },
  {
    id: 'values', name: 'A tiny true step', subtitle: 'Values into action', category: 'ACT-inspired practice',
    duration: '3 min', color: 'yellow',
    steps: [
      { title: 'Choose a direction', prompt: 'What quality would you like to bring to this moment?', helper: 'Perhaps honesty, patience, courage, playfulness—or a word of your own.' },
      { title: 'Make it yours', prompt: 'Why does this quality matter to you, apart from anyone’s approval?', helper: 'A value is a direction you can practice, rather than a finish line.' },
      { title: 'Make it small', prompt: 'What is one little action that would express it today?', helper: 'Small enough to be possible on the day you are actually having.' },
      { title: 'Make room', prompt: 'What feeling might come along, and what support could make room for it?', helper: 'A meaningful action does not require feeling perfect first.' },
    ],
    source: { label: 'Association for Contextual Behavioral Science · ACT', url: 'https://contextualscience.org/about_act' },
  },
];

export const WISDOM = [
  {
    id: 'karma-yoga', title: 'Care for your part', sanskrit: 'Karma yoga · कर्मयोग',
    subtitle: 'Action, without owning the outcome',
    description: 'Bhagavad Gita 2.47 turns attention toward action while loosening attachment to its fruits. It also cautions against retreating into inaction.',
    prompts: [
      'Which part of this situation is yours to act on?',
      'What outcome are you hoping for, but unable to guarantee?',
      'What would a sincere effort look like even with that uncertainty?',
    ],
    source: { label: 'Bhagavad Gita 2.47 · IIT Kanpur, translations & commentaries', url: 'https://www.gitasupersite.iitk.ac.in/srimad?language=dv&field_chapter_value=2&field_nsutra_value=47&etgb=1&setgb=1' },
    note: 'These are modern reflection prompts. The verse belongs to a wider teaching on duty, spiritual discipline, and liberation; traditions interpret it differently. Care about consequences can coexist with releasing a demand for a particular result.',
  },
  {
    id: 'samatva', title: 'Steady, while life moves', sanskrit: 'Samatva · समत्व',
    subtitle: 'Equanimity in success and difficulty',
    description: 'In Bhagavad Gita 2.48, Krishna describes evenness toward success and failure within a life of action and yoga.',
    prompts: [
      'What is changing in this moment, and what do you want to stay connected to?',
      'What would steadiness look like while allowing your actual feelings?',
      'What would you choose if this outcome did not have to define your worth?',
    ],
    source: { label: 'Bhagavad Gita 2.48 · International Gita Society', url: 'https://www.gita-society.com/gita-in-english-chapter2/' },
    note: 'A modern application, not a demand to feel calm. The source places equanimity in a devotional and yogic context. Steadiness need not mean enduring harm or suppressing grief.',
  },
  {
    id: 'shared-humanity', title: 'A wider circle of care', sanskrit: 'Ātmaupamya · आत्मौपम्य',
    subtitle: 'Recognizing another’s joy and pain',
    description: 'Bhagavad Gita 6.32 invites seeing the happiness and suffering of others with a standard comparable to one’s own. Its commentaries connect this to yogic understanding in different ways.',
    prompts: [
      'What would it mean to take your own pain seriously here?',
      'What might you be able to understand about another person without guessing their inner world?',
      'What response could hold care for both of you and still honor your limits?',
    ],
    source: { label: 'Bhagavad Gita 6.32 · IIT Kanpur, translations & commentaries', url: 'https://www.gitasupersite.iitk.ac.in/srimad?language=dv&field_chapter_value=6&field_nsutra_value=32&etgb=1&setgb=1' },
    note: 'The self-kindness and boundary questions are contemporary applications. Compassion does not require agreement, access to you, or accepting mistreatment.',
  },
  {
    id: 'witness', title: 'Notice the passing weather', sanskrit: 'Upadraṣṭā · उपद्रष्टा',
    subtitle: 'A reflection inspired by the witness',
    description: 'Bhagavad Gita 13.23 describes the supreme Self as witness, among other roles. This is a metaphysical teaching; the brief noticing exercise below is a modern analogy.',
    prompts: [
      'What thought or feeling is passing through your attention right now?',
      'How does it feel to describe it as “I notice…”?',
      'What else is present besides that one thought or feeling?',
    ],
    source: { label: 'Bhagavad Gita 13.23 · IIT Kanpur, Swami Gambhirananda', url: 'https://www.gitasupersite.iitk.ac.in/srimad?language=dv&field_chapter_value=13&field_nsutra_value=23&etgb=1&setgb=1' },
    note: 'The theological meaning varies across Hindu traditions and is not identical to a psychological observing skill. If inward attention feels uncomfortable, you can instead notice an object in the room.',
  },
];

export const SUPPORT = {
  title: 'You can reach a real person',
  text: 'This reflection space cannot provide crisis care. In the U.S., call or text 988 for immediate emotional support. For immediate physical danger or a medical emergency, call 911. Outside the U.S., use local emergency or crisis services.',
  links: [
    { label: 'Call 988 · U.S.', url: 'tel:988' },
    { label: 'Text 988 · U.S.', url: 'sms:988' },
    { label: 'Chat with 988 · U.S.', url: 'https://988lifeline.org/chat/' },
    { label: 'Find support elsewhere', url: 'https://findahelpline.com/' },
  ],
  source: { label: 'SAMHSA · Crisis help', url: 'https://www.samhsa.gov/find-support/in-crisis' },
};
