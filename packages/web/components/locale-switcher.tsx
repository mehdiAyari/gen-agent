'use client';

import { useLocale } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const NAMES: Record<(typeof routing.locales)[number], string> = { en: 'English', fr: 'Français' };

/** Same page in the other language. */
export function LocaleSwitcher({ label }: { label: string }) {
  const pathname = usePathname();
  const current = useLocale();

  return (
    <nav aria-label={label} className="flex gap-3 text-sm">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          lang={locale}
          aria-current={locale === current ? 'true' : undefined}
          className={cn('hover:text-primary', locale === current && 'font-semibold text-primary')}
        >
          {NAMES[locale]}
        </Link>
      ))}
    </nav>
  );
}
