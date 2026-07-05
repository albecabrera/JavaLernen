# Handoff: JavaLernen — Lernplattform (UI/UX)

> Paquete de traspaso para continuar el desarrollo en VS Code / Claude Code.
> Idioma del proyecto: alemán (por defecto), inglés, español.

---

## 1. Resumen

**JavaLernen** es una plataforma premium para aprender Java, alineada con el
*Kernlehrplan Informatik NRW* (Oberstufe, EF–Q2). Este paquete contiene los
**mockups de alta fidelidad** de las pantallas principales, con modo claro/oscuro,
tres idiomas y una función de invitación de alumnos (enlace + QR).

Arquitectura técnica ya fijada (ver `JavaLernen_Design_Brief.md`): PWA en **Vanilla
JS**, Service Worker + IndexedDB (offline), CheerpJ/WASM para ejecutar Java en el
navegador, backend PHP + SQLite. **Todo el diseño es implementable con Vanilla
JS/CSS** — no se usa nada que lo impida.

---

## 2. Sobre los archivos de diseño

Los archivos `.dc.html` de este paquete son **referencias de diseño creadas en
HTML** — prototipos que muestran el aspecto y el comportamiento buscados, **no
código de producción para copiar tal cual**. La tarea es **recrear estos diseños
en el entorno de destino** (la PWA Vanilla JS descrita en el brief) usando sus
patrones y librerías.

> ⚠️ Estos archivos usan un runtime propietario (`support.js`, componentes `<x-dc>`).
> Sirven para *ver e inspeccionar* el diseño, no como base de la app final.
> Extrae de ellos los valores exactos (colores, tipografía, espaciado, copy) y
> reconstruye la UI en HTML/CSS/JS planos.

### Cómo previsualizarlos en VS Code
1. Instala la extensión **Live Server** (o cualquier servidor estático).
2. Abre la carpeta en VS Code → clic derecho en `JavaLernen v2.dc.html` → *Open with Live Server*.
   (Debe servirse por HTTP; abrir el archivo con `file://` puede bloquear la carga del runtime.)
3. `support.js` debe estar en la misma carpeta (ya incluido).
4. El generador de QR se carga desde CDN (`qrcode-generator`) — requiere conexión
   para la vista previa. En la app real usa una librería QR local (offline-first).

---

## 3. Fidelidad

**Alta fidelidad (hi-fi).** Colores, tipografía, espaciado e interacciones son
finales. Recrear la Uin de forma fiel a los píxeles con la tooling del proyecto.
`v2` es la versión actual y completa; `v1` es la primera iteración (solo tema
oscuro, solo alemán) — conservada como referencia histórica.

---

## 4. Sistema de diseño (design tokens)

Definidos como variables CSS en el elemento raíz de `JavaLernen v2.dc.html`.
El **tema claro** sobrescribe estas variables (objeto `lightVars` en la clase lógica).

### 4.1 Color — Tema oscuro (por defecto)

| Rol | Token | Hex |
|---|---|---|
| Fondo app | `--bg` | `#08090B` |
| Barra lateral | `--sidebar` | `#0C0E11` |
| Panel / tarjeta | `--panel` | `#0E1114` |
| Panel 2 (editor) | `--panel2` | `#0B0E10` |
| Inset (input, consola) | `--inset` | `#08090B` |
| Elevado (botón sec.) | `--elev` | `#1C2228` |
| Borde | `--border` | `#191D22` |
| Borde 3 (pop/hover) | `--border3` | `#22272D` |
| Divisor | `--divider` | `#161A1F` |
| Texto principal | `--text` | `#E8EAED` |
| Texto 2 | `--text2` | `#C8CDD3` |
| Texto cuerpo | `--text3` | `#C2C7CD` |
| Subtexto | `--sub` | `#B4BAC1` |
| Muted | `--mut` | `#8B9199` |
| Muted 2 | `--mut2` | `#6B727A` |
| Faint | `--faint` | `#5F666E` |
| Deshabilitado | `--dis` | `#565C64` |
| **Acento (éxito/progreso)** | `--accent` | `#34D399` |
| Acento oscuro | `--accent2` | `#10B981` |
| Sobre acento (texto) | `--on-accent` | `#06231A` |

### 4.2 Color — Tema claro (overrides principales)

| Rol | Hex |
|---|---|
| Fondo app | `#F4F5F6` |
| Panel / tarjeta | `#FFFFFF` |
| Barra lateral | `#FBFBFC` |
| Texto principal | `#191C1F` |
| Muted | `#667079` |
| **Acento** | `#0E9F6E` (verde más profundo para contraste sobre blanco) |
| Sobre acento | `#FFFFFF` |
| Borde | `#E6E8EC` |

> Nota: `document.body.style.background` se sincroniza con el tema (`#08090B` / `#F4F5F6`)
> para que no aparezca el fondo del navegador durante el scroll.

### 4.3 Colores semánticos (chips, callouts, feedback)

| Rol | Oscuro | Claro |
|---|---|---|
| Info (azul) | `--info #7DD3FC` | `#0284C7` |
| Aviso (ámbar) | `--warn #F59E0B` | `#B45309` |
| Error (rojo) | `--err #F87171` | `#DC2626` |
| Tip (violeta) | `--tip #C4A0FF` | `#7C3AED` |

### 4.4 Syntax highlighting (editor de código)

| Token | Oscuro | Claro |
|---|---|---|
| Palabra clave | `--code-kw #C4A0FF` | `#7C3AED` |
| Tipo / clase | `--code-type #5CC8FF` | `#0967A6` |
| Función / método | `--code-fn #7DD3FC` | `#0284C7` |
| String | `--code-str #98D387` | `#157F3C` |
| Número | `--code-num #E3B778` | `#B45309` |
| Operador | `--code-op #89DDFF` | `#0E7490` |
| Texto código | `--code-text #C9CDD3` | `#24292F` |
| Nº de línea | `--code-ln #3D444B` | `#B8BFC7` |

### 4.5 Tipografía

- **UI:** `Geist` (Google Fonts), pesos 400/500/600/700.
- **Código / monospace:** `JetBrains Mono`, pesos 400/500/600.
- Escala usada (px): 30 (h1 lección/proyecto), 27 (saludo), 22 (h1 ejercicio),
  20 (h2 tarjeta), 19 (h2 sección), 15.5 (cuerpo), 13.5 (código, por defecto),
  12–13 (UI), 11 (etiquetas mayúsculas).
- **Tamaño del editor** (ajuste `--code-size`): S `12px`, M `13.5px`, L `15px`.
- `letter-spacing` negativo en titulares (−0.3 a −0.7px). Mayúsculas de sección:
  `text-transform:uppercase; letter-spacing:0.5–0.6px`.

### 4.6 Radios, sombras, espaciado

- Border-radius: botones/inputs `8–9px`, tarjetas `14–16px`, modal `20px`,
  chips `6–7px`, avatares/dots `50%`.
- Sombra popover/modal: `0 24px 60px rgba(0,0,0,0.55)` (oscuro) / `rgba(20,24,28,0.16)` (claro).
- Sombra botón acento: `0 6px 18px rgba(52,211,153,0.26)`.
- Layout: barra lateral fija `284px`; barra superior `60px`; contenido central
  `max-width 820–1120px` centrado; dashboard en grid `1fr / 320px`.

---

## 5. Pantallas / vistas

Navegación por segmented control en la barra superior. Estado `view` ∈
`dashboard | lesson | exercise | project`.

### 5.1 Barra lateral (Sidebar)
- Logo + subtítulo de fase. Lista del **camino de aprendizaje EF** con estados:
  completado (check verde), actual (anillo con dot + barra de progreso + glow),
  bloqueado (candado). Teasers Q1/Q2 bloqueados.
- Pie: **indicador offline** (botón que alterna *Sincronizado* ↔ *Modo offline*).
- Se **oculta** con el *Modo enfoque* (ajuste `focus`).

### 5.2 Barra superior (Topbar)
- Segmented control de vistas · pill de streak (12) · pill de XP (2 480) ·
  botón **Invitar** · botón **ajustes** (⚙) · avatar.

### 5.3 Dashboard
- Saludo + fecha; botón primario *Weiter lernen*.
- Grid `1fr / 320px`:
  - **Izquierda:** tarjeta "Continuar" (lección actual + progreso 60%), fila de
    3 stats (Streak/XP/Abzeichen), tarjeta "Camino de aprendizaje" (6 capítulos con estado).
  - **Derecha (rail):** widget de nivel (anillo SVG, nivel 6, 680/1000 XP),
    "Zuletzt verdient" (3 insignias recientes).

### 5.4 Lección (Theorie)
- Migas de pan, etiqueta *Theorie* + tiempo de lectura, h1 con `if / else`.
- Prosa + bloque de código resaltado (`Volljaehrig.java`), callout azul,
  grid de operadores de comparación, navegación anterior/→ ejercicio.

### 5.5 Ejercicio (Übung)
- Grid `400px / 1fr`, alto completo (`grid-template-rows: minmax(0,1fr)`).
  - **Izquierda:** enunciado, salida esperada, tip.
  - **Derecha:** cabecera con nombre de archivo + botón **Ausführen**; editor con
    números de línea y resaltado; panel de feedback.
- **Feedback tras "Ausführen"** (estado `ran`): estado de compilación, consola,
  **diff Erwartet/Erhalten** (verde/rojo), análisis pedagógico del error en ámbar.
  El ejemplo tiene un bug intencionado (textos par/impar intercambiados).

### 5.6 Proyecto / cierre de capítulo
- Icono con glow, "Kapitel 3 abgeschlossen", 3 métricas (+180 XP, 5/5, 98%),
  tarjeta de proyecto desbloqueado (*Kontoauszug-Generator*), enlace volver.

### 5.7 Modal "Invitar alumnos"
- Overlay centrado. Cabecera (icono + título + subtítulo + cerrar).
- **QR real** (generado en cliente con `qrcode-generator`, módulos `#0B0E10`
  sobre blanco) apuntando a `https://javalernen.app/join/JAVA-EF-7K2`.
- Campo de **enlace** + botón **Copiar** (feedback "¡Copiado!" 1.7 s vía
  `navigator.clipboard`), **código de clase** `JAVA-EF-7K2`, nombre de clase,
  nota de validez (30 días). Pie: avatares de alumnos unidos + "Por correo" + "Listo".

---

## 6. Interacciones y comportamiento

- **Navegación de vistas:** clic en segmented control o botones internos → cambia `view`; `ran` se resetea.
- **Ejecutar código:** `run` → `ran=true` muestra el panel de feedback (animación `jl-rise`).
  `reset` → oculta.
- **Ajustes (⚙):** popover con overlay para cerrar al clic fuera. Contiene:
  - Apariencia: **Oscuro / Claro** (segmented).
  - Idioma: **Deutsch / English / Español** (segmented).
  - Toggles: **Animaciones** (activa/desactiva `--rise/--glow/--dash`),
    **Modo enfoque** (oculta la barra lateral).
  - **Tamaño de editor:** S / M / L (cambia `--code-size`).
- **Invitar:** abre modal; copiar enlace; cerrar al clic en overlay/×/Listo.
- **Offline:** el pill de la barra lateral alterna estado online/offline (demo).
- **Animaciones:** `jl-rise` (entradas, .35s), `jl-glow` (pulso acento, 2.4s inf),
  `jl-dash` (dibujo del anillo, 1s), `jl-pop` (modal, .28s). Todas anulables.

---

## 7. Estado (state) y modelo i18n

Estado del componente (React-like en el prototipo; en la app real, estado propio):

```
view: 'dashboard'|'lesson'|'exercise'|'project'
online: boolean            // indicador de sincronización
ran: boolean               // ejercicio ejecutado → muestra feedback
settingsOpen: boolean
inviteOpen: boolean
copied: boolean            // feedback del botón copiar
theme: 'dark'|'light'      // null = usa prop/ default 'dark'
lang: 'de'|'en'|'es'       // null = default 'de'
anim: boolean
focus: boolean             // modo enfoque (oculta sidebar)
codeSize: 's'|'m'|'l'
```

**i18n:** todo el texto visible vive en el objeto `i18n` con claves por idioma
(`de`, `en`, `es`). En la app real, extraer a archivos de locale (p. ej. JSON) y
resolver por clave. Los textos con código embebido se dividen en fragmentos
(`p2a`,`p2b`…) alrededor de los `<code>`.

**Datos que en producción vienen del backend/IndexedDB:** progreso por capítulo,
streak, XP/nivel, insignias, código/enlace de clase, alumnos unidos, contenido de
lecciones y ejercicios (base curada + ejercicios generados vía Claude API).

---

## 8. Notas de implementación (Vanilla JS / PWA)

- **QR offline:** sustituir el CDN por una librería QR empaquetada localmente
  (cacheada por el Service Worker). El enlace/código deben venir del backend.
- **Ejecución de Java:** el botón *Ausführen* debe invocar CheerpJ/WASM y capturar
  stdout/errores; el panel de diff y el análisis en lenguaje sencillo se construyen
  a partir del resultado real (y/o Claude API para la explicación del error).
- **Tema/idioma persistentes:** guardar en `localStorage`/IndexedDB y aplicar al
  cargar (evitar flash de tema).
- **Accesibilidad:** objetivos táctiles ≥ 44px; el modal debería atrapar el foco y
  cerrarse con `Esc` (no implementado en el prototipo).

---

## 9. Archivos incluidos

| Archivo | Descripción |
|---|---|
| `JavaLernen v2.dc.html` | **Diseño actual** — todas las pantallas, claro/oscuro, 3 idiomas, invitar+QR. |
| `JavaLernen v1.dc.html` | Primera iteración (oscuro, alemán) — referencia. |
| `support.js` | Runtime del prototipo (necesario solo para previsualizar los `.dc.html`). |
| `JavaLernen_Design_Brief.md` | Brief original: visión, currículo, arquitectura, requisitos. |
| `README.md` | Este documento. |

---

*Los `.dc.html` son referencias de diseño. Reconstruir la UI en la PWA Vanilla JS
del proyecto tomando de aquí los valores exactos; no incrustar el runtime del prototipo.*
