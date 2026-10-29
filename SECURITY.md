# Security policy

gen-agent generates code that handles credentials, personal data and model output, so security reports are welcome,
about the generator or about the projects it generates.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through
[GitHub security advisories](https://github.com/mehdiAyari/gen-agent/security/advisories/new), with the version of
gen-agent, the `agent.yaml` involved (without secrets) and the steps to reproduce. You will get an answer within a
week.

## Supported versions

Only the latest release is supported. Generated projects pin their dependencies: run `gen-agent update` to get the
fixes of a new release.

## Known limits

Prompt injection detection and PII masking reduce risks without removing them: see the known limits in
[the specification](docs/specification.md#known-limits).
