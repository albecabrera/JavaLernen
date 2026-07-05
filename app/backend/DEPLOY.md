# JavaLernen — Runner Java: hardening de producción

El endpoint `run.php` **compila y ejecuta código arbitrario del alumno** (RCE por
diseño). Las guardas de la app (temp dir por run, timeout wall-clock + kill, `-Xmx`,
límites de tamaño/salida, rlimits `-t`/`-f` de `sandbox.sh`) **no alcanzan** por sí
solas. En producción el aislamiento a nivel OS es **obligatorio**.

## Estado por entorno

| Guarda | Dev (macOS, sandbox=`none`) | Producción (Linux + bwrap) |
|---|---|---|
| Timeout / kill de loop | ✅ | ✅ |
| Límite de heap (`-Xmx128m`) | ✅ | ✅ |
| CPU-time (`ulimit -t`) | ✅ | ✅ |
| Tamaño de archivo (`ulimit -f`) | ✅ | ✅ |
| **Sin red** | ❌ (egress abierto) | ✅ `--unshare-net` |
| **FS read-only salvo workdir** | ❌ | ✅ `--ro-bind /` |
| **PID namespace / fork-bomb** | ❌ | ✅ `--unshare-pid` + systemd `TasksMax` |
| **Memoria total** | ❌ | ✅ systemd `MemoryMax` |

> El test de red en dev devuelve `NET-OK` — es la prueba de que sin sandbox el
> runner es inseguro. En Linux con bwrap ese mismo código falla.

## Requisitos de despliegue (Linux)

### 1. Usuario dedicado sin privilegios
```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin javarunner
```
El proceso PHP-FPM que sirve `run.php` corre como este usuario (pool propio). Así los
límites por-usuario (nproc, memoria) no afectan al resto del sistema.

### 2. Sandbox instalado
```bash
sudo apt-get install -y bubblewrap      # provee `bwrap`
```
`sandbox.sh` lo detecta automáticamente (orden: bwrap → firejail → nsjail → none).
Verificá que NO caiga a `none`:
```bash
JL_SANDBOX= bash backend/sandbox.sh /tmp/x 5 -- bash -c 'command -v bwrap && echo OK'
```
> `bwrap` sin setuid necesita user namespaces sin privilegios habilitados:
> `sysctl kernel.unprivileged_userns_clone=1` (Debian) — verificar en el server.

### 3. Límites de recursos (systemd, sobre el pool PHP-FPM del usuario)
En el `.service` o drop-in del pool:
```ini
[Service]
TasksMax=64            # tope de procesos → mata fork-bombs
MemoryMax=512M         # memoria total del cgroup
CPUQuota=200%          # tope de CPU agregado
```

### 4. Verificación post-deploy (obligatoria)
```bash
# a) red bloqueada — debe FALLAR (no imprimir NET-OK):
curl -sX POST https://TU-HOST/backend/run.php -H 'Content-Type: application/json' \
  -d '{"source":"import java.net.*;public class Main{public static void main(String[] a)throws Exception{new java.net.URL(\"http://example.com\").openStream();System.out.println(\"NET-OK\");}}"}'

# b) escribir fuera del workdir — debe FALLAR:
#    (código que intente crear /tmp/pwned o leer /etc/passwd)

# c) loop infinito — debe cortar (~5 s):
curl -sX POST https://TU-HOST/backend/run.php -H 'Content-Type: application/json' \
  -d '{"source":"public class Main{public static void main(String[] a){while(true){}}}"}'
```
Si (a) imprime `NET-OK`, **el sandbox no está activo — no exponer el endpoint**.

### 5. Endurecimiento adicional recomendado
- Rate-limiting por IP/sesión (nginx `limit_req`) — evita abuso del compilador.
- Cola/worker si el volumen es alto (compilar es costoso; no bloquear PHP-FPM).
- Registrar (sin ejecutar) fuentes sospechosas para auditoría.
- `MAX_SOURCE_BYTES` / `RUN_MAX_OUTPUT` ya acotados en `run.php`.
