/**
 * js/globals.d.ts — Ambient type augmentations for browser globals.
 *
 * This project loads JS files as plain <script> tags. Each file publishes
 * itself to globalThis. Using `declare global` (module augmentation pattern)
 * so TypeScript accepts both reading and writing these names on globalThis.
 */

export {};  // makes this a module — required for `declare global` to work

// ── FS node shape ────────────────────────────────────────────
declare global {

  interface FsNode {
    __type: 'file' | 'dir';
    src?: string;
    content?: string;
    mimeType?: string;
    __isNote?: boolean;
    __populated?: boolean;
    [key: string]: any;
  }
  interface FsTree {
    [key: string]: FsNode | FsTree;
  }

  // ── CDN globals ─────────────────────────────────────────────
  var marked:   any;
  var firebase: any;

  // ── Core runtime globals ────────────────────────────────────
  var App:      any;
  var Auth:     any;
  var Config: {
    CF_BASE: string;
    CONTENT_BASE: string;
    BREAKPOINT_MOBILE: number;
    BREAKPOINT_TABLET: number;
    MAX_HISTORY: number;
    MAX_OUTPUT_LINES: number;
    IDLE_HINT_DELAY_MS: number;
    STORAGE: Record<string, string>;
  };
  var BASE:        string;
  var FS:          FsTree;
  var MIME_BY_EXT: Record<string, string>;
  var NoteEditor:  any;
  var InitPanels:  any;
  var Draggable:   any;
  var ContextMenu: any;
  var Terminal:    any;
  var FsCommands:     any;
  var UiCommands:     any;
  var OwnerCommands:  any;
  var SystemCommands: any;
  var SocialCommands: any;
  var EasterEggs:     any;
  var MessagePanel:   any;

  // ── Filesystem helpers ──────────────────────────────────────
  function fsResolve(path: string[], arg?: string): { node: FsNode; path: string[] } | null;
  function fsListDir(node: FsNode): Array<{ name: string; type: string }>;
  function fsReadFile(node: FsNode): Promise<string>;
  function fsEntriesAt(pathArr: string[]): string[];
  function fsMimeType(filename: string, node: FsNode | null): string | null;
  function loadBlogManifest(): Promise<void>;
  function loadPublishedNotes(): Promise<void>;
  function loadUploadedImages(): Promise<void>;

  // ── Terminal / UI helpers ───────────────────────────────────
  function createTerminal(winEl: HTMLElement): any;
  function createAutocomplete(input: HTMLElement, ghost: HTMLElement, list: HTMLElement): any;
  function cfPost(endpoint: string, body?: object): Promise<any>;
  function escHtml(str: string): string;
  function sanitiseHtml(el: HTMLElement): void;

  // ── Dynamic function properties (e.g. fn._loaded = true) ───
  interface Function {
    _loaded?: boolean;
    [key: string]: any;
  }

  // ── Dynamic window properties ───────────────────────────────
  interface Window {
    _mpUnloadHandler?: EventListenerOrEventListenerObject;
    [key: string]: any;
  }

  // ── DOM type widening ────────────────────────────────────────
  // querySelector/closest/style/value are used throughout this codebase on
  // values typed as Element/Node/EventTarget by the TS DOM lib.
  // These extensions bring the types in line with how the code actually runs.
  interface Element {
    style: CSSStyleDeclaration;
    value?: string;
    focus(options?: FocusOptions): void;
    target?: string;
    rel?: string;
  }
  interface Node {
    querySelector<E extends Element = Element>(selectors: string): E | null;
    querySelectorAll<E extends Element = Element>(selectors: string): NodeListOf<E>;
  }
  interface EventTarget {
    closest<K extends keyof HTMLElementTagNameMap>(selector: K): HTMLElementTagNameMap[K] | null;
    closest<E extends Element = Element>(selectors: string): E | null;
  }
}
