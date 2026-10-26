# The MCP server time, installed at build time: it runs without the network,
# as a user without privileges, on a read-only file system.
FROM astral/uv:0.13.5-python3.13-alpine
RUN adduser -D -u 10001 mcp
USER mcp
ENV UV_TOOL_DIR=/home/mcp/tools UV_TOOL_BIN_DIR=/home/mcp/bin
# The command of the package, at a known path.
RUN uv tool install mcp-server-time==2026.10.19 && ln -s "$(ls /home/mcp/bin/* | head -n 1)" /home/mcp/start
