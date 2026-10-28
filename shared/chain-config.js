// Pay with Vyro settings. These are PUBLIC addresses and settings (no secret keys go in this file).
window.VYRO_CHAIN = {
  // 'devnet' = TEST money with no real value. Change to 'mainnet' only when you are ready for real payments.
  network: 'devnet',
  rpc: {
    devnet: 'https://api.devnet.solana.com',
    mainnet: 'PUT-YOUR-MAINNET-RPC-URL-HERE'
  },
  // Vyro's fee wallet (the same one your Vyro app uses). Public address only.
  feeWallet: 'PUT-YOUR-VYRO-FEE-WALLET-ADDRESS-HERE',
  feeBps: 200,   // 2% paid by the business, taken out of the payment
  // USDC token addresses. Double-check these against the official Circle / Solana listings before real money.
  usdcMint: {
    devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  }
};
  
