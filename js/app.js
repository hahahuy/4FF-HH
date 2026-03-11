/* ============================================================
   js/app.js — Single global namespace populated by each module.

   Singletons:
     App.Commands       — js/commands.js
     App.Auth           — js/auth.js
     App.NoteEditor     — js/note-editor.js
     App.InitPanels     — js/init-panels.js
     App.MessagePanel   — js/message-panel.js
     App.Draggable      — js/draggable.js
     App.ContextMenu    — js/contextmenu.js
     App.Tips           — js/tips.js

   Factories (remain global — called by contextmenu.js):
     createTerminal(winEl)
     createAutocomplete(inputEl, ghostEl, listEl)

   FS helpers (remain global):
     fsResolve, fsListDir, fsReadFile, fsEntriesAt,
     loadBlogManifest, loadPublishedNotes

   Loaded before all other modules (after utils/).
   ============================================================ */

'use strict';

// Export to globalThis so modules loaded via new Function(src)() can find App.
const App = (globalThis.App = Object.create(null));

// First-terminal tracking (used by terminal.js factory)
App._firstTerminalCreated = false;
App._firstTerminal        = null;
