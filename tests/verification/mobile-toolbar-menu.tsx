import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { contentNavigationCopy } from "../../lib/content-navigation";
import { appArticlePaths, appGuidePaths } from "../../lib/site-metadata";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import { SUPPORTED_LOCALES } from "../../features/graph-editor/i18n/locale";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import { MobileBottomBar } from "../../features/graph-editor/ui/chrome/EditorToolbar";
import { AppMenuPanel } from "../../features/graph-editor/ui/panels/AppMenuPanel";

for (const locale of SUPPORTED_LOCALES) {
  const messages = messagesByLocale[locale];
  const toolbar = renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <MobileBottomBar
        canRedo={false}
        canUndo={false}
        mode="node"
        panel={null}
        onModeChange={() => {}}
        onRedo={() => {}}
        onTogglePanel={() => {}}
        onUndo={() => {}}
      />
    </I18nProvider>,
  );
  const buttons = [...toolbar.matchAll(/<button\b[^>]*>.*?<\/button>/g)].map(
    (match) => match[0],
  );
  for (const mode of ["select", "node", "edge"] as const) {
    const label = messages.toolbar.modes[mode].label;
    const button = buttons.find((markup) =>
      markup.includes(`aria-label="${label}"`),
    );
    assert(button, `${locale}: ${mode} remains an accessible action`);
    assert.equal(
      button.replace(/<[^>]+>/g, ""),
      label,
      `${locale}: ${mode} has a visible translated label`,
    );
    assert(
      button.includes(`aria-pressed="${mode === "node"}"`),
      `${locale}: visible captions preserve the selected mode`,
    );
  }

  const menu = renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <AppMenuPanel onOpenShortcuts={() => {}} />
    </I18nProvider>,
  );
  const items = [...menu.matchAll(/<(a|button)\b[^>]*>.*?<\/\1>/g)].map(
    (match) => match[0],
  );
  assert.deepEqual(
    items.map((item) => item.replace(/<[^>]+>/g, "").replace(/\?$/, "")),
    [
      messages.appMenu.guide,
      contentNavigationCopy[locale].articles,
      messages.chrome.shortcuts,
      messages.appMenu.github,
      messages.appMenu.reportIssue,
      messages.appMenu.shareOnX,
    ],
    `${locale}: help and learning precede project and sharing links`,
  );
  assert(items[0]!.includes(`href="${appGuidePaths[locale]}"`));
  assert(items[1]!.includes(`href="${appArticlePaths[locale]}"`));
  assert(items[2]!.startsWith("<button"));
  assert(items.every((item) => item.includes('role="menuitem"')));
}

console.log(
  "Mobile mode labels and help-first app menu passed in every locale",
);
