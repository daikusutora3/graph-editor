# ローカルUI検証のポリシー例外案

2026-10-06にユーザーが承認し、AGENTS.mdとhookへ限定例外を追加しました。
実装は `tests/browser/safari-workflow.py` による専用WebDriverセッションです。
一般のSafariアプリ操作を無制限に許可するものではありません。
承認対象は、次の限定例外をAGENTS.mdと対応するhookに追加することです。
GitHub Issuesの禁止事項はそのまま維持します。

> Local UI verification exception: agents may use browser/computer-use tools
> to test this application's local preview in Safari. Navigation and
> interaction are limited to the
> local preview URL explicitly recorded for this test. Agents may enter graph
> test data, operate editor controls, capture screenshots, and save generated
> test exports. All GitHub Issue operations and unrelated applications,
> accounts, websites, settings changes and messages remain outside this
> exception. Keep the hook enabled and add tests that deny navigation to
> GitHub Issues and unrelated destinations.

対象URL：ローカル本番配信（現在 `http://127.0.0.1:3323`）。
Safariの自動化設定の有効化は、その後の追加回答で明示的に許可されました。
OSの認証はユーザーに引き渡します。
