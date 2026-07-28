# Worker Network Fixture

Minimal public fixture for validating worker network instrumentation.

The page creates a dedicated worker that POSTs to `/api/collect?kind=bootstrap` immediately. Submitting its form creates a second dedicated worker that POSTs to `/api/collect?kind=submit`. The form always prevents its native submission.

The fixture uses `/worker.js`, matching normal site workers.

Deploy this directory as a Vercel project:

```bash
vercel --cwd apps/steel-browser/worker-network-fixture
```

Validation criteria for a session with `captureWorkerNetwork` enabled:

1. The page reaches a `ready` status.
2. Submitting the form reaches a `submitted` status without navigating.
3. Session logs contain both worker `POST` requests to `/api/collect`, including `kind=bootstrap` and `kind=submit`.
