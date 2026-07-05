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

  /* ---------- Router de vistas ---------- */
  const tabs = $$('.tab');

  function setView(view) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === view)));
    const active = $(`#view-${view}`);
    if (active) active.focus({ preventScroll: true });
    closeNav();
    location.hash = view;
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

  /* ---------- Toggle online/offline (indicador) ---------- */
  const netBtn = $('#netBtn');
  netBtn?.addEventListener('click', () => {
    const off = netBtn.classList.toggle('offline');
    netBtn.setAttribute('aria-pressed', String(off));
    $('#netT').textContent = off ? 'Offline-Modus' : 'Synchronisiert';
    $('#netS').textContent = off ? 'Lokal gespeichert · Sync ausstehend' : 'Alle Inhalte lokal · aktuell';
  });

  /* ---------- Evaluación de código (mock hasta CheerpJ) ---------- */
  const runBtn = $('#runBtn'), feedback = $('#feedback'), code = $('#code');
  let EXPECTED = '7 ist ungerade'; // se actualiza al cargar cada ejercicio

  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // "compilador" mínimo para el ejercicio: detecta el String impreso en la rama que corre.
  // No ejecuta Java real — es feedback pedagógico determinista hasta integrar CheerpJ.
  // Llama al backend PHP (javac real). Devuelve la respuesta normalizada.
  async function runOnServer(src) {
    const res = await fetch('backend/run.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src }),
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
      return;
    }
    // error de compilación (javac real)
    if (r.phase === 'compile' && !r.ok) {
      feedback.innerHTML =
        `<div class="fb-bar err"><span class="fb-x">✕</span> Kompilierfehler</div>
         <div class="fb-body"><pre class="mono fb-console err-t">${esc(r.stderr || r.stdout || 'Kompilierfehler.')}</pre></div>`;
      return;
    }
    const stdout = (r.stdout || '').replace(/\s+$/, '');
    // error de ejecución (excepción en runtime, timeout ya viene con stderr)
    if (!r.ok && r.stderr) {
      feedback.innerHTML =
        `<div class="fb-bar err"><span class="fb-x">✕</span> Laufzeitfehler</div>
         <div class="fb-body">
           ${stdout ? `<div class="fb-label">Konsole</div><pre class="mono fb-console">${esc(stdout)}</pre>` : ''}
           <pre class="mono fb-console err-t">${esc(r.stderr)}</pre></div>`;
      return;
    }
    // ejecutó bien: comparar salida con lo esperado
    if (stdout === EXPECTED) {
      feedback.innerHTML =
        `<div class="fb-bar ok"><span class="fb-check">✓</span> Kompiliert · Alle Tests bestanden${r.ms != null ? ` · ${r.ms} ms` : ''}</div>
         <div class="fb-body"><pre class="mono fb-console">${esc(stdout)}</pre></div>`;
      return;
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
  }

  /* ---------- Editor: syntax-highlighting overlay (vanilla, sin deps) ---------- */
  const gutter = $('#gutter'), hlCode = $('#hl')?.firstElementChild;

  const KW = new Set(('abstract assert boolean break byte case catch char class const continue ' +
    'default do double else enum extends final finally float for goto if implements import ' +
    'instanceof int interface long native new package private protected public return short ' +
    'static strictfp super switch synchronized this throw throws transient try void volatile ' +
    'while var record sealed permits yield true false null').split(' '));
  const TYPES = new Set(('String System Integer Double Boolean Object Math List ArrayList Map ' +
    'HashMap Set HashSet Scanner Exception RuntimeException Character Long Float Byte Short ' +
    'StringBuilder Arrays Collections Comparable Comparable Iterator Optional').split(' '));

  const TOKEN = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(@\w+)|(\b\d[\d_]*\.?\d*[fFdDlL]?\b)|([A-Za-z_$][\w$]*)|([+\-*/%=<>!&|^~?:]+)/g;

  function highlight(src) {
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

  function syncGutter(src) {
    const n = src.split('\n').length;
    let g = '';
    for (let i = 1; i <= n; i++) g += (i > 1 ? '\n' : '') + i;
    if (gutter) gutter.textContent = g;
  }

  function paint() {
    if (!code || !hlCode) return;
    let v = code.value;
    if (v[v.length - 1] === '\n') v += ' '; // trailing newline visible
    hlCode.innerHTML = highlight(v);
    syncGutter(code.value);
  }

  function syncScroll() {
    const hl = $('#hl');
    if (hl) { hl.scrollTop = code.scrollTop; hl.scrollLeft = code.scrollLeft; }
    if (gutter) gutter.scrollTop = code.scrollTop;
  }

  if (code && hlCode) {
    code.addEventListener('input', paint);
    code.addEventListener('scroll', syncScroll);
    code.addEventListener('keydown', e => {
      if (e.key === 'Tab') { // Tab inserta 4 espacios en vez de saltar foco
        e.preventDefault();
        const s = code.selectionStart, en = code.selectionEnd;
        code.value = code.value.slice(0, s) + '    ' + code.value.slice(en);
        code.selectionStart = code.selectionEnd = s + 4;
        paint();
      }
    });
    paint();
  }

  runBtn?.addEventListener('click', async () => {
    renderRunning();
    runBtn.disabled = true;
    try {
      renderResult(await runOnServer(code.value));
    } catch (e) {
      renderResult({ __net: String(e && e.message || e) });
    } finally {
      runBtn.disabled = false;
    }
  });

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
    ['EF', 'Q1', 'Q2'].forEach(ph => {
      const chs = CONTENT.chapters.filter(c => c.phase === ph);
      if (!chs.length) return;
      const [lbl, badge, locked] = PHASE[ph];
      html += `<div class="nav-group-hd${locked ? ' locked' : ''}"><span>${esc(lbl)}</span>` +
              (badge ? `<span style="color:var(--accent)">${esc(badge)}</span>` : (locked ? ICON.lockSm : '')) + `</div>`;
      chs.forEach(c => { html += navItem(c); });
    });
    nav.innerHTML = html;
  }

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
    body.innerHTML = les.blocks.map(blockHTML).join('');

    const prevBtn = $('#lesPrevBtn'), nextBtn = $('#lesNextBtn');
    const hasEx = ch.exercises && ch.exercises.length;
    if (prevBtn) prevBtn.textContent = activeLessonIndex > 0 ? '◄ Vorherige Lektion' : '◄ Zurück';
    if (nextBtn) {
      nextBtn.textContent = activeLessonIndex < n - 1 ? 'Nächste Lektion ►' : (hasEx ? 'Zur Übung ►' : 'Fertig ►');
      nextBtn.style.display = (activeLessonIndex === n - 1 && !hasEx) ? 'none' : '';
    }
  }

  function selectLesson(idx) {
    if (!activeChapter) return;
    activeLessonIndex = idx;
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
  $('#lesNextBtn')?.addEventListener('click', () => {
    const n = (activeChapter && activeChapter.lessons || []).length;
    if (activeLessonIndex < n - 1) selectLesson(activeLessonIndex + 1);
    else setView('exercise');
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

  function renderExercise(ch) {
    const p = $('#exPrompt');
    const n = (ch.exercises || []).length;
    activeExerciseIndex = Math.max(0, Math.min(activeExerciseIndex, n - 1));
    const ex = ch.exercises && ch.exercises[activeExerciseIndex];
    if (!ex) { activeExercise = null; if (p) p.innerHTML = '<p class="prompt-p">Keine Übung in diesem Kapitel.</p>'; return; }
    activeExercise = ex; EXPECTED = ex.expected;
    const pills = n > 1 ? `<div class="les-pills">` + ch.exercises.map((e, i) =>
      `<button class="les-pill${i === activeExerciseIndex ? ' active' : ''}" data-ex-idx="${i}">${i + 1}</button>`).join('') + `</div>` : '';
    p.innerHTML = pills +
      `<div><span class="prompt-tag">${esc(ch.nr)} · Übung</span><span class="prompt-diff">${esc(DIFF[ex.difficulty] || '')}</span></div>
       <h1 class="prompt-title">${esc(ex.title)}</h1>
       <p class="prompt-p">${ex.prompt_html}</p>
       <div class="card card-pad prompt-expected"><div class="k">Erwartete Ausgabe</div><pre>${esc(ex.expected)}</pre></div>` +
      (ex.tip_html ? `<div class="prompt-tip"><span>💡</span><div><div class="c-title">Tipp</div><div class="c-body">${ex.tip_html}</div></div></div>` : '');
    if (code) { code.value = ex.starter || ''; paint(); }
    if (feedback) feedback.innerHTML = '';
  }

  function openChapter(id, view, lessonIndex) {
    const ch = CONTENT && CONTENT.chapters.find(c => c.id === id); if (!ch) return;
    activeChapter = ch;
    activeLessonIndex = lessonIndex != null ? lessonIndex : (ch.resumeLessonIndex || 0);
    activeExerciseIndex = 0;
    $$('#chapterNav [data-chapter]').forEach(b => b.setAttribute('aria-current', String(b.dataset.chapter === id)));
    if (ch.isProject) { renderProject(ch); if (view) setView('project'); return; }
    renderLesson(ch); renderExercise(ch);
    if (view) setView(view);
  }

  $('#chapterNav')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-chapter]');
    if (btn) openChapter(btn.dataset.chapter, 'lesson');
  });

  function renderProject(ch) {
    const p = ch.project; if (!p) return;
    $('#prTag').textContent = p.tag || 'Kapitel abgeschlossen';
    $('#prTitle').textContent = p.title;
    $('#prIntro').textContent = p.intro || '';
    $('#prDesc').innerHTML = p.description_html || '';
    $('#prStats').innerHTML = (p.stats || []).map(s =>
      `<div class="card" style="padding:16px 22px;min-width:110px"><div style="font-size:24px;font-weight:700;color:var(--accent)">${esc(s.value)}</div><div style="font-size:11.5px;color:var(--mut2)">${esc(s.label)}</div></div>`
    ).join('');
  }

  /* ---------- Dashboard: resume card + Lernpfad (data-driven, clickeable) ---------- */
  function findCurrentChapter() {
    return CONTENT.chapters.find(c => c.status === 'current' && !c.isProject) ||
           CONTENT.chapters.find(c => !c.isProject);
  }

  function renderResumeCard(ch) {
    const box = $('#resumeCard'); if (!box) return;
    const idx = ch.resumeLessonIndex || 0;
    const les = ch.lessons[idx];
    const n = ch.lessons.length;
    const firstP = (les.blocks.find(b => b.type === 'p') || {}).html || '';
    box.innerHTML =
      `<p class="resume-tag">Fortsetzen · <span class="sub">Kapitel ${esc(ch.nr)} · ${esc(ch.title)}</span></p>
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
    const efChapters = CONTENT.chapters.filter(c => c.phase === 'EF');
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
    openChapter(ch.id, 'lesson', ch.resumeLessonIndex || 0);
  });

  function renderDashboard() {
    const ch = findCurrentChapter();
    renderResumeCard(ch);
    renderLernpfad();
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

  async function init() {
    try {
      CONTENT = await (await fetch('content/content.json')).json();
    } catch (e) {
      console.error('Konnte content.json nicht laden:', e);
      return;
    }
    renderSidebar();
    renderDashboard();
    renderOverview();
    const start = CONTENT.chapters.find(c => c.status === 'current') || CONTENT.chapters[0];
    if (start) openChapter(start.id, null);
    // deep-link por hash (tras cargar contenido)
    const initial = location.hash.replace('#', '') || 'dashboard';
    if ($(`#view-${initial}`)) setView(initial);
  }
  init();
})();
