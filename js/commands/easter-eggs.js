/* ============================================================
   js/commands/easter-eggs.js — Fun / discovery commands
   Commands: cowsay, fortune, weather, neofetch
   ============================================================ */

'use strict';

const EasterEggs = {

  // ── cowsay ────────────────────────────────────────────────
  cowsay: {
    desc: 'ASCII cow says something wise',
    usage: 'cowsay [message]',
    exec(args, path, ctx, { line, esc }) {
      const quips = [
        'moo. hire me.',
        '404: grass not found.',
        'git commit -m "moo"',
        'have you tried turning it off and on again?',
        'undefined is not a function. neither am i.',
      ];
      const msg    = args.length ? args.join(' ') : quips[Math.floor(Math.random() * quips.length)];
      const msgEsc = esc(msg);
      const border = '-'.repeat(msg.length + 2);
      return {
        lines: [
          line(` ${border}`),
          line(`&lt; ${msgEsc} &gt;`),
          line(` ${border}`),
          line('        \\   ^__^'),
          line('         \\  (oo)\\_______'),
          line('            (__)\\       )\\/\\'),
          line('                ||----w |'),
          line('                ||     ||'),
        ],
      };
    },
  },

  // ── fortune ───────────────────────────────────────────────
  fortune: {
    desc: 'Random developer/philosophy quote',
    usage: 'fortune [-s]',
    exec(args, path, ctx, { line, esc }) {
      const all = [
        { q: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', a: 'Martin Fowler', short: false },
        { q: 'First, solve the problem. Then, write the code.', a: 'John Johnson', short: true },
        { q: 'Experience is the name everyone gives to their mistakes.', a: 'Oscar Wilde', short: true },
        { q: 'In order to be irreplaceable, one must always be different.', a: 'Coco Chanel', short: false },
        { q: 'Java is to JavaScript what car is to carpet.', a: 'Chris Heilmann', short: true },
        { q: 'Knowledge is power.', a: 'Francis Bacon', short: true },
        { q: 'Sometimes it pays to stay in bed on Monday rather than spending the rest of the week debugging Sunday\'s code.', a: 'Dan Salomon', short: false },
        { q: 'Simplicity is the soul of efficiency.', a: 'Austin Freeman', short: true },
        { q: 'Before software can be reusable it first has to be usable.', a: 'Ralph Johnson', short: false },
        { q: 'Make it work, make it right, make it fast.', a: 'Kent Beck', short: true },
        { q: 'The best error message is the one that never shows up.', a: 'Thomas Fuchs', short: false },
        { q: 'Code is like humor. When you have to explain it, it\'s bad.', a: 'Cory House', short: false },
        { q: 'Fix the cause, not the symptom.', a: 'Steve Maguire', short: true },
        { q: 'Optimism is an occupational hazard of programming.', a: 'Kent Beck', short: false },
        { q: 'When in doubt, use brute force.', a: 'Ken Thompson', short: true },
        { q: 'Talk is cheap. Show me the code.', a: 'Linus Torvalds', short: true },
        { q: 'Always code as if the person who ends up maintaining your code is a violent psychopath who knows where you live.', a: 'John Woods', short: false },
        { q: 'The most disastrous thing that you can ever learn is your first programming language.', a: 'Alan Kay', short: false },
        { q: 'One man\'s crappy software is another man\'s full-time job.', a: 'Jessica Gaston', short: false },
        { q: 'It works on my machine.', a: 'Every Developer', short: true },
      ];
      const shortOnly = args[0] === '-s';
      const pool      = shortOnly ? all.filter(f => f.short) : all;
      const f         = pool[Math.floor(Math.random() * pool.length)];
      const qEsc      = esc(f.q);
      const aEsc      = esc(f.a);
      const width     = Math.min(f.q.length, 56);
      const border    = '─'.repeat(width + 2);
      return {
        lines: [
          line(`<span style="color:var(--text-dim)">╭${border}╮</span>`),
          line(`<span style="color:var(--text-dim)">│</span> <em>${qEsc}</em> <span style="color:var(--text-dim)">│</span>`),
          line(`<span style="color:var(--text-dim)">╰${border}╯</span>`),
          line(`<span style="color:var(--text-muted)">    — ${aEsc}</span>`),
        ],
      };
    },
  },

  // ── weather ───────────────────────────────────────────────
  weather: {
    desc: 'Live weather via wttr.in  (weather [city])',
    usage: 'weather [city]',
    exec(args, path, ctx, { text }) {
      const raw  = args.join(' ').trim() || 'Ho Chi Minh City';
      const city = raw.replace(/[^a-zA-Z0-9 +\-,.]/g, '').slice(0, 60) || 'Ho Chi Minh City';
      const url  = `https://wttr.in/${encodeURIComponent(city)}?format=3`;

      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(txt => {
          ctx.appendLine(txt.trim(), ['success']);
          ctx.scrollBottom();
        })
        .catch(() => {
          ctx.appendLine('weather: could not fetch weather data. Try again later.', ['error']);
          ctx.scrollBottom();
        });

      return { lines: [text(`Fetching weather for ${city}…`, ['muted'])] };
    },
  },

  // ── neofetch ──────────────────────────────────────────────
  neofetch: {
    desc: 'Display portfolio system info',
    usage: 'neofetch',
    exec(args, path, ctx, { line, esc }, registry) {
      const cmdCount = Object.keys(registry).length;
      let blogCount  = 0;
      try {
        const blogDir = FS['~'] && FS['~'].blog;
        if (blogDir) {
          blogCount = Object.keys(blogDir).filter(k => k !== '__type').length;
        }
      } catch (e) {}

      const asciiArt = [
        '        ██████████        ',
        '       ██░░░░░░░░██       ',
        '      ██░░░░░░░░░░██      ',
        '     ██░░░░░░░░░░░░██     ',
        '    ██░░░░██░░░░░░░░██    ',
        '   ██░░░░████░░░░░░░░██   ',
        '   ██░░░░░░░░░░░░░░░░██   ',
        '   ████████████████████   ',
      ];

      const info = [
        `<span style="color:var(--color-green);font-weight:700">visitor</span><span style="color:var(--text-muted)">@</span><span style="color:var(--color-blue);font-weight:700">portfolio</span>`,
        `<span style="color:var(--text-muted)">─────────────────</span>`,
        `<span style="color:var(--color-green)">OS:</span>       hahuy.site v1.0.0`,
        `<span style="color:var(--color-green)">Shell:</span>    4FF-HH terminal`,
        `<span style="color:var(--color-green)">Commands:</span> ${cmdCount}`,
        `<span style="color:var(--color-green)">Blog:</span>     ${blogCount} post${blogCount === 1 ? '' : 's'}`,
        `<span style="color:var(--color-green)">Stack:</span>    JS · Firebase · Telegram`,
        `<span style="color:var(--color-green)">Theme:</span>    ${document.documentElement.dataset.theme || 'default'}`,
      ];

      const lines    = [];
      const maxRows  = Math.max(asciiArt.length, info.length);
      for (let i = 0; i < maxRows; i++) {
        const art = asciiArt[i] || '                          ';
        const inf = info[i]     || '';
        lines.push(line(`<span style="color:var(--color-blue)">${art}</span>  ${inf}`));
      }
      return { lines };
    },
  },

};

// Export to globalThis for modules loaded via new Function(src)()
globalThis.EasterEggs = EasterEggs;
