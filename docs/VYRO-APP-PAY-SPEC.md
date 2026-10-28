# Pay with Vyro: what the Vyro app must do when it scans a business QR

The QR text looks like this (one line):

    vyro://pay?v=1&net=devnet&coin=USDC&to=<BUSINESS_WALLET>&amt=<BASE_UNITS>&dec=6&ref=<REFERENCE>&inv=<INVOICE_NO>&biz=<BUSINESS_NAME>&usd=<CENTS>&mint=<USDC_MINT>

| Field | Meaning |
|---|---|
| v | format version (1) |
| net | `devnet` (TEST) or `mainnet` |
| coin | `USDC` or `SOL` |
| to | the business's wallet (receives 98%) |
| amt | TOTAL the customer sends, in the coin's smallest units (USDC has 6 decimals, SOL has 9) |
| dec | decimals for the coin |
| ref | a one-time public key used to find this payment on the blockchain |
| inv, biz, usd | invoice number, business name, US-dollar amount in cents (for display only) |
| mint | the USDC token address (USDC only) |

## Rules for the Vyro app

1. Show the customer the business name, invoice number and amount BEFORE signing. If `net` is `devnet`, show a clear TEST label.
2. Build ONE transaction that does both transfers:
   - fee = floor(amt x 200 / 10000) (2%)
   - business gets amt minus fee, sent to `to`
   - Vyro's fee wallet gets fee
3. The app must use ITS OWN fee wallet and its own 2% rate. Never read a fee wallet or fee rate from the QR (a fake QR could redirect the fee).
4. Do NOT add the usual 1% sender fee on these payments. The business pays the 2%.
5. Add the `ref` public key as an extra READ-ONLY account on one of the transfer instructions. This is how Vyro Business finds the payment.
6. USDC: if the business's or fee wallet's USDC token account does not exist yet, include "create associated token account (idempotent)" instructions so the payment does not fail.
7. Ask the customer to sign (WalletConnect), send, and show success only after the transaction is confirmed.
8. Reject the QR if `v` is not 1, if `net` does not match the network the app is on, or if `to`/`ref` are not valid addresses.

Vyro Business checks the blockchain for a finished transaction that includes `ref`, where the business wallet received at least 98% and the Vyro fee wallet at least 2% of `amt`.
