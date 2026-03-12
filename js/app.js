// Export to globalThis so modules loaded via new Function(src)() can find App.
const App = (globalThis.App = Object.create(null));

// First-terminal tracking (used by terminal.js factory)
App._firstTerminalCreated = false;
App._firstTerminal = null;
