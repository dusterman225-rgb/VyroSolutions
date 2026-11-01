# Vyro security review of firestore.rules (October 30, 2026)

This is a careful read of the rules by the same assistant that wrote most of them, not an independent audit.
Get an independent review (a security engineer who has not seen the code) before real customers and real money depend on it.
The rules were also not run in the Firebase emulator in this review; test after each Publish with the checklist in the update notes.

## Fixed in this update
1. Guests who scan a table QR code sign in anonymously. The old rules let any signed-in person, including a guest, create a business and make themselves its owner. That could be used to fill your free database quota. Creating a business and its first owner record now requires a real (non-anonymous) account.

## Open items (not fixed here), most important first
1. Staff can change an open order's amounts. Any team member can update an order that is still Open, and the rules only check the total is a sensible number. A dishonest cashier could lower prices or discounts before marking it paid. Fix: limit which fields a non-manager can change on an open order (add items, never change prices, discounts or totals). Needs care because the point of sale rewrites the whole order.
2. Pay with Vyro is checked on the device. A team member could mark an order paid with Pay with Vyro without a real payment. Fix: a server check (a Cloudflare Worker that looks the payment up on the blockchain and writes the result) is needed before real money depends on it. A server needs a Firebase service account, so this is a deliberate project, not a quick change.
3. No App Check. Anyone can call your Firebase project from their own script (they still need to pass the rules). App Check makes Firebase accept only requests from your real website. Needs a free reCAPTCHA key from you; turn on "monitor" mode first, then enforce.
4. Notifications can be sent to any person in the same business by any team member (spam inside one business only). Low risk.
5. Any team member can raise a coupon's use count by 1 each time. Low risk, only affects the coupon's own limit.
6. Anonymous guests can read the whole settings list of a business (tax rate, colours, coupon switch). Nothing secret is stored there today. Do not put secrets in settings.
7. Account and business deletion is not built. Closing a business exists. True deletion needs a server so every sub-list and the login are removed together.

## Looked fine
- Customer estimate links are long random tokens; accepting needs the token and records the time on the server.
- Portal customers can read only their own portal (matched by verified email) and can only bump the unread counter and send messages.
- The AI helper checks the person's own sign-in by reading their own record, counts use per business per day (members can only add 1 at a time), and Photo Plus can only be switched on by you in the console.
- Team changes: only owners and GMs promote, only the owner makes a GM or supervisor, and an owner cannot be changed or removed by anyone else. Ownership hand-over needs the old owner and all three writes in one batch.
- Coupons: only owners and GMs make or change them; the team can only add exactly one use while it is on and under its limit.
