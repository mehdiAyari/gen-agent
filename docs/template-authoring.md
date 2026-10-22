---
name: template-authoring
description: >
  Use when writing or changing anything that produces code in a generated project: EJS templates in
  packages/templates, the render pipeline in packages/core, or the reference snapshots. The generated
  Java must read as if a good Spring developer wrote it by hand — sorted imports, no dead code, useful
  comments, no trace of templating.
---

# Template authoring

The generated project is the product. A reviewer opening any generated file must not be able to tell it
came out of a template. Read this before touching `packages/templates/**` or the renderer in `packages/core`.

## The bar

Ask of every generated file: *would a senior Spring developer have written exactly this by hand?*

- Constructor injection only, `final` fields, no `@Autowired` on fields.
- Records for DTOs and for `@ConfigurationProperties`.
- Configuration values come from `@ConfigurationProperties` or `application.yml`, never literals scattered in classes.
- Prompts live in resource files (`prompts/*.md`), never in Java strings.
- Package-private by default; `public` only when another package needs it.
- One responsibility per class; controllers delegate, they hold no logic.

## Imports

- Never write an import line by hand in a template. Templates declare the types they use; the renderer
  collects them, removes duplicates and unused ones, and sorts them.
- Order: one block, lexicographic (`com.`, `jakarta.`, `java.`, `org.` …), then static imports in a
  separate block. No wildcard imports. No import of a type from the same package or `java.lang`.
- A conditional feature that adds a type adds its import through the same mechanism, so turning the
  feature off removes the import too.

## No dead code

- No unused imports, fields, parameters, methods, beans, properties or dependencies in `pom.xml`.
- A disabled option produces **nothing**: no empty method, no commented-out block, no `if (false)`, no
  property set to its default value.
- No `TODO` in generated-owned files. A user-owned scaffold may contain exactly one clear instruction
  for the developer (what to implement and where), nothing else.
- Every dependency in `pom.xml` is used by the generated code or its tests.

## Comments

- Comments explain *why* or point the developer to the next step; they never paraphrase the code.
- Javadoc on public types of the generated API (what the type is for, how to extend it).
- Generated-owned files start with one short ownership note so the developer knows not to edit them
  (example: `// Managed by gen-agent: changes here are overwritten. Extend PoserCongeToolBase instead.`).
  That note is the only allowed reference to the generator. No banners, dates, versions or hashes in
  source files — fingerprints belong in `.gen-agent.json`.
- Language of generated code and comments: English.

## No trace of templating

- No EJS artifacts: no `<%`, no `%>`, no unresolved placeholder, no `undefined`/`null`/`[object Object]`.
- Whitespace: use `<%_ … _%>` and `-%>` so control lines leave no blank line; never two consecutive blank
  lines; files end with a single newline.
- No mechanical names (`tool1`, `myTool_Tool`, `GeneratedClass`). Names are derived by `core`
  (`poser-conge` → `PoserCongeTool`, `poserConge`), never computed inside templates.
- No logic in templates beyond `if`/`for` over the normalized model. Naming, defaults, escaping and
  validation happen in `core`, where they are unit-tested.
- Values inserted into Java or YAML are escaped by `core` helpers (string literals, YAML scalars).

## Formatting

Java output goes through **prettier-plugin-java** after rendering (project decision — no Spotless, no
other formatter in the generator). Do not hand-align code in templates; write it plainly and let the
formatter decide. Non-Java files (`pom.xml`, `application.yml`, Markdown) are formatted by their template
and checked by snapshots.

## Generated vs user code

- Generated-owned code lives in the dedicated `…generated` package and is rewritten on every generation.
- User-owned code (implementations of Java tools, the system prompt) is created once and never rewritten.
  The user extends generated base classes; they never edit generated files.
- Every written file is recorded in `.gen-agent.json` with its owner and fingerprint.

## Checklist before committing a template change

1. Snapshot tests updated, and every changed snapshot read line by line as a code reviewer would.
2. Each option toggled on and off leaves no trace when off (imports, beans, properties, dependencies).
3. The E2E reference projects pass `mvn verify`.
4. Search the generated output: no `TODO` in generated-owned files, no `<%`, no blank-line pairs, no unused import.
