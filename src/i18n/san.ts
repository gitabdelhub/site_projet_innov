import type { Lang } from './I18nProvider';

// French notation uses other piece letters: R(oi), D(ame), T(our), F(ou), C(avalier)
const FR_PIECES: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };

// Show a move (or a line of moves) in the reader's notation. Only upper-case
// letters are piece letters in SAN, so files (a–h) and castling are untouched.
export const localSan = (san: string, lang: Lang) =>
  lang === 'fr' ? san.replace(/[KQRBN]/g, (p) => FR_PIECES[p]) : san;
