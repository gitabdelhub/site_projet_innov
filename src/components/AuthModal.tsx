import React, { useEffect } from 'react';
import { AuthForm } from './AuthForm';
import { Icon } from './Icon';
import { useI18n } from '../i18n/I18nProvider';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="relative bg-bg-card rounded-2xl p-7 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label={t('common.close')} className="absolute top-4 right-4 p-1.5 rounded-lg text-text-secondary hover:bg-bg-darker">
          <Icon name="close" className="w-5 h-5" />
        </button>
        <AuthForm onDone={onClose} />
      </div>
    </div>
  );
};
