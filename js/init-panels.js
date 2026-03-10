/* ============================================================
   init-panels.js — Read-only portfolio panels for `init` mode
   Creates a tiled 3-pane layout:
     Left-top  : profile image + shorter-about + contact
     Right     : skills + projects  (full height)
     Left-bottom: the calling interactive terminal
   ============================================================ */

'use strict';

const InitPanels = (() => {

  const GAP          = 12;   // px gap between panels
  const MIN_TERM_H   = 220;  // min height for the caller terminal
  const MOBILE_BP    = 600;  // must match CSS / Draggable constant
  const TABLET_BP    = 900;

  let leftPanel      = null;
  let rightPanel     = null;
  let _active        = false;
  let _caller        = null;
  let _resizeHandler = null;

  // ── Build a blank panel shell ────────────────────────────
  function createShell(titleLabel) {
    const win = document.createElement('div');
    win.className = 'terminal-window info-panel';

    // Fixed position — layout() will set coordinates
    win.style.cssText = 'position:fixed; z-index:5; opacity:0;';

    win.innerHTML =
      `<div class="titlebar info-titlebar">` +
        `<span class="dot dot-red"></span>` +
        `<span class="dot dot-yellow"></span>` +
        `<span class="dot dot-green"></span>` +
        `<span class="titlebar-label">${titleLabel}</span>` +
      `</div>` +
      `<div class="terminal-body" style="display:flex;flex-direction:column;overflow:hidden;">` +
        `<div class="info-output"></div>` +
      `</div>`;

    return win;
  }

  // SEC-6: Strip dangerous elements/attributes from parsed Markdown before insertion.
  function sanitiseHtml(el) {
    el.querySelectorAll('script,iframe,object,embed,form,base').forEach(n => n.remove());
    el.querySelectorAll('*').forEach(node => {
      [...node.attributes].forEach(attr => {
        if (/^on/i.test(attr.name)) {
          node.removeAttribute(attr.name);
        }
        if ((attr.name === 'href' || attr.name === 'src' || attr.name === 'action') &&
            /^\s*javascript:/i.test(attr.value)) {
          node.removeAttribute(attr.name);
        }
      });
    });
  }

  // ── Content helpers ──────────────────────────────────────
  function appendMarkdown(outputEl, mdText) {
    const div = document.createElement('div');
    div.className = 'md-render';
    div.innerHTML = marked.parse(mdText);
    sanitiseHtml(div); // SEC-6: sanitise before link processing
    div.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
    });
    outputEl.appendChild(div);
  }

  function appendProfileImg(outputEl) {
    const img = document.createElement('img');
    img.src       = 'content/images/mypic.jpg';
    img.alt       = 'Profile picture';
    img.className = 'info-profile-pic';
    outputEl.appendChild(img);
  }

  function appendHR(outputEl) {
    const div = document.createElement('div');
    div.className   = 'info-section-hr';
    div.textContent = '────────────────────────────────────';
    outputEl.appendChild(div);
  }

  async function safeFetch(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      return null;
    }
  }

  // ── Populate left panel ──────────────────────────────────
  async function populateLeft(panel) {
    const out = panel.querySelector('.info-output');

    const [about, contact] = await Promise.all([
      safeFetch('content/shorter-about.md'),
      safeFetch('content/contact.md'),
    ]);

    // Split shorter-about.md: intro (before first ##) vs rest (## Stack onward)
    const splitAt  = about ? about.indexOf('\n## ') : -1;
    const introMd  = about ? (splitAt !== -1 ? about.slice(0, splitAt) : about) : '';
    const restMd   = about && splitAt !== -1 ? about.slice(splitAt) : '';

    // VIS-5: Collect sections to add stagger delays
    const sections = [];

    // 1. Two-column profile card: image left, intro text right
    const card = document.createElement('div');
    card.className = 'profile-card panel-section';
    sections.push(card);

    const imgCol = document.createElement('div');
    imgCol.className = 'profile-card-img';
    appendProfileImg(imgCol);
    card.appendChild(imgCol);

    const bioCol = document.createElement('div');
    bioCol.className = 'profile-card-bio';
    if (introMd) appendMarkdown(bioCol, introMd);
    card.appendChild(bioCol);

    // 2. Remaining sections (## Stack, ## Currently, …)
    if (restMd) {
      const restDiv = document.createElement('div');
      restDiv.className = 'panel-section';
      appendMarkdown(restDiv, restMd);
      sections.push(restDiv);
    }

    const hrEl = document.createElement('div');
    hrEl.className   = 'info-section-hr panel-section';
    hrEl.textContent = '────────────────────────────────────';
    sections.push(hrEl);

    // 3. Contact
    if (contact) {
      const contactDiv = document.createElement('div');
      contactDiv.className = 'panel-section';
      appendMarkdown(contactDiv, contact);
      sections.push(contactDiv);
    }

    // Apply stagger delays and append
    sections.forEach((sec, i) => {
      sec.style.animationDelay = `${i * 80}ms`;
      sec.classList.add('panel-section-in');
      out.appendChild(sec);
    });
  }

  // ── Populate right panel ─────────────────────────────────
  async function populateRight(panel) {
    const out = panel.querySelector('.info-output');

    // 1. Skills
    const skills = await safeFetch('content/skills.md');
    if (skills) {
      const skillsDiv = document.createElement('div');
      skillsDiv.className = 'panel-section panel-section-in';
      skillsDiv.style.animationDelay = '0ms';
      appendMarkdown(skillsDiv, skills);
      out.appendChild(skillsDiv);
    }

    const hrEl = document.createElement('div');
    hrEl.className   = 'info-section-hr panel-section panel-section-in';
    hrEl.style.animationDelay = '80ms';
    hrEl.textContent = '────────────────────────────────────';
    out.appendChild(hrEl);

    // 2. Projects
    const projects = await safeFetch('content/projects.md');
    if (projects) {
      const projDiv = document.createElement('div');
      projDiv.className = 'panel-section panel-section-in';
      projDiv.style.animationDelay = '160ms';
      appendMarkdown(projDiv, projects);
      out.appendChild(projDiv);
    }
  }

  // ── Tiled layout ─────────────────────────────────────────
  function layout(callerWin) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Mobile: panels hidden via CSS, caller is full-screen
    if (vw <= MOBILE_BP) {
      callerWin.style.left   = '0px';
      callerWin.style.top    = '0px';
      callerWin.style.width  = `${vw}px`;
      callerWin.style.height = `${vh}px`;
      return;
    }

    // Tablet (601–900px): narrower left col
    const leftRatio = vw <= TABLET_BP ? 0.42 : 0.38;

    const g      = GAP;
    const leftW  = Math.floor((vw - 3 * g) * leftRatio);
    const rightW = vw - leftW - 3 * g;

    // Vertical split for the left column
    // Caller terminal gets at least MIN_TERM_H or 30% of vh
    const callerH     = Math.max(MIN_TERM_H, Math.floor(vh * 0.30));
    const leftPanelH  = vh - callerH - 3 * g;
    const rightH      = vh - 2 * g;

    // Left info panel — top-left
    leftPanel.style.left   = `${g}px`;
    leftPanel.style.top    = `${g}px`;
    leftPanel.style.width  = `${leftW}px`;
    leftPanel.style.height = `${leftPanelH}px`;

    // Right panel — full height on the right
    rightPanel.style.left   = `${leftW + 2 * g}px`;
    rightPanel.style.top    = `${g}px`;
    rightPanel.style.width  = `${rightW}px`;
    rightPanel.style.height = `${rightH}px`;

    // Caller terminal — bottom-left
    callerWin.style.left   = `${g}px`;
    callerWin.style.top    = `${leftPanelH + 2 * g}px`;
    callerWin.style.width  = `${leftW}px`;
    callerWin.style.height = `${callerH}px`;
  }

  // ── Fade in a panel ──────────────────────────────────────
  function fadeIn(el) {
    // Double rAF to ensure the browser has painted opacity:0 first
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.25s ease';
      el.style.opacity    = '1';
      el.addEventListener('transitionend', () => {
        el.style.transition = '';
      }, { once: true });
    }));
  }

  // ── Fade out and remove a panel ──────────────────────────
  function fadeOut(el, cb) {
    el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    el.style.opacity    = '0';
    el.style.transform  = (el.style.transform || '') + ' scale(0.97)';
    setTimeout(() => { if (el.parentNode) el.remove(); if (cb) cb(); }, 220);
  }

  // ── Public: start ────────────────────────────────────────
  async function start(callerWin) {
    if (_active) return;
    _active = true;
    _caller = callerWin;

    // Close all OTHER terminal windows
    document.querySelectorAll('.terminal-window').forEach(w => {
      if (w === callerWin) return;
      fadeOut(w);
    });

    // Build panel shells and add to DOM
    leftPanel  = createShell('profile');
    rightPanel = createShell('skills & projects');

    document.body.appendChild(leftPanel);
    document.body.appendChild(rightPanel);

    // Populate content concurrently
    await Promise.all([
      populateLeft(leftPanel),
      populateRight(rightPanel),
    ]);

    // Tile the layout then fade everything in
    layout(callerWin);
    fadeIn(leftPanel);
    fadeIn(rightPanel);

    // Bring caller to front and animate it to its new position
    callerWin.style.transition = 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease';
    layout(callerWin); // applies new coords
    callerWin.addEventListener('transitionend', () => {
      callerWin.style.transition = '';
    }, { once: true });

    // Listen for viewport resize
    _resizeHandler = () => layout(callerWin);
    window.addEventListener('resize', _resizeHandler);
  }

  // ── Public: stop ─────────────────────────────────────────
  function stop(callerWin) {
    if (!_active) return;
    _active = false;

    if (_resizeHandler) {
      window.removeEventListener('resize', _resizeHandler);
      _resizeHandler = null;
    }

    // Fade out and remove panels
    const lp = leftPanel;
    const rp = rightPanel;
    leftPanel  = null;
    rightPanel = null;

    if (lp) fadeOut(lp);
    if (rp) fadeOut(rp);

    // Restore caller window to centered viewport position
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w  = Math.min(860, Math.floor(vw * 0.9));
    const h  = Math.min(680, Math.floor(vh * 0.85));

    callerWin.style.transition = 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), ' +
                                 'top 0.35s cubic-bezier(0.34,1.56,0.64,1), ' +
                                 'width 0.3s ease, height 0.3s ease';
    callerWin.style.left   = `${Math.floor((vw - w) / 2)}px`;
    callerWin.style.top    = `${Math.floor((vh - h) / 2)}px`;
    callerWin.style.width  = `${w}px`;
    callerWin.style.height = `${h}px`;

    callerWin.addEventListener('transitionend', () => {
      callerWin.style.transition = '';
    }, { once: true });

    _caller = null;
  }

  // ── Public: query ────────────────────────────────────────
  function isActive() { return _active; }

  return { start, stop, isActive };

})();
