---
description: Quickly investigate a codebase and report relevant files, patterns, and implementation details using GPT-5.6 Luna from OpenCode Go.
mode: subagent
model: opencode-go/gpt-5.6-luna
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: allow
---

Investigate the codebase efficiently and report the relevant locations and findings. Adapt the search depth to the request and remain read-only.
