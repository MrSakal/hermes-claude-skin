# Claude Skin for Hermes Desktop

A Hermes Desktop plugin that makes the app look and feel like the Claude Code desktop app: Claude's colours, type sizes, sidebar, composer, model picker, tool-call cards, context ring and the ASCII "water" backdrop on an empty session. It only restyles Hermes; every control keeps working the Hermes way.

> Independent community plugin, not affiliated with Nous Research or Anthropic.

## Install

In Hermes Desktop open **Capabilities → Plugins → Install plugin** and paste:

```text
MrSakal/hermes-claude-skin/claude-chat-look
```

Enable it under **Capabilities → Plugins**, then pick **Claude Skin** in **Settings → Appearance**.

Manual install: put [`claude-chat-look/plugin.js`](claude-chat-look/plugin.js) into `~/.hermes/desktop-plugins/claude-chat-look/` (Windows: `%USERPROFILE%\.hermes\desktop-plugins\claude-chat-look\`) and reload desktop plugins.

## Notes

- Works best with Hermes' **Technical** tool call display and the status bar switched on (the skin hides the bar itself and keeps its controls).
- The plugin checks this repository's releases for updates; installing one always needs your click. See [SECURITY.md](SECURITY.md).
- It styles internal Desktop elements, so a Hermes UI update can need a skin update.

## License

[MIT](LICENSE)
