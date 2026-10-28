# VyroSolutions

One repo, one Cloudflare project, one Firebase project (`vyrocontractor`), one domain.

```
/                    Vyro Network: sign in, dashboard, businesses, account, legal
/restaurant/         VyroRestaurant
/takeout/            VyroTakeout
/contractor/         VyroContractor (and the customer portal)
/shared/             firebase-config.js, chain-config.js, helpbot-config.js  (edit settings HERE, once)
/icons/              app icons for "Add to Home Screen"
/404.html            sends  yourdomain/<business>/login  to the right app's sign-in page
/firestore.rules     the one set of Firestore rules (paste into Firebase > Firestore > Rules > Publish)
/workers/vyro-help/  the Help chat Worker (deployed separately, see below)
/docs/               notes
```

## Each business gets its own address
When a restaurant or takeout business signs up, Vyro makes a link name from its name:
`yourdomain/hellskitchen/login`. The owner can change it in Settings > Staff sign-in link.
Link names are 3-30 letters or numbers. Names of folders above (restaurant, takeout, shared, ...) are reserved.

## Adding a new app (VyroRetail, ...)
1. Copy the `restaurant` folder to a new folder, for example `retail`.
2. In the new folder, change `var APP = 'restaurant'` in `js/auth.js`, the product name in each page's `onlyRestaurant` line, and the manifest.
3. Add the name to the reserved list in `restaurant/js/auth.js` and `takeout/js/auth.js` (the line starting `var RESERVED`).
4. Add its address to `js/net-config.js` and its entry to `APPS` in `js/net.js`.
5. Add rules for any new collections to `firestore.rules`.

## Deploy
Cloudflare > Workers & Pages > Create > Import the `VyroSolutions` GitHub repo. Project name `vyrosolutions`, build command empty, deploy command `npx wrangler deploy`.
After it deploys: Firebase > Authentication > Settings > Authorized domains > add the new address (and your own domain later).
Then paste `firestore.rules` into Firebase and Publish (only needed when this file changed).

## Help chat Worker
`workers/vyro-help` is not part of the website. Keep deploying it from its own repo/project as now. In its `wrangler.jsonc`,
`ALLOWED_ORIGIN` now accepts several addresses separated by commas: list every address the apps are served from.

## Honest limits
Alerts only appear while a page is open. Crypto payment checking is still done in the page (server-side checking comes later).
Terms and privacy pages are drafts. The work-location check is switched off in restaurant/takeout `js/auth.js` for testing.
