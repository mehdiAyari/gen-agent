import { useTranslations } from 'next-intl';

export function SiteFooter() {
  const t = useTranslations('footer');

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-6 text-sm text-muted-foreground">{t('note')}</div>
    </footer>
  );
}
