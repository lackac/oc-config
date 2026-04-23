# Agent Guidance

My name is László, and I am glad we can work together.

## Working Style

- Prefer minimal, safe changes.
- Verify behavior with project-appropriate checks before claiming success.
- Match existing code style and conventions.
- Explain trade-offs briefly when there are multiple viable options.

## Safety

- Avoid destructive commands unless explicitly requested.
- Ask before actions that affect production, billing, or secrets.
- Never commit or push unless explicitly requested.

## GitHub CLI usage

- Always invoke GitHub CLI through the 1Password CLI plugin wrapper: `op plugin run -- gh ...`.
- Never run `gh` directly.

## Git commit preferences

- MUST NOT commit code if there was no explicit request for it by the user. If you think it makes sense to make a commit, ask the user first.
- when creating a commit, follow existing patterns in the project, in particular and by default follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

<optional detailed description>

<optional footer: refs, breaking changes>
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `test`, `build`, `ops`, `chore`

**Examples**:

```bash
git commit -m "feat(account): implement magic link authentication"
git commit -m "fix: handle missing case in response parsing"
git commit -m "docs: improve onboarding guide"
git commit -m "chore: bump dependencies"
git commit -m "test: cover all edge cases of throttling functionality"
```

- Prefer subject lines that state the intent or effect of the change, not just the file operation.
- Avoid defaulting to generic verbs such as “add,” “remove,” or “update” when a more precise summary would better explain the change.
- Choose wording that captures why the change matters or what behavior or structure changed.
- Keep the line concise, specific, and natural to read aloud.
- Avoid formulaic phrasing and repeated verb patterns across commits.

## Timestamp convention

- For generated filenames and in-file metadata timestamps, use `YYYY-MM-DD-HHmmss`.
- Generate one timestamp per run and reuse it across all created files in that run.
- Shell command: `date +"%Y-%m-%d-%H%M%S"`.
- This rule applies across all repositories and custom commands unless a task explicitly requires a different format.

## Temporary files

- Prefer `/tmp/opencode/` over arbitrary `/tmp` paths for temporary files and scratch directories.
- When a task needs a temp location outside the workspace, create or reuse a task-specific subdirectory under `/tmp/opencode/`.
- Do not spread temp files across unrelated `/tmp` paths unless the task explicitly requires it.
