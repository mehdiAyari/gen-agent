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
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-4">
        <Link href="/" className="font-mono text-lg font-semibold">
          gen-agent
        </Link>
        <nav
          aria-label={t('main')}
          className="order-last flex w-full items-center gap-6 text-sm sm:order-none sm:w-auto sm:flex-1"
        >
          <Link href="/generator" className="hover:text-primary">
            {t('generator')}
          </Link>
          <Link href="/gallery" className="hover:text-primary">
            {t('gallery')}
          </Link>
        </nav>
        <LocaleSwitcher label={t('language')} />
      </div>
    </header>
  );
}
