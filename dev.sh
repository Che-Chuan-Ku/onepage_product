#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
# gomoku 開發環境一鍵管理：後端(docker compose: backend+PG+Redis) + 前端(Next dev)
#
#   ./dev.sh up        啟動前後端（後端 compose + 前端 dev server，接真後端、關 MSW）
#   ./dev.sh up --build 啟動並重建後端映像（改過 backend 程式碼後用）
#   ./dev.sh down      關閉前後端（保留 PG 資料）
#   ./dev.sh down --clean  關閉並清掉 PG/Redis 資料卷
#   ./dev.sh restart   先 down 再 up
#   ./dev.sh status    顯示前後端狀態
#   ./dev.sh logs      跟看前端 dev log（Ctrl+C 離開，不會關 server）
#   ./dev.sh blogs     跟看後端 compose log
# ────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="$ROOT/integration-test/docker-compose.fullstack.yml"
FRONTEND="$ROOT/frontend"
RUN_DIR="$ROOT/integration-test/.dev"
PID_FILE="$RUN_DIR/frontend.pid"
LOG_FILE="$RUN_DIR/frontend.log"

BACKEND_ORIGIN="http://127.0.0.1:18080"
BACKEND_HEALTH="$BACKEND_ORIGIN/api/gmk/v1/leaderboard"
FRONTEND_URL="http://localhost:3000"

c_grn=$'\033[32m'; c_red=$'\033[31m'; c_dim=$'\033[2m'; c_rst=$'\033[0m'
info() { echo "${c_dim}» $*${c_rst}"; }
ok()   { echo "${c_grn}✓ $*${c_rst}"; }
err()  { echo "${c_red}✗ $*${c_rst}" >&2; }

mkdir -p "$RUN_DIR"

# ── 等待某個 HTTP 端點回 200（最多 N 秒）──
wait_http() {
  local url="$1" name="$2" tries="${3:-60}"
  info "等待 $name ($url) …"
  for ((i = 0; i < tries; i++)); do
    if curl -fs -o /dev/null "$url" 2>/dev/null; then ok "$name 就緒"; return 0; fi
    sleep 1
  done
  err "$name 逾時未就緒"; return 1
}

frontend_pid() {
  # 優先用 pid 檔，否則查 :3000
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    cat "$PID_FILE"; return 0
  fi
  lsof -ti:3000 2>/dev/null | head -1
}

# ── 啟動 ──
cmd_up() {
  local build_flag=""
  [[ "${1:-}" == "--build" ]] && build_flag="--build"

  info "啟動後端 compose（backend + PostgreSQL + Redis）$build_flag"
  docker compose -f "$COMPOSE" up -d $build_flag
  wait_http "$BACKEND_HEALTH" "後端 API" 90

  if [[ -n "$(frontend_pid)" ]]; then
    ok "前端已在執行（:3000），略過"
  else
    info "啟動前端 Next dev（接真後端、關 MSW、STOMP 直連後端 /ws）"
    ( cd "$FRONTEND" && \
      NEXT_PUBLIC_API_MOCKING=disabled BACKEND_ORIGIN="$BACKEND_ORIGIN" \
      NEXT_PUBLIC_WS_ENDPOINT="$BACKEND_ORIGIN/ws" \
      nohup npm run dev >"$LOG_FILE" 2>&1 & echo $! >"$PID_FILE" )
    wait_http "$FRONTEND_URL" "前端" 60
  fi

  echo
  ok "前後端已啟動"
  echo "   前端  $FRONTEND_URL"
  echo "   後端  $BACKEND_ORIGIN"
  echo "   前端 log: $LOG_FILE  （./dev.sh logs 跟看）"
}

# ── 關閉 ──
cmd_down() {
  local pid; pid="$(frontend_pid)"
  if [[ -n "$pid" ]]; then
    info "關閉前端 dev (pid $pid)"
    # Next dev 會 fork 子行程，連同行程樹一起收
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    sleep 1
    lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
    rm -f "$PID_FILE"
    ok "前端已關閉"
  else
    info "前端未在執行"
  fi

  if [[ "${1:-}" == "--clean" ]]; then
    info "關閉後端 compose 並清除資料卷"
    docker compose -f "$COMPOSE" down -v
  else
    info "關閉後端 compose（保留 PG 資料）"
    docker compose -f "$COMPOSE" down
  fi
  ok "後端已關閉"
}

# ── 狀態 ──
cmd_status() {
  echo "── 後端 compose ──"
  docker compose -f "$COMPOSE" ps 2>/dev/null || echo "（compose 未啟動）"
  echo
  echo "── 前端 ──"
  local pid; pid="$(frontend_pid)"
  if [[ -n "$pid" ]]; then
    if curl -fs -o /dev/null "$FRONTEND_URL" 2>/dev/null; then
      ok "前端 running (pid $pid) → $FRONTEND_URL"
    else
      err "前端 pid $pid 存在但 :3000 沒回應（可能還在啟動或卡住）"
    fi
  else
    info "前端未在執行"
  fi
  echo
  echo "── 後端 API ──"
  if curl -fs -o /dev/null "$BACKEND_HEALTH" 2>/dev/null; then
    ok "後端 API → $BACKEND_ORIGIN"
  else
    err "後端 API 沒回應"
  fi
}

case "${1:-}" in
  up)      shift; cmd_up "${1:-}" ;;
  down)    shift; cmd_down "${1:-}" ;;
  restart) cmd_down ""; echo; cmd_up "${2:-}" ;;
  status)  cmd_status ;;
  logs)    info "跟看前端 log（Ctrl+C 離開，不會關 server）"; touch "$LOG_FILE"; tail -f "$LOG_FILE" ;;
  blogs)   docker compose -f "$COMPOSE" logs -f ;;
  *)
    grep -E '^#( |─| )' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
