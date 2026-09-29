// A deliberately small, local, scripted reflection engine. No model or network.
// Keyword matching is not a clinical assessment or a reliable safety detector.
// The UI must keep human support accessible independently of this routing.

const THEMES = {
  boundaries: /\b(boundar(?:y|ies)|say no|saying no|people.pleas|overcommit|capacity|guilt about saying|need space)\b/i,
  grief: /\b(grief|grieving|loss|lost someone|died|death|bereave|miss them|mourning|breakup|break.up)\b/i,
  anger: /\b(angry|anger|furious|rage|snapped|yelled|shouted|resent|irritat|frustrat|fight|argu(?:e|ing|ment))\w*/i,
  'self-worth': /\b(worthless|not enough|failure|failed|ashamed|shame|embarrass|self.critical|hate myself|unlovable|self.worth|compare myself|disappoint(?:ed|ing) myself)\w*/i,
  uncertainty: /\b(anxious|anxiety|worr(?:y|ied)|uncertain|overthink|spiral|what if|waiting|no reply|not replied|unanswered|jealous|jealousy)\w*/i,
  relationships: /\b(partner|relationship|friend|family|wife|husband|boyfriend|girlfriend|connection|lonely|loneliness|love|closeness|text|message)\w*/i,
};

const QUESTIONS = {
  general: [
    ['Which moment would you like to understand a little better?', 'What happened just before you noticed this feeling?'],
    ['What meaning are you making of that moment?', 'What is clear to you, and what is still an open question?'],
    ['What do you notice in your body, or in the room around you?', 'What feeling would you name first, even if the name is imperfect?'],
    ['What matters to you underneath this feeling?', 'What do you wish could be understood about your experience?'],
    ['What is one small next step that would feel true to your values?', 'What would you like to carry from this reflection into the rest of your day?'],
  ],
  relationships: [
    ['What specifically happened between you, in words you both might recognize?', 'Which part of the interaction is staying with you?'],
    ['What are you reading into their response, and what did they actually say?', 'What do you know about their experience, and what would require asking?'],
    ['When you think about the interaction, what feeling or sensation arrives first?', 'What urge comes up around this connection, and what is it hoping for?'],
    ['What kind of connection are you hoping for in this moment?', 'What would you want understood about you, alongside room for their experience?'],
    ['What could you say that is honest about your need and leaves room for their answer?', 'What small action would express the kind of person you want to be in this connection?'],
  ],
  'self-worth': [
    ['What happened before this judgment about yourself showed up?', 'What is the specific event, separate from what it seems to say about you?'],
    ['What words belong to the event, and which words turn it into a verdict about you?', 'What evidence would a fair account of this moment need to include?'],
    ['What feeling is here underneath the criticism?', 'What happens in your body when you hear that judgment, or what do you notice around you?'],
    ['What would kindness sound like if it also stayed honest?', 'What would you hope a friend understood if they were feeling this way?'],
    ['What is one caring action you could choose without needing to earn it first?', 'What would learning from this look like without making yourself the problem?'],
  ],
  uncertainty: [
    ['What do you know for certain about the situation so far?', 'What happened, and which part is still unresolved?'],
    ['Which part is a fact, which is a prediction, and which is unknown?', 'What supports your interpretation, and what might complicate it?'],
    ['What does uncertainty feel like in your body, if you want to notice?', 'What is the urge asking you to do right now?'],
    ['What need is especially important while you wait for clarity?', 'What would support you even if the answer takes a little longer?'],
    ['What is one choice available to you while the outcome stays uncertain?', 'What would a gentle next hour look like without needing to settle everything?'],
  ],
  boundaries: [
    ['What is being asked of you, and what capacity do you have today?', 'Where do you notice a mismatch between what you are giving and what you can offer?'],
    ['What do you fear your boundary might mean to someone else?', 'Which responsibility feels like yours, and which part belongs to another person?'],
    ['What happens inside when you imagine saying what you need?', 'What feeling shows up around your limit, and what is it asking for?'],
    ['What is this boundary making room for in your life?', 'What would care for yourself and respect for the other person sound like together?'],
    ['What is a clear sentence that expresses your actual limit?', 'What could you freely offer, if anything, without moving past your limit?'],
  ],
  anger: [
    ['What happened immediately before the feeling grew stronger?', 'What words or actions can you describe without interpreting the intention behind them?'],
    ['What did this moment mean to you?', 'What feels unfair, threatened, or blocked, and what facts support that reading?'],
    ['What is your body doing, and what action is the feeling pulling you toward?', 'What could a little space feel like before choosing a response?'],
    ['What important need or value might this feeling be pointing toward?', 'What do you want understood underneath the intensity?'],
    ['What response would express your point and fit how you want to treat people?', 'If you could write a second draft of your response, what would matter most?'],
  ],
  grief: [
    ['What are you missing or adjusting to today?', 'Which part of this change feels most present right now?'],
    ['What expectations about how you should feel are showing up?', 'What does this loss mean to you in this particular moment?'],
    ['What feeling has room to be named, without needing to change it?', 'What do you notice right now, inside you or in the space around you?'],
    ['What kind of care would feel welcome today?', 'What would you want someone supportive to understand about this moment?'],
    ['What is one gentle thing that could support you through the next hour?', 'What connection, memory, or small ritual would you like to make room for, if any?'],
  ],
};

const SUGGESTIONS = [
  ['What happened was…', 'The part that stays with me is…', 'I’m not sure where to start'],
  ['What I know is…', 'The story I’m telling myself is…', 'What I don’t know yet is…'],
  ['I notice…', 'The feeling might be…', 'I would rather look around the room'],
  ['What matters to me is…', 'I wish they understood…', 'I think I need…'],
  ['One small step could be…', 'I want to bring more…', 'I want to sit with this for now'],
];

const ACKNOWLEDGMENTS = [
  'There is room to take this one piece at a time.',
  'You can leave some of this unfinished.',
  'You do not need a polished answer.',
  'A little curiosity is enough for this moment.',
];

const normalize = (value) => (typeof value === 'string' ? value : '').replace(/[’‘]/g, "'").trim();
const hash = (text) => [...text].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7);
const asMessages = (history) => Array.isArray(history) ? history.filter((m) => m && typeof m === 'object') : [];
const messageText = (message) => normalize(message?.content ?? message?.text);
const chooseTheme = (text) => Object.entries(THEMES).find(([, pattern]) => pattern.test(text))?.[0];

function currentRisk(text) {
  // Exclude only narrow, explicit negations and historical/fictional reports.
  // Do not let one negated sentence cancel a separate current-risk sentence.
  const clauses = normalize(text).toLowerCase().split(/[.!?;\n]|\b(?:but|however|yet)\b/);
  let supportNeeded = false;
  for (let clause of clauses) {
    if (/^\s*(?:in (?:the|a) (?:movie|novel|book)|(?:the|a) (?:character|song|lyric|quote)).*\b(?:say|says|said|reads|goes|is)\b/.test(clause)) continue;
    clause = clause
      .replace(/\bi (?:am|'m) not (?:feeling )?suicidal\b/g, '')
      .replace(/\bi(?:'m| am) no longer suicidal\b/g, '')
      .replace(/\bi (?:do not|don't) (?:want|plan|intend) to (?:die|kill myself|hurt myself|harm myself|end my life)\b/g, '')
      .replace(/\bi (?:won't|will not|would never) (?:kill|hurt|harm) myself\b/g, '')
      .replace(/\bi (?:used to (?:be|feel)|was) suicidal(?: (?:last|years?|months?|weeks?|long)\b[^,]*)?/g, '')
      .replace(/\bi used to (?:want to die|self.harm|hurt myself|cut myself)\b/g, '');

    const actualInjury = /\bi (?:have )?(?:just )?(?:overdosed(?: on)?|taken (?:too many|a lot of|all (?:of )?the)|took (?:too many|a lot of|all (?:of )?the)) (?:pills|medication|tablets)\b/.test(clause)
      || /\bi (?:have )?(?:just )?(?:overdosed|taken an overdose|took an overdose)\b/.test(clause)
      || /\bi (?:have )?(?:just )?(?:taken|took) (?:pills|medication|tablets) to (?:die|kill myself|end my life)\b/.test(clause)
      || /\bi (?:have )?(?:cut|hurt|injured) myself\b.*\b(?:bleeding|right now|just now)\b/.test(clause)
      || /\bi(?:'m| am) bleeding\b.*\b(?:won't|can't|cannot|will not) stop\b/.test(clause);
    const clearlyHistorical = /\b(?:years?|months?|weeks?) ago\b|\blast (?:year|month|week)\b|\bin (?:19|20)\d{2}\b/.test(clause)
      && !/\b(?:now|today|tonight|just|again)\b/.test(clause);
    if (actualInjury && !clearlyHistorical) return 'urgent';

    const suicidal = /\bi(?:'m| am| feel) (?:feeling )?suicidal\b/.test(clause)
      || /\bi(?:'m| am) having suicidal thoughts\b/.test(clause)
      || /\bi (?:have|keep having) suicidal thoughts\b/.test(clause)
      || /\bi (?:do )?(?:want|need|plan|intend|wish|hope) to (?:die|kill myself|hurt myself|harm myself|end my life|commit suicide)\b/.test(clause)
      || /\bi (?:want|need|plan|intend) to self.harm\b/.test(clause)
      || /\bi (?:have|made) (?:a )?plan to (?:kill myself|end my life|die|hurt myself)\b/.test(clause)
      || /\bi(?:'m| am) (?:going|planning|about) to (?:kill myself|hurt myself|harm myself|end my life|commit suicide)\b/.test(clause)
      || /\bi(?:'m| am) (?:going|planning|about) to self.harm\b/.test(clause)
      || /\bi (?:might|may|will|could) (?:kill myself|hurt myself|harm myself|end my life)\b/.test(clause)
      || /\bi'll (?:kill myself|hurt myself|harm myself|end my life)\b/.test(clause)
      || /\bi (?:don't|do not|no longer) want to (?:live|be alive|exist)\b/.test(clause)
      || /\bi wish i (?:was|were) dead\b/.test(clause)
      || /\b(?:thoughts|thinking) (?:of|about) (?:suicide|killing myself|ending my life|hurting myself)\b/.test(clause)
      || /\bi (?:can't|cannot|can not) (?:keep myself safe|stop myself from (?:hurting|harming|killing) myself)\b/.test(clause);
    if (suicidal) {
      if (/\b(now|tonight|today|about to|going to|will|i'll|can't keep myself safe|cannot keep myself safe)\b/.test(clause)) return 'urgent';
      supportNeeded = true;
    }
  }
  return supportNeeded ? 'support' : null;
}

function safetyResponse(level) {
  return {
    reply: level === 'urgent'
      ? 'Your safety matters right now. If you have already hurt yourself or taken an overdose, or might act now, call emergency services (911 in the U.S.) or go to an emergency department. In the U.S., you can also call or text 988 for crisis support. Elsewhere, contact your local crisis service. If possible, move away from anything you could use to hurt yourself and ask a trusted person to stay with you. Can you reach someone now?'
      : 'I’m sorry you’re carrying this. You deserve support from a real person. In the U.S., call or text 988; elsewhere, contact a local crisis service. If you might act on these thoughts or are in immediate danger, call emergency services. Can you tell someone you trust what is happening and ask them to be with you?',
    suggestions: [],
    theme: 'support',
    safety: level,
  };
}

/**
 * Return a scripted reflective prompt; history should exclude the current entry.
 * Messages may use { role: 'user'|'assistant', content } or { role, text }.
 * options.theme can select a theme; options.phase can be 0..4 or a phase name.
 * For a history including the current entry, set options.historyIncludesCurrent.
 * The optional `safety` property is 'urgent' or 'support' for support routing.
 */
export function getReflection(text, history = [], options = {}) {
  const input = normalize(text);
  const opts = options && typeof options === 'object' ? options : {};
  const risk = currentRisk(input);
  if (risk) return safetyResponse(risk);

  if (!input) {
    return { reply: 'What is taking up space in your mind today?', suggestions: ['Something happened…', 'I keep coming back to…', 'I’m not sure yet'], theme: 'general' };
  }

  // Preserve choice and avoid converting a reflection into a verdict or diagnosis.
  if (/\b(?:diagnos(?:e|is)|narcissist|personality disorder|bipolar|borderline)\b/i.test(input)) {
    return { reply: 'This space can help you reflect, but it cannot assess or diagnose anyone. What specific behavior or experience would you like to understand?', suggestions: ['What happened was…', 'The impact on me was…', 'What I need is…'], theme: 'relationships' };
  }
  if (/\b(?:manipulate|gaslight|control|punish|guilt.trip|make (?:them|him|her) jealous|force (?:them|him|her))\b/i.test(input)
      && /\b(?:how (?:do|can|to)|help me|i want to|teach me|make (?:them|him|her))\b/i.test(input)) {
    return { reply: 'What are you hoping that would give you, and how might you express that need while respecting the other person’s choice?', suggestions: ['What I’m hoping for is…', 'The need underneath is…', 'A direct request could be…'], theme: 'relationships' };
  }
  if (/\b(?:should i (?:leave|stay|break up|divorce)|tell me (?:what to do|the answer)|decide for me)\b/i.test(input)) {
    return { reply: 'This choice belongs to you. What matters most in it, and what would you need to know or feel supported by before deciding?', suggestions: ['What matters most is…', 'What concerns me is…', 'The support I want is…'], theme: 'relationships' };
  }

  const users = asMessages(history).filter((m) => m.role === 'user');
  // Identical entries may be genuine repeated answers (e.g. “I don't know”).
  // Only drop an appended current entry when the caller explicitly says so.
  const priorUsers = opts.historyIncludesCurrent && users.length && messageText(users.at(-1)) === input ? users.slice(0, -1) : users;
  const explicitTheme = typeof opts.theme === 'string' && Object.hasOwn(QUESTIONS, opts.theme) ? opts.theme : undefined;
  const theme = explicitTheme ?? chooseTheme(input)
    ?? [...priorUsers].reverse().map((m) => chooseTheme(messageText(m))).find(Boolean)
    ?? 'general';
  const phases = ['facts', 'story', 'body', 'need', 'action'];
  const requestedPhase = typeof opts.phase === 'string' ? phases.indexOf(opts.phase) : opts.phase;
  const phase = Number.isInteger(requestedPhase) && requestedPhase >= 0 && requestedPhase < 5
    ? requestedPhase : priorUsers.length % 5;
  const seed = hash(input);
  const question = QUESTIONS[theme][phase][seed % 2];
  const acknowledgment = ACKNOWLEDGMENTS[(seed + phase) % ACKNOWLEDGMENTS.length];
  return { reply: `${acknowledgment} ${question}`, suggestions: [...SUGGESTIONS[phase]], theme };
}
