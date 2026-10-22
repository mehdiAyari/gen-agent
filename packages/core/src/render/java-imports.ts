/**
 * Records the types a Java template actually writes, so the import block contains exactly what the rendered file uses.
 * Templates call `type('fully.qualified.Name')`, which prints the simple name.
 */
export class JavaImports {
  private readonly imports = new Set<string>();
  private readonly staticImports = new Set<string>();
  /** Simple name → qualified name already imported (or implicitly visible). */
  private readonly bySimpleName = new Map<string, string>();

  constructor(private readonly filePackage: string) {}

  /** Prints the simple name of `qualifiedName` and imports it, or prints it qualified when the simple name is taken. */
  type(qualifiedName: string): string {
    const simpleName = qualifiedName.slice(qualifiedName.lastIndexOf('.') + 1);
    const owner = qualifiedName.slice(0, qualifiedName.lastIndexOf('.'));
    const known = this.bySimpleName.get(simpleName);
    if (known !== undefined) return known === qualifiedName ? simpleName : qualifiedName;

    this.bySimpleName.set(simpleName, qualifiedName);
    if (owner !== this.filePackage && owner !== 'java.lang') this.imports.add(qualifiedName);
    return simpleName;
  }

  /** Prints a static member (`org.Foo.bar` → `bar`) and imports it statically. */
  staticImport(qualifiedMember: string): string {
    this.staticImports.add(qualifiedMember);
    return qualifiedMember.slice(qualifiedMember.lastIndexOf('.') + 1);
  }

  /** Import statements, unordered: prettier-plugin-java sorts them. */
  statements(): string {
    return [
      ...[...this.staticImports].map((name) => `import static ${name};`),
      ...[...this.imports].map((name) => `import ${name};`),
    ].join('\n');
  }
}
