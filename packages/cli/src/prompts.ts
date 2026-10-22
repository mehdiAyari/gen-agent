import { cancel, confirm, isCancel, select, text } from '@clack/prompts';

import { PROVIDERS, SUGGESTED_MODELS, type Provider } from '@gen-agent/core';

import type { NewAnswers, NewTool } from './commands.js';

const PROVIDER_HINTS: Record<Provider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  mistral: 'hosted in the EU, MISTRAL_API_KEY',
  ollama: 'self-hosted, no API key',
};

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

class Cancelled extends Error {}

/** Returns the value, or stops the command when the user presses Ctrl+C. */
function answer<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel('Cancelled: nothing was written.');
    throw new Cancelled();
  }
  return value as Exclude<T, symbol>;
}

/** Asks the questions of `gen-agent new`. Returns undefined when the user cancels. */
export async function askNewAnswers(name: string): Promise<Omit<NewAnswers, 'profile'> | undefined> {
  try {
    const description = answer(
      await text({ message: 'What does the agent do?', placeholder: 'Optional, e.g. Answers HR questions' }),
    );
    const provider = answer(
      await select<Provider>({
        message: 'Model provider',
        options: PROVIDERS.map((value) => ({ value, label: value, hint: PROVIDER_HINTS[value] })),
      }),
    );
    const model = answer(await text({ message: 'Model name', initialValue: SUGGESTED_MODELS[provider] }));
    const javaPackage = answer(
      await text({ message: 'Java package', initialValue: `com.example.${name.replaceAll('-', '')}` }),
    );

    const tools: NewTool[] = [];
    while (
      answer(await confirm({ message: tools.length === 0 ? 'Add a tool?' : 'Add another tool?', initialValue: false }))
    ) {
      tools.push(await askTool(tools.map((tool) => tool.name)));
    }

    return { name, ...(description ? { description } : {}), provider, model, package: javaPackage, tools };
  } catch (error) {
    if (error instanceof Cancelled) return undefined;
    throw error;
  }
}

async function askTool(taken: string[]): Promise<NewTool> {
  const name = answer(
    await text({
      message: 'Tool name (kebab-case)',
      validate: (value) =>
        !value || !KEBAB.test(value)
          ? 'Use kebab-case, e.g. order-status'
          : taken.includes(value)
            ? 'Already used'
            : undefined,
    }),
  );
  const type = answer(
    await select<'http' | 'java'>({
      message: 'Kind of tool',
      options: [
        { value: 'http', label: 'http', hint: 'calls a REST endpoint' },
        { value: 'java', label: 'java', hint: 'you implement it in Java' },
      ],
    }),
  );
  const description = answer(
    await text({
      message: 'What does it do? (the model reads this)',
      validate: (value) => (value ? undefined : 'Required'),
    }),
  );
  if (type === 'java') return { name, type, description };
  const url = answer(
    await text({
      message: 'Endpoint URL',
      validate: (value) => (value && /^https?:\/\//.test(value) ? undefined : 'An http(s) URL'),
    }),
  );
  return { name, type, description, url };
}
