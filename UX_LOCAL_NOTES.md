# Local UX hardening (root FastAPI app)

Separate from the `Анаис/` Node app and from AI adapters. No model/provider changes.

- JSON file import: up to 5 MB / 1000 records; array, `{records: [...]}` or organizer `{data:{records:[...]}}` envelope. Required: conversation_id (letters/digits/dot/dash/underscore), language RU/KZ, channel `agent chat`/`voice`, transcript objects with speaker, timestamp, text. Remote audio URLs are ignored. Duplicate IDs are skipped without overwriting history. Entire batch validates before insertion.
- Visible API errors instead of false success; repeated submission buttons locked while pending; stale dialogue/list responses ignored.
- Transcript/criterion/reviewer text escaped; apostrophes in names and evidence work; missing evidence is reported instead of silently doing nothing.
- Gross error retains numeric total, flags correct polarity; criterion edits preserve section and original discrete rules; reviewer must enter a reason rather than inheriting a fabricated justification. Escape dismisses dialogs.

Validation: `python -m unittest discover -s tests -v` (13 passing), `node tests/ui_helpers.cjs`, `node --check static/app.js` and `node --check static/local-workflow.js`.

`tests/browser_workflow.py` is a prepared synthetic-only browser smoke test, NOT verified in this environment: Chromium launch is blocked by `socket() failed: Operation not permitted`, including escalation. Run against a disposable DB with `CQA_DB_PATH=/tmp/cqa-ux-demo.db python -m uvicorn app:app --port 8765`, then `python tests/browser_workflow.py` (requires Playwright and Chromium). Do not run against real user data.

This is not a production security audit. Authentication, organizer URL fetch protections, full keyboard focus management and model accuracy remain outside this patch. No real conversations/API keys included. No deployed site or measured AI accuracy claimed.
