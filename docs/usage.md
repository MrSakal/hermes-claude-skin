# Settings and uninstall

[Back to the README](../README.md)

## Detailed settings

Every setting below is also in Claude's search: click **Search** in the sidebar or press **Ctrl+K** (⌘K on macOS), type part of its name and press Enter. The row shows the new state and the search stays open. The same search finds sessions, projects and every row of Hermes' own command palette under its own groups (Go to, Commands, Command Center, Appearance, Settings). A toggle changes in place; a row that opens a list of its own, such as **Change theme**, continues in Hermes' palette. **Ctrl+P** still opens Hermes' palette directly.

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

### ASCII backdrop

Open the command palette and run **Claude Skin: ASCII backdrop**. Each run cycles **Seasonal → Water → Spring → Summer → Autumn → Winter → Halloween → Christmas → New Year → Off → Seasonal**. The row shows the active backdrop and the choice persists locally. The backdrop shows only behind a new, empty session.

- **Seasonal**, the default, shows the season: **Spring** from March, **Summer** from June, **Autumn** from September and **Winter** from December. Holidays take over from a week ahead, the way the shops dress up: **Halloween** from 24 to 31 October, **Christmas** from 17 to 26 December, and **New Year** from 30 December to 1 January. Winter shows between and after them. The row reads, for example, "Seasonal · Halloween", and the scene changes on its own while Hermes stays open. Any other choice fixes that scene year-round. The greeting's mark follows the backdrop too: a drop for Water, a flower, sun, leaf or snowflake for the seasons, a pumpkin, a tree or a firework for the holidays, and Claude's Spark with the backdrop off.
- **Spring** is a meadow swaying in the breeze, with a blossoming tree, tulips, butterflies, birds, a bee and drifting petals.
- **Summer** is the sea rolling in to the beach, with a glittering path under the sun, a sailboat, gulls, a palm, a beach umbrella, a crab and an ice cream.
- **Autumn** is heaped leaves and gusts of wind, with a tree turning orange, mushrooms, an acorn, a hedgehog, geese, a crow and a rain cloud, and leaves falling throughout.
- **Winter** is snowdrifts, icicles and frost in the corners, with snowy pines, a cabin with a smoking chimney, a fox, the moon and falling snow.
- **New Year** is fireworks rising from a skyline whose windows light up and go dark, with a clock at midnight, champagne, glasses, a party hat, a shooting star and falling confetti.
- **Water** is a grid of faint glyphs lit like light through moving water; a click drops a ripple into it.
- **Halloween** is drifting fog lit by the moon and a flickering pumpkin, with bats, ghosts, spiders, a cat and a grave.
- **Christmas** is a garland of chasing bulbs over a twinkling sky and snowdrifts, with trees, gifts, a snowman, a sleigh and falling snow.
- **Off** leaves the empty session plain.

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

