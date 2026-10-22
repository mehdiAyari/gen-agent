import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-16">
      <h1 className="font-heading text-4xl font-bold text-balance">{t('headline')}</h1>
      <Button render={<Link href="/generator" />} nativeButton={false} size="lg">
        {t('openGenerator')}
      </Button>
    </main>
  );
}
