# Contributing

Claude Skin is in beta. Issues and pull requests are welcome, most of all ones that keep the skin working on new Hermes Desktop builds.

## What belongs here

The skin fixes its own bugs only. If something breaks with the skin on, turn it off and try again on the same Hermes build first: if the bug stays, report it to Hermes, not here. A workaround for a Hermes bug will not be merged, even a temporary one.

## Rules of the house

- Hermes' own controls keep working the Hermes way: the model and thinking menus, voice controls, approvals, queue and tasks, tool calls and media.
- Every style sits under `html[data-claude-chat-look='true']`, and turning the plugin off or reloading it leaves Hermes as it was.
- No backend, no new network access, no external assets.
- Nothing from a conversation is stored: no message text, no hashes or fingerprints of it.

## Making a change

Edit `src/`, never `claude-chat-look/plugin.js`. The build writes that file, its `desktop/` copy and `CHECKSUMS.sha256`, and refuses to write a plugin of 1,000,000 bytes or more, the most the updater accepts.

```sh
node scripts/build-updater.mjs
```

The test suite is not published yet. Install the built plugin in Hermes and check it in light and dark themes, with enable, disable and hot reload. In the pull request, name the Hermes version and operating system you tested on, and leave out credentials, private paths and conversation content.
