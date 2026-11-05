# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| `main` branch | ✅ |
| Older releases / tags | ❌ |

Security fixes are made only on the latest state of the `main` branch. If you self-host DocGraph, keep your deployment up to date (see [Updating](./docker/README.md#updating)).

## Reporting a vulnerability

**Do not open a public issue, discussion or pull request for security vulnerabilities.**

Report vulnerabilities privately through GitHub's [private vulnerability reporting](../../security/advisories/new) for this repository.

Please include as much of the following as possible:

- Type of issue (e.g. authentication bypass, injection, XSS, privilege escalation)
- Affected component (`apps/server`, `apps/web`, `packages/common`, MCP endpoint, Docker image, …)
- Step-by-step instructions or a proof of concept to reproduce the issue
- Impact assessment — what an attacker could gain
- Relevant logs, screenshots or HTTP requests/responses

## What happens next

1. We acknowledge the report and confirm whether we can reproduce it.
2. We work on a fix in a private security advisory and may ask you for more details.
3. Once the fix is on `main`, we publish the advisory and credit you, unless you prefer to stay anonymous.

Please give us a reasonable amount of time to release a fix before disclosing the issue publicly.

## Scope

- In scope: the application code in this repository (`apps/server`, `apps/web`, `packages/common`) and the Docker setup in `docker/`.
- Out of scope: vulnerabilities in third-party dependencies that are already covered by an upstream advisory — please report those upstream, but let us know if a specific pinned version affects this project.
- Out of scope: automated scanner output without a demonstrated exploit path, missing security headers without a concrete impact, self-XSS, and issues requiring physical access to a machine.
- Out of scope: insecure self-hosted configurations that contradict the [deployment guide](./docker/README.md), e.g. default secrets left in place or the app port exposed without the reverse proxy.
