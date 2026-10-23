'use client';

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
          hint={form.profile === 'standard' ? t('standardHint') : t('minimalHint')}
          value={form.profile}
          options={['minimal', 'standard'] as const}
          labels={{ minimal: t('minimal'), standard: t('standard') }}
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
              update({ memoryType });
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
              update(auth === 'none' ? { auth, rateLimit: '', tokenBudget: '' } : { auth });
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
