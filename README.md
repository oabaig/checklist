# Checklist

A simple keyboard-friendly checklist app with tabbed lists and sub-items.

**Live site:** https://checklist.baig.works

## Features

- Multiple checklists shown as tabs, which can be created, renamed, and deleted
- Items that can be checked off and deleted, with a completed count per list
- One level of sub-items under each item, with a `done/total` count on the parent
- Every action is available from the keyboard (press `?` in the app for the full list)
- Data is saved in the browser's `localStorage`, so nothing is sent to a server

Because data lives in `localStorage`, it is tied to one browser and one address. Lists saved on
https://checklist.baig.works do not appear on `localhost`, in another browser, or in a private window,
and clearing site data deletes them.

## Keyboard shortcuts

Single-key shortcuts are ignored while typing in a text box.

| Key | Action |
| --- | --- |
| `N` or `/` | Go to the "Add an item" box |
| `Esc` | Leave the text box |
| `↑` / `↓`, `Home` / `End` | Move between items and sub-items |
| `Space` or `Enter` | Check or uncheck the focused item |
| `Delete` or `Backspace` | Delete the focused item |
| `S` | Add sub-items to the focused item (`Enter` adds, `Esc` closes) |
| `Ctrl` / `Cmd` + `D` | Delete the last added item in the current list |
| `[` / `]` | Previous / next list |
| `←` / `→` | Previous / next list (when a tab is focused) |
| `T` | New list |
| `R` or `F2` | Rename the current list (`Enter` saves, `Esc` cancels) |
| `?` | Show or hide the shortcut help |

Vim keys are also available:

| Key | Action |
| --- | --- |
| `j` / `k` | Move down / up through items and sub-items |
| `gg` / `G` | First / last item |
| `h` / `l` | Previous / next list |
| `x` or `dd` | Delete the focused item |
| `i` or `o` | Go to the "Add an item" box |

## Running locally

Requires Node.js 18 or later. The app has no runtime dependencies.

```bash
npm start
```

Then open http://localhost:4321. Set the `PORT` environment variable to use a different port.

The local server only serves `public/index.html`; the whole app lives in that one file.

## Testing

Tests use [Playwright](https://playwright.dev) and run in headless Chromium against a server on port 4399.

```bash
npm install
npx playwright install chromium
npm test
```

## Deployment

The site is hosted on [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/)
as static assets. `wrangler.jsonc` points Cloudflare at the `public/` directory, so `server.js` is not
used in production. The custom domain `checklist.baig.works` is configured on the Worker in the
Cloudflare dashboard.

To deploy manually:

```bash
npx wrangler login
npx wrangler deploy
```
