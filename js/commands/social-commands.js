const SocialCommands = {
  // ── message ───────────────────────────────────────────────
  message: {
    desc: "Send me a message  (message --name <you> for live chat)",
    usage: "message [--name <name> | --stop | <content>]",
    exec(args, path, ctx, { text, esc }) {
      // Named visitor: message with no args → auto-open chat
      if (!args.length && globalThis.App?.visitorName) {
        const name = App.visitorName;
        MessagePanel.startChat(name, ctx).then((result) => {
          if (result) {
            if (result.error) {
              ctx.appendLine(result.error, ["error"]);
            } else if (result.lines) {
              result.lines.forEach((l) => ctx.appendHTML(l.html || "", l.classes || []));
            }
            ctx.scrollBottom();
          }
        });
        return { lines: [text(`Opening chat as ${name}…`, ["muted"])] };
      }

      // No arguments — show usage + last used name hint
      if (!args.length) {
        const lastName = MessagePanel.getLastName ? MessagePanel.getLastName() : null;
        const lines = [
          text("Usage:"),
          text("  message <content>          Send a one-shot message"),
          text("  message --name <you>       Open a live chat session"),
          text("  message --stop             Close the live chat"),
        ];
        if (lastName) {
          lines.push(text(`  Tip: last used name was "${lastName}"`, ["muted"]));
        }
        return { lines };
      }

      // --stop: close live chat
      if (args[0] === "--stop") {
        return MessagePanel.stop(ctx);
      }

      // --name <name>: open live chat
      if (args[0] === "--name") {
        const name = args[1];
        if (!name) return { error: "message --name requires a name argument" };
        MessagePanel.startChat(name, ctx).then((result) => {
          if (result) {
            if (result.error) {
              ctx.appendLine(result.error, ["error"]);
            } else if (result.lines) {
              result.lines.forEach((l) => ctx.appendHTML(l.html || "", l.classes || []));
            }
            ctx.scrollBottom();
          }
        });
        return { lines: [text("Opening chat session…", ["muted"])] };
      }

      // Guard: can't send one-shot while chat is open
      if (MessagePanel.isActive()) {
        return { error: "Close the current chat first: message --stop" };
      }

      // One-shot: validate then show captcha → confirm
      const content = args.join(" ");
      return MessagePanel.confirmSend(content, ctx);
    },
  },
};

// Export to globalThis for modules loaded via new Function(src)()
globalThis.SocialCommands = SocialCommands;
