import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

const SAMPLE = `agent:
  name: weather-agent
  model:
    provider: ollama
    name: qwen2.5:3b
  tools:
    - name: current-weather
      type: http
      url: https://api.open-meteo.com/v1/forecast
      params:
        - { name: latitude, type: number, required: true }
        - { name: longitude, type: number, required: true }`;

/** Part of the project generated from SAMPLE: who owns what, in the colors of the generator. */
const TREE: { path: string; owner: 'user' | 'generated' }[] = [
  { path: 'generated/chat/ChatController.java', owner: 'generated' },
  { path: 'generated/chat/ChatService.java', owner: 'generated' },
  { path: 'generated/tool/CurrentWeatherTool.java', owner: 'generated' },
  { path: 'resources/prompts/system.md', owner: 'user' },
];

const STEPS = ['describe', 'generate', 'run'] as const;

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-16">
      <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col items-start gap-6">
          <h1 className="font-heading text-4xl font-bold text-balance sm:text-5xl">{t('headline')}</h1>
          <p className="text-lg text-pretty text-muted-foreground">{t('lead')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/generator" className={buttonVariants({ size: 'lg' })}>
              {t('openGenerator')}
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
            <Link href="/gallery" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {t('seeExamples')}
            </Link>
          </div>
        </div>
        <figure
          aria-hidden="true"
          translate="no"
          className="flex flex-col overflow-hidden rounded-xl border bg-card font-mono text-xs"
        >
          <figcaption className="border-b px-4 py-2 text-muted-foreground">agent.yaml</figcaption>
          <pre className="overflow-x-auto p-4 leading-relaxed">{SAMPLE}</pre>
          <ul className="flex flex-col gap-1.5 border-t bg-muted/40 px-4 py-3">
            {TREE.map((file) => (
              <li key={file.path} className="flex items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${file.owner === 'user' ? 'bg-owned' : 'bg-generated'}`}
                />
                {file.path}
              </li>
            ))}
          </ul>
        </figure>
      </section>

      <section aria-labelledby="steps" className="flex flex-col gap-8">
        <h2 id="steps" className="font-heading text-2xl font-bold">
          {t('stepsTitle')}
        </h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex flex-col gap-2 border-t-2 border-primary pt-4">
              <span className="font-mono text-sm text-primary">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="text-lg font-semibold">{t(`steps.${step}.title`)}</h3>
              <p className="text-pretty text-muted-foreground">{t(`steps.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="ownership" className="flex max-w-3xl flex-col gap-3">
        <h2 id="ownership" className="font-heading text-2xl font-bold text-balance">
          {t('ownershipTitle')}
        </h2>
        <p className="text-pretty text-muted-foreground">{t('ownershipText')}</p>
      </section>
    </main>
  );
}
