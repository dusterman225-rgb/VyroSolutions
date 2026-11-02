# Vyro security checklist (things only you can switch on)

The code now does these on its own: browser security headers (`_headers`), internal files hidden from the website (`.assetsignore`),
automatic sign-out when idle (owner/GM 30 min, supervisor 60 min, staff 10 hours, kiosk never), 10-character minimum passwords with a
weak-password check, a privacy filter on the help bot (phone and server), saved "I accept" records for every AI notice,
the assistant refusing to answer until the notice is accepted, and the assistant showing sales and stock only to owners and general managers.

## Do these once (about 20 minutes)

### Firebase / Google Cloud (project vyrocontractor)
1. Google Cloud console > APIs & Services > Credentials > open the "Browser key" used by your site > Application restrictions: **Websites**.
   Add `https://vyrosystems.dusterman225.workers.dev/*` and later `https://vyrosolutions.com/*` and `https://www.vyrosolutions.com/*`.
   (Your Firebase key is not secret, but this stops other sites from using it.)
2. Firebase console > Authentication > Settings > Password policy: require 10+ characters. Turn on **Email enumeration protection**.
3. Authentication > Settings > Authorized domains: remove anything you do not use.
4. Firestore > Rules: paste the latest `firestore.rules` and Publish (it now includes the AI acceptance records).
5. Google Cloud > Billing > Budgets & alerts: set an alert so a surprise is never silent.
6. Do the same restriction and password policy for the payment project `vyro-104df`.

### Cloudflare
7. Worker `vyro-help` > Settings: add `https://vyrosolutions.com` and `https://www.vyrosolutions.com` to ALLOWED_ORIGIN (comma separated) when the domain is live.
8. Keep `OPENROUTER_KEY` only as a Cloudflare secret. Never paste it into a file in GitHub.
9. SSL/TLS > Edge Certificates: turn on Always Use HTTPS.

### GitHub
10. Your account: turn on two-factor sign-in. Repo > Settings > Branches: protect `main` (require the check to pass).
11. Repo > Settings > Code security: turn on secret scanning and Dependabot alerts.

### Habits
12. Export a copy of your data from the Data and activity page on a schedule. Spark plan has no automatic backups.
13. When someone leaves your team, remove them in Team the same day.

## Honest limits
- Nothing here has had an outside security review. Before you handle real customers' sensitive information, pay a security professional to test it, and have a lawyer review your terms and privacy policy.
- The firestore rules were checked by reading and by mock tests, not in Google's rules emulator.
- The privacy filter catches emails, phone numbers, card and ID numbers, addresses, keys and wallet addresses. It cannot recognise a person's name.
- When someone uses their own AI key, the question passes through Vyro's helper for a moment (not saved). The key itself stays on that phone and is erased when they sign out.
- Firebase on the free plan has no App Check enforcement, no multi-factor sign-in and no automatic backup. Those need a paid plan or extra setup.
- Pay-with-Vyro payments are confirmed by the browser looking at the blockchain. A server-side check does not exist yet.
