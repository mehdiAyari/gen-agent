'use client';

import {
  CopyIcon,
  DownloadIcon,
  FileDownIcon,
  FolderOpenIcon,
  Loader2Icon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';

import { defaultForm, describePath, formFromYaml, formToYaml, validateForm } from '@/lib/agent-form';
import { saveFile } from '@/lib/download';
import { readDraft, writeDraft } from '@/lib/draft';
import { exampleById } from '@/lib/examples';
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
  loading: () => <div className="h-full bg-muted/40 motion-safe:animate-pulse" />,
});

/** Form fields that show their own error; any other error is listed under the form. */
const SHOWN_ON_FIELD =
  /^(name|description|package|provider|model|temperature|maxTokens|systemPromptPath|memoryWindow|rateLimit|tokenBudget|retention|semanticThreshold|maxIterations|timeout|fallbackModel|routingSimple|routingComplex|ragTopK|ragChunkSize|tools\.\d+\.(name|description|url|params|auth\.env|auth\.name|maxResponseChars|approval\.expiresAfter)|tools\.\d+\.params\.\d+\.(name|description|in|apiName)|mcp\.\d+\.(name|package|version|args|env|url|auth\.env|auth\.name))$/;

type Tab = 'yaml' | 'files';

export function Generator() {
  const t = useTranslations('generator');
  const [state, dispatch] = useReducer(generatorReducer, undefined, initialGeneratorState);
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [tab, setTab] = useState<Tab>('files');
  const [downloading, setDownloading] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const restored = useRef(false);

  // The static page starts from the default agent. Once hydrated, it opens the example asked by the gallery
  // (/generator/?example=weather-agent), or else the draft of this tab.
  useEffect(() => {
    const example = exampleById(new URLSearchParams(window.location.search).get('example'));
    if (example !== undefined) {
      dispatch({ type: 'yaml', text: example.yaml });
      // A reload now keeps the edits (the draft) instead of reopening the example.
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      const draft = readDraft();
      if (draft !== undefined) dispatch({ type: 'yaml', text: draft });
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (restored.current) writeDraft(state.yaml);
  }, [state.yaml]);

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
    } catch (error) {
      toast.error(t('actions.downloadFailed'), { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setDownloading(false);
    }
  };

  const copyCli = async (): Promise<void> => {
    if (errorCount > 0) {
      revealErrors();
      return;
    }
    try {
      await navigator.clipboard.writeText(cliCommand(formToYaml(form)));
      toast.success(t('actions.copied'));
    } catch {
      toast.error(t('actions.copyFailed'));
    }
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

  const startOver = (): void => {
    const previous = state.yaml;
    dispatch({ type: 'form', form: defaultForm() });
    setVisited(new Set());
    setShowAllErrors(false);
    toast(t('actions.cleared'), {
      action: {
        label: t('actions.undo'),
        onClick: () => {
          dispatch({ type: 'yaml', text: previous });
        },
      },
    });
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
                    <li key={path}>
                      {describePath(form, path)}: {message}
                    </li>
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
              <TabsTrigger value="yaml" className="font-mono" translate="no">
                {t('preview.yaml')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="files" className="flex min-h-0 flex-1 flex-col">
              <FilesPanel project={project} errorCount={errorCount} />
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
        className="sticky bottom-0 z-10 -mx-6 mt-10 flex flex-wrap items-center gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:gap-3"
      >
        <p aria-live="polite" className="mr-auto flex items-center gap-4 text-sm">
          {errorCount > 0 ? (
            <button
              type="button"
              onClick={revealErrors}
              className="rounded-sm text-destructive underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t('actions.errors', { count: errorCount })}
            </button>
          ) : (
            <span className="text-owned">{t('actions.errors', { count: 0 })}</span>
          )}
          {validation.warnings.length > 0 ? (
            <a
              href="#warnings"
              className="rounded-sm text-warning underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
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
        {/* Below sm the secondary actions show their icon only; the label stays for assistive technologies. */}
        <Button type="button" variant="ghost" title={t('actions.startOver')} onClick={startOver}>
          <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('actions.startOver')}</span>
        </Button>
        <Button type="button" variant="ghost" title={t('actions.import')} onClick={() => importInput.current?.click()}>
          <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('actions.import')}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          title={t('actions.export')}
          onClick={() => {
            saveFile('agent.yaml', formToYaml(form), 'application/yaml');
          }}
        >
          <FileDownIcon data-icon="inline-start" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('actions.export')}</span>
        </Button>
        <Button type="button" variant="outline" title={t('actions.copyCli')} onClick={() => void copyCli()}>
          <CopyIcon data-icon="inline-start" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t('actions.copyCli')}</span>
        </Button>
        <Button type="button" size="lg" disabled={downloading} onClick={() => void download()}>
          {downloading ? (
            <Loader2Icon data-icon="inline-start" aria-hidden="true" className="motion-safe:animate-spin" />
          ) : (
            <DownloadIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {downloading ? t('actions.downloading') : t('actions.download')}
        </Button>
      </div>
      {/* Above the sticky action bar, so that a notification never hides its buttons. */}
      <Toaster offset={{ bottom: '6rem' }} mobileOffset={{ bottom: '8.5rem' }} />
    </>
  );
}

interface FilesPanelProps {
  project: ReturnType<typeof useProjectFiles>;
  errorCount: number;
}

/** The generated files, or why there are none yet. */
function FilesPanel({ project: { pending, result }, errorCount }: FilesPanelProps) {
  const t = useTranslations('generator.preview');

  if (result?.ok === true) return <FilesView files={result.files} pending={pending} />;
  if (result === undefined) {
    return (
      <p className="px-4 text-sm text-muted-foreground" aria-live="polite">
        {t('generating')}
      </p>
    );
  }
  if (errorCount > 0) {
    return (
      <p className="px-4 text-sm text-muted-foreground" aria-live="polite">
        {t('fixErrors')}
      </p>
    );
  }
  return (
    <Alert variant="destructive" className="mx-4 w-auto">
      <TriangleAlertIcon aria-hidden="true" />
      <AlertDescription>
        <p>{t('generationFailed')}</p>
        <ul className="font-mono text-xs">
          {result.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
