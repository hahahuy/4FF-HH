const Config = (globalThis.Config = {
  CF_BASE: "https://asia-southeast1-hahuy-portfolio-f7f16.cloudfunctions.net",

  BREAKPOINT_MOBILE: 600,
  BREAKPOINT_TABLET: 900,

  STORAGE: {
    HISTORY: "term_history",
    CWD: "term_cwd",
    THEME: "term_theme",
    SCANLINES: "term_scanlines",
    SESSION: "owner_session",
    RATE: "mp_send_times",
    LAST_NAME: "mp_last_name",
    TIPS: "tips_dismissed",
    VISITOR_NAME: "visitor_name",
  },

  // Base path for fetching content.
  // '' for hahuy.site (custom domain at root).
  // Change to '/4FF-HH' if reverting to a GitHub Pages subpath.
  CONTENT_BASE: "",

  MAX_HISTORY: 200,
  MAX_OUTPUT_LINES: 500,
  IDLE_HINT_DELAY_MS: 20_000,
});
