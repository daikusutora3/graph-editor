# Audit scripts

Manual checks that need a browser. They are not part of `bun run check`;
run them against a dev server or the static export when UI or headers change.

| Script                            | What it checks                                                                                                                      | Run                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ui-audit.mjs`                    | Touch/desktop target sizes, AA contrast, overlapping or off-screen chrome at 375–1920px, every panel, light and dark (`THEME=dark`) | `bun run dev` then `bun scripts/audit/ui-audit.mjs`                                     |
| `serve-out.mjs` + `csp-check.mjs` | Serves `out/` with the generated `_headers` and fails on CSP violations or page errors                                              | `bun run build`, `bun scripts/audit/serve-out.mjs &`, `bun scripts/audit/csp-check.mjs` |

Both use Playwright's bundled Chromium (`bunx playwright install chromium` once).
