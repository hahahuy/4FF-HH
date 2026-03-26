const ContextMenu = (() => {
  let menuEl = null;
  let template = null; // deep-clone of the original window, captured at init

  // ── Build DOM ─────────────────────────────────────────────
  function build() {
    menuEl = document.createElement("div");
    menuEl.id = "bg-context-menu";
    menuEl.setAttribute("role", "menu");
    menuEl.setAttribute("aria-label", "Background options");

    const items = [
      {
        icon: "⬡",
        label: "Normal Portfolio",
        action: () =>
          window.open("https://normal.hahuy.site/", "_blank", "noopener,noreferrer"),
      },
      { separator: true },
      {
        icon: "✕",
        label: "Close all terminal windows",
        action: closeAllWindows,
      },
      {
        icon: "+",
        label: "Create new terminal window",
        action: createNewWindow,
      },
    ];

    items.forEach((item) => {
      if (item.separator) {
        const sep = document.createElement("div");
        sep.className = "ctx-separator";
        menuEl.appendChild(sep);
        return;
      }

      const el = document.createElement("div");
      el.className = "ctx-item";
      el.setAttribute("role", "menuitem");
      el.setAttribute("tabindex", "-1");
      el.innerHTML = `<span class="ctx-icon">${item.icon}</span>` + `<span>${item.label}</span>`;

      el.addEventListener("click", () => {
        hide();
        item.action();
      });

      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          hide();
          item.action();
        }
      });

      menuEl.appendChild(el);
    });

    document.body.appendChild(menuEl);
  }

  // ── Show / hide ───────────────────────────────────────────
  function show(x, y) {
    if (!menuEl) build();

    // Reset then make visible to measure
    menuEl.classList.remove("visible");
    menuEl.style.left = "0px";
    menuEl.style.top = "0px";

    // Position — clamp to viewport
    requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mw = menuEl.offsetWidth || 210;
      const mh = menuEl.offsetHeight || 120;

      menuEl.style.left = `${Math.min(x, vw - mw - 8)}px`;
      menuEl.style.top = `${Math.min(y, vh - mh - 8)}px`;
      menuEl.classList.add("visible");

      // Focus first item for keyboard nav
      const first = menuEl.querySelector(".ctx-item");
      if (first) first.focus();
    });
  }

  function hide() {
    if (!menuEl) return;
    menuEl.classList.remove("visible");
  }

  // ── Actions ───────────────────────────────────────────────
  function closeAllWindows() {
    document.querySelectorAll(".terminal-window").forEach((w) => {
      w.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      w.style.opacity = "0";
      w.style.transform = (w.style.transform || "") + " scale(0.95)";
      setTimeout(() => w.remove(), 200);
    });
  }

  // ── Z-index management (cap at 9999 to avoid runaway growth) ─
  const Z_BASE = 10;
  const Z_MAX = 9999;
  let _zTop = Z_BASE;

  function bringToFront(winEl) {
    if (_zTop >= Z_MAX) {
      // Reset all windows back to base + their stacking order
      const windows = [...document.querySelectorAll(".terminal-window")];
      windows.forEach((w, i) => {
        // @ts-ignore — zIndex accepts numbers at runtime even though DOM types it as string
        w.style.zIndex = Z_BASE + i;
      });
      _zTop = Z_BASE + windows.length;
    } else {
      _zTop++;
    }
    winEl.style.zIndex = _zTop;
  }

  function createNewWindow() {
    if (!template) return;

    const clone = template.cloneNode(true);

    // Remove IDs to avoid collisions — createTerminal uses class selectors
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));

    // Offset so it doesn't sit exactly on top of existing windows
    const existing = document.querySelectorAll(".terminal-window");
    const offset = 32 * (existing.length + 1);
    clone.style.transform = `translate(${offset}px, ${offset}px)`;

    // VIS-2: Spring scale-in animation
    clone.style.animation = "window-open 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards";

    document.body.appendChild(clone);

    // Post-append max-z scan: read live z-indices (includes Draggable-raised windows)
    const allWins = [...document.querySelectorAll(".terminal-window")];
    const maxZ = allWins.reduce(
      (m, w) => Math.max(m, Number.parseInt(w.style.zIndex, 10) || 10),
      10,
    );
    clone.style.zIndex = maxZ + 1;
    _zTop = Math.max(_zTop, maxZ + 1);

    // Wire drag + resize (pinToScreen runs inside rAF, so this is safe)
    if (App.Draggable?.init) {
      App.Draggable.init(clone);
    }

    // Boot a fresh independent terminal inside the clone
    if (typeof createTerminal === "function") {
      createTerminal(clone).init();
    }
  }

  // ── Global event wiring ───────────────────────────────────
  function init() {
    // Capture a clean template clone BEFORE anything can be closed
    const original = document.querySelector(".terminal-window");
    if (original) {
      template = original.cloneNode(true);
      // Strip live output from template so every new window starts fresh
      const tmplOutput = template.querySelector(".output");
      if (tmplOutput) tmplOutput.innerHTML = "";
    }
    // Right-click on background (not on a terminal window)
    document.addEventListener("contextmenu", (e) => {
      if (document.body.classList.contains("name-wall-active")) return;
      // Only intercept clicks on the background, not inside terminal windows
      if (e.target.closest(".terminal-window")) return;

      e.preventDefault();
      show(e.clientX, e.clientY);
    });

    // Click anywhere else → hide
    document.addEventListener("click", (e) => {
      if (!menuEl) return;
      if (!menuEl.contains(e.target)) hide();
    });

    // Escape key → hide
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hide();
    });
  }

  return { init };
})();

App.ContextMenu = ContextMenu; // publish to App namespace

document.addEventListener("DOMContentLoaded", () => ContextMenu.init());
