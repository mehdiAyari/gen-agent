import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { Generator } from '@/components/generator/generator';

export async function generateMetadata({ params }: PageProps<'/[locale]/generator'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'generator' });
  return { title: t('metaTitle'), description: t('lead') };
}

export default function GeneratorPage() {
  const t = useTranslations('generator');

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pt-10">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold text-balance">{t('title')}</h1>
        <p className="text-pretty text-muted-foreground">{t('lead')}</p>
      </header>
      <Generator />
    </main>
  );
}
