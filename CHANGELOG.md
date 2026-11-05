# Changelog

All notable changes to this project are documented here.

## Unreleased

## [1.0.0-beta.3] - 2026-11-05

Fixes.

- In-app updates install again. The update check read the version from the downloaded file in a form the shipped build no longer has, so every update stopped with "Update didn't complete".
- A build of 1.0.0-beta.1 or beta.2 cannot update itself to this one (it carries the old check): install this release by hand once, as in the README; later updates work from inside Hermes.

## [1.0.0-beta.2] - 2026-11-04

Fixes.

- With the browser or Files open, the titlebar buttons on the right can be clicked again; the window still moves from the band above the pane.
- The browser and Files side by side no longer pull each other's width back and forth, which made the panes jump and slowed the whole window.
- Released under the MIT license.

## [1.0.0-beta.1] - 2026-11-03

First beta.

- Claude's look across the whole of Hermes Desktop: sidebar, header, composer, transcript, tool steps, Changes, side panes, menus, dialogs, tooltips, toasts and updater, with Claude's comfortable sizes and type.
- Steps between two pieces of text fold under one line ("Edited plugin.js, ran 2 commands") that opens into a card of the steps; file edits come folded and show their diff as Claude's card. A reply that streams around a tool call keeps the step line 16px under its text and does not jump when it settles.
- Claude's search on Ctrl+K: Hermes' command palette rows, Hermes actions and the skin's settings in one place.
- Seasonal ASCII backdrop, the default: spring, summer, autumn and winter scenes, Halloween, Christmas and New Year fireworks; the empty session's greeting and mark follow it.
- Claude's folded sidebar (hover to peek, click to dock), a draggable sidebar width, and header buttons for every docked plugin pane. In a narrow window the sidebar slides over the chat at its full width, with the same header row (toggle, arrows, chat / bot switch).
- The composer, titlebar tools and sidebar search keep their look in every Hermes language.
- In-app updates from this repository's releases, checked by size and SHA-256 before install, with a rollback copy. A beta build is offered the next beta and the stable release; a stable build only stable releases.
- Light on start and while streaming: a streamed token re-checks only its own turn, and a thread's steps are placed in one layout pass. The shipped plugin is about 730 KB.
