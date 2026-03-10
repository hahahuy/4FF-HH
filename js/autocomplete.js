/* ============================================================
   autocomplete.js — Tab completion factory
   ============================================================ */

'use strict';

/**
 * Create an independent autocomplete instance scoped to a set of DOM elements.
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement}      ghostTextEl
 * @param {HTMLElement}      autocompleteEl
 */
function createAutocomplete(inputEl, ghostTextEl, autocompleteEl) {

  let cycleMatches  = [];
  let cycleIndex    = -1;
  let cycleBase     = '';
  let cycleToken    = '';

  // ── Tokenise ────────────────────────────────────────────
  function tokenise(input) {
    const lastSpace = input.lastIndexOf(' ');
    if (lastSpace === -1) return { base: '', token: input };
    return {
      base:  input.slice(0, lastSpace + 1),
      token: input.slice(lastSpace + 1),
    };
  }

  // ── Context-aware flag suggestions ──────────────────────
  // Returns an array of flag candidates when the current input
  // matches a known "stateful" command pattern, otherwise null
  // (meaning: fall through to normal FS / command-name completion).
  function getFlagCandidates(input) {
    const trimmed = input.trimStart();

    // "init" followed by exactly one space (and nothing else yet, or a dash prefix)
    // → suggest --stop
    const initMatch = trimmed.match(/^init\s+(--?s\S*)?\s*$/);
    if (initMatch) {
      const token = (initMatch[1] || '');
      if ('--stop'.startsWith(token)) {
        return { base: 'init ', token, matches: ['--stop'] };
      }
    }
    // "init " with nothing after the space
    if (/^init\s+$/.test(trimmed)) {
      return { base: 'init ', token: '', matches: ['--stop'] };
    }

    // "message --name <anything>" followed by a space (and optional partial --stop)
    // → suggest --stop
    const msgMatch = trimmed.match(/^message\s+--name\s+\S+\s+(--?s\S*)?\s*$/);
    if (msgMatch) {
      const token = (msgMatch[1] || '');
      if ('--stop'.startsWith(token)) {
        const base = trimmed.replace(/(--?s\S*)?\s*$/, '');
        return { base: base + (base.endsWith(' ') ? '' : ' '), token, matches: ['--stop'] };
      }
    }
    // "message --name <anything> " with nothing after
    const msgSpaceMatch = trimmed.match(/^(message\s+--name\s+\S+)\s+$/);
    if (msgSpaceMatch) {
      return { base: msgSpaceMatch[1] + ' ', token: '', matches: ['--stop'] };
    }

    return null;
  }

  // ── Candidates ──────────────────────────────────────────
  function getCandidates(input, currentPath) {
    // Check context-aware flags first
    const flagResult = getFlagCandidates(input);
    if (flagResult) return flagResult;

    const { base, token } = tokenise(input);
    const parts       = input.trimStart().split(/\s+/);
    const isFirstWord = parts.length === 1 && !input.endsWith(' ');
    const candidates  = isFirstWord ? Commands.names() : fsEntriesAt(currentPath);
    const lower       = token.toLowerCase();
    const matches     = candidates.filter(c => c.toLowerCase().startsWith(lower));
    return { base, token, matches };
  }

  // ── Ghost text ──────────────────────────────────────────
  function updateGhost(input, currentPath) {
    if (!input) { ghostTextEl.textContent = ''; return; }
    const { base, token, matches } = getCandidates(input, currentPath);
    if (matches.length === 1 && (token.length > 0 || getFlagCandidates(input))) {
      ghostTextEl.textContent = base + matches[0];
    } else {
      ghostTextEl.textContent = '';
    }
  }

  // ── Tab trigger ─────────────────────────────────────────
  function trigger(input, currentPath) {
    const { base, token, matches } = getCandidates(input, currentPath);

    if (matches.length === 0) { hide(); ghostTextEl.textContent = ''; return; }

    if (matches.length === 1) {
      inputEl.value = base + matches[0];
      ghostTextEl.textContent = '';
      hide(); resetCycle();
      return;
    }

    const startingNew = cycleMatches.join(',') !== matches.join(',') || cycleBase !== base;
    if (startingNew) {
      cycleMatches = matches; cycleBase = base; cycleToken = token; cycleIndex = -1;
    }

    cycleIndex    = (cycleIndex + 1) % cycleMatches.length;
    inputEl.value = cycleBase + cycleMatches[cycleIndex];
    ghostTextEl.textContent = '';
    showList(cycleMatches, cycleIndex);
  }

  // ── List ────────────────────────────────────────────────
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
    autocompleteEl.hidden   = true;
    autocompleteEl.innerHTML = '';
  }

  function resetCycle() {
    cycleMatches = []; cycleIndex = -1; cycleBase = ''; cycleToken = '';
    hide();
  }

  return { trigger, updateGhost, hide, resetCycle };
}
