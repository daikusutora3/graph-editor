/** Restore focus lost with a removed control, without taking a later choice. */
export function focusAfterContentSwitch(target: HTMLElement | null) {
  if (!target?.isConnected) return;

  const panel = target.closest<HTMLElement>("[data-editor-panel]");
  if (!panel || panel.dataset.panelState !== "open") return;

  const document = target.ownerDocument;
  const active = document.activeElement;
  if (
    active === null ||
    active === document.body ||
    active === document.documentElement ||
    active === panel
  ) {
    target.focus({ preventScroll: true });
  }
}
