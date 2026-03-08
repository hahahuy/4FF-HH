/* ============================================================
   autocomplete.js — Factory: AutocompleteFactory.makeAutocomplete(terminal, names)
   ============================================================ */

'use strict';

const AutocompleteFactory = (() => {

  /**
   * Wire tab-completion onto a terminal instance.
   * @param {object}   terminal      — TerminalFactory instance
   * @param {string[]} commandNames  — list of available command names
   */
  function makeAutocomplete(terminal, commandNames) {
    const inputEl        = terminal.inputEl;
    const ghostEl        = terminal.ghostEl;
    const autocompleteEl = terminal.autocompleteEl;

    // Cycle state (per instance)
    let cycleMatches = [];
    let cycleIndex   = -1;
    let cycleBase    = '';
    let cycleToken   = '';

    // ── Tokenise ──────────────────────────────────────────────
    function tokenise(input) {
      const lastSpace = input.lastIndexOf(' ');
      if (lastSpace === -1) return { base: '', token: input };
      return {
        base:  input.slice(0, lastSpace + 1),
        token: input.slice(lastSpace + 1),
      };
    }

    // ── Build candidate list ──────────────────────────────────
    function getCandidates(input) {
      const { base, token } = tokenise(input);
      const parts = input.trimStart().split(/\s+/);
      const isFirstWord = parts.length === 1 && !input.endsWith(' ');

      const candidates = isFirstWord
        ? commandNames
        : fsEntriesAt(terminal.currentPath);

      const lower   = token.toLowerCase();
      const matches = candidates.filter(c => c.toLowerCase().startsWith(lower));

      return { base, token, matches };
    }

    // ── Ghost text ────────────────────────────────────────────
    function updateGhost(input) {
      if (!input) { ghostEl.textContent = ''; return; }
      const { token, matches } = getCandidates(input);
      if (matches.length === 1 && token.length > 0) {
        ghostEl.textContent = input + matches[0].slice(token.length);
      } else {
        ghostEl.textContent = '';
      }
    }

    // ── Tab trigger ───────────────────────────────────────────
    function trigger(input) {
      const { base, token, matches } = getCandidates(input);

      if (matches.length === 0) {
        hide();
        ghostEl.textContent = '';
        return;
      }

      if (matches.length === 1) {
        inputEl.value = base + matches[0];
        ghostEl.textContent = '';
        hide();
        resetCycle();
        return;
      }

      const startingNew =
        cycleMatches.join(',') !== matches.join(',') || cycleBase !== base;

      if (startingNew) {
        cycleMatches = matches;
        cycleBase    = base;
        cycleToken   = token;
        cycleIndex   = -1;
      }

      cycleIndex    = (cycleIndex + 1) % cycleMatches.length;
      inputEl.value = cycleBase + cycleMatches[cycleIndex];
      ghostEl.textContent = '';

      showList(cycleMatches, cycleIndex);
    }

    // ── List rendering ────────────────────────────────────────
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

    function hide() {
      autocompleteEl.hidden = true;
      autocompleteEl.innerHTML = '';
    }

    function resetCycle() {
      cycleMatches = [];
      cycleIndex   = -1;
      cycleBase    = '';
      cycleToken   = '';
      hide();
    }

    // ── Wire events ───────────────────────────────────────────
    function onInput() {
      updateGhost(inputEl.value);
    }

    function onKeydown(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        trigger(inputEl.value);
      }
    }

    inputEl.addEventListener('input',   onInput);
    inputEl.addEventListener('keydown', onKeydown);

    // Listen to terminal's internal signals
    inputEl.addEventListener('terminal:hideAutocomplete', hide);
    inputEl.addEventListener('terminal:resetCycle', resetCycle);

    // ── destroy ───────────────────────────────────────────────
    function destroy() {
      inputEl.removeEventListener('input',   onInput);
      inputEl.removeEventListener('keydown', onKeydown);
      inputEl.removeEventListener('terminal:hideAutocomplete', hide);
      inputEl.removeEventListener('terminal:resetCycle', resetCycle);
    }

    return { trigger, updateGhost, hide, resetCycle, destroy };
  }

  return { makeAutocomplete };

})();
