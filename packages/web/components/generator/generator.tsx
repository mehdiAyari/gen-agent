'use client';

import { CopyIcon, DownloadIcon, FileDownIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useMemo, useReducer, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';

import { formFromYaml, formToYaml, validateForm } from '@/lib/agent-form';
import { saveFile } from '@/lib/download';
import { cliCommand, generatorReducer, initialGeneratorState } from '@/lib/generator-state';
import { useProjectFiles } from '@/lib/use-project-files';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { AgentFields } from './agent-fields';
import { FilesView } from './files-view';

// CodeMirror is only needed once the YAML tab is shown: kept out of the first load.
const YamlEditor = dynamic(() => import('./yaml-editor'), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted/40" />,
});

/** Form fields that show their own error; any other error is listed under the form. */
const SHOWN_ON_FIELD =
  /^(name|description|package|provider|model|temperature|maxTokens|systemPromptPath|memoryWindow|tools\.\d+\.(name|description|url|params)|tools\.\d+\.params\.\d+\.(name|description))$/;

type Tab = 'yaml' | 'files';

export function Generator() {
  const t = useTranslations('generator');
  const [state, dispatch] = useReducer(generatorReducer, undefined, initialGeneratorState);
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [tab, setTab] = useState<Tab>('files');
  const [downloading, setDownloading] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  const { form } = state;
  const validation = useMemo(() => validateForm(form), [form]);
  const project = useProjectFiles(form);
  const errorCount = Object.keys(validation.errors).length;

  // An error shows once its field was visited, or everywhere after a download attempt; choices show theirs at once.
  const errorOf = (path: string): string | undefined =>
    showAllErrors || visited.has(path) || path === 'provider' ? validation.errors[path] : undefined;
  const otherErrors = Object.entries(validation.errors).filter(([path]) => !SHOWN_ON_FIELD.test(path));

  const revealErrors = (): void => {
    setShowAllErrors(true);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus());
  };

  const download = async (): Promise<void> => {
    if (errorCount > 0) {
      revealErrors();
      return;
    }
    setDownloading(true);
    try {
      const { projectZip } = await import('@/lib/project-zip');
      const zip = await projectZip(form);
      if (zip.ok) saveFile(zip.fileName, zip.bytes as Uint8Array<ArrayBuffer>, 'application/zip');
      else toast.error(t('actions.downloadFailed'), { description: zip.errors.join('\n') });
    } finally {
      setDownloading(false);
    }
  };

  const copyCli = async (): Promise<void> => {
    if (errorCount > 0) {
      revealErrors();
      return;
    }
    await navigator.clipboard.writeText(cliCommand(formToYaml(form)));
    toast.success(t('actions.copied'));
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    const text = await file.text();
    dispatch({ type: 'yaml', text });
    if (formFromYaml(text).ok) {
      toast.success(t('actions.imported', { file: file.name }));
    } else {
      toast.error(t('actions.importFailed', { file: file.name }));
      setTab('yaml');
    }
  };

  return (
    <>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-6">
          <AgentFields
            form={form}
            errorOf={errorOf}
            onChange={(changed) => {
              dispatch({ type: 'form', form: changed });
            }}
            onVisit={(path) => {
              setVisited((previous) => (previous.has(path) ? previous : new Set(previous).add(path)));
            }}
          />
          {otherErrors.length > 0 && showAllErrors ? (
            <Alert variant="destructive">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertDescription>
                <ul>
                  {otherErrors.map(([path, message]) => (
                    <li key={path}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {validation.warnings.length > 0 ? (
            <Alert id="warnings" className="border-warning/40 text-warning">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertDescription className="text-warning">
                <ul>
                  {validation.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <section
          aria-label={t('preview.label')}
          className="flex h-[min(80dvh,52rem)] flex-col overflow-hidden rounded-xl border bg-card lg:sticky lg:top-6"
        >
          <Tabs
            value={tab}
            onValueChange={(value: Tab) => {
              setTab(value);
            }}
            className="flex min-h-0 flex-1 flex-col gap-3 pt-3"
          >
            <TabsList className="mx-4">
              <TabsTrigger value="files">{t('preview.files')}</TabsTrigger>
              <TabsTrigger value="yaml" className="font-mono">
                {t('preview.yaml')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="files" className="flex min-h-0 flex-1 flex-col">
              {project.result?.ok === true ? (
                <FilesView files={project.result.files} pending={project.pending} />
              ) : (
                <p className="px-4 text-sm text-muted-foreground" aria-live="polite">
                  {project.result === undefined || errorCount === 0 ? t('preview.generating') : t('preview.fixErrors')}
                </p>
              )}
            </TabsContent>
            <TabsContent value="yaml" className="flex min-h-0 flex-1 flex-col gap-3 border-t">
              {state.yamlErrors.length > 0 ? (
                <Alert variant="destructive" className="mx-4 mt-3 w-auto">
                  <TriangleAlertIcon aria-hidden="true" />
                  <AlertDescription>
                    <p>{t('preview.yamlInvalid')}</p>
                    <ul className="font-mono text-xs">
                      {state.yamlErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              <YamlEditor
                value={state.yaml}
                label={t('preview.editorLabel')}
                onChange={(text) => {
                  dispatch({ type: 'yaml', text });
                }}
              />
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <div
        role="region"
        aria-label={t('actions.label')}
        className="sticky bottom-0 z-10 -mx-6 mt-10 flex flex-wrap items-center gap-2 sm:gap-3 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <p aria-live="polite" className="mr-auto flex items-center gap-4 text-sm">
          {errorCount > 0 ? (
            <button
              type="button"
              onClick={revealErrors}
              className="text-destructive underline-offset-4 hover:underline"
            >
              {t('actions.errors', { count: errorCount })}
            </button>
          ) : (
            <span className="text-owned">{t('actions.errors', { count: 0 })}</span>
          )}
          {validation.warnings.length > 0 ? (
            <a href="#warnings" className="text-warning underline-offset-4 hover:underline">
              {t('actions.warnings', { count: validation.warnings.length })}
            </a>
          ) : null}
        </p>
        <input
          ref={importInput}
          type="file"
          accept=".yaml,.yml,application/yaml,text/yaml"
          className="sr-only"
          tabIndex={-1}
          aria-label={t('actions.importLabel')}
          onChange={(event) => void importFile(event)}
        />
        <Button type="button" variant="ghost" onClick={() => importInput.current?.click()}>
          <UploadIcon data-icon="inline-start" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('actions.import')}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            saveFile('agent.yaml', formToYaml(form), 'application/yaml');
          }}
        >
          <FileDownIcon data-icon="inline-start" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('actions.export')}</span>
        </Button>
        <Button type="button" variant="outline" onClick={() => void copyCli()}>
          <CopyIcon data-icon="inline-start" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('actions.copyCli')}</span>
        </Button>
        <Button type="button" size="lg" disabled={downloading} onClick={() => void download()}>
          <DownloadIcon data-icon="inline-start" aria-hidden="true" />
          {downloading ? t('actions.downloading') : t('actions.download')}
        </Button>
      </div>
      <Toaster />
    </>
  );
}
