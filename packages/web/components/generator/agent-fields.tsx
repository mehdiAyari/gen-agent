'use client';

import { EMBEDDING_PROVIDERS, EU_PROVIDERS, PROVIDERS, SUGGESTED_MODELS, type Provider } from '@gen-agent/core';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FocusEvent } from 'react';
import { toast } from 'sonner';

import { emptyTool, type AgentForm } from '@/lib/agent-form';
import { addImportedTools } from '@/lib/openapi-tools';
import { Button } from '@/components/ui/button';
import {
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
  FieldTitle,
  Field,
} from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { controlId, SwitchField, TextField } from './form-controls';
import { McpFields } from './mcp-fields';
import { OpenApiDialog } from './openapi-dialog';
import { ProfileFields } from './profile-fields';
import { ToolFields } from './tool-fields';

export const PROVIDER_NAMES: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistral: 'Mistral',
  ollama: 'Ollama',
};

const ADD_TOOL_ID = 'add-tool';

interface AgentFieldsProps {
  form: AgentForm;
  errorOf: (path: string) => string | undefined;
  onChange: (form: AgentForm) => void;
  onVisit: (path: string) => void;
}

export function AgentFields({ form, errorOf, onChange, onVisit }: AgentFieldsProps) {
  const t = useTranslations('generator');

  const update = (patch: Partial<AgentForm>): void => {
    onChange({ ...form, ...patch });
  };
  const changeProvider = (provider: Provider): void => {
    // Keeps a model the user typed; replaces the suggestion of the previous provider.
    const suggested = form.model.trim() === '' || form.model === SUGGESTED_MODELS[form.provider];
    update({
      provider,
      ...(suggested ? { model: SUGGESTED_MODELS[provider] } : {}),
      // The semantic cache needs an embedding model.
      ...(EMBEDDING_PROVIDERS.includes(provider) ? {} : { semanticCache: false }),
    });
  };
  const addTool = (): void => {
    update({
      tools: [...form.tools, emptyTool()],
    });
    requestAnimationFrame(() => document.getElementById(controlId(`tools.${String(form.tools.length)}.name`))?.focus());
  };

  return (
    <form
      noValidate
      aria-label={t('title')}
      className="flex flex-col gap-10"
      onSubmit={(event) => {
        event.preventDefault();
      }}
      onBlur={(event: FocusEvent<HTMLFormElement>) => {
        const { name } = event.target as Partial<HTMLInputElement>;
        if (name) onVisit(name);
      }}
    >
      <FieldSet>
        <FieldLegend>{t('agent.legend')}</FieldLegend>
        <FieldGroup>
          <TextField
            path="name"
            label={t('agent.name')}
            hint={t('agent.nameHint')}
            value={form.name}
            error={errorOf('name')}
            onValueChange={(name) => {
              update({ name });
            }}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <TextField
            path="description"
            label={t('agent.description')}
            value={form.description}
            error={errorOf('description')}
            onValueChange={(description) => {
              update({ description });
            }}
            autoComplete="off"
          />
          <TextField
            path="package"
            label={t('agent.package')}
            hint={t('agent.packageHint', { name: form.name.replaceAll('-', '') })}
            value={form.package}
            error={errorOf('package')}
            onValueChange={(value) => {
              update({ package: value });
            }}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>{t('model.legend')}</FieldLegend>
        <FieldGroup>
          <Field data-invalid={errorOf('provider') === undefined ? undefined : true}>
            <FieldTitle id={controlId('provider')}>{t('model.provider')}</FieldTitle>
            <ToggleGroup
              aria-labelledby={controlId('provider')}
              variant="outline"
              className="flex-wrap"
              value={[form.provider]}
              onValueChange={(value: string[]) => {
                const provider = PROVIDERS.find((candidate) => candidate === value[0]);
                if (provider !== undefined) changeProvider(provider);
              }}
            >
              {PROVIDERS.map((provider) => (
                <ToggleGroupItem key={provider} value={provider}>
                  {PROVIDER_NAMES[provider]}
                  {EU_PROVIDERS.includes(provider) ? (
                    <span className="text-xs text-muted-foreground">
                      {provider === 'ollama' ? t('model.local') : t('model.euHosted')}
                    </span>
                  ) : null}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldError>{errorOf('provider')}</FieldError>
          </Field>
          <TextField
            path="model"
            label={t('model.name')}
            hint={t('model.nameHint', {
              provider: PROVIDER_NAMES[form.provider],
              model: SUGGESTED_MODELS[form.provider],
            })}
            value={form.model}
            error={errorOf('model')}
            onValueChange={(model) => {
              update({ model });
            }}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              path="temperature"
              label={t('model.temperature')}
              hint={t('model.temperatureHint')}
              value={form.temperature}
              error={errorOf('temperature')}
              onValueChange={(temperature) => {
                update({ temperature });
              }}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
            <TextField
              path="maxTokens"
              label={t('model.maxTokens')}
              hint={t('model.maxTokensHint')}
              value={form.maxTokens}
              error={errorOf('maxTokens')}
              onValueChange={(maxTokens) => {
                update({ maxTokens });
              }}
              inputMode="numeric"
              autoComplete="off"
              className="tabular-nums"
            />
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>{t('tools.legend')}</FieldLegend>
        <FieldDescription>{t('tools.hint')}</FieldDescription>
        <FieldGroup>
          {form.tools.length === 0 ? <p className="text-sm text-muted-foreground">{t('tools.empty')}</p> : null}
          {form.tools.map((tool, index) => (
            <ToolFields
              // Tools are edited in place and only removed: their position identifies them.
              key={index}
              tool={tool}
              index={index}
              errorOf={errorOf}
              onChange={(changed) => {
                update({ tools: form.tools.map((existing, i) => (i === index ? changed : existing)) });
              }}
              onRemove={() => {
                const previous = form;
                update({ tools: form.tools.filter((_, i) => i !== index) });
                // The removed tool had focus: move it to a control that stays.
                requestAnimationFrame(() => document.getElementById(ADD_TOOL_ID)?.focus());
                toast(t('tools.removed', { name: tool.name.trim() || t('tools.untitled', { index: index + 1 }) }), {
                  action: {
                    label: t('actions.undo'),
                    onClick: () => {
                      onChange(previous);
                    },
                  },
                });
              }}
            />
          ))}
          <div className="flex flex-wrap gap-3">
            <Button id={ADD_TOOL_ID} type="button" variant="outline" onClick={addTool}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              {t('tools.add')}
            </Button>
            <OpenApiDialog
              onImport={(tools) => {
                const { form: updated, renamed } = addImportedTools(form, tools);
                onChange(updated);
                toast.success(t('openapi.added', { count: tools.length }), {
                  description:
                    renamed.length === 0
                      ? undefined
                      : renamed.map(({ from, to }) => t('openapi.renamed', { from, to })).join('\n'),
                });
              }}
            />
          </div>
        </FieldGroup>
      </FieldSet>

      <McpFields form={form} errorOf={errorOf} onChange={onChange} />

      <ProfileFields form={form} errorOf={errorOf} onChange={onChange} />

      <FieldSet>
        <FieldLegend>{t('behaviour.legend')}</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              path="systemPromptPath"
              label={t('behaviour.systemPrompt')}
              hint={t('behaviour.systemPromptHint')}
              value={form.systemPromptPath}
              error={errorOf('systemPromptPath')}
              onValueChange={(systemPromptPath) => {
                update({ systemPromptPath });
              }}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <TextField
              path="memoryWindow"
              label={t('behaviour.memoryWindow')}
              hint={t('behaviour.memoryWindowHint')}
              value={form.memoryWindow}
              error={errorOf('memoryWindow')}
              onValueChange={(memoryWindow) => {
                update({ memoryWindow });
              }}
              inputMode="numeric"
              autoComplete="off"
              className="tabular-nums"
            />
          </div>
          <SwitchField
            path="aiDisclosure"
            label={t('behaviour.aiDisclosure')}
            hint={t('behaviour.aiDisclosureHint')}
            checked={form.aiDisclosure}
            onCheckedChange={(aiDisclosure) => {
              update({ aiDisclosure });
            }}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>{t('gdpr.legend')}</FieldLegend>
        <FieldGroup>
          <SwitchField
            path="euOnly"
            label={t('gdpr.euOnly')}
            hint={t('gdpr.euOnlyHint')}
            checked={form.euOnly}
            onCheckedChange={(euOnly) => {
              update({ euOnly, ...(euOnly ? {} : { allowNonEuProviders: false }) });
            }}
          />
          {form.euOnly ? (
            <SwitchField
              path="allowNonEuProviders"
              label={t('gdpr.allowNonEu')}
              hint={t('gdpr.allowNonEuHint')}
              checked={form.allowNonEuProviders}
              onCheckedChange={(allowNonEuProviders) => {
                update({ allowNonEuProviders });
              }}
            />
          ) : null}
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
