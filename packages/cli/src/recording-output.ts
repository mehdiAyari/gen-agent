import type { Output } from './commands.js';

/** Collects what a command prints, for the tests. */
export class RecordingOutput implements Output {
  readonly lines: string[] = [];
  info(message: string): void {
    this.lines.push(`info: ${message}`);
  }
  warn(message: string): void {
    this.lines.push(`warn: ${message}`);
  }
  error(message: string): void {
    this.lines.push(`error: ${message}`);
  }
  text(): string {
    return this.lines.join('\n');
  }
}
