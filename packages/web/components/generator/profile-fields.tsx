'use client';

import { EMBEDDING_PROVIDERS } from '@gen-agent/core';
import { useTranslations } from 'next-intl';

import { withProfile, type AgentForm } from '@/lib/agent-form';
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';

import { ChoiceField, SwitchField, TextField } from './form-controls';

interface ProfileFieldsProps {
  form: AgentForm;
  errorOf: (path: string) => string | undefined;
  onChange: (form: AgentForm) => void;
}

/** The profile, and what it equips the agent with: each piece can still be changed on its own. */
export function ProfileFields({ form, errorOf, onChange }: ProfileFieldsProps) {
  const t = useTranslations('generator.profile');
  const update = (patch: Partial<AgentForm>): void => {
    onChange({ ...form, ...patch });
  };

  return (
    <FieldSet>
      <FieldLegend>{t('legend')}</FieldLegend>
      <FieldDescription>{t('hint')}</FieldDescription>
      <FieldGroup>
        <ChoiceField
          path="profile"
          label={t('profile')}
          hint={t(`${form.profile}Hint`)}
          value={form.profile}
          options={['minimal', 'standard', 'production'] as const}
          labels={{ minimal: t('minimal'), standard: t('standard'), production: t('production') }}
          onValueChange={(profile) => {
            onChange(withProfile(form, profile));
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField
            path="memoryType"
            label={t('memory')}
            value={form.memoryType}
            options={['in-memory', 'jdbc'] as const}
            labels={{ 'in-memory': t('memoryInMemory'), jdbc: t('memoryJdbc') }}
            onValueChange={(memoryType) => {
              // Only conversations kept in Postgres are purged.
              update(memoryType === 'jdbc' ? { memoryType } : { memoryType, retention: '' });
            }}
          />
          <ChoiceField
            path="auth"
            label={t('auth')}
            value={form.auth}
            options={['none', 'oidc'] as const}
            labels={{ none: t('authNone'), oidc: t('authOidc') }}
            onValueChange={(auth) => {
              // Limits are counted per user: without sign-in they go.
              update(
                auth === 'none'
                  ? { auth, rateLimit: '', tokenBudget: '', cache: false, semanticCache: false, erasure: false }
                  : { auth },
              );
            }}
          />
        </div>
        {form.auth === 'oidc' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              path="rateLimit"
              label={t('rateLimit')}
              hint={t('rateLimitHint')}
              value={form.rateLimit}
              error={errorOf('rateLimit')}
              onValueChange={(rateLimit) => {
                update({ rateLimit });
              }}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder="30/min…"
            />
            <TextField
              path="tokenBudget"
              label={t('tokenBudget')}
              hint={t('tokenBudgetHint')}
              value={form.tokenBudget}
              error={errorOf('tokenBudget')}
              onValueChange={(tokenBudget) => {
                update({ tokenBudget });
              }}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder="100000/day…"
            />
          </div>
        ) : null}
        {form.auth === 'oidc' ? (
          <SwitchField
            path="cache"
            label={t('cache')}
            hint={t('cacheHint')}
            checked={form.cache}
            onCheckedChange={(cache) => {
              update({ cache });
            }}
          />
        ) : null}
        {form.auth === 'oidc' && EMBEDDING_PROVIDERS.includes(form.provider) ? (
          <SwitchField
            path="semanticCache"
            label={t('semanticCache')}
            hint={t('semanticCacheHint')}
            checked={form.semanticCache}
            onCheckedChange={(semanticCache) => {
              update({ semanticCache });
            }}
          />
        ) : null}
        {form.semanticCache ? (
          <TextField
            path="semanticThreshold"
            label={t('semanticThreshold')}
            hint={t('semanticThresholdHint')}
            value={form.semanticThreshold}
            error={errorOf('semanticThreshold')}
            onValueChange={(semanticThreshold) => {
              update({ semanticThreshold });
            }}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            placeholder="0.95…"
          />
        ) : null}
        <SwitchField
          path="piiMasking"
          label={t('piiMasking')}
          hint={t('piiMaskingHint')}
          checked={form.piiMasking}
          onCheckedChange={(piiMasking) => {
            update({ piiMasking });
          }}
        />
        <SwitchField
          path="logsWithoutPii"
          label={t('logsWithoutPii')}
          hint={t('logsWithoutPiiHint')}
          checked={form.logsWithoutPii}
          onCheckedChange={(logsWithoutPii) => {
            update({ logsWithoutPii });
          }}
        />
        {form.auth === 'oidc' ? (
          <SwitchField
            path="erasure"
            label={t('erasure')}
            hint={t('erasureHint')}
            checked={form.erasure}
            onCheckedChange={(erasure) => {
              update({ erasure });
            }}
          />
        ) : null}
        {form.memoryType === 'jdbc' ? (
          <TextField
            path="retention"
            label={t('retention')}
            hint={t('retentionHint')}
            value={form.retention}
            error={errorOf('retention')}
            onValueChange={(retention) => {
              update({ retention });
            }}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            placeholder="30d…"
          />
        ) : null}
        <SwitchField
          path="chatUi"
          label={t('chatUi')}
          hint={form.auth === 'oidc' ? t('chatUiOidcHint') : t('chatUiHint')}
          checked={form.chatUi}
          onCheckedChange={(chatUi) => {
            update({ chatUi });
          }}
        />
        <SwitchField
          path="observability"
          label={t('observability')}
          hint={t('observabilityHint')}
          checked={form.observability}
          onCheckedChange={(observability) => {
            update({ observability });
          }}
        />
        <SwitchField
          path="dockerCompose"
          label={t('docker')}
          hint={t('dockerHint')}
          checked={form.dockerCompose}
          onCheckedChange={(dockerCompose) => {
            update({ dockerCompose });
          }}
        />
      </FieldGroup>
    </FieldSet>
  );
}
