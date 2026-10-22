# Settings and uninstall

[Back to the README](../README.md)

## Detailed settings

### Composer width

Open the command palette and run **Claude Skin: Composer width**. Each run cycles **Claude → Claude +20 % → Claude +40 % → Hermes → Claude**. The row shows the active mode and the choice persists locally. Claude remains the default; existing choices are preserved.

- **Claude** uses a reading width of **736 CSS px**, with responsive 16 px minimum side gutters.
- **Claude +20 %** uses **883.2 CSS px**, exactly 20% wider than Claude.
- **Claude +40 %** uses **1030.4 CSS px**, exactly 40% wider than Claude.
- **Hermes** restores Hermes' native full-width composer and conversation column.

All Claude modes keep the same responsive gutters and shrink to fit narrow panes. Floating and popped-out composers retain their native Hermes width in every mode. The `+` menu above the composer follows the rendered composer width in all four modes.

### Pinned user messages

Open the command palette and run **Claude Skin: Pinned user messages**. The row shows the active mode and the choice persists locally.

- **Hermes** preserves Hermes' native behavior, where the latest user message stays pinned at the top while scrolling.
- **Off** lets every user message scroll normally with the rest of the conversation.

### Clean transcript

Open the command palette and run **Claude Skin: Clean transcript**. The row shows the active mode and the choice persists locally.

Clean transcript defaults to **Off**. An existing **Off** or **On** choice is preserved.

- **Off** preserves Hermes' complete native transcript presentation.
- **On** keeps all live progress visible, then hides safely identified settled tool calls, thinking chrome, changed-file summaries, system notices and interim replies after the final response mounts. User messages, final answers, generated images, artifacts and alerts stay visible.

Older content loaded through **Show previous messages** can remain visible when Hermes no longer exposes enough information to distinguish a final answer from an interim reply. The plugin leaves uncertain content visible rather than risk hiding a real final answer.

## History navigation

History ticks use quieter theme-aware colors and more vertical spacing. The current-message marker gives way to the hovered marker without dimming ordinary idle ticks. The pointer-driven wave responds without a trailing width animation, and the rail hides when its own chat pane is 862 CSS pixels wide or narrower. Native click targets, keyboard navigation and virtualized scrolling remain intact.

History previews use the rendered exchange when available. Older turns in the main chat can use a read-only history request; if the plugin cannot safely match an exchange, it shows the question only. Split panes never borrow another pane's response. Disabling the plugin restores the native timeline.

## Older Desktop layout

Claude Skin targets the Desktop layout introduced in September 2026 only; older Desktop builds are not supported.

## Uninstall

Disable **Claude Skin** under **Capabilities → Plugins**, then remove its folder:

### macOS / Linux

```sh
rm -rf "${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/claude-chat-look"
```

### Windows PowerShell

```powershell
Remove-Item -Recurse -Force (Join-Path $HOME ".hermes\desktop-plugins\claude-chat-look")
```

Run **Reload desktop plugins** if Hermes does not unload it automatically.

