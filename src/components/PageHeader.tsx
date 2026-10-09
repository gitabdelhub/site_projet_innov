import React from 'react';
import { Icon, type IconName } from './Icon';

interface PageHeaderProps {
  icon: IconName;
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode; // extra content under the subtitle (filters, actions)
}

// Same header on every page: icon tile, title, one-line explanation
export const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, subtitle, children }) => (
  <header className="text-center mb-6 sm:mb-8">
    <span className="inline-flex w-12 h-12 rounded-2xl bg-accent/10 text-accent items-center justify-center mb-3">
      <Icon name={icon} className="w-6 h-6" />
    </span>
    <h1 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2">{title}</h1>
    {subtitle && <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto px-4">{subtitle}</p>}
    {children}
  </header>
);
