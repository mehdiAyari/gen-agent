import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Static export: the site is plain files, the project is generated in the visitor's browser (no server, no cost).
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
