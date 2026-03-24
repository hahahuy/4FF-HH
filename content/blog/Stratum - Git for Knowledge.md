# Stratum: Because Your Research Team Deserves a Git for Knowledge

Picture this. It's 11pm. You're writing the discussion section of your paper and you vaguely remember that a labmate posted something important in Slack — three months ago, in a thread that has since been buried under 4,000 messages about broken pipelines and lunch plans. You find it eventually. It links to a Notion doc. The Notion doc was last edited by someone who graduated in May. Half the links are dead. One section says "TODO: verify this claim." Nobody verified it. You have no idea if the original source still holds.

This is not an edge case. This is Tuesday in a research lab.

Somewhere on another floor of the same building, a PDF is living in seventeen different people's Downloads folders, each annotated differently, none of those annotations shared. A brilliant synthesis note lives in a PhD student's personal Obsidian vault, accessible to exactly one person, and will be lost to the institution the day they defend. The team's "shared knowledge base" is a Google Drive folder where documents go to die — no graph, no backlinks, no way to say "this finding was contested in 2024" versus "this is the consensus position."

The tools aren't the problem. The model is.

---

## The Real Diagnosis

We've had good tools for decades. Zotero for papers. Notion, Obsidian, Roam for notes. Google Docs for collaboration. Slack for communication.

The gap isn't features. The gap is **workflow**.

There is no shared model for how a research idea moves from "one person's hunch" to "team consensus." There is no protocol for saying "I think this finding is now outdated" in a way that flags it for everyone without just deleting it. There is no mechanism for "this is speculative — keep it separate from what we actually know." There is no audit trail for "who added this claim, when, and why."

Research teams are running distributed knowledge systems with none of the coordination primitives that distributed knowledge systems require. You wouldn't run a codebase with no version control, no code review, and no way to revert bad commits. Yet somehow that's exactly how we run shared research knowledge.

Developers solved this problem for code in the early 2000s. Git gave us a principled model: parallel work, explicit merging, reviewable diffs, a blame trail. GitHub layered on social coordination: pull requests, inline review, status checks. The result was a global, asynchronous, high-throughput system for collaborative knowledge production.

The knowledge in those repositories — architecture decisions, design patterns, institutional understanding encoded in code — is far better preserved, attributed, and navigated than anything sitting in a research lab's Notion.

Why?

---

## What Git Got Right

Git's real insight wasn't branching or merging. It was this: **explicit staging**. You don't commit half-baked work. You don't push directly to main. You propose a change, someone reviews it, and it enters the shared record only when it's ready.

That staging layer forces clarity. It creates a moment of intentionality — "I believe this is true enough to put into the shared graph." It creates accountability — here is who proposed it, here is their rationale, here is who reviewed it. It creates reversibility — if it's wrong, you can revert it. And crucially, it creates a record that survives any individual contributor's departure.

Research knowledge needs all of these things. It just doesn't have them yet.

---

## Enter Stratum

Stratum is an open-source, self-hosted research workspace that treats knowledge the way git treats code. It combines Zotero-style paper management (DOI import, PDF upload, metadata from CrossRef/Semantic Scholar/Unpaywall, citations in BibTeX/APA/MLA/Chicago) with Obsidian-style linked Markdown notes (`[[wikilinks]]`, backlinks, `@citation` support, a TipTap editor, and a live knowledge graph rendered with Cytoscape.js) — and underneath all of it, a collaboration layer called the ICS: the Incremental Consensus System.

The ICS is the part that matters. Everything else is infrastructure.

---

## The ICS: A Git for Knowledge

The metaphor maps cleanly. Here it is in full:

| Git concept | ICS equivalent |
|---|---|
| Local working directory | Your private draft space |
| `git add` + pull request | Proposal with rationale |
| Code reviewer | Domain reviewer matched by expertise tags |
| Merge | Node/link enters the shared graph |
| Merge conflict | Semantic conflict (detected by embeddings) |
| Close PR | Archive — never deleted, always re-proposable |
| Branch | Speculative track |
| Tag / release | Confidence level: `hypothesis → supported → established` |
| Git blame | Provenance trail on every node |

Every team member has a private draft space. When you're ready to make a claim part of the shared knowledge base, you submit a **proposal**: a note or set of notes, plus a rationale explaining *why* this belongs in the shared graph. You can attach source papers. You can reference existing nodes.

The proposal enters a review queue. Reviewers are suggested automatically based on **expertise tags** — each user declares their domain expertise, and the system routes proposals to the people most likely to give a meaningful review. This isn't bureaucracy for its own sake; it's the mechanism by which the community maintains epistemic quality without relying on a single gatekeeper.

Review has three outcomes. Not two — three.

- **Merged**: the proposal enters the shared graph. The note is now part of the team's consensus knowledge.
- **Archived**: the proposal is rejected, but preserved. Nothing is deleted. It can be re-proposed later with new evidence.
- **Contested**: the community is genuinely split. This is not a tag. Not a comment. It is a first-class status that visually flags the node in the graph and triggers a banner in the note view. Contested knowledge is still visible, still linked — but everyone knows it is contested.

That third outcome is the one no existing tool supports. Contestation is how science actually works. Embedding it as a first-class state means the knowledge graph reflects reality: some things are settled, some are contested, some are speculative, and the difference matters.

### Confidence Decay

Merged notes carry a **confidence level**: `hypothesis`, `supported`, or `established`. Each level has a configurable decay window. If no one affirms a note within that window, its confidence begins to decay — and the graph flags it as stale. Any team member can "affirm" a note to reset the clock, attesting that it still holds.

This models how scientific consensus actually works. Nothing is settled forever. A finding supported by five studies in 2019 may be contested by a meta-analysis in 2024. Stratum makes that temporal dimension visible and actionable rather than letting stale claims sit quietly in the knowledge base, looking authoritative long after they've stopped being so.

There is also a hard constraint: a note cannot reach `established` confidence without at least one attached source. The system enforces epistemic hygiene at the data layer, not through policy documents that no one reads.

### Semantic Conflict Detection

When you submit a proposal, Stratum runs your note through a sentence-transformers embedding model (all-MiniLM-L6-v2) and compares it against every merged note in your vault. If it finds high cosine similarity combined with polarity reversal — a sign that the new note may be saying the opposite of something already in the graph — it surfaces **conflict hints** in the proposal view.

This is advisory, never blocking. The system is not an oracle. But it is a second pair of eyes that never gets tired, never misses a note from three years ago, and never has a conflict of interest. Reviewers can dismiss the hints or use them as starting points for substantive discussion.

### Speculative Tracks

Not every idea is ready for consensus. Speculative tracks let teams explore unproven hypotheses in a space that is semantically and visually separated from the main graph. Nodes on speculative tracks have distinct visual treatment in the Cytoscape graph. The sidebar groups them under "Experimental." Proposals originating from speculative tracks are flagged as speculative in the review queue.

This isn't a quarantine. It's a first-class epistemic category. Research teams do speculative work — the question is whether the infrastructure acknowledges that or pretends everything is either "known" or "unknown" with nothing in between.

### Quorum and Provenance

Merge is blocked until a configurable quorum of approvals is reached. No single reviewer can unilaterally canonize a claim. And every merged node carries a full provenance trail: who proposed it, when, what rationale they gave, who reviewed it, and what they said. That trail survives the original contributor's departure. It is the institutional memory that Notion never provided.

---

## Why Self-Hosted Matters

Research data is not public data. Clinical trial notes, pre-publication findings, proprietary datasets — these cannot live on someone else's servers, subject to someone else's terms of service, accessible to someone else's employees under legal compulsion.

Stratum is self-hosted by design. You run it on your infrastructure. Your data never leaves. The Docker Compose setup is a single command. The `.env.example` documents every operator-configurable variable. A stable community release branch (`community-v1`) is maintained separately from the development edge.

Beyond data sovereignty, self-hosting means extensibility. You can modify the confidence decay algorithm. You can adjust the semantic similarity thresholds. You can build custom review workflows for your domain. You own the system end to end.

The OSS model also means the tool survives vendor decisions. Zotero has been around for nearly two decades because no one can shut it down. Stratum is built on the same principle: the software belongs to its community.

---

## Try It. Star It. Build It.

If you run a research lab, an R&D team, a think tank, or any group that produces and shares structured knowledge, Stratum is worth running today. The core workflow — import papers, write linked notes, propose to shared graph, review, merge — is complete and stable.

If you're a developer, the stack is approachable: FastAPI + Python 3.10 on the backend, React 18 + TypeScript + Vite on the frontend. The codebase is well-structured, the API is documented, and the open items list is honest about what isn't done yet.

```bash
# Self-host in two commands
git clone https://github.com/hahahuy/stratum
docker compose up --build
```

Open `http://localhost` in your browser. That's it.

The things left to build are genuinely interesting: a Redis-backed job queue for scale, S3 object storage, a proper CI/CD pipeline, frontend tests with Vitest, a smoother web clipper auth flow.

Research teams have been running on improvised workflows for long enough. The primitives exist. The analogy is clear. The software is here.

**Your knowledge deserves version control.**
