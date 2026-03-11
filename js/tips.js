/* ============================================================
   tips.js — Floating command-tip widget (desktop only)
   Auto-inits on DOMContentLoaded. Hidden at ≤900px via CSS.
   ============================================================ */

'use strict';

const Tips = (() => {

  // ── Tip definitions ───────────────────────────────────────
  // Each tip has a display fragment (HTML) and an optional
  // "run" string that fills the input when the bubble is clicked.
  const TIPS = [
    {
      html: `Try <span class="tip-cmd">message --name &lt;you&gt;</span> to send me a live message`,
      run:  'message --name ',
    },
    {
      html: `Type <span class="tip-cmd">fortune</span> for a random wise word`,
      run:  'fortune',
    },
    {
      html: `<span class="tip-cmd">weather Ho Chi Minh</span> → <span class="tip-value">live weather</span>`,
      run:  'weather Ho Chi Minh',
    },
    {
      html: `Grab my resume: <span class="tip-cmd">download resume</span>`,
      run:  'download resume',
    },
    {
      html: `Run <span class="tip-cmd">init</span> for a full portfolio overview`,
      run:  'init',
    },
  ];

  const INTERVAL_MS  = 8000;   // rotate every 8 s
  const FLIP_OUT_MS  = 320;    // duration of flip-out animation
  const FLIP_IN_MS   = 280;    // duration of flip-in animation
  const DISMISSED_KEY = Config.STORAGE.TIPS;

  let current  = 0;
  let timer    = null;
  let widget   = null;
  let bubbleEl = null;
  let textEl   = null;

  // ── Build DOM ─────────────────────────────────────────────
  function build() {
    widget = document.createElement('div');
    widget.id = 'tips-widget';
    widget.setAttribute('aria-live', 'polite');
    widget.setAttribute('aria-label', 'Terminal tip');

    // Avatar
    const avatar = document.createElement('div');
    avatar.id = 'tips-avatar';
    avatar.textContent = '>_';

    // Bubble
    bubbleEl = document.createElement('div');
    bubbleEl.id = 'tips-bubble';

    // Dismiss button (×)
    const dismiss = document.createElement('span');
    dismiss.id = 'tips-dismiss';
    dismiss.title = 'Dismiss tips';
    dismiss.textContent = '×';
    dismiss.addEventListener('click', (e) => {
      e.stopPropagation();
      permanentlyDismiss();
    });

    // Label
    const label = document.createElement('div');
    label.id = 'tips-label';
    label.textContent = '💡 tip';

    // Text
    textEl = document.createElement('div');
    textEl.id = 'tips-text';

    bubbleEl.appendChild(dismiss);
    bubbleEl.appendChild(label);
    bubbleEl.appendChild(textEl);

    // Click bubble → fill the terminal input with the tip's run command
    bubbleEl.addEventListener('click', () => {
      const tip = TIPS[current];
      if (!tip.run) return;
      // Find the active (focused or first) terminal input
      const input = document.querySelector('.terminal-window:not([style*="display: none"]) .terminal-input')
                 || document.querySelector('.terminal-input');
      if (!input) return;
      input.value = tip.run;
      input.focus();
      // Trigger ghost-text update if the terminal exposes it
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    widget.appendChild(avatar);
    widget.appendChild(bubbleEl);
    document.body.appendChild(widget);
  }

  // ── Render tip at `index` ──────────────────────────────────
  function showTip(index) {
    textEl.innerHTML = TIPS[index].html;
  }

  // ── Animate to next tip ───────────────────────────────────
  function rotate() {
    // 1. Flip out
    bubbleEl.classList.remove('flip-in');
    bubbleEl.classList.add('flip-out');

    setTimeout(() => {
      // 2. Update content
      current = (current + 1) % TIPS.length;
      showTip(current);

      // 3. Flip in
      bubbleEl.classList.remove('flip-out');
      bubbleEl.classList.add('flip-in');

      // Clean up flip-in class after animation completes
      setTimeout(() => bubbleEl.classList.remove('flip-in'), FLIP_IN_MS);
    }, FLIP_OUT_MS);
  }

  // ── Permanent dismiss ─────────────────────────────────────
  function permanentlyDismiss() {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch (e) {}
    if (widget) {
      widget.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      widget.style.opacity    = '0';
      widget.style.transform  = 'translateY(12px)';
      setTimeout(() => widget.remove(), 260);
    }
    if (timer) clearInterval(timer);
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Don't show if user has dismissed or if on a small screen
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch (e) {}
    if (window.matchMedia('(max-width: 900px)').matches) return;

    build();
    showTip(0);

    // Start rotation timer
    timer = setInterval(rotate, INTERVAL_MS);

    // Pause timer while user is actively typing in any terminal
    document.addEventListener('focusin', (e) => {
      if (e.target && e.target.classList.contains('terminal-input')) {
        clearInterval(timer);
        timer = null;
      }
    });
    document.addEventListener('focusout', (e) => {
      if (e.target && e.target.classList.contains('terminal-input')) {
        if (!timer) timer = setInterval(rotate, INTERVAL_MS);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init };

})();

App.Tips = Tips;  // publish to App namespace
