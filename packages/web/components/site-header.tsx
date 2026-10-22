import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { LocaleSwitcher } from './locale-switcher';

export function SiteHeader() {
  const t = useTranslations('nav');

  return (
    <header className="border-b border-border">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        {t('skipToContent')}
      </a>
      <div className="mx-auto flex w-full max-w-6xl items-center gap-8 px-6 py-4">
        <Link href="/" className="font-mono text-lg font-semibold">
          gen-agent
        </Link>
        <nav aria-label={t('main')} className="flex flex-1 items-center gap-6 text-sm">
          <Link href="/generator" className="hover:text-primary">
            {t('generator')}
          </Link>
          <Link href="/gallery" className="hover:text-primary">
            {t('gallery')}
          </Link>
          <Link href="/docs" className="hover:text-primary">
            {t('docs')}
          </Link>
        </nav>
        <LocaleSwitcher label={t('language')} />
      </div>
    </header>
  );
}
