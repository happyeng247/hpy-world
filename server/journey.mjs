import { createHash, randomUUID } from 'node:crypto';
import { REGION_IDS, WORLD_CHAPTERS, getModule } from '../src/journey/catalog.js';

const MAX_INSIGHTS = 500;
const MAX_TOTAL_CHARACTERS = 2_000_000;
const THEME_WORDS = [
  { label: 'Uncertainty', terms: /\b(uncertain|uncertainty|unsure|worry|worried|waiting|unknown)\b/i, question: 'When uncertainty shows up, what helps you leave a little room before deciding what it means?' },
  { label: 'Connection', terms: /\b(connection|connect|closeness|close|relationship|reconnect|belong)\b/i, question: 'What kind of connection would you like to ask for in your own words?' },
  { label: 'Boundaries', terms: /\b(boundary|boundaries|limits|space|capacity|saying no)\b/i, question: 'What would make a boundary feel both clear and possible for you?' },
  { label: 'Conflict', terms: /\b(conflict|argument|argue|angry|anger|upset|disagreement)\b/i, question: 'In a difficult moment, what would you like to notice before choosing your response?' },
  { label: 'Self-kindness', terms: /\b(kindness|kind|compassion|gentle|self-respect|self-worth|forgive)\b/i, question: 'What would being on your own side look like in one ordinary moment?' },
];

class JourneyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function text(value, label, max, { required = false } = {}) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max) throw new JourneyError(400, `${label} must be text, up to ${max.toLocaleString('en-US')} characters.`);
  const cleaned = value.trim();
  if (required && !cleaned) throw new JourneyError(400, `Add ${label.toLowerCase()} before keeping this insight.`);
  return cleaned;
}

export function createEmptyJourney() {
  return {
    version: 1,
    activeWorldId: WORLD_CHAPTERS[0].id,
    worlds: WORLD_CHAPTERS.map((world, index) => ({ id: world.id, unlocked: index === 0, visited: [], completed: [] })),
    insights: [],
    assessment: {
      status: 'empty', source: 'local', summary: 'Keep a reflection when you want it to become part of your ongoing review.',
      patterns: [], strengths: [], nextQuestions: ['What would you like to notice about yourself as you explore?'],
      updatedAt: null, evidenceCount: 0,
    },
    aiReviewEnabled: false,
    completionReceipts: {},
  };
}

function getJourney(state, { write = false } = {}) {
  if (!state.journey) {
    const created = createEmptyJourney();
    if (write) state.journey = created;
    return created;
  }
  const journey = state.journey;
  if (journey.version !== 1 || !Array.isArray(journey.worlds) || !Array.isArray(journey.insights)) {
    throw new JourneyError(500, 'This journey could not be opened safely. Restore a matching backup before continuing.');
  }
  journey.completionReceipts ??= {};
  return journey;
}

function evidenceFingerprint(journey) {
  return createHash('sha256').update(JSON.stringify(journey.insights)).digest('hex');
}

function completionFingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requireWorld(journey, worldId) {
  const world = journey.worlds.find((item) => item.id === worldId);
  if (!world) throw new JourneyError(400, 'Choose one of the available worlds.');
  if (!world.unlocked) throw new JourneyError(409, 'This world opens after you complete the six encounters in the previous world.');
  return world;
}

function requireRegion(regionId) {
  if (!REGION_IDS.includes(regionId)) throw new JourneyError(400, 'Choose one of the six places in this world.');
  return regionId;
}

export function assessSavedInsights(insights, now = new Date().toISOString()) {
  if (!insights.length) return { ...createEmptyJourney().assessment, updatedAt: now };
  const mentioned = THEME_WORDS.map((theme) => ({
    ...theme, count: insights.reduce((count, insight) => count + Number(theme.terms.test(insight.text)), 0),
  })).filter((theme) => theme.count > 0).sort((a, b) => b.count - a.count);
  const encounters = insights.filter((insight) => insight.source === 'encounter').length;
  const nextSteps = insights.filter((insight) => insight.nextStep?.trim()).length;
  const strengths = [`You chose to keep ${insights.length} reflection${insights.length === 1 ? '' : 's'} for further noticing.`];
  if (encounters) strengths.push(`You recorded your own takeaways from ${encounters} guided encounter${encounters === 1 ? '' : 's'}.`);
  if (nextSteps) strengths.push(`You named a possible next step in ${nextSteps} saved encounter${nextSteps === 1 ? '' : 's'}.`);
  return {
    status: 'ready', source: 'local',
    summary: `These observations describe the ${insights.length} reflection${insights.length === 1 ? '' : 's'} you chose to save. Word mentions can miss context; you decide what fits.`,
    patterns: mentioned.map((theme) => `${theme.label}-related words appear in ${theme.count} saved reflection${theme.count === 1 ? '' : 's'}.`),
    strengths,
    nextQuestions: mentioned.length ? mentioned.slice(0, 3).map((theme) => theme.question) : ['Across these reflections, what feels familiar?', 'What has changed in how you want to respond?'],
    updatedAt: now, evidenceCount: insights.length,
  };
}

function checkCapacity(journey, insight) {
  if (journey.insights.length >= MAX_INSIGHTS || journey.insights.reduce((sum, item) => sum + item.text.length, 0) + insight.text.length > MAX_TOTAL_CHARACTERS) {
    throw new JourneyError(409, 'Your insight space is full. Export a copy and remove an insight before keeping more.');
  }
}

function cleanReview(result) {
  const summary = text(result?.summary, 'Review summary', 4000, { required: true });
  const cleaned = { summary };
  for (const key of ['patterns', 'strengths', 'nextQuestions']) {
    const values = result?.[key];
    if (!Array.isArray(values) || values.length > 8 || values.some((value) => typeof value !== 'string' || value.length > 1500)) {
      throw new Error('Invalid review output.');
    }
    cleaned[key] = values.map((value) => value.trim()).filter(Boolean);
  }
  if (result?.evidenceIds !== undefined) {
    if (!Array.isArray(result.evidenceIds) || result.evidenceIds.length > MAX_INSIGHTS || result.evidenceIds.some((id) => typeof id !== 'string')) throw new Error('Invalid review evidence.');
    cleaned.evidenceIds = [...new Set(result.evidenceIds)];
  }
  if (result?.maxInsightCharacters !== undefined) {
    if (!Number.isInteger(result.maxInsightCharacters) || result.maxInsightCharacters < 1 || result.maxInsightCharacters > 12000) throw new Error('Invalid review scope.');
    cleaned.maxInsightCharacters = result.maxInsightCharacters;
  }
  if (result?.patternEvidence !== undefined) {
    if (!Array.isArray(result.patternEvidence) || result.patternEvidence.length > cleaned.patterns.length) throw new Error('Invalid pattern evidence.');
    cleaned.patternEvidence = result.patternEvidence.map((item) => {
      if (!Number.isInteger(item?.patternIndex) || item.patternIndex < 0 || item.patternIndex >= cleaned.patterns.length
        || !Array.isArray(item.insightIds) || item.insightIds.length > MAX_INSIGHTS
        || item.insightIds.some((id) => typeof id !== 'string' || !cleaned.evidenceIds?.includes(id))) throw new Error('Invalid pattern evidence.');
      return { patternIndex: item.patternIndex, insightIds: [...new Set(item.insightIds)] };
    });
  }
  return cleaned;
}

/** Journey writes share the encrypted store's transaction queue with the existing journal. */
export class JourneyService {
  constructor({ store, reviewJourney, aiReviewAvailable, reviewIntervalMs = 10000 }) {
    this.store = store;
    this.reviewJourney = reviewJourney;
    this.availability = aiReviewAvailable;
    this.reviewIntervalMs = Math.max(0, reviewIntervalMs);
    this.pending = false;
    this.running = false;
    this.lastStarted = 0;
    this.timer = null;
    this.disposed = false;
  }

  get available() {
    try { return typeof this.reviewJourney === 'function' && Boolean(typeof this.availability === 'function' ? this.availability() : (this.availability ?? true)); }
    catch { return false; }
  }

  publicJourney(journey) {
    const { completionReceipts: _privateReceipts, ...value } = journey;
    return structuredClone({ ...value, aiReviewAvailable: Boolean(this.available) });
  }

  refresh(journey) {
    journey.assessment = assessSavedInsights(journey.insights);
    if (journey.insights.length && journey.aiReviewEnabled) {
      journey.assessment.status = this.available ? 'pending' : 'unavailable';
      if (!this.available) journey.assessment.reviewNote = 'AI review is not configured. Your local observations continue to update.';
    }
  }

  async read() {
    const journey = getJourney(await this.store.read());
    if (journey.assessment.status === 'pending') {
      if (this.available && journey.aiReviewEnabled) {
        if (!this.running && !this.timer) this.queueReview();
      }
      else this.refresh(journey);
    }
    return { journey: this.publicJourney(journey) };
  }

  async voiceContext(worldId, regionId) {
    const journey = getJourney(await this.store.read());
    requireWorld(journey, worldId);
    requireRegion(regionId);
    const world = WORLD_CHAPTERS.find((item) => item.id === worldId);
    const module = getModule(worldId, regionId);
    return { worldTitle: world.title, regionTitle: module.title, focus: module.invitation, prompts: module.steps.map((step) => step.prompt) };
  }

  // These helpers run inside the caller's store transaction. Existing journal
  // entries are never imported; only the entry explicitly being saved is used.
  addJournalInsight(state, entry) {
    const journey = getJourney(state, { write: true });
    const fullText = `Journal note: ${entry.title}\n\n${entry.body}`;
    const marker = '\n\n[Excerpt of a longer journal entry. Open the journal for the full text.]';
    const insight = {
      id: randomUUID(), source: 'reflection', journalEntryId: entry.id,
      text: fullText.length > 6000 ? fullText.slice(0, 6000 - marker.length) + marker : fullText,
      excerpted: fullText.length > 6000, createdAt: entry.createdAt,
    };
    checkCapacity(journey, insight);
    journey.insights.unshift(insight);
    this.refresh(journey);
    return this.publicJourney(journey);
  }

  removeJournalInsights(state, ids) {
    if (!state.journey) return null;
    const journey = getJourney(state);
    const removeIds = ids ? new Set(ids) : null;
    const remaining = journey.insights.filter((insight) => !insight.journalEntryId || (removeIds && !removeIds.has(insight.journalEntryId)));
    if (remaining.length !== journey.insights.length) {
      journey.insights = remaining;
      this.refresh(journey);
    }
    return this.publicJourney(journey);
  }

  afterCommit(journey) {
    if (journey?.assessment.status === 'pending') this.queueReview();
  }

  async providerChanged() {
    const result = await this.store.update((state) => {
      if (!state.journey) return null;
      const journey = getJourney(state);
      this.refresh(journey);
      return this.publicJourney(journey);
    });
    if (result?.assessment.status === 'pending') this.queueReview();
    else { this.pending = false; clearTimeout(this.timer); this.timer = null; }
  }

  async visit(body) {
    return this.store.update((state) => {
      const journey = getJourney(state, { write: true });
      const world = requireWorld(journey, body.worldId);
      const region = requireRegion(body.regionId);
      if (!world.visited.includes(region)) world.visited.push(region);
      return { journey: this.publicJourney(journey) };
    });
  }

  async selectWorld(body) {
    return this.store.update((state) => {
      const journey = getJourney(state, { write: true });
      requireWorld(journey, body.worldId);
      journey.activeWorldId = body.worldId;
      return { journey: this.publicJourney(journey) };
    });
  }

  async complete(body) {
    const module = getModule(body.worldId, body.regionId);
    if (!module) throw new JourneyError(400, 'Choose a valid encounter in this world.');
    if (!Array.isArray(body.answers) || body.answers.length !== module.steps.length) throw new JourneyError(400, 'Keep one response for each encounter step; a step may be left open.');
    const answers = body.answers.map((answer) => text(answer, 'Step response', 2500, { required: false }));
    // Undefined is not an explicit response, even though an empty string may leave a question open.
    if (body.answers.some((answer) => typeof answer !== 'string')) throw new JourneyError(400, 'Each step response must be text.');
    const takeaway = text(body.takeaway, 'A takeaway', 2000, { required: true });
    const nextStep = text(body.nextStep, 'Next step', 2000);
    const fingerprint = completionFingerprint({ answers, takeaway, nextStep });
    const result = await this.store.update((state) => {
      const journey = getJourney(state, { write: true });
      const world = requireWorld(journey, body.worldId);
      requireRegion(body.regionId);
      if (!world.visited.includes(body.regionId)) throw new JourneyError(409, 'Visit this encounter before completing it.');
      const receiptKey = `${body.worldId}:${body.regionId}`;
      if (world.completed.includes(body.regionId)) {
        const receipt = journey.completionReceipts[receiptKey];
        const existing = receipt && journey.insights.find((insight) => insight.id === receipt.insightId);
        if (existing && receipt.fingerprint === fingerprint) return { journey: this.publicJourney(journey), insight: structuredClone(existing), duplicate: true };
        throw new JourneyError(409, 'You have already completed this encounter. Keep any new noticing as a fresh insight.');
      }
      const insight = {
        id: randomUUID(), source: 'encounter', worldId: body.worldId, regionId: body.regionId, answers, takeaway, nextStep,
        text: [...answers.map((answer, index) => `Step ${index + 1}: ${answer || '(Left open)'}`), `My takeaway: ${takeaway}`, ...(nextStep ? [`My next step: ${nextStep}`] : [])].join('\n\n'),
        createdAt: new Date().toISOString(),
      };
      checkCapacity(journey, insight);
      journey.insights.unshift(insight);
      world.completed.push(body.regionId);
      journey.completionReceipts[receiptKey] = { fingerprint, insightId: insight.id };
      const nextWorld = journey.worlds[journey.worlds.indexOf(world) + 1];
      if (nextWorld && REGION_IDS.every((region) => world.completed.includes(region))) nextWorld.unlocked = true;
      this.refresh(journey);
      return { journey: this.publicJourney(journey), insight: structuredClone(insight), duplicate: false };
    });
    if (!result.duplicate && result.journey.assessment.status === 'pending') this.queueReview();
    return result;
  }

  async addInsight(body) {
    if (!['voice', 'reflection'].includes(body.source)) throw new JourneyError(400, 'Choose voice or reflection as the insight source.');
    const insightText = text(body.text, 'An insight', 12000, { required: true });
    const result = await this.store.update((state) => {
      const journey = getJourney(state, { write: true });
      if (body.regionId !== undefined && body.worldId === undefined) throw new JourneyError(400, 'Choose a world for this place.');
      if (body.worldId !== undefined) requireWorld(journey, body.worldId);
      if (body.regionId !== undefined) requireRegion(body.regionId);
      const insight = { id: randomUUID(), text: insightText, source: body.source, createdAt: new Date().toISOString() };
      if (body.worldId !== undefined) insight.worldId = body.worldId;
      if (body.regionId !== undefined) insight.regionId = body.regionId;
      checkCapacity(journey, insight);
      journey.insights.unshift(insight);
      this.refresh(journey);
      return { journey: this.publicJourney(journey), insight: structuredClone(insight) };
    });
    if (result.journey.assessment.status === 'pending') this.queueReview();
    return result;
  }

  async removeInsight(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new JourneyError(404, 'Insight not found.');
    const result = await this.store.update((state) => {
      const journey = getJourney(state, { write: true });
      const index = journey.insights.findIndex((insight) => insight.id === id);
      if (index === -1) throw new JourneyError(404, 'Insight not found.');
      journey.insights.splice(index, 1);
      this.refresh(journey);
      return { journey: this.publicJourney(journey), deleted: true };
    });
    if (result.journey.assessment.status === 'pending') this.queueReview();
    return result;
  }

  async settings(body) {
    if (typeof body.aiReviewEnabled !== 'boolean') throw new JourneyError(400, 'Choose whether AI review is enabled.');
    const result = await this.store.update((state) => {
      const journey = getJourney(state, { write: true });
      journey.aiReviewEnabled = body.aiReviewEnabled;
      this.refresh(journey);
      return { journey: this.publicJourney(journey) };
    });
    if (result.journey.assessment.status === 'pending') this.queueReview();
    if (!body.aiReviewEnabled) { this.pending = false; clearTimeout(this.timer); this.timer = null; }
    return result;
  }

  async requestReview() {
    const result = await this.store.update((state) => {
      const journey = getJourney(state, { write: true });
      if (!journey.aiReviewEnabled) throw new JourneyError(403, 'Enable AI review before sending your saved insights for a review.');
      if (!this.available) throw new JourneyError(503, 'AI review is not configured. Your local observations remain available.');
      if (!journey.insights.length) throw new JourneyError(409, 'Keep an insight before requesting a review.');
      this.refresh(journey);
      return { journey: this.publicJourney(journey) };
    });
    this.queueReview();
    return result;
  }

  queueReview() {
    if (this.disposed || !this.available) return;
    this.pending = true;
    if (this.running || this.timer) return;
    const delay = Math.max(0, this.lastStarted + this.reviewIntervalMs - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runReview().catch(() => { /* Saving remains independent of provider or review-storage failures. */ });
    }, delay);
    this.timer.unref?.();
  }

  async runReview() {
    if (this.running || this.disposed || !this.pending) return;
    this.pending = false;
    this.running = true;
    let fingerprint;
    try {
      const journey = getJourney(await this.store.read());
      if (this.disposed || !this.available || !journey.aiReviewEnabled || !journey.insights.length) return;
      fingerprint = evidenceFingerprint(journey);
      this.lastStarted = Date.now();
      const reviewed = cleanReview(await this.reviewJourney({
        insights: structuredClone(journey.insights), assessment: assessSavedInsights(journey.insights), worlds: structuredClone(journey.worlds),
      }));
      if (reviewed.evidenceIds?.some((id) => !journey.insights.some((insight) => insight.id === id))) throw new Error('Review cited unavailable evidence.');
      if (this.disposed) return;
      await this.store.update((state) => {
        const current = getJourney(state, { write: true });
        if (this.available && current.aiReviewEnabled && evidenceFingerprint(current) === fingerprint) {
          current.assessment = {
            ...reviewed, status: 'ready', source: 'ai', evidenceCount: reviewed.evidenceIds?.length ?? current.insights.length, updatedAt: new Date().toISOString(),
            reviewNote: 'An AI-generated reflection on the words you chose to save. You decide what fits.',
          };
        }
      });
    } catch {
      if (!this.disposed && fingerprint) {
        await this.store.update((state) => {
          const current = getJourney(state, { write: true });
          if (this.available && current.aiReviewEnabled && evidenceFingerprint(current) === fingerprint) {
            current.assessment = {
              ...assessSavedInsights(current.insights), status: 'error',
              reviewNote: 'AI review was unavailable. Your saved insights and local observations are intact.',
            };
          }
        });
      }
    } finally {
      this.running = false;
      if (this.pending && !this.disposed) this.queueReview();
    }
  }

  async close() {
    this.disposed = true;
    this.pending = false;
    clearTimeout(this.timer);
    this.timer = null;
    await this.store.read();
  }
}
