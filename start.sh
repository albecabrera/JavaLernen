#!/usr/bin/env bash
# ============================================================
#  JavaLernen — Start-Skript
#  Levanta el server local (PHP built-in) que sirve la app y
#  compila/ejecuta el código Java/Python de los alumnos.
#
#  Uso:   ./start.sh            (puerto 8100 por defecto)
#         ./start.sh 9000       (puerto propio)
# ============================================================
set -euo pipefail

# --- ubicación del script → raíz del proyecto (sirve desde /app) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/app"
HOST="127.0.0.1"
PORT="${1:-8100}"

c_ok()   { printf '\033[0;32m✓\033[0m %s\n' "$1"; }
c_warn() { printf '\033[0;33m!\033[0m %s\n' "$1"; }
c_err()  { printf '\033[0;31m✗\033[0m %s\n' "$1" >&2; }

# --- 1. prerequisitos ---
if ! command -v php >/dev/null 2>&1; then
  c_err "PHP no está instalado. Instalá con: brew install php"
  exit 1
fi
c_ok "PHP $(php -r 'echo PHP_VERSION;')"

if command -v javac >/dev/null 2>&1 && command -v java >/dev/null 2>&1; then
  c_ok "Java $(javac -version 2>&1 | awk '{print $2}') — ejercicios Java disponibles"
else
  c_warn "javac/java no encontrado — los ejercicios Java no compilarán (Python sí)."
fi

if command -v python3 >/dev/null 2>&1; then
  c_ok "Python $(python3 --version 2>&1 | awk '{print $2}') — ejercicios Python disponibles"
else
  c_warn "python3 no encontrado — los ejercicios Python no correrán (Java sí)."
fi

if [ ! -f "$APP_DIR/index.html" ]; then
  c_err "No encuentro app/index.html en $APP_DIR"
  exit 1
fi

# --- 2. liberar el puerto si ya está ocupado ---
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  PID="$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN | head -1)"
  c_warn "Puerto $PORT ocupado (PID $PID). Lo libero…"
  kill "$PID" 2>/dev/null || true
  sleep 1
fi

# --- 3. levantar ---
URL="http://$HOST:$PORT"
echo
c_ok "Sirviendo desde: $APP_DIR"
c_ok "Abrí en el navegador:  $URL"
echo "   (Ctrl-C para detener)"
echo

# abrir el navegador automáticamente (macOS), sin bloquear si falla
( sleep 1; command -v open >/dev/null 2>&1 && open "$URL" ) &

# el server queda en primer plano; Ctrl-C lo corta
exec php -S "$HOST:$PORT" -t "$APP_DIR"
