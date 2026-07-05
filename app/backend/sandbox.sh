#!/usr/bin/env bash
# ============================================================
# JavaLernen — wrapper de sandbox para el runner Java
# Uso:  sandbox.sh WORKDIR CPU_SECONDS -- CMD [ARGS...]
#
# Capas de contención (de más a menos fuerte, se usa la disponible):
#   1. bwrap (bubblewrap)  — namespaces: sin red, FS read-only salvo WORKDIR
#   2. firejail            — idem vía perfil
#   3. nsjail              — idem
#   4. ninguno (DEV)       — solo rlimits + aviso; NO usar en producción
#
# En TODOS los casos se aplican rlimits (CPU, memoria, procesos, archivos)
# como segunda línea contra loops que queman CPU y fork-bombs.
#
# Forzar una herramienta:  export JL_SANDBOX=bwrap|firejail|nsjail|none
# ============================================================
set -u

WORKDIR="${1:?WORKDIR requerido}"
CPU="${2:?CPU_SECONDS requerido}"
shift 2
[ "${1:-}" = "--" ] && shift

# --- rlimits per-proceso (seguros en cualquier usuario) ---
ulimit -t "$CPU"      2>/dev/null   # tiempo de CPU (mata loops CPU-bound: SIGXCPU)
ulimit -f 20480       2>/dev/null   # tamaño máx de archivo (~10 MB): frena llenar disco
#
# NOTA: nproc (fork-bomb) y memoria NO se limitan acá con ulimit:
#   - ulimit -u es GLOBAL por-usuario (rompe si el usuario ya corre procesos)
#   - ulimit -v choca con la JVM (reserva GBs de address space aunque -Xmx sea chico)
# Esos límites van en el DEPLOY, sobre el usuario dedicado:
#   systemd:  TasksMax=64  MemoryMax=512M   (o cgroup pids.max / memory.max)
#   + la JVM ya acota el heap con -Xmx128m.

detect() {
  if [ -n "${JL_SANDBOX:-}" ]; then echo "$JL_SANDBOX"; return; fi
  command -v bwrap    >/dev/null 2>&1 && { echo bwrap;    return; }
  command -v firejail >/dev/null 2>&1 && { echo firejail; return; }
  command -v nsjail   >/dev/null 2>&1 && { echo nsjail;   return; }
  echo none
}

case "$(detect)" in
  bwrap)
    exec bwrap \
      --unshare-all --unshare-net --die-with-parent --new-session \
      --ro-bind / / --dev /dev --proc /proc \
      --tmpfs /tmp --bind "$WORKDIR" "$WORKDIR" --chdir "$WORKDIR" \
      --setenv PATH "$PATH" \
      -- "$@"
    ;;
  firejail)
    exec firejail --quiet --noprofile --net=none --private-tmp \
      --read-only=/ --read-write="$WORKDIR" \
      -- "$@"
    ;;
  nsjail)
    exec nsjail --quiet -Mo --disable_proc --chroot / --cwd "$WORKDIR" \
      --network_off --rlimit_cpu "$CPU" -- "$@"
    ;;
  none|*)
    echo "WARN[sandbox]: sin bwrap/firejail/nsjail — solo rlimits. NO desplegar así en producción." >&2
    exec "$@"
    ;;
esac
