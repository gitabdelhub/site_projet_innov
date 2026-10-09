import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { Icon } from './Icon';

// The AI teacher (Llama on Groq, through /api/coach). The page gives the structured data;
// the server writes the prompt. Answers are clearly labelled as AI-written.

export type AiKind = 'review' | 'lesson' | 'summary';

const ERRORS: Record<string, MessageKey> = {
  'not-configured': 'ai.errOff',
  'sign-in': 'ai.errSignIn',
  quota: 'ai.errQuota',
  busy: 'ai.errBusy',
  'ai-down': 'ai.errDown',
};

export const askTeacher = async (kind: AiKind, lang: string, payload: unknown): Promise<{ text?: string; error?: MessageKey }> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'ai.errSignIn' };
  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ kind, lang, payload }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.text) return { text: body.text };
    return { error: ERRORS[body?.error] ?? 'ai.errDown' };
  } catch {
    return { error: 'ai.errDown' };
  }
};

// Plain text with "- " bullets, shown as paragraphs and a list
const Answer: React.FC<{ text: string }> = ({ text }) => {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line) continue;
    const bullet = /^[-•*]\s+/.test(line);
    const content = line.replace(/^[-•*]\s+/, '');
    const last = blocks[blocks.length - 1];
    if (last && last.list === bullet && bullet) last.lines.push(content);
    else blocks.push({ list: bullet, lines: [content] });
  }
  return (
    <div className="space-y-2 text-sm text-text-primary leading-relaxed">
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i} className="space-y-1.5">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><span>{l}</span></li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.lines[0]}</p>
        )
      )}
    </div>
  );
};

interface AiTeacherProps {
  kind: AiKind;
  // Built when the button is pressed, so it always uses the latest data
  payload: () => unknown;
  title: string;
  cta: string;
  // Lessons: the student types a question
  withQuestion?: boolean;
  compact?: boolean;
}

export const AiTeacher: React.FC<AiTeacherProps> = ({ kind, payload, title, cta, withQuestion = false, compact = false }) => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');

  const signedIn = !!user && !user.id.startsWith('local-user') && isSupabaseConfigured();

  const ask = async () => {
    setLoading(true);
    setError(null);
    const base = payload() as Record<string, unknown>;
    const res = await askTeacher(kind, lang, withQuestion ? { ...base, question } : base);
    setLoading(false);
    if (res.text) {
      setText(res.text);
      if (withQuestion) setQuestion('');
    } else setError(res.error ?? 'ai.errDown');
  };

  return (
    <div className={`bg-gradient-to-br from-accent/[0.06] to-transparent border border-accent/20 rounded-2xl ${compact ? 'p-3' : 'p-4 sm:p-5'} space-y-3`}>
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shrink-0">
          <Icon name="sparkle" className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-primary leading-tight">{title}</h3>
          <p className="text-[11px] text-text-secondary">{t('ai.poweredBy')}</p>
        </div>
      </div>

      {!signedIn ? (
        <p className="text-xs text-text-secondary">{t('ai.errSignIn')}</p>
      ) : (
        <>
          {text && <Answer text={text} />}
          {error && <p role="alert" className="text-xs text-red-600">{t(error)}</p>}
          {withQuestion ? (
            <form onSubmit={(e) => { e.preventDefault(); if (question.trim()) ask(); }} className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, 300))}
                placeholder={t('ai.questionPlaceholder')}
                aria-label={t('ai.questionPlaceholder')}
                className="flex-1 min-w-0 bg-bg-card border border-gray-200 rounded-lg px-3 py-2 text-xs text-text-primary focus:border-accent focus:outline-none"
              />
              <button type="submit" disabled={loading || !question.trim()} className="shrink-0 inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-bold px-3 py-2 rounded-lg text-xs disabled:opacity-50 transition-colors">
                <Icon name="send" className="w-3.5 h-3.5" /> {loading ? t('ai.thinking') : cta}
              </button>
            </form>
          ) : (
            <button onClick={ask} disabled={loading} className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-bold px-4 py-2 rounded-lg text-xs disabled:opacity-50 transition-colors">
              <Icon name={text ? 'refresh' : 'sparkle'} className="w-3.5 h-3.5" /> {loading ? t('ai.thinking') : text ? t('ai.again') : cta}
            </button>
          )}
          {text && <p className="text-[10px] text-text-secondary">{t('ai.disclaimer')}</p>}
        </>
      )}
    </div>
  );
};
