# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org).

## [0.1.0] — unreleased

### Added

- `agent.yaml` schema covering the whole specification, with errors located by line, secret detection, EU-only providers,
  exact MCP versions and warnings for tools with side effects; JSON Schema for editors.
- `minimal` profile: Spring Boot 4.1.1, Spring AI 2.0.1, Java 21, Maven Wrapper; chat client with a system prompt file and
  windowed memory, `POST /api/chat`, HTTP tools (RestClient) and Java tools (handler you implement), AI disclosure flag.
- Generated tests with a fake model: the generated project passes `./mvnw verify` without calling a provider.
- `.gen-agent.json`: configuration, owner and fingerprint of every generated file.
- CLI: `gen-agent new` (interactive) and `gen-agent generate --from agent.yaml`.
