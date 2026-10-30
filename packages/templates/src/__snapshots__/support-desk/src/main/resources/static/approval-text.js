// How the chat page shows a tool call that waits for approval: the tool by its name in agent.yaml, then its
// arguments, one per line.

/** sendTransfer → send-transfer; arguments as "name: value" lines, or as they are when they are not JSON. */
export function describeCall(approval) {
  const tool = approval.tool.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  try {
    const values = JSON.parse(approval.arguments);
    return {
      tool,
      arguments: Object.entries(values).map(
        ([name, value]) => `${name}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
      ),
    };
  } catch {
    return { tool, arguments: [approval.arguments] };
  }
}
