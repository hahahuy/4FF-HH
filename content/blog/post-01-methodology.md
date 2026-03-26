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

The contest evaluates on **bits-per-byte (bpb)** — how many bits the model needs per byte of text to predict it. Lower is better. The current best is around **1.1428 bpb**. The naive baseline starts at **1.2244 bpb**. Every technique you see in the leaderboard submissions represents a measurable slice of that 0.08 gap.

The hard constraints:
- **16,000,000 bytes** total (code + compressed weights, decimal not MiB)
- **≤600 seconds** on 8×H100 SXM
- Tokenizer fixed: SentencePiece sp1024 (vocabulary of 1024 tokens)
- Evaluated on FineWeb validation set

> 📊 **Leaderboard timeline** — every public submission, key techniques, bpb progression. Click any entry to see the full technique breakdown.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/leaderboard-timeline.html"
    style="width:100%;aspect-ratio:1180/820;border:none;display:block"
    scrolling="no"
    title="Parameter Golf — Leaderboard Timeline"
    loading="lazy"
  ></iframe>
</div>

---

## Step 1: Read the leaderboard before touching code

This is open-weight. Every top submission publishes full training code.

Before writing a single line, I spent time reading the top entries end to end. Not to copy blindly — to understand *why* each choice was made and what the measured delta was.

Here's what the leaderboard looked like when I started, compressed to what matters:

| Rank | bpb | Key techniques over baseline |
|------|-----|------------------------------|
| Naive baseline | 1.2244 | 9L×512d, int8+zlib |
| After sliding eval | ~1.192 | Pure eval trick — free −0.032 |
| After MLP×3 | ~1.163 | Wider MLP — biggest single arch win (−0.029) |
| After int6 QAT | ~1.150 | STE quantization-aware training eliminates quant gap |
| **#2 SmearGate** | **1.1458** | + SmearGate, OrthoInit, BigramHash(4096), SWA, Muon WD |
| **#1 SOTA** | **1.1428** | + Int5 MLP, 10 layers, BigramHash(10240) |

Each row is a generation of the contest. Reading them in order is like watching an optimization campaign compressed into a week.

> 📊 **Technique stack pipeline** — how every technique layers from naive baseline to SOTA, with per-plan deltas and compatibility matrix. Switch between Track A / B / C.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/technique-stack-pipeline.html"
    style="width:100%;aspect-ratio:1180/860;border:none;display:block"
    scrolling="no"
    title="Parameter Golf — Technique Stack Pipeline"
    loading="lazy"
  ></iframe>
</div>

---

## Step 2: Choose a copy base, not a blank slate

The worst thing you can do in a contest like this is start from scratch. The best public submission already encodes weeks of ablations. Start there.

I chose **#2 (SmearGate)** as my copy base. Reasoning:

- It's the most feature-complete foundation: sliding eval, STE int6 QAT, MLP×3, SmearGate, OrthoInit, Muon WD, SWA, FP16 embed — all already working together.
- The gap to #1 is small (0.003 bpb) and the diff is legible: int5 MLP, 10th layer, bigger BigramHash.
- #1's code is readable but its specific combination of changes is harder to learn from as a base.

The principle: **minimize the unknown surface area when you start**. When you fork from a strong, clean baseline, every change you make is a clear hypothesis.

---

## Step 3: Plan before implementing

I don't open the training file and start editing. I write a plan file first.

Each plan has:
- **Hypothesis** — what it's expected to do and by how much
- **Exact code changes** — which functions change, what new env vars get added
- **Conflicts** — which other plans this is incompatible with
- **Fallback** — how to disable if it breaks something (usually an env var)

Right now I have five plans queued:

| Plan | Technique | Expected Δbpb | Risk |
|------|-----------|:-------------:|:----:|
| P1 | Int5 MLP + 10th layer | −0.003 | Low |
| P2 | BigramHash(10240) + TrigramHash | −0.002 | Low-Med |
| P3 | Weight-tied recurrence (13 eff. layers) | −0.003 | **High** |
| P4 | QAT extend to int5-MLP + SWA(0.4) retune | −0.003 | Med |
| P5 | seq_len 2048→4096 + LR retune | −0.002 | Med |

Plans P1→P2→P4→P5 (Track A) are the conservative stack targeting ~1.137 bpb.

> 📊 **Plan dependency graph** — all five plans, expected Δbpb, risk levels, and which are compatible with each other.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/technique-stack-pipeline.html"
    style="width:100%;aspect-ratio:1180/860;border:none;display:block"
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
Gate 3  →  8×H100, 1 seed                  ~$3.50   val_bpb < 1.139
Gate 4  →  8×H100, 3 seeds (final)        ~$10.50   val_bpb < 1.1378, p < 0.01
```

Nothing proceeds past its gate without passing it. This sounds obvious. It required real discipline the first few times I was excited about a technique.

> 📊 **Gate system flowchart** — full decision flow from idea to submission, with abort paths, cost tracker, and gate pass criteria.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/gate-system-flowchart.html"
    style="width:100%;aspect-ratio:1180/900;border:none;display:block"
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
- **Layer recurrence (fixed time budget)** — halves step count; loss in steps far exceeds quality gain from recurrence. But *might* work at 8×H100 scale with a smaller recurrence scope — so it stays as a "conditional failure" not a hard rule.
- **BigramHash beyond 10240 buckets** — proven diminishing returns by SOTA's own ablation. Marginal gain < parameter cost above this size.

The failures log saves me from re-running ruled-out ideas. More importantly, the *why* often contains the seed of something that would work: knowing SwiGLU fails because of throughput tells you to look for activations that are quality-positive *and* step-neutral.

---

## How I use AI assistance

I use Claude Code throughout this project. Not to generate training algorithms — I do that. I use it for:

**Navigation and cross-reference.** I have five plan files, a failures log, an experiments log, the training script, and a CLAUDE.md state file. Keeping track of "does this env var already exist in the base script?" or "does this technique conflict with P4?" across sessions is where an assistant genuinely helps.

**The testing-adjusting loop.** After a smoke test run, pulling the specific log lines that matter, checking artifact size against the budget, comparing bpb to the expected baseline delta — the mechanical part of iterating. Automating the boring part of the loop.

**Documentation hygiene.** My failures and experiments logs stay current because I treat writing entries as part of each session, not as overhead afterward.

What I keep to myself: *deciding what to try next*. Reading the leaderboard, forming a hypothesis, understanding why a technique works mechanically — that judgment stays with me.

---

## Quantization: the size-quality tradeoff in practice

This contest lives and dies on quantization. The vocabulary is only 1024 tokens, so the model has very little representational budget. Every bit you save in weight storage is a bit you can spend on more weights or more layers.

The key insight from reading the leaderboard:

**Straight-Through Estimator (STE) QAT** is the technique that made serious compression viable. Before STE, quantizing during training degraded performance — you'd save size but lose quality. With STE, the quantization gap (the bpb penalty from quantizing) went from ~0.016 to ~0.0001. The model trains with simulated quantization and learns to work within it.

The current SOTA uses three precision tiers:
- **Int5 for MLP weights** `[-16, 15]` — saves ~1.86MB vs int6, enough room to add a 10th layer
- **Int6 for attention weights** `[-32, 31]` — strong quality, smaller size than int8
- **FP16 for embeddings and last KV projection** — embeddings are small, keeping them full precision has negligible size cost but real quality impact

> 📊 **Quantization tradeoff chart** — bpb vs artifact size for every public entry, quant scheme selector, and a six-card explainer on how STE QAT and per-row scaling work.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/quantization-tradeoff.html"
    style="width:100%;aspect-ratio:1180/960;border:none;display:block"
    scrolling="no"
    title="Parameter Golf — Quantization Tradeoff Chart"
    loading="lazy"
  ></iframe>
</div>

---

## Where I am right now

Honest status: I haven't run Gate 3 yet. I'm building a clean working copy from the #2 base, applying P1 (int5 MLP + 10th layer), and running the first smoke test before spending real compute.

The process is what I have to report from this phase. The numbers come later.

If you're working on a similar campaign — this contest or any other constrained optimization — the single most transferable practice is: **write down what didn't work and why, with the same discipline you use for what did**. The failures log is the document I reference most.

---

## What's next in this series

| Post | Topic | Status |
|------|-------|--------|
| **#1 — This post** | Methodology + leaderboard meta-game | ✅ Published |
| **#2 — The Art of the Baseline Diff** | How to read and fork a top submission intelligently | ⏳ After first smoke test |
| **#3 — When It Beat My Expectations** | Technical deep-dive on the surprise win | ⏳ After Gate 3 |
| **#4 — Failures I'm Glad I Documented** | Post-mortem on ruled-out techniques | ⏳ After more experiments |
| **#5 — Small Models for Real Projects** | Connecting contest learnings to production miniLM use | ⏳ Closing post |

---

*If you're running experiments on this contest or building small LMs for production use, I'd like to know — especially if you have a failing technique you're trying to understand.*
