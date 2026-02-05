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
