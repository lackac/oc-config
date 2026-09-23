---
description: Implement and verify a well-scoped code change using OpenAI when a task can be delegated independently.
mode: subagent
model: openai/gpt-5.6-terra#low
permissions:
  - action: edit
    resource: "*"
    effect: allow
  - action: shell
    resource: "*"
    effect: allow
---

Implement the requested scoped change, follow repository conventions, and verify the result with project-appropriate checks.
