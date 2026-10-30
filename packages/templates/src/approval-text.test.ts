import { describe, expect, it } from 'vitest';

interface Call {
  tool: string;
  arguments: string;
}

// The chat page of the generated agents: plain JavaScript, served as it is, hence untyped.
const { describeCall } = (await import(new URL('../minimal/static/approval-text.js', import.meta.url).href)) as {
  describeCall: (approval: Call) => { tool: string; arguments: string[] };
};

describe('the approval card of the chat page', () => {
  it('names the tool as agent.yaml does and lists its arguments', () => {
    expect(describeCall({ tool: 'sendTransfer', arguments: '{"iban":"FR76 3000 6000","amount":120}' })).toEqual({
      tool: 'send-transfer',
      arguments: ['iban: FR76 3000 6000', 'amount: 120'],
    });
  });

  it('shows nested values as JSON and arguments it cannot read as they are', () => {
    expect(describeCall({ tool: 'book', arguments: '{"days":["2026-11-06"],"note":null}' }).arguments).toEqual([
      'days: ["2026-11-06"]',
      'note: null',
    ]);
    expect(describeCall({ tool: 'book', arguments: 'not json' }).arguments).toEqual(['not json']);
  });
});
