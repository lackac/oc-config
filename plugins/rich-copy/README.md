# Rich selection copy

Automatically copies selected OpenCode output as HTML and plain text on macOS,
preserving inline formatting, list numbering, and selected table cells. Uses the
native macOS clipboard.

## Setup

Merge into `~/.config/opencode/cli.json`:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "terminal": { "copy": "manual" },
  "plugins": [
    {
      "package": "./plugins/rich-copy",
      "options": { "automatic": true }
    }
  ]
}
```

Select output, release the mouse, and paste. `terminal.copy: "manual"` lets the
plugin handle automatic copying. `/rich-copy-info` shows the last copy result
and any formatting fallback.

For Slack, copy tables separately from surrounding text so they paste as table
attachments.

## Development

Selection mapping uses OpenCode 2.2.5 / OpenTUI 0.8.0 renderer internals. Run tests
from this directory:

```sh
nix run nixpkgs#bun -- install --frozen-lockfile
nix shell nixpkgs#bun --command bun run test
```
