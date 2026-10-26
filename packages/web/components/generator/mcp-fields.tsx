'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { emptyMcpServer, type AgentForm } from '@/lib/agent-form';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';

import { ChoiceField, controlId, SwitchField, TextField } from './form-controls';

type McpForm = AgentForm['mcp'][number];

const ADD_ID = 'add-mcp-server';

interface McpFieldsProps {
  form: AgentForm;
  errorOf: (path: string) => string | undefined;
  onChange: (form: AgentForm) => void;
}

/** MCP servers the agent starts: their tools are given to the model with the others. */
export function McpFields({ form, errorOf, onChange }: McpFieldsProps) {
  const t = useTranslations('generator.mcp');
  const tActions = useTranslations('generator.actions');
  const updateServer = (index: number, patch: Partial<McpForm>): void => {
    onChange({ ...form, mcp: form.mcp.map((server, i) => (i === index ? { ...server, ...patch } : server)) });
  };

  return (
    <FieldSet>
      <FieldLegend>{t('legend')}</FieldLegend>
      <FieldDescription>{t('hint')}</FieldDescription>
      <FieldGroup>
        {form.mcp.map((server, index) => {
          const path = `mcp.${String(index)}`;
          const title = server.name.trim() === '' ? t('untitled', { index: index + 1 }) : server.name;
          return (
            // Servers are edited in place and only removed: their position identifies them.
            // The legend stays the first child of the fieldset, so it names the group.
            <FieldSet key={index} className="relative rounded-lg border bg-card p-4">
              <FieldLegend className="float-left mb-0 w-full truncate pr-10 font-mono" translate="no">
                {title}
              </FieldLegend>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3"
                aria-label={t('remove', { name: title })}
                onClick={() => {
                  const previous = form;
                  onChange({ ...form, mcp: form.mcp.filter((_, i) => i !== index) });
                  requestAnimationFrame(() => document.getElementById(ADD_ID)?.focus());
                  toast(t('removed', { name: title }), {
                    action: {
                      label: tActions('undo'),
                      onClick: () => {
                        onChange(previous);
                      },
                    },
                  });
                }}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
              <FieldGroup>
                <FieldError>{errorOf(path)}</FieldError>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    path={`${path}.name`}
                    label={t('name')}
                    value={server.name}
                    error={errorOf(`${path}.name`)}
                    onValueChange={(name) => {
                      updateServer(index, { name });
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="files…"
                  />
                  <ChoiceField
                    path={`${path}.kind`}
                    label={t('kind')}
                    value={server.kind}
                    options={['local', 'remote'] as const}
                    labels={{ local: t('kindLocal'), remote: t('kindRemote') }}
                    onValueChange={(kind) => {
                      updateServer(index, { kind });
                    }}
                  />
                </div>
                {server.kind === 'remote' ? (
                  <>
                    <TextField
                      path={`${path}.url`}
                      label={t('url')}
                      hint={t('urlHint')}
                      value={server.url}
                      error={errorOf(`${path}.url`)}
                      onValueChange={(url) => {
                        updateServer(index, { url });
                      }}
                      type="url"
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                      placeholder="https://mcp.example.org/mcp…"
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        path={`${path}.auth.env`}
                        label={t('tokenEnv')}
                        hint={t('tokenEnvHint')}
                        value={server.tokenEnv}
                        error={errorOf(`${path}.auth.env`)}
                        onValueChange={(tokenEnv) => {
                          updateServer(index, { tokenEnv });
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                        placeholder="DOCS_TOKEN…"
                      />
                      <TextField
                        path={`${path}.auth.name`}
                        label={t('tokenHeader')}
                        hint={t('tokenHeaderHint')}
                        value={server.tokenHeader}
                        error={errorOf(`${path}.auth.name`)}
                        onValueChange={(tokenHeader) => {
                          updateServer(index, { tokenHeader });
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                        placeholder="Authorization…"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <ChoiceField
                      path={`${path}.runtime`}
                      label={t('runtime')}
                      value={server.runtime}
                      options={['node', 'python'] as const}
                      labels={{ node: 'Node (npx)', python: 'Python (uvx)' }}
                      onValueChange={(runtime) => {
                        updateServer(index, { runtime });
                      }}
                    />
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                      <TextField
                        path={`${path}.package`}
                        label={t('package')}
                        value={server.package}
                        error={errorOf(`${path}.package`)}
                        onValueChange={(name) => {
                          updateServer(index, { package: name });
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                        placeholder="@modelcontextprotocol/server-filesystem…"
                      />
                      <TextField
                        path={`${path}.version`}
                        label={t('version')}
                        hint={t('versionHint')}
                        value={server.version}
                        error={errorOf(`${path}.version`)}
                        onValueChange={(version) => {
                          updateServer(index, { version });
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                        placeholder="2.0.0…"
                      />
                    </div>
                    <ChoiceField
                      path={`${path}.sandbox`}
                      label={t('sandbox')}
                      hint={server.sandbox === 'docker' ? t('sandboxDockerHint') : t('sandboxNoneHint')}
                      value={server.sandbox}
                      options={['docker', 'none'] as const}
                      labels={{ docker: t('sandboxDocker'), none: t('sandboxNone') }}
                      onValueChange={(sandbox) => {
                        updateServer(index, { sandbox });
                      }}
                    />
                    {server.sandbox === 'docker' ? (
                      <SwitchField
                        path={`${path}.network`}
                        label={t('network')}
                        hint={t('networkHint')}
                        checked={server.network}
                        onCheckedChange={(network) => {
                          updateServer(index, { network });
                        }}
                      />
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        path={`${path}.args`}
                        label={t('args')}
                        hint={t('argsHint')}
                        value={server.args}
                        error={errorOf(`${path}.args`)}
                        onValueChange={(args) => {
                          updateServer(index, { args });
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                        placeholder="/srv/documents…"
                      />
                      <TextField
                        path={`${path}.env`}
                        label={t('env')}
                        hint={t('envHint')}
                        value={server.env}
                        error={errorOf(`${path}.env`)}
                        onValueChange={(env) => {
                          updateServer(index, { env });
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                        placeholder="GITHUB_TOKEN…"
                      />
                    </div>
                  </>
                )}
              </FieldGroup>
            </FieldSet>
          );
        })}
        <Button
          id={ADD_ID}
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => {
            onChange({ ...form, mcp: [...form.mcp, emptyMcpServer()] });
            requestAnimationFrame(() =>
              document.getElementById(controlId(`mcp.${String(form.mcp.length)}.name`))?.focus(),
            );
          }}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {t('add')}
        </Button>
      </FieldGroup>
    </FieldSet>
  );
}
