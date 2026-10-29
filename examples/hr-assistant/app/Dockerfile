# Image of the agent: built by docker compose, or with docker build -t hr-assistant .
FROM eclipse-temurin:21.0.12.1_1-jdk-alpine AS build
WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# Dependencies first: they are downloaded again only when pom.xml changes.
RUN ./mvnw --batch-mode --quiet dependency:go-offline
COPY src/ src/
# The tests run with ./mvnw verify, where Docker is available to start their containers.
RUN ./mvnw --batch-mode --quiet package -DskipTests

FROM eclipse-temurin:21.0.12.1_1-jre-alpine
RUN addgroup -S -g 10001 agent && adduser -S -u 10001 -G agent agent
# Numeric, so that Kubernetes can check the container does not run as root.
USER 10001
WORKDIR /app
COPY --from=build /workspace/target/hr-assistant-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
