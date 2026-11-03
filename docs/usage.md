# Settings and uninstall

[Back to the README](../README.md)

## Settings

Every setting lives in Claude's search: click **Search** in the sidebar or press **Ctrl+K** (⌘K on macOS), type part of its name and press Enter. The row switches to its next value in place and the search stays open. The same search also finds sessions, projects and every row of Hermes' own command palette, under that palette's groups. A row that opens a list of its own, such as **Change theme**, carries on in Hermes' palette, and **Ctrl+P** opens Hermes' palette directly. Each choice is saved on this computer.

### Composer width

**Claude Skin: Composer width** steps through **Claude → Claude +20 % → Claude +40 % → Hermes**.

- **Claude**, the default, is a 736px reading column.
- **Claude +20 %** and **Claude +40 %** are 883.2px and 1030.4px.
- **Hermes** gives the composer and the conversation Hermes' own full width.

The Claude widths shrink to fit a narrow pane and keep at least 16px at each side. A floating or popped-out composer always keeps Hermes' width, and the `+` menu above the composer follows whichever width is in use.

### Pinned user messages

**Claude Skin: Pinned user messages** is **Hermes** or **Off**. With **Hermes**, your latest message sticks to the top of the conversation as it scrolls, as Hermes does it. With **Off**, it scrolls away with everything else.

### Clean transcript

**Claude Skin: Clean transcript** is **Off** by default.

With **On**, a turn shows everything while it runs. Once its final answer is in, the skin folds away what led there: finished tool calls, thinking, changed-file lists, system notices and in-between replies. Your messages, final answers, images, artifacts and alerts always stay. When the skin cannot tell a final answer from an in-between reply, which can happen with older messages loaded through **Show previous messages**, it leaves the message showing.

### ASCII backdrop

**Claude Skin: ASCII backdrop** steps through **Seasonal → Water → Spring → Summer → Autumn → Winter → Halloween → Christmas → New Year → Off**. The backdrop shows only behind a new, empty session.

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

### Greeting

A new, empty conversation greets you with a fresh line each time, in English: a plain one ("Where should we start?"), one for the time of day ("Good evening"), one for the season, or, in their week, one for Halloween, Christmas or New Year ("One more before midnight?"). The line stays put for that conversation.

To be greeted by name, run **Claude Skin: Your name**, type the name and press Enter (or **Save**). **Clear** removes it, and Escape leaves it as it was. Hermes does not know your name, so the skin keeps it on this computer only.

## The history rail

The ticks beside the conversation are quieter and spaced further apart, follow the theme, and grow under the pointer. The rail hides when the chat pane is 862px wide or less. Hovering a tick previews that exchange; when the skin cannot match an older turn to its answer for sure, the preview shows only the question. Clicks, the keyboard and scrolling work as in Hermes.

## Supported Hermes builds

Claude Skin is made for the Hermes Desktop layout of September 2026 and later.

## Uninstall

Turn **Claude Skin** off under **Capabilities → Plugins** and delete its folder:

```sh
rm -rf "${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/claude-chat-look"
```

On Windows, in PowerShell:

```powershell
Remove-Item -Recurse -Force (Join-Path $HOME ".hermes\desktop-plugins\claude-chat-look")
```

If Hermes still shows it, run **Reload desktop plugins**.
