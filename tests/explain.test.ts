import { describe, expect, it } from 'vitest';
import { describeMove, explainMove } from '../src/lib/explain';
import { categorize, type AnalyzedMove } from '../src/lib/analysis';
import { fr } from '../src/i18n/fr';
import { en } from '../src/i18n/en';
import { format, type MessageKey } from '../src/i18n/I18nProvider';

const tFr = (k: MessageKey, v?: Record<string, string | number>) => format(fr[k], v);
const tEn = (k: MessageKey, v?: Record<string, string | number>) => format(en[k], v);

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const played = (san: string, loss: number): AnalyzedMove => ({
  san, color: 'w', evalBefore: 0, evalAfter: -loss, loss, accuracy: 50, category: categorize(loss),
});

describe('move explanations', () => {
  it('describes an opening pawn move in the centre', () => {
    expect(describeMove(START, 'e4', tFr)).toEqual(['Le pion va en e4.', 'Ce pion prend de la place au centre.']);
  });

  it('recognises development and castling', () => {
    expect(describeMove(START, 'Nf3', tEn)).toContain('One more piece leaves the back rank: that is development.');
    const italian = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    expect(describeMove(italian, 'O-O', tEn)[0]).toMatch(/^Castling/);
  });

  it('names captures, checks and mates', () => {
    const scholar = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    expect(describeMove(scholar, 'Qxf7#', tFr)).toEqual(['La dame prend le pion en f7.', 'Échec et mat : la partie est finie.']);
  });

  it('spots a knight fork', () => {
    // Knight jumps to c7, attacking the king and the rook on a8
    const fen = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
    const lines = describeMove(fen, 'Nc7+', tEn);
    expect(lines).toContain('Check: the opponent must deal with it first.');
    expect(lines).toContain('This move threatens to take the rook on a8.');
  });

  it('warns when a move leaves a piece hanging', () => {
    // The queen goes to a square the pawn on g6 can take
    const fen = 'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(describeMove(fen, 'Qh5', tEn)).toContain('Careful: the queen on h5 can now be taken for free.');
  });

  it('gives the verdict and the better move on a blunder', () => {
    const fen = 'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const ex = explainMove(fen, played('Qh5', 850), 'g1f3', tFr);
    expect(ex.verdict).toBe('Gaffe : ce coup coûte l’équivalent d’environ 9 pion(s), ou la partie.');
    expect(ex.better?.san).toBe('Nf3');
  });

  it('does not suggest another move for a good one', () => {
    expect(explainMove(START, played('e4', 5), 'd2d4', tFr).better).toBeUndefined();
  });
});
