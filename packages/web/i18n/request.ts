import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale as segmentLocale } from 'next/root-params';

import type en from '../messages/en.json';
import { routing } from './routing';

export default getRequestConfig(async ({ locale: requested }) => {
  // An explicit locale (getTranslations({ locale })) wins over the [locale] segment of the URL.
  const candidate = requested ?? (await segmentLocale());
  const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)) as { default: typeof en };
  return { locale, messages: messages.default };
});
