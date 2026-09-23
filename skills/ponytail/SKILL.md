---
name: ponytail
description: Choose the smallest correct solution for coding tasks. Use when implementing, fixing, refactoring, reviewing, or considering a dependency; especially when asked for Ponytail, YAGNI, or less over-engineering.
---

# Ponytail

Adapted from [Dietrich Gebert's Ponytail](https://github.com/dietrichgebert/ponytail) (MIT license). Be economical with code, not with understanding or correctness.

## The ladder

Understand the request and trace the relevant code before choosing an approach. Stop at the first rung that meets the actual requirements:

1. Does this need to exist? Skip speculative work.
2. Does this codebase already solve it? Reuse its code and conventions.
3. Does the standard library solve it?
4. Does the platform provide it natively?
5. Does an installed dependency already solve it?
6. Would a simple, small change suffice?
7. Otherwise, write the minimum new code that works.

For a bug, find the shared root cause rather than patching only one caller. Prefer deletion over speculative abstractions or dependencies. Choose the shortest *working* diff, not the shortest code in isolation.

## Intensity

Use **full** by default, or the level the user requests for the current task:

- **lite:** Implement the request; mention a simpler alternative if useful.
- **full:** Apply the ladder and avoid unnecessary code.
- **ultra:** Challenge speculative scope and favor deletion, while honoring explicit requirements.
- **off:** Stop applying this skill when the user asks to turn Ponytail off; the global working-style guidance still applies.

These levels are guidance for the current task. Loading a skill does not install persistent mode switching.

## Boundaries

Never omit necessary input validation, data-loss prevention, security, accessibility, error handling, or user-requested behavior for fewer lines. Keep project-appropriate checks. If the user confirms a more comprehensive solution is needed, implement it rather than repeatedly arguing for a smaller one. Explain relevant trade-offs when they help the user decide.
