'use client';

import type { FileOwner, GeneratedFile } from '@gen-agent/core';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { cn } from '@/lib/utils';

const OWNERS: readonly FileOwner[] = ['user', 'merged', 'generated'];

/** The same two colors everywhere: yours (leaf), gen-agent's (steel); shared files carry both. */
const DOT: Record<FileOwner, string> = {
  user: 'bg-owned',
  merged: 'bg-[linear-gradient(90deg,var(--owned)_50%,var(--generated)_50%)]',
  generated: 'bg-generated',
};

function OwnerDot({ owner }: { owner: FileOwner }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full', DOT[owner])} />;
}

/** Files grouped by directory (with its trailing slash), root files first, in path order. */
function directoriesOf(files: GeneratedFile[]): [string, GeneratedFile[]][] {
  const groups = new Map<string, GeneratedFile[]>();
  for (const file of files) {
    const directory = file.path.slice(0, file.path.lastIndexOf('/') + 1);
    groups.set(directory, [...(groups.get(directory) ?? []), file]);
  }
  return [...groups].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
}

interface FilesViewProps {
  files: GeneratedFile[];
  pending: boolean;
}

export function FilesView({ files, pending }: FilesViewProps) {
  const t = useTranslations('generator.preview');
  const [chosen, setChosen] = useState<string>();
  // The chosen file may disappear (a tool was removed): fall back to the README.
  const selected =
    files.find((file) => file.path === chosen) ?? files.find((file) => file.path === 'README.md') ?? files[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" aria-busy={pending}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 text-xs text-muted-foreground">
        {OWNERS.map((owner) => (
          <li key={owner} className="flex items-center gap-1.5">
            <OwnerDot owner={owner} />
            {t(`ownerHint.${owner}`)}
          </li>
        ))}
      </ul>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,12rem)_minmax(0,1fr)] border-t md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1">
        <nav aria-label={t('fileList')} className="min-h-0 overflow-y-auto border-b py-2 md:border-r md:border-b-0">
          <ul>
            {directoriesOf(files).map(([directory, entries]) => (
              <li key={directory}>
                {directory === '' ? null : (
                  // Long Java paths are cut at the start: the end of a directory says the most.
                  <span
                    dir="rtl"
                    title={directory}
                    className="block truncate px-4 pt-2 pb-0.5 text-left font-mono text-[0.7rem] text-muted-foreground"
                  >
                    <bdi dir="ltr">{directory}</bdi>
                  </span>
                )}
                <ul>
                  {entries.map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        title={file.path}
                        aria-current={file === selected ? 'true' : undefined}
                        onClick={() => {
                          setChosen(file.path);
                        }}
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2 py-1 pr-4 text-left font-mono text-xs hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-[current]:bg-accent aria-[current]:font-semibold',
                          directory === '' ? 'pl-4' : 'pl-6',
                        )}
                      >
                        <OwnerDot owner={file.owner} />
                        <span className="min-w-0 truncate">{file.path.slice(directory.length)}</span>
                        <span className="sr-only">({t(`owner.${file.owner}`)})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
        {selected === undefined ? null : (
          <section aria-label={selected.path} className="flex min-h-0 flex-col">
            <header className="flex items-center justify-between gap-3 border-b px-4 py-2">
              <h3 className="min-w-0 truncate font-mono text-xs">{selected.path}</h3>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <OwnerDot owner={selected.owner} />
                {t(`owner.${selected.owner}`)}
              </span>
            </header>
            <pre
              tabIndex={0}
              className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <code>{selected.content}</code>
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
