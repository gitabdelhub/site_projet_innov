import { Link } from 'react-router-dom';
import { Brain, Puzzle, Gauge, LineChart, GraduationCap, Smartphone, Users, ArrowRight, Sparkles } from 'lucide-react';
import { Board } from '../components/board/Board';
import { useI18n } from '../i18n';

// A real position (Italian game) used as the hero visual, with the engine's suggestion.
const HERO_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5';

export const Home = () => {
  const { t } = useI18n();

  const features = [
    { icon: Brain, title: t('home.f1'), desc: t('home.f1d') },
    { icon: Puzzle, title: t('home.f2'), desc: t('home.f2d') },
    { icon: LineChart, title: t('home.f3'), desc: t('home.f3d') },
    { icon: Gauge, title: t('home.f4'), desc: t('home.f4d') },
  ];

  const steps = [
    { n: 1, title: t('home.s1'), desc: t('home.s1d') },
    { n: 2, title: t('home.s2'), desc: t('home.s2d') },
    { n: 3, title: t('home.s3'), desc: t('home.s3d') },
  ];

  const audience = [
    { icon: Users, title: t('home.a1'), desc: t('home.a1d') },
    { icon: GraduationCap, title: t('home.a2'), desc: t('home.a2d') },
    { icon: Smartphone, title: t('home.a3'), desc: t('home.a3d') },
  ];

  return (
    <div className="bg-bg-dark text-text-primary">
      <section className="relative overflow-hidden border-b border-gray-200/40 bg-gradient-to-b from-bg-card to-bg-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 md:py-20 grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          <div className="space-y-5 sm:space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 rounded-full text-accent text-xs font-extrabold uppercase tracking-wide">
              <Sparkles size={14} /> {t('home.badge')}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
              {t('home.title1')}
              <br />
              <span className="text-accent">{t('home.title2')}</span>
            </h1>
            <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-md">{t('home.subtitle')}</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Link
                to="/game"
                className="bg-accent hover:bg-accent-hover text-white font-bold py-3.5 sm:py-4 px-8 rounded-xl text-sm text-center shadow-md shadow-accent/25 hover:-translate-y-0.5 transition-all"
              >
                {t('home.ctaPlay')}
              </Link>
              <Link
                to="/coach/analyse"
                className="bg-bg-card hover:bg-bg-darker border border-gray-200/80 font-bold py-3.5 sm:py-4 px-8 rounded-xl text-sm text-center hover:-translate-y-0.5 transition-all"
              >
                {t('home.ctaAnalyse')}
              </Link>
            </div>
          </div>

          <div className="relative w-full max-w-[420px] mx-auto animate-fade-in">
            <div className="absolute -inset-6 bg-accent/10 rounded-[2rem] blur-3xl -z-10" />
            <div className="rotate-1 hover:rotate-0 transition-transform duration-500">
              <Board fen={HERO_FEN} arrows={[{ from: 'f3', to: 'g5', color: '#15803d' }]} lastMove={{ from: 'f8', to: 'c5' }} />
            </div>
            <div className="absolute -bottom-5 -left-3 sm:-left-8 bg-bg-card border border-gray-200 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center">
                <Brain size={20} />
              </div>
              <div>
                <p className="text-[11px] text-text-secondary font-semibold">{t('stats.predictedElo')}</p>
                <p className="text-xl font-black text-accent leading-none">1 240</p>
              </div>
            </div>
            <div className="absolute -top-4 -right-2 sm:-right-6 bg-bg-card border border-gray-200 rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2">
              <Puzzle size={16} className="text-rose-500" />
              <p className="text-xs font-bold">{t('home.heroChip')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-3 tracking-tight">{t('home.featuresTitle')}</h2>
        <p className="text-text-secondary text-center mb-10 max-w-2xl mx-auto">{t('home.featuresSubtitle')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center text-accent mb-4">
                <f.icon size={22} />
              </div>
              <h3 className="text-base font-bold mb-2">{f.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-bg-card border-y border-gray-200/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10 tracking-tight">{t('home.howTitle')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-full bg-accent text-white font-black flex items-center justify-center">{s.n}</span>
                  <h3 className="font-bold">{s.title}</h3>
                  {i < steps.length - 1 && <ArrowRight size={18} className="hidden md:block text-text-secondary ml-auto" />}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10 tracking-tight">{t('home.forWho')}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {audience.map((a) => (
            <div key={a.title} className="flex gap-4 bg-bg-card border border-gray-200/80 rounded-2xl p-5">
              <div className="w-10 h-10 shrink-0 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                <a.icon size={20} />
              </div>
              <div>
                <h3 className="font-bold mb-1">{a.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 bg-bg-card border-t border-gray-200/30 text-center px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t('home.ctaTitle')}</h2>
          <p className="text-text-secondary text-sm leading-relaxed">{t('home.ctaText')}</p>
          <Link
            to="/game"
            className="bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-8 rounded-xl text-sm shadow-md shadow-accent/25 inline-block"
          >
            {t('home.ctaPlay')}
          </Link>
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-text-secondary px-4">{t('home.footer')}</footer>
    </div>
  );
};
export default Home;
