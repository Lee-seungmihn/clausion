# ── Stage 1: Build ───────────────────────────────────
FROM gradle:8-jdk17 AS builder

WORKDIR /app

# Copy gradle config first for caching
COPY build.gradle settings.gradle ./
COPY gradle ./gradle

# Download dependencies (cached layer)
RUN gradle dependencies --no-daemon || true

# Force no-cache: v7
COPY src ./src
RUN gradle bootJar --no-daemon -x test && ls -la build/libs/

# ── Stage 2: Runtime ─────────────────────────────────
FROM eclipse-temurin:17-jre-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/build/libs/classpulse-0.0.1-SNAPSHOT.jar app.jar

RUN chown appuser:appgroup app.jar
USER appuser

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java -Dapp.jwt.secret=${JWT_SECRET:-default-secret-key-change-in-production-must-be-at-least-256-bits-long} -Dapp.jwt.expiration=${JWT_EXPIRATION:-86400000} -jar app.jar"]
