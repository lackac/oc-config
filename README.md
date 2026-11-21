# oc-config

Personal OpenCode v2 configuration, loaded from `~/.config/opencode`.

- `opencode.jsonc`: server configuration, models, permissions, and compaction
- `cli.json`: terminal settings; changes made in OpenCode's settings UI are tracked here
- `AGENTS.md`: global agent guidance
- `agents/` and `skills/`: global agent and skill definitions
- `plugins/`: server and terminal integrations

OpenCode loads ordinary configuration changes automatically. Its runtime
`service.json` file is ignored by Git.

## Agent models

The core profile uses OpenAI subscription models for its primary agents:

- Build (the default agent): GPT-6.2 Sol with high reasoning
- Plan: GPT-6.2 Sol with max reasoning

All specialist subagents use OpenAI subscription models:

| Role | Agent | Model |
| --- | --- | --- |
| Architecture and difficult problems | `architect` | GPT-6.2 Astra, max |
| Codebase exploration | `explore` | GPT-6 Luna, low |
| External research | `scout` | GPT-6 Luna, medium |
| Broad implementation | `general` | GPT-6.2 Sol, high |
| Routine implementation | `routine` | GPT-6.1 Terra, medium |
| Interface work | `designer` | GPT-6.2 Sol, low |

## Compaction

The core profile enables OpenCode v2's checkpoint-based automatic compaction.
It retains 15,000 recent tokens beside a structured checkpoint and reserves a
20,000-token safety buffer. Earlier session messages remain stored, while the
checkpoint replaces them in active model context.

## Matt Pocock's skills

[`vendor/matt-pocock-skills`](https://github.com/mattpocock/skills) is an unmodified
Git submodule pinned to a reviewed upstream revision. Global configuration loads
only its promoted `skills/engineering/` and `skills/productivity/` directories,
including their supporting files. Experimental and miscellaneous skills are not
registered.

Pocock's invocation defaults are preserved in every project, including Life:
model-invoked skills are available automatically, while user-invoked workflows
require an explicit request. For example:

- `@ask-matt` recommends a skill or workflow.
- `@grill-me` interviews you about an idea or decision.
- `@grill-with-docs` also builds domain terminology and decision records.

For tracker-based engineering workflows, run `@setup-matt-pocock-skills` once in
the target project. It proposes the issue tracker and documentation conventions
before writing them. Loading these skills does not configure individual projects.
Skill instructions do not override the requirement for explicit authorization
before committing, pushing, or making other external writes.

Keep local guidance in `AGENTS.md` rather than editing upstream skill files.

## Explainer videos

The [`explainer-videos`](skills/explainer-videos/SKILL.md) skill creates narrated
videos with the local `kokoro-narrate` tool from CLI toolbox. Emma is the default
voice. Requests can select a voice or blend, speed, pronunciation, pauses, visual
style, palette, typography, aspect ratio, duration, and captions.

Styles include whiteboard, collage, technical diagrams, editorial layouts,
kinetic typography, interface walkthroughs, and custom directions. For example:

> Use explainer-videos to explain cache invalidation for junior developers in
> about 60 seconds. Use technical diagrams with a warm light palette, Emma at
> 1.05× speed, and sidecar captions.

> Make a portrait collage explainer about heat pumps. Blend Emma, Isabella, and
> Lewis equally, with calm motion and burned-in captions.

The skill keeps a per-video brief and editable sources, measures narration to
drive animation and caption timing, and requires review of the rendered output.
It uses project-local rendering tools.

## Plugins

### Rich selection copy

[`plugins/rich-copy/`](plugins/rich-copy/README.md) automatically copies selected
output as HTML and plain text on macOS, preserving formatting, lists, and tables.
Run `/rich-copy-info` for the last copy result.

### Transcript links

Click a file reference in a conversation to open it in Neovim. Relative paths
use the session directory, and references such as `src/app.ts:25:3` or
`src/app.ts#L25` jump to the specified position. Web and session links still
use OpenCode's click handlers.

Use **Ctrl+P → Open transcript link** or `/links` to search for file references
and web links from the keyboard. In Rex or tmux, the opener reuses the
`Prefix+v` editor in the same window when it can identify exactly one; otherwise
it opens a floating editor. Reload the mux configuration and reopen any
pre-existing `Prefix+v` editor to enable reuse. File paths must exist on the
machine running the TUI.

Tests: `node --test plugins/transcript-links/transcript-links.test.ts`.

### Rex status

[`opencode-rex-status`](https://github.com/martinmiglio/opencode-rex-status) flags
completed and failed OpenCode sessions in Rex. It only runs inside Rex and
requires OpenCode 2.2 or later.

On a fresh checkout, run `git submodule update --init vendor/opencode-rex-status`.

### Worktrunk

`plugins/worktrunk/` connects OpenCode to [Worktrunk](https://worktrunk.dev/):

- Shows branch activity in `wt list`: 🤖 while working and 💬 while waiting,
  including sessions launched directly in OpenCode.
- Routes native OpenCode worktree creation and removal through `wt`, honoring
  Worktrunk's naming preferences and lifecycle hooks.

Activity markers are per branch, not per session. The plugin does not create a
worktree merely because a session starts or grant permission to commit or merge.

Integration test: `node --test tests/worktrunk.test.ts`. It checks the running
OpenCode server and requires this checkout to be the global configuration.

### Quota sidebar

`plugins/quota/` shows OpenAI quota using the existing ChatGPT OAuth connection.

- Meters show remaining quota: `5` (five-hour), `W` (weekly), `M` (monthly).
  Unavailable windows are omitted; fills turn amber at ≤50% and red at ≤20%.
- Click **Quota left** or select **Toggle quota details** in the command palette
  for reset times. Low-quota details appear automatically.
- Readings refresh after completions and every 15 minutes while visible, using
  a shared server cache. Failed refreshes mark retained readings as stale.

OpenAI's usage endpoint is undocumented; provider changes may require repairs.

Tests: `node --test plugins/quota/quota.test.ts`.
