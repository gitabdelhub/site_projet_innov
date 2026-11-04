import { useRef, useState } from 'react';
import { FileUp, ClipboardPaste, Sparkles, ArrowLeft } from 'lucide-react';
import { GameReview } from '../components/analysis/GameReview';
import { EloPanel } from '../components/analysis/EloPanel';
import type { GameAnalysis } from '../engine/analysis';
import { parsePgn, type Color, type ParsedPgn } from '../lib/chessGame';
import { useProgress } from '../lib/storage';
import { useI18n } from '../i18n';

const SAMPLE_PGN = `[Event "Paris Opera"]
[Site "Paris"]
[Date "1858.11.02"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

export const Analyse = () => {
  const { t } = useI18n();
  const progress = useProgress();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<ParsedPgn | null>(null);
  const [side, setSide] = useState<Color>('w');
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (pgn: string) => {
    try {
      const parsed = parsePgn(pgn);
      setError(null);
      setAnalysis(null);
      setGame(parsed);
      window.scrollTo({ top: 0 });
    } catch {
      setError(t('analyse.invalid'));
    }
  };

  if (game) {
    const names = { w: game.headers.White ?? t('common.white'), b: game.headers.Black ?? t('common.black') };
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary">{t('analyse.reviewTitle')}</h1>
            <p className="text-sm text-text-secondary">
              {names.w} vs {names.b}
              {game.headers.Result ? ` · ${game.headers.Result}` : ''}
            </p>
          </div>
          <button
            onClick={() => setGame(null)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-bg-card text-sm font-semibold hover:bg-bg-darker"
          >
            <ArrowLeft size={16} /> {t('analyse.another')}
          </button>
        </div>
        <GameReview
          startFen={game.startFen}
          moves={game.moves}
          orientation={side}
          playerColor={side}
          whiteName={names.w}
          blackName={names.b}
          onAnalysed={setAnalysis}
          aside={
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-secondary font-semibold">{t('analyse.whichSide')}</span>
                {(['w', 'b'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setSide(c)}
                    className={`px-3 py-1 rounded-full border font-semibold ${
                      side === c ? 'bg-accent text-white border-accent' : 'border-gray-200 text-text-primary bg-bg-card'
                    }`}
                  >
                    {names[c]}
                  </button>
                ))}
              </div>
              <EloPanel
                key={side}
                startFen={game.startFen}
                moves={game.moves}
                analysis={analysis}
                color={side}
                source="pgn"
                headers={game.headers}
                name={names[side]}
              />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-text-primary mb-2">{t('analyse.title')}</h1>
        <p className="text-text-secondary">{t('analyse.subtitle')}</p>
      </div>

      <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <label htmlFor="pgn" className="flex items-center gap-2 text-sm font-bold text-text-primary mb-2">
          <ClipboardPaste size={16} /> {t('analyse.paste')}
        </label>
        <textarea
          id="pgn"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'[Event "..."]\n\n1. e4 e5 2. Nf3 Nc6 ...'}
          className="w-full h-48 sm:h-56 p-3 rounded-xl border border-gray-200 bg-bg-dark font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
        />
        {error && <p className="text-sm text-danger mt-2">{error}</p>}
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <button
            onClick={() => load(text)}
            disabled={!text.trim()}
            className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold py-3 rounded-xl"
          >
            {t('analyse.go')}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 bg-bg-dark hover:bg-bg-darker text-sm font-semibold"
          >
            <FileUp size={16} /> {t('analyse.file')}
          </button>
          <button
            onClick={() => setText(SAMPLE_PGN)}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 bg-bg-dark hover:bg-bg-darker text-sm font-semibold"
          >
            <Sparkles size={16} /> {t('analyse.sample')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pgn,text/plain"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const content = await f.text();
              setText(content);
              load(content);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {progress.games.length > 0 && (
        <div className="mt-6 bg-bg-card border border-gray-200/80 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-bold text-text-primary mb-3">{t('analyse.recent')}</p>
          <div className="flex flex-col divide-y divide-gray-100">
            {progress.games.slice(0, 5).map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setSide(g.playerColor);
                  load(g.pgn);
                }}
                className="flex items-center justify-between py-2.5 text-left hover:bg-bg-darker rounded-lg px-2"
              >
                <span className="text-sm text-text-primary">
                  {t('analyse.vsEngine', { elo: g.engineElo })} · {g.result}
                </span>
                <span className="text-xs text-text-secondary">{new Date(g.date).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
