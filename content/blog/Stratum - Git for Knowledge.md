# Stratum: Because Your Research Team Deserves a Git for Knowledge

Picture this. It's 11pm. You're writing the discussion section of your paper and you vaguely remember that a labmate posted something important in Slack — three months ago, in a thread that has since been buried under 4,000 messages about broken pipelines and lunch plans. You find it eventually. It links to a Notion doc. The Notion doc was last edited by someone who graduated in May. Half the links are dead. One section says "TODO: verify this claim." Nobody verified it. You have no idea if the original source still holds.

This is not an edge case. This is Tuesday in a research lab.

Somewhere on another floor of the same building, a PDF is living in seventeen different people's Downloads folders, each annotated differently, none of those annotations shared. A brilliant synthesis note lives in a PhD student's personal Obsidian vault, accessible to exactly one person, and will be lost to the institution the day they defend. The team's "shared knowledge base" is a Google Drive folder where documents go to die — no graph, no backlinks, no way to say "this finding was contested in 2024" versus "this is the consensus position."

---

## The Real Problem Isn't the Tools

We've had Zotero for papers, Obsidian for notes, Google Docs for collaboration, Slack for communication — for decades. The gap isn't features. The gap is **workflow**.

There is no shared model for how a research idea moves from "one person's hunch" to "team consensus." There is no protocol for flagging a finding as outdated without just deleting it. There is no mechanism for keeping speculative ideas separate from what you actually know. There is no audit trail for who added a claim, when, and why.

Research teams are running distributed knowledge systems with none of the coordination primitives that distributed knowledge systems require. You wouldn't run a codebase with no version control, no code review, and no way to revert bad commits. Yet somehow that's exactly how we run shared research knowledge.

Developers solved this in the early 2000s: git gave us explicit staging — you don't push half-baked work directly to main. You propose a change, someone reviews it, and it enters the shared record only when it's ready. That layer forces clarity, creates accountability, and produces a record that survives any individual contributor's departure.

Research knowledge needs all of this. It just hasn't had it — until now.

---

## Enter Stratum

Stratum is an open-source, self-hosted research workspace that treats knowledge the way git treats code. It combines Zotero-style paper management (DOI import, PDF upload, metadata from CrossRef/Semantic Scholar/Unpaywall, citations in BibTeX/APA/MLA/Chicago) with Obsidian-style linked Markdown notes (`[[wikilinks]]`, backlinks, `@citation` support, a TipTap editor, and a live knowledge graph via Cytoscape.js) — and underneath all of it, a collaboration layer called the ICS: the Incremental Consensus System.

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

Every team member has a private draft space. When you're ready to make a claim part of the shared knowledge base, you submit a **proposal**: a note or set of notes, plus a rationale explaining *why* this belongs in the shared graph. You can attach source papers and reference existing nodes.

The proposal enters a review queue. Reviewers are suggested automatically based on **expertise tags** — each user declares their domain expertise, and the system routes proposals to whoever is best positioned to give a meaningful review, without relying on a single gatekeeper.

Review has three outcomes.

- **Merged**: the note enters the shared graph as consensus knowledge.
- **Archived**: rejected, but preserved. Nothing is deleted. It can be re-proposed later with new evidence.
- **Contested**: the community is genuinely split. This is not a tag or a comment — it is a first-class status that visually flags the node in the graph and surfaces a banner in the note view.

That third outcome is the one no existing tool supports. Contestation is how science actually works. Embedding it as a first-class state means the knowledge graph reflects reality: some things are settled, some are contested, some are speculative, and the difference matters.

### Confidence Decay

Merged notes carry a **confidence level**: `hypothesis`, `supported`, or `established`. If no one affirms a note within its configurable decay window, its confidence decays and the graph flags it as stale. Any team member can "affirm" a note to reset the clock. There is also a hard constraint: a note cannot reach `established` without at least one attached source — epistemic hygiene enforced at the data layer, not by a policy doc no one reads.

This models how scientific consensus actually works. Nothing is settled forever. A finding supported by five studies in 2019 may be contested by a meta-analysis in 2024. Stratum makes that temporal dimension visible and actionable rather than letting stale claims sit quietly in the knowledge base, looking authoritative long after they've stopped being so.

### Semantic Conflict Detection

On proposal submit, Stratum runs your note through a sentence-transformers embedding model (all-MiniLM-L6-v2) and compares it against every merged note in the vault. High cosine similarity combined with polarity reversal surfaces **conflict hints** in the proposal view — advisory, never blocking. A second pair of eyes that never gets tired and never misses a note from three years ago.

### Speculative Tracks

Not every idea is ready for consensus. Speculative tracks let teams explore unproven hypotheses in a space visually and semantically separated from the main graph, grouped under "Experimental" in the sidebar. A first-class epistemic category, not a quarantine.

### Quorum and Provenance

Merge is blocked until a configurable quorum of approvals is reached — no single reviewer can unilaterally canonize a claim. Every merged node carries a full provenance trail: who proposed it, when, the rationale, and who reviewed it. That trail survives the original contributor's departure. It is the institutional memory that Notion never provided.

---

## Why Self-Hosted Matters

Research data is not public data. Clinical trial notes, pre-publication findings, proprietary datasets cannot live on someone else's servers under someone else's terms of service. Stratum runs on your infrastructure, your data never leaves, and a stable community release branch (`community-v1`) tracks the self-hosted deployment separately from the development edge.

Beyond data sovereignty: self-hosting means you own the system. Modify the decay algorithm, adjust similarity thresholds, build custom review workflows. And because it's OSS, it survives vendor decisions — the software belongs to its community.

---

## Try It. Star It. Build It.

If you run a research lab, an R&D team, a think tank, or any group that produces and shares structured knowledge, Stratum is worth running today. The core workflow — import papers, write linked notes, propose to shared graph, review, merge — is complete and stable.

If you're a developer, the stack is approachable: FastAPI + Python 3.10 on the backend, React 18 + TypeScript + Vite on the frontend. The codebase is well-structured, the API is documented, and the open items list is honest about what isn't done yet.

```bash
git clone https://github.com/hahahuy/stratum
docker compose up --build
```

Open `http://localhost`. That's it.

***Your knowledge deserves version control.***
