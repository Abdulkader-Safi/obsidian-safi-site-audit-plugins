# Contributing

Bug reports and pull requests are welcome.

## Reporting a bug

Open an issue with the Obsidian version, your operating system, the plugin version, and
the URL you were auditing if the problem is specific to one site. If the audit failed,
the message from the notice is usually enough to locate it.

## Running it locally

```bash
git clone https://github.com/Abdulkader-Safi/obsidian-safi-site-audit-plugins.git
cd obsidian-safi-site-audit-plugins
npm install
npm run dev      # watch build
npm test         # self-checks
```

Symlink or copy the folder into `<vault>/.obsidian/plugins/safi-site-audit`, then enable
the plugin. `npm run dev` rebuilds `main.js` on change; reload the plugin to pick it up.
Edits to `styles.css` need only a reload, not a rebuild.

## Before opening a pull request

- `npm test` passes.
- `npm run build` produces a `main.js` with no warnings.
- New logic that can break comes with one self-check in `test/`. No framework, no
  fixtures; the existing tests are the pattern.

## Style

- The dashboard is styled entirely from Obsidian's own CSS variables. No colour
  literals, no bundled fonts, no drop shadows. If you need a colour, there is a variable
  for it.
- Obsidian styles bare `button` and `select` elements at specificity (0,1,1). A
  single-class rule will silently lose to it. Either use Obsidian's own classes
  (`mod-cta`, `dropdown`) or scope the selector to a view root, as the existing rules do.
- Prefer the platform. Obsidian ships components, variables and helpers for most of what
  a plugin needs; reach for those before writing your own.

## Releases

`manifest.json`, `package.json` and `versions.json` must agree on the version, and the
GitHub release tag has to match `manifest.json` exactly, with `main.js`, `manifest.json`
and `styles.css` attached as assets.
