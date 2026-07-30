---
name: verify
description: Run lint, type check, and tests to verify code changes work correctly. Use before marking work complete to catch failures early.
---

Run the full verification suite to ensure code changes are correct:

1. **Lint**: `ruff check .`
2. **Type check**: `mypy app.py --ignore-missing-imports`
3. **Tests**: `pytest`

Execute all three in sequence. Report any failures with the specific errors.

If all checks pass, confirm the changes are ready. If any fail, show the errors and suggest fixes.
