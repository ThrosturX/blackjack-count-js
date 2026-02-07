# What this is

This repository represents realistic capabilities of froniter LLM models as of late january 2026. The *first steps* were developed by Z.ai's GLM-4.7, followed by refinements by Qwen, then Gemini, then Claude.
After the first steps, other agentic tools were tested such as Antigravity and some in-IDE AI-based code-completion tools. Due to meager limits on frontier models, some chat-based "pair-programming" was also interleaved between agentic tasks. LLM attribution can mostly be found in commit messages. Cursor was deliberately skipped as it has been covered extensively elsewhere.

## Summary of results
The goal was to see what it was like to be a project manager for AI agents, so most of the coding was done by the agents themselves (although I definitely got carried away with the themes a bit during review).
All in all, the agents performed faster than junior developers, but lacked the quality control of senior engineer. As such, I conclude that some hand-holding is still mostly necessary even for frontier models.

### What ths means for you if you are a developer
AI Code completion in-IDE is usable, but not to be trusted in the slightest. The same goes for agentic coding. You can probably expect a minor speed gain at the start of projects, at the expense of refactoring later. This is what a lot of organizations do; prototypes or POCs are developed by "cheaper labour". Basically, your job isn't going anywhere, but _QA pivots_ are going to start winning over _DevOps pivots_.

## Extrapolation
The good news is that local models are catching up FAST. Although this sort of code may seem trivial now (especially for a frontier model), I expect local models running on modest consumer hardware will start to match, if not beat the current state of frontier models in comfort (but not necessarily speed).

## Itch.io reward entitlements (add-ons)
This project can opt-in load add-ons based on itch.io reward ownership. The client reads entitlement metadata from the add-on manifest, calls a lightweight worker, and only allows claimed add-ons to be toggled on.

### Client configuration
Add an `AddonEntitlementsConfig` object before `addons.js`:

```html
<script>
  window.AddonEntitlementsConfig = {
    gameId: 4266975,
    workerUrl: 'https://your-worker.example.com/entitlements',
    clientId: 'e137d33a349d74ae31250b6922c1a295',
    // Optional: return reward IDs directly if you can resolve them via the itch.io SDK.
    // getEntitlements: async () => ['25262']
  };
</script>
```

The loader looks for an itch.io access token via the itch.io SDK (if available) or `AddonEntitlementsConfig.accessToken`. If you can resolve entitlements directly with the SDK, provide `getEntitlements` and skip the worker. Keep any secrets on the worker.

### Worker deployment
Use the Cloudflare Worker in `worker/itch-entitlements-worker.js` and deploy it on a URL that matches `workerUrl`. The worker expects an OAuth access token in the `Authorization: Bearer <token>` header and returns a payload like:

```json
{ "rewardIds": ["25262"] }
```

If you need to pass an OAuth client secret, store it in your worker platform as an environment variable (for example `ITCH_CLIENT_SECRET`) and wire it into the OAuth flow there. Do not hard-code secrets in the client.

### Manifest fields
Add-ons can declare entitlement metadata:

```json
{
  "id": "premium-themes",
  "label": "Premium Themes",
  "requiresEntitlement": true,
  "rewardId": 25262,
  "optInDefault": false,
  "scripts": ["addons/themes-pack.js"],
  "styles": ["addons/premium-themes.css"]
}
```
