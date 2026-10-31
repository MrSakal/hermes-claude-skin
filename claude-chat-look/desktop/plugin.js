import{host,PALETTE_AREA,THEMES_AREA,queryClient,useQuery,useValue}from '@hermes/plugin-sdk'
import{useEffect,useRef,useState}from 'react'
import{jsx}from 'react/jsx-runtime'
const ID='claude-chat-look'
const STYLE_ID=`${ID}-styles`
const BUILD_ID='v1.10.0'
const STORAGE_PREFIX=`${ID}:turn:`
const LONG_USER_STATE_SUFFIX=':long-user-expanded'
const MAX_PERSISTED_LONG_USER_STATES=250
const RUNTIME_HANDOFF_KEY='__hermesClaudeChatLookRuntimeHandoff'
const COMPOSER_WIDTH_STORAGE_KEY='composer-width'
const COMPOSER_WIDTH_MODES={
claude:{label:'Claude',next:'claude-wide'},
'claude-wide':{label:'Claude +20 %',next:'claude-wider'},
'claude-wider':{label:'Claude +40 %',next:'hermes'},
hermes:{label:'Hermes',next:'claude'}
}
const PINNED_USER_MESSAGES_STORAGE_KEY='pinned-user-messages'
const CLEAN_TRANSCRIPT_STORAGE_KEY='clean-transcript'
const CLEAN_TRANSCRIPT_EVENT=`${ID}:clean-transcript`
const ASCII_BACKDROP_STORAGE_KEY='ascii-backdrop'
const ASCII_BACKDROP_MODES={
auto:{label:'Seasonal',scene:null,next:'on'},
on:{label:'Water',scene:'water',next:'spring'},
spring:{label:'Spring',scene:'spring',next:'summer'},
summer:{label:'Summer',scene:'summer',next:'autumn'},
autumn:{label:'Autumn',scene:'autumn',next:'winter'},
winter:{label:'Winter',scene:'winter',next:'halloween'},
halloween:{label:'Halloween',scene:'halloween',next:'christmas'},
christmas:{label:'Christmas',scene:'christmas',next:'newyear'},
newyear:{label:'New Year',scene:'newyear',next:'off'},
off:{label:'Off',scene:null,next:'auto'}
}
const ASCII_SEASON_CHECK_MS=60 * 60 * 1000
const PLAYBACK_CLOSE_GRACE_MS=250
const PLAYBACK_MOTION_MS=240
let pluginStorage=null
const SYSTEM_FONT=`-apple-system, system-ui, "Segoe UI", sans-serif`
const HERMES_FONT=SYSTEM_FONT
const CLAUDE_THEME={
name:'claude-chat',
label:'Claude Skin',
description:'Claude Code desktop look: warm ivory light, near-black dark',
colors:{
background:'#FAF9F5',
foreground:'#141413',
card:'#FFFFFF',
cardForeground:'#141413',
muted:'#F0EEE6',
mutedForeground:'#73726C',
popover:'#FFFFFF',
popoverForeground:'#141413',
primary:'#141413',
primaryForeground:'#FAF9F5',
secondary:'#F0EEE6',
secondaryForeground:'#141413',
accent:'#E8E6DC',
accentForeground:'#141413',
border:'#E8E6DC',
input:'#E8E6DC',
ring:'#D97757',
composerRing:'#DEDCD1',
destructive:'#B53333',
destructiveForeground:'#FFFFFF',
sidebarBackground:'#F5F4ED',
sidebarBorder:'#E8E6DC',
userBubble:'#F0EEE6',
userBubbleBorder:'#F0EEE6'
},
darkColors:{
background:'#151515',
foreground:'#F0EFEA',
card:'#20201F',
cardForeground:'#F0EFEA',
muted:'#1D1D1D',
mutedForeground:'#8C8C84',
popover:'#212121',
popoverForeground:'#F0EFEA',
primary:'#F0EFEA',
primaryForeground:'#151515',
secondary:'#212121',
secondaryForeground:'#F0EFEA',
accent:'#2A2A2A',
accentForeground:'#F0EFEA',
border:'#292929',
input:'#343434',
ring:'#D97757',
composerRing:'#4D4D4C',
destructive:'#E5534B',
destructiveForeground:'#FFFFFF',
sidebarBackground:'#111111',
sidebarBorder:'#292929',
userBubble:'#212121',
userBubbleBorder:'#212121'
},
darkTerminal:{
foreground:'#787C99',
cursor:'#C0CAF5',
selectionBackground:'#515C7E4D',
black:'#363B54',
red:'#F7768E',
green:'#73DACA',
yellow:'#E0AF68',
blue:'#7AA2F7',
magenta:'#BB9AF7',
cyan:'#7DCFFF',
white:'#787C99',
brightBlack:'#363B54',
brightRed:'#F7768E',
brightGreen:'#73DACA',
brightYellow:'#E0AF68',
brightBlue:'#7AA2F7',
brightMagenta:'#BB9AF7',
brightCyan:'#7DCFFF',
brightWhite:'#ACB0D0'
},
typography:{
fontSans:SYSTEM_FONT,
fontMono:`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
}
}
const MIC_MASK=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M18.5848 13.4121C18.7715 12.9516 19.2961 12.7296 19.7567 12.916C20.217 13.1027 20.4391 13.6274 20.2528 14.0879C19.0405 17.0826 16.2438 19.2675 12.9003 19.6035V22C12.9003 22.4971 12.4969 22.9004 11.9999 22.9004C11.5029 22.9003 11.0995 22.497 11.0995 22V19.6035C7.75618 19.2673 4.96018 17.0823 3.74791 14.0879C3.56144 13.6272 3.78344 13.1026 4.244 12.916C4.70458 12.7298 5.22933 12.9517 5.41588 13.4121C6.46985 16.0157 9.02264 17.8496 12.0008 17.8496C14.9787 17.8493 17.531 16.0155 18.5848 13.4121ZM11.9999 1.34961C14.7061 1.34961 16.9003 3.5438 16.9003 6.25V10.7334C16.9003 13.4396 14.7061 15.6338 11.9999 15.6338C9.29371 15.6337 7.09947 13.4396 7.09947 10.7334V6.25C7.09947 3.54384 9.29372 1.34967 11.9999 1.34961ZM11.9999 3.15039C10.2878 3.15045 8.90025 4.53795 8.90025 6.25V10.7334C8.90025 12.4454 10.2878 13.8339 11.9999 13.834C13.7119 13.834 15.0995 12.4455 15.0995 10.7334V6.25C15.0995 4.53792 13.7119 3.15039 11.9999 3.15039Z'/%3E%3C/svg%3E")`
const SEND_MASK=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M11.25 18.25V7.56L7.53 11.28a.75.75 0 0 1-1.06-1.06l5-5a.75.75 0 0 1 1.06 0l5 5a.75.75 0 1 1-1.06 1.06l-3.72-3.72v10.69a.75.75 0 0 1-1.5 0Z'/%3E%3C/svg%3E")`
const RETURN_MASK=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 5v5a4 4 0 0 1-4 4H5'/%3E%3Cpath d='M9 10l-4 4 4 4'/%3E%3C/svg%3E")`
const BROWSER_PALETTE_CSS=`
html[data-claude-chat-look='true']{--claude-fill-ghost-hover: color-mix(in srgb, var(--claude-color-text, currentColor) 5%, transparent);--claude-fill-control: color-mix(in srgb, var(--claude-color-text, currentColor) 10%, transparent);--claude-fill-ghost-selected: color-mix(in srgb, var(--claude-color-text, currentColor) 10%, transparent);--claude-fill-field: color-mix(in srgb, #FFFFFF 50%, transparent);--claude-line: color-mix(in srgb, var(--claude-color-text, currentColor) 10%, transparent);--claude-line-strong: color-mix(in srgb, var(--claude-color-text, currentColor) 20%, transparent);}
html[data-claude-chat-look='true'][data-hermes-mode='dark']{--claude-fill-ghost-hover: color-mix(in srgb, var(--claude-color-text, currentColor) 7.5%, transparent);--claude-fill-ghost-selected: color-mix(in srgb, var(--claude-color-text, currentColor) 15%, transparent);--claude-fill-field: color-mix(in srgb, var(--claude-color-text, currentColor) 5%, transparent);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']{--claude-k-141413: #FAF9F5;--claude-k-202020: #FFFFFF;--claude-k-262626: #F0EEE6;--claude-k-313130: #F0EEE6;--claude-k-333332: #E8E6DC;--claude-k-333333: #F0EEE6;--claude-k-464646: #E8E6DC;--claude-k-2b2b2b: #E8E6DC;--claude-k-2c2c2a: #F0EEE6;--claude-k-2d2d2d: #E8E6DC;--claude-k-3a3a39: #E8E6DC;--claude-k-4a4a48: #E8E6DC;--claude-k-a5a49a: #73726C;--claude-k-c3c2b7: #3D3D3A;--claude-k-ec7e7e: #B53333;--claude-k-ffffff: #141413;--claude-status-awaiting: #FAB219;--claude-status-ready: #2A78D6;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']{--claude-k-141413: #141413;--claude-k-202020: #202020;--claude-k-262626: #262626;--claude-k-2b2b2b: #2B2B2B;--claude-k-2c2c2a: #2C2C2A;--claude-k-2d2d2d: #2D2D2D;--claude-k-313130: #313130;--claude-k-333332: #333332;--claude-k-333333: #333333;--claude-k-3a3a39: #3A3A39;--claude-k-464646: #464646;--claude-k-4a4a48: #4A4A48;--claude-k-a5a49a: #A5A49A;--claude-k-c3c2b7: #C3C2B7;--claude-k-ec7e7e: #EC7E7E;--claude-k-ffffff: #FFFFFF;}
html[data-claude-chat-look='true']:not([data-hermes-theme='claude-chat']){--claude-k-141413: var(--dt-primary-foreground, Canvas);--claude-k-202020: var(--dt-popover, var(--ui-widget-surface-background, Canvas));--claude-k-262626: var(--ui-row-hover-background, rgb(128 128 128 / 12%));--claude-k-2b2b2b: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-k-2c2c2a: var(--ui-row-hover-background, rgb(128 128 128 / 12%));--claude-k-2d2d2d: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-k-313130: var(--ui-row-hover-background, rgb(128 128 128 / 12%));--claude-k-333332: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-k-333333: var(--ui-row-hover-background, rgb(128 128 128 / 12%));--claude-k-3a3a39: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-k-464646: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-k-4a4a48: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-k-a5a49a: var(--ui-text-secondary, currentColor);--claude-k-c3c2b7: var(--ui-text-secondary, currentColor);--claude-k-ec7e7e: var(--dt-destructive, #D00E17);--claude-k-ffffff: var(--dt-primary, CanvasText);--claude-account-hover: var(--ui-row-hover-background, rgb(128 128 128 / 12%));--claude-card-background: var(--ui-editor-surface-background, Canvas);--claude-card-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-file-tab: var(--ui-row-active-background, rgb(128 128 128 / 20%));--claude-file-divider: var(--ui-stroke-tertiary, rgb(128 128 128 / 18%));--claude-file-row-selected: var(--ui-row-active-background, rgb(128 128 128 / 20%));--claude-filter-background: var(--ui-control-background, transparent);--claude-filter-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-card-gap: 0px;--claude-card-radius: 0px;--claude-card-top: 35px;--claude-composer-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-composer-fill: var(--ui-editor-surface-background, Canvas);--claude-composer-inner: transparent;--claude-menu-background: var(--dt-popover, var(--ui-widget-surface-background, Canvas));--claude-menu-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-menu-check: var(--dt-primary, CanvasText);--claude-menu-hover: var(--ui-row-hover-background, rgb(128 128 128 / 12%));--claude-menu-shadow: rgb(0 0 0 / 25%);--claude-pane-active: var(--ui-row-active-background, rgb(128 128 128 / 20%));--claude-pane-active-glyph: var(--dt-primary, CanvasText);--claude-search-background: var(--ui-editor-surface-background, Canvas);--claude-search-border: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-search-text: var(--ui-text-tertiary, currentColor);--claude-segment-active: var(--ui-row-active-background, rgb(128 128 128 / 20%));--claude-segment-track: var(--ui-row-hover-background, rgb(128 128 128 / 12%));--claude-session-ring: var(--ui-text-quaternary, currentColor);--claude-sidebar-divider: var(--ui-stroke-tertiary, rgb(128 128 128 / 18%));--claude-sidebar-text: var(--ui-text-secondary, currentColor);--claude-tool-card: var(--ui-stroke-secondary, rgb(128 128 128 / 28%));--claude-ghost-hover: color-mix(in srgb, var(--claude-color-text, currentColor) 7.5%, transparent);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']{--claude-browser-background: var(--claude-color-chat);--claude-browser-tab: #111111;--claude-browser-divider: #292929;--claude-sidebar-divider: #292929;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']{--ui-inline-code-background: #F0EEE6;--ui-inline-code-foreground: #B5482E;--claude-composer-border: #DEDCD1;--claude-composer-fill: #FFFFFF;--claude-composer-inner: transparent;--claude-search-background: #FFFFFF;--claude-search-border: #E8E6DC;--claude-account-hover: #F0EEE6;--claude-peek-shadow: 0 0 0 .5px #0000000f, 0 4px 12px #0000000f, 0 16px 40px #00000014;--claude-pane-active: #DCE8F7;--claude-pane-active-glyph: #1F5FAD;--claude-segment-track: #F0EEE6;--claude-segment-active: #FFFFFF;--claude-menu-background: #FFFFFF;--claude-menu-border: #E8E6DC;--claude-menu-hover: #F0EEE6;--claude-menu-check: #2A74CD;--claude-menu-shadow: rgb(20 20 19 / 12%);--claude-sidebar-text: #52514E;--claude-ghost-hover: rgb(0 0 0 / 5%);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']{--ui-inline-code-background: #212121;--ui-inline-code-foreground: #EC7151;--claude-composer-border: #373736;--claude-composer-fill: #20201F;--claude-composer-inner: #252524;--ui-row-hover-background: #1F1F1F;--ui-row-active-background: #343434;--claude-color-active: #343434;--claude-sidebar-hover: #232323;--claude-sidebar-active: #343434;--claude-peek-shadow: 0 0 0 .5px #ffffff14, 0 4px 12px #0006, 0 16px 40px #00000080;--claude-search-background: #1D1D1D;--claude-search-border: #343434;--claude-account-hover: #232323;--claude-pane-active: #032042;--claude-sidebar-text: #C3C2B7;--claude-session-ring: #4D4C49;--claude-search-text: #898781;--claude-pane-active-glyph: #66A7E7;--claude-segment-track: #1D1D1D;--claude-segment-active: #343434;--claude-menu-background: #20201F;--claude-menu-border: #373736;--claude-menu-hover: #2C2C2B;--claude-menu-check: #2A74CD;--claude-menu-shadow: rgb(0 0 0 / 45%);--claude-ghost-hover: rgb(255 255 255 / 7.5%);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']{--theme-control-hover-accent-mix: 0%;--theme-control-active-accent-mix: 0%;--ui-text-secondary: #52514E;--ui-stroke-primary: rgb(0 0 0 / 20%);--ui-stroke-secondary: rgb(0 0 0 / 10%);--ui-control-active-background: rgb(0 0 0 / 5%);--chrome-action-hover: rgb(0 0 0 / 5%);--claude-color-accent: #2A74CD;--claude-focus-glow: rgb(24 79 149 / 60%);--claude-menu-highlight: rgb(0 0 0 / 5%);--claude-menu-separator: rgb(0 0 0 / 10%);--claude-overlay-edge: 0 0 0 1px rgb(0 0 0 / 10%);--claude-overlay-shadow: rgb(0 0 0 / 8%);--claude-popover-shadow: 0 8px 24px rgb(0 0 0 / 12%), 0 2px 6px rgb(0 0 0 / 8%);--claude-backdrop: rgb(0 0 0 / 40%);--claude-scrollbar-thumb: rgb(31 30 29 / 35%);--claude-tooltip-background: #20201F;--claude-tooltip-ring: rgb(255 255 255 / 10%);--claude-tooltip-text: #F0EFEC;--claude-tooltip-secondary: #C3C2B7;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']{--ui-text-primary: #F0EFEC;--ui-text-secondary: #C3C2B7;--ui-text-tertiary: #898781;--ui-stroke-primary: rgb(255 255 255 / 20%);--ui-stroke-secondary: rgb(255 255 255 / 10%);--ui-control-active-background: rgb(255 255 255 / 7.5%);--chrome-action-hover: rgb(255 255 255 / 7.5%);--claude-menu-highlight: rgb(255 255 255 / 7.5%);--claude-menu-separator: rgb(255 255 255 / 10%);--claude-overlay-edge: inset 0 0 0 1px rgb(255 255 255 / 10%);--claude-overlay-shadow: rgb(0 0 0 / 24%);--claude-popover-shadow: 0 8px 24px rgb(0 0 0 / 32%), 0 2px 6px rgb(0 0 0 / 20%);--claude-backdrop: rgb(0 0 0 / 50%);--claude-scrollbar-thumb: rgb(222 219 209 / 35%);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'],html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] > div:not([data-slot='composer-completion-drawer']),html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-surface'],html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-surface'] > [aria-hidden]{border-radius:16px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-surface']{border:1px solid var(--claude-composer-border)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] .aui-md :not(pre) > code{border-radius:4px!important;padding:1px 2px!important;font-size:calc(1em - 1px)!important;line-height:1.4!important;}
`
const CLAUDE_TREE_DEPTH_CSS=Array.from({length:24},(_,depth)=> `html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'][aria-level='${depth + 1}'] > div { --claude-tree-depth: ${depth}; }`).join('\n')
const CLAUDE_CODE_LAYOUT_CSS=`
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'],html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']{border-radius:6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-tour^='sidebar-nav-']{font-size:13px!important;font-weight:400!important;color:var(--claude-sidebar-text,var(--claude-color-text))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button']:has([data-tour^='sidebar-nav-']){height:26px!important;min-height:26px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav"] svg{width:16px!important;height:16px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav"] .codicon{width:16px!important;height:16px!important;margin:0!important;font-size:16px!important;line-height:16px!important;color:var(--claude-sidebar-text,var(--claude-color-text))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav-new-session"] .codicon{display:grid!important;width:18px!important;height:18px!important;margin:0 -1px!important;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--claude-color-text-tertiary) 15%,transparent);font-size:13px!important;line-height:13px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav-new-session"]:hover .codicon{background:color-mix(in srgb,var(--claude-color-text-tertiary) 25%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][data-claude-has~="tour-sidebar-nav-new-session"] .codicon::before{content:'\\ea60'!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'] [data-slot='kbd-group']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-tour='sidebar-nav-new-session']{font-size:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-tour='sidebar-nav-new-session']::before{content:'New';font-size:13px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']){height:25.6px!important;min-height:25.6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] input[aria-label='Search sessions']{font-size:13px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] input[aria-label='Search sessions']::placeholder{color:var(--claude-search-text,var(--claude-color-text-tertiary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'],html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] .hover-marquee,html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-text]{color:var(--claude-sidebar-text,var(--claude-color-text))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'] > .codicon{color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-slot='sidebar-content'] > div:has(input[aria-label='Search sessions']){order:-1;padding:8px 8px 6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']){display:flex!important;width:100%!important;max-width:none!important;padding:0 8px!important;border:1px solid var(--claude-search-border)!important;border-radius:6px!important;background:var(--claude-search-background)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-slot='sidebar-group']:has(.codicon-pin):not(:has([class~='row-hover'])){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sessions-mode] > [data-slot='sidebar-group']:has([class~='group/cron']),html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sessions-mode] > [data-slot='sidebar-group'][class~='pb-1']:last-child:not(:has([data-slot='sidebar-group-content'],[aria-label='Filters'],.codicon-pin)),html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> [data-slot='profile-rail']){display:none!important;}
html:not([data-claude-chat-look='true']) [data-claude-account-row],html:not([data-claude-chat-look='true']) [data-claude-account-menu]{display:none!important;}
html:not([data-claude-chat-look='true']) :is([data-claude-nav-more],[data-claude-sidebar-editor]){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-hidden]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-menu][data-claude-more-menu]{min-width:200px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-more-button]{display:flex!important;width:100%;height:26px!important;align-items:center;gap:8px;border:0;background:transparent;color:var(--claude-color-text-tertiary)!important;font-size:13px!important;font-weight:400!important;text-align:left;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-more-button] > .codicon{width:16px;height:16px;margin:0;font-size:16px;line-height:16px;color:var(--claude-color-text-tertiary);opacity:.5;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-more-button]:is(:hover,[aria-expanded='true']){background:var(--claude-sidebar-hover,var(--claude-account-hover))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-more-button][data-claude-current]{background:var(--claude-sidebar-active,var(--ui-row-active-background))!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-nav-more-button][data-claude-current] > .codicon{opacity:1;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor]{position:fixed;inset:0;z-index:var(--z-modal,150);display:grid;place-items:center;background:rgb(0 0 0 / 45%);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-panel]{box-sizing:border-box;width:320px;padding:18px 18px 14px;border:1px solid var(--claude-menu-border);border-radius:12px;background:var(--claude-menu-background);color:var(--claude-color-text);box-shadow:0 16px 48px var(--claude-menu-shadow);font-size:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-head]{display:flex;align-items:center;justify-content:space-between;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-head] > h2{margin:0;font-size:18px;font-weight:600;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-close]{display:grid;width:24px;height:24px;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--claude-color-text-secondary);cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-close]:hover{background:var(--claude-menu-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-panel] > p{margin:4px 0 14px;color:var(--claude-color-text-secondary);font-size:13px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-rows]{display:grid;gap:2px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-row]{display:flex;height:26px;align-items:center;gap:10px;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-row] > input{width:14px;height:14px;margin:0;accent-color:var(--claude-menu-check);cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-row]:has(> input:disabled){opacity:.5;cursor:default;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-row] > input:disabled{cursor:default;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-row] > .codicon{width:14px;font-size:14px;color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-foot]{display:flex;justify-content:flex-end;margin-top:16px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-editor-done]{height:28px;padding:0 14px;border:0;border-radius:8px;background:var(--claude-k-ffffff);color:var(--claude-k-141413);font:inherit;font-size:13px;font-weight:500;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-titlebar-cluster] button[aria-label='Open settings']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] [data-slot='connection-switcher']{position:absolute!important;width:1px!important;min-width:0!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;opacity:0!important;pointer-events:none!important;}
html[data-claude-gateway-proxy] [data-radix-popper-content-wrapper]:has([role='menu']){opacity:0!important;}
html:not([data-claude-chat-look='true']) [data-claude-pane-tools]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tools]{display:flex;align-items:center;gap:4px;padding-right:13px;-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool] > .codicon{font-size:16px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] .group\\/workspace button > span.uppercase,html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/section-label'] > span:first-child,html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/section-label'] > span:first-child > span:last-child{font-size:12px!important;line-height:16px!important;font-weight:400!important;letter-spacing:normal!important;text-transform:none!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/workspace'][class~='select-none'][class~='pt-2']{box-sizing:border-box;flex-shrink:0;height:28px;margin-top:8px;padding:0 8px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/workspace'][class~='select-none'][class~='pt-2'] span[aria-hidden='true'][class~='h-px']{visibility:hidden;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/workspace'][class~='select-none'][class~='pt-2']:hover span[class~='uppercase']{color:var(--claude-sidebar-text,var(--claude-color-text-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/workspace'] button:is([aria-label='Hide Earlier today sessions'],[aria-label='Show Earlier today sessions']) > span[class~='uppercase']{font-size:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/workspace'] button:is([aria-label='Hide Earlier today sessions'],[aria-label='Show Earlier today sessions']) > span[class~='uppercase']::before{content:'Today';font-size:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] aside .justify-center > span.uppercase{font-size:13px!important;font-weight:400!important;letter-spacing:normal!important;text-transform:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool] > svg[data-claude-pane-glyph]{width:16px;height:16px;flex:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool]{border-radius:6px!important;color:var(--claude-sidebar-text,var(--claude-color-text-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool]:not([aria-pressed='true']):hover{background:var(--claude-ghost-hover)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool][aria-pressed='true']{background:var(--claude-pane-active)!important;color:var(--claude-pane-active-glyph)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool][aria-expanded='true']{background:var(--claude-account-hover)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-titlebar-cluster] button:is([aria-label='Layout editor'],[aria-label='HUD mode'],[aria-label='Swap sidebar sides'],[data-tour='right-pane-toggle']):not([data-claude-pane-tool]){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-menu][data-claude-overflow-menu]{min-width:128px;padding:4px;border:0;box-shadow:inset 0 0 0 1px var(--claude-card-border,var(--claude-menu-border)),0 8px 24px rgb(0 0 0 / 32%),0 2px 6px rgb(0 0 0 / 20%);font-size:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-overflow-menu] > [data-claude-account-item]{min-height:28px;gap:8px;line-height:20px;white-space:nowrap;}
html:not([data-claude-chat-look='true']) [data-claude-account-bar]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-bar]{display:flex;flex-shrink:0;align-items:center;gap:4px;margin:6px 8px 8px;position:relative;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-folded] :is([data-claude-backend-dock],[data-claude-update-dock],[data-zone-tabstrip='grp-sessions'] [role='tablist'],[data-tree-group='grp-sessions'] [role='tab'][data-vertical='true']),html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-bar][data-claude-folded]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-bar]::before{content:'';position:absolute;top:-6px;left:-8px;right:-8px;height:.5px;background:var(--claude-color-border-subtle,var(--ui-stroke-quaternary));pointer-events:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-row]{display:inline-flex;box-sizing:border-box;flex:0 0 176px;width:176px;max-width:100%;height:28px;min-width:0;align-items:center;gap:4px;padding:0 8px 0 2px;border:0;border-radius:6px;background:transparent;color:var(--claude-color-text);font:inherit;text-align:left;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-row]:is(:hover,[aria-expanded='true']){background:var(--claude-account-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-avatar]{display:grid;flex-shrink:0;place-items:center;width:20px;height:20px;margin:0 2px;border-radius:50%;background:var(--claude-sidebar-active);overflow:hidden;font-size:9px;font-weight:500;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-avatar] > img{width:100%;height:100%;object-fit:cover;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-text]{flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-org]{color:var(--claude-color-text-tertiary);font-size:13px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-row] > .codicon{color:var(--claude-color-text-tertiary);font-size:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-menu]{position:fixed;z-index:var(--z-modal-popover,140);box-sizing:border-box;min-width:300px;padding:6px;border:1px solid var(--claude-menu-border);border-radius:10px;background:var(--claude-menu-background);color:var(--claude-color-text);box-shadow:0 8px 24px var(--claude-menu-shadow);font:inherit;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-menu]:not([data-claude-more-menu],[data-claude-overflow-menu]){width:272px;min-width:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-menu-head]{overflow:hidden;padding:6px 8px 4px;color:var(--claude-color-text-tertiary);font-size:0.92em;text-overflow:ellipsis;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-separator]{height:1px;margin:5px 2px;background:var(--claude-menu-border);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-item]{display:flex;width:100%;min-height:30px;align-items:center;gap:10px;padding:4px 8px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-item]:is(:hover,:focus-visible){background:var(--claude-menu-hover);outline:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-item] > .codicon:first-child{width:16px;color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-label]{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-tag],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-item] kbd{color:var(--claude-color-text-tertiary);font:inherit;font-size:0.85em;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-gateway][aria-checked='false'] > .codicon-check{visibility:hidden;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-account-gateway] > .codicon-check{color:var(--claude-menu-check);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/section-label'] > span,html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/workspace'] span[class~='uppercase']{font-weight:400!important;letter-spacing:0!important;text-transform:none!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='group/section-label']:is(:hover,:focus-visible) > span{color:var(--claude-sidebar-text,var(--claude-color-text-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button']:hover:not([class~='bg-(--ui-control-active-background)'],[data-claude-current]){background:var(--claude-sidebar-hover,var(--ui-row-hover-background))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-sidebar='menu-button'][class~='bg-(--ui-control-active-background)']{background:var(--claude-sidebar-active,var(--ui-row-active-background))!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']{min-height:28px!important;margin-bottom:1px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-session-pin-drop] [class~='row-hover']{min-height:26px!important;margin-bottom:.5px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-index]{display:flow-root;padding-bottom:1px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] [data-slot='row-button'] [data-slot='tooltip-trigger']{font-size:13px!important;line-height:20px!important;font-weight:400!important;color:var(--claude-sidebar-text,var(--claude-color-text))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']:is([data-active='true'],[aria-current='true'],[class*='ui-row-active-background']) [data-slot='row-button'] [data-slot='tooltip-trigger']{color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] [data-slot='row-button'] .hover-marquee{text-overflow:clip!important;-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 12px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 12px),transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']:is(:hover,:focus-within) [data-slot='row-button'] .hover-marquee{-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 36px),transparent calc(100% - 12px));mask-image:linear-gradient(to right,#000 calc(100% - 36px),transparent calc(100% - 12px));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] [data-slot='row-button'] .hover-marquee > .hover-marquee-inner{animation:none!important;transform:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-claude-scrolled]{-webkit-mask-image:linear-gradient(transparent 0,#000 12px);mask-image:linear-gradient(transparent 0,#000 12px);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] [data-reorder-handle]{position:absolute!important;left:-1px;width:9px!important;margin:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'] [data-reorder-handle]:has([role='status'],[class*='bg-(--ui-accent)'],[class*='border']){left:auto;right:8px;display:grid!important;place-items:center;transition:opacity .1s;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']:hover [data-reorder-handle]:has([role='status'],[class*='bg-(--ui-accent)'],[class*='border']),html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover']:focus-within [data-reorder-handle]:has([role='status'],[class*='bg-(--ui-accent)'],[class*='border']){opacity:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [class~='row-hover'][data-claude-has~="reorder-live"] [data-slot='row-button'] [data-slot='tooltip-trigger']{padding-right:16px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-reorder-handle]:not(:has([role='status'],[class*='border'])):not(:has(> span:first-child i))::after{content:none;position:absolute;top:50%;left:50%;box-sizing:border-box;width:5.6px;height:5.6px;border:1px solid var(--claude-session-ring,var(--claude-color-text-tertiary));border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;transition:opacity 120ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-reorder-handle]:hover::after{opacity:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='pane-tab'] span[class~='uppercase']{letter-spacing:0!important;text-transform:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'],html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'] > [aria-hidden]{min-height:0!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important;overflow:visible!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade']{padding:0!important;overflow:visible!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child{position:relative!important;row-gap:4px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has([data-slot='composer-rich-input']){position:relative;box-sizing:border-box;min-height:44px;padding:9.8px 76px 13px 40.8px!important;border:1px solid var(--claude-composer-border)!important;border-radius:12px!important;background:var(--claude-composer-fill)!important;box-shadow:inset 0 0 0 0.8px var(--claude-composer-inner),0 4px 20px color-mix(in srgb,black 3.5%,transparent)!important;transition:background-color 200ms,border-color 200ms,box-shadow 200ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has([data-slot='composer-rich-input']):hover:not(:focus-within):not(:has(button:hover,a:hover,[role='button']:hover,label:hover)){border-color:color-mix(in srgb,var(--claude-color-text) 20%,var(--claude-composer-fill))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has([data-slot='composer-rich-input']):focus-within{border-color:color-mix(in srgb,var(--claude-color-text) 20%,var(--claude-composer-fill))!important;box-shadow:0 4px 20px color-mix(in srgb,black 7.5%,transparent)!important;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has([data-slot='composer-rich-input']){transition:none;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'][data-claude-attached] > [data-slot='composer-attachments']{position:absolute!important;top:12px;left:41.6px;right:76px;z-index:3;margin:0!important;padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'][data-claude-queue] > div:last-child > div:has([data-slot='composer-rich-input']){padding-right:104px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'][data-claude-attached] > div:last-child > div:has([data-slot='composer-rich-input']){padding-top:calc(29.8px + var(--claude-attach-h,120px))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button:is([aria-label='Send'],[aria-label='Envoyer'])::before{mask-image:${RETURN_MASK}!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-rich-input']{min-height:19.6px!important;font-size:14px!important;line-height:17.6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-rich-input']:is([data-placeholder="What are we building?"],[data-placeholder="Give Hermes a task"],[data-placeholder="What's on your mind?"],[data-placeholder="Describe what you need"],[data-placeholder="What should we tackle?"],[data-placeholder="Ask anything"],[data-placeholder="Start with a goal"],[data-placeholder="Send a follow-up"],[data-placeholder="Send follow-up"],[data-placeholder="Add more context"],[data-placeholder="Refine the request"],[data-placeholder="What's next?"],[data-placeholder="Keep it going"],[data-placeholder="Push it further"],[data-placeholder="Adjust or continue"]):is(:empty,[data-empty])::before{content:'Type / for commands'!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host] [data-slot='composer-root'] [data-slot='composer-rich-input']:is([data-placeholder="What are we building?"],[data-placeholder="Give Hermes a task"],[data-placeholder="What's on your mind?"],[data-placeholder="Describe what you need"],[data-placeholder="What should we tackle?"],[data-placeholder="Ask anything"],[data-placeholder="Start with a goal"],[data-placeholder="Send a follow-up"],[data-placeholder="Send follow-up"],[data-placeholder="Add more context"],[data-placeholder="Refine the request"],[data-placeholder="What's next?"],[data-placeholder="Keep it going"],[data-placeholder="Push it further"],[data-placeholder="Adjust or continue"]):is(:empty,[data-empty])::before{content:'Describe a task or ask a question'!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Send'],[aria-label='Envoyer']){position:absolute!important;top:calc(var(--claude-composer-box-h,44px) - 33.6px)!important;right:40px!important;bottom:auto!important;z-index:2;border:0!important;border-radius:6px!important;background:transparent!important;box-shadow:none!important;color:color-mix(in srgb,var(--claude-color-text) 84%,var(--claude-composer-fill))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Send'],[aria-label='Envoyer']):is(:hover,:focus-visible):not(:disabled){background:var(--claude-ghost-hover)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Stop'],[aria-label='Arrêter']){position:absolute!important;top:calc(var(--claude-composer-box-h,44px) - 34px)!important;right:40px!important;bottom:auto!important;z-index:2;width:24px!important;min-width:24px!important;height:24px!important;border:0!important;border-radius:6px!important;background:transparent!important;box-shadow:none!important;color:color-mix(in srgb,var(--claude-color-text) 84%,var(--claude-composer-fill))!important;transition:background-color 120ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Stop'],[aria-label='Arrêter'],[aria-label='Queue message'],[aria-label^='Mettre en file']):is(:hover,:focus-visible):not(:disabled){background:var(--claude-ghost-hover)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Queue message'],[aria-label^='Mettre en file']){position:absolute!important;top:calc(var(--claude-composer-box-h,44px) - 33.6px)!important;right:72px!important;bottom:auto!important;z-index:2;height:24px!important;border-radius:6px!important;color:color-mix(in srgb,var(--claude-color-text) 84%,var(--claude-composer-fill))!important;transition:opacity 120ms ease-out,background-color 120ms;}
@starting-style{html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Queue message'],[aria-label^='Mettre en file']){opacity:0;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"]{position:absolute!important;top:calc(var(--claude-composer-box-h,44px) - 33.6px)!important;right:40px!important;z-index:2;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > * > button,html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > button{height:24px!important;border:0!important;background:transparent!important;box-shadow:none!important;color:color-mix(in srgb,var(--claude-color-text) 84%,var(--claude-composer-fill))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > * > button:focus-visible,html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > button:focus-visible,html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Send'],[aria-label='Envoyer'],[aria-label='Stop'],[aria-label='Arrêter'],[aria-label='Queue message'],[aria-label^='Mettre en file']):focus-visible{box-shadow:inset 0 0 0 1px var(--claude-color-chat,Canvas),0 0 0 1px var(--claude-color-accent,var(--dt-ring,currentColor)),0 0 6px 1px var(--claude-focus-glow,transparent)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"]{border-radius:6px;transition:background-color 120ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"]:is(:hover,:focus-within){background:var(--claude-ghost-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] button{background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Voice dictation'],[aria-label='Stop dictation'],[aria-label='Start voice conversation'],[aria-label='Voice chat engine']){border-radius:6px!important;transition:background-color 120ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child button:is([aria-label='Voice dictation']):is(:hover,:focus-visible,[aria-expanded='true']):not(:disabled){background:var(--claude-ghost-hover)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > * > button[aria-label='Start voice conversation']{border-radius:6px 0 0 6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] button[aria-label='Voice chat engine']{border-radius:0 6px 6px 0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] span[data-claude-has~="child-start-voice"] button[aria-label='Start voice conversation']{pointer-events:auto!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] span[data-claude-has~="child-start-voice"] button[aria-label='Voice chat engine']{width:0!important;min-width:0!important;padding:0!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > * > button[aria-label='Start voice conversation'],html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"] > button[aria-label='Start voice conversation']{width:28px!important;border-radius:6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"]::after{content:'\\eab7';position:absolute;top:-1px;right:0;font:normal 8px/1 codicon;color:var(--ui-text-quaternary,var(--claude-color-text-tertiary));pointer-events:none;transition:opacity 100ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child span[data-claude-has~="child-start-voice"]:is(:hover,[data-claude-has~="child-engine-menu-open"])::after{opacity:0;}
html[data-claude-chat-look='true'] [data-claude-tip-replaced]{visibility:hidden!important;}
[data-claude-voice-tip]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-voice-tip]:not([hidden]){position:fixed;z-index:2147483000;display:flex;flex-direction:column;max-width:240px;padding:6px 8px;border:0;border-radius:6px;background:var(--claude-tooltip-background,var(--claude-color-elevated,var(--ui-editor-surface-background)));box-shadow:0 0 0 1px var(--claude-tooltip-ring,color-mix(in srgb,var(--claude-color-text) 10%,transparent)),0 4px 14px color-mix(in srgb,black 24%,transparent);pointer-events:none;transition:opacity 120ms cubic-bezier(.32,.72,0,1),scale 120ms cubic-bezier(.32,.72,0,1);}
@starting-style{html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-voice-tip]:not([hidden]){opacity:0;scale:.98;}}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-voice-tip]:not([hidden]){transition:none;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-voice-tip] > strong{color:var(--claude-tooltip-text,var(--claude-color-text,var(--ui-text-primary)));font-size:13px;font-weight:400;line-height:18px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-voice-tip] > span{color:var(--claude-tooltip-secondary,var(--claude-color-text-secondary,var(--ui-text-secondary)));font-size:13px;line-height:18px;}
html[data-claude-chat-look='true'] #root{overflow:clip!important;}
html[data-claude-browser-suppressed] [data-claude-has~="child-tree-group-aside-preview-browser"],html[data-claude-browser-suppressed] aside[data-preview-browser]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-plugin-rail],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-plugin-off]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone] [role='tab'][data-slot='pane-tab']{min-width:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone] [role='tab'][data-slot='pane-tab']::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone] [role='tab'][data-slot='pane-tab']::after{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone] [role='tab'][data-slot='pane-tab'] .pane-tab-content,html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone] [role='tab'][data-slot='pane-tab'] .pane-tab-content > span{padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone][data-claude-plugin-zone][data-claude-plugin-zone][data-claude-plugin-zone] [role='tab'][data-slot='pane-tab'] span.truncate{font-size:14px!important;font-weight:400!important;letter-spacing:normal!important;text-transform:none!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone] [role='tab'][data-slot='pane-tab'] > span:has(> button[aria-label='Close']),html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone] button[aria-label='Minimize']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-panel-header][data-claude-plugin-head][data-claude-plugin-head][data-claude-plugin-head][data-claude-plugin-head]{height:32px!important;min-height:32px!important;background:transparent!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-plugin-zone]{height:32px!important;min-height:32px!important;padding:0 8px 0 14px!important;background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='plugin-actions']{display:flex;flex-shrink:0;align-items:center;gap:2px;margin-left:auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group='grp-main'] > [data-panel-header] [data-window-drag-handle]{pointer-events:none!important;}
[data-claude-header-tip]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-header-tip]:not([hidden]){position:fixed;z-index:2147483000;display:flex;align-items:center;gap:4px;box-sizing:border-box;min-height:24px;max-width:240px;padding:3px 8px;border:0;border-radius:6px;background:var(--claude-tooltip-background,var(--claude-menu-background,var(--claude-color-elevated,var(--ui-editor-surface-background))));box-shadow:inset 0 0 0 1px var(--claude-tooltip-ring,var(--claude-menu-border,var(--claude-color-border,var(--ui-stroke-tertiary)))),0 1px 2px rgb(11 11 11 / 6%),0 2px 8px rgb(0 0 0 / 24%);color:var(--claude-tooltip-text,var(--claude-color-text,var(--ui-text-primary)));font-size:13px;font-weight:400;line-height:18px;white-space:nowrap;pointer-events:none;transform-origin:top center;animation:claude-tip-in 120ms cubic-bezier(.32,.72,0,1);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-header-tip][data-claude-tip-wrap]:not([hidden]){white-space:normal;overflow-wrap:anywhere;}
@keyframes claude-tip-in{from{opacity:0;transform:scale(.98);}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-header-tip] > kbd{min-width:16px;padding:0 4px;border-radius:4px;background:color-mix(in srgb,var(--claude-tooltip-text,var(--claude-color-text,var(--ui-text-primary))) 9%,transparent);color:var(--claude-tooltip-secondary,var(--claude-color-text-secondary,var(--ui-text-secondary)));font:inherit;font-size:11px;text-align:center;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-header-tip] > span{margin-left:4px;color:var(--claude-tooltip-secondary,var(--claude-color-text-secondary,var(--ui-text-secondary)));}
html[data-claude-chat-look='true']:is([data-claude-no-workspace],[data-claude-review-off]) [data-tree-split] > div:has(> [data-tree-group='grp-review']:not([data-pane-host])){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-pane-tool][data-claude-unavailable]{opacity:0.45;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-header-tip] > kbd:first-of-type{margin-left:4px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble{display:inline-flex;box-sizing:border-box;min-height:24px;max-width:min(240px,calc(100vw - 1.5rem));align-items:center;gap:8px;padding:3px 8px;border:0;border-radius:6px;background:var(--claude-tooltip-background,var(--claude-color-elevated,var(--ui-editor-surface-background)));box-shadow:inset 0 0 0 1px var(--claude-tooltip-ring,var(--claude-color-border,var(--ui-stroke-tertiary))),0 1px 2px rgb(11 11 11 / 6%),0 2px 8px rgb(0 0 0 / 24%);color:var(--claude-tooltip-text,var(--claude-color-text,var(--ui-text-primary)));font-size:13px;font-weight:400;line-height:18px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble[data-side='top']{translate:0 1px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble[data-side='bottom']{translate:0 -1px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble[data-side='left']{translate:1px 0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble[data-side='right']{translate:-1px 0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble [data-slot='tooltip-arrow']{display:none!important;}
@media (prefers-reduced-motion:no-preference){html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble[data-state$='open']{animation:claude-tip-in 120ms cubic-bezier(.32,.72,0,1) both;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble[data-state='delayed-open']{animation-delay:100ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tooltip-content'].tooltip-bubble[data-state='closed']{animation:claude-tip-out 120ms cubic-bezier(.32,.72,0,1) both;}}
@keyframes claude-tip-in{from{opacity:0;scale:.98;}}
@keyframes claude-tip-out{to{opacity:0;scale:.98;}}
html[data-claude-chat-look='true'][data-hermes-theme] [role='region'].bottom-4:has(> [data-slot='card-stack']){right:16px;bottom:96px;width:min(360px,calc(100% - 32px));}
html[data-claude-chat-look='true'][data-hermes-theme] [role='region'] [data-slot='card-stack'] > [data-slot='card-stack-edge'],html[data-claude-chat-look='true'][data-hermes-theme] [role='region'] [data-slot='card-stack-surface']{border:0!important;border-radius:10px!important;background:var(--claude-menu-background)!important;box-shadow:var(--claude-overlay-edge,inset 0 0 0 1px var(--claude-menu-border)),0 2px 4px rgb(11 11 11 / 7%),0 6px 16px var(--claude-overlay-shadow,rgb(0 0 0 / 24%))!important;backdrop-filter:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='region'] [data-slot='card-stack-surface'] [data-slot='alert']{gap:4px 8px;padding:8px 12px;font-size:13px;line-height:19px;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='region'] [data-slot='card-stack-surface'] [data-slot='alert'] :is([data-slot='alert-description'],[data-slot='alert-description'] p){line-height:19px;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='region'] [data-slot='card-stack-surface'] [data-slot='alert-title']{letter-spacing:normal;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='dropdown-menu-content'],[data-slot='context-menu-content'],[data-slot='dropdown-menu-sub-content'],[data-slot='context-menu-sub-content']):not([data-claude-model-menu],[data-claude-effort-menu],[data-claude-context-menu],[data-claude-title-menu],[data-claude-files-menu],[data-claude-account-menu]){max-width:320px;padding:4px!important;border:0!important;border-radius:10px!important;background:var(--claude-menu-background)!important;box-shadow:var(--claude-overlay-edge,inset 0 0 0 1px var(--claude-menu-border)),var(--claude-popover-shadow,0 8px 24px rgb(0 0 0 / 32%),0 2px 6px rgb(0 0 0 / 20%))!important;backdrop-filter:none!important;animation:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='dropdown-menu-content'],[data-slot='context-menu-content'],[data-slot='dropdown-menu-sub-content'],[data-slot='context-menu-sub-content']):not([data-claude-model-menu],[data-claude-effort-menu],[data-claude-context-menu],[data-claude-title-menu],[data-claude-files-menu],[data-claude-account-menu]) :is([data-slot$='menu-item'],[data-slot$='menu-checkbox-item'],[data-slot$='menu-radio-item'],[data-slot$='menu-sub-trigger']){min-height:24px;gap:6px!important;padding:2.5px 8px!important;border-radius:6px!important;font-size:13px!important;line-height:19px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='dropdown-menu-content'],[data-slot='context-menu-content'],[data-slot='dropdown-menu-sub-content'],[data-slot='context-menu-sub-content']):not([data-claude-model-menu],[data-claude-effort-menu],[data-claude-context-menu],[data-claude-title-menu],[data-claude-files-menu],[data-claude-account-menu]) [data-slot$='menu-label']{padding:4px 8px!important;font-size:12px!important;line-height:15px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='dropdown-menu-content'],[data-slot='context-menu-content'],[data-slot='dropdown-menu-sub-content'],[data-slot='context-menu-sub-content']):not([data-claude-model-menu],[data-claude-effort-menu],[data-claude-context-menu],[data-claude-title-menu],[data-claude-files-menu],[data-claude-account-menu]) [data-slot$='menu-separator']{margin:4px 8px!important;background:var(--claude-menu-separator,var(--ui-stroke-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot$='menu-item'][data-disabled]{opacity:.4!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot$='menu-item'][data-variant='destructive'][data-highlighted]{background:var(--claude-color-destructive,var(--dt-destructive))!important;color:#FFFFFF!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot$='menu-item'][data-variant='destructive'][data-highlighted] svg{color:inherit!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-content']{border:0!important;border-radius:10px!important;background:var(--claude-menu-background)!important;box-shadow:var(--claude-overlay-edge,inset 0 0 0 1px var(--claude-menu-border)),0 4px 8px rgb(11 11 11 / 8%),0 12px 28px -2px var(--claude-overlay-shadow,rgb(0 0 0 / 24%))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-content'].max-w-sm{max-width:400px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-content'].max-w-lg{max-width:520px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-content'] > .overflow-y-auto.p-4{padding:20px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-title']{font-size:14px!important;font-weight:500!important;line-height:18px!important;letter-spacing:normal!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-description']{color:var(--claude-color-text-secondary,var(--ui-text-secondary))!important;font-size:13px!important;line-height:19px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-overlay']{background:var(--claude-backdrop,rgb(0 0 0 / 50%))!important;backdrop-filter:none!important;}
@media (prefers-reduced-motion:no-preference){html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-content'][data-state='open']{animation:claude-pop-in 200ms cubic-bezier(.165,.84,.44,1) both!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-content'][data-state='closed']{animation:claude-pop-out 200ms cubic-bezier(.165,.84,.44,1) both!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-overlay'][data-state='open']{animation:claude-fade-in 200ms cubic-bezier(.165,.84,.44,1) both!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-overlay'][data-state='closed']{animation:claude-fade-out 200ms cubic-bezier(.165,.84,.44,1) both!important;}}
@keyframes claude-pop-in{from{opacity:0;scale:.98;}}
@keyframes claude-pop-out{to{opacity:0;scale:.98;}}
@keyframes claude-fade-in{from{opacity:0;}}
@keyframes claude-fade-out{to{opacity:0;}}
@property --claude-fade-top{syntax:'<length>';inherits:false;initial-value:0px;}
@property --claude-fade-bottom{syntax:'<length>';inherits:false;initial-value:0px;}
@supports (animation-timeline:scroll()){html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='dialog-content'] > .overflow-y-auto{mask-image:linear-gradient(to bottom,transparent 0,#000 var(--claude-fade-top),#000 calc(100% - var(--claude-fade-bottom)),transparent 100%);animation:claude-fade-top-edge linear both,claude-fade-bottom-edge linear both;animation-timeline:scroll(self block),scroll(self block);animation-range:0px 28px,calc(100% - 28px) 100%;}}
@keyframes claude-fade-top-edge{from{--claude-fade-top: 0px;}
to{--claude-fade-top: 28px;}}
@keyframes claude-fade-bottom-edge{from{--claude-fade-bottom: 28px;}
to{--claude-fade-bottom: 0px;}}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot$='menu-content'],[data-slot$='menu-sub-content'],[data-slot='dialog-content'],[data-slot='popover-content'],[data-slot='select-content'],[data-claude-has~="child-cmdk-root"]),html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot$='menu-content'],[data-slot$='menu-sub-content'],[data-slot='dialog-content'],[data-slot='popover-content'],[data-slot='select-content'],[data-claude-has~="child-cmdk-root"]) *{scrollbar-width:thin;scrollbar-color:var(--claude-scrollbar-thumb,color-mix(in srgb,var(--claude-color-text) 35%,transparent)) transparent;}
html[data-claude-chat-look='true'][data-hermes-theme] :is(button,[role='button'],[role='tab'],a[href],select,[role='switch'],[role='checkbox'],[role='radio']):focus-visible:not([role^='menuitem'],[role='option'],[cmdk-item]){outline:none;box-shadow:inset 0 0 0 1px var(--claude-color-chat,Canvas),0 0 0 1px var(--claude-color-accent,var(--dt-ring,currentColor)),0 0 6px 1px var(--claude-focus-glow,transparent)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='region'] > div.pointer-events-auto.min-h-8:not([data-slot]){border:1px solid var(--claude-color-border,var(--ui-stroke-tertiary));border-radius:8px;background:var(--claude-color-elevated,var(--ui-editor-surface-background));box-shadow:0 4px 14px color-mix(in srgb,black 24%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child:not([data-claude-has~="button-is-label-send-label-envoyer"]) > div:has([data-slot='composer-rich-input'])::after{content:'';position:absolute;top:50%;right:12px;width:16px;height:16px;transform:translateY(-50%);background:var(--claude-color-text-tertiary);mask:${RETURN_MASK} center / contain no-repeat;opacity:.6;pointer-events:none;display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child [data-slot='fan-menu-anchor']:has(button:is([aria-label='Voice dictation'],[aria-label='Stop dictation'],[aria-label='Transcribing dictation'],[aria-label='Dictée vocale'])){position:absolute!important;top:calc(var(--claude-composer-box-h,44px) - 33.6px);right:8px;bottom:auto;left:auto;z-index:2;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has(> button[aria-label='Add context']){position:absolute!important;grid-area:auto!important;top:calc(var(--claude-composer-box-h,44px) - 33.6px);left:8px;z-index:2;translate:none!important;transform:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked]{position:fixed!important;z-index:5;top:var(--claude-dock-top)!important;left:var(--claude-dock-left)!important;height:24px!important;padding:0 6px!important;border-radius:6px!important;transform:translateY(-50%);background:transparent;color:var(--claude-sidebar-text,var(--claude-color-text-secondary))!important;font-size:13px!important;line-height:20px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked]:hover,html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked][aria-expanded='true']{background:var(--claude-ghost-hover)!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked] > svg{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked] > span{font-size:13px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:not([data-claude-has~="slot-composer-rich-input"]) button{height:24px!important;min-height:24px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:not([data-claude-has~="slot-composer-rich-input"]) button:is([aria-label^='Model ·'],[aria-label^='Effort']) span{font-size:13px!important;line-height:20px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:not([data-claude-has~="slot-composer-rich-input"]) button[aria-label^='Model ·']{color:var(--claude-sidebar-text,var(--claude-color-text-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:not([data-claude-has~="slot-composer-rich-input"]) button[aria-label^='Effort']{color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'] button:has(> .codicon-add)::before{width:12px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'] button:has(> .codicon-add){border-radius:6px!important;color:color-mix(in srgb,var(--claude-color-text) 84%,var(--claude-composer-fill))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] [data-slot='composer-surface'] button:has(> .codicon-add)::after{height:12px!important;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']{--claude-card-background: #FFFFFF;--claude-card-border: #E5E3DA;--claude-file-tab: #F0EEE6;--claude-file-divider: #E5E3DA;--claude-file-row-selected: #F0EEE6;--claude-filter-background: #FAF9F5;--claude-filter-border: #E5E3DA;--claude-card-gap: 0px;--claude-card-radius: 0px;--claude-card-top: 35px;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']{--claude-card-background: #1A1B26;--claude-card-border: #2B2B2B;--claude-file-tab: #3C3D46;--claude-file-divider: #31323C;--claude-file-row-selected: #31323C;--claude-filter-background: #262731;--claude-filter-border: #3C3D46;--claude-terminal-background: #16161E;--ui-terminal-surface-background: #16161E;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group='grp-terminal']:not([data-pane-host]){--claude-card-background: var(--claude-terminal-background, var(--ui-terminal-surface-background));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group='grp-terminal']:not([data-pane-host]) > [data-panel-header]{background:var(--claude-terminal-background,var(--ui-terminal-surface-background))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not(:has([data-tree-tab='workspace'])){margin:var(--claude-card-gap)!important;border:1px solid var(--claude-card-border)!important;border-width:1px 0 0 1px!important;border-radius:var(--claude-card-radius)!important;background:var(--claude-card-background)!important;--ui-editor-surface-background: var(--claude-card-background);--ui-sidebar-surface-background: var(--claude-card-background);--ui-terminal-surface-background: var(--claude-card-background);-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not(:has([data-tree-tab='workspace']))[data-window-top]{margin-top:var(--claude-card-top)!important;--panel-titlebar-left: 0px !important;--panel-titlebar-right: 0px !important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not([data-claude-has~="tree-tab-workspace"])[data-window-top] > [data-panel-header]{height:auto!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not([data-claude-has~="tree-tab-workspace"])[data-window-top] > [data-panel-header] > :is([data-zone-tabstrip],[data-panel-page-header]){position:relative!important;inset:auto!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not([data-claude-has~="tree-tab-workspace"])[data-window-top] > [data-panel-header]:not(:has([data-zone-tabstrip],[data-panel-page-header])){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:not(:has([data-tree-group='grp-sessions'])):not(:has([data-tree-group='grp-main'])){background:var(--claude-color-chat)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:has(> [data-tree-group][data-window-top]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not(:has([data-tree-tab='workspace']))){-webkit-app-region:drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [role='separator']{-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[style*='display: none'] + div:has(> [data-tree-group='grp-terminal']),html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div[data-claude-has~="child-tree-split-div-tree-group-grp-files"]:not([data-claude-has~="child-tree-split-div-not-style-display-none-tree-gro"]) + div:has(> [data-tree-group='grp-terminal']){flex:1 1 0%!important;max-height:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div[data-claude-has~="child-tree-split-div-tree-group-grp-files"]:not([data-claude-has~="child-tree-split-div-not-style-display-none-tree-gro"]) + div > [data-tree-group='grp-terminal']{margin-top:var(--claude-card-top)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[style*='flex: 0 0 auto']:has(> [data-tree-group='grp-terminal']){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div:has(> [data-tree-split] > div[style*='flex: 0 0 auto'] > [data-tree-group='grp-terminal']):not(:has(> [data-tree-split] > div:not([style*='display: none']) > [data-tree-split] > div:not([style*='display: none']) > [data-tree-group]:not([data-tree-group='grp-files']))),html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:has(> [data-tree-split] > div[style*='flex: 0 0 auto'] > [data-tree-group='grp-terminal']):has(> [data-tree-split] > div[style*='display: none'] > [data-tree-split]){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:has(> :is([data-tree-group='grp-review'],[data-tree-group='grp-files'])){flex-grow:1!important;max-width:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:not([data-claude-expanded]) [data-claude-side-column]{flex:0 1 var(--claude-side-width,320px)!important;min-width:min(320px,25vw)!important;max-width:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:not([data-claude-expanded]) [data-claude-preview-column]{flex:0 1 var(--claude-preview-width,320px)!important;min-width:min(320px,25vw)!important;max-width:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:not([data-claude-expanded]) [data-tree-split][data-claude-has~="child-claude-preview-column-claude-side-column"] > div:has(> [data-tree-group='grp-main']){flex:1 1 0%!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-rail-both] [data-tree-split] > div:has(> [data-tree-group='grp-review']:not([data-pane-host])){flex:0 0 var(--claude-rail-split,50%)!important;min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-rail-both] [data-tree-split] > div:has(> [data-tree-group='grp-files']:not([data-pane-host])){flex:1 1 0%!important;min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-rail-open][data-claude-terminal-open]:not([data-claude-expanded]) [data-tree-split] > div:has(> [data-tree-group='grp-terminal']:not([data-pane-host])){flex:0 0 var(--claude-terminal-height,40%)!important;max-height:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-rail-open][data-claude-terminal-open]:not([data-claude-expanded]) [data-tree-split] > div:has(> [data-tree-split] > div > [data-tree-group='grp-review'],> [data-tree-split] > div > [data-tree-group='grp-files']){flex:1 1 0%!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[data-claude-zone-sized]{flex:0 1 var(--claude-zone-width)!important;max-width:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[data-claude-drag-held]{display:none!important;}
html[data-claude-chat-look='true'][data-claude-side-resizing]{user-select:none!important;}
html[data-claude-chat-look='true'][data-claude-side-resizing='x'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip='x']{cursor:col-resize!important;}
html[data-claude-chat-look='true'][data-claude-side-resizing='y'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip='y']{cursor:row-resize!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip]::before{content:'';position:absolute;top:50%;left:50%;width:3px;height:48px;border-radius:9999px;background:var(--claude-color-text-tertiary,currentColor);opacity:0;transform:translate(calc(-50% - 3px),-50%);transition:opacity 200ms cubic-bezier(.165,.84,.44,1) 200ms;pointer-events:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip='y']::before{width:48px;height:3px;transform:translate(-50%,calc(-50% - 3px));}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-side-resizing] [data-claude-sash]::before{background:var(--claude-color-text-secondary,currentColor);transition-duration:120ms;transition-delay:0s;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip]:not([data-claude-has~="next-tree-group-grp-sessions"]) > span:last-child,html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sash] > span{opacity:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-grip]:hover::before,html[data-claude-chat-look='true'][data-hermes-theme][data-claude-side-resizing] [data-claude-sash]::before{opacity:1;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div[data-claude-has~="child-tree-split-div-tree-group-grp-files"]:not([data-claude-has~="child-tree-split-div-not-style-display-none-tree-gro"]) + div[data-claude-has~="child-tree-group-grp-terminal"] > [role='separator']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-persistent-terminal]{clip-path:inset(0 1px 1px 1px round 0 0 calc(var(--claude-card-radius,10px) - 1px) calc(var(--claude-card-radius,10px) - 1px));}
html[data-claude-chat-look='true'][data-hermes-theme] [class*='group/rail'] li > span[class~='absolute'][class~='right-0']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [class*='group/rail']{border-left-color:var(--claude-card-border,var(--ui-stroke-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip]:has([data-tree-tab='terminal'][role='tab']){align-items:center!important;height:32px!important;min-height:32px!important;padding:0 8px 0 14px!important;background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-has~="tree-tab-terminal-role-tab"] > [role='tablist']{flex:0 1 auto!important;align-items:center!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab']{height:auto!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab']::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab']::after{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] .pane-tab-content,html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] .pane-tab-content > span{padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab']{min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] span.truncate{font-size:14px!important;font-weight:400!important;letter-spacing:normal!important;text-transform:none!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip] [data-tree-tab='terminal'][role='tab'][data-slot='pane-tab'] > span:has(> button[aria-label='Close']),html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-has~="tree-tab-terminal-role-tab"] > button[aria-label='Hide']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='actions']{display:flex;align-items:center;gap:4px;margin-left:auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action]{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--claude-color-text-secondary,currentColor);cursor:pointer;transition:background-color 60ms cubic-bezier(.165,.84,.44,1);-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='add']{margin-left:4px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action]:hover,html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action][aria-pressed='true']{background:var(--claude-fill-ghost-hover);color:var(--claude-color-text,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action] > svg{width:16px;height:16px;}
html[data-claude-chat-look='true'][data-hermes-theme] [class*='group/rail']:has(> ul[aria-label='Terminals']){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip][data-claude-terminal-tabs='true'] > [role='tablist']:not([data-claude-terminal-header]){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='tabs']{display:flex;flex:0 1 auto;align-items:center;gap:4px;min-width:0;overflow-x:auto;scrollbar-width:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='add'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='actions']{flex-shrink:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab]{display:flex;flex:0 1 auto;align-items:center;gap:2px;min-width:52px;height:24px;padding:0 2px 0 8px;overflow:hidden;border-radius:6px;color:var(--claude-color-text-secondary,currentColor);font-size:14px;white-space:nowrap;cursor:pointer;-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab] > span{min-width:0;max-width:140px;overflow:hidden;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab]:hover{background:var(--claude-fill-ghost-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab][aria-selected='true']{flex-shrink:0;background:var(--claude-fill-ghost-selected);color:var(--claude-color-text,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab]:focus-visible{outline:0;box-shadow:inset 0 0 0 1px var(--claude-color-accent,var(--theme-primary,currentColor));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab] > [data-claude-terminal-action]{flex-shrink:0;width:20px;height:20px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='tabs'][data-claude-compact] > [aria-selected='false'] > [data-claude-terminal-action]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='tabs'][data-claude-compact] > [aria-selected='false']{padding-right:8px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab][aria-selected='true'] > [data-claude-terminal-action],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab] > [data-claude-terminal-action]:hover{color:var(--claude-color-text,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-tab] > [data-claude-terminal-action] > svg{width:12px;height:12px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='terminal'] [data-tree-split] > div:not(:has([data-tree-group='grp-terminal'])):not(:has([data-tree-group='grp-sessions'])){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='terminal'] [data-tree-split] > div:has([data-tree-group='grp-terminal']):not(:has([data-tree-group='grp-sessions'])){flex:1 1 0%!important;max-width:none!important;max-height:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='terminal'] [data-tree-split] > div > [data-tree-group='grp-terminal']:not([data-pane-host]):not(#claude-terminal-expanded){margin-top:var(--claude-card-top,40px)!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='terminal'] [data-claude-pane-tools]{visibility:hidden!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'] [data-tree-split] > div:not(:has([data-tree-group='grp-files'])):not(:has([data-tree-group='grp-sessions'])){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'] [data-tree-split] > div:has([data-tree-group='grp-files']):not(:has([data-tree-group='grp-sessions'])){flex:1 1 0%!important;max-width:none!important;max-height:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'] [data-claude-pane-tools]{visibility:hidden!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true']{height:32px!important;padding:0 8px 0 14px!important;align-items:center!important;gap:4px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child{flex:1 1 auto;min-width:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child > span{font-size:0!important;padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child > span > *{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child > span::before{content:'Files';font-size:14px;font-weight:400;line-height:20px;color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border-radius:6px!important;color:var(--claude-color-text-secondary)!important;transition:background-color 60ms cubic-bezier(.165,.84,.44,1)!important;opacity:1!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button:disabled{opacity:0.4!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button:hover,html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button[aria-pressed='true']{background:var(--claude-fill-ghost-hover,var(--ui-row-hover-background))!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > button .codicon{font-size:16px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > [data-claude-terminal-header='files-actions']{display:flex;align-items:center;gap:4px;}
html[data-claude-chat-look='true'][data-hermes-theme] div[data-claude-has~="child-project-tree"]:has(> [data-claude-files-header='true']){container-type:inline-size;}
@container (max-width:260px){html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true']{padding:0 4px!important;gap:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child{flex:1 1 0!important;overflow:hidden;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > div:first-child > span::before{content:''!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] > [data-claude-terminal-header='files-actions']{gap:0;margin-left:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header='true'] button{width:22px!important;min-width:22px!important;height:22px!important;flex:none!important;}}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-joined){margin-right:0!important;border-right-width:0!important;border-top-right-radius:0!important;border-bottom-right-radius:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined){margin-left:0!important;border-top-left-radius:0!important;border-bottom-left-radius:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-pane-host^='preview-tile:']{border-bottom-right-radius:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:url:'],html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [data-zone-tabstrip] button[aria-label='New tab']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [data-panel-header],html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [data-zone-tabstrip]{background:var(--claude-card-background)!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined){border-left-color:var(--claude-file-divider,var(--claude-card-border))!important;border-left-width:1px!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-files-header='true'] > div:first-child > span::before{content:''!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='both']:not([data-claude-expanded]) [data-tree-split] > [data-claude-preview-column]:not(#claude-files-view){flex:0 0 calc(var(--claude-files-card,392px) - var(--claude-files-tree,240px))!important;min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='both']:not([data-claude-expanded]) [data-tree-split] > [data-claude-side-column]:not(#claude-files-view){flex:0 0 var(--claude-files-tree,240px)!important;min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file'] [data-tree-split] > [data-claude-side-column]:not(#claude-files-view),html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='tree'] [data-tree-split] > [data-claude-preview-column]:not(#claude-files-view){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file']:not([data-claude-expanded]) [data-tree-split] > [data-claude-preview-column]:not(#claude-files-view){flex:0 0 var(--claude-files-card,392px)!important;min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='tree']:not([data-claude-expanded]) [data-tree-split] > [data-claude-side-column]:not(#claude-files-view){flex:0 0 var(--claude-files-card,392px)!important;min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file'] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-joined):not(#claude-files-view){margin-right:var(--claude-card-gap,4px)!important;border-right-width:1px!important;border-top-right-radius:var(--claude-card-radius,10px)!important;border-bottom-right-radius:var(--claude-card-radius,10px)!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file'] [data-pane-host^='preview-tile:']{border-bottom-right-radius:calc(var(--claude-card-radius,10px) - 1px)!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='tree'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined):not(#claude-files-view){margin-left:var(--claude-card-gap,4px)!important;border-top-left-radius:var(--claude-card-radius,10px)!important;border-bottom-left-radius:var(--claude-card-radius,10px)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-actions]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='file'] [data-claude-file-actions]{display:flex;flex-shrink:0;align-items:center;gap:2px;margin-left:auto;padding-right:8px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'][data-claude-file-joined] [data-tree-split] > [data-claude-preview-column]:not(#claude-files-expanded){display:flex!important;flex:1 1 0%!important;min-width:0!important;max-width:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'][data-claude-file-joined][data-claude-files-view='both'] [data-tree-split] > [data-claude-side-column]:not(#claude-files-expanded){flex:0 0 var(--claude-files-tree-wide,240px)!important;min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='files'][data-claude-file-joined][data-claude-files-view='file'] [data-tree-split] > [data-claude-side-column]:not(#claude-files-expanded){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined] [data-claude-preview-column] [data-zone-tabstrip] > button[aria-label='Minimize']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name]{height:36px!important;padding:0 8px 0 14px!important;gap:4px!important;border-bottom:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name]::before{content:attr(data-claude-file-name);margin-right:auto;overflow:hidden;font-size:14px;color:var(--claude-color-text-secondary);text-overflow:ellipsis;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name][data-claude-has~="child-claude-mode-rendered"][data-claude-has~="child-claude-mode-source"] > :is([data-claude-mode='rendered'],[data-claude-mode='source'])[class~='underline']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > :is([data-claude-mode='rendered'],[data-claude-mode='source']):not([class~='underline']){display:grid!important;place-items:center;width:26px;height:26px;border-radius:6px;font-size:0!important;color:var(--claude-color-text-secondary)!important;text-decoration:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > :is([data-claude-mode='rendered'],[data-claude-mode='source']):not([class~='underline']):hover{background:var(--claude-menu-hover,var(--ui-row-hover-background));color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > :is([data-claude-mode='rendered'],[data-claude-mode='source']):not([class~='underline'])::before{content:'';width:16px;height:16px;background:currentColor;-webkit-mask:var(--claude-file-mode-icon) center / contain no-repeat;mask:var(--claude-file-mode-icon) center / contain no-repeat;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > [data-claude-mode='source']{--claude-file-mode-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 4.75 1.75 8 5 11.25M11 4.75 14.25 8 11 11.25M9.25 3.25l-2.5 9.5'/%3E%3C/svg%3E");}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > [data-claude-mode='rendered']{--claude-file-mode-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z'/%3E%3Ccircle cx='8' cy='8' r='2'/%3E%3C/svg%3E");}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='empty'] [data-tree-group='grp-files'] [data-project-tree]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='empty'] [data-claude-files-empty]{display:flex;flex:1 1 auto;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:0;padding:0 16px 40px;text-align:center;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] > svg{width:22px;height:22px;margin-bottom:6px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] > strong{font-size:14px;font-weight:500;color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] > span{font-size:13px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-empty] > [data-claude-files-empty-split],html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-claude-files-empty] > span:not([data-claude-files-empty-split]){display:none;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-claude-files-empty] > [data-claude-files-empty-split]{display:block;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-tree-group='grp-files'] div:has(> [data-project-tree]){display:grid!important;grid-template-columns:minmax(0,1fr) var(--claude-files-tree-wide,240px);grid-template-rows:auto auto minmax(0,1fr);}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-tree-group='grp-files'] div[data-claude-has~="child-project-tree"] > [data-claude-files-header]{grid-column:1 / -1;grid-row:1;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-tree-group='grp-files'] [data-claude-tree-filter]{grid-column:2;grid-row:2;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-tree-group='grp-files'] :is([data-project-tree],[data-claude-tree-results]){grid-column:2;grid-row:3;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='split'] [data-claude-files-empty]{display:flex;grid-column:1;grid-row:2 / 4;border-right:1px solid var(--claude-file-divider,var(--claude-card-border));flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:0;padding:0 16px 40px;text-align:center;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='file'] [data-tree-split] > [data-claude-preview-column]:not(#claude-file-over){position:fixed!important;left:var(--claude-over-x)!important;top:var(--claude-over-y)!important;width:var(--claude-over-w)!important;height:var(--claude-over-h)!important;display:flex!important;flex:none!important;min-width:0!important;max-width:none!important;z-index:22;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='file'] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-over):not(#claude-card){margin:0!important;width:100%!important;height:100%!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='file'] [data-claude-preview-column] > [role='separator']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='tree'] [data-tree-split] > [data-claude-preview-column]:not(#claude-file-over){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over][data-claude-files-view='file'] [data-claude-file-actions]{display:flex;flex-shrink:0;align-items:center;gap:2px;margin-left:auto;padding-right:8px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over] [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:url:'],html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over] [data-claude-preview-column] [data-zone-tabstrip] button[aria-label='New tab'],html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-over] [data-claude-preview-column] [data-zone-tabstrip] > button[aria-label='Minimize']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] [role='separator']{--ui-sash-hover-border: color-mix(in srgb, var(--claude-color-text, currentColor) 22%, transparent);}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div:has(> [data-tree-group='grp-files']),html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-hidden='true'] [data-tree-split] > div:has(> [data-tree-split] > div > [data-tree-group='grp-files']):not(:has(> [data-tree-split] > div:not([style*='display: none']) > [data-tree-group]:not([data-tree-group='grp-files']))){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-titlebar-cluster='right']{top:var(--titlebar-controls-top)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-pane-host]:not([data-pane-host='workspace']){border-bottom-left-radius:calc(var(--claude-card-radius) - 1px)!important;border-bottom-right-radius:calc(var(--claude-card-radius) - 1px)!important;overflow:hidden!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:not([data-claude-has~="child-tree-group-grp-sessions-tree-group-grp-main"]) > [role='separator'] > span:first-child{opacity:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] .row-hover{font-size:14px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] .group\\/project-header span:is(.uppercase,[data-pane-self-label]){font-family:inherit!important;font-size:13px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:none!important;color:var(--claude-color-text,var(--ui-text-primary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div > [data-tree-group]:not([data-tree-group='grp-sessions']):not([data-tree-group='grp-main']):not([data-claude-has~="tree-tab-workspace"]) [data-slot='pane-tab'] span.truncate{font-size:13px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] [data-slot='sidebar-content'] > div:has(input[aria-label='Search sessions']){padding-left:0.4px!important;padding-right:6.6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']){height:26px!important;min-height:26px!important;padding:0 8px 0 9px!important;opacity:1!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div[data-claude-has~="child-input-label-search-sessions"] > svg{margin-right:2.2px!important;color:var(--claude-search-text,var(--claude-color-text-tertiary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme]{--claude-tool-well: color-mix(in srgb, var(--ui-base, #141413) 5%, var(--ui-editor-surface-background, Canvas));--claude-code-text: #3760BF;--claude-code-str: #587539;--claude-code-cmd: #007197;--claude-code-kw: #9854F1;--claude-code-fn: #2E7DE9;--claude-code-num: #B15C00;--claude-code-flag: #8C6C3E;--claude-code-op: #006A83;--claude-code-com: #848CB5;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']{--claude-tool-well: #F0EEE6;}
html[data-claude-chat-look='true'][data-hermes-theme][data-hermes-mode='dark']{--claude-tool-well: #1A1B26;--claude-code-text: #C0CAF5;--claude-code-str: #9ECE6A;--claude-code-cmd: #2AC3DE;--claude-code-kw: #BB9AF7;--claude-code-fn: #7AA2F7;--claude-code-num: #FF9E64;--claude-code-flag: #E0AF68;--claude-code-op: #89DDFF;--claude-code-com: #565F89;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] button[aria-expanded] > span > span > span[class*='size-3.5']:first-child{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open]{border:1px solid var(--claude-tool-border,var(--claude-k-2d2d2d))!important;border-radius:8px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:first-child{border-bottom:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] pre{margin:0 2px 2px;border-radius:6px;background:var(--claude-tool-well)!important;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']{--claude-tool-card: rgb(0 0 0 / 10%);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']{--claude-tool-card: rgb(255 255 255 / 10%);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] :is([data-claude-tool-stack],[data-claude-stack]){--claude-color-text-secondary: #C3C2B7;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']:not([data-hermes-mode='dark']) :is([data-claude-tool-stack],[data-claude-stack]){--claude-color-text-tertiary: #898781;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='aui_assistant-message-content'] :is([data-tool-row],[data-tool-summary])[data-conversation-scaffold]{opacity:1!important;transition:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack] :is([data-tool-summary],[data-tool-row] > div:first-child) .whitespace-nowrap{font-size:13px!important;line-height:19px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack] :is([data-tool-summary],[data-tool-row] > div:first-child) .whitespace-nowrap:not(.text-destructive,[class*='amber']){color:var(--claude-color-text-tertiary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack] :is([data-tool-summary]:hover,[data-tool-row]:is(:hover,[data-tool-open]) > div:first-child) .whitespace-nowrap:not(.text-destructive,[class*='amber']){color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack] [data-slot='timeline-timestamp']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] [data-tool-summary] button .whitespace-nowrap,html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] button[aria-expanded] .whitespace-nowrap{font-size:14px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not(:has(.tool-ticker)):not(.tool-ticker):not(:empty){gap:0!important;margin-top:6px;overflow:hidden;border:1px solid var(--claude-tool-card,var(--claude-k-333332));border-radius:10px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > [data-tool-row],html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > * > [data-tool-row]{border:0!important;border-radius:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > [data-tool-row] + [data-tool-row],html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > * + * > [data-tool-row]{border-top:1px solid var(--claude-tool-card,var(--claude-k-333332))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > [data-tool-row] > div:first-child,html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > * > [data-tool-row] > div:first-child{padding:7px 12px!important;border-bottom:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group]:not([data-claude-has~="child-tool-summary"]) [data-tool-row][data-tool-open]{border:0!important;border-radius:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group]:not([data-claude-has~="child-tool-summary"]) [data-tool-row][data-tool-open] > div:first-child{padding:0!important;border-bottom:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group]:not([data-claude-has~="child-tool-summary"],[data-claude-stack]) [data-tool-row][data-tool-open] > div:nth-child(2){margin:6px 0 4px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group]:not([data-claude-has~="child-tool-summary"],[data-claude-stack]) [data-tool-row][data-tool-open] > div:nth-child(2):has([data-claude-payload]){padding:12px 14px!important;border:1px solid var(--claude-tool-card,var(--claude-k-333332))!important;border-radius:10px!important;background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:nth-child(2){width:auto!important;min-width:0;grid-template-columns:minmax(0,1fr);margin:0 12px 12px;padding:8px 10px!important;border:1px solid var(--claude-tool-card,var(--claude-k-333332));border-radius:8px;background:var(--claude-tool-well);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:nth-child(2) pre:not([data-claude-payload] *){max-height:400px!important;margin:0!important;padding:4px 0 0!important;background:transparent!important;font-family:ui-monospace,'Cascadia Mono',Consolas,monospace!important;font-size:12px!important;line-height:17px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:nth-child(2) code{font-family:ui-monospace,'Cascadia Mono',Consolas,monospace!important;font-size:12px!important;line-height:17px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] button[aria-expanded] > span > span > span[class*='size-3.5']:first-child:has([role='status'] .glyph-spinner){display:inline-grid!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status'][data-claude-has~="glyph-spinner"] > *{visibility:hidden;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status']:has(.glyph-spinner),html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="tool-row-role-status-glyph-spinner"] > [data-tool-summary] button::before{position:relative;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status']:has(.glyph-spinner)::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="tool-row-role-status-glyph-spinner"] > [data-tool-summary] button::before{content:'';flex:none;display:block;width:12px;height:12px;background:radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 50% 0 / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 100% 50% / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 50% 100% / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 0 50% / 4px 4px no-repeat;animation:claude-working-turn 1.6s steps(8) infinite;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status']:has(.glyph-spinner)::before{position:absolute;inset:1px;width:auto;height:auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="tool-row-role-status-glyph-spinner"] > [data-tool-summary] button{align-items:center!important;gap:8px!important;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [role='status']:has(.glyph-spinner)::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-has~="tool-row-role-status-glyph-spinner"] > [data-tool-summary] button::before{animation:none;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] .tool-ticker button[aria-expanded] .whitespace-nowrap{font-size:14px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] .tool-ticker [data-tool-row]{border:0!important;border-radius:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] .tool-ticker [data-tool-row] > div:first-child{padding:0!important;border:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='aui_user-message-root'] button[aria-label='Stop']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group],html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] > div:not([data-tool-summary]){grid-template-columns:minmax(0,1fr)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group] [data-tool-summary] > div{min-width:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-host] > :is(button,pre):not([data-claude-payload] *),html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-skip]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-host='product'] > :not([data-claude-payload]){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload]{display:grid;gap:8px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-empty]{font-size:13px;line-height:19px;color:var(--claude-color-text-tertiary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [data-claude-payload] pre{max-height:400px!important;margin:0!important;padding:0!important;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:transparent!important;font-family:ui-monospace,'Cascadia Mono',Consolas,monospace!important;font-size:12px!important;line-height:17px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-well]{display:flex;align-items:flex-start;gap:8px;min-width:0;padding:4px 8px;border-radius:8px;background:var(--claude-tool-well);box-shadow:0 0 0 1px color-mix(in srgb,var(--claude-color-text) 10%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] [data-claude-payload] pre[data-claude-payload-code][data-claude-payload-code]{flex:1;min-width:0;max-height:10.5lh!important;color:var(--claude-code-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-copy]{display:flex;flex-shrink:0;align-items:center;height:17px;color:var(--claude-color-text-tertiary);font-size:12px;opacity:0;transition:color 60ms,opacity 60ms cubic-bezier(.32,.72,0,1);}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-tool-row][data-tool-open]:hover,[data-claude-payload]:focus-within) [data-claude-payload-copy]{opacity:1;transition-duration:60ms,120ms;transition-delay:0s,100ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-copy]:is(:hover,:focus-visible){color:var(--claude-color-text-secondary);outline:none;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-copy]{transition:none!important;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='str']{color:var(--claude-code-str);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='cmd']{color:var(--claude-code-cmd);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='kw']{color:var(--claude-code-kw);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='fn']{color:var(--claude-code-fn);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='num']{color:var(--claude-code-num);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='flag']{color:var(--claude-code-flag);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='op']{color:var(--claude-code-op);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-code] [data-t='com']{color:var(--claude-code-com);font-style:italic;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-tool-open] > div:nth-child(2):has([data-claude-payload]){padding:0!important;border:0!important;background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='closed']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack]{margin-top:16px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack]:has(> button[aria-expanded='false']){margin-bottom:16px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack] > button{display:flex;align-items:center;gap:6px;max-width:100%;min-width:0;min-height:24px;border-radius:6px;color:var(--claude-color-text-tertiary,var(--ui-text-tertiary));font-size:13px;font-weight:400;line-height:19px;text-align:left;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack] > button:is(:hover,[aria-expanded='true']){color:var(--claude-color-text-secondary,var(--ui-text-secondary));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack] > button:focus-visible{color:var(--claude-color-text-secondary,var(--ui-text-secondary));outline:none;box-shadow:inset 0 0 0 1px var(--claude-color-accent,var(--theme-primary,currentColor));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-label]{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-file]{color:var(--claude-color-text,var(--foreground));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-file]:hover{text-decoration:underline;text-underline-offset:3px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-time]{flex-shrink:0;font-variant-numeric:tabular-nums;color:var(--claude-color-text-tertiary,var(--ui-text-tertiary));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-clause][data-error]{color:var(--claude-k-ec7e7e,#EC7E7E);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-diff]{display:inline-flex;flex-shrink:0;gap:4px;font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;line-height:16px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-diff][hidden]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-diff] > span{padding:0 6px;border-radius:4px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-diff] > [data-add]{color:var(--ui-diff-add-border);background:color-mix(in srgb,var(--ui-diff-add-border) 20%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-diff] > [data-del]{color:var(--ui-diff-remove-border);background:color-mix(in srgb,var(--ui-diff-remove-border) 20%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-spinner]{display:inline-block;width:12px;height:12px;margin-right:6px;vertical-align:-1px;background:radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 50% 0 / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 100% 50% / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 50% 100% / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 0 50% / 4px 4px no-repeat;animation:claude-working-turn 1.6s steps(8) infinite;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack] .codicon{flex-shrink:0;margin-left:-4px;font-size:12px;transition:transform 60ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack] > button[aria-expanded='true'] .codicon{transform:rotate(90deg);}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack] .codicon{transition:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tool-stack-spinner]{animation:none;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack] :is([data-tool-summary],[data-tool-row] > div:first-child) .codicon-chevron-right::before{content:'\\eb70';}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack] :is([data-tool-summary],[data-tool-row] > div:first-child) [class*='disclosure-caret-rest']{opacity:1!important;color:var(--claude-color-text-tertiary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack] :is([data-tool-summary],[data-tool-row] > div:first-child) .codicon-chevron-right{transition-duration:60ms!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack] [data-tool-row][data-tool-open] > div:nth-child(2):has([data-claude-payload]){margin:0!important;padding:6px 0 2px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open']{margin:0!important;padding:6px 8px;border:1px solid var(--claude-tool-card,var(--claude-k-333332));border-bottom-width:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-claude-stack-first]{margin-top:6px!important;border-radius:10px 10px 0 0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-claude-stack-last]{margin-bottom:16px!important;border-bottom-width:1px;border-radius:0 0 10px 10px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-claude-stack-first][data-claude-stack-last]{border-radius:10px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-claude-has~="child-tool-summary"]{padding:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-claude-has~="child-tool-summary"] > [data-tool-summary]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-stack='open'][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]){margin:0!important;border:0!important;border-radius:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-stack='open'][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]) [data-tool-row]{padding:6px 8px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-stack='open'][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > [data-tool-row] > div:first-child,html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-group][data-claude-stack='open'][data-claude-has~="child-tool-summary"] > div:not([data-tool-summary]):not([data-claude-has~="tool-ticker"]):not(.tool-ticker) > * > [data-tool-row] > div:first-child{padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-slot='tool-block'][data-file-edit][data-tool-open]{background:transparent!important;border-color:var(--claude-tool-card,var(--claude-k-333332))!important;border-radius:0!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-claude-stack-first][data-slot='tool-block'][data-file-edit][data-tool-open]{border-radius:10px 10px 0 0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-claude-stack-last][data-slot='tool-block'][data-file-edit][data-tool-open]{border-radius:0 0 10px 10px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-claude-stack-first][data-claude-stack-last][data-slot='tool-block'][data-file-edit][data-tool-open]{border-radius:10px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-slot='tool-block'][data-file-edit][data-tool-open] > div:first-child{padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-slot='tool-block'][data-file-edit][data-tool-open] > div:first-child button[aria-expanded] .whitespace-nowrap{font-size:13px!important;line-height:19px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-slot='tool-block'][data-file-edit][data-tool-open] > div:nth-child(2){margin:6px 0 2px!important;padding:0!important;overflow:hidden;border-radius:8px;background:var(--claude-diff-card-surface)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--claude-color-text) 10%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-stack='open'][data-slot='tool-block'][data-file-edit][data-tool-open] > div:nth-child(2) [data-slot='file-diff-panel']{margin:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row] > div:first-child button[aria-label='Dismiss']{opacity:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row]:is(:hover,:focus-within) > div:first-child button[aria-label='Dismiss']{opacity:1!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-file-edit][data-tool-open] > div:nth-child(2){border:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-prompt]{color:var(--claude-color-text-secondary);user-select:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-out]{padding:2px 2px 0!important;color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-exit]{font-size:13px;line-height:19px;color:var(--claude-color-text-tertiary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-payload-exit][data-failed]{color:var(--claude-k-ec7e7e);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-file-edit][data-tool-open] > div:nth-child(2) > .text-destructive{display:grid;gap:4px;padding:4px 8px;font-size:11px!important;line-height:17px!important;color:var(--claude-k-ec7e7e);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tool-row][data-file-edit][data-tool-open] > div:nth-child(2) > .text-destructive::after{content:'Not applied';color:var(--claude-color-text-secondary);}
@keyframes claude-approval-in{from{opacity:0;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card']{display:grid;gap:12px;padding:12px;animation:claude-approval-in 160ms ease-out;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card'] > :is(div,pre){padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card'] > div:first-child > span:first-of-type,html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card'] :is([data-approval-deny],[data-approval-run]){font-size:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card'] > div:first-child > span:first-of-type::before{content:'Allow Hermes to run this command?';font-size:13px;color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card'] [data-approval-deny]::before{content:'Deny';font-size:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card'] [data-approval-run]::before{content:'Allow once';font-size:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card'] [data-approval-run] > span{font-size:12px;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-approval-card']{animation:none;}}
@keyframes claude-working-turn{to{transform:rotate(360deg);}}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading']) .dither{position:relative;background:none!important;color:transparent!important;opacity:1!important;-webkit-mask:none!important;mask:none!important;animation:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading']) .dither::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 50% 0 / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 100% 50% / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 50% 100% / 4px 4px no-repeat,radial-gradient(circle,var(--claude-working,#D97757) 1.3px,transparent 1.7px) 0 50% / 4px 4px no-repeat;animation:claude-working-turn 1.6s steps(8) infinite;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading']) .dither::before{animation:none;}}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading']):not([aria-label='Summarizing thread']){gap:16px!important;min-height:20px;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading']):not([aria-label='Summarizing thread']) .dither{width:18px!important;height:18px!important;flex:0 0 18px;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading']):not([aria-label='Summarizing thread']) .dither::before{background-size:6px 6px;background-image:radial-gradient(circle,var(--claude-working,#D97757) 2px,transparent 2.5px),radial-gradient(circle,var(--claude-working,#D97757) 2px,transparent 2.5px),radial-gradient(circle,var(--claude-working,#D97757) 2px,transparent 2.5px),radial-gradient(circle,var(--claude-working,#D97757) 2px,transparent 2.5px);}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading']):not([aria-label='Summarizing thread']) .shimmer{font-size:13px!important;line-height:20px!important;color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']){position:relative;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover{background:var(--claude-search-hover,var(--claude-k-333333))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover::after,html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']:focus-visible)::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']:focus-visible)::after{position:absolute;top:50%;transform:translateY(-50%);pointer-events:none;display:inline-grid;min-width:16px;height:16px;box-sizing:border-box;place-items:center;padding:0 4px;border:1px solid var(--claude-kbd-border,var(--claude-k-4a4a48));border-radius:4px;color:var(--claude-kbd-text,var(--claude-k-a5a49a));font:inherit;font-size:10.5px;line-height:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']:focus-visible)::before{content:'Ctrl';right:28px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']):hover::after,html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions']:focus-visible)::after{content:'K';right:8px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] input[aria-label='Search sessions']{cursor:pointer;}
html[data-claude-palette-mirror] :is([role='dialog']:has(> [cmdk-root]),[data-slot='dialog-overlay']){visibility:hidden!important;animation:none!important;transition:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog']:has(> [cmdk-root]){top:clamp(calc(var(--titlebar-height,34px) + 16px),calc((100vh - min(440px,60vh) - 130px) / 2),15vh)!important;width:min(668px,calc(100vw - 32px))!important;max-width:none!important;translate:-50% 0!important;transform-origin:top!important;overflow:hidden;border:1px solid var(--claude-menu-border)!important;border-radius:14px!important;background:var(--claude-menu-background)!important;box-shadow:0 25px 50px -12px rgb(0 0 0 / 25%)!important;}
@media (min-width:1024px){html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog']:has(> [cmdk-root]){top:clamp(calc(var(--titlebar-height,34px) + 16px),calc((100vh - min(440px,60vh) - 130px) / 2),25vh)!important;}}
@media (prefers-reduced-motion:no-preference){html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog']:has(> [cmdk-root])[data-state='open']{animation:claude-pop-in 200ms cubic-bezier(.165,.84,.44,1) both!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog']:has(> [cmdk-root])[data-state='closed']{animation:claude-pop-out 120ms cubic-bezier(.32,.72,0,1) both!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-panel]{transform-origin:top;animation:claude-pop-in 200ms cubic-bezier(.165,.84,.44,1) both;}}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='command-input-wrapper']{height:56px!important;padding:0 22px!important;border-bottom:1px solid var(--claude-menu-border)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='command-input-wrapper'] > svg{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [cmdk-input]{font-size:15px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [cmdk-list]{max-height:min(440px,60vh)!important;padding:6px 9px 8px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [cmdk-group-heading]{padding:10px 12px 6px!important;color:var(--claude-color-text-tertiary)!important;font-size:12.5px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='command-item']{min-height:36px!important;padding:0 12px!important;border-radius:8px!important;color:var(--claude-sidebar-text,var(--claude-color-text))!important;font-size:14px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='command-item'][data-selected='true']{background:var(--claude-palette-selected,var(--claude-k-313130))!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='dialog'][data-claude-has~="child-cmdk-root"] [data-slot='kbd']{border:1px solid var(--claude-kbd-border,var(--claude-k-4a4a48))!important;border-radius:4px!important;background:transparent!important;color:var(--claude-kbd-text,var(--claude-k-a5a49a))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-palette-foot]{display:flex;height:40px;align-items:center;gap:22px;padding:0 22px;border-top:1px solid var(--claude-menu-border);color:var(--claude-color-text-tertiary);font-size:12.5px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-palette-foot] > span{display:inline-flex;align-items:center;gap:6px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-palette-foot] kbd{display:inline-grid;min-width:16px;height:16px;box-sizing:border-box;place-items:center;padding:0 4px;border:1px solid var(--claude-kbd-border,var(--claude-k-4a4a48));border-radius:4px;color:var(--claude-kbd-text,var(--claude-k-a5a49a));font:inherit;font-size:10.5px;line-height:14px;}
html:not([data-claude-chat-look='true']) [data-claude-palette-foot]{display:none!important;}
html:not([data-claude-chat-look='true']) [data-claude-search-dialog]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-dialog]{position:fixed;inset:0;z-index:var(--z-modal,150);display:grid;place-items:center;background:var(--claude-backdrop,rgb(0 0 0 / 50%));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-panel]{display:flex;box-sizing:border-box;width:min(668px,calc(100vw - 32px));height:min(580px,calc(100vh - 48px));flex-direction:column;overflow:hidden;border:1px solid var(--claude-menu-border);border-radius:14px;background:var(--claude-menu-background);color:var(--claude-color-text);box-shadow:0 25px 50px -12px rgb(0 0 0 / 25%);font-size:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-head]{display:flex;height:52px;flex:none;align-items:center;gap:8px;padding:0 14px 0 22px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-head] > input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--claude-color-text);font:inherit;font-size:15px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-head] > input::placeholder{color:var(--claude-search-text,var(--claude-color-text-tertiary));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-close]{display:grid;width:28px;height:28px;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--claude-color-text-secondary);cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-close]:hover{background:var(--claude-menu-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-tabs]{display:flex;flex:none;gap:2px;overflow-x:auto;scrollbar-width:none;padding:0 16px 12px;border-bottom:1px solid var(--claude-menu-border);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-tabs] > button{flex:none;white-space:nowrap;height:28px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--claude-color-text-tertiary);font:inherit;font-size:14px;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-tabs] > button:hover{color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-tabs] > button[aria-selected='true']{background:var(--claude-palette-selected,var(--claude-k-313130));color:var(--claude-color-text);font-weight:600;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-list]{flex:1;min-height:0;overflow-y:auto;padding:8px 9px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-heading]{padding:10px 12px 6px;color:var(--claude-color-text-tertiary);font-size:12.5px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row]{display:flex;height:36px;align-items:center;gap:10px;padding:0 12px;border-radius:8px;color:var(--claude-sidebar-text,var(--claude-color-text));cursor:default;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row] > .codicon{width:16px;flex:none;font-size:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][aria-selected='true']{background:var(--claude-palette-selected,var(--claude-k-313130));color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][aria-selected='true'] [data-claude-search-title]{font-weight:600;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-title]{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-meta]{flex:none;color:var(--claude-color-text-tertiary);font-size:12.5px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-more],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-enter]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][aria-selected='true'] [data-claude-search-meta]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][data-claude-search-state][aria-selected='true'] [data-claude-search-meta]{display:block;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][data-claude-search-state] :is([data-claude-search-more],[data-claude-search-enter]){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][data-claude-search-state]{cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][data-claude-search-state]:hover [data-claude-search-meta]{text-decoration:underline;text-underline-offset:3px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row][aria-selected='true'] :is([data-claude-search-more],[data-claude-search-enter]){display:grid;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-more]{width:24px;height:22px;place-items:center;border:0;border-radius:5px;background:transparent;color:var(--claude-color-text-secondary);cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-more]:hover{background:var(--claude-menu-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-enter]{color:var(--claude-color-text-tertiary);font-size:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-empty]{display:grid;height:100%;min-height:160px;place-content:center;justify-items:center;gap:10px;color:var(--claude-color-text-secondary);text-align:center;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-empty] > p{margin:0;color:var(--claude-color-text);font-size:15px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-empty] > button{height:28px;padding:0 12px;border:0;border-radius:7px;background:var(--claude-palette-selected,var(--claude-k-313130));color:var(--claude-color-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-foot]{display:flex;height:40px;flex:none;align-items:center;gap:22px;padding:0 22px;border-top:1px solid var(--claude-menu-border);color:var(--claude-color-text-tertiary);font-size:12.5px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-foot] > span{display:inline-flex;align-items:center;gap:6px;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-search-foot],[data-claude-search-row-menu]) kbd{display:inline-grid;min-width:16px;height:16px;box-sizing:border-box;place-items:center;padding:0 4px;border:1px solid var(--claude-kbd-border,var(--claude-k-4a4a48));border-radius:4px;color:var(--claude-kbd-text,var(--claude-k-a5a49a));font:inherit;font-size:10.5px;line-height:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu]{position:fixed;z-index:1;box-sizing:border-box;width:280px;padding:6px;border:1px solid var(--claude-menu-border);border-radius:10px;background:var(--claude-menu-background);box-shadow:0 12px 32px var(--claude-menu-shadow);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu-head]{display:grid;gap:2px;padding:6px 8px 8px;margin-bottom:4px;border-bottom:1px solid var(--claude-menu-border);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu-head] > strong{font-weight:600;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu-head] > span{color:var(--claude-color-text-tertiary);font-size:12.5px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu] > button{display:flex;width:100%;height:32px;align-items:center;justify-content:space-between;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--claude-color-text);font:inherit;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-search-row-menu] > button:is(:hover,:focus-visible){background:var(--claude-palette-selected,var(--claude-k-313130));outline:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host]:not(#claude-ascii-none){isolation:isolate;background:var(--claude-color-chat)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host] :is([data-slot='thread'],div:has(> [data-slot='composer-bounds']),[data-slot='composer-bounds'],[data-slot='aui_thread-viewport'],[data-slot='aui_thread-content']){background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-backdrop]{position:absolute;inset:0;z-index:-1;width:100%;height:100%;pointer-events:none;}
html:not([data-claude-chat-look='true']) [data-claude-ascii-backdrop]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div:has(> [data-tree-group='grp-sessions']):not([style*='display: none']):not([style*='flex: 0 0']):not([style*='flex:0 0']){flex:0 0 var(--claude-sidebar-width,234px)!important;max-width:var(--claude-sidebar-width,234px)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']):not([style*='flex: 0 0']):not([style*='flex:0 0']) [data-tour='sessions-sidebar']{width:100%!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [role='separator'][class~='inset-y-0']{--claude-split-scale: 1 !important;}
@media (min-resolution:1.2dppx){html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [role='separator'][class~='inset-y-0']{--claude-split-scale: .8 !important;}}
@media (min-resolution:1.45dppx){html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [role='separator'][class~='inset-y-0']{--claude-split-scale: .667 !important;}}
@media (min-resolution:1.95dppx){html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [role='separator'][class~='inset-y-0']{--claude-split-scale: .5 !important;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tour='sessions-sidebar'] .session-row-tail{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [role='tablist']{flex:0 0 auto!important;align-self:center;gap:2px;height:30px;padding:3px;border-radius:8px;background:var(--claude-segment-track);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab']{height:24px!important;border:0!important;border-radius:6px!important;background:transparent!important;box-shadow:none!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab']::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab']::after{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab'][data-active='true']{background:var(--claude-segment-active)!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [data-slot='pane-tab'] span[class~='uppercase']{font-size:13px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] > [role='tablist']{order:1;margin-left:auto!important;margin-right:8px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-sessions'] [role='tab'][data-slot='pane-tab']{justify-content:center!important;width:30px!important;min-width:30px!important;max-width:30px!important;padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-sessions'] [role='tab'][data-slot='pane-tab'] > *{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-sessions'] [role='tab'][data-slot='pane-tab'][data-tree-tab]::after{content:''!important;display:block!important;position:static!important;width:16px!important;height:16px!important;background:currentColor!important;-webkit-mask:var(--claude-segment-icon) center / 16px 16px no-repeat!important;mask:var(--claude-segment-icon) center / 16px 16px no-repeat!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [role='tab'][data-tree-tab='sessions']{order:1;--claude-segment-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13.25 7.25c0 2.9-2.35 4.75-5.25 4.75-.75 0-1.45-.1-2.1-.35L2.75 13l.9-2.55C3.05 9.6 2.75 8.45 2.75 7.25 2.75 4.35 5.1 2.5 8 2.5s5.25 1.85 5.25 4.75z'/%3E%3C/svg%3E");}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [role='tab']:not([data-tree-tab='sessions']){order:2;--claude-segment-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2.75' y='5' width='10.5' height='8' rx='2'/%3E%3Cpath d='M8 5V2.75M1.25 8.5v1.5M14.75 8.5v1.5M6.25 10.75h3.5'/%3E%3Ccircle cx='8' cy='2.25' r='.5' fill='black'/%3E%3Ccircle cx='5.75' cy='8.25' r='.7' fill='black' stroke='none'/%3E%3Ccircle cx='10.25' cy='8.25' r='.7' fill='black' stroke='none'/%3E%3C/svg%3E");}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip],html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip] [role='tab'],html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip] [role='tab'] *{cursor:default!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [role='tab'],html[data-claude-chat-look='true'][data-hermes-theme] [data-zone-tabstrip='grp-sessions'] [role='tab'] *,html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-history] > button:not(:disabled){cursor:pointer!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-history]{display:flex;order:0;align-items:center;gap:2px;margin-left:2px;-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-history] > button{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--claude-sidebar-text,var(--claude-color-text-secondary,currentColor));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-history] > button:hover:not(:disabled){background:var(--claude-sidebar-hover,var(--ui-row-hover-background));color:var(--claude-color-text,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-history] > button:disabled{pointer-events:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-history] > button:disabled > svg{opacity:0.5;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-window-inactive] :is([data-claude-pane-tool],[data-claude-sidebar-history] > button,[data-claude-title-chevron],[data-titlebar-cluster] button),html[data-claude-chat-look='true'][data-hermes-theme][data-claude-window-inactive] [data-titlebar-cluster='left'] button:has(i[class~='codicon-layout-sidebar-left']):is(*,:hover){color:color-mix(in srgb,var(--claude-color-text,currentColor) 35%,transparent)!important;filter:grayscale(1);}
@media (hover:none){html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-sidebar-toggle],[data-claude-sidebar-history]){opacity:1;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-history] svg{width:16px;height:16px;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-sidebar-toggle],[data-claude-sidebar-history]){opacity:.7;transition:opacity 120ms cubic-bezier(.32,.72,0,1);}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-hovered] :is([data-claude-sidebar-toggle],[data-claude-sidebar-history]),html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-toggle]:is(:hover,:focus-visible),html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-sidebar-history]:is(:hover,:has(:focus-visible)){opacity:1;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-titlebar-cluster='left'] button:has(i[class~='codicon-layout-sidebar-left']){color:var(--claude-sidebar-text,var(--claude-color-text-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-titlebar-cluster='left'] button:has(i[class~='codicon-layout-sidebar-left']):hover{background:var(--claude-sidebar-hover,var(--ui-row-hover-background))!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-folded]:not([data-claude-sidebar-peek]) [data-claude-sidebar-shell]{flex:0 0 0px!important;min-width:0!important;width:0!important;overflow:hidden!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-peek] [data-claude-sidebar-shell]{position:fixed!important;top:0;bottom:0;left:0;z-index:60;flex:none!important;width:var(--claude-sidebar-width,234px)!important;border-right:.5px solid var(--claude-color-border-subtle,var(--ui-stroke-quaternary));background:var(--claude-menu-background,var(--claude-color-sidebar,var(--ui-sidebar-surface-background)));box-shadow:var(--claude-peek-shadow,var(--shadow-nous));animation:claude-sidebar-peek-fade 140ms ease,claude-sidebar-peek 180ms cubic-bezier(.32,.72,0,1);transition:opacity 140ms ease,transform 180ms cubic-bezier(.32,.72,0,1);}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-peek][data-claude-sidebar-peek-leaving] [data-claude-sidebar-shell]{opacity:0;transform:translateX(-4px);pointer-events:none;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-peek] [data-claude-sidebar-shell]{animation:none;transition:none;}}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-peek] :is([data-slot='statusbar'] button[data-claude-backend-dock],[data-claude-update-dock]:not([hidden])){z-index:61!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-flipped] [data-tree-group='grp-sessions'][data-window-top] > [data-panel-header]{height:72px!important;min-height:72px!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-sidebar-flipped] [data-tree-group='grp-sessions'][data-window-top] > [data-panel-header] [data-zone-tabstrip='grp-sessions']{position:absolute!important;top:36px!important;bottom:auto!important;left:0!important;right:0!important;}
@keyframes claude-sidebar-peek{from{transform:translateX(-4px);}}
@keyframes claude-sidebar-peek-fade{from{opacity:0;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip='grp-main'] [role='tab'],html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']){--tab-bg: transparent;--tab-face: transparent;background:transparent!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']){color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab'] > .pane-tab-content > :is(span,button) > span.truncate{font-size:14px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) > .pane-tab-content > :is(span,button) > span.truncate{font-weight:450!important;letter-spacing:normal!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']){max-width:min(640px,100%)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) > span:has(> button[aria-label='Close']){display:none!important;}
[data-claude-title-chevron]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) [data-claude-title-chevron]{display:inline-grid;place-items:center;flex:none;width:24px;height:24px;margin-left:0;padding:0;border:0;border-radius:6px;background:transparent;color:var(--claude-sidebar-text,var(--claude-color-text-secondary));cursor:pointer;-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) [data-claude-title-chevron] > .codicon{font-size:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) [data-claude-title-chevron]:is(:hover,[aria-expanded='true']){background:var(--claude-ghost-hover,var(--claude-account-hover));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) span.truncate[data-claude-title-rename]{margin:0 -4px;padding:0 4px;border-radius:6px;cursor:text!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) span.truncate[data-claude-title-rename]:hover{background:var(--claude-ghost-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-claude-title-editing] :is(span.truncate[data-claude-title-rename],[data-claude-title-chevron]){visibility:hidden;}
[data-claude-title-edit]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-edit]{display:block;position:fixed;z-index:60;box-sizing:content-box;min-width:1ch;margin:0;padding:0;border:0;border-radius:3px;outline:1.5px solid var(--claude-menu-check,var(--theme-primary,Highlight));outline-offset:1px;background:transparent;color:var(--claude-color-text);field-sizing:content;-webkit-app-region:no-drag;}
html[data-claude-title-proxy] [data-radix-popper-content-wrapper]:has([role='menu']),html[data-claude-title-proxy] :is([data-slot='dialog-content'],[data-slot='dialog-overlay']){opacity:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-claude-has~="slot-message"]) [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) [data-claude-title-chevron]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu]{min-width:128px;padding:4px!important;border:0!important;border-radius:10px!important;background:var(--claude-k-202020)!important;box-shadow:inset 0 0 0 1px var(--claude-card-border,var(--claude-k-2b2b2b)),0 8px 24px rgb(0 0 0 / 32%),0 2px 6px rgb(0 0 0 / 20%)!important;font-size:14px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem']{min-height:28px;padding:4px 8px!important;border-radius:6px!important;font-size:14px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem']:not([data-variant='destructive']){color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem']:is([data-highlighted],:hover){background:var(--claude-palette-selected,var(--claude-k-313130))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem']{white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role^='menuitem'] > :is(svg,.codicon):first-child{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [role='menuitem'][data-variant='destructive']{color:var(--claude-k-ec7e7e)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-title-menu] > [data-claude-title-menu-hidden]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group]:not([data-claude-has~="slot-message"]) [data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'],[data-active='true']) > .pane-tab-content > :is(span,button) > span.truncate{font-weight:400!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] > [role='tablist']{padding-left:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group='grp-main'] > div:has(> [data-zone-tabstrip='grp-main']),html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main']{height:36px!important;min-height:36px!important;background:var(--claude-color-chat)!important;border-bottom:0!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] [role='tab'] > .pane-tab-content > span.ml-2:first-child:not(:has([role='status'],[class*='animate-'])),html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-main'] button[aria-label='New session tab']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-sessions'] [role='tab'] > .pane-tab-content > :is(span,button) > span.truncate{font-size:13px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip='grp-sessions'] [role='tab']{height:24px!important;min-height:24px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-dock']:not([data-popped-out]) [data-slot='composer-fade'],html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-dock']:not([data-popped-out]) [data-slot='composer-surface']{opacity:1!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-dock']:not([data-popped-out]){background:var(--claude-color-chat);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-dock']:not([data-popped-out])::before{content:'';position:absolute;inset:-32px 0 100% 0;background:linear-gradient(to bottom,transparent,var(--claude-color-chat));pointer-events:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host] [data-slot='composer-dock']:not([data-popped-out]){background:transparent;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host] [data-slot='composer-dock']:not([data-popped-out])::before{content:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-ascii-host] [data-slot='composer-dock']:not([data-popped-out]){bottom:max(0px,min(45%,100% - 300px));}
html[data-claude-chat-look='true'] [data-claude-landing]{position:absolute;right:0;bottom:100%;left:0;box-sizing:border-box;display:flex;flex-direction:row;align-items:center;gap:6px;width:min(768px,100%);margin:0 auto;padding:12px 0 24px;pointer-events:none;}
html[data-claude-chat-look='true'] [data-claude-landing] h1{margin:0;font:inherit;font-size:20px;line-height:25px;font-weight:400;letter-spacing:normal;text-transform:none;color:var(--claude-color-text);}
html[data-claude-chat-look='true'] [data-claude-landing-spark]{flex:none;width:22px;height:22px;transform:translateY(1px);fill:none;stroke:var(--claude-working,#D97757);stroke-width:9;stroke-linecap:round;stroke-linejoin:round;animation:claude-landing-pulse 0.42s cubic-bezier(0.165,0.84,0.44,1) both;}
@keyframes claude-landing-pulse{0%{scale:1;}
35%{scale:1.05;}
100%{scale:1;}}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] [data-claude-landing-spark]{animation:none;}}
html:not([data-claude-chat-look='true']) [data-claude-landing],[data-slot='composer-dock'][data-popped-out] > [data-claude-landing]{display:none!important;}
html[data-claude-chat-look='true'] [data-claude-ascii-host] [data-slot='aui_intro'] > div{visibility:hidden;}
html[data-claude-chat-look='true'] [data-slot='skeleton']{position:relative;overflow:hidden;background:color-mix(in srgb,var(--claude-color-text) 7.5%,transparent)!important;animation:none!important;--claude-skeleton-sheen: color-mix(in srgb, var(--claude-color-text) 7.5%, transparent);}
html[data-claude-chat-look='true'][data-hermes-mode='light'] [data-slot='skeleton']{background:color-mix(in srgb,var(--claude-color-text) 5%,transparent)!important;--claude-skeleton-sheen: color-mix(in srgb, var(--claude-color-text) 5%, transparent);}
html[data-claude-chat-look='true'] [data-slot='skeleton']:not([class*='rounded-lg']){border-radius:4px!important;}
html[data-claude-chat-look='true'] [data-slot='skeleton']::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--claude-skeleton-sheen),transparent);translate:-100% 0;animation:claude-skeleton-shimmer 2s linear infinite;pointer-events:none;}
@keyframes claude-skeleton-shimmer{from{translate:-100% 0;}
to{translate:100% 0;}}
html[data-claude-chat-look='true'] [data-tour='sessions-sidebar'] [data-slot='skeleton']{animation:claude-placeholder-reveal 0.15s ease-out 0.5s backwards!important;}
@keyframes claude-placeholder-reveal{from{opacity:0;}}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] [data-slot='skeleton']::after{display:none;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-radix-popper-content-wrapper]:not(:has(> [class*='z-(--z-'],> [class*='z-[calc('])){z-index:70!important;}
[data-claude-context-ring]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring]{display:inline-grid;place-items:center;flex:none;width:24px;height:24px;margin-left:2px;padding:0;border:0;border-radius:6px;background:transparent;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring]:hover{background:var(--claude-ghost-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar']{height:0!important;min-height:0!important;padding:0!important;border:0!important;overflow:visible!important;visibility:hidden;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-docked]{visibility:visible;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock]{visibility:visible;position:fixed!important;z-index:5;top:var(--claude-dock-top)!important;left:var(--claude-dock-left)!important;width:22px!important;height:22px!important;padding:0!important;justify-content:center!important;border-radius:6px!important;transform:translateY(-50%);background:transparent;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock] > :not(:first-child){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock]:not([class*='amber'],[class*='destructive']):has(> svg[class*='tabler-icon-activity']){color:var(--claude-color-success,var(--ui-text-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock]:is(:hover,[data-state='open']){background:var(--claude-account-hover)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='statusbar'] button[data-claude-backend-dock] > :first-child{width:14px!important;height:14px!important;}
html[data-claude-chat-look='true'] [data-claude-backend-state]{display:flex;align-items:center;gap:6px;font-weight:500;}
html[data-claude-chat-look='true'] [data-claude-backend-state] > span{display:inline-block;width:6px;height:6px;border-radius:9999px;background:currentColor;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-update-shown] [data-slot='sidebar-content']{margin-bottom:40px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-update-shown='2'] [data-slot='sidebar-content']{margin-bottom:68px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-update-shown='3'] [data-slot='sidebar-content']{margin-bottom:96px;}
[data-claude-update-dock]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock]:not([hidden]){position:fixed;z-index:5;display:flex;box-sizing:border-box;align-items:center;gap:4px;height:28px;padding:0 8px 0 6px;border:0;border-radius:6px;outline:none;transform:translateY(-50%);background:var(--claude-account-hover);color:var(--claude-color-text);font-size:13px;line-height:20px;font-weight:500;text-align:left;cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock]:is(:hover,:active){background:var(--claude-sidebar-active,var(--claude-account-hover));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock]:focus-visible{box-shadow:inset 0 0 0 1px var(--claude-color-sidebar),0 0 0 1px var(--ui-accent),0 0 6px 1px color-mix(in srgb,var(--ui-accent) 60%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock] > span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock] > svg{order:1;width:12px;height:12px;flex:0 0 12px;margin-inline-start:auto;color:var(--claude-color-text-tertiary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock]:hover > svg{color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock='skin']:not([hidden]){display:block;padding:0;background:none;cursor:default;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-update-dock][data-busy] > svg{animation:claude-update-dock-busy 900ms ease-in-out infinite;}
@keyframes claude-update-dock-busy{50%{transform:translateY(2px);opacity:.55;}}
[data-claude-context-pop]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-context-pop],[data-claude-usage-extra]) [data-claude-usage-row]{display:flex;justify-content:space-between;gap:16px;font-size:13px;line-height:1.6;color:var(--claude-color-text-secondary,var(--ui-text-secondary));}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-context-pop],[data-claude-usage-extra]) [data-claude-usage-row] > span:last-child{color:var(--claude-color-text,var(--ui-text-primary));font-variant-numeric:tabular-nums;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-usage-extra]{display:grid;gap:2px;margin:2px 14px 10px;padding-top:8px;border-top:1px solid var(--claude-color-border-subtle,var(--ui-stroke-quaternary));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop]{position:fixed;z-index:70;display:grid;gap:8px;box-sizing:border-box;width:360px;max-width:calc(100vw - 32px);padding:6px 0;border:1px solid color-mix(in srgb,var(--claude-color-text) 10%,transparent);border-radius:10px;background:var(--claude-k-202020);color:var(--claude-color-text);font-size:13px;line-height:19px;box-shadow:var(--claude-popover-shadow);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop-head]{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0;padding:0 12px;font-variant-numeric:tabular-nums;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop-head] > span:last-child:not(:first-child){overflow:hidden;font-size:12px;color:var(--claude-color-text-secondary);text-overflow:ellipsis;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop-bar]{height:4px;margin:0 12px;overflow:hidden;border-radius:999px;background:color-mix(in srgb,var(--claude-color-text) 5%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop-bar] > div{height:100%;background:#4A90E2;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop-bar][data-level='warning'] > div{background:#E0AF68;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop-bar][data-level='danger'] > div{background:var(--claude-k-ec7e7e,#EC7E7E);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-pop-extra]{display:grid;gap:2px;padding:8px 12px 0;border-top:1px solid color-mix(in srgb,var(--claude-color-text) 10%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-source]{position:fixed!important;z-index:0;width:24px!important;height:24px!important;padding:0!important;overflow:hidden;opacity:0;pointer-events:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] svg{width:14px;height:14px;transform:rotate(-90deg);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] circle{fill:none;stroke-width:2;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] [data-part='track']{stroke:color-mix(in srgb,var(--claude-color-text) 20%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring] [data-part='fill']{stroke:#4A90E2;stroke-linecap:round;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring][data-level='warning'] [data-part='fill']{stroke:#E0AF68;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-context-ring][data-level='danger'] [data-part='fill']{stroke:var(--claude-k-ec7e7e,#EC7E7E);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-tour='model-pill'] > svg,html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-effort] > svg{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-effort] > span{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-effort]::after{content:attr(data-claude-effort);font-size:13px;line-height:20px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-tour='model-pill'],html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-model-paired]{height:24px!important;border:1px solid transparent!important;background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-tour='model-pill']:has(+ [data-claude-model-paired]){padding:0 3px 0 8px!important;border-right:0!important;border-radius:6px 0 0 6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] button[data-testid='reasoning-pill'][data-claude-model-paired]{margin-left:calc(-1 * var(--composer-control-gap,4px))!important;padding:0 8px 0 3px!important;border-left:0!important;border-radius:0 6px 6px 0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] div[data-claude-has~="child-button-tour-model-pill-claude-model-paired"]:has(> button[data-tour='model-pill']:hover) > :is(button[data-tour='model-pill'],[data-claude-model-paired]),html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] div[data-claude-has~="child-button-tour-model-pill-claude-model-paired"]:has(> [data-claude-model-paired]:hover) > :is(button[data-tour='model-pill'],[data-claude-model-paired]),html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-root'] div[data-claude-has~="child-model-pair-expanded"] > :is(button[data-tour='model-pill'],[data-claude-model-paired]){border-color:transparent!important;background:var(--claude-ghost-hover)!important;}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]){min-width:180px!important;width:auto!important;padding:4px!important;border:1px solid color-mix(in srgb,var(--claude-color-text) 10%,transparent)!important;border-radius:10px!important;background:var(--claude-k-202020)!important;box-shadow:var(--claude-popover-shadow)!important;font-size:13px!important;}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu])[data-state='open']{animation:claude-menu-in 120ms cubic-bezier(.32,.72,0,1)!important;}
@keyframes claude-menu-in{from{opacity:0;scale:.98;}}
@media (prefers-reduced-motion:reduce){:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu])[data-state='open']{animation:none!important;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [data-slot='dropdown-menu-search'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [data-slot='dropdown-menu-search'] + [role='separator'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group'] > [data-slot='dropdown-menu-label'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='menuitem'] > button[data-slot='tooltip-trigger'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='menuitem'] > [data-slot='badge'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-slot='dropdown-menu-sub-trigger'] > .codicon-chevron-right{display:none!important;}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) [role^='menuitem']{min-height:24px;gap:6px;padding:2.5px 8px!important;border-radius:6px!important;font-size:13px!important;line-height:19px!important;color:var(--claude-color-text)!important;}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) [role^='menuitem'][data-kb-active]:not([data-highlighted],:hover,:focus){background:transparent!important;}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) [role^='menuitem']:is([data-highlighted],:hover,:focus){background:var(--claude-palette-selected,var(--claude-k-313130))!important;}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) .codicon-check{display:inline-grid!important;place-items:center;flex:none;width:16px;height:16px;margin-left:auto;margin-right:-4px;font-size:16px!important;color:var(--claude-menu-check,#2972CA)!important;-webkit-text-stroke:.4px currentColor;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-model-key]:not(:has(.codicon-check))::after{content:attr(data-claude-model-key);flex:none;box-sizing:border-box;min-width:16px;margin-left:auto;margin-right:-4px;padding-left:0;font-size:12px;text-align:center;color:var(--claude-color-text-tertiary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group'] > [data-slot='dropdown-menu-item']{min-height:24px;padding-top:6px!important;font-size:12px!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group'] > [data-slot='dropdown-menu-item'] > span{text-transform:none!important;letter-spacing:normal!important;font-size:12px!important;font-weight:500!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [role='menuitem'] > .codicon:first-child{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu]{position:relative;overflow:visible!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group']:not(:has(> [data-slot='dropdown-menu-label'])),html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [role='menuitem']:not([data-claude-effort-row],[data-claude-more-row]),html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] > [role='separator']:not([data-claude-effort-rule],[data-claude-more-rule-top]){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-row]{display:flex;align-items:center;gap:8px;cursor:default;outline:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-row] > .codicon{margin-left:auto;font-size:14px;color:var(--claude-color-text-tertiary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu][data-claude-more-open] [data-claude-more-row]{background:var(--claude-palette-selected,var(--claude-k-313130))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel]{display:none;position:absolute;left:calc(100% + 4px);min-width:180px;overflow:hidden;padding:4px;border:1px solid color-mix(in srgb,var(--claude-color-text) 10%,transparent);border-radius:10px;background:var(--claude-k-202020);box-shadow:var(--claude-popover-shadow);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu][data-claude-more-open] [data-claude-more-panel]{display:flex;flex-direction:column;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-list]{flex:1 1 auto;min-height:0;overflow-y:auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-list][data-more-below]{mask-image:linear-gradient(to bottom,#000 calc(100% - 20px),transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-foot]{flex:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-star]{display:inline-grid;place-items:center;flex:none;width:18px;height:18px;margin:0 2px 0 -4px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--claude-color-text-tertiary);cursor:pointer;opacity:.55;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-star] .codicon{font-size:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-item]:hover [data-claude-star],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-star]:focus-visible{opacity:1;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-star][aria-pressed='true']{color:#E0AF68;opacity:1;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [role='group'] > [data-slot='dropdown-menu-sub-trigger']:hover > button[data-slot='tooltip-trigger']{display:inline-grid!important;order:9;margin-left:6px;color:#E0AF68;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-item]{display:flex;align-items:center;gap:8px;white-space:nowrap;cursor:default;outline:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]{display:flex;align-items:center;gap:6px;min-height:26px;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;color:var(--claude-color-text-tertiary);cursor:pointer;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]:hover{background:var(--claude-palette-selected,var(--claude-k-313130));color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label] > .codicon{margin-left:auto;font-size:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]:not(:first-child){position:relative;margin-top:9px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]:not(:first-child)::before{content:'';position:absolute;top:-5px;left:0;right:0;height:1px;background:var(--claude-k-333332);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-label]:not([data-collapsed]){color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-more-panel] [data-claude-more-rule]{height:1px;margin:4px 0;background:var(--claude-k-333332)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu][data-claude-effort-open] [data-slot='dropdown-menu-sub-trigger'][aria-expanded='true']{background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu][data-claude-effort-open] [data-claude-effort-row]{background:var(--claude-palette-selected,var(--claude-k-313130))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-effort-row]{display:flex;align-items:center;gap:8px;cursor:default;outline:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-effort-row] > [data-claude-effort-value]{margin-left:auto;color:var(--claude-color-text-tertiary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu] [data-claude-effort-row] > .codicon{font-size:14px;color:var(--claude-color-text-tertiary);}
:is(html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-model-menu],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-effort-menu]) [data-slot='dropdown-menu-label']{font-size:12px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:none!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='composer-surface'] button[aria-label='Start voice conversation']{background:transparent!important;color:var(--claude-color-text-secondary)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] > [data-tree-group] > [data-panel-header],html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [data-zone-tabstrip]{height:32px!important;min-height:32px!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [data-zone-tabstrip]{padding:4px 0 4px 4px!important;gap:4px!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [data-zone-tabstrip] > [role='tablist']{gap:4px!important;min-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab){--tab-bg: transparent;--tab-face: transparent;flex:1 1 0%!important;min-width:48px!important;max-width:max-content!important;height:24px!important;min-height:24px!important;padding:0 4px 0 0!important;border:0!important;border-radius:6px!important;background:transparent!important;color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab)[aria-selected='true']{--tab-bg: var(--claude-file-tab);--tab-face: var(--claude-file-tab);background:var(--claude-file-tab)!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab):not([aria-selected='true']):hover{background:color-mix(in srgb,var(--claude-file-tab) 55%,transparent)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > .pane-tab-content{flex:1 1 auto!important;min-width:0!important;padding-inline-end:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > .pane-tab-content > span:first-child{margin:0 0 0 8px!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > .pane-tab-content > span:last-child{padding:0 4px 0 7px!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) span.truncate{font-size:13px!important;font-weight:400!important;letter-spacing:normal!important;text-overflow:clip!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:'][data-claude-preview-tab] span.truncate{font-style:italic;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > span:last-child:has(> button[aria-label='Close']){position:static!important;inset:auto!important;flex:none!important;align-items:center!important;opacity:1!important;pointer-events:auto!important;z-index:1;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > span:last-child > button[aria-label='Close']{width:16px!important;height:16px!important;border-radius:4px!important;background:transparent!important;color:var(--claude-color-text-tertiary,currentColor)!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > span:last-child > button[aria-label='Close']:hover{background:color-mix(in srgb,var(--claude-color-text,currentColor) 12%,transparent)!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab) > span:last-child > button[aria-label='Close'] .codicon{font-size:12px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] :where([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]),[data-claude-tree-results] [title],[data-claude-tab-list] > [title],[data-claude-changes] [title],[data-claude-changes-search] [title],[role='tab'][data-tree-tab^='preview-tile:file:']){--claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%2355555E' d='M4.5 1.5h4.8l3.7 3.7v8.3a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-10.5A1.5 1.5 0 0 1 4.5 1.5z'/%3E%3Cpath fill='%238A8A93' d='M9.3 1.5v2.9c0 .4.3.8.8.8H13z'/%3E%3C/svg%3E");}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]),[data-claude-tree-results] [title],[data-claude-tab-list] > [title],[data-claude-changes] [title],[data-claude-changes-search] [title]):is([title$='.md' i],[title$='.mdx' i],[title$='.markdown' i]),html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:']:is([data-tree-tab$='.md' i],[data-tree-tab$='.mdx' i],[data-tree-tab$='.markdown' i]){--claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23366244' d='M4.5 1.5h4.8l3.7 3.7v8.3a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-10.5A1.5 1.5 0 0 1 4.5 1.5z'/%3E%3Cpath fill='%2357C46F' d='M9.3 1.5v2.9c0 .4.3.8.8.8H13z'/%3E%3Cpath stroke='%234FA865' stroke-width='1.2' stroke-linecap='round' d='M5.6 9.4h4.6M5.6 11.6h3'/%3E%3C/svg%3E");}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]),[data-claude-tree-results] [title],[data-claude-tab-list] > [title],[data-claude-changes] [title],[data-claude-changes-search] [title]):is([title$='.json' i],[title$='.jsonc' i],[title$='.json5' i]),html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:']:is([data-tree-tab$='.json' i],[data-tree-tab$='.jsonc' i],[data-tree-tab$='.json5' i]){--claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23E29253' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5.6 2.5c-1.1 0-1.6.5-1.6 1.6v1.8c0 .9-.5 1.7-1.4 2.1.9.4 1.4 1.2 1.4 2.1v1.8c0 1.1.5 1.6 1.6 1.6M10.4 2.5c1.1 0 1.6.5 1.6 1.6v1.8c0 .9.5 1.7 1.4 2.1-.9.4-1.4 1.2-1.4 2.1v1.8c0 1.1-.5 1.6-1.6 1.6'/%3E%3C/svg%3E");}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]),[data-claude-tree-results] [title],[data-claude-tab-list] > [title],[data-claude-changes] [title],[data-claude-changes-search] [title]):is([title$='.gitignore'],[title$='.gitattributes'],[title$='.gitmodules'],[title$='.gitkeep']),html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:']:is([data-tree-tab$='.gitignore'],[data-tree-tab$='.gitattributes'],[data-tree-tab$='.gitmodules'],[data-tree-tab$='.gitkeep']){--claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23D5512F' d='M7.1 1.4a1.3 1.3 0 0 1 1.8 0l5.7 5.7a1.3 1.3 0 0 1 0 1.8l-5.7 5.7a1.3 1.3 0 0 1-1.8 0L1.4 8.9a1.3 1.3 0 0 1 0-1.8z'/%3E%3Cpath fill='none' stroke='%231A1B26' stroke-width='1.1' stroke-linecap='round' d='M5.6 3.9 8.1 6.4v4.4M8.1 6.4l2.3 2.3'/%3E%3Ccircle cx='8.1' cy='6.4' r='.9' fill='%231A1B26'/%3E%3Ccircle cx='8.1' cy='10.8' r='.9' fill='%231A1B26'/%3E%3Ccircle cx='10.4' cy='8.7' r='.9' fill='%231A1B26'/%3E%3C/svg%3E");}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]) > span:first-child .codicon::before,html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:'] .tab-key-hint-icon .codicon::before,html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result-icon]::before{content:''!important;display:block;width:12px;height:12px;background:var(--claude-file-icon) center / contain no-repeat;}
html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:'] .tab-key-hint-icon .codicon{opacity:1!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-expanded] > span:first-child{color:var(--claude-color-text-tertiary,currentColor)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-expanded] > span:first-child .codicon{display:inline-block;transition:transform 60ms cubic-bezier(.165,.84,.44,1);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-expanded] > span:first-child .codicon::before{content:'\\eab6'!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-expanded='true'] > span:first-child .codicon{transform:rotate(90deg);}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-expanded] > span:first-child .codicon{transition:none;}}
${CLAUDE_TREE_DEPTH_CSS} html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div{padding-left:calc(7px + var(--claude-tree-depth,23) * 10px)!important;padding-right:7px!important;border-radius:6px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div:not(.italic){color:var(--claude-color-text,currentColor)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div > span:first-child{width:12px;flex:0 0 12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div:hover{background-color:var(--claude-fill-ghost-hover)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree] [role='treeitem'] > div[aria-selected='true']{background-color:var(--claude-fill-control)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-project-tree]:is(:hover,:focus-within) [role='treeitem'] > div{background-image:repeating-linear-gradient(to right,var(--claude-line) 0 1px,transparent 1px 10px);background-origin:border-box;background-position:14px 0;background-repeat:no-repeat;background-size:calc(var(--claude-tree-depth,23) * 10px) 100%;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name]{height:32px!important;padding:0 8px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > :is([data-claude-mode='rendered'],[data-claude-mode='source']):not([class~='underline']){width:24px;height:24px;transition:background-color 60ms cubic-bezier(.165,.84,.44,1);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > :is([data-claude-mode='rendered'],[data-claude-mode='source']):not([class~='underline']):hover{background:var(--claude-fill-ghost-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] > div:has(> button){gap:4px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name][data-claude-has~="child-claude-mode"] [data-claude-edit='open'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] [data-claude-edit='cancel'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] [data-claude-edit='save']:disabled{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] :is([data-claude-edit='open'],[data-claude-edit-done]){display:grid!important;place-items:center;width:24px;height:24px;padding:0!important;border-radius:6px;font-size:0!important;color:var(--claude-color-text-secondary)!important;transition:background-color 60ms cubic-bezier(.165,.84,.44,1);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] :is([data-claude-edit='open'],[data-claude-edit-done]):hover{background:var(--claude-fill-ghost-hover);color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] :is([data-claude-edit='open'],[data-claude-edit-done]) svg{width:16px!important;height:16px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] [data-claude-edit='save']{height:22px;padding:0 9px!important;border-radius:6px!important;background:var(--claude-file-tab)!important;color:var(--claude-color-text)!important;font-size:12px!important;font-weight:500!important;box-shadow:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-file-name] [data-claude-edit='save'] svg{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown{padding:20px 22px 32px!important;font-size:15px!important;line-height:24px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown :is(p,li){font-size:15px!important;line-height:24px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown h1{margin:0 0 12px!important;font-size:24px!important;line-height:30px!important;font-weight:700!important;letter-spacing:normal!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown h2{margin:28px 0 8px!important;font-size:20px!important;line-height:28px!important;font-weight:600!important;letter-spacing:normal!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown h3{margin:24px 0 6px!important;font-size:17px!important;line-height:24px!important;font-weight:600!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] .preview-markdown :not(pre) > code{padding:1px 6px!important;border:1px solid var(--claude-filter-border)!important;border-radius:5px!important;background:var(--claude-filter-background)!important;color:var(--claude-color-text)!important;font-size:13px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter]{display:flex;flex:none;align-items:center;gap:7px;box-sizing:border-box;height:24px;margin:4px 8px 8px;padding:0 8px;border:1px solid var(--claude-filter-border);border-radius:6px;background:var(--claude-filter-background);color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter]:focus-within{border-color:color-mix(in srgb,var(--claude-color-text,currentColor) 28%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter] > svg{flex:none;width:14px;height:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter] > input{flex:1 1 auto;min-width:0;height:100%;padding:0;border:0;outline:0;background:transparent;color:var(--claude-color-text);font:inherit;font-size:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-filter] > input::placeholder{color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-files-view='empty'] [data-claude-tree-filter],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-filtering] [data-tree-group='grp-files'] [data-project-tree]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-filtering]:not([data-claude-files-view='empty']) [data-claude-tree-results]{display:block;flex:1 1 0%;min-height:0;overflow:auto;padding-bottom:8px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result]{display:flex;align-items:center;gap:7px;height:22px;padding:0 12px;border-radius:6px;font-size:14px;white-space:nowrap;color:var(--claude-color-text);cursor:default;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result]:hover{background:var(--claude-fill-ghost-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result][aria-selected='true']{background:var(--claude-fill-control);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result-icon]{flex:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result-name]{flex:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-result-dir]{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tree-results] [data-claude-results-note]{padding:6px 12px;font-size:13px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu]{position:fixed;z-index:2147483000;box-sizing:border-box;min-width:220px;padding:4px;border:1px solid var(--claude-menu-border);border-radius:10px;background:var(--claude-menu-background);box-shadow:0 8px 24px var(--claude-menu-shadow,rgb(0 0 0 / 25%));color:var(--claude-color-text);font-size:14px;line-height:20px;-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu='sub']{min-width:126px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] > [data-claude-menu-row]{display:flex;align-items:center;gap:12px;height:24px;padding:0 7px;border-radius:6px;white-space:nowrap;cursor:default;outline:none;}
html[data-claude-chat-look='true'] [data-claude-files-menu] > [data-claude-menu-row][aria-disabled='true']{opacity:.45;cursor:default;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] > [data-claude-menu-row]:is(:hover,:focus-visible,[data-claude-menu-open]){background:var(--claude-menu-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] [data-claude-menu-tail]{display:flex;align-items:center;gap:10px;margin-left:auto;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] [data-claude-menu-tail] > svg{width:14px;height:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] [data-claude-menu-check]{color:var(--claude-menu-check);stroke-width:1.6;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu] > [role='separator']{height:1px;margin:4px 7px;background:var(--claude-menu-border);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-action='more'][aria-expanded='true']{background:var(--claude-menu-hover,var(--ui-row-hover-background))!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-tree-split] > [data-claude-side-column]{order:1;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-tree-split] > [data-claude-sash='tree']{order:2;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-tree-split] > [data-claude-preview-column]{order:3;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-joined){margin-left:0!important;margin-right:var(--claude-card-gap,4px)!important;border-left-width:0!important;border-right-width:1px!important;border-top-left-radius:0!important;border-bottom-left-radius:0!important;border-top-right-radius:var(--claude-card-radius,10px)!important;border-bottom-right-radius:var(--claude-card-radius,10px)!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-pane-host^='preview-tile:']{border-bottom-left-radius:0!important;border-bottom-right-radius:calc(var(--claude-card-radius,10px) - 1px)!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined){margin-left:var(--claude-card-gap,4px)!important;margin-right:0!important;border-left-color:var(--claude-card-border)!important;border-right:1px solid var(--claude-file-divider,var(--claude-card-border))!important;border-top-left-radius:var(--claude-card-radius,10px)!important;border-bottom-left-radius:var(--claude-card-radius,10px)!important;border-top-right-radius:0!important;border-bottom-right-radius:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='split'] [data-tree-group='grp-files'] div:has(> [data-project-tree]){grid-template-columns:var(--claude-files-tree-wide,240px) minmax(0,1fr);}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='split'] [data-tree-group='grp-files'] :is([data-claude-tree-filter],[data-project-tree],[data-claude-tree-results]){grid-column:1;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='split'] [data-claude-files-empty]{grid-column:2;border-right:0;border-left:1px solid var(--claude-file-divider,var(--claude-card-border));}
html[data-claude-chat-look='true'][data-hermes-theme] .cm-line.cm-claude-indent{background-image:repeating-linear-gradient(to right,color-mix(in srgb,var(--claude-color-text,currentColor) 16%,transparent) 0 1px,transparent 1px calc(var(--claude-tab-size,4) * var(--claude-space-width,0.3em)));background-size:calc(var(--claude-indent-levels,0) * var(--claude-tab-size,4) * var(--claude-space-width,0.3em)) 100%;background-repeat:no-repeat;background-origin:content-box;}
html[data-claude-chat-look='true'][data-hermes-theme] .cm-claude-space{background:radial-gradient(circle,color-mix(in srgb,var(--claude-color-text,currentColor) 35%,transparent) 0 1px,transparent 1.4px) 0 55% / var(--claude-space-width,0.3em) 100% repeat-x;}
html[data-claude-chat-look='true'][data-hermes-theme] .cm-claude-tab{position:relative;}
html[data-claude-chat-look='true'][data-hermes-theme] .cm-claude-tab::before{content:'\\2192';position:absolute;left:0;color:color-mix(in srgb,var(--claude-color-text,currentColor) 35%,transparent);font-size:0.85em;pointer-events:none;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-scroll-past-end] [data-claude-preview-column] .cm-content{padding-bottom:max(0px,calc(var(--claude-editor-height,50vh) - 2em))!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-autosave] [data-claude-file-name] [data-claude-edit='save']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-header] > button:has(.codicon-eye-closed,.codicon-eye){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:']:not(#claude-file-tab){min-width:min(96px,100%)!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:'][data-claude-tab-tight]:not(#claude-file-tab){position:relative!important;padding:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:'][data-claude-tab-tight]:not(#claude-file-tab) > span:last-child:has(> button[aria-label='Close']){position:absolute!important;inset:0!important;display:grid!important;place-items:center;opacity:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:'][data-claude-tab-tight]:not(#claude-file-tab):is(:hover,:focus-within) > span:last-child:has(> button[aria-label='Close']){opacity:1!important;}
html[data-claude-chat-look='true'][data-hermes-theme]:is([data-claude-file-joined],[data-claude-file-over]) [data-claude-preview-column] [role='tab'][data-tree-tab^='preview-tile:file:'][data-claude-tab-tight]:not(#claude-file-tab):is(:hover,:focus-within) > .pane-tab-content{visibility:hidden;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-preview-column] [role='tab'][data-claude-tab-overflow]:not(#claude-file-tab){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-more]{display:grid;flex:none;place-items:center;width:32px;height:24px;margin-left:4px;border-radius:6px;background:var(--claude-file-tab);color:var(--claude-color-text);-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-more] > svg{width:15px;height:15px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list]{position:fixed;z-index:2147483000;box-sizing:border-box;min-width:220px;padding:4px;border:1px solid var(--claude-menu-border);border-radius:10px;background:var(--claude-menu-background);box-shadow:0 8px 24px var(--claude-menu-shadow,rgb(0 0 0 / 25%));color:var(--claude-color-text);font-size:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title]{display:flex;align-items:center;gap:8px;height:28px;padding:0 6px 0 10px;border-radius:6px;white-space:nowrap;cursor:default;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title]:hover{background:var(--claude-menu-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] > span:nth-child(2){flex:1 1 auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] > button{display:grid;place-items:center;width:18px;height:18px;border-radius:4px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] > button:hover{background:color-mix(in srgb,var(--claude-color-text,currentColor) 12%,transparent);color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] > [title] > button > svg{width:12px;height:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-list] [data-claude-result-icon]::before{content:'';display:block;width:12px;height:12px;background:var(--claude-file-icon) center / contain no-repeat;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined):not(#claude-divider){border-left-width:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host])::after{content:'';position:absolute;top:32px;bottom:0;left:0;width:1px;background:var(--claude-file-divider,var(--claude-card-border));pointer-events:none;z-index:3;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host]):not(#claude-file-joined):not(#claude-divider){border-right-width:0!important;border-left-width:1px!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-side-column] [data-tree-group='grp-files']:not([data-pane-host])::after{left:auto;right:0;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left] [data-claude-files-header] > [data-claude-terminal-header='files-actions']{display:contents;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left] [data-claude-files-header] [data-claude-terminal-action='tree']{order:-1;margin-right:4px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left] [data-claude-files-header='true']{padding-left:6px!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-files-header] > :not([data-claude-terminal-header='files-actions']),html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-files-header] [data-claude-terminal-action]:not([data-claude-terminal-action='tree']){visibility:hidden!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-preview-column] > [data-tree-group]:not([data-pane-host]):not(#claude-file-joined):not(#claude-tree-span){overflow:visible!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-preview-column] [data-zone-tabstrip]{position:relative!important;z-index:4;margin-left:calc(36px - var(--claude-tree-span,36px))!important;border-top-left-radius:0!important;background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-preview-column] [data-panel-header]{background:transparent!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-file-actions]{display:flex!important;flex-shrink:0;align-items:center;gap:2px;margin-left:auto;padding-right:8px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-file-joined][data-claude-files-view='both'] [data-claude-file-actions] [data-claude-terminal-action='tree']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='file'] [data-claude-file-actions]{display:contents!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='file'] [data-claude-file-actions] > [data-claude-terminal-action='tree']{order:-1;margin:0 0 0 2px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='file'] [data-claude-file-actions] > [data-claude-terminal-action='search']{margin-left:auto;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-tree-left][data-claude-files-view='file'] [data-claude-file-actions] > :last-child{margin-right:8px;}
html[data-claude-chat-look='true']{--claude-diff-background: var(--ui-editor-surface-background, Canvas);--claude-diff-added: #1A7F37;--claude-diff-removed: #CF222E;--claude-diff-added-line: color-mix(in lab, var(--claude-diff-background) var(--claude-diff-line-mix, 80%), var(--claude-diff-added));--claude-diff-removed-line: color-mix(in lab, var(--claude-diff-background) var(--claude-diff-line-mix, 80%), var(--claude-diff-removed));--claude-diff-added-word: color-mix(in srgb, var(--claude-diff-added) 15%, transparent);--claude-diff-removed-word: color-mix(in srgb, var(--claude-diff-removed) 15%, transparent);}
html[data-claude-chat-look='true'][data-hermes-mode='light']{--claude-diff-line-mix: 88%;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']{--claude-diff-background: #262731;--claude-diff-added: #32CF49;--claude-diff-removed: #E52C52;--claude-diff-added-word: color-mix(in srgb, var(--claude-diff-added) 20%, transparent);--claude-diff-removed-word: color-mix(in srgb, var(--claude-diff-removed) 20%, transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-host] > :not([data-claude-changes]){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-hermes] > :not([data-claude-changes]){flex:1 1 auto;height:auto;min-height:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes][data-claude-changes-view='hermes']{flex:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes][data-claude-changes-view='hermes'] :is([data-claude-changes-body],[data-claude-changes-scope],[data-claude-changes-title],[data-claude-changes-action='search'],[data-claude-changes-action='list'],[data-claude-changes-action='expand']){display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] [hidden]{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes-host],[data-claude-changes-hermes]){display:flex!important;flex-direction:column!important;height:100%!important;min-height:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;background:var(--claude-card-background);color:var(--claude-color-text);font-size:13px;line-height:19px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-header]{display:flex;flex:none;align-items:center;gap:4px;height:32px;padding:0 8px 0 6px;-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-header] > [data-claude-changes-action='list']{margin-inline-start:-4px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope]{display:grid;grid-auto-flow:column;align-items:center;gap:6px;min-width:0;height:24px;padding:0 6px 0 8px;border-radius:6px;color:var(--claude-color-text-secondary);font-size:13px;line-height:19px;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope] > span{min-width:0;overflow:hidden;text-overflow:ellipsis;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope]:is(:hover,[aria-expanded='true']){background:var(--claude-menu-hover,var(--ui-row-hover-background));color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope] > svg{width:12px;height:12px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-arrow]{color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-scope] > svg:last-child{opacity:.6;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-title]{min-width:0;padding:0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-tools]{display:flex;align-items:center;gap:2px;margin-left:auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] button[data-claude-changes-action]{display:grid;flex:none;place-items:center;width:24px;height:24px;border-radius:6px;color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] button[data-claude-changes-action]:is(:hover,[aria-expanded='true']){background:var(--claude-menu-hover,var(--ui-row-hover-background));color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] button[data-claude-changes-action][aria-pressed='true']{background:var(--claude-pane-active,var(--claude-menu-hover));color:var(--claude-pane-active-glyph,var(--claude-color-text));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] button[data-claude-changes-action] > svg{width:16px;height:16px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]:not([data-claude-changes-has-files]) [data-claude-changes-action='search']{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-body]{display:flex;flex:1 1 auto;min-height:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-diffs]{flex:1 1 auto;min-width:0;overflow:auto;background:var(--claude-diff-background);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-list]{order:2;flex:0 0 var(--claude-changes-list-width,240px);box-sizing:border-box;min-width:0;overflow:auto;padding:5px 4px;border-left:1px solid var(--claude-file-divider,var(--claude-card-border));outline:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes][data-claude-changes-position='left'] [data-claude-changes-list]{order:-2;border-left:0;border-right:1px solid var(--claude-file-divider,var(--claude-card-border));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-resize]{position:relative;z-index:2;order:1;flex:0 0 4px;margin:0 -2px;cursor:col-resize;touch-action:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes][data-claude-changes-position='left'] [data-claude-changes-resize]{order:-1;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]:is([data-claude-changes-files='hidden'],:not([data-claude-changes-has-files])) :is([data-claude-changes-list],[data-claude-changes-resize]){display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-empty]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]:not([data-claude-changes-has-files]) [data-claude-changes-diffs]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes]:not([data-claude-changes-has-files]) [data-claude-changes-empty]{display:flex;flex:1 1 auto;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px;text-align:center;font-size:13px;line-height:19px;color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-empty] > p{max-width:36ch;margin:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-empty] > p + p{margin-top:-8px;font-size:12px;line-height:15px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-empty] > svg{width:28px;height:28px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-retry]{height:24px;padding:0 8px;border:1px solid var(--claude-color-border,var(--claude-card-border));border-radius:6px;color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-retry]:hover{background:var(--claude-menu-hover,var(--ui-row-hover-background));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-spinner]{width:24px;height:24px;box-sizing:border-box;border:2px solid var(--claude-color-text-tertiary,currentColor);border-right-color:transparent;border-radius:50%;animation:claude-working-turn 800ms linear infinite;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-banner]{padding:5px 8px;font-size:13px;line-height:19px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-file]{container-type:inline-size;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-head]{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:4px;height:32px;padding:0 8px;background:color-mix(in srgb,var(--claude-color-text) 9.75%,var(--claude-diff-background));white-space:nowrap;cursor:default;outline:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-head]:hover{background:color-mix(in srgb,var(--claude-color-text) 14.5%,var(--claude-diff-background));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-head]:focus-visible{box-shadow:inset 0 0 0 1px var(--claude-color-accent,var(--theme-primary,currentColor));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-chevron]{display:grid;flex:none;place-items:center;width:16px;height:16px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-chevron] > svg{width:16px;height:16px;transition:transform 60ms;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-file][aria-expanded='false'] [data-claude-diff-chevron] > svg{transform:rotate(-90deg);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-label]{display:flex;align-items:baseline;gap:4px;min-width:0;overflow:hidden;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-head],[data-claude-changes-row]) [data-claude-diff-name]{flex:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-head] [data-claude-diff-name]{color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-head],[data-claude-changes-row]) [data-claude-diff-dir]{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;line-height:15px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-dir][data-clipped]{opacity:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search] b[data-lit]{font-weight:600;color:var(--claude-color-text);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-chips]{display:flex;flex-shrink:9999;gap:4px;min-width:0;overflow:hidden;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-chip]{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-counts]{display:flex;flex:none;align-items:center;gap:2px;font-variant-numeric:tabular-nums;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-added]{color:var(--claude-diff-added);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-removed]{color:var(--claude-diff-removed);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-actions]{display:flex;flex:none;align-items:center;gap:4px;margin-left:auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-actions] > button[data-claude-changes-action]{width:22px!important;height:22px!important;}
@container (max-width:240px){html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-actions] > [data-claude-changes-action='open']{display:none;}}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-file][aria-expanded='false'] > [data-claude-diff-body]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-body]{padding:0 0 8px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-note]{display:flex;align-items:center;gap:10px;padding:6px 12px 10px 28px;font-size:13px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-link]{color:var(--claude-color-text-secondary);text-decoration:underline;text-underline-offset:3px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-table]{margin:0;overflow-x:auto;font-family:ui-monospace,'Cascadia Mono',Consolas,monospace;font-size:12px;line-height:17px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-table='unified'] > [data-claude-diff-row]:not([data-claude-diff-row='hunk']){display:grid;grid-template-columns:calc(max(3ch,var(--claude-ln-width,3ch)) + 3ch) calc(2ch + 2px) minmax(0,1fr);min-width:max-content;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-table] [data-claude-diff-num]{padding:0 1ch 0 2ch;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-table='unified'] [data-claude-diff-sign]{padding-left:2px;}
html[data-claude-chat-look='true'][data-hermes-theme][data-hermes-mode] [data-claude-changes][data-claude-changes-wrap='on'] [data-claude-diff-table] > [data-claude-diff-row]{min-width:0;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-table='split'] > [data-claude-diff-row]:not([data-claude-diff-row='hunk']){display:grid;grid-template-columns:repeat(2,calc(max(3ch,var(--claude-ln-width,3ch)) + 3ch) minmax(0,1fr));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-num]{padding-right:8px;text-align:right;color:color-mix(in lab,var(--claude-color-text) 65%,var(--claude-diff-background));user-select:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-sign]{color:var(--claude-color-text-tertiary,currentColor);user-select:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-code]{padding-right:12px;white-space:pre;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes][data-claude-changes-wrap='on'] [data-claude-diff-code]{white-space:pre-wrap;overflow-wrap:anywhere;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-row='add'],html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-side='add'],[data-claude-diff-num='add']){background:var(--claude-diff-added-line);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-row='del'],html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-side='del'],[data-claude-diff-num='del']){background:var(--claude-diff-removed-line);}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-row='add'] :is([data-claude-diff-sign],[data-claude-diff-num]),[data-claude-diff-num='add']){color:var(--claude-diff-added);}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-row='del'] :is([data-claude-diff-sign],[data-claude-diff-num]),[data-claude-diff-num='del']){color:var(--claude-diff-removed);}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-row='add'],[data-claude-diff-side='add']) mark{border-radius:3px;background:var(--claude-diff-added-word);color:inherit;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-diff-row='del'],[data-claude-diff-side='del']) mark{border-radius:3px;background:var(--claude-diff-removed-word);color:inherit;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-side='none']{background:color-mix(in srgb,var(--claude-color-text,currentColor) 3%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-diff-row='hunk']{height:8px;background:color-mix(in lab,var(--claude-diff-background) 85%,var(--claude-color-text));}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes-row],[data-claude-changes-folder],[data-claude-changes-section]){display:flex;align-items:center;gap:4px;box-sizing:border-box;width:100%;height:24px;margin:0;padding:0 8px;border-radius:6px;color:var(--claude-color-text);font-size:13px;line-height:19px;text-align:start;white-space:nowrap;cursor:default;outline:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-list] :is([data-claude-changes-row],[data-claude-changes-folder])[data-depth]{padding-inline-start:calc(8px + var(--claude-tree-depth) * 10px);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-list]:is(:hover,:focus-within) :is([data-claude-changes-row],[data-claude-changes-folder])[data-depth]{background-image:repeating-linear-gradient(to right,var(--claude-file-divider,var(--claude-card-border)) 0 1px,transparent 1px 10px);background-position:14px 0;background-size:calc(var(--claude-tree-depth) * 10px) 100%;background-repeat:no-repeat;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-row] > [data-claude-diff-label]{flex:1 1 auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-row] > [data-claude-diff-counts]{margin-left:auto;padding-left:4px;font-size:12px;line-height:15px;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes-row],[data-claude-changes-folder],[data-claude-changes-section]):hover{background-color:color-mix(in srgb,var(--claude-color-text) 7.5%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes-row][aria-current='true'],[data-claude-changes-search-list] > [data-claude-changes-row][aria-selected='true']){background-color:color-mix(in srgb,var(--claude-color-text) 10%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-list] [role='treeitem']:focus-visible{box-shadow:inset 0 0 0 1px var(--claude-color-accent,var(--theme-primary,currentColor));}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes-folder],[data-claude-changes-section]) > svg{flex:none;width:12px;height:12px;color:var(--claude-color-text-tertiary,currentColor);transition:transform 60ms;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes-folder],[data-claude-changes-section])[aria-expanded='true'] > svg{transform:rotate(90deg);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-folder] > [data-claude-diff-name]{min-width:0;overflow:hidden;text-overflow:ellipsis;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-group]{margin-top:4px;padding-top:4px;border-top:1px solid var(--claude-file-divider,var(--claude-card-border));}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-section-label]{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-section-count]{flex:none;font-size:12px;line-height:15px;font-variant-numeric:tabular-nums;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes] [data-claude-result-icon],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search] [data-claude-result-icon]{flex:none;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes],[data-claude-changes-search]) [data-claude-result-icon]::before{content:'';display:block;width:12px;height:12px;background:var(--claude-file-icon) center / contain no-repeat;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search]{position:fixed;z-index:2147483000;display:flex;flex-direction:column;box-sizing:border-box;max-width:calc(100vw - 16px);border:1px solid var(--claude-menu-border);border-radius:10px;background:var(--claude-menu-background);box-shadow:0 8px 24px var(--claude-menu-shadow,rgb(0 0 0 / 25%));color:var(--claude-color-text);font-size:13px;line-height:19px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-field]{padding:10px 12px;border-bottom:1px solid var(--claude-menu-border);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-field] > input,html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-search] > input{width:100%;border:0;outline:0;background:transparent;color:var(--claude-color-text);font:inherit;font-size:14px;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-claude-changes-search-field],[data-claude-branch-search]) > input::placeholder{color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-list]{max-height:336px;overflow:auto;padding:4px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-list] > [data-claude-changes-row]{height:28px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-more]{padding:6px 8px;font-size:13px;line-height:19px;color:var(--claude-color-text-tertiary,currentColor);user-select:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-changes-search-more]:empty{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-files-menu][data-claude-branch-menu]{min-width:300px;padding:0 4px 4px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-search]{margin:0 -4px 4px;padding:9px 14px;border-bottom:1px solid var(--claude-menu-border);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-list]{max-height:300px;overflow:auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-list] > [data-claude-menu-row]{display:flex;align-items:center;gap:12px;height:28px;padding:0 10px;border-radius:6px;white-space:nowrap;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-branch-list] > [data-claude-menu-row]:is(:hover,:focus-visible){outline:none;background:var(--claude-menu-hover);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-menu-empty]{padding:6px 10px;color:var(--claude-color-text-tertiary,currentColor);}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-tree-split] > div:not(:has([data-tree-group='grp-review'])):not(:has([data-tree-group='grp-sessions'])){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-tree-split] [data-tree-split] > div:not(:has([data-tree-group='grp-review'])){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-tree-split] > div:has([data-tree-group='grp-review']):not(:has([data-tree-group='grp-sessions'])),html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-tree-split] [data-tree-split] > div:has([data-tree-group='grp-review']){flex:1 1 0%!important;max-width:none!important;max-height:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='changes'] [data-claude-pane-tools]{visibility:hidden!important;}
html[data-claude-chat-look='true'][data-hermes-theme] :is([data-project-tree] [role='treeitem'] > div[title]:not([aria-expanded]),[data-claude-tree-results] [title],[data-claude-tab-list] > [title],[data-claude-changes] [title],[data-claude-changes-search] [title]):is([title$='.png' i],[title$='.jpg' i],[title$='.jpeg' i],[title$='.gif' i],[title$='.webp' i],[title$='.bmp' i],[title$='.ico' i],[title$='.svg' i],[title$='.avif' i]),html[data-claude-chat-look='true'][data-hermes-theme] [role='tab'][data-tree-tab^='preview-tile:file:']:is([data-tree-tab$='.png' i],[data-tree-tab$='.jpg' i],[data-tree-tab$='.jpeg' i],[data-tree-tab$='.gif' i],[data-tree-tab$='.webp' i],[data-tree-tab$='.bmp' i],[data-tree-tab$='.ico' i],[data-tree-tab$='.svg' i],[data-tree-tab$='.avif' i]){--claude-file-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='1.5' y='2.5' width='13' height='11' rx='2' fill='%23FF678D'/%3E%3Ccircle cx='5.4' cy='6' r='1.3' fill='%23262731'/%3E%3Cpath d='M2.5 12.2 6.4 8.6l2.2 2 2.1-1.7 2.8 3.3z' fill='%23262731'/%3E%3C/svg%3E");}
`
const CSS=`
html[data-claude-chat-look='true']{--sticky-human-top: 0px;--claude-color-chat: var(--ui-chat-surface-background);--claude-color-sidebar: var(--ui-sidebar-surface-background);--claude-color-card: var(--dt-card, var(--ui-editor-surface-background));--claude-color-elevated: var(--dt-popover, var(--ui-widget-surface-background));--claude-color-bubble: var(--ui-chat-bubble-background);--claude-color-status-panel: color-mix(
    in srgb,
    var(--ui-bg-tertiary, var(--claude-color-card)) 32.5%,
    var(--claude-color-chat)
  );--claude-color-text: var(--ui-text-primary);--claude-color-text-secondary: var(--ui-text-secondary);--claude-color-text-tertiary: var(--ui-text-tertiary);--claude-color-text-quaternary: var(--ui-text-quaternary);--claude-color-border: var(--ui-stroke-secondary);--claude-color-border-subtle: var(--ui-stroke-tertiary);--claude-color-hover: var(--ui-row-hover-background);--claude-color-active: var(--ui-row-active-background);--claude-sidebar-label: color-mix(in srgb, var(--claude-color-text) 90%, var(--claude-color-sidebar));--claude-sidebar-muted: color-mix(in srgb, var(--claude-color-text) 65%, var(--claude-color-sidebar));--claude-sidebar-hover: color-mix(in srgb, var(--claude-color-text) 4%, transparent);--claude-sidebar-active: color-mix(in srgb, var(--claude-color-text) 7%, transparent);--claude-color-primary: var(--dt-primary);--claude-color-primary-foreground: var(--dt-primary-foreground);--claude-color-success: var(--ui-green);--claude-color-destructive: var(--dt-destructive);--claude-shadow-floating: var(--shadow-md);--claude-ghost-hover: color-mix(in srgb, var(--claude-color-text) 7.5%, transparent);--claude-popover-shadow: 0 8px 24px color-mix(in srgb, black 32%, transparent), 0 2px 6px color-mix(in srgb, black 20%, transparent);}
html[data-claude-chat-look='true'][data-hermes-mode='light']{--claude-ghost-hover: color-mix(in srgb, var(--claude-color-text) 5%, transparent);--claude-popover-shadow: 0 8px 24px color-mix(in srgb, black 12%, transparent), 0 2px 6px color-mix(in srgb, black 8%, transparent);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']{--theme-stroke-primary-accent-mix: 0%;--theme-stroke-secondary-accent-mix: 0%;--theme-stroke-tertiary-accent-mix: 0%;--theme-stroke-quaternary-accent-mix: 0%;--theme-fill-primary-accent-mix: 0%;--theme-fill-secondary-accent-mix: 0%;--theme-fill-tertiary-accent-mix: 0%;--theme-fill-quaternary-accent-mix: 0%;--theme-fill-quinary-accent-mix: 0%;--theme-row-hover-accent-mix: 0%;--theme-row-active-accent-mix: 0%;--radius-scalar: 0.6;--claude-color-card: var(--theme-card-seed);--claude-color-elevated: var(--theme-elevated-seed);--claude-color-bubble: var(--theme-bubble-seed);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']{--claude-color-text: var(--theme-foreground);--claude-color-active: var(--theme-accent-soft);--claude-color-border: var(--dt-border);--claude-color-border-subtle: var(--dt-composer-ring);--ui-row-active-background: var(--theme-accent-soft);--ui-widget-surface-background: var(--theme-elevated-seed);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']:not([data-hermes-glass]){--claude-color-chat: var(--theme-background-seed);--ui-chat-surface-background: var(--claude-color-chat);--claude-color-sidebar: var(--theme-sidebar-seed);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark']:not([data-hermes-glass]){--ui-sidebar-surface-background: var(--theme-sidebar-seed);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-glass]{--claude-color-chat: var(--ui-chat-surface-background);--claude-color-sidebar: var(--ui-sidebar-surface-background);}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']:not([data-hermes-glass]),html[data-claude-chat-look='true'][data-hermes-theme='claude-chat']:not([data-hermes-glass]) body{background-color:var(--claude-color-chat)!important;}
html[data-claude-chat-look='true'][data-claude-composer-width='claude']{--composer-width: 768px;}
html[data-claude-chat-look='true'][data-claude-composer-width='claude-wide']{--composer-width: 921.6px;}
html[data-claude-chat-look='true'][data-claude-composer-width='claude-wider']{--composer-width: 1075.2px;}
html[data-claude-chat-look='true']:not([data-claude-composer-width='hermes']) [data-slot='aui_thread-content']{max-width:calc(var(--composer-width) + 64px)!important;padding-inline:32px!important;}
html[data-claude-chat-look='true'] body,html[data-claude-chat-look='true'] button,html[data-claude-chat-look='true'] input,html[data-claude-chat-look='true'] textarea,html[data-claude-chat-look='true'] [contenteditable='true']{font-family:var(--font-sans,${SYSTEM_FONT})!important;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'],html[data-claude-chat-look='true'] [data-slot='aui_thread-content']{background:var(--claude-color-chat)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root']{background:transparent!important;}
html[data-claude-chat-look='true'][data-claude-pinned-user-messages='off'] [data-slot='aui_user-message-root']{position:static!important;top:auto!important;z-index:auto!important;}
html[data-claude-chat-look='true'] [data-slot='aui_thread-content'] > [data-claude-live-tail='true']{content-visibility:visible!important;contain-intrinsic-size:none!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-root'],html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content']{background:transparent!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-claude-clean-transcript='on'] [data-slot='aui_turn-pair'][data-claude-clean-settled='true'] [data-claude-clean-interim='true'],html[data-claude-chat-look='true'][data-claude-clean-transcript='on'] [data-slot='aui_turn-pair'][data-claude-clean-settled='true'] [data-claude-clean-interim-part='true'],html[data-claude-chat-look='true'][data-claude-clean-transcript='on'] [data-slot='aui_turn-pair'][data-claude-clean-settled='true'] > [data-role='system']:not(:has([role='alert'])),html[data-claude-chat-look='true'][data-claude-clean-transcript='on'] [data-slot='aui_turn-pair'][data-claude-clean-settled='true'] [data-slot='tool-block']:not(:has([data-slot='aui_generated-image'],[data-slot='aui_artifact-card'])),html[data-claude-chat-look='true'][data-claude-clean-transcript='on'] [data-slot='aui_turn-pair'][data-claude-clean-settled='true'] [data-slot='aui_thinking-disclosure'],html[data-claude-chat-look='true'][data-claude-clean-transcript='on'] [data-slot='aui_turn-pair'][data-claude-clean-settled='true'] [data-slot='aui_changed-files']{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'],html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md,html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :where(p,li,blockquote,table),html[data-claude-chat-look='true'] [data-slot='aui_user-inline-text']{font-family:var(--font-sans,${SYSTEM_FONT})!important;font-weight:400!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md li::marker{color:var(--claude-color-text)!important;opacity:1!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md,html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :where(p,li,blockquote){line-height:1.4286!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md > div{display:flex!important;flex-direction:column;gap:13px;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md > div > *{min-width:0;margin-block:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :is(ul,ol){padding-left:20px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md li{margin-block:0!important;padding-left:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md li + li,html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md li > :is(ul,ol){margin-top:6px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :is(h1,h2,h3){font-weight:600!important;letter-spacing:-0.01em;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md h1{font-size:1.14286em!important;line-height:1.25!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md h2{font-size:1.07143em!important;line-height:1.33333!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md h3{font-size:1em!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md > div > h1{margin-block:12px -4px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md > div > h2{margin-block:10px -4px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md > div > h3{margin-block:7px -4px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md > div > :is(h1,h2,h3):first-child{margin-top:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :is(h4,h5,h6),html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :is(strong,b){font-weight:500!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md .aui-md-table{border:0!important;border-radius:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md .aui-md-table > table{border-collapse:separate!important;border-spacing:2px!important;font-size:inherit!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md .aui-md-table :is(thead,tr){border:0!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md .aui-md-table :is(th,td){padding:6px!important;border:0!important;border-radius:3px;vertical-align:top!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md .aui-md-table th{background:color-mix(in srgb,var(--claude-color-text) 10%,transparent);font-size:inherit!important;font-weight:500!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md .aui-md-table td{background:color-mix(in srgb,var(--claude-color-text) 5%,transparent);}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md .aui-md-table :not(pre) > code{background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md blockquote{display:flex!important;flex-direction:column;gap:10px;margin-inline:0!important;padding:0 0 0 8px!important;border:0!important;border-left:2px solid color-mix(in srgb,var(--claude-color-text) 10%,transparent)!important;font-style:normal!important;quotes:none;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md blockquote,html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md blockquote :is(p,li){color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md blockquote > *{margin-block:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md hr{height:0;border:0!important;border-top:0.5px solid color-mix(in srgb,var(--claude-color-text) 20%,transparent)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] [data-slot='code-card']{border-radius:8px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] [data-slot='code-card'] > button{top:5px!important;right:7px!important;opacity:1!important;}
html[data-claude-chat-look='true'] [data-slot='aui_assistant-message-content'] [data-slot='code-card'][data-streaming='true'] > button{opacity:0!important;pointer-events:none;}
html[data-claude-chat-look='true'] [data-slot='aui_msg-actions']{transition:opacity 60ms cubic-bezier(0.32,0.72,0,1);}
html[data-claude-chat-look='true'] :where(.group):hover [data-slot='aui_msg-actions'],html[data-claude-chat-look='true'] [data-slot='aui_msg-actions']:focus-within{transition:opacity 120ms cubic-bezier(0.32,0.72,0,1) 100ms;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] [data-slot='aui_msg-actions']{transition:none!important;}}
html[data-claude-chat-look='true'] [data-slot='aui_msg-actions'] .aui-message-actions-desktop{gap:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_msg-actions'] .aui-message-actions-desktop button:not([data-slot='aui_msg-reactions']){display:inline-grid!important;width:20px!important;height:20px!important;place-items:center;opacity:1!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_msg-actions'] .aui-message-actions-desktop button:not([data-slot='aui_msg-reactions']):is(:hover,:focus-visible):not(:disabled){color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_msg-actions'] .aui-message-actions-desktop button:not([data-slot='aui_msg-reactions']):disabled{opacity:0.5!important;}
html[data-claude-chat-look='true'] [data-slot='aui_msg-actions'] .aui-message-actions-desktop button:not([data-slot='aui_msg-reactions']) svg{width:12px!important;height:12px!important;}
html[data-claude-chat-look='true'] .thread-jump-button{bottom:calc(var(--composer-measured-height) + 12px)!important;height:24px!important;gap:6px!important;padding:0 4px!important;border:0!important;border-radius:6px!important;background:var(--claude-color-elevated)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--claude-color-text) 10%,transparent),0 1px 2px color-mix(in srgb,black 5%,transparent)!important;color:var(--claude-color-text-secondary)!important;animation:none!important;transform:translateX(-50%)!important;opacity:0;transition:opacity 150ms;}
html[data-claude-chat-look='true'] .thread-jump-button[data-state='in']{opacity:1;}
html[data-claude-chat-look='true'] .thread-jump-button:hover{color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] .thread-jump-button > .codicon{font-size:12px!important;}
html[data-claude-chat-look='true'] .thread-jump-button:not(.border-primary\\/40) > span{display:none!important;}
html[data-claude-chat-look='true'] .thread-jump-button.border-primary\\/40{padding:0 8px!important;}
html[data-claude-chat-look='true'] .thread-jump-button.border-primary\\/40::before{width:6px;height:6px;flex-shrink:0;border-radius:9999px;background:var(--claude-color-primary);content:'';}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] .thread-jump-button{transition:none;}}
@keyframes claude-think{0%,to{opacity:1;}
50%{opacity:0.75;}}
html[data-claude-chat-look='true'] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading'],[data-slot='aui_thinking-disclosure']) .shimmer{background:none!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;-webkit-text-fill-color:currentColor!important;will-change:opacity;animation-name:claude-think!important;animation-duration:2s!important;animation-timing-function:ease-in-out!important;animation-delay:3s!important;animation-iteration-count:infinite!important;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] :is([data-slot='aui_turn-activity'],[data-slot='aui_response-loading'],[data-slot='aui_thinking-disclosure']) .shimmer{animation-name:none!important;}}
html[data-claude-chat-look='true'] [data-slot='aui_thinking-disclosure'] span[data-claude-think-phrase]{font-size:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_thinking-disclosure'] span[data-claude-think-phrase]::after{content:attr(data-claude-think-phrase);font-size:var(--conversation-tool-font-size,12px);}
html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_thinking-disclosure'] span[data-claude-think-phrase]::after{font-size:11px;}
@supports (animation-timeline:scroll()){@keyframes claude-edge-in{from{opacity:0;}to{opacity:1;}}
@keyframes claude-edge-out{from{opacity:1;}to{opacity:0;}}
html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport']::after,html[data-claude-chat-look='true'][data-claude-pinned-user-messages='off'] [data-slot='aui_thread-viewport']::before{position:sticky;z-index:30;display:block;pointer-events:none;content:'';opacity:0;animation-timing-function:linear;animation-fill-mode:both;animation-timeline:scroll(nearest y);}
html[data-claude-chat-look='true'][data-claude-pinned-user-messages='off'] [data-slot='aui_thread-viewport']::before{top:0;height:32px;margin-bottom:-32px;background:linear-gradient(to bottom,var(--claude-color-chat) 0%,color-mix(in srgb,var(--claude-color-chat) 85%,transparent) 13%,color-mix(in srgb,var(--claude-color-chat) 50%,transparent) 40%,color-mix(in srgb,var(--claude-color-chat) 15%,transparent) 70%,transparent);animation-name:claude-edge-in;animation-range:0px 32px;}
html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport']::after{bottom:var(--composer-surface-measured-height,0px);height:48px;margin-top:-48px;background:linear-gradient(to top,var(--claude-color-chat) 0%,color-mix(in srgb,var(--claude-color-chat) 85%,transparent) 13%,color-mix(in srgb,var(--claude-color-chat) 50%,transparent) 40%,color-mix(in srgb,var(--claude-color-chat) 15%,transparent) 70%,transparent);animation-name:claude-edge-out;animation-range:calc(100% - 48px) 100%;}}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root']{align-items:flex-end!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-bubble-actions']{width:fit-content!important;min-width:0!important;max-width:85%!important;align-self:flex-end!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-bubble-actions'] div.relative > div.absolute.bottom-2{right:100%!important;bottom:6px!important;margin-right:4px;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message{width:100%!important;max-width:100%!important;border:0!important;border-radius:10px!important;background:var(--claude-color-bubble)!important;color:var(--claude-color-text)!important;padding:8px 12px!important;text-align:left!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message,html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] :is([data-slot='aui_user-message-text'],[data-slot='aui_user-inline-text']){font-size:14px!important;line-height:18px!important;}
@keyframes claude-user-enter{0%{opacity:0;transform:scale(0.92) translateY(6px);}
to{opacity:1;transform:none;}}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'][data-claude-enter] .composer-human-message{transform-origin:right;animation:claude-user-enter 450ms cubic-bezier(0.34,1.3,0.64,1) both;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'][data-claude-enter] .composer-human-message{animation:none;}}
html[data-claude-chat-look='true'] [data-slot='aui_turn-pair'] > [data-role='user'] + *:not([data-role]):has([data-slot='aui_embedded-images']){order:-1!important;width:100%!important;align-self:stretch!important;justify-content:flex-end!important;gap:8px!important;margin:0 0 calc(-1 * var(--conversation-turn-gap,12px) + 8px)!important;}
html[data-claude-chat-look='true'] [data-slot='aui_turn-pair'] > [data-role='user'] + *:not([data-role]) [data-slot='aui_embedded-images']{display:flex!important;flex-wrap:wrap!important;justify-content:flex-end!important;margin-top:0!important;gap:8px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_turn-pair'] > [data-role='user'] + *:not([data-role]) [data-slot='aui_embedded-images'] > [aria-hidden]{width:80px!important;height:80px!important;border-radius:10px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_turn-pair'] > [data-role='user'] + *:not([data-role])[data-claude-has~="slot-aui-directive-image-slot-aui-embedded-image"] :is([data-slot='aui_directive-image'],[data-slot='aui_embedded-image']){width:80px!important;height:80px!important;max-width:80px!important;max-height:80px!important;flex:0 0 80px!important;overflow:hidden!important;border:1px solid var(--claude-color-border-subtle)!important;border-radius:10px!important;padding:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_turn-pair'] > [data-role='user'] + *:not([data-role])[data-claude-has~="slot-aui-directive-image-slot-aui-embedded-image"] :is([data-slot='aui_directive-image'],[data-slot='aui_embedded-image']) img{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;display:block!important;box-sizing:border-box!important;padding:0!important;object-fit:cover!important;border:0!important;border-radius:inherit!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message [data-slot='aui_embedded-images']{justify-content:flex-end!important;gap:8px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_turn-pair'] > [data-role='user'] + *:not([data-role])[data-claude-has~="slot-aui-directive-image-slot-aui-embedded-image"] [data-slot='aui_embedded-images']{justify-content:flex-end!important;gap:8px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message [data-slot='aui_embedded-images'] :is([data-slot='aui_directive-image'],[data-slot='aui_embedded-image']){width:80px!important;height:80px!important;max-width:80px!important;max-height:80px!important;overflow:hidden!important;border:1px solid var(--claude-color-border-subtle)!important;border-radius:10px!important;padding:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message [data-slot='aui_embedded-images'] :is([data-slot='aui_directive-image'],[data-slot='aui_embedded-image']) img{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:cover!important;border-radius:inherit!important;}
html[data-claude-chat-look='true'] [data-slot='composer-attachments']{gap:12px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-span-first-child-is-img-svg"] > button:first-child{box-sizing:border-box!important;width:120px!important;height:120px!important;max-width:120px!important;padding:0!important;align-items:stretch!important;gap:0!important;border:0.8px solid color-mix(in srgb,var(--claude-color-text) 18%,transparent)!important;border-radius:9px!important;overflow:hidden!important;}
html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-span-first-child-is-img-svg"] > button:first-child > span:first-child{width:100%!important;height:100%!important;min-width:0!important;border:0!important;border-radius:inherit!important;}
html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-span-first-child-is-img-svg"] > button:first-child > span:last-child{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-img"] > button:first-child img{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:cover!important;border-radius:inherit!important;}
html[data-claude-chat-look='true'] [data-slot='composer-attachments'] .group\\/attachment[data-claude-has~="child-button-first-child-span-first-child-is-img-svg"] > button:nth-child(2){transform:scale(2)!important;transform-origin:center!important;z-index:2;}
html[data-claude-chat-look='true'] [data-claude-image-marker='true']{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'] .sticky-human-clamp{max-height:none!important;overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'][data-claude-long-user='true'] .composer-human-message{padding-bottom:38px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'][data-claude-long-user='true']:not([data-claude-user-expanded='true']) .sticky-human-clamp{position:relative;max-height:90px!important;overflow:hidden!important;}
html[data-claude-chat-look='true'] [data-slot='aui_user-message-root'][data-claude-long-user='true']:not([data-claude-user-expanded='true']) .sticky-human-clamp::after{position:absolute;right:0;bottom:0;left:0;height:18px;background:var(--claude-color-bubble);color:var(--claude-color-text);content:'...';font:inherit;line-height:18px;}
html[data-claude-chat-look='true'] [data-claude-user-expand]{position:absolute;bottom:8px;left:12px;z-index:11;display:inline-flex;min-height:22px;align-items:center;gap:7px;padding:0;border:0;background:transparent;color:color-mix(in srgb,var(--claude-color-text) 66%,transparent);cursor:pointer;font:inherit;line-height:22px;}
html[data-claude-chat-look='true'] [data-claude-user-expand]:hover{color:color-mix(in srgb,var(--claude-color-text) 86%,transparent);}
html[data-claude-chat-look='true'] [data-claude-user-chevron]{width:8px;height:8px;margin-top:-4px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);}
html[data-claude-chat-look='true'] [data-claude-user-expand][aria-expanded='true'] [data-claude-user-chevron]{margin-top:4px;transform:rotate(225deg);}
@media (max-width:720px){html[data-claude-chat-look='true'] [data-slot='aui_user-bubble-actions']{max-width:88%!important;}}
html[data-claude-chat-look='true'] [data-slot='aui_edit-composer-root'] .composer-human-message-container{border-radius:17px!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='aui_edit-composer-root'] .composer-human-message{width:100%!important;max-width:100%!important;padding:8px 12px!important;border:1px solid var(--claude-color-border)!important;border-radius:17px!important;background:var(--claude-color-bubble)!important;color:var(--claude-color-text)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'] [data-slot='aui_edit-composer-root'] [data-slot='composer-rich-input']{min-height:44px!important;padding:0 30px 0 0!important;background:transparent!important;color:var(--claude-color-text)!important;caret-color:var(--claude-color-text)!important;font-family:var(--font-sans,${SYSTEM_FONT})!important;font-weight:400!important;}
html[data-claude-chat-look='true'] [data-slot='aui_edit-composer-root'] .composer-human-message > button:last-child{right:8px!important;bottom:8px!important;width:28px!important;height:28px!important;min-width:28px!important;border:0!important;border-radius:9999px!important;background:var(--claude-color-primary)!important;color:var(--claude-color-primary-foreground)!important;}
html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_thinking-disclosure']{font-family:var(--font-sans,${HERMES_FONT})!important;font-size:11px!important;line-height:16.5px!important;font-weight:400!important;color:color-mix(in srgb,var(--claude-color-text) 54%,transparent)!important;}
html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_thinking-disclosure'] :where(button,span){font-family:var(--font-sans,${HERMES_FONT})!important;font-size:11px!important;line-height:16.5px!important;font-weight:400!important;}
html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_reasoning-text'],html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_reasoning-text'] .aui-md,html[data-claude-chat-look='true'] [data-streaming='true'] [data-slot='aui_reasoning-text'] .aui-md :where(p,li,blockquote){font-family:var(--font-sans,${HERMES_FONT})!important;font-size:12px!important;line-height:15px!important;font-weight:400!important;color:color-mix(in srgb,var(--claude-color-text) 60%,transparent)!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'],html[data-claude-chat-look='true'] [data-slot='sidebar'],html[data-claude-chat-look='true'] [data-slot='sidebar-content'],html[data-claude-chat-look='true'] [data-slot='sidebar-group'],html[data-claude-chat-look='true'] [data-slot='sidebar-group-content']{background:var(--claude-color-sidebar)!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover[class*='ui-row-active-background'],html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-active='true'],html[data-claude-chat-look='true'] [data-slot='sidebar'] [aria-current='true']{border:0!important;border-radius:10px!important;outline:0!important;background:var(--claude-sidebar-active)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover{border-radius:10px!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover:hover:not([class*='ui-row-active-background']):not([data-active='true']):not([aria-current='true']){background:var(--claude-sidebar-hover)!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'] button[aria-label][class~='w-full'][class~='text-left'][class~='hover:bg-(--chrome-action-hover)']{border-radius:10px!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'] button[aria-label][class~='w-full'][class~='text-left'][class~='hover:bg-(--chrome-action-hover)']:hover{background:var(--claude-sidebar-hover)!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'] button[aria-label][class~='w-full'][class~='text-left'][class~='hover:bg-(--chrome-action-hover)'][class~='bg-(--ui-row-active-background)']{background:var(--claude-sidebar-active)!important;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div:has(> [data-tree-group='grp-main'])::before{content:'';position:absolute;top:0;left:0;width:16px;height:16px;background:var(--ui-sidebar-surface-background);pointer-events:none;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [data-tree-group='grp-main']{border-top-left-radius:16px!important;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [data-tree-group='grp-main']:has(> [data-panel-header]){background:var(--ui-sidebar-surface-background)!important;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [data-tree-group='grp-main'] > [data-panel-header] + div{border-top-left-radius:0!important;background:var(--ui-editor-surface-background)!important;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div:has(> [data-tree-group='grp-main'] > [data-panel-header])::before{content:none!important;width:0!important;height:0!important;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [data-tree-group='grp-main']:has(> [data-panel-header]){border-top-left-radius:0!important;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [role='separator'] > span{opacity:0!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'] [data-zone-tabstrip='grp-sessions'] [role='tab'][data-tree-tab]{border-left-color:transparent!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-main'][data-claude-has~="chat-surface"] > [data-panel-header]:not(:has([data-zone-tabstrip])){position:absolute!important;inset:0 0 auto!important;height:36px!important;min-height:36px!important;z-index:30;background:transparent!important;border:0!important;box-shadow:none!important;pointer-events:none;}
html[data-claude-chat-look='true'] [data-tree-group='grp-main'] > [data-panel-header]:not([data-claude-has~="zone-tabstrip"]) > [data-window-drag-handle]{pointer-events:auto;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group='grp-main'] > [data-panel-header]::after{content:'';position:absolute;left:0;right:0;bottom:0;z-index:2;height:1px;background:var(--claude-card-border,var(--claude-color-border-subtle,var(--ui-stroke-quaternary)));pointer-events:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group='grp-main'][data-claude-ascii-host] > [data-panel-header]::after{content:none;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'] [data-zone-tabstrip='grp-sessions']{height:36px!important;min-height:36px!important;box-sizing:border-box!important;padding-block:4px!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'] [data-zone-tabstrip='grp-sessions'] > [role='tablist']{align-items:center!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'] [data-zone-tabstrip='grp-sessions'] [role='tab'][data-tree-tab]{height:28px!important;min-height:28px!important;}
html[data-claude-chat-look='true'] [data-tree-group='grp-sessions'] [data-zone-tabstrip='grp-sessions'] > button:has(> .codicon-chevron-down){display:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [class~='group/section-label'] > span > .dither{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [class~='group/section-label'] > span:first-child{color:var(--claude-sidebar-muted)!important;font-family:var(--font-sans,${SYSTEM_FONT})!important;font-size:14px!important;line-height:21px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [class~='group/section-label'] > span:first-child > span:last-child{font-family:var(--font-sans,${SYSTEM_FONT})!important;font-size:14px!important;line-height:21px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar-menu-button']{font-family:var(--font-sans,${SYSTEM_FONT})!important;font-size:14px!important;line-height:21px!important;font-weight:400!important;letter-spacing:normal!important;text-transform:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] span[class*='text-[0.8125rem]']{font-family:var(--font-sans,${SYSTEM_FONT})!important;font-size:14px!important;line-height:20px!important;font-weight:400!important;letter-spacing:normal!important;text-transform:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover span[class*='text-[0.8125rem]'],html[data-claude-chat-look='true'] [data-slot='sidebar-menu-button']{color:var(--claude-sidebar-label)!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover:is(:hover,[data-active='true'],[aria-current='true'],[class*='ui-row-active-background']) span[class*='text-[0.8125rem]']{color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar-menu-button'] > :is(svg,.codicon):not([style*='color']){color:var(--claude-sidebar-muted)!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover span[aria-hidden='true'][class~='size-1'][class*='bg-(--ui-text-quaternary)']:not([style*='background-color']){display:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover[data-working='true'] > .arc-border{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover [role='status'][class*='bg-(--ui-accent)']{background:var(--claude-color-text-tertiary)!important;box-shadow:none!important;animation:claude-dot-blink 1.2s ease-in-out infinite;}
@keyframes claude-dot-blink{0%,100%{opacity:.3;}
50%{opacity:1;}}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] [data-slot='sidebar'] .row-hover [role='status'][class*='bg-(--ui-accent)']{animation:none;}}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'] [data-slot='sidebar'] .row-hover [role='status'][class*='bg-amber-500']{background:var(--claude-status-awaiting)!important;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'] [data-slot='sidebar'] .row-hover [role='status'][class*='bg-(--ui-success)']{background:var(--claude-status-ready)!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [role='status'][class~='bg-emerald-500']{width:8px!important;min-width:8px!important;height:8px!important;flex:0 0 8px!important;background:var(--claude-color-success)!important;opacity:1!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--claude-color-success) 14%,transparent),0 0 8px color-mix(in srgb,var(--claude-color-success) 48%,transparent)!important;}
html[data-claude-chat-look='true'] [data-claude-history-rail]{left:11.2px!important;right:auto!important;width:25.2px!important;align-items:flex-start!important;zoom:calc(10 / 7);transform:translateY(-50%)!important;transform-origin:center!important;max-height:calc(min(60vh,360px,var(--claude-history-rail-height,360px)) * .7);}
html[data-claude-chat-look='true'] [data-session-anchor]:has([data-slot='thread-timeline']){container-type:inline-size;container-name:claude-history-pane;}
@container claude-history-pane (max-width:862px){html[data-claude-chat-look='true'] [data-claude-history-rail]{display:none!important;}}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks']{align-items:flex-start!important;width:25.2px!important;max-height:min(60vh,360px,var(--claude-history-rail-height,360px));overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;padding:0!important;}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] > .thread-timeline-track{width:25.2px!important;position:relative!important;}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick{width:25.2px!important;justify-content:flex-start!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;cursor:pointer;}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick > [data-slot='timeline-bar']{width:calc(var(--claude-history-tick-width,6px) * .7)!important;height:1.4px!important;flex:none!important;border-radius:0!important;background:color-mix(in srgb,var(--claude-color-text) 19.148936%,var(--claude-color-chat))!important;background-image:none!important;opacity:1!important;transition:width 140ms cubic-bezier(.2,.8,.2,1),opacity 140ms ease!important;}
html[data-claude-chat-look='true'] [data-claude-history-rail][data-claude-history-open] [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick > [data-slot='timeline-bar']{transition:none!important;}
html[data-claude-chat-look='true'] [data-claude-history-rail]:not([data-claude-history-open]) [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick[aria-current='location'] > [data-slot='timeline-bar']{background:color-mix(in srgb,var(--claude-color-text) 60%,var(--claude-color-chat))!important;}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] > .thread-timeline-track button.thread-timeline-tick[data-claude-history-hover] > [data-slot='timeline-bar']{background:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-popover']{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='tooltip-content'][data-claude-history-native-tip]{visibility:hidden!important;}
html[data-claude-chat-look='true'] [data-claude-history-preview]{position:absolute;z-index:50;box-sizing:border-box;overflow:hidden;padding:10px 8px;border:1px solid color-mix(in srgb,var(--claude-color-text) 12%,transparent);border-radius:12px;background:var(--claude-color-elevated);color:var(--claude-color-text);box-shadow:0 4px 16px color-mix(in srgb,var(--claude-color-text) 12%,transparent);font-family:var(--font-sans,${SYSTEM_FONT});font-size:13px;line-height:18px;text-align:left;overflow-wrap:anywhere;-webkit-app-region:no-drag;}
html[data-claude-chat-look='true'] [data-claude-history-preview][hidden]{display:none!important;}
html[data-claude-chat-look='true'] [data-claude-history-question],html[data-claude-chat-look='true'] [data-claude-history-answer]{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;}
html[data-claude-chat-look='true'] [data-claude-history-question]{font-weight:500;}
html[data-claude-chat-look='true'] [data-claude-history-answer]{-webkit-line-clamp:4;margin-top:8px;color:var(--claude-color-text-secondary);font-weight:400;}
html[data-claude-chat-look='true'] [data-claude-history-answer] p{margin:0 0 8px;}
html[data-claude-chat-look='true'] [data-claude-history-answer] p:last-child{margin-bottom:0;}
html[data-claude-chat-look='true'] [data-claude-history-answer] strong{font-weight:600;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] [data-claude-history-rail] [data-slot='thread-timeline-ticks'] .thread-timeline-tick > [data-slot='timeline-bar']{transition:none!important;}}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']{scrollbar-color:transparent transparent!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']::-webkit-scrollbar{width:8px!important;height:8px!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']::-webkit-scrollbar-track,html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']::-webkit-scrollbar-corner{background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true']::-webkit-scrollbar-thumb{min-height:28px;border:2px solid transparent;border-radius:999px;background:transparent;background-clip:padding-box;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true'][data-claude-scrolling='true']{scrollbar-color:color-mix(in srgb,var(--claude-color-text) 28%,transparent) transparent!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true'][data-claude-scrolling='true']::-webkit-scrollbar-thumb{background-color:color-mix(in srgb,var(--claude-color-text) 28%,transparent)!important;}
html[data-claude-chat-look='true'] [data-slot='sidebar'] [data-claude-scrollbar='true'] *{scrollbar-color:auto;}
html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true']{scrollbar-width:thin!important;scrollbar-color:color-mix(in srgb,var(--claude-color-text-secondary) 35%,transparent) transparent!important;scrollbar-gutter:stable both-edges;}
html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'][data-claude-scrollbar='true'] *{scrollbar-width:thin;}
html[data-claude-chat-look='true'] [data-slot='aui_thread-viewport'] [data-slot='code-card'] :is(pre,code){white-space:pre-wrap!important;overflow-wrap:anywhere;}
html[data-claude-chat-look='true'] [data-slot='tool-block'] [aria-label='Running'],html[data-claude-chat-look='true'] [data-slot='tool-block'] [aria-label='En cours'],html[data-claude-chat-look='true'] [data-slot='tool-block'] span[class*='tabular-nums']{color:var(--claude-color-text)!important;opacity:0.70!important;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open]{--claude-diff-card-surface: color-mix(in srgb, var(--claude-color-elevated) 50%, transparent);--claude-diff-line-mix: 80%;--claude-diff-num-mix: 85%;--claude-diff-add-surface: color-mix(
    in srgb,
    var(--claude-diff-card-surface) var(--claude-diff-line-mix),
    var(--ui-diff-add-border)
  );--claude-diff-remove-surface: color-mix(
    in srgb,
    var(--claude-diff-card-surface) var(--claude-diff-line-mix),
    var(--ui-diff-remove-border)
  );--claude-diff-band: color-mix(in srgb, var(--claude-diff-card-surface) 85%, white);background:var(--claude-diff-card-surface)!important;border-color:transparent!important;border-radius:8px!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--claude-color-text) 10%,transparent)!important;}
html[data-claude-chat-look='true'][data-hermes-mode='light'] [data-slot='tool-block'][data-file-edit][data-tool-open]{--claude-diff-line-mix: 88%;--claude-diff-num-mix: 91%;--claude-diff-band: color-mix(in srgb, var(--claude-diff-card-surface) 96%, black);}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] > div:first-child{padding:6px 8px!important;border-bottom:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-block'][data-file-edit][data-tool-open] > div:first-child button[aria-expanded] .whitespace-nowrap{font-size:12px!important;line-height:15px!important;color:var(--claude-color-text-secondary);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-slot='tool-block'][data-file-edit][data-tool-open] > div:first-child button[aria-expanded]:hover .whitespace-nowrap{text-decoration:underline;text-underline-offset:3px;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel']{background:transparent!important;color:var(--claude-color-text-secondary)!important;font-size:12px!important;line-height:17px!important;padding-top:4px!important;padding-bottom:4px!important;max-height:400px!important;overflow-x:hidden!important;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel']{--claude-diff-gutter: 0px;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'][data-claude-diff-numbered]{--claude-diff-gutter: calc(max(3ch, var(--claude-ln-width, 3ch)) + 3ch + 2px);}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] span[class*='border-l-2']{position:relative;min-height:17px!important;min-width:0!important;border-left:0!important;line-height:17px!important;padding:0 1ch 0 calc(var(--claude-diff-gutter) + 2ch)!important;white-space:pre-wrap!important;overflow-wrap:anywhere;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] :is(pre,code){min-width:0!important;max-width:100%;grid-template-columns:minmax(0,1fr);}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'][data-claude-diff-numbered] span[data-claude-ln]::before{content:attr(data-claude-ln);position:absolute;top:0;bottom:0;left:0;box-sizing:border-box;width:calc(var(--claude-diff-gutter) - 2px);padding:0 1ch 0 2ch;text-align:right;color:var(--claude-color-text-tertiary,var(--ui-text-tertiary));user-select:none;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] span:is([class*='border-(--ui-diff-add-border)'],[class*='border-(--ui-diff-remove-border)'])::after{position:absolute;top:0;left:var(--claude-diff-gutter);width:1ch;user-select:none;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] span[class*='border-(--ui-diff-add-border)']{background:var(--claude-diff-add-surface)!important;color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] span[class*='border-(--ui-diff-add-border)']::after{content:'+';color:var(--ui-diff-add-border);}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] span[class*='border-(--ui-diff-add-border)'][data-claude-ln]::before{color:var(--ui-diff-add-border);background:color-mix(in srgb,var(--claude-diff-card-surface) var(--claude-diff-num-mix),var(--ui-diff-add-border));}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] span[class*='border-(--ui-diff-remove-border)']{background:var(--claude-diff-remove-surface)!important;color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] span[class*='border-(--ui-diff-remove-border)']::after{content:'-';color:var(--ui-diff-remove-border);}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'] span[class*='border-(--ui-diff-remove-border)'][data-claude-ln]::before{color:var(--ui-diff-remove-border);background:color-mix(in srgb,var(--claude-diff-card-surface) var(--claude-diff-num-mix),var(--ui-diff-remove-border));}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'][data-claude-diff-numbered] span[data-claude-ln='']{height:4px!important;min-height:0!important;margin:0;overflow:hidden;font-size:0;line-height:0!important;background:var(--claude-diff-band)!important;}
html[data-claude-chat-look='true'] [data-slot='tool-block'][data-file-edit][data-tool-open] [data-slot='file-diff-panel'][data-claude-diff-numbered] span[data-claude-ln='']::before{content:none;}
@keyframes claude-compaction-spin{to{transform:rotate(360deg);}}
html[data-claude-chat-look='true'] [data-slot='aui_response-loading'][aria-label='Summarizing thread']{width:fit-content!important;max-width:min(100%,44rem)!important;display:flex!important;align-self:center!important;align-items:center!important;gap:7px!important;margin:4px auto 8px!important;padding:4px 8px!important;border:1px solid var(--claude-color-border-subtle)!important;border-radius:10px!important;background:var(--claude-color-bubble)!important;color:color-mix(in srgb,var(--claude-color-text) 58%,transparent)!important;font-size:12px!important;line-height:20px!important;}
html[data-claude-chat-look='true'] [data-slot='aui_response-loading'][aria-label='Summarizing thread'] .dither{width:12px!important;height:12px!important;flex:0 0 12px!important;border:1.5px solid color-mix(in srgb,var(--claude-color-text) 22%,transparent)!important;border-right-color:color-mix(in srgb,var(--claude-color-text) 72%,transparent)!important;border-radius:999px!important;background:transparent!important;color:transparent!important;animation:claude-compaction-spin 800ms linear infinite!important;}
html[data-claude-chat-look='true'] [data-slot='aui_response-loading'][aria-label='Summarizing thread'] .shimmer{color:inherit!important;}
html[data-claude-chat-look='true'] [data-tool-group],html[data-claude-chat-look='true'] [data-tool-group] .tool-group-scroll{max-height:none!important;overflow:visible!important;scrollbar-width:none!important;-webkit-mask-image:none!important;mask-image:none!important;}
html[data-claude-chat-look='true'] .coding-status-bar{display:none!important;}
html[data-claude-chat-look='true'][data-claude-composer-width='claude'] [data-slot='composer-dock']:not([data-popped-out]),html[data-claude-chat-look='true'][data-claude-composer-width='claude-wide'] [data-slot='composer-dock']:not([data-popped-out]),html[data-claude-chat-look='true'][data-claude-composer-width='claude-wider'] [data-slot='composer-dock']:not([data-popped-out]){width:calc(min(var(--composer-width),calc(100% - 2rem)) + 10px)!important;max-width:calc(100% - 22px)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-root'],html[data-claude-chat-look='true'] [data-slot='composer-root'] > div:not([data-slot='composer-completion-drawer']),html[data-claude-chat-look='true'] [data-slot='composer-surface'],html[data-claude-chat-look='true'] [data-slot='composer-surface'] > [aria-hidden]{border-radius:21px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface']{min-height:98px!important;border:0.5px solid var(--claude-color-border-subtle)!important;background:var(--claude-color-card)!important;box-shadow:var(--shadow-nous)!important;backdrop-filter:none!important;overflow:hidden!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] > [aria-hidden]{background:var(--claude-color-card)!important;backdrop-filter:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-root'] > .pointer-events-none.absolute.inset-0{background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-fade']{--claude-playback-edge-gap: 12px;padding:11px 7px 7px!important;gap:0!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface']:has([data-claude-playback-floating='true']),html[data-claude-chat-look='true'] [data-slot='composer-fade']:has(> [data-claude-playback-floating='true']){overflow:visible!important;}
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > div:last-child{grid-template-columns:auto 1fr auto!important;grid-template-areas:"input input input" "menu . controls"!important;align-items:center!important;row-gap:0!important;column-gap:5px!important;}
html[data-claude-chat-look='true'] [data-claude-edit-banner='true']{min-height:32px!important;gap:8px!important;padding:3px 4px 3px 10px!important;border:1px solid var(--claude-color-border-subtle)!important;border-radius:10px!important;background:var(--ui-bg-tertiary)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] > div:first-child{color:color-mix(in srgb,var(--claude-color-text) 56%,transparent)!important;font-size:12px!important;line-height:18px!important;font-weight:400!important;}
html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] > div:last-child{gap:4px!important;}
html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] button{height:26px!important;min-height:26px!important;padding:0 8px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:color-mix(in srgb,var(--claude-color-text) 66%,transparent)!important;font-size:11px!important;line-height:16px!important;font-weight:400!important;}
html[data-claude-chat-look='true'] [data-claude-edit-banner='true'] button:last-child{padding:0 10px!important;border-radius:999px!important;background:var(--claude-color-primary)!important;color:var(--claude-color-primary-foreground)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-rich-input']{min-height:44px!important;padding:0!important;font-family:var(--font-sans,${SYSTEM_FONT})!important;font-weight:400!important;scrollbar-width:thin!important;scrollbar-color:color-mix(in srgb,var(--claude-color-text) 22%,transparent) transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [data-slot='composer-attachments']{padding:0 4px!important;margin-bottom:4px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > div:last-child > div:has(> [data-slot='composer-rich-input']),html[data-claude-chat-look='true'] [data-slot='composer-fade'] > div:last-child > div:has(> div > [data-slot='composer-rich-input']){padding-inline:4px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > div:last-child > div:has(button > .codicon-add){translate:none!important;transform:none!important;align-self:center!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-slot='composer-rich-input']{min-height:50px!important;max-height:240px!important;padding-top:2px!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'][data-hermes-theme='claude-chat'][data-hermes-mode='dark'] [data-slot='composer-surface'] [data-slot='composer-rich-input']:is(:empty,[data-empty])::before{color:color-mix(in srgb,var(--claude-color-text) 24%,var(--claude-color-card))!important;}
@supports (animation-timeline:scroll(self block)){@keyframes claude-composer-scroll-edge{from{mask-image:linear-gradient(to bottom,black,black);}
to{mask-image:linear-gradient(to bottom,transparent,black 16px);}}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-slot='composer-rich-input'][data-claude-composer-overflow]{animation:claude-composer-scroll-edge 1s steps(1,end) both;animation-timeline:scroll(self block);animation-range:0px 1px;}}
html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar{width:8px!important;height:8px!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-track,html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-corner{background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-thumb{min-height:28px;border:2px solid transparent!important;border-radius:999px!important;background-color:color-mix(in srgb,var(--claude-color-text) 22%,transparent)!important;background-image:none!important;background-clip:padding-box!important;}
html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb,var(--claude-color-text) 38%,transparent)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-rich-input']::-webkit-scrollbar-button{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Add context'],html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Ajouter du contexte'],html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Voice dictation'],html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Dictée vocale'],html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Send'],html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label='Envoyer']{width:28px!important;height:28px!important;min-width:28px!important;border-radius:9999px!important;padding:0!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label^='Model ·'],html[data-claude-chat-look='true'] [data-slot='composer-surface'] button[aria-label^='Modèle ·']{min-height:28px!important;border-radius:9999px!important;padding:0 8px!important;color:color-mix(in srgb,var(--claude-color-text) 66%,transparent)!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label^='Model ·'],[aria-label^='Modèle ·'])[data-state='open']{background:var(--claude-color-active)!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:has(> .codicon-add){position:relative;width:28px!important;height:28px!important;min-width:28px!important;padding:0!important;color:var(--dt-foreground,var(--claude-color-text))!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button > .codicon-add{visibility:hidden;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:has(> .codicon-add)::before,html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:has(> .codicon-add)::after{content:'';position:absolute;top:50%;left:50%;width:13px;height:1.5px;border-radius:1px;background:currentColor;transform:translate(-50%,-50%);pointer-events:none;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:has(> .codicon-add)::after{width:1.5px;height:13px;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale']) > *,html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Send'],[aria-label='Envoyer']) > *{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale'])::before,html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Send'],[aria-label='Envoyer'])::before{content:'';display:block;width:16px;height:16px;background:currentColor;mask-repeat:no-repeat;mask-position:center;mask-size:contain;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale'])::before{mask-image:${MIC_MASK};}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale'])::before{width:17px;height:17px;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Voice dictation'],[aria-label='Dictée vocale']){color:color-mix(in srgb,var(--claude-color-text) 84%,var(--claude-composer-fill))!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Stop dictation'],[aria-label='Transcribing dictation']){width:28px!important;height:28px!important;min-width:28px!important;padding:0!important;border-radius:9999px!important;background:transparent!important;color:var(--claude-color-text)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Stop dictation'],[aria-label='Transcribing dictation']) svg{width:14px!important;height:14px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] button:is([aria-label='Send'],[aria-label='Envoyer'])::before{mask-image:${SEND_MASK};}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite']:has(> button),html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not(:has(> button)){height:28px;margin-bottom:var(--claude-playback-edge-gap);gap:6px!important;padding:0 4px!important;border:0!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;font-family:var(--font-sans,${SYSTEM_FONT})!important;font-size:12px!important;line-height:18px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-dock']:has([data-claude-playback-floating='true']){padding-top:40px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-dock']:has([data-claude-audio-dictation='true']):has([data-claude-audio-playback='true']){padding-top:80px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [data-claude-playback-floating='true']{position:absolute!important;top:var(--claude-audio-lane-top,calc(-28px - var(--claude-playback-edge-gap)))!important;right:15px!important;left:15px!important;width:auto!important;margin:0!important;z-index:6;}
html[data-claude-chat-look='true'] [data-slot='composer-fade'][data-claude-has~="child-claude-audio-dictation-true"][data-claude-has~="child-claude-audio-playback-true"] > [data-claude-audio-playback='true']{top:calc(var(--claude-audio-lane-top) + 40px)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > div:first-child,html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not([data-claude-has~="child-button"]) > div:first-child{width:18px!important;height:18px!important;flex:0 0 18px!important;border-radius:5px!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > div:first-child svg,html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not([data-claude-has~="child-button"]) > div:first-child svg{width:14px!important;height:14px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > div:nth-child(2),html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not([data-claude-has~="child-button"]) > div:nth-child(2){gap:6px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > div:nth-child(2) > span,html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not([data-claude-has~="child-button"]) > div:nth-child(2) > span{color:inherit!important;font-size:12px!important;line-height:18px!important;font-weight:400!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] canvas{width:56px!important;height:12px!important;opacity:0.72!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > button{height:24px!important;min-height:24px!important;gap:4px!important;padding:0 7px!important;border:0!important;border-radius:7px!important;background:transparent!important;font-size:11px!important;line-height:16px!important;font-weight:400!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > button svg{width:12px!important;height:12px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite']:has(> button),html[data-claude-chat-look='true'] [data-slot='composer-fade'] > [role='status'][aria-live='polite']:not(:has(> button)){color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] canvas{color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [role='status'][aria-live='polite'][data-claude-has~="child-button"] > button:hover{background:var(--claude-color-hover)!important;color:var(--claude-color-text)!important;}
@keyframes claude-playback-enter{from{opacity:0;transform:translateY(6px);}
to{opacity:1;transform:translateY(0);}}
@keyframes claude-playback-exit{from{opacity:1;transform:translateY(0);}
to{opacity:0;transform:translateY(6px);}}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-enter='true']{min-height:0!important;overflow:hidden!important;contain:paint!important;will-change:transform,opacity;animation:claude-playback-enter 240ms cubic-bezier(0.22,1,0.36,1) both!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-exit='true']{min-height:0!important;overflow:hidden!important;pointer-events:none!important;user-select:none!important;contain:paint!important;will-change:transform,opacity;animation:claude-playback-exit 240ms cubic-bezier(0.22,1,0.36,1) both!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-hold='true']{pointer-events:none!important;user-select:none!important;}
@media (prefers-reduced-motion:reduce){html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-enter='true']{animation:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-surface'] [data-claude-playback-exit='true']{display:none!important;}}
html[data-claude-chat-look='true'] [data-claude-context-menu='true']{width:240px!important;max-width:calc(100vw - 24px)!important;max-height:min(40vh,360px)!important;padding:4px!important;border:1px solid color-mix(in srgb,var(--claude-color-text) 10%,transparent)!important;border-radius:10px!important;background:var(--claude-color-card)!important;box-shadow:var(--claude-popover-shadow)!important;backdrop-filter:none!important;overflow-x:hidden!important;overflow-y:auto!important;}
html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-label']{padding:4px 8px!important;color:var(--claude-color-text-tertiary,var(--ui-text-tertiary))!important;font-family:var(--font-sans,${SYSTEM_FONT})!important;font-size:12px!important;line-height:15px!important;font-weight:500!important;letter-spacing:normal!important;text-transform:none!important;}
html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-item']{height:24px!important;min-height:24px!important;gap:6px!important;padding:2.5px 8px!important;border-radius:6px!important;color:var(--claude-color-text)!important;font-family:var(--font-sans,${SYSTEM_FONT})!important;font-size:13px!important;line-height:19px!important;}
html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-item']:is(:hover,:focus,[data-highlighted]){background:var(--claude-menu-highlight,var(--claude-ghost-hover))!important;color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-item'] svg{width:14px!important;height:14px!important;color:color-mix(in srgb,var(--claude-color-text) 68%,transparent)!important;}
html[data-claude-chat-look='true'] [data-claude-context-menu='true'] [data-slot='dropdown-menu-separator']{margin:4px 8px!important;background:var(--claude-menu-separator,color-mix(in srgb,var(--claude-color-text) 10%,transparent))!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']{right:5px!important;left:5px!important;width:auto!important;max-width:none!important;max-height:min(40vh,360px)!important;padding:4px!important;border:1px solid color-mix(in srgb,var(--claude-color-text) 10%,transparent)!important;border-radius:10px!important;background:var(--claude-color-card)!important;box-shadow:var(--claude-popover-shadow)!important;backdrop-filter:none!important;overflow-x:hidden!important;overflow-y:auto!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer'] > button{min-height:24px!important;padding:2.5px 8px!important;border-radius:6px!important;font-size:13px!important;line-height:19px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer'] > button > span{line-height:19px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer'] > div:not(:has(button)){padding:6px 8px 2px!important;font-size:12px!important;font-weight:400!important;line-height:17px!important;letter-spacing:normal!important;text-transform:none!important;color:var(--claude-color-text-tertiary)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer'] > div:not(:has(button))::first-letter{text-transform:uppercase;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar{width:8px!important;height:8px!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-track{margin-block:8px!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-corner{background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-button{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-thumb{min-height:24px!important;border:2px solid transparent!important;border-radius:999px!important;background:color-mix(in srgb,var(--claude-color-text) 22%,transparent)!important;background-clip:padding-box!important;}
html[data-claude-chat-look='true'] [data-slot='composer-completion-drawer']::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--claude-color-text) 36%,transparent)!important;background-clip:padding-box!important;}
html[data-claude-chat-look='true'] :is([data-slot='composer-root'],[data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full{right:26px!important;bottom:100%!important;left:26px!important;z-index:3!important;width:auto!important;padding:0!important;border:0!important;background:transparent!important;background-image:none!important;box-shadow:none!important;filter:none!important;transform:none!important;backdrop-filter:none!important;overflow:visible auto!important;}
html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-']{position:relative!important;right:auto!important;bottom:auto!important;left:auto!important;z-index:3!important;width:auto!important;margin-right:26px!important;margin-bottom:0!important;margin-left:26px!important;border:0!important;background:transparent!important;background-image:none!important;box-shadow:none!important;filter:none!important;transform:none!important;translate:none!important;backdrop-filter:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] [data-slot='status-stack-section'] > [role='alert']:has(> div > .codicon-error){min-width:0!important;margin:8px!important;padding:8px 10px!important;gap:10px!important;align-items:flex-start!important;border:1px solid color-mix(in srgb,var(--claude-color-destructive) 18%,var(--claude-color-border-subtle))!important;border-radius:12px!important;background:var(--claude-color-card)!important;color:var(--claude-color-text)!important;font-size:12px!important;line-height:20px!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] [data-slot='status-stack-section'] > [role='alert'][data-claude-has~="child-div-codicon-error"] > div{flex:1!important;min-width:0!important;align-items:flex-start!important;gap:8px!important;white-space:normal!important;overflow:visible!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] [data-slot='status-stack-section'] > [role='alert'][data-claude-has~="child-div-codicon-error"] > div > span{min-width:0!important;white-space:normal!important;overflow-wrap:anywhere!important;overflow:visible!important;text-overflow:clip!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] [data-slot='status-stack-section'] > [role='alert'] > div > .codicon-error{color:var(--claude-color-destructive)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] [data-slot='status-stack-section'] > [role='alert'][data-claude-has~="child-div-codicon-error"] > button{border-radius:999px!important;color:var(--claude-color-text-secondary)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] [data-slot='status-stack-section'] > [role='alert'][data-claude-has~="child-div-codicon-error"] > button:hover{background:var(--claude-color-hover)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] > div:has(> [data-slot='status-stack-scroll']){margin:0 26px!important;padding:0!important;border:0!important;border-radius:20px 20px 0 0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;}
html[data-claude-chat-look='true'] [data-slot='status-stack-scroll']{scrollbar-width:thin!important;scrollbar-color:transparent transparent!important;}
html[data-claude-chat-look='true'] [data-slot='status-stack-scroll']:hover{scrollbar-color:color-mix(in srgb,var(--claude-color-text) 22%,transparent) transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'][data-claude-has-task-section='true'] [data-slot='status-stack-scroll']{display:flex!important;min-height:0!important;flex-direction:column!important;overflow:hidden!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']{scrollbar-width:thin!important;scrollbar-color:transparent transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar{width:8px!important;height:8px!important;background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar-track,html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar-corner{background:transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar-button{display:none!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']::-webkit-scrollbar-thumb{min-height:28px!important;border:2px solid transparent!important;border-radius:999px!important;background:transparent!important;background-clip:padding-box!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']:hover{scrollbar-color:color-mix(in srgb,var(--claude-color-text) 22%,transparent) transparent!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack']:hover::-webkit-scrollbar-thumb{background-color:color-mix(in srgb,var(--claude-color-text) 22%,transparent)!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'][data-claude-has-task-section='true']{overflow:hidden!important;}
html[data-claude-chat-look='true'] [data-claude-status-card='true']:has([data-claude-task-section='true']){display:flex!important;min-height:0!important;max-height:40vh!important;flex-direction:column!important;}
html[data-claude-chat-look='true'] [data-claude-status-card='true'][data-claude-has~="claude-task-section-true"] > div:not([data-claude-task-section='true']){flex:0 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:thin!important;}
html[data-claude-chat-look='true'] [data-claude-task-section='true']{display:flex!important;min-height:0!important;flex:0 100000 auto!important;overflow:hidden!important;}
html[data-claude-chat-look='true'] [data-claude-task-section='true'] > div{display:flex!important;width:100%!important;min-height:0!important;flex-direction:column!important;}
html[data-claude-chat-look='true'] [data-claude-task-section='true'] > div > div:first-child{flex:0 0 auto!important;}
html[data-claude-chat-look='true'] [data-claude-task-section='true'] > div > div:nth-child(2){min-height:0!important;flex:1 1 auto!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:thin!important;scrollbar-color:transparent transparent!important;}
html[data-claude-chat-look='true'] [data-claude-task-section='true'] > div > div:nth-child(2):hover{scrollbar-color:color-mix(in srgb,var(--claude-color-text) 22%,transparent) transparent!important;}
html[data-claude-chat-look='true'] [data-claude-status-card='true'],html[data-claude-chat-look='true'] :is([data-slot='composer-root'],[data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child,html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child{margin:0!important;padding:4px 8px 2px!important;border:0 none transparent!important;border-radius:20px 20px 0 0!important;background:var(--claude-color-status-panel)!important;box-shadow:none!important;backdrop-filter:none!important;overflow:hidden!important;}
html[data-claude-chat-look='true'] [data-claude-status-card='true'] > div + div,html[data-claude-chat-look='true'] :is([data-slot='composer-root'],[data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child > div + div,html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child > div + div{border-top:0!important;}
html[data-claude-chat-look='true'] [data-claude-status-card='true'] button,html[data-claude-chat-look='true'] :is([data-slot='composer-root'],[data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child button,html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child button{border-radius:12px!important;color:color-mix(in srgb,var(--claude-color-text) 68%,transparent)!important;}
html[data-claude-chat-look='true'] [data-claude-status-card='true'] button:hover,html[data-claude-chat-look='true'] :is([data-slot='composer-root'],[data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child button:hover,html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child button:hover{color:var(--claude-color-text)!important;}
html[data-claude-chat-look='true'] [data-claude-status-card='true'] [class~='group/status-row'],html[data-claude-chat-look='true'] :is([data-slot='composer-root'],[data-slot='composer-dock']) div.absolute.inset-x-0.bottom-full > div:first-child [class~='group/status-row'],html[data-claude-chat-look='true'] [data-slot='composer-dock'] > div[class~='overflow-y-auto'][class*='max-h-'] > div:first-child [class~='group/status-row']{min-height:24px!important;gap:6px!important;padding:1px 8px!important;border-radius:8px!important;}
html[data-claude-chat-look='true'] [data-claude-status-card='true'] .status-artifacts > [data-slot='status-row']{align-items:center!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] [data-slot='status-row'][data-claude-has~="child-status-row-icon-codicon-comment"] > .status-row-actions{align-self:center!important;}
html[data-claude-chat-look='true'] [data-slot='composer-status-stack'] [data-slot='status-row'][data-claude-has~="child-status-row-icon-codicon-comment"] > .status-row-actions > button{margin-top:0!important;}
html[data-claude-chat-look='true'] [data-slot='aui_intro'] [aria-label='HERMES AGENT']{color:var(--claude-color-text)!important;mix-blend-mode:normal!important;}
html[data-claude-chat-look='true']{--claude-browser-background: var(--ui-editor-surface-background);--claude-browser-tab: var(--ui-row-active-background);--claude-browser-divider: var(--ui-stroke-tertiary);}
html[data-claude-chat-look='true'] [data-titlebar-cluster][data-claude-titlebar-aligned]{top:calc(var(--titlebar-controls-top,5px) + var(--claude-titlebar-offset,0px))!important;}
html[data-claude-chat-look='true'] [data-window-top] > [data-panel-header],html[data-claude-chat-look='true'] [data-tree-group] > [data-panel-header]:has([data-zone-tabstrip]){height:36px!important;min-height:36px!important;}
html[data-claude-chat-look='true'] [data-window-top] > [data-panel-header] [data-zone-tabstrip][class~='absolute']{top:0!important;bottom:auto!important;left:var(--panel-titlebar-left,0px)!important;right:var(--panel-titlebar-right,0px)!important;-webkit-app-region:drag!important;}
html[data-claude-chat-look='true'] [data-window-top] > [data-panel-header] > [data-window-drag-handle]{height:36px!important;}
html[data-claude-chat-look='true'] [data-window-top] > [data-panel-header][data-claude-has~="zone-tabstrip"] > [data-window-drag-handle]{position:absolute!important;inset:0 0 auto!important;height:4px!important;pointer-events:none;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) > [data-panel-header]:has([data-zone-tabstrip]){background:var(--claude-browser-background)!important;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip]{--pane-tab-active-accent: transparent;--pane-tab-active-bg: var(--claude-browser-tab);height:36px!important;min-height:36px!important;box-sizing:border-box!important;padding:4px 8px!important;gap:4px!important;border:0!important;background:var(--claude-browser-background)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] > [role='tablist']{align-items:center!important;gap:4px!important;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [role='tab']:not([data-claude-terminal-tab]){--tab-bg: var(--claude-browser-background);--tab-face: var(--claude-browser-background);height:28px!important;min-height:28px!important;border-radius:10px!important;border:0!important;box-shadow:none!important;overflow:hidden!important;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [role='tab']:not([data-claude-terminal-tab]):is([aria-selected='true'],[data-active='true']){--tab-bg: var(--claude-browser-tab);--tab-face: var(--claude-browser-tab);background:var(--claude-browser-tab)!important;color:var(--ui-text-primary)!important;}
html[data-claude-chat-look='true'] [data-tree-group] [data-zone-tabstrip] [role='tab'] > :is(span,button) > span.truncate,html[data-claude-chat-look='true'] [data-tree-group] [data-zone-tabstrip] [role='tab'] > .pane-tab-content > :is(span,button) > span.truncate{font-size:12px!important;font-weight:400!important;text-transform:none!important;letter-spacing:normal!important;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [role='tab'] > span:last-child[data-claude-has~="child-button-label"] > [aria-hidden],html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [role='tab'] > span:last-child[data-claude-has~="child-button-label"] > button[aria-label]{background:transparent!important;background-image:none!important;box-shadow:none!important;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [data-slot='pane-tab'][data-closeable]:not([data-vertical='true']) > .pane-tab-content{padding-inline-end:28px!important;-webkit-mask-image:none!important;mask-image:none!important;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [data-slot='pane-tab'][data-closeable]:not([data-vertical='true']) > span:last-child:has(> button[aria-label]){inset:4px 4px 4px auto!important;align-items:center!important;}
html[data-claude-chat-look='true'] [data-tree-group]:not([data-tree-group='grp-sessions']) [data-zone-tabstrip] [data-slot='pane-tab'][data-closeable]:not([data-vertical='true']) > span:last-child[data-claude-has~="child-button-label"] > button[aria-label]{width:20px!important;height:20px!important;padding:0!important;border-radius:50%!important;background:color-mix(in srgb,var(--claude-color-text,var(--ui-text-primary)) 10%,transparent)!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]{background:var(--claude-browser-background)!important;container-type:inline-size;container-name:claude-browser;--claude-browser-shadow-ink: var(--ui-text-primary);--claude-browser-shadow: 0 1px 2px color-mix(in srgb, var(--claude-browser-shadow-ink) 9%, transparent),
    0 2px 6px color-mix(in srgb, var(--claude-browser-shadow-ink) 7%, transparent);}
html[data-claude-chat-look='true'][data-hermes-mode='dark'] aside[data-preview-browser]{--claude-browser-shadow-ink: var(--theme-background-seed, var(--claude-browser-background));}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"]{position:relative!important;height:36px!important;min-height:36px!important;flex:0 0 auto!important;display:flex!important;flex-wrap:nowrap!important;align-items:center!important;box-sizing:border-box!important;padding:0 4px!important;gap:8px!important;border:0!important;border-bottom:1px solid var(--claude-browser-divider)!important;border-radius:0!important;background:var(--claude-browser-background)!important;box-shadow:none!important;}
html[data-claude-chat-look='true'] [data-tree-group] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] button:is([aria-label='Copy URL'],[aria-label='Pop out'],[aria-label='Pop in'],[aria-label='Open in browser'],[aria-label$='preview console'],[aria-label$='preview DevTools'],[aria-label='Close']){display:none!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button{width:24px!important;min-width:24px!important;height:24px!important;min-height:24px!important;flex-shrink:0!important;padding:0!important;border:0!important;border-radius:6px!important;background:transparent!important;box-shadow:none!important;color:var(--claude-color-text-secondary,var(--ui-text-secondary))!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button:disabled{opacity:.45!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button:is(:hover,:focus-visible):not(:disabled),html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button[aria-pressed='true']{background:var(--claude-fill-ghost-hover)!important;color:var(--ui-text-primary)!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button > svg{width:16px!important;height:16px!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > div:has(> input[data-slot='input']){min-width:60px!important;flex:1 1 auto!important;margin:0!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']{width:100%!important;height:24px!important;min-height:24px!important;box-sizing:border-box!important;margin:0!important;padding:0 8px!important;border-width:1px!important;border-style:solid!important;border-radius:6px!important;background:var(--claude-fill-field)!important;box-shadow:none!important;color:var(--ui-text-primary)!important;caret-color:var(--claude-color-accent,var(--theme-primary,currentColor));font-size:14px!important;line-height:22px!important;transition:border-color 150ms ease-out,box-shadow 150ms ease-out;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']:not([aria-invalid='true']){border-color:var(--claude-line)!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']:not([aria-invalid='true']):hover{border-color:var(--claude-line-strong)!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input'].pl-6{padding-left:24px!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']::placeholder{color:var(--claude-color-text-tertiary,var(--ui-text-tertiary))!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']:not([aria-invalid='true']):focus-visible{border-color:var(--claude-color-accent,var(--theme-primary,currentColor))!important;box-shadow:0 0 6px 1px color-mix(in srgb,var(--claude-color-accent,var(--theme-primary,currentColor)) 30%,transparent)!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input']:focus-visible{outline:0!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] input[data-slot='input'][value='about:blank']:not(:focus){color:transparent!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > div:has(> input[data-slot='input'][value='about:blank']:not(:focus))::before{content:'Type a URL';position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--claude-color-text-tertiary,var(--ui-text-tertiary));font-size:14px;pointer-events:none;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button[aria-label='Annotate'] > :is(svg,i){display:none!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button[aria-label='Annotate']::before{content:'';display:block;flex:0 0 16px;width:16px;height:16px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.25' stroke-linejoin='round'%3E%3Cpath d='M3.75 2.75 12.5 6.6 8.9 7.8l3.35 3.35-1.35 1.35L7.55 9.15l-1.2 3.6z'/%3E%3C/svg%3E") center / 16px 16px no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.25' stroke-linejoin='round'%3E%3Cpath d='M3.75 2.75 12.5 6.6 8.9 7.8l3.35 3.35-1.35 1.35L7.55 9.15l-1.2 3.6z'/%3E%3C/svg%3E") center / 16px 16px no-repeat;}
html[data-claude-chat-look='true'] aside[data-preview-browser][data-claude-annotating]:not(#claude-browser) > div:first-child > div[data-claude-has~="child-div-input-slot-input"] > button[aria-label='Annotate']{background:var(--claude-pane-active)!important;color:var(--claude-pane-active-glyph)!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser][data-claude-annotating]{position:relative;}
html[data-claude-chat-look='true'] [data-claude-annotate-bar]{position:absolute;left:50%;bottom:14px;z-index:30;transform:translateX(-50%);display:flex;align-items:center;gap:2px;padding:4px;border:1px solid var(--claude-color-border,var(--ui-stroke-tertiary));border-radius:10px;background:var(--claude-color-elevated,var(--ui-editor-surface-background));box-shadow:0 6px 20px color-mix(in srgb,black 30%,transparent);-webkit-app-region:no-drag;white-space:nowrap;}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] > button{display:inline-flex;align-items:center;justify-content:center;gap:2px;height:28px;min-width:28px;padding:0 6px;border:0;border-radius:7px;background:transparent;color:var(--claude-color-text-secondary,var(--ui-text-secondary));cursor:pointer;}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] [hidden]{display:none!important;}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] > button:is(:hover,[aria-expanded='true']):not(:disabled){background:var(--ui-row-hover-background);color:var(--ui-text-primary);}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] > button[aria-pressed='true']{background:var(--claude-pane-active);color:var(--claude-pane-active-glyph);}
html[data-claude-chat-look='true'] [data-claude-annotate-bar] svg{width:16px;height:16px;flex:0 0 16px;}
html[data-claude-chat-look='true'] [data-claude-annotate-split]{display:inline-flex;align-items:center;gap:2px;}
html[data-claude-chat-look='true'] [data-claude-annotate-split] > span{display:inline-flex;}
html[data-claude-chat-look='true'] [data-claude-annotate-split] > svg:last-child{width:12px;height:12px;flex-basis:12px;}
html[data-claude-chat-look='true'] [data-claude-annotate-sep]{width:1px;height:18px;margin:0 4px;background:var(--claude-color-border-subtle,var(--ui-stroke-quaternary));}
html[data-claude-chat-look='true'] [data-claude-annotate-dot]{display:inline-block;width:14px;height:14px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--ui-text-primary) 30%,transparent);border-radius:50%;}
html[data-claude-chat-look='true'] [data-claude-annotate-stroke]{display:inline-block;width:20px;min-height:1px;border-radius:4px;background:var(--ui-text-primary);}
html[data-claude-chat-look='true'] [data-claude-annotate-add]{height:26px;margin-left:4px;padding:0 10px;border:0;border-radius:7px;background:color-mix(in srgb,var(--ui-text-primary) 16%,transparent);color:var(--ui-text-primary);font-size:13px;font-weight:500;cursor:pointer;}
html[data-claude-chat-look='true'] [data-claude-annotate-add]:disabled{opacity:.5;cursor:default;}
html[data-claude-chat-look='true'] [data-claude-annotate-menu]{position:absolute;bottom:calc(100% + 6px);display:flex;flex-direction:column;min-width:150px;padding:4px;border:1px solid var(--claude-color-border,var(--ui-stroke-tertiary));border-radius:10px;background:var(--claude-color-elevated,var(--ui-editor-surface-background));box-shadow:0 6px 20px color-mix(in srgb,black 30%,transparent);}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] > button{display:flex;align-items:center;gap:10px;height:30px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--ui-text-primary);font-size:13px;text-align:left;cursor:pointer;}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] > button:hover{background:var(--ui-row-hover-background);}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] > button > svg{width:16px;height:16px;flex:0 0 16px;}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] [data-claude-annotate-dot]{width:18px;height:18px;}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] [data-claude-annotate-stroke]{width:26px;}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] [data-claude-annotate-check]{width:14px;height:14px;flex-basis:14px;margin-left:auto;color:var(--claude-pane-active-glyph);visibility:hidden;}
html[data-claude-chat-look='true'] [data-claude-annotate-menu] > button[aria-checked='true'] [data-claude-annotate-check]{visibility:visible;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty]{gap:0!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] > i.codicon-globe{font-size:22px!important;width:22px!important;height:22px!important;margin-bottom:14px;color:var(--claude-color-text-tertiary,var(--ui-text-tertiary))!important;opacity:1!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] > p{max-width:320px!important;font-size:0!important;line-height:0!important;text-align:center!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] > p::before{content:'Browse with Hermes';display:block;margin-bottom:6px;color:var(--ui-text-primary);font-size:14px;font-weight:600;line-height:20px;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser) [data-claude-browser-empty] > p::after{content:'Type a URL or ask Hermes to open a site. Hermes can read, click, and type.';display:block;color:var(--claude-color-text-secondary,var(--ui-text-secondary));font-size:13px;line-height:19px;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser)[data-claude-viewport] div:has(> webview){justify-content:center!important;align-items:flex-start!important;overflow:auto!important;background:var(--claude-browser-backdrop,var(--claude-browser-background))!important;}
html[data-claude-chat-look='true'] aside[data-preview-browser]:not(#claude-browser)[data-claude-viewport] webview{flex:0 0 var(--claude-viewport-width)!important;width:var(--claude-viewport-width)!important;min-width:var(--claude-viewport-width)!important;height:var(--claude-viewport-height)!important;min-height:var(--claude-viewport-height)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] > [data-panel-header]:has(> [data-claude-browser-strip]:not(#claude-browser)){height:32px!important;min-height:32px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-tree-group] [data-zone-tabstrip][data-claude-browser-strip]:not(#claude-browser){height:32px!important;min-height:32px!important;align-items:center!important;padding:0 8px 0 4px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) > button[aria-label='Hide']{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:']{height:24px!important;min-height:24px!important;background:transparent!important;box-shadow:none!important;border:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] .pane-tab-content > span:first-child{display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] span.truncate{color:var(--claude-color-text-secondary,var(--ui-text-secondary))!important;font-size:13px!important;font-weight:400!important;letter-spacing:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] .pane-tab-content,html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] .pane-tab-content > span{width:auto!important;min-width:0!important;padding:0!important;margin:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] .pane-tab-content{padding:0 6px 0 8px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) button[aria-label='New tab'],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) button[aria-label='New tab'] > i{color:var(--ui-text-primary)!important;opacity:1!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'][aria-selected='true'] span.truncate{color:var(--ui-text-primary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-claude-blank] span.truncate{font-size:0!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-claude-blank] span.truncate::after{content:'New tab';font-size:13px;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) > [role='tablist']{align-items:center!important;gap:2px!important;overflow:hidden!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:']{position:relative!important;flex:0 1 auto!important;min-width:26px!important;max-width:180px!important;border-radius:6px!important;overflow:hidden!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] span.truncate{text-overflow:clip!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'][aria-selected='true']{background:var(--claude-color-active,var(--ui-row-active-background))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'][aria-selected='true'] .pane-tab-content{padding-right:28px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] > span:has(> button[aria-label='Close']){right:3px!important;width:22px!important;justify-content:center!important;opacity:0!important;pointer-events:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:']:is([aria-selected='true'],:hover,:focus-within) > span:has(> button[aria-label='Close']){opacity:1!important;pointer-events:auto!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close']{width:22px!important;background:transparent!important;border-radius:0!important;color:var(--claude-color-text-secondary,var(--ui-text-secondary))!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close']:hover{color:var(--ui-text-primary)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) button[aria-label='New tab'][data-claude-tab-limit],html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) button[aria-label='New tab'][data-claude-tab-limit] > i{color:var(--claude-color-text-tertiary,var(--ui-text-tertiary))!important;background:transparent!important;cursor:default!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-limit-tip]{position:fixed;z-index:2147483000;max-width:220px;padding:6px 9px;border-radius:8px;border:1px solid var(--claude-color-border,var(--ui-stroke-tertiary));background:var(--claude-color-elevated,var(--ui-editor-surface-background));color:var(--ui-text-primary);font-size:13px;line-height:1.35;pointer-events:none;box-shadow:0 4px 14px color-mix(in srgb,black 25%,transparent);}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-tab-limit-tip][hidden]{display:none;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close'] > i{font-size:14px!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-browser-strip]:not(#claude-browser) [role='tab'][data-tree-tab^='preview-tile:url:']:not([aria-selected='true']):is(:hover,:focus-within) .pane-tab-content{-webkit-mask-image:linear-gradient(to left,transparent 25px,black 36px)!important;mask-image:linear-gradient(to left,transparent 25px,black 36px)!important;}
html[data-claude-chat-look='true'][data-hermes-theme] [data-claude-terminal-header='browser-actions']{-webkit-app-region:no-drag;display:flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='browser'] [data-tree-split]:not([data-claude-preview-column] [data-tree-split]) > div:not([data-claude-preview-column]):not(:has([data-claude-preview-column])):not(:has([data-tree-group='grp-sessions'])){display:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='browser'] [data-tree-split] > [data-claude-preview-column]{flex:1 1 0%!important;max-width:none!important;}
html[data-claude-chat-look='true'][data-hermes-theme][data-claude-expanded='browser'] [data-claude-pane-tools]{visibility:hidden!important;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [role='separator'][class~='inset-y-0']{--claude-split-scale: .25;--claude-split-color: var(--claude-sidebar-divider, var(--ui-stroke-secondary));}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-aside-preview-browser"] > [role='separator'][class~='inset-y-0']{--claude-split-scale: .5;--claude-split-color: var(--claude-browser-divider);}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [role='separator'][class~='inset-y-0'] > span:first-child,html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-aside-preview-browser"] > [role='separator'][class~='inset-y-0'] > span:first-child{width:1px!important;left:1px!important;transform:scaleX(var(--claude-split-scale))!important;transform-origin:left center!important;opacity:1!important;background:var(--claude-split-color)!important;}
html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-grp-sessions"]:not([style*='display: none']) + div > [role='separator'][class~='inset-y-0'] > span:nth-child(2),html[data-claude-chat-look='true'] [data-tree-split] > div[data-claude-has~="child-tree-group-aside-preview-browser"] > [role='separator'][class~='inset-y-0'] > span:nth-child(2){opacity:0!important;}
`
function safeGet(key){
try{
return window.localStorage.getItem(key)
}catch{
return null
}
}
function safeSet(key,value){
try{
window.localStorage.setItem(key,value)
return true
}catch{
return false
}
}
function safeRemove(key){
try{
window.localStorage.removeItem(key)
}catch{
}
}
function profileScope(value){
return String(value || 'default')
}
function currentProfileScope(){
try{
return profileScope(host.state.profile.get())
}catch{
return 'default'
}
}
function currentRuntimeSessionId(){
try{
return String(host.state.activeSessionId.get()|| '')
}catch{
return ''
}
}
function routedStoredSessionId(){
return storedSessionIdFromHash(window.location.hash)
}
function storedSessionIdFromHash(hash){
try{
const raw=String(hash || '').match(/^#\/([^/?#]+)/)?.[1]|| ''
if(!raw)return ''
const decoded=decodeURIComponent(raw)
const reserved=new Set(['agents','command-center','cron','new','profiles','settings','starmap'])
return reserved.has(decoded)?'':decoded
}catch{
return ''
}
}
function isProvisionalTurn(pair){
const messageId=pair.querySelector(':scope > [data-role="user"]')?.getAttribute('data-message-id')|| ''
return !messageId || /^user-(?:inflight|queued|pending)(?:-|$)/i.test(messageId)
}
function currentTurnScope(){
return{profile:currentProfileScope(),routeId:routedStoredSessionId()}
}
function turnStorageKey(pair){
const user=pair.querySelector(':scope > [data-role="user"]')
if(!user || isProvisionalTurn(pair))return null
const messageId=userMessageId(pair)
if(!messageId)return null
const scope=currentTurnScope()
const sessionId=scope.routeId || currentRuntimeSessionId()
if(!sessionId)return null
const profile=encodeURIComponent(scope.profile)
const session=encodeURIComponent(sessionId)
return `${STORAGE_PREFIX}${profile}:${session}:${encodeURIComponent(messageId)}`
}
function userMessageId(pair){
return pair.querySelector(':scope > [data-role="user"]')?.getAttribute('data-message-id')|| ''
}
const IMAGE_ATTACHMENT_MARKER_RE=/(?:^|\n)[ \t]*\[Image attached at:\s*[^\]\r\n]+\][ \t]*(?=\n|$)|\[Image attached at:\s*[^\]\r\n]+\]/gi
function hasRenderedImageAttachment(user){
const attachmentRow=user?.nextElementSibling
if(!attachmentRow || attachmentRow.matches('[data-role="assistant"], [data-role="user"]'))return false
return Boolean(
attachmentRow.querySelector(
'img[slot="aui_directive-image"], img[slot="aui_embedded-image"], [data-slot="aui_embedded-images"] img'
)
)
}
function stripImageAttachmentMarker(pair){
const user=pair.querySelector(':scope > [data-role="user"]')
const messageText=user?.querySelector('[data-slot="aui_user-message-text"]')
if(!user || !messageText || !hasRenderedImageAttachment(user))return
const walker=document.createTreeWalker(messageText,NodeFilter.SHOW_TEXT)
const textNodes=[]
while(walker.nextNode())textNodes.push(walker.currentNode)
for(const node of textNodes){
if(node.parentElement?.closest('code, pre, [data-claude-image-marker]'))continue
const current=node.nodeValue || ''
const matches=[...current.matchAll(new RegExp(IMAGE_ATTACHMENT_MARKER_RE.source,IMAGE_ATTACHMENT_MARKER_RE.flags))]
for(const match of matches.reverse()){
const marker=node.splitText(match.index)
marker.splitText(match[0].length)
const wrapper=document.createElement('span')
wrapper.setAttribute('data-claude-image-marker','true')
marker.replaceWith(wrapper)
wrapper.appendChild(marker)
}
}
}
function clearImageAttachmentMarkers(){
for(const wrapper of document.querySelectorAll('[data-claude-image-marker]')){
wrapper.replaceWith(...wrapper.childNodes)
}
}
function longUserStateKey(pair){
if(isProvisionalTurn(pair))return null
const key=turnStorageKey(pair)
return key?`${key}${LONG_USER_STATE_SUFFIX}`:null
}
function readLongUserExpanded(pair){
const key=longUserStateKey(pair)
if(!key)return false
try{
return JSON.parse(safeGet(key)|| 'null')?.expanded===true
}catch{
return false
}
}
function pruneLongUserStates(){
try{
const records=Object.keys(window.localStorage)
.filter(key=> key.startsWith(STORAGE_PREFIX)&& key.endsWith(LONG_USER_STATE_SUFFIX))
.map(key=>{
try{
return{key,touchedAt:Number(JSON.parse(safeGet(key)|| '{}').touchedAt)|| 0}
}catch{
return{key,touchedAt:0}
}
})
.sort((left,right)=> right.touchedAt - left.touchedAt)
for(const record of records.slice(MAX_PERSISTED_LONG_USER_STATES))safeRemove(record.key)
}catch{
}
}
function writeLongUserExpanded(pair,expanded){
const key=longUserStateKey(pair)
if(!key)return
if(!expanded){
safeRemove(key)
return
}
safeSet(key,JSON.stringify({expanded:true,touchedAt:Date.now()}))
pruneLongUserStates()
}
function clearLongUserDecoration(user){
user?.removeAttribute('data-claude-long-user')
user?.removeAttribute('data-claude-user-expanded')
for(const control of user?.querySelectorAll?.('[data-claude-user-expand]')||[])control.remove()
}
function longUserLabels(){
return{more:'Show more',less:'Show less'}
}
function decorateLongUserMessage(pair){
const user=pair.querySelector(':scope > [data-role="user"]')
const clamp=user?.querySelector('.sticky-human-clamp')
const bubble=clamp?.closest('.composer-human-message')
const host=bubble?.parentElement
if(!user || !clamp || !bubble || !host){
if(user)clearLongUserDecoration(user)
return
}
const inner=clamp.firstElementChild
const lineHeight=18
const measuredHeight=Number.parseFloat(clamp.style.getPropertyValue('--human-msg-full'))
const fullHeight=Number.isFinite(measuredHeight)&& measuredHeight > 0?measuredHeight:inner?.scrollHeight || 0
if(fullHeight <=lineHeight * 4 + 1){
clearLongUserDecoration(user)
return
}
user.setAttribute('data-claude-long-user','true')
let control=host.querySelector(':scope > [data-claude-user-expand]')
let persistedExpanded=false
if(!control){
persistedExpanded=readLongUserExpanded(pair)
control=document.createElement('button')
control.type='button'
control.setAttribute('data-claude-user-expand','true')
const label=document.createElement('span')
label.setAttribute('data-claude-user-expand-label','true')
const chevron=document.createElement('span')
chevron.setAttribute('data-claude-user-chevron','true')
chevron.setAttribute('aria-hidden','true')
control.append(label,chevron)
control.addEventListener('pointerdown',event=> event.stopPropagation())
control.addEventListener('click',event=>{
event.preventDefault()
event.stopPropagation()
const expanded=user.getAttribute('data-claude-user-expanded')!=='true'
if(expanded)user.setAttribute('data-claude-user-expanded','true')
else user.removeAttribute('data-claude-user-expanded')
writeLongUserExpanded(pair,expanded)
const labels=longUserLabels()
label.textContent=expanded?labels.less:labels.more
control.setAttribute('aria-expanded',String(expanded))
control.title=expanded?labels.less:labels.more
})
host.appendChild(control)
}
const expanded=user.getAttribute('data-claude-user-expanded')==='true' || persistedExpanded
if(expanded)user.setAttribute('data-claude-user-expanded','true')
else user.removeAttribute('data-claude-user-expanded')
const labels=longUserLabels()
control.querySelector('[data-claude-user-expand-label]').textContent=expanded?labels.less:labels.more
control.setAttribute('aria-expanded',String(expanded))
control.title=expanded?labels.less:labels.more
}
function decorateComposerChrome(){
const surface=document.querySelector('[data-slot="composer-surface"]')
const dock=document.querySelector('[data-slot="composer-dock"]')|| surface?.closest('[data-slot="composer-root"]')
if(!surface || !dock)return
for(const statusDock of document.querySelectorAll('[data-slot="composer-dock"], [data-slot="composer-root"]')){
const nativeStatusStack=[...statusDock.querySelectorAll('[data-slot="composer-status-stack"]')]
.find(stack=> stack.closest('[data-slot="composer-dock"], [data-slot="composer-root"]')===statusDock)
||(statusDock.matches('[data-slot="composer-root"]')
?statusDock.querySelector(':scope > div.absolute.inset-x-0.bottom-full')
:[...statusDock.children].find(element=>{
const className=typeof element.className==='string'?element.className:''
return className.includes('max-h-')&& className.includes('overflow-y-auto')
}))
const statusStack=nativeStatusStack ||[...statusDock.querySelectorAll('div')].find(element=>{
const className=typeof element.className==='string'?element.className:''
return className.includes('bottom-full')&& className.includes('absolute')&& !element.closest('[data-slot="composer-completion-drawer"]')&& element.getBoundingClientRect().width > 300
})
if(!statusStack)continue
const statusCard=statusStack.querySelector('[data-slot="status-stack-content"]')|| statusStack.firstElementChild
statusCard?.setAttribute('data-claude-status-card','true')
const taskSection=statusCard
?[...statusCard.querySelectorAll(':scope > div')].find(section=> section.querySelector('.codicon-checklist'))
:null
for(const section of statusCard?.querySelectorAll(':scope > div')||[]){
if(section===taskSection)section.setAttribute('data-claude-task-section','true')
else section.removeAttribute('data-claude-task-section')
}
if(taskSection)statusStack.setAttribute('data-claude-has-task-section','true')
else statusStack.removeAttribute('data-claude-has-task-section')
taskSection?.setAttribute('data-claude-task-section','true')
}
const editBanner=[...surface.querySelectorAll('[data-slot="composer-fade"] > div')].find(element=>
element.matches('.flex.items-center.justify-between.gap-2.rounded-lg.border')
&& element.querySelectorAll(':scope > div:last-child > button').length===2
)
editBanner?.setAttribute('data-claude-edit-banner','true')
const contextMenu=[...document.querySelectorAll('[data-slot="dropdown-menu-content"][role="menu"]')].find(menu=>{
const text=menu.textContent || ''
return /Prompt snippets|Extraits de prompt/i.test(text)&& /Files|Fichiers/i.test(text)
})
if(!contextMenu)return
contextMenu.setAttribute('data-claude-context-menu','true')
}
function clearComposerChromeDecorations(){
for(const element of document.querySelectorAll('[data-claude-context-menu], [data-claude-status-card], [data-claude-edit-banner], [data-claude-task-section], [data-claude-has-task-section]')){
element.removeAttribute('data-claude-context-menu')
element.removeAttribute('data-claude-status-card')
element.removeAttribute('data-claude-edit-banner')
element.removeAttribute('data-claude-task-section')
element.removeAttribute('data-claude-has-task-section')
}
}
function readComposerWidthMode(){
try{
const mode=pluginStorage?.get(COMPOSER_WIDTH_STORAGE_KEY,'claude')
return typeof mode==='string' && Object.hasOwn(COMPOSER_WIDTH_MODES,mode)?mode:'claude'
}catch{
return 'claude'
}
}
function syncComposerWidthRoot(){
const mode=readComposerWidthMode()
const root=document.documentElement
root.setAttribute('data-claude-composer-width',mode)
return mode
}
function setComposerWidthMode(mode){
const normalized=typeof mode==='string' && Object.hasOwn(COMPOSER_WIDTH_MODES,mode)?mode:'claude'
pluginStorage?.set(COMPOSER_WIDTH_STORAGE_KEY,normalized)
syncComposerWidthRoot()
window.requestAnimationFrame(()=> decorateComposerChrome())
}
function readPinnedUserMessagesMode(){
try{
const mode=pluginStorage?.get(PINNED_USER_MESSAGES_STORAGE_KEY,'hermes')
return mode==='off'?'off':'hermes'
}catch{
return 'hermes'
}
}
function syncPinnedUserMessagesRoot(){
const mode=readPinnedUserMessagesMode()
document.documentElement.setAttribute('data-claude-pinned-user-messages',mode)
return mode
}
function setPinnedUserMessagesMode(mode){
const normalized=mode==='off'?'off':'hermes'
pluginStorage?.set(PINNED_USER_MESSAGES_STORAGE_KEY,normalized)
syncPinnedUserMessagesRoot()
}
function readCleanTranscriptMode(){
try{
const mode=pluginStorage?.get(CLEAN_TRANSCRIPT_STORAGE_KEY,'off')
return mode==='on'?'on':'off'
}catch{
return 'off'
}
}
function syncCleanTranscriptRoot(){
const mode=readCleanTranscriptMode()
document.documentElement.setAttribute('data-claude-clean-transcript',mode)
return mode
}
function setCleanTranscriptMode(mode){
const normalized=mode==='on'?'on':'off'
pluginStorage?.set(CLEAN_TRANSCRIPT_STORAGE_KEY,normalized)
syncCleanTranscriptRoot()
window.dispatchEvent(new window.Event(CLEAN_TRANSCRIPT_EVENT))
}
function seasonalAsciiScene(date=new Date()){
const month=date.getMonth()+ 1,day=date.getDate()
if(month===10 && day >=24)return 'halloween'
if(month===12 && day >=17 && day <=26)return 'christmas'
if((month===12 && day >=30)||(month===1 && day===1))return 'newyear'
return month <=2 || month===12?'winter':month <=5?'spring':month <=8?'summer':'autumn'
}
const asciiBackdropScene=(mode,date)=> mode==='auto'?seasonalAsciiScene(date):ASCII_BACKDROP_MODES[mode].scene
function asciiBackdropLabel(mode=readAsciiBackdropMode(),date){
if(mode !=='auto')return ASCII_BACKDROP_MODES[mode].label
const scene=seasonalAsciiScene(date)
return `Seasonal · ${Object.values(ASCII_BACKDROP_MODES).find(entry=> entry.scene===scene).label}`
}
function readAsciiBackdropMode(){
try{
const mode=pluginStorage?.get(ASCII_BACKDROP_STORAGE_KEY,'auto')
return typeof mode==='string' && Object.hasOwn(ASCII_BACKDROP_MODES,mode)?mode:'auto'
}catch{
return 'auto'
}
}
function syncAsciiBackdropRoot(date){
const mode=readAsciiBackdropMode(),scene=asciiBackdropScene(mode,date),root=document.documentElement
if(root.getAttribute('data-claude-ascii-glyphs')!==(scene?'on':'off'))root.setAttribute('data-claude-ascii-glyphs',scene?'on':'off')
if(!scene)root.removeAttribute('data-claude-ascii-scene')
else if(root.getAttribute('data-claude-ascii-scene')!==scene)root.setAttribute('data-claude-ascii-scene',scene)
return mode
}
function setAsciiBackdropMode(mode){
pluginStorage?.set(ASCII_BACKDROP_STORAGE_KEY,Object.hasOwn(ASCII_BACKDROP_MODES,mode)?mode:'auto')
syncAsciiBackdropRoot()
}
function clearCleanTranscriptDecorations(scope=document){
const pairs=scope?.matches?.('[data-slot="aui_turn-pair"]')
?[scope]
:[...(scope?.querySelectorAll?.('[data-slot="aui_turn-pair"]')||[])]
for(const pair of pairs){
pair.removeAttribute('data-claude-clean-settled')
for(const element of pair.querySelectorAll('[data-claude-clean-interim], [data-claude-clean-interim-part]')){
element.removeAttribute('data-claude-clean-interim')
element.removeAttribute('data-claude-clean-interim-part')
}
}
}
function cleanPairActive(pair){
const doc=pair.ownerDocument
if(doc.querySelector('[data-slot="tool-approval-stack"]')&&[...doc.querySelectorAll('[data-slot="aui_turn-pair"]')].at(-1)===pair)return true
return Boolean(
pair.querySelector(
'[data-role="assistant"][data-streaming="true"], '
+ '[role="status"], '
+ '[data-slot="tool-approval-inline"], '
+ '[data-slot="clarify-inline"], '
+ '[data-slot="mcp-setup-inline"], '
+ '[data-slot="connector-card"], '
+ '[data-connector-offer]'
)
)
}
function cleanRootHasMeaningfulContent(root){
const content=root.querySelector('[data-slot="aui_assistant-message-content"]')
if((content?.textContent || '').trim())return true
if((root.textContent || '').trim())return true
return Boolean(
root.querySelector(
'[data-slot="tool-block"], '
+ '[data-slot="aui_thinking-disclosure"], '
+ '[data-slot="aui_generated-image"], '
+ '[data-slot="aui_artifact-card"], '
+ '[data-slot="aui_changed-files"], '
+ '[data-slot="clarify-inline"], '
+ '[data-slot="mcp-setup-inline"], '
+ '[data-slot="connector-card"], '
+ '[data-connector-offer], '
+ '[role="alert"]'
)
)
}
function cleanRootMustStayVisible(root){
return Boolean(
root.querySelector(
'[data-slot="aui_generated-image"], '
+ '[data-slot="aui_artifact-card"], '
+ '[data-slot="clarify-inline"], '
+ '[data-slot="mcp-setup-inline"], '
+ '[data-slot="connector-card"], '
+ '[data-connector-offer], '
+ '[data-slot="tool-approval-inline"], '
+ '[data-slot="tool-approval-card"], '
+ '[role="alert"]'
)
)
}
function cleanPartMustStayVisible(part){
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
function reconcileCleanTranscript(pair){
clearCleanTranscriptDecorations(pair)
if(document.documentElement.getAttribute('data-claude-clean-transcript')!=='on')return
if(cleanPairActive(pair))return
const roots=[...pair.querySelectorAll('[data-role="assistant"][data-slot="aui_assistant-message-root"]')]
.filter(root=> root.closest('[data-slot="aui_turn-pair"]')===pair)
const finalIndex=roots.findLastIndex(root=> Boolean(root.querySelector('[data-slot="aui_msg-actions"]')))
if(finalIndex < 0)return
/* An empty trailing shell is a harmless renderer remnant. Any actual content
     after the identified final is uncertain, so keep the whole turn visible. */
if(roots.slice(finalIndex + 1).some(cleanRootHasMeaningfulContent))return
pair.setAttribute('data-claude-clean-settled','true')
for(const root of roots.slice(0,finalIndex)){
if(!cleanRootMustStayVisible(root))root.setAttribute('data-claude-clean-interim','true')
}
/* Hydrated history folds the live turn's separate assistant bubbles into one
     message containing several markdown parts. Keep the last text part as the
     final answer and hide earlier commentary plus its timestamp. */
const finalRoot=roots[finalIndex]
const content=finalRoot.querySelector(':scope > [data-slot="aui_assistant-message-content"]')
const markdownParts=[...(content?.children ||[])].filter(element=> element.matches('.aui-md'))
for(const part of markdownParts.slice(0,-1)){
if(cleanPartMustStayVisible(part))continue
part.setAttribute('data-claude-clean-interim-part','true')
const timestamp=part.previousElementSibling
if(timestamp?.matches?.('[data-slot="timeline-timestamp"]')){
timestamp.setAttribute('data-claude-clean-interim-part','true')
}
}
}
function collectNestedTurnPairs(node){
if(!(node instanceof Element))return[]
if(node.matches('[data-slot="sidebar"]')|| node.closest?.('[data-slot="sidebar"]'))return[]
if(node.matches('[data-slot="aui_turn-pair"]'))return[node]
const pairs=[]
const descendants=[...node.children]
for(let index=0;index < descendants.length;index +=1){
const current=descendants[index]
if(current.matches('[data-slot="aui_turn-pair"]')){
pairs.push(current)
continue
}
descendants.push(...current.children)
}
return pairs
}
function isCleanPartMutationNode(node){
if(!(node instanceof Element))return false
const selector='.aui-md, [data-slot="aui_assistant-message-content"]'
return node.matches(selector)|| Boolean(node.firstElementChild && node.querySelector(selector))
}
function isTurnPairMutationRoot(node){
if(!(node instanceof Element))return false
if(node.matches('[data-slot="sidebar"]')|| node.closest?.('[data-slot="sidebar"]'))return false
if(node.matches('[data-session-anchor], [data-slot="aui_turn-pair"], [data-slot="aui_thread-content"]'))return true
const insideTranscript=node.closest?.('[data-session-anchor], [data-slot="aui_thread-content"]')
return Boolean(insideTranscript && node.firstElementChild && node.querySelector('[data-slot="aui_turn-pair"]'))
}
function historyPreviewFragment(source){
const fragment=document.createDocumentFragment()
let remaining=600
let visited=0
const copy=(node,parent)=>{
if(remaining <=0 || ++visited > 160)return
if(node.nodeType===3){
const text=(node.nodeValue || '').slice(0,remaining)
remaining -=text.length
parent.appendChild(document.createTextNode(text))
return
}
if(!(node instanceof Element)|| node.matches('script, style, button, svg, img, video, audio, iframe, [aria-hidden="true"]'))return
const tag=node.tagName.toLowerCase()
const destination=['p','strong','b','em','i','code','br'].includes(tag)?document.createElement(tag):parent
if(destination !==parent)parent.appendChild(destination)
for(const child of node.childNodes)copy(child,destination)
}
for(const child of source.childNodes)copy(child,fragment)
if(!remaining)fragment.appendChild(document.createTextNode('…'))
return fragment
}
function historyPromptPreview(text){
const collapsed=String(text || '').replace(/\s+/g,' ').trim()
return collapsed.length > 120?`${collapsed.slice(0,119).trimEnd()}…`:collapsed
}
function historyTranscriptEntries(messages){
const entries=[]
let turn=null
for(const message of messages ||[]){
if(typeof message?.text !=='string')continue
if(message.display_kind && message.display_kind !=='skill_invocation')continue
const text=message.text.trim()
if(message.role==='user'){
if(!text || /^\[IMPORTANT: Background process [\s\S]*\]$/.test(text))continue
turn={question:text,answer:''}
entries.push(turn)
}else if(message.role==='assistant' && turn && text){
turn.answer=text.slice(0,600)
}
}
return entries
}
function historyPlainFragment(text){
const fragment=document.createDocumentFragment()
for(const paragraph of text.slice(0,600).split(/\n\s*\n/).slice(0,5)){
const p=document.createElement('p')
for(const token of paragraph.split(/(\*\*[^*]+\*\*)/g)){
const node=document.createElement(token.startsWith('**')&& token.endsWith('**')?'strong':'span')
node.textContent=node.tagName==='STRONG'?token.slice(2,-2):token
p.appendChild(node)
}
fragment.appendChild(p)
}
return fragment
}
const HISTORY_EARLIER_TIMELINE_ID='__earlier-history__'
function installHistoryRailRuntime(){
const selector='[data-slot="thread-timeline"]'
const rails=new Map()
let serial=0
const mount=root=>{
if(rails.has(root))return
const surface=root.closest('[data-session-anchor]')
const strip=root.querySelector('[data-slot="thread-timeline-ticks"]')
if(!surface || !strip)return
const card=document.createElement('div')
card.setAttribute('data-claude-history-preview','')
card.setAttribute('data-suppress-pane-reveal','')
card.setAttribute('role','tooltip')
card.id=`claude-history-preview-${++serial}`
card.hidden=true
const question=document.createElement('div')
question.setAttribute('data-claude-history-question','')
const answer=document.createElement('div')
answer.setAttribute('data-claude-history-answer','')
card.append(question,answer)
surface.appendChild(card)
root.setAttribute('data-claude-history-rail','')
let buttons=[]
let hovered=null
let closeTimer=0
let revision=0
let historyCache=null
let labels=''
let waveFrame=0
let waveY=0
let waveGeometry=null
let keyboardNavigation=false
const cancelClose=()=> window.clearTimeout(closeTimer)
const queueWave=y=>{
waveY=y
if(waveFrame)return
waveFrame=window.requestAnimationFrame(()=>{
waveFrame=0
if(!hovered || !buttons.length)return
if(!waveGeometry){
const first=buttons[0].getBoundingClientRect()
if(!first.height)return
const pitch=buttons.length > 1?buttons[1].getBoundingClientRect().top - first.top:first.height
waveGeometry={top:first.top,height:first.height,pitch}
}
const{top,height,pitch}=waveGeometry
const radius=Math.max(height,pitch)* 3.2
buttons.forEach((tick,index)=>{
const distance=Math.abs(top + height / 2 + index * pitch - waveY)
const phase=Math.min(1,distance / radius)
const width=6 + 10 *(1 + Math.cos(Math.PI * phase))
tick.style.setProperty('--claude-history-tick-width',`${width}px`)
})
})
}
const close=(resetWave=true)=>{
revision +=1
waveGeometry=null
cancelClose()
window.cancelAnimationFrame(waveFrame)
waveFrame=0
if(hovered){
const rest=(hovered.getAttribute('aria-describedby')|| '').split(/\s+/).filter(id=> id && id !==card.id).join(' ')
if(rest)hovered.setAttribute('aria-describedby',rest)
else hovered.removeAttribute('aria-describedby')
}
hovered=null
if(!card.hidden)card.hidden=true
question.textContent=''
answer.replaceChildren()
root.removeAttribute('data-claude-history-open')
for(const button of buttons){
if(resetWave !==false)button.style.removeProperty('--claude-history-tick-width')
button.removeAttribute('data-claude-history-hover')
}
}
const refresh=()=>{
const next=[...strip.querySelectorAll('.thread-timeline-tick')]
.filter(button=> button.closest('[data-slot="thread-timeline-ticks"]')===strip)
const nextLabels=JSON.stringify(next.map(button=> button.getAttribute('aria-label')))
if(nextLabels !==labels || next.length !==buttons.length || next.some((b,i)=> b !==buttons[i])){
waveGeometry=null
close()
}
labels=nextLabels
buttons=next
if(!waveGeometry && buttons.length){
const first=buttons[0].getBoundingClientRect()
if(first.height){
const pitch=buttons.length > 1?buttons[1].getBoundingClientRect().top - first.top:first.height
waveGeometry={top:first.top,height:first.height,pitch}
}
}
}
const position=()=>{
if(!hovered || card.hidden)return
const boundary=surface.getBoundingClientRect()
const tick=hovered.getBoundingClientRect()
const edge=root.getBoundingClientRect().left - boundary.left + 36
card.style.left=`${edge}px`
card.style.width=`${Math.max(0,Math.min(320,boundary.width - edge - 8))}px`
card.style.maxHeight=`${Math.max(0,boundary.height - 16)}px`
const height=card.getBoundingClientRect().height
card.style.top=`${Math.max(8,Math.min(boundary.height - height - 8,tick.top + tick.height / 2 - boundary.top - height / 2))}px`
}
const timelineIndex=tick=>{
const value=Number.parseInt(tick.getAttribute('data-timeline-index')??'',10)
return Number.isInteger(value)?value:buttons.indexOf(tick)
}
const fillUnloaded=button=>{
if(surface.getAttribute('data-session-anchor')!=='workspace' || typeof host.request !=='function')return
const sessionId=currentRuntimeSessionId()
if(!sessionId)return
const scope=JSON.stringify([sessionId,currentProfileScope(),routedStoredSessionId(),labels])
const expectedRevision=revision
if(!historyCache || historyCache.scope !==scope || Date.now()- historyCache.time > 20000){
historyCache={scope,time:Date.now(),promise:Promise.resolve().then(()=> host.request('session.history',{session_id:sessionId})).then(result=> historyTranscriptEntries(result?.messages))}
}
historyCache.promise.then(entries=>{
if(revision !==expectedRevision || hovered !==button || !root.isConnected || card.hidden)return
if(JSON.stringify([currentRuntimeSessionId(),currentProfileScope(),routedStoredSessionId(),labels])!==scope)return
const track=button.closest('.thread-timeline-track')
const pitch=button.getBoundingClientRect().height
const total=track && pitch?Math.round(track.getBoundingClientRect().height / pitch):buttons.length
if(entries.length !==total || buttons.some(tick=> tick.getAttribute('data-timeline-id')===HISTORY_EARLIER_TIMELINE_ID
|| historyPromptPreview(entries[timelineIndex(tick)]?.question??'')!==tick.getAttribute('aria-label')))return
const entry=entries[timelineIndex(button)]
question.textContent=entry.question
answer.replaceChildren(historyPlainFragment(entry.answer))
answer.hidden=!entry.answer
position()
}).catch(()=>{ /* Keep the native question preview on missing history. */})
}
const show=(button,pointerY=null)=>{
cancelClose()
if(button===hovered){
if(pointerY !==null)queueWave(pointerY)
return
}
for(const[otherRoot,state]of rails)state.close(otherRoot !==root)
refresh()
const index=buttons.indexOf(button)
if(index < 0)return
hovered=button
button.setAttribute('aria-describedby',[button.getAttribute('aria-describedby'),card.id].filter(Boolean).join(' '))
root.setAttribute('data-claude-history-open','')
buttons.forEach((tick,i)=>{
tick.toggleAttribute('data-claude-history-hover',i===index)
})
const rect=button.getBoundingClientRect()
queueWave(pointerY??rect.top + rect.height / 2)
question.textContent=button.getAttribute('aria-label')|| ''
answer.replaceChildren()
const viewport=surface.querySelector('[data-slot="aui_thread-viewport"]')
const users=[...(viewport?.querySelectorAll('[data-slot="aui_user-message-root"]')||[])]
.map(user=>({user,text:user.querySelector('[data-slot="aui_user-message-text"]')?.textContent || ''}))
.filter(row=> row.text.trim()&& !/^\[IMPORTANT: Background process [\s\S]*\]$/.test(row.text.trim()))
const offset=buttons.length - users.length
const aligned=offset >=0 && users.every((row,i)=> historyPromptPreview(row.text)===buttons[offset + i].getAttribute('aria-label'))
const row=aligned && users[index - offset]
const pair=row?.user?.closest('[data-slot="aui_turn-pair"]')
if(pair){
question.textContent=row.text
const roots=[...pair.querySelectorAll('[data-role="assistant"][data-slot="aui_assistant-message-root"]')]
.filter(root=> root.closest('[data-slot="aui_turn-pair"]')===pair)
const final=roots.findLast(node=> node.querySelector('[data-slot="aui_msg-actions"]'))|| roots.at(-1)
const parts=final?.querySelectorAll('[data-slot="aui_assistant-message-content"] > .aui-md')
const text=parts?.[parts.length - 1]
if(text)answer.appendChild(historyPreviewFragment(text))
}
answer.hidden=!answer.textContent.trim()
card.hidden=false
position()
if(!pair)fillUnloaded(button)
}
const onOver=event=>{
event.stopPropagation()
keyboardNavigation=false
const button=event.target.closest?.('button')
if(buttons.includes(button))show(button,event.clientY)
}
const onMove=event=>{
event.stopPropagation()
keyboardNavigation=false
if(hovered && strip.contains(event.target))queueWave(event.clientY)
}
const onLeave=event=>{
if(root.contains(event.relatedTarget)|| card.contains(event.relatedTarget))return
cancelClose()
closeTimer=window.setTimeout(close,120)
}
const onOut=event=>{
event.stopPropagation()
onLeave(event)
}
const onFocus=event=>{if(buttons.includes(event.target))show(event.target)}
const onKey=event=>{
if(event.key==='Escape'){close();event.stopPropagation();return}
if(/^(Arrow(Up|Down)|Home|End)$/.test(event.key))keyboardNavigation=true
}
root.addEventListener('mouseover',onOver,true)
root.addEventListener('pointermove',onMove,{passive:true})
root.addEventListener('mouseout',onOut,true)
root.addEventListener('focusin',onFocus)
root.addEventListener('focusout',onLeave)
root.addEventListener('keydown',onKey)
const onScroll=()=>{
waveGeometry=null
const focused=document.activeElement
if(!keyboardNavigation || !strip.contains(focused)){close();return}
refresh()
if(!buttons.includes(focused))close()
else if(focused===hovered)position()
else show(focused)
}
strip.addEventListener('scroll',onScroll,{passive:true})
card.addEventListener('mouseover',cancelClose)
card.addEventListener('mouseout',onOut)
const resize=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{
root.style.setProperty('--claude-history-rail-height',`${Math.max(10,entries[0].contentRect.height - 32)}px`)
waveGeometry=null
close()
}):null
resize?.observe(surface)
const cleanup=()=>{
close()
historyCache=null
resize?.disconnect()
root.removeEventListener('mouseover',onOver,true)
root.removeEventListener('pointermove',onMove)
root.removeEventListener('mouseout',onOut,true)
root.removeEventListener('focusin',onFocus)
root.removeEventListener('focusout',onLeave)
root.removeEventListener('keydown',onKey)
strip.removeEventListener('scroll',onScroll)
root.removeAttribute('data-claude-history-rail')
root.style.removeProperty('--claude-history-rail-height')
card.remove()
}
rails.set(root,{close,cleanup,refresh,surface,invalidate:()=>{close();historyCache=null}})
refresh()
}
const scan=node=>{
if(!(node instanceof Element))return
if(node.matches(selector))mount(node)
if(node.firstElementChild)node.querySelectorAll(selector).forEach(mount)
}
const nativeTip='[data-slot="tooltip-content"]'
const markNativeTips=()=>{
for(const tip of document.querySelectorAll(nativeTip)){
const id=tip.querySelector('[role="tooltip"][id]')?.id
const fromRail=Boolean(id)&&[...rails.keys()].some(root=>[...root.querySelectorAll('.thread-timeline-tick[aria-describedby]')]
.some(tick=> tick.getAttribute('aria-describedby').split(/\s+/).includes(id)))
if(tip.hasAttribute('data-claude-history-native-tip')!==fromRail)tip.toggleAttribute('data-claude-history-native-tip',fromRail)
}
}
document.querySelectorAll(selector).forEach(mount)
const closeAll=()=>{for(const state of rails.values())state.close()}
window.addEventListener('resize',closeAll)
window.addEventListener('hashchange',closeAll)
const invalidateAll=()=>{for(const state of rails.values())state.invalidate()}
const subscriptions=['activeSessionId','profile','gateway']
.map(key=> host.state[key]?.subscribe?.(invalidateAll))
.filter(unsubscribe=> typeof unsubscribe==='function')
return{
observe(records){
let tipAdded=false
for(const record of records){
const root=record.target.closest?.(selector)
if(record.type==='childList')for(const node of record.addedNodes){
scan(node)
if(node instanceof Element &&(node.matches(nativeTip)||(node.firstElementChild && node.querySelector(nativeTip))))tipAdded=true
}
if(root){mount(root);rails.get(root)?.refresh()}
}
if(tipAdded)markNativeTips()
for(const[root,state]of rails){
if(!root.isConnected || root.closest('[data-session-anchor]')!==state.surface){
state.cleanup();rails.delete(root)
}
}
},
cleanup(){
window.removeEventListener('resize',closeAll)
window.removeEventListener('hashchange',closeAll)
subscriptions.forEach(unsubscribe=> unsubscribe())
for(const state of rails.values())state.cleanup()
rails.clear()
for(const tip of document.querySelectorAll('[data-claude-history-native-tip]'))tip.removeAttribute('data-claude-history-native-tip')
}
}
}
function installComposerOverflowRuntime(){
const selector='[data-slot="composer-surface"] [data-slot="composer-rich-input"]'
const attribute='data-claude-composer-overflow'
const editors=new Set()
const sync=editor=>{
const overflowing=editor.clientHeight > 0 && editor.scrollHeight > editor.clientHeight
if(editor.hasAttribute(attribute)!==overflowing)editor.toggleAttribute(attribute,overflowing)
}
const observer=new window.ResizeObserver(entries=>{
for(const{target}of entries)if(editors.has(target))sync(target)
})
return{
refresh(){
for(const editor of editors){
if(editor.isConnected && editor.matches(selector))continue
observer.unobserve(editor)
editor.removeAttribute(attribute)
editors.delete(editor)
}
for(const editor of document.querySelectorAll(selector)){
if(editors.has(editor))continue
editors.add(editor)
sync(editor)
observer.observe(editor)
}
},
cleanup(){
observer.disconnect()
for(const editor of editors)editor.removeAttribute(attribute)
editors.clear()
}
}
}
function installBehaviorRuntime(afterFinalCleanup=null){
const pendingHandoff=window[RUNTIME_HANDOFF_KEY]
if(pendingHandoff?.timer)window.clearTimeout(pendingHandoff.timer)
if(pendingHandoff)delete window[RUNTIME_HANDOFF_KEY]
const historyRail=installHistoryRailRuntime()
const composerOverflow=installComposerOverflowRuntime()
let scheduled=false
let animationFrame=0
let processAllPairs=true
let historicalPairScanPending=false
let pairWorkHandle=0
let pairWorkUsesIdleCallback=false
let composerDirty=true
let destroyed=false
const dirtyPairs=new Set()
const animatedPlaybackNodes=new WeakSet()
const playbackAnimationTimers=new Set()
const audioLaneDocks=new Set()
const playbackReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)')
const PAIR_WORK_BATCH_SIZE=8
const threadViewports=new Map()
function composerFadeForDock(dock){
const composer=dock?.querySelector?.(':scope > [data-slot="composer-root"]')
return composer?.querySelector('[data-slot="composer-fade"]')|| null
}
function syncAudioLaneGeometry(dock){
if(destroyed || !(dock instanceof Element)|| !dock.isConnected)return
const fade=composerFadeForDock(dock)
if(!fade)return
const hasAudioRow=Boolean(fade.querySelector(':scope > [data-claude-playback-floating="true"]'))
if(!hasAudioRow){
fade.style.removeProperty('--claude-audio-lane-top')
fade.removeAttribute('data-claude-audio-lane')
return
}
const dockRect=dock.getBoundingClientRect()
const fadeRect=fade.getBoundingClientRect()
if(dockRect.width <=0 || fadeRect.width <=0)return
const laneTop=dockRect.top - fadeRect.top
const next=`${laneTop}px`
if(fade.style.getPropertyValue('--claude-audio-lane-top')!==next){
fade.style.setProperty('--claude-audio-lane-top',next)
}
fade.setAttribute('data-claude-audio-lane','true')
}
const audioLaneResizeObserver=new window.ResizeObserver(entries=>{
if(destroyed)return
for(const entry of entries)syncAudioLaneGeometry(entry.target)
})
function refreshAudioLaneDocks(){
const current=new Set(document.querySelectorAll('[data-slot="composer-dock"]'))
for(const dock of audioLaneDocks){
if(current.has(dock)&& dock.isConnected)continue
audioLaneResizeObserver.unobserve(dock)
audioLaneDocks.delete(dock)
}
for(const dock of current){
if(!audioLaneDocks.has(dock)){
audioLaneDocks.add(dock)
audioLaneResizeObserver.observe(dock)
}
syncAudioLaneGeometry(dock)
}
}
function clearAudioLaneGeometry(){
audioLaneResizeObserver.disconnect()
audioLaneDocks.clear()
for(const fade of document.querySelectorAll('[data-claude-audio-lane]')){
fade.style.removeProperty('--claude-audio-lane-top')
fade.removeAttribute('data-claude-audio-lane')
}
}
function playbackStatusesIn(node){
if(!(node instanceof Element))return[]
const statuses=[]
if(
node.matches('[role="status"][aria-live="polite"]')
&&(node.parentElement?.matches('[data-slot="composer-fade"]')|| node.hasAttribute('data-claude-playback-floating'))
)statuses.push(node)
for(const status of node.querySelectorAll('[role="status"][aria-live="polite"]')){
if(status.parentElement?.matches('[data-slot="composer-fade"]'))statuses.push(status)
}
return statuses
}
function floatPlaybackStatus(status){
status.setAttribute('data-claude-playback-floating','true')
const playback=Boolean(status.querySelector(':scope > button'))
status.setAttribute(playback?'data-claude-audio-playback':'data-claude-audio-dictation','true')
syncAudioLaneGeometry(status.closest('[data-slot="composer-dock"]'))
}
function clearPlaybackStatusFloat(status){
const dock=status.closest('[data-slot="composer-dock"]')
status.removeAttribute('data-claude-playback-floating')
status.removeAttribute('data-claude-audio-playback')
status.removeAttribute('data-claude-audio-dictation')
syncAudioLaneGeometry(dock)
}
function animatePlaybackEntry(status){
if(
destroyed
|| status.hasAttribute('data-claude-playback-hold')
|| status.hasAttribute('data-claude-playback-exit')
|| animatedPlaybackNodes.has(status)
)return
animatedPlaybackNodes.add(status)
floatPlaybackStatus(status)
const pendingGhost=status.parentElement?.querySelector?.(
':scope > [data-claude-playback-hold], :scope > [data-claude-playback-exit]'
)|| null
pendingGhost?.__claudeCancelPlaybackExit?.()
pendingGhost?.remove()
if(pendingGhost)return
if(playbackReducedMotion.matches)return
status.setAttribute('data-claude-playback-enter','true')
let timer=0
const finish=()=>{
if(timer){
window.clearTimeout(timer)
playbackAnimationTimers.delete(timer)
timer=0
}
status.removeAttribute('data-claude-playback-enter')
}
status.addEventListener('animationend',finish,{once:true})
timer=window.setTimeout(finish,PLAYBACK_MOTION_MS + 80)
playbackAnimationTimers.add(timer)
}
function animatePlaybackExit(status,parent,nextSibling){
if(
destroyed
|| status.hasAttribute('data-claude-playback-hold')
|| status.hasAttribute('data-claude-playback-exit')
|| !parent?.closest?.('[data-slot="composer-surface"]')
)return
const ghost=status.cloneNode(true)
ghost.removeAttribute('data-claude-playback-enter')
ghost.setAttribute('data-claude-playback-hold','true')
ghost.setAttribute('aria-hidden','true')
ghost.inert=true
for(const button of ghost.querySelectorAll('button')){
button.disabled=true
button.tabIndex=-1
}
const sourceCanvases=[...status.querySelectorAll('canvas')]
const ghostCanvases=[...ghost.querySelectorAll('canvas')]
for(let index=0;index < sourceCanvases.length;index +=1){
const sourceCanvas=sourceCanvases[index]
const ghostCanvas=ghostCanvases[index]
if(!ghostCanvas)continue
ghostCanvas.width=sourceCanvas.width
ghostCanvas.height=sourceCanvas.height
try{
const ghostContext=ghostCanvas.getContext('2d')
if(ghostContext)ghostContext.drawImage(sourceCanvas,0,0)
}catch{}
}
if(nextSibling?.parentNode===parent)parent.insertBefore(ghost,nextSibling)
else parent.appendChild(ghost)
syncAudioLaneGeometry(parent.closest('[data-slot="composer-dock"]'))
let graceTimer=0
let exitTimer=0
let exitStartTimer=0
const removeGhost=()=>{
if(graceTimer){
window.clearTimeout(graceTimer)
playbackAnimationTimers.delete(graceTimer)
graceTimer=0
}
if(exitTimer){
window.clearTimeout(exitTimer)
playbackAnimationTimers.delete(exitTimer)
exitTimer=0
}
if(exitStartTimer){
window.clearTimeout(exitStartTimer)
playbackAnimationTimers.delete(exitStartTimer)
exitStartTimer=0
}
delete ghost.__claudeCancelPlaybackExit
const dock=ghost.closest('[data-slot="composer-dock"]')
ghost.remove()
syncAudioLaneGeometry(dock)
}
ghost.__claudeCancelPlaybackExit=removeGhost
ghost.addEventListener('animationend',removeGhost,{once:true})
const beginExit=()=>{
if(graceTimer){
playbackAnimationTimers.delete(graceTimer)
graceTimer=0
}
if(playbackReducedMotion.matches){
removeGhost()
return
}
exitStartTimer=window.setTimeout(()=>{
playbackAnimationTimers.delete(exitStartTimer)
exitStartTimer=0
if(!ghost.isConnected)return
ghost.setAttribute('data-claude-playback-exit','true')
exitTimer=window.setTimeout(removeGhost,PLAYBACK_MOTION_MS + 80)
playbackAnimationTimers.add(exitTimer)
},0)
playbackAnimationTimers.add(exitStartTimer)
}
graceTimer=window.setTimeout(beginExit,PLAYBACK_CLOSE_GRACE_MS)
playbackAnimationTimers.add(graceTimer)
}
function clearPlaybackAnimations(){
for(const timer of playbackAnimationTimers)window.clearTimeout(timer)
playbackAnimationTimers.clear()
for(const status of document.querySelectorAll('[data-claude-playback-enter]')){
status.removeAttribute('data-claude-playback-enter')
}
for(const ghost of document.querySelectorAll('[data-claude-playback-hold], [data-claude-playback-exit]')){
ghost.__claudeCancelPlaybackExit?.()
ghost.remove()
}
for(const status of document.querySelectorAll('[data-claude-playback-floating]')){
clearPlaybackStatusFloat(status)
}
}
const updateLiveTailVisibility=(viewport,tail)=>{
tail.scrollTimer=0
if(!viewport.isConnected || !tail.wrapper?.isConnected)return
tail.atBottom=viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <=48
if(tail.atBottom){
if(!tail.wrapper.hasAttribute('data-claude-live-tail'))tail.wrapper.setAttribute('data-claude-live-tail','true')
}else{
tail.wrapper.removeAttribute('data-claude-live-tail')
}
}
const watchThreadViewport=viewport=>{
const tail={wrapper:null,atBottom:true,scrollTimer:0,scrollbarTimer:0,onScroll:null}
tail.onScroll=()=>{
if(destroyed)return
if(!viewport.hasAttribute('data-claude-scrolling'))viewport.setAttribute('data-claude-scrolling','true')
window.clearTimeout(tail.scrollbarTimer)
tail.scrollbarTimer=window.setTimeout(()=> viewport.removeAttribute('data-claude-scrolling'),700)
tail.atBottom=false
tail.wrapper?.removeAttribute('data-claude-live-tail')
window.clearTimeout(tail.scrollTimer)
tail.scrollTimer=window.setTimeout(()=> updateLiveTailVisibility(viewport,tail),120)
}
viewport.setAttribute('data-claude-scrollbar','true')
viewport.addEventListener('scroll',tail.onScroll,{passive:true})
threadViewports.set(viewport,tail)
return tail
}
const releaseThreadViewport=(viewport,tail)=>{
window.clearTimeout(tail.scrollTimer)
window.clearTimeout(tail.scrollbarTimer)
viewport.removeEventListener('scroll',tail.onScroll)
viewport.removeAttribute('data-claude-scrollbar')
viewport.removeAttribute('data-claude-scrolling')
tail.wrapper?.removeAttribute('data-claude-live-tail')
threadViewports.delete(viewport)
}
const latestTurnPairFromEnd=content=>{
if(!content)return null
let node=content.lastElementChild
while(node){
if(node.matches?.('[data-slot="aui_turn-pair"]')&& userMessageId(node))return node
if(node.lastElementChild){
node=node.lastElementChild
continue
}
while(node && node !==content && !node.previousElementSibling)node=node.parentElement
if(!node || node===content)return null
node=node.previousElementSibling
}
return null
}
const refreshLiveTail=()=>{
const viewports=new Set(document.querySelectorAll('[data-slot="aui_thread-viewport"]'))
for(const[viewport,tail]of threadViewports)if(!viewports.has(viewport))releaseThreadViewport(viewport,tail)
for(const viewport of viewports){
const tail=threadViewports.get(viewport)|| watchThreadViewport(viewport)
const content=viewport.querySelector('[data-slot="aui_thread-content"]')
let wrapper=latestTurnPairFromEnd(content)
while(wrapper && wrapper.parentElement !==content)wrapper=wrapper.parentElement
if(wrapper !==tail.wrapper){
tail.wrapper?.removeAttribute('data-claude-live-tail')
tail.wrapper=wrapper
if(tail.atBottom)tail.wrapper?.setAttribute('data-claude-live-tail','true')
}
window.clearTimeout(tail.scrollTimer)
tail.scrollTimer=window.setTimeout(()=> updateLiveTailVisibility(viewport,tail),0)
}
}
const markPair=pair=>{
if(!pair?.matches?.('[data-slot="aui_turn-pair"]'))return
dirtyPairs.add(pair)
}
const markPairsIn=node=>{
if(!(node instanceof Element))return
if(node.matches('[data-slot="aui_turn-pair"]'))markPair(node)
else if(node.matches('[data-session-anchor], [data-slot="aui_thread-content"]')){
historicalPairScanPending=true
}else{
for(const pair of collectNestedTurnPairs(node))markPair(pair)
}
}
const cancelPairWork=()=>{
if(!pairWorkHandle)return
if(pairWorkUsesIdleCallback)window.cancelIdleCallback?.(pairWorkHandle)
else window.clearTimeout(pairWorkHandle)
pairWorkHandle=0
}
const runPairWork=deadline=>{
pairWorkHandle=0
if(destroyed)return
if(historicalPairScanPending){
historicalPairScanPending=false
for(const pair of document.querySelectorAll('[data-slot="aui_turn-pair"]'))markPair(pair)
}
let processed=0
while(dirtyPairs.size && processed < PAIR_WORK_BATCH_SIZE &&(processed===0 || deadline.timeRemaining()> 1)){
const pair=dirtyPairs.values().next().value
dirtyPairs.delete(pair)
if(!pair?.isConnected)continue
stripImageAttachmentMarker(pair)
decorateLongUserMessage(pair)
reconcileCleanTranscript(pair)
processed +=1
}
if(dirtyPairs.size)schedulePairWork()
}
const schedulePairWork=()=>{
if(pairWorkHandle || destroyed)return
if(typeof window.requestIdleCallback==='function'){
pairWorkUsesIdleCallback=true
pairWorkHandle=window.requestIdleCallback(runPairWork,{timeout:800})
}else{
pairWorkUsesIdleCallback=false
pairWorkHandle=window.setTimeout(()=> runPairWork({timeRemaining:()=> 4}),16)
}
}
const schedule=()=>{
if(scheduled || destroyed)return
scheduled=true
animationFrame=window.requestAnimationFrame(process)
}
const reconcileSession=()=>{
if(destroyed)return
historicalPairScanPending=true
composerDirty=true
schedule()
}
let observedSessionId=currentRuntimeSessionId()
const offActiveSession=host.state.activeSessionId?.subscribe?.(value=>{
const nextSessionId=String(value || '')
if(nextSessionId===observedSessionId)return
observedSessionId=nextSessionId
reconcileSession()
})
let observedProfile=currentProfileScope()
const offProfileState=host.state.profile?.subscribe?.(value=>{
const nextProfile=profileScope(value)
if(nextProfile===observedProfile)return
observedProfile=nextProfile
reconcileSession()
})
let observedGatewayState=String(host.state.gateway?.get?.()|| '')
const offGatewayState=host.state.gateway?.subscribe?.(value=>{
const nextState=String(value || '')
const reconnected=observedGatewayState && observedGatewayState !=='open' && nextState==='open'
observedGatewayState=nextState
if(!reconnected)return
reconcileSession()
})
const offSessionInfo=host.onEvent?.('session.info',event=>{
if(destroyed)return
const runtimeId=String(event.session_id || '')
if(runtimeId===currentRuntimeSessionId())reconcileSession()
})
function process(){
animationFrame=0
scheduled=false
if(destroyed)return
if(processAllPairs){
processAllPairs=false
historicalPairScanPending=true
}
schedulePairWork()
refreshLiveTail()
if(composerDirty){
composerDirty=false
decorateComposerChrome()
composerOverflow.refresh()
refreshAudioLaneDocks()
}
}
const touchesComposerChrome=element=> Boolean(
element?.closest?.('[data-slot="composer-dock"]:not([data-slot="composer-rich-input"]), [data-slot="composer-root"]:not([data-slot="composer-rich-input"])')
|| element?.matches?.('[data-slot="dropdown-menu-content"][role="menu"]')
||(element?.firstElementChild && element.querySelector?.('[data-slot="dropdown-menu-content"][role="menu"], [data-slot="composer-dock"]'))
)
const runtimeSignalSelector=[
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
'[data-slot="connector-card"]',
'[data-connector-offer]',
'[data-slot="tool-approval-inline"]',
'[data-slot="tool-approval-stack"]',
'[data-slot="tool-approval-card"]',
'[role="status"]',
'[data-slot="dropdown-menu-content"][role="menu"]',
'[data-slot="composer-dock"]',
'[data-slot="composer-root"]',
'[data-session-anchor]'
].join(', ')
const carriesRuntimeSignal=node=> Boolean(
node instanceof Element
&&(
node.matches(runtimeSignalSelector)
||(node.firstElementChild && node.querySelector(runtimeSignalSelector))
)
)
const handleMutations=records=>{
historyRail.observe(records)
let relevant=false
for(const record of records){
const target=record.target instanceof Element?record.target:record.target.parentElement
if(target?.closest?.('[data-claude-user-expand]'))continue
if(target?.closest?.('[data-slot="sidebar"]'))continue
const pair=target?.closest?.('[data-slot="aui_turn-pair"]')
if(record.type==='attributes'){
if(record.attributeName==='data-clamped' && target?.closest?.('[data-role="user"]')){
if(pair)markPair(pair)
relevant=true
}else if(
(record.attributeName==='role' && target?.matches?.('[role="status"]'))
||(record.attributeName==='data-streaming' && target?.matches?.('[data-role="assistant"]'))
){
if(pair)markPair(pair)
relevant=true
}else if(target?.closest?.('[data-slot="composer-dock"], [data-slot="composer-root"]')){
composerDirty=true
relevant=true
}
continue
}
if(target?.closest?.('[data-slot="composer-rich-input"]'))continue
const addedElements=[...record.addedNodes].filter(node=> node instanceof Element)
const removedElements=[...record.removedNodes].filter(node=> node instanceof Element)
const changedElements=[...addedElements,...removedElements]
if(target?.closest?.('[data-slot="composer-surface"]')){
for(const node of addedElements){
for(const status of playbackStatusesIn(node))animatePlaybackEntry(status)
}
for(const node of removedElements){
for(const status of playbackStatusesIn(node))animatePlaybackExit(status,target,record.nextSibling)
}
}
const signalChanged=changedElements.some(carriesRuntimeSignal)
const cleanPartChanged=changedElements.some(isCleanPartMutationNode)
if(pair &&(target?.closest?.('[data-role="user"]')|| signalChanged || cleanPartChanged)){
markPair(pair)
relevant=true
}
if(signalChanged || cleanPartChanged)relevant=true
if(target?.closest?.('[data-slot="composer-dock"], [data-slot="composer-root"]')&& !target.closest('[data-slot="composer-rich-input"], textarea')){
composerDirty=true
relevant=true
}
for(const node of changedElements){
if(node.matches('[data-slot="sidebar"]')|| node.closest?.('[data-slot="sidebar"]'))continue
if(isTurnPairMutationRoot(node)){
markPairsIn(node)
relevant=true
}
if(touchesComposerChrome(node)){
composerDirty=true
relevant=true
}
}
}
if(relevant)schedule()
}
const observer=new MutationObserver(handleMutations)
observer.observe(document.body,{
childList:true,
subtree:true,
attributes:true,
attributeFilter:['aria-label','role','data-clamped','data-streaming']
})
for(const status of document.querySelectorAll('[data-slot="composer-fade"] > [role="status"][aria-live="polite"]')){
animatePlaybackEntry(status)
}
const onResize=()=>{
processAllPairs=true
composerDirty=true
schedule()
}
const onHashChange=()=> reconcileSession()
const onCleanTranscriptChange=()=> reconcileSession()
window.addEventListener('resize',onResize)
window.addEventListener('hashchange',onHashChange)
window.addEventListener(CLEAN_TRANSCRIPT_EVENT,onCleanTranscriptChange)
reconcileSession()
const cleanup=()=>{
destroyed=true
if(animationFrame)window.cancelAnimationFrame(animationFrame)
animationFrame=0
scheduled=false
observer.disconnect()
historyRail.cleanup()
composerOverflow.cleanup()
cancelPairWork()
clearPlaybackAnimations()
clearAudioLaneGeometry()
for(const[viewport,tail]of threadViewports)releaseThreadViewport(viewport,tail)
window.removeEventListener('resize',onResize)
window.removeEventListener('hashchange',onHashChange)
window.removeEventListener(CLEAN_TRANSCRIPT_EVENT,onCleanTranscriptChange)
offProfileState?.()
offGatewayState?.()
offActiveSession?.()
offSessionInfo?.()
const handoff={timer:0}
handoff.timer=window.setTimeout(()=>{
if(window[RUNTIME_HANDOFF_KEY]!==handoff)return
for(const user of document.querySelectorAll('[data-slot="aui_user-message-root"]'))clearLongUserDecoration(user)
clearCleanTranscriptDecorations()
clearImageAttachmentMarkers()
clearComposerChromeDecorations()
afterFinalCleanup?.()
delete window[RUNTIME_HANDOFF_KEY]
},300)
window[RUNTIME_HANDOFF_KEY]=handoff
}
cleanup.reconcileSession=reconcileSession
return cleanup
}
function installTitlebarAlignment(){
const observed=new Set(),marked=new Set()
const selector='[data-titlebar-cluster], [data-window-top], [data-panel-header]'
let frame=0,disposed=false,sidebarBand=null
const clear=element=>{
element.style.removeProperty('--claude-titlebar-offset')
element.removeAttribute('data-claude-titlebar-aligned')
marked.delete(element)
}
const sync=()=>{
frame=0
if(disposed)return
const clusters=[...document.querySelectorAll('[data-titlebar-cluster]')]
const headers=[...document.querySelectorAll('[data-window-top] > [data-panel-header]')]
const current=new Set([...clusters,...headers])
for(const element of observed)if(!current.has(element)){resize.unobserve(element);observed.delete(element)}
for(const element of current)if(!observed.has(element)){resize.observe(element);observed.add(element)}
for(const element of marked)if(!clusters.includes(element))clear(element)
for(const cluster of clusters){
const box=cluster.getBoundingClientRect(),x=box.left + box.width / 2
const left=cluster.dataset.titlebarCluster==='left'
if(left){
const own=headers.find(element=> element.parentElement.dataset.treeGroup==='grp-sessions')?.getBoundingClientRect()
if(own?.width > 0 && own.height > 0)sidebarBand={top:own.top,height:own.height}
}
const folded=left && document.documentElement.hasAttribute('data-claude-sidebar-folded')
const foldedBand=folded &&(sidebarBand ||{top:0,height:36 *(box.height /(cluster.offsetHeight || box.height || 1))})
const header=foldedBand?{getBoundingClientRect:()=> foldedBand}:headers.find(element=>{
const r=element.getBoundingClientRect()
return r.width > 0 && r.height > 0 && x >=r.left && x <=r.right && getComputedStyle(element).visibility !=='hidden'
})
if(document.documentElement.dataset.claudeChatLook !=='true' || !box.width || !box.height || !header){clear(cluster);continue}
const band=header.getBoundingClientRect(),scale=box.height / cluster.offsetHeight
const previous=parseFloat(cluster.style.getPropertyValue('--claude-titlebar-offset'))|| 0
const next=Math.round((previous +(band.top + band.height / 2 - box.top - box.height / 2)/ scale)* 100)/ 100
if(Math.abs(next)< .02){clear(cluster);continue}
if(Math.abs(next - previous)> .02 || !marked.has(cluster)){
cluster.style.setProperty('--claude-titlebar-offset',`${next}px`)
cluster.setAttribute('data-claude-titlebar-aligned','')
marked.add(cluster)
}
}
}
const schedule=()=>{if(!disposed && !frame)frame=window.requestAnimationFrame(sync)}
const resize=new ResizeObserver(schedule)
const relevant=node=> node.nodeType===1 &&(node.matches(selector)|| node.querySelector(selector))
const mutations=new MutationObserver(records=>{
if(records.some(record=> record.type==='attributes' || record.target.closest?.('[data-panel-header]')||[...record.addedNodes,...record.removedNodes].some(relevant)))schedule()
})
mutations.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-window-top']})
mutations.observe(document.documentElement,{attributes:true,attributeFilter:['data-claude-sidebar-folded']})
window.addEventListener('resize',schedule)
sync()
return()=>{
disposed=true
window.cancelAnimationFrame(frame)
resize.disconnect();mutations.disconnect()
window.removeEventListener('resize',schedule)
for(const element of marked)clear(element)
}
}
function installChatStyleRuntime(){
const root=document.documentElement
let style=document.getElementById(STYLE_ID)
if(!style){
style=document.createElement('style')
style.id=STYLE_ID
document.head.appendChild(style)
}
style.textContent=CSS + BROWSER_PALETTE_CSS + CLAUDE_CODE_LAYOUT_CSS + UPDATE_CSS
style.dataset.claudeChatLookBuild=BUILD_ID
root.dataset.claudeChatLook='true'
root.dataset.claudeChatLookBuild=BUILD_ID
syncComposerWidthRoot()
syncPinnedUserMessagesRoot()
syncCleanTranscriptRoot()
syncAsciiBackdropRoot()
const seasonTimer=globalThis.setInterval?.(()=>{if(readAsciiBackdropMode()==='auto')syncAsciiBackdropRoot()},ASCII_SEASON_CHECK_MS)
seasonTimer?.unref?.()
const uninstallTitlebarAlignment=installTitlebarAlignment()
const uninstallBehavior=installBehaviorRuntime(()=>{
globalThis.clearInterval?.(seasonTimer)
style?.remove()
delete root.dataset.claudeChatLook
root.removeAttribute('data-claude-composer-width')
root.removeAttribute('data-claude-pinned-user-messages')
root.removeAttribute('data-claude-clean-transcript')
root.removeAttribute('data-claude-ascii-glyphs')
root.removeAttribute('data-claude-ascii-scene')
if(root.dataset.claudeChatLookBuild===BUILD_ID)delete root.dataset.claudeChatLookBuild
if(root.dataset.claudeChatLookRuntime===BUILD_ID)delete root.dataset.claudeChatLookRuntime
})
root.dataset.claudeChatLookRuntime=BUILD_ID
console.info(`[claude-chat-look] activated ${BUILD_ID}`,JSON.stringify({
panelHeaders:document.querySelectorAll('[data-window-top] > [data-panel-header]').length,
browserBars:document.querySelectorAll('aside[data-preview-browser] input[data-slot="input"]').length,
cornerTargets:document.querySelectorAll('[data-tree-split] > div:has(> [data-tree-group="grp-sessions"]):not([style*="display: none"]) + div > [data-tree-group="grp-main"]').length
}))
return()=>{
uninstallTitlebarAlignment()
uninstallBehavior()
}
}
const CLAUDE_HAS_MARKS=[
['tour-sidebar-nav','[data-tour=\'sessions-sidebar\'] [data-sidebar=\'menu-button\']',':has([data-tour^=\'sidebar-nav-\'])','[data-tour=\'sessions-sidebar\']'],
['tour-sidebar-nav-new-session','[data-tour=\'sessions-sidebar\'] [data-sidebar=\'menu-button\']',':has([data-tour=\'sidebar-nav-new-session\'])','[data-tour=\'sessions-sidebar\']'],
['child-model-pair-expanded','[data-slot=\'composer-root\'] div',':has(> :is(button[data-tour=\'model-pill\'], [data-claude-model-paired])[aria-expanded=\'true\'])','[data-slot=\'composer-root\']'],
['child-engine-menu-open','[data-slot=\'composer-root\'] span',':has(> * > button[aria-label=\'Voice chat engine\'][aria-expanded=\'true\'], > button[aria-label=\'Voice chat engine\'][aria-expanded=\'true\'])','[data-slot=\'composer-root\']'],
['child-start-voice','[data-slot=\'composer-root\'] span',':has(> button[aria-label=\'Start voice conversation\'])','[data-slot=\'composer-root\']'],
['button-is-label-send-label-envoyer','[data-slot=\'composer-root\'] [data-slot=\'composer-fade\'] > div:last-child',':has(button:is([aria-label=\'Send\'], [aria-label=\'Envoyer\']))','[data-slot=\'composer-root\']'],
['slot-composer-rich-input','[data-slot=\'composer-root\'] [data-slot=\'composer-fade\'] > div:last-child > div',':has([data-slot=\'composer-rich-input\'])','[data-slot=\'composer-root\']'],
['tree-tab-workspace','[data-tree-split] > div > [data-tree-group]:not([data-tree-group=\'grp-sessions\']):not([data-tree-group=\'grp-main\'])[data-window-top], [data-tree-split] > div > [data-tree-group]:not([data-tree-group=\'grp-sessions\']):not([data-tree-group=\'grp-main\'])',':has([data-tree-tab=\'workspace\'])','[data-tree-split]'],
['child-tree-split-div-tree-group-grp-files','[data-tree-split] > div',':has(> [data-tree-split] > div > [data-tree-group=\'grp-files\'])','[data-tree-split]'],
['child-tree-split-div-not-style-display-none-tree-gro','[data-tree-split] > div',':has(> [data-tree-split] > div:not([style*=\'display: none\']) > [data-tree-group]:not([data-tree-group=\'grp-files\']))','[data-tree-split]'],
['child-claude-preview-column-claude-side-column','[data-tree-split]',':has(> [data-claude-preview-column], > [data-claude-side-column])','[data-tree-split]'],
['next-tree-group-grp-sessions','[data-claude-grip]',':has(+ [data-tree-group=\'grp-sessions\'])',null],
['child-tree-group-grp-terminal','[data-tree-split] > div + div',':has(> [data-tree-group=\'grp-terminal\'])','[data-tree-split]'],
['tree-tab-terminal-role-tab','[data-zone-tabstrip]',':has([data-tree-tab=\'terminal\'][role=\'tab\'])','[data-zone-tabstrip]'],
['child-claude-mode-rendered','[data-claude-file-name]',':has(> [data-claude-mode=\'rendered\'])','[data-claude-file-name]'],
['child-claude-mode-source','[data-claude-file-name]',':has(> [data-claude-mode=\'source\'])','[data-claude-file-name]'],
['child-project-tree','[data-tree-group=\'grp-files\'] div',':has(> [data-project-tree])','[data-tree-group=\'grp-files\']'],
['child-tree-group-grp-sessions-tree-group-grp-main','[data-tree-split] > div',':has(> [data-tree-group=\'grp-sessions\'], > [data-tree-group=\'grp-main\'])','[data-tree-split]'],
['reorder-live','[data-tour=\'sessions-sidebar\'] [class~=\'row-hover\']',':has([data-reorder-handle] :is([role=\'status\'], [class*=\'bg-(--ui-accent)\'], [class*=\'border\']))','[data-tour=\'sessions-sidebar\']'],
['child-input-label-search-sessions','[data-tour=\'sessions-sidebar\'] div',':has(> input[aria-label=\'Search sessions\'])','[data-tour=\'sessions-sidebar\']'],
['child-tool-summary','[data-tool-group]',':has(> [data-tool-summary])','[data-tool-group]'],
['tool-ticker','[data-tool-group] > div:not([data-tool-summary]):not(.tool-ticker)',':has(.tool-ticker)','[data-tool-group]'],
['glyph-spinner','[data-tool-row] [role=\'status\']',':has(.glyph-spinner)','[data-tool-row]'],
['tool-row-role-status-glyph-spinner','[data-tool-group]',':has([data-tool-row] [role=\'status\'] .glyph-spinner)','[data-tool-group]'],
['child-cmdk-root','[role=\'dialog\']',':has(> [cmdk-root])','[role=\'dialog\']'],
['child-tree-group-grp-sessions','[data-tree-split] > div:not([style*=\'display: none\']):not([style*=\'flex: 0 0\']):not([style*=\'flex:0 0\']), [data-tree-split] > div:not([style*=\'display: none\'])',':has(> [data-tree-group=\'grp-sessions\'])','[data-tree-split]'],
['slot-message','[data-tree-group]',':has([data-slot*=\'message\'])','[data-tree-group]'],
['child-button-tour-model-pill-claude-model-paired','[data-slot=\'composer-root\'] div',':has(> button[data-tour=\'model-pill\'] + [data-claude-model-paired])','[data-slot=\'composer-root\']'],
['child-claude-mode','[data-claude-file-name]',':has(> [data-claude-mode])','[data-claude-file-name]'],
['slot-aui-directive-image-slot-aui-embedded-image','[data-slot=\'aui_turn-pair\'] > [data-role=\'user\'] + *:not([data-role])',':has([data-slot=\'aui_directive-image\'], [data-slot=\'aui_embedded-image\'])','[data-slot=\'aui_turn-pair\']'],
['child-button-first-child-span-first-child-is-img-svg','[data-slot=\'composer-attachments\'] .group\\/attachment',':has(> button:first-child > span:first-child > :is(img, svg.icon-tabler-photo))','[data-slot=\'composer-attachments\']'],
['child-button-first-child-img','[data-slot=\'composer-attachments\'] .group\\/attachment',':has(> button:first-child img)','[data-slot=\'composer-attachments\']'],
['zone-tabstrip','[data-tree-group=\'grp-main\'] > [data-panel-header], [data-window-top] > [data-panel-header], [data-tree-group=\'grp-main\'][data-window-top] > [data-panel-header]',':has([data-zone-tabstrip])','[data-tree-group=\'grp-main\'], [data-window-top], [data-tree-group=\'grp-main\'][data-window-top]'],
['child-claude-audio-dictation-true','[data-slot=\'composer-fade\']',':has(> [data-claude-audio-dictation=\'true\'])','[data-slot=\'composer-fade\']'],
['child-claude-audio-playback-true','[data-slot=\'composer-fade\']',':has(> [data-claude-audio-playback=\'true\'])','[data-slot=\'composer-fade\']'],
['child-button','[data-slot=\'composer-surface\'] [role=\'status\'][aria-live=\'polite\'], [data-slot=\'composer-fade\'] > [role=\'status\'][aria-live=\'polite\']',':has(> button)','[data-slot=\'composer-surface\'], [data-slot=\'composer-fade\']'],
['child-div-codicon-error','[data-slot=\'composer-status-stack\'] [data-slot=\'status-stack-section\'] > [role=\'alert\']',':has(> div > .codicon-error)','[data-slot=\'composer-status-stack\']'],
['claude-task-section-true','[data-claude-status-card=\'true\']',':has([data-claude-task-section=\'true\'])','[data-claude-status-card=\'true\']'],
['child-status-row-icon-codicon-comment','[data-slot=\'composer-status-stack\'] [data-slot=\'status-row\']',':has(> .status-row-icon > .codicon-comment)','[data-slot=\'composer-status-stack\']'],
['chat-surface','[data-tree-group=\'grp-main\']',':has([data-chat-surface]:not([data-pane-hidden] *))','[data-tree-group=\'grp-main\']'],
['child-button-label','[data-tree-group]:not([data-tree-group=\'grp-sessions\']) [data-zone-tabstrip] [role=\'tab\'] > span:last-child, [data-tree-group]:not([data-tree-group=\'grp-sessions\']) [data-zone-tabstrip] [data-slot=\'pane-tab\'][data-closeable]:not([data-vertical=\'true\']) > span:last-child',':has(> button[aria-label])','[data-tree-group]:not([data-tree-group=\'grp-sessions\'])'],
['child-div-input-slot-input','aside[data-preview-browser] > div:first-child > div',':has(> div > input[data-slot=\'input\'])','aside[data-preview-browser]'],
['child-tree-group-aside-preview-browser','[data-tree-split] > div',':has(> [data-tree-group] aside[data-preview-browser])','[data-tree-split]'],
]
const CLAUDE_HAS_MARK_ATTRIBUTES=['aria-expanded','aria-label','aria-live','class','cmdk-root','data-claude-audio-dictation','data-claude-audio-playback','data-claude-backend-dock','data-claude-chat-look','data-claude-file-name','data-claude-grip','data-claude-mode','data-claude-model-paired','data-claude-preview-column','data-claude-side-column','data-claude-status-card','data-claude-task-section','data-chat-surface','data-closeable','data-hermes-theme','data-pane-hidden','data-panel-header','data-preview-browser','data-project-tree','data-role','data-sidebar','data-slot','data-tool-group','data-tool-row','data-tool-summary','data-tour','data-tree-group','data-tree-split','data-tree-tab','data-vertical','data-window-top','data-zone-tabstrip','role','style']
const CLAUDE_HAS_MARK_STYLE_READERS='[data-tree-split] > div'
function installClaudeHasMarks({marks=CLAUDE_HAS_MARKS,attributes=CLAUDE_HAS_MARK_ATTRIBUTES,styleReaders=CLAUDE_HAS_MARK_STYLE_READERS,document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.documentElement || !win?.MutationObserver)return()=>{}
const sets=marks.map(()=> new Set())
let disposed=false
const mark=(touched,added=[])=>{
if(disposed)return
const changed=new Set()
const hit=new Map()
const inRegion=region=>{
if(!hit.has(region))hit.set(region,touched.some(node=> node.closest(region))|| added.some(node=> node.closest(region)|| node.querySelector(region)))
return hit.get(region)
}
marks.forEach(([,candidates,condition,region],row)=>{
if(touched && region && !inRegion(region))return
const next=new Set()
let nodes=[]
try{nodes=doc.querySelectorAll(candidates)}catch{}
for(const node of nodes){try{if(node.matches(condition))next.add(node)}catch{}}
const old=sets[row]
for(const node of next)if(!old.has(node))changed.add(node)
for(const node of old)if(!next.has(node))changed.add(node)
sets[row]=next
})
for(const node of changed){
const value=marks.filter((_,row)=> sets[row].has(node)).map(([name])=> name).sort().join(' ')
if(!value)node.removeAttribute('data-claude-has')
else if(node.getAttribute('data-claude-has')!==value)node.setAttribute('data-claude-has',value)
}
}
const observer=new win.MutationObserver(records=>{
const touched=new Set(),added=[]
for(const record of records){
const node=record.target.nodeType===1?record.target:record.target.parentElement
if(!node || node.closest('.xterm'))continue
if(record.type==='childList' && node.closest("[contenteditable='true'], textarea"))continue
if(record.attributeName==='style' && !node.matches(styleReaders))continue
touched.add(node)
for(const child of record.addedNodes)if(child.nodeType===1)added.push(child)
}
if(touched.size)mark([...touched],added)
})
observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:attributes})
mark()
return()=>{
disposed=true
observer.disconnect()
for(const set of sets)for(const node of set)node.removeAttribute('data-claude-has')
}
}
const CLAUDE_PANE_TOOLS=[
{id:'terminal',icon:'terminal',label:'Terminal',pane:'terminal',side:true,shown:"[data-tree-group='grp-terminal']:not([data-pane-host])",
native:"[data-slot='statusbar'] button:has(svg[class*='tabler-icon-terminal'])",chord:{key:'`',code:'Backquote',ctrlKey:true}},
{id:'review',icon:'diff',label:'Changes',action:'view.toggleReview',pane:'review',side:true,shown:"[data-tree-group='grp-review']:not([data-pane-host])"},
{id:'browser',icon:'globe',label:'Browser',action:'view.showBrowser',shown:'aside[data-preview-browser]'},
{id:'files',icon:'folder',label:'Files',action:'view.showFiles',closeAction:'view.toggleRightSidebar',pane:'files',side:true,shown:"[data-tree-group='grp-files']:not([data-pane-host])"}
]
const CLAUDE_PANE_ICONS={
terminal:'<path d="M3 4.25 6.75 8 3 11.75"/><path d="M8.25 11.75h5"/>',
diff:'<rect x="2.75" y="2.75" width="10.5" height="10.5" rx="1.5"/><path d="M8 4.75v3.5M6.25 6.5h3.5M6.25 10.75h3.5"/>',
globe:'<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11"/><path d="M6.4 2.75c-1.2 3.4-1.2 7.1 0 10.5M9.6 2.75c1.2 3.4 1.2 7.1 0 10.5"/>',
folder:'<path d="M2.75 4.25c0-.55.45-1 1-1h2.6l1.3 1.5h4.6c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-8.5c-.55 0-1-.45-1-1z"/>',
routines:'<rect x="2.75" y="3.25" width="10.5" height="10" rx="1.5"/><path d="M2.75 6.25h10.5M5.5 2v2.5M10.5 2v2.5"/><path d="M8 8.25v2l1.25.75"/>'
}
const CLAUDE_TERMINAL_ICONS={
add:'<path d="M8 3.25v9.5M3.25 8h9.5"/>',
folder:'<path d="M2.75 4.25c0-.55.45-1 1-1h2.6l1.3 1.5h4.6c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-8.5c-.55 0-1-.45-1-1z"/>',
expand:'<path d="M9.5 2.75h3.75V6.5M13.25 2.75 9.25 6.75M6.5 13.25H2.75V9.5M2.75 13.25l4-4"/>',
collapse:'<path d="M13.25 2.75l-4 4M9.25 3.5v3.25h3.25M2.75 13.25l4-4M6.75 12.5V9.25H3.5"/>',
tree:'<path d="M6.25 4.5h6.5M6.25 8h6.5M6.25 11.5h6.5"/><circle cx="3.5" cy="4.5" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="11.5" r=".9" fill="currentColor" stroke="none"/>',
close:'<path d="M4 4l8 8M12 4l-8 8"/>',
logs:'<rect x="2.75" y="3.25" width="10.5" height="9.5" rx="1.5"/><path d="M2.75 8h10.5M10.25 5.6h.75M10.25 10.4h.75"/>',
search:'<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25 13.25 13.25"/>',
more:'<circle cx="8" cy="3.75" r=".95" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".95" fill="currentColor" stroke="none"/><circle cx="8" cy="12.25" r=".95" fill="currentColor" stroke="none"/>'
}
const CLAUDE_BROWSER_TAB_LIMIT=9
function installClaudeTerminalHeader({host:api=typeof host==='undefined'?null:host,document:doc=globalThis.document,window:win=globalThis.window}={}){
const root=doc.documentElement
const EXPANDED='data-claude-expanded'
let frame=0,disposed=false,tabLimitTip=null,tabsResize=null
const glyph=name=>{
const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg')
svg.setAttribute('viewBox','0 0 16 16')
svg.setAttribute('fill','none')
svg.setAttribute('stroke','currentColor')
svg.setAttribute('stroke-width','1.25')
svg.setAttribute('stroke-linecap','round')
svg.setAttribute('stroke-linejoin','round')
svg.setAttribute('aria-hidden','true')
svg.innerHTML=CLAUDE_TERMINAL_ICONS[name]
return svg
}
const button=(name,label,onClick)=>{
const element=doc.createElement('button')
element.type='button'
element.dataset.claudeTerminalAction=name
element.setAttribute('aria-label',label)
element.title=label
element.append(glyph(name))
element.addEventListener('pointerdown',event=> event.stopPropagation())
element.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();onClick(element)})
return element
}
const list=()=> doc.querySelector("ul[aria-label='Terminals']")
const terminals=()=>[...(list()?.querySelectorAll("li > button[role='tab']")||[])]
const setAttr=(node,name,value)=>{if(node.getAttribute(name)!==value)node.setAttribute(name,value)}
const expanded=()=> root.getAttribute(EXPANDED)|| ''
const setExpanded=target=>{
if(target)root.setAttribute(EXPANDED,target)
else root.removeAttribute(EXPANDED)
for(const toggle of doc.querySelectorAll("[data-claude-terminal-action='expand']")){
const on=toggle.dataset.claudeExpandTarget===target
const name={files:'Files',browser:'browser'}[toggle.dataset.claudeExpandTarget]|| 'terminal'
if(toggle.getAttribute('aria-pressed')!==(on?'true':'false')|| !toggle.firstChild)toggle.replaceChildren(glyph(on?'collapse':'expand'))
setAttr(toggle,'aria-label',(on?'Restore ':'Expand ')+ name)
setAttr(toggle,'title',toggle.getAttribute('aria-label'))
setAttr(toggle,'aria-pressed',on?'true':'false')
}
}
const expandButton=(target,label)=>{
const toggle=button('expand',label,()=> setExpanded(expanded()===target?'':target))
toggle.dataset.claudeExpandTarget=target
return toggle
}
const FILES_VIEW='data-claude-files-view'
const syncTreeButtons=()=>{
const view=root.getAttribute(FILES_VIEW)
const treeShown=view !=='file' && view !=='empty'
for(const toggle of doc.querySelectorAll("[data-claude-terminal-action='tree']")){
setAttr(toggle,'aria-pressed',treeShown?'true':'false')
setAttr(toggle,'aria-label',treeShown?'Hide file tree':'Show file tree')
setAttr(toggle,'title',toggle.getAttribute('aria-label'))
}
}
const treeButton=()=> button('tree','Hide file tree',()=> root.dispatchEvent(new win.CustomEvent('claude-tree-toggle')))
const searchButton=()=> button('search','Filter files',()=> root.dispatchEvent(new win.CustomEvent('claude-tree-search')))
const moreButton=()=>{const more=button('more','More options',element=> root.dispatchEvent(new win.CustomEvent('claude-files-menu',{detail:element})));more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');return more}
const closeFiles=()=>{
if(expanded()==='files')setExpanded('')
doc.querySelector("[data-claude-pane-tool='folder']")?.click()
}
const closeTerminal=target=>{
for(const type of['pointerdown','pointerup'])target.dispatchEvent(new win.PointerEvent(type,{bubbles:true,cancelable:true,button:1,buttons:type==='pointerdown'?4:0,pointerType:'mouse'}))
}
const syncTabs=(strip,tablist)=>{
const items=terminals()
let tabs=strip.querySelector("[data-claude-terminal-header='tabs']")
if(items.length < 2){
tabs?.remove()
delete strip.dataset.claudeTerminalTabs
return null
}
strip.dataset.claudeTerminalTabs='true'
if(!tabs){
tabs=doc.createElement('span')
tabs.dataset.claudeTerminalHeader='tabs'
tabs.setAttribute('role','tablist')
tabs.setAttribute('aria-label','Terminals')
}
const signature=items.map(item=> item.getAttribute('aria-selected')).join(',')
if(tabs.dataset.signature !==signature){
tabs.dataset.signature=signature
const focused=[...tabs.children].indexOf(doc.activeElement)
tabs.replaceChildren(...items.map((item,index)=>{
const tab=doc.createElement('span')
tab.dataset.claudeTerminalTab=String(index + 1)
tab.setAttribute('role','tab')
const selected=item.getAttribute('aria-selected')==='true'
tab.setAttribute('aria-selected',selected?'true':'false')
tab.tabIndex=selected?0:-1
const label=doc.createElement('span')
label.textContent='Terminal ' +(index + 1)
const close=button('close','Close terminal',()=> closeTerminal(item))
close.dataset.claudeTerminalAction='close-tab'
close.tabIndex=-1
tab.append(label,close)
tab.addEventListener('pointerdown',event=> event.stopPropagation())
tab.addEventListener('click',()=> item.click())
tab.addEventListener('auxclick',event=>{if(event.button===1){event.preventDefault();closeTerminal(item)}})
tab.addEventListener('contextmenu',event=>{
event.preventDefault()
event.stopPropagation()
item.dispatchEvent(new win.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,buttons:2,clientX:event.clientX,clientY:event.clientY,screenX:event.screenX,screenY:event.screenY}))
})
tab.addEventListener('keydown',event=>{
const all=[...tabs.querySelectorAll('[data-claude-terminal-tab]')]
const at=all.indexOf(tab)
const step={ArrowLeft:-1,ArrowRight:1}[event.key]
if(!['Enter',' ','Delete','Backspace','Home','End'].includes(event.key)&& !step)return
event.preventDefault()
event.stopPropagation()
if(event.key==='Enter' || event.key===' ')item.click()
else if(event.key==='Delete' || event.key==='Backspace')closeTerminal(item)
else{
const next=all[step?(at + step + all.length)% all.length:event.key==='Home'?0:all.length - 1]
for(const other of all)other.tabIndex=other===next?0:-1
next?.focus()
}
})
return tab
}))
if(focused >=0)tabs.children[Math.min(focused,tabs.children.length - 1)]?.focus()
}
if(tablist.nextElementSibling !==tabs)tablist.after(tabs)
tabs.removeAttribute('data-claude-compact')
if([...tabs.querySelectorAll("[data-claude-terminal-tab][aria-selected='false'] > span")].some(label=> label.scrollWidth > label.clientWidth + 0.5))tabs.setAttribute('data-claude-compact','')
if(tabsResize && !tabs.dataset.claudeObserved){tabs.dataset.claudeObserved='true';tabsResize.observe(tabs)}
return tabs
}
const place=()=>{
frame=0
if(disposed)return
for(const strip of doc.querySelectorAll('[data-zone-tabstrip]')){
const isTerminal=Boolean(strip.querySelector("[data-tree-tab='terminal'][role='tab']"))
const added=strip.querySelectorAll("[data-claude-terminal-header]:not([data-claude-terminal-header='browser-actions']):not([data-claude-terminal-header='plugin-actions'])")
if(!isTerminal){added.forEach(node=> node.remove());continue}
const tablist=strip.querySelector("[role='tablist']")
if(!tablist)continue
let add=strip.querySelector("[data-claude-terminal-header='add']")
if(!add){
add=button('add','New terminal',()=> list()?.querySelector("button[aria-label='New terminal']")?.click())
add.dataset.claudeTerminalHeader='add'
}
const tabs=syncTabs(strip,tablist)
const before=tabs || tablist
if(before.nextElementSibling !==add)before.after(add)
let actions=strip.querySelector("[data-claude-terminal-header='actions']")
if(!actions){
actions=doc.createElement('span')
actions.dataset.claudeTerminalHeader='actions'
const more=button('more','Terminal options',element=> root.dispatchEvent(new win.CustomEvent('claude-terminal-menu',{detail:element})))
more.setAttribute('aria-haspopup','menu')
more.setAttribute('aria-expanded','false')
actions.append(
more,
expandButton('terminal','Expand terminal'),
button('close','Close pane',()=>{
strip.querySelector("button[aria-label='Hide']")?.click()
if(expanded()==='terminal')setExpanded('')
})
)
setExpanded(expanded())
}
if(strip.lastElementChild !==actions)strip.append(actions)
}
for(const strip of doc.querySelectorAll('[data-zone-tabstrip][data-claude-plugin-zone]')){
let actions=strip.querySelector(":scope > [data-claude-terminal-header='plugin-actions']")
if(!actions){
const title=strip.querySelector("[role='tab'] span.truncate")?.textContent.trim()|| 'panel'
actions=doc.createElement('span')
actions.dataset.claudeTerminalHeader='plugin-actions'
actions.append(button('close','Close ' + title,()=> strip.querySelector("button[aria-label='Minimize']")?.click()))
}
if(actions.parentElement !==strip)strip.append(actions)
const head=strip.closest('[data-panel-header]')
if(head && !head.hasAttribute('data-claude-plugin-head'))head.setAttribute('data-claude-plugin-head','')
}
for(const actions of doc.querySelectorAll("[data-claude-terminal-header='plugin-actions']"))if(!actions.parentElement?.hasAttribute('data-claude-plugin-zone'))actions.remove()
for(const head of doc.querySelectorAll('[data-claude-plugin-head]'))if(!head.querySelector('[data-zone-tabstrip][data-claude-plugin-zone]'))head.removeAttribute('data-claude-plugin-head')
repairMisplaced()
repairMisplacedFiles()
guardClosed()
for(const strip of doc.querySelectorAll('[data-zone-tabstrip]')){
const asideOf=tab=> doc.querySelector('aside[data-preview-browser="' + win.CSS.escape((tab.getAttribute('data-tree-tab')|| '').slice('preview-tile:'.length))+ '"]')
const active=strip.querySelector("[role='tab'][aria-selected='true'][data-tree-tab^='preview-tile:url:']")
const aside=active && asideOf(active)
let actions=strip.querySelector("[data-claude-terminal-header='browser-actions']")
if(!aside){
actions?.remove()
if(strip.hasAttribute('data-claude-browser-strip'))strip.removeAttribute('data-claude-browser-strip')
continue
}
setAttr(strip,'data-claude-browser-strip','')
for(const tab of strip.querySelectorAll("[role='tab'][data-tree-tab^='preview-tile:url:']")){
const address=asideOf(tab)?.querySelector("input[aria-label='Address']")?.value || ''
const blank=!address || address==='about:blank'
if(tab.hasAttribute('data-claude-blank')!==blank)tab.toggleAttribute('data-claude-blank',blank)
}
const newTab=strip.querySelector("button[aria-label='New tab']")
const full=strip.querySelectorAll("[role='tab'][data-tree-tab^='preview-tile:url:']").length >=CLAUDE_BROWSER_TAB_LIMIT
if(newTab && newTab.hasAttribute('data-claude-tab-limit')!==full)newTab.toggleAttribute('data-claude-tab-limit',full)
if(!full && tabLimitTip && !tabLimitTip.hidden)tabLimitTip.hidden=true
const consoleButton=aside.querySelector("button[aria-label$='preview console']")
if(!actions){
actions=doc.createElement('span')
actions.dataset.claudeTerminalHeader='browser-actions'
const logs=button('logs','Show console',()=>{
const native=doc.querySelector("[data-claude-terminal-header='browser-actions']")?.closest('[data-zone-tabstrip]')&&[...doc.querySelectorAll("aside[data-preview-browser] button[aria-label$='preview console']")].find(node=> node.closest('aside').checkVisibility({visibilityProperty:true}))
native?.click()
schedule()
})
logs.dataset.claudeBrowserLogs=''
const more=button('more','Browser options',element=> root.dispatchEvent(new win.CustomEvent('claude-browser-menu',{detail:element})))
more.setAttribute('aria-haspopup','menu')
more.setAttribute('aria-expanded','false')
actions.append(logs,more,expandButton('browser','Expand browser'),button('close','Close browser',()=>{
setKeptClosed(true)
guarding=true
if(expanded()==='browser')setExpanded('')
closeCard(actions.closest('[data-zone-tabstrip]')|| strip)
}))
setExpanded(expanded())
}
const logs=actions.querySelector('[data-claude-browser-logs]')
const logsOn=consoleButton?.getAttribute('aria-pressed')==='true'
setAttr(logs,'aria-pressed',logsOn?'true':'false')
setAttr(logs,'aria-label',logsOn?'Hide console':'Show console')
setAttr(logs,'title',logs.getAttribute('aria-label'))
if(actions.parentElement !==strip)strip.append(actions)
}
for(const aside of doc.querySelectorAll('aside[data-preview-browser]')){
const input=aside.querySelector("input[aria-label='Address']")
if(input && input.placeholder !=='Type a URL'){
if(!('claudeNativePlaceholder' in input.dataset))input.dataset.claudeNativePlaceholder=input.placeholder
input.placeholder='Type a URL'
}
const empty=aside.querySelector('i.codicon-globe')?.parentElement
if(empty && !empty.hasAttribute('data-claude-browser-empty'))empty.setAttribute('data-claude-browser-empty','')
}
const filesHeader=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [class*='group/project-header']")
if(filesHeader){
setAttr(filesHeader,'data-claude-files-header','true')
let actions=filesHeader.querySelector("[data-claude-terminal-header='files-actions']")
if(!actions){
actions=doc.createElement('span')
actions.dataset.claudeTerminalHeader='files-actions'
actions.append(searchButton(),treeButton(),moreButton(),expandButton('files','Expand Files'),button('close','Close Files',closeFiles))
setExpanded(expanded())
syncTreeButtons()
}
if(filesHeader.lastElementChild !==actions)filesHeader.append(actions)
}
for(const tab of doc.querySelectorAll("[data-tree-group]:not([data-pane-host]) [role='tab'][aria-selected='true'][data-tree-tab^='preview-tile:file:']")){
const zone=tab.closest('[data-tree-group]')
let name=''
try{name=decodeURIComponent((tab.getAttribute('data-tree-tab')|| '').split('/').pop()|| '')}catch{name=''}
for(const bar of zone.querySelectorAll("div[class~='h-7'][class~='justify-end'][class~='border-b']")){
if(bar.dataset.claudeFileName !==name)bar.dataset.claudeFileName=name
for(const mode of bar.querySelectorAll(':scope > button')){
const text=mode.textContent.trim()
const kind=/source|forr/i.test(text)?'source':/render|preview|el.n.zet/i.test(text)?'rendered':'diff'
if(mode.dataset.claudeMode !==kind)mode.dataset.claudeMode=kind
const title=kind==='source'?'View source':kind==='rendered'?'Preview':text
if(!('claudeNativeTitle' in mode.dataset))mode.dataset.claudeNativeTitle=mode.getAttribute('title')|| ''
if(mode.title !==title)mode.title=title
}
}
}
const projectTree=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
if(projectTree && projectTree.nextElementSibling?.hasAttribute('data-claude-files-empty')!==true){
doc.querySelectorAll('[data-claude-files-empty]').forEach(node=> node.remove())
const empty=doc.createElement('div')
empty.setAttribute('data-claude-files-empty','')
const icon=doc.createElementNS('http://www.w3.org/2000/svg','svg')
icon.setAttribute('viewBox','0 0 16 16')
icon.setAttribute('fill','none')
icon.setAttribute('stroke','currentColor')
icon.setAttribute('stroke-width','1.1')
icon.setAttribute('stroke-linejoin','round')
icon.setAttribute('aria-hidden','true')
icon.innerHTML=CLAUDE_TERMINAL_ICONS.folder
const title=doc.createElement('strong')
title.textContent='Open files appear here'
const hint=doc.createElement('span')
hint.textContent='Click a file path in the conversation to open it.'
const splitHint=doc.createElement('span')
splitHint.setAttribute('data-claude-files-empty-split','')
splitHint.textContent='Pick a file in the tree, or click a file path in the conversation.'
empty.append(icon,title,hint,splitHint)
projectTree.after(empty)
}
const fileStrip=(root.hasAttribute('data-claude-file-joined')|| root.hasAttribute('data-claude-file-over'))&& doc.querySelector('[data-claude-preview-column] [data-zone-tabstrip]')
for(const node of doc.querySelectorAll("[data-claude-file-actions]"))if(node.parentElement !==fileStrip)node.remove()
if(fileStrip){
let actions=fileStrip.querySelector("[data-claude-file-actions]")
if(!actions){
actions=doc.createElement('span')
actions.dataset.claudeFileActions='true'
actions.append(searchButton(),treeButton(),moreButton(),expandButton('files','Expand Files'),button('close','Close Files',closeFiles))
setExpanded(expanded())
syncTreeButtons()
}
if(fileStrip.lastElementChild !==actions)fileStrip.append(actions)
}
syncTreeButtons()
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const browserShown=()=>[...doc.querySelectorAll('aside[data-preview-browser]')].some(node=> node.checkVisibility({visibilityProperty:true}))
const KEPT_CLOSED='claude-skin:browser-kept-closed'
let keptClosed=false,allowUntil=0,guarding=false,passClose=false,keyUntil=0,wasShown=null
let switchUntil=0
const bootUntil=Date.now()+ 5000
try{keptClosed=win.localStorage.getItem(KEPT_CLOSED)==='1'}catch{keptClosed=false}
const setKeptClosed=on=>{
keptClosed=on
if(on)allowUntil=0
try{if(on)win.localStorage.setItem(KEPT_CLOSED,'1');else win.localStorage.removeItem(KEPT_CLOSED)}catch{}
}
const SUPPRESSED='data-claude-browser-suppressed'
const allowOpen=()=>{allowUntil=Date.now()+ 5000;setKeptClosed(false);doc.documentElement.removeAttribute(SUPPRESSED)}
const shownStrip=()=>{
const aside=[...doc.querySelectorAll('aside[data-preview-browser]')].find(node=> node.checkVisibility({visibilityProperty:true}))
const zone=aside?.closest('[data-tree-group]')?.getAttribute('data-tree-group')
return zone?doc.querySelector('[data-zone-tabstrip="' + win.CSS.escape(zone)+ '"]'):null
}
const closeCard=(strip,done=()=>{})=>{
guarding=true
let rounds=0
const step=()=>{
const tabs=strip?.isConnected?[...strip.querySelectorAll("[role='tab'][data-tree-tab^='preview-tile:url:']")]:[]
if(disposed || !tabs.length || ++rounds > CLAUDE_BROWSER_TAB_LIMIT + 3){guarding=false;done();return}
const tab=tabs.find(node=> node.getAttribute('aria-selected')!=='true')|| tabs[0]
passClose=true
try{tab.querySelector("button[aria-label='Close']")?.click()}finally{passClose=false}
win.setTimeout(step,200)
}
step()
}
const shutBrowser=()=>{
const strip=shownStrip()
if(!strip)return
doc.documentElement.setAttribute(SUPPRESSED,'')
closeCard(strip,()=> doc.documentElement.removeAttribute(SUPPRESSED))
}
let switchWatch=0
const onSessionSwitch=()=>{
switchUntil=Date.now()+ 3000
if(!keptClosed || Date.now()< allowUntil)return
doc.documentElement.setAttribute(SUPPRESSED,'')
win.clearTimeout(switchWatch)
let polls=0
const look=()=>{
if(disposed)return
const front=doc.querySelector("[data-zone-tabstrip] [role='tab'][data-tree-tab^='preview-tile:url:'][aria-selected='true']")
if(front && keptClosed){closeCard(front.closest('[data-zone-tabstrip]'),()=> doc.documentElement.removeAttribute(SUPPRESSED));return}
if(++polls < 12){switchWatch=win.setTimeout(look,100);return}
doc.documentElement.removeAttribute(SUPPRESSED)
}
switchWatch=win.setTimeout(look,100)
}
win.addEventListener('hashchange',onSessionSwitch)
let offSessionWatch=null
try{const atom=api?.state?.focusedStoredSessionId;if(typeof atom?.listen==='function')offSessionWatch=atom.listen(()=> onSessionSwitch())}catch{offSessionWatch=null}
const onRowPress=event=>{if(event.isTrusted && event.target?.closest?.("[data-slot='sidebar'] [data-slot='row-button'], [data-slot='sidebar'] [data-slot='context-menu-trigger']"))onSessionSwitch()}
doc.addEventListener('pointerdown',onRowPress,true)
const guardClosed=()=>{
const shown=browserShown(),changed=wasShown !==null && shown !==wasShown
const now=Date.now(),restoring=wasShown===null || now < switchUntil || now < bootUntil
wasShown=shown
if(changed && !guarding && now < keyUntil && now >=switchUntil){if(shown)allowOpen();else setKeptClosed(true);return}
if(!keptClosed || guarding || now <=allowUntil || !shown)return
if(restoring)shutBrowser()
else if(changed)allowOpen()
}
const onGlobeClose=event=>{
if(!event.isTrusted || !event.target?.closest?.("[data-claude-pane-tool='globe']")|| !browserShown())return
event.preventDefault()
event.stopImmediatePropagation()
setKeptClosed(true)
if(expanded()==='browser')setExpanded('')
closeCard(shownStrip())
}
const onIntent=event=>{
if(!event.isTrusted)return
const target=event.target
if(target?.closest?.("[data-claude-pane-tool='globe']")){if(browserShown())setKeptClosed(true);else allowOpen();return}
if(target?.closest?.('a[href]'))allowOpen()
}
const onKeyIntent=event=>{
if(!event.isTrusted || !(event.ctrlKey || event.metaKey || event.altKey)|| /^(Control|Meta|Alt|Shift)$/.test(event.key))return
keyUntil=Date.now()+ 1500
win.setTimeout(guardClosed,120)
win.setTimeout(guardClosed,400)
}
const offPreviewOpen=typeof api?.onEvent==='function'?api.onEvent('preview.open',allowOpen):null
const MAIN_PREVIEWS="[data-tree-group='grp-main']:not([data-pane-host]) > [data-panel-header] [role='tab'][data-tree-tab^='preview-tile:']"
const docked=new Set()
let pressed={id:'',down:false,at:0}
const onTabPress=event=>{
if(!event.isTrusted)return
if(event.type !=='pointerdown'){if(pressed.down)pressed={...pressed,down:false,at:Date.now()};return}
const strip=event.target?.closest?.('[data-zone-tabstrip]')
const tab=strip &&(event.target.closest("[role='tab']")|| strip.querySelector("[role='tab'][aria-selected='true']"))
pressed={id:tab?.getAttribute('data-tree-tab')|| '',down:true,at:Date.now()}
}
const userDocked=()=>{
const inMain=[...doc.querySelectorAll(MAIN_PREVIEWS)].map(tab=> tab.getAttribute('data-tree-tab'))
for(const id of docked)if(!inMain.includes(id)&& doc.querySelector("[data-tree-group]:not([data-tree-group='grp-main']) [role='tab'][data-tree-tab='" + win.CSS.escape(id)+ "']"))docked.delete(id)
if(pressed.id && inMain.includes(pressed.id)&&(pressed.down || Date.now()- pressed.at < 1500))docked.add(pressed.id)
return inMain.some(id=> docked.has(id))
}
let repairs=[]
const repairMisplaced=()=>{
const tab=doc.querySelector("[data-tree-group='grp-main']:not([data-pane-host]) > [data-panel-header] [role='tab'][data-tree-tab^='preview-tile:url:']")
if(!tab || userDocked())return
const now=Date.now()
repairs=repairs.filter(time=> now - time < 15000)
if(repairs.length >=3)return
repairs.push(now)
const id=(tab.getAttribute('data-tree-tab')|| '').slice('preview-tile:'.length)
const webview=doc.querySelector('aside[data-preview-browser="' + win.CSS.escape(id)+ '"] webview')
let url=''
try{url=webview?.getURL()|| ''}catch{url=''}
tab.querySelector("button[aria-label='Close']")?.click()
win.setTimeout(()=>{
if(disposed || browserShown())return
doc.querySelector("[data-claude-pane-tool='globe']")?.click()
if(!url || url==='about:blank')return
let tries=0
const go=()=>{
if(disposed)return
const input=[...doc.querySelectorAll("aside[data-preview-browser] input[aria-label='Address']")].find(node=> node.closest('aside').checkVisibility({visibilityProperty:true}))
if(!input){if(++tries < 20)win.setTimeout(go,100);return}
Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(input,url)
input.dispatchEvent(new win.Event('input',{bubbles:true}))
input.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))
input.blur()
}
win.setTimeout(go,200)
},250)
}
let fileRepairs=[]
const repairMisplacedFiles=()=>{
const tabs=[...doc.querySelectorAll("[data-tree-group='grp-main']:not([data-pane-host]) > [data-panel-header] [role='tab'][data-tree-tab^='preview-tile:file:']")]
if(!tabs.length || userDocked())return
const now=Date.now()
fileRepairs=fileRepairs.filter(time=> now - time < 15000)
if(fileRepairs.length >=12)return
fileRepairs.push(now)
const canon=path=> String(path || '').replace(/\\/g,'/').replace(/^\/(?=[A-Za-z]:\/)/,'')
const pathOf=tab=>{
const id=(tab.getAttribute('data-tree-tab')|| '').replace(/#\d+$/,'')
const at=id.indexOf('file://')
if(at < 0)return ''
try{return canon(decodeURIComponent(id.slice(at + 'file://'.length)))}catch{return ''}
}
const reopen=pathOf(tabs.find(tab=> tab.getAttribute('aria-selected')==='true')|| tabs[0])
for(const tab of tabs)tab.querySelector("button[aria-label='Close']")?.click()
if(!reopen)return
win.setTimeout(()=>{
if(disposed)return
const row=[...doc.querySelectorAll("[data-tree-group='grp-files'] [role='treeitem']")].find(node=> canon(node.querySelector('[title]')?.title)===reopen && node.checkVisibility())
if(row){row.click();return}
const element=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
const key=element && Object.keys(element).find(name=> name.startsWith('__reactFiber$'))
for(let fiber=key?element[key]:null,depth=0;fiber && depth < 8;fiber=fiber.return,depth++){
const open=fiber.memoizedProps?.onPreviewFile
if(typeof open==='function'){open(reopen);return}
}
},300)
}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [data-tree-group='grp-sessions'] *, [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected','aria-pressed','value']})
observer.observe(root,{attributes:true,attributeFilter:['data-claude-file-joined','data-claude-file-over',FILES_VIEW]})
tabsResize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(()=> schedule()):null
const onAddress=event=>{if(event.target?.matches?.("aside[data-preview-browser] input[aria-label='Address']"))schedule()}
doc.addEventListener('input',onAddress,true)
doc.addEventListener('focusout',onAddress,true)
const onPaneTool=event=>{if(expanded()&& event.target?.closest?.('[data-claude-pane-tool]'))setExpanded('')}
doc.addEventListener('click',onPaneTool,true)
const limited=event=> event.target?.closest?.('button[data-claude-tab-limit]')
const onLimitPress=event=>{if(limited(event)){event.preventDefault();event.stopImmediatePropagation()}}
const onLimitOver=event=>{
const button=limited(event)
if(!button){if(tabLimitTip && !tabLimitTip.hidden)tabLimitTip.hidden=true;return}
if(!tabLimitTip){
tabLimitTip=doc.createElement('div')
tabLimitTip.setAttribute('data-claude-tab-limit-tip','')
tabLimitTip.setAttribute('role','tooltip')
tabLimitTip.textContent='Tab limit reached. Close a tab to open a new one.'
doc.body.append(tabLimitTip)
}
const box=button.getBoundingClientRect()
tabLimitTip.hidden=false
const width=tabLimitTip.offsetWidth
tabLimitTip.style.left=Math.max(8,Math.min(win.innerWidth - width - 8,box.left + box.width / 2 - width / 2))+ 'px'
tabLimitTip.style.top=(box.bottom + 6)+ 'px'
}
for(const type of['pointerdown','mousedown','click'])doc.addEventListener(type,onLimitPress,true)
const lastTabClose=event=>{
if(passClose || doc.documentElement.hasAttribute('data-claude-pass-close'))return
const middle=event.button===1
const tab=middle
?event.target?.closest?.("[data-claude-browser-strip] [role='tab'][data-tree-tab^='preview-tile:url:']")
:event.target?.closest?.("[data-claude-browser-strip] [role='tab'][data-tree-tab^='preview-tile:url:'] button[aria-label='Close']")?.closest("[role='tab']")
const strip=tab?.closest('[data-claude-browser-strip]')
const tabs=strip?.querySelectorAll("[role='tab']")
if(!strip || tabs.length !==1)return
let stored='unknown'
try{const atom=api?.state?.focusedStoredSessionId;if(atom?.get)stored=atom.get()??null}catch{stored='unknown'}
if(stored===null)return
event.preventDefault()
event.stopImmediatePropagation()
if(event.type !==(middle?'auxclick':'click'))return
if(tab.hasAttribute('data-claude-blank'))return
const aside=doc.querySelector('aside[data-preview-browser="' + win.CSS.escape((tab.getAttribute('data-tree-tab')|| '').slice('preview-tile:'.length))+ '"]')
const input=aside?.querySelector("input[aria-label='Address']")
const webview=aside?.querySelector('webview')
if(!input)return
Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(input,'about:blank')
input.dispatchEvent(new win.Event('input',{bubbles:true}))
input.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))
input.blur()
let tries=0
const forget=()=>{
if(disposed || !webview?.isConnected)return
let url=''
try{url=webview.getURL()}catch{url=''}
if(url==='about:blank'){try{webview.clearHistory();webview.reload()}catch{}schedule();return}
if(++tries < 40)win.setTimeout(forget,50)
}
win.setTimeout(forget,50)
}
for(const type of['pointerdown','pointerup','mousedown','mouseup','click','auxclick'])doc.addEventListener(type,lastTabClose,true)
doc.addEventListener('pointerover',onLimitOver,true)
doc.addEventListener('pointerdown',onIntent,true)
for(const type of['pointerdown','pointerup','pointercancel'])doc.addEventListener(type,onTabPress,true)
doc.addEventListener('click',onGlobeClose,true)
doc.addEventListener('keydown',onKeyIntent,true)
place()
return()=>{
disposed=true
observer.disconnect()
tabsResize?.disconnect()
doc.removeEventListener('click',onPaneTool,true)
for(const type of['pointerdown','mousedown','click'])doc.removeEventListener(type,onLimitPress,true)
for(const type of['pointerdown','pointerup','mousedown','mouseup','click','auxclick'])doc.removeEventListener(type,lastTabClose,true)
doc.removeEventListener('pointerover',onLimitOver,true)
doc.removeEventListener('pointerdown',onIntent,true)
for(const type of['pointerdown','pointerup','pointercancel'])doc.removeEventListener(type,onTabPress,true)
doc.removeEventListener('click',onGlobeClose,true)
win.removeEventListener('hashchange',onSessionSwitch)
if(typeof offSessionWatch==='function')offSessionWatch()
doc.removeEventListener('pointerdown',onRowPress,true)
win.clearTimeout(switchWatch)
doc.documentElement.removeAttribute(SUPPRESSED)
doc.removeEventListener('keydown',onKeyIntent,true)
if(typeof offPreviewOpen==='function')offPreviewOpen()
tabLimitTip?.remove()
doc.querySelectorAll('[data-claude-tab-limit]').forEach(node=> node.removeAttribute('data-claude-tab-limit'))
doc.removeEventListener('input',onAddress,true)
doc.removeEventListener('focusout',onAddress,true)
doc.querySelectorAll('[data-claude-browser-strip]').forEach(node=> node.removeAttribute('data-claude-browser-strip'))
doc.querySelectorAll('[data-claude-plugin-head]').forEach(node=> node.removeAttribute('data-claude-plugin-head'))
doc.querySelectorAll("[data-claude-terminal-header='plugin-actions']").forEach(node=> node.remove())
doc.querySelectorAll('[data-claude-blank]').forEach(node=> node.removeAttribute('data-claude-blank'))
doc.querySelectorAll('[data-claude-browser-empty]').forEach(node=> node.removeAttribute('data-claude-browser-empty'))
doc.querySelectorAll('aside[data-preview-browser] input[data-claude-native-placeholder]').forEach(input=>{input.placeholder=input.dataset.claudeNativePlaceholder;delete input.dataset.claudeNativePlaceholder})
if(frame)win.cancelAnimationFrame(frame)
doc.querySelectorAll('[data-claude-terminal-header]').forEach(node=> node.remove())
doc.querySelectorAll('[data-claude-terminal-tabs]').forEach(node=>{delete node.dataset.claudeTerminalTabs})
doc.querySelectorAll('[data-claude-files-header]').forEach(node=>{delete node.dataset.claudeFilesHeader})
doc.querySelectorAll('[data-claude-file-actions]').forEach(node=> node.remove())
doc.querySelectorAll('[data-claude-native-title]').forEach(node=>{
if(node.dataset.claudeNativeTitle)node.title=node.dataset.claudeNativeTitle
else node.removeAttribute('title')
delete node.dataset.claudeNativeTitle
})
doc.querySelectorAll('[data-claude-mode]').forEach(node=>{delete node.dataset.claudeMode})
doc.querySelectorAll('[data-claude-file-name]').forEach(node=>{delete node.dataset.claudeFileName})
doc.querySelectorAll('[data-claude-files-empty]').forEach(node=> node.remove())
root.removeAttribute(EXPANDED)
}
}
const CLAUDE_FILTER_SKIP=new Set(['node_modules','.git','.hg','.svn','__pycache__','.venv','venv','.tox','.mypy_cache','.pytest_cache','.ruff_cache','.next','.nuxt','.turbo','.cache','.gradle','.idea','.vs','dist','build','target','coverage','.npm','.nuget','.yarn','.cargo','.rustup','.dotnet','.docker'])
const CLAUDE_FILTER_MAX=40000
const CLAUDE_FILTER_SHOWN=200
const CLAUDE_FILE_ICONS={
search:'<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25 13.25 13.25"/>',
preview:'<path d="M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/>',
done:'<path d="M3.25 8.25 6.5 11.5l6.25-7"/>',
check:'<path d="M3.5 8.25 6.5 11.25 12.5 4.75"/>',
chevron:'<path d="M6.25 3.75 10.5 8l-4.25 4.25"/>',
chevronDown:'<path d="M4 6.25 8 10.25l4-4"/>',
close:'<path d="M4.75 4.75l6.5 6.5M11.25 4.75l-6.5 6.5"/>'
}
const CLAUDE_FILES_SETTINGS_KEY='claude-chat-look.files-settings'
const CLAUDE_TERMINAL_SETTINGS_KEY='claude-chat-look.terminal-settings'
const CLAUDE_TERMINAL_DEFAULTS={cursorStyle:'block',cursorBlink:true,copyOnSelect:false,scrollback:10000}
const CLAUDE_FILES_DEFAULTS={treePosition:'auto',previewTabs:true,autoSave:true,tabIndents:true,wordWrap:true,indentGuides:true,showWhitespace:false,scrollPastEnd:false,tabSize:4}
const CLAUDE_ANNOTATE_COLORS=['#e5484d','#3b82f6','#30a46c','#1c1c1c','#ffffff']
const CLAUDE_ANNOTATE_WIDTHS=[2,4,7,11]
const CLAUDE_ANNOTATE_SHAPES=[['line','Line'],['arrow','Arrow'],['rectangle','Rectangle'],['ellipse','Ellipse'],['step','Step']]
const CLAUDE_ANNOTATE_ICONS={
select:'<path d="M3.75 2.75 12.5 6.6 8.9 7.8l3.35 3.35-1.35 1.35L7.55 9.15l-1.2 3.6z"/>',
pen:'<path d="M10.6 2.9a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5l-3 .8.8-3z"/><path d="m9.6 3.9 2.3 2.3"/>',
line:'<path d="M3 13 13 3"/>',
arrow:'<path d="M3 13 13 3"/><path d="M7 3h6v6"/>',
rectangle:'<rect x="3" y="3.5" width="10" height="9" rx="1"/>',
ellipse:'<circle cx="8" cy="8" r="5"/>',
step:'<circle cx="8" cy="8" r="5.5"/><path d="M7.2 6.4 8.4 5.6v5"/>',
text:'<path d="M3.5 3.5h9M8 3.5v9.5M6.2 13h3.6"/>',
chevron:'<path d="m5 6.5 3 3 3-3"/>',
close:'<path d="m4 4 8 8M12 4l-8 8"/>',
check:'<path d="m3.5 8.5 3 3 6-7"/>'
}
function claudeAnnotatePage(){
if(window.__claudeAnnotate)return
const NS='http://www.w3.org/2000/svg'
const host=document.createElement('claude-annotate')
host.setAttribute('aria-hidden','true')
host.style.cssText='all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:auto;cursor:default;'
const root=host.attachShadow({mode:'open'})
root.innerHTML='<style>' +
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
const svg=document.createElementNS(NS,'svg')
const hover=['m','p','c'].map(name=>{const d=document.createElement('div');d.className='box ' + name;d.style.display='none';return d})
const card=document.createElement('div')
card.className='card'
const pickLayer=document.createElement('div')
root.append(...hover,pickLayer,svg,card)
const state={tool:'select',shape:'rectangle',color:'#e5484d',width:4,version:0,ended:false}
const marks=[]
const picks=[]
const history=[]
const bump=()=>{state.version++}
const under=(x,y)=>{
host.style.pointerEvents='none'
const element=document.elementFromPoint(x,y)
host.style.pointerEvents='auto'
return element && element !==host && element !==document.documentElement?element:null
}
const ROLES={a:el=> el.hasAttribute('href')?'link':'generic',article:'article',aside:'complementary',button:'button',dialog:'dialog',footer:'contentinfo',form:'form',h1:'heading',h2:'heading',h3:'heading',h4:'heading',h5:'heading',h6:'heading',header:'banner',hr:'separator',img:'img',li:'listitem',main:'main',nav:'navigation',ol:'list',option:'option',p:'paragraph',progress:'progressbar',section:'region',select:'combobox',table:'table',tbody:'rowgroup',td:'cell',textarea:'textbox',th:'columnheader',thead:'rowgroup',tr:'row',ul:'list',label:'LabelText',body:'generic',div:'generic',span:'generic',
input:el=>({checkbox:'checkbox',radio:'radio',range:'slider',button:'button',submit:'button',reset:'button',search:'searchbox',number:'spinbutton'})[el.type]|| 'textbox'}
const roleOf=el=>{const own=el.getAttribute('role');if(own)return own;const r=ROLES[el.localName];return typeof r==='function'?r(el):r || 'generic'}
const FROM_CONTENT=new Set(['button','link','heading','listitem','option','cell','columnheader','tab','menuitem','checkbox','radio'])
const clip=(text,n)=>{const t=String(text || '').replace(/\s+/g,' ').trim();return t.length > n?t.slice(0,n - 1)+ '…':t}
const nameOf=el=>{
const label=el.getAttribute('aria-label');if(label)return clip(label,80)
const by=el.getAttribute('aria-labelledby');if(by)return clip(by.split(/\s+/).map(id=> document.getElementById(id)?.textContent || '').join(' '),80)
if(el.localName==='img')return clip(el.getAttribute('alt'),80)
if(el.labels?.length)return clip(el.labels[0].textContent,80)
if(FROM_CONTENT.has(roleOf(el)))return clip(el.textContent,80)
return clip(el.getAttribute('title'),80)
}
const focusable=el=> el.tabIndex >=0 && !el.disabled && el.getAttribute('aria-hidden')!=='true'
const selectorOf=el=>{
const parts=[]
for(let node=el;node && node.nodeType===1 && node !==document.documentElement;node=node.parentElement){
if(node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length===1){parts.unshift('#' + CSS.escape(node.id));break}
let part=node.localName
const same=node.parentElement?[...node.parentElement.children].filter(n=> n.localName===node.localName):[]
if(same.length > 1)part +=':nth-of-type(' +(same.indexOf(node)+ 1)+ ')'
parts.unshift(part)
}
return parts.join(' > ')
}
const place=(node,x,y,w,h)=>{node.style.left=x + 'px';node.style.top=y + 'px';node.style.width=Math.max(0,w)+ 'px';node.style.height=Math.max(0,h)+ 'px'}
const hideHover=()=>{hover.forEach(d=>{d.style.display='none'});card.style.display='none'}
const showHover=el=>{
const r=el.getBoundingClientRect()
const s=getComputedStyle(el)
const n=k=> parseFloat(s[k])|| 0
const mt=n('marginTop'),mr=n('marginRight'),mb=n('marginBottom'),ml=n('marginLeft')
const bt=n('borderTopWidth')+ n('paddingTop'),br=n('borderRightWidth')+ n('paddingRight'),bb=n('borderBottomWidth')+ n('paddingBottom'),bl=n('borderLeftWidth')+ n('paddingLeft')
place(hover[0],r.left - ml,r.top - mt,r.width + ml + mr,r.height + mt + mb)
place(hover[1],r.left,r.top,r.width,r.height)
place(hover[2],r.left + bl,r.top + bt,r.width - bl - br,r.height - bt - bb)
hover.forEach(d=>{d.style.display='block'})
const size=(Math.round(r.width * 10)/ 10)+ ' × ' +(Math.round(r.height * 10)/ 10)
card.textContent=''
const row=(cls,a,b)=>{const d=document.createElement('div');d.className=cls;const x=document.createElement('span');x.textContent=a;const y=document.createElement('span');y.textContent=b;d.append(x,y);return d}
const head=row('h',el.localName,size)
head.firstChild.className='t'
head.lastChild.className='s'
const section=document.createElement('div')
section.className='a'
section.textContent='ACCESSIBILITY'
card.append(head,section,row('r','Name',nameOf(el)),row('r','Role',roleOf(el)),row('r','Keyboard-focusable',focusable(el)?'✓':'⃠'))
card.style.display='block'
const cw=card.offsetWidth,ch=card.offsetHeight
const below=r.bottom + mb + 8
const top=below + ch < innerHeight?below:Math.max(4,r.top - mt - ch - 8)
card.style.left=Math.max(4,Math.min(innerWidth - cw - 4,r.left))+ 'px'
card.style.top=Math.min(innerHeight - ch - 4,top)+ 'px'
}
const layoutPicks=()=> picks.forEach(({element,box})=>{const r=element.getBoundingClientRect();place(box,r.left,r.top,r.width,r.height)})
const togglePick=el=>{
const at=picks.findIndex(p=> p.element===el)
if(at >=0){picks[at].box.remove();picks.splice(at,1)}else{
const box=document.createElement('div')
box.className='pick'
box.append(document.createElement('b'))
pickLayer.append(box)
picks.push({element:el,box})
history.push(['pick',el])
}
picks.forEach((p,i)=>{p.box.firstChild.textContent=String(i + 1)})
layoutPicks()
bump()
}
const shape=(name,attrs)=>{const node=document.createElementNS(NS,name);for(const k in attrs)node.setAttribute(k,attrs[k]);return node}
const stroke=()=>({stroke:state.color,'stroke-width':state.width,'stroke-linecap':'round','stroke-linejoin':'round',fill:'none'})
const arrowHead=(x1,y1,x2,y2)=>{
const a=Math.atan2(y2 - y1,x2 - x1),len=8 + state.width * 2.2
const p=s=>(x2 - len * Math.cos(a + s))+ ',' +(y2 - len * Math.sin(a + s))
return p(0.45)+ ' ' + x2 + ',' + y2 + ' ' + p(-0.45)
}
const drawShape=(node,kind,x1,y1,x2,y2)=>{
if(kind==='line' || kind==='arrow'){
node.firstChild.setAttribute('d','M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2)
if(kind==='arrow')node.lastChild.setAttribute('points',arrowHead(x1,y1,x2,y2))
}else if(kind==='rectangle'){
Object.entries({x:Math.min(x1,x2),y:Math.min(y1,y2),width:Math.abs(x2 - x1),height:Math.abs(y2 - y1)}).forEach(([k,v])=> node.firstChild.setAttribute(k,v))
}else{
Object.entries({cx:(x1 + x2)/ 2,cy:(y1 + y2)/ 2,rx:Math.abs(x2 - x1)/ 2,ry:Math.abs(y2 - y1)/ 2}).forEach(([k,v])=> node.firstChild.setAttribute(k,v))
}
}
const addMark=node=>{marks.push(node);history.push(['mark',node]);bump()}
let drag=null,editing=null
const commitText=()=>{
const node=editing
editing=null
if(!node)return
node.contentEditable='false'
if(!node.textContent.trim()){node.remove();return}
addMark(node)
}
const startText=(x,y)=>{
const node=document.createElement('div')
node.className='text'
node.style.color=state.color
node.style.fontSize=(12 + state.width * 2)+ 'px'
node.style.left=x + 'px'
node.style.top=(y - 10)+ 'px'
node.contentEditable='true'
root.append(node)
editing=node
setTimeout(()=> node.focus(),0)
}
host.addEventListener('pointerdown',event=>{
if(event.button !==0)return
if(editing && event.composedPath().includes(editing))return
commitText()
const x=event.clientX,y=event.clientY
const tool=state.tool==='shape'?state.shape:state.tool
if(tool==='select'){const el=under(x,y);if(el)togglePick(el);return}
if(tool==='text'){event.preventDefault();startText(x,y);return}
if(tool==='step'){
const n=marks.filter(m=> m.dataset?.step).length + 1
const r=9 + state.width
const g=shape('g',{})
g.dataset.step=String(n)
g.append(shape('circle',{cx:x,cy:y,r,fill:state.color}),shape('text',{x,y,'text-anchor':'middle','dominant-baseline':'central',fill:state.color==='#ffffff'?'#1c1c1c':'#ffffff','font-size':r * 1.1,'font-weight':700,'font-family':'system-ui,sans-serif'}))
g.lastChild.textContent=String(n)
svg.append(g)
addMark(g)
return
}
host.setPointerCapture(event.pointerId)
const g=shape('g',stroke())
if(tool==='pen' || tool==='line')g.append(shape('path',{d:'M' + x + ' ' + y}))
else if(tool==='arrow')g.append(shape('path',{}),shape('polygon',{fill:state.color,stroke:'none'}))
else if(tool==='rectangle')g.append(shape('rect',{rx:2}))
else g.append(shape('ellipse',{}))
svg.append(g)
drag={tool,g,x,y,points:[x + ' ' + y]}
})
host.addEventListener('pointermove',event=>{
const x=event.clientX,y=event.clientY
if(drag){
if(drag.tool==='pen'){drag.points.push(x + ' ' + y);drag.g.firstChild.setAttribute('d','M' + drag.points.join('L'))}else drawShape(drag.g,drag.tool,drag.x,drag.y,x,y)
drag.moved=true
return
}
if(state.tool !=='select'){hideHover();return}
const el=under(x,y)
if(el)showHover(el);else hideHover()
})
const endDrag=()=>{
if(!drag)return
const d=drag
drag=null
if(!d.moved && d.tool !=='pen'){d.g.remove();return}
if(!d.moved)d.g.firstChild.setAttribute('d','M' + d.points[0]+ 'l0.01 0')
addMark(d.g)
}
host.addEventListener('pointerup',endDrag)
host.addEventListener('pointercancel',endDrag)
for(const type of['pointerdown','pointerup','mousedown','mouseup','click','dblclick','auxclick','contextmenu'])host.addEventListener(type,event=> event.stopPropagation())
host.addEventListener('pointerleave',()=>{if(!drag)hideHover()})
host.addEventListener('wheel',event=>{
host.style.pointerEvents='none'
let node=document.elementFromPoint(event.clientX,event.clientY)
host.style.pointerEvents='auto'
for(;node && node !==document.body && node !==document.documentElement;node=node.parentElement){
const s=getComputedStyle(node)
if(/(auto|scroll)/.test(s.overflowY + s.overflowX)&&(node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth))break
}
;(node && node !==document.body && node !==document.documentElement?node:document.scrollingElement || document.documentElement).scrollBy(event.deltaX,event.deltaY)
event.preventDefault()
},{passive:false})
const onKey=event=>{
if(editing){
if(event.key==='Escape' ||(event.key==='Enter' && !event.shiftKey)){event.preventDefault();editing.blur();commitText()}
return
}
if(event.key==='Escape'){event.preventDefault();state.ended=true;bump()}else if((event.ctrlKey || event.metaKey)&& event.key.toLowerCase()==='z'){
event.preventDefault()
const last=history.pop()
if(!last)return
if(last[0]==='mark'){last[1].remove();marks.splice(marks.indexOf(last[1]),1);bump()}else if(picks.some(p=> p.element===last[1]))togglePick(last[1])
}
}
const onScroll=()=>{layoutPicks();hideHover()}
window.addEventListener('keydown',onKey,true)
window.addEventListener('scroll',onScroll,true)
window.addEventListener('resize',onScroll)
document.documentElement.append(host)
window.__claudeAnnotate={
set(patch){commitText();Object.assign(state,patch);host.style.cursor=state.tool==='select'?'default':state.tool==='text'?'text':'crosshair';if(state.tool !=='select')hideHover();bump()},
state:()=>({tool:state.tool,shape:state.shape,color:state.color,width:state.width,marks:marks.length,picks:picks.length,version:state.version,ended:state.ended}),
beginCapture(){commitText();hideHover()},
picks:()=> picks.map(({element},i)=>({number:i + 1,tag:element.localName,role:roleOf(element),name:nameOf(element),text:clip(element.innerText || element.textContent,120),selector:selectorOf(element)})),
teardown(){
window.removeEventListener('keydown',onKey,true)
window.removeEventListener('scroll',onScroll,true)
window.removeEventListener('resize',onScroll)
host.remove()
delete window.__claudeAnnotate
}
}
}
function installClaudeBrowserAnnotate({document:doc=globalThis.document,window:win=globalThis.window}={}){
const PICKER="button[aria-label='Annotate']"
let session=null
const watch=new win.MutationObserver(()=>{if(session &&(!session.aside.isConnected || !session.aside.checkVisibility({visibilityProperty:true})))stop()})
const glyph=name=>{
const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg')
svg.setAttribute('viewBox','0 0 16 16')
svg.setAttribute('fill','none')
svg.setAttribute('stroke','currentColor')
svg.setAttribute('stroke-width','1.25')
svg.setAttribute('stroke-linecap','round')
svg.setAttribute('stroke-linejoin','round')
svg.setAttribute('aria-hidden','true')
svg.innerHTML=CLAUDE_ANNOTATE_ICONS[name]
return svg
}
const page=(webview,code)=> webview.executeJavaScript(code).catch(()=> null)
const composerTarget=()=>[...doc.querySelectorAll('[data-composer-target]')].find(node=> !node.closest('[data-pane-hidden]')&& node.checkVisibility())?.dataset.composerTarget || 'main'
const stop=()=>{
const s=session
if(!s)return
session=null
win.clearInterval(s.timer)
s.bar.remove()
s.aside.removeAttribute('data-claude-annotating')
doc.removeEventListener('pointerdown',s.onOutside,true)
watch.disconnect()
page(s.webview,'window.__claudeAnnotate && window.__claudeAnnotate.teardown()')
}
const start=aside=>{
const webview=aside.querySelector('webview')
if(!webview)return
const bar=doc.createElement('div')
bar.setAttribute('data-claude-annotate-bar','')
bar.setAttribute('role','toolbar')
bar.setAttribute('aria-label','Annotate')
const s={aside,webview,bar,state:null,menu:null,timer:0}
session=s
aside.setAttribute('data-claude-annotating','')
const set=patch=> page(webview,'window.__claudeAnnotate && window.__claudeAnnotate.set(' + JSON.stringify(patch)+ ')').then(sync)
const button=(name,label,onClick,extra)=>{
const node=doc.createElement('button')
node.type='button'
node.setAttribute('aria-label',label)
node.title=label
node.dataset.claudeAnnotateTool=name
if(extra)node.append(extra);else node.append(glyph(name))
node.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();onClick(node)})
return node
}
const closeMenu=()=>{s.menu?.remove();s.menu=null;bar.querySelectorAll('[aria-expanded]').forEach(node=> node.setAttribute('aria-expanded','false'))}
const openMenu=(anchor,rows)=>{
const again=s.menu?.dataset.for===anchor.dataset.claudeAnnotateTool
closeMenu()
if(again)return
const menu=doc.createElement('div')
menu.setAttribute('data-claude-annotate-menu','')
menu.setAttribute('role','menu')
menu.dataset.for=anchor.dataset.claudeAnnotateTool
for(const row of rows){
const item=doc.createElement('button')
item.type='button'
item.setAttribute('role','menuitemradio')
item.setAttribute('aria-checked',row.checked?'true':'false')
item.setAttribute('aria-label',row.label)
item.append(row.lead,...(row.text?[Object.assign(doc.createElement('span'),{textContent:row.text})]:[]))
const tick=glyph('check')
tick.setAttribute('data-claude-annotate-check','')
item.append(tick)
item.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closeMenu();row.pick()})
menu.append(item)
}
bar.append(menu)
const a=anchor.getBoundingClientRect(),b=bar.getBoundingClientRect()
menu.style.left=Math.max(0,a.left - b.left)+ 'px'
anchor.setAttribute('aria-expanded','true')
s.menu=menu
}
const dot=()=>{const d=doc.createElement('span');d.setAttribute('data-claude-annotate-dot','');return d}
const stroke=()=>{const d=doc.createElement('span');d.setAttribute('data-claude-annotate-stroke','');return d}
const chevron=(lead)=>{const wrap=doc.createElement('span');wrap.setAttribute('data-claude-annotate-split','');wrap.append(lead,glyph('chevron'));return wrap}
const select=button('select','Select element',()=> set({tool:'select'}))
const pen=button('pen','Draw',()=> set({tool:'pen'}))
const shapeLead=doc.createElement('span')
const shapeButton=button('shape','Shapes',node=>{
if(s.state?.tool !=='shape')set({tool:'shape'})
openMenu(node,CLAUDE_ANNOTATE_SHAPES.map(([value,label])=>({label,text:label,lead:glyph(value),checked:s.state?.shape===value,pick:()=> set({tool:'shape',shape:value})})))
},chevron(shapeLead))
const text=button('text','Text',()=> set({tool:'text'}))
const colorDot=dot()
const color=button('color','Color',node=> openMenu(node,CLAUDE_ANNOTATE_COLORS.map(value=>{const d=dot();d.style.background=value;return{label:value,lead:d,checked:s.state?.color===value,pick:()=> set({color:value})}})),chevron(colorDot))
const strokeLine=stroke()
const width=button('width','Stroke width',node=> openMenu(node,CLAUDE_ANNOTATE_WIDTHS.map(value=>{const d=stroke();d.style.height=value + 'px';return{label:value + ' px',lead:d,checked:s.state?.width===value,pick:()=> set({width:value})}})),chevron(strokeLine))
const add=doc.createElement('button')
add.type='button'
add.dataset.claudeAnnotateAdd=''
add.textContent='Add to chat'
add.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();addToChat()})
const close=button('close','Stop annotating',stop)
const sep=()=>{const d=doc.createElement('span');d.setAttribute('data-claude-annotate-sep','');return d}
const full=[shapeButton,text,sep(),color,width,add]
bar.append(select,pen,...full,sep(),close)
bar.addEventListener('pointerdown',event=> event.stopPropagation())
s.onOutside=event=>{if(s.menu && !bar.contains(event.target))closeMenu()}
doc.addEventListener('pointerdown',s.onOutside,true)
aside.append(bar)
watch.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-pane-hidden']})
const sync=state=>{
if(session !==s)return
if(state && typeof state==='object')s.state=state
const st=s.state
if(!st)return
const used=st.marks + st.picks > 0 || st.tool !=='select'
for(const node of full)node.hidden=!used
bar.querySelectorAll('[data-claude-annotate-sep]')[0].hidden=!used
for(const[node,tool]of[[select,'select'],[pen,'pen'],[shapeButton,'shape'],[text,'text']])node.setAttribute('aria-pressed',st.tool===tool?'true':'false')
shapeLead.replaceChildren(glyph(st.shape))
colorDot.style.background=st.color
strokeLine.style.height=Math.min(st.width,8)+ 'px'
add.disabled=st.marks + st.picks===0
}
s.sync=sync
const install=()=> page(webview,'(' + claudeAnnotatePage.toString()+ ')(); JSON.stringify(window.__claudeAnnotate.state())').then(json=>{if(json)sync(JSON.parse(json));else stop()})
install()
s.timer=win.setInterval(()=>{
if(session !==s)return
if(!s.aside.isConnected || !s.webview.isConnected){stop();return}
page(webview,'window.__claudeAnnotate ? JSON.stringify(window.__claudeAnnotate.state()) : null').then(json=>{
if(session !==s)return
if(!json){install();return}
const st=JSON.parse(json)
if(st.ended){stop();return}
if(st.version !==s.state?.version)sync(st)
})
},300)
const addToChat=async()=>{
if(add.disabled)return
closeMenu()
add.disabled=true
await page(webview,'window.__claudeAnnotate && window.__claudeAnnotate.beginCapture()')
await new Promise(resolve=> win.setTimeout(resolve,80))
const picks=JSON.parse(await page(webview,'window.__claudeAnnotate ? JSON.stringify(window.__claudeAnnotate.picks()) : "[]"')|| '[]')
let image=null
try{image=await webview.capturePage()}catch{image=null}
const url=webview.getURL?.()|| ''
const title=webview.getTitle?.()|| ''
const target=composerTarget()
if(image && !image.isEmpty?.()){
const blob=await(await win.fetch(image.toDataURL())).blob()
win.dispatchEvent(new win.CustomEvent('hermes:composer-attach-images',{detail:{target,blobs:[new win.File([blob],'Browser.png',{type:'image/png'})]}}))
}
const lines=['In the browser: ' +(title && title !==url?title + ' — ':'')+ url]
if(picks.length){
lines.push('Selected element' +(picks.length > 1?'s':'')+ ':')
for(const p of picks)lines.push(p.number + '. <' + p.tag + '> ' + p.role +(p.name?' "' + p.name + '"':p.text?' "' + p.text + '"':'')+ ' — ' + p.selector)
}
if(image)lines.push('The attached screenshot shows the page' +(picks.length?' with the selected elements numbered':'')+(s.state?.marks?' and my marks':'')+ '.')
win.dispatchEvent(new win.CustomEvent('hermes:composer-insert',{detail:{target,text:lines.join('\n'),mode:'block'}}))
win.dispatchEvent(new win.CustomEvent('hermes:composer-focus',{detail:{target}}))
stop()
}
}
const onPicker=event=>{
const picker=event.target?.closest?.(PICKER)
const aside=picker?.closest('aside[data-preview-browser]')
if(!aside)return
event.preventDefault()
event.stopImmediatePropagation()
if(event.type !=='click')return
const same=session?.aside===aside
stop()
if(!same)start(aside)
}
for(const type of['pointerdown','mousedown','click'])doc.addEventListener(type,onPicker,true)
return()=>{
stop()
for(const type of['pointerdown','mousedown','click'])doc.removeEventListener(type,onPicker,true)
}
}
function installClaudeFileBrowser({document:doc=globalThis.document,window:win=globalThis.window}={}){
const root=doc.documentElement
const FILTERING='data-claude-tree-filtering'
const FILE_TAB="[role='tab'][data-tree-tab^='preview-tile:file:']"
const TREE_FILE="[data-tree-group='grp-files'] [role='treeitem'] [draggable='true'][title]"
let frame=0,disposed=false
let previewTab=''
const keep=new Map()
let reopenEditor=0,reopenAt=null,reopenBar=null
const IGNORED_ON='claude-skin:files-ignored-on'
const ignoredOn=new Set()
try{for(const folder of JSON.parse(win.localStorage.getItem(IGNORED_ON)|| '[]'))if(typeof folder==='string')ignoredOn.add(folder)}catch{ignoredOn.clear()}
const settings=(()=>{
let stored={}
try{stored=JSON.parse(win.localStorage?.getItem(CLAUDE_FILES_SETTINGS_KEY)|| '{}')||{}}catch{stored={}}
return{...CLAUDE_FILES_DEFAULTS,...stored}
})()
const barFor=node=>{for(let at=node;at;at=at.parentElement){const bar=at.querySelector('[data-claude-file-name]');if(bar)return bar}return null}
const editorFor=node=>{for(let at=node;at;at=at.parentElement){const editor=at.querySelector('.cm-editor');if(editor)return editor}return null}
const editorView=editor=>{
for(let node=editor,up=0;node && up < 4;node=node.parentElement,up++){
const key=Object.keys(node).find(name=> name.startsWith('__reactFiber$'))
for(let fiber=key?node[key]:null,depth=0;fiber && depth < 6;fiber=fiber.return,depth++){
for(let hook=fiber.memoizedState,at=0;hook && typeof hook==='object' && at < 40;hook=hook.next,at++){
const value=hook.memoizedState?.current??hook.memoizedState
if(value && typeof value.dispatch==='function' && value.state?.doc && value.scrollDOM)return value
}
}
}
return null
}
const restoreEditor=async(bar,at)=>{
const zone=bar.closest('[data-tree-group]')
const editor=await waitFor(()=>[...(zone?.querySelectorAll('.cm-editor')||[])].find(node=> !node.closest('[data-pane-hidden]')),3000)
const view=editor && at && editorView(editor)
if(!view)return
const end=view.state.doc.length
view.dispatch({selection:{anchor:Math.min(at.anchor,end),head:Math.min(at.head,end)}})
view.scrollDOM.scrollTop=at.top
if(at.focus)view.focus()
}
const saveEditor=(bar,editor,focus)=>{
const save=bar?.querySelector("[data-claude-edit='save']")
if(!save || save.disabled)return false
const view=editor && editorView(editor)
const range=view?.state.selection.main
reopenAt=range?{anchor:range.anchor,head:range.head,top:view.scrollDOM.scrollTop,focus}:null
reopenBar={zone:bar.closest('[data-tree-group]'),name:bar.dataset.claudeFileName || ''}
reopenEditor=Date.now()
save.click()
return true
}
const editors=new Map()
let decorationClass=null
const findDecoration=view=>{
decorationClass??=(async()=>{
const entry=[...doc.scripts].map(script=> script.src).find(src=> /\/index-[\w-]+\.js(\?|$)/.test(src))
if(!entry)return null
const base=entry.replace(/[^/]+$/,'')
const chunk=(await(await win.fetch(entry)).text()).match(/["'`]\.\/(code-editor-[\w-]+\.js)["'`]/)?.[1]
if(!chunk)return null
const source=await(await win.fetch(base + chunk)).text()
for(const dep of[...source.matchAll(/from\s*["']\.\/([\w.-]+\.js)["']/g)].map(match=> match[1])){
const values=Object.values(await import(base + dep))
if(!values.includes(view.constructor))continue
return values.find(value=> typeof value==='function' && typeof value.line==='function' && typeof value.mark==='function' && typeof value.set==='function')|| null
}
return null
})().catch(()=> null)
return decorationClass
}
const columns=(text,end,size)=>{let column=0;for(let at=0;at < end;at++)column=text[at]==='\t'?column + size -(column % size):column + 1;return column}
const decorate=(Decoration,view)=>{
const marks=[]
const size=settings.tabSize
for(const{from,to}of view.visibleRanges){
for(let pos=from;pos <=to;){
const line=view.state.doc.lineAt(pos)
const text=line.text
if(settings.indentGuides){
let at=0
while(at < text.length &&(text[at]===' ' || text[at]==='\t'))at++
const levels=at < text.length?Math.floor(columns(text,at,size)/ size):0
if(levels)marks.push(Decoration.line({class:'cm-claude-indent',attributes:{style:'--claude-indent-levels: ' + levels}}).range(line.from))
}
if(settings.showWhitespace)for(const match of text.matchAll(/ +|\t/g))marks.push(Decoration.mark({class:match[0]==='\t'?'cm-claude-tab':'cm-claude-space'}).range(line.from + match.index,line.from + match.index + match[0].length))
pos=line.to + 1
}
}
return Decoration.set(marks,true)
}
const extensionsFor=entry=>{
const{view}=entry
const EditorView=view.constructor,EditorState=view.state.constructor
const list=[]
if(EditorState.tabSize)list.push(EditorState.tabSize.of(settings.tabSize))
if(settings.wordWrap && EditorView.lineWrapping)list.push(EditorView.lineWrapping)
if((settings.indentGuides || settings.showWhitespace)&& entry.Decoration && EditorView.decorations)list.push(EditorView.decorations.of(current=> decorate(entry.Decoration,current)))
return list
}
const configure=entry=>{try{entry.view.dispatch({effects:entry.compartment.reconfigure(extensionsFor(entry))})}catch{editors.delete(entry.editor)}}
const setupEditor=editor=>{
const view=editorView(editor)
const known=view?.state.config?.compartments &&[...view.state.config.compartments.keys()][0]
const StateEffect=known?.reconfigure?.([])?.constructor
if(!view || !StateEffect?.appendConfig)return null
const entry={editor,view,compartment:new known.constructor(),Decoration:null}
try{view.dispatch({effects:StateEffect.appendConfig.of(entry.compartment.of(extensionsFor(entry)))})}catch{return null}
findDecoration(view).then(Decoration=>{if(Decoration && !disposed && editors.get(editor)===entry){entry.Decoration=Decoration;configure(entry)}})
return entry
}
const indent=(view,back)=>{
const{state}=view
const size=settings.tabSize
const EditorSelection=state.selection.constructor
if(!back && state.selection.ranges.every(range=> range.empty)){
view.dispatch({...state.changeByRange(range=>{
const line=state.doc.lineAt(range.head)
const insert=' '.repeat(size -(columns(line.text,range.head - line.from,size)% size))
return{changes:{from:range.head,insert},range:EditorSelection.cursor(range.head + insert.length)}
}),scrollIntoView:true,userEvent:'input.indent'})
return
}
const lines=new Set()
for(const range of state.selection.ranges){
const last=state.doc.lineAt(range.to > range.from && state.doc.lineAt(range.to).from===range.to?range.to - 1:range.to).number
for(let number=state.doc.lineAt(range.from).number;number <=last;number++)lines.add(number)
}
const changes=[]
for(const number of lines){
const line=state.doc.line(number)
if(!back){if(line.length)changes.push({from:line.from,insert:' '.repeat(size)});continue}
const lead=line.text.match(/^(\t| {1,})/)?.[0]|| ''
const cut=lead==='\t'?1:Math.min(lead.length,size)
if(cut)changes.push({from:line.from,to:line.from + cut})
}
if(changes.length)view.dispatch({changes,userEvent:back?'delete.dedent':'input.indent'})
}
const canon=path=> String(path || '').replace(/\\/g,'/').replace(/^\/(?=[A-Za-z]:\/)/,'')
const tabPath=tab=>{
let id=(tab.getAttribute('data-tree-tab')|| '').slice('preview-tile:file:'.length)
try{id=decodeURIComponent(id)}catch{ /* keep it raw */}
const at=id.indexOf('file://')
return canon(at >=0?id.slice(at + 'file://'.length):id)
}
const fileTabs=()=>[...doc.querySelectorAll(FILE_TAB)]
const tabFor=path=>{const want=canon(path);return fileTabs().find(tab=> tabPath(tab)===want)|| null}
const glyph=name=>{
const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg')
svg.setAttribute('viewBox','0 0 16 16')
svg.setAttribute('fill','none')
svg.setAttribute('stroke','currentColor')
svg.setAttribute('stroke-width','1.25')
svg.setAttribute('stroke-linecap','round')
svg.setAttribute('stroke-linejoin','round')
svg.setAttribute('aria-hidden','true')
svg.innerHTML=CLAUDE_FILE_ICONS[name]
return svg
}
const waitFor=(test,ms=4000)=> new Promise(resolve=>{
const end=Date.now()+ ms
const tick=()=>{
const value=disposed?null:test()
if(value || disposed || Date.now()> end)resolve(value || null)
else win.setTimeout(tick,50)
}
tick()
})
const keepOpen=path=>{
const key=canon(path)
keep.set(key,Date.now())
win.setTimeout(()=>{if(Date.now()-(keep.get(key)|| 0)>=2500)keep.delete(key)},2600)
const tab=tabFor(path)
if(tab && tab.getAttribute('data-tree-tab')===previewTab){previewTab='';schedule()}
}
const settle=async(path,alreadyOpen)=>{
if(alreadyOpen)return
const tab=await waitFor(()=> tabFor(path))
if(!tab)return
const id=tab.getAttribute('data-tree-tab')
const previous=previewTab
previewTab=keep.has(canon(path))|| !settings.previewTabs?'':id
if(previous && previous !==id)fileTabs().find(other=> other.getAttribute('data-tree-tab')===previous)?.querySelector("button[aria-label='Close']")?.click()
schedule()
}
const tree=()=>{
const element=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
const key=element && Object.keys(element).find(name=> name.startsWith('__reactFiber$'))
for(let fiber=key?element[key]:null,depth=0;fiber && depth < 8;fiber=fiber.return,depth++){
const props=fiber.memoizedProps
if(props && typeof props.onPreviewFile==='function')return{open:props.onPreviewFile,cwd:typeof props.cwd==='string'?props.cwd:''}
}
return null
}
const openFile=path=>{
const opener=tree()
if(!opener)return
const alreadyOpen=Boolean(tabFor(path))
opener.open(path)
settle(path,alreadyOpen)
}
let index=null,query='',active=0,results=[],resultsFrame=0
const listDir=async(path,local)=>{
const bridge=win.hermesDesktop
const listing=local?await bridge.readDir(path):await bridge.api({path:'/api/fs/list?path=' + encodeURIComponent(path)})
return !listing || listing.error || !Array.isArray(listing.entries)?[]:listing.entries
}
const buildIndex=folder=>{
const own={root:folder,files:[],done:false,at:Date.now()}
index=own
const bridge=win.hermesDesktop
if(!bridge || !folder){own.done=true;return own}
const base=canon(folder).replace(/\/$/,'')
;(async()=>{
let local=false
try{const probe=await bridge.readDir?.(folder);local=Boolean(probe && !probe.error && probe.entries?.length)}catch{local=false}
if(!local && typeof bridge.api !=='function'){own.done=true;return}
const queue=[folder]
let busy=0
const worker=async()=>{
while(index===own && !disposed && own.files.length < CLAUDE_FILTER_MAX){
if(!queue.length){
if(!busy)return
await new Promise(resolve=> win.setTimeout(resolve,25))
continue
}
const dir=queue.shift()
busy++
let entries=[]
try{entries=await listDir(dir,local)}catch{entries=[]}
busy--
for(const entry of entries){
const name=String(entry?.name || '')
if(!name)continue
const path=String(entry.path || String(dir).replace(/[\\/]$/,'')+ '/' + name)
if(entry.isDirectory){if(!CLAUDE_FILTER_SKIP.has(name))queue.push(path);continue}
const full=canon(path)
const rel=full.startsWith(base + '/')?full.slice(base.length + 1):full
own.files.push({path,name,rel,lower:rel.toLowerCase(),lowerName:name.toLowerCase()})
}
if(query)scheduleResults()
}
}
await Promise.all(Array.from({length:6},worker))
own.done=true
if(index===own && query)scheduleResults()
})()
return own
}
const currentIndex=()=>{
const folder=tree()?.cwd || ''
if(!index || index.root !==folder ||(index.done && Date.now()- index.at > 120000))buildIndex(folder)
return index
}
const match=text=>{
const needle=text.toLowerCase()
const found=[]
for(const file of index?.files ||[]){
if(!file.lower.includes(needle))continue
const at=file.lowerName.indexOf(needle)
found.push([at===0?0:at > 0?1:2,file.rel.length,file])
}
found.sort((a,b)=> a[0]- b[0]|| a[1]- b[1]|| a[2].rel.localeCompare(b[2].rel))
return found.slice(0,CLAUDE_FILTER_SHOWN).map(entry=> entry[2])
}
const resultsBox=()=> doc.querySelector('[data-claude-tree-results]')
const renderResults=()=>{
resultsFrame=0
const box=resultsBox()
if(!box || !query)return
results=match(query)
if(active >=results.length)active=Math.max(0,results.length - 1)
const rows=results.map((file,at)=>{
const row=doc.createElement('div')
row.dataset.claudeResult=String(at)
row.setAttribute('role','option')
row.setAttribute('aria-selected',at===active?'true':'false')
row.title=file.path
const icon=doc.createElement('span')
icon.setAttribute('data-claude-result-icon','')
const name=doc.createElement('span')
name.setAttribute('data-claude-result-name','')
name.textContent=file.name
const dir=doc.createElement('span')
dir.setAttribute('data-claude-result-dir','')
dir.textContent=file.rel.slice(0,Math.max(0,file.rel.length - file.name.length - 1))
row.append(icon,name,dir)
return row
})
const note=text=>{const node=doc.createElement('div');node.setAttribute('data-claude-results-note','');node.textContent=text;return node}
if(!index?.done)rows.push(note('Searching…'))
else if(!results.length)rows.push(note('No matching files'))
box.replaceChildren(...rows)
box.querySelector("[aria-selected='true']")?.scrollIntoView({block:'nearest'})
}
const scheduleResults=()=>{if(!resultsFrame && !disposed)resultsFrame=win.setTimeout(renderResults,80)}
const setQuery=text=>{
query=text.trim()
active=0
if(query)currentIndex()
if(query)root.setAttribute(FILTERING,'')
else{root.removeAttribute(FILTERING);resultsBox()?.replaceChildren()}
if(query){if(resultsFrame)win.clearTimeout(resultsFrame);resultsFrame=0;renderResults()}
}
const filterField=()=>{
const field=doc.createElement('div')
field.setAttribute('data-claude-tree-filter','')
const input=doc.createElement('input')
input.type='text'
input.placeholder='Filter files…'
input.setAttribute('aria-label','Filter files')
input.spellcheck=false
input.addEventListener('input',()=> setQuery(input.value))
input.addEventListener('keydown',event=>{
if(event.key==='ArrowDown' || event.key==='ArrowUp'){
event.preventDefault()
if(!results.length)return
active=(active +(event.key==='ArrowDown'?1:results.length - 1))% results.length
renderResults()
}else if(event.key==='Enter'){
event.preventDefault()
const file=results[active]
if(file)openFile(file.path)
}else if(event.key==='Escape'){
event.preventDefault()
if(input.value){input.value='';setQuery('')}else input.blur()
}
})
field.append(glyph('search'),input)
return field
}
const onResultClick=event=>{
const row=event.target?.closest?.('[data-claude-tree-results] [data-claude-result]')
if(!row)return
const file=results[Number(row.dataset.claudeResult)]
if(!file)return
active=Number(row.dataset.claudeResult)
for(const other of row.parentElement.children)other.setAttribute?.('aria-selected',other===row?'true':'false')
if(event.detail > 1)keepOpen(file.path)
else openFile(file.path)
}
const onSearch=()=>{
const view=root.getAttribute('data-claude-files-view')
if(view==='file' || view==='empty')root.dispatchEvent(new win.CustomEvent('claude-tree-toggle'))
win.requestAnimationFrame(()=> win.requestAnimationFrame(()=> doc.querySelector('[data-claude-tree-filter] > input')?.focus()))
}
const place=()=>{
frame=0
if(disposed)return
let previewShown=false
for(const tab of fileTabs()){
const on=Boolean(previewTab)&& tab.getAttribute('data-tree-tab')===previewTab
if(on)previewShown=true
if(on !==tab.hasAttribute('data-claude-preview-tab'))tab.toggleAttribute('data-claude-preview-tab',on)
}
if(previewTab && !previewShown)previewTab=''
const projectTree=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
if(projectTree){
let list=projectTree.parentElement.querySelector(':scope > [data-claude-tree-results]')
let field=projectTree.parentElement.querySelector(':scope > [data-claude-tree-filter]')
if(!field){
doc.querySelectorAll('[data-claude-tree-filter], [data-claude-tree-results]').forEach(node=> node.remove())
field=filterField()
list=doc.createElement('div')
list.setAttribute('data-claude-tree-results','')
list.setAttribute('role','listbox')
list.setAttribute('aria-label','Matching files')
if(query)field.querySelector('input').value=query
}
if(projectTree.previousElementSibling !==list || list.previousElementSibling !==field)projectTree.before(field,list)
if(query && !list.childElementCount)scheduleResults()
}
root.toggleAttribute(FILTERING,Boolean(query && projectTree))
if(reopenBar && Date.now()- reopenEditor > 5000)reopenBar=reopenAt=null
for(const bar of doc.querySelectorAll('[data-claude-file-name]')){
for(const control of bar.querySelectorAll('button:not([data-claude-edit-done])')){
const kind=control.querySelector("svg[class*='tabler-icon-pencil']")?'open'
:control.querySelector("svg[class*='tabler-icon-check']")?'save'
:control.querySelector("svg[class*='tabler-icon-x']")?'cancel':''
if(!kind || control.dataset.claudeEdit===kind)continue
control.dataset.claudeEdit=kind
if(kind==='open'){
if(!('claudeNativeTitle' in control.dataset))control.dataset.claudeNativeTitle=control.getAttribute('title')|| ''
if(!('claudeNativeLabel' in control.dataset))control.dataset.claudeNativeLabel=control.getAttribute('aria-label')|| ''
control.title='Edit'
control.setAttribute('aria-label','Edit')
}
}
if(reopenBar && !bar.closest('[data-pane-hidden]')&& bar.closest('[data-tree-group]')===reopenBar.zone &&(bar.dataset.claudeFileName || '')===reopenBar.name && !bar.querySelector("[data-claude-edit='save']")){
const reopen=Date.now()- reopenEditor < 5000 && bar.querySelector("[data-claude-edit='open']")
if(reopen){
const at=reopenAt
reopenBar=reopenAt=null
reopenEditor=0
reopen.click()
restoreEditor(bar,at)
}
}
const editor=bar.querySelector("[data-claude-edit='save']")&& editorFor(bar)
if(editor){
let entry=editors.get(editor)
if(entry && entry.compartment.get(entry.view.state)===undefined)entry=null
if(!entry){entry=setupEditor(editor);if(entry)editors.set(editor,entry)}
const content=editor.querySelector('.cm-content')
if(content){
const font=win.getComputedStyle(content)
const probe=doc.createElement('canvas').getContext?.('2d')
if(probe && !editor.style.getPropertyValue('--claude-space-width')){probe.font=font.fontStyle + ' ' + font.fontWeight + ' ' + font.fontSize + ' ' + font.fontFamily;editor.style.setProperty('--claude-space-width',probe.measureText(' ').width + 'px')}
editor.style.setProperty('--claude-editor-height',editor.querySelector('.cm-scroller')?.clientHeight + 'px')
}
}
if(bar.closest('[data-pane-hidden]'))continue
const save=bar.querySelector("[data-claude-edit='save']")
let done=bar.querySelector('[data-claude-edit-done]')
if(save){
const markdown=/\.(md|mdx|markdown)$/i.test(bar.dataset.claudeFileName || '')
const name=markdown?'preview':'done'
if(!done || done.dataset.claudeEditDone !==name){
done?.remove()
done=doc.createElement('button')
done.type='button'
done.dataset.claudeEditDone=name
done.title=markdown?'Preview':'Done'
done.setAttribute('aria-label',done.title)
done.append(glyph(name))
done.addEventListener('click',event=>{
event.preventDefault()
event.stopPropagation()
const pending=bar.querySelector("[data-claude-edit='save']")
if(pending && !pending.disabled)pending.click()
else bar.querySelector("[data-claude-edit='cancel']")?.click()
})
}
if(bar.lastElementChild !==done)bar.append(done)
const tab=bar.closest('[data-tree-group]')?.querySelector(FILE_TAB + "[aria-selected='true']")
if(tab && tab.getAttribute('data-tree-tab')===previewTab){previewTab='';tab.removeAttribute('data-claude-preview-tab')}
}else{
done?.remove()
}
}
for(const editor of[...editors.keys()])if(!editor.isConnected)editors.delete(editor)
placeTabs()
applyTerminals()
const eye=doc.querySelector("[data-claude-files-header] > button[aria-pressed='false']:has(.codicon-eye-closed)")
const folder=eye && tree()?.cwd
if(folder){
ignoredOn.add(folder)
try{win.localStorage.setItem(IGNORED_ON,JSON.stringify([...ignoredOn]))}catch{}
eye.click()
}
}
const TAB_MIN=96,TAB_GAP=4
let tabList=null
const closeTabList=()=>{
tabList?.remove()
tabList=null
doc.querySelectorAll('[data-claude-tab-more][aria-expanded="true"]').forEach(node=> node.setAttribute('aria-expanded','false'))
}
const openTabList=more=>{
if(tabList){closeTabList();return}
const hidden=[...(more.parentElement?.querySelectorAll(FILE_TAB + '[data-claude-tab-overflow]')||[])]
if(!hidden.length)return
tabList=doc.createElement('div')
tabList.setAttribute('data-claude-tab-list','')
tabList.setAttribute('role','menu')
for(const tab of hidden){
const row=doc.createElement('div')
row.setAttribute('role','menuitem')
row.title=tabPath(tab).split('/').pop()
const icon=doc.createElement('span')
icon.setAttribute('data-claude-result-icon','')
const name=doc.createElement('span')
name.textContent=row.title
const close=doc.createElement('button')
close.type='button'
close.setAttribute('aria-label','Close ' + row.title)
close.append(glyph('close'))
close.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closeTabList();tab.querySelector("button[aria-label='Close']")?.click()})
row.append(icon,name,close)
row.addEventListener('click',()=>{
closeTabList()
const target=tab.querySelector('.pane-tab-content')|| tab
for(const type of['pointerdown','mousedown','pointerup','mouseup'])target.dispatchEvent(new(type.startsWith('pointer')&& win.PointerEvent?win.PointerEvent:win.MouseEvent)(type,{bubbles:true,cancelable:true,button:0,buttons:type.endsWith('down')?1:0,pointerType:'mouse',isPrimary:true}))
})
tabList.append(row)
}
doc.body.append(tabList)
more.setAttribute('aria-expanded','true')
const box=more.getBoundingClientRect()
tabList.style.left=Math.max(8,box.right - tabList.offsetWidth)+ 'px'
tabList.style.top=Math.round(box.bottom + 6)+ 'px'
}
const resizer=win.ResizeObserver?new win.ResizeObserver(()=> schedule()):null
const watched=new WeakSet()
const placeTabs=()=>{
for(const node of doc.querySelectorAll("[data-claude-preview-column] [data-zone-tabstrip], [data-tree-group='grp-files']:not([data-pane-host])"))if(resizer && !watched.has(node)){watched.add(node);resizer.observe(node)}
const files=root.hasAttribute('data-claude-file-joined')|| root.hasAttribute('data-claude-file-over')
for(const strip of doc.querySelectorAll('[data-claude-preview-column] [data-zone-tabstrip]')){
const list=strip.querySelector(":scope > [role='tablist']")
const tabs=[...(list?.querySelectorAll(FILE_TAB)||[])]
let more=strip.querySelector(':scope > [data-claude-tab-more]')
const fits=width=> Math.max(1,Math.floor((width + TAB_GAP)/(TAB_MIN + TAB_GAP)))
const wanted=files && list?tabs.length > fits(list.clientWidth +(more?more.offsetWidth + TAB_GAP:0)):false
if(wanted && !more){
more=doc.createElement('button')
more.type='button'
more.setAttribute('data-claude-tab-more','')
more.setAttribute('aria-label','More tabs')
more.setAttribute('aria-haspopup','menu')
more.setAttribute('aria-expanded','false')
more.title='More tabs'
more.append(glyph('chevronDown'))
more.addEventListener('pointerdown',event=> event.stopPropagation())
more.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openTabList(more)})
}
if(!wanted){more?.remove();more=null}
if(more && list.nextElementSibling !==more)list.after(more)
const count=wanted?fits(list.clientWidth):tabs.length
const active=tabs.findIndex(tab=> tab.getAttribute('aria-selected')==='true')
const shown=new Set(tabs.slice(0,count))
if(active >=count){shown.delete(tabs[count - 1]);shown.add(tabs[active])}
for(const tab of tabs)if(shown.has(tab)===tab.hasAttribute('data-claude-tab-overflow'))tab.toggleAttribute('data-claude-tab-overflow',!shown.has(tab))
for(const tab of tabs){
const tight=shown.has(tab)&& tab.getBoundingClientRect().width < 46
if(tight !==tab.hasAttribute('data-claude-tab-tight'))tab.toggleAttribute('data-claude-tab-tight',tight)
}
}
const filesCard=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host])")
const fileCard=doc.querySelector('[data-claude-preview-column] > [data-tree-group]:not([data-pane-host])')
const span=root.hasAttribute('data-claude-tree-left')&& root.hasAttribute('data-claude-file-joined')&& root.getAttribute('data-claude-files-view')==='both' && filesCard && fileCard
?Math.round(fileCard.getBoundingClientRect().left - filesCard.getBoundingClientRect().left):0
const value=span > 0?span + 'px':''
if(root.style.getPropertyValue('--claude-tree-span')!==value)value?root.style.setProperty('--claude-tree-span',value):root.style.removeProperty('--claude-tree-span')
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const onTreeClick=event=>{
if(event.button !==0 || event.detail > 1 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)return
const row=event.target?.closest?.("[data-tree-group='grp-files'] [role='treeitem'] [draggable='true']")
if(!row || row.hasAttribute('aria-expanded')|| row.querySelector('input'))return
const path=row.getAttribute('title')|| ''
const alreadyOpen=Boolean(path && tabFor(path))
const{clientX,clientY}=event
win.setTimeout(()=>{
if(!row.isConnected || row.querySelector('input'))return
row.dispatchEvent(new win.MouseEvent('dblclick',{bubbles:true,cancelable:true,detail:2,clientX,clientY}))
if(path)settle(path,alreadyOpen)
},0)
}
const onSourceClick=event=>{
const source=event.target?.closest?.("[data-claude-file-name] > [data-claude-mode='source']")
const edit=source?.parentElement.querySelector("[data-claude-edit='open']")
if(!edit)return
event.preventDefault()
event.stopPropagation()
edit.click()
}
const onDoubleClick=event=>{
if(!event.isTrusted)return
const row=event.target?.closest?.(TREE_FILE)
if(row && !row.hasAttribute('aria-expanded')){keepOpen(row.getAttribute('title'));return}
const tab=event.target?.closest?.(FILE_TAB)
if(tab && tab.getAttribute('data-tree-tab')===previewTab){previewTab='';schedule()}
}
const filesOpen=()=> root.getAttribute('data-claude-files-hidden')!=='true' && Boolean(doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host])"))
const onKeyDown=event=>{
if((event.ctrlKey || event.metaKey)&& event.shiftKey && !event.altKey && event.key.toLowerCase()==='y' && filesOpen()&& root.getAttribute('data-claude-last-pane')!=='changes'){
event.preventDefault()
event.stopPropagation()
root.dispatchEvent(new win.CustomEvent('claude-tree-toggle'))
return
}
const editor=event.target?.closest?.('.cm-editor')
const bar=editor && barFor(editor)
const save=bar?.querySelector("[data-claude-edit='save']")
if(!save)return
if(event.key==='Tab' && !event.ctrlKey && !event.metaKey && !event.altKey){
event.stopPropagation()
if(!settings.tabIndents)return
event.preventDefault()
const view=editorView(editor)
if(view)indent(view,event.shiftKey)
}else if((event.ctrlKey || event.metaKey)&& !event.altKey && event.key.toLowerCase()==='s'){
event.preventDefault()
event.stopPropagation()
saveEditor(bar,editor,true)
}else if(event.key==='Escape' && !save.disabled){
event.preventDefault()
event.stopPropagation()
}
}
const onFocusOut=event=>{
if(!settings.autoSave)return
const editor=event.target?.closest?.('.cm-editor')
const next=event.relatedTarget
if(!editor || editor.contains(next))return
const bar=barFor(editor)
if(!bar || bar.contains(next)|| next?.closest?.("[data-claude-files-menu], [data-claude-terminal-action='more'], [role='tab'] button[aria-label='Close']"))return
win.setTimeout(()=>{if(bar.isConnected && editor.isConnected && !(reopenBar && Date.now()- reopenEditor < 5000))saveEditor(bar,editor,false)},120)
}
let closing=false
const onTabClose=event=>{
if(closing || !settings.autoSave)return
const close=event.target?.closest?.(FILE_TAB + " button[aria-label='Close']")
const tab=close?.closest(FILE_TAB)
if(!tab || tab.getAttribute('aria-selected')!=='true')return
const bar=[...(tab.closest('[data-tree-group]')?.querySelectorAll('[data-claude-file-name]')||[])].find(node=> !node.closest('[data-pane-hidden]'))
const save=bar?.querySelector("[data-claude-edit='save']")
if(!save || save.disabled)return
event.preventDefault()
event.stopPropagation()
reopenBar=null
save.click()
waitFor(()=> !bar.isConnected || !bar.querySelector("[data-claude-edit='save']"),6000).then(saved=>{
if(!saved || !close.isConnected)return
closing=true
try{close.click()}finally{closing=false}
})
}
let menu=null,submenu=null,menuAnchor=null
const terminalSettings=(()=>{
let stored={}
try{stored=JSON.parse(win.localStorage?.getItem(CLAUDE_TERMINAL_SETTINGS_KEY)|| '{}')||{}}catch{stored={}}
return{...CLAUDE_TERMINAL_DEFAULTS,...stored}
})()
const terminals=new Map()
const terminalOf=element=>{
for(let node=element,up=0;node && up < 8;node=node.parentElement,up++){
const key=Object.keys(node).find(name=> name.startsWith('__reactFiber$'))
for(let fiber=key?node[key]:null,depth=0;fiber && depth < 6;fiber=fiber.return,depth++){
for(let hook=fiber.memoizedState,at=0;hook && typeof hook==='object' && at < 40;hook=hook.next,at++){
const value=hook.memoizedState?.current??hook.memoizedState
if(value && typeof value.onSelectionChange==='function' && typeof value.getSelection==='function' && value.options)return value
}
}
}
return null
}
const applyTerminals=()=>{
for(const element of doc.querySelectorAll('.xterm')){
let term=terminals.get(element)
if(!term){
term=terminalOf(element)
if(!term || term.options.disableStdin)continue
terminals.set(element,term)
term.__claudeOriginal??={cursorStyle:term.options.cursorStyle,cursorBlink:term.options.cursorBlink,scrollback:term.options.scrollback}
try{
term.__claudeCopy?.dispose?.()
term.__claudeCopy=term.onSelectionChange(()=>{
if(!terminalSettings.copyOnSelect)return
const text=term.getSelection()
if(!text)return
const bridge=win.hermesDesktop?.writeClipboard
Promise.resolve(typeof bridge==='function'?bridge(text):win.navigator.clipboard?.writeText(text)).catch(()=>{})
})
}catch{ /* no selection events */}
}
const wanted={cursorStyle:terminalSettings.cursorStyle,cursorBlink:Boolean(terminalSettings.cursorBlink),scrollback:terminalSettings.scrollback}
for(const[name,value]of Object.entries(wanted)){try{if(term.options[name]!==value)term.options[name]=value}catch{ /* option gone */}}
}
for(const element of[...terminals.keys()])if(!element.isConnected)terminals.delete(element)
}
const applyTerminalSettings=()=>{
try{win.localStorage?.setItem(CLAUDE_TERMINAL_SETTINGS_KEY,JSON.stringify(terminalSettings))}catch{ /* storage off */}
applyTerminals()
}
const terminalItems=()=>{
const styles=[['block','Block'],['bar','Bar'],['underline','Underline']]
const lines=size=> size.toLocaleString('en-US')+ ' lines'
return[
{label:'Cursor style',value:styles.find(([key])=> key===terminalSettings.cursorStyle)?.[1]|| 'Block',
sub:styles.map(([key,label])=>({label,checked:terminalSettings.cursorStyle===key,onSelect:()=>{terminalSettings.cursorStyle=key;applyTerminalSettings()}}))},
{label:'Blink cursor',checked:Boolean(terminalSettings.cursorBlink),onSelect:()=>{terminalSettings.cursorBlink=!terminalSettings.cursorBlink;applyTerminalSettings()}},
{label:'Copy on select',checked:Boolean(terminalSettings.copyOnSelect),onSelect:()=>{terminalSettings.copyOnSelect=!terminalSettings.copyOnSelect;applyTerminalSettings()}},
{label:'Scrollback',value:lines(terminalSettings.scrollback),
sub:[1000,5000,10000].map(size=>({label:lines(size),checked:terminalSettings.scrollback===size,onSelect:()=>{terminalSettings.scrollback=size;applyTerminalSettings()}}))}
]
}
const applySettings=()=>{
try{win.localStorage?.setItem(CLAUDE_FILES_SETTINGS_KEY,JSON.stringify(settings))}catch{ /* storage off */}
root.toggleAttribute('data-claude-tree-left',settings.treePosition==='left')
root.toggleAttribute('data-claude-autosave',Boolean(settings.autoSave))
root.toggleAttribute('data-claude-scroll-past-end',Boolean(settings.scrollPastEnd))
root.style.setProperty('--claude-tab-size',String(settings.tabSize))
if(!settings.previewTabs)previewTab=''
for(const entry of editors.values())configure(entry)
schedule()
}
const closeMenu=()=>{
const refocus=menuAnchor &&(menu?.contains(doc.activeElement)|| submenu?.contains(doc.activeElement))
submenu?.remove()
menu?.remove()
menu=submenu=null
if(refocus && menuAnchor.isConnected)menuAnchor.focus()
menuAnchor=null
doc.querySelectorAll("[data-claude-terminal-action='more'][aria-expanded='true']").forEach(node=> node.setAttribute('aria-expanded','false'))
}
const menuRow=(item,inSub)=>{
const row=doc.createElement('div')
row.setAttribute('role',item.checked===undefined?'menuitem':'menuitemcheckbox')
if(item.checked !==undefined)row.setAttribute('aria-checked',item.checked?'true':'false')
row.dataset.claudeMenuRow=''
if(item.disabled)row.setAttribute('aria-disabled','true')
row.tabIndex=-1
const label=doc.createElement('span')
label.textContent=item.label
row.append(label)
const tail=doc.createElement('span')
tail.dataset.claudeMenuTail=''
if(item.checked){const check=glyph('check');check.dataset.claudeMenuCheck='';tail.append(check)}
if(item.hint){const hint=doc.createElement('span');hint.dataset.claudeMenuHint='';hint.textContent=item.hint;tail.append(hint)}
if(item.value){const value=doc.createElement('span');value.dataset.claudeMenuHint='';value.textContent=item.value;tail.append(value)}
if(item.sub){tail.append(glyph('chevron'));row.setAttribute('aria-haspopup','menu')}
row.append(tail)
const openSub=()=>{
if(inSub)return
submenu?.remove()
submenu=null
menu?.querySelectorAll('[data-claude-menu-open]').forEach(node=> node.removeAttribute('data-claude-menu-open'))
if(!item.sub)return
row.setAttribute('data-claude-menu-open','')
submenu=buildMenu(item.sub,true)
doc.body.append(submenu)
const box=row.getBoundingClientRect(),outer=menu.getBoundingClientRect()
const left=outer.left - submenu.offsetWidth - 4
submenu.style.left=Math.max(8,left < 8?outer.right + 4:left)+ 'px'
submenu.style.top=Math.max(8,Math.min(box.top - 5,win.innerHeight - submenu.offsetHeight - 8))+ 'px'
}
row.addEventListener('pointerenter',openSub)
row.addEventListener('click',event=>{
event.preventDefault()
event.stopPropagation()
if(item.sub){openSub();return}
if(item.disabled)return
closeMenu()
item.onSelect()
})
return row
}
const buildMenu=(items,inSub)=>{
const box=doc.createElement('div')
box.setAttribute('data-claude-files-menu',inSub?'sub':'main')
box.setAttribute('role','menu')
for(const item of items){
if(item==='-'){const rule=doc.createElement('div');rule.setAttribute('role','separator');box.append(rule);continue}
box.append(menuRow(item,inSub))
}
box.addEventListener('pointerdown',event=> event.stopPropagation())
return box
}
const toggleSetting=key=>()=>{settings[key]=!settings[key];applySettings()}
const menuItems=()=>{
const view=root.getAttribute('data-claude-files-view')
const positions=[['auto','Automatic'],['left','Left'],['right','Right']]
return[
{label:'Show file tree',checked:view !=='file' && view !=='empty',hint:'Ctrl+Shift+Y',onSelect:()=> root.dispatchEvent(new win.CustomEvent('claude-tree-toggle'))},
{label:'File tree position',value:positions.find(([key])=> key===settings.treePosition)?.[1]|| 'Automatic',
sub:positions.map(([key,label])=>({label,checked:settings.treePosition===key,onSelect:()=>{settings.treePosition=key;applySettings()}}))},
'-',
{label:'Preview tabs',checked:settings.previewTabs,onSelect:toggleSetting('previewTabs')},
{label:'Auto save',checked:settings.autoSave,onSelect:toggleSetting('autoSave')},
{label:'Tab key indents',checked:settings.tabIndents,onSelect:toggleSetting('tabIndents')},
'-',
{label:'Word wrap',checked:settings.wordWrap,onSelect:toggleSetting('wordWrap')},
{label:'Indent guides',checked:settings.indentGuides,onSelect:toggleSetting('indentGuides')},
{label:'Show whitespace',checked:settings.showWhitespace,onSelect:toggleSetting('showWhitespace')},
{label:'Scroll past end',checked:settings.scrollPastEnd,onSelect:toggleSetting('scrollPastEnd')},
{label:'Tab size',value:String(settings.tabSize),
sub:[2,4,8].map(size=>({label:String(size),checked:settings.tabSize===size,onSelect:()=>{settings.tabSize=size;applySettings()}}))}
]
}
const browserNow=()=>[...doc.querySelectorAll('aside[data-preview-browser]')].find(node=> node.checkVisibility({visibilityProperty:true}))|| null
const browserPress=(aside,label)=> aside?.querySelector('button[aria-label="' + label + '"]')?.click()
const browserGo=(aside,url)=>{
const input=aside?.querySelector("input[aria-label='Address']")
if(!input)return
input.focus()
Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(input,url)
input.dispatchEvent(new win.Event('input',{bubbles:true}))
input.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}))
}
const viewports=[['responsive','Responsive'],['mobile','Mobile',390,844],['tablet','Tablet',820,1180],['desktop','Desktop',1280,800]]
const browserItems=()=>{
const aside=browserNow()
const webview=aside?.querySelector('webview')
let url=''
try{url=webview?.getURL?.()|| ''}catch{url=''}
url=url || aside?.querySelector("input[aria-label='Address']")?.value || ''
const page=Boolean(url)&& url !=='about:blank'
const viewport=aside?.getAttribute('data-claude-viewport')|| 'responsive'
const consoleOn=aside?.querySelector("button[aria-label$='preview console']")?.getAttribute('aria-pressed')==='true'
const devTools=aside?.querySelector("button[aria-label$='preview DevTools']")
const popIn=aside?.querySelector("button[aria-label='Pop in']")
return[
{label:'Open in browser',disabled:!page,onSelect:()=>{void win.hermesDesktop?.openExternal?.(url)}},
{label:'Copy URL',disabled:!page,onSelect:()=> browserPress(aside,'Copy URL')},
{label:'Save screenshot',disabled:!page || typeof webview?.capturePage !=='function',onSelect:async()=>{
try{const image=await webview.capturePage();await win.hermesDesktop?.saveImageFromUrl?.(image.toDataURL())}catch{ /* the page went away */}
}},
{label:'Open HTML file…',disabled:!aside || typeof win.hermesDesktop?.selectPaths !=='function',onSelect:async()=>{
const paths=await win.hermesDesktop.selectPaths({title:'Open HTML file',multiple:false,filters:[{name:'HTML',extensions:['html','htm']},{name:'All files',extensions:['*']}]})
const file=Array.isArray(paths)?paths[0]:''
if(file)browserGo(aside,'file:///' + encodeURI(String(file).replace(/\\/g,'/').replace(/^\/+/,'')))
}},
'-',
{label:'Viewport',value:viewports.find(([key])=> key===viewport)?.[1]|| 'Responsive',disabled:!aside,
sub:viewports.map(([key,label,width,height])=>({label:width?label + '  ' + width + ' × ' + height:label,checked:viewport===key,onSelect:()=>{
if(!width){aside.removeAttribute('data-claude-viewport');aside.style.removeProperty('--claude-viewport-width');aside.style.removeProperty('--claude-viewport-height');return}
aside.setAttribute('data-claude-viewport',key)
aside.style.setProperty('--claude-viewport-width',width + 'px')
aside.style.setProperty('--claude-viewport-height',height + 'px')
}}))},
{label:consoleOn?'Hide console':'Show console',disabled:!aside,onSelect:()=> browserPress(aside,consoleOn?'Hide preview console':'Show preview console')},
'-',
{label:popIn?'Pop in':'Pop out',disabled:!aside,onSelect:()=> browserPress(aside,popIn?'Pop in':'Pop out')},
{label:devTools?.getAttribute('aria-pressed')==='true'?'Close DevTools':'Open DevTools',disabled:!devTools,onSelect:()=> devTools?.click()}
]
}
const onMenu=event=>{
const anchor=event.detail
if(menu){closeMenu();return}
menu=buildMenu(event.type==='claude-terminal-menu'?terminalItems():event.type==='claude-browser-menu'?browserItems():menuItems(),false)
doc.body.append(menu)
anchor?.setAttribute?.('aria-expanded','true')
const box=anchor?.getBoundingClientRect?.()||{right:win.innerWidth - 8,bottom:40}
menu.style.left=Math.max(8,Math.min(box.right - menu.offsetWidth,win.innerWidth - menu.offsetWidth - 8))+ 'px'
menu.style.top=Math.round(box.bottom + 6)+ 'px'
menuAnchor=anchor?.focus?anchor:null
if(anchor?.matches?.(':focus-visible'))menu.querySelector("[data-claude-menu-row]:not([aria-disabled='true'])")?.focus()
}
const onMenuOutside=event=>{
if(tabList && !event.target?.closest?.('[data-claude-tab-list], [data-claude-tab-more]'))closeTabList()
if(!menu || event.target?.closest?.("[data-claude-files-menu], [data-claude-terminal-action='more']"))return
closeMenu()
}
const onMenuKey=event=>{
if(tabList && event.key==='Escape'){event.preventDefault();event.stopPropagation();closeTabList();return}
if(!menu)return
if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu();return}
const layer=submenu?.contains(doc.activeElement)?submenu:menu
if(!layer.contains(doc.activeElement)&& doc.activeElement !==menuAnchor)return
const rows=[...layer.querySelectorAll('[data-claude-menu-row]')].filter(row=> row.getAttribute('aria-disabled')!=='true')
const at=rows.indexOf(doc.activeElement)
const key=event.key
const go=row=> row?.focus()
if(key==='ArrowDown' || key==='ArrowUp')go(rows[at < 0?(key==='ArrowDown'?0:rows.length - 1):(at +(key==='ArrowDown'?1:-1)+ rows.length)% rows.length])
else if(key==='Home' || key==='End')go(key==='Home'?rows[0]:rows[rows.length - 1])
else if(at >=0 && rows[at].hasAttribute('aria-haspopup')&&(key==='ArrowRight' || key==='Enter' || key===' ')){
rows[at].click()
submenu?.querySelector("[data-claude-menu-row]:not([aria-disabled='true'])")?.focus()
}else if(at >=0 &&(key==='Enter' || key===' '))rows[at].click()
else if(key==='ArrowLeft' && layer===submenu){
const parent=menu.querySelector('[data-claude-menu-open]')
submenu.remove();submenu=null
parent?.removeAttribute('data-claude-menu-open')
parent?.focus()
}else return
event.preventDefault()
event.stopPropagation()
}
const onRefresh=event=>{if(event.target?.closest?.("[data-claude-files-header] button[aria-label='Refresh tree']"))index=null}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected','disabled','data-claude-file-name']})
observer.observe(root,{attributes:true,attributeFilter:['data-claude-files-view']})
doc.addEventListener('click',onTreeClick,true)
doc.addEventListener('click',onSourceClick,true)
doc.addEventListener('click',onResultClick)
doc.addEventListener('click',onRefresh,true)
doc.addEventListener('dblclick',onDoubleClick,true)
doc.addEventListener('keydown',onKeyDown,true)
doc.addEventListener('keydown',onMenuKey,true)
doc.addEventListener('focusout',onFocusOut,true)
doc.addEventListener('click',onTabClose,true)
doc.addEventListener('pointerdown',onMenuOutside,true)
root.addEventListener('claude-tree-search',onSearch)
root.addEventListener('claude-files-menu',onMenu)
root.addEventListener('claude-terminal-menu',onMenu)
root.addEventListener('claude-browser-menu',onMenu)
applySettings()
place()
return()=>{
closeMenu()
closeTabList()
resizer?.disconnect()
doc.querySelectorAll('[data-claude-tab-more]').forEach(node=> node.remove())
doc.querySelectorAll('[data-claude-tab-overflow]').forEach(node=> node.removeAttribute('data-claude-tab-overflow'))
doc.querySelectorAll('[data-claude-tab-tight]').forEach(node=> node.removeAttribute('data-claude-tab-tight'))
root.style.removeProperty('--claude-tree-span')
for(const entry of editors.values()){try{entry.view.dispatch({effects:entry.compartment.reconfigure([])})}catch{ /* gone */}}
editors.clear()
doc.removeEventListener('keydown',onMenuKey,true)
doc.removeEventListener('focusout',onFocusOut,true)
doc.removeEventListener('click',onTabClose,true)
doc.removeEventListener('pointerdown',onMenuOutside,true)
root.removeEventListener('claude-files-menu',onMenu)
root.removeEventListener('claude-browser-menu',onMenu)
root.removeEventListener('claude-terminal-menu',onMenu)
for(const term of terminals.values()){try{term.__claudeCopy?.dispose?.();delete term.__claudeCopy;Object.assign(term.options,term.__claudeOriginal ||{});delete term.__claudeOriginal}catch{ /* gone */}}
terminals.clear()
for(const name of['data-claude-tree-left','data-claude-autosave','data-claude-scroll-past-end'])root.removeAttribute(name)
root.style.removeProperty('--claude-tab-size')
disposed=true
observer.disconnect()
doc.removeEventListener('click',onTreeClick,true)
doc.removeEventListener('click',onSourceClick,true)
doc.removeEventListener('click',onResultClick)
doc.removeEventListener('click',onRefresh,true)
doc.removeEventListener('dblclick',onDoubleClick,true)
doc.removeEventListener('keydown',onKeyDown,true)
root.removeEventListener('claude-tree-search',onSearch)
if(frame)win.cancelAnimationFrame(frame)
if(resultsFrame)win.clearTimeout(resultsFrame)
doc.querySelectorAll('[data-claude-tree-filter], [data-claude-tree-results], [data-claude-edit-done]').forEach(node=> node.remove())
doc.querySelectorAll('[data-claude-preview-tab]').forEach(node=> node.removeAttribute('data-claude-preview-tab'))
doc.querySelectorAll('[data-claude-edit]').forEach(node=>{delete node.dataset.claudeEdit})
const folder=tree()?.cwd
const eye=folder && ignoredOn.has(folder)&& doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [class*='group/project-header'] > button[aria-pressed='true']:has(.codicon-eye)")
if(eye){
eye.click()
ignoredOn.delete(folder)
try{win.localStorage.setItem(IGNORED_ON,JSON.stringify([...ignoredOn]))}catch{}
}
const giveBack=(node,name,value)=>{if(value)node.setAttribute(name,value);else node.removeAttribute(name)}
doc.querySelectorAll('[data-claude-native-title]').forEach(node=>{giveBack(node,'title',node.dataset.claudeNativeTitle);delete node.dataset.claudeNativeTitle})
doc.querySelectorAll('[data-claude-native-label]').forEach(node=>{giveBack(node,'aria-label',node.dataset.claudeNativeLabel);delete node.dataset.claudeNativeLabel})
root.removeAttribute(FILTERING)
}
}
const CLAUDE_CHANGES_SETTINGS_KEY='claude-chat-look.changes-settings'
const CLAUDE_CHANGES_DEFAULTS={showFiles:true,listPosition:'auto',listWidth:240,groupByFolder:false,separateGenerated:false,sideBySide:false,wordWrap:true,highlightWords:true,hideWhitespace:false,hermesView:false,bases:{}}
const CLAUDE_CHANGES_ICONS={
chevron:'<path d="M6.25 3.75 10.5 8l-4.25 4.25"/>',
caretDown:'<path d="M4 6h8l-4 4.5z" fill="currentColor" stroke="none"/>',
caretRight:'<path d="M6 4v8l4.5-4z" fill="currentColor" stroke="none"/>',
fold:'<path d="M3.47 5.47a.75.75 0 0 1 1.06 0L8 8.94l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06" fill="currentColor" stroke="none"/>',
arrow:'<path d="M2.5 8h11M9.5 4l4 4-4 4"/>',
check:'<path d="M3.5 8.25 6.5 11.25 12.5 4.75"/>',
search:'<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25 13.25 13.25"/>',
list:'<path d="M6.25 4.5h6.5M6.25 8h6.5M6.25 11.5h6.5"/><circle cx="3.5" cy="4.5" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="11.5" r=".9" fill="currentColor" stroke="none"/>',
more:'<circle cx="3.75" cy="8" r=".95" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".95" fill="currentColor" stroke="none"/><circle cx="12.25" cy="8" r=".95" fill="currentColor" stroke="none"/>',
expand:'<path d="M9.5 2.75h3.75V6.5M13.25 2.75 9.25 6.75M6.5 13.25H2.75V9.5M2.75 13.25l4-4"/>',
collapse:'<path d="M13.25 2.75l-4 4M9.25 3.5v3.25h3.25M2.75 13.25l4-4M6.75 12.5V9.25H3.5"/>',
close:'<path d="M4 4l8 8M12 4l-8 8"/>',
open:'<path d="M5.5 10.5 10.5 5.5M6.25 5.5h4.25v4.25"/>',
image:'<rect x="2.75" y="3.25" width="10.5" height="9.5" rx="1.5"/><circle cx="6" cy="6.5" r="1"/><path d="m3.5 11.5 3.25-3 2 1.75 1.75-1.5 2.25 2"/>',
warning:'<path d="M8 2.75 14.25 13.25H1.75z"/><path d="M8 6.75v3"/><circle cx="8" cy="11.4" r=".7" fill="currentColor" stroke="none"/>'
}
const CLAUDE_IMAGE_FILE=/\.(png|jpe?g|gif|webp|bmp|ico|svg|avif)$/i
const CLAUDE_GENERATED_FILE=/(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|Gemfile\.lock|Podfile\.lock|composer\.lock|poetry\.lock|uv\.lock|Pipfile\.lock|go\.sum|flake\.lock|pubspec\.lock|mix\.lock|packages\.lock\.json)$|(^|\/)(__generated__|generated|gen)\/|[._]gen(erated)?\.[^/]+$|\.pb\.(go|h|cc|ts|js)$|\.pb\.gw\.go$|_pb2(_grpc)?\.pyi?$|_pb\.(d\.ts|js|ts)$|\.g\.dart$|\.[Dd]esigner\.cs$|\.min\.(js|css)$|\.(js|css)\.map$|(^|\/)(\.next|\.nuxt|\.svelte-kit|\.parcel-cache|__pycache__)\/|\.(pyc|tsbuildinfo)$|^dist\//
const CLAUDE_BUILD_FILE=/(^|\/)BUILD(\.bazel)?$|(^|\/)WORKSPACE(\.bazel|\.bzlmod)?$|(^|\/)MODULE\.bazel(\.lock)?$|\.bzl$/
const CLAUDE_TEST_FILE=/(^|\/)__(tests|snapshots)__\/|[._](test|spec)\.[^/]+$|(^|\/)test_[^/]*\.py$|\.snap$|\.stories\.[jt]sx?$|(^|\/)conftest\.py$|Tests?\.(swift|kt|java)$|_unittest\.(cc|cpp)$|(^|\/|_)tests\.rs$|(^|\/)(tests?|testdata|spec|__Snapshots__|e2e([-_]tests?)?)\/|(^|\/)[^/]+[-_]tests\//
function installClaudeChanges({state,document:doc=globalThis.document,window:win=globalThis.window}={}){
const setAttr=(node,name,value)=>{if(node.getAttribute(name)!==value)node.setAttribute(name,value)}
const root=doc.documentElement
let frame=0,disposed=false
const settings=(()=>{
let stored={}
try{stored=JSON.parse(win.localStorage?.getItem(CLAUDE_CHANGES_SETTINGS_KEY)|| '{}')||{}}catch{stored={}}
return{...CLAUDE_CHANGES_DEFAULTS,...stored,bases:{...(stored.bases ||{})}}
})()
const saveSettings=()=>{try{win.localStorage?.setItem(CLAUDE_CHANGES_SETTINGS_KEY,JSON.stringify(settings))}catch{ /* storage off */}}
const glyph=name=>{
const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg')
svg.setAttribute('viewBox','0 0 16 16')
svg.setAttribute('fill','none')
svg.setAttribute('stroke','currentColor')
svg.setAttribute('stroke-width','1.25')
svg.setAttribute('stroke-linecap','round')
svg.setAttribute('stroke-linejoin','round')
svg.setAttribute('aria-hidden','true')
svg.innerHTML=CLAUDE_CHANGES_ICONS[name]
return svg
}
const el=(tag,attrs={},...children)=>{
const node=doc.createElement(tag)
for(const[name,value]of Object.entries(attrs)){
if(value===undefined || value===null || value===false)continue
if(name==='text')node.textContent=value
else if(name.startsWith('on'))node.addEventListener(name.slice(2),value)
else node.setAttribute(name,value===true?'':value)
}
node.append(...children.filter(child=> child !==null && child !==undefined && child !==false))
return node
}
const button=(name,label,onClick,attrs={})=>{
const node=el('button',{type:'button','data-claude-changes-action':name,'aria-label':label,title:label,...attrs},glyph(name))
node.addEventListener('pointerdown',event=> event.stopPropagation())
node.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();onClick(node,event)})
return node
}
const waitFor=(test,ms=4000)=> new Promise(resolve=>{
const end=Date.now()+ ms
const tick=()=>{const value=disposed?null:test();if(value || disposed || Date.now()> end)resolve(value || null);else win.setTimeout(tick,60)}
tick()
})
const remoteApi=(endpoint,params)=>{
const query=new URLSearchParams()
for(const[name,value]of Object.entries(params))if(value !==null && value !==undefined)query.set(name,String(value))
return win.hermesDesktop.api({path:'/api/git/' + endpoint + '?' + query})
}
const providers=new Map()
const providerFor=async cwd=>{
if(providers.has(cwd))return providers.get(cwd)
const bridge=win.hermesDesktop
let provider=null
if(bridge?.api){
try{
await remoteApi('status',{path:cwd})
provider={
status:path=> remoteApi('status',{path}),
bases:async path=>(await remoteApi('base-branches',{path}))?.branches ||[],
worktrees:async path=>(await remoteApi('worktrees',{path}))?.worktrees ||[],
list:(path,scope,base)=> remoteApi('review/list',{path,scope,base}),
diff:async(path,file,scope,base,staged)=>(await remoteApi('review/diff',{path,file,scope,base,staged}))?.diff || ''
}
}catch{provider=null}
}
if(!provider && bridge?.git?.review){
const git=bridge.git
provider={
status:path=> git.repoStatus(path),
bases:async path=>(await git.baseBranchList(path))||[],
worktrees:async path=>(await git.worktreeList?.(path))||[],
list:(path,scope,base)=> git.review.list(path,scope,base),
diff:async(path,file,scope,base,staged)=>(await git.review.diff(path,file,scope,base,staged))|| ''
}
}
providers.set(cwd,provider)
return provider
}
const cwdNow=()=>{try{return String(state?.cwd?.get?.()|| '')}catch{return ''}}
const baseLabel=name=> String(name || '').replace(/^origin\//,'')
let data={cwd:'',repo:'',status:null,bases:[],basesFailed:false,files:[],base:null,ref:null,large:false,loading:false,error:''}
let mode='all'
const diffs=new Map()
const collapsed=new Map()
const closedFolders=new Set()
const openSections=new Map()
let selected='',loadSeq=0,signature=''
const LARGE_DIFF=10000
const defaultName=()=> data.bases.find(branch=> branch.isDefault)?.name || data.bases.find(branch=> baseLabel(branch.name)===data.status?.defaultBranch)?.name || data.status?.defaultBranch || null
const customBase=()=>{const chosen=settings.bases[data.repo];return chosen && data.bases.some(branch=> branch.name===chosen)?chosen:null}
const countsKey=file=> file.path + ':' + file.added + ':' + file.removed + ':' +(file.status || '')
const load=async({quiet=false}={})=>{
const cwd=cwdNow()
const seq=++loadSeq
if(!quiet){data={...data,loading:true,error:''};if(!data.files.length)render();else schedule()}
const none={cwd,repo:'',status:null,bases:[],basesFailed:false,files:[],base:null,ref:null,large:false,loading:false,error:''}
try{
const provider=cwd?await providerFor(cwd):null
if(seq !==loadSeq)return
if(!provider){data=none;signature='';render();return}
const status=await provider.status(cwd)
if(seq !==loadSeq)return
if(!status){data=none;signature='';render();return}
let basesFailed=false
const[bases,worktrees]=await Promise.all([provider.bases(cwd).catch(()=>{basesFailed=true;return[]}),provider.worktrees(cwd).catch(()=>[])])
const norm=path=> String(path || '').replace(/\\/g,'/').replace(/\/+$/,'')
const repo=worktrees.map(tree=> norm(tree.path)).filter(path=> path &&(norm(cwd)===path || norm(cwd).startsWith(path + '/'))).sort((a,b)=> b.length - a.length)[0]|| norm(cwd)
const was=data
data={...data,cwd,repo,status,bases,basesFailed}
let base=null,ref=null
if(mode==='all'){
const custom=customBase()
if(custom)base=ref=custom
else{ref=(await provider.list(cwd,'branch',null).catch(()=> null))?.base || null;base=ref?defaultName():null}
}
let via='lastTurn'
let files=(await provider.list(cwd,'lastTurn',ref || 'HEAD').catch(()=> null))?.files ||[]
if(!files.length && !ref){
const fresh=(await provider.list(cwd,'uncommitted',null).catch(()=> null))?.files ||[]
if(fresh.length){files=fresh;via='uncommitted'}
}
if(seq !==loadSeq)return
files=files.map(file=>({...file,via})).sort((a,b)=> a.path.localeCompare(b.path))
const scope=mode + '#' +(ref || 'HEAD')+ '#' +(status.branch || '')
const next=files.map(countsKey).join('|')+ '#' + scope
const changed=next !==signature || was.loading || Boolean(was.error)
if(next !==signature){
if(!signature.endsWith('#' + scope))diffs.clear()
signature=next
const keep=new Set(files.map(countsKey))
for(const[path,entry]of diffs)if(!keep.has(entry.counts))diffs.delete(path)
}
const large=files.reduce((sum,file)=> sum +(file.added || 0)+(file.removed || 0),0)> LARGE_DIFF
data={...data,files,base,ref:ref || 'HEAD',large,loading:false,error:''}
if(changed)render()
refreshDiffs()
}catch(error){
if(seq !==loadSeq)return
if(quiet && data.files.length){data={...data,loading:false};return}
data={...none,error:String(error?.message || error)}
signature=''
render()
}
}
const readDiff=async file=>{
const provider=await providerFor(data.cwd)
if(file.via==='uncommitted')return provider.diff(data.cwd,file.path,'uncommitted',null,false)
const text=await provider.diff(data.cwd,file.path,'lastTurn',data.ref,false)
if(text.trim()|| file.status !=='?')return text
return provider.diff(data.cwd,file.path,'uncommitted',null,false)
}
const fetchDiff=async file=>{
const known=diffs.get(file.path)
if(known)return
const entry={text:null,loading:true,counts:countsKey(file)}
diffs.set(file.path,entry)
try{
entry.text=await readDiff(file)
}catch(error){
entry.text=''
entry.error=String(error?.message || error)
}
entry.loading=false
if(diffs.get(file.path)===entry)renderDiff(file.path)
}
const visible=new Set()
const refreshDiffs=()=>{
for(const[path,entry]of[...diffs]){
if(entry.loading)continue
const file=data.files.find(item=> item.path===path)
if(!file)continue
if(!visible.has(path)|| isCollapsed(file)){diffs.delete(path);continue}
readDiff(file).then(text=>{
if(diffs.get(path)!==entry || text===entry.text)return
diffs.set(path,{text,loading:false,counts:entry.counts})
renderDiff(path)
},()=>{})
}
}
const parseDiff=text=>{
const rows=[]
let oldLine=0,newLine=0,binary=false,header=true
const lines=String(text || '').split('\n')
if(lines[lines.length - 1]==='')lines.pop()
for(const line of lines){
if(line.startsWith('diff --git')){header=true;continue}
if(line.startsWith('@@')){
const match=line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/)
if(match){oldLine=Number(match[1]);newLine=Number(match[2]);rows.push({kind:'hunk',oldLine,newLine,text:line});header=false}
continue
}
if(/^Binary files /.test(line)|| /^GIT binary patch/.test(line)){binary=true;continue}
if(!rows.length || /^\\ No newline/.test(line)||(header && /^(index |--- |\+\+\+ |new file mode|deleted file mode|old mode|new mode|similarity index|rename (from|to))/.test(line)))continue
if(line.startsWith('+'))rows.push({kind:'add',newLine:newLine++,text:line.slice(1)})
else if(line.startsWith('-'))rows.push({kind:'del',oldLine:oldLine++,text:line.slice(1)})
else if(line.startsWith(' ')|| line==='')rows.push({kind:'ctx',oldLine:oldLine++,newLine:newLine++,text:line.slice(1)})
}
return{rows,binary}
}
const chipsOf=text=>{
const chips=[]
const head=String(text || '').split(/\n@@/)[0]
if(/^(Binary files |GIT binary patch)/m.test(text || ''))chips.push('Binary file')
if(/^old mode 100644$/m.test(head)&& /^new mode 100755$/m.test(head))chips.push('Made executable')
if(/^old mode 100755$/m.test(head)&& /^new mode 100644$/m.test(head))chips.push('No longer executable')
const renamed=head.match(/^rename from (.+)$/m)?.[1]
if(renamed)chips.push('Renamed from\u0020' + renamed)
return chips
}
const pairRuns=rows=>{
const out=[]
for(let at=0;at < rows.length;){
if(rows[at].kind !=='del' && rows[at].kind !=='add'){out.push({row:rows[at]});at++;continue}
const dels=[],adds=[]
while(at < rows.length && rows[at].kind==='del')dels.push(rows[at++])
while(at < rows.length && rows[at].kind==='add')adds.push(rows[at++])
out.push({dels,adds})
}
return out
}
const tokens=text=> text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)||[]
const changedTokens=(a,b)=>{
const x=tokens(a),y=tokens(b)
if(x.length * y.length > 40000)return null
const table=Array.from({length:x.length + 1},()=> new Uint16Array(y.length + 1))
for(let i=x.length - 1;i >=0;i--)for(let j=y.length - 1;j >=0;j--)table[i][j]=x[i]===y[j]?table[i + 1][j + 1]+ 1:Math.max(table[i + 1][j],table[i][j + 1])
const markA=new Array(x.length).fill(true),markB=new Array(y.length).fill(true)
for(let i=0,j=0;i < x.length && j < y.length;){
if(x[i]===y[j]){markA[i]=markB[j]=false;i++;j++}else if(table[i + 1][j]>=table[i][j + 1])i++;else j++
}
const join=(list,marks)=> list.map((token,at)=>[token,Boolean(marks[at]||(token.trim()==='' && marks[at - 1]&& marks[at + 1]))])
return{a:join(x,markA),b:join(y,markB)}
}
const codeCell=(text,marks)=>{
const cell=el('span',{'data-claude-diff-code':''})
if(!marks)cell.textContent=text || ' '
else for(const[token,changed]of marks)cell.append(changed?el('mark',{text:token}):doc.createTextNode(token))
if(!text)cell.textContent=' '
return cell
}
const sameIgnoringSpace=(a,b)=> a.replace(/\s+/g,'')===b.replace(/\s+/g,'')
const SPLIT_MIN=640
const canSplit=()=> !diffsPane || !diffsPane.clientWidth || diffsPane.clientWidth >=SPLIT_MIN
const splitNow=()=> Boolean(settings.sideBySide)&& canSplit()
const diffBody=(file,entry)=>{
const{rows,binary}=parseDiff(entry.text)
const image=CLAUDE_IMAGE_FILE.test(file.path)
if(binary && !image)return null
if(image || !rows.length){
return el('div',{'data-claude-diff-note':''},
el('span',{text:entry.error?'Could not load this diff.':image?'Image file':'No text changes'}),
image?el('button',{type:'button','data-claude-diff-link':'',text:'View image',onclick:()=> openFile(file)}):null)
}
const split=splitNow()
const table=el('div',{'data-claude-diff-table':split?'split':'unified'})
const number=value=> el('span',{'data-claude-diff-num':'',text:value===undefined?'':String(value)})
const unifiedRow=(kind,row,marks)=> el('div',{'data-claude-diff-row':kind},number(kind==='del'?row.oldLine:row.newLine),el('span',{'data-claude-diff-sign':'',text:kind==='add'?'+':kind==='del'?'−':''}),codeCell(row.text,marks))
const splitSide=(kind,row,marks)=>{
const num=number(row?(kind==='add'?row.newLine:row.oldLine):undefined)
if(row && kind !=='ctx')num.setAttribute('data-claude-diff-num',kind)
return[num,el('span',{'data-claude-diff-side':row?kind:'none'},row?codeCell(row.text,marks):codeCell(''))]
}
let changes=0
for(const part of pairRuns(rows)){
if(part.row){
const row=part.row
if(row.kind==='hunk'){if(table.childElementCount || row.oldLine > 1 || row.newLine > 1)table.append(el('div',{'data-claude-diff-row':'hunk','aria-hidden':'true'}));continue}
if(split)table.append(el('div',{'data-claude-diff-row':'ctx'},...splitSide('ctx',{...row,newLine:row.oldLine}),...splitSide('ctx',{...row,oldLine:row.newLine})))
else table.append(unifiedRow('ctx',row))
continue
}
const count=Math.max(part.dels.length,part.adds.length)
for(let at=0;at < count;at++){
const del=part.dels[at],add=part.adds[at]
if(settings.hideWhitespace && del && add && sameIgnoringSpace(del.text,add.text)){
const row={oldLine:del.oldLine,newLine:add.newLine,text:add.text}
table.append(split?el('div',{'data-claude-diff-row':'ctx'},...splitSide('ctx',{oldLine:del.oldLine,text:del.text}),...splitSide('ctx',{oldLine:add.newLine,text:add.text})):unifiedRow('ctx',row))
continue
}
changes++
const marks=settings.highlightWords && del && add?changedTokens(del.text,add.text):null
if(split)table.append(el('div',{'data-claude-diff-row':'pair'},...splitSide('del',del,marks?.a),...splitSide('add',add,marks?.b)))
else{
if(del && at < part.dels.length)table.append(unifiedRow('del',del,marks?.a))
}
}
if(!split){
for(let at=0;at < part.adds.length;at++){
const del=part.dels[at],add=part.adds[at]
if(settings.hideWhitespace && del && sameIgnoringSpace(del.text,add.text))continue
const marks=settings.highlightWords && del?changedTokens(del.text,add.text):null
table.append(unifiedRow('add',add,marks?.b))
}
}
}
table.whitespaceOnly=settings.hideWhitespace && !changes
const widest=rows.reduce((most,row)=> Math.max(most,row.oldLine || 0,row.newLine || 0),0)
table.style.setProperty('--claude-ln-width',String(widest).length + 'ch')
return table
}
const SECTIONS=[['test','Test files'],['build','Build files'],['generated','Generated files']]
const kindOf=path=> CLAUDE_GENERATED_FILE.test(path)?'generated':CLAUDE_BUILD_FILE.test(path)?'build':CLAUDE_TEST_FILE.test(path)?'test':'source'
const treeOf=files=>{
const top=[],dirs=new Map([['',top]])
for(const file of files){
const parts=file.path.split('/'),name=parts.pop()
let at='',into=top
for(const part of parts){
const path=at?at + '/' + part:part
let children=dirs.get(path)
if(!children){children=[];dirs.set(path,children);into.push({kind:'dir',name:part,path,children})}
at=path
into=children
}
into.push({kind:'file',name,path:file.path,file})
}
const join=nodes=> nodes.map(node=>{
if(node.kind !=='dir')return node
const children=join(node.children)
if(children.length===1 && children[0].kind==='dir')return{...children[0],name:node.name + '/' + children[0].name}
return{...node,children}
})
return join(top)
}
const flatten=nodes=> nodes.flatMap(node=> node.kind==='dir'?flatten(node.children):[node.file])
const groups=()=>{
const files=data.files.slice()
const split=settings.separateGenerated
?[{kind:'source',files:files.filter(file=> kindOf(file.path)==='source')},...SECTIONS.map(([kind,title])=>({kind,title,files:files.filter(file=> kindOf(file.path)===kind)}))]
:[{kind:'source',files}]
return split.filter(group=> group.files.length).map(group=>{
const nodes=settings.groupByFolder?treeOf(group.files):group.files.map(file=>({kind:'file',name:nameOf(file.path),path:file.path,file}))
return{...group,nodes,files:flatten(nodes)}
})
}
const nameOf=path=> path.split('/').pop()
const dirOf=path=> path.split('/').slice(0,-1).join('/')
const isCollapsed=file=> collapsed.has(file.path)?collapsed.get(file.path):data.large || CLAUDE_IMAGE_FILE.test(file.path)||(file.added + file.removed)> 1500
const counts=file=> el('span',{'data-claude-diff-counts':''},el('span',{'data-claude-diff-added':'',text:'+' +(file.added || 0)}),el('span',{'data-claude-diff-removed':'',text:'−' +(file.removed || 0)}))
const lit=(text,from,hits)=>{
const out=el('span',{})
if(!hits?.size){out.textContent=text;return[...out.childNodes]}
let run=''
for(let at=0;at < text.length;at++){
if(hits.has(from + at)){if(run)out.append(run);run='';out.append(el('b',{'data-lit':'',text:text[at]}))}else run +=text[at]
}
if(run)out.append(run)
return[...out.childNodes]
}
const fileLabel=(file,{dir=true,hits=null}={})=>{
const folder=dirOf(file.path)
return[el('span',{'data-claude-result-icon':''}),
el('span',{'data-claude-diff-label':''},
el('span',{'data-claude-diff-name':''},...lit(nameOf(file.path),folder?folder.length + 1:0,hits)),
dir && folder?el('span',{'data-claude-diff-dir':''},...lit(folder,0,hits)):null)]
}
const treeOpener=()=>{
const element=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host]) [data-project-tree]")
const key=element && Object.keys(element).find(name=> name.startsWith('__reactFiber$'))
for(let fiber=key?element[key]:null,depth=0;fiber && depth < 8;fiber=fiber.return,depth++)if(typeof fiber.memoizedProps?.onPreviewFile==='function')return fiber.memoizedProps.onPreviewFile
return null
}
const absPath=file=>(data.repo || data.cwd).replace(/\/+$/,'')+ '/' + file.path
const openFile=async file=>{
const path=absPath(file)
const tool=doc.querySelector("[data-claude-pane-tool='folder']")
if(tool && tool.getAttribute('aria-pressed')!=='true'){
tool.click()
await waitFor(()=> tool.getAttribute('aria-pressed')==='true',4000)
}
const open=await waitFor(treeOpener,5000)
open?.(path)
}
const LIST={DEFAULT:240,MIN:160,MAX:640}
let narrow=false,split=null,sizer=null
const filesShown=()=> !narrow && Boolean(settings.showFiles)
const toggleFiles=()=>{
if(narrow)return
settings.showFiles=!settings.showFiles
saveSettings()
applyLayout()
}
const listWidth=()=> Math.max(LIST.MIN,Math.min(LIST.MAX,Number(settings.listWidth)|| LIST.DEFAULT))
const applyLayout=()=>{
if(!card)return
const width=body?.getBoundingClientRect().width || 0
if(width)narrow=width < LIST.DEFAULT + 160
setAttr(card,'data-claude-changes-files',filesShown()?'shown':'hidden')
card.style.setProperty('--claude-changes-list-width',listWidth()+ 'px')
const listButton=header?.querySelector("[data-claude-changes-action='list']")
if(listButton){
setAttr(listButton,'aria-pressed',filesShown()?'true':'false')
const label=filesShown()?'Hide files':'Show files'
setAttr(listButton,'aria-label',label)
setAttr(listButton,'title',label)
if(listButton.hidden !==narrow)listButton.hidden=narrow
}
scopeTitle()
clipDirs()
const now=splitNow()
if(split !==null && now !==split && data.files.length){split=now;for(const path of sections.keys())renderDiff(path)}
split=now
}
const scopeTitle=()=>{
if(!scopeButton)return
const cut=[...scopeButton.querySelectorAll(':scope > span')].some(span=> span.scrollWidth > span.clientWidth)
const label=scopeButton.dataset.label || ''
if(cut)setAttr(scopeButton,'title',label);else scopeButton.removeAttribute('title')
}
const clipDirs=()=>{
if(!listPane || !filesShown())return
for(const dir of listPane.querySelectorAll('[data-claude-diff-dir]')){
const clipped=dir.scrollWidth > dir.clientWidth && dir.clientWidth < 60
if(dir.hasAttribute('data-clipped')!==clipped)dir.toggleAttribute('data-clipped',clipped)
}
}
const startResize=event=>{
if(event.button !==0)return
event.preventDefault()
event.stopPropagation()
const handle=event.currentTarget
handle.setPointerCapture?.(event.pointerId)
const left=card.getAttribute('data-claude-changes-position')==='left'
const move=moved=>{
const box=body.getBoundingClientRect()
const width=left?moved.clientX - box.left:box.right - moved.clientX
settings.listWidth=Math.round(Math.max(LIST.MIN,Math.min(LIST.MAX,box.width - 160,width)))
card.style.setProperty('--claude-changes-list-width',settings.listWidth + 'px')
}
const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);saveSettings();applyLayout()}
handle.addEventListener('pointermove',move)
handle.addEventListener('pointerup',end)
handle.addEventListener('pointercancel',end)
}
let card=null,header=null,title=null,scopeButton=null,body=null,diffsPane=null,listPane=null,emptyNote=null,observer=null
const sections=new Map()
const build=host=>{
card=el('div',{'data-claude-changes':''})
header=el('div',{'data-claude-changes-header':''})
scopeButton=el('button',{type:'button','data-claude-changes-scope':'','aria-haspopup':'menu','aria-expanded':'false',onclick:event=>{event.stopPropagation();openScopeMenu(scopeButton)}})
scopeButton.addEventListener('pointerdown',event=> event.stopPropagation())
title=el('span',{'data-claude-changes-title':'',text:'Changes'})
const tools=el('span',{'data-claude-changes-tools':''},
button('search','Go to file',openSearch),
button('more','More actions',openMoreMenu,{'aria-haspopup':'menu','aria-expanded':'false'}),
button('expand','Expand Changes',()=>{
const on=root.getAttribute('data-claude-expanded')==='changes'
on?root.removeAttribute('data-claude-expanded'):root.setAttribute('data-claude-expanded','changes')
render()
}),
button('close','Close Changes',()=>{if(root.getAttribute('data-claude-expanded')==='changes')root.removeAttribute('data-claude-expanded');doc.querySelector("[data-claude-pane-tool='diff']")?.click()}))
header.append(button('list','Show files',()=> toggleFiles()),title,scopeButton,tools)
diffsPane=el('div',{'data-claude-changes-diffs':''})
listPane=el('div',{'data-claude-changes-list':'',role:'tree',tabindex:'0','aria-label':'Changed files'})
listPane.addEventListener('keydown',onTreeKey)
listPane.addEventListener('contextmenu',onRowMenu)
diffsPane.addEventListener('contextmenu',onRowMenu)
const handle=el('div',{'data-claude-changes-resize':'',role:'separator','aria-orientation':'vertical','aria-label':'Resize file list'})
handle.addEventListener('pointerdown',startResize)
emptyNote=el('div',{'data-claude-changes-empty':''})
body=el('div',{'data-claude-changes-body':''},diffsPane,handle,listPane,emptyNote)
card.append(header,body)
host.prepend(card)
sizer=win.ResizeObserver?new win.ResizeObserver(()=> applyLayout()):null
sizer?.observe(card)
observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>{
for(const entry of entries){
if(!entry.isIntersecting){visible.delete(entry.target.dataset.path);continue}
visible.add(entry.target.dataset.path)
const file=data.files.find(item=> item.path===entry.target.dataset.path)
if(file && !isCollapsed(file))fetchDiff(file)
}
},{root:diffsPane,rootMargin:'400px 0px'}):null
diffsPane.addEventListener('scroll',()=> syncSelectedFromScroll(),{passive:true})
if(!settings.hermesView)load()
}
const applyView=()=>{
const host=card?.parentElement
if(!host)return
const hermes=Boolean(settings.hermesView)
if(host.hasAttribute('data-claude-changes-host')===hermes)host.toggleAttribute('data-claude-changes-host',!hermes)
if(host.hasAttribute('data-claude-changes-hermes')!==hermes)host.toggleAttribute('data-claude-changes-hermes',hermes)
setAttr(card,'data-claude-changes-view',hermes?'hermes':'claude')
}
const setHermesView=on=>{
settings.hermesView=on
saveSettings()
if(on && root.getAttribute('data-claude-expanded')==='changes')root.removeAttribute('data-claude-expanded')
applyView()
if(on)render();else load()
}
const syncSelectedFromScroll=()=>{
const top=diffsPane.getBoundingClientRect().top
let current=''
for(const[path,section]of sections)if(section.getBoundingClientRect().top - top <=8)current=path
if(current && current !==selected){selected=current;markSelected()}
}
const markSelected=()=>{
for(const row of listPane.querySelectorAll('[data-claude-changes-row]')){
if(row.dataset.path===selected)setAttr(row,'aria-current','true');else row.removeAttribute('aria-current')
}
}
const renderDiff=path=>{
const section=sections.get(path)
const file=data.files.find(item=> item.path===path)
if(!section || !file)return
const bodyNode=section.querySelector(':scope > [data-claude-diff-body]')
const entry=diffs.get(path)
const ready=entry && !entry.loading
const table=ready?diffBody(file,entry):null
bodyNode.replaceChildren(...(!ready?[el('div',{'data-claude-diff-note':'',text:'Loading…'})]:table?[table]:[]))
const chips=section.querySelector('[data-claude-diff-chips]')
if(chips && ready)chips.replaceChildren(...[...chipsOf(entry.text),...(table?.whitespaceOnly?['Whitespace only']:[])].map(text=> el('span',{'data-claude-diff-chip':'',text})))
}
const toggleFile=(file,open)=>{
collapsed.set(file.path,!open)
const section=sections.get(file.path)
section?.setAttribute('aria-expanded',open?'true':'false')
section?.querySelector('[data-claude-diff-head]')?.setAttribute('aria-expanded',open?'true':'false')
if(open){fetchDiff(file);renderDiff(file.path)}
}
const emptyState=()=>{
if(data.loading && !data.files.length)return[el('span',{'data-claude-changes-spinner':'',role:'status','aria-label':'Loading changes'})]
if(data.error){
return[glyph('warning'),el('p',{text:'Couldn’t load the changes'}),
el('button',{type:'button','data-claude-changes-retry':'',text:'Try again',onclick:()=>{signature='';load()}})]
}
if(!data.status)return[el('p',{text:'Changes need a Git repository'}),el('p',{text:'None was found for this session, or its folder couldn’t be reached.'})]
return[el('p',{text:mode==='uncommitted'?'No uncommitted changes':'No changes to show'})]
}
const render=()=>{
if(!card)return
const base=baseLabel(data.base)
const branch=data.status?.branch || ''
scopeButton.replaceChildren()
scopeButton.hidden=!data.status
title.hidden=Boolean(data.status)
if(data.status){
if(mode==='uncommitted')scopeButton.append(el('span',{text:'Uncommitted changes'}))
else{
const head=base && branch && base !==branch?branch:'working tree'
const arrow=glyph('arrow')
arrow.setAttribute('data-claude-changes-arrow','')
arrow.setAttribute('role','img')
arrow.setAttribute('aria-label','to')
arrow.removeAttribute('aria-hidden')
scopeButton.append(el('span',{text:base || 'HEAD'}),arrow,el('span',{text:head}))
}
const label=mode==='uncommitted'?'Uncommitted changes':(base || 'HEAD')+ ' → ' +(base && branch && base !==branch?branch:'working tree')
scopeButton.dataset.label=label
scopeButton.setAttribute('aria-label','Diff scope: ' + label)
scopeButton.append(glyph('caretDown'))
}
const hasFiles=data.files.length > 0
card.toggleAttribute('data-claude-changes-has-files',hasFiles)
setAttr(card,'data-claude-changes-position',settings.listPosition==='left'?'left':'right')
setAttr(card,'data-claude-changes-wrap',settings.wordWrap?'on':'off')
const expand=header.querySelector("[data-claude-changes-action='expand']")
const expanded=root.getAttribute('data-claude-expanded')==='changes'
expand.replaceChildren(glyph(expanded?'collapse':'expand'))
expand.setAttribute('aria-label',expanded?'Restore Changes':'Expand Changes')
expand.title=expand.getAttribute('aria-label')
const scroll=diffsPane.scrollTop
observer?.disconnect()
visible.clear()
sections.clear()
diffsPane.replaceChildren()
if(data.large && hasFiles)diffsPane.append(el('div',{'data-claude-changes-banner':'',text:'Files are collapsed for large diffs. Select a file to expand it.'}))
for(const group of groups()){
for(const file of group.files){
const open=!isCollapsed(file)
const section=el('section',{'data-claude-diff-file':'','data-path':file.path,'aria-expanded':open?'true':'false'})
const head=el('div',{'data-claude-diff-head':'','data-path':file.path,title:file.path,role:'button',tabindex:'0','aria-expanded':open?'true':'false'},
el('span',{'data-claude-diff-chevron':''},glyph('fold')),...fileLabel(file),el('span',{'data-claude-diff-chips':''}),
el('span',{'data-claude-diff-actions':''},counts(file),
CLAUDE_IMAGE_FILE.test(file.path)?button('image','View image',()=> openFile(file)):null,
button('open','Open file',()=> openFile(file))))
head.addEventListener('click',()=> toggleFile(file,section.getAttribute('aria-expanded')!=='true'))
head.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();toggleFile(file,section.getAttribute('aria-expanded')!=='true')}})
section.append(head,el('div',{'data-claude-diff-body':''}))
diffsPane.append(section)
sections.set(file.path,section)
if(open)renderDiff(file.path)
observer?.observe(section)
}
}
diffsPane.scrollTop=scroll
renderList()
applyLayout()
emptyNote.replaceChildren(...emptyState())
}
const sectionOpen=group=> openSections.has(group.kind)?openSections.get(group.kind):group.files.some(file=> file.path===selected)
const renderList=()=>{
const focused=listPane.contains(doc.activeElement)?doc.activeElement.getAttribute('data-key'):null
listPane.replaceChildren()
const guides=depth=> depth?{'data-depth':String(depth),style:`--claude-tree-depth: ${depth}`}:{}
const fileRow=(file,depth,lift,flat)=>{
const row=el('div',{'data-claude-changes-row':'','data-key':'file:' + file.path,'data-path':file.path,title:file.path,role:'treeitem',tabindex:'-1','aria-level':String(depth + lift + 1),'aria-current':file.path===selected?'true':null,...guides(depth)},
...fileLabel(file,{dir:flat}),counts(file))
row.addEventListener('click',()=> goTo(file.path))
return row
}
const nodesInto=(nodes,depth,lift,out)=>{
for(const node of nodes){
if(node.kind==='file'){out.push(fileRow(node.file,depth,lift,!settings.groupByFolder));continue}
const open=!closedFolders.has(node.path)
const row=el('button',{type:'button','data-claude-changes-folder':'','data-key':'dir:' + node.path,'data-dir':node.path,title:node.path,role:'treeitem',tabindex:'-1','aria-level':String(depth + lift + 1),'aria-expanded':open?'true':'false',...guides(depth)},
glyph('caretRight'),el('span',{'data-claude-diff-name':'',text:node.name}))
row.addEventListener('click',()=> toggleFolder(node.path))
out.push(row)
if(open)nodesInto(node.children,depth + 1,lift,out)
}
}
for(const group of groups()){
const rows=[]
if(!group.title){nodesInto(group.nodes,0,0,rows);listPane.append(...rows);continue}
const open=sectionOpen(group)
const head=el('button',{type:'button','data-claude-changes-section':group.kind,'data-key':'section:' + group.kind,role:'treeitem',tabindex:'-1','aria-level':'1','aria-expanded':open?'true':'false'},
glyph('caretRight'),el('span',{'data-claude-section-label':'',text:group.title}),el('span',{'data-claude-section-count':'',text:String(group.files.length)}))
head.addEventListener('click',()=>{openSections.set(group.kind,!sectionOpen(group));renderList()})
if(open)nodesInto(group.nodes,0,1,rows)
listPane.append(el('div',{'data-claude-changes-group':group.kind,role:'group'},head,...rows))
}
if(focused)listPane.querySelector(`[data-key="${win.CSS.escape(focused)}"]`)?.focus()
clipDirs()
}
const toggleFolder=path=>{if(closedFolders.has(path))closedFolders.delete(path);else closedFolders.add(path);renderList()}
const onTreeKey=event=>{
const rows=[...listPane.querySelectorAll("[role='treeitem']")]
if(!rows.length)return
const now=rows.includes(doc.activeElement)?doc.activeElement:rows.find(row=> row.getAttribute('aria-current')==='true')|| null
const at=now?rows.indexOf(now):-1
const focus=row=>{if(row){row.focus();row.scrollIntoView?.({block:'nearest'})}}
const expandable=now?.hasAttribute('aria-expanded')
const isOpen=now?.getAttribute('aria-expanded')==='true'
const key=event.key
if(key==='ArrowDown')focus(rows[Math.min(rows.length - 1,at + 1)])
else if(key==='ArrowUp')focus(rows[Math.max(0,at - 1)])
else if(key==='Home')focus(rows[0])
else if(key==='End')focus(rows[rows.length - 1])
else if(key==='ArrowRight' && now){if(expandable && !isOpen)now.click();else if(expandable)focus(rows[at + 1])}
else if(key==='ArrowLeft' && now){
if(expandable && isOpen)now.click()
else{const level=Number(now.getAttribute('aria-level'));for(let up=at - 1;up >=0;up--)if(Number(rows[up].getAttribute('aria-level'))< level){focus(rows[up]);break}}
}else if(key==='Enter' && now){
const path=now.getAttribute('data-path')
if(path &&(event.ctrlKey || event.metaKey)){const file=data.files.find(item=> item.path===path);if(file)openFile(file)}else now.click()
}else return
event.preventDefault()
event.stopPropagation()
}
const goTo=path=>{
const file=data.files.find(item=> item.path===path)
const section=sections.get(path)
if(!file || !section)return
selected=path
markSelected()
if(isCollapsed(file))toggleFile(file,true)
diffsPane.scrollTop +=section.getBoundingClientRect().top - diffsPane.getBoundingClientRect().top
}
let menu=null,submenu=null,menuAnchor=null
const closeMenus=()=>{
const inside=[menu,submenu,searchBox].some(node=> node?.contains(doc.activeElement))
submenu?.remove();menu?.remove();searchBox?.remove()
submenu=menu=searchBox=null
card?.querySelectorAll("[aria-expanded='true'][aria-haspopup='menu']").forEach(node=> node.setAttribute('aria-expanded','false'))
if(inside && menuAnchor?.isConnected)menuAnchor.focus({preventScroll:true})
menuAnchor=null
}
const paintCheck=(row,on,hint)=>{
row.setAttribute('aria-checked',String(Boolean(on)))
const tail=row.querySelector('[data-claude-menu-tail]')
tail.querySelector('[data-claude-menu-check]')?.remove()
if(on){const check=glyph('check');check.setAttribute('data-claude-menu-check','');tail.prepend(check)}
if(hint !==undefined){
tail.querySelector('[data-claude-menu-hint]')?.remove()
if(hint)tail.append(el('span',{'data-claude-menu-hint':'',text:hint}))
}
}
const menuRow=(item,onOpenSub)=>{
const role=item.checked===undefined?'menuitem':item.radio?'menuitemradio':'menuitemcheckbox'
const row=el('div',{'data-claude-menu-row':'',role,'aria-checked':item.checked===undefined?null:String(Boolean(item.checked)),'aria-disabled':item.disabled?'true':null,title:item.tooltip || null,tabindex:'-1'},el('span',{text:item.label}))
const tail=el('span',{'data-claude-menu-tail':''})
if(item.checked){const check=glyph('check');check.setAttribute('data-claude-menu-check','');tail.append(check)}
if(item.hint)tail.append(el('span',{'data-claude-menu-hint':'',text:item.hint}))
if(item.sub){tail.append(glyph('chevron'));row.setAttribute('aria-haspopup','menu')}
row.append(tail)
row.addEventListener('pointerenter',()=> onOpenSub?.(item.sub?row:null,item))
row.addEventListener('click',event=>{
event.preventDefault();event.stopPropagation()
if(item.disabled)return
if(item.sub){onOpenSub?.(row,item);return}
if(item.keepOpen){item.onSelect?.();paintCheck(row,item.isChecked(),item.hintNow?.()??undefined);return}
closeMenus()
item.onSelect?.()
})
return row
}
const showMenu=(anchor,items,align='right')=>{
if(menu){const same=anchor?.getAttribute?.('aria-expanded')==='true';closeMenus();if(same)return}
menu=el('div',{'data-claude-files-menu':'main',role:'menu'})
const openSub=(row,item)=>{
submenu?.remove();submenu=null
menu.querySelectorAll('[data-claude-menu-open]').forEach(node=> node.removeAttribute('data-claude-menu-open'))
if(!row)return
row.setAttribute('data-claude-menu-open','')
submenu=item.buildSub()
doc.body.append(submenu)
const box=row.getBoundingClientRect(),outer=menu.getBoundingClientRect()
const right=outer.right + 4
submenu.style.left=(right + submenu.offsetWidth < win.innerWidth - 8 && align==='left'?right:Math.max(8,outer.left - submenu.offsetWidth - 4))+ 'px'
submenu.style.top=Math.max(8,Math.min(box.top - 5,win.innerHeight - submenu.offsetHeight - 8))+ 'px'
submenu.querySelector('input')?.focus()
}
for(const item of items)menu.append(item==='-'?el('div',{role:'separator'}):menuRow(item,openSub))
doc.body.append(menu)
menuAnchor=anchor?.focus?anchor:null
const box=anchor?.getBoundingClientRect?anchor.getBoundingClientRect():{left:anchor.x,right:anchor.x,top:anchor.y,bottom:anchor.y - 6}
if(anchor?.setAttribute)anchor.setAttribute('aria-expanded','true')
menu.style.left=Math.max(8,Math.min(align==='left'?box.left:box.right - menu.offsetWidth,win.innerWidth - menu.offsetWidth - 8))+ 'px'
menu.style.top=Math.round(Math.max(8,Math.min(box.bottom + 6,win.innerHeight - menu.offsetHeight - 8)))+ 'px'
if(anchor?.matches?.(':focus-visible'))menu.querySelector("[data-claude-menu-row]:not([aria-disabled='true'])")?.focus()
}
const onMenuKey=event=>{
const layer=submenu?.contains(doc.activeElement)?submenu:menu
const typing=doc.activeElement?.tagName==='INPUT'
const rows=[...layer.querySelectorAll('[data-claude-menu-row]')].filter(row=> row.getAttribute('aria-disabled')!=='true')
const at=rows.indexOf(doc.activeElement)
const key=event.key
const go=row=>{if(row){row.focus();row.scrollIntoView?.({block:'nearest'})}}
if(key==='ArrowDown' || key==='ArrowUp')go(rows[at < 0?(key==='ArrowDown'?0:rows.length - 1):(at +(key==='ArrowDown'?1:-1)+ rows.length)% rows.length])
else if(!typing &&(key==='Home' || key==='End'))go(key==='Home'?rows[0]:rows[rows.length - 1])
else if(at >=0 && rows[at].hasAttribute('aria-haspopup')&&(key==='ArrowRight' || key==='Enter' || key===' ')){
rows[at].click()
if(!submenu?.contains(doc.activeElement))submenu?.querySelector("[data-claude-menu-row]:not([aria-disabled='true'])")?.focus()
}else if(at >=0 &&(key==='Enter' || key===' '))rows[at].click()
else if(!typing && key==='ArrowLeft' && layer===submenu){
const parent=menu.querySelector('[data-claude-menu-open]')
submenu.remove();submenu=null
parent?.removeAttribute('data-claude-menu-open')
parent?.focus()
}else return false
event.preventDefault();event.stopPropagation()
return true
}
const simpleSub=items=>()=>{
const box=el('div',{'data-claude-files-menu':'sub',role:'menu'})
for(const item of items)box.append(menuRow(item))
return box
}
const openScopeMenu=anchor=>{
const base=baseLabel(data.base)|| 'base'
const branchSub=()=>{
const box=el('div',{'data-claude-files-menu':'sub','data-claude-branch-menu':'',role:'menu'})
const input=el('input',{type:'text',placeholder:'Search branches','aria-label':'Search branches',spellcheck:'false'})
const list=el('div',{'data-claude-branch-list':''})
const ordered=()=>{
const fallback=defaultName()
const rest=data.bases.filter(branch=> branch.name !==fallback && baseLabel(branch.name)!==data.status?.branch).sort((a,b)=> a.name.localeCompare(b.name))
const first=data.bases.find(branch=> branch.name===fallback)
return first?[first,...rest]:rest
}
const fill=()=>{
const query=input.value.trim().toLowerCase()
const fallback=defaultName()
const current=customBase()|| fallback
list.replaceChildren(...ordered().filter(branch=> !query || branch.name.toLowerCase().includes(query)).slice(0,200).map(branch=> menuRow({
label:baseLabel(branch.name)===branch.name || !data.bases.some(other=> other !==branch && baseLabel(other.name)===baseLabel(branch.name))?baseLabel(branch.name):branch.name,
checked:branch.name===current,radio:true,hint:branch.name===fallback?'default':null,
onSelect:()=>{if(branch.name===fallback)delete settings.bases[data.repo];else settings.bases[data.repo]=branch.name;saveSettings();mode='all';load()}
})))
if(!list.childElementCount)list.append(el('div',{'data-claude-menu-empty':'',text:data.basesFailed?'Couldn’t load branches':data.loading && !data.bases.length?'Loading branches…':'No branches match'}))
}
input.addEventListener('input',fill)
input.addEventListener('keydown',event=>{if(event.key==='Enter')list.querySelector('[data-claude-menu-row]')?.click();if(event.key==='Escape'){event.stopPropagation();closeMenus()}})
input.addEventListener('pointerdown',event=> event.stopPropagation())
fill()
box.append(el('div',{'data-claude-branch-search':''},input),list)
return box
}
showMenu(anchor,[
{label:'All changes',checked:mode==='all',radio:true,hint:'vs ' + base,onSelect:()=>{mode='all';load()}},
{label:'Uncommitted changes',checked:mode==='uncommitted',radio:true,onSelect:()=>{mode='uncommitted';load()}},
'-',
{label:'Compare against',hint:base,sub:true,buildSub:branchSub}
],'left')
}
const toggle=key=>({checked:Boolean(settings[key]),keepOpen:true,isChecked:()=> Boolean(settings[key]),onSelect:()=>{settings[key]=!settings[key];saveSettings();render()}})
const splitHint=()=> settings.sideBySide && !canSplit()?'Needs a wider pane':null
const openMoreMenu=anchor=>{
const refresh={label:'Refresh',onSelect:()=>{diffs.clear();signature='';load()}}
const hermesView={label:'Hermes view',checked:Boolean(settings.hermesView),onSelect:()=> setHermesView(!settings.hermesView)}
if(settings.hermesView){showMenu(anchor,[hermesView]);return}
if(!data.files.length){showMenu(anchor,[refresh,'-',hermesView]);return}
const positions=[['auto','Automatic'],['left','Left'],['right','Right']]
const fileItems=narrow?[]:[{label:'Show files',checked:filesShown(),keepOpen:true,isChecked:filesShown,hint:'Ctrl+Shift+Y',onSelect:()=> toggleFiles()}]
showMenu(anchor,[
...fileItems,
{label:'File list position',hint:positions.find(([key])=> key===settings.listPosition)?.[1]|| 'Automatic',sub:true,
buildSub:simpleSub(positions.map(([key,label])=>({label,checked:settings.listPosition===key,radio:true,onSelect:()=>{settings.listPosition=key;saveSettings();render()}})))},
{label:'Group files by folder',...toggle('groupByFolder')},
{label:'Separate test, build, and generated files',...toggle('separateGenerated')},
'-',
{label:'Collapse all files',onSelect:()=>{for(const file of data.files)collapsed.set(file.path,true);render()}},
{label:'Expand all files',disabled:data.large,tooltip:data.large?'This diff is too large to expand at once. Select a file to expand it.':null,onSelect:()=>{for(const file of data.files)collapsed.set(file.path,false);render()}},
'-',
{label:'Side by side',hint:splitHint(),hintNow:()=> splitHint()|| '',...toggle('sideBySide')},
{label:'Word wrap',...toggle('wordWrap')},
{label:'Highlight changed words',...toggle('highlightWords')},
{label:'Hide whitespace changes',...toggle('hideWhitespace')},
'-',
refresh,
hermesView
])
}
const onRowMenu=event=>{
const path=event.target?.closest?.('[data-claude-changes-row], [data-claude-diff-head]')?.getAttribute('data-path')
const file=path && data.files.find(item=> item.path===path)
if(!file)return
event.preventDefault()
event.stopPropagation()
closeMenus()
showMenu({x:event.clientX,y:event.clientY},[
{label:'Copy path',onSelect:()=>{win.navigator.clipboard?.writeText(absPath(file)).catch(()=>{})}},
{label:'Open file',hint:'Ctrl+Enter',onSelect:()=> openFile(file)}
],'left')
}
let searchBox=null
const SEARCH_SHOWN=100
const fuzzy=(path,query)=>{
const text=path.toLowerCase()
const nameAt=path.lastIndexOf('/')+ 1
const attempt=from=>{
const hits=[]
let at=from,score=0,last=-2
for(const char of query){
const found=text.indexOf(char,at)
if(found < 0)return null
score +=1 +(found===last + 1?5:0)+(found===0 || text[found - 1]==='/' || text[found - 1]==='.' || text[found - 1]==='_' || text[found - 1]==='-'?3:0)+(found >=nameAt?2:0)
hits.push(found)
last=found
at=found + 1
}
return{score:score -(path.length / 100),hits}
}
const inName=nameAt?attempt(nameAt):null
const anywhere=attempt(0)
if(inName && anywhere)return inName.score + 10 >=anywhere.score?{...inName,score:inName.score + 10}:anywhere
return inName?{...inName,score:inName.score + 10}:anywhere
}
const openSearch=anchor=>{
if(searchBox){closeMenus();return}
closeMenus()
searchBox=el('div',{'data-claude-changes-search':''})
const input=el('input',{type:'text',placeholder:'Search changed files','aria-label':'Search changed files',spellcheck:'false'})
const list=el('div',{'data-claude-changes-search-list':''})
const footer=el('div',{'data-claude-changes-search-more':''})
let active=0,matches=[]
const fill=()=>{
const query=input.value.trim().toLowerCase().replace(/\s+/g,'')
const order=groups().flatMap(group=> group.files)
matches=!query?order.map(file=>({file,hits:null}))
:order.map(file=>{const found=fuzzy(file.path,query);return found &&{file,hits:new Set(found.hits),score:found.score}}).filter(Boolean).sort((a,b)=> b.score - a.score || a.file.path.localeCompare(b.file.path))
const shown=matches.slice(0,SEARCH_SHOWN)
active=Math.min(active,Math.max(0,shown.length - 1))
list.replaceChildren(...shown.map(({file,hits},at)=>{
const row=el('div',{'data-claude-changes-row':'',title:file.path,'aria-selected':at===active?'true':'false'},...fileLabel(file,{hits}),counts(file))
row.addEventListener('click',()=>{closeMenus();goTo(file.path)})
return row
}))
const more=matches.length - shown.length
footer.textContent=more > 0?more + ' more files. Keep typing to narrow.':matches.length?'':'No matching files'
list.querySelector("[aria-selected='true']")?.scrollIntoView({block:'nearest'})
}
input.addEventListener('input',()=>{active=0;fill()})
input.addEventListener('keydown',event=>{
const count=Math.min(matches.length,SEARCH_SHOWN)
if(event.key==='ArrowDown' || event.key==='ArrowUp'){event.preventDefault();if(count){active=(active +(event.key==='ArrowDown'?1:count - 1))% count;fill()}}
else if(event.key==='Enter'){event.preventDefault();const file=matches[active]?.file;closeMenus();if(file)goTo(file.path)}
else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenus()}
})
searchBox.append(el('div',{'data-claude-changes-search-field':''},input),list,footer)
doc.body.append(searchBox)
fill()
const near=anchor?.getBoundingClientRect?.()|| card.getBoundingClientRect()
const width=Math.min(352,win.innerWidth - 16)
searchBox.style.width=width + 'px'
searchBox.style.left=Math.max(8,Math.min(near.right - width,win.innerWidth - width - 8))+ 'px'
const below=win.innerHeight - near.bottom
searchBox.style.top=Math.round(below < 200 && near.top > below?Math.max(8,near.top - searchBox.offsetHeight - 4):near.bottom + 4)+ 'px'
input.focus()
}
const onOutside=event=>{
if(!menu && !searchBox)return
if(event.target?.closest?.("[data-claude-files-menu], [data-claude-changes-search], [data-claude-changes-scope], [data-claude-changes-action='more'], [data-claude-changes-action='search']"))return
closeMenus()
}
const onKey=event=>{
if(event.key==='Escape' &&(menu || searchBox)){event.preventDefault();event.stopPropagation();closeMenus();return}
if(menu && onMenuKey(event))return
if(!card?.isConnected)return
const mod=(event.ctrlKey || event.metaKey)&& !event.altKey
if(root.getAttribute('data-claude-last-pane')!=='changes')return
if(mod && event.shiftKey && event.key.toLowerCase()==='y'){event.preventDefault();event.stopPropagation();toggleFiles()}
}
const onPress=event=>{
const zone=event.target?.closest?.('[data-tree-group]')?.getAttribute('data-tree-group')
if(zone==='grp-review')root.setAttribute('data-claude-last-pane','changes')
else if(zone==='grp-files' || event.target?.closest?.('[data-claude-preview-column]'))root.setAttribute('data-claude-last-pane','files')
}
let lastCwd=null,poll=0
const place=()=>{
frame=0
if(disposed)return
const zone=doc.querySelector("[data-tree-group='grp-review']:not([data-pane-host])")
const aside=zone?.querySelector('aside')
const host=aside?.parentElement
if(!host){if(card && !card.isConnected)card=null;return}
if(!card || card.parentElement !==host){
doc.querySelectorAll('[data-claude-changes]').forEach(node=> node.remove())
build(host)
applyView()
render()
}
const cwd=cwdNow()
if(cwd !==lastCwd){lastCwd=cwd;if(data.cwd && data.cwd !==cwd){diffs.clear();collapsed.clear();closedFolders.clear();openSections.clear();signature='';selected=''}if(!settings.hermesView)load()}
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [data-tree-group='grp-sessions'] *, [contenteditable='true'], textarea")})
const mutations=new win.MutationObserver(records=>{if(outside(records))schedule()})
mutations.observe(doc.body,{childList:true,subtree:true})
const tick=()=>{if(card?.isConnected && !settings.hermesView && doc.visibilityState !=='hidden' && !menu && !searchBox)load({quiet:true})}
poll=win.setInterval(tick,6000)
const onFocus=()=> tick()
win.addEventListener('focus',onFocus)
doc.addEventListener('pointerdown',onOutside,true)
doc.addEventListener('pointerdown',onPress,true)
doc.addEventListener('keydown',onKey,true)
place()
return()=>{
disposed=true
closeMenus()
mutations.disconnect()
observer?.disconnect()
sizer?.disconnect()
win.clearInterval(poll)
win.removeEventListener('focus',onFocus)
doc.removeEventListener('pointerdown',onOutside,true)
doc.removeEventListener('pointerdown',onPress,true)
doc.removeEventListener('keydown',onKey,true)
if(frame)win.cancelAnimationFrame(frame)
doc.querySelectorAll('[data-claude-changes]').forEach(node=> node.remove())
doc.querySelectorAll('[data-claude-changes-host]').forEach(node=> node.removeAttribute('data-claude-changes-host'))
doc.querySelectorAll('[data-claude-changes-hermes]').forEach(node=> node.removeAttribute('data-claude-changes-hermes'))
if(root.getAttribute('data-claude-expanded')==='changes')root.removeAttribute('data-claude-expanded')
root.removeAttribute('data-claude-last-pane')
}
}
const CLAUDE_OVERFLOW_TOOLS=[
{selector:"button:has(i[class~='codicon-layout-sidebar-left'])",icon:'layout-sidebar-left',cluster:'left'},
{selector:"button[aria-label='Layout editor']",icon:'layout'},
{selector:"button[aria-label='HUD mode']",icon:'screen-full'},
{selector:"button[aria-label='Swap sidebar sides']",icon:'arrow-swap'},
{selector:"button[data-tour='right-pane-toggle']",icon:'layout-sidebar-right',side:true}
]
function installClaudePaneTools({runAction,listActions,paneVisibility,revealPane=null,undismissPane=null,workspace=null,pluginDecisions=null,document:doc=globalThis.document,window:win=globalThis.window}={}){
if(typeof runAction !=='function')return()=>{}
let allowed=null
try{allowed=new Set((listActions?.()||[]).map(action=> action.id))}catch{allowed=null}
const tools=CLAUDE_PANE_TOOLS.filter(tool=> !tool.action || !allowed?.size || allowed.has(tool.action)).map(tool=>({...tool}))
let group=null,menu=null,more=null,frame=0,disposed=false
const offs=[]
const CLAUDE_FILES_HIDDEN_ATTR='data-claude-files-hidden'
const CLAUDE_FILES_HIDDEN_STORAGE_KEY='claude-chat-look.files.hidden'
const root=doc.documentElement
const filesHidden=()=> root.getAttribute(CLAUDE_FILES_HIDDEN_ATTR)==='true'
const setFilesHidden=on=>{
if(on)root.setAttribute(CLAUDE_FILES_HIDDEN_ATTR,'true')
else root.removeAttribute(CLAUDE_FILES_HIDDEN_ATTR)
try{win.localStorage?.setItem(CLAUDE_FILES_HIDDEN_STORAGE_KEY,on?'true':'false')}catch{ /* Private window: session only. */}
}
let stored=null
try{stored=win.localStorage?.getItem(CLAUDE_FILES_HIDDEN_STORAGE_KEY)}catch{}
if(stored !=='false')root.setAttribute(CLAUDE_FILES_HIDDEN_ATTR,'true')
offs.push(()=>{root.removeAttribute(CLAUDE_FILES_HIDDEN_ATTR);root.removeAttribute('data-claude-no-workspace');root.removeAttribute('data-claude-review-off');doc.querySelectorAll('[data-claude-plugin-zone]').forEach(node=> node.removeAttribute('data-claude-plugin-zone'))})
const setAttr=(node,name,value)=>{if(node.getAttribute(name)!==value)node.setAttribute(name,value)}
const hasWorkspace=()=>{
if(typeof workspace?.get !=='function')return true
try{return Boolean(String(workspace.get()??'').trim())}catch{return true}
}
if(typeof workspace?.listen==='function')try{const off=workspace.listen(()=> schedule());if(typeof off==='function')offs.push(off)}catch{}
const setActive=(button,on)=>{
const value=on?'true':'false'
if(button.getAttribute('aria-pressed')!==value)button.setAttribute('aria-pressed',value)
}
const closeMenu=()=>{
menu?.remove()
menu=null
more?.setAttribute('aria-expanded','false')
}
const openMenu=()=>{
if(menu)return closeMenu()
menu=doc.createElement('div')
menu.setAttribute('role','menu')
menu.dataset.claudeAccountMenu=''
menu.dataset.claudeOverflowMenu=''
for(const entry of CLAUDE_OVERFLOW_TOOLS){
const native=doc.querySelector("[data-titlebar-cluster='" +(entry.cluster || 'right')+ "']")?.querySelector(entry.selector)
if(!native)continue
const item=doc.createElement('button')
item.type='button'
item.setAttribute('role','menuitem')
item.dataset.claudeAccountItem=''
const glyph=doc.createElement('i')
glyph.className='codicon codicon-' + entry.icon
glyph.setAttribute('aria-hidden','true')
const label=doc.createElement('span')
label.dataset.claudeAccountLabel=''
label.textContent=entry.side?(sideTools().some(isOpen)?'Hide right sidebar':'Show right sidebar'):(native.getAttribute('aria-label')|| '').split(' · ')[0]
item.append(glyph,label)
item.addEventListener('click',()=>{closeMenu();if(entry.side)toggleSide();else native.click()})
menu.append(item)
}
if(!menu.childElementCount){menu=null;return}
doc.body.append(menu)
const rect=more.getBoundingClientRect()
menu.style.top=(rect.bottom + 4)+ 'px'
menu.style.right=Math.max(8,win.innerWidth - rect.right)+ 'px'
more.setAttribute('aria-expanded','true')
menu.querySelector('button')?.focus()
}
const button=(template,icon,label)=>{
const element=doc.createElement('button')
element.type='button'
element.className=template?.className || ''
element.dataset.claudePaneTool=icon
element.setAttribute('aria-label',label)
element.title=label
let glyph
if(CLAUDE_PANE_ICONS[icon]){
glyph=doc.createElementNS('http://www.w3.org/2000/svg','svg')
glyph.setAttribute('viewBox','0 0 16 16')
glyph.setAttribute('fill','none')
glyph.setAttribute('stroke','currentColor')
glyph.setAttribute('stroke-width','1.25')
glyph.setAttribute('stroke-linecap','round')
glyph.setAttribute('stroke-linejoin','round')
glyph.innerHTML=CLAUDE_PANE_ICONS[icon]
glyph.dataset.claudePaneGlyph=''
}else{
glyph=doc.createElement('i')
glyph.className='codicon codicon-' + icon
}
glyph.setAttribute('aria-hidden','true')
element.append(glyph)
element.addEventListener('pointerdown',event=> event.stopPropagation())
return element
}
const build=template=>{
group=doc.createElement('div')
group.dataset.claudePaneTools=''
for(const tool of tools){
const element=button(template,tool.icon,tool.label)
element.setAttribute('aria-pressed','false')
element.addEventListener('click',()=>{toggle(tool);schedule()})
tool.element=element
group.append(element)
}
jobs=button(template,'routines','Scheduled jobs')
jobs.setAttribute('aria-pressed','false')
jobs.style.display='none'
jobs.addEventListener('click',()=>{toggleJobs();schedule()})
group.append(jobs)
more=button(template,'kebab-vertical','View options')
more.dataset.claudePaneTool='more'
more.setAttribute('aria-haspopup','menu')
more.setAttribute('aria-expanded','false')
more.addEventListener('click',openMenu)
group.append(more)
}
let jobs=null
const JOBS_PANE='hermes-bots:routines'
const jobsTab=()=> doc.querySelector("[role='tab'][data-tree-tab='" + JOBS_PANE + "']")
const jobsOpen=tab=> Boolean(tab)&& tab.getAttribute('data-vertical')!=='true' && Boolean(tab.closest('[data-zone-tabstrip]'))
const botsView=()=> doc.querySelector("[role='tab'][data-tree-tab='hermes-bots:pane'][aria-selected='true']")
const toggleJobs=()=>{
const tab=jobsTab()
if(tab && jobsOpen(tab)){tab.closest('[data-zone-tabstrip]').querySelector("button[aria-label='Minimize']")?.click();return}
if(tab){tab.click();return}
try{undismissPane?.(JOBS_PANE)}catch{}
try{revealPane?.(JOBS_PANE)}catch{}
}
const placeJobs=()=>{
if(!jobs)return
const tab=jobsTab()
const display=tab || botsView()?'':'none'
if(jobs.style.display !==display)jobs.style.display=display
setActive(jobs,jobsOpen(tab))
const rail=tab && !jobsOpen(tab)?tab.closest('[data-tree-group]')?.parentElement:null
for(const node of doc.querySelectorAll('[data-claude-plugin-rail]'))if(node !==rail)node.removeAttribute('data-claude-plugin-rail')
if(rail && !rail.hasAttribute('data-claude-plugin-rail'))rail.setAttribute('data-claude-plugin-rail','')
}
offs.push(()=> doc.querySelectorAll('[data-claude-plugin-rail]').forEach(node=> node.removeAttribute('data-claude-plugin-rail')))
const PLUGIN_PANES_OFF_KEY='claude-chat-look.plugin-panes.off'
let panesOff=new Set()
try{panesOff=new Set(JSON.parse(win.localStorage?.getItem(PLUGIN_PANES_OFF_KEY)|| '[]'))}catch{}
const saveOff=()=>{try{win.localStorage?.setItem(PLUGIN_PANES_OFF_KEY,JSON.stringify([...panesOff]))}catch{}}
const pluginButtons=new Map()
const isPluginPane=id=> id.includes(':')&& !/^[\w-]+-tile:/.test(id)
const zoneOf=id=> doc.querySelector('[data-tree-group="' + win.CSS.escape(id)+ '"]:not([data-pane-host])')
let treeText=null,treeGroups=[]
const layoutGroups=()=>{
let best=null,bestScore=-Infinity,text=''
for(const key of['hermes.desktop.layoutTree.v2','hermes.desktop.layoutTree.v2.simple']){
let raw=null
try{raw=win.localStorage?.getItem(key)}catch{}
text +=key +(raw || '')
if(!raw)continue
const found=[]
try{
const walk=node=>{if(node?.type==='group')found.push(node);else for(const child of node?.children ||[])walk(child)}
walk(JSON.parse(raw))
}catch{continue}
const score=found.reduce((sum,group)=> sum +(zoneOf(group.id)?1:-1),0)
if(score > bestScore){best=found;bestScore=score}
}
if(text !==treeText){treeText=text;treeGroups=best ||[]}
return treeGroups
}
const pluginPanes=()=>{
let decisions=null
try{decisions=pluginDecisions?.get?.()|| null}catch{}
const panes=[]
for(const group of layoutGroups()){
if(group.id==='grp-sessions' || !Array.isArray(group.panes))continue
for(const id of group.panes){
if(typeof id !=='string' || !isPluginPane(id)|| id===JOBS_PANE)continue
if(decisions && decisions[id.slice(0,id.indexOf(':'))]===false)continue
panes.push({id,group})
}
}
return panes
}
const paneTitle=(id,group)=>{
const tab=doc.querySelector("[role='tab'][data-tree-tab='" + win.CSS.escape(id)+ "']")
const fromTab=tab?.querySelector('.truncate')?.textContent.trim()|| tab?.textContent.trim()
if(fromTab)return fromTab
if(group.panes.length===1){
const named=/^Zone options for (.+)$/.exec(doc.querySelector('[data-zone-body="' + win.CSS.escape(group.id)+ '"]')?.getAttribute('aria-label')|| '')
if(named)return named[1]
}
const plugin=id.slice(0,id.indexOf(':'))
return plugin.charAt(0).toUpperCase()+ plugin.slice(1)
}
const PLUGIN_PANE_ICONS_KEY='claude-chat-look.plugin-pane-icons'
let paneIcons={}
try{paneIcons=JSON.parse(win.localStorage?.getItem(PLUGIN_PANE_ICONS_KEY)|| '{}')||{}}catch{}
const paneIcon=id=>{
const plugin=id.slice(0,id.indexOf(':'))
const row=doc.querySelector('[data-tour^="sidebar-nav-' + win.CSS.escape(plugin)+ ':"]')?.closest('button')
const name=[...(row?.querySelector('i.codicon')?.classList ||[])].find(name=> name.startsWith('codicon-')&& name !=='codicon-modifier-spin')
if(name && paneIcons[plugin]!==name.slice('codicon-'.length)){
paneIcons[plugin]=name.slice('codicon-'.length)
try{win.localStorage?.setItem(PLUGIN_PANE_ICONS_KEY,JSON.stringify(paneIcons))}catch{}
}
return paneIcons[plugin]|| 'layout-sidebar-right'
}
const hideable=group=> group.panes.every(pane=> typeof pane==='string' && isPluginPane(pane))
const pluginShown=(id,group)=>{
if(panesOff.has(id)|| group.minimized)return false
const atom=paneAtom(id)
if(atom)return Boolean(atom.get())
const zone=zoneOf(group.id)
return Boolean(zone && zone.getBoundingClientRect().width > 0)
}
const togglePlugin=id=>{
const entry=pluginPanes().find(pane=> pane.id===id)
if(!entry)return
if(pluginShown(id,entry.group)){
if(hideable(entry.group)){panesOff.add(id);saveOff()}
return
}
panesOff.delete(id)
saveOff()
doc.querySelector("[role='tab'][data-tree-tab='" + win.CSS.escape(id)+ "']")?.click()
try{undismissPane?.(id)}catch{}
try{revealPane?.(id)}catch{}
}
const placePluginPanes=()=>{
if(!group || !more)return
const panes=pluginPanes()
const ids=new Set(panes.map(pane=> pane.id))
for(const[id,element]of pluginButtons)if(!ids.has(id)){element.remove();pluginButtons.delete(id)}
const hidden=new Set()
for(const{id,group:zone}of panes){
if(panesOff.has(id)&& !hideable(zone)){panesOff.delete(id);saveOff()}
let element=pluginButtons.get(id)
const icon=paneIcon(id)
if(!element || element.dataset.claudePluginIcon !==icon){
const next=button(more,icon,'')
next.dataset.claudePaneTool='plugin'
next.dataset.claudePluginPane=id
next.dataset.claudePluginIcon=icon
next.addEventListener('click',()=>{togglePlugin(id);schedule()})
if(element)element.replaceWith(next)
element=next
pluginButtons.set(id,element)
}
const label=paneTitle(id,zone)
if(element.getAttribute('aria-label')!==label){element.setAttribute('aria-label',label);element.title=label}
setActive(element,pluginShown(id,zone))
if(zone.panes.every(pane=> isPluginPane(pane)&& panesOff.has(pane))){
const wrapper=zoneOf(zone.id)?.parentElement
if(wrapper && wrapper.matches('[data-tree-split] > div'))hidden.add(wrapper)
}
}
const order=[...ids]
let anchor=more
for(let at=order.length - 1;at >=0;at--){
const element=pluginButtons.get(order[at])
if(element.nextElementSibling !==anchor)group.insertBefore(element,anchor)
anchor=element
}
for(const node of doc.querySelectorAll('[data-claude-plugin-off]'))if(!hidden.has(node))node.removeAttribute('data-claude-plugin-off')
for(const node of hidden)if(!node.hasAttribute('data-claude-plugin-off'))node.setAttribute('data-claude-plugin-off','')
}
offs.push(()=> doc.querySelectorAll('[data-claude-plugin-off]').forEach(node=> node.removeAttribute('data-claude-plugin-off')))
const isShown=selector=>[...doc.querySelectorAll(selector)].some(node=>{
const rect=node.getBoundingClientRect()
if(!(rect.width > 0 && rect.height > 0))return false
return typeof node.checkVisibility==='function'?node.checkVisibility({visibilityProperty:true}):true
})
const run=action=>{
const result=runAction(action)
if(result && result.ok===false)console.warn('[claude-chat-look] ' + action + ' refused',result.error)
return !(result && result.ok===false)
}
const press=selector=>{
const native=doc.querySelector(selector)
if(!native)return false
native.click()
return true
}
const chord=keys=>{
if(!keys)return false
doc.dispatchEvent(new win.KeyboardEvent('keydown',{...keys,bubbles:true,cancelable:true}))
return true
}
const atoms=new Map()
const paneAtom=id=>{
if(!id || typeof paneVisibility !=='function')return null
if(!atoms.has(id)){
let atom=null
try{atom=paneVisibility(id)}catch{ /* Older hosts: DOM fallback. */}
atoms.set(id,typeof atom?.get==='function'?atom:null)
if(atom?.subscribe)try{const off=atom.subscribe(schedule);if(typeof off==='function')offs.push(off)}catch{}
}
return atoms.get(id)
}
const claimed=tool=>{
const atom=paneAtom(tool.pane)
return atom?Boolean(atom.get()):null
}
const isOpen=tool=> tool.side
?!(tool.id==='files' && filesHidden())&&(isShown(tool.shown)||
(tool.id==='files' && root.getAttribute('data-claude-files-view')==='file'))
:claimed(tool)!==false && isShown(tool.shown)
const sideTools=()=> tools.filter(tool=> tool.side)
const sideFolded=()=>{
try{
const simple=/simple/.test(win.localStorage?.getItem('hermes.desktop.interfaceMode.v1')|| '')
return(JSON.parse(win.localStorage?.getItem('hermes.desktop.collapsedTreeSides.v1' +(simple?'.simple':''))|| '[]')||[]).includes('right')
}catch{return false}
}
const terminalStore=()=>{
const container=doc.getElementById('root')
const key=container && Object.keys(container).find(name=> name.startsWith('__reactContainer$'))
const isStore=value=> value && typeof value.get==='function' && typeof value.listen==='function' && typeof value.set==='function'
const stack=key?[container[key]]:[]
while(stack.length){
const fiber=stack.pop()
if(typeof fiber.type==='function'){
const stores=[]
for(let hook=fiber.memoizedState;hook && stores.length < 3;hook=hook.next){
const memo=hook.memoizedState
if(Array.isArray(memo)&& memo.length===2 && typeof memo[0]==='function' && Array.isArray(memo[1])&& isStore(memo[1][0]))stores.push(memo[1][0])
}
if(stores.length===2 && stores[0].get()?.nodeType===1 && typeof stores[1].get()==='boolean')return stores[1]
}
if(fiber.sibling)stack.push(fiber.sibling)
if(fiber.child)stack.push(fiber.child)
}
return null
}
const resync=tool=>{
try{
if(tool.id==='terminal'){
const store=terminalStore()
if(store && store.get()===false)store.set(true)
}
}catch{ /* The plain close below still runs. */}
}
let reviewOffFlag=null
const setPane=(tool,on)=>{
if(tool.id==='files'){setFilesHidden(!on);return true}
if(isOpen(tool)===on)return true
if(!on)resync(tool)
if(!on && tool.id==='review'){
if(!hasWorkspace())return true
const done=run(tool.action)
win.setTimeout(()=>{
if(!disposed && isShown(tool.shown)){reviewOffFlag=claimed(tool);root.setAttribute('data-claude-review-off','');schedule()}
},300)
return done
}
if(on && tool.id==='review' && root.hasAttribute('data-claude-review-off')){
root.removeAttribute('data-claude-review-off')
if(isShown(tool.shown))return true
}
if(tool.action)return run(tool.action)
return press(tool.native)|| chord(tool.chord)
}
const toggle=tool=>{
const open=isOpen(tool)
if((tool.id==='review' || tool.id==='files')&& !open && !hasWorkspace())return false
if(!tool.side){
if(open && tool.closeAction)return run(tool.closeAction)
return run(tool.action)
}
if(open)return setPane(tool,false)
if(!sideFolded())return setPane(tool,true)
if(tool.id==='files')setFilesHidden(false)
const done=run(tool.id==='files'?tool.action:'view.toggleRightSidebar')
win.setTimeout(()=>{
if(disposed)return
for(const other of sideTools())setPane(other,other===tool)
},450)
return done
}
let lastSide=[]
const toggleSide=()=>{
const open=sideTools().filter(isOpen)
if(open.length){
lastSide=open.map(tool=> tool.id)
for(const tool of open)setPane(tool,false)
}else{
const wanted=lastSide.length?lastSide:['files']
for(const tool of sideTools().filter(tool=> wanted.includes(tool.id)))toggle(tool)
}
schedule()
}
const SIZES_KEY='claude-chat-look.pane-sizes'
const SIDE_MIN=320,CONVERSATION_MIN=320,RAIL_PANE_MIN=200,TERMINAL_MIN=120,RAIL_MIN=160
const SIDEBAR_MIN=234,SIDEBAR_MAX=400
const sizes={zones:{},sidebar:0,side:0,preview:0,rail:0,terminal:0,card:0,tree:0,narrowTree:false,wideTreeHidden:false}
try{Object.assign(sizes,JSON.parse(win.localStorage?.getItem(SIZES_KEY)|| '{}'))}catch{}
try{
const legacy=Number(win.localStorage?.getItem('claude-chat-look.side-width'))
if(!sizes.side && legacy > 0)sizes.side=legacy
}catch{}
const saveSizes=()=>{try{win.localStorage?.setItem(SIZES_KEY,JSON.stringify(sizes))}catch{}}
const shown=node=> Boolean(node)&& node.getAttribute('style')?.includes('display: none')!==true && node.checkVisibility?.()!==false
const groupWrap=id=> doc.querySelector(`[data-tree-group='${id}']:not([data-pane-host])`)?.parentElement || null
const sideColumn=()=>{
const group=['grp-terminal','grp-review','grp-files'].map(id=> doc.querySelector(`[data-tree-group='${id}']:not([data-pane-host])`)).find(Boolean)
let node=group?.parentElement
while(node?.parentElement){
const split=node.parentElement
if(split.matches('[data-tree-split]')&& split.querySelector(":scope > div > [data-tree-group='grp-main'], :scope > div > [data-tree-group='grp-sessions']"))return node
node=split.parentElement
}
return null
}
const sessionsColumn=()=>{
const wrap=groupWrap('grp-sessions')
if(!wrap?.parentElement?.matches('[data-tree-split]'))return null
const style=wrap.getAttribute('style')|| ''
return /display:\s*none|flex:\s*0 0/.test(style)?null:wrap
}
const sessionsLeft=wrap=>{
const main=groupWrap('grp-main')
return !main || Boolean(wrap.compareDocumentPosition(main)& win.Node.DOCUMENT_POSITION_FOLLOWING)
}
const sashBetween=(before,after,axis)=>{
if(!before || !after)return null
const edge=axis==='x'?after.getBoundingClientRect().left:after.getBoundingClientRect().top
return[...after.children,...before.children].find(node=>{
if(!node.matches("[role='separator']"))return false
const box=node.getBoundingClientRect()
return Math.abs((axis==='x'?box.left + box.width / 2:box.top + box.height / 2)- edge)< 12
})|| null
}
const layout=()=>{
const column=sideColumn()
const review=groupWrap('grp-review'),files=groupWrap('grp-files'),terminal=groupWrap('grp-terminal')
const rail=review?.parentElement?.parentElement || files?.parentElement?.parentElement || null
const railOpen=[review,files].some(wrap=> shown(wrap)&& wrap.getBoundingClientRect().width > 0)
const terminalOpen=shown(terminal)&& terminal.getBoundingClientRect().height > 0
const main=groupWrap('grp-main')
const holdsPreview=node=>[...node.querySelectorAll('[data-tree-group]:not([data-pane-host])')].some(group=>
doc.querySelector('[data-zone-tabstrip="' + win.CSS.escape(group.getAttribute('data-tree-group')|| '')+ '"] [role="tab"][data-tree-tab^="preview-tile:"]'))
const folded=node=> /flex:\s*0 0 1\.75rem/.test(node.getAttribute('style')|| '')
const preview=[...(main?.parentElement?.children ||[])].find(node=> node !==main && node !==column && node.tagName==='DIV' &&
!node.querySelector("[data-tree-group='grp-sessions']")&& holdsPreview(node)&& !folded(node)&&
((shown(node)&& node.getBoundingClientRect().width > 0)||(node.hasAttribute('data-claude-preview-column')&& root.getAttribute('data-claude-files-view')==='tree')))|| null
return{
column,review,files,terminal,rail,railOpen,terminalOpen,main,preview,
bothRail:shown(review)&& shown(files)&& review.getBoundingClientRect().width > 0 && files.getBoundingClientRect().width > 0
}
}
const clamp=(value,min,max)=> Math.round(Math.min(Math.max(value,min),Math.max(min,max)))
const columnMax=other=> win.innerWidth -(doc.querySelector("[data-tree-group='grp-sessions']")?.getBoundingClientRect().right || 0)-
CONVERSATION_MIN -(other && shown(other)?other.getBoundingClientRect().width:0)
const sideMax=()=> columnMax(root.hasAttribute('data-claude-file-joined')|| root.hasAttribute('data-claude-file-over')?null:layout().preview)
const previewMax=()=> columnMax(layout().column)
const FILES_SPLIT_MIN=400,CARD_DEFAULT=320,TREE_DEFAULT=240,TREE_MIN=160
let lastFileTab='',hadFileTabs=false
const cardWidth=()=> clamp(sizes.side || CARD_DEFAULT,SIDE_MIN,columnMax(null))
const treeWidth=()=> clamp(sizes.tree || TREE_DEFAULT,TREE_MIN,cardWidth()- TREE_MIN)
const setVar=(name,value)=>{if(root.style.getPropertyValue(name)!==value)value?root.style.setProperty(name,value):root.style.removeProperty(name)}
const applySizes=()=>{
const card=cardWidth(),tree=clamp(sizes.tree || TREE_DEFAULT,TREE_MIN,card - TREE_MIN)
const side=sizes.side?clamp(sizes.side,SIDE_MIN,sideMax()):0
const preview=sizes.preview?clamp(sizes.preview,SIDE_MIN,previewMax()):0
setVar('--claude-sidebar-width',sizes.sidebar?sizes.sidebar + 'px':'')
setVar('--claude-files-card',card + 'px')
setVar('--claude-files-tree',tree + 'px')
setVar('--claude-files-tree-wide',clamp(sizes.tree || TREE_DEFAULT,TREE_MIN,600)+ 'px')
setVar('--claude-side-width',side?side + 'px':'')
setVar('--claude-preview-width',preview?preview + 'px':'')
if(sizes.rail)setVar('--claude-rail-split',sizes.rail + '%')
else setVar('--claude-rail-split','')
if(sizes.terminal)setVar('--claude-terminal-height',sizes.terminal + 'px')
else setVar('--claude-terminal-height','')
}
applySizes()
offs.push(()=>['--claude-sidebar-width','--claude-side-width','--claude-preview-width','--claude-rail-split','--claude-terminal-height','--claude-files-card','--claude-files-tree','--claude-files-tree-wide'].forEach(name=> root.style.removeProperty(name)))
const onTreeToggle=()=>{
const view=root.getAttribute('data-claude-files-view')
if(!view || view==='empty' || view==='split')sizes.treeOff=!sizes.treeOff
else if(view==='both')sizes.wideTreeHidden=true
else if(view==='tree')sizes.narrowTree=false
else if(!root.hasAttribute('data-claude-file-over')&&(root.getAttribute('data-claude-expanded')==='files' || cardWidth()>=FILES_SPLIT_MIN))sizes.wideTreeHidden=false
else sizes.narrowTree=true
saveSizes()
schedule()
}
root.addEventListener('claude-tree-toggle',onTreeToggle)
offs.push(()=>{root.removeEventListener('claude-tree-toggle',onTreeToggle);root.removeAttribute('data-claude-files-view')})
const setFlag=(name,on)=>{if(on !==root.hasAttribute(name))on?root.setAttribute(name,''):root.removeAttribute(name)}
offs.push(()=>['data-claude-rail-open','data-claude-terminal-open','data-claude-rail-both','data-claude-file-joined','data-claude-file-over'].forEach(name=> root.removeAttribute(name)))
const ZONE_MIN=200
let zoneSashes=new Map()
const zoneColumns=state=>{
const main=state.main
if(!main?.parentElement)return[]
const after=[...main.parentElement.children].slice([...main.parentElement.children].indexOf(main)+ 1)
return after.filter(node=> node.tagName==='DIV' && node !==state.column && node !==state.preview && !node.matches("[role='separator']")&&
node.querySelector(':scope > [data-tree-group]:not([data-pane-host])')&& shown(node)&& node.getBoundingClientRect().width > 0 &&
!/flex:\s*0 0/.test(node.getAttribute('style')|| ''))
}
const zoneId=column=> column.querySelector(':scope > [data-tree-group]')?.getAttribute('data-tree-group')|| ''
const sizeZone=(column,width)=>{
const value=width?width + 'px':''
if(column.style.getPropertyValue('--claude-zone-width')!==value)value?column.style.setProperty('--claude-zone-width',value):column.style.removeProperty('--claude-zone-width')
if(column.hasAttribute('data-claude-zone-sized')!==Boolean(width))column.toggleAttribute('data-claude-zone-sized',Boolean(width))
}
const placeZoneSizes=state=>{
const columns=zoneColumns(state)
for(const column of columns)sizeZone(column,sizes.zones?.[zoneId(column)]|| 0)
for(const node of doc.querySelectorAll('[data-claude-zone-sized]'))if(!columns.includes(node))sizeZone(node,0)
}
offs.push(()=> doc.querySelectorAll('[data-claude-zone-sized]').forEach(node=> sizeZone(node,0)))
const roomFor=(width,state)=>{
const main=state.main
if(!main)return width
const floor=Math.max(CONVERSATION_MIN,parseFloat(win.getComputedStyle(main).minWidth)|| 0)
return width + Math.max(0,main.getBoundingClientRect().width - floor)
}
const markSashes=()=>{
applySizes()
const state=layout()
setFlag('data-claude-rail-open',state.railOpen)
setFlag('data-claude-terminal-open',state.terminalOpen)
setFlag('data-claude-rail-both',state.bothRail)
if(state.column)setAttr(state.column,'data-claude-side-column','')
for(const node of doc.querySelectorAll('[data-claude-side-column]'))if(node !==state.column)node.removeAttribute('data-claude-side-column')
const activeTab=state.preview?.querySelector("[data-tree-group]:not([data-pane-host]) [role='tab'][data-tree-tab][aria-selected='true']")
const visible=wrap=> shown(wrap)&& wrap.getBoundingClientRect().width > 0
const inlineShown=wrap=> Boolean(wrap)&& !/display:\s*none/.test(wrap.getAttribute('style')|| '')
const filesOn=!filesHidden()&& inlineShown(state.files)&& inlineShown(state.column)
const reviewOn=inlineShown(state.review)
const terminalOn=inlineShown(state.terminal)&& !/flex:\s*0 0 auto/.test(state.terminal?.getAttribute('style')|| '')
const fileTab=activeTab?.getAttribute('data-tree-tab')|| ''
const fileActive=Boolean(state.preview && fileTab.startsWith('preview-tile:file:')&& filesOn)
const joined=Boolean(fileActive && state.column && state.preview.nextElementSibling===state.column && !reviewOn && !terminalOn)
setFlag('data-claude-file-joined',joined)
const over=fileActive && !joined
setFlag('data-claude-file-over',over)
if(over){
const box=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host])")?.getBoundingClientRect()
if(box?.width)for(const[name,value]of[['x',box.left],['y',box.top],['w',box.width],['h',box.height]]){
const px=Math.round(value)+ 'px'
if(root.style.getPropertyValue('--claude-over-' + name)!==px)root.style.setProperty('--claude-over-' + name,px)
}
}
if(fileActive && fileTab !==lastFileTab)sizes.narrowTree=false
lastFileTab=fileActive?fileTab:''
const fileTabs=doc.querySelectorAll("[role='tab'][data-tree-tab^='preview-tile:file:']").length
const browserAside=[...doc.querySelectorAll('aside[data-preview-browser]')].find(node=> node.checkVisibility?.({visibilityProperty:true}))
if(fileTabs)hadFileTabs=true
else{
const blank=browserAside && /^about:blank$/.test(browserAside.querySelector("input[aria-label='Address']")?.value || '')
if(hadFileTabs && blank){
const tabId='preview-tile:' + browserAside.getAttribute('data-preview-browser')
win.setTimeout(()=>{
const close=[...doc.querySelectorAll("[role='tab'][data-tree-tab]")].find(tab=> tab.getAttribute('data-tree-tab')===tabId)?.querySelector("button[aria-label='Close']")
if(!close)return
root.setAttribute('data-claude-pass-close','')
try{close.click()}finally{root.removeAttribute('data-claude-pass-close')}
},0)
}
hadFileTabs=false
}
const wide=root.getAttribute('data-claude-expanded')==='files' || cardWidth()>=FILES_SPLIT_MIN
const filesCard=doc.querySelector("[data-tree-group='grp-files']:not([data-pane-host])")
const filesWide=root.getAttribute('data-claude-expanded')==='files' ||(filesCard?.getBoundingClientRect().width || 0)>=FILES_SPLIT_MIN
const view=over?(sizes.narrowTree?'tree':'file')
:!joined?(!filesOn?'':sizes.treeOff?'empty':filesWide?'split':'')
:wide?(sizes.wideTreeHidden?'file':'both'):(sizes.narrowTree?'tree':'file')
if((root.getAttribute('data-claude-files-view')|| '')!==view)view?root.setAttribute('data-claude-files-view',view):root.removeAttribute('data-claude-files-view')
if(state.preview)state.preview.setAttribute('data-claude-preview-column','')
for(const node of doc.querySelectorAll('[data-claude-preview-column]'))if(node !==state.preview)node.removeAttribute('data-claude-preview-column')
const roles=new Map()
const side=state.column && sashBetween(state.column.previousElementSibling,state.column,'x')
const previewSash=state.preview && sashBetween(state.preview.previousElementSibling,state.preview,'x')
if(joined){
const outer=view==='tree'?side:previewSash
if(outer)roles.set(outer,'card')
if(view==='both' && side)roles.set(side,'tree')
}else{
if(side)roles.set(side,'side')
if(previewSash && !over)roles.set(previewSash,'preview')
}
const sessions=sessionsColumn()
if(sessions){
const sidebarSash=sessionsLeft(sessions)?sashBetween(sessions,sessions.nextElementSibling,'x'):sashBetween(sessions.previousElementSibling,sessions,'x')
if(sidebarSash)roles.set(sidebarSash,'sidebar')
}
zoneSashes=new Map()
for(const column of zoneColumns(state)){
const sash=sashBetween(column.previousElementSibling,column,'x')
if(sash && !roles.has(sash)){roles.set(sash,'zone');zoneSashes.set(sash,column)}
}
placeZoneSizes(state)
const railSash=state.bothRail && sashBetween(state.review,state.files,'x')
if(railSash)roles.set(railSash,'rail')
const railWrap=state.rail?.parentElement
const terminalSash=state.railOpen && state.terminalOpen && sashBetween(railWrap,state.terminal,'y')
if(terminalSash)roles.set(terminalSash,'terminal')
for(const node of doc.querySelectorAll('[data-tree-split] [role="separator"]')){
const role=roles.get(node)|| ''
const box=node.getBoundingClientRect()
const grip=box.width || box.height?(box.height >=box.width?'x':'y'):''
if((node.getAttribute('data-claude-sash')|| '')!==role)role?node.setAttribute('data-claude-sash',role):node.removeAttribute('data-claude-sash')
if(grip && node.getAttribute('data-claude-grip')!==grip){node.setAttribute('data-claude-grip',grip);node.title='Drag to resize'}
}
}
offs.push(()=> doc.querySelectorAll('[data-claude-sash], [data-claude-grip], [data-claude-side-column], [data-claude-preview-column]').forEach(node=>{
node.removeAttribute('data-claude-sash');node.removeAttribute('data-claude-grip');node.removeAttribute('data-claude-side-column');node.removeAttribute('data-claude-preview-column')
if(node.title==='Drag to resize')node.removeAttribute('title')
}))
const onSashDown=event=>{
if(event.button !==0)return
const sash=event.target?.closest?.('[data-claude-sash]')
const role=sash?.getAttribute('data-claude-sash')
if(!role)return
const state=layout()
const target=role==='zone'?zoneSashes.get(sash):role==='sidebar'?sessionsColumn():role==='side' || role==='card' || role==='tree'?state.column:role==='preview'?state.preview:role==='rail'?state.rail:state.terminal?.parentElement
if(!target)return
event.preventDefault()
event.stopPropagation()
const box=target.getBoundingClientRect()
const overhead=wrap=>{
const card=wrap?.querySelector(':scope > [data-tree-group]:not([data-pane-host])')|| wrap?.querySelector('[data-tree-group]:not([data-pane-host])')
return wrap && card?Math.max(0,wrap.getBoundingClientRect().height - card.getBoundingClientRect().height):0
}
const above=[state.review,state.files].find(wrap=> shown(wrap)&& wrap.getBoundingClientRect().width > 0)
const railOverhead=above && state.rail?.parentElement
?Math.max(0,state.rail.parentElement.getBoundingClientRect().height - above.querySelector('[data-tree-group]:not([data-pane-host])').getBoundingClientRect().height)
:0
const terminalOverhead=overhead(state.terminal)
const railPaneMin=RAIL_PANE_MIN + 8
const startX=event.clientX
const startWidth=role==='card'?cardWidth():role==='tree'?treeWidth():box.width
const room=roomFor(role==='card'?cardWidth():box.width,state)
const limit=role==='side'?Math.min(sideMax(),room):role==='preview'?Math.min(previewMax(),room):0
root.setAttribute('data-claude-side-resizing',role==='terminal'?'y':'x')
const toward=role==='sidebar' && !sessionsLeft(target)?-1:1
const id=role==='zone'?zoneId(target):''
const move=moveEvent=>{
moveEvent.preventDefault()
if(role==='zone'){
const width=clamp(startWidth -(moveEvent.clientX - startX),Math.min(ZONE_MIN,startWidth),room)
sizes.zones={...sizes.zones,[id]:width}
sizeZone(target,width)
return
}
if(role==='sidebar'){
sizes.sidebar=clamp(startWidth + toward *(moveEvent.clientX - startX),SIDEBAR_MIN,Math.min(SIDEBAR_MAX,win.innerWidth - CONVERSATION_MIN))
}else if(role==='card'){
sizes.side=clamp(startWidth -(moveEvent.clientX - startX),SIDE_MIN,Math.min(columnMax(null),room))
schedule()
}else if(role==='tree'){
const toward=root.hasAttribute('data-claude-tree-left')?-1:1
sizes.tree=clamp(startWidth - toward *(moveEvent.clientX - startX),TREE_MIN,cardWidth()- TREE_MIN)
}else if(role==='side' || role==='preview'){
sizes[role]=clamp(startWidth -(moveEvent.clientX - startX),SIDE_MIN,limit)
schedule()
}else if(role==='rail'){
const min=Math.min(50,(railPaneMin / box.width)* 100)
sizes.rail=Math.round(Math.min(Math.max(((moveEvent.clientX - box.left)/ box.width)* 100,min),100 - min)* 10)/ 10
}else{
sizes.terminal=clamp(box.bottom - moveEvent.clientY,TERMINAL_MIN + terminalOverhead,box.height - RAIL_MIN - railOverhead)
}
applySizes()
schedule()
}
const up=()=>{
doc.removeEventListener('pointermove',move,true)
doc.removeEventListener('pointerup',up,true)
doc.removeEventListener('pointercancel',up,true)
root.removeAttribute('data-claude-side-resizing')
saveSizes()
}
doc.addEventListener('pointermove',move,true)
doc.addEventListener('pointerup',up,true)
doc.addEventListener('pointercancel',up,true)
}
doc.addEventListener('pointerdown',onSashDown,true)
offs.push(()=> doc.removeEventListener('pointerdown',onSashDown,true))
let held=[]
const releaseHeld=()=>{
doc.removeEventListener('pointerup',releaseHeld,true)
doc.removeEventListener('pointercancel',releaseHeld,true)
const nodes=held
held=[]
win.requestAnimationFrame(()=> win.requestAnimationFrame(()=> nodes.forEach(node=> node.removeAttribute('data-claude-drag-held'))))
}
const onHermesSashDown=event=>{
if(event.button !==0 || held.length)return
const sash=event.target?.closest?.("[data-tree-split] [role='separator']")
if(!sash || sash.hasAttribute('data-claude-sash'))return
held=[...doc.querySelectorAll('[data-tree-split] > div')].filter(node=> !node.matches("[role='separator']")&& node.getBoundingClientRect().width===0 && node.querySelector('[data-tree-group]'))
held.forEach(node=> node.setAttribute('data-claude-drag-held',''))
doc.addEventListener('pointerup',releaseHeld,true)
doc.addEventListener('pointercancel',releaseHeld,true)
}
doc.addEventListener('pointerdown',onHermesSashDown,true)
offs.push(()=>{
doc.removeEventListener('pointerdown',onHermesSashDown,true)
doc.removeEventListener('pointerup',releaseHeld,true)
doc.removeEventListener('pointercancel',releaseHeld,true)
held.forEach(node=> node.removeAttribute('data-claude-drag-held'))
doc.querySelectorAll('[data-claude-drag-held]').forEach(node=> node.removeAttribute('data-claude-drag-held'))
})
const onResize=()=>{applySizes();schedule()}
win.addEventListener('resize',onResize)
offs.push(()=> win.removeEventListener('resize',onResize))
const place=()=>{
frame=0
if(disposed)return
markSashes()
const cluster=doc.querySelector("[data-titlebar-cluster='right']")
if(!cluster)return
if(!group)build(cluster.querySelector('button:not([data-claude-pane-tool])'))
if(group.parentElement !==cluster || cluster.firstElementChild !==group)cluster.prepend(group)
for(const strip of doc.querySelectorAll('[data-zone-tabstrip]')){
const id=strip.getAttribute('data-zone-tabstrip')|| ''
const plugin=id !=='grp-main' && id !=='grp-sessions' &&[...strip.querySelectorAll("[role='tab'][data-tree-tab]")].some(tab=> isPluginPane(tab.getAttribute('data-tree-tab')|| ''))
if(strip.hasAttribute('data-claude-plugin-zone')!==plugin)strip.toggleAttribute('data-claude-plugin-zone',plugin)
}
placeJobs()
placePluginPanes()
if(root.hasAttribute('data-claude-review-off')){
const review=tools.find(tool=> tool.id==='review')
const flag=review?claimed(review):null
if(flag !==null && reviewOffFlag !==null && flag !==reviewOffFlag)root.removeAttribute('data-claude-review-off')
}
const noWorkspace=!hasWorkspace()
if(root.hasAttribute('data-claude-no-workspace')!==noWorkspace)root.toggleAttribute('data-claude-no-workspace',noWorkspace)
for(const tool of tools){
if(!tool.element)continue
const open=isOpen(tool)
setActive(tool.element,open)
const idle=(tool.id==='review' || tool.id==='files')&& !open && noWorkspace
if(tool.element.hasAttribute('data-claude-unavailable')!==idle){
tool.element.toggleAttribute('data-claude-unavailable',idle)
if(idle)tool.element.setAttribute('data-claude-tip-note','Available once this session has a folder (' +(/Mac/i.test(win.navigator?.platform || '')?'⌘O':'Ctrl+O')+ ' opens one)')
else tool.element.removeAttribute('data-claude-tip-note')
}
}
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const onPointer=event=>{if(menu && !menu.contains(event.target)&& !more?.contains(event.target))closeMenu()}
const onKey=event=>{
if(!menu)return
if(event.key==='Escape'){closeMenu();more?.focus();return}
if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
const rows=[...menu.querySelectorAll('[role=menuitem]')]
if(!rows.length)return
event.preventDefault()
const at=rows.indexOf(doc.activeElement)
const next=event.key==='Home'?0:event.key==='End'?rows.length - 1
:at < 0?(event.key==='ArrowDown'?0:rows.length - 1)
:(at +(event.key==='ArrowDown'?1:-1)+ rows.length)% rows.length
rows[next].focus()
}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [data-tree-group='grp-sessions'] *, [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden','data-pane-hidden']})
doc.addEventListener('pointerdown',onPointer,true)
doc.addEventListener('keydown',onKey,true)
place()
return()=>{
disposed=true
observer.disconnect()
if(frame)win.cancelAnimationFrame(frame)
for(const off of offs)try{off()}catch{}
doc.removeEventListener('pointerdown',onPointer,true)
doc.removeEventListener('keydown',onKey,true)
closeMenu()
group?.remove()
group=more=null
}
}
const CLAUDE_APPROVAL_TRIGGER="[data-slot='statusbar'] button[aria-haspopup='menu']:has(> svg[class*='tabler-icon-bolt'])"
const CLAUDE_COMPOSER_BOX="[data-slot='composer-root'] [data-slot='composer-fade'] > div:last-child > div:has([data-slot='composer-rich-input'])"
const CLAUDE_MODEL_PILL="[data-slot='composer-root'] button[data-tour='model-pill']"
const CLAUDE_DICTATION_ANCHOR="[data-slot='composer-root'] [data-slot='fan-menu-anchor']:has(button:is([aria-label='Voice dictation'], [aria-label='Stop dictation'], [aria-label='Transcribing dictation'], [aria-label='Dictée vocale']))"
function installClaudeApprovalDock({document:doc=globalThis.document,window:win=globalThis.window}={}){
let frame=0,disposed=false,docked=null
const release=()=>{
if(!docked)return
delete docked.dataset.claudeDocked
docked.style.removeProperty('--claude-dock-left')
docked.style.removeProperty('--claude-dock-top')
docked=null
}
const place=()=>{
frame=0
if(disposed)return
const trigger=doc.querySelector(CLAUDE_APPROVAL_TRIGGER)
const box=doc.querySelector(CLAUDE_COMPOSER_BOX)?.getBoundingClientRect()
const pill=doc.querySelector(CLAUDE_MODEL_PILL)?.getBoundingClientRect()
const rect=box && box.width > 0?{right:box.left + 2,top:pill && pill.height?pill.top:box.bottom + 4,height:pill && pill.height?pill.height:24}:null
const active=doc.documentElement.dataset.claudeChatLook==='true' && trigger && rect
if(docked && docked !==trigger)release()
if(!active)return release()
docked=trigger
if(!('claudeDocked' in trigger.dataset))trigger.dataset.claudeDocked=''
const left=Math.round(rect.right)+ 'px',top=Math.round(rect.top + rect.height / 2)+ 'px'
if(trigger.style.getPropertyValue('--claude-dock-left')!==left)trigger.style.setProperty('--claude-dock-left',left)
if(trigger.style.getPropertyValue('--claude-dock-top')!==top)trigger.style.setProperty('--claude-dock-top',top)
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
let anchors=[],lastLook=null,checkFrame=0
const anchorsNow=()=>[doc.querySelector(CLAUDE_APPROVAL_TRIGGER),doc.querySelector(CLAUDE_COMPOSER_BOX),doc.querySelector(CLAUDE_MODEL_PILL),doc.querySelector("[data-tree-group='grp-main']:not([data-pane-host])")]
const resize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(()=>{if(!disposed)place()}):null
const check=()=>{
checkFrame=0
if(disposed)return
const now=anchorsNow(),look=doc.documentElement.dataset.claudeChatLook==='true'
if(look===lastLook && now.length===anchors.length && now.every((node,i)=> node===anchors[i]))return
anchors=now
lastLook=look
resize?.disconnect()
for(const node of now)if(node)resize?.observe(node)
schedule()
}
const queueCheck=()=>{if(!checkFrame && !disposed)checkFrame=win.requestAnimationFrame(check)}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))queueCheck()})
observer.observe(doc.body,{childList:true,subtree:true})
const themeObserver=new win.MutationObserver(queueCheck)
themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-hermes-theme','data-claude-chat-look']})
const landingObserver=new win.MutationObserver(()=> schedule())
landingObserver.observe(doc.body,{subtree:true,attributes:true,attributeFilter:['data-claude-ascii-host']})
const onResize=()=> schedule()
win.addEventListener('resize',onResize)
const timer=win.setInterval(queueCheck,2000)
check()
return()=>{
disposed=true
observer.disconnect()
themeObserver.disconnect()
landingObserver.disconnect()
resize?.disconnect()
win.removeEventListener('resize',onResize)
win.clearInterval(timer)
if(frame)win.cancelAnimationFrame(frame)
if(checkFrame)win.cancelAnimationFrame(checkFrame)
release()
}
}
const CLAUDE_BACKEND_TRIGGER="[data-slot='statusbar'] button[aria-haspopup='menu']:is(:has(> svg[class*='tabler-icon-activity']), :has(> svg[class*='tabler-icon-alert-circle']), :has(> :first-child[aria-label^='restarting']), :has(> :first-child[role='status'] > .glyph-spinner))"
const CLAUDE_VERSION_ITEMS="[data-slot='statusbar'] button:is(:has(> svg[class*='tabler-icon-hash']), :has(> svg[class*='animate-spin']))"
function installClaudeBackendDock({host:api=typeof host==='undefined'?null:host,document:doc=globalThis.document,window:win=globalThis.window,skin=null}={}){
let frame=0,disposed=false,docked=null,pendingKey=''
const updateButtons=new Map()
const backendTrigger=()=>[...doc.querySelectorAll(CLAUDE_BACKEND_TRIGGER)].find(node=> !/^(?:GPU|RAM)\b/.test(node.textContent.trim()))|| null
const pendingUpdates=()=>[...doc.querySelectorAll(CLAUDE_VERSION_ITEMS)].filter(node=>
/^(?:(?:client|backend)\b|v\d|[0-9a-f]{7,40}\b)/i.test(node.textContent.trim())&&(node.classList.contains('text-primary')|| node.querySelector("[class*='animate-spin']")))
const targetOf=node=> /^backend\b/i.test(node.textContent.trim())?'backend':'client'
const updateIcon=target=>{
if(updateButtons.has(target))return updateButtons.get(target)
const button=doc.createElement('button')
button.type='button'
button.dataset.claudeUpdateDock=target
button.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10m-4-4 4 4-4 4"/></svg><span></span>'
button.addEventListener('click',event=>{
event.preventDefault()
pendingUpdates().find(node=> targetOf(node)===target)?.click()
})
doc.body.append(button)
updateButtons.set(target,button)
return button
}
const hideUpdates=(keep=[])=>{for(const[target,button]of updateButtons)if(!keep.includes(target)&& !button.hidden)button.hidden=true}
const release=()=>{
if(!docked)return
delete docked.dataset.claudeBackendDock
docked.removeAttribute('title')
docked.removeAttribute('aria-label')
docked.style.removeProperty('--claude-dock-left')
docked.style.removeProperty('--claude-dock-top')
docked=null
}
const place=()=>{
frame=0
if(disposed)return
const trigger=backendTrigger()
const rowNode=doc.querySelector('[data-claude-account-row]')
const row=rowNode?.getBoundingClientRect()
const active=doc.documentElement.dataset.claudeChatLook==='true' && row && row.width > 0
if(docked && docked !==trigger)release()
if(!active){hideUpdates();if(skin && !skin.hidden)skin.hidden=true;doc.documentElement.removeAttribute('data-claude-update-shown');return release()}
const list=doc.querySelector("[data-tree-group='grp-sessions']:not([data-pane-host])")?.getBoundingClientRect()
const edge=list && list.width > 0?list.right - 12:row.right + 34
if(trigger){
docked=trigger
if(!('claudeBackendDock' in trigger.dataset))trigger.dataset.claudeBackendDock=''
const label=[...trigger.childNodes].map(node=> node.textContent).join(' ').replace(/\s+/g,' ').trim()
if(label && trigger.title !==label)trigger.title=label
if(label && trigger.getAttribute('aria-label')!==label)trigger.setAttribute('aria-label',label)
const left=Math.round(Math.max(row.right + 6,edge - 22))+ 'px',top=Math.round(row.top + row.height / 2)+ 'px'
if(trigger.style.getPropertyValue('--claude-dock-left')!==left)trigger.style.setProperty('--claude-dock-left',left)
if(trigger.style.getPropertyValue('--claude-dock-top')!==top)trigger.style.setProperty('--claude-dock-top',top)
}else release()
const pending=pendingUpdates()
pendingKey=pending.map(node=> node.textContent.trim()).join(' · ')+(skin?.hasAttribute('data-claude-update-visible')?' · skin':'')
const rows=['client','backend'].map(target=>[target,pending.find(node=> targetOf(node)===target)]).filter(([,node])=> node)
const skinShown=Boolean(skin?.isConnected && skin.hasAttribute('data-claude-update-visible'))
const shown=rows.length +(skinShown?1:0),count=String(shown)
if((doc.documentElement.getAttribute('data-claude-update-shown')|| '0')!==count)shown?doc.documentElement.setAttribute('data-claude-update-shown',count):doc.documentElement.removeAttribute('data-claude-update-shown')
const remote=[...doc.querySelectorAll(CLAUDE_VERSION_ITEMS)].some(node=> /^(?:client|backend)\b/i.test(node.textContent.trim()))
hideUpdates(rows.map(([target])=> target))
rows.forEach(([target,node],index)=>{
const button=updateIcon(target)
const tip='Update available: ' + node.textContent.trim()
if(button.title !==tip){button.title=tip;button.setAttribute('aria-label',tip)}
const busy=Boolean(node.querySelector("[class*='animate-spin']"))
if(button.hasAttribute('data-busy')!==busy)button.toggleAttribute('data-busy',busy)
const text=!remote?(busy?'Updating Hermes…':'Update available')
:target==='backend'?(busy?'Updating backend…':'Backend update available')
:(busy?'Updating app…':'App update available')
if(button.lastChild.textContent !==text)button.lastChild.textContent=text
const updateLeft=Math.round(row.left)+ 'px',updateTop=Math.round(row.top - 26 - index * 28)+ 'px'
const updateWidth=Math.round(Math.max(row.width,edge - row.left))+ 'px'
if(button.style.left !==updateLeft)button.style.left=updateLeft
if(button.style.top !==updateTop)button.style.top=updateTop
if(button.style.width !==updateWidth)button.style.width=updateWidth
if(button.hidden)button.hidden=false
})
if(skinShown){
const skinLeft=Math.round(row.left)+ 'px',skinTop=Math.round(row.top - 26 - rows.length * 28)+ 'px'
const skinWidth=Math.round(Math.max(row.width,edge - row.left))+ 'px'
if(skin.style.left !==skinLeft)skin.style.left=skinLeft
if(skin.style.top !==skinTop)skin.style.top=skinTop
if(skin.style.width !==skinWidth)skin.style.width=skinWidth
if(skin.hidden)skin.hidden=false
}else if(skin && !skin.hidden)skin.hidden=true
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
let menuFrame=0
const stateLine=()=>{
menuFrame=0
if(disposed || !docked?.id)return
const menu=doc.querySelector("[role='menu'][aria-labelledby='" + docked.id + "']")
if(!menu)return
const label=[...docked.childNodes].map(node=> node.textContent).join(' ').replace(/\s+/g,' ').trim().replace(/^Backend\s*/i,'')
const column=[...menu.querySelectorAll('span')].find(node=> /^Inference /.test(node.textContent.trim()))?.parentElement
let line=menu.querySelector('[data-claude-backend-state]')
platforms(menu)
if(!label || /^ready$/i.test(label)|| !column){line?.remove();menuFrame=win.requestAnimationFrame(stateLine);return}
const text=label.charAt(0).toUpperCase()+ label.slice(1)
if(!line){
line=doc.createElement('span')
line.setAttribute('data-claude-backend-state','')
line.append(doc.createElement('span'),doc.createTextNode(''))
line.firstChild.setAttribute('aria-hidden','true')
}
if(line.parentElement !==column)column.append(line)
if(line.lastChild.textContent !==text)line.lastChild.textContent=text
const colour=win.getComputedStyle(docked).color
if(line.style.color !==colour)line.style.color=colour
menuFrame=win.requestAnimationFrame(stateLine)
}
const asked=new WeakSet()
const PLATFORM_TONE={connected:'bg-primary',fatal:'bg-destructive',startup_failed:'bg-destructive',error:'bg-destructive',disabled:'bg-muted-foreground',not_configured:'bg-muted-foreground'}
const pretty=text=>{const t=String(text || '').replace(/_/g,' ').trim();return t?t.charAt(0).toUpperCase()+ t.slice(1):''}
const isHermesSection=node=> !node.hasAttribute('data-claude-platforms')&& /^Messaging platforms$/i.test(node.firstElementChild?.textContent.trim()|| '')
const platforms=menu=>{
const ours=menu.querySelector('[data-claude-platforms]')
if([...menu.querySelectorAll('div')].some(isHermesSection)){ours?.remove();return}
if(ours || asked.has(menu)|| typeof api?.status !=='function')return
asked.add(menu)
Promise.resolve(api.status()).then(status=>{
if(disposed || !menu.isConnected ||[...menu.querySelectorAll('div')].some(isHermesSection)|| menu.querySelector('[data-claude-platforms]'))return
const entries=Object.entries(status?.gateway_platforms ||{}).sort(([a],[b])=> a.localeCompare(b))
const rows=entries.length
?entries.map(([key,platform])=>[key.split(':').pop(),pretty(platform?.state)|| 'Unknown',PLATFORM_TONE[platform?.state]|| 'bg-amber-500',platform?.error_message || ''])
:[['Messaging gateway',pretty(status?.gateway_state)||(status?.gateway_running===false?'Stopped':'Unknown'),status?.gateway_running?'bg-primary':'bg-amber-500',status?.gateway_exit_reason || '']]
const section=doc.createElement('div')
section.setAttribute('data-claude-platforms','')
section.className='border-t border-border/50 px-3 py-2'
const head=doc.createElement('div')
head.className='text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80'
head.textContent='Messaging platforms'
const list=doc.createElement('ul')
list.className='mt-1.5 space-y-1'
for(const[name,state,tone,reason]of rows){
const item=doc.createElement('li')
item.className='flex items-center justify-between gap-2 text-xs'
const label=doc.createElement('span')
label.className='truncate capitalize'
label.textContent=name
const value=doc.createElement('span')
value.className='flex items-center gap-1.5 text-[0.66rem] text-muted-foreground'
const dot=doc.createElement('span')
dot.setAttribute('aria-hidden','true')
dot.className='inline-block size-1.5 rounded-full ' + tone
value.append(dot,doc.createTextNode(state))
item.append(label,value)
list.append(item)
if(reason){
const why=doc.createElement('li')
why.className='text-[0.66rem] text-muted-foreground'
why.setAttribute('data-claude-platform-reason','')
why.textContent=reason
list.append(why)
}
}
section.append(head,list)
;(menu.firstElementChild || menu).append(section)
}).catch(()=>{asked.delete(menu)})
}
const onTrigger=event=>{if(docked && event.target?.closest?.('[data-claude-backend-dock]')&& !menuFrame)menuFrame=win.requestAnimationFrame(stateLine)}
let anchors=[],lastLook=null,checkFrame=0
const anchorsNow=()=>[backendTrigger(),doc.querySelector('[data-claude-account-row]'),doc.querySelector("[data-tree-group='grp-sessions']:not([data-pane-host])")]
const resize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(()=>{if(!disposed)place()}):null
const check=()=>{
checkFrame=0
if(disposed)return
watchBar()
const now=anchorsNow(),look=doc.documentElement.dataset.claudeChatLook==='true'
const key=pendingUpdates().map(node=> node.textContent.trim()).join(' · ')+(skin?.hasAttribute('data-claude-update-visible')?' · skin':'')
const relabelled=docked && docked===now[0]&&[...docked.childNodes].map(node=> node.textContent).join(' ').replace(/\s+/g,' ').trim()!==docked.title
if(!relabelled && key===pendingKey && look===lastLook && now.length===anchors.length && now.every((node,i)=> node===anchors[i]))return
anchors=now
lastLook=look
resize?.disconnect()
for(const node of now)if(node)resize?.observe(node)
schedule()
}
const queueCheck=()=>{if(!checkFrame && !disposed)checkFrame=win.requestAnimationFrame(check)}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))queueCheck()})
observer.observe(doc.body,{childList:true,subtree:true})
const themeObserver=new win.MutationObserver(queueCheck)
themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-claude-chat-look']})
if(skin)themeObserver.observe(skin,{attributes:true,attributeFilter:['data-claude-update-visible']})
const versionObserver=new win.MutationObserver(queueCheck)
let watchedBar=null
const watchBar=()=>{
const bar=doc.querySelector("[data-slot='statusbar']")
if(bar===watchedBar)return
versionObserver.disconnect()
watchedBar=bar
if(bar)versionObserver.observe(bar,{attributes:true,attributeFilter:['class'],characterData:true,subtree:true})
}
const onResize=()=> schedule()
win.addEventListener('resize',onResize)
const onSlide=event=>{if(event.target?.hasAttribute?.('data-claude-sidebar-shell'))schedule()}
doc.addEventListener('animationend',onSlide,true)
for(const type of['pointerdown','keydown'])doc.addEventListener(type,onTrigger,true)
const timer=win.setInterval(queueCheck,2000)
check()
return()=>{
disposed=true
observer.disconnect()
themeObserver.disconnect()
versionObserver.disconnect()
for(const type of['pointerdown','keydown'])doc.removeEventListener(type,onTrigger,true)
if(menuFrame)win.cancelAnimationFrame(menuFrame)
doc.querySelectorAll('[data-claude-backend-state], [data-claude-platforms]').forEach(node=> node.remove())
resize?.disconnect()
win.removeEventListener('resize',onResize)
doc.removeEventListener('animationend',onSlide,true)
win.clearInterval(timer)
if(frame)win.cancelAnimationFrame(frame)
if(checkFrame)win.cancelAnimationFrame(checkFrame)
release()
for(const button of updateButtons.values())button.remove()
updateButtons.clear()
if(skin)skin.hidden=true
doc.documentElement.removeAttribute('data-claude-update-shown')
}
}
const CLAUDE_ASCII_GLYPHS='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CLAUDE_ASCII_CELL={w:8,h:16,font:11}
const CLAUDE_ASCII_SCENES={
halloween:{
colors:{pumpkin:['#E8853D','#B4551B'],bat:['#A88BE0','#5B3FA6'],ghost:['#E6E3D8','#55524A'],moon:['#E9D9A6','#8A6D1E'],slime:['#86C46E','#3D7A2A'],bone:['#C9C5B8','#6B675C'],fog:['#968CBE','#5A468C']},
art:{
pumpkin:['     _/',"  .-'  '-.",' /  ^  ^  \\','|    /\\    |',' \\ \\/\\/\\/ /',"  '-.____.-'"],
pumpkinS:['   _/'," .'  '.",'( ^  ^ )'," ' vvv '"],
ghost:['  .--.',' ( o o)',' |  O |',' |    |'," '\\/\\/'"],
bat:['/\\^v^/\\'],
batS:['^v^'],
spider:['  //(oo)\\\\','  \\\\ ^^ //'],
moon:['    _..',"  .' .'",' /  /','|  |',' \\  \\',"  '._'._","      ''"],
grave:['  .---.',' / RIP \\',' |     |',' |     |','_|_____|_'],
cat:[' /\\_/\\','( o.o )',' > ^ <','  | |~']
},
cast:[
['moon',1330,70,'moon',0.68,'bob',14,0],
['pumpkin',140,840,'pumpkin',0.75,'bob',7,0],
['pumpkinS',1380,880,'pumpkin',0.68,'bob',6,-3],
['pumpkinS',610,900,'pumpkin',0.51,'bob',8,-5],
['grave',980,860,'bone',0.51,'bob',20,0],
['cat',380,870,'bone',0.54,'bob',9,-2],
['ghost',0,300,'ghost',0.51,'left',70,0],
['ghost',0,560,'ghost',0.34,'right',95,-40],
['ghost',820,0,'ghost',0.31,'up',80,-30],
['bat',0,140,'bat',0.71,'right',26,0],
['bat',60,190,'bat',0.51,'right',26,-1],
['batS',0,240,'bat',0.59,'left',30,-9],
['bat',0,420,'bat',0.42,'left',38,-20],
['batS',0,90,'bat',0.51,'right',22,-14],
['spider',1100,0,'slime',0.59,'hang',18,0],
['spider',260,0,'slime',0.42,'hang',23,-9]
],
fall:{count:26,glyphs:[',',"'",'*','.'],colors:['pumpkin','slime'],secs:[14,26],opacity:[0.3,0.5],drift:60},
twinkle:{count:34,glyphs:['.','*','+'],colors:['moon','bat'],opacity:[0.3,0.6],top:0.6}
},
christmas:{
colors:{pine:['#57AB5A','#2D6A30'],red:['#E5534B','#B3261E'],gold:['#E3B341','#8F6400'],snow:['#E6EDF3','#57606A']},
art:{
tree:['      *','     /o\\','    /~~*\\','   /o ~~ \\','  /~~*~~o~\\',' /o~~ *~~~*\\','/~~*~~o~~ ~~\\','     |_|'],
treeS:['    *','   /o\\','  /~*~\\',' /o~~~o\\','   |_|'],
gift:[' __\\/__','|__||__|','|  ||  |','|__||__|'],
snowman:['   _===_','   (. .)','  >( : )<','  (  :  )',"   '---'"],
sleigh:['  _/_/              __',' (o  )\\____===-----/__\\____','  || ||            \\_______/'],
star:['  .','-=*=-',"  '"],
cane:[' .--.','/ .. \\','|/  ||','    ||','    ||'],
bell:['  _',' ( )','/   \\','\\_o_/']
},
cast:[
['tree',120,760,'pine',0.75,'bob',30,0],
['treeS',1400,820,'pine',0.65,'bob',26,-6],
['gift',330,900,'red',0.68,'bob',9,0],
['gift',1290,920,'gold',0.59,'bob',11,-4],
['snowman',860,840,'snow',0.65,'bob',8,-2],
['cane',1180,880,'red',0.59,'bob',12,-5],
['bell',560,120,'gold',0.51,'bob',6,-1],
['star',1420,80,'gold',0.75,'bob',10,0],
['sleigh',0,230,'red',0.59,'right',48,-10],
['star',900,40,'gold',0.68,'fly',9,-4]
],
fall:{count:70,glyphs:['*','.','+','o','*'],colors:['snow'],secs:[12,24],opacity:[0.3,0.6],drift:50},
twinkle:{count:26,glyphs:['.','*','+'],colors:['gold','snow'],opacity:[0.3,0.6],top:0.5}
},
spring:{
colors:{blossom:['#F2A7C3','#B5476F'],leaf:['#7CC46A','#3B7D2C'],sun:['#F2D06B','#9A7400'],butterfly:['#C9A0F0','#6B42A8'],sky:['#B8D8F0','#4A7FA8']},
art:{
tree:['     .@*@.  .@@.','  .@@*@@@@*@@*@@.',' @*@@@*@@ @@@*@@@',"  '@@*@@\\ /@*@@'",'        \\|/','         |','         |'],
tulips:['(v) (v)   (v)',' |/  \\|   |/','\\|   |/  \\|'],
tulipsS:['(v)  (v)',' |/  \\|'],
butterfly:['(\\ /)',' )8(','(/ \\)'],
bird:['\\v/'],
birdS:['v'],
bee:['=8>'],
sun:['  \\ | /','-- (O) --','  / | \\'],
cloud:['   .--.',' .(    ).','(___.____)']
},
cast:[
['sun',1350,60,'sun',0.7,'bob',12,0],
['tree',90,700,'blossom',0.72,'bob',24,0],
['tulips',620,880,'blossom',0.62,'bob',7,-2],
['tulipsS',1250,900,'butterfly',0.55,'bob',8,-5],
['cloud',0,110,'sky',0.45,'right',90,-30],
['butterfly',0,420,'butterfly',0.6,'right',34,0],
['butterfly',0,600,'blossom',0.5,'left',42,-17],
['bird',0,180,'sky',0.6,'left',28,-6],
['birdS',80,210,'sky',0.5,'left',28,-7],
['bee',0,760,'sun',0.65,'right',20,-11]
],
fall:{count:30,glyphs:['*','.',"'",','],colors:['blossom'],secs:[16,30],opacity:[0.3,0.55],drift:160},
twinkle:{count:16,glyphs:['.','+'],colors:['sun','leaf'],opacity:[0.25,0.5],top:0.7}
},
summer:{
colors:{sun:['#F5C451','#A86F00'],sea:['#5AB0D8','#1F6E99'],foam:['#DDEFF7','#4A6B7A'],sand:['#E3C88A','#8C6B2B'],palm:['#5FB65A','#2E7A2A'],red:['#E86A5B','#B3261E'],gull:['#D9D9D4','#5A5A55']},
art:{
sun:['   \\  |  /',' .  .---.  .','-- (     ) --'," '  '---'  '",'   /  |  \\'],
palm:[' _\\_\\|/_/_','/  \\\\|//  \\','     ||','      ||','      ||','     /||\\'],
umbrella:['    ___'," .-'   '-.",'/_._._._._\\','     |','     |'],
boat:['     |\\','     | \\','     |__\\','\\_________/'],
gull:['~v~'],
gullS:['v'],
crab:['\\/(o.o)\\/'],
icecream:['  .-.',' (   )','  \\ /','   V']
},
cast:[
['sun',90,40,'sun',0.75,'bob',12,0],
['boat',0,520,'red',0.6,'right',80,-20],
['palm',1320,760,'palm',0.7,'bob',20,0],
['umbrella',420,860,'red',0.65,'bob',16,-3],
['icecream',1030,900,'foam',0.55,'bob',7,-2],
['crab',0,940,'red',0.6,'left',60,-25],
['gull',0,170,'gull',0.6,'left',30,0],
['gullS',60,210,'gull',0.5,'left',30,-1],
['gull',0,300,'gull',0.45,'right',40,-18]
],
fall:{count:0,glyphs:['.'],colors:['foam'],secs:[10,20],opacity:[0.3,0.5],drift:0},
twinkle:{count:10,glyphs:['.','+'],colors:['sun'],opacity:[0.2,0.45],top:0.45}
},
autumn:{
colors:{orange:['#E8893A','#B4551B'],red:['#D9534F','#A3261E'],gold:['#E3B341','#8F6400'],brown:['#A07850','#6B4A2B'],crow:['#9A9AA8','#3E3E48'],wind:['#8FA8C0','#45607A']},
art:{
tree:['     .%&%%.  .&%.','  .%&%%&%%%&%&%%.',' %&%%%&%% %&%%&%%%',"  '%%&%%\\ /%&%%'",'        \\|/','         |','         |'],
mushroom:['  .-^-.',' /_/_\\_\\','   | |'],
mushroomS:[' .-.','(___)','  |'],
hedgehog:['   ,;;;;;,',' ,;;;;;;;;;o>',"  '-'   '-'"],
acorn:[' .-.','(___)',' \\_/'],
geese:['    v','  v','v','  v','    v'],
crow:['\\(v)/'],
cloud:['   .--.',' .(    ).','(___.____)'," ' ' ' '"]
},
cast:[
['tree',1180,690,'orange',0.72,'bob',26,0],
['mushroom',250,890,'red',0.65,'bob',9,-2],
['mushroomS',380,915,'gold',0.55,'bob',7,-4],
['acorn',900,920,'brown',0.6,'bob',8,-1],
['hedgehog',0,905,'brown',0.6,'right',70,-12],
['geese',0,120,'crow',0.6,'left',45,0],
['crow',0,300,'crow',0.5,'right',33,-9],
['cloud',0,50,'wind',0.45,'left',100,-50]
],
fall:{count:45,glyphs:['*','&','%','@',','],colors:['orange','red','gold','brown'],secs:[10,22],opacity:[0.35,0.6],drift:220},
twinkle:{count:0,glyphs:['.'],colors:['gold'],opacity:[0.2,0.4],top:0.5}
},
winter:{
colors:{snow:['#E6EDF3','#57606A'],ice:['#8FC6E8','#2F6F9E'],pine:['#4E8F6A','#245C3D'],wood:['#A07850','#6B4A2B'],moon:['#D8DEE9','#5A6372'],fox:['#E07B3A','#A84F14']},
art:{
pine:['     ^','    /*\\','   /*^*\\','  /^*^*^\\',' /*^*^*^*\\','/^*^*^*^*^\\','    |_|'],
pineS:['    ^','   /*\\','  /^*^\\',' /*^*^*\\','   |_|'],
cabin:['         ) )','        ( (','     ___|_|______','    /           /\\','   /___________/  \\','   | []    []  |  |','   |     __    |  |','   |____|__|___|__|'],
fox:['  /\\_/\\',' ( o.o )___','  > ^ <    \\~'],
moon:['   .--.',"  /  .-'",' |  (',"  \\  '-.","   '--'"],
flake:['\\ | /','-- * --','/ | \\']
},
cast:[
['moon',1240,90,'moon',0.65,'bob',16,0],
['pine',60,740,'pine',0.72,'bob',30,0],
['pineS',230,820,'pine',0.6,'bob',26,-7],
['cabin',1150,780,'wood',0.65,'bob',40,-3],
['fox',0,900,'fox',0.62,'right',55,-15],
['flake',760,0,'ice',0.45,'down',40,0],
['flake',300,0,'snow',0.35,'down',55,-25]
],
fall:{count:90,glyphs:['*','.','+','.'],colors:['snow','ice'],secs:[10,22],opacity:[0.3,0.6],drift:70},
twinkle:{count:24,glyphs:['.','*','+'],colors:['moon','ice'],opacity:[0.3,0.6],top:0.5}
},
newyear:{
colors:{gold:['#E3B341','#8F6400'],teal:['#4FD1C5','#1C7A72'],pink:['#F178B6','#A3266A'],red:['#E5534B','#B3261E'],silver:['#C9D1D9','#57606A'],city:['#6E7681','#8C959F']},
art:{
clock:['  .-----.',' /  12   \\','|9   |   3|',' \\   6   /',"  '-----'"],
bottle:['   _','  [_]','  | |',' /   \\','|     |','|  *  |','|_____|'],
glasses:['\\   /  \\   /',' \\ /    \\ /','  |  **  |',' _|_    _|_'],
hat:['  *',' /\\','/  \\','----'],
star:['  .','-=*=-',"  '"]
},
cast:[
['clock',700,40,'silver',0.6,'bob',12,0],
['bottle',160,780,'gold',0.7,'bob',9,-2],
['glasses',1280,840,'gold',0.65,'bob',7,-4],
['hat',470,870,'pink',0.6,'bob',8,-1],
['star',1400,60,'gold',0.7,'fly',10,-3]
],
fall:{count:50,glyphs:['*','.','+',',','o'],colors:['gold','teal','pink','red','silver'],secs:[12,24],opacity:[0.3,0.55],drift:90},
twinkle:{count:20,glyphs:['.','*','+'],colors:['silver','gold'],opacity:[0.25,0.5],top:0.5}
}
}
const claudeLandingRays=(count,inner,outer,start=0)=> Array.from({length:count},(_,i)=>{
const a=start + i * Math.PI * 2 / count
return `M${(50 + Math.sin(a)* inner).toFixed(1)} ${(50 - Math.cos(a)* inner).toFixed(1)}L${(50 + Math.sin(a)* outer).toFixed(1)} ${(50 - Math.cos(a)* outer).toFixed(1)}`
}).join('')
const claudeLandingPetals=()=> Array.from({length:5},(_,i)=>{
const a=i * Math.PI * 2 / 5,cx=50 + Math.sin(a)* 22,cy=50 - Math.cos(a)* 22
return `M${(cx + 12).toFixed(1)} ${cy.toFixed(1)}A12 12 0 1 0 ${(cx - 12).toFixed(1)} ${cy.toFixed(1)}A12 12 0 1 0 ${(cx + 12).toFixed(1)} ${cy.toFixed(1)}`
}).join('')
const claudeSnowflake=()=> claudeLandingRays(6,0,42)+ Array.from({length:6},(_,i)=>{
const a=i * Math.PI / 3,bx=50 + Math.sin(a)* 26,by=50 - Math.cos(a)* 26
return[-0.7,0.7].map(turn=> `M${bx.toFixed(1)} ${by.toFixed(1)}L${(bx + Math.sin(a + turn)* 12).toFixed(1)} ${(by - Math.cos(a + turn)* 12).toFixed(1)}`).join('')
}).join('')
const CLAUDE_LANDING_ICONS={
spark:{d:Array.from({length:12},(_,i)=> claudeLandingRays(1,0,i % 2?30:42,i * Math.PI / 6)).join(''),stroke:9},
water:{d:'M50 12C50 12 22 46 22 64A28 28 0 0 0 78 64C78 46 50 12 50 12ZM36 64A14 14 0 0 0 46 77',color:['#66A7E7','#1F5FAD'],stroke:7},
spring:{d:claudeLandingPetals()+ 'M57 50A7 7 0 1 0 43 50A7 7 0 1 0 57 50',color:['#F2A7C3','#B5476F'],stroke:6},
summer:{d:'M66 50A16 16 0 1 0 34 50A16 16 0 1 0 66 50' + claudeLandingRays(8,28,42),color:['#F5C451','#A86F00'],stroke:7},
autumn:{d:'M18 82C18 42 44 18 84 16C84 56 58 82 18 82ZM18 82L62 38',color:['#E8893A','#B4551B'],stroke:7},
winter:{d:claudeSnowflake(),color:['#8FC6E8','#2F6F9E'],stroke:6},
halloween:{d:'M50 30C24 30 14 46 14 60C14 76 30 86 50 86C70 86 86 76 86 60C86 46 76 30 50 30ZM50 30C40 46 40 72 50 86M50 30C60 46 60 72 50 86M50 30C50 22 54 15 61 13',color:['#E8853D','#B4551B'],stroke:6},
christmas:{d:'M50 12L30 40H42L24 64H40L20 86H80L60 64H76L58 40H70ZM50 86V94',color:['#57AB5A','#2D6A30'],stroke:6},
newyear:{d:claudeLandingRays(8,12,34)+ claudeLandingRays(8,44,44.5,Math.PI / 8),color:['#E3B341','#8F6400'],stroke:7}
}
function claudeAsciiHash(i,j,k){
let h=(Math.imul(i,374761393)+ Math.imul(j,668265263)+ Math.imul(k,2147483647))| 0
h=Math.imul(h ^(h >>> 13),1274126177)
return((h ^(h >>> 16))>>> 0)/ 4294967295
}
function claudeAsciiNoise(x,y,z){
const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z)
const fx=x - xi,fy=y - yi,fz=z - zi
const u=fx * fx *(3 - 2 * fx),v=fy * fy *(3 - 2 * fy),w=fz * fz *(3 - 2 * fz)
const h=claudeAsciiHash
const a0=h(xi,yi,zi),b0=h(xi + 1,yi,zi),c0=h(xi,yi + 1,zi),d0=h(xi + 1,yi + 1,zi)
const a1=h(xi,yi,zi + 1),b1=h(xi + 1,yi,zi + 1),c1=h(xi,yi + 1,zi + 1),d1=h(xi + 1,yi + 1,zi + 1)
const p0=(a0 +(b0 - a0)* u)+((c0 +(d0 - c0)* u)-(a0 +(b0 - a0)* u))* v
const p1=(a1 +(b1 - a1)* u)+((c1 +(d1 - c1)* u)-(a1 +(b1 - a1)* u))* v
return p0 +(p1 - p0)* w
}
function claudeAsciiWave(x,y,t){
const n=claudeAsciiNoise
const heading=t * 0.05
const ax=x * 0.0028 + Math.cos(heading)* t * 0.06,ay=y * 0.0028 + Math.sin(heading)* t * 0.06
const qx=n(ax,ay,t * 0.08)- 0.5,qy=n(ax + 31.7,ay - 12.3,t * 0.08)- 0.5
const bx=x * 0.0055 + qx * 3.2,by=y * 0.0055 + qy * 3.2
const rx=n(bx + 7.1,by + 2.9,t * 0.12)- 0.5,ry=n(bx - 4.4,by + 9.6,t * 0.12)- 0.5
const px=x * 0.0095 + rx * 2.4 + t * 0.035,py=y * 0.0095 + ry * 2.4 - t * 0.02
return 0.6 * n(px,py,t * 0.22)+ 0.4 * n(px * 2.3 + 5.2,py * 2.3 - 7.4,t * 0.38)
}
function installClaudeAsciiBackdrop({document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.body || !win)return()=>{}
let canvas=null,ctx=null,host=null,cols=0,rows=0,glyphs=null,prior=null,field=null,frame=0,last=0,disposed=false
let water=null,waterPrev=null,active_=false,nextDrop=0,stepped=0
let cast=null,castKey=''
const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)')
const pick=()=> CLAUDE_ASCII_GLYPHS.charCodeAt(Math.floor(Math.random()* CLAUDE_ASCII_GLYPHS.length))
const scene=()=>(Object.hasOwn(CLAUDE_ASCII_SCENES,doc.documentElement.dataset.claudeAsciiScene??'')?doc.documentElement.dataset.claudeAsciiScene:'water')
const zone=()=> doc.querySelector("[data-tree-group='grp-main']:has([data-slot='thread'])")
const isEmpty=group=> group && !group.querySelector("[data-slot*='message'], [data-slot='thread'] > [role='status']")
const on=()=> doc.documentElement.dataset.claudeChatLook==='true'
const drawing=()=> doc.documentElement.dataset.claudeAsciiGlyphs==='on' && doc.visibilityState !=='hidden'
let landing=null
const makeLanding=()=>{
const header=doc.createElement('header')
header.dataset.claudeLanding=''
const title=doc.createElement('h1')
title.textContent='What’s up next?'
header.append(title)
return header
}
const markLanding=()=>{
const key=doc.documentElement.dataset.claudeAsciiGlyphs==='on'?scene():'spark'
const dark=doc.documentElement.dataset.hermesMode !=='light'
const icon=CLAUDE_LANDING_ICONS[key]|| CLAUDE_LANDING_ICONS.spark
const stamp=key +(icon.color?(dark?':dark':':light'):'')
const current=landing.querySelector('[data-claude-landing-spark]')
if(current?.dataset.claudeLandingIcon===stamp)return
const ns='http://www.w3.org/2000/svg'
const svg=doc.createElementNS(ns,'svg')
svg.setAttribute('viewBox','0 0 100 100')
svg.setAttribute('aria-hidden','true')
svg.setAttribute('data-claude-landing-spark','')
svg.dataset.claudeLandingIcon=stamp
if(icon.color)svg.style.stroke=icon.color[dark?0:1]
svg.style.strokeWidth=String(icon.stroke)
const path=doc.createElementNS(ns,'path')
path.setAttribute('d',icon.d)
svg.append(path)
if(current)current.replaceWith(svg)
else landing.prepend(svg)
}
const stopCanvas=()=>{
if(frame)win.cancelAnimationFrame(frame)
frame=0
canvas?.remove()
canvas=ctx=null
}
const detach=()=>{
stopCanvas()
landing?.remove()
host?.removeAttribute('data-claude-ascii-host')
landing=host=null
}
const resize=()=>{
if(!canvas || !host)return
const rect=host.getBoundingClientRect()
const ratio=win.devicePixelRatio || 1
const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height))
if(canvas.width !==Math.round(w * ratio)|| canvas.height !==Math.round(h * ratio)){
canvas.width=Math.round(w * ratio)
canvas.height=Math.round(h * ratio)
ctx.setTransform(ratio,0,0,ratio,0,0)
}
const nextCols=Math.ceil(w / CLAUDE_ASCII_CELL.w),nextRows=Math.ceil(h / CLAUDE_ASCII_CELL.h)
if(nextCols !==cols || nextRows !==rows){
cols=nextCols;rows=nextRows
glyphs=new Uint8Array(cols * rows)
for(let i=0;i < glyphs.length;i++)glyphs[i]=pick()
prior=new Float32Array(cols * rows)
water=new Float32Array(cols * rows)
waterPrev=new Float32Array(cols * rows)
}
}
const drop=(px,py,strength)=>{
if(!water)return
const c0=Math.round(px / CLAUDE_ASCII_CELL.w),r0=Math.round(py / CLAUDE_ASCII_CELL.h)
for(let r=r0 - 2;r <=r0 + 2;r++)for(let c=c0 - 4;c <=c0 + 4;c++){
if(r < 1 || c < 1 || r >=rows - 1 || c >=cols - 1)continue
const d=Math.hypot((c - c0)* CLAUDE_ASCII_CELL.w,(r - r0)* CLAUDE_ASCII_CELL.h)/ 32
if(d < 1)water[r * cols + c]-=strength *(1 - d * d)
}
active_=true
}
const stepWater=()=>{
const cx=0.3,cy=0.3 *(CLAUDE_ASCII_CELL.w / CLAUDE_ASCII_CELL.h)** 2,damp=0.965
let energy=0
for(let r=1;r < rows - 1;r++){
for(let c=1;c < cols - 1;c++){
const i=r * cols + c,hNow=water[i]
const next=(2 * hNow - waterPrev[i]+ cx *(water[i - 1]+ water[i + 1]- 2 * hNow)+ cy *(water[i - cols]+ water[i + cols]- 2 * hNow))* damp
waterPrev[i]=next
energy +=next < 0?-next:next
}
}
const swap=water;water=waterPrev;waterPrev=swap
if(energy < 0.02 * cols)active_=false
}
const font=px=> px + 'px ui-monospace, SFMono-Regular, Consolas, monospace'
const draw=now=>{
frame=0
if(disposed || !canvas)return
const still=Boolean(reduced?.matches)
if(!still && now - last < 50){frame=win.requestAnimationFrame(draw);return}
last=now
resize()
const dark=doc.documentElement.dataset.hermesMode !=='light'
const t=now / 1000
ctx.clearRect(0,0,cols * CLAUDE_ASCII_CELL.w,rows * CLAUDE_ASCII_CELL.h)
ctx.font=font(CLAUDE_ASCII_CELL.font)
ctx.textBaseline='top'
const name=scene()
if(name==='water')drawWater(now,t,dark,still)
else{
const figures=layoutScene(name,t,dark,still)
const ground={halloween:drawFog,christmas:drawSnow,spring:drawMeadow,summer:drawSea,autumn:drawLeaves,winter:drawFrost,newyear:drawFireworks}[name]
ground(t,dark,still,figures.mask)
drawFigures(figures.cells)
}
if(!still)frame=win.requestAnimationFrame(draw)
}
const cell=(x,y,glyph,color,alpha)=>{
ctx.globalAlpha=alpha
ctx.fillStyle=color
ctx.fillText(glyph,x,y)
}
const drawFog=(t,dark,still,mask)=>{
const sc=CLAUDE_ASCII_SCENES.halloween,tone=c=> sc.colors[c][dark?0:1]
const cw=CLAUDE_ASCII_CELL.w,ch=CLAUDE_ASCII_CELL.h,w=cols * cw,h=rows * ch,time=still?0:t
const kx=w / 1600,ky=h / 1000,ramp='.,:;~='
const mx=1390 * kx,my=130 * ky,gx=205 * kx,gy=880 * ky,reach=210 * Math.min(kx,ky)+ 60
const flicker=0.7 + 0.3 * claudeAsciiNoise(time * 2.5,0.5,0.5)
const fog=tone('fog'),moon=tone('moon'),glow=tone('pumpkin')
const gc=Math.ceil(cols / 2)+ 1,gr=Math.ceil(rows / 2)+ 1
if(!field || field.length !==gc * gr * 3)field=new Float32Array(gc * gr * 3)
for(let r=0;r < gr;r++)for(let c=0;c < gc;c++){
const fx=c * 2 * cw,fy=r * 2 * ch
field[(r * gc + c)* 3]=claudeAsciiNoise(fx * 0.0035 - time * 0.05,fy * 0.011 + time * 0.01,time * 0.04)
}
for(let row=0;row < rows;row++){
const y=row * ch,r=row / 2,r0=Math.floor(r),v=r - r0
for(let col=0;col < cols;col++){
const i=row * cols + col
if(mask[i])continue
const x=col * cw,c=col / 2,c0=Math.floor(c),u=c - c0,k=(r0 * gc + c0)* 3
const n=(field[k]*(1 - u)+ field[k + 3]* u)*(1 - v)+(field[k + gc * 3]*(1 - u)+ field[k + gc * 3 + 3]* u)* v
const f=Math.max(0,Math.min(1,(n - 0.42)/ 0.3))** 1.5 *(0.3 + 0.7 * y / h)* 0.24
const m=Math.max(0,1 - Math.hypot((x - mx)/(0.5 * w),(y - my)/(0.6 * h)))** 2 * 0.12
const g=Math.max(0,1 - Math.hypot(x - gx,y - gy)/ reach)** 2 * flicker * 0.45
const level=f + m + g
if(level < 0.03)continue
cell(x,y,ramp[Math.min(ramp.length - 1,Math.floor(level / 0.45 * ramp.length))],g > f && g > m?glow:m > f?moon:fog,Math.min(0.55,0.04 + level))
}
}
ctx.globalAlpha=1
}
const drawSnow=(t,dark,still,mask)=>{
const sc=CLAUDE_ASCII_SCENES.christmas,tone=c=> sc.colors[c][dark?0:1]
const cw=CLAUDE_ASCII_CELL.w,ch=CLAUDE_ASCII_CELL.h,time=still?0:t
const snow=tone('snow'),pine=tone('pine'),bulbs=[tone('red'),tone('pine'),tone('gold')]
const hash=claudeAsciiHash
const top=col=> Math.round(rows *(0.85 + 0.035 * Math.sin(col * 0.045 + 1.3)+ 0.025 * Math.sin(col * 0.11))+(claudeAsciiNoise(col * 0.08,3.1,0.7)- 0.5)* 3)
const wire=col=>{const s=col / cols * 3,f=s - Math.floor(s);return Math.round(rows *(0.03 + 0.08 * 4 * f *(1 - f)))}
const chase=Math.floor(time * 2)
for(let col=0;col < cols;col++){
const x=col * cw,ground=top(col),line=wire(col),next=wire(col + 1)
for(let row=0;row < rows;row++){
const i=row * cols + col
if(mask[i])continue
const y=row * ch
if(row===line){
cell(x,y,next > line?'\\':next < line?'/':'_',pine,0.4)
}else if(row===line + 1 && col % 6===3){
const bulb=Math.floor(col / 6)
cell(x,y,'o',bulbs[bulb % 3],(bulb + chase)% 3?0.8:0.2)
}else if(row >=ground){
const depth=(row - ground)/ Math.max(1,rows - ground),hh=hash(col,row,11)
const glint=!still && hash(col,row,23)> 0.994 && Math.sin(time * 3 + hh * 40)> 0.6
const glyph=glint?'*':row===ground?(hh > 0.5?'.':'-'):hh > 0.7?'*':hh > 0.35?':':'.'
cell(x,y,glyph,snow,glint?0.7:0.14 + 0.18 *(1 - depth)+ 0.06 * hh)
}else{
const hh=hash(col,row,7)
if(hh < 0.986)continue
cell(x,y,hh > 0.996?'*':'.',snow,0.08 + 0.3 *(0.5 + 0.5 * Math.sin(time *(1 + hh * 3)+ hh * 50)))
}
}
}
ctx.globalAlpha=1
}
const drawMeadow=(t,dark,still,mask)=>{
const sc=CLAUDE_ASCII_SCENES.spring,tone=c=> sc.colors[c][dark?0:1]
const cw=CLAUDE_ASCII_CELL.w,ch=CLAUDE_ASCII_CELL.h,time=still?0:t,hash=claudeAsciiHash
const leaf=tone('leaf'),flowers=[tone('blossom'),tone('sun'),tone('butterfly')]
const top=col=> Math.round(rows *(0.84 + 0.03 * Math.sin(col * 0.05 + 0.4)+ 0.02 * Math.sin(col * 0.13))+(claudeAsciiNoise(col * 0.09,1.7,0.3)- 0.5)* 3)
for(let col=0;col < cols;col++){
const x=col * cw,ground=top(col)
const lean=claudeAsciiNoise(col * 0.04 - time * 0.35,0.5,time * 0.05)- 0.5
for(let row=Math.max(0,ground);row < rows;row++){
const i=row * cols + col
if(mask[i])continue
const y=row * ch,hh=hash(col,row,5),depth=(row - ground)/ Math.max(1,rows - ground)
if(row <=ground + 1 && hh > 0.95){cell(x,y,hh > 0.98?'@':'*',flowers[Math.floor(hh * 1000)% 3],0.55);continue}
const sway=lean *(1 - depth)* 2 +(hh - 0.5)* 0.3
const glyph=row===ground?(sway > 0.12?'/':sway < -0.12?'\\':hh > 0.5?"'":','):sway > 0.18?'/':sway < -0.18?'\\':hh > 0.6?'|':hh > 0.3?';':','
cell(x,y,glyph,leaf,0.16 + 0.22 *(1 - depth)+ 0.06 * hh)
}
}
ctx.globalAlpha=1
}
const drawSea=(t,dark,still,mask)=>{
const sc=CLAUDE_ASCII_SCENES.summer,tone=c=> sc.colors[c][dark?0:1]
const cw=CLAUDE_ASCII_CELL.w,ch=CLAUDE_ASCII_CELL.h,time=still?0:t,hash=claudeAsciiHash
const sea=tone('sea'),foam=tone('foam'),sand=tone('sand'),sun=tone('sun')
const horizon=Math.round(rows * 0.58),sunCol=Math.round(cols * 0.1)
for(let col=0;col < cols;col++){
const x=col * cw,edge=Math.round(rows *(0.84 + 0.015 * Math.sin(col * 0.06 + time * 0.6)+ 0.01 * Math.sin(col * 0.17)))
for(let row=horizon;row < rows;row++){
const i=row * cols + col
if(mask[i])continue
const y=row * ch,hh=hash(col,row,13)
if(row > edge)cell(x,y,hh > 0.8?':':'.',sand,0.12 + 0.12 * hh)
else if(row===edge)cell(x,y,hh > 0.5?'~':'-',foam,0.45)
else if(row===horizon)cell(x,y,'-',sea,0.3)
else{
const depth=(row - horizon)/ Math.max(1,edge - horizon)
if(Math.abs(col - sunCol)< 2 + depth * 9 && hash(col,row,29)> 0.55 &&(still || Math.sin(time * 4 + hash(col,row,31)* 30)> 0.2)){
cell(x,y,hh > 0.5?'*':'+',sun,0.55)
continue
}
const swell=Math.sin(col * 0.18 *(1.3 - depth)- row * 0.9 + time * 1.2)+(claudeAsciiNoise(col * 0.07,row * 0.3,time * 0.3)- 0.5)* 1.2
if(swell < -0.4)continue
cell(x,y,swell > 0.8?'~':swell > 0.2?'-':'.',sea,0.08 + 0.22 * depth +(swell > 0.8?0.08:0))
}
}
}
ctx.globalAlpha=1
}
const drawLeaves=(t,dark,still,mask)=>{
const sc=CLAUDE_ASCII_SCENES.autumn,tone=c=> sc.colors[c][dark?0:1]
const cw=CLAUDE_ASCII_CELL.w,ch=CLAUDE_ASCII_CELL.h,time=still?0:t,hash=claudeAsciiHash
const leaves=[tone('orange'),tone('red'),tone('gold'),tone('brown')],wind=tone('wind'),litter='%&*,.'
const top=col=> Math.round(rows *(0.87 + 0.03 * Math.sin(col * 0.04 + 2.1)+ 0.015 * Math.sin(col * 0.15))+(claudeAsciiNoise(col * 0.1,4.2,0.9)- 0.5)* 3)
for(let col=0;col < cols;col++){
const x=col * cw,ground=top(col)
for(let row=0;row < rows;row++){
const i=row * cols + col
if(mask[i])continue
const y=row * ch
if(row >=ground){
const hh=hash(col,row,17),depth=(row - ground)/ Math.max(1,rows - ground)
cell(x,y,litter[Math.floor(hh * litter.length)],leaves[Math.floor(hash(col,row,19)* 4)],0.12 + 0.16 *(1 - depth)+ 0.05 * hh)
}else{
const gust=claudeAsciiNoise(x * 0.004 - time * 0.5,y * 0.025,time * 0.08)
if(gust < 0.74)continue
cell(x,y,gust > 0.8?'~':'-',wind,(gust - 0.74)* 1.6)
}
}
}
ctx.globalAlpha=1
}
const drawFrost=(t,dark,still,mask)=>{
const sc=CLAUDE_ASCII_SCENES.winter,tone=c=> sc.colors[c][dark?0:1]
const cw=CLAUDE_ASCII_CELL.w,ch=CLAUDE_ASCII_CELL.h,time=still?0:t,hash=claudeAsciiHash
const snow=tone('snow'),ice=tone('ice')
const top=col=> Math.round(rows *(0.86 + 0.03 * Math.sin(col * 0.05 + 0.6)+ 0.02 * Math.sin(col * 0.12))+(claudeAsciiNoise(col * 0.08,5.3,0.2)- 0.5)* 3)
const icicle=col=>{const hh=hash(col,0,41);return hh > 0.86?1 + Math.floor((hh - 0.86)/ 0.14 * 3):0}
for(let col=0;col < cols;col++){
const x=col * cw,ground=top(col),length=icicle(col)
for(let row=0;row < rows;row++){
const i=row * cols + col
if(mask[i])continue
const y=row * ch
if(row < length){
cell(x,y,row===length - 1?'V':'|',ice,row===length - 1?0.35:0.22)
}else if(row >=ground){
const depth=(row - ground)/ Math.max(1,rows - ground),hh=hash(col,row,11)
const glint=!still && hash(col,row,23)> 0.994 && Math.sin(time * 3 + hh * 40)> 0.6
const glyph=glint?'*':row===ground?(hh > 0.5?'.':'-'):hh > 0.7?'*':hh > 0.35?':':'.'
cell(x,y,glyph,snow,glint?0.7:0.14 + 0.18 *(1 - depth)+ 0.06 * hh)
}else{
const reach=Math.hypot(Math.min(col,cols - 1 - col)/ cols * 1.6,Math.min(row,rows - 1 - row)/ rows)
if(reach > 0.13)continue
const n=claudeAsciiNoise(col * 0.35,row * 0.5,1.3),level=(0.13 - reach)/ 0.13 +(n - 0.5)* 0.8
if(level < 0.45)continue
cell(x,y,level > 0.9?'*':level > 0.7?'+':'.',ice,Math.min(0.35,0.05 + level * 0.22))
}
}
}
ctx.globalAlpha=1
}
const drawFireworks=(t,dark,still,mask)=>{
const sc=CLAUDE_ASCII_SCENES.newyear,tone=c=> sc.colors[c][dark?0:1]
const cw=CLAUDE_ASCII_CELL.w,ch=CLAUDE_ASCII_CELL.h,time=still?0:t,hash=claudeAsciiHash
const city=tone('city'),gold=tone('gold'),sparks=[tone('gold'),tone('teal'),tone('pink'),tone('red'),tone('silver')]
const roof=col=>{const block=Math.floor(col / 7);return Math.round(rows *(0.8 + 0.12 * hash(block,1,51)))}
for(let col=0;col < cols;col++){
const x=col * cw,top=roof(col)
for(let row=top;row < rows;row++){
const i=row * cols + col
if(mask[i])continue
const y=row * ch,edge=row===top || roof(col - 1)> row || roof(col + 1)> row
if(edge){cell(x,y,row===top?'_':'|',city,0.35);continue}
const lit=col % 2===0 && row % 2===0 && hash(col,row,53)> 0.55 &&(still || Math.sin(time * 0.3 + hash(col,row,57)* 60)> -0.3)
if(lit)cell(x,y,'.',gold,0.6)
}
}
const put=(col,row,glyph,color,alpha)=>{
col=Math.round(col);row=Math.round(row)
if(col < 0 || col >=cols || row < 0 || row >=rows || mask[row * cols + col])return
cell(col * cw,row * ch,glyph,color,alpha)
}
for(let k=0;k < 6;k++){
const secs=4 + 3 * hash(k,2,61),offset=hash(k,3,61)* secs,round=Math.floor((time + offset)/ secs)
const p=still?0.55:((time + offset)/ secs)% 1
const bx=cols *(0.1 + 0.8 * hash(k,round,63)),by=rows *(0.12 + 0.3 * hash(k,round,67))
const color=sparks[Math.floor(hash(k,round,71)* sparks.length)],base=rows * 0.82
if(p < 0.3){
const head=base -(base - by)* p / 0.3
for(let r=0;r < 4;r++)put(bx,head + r,r?'.':'|',color,0.6 - r * 0.13)
}else{
const q=(p - 0.3)/ 0.7,radius=3 + q *(6 + 5 * hash(k,round,73)),fade=(1 - q)** 1.4
const count=14
for(let a=0;a < count;a++){
const angle=a / count * Math.PI * 2
put(bx + Math.cos(angle)* radius * 2,by + Math.sin(angle)* radius + q * q * 4,q < 0.5?'*':q < 0.8?'+':'.',color,0.75 * fade)
if(q < 0.6)put(bx + Math.cos(angle)* radius,by + Math.sin(angle)* radius * 0.5 + q * q * 2,'.',color,0.4 * fade)
}
}
}
ctx.globalAlpha=1
}
const drawWater=(now,t,dark,still)=>{
const ink=dark?'200,198,190':'40,40,38'
const blue=dark?'102,167,231':'31,95,173'
const w=cols * CLAUDE_ASCII_CELL.w,h=rows * CLAUDE_ASCII_CELL.h
if(!still){
if(now > nextDrop){
if(nextDrop)drop(Math.random()* w,Math.random()* h,0.7)
nextDrop=now + 4000 + Math.random()* 5000
}
if(active_){
const steps=stepped?Math.min(3,Math.round((now - stepped)/ 33.3)):1
for(let k=0;k < steps && active_;k++)stepWater()
stepped +=steps * 33.3
if(!stepped || now - stepped > 100)stepped=now
}else stepped=0
}
const gc=Math.ceil(cols / 2)+ 1,gr=Math.ceil(rows / 2)+ 1
if(!field || field.length !==gc * gr * 3)field=new Float32Array(gc * gr * 3)
const ft=still?0:t * 0.15
for(let r=0;r < gr;r++)for(let c=0;c < gc;c++){
const fx=c * 2 * CLAUDE_ASCII_CELL.w,fy=r * 2 * CLAUDE_ASCII_CELL.h,k=(r * gc + c)* 3
field[k]=claudeAsciiWave(fx,fy,ft)
field[k + 1]=still?0:(claudeAsciiNoise(fx * 0.01,fy * 0.01,t * 0.1)- 0.5)* 1.8
field[k + 2]=still?0:(claudeAsciiNoise(fx * 0.01 + 50,fy * 0.01,t * 0.1)- 0.5)* 1.8
}
const sample=(col,row,o)=>{
const c=col / 2,r=row / 2,c0=Math.floor(c),r0=Math.floor(r),u=c - c0,v=r - r0
const k00=(r0 * gc + c0)* 3 + o,k10=k00 + 3,k01=k00 + gc * 3,k11=k01 + 3
return(field[k00]*(1 - u)+ field[k10]* u)*(1 - v)+(field[k01]*(1 - u)+ field[k11]* u)* v
}
for(let row=0;row < rows;row++){
const y=row * CLAUDE_ASCII_CELL.h
for(let col=0;col < cols;col++){
const x=col * CLAUDE_ASCII_CELL.w,i=row * cols + col
const wave=sample(col,row,0)
let alpha=(0.025 + 0.2 * Math.max(0,(wave - 0.5)/ 0.5)** 1.5)*(0.65 + 0.35 *((i * 2654435761 >>> 0)% 1000)/ 1000)
let ring=0,dx=0,dy=0
if(row > 0 && col > 0 && row < rows - 1 && col < cols - 1){
const height=water[i]
const gx=water[i + 1]- water[i - 1],gy=water[i + cols]- water[i - cols]
ring=Math.max(0,Math.min(1,Math.abs(height)* 0.8 +(Math.abs(gx)+ Math.abs(gy))* 0.3)- 0.06)
dx=gx * 2.2;dy=gy * 2.2
}
const flow=Math.abs(wave - prior[i])
prior[i]=wave
if(!still && Math.random()< 0.0006 + flow * 2 + ring * 0.06)glyphs[i]=pick()
dx +=sample(col,row,1)
dy +=sample(col,row,2)
if(alpha < 0.035 && ring < 0.02)continue
ctx.fillStyle=ring > 0.22?'rgba(' + blue + ',' + Math.min(0.9,alpha + 0.85 * ring).toFixed(3)+ ')':'rgba(' + ink + ',' + Math.min(0.6,alpha + 0.6 * ring).toFixed(3)+ ')'
ctx.fillText(String.fromCharCode(glyphs[i]),x + dx,y + dy)
}
}
}
const buildCast=name=>{
const sc=CLAUDE_ASCII_SCENES[name]
let seed=name.length * 7919
const rnd=()=>(seed=(Math.imul(seed,1103515245)+ 12345)>>> 0)/ 4294967296
const between=([a,b])=> a +(b - a)* rnd()
const choose=list=> list[Math.floor(rnd()* list.length)]
const actors=sc.cast.map(([art,x,y,color,opacity,motion,secs,start])=>({lines:sc.art[art],x,y,color,opacity,motion,secs,start}))
const fall=Array.from({length:sc.fall.count},()=>{
const secs=between(sc.fall.secs)
return{glyph:choose(sc.fall.glyphs),color:choose(sc.fall.colors),opacity:between(sc.fall.opacity),x:rnd()* 1600,drift:(rnd()- 0.5)* 2 * sc.fall.drift,secs,start:-rnd()* secs}
})
const twinkle=Array.from({length:sc.twinkle.count},()=>({glyph:choose(sc.twinkle.glyphs),color:choose(sc.twinkle.colors),opacity:between(sc.twinkle.opacity),x:rnd()* 1600,y:rnd()* 1000 * sc.twinkle.top,secs:3 + rnd()* 5,start:rnd()* 8}))
cast={actors,fall,twinkle}
castKey=name
}
const layoutScene=(name,t,dark,still)=>{
if(!cast || castKey !==name)buildCast(name)
const sc=CLAUDE_ASCII_SCENES[name],W=1600,H=1000,cw=CLAUDE_ASCII_CELL.w,ch=CLAUDE_ASCII_CELL.h
const kx=cols * cw / W,ky=rows * ch / H,time=still?0:t
const mask=new Uint8Array(cols * rows),cells=new Map()
const tone=color=> sc.colors[color][dark?0:1]
const put=(lines,x,y,color,opacity)=>{
const c0=Math.round(x * kx / cw),r0=Math.round(y * ky / ch)
lines.forEach((line,r)=>{
const row=r0 + r
if(row < 0 || row >=rows)return
for(let c=0;c < line.length;c++){
const col=c0 + c
if(col < 0 || col >=cols || line[c]===' ')continue
mask[row * cols + col]=1
cells.set(row * cols + col,{x:col * cw,y:row * ch,glyph:line[c],color:tone(color),opacity})
}
})
}
const phase=(start,secs)=>(((time - start)/ secs)% 1 + 1)% 1
for(const s of cast.twinkle)put([s.glyph],s.x,s.y,s.color,s.opacity *(0.35 + 0.65 *(0.5 + 0.5 * Math.cos((time + s.start)/ s.secs * Math.PI * 2))))
for(const s of cast.fall){
const p=phase(s.start,s.secs)
put([s.glyph],s.x + s.drift * p + Math.sin((time + s.start)* 0.8)* 6,-40 +(H + 70)* p,s.color,s.opacity)
}
for(const a of cast.actors){
const p=phase(a.start,a.secs)
const fw=Math.max(...a.lines.map(line=> line.length))* cw / kx,fh=a.lines.length * ch / ky
if(a.motion==='left' || a.motion==='right'){
const from=a.motion==='left'?W + 40:-fw - 40,to=a.motion==='left'?-fw - 40:W + 40
put(a.lines,a.x + from +(to - from)* p,a.y + Math.sin(p * Math.PI * 2 * Math.max(1,Math.round(a.secs / 8)))* 12,a.color,a.opacity)
}else if(a.motion==='up' || a.motion==='down'){
const from=a.motion==='up'?H + 40:-fh - 40,to=a.motion==='up'?-fh - 40:H + 40
put(a.lines,a.x + Math.sin(p * Math.PI * 2 * Math.max(1,Math.round(a.secs / 9)))* 18,from +(to - from)* p,a.color,a.opacity)
}else if(a.motion==='fly'){
put(a.lines,a.x - 900 * p,a.y + 520 * p,a.color,a.opacity *(p < 0.85?1:(1 - p)/ 0.15))
}else if(a.motion==='hang'){
const drop=(0.5 - 0.5 * Math.cos(p * Math.PI * 2))* 330
const mid=a.x + Math.floor(Math.max(...a.lines.map(line=> line.length))/ 2)* cw / kx
put(Array.from({length:Math.max(0,Math.round((a.y + drop)* ky / ch))},()=> '|'),mid,0,a.color,a.opacity * 0.4)
put(a.lines,a.x,a.y + drop,a.color,a.opacity)
}else{
const x=Math.min(W - fw,Math.max(0,a.x)),y=Math.min(H - fh - 8,Math.max(8,a.y))
put(a.lines,x,y + Math.sin(p * Math.PI * 2)* 7,a.color,a.opacity)
}
}
return{mask,cells}
}
const drawFigures=cells=>{
for(const cell of cells.values()){
ctx.globalAlpha=cell.opacity
ctx.fillStyle=cell.color
ctx.fillText(cell.glyph,cell.x,cell.y)
}
ctx.globalAlpha=1
}
const place=()=>{
if(disposed)return
const group=zone()
if(!on()|| !isEmpty(group))return detach()
if(host !==group){
detach()
host=group
host.setAttribute('data-claude-ascii-host','')
}
const dock=host.querySelector("[data-slot='composer-dock']:not([data-popped-out])")
if(!dock){
landing?.remove()
}else if(landing?.parentElement !==dock){
landing??=makeLanding()
dock.append(landing)
}
if(landing)markLanding()
if(!drawing())return stopCanvas()
if(!canvas){
canvas=doc.createElement('canvas')
canvas.dataset.claudeAsciiBackdrop=''
canvas.setAttribute('aria-hidden','true')
ctx=canvas.getContext('2d')
cols=rows=0
}
if(canvas.parentElement !==host)host.prepend(canvas)
if(!frame)frame=win.requestAnimationFrame(draw)
}
const onPointer=event=>{
if(!canvas || reduced?.matches || !host?.contains(event.target))return
if(event.target.closest?.("button, a, input, textarea, [contenteditable='true'], [role='menu'], [data-slot='composer-root']"))return
const rect=host.getBoundingClientRect()
drop(event.clientX - rect.left,event.clientY - rect.top,3)
if(!frame)frame=win.requestAnimationFrame(draw)
}
let pending=0
const schedule=()=>{if(!pending && !disposed)pending=win.setTimeout(()=>{pending=0;place()},120)}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true})
const themeObserver=new win.MutationObserver(schedule)
themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-hermes-theme','data-hermes-mode','data-claude-chat-look','data-claude-ascii-glyphs','data-claude-ascii-scene']})
doc.addEventListener('visibilitychange',schedule)
doc.addEventListener('pointerdown',onPointer,true)
win.addEventListener('resize',schedule)
win.addEventListener('focus',schedule)
place()
return()=>{
disposed=true
observer.disconnect()
themeObserver.disconnect()
if(pending)win.clearTimeout(pending)
doc.removeEventListener('visibilitychange',schedule)
doc.removeEventListener('pointerdown',onPointer,true)
win.removeEventListener('resize',schedule)
win.removeEventListener('focus',schedule)
detach()
}
}
const CLAUDE_SEARCH_TABS=[
{id:'all',label:'All'},
{id:'artifacts',label:'Artifacts',page:'nav.artifacts',note:'Artifacts live on Hermes’ Artifacts page.',button:'Open Artifacts'},
{id:'sessions',label:'Sessions'},
{id:'projects',label:'Projects'},
{id:'scheduled',label:'Scheduled',page:'nav.cron',note:'Scheduled jobs live on Hermes’ Scheduled jobs page.',button:'Open Scheduled jobs'}
]
function claudeAgeLabel(epoch,now=Date.now()){
const ms=!epoch?0:epoch > 1e12?epoch:epoch * 1000
if(!ms)return ''
const hours=(now - ms)/ 36e5
if(hours < 1)return 'Past hour'
if(hours < 24)return 'Today'
if(hours < 48)return 'Yesterday'
if(hours < 24 * 7)return 'Past week'
if(hours < 24 * 31)return 'Past month'
return 'Older'
}
const CLAUDE_SEARCH_SKIPPED_ACTIONS=/^(nav\.commandPalette|session\.(new|focusSearch)|session\.slot\..*|view\.tabSlot\..*|profile\.switch\..*|hud\..*|composer\.(send|newline|steer|queue|sendQueued|cancel|history|mention|slash|help)|view\.(terminalCopy|terminalPaste|findNext|findPrevious|selectionToComposer))$/
function installClaudeSearchDialog({host:api=host,runAction,listActions,settings=[],document:doc=globalThis.document,window:win=globalThis.window}={}){
const noop={open(){},dispose(){}}
if(!doc?.body || !win)return noop
let root=null,input=null,list=null,tabsEl=null,rowMenu=null,returnFocus=null
let tab='all',query='',selected=0,items=[],sessions=null,loading=false
let mirror=[],mirroring=false
const run=id=>{
if(typeof runAction !=='function')return
const result=runAction(id)
if(result && result.ok===false)console.warn('[claude-chat-look] ' + id + ' refused',result.error)
}
const glyph=name=>{
const i=doc.createElement('i')
i.className='codicon codicon-' + name
i.setAttribute('aria-hidden','true')
return i
}
const kbd=text=>{const k=doc.createElement('kbd');k.textContent=text;return k}
const load=async()=>{
if(loading)return
loading=true
try{
const profile=String(api?.state?.profile?.get?.()|| 'default')
let page=null
try{
page=await win.hermesDesktop?.api?.({path:'/api/profiles/sessions?limit=200&offset=0&min_messages=0&archived=exclude&order=recent&profile=' + encodeURIComponent(profile)+ '&exclude_sources=cron'})
}catch{}
if(!Array.isArray(page?.sessions))page=await api?.listPersistedSessions?.(null,{profile,limit:500})
sessions=(page?.sessions ||[]).filter(row=> row && !row.archived && !row.hidden && !row.is_internal_child && row.source !=='cron')
sessions.sort((a,b)=>(b.last_active || b.started_at || 0)-(a.last_active || a.started_at || 0))
}catch(error){
console.warn('[claude-chat-look] session list unavailable',error)
sessions=[]
}finally{
loading=false
if(root)render()
}
}
const projectOf=row=> row.git_repo_root || row.cwd || ''
const baseName=path=> String(path).replace(/[\\/]+$/,'').split(/[\\/]/).pop()|| path
const sessionItem=row=>({
kind:'session',
icon:projectOf(row)?'code':'comment',
title:row.title || row.preview || 'Untitled',
meta:claudeAgeLabel(row.last_active || row.started_at),
kindLabel:projectOf(row)?'Code session':'Session',
row,
run:()=>{close();Promise.resolve(api?.openSession?.(row.id)).catch(error=> console.warn('[claude-chat-look] openSession failed',error))}
})
const projects=()=>{
const byKey=new Map()
for(const row of sessions ||[]){
const key=projectOf(row)
if(!key)continue
const entry=byKey.get(key)||{key,rows:[]}
entry.rows.push(row)
byKey.set(key,entry)
}
return[...byKey.values()].map(entry=>({
kind:'project',
icon:'folder-library',
title:baseName(entry.key),
meta:entry.rows.length +(entry.rows.length===1?' session':' sessions')+ ' · ' + claudeAgeLabel(entry.rows[0].last_active || entry.rows[0].started_at),
kindLabel:'Project',
run:()=> sessionItem(entry.rows[0]).run()
}))
}
const newSession={kind:'action',icon:'add',title:'New session',meta:'',kindLabel:'Action',run:()=>{close();run('session.new')}}
const actions=()=>{
let allowed=[]
try{allowed=listActions?.()||[]}catch{}
const hermes=allowed.filter(action=> typeof action?.id==='string' && !CLAUDE_SEARCH_SKIPPED_ACTIONS.test(action.id))
.map(action=>({kind:'action',icon:'zap',title:action.label || action.id,meta:'',kindLabel:'Hermes action',keywords:action.id,run:()=>{close();run(action.id)}}))
const palette={kind:'action',icon:'terminal',title:'Hermes command palette',meta:'Ctrl P',kindLabel:'Action',keywords:'all commands plugins',run:()=>{close();run('nav.commandPalette')}}
const known=new Set(mirror.map(row=> row.label.toLowerCase()))
return[newSession,...hermes.filter(item=> !known.has(item.title.toLowerCase())),palette]
}
const MIRROR='data-claude-palette-mirror'
const paletteRoot=()=> doc.querySelector('[cmdk-root]')
const hidePalette=on=> on?doc.documentElement.setAttribute(MIRROR,''):doc.documentElement.removeAttribute(MIRROR)
const nextFrame=()=> new Promise(resolve=> win.requestAnimationFrame(()=> resolve()))
const waitFor=async(test,ms)=>{
const end=Date.now()+ ms
while(!test()&& Date.now()< end)await nextFrame()
return test()
}
const paletteRows=()=>[...(paletteRoot()?.querySelectorAll('[cmdk-item]')||[])]
const rowId=node=> String(node.dataset.value || '').split('\u0001')[1]|| ''
const readPalette=()=> paletteRows().map(node=>{
const words=[...node.querySelectorAll('span')].filter(span=> !span.children.length && span.textContent.trim()).map(span=> span.textContent.trim())
return{
id:rowId(node),
label:words[0]|| String(node.dataset.value || '').split('\u0001')[0],
detail:words[1]|| '',
keys:[...node.querySelectorAll('kbd')].map(key=> key.textContent.trim()).join(' '),
group:node.closest('[cmdk-group]')?.querySelector('[cmdk-group-heading]')?.textContent.trim()|| 'Commands'
}
}).filter(row=> row.id)
const closePalette=async()=>{
if(!paletteRoot())return
run('nav.commandPalette')
await waitFor(()=> !paletteRoot(),600)
}
const snapshot=async opened=>{
if(mirroring)return
mirroring=true
hidePalette(true)
try{
if(!opened && !paletteRoot())run('nav.commandPalette')
if(await waitFor(()=> paletteRows().length,800))mirror=readPalette()
await closePalette()
}finally{
hidePalette(false)
mirroring=false
if(root){render();input?.focus()}
}
}
const runPaletteRow=async row=>{
const again=query
let back=false
close()
hidePalette(true)
try{
run('nav.commandPalette')
const find=()=> paletteRows().find(node=> rowId(node)===row.id)
if(!(await waitFor(find,800)))return await closePalette()
find().click()
await nextFrame()
await nextFrame()
if(paletteRoot()&& find()){
await closePalette()
back=true
}
}finally{
hidePalette(false)
}
if(back)open(again)
}
const paletteItems=()=> mirror.filter(row=> row.id !=='nav-new' && !row.id.startsWith('plugin:claude-chat-look:'))
.map(row=>({kind:'palette',icon:'symbol-event',title:row.label,meta:row.detail || row.keys,state:Boolean(row.detail),kindLabel:row.group,group:row.group,keywords:row.group + ' ' + row.detail,run:()=> runPaletteRow(row)}))
const skin=()=> settings.map(setting=>({kind:'setting',icon:'settings-gear',title:setting.label,meta:setting.detail(),state:true,kindLabel:'Setting',keywords:setting.keywords.join(' '),run:()=>{setting.run();render()}}))
const matches=item=> !query ||(item.title + ' ' +(item.keywords || '')).toLowerCase().includes(query.toLowerCase())
const paletteGroups=()=>[...new Set(paletteItems().map(item=> item.group))].filter(group=> group !=='Projects')
const tabList=()=>[...CLAUDE_SEARCH_TABS,...paletteGroups().map(group=>({id:'palette:' + group,label:group,group})),{id:'actions',label:'Actions'},{id:'skin',label:'Claude Skin'}]
const sections=()=>{
const current=tabList().find(entry=> entry.id===tab)
if(current?.page)return[]
const palette=paletteItems().filter(matches)
if(current?.group)return[{heading:'',items:palette.filter(item=> item.group===current.group)}]
if(tab==='actions')return[{heading:'',items:actions().filter(matches)}]
if(tab==='skin')return[{heading:'',items:skin().filter(matches)}]
if(sessions===null &&(tab==='sessions' || tab==='projects'))return[{heading:'',items:[],loading:true}]
const hermesProjects=palette.filter(item=> item.group==='Projects')
if(tab==='sessions')return[{heading:'',items:sessions.map(sessionItem).filter(matches)}]
if(tab==='projects')return[{heading:'',items:[...hermesProjects,...projects().filter(matches)]}]
const groups=paletteGroups().map(group=>({heading:group,items:palette.filter(item=> item.group===group)}))
const recent=sessions===null?{heading:'Recents',items:[],loading:'Loading…'}:query?{heading:'Sessions',items:sessions.map(sessionItem).filter(matches).slice(0,20)}:{heading:'Recents',items:sessions.slice(0,8).map(sessionItem)}
return[
recent,
{heading:'Projects',items:[...hermesProjects,...projects().filter(matches).slice(0,8)]},
...groups,
{heading:'Actions',items:actions().filter(matches)},
{heading:'Claude Skin',items:skin().filter(matches)}
].filter(section=> section.loading || section.items.length)
}
const closeRowMenu=()=>{rowMenu?.remove();rowMenu=null}
const openRowMenu=(item,anchor)=>{
closeRowMenu()
rowMenu=doc.createElement('div')
rowMenu.setAttribute('role','menu')
rowMenu.dataset.claudeSearchRowMenu=''
const head=doc.createElement('div')
head.dataset.claudeSearchRowMenuHead=''
const title=doc.createElement('strong')
title.textContent=item.title
const sub=doc.createElement('span')
sub.textContent=[item.kindLabel,item.meta].filter(Boolean).join(' · ')
head.append(title,sub)
rowMenu.append(head)
const entries=[['Open',item.run]]
if(item.kind==='session'){
const pinned=Boolean(item.row.pinned)
entries.push([pinned?'Unpin':'Pin',()=>{
try{api?.sessions?.pin?.(item.row.id,!pinned)}catch(error){console.warn('[claude-chat-look] pin failed',error)}
item.row.pinned=!pinned
closeRowMenu()
render()
}])
}
entries.forEach(([label,act],index)=>{
const button=doc.createElement('button')
button.type='button'
button.setAttribute('role','menuitem')
button.dataset.claudeSearchRowMenuItem=String(index + 1)
const text=doc.createElement('span')
text.textContent=label
button.append(text,kbd(String(index + 1)))
button.addEventListener('click',()=> act())
rowMenu.append(button)
})
root.append(rowMenu)
const rect=anchor.getBoundingClientRect()
rowMenu.style.left=Math.round(rect.right + 8)+ 'px'
rowMenu.style.top=Math.round(rect.top - 6)+ 'px'
}
const renderTabs=()=>{
tabsEl.replaceChildren()
for(const entry of tabList()){
const button=doc.createElement('button')
button.type='button'
button.setAttribute('role','tab')
button.setAttribute('aria-selected',String(entry.id===tab))
button.textContent=entry.label
button.addEventListener('click',()=> setTab(entry.id))
tabsEl.append(button)
}
}
const render=()=>{
if(!root)return
renderTabs()
closeRowMenu()
list.replaceChildren()
const current=tabList().find(entry=> entry.id===tab)|| CLAUDE_SEARCH_TABS[0]
items=[]
if(current?.page){
const empty=doc.createElement('div')
empty.dataset.claudeSearchEmpty=''
const note=doc.createElement('p')
note.textContent=current.note
const go=doc.createElement('button')
go.type='button'
go.textContent=current.button
go.addEventListener('click',()=>{close();run(current.page)})
empty.append(note,go)
list.append(empty)
return
}
for(const section of sections()){
if(section.loading===true){
const wait=doc.createElement('div')
wait.dataset.claudeSearchEmpty=''
wait.textContent='Loading…'
list.append(wait)
continue
}
if(section.loading){
for(const text of[section.heading,section.loading]){
const line=doc.createElement('div')
line.dataset.claudeSearchHeading=''
line.textContent=text
list.append(line)
}
continue
}
if(section.heading){
const heading=doc.createElement('div')
heading.dataset.claudeSearchHeading=''
heading.textContent=section.heading
list.append(heading)
}
for(const item of section.items){
const index=items.push(item)- 1
const row=doc.createElement('div')
row.setAttribute('role','option')
row.dataset.claudeSearchRow=''
if(item.state)row.dataset.claudeSearchState=''
row.setAttribute('aria-selected',String(index===selected))
const title=doc.createElement('span')
title.dataset.claudeSearchTitle=''
title.textContent=item.title
const meta=doc.createElement('span')
meta.dataset.claudeSearchMeta=''
meta.textContent=item.meta
const more=doc.createElement('button')
more.type='button'
more.setAttribute('aria-label','Actions')
more.dataset.claudeSearchMore=''
more.append(glyph('ellipsis'))
more.addEventListener('click',event=>{event.stopPropagation();selected=index;openRowMenu(item,more)})
const enter=doc.createElement('span')
enter.dataset.claudeSearchEnter=''
enter.textContent='↵'
row.append(glyph(item.icon),title,meta,more,enter)
row.addEventListener('mousemove',()=>{if(selected !==index){selected=index;paintSelection()}})
row.addEventListener('click',()=> item.run())
list.append(row)
}
}
if(!items.length && sessions !==null){
const empty=doc.createElement('div')
empty.dataset.claudeSearchEmpty=''
const note=doc.createElement('p')
note.textContent='No results in ' + current.label
empty.append(note)
if(tab !=='all'){
const all=doc.createElement('button')
all.type='button'
all.textContent='Search all'
all.addEventListener('click',()=> setTab('all'))
empty.append(all)
}
list.append(empty)
}
}
const paintSelection=()=>{
list.querySelectorAll('[data-claude-search-row]').forEach((row,index)=> row.setAttribute('aria-selected',String(index===selected)))
list.querySelector("[data-claude-search-row][aria-selected='true']")?.scrollIntoView({block:'nearest'})
}
const setTab=id=>{
tab=id;selected=0;render();input?.focus()
tabsEl?.querySelector("[aria-selected='true']")?.scrollIntoView({block:'nearest',inline:'nearest'})
}
const onKey=event=>{
if(!root)return
if(rowMenu && /^[1-9]$/.test(event.key)){
rowMenu.querySelector('[data-claude-search-row-menu-item="' + event.key + '"]')?.click()
event.preventDefault()
return
}
if(event.key==='Escape'){event.preventDefault();event.stopPropagation();return rowMenu?closeRowMenu():close()}
if(event.key==='Tab'){
const stops=[...root.querySelectorAll('input, button')].filter(node=> node.getClientRects().length)
if(!stops.length)return
const at=stops.indexOf(doc.activeElement)
if(at===-1 ||(event.shiftKey?at===0:at===stops.length - 1)){
event.preventDefault()
stops[event.shiftKey?stops.length - 1:0].focus()
}
return
}
if(event.isComposing ||(event.target !==input && event.target.closest?.('button, a, input, textarea, select, [contenteditable]')))return
if(event.key==='ArrowDown' || event.key==='ArrowUp'){
event.preventDefault()
if(!items.length)return
selected=(selected +(event.key==='ArrowDown'?1:-1)+ items.length)% items.length
closeRowMenu()
paintSelection()
return
}
if((event.key==='ArrowLeft' || event.key==='ArrowRight')&& !query){
event.preventDefault()
const list=tabList(),at=list.findIndex(entry=> entry.id===tab)
setTab(list[(at +(event.key==='ArrowRight'?1:-1)+ list.length)% list.length].id)
return
}
if(event.key==='Enter'){
event.preventDefault()
const item=items[selected]
if(!item)return
if(event.altKey){
const anchor=list.querySelectorAll('[data-claude-search-more]')[selected]
if(anchor)openRowMenu(item,anchor)
}else item.run()
}
}
const close=()=>{
closeRowMenu()
const inside=root &&(root.contains(doc.activeElement)|| doc.activeElement===doc.body)
root?.remove()
root=input=list=tabsEl=null
doc.removeEventListener('keydown',onKey,true)
if(inside && returnFocus?.isConnected)returnFocus.focus?.({preventScroll:true})
returnFocus=null
}
const open=(initial='',paletteOpen=false)=>{
if(root)return input?.focus()
returnFocus=doc.activeElement && doc.activeElement !==doc.body?doc.activeElement:null
tab='all';query=typeof initial==='string'?initial:'';selected=0
root=doc.createElement('div')
root.dataset.claudeSearchDialog=''
root.addEventListener('pointerdown',event=>{
if(rowMenu && !rowMenu.contains(event.target)&& !event.target.closest?.('[data-claude-search-more]'))closeRowMenu()
if(event.target===root)close()
})
const panel=doc.createElement('div')
panel.setAttribute('role','dialog')
panel.setAttribute('aria-label','Search')
panel.setAttribute('aria-modal','true')
panel.dataset.claudeSearchPanel=''
const head=doc.createElement('div')
head.dataset.claudeSearchHead=''
input=doc.createElement('input')
input.type='text'
input.placeholder='Search'
input.setAttribute('aria-label','Search')
input.addEventListener('input',()=>{query=input.value.trim();selected=0;render()})
const x=doc.createElement('button')
x.type='button'
x.setAttribute('aria-label','Close')
x.dataset.claudeSearchClose=''
x.append(glyph('close'))
x.addEventListener('click',close)
head.append(input,x)
tabsEl=doc.createElement('div')
tabsEl.setAttribute('role','tablist')
tabsEl.dataset.claudeSearchTabs=''
list=doc.createElement('div')
list.setAttribute('role','listbox')
list.dataset.claudeSearchList=''
const foot=doc.createElement('div')
foot.dataset.claudeSearchFoot=''
for(const[label,...keys]of[['Close','Esc'],['Change type','←','→'],['Actions','Alt','↵']]){
const hint=doc.createElement('span')
hint.append(label,...keys.map(kbd))
foot.append(hint)
}
panel.append(head,tabsEl,list,foot)
root.append(panel)
doc.body.append(root)
doc.addEventListener('keydown',onKey,true)
input.value=query
render()
input.focus()
load()
snapshot(paletteOpen===true)
}
const customised=()=>{
try{
const binds=JSON.parse(win.localStorage?.getItem('hermes.desktop.keybinds')|| '{}')||{}
return Object.hasOwn(binds,'nav.commandPalette')|| Object.values(binds).some(combos=> Array.isArray(combos)&& combos.some(combo=> /^(mod|ctrl|meta|cmd)\+k$/i.test(String(combo))))
}catch{
return false
}
}
const onChord=event=>{
if(doc.documentElement.dataset.claudeChatLook !=='true' || !event.defaultPrevented)return
if(String(event.key).toLowerCase()!=='k' || event.altKey || event.shiftKey || event.isComposing)return
const mac=/Mac/i.test(win.navigator?.platform || '')
if(mac?!event.metaKey || event.ctrlKey:!event.ctrlKey || event.metaKey)return
if(doc.querySelector('[cmdk-root]')|| /settings/.test(win.location?.hash || '')|| customised())return
hidePalette(true)
open('',true)
}
win.addEventListener('keydown',onChord,true)
const dispose=()=>{
win.removeEventListener('keydown',onChord,true)
hidePalette(false)
close()
}
return{open,close,dispose}
}
const CLAUDE_NAV_STORAGE_KEY='claude-chat-look.sidebar.visible'
const CLAUDE_NAV_ALWAYS='sidebar-nav-new-session'
const CLAUDE_NAV_DEFAULT_VISIBLE=3
function installClaudeSidebarMore({document:doc=globalThis.document,window:win=globalThis.window,runAction,openSearch}={}){
if(!doc?.body || !win)return()=>{}
let frame=0,disposed=false,moreItem=null,menu=null,editor=null,menuByHover=false,hoverTimer=0,unhoverTimer=0
const readVisible=()=>{
try{
const raw=win.localStorage?.getItem(CLAUDE_NAV_STORAGE_KEY)
const list=raw?JSON.parse(raw):null
return Array.isArray(list)?new Set(list.filter(id=> typeof id==='string')):null
}catch{return null}
}
let visible=readVisible()
const writeVisible=()=>{
try{win.localStorage?.setItem(CLAUDE_NAV_STORAGE_KEY,JSON.stringify([...visible]))}catch{ /* Private window: session only. */}
}
const navList=()=> doc.querySelector("[data-tour='sessions-sidebar'] ul[data-sidebar='menu']:has([data-tour^='sidebar-nav-'])")
const entries=list=>[...list.children].map(li=>{
const label=li.querySelector("[data-tour^='sidebar-nav-']")
if(!label)return null
const button=li.querySelector("[data-sidebar='menu-button']")
const glyph=button?.querySelector('.codicon')
const icon=[...(glyph?.classList ||[])].find(name=> name.startsWith('codicon-'))|| ''
return{id:label.getAttribute('data-tour'),label:label.textContent.trim(),icon,li,button}
}).filter(Boolean)
const isShown=(entry,index)=> entry.id===CLAUDE_NAV_ALWAYS ||(visible?visible.has(entry.id):index <=CLAUDE_NAV_DEFAULT_VISIBLE)
const glyphOf=icon=>{
const glyph=doc.createElement('i')
glyph.className='codicon ' +(icon || 'codicon-circle-small')
glyph.setAttribute('aria-hidden','true')
return glyph
}
const giveBack=surface=>{
const at=doc.activeElement
const inside=surface &&(surface.contains(at)|| at===doc.body)
surface?.remove()
if(inside && moreItem?.isConnected)moreItem.querySelector('button')?.focus({preventScroll:true})
}
const closeMenu=()=>{
const was=menu
menu=null
win.clearTimeout(hoverTimer)
win.clearTimeout(unhoverTimer)
hoverTimer=unhoverTimer=0
if(menuByHover)was?.remove()
else giveBack(was)
menuByHover=false
moreItem?.querySelector('button')?.setAttribute('aria-expanded','false')
}
const closeEditor=()=>{const was=editor;editor=null;giveBack(was)}
const openEditor=()=>{
closeMenu()
closeEditor()
const list=navList()
if(!list)return
const all=entries(list)
if(!visible)visible=new Set(all.filter(isShown).map(entry=> entry.id))
editor=doc.createElement('div')
editor.dataset.claudeSidebarEditor=''
const panel=doc.createElement('div')
panel.setAttribute('role','dialog')
panel.setAttribute('aria-modal','true')
panel.setAttribute('aria-label','Edit sidebar')
panel.dataset.claudeSidebarEditorPanel=''
const head=doc.createElement('div')
head.dataset.claudeSidebarEditorHead=''
const title=doc.createElement('h2')
title.textContent='Edit sidebar'
const close=doc.createElement('button')
close.type='button'
close.setAttribute('aria-label','Close')
close.dataset.claudeSidebarEditorClose=''
close.append(glyphOf('codicon-close'))
close.addEventListener('click',closeEditor)
head.append(title,close)
const note=doc.createElement('p')
note.textContent='Choose which items appear in your sidebar.'
const rows=doc.createElement('div')
rows.dataset.claudeSidebarEditorRows=''
for(const entry of all){
const row=doc.createElement('label')
row.dataset.claudeSidebarEditorRow=''
const box=doc.createElement('input')
box.type='checkbox'
box.disabled=entry.id===CLAUDE_NAV_ALWAYS
box.checked=box.disabled || visible.has(entry.id)
box.addEventListener('change',()=>{
if(box.checked)visible.add(entry.id)
else visible.delete(entry.id)
writeVisible()
schedule()
})
const text=doc.createElement('span')
text.textContent=entry.label
row.append(box,glyphOf(entry.icon),text)
rows.append(row)
}
const foot=doc.createElement('div')
foot.dataset.claudeSidebarEditorFoot=''
const done=doc.createElement('button')
done.type='button'
done.textContent='Done'
done.dataset.claudeSidebarEditorDone=''
done.addEventListener('click',closeEditor)
foot.append(done)
panel.append(head,note,rows,foot)
editor.append(panel)
editor.addEventListener('pointerdown',event=>{if(event.target===editor)closeEditor()})
doc.body.append(editor)
done.focus()
}
const openMenu=how=>{
const hover=how==='hover'
if(menu){
if(hover)return
if(menuByHover){menuByHover=false;menu.querySelector('button')?.focus();return}
return closeMenu()
}
const list=navList()
if(!list || !moreItem)return
const all=entries(list)
menuByHover=hover
menu=doc.createElement('div')
menu.addEventListener('pointerenter',onHoverIn)
menu.addEventListener('pointerleave',onHoverOut)
menu.setAttribute('role','menu')
menu.dataset.claudeAccountMenu=''
menu.dataset.claudeMoreMenu=''
const add=(label,icon,run)=>{
const item=doc.createElement('button')
item.type='button'
item.setAttribute('role','menuitem')
item.dataset.claudeAccountItem=''
const text=doc.createElement('span')
text.dataset.claudeAccountLabel=''
text.textContent=label
if(icon)item.append(glyphOf(icon))
item.append(text)
item.addEventListener('click',()=>{closeMenu();run()})
menu.append(item)
}
const hidden=all.filter((entry,index)=> !isShown(entry,index))
for(const entry of hidden)add(entry.label,entry.icon,()=> entry.button?.click())
if(hidden.length){
const separator=doc.createElement('div')
separator.setAttribute('role','separator')
separator.dataset.claudeAccountSeparator=''
menu.append(separator)
}
add('Edit sidebar…','',openEditor)
doc.body.append(menu)
const rect=moreItem.getBoundingClientRect()
menu.style.left=Math.round(rect.right + 4)+ 'px'
menu.style.top=Math.round(rect.top)+ 'px'
moreItem.querySelector('button')?.setAttribute('aria-expanded','true')
if(!hover)menu.querySelector('button')?.focus()
}
const onHoverIn=event=>{
if(event.pointerType==='touch')return
win.clearTimeout(unhoverTimer)
unhoverTimer=0
if(menu || hoverTimer)return
hoverTimer=win.setTimeout(()=>{hoverTimer=0;if(!disposed)openMenu('hover')},100)
}
const onHoverOut=event=>{
if(event.pointerType==='touch')return
win.clearTimeout(hoverTimer)
hoverTimer=0
if(menu && menuByHover && !unhoverTimer)unhoverTimer=win.setTimeout(()=>{unhoverTimer=0;if(menuByHover)closeMenu()},150)
}
const buildMore=template=>{
const li=doc.createElement('li')
li.className=template?.className || ''
li.dataset.claudeNavMore=''
const button=doc.createElement('button')
button.type='button'
button.className=template?.querySelector("[data-sidebar='menu-button']")?.className || ''
button.dataset.claudeNavMoreButton=''
button.setAttribute('aria-haspopup','menu')
button.setAttribute('aria-expanded','false')
const text=doc.createElement('span')
text.className='min-w-0 truncate'
text.textContent='More'
button.append(glyphOf('codicon-chevron-right'),text)
button.addEventListener('click',()=> openMenu('click'))
button.addEventListener('pointerenter',onHoverIn)
button.addEventListener('pointerleave',onHoverOut)
li.append(button)
return li
}
const markCurrent=all=>{
const button=moreItem?.querySelector('button')
const label=button?.querySelector('span')
if(!button || !label)return
const current=all.find((entry,index)=> !isShown(entry,index)&& entry.button?.classList.contains('bg-(--ui-control-active-background)'))
const text=current?current.label:'More'
if(label.textContent !==text)label.textContent=text
if(button.hasAttribute('data-claude-current')!==Boolean(current))button.toggleAttribute('data-claude-current',Boolean(current))
}
const isClaude=()=> doc.documentElement.dataset.claudeChatLook==='true'
const setPlaceholder=(input,text)=>{
if(!input)return
if(isClaude()&& input.placeholder !==text){
if(!('claudeNativePlaceholder' in input.dataset))input.dataset.claudeNativePlaceholder=input.placeholder
input.placeholder=text
}else if(!isClaude()&& 'claudeNativePlaceholder' in input.dataset){
input.placeholder=input.dataset.claudeNativePlaceholder
delete input.dataset.claudeNativePlaceholder
}
}
const placePaletteFoot=()=>{
const dialog=doc.querySelector("[role='dialog']:has(> [cmdk-root])")
if(!dialog)return
setPlaceholder(dialog.querySelector('[cmdk-input]'),'Search')
if(dialog.querySelector('[data-claude-palette-foot]'))return
const foot=doc.createElement('div')
foot.dataset.claudePaletteFoot=''
foot.setAttribute('aria-hidden','true')
for(const[label,...keys]of[['Close','Esc'],['Navigate','↑','↓'],['Open','↵']]){
const hint=doc.createElement('span')
hint.append(label)
for(const key of keys){
const kbd=doc.createElement('kbd')
kbd.textContent=key
hint.append(kbd)
}
foot.append(hint)
}
dialog.append(foot)
}
const placeSearch=()=>{
setPlaceholder(doc.querySelector("[data-tour='sessions-sidebar'] input[aria-label='Search sessions']"),'Search')
placePaletteFoot()
}
const onSearchPointer=event=>{
if(!isClaude())return
const field=event.target?.closest?.("[data-tour='sessions-sidebar'] div:has(> input[aria-label='Search sessions'])")
if(!field || event.target.closest('button')|| field.querySelector('input')?.value)return
event.preventDefault()
event.stopPropagation()
if(typeof openSearch==='function')return openSearch()
if(typeof runAction !=='function')return
const result=runAction('nav.commandPalette')
if(result && result.ok===false)console.warn('[claude-chat-look] nav.commandPalette refused',result.error)
}
const place=()=>{
frame=0
if(disposed)return
placeSearch()
const list=navList()
if(!list)return
const all=entries(list)
all.forEach((entry,index)=>{
const hide=!isShown(entry,index)
if(hide !==entry.li.hasAttribute('data-claude-nav-hidden'))entry.li.toggleAttribute('data-claude-nav-hidden',hide)
})
if(!moreItem)moreItem=buildMore(all[0]?.li)
if(moreItem.parentElement !==list || list.lastElementChild !==moreItem)list.append(moreItem)
markCurrent(all)
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const onPointer=event=>{if(menu && !menu.contains(event.target)&& !moreItem?.contains(event.target))closeMenu()}
const onKey=event=>{
if(event.key==='Tab' && editor){
const stops=[...editor.querySelectorAll('input, button')].filter(node=> !node.disabled && node.getClientRects().length)
const at=stops.indexOf(doc.activeElement)
if(stops.length &&(at===-1 ||(event.shiftKey?at===0:at===stops.length - 1))){
event.preventDefault()
stops[event.shiftKey?stops.length - 1:0].focus()
}
return
}
if(event.key !=='Escape' ||(!editor && !menu))return
event.preventDefault()
event.stopPropagation()
if(editor)closeEditor()
else closeMenu()
}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true})
const themeObserver=new win.MutationObserver(schedule)
themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-hermes-theme']})
doc.addEventListener('pointerdown',onPointer,true)
doc.addEventListener('pointerdown',onSearchPointer,true)
doc.addEventListener('keydown',onKey,true)
place()
return()=>{
disposed=true
observer.disconnect()
themeObserver.disconnect()
doc.removeEventListener('pointerdown',onSearchPointer,true)
for(const foot of doc.querySelectorAll('[data-claude-palette-foot]'))foot.remove()
if(frame)win.cancelAnimationFrame(frame)
doc.removeEventListener('pointerdown',onPointer,true)
doc.removeEventListener('keydown',onKey,true)
closeMenu()
closeEditor()
for(const input of doc.querySelectorAll('input[data-claude-native-placeholder]')){
input.placeholder=input.dataset.claudeNativePlaceholder
delete input.dataset.claudeNativePlaceholder
}
moreItem?.remove()
moreItem=null
for(const li of doc.querySelectorAll('[data-claude-nav-hidden]'))li.removeAttribute('data-claude-nav-hidden')
}
}
const CLAUDE_TITLE_TAB="[data-zone-tabstrip='grp-main'] [role='tab']:is([aria-selected='true'], [data-active='true'])"
const CLAUDE_TITLE_TAB_ONLY=new Set(['Reload','Close','Close others','Close to the right','Close all','Hide tab bar'])
const CLAUDE_TITLE_TIP_MAX=80
function claudeTitleTip(title){
const name=String(title || '').trim()
if(!name)return 'More options'
return 'More options for ' +(name.length <=CLAUDE_TITLE_TIP_MAX?name:name.slice(0,CLAUDE_TITLE_TIP_MAX - 1).trimEnd()+ '…')
}
function installClaudeTitleMenu({document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.body || !win)return()=>{}
let frame=0,disposed=false,chevron=null,pending=0,title=null,editing=null,proxying=false
const root=doc.documentElement
const isClaude=()=> root.getAttribute('data-claude-chat-look')==='true'
const setAttr=(node,name,value)=>{if(node.getAttribute(name)!==value)node.setAttribute(name,value)}
const renameable=tab=> Boolean(tab.closest('[data-tree-group]')?.matches('[data-claude-has~="slot-message"]'))
const unmark=span=>{
span.removeAttribute('data-claude-title-rename')
span.removeAttribute('aria-label')
}
const label=()=>{
const name=title?.textContent.trim()|| ''
if(title)setAttr(title,'aria-label',name + ', rename session')
if(chevron){
setAttr(chevron,'aria-label',name?'More options for ' + name:'More options')
setAttr(chevron,'data-claude-tip',claudeTitleTip(name))
}
}
const tidy=menu=>{
menu.dataset.claudeTitleMenu=''
const kids=[...menu.children]
for(const item of kids){
if(item.getAttribute('role')==='separator')continue
const hide=CLAUDE_TITLE_TAB_ONLY.has(item.textContent.trim())
if(hide !==item.hasAttribute('data-claude-title-menu-hidden'))item.toggleAttribute('data-claude-title-menu-hidden',hide)
}
let seen=false
kids.forEach((item,index)=>{
if(item.getAttribute('role')!=='separator'){if(!item.hasAttribute('data-claude-title-menu-hidden'))seen=true;return}
const next=kids.slice(index + 1).find(k=> !k.hasAttribute('data-claude-title-menu-hidden'))
item.toggleAttribute('data-claude-title-menu-hidden',!seen || !next || next.getAttribute('role')==='separator')
})
}
const findMenu=(tries,fromChevron=true)=>{
pending=0
const menu=[...doc.querySelectorAll("[role='menu']")].pop()
if(menu){tidy(menu);if(fromChevron)chevron?.setAttribute('aria-expanded','true');return}
if(tries > 0)pending=win.requestAnimationFrame(()=> findMenu(tries - 1,fromChevron))
}
const open=event=>{
event.preventDefault()
event.stopPropagation()
const tab=chevron?.closest("[role='tab']")
if(!tab)return
const rect=chevron.getBoundingClientRect()
tab.dispatchEvent(new win.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:Math.round(rect.left)- 2,clientY:Math.round(rect.bottom + 4)}))
if(pending)win.cancelAnimationFrame(pending)
findMenu(10)
}
const onContextMenu=event=>{
if(!event.isTrusted || proxying || !isClaude()|| !event.target?.closest?.(CLAUDE_TITLE_TAB))return
if(pending)win.cancelAnimationFrame(pending)
pending=win.requestAnimationFrame(()=> findMenu(10,false))
}
const swallow=event=> event.stopPropagation()
const build=()=>{
const button=doc.createElement('button')
button.type='button'
button.dataset.claudeTitleChevron=''
button.setAttribute('aria-label','More options')
button.setAttribute('aria-haspopup','menu')
button.setAttribute('aria-expanded','false')
const glyph=doc.createElement('i')
glyph.className='codicon codicon-chevron-down'
glyph.setAttribute('aria-hidden','true')
button.append(glyph)
button.addEventListener('pointerdown',swallow)
button.addEventListener('mousedown',swallow)
button.addEventListener('click',open)
return button
}
const nextFrame=()=> new Promise(resolve=> win.requestAnimationFrame(()=> resolve()))
const waitFor=async(find,frames)=>{
for(let i=0;i < frames && !disposed;i++){const found=find();if(found)return found;await nextFrame()}
return find()
}
const renameThroughHermes=async(tab,name)=>{
proxying=true
root.setAttribute('data-claude-title-proxy','')
try{
const box=tab.getBoundingClientRect()
tab.dispatchEvent(new win.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:Math.round(box.left),clientY:Math.round(box.bottom)}))
let menu=null
const item=await waitFor(()=>{
menu=[...doc.querySelectorAll("[role='menu']")].pop()|| null
return menu &&[...menu.querySelectorAll("[role='menuitem']")].find(row=> row.querySelector('.codicon-edit')|| /^Rename\b/.test(row.textContent.trim()))
},20)
if(!item){menu?.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return}
item.click()
const input=await waitFor(()=> doc.querySelector("[data-slot='dialog-content'] input:not([type='hidden'])"),30)
if(!input)return
const dialog=input.closest("[data-slot='dialog-content']")
Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set.call(input,name)
input.dispatchEvent(new win.Event('input',{bubbles:true}))
await nextFrame()
await nextFrame()
const buttons=[...dialog.querySelectorAll('button')].filter(button=> button.getAttribute('data-slot')!=='dialog-close-button')
const save=buttons.find(button=> button.textContent.trim()==='Save')|| buttons.pop()
save?.click()
await waitFor(()=> !dialog.isConnected,240)
}finally{
proxying=false
root.removeAttribute('data-claude-title-proxy')
}
}
const finish=save=>{
const edit=editing
if(!edit)return
editing=null
const next=edit.input.value.trim()
edit.input.remove()
edit.tab.removeAttribute('data-claude-title-editing')
if(save && next && next !==edit.before && edit.tab.isConnected && !disposed)renameThroughHermes(edit.tab,next)
}
const startEdit=span=>{
if(editing || proxying)return
const tab=span.closest("[role='tab']")
if(!tab)return
const before=span.textContent.trim()
const box=span.getBoundingClientRect(),style=win.getComputedStyle(span)
const input=doc.createElement('input')
input.type='text'
input.dataset.claudeTitleEdit=''
input.value=before
input.size=Math.min(Math.max(before.length,1),30)
input.spellcheck=false
input.setAttribute('aria-label','Session title')
input.style.font=style.font
input.style.letterSpacing=style.letterSpacing
const left=box.left +(parseFloat(style.paddingLeft)|| 0)
const strip=tab.closest('[data-zone-tabstrip]')?.getBoundingClientRect()
input.style.left=left + 'px'
input.style.top=box.top + 'px'
input.style.height=box.height + 'px'
input.style.maxWidth=Math.max(80,(strip?strip.right:win.innerWidth)- left - 8)+ 'px'
input.addEventListener('pointerdown',swallow)
input.addEventListener('keydown',event=>{
event.stopPropagation()
if(event.isComposing)return
if(event.key==='Enter'){event.preventDefault();finish(true)}
else if(event.key==='Escape'){event.preventDefault();finish(false)}
})
input.addEventListener('blur',()=> finish(true))
editing={input,tab,before}
tab.setAttribute('data-claude-title-editing','')
doc.body.append(input)
input.focus({preventScroll:true})
input.select()
}
const onClick=event=>{
if(event.button !==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !isClaude())return
const span=event.target?.closest?.('[data-claude-title-rename]')
if(span && span===title && span.closest(CLAUDE_TITLE_TAB))startEdit(span)
}
const onOver=event=>{if(title && event.target?.closest?.(CLAUDE_TITLE_TAB))label()}
const place=()=>{
frame=0
if(disposed)return
if(chevron?.getAttribute('aria-expanded')==='true' && !doc.querySelector('[data-claude-title-menu]'))chevron.setAttribute('aria-expanded','false')
const content=isClaude()?doc.querySelector(CLAUDE_TITLE_TAB + ' > .pane-tab-content'):null
const span=content && renameable(content.parentElement)?content.querySelector(':scope > :is(span, button) > span.truncate'):null
if(title && title !==span)unmark(title)
title=span
if(title)setAttr(title,'data-claude-title-rename','')
if(editing &&(!editing.tab.isConnected || !editing.tab.matches(CLAUDE_TITLE_TAB)|| !isClaude()))finish(false)
if(!content){chevron?.remove();return}
if(!chevron)chevron=build()
if(content.lastElementChild !==chevron)content.append(chevron)
label()
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected','data-active','data-claude-has']})
const lookObserver=new win.MutationObserver(schedule)
lookObserver.observe(root,{attributes:true,attributeFilter:['data-claude-chat-look']})
doc.addEventListener('click',onClick,true)
doc.addEventListener('contextmenu',onContextMenu,true)
doc.addEventListener('pointerover',onOver,true)
place()
return()=>{
disposed=true
observer.disconnect()
lookObserver.disconnect()
doc.removeEventListener('click',onClick,true)
doc.removeEventListener('contextmenu',onContextMenu,true)
doc.removeEventListener('pointerover',onOver,true)
if(frame)win.cancelAnimationFrame(frame)
if(pending)win.cancelAnimationFrame(pending)
finish(false)
if(title)unmark(title)
title=null
chevron?.remove()
chevron=null
root.removeAttribute('data-claude-title-proxy')
}
}
const CLAUDE_THINK_PHRASES=[[60,'Almost done thinking…'],[45,'Thinking some more…'],[30,'Thinking more…'],[15,'Still thinking…'],[0,'Thinking…']]
const CLAUDE_LIVE_PROMPT_ID=/^user-(?!inflight-|queued-|pending-)/
function claudeTimerSeconds(text){
const match=/^(?:(\d+)s|(\d+):(\d{2}))$/.exec(String(text || '').trim())
if(!match)return null
return match[1]!==undefined?Number(match[1]):Number(match[2])* 60 + Number(match[3])
}
function claudeThoughtFor(seconds){
if(seconds < 60)return `Thought for ${seconds}s`
const minutes=Math.floor(seconds / 60),restSeconds=seconds % 60
if(minutes < 60)return restSeconds?`Thought for ${minutes}m ${restSeconds}s`:`Thought for ${minutes}m`
const hours=Math.floor(minutes / 60),restMinutes=minutes % 60
return restMinutes?`Thought for ${hours}h ${restMinutes}m`:`Thought for ${hours}h`
}
function claudeThinkPhrase(label,timer){
const text=String(label || '').trim()
if(text==='Thinking'){
const seconds=claudeTimerSeconds(timer)??0
return CLAUDE_THINK_PHRASES.find(([from])=> seconds >=from)[1]
}
const settled=/^Thought for (.+)$/.exec(text)
const seconds=settled?claudeTimerSeconds(settled[1]):null
return seconds===null?null:claudeThoughtFor(seconds)
}
function installClaudeTranscript({document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.body || !win)return()=>{}
const root=doc.documentElement
let frame=0,ticker=0,disposed=false
const entering=new Set()
const active=()=> root.getAttribute('data-claude-chat-look')==='true'
const clearThinking=()=>{
for(const label of doc.querySelectorAll('[data-claude-think-phrase]'))label.removeAttribute('data-claude-think-phrase')
}
const clearEntering=()=>{
for(const user of entering)user.removeAttribute('data-claude-enter')
entering.clear()
}
const relabel=()=>{
let pending=false
for(const disclosure of doc.querySelectorAll('[data-slot="aui_thinking-disclosure"]')){
const header=disclosure.firstElementChild
if(!header || header.matches('[data-slot="aui_thinking-body"]'))continue
const spans=[...header.querySelectorAll('span')]
const label=spans.find(span=> !span.firstElementChild && /^(?:Thinking|Thought for .+)$/.test(span.textContent.trim()))
if(!label)continue
const timer=spans.filter(span=> span !==label && claudeTimerSeconds(span.textContent)!==null).at(-1)
const phrase=claudeThinkPhrase(label.textContent,timer?.textContent)
if(label.textContent.trim()==='Thinking')pending=true
if(!phrase)label.removeAttribute('data-claude-think-phrase')
else if(label.getAttribute('data-claude-think-phrase')!==phrase)label.setAttribute('data-claude-think-phrase',phrase)
}
return pending
}
const tick=()=>{
if(disposed || !active()){win.clearInterval(ticker);ticker=0;return}
if(!relabel()){win.clearInterval(ticker);ticker=0}
}
const run=()=>{
frame=0
if(disposed)return
if(!active()){clearThinking();clearEntering();return}
if(relabel()&& !ticker)ticker=win.setInterval(tick,1000)
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(run)}
const enter=user=>{
if(!active()|| !CLAUDE_LIVE_PROMPT_ID.test(user.getAttribute('data-message-id')|| ''))return
user.setAttribute('data-claude-enter','')
entering.add(user)
const done=()=>{
user.removeAttribute('data-claude-enter')
entering.delete(user)
}
user.addEventListener('animationend',done,{once:true})
win.setTimeout(done,600)
}
const THINKING='[data-slot="aui_thinking-disclosure"]'
const USER='[data-slot="aui_user-message-root"]'
const observer=new win.MutationObserver(records=>{
let thinking=false
const users=[]
for(const record of records){
if(record.type==='attributes'){
if(record.target===root)thinking=true
continue
}
const target=record.target.nodeType===1?record.target:record.target.parentElement
if(!target?.closest('[data-slot="aui_thread-viewport"]'))continue
if(target.closest(THINKING)&& !target.closest('[data-slot="aui_thinking-body"]'))thinking=true
for(const node of record.addedNodes){
if(node.nodeType !==1)continue
if(node.matches(USER))users.push(node)
else if(node.firstElementChild)users.push(...node.querySelectorAll(USER))
if(!thinking &&(node.matches(THINKING)||(node.firstElementChild && node.querySelector(THINKING))))thinking=true
}
}
if(users.length===1)enter(users[0])
if(thinking)schedule()
})
observer.observe(doc.body,{childList:true,subtree:true})
observer.observe(root,{attributes:true,attributeFilter:['data-claude-chat-look']})
schedule()
return()=>{
disposed=true
observer.disconnect()
if(frame)win.cancelAnimationFrame(frame)
win.clearInterval(ticker)
clearThinking()
clearEntering()
}
}
const CLAUDE_MODEL_TRIGGER="[data-slot='composer-root'] button[data-tour='model-pill']"
const CLAUDE_EFFORT_TRIGGER="[data-slot='composer-root'] button[data-testid='reasoning-pill']"
const CLAUDE_EFFORT_WORDS={Min:'Minimal',Med:'Medium',XHigh:'Extra High','X-High':'Extra High','Extra':'Extra High'}
function claudeEffortWord(label){
const short=String(label || '').replace(/^Effort:\s*/,'').trim()
return CLAUDE_EFFORT_WORDS[short]|| short
}
function claudeBesideLeft(menuBox,width,viewport){
if(menuBox.right + 4 + width <=viewport - 8)return menuBox.right + 4
if(menuBox.left - 4 - width >=8)return menuBox.left - 4 - width
return Math.max(8,viewport - 8 - width)
}
function installClaudeModelPill({document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.body || !win)return()=>{}
let frame=0,disposed=false,passEffort=false
const isClaude=()=> doc.documentElement.dataset.claudeChatLook==='true'
const press=el=>{
for(const type of['pointerdown','mousedown','pointerup','mouseup'])el.dispatchEvent(new win.PointerEvent(type,{bubbles:true,cancelable:true,button:0,pointerType:'mouse'}))
}
const closeMenus=()=> doc.activeElement?.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
const openEffort=()=>{
const effort=doc.querySelector(CLAUDE_EFFORT_TRIGGER)
if(!effort)return
closeMenus()
win.requestAnimationFrame(()=>{passEffort=true;press(effort);passEffort=false})
}
const showEffort=(menu,row,keyboard=false)=>{
closeMore(menu)
const current=[...menu.querySelectorAll("[data-slot='dropdown-menu-sub-trigger']")].find(item=> item.querySelector('.codicon-check'))
if(!current)return openEffort()
const box=current.getBoundingClientRect()
if(current.getAttribute('aria-expanded')!=='true')current.dispatchEvent(new win.PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:box.left + 20,clientY:box.top + 5}))
menu.dataset.claudeEffortOpen=''
let tries=20
const level=()=>{
const sub=current.getAttribute('aria-controls')&& doc.getElementById(current.getAttribute('aria-controls'))
const wrapper=sub?.parentElement
if(!sub || !wrapper){if(tries-- > 0)win.requestAnimationFrame(level);return}
if(keyboard && !sub.contains(doc.activeElement)){
keyboard=false
sub.querySelector("[role^='menuitem'][data-state='checked'], [role^='menuitem'][aria-checked='true']")?.focus({preventScroll:true})
if(!sub.contains(doc.activeElement))sub.querySelector("[role^='menuitem']")?.focus({preventScroll:true})
}
const base=wrapper.getBoundingClientRect(),menuBox=menu.getBoundingClientRect()
const dx=Math.round(claudeBesideLeft(menuBox,sub.offsetWidth,win.innerWidth)- base.left)
const dy=Math.round(Math.max(8 - base.top,row.getBoundingClientRect().bottom + 5 -(base.top + sub.offsetHeight)))
sub.style.translate=dx + 'px ' + dy + 'px'
if(tries-- > 0)win.requestAnimationFrame(level)
}
win.requestAnimationFrame(level)
}
const align=(menu,model,effort)=>{
const wrapper=menu.parentElement
const end=(effort?.hasAttribute('data-claude-model-paired')?effort:model)?.getBoundingClientRect().right
if(!wrapper || end==null)return
const base=wrapper.getBoundingClientRect()
const dx=Math.round(Math.max(8 - base.left,Math.min(end - base.right,win.innerWidth - 8 - base.right)))
const want=dx?dx + 'px 0':''
if(menu.style.translate !==want)menu.style.translate=want
}
const models=menu=>[...menu.querySelectorAll("[role='group'] > [data-slot='dropdown-menu-sub-trigger']")].filter(item=> item.getBoundingClientRect().height > 0)
const proxy=(label,real,extra)=>{
const item=doc.createElement('div')
item.setAttribute('role','menuitem')
item.tabIndex=-1
item.dataset.claudeMoreItem=''
const text=doc.createElement('span')
text.textContent=label
item.append(text)
if(extra)item.append(extra)
item.addEventListener('click',event=>{event.stopPropagation();real.click()})
item.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();real.click()}})
return item
}
const moreSource=menu=>{
const groups=[...menu.querySelectorAll("[role='group']")].filter(group=> !group.querySelector(":scope > [data-slot='dropdown-menu-label']"))
const foot=[...menu.children].filter(kid=> kid.getAttribute('role')==='menuitem' && !kid.matches('[data-claude-effort-row], [data-claude-more-row]'))
return{groups,foot}
}
const moreSignature=menu=>{
const{groups,foot}=moreSource(menu)
return groups.map(group=>[...group.children].map(kid=> kid.textContent.trim()+(kid.querySelector('.codicon-check')?'*':'')+(kid.querySelector('.rotate-90')?'v':'')+(kid.querySelector(":scope > button[aria-pressed='true']")?'f':'')).join(',')).join('|')+ '#' + foot.map(kid=> kid.textContent.trim()).join(',')
}
const fadeMore=list=>{
const more=list.scrollHeight - list.clientHeight - list.scrollTop > 1
if(more !==list.hasAttribute('data-more-below'))list.toggleAttribute('data-more-below',more)
}
const buildMore=menu=>{
const panel=menu.querySelector('[data-claude-more-panel]')
if(!panel)return
const sig=moreSignature(menu)
if(panel.dataset.sig===sig)return
panel.dataset.sig=sig
const scroll=panel.querySelector('[data-claude-more-list]')?.scrollTop || 0
const list=doc.createElement('div')
list.dataset.claudeMoreList=''
list.addEventListener('scroll',()=> fadeMore(list),{passive:true})
const tail=doc.createElement('div')
tail.dataset.claudeMoreFoot=''
panel.replaceChildren(list,tail)
const{groups,foot}=moreSource(menu)
for(const group of groups){
const rows=[...group.children]
const header=rows[0]?.matches("[data-slot='dropdown-menu-sub-trigger']")?null:rows.shift()
if(header){
const label=doc.createElement('div')
label.dataset.claudeMoreLabel=''
const name=doc.createElement('span')
name.textContent=header.querySelector('.truncate')?.textContent.trim()|| header.textContent.trim()
const collapsed=!header.querySelector('.rotate-90')
const glyph=doc.createElement('i')
glyph.className='codicon codicon-chevron-' +(collapsed?'right':'down')
glyph.setAttribute('aria-hidden','true')
label.append(name,glyph)
label.toggleAttribute('data-collapsed',collapsed)
label.addEventListener('click',event=>{event.stopPropagation();header.click()})
list.append(label)
}
for(const row of rows){
if(!row.matches("[data-slot='dropdown-menu-sub-trigger']"))continue
const name=(row.querySelector(':scope > span.flex .truncate')|| row.querySelector(':scope > span.flex')|| row).textContent.trim()
const check=row.querySelector('.codicon-check')?Object.assign(doc.createElement('i'),{className:'codicon codicon-check'}):null
const item=proxy(name,row,check)
const real=row.querySelector(":scope > button[aria-pressed], :scope > button[aria-label*='avorite']")
if(real){
const star=doc.createElement('button')
star.type='button'
star.dataset.claudeStar=''
const on=real.getAttribute('aria-pressed')==='true'
star.setAttribute('aria-pressed',String(on))
star.setAttribute('aria-label',on?'Remove from favorites':'Add to favorites')
star.title=star.getAttribute('aria-label')
const glyph=doc.createElement('i')
glyph.className='codicon codicon-' +(on?'star-full':'star-empty')
glyph.setAttribute('aria-hidden','true')
star.append(glyph)
star.addEventListener('pointerdown',event=> event.stopPropagation())
star.addEventListener('click',event=>{event.stopPropagation();event.preventDefault();real.click()})
item.prepend(star)
}
list.append(item)
}
}
if(foot.length){
const rule=doc.createElement('div')
rule.setAttribute('role','separator')
rule.dataset.claudeMoreRule=''
rule.className=menu.querySelector('[data-claude-effort-rule]')?.className || ''
tail.append(rule)
for(const item of foot)tail.append(proxy(item.textContent.trim(),item))
}
list.scrollTop=scroll
fadeMore(list)
}
const openMore=(menu,row)=>{
row.focus()
menu.removeAttribute('data-claude-effort-open')
menu.dataset.claudeMoreOpen=''
buildMore(menu)
positionMore(menu)
}
const positionMore=menu=>{
const panel=menu.querySelector('[data-claude-more-panel]'),row=menu.querySelector('[data-claude-more-row]')
if(!panel || !row)return
const rowBox=row.getBoundingClientRect(),menuBox=menu.getBoundingClientRect()
const maxHeight=Math.round(Math.max(120,Math.min(440,rowBox.bottom + 5 - 8)))+ 'px'
if(panel.style.maxHeight !==maxHeight)panel.style.maxHeight=maxHeight
const top=Math.round(Math.max(8 - menuBox.top,rowBox.bottom + 5 - menuBox.top - panel.offsetHeight))+ 'px'
if(panel.style.top !==top)panel.style.top=top
const left=Math.round(claudeBesideLeft(menuBox,panel.offsetWidth,win.innerWidth)- menuBox.left)+ 'px'
if(panel.style.left !==left)panel.style.left=left
const list=panel.querySelector('[data-claude-more-list]')
if(list)fadeMore(list)
}
const closeMore=menu=>{menu?.removeAttribute('data-claude-more-open')}
const shownRows=(box,selector)=>[...box.querySelectorAll(selector)].filter(item=> item.closest("[role='menu']")===box && !item.hasAttribute('data-disabled')&& item.getClientRects().length)
const menuRows=menu=> shownRows(menu,"[role^='menuitem']")
const panelRows=panel=> shownRows(panel,'[data-claude-more-item]')
const lost=node=> !node || node===doc.body || Boolean(node.closest?.("[data-claude-model-menu] [data-slot='dropdown-menu-search']"))
const rescue=(menu,fromEffort)=>{
if(!menu.isConnected || !lost(doc.activeElement))return
;(fromEffort && menu.querySelector('[data-claude-effort-row]')|| menu).focus?.({preventScroll:true})
}
const onNav=event=>{
const menu=doc.querySelector('[data-claude-model-menu]')
if(!menu || event.isComposing || !isClaude())return
const at=doc.activeElement
const fromEffort=Boolean(at?.closest?.('[data-claude-effort-menu]'))
win.requestAnimationFrame(()=> rescue(menu,fromEffort))
if(!['ArrowDown','ArrowUp','ArrowLeft','Home','End'].includes(event.key))return
const panel=menu.querySelector('[data-claude-more-panel]')
const inPanel=Boolean(panel?.contains(at)&& menu.hasAttribute('data-claude-more-open'))
if(!inPanel && !lost(at)&& at !==menu && at?.closest?.("[role='menu']")!==menu)return
if(event.key==='ArrowLeft'){
if(!inPanel)return
event.preventDefault()
event.stopPropagation()
closeMore(menu)
menu.querySelector('[data-claude-more-row]')?.focus({preventScroll:true})
return
}
const rows=inPanel?panelRows(panel):menuRows(menu)
if(!rows.length)return
event.preventDefault()
event.stopPropagation()
const index=rows.indexOf(at)
const next=event.key==='Home'?rows[0]:event.key==='End'?rows[rows.length - 1]
:index < 0?rows[event.key==='ArrowDown'?0:rows.length - 1]
:rows[(index +(event.key==='ArrowDown'?1:-1)+ rows.length)% rows.length]
if(!inPanel && !next.matches('[data-claude-more-row]'))closeMore(menu)
next.focus({preventScroll:true})
next.scrollIntoView?.({block:'nearest'})
}
const moreRow=menu=>{
const row=doc.createElement('div')
row.setAttribute('role','menuitem')
row.setAttribute('aria-haspopup','menu')
row.tabIndex=-1
row.dataset.claudeMoreRow=''
const name=doc.createElement('span')
name.textContent='More models'
const glyph=doc.createElement('i')
glyph.className='codicon codicon-chevron-right'
glyph.setAttribute('aria-hidden','true')
row.append(name,glyph)
let hover=0
row.addEventListener('pointerenter',()=>{hover=win.setTimeout(()=> openMore(menu,row),120)})
row.addEventListener('pointerleave',()=> win.clearTimeout(hover))
row.addEventListener('click',()=> openMore(menu,row))
row.addEventListener('keydown',event=>{
if(event.key !=='Enter' && event.key !=='ArrowRight' && event.key !==' ')return
event.preventDefault()
openMore(menu,row)
panelRows(panel)[0]?.focus({preventScroll:true})
})
const panel=doc.createElement('div')
panel.setAttribute('role','menu')
panel.setAttribute('aria-label','More models')
panel.dataset.claudeMorePanel=''
menu.addEventListener('pointerover',event=>{
const item=event.target?.closest?.("[role^='menuitem']")
if(item && !row.contains(item)&& !panel.contains(item))closeMore(menu)
})
return[row,panel]
}
const effortRow=menu=>{
const row=doc.createElement('div')
row.setAttribute('role','menuitem')
row.tabIndex=-1
row.dataset.claudeEffortRow=''
const name=doc.createElement('span')
name.textContent='Effort'
const value=doc.createElement('span')
value.dataset.claudeEffortValue=''
value.textContent=claudeEffortWord(doc.querySelector(CLAUDE_EFFORT_TRIGGER)?.getAttribute('aria-label'))
const glyph=doc.createElement('i')
glyph.className='codicon codicon-chevron-right'
glyph.setAttribute('aria-hidden','true')
row.append(name,value,glyph)
let hover=0
row.addEventListener('pointerenter',()=>{hover=win.setTimeout(()=> showEffort(menu,row),120)})
row.addEventListener('pointerleave',()=> win.clearTimeout(hover))
row.addEventListener('click',()=> showEffort(menu,row))
row.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key==='ArrowRight' || event.key===' '){event.preventDefault();showEffort(menu,row,true)}})
const rule=doc.createElement('div')
rule.setAttribute('role','separator')
rule.dataset.claudeEffortRule=''
const foot=[...menu.children].find(kid=> kid.getAttribute('role')==='separator' && kid.previousElementSibling?.matches('div:has([role=\'group\'])'))
if(foot)rule.className=foot.className
menu.insertBefore(rule,foot || null)
menu.insertBefore(row,foot || null)
const rule2=rule.cloneNode()
delete rule2.dataset.claudeEffortRule
rule2.dataset.claudeMoreRuleTop=''
const[more,panel]=moreRow(menu)
menu.insertBefore(rule2,foot || null)
menu.insertBefore(more,foot || null)
menu.append(panel)
}
const place=()=>{
frame=0
if(disposed)return
const model=doc.querySelector(CLAUDE_MODEL_TRIGGER),effort=doc.querySelector(CLAUDE_EFFORT_TRIGGER)
if(effort){
const word=claudeEffortWord(effort.getAttribute('aria-label'))
if(effort.dataset.claudeEffort !==word)effort.dataset.claudeEffort=word
const paired=model?.nextElementSibling===effort
if(paired !==effort.hasAttribute('data-claude-model-paired'))effort.toggleAttribute('data-claude-model-paired',paired)
}
for(const menu of doc.querySelectorAll("[role='menu'][data-state='open']")){
const by=menu.getAttribute('aria-labelledby')
if(model && by===model.id && !menu.hasAttribute('data-claude-model-menu')){
menu.dataset.claudeModelMenu=''
effortRow(menu)
if(isClaude()&& lost(doc.activeElement))menu.focus?.({preventScroll:true})
}
const docked=doc.querySelector('[data-claude-docked]')
if(docked && by && by===docked.id && menu.parentElement){
const base=menu.parentElement.getBoundingClientRect()
const dx=Math.round(Math.max(8 - base.left,Math.min(docked.getBoundingClientRect().left - base.left,win.innerWidth - 8 - base.right)))
const want=dx?dx + 'px 0':''
if(menu.style.translate !==want)menu.style.translate=want
}
if(menu.hasAttribute('data-claude-model-menu')){
models(menu).forEach((item,index)=>{const key=index < 9?String(index + 1):null;if(item.dataset.claudeModelKey !==(key??undefined)){if(key)item.dataset.claudeModelKey=key;else delete item.dataset.claudeModelKey}})
for(const stale of menu.querySelectorAll('[data-claude-model-key]'))if(!stale.getBoundingClientRect().height)delete stale.dataset.claudeModelKey
align(menu,model,effort)
if(menu.hasAttribute('data-claude-more-open')){buildMore(menu);positionMore(menu)}
if(menu.hasAttribute('data-claude-effort-open')&& !menu.querySelector("[data-slot='dropdown-menu-sub-trigger'][aria-expanded='true']"))menu.removeAttribute('data-claude-effort-open')
}else if(!menu.hasAttribute('data-claude-model-menu')&& !menu.hasAttribute('data-claude-effort-menu')){
const trigger=by && doc.getElementById(by)
if((effort && by===effort.id)|| trigger?.closest('[data-claude-model-menu]'))menu.dataset.claudeEffortMenu=''
}
}
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const onPointer=event=>{
if(passEffort || !isClaude())return
const effort=event.target?.closest?.(CLAUDE_EFFORT_TRIGGER)
if(!effort)return
event.preventDefault()
event.stopPropagation()
if(event.type==='pointerdown'){
const model=doc.querySelector(CLAUDE_MODEL_TRIGGER)
if(model)press(model)
}
}
const onMove=event=>{
if(!event.isTrusted || !isClaude())return
if(event.target?.closest?.("[data-claude-model-menu] [data-slot='dropdown-menu-sub-trigger']"))event.stopPropagation()
}
const onKey=event=>{
const menu=doc.querySelector('[data-claude-model-menu]')
if(!menu || !/^[1-9]$/.test(event.key)|| event.target?.closest?.('input'))return
const item=menu.querySelector("[data-claude-model-key='" + event.key + "']")
if(!item)return
event.preventDefault()
event.stopPropagation()
item.click()
}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','data-state']})
for(const type of['pointerdown','mousedown','pointerup','mouseup','click'])doc.addEventListener(type,onPointer,true)
doc.addEventListener('keydown',onKey,true)
doc.addEventListener('keydown',onNav,true)
doc.addEventListener('pointermove',onMove,true)
place()
return()=>{
disposed=true
observer.disconnect()
if(frame)win.cancelAnimationFrame(frame)
for(const type of['pointerdown','mousedown','pointerup','mouseup','click'])doc.removeEventListener(type,onPointer,true)
doc.removeEventListener('keydown',onKey,true)
doc.removeEventListener('keydown',onNav,true)
doc.removeEventListener('pointermove',onMove,true)
for(const el of doc.querySelectorAll('[data-claude-effort-row], [data-claude-effort-rule], [data-claude-more-row], [data-claude-more-rule-top], [data-claude-more-panel]'))el.remove()
for(const el of doc.querySelectorAll('[data-claude-effort]')){delete el.dataset.claudeEffort;el.removeAttribute('data-claude-model-paired')}
}
}
function claudeJsonString(text,key){
const lead=text.startsWith('{"' + key + '": "')?1:text.indexOf('\n  "' + key + '": "')
if(lead < 0)return null
const at=lead +(text[lead]==='\n'?3:0)
let i=at + key.length + 5,out=''
while(i < text.length){
const c=text[i]
if(c==='"')return out
if(c==='\\'){
const n=text[i + 1]
if(n==='u'){out +=String.fromCharCode(parseInt(text.slice(i + 2,i + 6),16)|| 63);i +=6;continue}
out +={n:'\n',t:'\t',r:'',b:'\b',f:'\f'}[n]??n
i +=2
continue
}
out +=c
i++
}
return out
}
function claudeToolPayload(text){
if(!text?.startsWith('Arguments:'))return null
const cut=text.indexOf('\n\nResult:\n')
const args=cut < 0?text.slice(11):text.slice(11,cut)
const result=cut < 0?'':text.slice(cut + 10)
const command=claudeJsonString(args,'command'),code=claudeJsonString(args,'code')
const view=command !=null?{label:'Bash',prompt:true,body:command}
:code !=null?{label:'Python',prompt:false,body:code}
:{label:'Input',prompt:false,body:args.trim()}
let output=claudeJsonString(result,'output')??claudeJsonString(result,'stdout')??claudeJsonString(result,'content')
const stderr=claudeJsonString(result,'stderr'),error=claudeJsonString(result,'error')
if(output==null && result.trim().startsWith('"'))output=claudeJsonString('{"v": ' + result.trim(),'v')
if(output==null)output=result.trim()
const exit=/"exit_code":\s*(-?\d+)/.exec(result)?.[1]
view.body=view.body.replace(/^(?:[ \t]*\n)+/,'').replace(/\s+$/,'')
output=[output,stderr,error].filter(Boolean).map(text=> text.replace(/\s+$/,'')).join('\n').replace(/\u001b\[[\d;?]*[A-Za-z]/g,'').replace(/\s+$/,'')
return{...view,output,exit:exit && exit !=='0'?Number(exit):null,done:cut >=0}
}
function claudeToolPartPayload(part){
if(!['terminal','execute_code'].includes(part?.toolName))return null
const json=value=>{
if(typeof value==='string'){try{value=JSON.parse(value)}catch{return value}}
return JSON.stringify(value??{},null,2)
}
return claudeToolPayload('Arguments:\n' + json(part.args)+(part.result===undefined?'':'\n\nResult:\n' + json(part.result)))
}
const CLAUDE_PY_KEYWORDS=new Set(['and','as','assert','async','await','break','class','continue','def','del','elif','else','except','False','finally','for','from','global','if','import','in','is','lambda','None','nonlocal','not','or','pass','raise','return','True','try','while','with','yield'])
function claudeHighlight(text,shell){
const runs=[]
const push=(kind,part)=>{if(!part)return;const last=runs[runs.length - 1];if(last && last[0]===kind)last[1]+=part;else runs.push([kind,part])}
const re=shell
?/("(?:[^"\\]|\\.)*"?|'[^']*'?)|(#[^\n]*)|(\s+)|(&&|\|\||[|;&<>()]+)|([^\s"'|;&<>()]+)/g
:/("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[rbfu]{0,2}"(?:[^"\\\n]|\\.)*"?|[rbfu]{0,2}'(?:[^'\\\n]|\\.)*'?)|(#[^\n]*)|(\s+)|(\b\d[\d_.]*\b)|([A-Za-z_]\w*)|([^\sA-Za-z_\d"'#]+)/g
let expectCommand=true,m
while((m=re.exec(text))){
if(shell){
const[,str,com,space,op,word]=m
if(str){push('str',str);expectCommand=false}
else if(com)push('com',com)
else if(space){push('',space);if(space.includes('\n'))expectCommand=true}
else if(op){push('op',op);expectCommand=!/[<>]/.test(op)}
else if(word){
if(expectCommand && !/=/.test(word)){push('cmd',word);expectCommand=false}
else push(word.startsWith('-')?'flag':'',word)
}
}else{
const[,str,com,space,num,word,other]=m
if(str)push('str',str)
else if(com)push('com',com)
else if(space)push('',space)
else if(num)push('num',num)
else if(word)push(CLAUDE_PY_KEYWORDS.has(word)?'kw':(text[re.lastIndex]==='('?'fn':''),word)
else push('op',other)
}
}
return runs
}
function claudeDiffLineNumbers(diff){
const lines=String(diff || '').split('\n')
const header=line=> line.trim()==='' ||['diff --git','index ','--- ','+++ ','similarity ','rename ','new file','deleted file'].some(prefix=> line.startsWith(prefix))
||(line.trim().includes('→')&& /^\S.*→\s*\S+$/.test(line.trim())&& !/^[+\-@]/.test(line.trim()))
let start=0
while(start < lines.length && !lines[start].startsWith('@@')&& header(lines[start]))start++
const body=lines.slice(start)
const kind=line=> line.startsWith('+')&& !line.startsWith('+++')?'add':line.startsWith('-')&& !line.startsWith('---')?'remove':'context'
if(!body.some(line=> /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line))){
let no=0
return body.map(line=> kind(line)==='remove'?' ':++no)
}
const out=[]
let active=false,oldNo=1,newNo=1
for(const line of body){
if(line.startsWith('@@')){
const match=/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
active=Boolean(match)
if(!match)continue
if(out.length)out.push('')
oldNo=Number(match[1]);newNo=Number(match[2])
continue
}
if(!active || line.startsWith('\\'))continue
const k=kind(line)
out.push(k==='add'?newNo++:k==='remove'?oldNo++:(oldNo++,newNo++))
}
return out
}
const CLAUDE_STACK_WORDS={
read:['read','a file','# files'],create:['created','a file','# files'],edit:['edited','a file','# files'],
bash:['ran','a command','# commands'],code:['ran','code','code'],grep:['searched','code','code'],
glob:['searched','for files','for files'],web:['searched','the web','the web # times'],fetch:['fetched','a page','# pages'],
task:['ran','an agent','# agents'],todo:['updated','todos','todos'],recall:['recalled','a memory','# memories'],
save:['saved','a memory','# memories'],other:['used','a tool','# tools']
}
const CLAUDE_STACK_FILE=new Set(['read','create','edit'])
function claudeStackRecord(value){
if(typeof value==='string'){try{value=JSON.parse(value)}catch{return{}}}
return value && typeof value==='object'?value:{}
}
function claudeStackDiff(call){
for(const record of[claudeStackRecord(call.toolResultMetadata),claudeStackRecord(call.result)]){
for(const key of['inline_diff','diff'])if(typeof record[key]==='string' && record[key].trim())return record[key].replace(/\u001b\[[0-9;]*m/g,'')
}
return ''
}
function claudeStackCategory(call){
switch(call.toolName){
case 'terminal':return 'bash'
case 'execute_code':return 'code'
case 'read_file':return 'read'
case 'patch':case 'edit_file':return 'edit'
case 'write_file':return /^-(?!--)/m.test(claudeStackDiff(call))?'edit':'create'
case 'search_files':return claudeStackRecord(call.args).target==='files'?'glob':'grep'
case 'list_files':return 'glob'
case 'web_search':return 'web'
case 'web_extract':return 'fetch'
case 'delegate_task':return 'task'
case 'todo':case 'todo_list':return 'todo'
case 'session_search_recall':return 'recall'
case 'memory':return 'save'
default:return 'other'
}
}
function claudeToolStackClauses(calls){
const order=[],groups=new Map(),files=new Set()
let unnamed=false
for(const call of calls){
const category=claudeStackCategory(call)
if(!groups.has(category)){groups.set(category,new Map());if(category !=='other')order.push(category)}
const args=claudeStackRecord(call.args)
const path=CLAUDE_STACK_FILE.has(category)&& typeof args.path==='string'?args.path:''
if(CLAUDE_STACK_FILE.has(category)){if(path)files.add(path);else unnamed=true}
const urls=category==='fetch' && Array.isArray(args.urls)&& args.urls.length?args.urls:null
for(const key of urls??[path || call.toolCallId || groups.get(category).size])groups.get(category).set(key,claudeToolCallFailed(call))
}
const count=category=> groups.get(category).size
const failures=category=>[...groups.get(category).values()].filter(Boolean).length
const outcome=(clause,failed)=> failed?{...clause,meta:clause.meta + ` (${failed} failed)`,failed,isError:failed >=clause.count}:clause
const one=!unnamed && files.size===1?[...files][0]:''
const fileVerbs=order.filter(category=> CLAUDE_STACK_FILE.has(category))
let clauses=[]
if(groups.has('other'))order.push('other')
for(const category of order){
if(one && CLAUDE_STACK_FILE.has(category)){
if(category !==fileVerbs[0])continue
const verbs=fileVerbs.map(file=> CLAUDE_STACK_WORDS[file][0])
const verb=verbs.length < 3?verbs.join(' and '):verbs.slice(0,-1).join(', ')+ ', and ' + verbs.at(-1)
clauses.push(outcome({verb,meta:one.split(/[\\/]/).pop(),file:one,count:fileVerbs.length},fileVerbs.filter(failures).length))
continue
}
const[verb,single,many]=CLAUDE_STACK_WORDS[category]
const n=count(category)
clauses.push(outcome({verb,meta:n===1?single:many.replace('#',n),count:n},failures(category)))
}
if(clauses.length >=5){
const rest=clauses.slice(3)
const n=rest.reduce((sum,clause)=> sum + clause.count,0)
const failed=rest.reduce((sum,clause)=> sum +(clause.failed??0),0)
clauses=[...clauses.slice(0,3),outcome({verb:'and',meta:`${n} more action${n===1?'':'s'}`,count:n},failed)]
}
if(clauses[0])clauses[0]={...clauses[0],verb:clauses[0].verb.charAt(0).toUpperCase()+ clauses[0].verb.slice(1)}
return clauses
}
function claudeToolStackSummary(calls){
return claudeToolStackClauses(calls).map(clause=> clause.verb + ' ' + clause.meta).join(', ')
}
function claudeToolStackDiffCounts(calls){
let added=0,removed=0
for(const call of calls){
if(!['edit','create'].includes(claudeStackCategory(call))|| claudeToolCallFailed(call))continue
for(const line of claudeStackDiff(call).split('\n')){
if(line.startsWith('+')&& !line.startsWith('+++'))added++
else if(line.startsWith('-')&& !line.startsWith('---'))removed++
}
}
return{added,removed}
}
function claudeToolCallFailed(call){
let result=call.result
if(typeof result==='string'){try{result=JSON.parse(result)}catch{result=null}}
if(!result || typeof result !=='object')result={}
if(typeof result.exit_code==='number' && result.exit_code !==0)return true
if(result.success===true || result.ok===true)return false
return Boolean(call.isError || result.success===false || result.ok===false ||(typeof result.error==='string' && result.error.trim()))
}
const CLAUDE_STACK_KEEP=new Set(['clarify','image_generate','delegate_task','manage_connections','manage_catalog','set_theme','setup_beat'])
function installClaudeToolStacks({document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.body || !win)return()=>{}
const OPEN_KEY='claude-chat-look.openToolStacks'
let opened
try{opened=new Set(JSON.parse(win.localStorage.getItem(OPEN_KEY)|| '[]'))}catch{opened=new Set()}
const saveOpened=()=>{try{win.localStorage.setItem(OPEN_KEY,JSON.stringify([...opened].slice(-600)))}catch{}}
let frame=0,disposed=false
const isClaude=()=> doc.documentElement.dataset.claudeChatLook==='true'
const HERMES_DISCLOSURE_KEY='hermes.desktop.toolDisclosure.v1'
let hermesRaw=null,hermesOpen=new Set(),revealed=new Set()
const readHermesReveals=()=>{
let raw=null
try{raw=win.localStorage.getItem(HERMES_DISCLOSURE_KEY)}catch{}
if(raw===hermesRaw)return[]
hermesRaw=raw
let states=null
try{states=JSON.parse(raw || '{}')}catch{}
if(!states || typeof states !=='object')states={}
const now=new Set(Object.keys(states).filter(id=> states[id]===true))
const flipped=[...now].filter(id=> !hermesOpen.has(id))
hermesOpen=now
return flipped.map(id=> /^tool-entry:.*?:tool:(.+)$/.exec(id)?.[1]).filter(Boolean)
}
readHermesReveals()
const callsOf=block=>{
const key=Object.keys(block).find(name=> name.startsWith('__reactFiber$'))
let run=null
for(let fiber=key?block[key]:null,depth=0;fiber && depth < 40;fiber=fiber.return,depth++){
const props=fiber.memoizedProps
if(!run && props?.part?.toolName)return[props.part]
if(!run && props?.startIndex !=null && props?.endIndex !=null)run=props
if(run && typeof props?.value?.message==='function'){
try{return props.value.message().getState().parts.slice(run.startIndex,run.endIndex + 1).filter(part=> part.type==='tool-call')}catch{return[]}
}
}
return[]
}
const build=()=>{
const head=doc.createElement('div')
head.dataset.claudeToolStack=''
const button=doc.createElement('button')
button.type='button'
const label=doc.createElement('span')
label.dataset.claudeToolStackLabel=''
const time=doc.createElement('span')
time.dataset.claudeToolStackTime=''
time.hidden=true
const diff=doc.createElement('span')
diff.dataset.claudeToolStackDiff=''
const caret=doc.createElement('i')
caret.setAttribute('aria-hidden','true')
caret.className='codicon codicon-triangle-right'
button.append(label,time,diff,caret)
button.addEventListener('click',()=>{
const ids=head.claudeStackIds ||[]
if(ids.some(id=> opened.has(id)))for(const id of ids)opened.delete(id)
else for(const id of ids)opened.add(id)
saveOpened()
placeIn(head.parentElement)
})
head.append(button)
return head
}
const LIVE=".shimmer, [data-tool-ticker], .glyph-spinner, [aria-label='Running']"
const unmark=member=>{member.removeAttribute('data-claude-stack');member.removeAttribute('data-claude-stack-first');member.removeAttribute('data-claude-stack-last')}
const liveTitle=block=>{
const summary=block.querySelector('[data-tool-summary] .shimmer')
if(summary)return summary.textContent.trim()
const verb=block.querySelector('.shimmer')
if(verb?.parentElement)return verb.parentElement.textContent.trim()
const button=block.querySelector('button[aria-expanded]')
if(!button)return ''
const title=button.cloneNode(true)
for(const noise of title.querySelectorAll(".glyph-spinner, [role='status'], [aria-hidden='true'], .tabular-nums"))noise.remove()
return title.textContent.trim()
}
const liveSeconds=block=>[...block.querySelectorAll('.tabular-nums')].map(el=> el.textContent.trim()).findLast(text=> /^(\d+s|\d+:\d\d)$/.test(text))|| ''
const render=(head,calls,liveBlock,last)=>{
const label=head.querySelector('[data-claude-tool-stack-label]')
const blocked=Boolean(liveBlock && last && doc.querySelector("[data-slot='tool-approval-card']:not([inert])"))
const liveText=blocked?'Needs your input':liveBlock?liveTitle(liveBlock):''
const clauses=liveText?[]:claudeToolStackClauses(calls)
const counts=liveText?{added:0,removed:0}:claudeToolStackDiffCounts(calls)
const seconds=liveBlock && !blocked?liveSeconds(liveBlock):''
const time=head.querySelector('[data-claude-tool-stack-time]')
if(time.textContent !==seconds){time.textContent=seconds;time.hidden=!seconds}
const key=JSON.stringify([liveText,clauses,counts])
if(head.claudeStackKey===key)return
head.claudeStackKey=key
head.toggleAttribute('data-live',Boolean(liveBlock))
label.replaceChildren()
if(liveBlock){
const spinner=doc.createElement('span')
spinner.dataset.claudeToolStackSpinner=''
label.append(spinner,liveText)
}
clauses.forEach((clause,index)=>{
const part=doc.createElement('span')
part.dataset.claudeToolStackClause=''
part.toggleAttribute('data-error',Boolean(clause.isError))
const meta=doc.createElement('span')
meta.textContent=clause.meta
if(clause.file){meta.dataset.claudeToolStackFile='';meta.title=clause.file}
part.append(clause.verb + ' ',meta,index < clauses.length - 1?', ':'')
label.append(part)
})
const diff=head.querySelector('[data-claude-tool-stack-diff]')
diff.replaceChildren()
if(counts.added){const add=doc.createElement('span');add.dataset.add='';add.textContent='+' + counts.added;diff.append(add)}
if(counts.removed){const del=doc.createElement('span');del.dataset.del='';del.textContent='−' + counts.removed;diff.append(del)}
diff.hidden=!counts.added && !counts.removed
}
const placeIn=content=>{
if(!content?.isConnected)return
const kept=new Set()
const gather=members=>{
if(!members.length)return
const calls=members.flatMap(member=> member.claudeStackCalls)
const ids=calls.map(call=> call.toolCallId).filter(Boolean)
if(!ids.length)return
let head=members[0].previousElementSibling
if(!head?.hasAttribute('data-claude-tool-stack')){head=build();members[0].before(head)}
let open=ids.some(id=> opened.has(id))
if(!open && ids.some(id=> revealed.has(id))){
for(const id of ids)opened.add(id)
saveOpened()
open=true
}
head.dataset.claudeToolStack=ids[0]
head.claudeStackIds=ids
const live=members.findLast(member=> member.querySelector(LIVE))
render(head,calls,live,live===members.at(-1))
if(head.firstElementChild.getAttribute('aria-expanded')!==String(open))head.firstElementChild.setAttribute('aria-expanded',String(open))
kept.add(head)
members.forEach((member,index)=>{
if(member.dataset.claudeStack !==(open?'open':'closed'))member.dataset.claudeStack=open?'open':'closed'
member.toggleAttribute('data-claude-stack-first',index===0)
member.toggleAttribute('data-claude-stack-last',index===members.length - 1)
if(!open)member.claudeStackUnfolded=false
const fold=open && !member.claudeStackUnfolded && member.querySelector(":scope > [data-tool-summary] button[aria-expanded='false']")
if(fold){member.claudeStackUnfolded=true;fold.click()}
kept.add(member)
})
}
if(isClaude()){
let blocks=[]
for(const child of content.children){
if(child.hasAttribute('data-claude-tool-stack'))continue
const tool=child.matches('[data-tool-group], [data-tool-row]')
if(tool && !child.textContent.trim())continue
const calls=tool?callsOf(child):[]
if(calls.length && !calls.some(call=> CLAUDE_STACK_KEEP.has(call.toolName))){child.claudeStackCalls=calls;blocks.push(child);continue}
if(!blocks.length || !child.checkVisibility())continue
gather(blocks)
blocks=[]
}
gather(blocks)
}
for(const head of content.querySelectorAll(':scope > [data-claude-tool-stack]'))if(!kept.has(head))head.remove()
for(const member of content.querySelectorAll(':scope > [data-claude-stack]'))if(!kept.has(member))unmark(member)
}
const CONTENT="[data-slot='aui_assistant-message-content']"
const WATCHED=CONTENT + ", [data-slot='tool-approval-card']"
const dirty=new Set()
let everything=true
const place=()=>{
frame=0
if(disposed)return
revealed=new Set(readHermesReveals())
if(revealed.size)everything=true
const contents=everything?doc.querySelectorAll(CONTENT):[...dirty]
if(everything && !isClaude()){
for(const head of doc.querySelectorAll('[data-claude-tool-stack]'))head.remove()
for(const member of doc.querySelectorAll('[data-claude-stack]'))unmark(member)
}
everything=false
dirty.clear()
for(const content of contents)placeIn(content)
revealed.clear()
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const onReveal=event=>{if(event.target?.closest?.('[data-approval-activity]'))schedule()}
doc.addEventListener('click',onReveal)
const IGNORED=".xterm, [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea, [data-claude-tool-stack]"
const observer=new win.MutationObserver(records=>{
let changed=false
for(const record of records){
const node=record.target.nodeType===1?record.target:record.target.parentElement
if(!node || node.closest(IGNORED))continue
const content=node.closest(CONTENT)
if(content)dirty.add(content)
else if([...record.addedNodes,...record.removedNodes].some(added=> added.nodeType===1 &&(added.matches(WATCHED)|| added.querySelector(WATCHED))))everything=true
else continue
changed=true
}
if(changed)schedule()
})
observer.observe(doc.body,{childList:true,subtree:true,characterData:true})
const themeObserver=new win.MutationObserver(()=>{everything=true;schedule()})
themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-claude-chat-look']})
place()
return()=>{
disposed=true
observer.disconnect()
themeObserver.disconnect()
doc.removeEventListener('click',onReveal)
if(frame)win.cancelAnimationFrame(frame)
for(const head of doc.querySelectorAll('[data-claude-tool-stack]'))head.remove()
for(const member of doc.querySelectorAll('[data-claude-stack]'))unmark(member)
}
}
function installClaudeToolPayload({document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.body || !win)return()=>{}
let frame=0,disposed=false
const isClaude=()=> doc.documentElement.dataset.claudeChatLook==='true'
const render=(pre,data)=>{
const view=doc.createElement('div')
view.dataset.claudePayload=''
view.setAttribute('aria-label',data.label)
const well=doc.createElement('div')
well.dataset.claudePayloadWell=''
const copy=doc.createElement('button')
copy.type='button'
copy.dataset.claudePayloadCopy=''
copy.setAttribute('aria-label','Copy')
copy.innerHTML='<i aria-hidden="true" class="codicon codicon-copy"></i>'
copy.addEventListener('click',event=>{
event.stopPropagation()
win.navigator?.clipboard?.writeText((data.prompt?'$ ':'')+ data.body +(data.output?'\n\n' + data.output:'')).then(()=>{
copy.querySelector('i').className='codicon codicon-check'
copy.setAttribute('aria-label','Copied')
win.setTimeout(()=>{copy.querySelector('i').className='codicon codicon-copy';copy.setAttribute('aria-label','Copy')},1200)
},()=>{})
})
const code=doc.createElement('pre')
code.dataset.claudePayloadCode=''
if(data.prompt){
const mark=doc.createElement('span')
mark.dataset.claudePayloadPrompt=''
mark.textContent='$ '
code.append(mark)
}
for(const[kind,part]of claudeHighlight(data.body,data.prompt)){
if(!kind){code.append(part);continue}
const run=doc.createElement('span')
run.dataset.t=kind
run.textContent=part
code.append(run)
}
well.append(code,copy)
view.append(well)
if(data.exit !=null){
const exit=doc.createElement('div')
exit.dataset.claudePayloadExit=''
exit.toggleAttribute('data-failed',String(data.exit)!=='0')
exit.textContent='Exit code ' + data.exit
view.append(exit)
}
if(data.output){
const out=doc.createElement('pre')
out.dataset.claudePayloadOut=''
out.textContent=data.output
view.append(out)
}else if(data.done){
const empty=doc.createElement('div')
empty.dataset.claudePayloadEmpty=''
empty.textContent='No output'
view.append(empty)
}
return view
}
const FOLDED_KEY='claude-chat-look.foldedFileEdits'
const store=key=>{try{return JSON.parse(win.localStorage.getItem(key)|| 'null')}catch{return null}}
const folded=new Set(Array.isArray(store(FOLDED_KEY))?store(FOLDED_KEY):[])
const partOf=row=>{
const key=Object.keys(row).find(name=> name.startsWith('__reactFiber$'))
for(let fiber=key?row[key]:null,depth=0;fiber && depth < 6;fiber=fiber.return,depth++)if(fiber.memoizedProps?.part)return fiber.memoizedProps.part
return null
}
const foldOnce=row=>{
const id=partOf(row)?.toolCallId
if(!id || folded.has(id))return
folded.add(id)
try{win.localStorage.setItem(FOLDED_KEY,JSON.stringify([...folded].slice(-500)))}catch{}
const toggled=Object.keys(store('hermes.desktop.toolDisclosure.v1')||{}).some(name=> name.startsWith('tool-entry:')&& name.endsWith(':tool:' + id))
if(!toggled)row.firstElementChild?.querySelector('button[aria-expanded]')?.click()
}
const place=()=>{
frame=0
if(disposed)return
const claude=isClaude()
for(const row of doc.querySelectorAll('[data-claude-payload-opened]:not([data-tool-open])'))row.removeAttribute('data-claude-payload-opened')
if(!claude)for(const el of doc.querySelectorAll('[data-claude-payload-skip]'))el.removeAttribute('data-claude-payload-skip')
for(const row of doc.querySelectorAll('[data-tool-row][data-tool-open]')){
if(!claude)continue
const toggle=[...row.querySelectorAll('button[aria-expanded]')].find(b=> b !==row.querySelector('button[aria-expanded]')&& /payload/i.test(b.textContent))
if(row.hasAttribute('data-file-edit')){toggle?.parentElement?.setAttribute('data-claude-payload-skip','');foldOnce(row);continue}
if(toggle && toggle.getAttribute('aria-expanded')==='false' && !row.hasAttribute('data-claude-payload-opened')){
row.setAttribute('data-claude-payload-opened','')
toggle.click()
}
}
for(const host of doc.querySelectorAll("[data-claude-payload-host='product']")){
const row=host.closest('[data-tool-row]')
if(claude && row?.hasAttribute('data-tool-open')&& row.children[1]===host)continue
host.querySelector(':scope > [data-claude-payload]')?.remove()
host.removeAttribute('data-claude-payload-host')
}
if(claude)for(const row of doc.querySelectorAll('[data-tool-row][data-tool-open]:not([data-file-edit])')){
const host=row.children[1]
if(!host ||[...host.querySelectorAll('button[aria-expanded]')].some(b=> /payload/i.test(b.textContent)))continue
const data=claudeToolPartPayload(partOf(row))
if(!data)continue
const key=JSON.stringify(data)
const existing=host.querySelector(':scope > [data-claude-payload]')
if(existing?.claudeKey===key)continue
const view=render(null,data)
view.claudeKey=key
if(existing)existing.replaceWith(view)
else host.append(view)
host.setAttribute('data-claude-payload-host','product')
}
for(const panel of doc.querySelectorAll("[data-tool-row][data-file-edit] [data-slot='file-diff-panel']")){
const rows=panel.querySelectorAll("span[class*='border-l-2']")
if(!claude || !rows.length){if(panel.hasAttribute('data-claude-diff-numbered')){panel.removeAttribute('data-claude-diff-numbered');for(const row of rows)row.removeAttribute('data-claude-ln')}continue}
if(panel.hasAttribute('data-claude-diff-numbered')&&[...rows].every(row=> row.hasAttribute('data-claude-ln')))continue
const key=Object.keys(panel).find(name=> name.startsWith('__reactFiber$'))
let diff=null
for(let fiber=key?panel[key]:null,depth=0;fiber && depth < 8 && diff==null;fiber=fiber.return,depth++)if(typeof fiber.memoizedProps?.diff==='string')diff=fiber.memoizedProps.diff
const numbers=diff==null?[]:claudeDiffLineNumbers(diff)
if(numbers.length !==rows.length)continue
rows.forEach((row,index)=> row.setAttribute('data-claude-ln',String(numbers[index])))
panel.setAttribute('data-claude-diff-numbered','')
panel.style.setProperty('--claude-ln-width',Math.max(2,String(Math.max(0,...numbers.filter(Number))).length)+ 'ch')
}
for(const pre of doc.querySelectorAll('[data-tool-row][data-tool-open]:not([data-file-edit]) pre:not([data-claude-payload-code], [data-claude-payload-out])')){
const host=pre.parentElement
if(host.dataset.claudePayloadHost==='product')continue
const text=pre.textContent
const existing=host.querySelector(':scope > [data-claude-payload]')
if(!claude || !text.startsWith('Arguments:')){existing?.remove();host.removeAttribute('data-claude-payload-host');continue}
if(existing && existing.dataset.len===String(text.length))continue
const data=claudeToolPayload(text)
if(!data)continue
const view=render(pre,data)
view.dataset.len=String(text.length)
if(existing)existing.replaceWith(view)
else pre.after(view)
host.setAttribute('data-claude-payload-host','')
host.closest('[data-tool-row]')?.children[1]?.querySelector(":scope > button[class*='absolute']")?.setAttribute('data-claude-payload-skip','')
}
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true,characterData:true})
const themeObserver=new win.MutationObserver(schedule)
themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-hermes-theme','data-claude-chat-look']})
place()
return()=>{
disposed=true
observer.disconnect()
themeObserver.disconnect()
if(frame)win.cancelAnimationFrame(frame)
for(const el of doc.querySelectorAll('[data-claude-payload]'))el.remove()
for(const el of doc.querySelectorAll('[data-claude-payload-host]'))el.removeAttribute('data-claude-payload-host')
for(const el of doc.querySelectorAll('[data-claude-payload-skip]'))el.removeAttribute('data-claude-payload-skip')
for(const el of doc.querySelectorAll('[data-claude-ln]'))el.removeAttribute('data-claude-ln')
for(const el of doc.querySelectorAll('[data-claude-diff-numbered]')){el.removeAttribute('data-claude-diff-numbered');el.style.removeProperty('--claude-ln-width')}
}
}
const CLAUDE_CONTEXT_ITEM="[data-slot='statusbar'] button[data-slot='dropdown-menu-trigger']"
function claudeContextPercent(text){
if(!/\/\s*[\d.]+\s*[kKmMbB]/.test(text || ''))return null
const m=/(\d+(?:\.\d+)?)\s*%/.exec(text)
return m?Math.max(0,Math.min(100,Number(m[1]))):null
}
function claudeFocusedUsage(api){
try{
const usage=api?.state?.focusedUsage?.get?.()
return usage && typeof usage.context_percent==='number'?usage:null
}catch{return null}
}
function claudeTokens(n){
const num=Number(n)|| 0
const scaled=(value,unit)=> value.toFixed(1).replace(/\.0$/,'')+ unit
return num >=999950?scaled(num / 1e6,'M'):num >=999.5?scaled(num / 1e3,'k'):String(Math.max(0,Math.round(num)))
}
function claudeUsageExtras(api){
let usage=null
try{usage=api?.state?.focusedUsage?.get?.()|| null}catch{usage=null}
if(!usage)return[]
const rows=[]
if(usage.avg_tps > 0)rows.push(['Speed',Math.round(usage.avg_tps)+ ' t/s' +(usage.avg_latency_s > 0?' · ' + usage.avg_latency_s.toFixed(1)+ ' s per call':'')])
if(typeof usage.cache_hit_pct==='number'){
const read=usage.prompt > 0?Math.round(usage.cache_hit_pct / 100 * usage.prompt):0
rows.push(['Cache',Math.round(usage.cache_hit_pct)+ '% hit' +(read?' · ~' + claudeTokens(read)+ ' cached':'')])
}
return rows
}
function claudeUsageRows(doc,rows){
return rows.map(([name,value])=>{
const row=doc.createElement('div')
row.dataset.claudeUsageRow=''
const a=doc.createElement('span'),b=doc.createElement('span')
a.textContent=name
b.textContent=value
row.append(a,b)
return row
})
}
const CLAUDE_VOICE_TIPS={
'Voice dictation':['Voice dictation','Click to dictate into your message'],
'Stop dictation':['Stop dictation','Click to stop and transcribe'],
'Start voice conversation':['Start voice conversation',null],
'Voice chat engine':['Voice chat engine','Choose how voice conversations run']
}
function installClaudeVoiceTips({document:doc=globalThis.document,window:win=globalThis.window}={}){
const selector=Object.keys(CLAUDE_VOICE_TIPS).map(label=> "[data-slot='composer-root'] button[aria-label='" + label + "']").join(', ')+ ", [data-slot='composer-root'] button[data-claude-context-ring]"
let tip=null,current=null,timer=0,frame=0
const hide=()=>{
win.clearTimeout(timer)
if(frame)win.cancelAnimationFrame(frame)
frame=0
current=null
if(tip)tip.hidden=true
doc.querySelectorAll('[data-claude-tip-replaced]').forEach(node=> node.removeAttribute('data-claude-tip-replaced'))
}
const muffle=()=>{
frame=0
if(!current)return
const id=current.getAttribute('aria-describedby')
const native=id && doc.getElementById(id)
if(native && !native.hasAttribute('data-claude-tip-replaced'))native.setAttribute('data-claude-tip-replaced','')
place(current)
frame=win.requestAnimationFrame(muffle)
}
const show=button=>{
if(!button.isConnected || button.disabled)return
const[title,fixed]=button.hasAttribute('data-claude-context-ring')?['Context window',button.dataset.claudeTip || '0% used']:CLAUDE_VOICE_TIPS[button.getAttribute('aria-label')]||[]
if(!title)return
let sub=fixed
if(!sub){
const id=button.getAttribute('aria-describedby')
const engine=(id && doc.getElementById(id)?.textContent.split('—')[1]?.trim())|| ''
sub=engine?'Talk with Hermes · ' + engine:'Talk with Hermes out loud'
}
if(!tip){
tip=doc.createElement('div')
tip.setAttribute('data-claude-voice-tip','')
tip.setAttribute('role','tooltip')
tip.append(doc.createElement('strong'),doc.createElement('span'))
doc.body.append(tip)
}
tip.firstChild.textContent=title
tip.lastChild.textContent=sub
tip.hidden=false
place(button)
}
const place=button=>{
if(!tip || tip.hidden)return
const box=button.getBoundingClientRect()
const width0=tip.offsetWidth,height0=tip.offsetHeight
let top=box.top
const fanned=button.closest("[data-slot='fan-menu-anchor']")?doc.querySelectorAll("[data-slot='fan-menu'][data-state='open'] button")
:button.matches("[aria-label='Start voice conversation']")?doc.querySelectorAll("[role='menu'][aria-labelledby='" +(button.closest('[data-claude-has~=child-start-voice]')?.querySelector("button[aria-label='Voice chat engine']")?.id || '-')+ "']"):[]
for(const node of fanned){
const rect=node.getBoundingClientRect()
if(rect.height > 0 && rect.top < top && node.checkVisibility({opacityProperty:true,visibilityProperty:true}))top=rect.top
}
const width=tip.offsetWidth,height=tip.offsetHeight
const left=Math.round(Math.max(8,Math.min(win.innerWidth - width - 8,box.left + box.width / 2 - width / 2)))+ 'px'
const y=Math.round(Math.max(8,top - height - 8))+ 'px'
if(tip.style.left !==left)tip.style.left=left
if(tip.style.top !==y)tip.style.top=y
}
const onOver=event=>{
const button=event.target?.closest?.(selector)
if(!button){if(current && !current.contains(event.target))hide();return}
if(button===current)return
hide()
current=button
frame=win.requestAnimationFrame(muffle)
timer=win.setTimeout(()=>{if(current===button)show(button)},button.hasAttribute('data-claude-context-ring')?500:350)
}
const onAway=event=>{if(event.isTrusted && current &&(event.type !=='pointerout' || !current.contains(event.relatedTarget)))hide()}
doc.addEventListener('pointerover',onOver,true)
doc.addEventListener('pointerout',onAway,true)
doc.addEventListener('pointerdown',onAway,true)
win.addEventListener('blur',hide)
return()=>{
hide()
tip?.remove()
doc.removeEventListener('pointerover',onOver,true)
doc.removeEventListener('pointerout',onAway,true)
doc.removeEventListener('pointerdown',onAway,true)
win.removeEventListener('blur',hide)
}
}
const CLAUDE_HEADER_TIP_KEYS={terminal:['view.showTerminal','ctrl+`'],diff:['view.toggleReview','mod+g'],globe:['view.showBrowser','mod+shift+l'],folder:['view.toggleRightSidebar',null],'history-back':[null,'alt+left','mod+['],'history-forward':[null,'alt+right','mod+]']}
function claudeKeybind(win,action,fallback){
const mac=/Mac/i.test(win.navigator?.platform || '')
let own=null
try{own=JSON.parse(win.localStorage.getItem('hermes.desktop.keybinds')|| '{}')[action]}catch{own=null}
const value=Array.isArray(own)?own[0]:typeof own==='string'?own:fallback
if(!value)return[]
return value.split('+').map(part=> part==='mod'?(mac?'⌘':'Ctrl'):part==='shift'?(mac?'⇧':'Shift'):part==='alt'?(mac?'⌥':'Alt'):part==='ctrl'?(mac?'⌃':'Ctrl'):part==='left'?'←':part==='right'?'→':part.length===1?part.toUpperCase():part)
}
function installClaudeHeaderTips({document:doc=globalThis.document,window:win=globalThis.window}={}){
const selector="[data-claude-pane-tool], [data-claude-terminal-header] button[aria-label], button[data-claude-terminal-header][aria-label], [data-claude-backend-dock], [data-zone-tabstrip='grp-sessions'] [role='tab'], [data-claude-sidebar-history] > button, [data-claude-title-chevron], [data-claude-title-rename]"
let tip=null,current=null,stashed=null,timer=0,lastShown=-Infinity
const combo=button=>{
const tool=button.getAttribute('data-claude-pane-tool')||(button.dataset.claudeHistory?'history-' + button.dataset.claudeHistory:null)
const[action,fallback,macFallback]=CLAUDE_HEADER_TIP_KEYS[tool]||[]
const keys=macFallback && /Mac/i.test(win.navigator?.platform || '')?macFallback:fallback
return action || keys?claudeKeybind(win,action,keys):[]
}
const tipText=button=>{
if(button.hasAttribute('data-claude-title-rename'))return button.scrollWidth > button.clientWidth?button.textContent.trim():'Rename'
return button.getAttribute('data-claude-tip')|| button.getAttribute('aria-label')|| stashed || button.textContent.trim()
}
const restore=()=>{
if(current && stashed !==null && !current.hasAttribute('title'))current.setAttribute('title',stashed)
stashed=null
}
const hide=()=>{
win.clearTimeout(timer)
restore()
current=null
if(tip && !tip.hidden){tip.hidden=true;lastShown=win.performance.now()}
}
const show=button=>{
if(!button.isConnected)return
const label=tipText(button)
if(!label)return
if(!tip){
tip=doc.createElement('div')
tip.setAttribute('data-claude-header-tip','')
tip.setAttribute('role','tooltip')
doc.body.append(tip)
}
tip.toggleAttribute('data-claude-tip-wrap',button.hasAttribute('data-claude-title-rename')|| button.hasAttribute('data-claude-title-chevron'))
tip.replaceChildren(doc.createTextNode(label))
const note=button.getAttribute('data-claude-tip-note')
if(note){
const quiet=doc.createElement('span')
quiet.textContent=note
tip.append(quiet)
}
for(const key of combo(button)){
const chip=doc.createElement('kbd')
chip.textContent=key
tip.append(chip)
}
tip.hidden=false
const box=button.getBoundingClientRect()
const width=tip.offsetWidth,height=tip.offsetHeight
const below=box.bottom + height + 8 < win.innerHeight
tip.style.left=Math.round(Math.max(8,Math.min(win.innerWidth - width - 8,box.left + box.width / 2 - width / 2)))+ 'px'
tip.style.top=Math.round(below?box.bottom + 4:box.top - height - 4)+ 'px'
}
const onOver=event=>{
const button=event.target?.closest?.(selector)
if(!button){if(current && !current.contains(event.target))hide();return}
if(button===current)return
hide()
current=button
if(button.hasAttribute('title')){stashed=button.getAttribute('title');button.removeAttribute('title')}
if(win.performance.now()- lastShown < 400)return show(button)
timer=win.setTimeout(()=>{if(current===button)show(button)},300)
}
const onAway=event=>{if(current &&(event.type !=='pointerout' || !current.contains(event.relatedTarget)))hide()}
doc.addEventListener('pointerover',onOver,true)
doc.addEventListener('pointerout',onAway,true)
doc.addEventListener('pointerdown',onAway,true)
win.addEventListener('blur',hide)
return()=>{
hide()
tip?.remove()
doc.removeEventListener('pointerover',onOver,true)
doc.removeEventListener('pointerout',onAway,true)
doc.removeEventListener('pointerdown',onAway,true)
win.removeEventListener('blur',hide)
}
}
function installClaudeSidebarHistory({document:doc=globalThis.document,window:win=globalThis.window}={}){
let group=null,frame=0,disposed=false
const nav=win.navigation
const arrow=(dir,label)=>{
const element=doc.createElement('button')
element.type='button'
element.setAttribute('aria-label',label)
element.dataset.claudeHistory=dir
const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg')
svg.setAttribute('viewBox','0 0 16 16')
svg.setAttribute('fill','none')
svg.setAttribute('stroke','currentColor')
svg.setAttribute('stroke-width','1.4')
svg.setAttribute('stroke-linecap','round')
svg.setAttribute('stroke-linejoin','round')
svg.setAttribute('aria-hidden','true')
const path=doc.createElementNS('http://www.w3.org/2000/svg','path')
path.setAttribute('d',dir==='back'?'M10 3.5 5.5 8 10 12.5':'M6 3.5 10.5 8 6 12.5')
svg.append(path)
element.append(svg)
element.addEventListener('pointerdown',event=> event.stopPropagation())
element.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(dir==='back')win.history.back();else win.history.forward();schedule()})
return element
}
const place=()=>{
frame=0
if(disposed)return
const strip=doc.querySelector("[data-zone-tabstrip='grp-sessions']")
if(!strip)return
if(!group){
group=doc.createElement('span')
group.dataset.claudeSidebarHistory=''
group.append(arrow('back','Back'),arrow('forward','Forward'))
}
if(group.parentElement !==strip)strip.append(group)
const[back,forward]=group.children
const canBack=nav?Boolean(nav.canGoBack):true,canForward=nav?Boolean(nav.canGoForward):true
if(back.disabled===canBack)back.disabled=!canBack
if(forward.disabled===canForward)forward.disabled=!canForward
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true})
const userBound=chord=>{
try{return Object.values(JSON.parse(win.localStorage.getItem('hermes.desktop.keybinds')|| '{}')).some(value=>(Array.isArray(value)?value:[value]).includes(chord))}catch{return false}
}
const onKey=event=>{
if(event.defaultPrevented || event.repeat || doc.documentElement.getAttribute('data-claude-chat-look')!=='true')return
const mac=/Mac/i.test(win.navigator?.platform || '')
const dir=mac
?(event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey?{'[':'back',']':'forward'}[event.key]:null)
:(event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey?{ArrowLeft:'back',ArrowRight:'forward'}[event.key]:null)
if(!dir)return
if(event.target?.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable=''], .cm-editor, .xterm"))return
if(userBound(mac?(dir==='back'?'mod+[':'mod+]'):(dir==='back'?'alt+left':'alt+right')))return
const button=group?.querySelector(`[data-claude-history='${dir}']`)
if(!button?.isConnected || button.disabled)return
event.preventDefault()
event.stopPropagation()
button.click()
}
win.addEventListener('keydown',onKey,true)
nav?.addEventListener?.('currententrychange',schedule)
win.addEventListener('popstate',schedule)
place()
return()=>{
disposed=true
observer.disconnect()
if(frame)win.cancelAnimationFrame(frame)
win.removeEventListener('keydown',onKey,true)
nav?.removeEventListener?.('currententrychange',schedule)
win.removeEventListener('popstate',schedule)
group?.remove()
}
}
function installClaudeTitlebarState({document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.documentElement || !win)return()=>{}
const root=doc.documentElement
let disposed=false,focusTimer=0
const isClaude=()=> root.getAttribute('data-claude-chat-look')==='true'
const mark=(name,on)=>{on=on && isClaude()&& !disposed;if(root.hasAttribute(name)!==on)root.toggleAttribute(name,on)}
const syncFocus=()=>{focusTimer=0;mark('data-claude-window-inactive',!doc.hasFocus())}
const onBlur=()=>{if(!focusTimer)focusTimer=win.setTimeout(syncFocus,0)}
const onFocus=()=> mark('data-claude-window-inactive',false)
const onLook=()=>{if(!isClaude())mark('data-claude-window-inactive',false);else syncFocus()}
const lookObserver=new win.MutationObserver(onLook)
lookObserver.observe(root,{attributes:true,attributeFilter:['data-claude-chat-look']})
win.addEventListener('blur',onBlur)
win.addEventListener('focus',onFocus)
syncFocus()
return()=>{
disposed=true
lookObserver.disconnect()
win.clearTimeout(focusTimer)
win.removeEventListener('blur',onBlur)
win.removeEventListener('focus',onFocus)
root.removeAttribute('data-claude-window-inactive')
}
}
function installClaudeSidebarPeek({document:doc=globalThis.document,window:win=globalThis.window}={}){
const EDGE=8,LEAVE_MS=180
const root=doc.documentElement
let frame=0,disposed=false,peeking=false,peekSince=0,ours=false,overToggle=false,openTimer=0,closeTimer=0,leaveTimer=0,edgeTimer=0,toggle=null,shell=null,hoverZone=null
const zone=()=> doc.querySelector("[data-tree-group='grp-sessions']")
const railed=()=> /(^|\s)1\.75rem$/.test((shell?.style.flexBasis || '').trim())
const hidden=()=> shell?.style.display==='none'
const folded=()=> railed()|| hidden()
const findToggle=()=> doc.querySelector("[data-titlebar-cluster] button:has(i[class~='codicon-layout-sidebar-left'])")
const press=()=>{ours=true;try{toggle?.click()}finally{ours=false}}
const remeasure=()=> win.dispatchEvent(new win.CustomEvent('hermes:titlebar-chrome-changed'))
const isClaude=()=> root.dataset.claudeChatLook==='true'
const setPeek=on=>{
peeking=on
peekSince=on?Date.now():0
if(!on)cancelLeave()
if(root.hasAttribute('data-claude-sidebar-peek')!==on)root.toggleAttribute('data-claude-sidebar-peek',on)
if(on){doc.addEventListener('pointermove',onMove,true);root.addEventListener('pointerleave',onWindowLeave)}
else{doc.removeEventListener('pointermove',onMove,true);root.removeEventListener('pointerleave',onWindowLeave)}
}
const setHovered=on=>{if(root.hasAttribute('data-claude-sidebar-hovered')!==on)root.toggleAttribute('data-claude-sidebar-hovered',on)}
const onZoneEnter=()=> setHovered(isClaude())
const onZoneLeave=()=> setHovered(false)
const place=()=>{
frame=0
if(disposed)return
const group=zone()
if(group !==hoverZone){
hoverZone?.removeEventListener('pointerenter',onZoneEnter)
hoverZone?.removeEventListener('pointerleave',onZoneLeave)
hoverZone=group
hoverZone?.addEventListener('pointerenter',onZoneEnter)
hoverZone?.addEventListener('pointerleave',onZoneLeave)
setHovered(false)
}
if(!isClaude())setHovered(false)
const next=findToggle()
if(next !==toggle){
toggle?.removeAttribute('data-claude-sidebar-toggle')
toggle?.removeEventListener('pointerenter',onEnter)
toggle?.removeEventListener('pointerleave',onToggleLeave)
toggle=next
toggle?.setAttribute('data-claude-sidebar-toggle','')
toggle?.addEventListener('pointerenter',onEnter)
toggle?.addEventListener('pointerleave',onToggleLeave)
}
const column=group?.parentElement?.parentElement?.matches?.('[data-tree-split]')?group.parentElement:null
if(column !==shell){
shell?.removeEventListener('animationend',remeasure)
shell?.removeAttribute('data-claude-sidebar-shell')
shell=column
shell?.setAttribute('data-claude-sidebar-shell','')
shell?.addEventListener('animationend',remeasure)
shellObserver.disconnect()
if(shell)shellObserver.observe(shell,{attributes:true,attributeFilter:['style']})
}
const box=shell && !railed()?shell.getBoundingClientRect():null
const flipped=Boolean(box?.width)&& box.left > 1
if(root.hasAttribute('data-claude-sidebar-flipped')!==flipped){
root.toggleAttribute('data-claude-sidebar-flipped',flipped)
remeasure()
}
if(!peeking)return
if(!shell ||(folded()&& Date.now()- peekSince > 400))setPeek(false)
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const shellObserver=new win.MutationObserver(()=> schedule())
const isFolded=()=> Boolean(shell)&& folded()
const onLeft=()=>{
const main=doc.querySelector("[data-tree-group='grp-main']")
return Boolean(shell && main)&& Boolean(shell.compareDocumentPosition(main)& win.Node.DOCUMENT_POSITION_FOLLOWING)
}
const onEnter=()=>{
overToggle=true
win.clearTimeout(closeTimer)
if(peeking || !isFolded()|| !onLeft())return
win.clearTimeout(openTimer)
openTimer=win.setTimeout(()=>{
if(disposed || peeking || !isFolded()|| !overToggle)return
setPeek(true)
press()
},80)
}
const onToggleLeave=()=>{overToggle=false;win.clearTimeout(openTimer)}
const held=()=> Boolean(doc.querySelector("[data-radix-popper-content-wrapper]:not(:has([role='tooltip'])), [role='menu'], [role='dialog']"))
const inside=event=>{
const target=event.target
if(target?.closest?.('[data-claude-sidebar-shell], [data-claude-sidebar-toggle], [data-radix-popper-content-wrapper], [data-claude-account-menu]'))return true
const box=shell?.getBoundingClientRect()
return Boolean(box)&& event.clientX >=box.left && event.clientX <=box.right && event.clientY >=box.top && event.clientY <=box.bottom
}
const cancelLeave=()=>{
if(leaveTimer)win.clearTimeout(leaveTimer)
leaveTimer=0
root.removeAttribute('data-claude-sidebar-peek-leaving')
}
const foldNow=()=>{
win.clearTimeout(closeTimer)
closeTimer=0
if(disposed || !peeking)return
setPeek(false)
if(!folded())press()
}
const fold=()=>{
win.clearTimeout(closeTimer)
closeTimer=0
if(disposed || !peeking || leaveTimer)return
if(held()){closeTimer=win.setTimeout(fold,250);return}
root.setAttribute('data-claude-sidebar-peek-leaving','')
leaveTimer=win.setTimeout(()=>{leaveTimer=0;foldNow()},LEAVE_MS)
}
const onMove=event=>{
if(!peeking)return
if(inside(event)|| event.buttons){win.clearTimeout(closeTimer);closeTimer=0;cancelLeave();return}
if(!closeTimer && !leaveTimer)closeTimer=win.setTimeout(()=>{closeTimer=0;fold()},250)
}
const onWindowLeave=()=>{if(peeking && !closeTimer && !leaveTimer)closeTimer=win.setTimeout(()=>{closeTimer=0;fold()},250)}
const onBlur=()=>{if(peeking)foldNow()}
win.addEventListener('blur',onBlur)
const onEdge=event=>{
if(peeking || event.buttons || event.clientX > EDGE || !isClaude()){
if(edgeTimer){win.clearTimeout(edgeTimer);edgeTimer=0}
return
}
if(edgeTimer || !isFolded()|| !onLeft())return
edgeTimer=win.setTimeout(()=>{
edgeTimer=0
if(disposed || peeking || !isFolded())return
setPeek(true)
press()
},80)
}
doc.addEventListener('pointermove',onEdge,{capture:true,passive:true})
const onKey=event=>{
if(event.key !=='Escape' || event.defaultPrevented || !peeking || held())return
const at=doc.activeElement
if(!at?.closest?.('[data-claude-sidebar-shell], [data-claude-sidebar-toggle]')|| at.closest("input, textarea, [contenteditable='true']"))return
event.preventDefault()
event.stopPropagation()
foldNow()
toggle?.focus({preventScroll:true})
}
doc.addEventListener('keydown',onKey)
const onClick=event=>{
if(ours || !peeking || !event.target?.closest?.('[data-claude-sidebar-toggle]'))return
event.preventDefault()
event.stopPropagation()
win.clearTimeout(closeTimer)
closeTimer=0
setPeek(false)
}
doc.addEventListener('click',onClick,true)
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-slot='statusbar'], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true})
place()
return()=>{
disposed=true
observer.disconnect()
shellObserver.disconnect()
doc.removeEventListener('click',onClick,true)
doc.removeEventListener('pointermove',onEdge,{capture:true})
doc.removeEventListener('keydown',onKey)
win.clearTimeout(openTimer)
win.clearTimeout(closeTimer)
win.clearTimeout(edgeTimer)
if(frame)win.cancelAnimationFrame(frame)
win.removeEventListener('blur',onBlur)
if(peeking){setPeek(false);if(!folded())press()}
cancelLeave()
hoverZone?.removeEventListener('pointerenter',onZoneEnter)
hoverZone?.removeEventListener('pointerleave',onZoneLeave)
root.removeAttribute('data-claude-sidebar-hovered')
root.removeAttribute('data-claude-sidebar-flipped')
toggle?.removeAttribute('data-claude-sidebar-toggle')
toggle?.removeEventListener('pointerenter',onEnter)
toggle?.removeEventListener('pointerleave',onToggleLeave)
shell?.removeEventListener('animationend',remeasure)
shell?.removeAttribute('data-claude-sidebar-shell')
}
}
function installClaudeSidebarScrollFade({document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.documentElement || !win)return()=>{}
const marked=new Set()
const onScroll=event=>{
const node=event.target
if(node?.nodeType !==1 || !node.closest("[data-tour='sessions-sidebar']"))return
const on=doc.documentElement.dataset.claudeChatLook==='true' && node.scrollTop > 0
if(node.hasAttribute('data-claude-scrolled')===on)return
node.toggleAttribute('data-claude-scrolled',on)
for(const old of marked)if(!old.isConnected)marked.delete(old)
if(on)marked.add(node)
else marked.delete(node)
}
const clear=()=>{
for(const node of marked)node.removeAttribute('data-claude-scrolled')
marked.clear()
}
const look=new win.MutationObserver(()=>{if(doc.documentElement.dataset.claudeChatLook !=='true')clear()})
look.observe(doc.documentElement,{attributes:true,attributeFilter:['data-claude-chat-look']})
doc.addEventListener('scroll',onScroll,{capture:true,passive:true})
return()=>{
look.disconnect()
doc.removeEventListener('scroll',onScroll,{capture:true})
clear()
}
}
function installClaudeVoiceEngineHover({document:doc=globalThis.document,window:win=globalThis.window}={}){
const PAIR="[data-slot='composer-root'] span[data-claude-has~='child-start-voice']"
let pair=null,openTimer=0,closeTimer=0
const chevron=()=> pair?.querySelector("button[aria-label='Voice chat engine']")
const menu=()=>{const id=chevron()?.id;return id?doc.querySelector("[role='menu'][aria-labelledby='" + id + "']"):null}
const press=target=> target.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,pointerType:'mouse',isPrimary:true}))
const open=()=>{
openTimer=0
const trigger=chevron()
if(!trigger || trigger.disabled || menu())return
press(trigger)
}
const shut=()=>{
closeTimer=0
if(menu())press(doc.body)
}
const onOver=event=>{
const hit=event.target?.closest?.(PAIR)
const inMenu=Boolean(menu()?.contains(event.target))
if(hit || inMenu){
if(hit)pair=hit
win.clearTimeout(closeTimer);closeTimer=0
if(hit && !menu()&& !openTimer)openTimer=win.setTimeout(open,150)
return
}
if(openTimer){win.clearTimeout(openTimer);openTimer=0}
if(pair && menu()&& !closeTimer)closeTimer=win.setTimeout(shut,250)
}
doc.addEventListener('pointerover',onOver,true)
return()=>{
win.clearTimeout(openTimer)
win.clearTimeout(closeTimer)
doc.removeEventListener('pointerover',onOver,true)
}
}
function installClaudeToastEscape({document:doc=globalThis.document}={}){
const onKey=event=>{
if(event.key !=='Escape' || event.defaultPrevented || event.isComposing)return
if(doc.documentElement.getAttribute('data-claude-chat-look')!=='true')return
const surface=event.target?.closest?.("[role='region'] [data-slot='card-stack-surface']")
const dismiss=surface?.querySelector(":scope > div > [data-slot='alert'] > button:last-child, :scope > [data-slot='alert'] > button:last-child")
if(!dismiss || dismiss.disabled)return
event.preventDefault()
dismiss.click()
}
doc.addEventListener('keydown',onKey,true)
return()=> doc.removeEventListener('keydown',onKey,true)
}
function installClaudeComposerBox({document:doc=globalThis.document,window:win=globalThis.window}={}){
let fade=null,box=null,row=null,disposed=false
const setVar=(node,name,value)=>{if(node.style.getPropertyValue(name)!==value)node.style.setProperty(name,value)}
const measure=()=>{
if(disposed || !fade)return
if(box)setVar(fade,'--claude-composer-box-h',(Math.round(box.getBoundingClientRect().height * 100)/ 100)+ 'px')
const attached=Boolean(row && row.childElementCount > 0)
if(fade.hasAttribute('data-claude-attached')!==attached)fade.toggleAttribute('data-claude-attached',attached)
if(attached)setVar(fade,'--claude-attach-h',(Math.round(row.getBoundingClientRect().height * 100)/ 100)+ 'px')
const queued=Boolean(fade.querySelector("button[aria-label='Queue message']"))
if(fade.hasAttribute('data-claude-queue')!==queued)fade.toggleAttribute('data-claude-queue',queued)
}
const resize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(measure):null
const children=new win.MutationObserver(measure)
const find=()=>{
if(disposed)return
const nextFade=doc.querySelector("[data-slot='composer-root'] [data-slot='composer-fade']")
const nextBox=nextFade?.querySelector(":scope > div:last-child > div:has([data-slot='composer-rich-input'])")|| null
const nextRow=nextFade?.querySelector(":scope > [data-slot='composer-attachments']")|| null
if(nextFade===fade && nextBox===box && nextRow===row){measure();return}
if(fade && fade !==nextFade){fade.removeAttribute('data-claude-attached');fade.style.removeProperty('--claude-composer-box-h');fade.style.removeProperty('--claude-attach-h')}
fade=nextFade;box=nextBox;row=nextRow
resize?.disconnect();children.disconnect()
for(const node of[box,row])if(node)resize?.observe(node)
if(fade)children.observe(fade,{childList:true})
if(row)children.observe(row,{childList:true})
measure()
}
const timer=win.setInterval(find,600)
find()
return()=>{
disposed=true
win.clearInterval(timer)
resize?.disconnect();children.disconnect()
if(fade){fade.removeAttribute('data-claude-attached');fade.removeAttribute('data-claude-queue');fade.style.removeProperty('--claude-composer-box-h');fade.style.removeProperty('--claude-attach-h')}
}
}
function claudeContextLevel(pct){
return pct >=90?'danger':pct >=75?'warning':'normal'
}
function installClaudeContextRing({host:api=host,document:doc=globalThis.document,window:win=globalThis.window}={}){
if(!doc?.body || !win)return()=>{}
let frame=0,disposed=false,ring=null,timer=0
const NS='http://www.w3.org/2000/svg'
const R=6,C=2 * Math.PI * R
const source=()=>[...doc.querySelectorAll(CLAUDE_CONTEXT_ITEM)].find(b=> claudeContextPercent(b.textContent)!=null)
const anchor=item=>{
if(!ring)return
const box=ring.getBoundingClientRect()
const left=Math.round(box.left)+ 'px',top=Math.round(box.top)+ 'px'
if(item.style.left !==left)item.style.left=left
if(item.style.top !==top)item.style.top=top
}
const build=()=>{
const button=doc.createElement('button')
button.type='button'
button.dataset.claudeContextRing=''
const svg=doc.createElementNS(NS,'svg')
svg.setAttribute('viewBox','0 0 14 14')
svg.setAttribute('aria-hidden','true')
for(const part of['track','fill']){
const circle=doc.createElementNS(NS,'circle')
circle.setAttribute('cx','7');circle.setAttribute('cy','7');circle.setAttribute('r',String(R))
circle.dataset.part=part
svg.append(circle)
}
button.append(svg)
button.addEventListener('click',event=>{
event.stopPropagation()
const item=source()
if(!item)return togglePop(button)
anchor(item)
for(const type of['pointerdown','mousedown','pointerup','mouseup'])item.dispatchEvent(new win.PointerEvent(type,{bubbles:true,cancelable:true,button:0,pointerType:'mouse'}))
})
return button
}
let pop=null
const closePop=()=>{pop?.remove();pop=null}
const togglePop=button=>{
if(pop)return closePop()
const usage=claudeFocusedUsage(api)
pop=doc.createElement('div')
pop.dataset.claudeContextPop=''
pop.setAttribute('role','status')
const head=doc.createElement('div')
head.dataset.claudeContextPopHead=''
const known=Boolean(usage && usage.context_max)
const pct=known?Math.max(0,Math.min(100,Number(usage.context_percent)|| 0)):0
const lead=doc.createElement('span')
lead.textContent=known?Math.round(pct)+ '% used':'No context used yet in this session.'
head.append(lead)
if(known){
const detail=doc.createElement('span')
detail.textContent=(usage.context_estimated?'~':'')+ claudeTokens(usage.context_used || 0)+ ' / ' + claudeTokens(usage.context_max)+ ' (' + Math.round(pct)+ '%)'
head.append(detail)
}
const bar=doc.createElement('div')
bar.dataset.claudeContextPopBar=''
bar.dataset.level=claudeContextLevel(pct)
bar.setAttribute('role','progressbar')
bar.setAttribute('aria-label','Context window')
bar.setAttribute('aria-valuemin','0')
bar.setAttribute('aria-valuemax','100')
bar.setAttribute('aria-valuenow',String(Math.round(pct)))
const fill=doc.createElement('div')
fill.style.width=pct + '%'
bar.append(fill)
pop.append(head,bar)
const rows=claudeUsageRows(doc,claudeUsageExtras(api))
if(rows.length){
const extra=doc.createElement('div')
extra.dataset.claudeContextPopExtra=''
extra.append(...rows)
pop.append(extra)
}
doc.body.append(pop)
const box=button.getBoundingClientRect()
pop.style.left=Math.round(Math.max(8,Math.min(win.innerWidth - pop.offsetWidth - 8,box.right - pop.offsetWidth)))+ 'px'
pop.style.top=Math.round(box.top - pop.offsetHeight - 8)+ 'px'
}
const onOutside=event=>{if(pop && !pop.contains(event.target)&& !ring?.contains(event.target))closePop()}
doc.addEventListener('pointerdown',onOutside,true)
const place=()=>{
frame=0
if(disposed)return
const item=source()
const usage=claudeFocusedUsage(api)
const effort=doc.querySelector("[data-slot='composer-root'] button[data-testid='reasoning-pill']")|| doc.querySelector("[data-slot='composer-root'] button[data-tour='model-pill']")
for(const old of doc.querySelectorAll('[data-claude-context-source]'))if(old !==item){old.removeAttribute('data-claude-context-source');old.style.removeProperty('left');old.style.removeProperty('top')}
if(!effort){ring?.remove();return}
if(!ring)ring=build()
if(effort.nextElementSibling !==ring)effort.after(ring)
if(item){
if(!item.hasAttribute('data-claude-context-source'))item.setAttribute('data-claude-context-source','')
if(item.getAttribute('data-state')==='open' || item.getAttribute('aria-expanded')==='true'){
anchor(item)
const panel=item.getAttribute('aria-controls')&& doc.getElementById(item.getAttribute('aria-controls'))
if(panel){
const extras=claudeUsageExtras(api)
let block=panel.querySelector(':scope > [data-claude-usage-extra]')
const key=JSON.stringify(extras)
if(!extras.length)block?.remove()
else if(!block || block.dataset.claudeUsageKey !==key){
block?.remove()
block=doc.createElement('div')
block.dataset.claudeUsageExtra=''
block.dataset.claudeUsageKey=key
block.append(...claudeUsageRows(doc,extras))
panel.append(block)
}
}
}
}
ring.toggleAttribute('data-panel',!!item)
const pct=usage?usage.context_percent:item?claudeContextPercent(item.textContent):0
const used=usage && usage.context_max?(usage.context_estimated?'~':'')+ claudeTokens(usage.context_used || 0)+ '/' + claudeTokens(usage.context_max):(item?.querySelector('.truncate')?.textContent.trim()|| '')
const extras=claudeUsageExtras(api).map(([,value])=> value.split(' · ')[0])
const label='Context ' + Math.round(pct)+ '%' +(used?' (' + used + ')':'')+(extras.length?' · ' + extras.join(' · ').replace(/% hit/,'% cache hit'):'')
if(ring.getAttribute('aria-label')!==label)ring.setAttribute('aria-label',label)
const tip=Math.round(pct)+ '% used' +(used?' · ' + used:'')
if(ring.dataset.claudeTip !==tip)ring.dataset.claudeTip=tip
const dash=(C * pct / 100).toFixed(2)+ ' ' + C.toFixed(2)
const fill=ring.querySelector("[data-part='fill']")
if(fill.getAttribute('stroke-dasharray')!==dash)fill.setAttribute('stroke-dasharray',dash)
const level=claudeContextLevel(pct)
if(ring.dataset.level !==level)ring.dataset.level=level
}
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], [data-radix-popper-content-wrapper], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true,characterData:true})
win.addEventListener('resize',schedule)
timer=win.setInterval(schedule,2000)
place()
return()=>{
disposed=true
observer.disconnect()
win.removeEventListener('resize',schedule)
win.clearInterval(timer)
doc.removeEventListener('pointerdown',onOutside,true)
closePop()
if(frame)win.cancelAnimationFrame(frame)
for(const old of doc.querySelectorAll('[data-claude-context-source]')){old.removeAttribute('data-claude-context-source');old.style.removeProperty('left');old.style.removeProperty('top')}
ring?.remove()
ring=null
}
}
function installClaudeAccountRow({host:api=host,document:doc=document,window:win=window}={}){
let bar=null,row=null,menu=null,frame=0,disposed=false
const profileName=()=> String(api?.state?.profile?.get?.()|| 'default')
let identity={key:'',name:'',avatar:''},identityRun=0,identityRetries=0,identityRetry=0
const agentName=()=> identity.name || profileName()
const loadIdentity=async()=>{
const profile=profileName(),key=`${api?.state?.connectionId?.get?.()|| ''}/${profile}`
if(identity.key===key || typeof api?.request !=='function')return
const run=++identityRun
identity={key:'',name:'',avatar:''}
try{
const listing=await api.request('profiles.list',{include_sessions:false})
if(run !==identityRun)return
const entry=(listing?.profiles ||[]).find(row=>(row?.name || 'default')===profile)
identity={key,name:'',avatar:''}
identityRetries=0
if(!entry){if(row)row.dataset.claudeIdentity='no-profile';return paint()}
identity={key,name:String(entry.display_name || entry.bot_title || '').trim(),avatar:''}
if(row)row.dataset.claudeIdentity=identity.name?'named':'unnamed'
paint()
if(!entry.has_avatar)return
const asset=await api.request('profiles.get_asset',{name:entry.name,asset:'avatar'})
const data=typeof asset?.data==='string' && asset.found !==false?asset.data:''
if(run !==identityRun || !/^data:image\/(png|jpeg|webp|gif|svg\+xml);/.test(data))return
identity={...identity,avatar:data}
paint()
}catch(error){
if(row)row.dataset.claudeIdentity=`error: ${String(error?.message || error).slice(0,80)}`
if(run===identityRun && identityRetries++ < 10)identityRetry=win.setTimeout(()=>{if(!disposed)void loadIdentity()},3000)
}
}
const openSettings=()=>{
const native=doc.querySelector("[data-titlebar-cluster] button[aria-label='Open settings']")
if(native)native.click()
else api?.navigate?.('/settings')
}
const closeMenu=()=>{
menu?.remove()
menu=null
row?.setAttribute('aria-expanded','false')
}
const item=(label,run,{hint='',icon='',tag=''}={})=>{
const button=doc.createElement('button')
button.type='button'
button.setAttribute('role','menuitem')
button.dataset.claudeAccountItem=''
if(icon){
const glyph=doc.createElement('i')
glyph.className=`codicon codicon-${icon}`
glyph.setAttribute('aria-hidden','true')
button.append(glyph)
}
const text=doc.createElement('span')
text.dataset.claudeAccountLabel=''
text.textContent=label
button.append(text)
if(tag){
const muted=doc.createElement('span')
muted.dataset.claudeAccountTag=''
muted.textContent=tag
text.append(' ',muted)
}
if(hint){
const kbd=doc.createElement('kbd')
kbd.textContent=hint
button.append(kbd)
}
button.addEventListener('click',()=>{closeMenu();run()})
return button
}
const nextFrame=()=> new Promise(resolve=> win.requestAnimationFrame(()=> resolve()))
const nativeGatewayTrigger=()=> doc.querySelector("[data-slot='connection-switcher'] button[aria-haspopup='menu']")
const activeGatewayLabel=()=>{
const label=nativeGatewayTrigger()?.getAttribute('aria-label')|| ''
const split=label.indexOf(': ')
return split >=0?label.slice(split + 2):''
}
const viaNativeGatewayMenu=async pick=>{
const trigger=nativeGatewayTrigger()
if(!trigger?.id)return false
const root=doc.documentElement
root.dataset.claudeGatewayProxy=''
try{
trigger.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,pointerType:'mouse'}))
for(let attempt=0;attempt < 30;attempt++){
await nextFrame()
const native=doc.querySelector(`[role='menu'][aria-labelledby='${win.CSS.escape(trigger.id)}']`)
if(!native)continue
const target=pick(native)
if(target){target.click();return true}
break
}
doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
return false
}finally{
await nextFrame()
delete root.dataset.claudeGatewayProxy
}
}
const fillGateways=async container=>{
let connections=[]
try{connections=(await api?.connections?.())||[]}catch{connections=[]}
if(!menu || !container.isConnected)return
const active=activeGatewayLabel()
if(connections.length > 1)for(const connection of connections){
const label=String(connection.label || connection.id)
const tag={local:'Local',remote:'Remote',ssh:'SSH',cloud:'Cloud'}[connection.kind]|| ''
const button=item(label,()=> viaNativeGatewayMenu(native=>
[...native.querySelectorAll("[role='menuitemradio']")].find(row=> row.textContent.trim()===label)),{tag})
button.setAttribute('role','menuitemradio')
button.dataset.claudeAccountGateway=connection.kind || ''
button.setAttribute('aria-checked',String(active?label===active:Boolean(connection.primary)))
const check=doc.createElement('i')
check.className='codicon codicon-check'
check.setAttribute('aria-hidden','true')
button.append(check)
container.append(button)
}
}
const manageGateways=()=> viaNativeGatewayMenu(native=>
[...native.querySelectorAll("[role='menuitem']")].pop()).then(opened=>{if(!opened)openSettings()})
const settingsHint=()=>{
const keys=claudeKeybind(win,'nav.settings','mod+,')
return keys.join(/Mac/i.test(win.navigator?.platform || '')?'':'+')
}
const toggleMenu=()=>{
if(menu)return closeMenu()
void loadIdentity()
menu=doc.createElement('div')
menu.setAttribute('role','menu')
menu.dataset.claudeAccountMenu=''
const head=doc.createElement('div')
head.dataset.claudeAccountMenuHead=''
head.textContent=agentName()
const gateways=doc.createElement('div')
gateways.dataset.claudeAccountGateways=''
const separator=doc.createElement('div')
separator.dataset.claudeAccountSeparator=''
separator.setAttribute('role','separator')
menu.append(head,gateways,separator,item('Settings',openSettings,{hint:settingsHint(),icon:'settings-gear'}),item('Manage gateways…',manageGateways,{icon:'server-environment'}),item('Profiles',()=> api?.navigate?.('/profiles'),{icon:'account'}))
void fillGateways(gateways)
doc.body.append(menu)
const rect=row.getBoundingClientRect()
menu.style.left=`${rect.left}px`
menu.style.bottom=`${win.innerHeight - rect.top + 6}px`
row.setAttribute('aria-expanded','true')
menu.querySelector('button')?.focus()
}
const paint=()=>{
if(!row)return
const name=agentName(),gateway=activeGatewayLabel()
const set=(selector,text)=>{const node=row.querySelector(selector);if(node.textContent !==text)node.textContent=text}
set('[data-claude-account-name]',name)
set('[data-claude-account-org]',gateway?` · ${gateway}`:'')
const avatar=row.querySelector('[data-claude-account-avatar]')
if(identity.avatar){
const image=avatar.querySelector('img')
if(image?.getAttribute('src')!==identity.avatar){
const next=doc.createElement('img')
next.alt=''
next.src=identity.avatar
avatar.replaceChildren(next)
}
}else if(avatar.textContent !==name.slice(0,1).toUpperCase()|| avatar.querySelector('img')){
avatar.textContent=name.slice(0,1).toUpperCase()
}
}
const build=()=>{
row=doc.createElement('button')
row.type='button'
row.dataset.claudeAccountRow=''
row.setAttribute('aria-haspopup','menu')
row.setAttribute('aria-expanded','false')
row.setAttribute('aria-label','Account and settings')
const avatar=doc.createElement('span')
avatar.dataset.claudeAccountAvatar=''
avatar.setAttribute('aria-hidden','true')
const label=doc.createElement('span')
label.dataset.claudeAccountText=''
const name=doc.createElement('span')
name.dataset.claudeAccountName=''
const org=doc.createElement('span')
org.dataset.claudeAccountOrg=''
label.append(name,org)
const caret=doc.createElement('i')
caret.className='codicon codicon-chevron-down'
caret.setAttribute('aria-hidden','true')
row.append(avatar,label,caret)
row.addEventListener('click',toggleMenu)
bar=doc.createElement('div')
bar.dataset.claudeAccountBar=''
bar.append(row)
paint()
}
const place=()=>{
frame=0
if(disposed)return
const sidebar=doc.querySelector("[data-tour='sessions-sidebar']")
const zone=(sidebar || doc).closest?.("[data-tree-group='grp-sessions']")|| doc.querySelector("[data-tree-group='grp-sessions']")
if(zone && zone !==watchedZone){zoneSize?.disconnect();watchedZone=zone;zoneSize=win.ResizeObserver?new win.ResizeObserver(()=> schedule()):null;zoneSize?.observe(zone)}
const folded=Boolean(zone)&& zone.getBoundingClientRect().width < 120
if(doc.documentElement.hasAttribute('data-claude-sidebar-folded')!==folded)doc.documentElement.toggleAttribute('data-claude-sidebar-folded',folded)
if(bar && bar.hasAttribute('data-claude-folded')!==folded)bar.toggleAttribute('data-claude-folded',folded)
if(!sidebar)return
if(!row)build()
const host=zone || sidebar
if(host.lastElementChild !==bar)host.append(bar)
if(bar.hasAttribute('data-claude-folded')!==folded)bar.toggleAttribute('data-claude-folded',folded)
paint()
}
let watchedZone=null,zoneSize=null
const schedule=()=>{if(!frame && !disposed)frame=win.requestAnimationFrame(place)}
const onPointer=event=>{if(menu && !menu.contains(event.target)&& !row?.contains(event.target))closeMenu()}
const onKey=event=>{
if(event.key !=='Escape' || !menu)return
event.preventDefault()
event.stopPropagation()
closeMenu()
row?.focus()
}
const outside=records=> records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return !node?.closest(".xterm, [data-slot='thread'], .cm-editor, [data-claude-changes-diffs], [contenteditable='true'], textarea")})
const observer=new win.MutationObserver(records=>{if(outside(records))schedule()})
observer.observe(doc.body,{childList:true,subtree:true})
const refresh=()=>{paint();void loadIdentity()}
const offProfile=api?.state?.profile?.subscribe?.(refresh)
const offConnection=api?.state?.connectionId?.subscribe?.(refresh)
const offGateway=api?.state?.gateway?.subscribe?.(state=>{if(state==='open')refresh()})
doc.addEventListener('pointerdown',onPointer,true)
doc.addEventListener('keydown',onKey,true)
place()
return()=>{
disposed=true
observer.disconnect()
zoneSize?.disconnect()
doc.documentElement.removeAttribute('data-claude-sidebar-folded')
if(frame)win.cancelAnimationFrame(frame)
offProfile?.()
offConnection?.()
offGateway?.()
identityRun++
win.clearTimeout(identityRetry)
doc.removeEventListener('pointerdown',onPointer,true)
doc.removeEventListener('keydown',onKey,true)
closeMenu()
bar?.remove()
bar=row=null
}
}
export default{
id:ID,
name:'Claude Skin',
register(ctx){
let windowKind=null
try{windowKind=new URLSearchParams(globalThis.location?.search || '').get('win')}catch{}
if(['hud','overlay','quick','wake'].includes(windowKind)){
ctx.register({id:'theme',area:THEMES_AREA,data:CLAUDE_THEME})
return
}
pluginStorage=ctx.storage
const updater=createSkinUpdater(ctx.storage)
const inbox=globalThis.document?.body?installClaudeInboxRuntime({storage:ctx.storage,host}):null
startClaudeInboxObserver(ctx,inbox)
startClaudeInboxMenuOpenObserver(ctx,inbox)
ctx.onDispose(()=> updater.dispose())
ctx.onDispose(()=> inbox?.dispose())
ctx.onDispose(connectClaudeInboxEvents(inbox))
if(globalThis.document?.body)ctx.onDispose(installClaudeHasMarks())
if(globalThis.document?.body)ctx.onDispose(installClaudeAccountRow())
if(globalThis.document?.body)ctx.onDispose(installClaudeApprovalDock())
if(globalThis.document?.body){
const strip=document.createElement('div')
strip.dataset.claudeUpdateDock='skin'
strip.hidden=true
document.body.append(strip)
const unmount=updater.mount(strip)
ctx.onDispose(()=>{unmount();strip.remove()})
ctx.onDispose(installClaudeBackendDock({skin:strip}))
}
const skinSettings=[
{
id:'toggle-composer-width',
label:'Claude Skin: Composer width',
detail:()=> COMPOSER_WIDTH_MODES[readComposerWidthMode()].label,
keywords:['claude','skin','composer','width','narrow','full','hermes'],
run:()=> setComposerWidthMode(COMPOSER_WIDTH_MODES[readComposerWidthMode()].next)
},
{
id:'toggle-pinned-user-messages',
label:'Claude Skin: Pinned user messages',
detail:()=>(readPinnedUserMessagesMode()==='hermes'?'Hermes':'Off'),
keywords:['claude','skin','pinned','sticky','user','message','prompt','hermes'],
run:()=> setPinnedUserMessagesMode(readPinnedUserMessagesMode()==='hermes'?'off':'hermes')
},
{
id:'toggle-clean-transcript',
label:'Claude Skin: Clean transcript',
detail:()=>(readCleanTranscriptMode()==='on'?'On':'Off'),
keywords:['claude','skin','clean','transcript','tool','calls','interim','messages'],
run:()=> setCleanTranscriptMode(readCleanTranscriptMode()==='on'?'off':'on')
},
{
id:'toggle-ascii-backdrop',
label:'Claude Skin: ASCII backdrop',
detail:()=> asciiBackdropLabel(),
keywords:['claude','skin','ascii','backdrop','glyphs','water','spring','summer','autumn','fall','winter','halloween','christmas','new year','newyear','fireworks','seasonal','season','holiday','scene','empty','landing'],
run:()=> setAsciiBackdropMode(ASCII_BACKDROP_MODES[readAsciiBackdropMode()].next)
},
{
id:'toggle-inbox',
label:'Claude Skin: Inbox',
detail:()=> readClaudeInboxMode()==='on'?'On':'Off',
keywords:['claude','skin','inbox','settle','threads','sessions'],
run:()=> setClaudeInboxMode(readClaudeInboxMode()==='on'?'off':'on',inbox)
}
]
if(globalThis.document?.body){
ctx.onDispose(installClaudeAsciiBackdrop())
const search=installClaudeSearchDialog({host,runAction:ctx.runAction,listActions:ctx.listActions,settings:skinSettings})
ctx.onDispose(search.dispose)
ctx.onDispose(installClaudeSidebarMore({runAction:ctx.runAction,openSearch:search.open}))
ctx.onDispose(installClaudeTitleMenu())
ctx.onDispose(installClaudeTranscript())
ctx.onDispose(installClaudeModelPill())
ctx.onDispose(installClaudeToolPayload())
ctx.onDispose(installClaudeToolStacks())
ctx.onDispose(installClaudeContextRing())
ctx.onDispose(installClaudeComposerBox())
ctx.onDispose(installClaudeVoiceTips())
ctx.onDispose(installClaudeHeaderTips())
ctx.onDispose(installClaudeSidebarHistory())
ctx.onDispose(installClaudeTitlebarState())
ctx.onDispose(installClaudeSidebarPeek())
ctx.onDispose(installClaudeSidebarScrollFade())
ctx.onDispose(installClaudeVoiceEngineHover())
ctx.onDispose(installClaudeToastEscape())
}
if(globalThis.document?.body)ctx.onDispose(installClaudePaneTools({runAction:ctx.runAction,listActions:ctx.listActions,paneVisibility:host.paneVisibility,revealPane:host.revealPane,undismissPane:host.undismissPane,workspace:host.state?.cwd,pluginDecisions:host.pluginDecisions}))
if(globalThis.document?.body)ctx.onDispose(installClaudeTerminalHeader())
if(globalThis.document?.body)ctx.onDispose(installClaudeFileBrowser())
if(globalThis.document?.body)ctx.onDispose(installClaudeBrowserAnnotate())
if(globalThis.document?.body)ctx.onDispose(installClaudeChanges({state:host.state}))
let uninstallStyle
let disposed=false
ctx.onDispose(()=>{
disposed=true
uninstallStyle?.()
})
if(globalThis.document?.body)queueMicrotask(()=>{
if(!disposed)uninstallStyle=installChatStyleRuntime()
})
ctx.register({id:'update-runtime',area:'composer.leading',order:19,render:()=> jsx(ClaudeUpdateRuntime,{updater})})
ctx.register({id:'inbox-settled-badge',area:'sessionRow.trailing',data:{render:({sessionId})=> jsx(ClaudeSettledBadge,{sessionId,inbox})}})
ctx.register({id:'inbox-open-intent',area:'sessionRow.leading',data:{render:({sessionId})=> jsx(ClaudeInboxNativeOpenIntent,{sessionId,inbox})}})
ctx.register({id:'theme',area:THEMES_AREA,data:CLAUDE_THEME})
for(const setting of skinSettings){
ctx.register({
id:setting.id,
area:PALETTE_AREA,
data:{id:'claude-chat-look.' + setting.id,label:setting.label,detail:setting.detail,detailVariant:'state',keepOpen:true,keywords:setting.keywords,run:setting.run}
})
}
}
}
// BEGIN GENERATED UPDATE RUNTIME
const UPDATE_REPO=BUILD_ID.includes('-test.')?'MrSakal/hermes-claude-skin-dev':'MrSakal/hermes-claude-skin'
const UPDATE_IS_TEST=BUILD_ID.includes('-test.')
const UPDATE_INTERVAL_MS=60 * 60 * 1000
const UPDATE_PENDING_KEY='update-pending'
const UPDATE_CACHE_KEY=`update-cache:${UPDATE_REPO}`
const UPDATE_MAX_BYTES=1_000_000
const UPDATE_CSS=`
.claude-update-button{box-sizing:border-box;position:relative;display:flex;align-items:center;gap:4px;width:100%;height:28px;min-width:0;padding:0 8px 0 6px;border:0;border-radius:6px;background:var(--claude-account-hover,var(--ui-row-hover-background,rgb(128 128 128 / 12%)));color:var(--claude-color-text-secondary,var(--ui-text-secondary,#666));font:inherit;font-size:13px;line-height:20px;text-align:start;cursor:pointer;outline:none}
.claude-update-button[hidden]{display:none!important}
button.claude-update-button:is(:hover,:active){background:var(--claude-sidebar-active,var(--ui-row-active-background,rgb(128 128 128 / 20%)))}
button.claude-update-button:focus-visible{box-shadow:inset 0 0 0 1px var(--claude-color-sidebar,#111),0 0 0 1px var(--ui-accent,#D97757),0 0 6px 1px color-mix(in srgb,var(--ui-accent,#D97757) 60%,transparent)}
.claude-update-title,.claude-update-status-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.claude-update-title{color:var(--claude-color-text,var(--ui-text-primary,#171717));font-weight:500}
.claude-update-status-text{color:var(--claude-color-text-tertiary,var(--ui-text-tertiary,#737373))}
.claude-update-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.claude-update-arrow{display:grid;flex:none;place-items:center;margin-inline-start:auto;color:var(--claude-color-text-tertiary,var(--ui-text-tertiary,#737373))}
button.claude-update-button:hover .claude-update-arrow{color:var(--claude-color-text-secondary,var(--ui-text-secondary,#666))}
.claude-update-arrow svg{display:block;width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round}
.claude-update-status{padding-inline-start:2px;cursor:default}
.claude-update-lead{display:grid;flex:none;place-items:center;width:24px;height:24px;color:var(--ui-accent,#D97757)}
.claude-update-spinner{box-sizing:border-box;width:16px;height:16px;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:claude-update-spin .8s linear infinite}
.claude-update-tip{position:fixed;z-index:2147483000;box-sizing:border-box;max-width:280px;padding:4px 8px;border:1px solid var(--claude-color-border,var(--ui-stroke-tertiary,#e5e5e5));border-radius:7px;background:var(--claude-color-elevated,var(--ui-editor-surface-background,#fff));box-shadow:0 4px 14px color-mix(in srgb,black 28%,transparent);color:var(--claude-color-text,var(--ui-text-primary,#171717));font-size:12px;font-weight:400;line-height:16px;white-space:nowrap;pointer-events:none}
.claude-update-tip[hidden]{display:none!important}
.claude-update-panel{box-sizing:border-box;position:fixed;z-index:10000;overflow:auto;overscroll-behavior:contain;width:320px;max-height:320px;padding:0 18px;border:0;border-radius:10px;background:var(--claude-menu-background,var(--claude-color-card,var(--ui-editor-surface-background,#fff)));color:var(--claude-color-text,var(--ui-text-primary,#171717));box-shadow:0 0 0 1px var(--claude-menu-border,var(--ui-stroke-secondary,#e5e5e5)),0 8px 24px var(--claude-menu-shadow,#0000001f),0 2px 6px #00000014;font:13px/19px var(--font-sans,system-ui),sans-serif;scrollbar-width:thin;scrollbar-color:var(--ui-stroke-secondary,#ccc) transparent}
.claude-update-panel[hidden]{display:none!important}
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
@keyframes claude-update-spin{to{transform:rotate(1turn)}}
@media(prefers-reduced-motion:reduce){.claude-update-spinner{animation:none}}
`
function updateVersionParts(value){
const match=/^v?(\d+)\.(\d+)\.(\d+)(?:-test\.(\d+))?$/.exec(String(value))
return match?[Number(match[1]),Number(match[2]),Number(match[3]),match[4]===undefined?Infinity:Number(match[4])]:null
}
function compareUpdateVersions(left,right){
const a=updateVersionParts(left),b=updateVersionParts(right)
if(!a || !b)return null
for(let i=0;i < a.length;i++)if(a[i]!==b[i])return a[i]> b[i]?1:-1
return 0
}
async function updateSha256(bytes){
return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=> value.toString(16).padStart(2,'0')).join('')
}
function updateSourceIdentity(source){
return{id:/^const ID = ['"]([^'"]+)['"]/m.exec(source)?.[1],version:/^const BUILD_ID = ['"]([^'"]+)['"]/m.exec(source)?.[1]}
}
function normalizeUpdateRoot(value){
if(typeof value !=='string' || /[\u0000-\u001f]/.test(value))throw new Error('Invalid local plugin folder.')
const path=value.replace(/\\/g,'/').replace(/\/$/,'')
if(!/^(?:\/|[A-Za-z]:\/)/.test(path)|| !path.endsWith('/desktop-plugins')|| path.split('/').some(part=> part==='.' || part==='..'))throw new Error('Invalid local plugin folder.')
return path
}
function updateAssetFor(release,repo=UPDATE_REPO){
if(!release || release.draft ||(!UPDATE_IS_TEST && release.prerelease)|| !updateVersionParts(release.tag_name))return null
const asset=release.assets?.find(item=> item.name==='plugin.js')
if(!asset || !Number.isSafeInteger(asset.id)|| asset.url !==`https://api.github.com/repos/${repo}/releases/assets/${asset.id}`)return null
if(!/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')|| asset.size <=0 || asset.size > UPDATE_MAX_BYTES)return null
return asset
}
function updateImageURL(value){
try{
const url=new URL(value)
if(url.protocol !=='https:' || url.username || url.password || url.port)return null
const path=url.pathname.toLowerCase(),repo='/mrsakal/hermes-claude-skin/'
const allowed=(url.hostname==='github.com' &&(path.startsWith(repo + 'releases/download/')|| path.startsWith('/user-attachments/assets/')))
||(url.hostname==='raw.githubusercontent.com' && path.startsWith(repo))
|| url.hostname==='user-images.githubusercontent.com'
return allowed?url.href:null
}catch{return null}
}
function decodeUpdateImageText(value){
const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}
return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(entity,name)=>{
if(name[0]!=='#')return named[name.toLowerCase()]
const point=/^#x/i.test(name)?parseInt(name.slice(2),16):Number(name.slice(1))
return point > 0 && point <=0x10ffff?String.fromCodePoint(point):'\ufffd'
})
}
function appendUpdateImage(parent,source,alt){
const url=updateImageURL(decodeUpdateImageText(source))
const fallback=document.createElement('p')
fallback.className='claude-update-image-fallback'
fallback.textContent=decodeUpdateImageText(alt)|| 'Image unavailable'
if(!url){parent.appendChild(fallback);return}
const frame=document.createElement('figure'),image=document.createElement('img')
image.alt=decodeUpdateImageText(alt)
image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer'
image.dataset.updateImageSrc=url
image.addEventListener('error',()=> frame.replaceWith(fallback),{once:true})
frame.appendChild(image);parent.appendChild(frame)
}
function activateUpdateImages(parent){
for(const image of parent.querySelectorAll('img[data-update-image-src]')){
const source=image.dataset.updateImageSrc
delete image.dataset.updateImageSrc
image.src=source
}
}
function appendUpdateNotes(parent,raw){
let list=null
const appendText=line=>{
const text=line.trim().replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1')
if(!text){list=null;return}
const bullet=/^[-*] (.+)/.exec(text)
if(bullet){
if(!list){list=document.createElement('ul');parent.appendChild(list)}
const item=document.createElement('li');item.textContent=bullet[1];list.appendChild(item)
}else{
list=null
const heading=/^#{1,6}\s+(.+)/.exec(text)
const node=document.createElement(heading?'h4':'p');node.textContent=heading?heading[1]:text;parent.appendChild(node)
}
}
const tokens=/!\[([^\]\n]*)\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)|<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*\/?>/gi
for(const line of String(raw || '').split('\n')){
let cursor=0
for(const match of line.matchAll(tokens)){
const before=line.slice(cursor,match.index)
if(!/^\s*[-*]\s*$/.test(before))appendText(before)
if(match[0].startsWith('!['))appendUpdateImage(parent,match[2].replace(/^<|>$/g,''),match[1])
else{
const attributes=new Map()
for(const field of match[0].slice(4,-1).matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)){
const name=field[1].toLowerCase()
if(!attributes.has(name))attributes.set(name,field[2]??field[3]??field[4]??'')
}
appendUpdateImage(parent,attributes.get('src'),attributes.get('alt'))
}
list=null;cursor=match.index + match[0].length
}
appendText(line.slice(cursor))
}
}
function createSkinUpdater(storage,native=globalThis.window?.hermesDesktop,request=(...args)=> fetch(...args)){
const views=new Set(),abort=new AbortController(),timers=new Set()
const capable=['desktopPluginsRoot','readPluginSource','writeTextFile'].every(name=> typeof native?.[name]==='function')
const state={phase:'idle',releases:[],target:null,progress:0,error:'',page:1,hasMore:false}
let initPromise,root,token='',disposed=false,loadingMore=false,reportChain=Promise.resolve()
let operation=null,proof={}
const cache=storage?.get?.(UPDATE_CACHE_KEY,null)
const schedule=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!disposed)fn()},ms);timers.add(id);return id}
const pause=ms=> new Promise(resolve=> schedule(resolve,ms))
const active=()=>['downloading','applying','awaiting-reload'].includes(state.phase)
function report(extra={}){
if(!UPDATE_IS_TEST || !root || disposed)return
proof={...proof,...extra}
const payload={...proof,runningVersion:BUILD_ID,phase:state.phase,repository:UPDATE_REPO,targetVersion:state.target?.tag_name || null,activeBuild:document.documentElement.dataset.claudeChatLookBuild || null,at:new Date().toISOString()}
reportChain=reportChain.then(()=> disposed?undefined:native.writeTextFile(`${root}/${ID}/update-test-report.json`,JSON.stringify(payload,null,2))).catch(()=>{})
}
function paint(){if(!disposed)for(const view of views)view.paint()}
function phase(value,error=''){if(disposed)return;state.phase=value;state.error=error;paint();report()}
async function readSource(path){
const result=await native.readPluginSource(path)
if(result.truncated || typeof result.text !=='string')throw new Error('The local plugin could not be read completely.')
return result.text
}
async function restorePrevious(pending){
if(!pending || pending.repository !==UPDATE_REPO || !/^[a-f0-9]{64}$/.test(pending.fromDigest || ''))throw new Error('The rollback receipt is missing.')
const previous=await readSource(`${root}/${ID}/update-rollback.js`)
if(await updateSha256(new TextEncoder().encode(previous))!==pending.fromDigest || updateSourceIdentity(previous).version !==pending.fromVersion)throw new Error('The rollback copy could not be verified.')
await native.writeTextFile(`${root}/${ID}/plugin.js`,previous)
if(await readSource(`${root}/${ID}/plugin.js`)!==previous)throw new Error('The restored file could not be verified.')
storage.remove(UPDATE_PENDING_KEY)
}
function recoverPending(pending){
phase('awaiting-reload')
schedule(async()=>{
const current=storage.get(UPDATE_PENDING_KEY,null)
if(!current || current.startedAt !==pending.startedAt || current.digest !==pending.digest)return
try{await restorePrevious(current);phase('error','The interrupted update was rolled back. Click to retry.')}
catch{phase('error','The update is incomplete. Its recovery receipt and rollback copy were retained.')}
},Math.max(0,10000 -(Date.now()- pending.startedAt)))
}
async function initialize(){
if(!capable)throw new Error('This Hermes Desktop version does not support local plugin updates.')
if(!initPromise)initPromise=(async()=>{
root=normalizeUpdateRoot(await native.desktopPluginsRoot())
if(UPDATE_IS_TEST){
const access=JSON.parse(await readSource(`${root}/${ID}/update-test-access.json`))
if(access.repository !==UPDATE_REPO || typeof access.token !=='string' || !access.token)throw new Error('Private update access is not configured on this computer.')
token=access.token
}
const pending=storage.get(UPDATE_PENDING_KEY,null)
if(pending?.targetVersion===BUILD_ID && pending.repository===UPDATE_REPO){
const installed=await readSource(`${root}/${ID}/plugin.js`)
const hash=await updateSha256(new TextEncoder().encode(installed))
if(hash !==pending.digest || updateSourceIdentity(installed).version !==BUILD_ID){recoverPending(pending);return}
storage.remove(UPDATE_PENDING_KEY)
storage.set('last-update',{version:BUILD_ID,digest:hash,verifiedAt:Date.now()})
phase('done')
report({hotReloadVerified:true,installedDigest:hash,fromVersion:pending.fromVersion})
}else if(pending?.repository===UPDATE_REPO && Number.isFinite(pending.startedAt))recoverPending(pending)
else report({localAccessVerified:true})
})()
return initPromise
}
async function github(path,accept='application/vnd.github+json'){
await initialize()
const allowed=`https://api.github.com/repos/${UPDATE_REPO}/releases`
if(!(path===allowed || path.startsWith(allowed + '?')|| path.startsWith(allowed + '/assets/')))throw new Error('Unexpected update source.')
const headers={Accept:accept,'X-GitHub-Api-Version':'2022-11-28'}
if(token)headers.Authorization=`Bearer ${token}`
const response=await request(path,{headers,credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])})
if(!response.ok)throw new Error(response.status===403 || response.status===429?'GitHub is temporarily limiting requests. Try again later.':`GitHub request failed (${response.status}).`)
return response
}
async function loadPage(page){
const response=await github(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=10&page=${page}`)
const data=await response.json()
if(!Array.isArray(data))throw new Error('GitHub returned an invalid release list.')
return data
}
async function firstPage(){
const releases=await loadPage(1)
const entry={releases,checkedAt:Date.now()}
storage.set(UPDATE_CACHE_KEY,entry)
return entry
}
function accept(entry){
if(!entry || disposed)return
state.releases=entry.releases.filter(release=> !release.draft &&(UPDATE_IS_TEST || !release.prerelease))
state.page=1;state.hasMore=entry.releases.length===10
state.target=state.releases.filter(release=> updateAssetFor(release)&& compareUpdateVersions(release.tag_name,BUILD_ID)===1).sort((a,b)=> -compareUpdateVersions(a.tag_name,b.tag_name))[0]|| null
if(!active()&& state.phase !=='error')phase(state.target?'available':'idle')
else paint()
report({checkedAt:entry.checkedAt})
}
async function more(){
if(disposed || loadingMore || !state.hasMore)return
loadingMore=true
try{
const releases=await loadPage(state.page + 1)
const seen=new Set(state.releases.map(release=> release.id))
state.releases=[...state.releases,...releases.filter(release=> !seen.has(release.id)&& !release.draft &&(UPDATE_IS_TEST || !release.prerelease))]
state.page++;state.hasMore=releases.length===10;paint()
}catch{ /* Existing notes remain usable; another scroll can retry. */}
finally{loadingMore=false}
}
async function download(asset){
const response=await github(asset.url,'application/octet-stream')
const reader=response.body?.getReader()
if(!reader)throw new Error('A bounded streaming download is not available in this Hermes version.')
if(Number(response.headers?.get('content-length'))> UPDATE_MAX_BYTES){await reader.cancel();throw new Error('The update file is too large.')}
let bytes
{
const chunks=[];let total=0
while(true){
const result=await reader.read()
if(result.done)break
total +=result.value.length
if(total > UPDATE_MAX_BYTES){await reader.cancel();throw new Error('The update file is too large.')}
chunks.push(result.value);state.progress=Math.min(total / asset.size,1);paint()
}
bytes=new Uint8Array(total);let offset=0
for(const chunk of chunks){bytes.set(chunk,offset);offset +=chunk.length}
}
if(bytes.length !==asset.size || bytes.length > UPDATE_MAX_BYTES)throw new Error('The update download is incomplete.')
if(await updateSha256(bytes)!==asset.digest.slice(7))throw new Error('The update file failed its integrity check.')
return new TextDecoder('utf-8',{fatal:true}).decode(bytes)
}
async function install(){
if(operation || !state.target || !['available','error'].includes(state.phase))return
const target=state.target,asset=updateAssetFor(target)
if(!asset)return
const run={touched:false,previous:'',path:'',cancelled:false};operation=run
try{
phase('downloading');state.progress=0
const source=await download(asset)
const identity=updateSourceIdentity(source)
if(identity.id !==ID || identity.version !==target.tag_name)throw new Error('The download is not the expected Claude Skin release.')
state.progress=1;paint();await pause(40)
if(disposed)return
phase('applying')
run.path=`${root}/${ID}/plugin.js`
run.previous=await readSource(run.path)
if(updateSourceIdentity(run.previous).version !==BUILD_ID)throw new Error('The local skin changed. Reload it before updating.')
await native.writeTextFile(`${root}/${ID}/update-rollback.js`,run.previous)
if(await readSource(`${root}/${ID}/update-rollback.js`)!==run.previous)throw new Error('The rollback copy could not be verified.')
await native.writeTextFile(`${root}/${ID}/update-staged.js`,source)
if(await readSource(`${root}/${ID}/update-staged.js`)!==source)throw new Error('The staged update could not be verified.')
storage.set(UPDATE_PENDING_KEY,{repository:UPDATE_REPO,fromVersion:BUILD_ID,fromDigest:await updateSha256(new TextEncoder().encode(run.previous)),targetVersion:target.tag_name,digest:asset.digest.slice(7),startedAt:Date.now()})
await pause(40)
run.touched=true
await native.writeTextFile(run.path,source)
if(await readSource(run.path)!==source)throw new Error('The installed update could not be verified.')
if(disposed)return
phase('awaiting-reload')
schedule(async()=>{
if(disposed || state.phase !=='awaiting-reload')return
try{await restorePrevious(storage.get(UPDATE_PENDING_KEY,null));phase('error','Hermes did not reload the update. The previous file was restored.')}
catch{phase('error','Hermes did not reload the update. Its recovery receipt and rollback copy were retained.')}
operation=null
},10000)
}catch(error){
if(disposed)return
let message=error.message || 'The update could not be installed.'
if(run.touched && run.previous){
try{await restorePrevious(storage.get(UPDATE_PENDING_KEY,null))}
catch{message +=' Restoration could not be verified; the recovery receipt and rollback copy were retained.'}
}else storage.remove(UPDATE_PENDING_KEY)
operation=null;phase('error',message + '\nClick the update button to retry.')
}
}
function mount(anchor){
const button=document.createElement('button'),status=document.createElement('div'),panel=document.createElement('section'),tip=document.createElement('div')
button.className='claude-update-button';button.type='button';button.dataset.claudeUpdate='true'
button.innerHTML='<span class="claude-update-title"></span><span class="claude-update-sr"></span><span class="claude-update-arrow" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h10m-4-4 4 4-4 4"/></svg></span>'
status.className='claude-update-button claude-update-status';status.setAttribute('role','status');status.hidden=true
status.innerHTML='<span class="claude-update-lead" aria-hidden="true"><span class="claude-update-spinner"></span></span><span class="claude-update-status-text"></span>'
panel.className='claude-update-panel';panel.hidden=true;panel.tabIndex=0;panel.setAttribute('aria-label','Claude Skin releases')
tip.className='claude-update-tip';tip.hidden=true;tip.setAttribute('aria-hidden','true')
anchor.dataset.claudeUpdateAnchor='true';anchor.append(button,status);document.body.append(panel,tip)
let tipTimer,previousPhase,previousReleases,previousError,open=false
const position=()=>{
if(!open)return
const rect=button.getBoundingClientRect(),width=Math.min(320,innerWidth - 24)
panel.style.width=`${width}px`;panel.style.maxHeight=`${Math.max(80,Math.min(320,rect.top - 24))}px`
panel.style.left=`${Math.max(12,Math.min(rect.left,innerWidth - width - 12))}px`
panel.style.top=`${Math.max(12,rect.top - panel.getBoundingClientRect().height - 8)}px`
}
const hideTip=()=>{clearTimeout(tipTimer);tip.hidden=true}
const showTip=()=>{
hideTip()
tipTimer=setTimeout(()=>{
if(open || button.hidden || !button.isConnected || !button.checkVisibility())return
tip.hidden=false
const rect=button.getBoundingClientRect(),box=tip.getBoundingClientRect()
tip.style.left=`${Math.round(Math.max(8,Math.min(innerWidth - box.width - 8,rect.left + rect.width / 2 - box.width / 2)))}px`
tip.style.top=`${Math.round(Math.max(8,rect.top - box.height - 4))}px`
},300)
}
const close=()=>{open=false;panel.hidden=true;button.setAttribute('aria-expanded','false')}
const show=()=>{if(!['available','error'].includes(state.phase)|| !button.checkVisibility())return;hideTip();open=true;panel.hidden=false;button.setAttribute('aria-expanded','true');activateUpdateImages(panel);position();panel.focus({preventScroll:true})}
button.addEventListener('pointerenter',showTip);button.addEventListener('pointerleave',hideTip)
button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))showTip()});button.addEventListener('blur',hideTip)
button.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();show()})
const outside=event=>{if(!anchor.contains(event.target)&& !panel.contains(event.target))close()}
const key=event=>{if(event.key==='Escape'){hideTip();if(open){close();if(button.isConnected)button.focus()}}}
button.addEventListener('pointerdown',event=>{event.stopPropagation();hideTip()})
button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();hideTip();close();void install()})
panel.addEventListener('scroll',()=>{if(panel.scrollTop + panel.clientHeight >=panel.scrollHeight - 40)void more()})
window.addEventListener('resize',position);document.addEventListener('scroll',position,true);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key)
const panelResize=new ResizeObserver(position)
panelResize.observe(panel)
const view={paint(){
const phaseNow=state.phase,tag=state.target?.tag_name || ''
const busy=['downloading','applying','awaiting-reload'].includes(phaseNow),offered=['available','error'].includes(phaseNow)
if(anchor.hasAttribute('data-claude-update-visible')!==(busy || offered))anchor.toggleAttribute('data-claude-update-visible',busy || offered)
if(button.hidden !==!offered)button.hidden=!offered
if(status.hidden !==!busy)status.hidden=!busy
if(!offered){close();hideTip()}
if(previousPhase !==phaseNow || button.dataset.version !==tag){
previousPhase=phaseNow;button.dataset.phase=phaseNow;status.dataset.phase=phaseNow;button.dataset.version=tag
const failed=phaseNow==='error'
button.querySelector('.claude-update-title').textContent=failed?'Retry update':'Update available'
button.querySelector('.claude-update-sr').textContent=(failed?' The last update didn’t complete. ':' ')+ tag
tip.textContent=(failed?'Update didn’t complete':'Update available')+(tag?` · ${tag}`:'')
status.lastChild.textContent=phaseNow==='downloading'?'Downloading update...':'Installing update...'
}
if(previousReleases !==state.releases || previousError !==state.error){
previousReleases=state.releases;previousError=state.error;const scroll=panel.scrollTop;panel.replaceChildren()
if(state.error){const error=document.createElement('p');error.className='claude-update-error';error.textContent=state.error;panel.appendChild(error)}
for(const release of state.releases){
const article=document.createElement('article');article.className='claude-update-release'
const header=document.createElement('header'),version=document.createElement('strong');version.textContent=release.tag_name;header.appendChild(version)
if(release.tag_name===state.target?.tag_name){const badge=document.createElement('span');badge.className='claude-update-tag';badge.textContent='Available';header.appendChild(badge)}
const date=new Date(release.published_at)
if(Number.isFinite(date.getTime())){const time=document.createElement('time');time.textContent=date.toLocaleDateString('en',{month:'short',day:'numeric'});header.appendChild(time)}
article.appendChild(header)
if(release.name && release.name !==release.tag_name){const title=document.createElement('h3');title.textContent=release.name;article.appendChild(title)}
appendUpdateNotes(article,release.body);panel.appendChild(article)
}
if(open)activateUpdateImages(panel)
panel.scrollTop=scroll;position()
}
}}
views.add(view);view.paint()
return()=>{views.delete(view);close();hideTip();panelResize.disconnect();panel.remove();tip.remove();button.remove();status.remove();delete anchor.dataset.claudeUpdateAnchor;anchor.removeAttribute('data-claude-update-visible');window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}
}
return{
capable,state,cache,initialize,firstPage,accept,install,mount,
queryError(error){report({checkFailed:true,reason:error?.message || 'Network error'})},
dispose(){disposed=true;token='';abort.abort();for(const timer of timers)clearTimeout(timer);timers.clear()}
}
}
function ClaudeUpdateRuntime({updater}){
const query=useQuery({
queryKey:[ID,'releases',UPDATE_REPO],queryFn:()=> updater.firstPage(),
enabled:updater.capable,staleTime:UPDATE_INTERVAL_MS,refetchInterval:UPDATE_INTERVAL_MS,
refetchIntervalInBackground:true,refetchOnWindowFocus:true,refetchOnReconnect:true,retry:false,
initialData:updater.cache || undefined,initialDataUpdatedAt:updater.cache?.checkedAt || 0
})
useEffect(()=>{void updater.initialize().catch(error=> updater.queryError(error))},[updater])
useEffect(()=>{if(query.data)updater.accept(query.data)},[query.data])
useEffect(()=>{if(query.error)updater.queryError(query.error)},[query.error])
return null
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


const INBOX_MODE_KEY='inbox'
const INBOX_MODE_EVENT=`${ID}:inbox-mode`
const INBOX_ROWS_EVENT=`${ID}:inbox-rows`
function readClaudeInboxMode(){
try{return pluginStorage?.get(INBOX_MODE_KEY,'off')==='on'?'on':'off'}
catch{return 'off'}
}
function setClaudeInboxMode(mode,inbox){
const next=mode==='off'?'off':'on'
try{
pluginStorage?.set(INBOX_MODE_KEY,next)
if(pluginStorage?.get(INBOX_MODE_KEY,null)!==next)throw new Error('Inbox setting was not saved.')
}
catch{
host.notify?.({kind:'error',message:'Could not save the Inbox setting.'})
return readClaudeInboxMode()
}
inbox?.setMode(next==='on')
globalThis.window?.dispatchEvent?.(new CustomEvent(INBOX_MODE_EVENT,{detail:next}))
return next
}
function inboxGatewayScope(){
return{
connectionId:String(host.state.connectionId?.get?.()|| host.activeConnectionId?.()|| ''),
profile:String(host.state.profile?.get?.()|| 'default')
}
}
function inboxOwnerScope(){
return claudeInboxFocusedThread()?.scope || inboxGatewayScope()
}
function sameInboxScope(left,right){
return left.connectionId===right.connectionId && left.profile===right.profile
}
async function readClaudeInboxRowOwner(scope){
if(typeof window.hermesDesktop?.getAgentRoster !=='function')return null
try{
const roster=await window.hermesDesktop.getAgentRoster()
const sources=roster?.sources
if(!Array.isArray(sources)|| sources.length !==1 || sources[0]?.reachable !==true || sources[0]?.error || sources[0]?.needsSignIn || sources[0]?.connectionId !==scope.connectionId)return null
const routes=roster.agents
if(!Array.isArray(routes)|| !routes.length || routes.some(route=>
typeof route?.connectionId !=='string' || !route.connectionId || typeof route.profile !=='string' || !route.profile))return null
const owners=new Map(routes.map(route=>[JSON.stringify([route.connectionId,route.profile]),route]))
const owner=owners.size===1?[...owners.values()][0]:null
return owner && sameInboxScope(owner,scope)?{...scope}:null
}catch{return null}
}
function claudeInboxBadgeScope(inbox,sessionId,currentScope){
const evidence=inbox?.rowOwnerEvidence
return evidence?.scope && sameInboxScope(evidence.scope,currentScope)&& evidence.ids.includes(sessionId)
?evidence.scope:null
}
function claudeInboxFocusedThread(){
const owner=host.state.focusedSessionOwner?.get?.()
const id=host.state.focusedStoredSessionId?.get?.()
return typeof id==='string' && id && typeof owner?.connectionId==='string' && owner.connectionId && typeof owner.profile==='string' && owner.profile
?{id,scope:{connectionId:owner.connectionId,profile:owner.profile}}:null
}
function claudeInboxLiveFocus(){
const thread=claudeInboxFocusedThread(),runtimeId=host.state.focusedSessionId?.get?.()
return thread && typeof runtimeId==='string' && runtimeId?{...thread.scope,runtimeId,storedId:thread.id}:null
}
function claudeInboxLiveStoredIds(row){
const values=[row.session_key,row.stored_session_id]
if(values.some(id=> id !=null && typeof id !=='string'))return[]
return[...new Set(values.filter(id=> typeof id==='string' && id))]
}
function claudeInboxLiveStoredMatch(storedId,row,metadata){
const stored=claudeInboxLiveStoredIds(row)
if(!stored.length)return false
const touched=metadata.filter(session=>{
const ids=[session.id,session._lineage_root_id,...(session._lineage_ids ||[])]
return stored.some(id=> ids.includes(id))
})
const roots=new Set(touched.map(session=> session._lineage_root_id || session.id))
if(!touched.length)return stored.length===1 && stored[0]===storedId
return roots.size===1 && touched.some(session=>{
const ids=[session.id,session._lineage_root_id,...(session._lineage_ids ||[])]
return ids.includes(storedId)&& stored.every(id=> ids.includes(id))
})
}
function claudeInboxUniqueLiveRow(runtimeId,rows){
if(typeof runtimeId !=='string' || !runtimeId)return null
const matching=rows.filter(row=> row &&[row.id,row.session_id].includes(runtimeId))
const row=matching.length===1?matching[0]:null
return row &&(!row.id || !row.session_id || row.id===row.session_id)?row:null
}
function claudeInboxCanonicalRuntime(scope,targetProfile,runtimeId,rawRows,metadata,owners){
if(typeof runtimeId !=='string' || !runtimeId)return null
const rows=rawRows.filter(row=> row &&[row.id,row.session_id].includes(runtimeId))
const row=claudeInboxUniqueLiveRow(runtimeId,rawRows),proof=owners.get(JSON.stringify([scope.connectionId,runtimeId]))
if(rows.length && !row)return null
if(proof &&(proof.conflicted || !sameInboxScope(proof,scope)))return null
if(row &&(row.connection_id && row.connection_id !==scope.connectionId || row.profile && row.profile !==targetProfile))return null
if(!proof &&(!row || row.profile !==targetProfile))return null
const stored=row?claudeInboxLiveStoredIds(row):[]
if(row &&(!stored.length || !stored.every(id=> claudeInboxLiveStoredMatch(id,row,metadata))))return null
const candidates=new Set(metadata.filter(session=>{
const ids=[session.id,session._lineage_root_id,...(session._lineage_ids ||[])]
return(!proof || ids.includes(proof.storedId))&& stored.every(id=> ids.includes(id))
}).map(session=> session._lineage_root_id || session.id))
return candidates.size===1?[...candidates][0]:null
}
function resolveClaudeInboxLiveSessions(scope,targetProfile,rawRows,metadata,owners){
const liveSessions=[],unresolved=new Set()
let liveStatusKnown=true
for(const row of rawRows){
if(!row || typeof row !=='object'){liveStatusKnown=false;continue}
if(row.connection_id && row.connection_id !==scope.connectionId)continue
if(row.profile && row.profile !==targetProfile)continue
const runtimeId=row.session_id || row.id
const ids=claudeInboxLiveStoredIds(row)
const canonicalId=claudeInboxCanonicalRuntime(scope,targetProfile,runtimeId,rawRows,metadata,owners)
if(canonicalId){
const session=metadata.find(session=>(session._lineage_root_id || session.id)===canonicalId)
liveSessions.push({...row,session_key:session.id,stored_session_id:session.id,profile:scope.profile,connection_id:scope.connectionId,_claudeInboxCanonicalId:canonicalId})
}else{
if(!ids.length)liveStatusKnown=false
ids.forEach(id=> unresolved.add(id))
}
}
for(const session of metadata){
const ids=[session.id,session._lineage_root_id,...(session._lineage_ids ||[])]
if(!ids.some(id=> unresolved.has(id)))continue
if(liveSessions.some(row=> claudeInboxLiveStoredIds(row).some(id=> ids.includes(id))))continue
liveSessions.push({id:session.id,session_key:session.id,_claudeInboxCanonicalId:session._lineage_root_id || session.id,status:'unknown',profile:scope.profile,connection_id:scope.connectionId})
}
return{liveSessions,liveStatusKnown}
}
async function readClaudeInboxLiveIdentity(read,row){
try{
const result=await read(row.session_id || row.id)
const lines=typeof result?.output==='string'?result.output.split('\n'):[]
if(lines[0]!=='Hermes TUI Status' || lines[1]!=='' ||
!lines[2]?.startsWith('Session ID: ')|| !lines[3]?.startsWith('Path: '))return null
const storedId=lines[2].slice(12),home=lines[3].slice(6)
return storedId && home && claudeInboxLiveStoredIds(row).includes(storedId)?{storedId,home}:null
}catch{return null}
}
async function proveClaudeInboxBackgroundOwners(scope,targetProfile,rows,metadata,owners,focus,read,stillCurrent){
const focusKey=focus && JSON.stringify([scope.connectionId,focus.runtimeId])
const anchor=focusKey && owners.get(focusKey)
if(!anchor || anchor.conflicted || !sameInboxScope(anchor,scope)|| !stillCurrent())return
const focusedRow=claudeInboxUniqueLiveRow(focus.runtimeId,rows)
if(!focusedRow || focusedRow.profile && focusedRow.profile !==targetProfile ||
focusedRow.connection_id && focusedRow.connection_id !==scope.connectionId ||
!metadata.some(session=> claudeInboxLiveStoredMatch(session.id,focusedRow,metadata))||
!claudeInboxLiveStoredMatch(focus.storedId,focusedRow,metadata)||
!claudeInboxLiveStoredMatch(anchor.storedId,focusedRow,metadata))return
let home=anchor.home
if(!home){
const identity=await readClaudeInboxLiveIdentity(read,focusedRow)
if(!identity || !stillCurrent()|| JSON.stringify(claudeInboxLiveFocus())!==JSON.stringify(focus))return
home=identity.home
owners.set(focusKey,{...anchor,home})
}
if([...owners.values()].some(proof=> proof.home===home &&(proof.conflicted || !sameInboxScope(proof,scope))))return
const candidates=rows.filter(row=>{
if(!row || row.profile || row.connection_id && row.connection_id !==scope.connectionId)return false
const runtimeId=row.session_id || row.id
if(!runtimeId || owners.has(JSON.stringify([scope.connectionId,runtimeId])))return false
if(claudeInboxUniqueLiveRow(runtimeId,rows)!==row)return false
return metadata.some(session=> claudeInboxLiveStoredMatch(session.id,row,metadata))
})
for(let offset=0;offset < candidates.length;offset +=4){
const batch=await Promise.all(candidates.slice(offset,offset + 4).map(async row=>({row,identity:await readClaudeInboxLiveIdentity(read,row)})))
if(!stillCurrent()|| JSON.stringify(claudeInboxLiveFocus())!==JSON.stringify(focus))return
for(const{row,identity}of batch){
if(identity?.home !==home)continue
owners.set(JSON.stringify([scope.connectionId,row.session_id || row.id]),{
...scope,runtimeId:row.session_id || row.id,storedId:identity.storedId,home
})
}
}
}
async function readClaudeInboxChildSnapshots(scope,liveSessions,read,stillCurrent){
const byThread=new Map(),unknown=new Set()
const rows=liveSessions.filter(row=> row._claudeInboxCanonicalId && row.status !=='unknown')
const at=Date.now()
for(let offset=0;offset < rows.length;offset +=4){
const batch=await Promise.all(rows.slice(offset,offset + 4).map(async row=>{
try{
const result=await read(row.session_id || row.id)
if(!Array.isArray(result?.subagents)|| result.subagents.some(child=>
typeof child?.subagent_id !=='string' || !child.subagent_id || typeof child.status !=='string'))return{row,valid:false}
return{row,valid:true,ids:result.subagents.filter(child=>['running','pending','queued'].includes(child.status)).map(child=> child.subagent_id)}
}catch{return{row,valid:false}}
}))
if(!stillCurrent())throw new Error('Inbox child snapshot lost its owner.')
for(const result of batch){
const id=result.row._claudeInboxCanonicalId
if(!result.valid){unknown.add(id);continue}
if(!byThread.has(id))byThread.set(id,new Set())
result.ids.forEach(child=> byThread.get(id).add(child))
}
}
return{
childSnapshots:[...byThread].filter(([id])=> !unknown.has(id)).map(([session_id,ids])=>({session_id,childIds:[...ids],at})),
childUnknownSessionIds:[...unknown]
}
}
async function readClaudeInboxPage(scope,pageCount,signal,inbox,liveOwners=new Map(),onMetadata=()=>{},nominations=()=>[]){
const bridge=globalThis.window?.hermesDesktop
if(typeof bridge?.api !=='function')throw new Error('Inbox requires the Desktop session API.')
const focusedBefore=claudeInboxLiveFocus()
const sessions=new Map()
let offset=0,total=0
let targetProfile=scope.profile
for(let page=0;page < pageCount;page++){
if(signal?.aborted || !sameInboxScope(scope,inboxOwnerScope()))throw new Error('Inbox scope changed.')
const params=new URLSearchParams({
limit:'100',offset:String(offset),min_messages:'1',
archived:'exclude',order:'recent',profile:scope.profile
})
const data=await bridge.api({
...(scope.connectionId?{connectionId:scope.connectionId}:{}),
profile:scope.profile,
path:`/api/sessions?${params}`,timeoutMs:60_000
})
if(signal?.aborted || !sameInboxScope(scope,inboxOwnerScope()))throw new Error('Inbox scope changed.')
if(!Array.isArray(data?.sessions)|| !Number.isFinite(data.total)|| data.total < 0){
throw new Error('Inbox received an incomplete session list.')
}
if(targetProfile===scope.profile && data.sessions.some(session=> session.profile && session.profile !==scope.profile)&& host.profileRoutes){
const routes=await host.profileRoutes()
const matches=routes.filter(route=> sameInboxScope(route,scope))
if(matches.length===1 && typeof matches[0].targetProfile==='string' && matches[0].targetProfile)targetProfile=matches[0].targetProfile
if(signal?.aborted || !sameInboxScope(scope,inboxOwnerScope()))throw new Error('Inbox scope changed.')
}
if(data.errors?.length || data.storage?.[targetProfile]==='corrupt'){
throw new Error('The session list could not be read completely.')
}
total=data.total
for(const session of data.sessions){
if(session.profile && session.profile !==targetProfile)continue
if(session.connection_id && session.connection_id !==scope.connectionId)continue
if(session.hidden || session.archived || !session.id)continue
const durable=session._lineage_root_id || session.id
const previous=sessions.get(durable)
if(!previous ||(session.last_active || 0)>(previous.last_active || 0))sessions.set(durable,{...session,profile:scope.profile})
}
offset +=100
if(offset >=total)break
if(!data.sessions.length)throw new Error('Inbox pagination stopped before the end of the session list.')
}
const explicitRequestedIds=[...new Set([
...(inbox?.admission?.explicitSessionIds?.(scope)||[]),
...(inbox?.admission?.admittedSessionIds?.(scope)||[])
])].filter(id=> !inbox.model.isSettled(scope,id)&& !inbox.model.isSnoozed(scope,id))
const pendingWorkIds=inbox?.pendingWorkSessionIds?.(scope)||[]
const listedIds=new Set([...sessions.values()].flatMap(row=>[row.id,row._lineage_root_id,...(row._lineage_ids ||[])].filter(Boolean)))
const nominatedIds=nominations().filter(focus=> sameInboxScope(focus,scope)).map(focus=> focus.storedId)
const missing=[...new Set([...explicitRequestedIds,...pendingWorkIds,...nominatedIds])].filter(id=> !listedIds.has(id))
for(let index=0;index < missing.length;index +=4){
const rows=await Promise.all(missing.slice(index,index + 4).map(async id=>{
try{
return await readClaudeInboxOpenedSession({id,scope},{
followLineage:true,
stillCurrent:()=> !signal?.aborted && sameInboxScope(scope,inboxOwnerScope())
})
}catch(error){
if(isClaudeInboxSessionNotFound(error))return null
throw error
}
}))
for(const row of rows){
if(row && !row.archived && !row.hidden)sessions.set(row._lineage_root_id || row.id,row)
}
}
onMetadata({sessions:[...sessions.values()],explicitRequestedIds,hasMore:offset < total})
let liveSessions=[],rawLiveSessions=[],liveStatusKnown=false,liveReadSucceeded=false,liveStatusAt=0
let childSnapshots=[],childUnknownSessionIds=[]
try{
if(!sameInboxScope(scope,inboxOwnerScope()))throw new Error('Inbox scope changed.')
let live,readIdentity,readChildren
if(typeof host.requestProfile==='function' && typeof host.profileRoutes==='function'){
const routes=(await host.profileRoutes()).filter(route=> sameInboxScope(route,scope))
if(routes.length !==1 || signal?.aborted || !sameInboxScope(scope,inboxOwnerScope()))throw new Error('Inbox live owner could not be verified.')
if(typeof routes[0].targetProfile==='string' && routes[0].targetProfile)targetProfile=routes[0].targetProfile
liveStatusAt=Date.now()
live=await host.requestProfile(routes[0],'session.active_list',{profile:targetProfile})
readIdentity=sessionId=> host.requestProfile(routes[0],'session.status',{session_id:sessionId})
readChildren=sessionId=> host.requestProfile(routes[0],'subagent.list',{session_id:sessionId})
}else{
if(!sameInboxScope(scope,inboxGatewayScope()))throw new Error('Inbox requires explicit live-owner routing.')
liveStatusAt=Date.now()
live=await host.request('session.active_list',{profile:targetProfile})
readIdentity=sessionId=> host.request('session.status',{session_id:sessionId})
readChildren=sessionId=> host.request('subagent.list',{session_id:sessionId})
}
if(Array.isArray(live?.sessions)){
liveReadSucceeded=true
const fields=['id','session_id','session_key','stored_session_id','profile','connection_id','status','state','busy']
rawLiveSessions=live.sessions.map(row=> row && typeof row==='object'
?Object.fromEntries(fields.filter(field=> Object.hasOwn(row,field)).map(field=>[field,row[field]])):null)
const focusedAfter=claudeInboxLiveFocus(),metadata=[...sessions.values()]
const stableFocus=focusedBefore && JSON.stringify(focusedBefore)===JSON.stringify(focusedAfter)?[focusedBefore]:[]
for(const focus of[...stableFocus,...nominations()]){
if(!sameInboxScope(focus,scope))continue
const row=claudeInboxUniqueLiveRow(focus.runtimeId,rawLiveSessions)
if(!row || row.profile && row.profile !==targetProfile || row.connection_id && row.connection_id !==scope.connectionId ||
!metadata.some(session=>[session.id,session._lineage_root_id,...(session._lineage_ids ||[])].includes(focus.storedId))||
!claudeInboxLiveStoredMatch(focus.storedId,row,metadata))continue
const key=JSON.stringify([scope.connectionId,focus.runtimeId]),previous=liveOwners.get(key)
const conflict=previous &&(previous.conflicted || previous.profile !==focus.profile ||
!claudeInboxLiveStoredMatch(previous.storedId,row,metadata))
liveOwners.set(key,conflict?{...previous,conflicted:true}:focus)
if(!conflict && typeof previous?.home==='string' && previous.home && sameInboxScope(previous,focus)){
liveOwners.set(key,{...focus,home:previous.home})
}
}
if(stableFocus.length && sameInboxScope(focusedBefore,scope)){
await proveClaudeInboxBackgroundOwners(scope,targetProfile,rawLiveSessions,metadata,liveOwners,focusedBefore,readIdentity,
()=> !signal?.aborted && sameInboxScope(scope,inboxOwnerScope()))
}
;({liveSessions,liveStatusKnown}=resolveClaudeInboxLiveSessions(scope,targetProfile,rawLiveSessions,metadata,liveOwners))
const knownIds=new Set(metadata.flatMap(row=>[row.id,row._lineage_root_id,...(row._lineage_ids ||[])].filter(Boolean)))
const discovery=rawLiveSessions.filter(row=> row && row.profile===targetProfile &&
(!row.connection_id || row.connection_id===scope.connectionId)&&
claudeInboxUniqueLiveRow(row.session_id || row.id,rawLiveSessions)===row &&
new Set(claudeInboxLiveStoredIds(row)).size===1)
const workingIds=[...new Set([...liveSessions,...discovery].filter(row=> claudeInboxWorkStatus(row)==='work')
.flatMap(claudeInboxLiveStoredIds))].filter(id=> !knownIds.has(id))
for(let index=0;index < workingIds.length;index +=4){
const rows=await Promise.all(workingIds.slice(index,index + 4).map(async id=>{
try{
return await readClaudeInboxOpenedSession({id,scope},{
stillCurrent:()=> !signal?.aborted && sameInboxScope(scope,inboxOwnerScope())
})
}catch(error){
if(isClaudeInboxSessionNotFound(error))return null
throw error
}
}))
for(const row of rows)if(row && !row.hidden && !row.archived)sessions.set(row._lineage_root_id || row.id,row)
}
if(workingIds.length){
;({liveSessions,liveStatusKnown}=resolveClaudeInboxLiveSessions(scope,targetProfile,rawLiveSessions,[...sessions.values()],liveOwners))
}
;({childSnapshots,childUnknownSessionIds}=await readClaudeInboxChildSnapshots(scope,liveSessions,readChildren,
()=> !signal?.aborted && sameInboxScope(scope,inboxOwnerScope())))
}
}catch{
liveSessions=[];rawLiveSessions=[];childSnapshots=[];childUnknownSessionIds=[];liveStatusKnown=false;liveReadSucceeded=false
}
if(signal?.aborted || !sameInboxScope(scope,inboxOwnerScope()))throw new Error('Inbox scope changed.')
const rowOwnerScope=await readClaudeInboxRowOwner(scope)
if(signal?.aborted || !sameInboxScope(scope,inboxOwnerScope()))throw new Error('Inbox scope changed.')
return{sessions:[...sessions.values()],liveSessions,rawLiveSessions,childSnapshots,childUnknownSessionIds,targetProfile,liveStatusKnown,liveReadSucceeded,liveStatusAt,rowOwnerScope,explicitRequestedIds,hasMore:offset < total}
}
function startClaudeInboxObserver(ctx,inbox){
if(!inbox)return()=>{}
let scope=inboxOwnerScope(),pageCount=1,mode=readClaudeInboxMode(),disposed=false
const liveOwners=new Map()
const nominatedFocus=new Map()
const pendingEvents=[]
let refreshVersion=0,refreshing=false
let lastFocus=JSON.stringify(claudeInboxLiveFocus()),lastBusy=new Set()
let metadataPreview=null
let liveAuthority=Symbol('Inbox live connection')
const nominations=()=>{
for(const[key,item]of nominatedFocus)if(Date.now()- item.at > 10_000)nominatedFocus.delete(key)
return[...nominatedFocus.values()].map(item=> item.focus)
}
const rememberFocus=()=>{
const focus=claudeInboxLiveFocus()
const connected=!sameInboxScope(scope,inboxGatewayScope())|| !host.state.gateway || host.state.gateway.get()==='open'
if(disposed || mode !=='on' || !connected || !focus || !sameInboxScope(focus,scope))return
nominations()
const key=JSON.stringify(focus)
nominatedFocus.delete(key)
nominatedFocus.set(key,{focus,at:Date.now()})
if(nominatedFocus.size > 64)nominatedFocus.delete(nominatedFocus.keys().next().value)
}
const options=()=>{
const owner={...scope},pages=pageCount
return{
queryKey:[ID,'inbox',owner.connectionId,owner.profile,pages],
queryFn:async({signal})=>{
const authority=liveAuthority,proofs=new Map(liveOwners)
rememberFocus()
const data=await readClaudeInboxPage(owner,pages,signal,inbox,proofs,metadata=>{
if(disposed || signal.aborted || authority !==liveAuthority || mode !=='on' || !sameInboxScope(owner,inboxOwnerScope()))return
metadataPreview=metadata
project()
},nominations)
const connected=!sameInboxScope(owner,inboxGatewayScope())||
!host.state.gateway || host.state.gateway.get()==='open'
const current=!disposed && authority===liveAuthority && connected && !signal.aborted
if(current && data.liveReadSucceeded){
for(const[key,proof]of proofs)liveOwners.set(key,proof)
}
if(current)metadataPreview=null
return{...data,_claudeInboxLiveAuthority:current && data.liveReadSucceeded?authority:null}
},
enabled:mode==='on',staleTime:10_000,
refetchInterval:mode==='on'?10_000:false,retry:1
}
}
const observer=new ClaudeInboxObserverVendor.QueryObserver(queryClient,options())
const refreshLiveIdentity=()=>{
rememberFocus()
refreshVersion++
if(refreshing || disposed || mode !=='on')return
refreshing=true
void Promise.resolve().then(async()=>{
try{
while(!disposed && mode==='on'){
const version=refreshVersion
rememberFocus()
if(observer.getCurrentResult().isFetching)await observer.refetch({cancelRefetch:false})
if(disposed || mode !=='on')break
await observer.refetch()
if(version===refreshVersion)break
}
}finally{refreshing=false}
})
}
const pendingWorkSessionIds=owner=>[...new Set(pendingEvents.filter(item=> sameInboxScope(item.focus,owner)&&
Date.now()- item.at <=10_000).flatMap(item=> item.storedIds))]
inbox.pendingWorkSessionIds=pendingWorkSessionIds
const markReady=()=>{
const query=observer.getCurrentResult()
const ready=!disposed && mode==='on' && sameInboxScope(scope,inboxOwnerScope())&& !query.isPending && !query.error && !!query.data
const island=globalThis.document?.querySelector?.('[data-claude-inbox-owned="island"]')
if(island && island.dataset.claudeInboxQueryReady !==String(ready))island.dataset.claudeInboxQueryReady=String(ready)
}
const project=()=>{
if(disposed || !sameInboxScope(scope,inboxOwnerScope()))return
const query=observer.getCurrentResult(),owner={...scope},snapshot=query.data,data=metadataPreview || snapshot
const authoritative=!query.error && snapshot?._claudeInboxLiveAuthority===liveAuthority
const live=authoritative && Array.isArray(snapshot?.rawLiveSessions)
?resolveClaudeInboxLiveSessions(owner,snapshot.targetProfile,snapshot.rawLiveSessions,data.sessions,liveOwners)
:{liveSessions:[],liveStatusKnown:false}
if(authoritative)for(const id of snapshot.childUnknownSessionIds ||[]){
live.liveSessions.push({id,session_key:id,_claudeInboxCanonicalId:id,profile:owner.profile,connection_id:owner.connectionId,status:'unknown'})
}
const verifiedRows=(live.liveSessions ||[]).filter(row=>
row.profile===owner.profile && row.connection_id===owner.connectionId &&
claudeInboxUniqueLiveRow(row.session_id || row.id,snapshot.rawLiveSessions)&& row.status !=='unknown')
const childSnapshots=authoritative?(snapshot.childSnapshots ||[]).filter(child=>
verifiedRows.some(row=> row._claudeInboxCanonicalId===child.session_id)):[]
const busy=host.state.busyBySession?.get?.()||{}
const busyBySession={},priority={idle:0,reading:1,unknown:2,work:3}
for(const row of verifiedRows){
const runtimeId=row.session_id || row.id,storedId=row.session_key
if(!storedId || !Object.hasOwn(busy,runtimeId))continue
const value=busy[runtimeId],previous=busyBySession[storedId]
if(!Object.hasOwn(busyBySession,storedId)||
priority[claudeInboxWorkStatus(value)]> priority[claudeInboxWorkStatus(previous)])busyBySession[storedId]=value
}
inbox.setMode(mode==='on')
inbox.rowOwnerEvidence=mode==='on' && authoritative && snapshot?.rowOwnerScope && sameInboxScope(snapshot.rowOwnerScope,owner)
?{scope:owner,ids:data.sessions.flatMap(session=>[session.id,session._lineage_root_id,...(session._lineage_ids ||[])].filter(Boolean))}
:null
window.dispatchEvent(new CustomEvent(INBOX_ROWS_EVENT))
inbox.update({
scope:owner,
sessions:data?.sessions ||[],liveSessions:live?.liveSessions ||[],
liveStatusKnown:authoritative && !!snapshot?.liveStatusKnown && !!live?.liveStatusKnown,
liveStatusAt:authoritative?snapshot?.liveStatusAt:undefined,
childSnapshots,
busyBySession,
busyOwnerKnown:authoritative && !!snapshot?.rowOwnerScope && sameInboxScope(snapshot.rowOwnerScope,owner),
focusedStoredSessionId:host.state.focusedStoredSessionId?.get?.()|| null,
explicitRequestedIds:data?.explicitRequestedIds,
loading:!data &&(query.isPending || query.isFetching),
error:query.error?'Could not refresh Inbox.':null,
hasMore:!!data?.hasMore,
loadMore:()=>{
if(disposed || mode !=='on' || !sameInboxScope(owner,scope))return
pageCount++
observer.setOptions(options())
project()
},
retry:()=>{
if(!disposed && mode==='on' && sameInboxScope(owner,scope))void observer.refetch()
}
})
if(authoritative && pendingEvents.length){
for(let index=0;index < pendingEvents.length;){
const item=pendingEvents[index]
if(Date.now()- item.at > 10_000 || !sameInboxScope(item.focus,owner)){
pendingEvents.splice(index,1);continue
}
const resolved=resolveLiveEvent(item.event)
const session=resolved && data.sessions.find(session=> session.id===resolved.session_id)
const ids=session &&[session.id,session._lineage_root_id,...(session._lineage_ids ||[])]
if(!session || !item.storedIds.some(id=> ids.includes(id))){index++;continue}
const key=inbox.model.key(owner,session)
if(!key){index++;continue}
pendingEvents.splice(index,1)
if([...item.settledKeys].some(settled=> inbox.model.key(owner,JSON.parse(settled)[2])===key))continue
inbox.activity?.({...resolved,canonicalSessionId:resolved.session_id})
}
}
markReady()
}
const configure=()=>{
if(disposed)return
const nextScope=inboxOwnerScope(),nextMode=readClaudeInboxMode()
if(sameInboxScope(scope,nextScope)&& mode===nextMode)return
pendingEvents.length=0
nominatedFocus.clear()
if(!sameInboxScope(scope,nextScope)){scope=nextScope;pageCount=1;metadataPreview=null}
mode=nextMode
observer.setOptions(options())
project()
}
const stopQuery=observer.subscribe(project)
const resolveLiveEvent=event=>{
const query=observer.getCurrentResult(),data=query.data
if(disposed || mode !=='on' || event.replayed || !event.session_id || query.error ||
event.connectionId !==scope.connectionId || event.profile !==scope.profile ||
!sameInboxScope(scope,inboxOwnerScope())|| data?._claudeInboxLiveAuthority !==liveAuthority)return null
const metadata=metadataPreview?.sessions || data.sessions
const canonicalId=claudeInboxCanonicalRuntime(scope,data.targetProfile,event.session_id,data.rawLiveSessions,metadata,liveOwners)
if(!canonicalId)return null
const matches=metadata.filter(session=>(session._lineage_root_id || session.id)===canonicalId)
return matches.length?{...event,session_id:matches[0].id}:null
}
const verifyLiveEvent=event=> !!resolveLiveEvent(event)
inbox.verifyLiveEvent=verifyLiveEvent
inbox.resolveLiveEvent=resolveLiveEvent
const focusChanged=()=>{
configure();rememberFocus();project()
const next=JSON.stringify(claudeInboxLiveFocus())
if(next !==lastFocus){
lastFocus=next
refreshLiveIdentity()
}
}
const busyChanged=()=>{
project()
const values=host.state.busyBySession?.get?.()||{}
const busy=new Set(Object.entries(values).filter(([,value])=> value===true).map(([id])=> id))
if([...busy].some(id=> !lastBusy.has(id)))refreshLiveIdentity()
lastBusy=busy
}
const subscriptions=[
inbox.model?.subscribe?.(event=>{
if(event?.type !=='manual-settle')return
const settledKey=inbox.model.key(event.scope,event.session)
if(!settledKey)return
for(let index=pendingEvents.length - 1;index >=0;index--){
const item=pendingEvents[index]
if(!sameInboxScope(item.focus,event.scope))continue
item.settledKeys.add(settledKey)
if(item.settledKeys.size > 64)pendingEvents.splice(index,1)
}
}),
...['profile','connectionId','focusedSessionOwner','focusedStoredSessionId','focusedSessionId'].map(name=> host.state[name]?.subscribe?.(focusChanged)),
host.state.busyBySession?.subscribe?.(busyChanged),
host.state.gateway?.subscribe?.(()=>{
if(host.state.gateway.get()!=='open'){
liveAuthority=Symbol('Inbox live connection')
metadataPreview=null
pendingEvents.length=0
nominatedFocus.clear()
liveOwners.clear()
project()
}else if(mode==='on'){
project()
void observer.refetch()
}
})
].filter(Boolean)
if(typeof host.onEvent==='function')subscriptions.push(host.onEvent('*',event=>{
if(!event.replayed &&['message.start','message.complete','error','subagent.spawn_requested','subagent.start','subagent.complete'].includes(event.type)&&
mode==='on' && event.connectionId===scope.connectionId && event.profile===scope.profile){
const currentFocus=claudeInboxLiveFocus()
if(currentFocus?.runtimeId===event.session_id)rememberFocus()
const candidates=nominations().filter(focus=> sameInboxScope(focus,scope)&& focus.runtimeId===event.session_id)
if(!verifyLiveEvent(event)&& candidates.length){
const payload={}
if(typeof event.payload?.status==='string')payload.status=event.payload.status
if(event.payload?.error)payload.error=true
if(typeof event.payload?.subagent_id==='string')payload.subagent_id=event.payload.subagent_id
pendingEvents.push({focus:{...scope},storedIds:[...new Set(candidates.map(focus=> focus.storedId))],
settledKeys:new Set(),at:Date.now(),event:{
type:event.type,...scope,session_id:event.session_id,payload
}})
if(pendingEvents.length > 64)pendingEvents.splice(0,pendingEvents.length - 64)
}
refreshLiveIdentity()
}
}))
window.addEventListener(INBOX_MODE_EVENT,configure)
const readiness=globalThis.document?.body && typeof window.MutationObserver==='function'
?new window.MutationObserver(markReady):null
readiness?.observe(document.body,{childList:true,subtree:true})
project()
const stop=()=>{
if(disposed)return
disposed=true
pendingEvents.length=0
nominatedFocus.clear()
subscriptions.forEach(unsubscribe=> unsubscribe())
window.removeEventListener(INBOX_MODE_EVENT,configure)
readiness?.disconnect()
stopQuery()
observer.destroy()
liveOwners.clear()
if(inbox.verifyLiveEvent===verifyLiveEvent)delete inbox.verifyLiveEvent
if(inbox.resolveLiveEvent===resolveLiveEvent)delete inbox.resolveLiveEvent
if(inbox.pendingWorkSessionIds===pendingWorkSessionIds)delete inbox.pendingWorkSessionIds
inbox.rowOwnerEvidence=null
markReady()
}
ctx.onDispose(stop)
return stop
}
function ClaudeSettledBadge({sessionId,inbox}){
const profile=useValue(host.state.profile)
const connectionId=useValue(host.state.connectionId)
const[,repaint]=useState(0)
useEffect(()=>{
const changed=()=> repaint(value=> value + 1)
const stopModel=inbox?.model.subscribe(changed)
window.addEventListener(INBOX_MODE_EVENT,changed)
window.addEventListener(INBOX_ROWS_EVENT,changed)
return()=>{stopModel?.();window.removeEventListener(INBOX_MODE_EVENT,changed);window.removeEventListener(INBOX_ROWS_EVENT,changed)}
},[inbox])
const currentScope={connectionId:String(connectionId || host.activeConnectionId?.()|| ''),profile:String(profile || 'default')}
const scope=claudeInboxBadgeScope(inbox,sessionId,currentScope)
if(!scope)return null
if(!inbox || readClaudeInboxMode()!=='on')return null
if(!inbox.admission?.isEligible(scope,sessionId))return null
const settled=inbox.model.isSettled(scope,sessionId)
const snoozed=inbox.model.isSnoozed?.(scope,sessionId)===true
if(!settled && !snoozed)return null
const stop=event=>{event.preventDefault();event.stopPropagation()}
const badge=(label,action,title,apply)=> jsx('button',{
type:'button',key:label,'data-claude-inbox-owned':'badge','aria-label':action,title,
onPointerDown:stop,
onClick:async event=>{
stop(event)
if(readClaudeInboxMode()!=='on' || claudeInboxBadgeScope(inbox,sessionId,inboxOwnerScope())!==scope)return
const freshOwner=await readClaudeInboxRowOwner(scope)
if(freshOwner && readClaudeInboxMode()==='on' && claudeInboxBadgeScope(inbox,sessionId,inboxOwnerScope())===scope)apply()
},
children:[
jsx('span',{className:'claude-inbox-settled',children:label}),
jsx('span',{className:'claude-inbox-unsettle',children:action})
]
})
const badges=[]
if(settled)badges.push(badge('Settled','Un-settle','Un-settle',()=> inbox.model.unsettle(scope,sessionId)))
if(snoozed){
const deadline=new Date(inbox.model.snoozedUntil(scope,sessionId)).toLocaleString()
badges.push(badge('Snoozed','Wake now',`Snoozed until ${deadline}`,()=> inbox.model.cancelSnooze(scope,sessionId)))
}
return badges.length===1?badges[0]:jsx('span',{style:{display:'inline-flex'},children:badges})
}
function connectClaudeInboxEvents(inbox){
if(!inbox || !host.onEvent)return()=>{}
return host.onEvent('*',event=>{
if(event.replayed)return
if(!event.connectionId || !event.profile || !event.session_id)return
const resolved=inbox.resolveLiveEvent?.(event)
if(!resolved)return
if(typeof inbox.activity==='function')inbox.activity({...resolved,canonicalSessionId:resolved.session_id})
else if(['message.start','tool.start'].includes(event.type)){
inbox.reactivate({type:'work',scope:{connectionId:resolved.connectionId,profile:resolved.profile},session_id:resolved.session_id,canonicalSessionId:resolved.session_id})
}
})
}


function resolveClaudeInboxMenuOpenGesture(event,{document:doc,queryClient}={}){
if(!doc || !event || event.isTrusted !==true || event.defaultPrevented ||
event.isComposing || event.keyCode===229 || event.shiftKey || event.ctrlKey ||
event.metaKey || event.altKey || event.repeat ||
(event.view && event.view !==doc.defaultView))return null
if(event.type !=='click' && event.type !=='keydown')return null
if(event.type==='click'?event.button !==0:event.key !=='Enter')return null
if(typeof queryClient?.getQueryData !=='function')return null
const commandSelector='[data-slot="command"]'
const itemSelector='[data-slot="command-item"][data-value]'
const target=event.target?.nodeType===3?event.target.parentElement:event.target
if(!target?.closest || target.ownerDocument !==doc || !target.isConnected)return null
const command=target.closest(commandSelector)
if(!command)return null
const unavailable=element=>{
for(let node=element;node;node=node.parentElement){
if(node.hasAttribute('disabled')|| node.getAttribute('aria-disabled')==='true' ||
node.getAttribute('data-disabled')==='true' || node.hasAttribute('inert')||
node.hasAttribute('hidden')|| node.getAttribute('aria-hidden')==='true' ||
node.getAttribute('data-state')==='closed')return true
}
return false
}
if(unavailable(target))return null
let item
if(event.type==='click'){
item=target.closest(itemSelector)
}else{
if(target.matches('input, textarea, [contenteditable="true"]')&&
!target.matches('[data-slot="command-input"]'))return null
const selected=[...command.querySelectorAll(`${itemSelector}[data-selected="true"]`)]
.filter(node=> node.closest(commandSelector)===command)
if(selected.length !==1)return null
item=selected[0]
}
if(!item || item.closest(commandSelector)!==command || !item.isConnected || unavailable(item))return null
const value=item.getAttribute('data-value')
if(typeof value !=='string' || !value)return null
let pickerRows,paletteRows
try{
const picker=queryClient.getQueryData(['session-picker','sessions'])
const palette=queryClient.getQueryData(['command-palette','sessions'])
pickerRows=Array.isArray(picker?.sessions)?picker.sessions:[]
paletteRows=Array.isArray(palette?.sessions)?palette.sessions:[]
}catch{return null}
const validId=id=> typeof id==='string' && id.length > 0
const rows=[...pickerRows,...paletteRows].filter(row=> row && validId(row.id))
const idsOf=row=>[row.id,row._lineage_root_id,
...(Array.isArray(row._lineage_ids)?row._lineage_ids:[])].filter(validId)
const scopeOf=row=> validId(row.connection_id)&& validId(row.profile)
?{connectionId:row.connection_id,profile:row.profile}:null
const ownerKey=row=> JSON.stringify([
typeof row.connection_id==='string'?row.connection_id:null,
typeof row.profile==='string'?row.profile:null
])
const resolveOwner=(sessionId,candidates,kind)=>{
if(!candidates.length)return null
const owners=new Set(rows.filter(row=> idsOf(row).includes(sessionId)).map(ownerKey))
if(owners.size !==1)return null
return{sessionId,scope:scopeOf(candidates[0]),kind}
}
const pickerCandidates=pickerRows.filter(row=>{
if(!row || !validId(row.id)||
(row.title !=null && typeof row.title !=='string')||
(row.preview !=null && typeof row.preview !=='string'))return false
const preview=row.preview?.trim()??''
const title=row.title?.trim()|| preview || 'Untitled session'
return value===`${title} ${preview} ${row.id}`
})
if(pickerCandidates.length){
const sessionIds=new Set(pickerCandidates.map(row=> row.id))
if(sessionIds.size !==1)return null
return resolveOwner(pickerCandidates[0].id,pickerCandidates,'picker')
}
const separator=value.lastIndexOf('\u0001')
if(separator !==-1){
const nativeId=value.slice(separator + 1)
const match=/^(session-|pinned-|goto-)(.+)$/.exec(nativeId)
if(!match)return null
const prefix=match[1],sessionId=match[2]
if(prefix==='goto-' && !/^\d{8}_\d{6}_[a-f0-9]{6}$/.test(sessionId))return null
const candidates=paletteRows.filter(row=> row && row.id===sessionId)
if(candidates.length)return resolveOwner(sessionId,candidates,'palette')
if(prefix !=='goto-' || !/^\d{8}_\d{6}_[a-f0-9]{6}$/.test(sessionId))return null
const lineageRows=rows.filter(row=> idsOf(row).includes(sessionId))
if(lineageRows.length)return resolveOwner(sessionId,lineageRows,'palette')
return{sessionId,scope:null,kind:'palette'}
}
return null
}


async function readClaudeInboxOpenedSession(thread,{stillCurrent=()=> true,expectedRootId,followLineage=false}={}){
const scope=thread?.scope,id=thread?.id
if(!id || !scope || !stillCurrent())throw new Error('Inbox open owner changed.')
const bridge=globalThis.window?.hermesDesktop
if(typeof bridge?.api !=='function')throw new Error('Inbox requires the Desktop session API.')
let resolvedId=id,lineage=null
if(followLineage || expectedRootId && expectedRootId !==id){
const rootId=expectedRootId || id
lineage=await bridge.api({
connectionId:scope.connectionId,profile:scope.profile,
path:`/api/sessions/${encodeURIComponent(rootId)}/latest-descendant?${new URLSearchParams({profile:scope.profile})}`,
timeoutMs:60_000
})
if(!stillCurrent())throw new Error('Inbox open owner changed.')
if(lineage?.requested_session_id !==rootId || !Array.isArray(lineage.path)|| lineage.path[0]!==rootId || lineage.path.at(-1)!==lineage.session_id || lineage.path.some(value=> typeof value !=='string' || !value)){
throw new Error('Inbox opened-chat lineage could not be verified.')
}
if(expectedRootId && !lineage.path.includes(id))throw Object.assign(new Error('Inbox opened-chat target does not belong to the clicked row.'),{code:'OPEN_TARGET_NOT_FOCUSED'})
if(followLineage)resolvedId=lineage.session_id
}
const row=await bridge.api({
connectionId:scope.connectionId,profile:scope.profile,
path:`/api/sessions/${encodeURIComponent(resolvedId)}?${new URLSearchParams({profile:scope.profile})}`,
timeoutMs:60_000
})
if(!stillCurrent())throw new Error('Inbox open owner changed.')
if(!row || row.id !==resolvedId || typeof row.profile !=='string')throw new Error('Inbox received incomplete opened-chat metadata.')
let targetProfile=scope.profile
if(row.profile !==targetProfile && typeof host.profileRoutes==='function'){
const routes=await host.profileRoutes()
const matches=routes.filter(route=> sameInboxScope(route,scope))
if(matches.length===1 && matches[0].targetProfile)targetProfile=matches[0].targetProfile
}
if(!stillCurrent()|| row.profile !==targetProfile || row.connection_id && row.connection_id !==scope.connectionId){
throw new Error('Inbox opened-chat owner could not be verified.')
}
return{...row,...(lineage?{_lineage_root_id:lineage.path[0],_lineage_ids:lineage.path}:{}),profile:scope.profile,connection_id:scope.connectionId}
}
function isClaudeInboxSessionNotFound(error){
const status=error?.status??error?.statusCode
if(status !=null)return status===404
const nativeStatus=/^Error invoking remote method 'hermes:api': Error: (\d{3}): /.exec(error?.message || '')
return nativeStatus?.[1]==='404'
}
async function claudeInboxUnchangedOpenOwner(sessionId,scope,stillCurrent){
const roster=await globalThis.window?.hermesDesktop?.getAgentRoster?.()
if(!stillCurrent()|| !Array.isArray(roster?.sources)|| !roster.sources.length || !Array.isArray(roster.agents))return false
if(roster.sources.some(source=> source.reachable !==true || source.error || source.needsSignIn || !source.connectionId))return false
const sources=new Set(roster.sources.map(source=> source.connectionId)),owners=new Map()
for(const owner of roster.agents){
if(!sources.has(owner.connectionId)|| typeof owner.profile !=='string' || !owner.profile)return false
owners.set(JSON.stringify([owner.connectionId,owner.profile]),owner)
}
if(!owners.has(JSON.stringify([scope.connectionId,scope.profile])))return false
if(owners.size===1)return true
let found=[]
const routes=[...owners.values()]
for(let offset=0;offset < routes.length;offset +=4){
const batch=await Promise.all(routes.slice(offset,offset + 4).map(async owner=>{
try{
await readClaudeInboxOpenedSession({id:sessionId,scope:owner},{stillCurrent})
return owner
}catch(error){
if(isClaudeInboxSessionNotFound(error))return null
throw error
}
}))
if(!stillCurrent())return false
found=found.concat(batch.filter(Boolean))
if(found.length > 1 || found.some(owner=> !sameInboxScope(owner,scope)))return false
}
return found.length===1 && sameInboxScope(found[0],scope)
}
function bindClaudeInboxNativeOpenIntent(row,sessionId,inbox,resolveGesture=null){
if(!row || !sessionId && !resolveGesture || !inbox)return()=>{}
let disposed=false,intent=null,timer=null,commitTimer=null,subscriptions=[],middlePress=null
const key=thread=> thread?JSON.stringify([thread.scope.connectionId,thread.scope.profile,thread.id]):null
const reset=()=>{
intent=null
if(timer !==null)clearTimeout(timer)
timer=null
if(commitTimer !==null)clearTimeout(commitTimer)
commitTimer=null
subscriptions.forEach(stop=> stop())
subscriptions=[]
}
const commit=async()=>{
const pending=intent,thread=claudeInboxFocusedThread()
if(disposed || !pending || pending.loading || !thread || readClaudeInboxMode()!=='on')return
if(pending.scopeHint && !sameInboxScope(pending.scopeHint,thread.scope))return
if(!sameInboxScope(thread.scope,inboxOwnerScope()))return
const targetId=pending.sessionId
const sameLineage=thread.id===targetId || inbox.model?.key(thread.scope,targetId)===inbox.model?.key(thread.scope,thread.id)
if(!sameLineage && key(thread)!==pending.before && thread.id===pending.beforeId)return
pending.loading=true
const revision=pending.revision
const stillCurrent=()=> !disposed && intent===pending && key(claudeInboxFocusedThread())===key(thread)&& sameInboxScope(thread.scope,inboxOwnerScope())
try{
if(key(thread)===pending.before && !pending.scopeHint && !await claudeInboxUnchangedOpenOwner(targetId,thread.scope,stillCurrent))return
const session=await readClaudeInboxOpenedSession(thread,{stillCurrent,expectedRootId:sameLineage?undefined:targetId})
if(stillCurrent()&& inbox.opened({explicit:true,scope:thread.scope,id:thread.id,session}))reset()
}catch(error){
if(error?.code==='OPEN_TARGET_NOT_FOCUSED' && key(thread)===pending.before)return
if(stillCurrent()){
reset()
}
}finally{
if(intent===pending){
pending.loading=false
if(pending.revision !==revision)scheduleCommit()
}
}
}
const scheduleCommit=()=>{
if(disposed || !intent || commitTimer !==null)return
commitTimer=setTimeout(()=>{commitTimer=null;void commit()},0)
}
const activate=event=>{
if(disposed || readClaudeInboxMode()!=='on' || !event.isTrusted || event.shiftKey || event.defaultPrevented)return
if(event.type==='click' && event.button !==0 || event.type==='pointerup' && event.button !==1)return
let descriptor
if(resolveGesture){
descriptor=resolveGesture(event)
if(!descriptor || !row.contains(event.target))return
}else{
const target=event.target?.closest?.('button[data-slot="row-button"]')
if(!target || !row.contains(target)|| event.target.closest?.('[data-row-actions], [data-reorder-handle]'))return
descriptor={sessionId,scope:null}
}
reset()
const before=claudeInboxFocusedThread()
intent={sessionId:descriptor.sessionId,scopeHint:descriptor.scope?{...descriptor.scope}:null,before:key(before),beforeId:before?.id,loading:false,revision:0}
subscriptions=['focusedStoredSessionId','focusedSessionOwner','profile','connectionId']
.map(name=> host.state[name]?.subscribe?.(()=>{
if(intent)intent.revision++
scheduleCommit()
})).filter(Boolean)
timer=setTimeout(reset,60_000)
scheduleCommit()
}
const pointerDown=event=>{
if(resolveGesture)return
if(!event.isTrusted || event.button !==1 || event.shiftKey || readClaudeInboxMode()!=='on')return
const target=event.target?.closest?.('button[data-slot="row-button"]')
middlePress=target && row.contains(target)&& !event.target.closest?.('[data-row-actions], [data-reorder-handle]')
?{target,pointerId:event.pointerId}:null
}
const pointerUp=event=>{
const press=middlePress
middlePress=null
if(!press || press.pointerId !==event.pointerId || press.target !==event.target?.closest?.('button[data-slot="row-button"]'))return
activate(event)
}
const pointerCancel=()=>{middlePress=null}
row.addEventListener('click',activate,true)
if(resolveGesture)row.addEventListener('keydown',activate,true)
row.addEventListener('pointerdown',pointerDown,true)
row.addEventListener('pointerup',pointerUp,true)
row.addEventListener('pointercancel',pointerCancel,true)
return()=>{
disposed=true
reset()
middlePress=null
row.removeEventListener('click',activate,true)
if(resolveGesture)row.removeEventListener('keydown',activate,true)
row.removeEventListener('pointerdown',pointerDown,true)
row.removeEventListener('pointerup',pointerUp,true)
row.removeEventListener('pointercancel',pointerCancel,true)
}
}
function ClaudeInboxNativeOpenIntent({sessionId,inbox}){
const marker=useRef(null)
useEffect(()=> bindClaudeInboxNativeOpenIntent(marker.current?.closest?.('.row-hover'),sessionId,inbox),[sessionId,inbox])
return jsx('span',{ref:marker,'aria-hidden':true,style:{display:'none'},'data-claude-inbox-open-observer':sessionId})
}
function startClaudeInboxMenuOpenObserver(ctx,inbox){
const doc=globalThis.document
if(!inbox || typeof doc?.addEventListener !=='function')return()=>{}
const stop=bindClaudeInboxNativeOpenIntent(doc,null,inbox,event=> resolveClaudeInboxMenuOpenGesture(event,{document:doc,queryClient}))
ctx.onDispose(stop)
return stop
}


const CLAUDE_INBOX_ROW_UI_CSS=`
[data-claude-inbox-row-ui]{box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;min-height:1.625rem;padding-right:.5rem;border-radius:.375rem;position:relative;}
[data-claude-inbox-row-ui]:hover{background:var(--ui-row-hover-background,transparent);}
[data-claude-inbox-row-ui][data-active='true']{background:var(--ui-row-active-background,transparent);}
[data-claude-inbox-row-ui] > [data-slot='row-button']{box-sizing:border-box;display:flex;height:100%;min-width:0;align-items:center;align-self:stretch;gap:.375rem;padding:.125rem .5rem;border:0;background:transparent;text-align:left;color:inherit;font:inherit;cursor:pointer;z-index:0;}
[data-claude-inbox-row-ui] [data-claude-inbox-lead]{display:grid;width:.875rem;height:.875rem;flex-shrink:0;place-items:center;overflow:hidden;position:relative;}
[data-claude-inbox-row-ui] [data-claude-inbox-work-dot]{box-sizing:border-box;width:6px;height:6px;border-radius:50%;background:var(--ui-text-quaternary,currentColor);color:var(--ui-text-quaternary,currentColor);opacity:0;}
[data-claude-inbox-row-ui][data-work-state='working'] [data-claude-inbox-work-dot]{background:var(--ui-text-primary,currentColor);opacity:1;}
[data-claude-inbox-row-ui][data-work-state='completed'] [data-claude-inbox-work-dot]{background:var(--ui-success,var(--ui-text-quaternary,currentColor));opacity:1;}
[data-claude-inbox-row-ui] > [data-claude-inbox-running-arc]{--claude-inbox-arc-c0:color-mix(in srgb,var(--dt-foreground,var(--ui-text-primary,currentColor)) 0%,transparent);--claude-inbox-arc-c1:var(--dt-midground,var(--ui-text-primary,currentColor));--claude-inbox-arc-c2:color-mix(in srgb,var(--claude-inbox-arc-c1) 45%,transparent);--claude-inbox-arc-angle:160deg;--claude-inbox-arc-width:.078125rem;--claude-inbox-arc-standoff:0rem;--claude-inbox-arc-duration:2.23s;box-sizing:border-box;pointer-events:none;position:absolute;overflow:hidden;border-radius:inherit;inset:calc(var(--claude-inbox-arc-standoff) * -1);padding:var(--claude-inbox-arc-width);mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;}
:root:is(.dark,[data-hermes-mode='dark']) [data-claude-inbox-row-ui] > [data-claude-inbox-running-arc]{--claude-inbox-arc-c1:var(--dt-foreground,var(--ui-text-primary,currentColor));}
[data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc]{opacity:1;}
[data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc]::before{content:'';position:absolute;top:0;left:0;width:300%;height:300%;background:linear-gradient(var(--claude-inbox-arc-angle),transparent 0%,var(--claude-inbox-arc-c0) 15%,var(--claude-inbox-arc-c1) 20%,var(--claude-inbox-arc-c2) 25%,transparent 35%,transparent 40%,var(--claude-inbox-arc-c0) 55%,var(--claude-inbox-arc-c1) 60%,var(--claude-inbox-arc-c2) 65%,transparent 75%,transparent 80%,var(--claude-inbox-arc-c0) 95%,var(--claude-inbox-arc-c1) 100%);will-change:transform;animation:claude-inbox-row-contour var(--claude-inbox-arc-duration) linear infinite;}
@keyframes claude-inbox-row-contour{0%{transform:translate(-10%,-10%);}100%{transform:translate(-50%,-50%);}}
[data-claude-inbox-row-ui] [data-claude-inbox-title-wrap]{min-width:0;flex:1;align-self:center;}
[data-claude-inbox-row-ui] [data-claude-inbox-label]{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8125rem;line-height:1.35;font-weight:400;color:var(--ui-text-secondary,inherit);}
[data-claude-inbox-row-ui]:is(:hover,:focus-within,[data-active='true']) [data-claude-inbox-label]{color:var(--ui-text-primary,inherit);}
[data-claude-inbox-row-ui] > [data-row-actions]{display:flex;flex-shrink:0;align-items:center;align-self:stretch;}
[data-claude-inbox-row-ui] > [data-row-actions] > button{box-sizing:border-box;display:inline-flex;width:1.5rem;height:1.5rem;flex-shrink:0;align-items:center;justify-content:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--ui-text-secondary,inherit);font:inherit;cursor:pointer;opacity:0;pointer-events:none;transition:opacity 100ms;}
[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > button{opacity:1;pointer-events:auto;}
[data-claude-inbox-row-ui] > [data-row-actions] > button:hover{background:var(--chrome-action-hover,var(--ui-control-hover-background,transparent));color:var(--ui-text-primary,inherit);}
[data-claude-inbox-row-ui] button:focus-visible{outline:1px solid var(--ui-accent,currentColor);outline-offset:-1px;}
[data-claude-inbox-row-ui] button:disabled{cursor:default;}
[data-claude-inbox-row-ui] > [data-row-actions] > button:disabled{pointer-events:none;}
[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > button:disabled{opacity:.5;}
[data-claude-inbox-row-ui] > [data-row-actions] > [data-claude-inbox-settle]{opacity:1;pointer-events:auto;}
[data-claude-inbox-row-ui] > [data-row-actions] > [data-claude-inbox-settle]:disabled,[data-claude-inbox-row-ui]:is(:hover,:focus-within) > [data-row-actions] > [data-claude-inbox-settle]:disabled{opacity:0;visibility:hidden;pointer-events:none;transition:none;}
[data-claude-inbox-row-ui] svg{display:block;width:.75rem;height:.75rem;pointer-events:none;flex-shrink:0;}
@media (prefers-reduced-motion:reduce){[data-claude-inbox-row-ui][data-work-state='working'] > [data-claude-inbox-running-arc]::before{animation:none;}
[data-claude-inbox-row-ui] > [data-row-actions] > button{transition:none;}}
`;
function createClaudeInboxRowUI({document:doc,onOpen,onMenu,onSnooze}){
if(!doc || typeof doc.createElement !=='function')throw new TypeError('document is required');
const make=(tag,className,marker)=>{
const node=doc.createElement(tag);
node.className=className;
if(marker)node.setAttribute(marker,'');
return node;
};
const row=make('div','min-h-[1.625rem] pr-2 grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-md group row-hover relative','data-claude-inbox-row-ui');
const go=make('button','pl-2 pr-2 gap-1.5 flex h-full min-w-0 items-center self-stretch py-0.5 bg-transparent text-left z-0','data-claude-inbox-open');
go.type='button';
go.setAttribute('data-slot','row-button');
const lead=make('span','grid size-3.5 shrink-0 place-items-center overflow-hidden','data-claude-inbox-lead');
lead.setAttribute('aria-hidden','true');
const workDot=make('span','','data-claude-inbox-work-dot');
const runningArc=make('span','','data-claude-inbox-running-arc');
runningArc.setAttribute('aria-hidden','true');
lead.append(workDot);
const wrap=make('span','min-w-0 flex-1 self-center','data-claude-inbox-title-wrap');
const label=make('span','min-w-0 truncate text-[0.8125rem] text-(--ui-text-secondary) leading-[1.35] hover-marquee block font-normal group-hover:text-foreground group-data-[working=true]:text-foreground/90','data-claude-inbox-label');
const text=make('span','hover-marquee-inner');
label.append(text);wrap.append(label);go.append(lead,wrap);
const actions=make('div','flex shrink-0 items-center self-stretch','data-row-actions');
const glyphButton=(marker,name,paths)=>{
const button=make('button','inline-flex shrink-0 cursor-pointer items-center justify-center size-6 rounded-[4px] text-(--ui-text-secondary) bg-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100',marker);
button.type='button';
button.setAttribute('data-slot','button');
button.setAttribute('data-size','icon-xs');
button.setAttribute('data-variant','ghost');
button.setAttribute('aria-label',name);button.title=name;
const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');
svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
svg.setAttribute('stroke-width','1.25');svg.setAttribute('stroke-linecap','round');
for(const d of paths){
const path=doc.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);
}
button.append(svg);return button;
};
const menu=glyphButton('data-claude-inbox-menu','Inbox row options',['M3 8h.01M8 8h.01M13 8h.01']);
menu.firstChild.setAttribute('stroke-width','2.5');
menu.setAttribute('aria-haspopup','menu');menu.setAttribute('aria-expanded','false');
const clock=glyphButton('data-claude-inbox-snooze','Snooze',['M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5','M8 4.5V8l2.5 1.5']);
actions.append(menu,clock);row.append(go,actions,runningArc);
row.addEventListener('pointerdown',event=> event.stopPropagation());
for(const[button,callback]of[[go,onOpen],[menu,onMenu],[clock,onSnooze]]){
button.addEventListener('click',event=>{
event.stopPropagation();
if(!button.disabled && typeof callback==='function')callback(event);
});
}
let settleAction=false;
let menuTitle=null;
const workStates=new Set(['working','completed','reading','unknown','idle']);
const update=(state={})=>{
if('title' in state){text.textContent=String(state.title??'');go.title=text.textContent;}
if('selected' in state){
row.classList.toggle('bg-(--ui-row-active-background)',Boolean(state.selected));
row.setAttribute('data-active',String(Boolean(state.selected)));
if(state.selected)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');
}
if('disabled' in state){go.disabled=Boolean(state.disabled);clock.disabled=Boolean(state.disabled);}
if('menuDisabled' in state || 'disabled' in state){
if('menuDisabled' in state)menu.dataset.menuDisabled=String(Boolean(state.menuDisabled));
menu.disabled=go.disabled || menu.dataset.menuDisabled==='true';
}
if('workState' in state){
const next=workStates.has(state.workState)?state.workState:'unknown';
if(next==='working' && row.getAttribute('data-work-state')!=='working'){
const now=doc.timeline?.currentTime??doc.defaultView?.performance?.now?.()??0;
row.style.setProperty('--claude-inbox-dot-phase',`${-Math.round(Number(now)% 1200)}ms`);
}
row.setAttribute('data-work-state',next);
}
if('settleAction' in state){
settleAction=Boolean(state.settleAction);
const firstAction=settleAction?clock:menu;
if(actions.firstElementChild !==firstAction)actions.insertBefore(firstAction,actions.firstChild);
menu.toggleAttribute('data-claude-inbox-settle',settleAction);
menu.firstChild.firstChild.setAttribute('d',settleAction?'M3.5 8.5l3 3 6-7':'M3 8h.01M8 8h.01M13 8h.01');
menu.firstChild.setAttribute('stroke-width',settleAction?'1.25':'2.5');
if(settleAction){
menu.removeAttribute('aria-haspopup');menu.removeAttribute('aria-expanded');
}else{
menu.setAttribute('aria-haspopup','menu');menu.setAttribute('aria-expanded','false');
}
}
if('menuTitle' in state)menuTitle=state.menuTitle==null?null:String(state.menuTitle);
if('menuTitle' in state || 'settleAction' in state){
const name=menuTitle??(settleAction?'Settle':'Inbox row options');
menu.title=name;menu.setAttribute('aria-label',name);
}
};
update({title:'',selected:false,disabled:false,menuDisabled:false,workState:'idle'});
return{row,go,label,lead,actions,menu,clock,update};
}
globalThis.CLAUDE_INBOX_ROW_UI_CSS=CLAUDE_INBOX_ROW_UI_CSS;
globalThis.createClaudeInboxRowUI=createClaudeInboxRowUI;


const CLAUDE_INBOX_STORE='inbox-state-v1';
function claudeInboxScope(scope){
if(!scope || typeof scope.profile !=='string' || !scope.profile)return null;
if(typeof scope.connectionId !=='string')return null;
return{connectionId:scope.connectionId,profile:scope.profile};
}
function claudeInboxId(session){
const id=typeof session==='string'?session:session?.id??session?.session_id;
return typeof id==='string' && id?id:null;
}
function claudeInboxOwnedBy(scope,session){
return !!scope &&(!session?.profile || session.profile===scope.profile)&&
(session?._connection_id==null || session._connection_id===scope.connectionId)&&
(session?.connectionId==null || session.connectionId===scope.connectionId)&&
(session?.connection_id==null || session.connection_id===scope.connectionId);
}
function claudeInboxKey(scope,durableId){
const valid=claudeInboxScope(scope);
const id=claudeInboxId(durableId);
return valid && id?JSON.stringify([valid.connectionId,valid.profile,id]):null;
}
function claudeInboxWorkStatus(value){
const status=typeof value==='string'?value:value?.status??value?.state;
if(status==='resuming')return 'reading';
if(value===true || value?.busy===true)return 'work';
if(value===false)return 'idle';
if(['starting','running','working','streaming','waiting','needs-input','queued'].includes(status))return 'work';
if(['idle','resuming','completed','done','stopped'].includes(status))return status==='resuming'?'reading':'idle';
return 'unknown';
}
function createClaudeInboxModel(storage,{restoreAttention}={}){
let state={version:1,records:{},aliases:{}};
let error=null;
const listeners=new Set();
const expired=new Map();
const validTimestamp=value=> Number.isSafeInteger(value)&& value > 0 && value <=8640000000000000;
const notify=event=>{for(const fn of listeners){try{fn(event);}catch{ /* A view subscriber cannot undo a saved model transaction. */}}};
const validKey=key=>{
try{const p=JSON.parse(key);return Array.isArray(p)&& p.length===3 && typeof p[0]==='string' && p.slice(1).every(v=> typeof v==='string' && v);}
catch{return false;}
};
const read=()=>{
const raw=storage?.get?.(CLAUDE_INBOX_STORE);
const saved=typeof raw==='string'?JSON.parse(raw):raw;
if(saved==null)return null;
const next={version:1,records:{},aliases:{}};
if(saved.version !==1 || !saved.records || !saved.aliases)throw Error('Invalid Inbox state');
for(const[key,record]of Object.entries(saved.records)){
if(!validKey(key)|| !record || typeof record !=='object')continue;
const watermarks={};
for(const[id,count]of Object.entries(record.watermarks ||{})){
if(id && Number.isSafeInteger(count)&& count >=0)Object.defineProperty(watermarks,id,{value:count,enumerable:true,writable:true,configurable:true});
}
next.records[key]={
settledAt:Number.isFinite(record.settledAt)&& record.settledAt > 0?record.settledAt:null,watermarks,
snoozeUntil:validTimestamp(record.snoozeUntil)?record.snoozeUntil:null,
snoozedAt:validTimestamp(record.snoozedAt)?record.snoozedAt:validTimestamp(record.snoozeUntil)?1:null,
...(record.manualSettled===true?{manualSettled:true}:{})
};
}
for(const[alias,root]of Object.entries(saved.aliases)){
if(!validKey(alias)|| !validKey(root))continue;
const a=JSON.parse(alias),r=JSON.parse(root);
if(a[0]===r[0]&& a[1]===r[1]&& next.records[root])next.aliases[alias]=root;
}
return next;
};
try{state=read()|| state;}
catch{error='Inbox state could not be read. Settle and Snooze are unavailable until storage recovers.';}
const refresh=()=>{try{state=read()|| state;}catch{ /* kept */}};
const putCount=(record,id,count)=>{
const previous=Object.prototype.hasOwnProperty.call(record.watermarks,id)?record.watermarks[id]:0;
Object.defineProperty(record.watermarks,id,{value:Math.max(previous,count),enumerable:true,writable:true,configurable:true});
};
const accept=(scope,session)=>{
if(!claudeInboxKey(scope,session))return false;
if(typeof session !=='object' || !session)return true;
return claudeInboxOwnedBy(scope,session);
};
const rootKey=(draft,scope,session)=>{
if(!accept(scope,session))return null;
const own=claudeInboxKey(scope,session);
const declared=typeof session==='object'?claudeInboxKey(scope,session._lineage_root_id):null;
return draft.aliases[declared]|| declared || draft.aliases[own]|| own;
};
const associate=(draft,scope,session)=>{
const key=rootKey(draft,scope,session);
if(!key)return null;
const own=claudeInboxKey(scope,session);
const ids=[claudeInboxId(session),...(Array.isArray(session?._lineage_ids)?session._lineage_ids:[])];
if(session?._lineage_root_id)ids.push(session._lineage_root_id);
const record=draft.records[key]||{settledAt:null,watermarks:{},snoozeUntil:null,snoozedAt:null};
for(const id of ids){
const alias=claudeInboxKey(scope,id);
if(!alias)continue;
const priorKey=draft.aliases[alias]|| alias;
const prior=draft.records[priorKey];
if(prior && prior !==record){
record.settledAt=Math.max(record.settledAt || 0,prior.settledAt || 0)|| null;
if(prior.settledAt && prior.manualSettled===true)record.manualSettled=true;
if((prior.snoozedAt || 0)>(record.snoozedAt || 0)||
(prior.snoozedAt && prior.snoozedAt===record.snoozedAt && !prior.snoozeUntil)){
record.snoozeUntil=prior.snoozeUntil;record.snoozedAt=prior.snoozedAt;
}
for(const[pid,count]of Object.entries(prior.watermarks))putCount(record,pid,count);
for(const[a,target]of Object.entries(draft.aliases))if(target===priorKey)draft.aliases[a]=key;
delete draft.records[priorKey];
}
draft.aliases[alias]=key;
}
draft.aliases[own]=key;
draft.records[key]=record;
return{key,record,id:claudeInboxId(session)};
};
const snoozeTime=draft=>{
let at=Date.now();
for(const record of Object.values(draft.records))at=Math.max(at,(record.snoozedAt || 0)+ 1);
return Math.min(at,8640000000000000);
};
const transaction=(change,event)=>{
refresh();
const draft=JSON.parse(JSON.stringify(state));
const result=change(draft);
if(result===false)return false;
if(JSON.stringify(draft)===JSON.stringify(state)){
if(event)notify(event);
return result;
}
try{
if(typeof storage?.set !=='function')throw Error('Storage unavailable');
storage.set(CLAUDE_INBOX_STORE,draft);
const saved=storage.get?.(CLAUDE_INBOX_STORE);
const parsed=typeof saved==='string'?JSON.parse(saved):saved;
const canonical=value=> JSON.stringify(value,(_,item)=> item && typeof item==='object' && !Array.isArray(item)
?Object.fromEntries(Object.entries(item).sort(([a],[b])=> a < b?-1:a > b?1:0)):item);
if(canonical(parsed)!==canonical(draft))throw Error('Inbox storage readback failed');
state=draft;
error=null;
notify(event);
return result;
}catch{
error='Inbox state could not be saved. No Inbox changes were applied.';
notify();
return false;
}
};
return{
key:(scope,session)=> rootKey(state,scope,session),
isSettled(scope,session){const key=rootKey(state,scope,session);return !!(key && state.records[key]?.settledAt);},
isManualSettled(scope,session){const key=rootKey(state,scope,session);return !!(key && state.records[key]?.settledAt && state.records[key].manualSettled===true);},
snoozedUntil(scope,session){const key=rootKey(state,scope,session);return key && state.records[key]?.snoozeUntil || null;},
isSnoozed(scope,session,now=Date.now()){
const key=rootKey(state,scope,session);
return !!(key && state.records[key]?.snoozeUntil > now);
},
snooze(scope,session,until){
if(!validTimestamp(until)|| until <=Date.now())return false;
return transaction(draft=>{
const item=associate(draft,scope,session);
if(!item)return false;
item.record.snoozeUntil=until;item.record.snoozedAt=snoozeTime(draft);
return true;
});
},
cancelSnooze(scope,session){
const restoreKey=rootKey(state,scope,session);
if(state.records[restoreKey]?.snoozeUntil && restoreAttention?.(scope,session)===false){notify();return false;}
return transaction(draft=>{
const key=rootKey(draft,scope,session);
if(!key)return false;
if(draft.records[key]?.snoozeUntil){
draft.records[key].snoozeUntil=null;draft.records[key].snoozedAt=snoozeTime(draft);
}
return true;
});
},
nextSnoozeDeadline(now=Date.now()){
let next=null;
for(const record of Object.values(state.records)){
if(record.snoozeUntil > now &&(next===null || record.snoozeUntil < next))next=record.snoozeUntil;
}
return next;
},
expireSnoozes(now=Date.now()){
let changed=false;
for(const[key,record]of Object.entries(state.records)){
const token=JSON.stringify([record.snoozedAt,record.snoozeUntil]);
if(record.snoozeUntil && record.snoozeUntil <=now && expired.get(key)!==token){
expired.set(key,token);changed=true;
}
}
if(changed)notify();
return changed;
},
settle(scope,session,options={}){
return transaction(draft=>{
const item=associate(draft,scope,session);
if(!item)return false;
const count=session?.message_count;
if(Number.isSafeInteger(count)&& count >=0)putCount(item.record,item.id,count);
item.record.settledAt=Date.now();
if(options.manual===true)item.record.manualSettled=true;
else delete item.record.manualSettled;
return true;
},options.manual===true?{type:'manual-settle',scope,session}:undefined);
},
unsettle(scope,session){
const restoreKey=rootKey(state,scope,session);
if(state.records[restoreKey]?.settledAt && restoreAttention?.(scope,session)===false){notify();return false;}
return transaction(draft=>{
const key=rootKey(draft,scope,session);
if(!key)return false;
if(draft.records[key]){draft.records[key].settledAt=null;delete draft.records[key].manualSettled;}
return true;
});
},
reopen(scope,session){
if(restoreAttention?.(scope,session)===false){notify();return false;}
return transaction(draft=>{
const item=associate(draft,scope,session);
if(!item)return false;
item.record.settledAt=null;delete item.record.manualSettled;
if(item.record.snoozeUntil){
item.record.snoozeUntil=null;item.record.snoozedAt=snoozeTime(draft);
}
return true;
});
},
ingest(scope,sessions=[],options={}){
if(!claudeInboxScope(scope))return false;
return transaction(draft=>{
for(const session of sessions){
const item=associate(draft,scope,session);
if(!item)continue;
const count=session?.message_count;
if(Number.isSafeInteger(count)&& count >=0){
const previous=Object.prototype.hasOwnProperty.call(item.record.watermarks,item.id)?item.record.watermarks[item.id]:undefined;
if(previous !==undefined && count > previous && item.record.manualSettled !==true)item.record.settledAt=null;
putCount(item.record,item.id,count);
}
}
for(const session of options.liveSessions ||[]){
if(!accept(scope,session)|| claudeInboxWorkStatus(session)!=='work')continue;
const item=associate(draft,scope,session);
if(item && item.record.manualSettled !==true)item.record.settledAt=null;
}
return true;
});
},
subscribe(fn){listeners.add(fn);return()=> listeners.delete(fn);},
get error(){return error;}
};
}
function claudeInboxSource(session){
if(!session || typeof session !=='object')return 'unknown';
const source=session.source,created=session.created_source;
if(source==='cron' || created==='cron')return 'cron';
const known=['desktop','tui','cli','web','local','api','api_server','tool','subagent','kanban',
'telegram','discord','whatsapp','whatsapp_cloud','slack','signal','mattermost','matrix',
'homeassistant','email','sms','dingtalk','webhook','msgraph_webhook','feishu','wecom',
'wecom_callback','weixin','bluebubbles','qqbot','yuanbao','relay',
'line','teams','ntfy','simplex','irc','a2a','raft','buzz','photon','google_chat'];
if(!known.includes(source)|| created !=null && !known.includes(created))return 'unknown';
return 'noncron';
}
function createClaudeInboxAdmission(storage,model){
const storeKey='inbox-admission-v2';
let state={version:2,admitted:{},blocked:{}},error=null,readable=false;
const pendingAdmissions=new Map(),blocked=new Set(),sources=new Map();
const scopeKey=scope=>{const valid=claudeInboxScope(scope);return valid?JSON.stringify([valid.connectionId,valid.profile]):null;};
const validKey=(key,length)=>{
try{const tuple=JSON.parse(key);return Array.isArray(tuple)&& tuple.length===length && typeof tuple[0]==='string' && tuple.slice(1).every(v=> typeof v==='string' && v);}
catch{return false;}
};
const canonical=value=> JSON.stringify(value,(_,item)=> item && typeof item==='object' && !Array.isArray(item)
?Object.fromEntries(Object.entries(item).sort(([a],[b])=> a < b?-1:a > b?1:0)):item);
const load=()=>{
try{
if(typeof storage?.get !=='function')throw Error('Storage unavailable');
const raw=storage.get(storeKey),saved=typeof raw==='string'?JSON.parse(raw):raw;
if(saved !=null){
const objectMap=value=> value && typeof value==='object' && !Array.isArray(value);
if(saved.version !==2 || !objectMap(saved.admitted)|| !objectMap(saved.blocked))throw Error('Invalid Inbox admission');
for(const records of[saved.admitted,saved.blocked]){
for(const[key,value]of Object.entries(records))if(!validKey(key,3)|| value !==true)throw Error('Invalid Inbox admission');
}
state=JSON.parse(JSON.stringify(saved));
Object.keys(state.blocked).forEach(key=> blocked.add(key));
}
readable=true;error=null;return true;
}catch{
readable=false;error='Inbox admission could not be read. Historical chats remain excluded until storage recovers.';return false;
}
};
load();
const ids=session=>[...new Set([claudeInboxId(session),session?._lineage_root_id,
...(Array.isArray(session?._lineage_ids)?session._lineage_ids:[])].filter(id=> typeof id==='string' && id))];
const keys=(scope,session)=>[...new Set([...ids(session).map(id=> claudeInboxKey(scope,id)),model?.key(scope,session)].filter(Boolean))];
const allowed=(scope,session)=>{
if(!scopeKey(scope)|| !claudeInboxOwnedBy(scope,session))return false;
const rowKeys=keys(scope,session);
if(!rowKeys.length || rowKeys.some(key=> blocked.has(key)|| state.blocked[key]))return false;
if(session && typeof session==='object' && Object.hasOwn(session,'source')){
if(claudeInboxSource(session)!=='noncron')return false;
}else if(session && typeof session==='object' && Object.keys(session).some(key=>
!['id','session_id','profile','connectionId','connection_id','_connection_id','_lineage_root_id','_lineage_ids'].includes(key)))return false;
return !rowKeys.some(key=> sources.has(key)&& sources.get(key)!=='noncron');
};
const eligible=(draft,scope,session)=> allowed(scope,session)&& keys(scope,session).some(key=> draft.admitted[key]===true);
const recordSessionIds=(scope,records)=>{
if(!readable || !scopeKey(scope))return[];
const owner=scopeKey(scope),ids=new Map();
for(const key of Object.keys(records)){
const tuple=JSON.parse(key);
if(JSON.stringify(tuple.slice(0,2))===owner)ids.set(model?.key(scope,tuple[2])|| key,tuple[2]);
}
return[...ids.values()];
};
return{
cutoff:()=> null,
isEligible:(scope,session)=> readable && eligible(state,scope,session),
restore:(scope,session)=> readable && eligible(state,scope,session),
explicitSessionIds(){return[];},
admittedSessionIds(scope){return recordSessionIds(scope,state.admitted).filter(id=> allowed(scope,id));},
observe(scope,sessions=[],options={}){
const owner=scopeKey(scope);
if(!owner)return false;
if(!pendingAdmissions.has(owner))pendingAdmissions.set(owner,new Set());
const pending=pendingAdmissions.get(owner),working=new Set();
const rows=sessions.filter(session=> claudeInboxId(session)&& claudeInboxOwnedBy(scope,session));
const classifications=new Map(),provenance=new Map();
for(const session of rows){
const source=claudeInboxSource(session);
for(const key of keys(scope,session)){
const prior=classifications.get(key);
const conflict=prior==='noncron' && source==='noncron' && provenance.get(key)!==session.source;
classifications.set(key,prior==='cron' || source==='cron'?'cron':conflict || prior && prior !==source?'unknown':source);
if(!provenance.has(key))provenance.set(key,session.source);
}
}
classifications.forEach((source,key)=>{sources.set(key,source);if(source==='cron')blocked.add(key);});
let changed;
do{
changed=false;
for(const session of rows){
const rowKeys=keys(scope,session);
if(rowKeys.some(key=> blocked.has(key)))for(const key of rowKeys)if(!blocked.has(key)){blocked.add(key);changed=true;}
}
}while(changed);
for(const session of options.workingSessions ||[])if(allowed(scope,session)&& claudeInboxSource(session)==='noncron')keys(scope,session).forEach(key=> working.add(key));
for(const live of options.liveSessions ||[]){
if(!claudeInboxOwnedBy(scope,live)|| claudeInboxWorkStatus(live)!=='work')continue;
const liveIds=[...ids(live),live.session_key,live.stored_session_id].filter(Boolean);
for(const row of rows)if(allowed(scope,row)&& claudeInboxSource(row)==='noncron' && ids(row).some(id=> liveIds.includes(id)))keys(scope,row).forEach(key=> working.add(key));
}
working.forEach(key=> pending.add(key));
if(!load())return false;
const draft=JSON.parse(JSON.stringify(state));
for(const session of rows){
if(!allowed(scope,session)|| claudeInboxSource(session)!=='noncron')continue;
const rowKeys=keys(scope,session);
if(eligible(draft,scope,session)|| rowKeys.some(key=> working.has(key))){
for(const key of rowKeys){draft.admitted[key]=true;pending.add(key);}
}
}
for(const key of pending)if(!blocked.has(key)&& sources.get(key)==='noncron')draft.admitted[key]=true;
for(const key of blocked){draft.blocked[key]=true;delete draft.admitted[key];pending.delete(key);}
if(canonical(draft)===canonical(state)&& !error){pending.clear();return true;}
try{
if(typeof storage?.set !=='function')throw Error('Storage unavailable');
storage.set(storeKey,draft);
const raw=storage.get(storeKey),saved=typeof raw==='string'?JSON.parse(raw):raw;
if(canonical(saved)!==canonical(draft))throw Error('Inbox admission readback failed');
state=draft;pending.clear();error=null;return true;
}catch{
error='Inbox admission could not be saved. New admissions were not applied; existing attention is preserved.';return false;
}
},
get error(){return error;}
};
}
function installClaudeInboxRuntime({storage,host,document:doc=document,window:win=window}){
const registryKey='__claudeInboxRuntimeDispose';
doc[registryKey]?.();
let admission;
const model=createClaudeInboxModel(storage,{
restoreAttention:(scope,session)=> admission.restore(scope,session)
});
admission=createClaudeInboxAdmission(storage,model);
let on=false;
try{on=storage?.get?.('inbox','off')==='on';}catch{ /* Fail closed until the parent supplies a mode. */}
let disposed=false,raf=null,island=null,style=null,container=null,toasts=null;
let deadlineTimer=null,armingDeadline=false,snoozePopup=null;
const rowBindings=new Map();
const settleNotices=new Map();
const activityByKey=new Map();
const timerHost=win.setTimeout?win:doc.defaultView;
const clearDeadline=()=>{if(deadlineTimer !==null)timerHost.clearTimeout(deadlineTimer);deadlineTimer=null;};
const refreshDeadline=()=>{
if(armingDeadline)return;
armingDeadline=true;
try{
clearDeadline();
if(disposed || !on)return;
model.expireSnoozes();
const next=model.nextSnoozeDeadline();
if(next !==null)deadlineTimer=timerHost.setTimeout(()=>{
deadlineTimer=null;refreshDeadline();requestRender();
},Math.max(1,Math.min(2147483647,next - Date.now())));
}finally{armingDeadline=false;}
};
let inboxOpen=true,signature=null,currentScope=null;
let input={sessions:[],liveSessions:[],liveStatusKnown:false,loading:true};
const badgeBindings=new Map();
const settledBadgeBindings=new Map();
const externalBindings=new Map();
const own='data-claude-inbox-owned';
const owns=node=> node?.nodeType===1?!!node.closest(`[${own}]`):!!node?.parentElement?.closest(`[${own}]`);
const setAttr=(el,name,value)=>{if(el.getAttribute(name)!==String(value))el.setAttribute(name,String(value));};
const visibleSessions=()=>{
const rows=new Map();
for(const session of input.sessions){
if(!claudeInboxId(session)|| session.archived || session.hidden || !claudeInboxOwnedBy(currentScope,session))continue;
const key=model.key(currentScope,session);
if(!rows.has(key))rows.set(key,session);
}
return[...rows.values()];
};
const inboxSessions=()=> visibleSessions().filter(session=> admission.isEligible(currentScope,session));
const findSession=id=> visibleSessions().find(s=> claudeInboxId(s)===id || s._lineage_root_id===id || s._lineage_ids?.includes(id));
const durableAliases=session=> new Set([claudeInboxId(session),session?._lineage_root_id,...(session?._lineage_ids ||[])].filter(Boolean));
const liveMatches=(session,live)=>{
const ids=durableAliases(session);
if(Object.hasOwn(live,'_claudeInboxCanonicalId'))return typeof live._claudeInboxCanonicalId==='string' && ids.has(live._claudeInboxCanonicalId);
const stored=[live.session_key,live.stored_session_id,live._lineage_root_id,...(live._lineage_ids ||[])].filter(Boolean);
if(stored.length)return stored.some(id=> ids.has(id));
return[live.id,live.session_id].some(id=> ids.has(id));
};
const eventSession=event=>{
if(Object.hasOwn(event,'canonicalSessionId'))return typeof event.canonicalSessionId==='string' && event.canonicalSessionId
?findSession(event.canonicalSessionId):null;
const id=event.session_id || event.id || event.session_key;
return findSession(id)|| visibleSessions().find(session=> runtimeAliases(session).has(id));
};
const runtimeAliases=session=>{
const aliases=durableAliases(session);
for(const live of input.liveSessions ||[]){
if(!claudeInboxOwnedBy(currentScope,live)|| !liveMatches(session,live))continue;
const runtimeId=live.session_id || live.id;
if(runtimeId)aliases.add(runtimeId);
}
return aliases;
};
const safety=(session,admissionCheck=false)=>{
let unresolved=input.liveStatusKnown !==true;
let reading=false;
for(const live of input.liveSessions ||[]){
if(!claudeInboxOwnedBy(currentScope,live))continue;
if(!liveMatches(session,live))continue;
const status=claudeInboxWorkStatus(live);
if(status==='work')return 'work';
if(status==='unknown')unresolved=true;
if(status==='reading')reading=true;
}
for(const id of admissionCheck && input.busyOwnerKnown===false?[]:durableAliases(session)){
const busy=input.busyBySession instanceof Map?input.busyBySession.get(id):input.busyBySession?.[id];
if(busy===undefined)continue;
const status=claudeInboxWorkStatus(busy);
if(status==='work')return 'work';
if(status==='unknown')unresolved=true;
if(status==='reading')reading=true;
}
return unresolved?'unknown':reading?'reading':'idle';
};
const freshChildSnapshot=snapshot=>{
if(typeof snapshot?.session_id !=='string' || !snapshot.session_id || !Number.isFinite(snapshot.at)|| snapshot.at <=0 ||
!Array.isArray(snapshot.childIds)|| snapshot.childIds.some(id=> typeof id !=='string' || !id))return null;
const session=findSession(snapshot.session_id);
if(!session)return null;
const key=model.key(currentScope,session),previous=activityByKey.get(key);
if(snapshot.at <=(previous?.childEventAt || 0)|| snapshot.at <=(previous?.childSnapshotAt || 0))return null;
const childIds=snapshot.childIds.filter(id=> !previous?.terminalChildren?.has(id)&&
(!previous?.terminalChildrenOverflow || previous.children?.has(id)|| previous.pendingChildren?.has(id)));
return{session,key,previous,childIds};
};
const reconcileAdmission=()=>{
const sessions=visibleSessions(),working=input.loading || input.error || input.liveStatusKnown !==true?[]:sessions.filter(session=> safety(session,true)==='work');
const childWorking=input.loading || input.error || input.liveStatusKnown !==true?[]:(input.childSnapshots ||[])
.map(freshChildSnapshot).filter(fresh=> fresh?.childIds.length).map(fresh=> fresh.session);
admission.observe(currentScope,input.sessions,{workingSessions:[...working,...childWorking]});
model.ingest(currentScope,sessions,{liveSessions:working.map(session=>({...session,status:'working'}))});
};
const reconcileActivity=()=>{
if(input.loading || input.error)return;
for(const session of inboxSessions()){
const key=model.key(currentScope,session),previous=activityByKey.get(key);
const status=safety(session,true),newer=Number.isFinite(input.liveStatusAt)&& input.liveStatusAt >(previous?.at || 0);
if(status==='work' && !previous?.parentFinished && !['completed','read'].includes(previous?.phase)&&(!previous || newer)){
activityByKey.set(key,{...previous,phase:'working',at:input.liveStatusAt || Date.now(),children:previous?.children || new Set()});
}else if(status==='idle' && previous?.phase==='working' && newer){
activityByKey.set(key,{...previous,phase:session.unread===true?'completed':'unknown',at:input.liveStatusAt});
}
}
};
const reconcileChildActivity=()=>{
if(input.loading || input.error || input.liveStatusKnown !==true)return;
for(const snapshot of input.childSnapshots ||[]){
const fresh=freshChildSnapshot(snapshot);
if(!fresh)continue;
const{key,previous,childIds}=fresh;
const pendingChildren=new Set([...(previous?.pendingChildren ||[])].filter(id=> !childIds.includes(id)));
activityByKey.set(key,{...previous,phase:previous?.phase || 'unknown',at:previous?.at || 0,
children:new Set([...childIds,...pendingChildren]),pendingChildren,childSnapshotAt:snapshot.at});
}
};
const viewedReply=session=>{
const owner=claudeInboxScope(host.state?.focusedSessionOwner?.get?.());
const stored=host.state?.focusedStoredSessionId?.get?.();
const runtime=host.state?.focusedSessionId?.get?.();
if(!owner || !stored || !runtime || JSON.stringify(owner)!==JSON.stringify(currentScope)||
!runtimeAliases(session).has(stored)|| doc.visibilityState !=='visible' || !doc.hasFocus())return false;
const anchors=new Set([...runtimeAliases(session)].map(id=> `session-tile:${id}`));
if(host.state?.activeSessionId?.get?.()===runtime &&
host.state?.connectionId?.get?.()===owner.connectionId && host.state?.profile?.get?.()===owner.profile)anchors.add('workspace');
for(const surface of doc.querySelectorAll('[data-chat-surface][data-session-anchor]')){
if(!anchors.has(surface.getAttribute('data-session-anchor'))||
surface.closest('[data-pane-hidden], [inert], [aria-hidden="true"], [data-session-switching]'))continue;
const viewport=surface.querySelector('[data-slot="aui_thread-viewport"]');
if(!viewport || viewport.getAttribute('data-following')!=='true')continue;
const pair=[...viewport.querySelectorAll('[data-slot="aui_turn-pair"]')].at(-1);
const reply=pair &&[...pair.querySelectorAll('[data-slot="aui_assistant-message-root"]')]
.filter(root=> root.closest('[data-slot="aui_turn-pair"]')===pair && root.querySelector('[data-slot="aui_msg-actions"]')).at(-1);
if(!reply)continue;
const bounds=viewport.getBoundingClientRect(),end=reply.getBoundingClientRect();
if(bounds.width > 0 && bounds.height > 0 && end.width > 0 && end.height > 0 &&
end.bottom > bounds.top && end.bottom <=bounds.bottom + 1 && end.right > bounds.left && end.left < bounds.right)return true;
}
return false;
};
const workState=session=>{
if(input.loading || input.error || input.liveStatusKnown !==true)return 'unknown';
const key=model.key(currentScope,session),status=safety(session,true),activity=activityByKey.get(key);
if(status==='unknown')return 'unknown';
if(activity?.children.size)return 'working';
if(status==='reading')return 'reading';
if(activity?.phase==='working')return 'working';
if(activity?.phase==='read')return 'idle';
if(activity?.phase==='unknown' && activity.parentFinished)return 'unknown';
if(activity?.phase==='completed' || status==='idle' && session.unread===true){
if(!viewedReply(session))return 'completed';
activityByKey.set(key,{...activity,phase:'read',at:activity?.at || Date.now(),children:activity?.children || new Set()});
return 'idle';
}
if(status==='work' && !activity?.parentFinished)return 'working';
if(activity?.phase==='unknown')return 'unknown';
return session.unread===true?'completed':'idle';
};
const requestRender=()=>{
if(!disposed && raf===null)raf=win.requestAnimationFrame(()=>{raf=null;render();});
};
const button=(label,handler)=>{
const el=doc.createElement('button');
el.type='button';el.textContent=label;el.addEventListener('click',handler);
return el;
};
const stop=event=>{event.preventDefault();event.stopPropagation();};
const routeOptions=()=>{
const connection=String(host.state?.connectionId?.get?.()|| host.activeConnectionId?.()|| '');
if(connection !==currentScope.connectionId)return{profile:currentScope.profile,route:{...currentScope}};
return String(host.state?.profile?.get?.()|| 'default')===currentScope.profile?{}:{profile:currentScope.profile};
};
const open=session=>{if(!disposed && on && currentScope && claudeInboxOwnedBy(currentScope,session))host.openSession?.(claudeInboxId(session),routeOptions());};
const active=session=>{
const stored=host.state?.focusedStoredSessionId?.get?.();
const id=stored || host.state?.activeSessionId?.get?.();
const focusedOwner=host.state?.focusedSessionOwner?.get?.();
if(focusedOwner !=null){
const owner=claudeInboxScope(focusedOwner);
if(!owner || owner.profile !==currentScope.profile || owner.connectionId !==currentScope.connectionId)return false;
}else{
const profile=host.state?.focusedSessionProfile?.get?.()|| host.state?.profile?.get?.();
const connection=host.state?.connectionId?.get?.();
if(profile && profile !==currentScope.profile || typeof connection==='string' && connection !==currentScope.connectionId)return false;
}
return !!id && runtimeAliases(session).has(id);
};
const removeFromInbox=(session,save)=>{
const isCurrent=active(session);
const all=inboxSessions();
const index=all.findIndex(s=> model.key(currentScope,s)===model.key(currentScope,session));
const following=[...all.slice(index + 1),...all.slice(0,Math.max(0,index))];
const candidates=following.filter(s=> model.key(currentScope,s)!==model.key(currentScope,session)&& !model.isSettled(currentScope,s)&& !model.isSnoozed(currentScope,s));
if(!save())return false;
if(isCurrent){
if(candidates.length)open(candidates[0]);
else host.newChat?.({...currentScope});
}
requestRender();
return true;
};
const sameScope=scope=> JSON.stringify(claudeInboxScope(scope))===JSON.stringify(currentScope);
const clearSettleNotice=item=>{
if(settleNotices.get(item.key)!==item)return;
timerHost.clearTimeout(item.timer);settleNotices.delete(item.key);
};
const clearSettleNotices=()=>{for(const item of settleNotices.values())clearSettleNotice(item);};
const undoSettle=item=>{
if(disposed || !on || !sameScope(item.scope)|| settleNotices.get(item.key)!==item)return false;
if(Date.now()>=item.until){clearSettleNotice(item);requestRender();return false;}
if(!model.unsettle(item.scope,item.session)){requestRender();return false;}
clearSettleNotice(item);requestRender();return true;
};
const settle=session=>{
if(disposed || !on || !currentScope || !claudeInboxOwnedBy(currentScope,session))return false;
const fresh=findSession(claudeInboxId(session));
if(!fresh || claudeInboxId(fresh)!==claudeInboxId(session)|| !admission.isEligible(currentScope,fresh)||
model.isSettled(currentScope,fresh)|| model.isSnoozed(currentScope,fresh))return false;
const scope={...currentScope};
const result=removeFromInbox(fresh,()=>{
if(!model.settle(scope,fresh,{manual:true}))return false;
const key=model.key(scope,fresh);
clearSettleNotices();
const captured={id:claudeInboxId(fresh),...scope};
if(fresh._lineage_root_id)captured._lineage_root_id=fresh._lineage_root_id;
if(Array.isArray(fresh._lineage_ids))captured._lineage_ids=[...fresh._lineage_ids];
const title=typeof fresh.title==='string' && fresh.title?fresh.title:'Untitled thread';
const item={key,scope,session:captured,title,until:Date.now()+ 6000,timer:null};
settleNotices.set(key,item);
item.timer=timerHost.setTimeout(()=>{clearSettleNotice(item);requestRender();},6000);
return true;
});
if(result)render();
return result;
};
const snooze=(session,until,scope=currentScope)=>{
if(disposed || !on || !currentScope || !sameScope(scope)|| input.loading || input.error ||
!claudeInboxOwnedBy(currentScope,session)|| model.isSettled(currentScope,session))return false;
const fresh=findSession(claudeInboxId(session));
return fresh?removeFromInbox(fresh,()=> model.snooze(currentScope,fresh,until)):false;
};
const cancelSnooze=(session,scope=currentScope)=>{
if(disposed || !on || !currentScope || !sameScope(scope))return false;
return model.cancelSnooze(currentScope,session);
};
const closeSnoozePopup=(restoreFocus=true)=>{
const item=snoozePopup;
if(!item)return;
snoozePopup=null;item.element.remove();
item.anchor.setAttribute('aria-expanded','false');
doc.removeEventListener('pointerdown',item.outside,true);
doc.removeEventListener('keydown',item.keydown,true);
win.removeEventListener?.('resize',item.position);
doc.removeEventListener('scroll',item.position,true);
if(restoreFocus && item.anchor.isConnected)item.anchor.focus();
};
const rowSession=row=>{
const binding=rowBindings.get(row.getAttribute('data-claude-inbox-key'));
return !disposed && on && binding?.row===row && row.isConnected && sameScope(binding.scope)?findSession(binding.id):null;
};
const showSnoozePopup=(session,anchor,event)=>{
if(disposed || !on || !currentScope || input.loading || input.error)return;
if(snoozePopup?.anchor===anchor){
const pointer=event?.detail > 0;
closeSnoozePopup(!pointer);
if(pointer && doc.activeElement===anchor)anchor.blur();
return;
}
closeSnoozePopup(false);
const element=doc.createElement('div');
element.setAttribute(own,'popup');element.setAttribute('data-claude-inbox-snooze-popup','');
element.setAttribute('role','menu');element.setAttribute('aria-label','Snooze thread');
const item={element,anchor,id:claudeInboxId(session),scope:{...currentScope}};
snoozePopup=item;anchor.setAttribute('aria-expanded','true');
const choose=duration=>{
if(snoozePopup !==item || !sameScope(item.scope)|| disposed || !on)return;
const fresh=findSession(item.id);
if(fresh && snooze(fresh,Date.now()+ duration,item.scope))closeSnoozePopup(false);
else requestRender();
};
const controls=[];
for(const[label,duration]of[['15 min',900000],['30 min',1800000],['1 hour',3600000],['3 hours',10800000],['1 day',86400000]]){
const option=button(label,event=>{stop(event);choose(duration);});
option.setAttribute('role','menuitem');option.tabIndex=-1;
option.addEventListener('pointermove',()=>{
if(snoozePopup===item && doc.activeElement !==option)option.focus({preventScroll:true});
});
controls.push(option);element.appendChild(option);
}
item.position=()=>{
const rect=anchor.getBoundingClientRect();
const view=doc.defaultView;
element.style.maxWidth=`${Math.max(0,view.innerWidth - 16)}px`;
const width=element.getBoundingClientRect().width;
element.style.left=`${Math.max(8,Math.min(rect.right - width,view.innerWidth - width - 8))}px`;
const height=element.getBoundingClientRect().height;
element.style.top=`${Math.max(8,Math.min(rect.bottom + 4,view.innerHeight - height - 8))}px`;
};
item.outside=event=>{if(!element.contains(event.target)&& !anchor.contains(event.target))closeSnoozePopup(false);};
item.keydown=event=>{
if(event.key==='Escape'){closeSnoozePopup(element.contains(doc.activeElement));return;}
if(!element.contains(event.target))return;
if(event.key==='Tab'){closeSnoozePopup(false);return;}
const index=controls.indexOf(doc.activeElement);
if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
stop(event);
const next=event.key==='Home'?0:event.key==='End'?controls.length - 1:
(Math.max(0,index)+(event.key==='ArrowDown'?1:controls.length - 1))% controls.length;
controls[next].focus();
}else if((event.key==='Enter' || event.key===' ')&& index >=0){
stop(event);if(!event.repeat)controls[index].click();
}
};
doc.body.appendChild(element);item.position();
doc.addEventListener('pointerdown',item.outside,true);doc.addEventListener('keydown',item.keydown,true);
win.addEventListener?.('resize',item.position);doc.addEventListener('scroll',item.position,true);
element.querySelector('button')?.focus();
};
const cleanupDOM=()=>{
closeSnoozePopup(false);clearSettleNotices();rowBindings.clear();
island?.remove();island=null;signature=null;container=null;
toasts?.remove();toasts=null;
style?.remove();style=null;
for(const badge of badgeBindings.values())badge.remove();
badgeBindings.clear();
for(const badge of settledBadgeBindings.values())badge.remove();
settledBadgeBindings.clear();
};
const nativeHeaderTemplate=root=>{
let wrapper,header;
for(const section of root.children){
if(owns(section)|| !section.matches('[data-slot="sidebar-group"]'))continue;
const candidate=[...section.children].find(el=> el.classList.contains('group/section'));
const source=[...(candidate?.children ||[])].find(el=> el.matches('button')&& el.classList.contains('group/section-label'));
if(!source?.querySelector('.dither')|| !source.querySelector('.codicon-chevron-right')|| !source.querySelector('.dither').parentElement.querySelector('.truncate'))continue;
wrapper=candidate.cloneNode(false);header=source.cloneNode(true);break;
}
if(!header){
wrapper=doc.createElement('div');
wrapper.className='group/section flex shrink-0 items-center justify-between gap-1 pb-1 pt-1.5';
header=doc.createElement('button');
header.className='group/section-label flex w-fit min-w-0 items-center gap-1 bg-transparent text-left leading-none';
const label=doc.createElement('span');
label.className='flex min-w-0 items-center gap-2 pl-2 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-(--theme-primary)';
const dot=doc.createElement('span');dot.setAttribute('aria-hidden','true');dot.className='dither inline-block size-2 shrink-0 rounded-[1px]';
const text=doc.createElement('span');text.className='min-w-0 truncate leading-none';
label.append(dot,text);
const caret=doc.createElement('i');caret.setAttribute('aria-hidden','true');caret.style.fontSize='0.75rem';
caret.className='codicon codicon-chevron-right shrink-0 duration-150 text-(--ui-text-tertiary) opacity-0 transition group-hover/section-label:opacity-100';
header.append(label,caret);
}
wrapper.appendChild(header);
for(const node of[wrapper,...wrapper.querySelectorAll('*')]){
for(const attr of[...node.attributes]){
if(/^on/i.test(attr.name)|| attr.name==='id' || attr.name.startsWith('data-claude-inbox-')||['aria-controls','aria-labelledby','aria-describedby','aria-expanded','title'].includes(attr.name))node.removeAttribute(attr.name);
}
}
header.type='button';header.removeAttribute('disabled');
header.querySelector('.dither').parentElement.querySelector('.truncate').textContent='Inbox';
header.querySelector('.codicon-chevron-right').classList.remove('rotate-90');
return{wrapper,header,fingerprint:wrapper.outerHTML};
};
const ensureStyle=()=>{
if(style?.isConnected)return;
style=doc.createElement('style');style.setAttribute(own,'style');
style.textContent=CLAUDE_INBOX_ROW_UI_CSS + `
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
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge'] { display:inline-flex; font-size:10px; padding:1px 4px; color:var(--ui-text-tertiary); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge'] .claude-inbox-unsettle { display:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:hover .claude-inbox-settled,
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:focus-within .claude-inbox-settled { display:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:hover .claude-inbox-unsettle,
html[data-claude-chat-look='true'] [data-claude-inbox-owned='badge']:focus-within .claude-inbox-unsettle { display:inline; }
html[data-claude-chat-look='true'] [data-claude-inbox-status] { padding:6px 8px; font-size:11px; color:var(--ui-text-tertiary); }
/* Settle's Undo: Claude's toast ("Unpinned {name}" + Undo), bottom right where
   the skin raises Hermes' own toasts above the composer; no progress bar. */
html[data-claude-chat-look='true'] [data-claude-inbox-owned='toasts'] { position:fixed; right:16px; bottom:96px; z-index:var(--z-modal-popover, 140); display:flex; flex-direction:column; gap:8px; width:min(360px, calc(100vw - 32px)); pointer-events:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] { box-sizing:border-box; display:flex; align-items:center; gap:8px; padding:12px 8px 12px 12px; border-radius:10px; background:var(--claude-menu-background, var(--ui-bg-elevated)); box-shadow:0 0 0 1px var(--claude-menu-border, var(--ui-stroke-secondary)), 0 8px 24px var(--claude-menu-shadow, rgb(0 0 0 / 32%)); color:var(--claude-color-text, var(--ui-text-primary)); font:13px/19px var(--font-sans, system-ui); pointer-events:auto; }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] > span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] button { flex:none; height:24px; padding:0 8px; border:0; border-radius:6px; background:transparent; color:inherit; font:inherit; font-weight:500; cursor:pointer; }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] button:hover { background:var(--claude-menu-hover, var(--ui-control-hover-background)); }
html[data-claude-chat-look='true'] [data-claude-inbox-settle-notice] button:focus-visible { outline:1px solid var(--ui-accent); }
/* Claude's compact session list: 28px rows 2px apart on the sidebar's hover
   fill, titles secondary until selected and fading out rather than cut with an
   ellipsis (the controls have their own column, so the fade ends at its edge),
   6px controls muted until hovered. */
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] { --claude-sidebar-hover:var(--claude-account-hover, var(--ui-row-hover-background)); min-height:3.75rem; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] { min-height:28px; height:28px; margin-bottom:2px; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] [data-claude-inbox-label] { line-height:20px; text-overflow:clip; -webkit-mask-image:linear-gradient(to right, #000 calc(100% - 24px), transparent); mask-image:linear-gradient(to right, #000 calc(100% - 24px), transparent); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui].row-hover:not([data-active='true']) [data-claude-inbox-label][class*='text-[0.8125rem]'] { color:var(--claude-sidebar-text, var(--claude-color-text-secondary, var(--ui-text-secondary))) !important; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] > [data-row-actions] > button { border-radius:6px; color:var(--claude-color-text-tertiary, var(--ui-text-tertiary)); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] > [data-row-actions] > button:hover { background:color-mix(in srgb, var(--claude-color-text, var(--ui-text-primary)) 7.5%, transparent); color:var(--claude-color-text, var(--ui-text-primary)); }
/* Running is Claude's muted dot blinking (no ring round the row), every dot in
   step; finished-unseen is the accent dot. */
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui] > [data-claude-inbox-running-arc] { display:none; }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui][data-work-state='working'] [data-claude-inbox-work-dot] { background:var(--claude-color-text-tertiary, var(--ui-text-tertiary)); animation:claude-inbox-dot-blink 1.2s ease-in-out infinite; animation-delay:var(--claude-inbox-dot-phase, 0ms); }
html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui][data-work-state='completed'] [data-claude-inbox-work-dot] { background:var(--ui-accent, var(--ui-success)); }
@keyframes claude-inbox-dot-blink { 0%, 100% { opacity:.3; } 50% { opacity:1; } }
@media(prefers-reduced-motion:reduce) { html[data-claude-chat-look='true'] [data-claude-inbox-owned='island'] [data-claude-inbox-row-ui][data-work-state='working'] [data-claude-inbox-work-dot] { animation:none; } }
/* Snooze menu: Claude's menu (10px corners, 4px gutter, ring and shadow, 24px
   rows of 13px type). */
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] { position:fixed; z-index:var(--z-modal-popover, 140); box-sizing:border-box; display:flex; flex-direction:column; min-width:128px; max-height:calc(100vh - 16px); overflow:auto; padding:4px; border:0; border-radius:10px; background:var(--claude-menu-background, var(--ui-bg-elevated)); backdrop-filter:none; box-shadow:0 0 0 1px var(--claude-menu-border, var(--ui-stroke-secondary)), 0 8px 24px var(--claude-menu-shadow, rgb(0 0 0 / 32%)), 0 2px 6px rgb(0 0 0 / 20%); color:var(--claude-color-text, var(--ui-text-primary)); font:13px/19px var(--font-sans, system-ui); }
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] button { box-sizing:border-box; height:24px; padding:2.5px 8px; border-radius:6px; font:inherit; line-height:19px; text-align:left; white-space:nowrap; }
html[data-claude-chat-look='true'] [data-claude-inbox-snooze-popup] button:is(:hover,:focus) { background:var(--claude-menu-hover, var(--ui-control-active-background)); color:var(--claude-color-text, var(--ui-text-primary)); }
`;
(doc.head || doc.documentElement).appendChild(style);
};
const nativeSession=row=>{
const bound=externalBindings.get(row);
return bound && bound.scope.connectionId===currentScope.connectionId && bound.scope.profile===currentScope.profile &&
admission.isEligible(currentScope,bound.session)?bound.session:null;
};
const renderBadges=root=>{
const rows=new Set(externalBindings.keys());
for(const[row,badge]of settledBadgeBindings){
const session=rows.has(row)&& row.isConnected && root.contains(row)&& nativeSession(row);
if(!session || !model.isSettled(currentScope,session)|| !model.isSnoozed(currentScope,session)){badge.remove();settledBadgeBindings.delete(row);}
}
for(const[row,badge]of badgeBindings){
const session=rows.has(row)&& row.isConnected && root.contains(row)&& nativeSession(row);
if(!session || !model.isSettled(currentScope,session)&& !model.isSnoozed(currentScope,session)){badge.remove();badgeBindings.delete(row);}
}
for(const row of rows){
if(!root.contains(row)|| owns(row))continue;
const session=nativeSession(row);
const snoozed=session && model.isSnoozed(currentScope,session);
if(!session || !model.isSettled(currentScope,session)&& !snoozed)continue;
let badge=badgeBindings.get(row);
if(!badge?.isConnected){
badge?.remove();
const scope={...currentScope};
badge=button('',event=>{
stop(event);
if(disposed || !on || !sameScope(scope))return;
const fresh=nativeSession(row);
if(fresh){
if(model.isSnoozed(currentScope,fresh))cancelSnooze(fresh,scope);
else model.unsettle(currentScope,fresh);
}
});
badge.setAttribute(own,'badge');
const label=doc.createElement('span');label.className='claude-inbox-settled';
const action=doc.createElement('span');action.className='claude-inbox-unsettle';
badge.append(label,action);
const target=row.querySelector('[data-row-actions]')|| row;
if(target.closest('button'))continue;
target.appendChild(badge);badgeBindings.set(row,badge);
}
const label=badge.querySelector('.claude-inbox-settled'),action=badge.querySelector('.claude-inbox-unsettle');
const name=snoozed?'Wake now':'Un-settle',text=snoozed?'Snoozed':'Settled';
if(label.textContent !==text)label.textContent=text;
if(action.textContent !==name)action.textContent=name;
setAttr(badge,'aria-label',name);
const title=snoozed?`Snoozed until ${new Date(model.snoozedUntil(currentScope,session)).toLocaleString()}. Wake now`:name;
if(badge.title !==title)badge.title=title;
if(snoozed && model.isSettled(currentScope,session)){
let settledBadge=settledBadgeBindings.get(row);
if(!settledBadge?.isConnected){
settledBadge?.remove();
const scope={...currentScope};
settledBadge=button('',event=>{
stop(event);
if(disposed || !on || !sameScope(scope))return;
const fresh=nativeSession(row);if(fresh)model.unsettle(currentScope,fresh);
});
settledBadge.setAttribute(own,'badge');settledBadge.setAttribute('aria-label','Un-settle');settledBadge.title='Un-settle';
const label=doc.createElement('span');label.className='claude-inbox-settled';label.textContent='Settled';
const action=doc.createElement('span');action.className='claude-inbox-unsettle';action.textContent='Un-settle';
settledBadge.append(label,action);badge.parentElement.appendChild(settledBadge);settledBadgeBindings.set(row,settledBadge);
}
}
}
};
function render(){
if(disposed)return;
if(!on || !currentScope){cleanupDOM();return;}
const root=doc.querySelector('[data-sessions-mode]');
if(!root){if(container)cleanupDOM();return;}
if(container !==root || !island?.isConnected){
cleanupDOM();container=root;ensureStyle();
island=doc.createElement('div');island.setAttribute(own,'island');
island.setAttribute('data-slot','sidebar-group');island.setAttribute('data-sidebar','group');
island.className='relative flex w-full min-w-0 min-h-0 flex-col p-0 pb-1';
const first=[...root.children].find(el=> el.matches('[data-slot="sidebar-group"]'));
root.insertBefore(island,first || root.firstChild);
}
setAttr(island,'aria-busy',input.loading===true);
const headerTemplate=nativeHeaderTemplate(root);
for(const item of settleNotices.values()){
if(Date.now()>=item.until || !model.isManualSettled(item.scope,item.session))clearSettleNotice(item);
}
const sessions=inboxSessions().filter(s=> !model.isSettled(currentScope,s)&& !model.isSnoozed(currentScope,s));
const shown=sessions;
const nextSignature=JSON.stringify([currentScope,inboxOpen,input.loading,!!input.error,model.error,admission.error,headerTemplate.fingerprint,
[...settleNotices.values()].map(item=>[item.key,item.until]),sessions.length,shown.map(s=>[model.key(currentScope,s),claudeInboxId(s),s.title,safety(s),workState(s),active(s),activityByKey.get(model.key(currentScope,s))?.children.size || 0])]);
if(signature !==nextSignature){
signature=nextSignature;
setAttr(island,'data-claude-inbox-expanded',inboxOpen);
const focusedElement=island.contains(doc.activeElement)?doc.activeElement:null;
const focusedHeader=focusedElement?.hasAttribute('data-claude-inbox-header');
const oldHeader=island.querySelector('[data-claude-inbox-header]');
const scrollTop=island.querySelector('[data-slot="sidebar-group-content"]')?.scrollTop || 0;
const reuseHeader=oldHeader?.__claudeInboxTemplate===headerTemplate.fingerprint;
const header=reuseHeader?oldHeader:headerTemplate.header;
const wrapper=reuseHeader?oldHeader.parentElement:headerTemplate.wrapper;
if(!reuseHeader){
header.__claudeInboxTemplate=headerTemplate.fingerprint;
const toggle=event=>{
if(disposed || !on || !header.isConnected || !island.contains(header))return;
stop(event);inboxOpen=!inboxOpen;requestRender();
};
header.addEventListener('click',toggle);
header.addEventListener('keydown',event=>{
if(event.key==='Enter' || event.key===' '){stop(event);if(!event.repeat)toggle(event);}
});
}
header.setAttribute('aria-expanded',String(inboxOpen));header.setAttribute('data-claude-inbox-header','');
header.querySelector('.codicon-chevron-right').classList.toggle('rotate-90',inboxOpen);
if(!reuseHeader)oldHeader?.parentElement?.remove();
if(wrapper.parentElement !==island)island.insertBefore(wrapper,island.firstChild);
let content=island.querySelector('[data-slot="sidebar-group-content"]');
if(!content){
content=doc.createElement('div');content.setAttribute('data-slot','sidebar-group-content');content.className='w-full text-sm scrollbar-fade';
island.appendChild(content);
}
content.hidden=!inboxOpen;
for(const child of[...content.children])if(!child.hasAttribute('data-claude-inbox-row'))child.remove();
const status=text=>{const el=doc.createElement('div');el.setAttribute('data-claude-inbox-status','');el.setAttribute('role','status');el.textContent=text;content.appendChild(el);};
if(input.error){
status('Inbox could not be loaded. Refresh Sessions to retry.');
if(typeof input.retry==='function')content.appendChild(button('Retry Inbox',()=> input.retry()));
}
if(model.error)status(model.error);
if(admission.error)status(admission.error);
if(!input.loading && !input.error && !model.error && !admission.error && !sessions.length)status('Inbox is clear. Settled and snoozed threads remain in Sessions and Pinned.');
const kept=new Set();
let cursor=content.firstChild;
for(const session of shown){
const key=model.key(currentScope,session);
if(kept.has(key))continue;
kept.add(key);
let binding=rowBindings.get(key);
if(!binding){
const ui=createClaudeInboxRowUI({
document:doc,
onOpen:()=>{const fresh=rowSession(ui.row);if(fresh)open(fresh);},
onMenu:event=>{stop(event);const fresh=rowSession(ui.row);if(fresh)settle(fresh);},
onSnooze:event=>{stop(event);const fresh=rowSession(ui.row);if(fresh)showSnoozePopup(fresh,ui.clock,event);}
});
ui.row.setAttribute('data-claude-inbox-key',key);
ui.clock.setAttribute('aria-haspopup','menu');ui.clock.setAttribute('aria-expanded','false');
binding={...ui,action:ui.menu};rowBindings.set(key,binding);
}
binding.id=claudeInboxId(session);binding.scope={...currentScope};
const{row,clock,action}=binding;
setAttr(row,'data-claude-inbox-row',binding.id);
setAttr(row,'data-claude-inbox-active-children',activityByKey.get(key)?.children.size || 0);
const title=typeof session.title==='string' && session.title?session.title:'Untitled thread';
binding.update({
title,selected:active(session),settleAction:true,workState:workState(session),
menuDisabled:false,
menuTitle:'Remove from Inbox only. Work continues.'
});
setAttr(action,'aria-label',`Settle ${title}`);setAttr(clock,'aria-label',`Snooze ${title}`);
clock.disabled=!!input.loading || !!input.error;clock.title='Hide from Inbox for a chosen duration. Work continues.';
if(row !==cursor){
if(row.isConnected && row.parentElement===content && typeof content.moveBefore==='function')content.moveBefore(row,cursor);
else content.insertBefore(row,cursor);
}
cursor=row.nextSibling;
}
if(settleNotices.size && !toasts?.isConnected){
toasts=doc.createElement('div');toasts.setAttribute(own,'toasts');
doc.body.appendChild(toasts);
}
toasts?.replaceChildren();
for(const item of settleNotices.values()){
const notice=doc.createElement('div');
notice.setAttribute('data-claude-inbox-settle-notice',claudeInboxId(item.session));notice.setAttribute('role','status');
const label=doc.createElement('span');label.textContent=`Settled ${item.title}`;
const undo=button('Undo',event=>{stop(event);if(undo.isConnected && toasts?.contains(undo)&& island?.isConnected)undoSettle(item);});
notice.append(label,undo);toasts.appendChild(notice);
}
if(!settleNotices.size && toasts){toasts.remove();toasts=null;}
for(const[key,binding]of rowBindings)if(!kept.has(key)){binding.row.remove();rowBindings.delete(key);}
if(snoozePopup && !snoozePopup.anchor.isConnected)closeSnoozePopup(false);
content.scrollTop=scrollTop;
if(focusedElement?.isConnected)focusedElement.focus({preventScroll:true});
else if(focusedHeader)header.focus();
if(snoozePopup)snoozePopup.position();
}
renderBadges(root);
}
const observer=new win.MutationObserver(records=>{
if(records.some(record=>{
if(owns(record.target))return false;
if(record.type==='attributes' &&['class','style'].includes(record.attributeName)){
return record.target.closest?.('[data-slot="sidebar-group"]')?.parentElement===container &&
(record.target.classList.contains('group/section')|| !!record.target.closest?.('button.group\\/section-label'));
}
if(record.type==='attributes')return true;
return[...record.addedNodes,...record.removedNodes].some(node=> !owns(node));
}))requestRender();
});
observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-sessions-mode','aria-expanded','class','style','data-following','data-session-anchor','data-session-switching','data-pane-hidden']});
const offModel=model.subscribe(()=>{refreshDeadline();requestRender();});
const resume=()=>{if(!disposed && on){refreshDeadline();requestRender();}};
doc.addEventListener('visibilitychange',resume);
doc.addEventListener('scroll',resume,true);
win.addEventListener?.('focus',resume);
const offActive=['activeSessionId','focusedStoredSessionId','focusedSessionOwner','focusedSessionProfile','profile','connectionId'].map(name=> host.state?.[name]?.subscribe?.(requestRender)).filter(Boolean);
const api={
model,admission,snooze,cancelSnooze,
opened(){
return false;
},
update(next){
if(disposed)return;
const scope=claudeInboxScope(next.scope);
if(JSON.stringify(scope)!==JSON.stringify(currentScope)){cleanupDOM();activityByKey.clear();inboxOpen=true;}
currentScope=scope;
input={...next,sessions:Array.isArray(next.sessions)?next.sessions:[],liveSessions:Array.isArray(next.liveSessions)?next.liveSessions:[],
childSnapshots:Array.isArray(next.childSnapshots)?next.childSnapshots:[],liveStatusKnown:next.liveStatusKnown??Array.isArray(next.liveSessions)};
if(scope && on){reconcileAdmission();reconcileActivity();reconcileChildActivity();}
refreshDeadline();requestRender();
},
reactivate(event){
if(disposed || !on || !currentScope || !event || !claudeInboxOwnedBy(currentScope,event)|| JSON.stringify(claudeInboxScope(event.scope))!==JSON.stringify(currentScope))return false;
if(!['work','input','busy'].includes(event.type)&& claudeInboxWorkStatus(event)!=='work')return false;
const session=eventSession(event);
if(!session || input.loading || input.error || input.liveStatusKnown !==true ||
!admission.observe(currentScope,input.sessions,{workingSessions:[session]})|| !admission.isEligible(currentScope,session)){requestRender();return false;}
if(model.isManualSettled(currentScope,session)&& !model.unsettle(currentScope,session)){requestRender();return false;}
const key=model.key(currentScope,session),previous=activityByKey.get(key);
activityByKey.set(key,{...previous,phase:'working',parentFinished:false,at:Date.now(),children:previous?.children || new Set()});
const result=model.ingest(currentScope,[session],{liveSessions:[{...session,status:'working'}]});
requestRender();return result;
},
activity(event){
if(disposed || !on || !currentScope || !event || event.replayed || !claudeInboxOwnedBy(currentScope,event)||
!sameScope({connectionId:event.connectionId,profile:event.profile}))return false;
const session=eventSession(event);
if(!session)return false;
if(['message.start','tool.start'].includes(event.type)){
if(event.type==='tool.start' && model.isManualSettled(currentScope,session))return false;
return api.reactivate({type:'work',scope:currentScope,session_id:claudeInboxId(session),canonicalSessionId:claudeInboxId(session)});
}
const key=model.key(currentScope,session),previous=activityByKey.get(key);
if(event.type==='message.complete' && previous?.phase==='read')return false;
const activity={...previous,phase:previous?.phase || 'unknown',at:previous?.at || 0,
children:new Set(previous?.children ||[]),pendingChildren:new Set(previous?.pendingChildren ||[]),
terminalChildren:new Set(previous?.terminalChildren ||[])};
if(['subagent.spawn_requested','subagent.start','subagent.complete'].includes(event.type)){
const child=event.payload?.subagent_id;
if(typeof child !=='string' || !child)return false;
if(event.type==='subagent.complete'){
if(activity.terminalChildren.has(child)&& !activity.children.has(child)&& !activity.pendingChildren.has(child))return true;
activity.children.delete(child);activity.pendingChildren.delete(child);
if(activity.terminalChildren.size < 256)activity.terminalChildren.add(child);
else activity.terminalChildrenOverflow=true;
}else{
activity.terminalChildren.delete(child);
if(event.type==='subagent.spawn_requested')activity.pendingChildren.add(child);
else activity.pendingChildren.delete(child);
activity.children.add(child);
}
activity.childEventAt=Date.now();
}else if(event.type==='message.complete'){
activity.phase=activity.children.size?'unknown':event.payload?.status==='complete' && !event.payload.error?'completed':'unknown';
activity.parentFinished=true;activity.at=Date.now();
}else if(event.type==='error'){activity.phase='unknown';activity.parentFinished=true;activity.at=Date.now();}
else return false;
activityByKey.set(key,activity);
requestRender();return true;
},
bindNativeRow(row,session,scope=currentScope){
const valid=claudeInboxScope(scope);
if(disposed || !row || !valid || !claudeInboxId(session))return()=>{};
const binding={session,scope:valid};externalBindings.set(row,binding);requestRender();
return()=>{if(externalBindings.get(row)===binding){externalBindings.delete(row);badgeBindings.get(row)?.remove();badgeBindings.delete(row);settledBadgeBindings.get(row)?.remove();settledBadgeBindings.delete(row);requestRender();}};
},
setMode(value){
if(disposed)return false;
on=!!value;
if(!on)cleanupDOM();
else if(currentScope)reconcileAdmission();
refreshDeadline();requestRender();return true;
},
dispose(){
if(disposed)return;
disposed=true;clearDeadline();observer.disconnect();offModel();offActive.forEach(fn=> fn());
doc.removeEventListener('visibilitychange',resume);doc.removeEventListener('scroll',resume,true);win.removeEventListener?.('focus',resume);
if(raf !==null)win.cancelAnimationFrame(raf);
cleanupDOM();externalBindings.clear();activityByKey.clear();
if(doc[registryKey]===api.dispose)delete doc[registryKey];
}
};
doc[registryKey]=api.dispose;
refreshDeadline();requestRender();
return api;
}
// END GENERATED INBOX RUNTIME
