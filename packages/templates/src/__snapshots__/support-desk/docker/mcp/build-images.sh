#!/bin/sh
# Builds the images of the MCP servers the agent starts in containers: run it once, and after each new version.
set -e
cd "$(dirname "$0")"
docker build --tag support-desk-mcp-time:2026.10.19 time
