#!/bin/bash
# Self-contained capacity run: throwaway API (built-in Better Auth) + throwaway Mongo database, k6 in Docker.
# Nothing here touches staging, production, fal.ai or any real database. See README.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/scripts/load"
API_PORT="${API_PORT:-4101}"
MONGO_CONTAINER="${MONGO_CONTAINER:-dev-mongodb}"
DB_NAME="tandra_k6"
RUN_DIR="$HERE/results/$(date +%Y%m%d-%H%M%S)"

# Mongo connection: explicit override, else the dev connection string from .env, else the CI default.
MONGO_URI="${K6_MONGO_URI:-$(grep -E '^CONNECTION_URI=' "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)}"
MONGO_URI="${MONGO_URI:-mongodb://devuser:devpassword@localhost:27017/?authSource=admin}"
case "$MONGO_URI" in
    *localhost*|*127.0.0.1*) ;;
    *) echo "refusing: Mongo URI must point at localhost (got a non-local host)" >&2; exit 1 ;;
esac

mkdir -p "$RUN_DIR"
chmod 777 "$RUN_DIR" # the k6 container runs as an unprivileged user

PIDS=()
cleanup() {
    set +e
    for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
    docker rm -f tandra-k6 >/dev/null 2>&1
    docker exec "$MONGO_CONTAINER" sh -c \
        "mongosh -u \"\$MONGO_INITDB_ROOT_USERNAME\" -p \"\$MONGO_INITDB_ROOT_PASSWORD\" --authenticationDatabase admin --quiet $DB_NAME --eval 'db.dropDatabase()'" \
        >/dev/null 2>&1 && echo "dropped throwaway database $DB_NAME"
}
trap cleanup EXIT

# env -i: the API gets only what is listed here, so a developer's FAL_KEY / GEMINI_API_KEY etc. can never reach it.
(cd "$ROOT/packages/api" && env -i PATH="$PATH" HOME="$HOME" \
    PORT="$API_PORT" \
    BETTER_AUTH_SECRET=k6-load-better-auth-secret-not-for-prod BETTER_AUTH_URL=http://localhost:4000 \
    CONNECTION_URI="$MONGO_URI" DATABASE_NAME="$DB_NAME" \
    BUCKET_ENDPOINT=localhost:9000 BUCKET_NAME=tandra BUCKET_ACCESS_KEY=rustfsadmin BUCKET_SECRET_KEY=rustfsadmin \
    OPENSEARCH_URL= bun src/index.ts) >"$RUN_DIR/api.log" 2>&1 &
PIDS+=($!)

for _ in $(seq 1 60); do
    curl -sf "http://localhost:$API_PORT/api/health" >/dev/null && break
    sleep 1
done
curl -sf "http://localhost:$API_PORT/api/health" >/dev/null || { echo "API did not come up, see $RUN_DIR/api.log" >&2; exit 1; }

# Container CPU (Mongo + k6 itself) every 5s, to tell API-bound from Mongo-bound from generator-bound.
(while true; do
    docker stats --no-stream --format "$(date +%s),{{.Name}},{{.CPUPerc}}" "$MONGO_CONTAINER" tandra-k6 2>/dev/null || true
    sleep 5
done) >"$RUN_DIR/container-cpu.csv" &
PIDS+=($!)

ENV_ARGS=(-e "BASE_URL=http://localhost:$API_PORT" -e "REPORT_DIR=/results")
for var in USERS LISTS_PER_USER ITEMS_PER_LIST BACKGROUND_LISTS MUTATION_SHARE RECIPES_SHARE STEPS STEP_DURATION \
    WARMUP WARMUP_RATE P95_MS ERROR_RATE GATE_RATE PRE_VUS MAX_VUS; do
    [ -n "${!var:-}" ] && ENV_ARGS+=(-e "$var=${!var}")
done

echo "results: $RUN_DIR"
status=0
docker run --rm --name tandra-k6 --network host \
    -v "$HERE:/scripts:ro" -v "$RUN_DIR:/results" "${ENV_ARGS[@]}" \
    grafana/k6:latest run --quiet /scripts/k6-capacity.js || status=$?

echo "--- container CPU while running (peak %, from $RUN_DIR/container-cpu.csv) ---"
for name in "$MONGO_CONTAINER" tandra-k6; do
    awk -F, -v n="$name" '$2==n { gsub("%","",$3); if ($3+0 > m) m=$3+0 } END { printf "%s peak %.0f%% (100%% = 1 core)\n", n, m }' "$RUN_DIR/container-cpu.csv"
done
exit "$status"
