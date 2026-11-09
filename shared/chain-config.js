// Pay with Vyqil settings. These are PUBLIC addresses and settings (no secret keys go in this file).
window.VYRO_CHAIN = {
  // 'devnet' = TEST money with no real value. Change to 'mainnet' only when you are ready for real payments.
  network: 'devnet',
  rpc: {
    devnet: 'https://api.devnet.solana.com',
    mainnet: 'PUT-YOUR-MAINNET-RPC-URL-HERE'
  },
  // Vyqil's fee wallet on Solana. Public address only.
  feeWallet: 'HeGjhmZESYB17wcErsq82GcrAhwKyzQL8SZEqd8D6uQV',
  feeBps: 100,   // 1% paid by the business, taken out of the payment
  // Vyqil's fee address on Ethereum and BNB Chain (the same 0x address works on both). Public address only.
  evm: {
    feeAddress: '0x9bf0BAE9a4669a8325b386CD37fbEFC0c4Bd7922',
    feeBps: 100,
    chains: { ethereum: { chainId: 1, testChainId: 11155111 }, bnb: { chainId: 56, testChainId: 97 } }
  },
  // USDC token addresses. Double-check these against the official Circle / Solana listings before real money.
  usdcMint: {
    devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  }
};
