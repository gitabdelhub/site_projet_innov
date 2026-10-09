import { Link } from 'react-router-dom';
import { MiniBoard } from '../components/MiniBoard';
import { Icon, type IconName } from '../components/Icon';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';

// Two Knights Defence after 4.Ng5: both white pieces aim at f7
const HERO_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4';

const STEPS: { title: MessageKey; text: MessageKey }[] = [
  { title: 'home.step1Title', text: 'home.step1Text' },
  { title: 'home.step2Title', text: 'home.step2Text' },
  { title: 'home.step3Title', text: 'home.step3Text' },
];

const FEATURES: { icon: IconName; title: MessageKey; text: MessageKey; to: string; cta: MessageKey }[] = [
  { icon: 'chart', title: 'home.featLevelTitle', text: 'home.featLevelText', to: '/coach/elo', cta: 'home.featLevelCta' },
  { icon: 'puzzle', title: 'home.featPuzzlesTitle', text: 'home.featPuzzlesText', to: '/coach/tactics', cta: 'home.featPuzzlesCta' },
  { icon: 'users', title: 'home.featPlayTitle', text: 'home.featPlayText', to: '/game', cta: 'home.featPlayCta' },
];

export const Home = () => {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-bg-dark text-text-primary font-sans">
      {/* Hero */}
      <section className="border-b border-gray-200/50 bg-gradient-to-b from-bg-card to-bg-dark">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-20 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div className="space-y-6 animate-fade-in">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-full text-accent text-xs font-bold">
              <Icon name="graduation" className="w-4 h-4" />
              {t('home.eyebrow')}
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.08]">
              {t('home.title1')}
              <br />
              <span className="text-accent">{t('home.title2')}</span>
            </h1>
            <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-lg">{t('home.subtitle')}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                to="/coach/elo"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-colors shadow-md shadow-accent/25"
              >
                {t('home.ctaAnalyze')}
                <Icon name="arrowRight" className="w-4 h-4" />
              </Link>
              <Link
                to="/game"
                className="inline-flex items-center gap-2 bg-bg-card hover:bg-bg-darker border border-gray-200 text-text-primary font-bold py-3.5 px-6 rounded-xl text-sm transition-colors"
              >
                <Icon name="board" className="w-4 h-4" />
                {t('home.ctaPlay')}
              </Link>
            </div>
          </div>

          <div className="animate-fade-in">
            <div className="bg-bg-card border border-gray-200/70 rounded-3xl p-4 shadow-xl shadow-black/5 max-w-sm mx-auto">
              <MiniBoard fen={HERO_FEN} highlight={['g5', 'c4', 'f7']} flipped />
              <div className="mt-4 flex gap-3 items-start bg-amber-50 border border-amber-200/70 rounded-2xl p-3.5">
                <span className="mt-0.5 text-amber-700"><Icon name="bulb" className="w-5 h-5" /></span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">{t('home.noteLabel')}</p>
                  <p className="text-sm text-amber-950 leading-snug">{t('home.noteText')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">{t('home.howTitle')}</h2>
        <p className="text-text-secondary mb-10 max-w-2xl">{t('home.howText')}</p>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-bg-card border border-gray-200/70 rounded-2xl p-6">
              <span className="font-mono text-xs font-bold text-accent">0{i + 1}</span>
              <h3 className="text-lg font-bold mt-2 mb-2">{t(s.title)}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{t(s.text)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <Link
              key={f.to}
              to={f.to}
              className="group bg-bg-card border border-gray-200/70 rounded-2xl p-6 flex flex-col hover:border-accent/40 hover:shadow-md transition-all"
            >
              <span className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-5">
                <Icon name={f.icon} className="w-6 h-6" />
              </span>
              <h3 className="text-lg font-bold mb-2">{t(f.title)}</h3>
              <p className="text-sm text-text-secondary leading-relaxed flex-1">{t(f.text)}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent">
                {t(f.cta)}
                <Icon name="arrowRight" className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Credits: required by the licences of the engine and the pieces */}
      <footer className="py-6 px-6 text-center text-[11px] text-text-secondary leading-relaxed border-t border-gray-200/40">
        {t('home.credits1')}{' '}
        <a className="underline" href="https://stockfishchess.org" target="_blank" rel="noreferrer">Stockfish</a>{' '}
        {t('home.credits2')}{' '}
        <a className="underline" href="https://lichess.org" target="_blank" rel="noreferrer">Lichess</a>.
      </footer>
    </div>
  );
};

export default Home;
