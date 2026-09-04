"use client";

import { useI18n } from "../../i18n/I18nProvider";
import type { ShortcutPlatform } from "../hooks/shortcut-platform";

export function ShortcutsPanel({ platform }: { platform: ShortcutPlatform }) {
  const { messages } = useI18n();
  const mod = platform === "mac" ? "⌘" : "Ctrl+";
  const shift = platform === "mac" ? "⇧" : "Shift+";
  const items = messages.chrome.shortcutItems;
  const groups = [
    {
      title: messages.chrome.shortcutGroups.modes,
      rows: [
        [items.select, "V"],
        [items.node, "N"],
        [items.edge, "E"],
        [items.escape, "Esc"],
      ],
    },
    {
      title: messages.chrome.shortcutGroups.edit,
      rows: [
        [items.delete, "⌫"],
        [items.undo, `${mod}Z`],
        [items.redo, `${shift}${mod}Z`],
        [items.selectAll, `${mod}A`],
        [items.copy, `${mod}C`],
        [items.cut, `${mod}X`],
        [items.paste, `${mod}V`],
        [items.color, "C"],
        [items.nudge, "←↑→↓"],
        [items.editLabel, "↵"],
      ],
    },
    {
      title: messages.chrome.shortcutGroups.view,
      rows: [
        [items.fit, `${shift}1`],
        [items.resetZoom, `${mod}0`],
        [items.layouts, "L"],
        [items.settings, ","],
        [items.shortcuts, "?"],
      ],
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-7 gap-y-4">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <div className="text-meta pb-1 font-bold tracking-[0.06em] text-[var(--muted)]">
            {group.title}
          </div>
          {group.rows.map(([label, key]) => (
            <div
              key={label}
              className="text-control flex h-[30px] items-center justify-between text-[var(--text-2)]"
            >
              <span>{label}</span>
              <kbd className="text-control grid h-6 min-w-[26px] place-items-center rounded-md bg-[var(--fill)] px-1.5 font-mono font-semibold text-[var(--text-2)]">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
