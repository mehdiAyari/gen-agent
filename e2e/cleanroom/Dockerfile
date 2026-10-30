# A machine with only what the README asks for: Java 21 and Node 22. No Maven, no unzip, no gen-agent sources.
FROM eclipse-temurin:21-jdk
RUN apt-get update -qq && apt-get install -y -qq curl ca-certificates xz-utils >/dev/null \
    && curl -fsSL https://nodejs.org/dist/v22.23.4/node-v22.23.4-linux-x64.tar.xz | tar -xJ -C /opt \
    && useradd -m dev
ENV PATH=/opt/node-v22.23.4-linux-x64/bin:$PATH
COPY gen-agent-*.tgz /tmp/
RUN npm install -g /tmp/gen-agent-*.tgz >/dev/null 2>&1 && rm /tmp/gen-agent-*.tgz
USER dev
WORKDIR /home/dev
