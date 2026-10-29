# ADR 0001 — Separate generated code from user code

- Status: accepted (V1)
- Date: 2026-10-22

## Context

gen-agent will regenerate projects: `gen-agent add tool`, `add mcp` and `upgrade` must update a project the developer has
already changed, without losing their work. The specification asks for this to be designed in V1, even though those
commands arrive later: generated code lives in dedicated packages, user code extends it without modifying it, and a
`.gen-agent.json` file stores the configuration and a fingerprint of every generated file.

## Decision

### Three kinds of files

| Owner       | Examples                                                         | On regeneration                                                    |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `generated` | everything under `<basePackage>.generated`                       | rewritten; the developer is told not to edit them                  |
| `merged`    | `pom.xml`, `application.yml`, the application class, `README.md` | three-way merge (later): base, developer's version, new generation |
| `user`      | handler implementations of Java tools, `prompts/system.md`       | created once if missing, never rewritten                           |

Generated-owned Java files start with a one-line note saying they are managed by gen-agent and where to put custom code.

### Java tools: composition, not inheritance

The specification suggests generated base classes extended by the user. For Java tools this cannot work with Spring AI
2.0.1: `MethodToolCallbackProvider` discovers `@Tool` methods with `ReflectionUtils.getDeclaredMethods(targetClass)`,
which ignores inherited methods, so a `@Tool` declared in a generated superclass would never be exposed to the model.

gen-agent therefore generates, for a Java tool `book-leave`:

- `generated/tool/BookLeaveTool` — the `@Component` exposed to the model. It carries `@Tool` and `@ToolParam` with the
  descriptions from `agent.yaml`, and delegates to the handler received through its constructor;
- `generated/tool/BookLeaveHandler` — the interface the developer implements;
- `tool/DefaultBookLeaveHandler` — user-owned `@Component` implementing the interface, created once.

The intent of the specification is kept — the developer never edits generated code, and everything the model sees (names,
descriptions, parameters) stays regenerable from `agent.yaml` — through composition, which is also the more idiomatic
Spring design (constructor injection, no inheritance).

### `.gen-agent.json`

Written at the root of every generated project:

```json
{
  "generator": { "name": "gen-agent", "version": "0.1.0" },
  "config": { "agent": { "name": "hr-assistant", "...": "complete configuration, defaults applied" } },
  "files": {
    "pom.xml": { "owner": "merged", "sha256": "…" },
    "src/main/java/com/example/hrassistant/generated/ChatController.java": { "owner": "generated", "sha256": "…" },
    "src/main/java/com/example/hrassistant/tool/DefaultBookLeaveHandler.java": { "owner": "user", "sha256": "…" }
  }
}
```

- `config` is the configuration with defaults applied, so a later version renders the exact same base files.
- `sha256` is the fingerprint of each file as generated. Comparing it with the file on disk tells whether the developer
  changed it.
- The base of a three-way merge is obtained by rendering `config` with the recorded generator version; the fingerprint
  checks that this re-rendering is identical. No copy of the generated files is stored in the project.
- Paths use `/` and are relative to the project root. Keys are sorted so the file diffs cleanly in version control.

### Regeneration

`gen-agent new` and `gen-agent generate` write into an empty (or new) directory only. `gen-agent add` and
`gen-agent update` regenerate an existing project with the owners and fingerprints above: generated files are
rewritten, user files are kept, and a shared file the user changed gets the new version next to it
(`<file>.gen-agent-new`), never silently overwritten.

## Consequences

- Templates must keep the three owners apart: no user logic in generated files, no generated metadata in user files.
- Changing the name of a generated class is a breaking change for existing projects and must go through `upgrade`.
- The developer needs to know the rule: the generated README explains which packages are theirs.
