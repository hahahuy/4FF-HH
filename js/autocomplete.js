/* ============================================================
   autocomplete.js — Tab Completion Logic
   ============================================================ */

'use strict';

const Autocomplete = (() => {

  const inputEl        = document.getElementById('terminalInput');
  const ghostTextEl    = document.getElementById('ghostText');
  const autocompleteEl = document.getElementById('autocompleteList');

  // Cycle state
  let cycleMatches  = [];
  let cycleIndex    = -1;
  let cycleBase     = '';   // text before the completion token
  let cycleToken    = '';   // token being completed

  // ── Tokenise input ────────────────────────────────────────
  // Returns { base, token }
  // base = everything before the final partial word
  // token = the partial word being completed
  function tokenise(input) {
    // Split on spaces but keep base
    const lastSpace = input.lastIndexOf(' ');
    if (lastSpace === -1) {
      return { base: '', token: input };
    }
    return {
      base: input.slice(0, lastSpace + 1),
      token: input.slice(lastSpace + 1),
    };
  }

  // ── Build candidate list ──────────────────────────────────
  function getCandidates(input, currentPath) {
    const { base, token } = tokenise(input);
    const parts = input.trimStart().split(/\s+/);
    const isFirstWord = parts.length === 1 && !input.endsWith(' ');

    let candidates;

    if (isFirstWord) {
      // Complete command names
      candidates = Commands.names();
    } else {
      // Complete filenames / dirnames in current virtual dir
      candidates = fsEntriesAt(currentPath);
    }

    const lower = token.toLowerCase();
    const matches = candidates.filter(c => c.toLowerCase().startsWith(lower));

    return { base, token, matches };
  }

  // ── Ghost text (single match inline hint) ─────────────────
  function updateGhost(input, currentPath) {
    if (!input) {
      ghostTextEl.textContent = '';
      return;
    }
    const { base, token, matches } = getCandidates(input, currentPath);
    if (matches.length === 1 && token.length > 0) {
      // Show the completion suffix as ghost
      const completion = matches[0];
      const suffix = completion.slice(token.length);
      // Ghost text must align with the typed text
      ghostTextEl.textContent = input + suffix;
    } else {
      ghostTextEl.textContent = '';
    }
  }

  // ── Tab trigger ───────────────────────────────────────────
  function trigger(input, currentPath) {
    const { base, token, matches } = getCandidates(input, currentPath);

    if (matches.length === 0) {
      // Nothing to complete
      hide();
      ghostTextEl.textContent = '';
      return;
    }

    if (matches.length === 1) {
      // Complete immediately
      inputEl.value = base + matches[0];
      ghostTextEl.textContent = '';
      hide();
      resetCycle();
      return;
    }

    // Multiple matches — check if we're already cycling
    const startingNewCycle =
      cycleMatches.join(',') !== matches.join(',') ||
      cycleBase !== base;

    if (startingNewCycle) {
      cycleMatches = matches;
      cycleBase    = base;
      cycleToken   = token;
      cycleIndex   = -1;
    }

    // Advance cycle
    cycleIndex = (cycleIndex + 1) % cycleMatches.length;
    inputEl.value = cycleBase + cycleMatches[cycleIndex];
    ghostTextEl.textContent = '';

    // Show suggestion list
    showList(cycleMatches, cycleIndex);
  }

  // ── Show list below prompt ────────────────────────────────
  function showList(matches, activeIndex) {
    autocompleteEl.innerHTML = '';
    matches.forEach((m, i) => {
      const span = document.createElement('span');
      span.className = 'autocomplete-item' + (i === activeIndex ? ' current' : '');
      span.textContent = m;
      autocompleteEl.appendChild(span);
    });
    autocompleteEl.hidden = false;
  }

  // ── Hide list ─────────────────────────────────────────────
  function hide() {
    autocompleteEl.hidden = true;
    autocompleteEl.innerHTML = '';
  }

  // ── Reset cycle state ─────────────────────────────────────
  function resetCycle() {
    cycleMatches = [];
    cycleIndex   = -1;
    cycleBase    = '';
    cycleToken   = '';
    hide();
  }

  return { trigger, updateGhost, hide, resetCycle };

})();
