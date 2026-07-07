/* ============================================================
   JavaLernen — app shell (vanilla, sin dependencias)
   Router de vistas + drawer móvil + evaluación mock.
   El editor real con CheerpJ/WASM entra en el próximo hito;
   acá el <textarea> ya es editable y accesible por teclado.
   ============================================================ */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Sprache (Java / Python) ---------- */
  const LANG_KEY = 'javalernen_lang';
  let LANG = 'java';
  try { const l = localStorage.getItem(LANG_KEY); if (l === 'python' || l === 'java') LANG = l; } catch (e) {}
  const CONTENT_FILE = { java: 'content/content.json', python: 'content/content-python.json' };

  /* ---------- Router de vistas ---------- */
  const tabs = $$('.tab');

  function setView(view) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === view)));
    const active = $(`#view-${view}`);
    if (active) active.focus({ preventScroll: true });
    closeNav();
    location.hash = view;
    // la pantalla Projekt muestra stats reales — refrescar cada vez que se entra
    if (view === 'project' && activeChapter && activeChapter.isProject) renderProject(activeChapter);
    // el dashboard (saludo, resume-card, anillo) solo se pintaba al cargar o al resolver un
    // ejercicio — quedaba desactualizado si el alumno solo leía lecciones y volvía acá.
    if (view === 'dashboard' && typeof CONTENT !== 'undefined' && CONTENT) renderDashboard();
  }

  // tabs de la topbar
  tabs.forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));
  // navegación por teclado entre tabs (patrón WAI-ARIA tablist)
  $('.tabs')?.addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); tabs[(i + 1) % tabs.length].focus(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); tabs[(i - 1 + tabs.length) % tabs.length].focus(); }
  });

  // cualquier elemento con data-view (botones CTA dentro de las vistas)
  $$('[data-view]').forEach(el => {
    if (el.classList.contains('tab')) return;
    el.addEventListener('click', () => setView(el.dataset.view));
  });

  /* ---------- Drawer móvil ---------- */
  const shell = $('#shell'), scrim = $('#scrim'), burger = $('#hamburger');
  function openNav()  { shell.classList.add('nav-open');  burger.setAttribute('aria-expanded', 'true');  scrim.hidden = false; }
  function closeNav() { shell.classList.remove('nav-open'); burger.setAttribute('aria-expanded', 'false'); scrim.hidden = true; }
  burger?.addEventListener('click', () => shell.classList.contains('nav-open') ? closeNav() : openNav());
  scrim?.addEventListener('click', closeNav);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

  /* ---------- Einstellungen: Theme, Editor-Größe, Animationen (persistente) ---------- */
  const SETTINGS_KEY = 'javalernen_settings_v1';
  const SIZE_PX = { s: '12px', m: '13.5px', l: '15px' };
  const root = document.documentElement;
  let SETTINGS = { theme: 'dark', size: 'm', anim: true, sidebarCollapsed: false };
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); if (s) Object.assign(SETTINGS, s); } catch (e) {}

  function applySettings() {
    root.setAttribute('data-theme', SETTINGS.theme);
    root.style.setProperty('--code-size', SIZE_PX[SETTINGS.size] || SIZE_PX.m);
    root.setAttribute('data-anim', SETTINGS.anim ? 'on' : 'off');
    $$('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === SETTINGS.theme)));
    $$('[data-size-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sizeSet === SETTINGS.size)));
    const at = $('#animToggle'); if (at) at.checked = SETTINGS.anim;
    shell.classList.toggle('sidebar-collapsed', !!SETTINGS.sidebarCollapsed);
  }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) {} applySettings(); }
  applySettings();

  // Sidebar ein-/ausklappen (escritorio) — persistente, independiente del drawer mobile.
  $('#sidebarCollapseBtn')?.addEventListener('click', () => { SETTINGS.sidebarCollapsed = true; saveSettings(); });
  $('#sidebarExpandBtn')?.addEventListener('click', () => { SETTINGS.sidebarCollapsed = false; saveSettings(); });

  const settingsBtn = $('#settingsBtn'), settingsPop = $('#settingsPop');
  function toggleSettings(open) {
    const show = open != null ? open : settingsPop.hidden;
    settingsPop.hidden = !show;
    settingsBtn.setAttribute('aria-expanded', String(show));
    const nameInput = $('#nameInput');
    if (show && nameInput) nameInput.value = PROGRESS.name || '';
  }
  settingsBtn?.addEventListener('click', e => { e.stopPropagation(); toggleSettings(); });
  settingsPop?.addEventListener('click', e => {
    e.stopPropagation();
    const t = e.target.closest('[data-theme-set]'), s = e.target.closest('[data-size-set]');
    if (t) { SETTINGS.theme = t.dataset.themeSet; saveSettings(); }
    if (s) { SETTINGS.size = s.dataset.sizeSet; saveSettings(); }
  });
  $('#animToggle')?.addEventListener('change', e => { SETTINGS.anim = e.target.checked; saveSettings(); });
  // antes "Alberto"/"AL" fijos en todo el HTML sin importar quién usara la app
  $('#nameInput')?.addEventListener('input', e => {
    PROGRESS.name = e.target.value.trim();
    saveProgress();
    renderGreeting();
  });
  document.addEventListener('click', () => { if (settingsPop && !settingsPop.hidden) toggleSettings(false); });

  /* ---------- Command Palette (⌘K) — saltar a cualquier capítulo/lección/übung ---------- */
  const cmdkOverlay = $('#cmdkOverlay'), cmdkInput = $('#cmdkInput'), cmdkList = $('#cmdkList');
  const CMDK_VIEWS = { dashboard: 'Dashboard', overview: 'Übersicht', lesson: 'Lektion', exercise: 'Übung', project: 'Projekt', playground: 'Konsole' };
  let cmdkFiltered = [], cmdkActive = 0;

  function buildCmdkIndex() {
    const items = [];
    Object.entries(CMDK_VIEWS).forEach(([view, label]) => {
      if (view === 'overview' && LANG === 'python') return; // no existe en Python (Zertifikatskurs es solo Java)
      items.push({ kind: 'Ansicht', icon: '🧭', title: label, sub: 'Zur Ansicht wechseln', action: () => setView(view) });
    });
    (CONTENT && CONTENT.chapters || []).forEach(ch => {
      items.push({ kind: 'Kapitel', icon: '📘', title: ch.title, sub: `Kapitel ${ch.nr}`, action: () => openChapter(ch.id, ch.isProject ? 'project' : 'lesson') });
      (ch.lessons || []).forEach((les, i) => {
        items.push({ kind: 'Lektion', icon: '📄', title: les.title, sub: `${ch.title} · Lektion ${les.num || i + 1}`, action: () => openChapter(ch.id, 'lesson', i) });
      });
      (ch.exercises || []).forEach((ex, i) => {
        items.push({ kind: 'Übung', icon: '📝', title: ex.title, sub: ch.title, action: () => { openChapter(ch.id, 'exercise'); selectExercise(activeChapter, i); } });
      });
    });
    return items;
  }

  function cmdkRender(query) {
    const q = query.trim().toLowerCase();
    const all = buildCmdkIndex();
    cmdkFiltered = !q ? all.slice(0, 40) : all.filter(it =>
      it.title.toLowerCase().includes(q) || (it.sub || '').toLowerCase().includes(q)
    ).slice(0, 40);
    cmdkActive = 0;
    if (!cmdkFiltered.length) {
      cmdkList.innerHTML = `<div class="cmdk-empty">Keine Treffer für „${esc(query)}“</div>`;
      return;
    }
    cmdkList.innerHTML = cmdkFiltered.map((it, i) =>
      `<div class="cmdk-item${i === 0 ? ' active' : ''}" data-idx="${i}">
         <span class="cmdk-item-ico">${it.icon}</span>
         <span class="cmdk-item-main"><span class="cmdk-item-title">${esc(it.title)}</span><span class="cmdk-item-sub">${esc(it.sub || '')}</span></span>
         <span class="cmdk-item-kind">${esc(it.kind)}</span>
       </div>`
    ).join('');
  }

  function cmdkMove(delta) {
    const len = cmdkFiltered.length; if (!len) return;
    cmdkActive = (cmdkActive + delta + len) % len;
    $$('.cmdk-item').forEach((el, i) => el.classList.toggle('active', i === cmdkActive));
    $(`.cmdk-item[data-idx="${cmdkActive}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function openCmdk() {
    if (!cmdkOverlay) return;
    cmdkOverlay.hidden = false;
    cmdkInput.value = '';
    cmdkRender('');
    cmdkInput.focus();
  }
  function closeCmdk() { if (cmdkOverlay) cmdkOverlay.hidden = true; }

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); }
  });
  $('#cmdkBtn')?.addEventListener('click', openCmdk);
  cmdkOverlay?.addEventListener('click', e => { if (e.target === cmdkOverlay) closeCmdk(); });
  cmdkInput?.addEventListener('input', () => cmdkRender(cmdkInput.value));
  cmdkInput?.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeCmdk(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdkMove(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); cmdkMove(-1); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const it = cmdkFiltered[cmdkActive];
      if (it) { closeCmdk(); it.action(); }
    }
  });
  cmdkList?.addEventListener('click', e => {
    const el = e.target.closest('.cmdk-item'); if (!el) return;
    const it = cmdkFiltered[Number(el.dataset.idx)];
    if (it) { closeCmdk(); it.action(); }
  });

  /* ---------- Tastenkürzel-Hilfe (?) ---------- */
  const shortcutsOverlay = $('#shortcutsOverlay');
  function toggleShortcutsHelp(open) {
    if (!shortcutsOverlay) return;
    shortcutsOverlay.hidden = open != null ? !open : !shortcutsOverlay.hidden;
  }
  shortcutsOverlay?.addEventListener('click', e => { if (e.target === shortcutsOverlay) toggleShortcutsHelp(false); });
  $('#shortcutsBtn')?.addEventListener('click', () => toggleShortcutsHelp(true));
  $('#shortcutsCloseBtn')?.addEventListener('click', () => toggleShortcutsHelp(false));

  /* ---------- Atajos de teclado globales ---------- */
  const CMDK_VIEW_ORDER = ['dashboard', 'overview', 'lesson', 'exercise', 'project', 'playground'];
  document.addEventListener('keydown', e => {
    // Escape SIEMPRE cierra cualquier overlay abierto, sin importar qué más pase.
    if (e.key === 'Escape') { closeCmdk(); toggleShortcutsHelp(false); return; }
    // con un overlay modal abierto, los atajos globales NO deben disparar por detrás
    // (antes: ⌘1 etc. navegaban igual mientras la ayuda quedaba tapando todo, parecía que
    // "no funcionaba nada" porque la pantalla no cambiaba visualmente).
    const overlayOpen = (cmdkOverlay && !cmdkOverlay.hidden) || (shortcutsOverlay && !shortcutsOverlay.hidden);
    if (overlayOpen) return;

    const mod = e.metaKey || e.ctrlKey;
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);

    if (mod && e.key === ',') { e.preventDefault(); toggleSettings(true); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); switchLang(LANG === 'java' ? 'python' : 'java'); return; }
    if (mod && e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      const view = CMDK_VIEW_ORDER[Number(e.key) - 1];
      if (view && !(view === 'overview' && LANG === 'python')) setView(view);
      return;
    }
    if (mod && e.key.toLowerCase() === 'j' && activeChapter) {
      e.preventDefault();
      const n = (activeChapter.lessons || []).length;
      if (e.shiftKey) { if (activeLessonIndex > 0) selectLesson(activeLessonIndex - 1); }
      else if (activeLessonIndex < n - 1) selectLesson(activeLessonIndex + 1);
      return;
    }
    if (mod && e.key === '.' && activeExercise) {
      e.preventDefault();
      const hints = Array.isArray(activeExercise.hints) ? activeExercise.hints : [];
      if (hintLevel < hints.length) { hintLevel++; renderHelpOnly(); }
      else if (activeExercise.solution && !solutionShown) { solutionShown = true; renderHelpOnly(); }
      return;
    }
    if (!mod && e.key === '?' && !typing) { e.preventDefault(); toggleShortcutsHelp(); return; }
  });

  /* ---------- Evaluación de código (mock hasta CheerpJ) ---------- */
  const runBtn = $('#runBtn'), feedback = $('#feedback'), code = $('#code');
  let EXPECTED = '7 ist ungerade'; // se actualiza al cargar cada ejercicio

  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  // saca las líneas "at Main.main(...)" del stacktrace de una excepción runtime — ruido para
  // un alumno de Gymnasium, deja el mensaje real de la excepción intacto. NO se usa en errores
  // de compilación, ahí el stacktrace de javac sí es información útil.
  const cleanStderr = s => s.split('\n').filter(l => !/^\s*at /.test(l)).join('\n');
  let paint = () => {}; // repaint del editor de ejercicios (se asigna al montar)

  // "compilador" mínimo para el ejercicio: detecta el String impreso en la rama que corre.
  // No ejecuta Java real — es feedback pedagógico determinista hasta integrar CheerpJ.
  // Llama al backend PHP (javac real). Devuelve la respuesta normalizada.
  async function runOnServer(src, stdin) {
    const res = await fetch('backend/run.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src, stdin: stdin || '', lang: LANG }),
    });
    return res.json(); // { ok, phase, stdout, stderr, ms }
  }

  function renderRunning() {
    feedback.innerHTML = `<div class="fb-bar"><span class="spin"></span> Kompiliert …</div>`;
  }

  function renderResult(r) {
    // error de red / servidor caído
    if (r.__net) {
      feedback.innerHTML =
        `<div class="fb-bar err"><span class="fb-x">✕</span> Keine Verbindung zum Compiler</div>
         <div class="fb-body"><pre class="mono fb-console err-t">${esc(r.__net)}</pre>
         <div class="fb-warn"><span>ℹ️</span><p>Code-Ausführung braucht eine Internetverbindung. Lektionen sind offline verfügbar.</p></div></div>`;
      return false;
    }
    // error de compilación (javac real)
    if (r.phase === 'compile' && !r.ok) {
      feedback.innerHTML =
        `<div class="fb-bar err"><span class="fb-x">✕</span> Kompilierfehler</div>
         <div class="fb-body"><pre class="mono fb-console err-t">${esc(r.stderr || r.stdout || 'Kompilierfehler.')}</pre></div>`;
      return false;
    }
    const stdout = (r.stdout || '').replace(/\s+$/, '');
    // timeout: mensaje propio en vez del genérico "Laufzeitfehler" — no es un bug del alumno
    // en el sentido clásico, es "tu programa nunca terminó" (probable loop infinito).
    if (r.timedOut) {
      feedback.innerHTML =
        `<div class="fb-bar err"><span class="fb-x">⏱</span> Zeitlimit überschritten</div>
         <div class="fb-body">
           ${stdout ? `<div class="fb-label">Konsole (bis zum Abbruch)</div><pre class="mono fb-console">${esc(stdout)}</pre>` : ''}
           <div class="fb-warn"><span>⏱</span><p>Dein Programm hat zu lange gebraucht — vermutlich eine Endlosschleife. Prüfe, ob sich die Abbruchbedingung deiner Schleife wirklich ändert.</p></div></div>`;
      return false;
    }
    // error de ejecución (excepción en runtime)
    if (!r.ok && r.stderr) {
      feedback.innerHTML =
        `<div class="fb-bar err"><span class="fb-x">✕</span> Laufzeitfehler</div>
         <div class="fb-body">
           ${stdout ? `<div class="fb-label">Konsole</div><pre class="mono fb-console">${esc(stdout)}</pre>` : ''}
           <pre class="mono fb-console err-t">${esc(cleanStderr(r.stderr))}</pre></div>`;
      return false;
    }
    // ejecutó bien: comparar salida con lo esperado
    if (stdout === EXPECTED) {
      const justSolved = onExerciseSolved(activeExercise);
      const xpNote = justSolved ? ` · <span style="color:var(--accent)">+${XP_PER_EXERCISE} XP</span>` : '';
      feedback.innerHTML =
        `<div class="fb-bar ok rise"><span class="fb-check">✓</span> Kompiliert · Alle Tests bestanden${r.ms != null ? ` · ${r.ms} ms` : ''}${xpNote}</div>
         <div class="fb-body"><pre class="mono fb-console">${esc(stdout)}</pre></div>`;
      return true;
    }
    // compiló y corrió, pero la salida difiere → diff pedagógico
    feedback.innerHTML =
      `<div class="fb-bar"><span class="fb-check">✓</span> Kompiliert${r.ms != null ? ` · in ${r.ms} ms ausgeführt` : ''}</div>
       <div class="fb-body">
         <div class="fb-label">Konsole</div>
         <pre class="mono fb-console">${esc(stdout || '(keine Ausgabe)')}</pre>
         <div class="fb-diff-h err-t"><span class="fb-x">✕</span> Ausgabe weicht ab</div>
         <div class="fb-diff">
           <div class="ok-row"><span class="plus">＋</span><span class="w">erwartet</span><span class="code-str">${esc(EXPECTED)}</span></div>
           <div class="err-row"><span class="minus">－</span><span class="w">erhalten</span><span class="err-t">${esc(stdout || '(leer)')}</span></div>
         </div>
       </div>`;
    return false;
  }

  // Modo multi-caso: corre el código contra varios test cases (stdin distintos).
  // El alumno solo pasa si TODOS los casos dan la salida esperada → no se puede hardcodear.
  function renderTests(ex, r) {
    if (r.__net) { return renderResult(r); }
    if (r.phase === 'compile' && !r.ok) { return renderResult(r); }
    const runs = r.runs || [];
    const results = ex.tests.map((t, i) => {
      const run = runs[i] || {};
      const got = (run.stdout || '').replace(/\s+$/, '');
      const exp = (t.expected || '').replace(/\s+$/, '');
      return { t, got, exp, err: run.stderr || '', timedOut: !!run.timedOut, pass: run.ok && got === exp };
    });
    const passed = results.filter(x => x.pass).length;
    const allPass = passed === results.length;

    if (allPass) {
      const justSolved = onExerciseSolved(activeExercise);
      const xpNote = justSolved ? ` · <span style="color:var(--accent)">+${XP_PER_EXERCISE} XP</span>` : '';
      feedback.innerHTML =
        `<div class="fb-bar ok rise"><span class="fb-check">✓</span> Alle ${results.length} Tests bestanden${r.ms != null ? ` · ${r.ms} ms` : ''}${xpNote}</div>
         <div class="fb-body">${testRows(results)}</div>`;
      return true;
    }
    // al menos un caso falla → mostrar cuáles, con el primer diff pedagógico
    const firstFail = results.find(x => !x.pass);
    feedback.innerHTML =
      `<div class="fb-bar"><span class="fb-x">✕</span> ${passed} von ${results.length} Tests bestanden</div>
       <div class="fb-body">
         ${testRows(results)}
         ${firstFail.timedOut
           ? `<div class="fb-diff-h err-t"><span>⏱</span> Zeitlimit überschritten bei Eingabe ${firstFail.t.stdin != null ? `„${esc(firstFail.t.stdin)}“` : ''}</div>
              <div class="fb-warn"><span>⏱</span><p>Dein Programm hat zu lange gebraucht — vermutlich eine Endlosschleife.</p></div>`
           : firstFail.err
           ? `<div class="fb-diff-h err-t"><span class="fb-x">✕</span> Laufzeitfehler bei Eingabe ${firstFail.t.stdin != null ? `„${esc(firstFail.t.stdin)}“` : ''}</div><pre class="mono fb-console err-t">${esc(cleanStderr(firstFail.err))}</pre>`
           : `<div class="fb-diff-h err-t"><span class="fb-x">✕</span> Ausgabe weicht ab${firstFail.t.stdin != null ? ` (Eingabe „${esc(firstFail.t.stdin)}“)` : ''}</div>
              <div class="fb-diff">
                <div class="ok-row"><span class="plus">＋</span><span class="w">erwartet</span><span class="code-str">${esc(firstFail.exp)}</span></div>
                <div class="err-row"><span class="minus">－</span><span class="w">erhalten</span><span class="err-t">${esc(firstFail.got || '(leer)')}</span></div>
              </div>`}
       </div>`;
    return false;
  }

  function testRows(results) {
    return `<div class="test-rows">` + results.map((x, i) => {
      const label = x.t.stdin != null && x.t.stdin !== '' ? `Eingabe „${esc(x.t.stdin)}“` : `Test ${i + 1}`;
      return `<div class="test-row ${x.pass ? 'pass' : 'fail'}"><span class="test-ic">${x.pass ? '✓' : '✕'}</span><span class="test-label">${label}</span><span class="test-out mono">${esc(x.got || '—')}</span></div>`;
    }).join('') + `</div>`;
  }

  /* ---------- Editor: syntax-highlighting overlay (vanilla, sin deps) ---------- */
  const gutter = $('#gutter'), hlCode = $('#hl')?.firstElementChild;

  const JAVA_KW = new Set(('abstract assert boolean break byte case catch char class const continue ' +
    'default do double else enum extends final finally float for goto if implements import ' +
    'instanceof int interface long native new package private protected public return short ' +
    'static strictfp super switch synchronized this throw throws transient try void volatile ' +
    'while var record sealed permits yield true false null').split(' '));
  const JAVA_TYPES = new Set(('String System Integer Double Boolean Object Math List ArrayList Map ' +
    'HashMap Set HashSet Scanner Exception RuntimeException Character Long Float Byte Short ' +
    'StringBuilder Arrays Collections Comparable Comparable Iterator Optional').split(' '));
  const JAVA_TOKEN = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(@\w+)|(\b\d[\d_]*\.?\d*[fFdDlL]?\b)|([A-Za-z_$][\w$]*)|([+\-*/%=<>!&|^~?:]+)/g;

  const PY_KW = new Set(('and as assert async await break class continue def del elif else except ' +
    'finally for from global if import in is lambda nonlocal not or pass raise return try while ' +
    'with yield True False None match case self').split(' '));
  const PY_TYPES = new Set(('int float str bool list dict set tuple range object bytes complex ' +
    'frozenset type Exception ValueError TypeError KeyError IndexError').split(' '));
  // grupos: 1 comentario # · (2 sin uso) · 3/4 strings · 5 decorador @ · 6 número · 7 ident · 8 operador
  const PY_TOKEN = /(#[^\n]*)()|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(@\w+)|(\b\d[\d_]*\.?\d*[jJ]?\b)|([A-Za-z_][\w]*)|([+\-*/%=<>!&|^~?:@]+)/g;

  const LANGCFG = {
    java:   { kw: JAVA_KW, types: JAVA_TYPES, token: JAVA_TOKEN },
    python: { kw: PY_KW,   types: PY_TYPES,   token: PY_TOKEN },
  };
  const PY_BUILTINS = new Set('print input len range int str float bool list dict set tuple type abs min max sum sorted enumerate zip map filter open round'.split(' '));

  function highlight(src) {
    const cfg = LANGCFG[LANG] || LANGCFG.java;
    const TOKEN = cfg.token, KW = cfg.kw, TYPES = cfg.types;
    let out = '', last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src))) {
      if (m.index > last) out += esc(src.slice(last, m.index));
      const t = m[0];
      let cls = '';
      if (m[1] || m[2]) cls = 'tok-com';
      else if (m[3]) cls = 'tok-str';
      else if (m[4]) cls = 'tok-str';
      else if (m[5]) cls = 'tok-ann';
      else if (m[6]) cls = 'tok-num';
      else if (m[7]) {
        if (KW.has(t)) cls = 'tok-kw';
        else if (src[TOKEN.lastIndex] === '(') cls = 'tok-fn';
        else if (TYPES.has(t) || /^[A-Z]/.test(t)) cls = 'tok-type';
      }
      else if (m[8]) cls = 'tok-op';
      out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t);
      last = TOKEN.lastIndex;
    }
    out += esc(src.slice(last));
    return out;
  }

  /* ================= Editor: atajos estilo IntelliJ IDEA =================
     Operan sobre cualquier <textarea>. execCommand('insertText') preserva
     el historial de deshacer nativo (⌘Z sigue funcionando). ================ */
  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
  const CLOSERS = new Set([')', ']', '}', '"', "'"]);

  function editReplace(ta, from, to, text, selStart, selEnd) {
    ta.focus();
    ta.setSelectionRange(from, to);
    if (!document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, from, to, 'end'); // fallback
    }
    if (selStart != null) ta.setSelectionRange(selStart, selEnd == null ? selStart : selEnd);
  }
  const lineStartAt = (v, p) => v.lastIndexOf('\n', p - 1) + 1;
  const lineEndAt   = (v, p) => { const i = v.indexOf('\n', p); return i < 0 ? v.length : i; };
  const indentOf    = s => (s.match(/^[ \t]*/) || [''])[0];

  function intellijKeys(e, ta, repaint) {
    const mod = e.metaKey || e.ctrlKey;
    const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
    const done = () => { repaint(); return true; };

    // ⌘/  Zeilen (aus)kommentieren
    if (mod && e.key === '/') {
      e.preventDefault();
      const ls = lineStartAt(v, s), le = lineEndAt(v, en);
      const lines = v.slice(ls, le).split('\n');
      const allComm = lines.every(l => l.trim() === '' || /^\s*\/\//.test(l));
      const out = lines.map(l => l.trim() === '' ? l
        : allComm ? l.replace(/^(\s*)\/\/ ?/, '$1')
        : l.replace(/^(\s*)/, '$1// ')).join('\n');
      editReplace(ta, ls, le, out, ls, ls + out.length);
      return done();
    }
    // ⌘D  Zeile/Auswahl duplizieren
    if (mod && (e.key === 'd' || e.key === 'D') && !e.shiftKey) {
      e.preventDefault();
      if (s !== en) { editReplace(ta, en, en, v.slice(s, en), en + (en - s)); }
      else { const ls = lineStartAt(v, s), le = lineEndAt(v, s);
        const line = v.slice(ls, le); editReplace(ta, le, le, '\n' + line, s + line.length + 1); }
      return done();
    }
    // ⌘⌫  Zeile löschen  (IntelliJ „Delete Line“)
    if (mod && e.key === 'Backspace') {
      e.preventDefault();
      const ls = lineStartAt(v, s); let le = lineEndAt(v, en);
      if (le < v.length) le++; else if (ls > 0) return editReplace(ta, ls - 1, le, '', ls - 1), done();
      editReplace(ta, ls, le, '', ls); return done();
    }
    // ⌥⇧↑ / ⌥⇧↓  Zeile verschieben
    if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const ls = lineStartAt(v, s), le = lineEndAt(v, en);
      if (e.key === 'ArrowUp') {
        if (ls === 0) return true;
        const prevLs = lineStartAt(v, ls - 1);
        const block = v.slice(ls, le), prev = v.slice(prevLs, ls - 1);
        editReplace(ta, prevLs, le, block + '\n' + prev, prevLs + (s - ls), prevLs + (en - ls));
      } else {
        if (le >= v.length) return true;
        const nextLe = lineEndAt(v, le + 1);
        const block = v.slice(ls, le), next = v.slice(le + 1, nextLe);
        const np = ls + next.length + 1;
        editReplace(ta, ls, nextLe, next + '\n' + block, np + (s - ls), np + (en - ls));
      }
      return done();
    }
    // Live-Template: "sout" + Tab → System.out.println(""); Cursor zwischen die Anführungszeichen
    if (e.key === 'Tab' && !e.shiftKey && s === en) {
      const before4 = v.slice(Math.max(0, s - 4), s);
      const charBefore = v[s - 5];
      if (before4 === 'sout' && !/[A-Za-z0-9_]/.test(charBefore || '')) {
        e.preventDefault();
        const snippet = 'System.out.println("")';
        editReplace(ta, s - 4, s, snippet, s - 4 + snippet.indexOf('""') + 1);
        return done();
      }
    }
    // Tab / ⇧Tab  Einrücken / Ausrücken (mehrzeilig bei Auswahl)
    if (e.key === 'Tab') {
      e.preventDefault();
      const multi = v.slice(s, en).includes('\n') || e.shiftKey;
      if (!multi) { editReplace(ta, s, en, '    ', s + 4); return done(); }
      const ls = lineStartAt(v, s), le = lineEndAt(v, en);
      const lines = v.slice(ls, le).split('\n');
      const out = lines.map(l => e.shiftKey ? l.replace(/^ {1,4}|^\t/, '') : '    ' + l).join('\n');
      editReplace(ta, ls, le, out, ls, ls + out.length);
      return done();
    }
    // Enter  Auto-Einrückung (+ Block öffnen zwischen { })
    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      const ind = indentOf(v.slice(lineStartAt(v, s), s));
      const before = v[s - 1], after = v[en];
      if (before === '{' && after === '}') {
        e.preventDefault();
        editReplace(ta, s, en, '\n' + ind + '    ' + '\n' + ind, s + 1 + ind.length + 4);
        return done();
      }
      if (ind) { e.preventDefault(); editReplace(ta, s, en, '\n' + ind, s + 1 + ind.length); return done(); }
      return false;
    }
    // Auto-Paare: (, [, {, ", '  → schließendes Zeichen ergänzen / Auswahl umschließen
    if (PAIRS[e.key]) {
      e.preventDefault();
      const close = PAIRS[e.key];
      if (s !== en) editReplace(ta, s, en, e.key + v.slice(s, en) + close, s + 1, en + 1);
      else editReplace(ta, s, en, e.key + close, s + 1);
      return done();
    }
    // Über schließendes Zeichen „hinwegtippen“ statt doppeln
    if (CLOSERS.has(e.key) && v[en] === e.key && s === en) {
      e.preventDefault(); ta.setSelectionRange(en + 1, en + 1); return true;
    }
    // Backspace zwischen leerem Paar  → beide löschen
    if (e.key === 'Backspace' && !mod && s === en && s > 0 && PAIRS[v[s - 1]] === v[s]) {
      e.preventDefault(); editReplace(ta, s - 1, s + 1, '', s - 1); return done();
    }
    return false;
  }

  function makeEditor(ta, pre, gut) {
    const codeEl = (pre && pre.querySelector('code')) || pre;
    function repaint() {
      let v = ta.value;
      if (v[v.length - 1] === '\n') v += ' ';
      if (codeEl) codeEl.innerHTML = highlight(v);
      if (gut) { const n = ta.value.split('\n').length; let g = '';
        for (let i = 1; i <= n; i++) g += (i > 1 ? '\n' : '') + i; gut.textContent = g; }
    }
    function sync() { if (pre) { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; } if (gut) gut.scrollTop = ta.scrollTop; }
    ta.addEventListener('input', repaint);
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', e => { if (intellijKeys(e, ta, repaint)) sync(); });
    repaint();
    return repaint;
  }

  if (code && hlCode) paint = makeEditor(code, $('#hl'), gutter);

  async function runTests(src, tests) {
    const res = await fetch('backend/run.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src, stdins: tests.map(t => t.stdin || ''), lang: LANG }),
    });
    return res.json();
  }

  // advanceOnSuccess: ⌘⇧↵ además de ejecutar, salta a la siguiente übung si esta se resolvió bien
  async function doRun(advanceOnSuccess) {
    renderRunning();
    runBtn.disabled = true;
    let passed = false;
    try {
      const ex = activeExercise;
      if (ex && Array.isArray(ex.tests) && ex.tests.length) {
        passed = renderTests(ex, await runTests(code.value, ex.tests));
      } else {
        passed = renderResult(await runOnServer(code.value));  // retrocompat: 1 solo caso
      }
    } catch (e) {
      renderResult({ __net: String(e && e.message || e) });
    } finally {
      runBtn.disabled = false;
    }
    if (advanceOnSuccess && passed && activeChapter) {
      const n = (activeChapter.exercises || []).length;
      if (activeExerciseIndex < n - 1) selectExercise(activeChapter, activeExerciseIndex + 1);
    }
  }
  runBtn?.addEventListener('click', () => doRun(false));
  // ⌘↵ ejecuta · ⌘⇧↵ ejecuta y avanza a la siguiente Übung si pasó · ⌘⇧R resetea al starter
  code?.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doRun(e.shiftKey); }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); $('#resetBtn')?.click(); }
  });
  // Zurücksetzen: Editor auf den Startcode der aktuellen Übung zurücksetzen
  $('#resetBtn')?.addEventListener('click', () => {
    if (!activeExercise || !code) return;
    code.value = activeExercise.starter || '';
    paint();
    if (feedback) feedback.innerHTML = '';
    code.focus();
  });

  /* ---------- Playground / Konsole ---------- */
  const pgCode = $('#pgCode'), pgStdin = $('#pgStdin'), pgRunBtn = $('#pgRunBtn'), pgOut = $('#pgOutput');
  if (pgCode) makeEditor(pgCode, $('#pgHl'), $('#pgGutter'));

  function renderPgResult(r) {
    if (r.__net) { pgOut.innerHTML = `<span class="pg-err">✕ Keine Verbindung zum Compiler.</span>`; return; }
    if (r.phase === 'compile' && !r.ok) {
      pgOut.innerHTML = `<span class="pg-err">✕ Kompilierfehler</span>\n` + esc(r.stderr || 'Fehler.');
      return;
    }
    const meta = r.ms != null ? ` <span class="pg-meta">· ${r.ms} ms</span>` : '';
    let out = (r.ok ? `<span class="pg-ok">✓ Kompiliert</span>` : `<span class="pg-err">✕ Laufzeitfehler</span>`) + meta + '\n';
    const so = (r.stdout || '').replace(/\n$/, ''), se = (r.stderr || '').replace(/\n$/, '');
    if (so) out += esc(so);
    if (se) out += (so ? '\n' : '') + `<span class="pg-err">${esc(se)}</span>`;
    if (!so && !se) out += `<span class="pg-meta">(keine Ausgabe)</span>`;
    pgOut.innerHTML = out;
  }

  async function runPlayground() {
    if (!pgOut) return;
    pgOut.textContent = 'Kompiliert …';
    pgRunBtn.disabled = true;
    try { renderPgResult(await runOnServer(pgCode.value, pgStdin.value)); }
    catch (e) { renderPgResult({ __net: 1 }); }
    finally { pgRunBtn.disabled = false; }
  }
  pgRunBtn?.addEventListener('click', runPlayground);
  [pgCode, pgStdin].forEach(el => el?.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runPlayground(); }
  }));

  /* ============================================================
     CONTENIDO data-driven: carga content.json y renderiza
     sidebar, lecciones y ejercicios desde datos.
     ============================================================ */
  let CONTENT = null, activeChapter = null, activeExercise = null, activeLessonIndex = 0;

  const ICON = {
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock:  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="var(--dis)" stroke-width="2"/><path d="M8 11V8a4 4 0 018 0v3" stroke="var(--dis)" stroke-width="2"/></svg>',
    lockSm:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="var(--lock)" stroke-width="2"/><path d="M8 11V8a4 4 0 018 0v3" stroke="var(--lock)" stroke-width="2"/></svg>',
    star:  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-2.8L7 19l1-6-4-4 5.5-.5L12 3z" stroke="var(--dis)" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  };
  const PHASE = {
    EF: ['Einführungsphase', 'EF', false],
    Q1: ['Q1 · Datenstrukturen', '', true],
    Q2: ['Q2 · Rekursion & SQL', '', true],
    PRO: ['Professionelle Entwicklung', 'PRO', true],
    PY: ['Python-Grundkurs', 'PY', false],
  };
  const phaseLabel = ph => (PHASE[ph] || [ph])[0];
  const DIFF = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };

  function navItem(c) {
    let icon, prog = '';
    if (c.status === 'done') icon = `<span class="nav-icon done">${ICON.check}</span>`;
    else if (c.status === 'current') {
      icon = `<span class="nav-icon current glow"><i></i></span>`;
      prog = `<span class="nav-progress"><i style="width:${c.progress || 0}%"></i></span>`;
    } else icon = `<span class="nav-icon lock">${c.isProject ? ICON.star : ICON.lock}</span>`;
    const label = c.isProject ? c.title : `${esc(c.nr)} · ${esc(c.title)}`;
    return `<button class="nav-item" data-chapter="${esc(c.id)}">${icon}<span class="label">${label}${prog}</span></button>`;
  }

  function renderSidebar() {
    const nav = $('#chapterNav'); if (!nav) return;
    let html = '';
    const phases = [...new Set(CONTENT.chapters.map(c => c.phase))]; // fases en el orden que aparecen
    phases.forEach(ph => {
      const chs = CONTENT.chapters.filter(c => c.phase === ph);
      if (!chs.length) return;
      const [lbl, badge, locked] = PHASE[ph] || [ph, '', false];
      html += `<div class="nav-group-hd${locked ? ' locked' : ''}"><span>${esc(lbl)}</span>` +
              (badge ? `<span style="color:var(--accent)">${esc(badge)}</span>` : (locked ? ICON.lockSm : '')) + `</div>`;
      chs.forEach(c => { html += navItem(c); });
    });
    nav.innerHTML = html;
  }

  function videoCardHTML(v) {
    const url = `https://youtu.be/${v.id}`;
    const thumb = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
    const seen = PROGRESS.watchedVideos[v.id];
    return `<a class="video-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-video-id="${esc(v.id)}">
      <span class="video-thumb">
        <img src="${esc(thumb)}" alt="" loading="lazy" width="336" height="189" onerror="this.closest('.video-thumb').classList.add('thumb-err')">
        <span class="video-play" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 4l14 8-14 8V4z" fill="currentColor"/></svg></span>
        <span class="video-dur">${esc(v.duration)}</span>
        ${seen ? `<span class="video-seen">✓ Gesehen</span>` : ''}
      </span>
      <span class="video-info">
        <span class="video-eyebrow">▶ Video ansehen · ${esc(v.channel)}</span>
        <span class="video-title">${esc(v.title)}</span>
      </span>
    </a>`;
  }
  // delegado: marcar "visto" al click, sin bloquear la navegación al video
  $('#lessonBody')?.addEventListener('click', e => {
    const a = e.target.closest('.video-card[data-video-id]');
    if (!a) return;
    const id = a.dataset.videoId;
    if (!PROGRESS.watchedVideos[id]) { PROGRESS.watchedVideos[id] = true; saveProgress(); }
  });

  function blockHTML(b) {
    switch (b.type) {
      case 'p':  return `<p class="les-p">${b.html}</p>`;
      case 'h2': return `<h2 class="les-h2">${esc(b.text)}</h2>`;
      case 'code': return `<div class="code-card"><div class="code-card-hd"><span class="code-card-dots"><i></i><i></i><i></i></span>` +
        `<span class="code-card-file">${esc(b.file || '')}</span></div><pre class="mono"><code>${highlight(b.code)}</code></pre></div>`;
      case 'callout': {
        const em = b.variant === 'warn' ? '⚠️' : b.variant === 'tip' ? '💡' : 'ℹ️';
        return `<div class="callout ${b.variant}"><span class="ic">${em}</span><div><div class="c-title">${esc(b.title)}</div><div class="c-body">${b.html}</div></div></div>`;
      }
      case 'grid': return `<div class="op-grid">` +
        b.items.map(it => `<div><div class="op">${esc(it.code)}</div><div class="lbl">${esc(it.label)}</div></div>`).join('') + `</div>`;
      case 'figure': return `<figure class="fig"><div class="fig-svg">${b.svg || ''}</div>` +
        (b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : '') + `</figure>`;
      default: return '';
    }
  }

  function renderLessonTabs(ch) {
    const box = $('#lessonTabs'); if (!box) return;
    if (!ch.lessons || ch.lessons.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = ch.lessons.map((les, i) =>
      `<button class="les-pill${i === activeLessonIndex ? ' active' : ''}" data-lesson-idx="${i}">${esc(les.num || String(i + 1))}</button>`
    ).join('');
  }

  function renderLesson(ch) {
    const body = $('#lessonBody');
    const n = (ch.lessons || []).length;
    activeLessonIndex = Math.max(0, Math.min(activeLessonIndex, n - 1));
    const les = ch.lessons && ch.lessons[activeLessonIndex];
    renderLessonTabs(ch);
    if (!les) {
      $('#lesCrumb').innerHTML = `${esc(phaseLabel(ch.phase))} / Kapitel ${esc(ch.nr)}`;
      $('#lesTime').textContent = ''; $('#lesTitle').textContent = ch.title;
      if (body) body.innerHTML = '<p class="les-p">Für dieses Kapitel gibt es noch keine Lektion.</p>';
      return;
    }
    $('#lesCrumb').innerHTML = `${esc(phaseLabel(ch.phase))} / Kapitel ${esc(ch.nr)} / <span class="cur">${esc(les.title)}</span>`;
    $('#lesTime').textContent = les.readTime || '';
    $('#lesTitle').textContent = les.title;
    body.innerHTML = (les.video ? videoCardHTML(les.video) : '') + les.blocks.map(blockHTML).join('');

    const prevBtn = $('#lesPrevBtn'), doneBtn = $('#lesDoneBtn'), nextBtn = $('#lesNextBtn');
    const hasEx = ch.exercises && ch.exercises.length;
    const isLast = activeLessonIndex === n - 1;
    if (prevBtn) prevBtn.textContent = activeLessonIndex > 0 ? '◄ Vorherige Lektion' : '◄ Zurück';

    // "Lektion abgeschlossen" primero, y solo tras confirmarla aparece el botón para avanzar —
    // en vez de un simple "Weiter", celebra el logro y evita que el alumno avance sin haber leído.
    const done = !!PROGRESS.lessonsDone[`${ch.id}#${activeLessonIndex}`];
    if (doneBtn) doneBtn.hidden = done;
    if (nextBtn) {
      nextBtn.hidden = !done;
      if (isLast && !hasEx) nextBtn.textContent = '🎉 Geschafft!';
      else if (isLast) nextBtn.textContent = '🎉 Perfekt! Zur Übung ►';
      else nextBtn.textContent = '🎉 Perfekt! Weiter zur nächsten Lektion ►';
    }
  }

  function selectLesson(idx) {
    if (!activeChapter) return;
    activeLessonIndex = idx;
    PROGRESS.lastLesson[activeChapter.id] = idx;
    saveProgress();
    renderLesson(activeChapter);
  }

  $('#lessonTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-lesson-idx]');
    if (btn) selectLesson(Number(btn.dataset.lessonIdx));
  });
  $('#lesPrevBtn')?.addEventListener('click', () => {
    if (activeLessonIndex > 0) selectLesson(activeLessonIndex - 1);
    else setView('dashboard');
  });
  $('#lesDoneBtn')?.addEventListener('click', () => {
    if (!activeChapter) return;
    PROGRESS.lessonsDone[`${activeChapter.id}#${activeLessonIndex}`] = true;
    saveProgress();
    renderLesson(activeChapter);
  });
  $('#lesNextBtn')?.addEventListener('click', () => {
    const ch = activeChapter; if (!ch) return;
    const n = (ch.lessons || []).length;
    const hasEx = ch.exercises && ch.exercises.length;
    if (activeLessonIndex < n - 1) selectLesson(activeLessonIndex + 1);
    else if (hasEx) setView('exercise');
    else setView('dashboard');
  });

  let activeExerciseIndex = 0;

  function selectExercise(ch, idx) {
    const n = (ch.exercises || []).length;
    activeExerciseIndex = Math.max(0, Math.min(idx, n - 1));
    renderExercise(ch);
  }

  $('#exPrompt')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-ex-idx]');
    if (btn && activeChapter) selectExercise(activeChapter, Number(btn.dataset.exIdx));
  });

  let hintLevel = 0, solutionShown = false;

  function helpBlockHTML(ex) {
    const hints = Array.isArray(ex.hints) ? ex.hints : [];
    let html = '';
    if (ex.tip_html) html += `<div class="prompt-tip"><span>💡</span><div><div class="c-title">Tipp</div><div class="c-body">${ex.tip_html}</div></div></div>`;
    if (hints.length) {
      const shown = hints.slice(0, hintLevel);
      html += shown.map((h, i) => `<div class="prompt-tip hint"><span>💡</span><div><div class="c-title">Tipp ${i + 2}</div><div class="c-body">${h}</div></div></div>`).join('');
      if (hintLevel < hints.length) {
        html += `<button class="btn btn-ghost hint-btn" id="moreHintBtn">Weiteren Tipp zeigen (${hintLevel + 1}/${hints.length + 1})</button>`;
      }
    }
    if (ex.solution) {
      html += solutionShown
        ? `<div class="solution-box"><div class="solution-hd">🔓 Lösung</div><pre class="mono">${highlight(ex.solution)}</pre></div>`
        : `<button class="btn btn-ghost solution-btn" id="showSolutionBtn">🔒 Lösung anzeigen</button>`;
    }
    return html;
  }

  function renderExercise(ch) {
    const p = $('#exPrompt');
    const n = (ch.exercises || []).length;
    activeExerciseIndex = Math.max(0, Math.min(activeExerciseIndex, n - 1));
    const ex = ch.exercises && ch.exercises[activeExerciseIndex];
    if (!ex) { activeExercise = null; if (p) p.innerHTML = '<p class="prompt-p">Keine Übung in diesem Kapitel.</p>'; return; }
    if (activeExercise !== ex) { hintLevel = 0; solutionShown = false; } // reset al cambiar de ejercicio
    activeExercise = ex; EXPECTED = ex.expected;
    const pills = n > 1 ? `<div class="les-pills">` + ch.exercises.map((e, i) =>
      `<button class="les-pill${i === activeExerciseIndex ? ' active' : ''}" data-ex-idx="${i}">${i + 1}</button>`).join('') + `</div>` : '';
    const expectedBox = Array.isArray(ex.tests) && ex.tests.length
      ? `<div class="card card-pad prompt-expected"><div class="k">Testfälle (${ex.tests.length})</div>` +
        ex.tests.map(t => `<div class="tc-row"><span class="tc-in mono">${t.stdin != null && t.stdin !== '' ? 'Eingabe ' + esc(t.stdin) : '—'}</span><span class="tc-arrow">→</span><span class="tc-exp mono">${esc(t.expected)}</span></div>`).join('') + `</div>`
      : `<div class="card card-pad prompt-expected"><div class="k">Erwartete Ausgabe</div><pre>${esc(ex.expected || '')}</pre></div>`;
    p.innerHTML = pills +
      `<div><span class="prompt-tag">${esc(ch.nr)} · Übung</span><span class="prompt-diff">${esc(DIFF[ex.difficulty] || '')}</span></div>
       <h1 class="prompt-title">${esc(ex.title)}</h1>
       <p class="prompt-p">${ex.prompt_html}</p>
       ${expectedBox}
       <div id="helpBlock">${helpBlockHTML(ex)}</div>`;
    if (code) { code.value = ex.starter || ''; paint(); }
    if (feedback) feedback.innerHTML = '';
  }

  $('#exPrompt')?.addEventListener('click', e => {
    if (e.target.closest('#moreHintBtn')) { hintLevel++; renderHelpOnly(); }
    if (e.target.closest('#showSolutionBtn')) { solutionShown = true; renderHelpOnly(); }
  });
  function renderHelpOnly() {
    const hb = $('#helpBlock'); if (hb && activeExercise) hb.innerHTML = helpBlockHTML(activeExercise);
  }

  function openChapter(id, view, lessonIndex) {
    const ch = CONTENT && CONTENT.chapters.find(c => c.id === id); if (!ch) return;
    activeChapter = ch;
    activeLessonIndex = lessonIndex != null ? lessonIndex : (PROGRESS.lastLesson[ch.id] ?? 0);
    activeExerciseIndex = 0;
    $$('#chapterNav [data-chapter]').forEach(b => b.setAttribute('aria-current', String(b.dataset.chapter === id)));
    if (ch.isProject) renderProject(ch);
    renderLesson(ch); renderExercise(ch);
    if (view) setView(view);
  }

  $('#chapterNav')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-chapter]');
    if (btn) openChapter(btn.dataset.chapter, 'lesson');
  });

  function renderProject(ch) {
    const p = ch.project; if (!p) return;
    const total = (ch.exercises || []).length;
    const solved = (ch.exercises || []).filter(e => PROGRESS.solved[e.id]).length;
    const done = total > 0 && solved === total;
    $('#prTag').textContent = done ? '✓ Projekt abgeschlossen' : `Projekt · ${solved} / ${total} Meilensteine`;
    $('#prTitle').textContent = p.title;
    $('#prIntro').textContent = p.intro || '';
    $('#prDesc').innerHTML = p.description_html || '';
    // Stats REALES (era: números fijos del JSON, mostrados sin importar el progreso real)
    const xpEarned = solved * XP_PER_EXERCISE;
    $('#prStats').innerHTML = [
      { value: `+${xpEarned}`, label: 'XP verdient' },
      { value: `${solved} / ${total}`, label: 'Meilensteine' },
    ].map(s =>
      `<div class="card" style="padding:16px 22px;min-width:110px"><div style="font-size:24px;font-weight:700;color:var(--accent)">${esc(s.value)}</div><div style="font-size:11.5px;color:var(--mut2)">${esc(s.label)}</div></div>`
    ).join('');
    const btn = $('#prStartBtn');
    if (btn) btn.textContent = done ? 'Nochmal ansehen ►' : (solved > 0 ? 'Weiter ►' : 'Projekt starten ►');
  }
  $('#prStartBtn')?.addEventListener('click', () => { if (activeChapter) openChapter(activeChapter.id, 'lesson', 0); });

  /* ============================================================
     PROGRESO REAL (localStorage) — sin esto, streak/XP/badges eran
     puro decorado que nunca cambiaba sin importar cuánto practicaras.
     El estado de capítulos (locked/current/done) pasa a ser DERIVADO
     de qué ejercicios están realmente resueltos, no editado a mano.
     ============================================================ */
  const PROGRESS_KEY = 'javalernen_progress_v1';
  const XP_PER_EXERCISE = 20;
  const XP_PER_LEVEL = 1000;
  const BADGE_DEFS = [
    { id: 'erste-uebung',    icon: '⭐',   title: 'Erste Übung',     desc: 'Erste Übung erfolgreich gelöst',      check: p => p.solvedCount >= 1 },
    { id: 'fuenf-uebungen',  icon: '🔥',   title: '5 Übungen',       desc: 'Fünf Übungen erfolgreich gelöst',     check: p => p.solvedCount >= 5 },
    { id: 'erstes-kapitel',  icon: '</>',  title: 'Erstes Kapitel',  desc: 'Ein ganzes Kapitel abgeschlossen',    check: p => p.chaptersDone >= 1 },
    { id: 'streak-3',        icon: '📅',   title: '3-Tage-Serie',    desc: 'Drei Tage in Folge geübt',            check: p => p.streak.count >= 3 },
  ];

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.solved) {
          if (!p.lastLesson) p.lastLesson = {};       // por-alumno: última lección vista de cada capítulo
          if (!p.watchedVideos) p.watchedVideos = {}; // por-alumno: videos ya clickeados
          if (!p.lessonsDone) p.lessonsDone = {};      // por-alumno: lecciones confirmadas como "terminadas"
          if (p.name == null) p.name = '';            // antes hardcodeado "Alberto" en todo el HTML
          return p;
        }
      }
    } catch (e) {}
    return { solved: {}, xp: 0, streak: { count: 0, last: null }, badges: [], lastLesson: {}, watchedVideos: {}, lessonsDone: {}, name: '' };
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(PROGRESS)); } catch (e) {}
  }
  let PROGRESS = loadProgress();

  function bumpStreak() {
    const today = todayStr();
    if (PROGRESS.streak.last === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = y.toISOString().slice(0, 10);
    PROGRESS.streak.count = (PROGRESS.streak.last === yesterday) ? PROGRESS.streak.count + 1 : 1;
    PROGRESS.streak.last = today;
  }

  const chapterExerciseIds = ch => (ch.exercises || []).map(e => e.id);

  // Deriva locked/current/done de TODOS los capítulos a partir de qué ejercicios
  // están resueltos — nunca se edita ch.status a mano, siempre se recalcula entero.
  function recomputeChapterStatuses() {
    if (!CONTENT) return;
    let reached = true;
    let chaptersDone = 0;
    for (const ch of CONTENT.chapters) {
      const exIds = chapterExerciseIds(ch);
      if (!reached) { ch.status = 'locked'; ch.progress = 0; continue; }
      const doneCount = exIds.filter(id => PROGRESS.solved[id]).length;
      const allDone = exIds.length === 0 || doneCount === exIds.length;
      ch.progress = exIds.length ? Math.round(100 * doneCount / exIds.length) : 100;
      ch.status = allDone ? 'done' : 'current';
      if (allDone) chaptersDone++;
      reached = allDone; // el siguiente capítulo solo se alcanza si este terminó
    }
    return chaptersDone;
  }

  // devuelve los BADGE_DEFS recién ganados (no solo muta PROGRESS.badges) para poder celebrarlos
  function checkBadges(stats) {
    const before = new Set(PROGRESS.badges);
    const nuevos = BADGE_DEFS.filter(b => b.check(stats) && !before.has(b.id));
    nuevos.forEach(b => PROGRESS.badges.push(b.id));
    return nuevos;
  }

  let toastQueue = Promise.resolve();
  function showToast({ icon, title, desc }) {
    // encola: si hay varios logros de una, se muestran uno tras otro, no superpuestos
    toastQueue = toastQueue.then(() => new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'jl-toast rise';
      el.innerHTML = `<span class="jl-toast-ico">${icon}</span><div><div class="jl-toast-title">${esc(title)}</div>${desc ? `<div class="jl-toast-desc">${esc(desc)}</div>` : ''}</div>`;
      document.body.appendChild(el);
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => { el.remove(); resolve(); }, 300);
      }, 3200);
    }));
  }

  // Antes "Synchronisiert"/"Offline-Modus" era puro teatro: un toggle de texto sin ninguna
  // sincronización real detrás (no hay backend). Ahora exporta/importa el progreso real —
  // única forma de llevar el avance de una computadora a otra sin backend.
  $('#exportBtn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(PROGRESS, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `javalernen-fortschritt-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ icon: '💾', title: 'Fortschritt exportiert', desc: 'Datei heruntergeladen — auf einem anderen Rechner importierbar.' });
  });
  const importFile = $('#importFile');
  $('#importBtn')?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', () => {
    const file = importFile.files && importFile.files[0];
    importFile.value = ''; // permite volver a elegir el mismo archivo después
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result);
        if (!p || typeof p !== 'object' || !p.solved) throw new Error('Ungültiges Format');
        if (!p.lastLesson) p.lastLesson = {};
        if (!p.watchedVideos) p.watchedVideos = {};
        PROGRESS = p;
        saveProgress();
        renderSidebar(); renderDashboard(); renderOverview();
        showToast({ icon: '📂', title: 'Fortschritt importiert', desc: 'Dein Stand wurde wiederhergestellt.' });
      } catch (e) {
        showToast({ icon: '⚠️', title: 'Import fehlgeschlagen', desc: 'Die Datei ist ungültig oder beschädigt.' });
      }
    };
    reader.readAsText(file);
  });

  // Se llama cuando un ejercicio compila+corre OK y la salida matchea EXPECTED.
  function onExerciseSolved(ex) {
    if (!ex || PROGRESS.solved[ex.id]) return false; // ya resuelto antes, no duplicar XP
    PROGRESS.solved[ex.id] = true;
    const levelBefore = Math.floor(PROGRESS.xp / XP_PER_LEVEL);
    PROGRESS.xp += XP_PER_EXERCISE;
    const levelAfter = Math.floor(PROGRESS.xp / XP_PER_LEVEL);
    bumpStreak();
    const chaptersDone = recomputeChapterStatuses();
    const solvedCount = Object.keys(PROGRESS.solved).length;
    const nuevos = checkBadges({ solvedCount, chaptersDone, streak: PROGRESS.streak });
    saveProgress();
    renderSidebar();
    renderDashboard();
    renderOverview();
    nuevos.forEach(b => showToast({ icon: b.icon, title: 'Abzeichen freigeschaltet!', desc: b.title }));
    if (levelAfter > levelBefore) showToast({ icon: '🎉', title: `Level ${levelAfter + 1} erreicht!`, desc: 'Weiter so.' });
    return true;
  }

  function renderProgressUI() {
    const level = Math.floor(PROGRESS.xp / XP_PER_LEVEL) + 1;
    const xpInLevel = PROGRESS.xp % XP_PER_LEVEL;
    const xpToNext = XP_PER_LEVEL - xpInLevel;
    const circumference = 402; // 2·π·64, radio del anillo SVG

    $('#topStreak') && ($('#topStreak').textContent = PROGRESS.streak.count);
    $('#topXp') && ($('#topXp').textContent = PROGRESS.xp);
    $('#streakVal') && ($('#streakVal').textContent = PROGRESS.streak.count);
    $('#xpVal') && ($('#xpVal').textContent = PROGRESS.xp);
    $('#xpSub') && ($('#xpSub').textContent = `Level ${level} · ${xpToNext} XP bis Level ${level + 1}`);
    $('#levelVal') && ($('#levelVal').textContent = level);
    $('#levelSub') && ($('#levelSub').textContent = `${xpInLevel} / ${XP_PER_LEVEL} XP · noch ${xpToNext}`);
    const arc = $('#ringArc');
    if (arc) arc.setAttribute('stroke-dashoffset', String(circumference * (1 - xpInLevel / XP_PER_LEVEL)));

    const cells = $('#streakCells');
    if (cells) {
      const on = Math.min(PROGRESS.streak.count, 7);
      cells.innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('');
    }

    $('#badgeCount') && ($('#badgeCount').textContent = PROGRESS.badges.length);
    $('#badgeTotal') && ($('#badgeTotal').textContent = `von ${BADGE_DEFS.length}`);
    const earned = BADGE_DEFS.filter(b => PROGRESS.badges.includes(b.id));
    const badgeSub = $('#badgeSub');
    if (badgeSub) badgeSub.textContent = earned.length ? earned.map(b => b.icon).join(' ') : 'Noch keine verdient';
    const list = $('#badgeList');
    if (list) {
      list.innerHTML = earned.length
        ? earned.slice().reverse().map(b =>
            `<div class="badge-item"><span class="badge-ico">${b.icon}</span><span><span class="t" style="display:block">${esc(b.title)}</span><span class="s">${esc(b.desc)}</span></span></div>`
          ).join('')
        : `<p style="font-size:13px;color:var(--faint);line-height:1.6">Noch keine Abzeichen verdient — schließe deine erste Übung ab, um loszulegen.</p>`;
    }
  }

  /* ---------- Dashboard: resume card + Lernpfad (data-driven, clickeable) ---------- */
  function findCurrentChapter() {
    return CONTENT.chapters.find(c => c.status === 'current' && !c.isProject) ||
           CONTENT.chapters.find(c => !c.isProject);
  }

  function renderResumeCard(ch) {
    const box = $('#resumeCard'); if (!box) return;
    const started = PROGRESS.lastLesson[ch.id] != null;
    const idx = PROGRESS.lastLesson[ch.id] ?? 0;
    const les = ch.lessons[idx];
    const n = ch.lessons.length;
    const firstP = (les.blocks.find(b => b.type === 'p') || {}).html || '';
    box.innerHTML =
      `<p class="resume-tag">${started ? 'Fortsetzen' : 'Jetzt starten'} · <span class="sub">Kapitel ${esc(ch.nr)} · ${esc(ch.title)}</span></p>
       <h2 class="resume-title">${esc(les.num ? 'Lektion ' + les.num : les.title)}${les.num ? ' — ' + esc(les.title) : ''}</h2>
       <p class="resume-desc">${firstP}</p>
       <div class="row-cta" style="display:flex;align-items:center;gap:18px">
         <button class="btn btn-primary" id="resumeOpenBtn">Lektion öffnen
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
         <div style="flex:1">
           <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--mut2);margin-bottom:6px"><span>Kapitel-Fortschritt</span><span>${idx + 1} / ${n} Lektionen</span></div>
           <div class="progress"><i style="width:${ch.progress || 0}%"></i></div>
         </div>
       </div>`;
    $('#resumeOpenBtn')?.addEventListener('click', () => openChapter(ch.id, 'lesson', idx));
  }

  function renderLernpfad() {
    const list = $('#lernpfadList'), sub = $('#lernpfadSub'); if (!list) return;
    const firstPhase = CONTENT.chapters[0] && CONTENT.chapters[0].phase;
    const efChapters = CONTENT.chapters.filter(c => c.phase === firstPhase);
    const heading = $('#lernpfadList')?.closest('.card')?.querySelector('h2');
    if (heading) heading.textContent = `Lernpfad · ${phaseLabel(firstPhase)}`;
    const done = efChapters.filter(c => c.status === 'done').length;
    if (sub) sub.textContent = `${done} von ${efChapters.length} Kapiteln abgeschlossen`;
    list.innerHTML = efChapters.map(c => {
      const locked = c.status === 'locked';
      let icon;
      if (c.status === 'done') icon = `<span class="nav-icon done">${ICON.check}</span>`;
      else if (c.status === 'current') icon = `<span class="nav-icon current"><i></i></span>`;
      else icon = `<span class="nav-icon lock">${c.isProject ? ICON.star : ICON.lock}</span>`;
      const pct = locked ? `<span class="pct">Gesperrt</span>`
        : `<span class="pct${c.status === 'current' ? ' done' : ''}">${c.progress || 0}%</span>`;
      const label = c.isProject ? c.title : `${esc(c.nr)} · ${esc(c.title)}`;
      return `<button class="path-row${locked ? ' locked' : ''}" data-chapter="${esc(c.id)}"${locked ? ' disabled' : ''}>${icon} ${label} ${pct}</button>`;
    }).join('');
  }

  $('#lernpfadList')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-chapter]:not([disabled])');
    if (btn) { const c = CONTENT.chapters.find(x => x.id === btn.dataset.chapter);
      openChapter(btn.dataset.chapter, c && c.isProject ? 'project' : 'lesson'); }
  });

  $('#continueBtn')?.addEventListener('click', () => {
    const ch = findCurrentChapter();
    openChapter(ch.id, 'lesson', PROGRESS.lastLesson[ch.id] ?? 0);
  });

  // antes "AL" fijo en el HTML sin importar quién usara la app — ahora derivado del nombre real
  function renderAvatar() {
    const av = $('#userAvatar'); if (!av) return;
    const name = (PROGRESS.name || '').trim();
    av.textContent = name
      ? name.split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
      : '🎓';
  }

  // Antes hardcodeado en el HTML ("Guten Abend, Alberto" / "Samstag, 4. Juli" siempre) — ahora real.
  function renderGreeting() {
    const eyebrow = $('.dash .eyebrow'), greet = $('.dash .h-greet');
    if (!eyebrow && !greet) return;
    const now = new Date();
    const h = now.getHours();
    const saludo = h < 5 ? 'Gute Nacht' : h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
    const fecha = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    const phase = CONTENT && CONTENT.chapters[0] && phaseLabel(CONTENT.chapters[0].phase);
    if (eyebrow) eyebrow.textContent = phase ? `${fecha} · ${phase}` : fecha;
    renderAvatar();
    const name = (PROGRESS.name || '').trim();
    if (greet) greet.textContent = name ? `${saludo}, ${name}` : saludo;
  }

  function renderDashboard() {
    renderGreeting();
    const ch = findCurrentChapter();
    renderResumeCard(ch);
    renderLernpfad();
    renderProgressUI();
  }

  /* ---------- Übersicht: Curriculum del Zertifikatskurs + cobertura en JavaLernen ---------- */
  function chapterLabel(id) {
    const c = CONTENT.chapters.find(x => x.id === id);
    return c ? (c.isProject ? c.title : `${c.nr} · ${c.title}`) : id;
  }

  function renderOverview() {
    const box = $('#moduleList'); if (!box || !CONTENT.modules) return;
    box.innerHTML = CONTENT.modules.map(m => {
      const status = m.status || (m.coverage.length === 0 ? 'gap' : 'partial');
      const badge = { gap: 'Noch nicht abgedeckt', partial: 'Teilweise abgedeckt', full: 'Abgedeckt' }[status];
      const links = m.coverage.map(id =>
        `<button class="cov-link" data-chapter="${esc(id)}">${esc(chapterLabel(id))}</button>`).join('');
      return `<article class="card module-card">
        <div class="module-hd">
          <span class="module-num">Modul ${esc(m.nr)}</span>
          <span class="module-weeks">${esc(String(m.weeks))} Wochen</span>
        </div>
        <h2 class="module-title">${esc(m.title)}</h2>
        <p class="module-desc">${esc(m.description)}</p>
        <ul class="module-topics">${m.topics.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="module-cov">
          <span class="cov-badge ${status}">${badge}</span>
          ${links}
        </div>
      </article>`;
    }).join('');
  }

  $('#moduleList')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-chapter]');
    if (btn) { const c = CONTENT.chapters.find(x => x.id === btn.dataset.chapter);
      openChapter(btn.dataset.chapter, c && c.isProject ? 'project' : 'lesson'); }
  });

  function applyLangUI() {
    $$('.lang-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
    const brand = $('#brandName'); if (brand) brand.textContent = LANG === 'python' ? 'PyLernen' : 'JavaLernen';
    const logoSrc = LANG === 'python' ? 'img/python-vertical.svg' : 'img/java-vertical.svg';
    const logoAlt = LANG === 'python' ? 'Python-Logo' : 'Java-Logo';
    const brandLogo = $('.brand-logo');
    if (brandLogo) brandLogo.innerHTML = `<img src="${logoSrc}" alt="${logoAlt}">`;
    const dashLogo = $('#dashLangLogo');
    if (dashLogo) { dashLogo.className = `dash-lang-logo ${LANG}`; dashLogo.innerHTML = `<img src="${logoSrc}" alt="${logoAlt}">`; }
    // watermark de fondo — presente en las 6 vistas (Dashboard, Übersicht, Lektion, Übung, Projekt, Konsole)
    $$('.dash-watermark').forEach(wm => {
      wm.className = `dash-watermark ${LANG}`;
      wm.innerHTML = `<img src="${logoSrc}" alt="" aria-hidden="true">`;
    });
    const ovTab = $('.tab[data-view="overview"]'); // la Übersicht (Zertifikatskurs) es solo para Java
    if (ovTab) ovTab.style.display = LANG === 'python' ? 'none' : '';
    const fname = LANG === 'python' ? 'main.py' : 'Main.java';
    $$('#exFile, .pg-bar .mono').forEach(el => { if (el) el.textContent = fname; });
    // Playground-Startcode passend zur Sprache (Scratch, nicht persistiert)
    const pg = $('#pgCode');
    if (pg) {
      pg.value = LANG === 'python'
        ? 'name = input("Wie heißt du? ")\nprint(f"Hallo, {name}!")\n'
        : 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.print("Wie heißt du? ");\n        String name = sc.nextLine();\n        System.out.println("Hallo, " + name + "!");\n    }\n}';
      pg.dispatchEvent(new Event('input'));
    }
  }

  async function init() {
    applyLangUI();
    try {
      CONTENT = await (await fetch(CONTENT_FILE[LANG] || CONTENT_FILE.java)).json();
    } catch (e) {
      console.error('Konnte Inhalt nicht laden:', e);
      return;
    }
    recomputeChapterStatuses(); // pisa los valores estáticos del JSON con el progreso real guardado
    renderSidebar();
    renderDashboard();
    renderOverview();
    const start = CONTENT.chapters.find(c => c.status === 'current') || CONTENT.chapters[0];
    if (start) openChapter(start.id, null);
    if (LANG === 'python' && location.hash === '#overview') setView('dashboard');
    else { const initial = location.hash.replace('#', '') || 'dashboard'; if ($(`#view-${initial}`)) setView(initial); }
  }

  function switchLang(lang) {
    if (lang === LANG || (lang !== 'java' && lang !== 'python')) return;
    LANG = lang;
    try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
    activeChapter = null; activeExercise = null; activeLessonIndex = 0; activeExerciseIndex = 0;
    if (feedback) feedback.innerHTML = '';
    setView('dashboard');
    init();
  }
  $$('.lang-btn').forEach(b => b.addEventListener('click', () => switchLang(b.dataset.lang)));

  init();
})();
