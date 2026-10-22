'use client';

import { useEffect, useState } from 'react';

import type { AgentForm } from './agent-form';
import type { ProjectFiles } from './project-zip';

export interface ProjectFilesState {
  /** True while files for the latest form are being generated; `result` then shows the previous ones. */
  pending: boolean;
  result: ProjectFiles | undefined;
}

/** Generates the project in the background as the form changes. Templates and Prettier load on first use. */
export function useProjectFiles(form: AgentForm): ProjectFilesState {
  const [state, setState] = useState<ProjectFilesState>({ pending: true, result: undefined });

  useEffect(() => {
    let cancelled = false;
    // Waits for a pause in typing: formatting the Java files takes a moment.
    const timer = setTimeout(() => {
      setState((previous) => ({ ...previous, pending: true }));
      void import('./project-zip')
        .then(({ projectFiles }) => projectFiles(form))
        // A template that fails to render is a bug of gen-agent: show it instead of waiting forever.
        .catch((error: unknown): ProjectFiles => ({
          ok: false,
          errors: [error instanceof Error ? error.message : String(error)],
        }))
        .then((result) => {
          if (!cancelled) setState({ pending: false, result });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form]);

  return state;
}
