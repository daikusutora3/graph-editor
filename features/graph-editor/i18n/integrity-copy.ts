export const integrityCopy = {
  ja: {
    pending: "保存待ち",
    saved: "保存済み",
    failed: "自動保存に失敗しました。現在の作業は保持されています。",
    conflict:
      "別タブの保存内容が変わりました。現在の作業と履歴を保持しています。旧版のタブは再読み込みしてください。",
    unavailable:
      "自動保存を利用できません。現在の内容をJSONで保存してください。",
    invalid:
      "保存データを読み込めません。原文を退避してから新規作業を開始できます。",
    retry: "再試行",
    backup: "現在の内容をJSONで保存",
    raw: "保存データの原文を退避",
    load: "別タブの内容を読み込む",
    fresh: "新規作業を開始",
    rejected:
      "変更を適用できません。頂点1,000個・辺5,000本・文字列256文字・JSON 2,000,000文字の上限と入力値を確認してください。",
    exportBlocked:
      "この形式では辺・重みを保持できないか、入力上限を超えます。JSON形式を選んでください。",
    textNote: "テキスト形式には位置・色・手動の曲がりは含まれません。",
    unresolved: (count: number) => `重なりが${count}組残っています。`,
    partial: (count: number) => `警告を確認して有効な${count}辺を取り込む`,
    pendingRoutes: (count: number) => `経路を計算中：残り${count}辺`,
    unresolvedRoutes: (count: number) =>
      `${count}辺は探索範囲内で頂点を回避できませんでした`,
    loading: "グラフを準備しています",
    renderFailed:
      "グラフを表示できませんでした。JSONで退避するか再試行してください。",
  },
  en: {
    pending: "Saving…",
    saved: "Saved",
    failed: "Autosave failed. Your current work is retained.",
    conflict:
      "Another tab changed the saved document. Your work and history are retained. Reload older app tabs.",
    unavailable: "Autosave is unavailable. Save your current work as JSON.",
    invalid:
      "The saved document is invalid. Back up the original before starting a new document.",
    retry: "Retry",
    backup: "Save current work as JSON",
    raw: "Back up original saved data",
    load: "Load the other tab's document",
    fresh: "Start a new document",
    rejected:
      "Change rejected. Check input values and limits: 1,000 nodes, 5,000 edges, 256 characters per label, 2,000,000 JSON characters.",
    exportBlocked:
      "This format cannot preserve the edges or weights, or exceeds the input limit. Choose JSON.",
    textNote: "Text formats do not include positions, colors, or manual bends.",
    unresolved: (count: number) => `${count} overlapping pairs remain.`,
    partial: (count: number) =>
      `Accept warnings and import ${count} valid edges`,
    pendingRoutes: (count: number) => `Routing ${count} remaining edges`,
    unresolvedRoutes: (count: number) =>
      `${count} edges could not avoid nodes within the search limits`,
    loading: "Preparing graph",
    renderFailed: "The graph could not be displayed. Save JSON or retry.",
  },
};
