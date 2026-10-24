'use client';

import { BODYLESS_METHODS, DEFAULT_MAX_RESPONSE_CHARS, urlPlaceholders } from '@gen-agent/core';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { emptyParam, type AgentForm } from '@/lib/agent-form';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { controlId, SelectField, TextField } from './form-controls';

type ToolForm = AgentForm['tools'][number];
type ParamForm = ToolForm['params'][number];

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const PARAM_TYPES = ['string', 'number', 'integer', 'boolean'] as const;
const AUTH_TYPES = ['none', 'bearer', 'header'] as const;
const PLACEMENTS = ['auto', 'path', 'query', 'body'] as const;

interface ToolFieldsProps {
  tool: ToolForm;
  index: number;
  errorOf: (path: string) => string | undefined;
  onChange: (tool: ToolForm) => void;
  onRemove: () => void;
}

export function ToolFields({ tool, index, errorOf, onChange, onRemove }: ToolFieldsProps) {
  const t = useTranslations('generator.tools');
  const tActions = useTranslations('generator.actions');
  const path = `tools.${String(index)}`;
  const addParamId = `${controlId(path)}-add-param`;
  const title = tool.name.trim() === '' ? t('untitled', { index: index + 1 }) : tool.name;

  const update = (patch: Partial<ToolForm>): void => {
    onChange({ ...tool, ...patch });
  };
  const updateParam = (paramIndex: number, patch: Partial<ParamForm>): void => {
    update({ params: tool.params.map((param, i) => (i === paramIndex ? { ...param, ...patch } : param)) });
  };
  const addParam = (): void => {
    update({ params: [...tool.params, emptyParam()] });
    requestAnimationFrame(() =>
      document.getElementById(controlId(`${path}.params.${String(tool.params.length)}.name`))?.focus(),
    );
  };

  return (
    // The legend stays the first child of the fieldset, so it names the group for assistive technologies;
    // floated, it is laid out as content instead of cutting the border.
    <FieldSet className="relative rounded-lg border bg-card p-4">
      <FieldLegend className="float-left mb-0 w-full truncate pr-10 font-mono" translate="no">
        {title}
      </FieldLegend>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-3 right-3"
        onClick={onRemove}
        aria-label={t('remove', { name: title })}
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            path={`${path}.name`}
            label={t('name')}
            value={tool.name}
            error={errorOf(`${path}.name`)}
            onValueChange={(name) => {
              update({ name });
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="current-weather…"
          />
          <Field>
            <FieldTitle id={`${controlId(path)}-type`}>{t('type')}</FieldTitle>
            <ToggleGroup
              aria-labelledby={`${controlId(path)}-type`}
              variant="outline"
              value={[tool.type]}
              onValueChange={(value: string[]) => {
                const type = value[0];
                if (type === 'http' || type === 'java') update({ type });
              }}
            >
              <ToggleGroupItem value="http">{t('http')}</ToggleGroupItem>
              <ToggleGroupItem value="java">{t('java')}</ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </div>
        <TextField
          path={`${path}.description`}
          label={t('description')}
          hint={t('descriptionHint')}
          value={tool.description}
          error={errorOf(`${path}.description`)}
          onValueChange={(description) => {
            update({ description });
          }}
          autoComplete="off"
        />
        {tool.type === 'http' ? (
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <SelectField
              path={`${path}.method`}
              label={t('method')}
              value={tool.method}
              options={METHODS}
              onValueChange={(method) => {
                update({ method });
              }}
            />
            <TextField
              path={`${path}.url`}
              label={t('url')}
              value={tool.url}
              error={errorOf(`${path}.url`)}
              onValueChange={(url) => {
                update({ url });
              }}
              hint={t('urlHint')}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://api.example.com/orders/{orderId}…"
            />
          </div>
        ) : null}
        {tool.type === 'http' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              path={`${path}.auth.type`}
              label={t('auth')}
              value={tool.auth.type}
              options={AUTH_TYPES}
              labels={{ none: t('authNone'), bearer: t('authBearer'), header: t('authHeader') }}
              onValueChange={(type) => {
                update({ auth: { ...tool.auth, type } });
              }}
            />
            {tool.auth.type === 'none' ? null : (
              <TextField
                path={`${path}.auth.env`}
                label={t('authEnv')}
                hint={t('authEnvHint')}
                value={tool.auth.env}
                error={errorOf(`${path}.auth.env`)}
                onValueChange={(env) => {
                  update({ auth: { ...tool.auth, env } });
                }}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                placeholder="SHOP_API_TOKEN…"
              />
            )}
            {tool.auth.type === 'header' ? (
              <TextField
                path={`${path}.auth.name`}
                label={t('authHeaderName')}
                value={tool.auth.header}
                error={errorOf(`${path}.auth.name`)}
                onValueChange={(header) => {
                  update({ auth: { ...tool.auth, header } });
                }}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                placeholder="X-API-Key…"
              />
            ) : null}
            <TextField
              path={`${path}.maxResponseChars`}
              label={t('maxResponseChars')}
              hint={t('maxResponseCharsHint', { count: DEFAULT_MAX_RESPONSE_CHARS })}
              value={tool.maxResponseChars}
              error={errorOf(`${path}.maxResponseChars`)}
              onValueChange={(maxResponseChars) => {
                update({ maxResponseChars });
              }}
              inputMode="numeric"
              autoComplete="off"
              className="tabular-nums"
            />
          </div>
        ) : null}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field orientation="horizontal" className="sm:mt-8">
            <Checkbox
              id={controlId(`${path}.approval`)}
              checked={tool.approval}
              onCheckedChange={(approval) => {
                update({ approval });
              }}
            />
            <FieldLabel htmlFor={controlId(`${path}.approval`)} className="font-normal">
              {t('approval')}
            </FieldLabel>
            <FieldError>{errorOf(`${path}.approval`)}</FieldError>
          </Field>
          {tool.approval ? (
            <TextField
              path={`${path}.approval.expiresAfter`}
              label={t('approvalExpiresAfter')}
              hint={t('approvalExpiresAfterHint')}
              value={tool.approvalExpiresAfter}
              error={errorOf(`${path}.approval.expiresAfter`)}
              onValueChange={(approvalExpiresAfter) => {
                update({ approvalExpiresAfter });
              }}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder="24h…"
            />
          ) : null}
        </div>
        <FieldSet>
          <FieldLegend variant="label">{t('params')}</FieldLegend>
          <FieldError>{errorOf(`${path}.params`)}</FieldError>
          {tool.params.map((param, paramIndex) => {
            const paramPath = `${path}.params.${String(paramIndex)}`;
            const paramTitle = param.name.trim() === '' ? String(paramIndex + 1) : param.name;
            return (
              <div
                // Parameters have no identity of their own: their position is it.
                key={paramIndex}
                className="grid items-start gap-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto]"
              >
                <TextField
                  path={`${paramPath}.name`}
                  label={t('paramName')}
                  value={param.name}
                  error={errorOf(`${paramPath}.name`)}
                  onValueChange={(name) => {
                    updateParam(paramIndex, { name });
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="latitude…"
                />
                <SelectField
                  path={`${paramPath}.type`}
                  label={t('paramType')}
                  value={param.type}
                  options={PARAM_TYPES}
                  onValueChange={(type) => {
                    updateParam(paramIndex, { type });
                  }}
                />
                <Field orientation="horizontal" className="sm:mt-8">
                  <Checkbox
                    id={controlId(`${paramPath}.required`)}
                    checked={param.required}
                    onCheckedChange={(required) => {
                      updateParam(paramIndex, { required });
                    }}
                  />
                  <FieldLabel htmlFor={controlId(`${paramPath}.required`)} className="font-normal">
                    {t('required')}
                  </FieldLabel>
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="sm:mt-7"
                  onClick={() => {
                    const previous = tool;
                    update({ params: tool.params.filter((_, i) => i !== paramIndex) });
                    requestAnimationFrame(() => document.getElementById(addParamId)?.focus());
                    toast(t('paramRemoved', { name: paramTitle }), {
                      action: {
                        label: tActions('undo'),
                        onClick: () => {
                          onChange(previous);
                        },
                      },
                    });
                  }}
                  aria-label={t('removeParam', { name: paramTitle })}
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
                <div
                  className={cn(
                    'grid gap-3 sm:col-span-4',
                    tool.type === 'http' && 'sm:grid-cols-2 [&>:first-child]:sm:col-span-2',
                  )}
                >
                  <TextField
                    path={`${paramPath}.description`}
                    label={t('paramDescription')}
                    value={param.description}
                    error={errorOf(`${paramPath}.description`)}
                    onValueChange={(description) => {
                      updateParam(paramIndex, { description });
                    }}
                    autoComplete="off"
                  />
                  {tool.type === 'http' ? (
                    <SelectField
                      path={`${paramPath}.in`}
                      label={t('placement')}
                      value={param.in}
                      options={PLACEMENTS}
                      labels={{
                        // Same rule as the generator: the path when the URL names it, else query or body by method.
                        auto: t('placementAuto', {
                          placement: urlPlaceholders(tool.url).includes(param.name)
                            ? t('placementInline.path')
                            : BODYLESS_METHODS.has(tool.method)
                              ? t('placementInline.query')
                              : t('placementInline.body'),
                        }),
                        path: t('placementPath'),
                        query: t('placementQuery'),
                        body: t('placementBody'),
                      }}
                      error={errorOf(`${paramPath}.in`)}
                      onValueChange={(placement) => {
                        updateParam(paramIndex, { in: placement });
                      }}
                    />
                  ) : null}
                  {tool.type === 'http' ? (
                    <TextField
                      path={`${paramPath}.apiName`}
                      label={t('apiName')}
                      value={param.apiName}
                      error={errorOf(`${paramPath}.apiName`)}
                      onValueChange={(apiName) => {
                        updateParam(paramIndex, { apiName });
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                      placeholder={param.name === '' ? 'employee_id…' : `${param.name}…`}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          <Button id={addParamId} type="button" variant="outline" size="sm" className="self-start" onClick={addParam}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            {t('addParam')}
          </Button>
        </FieldSet>
      </FieldGroup>
    </FieldSet>
  );
}
