# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | yes       |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Use GitHub's private reporting: **Security → Report a vulnerability** on
<https://github.com/khezan10/downloadin-ya>, or email the maintainer.

Include: what the issue is, the steps to reproduce it, and the impact you
believe it has. You can expect a first response within 72 hours.

## What this project does and does not do with your data

- The download endpoint takes a public social media URL and resolves it
  through third-party upstream services. It never asks for, stores, or uses
  your account, cookies, or login.
- The IP address of a request is **masked before it is written** to the
  activity log (last octet replaced with `x`).
- Only the activity log is stored, in MongoDB. No media is uploaded or kept.
- The `MONGODB_URI` secret is read from the environment. It is never
  committed — `.env.local` is in `.gitignore` and a CI check fails the build
  if a connection string with a password reaches a commit.

## Scope note

This project links to third-party services (SaveFrom, TikWM,
socialdownloader.space). Those services see the URL you paste. That is
inherent to how the tool works and is not a vulnerability in this codebase.
