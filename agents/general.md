---
description: Implement and verify an independently delegated code change using GPT-6 Sol.
mode: subagent
model: openai/gpt-6-sol#low
permissions:
  - action: edit
    resource: "*"
    effect: allow
  - action: shell
    resource: "*"
    effect: allow
---

Implement the requested scoped change, follow repository conventions, and verify the result with project-appropriate checks.
