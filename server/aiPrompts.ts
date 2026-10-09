// Prompts for the AI teacher (Llama on Groq). The browser sends structured data only;
// the text sent to the model is written here, so a visitor cannot turn the teacher
// into a general chatbot. Only the lesson question is free text, and it is capped.

export type Lang = 'fr' | 'en';
export type AiKind = 'review' | 'lesson' | 'summary';

export interface ReviewPayload {
  side: 'w' | 'b';
  result: 'win' | 'loss' | 'draw' | 'unknown';
  accuracy: number;
  counts: { best: number; inaccuracies: number; mistakes: number; blunders: number };
  // The player's notable moves (mistakes first), at most 12
  moments: { n: number; san: string; cat: 'inaccuracy' | 'mistake' | 'blunder'; loss: number; best?: string }[];
}

export interface LessonPayload {
  lesson: string;
  exercise: string;
  question: string;
}

export interface SummaryPayload {
  puzzleRating: number;
  puzzleRated: number;
  weak: { name: string; rate: number }[];
  style: 'aggressive' | 'positional' | 'balanced' | null;
  levels: number[];
  lessonsDone: number;
  lessonsTotal: number;
  mistakesDue: number;
  mistakesTotal: number;
  aiLevel: number;
}

const SYSTEM: Record<Lang, string> = {
  fr: [
    'Tu es le professeur d’échecs de Chess Hub, une plateforme qui apprend les échecs.',
    'Tu tutoies l’élève, avec des phrases simples et chaleureuses, sans jargon inutile.',
    'Tu t’appuies uniquement sur les données fournies (calculées par Stockfish) : tu n’inventes jamais de coups, de variantes ni de chiffres.',
    'Tu réponds en français, en 120 à 180 mots, en texte simple : au plus 4 puces commençant par « - », sans titres ni gras.',
    'Si on te pose une question qui n’a rien à voir avec les échecs, tu ramènes gentiment la conversation vers la leçon.',
  ].join(' '),
  en: [
    'You are the chess teacher of Chess Hub, a platform that teaches chess.',
    'You speak directly to the student, with simple, warm sentences and no needless jargon.',
    'You rely only on the data given (computed by Stockfish): never invent moves, lines or numbers.',
    'You answer in English, in 120 to 180 words, in plain text: at most 4 bullets starting with "- ", no headings, no bold.',
    'If asked something unrelated to chess, gently bring the conversation back to the lesson.',
  ].join(' '),
};

// ---------- Cleaning what the browser sent ----------

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f<>`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const num = (value: unknown, min: number, max: number, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const SAN = /^[A-Za-z0-9+#=-]{2,8}$/;
const san = (value: unknown) => (typeof value === 'string' && SAN.test(value) ? value : null);

export const cleanReview = (p: any): ReviewPayload | null => {
  if (!p || typeof p !== 'object' || !Array.isArray(p.moments)) return null;
  const moments = p.moments
    .slice(0, 12)
    .map((m: any) => ({
      n: Math.round(num(m?.n, 1, 500, 1)),
      san: san(m?.san),
      cat: ['inaccuracy', 'mistake', 'blunder'].includes(m?.cat) ? m.cat : null,
      loss: Math.round(num(m?.loss, 0, 2000)),
      best: san(m?.best) ?? undefined,
    }))
    .filter((m: any) => m.san && m.cat);
  return {
    side: p.side === 'b' ? 'b' : 'w',
    result: ['win', 'loss', 'draw'].includes(p.result) ? p.result : 'unknown',
    accuracy: Math.round(num(p.accuracy, 0, 100)),
    counts: {
      best: Math.round(num(p.counts?.best, 0, 500)),
      inaccuracies: Math.round(num(p.counts?.inaccuracies, 0, 500)),
      mistakes: Math.round(num(p.counts?.mistakes, 0, 500)),
      blunders: Math.round(num(p.counts?.blunders, 0, 500)),
    },
    moments,
  };
};

export const cleanLesson = (p: any): LessonPayload | null => {
  const question = clean(p?.question, 300);
  if (!question) return null;
  return { lesson: clean(p?.lesson, 80), exercise: clean(p?.exercise, 400), question };
};

export const cleanSummary = (p: any): SummaryPayload | null => {
  if (!p || typeof p !== 'object') return null;
  return {
    puzzleRating: Math.round(num(p.puzzleRating, 100, 3500, 1000)),
    puzzleRated: Math.round(num(p.puzzleRated, 0, 100000)),
    weak: (Array.isArray(p.weak) ? p.weak : []).slice(0, 3).map((w: any) => ({ name: clean(w?.name, 60), rate: Math.round(num(w?.rate, 0, 100)) })).filter((w: any) => w.name),
    style: ['aggressive', 'positional', 'balanced'].includes(p.style) ? p.style : null,
    levels: (Array.isArray(p.levels) ? p.levels : []).slice(-10).map((x: unknown) => Math.round(num(x, 100, 3500, 1000))),
    lessonsDone: Math.round(num(p.lessonsDone, 0, 100)),
    lessonsTotal: Math.round(num(p.lessonsTotal, 0, 100)),
    mistakesDue: Math.round(num(p.mistakesDue, 0, 1000)),
    mistakesTotal: Math.round(num(p.mistakesTotal, 0, 1000)),
    aiLevel: Math.round(num(p.aiLevel, 1, 5, 1)),
  };
};

// ---------- Writing the messages ----------

const pawns = (cp: number) => (cp / 100).toFixed(1);

const reviewText = (p: ReviewPayload, lang: Lang) => {
  const fr = lang === 'fr';
  const side = fr ? (p.side === 'w' ? 'les Blancs' : 'les Noirs') : p.side === 'w' ? 'White' : 'Black';
  const result = fr
    ? { win: 'victoire', loss: 'défaite', draw: 'nulle', unknown: 'inconnu' }[p.result]
    : { win: 'win', loss: 'loss', draw: 'draw', unknown: 'unknown' }[p.result];
  const cat = (c: string) => (fr ? { inaccuracy: 'imprécision', mistake: 'erreur', blunder: 'gaffe' } : { inaccuracy: 'inaccuracy', mistake: 'mistake', blunder: 'blunder' })[c as 'mistake'];
  const lines = p.moments.map((m) =>
    fr
      ? `- coup ${m.n} : ${m.san} (${cat(m.cat)}, perd ${pawns(m.loss)} pion)${m.best ? ` ; le moteur préférait ${m.best}` : ''}`
      : `- move ${m.n}: ${m.san} (${cat(m.cat)}, loses ${pawns(m.loss)} pawns)${m.best ? `; the engine preferred ${m.best}` : ''}`
  );
  return fr
    ? [
        `Partie jouée avec ${side}. Résultat : ${result}. Précision : ${p.accuracy} %.`,
        `Coups excellents : ${p.counts.best}, imprécisions : ${p.counts.inaccuracies}, erreurs : ${p.counts.mistakes}, gaffes : ${p.counts.blunders}.`,
        lines.length ? `Moments importants de l’élève :\n${lines.join('\n')}` : 'Aucune erreur notable de l’élève.',
        'Fais le bilan de cette partie : un point positif, les deux moments qui ont le plus compté et pourquoi (en restant général si tu ne connais pas la position), puis un conseil concret pour la prochaine partie.',
      ].join('\n')
    : [
        `Game played as ${side}. Result: ${result}. Accuracy: ${p.accuracy}%.`,
        `Excellent moves: ${p.counts.best}, inaccuracies: ${p.counts.inaccuracies}, mistakes: ${p.counts.mistakes}, blunders: ${p.counts.blunders}.`,
        lines.length ? `The student's key moments:\n${lines.join('\n')}` : 'No notable mistakes by the student.',
        'Review this game: one positive point, the two moments that mattered most and why (stay general if you do not know the position), then one concrete tip for the next game.',
      ].join('\n');
};

const lessonText = (p: LessonPayload, lang: Lang) =>
  lang === 'fr'
    ? `L’élève suit la leçon « ${p.lesson} ». Exercice en cours : ${p.exercise}\nSa question : « ${p.question} »\nRéponds à sa question simplement, sans donner directement la solution de l’exercice : aide-le à la trouver.`
    : `The student is taking the lesson "${p.lesson}". Current exercise: ${p.exercise}\nTheir question: "${p.question}"\nAnswer simply, without giving away the solution of the exercise: help them find it.`;

const summaryText = (p: SummaryPayload, lang: Lang) => {
  const fr = lang === 'fr';
  const weak = p.weak.map((w) => `${w.name} (${w.rate} %)`).join(', ') || (fr ? 'pas encore assez de données' : 'not enough data yet');
  const style = p.style ? (fr ? { aggressive: 'offensif', positional: 'positionnel', balanced: 'équilibré' } : { aggressive: 'aggressive', positional: 'positional', balanced: 'balanced' })[p.style] : fr ? 'inconnu' : 'unknown';
  const levels = p.levels.length ? p.levels.join(' → ') : fr ? 'aucune estimation' : 'no estimate';
  return fr
    ? [
        `Profil de l’élève : classement puzzles ${p.puzzleRating} (${p.puzzleRated} puzzles joués).`,
        `Points faibles (taux de réussite) : ${weak}. Style de jeu : ${style}.`,
        `Estimations de niveau successives : ${levels}.`,
        `Leçons du parcours débutant terminées : ${p.lessonsDone}/${p.lessonsTotal}. Erreurs de ses parties à revoir : ${p.mistakesDue} (sur ${p.mistakesTotal}). Niveau conseillé contre l’ordinateur : ${p.aiLevel}/5.`,
        'Fais-lui un bilan personnalisé en deux phrases, puis propose un plan pour la semaine en 3 actions concrètes, en citant les pages du site : « Apprendre », « Puzzles pour moi », « Revoir mes erreurs », « Jouer ».',
      ].join('\n')
    : [
        `Student profile: puzzle rating ${p.puzzleRating} (${p.puzzleRated} puzzles played).`,
        `Weak points (success rate): ${weak}. Playing style: ${style}.`,
        `Level estimates over time: ${levels}.`,
        `Beginner lessons completed: ${p.lessonsDone}/${p.lessonsTotal}. Mistakes from their games to review: ${p.mistakesDue} (of ${p.mistakesTotal}). Suggested level against the computer: ${p.aiLevel}/5.`,
        'Give a personal summary in two sentences, then a plan for the week with 3 concrete actions, naming the site pages: "Learn", "Puzzles for me", "Review my mistakes", "Play".',
      ].join('\n');
};

// Returns the chat messages for the model, or null when the payload is unusable
export const buildMessages = (kind: AiKind, lang: Lang, payload: unknown) => {
  let user: string | null = null;
  if (kind === 'review') {
    const p = cleanReview(payload);
    if (p) user = reviewText(p, lang);
  } else if (kind === 'lesson') {
    const p = cleanLesson(payload);
    if (p) user = lessonText(p, lang);
  } else if (kind === 'summary') {
    const p = cleanSummary(payload);
    if (p) user = summaryText(p, lang);
  }
  if (!user) return null;
  return [
    { role: 'system' as const, content: SYSTEM[lang] },
    { role: 'user' as const, content: user },
  ];
};
