import { host, PALETTE_AREA, THEMES_AREA, queryClient, useQuery, useValue } from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'
import { jsx } from 'react/jsx-runtime'

const ID = 'claude-chat-look'
const STYLE_ID = `${ID}-styles`
const BUILD_ID = 'v1.10.0'
const STORAGE_PREFIX = `${ID}:turn:`
const LONG_USER_STATE_SUFFIX = ':long-user-expanded'
const MAX_PERSISTED_LONG_USER_STATES = 250
const RUNTIME_HANDOFF_KEY = '__hermesClaudeChatLookRuntimeHandoff'
const COMPOSER_WIDTH_STORAGE_KEY = 'composer-width'
const COMPOSER_WIDTH_MODES = {
  claude: { label: 'Claude', next: 'claude-wide' },
  'claude-wide': { label: 'Claude +20 %', next: 'claude-wider' },
  'claude-wider': { label: 'Claude +40 %', next: 'hermes' },
  hermes: { label: 'Hermes', next: 'claude' }
}
const PINNED_USER_MESSAGES_STORAGE_KEY = 'pinned-user-messages'
const CLEAN_TRANSCRIPT_STORAGE_KEY = 'clean-transcript'
const CLEAN_TRANSCRIPT_EVENT = `${ID}:clean-transcript`

const PLAYBACK_CLOSE_GRACE_MS = 250
const PLAYBACK_MOTION_MS = 240
let pluginStorage = null

const SYSTEM_FONT = `-apple-system, system-ui, "Segoe UI", sans-serif`
const HERMES_FONT = SYSTEM_FONT

const CLAUDE_THEME = {
  name: 'claude-chat',
  label: 'Claude Skin',
  description: 'Claude Code desktop look: warm ivory light, near-black dark',
  colors: {
    background: '#FAF9F5',
    foreground: '#141413',
    card: '#FFFFFF',
    cardForeground: '#141413',
    muted: '#F0EEE6',
    mutedForeground: '#73726C',
    popover: '#FFFFFF',
    popoverForeground: '#141413',
    primary: '#141413',
    primaryForeground: '#FAF9F5',
    secondary: '#F0EEE6',
    secondaryForeground: '#141413',
    accent: '#E8E6DC',
    accentForeground: '#141413',
    border: '#E8E6DC',
    input: '#E8E6DC',
    ring: '#D97757',
    composerRing: '#DEDCD1',
    destructive: '#B53333',
    destructiveForeground: '#FFFFFF',
    sidebarBackground: '#F5F4ED',
    sidebarBorder: '#E8E6DC',
    userBubble: '#F0EEE6',
    userBubbleBorder: '#F0EEE6'
  },
  darkColors: {
    background: '#151515',
    foreground: '#F0EFEA',
    card: '#20201F',
    cardForeground: '#F0EFEA',
    muted: '#1D1D1D',
    mutedForeground: '#8C8C84',
    popover: '#212121',
    popoverForeground: '#F0EFEA',
    primary: '#F0EFEA',
    primaryForeground: '#151515',
    secondary: '#212121',
    secondaryForeground: '#F0EFEA',
    accent: '#2A2A2A',
    accentForeground: '#F0EFEA',
    border: '#292929',
    input: '#343434',
    ring: '#D97757',
    composerRing: '#4D4D4C',
    destructive: '#E5534B',
    destructiveForeground: '#FFFFFF',
    sidebarBackground: '#111111',
    sidebarBorder: '#292929',
    userBubble: '#212121',
    userBubbleBorder: '#212121'
  },
  // Claude Code's dark terminal is Tokyo Night (measured #16161E surface,
  // #787C99 text); the surface itself comes from --ui-terminal-surface-background.
  darkTerminal: {
    foreground: '#787C99',
    cursor: '#C0CAF5',
    selectionBackground: '#515C7E4D',
    black: '#363B54',
    red: '#F7768E',
    green: '#73DACA',
    yellow: '#E0AF68',
    blue: '#7AA2F7',
    magenta: '#BB9AF7',
    cyan: '#7DCFFF',
    white: '#787C99',
    brightBlack: '#363B54',
    brightRed: '#F7768E',
    brightGreen: '#73DACA',
    brightYellow: '#E0AF68',
    brightBlue: '#7AA2F7',
    brightMagenta: '#BB9AF7',
    brightCyan: '#7DCFFF',
    brightWhite: '#ACB0D0'
  },
  typography: {
    fontSans: SYSTEM_FONT,
    fontMono: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  }
}

const MIC_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M18.5848 13.4121C18.7715 12.9516 19.2961 12.7296 19.7567 12.916C20.217 13.1027 20.4391 13.6274 20.2528 14.0879C19.0405 17.0826 16.2438 19.2675 12.9003 19.6035V22C12.9003 22.4971 12.4969 22.9004 11.9999 22.9004C11.5029 22.9003 11.0995 22.497 11.0995 22V19.6035C7.75618 19.2673 4.96018 17.0823 3.74791 14.0879C3.56144 13.6272 3.78344 13.1026 4.244 12.916C4.70458 12.7298 5.22933 12.9517 5.41588 13.4121C6.46985 16.0157 9.02264 17.8496 12.0008 17.8496C14.9787 17.8493 17.531 16.0155 18.5848 13.4121ZM11.9999 1.34961C14.7061 1.34961 16.9003 3.5438 16.9003 6.25V10.7334C16.9003 13.4396 14.7061 15.6338 11.9999 15.6338C9.29371 15.6337 7.09947 13.4396 7.09947 10.7334V6.25C7.09947 3.54384 9.29372 1.34967 11.9999 1.34961ZM11.9999 3.15039C10.2878 3.15045 8.90025 4.53795 8.90025 6.25V10.7334C8.90025 12.4454 10.2878 13.8339 11.9999 13.834C13.7119 13.834 15.0995 12.4455 15.0995 10.7334V6.25C15.0995 4.53792 13.7119 3.15039 11.9999 3.15039Z'/%3E%3C/svg%3E")`
const SEND_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M11.25 18.25V7.56L7.53 11.28a.75.75 0 0 1-1.06-1.06l5-5a.75.75 0 0 1 1.06 0l5 5a.75.75 0 1 1-1.06 1.06l-3.72-3.72v10.69a.75.75 0 0 1-1.5 0Z'/%3E%3C/svg%3E")`
// Claude Code's composer sends with an Enter glyph.
const RETURN_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 5v5a4 4 0 0 1-4 4H5'/%3E%3Cpath d='M9 10l-4 4 4 4'/%3E%3C/svg%3E")`

// Palette data stays separate from the theme-inheriting layout rules.
const BROWSER_PALETTE_CSS = `
/* Layout rules apply with any theme; colours come from tokens. The Claude
   Skin theme pins the measured Claude values, other themes map them to their
   own Hermes semantic colours (as Codex Skin does). */
/* Claude light: the matching values from Claude's ivory palette. */
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'] {
  --claude-k-141413: #FAF9F5;
  --claude-k-202020: #FFFFFF;
  --claude-k-262626: #F0EEE6;
  --claude-k-313130: #F0EEE6;
  --claude-k-333332: #E8E6DC;
  --claude-k-333333: #F0EEE6;
  --claude-k-464646: #E8E6DC;
  --claude-k-2b2b2b: #E8E6DC;
  --claude-k-2c2c2a: #F0EEE6;
  --claude-k-2d2d2d: #E8E6DC;
  --claude-k-3a3a39: #E8E6DC;
  --claude-k-4a4a48: #E8E6DC;
  --claude-k-a5a49a: #73726C;
  --claude-k-c3c2b7: #3D3D3A;
  --claude-k-ec7e7e: #B53333;
  --claude-k-ffffff: #141413;
}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] {
  --claude-k-141413: #141413;
  --claude-k-202020: #202020;
  --claude-k-262626: #262626;
  --claude-k-2b2b2b: #2B2B2B;
  --claude-k-2c2c2a: #2C2C2A;
  --claude-k-2d2d2d: #2D2D2D;
  --claude-k-313130: #313130;
  --claude-k-333332: #333332;
  --claude-k-333333: #333333;
  --claude-k-3a3a39: #3A3A39;
  --claude-k-464646: #464646;
  --claude-k-4a4a48: #4A4A48;
  --claude-k-a5a49a: #A5A49A;
  --claude-k-c3c2b7: #C3C2B7;
  --claude-k-ec7e7e: #EC7E7E;
  --claude-k-ffffff: #FFFFFF;
}
html[data-claude-chat-look='true']:not([data-hermes-theme='claude-chat']) {
  --claude-k-141413: var(--dt-primary-foreground, Canvas);
  --claude-k-202020: var(--dt-popover, var(--ui-widget-surface-background, Canvas));
  --claude-k-262626: var(--ui-row-hover-background, rgb(128 128 128 / 12%));
  --claude-k-2b2b2b: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-k-2c2c2a: var(--ui-row-hover-background, rgb(128 128 128 / 12%));
  --claude-k-2d2d2d: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-k-313130: var(--ui-row-hover-background, rgb(128 128 128 / 12%));
  --claude-k-333332: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-k-333333: var(--ui-row-hover-background, rgb(128 128 128 / 12%));
  --claude-k-3a3a39: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-k-464646: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-k-4a4a48: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-k-a5a49a: var(--ui-text-secondary, currentColor);
  --claude-k-c3c2b7: var(--ui-text-secondary, currentColor);
  --claude-k-ec7e7e: var(--dt-destructive, #D00E17);
  --claude-k-ffffff: var(--dt-primary, CanvasText);
  --claude-account-hover: var(--ui-row-hover-background, rgb(128 128 128 / 12%));
  --claude-card-background: var(--ui-editor-surface-background, Canvas);
  --claude-card-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-file-tab: var(--ui-row-active-background, rgb(128 128 128 / 20%));
  --claude-file-divider: var(--ui-stroke-tertiary, rgb(128 128 128 / 18%));
  --claude-file-row-selected: var(--ui-row-active-background, rgb(128 128 128 / 20%));
  --claude-filter-background: var(--ui-control-background, transparent);
  --claude-filter-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-card-gap: 4px;
  --claude-card-radius: 10px;
  --claude-card-top: 40px;
  --claude-composer-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-composer-fill: var(--ui-editor-surface-background, Canvas);
  --claude-composer-inner: transparent;
  --claude-menu-background: var(--dt-popover, var(--ui-widget-surface-background, Canvas));
  --claude-menu-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-menu-check: var(--dt-primary, CanvasText);
  --claude-menu-hover: var(--ui-row-hover-background, rgb(128 128 128 / 12%));
  --claude-menu-shadow: rgb(0 0 0 / 25%);
  --claude-pane-active: var(--ui-row-active-background, rgb(128 128 128 / 20%));
  --claude-pane-active-glyph: var(--dt-primary, CanvasText);
  --claude-search-background: var(--ui-editor-surface-background, Canvas);
  --claude-search-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
  --claude-search-text: var(--ui-text-tertiary, currentColor);
  --claude-segment-active: var(--ui-row-active-background, rgb(128 128 128 / 20%));
  --claude-segment-track: var(--ui-row-hover-background, rgb(128 128 128 / 12%));
  --claude-session-ring: var(--ui-text-quaternary, currentColor);
  --claude-sidebar-divider: var(--ui-stroke-tertiary, rgb(128 128 128 / 18%));
  --claude-sidebar-text: var(--ui-text-secondary, currentColor);
  --claude-tool-card: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));
}

html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] {
  --claude-browser-background: var(--claude-color-chat);
  --claude-browser-tab: #111111;
  --claude-browser-divider: #292929;
  --claude-sidebar-divider: #292929;
}

/* Claude Code desktop look. Applies only with the bundled Claude Skin theme so
   native Hermes themes keep their own shapes and colors. */
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'] {
  --ui-inline-code-background: #F0EEE6;
  --ui-inline-code-foreground: #B5482E;
  --claude-composer-border: #DEDCD1;
  --claude-composer-fill: #FFFFFF;
  --claude-composer-inner: transparent;
  --claude-search-background: #FFFFFF;
  --claude-search-border: #E8E6DC;
  --claude-account-hover: #F0EEE6;
  --claude-pane-active: #DCE8F7;
  --claude-pane-active-glyph: #1F5FAD;
  --claude-segment-track: #F0EEE6;
  --claude-segment-active: #FFFFFF;
  --claude-menu-background: #FFFFFF;
  --claude-menu-border: #E8E6DC;
  --claude-menu-hover: #F0EEE6;
  --claude-menu-check: #2A74CD;
  --claude-menu-shadow: rgb(20 20 19 / 12%);
}

html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] {
  --ui-inline-code-background: #212121;
  --ui-inline-code-foreground: #EC7151;
  --claude-composer-border: #373736;
  --claude-composer-fill: #20201F;
  --claude-composer-inner: #252524;
  --ui-row-hover-background: #1F1F1F;
  --ui-row-active-background: #343434;
  --claude-color-active: #343434;
  --claude-sidebar-hover: #1F1F1F;
  --claude-sidebar-active: #343434;
  --claude-search-background: #1D1D1D;
  --claude-search-border: #343434;
  --claude-account-hover: #232323;
  --claude-pane-active: #032042;
  --claude-sidebar-text: #C3C2B7;
  --claude-session-ring: #4D4C49;
  --claude-search-text: #898781;
  --claude-pane-active-glyph: #66A7E7;
  --claude-segment-track: #1D1D1D;
  --claude-segment-active: #343434;
  --claude-menu-background: #20201F;
  --claude-menu-border: #373736;
  --claude-menu-hover: #2C2C2B;
  --claude-menu-check: #2A74CD;
  --claude-menu-shadow: rgb(0 0 0 / 45%);
}

html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='aui_user-message-root'] .composer-human-message {
  border-radius: 12px !important;
  padding: 10px 14px !important;
}

html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] > div,
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-surface'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-surface'] > [aria-hidden] {
  border-radius: 16px !important;
}

html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-surface'] {
  border: 1px solid var(--claude-composer-border) !important;
  box-shadow: none !important;
}

html[data-claude-chat-look='true'][data-hermes-theme] .aui-md :not(pre) > code {
  border-radius: 4px !important;
  padding: 1px 5px !important;
}
`

// Claude Code desktop layout, active only with the bundled Claude Skin theme.
// Hermes owns every element; these rules only restyle and hide secondary
// details, never move React nodes.
const CLAUDE_CODE_LAYOUT_CSS = `
/* Navigation rows: regular weight, quiet icons, Claude row radius. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] {
  border-radius: 6px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-tour^='sidebar-nav-'] {
  /* Measured against Claude Code: 12 device px cap height at 125 %. CSS px
     follow Hermes UI Scale. */
  font-size: 14px !important;
  font-weight: 400 !important;
  color: var(--claude-sidebar-text, var(--claude-color-text)) !important;
}
/* Same-monitor comparison with Claude Code: its sidebar text is a muted grey
   (#C3C2B7 dark), not near-white, rows sit ~26px apart and the nav glyphs are
   ~12px. Brighter text and larger glyphs read as bigger type. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button']:has([data-tour^='sidebar-nav-']) {
  height: 25.4px !important;
  min-height: 25.4px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav"] svg {
  width: 12px !important;
  height: 12px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav"] .codicon {
  width: 12px !important;
  height: 12px !important;
  margin: 0 2.6px 0 0.8px !important;
  font-size: 12px !important;
  line-height: 12px !important;
  color: var(--claude-sidebar-text, var(--claude-color-text)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav-new-session"] .codicon {
  display: grid !important;
  width: 20px !important;
  height: 20px !important;
  margin: 0 -1.4px 0 -3.2px !important;
  place-items: center;
  border-radius: 50%;
  background: var(--claude-new-disc, var(--claude-k-2c2c2a));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav-new-session"] .codicon::before {
  content: '\\ea60' !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'] [data-slot='kbd-group'] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']) {
  height: 25.6px !important;
  min-height: 25.6px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] input[aria-label='Search sessions'] {
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] input[aria-label='Search sessions']::placeholder {
  color: var(--claude-search-text, var(--claude-color-text-tertiary)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] .hover-marquee,
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-text] {
  color: var(--claude-sidebar-text, var(--claude-color-text)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'] > .codicon {
  color: var(--claude-color-text-secondary) !important;
}

/* Search sits above the navigation in a bordered field. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-slot='sidebar-content'] > div:has(input[aria-label='Search sessions']) {
  order: -1;
  padding: 8px 8px 6px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']) {
  display: flex !important;
  width: 100% !important;
  max-width: none !important;
  padding: 0 8px !important;
  border: 1px solid var(--claude-search-border) !important;
  border-radius: 8px !important;
  background: var(--claude-search-background) !important;
}

/* Claude Code has no empty Pinned block; it appears once something is pinned. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-slot='sidebar-group']:has(.codicon-pin):not(:has([class~='row-hover'])) {
  display: none !important;
}

/* Claude Code has no Cron jobs section or profile rail in its sidebar. Cron is
   the trailing session-list group: rows carry group/cron, and when collapsed it
   is the only trailing group without content, filters or a pin hint. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sessions-mode] > [data-slot='sidebar-group']:has([class~='group/cron']),
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sessions-mode] > [data-slot='sidebar-group'][class~='pb-1']:last-child:not(:has([data-slot='sidebar-group-content'], [aria-label='Filters'], .codicon-pin)),
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> [data-slot='profile-rail']) {
  display: none !important;
}

/* Account row and menu at the sidebar foot (plugin DOM). Settings moves here,
   so the titlebar gear goes; Ctrl+, keeps working. */
html:not([data-claude-chat-look='true']) [data-claude-account-row],
html:not([data-claude-chat-look='true']) [data-claude-account-menu] {
  display: none !important;
}
/* Sidebar "More": native themes show every native row and none of ours. */
html:not([data-claude-chat-look='true']) :is([data-claude-nav-more], [data-claude-sidebar-editor]) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-hidden] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-more-menu] {
  min-width: 200px;
}
/* Claude's "More" row: a dim chevron and a tertiary label. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-more-button] {
  display: flex !important;
  width: 100%;
  height: 25.4px !important;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--claude-color-text-tertiary) !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  text-align: left;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-more-button] > .codicon {
  width: 12px;
  height: 12px;
  margin: 0 2.6px 0 1.6px;
  font-size: 12px;
  line-height: 12px;
  color: var(--claude-color-text-quaternary, var(--claude-color-text-tertiary));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-more-button]:is(:hover, [aria-expanded='true']) {
  background: var(--claude-sidebar-hover, var(--claude-account-hover)) !important;
}
/* Claude's Edit sidebar dialog: #20201F on a dimmed window, #373736 edge,
   blue checks, a white Done button. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor] {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 150);
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 45%);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-panel] {
  box-sizing: border-box;
  width: 320px;
  padding: 18px 18px 14px;
  border: 1px solid var(--claude-menu-border);
  border-radius: 12px;
  background: var(--claude-menu-background);
  color: var(--claude-color-text);
  box-shadow: 0 16px 48px var(--claude-menu-shadow);
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-head] {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-head] > h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-close] {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--claude-color-text-secondary);
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-close]:hover {
  background: var(--claude-menu-hover);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-panel] > p {
  margin: 4px 0 14px;
  color: var(--claude-color-text-secondary);
  font-size: 13px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-rows] {
  display: grid;
  gap: 2px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-row] {
  display: flex;
  height: 26px;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-row] > input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--claude-menu-check);
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-row] > .codicon {
  width: 14px;
  font-size: 14px;
  color: var(--claude-color-text-secondary);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-foot] {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-done] {
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: var(--claude-k-ffffff);
  color: var(--claude-k-141413);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-titlebar-cluster] button[aria-label='Open settings'] {
  display: none !important;
}

/* Gateways live in the account menu, so the statusbar switcher is visually
   hidden. It stays mounted and measurable: the account menu drives it. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] [data-slot='connection-switcher'] {
  position: absolute !important;
  width: 1px !important;
  min-width: 0 !important;
  height: 1px !important;
  overflow: hidden !important;
  clip-path: inset(50%) !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
html[data-claude-gateway-proxy] [data-radix-popper-content-wrapper]:has([role='menu']) {
  opacity: 0 !important;
}

/* Claude Code pane toggles (plugin DOM) lead the right titlebar cluster. */
html:not([data-claude-chat-look='true']) [data-claude-pane-tools] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tools] {
  display: flex;
  align-items: center;
  gap: inherit;
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool] > .codicon {
  font-size: 16px;
}
/* Claude's sidebar section labels and empty-pane notes are sentence case at
   about the row size (measured 1:1: labels ~12.5px, "No changes to show"
   13px), not 10px spaced capitals. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] .group\\/workspace button > span.uppercase {
  font-size: 12.5px !important;
  font-weight: 500 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] aside .justify-center > span.uppercase {
  font-size: 13px !important;
  font-weight: 400 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool] > svg[data-claude-pane-glyph] {
  width: 16px;
  height: 16px;
  flex: none;
}
/* Measured from Claude Code: an open pane's toggle is #032042 with a blue
   glyph; the open overflow menu button is #262626. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool] {
  border-radius: 6px !important;
  color: var(--claude-sidebar-text, var(--claude-color-text-secondary)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool][aria-pressed='true'] {
  background: var(--claude-pane-active) !important;
  color: var(--claude-pane-active-glyph) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool][aria-expanded='true'] {
  background: var(--claude-account-hover) !important;
}
/* The native Layout / HUD / Swap / right-sidebar tools live in the overflow
   menu; they stay mounted because the menu clicks them. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-titlebar-cluster] button:is([aria-label='Layout editor'], [aria-label='HUD mode'], [aria-label='Swap sidebar sides'], [data-tour='right-pane-toggle']):not([data-claude-pane-tool]) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-overflow-menu] {
  min-width: 220px;
}
html:not([data-claude-chat-look='true']) [data-claude-account-bar] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-bar] {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  margin: 6px 8px 8px;
  position: relative;
}
/* Claude's line between the session list and the account, across the whole
   sidebar (an update row sits above it). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-bar]::before {
  content: '';
  position: absolute;
  top: -6px;
  left: -8px;
  right: -8px;
  height: 1px;
  background: var(--claude-color-border-subtle, var(--ui-stroke-quaternary));
  pointer-events: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-row] {
  display: inline-flex;
  box-sizing: border-box;
  flex: 0 0 176px;
  width: 176px;
  max-width: 100%;
  height: 31px;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--claude-color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-row]:is(:hover, [aria-expanded='true']) {
  background: var(--claude-account-hover);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-avatar] {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 23px;
  height: 23px;
  border-radius: 50%;
  background: var(--claude-sidebar-active);
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-avatar] > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-text] {
  flex: 1;
  font-size: 14px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-org] {
  color: var(--claude-color-text-tertiary);
  font-size: 11px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-row] > .codicon {
  color: var(--claude-color-text-tertiary);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-menu] {
  position: fixed;
  z-index: var(--z-modal-popover, 140);
  box-sizing: border-box;
  min-width: 300px;
  padding: 6px;
  border: 1px solid var(--claude-menu-border);
  border-radius: 10px;
  background: var(--claude-menu-background);
  color: var(--claude-color-text);
  box-shadow: 0 8px 24px var(--claude-menu-shadow);
  font: inherit;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-menu-head] {
  overflow: hidden;
  padding: 6px 8px 4px;
  color: var(--claude-color-text-tertiary);
  font-size: 0.92em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-separator] {
  height: 1px;
  margin: 5px 2px;
  background: var(--claude-menu-border);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-item] {
  display: flex;
  width: 100%;
  min-height: 30px;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-item]:is(:hover, :focus-visible) {
  background: var(--claude-menu-hover);
  outline: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-item] > .codicon:first-child {
  width: 16px;
  color: var(--claude-color-text-secondary);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-label] {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-tag],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-item] kbd {
  color: var(--claude-color-text-tertiary);
  font: inherit;
  font-size: 0.85em;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-gateway][aria-checked='false'] > .codicon-check {
  visibility: hidden;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-gateway] > .codicon-check {
  color: var(--claude-menu-check);
}

/* Section and date headers: muted, sentence case. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/section-label'] > span,
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/workspace'] span[class~='uppercase'] {
  font-weight: 400 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  color: var(--claude-color-text-tertiary) !important;
}

/* Session rows as in Claude's 2026-10 list: no lead ring, the title flush with
   the group labels (x 18.4), 14px. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] [data-slot='row-button'] [data-slot='tooltip-trigger'] {
  font-size: 14px !important;
  font-weight: 400 !important;
  color: var(--claude-sidebar-text, var(--claude-color-text)) !important;
}
/* Hermes' lead slot (status dot, drag grip) leaves the flow and sits in the
   left gutter, so live states still show and rows still drag. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] [data-reorder-handle] {
  position: absolute !important;
  left: -1px;
  width: 9px !important;
  margin: 0 !important;
}
/* A live state (unread, running, waiting) reads after the title, at the row's
   right end, rather than on its left edge; the row's own actions take the
   spot while it is hovered. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] [data-reorder-handle]:has([role='status'], [class*='bg-(--ui-accent)'], [class*='border']) {
  left: auto;
  right: 8px;
  display: grid !important;
  place-items: center;
  transition: opacity .1s;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']:hover [data-reorder-handle]:has([role='status'], [class*='bg-(--ui-accent)'], [class*='border']),
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']:focus-within [data-reorder-handle]:has([role='status'], [class*='bg-(--ui-accent)'], [class*='border']) {
  opacity: 0;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']:has([data-reorder-handle]:has([role='status'], [class*='bg-(--ui-accent)'], [class*='border'])) [data-slot='row-button'] [data-slot='tooltip-trigger'] {
  padding-right: 16px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-reorder-handle]:not(:has([role='status'], [class*='border'])):not(:has(> span:first-child i))::after {
  content: none;
  position: absolute;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  width: 5.6px;
  height: 5.6px;
  border: 1px solid var(--claude-session-ring, var(--claude-color-text-tertiary));
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: opacity 120ms;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-reorder-handle]:hover::after {
  opacity: 0;
}

/* Pane tabs read as titles, not uppercase labels. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='pane-tab'] span[class~='uppercase'] {
  letter-spacing: 0 !important;
  text-transform: none !important;
}

/* Claude composer: the bordered box holds only the text (and Send); the
   +/model/effort/voice row sits below it on the chat background. Hermes'
   surface keeps its layout and handlers; only the paint moves to the input
   cell. Scoped to the docked main composer, not the inline message editor. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'] > [aria-hidden] {
  min-height: 0 !important;
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] {
  padding: 0 !important;
  overflow: visible !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child {
  position: relative !important;
  row-gap: 4px !important;
}
/* Measured from Claude Code (2026-10 update) at 125 %: an empty box is 54
   device px (43.2 CSS px), 11px radius; + sits inside on the left and
   dictation inside on the right, text starts 43.2px in. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has([data-slot='composer-rich-input']) {
  position: relative;
  box-sizing: border-box;
  min-height: 44px;
  padding: 9.8px 76px 13px 40.8px !important;
  border: 1px solid var(--claude-composer-border) !important;
  border-radius: 11px !important;
  background: var(--claude-composer-fill) !important;
  box-shadow: inset 0 0 0 0.8px var(--claude-composer-inner) !important;
}
/* Focused, Claude's box lifts: a lighter rim and a soft shadow under it. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has([data-slot='composer-rich-input']):focus-within {
  border-color: color-mix(in srgb, var(--claude-color-text) 22%, var(--claude-composer-fill)) !important;
  box-shadow: inset 0 0 0 0.8px color-mix(in srgb, var(--claude-color-text) 5%, var(--claude-composer-fill)), 0 4px 10px color-mix(in srgb, black 14%, transparent) !important;
}
/* A pasted image sits inside the box, at its top, as in Claude: a row of
   120px thumbnails 12px in, lined up with the text, the text below them.
   installClaudeComposerBox measures the row (--claude-attach-h) and flags it. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'][data-claude-attached] > [data-slot='composer-attachments'] {
  position: absolute !important;
  top: 12px;
  left: 41.6px;
  right: 76px;
  z-index: 3;
  margin: 0 !important;
  padding: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'][data-claude-queue] > div:last-child > div:has([data-slot='composer-rich-input']) {
  padding-right: 104px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'][data-claude-attached] > div:last-child > div:has([data-slot='composer-rich-input']) {
  padding-top: calc(29.8px + var(--claude-attach-h, 120px)) !important;
}
/* The update button joins + inside the box; the text then starts after it. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child[data-claude-has~="claude-update-anchor-style-inline-flex"] > div:has([data-slot='composer-rich-input']) {
  padding-left: 72px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button:is([aria-label='Send'], [aria-label='Envoyer'])::before {
  mask-image: ${RETURN_MASK} !important;
}
/* Claude's composer text: 14px, lines 22 device px apart at 125 %. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-rich-input'] {
  min-height: 19.6px !important;
  font-size: 14px !important;
  line-height: 17.6px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Send'], [aria-label='Envoyer']) {
  position: absolute !important;
  top: calc(var(--claude-composer-box-h, 44px) - 33.6px) !important;
  right: 40px !important;
  bottom: auto !important;
  z-index: 2;
  /* Claude's ↵ is a plain glyph, no filled pill. */
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: color-mix(in srgb, var(--claude-color-text) 84%, var(--claude-composer-fill)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Send'], [aria-label='Envoyer']):is(:hover, :focus-visible):not(:disabled) {
  background: color-mix(in srgb, var(--claude-color-text) 10%, transparent) !important;
}
/* While Hermes answers, the same button reads Stop (its own filled circle
   kept); with text in, Queue joins left of send. Both live in the box. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Stop'], [aria-label='Arrêter']) {
  position: absolute !important;
  top: calc(var(--claude-composer-box-h, 44px) - 34px) !important;
  right: 40px !important;
  bottom: auto !important;
  z-index: 2;
  width: 24px !important;
  min-width: 24px !important;
  height: 24px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Queue message'], [aria-label^='Mettre en file']) {
  position: absolute !important;
  top: calc(var(--claude-composer-box-h, 44px) - 33.6px) !important;
  right: 70px !important;
  bottom: auto !important;
  z-index: 2;
  height: 24px !important;
  border-radius: 7px !important;
  color: color-mix(in srgb, var(--claude-color-text) 84%, var(--claude-composer-fill)) !important;
}
/* As in Claude, the voice-conversation button sits in the box beside
   dictation, where the return glyph takes over once there is text (Hermes
   swaps the two); its engine chevron rides along. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] {
  position: absolute !important;
  top: calc(var(--claude-composer-box-h, 44px) - 33.6px) !important;
  right: 40px !important;
  z-index: 2;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > * > button,
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > button {
  height: 24px !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: color-mix(in srgb, var(--claude-color-text) 84%, var(--claude-composer-fill)) !important;
}
/* Waveform and engine chevron are one control: the pair lights as a whole. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] {
  border-radius: 7px;
  transition: background-color 120ms;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"]:is(:hover, :focus-within) {
  background: color-mix(in srgb, var(--claude-color-text) 10%, transparent);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] button {
  background: transparent !important;
}
/* Claude's frame on the box's voice buttons: a rounded square on hover. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Voice dictation'], [aria-label='Stop dictation'], [aria-label='Start voice conversation'], [aria-label='Voice chat engine']) {
  border-radius: 7px !important;
  transition: background-color 120ms;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Voice dictation']):is(:hover, :focus-visible, [aria-expanded='true']):not(:disabled) {
  background: color-mix(in srgb, var(--claude-color-text) 10%, transparent) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > * > button[aria-label='Start voice conversation'] {
  border-radius: 7px 0 0 7px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] button[aria-label='Voice chat engine'] {
  border-radius: 0 7px 7px 0 !important;
}
/* Hermes' engine menu blocks presses outside it while open (body
   pointer-events: none); the waveform it opened from stays pressable, so a
   click still starts the conversation. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] span[data-claude-has~="child-start-voice"] button[aria-label='Start voice conversation'] {
  pointer-events: auto !important;
}
/* The engine chevron leaves the row, kept at the waveform's edge as the
   anchor of Hermes' menu (installClaudeVoiceEngineHover opens it on hover);
   the waveform wears the mic's corner chevron instead. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] span[data-claude-has~="child-start-voice"] button[aria-label='Voice chat engine'] {
  width: 0 !important;
  min-width: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > * > button[aria-label='Start voice conversation'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > button[aria-label='Start voice conversation'] {
  width: 28px !important;
  border-radius: 7px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"]::after {
  content: '\\eab7';
  position: absolute;
  top: -1px;
  right: 0;
  font: normal 8px/1 codicon;
  color: var(--ui-text-quaternary, var(--claude-color-text-tertiary));
  pointer-events: none;
  transition: opacity 100ms;
}
/* As on the mic, the corner chevron gives way on hover and while the menu is open. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"]:is(:hover, [data-claude-has~="child-engine-menu-open"])::after {
  opacity: 0;
}
/* Hermes' bubble gives way to Claude's tooltip card (installClaudeVoiceTips). */
html[data-claude-chat-look='true'] [data-claude-tip-replaced] {
  visibility: hidden !important;
}
[data-claude-voice-tip] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-voice-tip]:not([hidden]) {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-width: 280px;
  padding: 7px 11px 8px;
  border: 1px solid var(--claude-card-border, var(--claude-color-border, var(--ui-stroke-tertiary)));
  border-radius: 9px;
  background: var(--claude-color-elevated, var(--ui-editor-surface-background));
  box-shadow: 0 6px 20px color-mix(in srgb, black 30%, transparent);
  pointer-events: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-voice-tip] > strong {
  color: var(--claude-color-text, var(--ui-text-primary));
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-voice-tip] > span {
  color: var(--claude-color-text-secondary, var(--ui-text-secondary));
  font-size: 13px;
  line-height: 1.35;
}
/* Claude's update dropped the empty-state Enter glyph. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child:not([data-claude-has~="button-is-label-send-label-envoyer"]) > div:has([data-slot='composer-rich-input'])::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 12px;
  width: 16px;
  height: 16px;
  transform: translateY(-50%);
  background: var(--claude-color-text-tertiary);
  mask: ${RETURN_MASK} center / contain no-repeat;
  opacity: .6;
  pointer-events: none;
  display: none;
}
/* Claude keeps + and dictation inside the box (left and right). Both are
   lifted out of Hermes' action row; their popups move with them. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child [data-slot='fan-menu-anchor']:has(button:is([aria-label='Voice dictation'], [aria-label='Stop dictation'], [aria-label='Transcribing dictation'], [aria-label='Dictée vocale'])) {
  position: absolute !important;
  top: calc(var(--claude-composer-box-h, 44px) - 33.6px);
  right: 8px;
  bottom: auto;
  left: auto;
  z-index: 2;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has(> button[aria-label='Add context']) {
  position: absolute !important;
  /* Out of its grid area: an absolute grid child is placed in its area. */
  grid-area: auto !important;
  top: calc(var(--claude-composer-box-h, 44px) - 33.6px);
  left: 8px;
  z-index: 2;
  translate: none !important;
  transform: none !important;
}

/* The approval mode trigger, pinned beside dictation like Claude's "Auto". */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked] {
  position: fixed !important;
  z-index: 5;
  top: var(--claude-dock-top) !important;
  left: var(--claude-dock-left) !important;
  height: 24px !important;
  padding: 0 6px !important;
  border-radius: 6px !important;
  transform: translateY(-50%);
  background: transparent;
  color: var(--claude-sidebar-text, var(--claude-color-text-secondary)) !important;
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked]:hover,
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked][data-state='open'] {
  background: var(--claude-account-hover) !important;
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked] > svg {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked] > span {
  font-size: 14px !important;
}

/* Claude's action row is compact: 24 px controls, 13 px labels, a small +. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:not([data-claude-has~="slot-composer-rich-input"]) button {
  height: 24px !important;
  min-height: 24px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:not([data-claude-has~="slot-composer-rich-input"]) button:is([aria-label^='Model ·'], [aria-label^='Effort']) span {
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:not([data-claude-has~="slot-composer-rich-input"]) button[aria-label^='Model ·'] {
  color: var(--claude-sidebar-text, var(--claude-color-text)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:not([data-claude-has~="slot-composer-rich-input"]) button[aria-label^='Effort'] {
  color: var(--claude-color-text-tertiary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'] button:has(> .codicon-add)::before {
  width: 12px !important;
}
/* Claude's + is quieter than the text: 84 % of it over the box fill. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'] button:has(> .codicon-add) {
  color: color-mix(in srgb, var(--claude-color-text) 84%, var(--claude-composer-fill)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'] button:has(> .codicon-add)::after {
  height: 12px !important;
}

/* Claude Code shows side panes (files, changes, browser, terminal) as
   separate rounded cards with a gap between them; the session list and the
   conversation stay flat. No overflow clipping: Hermes anchors the portaled
   browser/terminal bodies to the card, and clipping breaks that anchor.
   Cards on the window's top edge start below a titlebar band that holds the
   pane toggles and window controls (pinned there; Hermes would otherwise
   follow the top zone's header down). The band stays a window drag area.
   Measured dark: card #1A1B26, 1px #2B2B2B, ~8px gaps, band ~40px. */
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'] {
  --claude-card-background: #FFFFFF;
  --claude-card-border: #E5E3DA;
  --claude-file-tab: #F0EEE6;
  --claude-file-divider: #E5E3DA;
  --claude-file-row-selected: #F0EEE6;
  --claude-filter-background: #FAF9F5;
  --claude-filter-border: #E5E3DA;
  --claude-card-gap: 4px;
  --claude-card-radius: 10px;
  --claude-card-top: 40px;
}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] {
  --claude-card-background: #1A1B26;
  --claude-card-border: #2B2B2B;
  /* The Files card's open-file tab, divider, selected row and filter field. */
  --claude-file-tab: #3C3D46;
  --claude-file-divider: #31323C;
  --claude-file-row-selected: #31323C;
  --claude-filter-background: #262731;
  --claude-filter-border: #3C3D46;
  /* Claude Code's terminal card and xterm surface (Tokyo Night). Hermes
     resolves the xterm background from this variable at the document. */
  --claude-terminal-background: #16161E;
  --ui-terminal-surface-background: #16161E;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group='grp-terminal']:not([data-pane-host]) {
  --claude-card-background: var(--claude-terminal-background, var(--ui-terminal-surface-background));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group='grp-terminal']:not([data-pane-host]) > [data-panel-header] {
  background: var(--claude-terminal-background, var(--ui-terminal-surface-background)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not(:has([data-tree-tab='workspace'])) {
  margin: var(--claude-card-gap) !important;
  border: 1px solid var(--claude-card-border) !important;
  border-radius: var(--claude-card-radius) !important;
  background: var(--claude-card-background) !important;
  /* Hermes paints pane bodies with these surfaces; inside a card they are the card. */
  --ui-editor-surface-background: var(--claude-card-background);
  --ui-sidebar-surface-background: var(--claude-card-background);
  --ui-terminal-surface-background: var(--claude-card-background);
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not(:has([data-tree-tab='workspace']))[data-window-top] {
  margin-top: var(--claude-card-top) !important;
  --panel-titlebar-left: 0px !important;
  --panel-titlebar-right: 0px !important;
}
/* Below the band, a top card's header no longer makes room for the titlebar:
   size it to its tabs and keep the strip in flow (Hermes drops it below the
   controls in a taller fixed header). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not([data-claude-has~="tree-tab-workspace"])[data-window-top] > [data-panel-header] {
  height: auto !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not([data-claude-has~="tree-tab-workspace"])[data-window-top] > [data-panel-header] > :is([data-zone-tabstrip], [data-panel-page-header]) {
  position: relative !important;
  inset: auto !important;
}
/* A top card without tabs had a header that only carried the window drag
   strip; the band above the card is the drag area now. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not([data-claude-has~="tree-tab-workspace"])[data-window-top] > [data-panel-header]:not(:has([data-zone-tabstrip], [data-panel-page-header])) {
  display: none !important;
}
/* The band and gaps around the cards are the conversation's surface, not the
   darker app chrome behind the tree. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:not(:has([data-tree-group='grp-sessions'])):not(:has([data-tree-group='grp-main'])) {
  background: var(--claude-color-chat) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:has(> [data-tree-group][data-window-top]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not(:has([data-tree-tab='workspace']))) {
  -webkit-app-region: drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [role='separator'] {
  -webkit-app-region: no-drag;
}
/* Hermes docks the terminal as a fixed-height strip under the review/files
   rail. With the rail closed (display:none) the strip takes the whole column,
   as Claude's terminal does; opening Changes or Files brings the rail back
   and the strip returns to its own height. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[style*='display: none'] + div:has(> [data-tree-group='grp-terminal']),
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div[data-claude-has~="child-tree-split-div-tree-group-grp-files"]:not([data-claude-has~="child-tree-split-div-not-style-display-none-tree-gro"]) + div:has(> [data-tree-group='grp-terminal']) {
  flex: 1 1 0% !important;
  max-height: none !important;
}
/* Stretched past a rail Hermes still lays out, the terminal is not flagged as
   the window's top card; give it the band like the others. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div[data-claude-has~="child-tree-split-div-tree-group-grp-files"]:not([data-claude-has~="child-tree-split-div-not-style-display-none-tree-gro"]) + div > [data-tree-group='grp-terminal'] {
  margin-top: var(--claude-card-top) !important;
}
/* Closing the terminal minimizes its zone in Hermes (a header strip); in
   Claude a closed pane is gone, and the panes above take the height. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[style*='flex: 0 0 auto']:has(> [data-tree-group='grp-terminal']) {
  display: none !important;
}
/* A right column left with nothing open (terminal minimized, rail empty) is
   gone too, so the panes beside it take its width. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div:has(> [data-tree-split] > div[style*='flex: 0 0 auto'] > [data-tree-group='grp-terminal']):not(:has(> [data-tree-split] > div:not([style*='display: none']) > [data-tree-split] > div:not([style*='display: none']) > [data-tree-group]:not([data-tree-group='grp-files']))),
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:has(> [data-tree-split] > div[style*='flex: 0 0 auto'] > [data-tree-group='grp-terminal']):has(> [data-tree-split] > div[style*='display: none'] > [data-tree-split]) {
  display: none !important;
}
/* Hermes sizes Changes and Files as narrow side panes (max 20rem) and packs
   them to the right; above a wider terminal they would leave a gap. They
   share the column's full width instead, keeping their relative sizes. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:has(> :is([data-tree-group='grp-review'], [data-tree-group='grp-files'])) {
  flex-grow: 1 !important;
  max-width: none !important;
}
/* Sizes in and around the right column are the plugin's (Hermes clamps its
   side panes to 10-20rem and its drags snap back there); installClaudePaneTools
   drags them, bounds them and keeps these variables, and flags which panes
   are open, so every combination has its rule:
   - the column and the browser beside the conversation: --claude-side-width
     and --claude-preview-width (each opens at Claude's 320px, never
     narrower, never leaving the conversation under 320px);
   - Changes | Files when both are open: --claude-rail-split (half until
     dragged, each at least 200px);
   - the terminal under Changes or Files: --claude-terminal-height (40% until
     dragged; at least 120px, the panes above at least 160px).
   The conversation takes whatever width is left. */
html[data-claude-chat-look='true'][data-hermes-theme]:not([data-claude-expanded]) [data-claude-side-column] {
  flex: 0 1 var(--claude-side-width, 320px) !important;
  min-width: 320px !important;
  max-width: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:not([data-claude-expanded]) [data-claude-preview-column] {
  flex: 0 1 var(--claude-preview-width, 320px) !important;
  min-width: 320px !important;
  max-width: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:not([data-claude-expanded]) [data-tree-split][data-claude-has~="child-claude-preview-column-claude-side-column"] > div:has(> [data-tree-group='grp-main']) {
  flex: 1 1 0% !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-rail-both] [data-tree-split] > div:has(> [data-tree-group='grp-review']:not([data-pane-host])) {
  flex: 0 0 var(--claude-rail-split, 50%) !important;
  min-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-rail-both] [data-tree-split] > div:has(> [data-tree-group='grp-files']:not([data-pane-host])) {
  flex: 1 1 0% !important;
  min-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-rail-open][data-claude-terminal-open]:not([data-claude-expanded]) [data-tree-split] > div:has(> [data-tree-group='grp-terminal']:not([data-pane-host])) {
  flex: 0 0 var(--claude-terminal-height, 40%) !important;
  max-height: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-rail-open][data-claude-terminal-open]:not([data-claude-expanded]) [data-tree-split] > div:has(> [data-tree-split] > div > [data-tree-group='grp-review'], > [data-tree-split] > div > [data-tree-group='grp-files']) {
  flex: 1 1 0% !important;
}
html[data-claude-chat-look='true'][data-claude-side-resizing] {
  user-select: none !important;
}
html[data-claude-chat-look='true'][data-claude-side-resizing='x'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip='x'] {
  cursor: col-resize !important;
}
html[data-claude-chat-look='true'][data-claude-side-resizing='y'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip='y'] {
  cursor: row-resize !important;
}
/* Claude Code's resize grip: a short pill in the gap between the cards, shown
   on hover and while dragging, in place of a full-length line. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip]::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 56px;
  border-radius: 2px;
  background: var(--claude-color-text-tertiary, currentColor);
  opacity: 0;
  transform: translate(calc(-50% - 3px), -50%);
  transition: opacity 120ms ease;
  pointer-events: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip='y']::before {
  width: 56px;
  height: 4px;
  transform: translate(-50%, calc(-50% - 3px));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip]:not([data-claude-has~="next-tree-group-grp-sessions"]) > span:last-child,
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sash] > span {
  opacity: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip]:hover::before,
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-side-resizing] [data-claude-sash]::before {
  opacity: 0.8;
}
/* The terminal's top sash sits in the titlebar band once the rail above it
   is hidden; nothing is left there to resize against. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div[data-claude-has~="child-tree-split-div-tree-group-grp-files"]:not([data-claude-has~="child-tree-split-div-not-style-display-none-tree-gro"]) + div[data-claude-has~="child-tree-group-grp-terminal"] > [role='separator'] {
  display: none !important;
}
/* Hermes floats the terminal over its slot rounded outwards to whole pixels,
   so it covers the card's left and bottom border; keep them visible. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-persistent-terminal] {
  clip-path: inset(0 1px 1px 1px round 0 0 calc(var(--claude-card-radius, 10px) - 1px) calc(var(--claude-card-radius, 10px) - 1px));
}
/* The terminal list's active marker is an accent line on the card's edge;
   the active row's fill already marks it. */
html[data-claude-chat-look='true'][data-hermes-theme] [class*='group/rail'] li > span[class~='absolute'][class~='right-0'] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [class*='group/rail'] {
  border-left-color: var(--claude-card-border, var(--ui-stroke-secondary)) !important;
}
/* Terminal card header as in Claude Code: a plain "Terminal" title with +
   beside it, menu / expand / close on the right (installClaudeTerminalHeader).
   Hermes' tab close would drop the pane from the layout, and its Hide chevron
   is behind the close button, so both leave the strip. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip]:has([data-tree-tab='terminal'][role='tab']) {
  align-items: center !important;
  min-height: 40px !important;
  padding: 0 8px 0 14px !important;
  background: transparent !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-has~="tree-tab-terminal-role-tab"] > [role='tablist'] {
  flex: 0 1 auto !important;
  align-items: center !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] {
  height: auto !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab']::before,
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab']::after {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] .pane-tab-content,
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] .pane-tab-content > span {
  padding: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] {
  min-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] span.truncate {
  font-size: 14px !important;
  font-weight: 400 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] > span:has(> button[aria-label='Close']),
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-has~="tree-tab-terminal-role-tab"] > button[aria-label='Hide'] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='actions'] {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action] {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--claude-color-text-secondary, currentColor);
  cursor: pointer;
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='add'] {
  margin-left: 4px;
  color: var(--claude-color-text, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action]:hover,
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action][aria-pressed='true'] {
  background: var(--claude-menu-hover, var(--ui-row-hover-background));
  color: var(--claude-color-text, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action] > svg {
  width: 16px;
  height: 16px;
}
/* Terminals are header tabs here, so Hermes' terminal list rail goes. */
html[data-claude-chat-look='true'][data-hermes-theme] [class*='group/rail']:has(> ul[aria-label='Terminals']) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-terminal-tabs='true'] > [role='tablist']:not([data-claude-terminal-header]) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='tabs'] {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='add'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='actions'] {
  flex-shrink: 0;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab] {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 2px;
  min-width: 52px;
  height: 24px;
  padding: 0 2px 0 8px;
  overflow: hidden;
  border-radius: 6px;
  color: var(--claude-color-text-secondary, currentColor);
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab] > span {
  min-width: 0;
  overflow: hidden;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab][aria-selected='true'] {
  flex-shrink: 0;
  background: color-mix(in srgb, var(--claude-color-text, currentColor) 10%, transparent);
  color: var(--claude-color-text, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab]:hover {
  color: var(--claude-color-text, currentColor);
}
/* A background tab shows its close on hover, leaving its title the room. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab][aria-selected='false']:not(:hover) > [data-claude-terminal-action] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab][aria-selected='false']:not(:hover) {
  padding-right: 8px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab] > [data-claude-terminal-action] {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab] > [data-claude-terminal-action] > svg {
  width: 12px;
  height: 12px;
}
/* Expanded, the terminal card takes the workspace right of the session list:
   every other zone steps aside (Hermes floats pane bodies over their zone, so
   the card itself has to stay in the layout). */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='terminal'] [data-tree-split] > div:not(:has([data-tree-group='grp-terminal'])):not(:has([data-tree-group='grp-sessions'])) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='terminal'] [data-tree-split] > div:has([data-tree-group='grp-terminal']):not(:has([data-tree-group='grp-sessions'])) {
  flex: 1 1 0% !important;
  max-width: none !important;
  max-height: none !important;
}
/* As in Claude Code: the expanded card starts below the titlebar band, and
   the band keeps only the window controls (the card's own toggle restores).
   The ID-less :not(#…) outranks the generic card margin. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='terminal'] [data-tree-split] > div > [data-tree-group='grp-terminal']:not([data-pane-host]):not(#claude-terminal-expanded) {
  margin-top: var(--claude-card-top, 40px) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='terminal'] [data-claude-pane-tools] {
  visibility: hidden !important;
}
/* Expanded Files: the same as the expanded terminal, for the Files card. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'] [data-tree-split] > div:not(:has([data-tree-group='grp-files'])):not(:has([data-tree-group='grp-sessions'])) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'] [data-tree-split] > div:has([data-tree-group='grp-files']):not(:has([data-tree-group='grp-sessions'])) {
  flex: 1 1 0% !important;
  max-width: none !important;
  max-height: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'] [data-claude-pane-tools] {
  visibility: hidden !important;
}
/* Claude Code's Files header: "Files" on the left; Hermes' own tree tools
   (gitignored files, refresh, collapse all), then expand and close. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] {
  height: 32px !important;
  padding: 0 8px 0 14px !important;
  align-items: center !important;
  gap: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child {
  flex: 1 1 auto;
  min-width: 0;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child > span {
  font-size: 0 !important;
  padding: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child > span > * {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child > span::before {
  content: 'Files';
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button {
  display: grid !important;
  place-items: center !important;
  width: 26px !important;
  height: 26px !important;
  border-radius: 6px !important;
  color: var(--claude-color-text-secondary) !important;
  /* Hermes reveals these on hover; Claude's header tools always show. */
  opacity: 1 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button:disabled {
  opacity: 0.4 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button:hover,
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button[aria-pressed='true'] {
  background: var(--claude-menu-hover, var(--ui-row-hover-background)) !important;
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button .codicon {
  font-size: 15px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > [data-claude-terminal-header='files-actions'] {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 2px;
}
/* Claude Code shows an open file inside the Files card, left of the tree.
   Hermes opens files in its preview zone, which sits right before the
   Files column; with a file active there and Files open (and nothing above
   or below it), the two cards close up into one: no gap, one border, a
   divider between file and tree. The zone keeps only its file tabs; the
   browser button still brings the browser back. The :not(#…) outranks the
   generic card margins. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-joined) {
  margin-right: 0 !important;
  border-right-width: 0 !important;
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined) {
  margin-left: 0 !important;
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-pane-host^='preview-tile:'] {
  border-bottom-right-radius: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:url:'],
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [data-zone-tabstrip] button[aria-label='New tab'] {
  display: none !important;
}
/* One card: the file's header on the card colour, and Claude's divider
   between the file and the tree. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [data-panel-header],
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [data-zone-tabstrip] {
  background: var(--claude-card-background) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined) {
  border-left-color: var(--claude-file-divider, var(--claude-card-border)) !important;
  border-left-width: 1px !important;
}
/* In the joined file + Files card the file's tab is the title, as in Claude. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-files-header='true'] > div:first-child > span::before {
  content: '' !important;
}
/* The joined card as Claude's Files card with a file open. Its width is
   --claude-files-card; installClaudePaneTools sets data-claude-files-view:
   'both' (wide card: file | tree, the tree --claude-files-tree wide), 'file'
   (the tree toggled off, or a narrow card) or 'tree' (narrow card, toggle
   on). The :not(#…) outranks the column width rules. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='both']:not([data-claude-expanded]) [data-tree-split] > [data-claude-preview-column]:not(#claude-files-view) {
  flex: 0 0 calc(var(--claude-files-card, 392px) - var(--claude-files-tree, 240px)) !important;
  min-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='both']:not([data-claude-expanded]) [data-tree-split] > [data-claude-side-column]:not(#claude-files-view) {
  flex: 0 0 var(--claude-files-tree, 240px) !important;
  min-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file'] [data-tree-split] > [data-claude-side-column]:not(#claude-files-view),
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='tree'] [data-tree-split] > [data-claude-preview-column]:not(#claude-files-view) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file']:not([data-claude-expanded]) [data-tree-split] > [data-claude-preview-column]:not(#claude-files-view) {
  flex: 0 0 var(--claude-files-card, 392px) !important;
  min-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='tree']:not([data-claude-expanded]) [data-tree-split] > [data-claude-side-column]:not(#claude-files-view) {
  flex: 0 0 var(--claude-files-card, 392px) !important;
  min-width: 0 !important;
}
/* A card showing one side has its own outer edge back. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file'] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-joined):not(#claude-files-view) {
  margin-right: var(--claude-card-gap, 4px) !important;
  border-right-width: 1px !important;
  border-top-right-radius: var(--claude-card-radius, 10px) !important;
  border-bottom-right-radius: var(--claude-card-radius, 10px) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file'] [data-pane-host^='preview-tile:'] {
  border-bottom-right-radius: calc(var(--claude-card-radius, 10px) - 1px) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='tree'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined):not(#claude-files-view) {
  margin-left: var(--claude-card-gap, 4px) !important;
  border-top-left-radius: var(--claude-card-radius, 10px) !important;
  border-bottom-left-radius: var(--claude-card-radius, 10px) !important;
}
/* The tools that move into the file's header while it shows alone. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-actions] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file'] [data-claude-file-actions] {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  padding-right: 8px;
}
/* Expanded Files with a file open: the file large on the left, the tree
   at its own width on the right (or the file alone). */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'][data-claude-file-joined] [data-tree-split] > [data-claude-preview-column]:not(#claude-files-expanded) {
  display: flex !important;
  flex: 1 1 0% !important;
  min-width: 0 !important;
  max-width: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'][data-claude-file-joined][data-claude-files-view='both'] [data-tree-split] > [data-claude-side-column]:not(#claude-files-expanded) {
  flex: 0 0 var(--claude-files-tree-wide, 240px) !important;
  min-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'][data-claude-file-joined][data-claude-files-view='file'] [data-tree-split] > [data-claude-side-column]:not(#claude-files-expanded) {
  display: none !important;
}
/* The joined card's header carries no zone minimize (Claude has none). */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [data-zone-tabstrip] > button[aria-label='Minimize'] {
  display: none !important;
}
/* A previewed file's mode bar as Claude's path row: the file name, then one
   toggle (</> to the source, an eye back to the rendered view). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] {
  height: 36px !important;
  padding: 0 8px 0 14px !important;
  gap: 4px !important;
  border-bottom: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name]::before {
  content: attr(data-claude-file-name);
  margin-right: auto;
  overflow: hidden;
  font-size: 14px;
  color: var(--claude-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name][data-claude-has~="child-claude-mode-rendered"][data-claude-has~="child-claude-mode-source"] > :is([data-claude-mode='rendered'], [data-claude-mode='source'])[class~='underline'] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > :is([data-claude-mode='rendered'], [data-claude-mode='source']):not([class~='underline']) {
  display: grid !important;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 0 !important;
  color: var(--claude-color-text-secondary) !important;
  text-decoration: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > :is([data-claude-mode='rendered'], [data-claude-mode='source']):not([class~='underline']):hover {
  background: var(--claude-menu-hover, var(--ui-row-hover-background));
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > :is([data-claude-mode='rendered'], [data-claude-mode='source']):not([class~='underline'])::before {
  content: '';
  width: 16px;
  height: 16px;
  background: currentColor;
  -webkit-mask: var(--claude-file-mode-icon) center / contain no-repeat;
  mask: var(--claude-file-mode-icon) center / contain no-repeat;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > [data-claude-mode='source'] {
  --claude-file-mode-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 4.75 1.75 8 5 11.25M11 4.75 14.25 8 11 11.25M9.25 3.25l-2.5 9.5'/%3E%3C/svg%3E");
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > [data-claude-mode='rendered'] {
  --claude-file-mode-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z'/%3E%3Ccircle cx='8' cy='8' r='2'/%3E%3C/svg%3E");
}
/* Claude's empty Files state (tree toggled off, no file open). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='empty'] [data-tree-group='grp-files'] [data-project-tree] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='empty'] [data-claude-files-empty] {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 0;
  padding: 0 16px 40px;
  text-align: center;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] > svg {
  width: 22px;
  height: 22px;
  margin-bottom: 6px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] > strong {
  font-size: 14px;
  font-weight: 500;
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] > span {
  font-size: 13px;
  color: var(--claude-color-text-tertiary, currentColor);
}
/* The empty state's hint: beside the tree it points at the tree as well. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] > [data-claude-files-empty-split],
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-claude-files-empty] > span:not([data-claude-files-empty-split]) {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-claude-files-empty] > [data-claude-files-empty-split] {
  display: block;
}
/* A wide Files card with no file open, as in Claude: the header across the
   top, the empty file area on the left and the tree at its own width on the
   right behind a divider. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-tree-group='grp-files'] div:has(> [data-project-tree]) {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) var(--claude-files-tree-wide, 240px);
  grid-template-rows: auto auto minmax(0, 1fr);
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-tree-group='grp-files'] div[data-claude-has~="child-project-tree"] > [data-claude-files-header] {
  grid-column: 1 / -1;
  grid-row: 1;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-tree-group='grp-files'] [data-claude-tree-filter] {
  grid-column: 2;
  grid-row: 2;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-tree-group='grp-files'] :is([data-project-tree], [data-claude-tree-results]) {
  grid-column: 2;
  grid-row: 3;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-claude-files-empty] {
  display: flex;
  grid-column: 1;
  grid-row: 2 / 4;
  border-right: 1px solid var(--claude-file-divider, var(--claude-card-border));
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 0;
  padding: 0 16px 40px;
  text-align: center;
}
/* Files sharing its column with Changes or the terminal, a file open: the
   file's card takes the Files card's place (--claude-over-*, kept by
   installClaudePaneTools), as Claude shows a file inside its Files card; the
   tree toggle swaps it for the tree. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='file'] [data-tree-split] > [data-claude-preview-column]:not(#claude-file-over) {
  position: fixed !important;
  left: var(--claude-over-x) !important;
  top: var(--claude-over-y) !important;
  width: var(--claude-over-w) !important;
  height: var(--claude-over-h) !important;
  display: flex !important;
  flex: none !important;
  min-width: 0 !important;
  max-width: none !important;
  z-index: 22;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='file'] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-over):not(#claude-card) {
  margin: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='file'] [data-claude-preview-column] > [role='separator'] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='tree'] [data-tree-split] > [data-claude-preview-column]:not(#claude-file-over) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='file'] [data-claude-file-actions] {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  padding-right: 8px;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over] [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:url:'],
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over] [data-claude-preview-column] [data-zone-tabstrip] button[aria-label='New tab'],
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over] [data-claude-preview-column] [data-zone-tabstrip] > button[aria-label='Minimize'] {
  display: none !important;
}
/* Resize sashes light up in a quiet neutral line, not Hermes' accent. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] [role='separator'] {
  --ui-sash-hover-border: color-mix(in srgb, var(--claude-color-text, currentColor) 22%, transparent);
}
/* Files closed on its own (see installClaudePaneTools): hide its card, and the
   rail above the terminal once nothing else is left in it. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div:has(> [data-tree-group='grp-files']),
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div:has(> [data-tree-split] > div > [data-tree-group='grp-files']):not(:has(> [data-tree-split] > div:not([style*='display: none']) > [data-tree-group]:not([data-tree-group='grp-files']))) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-titlebar-cluster='right'] {
  top: var(--titlebar-controls-top) !important;
}
/* Portaled pane bodies (browser, terminal) sit inside the card's lower edge. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-pane-host]:not([data-pane-host='workspace']) {
  border-bottom-left-radius: calc(var(--claude-card-radius) - 1px) !important;
  border-bottom-right-radius: calc(var(--claude-card-radius) - 1px) !important;
  overflow: hidden !important;
}
/* No hairlines between cards: the gap separates them. The session list edge
   (the separator on the conversation's track) keeps its line. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:not([data-claude-has~="child-tree-group-grp-sessions-tree-group-grp-main"]) > [role='separator'] > span:first-child {
  opacity: 0 !important;
}

/* Pane type at Claude's sizes, measured 1:1 against Claude Code: file rows
   14px (Hermes' virtualized 22px row pitch stays, it is a JS constant), pane
   titles 13px/500 in sentence case instead of 10px spaced mono capitals,
   card tabs 13px. None of these has a Hermes setting; chat text keeps its own. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] .row-hover {
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] .group\\/project-header span:is(.uppercase, [data-pane-self-label]) {
  font-family: inherit !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
  color: var(--claude-color-text, var(--ui-text-primary)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not([data-claude-has~="tree-tab-workspace"]) [data-slot='pane-tab'] span.truncate {
  font-size: 13px !important;
}

/* Claude's sidebar search, measured at 125 %: the field lines up with the
   nav rows (x 10.4), 26.4px tall, a 12px glyph at x 20 and 14px text at
   x 42.4 in #898781. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-slot='sidebar-content'] > div:has(input[aria-label='Search sessions']) {
  padding-left: 0.4px !important;
  padding-right: 6.6px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']) {
  height: 26.4px !important;
  min-height: 26.4px !important;
  padding: 0 8px 0 9px !important;
  /* Hermes dims the idle field to 30 %; Claude's is always fully drawn. */
  opacity: 1 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div[data-claude-has~="child-input-label-search-sessions"] > svg {
  margin-right: 2.2px !important;
  color: var(--claude-search-text, var(--claude-color-text-tertiary)) !important;
}

/* Tool rows as Claude draws them: no leading glyph, and an opened row is a
   rounded #2D2D2D-edged box whose output sits in a #1A1B26 code well. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] button[aria-expanded] > span > span > span[class*='size-3.5']:first-child {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] {
  border: 1px solid var(--claude-tool-border, var(--claude-k-2d2d2d)) !important;
  border-radius: 8px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:first-child {
  border-bottom: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] pre {
  margin: 0 2px 2px;
  border-radius: 6px;
  background: var(--claude-tool-well, #1A1B26) !important;
}

/* Claude's tool blocks: a group's summary is one quiet 14px line with a
   chevron; opened, its steps sit in a rounded, ruled card, and an opened step
   shows its command and output in a dark code well. A running step (and the
   group holding it) wears the turning orange dots instead of Hermes' spinner. */
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'] {
  --claude-tool-card: #333332;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] [data-tool-summary] button .whitespace-nowrap,
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] button[aria-expanded] .whitespace-nowrap {
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not(:has(.tool-ticker)):not(.tool-ticker):not(:empty) {
  gap: 0 !important;
  margin-top: 6px;
  overflow: hidden;
  border: 1px solid var(--claude-tool-card, var(--claude-k-333332));
  border-radius: 10px;
}
/* Running steps arrive wrapped one level deeper; reach them there too. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > [data-tool-row],
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > * > [data-tool-row] {
  border: 0 !important;
  border-radius: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > [data-tool-row] + [data-tool-row],
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > * + * > [data-tool-row] {
  border-top: 1px solid var(--claude-tool-card, var(--claude-k-333332)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > [data-tool-row] > div:first-child,
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > * > [data-tool-row] > div:first-child {
  padding: 7px 12px !important;
  border-bottom: 0 !important;
}
/* An opened step: its command and output in a code well inside the card. */
/* A lone step opens plainly: its line stays, the code well hangs below it. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group]:not([data-claude-has~="child-tool-summary"]) [data-tool-row][data-tool-open] {
  border: 0 !important;
  border-radius: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group]:not([data-claude-has~="child-tool-summary"]) [data-tool-row][data-tool-open] > div:first-child {
  padding: 0 !important;
  border-bottom: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group]:not([data-claude-has~="child-tool-summary"]) [data-tool-row][data-tool-open] > div:nth-child(2) {
  margin: 6px 0 4px !important;
}
/* …and, as in Claude, it opens into the same bordered card a group uses:
   label, code well, output. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group]:not([data-claude-has~="child-tool-summary"]) [data-tool-row][data-tool-open] > div:nth-child(2):has([data-claude-payload]) {
  padding: 12px 14px !important;
  border: 1px solid var(--claude-tool-card, var(--claude-k-333332)) !important;
  border-radius: 10px !important;
  background: transparent !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:nth-child(2) {
  /* Hermes sizes the body w-full; with the card's margins it would overrun. */
  width: auto !important;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  margin: 0 12px 12px;
  padding: 8px 10px !important;
  border: 1px solid var(--claude-tool-card, var(--claude-k-333332));
  border-radius: 8px;
  background: var(--claude-tool-well, #1A1B26);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:nth-child(2) pre {
  max-height: 320px !important;
  margin: 0 !important;
  padding: 4px 0 0 !important;
  background: transparent !important;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace !important;
  font-size: 12.5px !important;
  line-height: 1.55 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:nth-child(2) code {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace !important;
  font-size: 12.5px !important;
}
/* Running: the step's spinner slot shows Claude's dots; so does its group. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] button[aria-expanded] > span > span > span[class*='size-3.5']:first-child:has([role='status'] .glyph-spinner) {
  display: inline-grid !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status'][data-claude-has~="glyph-spinner"] > * {
  visibility: hidden;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status']:has(.glyph-spinner),
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="tool-row-role-status-glyph-spinner"] > [data-tool-summary] button::before {
  position: relative;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status']:has(.glyph-spinner)::before,
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="tool-row-role-status-glyph-spinner"] > [data-tool-summary] button::before {
  content: '';
  flex: none;
  display: block;
  width: 12px;
  height: 12px;
  background:
    radial-gradient(circle, var(--claude-working, #D97757) 1.3px, transparent 1.7px) 50% 0 / 4px 4px no-repeat,
    radial-gradient(circle, var(--claude-working, #D97757) 1.3px, transparent 1.7px) 100% 50% / 4px 4px no-repeat,
    radial-gradient(circle, var(--claude-working, #D97757) 1.3px, transparent 1.7px) 50% 100% / 4px 4px no-repeat,
    radial-gradient(circle, var(--claude-working, #D97757) 1.3px, transparent 1.7px) 0 50% / 4px 4px no-repeat;
  animation: claude-working-turn 1.6s steps(8) infinite;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status']:has(.glyph-spinner)::before {
  position: absolute;
  inset: 1px;
  width: auto;
  height: auto;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="tool-row-role-status-glyph-spinner"] > [data-tool-summary] button {
  align-items: center !important;
  gap: 8px !important;
}
@media (prefers-reduced-motion: reduce) {
  html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status']:has(.glyph-spinner)::before,
  html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="tool-row-role-status-glyph-spinner"] > [data-tool-summary] button::before {
    animation: none;
  }
}

/* While a collapsed group runs, Hermes shows its live step in a one-line
   ticker under the summary: a plain 14px line, not a card. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] .tool-ticker button[aria-expanded] .whitespace-nowrap {
  font-size: 14px !important;
}
/* Its live step can carry data-tool-open; inside the ticker that must not
   draw the opened step's rounded box (a cramped pill). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] .tool-ticker [data-tool-row] {
  border: 0 !important;
  border-radius: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] .tool-ticker [data-tool-row] > div:first-child {
  padding: 0 !important;
  border: 0 !important;
}
/* Claude stops a turn from the composer only; Hermes' duplicate Stop in the
   sent message's corner is hidden (the composer's Stop stays). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='aui_user-message-root'] button[aria-label='Stop'] {
  display: none !important;
}
/* A long summary stays inside the column (it fades out, as Hermes masks it)
   instead of widening the group's grid past the thread. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group],
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] > div:not([data-tool-summary]) {
  grid-template-columns: minmax(0, 1fr) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] [data-tool-summary] > div {
  min-width: 0;
}

/* Technical tool payloads, read as Claude shows a call: label, the command
   or code as written, a rule, the output. The raw JSON stays hidden beside. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-host] > :is(button, pre):not([data-claude-payload] *) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload] {
  display: grid;
  gap: 6px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-label] {
  font-size: 14px;
  font-weight: 400;
  color: var(--claude-sidebar-text, var(--claude-k-c3c2b7));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload] pre {
  max-height: 260px !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: transparent !important;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace !important;
  font-size: 12.5px !important;
  line-height: 1.55 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [data-claude-payload] pre[data-claude-payload-code][data-claude-payload-code] {
  padding: 10px 12px !important;
  border-radius: 8px;
  background: var(--claude-tool-well, #1A1B26) !important;
  color: #C0CAF5 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='str'] { color: #9ECE6A; }
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='cmd'] { color: #2AC3DE; }
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='kw'] { color: #BB9AF7; }
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='fn'] { color: #7AA2F7; }
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='num'] { color: #FF9E64; }
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='flag'] { color: #E0AF68; }
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='op'] { color: #89DDFF; }
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='com'] { color: #565F89; font-style: italic; }
/* The step's body is the card itself; only the code sits in a well. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:nth-child(2):has([data-claude-payload]) {
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-prompt] {
  color: var(--claude-color-text-tertiary);
  user-select: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-out] {
  padding: 2px 2px 0 !important;
  color: var(--claude-sidebar-text, var(--claude-k-c3c2b7)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-exit] {
  font-size: 12px;
  color: var(--claude-k-ec7e7e);
}

/* Claude's working mark: four #D97757 dots turning in 45° steps, in place of
   Hermes' dithered square. Hermes' label and elapsed timer stay. */
@keyframes claude-working-turn { to { transform: rotate(360deg); } }
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'], [data-slot='aui_response-loading']) .dither {
  position: relative;
  background: none !important;
  color: transparent !important;
  opacity: 1 !important;
  -webkit-mask: none !important;
  mask: none !important;
  animation: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'], [data-slot='aui_response-loading']) .dither::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle, var(--claude-working, #D97757) 1.3px, transparent 1.7px) 50% 0 / 4px 4px no-repeat,
    radial-gradient(circle, var(--claude-working, #D97757) 1.3px, transparent 1.7px) 100% 50% / 4px 4px no-repeat,
    radial-gradient(circle, var(--claude-working, #D97757) 1.3px, transparent 1.7px) 50% 100% / 4px 4px no-repeat,
    radial-gradient(circle, var(--claude-working, #D97757) 1.3px, transparent 1.7px) 0 50% / 4px 4px no-repeat;
  animation: claude-working-turn 1.6s steps(8) infinite;
}
@media (prefers-reduced-motion: reduce) {
  html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'], [data-slot='aui_response-loading']) .dither::before {
    animation: none;
  }
}

/* Search hover, as Claude: the field lifts to #333333 and shows its
   Ctrl K chips (outlined, no fill). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']) {
  position: relative;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover {
  background: var(--claude-search-hover, var(--claude-k-333333)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover::before,
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover::after {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  box-sizing: border-box;
  place-items: center;
  padding: 0 4px;
  border: 1px solid var(--claude-kbd-border, var(--claude-k-4a4a48));
  border-radius: 4px;
  color: var(--claude-kbd-text, var(--claude-k-a5a49a));
  font: inherit;
  font-size: 10.5px;
  line-height: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover::before {
  content: 'Ctrl';
  right: 28px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover::after {
  content: 'K';
  right: 8px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] input[aria-label='Search sessions'] {
  cursor: pointer;
}

/* Hermes' command palette as Claude's search dialog: centred, 668px,
   #20201F with a #373736 edge, a bare "Search" field, sentence-case group
   labels, 36px rows (#313130 when selected) and a key-hint footer. */
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog']:has(> [cmdk-root]) {
  top: 50% !important;
  width: min(668px, calc(100vw - 32px)) !important;
  max-width: none !important;
  translate: -50% -50% !important;
  overflow: hidden;
  border: 1px solid var(--claude-menu-border) !important;
  border-radius: 14px !important;
  background: var(--claude-menu-background) !important;
  box-shadow: 0 24px 64px var(--claude-menu-shadow) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='command-input-wrapper'] {
  height: 56px !important;
  padding: 0 22px !important;
  border-bottom: 1px solid var(--claude-menu-border) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='command-input-wrapper'] > svg {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [cmdk-input] {
  font-size: 15px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [cmdk-list] {
  max-height: min(440px, 60vh) !important;
  padding: 6px 9px 8px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [cmdk-group-heading] {
  padding: 10px 12px 6px !important;
  color: var(--claude-color-text-tertiary) !important;
  font-size: 12.5px !important;
  font-weight: 500 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='command-item'] {
  min-height: 36px !important;
  padding: 0 12px !important;
  border-radius: 8px !important;
  color: var(--claude-sidebar-text, var(--claude-color-text)) !important;
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='command-item'][data-selected='true'] {
  background: var(--claude-palette-selected, var(--claude-k-313130)) !important;
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='kbd'] {
  border: 1px solid var(--claude-kbd-border, var(--claude-k-4a4a48)) !important;
  border-radius: 4px !important;
  background: transparent !important;
  color: var(--claude-kbd-text, var(--claude-k-a5a49a)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-palette-foot] {
  display: flex;
  height: 40px;
  align-items: center;
  gap: 22px;
  padding: 0 22px;
  border-top: 1px solid var(--claude-menu-border);
  color: var(--claude-color-text-tertiary);
  font-size: 12.5px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-palette-foot] > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-palette-foot] kbd {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  box-sizing: border-box;
  place-items: center;
  padding: 0 4px;
  border: 1px solid var(--claude-kbd-border, var(--claude-k-4a4a48));
  border-radius: 4px;
  color: var(--claude-kbd-text, var(--claude-k-a5a49a));
  font: inherit;
  font-size: 10.5px;
  line-height: 14px;
}
html:not([data-claude-chat-look='true']) [data-claude-palette-foot] {
  display: none !important;
}

/* Claude's search dialog (plugin DOM). Measured: 668px panel, #20201F on a
   #373736 edge, 14px radius; tabs as quiet pills with the active one lifted;
   36px rows, #313130 when selected; #898781 section labels and times;
   outlined key chips; 40px footer. */
html:not([data-claude-chat-look='true']) [data-claude-search-dialog] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-dialog] {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 150);
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 35%);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-panel] {
  display: flex;
  box-sizing: border-box;
  width: min(668px, calc(100vw - 32px));
  height: min(580px, calc(100vh - 48px));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--claude-menu-border);
  border-radius: 14px;
  background: var(--claude-menu-background);
  color: var(--claude-color-text);
  box-shadow: 0 24px 64px var(--claude-menu-shadow);
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-head] {
  display: flex;
  height: 52px;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 0 14px 0 22px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-head] > input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--claude-color-text);
  font: inherit;
  font-size: 15px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-head] > input::placeholder {
  color: var(--claude-search-text, var(--claude-color-text-tertiary));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-close] {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--claude-color-text-secondary);
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-close]:hover {
  background: var(--claude-menu-hover);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-tabs] {
  display: flex;
  flex: none;
  gap: 2px;
  padding: 0 16px 12px;
  border-bottom: 1px solid var(--claude-menu-border);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-tabs] > button {
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--claude-color-text-tertiary);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-tabs] > button:hover {
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-tabs] > button[aria-selected='true'] {
  background: var(--claude-palette-selected, var(--claude-k-313130));
  color: var(--claude-color-text);
  font-weight: 600;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-list] {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 9px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-heading] {
  padding: 10px 12px 6px;
  color: var(--claude-color-text-tertiary);
  font-size: 12.5px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row] {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--claude-sidebar-text, var(--claude-color-text));
  cursor: default;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row] > .codicon {
  width: 16px;
  flex: none;
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][aria-selected='true'] {
  background: var(--claude-palette-selected, var(--claude-k-313130));
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][aria-selected='true'] [data-claude-search-title] {
  font-weight: 600;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-title] {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-meta] {
  flex: none;
  color: var(--claude-color-text-tertiary);
  font-size: 12.5px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-more],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-enter] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][aria-selected='true'] [data-claude-search-meta] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][aria-selected='true'] :is([data-claude-search-more], [data-claude-search-enter]) {
  display: grid;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-more] {
  width: 24px;
  height: 22px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--claude-color-text-secondary);
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-more]:hover {
  background: var(--claude-menu-hover);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-enter] {
  color: var(--claude-color-text-tertiary);
  font-size: 12px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-empty] {
  display: grid;
  height: 100%;
  min-height: 160px;
  place-content: center;
  justify-items: center;
  gap: 10px;
  color: var(--claude-color-text-secondary);
  text-align: center;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-empty] > p {
  margin: 0;
  color: var(--claude-color-text);
  font-size: 15px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-empty] > button {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  background: var(--claude-palette-selected, var(--claude-k-313130));
  color: var(--claude-color-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-foot] {
  display: flex;
  height: 40px;
  flex: none;
  align-items: center;
  gap: 22px;
  padding: 0 22px;
  border-top: 1px solid var(--claude-menu-border);
  color: var(--claude-color-text-tertiary);
  font-size: 12.5px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-foot] > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-search-foot], [data-claude-search-row-menu]) kbd {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  box-sizing: border-box;
  place-items: center;
  padding: 0 4px;
  border: 1px solid var(--claude-kbd-border, var(--claude-k-4a4a48));
  border-radius: 4px;
  color: var(--claude-kbd-text, var(--claude-k-a5a49a));
  font: inherit;
  font-size: 10.5px;
  line-height: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu] {
  position: fixed;
  z-index: 1;
  box-sizing: border-box;
  width: 280px;
  padding: 6px;
  border: 1px solid var(--claude-menu-border);
  border-radius: 10px;
  background: var(--claude-menu-background);
  box-shadow: 0 12px 32px var(--claude-menu-shadow);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu-head] {
  display: grid;
  gap: 2px;
  padding: 6px 8px 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--claude-menu-border);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu-head] > strong {
  font-weight: 600;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu-head] > span {
  color: var(--claude-color-text-tertiary);
  font-size: 12.5px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu] > button {
  display: flex;
  width: 100%;
  height: 32px;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--claude-color-text);
  font: inherit;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu] > button:is(:hover, :focus-visible) {
  background: var(--claude-palette-selected, var(--claude-k-313130));
  outline: none;
}

/* The ASCII backdrop sits under an empty conversation's content. The :not(#…)
   outranks the integrated-header rule that paints grp-main in sidebar grey,
   so the header and the glyph field share one chat colour. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host]:not(#claude-ascii-none) {
  isolation: isolate;
  background: var(--claude-color-chat) !important;
}
/* The conversation surfaces above it go clear so the glyphs show through. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host] :is([data-slot='thread'], div:has(> [data-slot='composer-bounds']), [data-slot='composer-bounds'], [data-slot='aui_thread-viewport'], [data-slot='aui_thread-content']) {
  background: transparent !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-backdrop] {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
html:not([data-claude-chat-look='true']) [data-claude-ascii-backdrop] {
  display: none !important;
}

/* Claude Code's session sidebar is 234 CSS px at 100 % (292 device px at
   125 %). The user asked for a fixed Claude width, so the sized track is
   pinned; minimized (flex: 0 0) and collapsed sidebars stay native. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split]
  > div:has(> [data-tree-group='grp-sessions']):not([style*='display: none']):not([style*='flex: 0 0']):not([style*='flex:0 0']) {
  flex: 0 0 234px !important;
  max-width: 234px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']):not([style*='flex: 0 0']):not([style*='flex:0 0'])
  [data-tour='sessions-sidebar'] {
  width: 100% !important;
}

/* Claude's sidebar edge is one full device pixel, not the Codex quarter-pixel
   hairline. --claude-split-scale scales a 1 CSS px line. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div > [role='separator'][class~='inset-y-0'] {
  --claude-split-scale: 1 !important;
}
@media (min-resolution: 1.2dppx) {
  html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split]
    > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
    + div > [role='separator'][class~='inset-y-0'] { --claude-split-scale: .8 !important; }
}
@media (min-resolution: 1.45dppx) {
  html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split]
    > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
    + div > [role='separator'][class~='inset-y-0'] { --claude-split-scale: .667 !important; }
}
@media (min-resolution: 1.95dppx) {
  html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split]
    > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
    + div > [role='separator'][class~='inset-y-0'] { --claude-split-scale: .5 !important; }
}

/* Session rows: no age label (Claude shows titles only); the row menu still
   appears on hover. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] .session-row-tail {
  display: none !important;
}

/* Sidebar header: Sessions / Bots become Claude's segmented chat/code toggle
   (#1D1D1D track, #343434 active segment). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [role='tablist'] {
  flex: 0 0 auto !important;
  align-self: center;
  gap: 2px;
  height: 30px;
  padding: 3px;
  border-radius: 8px;
  background: var(--claude-segment-track);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab'] {
  height: 24px !important;
  border: 0 !important;
  border-radius: 6px !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--claude-color-text-tertiary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab']::before,
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab']::after {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab'][data-active='true'] {
  background: var(--claude-segment-active) !important;
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab'] span[class~='uppercase'] {
  font-size: 13px !important;
}

/* Main header: chat tabs read like Claude's title — no tab chips, the active
   chat in 14px semibold, others muted. Selectors match the Codex tab rules'
   weight so they win by order. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip='grp-main'] [role='tab'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) {
  --tab-bg: transparent;
  --tab-face: transparent;
  background: transparent !important;
  color: var(--claude-color-text-tertiary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) {
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab'] > .pane-tab-content > :is(span, button) > span.truncate {
  font-size: 14px !important;
}
/* Claude's header (2026-10, measured 1:1): the open session's title is 14px
   medium in the primary text colour; an empty "New session" is regular and
   tertiary (#898781). It sits on the window controls' line (centre ~17.6px),
   28px in, with no status dot or new-tab button. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) > .pane-tab-content > :is(span, button) > span.truncate {
  font-weight: 450 !important;
  letter-spacing: normal !important;
  color: var(--claude-color-text) !important;
}
/* The title runs its full length (Claude does not clip it at a tab width);
   the hover close button gives way to the chevron. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) {
  max-width: min(640px, 100%) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) > span:has(> button[aria-label='Close']) {
  display: none !important;
}
[data-claude-title-chevron] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) [data-claude-title-chevron] {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  margin-left: -4px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--claude-color-text);
  cursor: pointer;
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) [data-claude-title-chevron] > .codicon {
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) [data-claude-title-chevron]:is(:hover, [aria-expanded='true']) {
  background: var(--claude-account-hover, var(--claude-k-262626));
}
/* A fresh session has nothing to act on yet: no chevron, as in Claude. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-claude-has~="slot-message"]) [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) [data-claude-title-chevron] {
  display: none;
}
/* The menu as Claude draws it: #202020, 14px rows, red Delete. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] {
  min-width: 136px;
  padding: 4px !important;
  border: 1px solid var(--claude-card-border, var(--claude-k-2b2b2b)) !important;
  border-radius: 10px !important;
  background: var(--claude-k-202020) !important;
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem'] {
  min-height: 28px;
  padding: 4px 8px !important;
  border-radius: 6px !important;
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem']:not([data-variant='destructive']) {
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem']:is([data-highlighted], :hover) {
  background: var(--claude-palette-selected, var(--claude-k-313130)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem'] {
  white-space: nowrap;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem'] > :is(svg, .codicon):first-child {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role='menuitem'][data-variant='destructive'] {
  color: var(--claude-k-ec7e7e) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [data-claude-title-menu-hidden] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-claude-has~="slot-message"]) [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true']) > .pane-tab-content > :is(span, button) > span.truncate {
  font-weight: 400 !important;
  color: var(--claude-color-text-tertiary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] > [role='tablist'] {
  padding-left: 12px;
}
/* Claude's header is a slim, seamless band: 36px, chat colour, no rule. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group='grp-main'] > div:has(> [data-zone-tabstrip='grp-main']),
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] {
  height: 36px !important;
  min-height: 36px !important;
  background: var(--claude-color-chat) !important;
  border-bottom: 0 !important;
  box-shadow: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab'] > .pane-tab-content > span.ml-2:first-child:not(:has([role='status'], [class*='animate-'])),
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] button[aria-label='New session tab'] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-sessions'] [role='tab'] > .pane-tab-content > :is(span, button) > span.truncate {
  font-size: 13px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-sessions'] [role='tab'] {
  height: 24px !important;
  min-height: 24px !important;
}

/* Claude never dims the composer when the thread is scrolled up (Hermes drops
   it to 30 % until hover). The dock is solid chat colour and the thread fades
   out in a short gradient above it instead. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-dock']:not([data-popped-out]) [data-slot='composer-fade'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-dock']:not([data-popped-out]) [data-slot='composer-surface'] {
  opacity: 1 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-dock']:not([data-popped-out]) {
  background: var(--claude-color-chat);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-dock']:not([data-popped-out])::before {
  content: '';
  position: absolute;
  inset: -32px 0 100% 0;
  background: linear-gradient(to bottom, transparent, var(--claude-color-chat));
  pointer-events: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host] [data-slot='composer-dock']:not([data-popped-out]) {
  background: transparent;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host] [data-slot='composer-dock']:not([data-popped-out])::before {
  content: none;
}
/* Menus and popovers float above Hermes' desktop pet (z 60). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-radix-popper-content-wrapper] {
  z-index: 70 !important;
}

/* Claude's context ring after the model pill: a 14px track with the used
   share drawn from the top, blue, amber past 80 %. */
[data-claude-context-ring] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  margin-left: 2px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring]:hover {
  background: var(--claude-k-202020);
}
/* Claude has no statusbar. With Hermes' bar switched on (the Smart control and
   the context panel live there), the skin folds the bar itself away; only the
   controls it docks into the composer stay visible. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] {
  height: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  overflow: visible !important;
  visibility: hidden;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked] {
  visibility: visible;
}
/* Hermes' backend health, an icon beside the account row. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock] {
  visibility: visible;
  position: fixed !important;
  z-index: 5;
  top: var(--claude-dock-top) !important;
  left: var(--claude-dock-left) !important;
  width: 22px !important;
  height: 22px !important;
  padding: 0 !important;
  justify-content: center !important;
  border-radius: 6px !important;
  transform: translateY(-50%);
  background: transparent;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock] > :not(:first-child) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock]:not([class*='amber'], [class*='destructive']):has(> svg[class*='tabler-icon-activity']) {
  color: var(--claude-color-success, var(--ui-text-secondary)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock]:is(:hover, [data-state='open']) {
  background: var(--claude-account-hover) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock] > :first-child {
  width: 14px !important;
  height: 14px !important;
}
/* The backend's state, when not ready, joins Hermes' Connected / Inference
   lines in its menu (installClaudeBackendDock), dot and text in its colour. */
html[data-claude-chat-look='true'] [data-claude-backend-state] {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
html[data-claude-chat-look='true'] [data-claude-backend-state] > span {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: currentColor;
}
/* An update waiting (Hermes' client or backend): Claude's update row at the
   foot of the sidebar, above the account row; the session list ends above it. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-update-shown] [data-slot='sidebar-content'] {
  margin-bottom: 40px;
}
[data-claude-update-dock] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock]:not([hidden]) {
  position: fixed;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  transform: translateY(-50%);
  background: transparent;
  color: var(--ui-accent, var(--dt-ring));
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock]:hover {
  background: var(--claude-account-hover);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock] > svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock][data-busy] > svg {
  animation: claude-update-dock-busy 900ms ease-in-out infinite;
}
@keyframes claude-update-dock-busy {
  50% { transform: translateY(2px); opacity: .55; }
}
[data-claude-context-pop] {
  display: none;
}
/* Speed and cache rows: in the ring's card, and under Hermes' context panel. */
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-context-pop], [data-claude-usage-extra]) [data-claude-usage-row] {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--claude-color-text-secondary, var(--ui-text-secondary));
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-context-pop], [data-claude-usage-extra]) [data-claude-usage-row] > span:last-child {
  color: var(--claude-color-text, var(--ui-text-primary));
  font-variant-numeric: tabular-nums;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-usage-extra] {
  display: grid;
  gap: 2px;
  margin: 2px 14px 10px;
  padding-top: 8px;
  border-top: 1px solid var(--claude-color-border-subtle, var(--ui-stroke-quaternary));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop] {
  position: fixed;
  z-index: 70;
  display: grid;
  gap: 4px;
  min-width: 200px;
  padding: 10px 12px;
  border: 1px solid var(--claude-card-border, var(--claude-k-2b2b2b));
  border-radius: 10px;
  background: var(--claude-k-202020);
  color: var(--claude-sidebar-text, var(--claude-k-c3c2b7));
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop-title] {
  font-size: 12px;
  font-weight: 500;
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-source] {
  position: fixed !important;
  z-index: 0;
  width: 24px !important;
  height: 24px !important;
  padding: 0 !important;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] svg {
  width: 14px;
  height: 14px;
  transform: rotate(-90deg);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] circle {
  fill: none;
  stroke-width: 2;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] [data-part='track'] {
  stroke: var(--claude-k-464646);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] [data-part='fill'] {
  stroke: #4A90E2;
  stroke-linecap: round;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring][data-high] [data-part='fill'] {
  stroke: #E0AF68;
}

/* Claude's model pill: "Opus 5.5 Medium" as one control, no chevrons; a
   #202020 box with a faint edge on hover or while its menu is open. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-tour='model-pill'] > svg,
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-effort] > svg {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-effort] > span {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-effort]::after {
  content: attr(data-claude-effort);
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-tour='model-pill'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-model-paired] {
  height: 24px !important;
  border: 1px solid transparent !important;
  background: transparent !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-tour='model-pill']:has(+ [data-claude-model-paired]) {
  padding: 0 3px 0 8px !important;
  border-right: 0 !important;
  border-radius: 6px 0 0 6px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-model-paired] {
  margin-left: calc(-1 * var(--composer-control-gap, 4px)) !important;
  padding: 0 8px 0 3px !important;
  border-left: 0 !important;
  border-radius: 0 6px 6px 0 !important;
}
/* Lit by its own buttons only, not the context ring beside them. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] div[data-claude-has~="child-button-tour-model-pill-claude-model-paired"]:has(> button[data-tour='model-pill']:hover) > :is(button[data-tour='model-pill'], [data-claude-model-paired]),
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] div[data-claude-has~="child-button-tour-model-pill-claude-model-paired"]:has(> [data-claude-model-paired]:hover) > :is(button[data-tour='model-pill'], [data-claude-model-paired]),
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] div[data-claude-has~="child-model-pair-expanded"] > :is(button[data-tour='model-pill'], [data-claude-model-paired]) {
  border-color: var(--claude-k-3a3a39) !important;
  background: var(--claude-k-202020) !important;
}

/* The model and effort menus, drawn like Claude's: #202020, 14px rows, a blue
   check on the current choice, digits for the favourites, no search, stars or
   per-model badges. */
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu], html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) {
  min-width: 180px !important;
  width: auto !important;
  padding: 4px !important;
  border: 1px solid var(--claude-card-border, var(--claude-k-2b2b2b)) !important;
  border-radius: 10px !important;
  background: var(--claude-k-202020) !important;
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [data-slot='dropdown-menu-search'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [data-slot='dropdown-menu-search'] + [role='separator'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group'] > [data-slot='dropdown-menu-label'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='menuitem'] > button[data-slot='tooltip-trigger'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='menuitem'] > [data-slot='badge'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-slot='dropdown-menu-sub-trigger'] > .codicon-chevron-right {
  display: none !important;
}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu], html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) [role^='menuitem'] {
  min-height: 28px;
  padding: 4px 8px !important;
  border-radius: 6px !important;
  font-size: 14px !important;
  color: var(--claude-color-text) !important;
}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu], html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) [role^='menuitem']:is([data-highlighted], :hover, :focus) {
  background: var(--claude-palette-selected, var(--claude-k-313130)) !important;
}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu], html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) .codicon-check {
  margin-left: auto;
  color: #2972CA !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-model-key]:not(:has(.codicon-check))::after {
  content: attr(data-claude-model-key);
  margin-left: auto;
  padding-left: 16px;
  font-size: 12px;
  color: var(--claude-color-text-tertiary);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group'] > [data-slot='dropdown-menu-item'] {
  min-height: 24px;
  padding-top: 6px !important;
  font-size: 12px !important;
  color: var(--claude-color-text-tertiary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group'] > [data-slot='dropdown-menu-item'] > span {
  text-transform: none !important;
  letter-spacing: normal !important;
  font-size: 12px !important;
  font-weight: 500 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [role='menuitem'] > .codicon:first-child {
  display: none !important;
}
/* Only favourites stay in the menu; providers' models and the footer move
   to More models. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] {
  position: relative;
  overflow: visible !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group']:not(:has(> [data-slot='dropdown-menu-label'])),
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [role='menuitem']:not([data-claude-effort-row], [data-claude-more-row]),
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [role='separator']:not([data-claude-effort-rule], [data-claude-more-rule-top]) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-row] {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
  outline: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-row] > .codicon {
  margin-left: auto;
  font-size: 14px;
  color: var(--claude-color-text-tertiary);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu][data-claude-more-open] [data-claude-more-row] {
  background: var(--claude-palette-selected, var(--claude-k-313130)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] {
  display: none;
  position: absolute;
  left: calc(100% + 4px);
  min-width: 180px;
  overflow: hidden;
  padding: 4px;
  border: 1px solid var(--claude-card-border, var(--claude-k-2b2b2b));
  border-radius: 10px;
  background: var(--claude-k-202020);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu][data-claude-more-open] [data-claude-more-panel] {
  display: flex;
  flex-direction: column;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-list] {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
/* Rows fade out just above the rule while more wait below, as the thread does
   above the composer. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-list][data-more-below] {
  mask-image: linear-gradient(to bottom, #000 calc(100% - 20px), transparent);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-foot] {
  flex: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-star] {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 18px;
  height: 18px;
  margin: 0 2px 0 -4px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--claude-color-text-tertiary);
  cursor: pointer;
  opacity: .55;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-star] .codicon {
  font-size: 12px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-item]:hover [data-claude-star],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-star]:focus-visible {
  opacity: 1;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-star][aria-pressed='true'] {
  color: #E0AF68;
  opacity: 1;
}
/* In the menu itself a favourite's own star appears on hover, to unstar it. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group'] > [data-slot='dropdown-menu-sub-trigger']:hover > button[data-slot='tooltip-trigger'] {
  display: inline-grid !important;
  order: 9;
  margin-left: 6px;
  color: #E0AF68;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-item] {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  cursor: default;
  outline: none;
}
/* Each provider is its own block: a rule above it, a clickable heading with
   a chevron (› collapsed, ⌄ open), its models below. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label] {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--claude-color-text-tertiary);
  cursor: pointer;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]:hover {
  background: var(--claude-palette-selected, var(--claude-k-313130));
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label] > .codicon {
  margin-left: auto;
  font-size: 12px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]:not(:first-child) {
  position: relative;
  margin-top: 9px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]:not(:first-child)::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--claude-k-333332);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]:not([data-collapsed]) {
  color: var(--claude-color-text-secondary);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-rule] {
  height: 1px;
  margin: 4px 0;
  background: var(--claude-k-333332) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu][data-claude-effort-open] [data-slot='dropdown-menu-sub-trigger'][aria-expanded='true'] {
  background: transparent !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu][data-claude-effort-open] [data-claude-effort-row] {
  background: var(--claude-palette-selected, var(--claude-k-313130)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-effort-row] {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
  outline: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-effort-row] > [data-claude-effort-value] {
  margin-left: auto;
  color: var(--claude-color-text-tertiary);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-effort-row] > .codicon {
  font-size: 14px;
  color: var(--claude-color-text-tertiary);
}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu], html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) [data-slot='dropdown-menu-label'] {
  font-size: 12px !important;
  font-weight: 500 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
  color: var(--claude-color-text-tertiary) !important;
}

/* Composer controls are plain icons; no filled voice circle. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-surface'] button[aria-label='Start voice conversation'] {
  background: transparent !important;
  color: var(--claude-color-text-secondary) !important;
  box-shadow: none !important;
}
/* Claude's Files card with files open, measured 1:1 at 125 %: a 32px header
   holding a 24px tab per open file (the active one on #3C3D46, the preview
   tab, replaced by the next single-clicked file, in italics), each with its
   type icon and an always-shown ×; the tabs share the width. */
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] > [data-tree-group] > [data-panel-header],
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [data-zone-tabstrip] {
  height: 32px !important;
  min-height: 32px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [data-zone-tabstrip] {
  padding: 4px 0 4px 4px !important;
  gap: 4px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [data-zone-tabstrip] > [role='tablist'] {
  gap: 4px !important;
  min-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) {
  --tab-bg: transparent;
  --tab-face: transparent;
  flex: 1 1 0% !important;
  min-width: 48px !important;
  max-width: max-content !important;
  height: 24px !important;
  min-height: 24px !important;
  padding: 0 4px 0 0 !important;
  border: 0 !important;
  border-radius: 6px !important;
  background: transparent !important;
  color: var(--claude-color-text-secondary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab)[aria-selected='true'] {
  --tab-bg: var(--claude-file-tab);
  --tab-face: var(--claude-file-tab);
  background: var(--claude-file-tab) !important;
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab):not([aria-selected='true']):hover {
  background: color-mix(in srgb, var(--claude-file-tab) 55%, transparent) !important;
  box-shadow: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > .pane-tab-content {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  padding-inline-end: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > .pane-tab-content > span:first-child {
  margin: 0 0 0 8px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > .pane-tab-content > span:last-child {
  padding: 0 4px 0 7px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) span.truncate {
  font-size: 13px !important;
  font-weight: 400 !important;
  letter-spacing: normal !important;
  text-overflow: clip !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:'][data-claude-preview-tab] span.truncate {
  font-style: italic;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > span:last-child:has(> button[aria-label='Close']) {
  position: static !important;
  inset: auto !important;
  flex: none !important;
  align-items: center !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > span:last-child > button[aria-label='Close'] {
  width: 16px !important;
  height: 16px !important;
  border-radius: 4px !important;
  background: transparent !important;
  color: var(--claude-color-text-tertiary, currentColor) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > span:last-child > button[aria-label='Close']:hover {
  background: color-mix(in srgb, var(--claude-color-text, currentColor) 12%, transparent) !important;
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > span:last-child > button[aria-label='Close'] .codicon {
  font-size: 12px !important;
}
/* File type icons as Claude draws them, in the tree, the filter results and
   the file tabs: a solid page (green with lines for Markdown, grey
   otherwise), orange braces for JSON and the git mark for git files. Folders
   carry only a chevron. */
html[data-claude-chat-look='true'][data-hermes-theme] :where([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]), [data-claude-tree-results] [title], [data-claude-tab-list] > [title], [data-claude-changes] [title], [data-claude-changes-search] [title], [role='tab'][data-tree-tab^='preview-tile:file:']) {
  --claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%2355555E' d='M4.5 1.5h4.8l3.7 3.7v8.3a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-10.5A1.5 1.5 0 0 1 4.5 1.5z'/%3E%3Cpath fill='%238A8A93' d='M9.3 1.5v2.9c0 .4.3.8.8.8H13z'/%3E%3C/svg%3E");
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]), [data-claude-tree-results] [title], [data-claude-tab-list] > [title], [data-claude-changes] [title], [data-claude-changes-search] [title]):is([title$='.md' i], [title$='.mdx' i], [title$='.markdown' i]),
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:']:is([data-tree-tab$='.md' i], [data-tree-tab$='.mdx' i], [data-tree-tab$='.markdown' i]) {
  --claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23366244' d='M4.5 1.5h4.8l3.7 3.7v8.3a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-10.5A1.5 1.5 0 0 1 4.5 1.5z'/%3E%3Cpath fill='%2357C46F' d='M9.3 1.5v2.9c0 .4.3.8.8.8H13z'/%3E%3Cpath stroke='%234FA865' stroke-width='1.2' stroke-linecap='round' d='M5.6 9.4h4.6M5.6 11.6h3'/%3E%3C/svg%3E");
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]), [data-claude-tree-results] [title], [data-claude-tab-list] > [title], [data-claude-changes] [title], [data-claude-changes-search] [title]):is([title$='.json' i], [title$='.jsonc' i], [title$='.json5' i]),
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:']:is([data-tree-tab$='.json' i], [data-tree-tab$='.jsonc' i], [data-tree-tab$='.json5' i]) {
  --claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23E29253' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5.6 2.5c-1.1 0-1.6.5-1.6 1.6v1.8c0 .9-.5 1.7-1.4 2.1.9.4 1.4 1.2 1.4 2.1v1.8c0 1.1.5 1.6 1.6 1.6M10.4 2.5c1.1 0 1.6.5 1.6 1.6v1.8c0 .9.5 1.7 1.4 2.1-.9.4-1.4 1.2-1.4 2.1v1.8c0 1.1-.5 1.6-1.6 1.6'/%3E%3C/svg%3E");
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]), [data-claude-tree-results] [title], [data-claude-tab-list] > [title], [data-claude-changes] [title], [data-claude-changes-search] [title]):is([title$='.gitignore'], [title$='.gitattributes'], [title$='.gitmodules'], [title$='.gitkeep']),
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:']:is([data-tree-tab$='.gitignore'], [data-tree-tab$='.gitattributes'], [data-tree-tab$='.gitmodules'], [data-tree-tab$='.gitkeep']) {
  --claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23D5512F' d='M7.1 1.4a1.3 1.3 0 0 1 1.8 0l5.7 5.7a1.3 1.3 0 0 1 0 1.8l-5.7 5.7a1.3 1.3 0 0 1-1.8 0L1.4 8.9a1.3 1.3 0 0 1 0-1.8z'/%3E%3Cpath fill='none' stroke='%231A1B26' stroke-width='1.1' stroke-linecap='round' d='M5.6 3.9 8.1 6.4v4.4M8.1 6.4l2.3 2.3'/%3E%3Ccircle cx='8.1' cy='6.4' r='.9' fill='%231A1B26'/%3E%3Ccircle cx='8.1' cy='10.8' r='.9' fill='%231A1B26'/%3E%3Ccircle cx='10.4' cy='8.7' r='.9' fill='%231A1B26'/%3E%3C/svg%3E");
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]) > span:first-child .codicon::before,
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:'] .tab-key-hint-icon .codicon::before,
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result-icon]::before {
  content: '' !important;
  display: block;
  width: 12px;
  height: 12px;
  background: var(--claude-file-icon) center / contain no-repeat;
}
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:'] .tab-key-hint-icon .codicon {
  opacity: 1 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-expanded] > span:first-child {
  color: var(--claude-color-text-tertiary, currentColor) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-expanded] > span:first-child .codicon::before {
  content: '\\eab6' !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-expanded='true'] > span:first-child .codicon::before {
  content: '\\eab4' !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-selected='true'] {
  background: var(--claude-file-row-selected) !important;
}
/* The file's path row: 30px, the name in 14px at 8px, one toggle on the
   right. Editing runs through Hermes' own editor: </> opens it (Hermes'
   Edit), the eye leaves it, saving first when something changed; Save shows
   while there are unsaved changes. A file without a rendered view keeps a
   pencil for Edit. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] {
  height: 30px !important;
  padding: 0 6px 0 8px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > div:has(> button) {
  gap: 4px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name][data-claude-has~="child-claude-mode"] [data-claude-edit='open'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] [data-claude-edit='cancel'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] [data-claude-edit='save']:disabled {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] :is([data-claude-edit='open'], [data-claude-edit-done]) {
  display: grid !important;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0 !important;
  border-radius: 6px;
  font-size: 0 !important;
  color: var(--claude-color-text-secondary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] :is([data-claude-edit='open'], [data-claude-edit-done]):hover {
  background: var(--claude-menu-hover, var(--ui-row-hover-background));
  color: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] :is([data-claude-edit='open'], [data-claude-edit-done]) svg {
  width: 15px !important;
  height: 15px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] [data-claude-edit='save'] {
  height: 22px;
  padding: 0 9px !important;
  border-radius: 6px !important;
  background: var(--claude-file-tab) !important;
  color: var(--claude-color-text) !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  box-shadow: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] [data-claude-edit='save'] svg {
  display: none;
}
/* Rendered Markdown at Claude's sizes: 15/24 body text, 24px and 20px
   headings, quiet inline code. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown {
  padding: 20px 22px 32px !important;
  font-size: 15px !important;
  line-height: 24px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown :is(p, li) {
  font-size: 15px !important;
  line-height: 24px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown h1 {
  margin: 0 0 12px !important;
  font-size: 24px !important;
  line-height: 30px !important;
  font-weight: 700 !important;
  letter-spacing: normal !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown h2 {
  margin: 28px 0 8px !important;
  font-size: 20px !important;
  line-height: 28px !important;
  font-weight: 600 !important;
  letter-spacing: normal !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown h3 {
  margin: 24px 0 6px !important;
  font-size: 17px !important;
  line-height: 24px !important;
  font-weight: 600 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown :not(pre) > code {
  padding: 1px 6px !important;
  border: 1px solid var(--claude-filter-border) !important;
  border-radius: 5px !important;
  background: var(--claude-filter-background) !important;
  color: var(--claude-color-text) !important;
  font-size: 13px !important;
}
/* Claude's filter field above the tree (Hermes has no tree filter; the
   plugin lists the project through Hermes' file API) and its results in
   place of the tree while a query is typed. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter] {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
  box-sizing: border-box;
  height: 24px;
  margin: 4px 8px 8px;
  padding: 0 8px;
  border: 1px solid var(--claude-filter-border);
  border-radius: 6px;
  background: var(--claude-filter-background);
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter]:focus-within {
  border-color: color-mix(in srgb, var(--claude-color-text, currentColor) 28%, transparent);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter] > svg {
  flex: none;
  width: 14px;
  height: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter] > input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--claude-color-text);
  font: inherit;
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter] > input::placeholder {
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='empty'] [data-claude-tree-filter],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-filtering] [data-tree-group='grp-files'] [data-project-tree] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-filtering]:not([data-claude-files-view='empty']) [data-claude-tree-results] {
  display: block;
  flex: 1 1 0%;
  min-height: 0;
  overflow: auto;
  padding-bottom: 8px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result] {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 22px;
  padding: 0 12px;
  font-size: 14px;
  white-space: nowrap;
  color: var(--claude-color-text);
  cursor: default;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result]:hover {
  background: var(--ui-row-hover-background, var(--claude-menu-hover));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result][aria-selected='true'] {
  background: var(--claude-file-row-selected);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result-icon] {
  flex: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result-name] {
  flex: none;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result-dir] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-results-note] {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--claude-color-text-tertiary, currentColor);
}
/* The Files card's ⋮ menu, as Claude draws it at 125 %: 220px wide, 24px
   rows, blue checks, values and shortcuts in the quiet text colour; the
   submenus open to its left. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] {
  position: fixed;
  z-index: 2147483000;
  box-sizing: border-box;
  min-width: 220px;
  padding: 4px;
  border: 1px solid var(--claude-menu-border);
  border-radius: 10px;
  background: var(--claude-menu-background);
  box-shadow: 0 8px 24px var(--claude-menu-shadow, rgb(0 0 0 / 25%));
  color: var(--claude-color-text);
  font-size: 14px;
  line-height: 20px;
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu='sub'] {
  min-width: 126px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] > [data-claude-menu-row] {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 24px;
  padding: 0 7px;
  border-radius: 6px;
  white-space: nowrap;
  cursor: default;
  outline: none;
}
html[data-claude-chat-look='true'] [data-claude-files-menu] > [data-claude-menu-row][aria-disabled='true'] {
  opacity: .45;
  cursor: default;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] > [data-claude-menu-row]:is(:hover, [data-claude-menu-open]) {
  background: var(--claude-menu-hover);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] [data-claude-menu-tail] {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] [data-claude-menu-tail] > svg {
  width: 14px;
  height: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] [data-claude-menu-check] {
  color: var(--claude-menu-check);
  stroke-width: 1.6;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] > [role='separator'] {
  height: 1px;
  margin: 4px 7px;
  background: var(--claude-menu-border);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action='more'][aria-expanded='true'] {
  background: var(--claude-menu-hover, var(--ui-row-hover-background)) !important;
  color: var(--claude-color-text) !important;
}
/* File tree position: Left. The tree comes before the file in the joined
   card, the card's edges mirror, and the wide card with no file open puts
   the tree in its first column. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-tree-split] > [data-claude-side-column] {
  order: 1;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-tree-split] > [data-claude-sash='tree'] {
  order: 2;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-tree-split] > [data-claude-preview-column] {
  order: 3;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-joined) {
  margin-left: 0 !important;
  margin-right: var(--claude-card-gap, 4px) !important;
  border-left-width: 0 !important;
  border-right-width: 1px !important;
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  border-top-right-radius: var(--claude-card-radius, 10px) !important;
  border-bottom-right-radius: var(--claude-card-radius, 10px) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-pane-host^='preview-tile:'] {
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: calc(var(--claude-card-radius, 10px) - 1px) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined) {
  margin-left: var(--claude-card-gap, 4px) !important;
  margin-right: 0 !important;
  border-left-color: var(--claude-card-border) !important;
  border-right: 1px solid var(--claude-file-divider, var(--claude-card-border)) !important;
  border-top-left-radius: var(--claude-card-radius, 10px) !important;
  border-bottom-left-radius: var(--claude-card-radius, 10px) !important;
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='split'] [data-tree-group='grp-files'] div:has(> [data-project-tree]) {
  grid-template-columns: var(--claude-files-tree-wide, 240px) minmax(0, 1fr);
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='split'] [data-tree-group='grp-files'] :is([data-claude-tree-filter], [data-project-tree], [data-claude-tree-results]) {
  grid-column: 1;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='split'] [data-claude-files-empty] {
  grid-column: 2;
  border-right: 0;
  border-left: 1px solid var(--claude-file-divider, var(--claude-card-border));
}
/* Editor settings drawn by the plugin's decorations: indent guides at each
   tab stop of a line's indent, dots for spaces and arrows for tabs. */
html[data-claude-chat-look='true'][data-hermes-theme] .cm-line.cm-claude-indent {
  background-image: repeating-linear-gradient(to right, color-mix(in srgb, var(--claude-color-text, currentColor) 16%, transparent) 0 1px, transparent 1px calc(var(--claude-tab-size, 4) * var(--claude-space-width, 0.3em)));
  background-size: calc(var(--claude-indent-levels, 0) * var(--claude-tab-size, 4) * var(--claude-space-width, 0.3em)) 100%;
  background-repeat: no-repeat;
  background-origin: content-box;
}
html[data-claude-chat-look='true'][data-hermes-theme] .cm-claude-space {
  background: radial-gradient(circle, color-mix(in srgb, var(--claude-color-text, currentColor) 35%, transparent) 0 1px, transparent 1.4px) 0 55% / var(--claude-space-width, 0.3em) 100% repeat-x;
}
html[data-claude-chat-look='true'][data-hermes-theme] .cm-claude-tab {
  position: relative;
}
html[data-claude-chat-look='true'][data-hermes-theme] .cm-claude-tab::before {
  content: '\\2192';
  position: absolute;
  left: 0;
  color: color-mix(in srgb, var(--claude-color-text, currentColor) 35%, transparent);
  font-size: 0.85em;
  pointer-events: none;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-scroll-past-end] [data-claude-preview-column] .cm-content {
  padding-bottom: max(0px, calc(var(--claude-editor-height, 50vh) - 2em)) !important;
}
/* Auto save keeps the Save button out of the path row. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-autosave] [data-claude-file-name] [data-claude-edit='save'] {
  display: none !important;
}
/* Gitignored files always show (installClaudeFileBrowser); no toggle. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header] > button:has(.codicon-eye-closed, .codicon-eye) {
  display: none !important;
}
/* Too many file tabs: the hidden ones behind a ⌄ after the tabs, listed in
   a menu below it. */
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined], [data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) {
  min-width: min(96px, 100%) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] [role='tab'][data-claude-tab-overflow]:not(#claude-file-tab) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-more] {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 24px;
  margin-left: 4px;
  border-radius: 6px;
  background: var(--claude-file-tab);
  color: var(--claude-color-text);
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-more] > svg {
  width: 15px;
  height: 15px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] {
  position: fixed;
  z-index: 2147483000;
  box-sizing: border-box;
  min-width: 220px;
  padding: 4px;
  border: 1px solid var(--claude-menu-border);
  border-radius: 10px;
  background: var(--claude-menu-background);
  box-shadow: 0 8px 24px var(--claude-menu-shadow, rgb(0 0 0 / 25%));
  color: var(--claude-color-text);
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 6px 0 10px;
  border-radius: 6px;
  white-space: nowrap;
  cursor: default;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title]:hover {
  background: var(--claude-menu-hover);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] > span:nth-child(2) {
  flex: 1 1 auto;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] > button {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] > button:hover {
  background: color-mix(in srgb, var(--claude-color-text, currentColor) 12%, transparent);
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] > button > svg {
  width: 12px;
  height: 12px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] [data-claude-result-icon]::before {
  content: '';
  display: block;
  width: 12px;
  height: 12px;
  background: var(--claude-file-icon) center / contain no-repeat;
}
/* Claude's divider between the file and the tree starts under the header. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined):not(#claude-divider) {
  border-left-width: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host])::after {
  content: '';
  position: absolute;
  top: 32px;
  bottom: 0;
  left: 0;
  width: 1px;
  background: var(--claude-file-divider, var(--claude-card-border));
  pointer-events: none;
  z-index: 3;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined):not(#claude-divider) {
  border-right-width: 0 !important;
  border-left-width: 1px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host])::after {
  left: auto;
  right: 0;
}
/* File tree on the left, as Claude lays it out: the tree toggle opens the
   header on the left, then the title (or the file's tabs, which run on over
   the tree from there); search, ⋮, expand and close stay on the right. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left] [data-claude-files-header] > [data-claude-terminal-header='files-actions'] {
  display: contents;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left] [data-claude-files-header] [data-claude-terminal-action='tree'] {
  order: -1;
  margin-right: 4px;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left] [data-claude-files-header='true'] {
  padding-left: 6px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-files-header] > :not([data-claude-terminal-header='files-actions']),
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-files-header] [data-claude-terminal-action]:not([data-claude-terminal-action='tree']) {
  visibility: hidden !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-joined):not(#claude-tree-span) {
  overflow: visible !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-preview-column] [data-zone-tabstrip] {
  position: relative !important;
  z-index: 4;
  margin-left: calc(36px - var(--claude-tree-span, 36px)) !important;
  border-top-left-radius: 0 !important;
  background: transparent !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-preview-column] [data-panel-header] {
  background: transparent !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-file-actions] {
  display: flex !important;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  padding-right: 8px;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-file-actions] [data-claude-terminal-action='tree'] {
  display: none !important;
}
/* File tree on the left and toggled off: its toggle keeps its place at the
   header's start, before the file's tabs. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='file'] [data-claude-file-actions] {
  display: contents !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='file'] [data-claude-file-actions] > [data-claude-terminal-action='tree'] {
  order: -1;
  margin: 0 0 0 2px;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='file'] [data-claude-file-actions] > [data-claude-terminal-action='search'] {
  margin-left: auto;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='file'] [data-claude-file-actions] > :last-child {
  margin-right: 8px;
}
/* Claude's Changes card (installClaudeChanges), measured at 125 %: a 32px
   header with the compare menu on the left and search, file list, ⋮,
   expand and close on the right; the stacked diffs on #262731, the file
   list on the card colour behind a divider, 24px rows. Hermes' Review stays
   mounted under it. */
html[data-claude-chat-look='true'] {
  --claude-diff-background: var(--ui-editor-surface-background, Canvas);
  --claude-diff-added: #1A7F37;
  --claude-diff-removed: #CF222E;
  --claude-diff-added-line: rgb(26 127 55 / 10%);
  --claude-diff-removed-line: rgb(207 34 46 / 10%);
  --claude-diff-added-word: rgb(26 127 55 / 28%);
  --claude-diff-removed-word: rgb(207 34 46 / 28%);
}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] {
  --claude-diff-background: #262731;
  --claude-diff-added: #32CF49;
  --claude-diff-removed: #E52C52;
  --claude-diff-added-line: rgb(50 207 73 / 11%);
  --claude-diff-removed-line: rgb(229 44 82 / 12%);
  --claude-diff-added-word: rgb(50 207 73 / 30%);
  --claude-diff-removed-word: rgb(229 44 82 / 32%);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-host] > :not([data-claude-changes]) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-host] {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  min-height: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  background: var(--claude-card-background);
  color: var(--claude-color-text);
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-header] {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 8px 0 6px;
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope] {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 24px;
  padding: 0 6px 0 8px;
  border-radius: 6px;
  color: var(--claude-color-text-secondary);
  font-size: 14px;
  white-space: nowrap;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope] > span {
  overflow: hidden;
  text-overflow: ellipsis;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope]:is(:hover, [aria-expanded='true']) {
  background: var(--claude-menu-hover, var(--ui-row-hover-background));
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-arrow] {
  flex: none;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope] > svg {
  flex: none;
  width: 13px;
  height: 13px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-tools] {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] button[data-claude-changes-action] {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--claude-color-text-secondary);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] button[data-claude-changes-action]:is(:hover, [aria-expanded='true']) {
  background: var(--claude-menu-hover, var(--ui-row-hover-background));
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] button[data-claude-changes-action][aria-pressed='true'] {
  background: var(--claude-pane-active, var(--claude-menu-hover));
  color: var(--claude-pane-active-glyph, var(--claude-color-text));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] button[data-claude-changes-action] > svg {
  width: 15px;
  height: 15px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]:not([data-claude-changes-has-files]) [data-claude-changes-action='search'] {
  display: none;
}
/* Body: diffs | list (or list | diffs), the empty note across. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-body] {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-diffs] {
  flex: 1 1 auto;
  min-width: 0;
  overflow: auto;
  background: var(--claude-diff-background);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-list] {
  flex: 0 0 min(290px, 42%);
  min-width: 0;
  overflow: auto;
  padding: 4px 0 8px;
  border-left: 1px solid var(--claude-file-divider, var(--claude-card-border));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes][data-claude-changes-position='left'] [data-claude-changes-list] {
  order: -1;
  border-left: 0;
  border-right: 1px solid var(--claude-file-divider, var(--claude-card-border));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes][data-claude-changes-files='hidden'] [data-claude-changes-list] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-empty] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]:not([data-claude-changes-has-files]) [data-claude-changes-diffs] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]:not([data-claude-changes-has-files]) [data-claude-changes-empty] {
  display: grid;
  flex: 1 1 auto;
  place-items: center;
  font-size: 14px;
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]:not([data-claude-changes-has-files]) [data-claude-changes-list] {
  order: 2;
}
/* A file in the stacked diffs: a 32px row, then its diff. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-head] {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 12px 0 10px;
  background: var(--claude-diff-background);
  white-space: nowrap;
  cursor: default;
  outline: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-chevron] {
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-chevron] > svg {
  width: 13px;
  height: 13px;
  transition: transform 120ms;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-file][aria-expanded='true'] [data-claude-diff-chevron] > svg {
  transform: rotate(90deg);
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-head], [data-claude-changes-row]) [data-claude-diff-name] {
  flex: none;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: var(--claude-color-text);
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-head], [data-claude-changes-row]) [data-claude-diff-dir] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-counts] {
  display: flex;
  flex: none;
  gap: 5px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-added] {
  color: var(--claude-diff-added);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-removed] {
  color: var(--claude-diff-removed);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-actions] {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-actions] > button[data-claude-changes-action] {
  width: 22px !important;
  height: 22px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-actions] > [data-claude-changes-action='open'] {
  visibility: hidden;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-head]:hover [data-claude-changes-action='open'] {
  visibility: visible;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-file][aria-expanded='false'] > [data-claude-diff-body] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-body] {
  padding: 0 0 8px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-note] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 10px 41px;
  font-size: 13px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-link] {
  color: var(--claude-color-text-secondary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-group] {
  padding: 12px 12px 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-part-label] {
  padding: 6px 12px 4px 41px;
  font-size: 12px;
  color: var(--claude-color-text-tertiary, currentColor);
}
/* The diff itself: monospace rows with old/new line numbers. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-table] {
  margin: 0 8px;
  overflow-x: auto;
  border: 1px solid var(--claude-file-divider, var(--claude-card-border));
  border-radius: 6px;
  background: var(--claude-card-background);
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-table='unified'] > [data-claude-diff-row]:not([data-claude-diff-row='hunk']) {
  display: grid;
  grid-template-columns: 40px 40px 16px minmax(0, 1fr);
  min-width: max-content;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-hermes-mode] [data-claude-changes][data-claude-changes-wrap='on'] [data-claude-diff-table] > [data-claude-diff-row] {
  min-width: 0;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-table='split'] > [data-claude-diff-row]:not([data-claude-diff-row='hunk']) {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px minmax(0, 1fr);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-num] {
  padding-right: 8px;
  text-align: right;
  color: var(--claude-color-text-tertiary, currentColor);
  user-select: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-sign] {
  color: var(--claude-color-text-tertiary, currentColor);
  user-select: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-code] {
  padding-right: 12px;
  white-space: pre;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes][data-claude-changes-wrap='on'] [data-claude-diff-code] {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-row='add'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-side='add'] {
  background: var(--claude-diff-added-line);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-row='del'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-side='del'] {
  background: var(--claude-diff-removed-line);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-row='add'] [data-claude-diff-sign] {
  color: var(--claude-diff-added);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-row='del'] [data-claude-diff-sign] {
  color: var(--claude-diff-removed);
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-row='add'], [data-claude-diff-side='add']) mark {
  border-radius: 2px;
  background: var(--claude-diff-added-word);
  color: inherit;
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-row='del'], [data-claude-diff-side='del']) mark {
  border-radius: 2px;
  background: var(--claude-diff-removed-word);
  color: inherit;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-side='none'] {
  background: color-mix(in srgb, var(--claude-color-text, currentColor) 3%, transparent);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-row='hunk'] {
  padding: 4px 12px;
  background: color-mix(in srgb, var(--claude-color-text, currentColor) 4%, transparent);
  color: var(--claude-color-text-tertiary, currentColor);
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The file list. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-row] {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 24px;
  margin: 0 6px;
  padding: 0 8px;
  border-radius: 6px;
  white-space: nowrap;
  cursor: default;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-row][data-indent] {
  padding-left: 20px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-row] > [data-claude-diff-counts] {
  margin-left: auto;
  padding-left: 8px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-row]:hover {
  background: var(--ui-row-hover-background, var(--claude-menu-hover));
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-row][aria-selected='true'] {
  background: var(--claude-file-row-selected);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-folder] {
  padding: 8px 14px 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] [data-claude-result-icon],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search] [data-claude-result-icon] {
  flex: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes], [data-claude-changes-search]) [data-claude-result-icon]::before {
  content: '';
  display: block;
  width: 12px;
  height: 12px;
  background: var(--claude-file-icon) center / contain no-repeat;
}
/* The changed-files search (Go to file). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search] {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  max-height: 440px;
  border: 1px solid var(--claude-menu-border);
  border-radius: 10px;
  background: var(--claude-menu-background);
  box-shadow: 0 8px 24px var(--claude-menu-shadow, rgb(0 0 0 / 25%));
  color: var(--claude-color-text);
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-field] {
  padding: 10px 12px;
  border-bottom: 1px solid var(--claude-menu-border);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-field] > input,
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-search] > input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--claude-color-text);
  font: inherit;
  font-size: 14px;
}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes-search-field], [data-claude-branch-search]) > input::placeholder {
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-list] {
  max-height: 340px;
  overflow: auto;
  padding: 4px 0;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-list] > [data-claude-changes-row] {
  height: 28px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-more] {
  padding: 8px 14px 10px;
  font-size: 13px;
  color: var(--claude-color-text-tertiary, currentColor);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-more]:empty {
  display: none;
}
/* The compare menu's branch list. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu][data-claude-branch-menu] {
  min-width: 300px;
  padding: 0 4px 4px;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-search] {
  margin: 0 -4px 4px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--claude-menu-border);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-list] {
  max-height: 300px;
  overflow: auto;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-list] > [data-claude-menu-row] {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  white-space: nowrap;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-list] > [data-claude-menu-row]:hover {
  background: var(--claude-menu-hover);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-menu-empty] {
  padding: 6px 10px;
  color: var(--claude-color-text-tertiary, currentColor);
}
/* Expanded Changes: as the expanded terminal and Files. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-tree-split] > div:not(:has([data-tree-group='grp-review'])):not(:has([data-tree-group='grp-sessions'])) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-tree-split] [data-tree-split] > div:not(:has([data-tree-group='grp-review'])) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-tree-split] > div:has([data-tree-group='grp-review']):not(:has([data-tree-group='grp-sessions'])),
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-tree-split] [data-tree-split] > div:has([data-tree-group='grp-review']) {
  flex: 1 1 0% !important;
  max-width: none !important;
  max-height: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-claude-pane-tools] {
  visibility: hidden !important;
}

html[data-claude-chat-look='true'][data-hermes-theme] :is([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]), [data-claude-tree-results] [title], [data-claude-tab-list] > [title], [data-claude-changes] [title], [data-claude-changes-search] [title]):is([title$='.png' i], [title$='.jpg' i], [title$='.jpeg' i], [title$='.gif' i], [title$='.webp' i], [title$='.bmp' i], [title$='.ico' i], [title$='.svg' i], [title$='.avif' i]),
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:']:is([data-tree-tab$='.png' i], [data-tree-tab$='.jpg' i], [data-tree-tab$='.jpeg' i], [data-tree-tab$='.gif' i], [data-tree-tab$='.webp' i], [data-tree-tab$='.bmp' i], [data-tree-tab$='.ico' i], [data-tree-tab$='.svg' i], [data-tree-tab$='.avif' i]) {
  --claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='1.5' y='2.5' width='13' height='11' rx='2' fill='%23FF678D'/%3E%3Ccircle cx='5.4' cy='6' r='1.3' fill='%23262731'/%3E%3Cpath d='M2.5 12.2 6.4 8.6l2.2 2 2.1-1.7 2.8 3.3z' fill='%23262731'/%3E%3C/svg%3E");
}
`


const CSS = `
html[data-claude-chat-look='true'] {
  --sticky-human-top: 0px;
  --claude-color-chat: var(--ui-chat-surface-background);
  --claude-color-sidebar: var(--ui-sidebar-surface-background);
  --claude-color-card: var(--dt-card, var(--ui-editor-surface-background));
  --claude-color-elevated: var(--dt-popover, var(--ui-widget-surface-background));
  --claude-color-bubble: var(--ui-chat-bubble-background);
  --claude-color-status-panel: color-mix(
    in srgb,
    var(--ui-bg-tertiary, var(--claude-color-card)) 32.5%,
    var(--claude-color-chat)
  );
  --claude-color-text: var(--ui-text-primary);
  --claude-color-text-secondary: var(--ui-text-secondary);
  --claude-color-text-tertiary: var(--ui-text-tertiary);
  --claude-color-text-quaternary: var(--ui-text-quaternary);
  --claude-color-border: var(--ui-stroke-secondary);
  --claude-color-border-subtle: var(--ui-stroke-tertiary);
  --claude-color-hover: var(--ui-row-hover-background);
  --claude-color-active: var(--ui-row-active-background);
  --claude-sidebar-label: color-mix(in srgb, var(--claude-color-text) 90%, var(--claude-color-sidebar));
  --claude-sidebar-muted: color-mix(in srgb, var(--claude-color-text) 65%, var(--claude-color-sidebar));
  --claude-sidebar-hover: color-mix(in srgb, var(--claude-color-text) 4%, transparent);
  --claude-sidebar-active: color-mix(in srgb, var(--claude-color-text) 7%, transparent);
  --claude-color-primary: var(--dt-primary);
  --claude-color-primary-foreground: var(--dt-primary-foreground);
  --claude-color-success: var(--ui-green);
  --claude-color-destructive: var(--dt-destructive);
  --claude-shadow-floating: var(--shadow-md);
}

/* The bundled Claude theme keeps its exact palette seeds. Other Hermes themes
   flow through the shared semantic UI tokens above. */
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'] {
  --claude-color-card: var(--theme-card-seed);
  --claude-color-elevated: var(--theme-elevated-seed);
  --claude-color-bubble: var(--theme-bubble-seed);
}

/* Keep the measured dark palette exact instead of tinting its neutral seeds. */
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] {
  --claude-color-text: var(--theme-foreground);
  --claude-color-active: var(--theme-accent-soft);
  --claude-color-border: var(--dt-border);
  --claude-color-border-subtle: var(--dt-composer-ring);
  --ui-row-active-background: var(--theme-accent-soft);
  --ui-widget-surface-background: var(--theme-elevated-seed);
}

/* The field colors are exact Claude seeds only in the ordinary opaque page.
   Glass makes Hermes' semantic chat/sidebar fields transparent; do not repaint
   them after the native material layer has taken ownership. */
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']:not([data-hermes-glass]) {
  --claude-color-chat: var(--theme-background-seed);
  --ui-chat-surface-background: var(--claude-color-chat);
  --claude-color-sidebar: var(--theme-sidebar-seed);
}

html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']:not([data-hermes-glass]) {
  --ui-sidebar-surface-background: var(--theme-sidebar-seed);
}

html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-glass] {
  --claude-color-chat: var(--ui-chat-surface-background);
  --claude-color-sidebar: var(--ui-sidebar-surface-background);
}

html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']:not([data-hermes-glass]),
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']:not([data-hermes-glass]) body {
  background-color: var(--claude-color-chat) !important;
}

html[data-claude-chat-look='true'][data-claude-composer-width='claude'] {
  --composer-width: 768px;
}

html[data-claude-chat-look='true'][data-claude-composer-width='claude-wide'] {
  --composer-width: 921.6px;
}

html[data-claude-chat-look='true'][data-claude-composer-width='claude-wider'] {
  --composer-width: 1075.2px;
}

html[data-claude-chat-look='true'] body,
html[data-claude-chat-look='true'] button,
html[data-claude-chat-look='true'] input,
html[data-claude-chat-look='true'] textarea,
html[data-claude-chat-look='true'] [contenteditable='true'] {
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'],
html[data-claude-chat-look='true'] [data-slot='aui_thread-content'] {
  background: var(--claude-color-chat) !important;
}

/* The full-width sticky row is layout only. It never paints or clips the
   transcript; the visible sent-message surface remains its own child. */
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] {
  background: transparent !important;
}

/* Hermes pins each user prompt to the top of the thread. Keep that native
   behavior unless the user explicitly opts out through the plugin setting. */
html[data-claude-chat-look='true'][data-claude-pinned-user-messages='off'] [data-slot='aui_user-message-root'] {
  position: static !important;
  top: auto !important;
  z-index: auto !important;
}

/* Keep one live-tail wrapper fully laid out only while the viewport is at the
   bottom. Scrolling away removes this marker and restores native virtualization. */
html[data-claude-chat-look='true'] [data-slot='aui_thread-content'] > [data-claude-live-tail='true'] {
  content-visibility: visible !important;
  contain-intrinsic-size: none !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-root'],
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] {
  background: transparent !important;
  color: var(--claude-color-text) !important;
}

/* Clean transcript is post-turn only. Runtime adds the settled marker after
   Hermes mounts a real final message and while no native liveness or human
   action remains in that turn. */
html[data-claude-chat-look='true'][data-claude-clean-transcript='on']
  [data-slot='aui_turn-pair'][data-claude-clean-settled='true']
  [data-claude-clean-interim='true'],
html[data-claude-chat-look='true'][data-claude-clean-transcript='on']
  [data-slot='aui_turn-pair'][data-claude-clean-settled='true']
  [data-claude-clean-interim-part='true'],
html[data-claude-chat-look='true'][data-claude-clean-transcript='on']
  [data-slot='aui_turn-pair'][data-claude-clean-settled='true']
  > [data-role='system']:not(:has([role='alert'])),
html[data-claude-chat-look='true'][data-claude-clean-transcript='on']
  [data-slot='aui_turn-pair'][data-claude-clean-settled='true']
  [data-slot='tool-block']:not(:has([data-slot='aui_generated-image'], [data-slot='aui_artifact-card'])),
html[data-claude-chat-look='true'][data-claude-clean-transcript='on']
  [data-slot='aui_turn-pair'][data-claude-clean-settled='true']
  [data-slot='aui_thinking-disclosure'],
html[data-claude-chat-look='true'][data-claude-clean-transcript='on']
  [data-slot='aui_turn-pair'][data-claude-clean-settled='true']
  [data-slot='aui_changed-files'] {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'],
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md,
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :where(p, li, blockquote, table),
html[data-claude-chat-look='true'] [data-slot='aui_user-inline-text'] {
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-weight: 400 !important;
  color: var(--claude-color-text) !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md li::marker {
  color: var(--claude-color-text) !important;
  opacity: 1 !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] {
  align-items: flex-end !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_user-bubble-actions'] {
  width: fit-content !important;
  min-width: 0 !important;
  max-width: 77% !important;
  align-self: flex-end !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message {
  width: 100% !important;
  max-width: 100% !important;
  border: 0 !important;
  border-radius: 17px !important;
  background: var(--claude-color-bubble) !important;
  color: var(--claude-color-text) !important;
  padding: 8px 12px !important;
  text-align: left !important;
}

/* Native Hermes leaves sent attachments as a sibling after the sticky user
   root. Order them before the bubble without reparenting React nodes, then
   make only those user-owned images Claude thumbnails. The selector is anchored
   to the user root so assistant output images keep their full native size and
   lightbox behavior. */
html[data-claude-chat-look='true'] [data-slot='aui_turn-pair']
  > [data-role='user']
  + *:not([data-role]):has([data-slot='aui_embedded-images']) {
  order: -1 !important;
  width: 100% !important;
  align-self: stretch !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  margin: 0 0 calc(-1 * var(--conversation-turn-gap, 12px) + 8px) !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_turn-pair'] > [data-role='user']
  + *:not([data-role]) [data-slot='aui_embedded-images'] {
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: flex-end !important;
  margin-top: 0 !important;
  gap: 8px !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_turn-pair'] > [data-role='user']
  + *:not([data-role]) [data-slot='aui_embedded-images'] > [aria-hidden] {
  width: 80px !important;
  height: 80px !important;
  border-radius: 10px !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_turn-pair']
  > [data-role='user']
  + *:not([data-role])[data-claude-has~="slot-aui-directive-image-slot-aui-embedded-image"]
  :is([data-slot='aui_directive-image'], [data-slot='aui_embedded-image']) {
  width: 80px !important;
  height: 80px !important;
  max-width: 80px !important;
  max-height: 80px !important;
  flex: 0 0 80px !important;
  overflow: hidden !important;
  border: 1px solid var(--claude-color-border-subtle) !important;
  border-radius: 10px !important;
  padding: 0 !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_turn-pair']
  > [data-role='user']
  + *:not([data-role])[data-claude-has~="slot-aui-directive-image-slot-aui-embedded-image"]
  :is([data-slot='aui_directive-image'], [data-slot='aui_embedded-image']) img {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  display: block !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  object-fit: cover !important;
  border: 0 !important;
  border-radius: inherit !important;
}

/* Legacy inline image directives can live inside the user bubble rather than
   the metadata attachment row. Keep them bounded to user content and preserve
   the native zoomable element. */
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root']
  .composer-human-message [data-slot='aui_embedded-images'] {
  justify-content: flex-end !important;
  gap: 8px !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_turn-pair']
  > [data-role='user']
  + *:not([data-role])[data-claude-has~="slot-aui-directive-image-slot-aui-embedded-image"]
  [data-slot='aui_embedded-images'] {
  justify-content: flex-end !important;
  gap: 8px !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_user-message-root']
  .composer-human-message [data-slot='aui_embedded-images']
  :is([data-slot='aui_directive-image'], [data-slot='aui_embedded-image']) {
  width: 80px !important;
  height: 80px !important;
  max-width: 80px !important;
  max-height: 80px !important;
  overflow: hidden !important;
  border: 1px solid var(--claude-color-border-subtle) !important;
  border-radius: 10px !important;
  padding: 0 !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_user-message-root']
  .composer-human-message [data-slot='aui_embedded-images']
  :is([data-slot='aui_directive-image'], [data-slot='aui_embedded-image']) img {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: cover !important;
  border-radius: inherit !important;
}

/* The native composer inserts ImageIcon before its asynchronous thumbnail.
   Reserve the frame from that first state, not from the later img insertion.
   IconPhoto is the image-kind fallback in AttachmentPill; file-kind icons do
   not match. Native labels remain available through aria-label and tooltip,
   and upload/error overlays and removal buttons retain their handlers. */
html[data-claude-chat-look='true'] [data-slot='composer-attachments'] {
  gap: 12px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-span-first-child-is-img-svg"] > button:first-child {
  /* Claude's thumbnail: 150 device px at 125 % with a one-pixel rim. */
  box-sizing: border-box !important;
  width: 120px !important;
  height: 120px !important;
  max-width: 120px !important;
  padding: 0 !important;
  align-items: stretch !important;
  gap: 0 !important;
  border: 0.8px solid color-mix(in srgb, var(--claude-color-text) 18%, transparent) !important;
  border-radius: 9px !important;
  overflow: hidden !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-span-first-child-is-img-svg"] > button:first-child > span:first-child {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  border: 0 !important;
  border-radius: inherit !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-span-first-child-is-img-svg"] > button:first-child > span:last-child {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-img"] > button:first-child img {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: cover !important;
  border-radius: inherit !important;
}

/* Scale the native removal button once, including its native 10px glyph.
   Center origin preserves its location. Do not also increase the glyph font:
   that compounds the scale and makes the cross overflow its circle. */
html[data-claude-chat-look='true'] [data-slot='composer-attachments']
  .group\\/attachment[data-claude-has~="child-button-first-child-span-first-child-is-img-svg"]
  > button:nth-child(2) {
  transform: scale(2) !important;
  transform-origin: center !important;
  z-index: 2;
}


html[data-claude-chat-look='true'] [data-claude-image-marker='true'] {
  display: none !important;
}

/* Keep long prompts compact: 4 text lines, then a dedicated ellipsis row and an
   explicit expand control. The 110px clamp covers four 22px content lines plus
   the 22px ellipsis row. Neutralize Hermes'
   four-line gradient first; runtime only reapplies the hard clamp to messages
   whose measured full height actually exceeds the Claude limit. */
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] .sticky-human-clamp {
  max-height: none !important;
  overflow: visible !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'][data-claude-long-user='true'] .composer-human-message {
  padding-bottom: 38px !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'][data-claude-long-user='true']:not([data-claude-user-expanded='true']) .sticky-human-clamp {
  position: relative;
  max-height: 110px !important;
  overflow: hidden !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'][data-claude-long-user='true']:not([data-claude-user-expanded='true']) .sticky-human-clamp::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 22px;
  background: var(--claude-color-bubble);
  color: var(--claude-color-text);
  content: '...';
  font: inherit;
  line-height: 22px;
}

html[data-claude-chat-look='true'] [data-claude-user-expand] {
  position: absolute;
  bottom: 8px;
  left: 12px;
  z-index: 11;
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--claude-color-text) 66%, transparent);
  cursor: pointer;
  font: inherit;
  line-height: 22px;
}

html[data-claude-chat-look='true'] [data-claude-user-expand]:hover {
  color: color-mix(in srgb, var(--claude-color-text) 86%, transparent);
}

html[data-claude-chat-look='true'] [data-claude-user-chevron] {
  width: 8px;
  height: 8px;
  margin-top: -4px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
}

html[data-claude-chat-look='true'] [data-claude-user-expand][aria-expanded='true'] [data-claude-user-chevron] {
  margin-top: 4px;
  transform: rotate(225deg);
}

@media (max-width: 720px) {
  html[data-claude-chat-look='true'] [data-slot='aui_user-bubble-actions'] {
    max-width: 88% !important;
  }
}

/* Both sent-message editing and Queue editing stay native. The skin only gives
   their existing contenteditable/actions the same bubble language as Claude. */
html[data-claude-chat-look='true'] [data-slot='aui_edit-composer-root'] .composer-human-message-container {
  border-radius: 17px !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_edit-composer-root'] .composer-human-message {
  width: 100% !important;
  max-width: 100% !important;
  padding: 8px 12px !important;
  border: 1px solid var(--claude-color-border) !important;
  border-radius: 17px !important;
  background: var(--claude-color-bubble) !important;
  color: var(--claude-color-text) !important;
  box-shadow: none !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_edit-composer-root'] [data-slot='composer-rich-input'] {
  min-height: 44px !important;
  padding: 0 30px 0 0 !important;
  background: transparent !important;
  color: var(--claude-color-text) !important;
  caret-color: var(--claude-color-text) !important;
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-weight: 400 !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_edit-composer-root'] .composer-human-message > button:last-child {
  right: 8px !important;
  bottom: 8px !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  border: 0 !important;
  border-radius: 9999px !important;
  background: var(--claude-color-primary) !important;
  color: var(--claude-color-primary-foreground) !important;
}

/* Keep Hermes' compact live-thinking typography. The Claude answer font must
   never leak into the streaming reasoning preview. */
html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_thinking-disclosure'] {
  font-family: var(--font-sans, ${HERMES_FONT}) !important;
  font-size: 11px !important;
  line-height: 16.5px !important;
  font-weight: 400 !important;
  color: color-mix(in srgb, var(--claude-color-text) 54%, transparent) !important;
}

html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_thinking-disclosure'] :where(button, span) {
  font-family: var(--font-sans, ${HERMES_FONT}) !important;
  font-size: 11px !important;
  line-height: 16.5px !important;
  font-weight: 400 !important;
}

html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_reasoning-text'],
html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_reasoning-text'] .aui-md,
html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_reasoning-text'] .aui-md :where(p, li, blockquote) {
  font-family: var(--font-sans, ${HERMES_FONT}) !important;
  font-size: 12px !important;
  line-height: 15px !important;
  font-weight: 400 !important;
  color: color-mix(in srgb, var(--claude-color-text) 60%, transparent) !important;
}

/* Claude sidebar geometry, painted by the active Hermes theme. */
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'],
html[data-claude-chat-look='true'] [data-slot='sidebar'],
html[data-claude-chat-look='true'] [data-slot='sidebar-content'],
html[data-claude-chat-look='true'] [data-slot='sidebar-group'],
html[data-claude-chat-look='true'] [data-slot='sidebar-group-content'] {
  background: var(--claude-color-sidebar) !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover[class*='ui-row-active-background'],
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-active='true'],
html[data-claude-chat-look='true'] [data-slot='sidebar'] [aria-current='true'] {
  border: 0 !important;
  border-radius: 10px !important;
  outline: 0 !important;
  background: var(--claude-sidebar-active) !important;
  box-shadow: none !important;
}

/* Keep row geometry invariant across pointer state. If 10 px begins only at
   :hover, Chromium can paint one native 6 px frame before the hover cascade. */
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover {
  border-radius: 10px !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover:hover:not([class*='ui-row-active-background']):not([data-active='true']):not([aria-current='true']) {
  background: var(--claude-sidebar-hover) !important;
}

/* Native Bots/group rows are full-width buttons, not .row-hover elements.
   Scope their paint to the left sidebar; leave avatars, status colors and
   toolbar actions alone. Selected rows keep their fill under the pointer. */
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions']
  button[aria-label][class~='w-full'][class~='text-left'][class~='hover:bg-(--chrome-action-hover)'] {
  border-radius: 10px !important;
}

html[data-claude-chat-look='true'] [data-tree-group='grp-sessions']
  button[aria-label][class~='w-full'][class~='text-left'][class~='hover:bg-(--chrome-action-hover)']:hover {
  background: var(--claude-sidebar-hover) !important;
}

html[data-claude-chat-look='true'] [data-tree-group='grp-sessions']
  button[aria-label][class~='w-full'][class~='text-left'][class~='hover:bg-(--chrome-action-hover)'][class~='bg-(--ui-row-active-background)'] {
  background: var(--claude-sidebar-active) !important;
}

/* Round the chat surface beside the visible sessions sidebar, with or without tabs. */
html[data-claude-chat-look='true']
  [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div:has(> [data-tree-group='grp-main'])::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 16px;
  height: 16px;
  background: var(--ui-sidebar-surface-background);
  pointer-events: none;
}

html[data-claude-chat-look='true']
  [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div
  > [data-tree-group='grp-main'] {
  border-top-left-radius: 16px !important;
}

/* With an integrated panel header, the visible chat starts below that header.
   Its rounded cutout must reveal sidebar paint, not the chat's own background. */
html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div > [data-tree-group='grp-main']:has(> [data-panel-header]) {
  background: var(--ui-sidebar-surface-background) !important;
}

html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div > [data-tree-group='grp-main'] > [data-panel-header] + div {
  border-top-left-radius: 0 !important;
  background: var(--ui-editor-surface-background) !important;
}

/* Integrated headers and their content share a square edge. The standalone
   chat surface above remains rounded only when it has no integrated header. */
html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div:has(> [data-tree-group='grp-main'] > [data-panel-header])::before {
  content: none !important;
  width: 0 !important;
  height: 0 !important;
}

html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div > [data-tree-group='grp-main']:has(> [data-panel-header]) {
  border-top-left-radius: 0 !important;
}

html[data-claude-chat-look='true']
  [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div
  > [role='separator']
  > span {
  opacity: 0 !important;
}

html[data-claude-chat-look='true']
  [data-tree-group='grp-sessions']
  [data-zone-tabstrip='grp-sessions']
  [role='tab'][data-tree-tab] {
  border-left-color: transparent !important;
}

/* Transparent tabless main overlay: the scroller reaches the pane's top while
   the native drag handle and separate window controls stay in a 48px band. */
html[data-claude-chat-look='true'] [data-tree-group='grp-main'] > [data-panel-header]:not(:has([data-zone-tabstrip])) {
  position: absolute !important;
  inset: 0 0 auto !important;
  height: 48px !important;
  min-height: 48px !important;
  z-index: 30;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  pointer-events: none;
}

html[data-claude-chat-look='true'] [data-tree-group='grp-main'] > [data-panel-header]:not([data-claude-has~="zone-tabstrip"]) > [data-window-drag-handle] {
  pointer-events: auto;
}

/* Match the shared 48px header row while preserving the original square
   Sessions/Bots tabs, underline and divider behavior. */
html[data-claude-chat-look='true']
  [data-tree-group='grp-sessions']
  [data-zone-tabstrip='grp-sessions'] {
  height: 48px !important;
  min-height: 48px !important;
  box-sizing: border-box !important;
  padding-block: 10px !important;
}

html[data-claude-chat-look='true']
  [data-tree-group='grp-sessions']
  [data-zone-tabstrip='grp-sessions']
  > [role='tablist'] {
  align-items: center !important;
}

html[data-claude-chat-look='true']
  [data-tree-group='grp-sessions']
  [data-zone-tabstrip='grp-sessions']
  [role='tab'][data-tree-tab] {
  height: 28px !important;
  min-height: 28px !important;
}


/* Prefer the full sidebar toggle to partial minimization. Keep Restore
   available for layouts saved before this control was hidden. */
html[data-claude-chat-look='true']
  [data-tree-group='grp-sessions']
  [data-zone-tabstrip='grp-sessions']
  > button:has(> .codicon-chevron-down) {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [class~='group/section-label'] > span > .dither {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [class~='group/section-label'] > span:first-child {
  color: var(--claude-sidebar-muted) !important;
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-size: 14px !important;
  line-height: 21px !important;
  font-weight: 500 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [class~='group/section-label'] > span:first-child > span:last-child {
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-size: 14px !important;
  line-height: 21px !important;
  font-weight: 500 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar-menu-button'] {
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-size: 14px !important;
  line-height: 21px !important;
  font-weight: 400 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] span[class*='text-[0.8125rem]'] {
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-size: 14px !important;
  line-height: 20px !important;
  font-weight: 400 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}

/* Names carry the hierarchy; section labels and utility icons stay quieter.
   Never dim a whole row: its native status and project colors must survive. */
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover span[class*='text-[0.8125rem]'],
html[data-claude-chat-look='true'] [data-slot='sidebar-menu-button'] {
  color: var(--claude-sidebar-label) !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover:is(:hover, [data-active='true'], [aria-current='true'], [class*='ui-row-active-background']) span[class*='text-[0.8125rem]'] {
  color: var(--claude-color-text) !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar-menu-button'] > :is(svg, .codicon):not([style*='color']) {
  color: var(--claude-sidebar-muted) !important;
}

/* Pure idle has no information to communicate. Hide only Hermes' uncolored
   grey fallback dot; keep project-colored idle identity and every semantic
   state (draft, working, stalled, background, unread and needs-input). */
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover
  span[aria-hidden='true'][class~='size-1'][class*='bg-(--ui-text-quaternary)']:not([style*='background-color']) {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover[data-working='true'] {
  border-radius: 10px !important;
  overflow: hidden !important;
  isolation: isolate;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover[data-working='true'] > .arc-border {
  inset: 0 !important;
  border-radius: inherit !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-working='true'] [aria-label='Session running'],
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-working='true'] [aria-label='Session en cours'] {
  background: var(--claude-color-primary) !important;
  box-shadow: 0 0 0.625rem color-mix(in srgb, var(--claude-color-text) 26%, transparent) !important;
}

/* A turn that finished in another chat stays a steady green attention cue.
   Keep it distinct from the black animated running dot and gray background dot. */
html[data-claude-chat-look='true'] [data-slot='sidebar'] [role='status'][class~='bg-emerald-500'] {
  width: 8px !important;
  min-width: 8px !important;
  height: 8px !important;
  flex: 0 0 8px !important;
  background: var(--claude-color-success) !important;
  opacity: 1 !important;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--claude-color-success) 14%, transparent),
    0 0 8px color-mix(in srgb, var(--claude-color-success) 48%, transparent) !important;
}

/* Left-edge history index. Native buttons still own message navigation; only
   the hover presentation is replaced. Dimensions follow the 2x reference. */
html[data-claude-chat-look='true'] [data-claude-history-rail] {
  /* Local units compensate the zoom: 16px left and 36px wide on screen. */
  left: 11.2px !important;
  right: auto !important;
  width: 25.2px !important;
  align-items: flex-start !important;
  /* Scale the whole native coordinate space, including its hit targets.
     The virtualizer still owns unchanged 7px offsets and scrollTop values. */
  zoom: calc(10 / 7);
  transform: translateY(-50%) !important;
  transform-origin: center !important;
  max-height: calc(min(60vh, 360px, var(--claude-history-rail-height, 360px)) * .7);
}
html[data-claude-chat-look='true'] [data-session-anchor]:has([data-slot='thread-timeline']) {
  container-type: inline-size;
  container-name: claude-history-pane;
}
@container claude-history-pane (max-width: 862px) {
  html[data-claude-chat-look='true'] [data-claude-history-rail] { display: none !important; }
}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] {
  align-items: flex-start !important;
  width: 25.2px !important;
  max-height: min(60vh, 360px, var(--claude-history-rail-height, 360px));
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: none;
  padding: 0 !important;
}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] > .thread-timeline-track {
  width: 25.2px !important;
  position: relative !important;
}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick {
  width: 25.2px !important;
  justify-content: flex-start !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  cursor: pointer;
}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick > [data-slot='timeline-bar'] {
  width: calc(var(--claude-history-tick-width, 6px) * .7) !important;
  height: 1.4px !important;
  flex: none !important;
  border-radius: 0 !important;
  background: color-mix(in srgb, var(--claude-color-text) 19.148936%, var(--claude-color-chat)) !important;
  background-image: none !important;
  opacity: 1 !important;
  transition: width 140ms cubic-bezier(.2,.8,.2,1), opacity 140ms ease !important;
}
/* Pointer motion already updates the continuous wave once per frame. Do not
   restart a trailing width animation on every sample; animate only its exit. */
html[data-claude-chat-look='true'] [data-claude-history-rail][data-claude-history-open] [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick > [data-slot='timeline-bar'] {
  transition: none !important;
}
/* The hover preview temporarily replaces Hermes' visible-message highlight. */
html[data-claude-chat-look='true'] [data-claude-history-rail]:not([data-claude-history-open]) [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick[aria-current='location'] > [data-slot='timeline-bar'] {
  background: color-mix(in srgb, var(--claude-color-text) 60%, var(--claude-color-chat)) !important;
}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick[data-claude-history-hover] > [data-slot='timeline-bar'] {
  background: var(--claude-color-text) !important;
}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-popover'] {
  display: none !important;
}
html[data-claude-chat-look='true'] [data-claude-history-preview] {
  position: absolute;
  z-index: 50;
  box-sizing: border-box;
  overflow: hidden;
  padding: 10px 8px;
  border: 1px solid color-mix(in srgb, var(--claude-color-text) 12%, transparent);
  border-radius: 12px;
  background: var(--claude-color-elevated);
  color: var(--claude-color-text);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--claude-color-text) 12%, transparent);
  font-family: var(--font-sans, ${SYSTEM_FONT});
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  overflow-wrap: anywhere;
  -webkit-app-region: no-drag;
}
html[data-claude-chat-look='true'] [data-claude-history-preview][hidden] { display: none !important; }
html[data-claude-chat-look='true'] [data-claude-history-question],
html[data-claude-chat-look='true'] [data-claude-history-answer] {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  -webkit-line-clamp: 2;
}
html[data-claude-chat-look='true'] [data-claude-history-question] { font-weight: 500; }
html[data-claude-chat-look='true'] [data-claude-history-answer] {
  -webkit-line-clamp: 4;
  margin-top: 8px;
  color: var(--claude-color-text-secondary);
  font-weight: 400;
}
html[data-claude-chat-look='true'] [data-claude-history-answer] p { margin: 0 0 8px; }
html[data-claude-chat-look='true'] [data-claude-history-answer] p:last-child { margin-bottom: 0; }
html[data-claude-chat-look='true'] [data-claude-history-answer] strong { font-weight: 600; }
@media (prefers-reduced-motion: reduce) {
  html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] .thread-timeline-tick > [data-slot='timeline-bar'] { transition: none !important; }
}

/* Claude sidebar scrollbar: a neutral overlay thumb exists only while the user
   is actively scrolling. Runtime attributes avoid a permanent gutter/blue
   system-accent thumb without replacing the native scroll container. */
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true'] {
  scrollbar-color: transparent transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']::-webkit-scrollbar-track,
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']::-webkit-scrollbar-corner {
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']::-webkit-scrollbar-thumb {
  min-height: 28px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: transparent;
  background-clip: padding-box;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true'][data-claude-scrolling='true'] {
  scrollbar-color: color-mix(in srgb, var(--claude-color-text) 28%, transparent) transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true'][data-claude-scrolling='true']::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--claude-color-text) 28%, transparent) !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true'] {
  scrollbar-color: transparent transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true']::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true']::-webkit-scrollbar-track,
html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true']::-webkit-scrollbar-corner {
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true']::-webkit-scrollbar-thumb {
  min-height: 28px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: transparent;
  background-clip: padding-box;
}

html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true'][data-claude-scrolling='true'] {
  scrollbar-color: color-mix(in srgb, var(--claude-color-text) 28%, transparent) transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true'][data-claude-scrolling='true']::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--claude-color-text) 28%, transparent) !important;
}

/* Tool activity follows the selected theme's foreground instead of a fixed blue. */
html[data-claude-chat-look='true'] [data-slot='tool-block'] [aria-label='Running'],
html[data-claude-chat-look='true'] [data-slot='tool-block'] [aria-label='En cours'],
html[data-claude-chat-look='true'] [data-slot='tool-block'] span[class*='tabular-nums'] {
  color: var(--claude-color-text) !important;
  opacity: 0.70 !important;
}

/* Claude file diffs are quiet resource cards, not dark editor islands. Keep
   Hermes in charge of every color and borrow only Claude's geometry, density,
   and 80/20 semantic tint ratio. Ordinary tool rows are deliberately outside
   this data-file-edit scope. */
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] {
  --claude-diff-card-surface: color-mix(in srgb, var(--claude-color-elevated) 50%, transparent);
  --claude-diff-add-surface: color-mix(
    in srgb,
    var(--claude-diff-card-surface) 80%,
    var(--ui-diff-add-border)
  );
  --claude-diff-remove-surface: color-mix(
    in srgb,
    var(--claude-diff-card-surface) 80%,
    var(--ui-diff-remove-border)
  );
  background: var(--claude-diff-card-surface) !important;
  border-color: color-mix(in srgb, var(--claude-color-border-subtle) 50%, transparent) !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}

html[data-claude-chat-look='true']
  [data-slot='tool-block'][data-file-edit][data-tool-open]
  > div:first-child {
  padding-left: 12px !important;
  padding-right: 12px !important;
  border-bottom-color: color-mix(in srgb, var(--claude-color-border-subtle) 50%, transparent) !important;
}

html[data-claude-chat-look='true']
  [data-slot='tool-block'][data-file-edit][data-tool-open]
  [data-slot='file-diff-panel'] {
  background: transparent !important;
  color: var(--claude-color-text-secondary) !important;
  font-size: 12px !important;
  line-height: 18px !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
}

html[data-claude-chat-look='true']
  [data-slot='tool-block'][data-file-edit][data-tool-open]
  [data-slot='file-diff-panel'] span[class*='border-l-2'] {
  border-left-width: 0 !important;
  line-height: 18px !important;
  padding: 0 12px !important;
}

html[data-claude-chat-look='true']
  [data-slot='tool-block'][data-file-edit][data-tool-open]
  [data-slot='file-diff-panel'] span[class*='border-(--ui-diff-add-border)'] {
  background: var(--claude-diff-add-surface) !important;
  border-left-width: 0 !important;
  color: var(--claude-color-text-secondary) !important;
}

html[data-claude-chat-look='true']
  [data-slot='tool-block'][data-file-edit][data-tool-open]
  [data-slot='file-diff-panel'] span[class*='border-(--ui-diff-remove-border)'] {
  background: var(--claude-diff-remove-surface) !important;
  border-left-width: 0 !important;
  color: var(--claude-color-text-secondary) !important;
}

@keyframes claude-compaction-spin {
  to { transform: rotate(360deg); }
}

/* Keep the ordinary duplicate loading/timer rows hidden, but restore Hermes'
   native auto-compaction signal. The aria-label is native compaction state —
   no guessed text, polling, or replacement compression logic. */
html[data-claude-chat-look='true'] [data-slot='aui_response-loading'][aria-label='Summarizing thread'] {
  width: fit-content !important;
  max-width: min(100%, 44rem) !important;
  display: flex !important;
  align-self: center !important;
  align-items: center !important;
  gap: 7px !important;
  margin: 4px auto 8px !important;
  padding: 4px 8px !important;
  border: 1px solid var(--claude-color-border-subtle) !important;
  border-radius: 10px !important;
  background: var(--claude-color-bubble) !important;
  color: color-mix(in srgb, var(--claude-color-text) 58%, transparent) !important;
  font-size: 12px !important;
  line-height: 20px !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_response-loading'][aria-label='Summarizing thread'] .dither {
  width: 12px !important;
  height: 12px !important;
  flex: 0 0 12px !important;
  border: 1.5px solid color-mix(in srgb, var(--claude-color-text) 22%, transparent) !important;
  border-right-color: color-mix(in srgb, var(--claude-color-text) 72%, transparent) !important;
  border-radius: 999px !important;
  background: transparent !important;
  color: transparent !important;
  animation: claude-compaction-spin 800ms linear infinite !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_response-loading'][aria-label='Summarizing thread'] .shimmer {
  color: inherit !important;
}

/* Claude keeps tool activity in the ordinary timeline. Hermes' bounded tool
   window scrolls its children behind a short viewport, which makes commands
   look stacked. Preserve every native row/action but let the group flow. */
html[data-claude-chat-look='true'] [data-tool-group],
html[data-claude-chat-look='true'] [data-tool-group] .tool-group-scroll {
  max-height: none !important;
  overflow: visible !important;
  scrollbar-width: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}

/* Hide the branch / dirty-files strip only. Git state and review remain intact. */
html[data-claude-chat-look='true'] .coding-status-bar {
  display: none !important;
}

/* Claude Code desktop measures a 768 CSS px composer and message column.
   Claude +20 % and +40 % raise that limit to 921.6 and 1075.2 CSS px.
   All Claude modes shrink in narrow panes.
   Hermes keeps the 5px peel-out margin on each side, hence the +10px dock. */
html[data-claude-chat-look='true'][data-claude-composer-width='claude'] [data-slot='composer-dock']:not([data-popped-out]),
html[data-claude-chat-look='true'][data-claude-composer-width='claude-wide'] [data-slot='composer-dock']:not([data-popped-out]),
html[data-claude-chat-look='true'][data-claude-composer-width='claude-wider'] [data-slot='composer-dock']:not([data-popped-out]) {
  width: calc(min(var(--composer-width), calc(100% - 2rem)) + 10px) !important;
  max-width: calc(100% - 22px) !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-root'],
html[data-claude-chat-look='true'] [data-slot='composer-root'] > div,
html[data-claude-chat-look='true'] [data-slot='composer-surface'],
html[data-claude-chat-look='true'] [data-slot='composer-surface'] > [aria-hidden] {
  border-radius: 21px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] {
  min-height: 98px !important;
  border: 0.5px solid var(--claude-color-border-subtle) !important;
  background: var(--claude-color-card) !important;
  box-shadow: var(--shadow-nous) !important;
  backdrop-filter: none !important;
  overflow: hidden !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] > [aria-hidden] {
  background: var(--claude-color-card) !important;
  backdrop-filter: none !important;
}

/* Remove Hermes' outer composer wash; the Claude surface already owns its fill. */
html[data-claude-chat-look='true']
  [data-slot='composer-root']
  > .pointer-events-none.absolute.inset-0 {
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-fade'] {
  --claude-playback-edge-gap: 12px;
  padding: 11px 7px 7px !important;
  gap: 0 !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface']:has([data-claude-playback-floating='true']),
html[data-claude-chat-look='true'] [data-slot='composer-fade']:has(> [data-claude-playback-floating='true']) {
  overflow: visible !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-fade'] > div:last-child {
  grid-template-columns: auto 1fr auto !important;
  grid-template-areas: "input input input" "menu . controls" !important;
  align-items: center !important;
  row-gap: 0 !important;
  column-gap: 5px !important;
}

html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] {
  min-height: 32px !important;
  gap: 8px !important;
  padding: 3px 4px 3px 10px !important;
  border: 1px solid var(--claude-color-border-subtle) !important;
  border-radius: 10px !important;
  background: var(--ui-bg-tertiary) !important;
  box-shadow: none !important;
}

html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] > div:first-child {
  color: color-mix(in srgb, var(--claude-color-text) 56%, transparent) !important;
  font-size: 12px !important;
  line-height: 18px !important;
  font-weight: 400 !important;
}

html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] > div:last-child {
  gap: 4px !important;
}

html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] button {
  height: 26px !important;
  min-height: 26px !important;
  padding: 0 8px !important;
  border: 0 !important;
  border-radius: 8px !important;
  background: transparent !important;
  color: color-mix(in srgb, var(--claude-color-text) 66%, transparent) !important;
  font-size: 11px !important;
  line-height: 16px !important;
  font-weight: 400 !important;
}

html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] button:last-child {
  padding: 0 10px !important;
  border-radius: 999px !important;
  background: var(--claude-color-primary) !important;
  color: var(--claude-color-primary-foreground) !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-rich-input'] {
  min-height: 44px !important;
  padding: 0 !important;
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-weight: 400 !important;
  scrollbar-width: thin !important;
  scrollbar-color: color-mix(in srgb, var(--claude-color-text) 22%, transparent) transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [data-slot='composer-attachments'] {
  padding: 0 4px !important;
  margin-bottom: 4px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-fade'] > div:last-child > div:has(> [data-slot='composer-rich-input']),
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > div:last-child > div:has(> div > [data-slot='composer-rich-input']) {
  padding-inline: 4px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-fade'] > div:last-child > div:has(button > .codicon-add) {
  translate: none !important;
  transform: none !important;
  align-self: center !important;
}

/* Twelve text lines before scrolling; sent-message editing stays native. */
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-slot='composer-rich-input'] {
  min-height: 50px !important;
  max-height: 240px !important;
  padding-top: 2px !important;
  color: var(--claude-color-text) !important;
}

/* Match the sampled placeholder with 24% foreground mixed into the fill;
   entered text remains at the sampled full foreground intensity. */
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] [data-slot='composer-surface'] [data-slot='composer-rich-input']:is(:empty, [data-empty])::before {
  color: color-mix(in srgb, var(--claude-color-text) 24%, var(--claude-color-card)) !important;
}

@supports (animation-timeline: scroll(self block)) {
  @keyframes claude-composer-scroll-edge {
    from { mask-image: linear-gradient(to bottom, black, black); }
    to { mask-image: linear-gradient(to bottom, transparent, black 16px); }
  }
  html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-slot='composer-rich-input'][data-claude-composer-overflow] {
    animation: claude-composer-scroll-edge 1s steps(1, end) both;
    animation-timeline: scroll(self block);
    animation-range: 0px 1px;
  }
}

html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-track,
html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-corner {
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-thumb {
  min-height: 28px;
  border: 2px solid transparent !important;
  border-radius: 999px !important;
  background-color: color-mix(in srgb, var(--claude-color-text) 22%, transparent) !important;
  background-image: none !important;
  background-clip: padding-box !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-thumb:hover {
  background-color: color-mix(in srgb, var(--claude-color-text) 38%, transparent) !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-button {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Add context'],
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Ajouter du contexte'],
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Voice dictation'],
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Dictée vocale'],
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Send'],
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Envoyer'] {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  border-radius: 9999px !important;
  padding: 0 !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label^='Model ·'],
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label^='Modèle ·'] {
  min-height: 28px !important;
  border-radius: 9999px !important;
  padding: 0 8px !important;
  color: color-mix(in srgb, var(--claude-color-text) 66%, transparent) !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label^='Model ·'],[aria-label^='Modèle ·'])[data-state='open'] {
  background: var(--claude-color-active) !important;
  color: var(--claude-color-text) !important;
}

/* Odd-length, unrotated strokes keep the small plus visually symmetric.
   Match the native send/stop circle's foreground, not the theme accent.
   Retain the native menu button and handler. */
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:has(> .codicon-add) {
  position: relative;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  padding: 0 !important;
  color: var(--dt-foreground, var(--claude-color-text)) !important;
}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button > .codicon-add {
  visibility: hidden;
}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:has(> .codicon-add)::before,
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:has(> .codicon-add)::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 13px;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:has(> .codicon-add)::after {
  width: 1.5px;
  height: 13px;
}

/* Replace only the idle dictation/send glyphs; their actual Hermes buttons and
   handlers stay untouched. Busy stop/queue controls keep their native icons. */
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale']) > *,
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Send'],[aria-label='Envoyer']) > * {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale'])::before,
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Send'],[aria-label='Envoyer'])::before {
  content: '';
  display: block;
  width: 16px;
  height: 16px;
  background: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale'])::before {
  mask-image: ${MIC_MASK};
}
/* Claude's mic glyph: 15 x 19 device px at 125 %. */
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale'])::before {
  width: 17px;
  height: 17px;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale']) {
  color: color-mix(in srgb, var(--claude-color-text) 84%, var(--claude-composer-fill)) !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Stop dictation'],[aria-label='Transcribing dictation']) {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  padding: 0 !important;
  border-radius: 9999px !important;
  background: transparent !important;
  color: var(--claude-color-text) !important;
  box-shadow: none !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Stop dictation'],[aria-label='Transcribing dictation']) svg {
  width: 14px !important;
  height: 14px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Send'],[aria-label='Envoyer'])::before {
  mask-image: ${SEND_MASK};
}

/* Keep Hermes' native dictation and playback lifecycles, but fold both banners
   into the same quiet Claude status-row language. */
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite']:has(> button),
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not(:has(> button)) {
  height: 28px;
  margin-bottom: var(--claude-playback-edge-gap);
  gap: 6px !important;
  padding: 0 4px !important;
  border: 0 !important;
  border-radius: 8px !important;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-size: 12px !important;
  line-height: 18px !important;
}

/* Reserve one 40px lane per native audio row at the top of the dock. The
   composer stays bottom-anchored, while Hermes' own dock measurement includes
   the lane in thread clearance. */
html[data-claude-chat-look='true'] [data-slot='composer-dock']:has([data-claude-playback-floating='true']) {
  padding-top: 40px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-dock']:has([data-claude-audio-dictation='true']):has([data-claude-audio-playback='true']) {
  padding-top: 80px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [data-claude-playback-floating='true'] {
  position: absolute !important;
  top: var(--claude-audio-lane-top, calc(-28px - var(--claude-playback-edge-gap))) !important;
  right: 15px !important;
  left: 15px !important;
  width: auto !important;
  margin: 0 !important;
  z-index: 6;
}

/* Native order is Dictation then Playback. When both exist, Playback occupies
   the second reserved row nearest the rest of the dock. */
html[data-claude-chat-look='true'] [data-slot='composer-fade'][data-claude-has~="child-claude-audio-dictation-true"][data-claude-has~="child-claude-audio-playback-true"] > [data-claude-audio-playback='true'] {
  top: calc(var(--claude-audio-lane-top) + 40px) !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > div:first-child,
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not([data-claude-has~="child-button"]) > div:first-child {
  width: 18px !important;
  height: 18px !important;
  flex: 0 0 18px !important;
  border-radius: 5px !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > div:first-child svg,
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not([data-claude-has~="child-button"]) > div:first-child svg {
  width: 14px !important;
  height: 14px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > div:nth-child(2),
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not([data-claude-has~="child-button"]) > div:nth-child(2) {
  gap: 6px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > div:nth-child(2) > span,
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not([data-claude-has~="child-button"]) > div:nth-child(2) > span {
  color: inherit !important;
  font-size: 12px !important;
  line-height: 18px !important;
  font-weight: 400 !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] canvas {
  width: 56px !important;
  height: 12px !important;
  opacity: 0.72 !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > button {
  height: 24px !important;
  min-height: 24px !important;
  gap: 4px !important;
  padding: 0 7px !important;
  border: 0 !important;
  border-radius: 7px !important;
  background: transparent !important;
  font-size: 11px !important;
  line-height: 16px !important;
  font-weight: 400 !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > button svg {
  width: 12px !important;
  height: 12px !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite']:has(> button),
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not(:has(> button)) {
  color: var(--claude-color-text-secondary) !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] canvas {
  color: var(--claude-color-text-tertiary) !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > button:hover {
  background: var(--claude-color-hover) !important;
  color: var(--claude-color-text) !important;
}

@keyframes claude-playback-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes claude-playback-exit {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(6px);
  }
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-enter='true'] {
  min-height: 0 !important;
  overflow: hidden !important;
  contain: paint !important;
  will-change: transform, opacity;
  animation: claude-playback-enter 240ms cubic-bezier(0.22, 1, 0.36, 1) both !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-exit='true'] {
  min-height: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
  user-select: none !important;
  contain: paint !important;
  will-change: transform, opacity;
  animation: claude-playback-exit 240ms cubic-bezier(0.22, 1, 0.36, 1) both !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-hold='true'] {
  pointer-events: none !important;
  user-select: none !important;
}

@media (prefers-reduced-motion: reduce) {
  html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-enter='true'] {
    animation: none !important;
  }

  html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-exit='true'] {
    display: none !important;
  }
}

/* Keep the native Attach menu compact and let Radix own its placement against
   the + trigger. Claude Skin changes only its visual density and chrome. */
html[data-claude-chat-look='true'] [data-claude-context-menu='true'] {
  width: 240px !important;
  max-width: calc(100vw - 24px) !important;
  max-height: min(40vh, 360px) !important;
  padding: 4px !important;
  border: 0.5px solid var(--claude-color-border-subtle) !important;
  border-radius: 12px !important;
  background: var(--claude-color-card) !important;
  box-shadow: var(--shadow-nous) !important;
  backdrop-filter: none !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-label'] {
  padding: 2px 8px !important;
  color: color-mix(in srgb, var(--claude-color-text) 50%, transparent) !important;
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-size: 10px !important;
  line-height: 14px !important;
  font-weight: 600 !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase !important;
}

html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-item'] {
  height: 28px !important;
  min-height: 28px !important;
  gap: 8px !important;
  padding: 0 8px !important;
  border-radius: 6px !important;
  color: color-mix(in srgb, var(--claude-color-text) 78%, transparent) !important;
  font-family: var(--font-sans, ${SYSTEM_FONT}) !important;
  font-size: 12px !important;
  line-height: 16px !important;
}

html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-item']:is(:hover,:focus,[data-highlighted]) {
  background: var(--claude-color-hover) !important;
  color: var(--claude-color-text) !important;
}

html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-item'] svg {
  width: 14px !important;
  height: 14px !important;
  color: color-mix(in srgb, var(--claude-color-text) 68%, transparent) !important;
}

html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-separator'] {
  margin: 4px !important;
  background: color-mix(in srgb, var(--claude-color-text) 8%, transparent) !important;
}

/* The slash completion drawer keeps Hermes' native groups, rows, icons and
   typography. Claude Skin owns only the reference frame and scrollbar paint. */
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer'] {
  right: 5px !important;
  left: 5px !important;
  width: auto !important;
  max-width: none !important;
  max-height: min(40vh, 360px) !important;
  padding: 4px !important;
  border: 0.5px solid var(--claude-color-border-subtle) !important;
  border-radius: 12px !important;
  background: var(--claude-color-card) !important;
  box-shadow: var(--shadow-nous) !important;
  backdrop-filter: none !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-track {
  margin-block: 8px !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-corner {
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-button {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-thumb {
  min-height: 24px !important;
  border: 2px solid transparent !important;
  border-radius: 999px !important;
  background: color-mix(in srgb, var(--claude-color-text) 22%, transparent) !important;
  background-clip: padding-box !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--claude-color-text) 36%, transparent) !important;
  background-clip: padding-box !important;
}

/* Keep the rear status card clear of the composer's rounded corner shoulders.
   The native dock is 10px wider than the visible composer, so a 26px dock
   inset produces a 21px visible step per side, flush with the 21px radius. The
   vertical seam stays flush so Queue is never hidden behind the composer. */
html[data-claude-chat-look='true'] :is([data-slot='composer-root'], [data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full {
  right: 26px !important;
  bottom: 100% !important;
  left: 26px !important;
  z-index: 3 !important;
  width: auto !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  filter: none !important;
  transform: none !important;
  backdrop-filter: none !important;
  overflow: visible auto !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] {
  position: relative !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  z-index: 3 !important;
  width: auto !important;
  margin-right: 26px !important;
  margin-bottom: 0 !important;
  margin-left: 26px !important;
  border: 0 !important;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  filter: none !important;
  transform: none !important;
  translate: none !important;
  backdrop-filter: none !important;
}

/* Session-control notices keep their native alert, text, icon and dismiss
   handler. Only the direct error row gets a Claude card; nested validation
   errors and notifications outside the composer retain their native style. */
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']
  [data-slot='status-stack-section'] > [role='alert']:has(> div > .codicon-error) {
  min-width: 0 !important;
  margin: 8px !important;
  padding: 8px 10px !important;
  gap: 10px !important;
  align-items: flex-start !important;
  border: 1px solid color-mix(in srgb, var(--claude-color-destructive) 18%, var(--claude-color-border-subtle)) !important;
  border-radius: 12px !important;
  background: var(--claude-color-card) !important;
  color: var(--claude-color-text) !important;
  font-size: 12px !important;
  line-height: 20px !important;
}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']
  [data-slot='status-stack-section'] > [role='alert'][data-claude-has~="child-div-codicon-error"] > div {
  flex: 1 !important;
  min-width: 0 !important;
  align-items: flex-start !important;
  gap: 8px !important;
  white-space: normal !important;
  overflow: visible !important;
}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']
  [data-slot='status-stack-section'] > [role='alert'][data-claude-has~="child-div-codicon-error"] > div > span {
  min-width: 0 !important;
  white-space: normal !important;
  overflow-wrap: anywhere !important;
  overflow: visible !important;
  text-overflow: clip !important;
}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']
  [data-slot='status-stack-section'] > [role='alert'] > div > .codicon-error {
  color: var(--claude-color-destructive) !important;
}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']
  [data-slot='status-stack-section'] > [role='alert'][data-claude-has~="child-div-codicon-error"] > button {
  border-radius: 999px !important;
  color: var(--claude-color-text-secondary) !important;
}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']
  [data-slot='status-stack-section'] > [role='alert'][data-claude-has~="child-div-codicon-error"] > button:hover {
  background: var(--claude-color-hover) !important;
}

/* Current Hermes separates frame, scroll owner and content. Paint the content,
   clip at the frame's radius, and retain the native scroll owner's constraints. */
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] > div:has(> [data-slot='status-stack-scroll']) {
  margin: 0 26px !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 20px 20px 0 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

html[data-claude-chat-look='true'] [data-slot='status-stack-scroll'] {
  scrollbar-width: thin !important;
  scrollbar-color: transparent transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='status-stack-scroll']:hover {
  scrollbar-color: color-mix(in srgb, var(--claude-color-text) 22%, transparent) transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-status-stack'][data-claude-has-task-section='true'] [data-slot='status-stack-scroll'] {
  display: flex !important;
  min-height: 0 !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

/* The scroll owner wraps the rounded card, so an opaque native gutter paints a
   square outside the top-right radius on long task lists. Keep the native scroll
   behavior, but make its track/buttons transparent and reveal only a quiet thumb. */
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] {
  scrollbar-width: thin !important;
  scrollbar-color: transparent transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar-track,
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar-corner {
  background: transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar-button {
  display: none !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar-thumb {
  min-height: 28px !important;
  border: 2px solid transparent !important;
  border-radius: 999px !important;
  background: transparent !important;
  background-clip: padding-box !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-status-stack']:hover {
  scrollbar-color: color-mix(in srgb, var(--claude-color-text) 22%, transparent) transparent !important;
}

html[data-claude-chat-look='true'] [data-slot='composer-status-stack']:hover::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--claude-color-text) 22%, transparent) !important;
}

/* Keep sibling status groups visible. The shared stack stops scrolling when a
   Tasks section exists; only the expanded Tasks body receives the overflow. */
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'][data-claude-has-task-section='true'] {
  overflow: hidden !important;
}

html[data-claude-chat-look='true'] [data-claude-status-card='true']:has([data-claude-task-section='true']) {
  display: flex !important;
  min-height: 0 !important;
  max-height: 40vh !important;
  flex-direction: column !important;
}

html[data-claude-chat-look='true'] [data-claude-status-card='true'][data-claude-has~="claude-task-section-true"] > div:not([data-claude-task-section='true']) {
  flex: 0 0 auto !important;
}

html[data-claude-chat-look='true'] [data-claude-task-section='true'] {
  display: flex !important;
  min-height: 0 !important;
  flex: 0 1 auto !important;
  overflow: hidden !important;
}

html[data-claude-chat-look='true'] [data-claude-task-section='true'] > div {
  display: flex !important;
  width: 100% !important;
  min-height: 0 !important;
  flex-direction: column !important;
}

html[data-claude-chat-look='true'] [data-claude-task-section='true'] > div > div:first-child {
  flex: 0 0 auto !important;
}

html[data-claude-chat-look='true'] [data-claude-task-section='true'] > div > div:nth-child(2) {
  min-height: 0 !important;
  flex: 1 1 auto !important;
  overflow-y: auto !important;
  overscroll-behavior: contain;
  scrollbar-width: thin !important;
  scrollbar-color: transparent transparent !important;
}

html[data-claude-chat-look='true'] [data-claude-task-section='true'] > div > div:nth-child(2):hover {
  scrollbar-color: color-mix(in srgb, var(--claude-color-text) 22%, transparent) transparent !important;
}

html[data-claude-chat-look='true'] [data-claude-status-card='true'],
html[data-claude-chat-look='true'] :is([data-slot='composer-root'], [data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child,
html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child {
  margin: 0 !important;
  padding: 4px 8px 2px !important;
  border: 0 none transparent !important;
  border-radius: 20px 20px 0 0 !important;
  background: var(--claude-color-status-panel) !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  overflow: hidden !important;
}

html[data-claude-chat-look='true'] [data-claude-status-card='true'] > div + div,
html[data-claude-chat-look='true'] :is([data-slot='composer-root'], [data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child > div + div,
html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child > div + div {
  border-top: 0 !important;
}

html[data-claude-chat-look='true'] [data-claude-status-card='true'] button,
html[data-claude-chat-look='true'] :is([data-slot='composer-root'], [data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child button,
html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child button {
  border-radius: 12px !important;
  color: color-mix(in srgb, var(--claude-color-text) 68%, transparent) !important;
}

html[data-claude-chat-look='true'] [data-claude-status-card='true'] button:hover,
html[data-claude-chat-look='true'] :is([data-slot='composer-root'], [data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child button:hover,
html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child button:hover {
  color: var(--claude-color-text) !important;
}

html[data-claude-chat-look='true'] [data-claude-status-card='true'] [class~='group/status-row'],
html[data-claude-chat-look='true'] :is([data-slot='composer-root'], [data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child [class~='group/status-row'],
html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child [class~='group/status-row'] {
  min-height: 24px !important;
  gap: 6px !important;
  padding: 1px 8px !important;
  border-radius: 8px !important;
}

/* Artifact rows are single-line. Center the native grid's dismiss/icon/text
   within our taller compact row, without changing multiline status rows. */
html[data-claude-chat-look='true'] [data-claude-status-card='true'] .status-artifacts > [data-slot='status-row'] {
  align-items: center !important;
}

/* Queue actions center on the complete row, including attachment/editing
   metadata. Leave other status rows and leading dismiss/icons first-line aligned. */
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']
  [data-slot='status-row'][data-claude-has~="child-status-row-icon-codicon-comment"] > .status-row-actions {
  align-self: center !important;
}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']
  [data-slot='status-row'][data-claude-has~="child-status-row-icon-codicon-comment"] > .status-row-actions > button {
  margin-top: 0 !important;
}

html[data-claude-chat-look='true'] [data-slot='aui_intro'] [aria-label='HERMES AGENT'] {
  color: var(--claude-color-text) !important;
  mix-blend-mode: normal !important;
}

/* Shared pane tabs and browser chrome; controls and guest documents stay owned
   by Hermes. Exact sampled colors apply only to the Claude dark palette. */
html[data-claude-chat-look='true'] {
  --claude-browser-background: var(--ui-editor-surface-background);
  --claude-browser-tab: var(--ui-row-active-background);
  --claude-browser-address: var(--ui-control-background, var(--claude-color-card));
  --claude-browser-border: var(--ui-stroke-secondary);
  --claude-browser-divider: var(--ui-stroke-tertiary);
}

/* Native control reservations sit beside the tabstrip in its parent header. */
html[data-claude-chat-look='true'] [data-titlebar-cluster][data-claude-titlebar-aligned] {
  top: calc(var(--titlebar-controls-top, 5px) + var(--claude-titlebar-offset, 0px)) !important;
}


html[data-claude-chat-look='true'] [data-window-top] > [data-panel-header],
html[data-claude-chat-look='true'] [data-tree-group] > [data-panel-header]:has([data-zone-tabstrip]) {
  height: 48px !important;
  min-height: 48px !important;
}

/* Keep a single band even when the host chooses a second row. Its measured
   control gutters still reserve the buttons; overflowing tabs scroll natively. */
html[data-claude-chat-look='true'] [data-window-top] > [data-panel-header] [data-zone-tabstrip][class~='absolute'] {
  top: 0 !important;
  bottom: auto !important;
  left: var(--panel-titlebar-left, 0px) !important;
  right: var(--panel-titlebar-right, 0px) !important;
  -webkit-app-region: drag !important;
}

html[data-claude-chat-look='true'] [data-window-top] > [data-panel-header] > [data-window-drag-handle] {
  height: 48px !important;
}

/* A sibling drag rectangle must not overlap explicit no-drag tabs. Keep the
   native handle in the strip's top padding; pointer-events alone is not a
   boundary for Electron's native window dragging. */
html[data-claude-chat-look='true'] [data-window-top] > [data-panel-header][data-claude-has~="zone-tabstrip"] > [data-window-drag-handle] {
  position: absolute !important;
  inset: 0 0 auto !important;
  height: 10px !important;
  pointer-events: none;
}

/* Page controls start at the shell's actual titlebar padding (currently 0px
   plus 0.5rem), not Electron's 34px constant. Keep the native drag rectangle
   above their hit areas; a cached hidden page must not shorten the chat band. */
html[data-claude-chat-look='true'] [data-tree-group='grp-main'][data-window-top][data-claude-has~="tour-page-tabs-not-pane-hidden"] > [data-panel-header]:not([data-claude-has~="zone-tabstrip"]) > [data-window-drag-handle] {
  height: min(48px, calc(var(--titlebar-height, 0px) + 0.5rem)) !important;
}

html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) > [data-panel-header]:has([data-zone-tabstrip]) {
  background: var(--claude-browser-background) !important;
}

html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] {
  --pane-tab-active-accent: transparent;
  --pane-tab-active-bg: var(--claude-browser-tab);
  height: 48px !important;
  min-height: 48px !important;
  box-sizing: border-box !important;
  padding: 10px 8px !important;
  gap: 4px !important;
  border: 0 !important;
  background: var(--claude-browser-background) !important;
  box-shadow: none !important;
}

html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] > [role='tablist'] {
  align-items: center !important;
  gap: 4px !important;
}

html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [role='tab'] {
  --tab-bg: var(--claude-browser-background);
  --tab-face: var(--claude-browser-background);
  height: 28px !important;
  min-height: 28px !important;
  border-radius: 10px !important;
  border: 0 !important;
  box-shadow: none !important;
  overflow: hidden !important;
}

html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [role='tab']:is([aria-selected='true'], [data-active='true']) {
  --tab-bg: var(--claude-browser-tab);
  --tab-face: var(--claude-browser-tab);
  background: var(--claude-browser-tab) !important;
  color: var(--ui-text-primary) !important;
}

/* Only PaneTabLabel text: preserve glyphs, dirty dots and close controls. */
html[data-claude-chat-look='true'] [data-tree-group] [data-zone-tabstrip] [role='tab'] > :is(span, button) > span.truncate,
html[data-claude-chat-look='true'] [data-tree-group] [data-zone-tabstrip] [role='tab'] > .pane-tab-content > :is(span, button) > span.truncate {
  font-size: 12px !important;
  font-weight: 400 !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}

/* Keep the close control readable without a dark runway or button block. */
html[data-claude-chat-look='true']
  [data-tree-group]:not([data-tree-group='grp-sessions'])
  [data-zone-tabstrip]
  [role='tab']
  > span:last-child[data-claude-has~="child-button-label"]
  > [aria-hidden],
html[data-claude-chat-look='true']
  [data-tree-group]:not([data-tree-group='grp-sessions'])
  [data-zone-tabstrip]
  [role='tab']
  > span:last-child[data-claude-has~="child-button-label"]
  > button[aria-label] {
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

/* The skin's 28px pill reserves a real title-free close area. Keep native
   close handlers and hover visibility; only its geometry and paint change. */
html[data-claude-chat-look='true']
  [data-tree-group]:not([data-tree-group='grp-sessions'])
  [data-zone-tabstrip]
  [data-slot='pane-tab'][data-closeable]:not([data-vertical='true'])
  > .pane-tab-content {
  padding-inline-end: 28px !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}

html[data-claude-chat-look='true']
  [data-tree-group]:not([data-tree-group='grp-sessions'])
  [data-zone-tabstrip]
  [data-slot='pane-tab'][data-closeable]:not([data-vertical='true'])
  > span:last-child:has(> button[aria-label]) {
  inset: 4px 4px 4px auto !important;
  align-items: center !important;
}

html[data-claude-chat-look='true']
  [data-tree-group]:not([data-tree-group='grp-sessions'])
  [data-zone-tabstrip]
  [data-slot='pane-tab'][data-closeable]:not([data-vertical='true'])
  > span:last-child[data-claude-has~="child-button-label"]
  > button[aria-label] {
  width: 20px !important;
  height: 20px !important;
  padding: 0 !important;
  border-radius: 50% !important;
  background: color-mix(in srgb, var(--claude-color-text, var(--ui-text-primary)) 10%, transparent) !important;
}

html[data-claude-chat-look='true'] aside[data-preview-browser] {
  background: var(--claude-browser-background) !important;
  container-type: inline-size;
  container-name: claude-browser;
  --claude-browser-shadow-ink: var(--ui-text-primary);
  --claude-browser-shadow: 0 1px 2px color-mix(in srgb, var(--claude-browser-shadow-ink) 9%, transparent),
    0 2px 6px color-mix(in srgb, var(--claude-browser-shadow-ink) 7%, transparent);
}

/* Keep custom-theme controls in the same color family as their backdrop. */
html[data-claude-chat-look='true']:not([data-hermes-theme='claude-chat']) aside[data-preview-browser] {
  --claude-browser-address: color-mix(in srgb, var(--claude-browser-background) 97%, var(--ui-text-primary));
  --claude-browser-border: color-mix(in srgb, var(--ui-text-primary) 10%, var(--claude-browser-address));
}

html[data-claude-chat-look='true'][data-hermes-mode='dark'] aside[data-preview-browser] {
  --claude-browser-shadow-ink: var(--theme-background-seed, var(--claude-browser-background));
}

/* Claude Code's browser bar: back, forward and reload, the address across
   the card, and the element picker (Hermes' Annotate) after it. Copy URL,
   pop-out, console and DevTools leave the bar for the card's header and its
   ⋮ menu (installClaudeTerminalHeader); Hermes' buttons stay in the DOM as
   the doors those use. */
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] {
  position: relative !important;
  height: 36px !important;
  min-height: 36px !important;
  flex: 0 0 auto !important;
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  box-sizing: border-box !important;
  padding: 0 8px 0 9px !important;
  gap: 2px !important;
  border: 0 !important;
  border-bottom: 1px solid var(--claude-browser-divider) !important;
  border-radius: 0 !important;
  background: var(--claude-browser-background) !important;
  box-shadow: none !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] button:is([aria-label='Copy URL'], [aria-label='Pop out'], [aria-label='Pop in'], [aria-label='Open in browser'], [aria-label$='preview console'], [aria-label$='preview DevTools'], [aria-label='Close']) {
  display: none !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button {
  width: 24px !important;
  min-width: 24px !important;
  height: 24px !important;
  min-height: 24px !important;
  flex-shrink: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 6px !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--claude-color-text-secondary, var(--ui-text-secondary)) !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button:disabled {
  opacity: .45 !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button:is(:hover, :focus-visible):not(:disabled),
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button[aria-pressed='true'] {
  background: var(--ui-row-hover-background) !important;
  color: var(--ui-text-primary) !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button > svg {
  width: 16px !important;
  height: 16px !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > div:has(> input[data-slot='input']) {
  min-width: 60px !important;
  flex: 1 1 auto !important;
  margin: 0 4px 0 8px !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input'] {
  width: 100% !important;
  height: 24px !important;
  min-height: 24px !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 8px !important;
  border-width: 1px !important;
  border-style: solid !important;
  border-radius: 6px !important;
  background: var(--claude-browser-address) !important;
  box-shadow: none !important;
  color: var(--ui-text-primary) !important;
  font-size: 13px !important;
  line-height: 22px !important;
}
/* Hermes' invalid-address red stays; so does the loading icon's gutter. */
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']:not([aria-invalid='true']) {
  border-color: var(--claude-browser-border) !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input'].pl-6 {
  padding-left: 24px !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']::placeholder {
  color: var(--claude-color-text-tertiary, var(--ui-text-tertiary)) !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']:focus-visible {
  outline: 0 !important;
  border-color: var(--claude-color-text-tertiary, var(--ui-text-tertiary)) !important;
}
/* A blank page reads as an empty address ("Type a URL"), as in Claude. */
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input'][value='about:blank']:not(:focus) {
  color: transparent !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > div:has(> input[data-slot='input'][value='about:blank']:not(:focus))::before {
  content: 'Type a URL';
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--claude-color-text-tertiary, var(--ui-text-tertiary));
  font-size: 13px;
  pointer-events: none;
}
/* Annotate is Claude's element picker: an arrow pointer. */
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button[aria-label='Annotate'] > :is(svg, i) {
  display: none !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button[aria-label='Annotate']::before {
  content: '';
  display: block;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.25' stroke-linejoin='round'%3E%3Cpath d='M3.75 2.75 12.5 6.6 8.9 7.8l3.35 3.35-1.35 1.35L7.55 9.15l-1.2 3.6z'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.25' stroke-linejoin='round'%3E%3Cpath d='M3.75 2.75 12.5 6.6 8.9 7.8l3.35 3.35-1.35 1.35L7.55 9.15l-1.2 3.6z'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
}
/* Claude's annotate (installClaudeBrowserAnnotate): the picker lit while on,
   and the floating toolbar over the page with its menus opening upward. */
html[data-claude-chat-look='true'] aside[data-preview-browser][data-claude-annotating]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button[aria-label='Annotate'] {
  background: var(--claude-pane-active) !important;
  color: var(--claude-pane-active-glyph) !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser][data-claude-annotating] {
  position: relative;
}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] {
  position: absolute;
  left: 50%;
  bottom: 14px;
  z-index: 30;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--claude-color-border, var(--ui-stroke-tertiary));
  border-radius: 10px;
  background: var(--claude-color-elevated, var(--ui-editor-surface-background));
  box-shadow: 0 6px 20px color-mix(in srgb, black 30%, transparent);
  -webkit-app-region: no-drag;
  white-space: nowrap;
}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 28px;
  min-width: 28px;
  padding: 0 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--claude-color-text-secondary, var(--ui-text-secondary));
  cursor: pointer;
}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] [hidden] {
  display: none !important;
}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] > button:is(:hover, [aria-expanded='true']):not(:disabled) {
  background: var(--ui-row-hover-background);
  color: var(--ui-text-primary);
}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] > button[aria-pressed='true'] {
  background: var(--claude-pane-active);
  color: var(--claude-pane-active-glyph);
}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
html[data-claude-chat-look='true'] [data-claude-annotate-split] {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
html[data-claude-chat-look='true'] [data-claude-annotate-split] > span {
  display: inline-flex;
}
html[data-claude-chat-look='true'] [data-claude-annotate-split] > svg:last-child {
  width: 12px;
  height: 12px;
  flex-basis: 12px;
}
html[data-claude-chat-look='true'] [data-claude-annotate-sep] {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--claude-color-border-subtle, var(--ui-stroke-quaternary));
}
html[data-claude-chat-look='true'] [data-claude-annotate-dot] {
  display: inline-block;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--ui-text-primary) 30%, transparent);
  border-radius: 50%;
}
html[data-claude-chat-look='true'] [data-claude-annotate-stroke] {
  display: inline-block;
  width: 20px;
  min-height: 1px;
  border-radius: 4px;
  background: var(--ui-text-primary);
}
html[data-claude-chat-look='true'] [data-claude-annotate-add] {
  height: 26px;
  margin-left: 4px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: color-mix(in srgb, var(--ui-text-primary) 16%, transparent);
  color: var(--ui-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
html[data-claude-chat-look='true'] [data-claude-annotate-add]:disabled {
  opacity: .5;
  cursor: default;
}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] {
  position: absolute;
  bottom: calc(100% + 6px);
  display: flex;
  flex-direction: column;
  min-width: 150px;
  padding: 4px;
  border: 1px solid var(--claude-color-border, var(--ui-stroke-tertiary));
  border-radius: 10px;
  background: var(--claude-color-elevated, var(--ui-editor-surface-background));
  box-shadow: 0 6px 20px color-mix(in srgb, black 30%, transparent);
}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] > button {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ui-text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] > button:hover {
  background: var(--ui-row-hover-background);
}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] > button > svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] [data-claude-annotate-dot] {
  width: 18px;
  height: 18px;
}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] [data-claude-annotate-stroke] {
  width: 26px;
}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] [data-claude-annotate-check] {
  width: 14px;
  height: 14px;
  flex-basis: 14px;
  margin-left: auto;
  color: var(--claude-pane-active-glyph);
  visibility: hidden;
}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] > button[aria-checked='true'] [data-claude-annotate-check] {
  visibility: visible;
}
/* Claude's empty browser: a globe, "Browse with Hermes" and what it can do. */
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] {
  gap: 0 !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] > i.codicon-globe {
  font-size: 22px !important;
  width: 22px !important;
  height: 22px !important;
  margin-bottom: 14px;
  color: var(--claude-color-text-tertiary, var(--ui-text-tertiary)) !important;
  opacity: 1 !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] > p {
  max-width: 320px !important;
  font-size: 0 !important;
  line-height: 0 !important;
  text-align: center !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] > p::before {
  content: 'Browse with Hermes';
  display: block;
  margin-bottom: 6px;
  color: var(--ui-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] > p::after {
  content: 'Type a URL or ask Hermes to open a site. Hermes can read, click, and type.';
  display: block;
  color: var(--claude-color-text-secondary, var(--ui-text-secondary));
  font-size: 13px;
  line-height: 19px;
}
/* A viewport picked in the ⋮ menu: the page at that size, centred, the
   card scrolling around it. */
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser)[data-claude-viewport] div:has(> webview) {
  justify-content: center !important;
  align-items: flex-start !important;
  overflow: auto !important;
  background: var(--claude-browser-backdrop, var(--claude-browser-background)) !important;
}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser)[data-claude-viewport] webview {
  flex: 0 0 var(--claude-viewport-width) !important;
  width: var(--claude-viewport-width) !important;
  min-width: var(--claude-viewport-width) !important;
  height: var(--claude-viewport-height) !important;
  min-height: var(--claude-viewport-height) !important;
}
/* The browser card's header: the tab as plain text ("New tab" on a blank
   page), +, and Claude's actions in place of Hermes' Hide. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] > [data-panel-header]:has(> [data-claude-browser-strip]:not(#claude-browser)) {
  height: 32px !important;
  min-height: 32px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip][data-claude-browser-strip]:not(#claude-browser) {
  height: 32px !important;
  min-height: 32px !important;
  align-items: center !important;
  padding: 0 8px 0 4px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) > button[aria-label='Hide'] {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] {
  height: 24px !important;
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] .pane-tab-content > span:first-child {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] span.truncate {
  color: var(--claude-color-text-secondary, var(--ui-text-secondary)) !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  letter-spacing: 0 !important;
}
/* Plain text, as Claude's: no room kept for the close button (it floats in
   over the label's end on hover). */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] .pane-tab-content,
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] .pane-tab-content > span {
  width: auto !important;
  min-width: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] .pane-tab-content {
  padding: 0 6px 0 8px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) button[aria-label='New tab'],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) button[aria-label='New tab'] > i {
  color: var(--ui-text-primary) !important;
  opacity: 1 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'][aria-selected='true'] span.truncate {
  color: var(--ui-text-primary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-claude-blank] span.truncate {
  font-size: 0 !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-claude-blank] span.truncate::after {
  content: 'New tab';
  font-size: 13px;
}
/* Many tabs share the row as Claude's do: each shrinks, its label clipped,
   rather than the row scrolling. The current tab is a pill with its ×; any
   other tab shows its × on hover, the label fading out under it. */
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) > [role='tablist'] {
  align-items: center !important;
  gap: 2px !important;
  overflow: hidden !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] {
  position: relative !important;
  flex: 0 1 auto !important;
  min-width: 26px !important;
  max-width: 180px !important;
  border-radius: 6px !important;
  overflow: hidden !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] span.truncate {
  text-overflow: clip !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'][aria-selected='true'] {
  background: var(--claude-color-active, var(--ui-row-active-background)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'][aria-selected='true'] .pane-tab-content {
  padding-right: 28px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] > span:has(> button[aria-label='Close']) {
  right: 3px !important;
  width: 22px !important;
  justify-content: center !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:']:is([aria-selected='true'], :hover, :focus-within) > span:has(> button[aria-label='Close']) {
  opacity: 1 !important;
  pointer-events: auto !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close'] {
  width: 22px !important;
  background: transparent !important;
  border-radius: 0 !important;
  color: var(--claude-color-text-secondary, var(--ui-text-secondary)) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close']:hover {
  color: var(--ui-text-primary) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) button[aria-label='New tab'][data-claude-tab-limit],
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) button[aria-label='New tab'][data-claude-tab-limit] > i {
  color: var(--claude-color-text-tertiary, var(--ui-text-tertiary)) !important;
  background: transparent !important;
  cursor: default !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-limit-tip] {
  position: fixed;
  z-index: 2147483000;
  max-width: 220px;
  padding: 6px 9px;
  border-radius: 8px;
  border: 1px solid var(--claude-color-border, var(--ui-stroke-tertiary));
  background: var(--claude-color-elevated, var(--ui-editor-surface-background));
  color: var(--ui-text-primary);
  font-size: 13px;
  line-height: 1.35;
  pointer-events: none;
  box-shadow: 0 4px 14px color-mix(in srgb, black 25%, transparent);
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-limit-tip][hidden] {
  display: none;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close'] > i {
  font-size: 14px !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:']:not([aria-selected='true']):is(:hover, :focus-within) .pane-tab-content {
  -webkit-mask-image: linear-gradient(to left, transparent 25px, black 36px) !important;
  mask-image: linear-gradient(to left, transparent 25px, black 36px) !important;
}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='browser-actions'] {
  /* The card's header is the window's drag band; buttons there must opt out
     or the window manager takes the click. */
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
}
/* Expanded, the browser card takes the workspace right of the session list,
   as the terminal and Files cards do. */
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='browser'] [data-tree-split] > div:not([data-claude-preview-column]):not(:has([data-tree-group='grp-sessions'])) {
  display: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='browser'] [data-tree-split] > [data-claude-preview-column] {
  flex: 1 1 0% !important;
  max-width: none !important;
}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='browser'] [data-claude-pane-tools] {
  visibility: hidden !important;
}


/* Paint the reference hairlines without narrowing native resize hit targets. */
html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div > [role='separator'][class~='inset-y-0'] {
  --claude-split-scale: .25;
  --claude-split-color: var(--claude-sidebar-divider, var(--ui-stroke-secondary));
}
html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-aside-preview-browser"] > [role='separator'][class~='inset-y-0'] {
  --claude-split-scale: .5;
  --claude-split-color: var(--claude-browser-divider);
}
html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div > [role='separator'][class~='inset-y-0'] > span:first-child,
html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-aside-preview-browser"] > [role='separator'][class~='inset-y-0'] > span:first-child {
  width: 1px !important;
  left: 1px !important;
  transform: scaleX(var(--claude-split-scale)) !important;
  transform-origin: left center !important;
  opacity: 1 !important;
  background: var(--claude-split-color) !important;
}
html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none'])
  + div > [role='separator'][class~='inset-y-0'] > span:nth-child(2),
html[data-claude-chat-look='true'] [data-tree-split]
  > div[data-claude-has~="child-tree-group-aside-preview-browser"] > [role='separator'][class~='inset-y-0'] > span:nth-child(2) {
  opacity: 0 !important;
}

`

function safeGet(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    // Storage can be unavailable in hardened/ephemeral renderer contexts.
    return false
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in hardened/ephemeral renderer contexts.
  }
}

function profileScope(value) {
  return String(value || 'default')
}

function currentProfileScope() {
  try {
    return profileScope(host.state.profile.get())
  } catch {
    return 'default'
  }
}

function currentRuntimeSessionId() {
  try {
    return String(host.state.activeSessionId.get() || '')
  } catch {
    return ''
  }
}

function routedStoredSessionId() {
  return storedSessionIdFromHash(window.location.hash)
}

function storedSessionIdFromHash(hash) {
  try {
    const raw = String(hash || '').match(/^#\/([^/?#]+)/)?.[1] || ''
    if (!raw) return ''
    const decoded = decodeURIComponent(raw)
    const reserved = new Set(['agents', 'command-center', 'cron', 'new', 'profiles', 'settings', 'starmap'])
    return reserved.has(decoded) ? '' : decoded
  } catch {
    return ''
  }
}

function isProvisionalTurn(pair) {
  const messageId = pair.querySelector(':scope > [data-role="user"]')?.getAttribute('data-message-id') || ''
  return !messageId || /^user-(?:inflight|queued|pending)(?:-|$)/i.test(messageId)
}

function currentTurnScope() {
  return { profile: currentProfileScope(), routeId: routedStoredSessionId() }
}

function turnStorageKey(pair) {
  const user = pair.querySelector(':scope > [data-role="user"]')
  if (!user || isProvisionalTurn(pair)) return null
  const messageId = userMessageId(pair)
  if (!messageId) return null
  const scope = currentTurnScope()
  const sessionId = scope.routeId || currentRuntimeSessionId()
  if (!sessionId) return null
  const profile = encodeURIComponent(scope.profile)
  const session = encodeURIComponent(sessionId)
  return `${STORAGE_PREFIX}${profile}:${session}:${encodeURIComponent(messageId)}`
}

function userMessageId(pair) {
  return pair.querySelector(':scope > [data-role="user"]')?.getAttribute('data-message-id') || ''
}

const IMAGE_ATTACHMENT_MARKER_RE = /(?:^|\n)[ \t]*\[Image attached at:\s*[^\]\r\n]+\][ \t]*(?=\n|$)|\[Image attached at:\s*[^\]\r\n]+\]/gi

function hasRenderedImageAttachment(user) {
  const attachmentRow = user?.nextElementSibling
  if (!attachmentRow || attachmentRow.matches('[data-role="assistant"], [data-role="user"]')) return false
  return Boolean(
    attachmentRow.querySelector(
      'img[slot="aui_directive-image"], img[slot="aui_embedded-image"], [data-slot="aui_embedded-images"] img'
    )
  )
}

function stripImageAttachmentMarker(pair) {
  const user = pair.querySelector(':scope > [data-role="user"]')
  const messageText = user?.querySelector('[data-slot="aui_user-message-text"]')
  if (!user || !messageText || !hasRenderedImageAttachment(user)) return

  const walker = document.createTreeWalker(messageText, NodeFilter.SHOW_TEXT)
  const textNodes = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)

  for (const node of textNodes) {
    if (node.parentElement?.closest('code, pre, [data-claude-image-marker]')) continue
    const current = node.nodeValue || ''
    const matches = [...current.matchAll(new RegExp(IMAGE_ATTACHMENT_MARKER_RE.source, IMAGE_ATTACHMENT_MARKER_RE.flags))]
    for (const match of matches.reverse()) {
      const marker = node.splitText(match.index)
      marker.splitText(match[0].length)
      const wrapper = document.createElement('span')
      wrapper.setAttribute('data-claude-image-marker', 'true')
      marker.replaceWith(wrapper)
      wrapper.appendChild(marker)
    }
  }
}

function clearImageAttachmentMarkers() {
  for (const wrapper of document.querySelectorAll('[data-claude-image-marker]')) {
    wrapper.replaceWith(...wrapper.childNodes)
  }
}

function longUserStateKey(pair) {
  if (isProvisionalTurn(pair)) return null
  const key = turnStorageKey(pair)
  return key ? `${key}${LONG_USER_STATE_SUFFIX}` : null
}

function readLongUserExpanded(pair) {
  const key = longUserStateKey(pair)
  if (!key) return false
  try {
    return JSON.parse(safeGet(key) || 'null')?.expanded === true
  } catch {
    return false
  }
}

function pruneLongUserStates() {
  try {
    const records = Object.keys(window.localStorage)
      .filter(key => key.startsWith(STORAGE_PREFIX) && key.endsWith(LONG_USER_STATE_SUFFIX))
      .map(key => {
        try {
          return { key, touchedAt: Number(JSON.parse(safeGet(key) || '{}').touchedAt) || 0 }
        } catch {
          return { key, touchedAt: 0 }
        }
      })
      .sort((left, right) => right.touchedAt - left.touchedAt)
    for (const record of records.slice(MAX_PERSISTED_LONG_USER_STATES)) safeRemove(record.key)
  } catch {
    // Ignore unavailable storage; the mounted message remains functional.
  }
}

function writeLongUserExpanded(pair, expanded) {
  const key = longUserStateKey(pair)
  if (!key) return
  if (!expanded) {
    safeRemove(key)
    return
  }
  safeSet(key, JSON.stringify({ expanded: true, touchedAt: Date.now() }))
  pruneLongUserStates()
}

function clearLongUserDecoration(user) {
  user?.removeAttribute('data-claude-long-user')
  user?.removeAttribute('data-claude-user-expanded')
  for (const control of user?.querySelectorAll?.('[data-claude-user-expand]') || []) control.remove()
}

function longUserLabels() {
  return { more: 'Show more', less: 'Show less' }
}

function decorateLongUserMessage(pair) {
  const user = pair.querySelector(':scope > [data-role="user"]')
  const clamp = user?.querySelector('.sticky-human-clamp')
  const bubble = clamp?.closest('.composer-human-message')
  const host = bubble?.parentElement
  if (!user || !clamp || !bubble || !host) {
    if (user) clearLongUserDecoration(user)
    return
  }

  const inner = clamp.firstElementChild
  const lineHeight = 22
  const measuredHeight = Number.parseFloat(clamp.style.getPropertyValue('--human-msg-full'))
  const fullHeight = Number.isFinite(measuredHeight) && measuredHeight > 0 ? measuredHeight : inner?.scrollHeight || 0
  if (fullHeight <= lineHeight * 4 + 1) {
    clearLongUserDecoration(user)
    return
  }

  user.setAttribute('data-claude-long-user', 'true')
  let control = host.querySelector(':scope > [data-claude-user-expand]')
  let persistedExpanded = false
  if (!control) {
    persistedExpanded = readLongUserExpanded(pair)
    control = document.createElement('button')
    control.type = 'button'
    control.setAttribute('data-claude-user-expand', 'true')
    const label = document.createElement('span')
    label.setAttribute('data-claude-user-expand-label', 'true')
    const chevron = document.createElement('span')
    chevron.setAttribute('data-claude-user-chevron', 'true')
    chevron.setAttribute('aria-hidden', 'true')
    control.append(label, chevron)
    control.addEventListener('pointerdown', event => event.stopPropagation())
    control.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      const expanded = user.getAttribute('data-claude-user-expanded') !== 'true'
      if (expanded) user.setAttribute('data-claude-user-expanded', 'true')
      else user.removeAttribute('data-claude-user-expanded')
      writeLongUserExpanded(pair, expanded)
      const labels = longUserLabels()
      label.textContent = expanded ? labels.less : labels.more
      control.setAttribute('aria-expanded', String(expanded))
      control.title = expanded ? labels.less : labels.more
    })
    host.appendChild(control)
  }

  const expanded = user.getAttribute('data-claude-user-expanded') === 'true' || persistedExpanded
  if (expanded) user.setAttribute('data-claude-user-expanded', 'true')
  else user.removeAttribute('data-claude-user-expanded')
  const labels = longUserLabels()
  control.querySelector('[data-claude-user-expand-label]').textContent = expanded ? labels.less : labels.more
  control.setAttribute('aria-expanded', String(expanded))
  control.title = expanded ? labels.less : labels.more
}

function decorateComposerChrome() {
  const surface = document.querySelector('[data-slot="composer-surface"]')
  const dock = document.querySelector('[data-slot="composer-dock"]') || surface?.closest('[data-slot="composer-root"]')
  if (!surface || !dock) return

  // Decorate every mounted composer independently, including split chat panes.
  for (const statusDock of document.querySelectorAll('[data-slot="composer-dock"], [data-slot="composer-root"]')) {
    // Native drawers may wrap the stack; keep discovery owned by this composer.
    const nativeStatusStack = [...statusDock.querySelectorAll('[data-slot="composer-status-stack"]')]
      .find(stack => stack.closest('[data-slot="composer-dock"], [data-slot="composer-root"]') === statusDock)
      || (statusDock.matches('[data-slot="composer-root"]')
        ? statusDock.querySelector(':scope > div.absolute.inset-x-0.bottom-full')
        : [...statusDock.children].find(element => {
            const className = typeof element.className === 'string' ? element.className : ''
            return className.includes('max-h-') && className.includes('overflow-y-auto')
          }))
    const statusStack = nativeStatusStack || [...statusDock.querySelectorAll('div')].find(element => {
      const className = typeof element.className === 'string' ? element.className : ''
      return className.includes('bottom-full') && className.includes('absolute') && element.getBoundingClientRect().width > 300
    })
    if (!statusStack) continue
    const statusCard = statusStack.querySelector('[data-slot="status-stack-content"]') || statusStack.firstElementChild
    statusCard?.setAttribute('data-claude-status-card', 'true')
    const taskSection = statusCard
      ? [...statusCard.querySelectorAll(':scope > div')].find(section => section.querySelector('.codicon-checklist'))
      : null
    for (const section of statusCard?.querySelectorAll(':scope > div') || []) {
      if (section === taskSection) section.setAttribute('data-claude-task-section', 'true')
      else section.removeAttribute('data-claude-task-section')
    }
    if (taskSection) statusStack.setAttribute('data-claude-has-task-section', 'true')
    else statusStack.removeAttribute('data-claude-has-task-section')
    taskSection?.setAttribute('data-claude-task-section', 'true')
  }
  const editBanner = [...surface.querySelectorAll('[data-slot="composer-fade"] > div')].find(element =>
    element.matches('.flex.items-center.justify-between.gap-2.rounded-lg.border')
    && element.querySelectorAll(':scope > div:last-child > button').length === 2
  )
  editBanner?.setAttribute('data-claude-edit-banner', 'true')

  const contextMenu = [...document.querySelectorAll('[data-slot="dropdown-menu-content"][role="menu"]')].find(menu => {
    const text = menu.textContent || ''
    return /Prompt snippets|Extraits de prompt/i.test(text) && /Files|Fichiers/i.test(text)
  })
  if (!contextMenu) return

  contextMenu.setAttribute('data-claude-context-menu', 'true')
}

function clearComposerChromeDecorations() {
  for (const element of document.querySelectorAll('[data-claude-context-menu], [data-claude-status-card], [data-claude-edit-banner], [data-claude-task-section], [data-claude-has-task-section]')) {
    element.removeAttribute('data-claude-context-menu')
    element.removeAttribute('data-claude-status-card')
    element.removeAttribute('data-claude-edit-banner')
    element.removeAttribute('data-claude-task-section')
    element.removeAttribute('data-claude-has-task-section')
  }
}

function readComposerWidthMode() {
  try {
    const mode = pluginStorage?.get(COMPOSER_WIDTH_STORAGE_KEY, 'claude')
    return typeof mode === 'string' && Object.hasOwn(COMPOSER_WIDTH_MODES, mode) ? mode : 'claude'
  } catch {
    return 'claude'
  }
}

function syncComposerWidthRoot() {
  const mode = readComposerWidthMode()
  const root = document.documentElement
  root.setAttribute('data-claude-composer-width', mode)
  return mode
}

function setComposerWidthMode(mode) {
  const normalized = typeof mode === 'string' && Object.hasOwn(COMPOSER_WIDTH_MODES, mode) ? mode : 'claude'
  pluginStorage?.set(COMPOSER_WIDTH_STORAGE_KEY, normalized)
  syncComposerWidthRoot()
  window.requestAnimationFrame(() => decorateComposerChrome())
}

function readPinnedUserMessagesMode() {
  try {
    const mode = pluginStorage?.get(PINNED_USER_MESSAGES_STORAGE_KEY, 'hermes')
    return mode === 'off' ? 'off' : 'hermes'
  } catch {
    return 'hermes'
  }
}

function syncPinnedUserMessagesRoot() {
  const mode = readPinnedUserMessagesMode()
  document.documentElement.setAttribute('data-claude-pinned-user-messages', mode)
  return mode
}

function setPinnedUserMessagesMode(mode) {
  const normalized = mode === 'off' ? 'off' : 'hermes'
  pluginStorage?.set(PINNED_USER_MESSAGES_STORAGE_KEY, normalized)
  syncPinnedUserMessagesRoot()
}

function readCleanTranscriptMode() {
  try {
    const mode = pluginStorage?.get(CLEAN_TRANSCRIPT_STORAGE_KEY, 'off')
    return mode === 'on' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

function syncCleanTranscriptRoot() {
  const mode = readCleanTranscriptMode()
  document.documentElement.setAttribute('data-claude-clean-transcript', mode)
  return mode
}

function setCleanTranscriptMode(mode) {
  const normalized = mode === 'on' ? 'on' : 'off'
  pluginStorage?.set(CLEAN_TRANSCRIPT_STORAGE_KEY, normalized)
  syncCleanTranscriptRoot()
  window.dispatchEvent(new window.Event(CLEAN_TRANSCRIPT_EVENT))
}

function clearCleanTranscriptDecorations(scope = document) {
  const pairs = scope?.matches?.('[data-slot="aui_turn-pair"]')
    ? [scope]
    : [...(scope?.querySelectorAll?.('[data-slot="aui_turn-pair"]') || [])]

  for (const pair of pairs) {
    pair.removeAttribute('data-claude-clean-settled')
    for (const element of pair.querySelectorAll('[data-claude-clean-interim], [data-claude-clean-interim-part]')) {
      element.removeAttribute('data-claude-clean-interim')
      element.removeAttribute('data-claude-clean-interim-part')
    }
  }
}

function cleanPairActive(pair) {
  return Boolean(
    pair.querySelector(
      '[data-role="assistant"][data-streaming="true"], '
      + '[role="status"], '
      + '[data-slot="tool-approval-inline"], '
      + '[data-slot="clarify-inline"], '
      + '[data-slot="mcp-setup-inline"]'
    )
  )
}

function cleanRootHasMeaningfulContent(root) {
  const content = root.querySelector('[data-slot="aui_assistant-message-content"]')
  if ((content?.textContent || '').trim()) return true
  if ((root.textContent || '').trim()) return true

  return Boolean(
    root.querySelector(
      '[data-slot="tool-block"], '
      + '[data-slot="aui_thinking-disclosure"], '
      + '[data-slot="aui_generated-image"], '
      + '[data-slot="aui_artifact-card"], '
      + '[data-slot="aui_changed-files"], '
      + '[data-slot="clarify-inline"], '
      + '[data-slot="mcp-setup-inline"], '
      + '[role="alert"]'
    )
  )
}

function cleanRootMustStayVisible(root) {
  return Boolean(
    root.querySelector(
      '[data-slot="aui_generated-image"], '
      + '[data-slot="aui_artifact-card"], '
      + '[data-slot="clarify-inline"], '
      + '[data-slot="mcp-setup-inline"], '
      + '[data-slot="tool-approval-inline"], '
      + '[role="alert"]'
    )
  )
}

function cleanPartMustStayVisible(part) {
  return Boolean(
    part.querySelector(
      '[data-slot="aui_generated-image"], '
      + '[data-slot="aui_artifact-card"], '
      + '[data-slot="aui_markdown-alert"], '
      + '[data-slot="aui_zoomable-image"], '
      + '[role="alert"], img, audio, video'
    )
  )
}

function reconcileCleanTranscript(pair) {
  clearCleanTranscriptDecorations(pair)
  if (document.documentElement.getAttribute('data-claude-clean-transcript') !== 'on') return
  if (cleanPairActive(pair)) return

  const roots = [...pair.querySelectorAll('[data-role="assistant"][data-slot="aui_assistant-message-root"]')]
    .filter(root => root.closest('[data-slot="aui_turn-pair"]') === pair)
  const finalIndex = roots.findLastIndex(root => Boolean(root.querySelector('[data-slot="aui_msg-actions"]')))
  if (finalIndex < 0) return

  /* An empty trailing shell is a harmless renderer remnant. Any actual content
     after the identified final is uncertain, so keep the whole turn visible. */
  if (roots.slice(finalIndex + 1).some(cleanRootHasMeaningfulContent)) return

  pair.setAttribute('data-claude-clean-settled', 'true')
  for (const root of roots.slice(0, finalIndex)) {
    if (!cleanRootMustStayVisible(root)) root.setAttribute('data-claude-clean-interim', 'true')
  }

  /* Hydrated history folds the live turn's separate assistant bubbles into one
     message containing several markdown parts. Keep the last text part as the
     final answer and hide earlier commentary plus its timestamp. */
  const finalRoot = roots[finalIndex]
  const content = finalRoot.querySelector(':scope > [data-slot="aui_assistant-message-content"]')
  const markdownParts = [...(content?.children || [])].filter(element => element.matches('.aui-md'))
  for (const part of markdownParts.slice(0, -1)) {
    if (cleanPartMustStayVisible(part)) continue
    part.setAttribute('data-claude-clean-interim-part', 'true')
    const timestamp = part.previousElementSibling
    if (timestamp?.matches?.('[data-slot="timeline-timestamp"]')) {
      timestamp.setAttribute('data-claude-clean-interim-part', 'true')
    }
  }
}

function collectNestedTurnPairs(node) {
  if (!(node instanceof Element)) return []
  if (node.matches('[data-slot="sidebar"]') || node.closest?.('[data-slot="sidebar"]')) return []
  if (node.matches('[data-slot="aui_turn-pair"]')) return [node]

  const pairs = []
  const descendants = [...node.children]
  for (let index = 0; index < descendants.length; index += 1) {
    const current = descendants[index]
    if (current.matches('[data-slot="aui_turn-pair"]')) {
      pairs.push(current)
      continue
    }
    descendants.push(...current.children)
  }
  return pairs
}

function isCleanPartMutationNode(node) {
  if (!(node instanceof Element)) return false
  const selector = '.aui-md, [data-slot="aui_assistant-message-content"]'
  return node.matches(selector) || Boolean(node.firstElementChild && node.querySelector(selector))
}

function isTurnPairMutationRoot(node) {
  if (!(node instanceof Element)) return false
  if (node.matches('[data-slot="sidebar"]') || node.closest?.('[data-slot="sidebar"]')) return false
  if (node.matches('[data-session-anchor], [data-slot="aui_turn-pair"], [data-slot="aui_thread-content"]')) return true

  const insideTranscript = node.closest?.('[data-session-anchor], [data-slot="aui_thread-content"]')
  return Boolean(insideTranscript && node.firstElementChild && node.querySelector('[data-slot="aui_turn-pair"]'))
}

// Keep preview markup inert: copy only text and a small formatting vocabulary,
// never message attributes, links, media, event handlers or tool-card controls.
function historyPreviewFragment(source) {
  const fragment = document.createDocumentFragment()
  let remaining = 600
  let visited = 0
  const copy = (node, parent) => {
    if (remaining <= 0 || ++visited > 160) return
    if (node.nodeType === 3) {
      const text = (node.nodeValue || '').slice(0, remaining)
      remaining -= text.length
      parent.appendChild(document.createTextNode(text))
      return
    }
    if (!(node instanceof Element) || node.matches('script, style, button, svg, img, video, audio, iframe, [aria-hidden="true"]')) return
    const tag = node.tagName.toLowerCase()
    const destination = ['p', 'strong', 'b', 'em', 'i', 'code', 'br'].includes(tag) ? document.createElement(tag) : parent
    if (destination !== parent) parent.appendChild(destination)
    for (const child of node.childNodes) copy(child, destination)
  }
  for (const child of source.childNodes) copy(child, fragment)
  if (!remaining) fragment.appendChild(document.createTextNode('…'))
  return fragment
}

function historyPromptPreview(text) {
  const collapsed = String(text || '').replace(/\s+/g, ' ').trim()
  return collapsed.length > 120 ? `${collapsed.slice(0, 119).trimEnd()}…` : collapsed
}

function historyTranscriptEntries(messages) {
  const entries = []
  let turn = null
  for (const message of messages || []) {
    if (typeof message?.text !== 'string') continue
    if (message.display_kind && message.display_kind !== 'skill_invocation') continue
    const text = message.text.trim()
    if (message.role === 'user') {
      if (!text || /^\[IMPORTANT: Background process [\s\S]*\]$/.test(text)) continue
      turn = { question: text, answer: '' }
      entries.push(turn)
    } else if (message.role === 'assistant' && turn && text) {
      turn.answer = text.slice(0, 600)
    }
  }
  return entries
}

function historyPlainFragment(text) {
  const fragment = document.createDocumentFragment()
  for (const paragraph of text.slice(0, 600).split(/\n\s*\n/).slice(0, 5)) {
    const p = document.createElement('p')
    // Tiny, inert emphasis support for RPC excerpts; no HTML/Markdown engine.
    for (const token of paragraph.split(/(\*\*[^*]+\*\*)/g)) {
      const node = document.createElement(token.startsWith('**') && token.endsWith('**') ? 'strong' : 'span')
      node.textContent = node.tagName === 'STRONG' ? token.slice(2, -2) : token
      p.appendChild(node)
    }
    fragment.appendChild(p)
  }
  return fragment
}

function installHistoryRailRuntime() {
  const selector = '[data-slot="thread-timeline"]'
  const rails = new Map()
  let serial = 0
  const mount = root => {
    if (rails.has(root)) return
    const surface = root.closest('[data-session-anchor]')
    const strip = root.querySelector('[data-slot="thread-timeline-ticks"]')
    if (!surface || !strip) return
    const card = document.createElement('div')
    card.setAttribute('data-claude-history-preview', '')
    card.setAttribute('data-suppress-pane-reveal', '')
    card.setAttribute('role', 'tooltip')
    card.id = `claude-history-preview-${++serial}`
    card.hidden = true
    const question = document.createElement('div')
    question.setAttribute('data-claude-history-question', '')
    const answer = document.createElement('div')
    answer.setAttribute('data-claude-history-answer', '')
    card.append(question, answer)
    surface.appendChild(card)
    root.setAttribute('data-claude-history-rail', '')
    let buttons = []
    let hovered = null
    let previousDescription = null
    let closeTimer = 0
    let revision = 0
    let historyCache = null
    let labels = ''
    let waveFrame = 0
    let waveY = 0
    let waveGeometry = null
    const cancelClose = () => window.clearTimeout(closeTimer)
    const queueWave = y => {
      waveY = y
      if (waveFrame) return
      waveFrame = window.requestAnimationFrame(() => {
        waveFrame = 0
        if (!hovered || !buttons.length) return
        // All hit targets have the same fixed height. Read the track geometry
        // before any writes; changing a line's width never moves its neighbors.
        if (!waveGeometry) {
          const first = buttons[0].getBoundingClientRect()
          if (!first.height) return
          const pitch = buttons.length > 1 ? buttons[1].getBoundingClientRect().top - first.top : first.height
          waveGeometry = { top: first.top, height: first.height, pitch }
        }
        const { top, height, pitch } = waveGeometry
        const radius = Math.max(height, pitch) * 3.2
        buttons.forEach((tick, index) => {
          const distance = Math.abs(top + height / 2 + index * pitch - waveY)
          const phase = Math.min(1, distance / radius)
          const width = 6 + 10 * (1 + Math.cos(Math.PI * phase))
          tick.style.setProperty('--claude-history-tick-width', `${width}px`)
        })
      })
    }
    const close = (resetWave = true) => {
      revision += 1
      waveGeometry = null
      cancelClose()
      window.cancelAnimationFrame(waveFrame)
      waveFrame = 0
      if (hovered) {
        if (previousDescription === null) hovered.removeAttribute('aria-describedby')
        else hovered.setAttribute('aria-describedby', previousDescription)
      }
      hovered = null
      if (!card.hidden) card.hidden = true
      question.textContent = ''
      answer.replaceChildren()
      root.removeAttribute('data-claude-history-open')
      for (const button of buttons) {
        if (resetWave !== false) button.style.removeProperty('--claude-history-tick-width')
        button.removeAttribute('data-claude-history-hover')
      }
    }
    const refresh = () => {
      const next = [...strip.querySelectorAll('.thread-timeline-tick')]
        .filter(button => button.closest('[data-slot="thread-timeline-ticks"]') === strip)
      const nextLabels = JSON.stringify(next.map(button => button.getAttribute('aria-label')))
      if (nextLabels !== labels || next.length !== buttons.length || next.some((b, i) => b !== buttons[i])) {
        waveGeometry = null
        close()
      }
      labels = nextLabels
      buttons = next
      if (!waveGeometry && buttons.length) {
        const first = buttons[0].getBoundingClientRect()
        if (first.height) {
          const pitch = buttons.length > 1 ? buttons[1].getBoundingClientRect().top - first.top : first.height
          waveGeometry = { top: first.top, height: first.height, pitch }
        }
      }
    }
    const position = () => {
      if (!hovered || card.hidden) return
      const boundary = surface.getBoundingClientRect()
      const tick = hovered.getBoundingClientRect()
      const edge = root.getBoundingClientRect().left - boundary.left + 36
      card.style.left = `${edge}px`
      card.style.width = `${Math.max(0, Math.min(320, boundary.width - edge - 8))}px`
      card.style.maxHeight = `${Math.max(0, boundary.height - 16)}px`
      const height = card.getBoundingClientRect().height
      card.style.top = `${Math.max(8, Math.min(boundary.height - height - 8, tick.top + tick.height / 2 - boundary.top - height / 2))}px`
    }
    const fillUnloaded = (button, index) => {
      // The SDK's active runtime belongs to the primary workspace, not a tile's
      // stored ID. Never send a tile's identifier to this runtime-only RPC.
      if (surface.getAttribute('data-session-anchor') !== 'workspace' || typeof host.request !== 'function') return
      const sessionId = currentRuntimeSessionId()
      if (!sessionId) return
      const scope = JSON.stringify([sessionId, currentProfileScope(), routedStoredSessionId(), labels])
      const expectedRevision = revision
      if (!historyCache || historyCache.scope !== scope || Date.now() - historyCache.time > 20000) {
        historyCache = { scope, time: Date.now(), promise: Promise.resolve().then(() => host.request('session.history', { session_id: sessionId })).then(result => historyTranscriptEntries(result?.messages)) }
      }
      historyCache.promise.then(entries => {
        if (revision !== expectedRevision || hovered !== button || !root.isConnected || card.hidden) return
        if (JSON.stringify([currentRuntimeSessionId(), currentProfileScope(), routedStoredSessionId(), labels]) !== scope) return
        // Optimistic/filtered UI turns may differ from stored history. Require
        // the entire index to match before resolving even a duplicated prompt.
        if (entries.length !== buttons.length || entries.some((entry, i) => historyPromptPreview(entry.question) !== buttons[i].getAttribute('aria-label'))) return
        const entry = entries[index]
        question.textContent = entry.question
        answer.replaceChildren(historyPlainFragment(entry.answer))
        answer.hidden = !entry.answer
        position()
      }).catch(() => { /* Keep the native question preview on missing history. */ })
    }
    const show = (button, pointerY = null) => {
      cancelClose()
      if (button === hovered) {
        if (pointerY !== null) queueWave(pointerY)
        return
      }
      for (const [otherRoot, state] of rails) state.close(otherRoot !== root)
      refresh()
      const index = buttons.indexOf(button)
      if (index < 0) return
      hovered = button
      previousDescription = button.getAttribute('aria-describedby')
      button.setAttribute('aria-describedby', [previousDescription, card.id].filter(Boolean).join(' '))
      root.setAttribute('data-claude-history-open', '')
      buttons.forEach((tick, i) => {
        tick.toggleAttribute('data-claude-history-hover', i === index)
      })
      const rect = button.getBoundingClientRect()
      queueWave(pointerY ?? rect.top + rect.height / 2)
      question.textContent = button.getAttribute('aria-label') || ''
      answer.replaceChildren()
      // Virtualized content is a suffix of the same native prompt index. Verify
      // the entire suffix before pairing; never match duplicate text globally.
      const viewport = surface.querySelector('[data-slot="aui_thread-viewport"]')
      const users = [...(viewport?.querySelectorAll('[data-slot="aui_user-message-root"]') || [])]
        .map(user => ({ user, text: user.querySelector('[data-slot="aui_user-message-text"]')?.textContent || '' }))
        .filter(row => row.text.trim() && !/^\[IMPORTANT: Background process [\s\S]*\]$/.test(row.text.trim()))
      const offset = buttons.length - users.length
      const aligned = offset >= 0 && users.every((row, i) => historyPromptPreview(row.text) === buttons[offset + i].getAttribute('aria-label'))
      const row = aligned && users[index - offset]
      const pair = row?.user?.closest('[data-slot="aui_turn-pair"]')
      if (pair) {
        question.textContent = row.text
        const roots = [...pair.querySelectorAll('[data-role="assistant"][data-slot="aui_assistant-message-root"]')]
          .filter(root => root.closest('[data-slot="aui_turn-pair"]') === pair)
        const final = roots.findLast(node => node.querySelector('[data-slot="aui_msg-actions"]')) || roots.at(-1)
        const parts = final?.querySelectorAll('[data-slot="aui_assistant-message-content"] > .aui-md')
        const text = parts?.[parts.length - 1]
        if (text) answer.appendChild(historyPreviewFragment(text))
      }
      answer.hidden = !answer.textContent.trim()
      card.hidden = false
      position()
      if (!pair) fillUnloaded(button, index)
    }
    const onOver = event => {
      // Stop only native hover expansion. Click/keyboard navigation remains on
      // the original buttons and never goes through reconstructed message IDs.
      event.stopPropagation()
      const button = event.target.closest?.('button')
      if (buttons.includes(button)) show(button, event.clientY)
    }
    const onMove = event => {
      // Tip's asChild trigger handles pointermove at React's root. Suppress
      // only native hover here; clicks and keyboard navigation still bubble.
      event.stopPropagation()
      if (hovered && strip.contains(event.target)) queueWave(event.clientY)
    }
    const onOut = event => {
      event.stopPropagation()
      if (root.contains(event.relatedTarget) || card.contains(event.relatedTarget)) return
      cancelClose()
      closeTimer = window.setTimeout(close, 120)
    }
    const onFocus = event => { if (buttons.includes(event.target)) show(event.target) }
    const onKey = event => { if (event.key === 'Escape') { close(); event.stopPropagation() } }
    root.addEventListener('mouseover', onOver, true)
    root.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('mouseout', onOut, true)
    root.addEventListener('focusin', onFocus)
    root.addEventListener('focusout', onOut)
    root.addEventListener('keydown', onKey)
    const onScroll = () => { waveGeometry = null; close() }
    strip.addEventListener('scroll', onScroll, { passive: true })
    card.addEventListener('mouseover', cancelClose)
    card.addEventListener('mouseout', onOut)
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
      root.style.setProperty('--claude-history-rail-height', `${Math.max(10, entries[0].contentRect.height - 32)}px`)
      waveGeometry = null
      close()
    }) : null
    resize?.observe(surface)
    const cleanup = () => {
      close()
      historyCache = null
      resize?.disconnect()
      root.removeEventListener('mouseover', onOver, true)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('mouseout', onOut, true)
      root.removeEventListener('focusin', onFocus)
      root.removeEventListener('focusout', onOut)
      root.removeEventListener('keydown', onKey)
      strip.removeEventListener('scroll', onScroll)
      root.removeAttribute('data-claude-history-rail')
      root.style.removeProperty('--claude-history-rail-height')
      card.remove()
    }
    rails.set(root, { close, cleanup, refresh, surface, invalidate: () => { close(); historyCache = null } })
    refresh()
  }
  const scan = node => {
    if (!(node instanceof Element)) return
    if (node.matches(selector)) mount(node)
    if (node.firstElementChild) node.querySelectorAll(selector).forEach(mount)
  }
  document.querySelectorAll(selector).forEach(mount)
  const closeAll = () => { for (const state of rails.values()) state.close() }
  window.addEventListener('resize', closeAll)
  window.addEventListener('hashchange', closeAll)
  const invalidateAll = () => { for (const state of rails.values()) state.invalidate() }
  const subscriptions = ['activeSessionId', 'profile', 'gateway']
    .map(key => host.state[key]?.subscribe?.(invalidateAll))
    .filter(unsubscribe => typeof unsubscribe === 'function')
  return {
    observe(records) {
      for (const record of records) {
        const root = record.target.closest?.(selector)
        if (record.type === 'childList') for (const node of record.addedNodes) scan(node)
        if (root) { mount(root); rails.get(root)?.refresh() }
      }
      for (const [root, state] of rails) {
        if (!root.isConnected || root.closest('[data-session-anchor]') !== state.surface) {
          state.cleanup(); rails.delete(root)
        }
      }
    },
    cleanup() {
      window.removeEventListener('resize', closeAll)
      window.removeEventListener('hashchange', closeAll)
      subscriptions.forEach(unsubscribe => unsubscribe())
      for (const state of rails.values()) state.cleanup()
      rails.clear()
    }
  }
}

function installComposerOverflowRuntime() {
  const selector = '[data-slot="composer-surface"] [data-slot="composer-rich-input"]'
  const attribute = 'data-claude-composer-overflow'
  const editors = new Set()
  // Chromium can retain a forwards-filled scroll animation when its timeline
  // becomes inactive. Remove the animation itself once the editor fits again.
  // Auto-height editors resize at the overflow boundary; no per-key layout read.
  const sync = editor => {
    const overflowing = editor.clientHeight > 0 && editor.scrollHeight > editor.clientHeight
    if (editor.hasAttribute(attribute) !== overflowing) editor.toggleAttribute(attribute, overflowing)
  }
  const observer = new window.ResizeObserver(entries => {
    for (const { target } of entries) if (editors.has(target)) sync(target)
  })
  return {
    refresh() {
      for (const editor of editors) {
        if (editor.isConnected && editor.matches(selector)) continue
        observer.unobserve(editor)
        editor.removeAttribute(attribute)
        editors.delete(editor)
      }
      for (const editor of document.querySelectorAll(selector)) {
        if (editors.has(editor)) continue
        editors.add(editor)
        sync(editor)
        observer.observe(editor)
      }
    },
    cleanup() {
      observer.disconnect()
      for (const editor of editors) editor.removeAttribute(attribute)
      editors.clear()
    }
  }
}

function installBehaviorRuntime(afterFinalCleanup = null) {
  const pendingHandoff = window[RUNTIME_HANDOFF_KEY]
  if (pendingHandoff?.timer) window.clearTimeout(pendingHandoff.timer)
  if (pendingHandoff) delete window[RUNTIME_HANDOFF_KEY]

  const historyRail = installHistoryRailRuntime()
  const composerOverflow = installComposerOverflowRuntime()
  let scheduled = false
  let animationFrame = 0
  let processAllPairs = true
  let historicalPairScanPending = false
  let pairWorkHandle = 0
  let pairWorkUsesIdleCallback = false
  let composerDirty = true
  let destroyed = false
  const dirtyPairs = new Set()
  const animatedPlaybackNodes = new WeakSet()
  const playbackAnimationTimers = new Set()
  const audioLaneDocks = new Set()
  const playbackReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const PAIR_WORK_BATCH_SIZE = 8
  let threadViewport = null
  let liveTailWrapper = null
  let threadScrollTimer = 0
  let threadScrollbarTimer = 0
  let liveTailAtBottom = true

  function composerFadeForDock(dock) {
    const composer = dock?.querySelector?.(':scope > [data-slot="composer-root"]')
    return composer?.querySelector('[data-slot="composer-fade"]') || null
  }

  function syncAudioLaneGeometry(dock) {
    if (destroyed || !(dock instanceof Element) || !dock.isConnected) return
    const fade = composerFadeForDock(dock)
    if (!fade) return
    const hasAudioRow = Boolean(fade.querySelector(':scope > [data-claude-playback-floating="true"]'))
    if (!hasAudioRow) {
      fade.style.removeProperty('--claude-audio-lane-top')
      fade.removeAttribute('data-claude-audio-lane')
      return
    }
    const dockRect = dock.getBoundingClientRect()
    const fadeRect = fade.getBoundingClientRect()
    if (dockRect.width <= 0 || fadeRect.width <= 0) return
    const laneTop = dockRect.top - fadeRect.top
    const next = `${laneTop}px`
    if (fade.style.getPropertyValue('--claude-audio-lane-top') !== next) {
      fade.style.setProperty('--claude-audio-lane-top', next)
    }
    fade.setAttribute('data-claude-audio-lane', 'true')
  }

  const audioLaneResizeObserver = new window.ResizeObserver(entries => {
    if (destroyed) return
    for (const entry of entries) syncAudioLaneGeometry(entry.target)
  })

  function refreshAudioLaneDocks() {
    const current = new Set(document.querySelectorAll('[data-slot="composer-dock"]'))
    for (const dock of audioLaneDocks) {
      if (current.has(dock) && dock.isConnected) continue
      audioLaneResizeObserver.unobserve(dock)
      audioLaneDocks.delete(dock)
    }
    for (const dock of current) {
      if (!audioLaneDocks.has(dock)) {
        audioLaneDocks.add(dock)
        audioLaneResizeObserver.observe(dock)
      }
      syncAudioLaneGeometry(dock)
    }
  }

  function clearAudioLaneGeometry() {
    audioLaneResizeObserver.disconnect()
    audioLaneDocks.clear()
    for (const fade of document.querySelectorAll('[data-claude-audio-lane]')) {
      fade.style.removeProperty('--claude-audio-lane-top')
      fade.removeAttribute('data-claude-audio-lane')
    }
  }

  function playbackStatusesIn(node) {
    if (!(node instanceof Element)) return []
    const statuses = []
    if (
      node.matches('[role="status"][aria-live="polite"]')
      && (node.parentElement?.matches('[data-slot="composer-fade"]') || node.hasAttribute('data-claude-playback-floating'))
    ) statuses.push(node)
    for (const status of node.querySelectorAll('[role="status"][aria-live="polite"]')) {
      if (status.parentElement?.matches('[data-slot="composer-fade"]')) statuses.push(status)
    }
    return statuses
  }

  function floatPlaybackStatus(status) {
    status.setAttribute('data-claude-playback-floating', 'true')
    const playback = Boolean(status.querySelector(':scope > button'))
    status.setAttribute(playback ? 'data-claude-audio-playback' : 'data-claude-audio-dictation', 'true')
    syncAudioLaneGeometry(status.closest('[data-slot="composer-dock"]'))
  }

  function clearPlaybackStatusFloat(status) {
    const dock = status.closest('[data-slot="composer-dock"]')
    status.removeAttribute('data-claude-playback-floating')
    status.removeAttribute('data-claude-audio-playback')
    status.removeAttribute('data-claude-audio-dictation')
    syncAudioLaneGeometry(dock)
  }

  function animatePlaybackEntry(status) {
    if (
      destroyed
      || status.hasAttribute('data-claude-playback-hold')
      || status.hasAttribute('data-claude-playback-exit')
      || animatedPlaybackNodes.has(status)
    ) return
    animatedPlaybackNodes.add(status)
    floatPlaybackStatus(status)
    const pendingGhost = status.parentElement?.querySelector?.(
      ':scope > [data-claude-playback-hold], :scope > [data-claude-playback-exit]'
    ) || null
    pendingGhost?.__claudeCancelPlaybackExit?.()
    pendingGhost?.remove()
    if (pendingGhost) return
    if (playbackReducedMotion.matches) return
    status.setAttribute('data-claude-playback-enter', 'true')
    let timer = 0
    const finish = () => {
      if (timer) {
        window.clearTimeout(timer)
        playbackAnimationTimers.delete(timer)
        timer = 0
      }
      status.removeAttribute('data-claude-playback-enter')
    }
    status.addEventListener('animationend', finish, { once: true })
    timer = window.setTimeout(finish, PLAYBACK_MOTION_MS + 80)
    playbackAnimationTimers.add(timer)
  }

  function animatePlaybackExit(status, parent, nextSibling) {
    if (
      destroyed
      || status.hasAttribute('data-claude-playback-hold')
      || status.hasAttribute('data-claude-playback-exit')
      || !parent?.closest?.('[data-slot="composer-surface"]')
    ) return
    const ghost = status.cloneNode(true)
    ghost.removeAttribute('data-claude-playback-enter')
    ghost.setAttribute('data-claude-playback-hold', 'true')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.inert = true
    for (const button of ghost.querySelectorAll('button')) {
      button.disabled = true
      button.tabIndex = -1
    }
    const sourceCanvases = [...status.querySelectorAll('canvas')]
    const ghostCanvases = [...ghost.querySelectorAll('canvas')]
    for (let index = 0; index < sourceCanvases.length; index += 1) {
      const sourceCanvas = sourceCanvases[index]
      const ghostCanvas = ghostCanvases[index]
      if (!ghostCanvas) continue
      ghostCanvas.width = sourceCanvas.width
      ghostCanvas.height = sourceCanvas.height
      try {
        const ghostContext = ghostCanvas.getContext('2d')
        if (ghostContext) ghostContext.drawImage(sourceCanvas, 0, 0)
      } catch {}
    }
    if (nextSibling?.parentNode === parent) parent.insertBefore(ghost, nextSibling)
    else parent.appendChild(ghost)
    syncAudioLaneGeometry(parent.closest('[data-slot="composer-dock"]'))
    let graceTimer = 0
    let exitTimer = 0
    let exitStartTimer = 0
    const removeGhost = () => {
      if (graceTimer) {
        window.clearTimeout(graceTimer)
        playbackAnimationTimers.delete(graceTimer)
        graceTimer = 0
      }
      if (exitTimer) {
        window.clearTimeout(exitTimer)
        playbackAnimationTimers.delete(exitTimer)
        exitTimer = 0
      }
      if (exitStartTimer) {
        window.clearTimeout(exitStartTimer)
        playbackAnimationTimers.delete(exitStartTimer)
        exitStartTimer = 0
      }
      delete ghost.__claudeCancelPlaybackExit
      const dock = ghost.closest('[data-slot="composer-dock"]')
      ghost.remove()
      syncAudioLaneGeometry(dock)
    }
    ghost.__claudeCancelPlaybackExit = removeGhost
    ghost.addEventListener('animationend', removeGhost, { once: true })
    const beginExit = () => {
      if (graceTimer) {
        playbackAnimationTimers.delete(graceTimer)
        graceTimer = 0
      }
      if (playbackReducedMotion.matches) {
        removeGhost()
        return
      }
      // Start from a separately committed held frame. A zero-delay task is
      // reliable even when the renderer is background-throttled; RAF is not.
      exitStartTimer = window.setTimeout(() => {
        playbackAnimationTimers.delete(exitStartTimer)
        exitStartTimer = 0
        if (!ghost.isConnected) return
        ghost.setAttribute('data-claude-playback-exit', 'true')
        exitTimer = window.setTimeout(removeGhost, PLAYBACK_MOTION_MS + 80)
        playbackAnimationTimers.add(exitTimer)
      }, 0)
      playbackAnimationTimers.add(exitStartTimer)
    }
    graceTimer = window.setTimeout(beginExit, PLAYBACK_CLOSE_GRACE_MS)
    playbackAnimationTimers.add(graceTimer)
  }

  function clearPlaybackAnimations() {
    for (const timer of playbackAnimationTimers) window.clearTimeout(timer)
    playbackAnimationTimers.clear()
    for (const status of document.querySelectorAll('[data-claude-playback-enter]')) {
      status.removeAttribute('data-claude-playback-enter')
    }
    for (const ghost of document.querySelectorAll('[data-claude-playback-hold], [data-claude-playback-exit]')) {
      ghost.__claudeCancelPlaybackExit?.()
      ghost.remove()
    }
    for (const status of document.querySelectorAll('[data-claude-playback-floating]')) {
      clearPlaybackStatusFloat(status)
    }
  }

  const updateLiveTailVisibility = () => {
    threadScrollTimer = 0
    if (!threadViewport?.isConnected || !liveTailWrapper?.isConnected) return
    liveTailAtBottom = threadViewport.scrollHeight - threadViewport.clientHeight - threadViewport.scrollTop <= 48
    if (liveTailAtBottom) {
      if (!liveTailWrapper.hasAttribute('data-claude-live-tail')) liveTailWrapper.setAttribute('data-claude-live-tail', 'true')
    } else {
      liveTailWrapper.removeAttribute('data-claude-live-tail')
    }
  }

  const onThreadScroll = () => {
    if (destroyed) return
    if (!threadViewport?.hasAttribute('data-claude-scrolling')) threadViewport?.setAttribute('data-claude-scrolling', 'true')
    window.clearTimeout(threadScrollbarTimer)
    threadScrollbarTimer = window.setTimeout(() => threadViewport?.removeAttribute('data-claude-scrolling'), 700)
    liveTailAtBottom = false
    liveTailWrapper?.removeAttribute('data-claude-live-tail')
    window.clearTimeout(threadScrollTimer)
    threadScrollTimer = window.setTimeout(updateLiveTailVisibility, 120)
  }

  const latestTurnPairFromEnd = content => {
    if (!content) return null
    let node = content.lastElementChild
    while (node) {
      if (node.matches?.('[data-slot="aui_turn-pair"]') && userMessageId(node)) return node
      if (node.lastElementChild) {
        node = node.lastElementChild
        continue
      }
      while (node && node !== content && !node.previousElementSibling) node = node.parentElement
      if (!node || node === content) return null
      node = node.previousElementSibling
    }
    return null
  }

  const refreshLiveTail = () => {
    const content = document.querySelector('[data-slot="aui_thread-content"]')
    const viewport = document.querySelector('[data-slot="aui_thread-viewport"]')
    if (viewport !== threadViewport) {
      threadViewport?.removeEventListener('scroll', onThreadScroll)
      threadViewport?.removeAttribute('data-claude-scrollbar')
      threadViewport?.removeAttribute('data-claude-scrolling')
      window.clearTimeout(threadScrollbarTimer)
      threadViewport = viewport
      threadViewport?.setAttribute('data-claude-scrollbar', 'true')
      threadViewport?.addEventListener('scroll', onThreadScroll, { passive: true })
    }
    const latest = latestTurnPairFromEnd(content)
    let wrapper = latest
    while (wrapper && wrapper.parentElement !== content) wrapper = wrapper.parentElement
    if (wrapper !== liveTailWrapper) {
      liveTailWrapper?.removeAttribute('data-claude-live-tail')
      liveTailWrapper = wrapper
      if (liveTailAtBottom) liveTailWrapper?.setAttribute('data-claude-live-tail', 'true')
    }
    window.clearTimeout(threadScrollTimer)
    threadScrollTimer = window.setTimeout(updateLiveTailVisibility, 0)
  }

  const markPair = pair => {
    if (!pair?.matches?.('[data-slot="aui_turn-pair"]')) return
    dirtyPairs.add(pair)
  }

  const markPairsIn = node => {
    if (!(node instanceof Element)) return
    if (node.matches('[data-slot="aui_turn-pair"]')) markPair(node)
    else if (node.matches('[data-session-anchor], [data-slot="aui_thread-content"]')) {
      historicalPairScanPending = true
    } else {
      for (const pair of collectNestedTurnPairs(node)) markPair(pair)
    }
  }


  const cancelPairWork = () => {
    if (!pairWorkHandle) return
    if (pairWorkUsesIdleCallback) window.cancelIdleCallback?.(pairWorkHandle)
    else window.clearTimeout(pairWorkHandle)
    pairWorkHandle = 0
  }

  const runPairWork = deadline => {
    pairWorkHandle = 0
    if (destroyed) return
    if (historicalPairScanPending) {
      historicalPairScanPending = false
      for (const pair of document.querySelectorAll('[data-slot="aui_turn-pair"]')) markPair(pair)
    }
    let processed = 0
    while (dirtyPairs.size && processed < PAIR_WORK_BATCH_SIZE && (processed === 0 || deadline.timeRemaining() > 1)) {
      const pair = dirtyPairs.values().next().value
      dirtyPairs.delete(pair)
      if (!pair?.isConnected) continue
      stripImageAttachmentMarker(pair)
      decorateLongUserMessage(pair)
      reconcileCleanTranscript(pair)
      processed += 1
    }
    if (dirtyPairs.size) schedulePairWork()
  }

  const schedulePairWork = () => {
    if (pairWorkHandle || destroyed) return
    if (typeof window.requestIdleCallback === 'function') {
      pairWorkUsesIdleCallback = true
      pairWorkHandle = window.requestIdleCallback(runPairWork, { timeout: 800 })
    } else {
      pairWorkUsesIdleCallback = false
      pairWorkHandle = window.setTimeout(() => runPairWork({ timeRemaining: () => 4 }), 16)
    }
  }

  const schedule = () => {
    if (scheduled || destroyed) return
    scheduled = true
    animationFrame = window.requestAnimationFrame(process)
  }

  const reconcileSession = () => {
    if (destroyed) return
    historicalPairScanPending = true
    composerDirty = true
    schedule()
  }

  let observedSessionId = currentRuntimeSessionId()
  const offActiveSession = host.state.activeSessionId?.subscribe?.(value => {
    const nextSessionId = String(value || '')
    if (nextSessionId === observedSessionId) return
    observedSessionId = nextSessionId
    reconcileSession()
  })

  let observedProfile = currentProfileScope()
  const offProfileState = host.state.profile?.subscribe?.(value => {
    const nextProfile = profileScope(value)
    if (nextProfile === observedProfile) return
    observedProfile = nextProfile
    reconcileSession()
  })

  let observedGatewayState = String(host.state.gateway?.get?.() || '')
  const offGatewayState = host.state.gateway?.subscribe?.(value => {
    const nextState = String(value || '')
    const reconnected = observedGatewayState && observedGatewayState !== 'open' && nextState === 'open'
    observedGatewayState = nextState
    if (!reconnected) return
    reconcileSession()
  })

  const offSessionInfo = host.onEvent?.('session.info', event => {
    if (destroyed) return
    const runtimeId = String(event.session_id || '')
    if (runtimeId === currentRuntimeSessionId()) reconcileSession()
  })

  function process() {
    animationFrame = 0
    scheduled = false
    if (destroyed) return

    if (processAllPairs) {
      processAllPairs = false
      historicalPairScanPending = true
    }
    schedulePairWork()

    refreshLiveTail()

    if (composerDirty) {
      composerDirty = false
      decorateComposerChrome()
      composerOverflow.refresh()
      refreshAudioLaneDocks()
    }
  }

  const touchesComposerChrome = element => Boolean(
    element?.closest?.('[data-slot="composer-dock"]:not([data-slot="composer-rich-input"]), [data-slot="composer-root"]:not([data-slot="composer-rich-input"])')
    || element?.matches?.('[data-slot="dropdown-menu-content"][role="menu"]')
    || (element?.firstElementChild && element.querySelector?.('[data-slot="dropdown-menu-content"][role="menu"], [data-slot="composer-dock"]'))
  )

  const runtimeSignalSelector = [
    '[data-slot="aui_user-message-root"]',
    '[data-role="assistant"][data-slot="aui_assistant-message-root"]',
    '[data-role="system"][data-slot="aui_system-message-root"]',
    '[data-slot="aui_turn-pair"]',
    '[data-slot="aui_msg-actions"]',
    '[data-slot="tool-block"]',
    '[data-slot="aui_thinking-disclosure"]',
    '[data-slot="aui_changed-files"]',
    '[data-slot="aui_generated-image"]',
    '[data-slot="clarify-inline"]',
    '[data-slot="mcp-setup-inline"]',
    '[data-slot="tool-approval-inline"]',
    '[role="status"]',
    '[data-slot="dropdown-menu-content"][role="menu"]',
    '[data-slot="composer-dock"]',
    '[data-slot="composer-root"]',
    '[data-session-anchor]'
  ].join(', ')

  const carriesRuntimeSignal = node => Boolean(
    node instanceof Element
    && (
      node.matches(runtimeSignalSelector)
      || (node.firstElementChild && node.querySelector(runtimeSignalSelector))
    )
  )

  const handleMutations = records => {
    historyRail.observe(records)
    let relevant = false
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement
      if (target?.closest?.('[data-claude-user-expand]')) continue
      if (target?.closest?.('[data-slot="sidebar"]')) continue

      const pair = target?.closest?.('[data-slot="aui_turn-pair"]')
      if (record.type === 'attributes') {
        if (record.attributeName === 'data-clamped' && target?.closest?.('[data-role="user"]')) {
          if (pair) markPair(pair)
          relevant = true
        } else if (
          (record.attributeName === 'role' && target?.matches?.('[role="status"]'))
          || (record.attributeName === 'data-streaming' && target?.matches?.('[data-role="assistant"]'))
        ) {
          if (pair) markPair(pair)
          relevant = true
        } else if (target?.closest?.('[data-slot="composer-dock"], [data-slot="composer-root"]')) {
          composerDirty = true
          relevant = true
        }
        continue
      }

      if (target?.closest?.('[data-slot="composer-rich-input"]')) continue
      const addedElements = [...record.addedNodes].filter(node => node instanceof Element)
      const removedElements = [...record.removedNodes].filter(node => node instanceof Element)
      const changedElements = [...addedElements, ...removedElements]
      if (target?.closest?.('[data-slot="composer-surface"]')) {
        for (const node of addedElements) {
          for (const status of playbackStatusesIn(node)) animatePlaybackEntry(status)
        }
        for (const node of removedElements) {
          for (const status of playbackStatusesIn(node)) animatePlaybackExit(status, target, record.nextSibling)
        }
      }
      const signalChanged = changedElements.some(carriesRuntimeSignal)
      const cleanPartChanged = changedElements.some(isCleanPartMutationNode)

      if (pair && (target?.closest?.('[data-role="user"]') || signalChanged || cleanPartChanged)) {
        markPair(pair)
        relevant = true
      }
      if (signalChanged || cleanPartChanged) relevant = true
      if (target?.closest?.('[data-slot="composer-dock"], [data-slot="composer-root"]') && !target.closest('[data-slot="composer-rich-input"], textarea')) {
        composerDirty = true
        relevant = true
      }

      for (const node of changedElements) {
        if (node.matches('[data-slot="sidebar"]') || node.closest?.('[data-slot="sidebar"]')) continue
        if (isTurnPairMutationRoot(node)) {
          markPairsIn(node)
          relevant = true
        }
        if (touchesComposerChrome(node)) {
          composerDirty = true
          relevant = true
        }
      }
    }
    if (relevant) schedule()
  }

  const observer = new MutationObserver(handleMutations)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'role', 'data-clamped', 'data-streaming']
  })
  for (const status of document.querySelectorAll('[data-slot="composer-fade"] > [role="status"][aria-live="polite"]')) {
    animatePlaybackEntry(status)
  }
  const onResize = () => {
    processAllPairs = true
    composerDirty = true
    schedule()
  }
  const onHashChange = () => reconcileSession()
  const onCleanTranscriptChange = () => reconcileSession()
  window.addEventListener('resize', onResize)
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener(CLEAN_TRANSCRIPT_EVENT, onCleanTranscriptChange)
  reconcileSession()

  const cleanup = () => {
    destroyed = true
    if (animationFrame) window.cancelAnimationFrame(animationFrame)
    animationFrame = 0
    scheduled = false
    observer.disconnect()
    historyRail.cleanup()
    composerOverflow.cleanup()
    cancelPairWork()
    clearPlaybackAnimations()
    clearAudioLaneGeometry()

    window.clearTimeout(threadScrollTimer)
    window.clearTimeout(threadScrollbarTimer)
    threadViewport?.removeEventListener('scroll', onThreadScroll)
    threadViewport?.removeAttribute('data-claude-scrollbar')
    threadViewport?.removeAttribute('data-claude-scrolling')
    liveTailWrapper?.removeAttribute('data-claude-live-tail')
    window.removeEventListener('resize', onResize)
    window.removeEventListener('hashchange', onHashChange)
    window.removeEventListener(CLEAN_TRANSCRIPT_EVENT, onCleanTranscriptChange)

    offProfileState?.()
    offGatewayState?.()
    offActiveSession?.()
    offSessionInfo?.()

    const handoff = { timer: 0 }
    handoff.timer = window.setTimeout(() => {
      if (window[RUNTIME_HANDOFF_KEY] !== handoff) return
      for (const user of document.querySelectorAll('[data-slot="aui_user-message-root"]')) clearLongUserDecoration(user)
      clearCleanTranscriptDecorations()
      clearImageAttachmentMarkers()
      clearComposerChromeDecorations()
      afterFinalCleanup?.()
      delete window[RUNTIME_HANDOFF_KEY]
    }, 300)
    window[RUNTIME_HANDOFF_KEY] = handoff
  }
  cleanup.reconcileSession = reconcileSession
  return cleanup
}

function installTitlebarAlignment() {
  const observed = new Set(), marked = new Set()
  const selector = '[data-titlebar-cluster], [data-window-top], [data-panel-header]'
  let frame = 0, disposed = false
  const clear = element => {
    element.style.removeProperty('--claude-titlebar-offset')
    element.removeAttribute('data-claude-titlebar-aligned')
    marked.delete(element)
  }
  const sync = () => {
    frame = 0
    if (disposed) return
    const clusters = [...document.querySelectorAll('[data-titlebar-cluster]')]
    const headers = [...document.querySelectorAll('[data-window-top] > [data-panel-header]')]
    const current = new Set([...clusters, ...headers])
    for (const element of observed) if (!current.has(element)) { resize.unobserve(element); observed.delete(element) }
    for (const element of current) if (!observed.has(element)) { resize.observe(element); observed.add(element) }
    for (const element of marked) if (!clusters.includes(element)) clear(element)
    for (const cluster of clusters) {
      const box = cluster.getBoundingClientRect(), x = box.left + box.width / 2
      const header = headers.find(element => {
        const r = element.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && getComputedStyle(element).visibility !== 'hidden'
      })
      // Visible top-edge headers always use the same band, including empty
      // and cramped strips. Routes without a panel header remain native.
      if (document.documentElement.dataset.claudeChatLook !== 'true' || !box.width || !box.height || !header) { clear(cluster); continue }
      const band = header.getBoundingClientRect(), scale = box.height / cluster.offsetHeight
      const previous = parseFloat(cluster.style.getPropertyValue('--claude-titlebar-offset')) || 0
      const next = Math.round((previous + (band.top + band.height / 2 - box.top - box.height / 2) / scale) * 100) / 100
      if (Math.abs(next) < .02) { clear(cluster); continue }
      if (Math.abs(next - previous) > .02 || !marked.has(cluster)) {
        cluster.style.setProperty('--claude-titlebar-offset', `${next}px`)
        cluster.setAttribute('data-claude-titlebar-aligned', '')
        marked.add(cluster)
      }
    }
  }
  const schedule = () => { if (!disposed && !frame) frame = window.requestAnimationFrame(sync) }
  const resize = new ResizeObserver(schedule)
  const relevant = node => node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))
  const mutations = new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' || record.target.closest?.('[data-panel-header]') || [...record.addedNodes, ...record.removedNodes].some(relevant))) schedule()
  })
  mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-window-top'] })
  window.addEventListener('resize', schedule)
  sync()
  return () => {
    disposed = true
    window.cancelAnimationFrame(frame)
    resize.disconnect(); mutations.disconnect()
    window.removeEventListener('resize', schedule)
    for (const element of marked) clear(element)
  }
}

function installChatStyleRuntime() {
  const root = document.documentElement
  let style = document.getElementById(STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = CSS + BROWSER_PALETTE_CSS + CLAUDE_CODE_LAYOUT_CSS + UPDATE_CSS
  style.dataset.claudeChatLookBuild = BUILD_ID
  root.dataset.claudeChatLook = 'true'
  root.dataset.claudeChatLookBuild = BUILD_ID
  syncComposerWidthRoot()
  syncPinnedUserMessagesRoot()
  syncCleanTranscriptRoot()
  const uninstallTitlebarAlignment = installTitlebarAlignment()
  const uninstallBehavior = installBehaviorRuntime(() => {
    style?.remove()
    delete root.dataset.claudeChatLook
    root.removeAttribute('data-claude-composer-width')
    root.removeAttribute('data-claude-pinned-user-messages')
    root.removeAttribute('data-claude-clean-transcript')
    if (root.dataset.claudeChatLookBuild === BUILD_ID) delete root.dataset.claudeChatLookBuild
    if (root.dataset.claudeChatLookRuntime === BUILD_ID) delete root.dataset.claudeChatLookRuntime
  })
  root.dataset.claudeChatLookRuntime = BUILD_ID
  console.info(`[claude-chat-look] activated ${BUILD_ID}`, JSON.stringify({
    panelHeaders: document.querySelectorAll('[data-window-top] > [data-panel-header]').length,
    browserBars: document.querySelectorAll('aside[data-preview-browser] input[data-slot="input"]').length,
    cornerTargets: document.querySelectorAll('[data-tree-split] > div:has(> [data-tree-group="grp-sessions"]):not([style*="display: none"]) + div > [data-tree-group="grp-main"]').length
  }))
  return () => {
    uninstallTitlebarAlignment()
    uninstallBehavior()
  }
}

// Claude Code's top-right pane toggles: terminal, changes, browser, files. They
// run Hermes' own view actions through ctx.runAction, the handler the keyboard
// shortcuts use, so rebinding changes nothing. Buttons are plugin DOM inside
// the native right titlebar cluster; a titleBar.right contribution would mark
// the band as page-owned and hide native tools on some routes.
// A toggle is lit while its pane is really on screen: Hermes' own pane state
// (host.paneVisibility) AND a visible element. Both are needed: folding the
// right column (Hermes' Files close does that) leaves the terminal and review
// "open" in Hermes' state but off screen. A press flips the pane through the
// same door Hermes uses:
//  - Changes / Browser: their plugin app actions, which already toggle.
//  - Terminal, Changes and Files share Hermes' right side, which Hermes folds
//    as one; installClaudePaneTools drives each of them on its own there.
//  - Terminal: no plugin action (Hermes keeps shell-spawning actions off the
//    plugin list), so the click is forwarded to Hermes' statusbar terminal
//    toggle, or, when that is not rendered (no chat open, or hidden from the
//    statusbar), to Hermes' default terminal shortcut (ctrl+backquote).
// The conditions the layout CSS reads off an element's contents. Each row:
// [name, candidates, condition, region]: candidates matching the condition get
// the name; only a mutation inside a region element (or anywhere, for null)
// re-checks the row. Generated from the CSS's own :has() lookups (see
// installClaudeHasMarks); the CSS reads [data-claude-has~="name"] instead.
const CLAUDE_HAS_MARKS = [
  ['tour-sidebar-nav', '[data-tour=\'sessions-sidebar\'] [data-sidebar=\'menu-button\']', ':has([data-tour^=\'sidebar-nav-\'])', '[data-tour=\'sessions-sidebar\']'],
  ['tour-sidebar-nav-new-session', '[data-tour=\'sessions-sidebar\'] [data-sidebar=\'menu-button\']', ':has([data-tour=\'sidebar-nav-new-session\'])', '[data-tour=\'sessions-sidebar\']'],
  ['child-model-pair-expanded', '[data-slot=\'composer-root\'] div', ':has(> :is(button[data-tour=\'model-pill\'], [data-claude-model-paired])[aria-expanded=\'true\'])', '[data-slot=\'composer-root\']'],
  ['child-engine-menu-open', '[data-slot=\'composer-root\'] span', ':has(> * > button[aria-label=\'Voice chat engine\'][aria-expanded=\'true\'], > button[aria-label=\'Voice chat engine\'][aria-expanded=\'true\'])', '[data-slot=\'composer-root\']'],
  ['child-start-voice', '[data-slot=\'composer-root\'] span', ':has(> button[aria-label=\'Start voice conversation\'])', '[data-slot=\'composer-root\']'],
  ['claude-update-anchor-style-inline-flex', '[data-slot=\'composer-root\'] [data-slot=\'composer-fade\'] > div:last-child', ':has([data-claude-update-anchor][style*=\'inline-flex\'])', '[data-slot=\'composer-root\']'],
  ['button-is-label-send-label-envoyer', '[data-slot=\'composer-root\'] [data-slot=\'composer-fade\'] > div:last-child', ':has(button:is([aria-label=\'Send\'], [aria-label=\'Envoyer\']))', '[data-slot=\'composer-root\']'],
  ['slot-composer-rich-input', '[data-slot=\'composer-root\'] [data-slot=\'composer-fade\'] > div:last-child > div', ':has([data-slot=\'composer-rich-input\'])', '[data-slot=\'composer-root\']'],
  ['tree-tab-workspace', '[data-tree-split] > div > [data-tree-group]:not([data-tree-group=\'grp-sessions\']):not([data-tree-group=\'grp-main\'])[data-window-top], [data-tree-split] > div > [data-tree-group]:not([data-tree-group=\'grp-sessions\']):not([data-tree-group=\'grp-main\'])', ':has([data-tree-tab=\'workspace\'])', '[data-tree-split]'],
  ['child-tree-split-div-tree-group-grp-files', '[data-tree-split] > div', ':has(> [data-tree-split] > div > [data-tree-group=\'grp-files\'])', '[data-tree-split]'],
  ['child-tree-split-div-not-style-display-none-tree-gro', '[data-tree-split] > div', ':has(> [data-tree-split] > div:not([style*=\'display: none\']) > [data-tree-group]:not([data-tree-group=\'grp-files\']))', '[data-tree-split]'],
  ['child-claude-preview-column-claude-side-column', '[data-tree-split]', ':has(> [data-claude-preview-column], > [data-claude-side-column])', '[data-tree-split]'],
  ['next-tree-group-grp-sessions', '[data-claude-grip]', ':has(+ [data-tree-group=\'grp-sessions\'])', null],
  ['child-tree-group-grp-terminal', '[data-tree-split] > div + div', ':has(> [data-tree-group=\'grp-terminal\'])', '[data-tree-split]'],
  ['tree-tab-terminal-role-tab', '[data-zone-tabstrip]', ':has([data-tree-tab=\'terminal\'][role=\'tab\'])', '[data-zone-tabstrip]'],
  ['child-claude-mode-rendered', '[data-claude-file-name]', ':has(> [data-claude-mode=\'rendered\'])', '[data-claude-file-name]'],
  ['child-claude-mode-source', '[data-claude-file-name]', ':has(> [data-claude-mode=\'source\'])', '[data-claude-file-name]'],
  ['child-project-tree', '[data-tree-group=\'grp-files\'] div', ':has(> [data-project-tree])', '[data-tree-group=\'grp-files\']'],
  ['child-tree-group-grp-sessions-tree-group-grp-main', '[data-tree-split] > div', ':has(> [data-tree-group=\'grp-sessions\'], > [data-tree-group=\'grp-main\'])', '[data-tree-split]'],
  ['child-input-label-search-sessions', '[data-tour=\'sessions-sidebar\'] div', ':has(> input[aria-label=\'Search sessions\'])', '[data-tour=\'sessions-sidebar\']'],
  ['child-tool-summary', '[data-tool-group]', ':has(> [data-tool-summary])', '[data-tool-group]'],
  ['tool-ticker', '[data-tool-group] > div:not([data-tool-summary]):not(.tool-ticker)', ':has(.tool-ticker)', '[data-tool-group]'],
  ['glyph-spinner', '[data-tool-row] [role=\'status\']', ':has(.glyph-spinner)', '[data-tool-row]'],
  ['tool-row-role-status-glyph-spinner', '[data-tool-group]', ':has([data-tool-row] [role=\'status\'] .glyph-spinner)', '[data-tool-group]'],
  ['child-cmdk-root', '[role=\'dialog\']', ':has(> [cmdk-root])', '[role=\'dialog\']'],
  ['child-tree-group-grp-sessions', '[data-tree-split] > div:not([style*=\'display: none\']):not([style*=\'flex: 0 0\']):not([style*=\'flex:0 0\']), [data-tree-split] > div:not([style*=\'display: none\'])', ':has(> [data-tree-group=\'grp-sessions\'])', '[data-tree-split]'],
  ['slot-message', '[data-tree-group]', ':has([data-slot*=\'message\'])', '[data-tree-group]'],
  ['child-button-tour-model-pill-claude-model-paired', '[data-slot=\'composer-root\'] div', ':has(> button[data-tour=\'model-pill\'] + [data-claude-model-paired])', '[data-slot=\'composer-root\']'],
  ['child-claude-mode', '[data-claude-file-name]', ':has(> [data-claude-mode])', '[data-claude-file-name]'],
  ['slot-aui-directive-image-slot-aui-embedded-image', '[data-slot=\'aui_turn-pair\'] > [data-role=\'user\'] + *:not([data-role])', ':has([data-slot=\'aui_directive-image\'], [data-slot=\'aui_embedded-image\'])', '[data-slot=\'aui_turn-pair\']'],
  ['child-button-first-child-span-first-child-is-img-svg', '[data-slot=\'composer-attachments\'] .group\\/attachment', ':has(> button:first-child > span:first-child > :is(img, svg.icon-tabler-photo))', '[data-slot=\'composer-attachments\']'],
  ['child-button-first-child-img', '[data-slot=\'composer-attachments\'] .group\\/attachment', ':has(> button:first-child img)', '[data-slot=\'composer-attachments\']'],
  ['zone-tabstrip', '[data-tree-group=\'grp-main\'] > [data-panel-header], [data-window-top] > [data-panel-header], [data-tree-group=\'grp-main\'][data-window-top] > [data-panel-header]', ':has([data-zone-tabstrip])', '[data-tree-group=\'grp-main\'], [data-window-top], [data-tree-group=\'grp-main\'][data-window-top]'],
  ['child-claude-audio-dictation-true', '[data-slot=\'composer-fade\']', ':has(> [data-claude-audio-dictation=\'true\'])', '[data-slot=\'composer-fade\']'],
  ['child-claude-audio-playback-true', '[data-slot=\'composer-fade\']', ':has(> [data-claude-audio-playback=\'true\'])', '[data-slot=\'composer-fade\']'],
  ['child-button', '[data-slot=\'composer-surface\'] [role=\'status\'][aria-live=\'polite\'], [data-slot=\'composer-fade\'] > [role=\'status\'][aria-live=\'polite\']', ':has(> button)', '[data-slot=\'composer-surface\'], [data-slot=\'composer-fade\']'],
  ['child-div-codicon-error', '[data-slot=\'composer-status-stack\'] [data-slot=\'status-stack-section\'] > [role=\'alert\']', ':has(> div > .codicon-error)', '[data-slot=\'composer-status-stack\']'],
  ['claude-task-section-true', '[data-claude-status-card=\'true\']', ':has([data-claude-task-section=\'true\'])', '[data-claude-status-card=\'true\']'],
  ['child-status-row-icon-codicon-comment', '[data-slot=\'composer-status-stack\'] [data-slot=\'status-row\']', ':has(> .status-row-icon > .codicon-comment)', '[data-slot=\'composer-status-stack\']'],
  ['tour-page-tabs-not-pane-hidden', '[data-tree-group=\'grp-main\'][data-window-top]', ':has([data-tour=\'page-tabs\']:not([data-pane-hidden] *))', '[data-tree-group=\'grp-main\'][data-window-top]'],
  ['child-button-label', '[data-tree-group]:not([data-tree-group=\'grp-sessions\']) [data-zone-tabstrip] [role=\'tab\'] > span:last-child, [data-tree-group]:not([data-tree-group=\'grp-sessions\']) [data-zone-tabstrip] [data-slot=\'pane-tab\'][data-closeable]:not([data-vertical=\'true\']) > span:last-child', ':has(> button[aria-label])', '[data-tree-group]:not([data-tree-group=\'grp-sessions\'])'],
  ['child-div-input-slot-input', 'aside[data-preview-browser] > div:first-child > div', ':has(> div > input[data-slot=\'input\'])', 'aside[data-preview-browser]'],
  ['child-tree-group-aside-preview-browser', '[data-tree-split] > div', ':has(> [data-tree-group] aside[data-preview-browser])', '[data-tree-split]'],
]
// The attributes those conditions read (plus childList): other attribute changes never move a mark.
const CLAUDE_HAS_MARK_ATTRIBUTES = ['aria-expanded', 'aria-label', 'aria-live', 'class', 'cmdk-root', 'data-claude-audio-dictation', 'data-claude-audio-playback', 'data-claude-backend-dock', 'data-claude-chat-look', 'data-claude-file-name', 'data-claude-grip', 'data-claude-mode', 'data-claude-model-paired', 'data-claude-preview-column', 'data-claude-side-column', 'data-claude-status-card', 'data-claude-task-section', 'data-claude-update-anchor', 'data-closeable', 'data-hermes-theme', 'data-pane-hidden', 'data-panel-header', 'data-preview-browser', 'data-project-tree', 'data-role', 'data-sidebar', 'data-slot', 'data-tool-group', 'data-tool-row', 'data-tool-summary', 'data-tour', 'data-tree-group', 'data-tree-split', 'data-tree-tab', 'data-vertical', 'data-window-top', 'data-zone-tabstrip', 'role', 'style']

// A :has() on an ancestor (`A:has(B) C`) made the browser re-check and restyle
// the whole page on every DOM insertion: 80 ms per small change on a busy
// window against 7 ms without. Elements meeting such a condition carry its name
// in data-claude-has instead, kept in step before paint (observer callbacks run
// ahead of rendering); a name change restyles only that element's own rules.
function installClaudeHasMarks({ marks = CLAUDE_HAS_MARKS, attributes = CLAUDE_HAS_MARK_ATTRIBUTES, document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  if (!doc?.documentElement || !win?.MutationObserver) return () => {}
  const sets = marks.map(() => new Set())
  let disposed = false
  // Re-check the rows whose region holds a touched element or an inserted one
  // (or is inside an inserted one); all rows when region is null.
  const mark = (touched, added = []) => {
    if (disposed) return
    const changed = new Set()
    // Rows share regions: each region is tested once per batch.
    const hit = new Map()
    const inRegion = region => {
      if (!hit.has(region)) hit.set(region, touched.some(node => node.closest(region)) || added.some(node => node.closest(region) || node.querySelector(region)))
      return hit.get(region)
    }
    marks.forEach(([, candidates, condition, region], row) => {
      if (touched && region && !inRegion(region)) return
      const next = new Set()
      let nodes = []
      try { nodes = doc.querySelectorAll(candidates) } catch {}
      for (const node of nodes) { try { if (node.matches(condition)) next.add(node) } catch {} }
      const old = sets[row]
      for (const node of next) if (!old.has(node)) changed.add(node)
      for (const node of old) if (!next.has(node)) changed.add(node)
      sets[row] = next
    })
    for (const node of changed) {
      const value = marks.filter((_, row) => sets[row].has(node)).map(([name]) => name).sort().join(' ')
      if (!value) node.removeAttribute('data-claude-has')
      else if (node.getAttribute('data-claude-has') !== value) node.setAttribute('data-claude-has', value)
    }
  }
  // Terminal rows never meet a condition; they change many times a second.
  // Nor does what is typed: an editor's own children (no condition looks
  // inside one; the editor coming or going is its parent's change).
  const observer = new win.MutationObserver(records => {
    const touched = new Set(), added = []
    for (const record of records) {
      const node = record.target.nodeType === 1 ? record.target : record.target.parentElement
      if (!node || node.closest('.xterm')) continue
      if (record.type === 'childList' && node.closest("[contenteditable='true'], textarea")) continue
      touched.add(node)
      for (const child of record.addedNodes) if (child.nodeType === 1) added.push(child)
    }
    if (touched.size) mark([...touched], added)
  })
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: attributes })
  mark()
  return () => {
    disposed = true
    observer.disconnect()
    for (const set of sets) for (const node of set) node.removeAttribute('data-claude-has')
  }
}

const CLAUDE_PANE_TOOLS = [
  { id: 'terminal', icon: 'terminal', label: 'Terminal', pane: 'terminal', side: true, shown: "[data-tree-group='grp-terminal']:not([data-pane-host])",
    native: "[data-slot='statusbar'] button:has(svg[class*='tabler-icon-terminal'])", chord: { key: '`', code: 'Backquote', ctrlKey: true } },
  { id: 'review', icon: 'diff', label: 'Changes', action: 'view.toggleReview', pane: 'review', side: true, shown: "[data-tree-group='grp-review']:not([data-pane-host])" },
  { id: 'browser', icon: 'globe', label: 'Browser', action: 'view.showBrowser', shown: 'aside[data-preview-browser]' },
  { id: 'files', icon: 'folder', label: 'Files', action: 'view.showFiles', closeAction: 'view.toggleRightSidebar', pane: 'files', side: true, shown: "[data-tree-group='grp-files']:not([data-pane-host])" }
]

// Native titlebar tools that Claude keeps behind its overflow menu. Each entry
// clicks the (visually hidden) native button, so Hermes' handlers and labels run.
// Claude Code's pane toggle glyphs, drawn on a 16px grid with a 1.25px
// stroke (traced from its titlebar): a bare prompt, a diff square with +/-,
// a globe with two meridians, and a tabbed folder. Static markup, no input.
const CLAUDE_PANE_ICONS = {
  terminal: '<path d="M3 4.25 6.75 8 3 11.75"/><path d="M8.25 11.75h5"/>',
  diff: '<rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1.5"/><path d="M8 4.75v3.5M6.25 6.5h3.5M6.25 10.75h3.5"/>',
  globe: '<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11"/><path d="M6.4 2.75c-1.2 3.4-1.2 7.1 0 10.5M9.6 2.75c1.2 3.4 1.2 7.1 0 10.5"/>',
  folder: '<path d="M2.75 4.25c0-.55.45-1 1-1h2.6l1.3 1.5h4.6c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-8.5c-.55 0-1-.45-1-1z"/>'
}

// Claude Code's terminal card header: "Terminal +" on the left (with more
// than one terminal, a "Terminal 1 ×  Terminal 2 ×" tab per terminal), an
// expand toggle and close on the right. Hermes' own controls stay the doors:
// a tab presses its terminal in Hermes' terminal list and its × middle-clicks
// it (Hermes' close gesture), + presses New terminal, close presses the
// zone's Hide (a minimized terminal is hidden by the layout CSS). Expand is
// the plugin's: the card covers the workspace right of the session list.
const CLAUDE_TERMINAL_ICONS = {
  add: '<path d="M8 3.25v9.5M3.25 8h9.5"/>',
  folder: '<path d="M2.75 4.25c0-.55.45-1 1-1h2.6l1.3 1.5h4.6c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-8.5c-.55 0-1-.45-1-1z"/>',
  expand: '<path d="M9.5 2.75h3.75V6.5M13.25 2.75 9.25 6.75M6.5 13.25H2.75V9.5M2.75 13.25l4-4"/>',
  collapse: '<path d="M13.25 2.75l-4 4M9.25 3.5v3.25h3.25M2.75 13.25l4-4M6.75 12.5V9.25H3.5"/>',
  tree: '<path d="M6.25 4.5h6.5M6.25 8h6.5M6.25 11.5h6.5"/><circle cx="3.5" cy="4.5" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="11.5" r=".9" fill="currentColor" stroke="none"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  logs: '<rect x="2.75" y="3.25" width="10.5" height="9.5" rx="1.5"/><path d="M2.75 8h10.5M10.25 5.6h.75M10.25 10.4h.75"/>',
  search: '<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25 13.25 13.25"/>',
  more: '<circle cx="8" cy="3.75" r=".95" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".95" fill="currentColor" stroke="none"/><circle cx="8" cy="12.25" r=".95" fill="currentColor" stroke="none"/>'
}

// Claude's browser card holds at most nine tabs.
const CLAUDE_BROWSER_TAB_LIMIT = 9

function installClaudeTerminalHeader({ host: api = typeof host === 'undefined' ? null : host, document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  const root = doc.documentElement
  // Which card covers the workspace: 'terminal', 'files', 'browser' or none.
  const EXPANDED = 'data-claude-expanded'
  let frame = 0, disposed = false, tabLimitTip = null
  const glyph = name => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '1.25')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = CLAUDE_TERMINAL_ICONS[name]
    return svg
  }
  const button = (name, label, onClick) => {
    const element = doc.createElement('button')
    element.type = 'button'
    element.dataset.claudeTerminalAction = name
    element.setAttribute('aria-label', label)
    element.title = label
    element.append(glyph(name))
    // The tab strip is a drag and context-menu surface; keep presses ours.
    element.addEventListener('pointerdown', event => event.stopPropagation())
    element.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); onClick(element) })
    return element
  }
  const list = () => doc.querySelector("ul[aria-label='Terminals']")
  const terminals = () => [...(list()?.querySelectorAll("li > button[role='tab']") || [])]
  // Observers here and in the other installers wake on every attribute write,
  // a same-value one too: loops write only real changes.
  const setAttr = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value) }
  const expanded = () => root.getAttribute(EXPANDED) || ''
  const setExpanded = target => {
    if (target) root.setAttribute(EXPANDED, target)
    else root.removeAttribute(EXPANDED)
    for (const toggle of doc.querySelectorAll("[data-claude-terminal-action='expand']")) {
      const on = toggle.dataset.claudeExpandTarget === target
      const name = { files: 'Files', browser: 'browser' }[toggle.dataset.claudeExpandTarget] || 'terminal'
      if (toggle.getAttribute('aria-pressed') !== (on ? 'true' : 'false') || !toggle.firstChild) toggle.replaceChildren(glyph(on ? 'collapse' : 'expand'))
      setAttr(toggle, 'aria-label', (on ? 'Restore ' : 'Expand ') + name)
      setAttr(toggle, 'title', toggle.getAttribute('aria-label'))
      setAttr(toggle, 'aria-pressed', on ? 'true' : 'false')
    }
  }
  const expandButton = (target, label) => {
    const toggle = button('expand', label, () => setExpanded(expanded() === target ? '' : target))
    toggle.dataset.claudeExpandTarget = target
    return toggle
  }
  // Claude's file tree toggle. What the Files card shows beside an open file
  // (file, tree or both, data-claude-files-view) depends on the card's width
  // too, so installClaudePaneTools owns it; the button only asks for a flip.
  const FILES_VIEW = 'data-claude-files-view'
  const syncTreeButtons = () => {
    const view = root.getAttribute(FILES_VIEW)
    const treeShown = view !== 'file' && view !== 'empty'
    for (const toggle of doc.querySelectorAll("[data-claude-terminal-action='tree']")) {
      setAttr(toggle, 'aria-pressed', treeShown ? 'true' : 'false')
      setAttr(toggle, 'aria-label', treeShown ? 'Hide file tree' : 'Show file tree')
      setAttr(toggle, 'title', toggle.getAttribute('aria-label'))
    }
  }
  const treeButton = () => button('tree', 'Hide file tree', () => root.dispatchEvent(new win.CustomEvent('claude-tree-toggle')))
  // Claude's search: the filter above the tree (installClaudeFileBrowser).
  const searchButton = () => button('search', 'Filter files', () => root.dispatchEvent(new win.CustomEvent('claude-tree-search')))
  // Claude's Files settings menu (installClaudeFileBrowser).
  const moreButton = () => { const more = button('more', 'More options', element => root.dispatchEvent(new win.CustomEvent('claude-files-menu', { detail: element }))); more.setAttribute('aria-haspopup', 'menu'); more.setAttribute('aria-expanded', 'false'); return more }
  const closeFiles = () => {
    if (expanded() === 'files') setExpanded('')
    doc.querySelector("[data-claude-pane-tool='folder']")?.click()
  }
  // Middle-click is Hermes' close for a terminal in its list.
  const closeTerminal = target => {
    for (const type of ['pointerdown', 'pointerup']) target.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, button: 1, buttons: type === 'pointerdown' ? 4 : 0, pointerType: 'mouse' }))
  }
  const syncTabs = (strip, tablist) => {
    const items = terminals()
    let tabs = strip.querySelector("[data-claude-terminal-header='tabs']")
    if (items.length < 2) {
      tabs?.remove()
      delete strip.dataset.claudeTerminalTabs
      return null
    }
    strip.dataset.claudeTerminalTabs = 'true'
    if (!tabs) {
      tabs = doc.createElement('span')
      tabs.dataset.claudeTerminalHeader = 'tabs'
      tabs.setAttribute('role', 'tablist')
      tabs.setAttribute('aria-label', 'Terminals')
    }
    const signature = items.map(item => item.getAttribute('aria-selected')).join(',')
    if (tabs.dataset.signature !== signature) {
      tabs.dataset.signature = signature
      tabs.replaceChildren(...items.map((item, index) => {
        const tab = doc.createElement('span')
        tab.dataset.claudeTerminalTab = String(index + 1)
        tab.setAttribute('role', 'tab')
        tab.setAttribute('aria-selected', item.getAttribute('aria-selected') === 'true' ? 'true' : 'false')
        tab.tabIndex = 0
        const label = doc.createElement('span')
        label.textContent = 'Terminal ' + (index + 1)
        const close = button('close', 'Close Terminal ' + (index + 1), () => closeTerminal(item))
        close.dataset.claudeTerminalAction = 'close-tab'
        tab.append(label, close)
        tab.addEventListener('pointerdown', event => event.stopPropagation())
        tab.addEventListener('click', () => item.click())
        tab.addEventListener('auxclick', event => { if (event.button === 1) { event.preventDefault(); closeTerminal(item) } })
        tab.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click() } })
        return tab
      }))
    }
    if (tablist.nextElementSibling !== tabs) tablist.after(tabs)
    return tabs
  }
  const place = () => {
    frame = 0
    if (disposed) return
    for (const strip of doc.querySelectorAll('[data-zone-tabstrip]')) {
      const isTerminal = Boolean(strip.querySelector("[data-tree-tab='terminal'][role='tab']"))
      // (The browser card's header actions are the browser pass's own.)
      const added = strip.querySelectorAll("[data-claude-terminal-header]:not([data-claude-terminal-header='browser-actions'])")
      if (!isTerminal) { added.forEach(node => node.remove()); continue }
      const tablist = strip.querySelector("[role='tablist']")
      if (!tablist) continue
      let add = strip.querySelector("[data-claude-terminal-header='add']")
      if (!add) {
        add = button('add', 'New terminal', () => list()?.querySelector("button[aria-label='New terminal']")?.click())
        add.dataset.claudeTerminalHeader = 'add'
      }
      const tabs = syncTabs(strip, tablist)
      const before = tabs || tablist
      if (before.nextElementSibling !== add) before.after(add)
      let actions = strip.querySelector("[data-claude-terminal-header='actions']")
      if (!actions) {
        actions = doc.createElement('span')
        actions.dataset.claudeTerminalHeader = 'actions'
        const more = button('more', 'Terminal options', element => root.dispatchEvent(new win.CustomEvent('claude-terminal-menu', { detail: element })))
        more.setAttribute('aria-haspopup', 'menu')
        more.setAttribute('aria-expanded', 'false')
        actions.append(
          more,
          expandButton('terminal', 'Expand terminal'),
          button('close', 'Close terminal', () => {
            strip.querySelector("button[aria-label='Hide']")?.click()
            if (expanded() === 'terminal') setExpanded('')
          })
        )
        setExpanded(expanded())
      }
      if (strip.lastElementChild !== actions) strip.append(actions)
    }
    // Claude Code's browser card. Its zone header shows the tab ("New tab" on a
    // blank page) and +, then the logs toggle (Hermes' preview console), the
    // ⋮ menu, expand and close; the address reads "Type a URL" and the blank
    // page Claude's empty state (layout CSS on the marks set here).
    repairMisplaced()
    guardClosed()
    for (const strip of doc.querySelectorAll('[data-zone-tabstrip]')) {
      const asideOf = tab => doc.querySelector('aside[data-preview-browser="' + win.CSS.escape((tab.getAttribute('data-tree-tab') || '').slice('preview-tile:'.length)) + '"]')
      const active = strip.querySelector("[role='tab'][aria-selected='true'][data-tree-tab^='preview-tile:url:']")
      const aside = active && asideOf(active)
      let actions = strip.querySelector("[data-claude-terminal-header='browser-actions']")
      if (!aside) {
        actions?.remove()
        if (strip.hasAttribute('data-claude-browser-strip')) strip.removeAttribute('data-claude-browser-strip')
        continue
      }
      setAttr(strip, 'data-claude-browser-strip', '')
      for (const tab of strip.querySelectorAll("[role='tab'][data-tree-tab^='preview-tile:url:']")) {
        const address = asideOf(tab)?.querySelector("input[aria-label='Address']")?.value || ''
        const blank = !address || address === 'about:blank'
        if (tab.hasAttribute('data-claude-blank') !== blank) tab.toggleAttribute('data-claude-blank', blank)
      }
      // Claude's tab limit: at nine tabs + is off until one is closed.
      const newTab = strip.querySelector("button[aria-label='New tab']")
      const full = strip.querySelectorAll("[role='tab'][data-tree-tab^='preview-tile:url:']").length >= CLAUDE_BROWSER_TAB_LIMIT
      if (newTab && newTab.hasAttribute('data-claude-tab-limit') !== full) newTab.toggleAttribute('data-claude-tab-limit', full)
      if (!full && tabLimitTip && !tabLimitTip.hidden) tabLimitTip.hidden = true
      const consoleButton = aside.querySelector("button[aria-label$='preview console']")
      if (!actions) {
        actions = doc.createElement('span')
        actions.dataset.claudeTerminalHeader = 'browser-actions'
        const logs = button('logs', 'Show console', () => {
          const native = doc.querySelector("[data-claude-terminal-header='browser-actions']")?.closest('[data-zone-tabstrip]') && [...doc.querySelectorAll("aside[data-preview-browser] button[aria-label$='preview console']")].find(node => node.closest('aside').checkVisibility({ visibilityProperty: true }))
          native?.click()
          schedule()
        })
        logs.dataset.claudeBrowserLogs = ''
        const more = button('more', 'Browser options', element => root.dispatchEvent(new win.CustomEvent('claude-browser-menu', { detail: element })))
        more.setAttribute('aria-haspopup', 'menu')
        more.setAttribute('aria-expanded', 'false')
        actions.append(logs, more, expandButton('browser', 'Expand browser'), button('close', 'Close browser', () => {
          setKeptClosed(true)
          // (The keep-closed guard waits while this closes the card itself.)
          guarding = true
          if (expanded() === 'browser') setExpanded('')
          // The other tabs close, then the Browser toggle puts the last one
          // away (it toggles one tab of its own, not whichever shows). Hermes'
          // Hide only minimizes the zone, which then holds the side's sash.
          let rounds = 0
          const step = () => {
            if (disposed || !browserShown() || ++rounds > CLAUDE_BROWSER_TAB_LIMIT + 3) { guarding = false; return }
            const tabs = [...(actions.closest('[data-zone-tabstrip]') || strip).querySelectorAll("[role='tab'][data-tree-tab^='preview-tile:url:']")]
            const other = tabs.length > 1 && tabs.find(tab => tab.getAttribute('aria-selected') !== 'true')
            if (other) other.querySelector("button[aria-label='Close']")?.click()
            else doc.querySelector("[data-claude-pane-tool='globe'][aria-pressed='true']")?.click()
            win.setTimeout(step, 250)
          }
          step()
        }))
        setExpanded(expanded())
      }
      const logs = actions.querySelector('[data-claude-browser-logs]')
      const logsOn = consoleButton?.getAttribute('aria-pressed') === 'true'
      setAttr(logs, 'aria-pressed', logsOn ? 'true' : 'false')
      setAttr(logs, 'aria-label', logsOn ? 'Hide console' : 'Show console')
      setAttr(logs, 'title', logs.getAttribute('aria-label'))
      // Moved only when it left the strip: Hermes adds to the strip on a press,
      // and moving the buttons between press and release loses the click.
      if (actions.parentElement !== strip) strip.append(actions)
    }
    for (const aside of doc.querySelectorAll('aside[data-preview-browser]')) {
      const input = aside.querySelector("input[aria-label='Address']")
      if (input && input.placeholder !== 'Type a URL') {
        if (!('claudeNativePlaceholder' in input.dataset)) input.dataset.claudeNativePlaceholder = input.placeholder
        input.placeholder = 'Type a URL'
      }
      const empty = aside.querySelector('i.codicon-globe')?.parentElement
      if (empty && !empty.hasAttribute('data-claude-browser-empty')) empty.setAttribute('data-claude-browser-empty', '')
    }
    // The Files card: Hermes' project header row becomes Claude's "Files"
    // header (layout CSS), with expand and close at its end.
    const filesHeader = doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [class*='group/project-header']")
    if (filesHeader) {
      setAttr(filesHeader, 'data-claude-files-header', 'true')
      let actions = filesHeader.querySelector("[data-claude-terminal-header='files-actions']")
      if (!actions) {
        actions = doc.createElement('span')
        actions.dataset.claudeTerminalHeader = 'files-actions'
        actions.append(searchButton(), treeButton(), moreButton(), expandButton('files', 'Expand Files'), button('close', 'Close Files', closeFiles))
        setExpanded(expanded())
        syncTreeButtons()
      }
      if (filesHeader.lastElementChild !== actions) filesHeader.append(actions)
    }
    // A previewed file's mode bar becomes Claude's path row: the file name on
    // the left and one toggle between the rendered view and the source (an
    // eye or </>). Hermes' own mode buttons stay the doors; the plugin only
    // marks which is which.
    for (const tab of doc.querySelectorAll("[data-tree-group]:not([data-pane-host]) [role='tab'][aria-selected='true'][data-tree-tab^='preview-tile:file:']")) {
      const zone = tab.closest('[data-tree-group]')
      let name = ''
      try { name = decodeURIComponent((tab.getAttribute('data-tree-tab') || '').split('/').pop() || '') } catch { name = '' }
      for (const bar of zone.querySelectorAll("div[class~='h-7'][class~='justify-end'][class~='border-b']")) {
        if (bar.dataset.claudeFileName !== name) bar.dataset.claudeFileName = name
        for (const mode of bar.querySelectorAll(':scope > button')) {
          const text = mode.textContent.trim()
          const kind = /source|forr/i.test(text) ? 'source' : /render|preview|el.n.zet/i.test(text) ? 'rendered' : 'diff'
          if (mode.dataset.claudeMode !== kind) mode.dataset.claudeMode = kind
          // The active mode carries Hermes' underline class; the CSS reads that.
          const title = kind === 'source' ? 'View source' : kind === 'rendered' ? 'Preview' : text
          if (mode.title !== title) mode.title = title
        }
      }
    }
    // Claude's empty Files state, shown in place of the tree when the tree is
    // toggled off with no file open (data-claude-files-view='empty').
    const projectTree = doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
    if (projectTree && projectTree.nextElementSibling?.hasAttribute('data-claude-files-empty') !== true) {
      doc.querySelectorAll('[data-claude-files-empty]').forEach(node => node.remove())
      const empty = doc.createElement('div')
      empty.setAttribute('data-claude-files-empty', '')
      const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
      icon.setAttribute('viewBox', '0 0 16 16')
      icon.setAttribute('fill', 'none')
      icon.setAttribute('stroke', 'currentColor')
      icon.setAttribute('stroke-width', '1.1')
      icon.setAttribute('stroke-linejoin', 'round')
      icon.setAttribute('aria-hidden', 'true')
      icon.innerHTML = CLAUDE_TERMINAL_ICONS.folder
      const title = doc.createElement('strong')
      title.textContent = 'Open files appear here'
      const hint = doc.createElement('span')
      hint.textContent = 'Click a file path in the conversation to open it.'
      // Beside the tree Claude points at it too.
      const splitHint = doc.createElement('span')
      splitHint.setAttribute('data-claude-files-empty-split', '')
      splitHint.textContent = 'Pick a file in the tree, or click a file path in the conversation.'
      empty.append(icon, title, hint, splitHint)
      projectTree.after(empty)
    }
    // With the tree hidden the Files header is off screen; its tools move to
    // the end of the file's own header, as in Claude Code.
    const fileStrip = (root.hasAttribute('data-claude-file-joined') || root.hasAttribute('data-claude-file-over')) && doc.querySelector('[data-claude-preview-column] [data-zone-tabstrip]')
    for (const node of doc.querySelectorAll("[data-claude-file-actions]")) if (node.parentElement !== fileStrip) node.remove()
    if (fileStrip) {
      let actions = fileStrip.querySelector("[data-claude-file-actions]")
      if (!actions) {
        actions = doc.createElement('span')
        actions.dataset.claudeFileActions = 'true'
        actions.append(searchButton(), treeButton(), moreButton(), expandButton('files', 'Expand Files'), button('close', 'Close Files', closeFiles))
        setExpanded(expanded())
        syncTreeButtons()
      }
      if (fileStrip.lastElementChild !== actions) fileStrip.append(actions)
    }
    syncTreeButtons()
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  const browserShown = () => [...doc.querySelectorAll('aside[data-preview-browser]')].some(node => node.checkVisibility({ visibilityProperty: true }))
  // Closed by the user, the browser stays closed: Hermes reshows a session's
  // saved browser tab when that session comes back, which looked like the
  // browser opening on its own. It opens again only when asked: the Browser
  // button, a link clicked, or the agent opening a page (preview.open). The
  // choice outlives a restart. A browser that shows otherwise is closed for
  // good, its tab with it, so it does not come back with the session.
  const KEPT_CLOSED = 'claude-skin:browser-kept-closed'
  let keptClosed = false, allowUntil = 0, guarding = false, passClose = false, keyUntil = 0, wasShown = null
  try { keptClosed = win.localStorage.getItem(KEPT_CLOSED) === '1' } catch { keptClosed = false }
  const setKeptClosed = on => {
    keptClosed = on
    // (Closing ends any leave the last opening gave.)
    if (on) allowUntil = 0
    try { if (on) win.localStorage.setItem(KEPT_CLOSED, '1'); else win.localStorage.removeItem(KEPT_CLOSED) } catch {}
  }
  const allowOpen = () => { allowUntil = Date.now() + 5000; setKeptClosed(false) }
  const shutBrowser = () => {
    guarding = true
    let rounds = 0
    const step = () => {
      const strip = [...doc.querySelectorAll('[data-claude-browser-strip]')].find(node => node.checkVisibility())
      const tab = strip?.querySelector("[role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close']")
      if (disposed || !keptClosed || !tab || ++rounds > CLAUDE_BROWSER_TAB_LIMIT + 3) { guarding = false; return }
      passClose = true
      try { tab.click() } finally { passClose = false }
      win.setTimeout(step, 200)
    }
    step()
  }
  const guardClosed = () => {
    const shown = browserShown(), changed = wasShown !== null && shown !== wasShown
    wasShown = shown
    // A keyboard shortcut is the user too: what it opens stays, what it closes stays closed.
    if (changed && !guarding && Date.now() < keyUntil) { if (shown) allowOpen(); else setKeptClosed(true); return }
    if (keptClosed && !guarding && Date.now() > allowUntil && shown) shutBrowser()
  }
  const onIntent = event => {
    if (!event.isTrusted) return
    const target = event.target
    if (target?.closest?.("[data-claude-pane-tool='globe']")) { if (browserShown()) setKeptClosed(true); else allowOpen(); return }
    // Any other pane or side toggle, or a link: the user asked for what shows next.
    if (target?.closest?.('[data-claude-pane-tool], a[href]')) allowOpen()
  }
  const onKeyIntent = event => {
    if (!event.isTrusted || !(event.ctrlKey || event.metaKey || event.altKey) || /^(Control|Meta|Alt|Shift)$/.test(event.key)) return
    keyUntil = Date.now() + 1500
    // Hermes may toggle after the press: look again once it has.
    win.setTimeout(guardClosed, 120)
    win.setTimeout(guardClosed, 400)
  }
  const offPreviewOpen = typeof api?.onEvent === 'function' ? api.onEvent('preview.open', allowOpen) : null
  // Hermes remembers where to dock a browser tab from the tab it was opened
  // beside; when that tab is gone by the time it comes back, it docks into
  // the main area, next to the conversation. Claude's browser is its own card:
  // the stray tab closes and the Browser button opens a fresh one (which docks
  // to the right) on the same page.
  let repairs = []
  const repairMisplaced = () => {
    const tab = doc.querySelector("[data-tree-group='grp-main']:not([data-pane-host]) > [data-panel-header] [role='tab'][data-tree-tab^='preview-tile:url:']")
    if (!tab) return
    const now = Date.now()
    repairs = repairs.filter(time => now - time < 15000)
    if (repairs.length >= 3) return
    repairs.push(now)
    const id = (tab.getAttribute('data-tree-tab') || '').slice('preview-tile:'.length)
    const webview = doc.querySelector('aside[data-preview-browser="' + win.CSS.escape(id) + '"] webview')
    let url = ''
    try { url = webview?.getURL() || '' } catch { url = '' }
    tab.querySelector("button[aria-label='Close']")?.click()
    win.setTimeout(() => {
      if (disposed || browserShown()) return
      doc.querySelector("[data-claude-pane-tool='globe']")?.click()
      if (!url || url === 'about:blank') return
      let tries = 0
      const go = () => {
        if (disposed) return
        const input = [...doc.querySelectorAll("aside[data-preview-browser] input[aria-label='Address']")].find(node => node.closest('aside').checkVisibility({ visibilityProperty: true }))
        if (!input) { if (++tries < 20) win.setTimeout(go, 100); return }
        Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, url)
        input.dispatchEvent(new win.Event('input', { bubbles: true }))
        input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
        input.blur()
      }
      win.setTimeout(go, 200)
    }, 250)
  }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, statusbar, popper, editor, diffs, the session list's rows)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [data-tree-group='grp-sessions'] *, [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed', 'value'] })
  observer.observe(root, { attributes: true, attributeFilter: ['data-claude-file-joined', 'data-claude-file-over', FILES_VIEW] })
  // The address changes without a DOM change of its own (React keeps the
  // value property); a navigation retitles the tab, and typing fires input.
  const onAddress = event => { if (event.target?.matches?.("aside[data-preview-browser] input[aria-label='Address']")) schedule() }
  doc.addEventListener('input', onAddress, true)
  doc.addEventListener('focusout', onAddress, true)
  // The pane toggles act on what is on screen; restore the layout first so
  // they see (and toggle) the panes the expanded terminal covers.
  const onPaneTool = event => { if (expanded() && event.target?.closest?.('[data-claude-pane-tool]')) setExpanded('') }
  doc.addEventListener('click', onPaneTool, true)
  // At the limit, + takes no click and explains itself on hover.
  const limited = event => event.target?.closest?.('button[data-claude-tab-limit]')
  const onLimitPress = event => { if (limited(event)) { event.preventDefault(); event.stopImmediatePropagation() } }
  const onLimitOver = event => {
    const button = limited(event)
    if (!button) { if (tabLimitTip && !tabLimitTip.hidden) tabLimitTip.hidden = true; return }
    if (!tabLimitTip) {
      tabLimitTip = doc.createElement('div')
      tabLimitTip.setAttribute('data-claude-tab-limit-tip', '')
      tabLimitTip.setAttribute('role', 'tooltip')
      tabLimitTip.textContent = 'Tab limit reached. Close a tab to open a new one.'
      doc.body.append(tabLimitTip)
    }
    const box = button.getBoundingClientRect()
    tabLimitTip.hidden = false
    const width = tabLimitTip.offsetWidth
    tabLimitTip.style.left = Math.max(8, Math.min(win.innerWidth - width - 8, box.left + box.width / 2 - width / 2)) + 'px'
    tabLimitTip.style.top = (box.bottom + 6) + 'px'
  }
  for (const type of ['pointerdown', 'mousedown', 'click']) doc.addEventListener(type, onLimitPress, true)
  // Closing the last tab keeps the card, as Claude's does: a page gives way to
  // a new tab, and a lone new tab stays (the header's × closes the card).
  const lastTabClose = event => {
    if (passClose) return
    // The tab's × or a middle press on the tab.
    const middle = event.button === 1
    const tab = middle
      ? event.target?.closest?.("[data-claude-browser-strip] [role='tab'][data-tree-tab^='preview-tile:url:']")
      : event.target?.closest?.("[data-claude-browser-strip] [role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close']")?.closest("[role='tab']")
    const strip = tab?.closest('[data-claude-browser-strip]')
    // Only the browser's own zone: a browser tab sharing a strip with other
    // panes closes as Hermes closes it.
    const tabs = strip?.querySelectorAll("[role='tab']")
    if (!strip || tabs.length !== 1) return
    // In a new session not yet sent (no stored id) the tab has no owner, and
    // Hermes shows ownerless tabs in every new session: a kept blank tab would
    // open the browser in each. There it closes as Hermes closes it.
    let stored = 'unknown'
    try { const atom = api?.state?.focusedStoredSessionId; if (atom?.get) stored = atom.get() ?? null } catch { stored = 'unknown' }
    if (stored === null) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.type !== (middle ? 'auxclick' : 'click')) return
    if (tab.hasAttribute('data-claude-blank')) return
    // The same tab becomes a new one: a blank page, its history cleared. (A
    // fresh tab opened beside a closing one loses its anchor, and Hermes then
    // docks it into the main area.)
    const aside = doc.querySelector('aside[data-preview-browser="' + win.CSS.escape((tab.getAttribute('data-tree-tab') || '').slice('preview-tile:'.length)) + '"]')
    const input = aside?.querySelector("input[aria-label='Address']")
    const webview = aside?.querySelector('webview')
    if (!input) return
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, 'about:blank')
    input.dispatchEvent(new win.Event('input', { bubbles: true }))
    input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
    input.blur()
    let tries = 0
    const forget = () => {
      if (disposed || !webview?.isConnected) return
      let url = ''
      try { url = webview.getURL() } catch { url = '' }
      // A reload has Hermes read the (now empty) history for its back button.
      if (url === 'about:blank') { try { webview.clearHistory(); webview.reload() } catch {} schedule(); return }
      if (++tries < 40) win.setTimeout(forget, 50)
    }
    win.setTimeout(forget, 50)
  }
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'auxclick']) doc.addEventListener(type, lastTabClose, true)
  doc.addEventListener('pointerover', onLimitOver, true)
  doc.addEventListener('pointerdown', onIntent, true)
  doc.addEventListener('keydown', onKeyIntent, true)
  place()
  return () => {
    disposed = true
    observer.disconnect()
    doc.removeEventListener('click', onPaneTool, true)
    for (const type of ['pointerdown', 'mousedown', 'click']) doc.removeEventListener(type, onLimitPress, true)
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'auxclick']) doc.removeEventListener(type, lastTabClose, true)
    doc.removeEventListener('pointerover', onLimitOver, true)
    doc.removeEventListener('pointerdown', onIntent, true)
    doc.removeEventListener('keydown', onKeyIntent, true)
    if (typeof offPreviewOpen === 'function') offPreviewOpen()
    tabLimitTip?.remove()
    doc.querySelectorAll('[data-claude-tab-limit]').forEach(node => node.removeAttribute('data-claude-tab-limit'))
    doc.removeEventListener('input', onAddress, true)
    doc.removeEventListener('focusout', onAddress, true)
    doc.querySelectorAll('[data-claude-browser-strip]').forEach(node => node.removeAttribute('data-claude-browser-strip'))
    doc.querySelectorAll('[data-claude-blank]').forEach(node => node.removeAttribute('data-claude-blank'))
    doc.querySelectorAll('[data-claude-browser-empty]').forEach(node => node.removeAttribute('data-claude-browser-empty'))
    doc.querySelectorAll('aside[data-preview-browser] input[data-claude-native-placeholder]').forEach(input => { input.placeholder = input.dataset.claudeNativePlaceholder; delete input.dataset.claudeNativePlaceholder })
    if (frame) win.cancelAnimationFrame(frame)
    doc.querySelectorAll('[data-claude-terminal-header]').forEach(node => node.remove())
    doc.querySelectorAll('[data-claude-terminal-tabs]').forEach(node => { delete node.dataset.claudeTerminalTabs })
    doc.querySelectorAll('[data-claude-files-header]').forEach(node => { delete node.dataset.claudeFilesHeader })
    doc.querySelectorAll('[data-claude-file-actions]').forEach(node => node.remove())
    doc.querySelectorAll('[data-claude-files-empty]').forEach(node => node.remove())
    root.removeAttribute(EXPANDED)
  }
}

// Claude Code's file browsing in the Files card, through Hermes' own doors:
//  - One click on a file in the tree opens it as the preview tab (italic),
//    which the next single-clicked file replaces; a double click on the file
//    or on its tab, or editing it, keeps it as its own tab. Hermes opens a
//    file on a double click, so after Hermes' own click (select) the plugin
//    replays one, then closes the previous preview tab once the new one is in.
//  - The filter field above the tree lists the project through Hermes' file
//    API (the gateway's /api/fs/list for a remote backend, the desktop
//    bridge's readDir for a local one) and opens a match through the tree's
//    own onPreviewFile.
//  - </> on a Markdown file opens Hermes' editor; the eye leaves it, saving
//    first when something changed. Ctrl+S saves and stays in the editor;
//    Escape with unsaved changes does not throw them away.
//  - The ⋮ menu holds Claude's Files settings. Editor settings reach Hermes'
//    editor through CodeMirror's public API on its own view (one compartment
//    the plugin adds and alone reconfigures); nothing of Hermes' is replaced,
//    and a piece the plugin cannot find simply stays off. Auto save saves
//    through Hermes' own Save (a remote file is not watched, so a direct
//    write would leave Hermes' view stale): when the editor loses focus, its
//    tab closes or the eye is pressed.
const CLAUDE_FILTER_SKIP = new Set(['node_modules', '.git', '.hg', '.svn', '__pycache__', '.venv', 'venv', '.tox', '.mypy_cache', '.pytest_cache', '.ruff_cache', '.next', '.nuxt', '.turbo', '.cache', '.gradle', '.idea', '.vs', 'dist', 'build', 'target', 'coverage', '.npm', '.nuget', '.yarn', '.cargo', '.rustup', '.dotnet', '.docker'])
const CLAUDE_FILTER_MAX = 40000
const CLAUDE_FILTER_SHOWN = 200
const CLAUDE_FILE_ICONS = {
  search: '<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25 13.25 13.25"/>',
  preview: '<path d="M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/>',
  done: '<path d="M3.25 8.25 6.5 11.5l6.25-7"/>',
  check: '<path d="M3.5 8.25 6.5 11.25 12.5 4.75"/>',
  chevron: '<path d="M6.25 3.75 10.5 8l-4.25 4.25"/>',
  chevronDown: '<path d="M4 6.25 8 10.25l4-4"/>',
  close: '<path d="M4.75 4.75l6.5 6.5M11.25 4.75l-6.5 6.5"/>'
}
// Claude's Files settings (the card's ⋮ menu), kept by the plugin.
const CLAUDE_FILES_SETTINGS_KEY = 'claude-chat-look.files-settings'
// Claude's terminal settings (the terminal card's ⋮ menu).
const CLAUDE_TERMINAL_SETTINGS_KEY = 'claude-chat-look.terminal-settings'
const CLAUDE_TERMINAL_DEFAULTS = { cursorStyle: 'block', cursorBlink: true, copyOnSelect: false, scrollback: 10000 }
const CLAUDE_FILES_DEFAULTS = { treePosition: 'auto', previewTabs: true, autoSave: true, tabIndents: true, wordWrap: true, indentGuides: true, showWhitespace: false, scrollPastEnd: false, tabSize: 4 }

// Claude Code's browser annotate. The picker in the bar opens a floating
// toolbar over the page: select elements, draw (pen, line, arrow, rectangle,
// ellipse, numbered steps, text) in a colour and stroke, then Add to chat
// hands the view with its marks and the picked elements to the composer.
// Picking and drawing live in the page, in an overlay of their own (a shadow
// root above everything, the page itself untouched); the toolbar is ours.
// Hermes' own comment mode stays behind its button, unused.
const CLAUDE_ANNOTATE_COLORS = ['#e5484d', '#3b82f6', '#30a46c', '#1c1c1c', '#ffffff']
const CLAUDE_ANNOTATE_WIDTHS = [2, 4, 7, 11]
const CLAUDE_ANNOTATE_SHAPES = [['line', 'Line'], ['arrow', 'Arrow'], ['rectangle', 'Rectangle'], ['ellipse', 'Ellipse'], ['step', 'Step']]
const CLAUDE_ANNOTATE_ICONS = {
  select: '<path d="M3.75 2.75 12.5 6.6 8.9 7.8l3.35 3.35-1.35 1.35L7.55 9.15l-1.2 3.6z"/>',
  pen: '<path d="M10.6 2.9a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5l-3 .8.8-3z"/><path d="m9.6 3.9 2.3 2.3"/>',
  line: '<path d="M3 13 13 3"/>',
  arrow: '<path d="M3 13 13 3"/><path d="M7 3h6v6"/>',
  rectangle: '<rect x="3" y="3.5" width="10" height="9" rx="1"/>',
  ellipse: '<circle cx="8" cy="8" r="5"/>',
  step: '<circle cx="8" cy="8" r="5.5"/><path d="M7.2 6.4 8.4 5.6v5"/>',
  text: '<path d="M3.5 3.5h9M8 3.5v9.5M6.2 13h3.6"/>',
  chevron: '<path d="m5 6.5 3 3 3-3"/>',
  close: '<path d="m4 4 8 8M12 4l-8 8"/>',
  check: '<path d="m3.5 8.5 3 3 6-7"/>'
}

// Runs inside the page (webview.executeJavaScript), so it closes over nothing.
function claudeAnnotatePage() {
  if (window.__claudeAnnotate) return
  const NS = 'http://www.w3.org/2000/svg'
  const host = document.createElement('claude-annotate')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:auto;cursor:default;'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = '<style>' +
    '.box{position:fixed;pointer-events:none;box-sizing:border-box}' +
    '.m{background:rgba(246,178,107,.66)}.p{background:rgba(147,196,125,.55)}.c{background:rgba(111,168,220,.66)}' +
    '.pick{position:fixed;pointer-events:none;box-sizing:border-box;border:2px solid #3b82f6;border-radius:2px;background:rgba(59,130,246,.12)}' +
    '.pick b{position:absolute;top:-9px;left:-9px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:#3b82f6;color:#fff;font:600 11px/18px system-ui,sans-serif;text-align:center}' +
    '.card{position:fixed;display:none;min-width:160px;max-width:260px;padding:8px 10px;border-radius:4px;background:#fff;color:#222;font:12px/1.55 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.35);pointer-events:none}' +
    '.card .h,.card .r{display:flex;justify-content:space-between;gap:18px}.card .t{color:#881280;font-weight:600}.card .s,.card .r span:first-child{color:#555}' +
    '.card .a{margin:7px 0 3px;padding-bottom:3px;border-bottom:1px solid #ddd;font-size:10px;letter-spacing:.06em;color:#444;font-weight:600}' +
    'svg{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}' +
    '.text{position:fixed;min-width:6px;padding:1px 2px;outline:none;white-space:pre;font:600 16px/1.25 system-ui,sans-serif;cursor:text}' +
    '.text[contenteditable=true]{outline:1px dashed currentColor}' +
    '</style>'
  const svg = document.createElementNS(NS, 'svg')
  const hover = ['m', 'p', 'c'].map(name => { const d = document.createElement('div'); d.className = 'box ' + name; d.style.display = 'none'; return d })
  const card = document.createElement('div')
  card.className = 'card'
  const pickLayer = document.createElement('div')
  root.append(...hover, pickLayer, svg, card)
  const state = { tool: 'select', shape: 'rectangle', color: '#e5484d', width: 4, version: 0, ended: false }
  const marks = [] // svg nodes and text divs, in drawing order
  const picks = [] // { element, box }
  const history = [] // what an undo takes back: ['mark', node] | ['pick', element]
  const bump = () => { state.version++ }
  const under = (x, y) => {
    host.style.pointerEvents = 'none'
    const element = document.elementFromPoint(x, y)
    host.style.pointerEvents = 'auto'
    return element && element !== host && element !== document.documentElement ? element : null
  }
  const ROLES = { a: el => el.hasAttribute('href') ? 'link' : 'generic', article: 'article', aside: 'complementary', button: 'button', dialog: 'dialog', footer: 'contentinfo', form: 'form', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading', header: 'banner', hr: 'separator', img: 'img', li: 'listitem', main: 'main', nav: 'navigation', ol: 'list', option: 'option', p: 'paragraph', progress: 'progressbar', section: 'region', select: 'combobox', table: 'table', tbody: 'rowgroup', td: 'cell', textarea: 'textbox', th: 'columnheader', thead: 'rowgroup', tr: 'row', ul: 'list', label: 'LabelText', body: 'generic', div: 'generic', span: 'generic',
    input: el => ({ checkbox: 'checkbox', radio: 'radio', range: 'slider', button: 'button', submit: 'button', reset: 'button', search: 'searchbox', number: 'spinbutton' })[el.type] || 'textbox' }
  const roleOf = el => { const own = el.getAttribute('role'); if (own) return own; const r = ROLES[el.localName]; return typeof r === 'function' ? r(el) : r || 'generic' }
  const FROM_CONTENT = new Set(['button', 'link', 'heading', 'listitem', 'option', 'cell', 'columnheader', 'tab', 'menuitem', 'checkbox', 'radio'])
  const clip = (text, n) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
  const nameOf = el => {
    const label = el.getAttribute('aria-label'); if (label) return clip(label, 80)
    const by = el.getAttribute('aria-labelledby'); if (by) return clip(by.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '), 80)
    if (el.localName === 'img') return clip(el.getAttribute('alt'), 80)
    if (el.labels?.length) return clip(el.labels[0].textContent, 80)
    if (FROM_CONTENT.has(roleOf(el))) return clip(el.textContent, 80)
    return clip(el.getAttribute('title'), 80)
  }
  const focusable = el => el.tabIndex >= 0 && !el.disabled && el.getAttribute('aria-hidden') !== 'true'
  const selectorOf = el => {
    const parts = []
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      if (node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length === 1) { parts.unshift('#' + CSS.escape(node.id)); break }
      let part = node.localName
      const same = node.parentElement ? [...node.parentElement.children].filter(n => n.localName === node.localName) : []
      if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')'
      parts.unshift(part)
    }
    return parts.join(' > ')
  }
  const place = (node, x, y, w, h) => { node.style.left = x + 'px'; node.style.top = y + 'px'; node.style.width = Math.max(0, w) + 'px'; node.style.height = Math.max(0, h) + 'px' }
  const hideHover = () => { hover.forEach(d => { d.style.display = 'none' }); card.style.display = 'none' }
  const showHover = el => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const n = k => parseFloat(s[k]) || 0
    const mt = n('marginTop'), mr = n('marginRight'), mb = n('marginBottom'), ml = n('marginLeft')
    const bt = n('borderTopWidth') + n('paddingTop'), br = n('borderRightWidth') + n('paddingRight'), bb = n('borderBottomWidth') + n('paddingBottom'), bl = n('borderLeftWidth') + n('paddingLeft')
    place(hover[0], r.left - ml, r.top - mt, r.width + ml + mr, r.height + mt + mb)
    place(hover[1], r.left, r.top, r.width, r.height)
    place(hover[2], r.left + bl, r.top + bt, r.width - bl - br, r.height - bt - bb)
    hover.forEach(d => { d.style.display = 'block' })
    const size = (Math.round(r.width * 10) / 10) + ' × ' + (Math.round(r.height * 10) / 10)
    card.textContent = ''
    const row = (cls, a, b) => { const d = document.createElement('div'); d.className = cls; const x = document.createElement('span'); x.textContent = a; const y = document.createElement('span'); y.textContent = b; d.append(x, y); return d }
    const head = row('h', el.localName, size)
    head.firstChild.className = 't'
    head.lastChild.className = 's'
    const section = document.createElement('div')
    section.className = 'a'
    section.textContent = 'ACCESSIBILITY'
    card.append(head, section, row('r', 'Name', nameOf(el)), row('r', 'Role', roleOf(el)), row('r', 'Keyboard-focusable', focusable(el) ? '✓' : '⃠'))
    card.style.display = 'block'
    const cw = card.offsetWidth, ch = card.offsetHeight
    const below = r.bottom + mb + 8
    const top = below + ch < innerHeight ? below : Math.max(4, r.top - mt - ch - 8)
    card.style.left = Math.max(4, Math.min(innerWidth - cw - 4, r.left)) + 'px'
    card.style.top = Math.min(innerHeight - ch - 4, top) + 'px'
  }
  const layoutPicks = () => picks.forEach(({ element, box }) => { const r = element.getBoundingClientRect(); place(box, r.left, r.top, r.width, r.height) })
  const togglePick = el => {
    const at = picks.findIndex(p => p.element === el)
    if (at >= 0) { picks[at].box.remove(); picks.splice(at, 1) } else {
      const box = document.createElement('div')
      box.className = 'pick'
      box.append(document.createElement('b'))
      pickLayer.append(box)
      picks.push({ element: el, box })
      history.push(['pick', el])
    }
    picks.forEach((p, i) => { p.box.firstChild.textContent = String(i + 1) })
    layoutPicks()
    bump()
  }
  const shape = (name, attrs) => { const node = document.createElementNS(NS, name); for (const k in attrs) node.setAttribute(k, attrs[k]); return node }
  const stroke = () => ({ stroke: state.color, 'stroke-width': state.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' })
  const arrowHead = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), len = 8 + state.width * 2.2
    const p = s => (x2 - len * Math.cos(a + s)) + ',' + (y2 - len * Math.sin(a + s))
    return p(0.45) + ' ' + x2 + ',' + y2 + ' ' + p(-0.45)
  }
  const drawShape = (node, kind, x1, y1, x2, y2) => {
    if (kind === 'line' || kind === 'arrow') {
      node.firstChild.setAttribute('d', 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2)
      if (kind === 'arrow') node.lastChild.setAttribute('points', arrowHead(x1, y1, x2, y2))
    } else if (kind === 'rectangle') {
      Object.entries({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }).forEach(([k, v]) => node.firstChild.setAttribute(k, v))
    } else {
      Object.entries({ cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, rx: Math.abs(x2 - x1) / 2, ry: Math.abs(y2 - y1) / 2 }).forEach(([k, v]) => node.firstChild.setAttribute(k, v))
    }
  }
  const addMark = node => { marks.push(node); history.push(['mark', node]); bump() }
  let drag = null, editing = null
  const commitText = () => {
    const node = editing
    editing = null
    if (!node) return
    node.contentEditable = 'false'
    if (!node.textContent.trim()) { node.remove(); return }
    addMark(node)
  }
  const startText = (x, y) => {
    const node = document.createElement('div')
    node.className = 'text'
    node.style.color = state.color
    node.style.fontSize = (12 + state.width * 2) + 'px'
    node.style.left = x + 'px'
    node.style.top = (y - 10) + 'px'
    node.contentEditable = 'true'
    root.append(node)
    editing = node
    setTimeout(() => node.focus(), 0)
  }
  host.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    if (editing && event.composedPath().includes(editing)) return
    commitText()
    const x = event.clientX, y = event.clientY
    const tool = state.tool === 'shape' ? state.shape : state.tool
    if (tool === 'select') { const el = under(x, y); if (el) togglePick(el); return }
    if (tool === 'text') { event.preventDefault(); startText(x, y); return }
    if (tool === 'step') {
      const n = marks.filter(m => m.dataset?.step).length + 1
      const r = 9 + state.width
      const g = shape('g', {})
      g.dataset.step = String(n)
      g.append(shape('circle', { cx: x, cy: y, r, fill: state.color }), shape('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: state.color === '#ffffff' ? '#1c1c1c' : '#ffffff', 'font-size': r * 1.1, 'font-weight': 700, 'font-family': 'system-ui,sans-serif' }))
      g.lastChild.textContent = String(n)
      svg.append(g)
      addMark(g)
      return
    }
    host.setPointerCapture(event.pointerId)
    const g = shape('g', stroke())
    if (tool === 'pen' || tool === 'line') g.append(shape('path', { d: 'M' + x + ' ' + y }))
    else if (tool === 'arrow') g.append(shape('path', {}), shape('polygon', { fill: state.color, stroke: 'none' }))
    else if (tool === 'rectangle') g.append(shape('rect', { rx: 2 }))
    else g.append(shape('ellipse', {}))
    svg.append(g)
    drag = { tool, g, x, y, points: [x + ' ' + y] }
  })
  host.addEventListener('pointermove', event => {
    const x = event.clientX, y = event.clientY
    if (drag) {
      if (drag.tool === 'pen') { drag.points.push(x + ' ' + y); drag.g.firstChild.setAttribute('d', 'M' + drag.points.join('L')) } else drawShape(drag.g, drag.tool, drag.x, drag.y, x, y)
      drag.moved = true
      return
    }
    if (state.tool !== 'select') { hideHover(); return }
    const el = under(x, y)
    if (el) showHover(el); else hideHover()
  })
  const endDrag = () => {
    if (!drag) return
    const d = drag
    drag = null
    if (!d.moved && d.tool !== 'pen') { d.g.remove(); return }
    if (!d.moved) d.g.firstChild.setAttribute('d', 'M' + d.points[0] + 'l0.01 0')
    addMark(d.g)
  }
  host.addEventListener('pointerup', endDrag)
  host.addEventListener('pointercancel', endDrag)
  // The page's own handlers never hear of a press on the overlay.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu']) host.addEventListener(type, event => event.stopPropagation())
  host.addEventListener('pointerleave', () => { if (!drag) hideHover() })
  host.addEventListener('wheel', event => {
    host.style.pointerEvents = 'none'
    let node = document.elementFromPoint(event.clientX, event.clientY)
    host.style.pointerEvents = 'auto'
    for (; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      const s = getComputedStyle(node)
      if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) break
    }
    ;(node && node !== document.body && node !== document.documentElement ? node : document.scrollingElement || document.documentElement).scrollBy(event.deltaX, event.deltaY)
    event.preventDefault()
  }, { passive: false })
  const onKey = event => {
    if (editing) {
      if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) { event.preventDefault(); editing.blur(); commitText() }
      return
    }
    if (event.key === 'Escape') { event.preventDefault(); state.ended = true; bump() } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      const last = history.pop()
      if (!last) return
      if (last[0] === 'mark') { last[1].remove(); marks.splice(marks.indexOf(last[1]), 1); bump() } else if (picks.some(p => p.element === last[1])) togglePick(last[1])
    }
  }
  const onScroll = () => { layoutPicks(); hideHover() }
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
  document.documentElement.append(host)
  window.__claudeAnnotate = {
    set(patch) { commitText(); Object.assign(state, patch); host.style.cursor = state.tool === 'select' ? 'default' : state.tool === 'text' ? 'text' : 'crosshair'; if (state.tool !== 'select') hideHover(); bump() },
    state: () => ({ tool: state.tool, shape: state.shape, color: state.color, width: state.width, marks: marks.length, picks: picks.length, version: state.version, ended: state.ended }),
    beginCapture() { commitText(); hideHover() },
    picks: () => picks.map(({ element }, i) => ({ number: i + 1, tag: element.localName, role: roleOf(element), name: nameOf(element), text: clip(element.innerText || element.textContent, 120), selector: selectorOf(element) })),
    teardown() {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      host.remove()
      delete window.__claudeAnnotate
    }
  }
}

function installClaudeBrowserAnnotate({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  const PICKER = "button[aria-label='Annotate']"
  let session = null
  // Closing the browser or switching its tab ends the session with it (watched only while one runs).
  const watch = new win.MutationObserver(() => { if (session && (!session.aside.isConnected || !session.aside.checkVisibility({ visibilityProperty: true }))) stop() })
  const glyph = name => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '1.25')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = CLAUDE_ANNOTATE_ICONS[name]
    return svg
  }
  const page = (webview, code) => webview.executeJavaScript(code).catch(() => null)
  const composerTarget = () => [...doc.querySelectorAll('[data-composer-target]')].find(node => !node.closest('[data-pane-hidden]') && node.checkVisibility())?.dataset.composerTarget || 'main'
  const stop = () => {
    const s = session
    if (!s) return
    session = null
    win.clearInterval(s.timer)
    s.bar.remove()
    s.aside.removeAttribute('data-claude-annotating')
    doc.removeEventListener('pointerdown', s.onOutside, true)
    watch.disconnect()
    page(s.webview, 'window.__claudeAnnotate && window.__claudeAnnotate.teardown()')
  }
  const start = aside => {
    const webview = aside.querySelector('webview')
    if (!webview) return
    const bar = doc.createElement('div')
    bar.setAttribute('data-claude-annotate-bar', '')
    bar.setAttribute('role', 'toolbar')
    bar.setAttribute('aria-label', 'Annotate')
    const s = { aside, webview, bar, state: null, menu: null, timer: 0 }
    session = s
    aside.setAttribute('data-claude-annotating', '')
    const set = patch => page(webview, 'window.__claudeAnnotate && window.__claudeAnnotate.set(' + JSON.stringify(patch) + ')').then(sync)
    const button = (name, label, onClick, extra) => {
      const node = doc.createElement('button')
      node.type = 'button'
      node.setAttribute('aria-label', label)
      node.title = label
      node.dataset.claudeAnnotateTool = name
      if (extra) node.append(extra); else node.append(glyph(name))
      node.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); onClick(node) })
      return node
    }
    const closeMenu = () => { s.menu?.remove(); s.menu = null; bar.querySelectorAll('[aria-expanded]').forEach(node => node.setAttribute('aria-expanded', 'false')) }
    const openMenu = (anchor, rows) => {
      const again = s.menu?.dataset.for === anchor.dataset.claudeAnnotateTool
      closeMenu()
      if (again) return
      const menu = doc.createElement('div')
      menu.setAttribute('data-claude-annotate-menu', '')
      menu.setAttribute('role', 'menu')
      menu.dataset.for = anchor.dataset.claudeAnnotateTool
      for (const row of rows) {
        const item = doc.createElement('button')
        item.type = 'button'
        item.setAttribute('role', 'menuitemradio')
        item.setAttribute('aria-checked', row.checked ? 'true' : 'false')
        item.setAttribute('aria-label', row.label)
        item.append(row.lead, ...(row.text ? [Object.assign(doc.createElement('span'), { textContent: row.text })] : []))
        const tick = glyph('check')
        tick.setAttribute('data-claude-annotate-check', '')
        item.append(tick)
        item.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); closeMenu(); row.pick() })
        menu.append(item)
      }
      bar.append(menu)
      const a = anchor.getBoundingClientRect(), b = bar.getBoundingClientRect()
      menu.style.left = Math.max(0, a.left - b.left) + 'px'
      anchor.setAttribute('aria-expanded', 'true')
      s.menu = menu
    }
    const dot = () => { const d = doc.createElement('span'); d.setAttribute('data-claude-annotate-dot', ''); return d }
    const stroke = () => { const d = doc.createElement('span'); d.setAttribute('data-claude-annotate-stroke', ''); return d }
    const chevron = (lead) => { const wrap = doc.createElement('span'); wrap.setAttribute('data-claude-annotate-split', ''); wrap.append(lead, glyph('chevron')); return wrap }
    const select = button('select', 'Select element', () => set({ tool: 'select' }))
    const pen = button('pen', 'Draw', () => set({ tool: 'pen' }))
    const shapeLead = doc.createElement('span')
    const shapeButton = button('shape', 'Shapes', node => {
      if (s.state?.tool !== 'shape') set({ tool: 'shape' })
      openMenu(node, CLAUDE_ANNOTATE_SHAPES.map(([value, label]) => ({ label, text: label, lead: glyph(value), checked: s.state?.shape === value, pick: () => set({ tool: 'shape', shape: value }) })))
    }, chevron(shapeLead))
    const text = button('text', 'Text', () => set({ tool: 'text' }))
    const colorDot = dot()
    const color = button('color', 'Color', node => openMenu(node, CLAUDE_ANNOTATE_COLORS.map(value => { const d = dot(); d.style.background = value; return { label: value, lead: d, checked: s.state?.color === value, pick: () => set({ color: value }) } })), chevron(colorDot))
    const strokeLine = stroke()
    const width = button('width', 'Stroke width', node => openMenu(node, CLAUDE_ANNOTATE_WIDTHS.map(value => { const d = stroke(); d.style.height = value + 'px'; return { label: value + ' px', lead: d, checked: s.state?.width === value, pick: () => set({ width: value }) } })), chevron(strokeLine))
    const add = doc.createElement('button')
    add.type = 'button'
    add.dataset.claudeAnnotateAdd = ''
    add.textContent = 'Add to chat'
    add.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); addToChat() })
    const close = button('close', 'Stop annotating', stop)
    const sep = () => { const d = doc.createElement('span'); d.setAttribute('data-claude-annotate-sep', ''); return d }
    const full = [shapeButton, text, sep(), color, width, add]
    bar.append(select, pen, ...full, sep(), close)
    // Presses on the bar stay ours: the tab strip and webview take no part.
    bar.addEventListener('pointerdown', event => event.stopPropagation())
    s.onOutside = event => { if (s.menu && !bar.contains(event.target)) closeMenu() }
    doc.addEventListener('pointerdown', s.onOutside, true)
    aside.append(bar)
    watch.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-pane-hidden'] })
    const sync = state => {
      if (session !== s) return
      if (state && typeof state === 'object') s.state = state
      const st = s.state
      if (!st) return
      const used = st.marks + st.picks > 0 || st.tool !== 'select'
      for (const node of full) node.hidden = !used
      bar.querySelectorAll('[data-claude-annotate-sep]')[0].hidden = !used
      for (const [node, tool] of [[select, 'select'], [pen, 'pen'], [shapeButton, 'shape'], [text, 'text']]) node.setAttribute('aria-pressed', st.tool === tool ? 'true' : 'false')
      shapeLead.replaceChildren(glyph(st.shape))
      colorDot.style.background = st.color
      strokeLine.style.height = Math.min(st.width, 8) + 'px'
      add.disabled = st.marks + st.picks === 0
    }
    s.sync = sync
    const install = () => page(webview, '(' + claudeAnnotatePage.toString() + ')(); JSON.stringify(window.__claudeAnnotate.state())').then(json => { if (json) sync(JSON.parse(json)); else stop() })
    install()
    // The page tells its changes on the next poll; a navigation drops the
    // overlay with the page, and a fresh one goes on the new page.
    s.timer = win.setInterval(() => {
      if (session !== s) return
      if (!s.aside.isConnected || !s.webview.isConnected) { stop(); return }
      page(webview, 'window.__claudeAnnotate ? JSON.stringify(window.__claudeAnnotate.state()) : null').then(json => {
        if (session !== s) return
        if (!json) { install(); return }
        const st = JSON.parse(json)
        if (st.ended) { stop(); return }
        if (st.version !== s.state?.version) sync(st)
      })
    }, 300)
    const addToChat = async () => {
      if (add.disabled) return
      closeMenu()
      add.disabled = true
      await page(webview, 'window.__claudeAnnotate && window.__claudeAnnotate.beginCapture()')
      await new Promise(resolve => win.setTimeout(resolve, 80))
      const picks = JSON.parse(await page(webview, 'window.__claudeAnnotate ? JSON.stringify(window.__claudeAnnotate.picks()) : "[]"') || '[]')
      let image = null
      try { image = await webview.capturePage() } catch { image = null }
      const url = webview.getURL?.() || ''
      const title = webview.getTitle?.() || ''
      const target = composerTarget()
      if (image && !image.isEmpty?.()) {
        const blob = await (await win.fetch(image.toDataURL())).blob()
        win.dispatchEvent(new win.CustomEvent('hermes:composer-attach-images', { detail: { target, blobs: [new win.File([blob], 'Browser.png', { type: 'image/png' })] } }))
      }
      const lines = ['In the browser: ' + (title && title !== url ? title + ' — ' : '') + url]
      if (picks.length) {
        lines.push('Selected element' + (picks.length > 1 ? 's' : '') + ':')
        for (const p of picks) lines.push(p.number + '. <' + p.tag + '> ' + p.role + (p.name ? ' "' + p.name + '"' : p.text ? ' "' + p.text + '"' : '') + ' — ' + p.selector)
      }
      if (image) lines.push('The attached screenshot shows the page' + (picks.length ? ' with the selected elements numbered' : '') + (s.state?.marks ? ' and my marks' : '') + '.')
      win.dispatchEvent(new win.CustomEvent('hermes:composer-insert', { detail: { target, text: lines.join('\n'), mode: 'block' } }))
      win.dispatchEvent(new win.CustomEvent('hermes:composer-focus', { detail: { target } }))
      stop()
    }
  }
  // The bar's picker is the door: ours, not Hermes' comment mode.
  const onPicker = event => {
    const picker = event.target?.closest?.(PICKER)
    const aside = picker?.closest('aside[data-preview-browser]')
    if (!aside) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.type !== 'click') return
    const same = session?.aside === aside
    stop()
    if (!same) start(aside)
  }
  for (const type of ['pointerdown', 'mousedown', 'click']) doc.addEventListener(type, onPicker, true)
  return () => {
    stop()
    for (const type of ['pointerdown', 'mousedown', 'click']) doc.removeEventListener(type, onPicker, true)
  }
}

function installClaudeFileBrowser({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  const root = doc.documentElement
  const FILTERING = 'data-claude-tree-filtering'
  const FILE_TAB = "[role='tab'][data-tree-tab^='preview-tile:file:']"
  const TREE_FILE = "[data-tree-group='grp-files'] [role='treeitem'] [draggable='true'][title]"
  let frame = 0, disposed = false
  // The preview (italic) tab's data-tree-tab, and files asked to stay open
  // while their tab was still on its way.
  let previewTab = ''
  const keep = new Map()
  // Ctrl+S saved (Hermes leaves its editor on save): reopen it, with the
  // cursor and scroll it had.
  let reopenEditor = 0, reopenAt = null, reopenBar = null
  const settings = (() => {
    let stored = {}
    try { stored = JSON.parse(win.localStorage?.getItem(CLAUDE_FILES_SETTINGS_KEY) || '{}') || {} } catch { stored = {} }
    return { ...CLAUDE_FILES_DEFAULTS, ...stored }
  })()
  // The file's path row and editor belong together: the nearest of each.
  const barFor = node => { for (let at = node; at; at = at.parentElement) { const bar = at.querySelector('[data-claude-file-name]'); if (bar) return bar } return null }
  const editorFor = node => { for (let at = node; at; at = at.parentElement) { const editor = at.querySelector('.cm-editor'); if (editor) return editor } return null }
  // Hermes' CodeMirror view, held in a ref of the editor's React component.
  const editorView = editor => {
    for (let node = editor, up = 0; node && up < 4; node = node.parentElement, up++) {
      const key = Object.keys(node).find(name => name.startsWith('__reactFiber$'))
      for (let fiber = key ? node[key] : null, depth = 0; fiber && depth < 6; fiber = fiber.return, depth++) {
        for (let hook = fiber.memoizedState, at = 0; hook && typeof hook === 'object' && at < 40; hook = hook.next, at++) {
          const value = hook.memoizedState?.current ?? hook.memoizedState
          if (value && typeof value.dispatch === 'function' && value.state?.doc && value.scrollDOM) return value
        }
      }
    }
    return null
  }
  const restoreEditor = async (bar, at) => {
    // (Hermes may render the path row anew on the way: find the editor by
    // the file's zone.)
    const zone = bar.closest('[data-tree-group]')
    const editor = await waitFor(() => [...(zone?.querySelectorAll('.cm-editor') || [])].find(node => !node.closest('[data-pane-hidden]')), 3000)
    const view = editor && at && editorView(editor)
    if (!view) return
    const end = view.state.doc.length
    view.dispatch({ selection: { anchor: Math.min(at.anchor, end), head: Math.min(at.head, end) } })
    view.scrollDOM.scrollTop = at.top
    if (at.focus) view.focus()
  }
  // Save through Hermes' Save (it leaves the editor); the plugin reopens the
  // editor where it was.
  const saveEditor = (bar, editor, focus) => {
    const save = bar?.querySelector("[data-claude-edit='save']")
    if (!save || save.disabled) return false
    const view = editor && editorView(editor)
    const range = view?.state.selection.main
    reopenAt = range ? { anchor: range.anchor, head: range.head, top: view.scrollDOM.scrollTop, focus } : null
    // Hermes renders a new path row after saving: the file's zone and name
    // find it again.
    reopenBar = { zone: bar.closest('[data-tree-group]'), name: bar.dataset.claudeFileName || '' }
    reopenEditor = Date.now()
    save.click()
    return true
  }
  // The editor settings: one compartment of the plugin's in Hermes' editor.
  const editors = new Map()
  let decorationClass = null
  // CodeMirror's Decoration class, from the module Hermes' editor chunk
  // imports (found by its EditorView), for indent guides and whitespace.
  const findDecoration = view => {
    decorationClass ??= (async () => {
      const entry = [...doc.scripts].map(script => script.src).find(src => /\/index-[\w-]+\.js(\?|$)/.test(src))
      if (!entry) return null
      const base = entry.replace(/[^/]+$/, '')
      const chunk = (await (await win.fetch(entry)).text()).match(/["'`]\.\/(code-editor-[\w-]+\.js)["'`]/)?.[1]
      if (!chunk) return null
      const source = await (await win.fetch(base + chunk)).text()
      for (const dep of [...source.matchAll(/from\s*["']\.\/([\w.-]+\.js)["']/g)].map(match => match[1])) {
        const values = Object.values(await import(base + dep))
        if (!values.includes(view.constructor)) continue
        return values.find(value => typeof value === 'function' && typeof value.line === 'function' && typeof value.mark === 'function' && typeof value.set === 'function') || null
      }
      return null
    })().catch(() => null)
    return decorationClass
  }
  const columns = (text, end, size) => { let column = 0; for (let at = 0; at < end; at++) column = text[at] === '\t' ? column + size - (column % size) : column + 1; return column }
  const decorate = (Decoration, view) => {
    const marks = []
    const size = settings.tabSize
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos)
        const text = line.text
        if (settings.indentGuides) {
          let at = 0
          while (at < text.length && (text[at] === ' ' || text[at] === '\t')) at++
          const levels = at < text.length ? Math.floor(columns(text, at, size) / size) : 0
          if (levels) marks.push(Decoration.line({ class: 'cm-claude-indent', attributes: { style: '--claude-indent-levels: ' + levels } }).range(line.from))
        }
        if (settings.showWhitespace) for (const match of text.matchAll(/ +|\t/g)) marks.push(Decoration.mark({ class: match[0] === '\t' ? 'cm-claude-tab' : 'cm-claude-space' }).range(line.from + match.index, line.from + match.index + match[0].length))
        pos = line.to + 1
      }
    }
    return Decoration.set(marks, true)
  }
  const extensionsFor = entry => {
    const { view } = entry
    const EditorView = view.constructor, EditorState = view.state.constructor
    const list = []
    if (EditorState.tabSize) list.push(EditorState.tabSize.of(settings.tabSize))
    if (settings.wordWrap && EditorView.lineWrapping) list.push(EditorView.lineWrapping)
    if ((settings.indentGuides || settings.showWhitespace) && entry.Decoration && EditorView.decorations) list.push(EditorView.decorations.of(current => decorate(entry.Decoration, current)))
    return list
  }
  const configure = entry => { try { entry.view.dispatch({ effects: entry.compartment.reconfigure(extensionsFor(entry)) }) } catch { editors.delete(entry.editor) } }
  const setupEditor = editor => {
    const view = editorView(editor)
    const known = view?.state.config?.compartments && [...view.state.config.compartments.keys()][0]
    const StateEffect = known?.reconfigure?.([])?.constructor
    if (!view || !StateEffect?.appendConfig) return null
    const entry = { editor, view, compartment: new known.constructor(), Decoration: null }
    try { view.dispatch({ effects: StateEffect.appendConfig.of(entry.compartment.of(extensionsFor(entry))) }) } catch { return null }
    findDecoration(view).then(Decoration => { if (Decoration && !disposed && editors.get(editor) === entry) { entry.Decoration = Decoration; configure(entry) } })
    return entry
  }
  // Claude's Tab: indent to the next tab stop (or the selected lines), with
  // Shift to outdent, in spaces of the chosen tab size.
  const indent = (view, back) => {
    const { state } = view
    const size = settings.tabSize
    const EditorSelection = state.selection.constructor
    if (!back && state.selection.ranges.every(range => range.empty)) {
      view.dispatch({ ...state.changeByRange(range => {
        const line = state.doc.lineAt(range.head)
        const insert = ' '.repeat(size - (columns(line.text, range.head - line.from, size) % size))
        return { changes: { from: range.head, insert }, range: EditorSelection.cursor(range.head + insert.length) }
      }), scrollIntoView: true, userEvent: 'input.indent' })
      return
    }
    const lines = new Set()
    for (const range of state.selection.ranges) {
      const last = state.doc.lineAt(range.to > range.from && state.doc.lineAt(range.to).from === range.to ? range.to - 1 : range.to).number
      for (let number = state.doc.lineAt(range.from).number; number <= last; number++) lines.add(number)
    }
    const changes = []
    for (const number of lines) {
      const line = state.doc.line(number)
      if (!back) { if (line.length) changes.push({ from: line.from, insert: ' '.repeat(size) }); continue }
      const lead = line.text.match(/^(\t| {1,})/)?.[0] || ''
      const cut = lead === '\t' ? 1 : Math.min(lead.length, size)
      if (cut) changes.push({ from: line.from, to: line.from + cut })
    }
    if (changes.length) view.dispatch({ changes, userEvent: back ? 'delete.dedent' : 'input.indent' })
  }
  const canon = path => String(path || '').replace(/\\/g, '/').replace(/^\/(?=[A-Za-z]:\/)/, '')
  const tabPath = tab => {
    let id = (tab.getAttribute('data-tree-tab') || '').slice('preview-tile:file:'.length)
    try { id = decodeURIComponent(id) } catch { /* keep it raw */ }
    // Hermes may scope the id to a session: preview-tile:file:<session>:file://…
    const at = id.indexOf('file://')
    return canon(at >= 0 ? id.slice(at + 'file://'.length) : id)
  }
  const fileTabs = () => [...doc.querySelectorAll(FILE_TAB)]
  const tabFor = path => { const want = canon(path); return fileTabs().find(tab => tabPath(tab) === want) || null }
  const glyph = name => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '1.25')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = CLAUDE_FILE_ICONS[name]
    return svg
  }
  const waitFor = (test, ms = 4000) => new Promise(resolve => {
    const end = Date.now() + ms
    const tick = () => {
      const value = disposed ? null : test()
      if (value || disposed || Date.now() > end) resolve(value || null)
      else win.setTimeout(tick, 50)
    }
    tick()
  })
  const keepOpen = path => {
    const key = canon(path)
    keep.set(key, Date.now())
    win.setTimeout(() => { if (Date.now() - (keep.get(key) || 0) >= 2500) keep.delete(key) }, 2600)
    const tab = tabFor(path)
    if (tab && tab.getAttribute('data-tree-tab') === previewTab) { previewTab = ''; schedule() }
  }
  // After a file was asked open: a new tab becomes the preview tab and the
  // previous preview tab closes; a file already open keeps its tab as it is.
  const settle = async (path, alreadyOpen) => {
    if (alreadyOpen) return
    const tab = await waitFor(() => tabFor(path))
    if (!tab) return
    const id = tab.getAttribute('data-tree-tab')
    // A double-clicked file still replaces the preview tab, as its own tab.
    const previous = previewTab
    previewTab = keep.has(canon(path)) || !settings.previewTabs ? '' : id
    if (previous && previous !== id) fileTabs().find(other => other.getAttribute('data-tree-tab') === previous)?.querySelector("button[aria-label='Close']")?.click()
    schedule()
  }
  // The tree's own file opener (its onPreviewFile prop), for files that are
  // not on screen in the tree, and the folder it shows.
  const tree = () => {
    const element = doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
    const key = element && Object.keys(element).find(name => name.startsWith('__reactFiber$'))
    for (let fiber = key ? element[key] : null, depth = 0; fiber && depth < 8; fiber = fiber.return, depth++) {
      const props = fiber.memoizedProps
      if (props && typeof props.onPreviewFile === 'function') return { open: props.onPreviewFile, cwd: typeof props.cwd === 'string' ? props.cwd : '' }
    }
    return null
  }
  const openFile = path => {
    const opener = tree()
    if (!opener) return
    const alreadyOpen = Boolean(tabFor(path))
    opener.open(path)
    settle(path, alreadyOpen)
  }

  // The filter: an index of the tree's folder, built on the first query.
  let index = null, query = '', active = 0, results = [], resultsFrame = 0
  const listDir = async (path, local) => {
    const bridge = win.hermesDesktop
    const listing = local ? await bridge.readDir(path) : await bridge.api({ path: '/api/fs/list?path=' + encodeURIComponent(path) })
    return !listing || listing.error || !Array.isArray(listing.entries) ? [] : listing.entries
  }
  const buildIndex = folder => {
    const own = { root: folder, files: [], done: false, at: Date.now() }
    index = own
    const bridge = win.hermesDesktop
    if (!bridge || !folder) { own.done = true; return own }
    const base = canon(folder).replace(/\/$/, '')
    ;(async () => {
      // A folder the desktop bridge can read is local; otherwise it lives on
      // the remote backend and the gateway lists it.
      let local = false
      try { const probe = await bridge.readDir?.(folder); local = Boolean(probe && !probe.error && probe.entries?.length) } catch { local = false }
      if (!local && typeof bridge.api !== 'function') { own.done = true; return }
      const queue = [folder]
      let busy = 0
      const worker = async () => {
        while (index === own && !disposed && own.files.length < CLAUDE_FILTER_MAX) {
          if (!queue.length) {
            if (!busy) return
            await new Promise(resolve => win.setTimeout(resolve, 25))
            continue
          }
          const dir = queue.shift()
          busy++
          let entries = []
          try { entries = await listDir(dir, local) } catch { entries = [] }
          busy--
          for (const entry of entries) {
            const name = String(entry?.name || '')
            if (!name) continue
            const path = String(entry.path || String(dir).replace(/[\\/]$/, '') + '/' + name)
            if (entry.isDirectory) { if (!CLAUDE_FILTER_SKIP.has(name)) queue.push(path); continue }
            const full = canon(path)
            const rel = full.startsWith(base + '/') ? full.slice(base.length + 1) : full
            own.files.push({ path, name, rel, lower: rel.toLowerCase(), lowerName: name.toLowerCase() })
          }
          if (query) scheduleResults()
        }
      }
      await Promise.all(Array.from({ length: 6 }, worker))
      own.done = true
      if (index === own && query) scheduleResults()
    })()
    return own
  }
  const currentIndex = () => {
    const folder = tree()?.cwd || ''
    if (!index || index.root !== folder || (index.done && Date.now() - index.at > 120000)) buildIndex(folder)
    return index
  }
  const match = text => {
    const needle = text.toLowerCase()
    const found = []
    for (const file of index?.files || []) {
      if (!file.lower.includes(needle)) continue
      const at = file.lowerName.indexOf(needle)
      found.push([at === 0 ? 0 : at > 0 ? 1 : 2, file.rel.length, file])
    }
    found.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].rel.localeCompare(b[2].rel))
    return found.slice(0, CLAUDE_FILTER_SHOWN).map(entry => entry[2])
  }
  const resultsBox = () => doc.querySelector('[data-claude-tree-results]')
  const renderResults = () => {
    resultsFrame = 0
    const box = resultsBox()
    if (!box || !query) return
    results = match(query)
    if (active >= results.length) active = Math.max(0, results.length - 1)
    const rows = results.map((file, at) => {
      const row = doc.createElement('div')
      row.dataset.claudeResult = String(at)
      row.setAttribute('role', 'option')
      row.setAttribute('aria-selected', at === active ? 'true' : 'false')
      row.title = file.path
      const icon = doc.createElement('span')
      icon.setAttribute('data-claude-result-icon', '')
      const name = doc.createElement('span')
      name.setAttribute('data-claude-result-name', '')
      name.textContent = file.name
      const dir = doc.createElement('span')
      dir.setAttribute('data-claude-result-dir', '')
      dir.textContent = file.rel.slice(0, Math.max(0, file.rel.length - file.name.length - 1))
      row.append(icon, name, dir)
      return row
    })
    const note = text => { const node = doc.createElement('div'); node.setAttribute('data-claude-results-note', ''); node.textContent = text; return node }
    if (!index?.done) rows.push(note('Searching…'))
    else if (!results.length) rows.push(note('No matching files'))
    box.replaceChildren(...rows)
    box.querySelector("[aria-selected='true']")?.scrollIntoView({ block: 'nearest' })
  }
  const scheduleResults = () => { if (!resultsFrame && !disposed) resultsFrame = win.setTimeout(renderResults, 80) }
  const setQuery = text => {
    query = text.trim()
    active = 0
    if (query) currentIndex()
    if (query) root.setAttribute(FILTERING, '')
    else { root.removeAttribute(FILTERING); resultsBox()?.replaceChildren() }
    if (query) { if (resultsFrame) win.clearTimeout(resultsFrame); resultsFrame = 0; renderResults() }
  }
  const filterField = () => {
    const field = doc.createElement('div')
    field.setAttribute('data-claude-tree-filter', '')
    const input = doc.createElement('input')
    input.type = 'text'
    input.placeholder = 'Filter files'
    input.setAttribute('aria-label', 'Filter files')
    input.spellcheck = false
    input.addEventListener('input', () => setQuery(input.value))
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!results.length) return
        active = (active + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length
        renderResults()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const file = results[active]
        if (file) openFile(file.path)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        if (input.value) { input.value = ''; setQuery('') } else input.blur()
      }
    })
    field.append(glyph('search'), input)
    return field
  }
  const onResultClick = event => {
    const row = event.target?.closest?.('[data-claude-tree-results] [data-claude-result]')
    if (!row) return
    const file = results[Number(row.dataset.claudeResult)]
    if (!file) return
    active = Number(row.dataset.claudeResult)
    for (const other of row.parentElement.children) other.setAttribute?.('aria-selected', other === row ? 'true' : 'false')
    if (event.detail > 1) keepOpen(file.path)
    else openFile(file.path)
  }
  const onSearch = () => {
    const view = root.getAttribute('data-claude-files-view')
    if (view === 'file' || view === 'empty') root.dispatchEvent(new win.CustomEvent('claude-tree-toggle'))
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => doc.querySelector('[data-claude-tree-filter] > input')?.focus()))
  }

  const place = () => {
    frame = 0
    if (disposed) return
    // The preview tab in italics; it ends when its tab goes.
    let previewShown = false
    for (const tab of fileTabs()) {
      const on = Boolean(previewTab) && tab.getAttribute('data-tree-tab') === previewTab
      if (on) previewShown = true
      if (on !== tab.hasAttribute('data-claude-preview-tab')) tab.toggleAttribute('data-claude-preview-tab', on)
    }
    if (previewTab && !previewShown) previewTab = ''
    // The filter above the tree, its results in the tree's place.
    const projectTree = doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
    if (projectTree) {
      let list = projectTree.parentElement.querySelector(':scope > [data-claude-tree-results]')
      let field = projectTree.parentElement.querySelector(':scope > [data-claude-tree-filter]')
      if (!field) {
        doc.querySelectorAll('[data-claude-tree-filter], [data-claude-tree-results]').forEach(node => node.remove())
        field = filterField()
        list = doc.createElement('div')
        list.setAttribute('data-claude-tree-results', '')
        list.setAttribute('role', 'listbox')
        list.setAttribute('aria-label', 'Matching files')
        if (query) field.querySelector('input').value = query
      }
      if (projectTree.previousElementSibling !== list || list.previousElementSibling !== field) projectTree.before(field, list)
      if (query && !list.childElementCount) scheduleResults()
    }
    root.toggleAttribute(FILTERING, Boolean(query && projectTree))
    // Hermes' editor in Claude's path row. (A save that kept the editor, a
    // conflict or an error, stops waiting to reopen it.)
    if (reopenBar && Date.now() - reopenEditor > 5000) reopenBar = reopenAt = null
    for (const bar of doc.querySelectorAll('[data-claude-file-name]')) {
      for (const control of bar.querySelectorAll('button:not([data-claude-edit-done])')) {
        const kind = control.querySelector("svg[class*='tabler-icon-pencil']") ? 'open'
          : control.querySelector("svg[class*='tabler-icon-check']") ? 'save'
            : control.querySelector("svg[class*='tabler-icon-x']") ? 'cancel' : ''
        if (!kind || control.dataset.claudeEdit === kind) continue
        control.dataset.claudeEdit = kind
        if (kind === 'open') { control.title = 'Edit'; control.setAttribute('aria-label', 'Edit') }
      }
      // Saved by Ctrl+S or auto save: back into the editor, where it was.
      if (reopenBar && !bar.closest('[data-pane-hidden]') && bar.closest('[data-tree-group]') === reopenBar.zone && (bar.dataset.claudeFileName || '') === reopenBar.name && !bar.querySelector("[data-claude-edit='save']")) {
        const reopen = Date.now() - reopenEditor < 5000 && bar.querySelector("[data-claude-edit='open']")
        if (reopen) {
          const at = reopenAt
          reopenBar = reopenAt = null
          reopenEditor = 0
          reopen.click()
          restoreEditor(bar, at)
        }
      }
      // The editor settings, in every file editor (Hermes keeps other files'
      // views mounted under [data-pane-hidden]).
      const editor = bar.querySelector("[data-claude-edit='save']") && editorFor(bar)
      if (editor) {
        let entry = editors.get(editor)
        if (entry && entry.compartment.get(entry.view.state) === undefined) entry = null
        if (!entry) { entry = setupEditor(editor); if (entry) editors.set(editor, entry) }
        const content = editor.querySelector('.cm-content')
        if (content) {
          const font = win.getComputedStyle(content)
          const probe = doc.createElement('canvas').getContext?.('2d')
          if (probe && !editor.style.getPropertyValue('--claude-space-width')) { probe.font = font.fontStyle + ' ' + font.fontWeight + ' ' + font.fontSize + ' ' + font.fontFamily; editor.style.setProperty('--claude-space-width', probe.measureText(' ').width + 'px') }
          editor.style.setProperty('--claude-editor-height', editor.querySelector('.cm-scroller')?.clientHeight + 'px')
        }
      }
      if (bar.closest('[data-pane-hidden]')) continue
      const save = bar.querySelector("[data-claude-edit='save']")
      let done = bar.querySelector('[data-claude-edit-done]')
      if (save) {
        const markdown = /\.(md|mdx|markdown)$/i.test(bar.dataset.claudeFileName || '')
        const name = markdown ? 'preview' : 'done'
        if (!done || done.dataset.claudeEditDone !== name) {
          done?.remove()
          done = doc.createElement('button')
          done.type = 'button'
          done.dataset.claudeEditDone = name
          done.title = markdown ? 'Preview' : 'Done'
          done.setAttribute('aria-label', done.title)
          done.append(glyph(name))
          done.addEventListener('click', event => {
            event.preventDefault()
            event.stopPropagation()
            const pending = bar.querySelector("[data-claude-edit='save']")
            if (pending && !pending.disabled) pending.click()
            else bar.querySelector("[data-claude-edit='cancel']")?.click()
          })
        }
        if (bar.lastElementChild !== done) bar.append(done)
        // Editing a file keeps it open as its own tab.
        const tab = bar.closest('[data-tree-group]')?.querySelector(FILE_TAB + "[aria-selected='true']")
        if (tab && tab.getAttribute('data-tree-tab') === previewTab) { previewTab = ''; tab.removeAttribute('data-claude-preview-tab') }
      } else {
        done?.remove()
      }
    }
    for (const editor of [...editors.keys()]) if (!editor.isConnected) editors.delete(editor)
    placeTabs()
    applyTerminals()
    // Claude's tree lists gitignored files too: Hermes' own toggle is turned
    // on (it remembers that per folder) and its button leaves the header.
    doc.querySelector("[data-claude-files-header] > button[aria-pressed='false']:has(.codicon-eye-closed)")?.click()
  }
  // Claude's file tabs when there are too many: each shrinks to TAB_MIN, the
  // rest go behind a ⌄ after the last one (the active tab always shows).
  const TAB_MIN = 96, TAB_GAP = 4
  let tabList = null
  const closeTabList = () => {
    tabList?.remove()
    tabList = null
    doc.querySelectorAll('[data-claude-tab-more][aria-expanded="true"]').forEach(node => node.setAttribute('aria-expanded', 'false'))
  }
  const openTabList = more => {
    if (tabList) { closeTabList(); return }
    const hidden = [...(more.parentElement?.querySelectorAll(FILE_TAB + '[data-claude-tab-overflow]') || [])]
    if (!hidden.length) return
    tabList = doc.createElement('div')
    tabList.setAttribute('data-claude-tab-list', '')
    tabList.setAttribute('role', 'menu')
    for (const tab of hidden) {
      const row = doc.createElement('div')
      row.setAttribute('role', 'menuitem')
      row.title = tabPath(tab).split('/').pop()
      const icon = doc.createElement('span')
      icon.setAttribute('data-claude-result-icon', '')
      const name = doc.createElement('span')
      name.textContent = row.title
      const close = doc.createElement('button')
      close.type = 'button'
      close.setAttribute('aria-label', 'Close ' + row.title)
      close.append(glyph('close'))
      close.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); closeTabList(); tab.querySelector("button[aria-label='Close']")?.click() })
      row.append(icon, name, close)
      // Hermes selects a tab on its press.
      row.addEventListener('click', () => {
        closeTabList()
        const target = tab.querySelector('.pane-tab-content') || tab
        for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) target.dispatchEvent(new (type.startsWith('pointer') && win.PointerEvent ? win.PointerEvent : win.MouseEvent)(type, { bubbles: true, cancelable: true, button: 0, buttons: type.endsWith('down') ? 1 : 0, pointerType: 'mouse', isPrimary: true }))
      })
      tabList.append(row)
    }
    doc.body.append(tabList)
    more.setAttribute('aria-expanded', 'true')
    const box = more.getBoundingClientRect()
    tabList.style.left = Math.max(8, box.right - tabList.offsetWidth) + 'px'
    tabList.style.top = Math.round(box.bottom + 6) + 'px'
  }
  const resizer = win.ResizeObserver ? new win.ResizeObserver(() => schedule()) : null
  const watched = new WeakSet()
  const placeTabs = () => {
    for (const node of doc.querySelectorAll("[data-claude-preview-column] [data-zone-tabstrip], [data-tree-group='grp-files']:not([data-pane-host])")) if (resizer && !watched.has(node)) { watched.add(node); resizer.observe(node) }
    const files = root.hasAttribute('data-claude-file-joined') || root.hasAttribute('data-claude-file-over')
    for (const strip of doc.querySelectorAll('[data-claude-preview-column] [data-zone-tabstrip]')) {
      const list = strip.querySelector(":scope > [role='tablist']")
      const tabs = [...(list?.querySelectorAll(FILE_TAB) || [])]
      let more = strip.querySelector(':scope > [data-claude-tab-more]')
      const fits = width => Math.max(1, Math.floor((width + TAB_GAP) / (TAB_MIN + TAB_GAP)))
      const wanted = files && list ? tabs.length > fits(list.clientWidth + (more ? more.offsetWidth + TAB_GAP : 0)) : false
      if (wanted && !more) {
        more = doc.createElement('button')
        more.type = 'button'
        more.setAttribute('data-claude-tab-more', '')
        more.setAttribute('aria-label', 'More tabs')
        more.setAttribute('aria-haspopup', 'menu')
        more.setAttribute('aria-expanded', 'false')
        more.title = 'More tabs'
        more.append(glyph('chevronDown'))
        more.addEventListener('pointerdown', event => event.stopPropagation())
        more.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openTabList(more) })
      }
      if (!wanted) { more?.remove(); more = null }
      if (more && list.nextElementSibling !== more) list.after(more)
      const count = wanted ? fits(list.clientWidth) : tabs.length
      const active = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true')
      const shown = new Set(tabs.slice(0, count))
      if (active >= count) { shown.delete(tabs[count - 1]); shown.add(tabs[active]) }
      for (const tab of tabs) if (shown.has(tab) === tab.hasAttribute('data-claude-tab-overflow')) tab.toggleAttribute('data-claude-tab-overflow', !shown.has(tab))
    }
    // File tree on the left: the file's tabs run across the card's header,
    // from just after the tree toggle.
    const filesCard = doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host])")
    const fileCard = doc.querySelector('[data-claude-preview-column] > [data-tree-group]:not([data-pane-host])')
    const span = root.hasAttribute('data-claude-tree-left') && root.hasAttribute('data-claude-file-joined') && root.getAttribute('data-claude-files-view') === 'both' && filesCard && fileCard
      ? Math.round(fileCard.getBoundingClientRect().left - filesCard.getBoundingClientRect().left) : 0
    const value = span > 0 ? span + 'px' : ''
    if (root.style.getPropertyValue('--claude-tree-span') !== value) value ? root.style.setProperty('--claude-tree-span', value) : root.style.removeProperty('--claude-tree-span')
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }

  // One click opens a file (see above). Hermes' row click stops propagation,
  // so this listens in the capture phase and replays the double click once
  // that click has run. Folders already open on one click; Shift-click
  // (attach), a real double click and a row being renamed stay Hermes'.
  const onTreeClick = event => {
    if (event.button !== 0 || event.detail > 1 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return
    const row = event.target?.closest?.("[data-tree-group='grp-files'] [role='treeitem'] [draggable='true']")
    if (!row || row.hasAttribute('aria-expanded') || row.querySelector('input')) return
    const path = row.getAttribute('title') || ''
    const alreadyOpen = Boolean(path && tabFor(path))
    const { clientX, clientY } = event
    win.setTimeout(() => {
      if (!row.isConnected || row.querySelector('input')) return
      row.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2, clientX, clientY }))
      if (path) settle(path, alreadyOpen)
    }, 0)
  }
  // </> on a file Hermes can edit opens its editor.
  const onSourceClick = event => {
    const source = event.target?.closest?.("[data-claude-file-name] > [data-claude-mode='source']")
    const edit = source?.parentElement.querySelector("[data-claude-edit='open']")
    if (!edit) return
    event.preventDefault()
    event.stopPropagation()
    edit.click()
  }
  // A real double click keeps the file (or the tab) open.
  const onDoubleClick = event => {
    if (!event.isTrusted) return
    const row = event.target?.closest?.(TREE_FILE)
    if (row && !row.hasAttribute('aria-expanded')) { keepOpen(row.getAttribute('title')); return }
    const tab = event.target?.closest?.(FILE_TAB)
    if (tab && tab.getAttribute('data-tree-tab') === previewTab) { previewTab = ''; schedule() }
  }
  const filesOpen = () => root.getAttribute('data-claude-files-hidden') !== 'true' && Boolean(doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host])"))
  const onKeyDown = event => {
    // Claude's Show file tree shortcut.
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'y' && filesOpen() && root.getAttribute('data-claude-last-pane') !== 'changes') {
      event.preventDefault()
      event.stopPropagation()
      root.dispatchEvent(new win.CustomEvent('claude-tree-toggle'))
      return
    }
    const editor = event.target?.closest?.('.cm-editor')
    const bar = editor && barFor(editor)
    const save = bar?.querySelector("[data-claude-edit='save']")
    if (!save) return
    if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Off: Tab leaves the editor (the browser moves focus).
      event.stopPropagation()
      if (!settings.tabIndents) return
      event.preventDefault()
      const view = editorView(editor)
      if (view) indent(view, event.shiftKey)
    } else if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
      event.preventDefault()
      event.stopPropagation()
      saveEditor(bar, editor, true)
    } else if (event.key === 'Escape' && !save.disabled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  // Auto save: leaving the editor saves it (a click on its own path row, or
  // a tab's ×, acts first).
  const onFocusOut = event => {
    if (!settings.autoSave) return
    const editor = event.target?.closest?.('.cm-editor')
    const next = event.relatedTarget
    if (!editor || editor.contains(next)) return
    const bar = barFor(editor)
    if (!bar || bar.contains(next) || next?.closest?.("[data-claude-files-menu], [data-claude-terminal-action='more'], [role='tab'] button[aria-label='Close']")) return
    win.setTimeout(() => { if (bar.isConnected && editor.isConnected && !(reopenBar && Date.now() - reopenEditor < 5000)) saveEditor(bar, editor, false) }, 120)
  }
  // Auto save: closing an edited file's tab saves it first.
  let closing = false
  const onTabClose = event => {
    if (closing || !settings.autoSave) return
    const close = event.target?.closest?.(FILE_TAB + " button[aria-label='Close']")
    const tab = close?.closest(FILE_TAB)
    if (!tab || tab.getAttribute('aria-selected') !== 'true') return
    const bar = [...(tab.closest('[data-tree-group]')?.querySelectorAll('[data-claude-file-name]') || [])].find(node => !node.closest('[data-pane-hidden]'))
    const save = bar?.querySelector("[data-claude-edit='save']")
    if (!save || save.disabled) return
    event.preventDefault()
    event.stopPropagation()
    reopenBar = null
    save.click()
    // Saved: Hermes leaves the editor. A conflict keeps it (and the tab) open.
    waitFor(() => !bar.isConnected || !bar.querySelector("[data-claude-edit='save']"), 6000).then(saved => {
      if (!saved || !close.isConnected) return
      closing = true
      try { close.click() } finally { closing = false }
    })
  }

  // The ⋮ menu: Claude's Files settings.
  let menu = null, submenu = null
  // The terminal settings, applied to Hermes' own xterm.js terminals (their
  // instance is held in a ref of the terminal's React component) through
  // xterm's runtime options; Copy on select copies through the clipboard.
  const terminalSettings = (() => {
    let stored = {}
    try { stored = JSON.parse(win.localStorage?.getItem(CLAUDE_TERMINAL_SETTINGS_KEY) || '{}') || {} } catch { stored = {} }
    return { ...CLAUDE_TERMINAL_DEFAULTS, ...stored }
  })()
  const terminals = new Map()
  const terminalOf = element => {
    for (let node = element, up = 0; node && up < 8; node = node.parentElement, up++) {
      const key = Object.keys(node).find(name => name.startsWith('__reactFiber$'))
      for (let fiber = key ? node[key] : null, depth = 0; fiber && depth < 6; fiber = fiber.return, depth++) {
        for (let hook = fiber.memoizedState, at = 0; hook && typeof hook === 'object' && at < 40; hook = hook.next, at++) {
          const value = hook.memoizedState?.current ?? hook.memoizedState
          if (value && typeof value.onSelectionChange === 'function' && typeof value.getSelection === 'function' && value.options) return value
        }
      }
    }
    return null
  }
  const applyTerminals = () => {
    for (const element of doc.querySelectorAll('.xterm')) {
      let term = terminals.get(element)
      if (!term) {
        term = terminalOf(element)
        // Only shells: Hermes' read-only log views keep their own options.
        if (!term || term.options.disableStdin) continue
        terminals.set(element, term)
        term.__claudeOriginal ??= { cursorStyle: term.options.cursorStyle, cursorBlink: term.options.cursorBlink, scrollback: term.options.scrollback }
        try {
          term.__claudeCopy?.dispose?.()
          term.__claudeCopy = term.onSelectionChange(() => {
            if (!terminalSettings.copyOnSelect) return
            const text = term.getSelection()
            if (!text) return
            // Hermes' own bridge writes even while the window is not focused
            // (the web clipboard refuses then).
            const bridge = win.hermesDesktop?.writeClipboard
            Promise.resolve(typeof bridge === 'function' ? bridge(text) : win.navigator.clipboard?.writeText(text)).catch(() => {})
          })
        } catch { /* no selection events */ }
      }
      const wanted = { cursorStyle: terminalSettings.cursorStyle, cursorBlink: Boolean(terminalSettings.cursorBlink), scrollback: terminalSettings.scrollback }
      for (const [name, value] of Object.entries(wanted)) { try { if (term.options[name] !== value) term.options[name] = value } catch { /* option gone */ } }
    }
    for (const element of [...terminals.keys()]) if (!element.isConnected) terminals.delete(element)
  }
  const applyTerminalSettings = () => {
    try { win.localStorage?.setItem(CLAUDE_TERMINAL_SETTINGS_KEY, JSON.stringify(terminalSettings)) } catch { /* storage off */ }
    applyTerminals()
  }
  const terminalItems = () => {
    const styles = [['block', 'Block'], ['bar', 'Bar'], ['underline', 'Underline']]
    const lines = size => size.toLocaleString('en-US') + ' lines'
    return [
      { label: 'Cursor style', value: styles.find(([key]) => key === terminalSettings.cursorStyle)?.[1] || 'Block',
        sub: styles.map(([key, label]) => ({ label, checked: terminalSettings.cursorStyle === key, onSelect: () => { terminalSettings.cursorStyle = key; applyTerminalSettings() } })) },
      { label: 'Blink cursor', checked: Boolean(terminalSettings.cursorBlink), onSelect: () => { terminalSettings.cursorBlink = !terminalSettings.cursorBlink; applyTerminalSettings() } },
      { label: 'Copy on select', checked: Boolean(terminalSettings.copyOnSelect), onSelect: () => { terminalSettings.copyOnSelect = !terminalSettings.copyOnSelect; applyTerminalSettings() } },
      { label: 'Scrollback', value: lines(terminalSettings.scrollback),
        sub: [1000, 5000, 10000].map(size => ({ label: lines(size), checked: terminalSettings.scrollback === size, onSelect: () => { terminalSettings.scrollback = size; applyTerminalSettings() } })) }
    ]
  }
  const applySettings = () => {
    try { win.localStorage?.setItem(CLAUDE_FILES_SETTINGS_KEY, JSON.stringify(settings)) } catch { /* storage off */ }
    root.toggleAttribute('data-claude-tree-left', settings.treePosition === 'left')
    root.toggleAttribute('data-claude-autosave', Boolean(settings.autoSave))
    root.toggleAttribute('data-claude-scroll-past-end', Boolean(settings.scrollPastEnd))
    root.style.setProperty('--claude-tab-size', String(settings.tabSize))
    if (!settings.previewTabs) previewTab = ''
    for (const entry of editors.values()) configure(entry)
    schedule()
  }
  const closeMenu = () => {
    submenu?.remove()
    menu?.remove()
    menu = submenu = null
    doc.querySelectorAll("[data-claude-terminal-action='more'][aria-expanded='true']").forEach(node => node.setAttribute('aria-expanded', 'false'))
  }
  const menuRow = (item, inSub) => {
    const row = doc.createElement('div')
    row.setAttribute('role', item.checked === undefined ? 'menuitem' : 'menuitemcheckbox')
    if (item.checked !== undefined) row.setAttribute('aria-checked', item.checked ? 'true' : 'false')
    row.dataset.claudeMenuRow = ''
    if (item.disabled) row.setAttribute('aria-disabled', 'true')
    row.tabIndex = -1
    const label = doc.createElement('span')
    label.textContent = item.label
    row.append(label)
    const tail = doc.createElement('span')
    tail.dataset.claudeMenuTail = ''
    if (item.checked) { const check = glyph('check'); check.dataset.claudeMenuCheck = ''; tail.append(check) }
    if (item.hint) { const hint = doc.createElement('span'); hint.dataset.claudeMenuHint = ''; hint.textContent = item.hint; tail.append(hint) }
    if (item.value) { const value = doc.createElement('span'); value.dataset.claudeMenuHint = ''; value.textContent = item.value; tail.append(value) }
    if (item.sub) { tail.append(glyph('chevron')); row.setAttribute('aria-haspopup', 'menu') }
    row.append(tail)
    const openSub = () => {
      if (inSub) return
      submenu?.remove()
      submenu = null
      menu?.querySelectorAll('[data-claude-menu-open]').forEach(node => node.removeAttribute('data-claude-menu-open'))
      if (!item.sub) return
      row.setAttribute('data-claude-menu-open', '')
      submenu = buildMenu(item.sub, true)
      doc.body.append(submenu)
      const box = row.getBoundingClientRect(), outer = menu.getBoundingClientRect()
      const left = outer.left - submenu.offsetWidth - 4
      submenu.style.left = Math.max(8, left < 8 ? outer.right + 4 : left) + 'px'
      submenu.style.top = Math.max(8, Math.min(box.top - 5, win.innerHeight - submenu.offsetHeight - 8)) + 'px'
    }
    row.addEventListener('pointerenter', openSub)
    row.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      if (item.sub) { openSub(); return }
      if (item.disabled) return
      closeMenu()
      item.onSelect()
    })
    return row
  }
  const buildMenu = (items, inSub) => {
    const box = doc.createElement('div')
    box.setAttribute('data-claude-files-menu', inSub ? 'sub' : 'main')
    box.setAttribute('role', 'menu')
    for (const item of items) {
      if (item === '-') { const rule = doc.createElement('div'); rule.setAttribute('role', 'separator'); box.append(rule); continue }
      box.append(menuRow(item, inSub))
    }
    box.addEventListener('pointerdown', event => event.stopPropagation())
    return box
  }
  const toggleSetting = key => () => { settings[key] = !settings[key]; applySettings() }
  const menuItems = () => {
    const view = root.getAttribute('data-claude-files-view')
    const positions = [['auto', 'Automatic'], ['left', 'Left'], ['right', 'Right']]
    return [
      { label: 'Show file tree', checked: view !== 'file' && view !== 'empty', hint: 'Ctrl+Shift+Y', onSelect: () => root.dispatchEvent(new win.CustomEvent('claude-tree-toggle')) },
      { label: 'File tree position', value: positions.find(([key]) => key === settings.treePosition)?.[1] || 'Automatic',
        sub: positions.map(([key, label]) => ({ label, checked: settings.treePosition === key, onSelect: () => { settings.treePosition = key; applySettings() } })) },
      '-',
      { label: 'Preview tabs', checked: settings.previewTabs, onSelect: toggleSetting('previewTabs') },
      { label: 'Auto save', checked: settings.autoSave, onSelect: toggleSetting('autoSave') },
      { label: 'Tab key indents', checked: settings.tabIndents, onSelect: toggleSetting('tabIndents') },
      '-',
      { label: 'Word wrap', checked: settings.wordWrap, onSelect: toggleSetting('wordWrap') },
      { label: 'Indent guides', checked: settings.indentGuides, onSelect: toggleSetting('indentGuides') },
      { label: 'Show whitespace', checked: settings.showWhitespace, onSelect: toggleSetting('showWhitespace') },
      { label: 'Scroll past end', checked: settings.scrollPastEnd, onSelect: toggleSetting('scrollPastEnd') },
      { label: 'Tab size', value: String(settings.tabSize),
        sub: [2, 4, 8].map(size => ({ label: String(size), checked: settings.tabSize === size, onSelect: () => { settings.tabSize = size; applySettings() } })) }
    ]
  }
  // Claude Code's browser menu, through Hermes' own doors on the browser on
  // screen: its Copy URL, console, pop-out and DevTools buttons, its address
  // bar for a file, and the page's webview for a screenshot and the viewport.
  // (Claude's built-in-browser, auto-verify, allowed-sites and cookie
  // settings have no Hermes counterpart and are left out.)
  const browserNow = () => [...doc.querySelectorAll('aside[data-preview-browser]')].find(node => node.checkVisibility({ visibilityProperty: true })) || null
  const browserPress = (aside, label) => aside?.querySelector('button[aria-label="' + label + '"]')?.click()
  const browserGo = (aside, url) => {
    const input = aside?.querySelector("input[aria-label='Address']")
    if (!input) return
    input.focus()
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, url)
    input.dispatchEvent(new win.Event('input', { bubbles: true }))
    input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
  }
  const viewports = [['responsive', 'Responsive'], ['mobile', 'Mobile', 390, 844], ['tablet', 'Tablet', 820, 1180], ['desktop', 'Desktop', 1280, 800]]
  const browserItems = () => {
    const aside = browserNow()
    const webview = aside?.querySelector('webview')
    let url = ''
    try { url = webview?.getURL?.() || '' } catch { url = '' }
    url = url || aside?.querySelector("input[aria-label='Address']")?.value || ''
    const page = Boolean(url) && url !== 'about:blank'
    const viewport = aside?.getAttribute('data-claude-viewport') || 'responsive'
    const consoleOn = aside?.querySelector("button[aria-label$='preview console']")?.getAttribute('aria-pressed') === 'true'
    const devTools = aside?.querySelector("button[aria-label$='preview DevTools']")
    const popIn = aside?.querySelector("button[aria-label='Pop in']")
    return [
      { label: 'Open in browser', disabled: !page, onSelect: () => { void win.hermesDesktop?.openExternal?.(url) } },
      { label: 'Copy URL', disabled: !page, onSelect: () => browserPress(aside, 'Copy URL') },
      { label: 'Save screenshot', disabled: !page || typeof webview?.capturePage !== 'function', onSelect: async () => {
        try { const image = await webview.capturePage(); await win.hermesDesktop?.saveImageFromUrl?.(image.toDataURL()) } catch { /* the page went away */ }
      } },
      { label: 'Open HTML file…', disabled: !aside || typeof win.hermesDesktop?.selectPaths !== 'function', onSelect: async () => {
        const paths = await win.hermesDesktop.selectPaths({ title: 'Open HTML file', multiple: false, filters: [{ name: 'HTML', extensions: ['html', 'htm'] }, { name: 'All files', extensions: ['*'] }] })
        const file = Array.isArray(paths) ? paths[0] : ''
        if (file) browserGo(aside, 'file:///' + encodeURI(String(file).replace(/\\/g, '/').replace(/^\/+/, '')))
      } },
      '-',
      { label: 'Viewport', value: viewports.find(([key]) => key === viewport)?.[1] || 'Responsive', disabled: !aside,
        sub: viewports.map(([key, label, width, height]) => ({ label: width ? label + '  ' + width + ' × ' + height : label, checked: viewport === key, onSelect: () => {
          if (!width) { aside.removeAttribute('data-claude-viewport'); aside.style.removeProperty('--claude-viewport-width'); aside.style.removeProperty('--claude-viewport-height'); return }
          aside.setAttribute('data-claude-viewport', key)
          aside.style.setProperty('--claude-viewport-width', width + 'px')
          aside.style.setProperty('--claude-viewport-height', height + 'px')
        } })) },
      { label: consoleOn ? 'Hide console' : 'Show console', disabled: !aside, onSelect: () => browserPress(aside, consoleOn ? 'Hide preview console' : 'Show preview console') },
      '-',
      { label: popIn ? 'Pop in' : 'Pop out', disabled: !aside, onSelect: () => browserPress(aside, popIn ? 'Pop in' : 'Pop out') },
      { label: devTools?.getAttribute('aria-pressed') === 'true' ? 'Close DevTools' : 'Open DevTools', disabled: !devTools, onSelect: () => devTools?.click() }
    ]
  }
  const onMenu = event => {
    const anchor = event.detail
    if (menu) { closeMenu(); return }
    menu = buildMenu(event.type === 'claude-terminal-menu' ? terminalItems() : event.type === 'claude-browser-menu' ? browserItems() : menuItems(), false)
    doc.body.append(menu)
    anchor?.setAttribute?.('aria-expanded', 'true')
    const box = anchor?.getBoundingClientRect?.() || { right: win.innerWidth - 8, bottom: 40 }
    menu.style.left = Math.max(8, Math.min(box.right - menu.offsetWidth, win.innerWidth - menu.offsetWidth - 8)) + 'px'
    menu.style.top = Math.round(box.bottom + 6) + 'px'
  }
  const onMenuOutside = event => {
    if (tabList && !event.target?.closest?.('[data-claude-tab-list], [data-claude-tab-more]')) closeTabList()
    if (!menu || event.target?.closest?.("[data-claude-files-menu], [data-claude-terminal-action='more']")) return
    closeMenu()
  }
  const onMenuKey = event => {
    if (tabList && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeTabList(); return }
    if (!menu || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    closeMenu()
  }
  // Hermes' tree refresh also refreshes the filter's listing.
  const onRefresh = event => { if (event.target?.closest?.("[data-claude-files-header] button[aria-label='Refresh tree']")) index = null }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, statusbar, popper)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'disabled', 'data-claude-file-name'] })
  observer.observe(root, { attributes: true, attributeFilter: ['data-claude-files-view'] })
  doc.addEventListener('click', onTreeClick, true)
  doc.addEventListener('click', onSourceClick, true)
  doc.addEventListener('click', onResultClick)
  doc.addEventListener('click', onRefresh, true)
  doc.addEventListener('dblclick', onDoubleClick, true)
  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('keydown', onMenuKey, true)
  doc.addEventListener('focusout', onFocusOut, true)
  doc.addEventListener('click', onTabClose, true)
  doc.addEventListener('pointerdown', onMenuOutside, true)
  root.addEventListener('claude-tree-search', onSearch)
  root.addEventListener('claude-files-menu', onMenu)
  root.addEventListener('claude-terminal-menu', onMenu)
  root.addEventListener('claude-browser-menu', onMenu)
  applySettings()
  place()
  return () => {
    closeMenu()
    closeTabList()
    resizer?.disconnect()
    doc.querySelectorAll('[data-claude-tab-more]').forEach(node => node.remove())
    doc.querySelectorAll('[data-claude-tab-overflow]').forEach(node => node.removeAttribute('data-claude-tab-overflow'))
    root.style.removeProperty('--claude-tree-span')
    for (const entry of editors.values()) { try { entry.view.dispatch({ effects: entry.compartment.reconfigure([]) }) } catch { /* gone */ } }
    editors.clear()
    doc.removeEventListener('keydown', onMenuKey, true)
    doc.removeEventListener('focusout', onFocusOut, true)
    doc.removeEventListener('click', onTabClose, true)
    doc.removeEventListener('pointerdown', onMenuOutside, true)
    root.removeEventListener('claude-files-menu', onMenu)
    root.removeEventListener('claude-browser-menu', onMenu)
    root.removeEventListener('claude-terminal-menu', onMenu)
    // Hermes' own terminal options come back.
    for (const term of terminals.values()) { try { term.__claudeCopy?.dispose?.(); delete term.__claudeCopy; Object.assign(term.options, term.__claudeOriginal || {}); delete term.__claudeOriginal } catch { /* gone */ } }
    terminals.clear()
    for (const name of ['data-claude-tree-left', 'data-claude-autosave', 'data-claude-scroll-past-end']) root.removeAttribute(name)
    root.style.removeProperty('--claude-tab-size')
    disposed = true
    observer.disconnect()
    doc.removeEventListener('click', onTreeClick, true)
    doc.removeEventListener('click', onSourceClick, true)
    doc.removeEventListener('click', onResultClick)
    doc.removeEventListener('click', onRefresh, true)
    doc.removeEventListener('dblclick', onDoubleClick, true)
    doc.removeEventListener('keydown', onKeyDown, true)
    root.removeEventListener('claude-tree-search', onSearch)
    if (frame) win.cancelAnimationFrame(frame)
    if (resultsFrame) win.clearTimeout(resultsFrame)
    doc.querySelectorAll('[data-claude-tree-filter], [data-claude-tree-results], [data-claude-edit-done]').forEach(node => node.remove())
    doc.querySelectorAll('[data-claude-preview-tab]').forEach(node => node.removeAttribute('data-claude-preview-tab'))
    doc.querySelectorAll('[data-claude-edit]').forEach(node => { delete node.dataset.claudeEdit })
    root.removeAttribute(FILTERING)
  }
}

// Claude Code's Changes card in Hermes' Review zone. The plugin draws the
// card (header with the compare menu, the stacked diffs, the file list, the
// ⋮ menu and the changed-files search); the data comes through Hermes' own
// git doors: the gateway's /api/git endpoints for a remote backend (the ones
// Hermes' Review uses there) or the desktop bridge's git.review locally,
// for the session's folder (host.state.cwd). Hermes' Review pane stays
// mounted under the card. Read-only: nothing is staged, reverted or
// committed from here.
const CLAUDE_CHANGES_SETTINGS_KEY = 'claude-chat-look.changes-settings'
const CLAUDE_CHANGES_DEFAULTS = { showFiles: true, listPosition: 'auto', groupByFolder: false, separateGenerated: false, sideBySide: false, wordWrap: true, highlightWords: true, hideWhitespace: false, bases: {} }
const CLAUDE_CHANGES_ICONS = {
  chevron: '<path d="M6.25 3.75 10.5 8l-4.25 4.25"/>',
  chevronDown: '<path d="M4 6.25 8 10.25l4-4"/>',
  check: '<path d="M3.5 8.25 6.5 11.25 12.5 4.75"/>',
  search: '<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25 13.25 13.25"/>',
  list: '<path d="M6.25 4.5h6.5M6.25 8h6.5M6.25 11.5h6.5"/><circle cx="3.5" cy="4.5" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="11.5" r=".9" fill="currentColor" stroke="none"/>',
  more: '<circle cx="8" cy="3.75" r=".95" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".95" fill="currentColor" stroke="none"/><circle cx="8" cy="12.25" r=".95" fill="currentColor" stroke="none"/>',
  expand: '<path d="M9.5 2.75h3.75V6.5M13.25 2.75 9.25 6.75M6.5 13.25H2.75V9.5M2.75 13.25l4-4"/>',
  collapse: '<path d="M13.25 2.75l-4 4M9.25 3.5v3.25h3.25M2.75 13.25l4-4M6.75 12.5V9.25H3.5"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  open: '<path d="M5.5 10.5 10.5 5.5M6.25 5.5h4.25v4.25"/>',
  image: '<rect x="2.75" y="3.25" width="10.5" height="9.5" rx="1.5"/><circle cx="6" cy="6.5" r="1"/><path d="m3.5 11.5 3.25-3 2 1.75 1.75-1.5 2.25 2"/>'
}
const CLAUDE_IMAGE_FILE = /\.(png|jpe?g|gif|webp|bmp|ico|svg|avif)$/i
const CLAUDE_GENERATED_FILE = /(^|\/)(tests?|__tests__|spec|specs|dist|build|out|coverage|generated|gen|vendor)\/|\.(test|spec)\.[^/]+$|(^|\/)test_[^/]+$|\.(min\.js|min\.css|map|snap|lock)$|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|uv\.lock|poetry\.lock|Cargo\.lock|go\.sum)$/i

function installClaudeChanges({ state, document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  // Observers here and in the other installers wake on every attribute write,
  // a same-value one too: loops write only real changes.
  const setAttr = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value) }
  const root = doc.documentElement
  let frame = 0, disposed = false
  const settings = (() => {
    let stored = {}
    try { stored = JSON.parse(win.localStorage?.getItem(CLAUDE_CHANGES_SETTINGS_KEY) || '{}') || {} } catch { stored = {} }
    return { ...CLAUDE_CHANGES_DEFAULTS, ...stored, bases: { ...(stored.bases || {}) } }
  })()
  const saveSettings = () => { try { win.localStorage?.setItem(CLAUDE_CHANGES_SETTINGS_KEY, JSON.stringify(settings)) } catch { /* storage off */ } }
  const glyph = name => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '1.25')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = CLAUDE_CHANGES_ICONS[name]
    return svg
  }
  const el = (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag)
    for (const [name, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue
      if (name === 'text') node.textContent = value
      else if (name.startsWith('on')) node.addEventListener(name.slice(2), value)
      else node.setAttribute(name, value === true ? '' : value)
    }
    node.append(...children.filter(child => child !== null && child !== undefined && child !== false))
    return node
  }
  const button = (name, label, onClick, attrs = {}) => {
    const node = el('button', { type: 'button', 'data-claude-changes-action': name, 'aria-label': label, title: label, ...attrs }, glyph(name))
    node.addEventListener('pointerdown', event => event.stopPropagation())
    node.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); onClick(node, event) })
    return node
  }
  const waitFor = (test, ms = 4000) => new Promise(resolve => {
    const end = Date.now() + ms
    const tick = () => { const value = disposed ? null : test(); if (value || disposed || Date.now() > end) resolve(value || null); else win.setTimeout(tick, 60) }
    tick()
  })

  // Data: the git doors Hermes' Review uses.
  const remoteApi = (endpoint, params) => {
    const query = new URLSearchParams()
    for (const [name, value] of Object.entries(params)) if (value !== null && value !== undefined) query.set(name, String(value))
    return win.hermesDesktop.api({ path: '/api/git/' + endpoint + '?' + query })
  }
  const providers = new Map()
  const providerFor = async cwd => {
    if (providers.has(cwd)) return providers.get(cwd)
    const bridge = win.hermesDesktop
    let provider = null
    if (bridge?.api) {
      try {
        await remoteApi('status', { path: cwd })
        provider = {
          status: path => remoteApi('status', { path }),
          bases: async path => (await remoteApi('base-branches', { path }))?.branches || [],
          worktrees: async path => (await remoteApi('worktrees', { path }))?.worktrees || [],
          list: (path, scope, base) => remoteApi('review/list', { path, scope, base }),
          diff: async (path, file, scope, base, staged) => (await remoteApi('review/diff', { path, file, scope, base, staged }))?.diff || ''
        }
      } catch { provider = null }
    }
    if (!provider && bridge?.git?.review) {
      const git = bridge.git
      provider = {
        status: path => git.repoStatus(path),
        bases: async path => (await git.baseBranchList(path)) || [],
        worktrees: async path => (await git.worktreeList?.(path)) || [],
        list: (path, scope, base) => git.review.list(path, scope, base),
        diff: async (path, file, scope, base, staged) => (await git.review.diff(path, file, scope, base, staged)) || ''
      }
    }
    providers.set(cwd, provider)
    return provider
  }
  const cwdNow = () => { try { return String(state?.cwd?.get?.() || '') } catch { return '' } }
  const baseLabel = name => String(name || '').replace(/^origin\//, '')

  // What the card shows.
  let data = { cwd: '', repo: '', status: null, bases: [], files: [], base: null, loading: false, error: '' }
  let mode = 'all'
  const diffs = new Map() // path -> { text, loading }
  const collapsed = new Map() // path -> boolean (user's choice)
  let selected = '', loadSeq = 0, signature = ''
  const defaultBase = () => {
    const chosen = settings.bases[data.repo]
    if (chosen && data.bases.some(branch => branch.name === chosen)) return chosen
    return data.bases.find(branch => branch.isDefault)?.name || data.bases.find(branch => /^(origin\/)?(main|master|develop)$/.test(branch.name))?.name || data.status?.defaultBranch || data.status?.branch || null
  }
  const mergeFiles = (branch, uncommitted) => {
    const byPath = new Map()
    for (const file of branch) byPath.set(file.path, { ...file, parts: ['branch'] })
    for (const file of uncommitted) {
      const known = byPath.get(file.path)
      if (known) { known.added += file.added || 0; known.removed += file.removed || 0; known.parts.push('uncommitted'); known.staged = file.staged } else byPath.set(file.path, { ...file, parts: ['uncommitted'] })
    }
    return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
  }
  const load = async ({ quiet = false } = {}) => {
    const cwd = cwdNow()
    const seq = ++loadSeq
    if (!quiet) { data = { ...data, loading: true }; schedule() }
    try {
      const provider = cwd ? await providerFor(cwd) : null
      if (seq !== loadSeq) return
      if (!provider) { data = { cwd, repo: '', status: null, bases: [], files: [], base: null, loading: false, error: '' }; render(); return }
      const status = await provider.status(cwd).catch(() => null)
      if (!status) { data = { cwd, repo: '', status: null, bases: [], files: [], base: null, loading: false, error: '' }; render(); return }
      const [bases, worktrees] = await Promise.all([provider.bases(cwd).catch(() => []), provider.worktrees(cwd).catch(() => [])])
      const norm = path => String(path || '').replace(/\\/g, '/').replace(/\/+$/, '')
      const repo = worktrees.map(tree => norm(tree.path)).filter(path => path && (norm(cwd) === path || norm(cwd).startsWith(path + '/'))).sort((a, b) => b.length - a.length)[0] || norm(cwd)
      data = { ...data, cwd, repo, status, bases }
      const base = defaultBase()
      const uncommitted = (await provider.list(cwd, 'uncommitted', null).catch(() => null))?.files || []
      const branch = mode === 'all' && base ? ((await provider.list(cwd, 'branch', base).catch(() => null))?.files || []) : []
      if (seq !== loadSeq) return
      const files = mode === 'all' ? mergeFiles(branch, uncommitted) : uncommitted.map(file => ({ ...file, parts: ['uncommitted'] }))
      const next = files.map(file => file.path + ':' + file.added + ':' + file.removed + ':' + file.parts.join('+')).join('|') + '#' + mode + '#' + base
      if (next !== signature) {
        signature = next
        // Changed counts: their diffs are fetched again.
        const keep = new Map(files.map(file => [file.path, file.added + ':' + file.removed]))
        for (const [path, entry] of diffs) if (keep.get(path) !== entry.counts) diffs.delete(path)
      }
      data = { ...data, files, base, loading: false, error: '' }
      render()
    } catch (error) {
      if (seq !== loadSeq) return
      data = { ...data, loading: false, error: String(error?.message || error) }
      render()
    }
  }
  const fetchDiff = async file => {
    const known = diffs.get(file.path)
    if (known) return
    const entry = { text: null, loading: true, counts: file.added + ':' + file.removed }
    diffs.set(file.path, entry)
    try {
      const provider = await providerFor(data.cwd)
      // Committed on the branch, staged, and not staged yet: each its own part
      // (the API gives them apart), labelled when there is more than one.
      const parts = []
      if (file.parts.includes('branch')) parts.push(['Committed', await provider.diff(data.cwd, file.path, 'branch', data.base, false)])
      if (file.parts.includes('uncommitted')) {
        if (file.staged) parts.push(['Staged', await provider.diff(data.cwd, file.path, 'uncommitted', null, true)])
        parts.push(['Not staged', await provider.diff(data.cwd, file.path, 'uncommitted', null, false)])
      }
      entry.parts = parts.filter(([, text]) => text && text.trim())
      entry.text = entry.parts.map(([, text]) => text).join('\n')
    } catch (error) {
      entry.text = ''
      entry.error = String(error?.message || error)
    }
    entry.loading = false
    if (diffs.get(file.path) === entry) renderDiff(file.path)
  }

  // Unified diff -> rows.
  const parseDiff = text => {
    const rows = []
    let oldLine = 0, newLine = 0, binary = false
    const lines = String(text || '').split('\n')
    if (lines[lines.length - 1] === '') lines.pop()
    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/)
        if (match) { oldLine = Number(match[1]); newLine = Number(match[2]); rows.push({ kind: 'hunk', text: line }) }
        continue
      }
      if (/^Binary files /.test(line) || /^GIT binary patch/.test(line)) { binary = true; continue }
      if (!rows.length || /^(diff --git|index |--- |\+\+\+ |new file mode|deleted file mode|old mode|new mode|similarity index|rename (from|to)|\\ No newline)/.test(line)) continue
      if (line.startsWith('+')) rows.push({ kind: 'add', newLine: newLine++, text: line.slice(1) })
      else if (line.startsWith('-')) rows.push({ kind: 'del', oldLine: oldLine++, text: line.slice(1) })
      else if (line.startsWith(' ') || line === '') rows.push({ kind: 'ctx', oldLine: oldLine++, newLine: newLine++, text: line.slice(1) })
    }
    return { rows, binary }
  }
  // Removed and added runs, paired line by line (for words and side by side).
  const pairRuns = rows => {
    const out = []
    for (let at = 0; at < rows.length;) {
      if (rows[at].kind !== 'del' && rows[at].kind !== 'add') { out.push({ row: rows[at] }); at++; continue }
      const dels = [], adds = []
      while (at < rows.length && rows[at].kind === 'del') dels.push(rows[at++])
      while (at < rows.length && rows[at].kind === 'add') adds.push(rows[at++])
      out.push({ dels, adds })
    }
    return out
  }
  const tokens = text => text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || []
  // Which tokens of a and b are not in their longest common subsequence.
  const changedTokens = (a, b) => {
    const x = tokens(a), y = tokens(b)
    if (x.length * y.length > 40000) return null
    const table = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1))
    for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    const markA = new Array(x.length).fill(true), markB = new Array(y.length).fill(true)
    for (let i = 0, j = 0; i < x.length && j < y.length;) {
      if (x[i] === y[j]) { markA[i] = markB[j] = false; i++; j++ } else if (table[i + 1][j] >= table[i][j + 1]) i++; else j++
    }
    // Whitespace between two changed tokens is part of the change.
    const join = (list, marks) => list.map((token, at) => [token, Boolean(marks[at] || (token.trim() === '' && marks[at - 1] && marks[at + 1]))])
    return { a: join(x, markA), b: join(y, markB) }
  }
  const codeCell = (text, marks) => {
    const cell = el('span', { 'data-claude-diff-code': '' })
    if (!marks) cell.textContent = text || ' '
    else for (const [token, changed] of marks) cell.append(changed ? el('mark', { text: token }) : doc.createTextNode(token))
    if (!text) cell.textContent = ' '
    return cell
  }
  const sameIgnoringSpace = (a, b) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '')
  const diffBody = (file, entry) => {
    const { rows, binary } = parseDiff(entry.text)
    const image = CLAUDE_IMAGE_FILE.test(file.path)
    if (binary || image || !rows.length) {
      return el('div', { 'data-claude-diff-note': '' },
        el('span', { text: entry.error ? 'Could not load this diff.' : image ? 'Image file' : binary ? 'Binary file' : 'No text changes' }),
        image ? el('button', { type: 'button', 'data-claude-diff-link': '', text: 'View image', onclick: () => openFile(file) }) : null)
    }
    if (entry.parts?.length > 1) {
      return el('div', { 'data-claude-diff-parts': '' }, ...entry.parts.map(([label, text]) => el('div', { 'data-claude-diff-part': '' }, el('div', { 'data-claude-diff-part-label': '', text: label }), diffBody(file, { text }))))
    }
    const table = el('div', { 'data-claude-diff-table': settings.sideBySide ? 'split' : 'unified' })
    const number = value => el('span', { 'data-claude-diff-num': '', text: value === undefined ? '' : String(value) })
    const unifiedRow = (kind, row, marks) => el('div', { 'data-claude-diff-row': kind }, number(row.oldLine), number(row.newLine), el('span', { 'data-claude-diff-sign': '', text: kind === 'add' ? '+' : kind === 'del' ? '−' : '' }), codeCell(row.text, marks))
    const splitSide = (kind, row, marks) => [number(row ? (kind === 'add' ? row.newLine : row.oldLine) : undefined), el('span', { 'data-claude-diff-side': row ? kind : 'none' }, row ? codeCell(row.text, marks) : codeCell(''))]
    for (const part of pairRuns(rows)) {
      if (part.row) {
        const row = part.row
        if (row.kind === 'hunk') { table.append(el('div', { 'data-claude-diff-row': 'hunk' }, el('span', { 'data-claude-diff-hunk': '', text: row.text }))); continue }
        if (settings.sideBySide) table.append(el('div', { 'data-claude-diff-row': 'ctx' }, ...splitSide('ctx', { ...row, newLine: row.oldLine }), ...splitSide('ctx', { ...row, oldLine: row.newLine })))
        else table.append(unifiedRow('ctx', row))
        continue
      }
      const count = Math.max(part.dels.length, part.adds.length)
      for (let at = 0; at < count; at++) {
        const del = part.dels[at], add = part.adds[at]
        // Hide whitespace changes: a pair that differs only in whitespace reads as context.
        if (settings.hideWhitespace && del && add && sameIgnoringSpace(del.text, add.text)) {
          const row = { oldLine: del.oldLine, newLine: add.newLine, text: add.text }
          table.append(settings.sideBySide ? el('div', { 'data-claude-diff-row': 'ctx' }, ...splitSide('ctx', { oldLine: del.oldLine, text: del.text }), ...splitSide('ctx', { oldLine: add.newLine, text: add.text })) : unifiedRow('ctx', row))
          continue
        }
        const marks = settings.highlightWords && del && add ? changedTokens(del.text, add.text) : null
        if (settings.sideBySide) table.append(el('div', { 'data-claude-diff-row': 'pair' }, ...splitSide('del', del, marks?.a), ...splitSide('add', add, marks?.b)))
        else {
          if (del && at < part.dels.length) table.append(unifiedRow('del', del, marks?.a))
        }
      }
      if (!settings.sideBySide) {
        for (let at = 0; at < part.adds.length; at++) {
          const del = part.dels[at], add = part.adds[at]
          if (settings.hideWhitespace && del && sameIgnoringSpace(del.text, add.text)) continue
          const marks = settings.highlightWords && del ? changedTokens(del.text, add.text) : null
          table.append(unifiedRow('add', add, marks?.b))
        }
      }
    }
    return table
  }

  // The order of the files (and of the list): grouped and separated as set.
  const ordered = () => {
    const files = data.files.slice()
    const groups = settings.separateGenerated
      ? [{ title: '', files: files.filter(file => !CLAUDE_GENERATED_FILE.test(file.path)) }, { title: 'Tests, build and generated', files: files.filter(file => CLAUDE_GENERATED_FILE.test(file.path)) }]
      : [{ title: '', files }]
    for (const group of groups) group.files.sort((a, b) => settings.groupByFolder ? (dirOf(a.path).localeCompare(dirOf(b.path)) || nameOf(a.path).localeCompare(nameOf(b.path))) : a.path.localeCompare(b.path))
    return groups.filter(group => group.files.length)
  }
  const nameOf = path => path.split('/').pop()
  const dirOf = path => path.split('/').slice(0, -1).join('/')
  const isCollapsed = file => collapsed.has(file.path) ? collapsed.get(file.path) : CLAUDE_IMAGE_FILE.test(file.path) || (file.added + file.removed) > 1500
  const counts = file => el('span', { 'data-claude-diff-counts': '' }, el('span', { 'data-claude-diff-added': '', text: '+' + (file.added || 0) }), el('span', { 'data-claude-diff-removed': '', text: '−' + (file.removed || 0) }))
  const fileLabel = file => [el('span', { 'data-claude-result-icon': '' }), el('span', { 'data-claude-diff-name': '', text: nameOf(file.path) }), dirOf(file.path) ? el('span', { 'data-claude-diff-dir': '', text: dirOf(file.path) }) : null]

  // Opening a changed file: in the Files card, through the tree's opener.
  const treeOpener = () => {
    const element = doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
    const key = element && Object.keys(element).find(name => name.startsWith('__reactFiber$'))
    for (let fiber = key ? element[key] : null, depth = 0; fiber && depth < 8; fiber = fiber.return, depth++) if (typeof fiber.memoizedProps?.onPreviewFile === 'function') return fiber.memoizedProps.onPreviewFile
    return null
  }
  const openFile = async file => {
    const path = (data.repo || data.cwd).replace(/\/+$/, '') + '/' + file.path
    // As in Claude: the file shows in the Files card, opened if need be.
    const tool = doc.querySelector("[data-claude-pane-tool='folder']")
    if (tool && tool.getAttribute('aria-pressed') !== 'true') {
      tool.click()
      await waitFor(() => tool.getAttribute('aria-pressed') === 'true', 4000)
    }
    const open = await waitFor(treeOpener, 5000)
    open?.(path)
  }

  // A narrow card (under 560px) leaves the file list out until asked for.
  let narrow = false, narrowFiles = false, sizer = null
  const filesShown = () => narrow ? narrowFiles : Boolean(settings.showFiles)
  const toggleFiles = () => {
    if (narrow) narrowFiles = !narrowFiles
    else { settings.showFiles = !settings.showFiles; saveSettings() }
    applyLayout()
  }
  const applyLayout = () => {
    if (!card) return
    const width = card.getBoundingClientRect().width
    if (width) { const now = width < 560; if (now !== narrow) { narrow = now; narrowFiles = false } }
    setAttr(card, 'data-claude-changes-files', filesShown() ? 'shown' : 'hidden')
    const listButton = header?.querySelector("[data-claude-changes-action='list']")
    if (listButton) setAttr(listButton, 'aria-pressed', filesShown() ? 'true' : 'false')
  }
  // DOM.
  let card = null, header = null, scopeButton = null, diffsPane = null, listPane = null, emptyNote = null, observer = null
  const sections = new Map()
  const build = host => {
    card = el('div', { 'data-claude-changes': '' })
    header = el('div', { 'data-claude-changes-header': '' })
    scopeButton = el('button', { type: 'button', 'data-claude-changes-scope': '', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: event => { event.stopPropagation(); openScopeMenu(scopeButton) } })
    scopeButton.addEventListener('pointerdown', event => event.stopPropagation())
    const tools = el('span', { 'data-claude-changes-tools': '' },
      button('search', 'Go to file', openSearch),
      button('list', 'Show files', () => toggleFiles()),
      button('more', 'More options', openMoreMenu, { 'aria-haspopup': 'menu', 'aria-expanded': 'false' }),
      button('expand', 'Expand Changes', () => {
        const on = root.getAttribute('data-claude-expanded') === 'changes'
        on ? root.removeAttribute('data-claude-expanded') : root.setAttribute('data-claude-expanded', 'changes')
        render()
      }),
      button('close', 'Close Changes', () => { if (root.getAttribute('data-claude-expanded') === 'changes') root.removeAttribute('data-claude-expanded'); doc.querySelector("[data-claude-pane-tool='diff']")?.click() }))
    header.append(scopeButton, tools)
    diffsPane = el('div', { 'data-claude-changes-diffs': '' })
    listPane = el('div', { 'data-claude-changes-list': '', role: 'listbox', 'aria-label': 'Changed files' })
    emptyNote = el('div', { 'data-claude-changes-empty': '', text: 'No changes to show' })
    card.append(header, el('div', { 'data-claude-changes-body': '' }, diffsPane, listPane, emptyNote))
    host.prepend(card)
    sizer = win.ResizeObserver ? new win.ResizeObserver(() => applyLayout()) : null
    sizer?.observe(card)
    observer = win.IntersectionObserver ? new win.IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const file = data.files.find(item => item.path === entry.target.dataset.path)
        if (file && !isCollapsed(file)) fetchDiff(file)
      }
    }, { root: diffsPane, rootMargin: '400px 0px' }) : null
    diffsPane.addEventListener('scroll', () => syncSelectedFromScroll(), { passive: true })
    load()
  }
  const syncSelectedFromScroll = () => {
    const top = diffsPane.getBoundingClientRect().top
    let current = ''
    for (const [path, section] of sections) if (section.getBoundingClientRect().top - top <= 8) current = path
    if (current && current !== selected) { selected = current; markSelected() }
  }
  const markSelected = () => {
    for (const row of listPane.querySelectorAll('[data-claude-changes-row]')) row.setAttribute('aria-selected', row.dataset.path === selected ? 'true' : 'false')
  }
  const renderDiff = path => {
    const section = sections.get(path)
    const file = data.files.find(item => item.path === path)
    if (!section || !file) return
    const body = section.querySelector(':scope > [data-claude-diff-body]')
    const entry = diffs.get(path)
    body.replaceChildren(!entry || entry.loading ? el('div', { 'data-claude-diff-note': '', text: 'Loading…' }) : diffBody(file, entry))
  }
  const toggleFile = (file, open) => {
    collapsed.set(file.path, !open)
    const section = sections.get(file.path)
    section?.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) { fetchDiff(file); renderDiff(file.path) }
  }
  const render = () => {
    if (!card) return
    // Header: what is compared.
    const base = baseLabel(data.base)
    const branch = data.status?.branch || ''
    const label = !data.status ? 'Changes' : mode === 'uncommitted' ? 'Uncommitted changes' : null
    scopeButton.replaceChildren()
    if (label) scopeButton.append(el('span', { text: label }))
    else {
      const head = branch && base !== branch ? branch : 'working tree'
      scopeButton.append(el('span', { text: base || branch || 'Changes' }), el('span', { 'data-claude-changes-arrow': '', text: '→' }), el('span', { text: head }))
    }
    scopeButton.append(glyph('chevronDown'))
    const hasFiles = data.files.length > 0
    card.toggleAttribute('data-claude-changes-has-files', hasFiles)
    applyLayout()
    setAttr(card, 'data-claude-changes-position', settings.listPosition === 'left' ? 'left' : 'right')
    setAttr(card, 'data-claude-changes-wrap', settings.wordWrap ? 'on' : 'off')
    const expand = header.querySelector("[data-claude-changes-action='expand']")
    const expanded = root.getAttribute('data-claude-expanded') === 'changes'
    expand.replaceChildren(glyph(expanded ? 'collapse' : 'expand'))
    expand.setAttribute('aria-label', expanded ? 'Restore Changes' : 'Expand Changes')
    expand.title = expand.getAttribute('aria-label')
    // Stacked diffs and the file list, in one order.
    const groups = ordered()
    const scroll = diffsPane.scrollTop
    observer?.disconnect()
    sections.clear()
    diffsPane.replaceChildren()
    listPane.replaceChildren()
    for (const group of groups) {
      if (group.title) { diffsPane.append(el('div', { 'data-claude-changes-group': '', text: group.title })); listPane.append(el('div', { 'data-claude-changes-group': '', text: group.title })) }
      let folder = null
      for (const file of group.files) {
        const open = !isCollapsed(file)
        const section = el('section', { 'data-claude-diff-file': '', 'data-path': file.path, 'aria-expanded': open ? 'true' : 'false' })
        const head = el('div', { 'data-claude-diff-head': '', title: file.path, role: 'button', tabindex: '0' },
          el('span', { 'data-claude-diff-chevron': '' }, glyph('chevron')), ...fileLabel(file), counts(file),
          el('span', { 'data-claude-diff-actions': '' },
            CLAUDE_IMAGE_FILE.test(file.path) ? button('image', 'View image', () => openFile(file)) : null,
            button('open', 'Open file', () => openFile(file))))
        head.addEventListener('click', () => toggleFile(file, section.getAttribute('aria-expanded') !== 'true'))
        head.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleFile(file, section.getAttribute('aria-expanded') !== 'true') } })
        section.append(head, el('div', { 'data-claude-diff-body': '' }))
        diffsPane.append(section)
        sections.set(file.path, section)
        if (open) renderDiff(file.path)
        observer?.observe(section)
        // The list row.
        const dir = dirOf(file.path)
        if (settings.groupByFolder && dir !== folder) { folder = dir; listPane.append(el('div', { 'data-claude-changes-folder': '', text: dir || '/' })) }
        const row = el('div', { 'data-claude-changes-row': '', 'data-path': file.path, title: file.path, role: 'option', 'aria-selected': file.path === selected ? 'true' : 'false', 'data-indent': settings.groupByFolder ? 'true' : null },
          el('span', { 'data-claude-result-icon': '' }), el('span', { 'data-claude-diff-name': '', text: nameOf(file.path) }),
          !settings.groupByFolder && dir ? el('span', { 'data-claude-diff-dir': '', text: dir }) : null, counts(file))
        row.addEventListener('click', () => goTo(file.path))
        listPane.append(row)
      }
    }
    diffsPane.scrollTop = scroll
    emptyNote.textContent = data.loading && !hasFiles ? '' : 'No changes to show'
  }
  const goTo = path => {
    const file = data.files.find(item => item.path === path)
    const section = sections.get(path)
    if (!file || !section) return
    selected = path
    markSelected()
    if (isCollapsed(file)) toggleFile(file, true)
    diffsPane.scrollTop += section.getBoundingClientRect().top - diffsPane.getBoundingClientRect().top
  }

  // Menus (the look of the Files ⋮ menu).
  let menu = null, submenu = null
  const closeMenus = () => {
    submenu?.remove(); menu?.remove(); searchBox?.remove()
    submenu = menu = searchBox = null
    card?.querySelectorAll("[aria-expanded='true'][aria-haspopup='menu']").forEach(node => node.setAttribute('aria-expanded', 'false'))
  }
  const menuRow = (item, onOpenSub) => {
    const row = el('div', { 'data-claude-menu-row': '', role: item.checked === undefined ? 'menuitem' : 'menuitemcheckbox', 'aria-checked': item.checked === undefined ? null : String(Boolean(item.checked)), tabindex: '-1' }, el('span', { text: item.label }))
    const tail = el('span', { 'data-claude-menu-tail': '' })
    if (item.checked) { const check = glyph('check'); check.setAttribute('data-claude-menu-check', ''); tail.append(check) }
    if (item.hint) tail.append(el('span', { 'data-claude-menu-hint': '', text: item.hint }))
    if (item.sub) { tail.append(glyph('chevron')); row.setAttribute('aria-haspopup', 'menu') }
    row.append(tail)
    row.addEventListener('pointerenter', () => onOpenSub?.(item.sub ? row : null, item))
    row.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation()
      if (item.sub) { onOpenSub?.(row, item); return }
      closeMenus()
      item.onSelect?.()
    })
    return row
  }
  const showMenu = (anchor, items, align = 'right') => {
    if (menu) { const same = anchor.getAttribute('aria-expanded') === 'true'; closeMenus(); if (same) return }
    menu = el('div', { 'data-claude-files-menu': 'main', role: 'menu' })
    const openSub = (row, item) => {
      submenu?.remove(); submenu = null
      menu.querySelectorAll('[data-claude-menu-open]').forEach(node => node.removeAttribute('data-claude-menu-open'))
      if (!row) return
      row.setAttribute('data-claude-menu-open', '')
      submenu = item.buildSub()
      doc.body.append(submenu)
      const box = row.getBoundingClientRect(), outer = menu.getBoundingClientRect()
      const right = outer.right + 4
      submenu.style.left = (right + submenu.offsetWidth < win.innerWidth - 8 && align === 'left' ? right : Math.max(8, outer.left - submenu.offsetWidth - 4)) + 'px'
      submenu.style.top = Math.max(8, Math.min(box.top - 5, win.innerHeight - submenu.offsetHeight - 8)) + 'px'
      submenu.querySelector('input')?.focus()
    }
    for (const item of items) menu.append(item === '-' ? el('div', { role: 'separator' }) : menuRow(item, openSub))
    doc.body.append(menu)
    anchor.setAttribute('aria-expanded', 'true')
    const box = anchor.getBoundingClientRect()
    menu.style.left = Math.max(8, Math.min(align === 'left' ? box.left : box.right - menu.offsetWidth, win.innerWidth - menu.offsetWidth - 8)) + 'px'
    menu.style.top = Math.round(box.bottom + 6) + 'px'
  }
  const simpleSub = items => () => {
    const box = el('div', { 'data-claude-files-menu': 'sub', role: 'menu' })
    for (const item of items) box.append(menuRow(item))
    return box
  }
  const openScopeMenu = anchor => {
    const base = baseLabel(data.base) || 'base'
    const branchSub = () => {
      const box = el('div', { 'data-claude-files-menu': 'sub', 'data-claude-branch-menu': '', role: 'menu' })
      const input = el('input', { type: 'text', placeholder: 'Search branches', 'aria-label': 'Search branches', spellcheck: 'false' })
      const list = el('div', { 'data-claude-branch-list': '' })
      const fill = () => {
        const query = input.value.trim().toLowerCase()
        list.replaceChildren(...data.bases.filter(branch => !query || branch.name.toLowerCase().includes(query)).slice(0, 200).map(branch => {
          const row = menuRow({ label: baseLabel(branch.name) === branch.name || !data.bases.some(other => other !== branch && baseLabel(other.name) === baseLabel(branch.name)) ? baseLabel(branch.name) : branch.name, checked: branch.name === data.base, hint: branch.isDefault ? 'default' : null, onSelect: () => { settings.bases[data.repo] = branch.name; saveSettings(); mode = 'all'; load() } })
          return row
        }))
        if (!list.childElementCount) list.append(el('div', { 'data-claude-menu-empty': '', text: 'No branches' }))
      }
      input.addEventListener('input', fill)
      input.addEventListener('keydown', event => { if (event.key === 'Enter') list.querySelector('[data-claude-menu-row]')?.click(); if (event.key === 'Escape') { event.stopPropagation(); closeMenus() } })
      input.addEventListener('pointerdown', event => event.stopPropagation())
      fill()
      box.append(el('div', { 'data-claude-branch-search': '' }, input), list)
      return box
    }
    showMenu(anchor, [
      { label: 'All changes', checked: mode === 'all', hint: 'vs ' + base, onSelect: () => { mode = 'all'; load() } },
      { label: 'Uncommitted changes', checked: mode === 'uncommitted', onSelect: () => { mode = 'uncommitted'; load() } },
      '-',
      { label: 'Compare against', hint: base, sub: true, buildSub: branchSub }
    ], 'left')
  }
  const toggle = key => () => { settings[key] = !settings[key]; saveSettings(); render() }
  const openMoreMenu = anchor => {
    const refresh = { label: 'Refresh', onSelect: () => { diffs.clear(); signature = ''; load() } }
    if (!data.files.length) { showMenu(anchor, [refresh]); return }
    const positions = [['auto', 'Automatic'], ['left', 'Left'], ['right', 'Right']]
    showMenu(anchor, [
      { label: 'Show files', checked: filesShown(), hint: 'Ctrl+Shift+Y', onSelect: () => toggleFiles() },
      { label: 'File list position', hint: positions.find(([key]) => key === settings.listPosition)?.[1] || 'Automatic', sub: true,
        buildSub: simpleSub(positions.map(([key, label]) => ({ label, checked: settings.listPosition === key, onSelect: () => { settings.listPosition = key; saveSettings(); render() } }))) },
      { label: 'Group files by folder', checked: settings.groupByFolder, onSelect: toggle('groupByFolder') },
      { label: 'Separate test, build, and generated files', checked: settings.separateGenerated, onSelect: toggle('separateGenerated') },
      '-',
      { label: 'Collapse all files', onSelect: () => { for (const file of data.files) collapsed.set(file.path, true); render() } },
      { label: 'Expand all files', onSelect: () => { for (const file of data.files) collapsed.set(file.path, false); render() } },
      '-',
      { label: 'Side by side', checked: settings.sideBySide, onSelect: toggle('sideBySide') },
      { label: 'Word wrap', checked: settings.wordWrap, onSelect: toggle('wordWrap') },
      { label: 'Highlight changed words', checked: settings.highlightWords, onSelect: toggle('highlightWords') },
      { label: 'Hide whitespace changes', checked: settings.hideWhitespace, onSelect: toggle('hideWhitespace') },
      '-',
      refresh
    ])
  }
  // Go to file: a search over the changed files.
  let searchBox = null
  const SEARCH_SHOWN = 12
  const openSearch = anchor => {
    if (searchBox) { closeMenus(); return }
    closeMenus()
    searchBox = el('div', { 'data-claude-changes-search': '' })
    const input = el('input', { type: 'text', placeholder: 'Search changed files', 'aria-label': 'Search changed files', spellcheck: 'false' })
    const list = el('div', { 'data-claude-changes-search-list': '' })
    const footer = el('div', { 'data-claude-changes-search-more': '' })
    let active = 0, matches = []
    const fill = () => {
      const query = input.value.trim().toLowerCase()
      matches = data.files.filter(file => !query || file.path.toLowerCase().includes(query))
      active = Math.min(active, Math.max(0, matches.length - 1))
      list.replaceChildren(...matches.slice(0, 50).map((file, at) => {
        const row = el('div', { 'data-claude-changes-row': '', title: file.path, 'aria-selected': at === active ? 'true' : 'false' }, ...fileLabel(file), counts(file))
        row.addEventListener('click', () => { closeMenus(); goTo(file.path) })
        return row
      }))
      const more = matches.length - SEARCH_SHOWN
      footer.textContent = more > 0 ? more + ' more files. Keep typing to narrow.' : matches.length ? '' : 'No matching files'
      list.querySelector("[aria-selected='true']")?.scrollIntoView({ block: 'nearest' })
    }
    input.addEventListener('input', () => { active = 0; fill() })
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (matches.length) { active = (active + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length; fill() } }
      else if (event.key === 'Enter') { event.preventDefault(); const file = matches[active]; closeMenus(); if (file) goTo(file.path) }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenus() }
    })
    searchBox.append(el('div', { 'data-claude-changes-search-field': '' }, input), list, footer)
    doc.body.append(searchBox)
    const cardBox = card.getBoundingClientRect()
    const width = Math.min(440, cardBox.width - 24)
    const near = anchor?.getBoundingClientRect?.() || cardBox
    searchBox.style.width = width + 'px'
    searchBox.style.left = Math.max(cardBox.left + 12, Math.min(near.right - width, cardBox.right - width - 12)) + 'px'
    searchBox.style.top = Math.round(cardBox.top + 38) + 'px'
    fill()
    input.focus()
  }
  const onOutside = event => {
    if (!menu && !searchBox) return
    if (event.target?.closest?.("[data-claude-files-menu], [data-claude-changes-search], [data-claude-changes-scope], [data-claude-changes-action='more'], [data-claude-changes-action='search']")) return
    closeMenus()
  }
  const onKey = event => {
    if (event.key === 'Escape' && (menu || searchBox)) { event.preventDefault(); event.stopPropagation(); closeMenus(); return }
    if (root.getAttribute('data-claude-last-pane') !== 'changes' || !card?.isConnected) return
    const mod = (event.ctrlKey || event.metaKey) && !event.altKey
    // (Ctrl+P stays Hermes' command palette.)
    if (mod && event.shiftKey && event.key.toLowerCase() === 'y') { event.preventDefault(); event.stopPropagation(); toggleFiles() }
  }
  // The pane last pressed owns Ctrl+Shift+Y (Files has it too).
  const onPress = event => {
    const zone = event.target?.closest?.('[data-tree-group]')?.getAttribute('data-tree-group')
    if (zone === 'grp-review') root.setAttribute('data-claude-last-pane', 'changes')
    else if (zone === 'grp-files' || event.target?.closest?.('[data-claude-preview-column]')) root.setAttribute('data-claude-last-pane', 'files')
  }

  // Mounting in the Review zone, and staying current.
  let lastCwd = null, poll = 0
  const place = () => {
    frame = 0
    if (disposed) return
    const zone = doc.querySelector("[data-tree-group='grp-review']:not([data-pane-host])")
    const aside = zone?.querySelector('aside')
    const host = aside?.parentElement
    if (!host) { if (card && !card.isConnected) card = null; return }
    if (!card || card.parentElement !== host) {
      doc.querySelectorAll('[data-claude-changes]').forEach(node => node.remove())
      host.setAttribute('data-claude-changes-host', '')
      build(host)
      render()
    }
    const cwd = cwdNow()
    if (cwd !== lastCwd) { lastCwd = cwd; if (data.cwd && data.cwd !== cwd) { diffs.clear(); collapsed.clear(); signature = ''; selected = '' } load() }
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, statusbar, popper, editor, diffs, the session list's rows)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [data-tree-group='grp-sessions'] *, [contenteditable='true'], textarea") })
  const mutations = new win.MutationObserver(records => { if (outside(records)) schedule() })
  mutations.observe(doc.body, { childList: true, subtree: true })
  const tick = () => { if (card?.isConnected && doc.visibilityState !== 'hidden' && !menu && !searchBox) load({ quiet: true }) }
  poll = win.setInterval(tick, 6000)
  const onFocus = () => tick()
  win.addEventListener('focus', onFocus)
  doc.addEventListener('pointerdown', onOutside, true)
  doc.addEventListener('pointerdown', onPress, true)
  doc.addEventListener('keydown', onKey, true)
  place()
  return () => {
    disposed = true
    closeMenus()
    mutations.disconnect()
    observer?.disconnect()
    sizer?.disconnect()
    win.clearInterval(poll)
    win.removeEventListener('focus', onFocus)
    doc.removeEventListener('pointerdown', onOutside, true)
    doc.removeEventListener('pointerdown', onPress, true)
    doc.removeEventListener('keydown', onKey, true)
    if (frame) win.cancelAnimationFrame(frame)
    doc.querySelectorAll('[data-claude-changes]').forEach(node => node.remove())
    doc.querySelectorAll('[data-claude-changes-host]').forEach(node => node.removeAttribute('data-claude-changes-host'))
    if (root.getAttribute('data-claude-expanded') === 'changes') root.removeAttribute('data-claude-expanded')
    root.removeAttribute('data-claude-last-pane')
  }
}

const CLAUDE_OVERFLOW_TOOLS = [
  { selector: "button[aria-label='Layout editor']", icon: 'layout' },
  { selector: "button[aria-label='HUD mode']", icon: 'screen-full' },
  { selector: "button[aria-label='Swap sidebar sides']", icon: 'arrow-swap' },
  // Hermes' fold brings a closed terminal back; this one is the panes' own.
  { selector: "button[data-tour='right-pane-toggle']", icon: 'layout-sidebar-right', side: true }
]

function installClaudePaneTools({ runAction, listActions, paneVisibility, document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  if (typeof runAction !== 'function') return () => {}
  let allowed = null
  try { allowed = new Set((listActions?.() || []).map(action => action.id)) } catch { allowed = null }
  const tools = CLAUDE_PANE_TOOLS.filter(tool => !tool.action || !allowed?.size || allowed.has(tool.action)).map(tool => ({ ...tool }))
  let group = null, menu = null, more = null, frame = 0, disposed = false
  const offs = []
  // Hermes' Files pane is its whole right side: closing it folds the terminal
  // too. Here Files is only hidden (CSS keyed on this attribute) and stays
  // hidden until its own button opens it again, so the terminal and Changes
  // open and close on their own.
  const CLAUDE_FILES_HIDDEN_ATTR = 'data-claude-files-hidden'
  const CLAUDE_FILES_HIDDEN_STORAGE_KEY = 'claude-chat-look.files.hidden'
  const root = doc.documentElement
  const filesHidden = () => root.getAttribute(CLAUDE_FILES_HIDDEN_ATTR) === 'true'
  const setFilesHidden = on => {
    if (on) root.setAttribute(CLAUDE_FILES_HIDDEN_ATTR, 'true')
    else root.removeAttribute(CLAUDE_FILES_HIDDEN_ATTR)
    try { win.localStorage?.setItem(CLAUDE_FILES_HIDDEN_STORAGE_KEY, on ? 'true' : 'false') } catch { /* Private window: session only. */ }
  }
  let stored = null
  try { stored = win.localStorage?.getItem(CLAUDE_FILES_HIDDEN_STORAGE_KEY) } catch {}
  // Files opens only from its own button; until then the side shows the rest.
  if (stored !== 'false') root.setAttribute(CLAUDE_FILES_HIDDEN_ATTR, 'true')
  offs.push(() => root.removeAttribute(CLAUDE_FILES_HIDDEN_ATTR))
  // Observers here and in the other installers wake on every attribute write,
  // a same-value one too: loops write only real changes.
  const setAttr = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value) }
  const setActive = (button, on) => {
    const value = on ? 'true' : 'false'
    if (button.getAttribute('aria-pressed') !== value) button.setAttribute('aria-pressed', value)
  }
  const closeMenu = () => {
    menu?.remove()
    menu = null
    more?.setAttribute('aria-expanded', 'false')
  }
  const openMenu = () => {
    if (menu) return closeMenu()
    const cluster = doc.querySelector("[data-titlebar-cluster='right']")
    menu = doc.createElement('div')
    menu.setAttribute('role', 'menu')
    menu.dataset.claudeAccountMenu = ''
    menu.dataset.claudeOverflowMenu = ''
    for (const entry of CLAUDE_OVERFLOW_TOOLS) {
      const native = cluster?.querySelector(entry.selector)
      if (!native) continue
      const item = doc.createElement('button')
      item.type = 'button'
      item.setAttribute('role', 'menuitem')
      item.dataset.claudeAccountItem = ''
      const glyph = doc.createElement('i')
      glyph.className = 'codicon codicon-' + entry.icon
      glyph.setAttribute('aria-hidden', 'true')
      const label = doc.createElement('span')
      label.dataset.claudeAccountLabel = ''
      label.textContent = entry.side ? (sideTools().some(isOpen) ? 'Hide right sidebar' : 'Show right sidebar') : native.getAttribute('aria-label') || ''
      item.append(glyph, label)
      item.addEventListener('click', () => { closeMenu(); if (entry.side) toggleSide(); else native.click() })
      menu.append(item)
    }
    if (!menu.childElementCount) { menu = null; return }
    doc.body.append(menu)
    const rect = more.getBoundingClientRect()
    menu.style.top = (rect.bottom + 6) + 'px'
    menu.style.right = Math.max(8, win.innerWidth - rect.right) + 'px'
    more.setAttribute('aria-expanded', 'true')
    menu.querySelector('button')?.focus()
  }
  const button = (template, icon, label) => {
    const element = doc.createElement('button')
    element.type = 'button'
    element.className = template?.className || ''
    element.dataset.claudePaneTool = icon
    element.setAttribute('aria-label', label)
    element.title = label
    let glyph
    if (CLAUDE_PANE_ICONS[icon]) {
      glyph = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
      glyph.setAttribute('viewBox', '0 0 16 16')
      glyph.setAttribute('fill', 'none')
      glyph.setAttribute('stroke', 'currentColor')
      glyph.setAttribute('stroke-width', '1.25')
      glyph.setAttribute('stroke-linecap', 'round')
      glyph.setAttribute('stroke-linejoin', 'round')
      glyph.innerHTML = CLAUDE_PANE_ICONS[icon]
      glyph.dataset.claudePaneGlyph = ''
    } else {
      glyph = doc.createElement('i')
      glyph.className = 'codicon codicon-' + icon
    }
    glyph.setAttribute('aria-hidden', 'true')
    element.append(glyph)
    element.addEventListener('pointerdown', event => event.stopPropagation())
    return element
  }
  const build = template => {
    group = doc.createElement('div')
    group.dataset.claudePaneTools = ''
    for (const tool of tools) {
      const element = button(template, tool.icon, tool.label)
      element.setAttribute('aria-pressed', 'false')
      element.addEventListener('click', () => { toggle(tool); schedule() })
      tool.element = element
      group.append(element)
    }
    more = button(template, 'kebab-vertical', 'More')
    more.dataset.claudePaneTool = 'more'
    more.setAttribute('aria-haspopup', 'menu')
    more.setAttribute('aria-expanded', 'false')
    more.addEventListener('click', openMenu)
    group.append(more)
  }
  const isShown = selector => [...doc.querySelectorAll(selector)].some(node => {
    const rect = node.getBoundingClientRect()
    if (!(rect.width > 0 && rect.height > 0)) return false
    return typeof node.checkVisibility === 'function' ? node.checkVisibility({ visibilityProperty: true }) : true
  })
  const run = action => {
    const result = runAction(action)
    if (result && result.ok === false) console.warn('[claude-chat-look] ' + action + ' refused', result.error)
    return !(result && result.ok === false)
  }
  const press = selector => {
    const native = doc.querySelector(selector)
    if (!native) return false
    native.click()
    return true
  }
  const chord = keys => {
    if (!keys) return false
    // Hermes listens on the document; an event sent to window never reaches it.
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { ...keys, bubbles: true, cancelable: true }))
    return true
  }
  const atoms = new Map()
  const paneAtom = id => {
    if (!id || typeof paneVisibility !== 'function') return null
    if (!atoms.has(id)) {
      let atom = null
      try { atom = paneVisibility(id) } catch { /* Older hosts: DOM fallback. */ }
      atoms.set(id, typeof atom?.get === 'function' ? atom : null)
      if (atom?.subscribe) try { const off = atom.subscribe(schedule); if (typeof off === 'function') offs.push(off) } catch {}
    }
    return atoms.get(id)
  }
  const claimed = tool => {
    const atom = paneAtom(tool.pane)
    return atom ? Boolean(atom.get()) : null
  }
  // Side panes go by the screen alone: Hermes keeps a folded side's panes
  // "open" in its state, and Files stays laid out while it is hidden here.
  const isOpen = tool => tool.side
    ? !(tool.id === 'files' && filesHidden()) && (isShown(tool.shown) ||
      // Files showing only the open file (Claude's tree toggle off) is still open.
      (tool.id === 'files' && root.getAttribute('data-claude-files-view') === 'file'))
    : claimed(tool) !== false && isShown(tool.shown)
  // Terminal, Changes and Files share Hermes' right side, and Hermes opens
  // and folds that side as one. Each button here drives only its own pane:
  // a folded side is unfolded first, then every other pane is put back the
  // way the buttons left it.
  const sideTools = () => tools.filter(tool => tool.side)
  const sideFolded = () => {
    try { return JSON.parse(win.localStorage?.getItem('hermes.desktop.collapsedTreeSides.v1') || '[]').includes('right') } catch { return false }
  }
  // Hermes keeps each side pane's open flag apart from its layout tree, and
  // some of its own paths (⌘J, Files' show) put a pane back on screen without
  // setting it. A close then re-sets a flag that is already off, and the
  // button reads as dead until a reload. Before a close the flag is put back
  // in step with the screen: the terminal's through its store (held by
  // Hermes' terminal host). Changes needs none: Hermes' toggleReview asks the
  // layout tree what is on screen, and its narrow-window branch (once the way
  // to re-set the flag) now pins the pane revealed, which kept it open.
  // Hermes' terminal host (mounted even with no terminal open) reads two
  // stores, its slot element and the open flag: useStore($slot), then
  // useStore($terminalTakeover). Found by walking the React tree (~8k fibers).
  const terminalStore = () => {
    const container = doc.getElementById('root')
    const key = container && Object.keys(container).find(name => name.startsWith('__reactContainer$'))
    const isStore = value => value && typeof value.get === 'function' && typeof value.listen === 'function' && typeof value.set === 'function'
    const stack = key ? [container[key]] : []
    while (stack.length) {
      const fiber = stack.pop()
      if (typeof fiber.type === 'function') {
        const stores = []
        for (let hook = fiber.memoizedState; hook && stores.length < 3; hook = hook.next) {
          const memo = hook.memoizedState
          if (Array.isArray(memo) && memo.length === 2 && typeof memo[0] === 'function' && Array.isArray(memo[1]) && isStore(memo[1][0])) stores.push(memo[1][0])
        }
        if (stores.length === 2 && stores[0].get()?.nodeType === 1 && typeof stores[1].get() === 'boolean') return stores[1]
      }
      if (fiber.sibling) stack.push(fiber.sibling)
      if (fiber.child) stack.push(fiber.child)
    }
    return null
  }
  const resync = tool => {
    try {
      if (tool.id === 'terminal') {
        const store = terminalStore()
        if (store && store.get() === false) store.set(true)
      }
    } catch { /* The plain close below still runs. */ }
  }
  const setPane = (tool, on) => {
    if (tool.id === 'files') { setFilesHidden(!on); return true }
    if (isOpen(tool) === on) return true
    if (!on) resync(tool)
    if (tool.action) return run(tool.action)
    // The terminal toggle is Hermes' own (ctrl+backquote): it minimizes the
    // terminal zone, and the layout CSS hides a minimized one.
    return press(tool.native) || chord(tool.chord)
  }
  const toggle = tool => {
    const open = isOpen(tool)
    if (!tool.side) {
      if (open && tool.closeAction) return run(tool.closeAction)
      return run(tool.action)
    }
    // Closing never folds the side: Hermes' fold restores a minimized terminal
    // instead of hiding the column. The layout CSS drops an emptied column.
    if (open) return setPane(tool, false)
    if (!sideFolded()) return setPane(tool, true)
    if (tool.id === 'files') setFilesHidden(false)
    const done = run(tool.id === 'files' ? tool.action : 'view.toggleRightSidebar')
    win.setTimeout(() => {
      if (disposed) return
      for (const other of sideTools()) setPane(other, other === tool)
    }, 450)
    return done
  }
  // The right side as a whole: its open panes close one by one (the column
  // goes with the last), and come back the same way.
  let lastSide = []
  const toggleSide = () => {
    const open = sideTools().filter(isOpen)
    if (open.length) {
      lastSide = open.map(tool => tool.id)
      for (const tool of open) setPane(tool, false)
    } else {
      const wanted = lastSide.length ? lastSide : ['files']
      for (const tool of sideTools().filter(tool => wanted.includes(tool.id))) toggle(tool)
    }
    schedule()
  }
  // Sizes inside and around the right column are ours (see the layout CSS).
  // Hermes derives them from its side panes' widths and clamps those to the
  // panes' 10-20rem, so its drags snap back; the column width, the Changes /
  // Files split and the terminal height are dragged here instead, bounded so
  // every open pane keeps a usable size, and remembered across restarts.
  // Every workspace sash also gets Claude's grip (data-claude-grip).
  const SIZES_KEY = 'claude-chat-look.pane-sizes'
  const SIDE_MIN = 320, CONVERSATION_MIN = 320, RAIL_PANE_MIN = 200, TERMINAL_MIN = 120, RAIL_MIN = 160
  const sizes = { side: 0, preview: 0, rail: 0, terminal: 0, card: 0, tree: 0, narrowTree: false, wideTreeHidden: false }
  try { Object.assign(sizes, JSON.parse(win.localStorage?.getItem(SIZES_KEY) || '{}')) } catch {}
  try {
    // The width the first version of this kept on its own.
    const legacy = Number(win.localStorage?.getItem('claude-chat-look.side-width'))
    if (!sizes.side && legacy > 0) sizes.side = legacy
  } catch {}
  const saveSizes = () => { try { win.localStorage?.setItem(SIZES_KEY, JSON.stringify(sizes)) } catch {} }
  const shown = node => Boolean(node) && node.getAttribute('style')?.includes('display: none') !== true && node.checkVisibility?.() !== false
  const groupWrap = id => doc.querySelector(`[data-tree-group='${id}']:not([data-pane-host])`)?.parentElement || null
  // The right column: the zone of the root row holding Changes, Files or the terminal.
  const sideColumn = () => {
    const group = ['grp-terminal', 'grp-review', 'grp-files'].map(id => doc.querySelector(`[data-tree-group='${id}']:not([data-pane-host])`)).find(Boolean)
    let node = group?.parentElement
    while (node?.parentElement) {
      const split = node.parentElement
      if (split.matches('[data-tree-split]') && split.querySelector(":scope > div > [data-tree-group='grp-main'], :scope > div > [data-tree-group='grp-sessions']")) return node
      node = split.parentElement
    }
    return null
  }
  // The sash on the edge between two neighbours: either's own separator there.
  const sashBetween = (before, after, axis) => {
    if (!before || !after) return null
    const edge = axis === 'x' ? after.getBoundingClientRect().left : after.getBoundingClientRect().top
    return [...after.children, ...before.children].find(node => {
      if (!node.matches("[role='separator']")) return false
      const box = node.getBoundingClientRect()
      return Math.abs((axis === 'x' ? box.left + box.width / 2 : box.top + box.height / 2) - edge) < 12
    }) || null
  }
  const layout = () => {
    const column = sideColumn()
    const review = groupWrap('grp-review'), files = groupWrap('grp-files'), terminal = groupWrap('grp-terminal')
    const rail = review?.parentElement?.parentElement || files?.parentElement?.parentElement || null
    const railOpen = [review, files].some(wrap => shown(wrap) && wrap.getBoundingClientRect().width > 0)
    const terminalOpen = shown(terminal) && terminal.getBoundingClientRect().height > 0
    // Another zone beside the conversation in the root row (the browser).
    const main = groupWrap('grp-main')
    // (Still the preview zone while the Files card shows only its tree.)
    const preview = [...(main?.parentElement?.children || [])].find(node => node !== main && node !== column && node.tagName === 'DIV' &&
      !node.querySelector("[data-tree-group='grp-sessions']") && node.querySelector('[data-tree-group]:not([data-pane-host])') &&
      ((shown(node) && node.getBoundingClientRect().width > 0) || (node.hasAttribute('data-claude-preview-column') && root.getAttribute('data-claude-files-view') === 'tree'))) || null
    return {
      column, review, files, terminal, rail, railOpen, terminalOpen, main, preview,
      bothRail: shown(review) && shown(files) && review.getBoundingClientRect().width > 0 && files.getBoundingClientRect().width > 0
    }
  }
  const clamp = (value, min, max) => Math.round(Math.min(Math.max(value, min), Math.max(min, max)))
  // Room for one column: the window right of the session list, less the
  // conversation's minimum and the other column's width.
  const columnMax = other => win.innerWidth - (doc.querySelector("[data-tree-group='grp-sessions']")?.getBoundingClientRect().right || 0) -
    CONVERSATION_MIN - (other && shown(other) ? other.getBoundingClientRect().width : 0)
  // (A file joined to or laid over the Files card is part of it, not a neighbour.)
  const sideMax = () => columnMax(root.hasAttribute('data-claude-file-joined') || root.hasAttribute('data-claude-file-over') ? null : layout().preview)
  const previewMax = () => columnMax(layout().column)
  // The joined file + Files card (Claude's Files card with a file open) is
  // as wide as the Files card alone (one card in Claude), and holds the tree
  // at its own width.
  const FILES_SPLIT_MIN = 400, CARD_DEFAULT = 320, TREE_DEFAULT = 240, TREE_MIN = 160
  let lastFileTab = '', hadFileTabs = false, browserBefore = false
  const cardWidth = () => clamp(sizes.side || CARD_DEFAULT, SIDE_MIN, columnMax(null))
  const treeWidth = () => clamp(sizes.tree || TREE_DEFAULT, TREE_MIN, cardWidth() - TREE_MIN)
  // A root custom property write restyles the whole page, an unchanged one too.
  const setVar = (name, value) => { if (root.style.getPropertyValue(name) !== value) value ? root.style.setProperty(name, value) : root.style.removeProperty(name) }
  const applySizes = () => {
    // Every measure before any write: a write between two reads lays the page out again.
    const card = cardWidth(), tree = clamp(sizes.tree || TREE_DEFAULT, TREE_MIN, card - TREE_MIN)
    const side = sizes.side ? clamp(sizes.side, SIDE_MIN, sideMax()) : 0
    const preview = sizes.preview ? clamp(sizes.preview, SIDE_MIN, previewMax()) : 0
    setVar('--claude-files-card', card + 'px')
    setVar('--claude-files-tree', tree + 'px')
    // Expanded, the tree keeps its own width whatever the card's.
    setVar('--claude-files-tree-wide', clamp(sizes.tree || TREE_DEFAULT, TREE_MIN, 600) + 'px')
    setVar('--claude-side-width', side ? side + 'px' : '')
    setVar('--claude-preview-width', preview ? preview + 'px' : '')
    if (sizes.rail) setVar('--claude-rail-split', sizes.rail + '%')
    else setVar('--claude-rail-split', '')
    if (sizes.terminal) setVar('--claude-terminal-height', sizes.terminal + 'px')
    else setVar('--claude-terminal-height', '')
  }
  applySizes()
  offs.push(() => ['--claude-side-width', '--claude-preview-width', '--claude-rail-split', '--claude-terminal-height', '--claude-files-card', '--claude-files-tree', '--claude-files-tree-wide'].forEach(name => root.style.removeProperty(name)))
  // The tree toggle (installClaudeTerminalHeader) asks; the width decides.
  const onTreeToggle = () => {
    const view = root.getAttribute('data-claude-files-view')
    // No file open: the toggle swaps the tree for Claude's empty state.
    if (!view || view === 'empty' || view === 'split') sizes.treeOff = !sizes.treeOff
    else if (view === 'both') sizes.wideTreeHidden = true
    else if (view === 'tree') sizes.narrowTree = false
    else if (!root.hasAttribute('data-claude-file-over') && (root.getAttribute('data-claude-expanded') === 'files' || cardWidth() >= FILES_SPLIT_MIN)) sizes.wideTreeHidden = false
    else sizes.narrowTree = true
    saveSizes()
    schedule()
  }
  root.addEventListener('claude-tree-toggle', onTreeToggle)
  offs.push(() => { root.removeEventListener('claude-tree-toggle', onTreeToggle); root.removeAttribute('data-claude-files-view') })
  const setFlag = (name, on) => { if (on !== root.hasAttribute(name)) on ? root.setAttribute(name, '') : root.removeAttribute(name) }
  offs.push(() => ['data-claude-rail-open', 'data-claude-terminal-open', 'data-claude-rail-both', 'data-claude-file-joined', 'data-claude-file-over'].forEach(name => root.removeAttribute(name)))
  // Which sash is which, and the open-pane state the size rules key on.
  const markSashes = () => {
    // The bounds follow the layout (a column opening or closing beside them).
    applySizes()
    const state = layout()
    setFlag('data-claude-rail-open', state.railOpen)
    setFlag('data-claude-terminal-open', state.terminalOpen)
    setFlag('data-claude-rail-both', state.bothRail)
    if (state.column) setAttr(state.column, 'data-claude-side-column', '')
    for (const node of doc.querySelectorAll('[data-claude-side-column]')) if (node !== state.column) node.removeAttribute('data-claude-side-column')
    // A file open in the preview zone beside an open Files card reads as one
    // card, as in Claude Code: the file on the left, the tree on the right.
    const activeTab = state.preview?.querySelector("[data-tree-group]:not([data-pane-host]) [role='tab'][data-tree-tab][aria-selected='true']")
    const visible = wrap => shown(wrap) && wrap.getBoundingClientRect().width > 0
    // The joined card hides one side of itself at times, so the panes are
    // judged by Hermes' own state on their zones, not by what is on screen.
    const inlineShown = wrap => Boolean(wrap) && !/display:\s*none/.test(wrap.getAttribute('style') || '')
    const filesOn = !filesHidden() && inlineShown(state.files) && inlineShown(state.column)
    const reviewOn = inlineShown(state.review)
    const terminalOn = inlineShown(state.terminal) && !/flex:\s*0 0 auto/.test(state.terminal?.getAttribute('style') || '')
    const fileTab = activeTab?.getAttribute('data-tree-tab') || ''
    const fileActive = Boolean(state.preview && fileTab.startsWith('preview-tile:file:') && filesOn)
    const joined = Boolean(fileActive && state.column && state.preview.nextElementSibling === state.column && !reviewOn && !terminalOn)
    setFlag('data-claude-file-joined', joined)
    // Files sharing its column (Changes or the terminal open too): the file
    // takes the Files card's place instead, laid over it (data-claude-file-over),
    // and the tree toggle switches the card between file and tree.
    const over = fileActive && !joined
    setFlag('data-claude-file-over', over)
    if (over) {
      const box = doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host])")?.getBoundingClientRect()
      if (box?.width) for (const [name, value] of [['x', box.left], ['y', box.top], ['w', box.width], ['h', box.height]]) {
        const px = Math.round(value) + 'px'
        if (root.style.getPropertyValue('--claude-over-' + name) !== px) root.style.setProperty('--claude-over-' + name, px)
      }
    }
    // Claude's Files card: under FILES_SPLIT_MIN it shows the file or the tree,
    // from there the tree beside the file; the tree toggle picks within that.
    // A newly opened file comes to the front.
    if (fileActive && fileTab !== lastFileTab) sizes.narrowTree = false
    lastFileTab = fileActive ? fileTab : ''
    // Closing the last file brings Hermes' browser tab forward even when the
    // browser was not open; then it steps back, and Files shows its tree. An
    // empty browser tab (about:blank) is closed outright: a merely hidden one
    // stays Hermes' anchor for the next preview, which then lands in the
    // conversation's zone. A browser with a page is only hidden.
    const fileTabs = doc.querySelectorAll("[role='tab'][data-tree-tab^='preview-tile:file:']").length
    // Hermes keeps unselected tiles mounted under visibility: hidden.
    const browserAside = [...doc.querySelectorAll('aside[data-preview-browser]')].find(node => node.checkVisibility?.({ visibilityProperty: true }))
    if (fileTabs) hadFileTabs = true
    else {
      if (hadFileTabs && !browserBefore && browserAside) {
        const blank = /^about:blank$/.test(browserAside.querySelector("input[aria-label='Address']")?.value || '')
        const tabId = 'preview-tile:' + browserAside.getAttribute('data-preview-browser')
        win.setTimeout(() => {
          const close = blank && [...doc.querySelectorAll("[role='tab'][data-tree-tab]")].find(tab => tab.getAttribute('data-tree-tab') === tabId)?.querySelector("button[aria-label='Close']")
          if (close) close.click()
          else doc.querySelector("[data-claude-pane-tool='globe'][aria-pressed='true']")?.click()
        }, 0)
      }
      hadFileTabs = false
      browserBefore = Boolean(browserAside)
    }
    const wide = root.getAttribute('data-claude-expanded') === 'files' || cardWidth() >= FILES_SPLIT_MIN
    // No file open: a narrow Files card is the tree (or, toggled off, Claude's
    // empty state); from FILES_SPLIT_MIN the empty file area sits left of the tree.
    const filesCard = doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host])")
    const filesWide = root.getAttribute('data-claude-expanded') === 'files' || (filesCard?.getBoundingClientRect().width || 0) >= FILES_SPLIT_MIN
    const view = over ? (sizes.narrowTree ? 'tree' : 'file')
      : !joined ? (!filesOn ? '' : sizes.treeOff ? 'empty' : filesWide ? 'split' : '')
      : wide ? (sizes.wideTreeHidden ? 'file' : 'both') : (sizes.narrowTree ? 'tree' : 'file')
    if ((root.getAttribute('data-claude-files-view') || '') !== view) view ? root.setAttribute('data-claude-files-view', view) : root.removeAttribute('data-claude-files-view')
    if (state.preview) state.preview.setAttribute('data-claude-preview-column', '')
    for (const node of doc.querySelectorAll('[data-claude-preview-column]')) if (node !== state.preview) node.removeAttribute('data-claude-preview-column')
    const roles = new Map()
    const side = state.column && sashBetween(state.column.previousElementSibling, state.column, 'x')
    const previewSash = state.preview && sashBetween(state.preview.previousElementSibling, state.preview, 'x')
    if (joined) {
      // The joined card: its left edge sizes the card, the edge between file
      // and tree sizes the tree.
      const outer = view === 'tree' ? side : previewSash
      if (outer) roles.set(outer, 'card')
      if (view === 'both' && side) roles.set(side, 'tree')
    } else {
      if (side) roles.set(side, 'side')
      if (previewSash && !over) roles.set(previewSash, 'preview')
    }
    const railSash = state.bothRail && sashBetween(state.review, state.files, 'x')
    if (railSash) roles.set(railSash, 'rail')
    const railWrap = state.rail?.parentElement
    const terminalSash = state.railOpen && state.terminalOpen && sashBetween(railWrap, state.terminal, 'y')
    if (terminalSash) roles.set(terminalSash, 'terminal')
    for (const node of doc.querySelectorAll('[data-tree-split] [role="separator"]')) {
      const role = roles.get(node) || ''
      const box = node.getBoundingClientRect()
      const grip = box.width || box.height ? (box.height >= box.width ? 'x' : 'y') : ''
      if ((node.getAttribute('data-claude-sash') || '') !== role) role ? node.setAttribute('data-claude-sash', role) : node.removeAttribute('data-claude-sash')
      if (grip && node.getAttribute('data-claude-grip') !== grip) { node.setAttribute('data-claude-grip', grip); node.title = 'Resize' }
    }
  }
  offs.push(() => doc.querySelectorAll('[data-claude-sash], [data-claude-grip], [data-claude-side-column], [data-claude-preview-column]').forEach(node => {
    node.removeAttribute('data-claude-sash'); node.removeAttribute('data-claude-grip'); node.removeAttribute('data-claude-side-column'); node.removeAttribute('data-claude-preview-column')
    if (node.title === 'Resize') node.removeAttribute('title')
  }))
  const onSashDown = event => {
    if (event.button !== 0) return
    const sash = event.target?.closest?.('[data-claude-sash]')
    const role = sash?.getAttribute('data-claude-sash')
    if (!role) return
    const state = layout()
    const target = role === 'side' || role === 'card' || role === 'tree' ? state.column : role === 'preview' ? state.preview : role === 'rail' ? state.rail : state.terminal?.parentElement
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    const box = target.getBoundingClientRect()
    // Bounds are for the cards; a zone also holds its margins (and the top
    // card the titlebar band above it).
    const overhead = wrap => {
      const card = wrap?.querySelector(':scope > [data-tree-group]:not([data-pane-host])') || wrap?.querySelector('[data-tree-group]:not([data-pane-host])')
      return wrap && card ? Math.max(0, wrap.getBoundingClientRect().height - card.getBoundingClientRect().height) : 0
    }
    const above = [state.review, state.files].find(wrap => shown(wrap) && wrap.getBoundingClientRect().width > 0)
    const railOverhead = above && state.rail?.parentElement
      ? Math.max(0, state.rail.parentElement.getBoundingClientRect().height - above.querySelector('[data-tree-group]:not([data-pane-host])').getBoundingClientRect().height)
      : 0
    const terminalOverhead = overhead(state.terminal)
    const railPaneMin = RAIL_PANE_MIN + 8
    const startX = event.clientX
    const startWidth = role === 'card' ? cardWidth() : role === 'tree' ? treeWidth() : box.width
    const limit = role === 'side' ? sideMax() : role === 'preview' ? previewMax() : 0
    root.setAttribute('data-claude-side-resizing', role === 'terminal' ? 'y' : 'x')
    const move = moveEvent => {
      moveEvent.preventDefault()
      if (role === 'card') {
        sizes.side = clamp(startWidth - (moveEvent.clientX - startX), SIDE_MIN, columnMax(null))
        schedule()
      } else if (role === 'tree') {
        // The tree on the left (Files ⋮ > File tree position) grows to the right.
        const toward = root.hasAttribute('data-claude-tree-left') ? -1 : 1
        sizes.tree = clamp(startWidth - toward * (moveEvent.clientX - startX), TREE_MIN, cardWidth() - TREE_MIN)
      } else if (role === 'side' || role === 'preview') {
        sizes[role] = clamp(startWidth - (moveEvent.clientX - startX), SIDE_MIN, limit)
        schedule()
      } else if (role === 'rail') {
        const min = Math.min(50, (railPaneMin / box.width) * 100)
        sizes.rail = Math.round(Math.min(Math.max(((moveEvent.clientX - box.left) / box.width) * 100, min), 100 - min) * 10) / 10
      } else {
        sizes.terminal = clamp(box.bottom - moveEvent.clientY, TERMINAL_MIN + terminalOverhead, box.height - RAIL_MIN - railOverhead)
      }
      applySizes()
      // (The file laid over the Files card follows its moves too.)
      schedule()
    }
    const up = () => {
      doc.removeEventListener('pointermove', move, true)
      doc.removeEventListener('pointerup', up, true)
      doc.removeEventListener('pointercancel', up, true)
      root.removeAttribute('data-claude-side-resizing')
      saveSizes()
    }
    doc.addEventListener('pointermove', move, true)
    doc.addEventListener('pointerup', up, true)
    doc.addEventListener('pointercancel', up, true)
  }
  doc.addEventListener('pointerdown', onSashDown, true)
  offs.push(() => doc.removeEventListener('pointerdown', onSashDown, true))
  // A narrower window keeps the conversation its room.
  const onResize = () => { applySizes(); schedule() }
  win.addEventListener('resize', onResize)
  offs.push(() => win.removeEventListener('resize', onResize))
  const place = () => {
    frame = 0
    if (disposed) return
    markSashes()
    const cluster = doc.querySelector("[data-titlebar-cluster='right']")
    if (!cluster) return
    if (!group) build(cluster.querySelector('button:not([data-claude-pane-tool])'))
    if (group.parentElement !== cluster || cluster.firstElementChild !== group) cluster.prepend(group)
    for (const tool of tools) {
      if (!tool.element) continue
      setActive(tool.element, isOpen(tool))
    }
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  const onPointer = event => { if (menu && !menu.contains(event.target) && !more?.contains(event.target)) closeMenu() }
  const onKey = event => { if (event.key === 'Escape' && menu) { closeMenu(); more?.focus() } }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, statusbar, popper, editor, diffs, the session list's rows)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [data-tree-group='grp-sessions'] *, [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'data-pane-hidden'] })
  doc.addEventListener('pointerdown', onPointer, true)
  doc.addEventListener('keydown', onKey, true)
  place()
  return () => {
    disposed = true
    observer.disconnect()
    if (frame) win.cancelAnimationFrame(frame)
    for (const off of offs) try { off() } catch {}
    doc.removeEventListener('pointerdown', onPointer, true)
    doc.removeEventListener('keydown', onKey, true)
    closeMenu()
    group?.remove()
    group = more = null
  }
}

// Claude shows its permission mode ("Auto") beside dictation. Hermes' approval
// mode ("Smart") lives in the statusbar; its own trigger is pinned next to the
// composer's dictation control so the native dropdown opens there and every
// choice runs through Hermes. Released (native statusbar placement) whenever
// the theme is not Claude Skin or no composer is on screen.
const CLAUDE_APPROVAL_TRIGGER = "[data-slot='statusbar'] button[aria-haspopup='menu']:has(> svg[class*='tabler-icon-bolt'])"
const CLAUDE_COMPOSER_BOX = "[data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has([data-slot='composer-rich-input'])"
const CLAUDE_MODEL_PILL = "[data-slot='composer-root'] button[data-tour='model-pill']"
const CLAUDE_DICTATION_ANCHOR = "[data-slot='composer-root'] [data-slot='fan-menu-anchor']:has(button:is([aria-label='Voice dictation'], [aria-label='Stop dictation'], [aria-label='Transcribing dictation'], [aria-label='Dictée vocale']))"

function installClaudeApprovalDock({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  let frame = 0, disposed = false, docked = null
  const release = () => {
    if (!docked) return
    delete docked.dataset.claudeDocked
    docked.style.removeProperty('--claude-dock-left')
    docked.style.removeProperty('--claude-dock-top')
    docked = null
  }
  const place = () => {
    frame = 0
    if (disposed) return
    // Claude's permission mode ("Auto") opens the toolbar under the box: dock
    // at the box's left edge, on the model pill's line.
    const trigger = doc.querySelector(CLAUDE_APPROVAL_TRIGGER)
    const box = doc.querySelector(CLAUDE_COMPOSER_BOX)?.getBoundingClientRect()
    const pill = doc.querySelector(CLAUDE_MODEL_PILL)?.getBoundingClientRect()
    const rect = box && box.width > 0 ? { right: box.left + 2, top: pill && pill.height ? pill.top : box.bottom + 4, height: pill && pill.height ? pill.height : 24 } : null
    const active = doc.documentElement.dataset.claudeChatLook === 'true' && trigger && rect
    if (docked && docked !== trigger) release()
    if (!active) return release()
    docked = trigger
    if (!('claudeDocked' in trigger.dataset)) trigger.dataset.claudeDocked = ''
    const left = Math.round(rect.right) + 'px', top = Math.round(rect.top + rect.height / 2) + 'px'
    if (trigger.style.getPropertyValue('--claude-dock-left') !== left) trigger.style.setProperty('--claude-dock-left', left)
    if (trigger.style.getPropertyValue('--claude-dock-top') !== top) trigger.style.setProperty('--claude-dock-top', top)
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  // The dock only moves when one of its anchors resizes or is replaced. Any
  // other DOM change just checks the anchors are the same elements: measuring
  // on every change forced a layout of the whole page many times a second.
  let anchors = [], lastLook = null, checkFrame = 0
  const anchorsNow = () => [doc.querySelector(CLAUDE_APPROVAL_TRIGGER), doc.querySelector(CLAUDE_COMPOSER_BOX), doc.querySelector(CLAUDE_MODEL_PILL), doc.querySelector("[data-tree-group='grp-main']:not([data-pane-host])")]
  const resize = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => { if (!disposed) place() }) : null
  const check = () => {
    checkFrame = 0
    if (disposed) return
    const now = anchorsNow(), look = doc.documentElement.dataset.claudeChatLook === 'true'
    if (look === lastLook && now.length === anchors.length && now.every((node, i) => node === anchors[i])) return
    anchors = now
    lastLook = look
    resize?.disconnect()
    for (const node of now) if (node) resize?.observe(node)
    schedule()
  }
  const queueCheck = () => { if (!checkFrame && !disposed) checkFrame = win.requestAnimationFrame(check) }
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) queueCheck() })
  observer.observe(doc.body, { childList: true, subtree: true })
  const themeObserver = new win.MutationObserver(queueCheck)
  themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-hermes-theme', 'data-claude-chat-look'] })
  const onResize = () => schedule()
  win.addEventListener('resize', onResize)
  // A slow safety net (anchors only, no measuring) for a swap no observer saw.
  const timer = win.setInterval(queueCheck, 2000)
  check()
  return () => {
    disposed = true
    observer.disconnect()
    themeObserver.disconnect()
    resize?.disconnect()
    win.removeEventListener('resize', onResize)
    win.clearInterval(timer)
    if (frame) win.cancelAnimationFrame(frame)
    if (checkFrame) win.cancelAnimationFrame(checkFrame)
    release()
  }
}

// Hermes reports the backend's health ("Backend ready", amber while connecting
// or degraded, red when offline, a spinner while restarting) in the statusbar
// this theme folds away. Its own trigger sits beside the account row, at the
// session list's right edge, as an icon (green when ready, Hermes' amber and
// red otherwise, the label as its tooltip), so the native Gateway menu stays Hermes'.
const CLAUDE_BACKEND_TRIGGER = "[data-slot='statusbar'] button[aria-haspopup='menu']:is(:has(> svg[class*='tabler-icon-activity']), :has(> svg[class*='tabler-icon-alert-circle']), :has(> :first-child[aria-label^='restarting']))"

// Hermes' version items (client, backend) turn the accent colour when an
// update waits and spin while one applies; a click opens Hermes' update
// overlay. Only then Claude's update row shows above the account row.
const CLAUDE_VERSION_ITEMS = "[data-slot='statusbar'] button:is(:has(> svg[class*='tabler-icon-hash']), :has(> svg[class*='animate-spin']))"

function installClaudeBackendDock({ host: api = typeof host === 'undefined' ? null : host, document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  let frame = 0, disposed = false, docked = null, updateButton = null, pendingKey = ''
  const pendingUpdates = () => [...doc.querySelectorAll(CLAUDE_VERSION_ITEMS)].filter(node =>
    /^(client|backend)\b/i.test(node.textContent.trim()) && (node.classList.contains('text-primary') || node.querySelector("[class*='animate-spin']")))
  const updateIcon = () => {
    if (updateButton) return updateButton
    updateButton = doc.createElement('button')
    updateButton.type = 'button'
    updateButton.dataset.claudeUpdateDock = ''
    updateButton.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.75v7.5M4.75 7 8 10.25 11.25 7M3 13.25h10"/></svg><span></span>'
    updateButton.addEventListener('click', event => {
      event.preventDefault()
      pendingUpdates()[0]?.click()
    })
    doc.body.append(updateButton)
    return updateButton
  }
  const release = () => {
    if (!docked) return
    delete docked.dataset.claudeBackendDock
    docked.removeAttribute('title')
    docked.removeAttribute('aria-label')
    docked.style.removeProperty('--claude-dock-left')
    docked.style.removeProperty('--claude-dock-top')
    docked = null
  }
  const place = () => {
    frame = 0
    if (disposed) return
    const trigger = doc.querySelector(CLAUDE_BACKEND_TRIGGER)
    const rowNode = doc.querySelector('[data-claude-account-row]')
    const row = rowNode?.getBoundingClientRect()
    const active = doc.documentElement.dataset.claudeChatLook === 'true' && trigger && row && row.width > 0
    if (docked && docked !== trigger) release()
    if (!active) { if (updateButton) updateButton.hidden = true; doc.documentElement.removeAttribute('data-claude-update-shown'); return release() }
    docked = trigger
    if (!('claudeBackendDock' in trigger.dataset)) trigger.dataset.claudeBackendDock = ''
    const label = [...trigger.childNodes].map(node => node.textContent).join(' ').replace(/\s+/g, ' ').trim()
    if (label && trigger.title !== label) trigger.title = label
    if (label && trigger.getAttribute('aria-label') !== label) trigger.setAttribute('aria-label', label)
    // Beside the account row, at the session list's right edge.
    const list = doc.querySelector("[data-tree-group='grp-sessions']:not([data-pane-host])")?.getBoundingClientRect()
    const edge = list && list.width > 0 ? list.right - 12 : row.right + 34
    const left = Math.round(Math.max(row.right + 6, edge - 22)) + 'px', top = Math.round(row.top + row.height / 2) + 'px'
    if (trigger.style.getPropertyValue('--claude-dock-left') !== left) trigger.style.setProperty('--claude-dock-left', left)
    if (trigger.style.getPropertyValue('--claude-dock-top') !== top) trigger.style.setProperty('--claude-dock-top', top)
    // An update waiting: Claude's update row at the foot of the sidebar, above
    // the account row, the versions as the tooltip.
    const pending = pendingUpdates()
    pendingKey = pending.map(node => node.textContent.trim()).join(' · ')
    const shown = pending.length > 0
    if (doc.documentElement.hasAttribute('data-claude-update-shown') !== shown) doc.documentElement.toggleAttribute('data-claude-update-shown', shown)
    if (!shown) { if (updateButton && !updateButton.hidden) updateButton.hidden = true; return }
    const button = updateIcon()
    const tip = 'Update available: ' + pendingKey
    if (button.title !== tip) { button.title = tip; button.setAttribute('aria-label', tip) }
    const busy = pending.some(node => node.querySelector("[class*='animate-spin']"))
    if (button.hasAttribute('data-busy') !== busy) button.toggleAttribute('data-busy', busy)
    const text = busy ? 'Updating Hermes…' : 'Update available'
    if (button.lastChild.textContent !== text) button.lastChild.textContent = text
    // Above the line over the account row (the line sits 6px above the row).
    const updateLeft = Math.round(row.left) + 'px', updateTop = Math.round(row.top - 26) + 'px'
    const updateWidth = Math.round(Math.max(row.width, edge - row.left)) + 'px'
    if (button.style.left !== updateLeft) button.style.left = updateLeft
    if (button.style.top !== updateTop) button.style.top = updateTop
    if (button.style.width !== updateWidth) button.style.width = updateWidth
    if (button.hidden) button.hidden = false
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  // The icon alone says "not ready" without the why: Hermes' menu lists only
  // the connection and inference. While it is open, the trigger's own state
  // ("messaging stopped", "connecting", …) joins those lines, in its colour.
  let menuFrame = 0
  const stateLine = () => {
    menuFrame = 0
    if (disposed || !docked?.id) return
    const menu = doc.querySelector("[role='menu'][aria-labelledby='" + docked.id + "']")
    if (!menu) return
    const label = [...docked.childNodes].map(node => node.textContent).join(' ').replace(/\s+/g, ' ').trim().replace(/^Backend\s*/i, '')
    const column = [...menu.querySelectorAll('span')].find(node => /^Inference /.test(node.textContent.trim()))?.parentElement
    let line = menu.querySelector('[data-claude-backend-state]')
    platforms(menu)
    if (!label || /^ready$/i.test(label) || !column) { line?.remove(); menuFrame = win.requestAnimationFrame(stateLine); return }
    const text = label.charAt(0).toUpperCase() + label.slice(1)
    if (!line) {
      line = doc.createElement('span')
      line.setAttribute('data-claude-backend-state', '')
      line.append(doc.createElement('span'), doc.createTextNode(''))
      line.firstChild.setAttribute('aria-hidden', 'true')
    }
    if (line.parentElement !== column) column.append(line)
    if (line.lastChild.textContent !== text) line.lastChild.textContent = text
    const colour = win.getComputedStyle(docked).color
    if (line.style.color !== colour) line.style.color = colour
    menuFrame = win.requestAnimationFrame(stateLine)
  }
  // Hermes lists the messaging platforms only from its status snapshot, which
  // is empty while the messaging gateway is stopped and missing until its
  // first fetch: the list goes exactly when it explains the warning. Then the
  // same list, in Hermes' own markup, from the same status (host.status()); a
  // stopped gateway says so, with its exit reason.
  const asked = new WeakSet()
  const PLATFORM_TONE = { connected: 'bg-primary', fatal: 'bg-destructive', startup_failed: 'bg-destructive', error: 'bg-destructive', disabled: 'bg-muted-foreground', not_configured: 'bg-muted-foreground' }
  const pretty = text => { const t = String(text || '').replace(/_/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : '' }
  const isHermesSection = node => !node.hasAttribute('data-claude-platforms') && /^Messaging platforms$/i.test(node.firstElementChild?.textContent.trim() || '')
  const platforms = menu => {
    const ours = menu.querySelector('[data-claude-platforms]')
    if ([...menu.querySelectorAll('div')].some(isHermesSection)) { ours?.remove(); return }
    if (ours || asked.has(menu) || typeof api?.status !== 'function') return
    asked.add(menu)
    Promise.resolve(api.status()).then(status => {
      if (disposed || !menu.isConnected || [...menu.querySelectorAll('div')].some(isHermesSection) || menu.querySelector('[data-claude-platforms]')) return
      const entries = Object.entries(status?.gateway_platforms || {}).sort(([a], [b]) => a.localeCompare(b))
      const rows = entries.length
        ? entries.map(([key, platform]) => [key.split(':').pop(), pretty(platform?.state) || 'Unknown', PLATFORM_TONE[platform?.state] || 'bg-amber-500', platform?.error_message || ''])
        : [['Messaging gateway', pretty(status?.gateway_state) || (status?.gateway_running === false ? 'Stopped' : 'Unknown'), status?.gateway_running ? 'bg-primary' : 'bg-amber-500', status?.gateway_exit_reason || '']]
      const section = doc.createElement('div')
      section.setAttribute('data-claude-platforms', '')
      section.className = 'border-t border-border/50 px-3 py-2'
      const head = doc.createElement('div')
      head.className = 'text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80'
      head.textContent = 'Messaging platforms'
      const list = doc.createElement('ul')
      list.className = 'mt-1.5 space-y-1'
      for (const [name, state, tone, reason] of rows) {
        const item = doc.createElement('li')
        item.className = 'flex items-center justify-between gap-2 text-xs'
        const label = doc.createElement('span')
        label.className = 'truncate capitalize'
        label.textContent = name
        const value = doc.createElement('span')
        value.className = 'flex items-center gap-1.5 text-[0.66rem] text-muted-foreground'
        const dot = doc.createElement('span')
        dot.setAttribute('aria-hidden', 'true')
        dot.className = 'inline-block size-1.5 rounded-full ' + tone
        value.append(dot, doc.createTextNode(state))
        item.append(label, value)
        list.append(item)
        if (reason) {
          const why = doc.createElement('li')
          why.className = 'text-[0.66rem] text-muted-foreground'
          why.setAttribute('data-claude-platform-reason', '')
          why.textContent = reason
          list.append(why)
        }
      }
      section.append(head, list)
      ;(menu.firstElementChild || menu).append(section)
    }).catch(() => { asked.delete(menu) })
  }
  const onTrigger = event => { if (docked && event.target?.closest?.('[data-claude-backend-dock]') && !menuFrame) menuFrame = win.requestAnimationFrame(stateLine) }
  // The dock only moves when one of its anchors resizes or is replaced. Any
  // other DOM change just checks the anchors are the same elements: measuring
  // on every change forced a layout of the whole page many times a second.
  let anchors = [], lastLook = null, checkFrame = 0
  const anchorsNow = () => [doc.querySelector(CLAUDE_BACKEND_TRIGGER), doc.querySelector('[data-claude-account-row]'), doc.querySelector("[data-tree-group='grp-sessions']:not([data-pane-host])")]
  const resize = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => { if (!disposed) place() }) : null
  const check = () => {
    checkFrame = 0
    if (disposed) return
    watchBar()
    const now = anchorsNow(), look = doc.documentElement.dataset.claudeChatLook === 'true'
    // (A change of the waiting updates re-places too.)
    const key = pendingUpdates().map(node => node.textContent.trim()).join(' · ')
    // (Hermes relabels its trigger in place: the tooltip follows.)
    const relabelled = docked && docked === now[0] && [...docked.childNodes].map(node => node.textContent).join(' ').replace(/\s+/g, ' ').trim() !== docked.title
    if (!relabelled && key === pendingKey && look === lastLook && now.length === anchors.length && now.every((node, i) => node === anchors[i])) return
    anchors = now
    lastLook = look
    resize?.disconnect()
    for (const node of now) if (node) resize?.observe(node)
    schedule()
  }
  const queueCheck = () => { if (!checkFrame && !disposed) checkFrame = win.requestAnimationFrame(check) }
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) queueCheck() })
  observer.observe(doc.body, { childList: true, subtree: true })
  const themeObserver = new win.MutationObserver(queueCheck)
  themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-claude-chat-look'] })
  // Hermes marks a waiting update by a class on its version item (no DOM
  // insertion): watch the statusbar's classes so the row shows at once.
  const versionObserver = new win.MutationObserver(queueCheck)
  let watchedBar = null
  const watchBar = () => {
    const bar = doc.querySelector("[data-slot='statusbar']")
    if (bar === watchedBar) return
    versionObserver.disconnect()
    watchedBar = bar
    // (and its labels: Hermes relabels the backend trigger in place)
    if (bar) versionObserver.observe(bar, { attributes: true, attributeFilter: ['class'], characterData: true, subtree: true })
  }
  const onResize = () => schedule()
  win.addEventListener('resize', onResize)
  for (const type of ['pointerdown', 'keydown']) doc.addEventListener(type, onTrigger, true)
  const timer = win.setInterval(queueCheck, 2000)
  check()
  return () => {
    disposed = true
    observer.disconnect()
    themeObserver.disconnect()
    versionObserver.disconnect()
    for (const type of ['pointerdown', 'keydown']) doc.removeEventListener(type, onTrigger, true)
    if (menuFrame) win.cancelAnimationFrame(menuFrame)
    doc.querySelectorAll('[data-claude-backend-state], [data-claude-platforms]').forEach(node => node.remove())
    resize?.disconnect()
    win.removeEventListener('resize', onResize)
    win.clearInterval(timer)
    if (frame) win.cancelAnimationFrame(frame)
    if (checkFrame) win.cancelAnimationFrame(checkFrame)
    release()
    updateButton?.remove()
    doc.documentElement.removeAttribute('data-claude-update-shown')
  }
}

// Claude's empty-session backdrop, as an "ASCII shader": a faint grid of
// random monospace glyphs lit by a slow, domain-warped noise field (water
// light), over a real 2D water-ripple simulation (the discrete wave equation
// on two height buffers). A click is a pebble: its ripples spread, interfere,
// bounce off the edges and die away; now and then a small drop falls alone. Drawn on a
// canvas behind an empty conversation only, paused while hidden, static under
// prefers-reduced-motion. Purely decorative (aria-hidden, no pointer events).
const CLAUDE_ASCII_GLYPHS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CLAUDE_ASCII_CELL = { w: 8, h: 16, font: 11 }

// Smooth 3D value noise (0..1) on an integer lattice; cheap and seamless.
function claudeAsciiHash(i, j, k) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function claudeAsciiNoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const fx = x - xi, fy = y - yi, fz = z - zi
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const h = claudeAsciiHash
  const a0 = h(xi, yi, zi), b0 = h(xi + 1, yi, zi), c0 = h(xi, yi + 1, zi), d0 = h(xi + 1, yi + 1, zi)
  const a1 = h(xi, yi, zi + 1), b1 = h(xi + 1, yi, zi + 1), c1 = h(xi, yi + 1, zi + 1), d1 = h(xi + 1, yi + 1, zi + 1)
  const p0 = (a0 + (b0 - a0) * u) + ((c0 + (d0 - c0) * u) - (a0 + (b0 - a0) * u)) * v
  const p1 = (a1 + (b1 - a1) * u) + ((c1 + (d1 - c1) * u) - (a1 + (b1 - a1) * u)) * v
  return p0 + (p1 - p0) * w
}

// Water-like brightness (0..1). Two nested warp fields bend a finer field
// that also drifts along a slowly turning current, so patches flow, stretch,
// fold and break up like light through moving water.
function claudeAsciiWave(x, y, t) {
  const n = claudeAsciiNoise
  const heading = t * 0.05
  const ax = x * 0.0028 + Math.cos(heading) * t * 0.06, ay = y * 0.0028 + Math.sin(heading) * t * 0.06
  const qx = n(ax, ay, t * 0.08) - 0.5, qy = n(ax + 31.7, ay - 12.3, t * 0.08) - 0.5
  const bx = x * 0.0055 + qx * 3.2, by = y * 0.0055 + qy * 3.2
  const rx = n(bx + 7.1, by + 2.9, t * 0.12) - 0.5, ry = n(bx - 4.4, by + 9.6, t * 0.12) - 0.5
  const px = x * 0.0095 + rx * 2.4 + t * 0.035, py = y * 0.0095 + ry * 2.4 - t * 0.02
  return 0.6 * n(px, py, t * 0.22) + 0.4 * n(px * 2.3 + 5.2, py * 2.3 - 7.4, t * 0.38)
}

function installClaudeAsciiBackdrop({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  if (!doc?.body || !win) return () => {}
  let canvas = null, ctx = null, host = null, cols = 0, rows = 0, glyphs = null, prior = null, field = null, frame = 0, last = 0, disposed = false
  // Water height, now and one step ago (wave equation, leapfrog).
  let water = null, waterPrev = null, active_ = false, nextDrop = 0, stepped = 0
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)')
  const pick = () => CLAUDE_ASCII_GLYPHS.charCodeAt(Math.floor(Math.random() * CLAUDE_ASCII_GLYPHS.length))
  const zone = () => doc.querySelector("[data-tree-group='grp-main']:has([data-slot='thread'])")
  const isEmpty = group => group && !group.querySelector("[data-slot*='message']")
  const active = () => doc.documentElement.dataset.claudeChatLook === 'true' && doc.visibilityState !== 'hidden'
  const detach = () => {
    if (frame) win.cancelAnimationFrame(frame)
    frame = 0
    canvas?.remove()
    host?.removeAttribute('data-claude-ascii-host')
    canvas = ctx = host = null
  }
  const resize = () => {
    if (!canvas || !host) return
    const rect = host.getBoundingClientRect()
    const ratio = win.devicePixelRatio || 1
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height))
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const nextCols = Math.ceil(w / CLAUDE_ASCII_CELL.w), nextRows = Math.ceil(h / CLAUDE_ASCII_CELL.h)
    if (nextCols !== cols || nextRows !== rows) {
      cols = nextCols; rows = nextRows
      glyphs = new Uint8Array(cols * rows)
      for (let i = 0; i < glyphs.length; i++) glyphs[i] = pick()
      prior = new Float32Array(cols * rows)
      water = new Float32Array(cols * rows)
      waterPrev = new Float32Array(cols * rows)
    }
  }
  const drop = (px, py, strength) => {
    if (!water) return
    const c0 = Math.round(px / CLAUDE_ASCII_CELL.w), r0 = Math.round(py / CLAUDE_ASCII_CELL.h)
    for (let r = r0 - 2; r <= r0 + 2; r++) for (let c = c0 - 4; c <= c0 + 4; c++) {
      if (r < 1 || c < 1 || r >= rows - 1 || c >= cols - 1) continue
      const d = Math.hypot((c - c0) * CLAUDE_ASCII_CELL.w, (r - r0) * CLAUDE_ASCII_CELL.h) / 32
      if (d < 1) water[r * cols + c] -= strength * (1 - d * d)
    }
    active_ = true
  }
  // Discrete wave equation. Cells are 8x16 px, so vertical coupling is scaled
  // by (8/16)^2 to keep rings round; damping lets them fade.
  const stepWater = () => {
    const cx = 0.3, cy = 0.3 * (CLAUDE_ASCII_CELL.w / CLAUDE_ASCII_CELL.h) ** 2, damp = 0.965
    let energy = 0
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const i = r * cols + c, hNow = water[i]
        const next = (2 * hNow - waterPrev[i] + cx * (water[i - 1] + water[i + 1] - 2 * hNow) + cy * (water[i - cols] + water[i + cols] - 2 * hNow)) * damp
        waterPrev[i] = next
        energy += next < 0 ? -next : next
      }
    }
    const swap = water; water = waterPrev; waterPrev = swap
    if (energy < 0.02 * cols) active_ = false
  }
  const draw = now => {
    frame = 0
    if (disposed || !canvas) return
    const still = Boolean(reduced?.matches)
    // Drawn at 20 fps, a third less work than 30; the water still steps 30
    // times a second (by the clock), so ripples spread and fade as before.
    if (!still && now - last < 50) { frame = win.requestAnimationFrame(draw); return }
    last = now
    resize()
    const dark = doc.documentElement.dataset.hermesMode !== 'light'
    const ink = dark ? '200,198,190' : '40,40,38'
    const blue = dark ? '102,167,231' : '31,95,173'
    const t = now / 1000
    const w = cols * CLAUDE_ASCII_CELL.w, h = rows * CLAUDE_ASCII_CELL.h
    ctx.clearRect(0, 0, w, h)
    ctx.font = CLAUDE_ASCII_CELL.font + 'px ui-monospace, SFMono-Regular, Consolas, monospace'
    ctx.textBaseline = 'top'
    if (!still) {
      if (now > nextDrop) {
        if (nextDrop) drop(Math.random() * w, Math.random() * h, 0.7)
        nextDrop = now + 4000 + Math.random() * 5000
      }
      if (active_) {
        const steps = stepped ? Math.min(3, Math.round((now - stepped) / 33.3)) : 1
        for (let k = 0; k < steps && active_; k++) stepWater()
        stepped += steps * 33.3
        if (!stepped || now - stepped > 100) stepped = now
      } else stepped = 0
    }
    // The field is smooth, so it is sampled every second cell and blended.
    const gc = Math.ceil(cols / 2) + 1, gr = Math.ceil(rows / 2) + 1
    if (!field || field.length !== gc * gr * 3) field = new Float32Array(gc * gr * 3)
    const ft = still ? 0 : t * 0.15
    for (let r = 0; r < gr; r++) for (let c = 0; c < gc; c++) {
      const fx = c * 2 * CLAUDE_ASCII_CELL.w, fy = r * 2 * CLAUDE_ASCII_CELL.h, k = (r * gc + c) * 3
      field[k] = claudeAsciiWave(fx, fy, ft)
      field[k + 1] = still ? 0 : (claudeAsciiNoise(fx * 0.01, fy * 0.01, t * 0.1) - 0.5) * 1.8
      field[k + 2] = still ? 0 : (claudeAsciiNoise(fx * 0.01 + 50, fy * 0.01, t * 0.1) - 0.5) * 1.8
    }
    const sample = (col, row, o) => {
      const c = col / 2, r = row / 2, c0 = Math.floor(c), r0 = Math.floor(r), u = c - c0, v = r - r0
      const k00 = (r0 * gc + c0) * 3 + o, k10 = k00 + 3, k01 = k00 + gc * 3, k11 = k01 + 3
      return (field[k00] * (1 - u) + field[k10] * u) * (1 - v) + (field[k01] * (1 - u) + field[k11] * u) * v
    }
    for (let row = 0; row < rows; row++) {
      const y = row * CLAUDE_ASCII_CELL.h
      for (let col = 0; col < cols; col++) {
        const x = col * CLAUDE_ASCII_CELL.w, i = row * cols + col
        const wave = sample(col, row, 0)
        let alpha = (0.025 + 0.2 * Math.max(0, (wave - 0.5) / 0.5) ** 1.5) * (0.65 + 0.35 * ((i * 2654435761 >>> 0) % 1000) / 1000)
        // Ripples: light follows the water's height and slope; the slope
        // refracts (nudges) the glyph like a lens.
        let ring = 0, dx = 0, dy = 0
        if (row > 0 && col > 0 && row < rows - 1 && col < cols - 1) {
          const height = water[i]
          const gx = water[i + 1] - water[i - 1], gy = water[i + cols] - water[i - cols]
          ring = Math.max(0, Math.min(1, Math.abs(height) * 0.8 + (Math.abs(gx) + Math.abs(gy)) * 0.3) - 0.06)
          dx = gx * 2.2; dy = gy * 2.2
        }
        // Glyphs shimmer where the water moves fastest; the surface sways.
        const flow = Math.abs(wave - prior[i])
        prior[i] = wave
        if (!still && Math.random() < 0.0006 + flow * 2 + ring * 0.06) glyphs[i] = pick()
        dx += sample(col, row, 1)
        dy += sample(col, row, 2)
        if (alpha < 0.035 && ring < 0.02) continue
        ctx.fillStyle = ring > 0.22 ? 'rgba(' + blue + ',' + Math.min(0.9, alpha + 0.85 * ring).toFixed(3) + ')' : 'rgba(' + ink + ',' + Math.min(0.6, alpha + 0.6 * ring).toFixed(3) + ')'
        ctx.fillText(String.fromCharCode(glyphs[i]), x + dx, y + dy)
      }
    }
    if (!still || active_) frame = win.requestAnimationFrame(draw)
  }
  const place = () => {
    if (disposed) return
    const group = zone()
    if (!active() || !isEmpty(group)) return detach()
    if (host !== group) {
      detach()
      host = group
      host.setAttribute('data-claude-ascii-host', '')
      canvas = doc.createElement('canvas')
      canvas.dataset.claudeAsciiBackdrop = ''
      canvas.setAttribute('aria-hidden', 'true')
      ctx = canvas.getContext('2d')
      host.prepend(canvas)
    } else if (canvas.parentElement !== host) host.prepend(canvas)
    if (!frame) frame = win.requestAnimationFrame(draw)
  }
  const onPointer = event => {
    if (!canvas || !host?.contains(event.target)) return
    if (event.target.closest?.("button, a, input, textarea, [contenteditable='true'], [role='menu'], [data-slot='composer-root']")) return
    const rect = host.getBoundingClientRect()
    drop(event.clientX - rect.left, event.clientY - rect.top, 3)
    if (!frame) frame = win.requestAnimationFrame(draw)
  }
  let pending = 0
  const schedule = () => { if (!pending && !disposed) pending = win.setTimeout(() => { pending = 0; place() }, 120) }
  // Batches only inside regions Hermes redraws all the time (xterm, statusbar, popper, editor, diffs)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true })
  const themeObserver = new win.MutationObserver(schedule)
  themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-hermes-theme', 'data-hermes-mode'] })
  doc.addEventListener('visibilitychange', schedule)
  doc.addEventListener('pointerdown', onPointer, true)
  win.addEventListener('resize', schedule)
  place()
  return () => {
    disposed = true
    observer.disconnect()
    themeObserver.disconnect()
    if (pending) win.clearTimeout(pending)
    doc.removeEventListener('visibilitychange', schedule)
    doc.removeEventListener('pointerdown', onPointer, true)
    win.removeEventListener('resize', schedule)
    detach()
  }
}

// Claude's search dialog: tabs (All, Artifacts, Sessions, Projects, Scheduled),
// Recents and Actions, rows with a time on the right, a "…" row menu and a
// key-hint footer. Built from what Hermes hands plugins: persisted sessions
// (listPersistedSessions), openSession, sessions.pin and app actions. Hermes
// exposes no artifact or schedule list to plugins, so those tabs open Hermes'
// own Artifacts / Cron pages. Code sessions are Hermes sessions, so Code is
// folded into Sessions. No delete: plugins get no delete verb, by design.
const CLAUDE_SEARCH_TABS = [
  { id: 'all', label: 'All' },
  { id: 'artifacts', label: 'Artifacts', page: 'nav.artifacts', note: 'Artifacts live on Hermes’ Artifacts page.', button: 'Open Artifacts' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'projects', label: 'Projects' },
  { id: 'scheduled', label: 'Scheduled', page: 'nav.cron', note: 'Scheduled jobs live on Hermes’ Scheduled jobs page.', button: 'Open Scheduled jobs' }
]

function claudeAgeLabel(epoch, now = Date.now()) {
  const ms = !epoch ? 0 : epoch > 1e12 ? epoch : epoch * 1000
  if (!ms) return ''
  const hours = (now - ms) / 36e5
  if (hours < 1) return 'Past hour'
  if (hours < 24) return 'Today'
  if (hours < 48) return 'Yesterday'
  if (hours < 24 * 7) return 'Past week'
  if (hours < 24 * 31) return 'Past month'
  return 'Older'
}

function installClaudeSearchDialog({ host: api = host, runAction, document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  const noop = { open() {}, dispose() {} }
  if (!doc?.body || !win) return noop
  let root = null, input = null, list = null, tabsEl = null, rowMenu = null
  let tab = 'all', query = '', selected = 0, items = [], sessions = null, loading = false
  const run = id => {
    if (typeof runAction !== 'function') return
    const result = runAction(id)
    if (result && result.ok === false) console.warn('[claude-chat-look] ' + id + ' refused', result.error)
  }
  const glyph = name => {
    const i = doc.createElement('i')
    i.className = 'codicon codicon-' + name
    i.setAttribute('aria-hidden', 'true')
    return i
  }
  const kbd = text => { const k = doc.createElement('kbd'); k.textContent = text; return k }
  const load = async () => {
    if (loading) return
    loading = true
    try {
      const profile = String(api?.state?.profile?.get?.() || 'default')
      const page = await api?.listPersistedSessions?.(null, { profile, limit: 200 })
      // Scheduled runs (source 'cron') are Hermes' Scheduled jobs, not chats.
      sessions = (page?.sessions || []).filter(row => row && !row.archived && !row.hidden && !row.is_internal_child && row.source !== 'cron')
      sessions.sort((a, b) => (b.last_active || b.started_at || 0) - (a.last_active || a.started_at || 0))
    } catch (error) {
      console.warn('[claude-chat-look] session list unavailable', error)
      sessions = []
    } finally {
      loading = false
      if (root) render()
    }
  }
  const projectOf = row => row.git_repo_root || row.cwd || ''
  const baseName = path => String(path).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path
  const sessionItem = row => ({
    kind: 'session',
    icon: projectOf(row) ? 'code' : 'comment',
    title: row.title || row.preview || 'Untitled',
    meta: claudeAgeLabel(row.last_active || row.started_at),
    kindLabel: projectOf(row) ? 'Code session' : 'Session',
    row,
    run: () => { close(); Promise.resolve(api?.openSession?.(row.id)).catch(error => console.warn('[claude-chat-look] openSession failed', error)) }
  })
  const projects = () => {
    const byKey = new Map()
    for (const row of sessions || []) {
      const key = projectOf(row)
      if (!key) continue
      const entry = byKey.get(key) || { key, rows: [] }
      entry.rows.push(row)
      byKey.set(key, entry)
    }
    return [...byKey.values()].map(entry => ({
      kind: 'project',
      icon: 'folder-library',
      title: baseName(entry.key),
      meta: entry.rows.length + (entry.rows.length === 1 ? ' session' : ' sessions') + ' · ' + claudeAgeLabel(entry.rows[0].last_active || entry.rows[0].started_at),
      kindLabel: 'Project',
      run: () => sessionItem(entry.rows[0]).run()
    }))
  }
  const actions = () => [{ kind: 'action', icon: 'add', title: 'New session', meta: '', kindLabel: 'Action', run: () => { close(); run('session.new') } }]
  const matches = item => !query || item.title.toLowerCase().includes(query.toLowerCase())
  const sections = () => {
    const current = CLAUDE_SEARCH_TABS.find(entry => entry.id === tab)
    if (current?.page) return []
    if (sessions === null) return [{ heading: '', items: [], loading: true }]
    if (tab === 'sessions') return [{ heading: '', items: sessions.map(sessionItem).filter(matches) }]
    if (tab === 'projects') return [{ heading: '', items: projects().filter(matches) }]
    if (!query) return [{ heading: 'Recents', items: sessions.slice(0, 8).map(sessionItem) }, { heading: 'Actions', items: actions() }]
    return [
      { heading: 'Sessions', items: sessions.map(sessionItem).filter(matches).slice(0, 20) },
      { heading: 'Projects', items: projects().filter(matches).slice(0, 8) },
      { heading: 'Actions', items: actions().filter(matches) }
    ].filter(section => section.items.length)
  }
  const closeRowMenu = () => { rowMenu?.remove(); rowMenu = null }
  const openRowMenu = (item, anchor) => {
    closeRowMenu()
    rowMenu = doc.createElement('div')
    rowMenu.setAttribute('role', 'menu')
    rowMenu.dataset.claudeSearchRowMenu = ''
    const head = doc.createElement('div')
    head.dataset.claudeSearchRowMenuHead = ''
    const title = doc.createElement('strong')
    title.textContent = item.title
    const sub = doc.createElement('span')
    sub.textContent = [item.kindLabel, item.meta].filter(Boolean).join(' · ')
    head.append(title, sub)
    rowMenu.append(head)
    const entries = [['Open', item.run]]
    if (item.kind === 'session') {
      const pinned = Boolean(item.row.pinned)
      entries.push([pinned ? 'Unpin' : 'Pin', () => {
        try { api?.sessions?.pin?.(item.row.id, !pinned) } catch (error) { console.warn('[claude-chat-look] pin failed', error) }
        item.row.pinned = !pinned
        closeRowMenu()
        render()
      }])
    }
    entries.forEach(([label, act], index) => {
      const button = doc.createElement('button')
      button.type = 'button'
      button.setAttribute('role', 'menuitem')
      button.dataset.claudeSearchRowMenuItem = String(index + 1)
      const text = doc.createElement('span')
      text.textContent = label
      button.append(text, kbd(String(index + 1)))
      button.addEventListener('click', () => act())
      rowMenu.append(button)
    })
    root.append(rowMenu)
    const rect = anchor.getBoundingClientRect()
    rowMenu.style.left = Math.round(rect.right + 8) + 'px'
    rowMenu.style.top = Math.round(rect.top - 6) + 'px'
  }
  const renderTabs = () => {
    tabsEl.replaceChildren()
    for (const entry of CLAUDE_SEARCH_TABS) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.setAttribute('role', 'tab')
      button.setAttribute('aria-selected', String(entry.id === tab))
      button.textContent = entry.label
      button.addEventListener('click', () => setTab(entry.id))
      tabsEl.append(button)
    }
  }
  const render = () => {
    if (!root) return
    renderTabs()
    closeRowMenu()
    list.replaceChildren()
    const current = CLAUDE_SEARCH_TABS.find(entry => entry.id === tab)
    items = []
    if (current?.page) {
      const empty = doc.createElement('div')
      empty.dataset.claudeSearchEmpty = ''
      const note = doc.createElement('p')
      note.textContent = current.note
      const go = doc.createElement('button')
      go.type = 'button'
      go.textContent = current.button
      go.addEventListener('click', () => { close(); run(current.page) })
      empty.append(note, go)
      list.append(empty)
      return
    }
    for (const section of sections()) {
      if (section.loading) {
        const wait = doc.createElement('div')
        wait.dataset.claudeSearchEmpty = ''
        wait.textContent = 'Loading…'
        list.append(wait)
        continue
      }
      if (section.heading) {
        const heading = doc.createElement('div')
        heading.dataset.claudeSearchHeading = ''
        heading.textContent = section.heading
        list.append(heading)
      }
      for (const item of section.items) {
        const index = items.push(item) - 1
        const row = doc.createElement('div')
        row.setAttribute('role', 'option')
        row.dataset.claudeSearchRow = ''
        row.setAttribute('aria-selected', String(index === selected))
        const title = doc.createElement('span')
        title.dataset.claudeSearchTitle = ''
        title.textContent = item.title
        const meta = doc.createElement('span')
        meta.dataset.claudeSearchMeta = ''
        meta.textContent = item.meta
        const more = doc.createElement('button')
        more.type = 'button'
        more.setAttribute('aria-label', 'Actions')
        more.dataset.claudeSearchMore = ''
        more.append(glyph('ellipsis'))
        more.addEventListener('click', event => { event.stopPropagation(); selected = index; openRowMenu(item, more) })
        const enter = doc.createElement('span')
        enter.dataset.claudeSearchEnter = ''
        enter.textContent = '↵'
        row.append(glyph(item.icon), title, meta, more, enter)
        row.addEventListener('mousemove', () => { if (selected !== index) { selected = index; paintSelection() } })
        row.addEventListener('click', () => item.run())
        list.append(row)
      }
    }
    if (!items.length && sessions !== null) {
      const empty = doc.createElement('div')
      empty.dataset.claudeSearchEmpty = ''
      const note = doc.createElement('p')
      note.textContent = 'No results in ' + current.label
      empty.append(note)
      if (tab !== 'all') {
        const all = doc.createElement('button')
        all.type = 'button'
        all.textContent = 'Search all'
        all.addEventListener('click', () => setTab('all'))
        empty.append(all)
      }
      list.append(empty)
    }
  }
  const paintSelection = () => {
    list.querySelectorAll('[data-claude-search-row]').forEach((row, index) => row.setAttribute('aria-selected', String(index === selected)))
    list.querySelector("[data-claude-search-row][aria-selected='true']")?.scrollIntoView({ block: 'nearest' })
  }
  const setTab = id => { tab = id; selected = 0; render(); input?.focus() }
  const onKey = event => {
    if (!root) return
    if (rowMenu && /^[1-9]$/.test(event.key)) {
      rowMenu.querySelector('[data-claude-search-row-menu-item="' + event.key + '"]')?.click()
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return rowMenu ? closeRowMenu() : close() }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!items.length) return
      selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      closeRowMenu()
      paintSelection()
      return
    }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !query) {
      event.preventDefault()
      const at = CLAUDE_SEARCH_TABS.findIndex(entry => entry.id === tab)
      setTab(CLAUDE_SEARCH_TABS[(at + (event.key === 'ArrowRight' ? 1 : -1) + CLAUDE_SEARCH_TABS.length) % CLAUDE_SEARCH_TABS.length].id)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const item = items[selected]
      if (!item) return
      if (event.altKey) {
        const anchor = list.querySelectorAll('[data-claude-search-more]')[selected]
        if (anchor) openRowMenu(item, anchor)
      } else item.run()
    }
  }
  const close = () => {
    closeRowMenu()
    root?.remove()
    root = input = list = tabsEl = null
    doc.removeEventListener('keydown', onKey, true)
  }
  const open = () => {
    if (root) return input?.focus()
    tab = 'all'; query = ''; selected = 0
    root = doc.createElement('div')
    root.dataset.claudeSearchDialog = ''
    root.addEventListener('pointerdown', event => {
      if (rowMenu && !rowMenu.contains(event.target) && !event.target.closest?.('[data-claude-search-more]')) closeRowMenu()
      if (event.target === root) close()
    })
    const panel = doc.createElement('div')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'Search')
    panel.dataset.claudeSearchPanel = ''
    const head = doc.createElement('div')
    head.dataset.claudeSearchHead = ''
    input = doc.createElement('input')
    input.type = 'text'
    input.placeholder = 'Search'
    input.setAttribute('aria-label', 'Search')
    input.addEventListener('input', () => { query = input.value.trim(); selected = 0; render() })
    const x = doc.createElement('button')
    x.type = 'button'
    x.setAttribute('aria-label', 'Close')
    x.dataset.claudeSearchClose = ''
    x.append(glyph('close'))
    x.addEventListener('click', close)
    head.append(input, x)
    tabsEl = doc.createElement('div')
    tabsEl.setAttribute('role', 'tablist')
    tabsEl.dataset.claudeSearchTabs = ''
    list = doc.createElement('div')
    list.setAttribute('role', 'listbox')
    list.dataset.claudeSearchList = ''
    const foot = doc.createElement('div')
    foot.dataset.claudeSearchFoot = ''
    for (const [label, ...keys] of [['Close', 'Esc'], ['Change type', '←', '→'], ['Actions', 'Alt', '↵']]) {
      const hint = doc.createElement('span')
      hint.append(label, ...keys.map(kbd))
      foot.append(hint)
    }
    panel.append(head, tabsEl, list, foot)
    root.append(panel)
    doc.body.append(root)
    doc.addEventListener('keydown', onKey, true)
    render()
    input.focus()
    load()
  }
  return { open, close, dispose: close }
}

// Claude keeps a short navigation list with "More" for the rest and an
// "Edit sidebar…" dialog to choose what stays visible. Hermes' own nav rows
// stay mounted and run their own handlers: hidden rows only get an attribute
// (CSS hides them under Claude Skin), "More" lists them and clicks the native
// button. The choice is a per-viewer convenience kept in localStorage.
const CLAUDE_NAV_STORAGE_KEY = 'claude-chat-look.sidebar.visible'
const CLAUDE_NAV_ALWAYS = 'sidebar-nav-new-session'
const CLAUDE_NAV_DEFAULT_VISIBLE = 3

function installClaudeSidebarMore({ document: doc = globalThis.document, window: win = globalThis.window, runAction, openSearch } = {}) {
  if (!doc?.body || !win) return () => {}
  let frame = 0, disposed = false, moreItem = null, menu = null, editor = null
  const readVisible = () => {
    try {
      const raw = win.localStorage?.getItem(CLAUDE_NAV_STORAGE_KEY)
      const list = raw ? JSON.parse(raw) : null
      return Array.isArray(list) ? new Set(list.filter(id => typeof id === 'string')) : null
    } catch { return null }
  }
  let visible = readVisible()
  const writeVisible = () => {
    try { win.localStorage?.setItem(CLAUDE_NAV_STORAGE_KEY, JSON.stringify([...visible])) } catch { /* Private window: session only. */ }
  }
  const navList = () => doc.querySelector("[data-tour='sessions-sidebar'] ul[data-sidebar='menu']:has([data-tour^='sidebar-nav-'])")
  const entries = list => [...list.children].map(li => {
    const label = li.querySelector("[data-tour^='sidebar-nav-']")
    if (!label) return null
    const button = li.querySelector("[data-sidebar='menu-button']")
    const glyph = button?.querySelector('.codicon')
    const icon = [...(glyph?.classList || [])].find(name => name.startsWith('codicon-')) || ''
    return { id: label.getAttribute('data-tour'), label: label.textContent.trim(), icon, li, button }
  }).filter(Boolean)
  const isShown = (entry, index) => entry.id === CLAUDE_NAV_ALWAYS || (visible ? visible.has(entry.id) : index <= CLAUDE_NAV_DEFAULT_VISIBLE)
  const glyphOf = icon => {
    const glyph = doc.createElement('i')
    glyph.className = 'codicon ' + (icon || 'codicon-circle-small')
    glyph.setAttribute('aria-hidden', 'true')
    return glyph
  }
  const closeMenu = () => { menu?.remove(); menu = null; moreItem?.querySelector('button')?.setAttribute('aria-expanded', 'false') }
  const closeEditor = () => { editor?.remove(); editor = null }
  const openEditor = () => {
    closeMenu()
    closeEditor()
    const list = navList()
    if (!list) return
    const all = entries(list)
    if (!visible) visible = new Set(all.filter(isShown).map(entry => entry.id))
    editor = doc.createElement('div')
    editor.dataset.claudeSidebarEditor = ''
    const panel = doc.createElement('div')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-label', 'Edit sidebar')
    panel.dataset.claudeSidebarEditorPanel = ''
    const head = doc.createElement('div')
    head.dataset.claudeSidebarEditorHead = ''
    const title = doc.createElement('h2')
    title.textContent = 'Edit sidebar'
    const close = doc.createElement('button')
    close.type = 'button'
    close.setAttribute('aria-label', 'Close')
    close.dataset.claudeSidebarEditorClose = ''
    close.append(glyphOf('codicon-close'))
    close.addEventListener('click', closeEditor)
    head.append(title, close)
    const note = doc.createElement('p')
    note.textContent = 'Choose which items appear in your sidebar.'
    const rows = doc.createElement('div')
    rows.dataset.claudeSidebarEditorRows = ''
    for (const entry of all) {
      if (entry.id === CLAUDE_NAV_ALWAYS) continue
      const row = doc.createElement('label')
      row.dataset.claudeSidebarEditorRow = ''
      const box = doc.createElement('input')
      box.type = 'checkbox'
      box.checked = visible.has(entry.id)
      box.addEventListener('change', () => {
        if (box.checked) visible.add(entry.id)
        else visible.delete(entry.id)
        writeVisible()
        schedule()
      })
      const text = doc.createElement('span')
      text.textContent = entry.label
      row.append(box, glyphOf(entry.icon), text)
      rows.append(row)
    }
    const foot = doc.createElement('div')
    foot.dataset.claudeSidebarEditorFoot = ''
    const done = doc.createElement('button')
    done.type = 'button'
    done.textContent = 'Done'
    done.dataset.claudeSidebarEditorDone = ''
    done.addEventListener('click', closeEditor)
    foot.append(done)
    panel.append(head, note, rows, foot)
    editor.append(panel)
    editor.addEventListener('pointerdown', event => { if (event.target === editor) closeEditor() })
    doc.body.append(editor)
    done.focus()
  }
  const openMenu = () => {
    if (menu) return closeMenu()
    const list = navList()
    if (!list || !moreItem) return
    const all = entries(list)
    menu = doc.createElement('div')
    menu.setAttribute('role', 'menu')
    menu.dataset.claudeAccountMenu = ''
    menu.dataset.claudeMoreMenu = ''
    const add = (label, icon, run) => {
      const item = doc.createElement('button')
      item.type = 'button'
      item.setAttribute('role', 'menuitem')
      item.dataset.claudeAccountItem = ''
      const text = doc.createElement('span')
      text.dataset.claudeAccountLabel = ''
      text.textContent = label
      if (icon) item.append(glyphOf(icon))
      item.append(text)
      item.addEventListener('click', () => { closeMenu(); run() })
      menu.append(item)
    }
    const hidden = all.filter((entry, index) => !isShown(entry, index))
    for (const entry of hidden) add(entry.label, entry.icon, () => entry.button?.click())
    if (hidden.length) {
      const separator = doc.createElement('div')
      separator.setAttribute('role', 'separator')
      separator.dataset.claudeAccountSeparator = ''
      menu.append(separator)
    }
    add('Edit sidebar…', '', openEditor)
    doc.body.append(menu)
    const rect = moreItem.getBoundingClientRect()
    menu.style.left = Math.round(rect.right + 6) + 'px'
    menu.style.top = Math.round(rect.top) + 'px'
    moreItem.querySelector('button')?.setAttribute('aria-expanded', 'true')
    menu.querySelector('button')?.focus()
  }
  const buildMore = template => {
    const li = doc.createElement('li')
    li.className = template?.className || ''
    li.dataset.claudeNavMore = ''
    const button = doc.createElement('button')
    button.type = 'button'
    button.className = template?.querySelector("[data-sidebar='menu-button']")?.className || ''
    button.dataset.claudeNavMoreButton = ''
    button.setAttribute('aria-haspopup', 'menu')
    button.setAttribute('aria-expanded', 'false')
    const text = doc.createElement('span')
    text.className = 'min-w-0 truncate'
    text.textContent = 'More'
    button.append(glyphOf('codicon-chevron-right'), text)
    button.addEventListener('click', openMenu)
    li.append(button)
    return li
  }
  const isClaude = () => doc.documentElement.dataset.claudeChatLook === 'true'
  const setPlaceholder = (input, text) => {
    if (!input) return
    if (isClaude() && input.placeholder !== text) {
      if (!('claudeNativePlaceholder' in input.dataset)) input.dataset.claudeNativePlaceholder = input.placeholder
      input.placeholder = text
    } else if (!isClaude() && 'claudeNativePlaceholder' in input.dataset) {
      input.placeholder = input.dataset.claudeNativePlaceholder
      delete input.dataset.claudeNativePlaceholder
    }
  }
  // Claude's palette footer, limited to keys Hermes' palette really answers.
  const placePaletteFoot = () => {
    const dialog = doc.querySelector("[role='dialog']:has(> [cmdk-root])")
    if (!dialog) return
    setPlaceholder(dialog.querySelector('[cmdk-input]'), 'Search')
    if (dialog.querySelector('[data-claude-palette-foot]')) return
    const foot = doc.createElement('div')
    foot.dataset.claudePaletteFoot = ''
    foot.setAttribute('aria-hidden', 'true')
    for (const [label, ...keys] of [['Close', 'Esc'], ['Navigate', '↑', '↓'], ['Open', '↵']]) {
      const hint = doc.createElement('span')
      hint.append(label)
      for (const key of keys) {
        const kbd = doc.createElement('kbd')
        kbd.textContent = key
        hint.append(kbd)
      }
      foot.append(hint)
    }
    dialog.append(foot)
  }
  const placeSearch = () => {
    setPlaceholder(doc.querySelector("[data-tour='sessions-sidebar'] input[aria-label='Search sessions']"), 'Search')
    placePaletteFoot()
  }
  // Claude's search field opens its search dialog (installClaudeSearchDialog);
  // without one, Hermes' command palette stands in.
  const onSearchPointer = event => {
    if (!isClaude()) return
    if (!event.target?.closest?.("[data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions'])")) return
    event.preventDefault()
    event.stopPropagation()
    if (typeof openSearch === 'function') return openSearch()
    if (typeof runAction !== 'function') return
    const result = runAction('nav.commandPalette')
    if (result && result.ok === false) console.warn('[claude-chat-look] nav.commandPalette refused', result.error)
  }
  const place = () => {
    frame = 0
    if (disposed) return
    placeSearch()
    const list = navList()
    if (!list) return
    const all = entries(list)
    all.forEach((entry, index) => {
      const hide = !isShown(entry, index)
      if (hide !== entry.li.hasAttribute('data-claude-nav-hidden')) entry.li.toggleAttribute('data-claude-nav-hidden', hide)
    })
    if (!moreItem) moreItem = buildMore(all[0]?.li)
    if (moreItem.parentElement !== list || list.lastElementChild !== moreItem) list.append(moreItem)
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  const onPointer = event => { if (menu && !menu.contains(event.target) && !moreItem?.contains(event.target)) closeMenu() }
  const onKey = event => {
    if (event.key !== 'Escape') return
    if (editor) closeEditor()
    else if (menu) closeMenu()
  }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, statusbar, popper, editor, diffs)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true })
  const themeObserver = new win.MutationObserver(schedule)
  themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-hermes-theme'] })
  doc.addEventListener('pointerdown', onPointer, true)
  doc.addEventListener('pointerdown', onSearchPointer, true)
  doc.addEventListener('keydown', onKey, true)
  place()
  return () => {
    disposed = true
    observer.disconnect()
    themeObserver.disconnect()
    doc.removeEventListener('pointerdown', onSearchPointer, true)
    for (const foot of doc.querySelectorAll('[data-claude-palette-foot]')) foot.remove()
    if (frame) win.cancelAnimationFrame(frame)
    doc.removeEventListener('pointerdown', onPointer, true)
    doc.removeEventListener('keydown', onKey, true)
    closeMenu()
    closeEditor()
    for (const input of doc.querySelectorAll('input[data-claude-native-placeholder]')) {
      input.placeholder = input.dataset.claudeNativePlaceholder
      delete input.dataset.claudeNativePlaceholder
    }
    moreItem?.remove()
    moreItem = null
    for (const li of doc.querySelectorAll('[data-claude-nav-hidden]')) li.removeAttribute('data-claude-nav-hidden')
  }
}

// Claude's session title ends in a chevron that opens the session's actions.
// Hermes already has them on the tab's context menu, so the chevron opens
// that menu under itself, without the tab-only entries (reload, close…).
const CLAUDE_TITLE_TAB = "[data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true'])"
const CLAUDE_TITLE_TAB_ONLY = new Set(['Reload', 'Close', 'Close others', 'Close to the right', 'Close all', 'Hide tab bar'])

function installClaudeTitleMenu({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  if (!doc?.body || !win) return () => {}
  let frame = 0, disposed = false, chevron = null, pending = 0
  const tidy = menu => {
    menu.dataset.claudeTitleMenu = ''
    const kids = [...menu.children]
    for (const item of kids) {
      if (item.getAttribute('role') === 'separator') continue
      const hide = CLAUDE_TITLE_TAB_ONLY.has(item.textContent.trim())
      if (hide !== item.hasAttribute('data-claude-title-menu-hidden')) item.toggleAttribute('data-claude-title-menu-hidden', hide)
    }
    // A separator survives only between two visible groups.
    let seen = false
    kids.forEach((item, index) => {
      if (item.getAttribute('role') !== 'separator') { if (!item.hasAttribute('data-claude-title-menu-hidden')) seen = true; return }
      const next = kids.slice(index + 1).find(k => !k.hasAttribute('data-claude-title-menu-hidden'))
      item.toggleAttribute('data-claude-title-menu-hidden', !seen || !next || next.getAttribute('role') === 'separator')
    })
  }
  const findMenu = tries => {
    pending = 0
    const menu = [...doc.querySelectorAll("[role='menu']")].pop()
    if (menu) { tidy(menu); chevron?.setAttribute('aria-expanded', 'true'); return }
    if (tries > 0) pending = win.requestAnimationFrame(() => findMenu(tries - 1))
  }
  const open = event => {
    event.preventDefault()
    event.stopPropagation()
    const tab = chevron?.closest("[role='tab']")
    if (!tab) return
    const rect = chevron.getBoundingClientRect()
    tab.dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(rect.left), clientY: Math.round(rect.bottom + 4) }))
    if (pending) win.cancelAnimationFrame(pending)
    findMenu(10)
  }
  // The tab drags and selects on pointerdown; the chevron keeps its own.
  const swallow = event => event.stopPropagation()
  const build = () => {
    const button = doc.createElement('button')
    button.type = 'button'
    button.dataset.claudeTitleChevron = ''
    button.setAttribute('aria-label', 'Session actions')
    button.setAttribute('aria-haspopup', 'menu')
    button.setAttribute('aria-expanded', 'false')
    const glyph = doc.createElement('i')
    glyph.className = 'codicon codicon-chevron-down'
    glyph.setAttribute('aria-hidden', 'true')
    button.append(glyph)
    button.addEventListener('pointerdown', swallow)
    button.addEventListener('mousedown', swallow)
    button.addEventListener('click', open)
    return button
  }
  const place = () => {
    frame = 0
    if (disposed) return
    if (chevron?.getAttribute('aria-expanded') === 'true' && !doc.querySelector('[data-claude-title-menu]')) chevron.setAttribute('aria-expanded', 'false')
    const content = doc.querySelector(CLAUDE_TITLE_TAB + ' > .pane-tab-content')
    if (!content) { chevron?.remove(); return }
    if (!chevron) chevron = build()
    if (content.lastElementChild !== chevron) content.append(chevron)
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, statusbar, editor, diffs)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'data-active'] })
  place()
  return () => {
    disposed = true
    observer.disconnect()
    if (frame) win.cancelAnimationFrame(frame)
    if (pending) win.cancelAnimationFrame(pending)
    chevron?.remove()
    chevron = null
  }
}

// Claude's model control is one pill ("Opus 5.5 Medium") that opens one menu:
// the favourite models numbered 1-9 with a check on the current one, then
// "Effort  Medium ›". Hermes keeps model and effort as two dropdowns, so the
// pill routes both halves to the model menu, which is restyled in place, and
// the added Effort row opens Hermes' own effort menu.
const CLAUDE_MODEL_TRIGGER = "[data-slot='composer-root'] button[data-tour='model-pill']"
const CLAUDE_EFFORT_TRIGGER = "[data-slot='composer-root'] button[data-testid='reasoning-pill']"
const CLAUDE_EFFORT_WORDS = { Min: 'Minimal', Med: 'Medium', XHigh: 'Extra High', 'X-High': 'Extra High', 'Extra': 'Extra High' }

function claudeEffortWord(label) {
  const short = String(label || '').replace(/^Effort:\s*/, '').trim()
  return CLAUDE_EFFORT_WORDS[short] || short
}

// A submenu beside a menu: to its right when it fits in the window, else to
// its left, else as far in as the window allows (any screen size or scale).
function claudeBesideLeft(menuBox, width, viewport) {
  if (menuBox.right + 4 + width <= viewport - 8) return menuBox.right + 4
  if (menuBox.left - 4 - width >= 8) return menuBox.left - 4 - width
  return Math.max(8, viewport - 8 - width)
}

function installClaudeModelPill({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  if (!doc?.body || !win) return () => {}
  let frame = 0, disposed = false, passEffort = false
  const isClaude = () => doc.documentElement.dataset.claudeChatLook === 'true'
  const press = el => {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) el.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }))
  }
  const closeMenus = () => doc.activeElement?.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  const openEffort = () => {
    const effort = doc.querySelector(CLAUDE_EFFORT_TRIGGER)
    if (!effort) return
    closeMenus()
    win.requestAnimationFrame(() => { passEffort = true; press(effort); passEffort = false })
  }
  // The current model's row carries Hermes' effort submenu; opening it keeps
  // the model menu up. Without such a row, Hermes' effort dropdown stands in.
  const showEffort = (menu, row) => {
    closeMore(menu)
    const current = [...menu.querySelectorAll("[data-slot='dropdown-menu-sub-trigger']")].find(item => item.querySelector('.codicon-check'))
    if (!current) return openEffort()
    const box = current.getBoundingClientRect()
    if (current.getAttribute('aria-expanded') !== 'true') current.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: box.left + 20, clientY: box.top + 5 }))
    menu.dataset.claudeEffortOpen = ''
    let tries = 20
    const level = () => {
      const sub = current.getAttribute('aria-controls') && doc.getElementById(current.getAttribute('aria-controls'))
      const wrapper = sub?.parentElement
      if (!sub || !wrapper) { if (tries-- > 0) win.requestAnimationFrame(level); return }
      // Beside the model menu (Radix anchors it to the current model's row,
      // which is hidden when that model is not a favourite), bottom edge level
      // with the row's, as Claude hangs it; never off the top.
      const base = wrapper.getBoundingClientRect(), menuBox = menu.getBoundingClientRect()
      const dx = Math.round(claudeBesideLeft(menuBox, sub.offsetWidth, win.innerWidth) - base.left)
      const dy = Math.round(Math.max(8 - base.top, row.getBoundingClientRect().bottom + 5 - (base.top + sub.offsetHeight)))
      sub.style.translate = dx + 'px ' + dy + 'px'
      // Radix places the popper over a few frames; follow it until it settles.
      if (tries-- > 0) win.requestAnimationFrame(level)
    }
    win.requestAnimationFrame(level)
  }
  // Claude ends the menu flush with the pill's right edge (after "Medium").
  const align = (menu, model, effort) => {
    const wrapper = menu.parentElement
    const end = (effort?.hasAttribute('data-claude-model-paired') ? effort : model)?.getBoundingClientRect().right
    if (!wrapper || end == null) return
    const base = wrapper.getBoundingClientRect()
    const dx = Math.round(Math.max(8 - base.left, Math.min(end - base.right, win.innerWidth - 8 - base.right)))
    const want = dx ? dx + 'px 0' : ''
    if (menu.style.translate !== want) menu.style.translate = want
  }
  const models = menu => [...menu.querySelectorAll("[role='group'] > [data-slot='dropdown-menu-sub-trigger']")].filter(item => item.getBoundingClientRect().height > 0)
  const proxy = (label, real, extra) => {
    const item = doc.createElement('div')
    item.setAttribute('role', 'menuitem')
    item.tabIndex = -1
    item.dataset.claudeMoreItem = ''
    const text = doc.createElement('span')
    text.textContent = label
    item.append(text)
    if (extra) item.append(extra)
    item.addEventListener('click', event => { event.stopPropagation(); real.click() })
    item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); real.click() } })
    return item
  }
  const moreSource = menu => {
    const groups = [...menu.querySelectorAll("[role='group']")].filter(group => !group.querySelector(":scope > [data-slot='dropdown-menu-label']"))
    const foot = [...menu.children].filter(kid => kid.getAttribute('role') === 'menuitem' && !kid.matches('[data-claude-effort-row], [data-claude-more-row]'))
    return { groups, foot }
  }
  const moreSignature = menu => {
    const { groups, foot } = moreSource(menu)
    return groups.map(group => [...group.children].map(kid => kid.textContent.trim() + (kid.querySelector('.codicon-check') ? '*' : '') + (kid.querySelector('.rotate-90') ? 'v' : '') + (kid.querySelector(":scope > button[aria-pressed='true']") ? 'f' : '')).join(',')).join('|') + '#' + foot.map(kid => kid.textContent.trim()).join(',')
  }
  // Fade only while more rows wait below; at the end the last row reads clearly.
  const fadeMore = list => {
    const more = list.scrollHeight - list.clientHeight - list.scrollTop > 1
    if (more !== list.hasAttribute('data-more-below')) list.toggleAttribute('data-more-below', more)
  }
  const buildMore = menu => {
    const panel = menu.querySelector('[data-claude-more-panel]')
    if (!panel) return
    const sig = moreSignature(menu)
    if (panel.dataset.sig === sig) return
    panel.dataset.sig = sig
    // The model list scrolls; the actions below its rule stay put.
    const scroll = panel.querySelector('[data-claude-more-list]')?.scrollTop || 0
    const list = doc.createElement('div')
    list.dataset.claudeMoreList = ''
    list.addEventListener('scroll', () => fadeMore(list), { passive: true })
    const tail = doc.createElement('div')
    tail.dataset.claudeMoreFoot = ''
    panel.replaceChildren(list, tail)
    const { groups, foot } = moreSource(menu)
    for (const group of groups) {
      const rows = [...group.children]
      const header = rows[0]?.matches("[data-slot='dropdown-menu-sub-trigger']") ? null : rows.shift()
      if (header) {
        const label = doc.createElement('div')
        label.dataset.claudeMoreLabel = ''
        const name = doc.createElement('span')
        name.textContent = header.querySelector('.truncate')?.textContent.trim() || header.textContent.trim()
        const collapsed = !header.querySelector('.rotate-90')
        const glyph = doc.createElement('i')
        glyph.className = 'codicon codicon-chevron-' + (collapsed ? 'right' : 'down')
        glyph.setAttribute('aria-hidden', 'true')
        label.append(name, glyph)
        label.toggleAttribute('data-collapsed', collapsed)
        label.addEventListener('click', event => { event.stopPropagation(); header.click() })
        list.append(label)
      }
      for (const row of rows) {
        if (!row.matches("[data-slot='dropdown-menu-sub-trigger']")) continue
        const name = (row.querySelector(':scope > span.flex .truncate') || row.querySelector(':scope > span.flex') || row).textContent.trim()
        const check = row.querySelector('.codicon-check') ? Object.assign(doc.createElement('i'), { className: 'codicon codicon-check' }) : null
        const item = proxy(name, row, check)
        const real = row.querySelector(":scope > button[aria-pressed], :scope > button[aria-label*='avorite']")
        if (real) {
          const star = doc.createElement('button')
          star.type = 'button'
          star.dataset.claudeStar = ''
          const on = real.getAttribute('aria-pressed') === 'true'
          star.setAttribute('aria-pressed', String(on))
          star.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites')
          star.title = star.getAttribute('aria-label')
          const glyph = doc.createElement('i')
          glyph.className = 'codicon codicon-' + (on ? 'star-full' : 'star-empty')
          glyph.setAttribute('aria-hidden', 'true')
          star.append(glyph)
          star.addEventListener('pointerdown', event => event.stopPropagation())
          star.addEventListener('click', event => { event.stopPropagation(); event.preventDefault(); real.click() })
          item.prepend(star)
        }
        list.append(item)
      }
    }
    if (foot.length) {
      const rule = doc.createElement('div')
      rule.setAttribute('role', 'separator')
      rule.dataset.claudeMoreRule = ''
      rule.className = menu.querySelector('[data-claude-effort-rule]')?.className || ''
      tail.append(rule)
      for (const item of foot) tail.append(proxy(item.textContent.trim(), item))
    }
    list.scrollTop = scroll
    fadeMore(list)
  }
  const openMore = (menu, row) => {
    // Focusing the row closes an open Radix submenu (Effort) beside the menu.
    row.focus()
    menu.removeAttribute('data-claude-effort-open')
    menu.dataset.claudeMoreOpen = ''
    buildMore(menu)
    positionMore(menu)
  }
  // Bottom edge level with the More row's; the panel never reaches past the
  // window's top (it scrolls instead). Re-run whenever its content changes,
  // since Hermes may fill the model list after the menu opens.
  const positionMore = menu => {
    const panel = menu.querySelector('[data-claude-more-panel]'), row = menu.querySelector('[data-claude-more-row]')
    if (!panel || !row) return
    const rowBox = row.getBoundingClientRect(), menuBox = menu.getBoundingClientRect()
    const maxHeight = Math.round(Math.max(120, Math.min(440, rowBox.bottom + 5 - 8))) + 'px'
    if (panel.style.maxHeight !== maxHeight) panel.style.maxHeight = maxHeight
    const top = Math.round(Math.max(8 - menuBox.top, rowBox.bottom + 5 - menuBox.top - panel.offsetHeight)) + 'px'
    if (panel.style.top !== top) panel.style.top = top
    const left = Math.round(claudeBesideLeft(menuBox, panel.offsetWidth, win.innerWidth) - menuBox.left) + 'px'
    if (panel.style.left !== left) panel.style.left = left
    const list = panel.querySelector('[data-claude-more-list]')
    if (list) fadeMore(list)
  }
  const closeMore = menu => { menu?.removeAttribute('data-claude-more-open') }
  const moreRow = menu => {
    const row = doc.createElement('div')
    row.setAttribute('role', 'menuitem')
    row.setAttribute('aria-haspopup', 'menu')
    row.tabIndex = -1
    row.dataset.claudeMoreRow = ''
    const name = doc.createElement('span')
    name.textContent = 'More models'
    const glyph = doc.createElement('i')
    glyph.className = 'codicon codicon-chevron-right'
    glyph.setAttribute('aria-hidden', 'true')
    row.append(name, glyph)
    let hover = 0
    row.addEventListener('pointerenter', () => { hover = win.setTimeout(() => openMore(menu, row), 120) })
    row.addEventListener('pointerleave', () => win.clearTimeout(hover))
    row.addEventListener('click', () => openMore(menu, row))
    row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); openMore(menu, row) } })
    const panel = doc.createElement('div')
    panel.setAttribute('role', 'menu')
    panel.setAttribute('aria-label', 'More models')
    panel.dataset.claudeMorePanel = ''
    // Hovering any other row of the menu closes the panel.
    menu.addEventListener('pointerover', event => {
      const item = event.target?.closest?.("[role^='menuitem']")
      if (item && !row.contains(item) && !panel.contains(item)) closeMore(menu)
    })
    return [row, panel]
  }
  const effortRow = menu => {
    const row = doc.createElement('div')
    row.setAttribute('role', 'menuitem')
    row.tabIndex = -1
    row.dataset.claudeEffortRow = ''
    const name = doc.createElement('span')
    name.textContent = 'Effort'
    const value = doc.createElement('span')
    value.dataset.claudeEffortValue = ''
    value.textContent = claudeEffortWord(doc.querySelector(CLAUDE_EFFORT_TRIGGER)?.getAttribute('aria-label'))
    const glyph = doc.createElement('i')
    glyph.className = 'codicon codicon-chevron-right'
    glyph.setAttribute('aria-hidden', 'true')
    row.append(name, value, glyph)
    let hover = 0
    row.addEventListener('pointerenter', () => { hover = win.setTimeout(() => showEffort(menu, row), 120) })
    row.addEventListener('pointerleave', () => win.clearTimeout(hover))
    row.addEventListener('click', () => showEffort(menu, row))
    row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); showEffort(menu, row) } })
    const rule = doc.createElement('div')
    rule.setAttribute('role', 'separator')
    rule.dataset.claudeEffortRule = ''
    const foot = [...menu.children].find(kid => kid.getAttribute('role') === 'separator' && kid.previousElementSibling?.matches('div:has([role=\'group\'])'))
    if (foot) rule.className = foot.className
    menu.insertBefore(rule, foot || null)
    menu.insertBefore(row, foot || null)
    const rule2 = rule.cloneNode()
    delete rule2.dataset.claudeEffortRule
    rule2.dataset.claudeMoreRuleTop = ''
    const [more, panel] = moreRow(menu)
    menu.insertBefore(rule2, foot || null)
    menu.insertBefore(more, foot || null)
    menu.append(panel)
  }
  const place = () => {
    frame = 0
    if (disposed) return
    const model = doc.querySelector(CLAUDE_MODEL_TRIGGER), effort = doc.querySelector(CLAUDE_EFFORT_TRIGGER)
    if (effort) {
      const word = claudeEffortWord(effort.getAttribute('aria-label'))
      if (effort.dataset.claudeEffort !== word) effort.dataset.claudeEffort = word
      const paired = model?.nextElementSibling === effort
      if (paired !== effort.hasAttribute('data-claude-model-paired')) effort.toggleAttribute('data-claude-model-paired', paired)
    }
    for (const menu of doc.querySelectorAll("[role='menu'][data-state='open']")) {
      const by = menu.getAttribute('aria-labelledby')
      if (model && by === model.id && !menu.hasAttribute('data-claude-model-menu')) {
        menu.dataset.claudeModelMenu = ''
        // (numbered below, on every pass)
        effortRow(menu)
      }
      // Smart's menu (approval mode) opens rightward from the control's left
      // edge, over the composer, as Claude's permission menu does.
      const docked = doc.querySelector('[data-claude-docked]')
      if (docked && by && by === docked.id && menu.parentElement) {
        const base = menu.parentElement.getBoundingClientRect()
        const dx = Math.round(Math.max(8 - base.left, Math.min(docked.getBoundingClientRect().left - base.left, win.innerWidth - 8 - base.right)))
        const want = dx ? dx + 'px 0' : ''
        if (menu.style.translate !== want) menu.style.translate = want
      }
      if (menu.hasAttribute('data-claude-model-menu')) {
        models(menu).forEach((item, index) => { const key = index < 9 ? String(index + 1) : null; if (item.dataset.claudeModelKey !== (key ?? undefined)) { if (key) item.dataset.claudeModelKey = key; else delete item.dataset.claudeModelKey } })
        for (const stale of menu.querySelectorAll('[data-claude-model-key]')) if (!stale.getBoundingClientRect().height) delete stale.dataset.claudeModelKey
        align(menu, model, effort)
        if (menu.hasAttribute('data-claude-more-open')) { buildMore(menu); positionMore(menu) }
        if (menu.hasAttribute('data-claude-effort-open') && !menu.querySelector("[data-slot='dropdown-menu-sub-trigger'][aria-expanded='true']")) menu.removeAttribute('data-claude-effort-open')
      } else if (!menu.hasAttribute('data-claude-model-menu') && !menu.hasAttribute('data-claude-effort-menu')) {
        const trigger = by && doc.getElementById(by)
        if ((effort && by === effort.id) || trigger?.closest('[data-claude-model-menu]')) menu.dataset.claudeEffortMenu = ''
      }
    }
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  // Either half of the pill opens the model menu, as Claude's single pill does.
  const onPointer = event => {
    if (passEffort || !isClaude()) return
    const effort = event.target?.closest?.(CLAUDE_EFFORT_TRIGGER)
    if (!effort) return
    event.preventDefault()
    event.stopPropagation()
    if (event.type === 'pointerdown') {
      const model = doc.querySelector(CLAUDE_MODEL_TRIGGER)
      if (model) press(model)
    }
  }
  // Hermes hangs its effort submenu on the current model's row and opens it
  // when the pointer rests there; in Claude only the Effort row opens it. A
  // real pointer over a model row reaches Hermes no further (the row still
  // lights by CSS :hover); the Effort row's own nudge is synthetic and passes.
  const onMove = event => {
    if (!event.isTrusted || !isClaude()) return
    if (event.target?.closest?.("[data-claude-model-menu] [data-slot='dropdown-menu-sub-trigger']")) event.stopPropagation()
  }
  // 1-9 picks a model while the model menu is open.
  const onKey = event => {
    const menu = doc.querySelector('[data-claude-model-menu]')
    if (!menu || !/^[1-9]$/.test(event.key) || event.target?.closest?.('input')) return
    const item = menu.querySelector("[data-claude-model-key='" + event.key + "']")
    if (!item) return
    event.preventDefault()
    event.stopPropagation()
    item.click()
  }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, statusbar, editor, diffs)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'data-state'] })
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) doc.addEventListener(type, onPointer, true)
  doc.addEventListener('keydown', onKey, true)
  doc.addEventListener('pointermove', onMove, true)
  place()
  return () => {
    disposed = true
    observer.disconnect()
    if (frame) win.cancelAnimationFrame(frame)
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) doc.removeEventListener(type, onPointer, true)
    doc.removeEventListener('keydown', onKey, true)
    doc.removeEventListener('pointermove', onMove, true)
    for (const el of doc.querySelectorAll('[data-claude-effort-row], [data-claude-effort-rule], [data-claude-more-row], [data-claude-more-rule-top], [data-claude-more-panel]')) el.remove()
    for (const el of doc.querySelectorAll('[data-claude-effort]')) { delete el.dataset.claudeEffort; el.removeAttribute('data-claude-model-paired') }
  }
}

// Hermes' Technical tool display prints the raw call ("Arguments: {json}
// Result: {json}"). Claude shows the same call readably: a label (Bash,
// Python), the command or code as written, then its output. The raw payload
// stays in the DOM (copy still works); this view is drawn beside it.
function claudeJsonString(text, key) {
  // The value of a top-level "key": "…" (two-space indented, as Hermes prints
  // it), even when the JSON around it is cut short. Nested keys are ignored.
  const lead = text.startsWith('{"' + key + '": "') ? 1 : text.indexOf('\n  "' + key + '": "')
  if (lead < 0) return null
  const at = lead + (text[lead] === '\n' ? 3 : 0)
  let i = at + key.length + 5, out = ''
  while (i < text.length) {
    const c = text[i]
    if (c === '"') return out
    if (c === '\\') {
      const n = text[i + 1]
      if (n === 'u') { out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16) || 63); i += 6; continue }
      out += { n: '\n', t: '\t', r: '', b: '\b', f: '\f' }[n] ?? n
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

function claudeToolPayload(text) {
  if (!text?.startsWith('Arguments:')) return null
  const cut = text.indexOf('\n\nResult:\n')
  const args = cut < 0 ? text.slice(11) : text.slice(11, cut)
  const result = cut < 0 ? '' : text.slice(cut + 10)
  const command = claudeJsonString(args, 'command'), code = claudeJsonString(args, 'code')
  const view = command != null ? { label: 'Bash', prompt: true, body: command }
    : code != null ? { label: 'Python', prompt: false, body: code }
    : { label: 'Input', prompt: false, body: args.trim() }
  let output = claudeJsonString(result, 'output') ?? claudeJsonString(result, 'stdout') ?? claudeJsonString(result, 'content')
  const error = claudeJsonString(result, 'error')
  if (output == null && result.trim().startsWith('"')) output = claudeJsonString('{"v": ' + result.trim(), 'v')
  if (output == null) output = result.trim()
  const exit = /"exit_code":\s*(-?\d+)/.exec(result)?.[1]
  // Blank lines around the code (common in generated snippets) are not shown.
  view.body = view.body.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '')
  return { ...view, output: [output, error].filter(Boolean).join('\n').replace(/\s+$/, ''), exit: exit && exit !== '0' ? Number(exit) : null }
}

const CLAUDE_PY_KEYWORDS = new Set(['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'])

// Split code into [kind, text] runs: str, num, kw (Python keywords), cmd (a
// shell command word), flag, com (comments) and plain text.
function claudeHighlight(text, shell) {
  const runs = []
  const push = (kind, part) => { if (!part) return; const last = runs[runs.length - 1]; if (last && last[0] === kind) last[1] += part; else runs.push([kind, part]) }
  const re = shell
    ? /("(?:[^"\\]|\\.)*"?|'[^']*'?)|(#[^\n]*)|(\s+)|(&&|\|\||[|;&<>()]+)|([^\s"'|;&<>()]+)/g
    : /("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[rbfu]{0,2}"(?:[^"\\\n]|\\.)*"?|[rbfu]{0,2}'(?:[^'\\\n]|\\.)*'?)|(#[^\n]*)|(\s+)|(\b\d[\d_.]*\b)|([A-Za-z_]\w*)|([^\sA-Za-z_\d"'#]+)/g
  let expectCommand = true, m
  while ((m = re.exec(text))) {
    if (shell) {
      const [, str, com, space, op, word] = m
      if (str) { push('str', str); expectCommand = false }
      else if (com) push('com', com)
      else if (space) { push('', space); if (space.includes('\n')) expectCommand = true }
      else if (op) { push('op', op); expectCommand = !/^[<>]+$/.test(op) }
      else if (word) {
        if (expectCommand && !/=/.test(word)) { push('cmd', word); expectCommand = false }
        else push(word.startsWith('-') ? 'flag' : '', word)
      }
    } else {
      const [, str, com, space, num, word, other] = m
      if (str) push('str', str)
      else if (com) push('com', com)
      else if (space) push('', space)
      else if (num) push('num', num)
      else if (word) push(CLAUDE_PY_KEYWORDS.has(word) ? 'kw' : (text[re.lastIndex] === '(' ? 'fn' : ''), word)
      else push('op', other)
    }
  }
  return runs
}

function installClaudeToolPayload({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  if (!doc?.body || !win) return () => {}
  let frame = 0, disposed = false
  const isClaude = () => doc.documentElement.dataset.claudeChatLook === 'true'
  const render = (pre, data) => {
    const view = doc.createElement('div')
    view.dataset.claudePayload = ''
    const label = doc.createElement('div')
    label.dataset.claudePayloadLabel = ''
    label.textContent = data.label
    const code = doc.createElement('pre')
    code.dataset.claudePayloadCode = ''
    if (data.prompt) {
      const mark = doc.createElement('span')
      mark.dataset.claudePayloadPrompt = ''
      mark.textContent = '$ '
      code.append(mark)
    }
    for (const [kind, part] of claudeHighlight(data.body, data.prompt)) {
      if (!kind) { code.append(part); continue }
      const run = doc.createElement('span')
      run.dataset.t = kind
      run.textContent = part
      code.append(run)
    }
    view.append(label, code)
    if (data.output) {
      const out = doc.createElement('pre')
      out.dataset.claudePayloadOut = ''
      out.textContent = data.output
      view.append(out)
    }
    if (data.exit != null) {
      const exit = doc.createElement('div')
      exit.dataset.claudePayloadExit = ''
      exit.textContent = 'Exit code ' + data.exit
      view.append(exit)
    }
    return view
  }
  const place = () => {
    frame = 0
    if (disposed) return
    const claude = isClaude()
    // A closed row folds its payload again; reopening unfolds it once more.
    for (const row of doc.querySelectorAll('[data-claude-payload-opened]:not([data-tool-open])')) row.removeAttribute('data-claude-payload-opened')
    for (const row of doc.querySelectorAll('[data-tool-row][data-tool-open]')) {
      if (!claude) continue
      // Technical mode folds the payload; Claude shows the call at once.
      const toggle = [...row.querySelectorAll('button[aria-expanded]')].find(b => b !== row.querySelector('button[aria-expanded]') && b.nextElementSibling?.tagName !== 'PRE' && /payload/i.test(b.textContent))
      if (toggle && toggle.getAttribute('aria-expanded') === 'false' && !row.hasAttribute('data-claude-payload-opened')) {
        row.setAttribute('data-claude-payload-opened', '')
        toggle.click()
      }
    }
    for (const pre of doc.querySelectorAll('[data-tool-row][data-tool-open] pre:not([data-claude-payload-code], [data-claude-payload-out])')) {
      const host = pre.parentElement
      const text = pre.textContent
      const existing = host.querySelector(':scope > [data-claude-payload]')
      if (!claude || !text.startsWith('Arguments:')) { existing?.remove(); host.removeAttribute('data-claude-payload-host'); continue }
      if (existing && existing.dataset.len === String(text.length)) continue
      const data = claudeToolPayload(text)
      if (!data) continue
      const view = render(pre, data)
      view.dataset.len = String(text.length)
      if (existing) existing.replaceWith(view)
      else pre.after(view)
      host.setAttribute('data-claude-payload-host', '')
    }
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  // Batches only inside regions Hermes redraws all the time (xterm, statusbar, popper, editor, diffs)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true })
  const themeObserver = new win.MutationObserver(schedule)
  themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-hermes-theme'] })
  place()
  return () => {
    disposed = true
    observer.disconnect()
    themeObserver.disconnect()
    if (frame) win.cancelAnimationFrame(frame)
    for (const el of doc.querySelectorAll('[data-claude-payload]')) el.remove()
    for (const el of doc.querySelectorAll('[data-claude-payload-host]')) el.removeAttribute('data-claude-payload-host')
  }
}

// Claude shows context use as a small ring after the model pill. Hermes has
// the same figure as a statusbar item ("~116.8k/1M [█░░] ~12%", Context usage,
// toggled by the user); the ring mirrors it and opens that item's own panel.
const CLAUDE_CONTEXT_ITEM = "[data-slot='statusbar'] button[data-slot='dropdown-menu-trigger']"

function claudeContextPercent(text) {
  if (!/\/\s*[\d.]+\s*[kKmMbB]/.test(text || '')) return null
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(text)
  return m ? Math.max(0, Math.min(100, Number(m[1]))) : null
}

// Hermes' own usage figures for the focused session (independent of the
// statusbar): { context_used, context_max, context_percent, … } or null.
function claudeFocusedUsage(api) {
  try {
    const usage = api?.state?.focusedUsage?.get?.()
    return usage && typeof usage.context_percent === 'number' ? usage : null
  } catch { return null }
}

function claudeTokens(n) {
  return n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n)
}

// Generation speed and prompt-cache use, as Hermes' backend reports them for
// the session: avg_tps over the last ten model calls, and the share of prompt
// tokens read from cache (cache_hit_pct; absent until a call reads cache).
// The cached token count is estimated from that share of all prompt tokens.
function claudeUsageExtras(api) {
  let usage = null
  try { usage = api?.state?.focusedUsage?.get?.() || null } catch { usage = null }
  if (!usage) return []
  const rows = []
  if (usage.avg_tps > 0) rows.push(['Speed', Math.round(usage.avg_tps) + ' t/s' + (usage.avg_latency_s > 0 ? ' · ' + usage.avg_latency_s.toFixed(1) + ' s per call' : '')])
  if (typeof usage.cache_hit_pct === 'number') {
    const read = usage.prompt > 0 ? Math.round(usage.cache_hit_pct / 100 * usage.prompt) : 0
    rows.push(['Cache', Math.round(usage.cache_hit_pct) + '% hit' + (read ? ' · ~' + claudeTokens(read) + ' cached' : '')])
  }
  return rows
}

function claudeUsageRows(doc, rows) {
  return rows.map(([name, value]) => {
    const row = doc.createElement('div')
    row.dataset.claudeUsageRow = ''
    const a = doc.createElement('span'), b = doc.createElement('span')
    a.textContent = name
    b.textContent = value
    row.append(a, b)
    return row
  })
}

// Claude's composer tooltips for the voice buttons in the box: a dark card
// above the button, a bold title and a quiet line under it. Hermes' own
// bubble for these triggers is hidden while ours shows.
const CLAUDE_VOICE_TIPS = {
  'Voice dictation': ['Voice dictation', 'Click to dictate into your message'],
  'Stop dictation': ['Stop dictation', 'Click to stop and transcribe'],
  'Start voice conversation': ['Start voice conversation', null],
  'Voice chat engine': ['Voice chat engine', 'Choose how voice conversations run']
}

function installClaudeVoiceTips({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  const selector = Object.keys(CLAUDE_VOICE_TIPS).map(label => "[data-slot='composer-root'] button[aria-label='" + label + "']").join(', ')
  let tip = null, current = null, timer = 0, frame = 0
  const hide = () => {
    win.clearTimeout(timer)
    if (frame) win.cancelAnimationFrame(frame)
    frame = 0
    current = null
    if (tip) tip.hidden = true
    doc.querySelectorAll('[data-claude-tip-replaced]').forEach(node => node.removeAttribute('data-claude-tip-replaced'))
  }
  // Hermes opens its bubble after a delay; while ours shows, each frame hides it.
  const muffle = () => {
    frame = 0
    if (!current) return
    const id = current.getAttribute('aria-describedby')
    const native = id && doc.getElementById(id)
    if (native && !native.hasAttribute('data-claude-tip-replaced')) native.setAttribute('data-claude-tip-replaced', '')
    place(current)
    frame = win.requestAnimationFrame(muffle)
  }
  const show = button => {
    if (!button.isConnected || button.disabled) return
    const [title, fixed] = CLAUDE_VOICE_TIPS[button.getAttribute('aria-label')] || []
    if (!title) return
    let sub = fixed
    if (!sub) {
      // The engine Hermes names in its own tooltip ("… — speech-to-text").
      const id = button.getAttribute('aria-describedby')
      const engine = (id && doc.getElementById(id)?.textContent.split('—')[1]?.trim()) || ''
      sub = engine ? 'Talk with Hermes · ' + engine : 'Talk with Hermes out loud'
    }
    if (!tip) {
      tip = doc.createElement('div')
      tip.setAttribute('data-claude-voice-tip', '')
      tip.setAttribute('role', 'tooltip')
      tip.append(doc.createElement('strong'), doc.createElement('span'))
      doc.body.append(tip)
    }
    tip.firstChild.textContent = title
    tip.lastChild.textContent = sub
    tip.hidden = false
    place(button)
  }
  // Above the button, or above the column of voice toggles Hermes fans out
  // over the mic on hover, so the card never covers them.
  const place = button => {
    if (!tip || tip.hidden) return
    const box = button.getBoundingClientRect()
    const width0 = tip.offsetWidth, height0 = tip.offsetHeight
    let top = box.top
    // (Hermes portals that column into the body as an open fan-menu.)
    const fanned = button.closest("[data-slot='fan-menu-anchor']") ? doc.querySelectorAll("[data-slot='fan-menu'][data-state='open'] button")
      : button.matches("[aria-label='Start voice conversation']") ? doc.querySelectorAll("[role='menu'][aria-labelledby='" + (button.closest('[data-claude-has~=child-start-voice]')?.querySelector("button[aria-label='Voice chat engine']")?.id || '-') + "']") : []
    for (const node of fanned) {
      const rect = node.getBoundingClientRect()
      if (rect.height > 0 && rect.top < top && node.checkVisibility({ opacityProperty: true, visibilityProperty: true })) top = rect.top
    }
    const width = tip.offsetWidth, height = tip.offsetHeight
    const left = Math.round(Math.max(8, Math.min(win.innerWidth - width - 8, box.left + box.width / 2 - width / 2))) + 'px'
    const y = Math.round(Math.max(8, top - height - 8)) + 'px'
    if (tip.style.left !== left) tip.style.left = left
    if (tip.style.top !== y) tip.style.top = y
  }
  const onOver = event => {
    const button = event.target?.closest?.(selector)
    if (!button) { if (current && !current.contains(event.target)) hide(); return }
    if (button === current) return
    hide()
    current = button
    frame = win.requestAnimationFrame(muffle)
    timer = win.setTimeout(() => { if (current === button) show(button) }, 350)
  }
  // (A synthetic press, such as the engine fan opening Hermes' menu, is not the user leaving.)
  const onAway = event => { if (event.isTrusted && current && (event.type !== 'pointerout' || !current.contains(event.relatedTarget))) hide() }
  doc.addEventListener('pointerover', onOver, true)
  doc.addEventListener('pointerout', onAway, true)
  doc.addEventListener('pointerdown', onAway, true)
  win.addEventListener('blur', hide)
  return () => {
    hide()
    tip?.remove()
    doc.removeEventListener('pointerover', onOver, true)
    doc.removeEventListener('pointerout', onAway, true)
    doc.removeEventListener('pointerdown', onAway, true)
    win.removeEventListener('blur', hide)
  }
}

// The voice-conversation button as the mic is drawn: a corner chevron, and
// on hover Hermes' own engine menu opens (its chevron button leaves the row
// but stays the menu's trigger and anchor). Leaving the button and the menu
// shuts it, as a click elsewhere does.
function installClaudeVoiceEngineHover({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  const PAIR = "[data-slot='composer-root'] span[data-claude-has~='child-start-voice']"
  let pair = null, openTimer = 0, closeTimer = 0
  const chevron = () => pair?.querySelector("button[aria-label='Voice chat engine']")
  const menu = () => { const id = chevron()?.id; return id ? doc.querySelector("[role='menu'][aria-labelledby='" + id + "']") : null }
  const press = target => target.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }))
  const open = () => {
    openTimer = 0
    const trigger = chevron()
    if (!trigger || trigger.disabled || menu()) return
    press(trigger)
  }
  const shut = () => {
    closeTimer = 0
    if (menu()) press(doc.body)
  }
  const onOver = event => {
    const hit = event.target?.closest?.(PAIR)
    const inMenu = Boolean(menu()?.contains(event.target))
    if (hit || inMenu) {
      if (hit) pair = hit
      win.clearTimeout(closeTimer); closeTimer = 0
      if (hit && !menu() && !openTimer) openTimer = win.setTimeout(open, 150)
      return
    }
    if (openTimer) { win.clearTimeout(openTimer); openTimer = 0 }
    if (pair && menu() && !closeTimer) closeTimer = win.setTimeout(shut, 250)
  }
  doc.addEventListener('pointerover', onOver, true)
  return () => {
    win.clearTimeout(openTimer)
    win.clearTimeout(closeTimer)
    doc.removeEventListener('pointerover', onOver, true)
  }
}

// The composer box's height and its attachment row's, for the layout CSS:
// the box's buttons ride its last line, and pasted images sit inside it.
// Measured by a ResizeObserver; a slow poll only notices a re-mounted composer.
function installClaudeComposerBox({ document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  let fade = null, box = null, row = null, disposed = false
  const setVar = (node, name, value) => { if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value) }
  const measure = () => {
    if (disposed || !fade) return
    if (box) setVar(fade, '--claude-composer-box-h', (Math.round(box.getBoundingClientRect().height * 100) / 100) + 'px')
    const attached = Boolean(row && row.childElementCount > 0)
    if (fade.hasAttribute('data-claude-attached') !== attached) fade.toggleAttribute('data-claude-attached', attached)
    if (attached) setVar(fade, '--claude-attach-h', (Math.round(row.getBoundingClientRect().height * 100) / 100) + 'px')
    // Queue beside send (busy, text in): the text keeps clear of both.
    const queued = Boolean(fade.querySelector("button[aria-label='Queue message']"))
    if (fade.hasAttribute('data-claude-queue') !== queued) fade.toggleAttribute('data-claude-queue', queued)
  }
  const resize = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(measure) : null
  const children = new win.MutationObserver(measure)
  const find = () => {
    if (disposed) return
    const nextFade = doc.querySelector("[data-slot='composer-root'] [data-slot='composer-fade']")
    const nextBox = nextFade?.querySelector(":scope > div:last-child > div:has([data-slot='composer-rich-input'])") || null
    const nextRow = nextFade?.querySelector(":scope > [data-slot='composer-attachments']") || null
    // (Same elements: re-read the sizes anyway; a style swap on reload can land between observations.)
    if (nextFade === fade && nextBox === box && nextRow === row) { measure(); return }
    if (fade && fade !== nextFade) { fade.removeAttribute('data-claude-attached'); fade.style.removeProperty('--claude-composer-box-h'); fade.style.removeProperty('--claude-attach-h') }
    fade = nextFade; box = nextBox; row = nextRow
    resize?.disconnect(); children.disconnect()
    for (const node of [box, row]) if (node) resize?.observe(node)
    if (fade) children.observe(fade, { childList: true })
    if (row) children.observe(row, { childList: true })
    measure()
  }
  const timer = win.setInterval(find, 600)
  find()
  return () => {
    disposed = true
    win.clearInterval(timer)
    resize?.disconnect(); children.disconnect()
    if (fade) { fade.removeAttribute('data-claude-attached'); fade.removeAttribute('data-claude-queue'); fade.style.removeProperty('--claude-composer-box-h'); fade.style.removeProperty('--claude-attach-h') }
  }
}

function installClaudeContextRing({ host: api = host, document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  if (!doc?.body || !win) return () => {}
  let frame = 0, disposed = false, ring = null, timer = 0
  const NS = 'http://www.w3.org/2000/svg'
  const R = 5.5, C = 2 * Math.PI * R
  const source = () => [...doc.querySelectorAll(CLAUDE_CONTEXT_ITEM)].find(b => claudeContextPercent(b.textContent) != null)
  // The statusbar item sits, invisible, under the ring: Hermes' panel opens from it.
  const anchor = item => {
    if (!ring) return
    const box = ring.getBoundingClientRect()
    const left = Math.round(box.left) + 'px', top = Math.round(box.top) + 'px'
    if (item.style.left !== left) item.style.left = left
    if (item.style.top !== top) item.style.top = top
  }
  const build = () => {
    const button = doc.createElement('button')
    button.type = 'button'
    button.dataset.claudeContextRing = ''
    const svg = doc.createElementNS(NS, 'svg')
    svg.setAttribute('viewBox', '0 0 14 14')
    svg.setAttribute('aria-hidden', 'true')
    for (const part of ['track', 'fill']) {
      const circle = doc.createElementNS(NS, 'circle')
      circle.setAttribute('cx', '7'); circle.setAttribute('cy', '7'); circle.setAttribute('r', String(R))
      circle.dataset.part = part
      svg.append(circle)
    }
    button.append(svg)
    // Hermes' panel opens from its own statusbar item (Radix opens on pointerdown).
    button.addEventListener('click', event => {
      event.stopPropagation()
      const item = source()
      if (!item) return togglePop(button)
      anchor(item)
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) item.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }))
    })
    return button
  }
  // Without Hermes' panel (a fresh session, or the statusbar off) the ring
  // still answers a click with a small card of what is known.
  let pop = null
  const closePop = () => { pop?.remove(); pop = null }
  const togglePop = button => {
    if (pop) return closePop()
    const usage = claudeFocusedUsage(api)
    pop = doc.createElement('div')
    pop.dataset.claudeContextPop = ''
    pop.setAttribute('role', 'status')
    const title = doc.createElement('div')
    title.dataset.claudeContextPopTitle = ''
    title.textContent = 'Context usage'
    const line = doc.createElement('div')
    line.textContent = usage && usage.context_max
      ? '~' + claudeTokens(usage.context_used || 0) + ' / ' + claudeTokens(usage.context_max) + ' tokens · ' + Math.round(usage.context_percent) + '%'
      : 'No context used yet in this session.'
    pop.append(title, line, ...claudeUsageRows(doc, claudeUsageExtras(api)))
    doc.body.append(pop)
    const box = button.getBoundingClientRect()
    pop.style.left = Math.round(Math.max(8, Math.min(win.innerWidth - pop.offsetWidth - 8, box.right - pop.offsetWidth))) + 'px'
    pop.style.top = Math.round(box.top - pop.offsetHeight - 8) + 'px'
  }
  const onOutside = event => { if (pop && !pop.contains(event.target) && !ring?.contains(event.target)) closePop() }
  doc.addEventListener('pointerdown', onOutside, true)
  const place = () => {
    frame = 0
    if (disposed) return
    const item = source()
    const usage = claudeFocusedUsage(api)
    const effort = doc.querySelector("[data-slot='composer-root'] button[data-testid='reasoning-pill']") || doc.querySelector("[data-slot='composer-root'] button[data-tour='model-pill']")
    for (const old of doc.querySelectorAll('[data-claude-context-source]')) if (old !== item) { old.removeAttribute('data-claude-context-source'); old.style.removeProperty('left'); old.style.removeProperty('top') }
    // Hermes' session usage drives the ring; the statusbar item (when the bar
    // is on) only adds its detailed panel on click.
    // A fresh session has no figures yet: Claude still shows an empty ring.
    if (!effort) { ring?.remove(); return }
    if (!ring) ring = build()
    if (effort.nextElementSibling !== ring) effort.after(ring)
    // The statusbar item leaves the bar and sits, invisible, under the ring:
    // its panel then opens above the ring, as Claude's does.
    if (item) {
      if (!item.hasAttribute('data-claude-context-source')) item.setAttribute('data-claude-context-source', '')
      // Measured only while its panel is open (it follows the ring then); a
      // closed one is placed when the ring opens it. Measuring on every DOM
      // change forced a page-wide style pass each time.
      if (item.getAttribute('data-state') === 'open' || item.getAttribute('aria-expanded') === 'true') {
        anchor(item)
        // Speed and cache under Hermes' own figures, while its panel is open.
        const panel = item.getAttribute('aria-controls') && doc.getElementById(item.getAttribute('aria-controls'))
        if (panel) {
          const extras = claudeUsageExtras(api)
          let block = panel.querySelector(':scope > [data-claude-usage-extra]')
          const key = JSON.stringify(extras)
          if (!extras.length) block?.remove()
          else if (!block || block.dataset.claudeUsageKey !== key) {
            block?.remove()
            block = doc.createElement('div')
            block.dataset.claudeUsageExtra = ''
            block.dataset.claudeUsageKey = key
            block.append(...claudeUsageRows(doc, extras))
            panel.append(block)
          }
        }
      }
    }
    ring.toggleAttribute('data-panel', !!item)
    const pct = usage ? usage.context_percent : item ? claudeContextPercent(item.textContent) : 0
    const used = usage && usage.context_max ? '~' + claudeTokens(usage.context_used || 0) + '/' + claudeTokens(usage.context_max) : (item?.querySelector('.truncate')?.textContent.trim() || '')
    const extras = claudeUsageExtras(api).map(([, value]) => value.split(' · ')[0])
    const label = 'Context ' + Math.round(pct) + '%' + (used ? ' (' + used + ')' : '') + (extras.length ? ' · ' + extras.join(' · ').replace(/% hit/, '% cache hit') : '')
    if (ring.getAttribute('aria-label') !== label) { ring.setAttribute('aria-label', label); ring.title = label }
    const dash = (C * pct / 100).toFixed(2) + ' ' + C.toFixed(2)
    const fill = ring.querySelector("[data-part='fill']")
    if (fill.getAttribute('stroke-dasharray') !== dash) fill.setAttribute('stroke-dasharray', dash)
    ring.toggleAttribute('data-high', pct >= 80)
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, popper, editor, diffs)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true })
  win.addEventListener('resize', schedule)
  // Usage changes between turns without touching the DOM; look again now and then.
  timer = win.setInterval(schedule, 2000)
  place()
  return () => {
    disposed = true
    observer.disconnect()
    win.removeEventListener('resize', schedule)
    win.clearInterval(timer)
    doc.removeEventListener('pointerdown', onOutside, true)
    closePop()
    if (frame) win.cancelAnimationFrame(frame)
    for (const old of doc.querySelectorAll('[data-claude-context-source]')) { old.removeAttribute('data-claude-context-source'); old.style.removeProperty('left'); old.style.removeProperty('top') }
    ring?.remove()
    ring = null
  }
}

// Claude Code keeps settings behind an account row at the foot of the sidebar.
// The row is plugin DOM appended after Hermes' sidebar content; CSS shows it
// only with the Claude Skin theme. Settings goes through Hermes' own titlebar
// action so its routing stays native.
function installClaudeAccountRow({ host: api = host, document: doc = document, window: win = window } = {}) {
  let bar = null, row = null, menu = null, frame = 0, disposed = false
  const profileName = () => String(api?.state?.profile?.get?.() || 'default')
  // The agent's own name and face: profile.yaml display_name (or the Bots
  // title) and its avatar asset, read through the gateway like Hermes Bots.
  let identity = { key: '', name: '', avatar: '' }, identityRun = 0, identityRetries = 0, identityRetry = 0
  const agentName = () => identity.name || profileName()
  const loadIdentity = async () => {
    const profile = profileName(), key = `${api?.state?.connectionId?.get?.() || ''}/${profile}`
    if (identity.key === key || typeof api?.request !== 'function') return
    const run = ++identityRun
    // A key is only cached once the gateway answered: a request made while
    // the backend is still starting (app launch, reconnect, update) must be
    // retried rather than leave the row on the profile id.
    identity = { key: '', name: '', avatar: '' }
    try {
      const listing = await api.request('profiles.list', { include_sessions: false })
      if (run !== identityRun) return
      const entry = (listing?.profiles || []).find(row => (row?.name || 'default') === profile)
      identity = { key, name: '', avatar: '' }
      identityRetries = 0
      if (!entry) { if (row) row.dataset.claudeIdentity = 'no-profile'; return paint() }
      identity = { key, name: String(entry.display_name || entry.bot_title || '').trim(), avatar: '' }
      if (row) row.dataset.claudeIdentity = identity.name ? 'named' : 'unnamed'
      paint()
      if (!entry.has_avatar) return
      const asset = await api.request('profiles.get_asset', { name: entry.name, asset: 'avatar' })
      const data = typeof asset?.data === 'string' && asset.found !== false ? asset.data : ''
      if (run !== identityRun || !/^data:image\/(png|jpeg|webp|gif|svg\+xml);/.test(data)) return
      identity = { ...identity, avatar: data }
      paint()
    } catch (error) {
      // Name and initial stay on the profile id until a retry. A request made
      // while the gateway is still starting can fail with the gateway already
      // reported open, so no state change would retry it: retry here.
      if (row) row.dataset.claudeIdentity = `error: ${String(error?.message || error).slice(0, 80)}`
      if (run === identityRun && identityRetries++ < 10) identityRetry = win.setTimeout(() => { if (!disposed) void loadIdentity() }, 3000)
    }
  }
  const openSettings = () => {
    const native = doc.querySelector("[data-titlebar-cluster] button[aria-label='Open settings']")
    if (native) native.click()
    else api?.navigate?.('/settings')
  }
  const closeMenu = () => {
    menu?.remove()
    menu = null
    row?.setAttribute('aria-expanded', 'false')
  }
  const item = (label, run, { hint = '', icon = '', tag = '' } = {}) => {
    const button = doc.createElement('button')
    button.type = 'button'
    button.setAttribute('role', 'menuitem')
    button.dataset.claudeAccountItem = ''
    if (icon) {
      const glyph = doc.createElement('i')
      glyph.className = `codicon codicon-${icon}`
      glyph.setAttribute('aria-hidden', 'true')
      button.append(glyph)
    }
    const text = doc.createElement('span')
    text.dataset.claudeAccountLabel = ''
    text.textContent = label
    button.append(text)
    if (tag) {
      const muted = doc.createElement('span')
      muted.dataset.claudeAccountTag = ''
      muted.textContent = tag
      text.append(' ', muted)
    }
    if (hint) {
      const kbd = doc.createElement('kbd')
      kbd.textContent = hint
      button.append(kbd)
    }
    button.addEventListener('click', () => { closeMenu(); run() })
    return button
  }
  // Gateways take the place of Claude's workspace list. Hermes' own statusbar
  // switcher owns the actual switch (local-device consent, error toasts), so a
  // pick opens that native menu and selects the matching row.
  const nextFrame = () => new Promise(resolve => win.requestAnimationFrame(() => resolve()))
  const nativeGatewayTrigger = () => doc.querySelector("[data-slot='connection-switcher'] button[aria-haspopup='menu']")
  const activeGatewayLabel = () => {
    const label = nativeGatewayTrigger()?.getAttribute('aria-label') || ''
    const split = label.indexOf(': ')
    return split >= 0 ? label.slice(split + 2) : ''
  }
  const viaNativeGatewayMenu = async pick => {
    const trigger = nativeGatewayTrigger()
    if (!trigger?.id) return false
    // The statusbar switcher is visually hidden in this theme; keep its menu
    // invisible too while it is driven from the account menu.
    const root = doc.documentElement
    root.dataset.claudeGatewayProxy = ''
    try {
      trigger.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }))
      for (let attempt = 0; attempt < 30; attempt++) {
        await nextFrame()
        const native = doc.querySelector(`[role='menu'][aria-labelledby='${win.CSS.escape(trigger.id)}']`)
        if (!native) continue
        const target = pick(native)
        if (target) { target.click(); return true }
        break
      }
      doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return false
    } finally {
      await nextFrame()
      delete root.dataset.claudeGatewayProxy
    }
  }
  const fillGateways = async container => {
    let connections = []
    try { connections = (await api?.connections?.()) || [] } catch { connections = [] }
    if (!menu || !container.isConnected) return
    const active = activeGatewayLabel()
    if (connections.length > 1) for (const connection of connections) {
      const label = String(connection.label || connection.id)
      const tag = { local: 'Local', remote: 'Remote', ssh: 'SSH', cloud: 'Cloud' }[connection.kind] || ''
      const button = item(label, () => viaNativeGatewayMenu(native =>
        [...native.querySelectorAll("[role='menuitemradio']")].find(row => row.textContent.trim().includes(label))), { tag })
      button.setAttribute('role', 'menuitemradio')
      button.dataset.claudeAccountGateway = connection.kind || ''
      button.setAttribute('aria-checked', String(active ? label === active : Boolean(connection.primary)))
      const check = doc.createElement('i')
      check.className = 'codicon codicon-check'
      check.setAttribute('aria-hidden', 'true')
      button.append(check)
      container.append(button)
    }
  }
  // Like Claude's "Organization settings", gateway management sits with Settings.
  const manageGateways = () => viaNativeGatewayMenu(native =>
    [...native.querySelectorAll("[role='menuitem']")].pop()).then(opened => { if (!opened) openSettings() })
  const toggleMenu = () => {
    if (menu) return closeMenu()
    void loadIdentity()
    menu = doc.createElement('div')
    menu.setAttribute('role', 'menu')
    menu.dataset.claudeAccountMenu = ''
    const head = doc.createElement('div')
    head.dataset.claudeAccountMenuHead = ''
    head.textContent = agentName()
    const gateways = doc.createElement('div')
    gateways.dataset.claudeAccountGateways = ''
    const separator = doc.createElement('div')
    separator.dataset.claudeAccountSeparator = ''
    separator.setAttribute('role', 'separator')
    menu.append(head, gateways, separator, item('Settings', openSettings, { hint: 'Ctrl+,', icon: 'settings-gear' }), item('Manage gateways…', manageGateways, { icon: 'server-environment' }), item('Profiles', () => api?.navigate?.('/profiles'), { icon: 'account' }))
    void fillGateways(gateways)
    doc.body.append(menu)
    const rect = row.getBoundingClientRect()
    menu.style.left = `${rect.left}px`
    menu.style.bottom = `${win.innerHeight - rect.top + 6}px`
    row.setAttribute('aria-expanded', 'true')
    menu.querySelector('button')?.focus()
  }
  // "Name · Org" in Claude is person · organization; here profile · gateway.
  const paint = () => {
    if (!row) return
    // Write only on change: paint runs from the body observer, and every text
    // write is itself a mutation.
    const name = agentName(), gateway = activeGatewayLabel()
    const set = (selector, text) => { const node = row.querySelector(selector); if (node.textContent !== text) node.textContent = text }
    set('[data-claude-account-name]', name)
    set('[data-claude-account-org]', gateway ? ` · ${gateway}` : '')
    const avatar = row.querySelector('[data-claude-account-avatar]')
    if (identity.avatar) {
      const image = avatar.querySelector('img')
      if (image?.getAttribute('src') !== identity.avatar) {
        const next = doc.createElement('img')
        next.alt = ''
        next.src = identity.avatar
        avatar.replaceChildren(next)
      }
    } else if (avatar.textContent !== name.slice(0, 1).toUpperCase() || avatar.querySelector('img')) {
      avatar.textContent = name.slice(0, 1).toUpperCase()
    }
  }
  const build = () => {
    row = doc.createElement('button')
    row.type = 'button'
    row.dataset.claudeAccountRow = ''
    row.setAttribute('aria-haspopup', 'menu')
    row.setAttribute('aria-expanded', 'false')
    row.setAttribute('aria-label', 'Account and settings')
    const avatar = doc.createElement('span')
    avatar.dataset.claudeAccountAvatar = ''
    avatar.setAttribute('aria-hidden', 'true')
    const label = doc.createElement('span')
    label.dataset.claudeAccountText = ''
    const name = doc.createElement('span')
    name.dataset.claudeAccountName = ''
    const org = doc.createElement('span')
    org.dataset.claudeAccountOrg = ''
    label.append(name, org)
    const caret = doc.createElement('i')
    caret.className = 'codicon codicon-chevron-down'
    caret.setAttribute('aria-hidden', 'true')
    row.append(avatar, label, caret)
    row.addEventListener('click', toggleMenu)
    bar = doc.createElement('div')
    bar.dataset.claudeAccountBar = ''
    bar.append(row)
    paint()
  }
  const place = () => {
    frame = 0
    if (disposed) return
    const sidebar = doc.querySelector("[data-tour='sessions-sidebar']")
    if (!sidebar) return
    if (!row) build()
    if (sidebar.lastElementChild !== bar) sidebar.append(bar)
    paint()
  }
  const schedule = () => { if (!frame && !disposed) frame = win.requestAnimationFrame(place) }
  const onPointer = event => { if (menu && !menu.contains(event.target) && !row?.contains(event.target)) closeMenu() }
  const onKey = event => { if (event.key === 'Escape' && menu) { closeMenu(); row?.focus() } }
  // Batches only inside regions Hermes redraws all the time (xterm, thread, editor, diffs)
  // never change what this places; they used to wake it many times a second.
  const outside = records => records.some(record => { const node = record.target.nodeType === 1 ? record.target : record.target.parentElement; return !node?.closest(".xterm, [data-slot='thread'], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea") })
  const observer = new win.MutationObserver(records => { if (outside(records)) schedule() })
  observer.observe(doc.body, { childList: true, subtree: true })
  const refresh = () => { paint(); void loadIdentity() }
  const offProfile = api?.state?.profile?.subscribe?.(refresh)
  const offConnection = api?.state?.connectionId?.subscribe?.(refresh)
  const offGateway = api?.state?.gateway?.subscribe?.(state => { if (state === 'open') refresh() })
  doc.addEventListener('pointerdown', onPointer, true)
  doc.addEventListener('keydown', onKey, true)
  place()
  return () => {
    disposed = true
    observer.disconnect()
    if (frame) win.cancelAnimationFrame(frame)
    offProfile?.()
    offConnection?.()
    offGateway?.()
    identityRun++
    win.clearTimeout(identityRetry)
    doc.removeEventListener('pointerdown', onPointer, true)
    doc.removeEventListener('keydown', onKey, true)
    closeMenu()
    bar?.remove()
    bar = row = null
  }
}

export default {
  id: ID,
  name: 'Claude Skin',
  register(ctx) {
    pluginStorage = ctx.storage
    const updater = createSkinUpdater(ctx.storage)
    const inbox = globalThis.document?.body ? installClaudeInboxRuntime({ storage: ctx.storage, host }) : null
    startClaudeInboxObserver(ctx, inbox)
    startClaudeInboxMenuOpenObserver(ctx, inbox)
    // The controller belongs to the plugin, not to a route-mounted UI slot.
    ctx.onDispose(() => updater.dispose())
    ctx.onDispose(() => inbox?.dispose())
    ctx.onDispose(connectClaudeInboxEvents(inbox))
    if (globalThis.document?.body) ctx.onDispose(installClaudeHasMarks())
    if (globalThis.document?.body) ctx.onDispose(installClaudeAccountRow())
    if (globalThis.document?.body) ctx.onDispose(installClaudeApprovalDock())
    if (globalThis.document?.body) ctx.onDispose(installClaudeBackendDock())
    if (globalThis.document?.body) {
      ctx.onDispose(installClaudeAsciiBackdrop())
      const search = installClaudeSearchDialog({ host, runAction: ctx.runAction })
      ctx.onDispose(search.dispose)
      ctx.onDispose(installClaudeSidebarMore({ runAction: ctx.runAction, openSearch: search.open }))
      ctx.onDispose(installClaudeTitleMenu())
      ctx.onDispose(installClaudeModelPill())
      ctx.onDispose(installClaudeToolPayload())
      ctx.onDispose(installClaudeContextRing())
      ctx.onDispose(installClaudeComposerBox())
      ctx.onDispose(installClaudeVoiceTips())
      ctx.onDispose(installClaudeVoiceEngineHover())
    }
    if (globalThis.document?.body) ctx.onDispose(installClaudePaneTools({ runAction: ctx.runAction, listActions: ctx.listActions, paneVisibility: host.paneVisibility }))
    if (globalThis.document?.body) ctx.onDispose(installClaudeTerminalHeader())
    if (globalThis.document?.body) ctx.onDispose(installClaudeFileBrowser())
    if (globalThis.document?.body) ctx.onDispose(installClaudeBrowserAnnotate())
    if (globalThis.document?.body) ctx.onDispose(installClaudeChanges({ state: host.state }))
    let uninstallStyle
    let disposed = false
    ctx.onDispose(() => {
      disposed = true
      uninstallStyle?.()
    })
    // Let host contribution removals settle before taking over a hot-reloaded
    // style node. Styles then outlive route slots and never claim page chrome.
    if (globalThis.document?.body) queueMicrotask(() => {
      if (!disposed) uninstallStyle = installChatStyleRuntime()
    })
    ctx.register({ id: 'update-runtime', area: 'composer.leading', order: 19, render: () => jsx(ClaudeUpdateRuntime, { updater }) })
    ctx.register({ id: 'update-button', area: 'composer.leading', order: 20, render: () => jsx(ClaudeUpdateButton, { updater }) })
    ctx.register({ id: 'inbox-settled-badge', area: 'sessionRow.trailing', data: { render: ({ sessionId }) => jsx(ClaudeSettledBadge, { sessionId, inbox }) } })
    ctx.register({ id: 'inbox-open-intent', area: 'sessionRow.leading', data: { render: ({ sessionId }) => jsx(ClaudeInboxNativeOpenIntent, { sessionId, inbox }) } })

    ctx.register({ id: 'theme', area: THEMES_AREA, data: CLAUDE_THEME })
    ctx.register({
      id: 'toggle-composer-width',
      area: PALETTE_AREA,
      data: {
        id: 'claude-chat-look.toggle-composer-width',
        label: 'Claude Skin: Composer width',
        detail: () => COMPOSER_WIDTH_MODES[readComposerWidthMode()].label,
        detailVariant: 'state',
        keepOpen: true,
        keywords: ['claude', 'skin', 'composer', 'width', 'narrow', 'full', 'hermes'],
        run: () => setComposerWidthMode(COMPOSER_WIDTH_MODES[readComposerWidthMode()].next)
      }
    })
    ctx.register({
      id: 'toggle-pinned-user-messages',
      area: PALETTE_AREA,
      data: {
        id: 'claude-chat-look.toggle-pinned-user-messages',
        label: 'Claude Skin: Pinned user messages',
        detail: () => (readPinnedUserMessagesMode() === 'hermes' ? 'Hermes' : 'Off'),
        detailVariant: 'state',
        keepOpen: true,
        keywords: ['claude', 'skin', 'pinned', 'sticky', 'user', 'message', 'prompt', 'hermes'],
        run: () => setPinnedUserMessagesMode(readPinnedUserMessagesMode() === 'hermes' ? 'off' : 'hermes')
      }
    })
    ctx.register({
      id: 'toggle-clean-transcript',
      area: PALETTE_AREA,
      data: {
        id: 'claude-chat-look.toggle-clean-transcript',
        label: 'Claude Skin: Clean transcript',
        detail: () => (readCleanTranscriptMode() === 'on' ? 'On' : 'Off'),
        detailVariant: 'state',
        keepOpen: true,
        keywords: ['claude', 'skin', 'clean', 'transcript', 'tool', 'calls', 'interim', 'messages'],
        run: () => setCleanTranscriptMode(readCleanTranscriptMode() === 'on' ? 'off' : 'on')
      }
    })
    ctx.register({
      id: 'toggle-inbox',
      area: PALETTE_AREA,
      data: {
        id: 'claude-chat-look.toggle-inbox',
        label: 'Claude Skin: Inbox',
        detail: () => readClaudeInboxMode() === 'on' ? 'On' : 'Off',
        detailVariant: 'state',
        keepOpen: true,
        keywords: ['claude', 'skin', 'inbox', 'settle', 'threads', 'sessions'],
        run: () => setClaudeInboxMode(readClaudeInboxMode() === 'on' ? 'off' : 'on', inbox)
      }
    })
  }
}

// BEGIN GENERATED UPDATE RUNTIME
// Bundled into the standalone plugin. The private feed is used only by test builds.
const UPDATE_REPO = BUILD_ID.includes('-test.') ? 'MrSakal/hermes-claude-skin-dev' : 'MrSakal/hermes-claude-skin'
const UPDATE_IS_TEST = BUILD_ID.includes('-test.')
const UPDATE_INTERVAL_MS = 60 * 60 * 1000
const UPDATE_PENDING_KEY = 'update-pending'
const UPDATE_CACHE_KEY = `update-cache:${UPDATE_REPO}`
const UPDATE_MAX_BYTES = 1_000_000
const UPDATE_CSS = `
[data-claude-update-anchor]{display:inline-flex;align-items:center;height:28px;position:relative}
.claude-update-button{box-sizing:border-box;position:relative;display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:#D97757;color:#fff;scale:.9;cursor:pointer;outline:none;transition:background 160ms,box-shadow 160ms;flex:none}
.claude-update-button:hover{box-shadow:0 0 0 3px rgb(217 119 87 / .14)}
.claude-update-button:focus-visible{outline:1px solid #D97757;outline-offset:4px}
.claude-update-button svg{display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.claude-update-button .claude-update-icon{width:16px;height:16px;pointer-events:none}
.claude-update-button .claude-update-ring{position:absolute;inset:-3px;width:34px;height:34px;transform:rotate(-90deg);color:#D97757;pointer-events:none}
.claude-update-ring circle{stroke-dasharray:113.1;stroke-dashoffset:113.1;transition:stroke-dashoffset 100ms linear}
.claude-update-button[data-phase=downloading] .claude-update-icon{animation:claude-update-download 800ms ease-in-out infinite}
.claude-update-button[data-phase=applying] .claude-update-icon,.claude-update-button[data-phase=awaiting-reload] .claude-update-icon{animation:claude-update-breathe 550ms ease-in-out infinite}
.claude-update-button:is([data-phase=done],[data-phase=vanishing]){background:#00a854;color:#fff;box-shadow:none;cursor:default}
.claude-update-button[data-phase=done]{animation:claude-update-bounce 650ms 350ms ease-in-out both}
.claude-update-button[data-phase=done] .claude-update-check{stroke-dasharray:24;stroke-dashoffset:24;animation:claude-update-draw 300ms 100ms ease forwards}
.claude-update-button[data-phase=vanishing]{animation:claude-update-exit 280ms cubic-bezier(.4,0,.65,1) both;pointer-events:none}
.claude-update-button[data-phase=error]{background:var(--ui-text-primary,#222)}
.claude-update-panel{box-sizing:border-box;position:fixed;z-index:10000;overflow:auto;overscroll-behavior:contain;width:320px;max-height:320px;padding:0 18px;border:1px solid var(--ui-stroke-secondary,#e5e5e5);border-radius:14px;background:var(--claude-color-card,var(--ui-editor-surface-background,#fff));color:var(--ui-text-primary,#171717);box-shadow:0 12px 36px #00000014,0 2px 6px #00000008;font:12px/1.65 -apple-system,system-ui,sans-serif;scrollbar-width:thin;scrollbar-color:var(--ui-stroke-secondary,#ccc) transparent}
.claude-update-panel[hidden]{display:none!important}
.claude-update-hover-bridge{position:fixed;z-index:10000;background:transparent}
.claude-update-hover-bridge[hidden]{display:none!important}
.claude-update-release{padding:16px 0;border-bottom:1px solid var(--ui-stroke-secondary,#e5e5e5)}
.claude-update-release:last-child{border:0}
.claude-update-release header{display:flex;align-items:center;gap:8px;margin-bottom:9px;font-size:11px}
.claude-update-release time{margin-left:auto;color:var(--ui-text-tertiary,#737373);font-size:10px}
.claude-update-release h3,.claude-update-release h4{font-size:12px;line-height:1.5;font-weight:600;margin:8px 0 4px}
.claude-update-release p{margin:5px 0;color:var(--ui-text-secondary,#666);overflow-wrap:anywhere;white-space:pre-wrap}
.claude-update-release ul{margin:5px 0;padding-left:16px;color:var(--ui-text-secondary,#666)}
.claude-update-release li{margin:3px 0;overflow-wrap:anywhere}
.claude-update-release figure{margin:10px 0}
.claude-update-release img{display:block;width:auto;height:auto;max-width:100%;max-height:180px;margin-inline:auto;object-fit:contain;border-radius:8px}
.claude-update-image-fallback{color:var(--ui-text-tertiary,#737373);font-size:11px}
.claude-update-tag{border-radius:99px;padding:1px 6px;background:var(--ui-row-hover-background,#f3f3f3);font-size:9px}
.claude-update-error{padding:16px 0;white-space:pre-wrap;color:var(--ui-text-primary,#171717)}
@keyframes claude-update-download{0%,100%{transform:translateY(-1px)}50%{transform:translateY(2px)}}
@keyframes claude-update-breathe{50%{opacity:.3}}
@keyframes claude-update-draw{to{stroke-dashoffset:0}}
@keyframes claude-update-bounce{0%,100%{transform:translateY(0) scale(1)}25%{transform:translateY(-3px) scale(1.12)}48%{transform:translateY(0) scale(.96)}70%{transform:translateY(-1.5px) scale(1.06)}86%{transform:translateY(0) scale(.99)}}
@keyframes claude-update-exit{from{transform:scale(1);opacity:1}to{transform:scale(0);opacity:0}}
@media(prefers-reduced-motion:reduce){.claude-update-button,.claude-update-button *{animation:none!important;transition:none!important}.claude-update-check{stroke-dashoffset:0!important}}
`

function updateVersionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-test\.(\d+))?$/.exec(String(value))
  return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? Infinity : Number(match[4])] : null
}
function compareUpdateVersions(left, right) {
  const a = updateVersionParts(left), b = updateVersionParts(right)
  if (!a || !b) return null
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
  return 0
}
async function updateSha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
}
function updateSourceIdentity(source) {
  return { id: /^const ID = ['"]([^'"]+)['"]/m.exec(source)?.[1], version: /^const BUILD_ID = ['"]([^'"]+)['"]/m.exec(source)?.[1] }
}
function normalizeUpdateRoot(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f]/.test(value)) throw new Error('Invalid local plugin folder.')
  const path = value.replace(/\\/g, '/').replace(/\/$/, '')
  if (!/^(?:\/|[A-Za-z]:\/)/.test(path) || !path.endsWith('/desktop-plugins') || path.split('/').some(part => part === '.' || part === '..')) throw new Error('Invalid local plugin folder.')
  return path
}
function updateAssetFor(release, repo = UPDATE_REPO) {
  if (!release || release.draft || (!UPDATE_IS_TEST && release.prerelease) || !updateVersionParts(release.tag_name)) return null
  const asset = release.assets?.find(item => item.name === 'plugin.js')
  if (!asset || !Number.isSafeInteger(asset.id) || asset.url !== `https://api.github.com/repos/${repo}/releases/assets/${asset.id}`) return null
  if (!/^sha256:[a-f0-9]{64}$/.test(asset.digest || '') || asset.size <= 0 || asset.size > UPDATE_MAX_BYTES) return null
  return asset
}
function updateImageURL(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    const path = url.pathname.toLowerCase(), repo = '/mrsakal/hermes-claude-skin/'
    const allowed = (url.hostname === 'github.com' && (path.startsWith(repo + 'releases/download/') || path.startsWith('/user-attachments/assets/')))
      || (url.hostname === 'raw.githubusercontent.com' && path.startsWith(repo))
      || url.hostname === 'user-images.githubusercontent.com'
    return allowed ? url.href : null
  } catch { return null }
}
function decodeUpdateImageText(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, name) => {
    if (name[0] !== '#') return named[name.toLowerCase()]
    const point = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1))
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd'
  })
}
function appendUpdateImage(parent, source, alt) {
  const url = updateImageURL(decodeUpdateImageText(source))
  const fallback = document.createElement('p')
  fallback.className = 'claude-update-image-fallback'
  fallback.textContent = decodeUpdateImageText(alt) || 'Image unavailable'
  if (!url) { parent.appendChild(fallback); return }
  const frame = document.createElement('figure'), image = document.createElement('img')
  image.alt = decodeUpdateImageText(alt)
  // GitHub release redirects support image display, not CORS pixel access.
  // No fetch/token bridge is used; keep the image's referrer empty.
  image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer'
  image.dataset.updateImageSrc = url
  image.addEventListener('error', () => frame.replaceWith(fallback), { once: true })
  frame.appendChild(image); parent.appendChild(frame)
}
function activateUpdateImages(parent) {
  for (const image of parent.querySelectorAll('img[data-update-image-src]')) {
    const source = image.dataset.updateImageSrc
    delete image.dataset.updateImageSrc
    image.src = source
  }
}
function appendUpdateNotes(parent, raw) {
  // Parse only image tokens. No release HTML, attributes or event handlers enter
  // the DOM; the remainder continues to use plain text nodes.
  let list = null
  const appendText = line => {
    const text = line.trim().replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
    if (!text) { list = null; return }
    const bullet = /^[-*] (.+)/.exec(text)
    if (bullet) {
      if (!list) { list = document.createElement('ul'); parent.appendChild(list) }
      const item = document.createElement('li'); item.textContent = bullet[1]; list.appendChild(item)
    } else {
      list = null
      const heading = /^#{1,6}\s+(.+)/.exec(text)
      const node = document.createElement(heading ? 'h4' : 'p'); node.textContent = heading ? heading[1] : text; parent.appendChild(node)
    }
  }
  const tokens = /!\[([^\]\n]*)\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)|<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*\/?>/gi
  for (const line of String(raw || '').split('\n')) {
    let cursor = 0
    for (const match of line.matchAll(tokens)) {
      const before = line.slice(cursor, match.index)
      if (!/^\s*[-*]\s*$/.test(before)) appendText(before)
      if (match[0].startsWith('![')) appendUpdateImage(parent, match[2].replace(/^<|>$/g, ''), match[1])
      else {
        const attributes = new Map()
        for (const field of match[0].slice(4, -1).matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
          const name = field[1].toLowerCase()
          if (!attributes.has(name)) attributes.set(name, field[2] ?? field[3] ?? field[4] ?? '')
        }
        appendUpdateImage(parent, attributes.get('src'), attributes.get('alt'))
      }
      list = null; cursor = match.index + match[0].length
    }
    appendText(line.slice(cursor))
  }
}

function createSkinUpdater(storage, native = globalThis.window?.hermesDesktop, request = (...args) => fetch(...args)) {
  const views = new Set(), abort = new AbortController(), timers = new Set()
  const capable = ['desktopPluginsRoot', 'readPluginSource', 'writeTextFile'].every(name => typeof native?.[name] === 'function')
  const state = { phase: 'idle', releases: [], target: null, progress: 0, error: '', page: 1, hasMore: false }
  let initPromise, root, token = '', disposed = false, loadingMore = false, reportChain = Promise.resolve()
  let operation = null, proof = {}
  const cache = storage?.get?.(UPDATE_CACHE_KEY, null)
  const schedule = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!disposed) fn() }, ms); timers.add(id); return id }
  const pause = ms => new Promise(resolve => schedule(resolve, ms))
  const active = () => ['downloading', 'applying', 'awaiting-reload', 'done', 'vanishing'].includes(state.phase)
  function report(extra = {}) {
    if (!UPDATE_IS_TEST || !root || disposed) return
    proof = { ...proof, ...extra }
    const payload = { ...proof, runningVersion: BUILD_ID, phase: state.phase, repository: UPDATE_REPO, targetVersion: state.target?.tag_name || null, activeBuild: document.documentElement.dataset.claudeChatLookBuild || null, at: new Date().toISOString() }
    reportChain = reportChain.then(() => disposed ? undefined : native.writeTextFile(`${root}/${ID}/update-test-report.json`, JSON.stringify(payload, null, 2))).catch(() => {})
  }
  function paint() { if (!disposed) for (const view of views) view.paint() }
  function phase(value, error = '') { if (disposed) return; state.phase = value; state.error = error; paint(); report() }
  async function readSource(path) {
    const result = await native.readPluginSource(path)
    if (result.truncated || typeof result.text !== 'string') throw new Error('The local plugin could not be read completely.')
    return result.text
  }
  async function restorePrevious(pending) {
    if (!pending || pending.repository !== UPDATE_REPO || !/^[a-f0-9]{64}$/.test(pending.fromDigest || '')) throw new Error('The rollback receipt is missing.')
    const previous = await readSource(`${root}/${ID}/update-rollback.js`)
    if (await updateSha256(new TextEncoder().encode(previous)) !== pending.fromDigest || updateSourceIdentity(previous).version !== pending.fromVersion) throw new Error('The rollback copy could not be verified.')
    await native.writeTextFile(`${root}/${ID}/plugin.js`, previous)
    if (await readSource(`${root}/${ID}/plugin.js`) !== previous) throw new Error('The restored file could not be verified.')
    storage.remove(UPDATE_PENDING_KEY)
  }
  function recoverPending(pending) {
    phase('awaiting-reload')
    schedule(async () => {
      const current = storage.get(UPDATE_PENDING_KEY, null)
      if (!current || current.startedAt !== pending.startedAt || current.digest !== pending.digest) return
      try { await restorePrevious(current); phase('error', 'The interrupted update was rolled back. Click to retry.') }
      catch { phase('error', 'The update is incomplete. Its recovery receipt and rollback copy were retained.') }
    }, Math.max(0, 10000 - (Date.now() - pending.startedAt)))
  }
  async function initialize() {
    if (!capable) throw new Error('This Hermes Desktop version does not support local plugin updates.')
    if (!initPromise) initPromise = (async () => {
      root = normalizeUpdateRoot(await native.desktopPluginsRoot())
      if (UPDATE_IS_TEST) {
        const access = JSON.parse(await readSource(`${root}/${ID}/update-test-access.json`))
        if (access.repository !== UPDATE_REPO || typeof access.token !== 'string' || !access.token) throw new Error('Private update access is not configured on this computer.')
        token = access.token
      }
      const pending = storage.get(UPDATE_PENDING_KEY, null)
      if (pending?.targetVersion === BUILD_ID && pending.repository === UPDATE_REPO) {
        const installed = await readSource(`${root}/${ID}/plugin.js`)
        const hash = await updateSha256(new TextEncoder().encode(installed))
        if (hash !== pending.digest || updateSourceIdentity(installed).version !== BUILD_ID) { recoverPending(pending); return }
        storage.remove(UPDATE_PENDING_KEY)
        storage.set('last-update', { version: BUILD_ID, digest: hash, verifiedAt: Date.now() })
        phase('done')
        report({ hotReloadVerified: true, installedDigest: hash, fromVersion: pending.fromVersion })
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) schedule(() => phase('idle'), 700)
      } else if (pending?.repository === UPDATE_REPO && Number.isFinite(pending.startedAt)) recoverPending(pending)
      else report({ localAccessVerified: true })
    })()
    return initPromise
  }
  async function github(path, accept = 'application/vnd.github+json') {
    await initialize()
    const allowed = `https://api.github.com/repos/${UPDATE_REPO}/releases`
    if (!(path === allowed || path.startsWith(allowed + '?') || path.startsWith(allowed + '/assets/'))) throw new Error('Unexpected update source.')
    const headers = { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await request(path, { headers, credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]) })
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? 'GitHub is temporarily limiting requests. Try again later.' : `GitHub request failed (${response.status}).`)
    return response
  }
  async function loadPage(page) {
    const response = await github(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=10&page=${page}`)
    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('GitHub returned an invalid release list.')
    return data
  }
  async function firstPage() {
    const releases = await loadPage(1)
    const entry = { releases, checkedAt: Date.now() }
    storage.set(UPDATE_CACHE_KEY, entry)
    return entry
  }
  function accept(entry) {
    if (!entry || disposed) return
    state.releases = entry.releases.filter(release => !release.draft && (UPDATE_IS_TEST || !release.prerelease))
    state.page = 1; state.hasMore = entry.releases.length === 10
    state.target = state.releases.filter(release => updateAssetFor(release) && compareUpdateVersions(release.tag_name, BUILD_ID) === 1).sort((a, b) => -compareUpdateVersions(a.tag_name, b.tag_name))[0] || null
    if (!active() && state.phase !== 'error') phase(state.target ? 'available' : 'idle')
    else paint()
    report({ checkedAt: entry.checkedAt })
  }
  async function more() {
    if (disposed || loadingMore || !state.hasMore) return
    loadingMore = true
    try {
      const releases = await loadPage(state.page + 1)
      const seen = new Set(state.releases.map(release => release.id))
      state.releases = [...state.releases, ...releases.filter(release => !seen.has(release.id) && !release.draft && (UPDATE_IS_TEST || !release.prerelease))]
      state.page++; state.hasMore = releases.length === 10; paint()
    } catch { /* Existing notes remain usable; another scroll can retry. */ }
    finally { loadingMore = false }
  }
  async function download(asset) {
    const response = await github(asset.url, 'application/octet-stream')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('A bounded streaming download is not available in this Hermes version.')
    if (Number(response.headers?.get('content-length')) > UPDATE_MAX_BYTES) { await reader.cancel(); throw new Error('The update file is too large.') }
    let bytes
    {
      const chunks = []; let total = 0
      while (true) {
        const result = await reader.read()
        if (result.done) break
        total += result.value.length
        if (total > UPDATE_MAX_BYTES) { await reader.cancel(); throw new Error('The update file is too large.') }
        chunks.push(result.value); state.progress = Math.min(total / asset.size, 1); paint()
      }
      bytes = new Uint8Array(total); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    }
    if (bytes.length !== asset.size || bytes.length > UPDATE_MAX_BYTES) throw new Error('The update download is incomplete.')
    if (await updateSha256(bytes) !== asset.digest.slice(7)) throw new Error('The update file failed its integrity check.')
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  async function install() {
    if (operation || !state.target || !['available', 'error'].includes(state.phase)) return
    const target = state.target, asset = updateAssetFor(target)
    if (!asset) return
    const run = { touched: false, previous: '', path: '', cancelled: false }; operation = run
    try {
      phase('downloading'); state.progress = 0
      const source = await download(asset)
      const identity = updateSourceIdentity(source)
      if (identity.id !== ID || identity.version !== target.tag_name) throw new Error('The download is not the expected Claude Skin release.')
      state.progress = 1; paint(); await pause(40)
      if (disposed) return
      phase('applying')
      run.path = `${root}/${ID}/plugin.js`
      run.previous = await readSource(run.path)
      if (updateSourceIdentity(run.previous).version !== BUILD_ID) throw new Error('The local skin changed. Reload it before updating.')
      await native.writeTextFile(`${root}/${ID}/update-rollback.js`, run.previous)
      if (await readSource(`${root}/${ID}/update-rollback.js`) !== run.previous) throw new Error('The rollback copy could not be verified.')
      await native.writeTextFile(`${root}/${ID}/update-staged.js`, source)
      if (await readSource(`${root}/${ID}/update-staged.js`) !== source) throw new Error('The staged update could not be verified.')
      storage.set(UPDATE_PENDING_KEY, { repository: UPDATE_REPO, fromVersion: BUILD_ID, fromDigest: await updateSha256(new TextEncoder().encode(run.previous)), targetVersion: target.tag_name, digest: asset.digest.slice(7), startedAt: Date.now() })
      await pause(40)
      run.touched = true
      await native.writeTextFile(run.path, source)
      if (await readSource(run.path) !== source) throw new Error('The installed update could not be verified.')
      if (disposed) return
      phase('awaiting-reload')
      schedule(async () => {
        if (disposed || state.phase !== 'awaiting-reload') return
        try { await restorePrevious(storage.get(UPDATE_PENDING_KEY, null)); phase('error', 'Hermes did not reload the update. The previous file was restored.') }
        catch { phase('error', 'Hermes did not reload the update. Its recovery receipt and rollback copy were retained.') }
        operation = null
      }, 10000)
    } catch (error) {
      if (disposed) return
      let message = error.message || 'The update could not be installed.'
      if (run.touched && run.previous) {
        try { await restorePrevious(storage.get(UPDATE_PENDING_KEY, null)) }
        catch { message += ' Restoration could not be verified; the recovery receipt and rollback copy were retained.' }
      } else storage.remove(UPDATE_PENDING_KEY)
      operation = null; phase('error', message + '\nClick the update button to retry.')
    }
  }
  function mount(anchor) {
    const button = document.createElement('button'), panel = document.createElement('section'), bridge = document.createElement('div')
    button.className = 'claude-update-button'; button.type = 'button'; button.dataset.claudeUpdate = 'true'
    panel.className = 'claude-update-panel'; panel.hidden = true; panel.tabIndex = 0; panel.setAttribute('aria-label', 'Claude Skin releases')
    bridge.className = 'claude-update-hover-bridge'; bridge.hidden = true; bridge.setAttribute('aria-hidden', 'true')
    anchor.dataset.claudeUpdateAnchor = 'true'; anchor.appendChild(button); document.body.append(bridge, panel)
    let closedTimer, previousPhase, previousReleases, previousError, open = false
    const position = () => {
      if (!open) return
      const rect = button.getBoundingClientRect(), width = Math.min(320, innerWidth - 24)
      panel.style.width = `${width}px`; panel.style.maxHeight = `${Math.max(80, Math.min(320, rect.top - 24))}px`
      panel.style.left = `${Math.max(12, Math.min(rect.left - 32, innerWidth - width - 12))}px`
      panel.style.top = `${Math.max(12, rect.top - panel.getBoundingClientRect().height - 12)}px`
      const popup = panel.getBoundingClientRect()
      Object.assign(bridge.style, { left: `${Math.min(popup.left, rect.left)}px`, top: `${popup.bottom}px`, width: `${Math.max(popup.right, rect.right) - Math.min(popup.left, rect.left)}px`, height: `${Math.max(0, rect.top - popup.bottom + 1)}px` })
    }
    const close = () => { clearTimeout(closedTimer); open = false; panel.hidden = true; bridge.hidden = true; button.setAttribute('aria-expanded', 'false') }
    const show = () => { if (!['available', 'error'].includes(state.phase)) return; clearTimeout(closedTimer); open = true; panel.hidden = false; bridge.hidden = false; button.setAttribute('aria-expanded', 'true'); activateUpdateImages(panel); position() }
    const leave = event => { if ([panel, bridge, button].some(node => node.contains(event.relatedTarget))) return; closedTimer = setTimeout(() => { if (!panel.contains(document.activeElement)) close() }, 180) }
    button.addEventListener('pointerenter', show); button.addEventListener('pointerleave', leave); button.addEventListener('focus', show)
    panel.addEventListener('pointerenter', () => clearTimeout(closedTimer)); panel.addEventListener('pointerleave', leave)
    bridge.addEventListener('pointerenter', () => clearTimeout(closedTimer)); bridge.addEventListener('pointerleave', leave)
    const outside = event => { if (!anchor.contains(event.target) && !panel.contains(event.target) && !bridge.contains(event.target)) close() }
    const key = event => { if (event.key === 'Escape') close() }
    button.addEventListener('pointerdown', event => event.stopPropagation())
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); close(); void install() })
    panel.addEventListener('scroll', () => { if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 40) void more() })
    button.addEventListener('animationend', event => {
      if (event.target !== button) return
      if (event.animationName === 'claude-update-bounce' && state.phase === 'done') phase('vanishing')
      else if (event.animationName === 'claude-update-exit' && state.phase === 'vanishing') phase('idle')
    })
    window.addEventListener('resize', position); document.addEventListener('scroll', position, true); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key)
    const panelResize = new ResizeObserver(position)
    panelResize.observe(panel)
    const view = { paint() {
      const visible = state.phase !== 'idle'
      anchor.style.display = visible ? 'inline-flex' : 'none'
      button.setAttribute('aria-label', state.phase === 'error' ? 'Retry Claude Skin update' : state.phase === 'done' ? 'Claude Skin is up to date' : 'Update Claude Skin')
      button.setAttribute('aria-busy', String(['downloading', 'applying', 'awaiting-reload'].includes(state.phase)))
      if (!['available', 'error'].includes(state.phase)) close()
      if (previousPhase !== state.phase) {
        previousPhase = state.phase; button.dataset.phase = state.phase
        const path = ['done', 'vanishing'].includes(state.phase) ? '<path class="claude-update-check" d="m5 13 4 4 10-10"/>' : ['applying', 'awaiting-reload'].includes(state.phase) ? '<path d="M19 8a8 8 0 0 0-13-2L3 9m0-5v5h5m-3 7a8 8 0 0 0 13 2l3-3m0 5v-5h-5"/>' : '<path d="M12 3v11m-4-4 4 4 4-4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>'
        // Only static, authored SVG reaches innerHTML; never release content.
        button.innerHTML = `<svg class="claude-update-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18"/></svg><svg class="claude-update-icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`
      }
      button.querySelector('circle').style.strokeDashoffset = String(state.phase === 'downloading' ? 113.1 * (1 - state.progress) : 113.1)
      if (previousReleases !== state.releases || previousError !== state.error) {
        previousReleases = state.releases; previousError = state.error; const scroll = panel.scrollTop; panel.replaceChildren()
        if (state.error) { const error = document.createElement('p'); error.className = 'claude-update-error'; error.textContent = state.error; panel.appendChild(error) }
        for (const release of state.releases) {
          const article = document.createElement('article'); article.className = 'claude-update-release'
          const header = document.createElement('header'), version = document.createElement('strong'); version.textContent = release.tag_name; header.appendChild(version)
          if (release.tag_name === state.target?.tag_name) { const badge = document.createElement('span'); badge.className = 'claude-update-tag'; badge.textContent = 'Available'; header.appendChild(badge) }
          const date = new Date(release.published_at)
          if (Number.isFinite(date.getTime())) { const time = document.createElement('time'); time.textContent = date.toLocaleDateString('en', { month: 'short', day: 'numeric' }); header.appendChild(time) }
          article.appendChild(header)
          if (release.name && release.name !== release.tag_name) { const title = document.createElement('h3'); title.textContent = release.name; article.appendChild(title) }
          appendUpdateNotes(article, release.body); panel.appendChild(article)
        }
        if (open) activateUpdateImages(panel)
        panel.scrollTop = scroll; position()
      }
    } }
    views.add(view); view.paint()
    return () => { views.delete(view); close(); panelResize.disconnect(); panel.remove(); bridge.remove(); button.remove(); window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key) }
  }
  return {
    capable, state, cache, initialize, firstPage, accept, install, mount,
    queryError(error) { report({ checkFailed: true, reason: error?.message || 'Network error' }) },
    dispose() { disposed = true; token = ''; abort.abort(); for (const timer of timers) clearTimeout(timer); timers.clear() }
  }
}

function ClaudeUpdateRuntime({ updater }) {
  const query = useQuery({
    queryKey: [ID, 'releases', UPDATE_REPO], queryFn: () => updater.firstPage(),
    enabled: updater.capable, staleTime: UPDATE_INTERVAL_MS, refetchInterval: UPDATE_INTERVAL_MS,
    refetchIntervalInBackground: true, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: false,
    initialData: updater.cache || undefined, initialDataUpdatedAt: updater.cache?.checkedAt || 0
  })
  useEffect(() => { void updater.initialize().catch(error => updater.queryError(error)) }, [updater])
  useEffect(() => { if (query.data) updater.accept(query.data) }, [query.data])
  useEffect(() => { if (query.error) updater.queryError(query.error) }, [query.error])
  return null
}
function ClaudeUpdateButton({ updater }) {
  const ref = useRef(null)
  useEffect(() => ref.current ? updater.mount(ref.current) : undefined, [])
  return jsx('span', { ref, style: { display: 'none' } })
}
// END GENERATED UPDATE RUNTIME
// BEGIN GENERATED INBOX RUNTIME
// Vendored QueryObserver from @tanstack/query-core@5.101.2.
// Upstream: https://github.com/TanStack/query (packages/query-core).
// Generated with esbuild@0.28.1, browser IIFE, es2022, minify, no external imports.
// Regenerate explicitly: node scripts/build-updater.mjs --vendor-observer=/path/to/pinned/node_modules/parent
// Normal builds concatenate this checked-in file and require no npm dependencies.
/*
MIT License

Copyright (c) 2021-present Tanner Linsley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// BEGIN PINNED OBSERVER BUNDLE
var ClaudeInboxObserverVendor=(()=>{var I=Object.defineProperty;var st=Object.getOwnPropertyDescriptor;var it=Object.getOwnPropertyNames;var nt=Object.prototype.hasOwnProperty;var ot=(t,e)=>{for(var r in e)I(t,r,{get:e[r],enumerable:!0})},at=(t,e,r,s)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of it(e))!nt.call(t,i)&&i!==r&&I(t,i,{get:()=>e[i],enumerable:!(s=st(e,i))||s.enumerable});return t};var ut=t=>at(I({},"__esModule",{value:!0}),t);var bt={};ot(bt,{QueryObserver:()=>A});var b=class{constructor(){this.listeners=new Set,this.subscribe=this.subscribe.bind(this)}subscribe(t){return this.listeners.add(t),this.onSubscribe(),()=>{this.listeners.delete(t),this.onUnsubscribe()}}hasListeners(){return this.listeners.size>0}onSubscribe(){}onUnsubscribe(){}};var ht=class extends b{#e;#t;#s;constructor(){super(),this.#s=t=>{if(typeof window<"u"&&window.addEventListener){let e=()=>t();return window.addEventListener("visibilitychange",e,!1),()=>{window.removeEventListener("visibilitychange",e)}}}}onSubscribe(){this.#t||this.setEventListener(this.#s)}onUnsubscribe(){this.hasListeners()||(this.#t?.(),this.#t=void 0)}setEventListener(t){this.#s=t,this.#t?.(),this.#t=t(e=>{typeof e=="boolean"?this.setFocused(e):this.onFocus()})}setFocused(t){this.#e!==t&&(this.#e=t,this.onFocus())}onFocus(){let t=this.isFocused();this.listeners.forEach(e=>{e(t)})}isFocused(){return typeof this.#e=="boolean"?this.#e:globalThis.document?.visibilityState!=="hidden"}},_=new ht;var ct={setTimeout:(t,e)=>setTimeout(t,e),clearTimeout:t=>clearTimeout(t),setInterval:(t,e)=>setInterval(t,e),clearInterval:t=>clearInterval(t)},lt=class{#e=ct;#t=!1;setTimeoutProvider(t){this.#e=t}setTimeout(t,e){return this.#e.setTimeout(t,e)}clearTimeout(t){this.#e.clearTimeout(t)}setInterval(t,e){return this.#e.setInterval(t,e)}clearInterval(t){this.#e.clearInterval(t)}},F=new lt;function V(t){setTimeout(t,0)}var $=typeof window>"u"||"Deno"in globalThis;function G(){}function P(t){return typeof t=="number"&&t>=0&&t!==1/0}function W(t,e){return Math.max(t+(e||0)-Date.now(),0)}function g(t,e){return typeof t=="function"?t(e):t}function c(t,e){return typeof t=="function"?t(e):t}var ft=Object.prototype.hasOwnProperty;function J(t,e,r=0){if(t===e)return t;if(r>500)return e;let s=H(t)&&H(e);if(!s&&!(z(t)&&z(e)))return e;let h=(s?t:Object.keys(t)).length,d=s?e:Object.keys(e),n=d.length,u=s?new Array(n):{},v=0;for(let a=0;a<n;a++){let f=s?a:d[a],o=t[f],p=e[f];if(o===p){u[f]=o,(s?a<h:ft.call(t,f))&&v++;continue}if(o===null||p===null||typeof o!="object"||typeof p!="object"){u[f]=p;continue}let S=J(o,p,r+1);u[f]=S,S===o&&v++}return h===n&&v===h?t:u}function E(t,e){if(!e||Object.keys(t).length!==Object.keys(e).length)return!1;for(let r in t)if(t[r]!==e[r])return!1;return!0}function H(t){return Array.isArray(t)&&t.length===Object.keys(t).length}function z(t){if(!B(t))return!1;let e=t.constructor;if(e===void 0)return!0;let r=e.prototype;return!(!B(r)||!r.hasOwnProperty("isPrototypeOf")||Object.getPrototypeOf(t)!==Object.prototype)}function B(t){return Object.prototype.toString.call(t)==="[object Object]"}function Q(t,e,r){return typeof r.structuralSharing=="function"?r.structuralSharing(t,e):r.structuralSharing!==!1?J(t,e):e}var U=(()=>{let t=()=>$;return{isServer(){return t()},setIsServer(e){t=e}}})();function x(){let t,e,r=new Promise((i,h)=>{t=i,e=h});r.status="pending",r.catch(()=>{});function s(i){Object.assign(r,i),delete r.resolve,delete r.reject}return r.resolve=i=>{s({status:"fulfilled",value:i}),t(i)},r.reject=i=>{s({status:"rejected",reason:i}),e(i)},r}var dt=V;function pt(){let t=[],e=0,r=n=>{n()},s=n=>{n()},i=dt,h=n=>{e?t.push(n):i(()=>{r(n)})},d=()=>{let n=t;t=[],n.length&&i(()=>{s(()=>{n.forEach(u=>{r(u)})})})};return{batch:n=>{let u;e++;try{u=n()}finally{e--,e||d()}return u},batchCalls:n=>(...u)=>{h(()=>{n(...u)})},schedule:h,setNotifyFunction:n=>{r=n},setBatchNotifyFunction:n=>{s=n},setScheduler:n=>{i=n}}}var Z=pt();var yt=class extends b{#e=!0;#t;#s;constructor(){super(),this.#s=t=>{if(typeof window<"u"&&window.addEventListener){let e=()=>t(!0),r=()=>t(!1);return window.addEventListener("online",e,!1),window.addEventListener("offline",r,!1),()=>{window.removeEventListener("online",e),window.removeEventListener("offline",r)}}}}onSubscribe(){this.#t||this.setEventListener(this.#s)}onUnsubscribe(){this.hasListeners()||(this.#t?.(),this.#t=void 0)}setEventListener(t){this.#s=t,this.#t?.(),this.#t=t(this.setOnline.bind(this))}setOnline(t){this.#e!==t&&(this.#e=t,this.listeners.forEach(r=>{r(t)}))}isOnline(){return this.#e}},X=new yt;function Y(t){return(t??"online")==="online"?X.isOnline():!0}function tt(t,e){return{fetchFailureCount:0,fetchFailureReason:null,fetchStatus:Y(e.networkMode)?"fetching":"paused",...t===void 0&&{error:null,status:"pending"}}}var A=class extends b{constructor(t,e){super(),this.options=e,this.#e=t,this.#n=null,this.#i=x(),this.bindMethods(),this.setOptions(e)}#e;#t=void 0;#s=void 0;#r=void 0;#a;#l;#i;#n;#y;#f;#d;#u;#h;#o;#p=new Set;bindMethods(){this.refetch=this.refetch.bind(this)}onSubscribe(){this.listeners.size===1&&(this.#t.addObserver(this),et(this.#t,this.options)?this.#c():this.updateResult(),this.#g())}onUnsubscribe(){this.hasListeners()||this.destroy()}shouldFetchOnReconnect(){return k(this.#t,this.options,this.options.refetchOnReconnect)}shouldFetchOnWindowFocus(){return k(this.#t,this.options,this.options.refetchOnWindowFocus)}destroy(){this.listeners=new Set,this.#S(),this.#O(),this.#t.removeObserver(this)}setOptions(t){let e=this.options,r=this.#t;if(this.options=this.#e.defaultQueryOptions(t),this.options.enabled!==void 0&&typeof this.options.enabled!="boolean"&&typeof this.options.enabled!="function"&&typeof c(this.options.enabled,this.#t)!="boolean")throw new Error("Expected enabled to be a boolean or a callback that returns a boolean");this.#F(),this.#t.setOptions(this.options),e._defaulted&&!E(this.options,e)&&this.#e.getQueryCache().notify({type:"observerOptionsUpdated",query:this.#t,observer:this});let s=this.hasListeners();s&&rt(this.#t,r,this.options,e)&&this.#c(),this.updateResult(),s&&(this.#t!==r||c(this.options.enabled,this.#t)!==c(e.enabled,this.#t)||g(this.options.staleTime,this.#t)!==g(e.staleTime,this.#t))&&this.#m();let i=this.#v();s&&(this.#t!==r||c(this.options.enabled,this.#t)!==c(e.enabled,this.#t)||i!==this.#o)&&this.#b(i)}getOptimisticResult(t){let e=this.#e.getQueryCache().build(this.#e,t),r=this.createResult(e,t);return vt(this,r)&&(this.#r=r,this.#l=this.options,this.#a=this.#t.state),r}getCurrentResult(){return this.#r}trackResult(t,e){return new Proxy(t,{get:(r,s)=>(this.trackProp(s),e?.(s),s==="promise"&&(this.trackProp("data"),!this.options.experimental_prefetchInRender&&this.#i.status==="pending"&&this.#i.reject(new Error("experimental_prefetchInRender feature flag is not enabled"))),Reflect.get(r,s))})}trackProp(t){this.#p.add(t)}getCurrentQuery(){return this.#t}refetch({...t}={}){return this.fetch({...t})}fetchOptimistic(t){let e=this.#e.defaultQueryOptions(t),r=this.#e.getQueryCache().build(this.#e,e);return r.fetch().then(()=>this.createResult(r,e))}fetch(t){return this.#c({...t,cancelRefetch:t.cancelRefetch??!0}).then(()=>(this.updateResult(),this.#r))}#c(t){this.#F();let e=this.#t.fetch(this.options,t);return t?.throwOnError||(e=e.catch(G)),e}#m(){this.#S();let t=g(this.options.staleTime,this.#t);if(U.isServer()||this.#r.isStale||!P(t))return;let r=W(this.#r.dataUpdatedAt,t)+1;this.#u=F.setTimeout(()=>{this.#r.isStale||this.updateResult()},r)}#v(){return(typeof this.options.refetchInterval=="function"?this.options.refetchInterval(this.#t):this.options.refetchInterval)??!1}#b(t){this.#O(),this.#o=t,!(U.isServer()||c(this.options.enabled,this.#t)===!1||!P(this.#o)||this.#o===0)&&(this.#h=F.setInterval(()=>{(this.options.refetchIntervalInBackground||_.isFocused())&&this.#c()},this.#o))}#g(){this.#m(),this.#b(this.#v())}#S(){this.#u!==void 0&&(F.clearTimeout(this.#u),this.#u=void 0)}#O(){this.#h!==void 0&&(F.clearInterval(this.#h),this.#h=void 0)}createResult(t,e){let r=this.#t,s=this.options,i=this.#r,h=this.#a,d=this.#l,u=t!==r?t.state:this.#s,{state:v}=t,a={...v},f=!1,o;if(e._optimisticResults){let l=this.hasListeners(),O=!l&&et(t,e),w=l&&rt(t,r,e,s);(O||w)&&(a={...a,...tt(v.data,t.options)}),e._optimisticResults==="isRestoring"&&(a.fetchStatus="idle")}let{error:p,errorUpdatedAt:S,status:m}=a;o=a.data;let q=!1;if(e.placeholderData!==void 0&&o===void 0&&m==="pending"){let l;i?.isPlaceholderData&&e.placeholderData===d?.placeholderData?(l=i.data,q=!0):l=typeof e.placeholderData=="function"?e.placeholderData(this.#d?.state.data,this.#d):e.placeholderData,l!==void 0&&(m="success",o=Q(i?.data,l,e),f=!0)}if(e.select&&o!==void 0&&!q)if(i&&o===h?.data&&e.select===this.#y)o=this.#f;else try{this.#y=e.select,o=e.select(o),o=Q(i?.data,o,e),this.#f=o,this.#n=null}catch(l){this.#n=l}this.#n&&(p=this.#n,o=this.#f,S=Date.now(),m="error");let D=a.fetchStatus==="fetching",T=m==="pending",M=m==="error",L=T&&D,N=o!==void 0,y={status:m,fetchStatus:a.fetchStatus,isPending:T,isSuccess:m==="success",isError:M,isInitialLoading:L,isLoading:L,data:o,dataUpdatedAt:a.dataUpdatedAt,error:p,errorUpdatedAt:S,failureCount:a.fetchFailureCount,failureReason:a.fetchFailureReason,errorUpdateCount:a.errorUpdateCount,isFetched:t.isFetched(),isFetchedAfterMount:a.dataUpdateCount>u.dataUpdateCount||a.errorUpdateCount>u.errorUpdateCount,isFetching:D,isRefetching:D&&!T,isLoadingError:M&&!N,isPaused:a.fetchStatus==="paused",isPlaceholderData:f,isRefetchError:M&&N,isStale:j(t,e),refetch:this.refetch,promise:this.#i,isEnabled:c(e.enabled,t)!==!1};if(this.options.experimental_prefetchInRender){let l=y.data!==void 0,O=y.status==="error"&&!l,w=R=>{O?R.reject(y.error):l&&R.resolve(y.data)},K=()=>{let R=this.#i=y.promise=x();w(R)},C=this.#i;switch(C.status){case"pending":t.queryHash===r.queryHash&&w(C);break;case"fulfilled":(O||y.data!==C.value)&&K();break;case"rejected":(!O||y.error!==C.reason)&&K();break}}return y}updateResult(){let t=this.#r,e=this.createResult(this.#t,this.options);if(this.#a=this.#t.state,this.#l=this.options,this.#a.data!==void 0&&(this.#d=this.#t),E(e,t))return;this.#r=e;let r=()=>{if(!t)return!0;let{notifyOnChangeProps:s}=this.options,i=typeof s=="function"?s():s;if(i==="all"||!i&&!this.#p.size)return!0;let h=new Set(i??this.#p);return this.options.throwOnError&&h.add("error"),Object.keys(this.#r).some(d=>{let n=d;return this.#r[n]!==t[n]&&h.has(n)})};this.#w({listeners:r()})}#F(){let t=this.#e.getQueryCache().build(this.#e,this.options);if(t===this.#t)return;let e=this.#t;this.#t=t,this.#s=t.state,this.hasListeners()&&(e?.removeObserver(this),t.addObserver(this))}onQueryUpdate(){this.updateResult(),this.hasListeners()&&this.#g()}#w(t){Z.batch(()=>{t.listeners&&this.listeners.forEach(e=>{e(this.#r)}),this.#e.getQueryCache().notify({query:this.#t,type:"observerResultsUpdated"})})}};function mt(t,e){return c(e.enabled,t)!==!1&&t.state.data===void 0&&!(t.state.status==="error"&&c(e.retryOnMount,t)===!1)}function et(t,e){return mt(t,e)||t.state.data!==void 0&&k(t,e,e.refetchOnMount)}function k(t,e,r){if(c(e.enabled,t)!==!1&&g(e.staleTime,t)!=="static"){let s=typeof r=="function"?r(t):r;return s==="always"||s!==!1&&j(t,e)}return!1}function rt(t,e,r,s){return(t!==e||c(s.enabled,t)===!1)&&(!r.suspense||t.state.status!=="error")&&j(t,r)}function j(t,e){return c(e.enabled,t)!==!1&&t.isStaleByTime(g(e.staleTime,t))}function vt(t,e){return!E(t.getCurrentResult(),e)}return ut(bt);})();


// The native bridge reads metadata only. The existing React Query client owns
// refresh, deduplication and cancellation across renderer/plugin lifetimes.
const INBOX_MODE_KEY = 'inbox'
const INBOX_MODE_EVENT = `${ID}:inbox-mode`
const INBOX_ROWS_EVENT = `${ID}:inbox-rows`

function readClaudeInboxMode() {
  try { return pluginStorage?.get(INBOX_MODE_KEY, 'off') === 'on' ? 'on' : 'off' }
  catch { return 'off' }
}

function setClaudeInboxMode(mode, inbox) {
  const next = mode === 'off' ? 'off' : 'on'
  try {
    pluginStorage?.set(INBOX_MODE_KEY, next)
    if (pluginStorage?.get(INBOX_MODE_KEY, null) !== next) throw new Error('Inbox setting was not saved.')
  }
  catch {
    host.notify?.({ kind: 'error', message: 'Could not save the Inbox setting.' })
    return readClaudeInboxMode()
  }
  inbox?.setMode(next === 'on')
  globalThis.window?.dispatchEvent?.(new CustomEvent(INBOX_MODE_EVENT, { detail: next }))
  return next
}

function inboxGatewayScope() {
  return {
    connectionId: String(host.state.connectionId?.get?.() || host.activeConnectionId?.() || ''),
    profile: String(host.state.profile?.get?.() || 'default')
  }
}

function inboxOwnerScope() {
  return claudeInboxFocusedThread()?.scope || inboxGatewayScope()
}

function sameInboxScope(left, right) {
  return left.connectionId === right.connectionId && left.profile === right.profile
}

async function readClaudeInboxRowOwner(scope) {
  // Route inventory alone can hide failed source enumerations. Require the
  // credential-free roster's complete source status for an id-only row slot.
  if (typeof window.hermesDesktop?.getAgentRoster !== 'function') return null
  try {
    const roster = await window.hermesDesktop.getAgentRoster()
    const sources = roster?.sources
    if (!Array.isArray(sources) || sources.length !== 1 || sources[0]?.reachable !== true || sources[0]?.error || sources[0]?.needsSignIn || sources[0]?.connectionId !== scope.connectionId) return null
    const routes = roster.agents
    if (!Array.isArray(routes) || !routes.length || routes.some(route =>
      typeof route?.connectionId !== 'string' || !route.connectionId || typeof route.profile !== 'string' || !route.profile)) return null
    const owners = new Map(routes.map(route => [JSON.stringify([route.connectionId, route.profile]), route]))
    const owner = owners.size === 1 ? [...owners.values()][0] : null
    return owner && sameInboxScope(owner, scope) ? { ...scope } : null
  } catch { return null }
}

function claudeInboxBadgeScope(inbox, sessionId, currentScope) {
  const evidence = inbox?.rowOwnerEvidence
  return evidence?.scope && sameInboxScope(evidence.scope, currentScope) && evidence.ids.includes(sessionId)
    ? evidence.scope : null
}

function claudeInboxFocusedThread() {
  const owner = host.state.focusedSessionOwner?.get?.()
  const id = host.state.focusedStoredSessionId?.get?.()
  return typeof id === 'string' && id && typeof owner?.connectionId === 'string' && owner.connectionId && typeof owner.profile === 'string' && owner.profile
    ? { id, scope: { connectionId: owner.connectionId, profile: owner.profile } } : null
}

function claudeInboxLiveFocus() {
  const thread = claudeInboxFocusedThread(), runtimeId = host.state.focusedSessionId?.get?.()
  return thread && typeof runtimeId === 'string' && runtimeId ? { ...thread.scope, runtimeId, storedId: thread.id } : null
}

function claudeInboxLiveStoredIds(row) {
  const values = [row.session_key, row.stored_session_id]
  if (values.some(id => id != null && typeof id !== 'string')) return []
  return [...new Set(values.filter(id => typeof id === 'string' && id))]
}

function claudeInboxLiveStoredMatch(storedId, row, metadata) {
  const stored = claudeInboxLiveStoredIds(row)
  if (!stored.length) return false
  const touched = metadata.filter(session => {
    const ids = [session.id, session._lineage_root_id, ...(session._lineage_ids || [])]
    return stored.some(id => ids.includes(id))
  })
  const roots = new Set(touched.map(session => session._lineage_root_id || session.id))
  if (!touched.length) return stored.length === 1 && stored[0] === storedId
  return roots.size === 1 && touched.some(session => {
    const ids = [session.id, session._lineage_root_id, ...(session._lineage_ids || [])]
    return ids.includes(storedId) && stored.every(id => ids.includes(id))
  })
}

function claudeInboxUniqueLiveRow(runtimeId, rows) {
  if (typeof runtimeId !== 'string' || !runtimeId) return null
  const matching = rows.filter(row => row && [row.id, row.session_id].includes(runtimeId))
  const row = matching.length === 1 ? matching[0] : null
  return row && (!row.id || !row.session_id || row.id === row.session_id) ? row : null
}

function claudeInboxCanonicalRuntime(scope, targetProfile, runtimeId, rawRows, metadata, owners) {
  if (typeof runtimeId !== 'string' || !runtimeId) return null
  const rows = rawRows.filter(row => row && [row.id, row.session_id].includes(runtimeId))
  const row = claudeInboxUniqueLiveRow(runtimeId, rawRows), proof = owners.get(JSON.stringify([scope.connectionId, runtimeId]))
  if (rows.length && !row) return null
  if (proof && (proof.conflicted || !sameInboxScope(proof, scope))) return null
  if (row && (row.connection_id && row.connection_id !== scope.connectionId || row.profile && row.profile !== targetProfile)) return null
  if (!proof && (!row || row.profile !== targetProfile)) return null
  const stored = row ? claudeInboxLiveStoredIds(row) : []
  if (row && (!stored.length || !stored.every(id => claudeInboxLiveStoredMatch(id, row, metadata)))) return null
  const candidates = new Set(metadata.filter(session => {
    const ids = [session.id, session._lineage_root_id, ...(session._lineage_ids || [])]
    return (!proof || ids.includes(proof.storedId)) && stored.every(id => ids.includes(id))
  }).map(session => session._lineage_root_id || session.id))
  return candidates.size === 1 ? [...candidates][0] : null
}

function resolveClaudeInboxLiveSessions(scope, targetProfile, rawRows, metadata, owners) {
  const liveSessions = [], unresolved = new Set()
  let liveStatusKnown = true
  for (const row of rawRows) {
    if (!row || typeof row !== 'object') { liveStatusKnown = false; continue }
    if (row.connection_id && row.connection_id !== scope.connectionId) continue
    if (row.profile && row.profile !== targetProfile) continue
    const runtimeId = row.session_id || row.id
    const ids = claudeInboxLiveStoredIds(row)
    const canonicalId = claudeInboxCanonicalRuntime(scope, targetProfile, runtimeId, rawRows, metadata, owners)
    if (canonicalId) {
      const session = metadata.find(session => (session._lineage_root_id || session.id) === canonicalId)
      liveSessions.push({ ...row, session_key: session.id, stored_session_id: session.id, profile: scope.profile, connection_id: scope.connectionId, _claudeInboxCanonicalId: canonicalId })
    } else {
      if (!ids.length) liveStatusKnown = false
      ids.forEach(id => unresolved.add(id))
    }
  }
  for (const session of metadata) {
    const ids = [session.id, session._lineage_root_id, ...(session._lineage_ids || [])]
    if (!ids.some(id => unresolved.has(id))) continue
    if (liveSessions.some(row => claudeInboxLiveStoredIds(row).some(id => ids.includes(id)))) continue
    // This guards a known durable row. Never give an unowned runtime an alias
    // into this profile or use its activity as an admission/completion signal.
    liveSessions.push({ id: session.id, session_key: session.id, _claudeInboxCanonicalId: session._lineage_root_id || session.id, status: 'unknown', profile: scope.profile, connection_id: scope.connectionId })
  }
  return { liveSessions, liveStatusKnown }
}


async function readClaudeInboxLiveIdentity(read, row) {
  try {
    const result = await read(row.session_id || row.id)
    const lines = typeof result?.output === 'string' ? result.output.split('\n') : []
    // The native status header is producer-owned. Never search titles or
    // trailing text for a path that could impersonate a profile identity.
    if (lines[0] !== 'Hermes TUI Status' || lines[1] !== '' ||
        !lines[2]?.startsWith('Session ID: ') || !lines[3]?.startsWith('Path: ')) return null
    const storedId = lines[2].slice(12), home = lines[3].slice(6)
    return storedId && home && claudeInboxLiveStoredIds(row).includes(storedId) ? { storedId, home } : null
  } catch { return null }
}

async function proveClaudeInboxBackgroundOwners(scope, targetProfile, rows, metadata, owners, focus, read, stillCurrent) {
  const focusKey = focus && JSON.stringify([scope.connectionId, focus.runtimeId])
  const anchor = focusKey && owners.get(focusKey)
  if (!anchor || anchor.conflicted || !sameInboxScope(anchor, scope) || !stillCurrent()) return
  const focusedRow = claudeInboxUniqueLiveRow(focus.runtimeId, rows)
  if (!focusedRow || focusedRow.profile && focusedRow.profile !== targetProfile ||
      focusedRow.connection_id && focusedRow.connection_id !== scope.connectionId ||
      !metadata.some(session => claudeInboxLiveStoredMatch(session.id, focusedRow, metadata)) ||
      !claudeInboxLiveStoredMatch(focus.storedId, focusedRow, metadata) ||
      !claudeInboxLiveStoredMatch(anchor.storedId, focusedRow, metadata)) return
  let home = anchor.home
  if (!home) {
    const identity = await readClaudeInboxLiveIdentity(read, focusedRow)
    if (!identity || !stillCurrent() || JSON.stringify(claudeInboxLiveFocus()) !== JSON.stringify(focus)) return
    home = identity.home
    owners.set(focusKey, { ...anchor, home })
  }
  // A home shared by contradictory owner proofs cannot certify either owner.
  if ([...owners.values()].some(proof => proof.home === home && (proof.conflicted || !sameInboxScope(proof, scope)))) return
  const candidates = rows.filter(row => {
    if (!row || row.profile || row.connection_id && row.connection_id !== scope.connectionId) return false
    const runtimeId = row.session_id || row.id
    if (!runtimeId || owners.has(JSON.stringify([scope.connectionId, runtimeId]))) return false
    if (claudeInboxUniqueLiveRow(runtimeId, rows) !== row) return false
    return metadata.some(session => claudeInboxLiveStoredMatch(session.id, row, metadata))
  })
  for (let offset = 0; offset < candidates.length; offset += 4) {
    const batch = await Promise.all(candidates.slice(offset, offset + 4).map(async row => ({ row, identity: await readClaudeInboxLiveIdentity(read, row) })))
    if (!stillCurrent() || JSON.stringify(claudeInboxLiveFocus()) !== JSON.stringify(focus)) return
    for (const { row, identity } of batch) {
      if (identity?.home !== home) continue
      owners.set(JSON.stringify([scope.connectionId, row.session_id || row.id]), {
        ...scope, runtimeId: row.session_id || row.id, storedId: identity.storedId, home
      })
    }
  }
}

async function readClaudeInboxChildSnapshots(scope, liveSessions, read, stillCurrent) {
  const byThread = new Map(), unknown = new Set()
  const rows = liveSessions.filter(row => row._claudeInboxCanonicalId && row.status !== 'unknown')
  const at = Date.now()
  for (let offset = 0; offset < rows.length; offset += 4) {
    const batch = await Promise.all(rows.slice(offset, offset + 4).map(async row => {
      try {
        const result = await read(row.session_id || row.id)
        if (!Array.isArray(result?.subagents) || result.subagents.some(child =>
          typeof child?.subagent_id !== 'string' || !child.subagent_id || typeof child.status !== 'string')) return { row, valid: false }
        return { row, valid: true, ids: result.subagents.filter(child => ['running', 'pending', 'queued'].includes(child.status)).map(child => child.subagent_id) }
      } catch { return { row, valid: false } }
    }))
    if (!stillCurrent()) throw new Error('Inbox child snapshot lost its owner.')
    for (const result of batch) {
      const id = result.row._claudeInboxCanonicalId
      if (!result.valid) { unknown.add(id); continue }
      if (!byThread.has(id)) byThread.set(id, new Set())
      result.ids.forEach(child => byThread.get(id).add(child))
    }
  }
  return {
    childSnapshots: [...byThread].filter(([id]) => !unknown.has(id)).map(([session_id, ids]) => ({ session_id, childIds: [...ids], at })),
    childUnknownSessionIds: [...unknown]
  }
}

async function readClaudeInboxPage(scope, pageCount, signal, inbox, liveOwners = new Map(), onMetadata = () => {}, nominations = () => []) {
  const bridge = globalThis.window?.hermesDesktop
  if (typeof bridge?.api !== 'function') throw new Error('Inbox requires the Desktop session API.')
  const focusedBefore = claudeInboxLiveFocus()
  const sessions = new Map()
  let offset = 0, total = 0
  let targetProfile = scope.profile
  for (let page = 0; page < pageCount; page++) {
    if (signal?.aborted || !sameInboxScope(scope, inboxOwnerScope())) throw new Error('Inbox scope changed.')
    const params = new URLSearchParams({
      limit: '100', offset: String(offset), min_messages: '1',
      archived: 'exclude', order: 'recent', profile: scope.profile
    })
    const data = await bridge.api({
      ...(scope.connectionId ? { connectionId: scope.connectionId } : {}),
      profile: scope.profile,
      path: `/api/sessions?${params}`, timeoutMs: 60_000
    })
    if (signal?.aborted || !sameInboxScope(scope, inboxOwnerScope())) throw new Error('Inbox scope changed.')
    if (!Array.isArray(data?.sessions) || !Number.isFinite(data.total) || data.total < 0) {
      throw new Error('Inbox received an incomplete session list.')
    }
    if (targetProfile === scope.profile && data.sessions.some(session => session.profile && session.profile !== scope.profile) && host.profileRoutes) {
      const routes = await host.profileRoutes()
      const matches = routes.filter(route => sameInboxScope(route, scope))
      if (matches.length === 1 && typeof matches[0].targetProfile === 'string' && matches[0].targetProfile) targetProfile = matches[0].targetProfile
      if (signal?.aborted || !sameInboxScope(scope, inboxOwnerScope())) throw new Error('Inbox scope changed.')
    }
    if (data.errors?.length || data.storage?.[targetProfile] === 'corrupt') {
      throw new Error('The session list could not be read completely.')
    }
    total = data.total
    for (const session of data.sessions) {
      // A scoped response may still contain a carried row from another owner.
      if (session.profile && session.profile !== targetProfile) continue
      if (session.connection_id && session.connection_id !== scope.connectionId) continue
      if (session.hidden || session.archived || !session.id) continue
      const durable = session._lineage_root_id || session.id
      const previous = sessions.get(durable)
      if (!previous || (session.last_active || 0) > (previous.last_active || 0)) sessions.set(durable, { ...session, profile: scope.profile })
    }
    // Pinned backfills can exceed the requested page. They must not advance
    // the database offset past conversations we have not fetched.
    offset += 100
    if (offset >= total) break
    if (!data.sessions.length) throw new Error('Inbox pagination stopped before the end of the session list.')
  }
  // Only known attention is fetched beyond the recent metadata page. Removing
  // manual history pagination must not truncate admitted or reopened threads.
  const explicitRequestedIds = [...new Set([
    ...(inbox?.admission?.explicitSessionIds?.(scope) || []),
    ...(inbox?.admission?.admittedSessionIds?.(scope) || [])
  ])].filter(id => !inbox.model.isSettled(scope, id) && !inbox.model.isSnoozed(scope, id))
  // Discover a just-started old thread even if it is settled and still outside
  // the recent page. Discovery alone carries no attention authority.
  const pendingWorkIds = inbox?.pendingWorkSessionIds?.(scope) || []
  const listedIds = new Set([...sessions.values()].flatMap(row => [row.id, row._lineage_root_id, ...(row._lineage_ids || [])].filter(Boolean)))
  const nominatedIds = nominations().filter(focus => sameInboxScope(focus, scope)).map(focus => focus.storedId)
  const missing = [...new Set([...explicitRequestedIds, ...pendingWorkIds, ...nominatedIds])].filter(id => !listedIds.has(id))
  for (let index = 0; index < missing.length; index += 4) {
    const rows = await Promise.all(missing.slice(index, index + 4).map(async id => {
      try {
        return await readClaudeInboxOpenedSession({ id, scope }, {
          followLineage: true,
          stillCurrent: () => !signal?.aborted && sameInboxScope(scope, inboxOwnerScope())
        })
      } catch (error) {
        if (isClaudeInboxSessionNotFound(error)) return null
        throw error
      }
    }))
    for (const row of rows) {
      if (row && !row.archived && !row.hidden) sessions.set(row._lineage_root_id || row.id, row)
    }
  }
  // Paint the owner-scoped list without waiting for activity/roster round trips.
  // This stage deliberately carries no authority for activity or Settle.
  onMetadata({ sessions: [...sessions.values()], explicitRequestedIds, hasMore: offset < total })
  let liveSessions = [], rawLiveSessions = [], liveStatusKnown = false, liveReadSucceeded = false, liveStatusAt = 0
  let childSnapshots = [], childUnknownSessionIds = []
  try {
    if (!sameInboxScope(scope, inboxOwnerScope())) throw new Error('Inbox scope changed.')
    let live, readIdentity, readChildren
    if (typeof host.requestProfile === 'function' && typeof host.profileRoutes === 'function') {
      const routes = (await host.profileRoutes()).filter(route => sameInboxScope(route, scope))
      if (routes.length !== 1 || signal?.aborted || !sameInboxScope(scope, inboxOwnerScope())) throw new Error('Inbox live owner could not be verified.')
      if (typeof routes[0].targetProfile === 'string' && routes[0].targetProfile) targetProfile = routes[0].targetProfile
      liveStatusAt = Date.now()
      live = await host.requestProfile(routes[0], 'session.active_list', { profile: targetProfile })
      readIdentity = sessionId => host.requestProfile(routes[0], 'session.status', { session_id: sessionId })
      readChildren = sessionId => host.requestProfile(routes[0], 'subagent.list', { session_id: sessionId })
    } else {
      // A legacy ambient request is safe only for the gateway it actually uses.
      if (!sameInboxScope(scope, inboxGatewayScope())) throw new Error('Inbox requires explicit live-owner routing.')
      liveStatusAt = Date.now()
      live = await host.request('session.active_list', { profile: targetProfile })
      readIdentity = sessionId => host.request('session.status', { session_id: sessionId })
      readChildren = sessionId => host.request('subagent.list', { session_id: sessionId })
    }
    if (Array.isArray(live?.sessions)) {
      liveReadSucceeded = true
      // Keep only identity/status metadata, not another profile's preview text.
      const fields = ['id', 'session_id', 'session_key', 'stored_session_id', 'profile', 'connection_id', 'status', 'state', 'busy']
      rawLiveSessions = live.sessions.map(row => row && typeof row === 'object'
        ? Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]])) : null)
      const focusedAfter = claudeInboxLiveFocus(), metadata = [...sessions.values()]
      const stableFocus = focusedBefore && JSON.stringify(focusedBefore) === JSON.stringify(focusedAfter) ? [focusedBefore] : []
      // Departure preserves a nomination, not authority. The owner-routed
      // durable row and exactly one matching live runtime must validate it.
      for (const focus of [...stableFocus, ...nominations()]) {
        if (!sameInboxScope(focus, scope)) continue
        const row = claudeInboxUniqueLiveRow(focus.runtimeId, rawLiveSessions)
        if (!row || row.profile && row.profile !== targetProfile || row.connection_id && row.connection_id !== scope.connectionId ||
            !metadata.some(session => [session.id, session._lineage_root_id, ...(session._lineage_ids || [])].includes(focus.storedId)) ||
            !claudeInboxLiveStoredMatch(focus.storedId, row, metadata)) continue
        const key = JSON.stringify([scope.connectionId, focus.runtimeId]), previous = liveOwners.get(key)
        const conflict = previous && (previous.conflicted || previous.profile !== focus.profile ||
          !claudeInboxLiveStoredMatch(previous.storedId, row, metadata))
        liveOwners.set(key, conflict ? { ...previous, conflicted: true } : focus)
        if (!conflict && typeof previous?.home === 'string' && previous.home && sameInboxScope(previous, focus)) {
          liveOwners.set(key, { ...focus, home: previous.home })
        }
      }
      if (stableFocus.length && sameInboxScope(focusedBefore, scope)) {
        await proveClaudeInboxBackgroundOwners(scope, targetProfile, rawLiveSessions, metadata, liveOwners, focusedBefore, readIdentity,
          () => !signal?.aborted && sameInboxScope(scope, inboxOwnerScope()))
      }
      ;({ liveSessions, liveStatusKnown } = resolveClaudeInboxLiveSessions(scope, targetProfile, rawLiveSessions, metadata, liveOwners))
      // A send can start before SQLite moves the old thread into the recent
      // page. Backfill only positively owned work, never unowned runtime IDs.
      const knownIds = new Set(metadata.flatMap(row => [row.id, row._lineage_root_id, ...(row._lineage_ids || [])].filter(Boolean)))
      // Qualified producer rows can discover missing metadata, but receive no
      // canonical activity authority until that exact-owner metadata is read.
      const discovery = rawLiveSessions.filter(row => row && row.profile === targetProfile &&
        (!row.connection_id || row.connection_id === scope.connectionId) &&
        claudeInboxUniqueLiveRow(row.session_id || row.id, rawLiveSessions) === row &&
        new Set(claudeInboxLiveStoredIds(row)).size === 1)
      const workingIds = [...new Set([...liveSessions, ...discovery].filter(row => claudeInboxWorkStatus(row) === 'work')
        .flatMap(claudeInboxLiveStoredIds))].filter(id => !knownIds.has(id))
      for (let index = 0; index < workingIds.length; index += 4) {
        const rows = await Promise.all(workingIds.slice(index, index + 4).map(async id => {
          try {
            return await readClaudeInboxOpenedSession({ id, scope }, {
              stillCurrent: () => !signal?.aborted && sameInboxScope(scope, inboxOwnerScope())
            })
          } catch (error) {
            if (isClaudeInboxSessionNotFound(error)) return null
            throw error
          }
        }))
        for (const row of rows) if (row && !row.hidden && !row.archived) sessions.set(row._lineage_root_id || row.id, row)
      }
      if (workingIds.length) {
        ;({ liveSessions, liveStatusKnown } = resolveClaudeInboxLiveSessions(scope, targetProfile, rawLiveSessions, [...sessions.values()], liveOwners))
      }
      ;({ childSnapshots, childUnknownSessionIds } = await readClaudeInboxChildSnapshots(scope, liveSessions, readChildren,
        () => !signal?.aborted && sameInboxScope(scope, inboxOwnerScope())))
    }
  } catch {
    // A partial live read or failed work backfill must not authorize Settle.
    liveSessions = []; rawLiveSessions = []; childSnapshots = []; childUnknownSessionIds = []; liveStatusKnown = false; liveReadSucceeded = false
  }
  if (signal?.aborted || !sameInboxScope(scope, inboxOwnerScope())) throw new Error('Inbox scope changed.')
  const rowOwnerScope = await readClaudeInboxRowOwner(scope)
  if (signal?.aborted || !sameInboxScope(scope, inboxOwnerScope())) throw new Error('Inbox scope changed.')
  return { sessions: [...sessions.values()], liveSessions, rawLiveSessions, childSnapshots, childUnknownSessionIds, targetProfile, liveStatusKnown, liveReadSucceeded, liveStatusAt, rowOwnerScope, explicitRequestedIds, hasMore: offset < total }
}

function startClaudeInboxObserver(ctx, inbox) {
  // A data service must not inherit the mount lifetime of optional UI chrome.
  // The vendored observer uses the SDK's cache, never a plugin-owned client.
  if (!inbox) return () => {}
  let scope = inboxOwnerScope(), pageCount = 1, mode = readClaudeInboxMode(), disposed = false
  const liveOwners = new Map()
  const nominatedFocus = new Map()
  const pendingEvents = []
  let refreshVersion = 0, refreshing = false
  let lastFocus = JSON.stringify(claudeInboxLiveFocus()), lastBusy = new Set()
  let metadataPreview = null
  let liveAuthority = Symbol('Inbox live connection')
  const nominations = () => {
    for (const [key, item] of nominatedFocus) if (Date.now() - item.at > 10_000) nominatedFocus.delete(key)
    return [...nominatedFocus.values()].map(item => item.focus)
  }
  const rememberFocus = () => {
    const focus = claudeInboxLiveFocus()
    const connected = !sameInboxScope(scope, inboxGatewayScope()) || !host.state.gateway || host.state.gateway.get() === 'open'
    if (disposed || mode !== 'on' || !connected || !focus || !sameInboxScope(focus, scope)) return
    nominations()
    const key = JSON.stringify(focus)
    nominatedFocus.delete(key)
    nominatedFocus.set(key, { focus, at: Date.now() })
    if (nominatedFocus.size > 64) nominatedFocus.delete(nominatedFocus.keys().next().value)
  }
  const options = () => {
    const owner = { ...scope }, pages = pageCount
    return {
      queryKey: [ID, 'inbox', owner.connectionId, owner.profile, pages],
      queryFn: async ({ signal }) => {
        const authority = liveAuthority, proofs = new Map(liveOwners)
        rememberFocus()
        const data = await readClaudeInboxPage(owner, pages, signal, inbox, proofs, metadata => {
          if (disposed || signal.aborted || authority !== liveAuthority || mode !== 'on' || !sameInboxScope(owner, inboxOwnerScope())) return
          metadataPreview = metadata
          project()
        }, nominations)
        // In-flight reads and native cache hits cannot carry authority across
        // a disconnect or a new plugin lifetime. Stage owner proofs likewise.
        const connected = !sameInboxScope(owner, inboxGatewayScope()) ||
          !host.state.gateway || host.state.gateway.get() === 'open'
        const current = !disposed && authority === liveAuthority && connected && !signal.aborted
        if (current && data.liveReadSucceeded) {
          for (const [key, proof] of proofs) liveOwners.set(key, proof)
        }
        if (current) metadataPreview = null
        return { ...data, _claudeInboxLiveAuthority: current && data.liveReadSucceeded ? authority : null }
      },
      enabled: mode === 'on', staleTime: 10_000,
      refetchInterval: mode === 'on' ? 10_000 : false, retry: 1
    }
  }
  const observer = new ClaudeInboxObserverVendor.QueryObserver(queryClient, options())
  const refreshLiveIdentity = () => {
    // Capture transitions even while an older read awaits proof. A microtask
    // sees only the final focus after a synchronous departure.
    rememberFocus()
    refreshVersion++
    if (refreshing || disposed || mode !== 'on') return
    refreshing = true
    // Atom changes settle together. If an old fetch is already in flight,
    // finish it before requesting proof for the newly focused runtime.
    void Promise.resolve().then(async () => {
      try {
        while (!disposed && mode === 'on') {
          const version = refreshVersion
          rememberFocus()
          if (observer.getCurrentResult().isFetching) await observer.refetch({ cancelRefetch: false })
          if (disposed || mode !== 'on') break
          await observer.refetch()
          if (version === refreshVersion) break
        }
      } finally { refreshing = false }
    })
  }
  const pendingWorkSessionIds = owner => [...new Set(pendingEvents.filter(item => sameInboxScope(item.focus, owner) &&
    Date.now() - item.at <= 10_000).flatMap(item => item.storedIds))]
  inbox.pendingWorkSessionIds = pendingWorkSessionIds
  const markReady = () => {
    const query = observer.getCurrentResult()
    const ready = !disposed && mode === 'on' && sameInboxScope(scope, inboxOwnerScope()) && !query.isPending && !query.error && !!query.data
    const island = globalThis.document?.querySelector?.('[data-claude-inbox-owned="island"]')
    if (island && island.dataset.claudeInboxQueryReady !== String(ready)) island.dataset.claudeInboxQueryReady = String(ready)
  }
  const project = () => {
    if (disposed || !sameInboxScope(scope, inboxOwnerScope())) return
    const query = observer.getCurrentResult(), owner = { ...scope }, snapshot = query.data, data = metadataPreview || snapshot
    // Metadata can arrive before live RPCs. Retain this connection's last
    // proof, but revalidate it against the newest metadata before projecting.
    const authoritative = !query.error && snapshot?._claudeInboxLiveAuthority === liveAuthority
    const live = authoritative && Array.isArray(snapshot?.rawLiveSessions)
      ? resolveClaudeInboxLiveSessions(owner, snapshot.targetProfile, snapshot.rawLiveSessions, data.sessions, liveOwners)
      : { liveSessions: [], liveStatusKnown: false }
    if (authoritative) for (const id of snapshot.childUnknownSessionIds || []) {
      live.liveSessions.push({ id, session_key: id, _claudeInboxCanonicalId: id, profile: owner.profile, connection_id: owner.connectionId, status: 'unknown' })
    }
    const verifiedRows = (live.liveSessions || []).filter(row =>
      row.profile === owner.profile && row.connection_id === owner.connectionId &&
      claudeInboxUniqueLiveRow(row.session_id || row.id, snapshot.rawLiveSessions) && row.status !== 'unknown')
    const childSnapshots = authoritative ? (snapshot.childSnapshots || []).filter(child =>
      verifiedRows.some(row => row._claudeInboxCanonicalId === child.session_id)) : []
    const busy = host.state.busyBySession?.get?.() || {}
    const busyBySession = {}, priority = { idle: 0, reading: 1, unknown: 2, work: 3 }
    for (const row of verifiedRows) {
      const runtimeId = row.session_id || row.id, storedId = row.session_key
      if (!storedId || !Object.hasOwn(busy, runtimeId)) continue
      const value = busy[runtimeId], previous = busyBySession[storedId]
      if (!Object.hasOwn(busyBySession, storedId) ||
          priority[claudeInboxWorkStatus(value)] > priority[claudeInboxWorkStatus(previous)]) busyBySession[storedId] = value
    }
    inbox.setMode(mode === 'on')
    inbox.rowOwnerEvidence = mode === 'on' && authoritative && snapshot?.rowOwnerScope && sameInboxScope(snapshot.rowOwnerScope, owner)
      ? { scope: owner, ids: data.sessions.flatMap(session => [session.id, session._lineage_root_id, ...(session._lineage_ids || [])].filter(Boolean)) }
      : null
    window.dispatchEvent(new CustomEvent(INBOX_ROWS_EVENT))
    inbox.update({
      scope: owner,
      sessions: data?.sessions || [], liveSessions: live?.liveSessions || [],
      liveStatusKnown: authoritative && !!snapshot?.liveStatusKnown && !!live?.liveStatusKnown,
      liveStatusAt: authoritative ? snapshot?.liveStatusAt : undefined,
      childSnapshots,
      // ID-only busy flags borrow only independently verified runtime identity.
      busyBySession,
      busyOwnerKnown: authoritative && !!snapshot?.rowOwnerScope && sameInboxScope(snapshot.rowOwnerScope, owner),
      focusedStoredSessionId: host.state.focusedStoredSessionId?.get?.() || null,
      explicitRequestedIds: data?.explicitRequestedIds,
      loading: !data && (query.isPending || query.isFetching),
      error: query.error ? 'Could not refresh Inbox.' : null,
      hasMore: !!data?.hasMore,
      loadMore: () => {
        if (disposed || mode !== 'on' || !sameInboxScope(owner, scope)) return
        pageCount++
        observer.setOptions(options())
        project()
      },
      retry: () => {
        if (!disposed && mode === 'on' && sameInboxScope(owner, scope)) void observer.refetch()
      }
    })
    if (authoritative && pendingEvents.length) {
      for (let index = 0; index < pendingEvents.length;) {
        const item = pendingEvents[index]
        if (Date.now() - item.at > 10_000 || !sameInboxScope(item.focus, owner)) {
          pendingEvents.splice(index, 1); continue
        }
        const resolved = resolveLiveEvent(item.event)
        const session = resolved && data.sessions.find(session => session.id === resolved.session_id)
        const ids = session && [session.id, session._lineage_root_id, ...(session._lineage_ids || [])]
        if (!session || !item.storedIds.some(id => ids.includes(id))) { index++; continue }
        const key = inbox.model.key(owner, session)
        if (!key) { index++; continue }
        pendingEvents.splice(index, 1)
        // Resolve decisions after lineage is known, not against a transitional
        // focus tuple. An unrelated Settle must not discard this runtime's work.
        if ([...item.settledKeys].some(settled => inbox.model.key(owner, JSON.parse(settled)[2]) === key)) continue
        inbox.activity?.({ ...resolved, canonicalSessionId: resolved.session_id })
      }
    }
    markReady()
  }
  const configure = () => {
    if (disposed) return
    const nextScope = inboxOwnerScope(), nextMode = readClaudeInboxMode()
    if (sameInboxScope(scope, nextScope) && mode === nextMode) return
    pendingEvents.length = 0
    nominatedFocus.clear()
    if (!sameInboxScope(scope, nextScope)) { scope = nextScope; pageCount = 1; metadataPreview = null }
    mode = nextMode
    observer.setOptions(options())
    project()
  }
  const stopQuery = observer.subscribe(project)
  const resolveLiveEvent = event => {
    const query = observer.getCurrentResult(), data = query.data
    if (disposed || mode !== 'on' || event.replayed || !event.session_id || query.error ||
        event.connectionId !== scope.connectionId || event.profile !== scope.profile ||
        !sameInboxScope(scope, inboxOwnerScope()) || data?._claudeInboxLiveAuthority !== liveAuthority) return null
    const metadata = metadataPreview?.sessions || data.sessions
    const canonicalId = claudeInboxCanonicalRuntime(scope, data.targetProfile, event.session_id, data.rawLiveSessions, metadata, liveOwners)
    if (!canonicalId) return null
    const matches = metadata.filter(session => (session._lineage_root_id || session.id) === canonicalId)
    return matches.length ? { ...event, session_id: matches[0].id } : null
  }
  const verifyLiveEvent = event => !!resolveLiveEvent(event)
  inbox.verifyLiveEvent = verifyLiveEvent
  inbox.resolveLiveEvent = resolveLiveEvent
  const focusChanged = () => {
    configure(); rememberFocus(); project()
    const next = JSON.stringify(claudeInboxLiveFocus())
    if (next !== lastFocus) {
      lastFocus = next
      refreshLiveIdentity()
    }
  }
  const busyChanged = () => {
    project()
    const values = host.state.busyBySession?.get?.() || {}
    const busy = new Set(Object.entries(values).filter(([, value]) => value === true).map(([id]) => id))
    if ([...busy].some(id => !lastBusy.has(id))) refreshLiveIdentity()
    lastBusy = busy
  }
  const subscriptions = [
    inbox.model?.subscribe?.(event => {
      if (event?.type !== 'manual-settle') return
      const settledKey = inbox.model.key(event.scope, event.session)
      if (!settledKey) return
      // Verification can finish after Settle. Only work received after that
      // successful decision may restore attention; wall-clock order is unsafe.
      for (let index = pendingEvents.length - 1; index >= 0; index--) {
        const item = pendingEvents[index]
        if (!sameInboxScope(item.focus, event.scope)) continue
        item.settledKeys.add(settledKey)
        if (item.settledKeys.size > 64) pendingEvents.splice(index, 1)
      }
    }),
    ...['profile', 'connectionId', 'focusedSessionOwner', 'focusedStoredSessionId', 'focusedSessionId'].map(name => host.state[name]?.subscribe?.(focusChanged)),
    host.state.busyBySession?.subscribe?.(busyChanged),
    host.state.gateway?.subscribe?.(() => {
      if (host.state.gateway.get() !== 'open') {
        liveAuthority = Symbol('Inbox live connection')
        metadataPreview = null
        pendingEvents.length = 0
        nominatedFocus.clear()
        liveOwners.clear()
        project()
      } else if (mode === 'on') {
        project()
        void observer.refetch()
      }
    })
  ].filter(Boolean)
  if (typeof host.onEvent === 'function') subscriptions.push(host.onEvent('*', event => {
    // SDK profile tags can describe the active surface, not the event producer.
    // They may trigger a scoped read; only that read can establish ownership.
    if (!event.replayed && ['message.start', 'message.complete', 'error', 'subagent.spawn_requested', 'subagent.start', 'subagent.complete'].includes(event.type) &&
        mode === 'on' && event.connectionId === scope.connectionId && event.profile === scope.profile) {
      const currentFocus = claudeInboxLiveFocus()
      if (currentFocus?.runtimeId === event.session_id) rememberFocus()
      const candidates = nominations().filter(focus => sameInboxScope(focus, scope) && focus.runtimeId === event.session_id)
      if (!verifyLiveEvent(event) && candidates.length) {
        // Keep only lifecycle + the nominated identity, never message content.
        // Runtime/stored atoms are not atomic. Retain alternatives and require
        // their independently proved durable lineage before releasing the event.
        const payload = {}
        if (typeof event.payload?.status === 'string') payload.status = event.payload.status
        if (event.payload?.error) payload.error = true
        if (typeof event.payload?.subagent_id === 'string') payload.subagent_id = event.payload.subagent_id
        pendingEvents.push({ focus: { ...scope }, storedIds: [...new Set(candidates.map(focus => focus.storedId))],
          settledKeys: new Set(), at: Date.now(), event: {
          type: event.type, ...scope, session_id: event.session_id, payload
        } })
        if (pendingEvents.length > 64) pendingEvents.splice(0, pendingEvents.length - 64)
      }
      refreshLiveIdentity()
    }
  }))
  window.addEventListener(INBOX_MODE_EVENT, configure)
  // The DOM adapter creates/recreates its island asynchronously, including on
  // navigation after a cache hit. Keep readiness accurate without refetching.
  const readiness = globalThis.document?.body && typeof window.MutationObserver === 'function'
    ? new window.MutationObserver(markReady) : null
  readiness?.observe(document.body, { childList: true, subtree: true })
  project()
  const stop = () => {
    if (disposed) return
    disposed = true
    pendingEvents.length = 0
    nominatedFocus.clear()
    subscriptions.forEach(unsubscribe => unsubscribe())
    window.removeEventListener(INBOX_MODE_EVENT, configure)
    readiness?.disconnect()
    stopQuery()
    observer.destroy()
    liveOwners.clear()
    if (inbox.verifyLiveEvent === verifyLiveEvent) delete inbox.verifyLiveEvent
    if (inbox.resolveLiveEvent === resolveLiveEvent) delete inbox.resolveLiveEvent
    if (inbox.pendingWorkSessionIds === pendingWorkSessionIds) delete inbox.pendingWorkSessionIds
    inbox.rowOwnerEvidence = null
    markReady()
  }
  ctx.onDispose(stop)
  return stop
}

function ClaudeSettledBadge({ sessionId, inbox }) {
  const profile = useValue(host.state.profile)
  const connectionId = useValue(host.state.connectionId)
  const [, repaint] = useState(0)
  useEffect(() => {
    const changed = () => repaint(value => value + 1)
    const stopModel = inbox?.model.subscribe(changed)
    window.addEventListener(INBOX_MODE_EVENT, changed)
    window.addEventListener(INBOX_ROWS_EVENT, changed)
    return () => { stopModel?.(); window.removeEventListener(INBOX_MODE_EVENT, changed); window.removeEventListener(INBOX_ROWS_EVENT, changed) }
  }, [inbox])
  const currentScope = { connectionId: String(connectionId || host.activeConnectionId?.() || ''), profile: String(profile || 'default') }
  const scope = claudeInboxBadgeScope(inbox, sessionId, currentScope)
  // The native slot supplies only an id. Never decorate a mixed-owner row by
  // borrowing the active gateway's identity, even if that id exists there.
  if (!scope) return null
  if (!inbox || readClaudeInboxMode() !== 'on') return null
  if (!inbox.admission?.isEligible(scope, sessionId)) return null
  const settled = inbox.model.isSettled(scope, sessionId)
  const snoozed = inbox.model.isSnoozed?.(scope, sessionId) === true
  if (!settled && !snoozed) return null
  const stop = event => { event.preventDefault(); event.stopPropagation() }
  const badge = (label, action, title, apply) => jsx('button', {
    type: 'button', key: label, 'data-claude-inbox-owned': 'badge', 'aria-label': action, title,
    onPointerDown: stop,
    onClick: async event => {
      stop(event)
      // A row from the previous owner can remain mounted during a switch.
      if (readClaudeInboxMode() !== 'on' || claudeInboxBadgeScope(inbox, sessionId, inboxOwnerScope()) !== scope) return
      const freshOwner = await readClaudeInboxRowOwner(scope)
      if (freshOwner && readClaudeInboxMode() === 'on' && claudeInboxBadgeScope(inbox, sessionId, inboxOwnerScope()) === scope) apply()
    },
    children: [
      jsx('span', { className: 'claude-inbox-settled', children: label }),
      jsx('span', { className: 'claude-inbox-unsettle', children: action })
    ]
  })
  const badges = []
  if (settled) badges.push(badge('Settled', 'Un-settle', 'Un-settle', () => inbox.model.unsettle(scope, sessionId)))
  if (snoozed) {
    const deadline = new Date(inbox.model.snoozedUntil(scope, sessionId)).toLocaleString()
    badges.push(badge('Snoozed', 'Wake now', `Snoozed until ${deadline}`, () => inbox.model.cancelSnooze(scope, sessionId)))
  }
  return badges.length === 1 ? badges[0] : jsx('span', { style: { display: 'inline-flex' }, children: badges })
}

function connectClaudeInboxEvents(inbox) {
  if (!inbox || !host.onEvent) return () => {}
  return host.onEvent('*', event => {
    if (event.replayed) return
    // Presentation tags alone cannot prove ownership, even when populated.
    // Verify the runtime against the observer's connected owner evidence.
    if (!event.connectionId || !event.profile || !event.session_id) return
    const resolved = inbox.resolveLiveEvent?.(event)
    if (!resolved) return
    if (typeof inbox.activity === 'function') inbox.activity({ ...resolved, canonicalSessionId: resolved.session_id })
    else if (['message.start', 'tool.start'].includes(event.type)) {
      inbox.reactivate({ type: 'work', scope: { connectionId: resolved.connectionId, profile: resolved.profile }, session_id: resolved.session_id, canonicalSessionId: resolved.session_id })
    }
  })
}


// Pure metadata decoder for the native Command surfaces. No listeners, actions,
// fetches, logs, persistence or ownership inference from the active connection.
// The controller must call it before cmdk consumes Enter/removes the menu and
// independently verify focus/API ownership before admitting an explicit open.
function resolveClaudeInboxMenuOpenGesture(event, { document: doc, queryClient } = {}) {
  if (!doc || !event || event.isTrusted !== true || event.defaultPrevented ||
      event.isComposing || event.keyCode === 229 || event.shiftKey || event.ctrlKey ||
      event.metaKey || event.altKey || event.repeat ||
      (event.view && event.view !== doc.defaultView)) return null
  if (event.type !== 'click' && event.type !== 'keydown') return null
  if (event.type === 'click' ? event.button !== 0 : event.key !== 'Enter') return null
  if (typeof queryClient?.getQueryData !== 'function') return null

  const commandSelector = '[data-slot="command"]'
  const itemSelector = '[data-slot="command-item"][data-value]'
  const target = event.target?.nodeType === 3 ? event.target.parentElement : event.target
  if (!target?.closest || target.ownerDocument !== doc || !target.isConnected) return null
  const command = target.closest(commandSelector)
  if (!command) return null

  // Reject disabled/closed surfaces as well as disabled children of an item.
  const unavailable = element => {
    for (let node = element; node; node = node.parentElement) {
      if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true' ||
          node.getAttribute('data-disabled') === 'true' || node.hasAttribute('inert') ||
          node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true' ||
          node.getAttribute('data-state') === 'closed') return true
    }
    return false
  }
  if (unavailable(target)) return null

  let item
  if (event.type === 'click') {
    item = target.closest(itemSelector)
  } else {
    // cmdk selects the highlighted item, not necessarily the event target.
    // Never borrow another Command's selection (including a nested Command).
    if (target.matches('input, textarea, [contenteditable="true"]') &&
        !target.matches('[data-slot="command-input"]')) return null
    const selected = [...command.querySelectorAll(`${itemSelector}[data-selected="true"]`)]
      .filter(node => node.closest(commandSelector) === command)
    if (selected.length !== 1) return null
    item = selected[0]
  }
  if (!item || item.closest(commandSelector) !== command || !item.isConnected || unavailable(item)) return null
  const value = item.getAttribute('data-value')
  if (typeof value !== 'string' || !value) return null

  // Read only the SDK's two native caches, not private stores/components/Fiber.
  let pickerRows, paletteRows
  try {
    const picker = queryClient.getQueryData(['session-picker', 'sessions'])
    const palette = queryClient.getQueryData(['command-palette', 'sessions'])
    pickerRows = Array.isArray(picker?.sessions) ? picker.sessions : []
    paletteRows = Array.isArray(palette?.sessions) ? palette.sessions : []
  } catch { return null }
  const validId = id => typeof id === 'string' && id.length > 0
  const rows = [...pickerRows, ...paletteRows].filter(row => row && validId(row.id))
  const idsOf = row => [row.id, row._lineage_root_id,
    ...(Array.isArray(row._lineage_ids) ? row._lineage_ids : [])].filter(validId)
  const scopeOf = row => validId(row.connection_id) && validId(row.profile)
    ? { connectionId: row.connection_id, profile: row.profile } : null
  // Keep incomplete owners distinct too: unknown metadata cannot prove that a
  // qualified clone belongs to the same owner. Never trim/coerce owner tokens.
  const ownerKey = row => JSON.stringify([
    typeof row.connection_id === 'string' ? row.connection_id : null,
    typeof row.profile === 'string' ? row.profile : null
  ])
  const resolveOwner = (sessionId, candidates, kind) => {
    if (!candidates.length) return null
    const owners = new Set(rows.filter(row => idsOf(row).includes(sessionId)).map(ownerKey))
    if (owners.size !== 1) return null
    return { sessionId, scope: scopeOf(candidates[0]), kind }
  }

  // Native sessionTitle: title.trim() || preview.trim() || 'Untitled session'.
  // The verified fallback is completely reconstructible from cache, so do NOT
  // fall back to arbitrary displayed text or accept just an id suffix. Native
  // picker signatures always end in row.id, never a substituted lineage id.
  // Test this first: a legitimate picker title/preview may contain U+0001.
  const pickerCandidates = pickerRows.filter(row => {
    if (!row || !validId(row.id) ||
        (row.title != null && typeof row.title !== 'string') ||
        (row.preview != null && typeof row.preview !== 'string')) return false
    const preview = row.preview?.trim() ?? ''
    const title = row.title?.trim() || preview || 'Untitled session'
    return value === `${title} ${preview} ${row.id}`
  })
  if (pickerCandidates.length) {
    const sessionIds = new Set(pickerCandidates.map(row => row.id))
    if (sessionIds.size !== 1) return null
    return resolveOwner(pickerCandidates[0].id, pickerCandidates, 'picker')
  }

  // Native paletteValue appends the id after the LAST separator; a title may
  // itself contain that character. Labels/previews never become output/logs.
  const separator = value.lastIndexOf('\u0001')
  if (separator !== -1) {
    const nativeId = value.slice(separator + 1)
    const match = /^(session-|pinned-|goto-)(.+)$/.exec(nativeId)
    if (!match) return null // archived-* restores only; settings/others do not open.
    const prefix = match[1], sessionId = match[2]
    if (prefix === 'goto-' && !/^\d{8}_\d{6}_[a-f0-9]{6}$/.test(sessionId)) return null
    // session/pinned native entries use row.id unchanged (toSessionEntry).
    // A lineage alias alone cannot manufacture a native entry for that alias.
    const candidates = paletteRows.filter(row => row && row.id === sessionId)
    if (candidates.length) return resolveOwner(sessionId, candidates, 'palette')
    if (prefix !== 'goto-' || !/^\d{8}_\d{6}_[a-f0-9]{6}$/.test(sessionId)) return null
    // goto accepts a native-format stored root/segment as typed, without
    // rewriting it to a tip. Explicit native lineage metadata may qualify it.
    const lineageRows = rows.filter(row => idsOf(row).includes(sessionId))
    if (lineageRows.length) return resolveOwner(sessionId, lineageRows, 'palette')
    return { sessionId, scope: null, kind: 'palette' } // parent verifies focus/API.
  }

  return null
}


// Observe a real native-row open through the supported decoration slot.
// A hidden marker supplies the durable row identity without copying native actions.
async function readClaudeInboxOpenedSession(thread, { stillCurrent = () => true, expectedRootId, followLineage = false } = {}) {
  const scope = thread?.scope, id = thread?.id
  if (!id || !scope || !stillCurrent()) throw new Error('Inbox open owner changed.')
  const bridge = globalThis.window?.hermesDesktop
  if (typeof bridge?.api !== 'function') throw new Error('Inbox requires the Desktop session API.')
  let resolvedId = id, lineage = null
  if (followLineage || expectedRootId && expectedRootId !== id) {
    const rootId = expectedRootId || id
    lineage = await bridge.api({
      connectionId: scope.connectionId, profile: scope.profile,
      path: `/api/sessions/${encodeURIComponent(rootId)}/latest-descendant?${new URLSearchParams({ profile: scope.profile })}`,
      timeoutMs: 60_000
    })
    if (!stillCurrent()) throw new Error('Inbox open owner changed.')
    if (lineage?.requested_session_id !== rootId || !Array.isArray(lineage.path) || lineage.path[0] !== rootId || lineage.path.at(-1) !== lineage.session_id || lineage.path.some(value => typeof value !== 'string' || !value)) {
      throw new Error('Inbox opened-chat lineage could not be verified.')
    }
    if (expectedRootId && !lineage.path.includes(id)) throw Object.assign(new Error('Inbox opened-chat target does not belong to the clicked row.'), { code: 'OPEN_TARGET_NOT_FOCUSED' })
    if (followLineage) resolvedId = lineage.session_id
  }
  const row = await bridge.api({
    connectionId: scope.connectionId, profile: scope.profile,
    path: `/api/sessions/${encodeURIComponent(resolvedId)}?${new URLSearchParams({ profile: scope.profile })}`,
    timeoutMs: 60_000
  })
  if (!stillCurrent()) throw new Error('Inbox open owner changed.')
  if (!row || row.id !== resolvedId || typeof row.profile !== 'string') throw new Error('Inbox received incomplete opened-chat metadata.')
  let targetProfile = scope.profile
  if (row.profile !== targetProfile && typeof host.profileRoutes === 'function') {
    const routes = await host.profileRoutes()
    const matches = routes.filter(route => sameInboxScope(route, scope))
    if (matches.length === 1 && matches[0].targetProfile) targetProfile = matches[0].targetProfile
  }
  if (!stillCurrent() || row.profile !== targetProfile || row.connection_id && row.connection_id !== scope.connectionId) {
    throw new Error('Inbox opened-chat owner could not be verified.')
  }
  return { ...row, ...(lineage ? { _lineage_root_id: lineage.path[0], _lineage_ids: lineage.path } : {}), profile: scope.profile, connection_id: scope.connectionId }
}

function isClaudeInboxSessionNotFound(error) {
  const status = error?.status ?? error?.statusCode
  if (status != null) return status === 404
  // Electron invoke drops statusCode. Read only the native HTTP prefix,
  // never a status mentioned inside an auth, transport or corrupt-body error.
  const nativeStatus = /^Error invoking remote method 'hermes:api': Error: (\d{3}): /.exec(error?.message || '')
  return nativeStatus?.[1] === '404'
}

async function claudeInboxUnchangedOpenOwner(sessionId, scope, stillCurrent) {
  const roster = await globalThis.window?.hermesDesktop?.getAgentRoster?.()
  if (!stillCurrent() || !Array.isArray(roster?.sources) || !roster.sources.length || !Array.isArray(roster.agents)) return false
  if (roster.sources.some(source => source.reachable !== true || source.error || source.needsSignIn || !source.connectionId)) return false
  const sources = new Set(roster.sources.map(source => source.connectionId)), owners = new Map()
  for (const owner of roster.agents) {
    if (!sources.has(owner.connectionId) || typeof owner.profile !== 'string' || !owner.profile) return false
    owners.set(JSON.stringify([owner.connectionId, owner.profile]), owner)
  }
  if (!owners.has(JSON.stringify([scope.connectionId, scope.profile]))) return false
  if (owners.size === 1) return true
  // A mixed roster is not ambiguous when this exact stored id exists under
  // only one owner. Read metadata only and require a complete negative proof.
  let found = []
  const routes = [...owners.values()]
  for (let offset = 0; offset < routes.length; offset += 4) {
    const batch = await Promise.all(routes.slice(offset, offset + 4).map(async owner => {
      try {
        await readClaudeInboxOpenedSession({ id: sessionId, scope: owner }, { stillCurrent })
        return owner
      } catch (error) {
        if (isClaudeInboxSessionNotFound(error)) return null
        throw error
      }
    }))
    if (!stillCurrent()) return false
    found = found.concat(batch.filter(Boolean))
    if (found.length > 1 || found.some(owner => !sameInboxScope(owner, scope))) return false
  }
  return found.length === 1 && sameInboxScope(found[0], scope)
}

function bindClaudeInboxNativeOpenIntent(row, sessionId, inbox, resolveGesture = null) {
  if (!row || !sessionId && !resolveGesture || !inbox) return () => {}
  let disposed = false, intent = null, timer = null, commitTimer = null, subscriptions = [], middlePress = null
  const key = thread => thread ? JSON.stringify([thread.scope.connectionId, thread.scope.profile, thread.id]) : null
  const reset = () => {
    intent = null
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (commitTimer !== null) clearTimeout(commitTimer)
    commitTimer = null
    subscriptions.forEach(stop => stop())
    subscriptions = []
  }
  const commit = async () => {
    const pending = intent, thread = claudeInboxFocusedThread()
    if (disposed || !pending || pending.loading || !thread || readClaudeInboxMode() !== 'on') return
    if (pending.scopeHint && !sameInboxScope(pending.scopeHint, thread.scope)) return
    if (!sameInboxScope(thread.scope, inboxOwnerScope())) return
    // The focus stores may publish owner and id separately. Never accept a
    // transitional old id as the target of a differently labelled native row.
    const targetId = pending.sessionId
    const sameLineage = thread.id === targetId || inbox.model?.key(thread.scope, targetId) === inbox.model?.key(thread.scope, thread.id)
    if (!sameLineage && key(thread) !== pending.before && thread.id === pending.beforeId) return
    pending.loading = true
    const revision = pending.revision
    const stillCurrent = () => !disposed && intent === pending && key(claudeInboxFocusedThread()) === key(thread) && sameInboxScope(thread.scope, inboxOwnerScope())
    try {
      if (key(thread) === pending.before && !pending.scopeHint && !await claudeInboxUnchangedOpenOwner(targetId, thread.scope, stillCurrent)) return
      const session = await readClaudeInboxOpenedSession(thread, { stillCurrent, expectedRootId: sameLineage ? undefined : targetId })
      if (stillCurrent() && inbox.opened({ explicit: true, scope: thread.scope, id: thread.id, session })) reset()
    } catch (error) {
      // Native resume is asynchronous. A still-unchanged previous focus is
      // not a failed open, and must never be admitted on behalf of this row.
      if (error?.code === 'OPEN_TARGET_NOT_FOCUSED' && key(thread) === pending.before) return
      if (stillCurrent()) {
        // This is passive metadata discovery, not a requested restore. A failed
        // read must leave attention unchanged without announcing a failed action.
        reset()
      }
    } finally {
      if (intent === pending) {
        pending.loading = false
        if (pending.revision !== revision) scheduleCommit()
      }
    }
  }
  const scheduleCommit = () => {
    if (disposed || !intent || commitTimer !== null) return
    // Chrome can drain microtasks between capture and the native bubble handler.
    // A task boundary lets the real handler run before we inspect its result.
    commitTimer = setTimeout(() => { commitTimer = null; void commit() }, 0)
  }
  const activate = event => {
    if (disposed || readClaudeInboxMode() !== 'on' || !event.isTrusted || event.shiftKey || event.defaultPrevented) return
    if (event.type === 'click' && event.button !== 0 || event.type === 'pointerup' && event.button !== 1) return
    let descriptor
    if (resolveGesture) {
      descriptor = resolveGesture(event)
      if (!descriptor || !row.contains(event.target)) return
    } else {
      const target = event.target?.closest?.('button[data-slot="row-button"]')
      if (!target || !row.contains(target) || event.target.closest?.('[data-row-actions], [data-reorder-handle]')) return
      descriptor = { sessionId, scope: null }
    }
    reset()
    const before = claudeInboxFocusedThread()
    intent = { sessionId: descriptor.sessionId, scopeHint: descriptor.scope ? { ...descriptor.scope } : null, before: key(before), beforeId: before?.id, loading: false, revision: 0 }
    // Subscribe only during one verified open gesture, not once per idle row.
    subscriptions = ['focusedStoredSessionId', 'focusedSessionOwner', 'profile', 'connectionId']
      .map(name => host.state[name]?.subscribe?.(() => {
        if (intent) intent.revision++
        scheduleCommit()
      })).filter(Boolean)
    timer = setTimeout(reset, 60_000)
    // Native click/resume handlers must run first; do not prevent or forward them.
    scheduleCommit()
  }
  const pointerDown = event => {
    if (resolveGesture) return
    if (!event.isTrusted || event.button !== 1 || event.shiftKey || readClaudeInboxMode() !== 'on') return
    const target = event.target?.closest?.('button[data-slot="row-button"]')
    middlePress = target && row.contains(target) && !event.target.closest?.('[data-row-actions], [data-reorder-handle]')
      ? { target, pointerId: event.pointerId } : null
  }
  const pointerUp = event => {
    const press = middlePress
    middlePress = null
    if (!press || press.pointerId !== event.pointerId || press.target !== event.target?.closest?.('button[data-slot="row-button"]')) return
    activate(event)
  }
  const pointerCancel = () => { middlePress = null }
  row.addEventListener('click', activate, true)
  if (resolveGesture) row.addEventListener('keydown', activate, true)
  row.addEventListener('pointerdown', pointerDown, true)
  row.addEventListener('pointerup', pointerUp, true)
  row.addEventListener('pointercancel', pointerCancel, true)
  return () => {
    disposed = true
    reset()
    middlePress = null
    row.removeEventListener('click', activate, true)
    if (resolveGesture) row.removeEventListener('keydown', activate, true)
    row.removeEventListener('pointerdown', pointerDown, true)
    row.removeEventListener('pointerup', pointerUp, true)
    row.removeEventListener('pointercancel', pointerCancel, true)
  }
}

function ClaudeInboxNativeOpenIntent({ sessionId, inbox }) {
  const marker = useRef(null)
  useEffect(() => bindClaudeInboxNativeOpenIntent(marker.current?.closest?.('.row-hover'), sessionId, inbox), [sessionId, inbox])
  return jsx('span', { ref: marker, 'aria-hidden': true, style: { display: 'none' }, 'data-claude-inbox-open-observer': sessionId })
}

function startClaudeInboxMenuOpenObserver(ctx, inbox) {
  const doc = globalThis.document
  if (!inbox || typeof doc?.addEventListener !== 'function') return () => {}
  const stop = bindClaudeInboxNativeOpenIntent(doc, null, inbox, event => resolveClaudeInboxMenuOpenGesture(event, { document: doc, queryClient }))
  ctx.onDispose(stop)
  return stop
}


// Plugin-owned DOM chrome, transcribed from desktop sidebar/chrome.tsx,
// row-geometry.ts, session-row.tsx and ui/row-button.tsx. These are not imports
// or instances of the private SidebarSessionRow / SessionActionsMenu components.
// Parent installs this scoped fallback CSS once and owns all menu/action logic.
const CLAUDE_INBOX_ROW_UI_CSS = `
[data-claude-inbox-row-ui] { box-sizing:border-box; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:stretch; min-height:1.625rem; padding-right:.5rem; border-radius:.375rem; position:relative; }
[data-claude-inbox-row-ui]:hover { background:var(--ui-row-hover-background,transparent); }
[data-claude-inbox-row-ui][data-active='true'] { background:var(--ui-row-active-background,transparent); }
[data-claude-inbox-row-ui] > [data-slot='row-button'] { box-sizing:border-box; display:flex; height:100%; min-width:0; align-items:center; align-self:stretch; gap:.375rem; padding:.125rem .5rem; border:0; background:transparent; text-align:left; color:inherit; font:inherit; cursor:pointer; z-index:0; }
[data-claude-inbox-row-ui] [data-claude-inbox-lead] { display:grid; width:.875rem; height:.875rem; flex-shrink:0; place-items:center; overflow:hidden; position:relative; }
[data-claude-inbox-row-ui] [data-claude-inbox-work-dot] { box-sizing:border-box; width:6px; height:6px; border-radius:50%; background:var(--ui-text-quaternary,currentColor); color:var(--ui-text-quaternary,currentColor); opacity:0; }
[data-claude-inbox-row-ui][data-work-state='working'] [data-claude-inbox-work-dot] { background:var(--ui-text-primary,currentColor); opacity:1; }
[data-claude-inbox-row-ui][data-work-state='completed'] [data-claude-inbox-work-dot] { background:var(--ui-success,var(--ui-text-quaternary,currentColor)); opacity:1; }
/* Plugin-owned transcription of the installed host's private arc-border arc-row:
   styles.css:1111-1157,1202-1231,1246-1261,1274-1277. The installed SDK has
   no RunningBorder export; native session-row.tsx paints an aria-hidden span.
   Keep the native masked 300% gradient and diagonal translation, not rotation. */
[data-claude-inbox-row-ui] > [data-claude-inbox-running-arc] {
  --claude-inbox-arc-c0:color-mix(in srgb,var(--dt-foreground,var(--ui-text-primary,currentColor)) 0%,transparent);
  --claude-inbox-arc-c1:var(--dt-midground,var(--ui-text-primary,currentColor));
  --claude-inbox-arc-c2:color-mix(in srgb,var(--claude-inbox-arc-c1) 45%,transparent);
  --claude-inbox-arc-angle:160deg; --claude-inbox-arc-width:.078125rem;
  --claude-inbox-arc-standoff:0rem; --claude-inbox-arc-duration:2.23s;
  box-sizing:border-box; pointer-events:none; position:absolute; overflow:hidden;
  border-radius:inherit;
  inset:calc(var(--claude-inbox-arc-standoff) * -1); padding:var(--claude-inbox-arc-width);
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude; opacity:0;
}
:root:is(.dark,[data-hermes-mode='dark']) [data-claude-inbox-row-ui] > [data-claude-inbox-running-arc] { --claude-inbox-arc-c1:var(--dt-foreground,var(--ui-text-primary,currentColor)); }
[data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc] { opacity:1; }
[data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc]::before {
  content:''; position:absolute; top:0; left:0; width:300%; height:300%;
  background:linear-gradient(var(--claude-inbox-arc-angle),transparent 0%,var(--claude-inbox-arc-c0) 15%,var(--claude-inbox-arc-c1) 20%,var(--claude-inbox-arc-c2) 25%,transparent 35%,transparent 40%,var(--claude-inbox-arc-c0) 55%,var(--claude-inbox-arc-c1) 60%,var(--claude-inbox-arc-c2) 65%,transparent 75%,transparent 80%,var(--claude-inbox-arc-c0) 95%,var(--claude-inbox-arc-c1) 100%);
  will-change:transform; animation:claude-inbox-row-contour var(--claude-inbox-arc-duration) linear infinite;
}
@keyframes claude-inbox-row-contour { 0% { transform:translate(-10%,-10%); } 100% { transform:translate(-50%,-50%); } }
[data-claude-inbox-row-ui] [data-claude-inbox-title-wrap] { min-width:0; flex:1; align-self:center; }
[data-claude-inbox-row-ui] [data-claude-inbox-label] { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.8125rem; line-height:1.35; font-weight:400; color:var(--ui-text-secondary,inherit); }
[data-claude-inbox-row-ui]:is(:hover,:focus-within,[data-active='true']) [data-claude-inbox-label] { color:var(--ui-text-primary,inherit); }
[data-claude-inbox-row-ui] > [data-row-actions] { display:flex; flex-shrink:0; align-items:center; align-self:stretch; }
[data-claude-inbox-row-ui] > [data-row-actions] > button { box-sizing:border-box; display:inline-flex; width:1.5rem; height:1.5rem; flex-shrink:0; align-items:center; justify-content:center; padding:0; border:0; border-radius:4px; background:transparent; color:var(--ui-text-secondary,inherit); font:inherit; cursor:pointer; opacity:0; pointer-events:none; transition:opacity 100ms; }
[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > button { opacity:1; pointer-events:auto; }
[data-claude-inbox-row-ui] > [data-row-actions] > button:hover { background:var(--chrome-action-hover,var(--ui-control-hover-background,transparent)); color:var(--ui-text-primary,inherit); }
[data-claude-inbox-row-ui] button:focus-visible { outline:1px solid var(--ui-accent,currentColor); outline-offset:-1px; }
[data-claude-inbox-row-ui] button:disabled { cursor:default; }
[data-claude-inbox-row-ui] > [data-row-actions] > button:disabled { pointer-events:none; }
[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > button:disabled { opacity:.5; }
[data-claude-inbox-row-ui] > [data-row-actions] > [data-claude-inbox-settle] { opacity:1; pointer-events:auto; }
[data-claude-inbox-row-ui] > [data-row-actions] > [data-claude-inbox-settle]:disabled,
[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > [data-claude-inbox-settle]:disabled { opacity:0; visibility:hidden; pointer-events:none; transition:none; }
[data-claude-inbox-row-ui] svg { display:block; width:.75rem; height:.75rem; pointer-events:none; flex-shrink:0; }
@media (prefers-reduced-motion:reduce) {
  [data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc]::before { animation:none; }
  [data-claude-inbox-row-ui] > [data-row-actions] > button { transition:none; }
}
`;

function createClaudeInboxRowUI({ document: doc, onOpen, onMenu, onSnooze }) {
  if (!doc || typeof doc.createElement !== 'function') throw new TypeError('document is required');
  const make = (tag, className, marker) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (marker) node.setAttribute(marker, '');
    return node;
  };
  const row = make('div', 'min-h-[1.625rem] pr-2 grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-md group row-hover relative', 'data-claude-inbox-row-ui');
  const go = make('button', 'pl-2 pr-2 gap-1.5 flex h-full min-w-0 items-center self-stretch py-0.5 bg-transparent text-left z-0', 'data-claude-inbox-open');
  go.type = 'button';
  go.setAttribute('data-slot', 'row-button');
  const lead = make('span', 'grid size-3.5 shrink-0 place-items-center overflow-hidden', 'data-claude-inbox-lead');
  lead.setAttribute('aria-hidden', 'true');
  const workDot = make('span', '', 'data-claude-inbox-work-dot');
  const runningArc = make('span', '', 'data-claude-inbox-running-arc');
  runningArc.setAttribute('aria-hidden', 'true');
  lead.append(workDot);
  const wrap = make('span', 'min-w-0 flex-1 self-center', 'data-claude-inbox-title-wrap');
  const label = make('span', 'min-w-0 truncate text-[0.8125rem] text-(--ui-text-secondary) leading-[1.35] hover-marquee block font-normal group-hover:text-foreground group-data-[working=true]:text-foreground/90', 'data-claude-inbox-label');
  const text = make('span', 'hover-marquee-inner');
  label.append(text); wrap.append(label); go.append(lead, wrap);
  const actions = make('div', 'flex shrink-0 items-center self-stretch', 'data-row-actions');
  const glyphButton = (marker, name, paths) => {
    const button = make('button', 'inline-flex shrink-0 cursor-pointer items-center justify-center size-6 rounded-[4px] text-(--ui-text-secondary) bg-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100', marker);
    button.type = 'button';
    button.setAttribute('data-slot', 'button');
    button.setAttribute('data-size', 'icon-xs');
    button.setAttribute('data-variant', 'ghost');
    button.setAttribute('aria-label', name); button.title = name;
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.25'); svg.setAttribute('stroke-linecap', 'round');
    for (const d of paths) {
      const path = doc.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path);
    }
    button.append(svg); return button;
  };
  const menu = glyphButton('data-claude-inbox-menu', 'Inbox row options', ['M3 8h.01M8 8h.01M13 8h.01']);
  menu.firstChild.setAttribute('stroke-width', '2.5');
  menu.setAttribute('aria-haspopup', 'menu'); menu.setAttribute('aria-expanded', 'false');
  const clock = glyphButton('data-claude-inbox-snooze', 'Snooze', ['M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5', 'M8 4.5V8l2.5 1.5']);
  actions.append(menu, clock); row.append(go, actions, runningArc);
  // Do not let plugin-owned clicks/presses enter an ancestor's native gestures.
  // Preserve the actual event and its defaults/modifiers for parent callbacks.
  row.addEventListener('pointerdown', event => event.stopPropagation());
  for (const [button, callback] of [[go, onOpen], [menu, onMenu], [clock, onSnooze]]) {
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (!button.disabled && typeof callback === 'function') callback(event);
    });
  }
  // The action remains the same button/callback and disabled ledger. Only
  // callers opting in get a Settle check rather than the generic options menu.
  let settleAction = false;
  let menuTitle = null;
  const workStates = new Set(['working', 'completed', 'reading', 'unknown', 'idle']);
  const update = (state = {}) => {
    if ('title' in state) { text.textContent = String(state.title ?? ''); go.title = text.textContent; }
    if ('selected' in state) {
      row.classList.toggle('bg-(--ui-row-active-background)', Boolean(state.selected));
      row.setAttribute('data-active', String(Boolean(state.selected)));
      // The shipped skin paints aria-current; keep it on the shell, not the
      // transparent body, so selection does not create a second inset band.
      if (state.selected) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
    }
    if ('disabled' in state) { go.disabled = Boolean(state.disabled); clock.disabled = Boolean(state.disabled); }
    if ('menuDisabled' in state || 'disabled' in state) {
      if ('menuDisabled' in state) menu.dataset.menuDisabled = String(Boolean(state.menuDisabled));
      menu.disabled = go.disabled || menu.dataset.menuDisabled === 'true';
    }
    if ('workState' in state) {
      // Rendering consumes an explicit state; it never guesses completion from
      // inactivity, selection or a missing runtime slice.
      row.setAttribute('data-work-state', workStates.has(state.workState) ? state.workState : 'unknown');
    }
    if ('settleAction' in state) {
      settleAction = Boolean(state.settleAction);
      // Only Inbox opts into Snooze-left / Settle-right. Generic options keep
      // their original order. Move a sibling only on mode changes so ordinary
      // keyed updates cannot detach controls or disturb their keyboard focus.
      const firstAction = settleAction ? clock : menu;
      if (actions.firstElementChild !== firstAction) actions.insertBefore(firstAction, actions.firstChild);
      menu.toggleAttribute('data-claude-inbox-settle', settleAction);
      menu.firstChild.firstChild.setAttribute('d', settleAction ? 'M3.5 8.5l3 3 6-7' : 'M3 8h.01M8 8h.01M13 8h.01');
      menu.firstChild.setAttribute('stroke-width', settleAction ? '1.25' : '2.5');
      if (settleAction) {
        menu.removeAttribute('aria-haspopup'); menu.removeAttribute('aria-expanded');
      } else {
        menu.setAttribute('aria-haspopup', 'menu'); menu.setAttribute('aria-expanded', 'false');
      }
    }
    if ('menuTitle' in state) menuTitle = state.menuTitle == null ? null : String(state.menuTitle);
    if ('menuTitle' in state || 'settleAction' in state) {
      const name = menuTitle ?? (settleAction ? 'Settle' : 'Inbox row options');
      menu.title = name; menu.setAttribute('aria-label', name);
    }
  };
  update({ title: '', selected: false, disabled: false, menuDisabled: false, workState: 'idle' });
  return { row, go, label, lead, actions, menu, clock, update };
}

globalThis.CLAUDE_INBOX_ROW_UI_CSS = CLAUDE_INBOX_ROW_UI_CSS;
globalThis.createClaudeInboxRowUI = createClaudeInboxRowUI;


// Standalone block: bundled by the parent plugin. No imports or network access.
const CLAUDE_INBOX_STORE = 'inbox-state-v1';


function claudeInboxScope(scope) {
  if (!scope || typeof scope.profile !== 'string' || !scope.profile) return null;
  if (typeof scope.connectionId !== 'string') return null;
  return { connectionId: scope.connectionId, profile: scope.profile };
}

function claudeInboxId(session) {
  const id = typeof session === 'string' ? session : session?.id ?? session?.session_id;
  return typeof id === 'string' && id ? id : null;
}

function claudeInboxOwnedBy(scope, session) {
  return !!scope && (!session?.profile || session.profile === scope.profile) &&
    (session?._connection_id == null || session._connection_id === scope.connectionId) &&
    (session?.connectionId == null || session.connectionId === scope.connectionId) &&
    (session?.connection_id == null || session.connection_id === scope.connectionId);
}

function claudeInboxKey(scope, durableId) {
  const valid = claudeInboxScope(scope);
  const id = claudeInboxId(durableId);
  return valid && id ? JSON.stringify([valid.connectionId, valid.profile, id]) : null;
}

function claudeInboxWorkStatus(value) {
  const status = typeof value === 'string' ? value : value?.status ?? value?.state;
  if (status === 'resuming') return 'reading';
  if (value === true || value?.busy === true) return 'work';
  if (value === false) return 'idle';
  if (['starting', 'running', 'working', 'streaming', 'waiting', 'needs-input', 'queued'].includes(status)) return 'work';
  if (['idle', 'resuming', 'completed', 'done', 'stopped'].includes(status)) return status === 'resuming' ? 'reading' : 'idle';
  return 'unknown';
}

function createClaudeInboxModel(storage, { restoreAttention } = {}) {
  let state = { version: 1, records: {}, aliases: {} };
  let error = null;
  const listeners = new Set();
  const expired = new Map();
  const validTimestamp = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
  const notify = event => { for (const fn of listeners) { try { fn(event); } catch { /* A view subscriber cannot undo a saved model transaction. */ } } };
  const validKey = key => {
    try { const p = JSON.parse(key); return Array.isArray(p) && p.length === 3 && typeof p[0] === 'string' && p.slice(1).every(v => typeof v === 'string' && v); }
    catch { return false; }
  };
  try {
    const raw = storage?.get?.(CLAUDE_INBOX_STORE);
    const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (saved != null) {
      if (saved.version !== 1 || !saved.records || !saved.aliases) throw Error('Invalid Inbox state');
      for (const [key, record] of Object.entries(saved.records)) {
        if (!validKey(key) || !record || typeof record !== 'object') continue;
        const watermarks = {};
        for (const [id, count] of Object.entries(record.watermarks || {})) {
          if (id && Number.isSafeInteger(count) && count >= 0) Object.defineProperty(watermarks, id, { value: count, enumerable: true, writable: true, configurable: true });
        }
        state.records[key] = {
          settledAt: Number.isFinite(record.settledAt) && record.settledAt > 0 ? record.settledAt : null, watermarks,
          snoozeUntil: validTimestamp(record.snoozeUntil) ? record.snoozeUntil : null,
          snoozedAt: validTimestamp(record.snoozedAt) ? record.snoozedAt : validTimestamp(record.snoozeUntil) ? 1 : null,
          ...(record.manualSettled === true ? { manualSettled: true } : {})
        };
      }
      for (const [alias, root] of Object.entries(saved.aliases)) {
        if (!validKey(alias) || !validKey(root)) continue;
        const a = JSON.parse(alias), r = JSON.parse(root);
        if (a[0] === r[0] && a[1] === r[1] && state.records[root]) state.aliases[alias] = root;
      }
    }
  } catch { error = 'Inbox state could not be read. Settle and Snooze are unavailable until storage recovers.'; }

  const putCount = (record, id, count) => {
    const previous = Object.prototype.hasOwnProperty.call(record.watermarks, id) ? record.watermarks[id] : 0;
    Object.defineProperty(record.watermarks, id, { value: Math.max(previous, count), enumerable: true, writable: true, configurable: true });
  };
  const accept = (scope, session) => {
    if (!claudeInboxKey(scope, session)) return false;
    if (typeof session !== 'object' || !session) return true;
    return claudeInboxOwnedBy(scope, session);
  };
  const rootKey = (draft, scope, session) => {
    if (!accept(scope, session)) return null;
    const own = claudeInboxKey(scope, session);
    const declared = typeof session === 'object' ? claudeInboxKey(scope, session._lineage_root_id) : null;
    return draft.aliases[declared] || declared || draft.aliases[own] || own;
  };
  const associate = (draft, scope, session) => {
    const key = rootKey(draft, scope, session);
    if (!key) return null;
    const own = claudeInboxKey(scope, session);
    const ids = [claudeInboxId(session), ...(Array.isArray(session?._lineage_ids) ? session._lineage_ids : [])];
    if (session?._lineage_root_id) ids.push(session._lineage_root_id);
    const record = draft.records[key] || { settledAt: null, watermarks: {}, snoozeUntil: null, snoozedAt: null };
    // A lineage discovered after settling retains its prior durable record.
    for (const id of ids) {
      const alias = claudeInboxKey(scope, id);
      if (!alias) continue;
      const priorKey = draft.aliases[alias] || alias;
      const prior = draft.records[priorKey];
      if (prior && prior !== record) {
        record.settledAt = Math.max(record.settledAt || 0, prior.settledAt || 0) || null;
        if (prior.settledAt && prior.manualSettled === true) record.manualSettled = true;
        // Keep the most recent explicit duration/cancellation when lineage arrives late.
        if ((prior.snoozedAt || 0) > (record.snoozedAt || 0) ||
            (prior.snoozedAt && prior.snoozedAt === record.snoozedAt && !prior.snoozeUntil)) {
          record.snoozeUntil = prior.snoozeUntil; record.snoozedAt = prior.snoozedAt;
        }
        for (const [pid, count] of Object.entries(prior.watermarks)) putCount(record, pid, count);
        for (const [a, target] of Object.entries(draft.aliases)) if (target === priorKey) draft.aliases[a] = key;
        delete draft.records[priorKey];
      }
      draft.aliases[alias] = key;
    }
    draft.aliases[own] = key;
    draft.records[key] = record;
    return { key, record, id: claudeInboxId(session) };
  };
  const snoozeTime = draft => {
    // Millisecond ordering keeps two rapid decisions unambiguous during late lineage
    // discovery, even when the system clock moves backwards between those decisions.
    let at = Date.now();
    for (const record of Object.values(draft.records)) at = Math.max(at, (record.snoozedAt || 0) + 1);
    return Math.min(at, 8640000000000000);
  };
  const transaction = (change, event) => {
    const draft = JSON.parse(JSON.stringify(state));
    const result = change(draft);
    if (result === false) return false;
    if (JSON.stringify(draft) === JSON.stringify(state)) {
      // A repeated manual decision still fences earlier queued work, even
      // when it saves identical bytes within the same clock millisecond.
      if (event) notify(event);
      return result;
    }
    try {
      if (typeof storage?.set !== 'function') throw Error('Storage unavailable');
      storage.set(CLAUDE_INBOX_STORE, draft);
      // The desktop SDK can silently swallow quota/permission errors. A write is
      // committed only after an exact structural readback, including string stores.
      const saved = storage.get?.(CLAUDE_INBOX_STORE);
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
      if (canonical(parsed) !== canonical(draft)) throw Error('Inbox storage readback failed');
      state = draft;
      error = null;
      notify(event);
      return result;
    } catch {
      error = 'Inbox state could not be saved. No Inbox changes were applied.';
      notify();
      return false;
    }
  };
  return {
    key: (scope, session) => rootKey(state, scope, session),
    isSettled(scope, session) { const key = rootKey(state, scope, session); return !!(key && state.records[key]?.settledAt); },
    isManualSettled(scope, session) { const key = rootKey(state, scope, session); return !!(key && state.records[key]?.settledAt && state.records[key].manualSettled === true); },
    snoozedUntil(scope, session) { const key = rootKey(state, scope, session); return key && state.records[key]?.snoozeUntil || null; },
    isSnoozed(scope, session, now = Date.now()) {
      const key = rootKey(state, scope, session);
      return !!(key && state.records[key]?.snoozeUntil > now);
    },
    snooze(scope, session, until) {
      if (!validTimestamp(until) || until <= Date.now()) return false;
      return transaction(draft => {
        const item = associate(draft, scope, session);
        if (!item) return false;
        item.record.snoozeUntil = until; item.record.snoozedAt = snoozeTime(draft);
        return true;
      });
    },
    cancelSnooze(scope, session) {
      const restoreKey = rootKey(state, scope, session);
      if (state.records[restoreKey]?.snoozeUntil && restoreAttention?.(scope, session) === false) { notify(); return false; }
      return transaction(draft => {
        const key = rootKey(draft, scope, session);
        if (!key) return false;
        if (draft.records[key]?.snoozeUntil) {
          draft.records[key].snoozeUntil = null; draft.records[key].snoozedAt = snoozeTime(draft);
        }
        return true;
      });
    },
    nextSnoozeDeadline(now = Date.now()) {
      let next = null;
      for (const record of Object.values(state.records)) {
        if (record.snoozeUntil > now && (next === null || record.snoozeUntil < next)) next = record.snoozeUntil;
      }
      return next;
    },
    // Runtime-owned timers call this on expiry/resume. No persistence write is needed:
    // isSnoozed always reads the wall clock, and subscribe wakes native React badges.
    expireSnoozes(now = Date.now()) {
      let changed = false;
      for (const [key, record] of Object.entries(state.records)) {
        const token = JSON.stringify([record.snoozedAt, record.snoozeUntil]);
        if (record.snoozeUntil && record.snoozeUntil <= now && expired.get(key) !== token) {
          expired.set(key, token); changed = true;
        }
      }
      if (changed) notify();
      return changed;
    },
    settle(scope, session, options = {}) {
      return transaction(draft => {
        const item = associate(draft, scope, session);
        if (!item) return false;
        const count = session?.message_count;
        if (Number.isSafeInteger(count) && count >= 0) putCount(item.record, item.id, count);
        item.record.settledAt = Date.now();
        if (options.manual === true) item.record.manualSettled = true;
        else delete item.record.manualSettled;
        return true;
      }, options.manual === true ? { type: 'manual-settle', scope, session } : undefined);
    },
    unsettle(scope, session) {
      const restoreKey = rootKey(state, scope, session);
      if (state.records[restoreKey]?.settledAt && restoreAttention?.(scope, session) === false) { notify(); return false; }
      return transaction(draft => {
        const key = rootKey(draft, scope, session);
        if (!key) return false;
        if (draft.records[key]) { draft.records[key].settledAt = null; delete draft.records[key].manualSettled; }
        return true;
      });
    },
    reopen(scope, session) {
      if (restoreAttention?.(scope, session) === false) { notify(); return false; }
      return transaction(draft => {
        const item = associate(draft, scope, session);
        if (!item) return false;
        item.record.settledAt = null; delete item.record.manualSettled;
        if (item.record.snoozeUntil) {
          item.record.snoozeUntil = null; item.record.snoozedAt = snoozeTime(draft);
        }
        return true;
      });
    },
    ingest(scope, sessions = [], options = {}) {
      if (!claudeInboxScope(scope)) return false;
      return transaction(draft => {
        for (const session of sessions) {
          const item = associate(draft, scope, session);
          if (!item) continue;
          const count = session?.message_count;
          if (Number.isSafeInteger(count) && count >= 0) {
            const previous = Object.prototype.hasOwnProperty.call(item.record.watermarks, item.id) ? item.record.watermarks[item.id] : undefined;
            if (previous !== undefined && count > previous && item.record.manualSettled !== true) item.record.settledAt = null;
            putCount(item.record, item.id, count);
          }
        }
        for (const session of options.liveSessions || []) {
          if (!accept(scope, session) || claudeInboxWorkStatus(session) !== 'work') continue;
          const item = associate(draft, scope, session);
          if (item && item.record.manualSettled !== true) item.record.settledAt = null;
        }
        return true;
      });
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get error() { return error; }
  };
}

// Current routing and immutable creation surfaces may differ after a resume.
// Unknown/new source kinds require an explicit compatibility review, not a guess.
function claudeInboxSource(session) {
  if (!session || typeof session !== 'object') return 'unknown';
  const source = session.source, created = session.created_source;
  if (source === 'cron' || created === 'cron') return 'cron';
  const known = ['desktop', 'tui', 'cli', 'web', 'local', 'api', 'api_server', 'tool', 'subagent', 'kanban',
    'telegram', 'discord', 'whatsapp', 'whatsapp_cloud', 'slack', 'signal', 'mattermost', 'matrix',
    'homeassistant', 'email', 'sms', 'dingtalk', 'webhook', 'msgraph_webhook', 'feishu', 'wecom',
    'wecom_callback', 'weixin', 'bluebubbles', 'qqbot', 'yuanbao', 'relay',
    'line', 'teams', 'ntfy', 'simplex', 'irc', 'a2a', 'raft', 'buzz', 'photon', 'google_chat'];
  if (!known.includes(source) || created != null && !known.includes(created)) return 'unknown';
  return 'noncron';
}

// v1 admissions mixed creation/open/work and cannot certify which happened.
// Keep that store untouched as a backup; v2 starts with verified work only.
// User Settle/Snooze records and aliases live in their unchanged separate store.
function createClaudeInboxAdmission(storage, model) {
  const storeKey = 'inbox-admission-v2';
  let state = { version: 2, admitted: {}, blocked: {} }, error = null, readable = false;
  const pendingAdmissions = new Map(), blocked = new Set(), sources = new Map();
  const scopeKey = scope => { const valid = claudeInboxScope(scope); return valid ? JSON.stringify([valid.connectionId, valid.profile]) : null; };
  const validKey = (key, length) => {
    try { const tuple = JSON.parse(key); return Array.isArray(tuple) && tuple.length === length && typeof tuple[0] === 'string' && tuple.slice(1).every(v => typeof v === 'string' && v); }
    catch { return false; }
  };
  const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
  const load = () => {
    try {
      if (typeof storage?.get !== 'function') throw Error('Storage unavailable');
      const raw = storage.get(storeKey), saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (saved != null) {
        const objectMap = value => value && typeof value === 'object' && !Array.isArray(value);
        if (saved.version !== 2 || !objectMap(saved.admitted) || !objectMap(saved.blocked)) throw Error('Invalid Inbox admission');
        for (const records of [saved.admitted, saved.blocked]) {
          for (const [key, value] of Object.entries(records)) if (!validKey(key, 3) || value !== true) throw Error('Invalid Inbox admission');
        }
        state = JSON.parse(JSON.stringify(saved));
        Object.keys(state.blocked).forEach(key => blocked.add(key));
      }
      readable = true; error = null; return true;
    } catch {
      readable = false; error = 'Inbox admission could not be read. Historical chats remain excluded until storage recovers.'; return false;
    }
  };
  load();
  const ids = session => [...new Set([claudeInboxId(session), session?._lineage_root_id,
    ...(Array.isArray(session?._lineage_ids) ? session._lineage_ids : [])].filter(id => typeof id === 'string' && id))];
  const keys = (scope, session) => [...new Set([...ids(session).map(id => claudeInboxKey(scope, id)), model?.key(scope, session)].filter(Boolean))];
  const allowed = (scope, session) => {
    if (!scopeKey(scope) || !claudeInboxOwnedBy(scope, session)) return false;
    const rowKeys = keys(scope, session);
    if (!rowKeys.length || rowKeys.some(key => blocked.has(key) || state.blocked[key])) return false;
    // Strings and captured Undo identities use known, already verified work.
    // A full metadata row cannot borrow a previous safe classification.
    if (session && typeof session === 'object' && Object.hasOwn(session, 'source')) {
      if (claudeInboxSource(session) !== 'noncron') return false;
    } else if (session && typeof session === 'object' && Object.keys(session).some(key =>
      !['id', 'session_id', 'profile', 'connectionId', 'connection_id', '_connection_id', '_lineage_root_id', '_lineage_ids'].includes(key))) return false;
    return !rowKeys.some(key => sources.has(key) && sources.get(key) !== 'noncron');
  };
  const eligible = (draft, scope, session) => allowed(scope, session) && keys(scope, session).some(key => draft.admitted[key] === true);
  const recordSessionIds = (scope, records) => {
    if (!readable || !scopeKey(scope)) return [];
    const owner = scopeKey(scope), ids = new Map();
    for (const key of Object.keys(records)) {
      const tuple = JSON.parse(key);
      if (JSON.stringify(tuple.slice(0, 2)) === owner) ids.set(model?.key(scope, tuple[2]) || key, tuple[2]);
    }
    return [...ids.values()];
  };
  return {
    cutoff: () => null,
    isEligible: (scope, session) => readable && eligible(state, scope, session),
    restore: (scope, session) => readable && eligible(state, scope, session),
    explicitSessionIds() { return []; },
    admittedSessionIds(scope) { return recordSessionIds(scope, state.admitted).filter(id => allowed(scope, id)); },
    observe(scope, sessions = [], options = {}) {
      const owner = scopeKey(scope);
      if (!owner) return false;
      if (!pendingAdmissions.has(owner)) pendingAdmissions.set(owner, new Set());
      const pending = pendingAdmissions.get(owner), working = new Set();
      // Classify the complete snapshot before admitting anything. Cron taint
      // follows only supported lineage/aliases, including late discovery.
      const rows = sessions.filter(session => claudeInboxId(session) && claudeInboxOwnedBy(scope, session));
      const classifications = new Map(), provenance = new Map();
      for (const session of rows) {
        const source = claudeInboxSource(session);
        for (const key of keys(scope, session)) {
          const prior = classifications.get(key);
          const conflict = prior === 'noncron' && source === 'noncron' && provenance.get(key) !== session.source;
          classifications.set(key, prior === 'cron' || source === 'cron' ? 'cron' : conflict || prior && prior !== source ? 'unknown' : source);
          if (!provenance.has(key)) provenance.set(key, session.source);
        }
      }
      classifications.forEach((source, key) => { sources.set(key, source); if (source === 'cron') blocked.add(key); });
      let changed;
      do {
        changed = false;
        for (const session of rows) {
          const rowKeys = keys(scope, session);
          if (rowKeys.some(key => blocked.has(key))) for (const key of rowKeys) if (!blocked.has(key)) { blocked.add(key); changed = true; }
        }
      } while (changed);
      for (const session of options.workingSessions || []) if (allowed(scope, session) && claudeInboxSource(session) === 'noncron') keys(scope, session).forEach(key => working.add(key));
      for (const live of options.liveSessions || []) {
        if (!claudeInboxOwnedBy(scope, live) || claudeInboxWorkStatus(live) !== 'work') continue;
        const liveIds = [...ids(live), live.session_key, live.stored_session_id].filter(Boolean);
        // Do not invent a durable chat from a transient runtime ID.
        for (const row of rows) if (allowed(scope, row) && claudeInboxSource(row) === 'noncron' && ids(row).some(id => liveIds.includes(id))) keys(scope, row).forEach(key => working.add(key));
      }
      // Keep verified work intent pending across a failed save and subsequent
      // idle refresh. It is still excluded until a durable readback succeeds.
      working.forEach(key => pending.add(key));
      if (!readable && !load()) return false;
      const draft = JSON.parse(JSON.stringify(state));
      for (const session of rows) {
        if (!allowed(scope, session) || claudeInboxSource(session) !== 'noncron') continue;
        const rowKeys = keys(scope, session);
        if (eligible(draft, scope, session) || rowKeys.some(key => working.has(key))) {
          for (const key of rowKeys) { draft.admitted[key] = true; pending.add(key); }
        }
      }
      for (const key of pending) if (!blocked.has(key) && sources.get(key) === 'noncron') draft.admitted[key] = true;
      for (const key of blocked) { draft.blocked[key] = true; delete draft.admitted[key]; pending.delete(key); }
      if (canonical(draft) === canonical(state) && !error) { pending.clear(); return true; }
      try {
        if (typeof storage?.set !== 'function') throw Error('Storage unavailable');
        storage.set(storeKey, draft);
        const raw = storage.get(storeKey), saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (canonical(saved) !== canonical(draft)) throw Error('Inbox admission readback failed');
        state = draft; pending.clear(); error = null; return true;
      } catch {
        error = 'Inbox admission could not be saved. New admissions were not applied; existing attention is preserved.'; return false;
      }
    },
    get error() { return error; }
  };
}

function installClaudeInboxRuntime({ storage, host, document: doc = document, window: win = window }) {
  // Hot reload replaces only this DOM adapter, never the host's native children.
  const registryKey = '__claudeInboxRuntimeDispose';
  doc[registryKey]?.();
  let admission;
  const model = createClaudeInboxModel(storage, {
    restoreAttention: (scope, session) => admission.restore(scope, session)
  });
  admission = createClaudeInboxAdmission(storage, model);
  let on = false;
  try { on = storage?.get?.('inbox', 'off') === 'on'; } catch { /* Fail closed until the parent supplies a mode. */ }
  let disposed = false, raf = null, island = null, style = null, container = null;
  let deadlineTimer = null, armingDeadline = false, snoozePopup = null;
  const rowBindings = new Map();
  const settleNotices = new Map();
  const activityByKey = new Map();
  const timerHost = win.setTimeout ? win : doc.defaultView;
  const clearDeadline = () => { if (deadlineTimer !== null) timerHost.clearTimeout(deadlineTimer); deadlineTimer = null; };
  const refreshDeadline = () => {
    if (armingDeadline) return;
    armingDeadline = true;
    try {
      clearDeadline();
      if (disposed || !on) return;
      model.expireSnoozes();
      const next = model.nextSnoozeDeadline();
      if (next !== null) deadlineTimer = timerHost.setTimeout(() => {
        deadlineTimer = null; refreshDeadline(); requestRender();
      }, Math.max(1, Math.min(2147483647, next - Date.now())));
    } finally { armingDeadline = false; }
  };
  let inboxOpen = true, signature = null, currentScope = null;
  let input = { sessions: [], liveSessions: [], liveStatusKnown: false, loading: true };
  const badgeBindings = new Map();
  const settledBadgeBindings = new Map();
  const externalBindings = new Map();
  const own = 'data-claude-inbox-owned';
  const owns = node => node?.nodeType === 1 ? !!node.closest(`[${own}]`) : !!node?.parentElement?.closest(`[${own}]`);
  const setAttr = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value)); };
  const visibleSessions = () => {
    const rows = new Map();
    for (const session of input.sessions) {
      if (!claudeInboxId(session) || session.archived || session.hidden || !claudeInboxOwnedBy(currentScope, session)) continue;
      const key = model.key(currentScope, session);
      if (!rows.has(key)) rows.set(key, session);
    }
    return [...rows.values()];
  };
  const inboxSessions = () => visibleSessions().filter(session => admission.isEligible(currentScope, session));
  const findSession = id => visibleSessions().find(s => claudeInboxId(s) === id || s._lineage_root_id === id || s._lineage_ids?.includes(id));
  const durableAliases = session => new Set([claudeInboxId(session), session?._lineage_root_id, ...(session?._lineage_ids || [])].filter(Boolean));
  const liveMatches = (session, live) => {
    const ids = durableAliases(session);
    if (Object.hasOwn(live, '_claudeInboxCanonicalId')) return typeof live._claudeInboxCanonicalId === 'string' && ids.has(live._claudeInboxCanonicalId);
    const stored = [live.session_key, live.stored_session_id, live._lineage_root_id, ...(live._lineage_ids || [])].filter(Boolean);
    // Legacy authorized fixtures may omit stored fields. Once present, they
    // identify the lineage; equality with a runtime ID is never a relationship.
    if (stored.length) return stored.some(id => ids.has(id));
    return [live.id, live.session_id].some(id => ids.has(id));
  };
  const eventSession = event => {
    if (Object.hasOwn(event, 'canonicalSessionId')) return typeof event.canonicalSessionId === 'string' && event.canonicalSessionId
      ? findSession(event.canonicalSessionId) : null;
    const id = event.session_id || event.id || event.session_key;
    return findSession(id) || visibleSessions().find(session => runtimeAliases(session).has(id));
  };
  const runtimeAliases = session => {
    const aliases = durableAliases(session);
    for (const live of input.liveSessions || []) {
      if (!claudeInboxOwnedBy(currentScope, live) || !liveMatches(session, live)) continue;
      const runtimeId = live.session_id || live.id;
      if (runtimeId) aliases.add(runtimeId);
    }
    return aliases;
  };
  const safety = (session, admissionCheck = false) => {
    let unresolved = input.liveStatusKnown !== true;
    let reading = false;
    for (const live of input.liveSessions || []) {
      if (!claudeInboxOwnedBy(currentScope, live)) continue;
      if (!liveMatches(session, live)) continue;
      const status = claudeInboxWorkStatus(live);
      if (status === 'work') return 'work';
      if (status === 'unknown') unresolved = true;
      if (status === 'reading') reading = true;
    }
    for (const id of admissionCheck && input.busyOwnerKnown === false ? [] : durableAliases(session)) {
      const busy = input.busyBySession instanceof Map ? input.busyBySession.get(id) : input.busyBySession?.[id];
      if (busy === undefined) continue;
      const status = claudeInboxWorkStatus(busy);
      if (status === 'work') return 'work';
      if (status === 'unknown') unresolved = true;
      if (status === 'reading') reading = true;
    }
    return unresolved ? 'unknown' : reading ? 'reading' : 'idle';
  };
  const freshChildSnapshot = snapshot => {
    if (typeof snapshot?.session_id !== 'string' || !snapshot.session_id || !Number.isFinite(snapshot.at) || snapshot.at <= 0 ||
        !Array.isArray(snapshot.childIds) || snapshot.childIds.some(id => typeof id !== 'string' || !id)) return null;
    const session = findSession(snapshot.session_id);
    if (!session) return null;
    const key = model.key(currentScope, session), previous = activityByKey.get(key);
    if (snapshot.at <= (previous?.childEventAt || 0) || snapshot.at <= (previous?.childSnapshotAt || 0)) return null;
    const childIds = snapshot.childIds.filter(id => !previous?.terminalChildren?.has(id) &&
      (!previous?.terminalChildrenOverflow || previous.children?.has(id) || previous.pendingChildren?.has(id)));
    return { session, key, previous, childIds };
  };
  const reconcileAdmission = () => {
    const sessions = visibleSessions(), working = input.loading || input.error || input.liveStatusKnown !== true ? [] : sessions.filter(session => safety(session, true) === 'work');
    const childWorking = input.loading || input.error || input.liveStatusKnown !== true ? [] : (input.childSnapshots || [])
      .map(freshChildSnapshot).filter(fresh => fresh?.childIds.length).map(fresh => fresh.session);
    // Rendering deduplicates lineage rows, never their source evidence. A late
    // cron ancestor/alias must taint the whole thread whichever row comes first.
    admission.observe(currentScope, input.sessions, { workingSessions: [...working, ...childWorking] });
    // Child proof admits work, not a new attention decision. Parent work keeps
    // its existing ingestion rules; child snapshots never clear Settle/Snooze.
    model.ingest(currentScope, sessions, { liveSessions: working.map(session => ({ ...session, status: 'working' })) });
  };
  const reconcileActivity = () => {
    if (input.loading || input.error) return;
    for (const session of inboxSessions()) {
      const key = model.key(currentScope, session), previous = activityByKey.get(key);
      const status = safety(session, true), newer = Number.isFinite(input.liveStatusAt) && input.liveStatusAt > (previous?.at || 0);
      // A terminal frame precedes backend cleanup. A late working snapshot
      // cannot cancel that receipt; a new positive work event can.
      if (status === 'work' && !previous?.parentFinished && !['completed', 'read'].includes(previous?.phase) && (!previous || newer)) {
        activityByKey.set(key, { ...previous, phase: 'working', at: input.liveStatusAt || Date.now(), children: previous?.children || new Set() });
      } else if (status === 'idle' && previous?.phase === 'working' && newer) {
        activityByKey.set(key, { ...previous, phase: session.unread === true ? 'completed' : 'unknown', at: input.liveStatusAt });
      }
    }
  };
  const reconcileChildActivity = () => {
    if (input.loading || input.error || input.liveStatusKnown !== true) return;
    for (const snapshot of input.childSnapshots || []) {
      // Request-start ordering fences in-flight reads against child lifecycle
      // events. Parent snapshots and attention decisions have separate clocks.
      const fresh = freshChildSnapshot(snapshot);
      if (!fresh) continue;
      const { key, previous, childIds } = fresh;
      // Native rosters omit queued spawns until registration. A fresh empty
      // roster cannot cancel that proved intent; start/complete can release it.
      const pendingChildren = new Set([...(previous?.pendingChildren || [])].filter(id => !childIds.includes(id)));
      activityByKey.set(key, { ...previous, phase: previous?.phase || 'unknown', at: previous?.at || 0,
        children: new Set([...childIds, ...pendingChildren]), pendingChildren, childSnapshotAt: snapshot.at });
    }
  };
  const viewedReply = session => {
    const owner = claudeInboxScope(host.state?.focusedSessionOwner?.get?.());
    const stored = host.state?.focusedStoredSessionId?.get?.();
    const runtime = host.state?.focusedSessionId?.get?.();
    if (!owner || !stored || !runtime || JSON.stringify(owner) !== JSON.stringify(currentScope) ||
        !runtimeAliases(session).has(stored) || doc.visibilityState !== 'visible' || !doc.hasFocus()) return false;
    const anchors = new Set([...runtimeAliases(session)].map(id => `session-tile:${id}`));
    if (host.state?.activeSessionId?.get?.() === runtime &&
        host.state?.connectionId?.get?.() === owner.connectionId && host.state?.profile?.get?.() === owner.profile) anchors.add('workspace');
    for (const surface of doc.querySelectorAll('[data-chat-surface][data-session-anchor]')) {
      if (!anchors.has(surface.getAttribute('data-session-anchor')) ||
          surface.closest('[data-pane-hidden], [inert], [aria-hidden="true"], [data-session-switching]')) continue;
      const viewport = surface.querySelector('[data-slot="aui_thread-viewport"]');
      if (!viewport || viewport.getAttribute('data-following') !== 'true') continue;
      const pair = [...viewport.querySelectorAll('[data-slot="aui_turn-pair"]')].at(-1);
      // Native footers belong to the last text reply, not a trailing tool-only bubble.
      const reply = pair && [...pair.querySelectorAll('[data-slot="aui_assistant-message-root"]')]
        .filter(root => root.closest('[data-slot="aui_turn-pair"]') === pair && root.querySelector('[data-slot="aui_msg-actions"]')).at(-1);
      if (!reply) continue;
      const bounds = viewport.getBoundingClientRect(), end = reply.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0 && end.width > 0 && end.height > 0 &&
          end.bottom > bounds.top && end.bottom <= bounds.bottom + 1 && end.right > bounds.left && end.left < bounds.right) return true;
    }
    return false;
  };
  const workState = session => {
    if (input.loading || input.error || input.liveStatusKnown !== true) return 'unknown';
    const key = model.key(currentScope, session), status = safety(session, true), activity = activityByKey.get(key);
    if (status === 'unknown') return 'unknown';
    if (activity?.children.size) return 'working';
    if (status === 'reading') return 'reading';
    if (activity?.phase === 'working') return 'working';
    if (activity?.phase === 'read') return 'idle';
    if (activity?.phase === 'unknown' && activity.parentFinished) return 'unknown';
    if (activity?.phase === 'completed' || status === 'idle' && session.unread === true) {
      if (!viewedReply(session)) return 'completed';
      // Reading acknowledges this reply's paint only. It never settles,
      // snoozes or admits a thread, and fresh work resets the receipt.
      activityByKey.set(key, { ...activity, phase: 'read', at: activity?.at || Date.now(), children: activity?.children || new Set() });
      return 'idle';
    }
    if (status === 'work' && !activity?.parentFinished) return 'working';
    if (activity?.phase === 'unknown') return 'unknown';
    // Native unread marks a completed reply. Merely idle/busy:false does not.
    return session.unread === true ? 'completed' : 'idle';
  };
  const requestRender = () => {
    if (!disposed && raf === null) raf = win.requestAnimationFrame(() => { raf = null; render(); });
  };
  const button = (label, handler) => {
    const el = doc.createElement('button');
    el.type = 'button'; el.textContent = label; el.addEventListener('click', handler);
    return el;
  };
  const stop = event => { event.preventDefault(); event.stopPropagation(); };
  const routeOptions = () => ({ profile: currentScope.profile, route: { ...currentScope } });
  const open = session => { if (!disposed && on && currentScope && claudeInboxOwnedBy(currentScope, session)) host.openSession?.(claudeInboxId(session), routeOptions()); };
  const active = session => {
    const stored = host.state?.focusedStoredSessionId?.get?.();
    const id = stored || host.state?.activeSessionId?.get?.();
    const focusedOwner = host.state?.focusedSessionOwner?.get?.();
    if (focusedOwner != null) {
      const owner = claudeInboxScope(focusedOwner);
      if (!owner || owner.profile !== currentScope.profile || owner.connectionId !== currentScope.connectionId) return false;
    } else {
      const profile = host.state?.focusedSessionProfile?.get?.() || host.state?.profile?.get?.();
      const connection = host.state?.connectionId?.get?.();
      if (profile && profile !== currentScope.profile || typeof connection === 'string' && connection !== currentScope.connectionId) return false;
    }
    return !!id && runtimeAliases(session).has(id);
  };
  const removeFromInbox = (session, save) => {
    const isCurrent = active(session);
    const all = inboxSessions();
    const index = all.findIndex(s => model.key(currentScope, s) === model.key(currentScope, session));
    const following = [...all.slice(index + 1), ...all.slice(0, Math.max(0, index))];
    const candidates = following.filter(s => model.key(currentScope, s) !== model.key(currentScope, session) && !model.isSettled(currentScope, s) && !model.isSnoozed(currentScope, s));
    if (!save()) return false;
    if (isCurrent) {
      if (candidates.length) open(candidates[0]);
      else host.newChat?.({ ...currentScope });
    }
    requestRender();
    return true;
  };
  const sameScope = scope => JSON.stringify(claudeInboxScope(scope)) === JSON.stringify(currentScope);
  const clearSettleNotice = item => {
    if (settleNotices.get(item.key) !== item) return;
    timerHost.clearTimeout(item.timer); settleNotices.delete(item.key);
  };
  const clearSettleNotices = () => { for (const item of settleNotices.values()) clearSettleNotice(item); };
  const undoSettle = item => {
    if (disposed || !on || !sameScope(item.scope) || settleNotices.get(item.key) !== item) return false;
    // Check the deadline in the handler too: sleeping/throttled timers confer no
    // extra time. The captured owner and durable identity never follow new focus.
    if (Date.now() >= item.until) { clearSettleNotice(item); requestRender(); return false; }
    if (!model.unsettle(item.scope, item.session)) { requestRender(); return false; }
    clearSettleNotice(item); requestRender(); return true;
  };
  const settle = session => {
    if (disposed || !on || !currentScope || !claudeInboxOwnedBy(currentScope, session)) return false;
    const fresh = findSession(claudeInboxId(session));
    if (!fresh || claudeInboxId(fresh) !== claudeInboxId(session) || !admission.isEligible(currentScope, fresh) ||
        model.isSettled(currentScope, fresh) || model.isSnoozed(currentScope, fresh)) return false;
    const scope = { ...currentScope };
    const result = removeFromInbox(fresh, () => {
      if (!model.settle(scope, fresh, { manual: true })) return false;
      const key = model.key(scope, fresh);
      clearSettleNotices();
      const captured = { id: claudeInboxId(fresh), ...scope };
      if (fresh._lineage_root_id) captured._lineage_root_id = fresh._lineage_root_id;
      if (Array.isArray(fresh._lineage_ids)) captured._lineage_ids = [...fresh._lineage_ids];
      const item = { key, scope, session: captured, until: Date.now() + 3000, timer: null };
      settleNotices.set(key, item);
      item.timer = timerHost.setTimeout(() => { clearSettleNotice(item); requestRender(); }, 3000);
      return true;
    });
    if (result) render();
    return result;
  };
  const snooze = (session, until, scope = currentScope) => {
    if (disposed || !on || !currentScope || !sameScope(scope) || input.loading || input.error ||
        !claudeInboxOwnedBy(currentScope, session) || model.isSettled(currentScope, session)) return false;
    const fresh = findSession(claudeInboxId(session));
    return fresh ? removeFromInbox(fresh, () => model.snooze(currentScope, fresh, until)) : false;
  };
  const cancelSnooze = (session, scope = currentScope) => {
    if (disposed || !on || !currentScope || !sameScope(scope)) return false;
    return model.cancelSnooze(currentScope, session);
  };
  const closeSnoozePopup = (restoreFocus = true) => {
    const item = snoozePopup;
    if (!item) return;
    snoozePopup = null; item.element.remove();
    item.anchor.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', item.outside, true);
    doc.removeEventListener('keydown', item.keydown, true);
    win.removeEventListener?.('resize', item.position);
    doc.removeEventListener('scroll', item.position, true);
    if (restoreFocus && item.anchor.isConnected) item.anchor.focus();
  };
  const rowSession = row => {
    const binding = rowBindings.get(row.getAttribute('data-claude-inbox-key'));
    return !disposed && on && binding?.row === row && row.isConnected && sameScope(binding.scope) ? findSession(binding.id) : null;
  };
  const showSnoozePopup = (session, anchor, event) => {
    if (disposed || !on || !currentScope || input.loading || input.error) return;
    if (snoozePopup?.anchor === anchor) {
      const pointer = event?.detail > 0;
      closeSnoozePopup(!pointer);
      if (pointer && doc.activeElement === anchor) anchor.blur();
      return;
    }
    closeSnoozePopup(false);
    const element = doc.createElement('div');
    element.setAttribute(own, 'popup'); element.setAttribute('data-claude-inbox-snooze-popup', '');
    element.setAttribute('role', 'menu'); element.setAttribute('aria-label', 'Snooze thread');
    const item = { element, anchor, id: claudeInboxId(session), scope: { ...currentScope } };
    snoozePopup = item; anchor.setAttribute('aria-expanded', 'true');
    const choose = duration => {
      if (snoozePopup !== item || !sameScope(item.scope) || disposed || !on) return;
      const fresh = findSession(item.id);
      if (fresh && snooze(fresh, Date.now() + duration, item.scope)) closeSnoozePopup(false);
      // A failed save keeps this exact menu open. Errors paint in the Inbox,
      // never as extra menu options, fields or a footer.
      else requestRender();
    };
    const controls = [];
    for (const [label, duration] of [['15 min', 900000], ['30 min', 1800000], ['1 hour', 3600000], ['3 hours', 10800000], ['1 day', 86400000]]) {
      const option = button(label, event => { stop(event); choose(duration); });
      option.setAttribute('role', 'menuitem'); option.tabIndex = -1;
      option.addEventListener('pointermove', () => {
        if (snoozePopup === item && doc.activeElement !== option) option.focus({ preventScroll: true });
      });
      controls.push(option); element.appendChild(option);
    }
    item.position = () => {
      const rect = anchor.getBoundingClientRect();
      const view = doc.defaultView, width = Math.min(160, Math.max(0, view.innerWidth - 16));
      element.style.width = `${width}px`;
      element.style.left = `${Math.max(8, Math.min(rect.right - width, view.innerWidth - width - 8))}px`;
      const height = element.getBoundingClientRect().height;
      element.style.top = `${Math.max(8, Math.min(rect.bottom + 4, view.innerHeight - height - 8))}px`;
    };
    item.outside = event => { if (!element.contains(event.target) && !anchor.contains(event.target)) closeSnoozePopup(false); };
    item.keydown = event => {
      // Dismissal never cancels the host's original event or steals an outside
      // click. Only menu-owned navigation/activation consumes a key.
      if (event.key === 'Escape') { closeSnoozePopup(element.contains(doc.activeElement)); return; }
      if (!element.contains(event.target)) return;
      if (event.key === 'Tab') { closeSnoozePopup(false); return; }
      const index = controls.indexOf(doc.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        stop(event);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 :
          (Math.max(0, index) + (event.key === 'ArrowDown' ? 1 : controls.length - 1)) % controls.length;
        controls[next].focus();
      } else if ((event.key === 'Enter' || event.key === ' ') && index >= 0) {
        stop(event); if (!event.repeat) controls[index].click();
      }
    };
    doc.body.appendChild(element); item.position();
    doc.addEventListener('pointerdown', item.outside, true); doc.addEventListener('keydown', item.keydown, true);
    win.addEventListener?.('resize', item.position); doc.addEventListener('scroll', item.position, true);
    element.querySelector('button')?.focus();
  };
  const cleanupDOM = () => {
    closeSnoozePopup(false); clearSettleNotices(); rowBindings.clear();
    island?.remove(); island = null; signature = null; container = null;
    style?.remove(); style = null;
    for (const badge of badgeBindings.values()) badge.remove();
    badgeBindings.clear();
    for (const badge of settledBadgeBindings.values()) badge.remove();
    settledBadgeBindings.clear();
  };
  const nativeHeaderTemplate = root => {
    // Copy only a native header button and its wrapper, never rows, actions,
    // React ownership, or native listeners. Structural matching is locale-safe.
    let wrapper, header;
    for (const section of root.children) {
      if (owns(section) || !section.matches('[data-slot="sidebar-group"]')) continue;
      const candidate = [...section.children].find(el => el.classList.contains('group/section'));
      const source = [...(candidate?.children || [])].find(el => el.matches('button') && el.classList.contains('group/section-label'));
      if (!source?.querySelector('.dither') || !source.querySelector('.codicon-chevron-right') || !source.querySelector('.dither').parentElement.querySelector('.truncate')) continue;
      wrapper = candidate.cloneNode(false); header = source.cloneNode(true); break;
    }
    if (!header) {
      // Exact installed SidebarSectionHeader / SidebarPanelLabel / DisclosureCaret
      // shape, until native Pinned or Sessions mounts. Its classes inherit host fonts.
      wrapper = doc.createElement('div');
      wrapper.className = 'group/section flex shrink-0 items-center justify-between gap-1 pb-1 pt-1.5';
      header = doc.createElement('button');
      header.className = 'group/section-label flex w-fit min-w-0 items-center gap-1 bg-transparent text-left leading-none';
      const label = doc.createElement('span');
      label.className = 'flex min-w-0 items-center gap-2 pl-2 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-(--theme-primary)';
      const dot = doc.createElement('span'); dot.setAttribute('aria-hidden', 'true'); dot.className = 'dither inline-block size-2 shrink-0 rounded-[1px]';
      const text = doc.createElement('span'); text.className = 'min-w-0 truncate leading-none';
      label.append(dot, text);
      const caret = doc.createElement('i'); caret.setAttribute('aria-hidden', 'true'); caret.style.fontSize = '0.75rem';
      caret.className = 'codicon codicon-chevron-right shrink-0 duration-150 text-(--ui-text-tertiary) opacity-0 transition group-hover/section-label:opacity-100';
      header.append(label, caret);
    }
    wrapper.appendChild(header);
    for (const node of [wrapper, ...wrapper.querySelectorAll('*')]) {
      for (const attr of [...node.attributes]) {
        if (/^on/i.test(attr.name) || attr.name === 'id' || attr.name.startsWith('data-claude-inbox-') || ['aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-expanded', 'title'].includes(attr.name)) node.removeAttribute(attr.name);
      }
    }
    header.type = 'button'; header.removeAttribute('disabled');
    header.querySelector('.dither').parentElement.querySelector('.truncate').textContent = 'Inbox';
    header.querySelector('.codicon-chevron-right').classList.remove('rotate-90');
    return { wrapper, header, fingerprint: wrapper.outerHTML };
  };
  const ensureStyle = () => {
    if (style?.isConnected) return;
    style = doc.createElement('style'); style.setAttribute(own, 'style');
    style.textContent = CLAUDE_INBOX_ROW_UI_CSS + `
/* Native Sessions keeps a growing, minimum-height viewport even when closed.
   Allocate the remaining height to Inbox; cap native lists without moving or
   rewriting their React-owned nodes. Removing the island restores the host. */
html[data-claude-chat-look='true'] [data-sessions-mode]:has(> [data-claude-inbox-owned='island']) { overflow:hidden; }
html[data-claude-chat-look='true'] [data-sessions-mode]:has(> [data-claude-inbox-owned='island']) > [data-slot='sidebar-group']:not([data-claude-inbox-owned]) { flex:0 1 auto!important; min-height:0!important; max-height:35%; overflow:hidden; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] + [data-slot='sidebar-group'] { margin-top:auto; }
html[data-claude-chat-look='true'] [data-sessions-mode]:has(> [data-claude-inbox-owned='island']) > [data-slot='sidebar-group']:not([data-claude-inbox-owned]) > [data-slot='sidebar-group-content'] { min-height:0; overflow-y:auto; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] { flex:1 1 0; min-height:3.5rem; color:var(--ui-text-primary); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'][data-claude-inbox-expanded='false'] { flex:0 0 auto; min-height:0; padding-bottom:0; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] > [data-slot='sidebar-group-content'] { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] > [data-slot='sidebar-group-content'][hidden] { display:none!important; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned] button:not(:where([data-claude-inbox-row-ui] button)) { color:inherit; background:transparent; border:0; cursor:pointer; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned] button:not(:where([data-claude-inbox-row-ui] button)):not([data-claude-inbox-header]):hover { background:var(--ui-control-hover-background); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned] button:not(:where([data-claude-inbox-row-ui] button)):focus-visible { outline:1px solid var(--ui-accent); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned] button:not(:where([data-claude-inbox-row-ui] button)):disabled { color:var(--ui-text-quaternary); cursor:default; }
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] { position:fixed; z-index:var(--z-modal-popover, 140); box-sizing:border-box; display:flex; flex-direction:column; padding:4px; max-height:calc(100vh - 16px); overflow:auto; border:1px solid var(--ui-stroke-secondary); border-radius:8px; background:color-mix(in srgb, var(--ui-bg-elevated) 96%, transparent); color:var(--ui-text-primary); font:12px var(--font-sans, system-ui); backdrop-filter:blur(12px); }
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] button { padding:4px 8px; text-align:left; border-radius:6px; font:inherit; line-height:16px; }
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] button:is(:hover,:focus) { background:var(--ui-control-active-background); color:var(--ui-text-primary); outline:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge'] { display:inline-flex; font-size:10px; padding:1px 4px; color:var(--ui-text-tertiary); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge'] .claude-inbox-unsettle { display:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:hover .claude-inbox-settled,
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:focus-within .claude-inbox-settled { display:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:hover .claude-inbox-unsettle,
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:focus-within .claude-inbox-unsettle { display:inline; }
html[data-claude-chat-look='true'] [data-claude-inbox-status] { padding:6px 8px; font-size:11px; color:var(--ui-text-tertiary); }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] { position:relative; overflow:hidden; display:flex; align-items:center; justify-content:space-between; gap:8px; margin:2px 4px; padding:4px 8px; border:1px solid var(--ui-stroke-secondary); border-radius:6px; background:var(--ui-sidebar-surface-background,var(--ui-bg-sidebar,var(--ui-bg-elevated))); color:var(--ui-text-primary); font:11px var(--font-sans, system-ui); }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] button { padding:2px 4px; border-radius:4px; font:inherit; }
html[data-claude-chat-look='true'] [data-claude-inbox-undo-track] { pointer-events:none; position:absolute; left:0; right:0; bottom:0; height:2px; background:color-mix(in srgb,var(--ui-accent,var(--ui-text-primary)) 12%,transparent); }
html[data-claude-chat-look='true'] [data-claude-inbox-undo-progress] { display:block; width:100%; height:100%; background:var(--ui-accent,var(--ui-text-primary)); transform-origin:left center; animation:claude-inbox-undo-progress 3s linear both; }
@keyframes claude-inbox-undo-progress { from { transform:scaleX(0); } to { transform:scaleX(1); } }
@media(prefers-reduced-motion:reduce) { html[data-claude-chat-look='true'] [data-claude-inbox-undo-progress] { animation:none; transform:scaleX(1); } }
`;
    (doc.head || doc.documentElement).appendChild(style);
  };
  const nativeSession = row => {
    const bound = externalBindings.get(row);
    return bound && bound.scope.connectionId === currentScope.connectionId && bound.scope.profile === currentScope.profile &&
      admission.isEligible(currentScope, bound.session) ? bound.session : null;
  };
  const renderBadges = root => {
    // Explicit opt-in bindings only. The shipping parent uses SESSION_ROW_AREAS;
    // do not infer identity from native labels, DOM order or conversation anchors.
    const rows = new Set(externalBindings.keys());
    for (const [row, badge] of settledBadgeBindings) {
      const session = rows.has(row) && row.isConnected && root.contains(row) && nativeSession(row);
      if (!session || !model.isSettled(currentScope, session) || !model.isSnoozed(currentScope, session)) { badge.remove(); settledBadgeBindings.delete(row); }
    }
    for (const [row, badge] of badgeBindings) {
      const session = rows.has(row) && row.isConnected && root.contains(row) && nativeSession(row);
      if (!session || !model.isSettled(currentScope, session) && !model.isSnoozed(currentScope, session)) { badge.remove(); badgeBindings.delete(row); }
    }
    for (const row of rows) {
      if (!root.contains(row) || owns(row)) continue;
      const session = nativeSession(row);
      const snoozed = session && model.isSnoozed(currentScope, session);
      if (!session || !model.isSettled(currentScope, session) && !snoozed) continue;
      let badge = badgeBindings.get(row);
      if (!badge?.isConnected) {
        badge?.remove();
        const scope = { ...currentScope };
        badge = button('', event => {
          stop(event);
          if (disposed || !on || !sameScope(scope)) return;
          const fresh = nativeSession(row);
          if (fresh) {
            if (model.isSnoozed(currentScope, fresh)) cancelSnooze(fresh, scope);
            else model.unsettle(currentScope, fresh);
          }
        });
        badge.setAttribute(own, 'badge');
        const label = doc.createElement('span'); label.className = 'claude-inbox-settled';
        const action = doc.createElement('span'); action.className = 'claude-inbox-unsettle';
        badge.append(label, action);
        const target = row.querySelector('[data-row-actions]') || row;
        // Never nest a button inside a native button; use an explicit sibling slot.
        if (target.closest('button')) continue;
        target.appendChild(badge); badgeBindings.set(row, badge);
      }
      const label = badge.querySelector('.claude-inbox-settled'), action = badge.querySelector('.claude-inbox-unsettle');
      const name = snoozed ? 'Wake now' : 'Un-settle', text = snoozed ? 'Snoozed' : 'Settled';
      if (label.textContent !== text) label.textContent = text;
      if (action.textContent !== name) action.textContent = name;
      setAttr(badge, 'aria-label', name);
      const title = snoozed ? `Snoozed until ${new Date(model.snoozedUntil(currentScope, session)).toLocaleString()}. Wake now` : name;
      if (badge.title !== title) badge.title = title;
      // Both states remain independently reversible, including while snoozed.
      if (snoozed && model.isSettled(currentScope, session)) {
        let settledBadge = settledBadgeBindings.get(row);
        if (!settledBadge?.isConnected) {
          settledBadge?.remove();
          const scope = { ...currentScope };
          settledBadge = button('', event => {
            stop(event);
            if (disposed || !on || !sameScope(scope)) return;
            const fresh = nativeSession(row); if (fresh) model.unsettle(currentScope, fresh);
          });
          settledBadge.setAttribute(own, 'badge'); settledBadge.setAttribute('aria-label', 'Un-settle'); settledBadge.title = 'Un-settle';
          const label = doc.createElement('span'); label.className = 'claude-inbox-settled'; label.textContent = 'Settled';
          const action = doc.createElement('span'); action.className = 'claude-inbox-unsettle'; action.textContent = 'Un-settle';
          settledBadge.append(label, action); badge.parentElement.appendChild(settledBadge); settledBadgeBindings.set(row, settledBadge);
        }
      }
    }
  };
  function render() {
    if (disposed) return;
    if (!on || !currentScope) { cleanupDOM(); return; }
    const root = doc.querySelector('[data-sessions-mode]');
    if (!root) { if (container) cleanupDOM(); return; }
    if (container !== root || !island?.isConnected) {
      cleanupDOM(); container = root; ensureStyle();
      island = doc.createElement('div'); island.setAttribute(own, 'island');
      island.setAttribute('data-slot', 'sidebar-group'); island.setAttribute('data-sidebar', 'group');
      island.className = 'relative flex w-full min-w-0 min-h-0 flex-col p-0 pb-1';
      const first = [...root.children].find(el => el.matches('[data-slot="sidebar-group"]'));
      root.insertBefore(island, first || root.firstChild);
    }
    setAttr(island, 'aria-busy', input.loading === true);
    const headerTemplate = nativeHeaderTemplate(root);
    for (const item of settleNotices.values()) {
      if (Date.now() >= item.until || !model.isManualSettled(item.scope, item.session)) clearSettleNotice(item);
    }
    const sessions = inboxSessions().filter(s => !model.isSettled(currentScope, s) && !model.isSnoozed(currentScope, s));
    const shown = sessions;
    const nextSignature = JSON.stringify([currentScope, inboxOpen, input.loading, !!input.error, model.error, admission.error, headerTemplate.fingerprint,
      [...settleNotices.values()].map(item => [item.key, item.until]), sessions.length, shown.map(s => [model.key(currentScope, s), claudeInboxId(s), s.title, safety(s), workState(s), active(s), activityByKey.get(model.key(currentScope, s))?.children.size || 0])]);
    if (signature !== nextSignature) {
      signature = nextSignature;
      setAttr(island, 'data-claude-inbox-expanded', inboxOpen);
      const focusedElement = island.contains(doc.activeElement) ? doc.activeElement : null;
      const focusedHeader = focusedElement?.hasAttribute('data-claude-inbox-header');
      const oldHeader = island.querySelector('[data-claude-inbox-header]');
      const scrollTop = island.querySelector('[data-slot="sidebar-group-content"]')?.scrollTop || 0;
      const reuseHeader = oldHeader?.__claudeInboxTemplate === headerTemplate.fingerprint;
      const header = reuseHeader ? oldHeader : headerTemplate.header;
      const wrapper = reuseHeader ? oldHeader.parentElement : headerTemplate.wrapper;
      if (!reuseHeader) {
        header.__claudeInboxTemplate = headerTemplate.fingerprint;
        const toggle = event => {
          if (disposed || !on || !header.isConnected || !island.contains(header)) return;
          stop(event); inboxOpen = !inboxOpen; requestRender();
        };
        header.addEventListener('click', toggle);
        header.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { stop(event); if (!event.repeat) toggle(event); }
        });
      }
      header.setAttribute('aria-expanded', String(inboxOpen)); header.setAttribute('data-claude-inbox-header', '');
      header.querySelector('.codicon-chevron-right').classList.toggle('rotate-90', inboxOpen);
      // Selection/title updates must not detach working rows and restart their
      // CSS animation. Keep their content owner mounted between projections.
      if (!reuseHeader) oldHeader?.parentElement?.remove();
      if (wrapper.parentElement !== island) island.insertBefore(wrapper, island.firstChild);
      let content = island.querySelector('[data-slot="sidebar-group-content"]');
      if (!content) {
        content = doc.createElement('div'); content.setAttribute('data-slot', 'sidebar-group-content'); content.className = 'w-full text-sm scrollbar-fade';
        island.appendChild(content);
      }
      content.hidden = !inboxOpen;
      for (const child of [...content.children]) if (!child.hasAttribute('data-claude-inbox-row')) child.remove();
      const status = text => { const el = doc.createElement('div'); el.setAttribute('data-claude-inbox-status', ''); el.setAttribute('role', 'status'); el.textContent = text; content.appendChild(el); };
      if (input.error) {
        status('Inbox could not be loaded. Refresh Sessions to retry.');
        if (typeof input.retry === 'function') content.appendChild(button('Retry Inbox', () => input.retry()));
      }

      if (model.error) status(model.error);
      if (admission.error) status(admission.error);
      if (!input.loading && !input.error && !model.error && !admission.error && !sessions.length) status('Inbox is clear. Settled and snoozed threads remain in Sessions and Pinned.');
      const kept = new Set();
      let cursor = content.firstChild;
      for (const session of shown) {
        const key = model.key(currentScope, session);
        if (kept.has(key)) continue;
        kept.add(key);
        let binding = rowBindings.get(key);
        if (!binding) {
          const ui = createClaudeInboxRowUI({
            document: doc,
            onOpen: () => { const fresh = rowSession(ui.row); if (fresh) open(fresh); },
            onMenu: event => { stop(event); const fresh = rowSession(ui.row); if (fresh) settle(fresh); },
            onSnooze: event => { stop(event); const fresh = rowSession(ui.row); if (fresh) showSnoozePopup(fresh, ui.clock, event); }
          });
          ui.row.setAttribute('data-claude-inbox-key', key);

          ui.clock.setAttribute('aria-haspopup', 'menu'); ui.clock.setAttribute('aria-expanded', 'false');
          binding = { ...ui, action: ui.menu }; rowBindings.set(key, binding);
        }
        binding.id = claudeInboxId(session); binding.scope = { ...currentScope };
        const { row, clock, action } = binding;
        setAttr(row, 'data-claude-inbox-row', binding.id);
        setAttr(row, 'data-claude-inbox-active-children', activityByKey.get(key)?.children.size || 0);
        const title = typeof session.title === 'string' && session.title ? session.title : 'Untitled thread';
        binding.update({
          title, selected: active(session), settleAction: true, workState: workState(session),
          menuDisabled: false,
          menuTitle: 'Remove from Inbox only. Work continues.'
        });
        setAttr(action, 'aria-label', `Settle ${title}`); setAttr(clock, 'aria-label', `Snooze ${title}`);
        // Opening stays enabled as before; Snooze does not depend on work status.
        clock.disabled = !!input.loading || !!input.error; clock.title = 'Hide from Inbox for a chosen duration. Work continues.';
        if (row !== cursor) {
          if (row.isConnected && row.parentElement === content && typeof content.moveBefore === 'function') content.moveBefore(row, cursor);
          else content.insertBefore(row, cursor);
        }
        cursor = row.nextSibling;
      }
      for (const item of settleNotices.values()) {
        const notice = doc.createElement('div');
        notice.setAttribute('data-claude-inbox-settle-notice', claudeInboxId(item.session)); notice.setAttribute('role', 'status');
        const label = doc.createElement('span'); label.textContent = 'Settled';
        const undo = button('Undo', event => { stop(event); if (undo.isConnected && island?.contains(undo)) undoSettle(item); });
        const track = doc.createElement('span'); track.setAttribute('data-claude-inbox-undo-track', ''); track.setAttribute('aria-hidden', 'true');
        const progress = doc.createElement('span'); progress.setAttribute('data-claude-inbox-undo-progress', '');
        // A metadata repaint must not restart the visual deadline.
        progress.style.animationDelay = `-${Math.max(0, 3000 - (item.until - Date.now()))}ms`;
        track.appendChild(progress); notice.append(label, undo, track); content.appendChild(notice);
      }
      for (const [key, binding] of rowBindings) if (!kept.has(key)) { binding.row.remove(); rowBindings.delete(key); }
      if (snoozePopup && !snoozePopup.anchor.isConnected) closeSnoozePopup(false);

      content.scrollTop = scrollTop;
      if (focusedElement?.isConnected) focusedElement.focus({ preventScroll: true });
      else if (focusedHeader) header.focus();
      if (snoozePopup) snoozePopup.position();
    }
    renderBadges(root);
  }
  const observer = new win.MutationObserver(records => {
    if (records.some(record => {
      if (owns(record.target)) return false;
      if (record.type === 'attributes' && ['class', 'style'].includes(record.attributeName)) {
        return record.target.closest?.('[data-slot="sidebar-group"]')?.parentElement === container &&
          (record.target.classList.contains('group/section') || !!record.target.closest?.('button.group\\/section-label'));
      }
      if (record.type === 'attributes') return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => !owns(node));
    })) requestRender();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sessions-mode', 'aria-expanded', 'class', 'style', 'data-following', 'data-session-anchor', 'data-session-switching', 'data-pane-hidden'] });
  const offModel = model.subscribe(() => { refreshDeadline(); requestRender(); });
  const resume = () => { if (!disposed && on) { refreshDeadline(); requestRender(); } };
  doc.addEventListener('visibilitychange', resume);
  doc.addEventListener('scroll', resume, true);
  win.addEventListener?.('focus', resume);
  const offActive = ['activeSessionId', 'focusedStoredSessionId', 'focusedSessionOwner', 'focusedSessionProfile', 'profile', 'connectionId'].map(name => host.state?.[name]?.subscribe?.(requestRender)).filter(Boolean);
  const api = {
    model, admission, snooze, cancelSnooze,
    opened() {
      // Native navigation and metadata discovery are not attention decisions.
      return false;
    },
    update(next) {
      if (disposed) return;
      const scope = claudeInboxScope(next.scope);
      if (JSON.stringify(scope) !== JSON.stringify(currentScope)) { cleanupDOM(); activityByKey.clear(); inboxOpen = true; }
      currentScope = scope;
      input = { ...next, sessions: Array.isArray(next.sessions) ? next.sessions : [], liveSessions: Array.isArray(next.liveSessions) ? next.liveSessions : [],
        childSnapshots: Array.isArray(next.childSnapshots) ? next.childSnapshots : [], liveStatusKnown: next.liveStatusKnown ?? Array.isArray(next.liveSessions) };
      if (scope && on) { reconcileAdmission(); reconcileActivity(); reconcileChildActivity(); }
      refreshDeadline(); requestRender();
    },
    // Positive work/input events only. Callers must supply authoritative scope and ID.
    // Background reads/resuming and explicit UI opens do nothing.
    reactivate(event) {
      if (disposed || !on || !currentScope || !event || !claudeInboxOwnedBy(currentScope, event) || JSON.stringify(claudeInboxScope(event.scope)) !== JSON.stringify(currentScope)) return false;
      if (!['work', 'input', 'busy'].includes(event.type) && claudeInboxWorkStatus(event) !== 'work') return false;
      const session = eventSession(event);
      if (!session || input.loading || input.error || input.liveStatusKnown !== true ||
          !admission.observe(currentScope, input.sessions, { workingSessions: [session] }) || !admission.isEligible(currentScope, session)) { requestRender(); return false; }
      if (model.isManualSettled(currentScope, session) && !model.unsettle(currentScope, session)) { requestRender(); return false; }
      const key = model.key(currentScope, session), previous = activityByKey.get(key);
      activityByKey.set(key, { ...previous, phase: 'working', parentFinished: false, at: Date.now(), children: previous?.children || new Set() });
      const result = model.ingest(currentScope, [session], { liveSessions: [{ ...session, status: 'working' }] });
      requestRender(); return result;
    },
    activity(event) {
      if (disposed || !on || !currentScope || !event || event.replayed || !claudeInboxOwnedBy(currentScope, event) ||
          !sameScope({ connectionId: event.connectionId, profile: event.profile })) return false;
      const session = eventSession(event);
      if (!session) return false;
      if (['message.start', 'tool.start'].includes(event.type)) {
        if (event.type === 'tool.start' && model.isManualSettled(currentScope, session)) return false;
        return api.reactivate({ type: 'work', scope: currentScope, session_id: claudeInboxId(session), canonicalSessionId: claudeInboxId(session) });
      }
      const key = model.key(currentScope, session), previous = activityByKey.get(key);
      if (event.type === 'message.complete' && previous?.phase === 'read') return false;
      const activity = { ...previous, phase: previous?.phase || 'unknown', at: previous?.at || 0,
        children: new Set(previous?.children || []), pendingChildren: new Set(previous?.pendingChildren || []),
        terminalChildren: new Set(previous?.terminalChildren || []) };
      if (['subagent.spawn_requested', 'subagent.start', 'subagent.complete'].includes(event.type)) {
        const child = event.payload?.subagent_id;
        if (typeof child !== 'string' || !child) return false;
        if (event.type === 'subagent.complete') {
          if (activity.terminalChildren.has(child) && !activity.children.has(child) && !activity.pendingChildren.has(child)) return true;
          activity.children.delete(child); activity.pendingChildren.delete(child);
          // Native completion is emitted before registry removal. Even a newer
          // roster cannot revive this ID; only another proved spawn/start can.
          // Cap per-thread terminal IDs without evicting safety evidence: on
          // overflow, snapshots may sustain known children but not add IDs.
          if (activity.terminalChildren.size < 256) activity.terminalChildren.add(child);
          else activity.terminalChildrenOverflow = true;
        } else {
          activity.terminalChildren.delete(child);
          if (event.type === 'subagent.spawn_requested') activity.pendingChildren.add(child);
          else activity.pendingChildren.delete(child);
          activity.children.add(child);
        }
        activity.childEventAt = Date.now();
      } else if (event.type === 'message.complete') {
        activity.phase = activity.children.size ? 'unknown' : event.payload?.status === 'complete' && !event.payload.error ? 'completed' : 'unknown';
        activity.parentFinished = true; activity.at = Date.now();
      } else if (event.type === 'error') { activity.phase = 'unknown'; activity.parentFinished = true; activity.at = Date.now(); }
      else return false;
      activityByKey.set(key, activity);
      requestRender(); return true;
    },
    // Parent row-slot integration can bind an exact element without guessing React identity.
    // The row must be outside the Inbox island, inside the native sessions container.
    bindNativeRow(row, session, scope = currentScope) {
      const valid = claudeInboxScope(scope);
      if (disposed || !row || !valid || !claudeInboxId(session)) return () => {};
      const binding = { session, scope: valid }; externalBindings.set(row, binding); requestRender();
      return () => { if (externalBindings.get(row) === binding) { externalBindings.delete(row); badgeBindings.get(row)?.remove(); badgeBindings.delete(row); settledBadgeBindings.get(row)?.remove(); settledBadgeBindings.delete(row); requestRender(); } };
    },
    setMode(value) {
      if (disposed) return false;
      // Parent owns the string-valued preference and any persistence errors.
      on = !!value;
      if (!on) cleanupDOM();
      else if (currentScope) reconcileAdmission();
      refreshDeadline(); requestRender(); return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; clearDeadline(); observer.disconnect(); offModel(); offActive.forEach(fn => fn());
      doc.removeEventListener('visibilitychange', resume); doc.removeEventListener('scroll', resume, true); win.removeEventListener?.('focus', resume);
      if (raf !== null) win.cancelAnimationFrame(raf);
      cleanupDOM(); externalBindings.clear(); activityByKey.clear();
      if (doc[registryKey] === api.dispose) delete doc[registryKey];
    }
  };
  doc[registryKey] = api.dispose;
  refreshDeadline(); requestRender();
  return api;
}
// END GENERATED INBOX RUNTIME
