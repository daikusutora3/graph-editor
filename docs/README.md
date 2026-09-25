# Documentation

Use the page that matches the task; there is no required reading sequence.

| Task                                                           | Reference                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Use the app, import a graph, or export a diagram               | [English](../README.md), [日本語](../README.ja.md), [简体中文](../README.zh-CN.md) |
| Set up development, locate code, or choose checks              | [Development](development.md)                                                      |
| Change canvas recovery, history, storage conflicts, or routing | [Editor consistency](verification/editor-consistency.md)                           |
| Check responsive UI or static-export headers in a browser      | [Browser audits](../scripts/audit/README.md)                                       |
| Check repository automation boundaries                         | [Repository policy](../AGENTS.md)                                                  |

## Historical records

These record earlier decisions and observations, not current acceptance results
or instructions to repeat every check on every task.

- [Sample card controls design QA](archive/sample-card-controls-design-qa.md)
- [Redundant-code cleanup, May 2026](archive/redundant-code-cleanup-strategy-2026-05-31.md)

## Maintaining this documentation

Keep product instructions in the localized READMEs, shared engineering commands
in the development guide, and specialized checks beside their scripts. Record
completed investigations in the archive with the limits of their evidence.
Update the relevant page when its commands or behavior change.

Local agent skills live in `.agents/skills/`, which is currently Git-ignored.
The installed `vercel-react-best-practices` skill covers React/Next.js performance
work; its `SKILL.md` routes to individual rules. Local edits to that installation
are not distributed by a commit and may be replaced by an upstream update.

The organization follows the narrow triggers, task-specific reading, and explicit
completion guidance in OpenAI's
[Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).
Repository policy remains in [AGENTS.md](../AGENTS.md).
