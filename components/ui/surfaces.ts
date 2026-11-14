/**
 * Named surface, menu, and text recipes.
 *
 * Pick a recipe by *where the element lives*, not by how it should look. Feature
 * code must not hand-roll border + background + radius combinations; if none of
 * these fit, add a recipe here (and to docs/design-system.md) instead.
 * `tests/verification/design-system.ts` enforces this for feature and app code.
 */

export const surface = {
  /** Floats above the canvas: toolbars, popovers, menus, toasts, notices. Translucent with blur. */
  floating: "ge-panel",
  /** In-flow card on a page, panel, or the empty canvas: sample cards, start cards, content cards. */
  card: "rounded-xl border border-[var(--line)] bg-[var(--panel-solid)]",
  /** Recessed display area inside a panel: code, previews, confirmation boxes. */
  inset: "rounded-lg border border-[var(--line)] bg-[var(--bg)]",
} as const;

export const menuStyle = {
  /** A floating list of actions or choices. Items are `<ActionRow density="menu">`. */
  surface: "ge-panel rounded-xl p-1.5",
} as const;

export const textStyle = {
  /** Supporting sentence under or beside a control (format notes, help). */
  note: "text-xs leading-relaxed text-[var(--muted)]",
  /** Small monospaced counter or status (N=6 M=5, 79/79, 1920 px). */
  meta: "font-mono text-meta font-semibold text-[var(--muted)] tabular-nums",
} as const;
