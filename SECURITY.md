# Security Policy — Dopile

## Security Model

**Dopile** treats local area networks (LAN) and Wi-Fi hotspots as untrusted execution environments. The application enforces complete zero-trust access control at the server boundary:

1. **Authentication**: Argon2id password hashing + HttpOnly SameSite cookies.
2. **Authorization**: Server-side user identity verification on every endpoint. Frontend state is untrusted.
3. **CSRF Defense**: Double-submit CSRF headers validated against session state on all mutating HTTP methods.
4. **Rate Limiting**: Brute-force throttling on login endpoints (5 attempts / 5 minute sliding window).
5. **Auditing**: Sensitive security actions recorded in structured audit logs.

## Reporting a Vulnerability

If you discover a security vulnerability in Dopile, please follow responsible disclosure guidelines:

1. Do **not** open a public issue on GitHub.
2. Submit details directly to the system administrator or project maintainer.
3. Include reproduction steps, HTTP request logs, and impact assessment.

Fixes will be prioritized according to severity.
