# Security

## Versions

Claude Skin is in beta; fixes go into the newest release only.

## Reporting a problem

Use GitHub's private vulnerability reporting on this repository. If that is not available, open an issue asking for a private way to get in touch, and leave the details, keys and conversation content out of it.

## What the plugin can do

Hermes Desktop runs a plugin inside its own window with the app's full rights: the plugin system keeps one plugin's errors from breaking the app, but it is not a sandbox. Read the code, or at least check the published SHA-256, before you install it.

The skin has no server of its own and changes no Hermes file. It talks to the network for two things only:

- **Updates.** On launch, every hour, and when Hermes comes back to the foreground or online with stale information, it reads the release list of `MrSakal/hermes-claude-skin` from the GitHub API, without a GitHub account, cookies, referrer or token. GitHub sees an ordinary request (IP address, user agent); no chat content is sent. Opening the update menu can load the release notes' images, but only from this repository's release and raw files and from GitHub's own attachment hosts. Release notes are shown as text and images; no script or other HTML in them runs.
- **History previews.** Previewing an older turn asks Hermes for that session through Hermes' own API, with your Hermes connection's rights.

## How an update is installed

An update installs only when you click it. Then the skin:

1. takes the newest release above the running version that carries a `plugin.js` asset with a SHA-256 digest and a size under 1,000,000 bytes;
2. downloads it and refuses it when its size or digest differs from what the release states, or when the file does not name this plugin and that release's version;
3. keeps a checked copy of the installed plugin, writes the new one, reads it back, and has the reloaded plugin confirm its own version and digest.

If any step fails, it puts the previous copy back, and says so when even that cannot be confirmed. The file is written in place, not renamed into place, so a crash in the middle of a write can still leave a broken plugin.

These checks prove the file is the one the release names, not who made it: the digest comes from GitHub with the release, and there is no separate signature. Trust in an update is trust in this repository and in GitHub.

To check a manual install, compare the file with `CHECKSUMS.sha256` from the same tag.

## What it keeps on your computer

Your skin settings, the ids of user messages you expanded, the update check's cache and receipts, and the copies of the plugin an update writes. No message text, and nothing derived from it, is stored.
