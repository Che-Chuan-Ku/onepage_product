# ============================================
# Stage 1: Build Backend (Spring Boot 3.2 / Java 21)
# ============================================
FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /build

COPY backend/pom.xml ./pom.xml
RUN mvn dependency:go-offline -B

COPY backend/src ./src
RUN mvn package -DskipTests -B && \
    cp target/product-*.jar target/app.jar

# ============================================
# Stage 2: Build Frontend (Next.js 14)
# ============================================
FROM node:18-alpine AS frontend-build
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

ENV NEXT_PUBLIC_MOCK_ENABLED=false
ENV NEXT_PUBLIC_API_BASE_URL=
RUN mkdir -p public && npm run build

# ============================================
# Stage 3: Runtime
# ============================================
FROM eclipse-temurin:21-jre-jammy

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      nginx supervisor curl gettext-base ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy backend JAR
COPY --from=backend-build /build/target/app.jar /app/backend.jar

# Copy frontend standalone build
COPY --from=frontend-build /build/.next/standalone /app/frontend
COPY --from=frontend-build /build/.next/static /app/frontend/.next/static
COPY --from=frontend-build /build/public /app/frontend/public

# Copy deployment configs
COPY deploy/nginx.conf.template /etc/nginx/nginx.conf.template
COPY deploy/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY deploy/start.sh /app/start.sh
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

EXPOSE 10000

CMD ["/app/start.sh"]
