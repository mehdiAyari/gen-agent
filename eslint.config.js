// @ts-check
import eslint from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.claude/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'e2e/output/**',
      '**/__snapshots__/**',
      '**/.next/**',
      '**/out/**',
      '**/next-env.d.ts',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: { ...nextPlugin.configs['core-web-vitals'].rules, ...reactHooks.configs.recommended.rules },
    settings: { next: { rootDir: 'packages/web/' } },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
);
