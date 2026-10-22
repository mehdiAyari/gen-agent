import { validateAgentYaml, type AgentFile } from '@gen-agent/core';
import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { EXAMPLES, type Example } from '@/lib/examples';

export async function generateMetadata({ params }: PageProps<'/[locale]/gallery'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'gallery' });
  return { title: t('metaTitle'), description: t('lead') };
}

function agentOf(example: Example): AgentFile['agent'] {
  const result = validateAgentYaml(example.yaml);
  // Checked by lib/examples.test.ts: an invalid example fails the tests, then the build.
  if (!result.ok) throw new Error(`Invalid example ${example.id}`);
  return result.config.agent;
}

export default function GalleryPage() {
  const t = useTranslations('gallery');

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold text-balance">{t('title')}</h1>
        <p className="text-pretty text-muted-foreground">{t('lead')}</p>
      </header>
      <ul className="grid gap-6 md:grid-cols-2">
        {EXAMPLES.map((example) => {
          const agent = agentOf(example);
          const title = t(`items.${example.id}.title`);
          return (
            <li key={example.id} className="flex flex-col gap-4 rounded-xl border bg-card p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="font-mono text-sm text-muted-foreground" translate="no">
                  {agent.name}
                </p>
              </div>
              <p className="text-pretty">{t(`items.${example.id}.summary`)}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="font-mono" translate="no">
                  {agent.model.provider} · {agent.model.name}
                </span>
                {agent.gdpr?.euOnly === true ? <span className="text-owned">{t('euOnly')}</span> : null}
              </p>
              <ul aria-label={t('toolsLabel', { name: title })} className="flex flex-col gap-1.5 border-t pt-4 text-sm">
                {agent.tools.map((tool) => (
                  <li key={tool.name} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono" translate="no">
                      {tool.name}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase">
                      {tool.type === 'http' ? `${tool.method} http` : 'java'}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={{ pathname: '/generator', query: { example: example.id } }}
                className={buttonVariants({ variant: 'outline', className: 'mt-auto self-start' })}
              >
                {t('open')}
                <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
