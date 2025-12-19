# example-token-distribution

Reference implementations for common token distribution flows with ZK Compression (airdrops, payments, rewards)

## Get Started

```bash
pnpm install @lightprotocol/stateless.js@alpha \
            @lightprotocol/compressed-token@alpha

# Add your API key to .env
cp .env.example .env
```
Get one [here](https://dashboard.helius.dev/dashboard) if you don't have one yet.


| Script | Description |
|--------|-------------|
| `pnpm run mint` | Create a new SPL mint and mint tokens |
| `pnpm run airdrop:simple` | Simple airdrop to a small recipient list |
| `pnpm run airdrop:large` | Optimized batched airdrop for many recipients |
| `pnpm run decompress` | Compress tokens then decompress back to SPL |