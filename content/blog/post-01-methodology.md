# How I Approach a Contest I Can't Win… Yet - Parameter Golf (OpenAI)

*OpenAI Parameter Golf · Series post #1 of 5*

> **Series:** Fitting a Mind in 16MB — My Journey Through OpenAI Parameter Golf
> **This post:** The systematic process and leaderboard meta-game — before any result worth bragging about.

---

There's a contest where the goal is to train a language model that fits in **16 megabytes** and runs in under **10 minutes on eight H100 GPUs** — and be as good as possible at predicting text.

I'm competing in it. I don't have a winning score yet. This post is about *how I work*, not what I've won.

---

## Why this contest

Three reasons, honestly stacked:

1. **To learn by doing.** LLM training is something I'd read about but not truly internalized. A constrained environment forces precision. When you have 16MB and 10 minutes, you can't handwave efficiency.

2. **I needed a real small model.** A side project of mine needs something in the miniLM/SmallLM class — genuinely capable, not just a toy. The techniques that win here translate directly to production small-model work.

3. **Competitive drive.** The leaderboard is public. That's enough.

---

## Understanding the constraint

The contest evaluates on **bits-per-byte (bpb)** — how many bits the model needs per byte of text to predict it. Lower is better. The contest opened with a naive baseline at **1.2244 bpb**. As I write this, open PRs are pushing toward **1.1048 bpb**. That entire 0.12 gap was closed in under two weeks of public collaboration.

The hard constraints:
- **16,000,000 bytes** total (code + compressed weights, decimal not MiB)
- **≤600 seconds** on 8×H100 SXM
- Tokenizer fixed: SentencePiece sp1024 (vocabulary of 1024 tokens)
- Evaluated on FineWeb validation set

> 📊 **Leaderboard timeline** — every public entry from baseline to the current PR frontier. Click any dot or card to see the full technique breakdown and stats.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/leaderboard-timeline.html"
    style="width:100%;height:clamp(460px, 55vw, 820px);border:none;display:block"
    scrolling="no"
    title="Parameter Golf — Leaderboard Timeline"
    loading="lazy"
  ></iframe>
</div>

---

## Step 1: Read the leaderboard before touching code

This is open-weight. Every top submission publishes full training code.

Before writing a single line, I spent time reading the top entries end to end. Not to copy blindly — to understand *why* each choice was made and what the measured delta was.

The leaderboard tells a story in generations. Reading them in order is like watching an optimization campaign compressed into two weeks:

| Era | bpb range | What happened |
|-----|-----------|---------------|
| Foundations (Mar 17–18) | 1.22–1.19 | Sliding window eval, FP16 embed, long context — the free wins |
| Architecture (Mar 19–20) | 1.19–1.14 | MLP×3, STE int6 QAT, SmearGate, BigramHash, SWA — the big wins |
| TTT + LeakyReLU (Mar 21–23) | 1.14–1.119 | Test-time training, LeakyReLU², Parallel Muon — the merged SOTA |
| Open PRs (Mar 26) | 1.119–1.10 | 15L depth recurrence, HedgeMixer, Mamba hybrid — the frontier |

The key lesson from reading: **each generation builds directly on the last**. No one is starting from scratch. The contest moves fast because people fork the strongest public base and make targeted diffs.

> 📊 **Technique stack pipeline** — how each technique layers from the naive baseline to the current merged SOTA and our active plans. Click any node to see the technique details and expected delta.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/technique-stack-pipeline.html"
    style="width:100%;height:clamp(480px, 58vw, 860px);border:none;display:block"
    scrolling="no"
    title="Parameter Golf — Technique Stack Pipeline"
    loading="lazy"
  ></iframe>
</div>

---

## Step 2: Choose a copy base, not a blank slate

The worst thing you can do in a contest like this is start from scratch. The best public submission already encodes weeks of ablations. Start there.

I'm currently building off the **merged SOTA** (`2026-03-23_LeakyReLU_LegalTTT_ParallelMuon`, 1.1194 bpb). It already includes:

- LeakyReLU(0.5)² activation, legal score-first TTT (3ep SGD), Parallel Muon optimizer
- STE int6 QAT, MLP×3, SmearGate, OrthoInit, Muon WD=0.04, SWA, FP16 embed, sliding eval stride=64

That's every major architectural win from the first two eras, already working together. I don't re-implement any of it — I only add targeted diffs.

**One thing that happened mid-campaign:** I originally planned to build off the #2 SmearGate base (1.1458) with five plans targeting ~1.137 bpb. The leaderboard advanced to 1.1194 before I had Gate 3 results, making those targets uncompetitive. The plans were retired. I re-forked from the merged SOTA and restructured around two new plans.

The principle: **the base you choose is the most consequential decision**. Optimize for "most feature-complete and cleanest code," not "highest score" — you'll be adding diffs on top.

---

## Step 3: Plan before implementing

I don't open the training file and start editing. I write a plan file first.

Each plan has:
- **Hypothesis** — what it's expected to do and by how much
- **Exact code changes** — which functions change, what new env vars get added
- **Conflicts** — which other plans this is incompatible with
- **Fallback** — how to disable if it breaks something

Right now I have two active plans:

| Plan | Technique | Expected Δbpb | Risk | Depends on |
|------|-----------|:-------------:|:----:|:----------:|
| **D** | Int5 MLP → free ~1.5 MB → bigram expand | −0.002 to −0.003 | Low | none |
| **B** | 15L BI-guided depth recurrence (layers 9-13 tied) | −0.009 to −0.012 | Med | D |

Stack: **D → B**, targeting ≤1.109 bpb (beating PR #857's 1.1093).

> 📊 **Plan dependency graph** — Plan D and B with gate thresholds, env vars, and run commands. Click any node.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/plan-dependency.html"
    style="width:100%;height:clamp(460px, 52vw, 720px);border:none;display:block"
    scrolling="no"
    title="Parameter Golf — Plan Dependency Graph"
    loading="lazy"
  ></iframe>
</div>

---

## Step 4: Gate-based compute spending

H100 time is not free. A 3-seed final run costs ~$10.50. Run that ten times chasing dead ends and you've spent $100 on noise.

I use a four-gate system:

```
Gate 1  →  1×H100 smoke test, 1 seed       ~$0.30   No crash, artifact < 16MB
Gate 2  →  1×H100 full run vs base         ~$0.30   Visible bpb improvement
Gate 3  →  8×H100, 1 seed                  ~$3.50   val_bpb on track for target
Gate 4  →  8×H100, 3 seeds (final)        ~$10.50   Mean bpb at target, p < 0.01
```

Nothing proceeds past its gate without passing it. This sounds obvious. It required real discipline the first few times I was excited about a technique.

Plan B has an **additional hard gate** that overrides everything: the smoke test must show `step_avg ≤ 130ms`. If the 15-layer recurrence makes each step too slow, we won't complete 600s of training regardless of quality per step. Abort immediately if this fires.

> 📊 **Gate system flowchart** — full decision flow from idea to submission. Hover any node for details on what it checks and what abort looks like.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/gate-system-flowchart.html"
    style="width:100%;height:clamp(500px, 60vw, 900px);border:none;display:block"
    scrolling="no"
    title="Parameter Golf — Decision Gate System"
    loading="lazy"
  ></iframe>
</div>

---

## Step 5: Document failures with the same rigor as wins

This is the practice I'm most proud of.

Before every session I check `failures.md` — a document that records every ruled-out technique: who tried it, what happened, and *why* it failed. Not just "it got worse" but the underlying reason.

Example entries:

- **SwiGLU activation** — 45% slower per step, so at the fixed 600s wall-clock budget it trades more steps for slightly better quality per step, and loses. The lesson: *throughput is a first-class resource in fixed-time training*.
- **Layer recurrence (naive fixed-time)** — halves step count; loss in steps far exceeds quality gain from recurrence. But this was on a single RTX 5090. PR #857 made it work at 8×H100 scale with BI-guided layer selection and only 5 tied positions instead of all layers. It's now Plan B.
- **BigramHash beyond 10240 buckets** — proven diminishing returns. Marginal gain < parameter cost above this size.

The failures log saves me from re-running ruled-out ideas. More importantly, the *why* often contains the seed of something that would work: knowing naive recurrence fails because of throughput tells you that the right implementation is one where you can control exactly which layers get tied and measure step time before committing.

---

## How I use AI assistance

I use Claude Code throughout this project. Not to generate training algorithms — I do that. I use it for:

**Navigation and cross-reference.** Two plan files, a failures log, an experiments log, the training script, a CLAUDE.md state file. Keeping track of "does this env var already exist in the base script?" or "what was the step time on PR #857?" across sessions is where an assistant genuinely helps.

**The testing-adjusting loop.** After a smoke test run, pulling the specific log lines that matter, checking artifact size against the budget, comparing bpb to the expected baseline delta — the mechanical part of iterating. Automating the boring part of the loop.

**Documentation hygiene.** My failures and experiments logs stay current because I treat writing entries as part of each session, not as overhead afterward.

What I keep to myself: *deciding what to try next*. Reading the leaderboard, forming a hypothesis, understanding why a technique works mechanically — that judgment stays with me.

---

## Quantization: the size-quality tradeoff in practice

This contest lives and dies on quantization. The vocabulary is only 1024 tokens, so the model has very little representational budget. Every bit you save in weight storage is a bit you can spend on more weights, more layers, or bigger hash tables.

The key insight from reading the leaderboard:

**Straight-Through Estimator (STE) QAT** is the technique that made serious compression viable. Before STE, quantizing during training degraded performance. With STE, the quantization gap went from ~0.016 bpb to ~0.0001. The model trains with simulated quantization and learns to work within it.

The current approach in the merged SOTA uses three precision tiers:
- **Int6 for MLP weights** `[-32, 31]` — current base; Plan D tightens this to int5
- **Int6 for attention weights** `[-32, 31]` — stays int6
- **FP16 for embeddings** — negligible size cost, real quality impact

Plan D's key arithmetic: **int5 MLP saves ~1.5MB** vs int6. That freed space funds either BigramHash expansion (1536→4096) or an additional transformer layer. The base is currently at 15.75MB — barely under the 16MB cap — so this budget management is critical.

> 📊 **Quantization tradeoff chart** — bpb vs artifact size for every public entry, quant scheme selector, and explainer on how STE QAT and per-row scaling work.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/quantization-tradeoff.html"
    style="width:100%;height:clamp(520px, 64vw, 960px);border:none;display:block"
    scrolling="no"
    title="Parameter Golf — Quantization Tradeoff Chart"
    loading="lazy"
  ></iframe>
</div>

---

## Where I am right now

Honest status: the leaderboard moved faster than my experiments. I had five plans queued against the #2 SmearGate base (1.1458) when the merged SOTA landed at 1.1194. Those plans were retired — their target bpb of ~1.137 was already behind the base I'd need to fork from.

I re-scoped to two plans: Plan D (low-risk, well-understood) and Plan B (medium-risk, validated by PR #857). The target is ≤1.109 bpb.

The process is what I have to report from this phase. The numbers come later.

If you're working on a similar campaign — this contest or any other constrained optimization — the single most transferable practice: **write down what didn't work and why, with the same discipline you use for what did**. I use that document more than any other.

---

## What's next in this series

| Post | Topic | Status |
|------|-------|--------|
| **#1 — This post** | Methodology + leaderboard meta-game | ✅ Published |
| **#2 — How the Leaderboard Moved Underneath Us** | The P1–P5 retirement, pivoting bases, what the pace of this contest teaches | ⏳ After first smoke test |
| **#3 — When It Beat My Expectations** | Technical deep-dive on whichever plan delivers the surprise win | ⏳ After Gate 3 results |
| **#4 — Failures I'm Glad I Documented** | Post-mortem on ruled-out techniques; what the failures log actually saved | ⏳ After more experiments |
| **#5 — Small Models for Real Projects** | Connecting contest learnings to production miniLM use | ⏳ Closing post |

---

*If you're running experiments on this contest or building small LMs for production use, I'd like to know — especially if you have a failing technique you're trying to understand.*
