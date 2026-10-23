'use client';

import { importOpenApi, type ImportedTool, type ImportOptions } from '@gen-agent/openapi';
import { FileUpIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type ChangeEvent, type SyntheticEvent } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/** More than this and models choose less reliably: only the first ones are ticked at first. */
const PRESELECTED = 20;

interface Spec {
  text: string;
  /** Where it was downloaded from: relative server URLs resolve against it. */
  url?: string;
  /** File name or URL, shown to the user. */
  label: string;
}

/** Imports the operations of an OpenAPI spec as tools: the spec is read in the browser, never sent anywhere. */
export function OpenApiDialog({ onImport }: { onImport: (tools: ImportedTool[]) => void }) {
  const t = useTranslations('generator.openapi');
  const [open, setOpen] = useState(false);
  const [spec, setSpec] = useState<Spec>();
  const [url, setUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { url: useId(), baseUrl: useId() };

  const result = useMemo(() => {
    if (spec === undefined) return undefined;
    const options: ImportOptions = {};
    if (spec.url !== undefined) options.specUrl = spec.url;
    if (baseUrl.trim() !== '') options.baseUrl = baseUrl.trim();
    return importOpenApi(spec.text, options);
  }, [spec, baseUrl]);

  const load = (next: Spec): void => {
    setSpec(next);
    setLoadError(undefined);
    const preview = importOpenApi(next.text, next.url === undefined ? {} : { specUrl: next.url });
    // Tick the first operations; the user unticks what the agent does not need.
    setSelected(new Set(preview.ok ? preview.value.tools.slice(0, PRESELECTED).map((tool) => tool.name) : []));
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) load({ text: await file.text(), label: file.name });
  };

  const download = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      load({ text: await response.text(), url, label: url });
    } catch {
      setLoadError(t('downloadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const reset = (): void => {
    setSpec(undefined);
    setUrl('');
    setBaseUrl('');
    setLoadError(undefined);
    setSelected(new Set());
  };

  const tools = result?.ok === true ? result.value.tools : [];
  const chosen = tools.filter((tool) => selected.has(tool.name));
  const needsBaseUrl = result?.ok === false && result.errors.some((error) => error.startsWith('servers:'));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <FileUpIcon data-icon="inline-start" aria-hidden="true" />
        {t('open')}
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-4">
          <FieldGroup>
            <Field>
              <FieldLabel>{t('file')}</FieldLabel>
              <input
                ref={fileInput}
                type="file"
                accept=".json,.yaml,.yml,application/json,application/yaml"
                className="sr-only"
                tabIndex={-1}
                aria-label={t('file')}
                onChange={(event) => void chooseFile(event)}
              />
              <Button type="button" variant="outline" className="self-start" onClick={() => fileInput.current?.click()}>
                {t('chooseFile')}
              </Button>
            </Field>
            <form className="flex flex-col gap-2" onSubmit={(event) => void download(event)}>
              <FieldLabel htmlFor={ids.url}>{t('url')}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id={ids.url}
                  type="url"
                  inputMode="url"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://petstore3.swagger.io/api/v3/openapi.json…"
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                  }}
                />
                <Button type="submit" variant="outline" disabled={loading}>
                  {loading ? t('downloading') : t('download')}
                </Button>
              </div>
              {loadError === undefined ? null : (
                <p role="alert" className="text-sm text-destructive">
                  {loadError}
                </p>
              )}
            </form>
          </FieldGroup>

          {spec === undefined ? null : (
            <Field>
              <FieldLabel htmlFor={ids.baseUrl}>{t('baseUrl')}</FieldLabel>
              <Input
                id={ids.baseUrl}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder={result?.ok === true ? result.value.baseUrl : 'https://api.example.com/v1…'}
                value={baseUrl}
                aria-invalid={needsBaseUrl ? true : undefined}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                }}
              />
              <FieldDescription>{t('baseUrlHint')}</FieldDescription>
            </Field>
          )}

          {result?.ok === false ? (
            <Alert variant="destructive">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertDescription>
                <ul>
                  {result.errors.map((error) => (
                    <li key={error}>{needsBaseUrl ? t('needsBaseUrl') : error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {result?.ok === true ? (
            <>
              <FieldSet>
                <FieldLegend variant="label">
                  {t('operations', { title: result.value.title, count: tools.length })}
                </FieldLegend>
                {tools.length > PRESELECTED ? (
                  <FieldDescription>{t('tooMany', { max: PRESELECTED })}</FieldDescription>
                ) : null}
                <ul className="flex flex-col divide-y rounded-lg border">
                  {tools.map((tool) => (
                    <li key={tool.name}>
                      <Field orientation="horizontal" className="items-start px-3 py-2">
                        <Checkbox
                          id={`openapi-${tool.name}`}
                          className="mt-0.5"
                          checked={selected.has(tool.name)}
                          onCheckedChange={(checked) => {
                            setSelected((previous) => {
                              const next = new Set(previous);
                              if (checked) next.add(tool.name);
                              else next.delete(tool.name);
                              return next;
                            });
                          }}
                        />
                        <FieldLabel
                          htmlFor={`openapi-${tool.name}`}
                          className="flex min-w-0 flex-col items-start gap-0.5 font-normal"
                        >
                          <span className="font-mono text-sm" translate="no">
                            {tool.name}
                          </span>
                          <span className="max-w-full truncate font-mono text-xs text-muted-foreground" translate="no">
                            {tool.method ?? 'GET'} {tool.url}
                          </span>
                          {tool.description === undefined ? null : (
                            <span className="text-xs text-muted-foreground">{tool.description}</span>
                          )}
                        </FieldLabel>
                      </Field>
                    </li>
                  ))}
                </ul>
              </FieldSet>
              {result.value.skipped.length > 0 ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    {t('skipped', { count: result.value.skipped.length })}
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
                    {result.value.skipped.map(({ operation, reason }) => (
                      <li key={operation}>
                        <span className="font-mono" translate="no">
                          {operation}
                        </span>
                        : {reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {result.value.warnings.length > 0 ? (
                <Alert className="border-warning/40 text-warning">
                  <TriangleAlertIcon aria-hidden="true" />
                  <AlertDescription className="text-warning">
                    <ul>
                      {result.value.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t('cancel')}</DialogClose>
          <Button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => {
              onImport(chosen);
              setOpen(false);
              reset();
            }}
          >
            {t('add', { count: chosen.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
