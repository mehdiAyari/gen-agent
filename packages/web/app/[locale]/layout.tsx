import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Next, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { routing } from '@/i18n/routing';

import '../globals.css';

// Downloaded at build time and served by the site itself: no request to Google from the visitor.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-atkinson',
  fallback: ['system-ui', 'sans-serif'],
  adjustFontFallback: false,
});
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return { title: t('title'), description: t('description') };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>): Promise<ReactNode> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={`${atkinson.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SiteHeader />
          <div id="content" className="flex flex-1 flex-col">
            {children}
          </div>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
