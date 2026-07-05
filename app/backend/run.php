<?php
/* ============================================================
   JavaLernen — Java-Runner (SPIKE)
   POST { "source": "<java>" }  ->  JSON { ok, phase, stdout, stderr, ms }

   ⚠️ SEGURIDAD — LEER ANTES DE DESPLEGAR ⚠️
   Este endpoint compila y EJECUTA código arbitrario del cliente.
   Es RCE por diseño. Las guardas de acá (temp dir, timeout, kill)
   NO son suficientes para producción con código de alumnos.
   PRODUCCIÓN OBLIGA aislamiento a nivel OS por cada ejecución:
     - contenedor efímero (Docker/podman) o nsjail/firejail
     - sin red (--network none)
     - límites CPU / memoria / PIDs / tiempo (cgroups, ulimit)
     - FS de solo lectura salvo el temp dir del run
     - usuario sin privilegios
   Este archivo es un SPIKE para validar el camino, no para prod.
   ============================================================ */

declare(strict_types=1);

const MAX_SOURCE_BYTES = 20000;   // límite de tamaño de fuente
const COMPILE_TIMEOUT  = 10;      // s
const RUN_TIMEOUT      = 5;       // s
const RUN_MAX_OUTPUT   = 64000;   // bytes de stdout+stderr

header('Content-Type: application/json; charset=utf-8');

function out(array $data): never {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    out(['ok' => false, 'phase' => 'request', 'stderr' => 'Nur POST erlaubt.']);
}

$body   = file_get_contents('php://input');
$json   = json_decode($body, true);
$source = is_array($json) ? ($json['source'] ?? '') : '';

if (!is_string($source) || $source === '') {
    http_response_code(400);
    out(['ok' => false, 'phase' => 'request', 'stderr' => 'Kein Java-Quelltext übermittelt.']);
}
if (strlen($source) > MAX_SOURCE_BYTES) {
    http_response_code(413);
    out(['ok' => false, 'phase' => 'request', 'stderr' => 'Quelltext zu groß.']);
}

/* javac exige que el archivo se llame como la clase public. El ejercicio usa Main. */
if (!preg_match('/\bpublic\s+class\s+Main\b/', $source)) {
    out(['ok' => false, 'phase' => 'compile',
         'stderr' => "Die öffentliche Klasse muss 'Main' heißen (public class Main)."]);
}

/* --- workspace temporal aislado por run --- */
$work = sys_get_temp_dir() . '/jl_' . bin2hex(random_bytes(8));
mkdir($work, 0700, true);
register_shutdown_function(fn() => rrmdir($work));
file_put_contents("$work/Main.java", $source);

const SANDBOX = __DIR__ . '/sandbox.sh';

/**
 * Ejecuta un comando dentro del sandbox, con timeout wall-clock;
 * mata el árbol de procesos al vencer.
 * @return array{code:int|null, stdout:string, stderr:string, timedOut:bool}
 */
function run_cmd(array $argv, string $cwd, int $timeout): array {
    // envolver en el sandbox: bash sandbox.sh WORKDIR CPU -- CMD...
    // el límite de CPU del rlimit = timeout wall (segunda línea; la primaria es el kill de abajo)
    $wrapped = array_merge(['bash', SANDBOX, $cwd, (string) $timeout, '--'], $argv);

    $desc = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $proc = proc_open($wrapped, $desc, $pipes, $cwd, [
        'PATH' => getenv('PATH') ?: '/usr/bin:/bin',
    ]);
    if (!is_resource($proc)) {
        return ['code' => null, 'stdout' => '', 'stderr' => 'Prozess-Start fehlgeschlagen.', 'timedOut' => false];
    }
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    $stdout = ''; $stderr = ''; $timedOut = false;
    $deadline = microtime(true) + $timeout;

    while (true) {
        $status = proc_get_status($proc);
        $stdout .= stream_get_contents($pipes[1]);
        $stderr .= stream_get_contents($pipes[2]);

        if (strlen($stdout) + strlen($stderr) > RUN_MAX_OUTPUT) {
            $timedOut = true; // tratamos exceso como abuso -> matar
        }
        if (!$status['running'] || $timedOut || microtime(true) > $deadline) {
            if ($status['running']) {
                $timedOut = $timedOut || microtime(true) > $deadline;
                // matar el árbol (el pid de proc_open es el shell/proceso directo)
                if (function_exists('posix_kill')) {
                    posix_kill($status['pid'], 9);
                }
                proc_terminate($proc, 9);
            }
            $stdout .= stream_get_contents($pipes[1]);
            $stderr .= stream_get_contents($pipes[2]);
            $code = $status['running'] ? null : $status['exitcode'];
            fclose($pipes[1]); fclose($pipes[2]); proc_close($proc);
            // quitar el aviso del wrapper de sandbox (fallback dev) del stderr visible
            $stderr = preg_replace('/^WARN\[sandbox\]:.*\R?/m', '', $stderr);
            return [
                'code' => $code,
                'stdout' => substr($stdout, 0, RUN_MAX_OUTPUT),
                'stderr' => substr($stderr, 0, RUN_MAX_OUTPUT),
                'timedOut' => $timedOut,
            ];
        }
        usleep(15000);
    }
}

function rrmdir(string $dir): void {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) ?: [] as $f) {
        if ($f === '.' || $f === '..') continue;
        $p = "$dir/$f";
        is_dir($p) ? rrmdir($p) : @unlink($p);
    }
    @rmdir($dir);
}

$t0 = microtime(true);

/* --- 1) COMPILAR --- */
$c = run_cmd(['javac', '-encoding', 'UTF-8', 'Main.java'], $work, COMPILE_TIMEOUT);
if ($c['timedOut']) {
    out(['ok' => false, 'phase' => 'compile', 'stderr' => 'Kompilierung hat das Zeitlimit überschritten.']);
}
if (($c['code'] ?? 1) !== 0) {
    out(['ok' => false, 'phase' => 'compile',
         'stdout' => $c['stdout'], 'stderr' => trim($c['stderr']) ?: 'Kompilierfehler.']);
}

/* --- 2) EJECUTAR --- */
$r = run_cmd(
    ['java', '-XX:+UseSerialGC', '-Xss8m', '-Xmx128m', '-cp', '.', 'Main'],
    $work, RUN_TIMEOUT
);
$ms = (int) round((microtime(true) - $t0) * 1000);

if ($r['timedOut']) {
    out(['ok' => false, 'phase' => 'run', 'ms' => $ms,
         'stdout' => $r['stdout'],
         'stderr' => 'Zeitlimit überschritten — vermutlich eine Endlosschleife.']);
}

out([
    'ok'     => ($r['code'] === 0),
    'phase'  => 'run',
    'ms'     => $ms,
    'stdout' => $r['stdout'],
    'stderr' => $r['stderr'],
]);
