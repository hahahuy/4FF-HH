# Quantum Tunneling: State of the Art (2024–2025)

> A research note for physicists and engineers approaching the field

---

## 1. What Is Quantum Tunneling?

Quantum tunneling is the phenomenon by which a particle crosses a potential energy barrier that it classically lacks sufficient energy to surmount — a direct consequence of the wave nature of quantum states and the nonzero probability amplitude that extends into classically forbidden regions. The transmission probability decays exponentially with barrier width and height, a relationship captured at leading order by the WKB approximation. Far from a curiosity, tunneling is a *load-bearing mechanism* in nature: it enables nuclear fusion in stars, determines enzyme reaction rates in biology, and is the operating principle of the transistors that may define the next generation of computing. The central tension in modern research is that tunneling is simultaneously an engineered resource (qubits, tunnel diodes, STM) and a fundamental nuisance (leakage currents, decoherence, gate-oxide breakdown).

---

## 2. SoTA Overview — The Four Frontiers


| Domain                                         | Key Metric (2024–2025)                                                   | Maturity                                         | Key Institutions                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Quantum Computing / Superconducting Qubits** | 1.5 ms coherence time; 99.5–99.9% gate fidelity                          | Applied R&D / early commercial                   | UC Santa Barbara, Google, IBM, Microsoft, Rigetti                                       |
| **Nanoscale Devices & STM**                    | TFET: 60 mV/dec subthreshold swing; RTD: 100 GHz                         | Prototype / near-node research                   | UCLA, UC Berkeley, UIUC, KAIST, MIT, IBM Research, IMEC                                 |
| **Biological Quantum Tunneling**               | KIE kH/kD > 2 confirmed in multiple enzymes                              | Established (enzymes); contested (wider biology) | UC Berkeley (Klinman), Penn State (Benkovic), U Chicago (Engel), UIUC (Hammes-Schiffer) |
| **Theory & Decoherence**                       | Attosecond tunneling experiments; instanton methods in many-body systems | Active / no consensus on core problems           | Oxford, MIT, Weizmann, RIKEN, broad theoretical community                               |


---

## 3. Domain Deep-Dives

### 3.1 Quantum Computing & Superconducting Qubits

The central enabling mechanism in superconducting quantum computing is **Josephson junction tunneling**: Cooper pairs tunnel coherently across a thin insulating barrier, producing a nonlinear inductance that gives transmon-style qubits their anharmonicity — the property that separates the |0⟩–|1⟩ transition from higher levels and makes selective qubit control possible. Tunneling is thus not a side effect but the *engine* of the qubit.

#### Key Breakthroughs (2024–2025)

- **Flux-tunable superconducting qubits** (UC Santa Barbara, 2024): coherence time of **1.5 ms** — current record for superconducting qubits, achieved through improved materials and junction fabrication
- **3D Transmon architectures**: coherence routinely >100 μs; cavity protection suppresses radiative loss
- **Oxford tunneling qubits**: >10 μs coherence
- **Quantum dot systems**: ~1.4 μs coherence in 5-qubit arrays; relevant for semiconductor integration
- **Surface code error correction deployment (2024)**: Google, IBM, and Microsoft all deployed surface code protocols on real hardware — transition from proof-of-principle to engineered error suppression
- **Topological qubit research** (UC Berkeley, 2024): Majorana-based approaches active, promising inherent protection via non-Abelian anyons

#### Metrics Snapshot


| Metric                           | Value      | Notes                                        |
| -------------------------------- | ---------- | -------------------------------------------- |
| Best coherence time              | **1.5 ms** | Flux-tunable transmon, UC Santa Barbara 2024 |
| Typical 3D transmon coherence    | >100 μs    | Mature platform                              |
| Single-qubit gate fidelity       | >99%       | Multiple groups                              |
| Two-qubit (CNOT) fidelity        | 99.5–99.9% | Leading hardware platforms                   |
| IBM 127-qubit Quantum Volume     | 32         | Eagle processor                              |
| Rigetti 128-qubit Quantum Volume | 64         | Aspen-M series                               |
| Physical qubits / logical qubit  | ~1,000     | Current error-correction overhead            |


#### Open Problems

- **Scalability**: extending to 1,000+ high-quality qubits while maintaining cross-chip connectivity
- **Qubit crosstalk**: parasitic tunneling couplings between neighboring qubits limit addressability
- **Leakage**: tunneling out of the |0⟩/|1⟩ subspace into higher transmon levels — not captured by standard qubit error models
- **Josephson junction materials**: two-level system (TLS) defects at the oxide interface remain the dominant decoherence source; microscopic origin not fully understood
- **Error correction overhead**: ~1,000 physical qubits per logical qubit means millions of physical qubits needed for practical fault-tolerant computation

> **Key insight**: Tunneling is the *mechanism* (Josephson effect → qubit nonlinearity) and simultaneously the *challenge* (leakage, crosstalk, TLS noise). Progress is inseparable from deep materials-level control of tunneling.

---

### 3.2 Nanoscale Devices & Scanning Tunneling Microscopy

#### Tunnel FETs (TFETs)

TFETs exploit **band-to-band tunneling** at a reverse-biased p-n junction, replacing thermionic emission (the Boltzmann-limited mechanism that sets the 60 mV/decade floor in MOSFETs). TFETs can break this floor:


| Metric                            | Value                               | Institution |
| --------------------------------- | ----------------------------------- | ----------- |
| Subthreshold swing                | **60 mV/dec** (theoretical minimum) | UCLA        |
| Power reduction vs. CMOS          | ~10×                                | U. Illinois |
| Ge-based TFET current density     | 1.5 mA/μm                           | KAIST       |
| Supply voltage                    | 0.5 V                               | Various     |
| Off-state leakage                 | <10 pA                              | Various     |
| Shortest gate length (room temp.) | 30 nm                               | UC Berkeley |
| RTD operating frequency           | up to 100 GHz                       | Various     |


#### STM & Atomic-Scale Manipulation

- Sub-ångström lateral resolution, sub-meV energy resolution in tunneling spectroscopy
- **High-speed STM**: up to 100 Hz imaging; ~10 Hz for atomic-scale manipulation
- **ESR-STM** (Choi et al., *Nanoscale Advances* 7, 4551, 2025; arXiv:2505.10079): STM tunneling current drives electron spin resonance on individual atoms — atomic-scale spin sensing
- **2D heterostructures**: MoS₂, WS₂, graphene interlayer tunneling active research area

#### Scaling Limits


| Limit                        | Detail                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Gate-oxide tunneling leakage | Explodes below 5 nm node; direct tunneling through SiO₂ <1 nm is unavoidable      |
| TFET drive current gap       | Still lower than MOSFET at equivalent gate voltage — on-current gap unsolved      |
| Physical gate length floor   | Channel tunneling sets ~5 nm practical minimum for conventional FET geometry      |
| STM throughput               | ~10–100 atoms/hour; research tool only, not manufacturable                        |
| Molecular junction stability | Mechanical and thermal fluctuations limit reproducibility above ~1 nS conductance |


---

### 3.3 Biological Quantum Tunneling

Evidence for tunneling in biology spans a wide credibility range:


| Claim                                                                     | Status                          | Evidence Base                                                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Hydrogen/proton tunneling in DHFR, cytochrome P450, alcohol dehydrogenase | ✅ **Confirmed**                 | Primary KIE kH/kD > 2 (above semiclassical limit); replicated across labs (Klinman, Benkovic groups)                                |
| Quantum coherence in photosynthetic light-harvesting complexes            | ✅ **Confirmed** (scope debated) | 2D electronic spectroscopy; 2024 studies extended coherence signatures beyond reaction centers; functional role under investigation |
| Proton-coupled electron transfer (PCET) in respiratory complexes          | ✅ **Confirmed**                 | Theory + experiment converge; Hammes-Schiffer QM/MM supported by isotope labeling                                                   |
| Proton tunneling in DNA oxidative damage (8-oxoguanine)                   | ✅ **Confirmed** (limited scope) | Computational evidence + isotope data; contribution to mutation rate debated                                                        |
| Significance of tunneling to *total* enzyme rate acceleration             | ⚠️ **Actively debated**         | Estimates range 5–50%; anomalous weak temperature dependence seen in some but not all systems                                       |
| Quantum coherence as *functionally essential* in photosynthesis           | ⚠️ **Contested**                | Oscillations observed, but vibrational vs. electronic origin disputed; 2024 results suggest vibronic mixing                         |
| Olfactory tunneling hypothesis (Turin model)                              | ❌ **Speculative**               | Lacks reproducible experimental confirmation; mechanism disputed                                                                    |
| General quantum coherence beyond photosynthesis                           | ❌ **Highly speculative**        | Insufficient experimental evidence; claims remain theoretical                                                                       |
| Tunneling as driver of DNA *point* mutations                              | ❌ **Highly speculative**        | Computationally suggested; no direct experimental confirmation                                                                      |


**Theoretical methods driving 2024 progress**: QM/MM simulations (quantum subsystem up to ~200 atoms), instanton methods, ring polymer molecular dynamics (RPMD) — increasingly identifying tunneling contributions previously overlooked.

**Key research groups**: Klinman (UC Berkeley), Benkovic (Penn State), Engel (U Chicago), Hammes-Schiffer (UIUC)

---

### 3.4 Theory & Decoherence: Open Problems

#### The Tunneling Time Problem

One of the most genuinely unresolved foundational questions in quantum mechanics:

- **Core question**: How long does a particle spend inside a classically forbidden barrier? Is "tunneling time" even a well-defined observable?
- **The Hartman effect**: Phase time (group delay) saturates and becomes independent of barrier width for thick barriers — apparently implying superluminal traversal. No causal violation occurs, but the physical meaning is disputed.
- **Competing definitions** (all give different answers): phase time, dwell time, Larmor precession time, Wigner delay time, complex time. No experiment has cleanly discriminated between them.
- **Experimental landmarks**: Ramos et al. (*Nature*, 2020) used atomic spin precession in a magnetic barrier; Sainadh et al. (*Nature*, 2019) used attosecond streaking on atomic tunnel ionization. Both set constraints, neither resolved the debate.
- **Status (2025)**: No consensus. The question of whether tunneling time is a measurable observable in the standard quantum mechanical sense remains open.

#### Many-Body & Macroscopic Tunneling

- **Macroscopic quantum tunneling (MQT)**: Well-established in SQUIDs and Josephson junctions (Martinis, Devoret groups). Flux in a SQUID tunnels between flux states — same physics as qubit |0⟩↔|1⟩ under the barrier.
- **Instanton methods**: Saddle-point paths in imaginary time provide systematic semiclassical tunneling rate expansions; applied to vacuum decay, Floquet systems (Takayoshi & Oka, *JPSJ* 94, 111003, 2025; arXiv:2509.03674).
- **Caldeira-Leggett model** (*Ann. Phys.* 149, 374, 1983): Foundational framework for tunneling in dissipative environments; extensions to non-Markovian baths active.
- **Decoherence from complex saddle points** (Nishimura & Watanabe, *PRL*, 2025; arXiv:2408.16627): Connects instanton paths to decoherence rates — bridges tunneling dynamics and open-system physics.

#### Other Active Theoretical Directions


| Direction                                             | Status                         | Key Paper                                                            |
| ----------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Klein tunneling in Dirac/topological systems          | Active                         | Zhang & Gu, *Phys. Rev. A* 113, 032208 (2026); arXiv:2602.23650      |
| Geometric / Berry phase effects in Floquet systems    | Active                         | Takayoshi & Oka (2025); arXiv:2509.03674                             |
| Tunneling in quantum double-well (switching dynamics) | Active                         | Su et al., *Phys. Rev. A* 112, 042202 (2025); arXiv:2501.00209       |
| Hawking radiation as tunneling                        | Established formalism; ongoing | Eslamzadeh & Soroushfar, *JHAP* 5(2), 44–56 (2025); arXiv:2512.06361 |
| Path integral Monte Carlo for many-body tunneling     | Maturing                       | Broad community effort                                               |


---

## 4. Cross-Cutting Themes & Tensions

**1. Decoherence as the universal enemy**
Tunneling requires quantum coherence; the environment destroys it. This is the central tension in every domain: qubits need long coherence times but are embedded in macroscopic devices; biological tunneling occurs in warm, wet, noisy cells; TFET operation is classical by the time a signal reaches the circuit. The Caldeira-Leggett framework unifies these challenges — all four frontiers are fundamentally fighting the same battle against environmental dephasing.

**2. Tunneling as resource vs. nuisance**
The same physical effect is engineered *into* devices (Josephson junctions → qubits; band-to-band tunneling → TFETs; elastic tunneling → STM current) and simultaneously constitutes the primary *failure mode* (gate-oxide leakage in CMOS; qubit leakage in transmons). Progress in each domain requires finely tuned control over the same tunneling parameters.

**3. The scalability gap**
Every domain faces a version of the same scaling problem:

- **QC**: ~1,000 physical qubits per logical qubit; millions needed for practical fault-tolerant computation
- **TFETs**: drive current gap vs. CMOS not yet closed; no manufacturable process at scale
- **STM**: 10–100 atoms/hour manipulation throughput — not a viable manufacturing path
- **Biological**: QM/MM simulations max out at ~200 quantum atoms; full-protein quantum treatment remains intractable

**4. Theory lags experiment in the time domain**
Attosecond experiments on tunneling ionization are now technically feasible (Sainadh 2019, Ramos 2020), but theory cannot yet provide an unambiguous, operationally defined tunneling time that all approaches agree on. Measurement is ahead of interpretation.

**5. Mathematical convergence across domains**
Instanton methods (QFT), WKB (single-particle), RPMD (chemistry), and Floquet theory (driven systems) are converging on a common language for tunneling across energy and length scales. The 2025 papers by Nishimura & Watanabe and Takayoshi & Oka exemplify this trend toward unified treatment.

---

## 5. Reading Path: From Zero to SoTA

### Tier 1 — Foundations (Undergraduate)


| Resource                                                                       | What to Read / Watch                                                | Why                                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Griffiths, *Introduction to Quantum Mechanics*, 3rd ed. (Cambridge UP, 2018)   | Ch. 2 (finite/infinite well), Ch. 8 (WKB), Ch. 11 (scattering)      | The canonical entry point; WKB is essential for all tunneling calculations |
| Feynman, *Lectures on Physics* Vol. III (free: feynmanlectures.caltech.edu)    | Selected chapters on probability amplitudes and two-state systems   | Unmatched physical intuition; freely available in full                     |
| MIT OCW 8.04 Quantum Physics I — Zwiebach (2016) or Adams (2013)               | Full course including barrier penetration lectures and problem sets | Rigorous undergraduate treatment; ocw.mit.edu                              |
| Zettili, *Quantum Mechanics: Concepts and Applications*, 2nd ed. (Wiley, 2009) | Tunneling chapters; work all solved problems                        | Best worked-example coverage; ideal for self-study                         |
| PBS Space Time (YouTube: @pbsspacetime)                                        | Quantum tunneling and wave function episodes                        | 15-min conceptual primers; builds intuition before formalism               |


### Tier 2 — Core Theory (Graduate)


| Resource                                                                       | Focus                                                     | Why                                                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Sakurai & Napolitano, *Modern Quantum Mechanics*, 3rd ed. (Cambridge UP, 2020) | Scattering theory, approximation methods                  | Standard graduate reference; tighter formalism than Griffiths                                       |
| Landau & Lifshitz, *Quantum Mechanics* (Vol. 3), Ch. 25                        | JWKB / rigorous semiclassical approximation               | The definitive classical reference; every theorist cites this                                       |
| Razavy, *Quantum Theory of Tunneling* (World Scientific, 2003; 2nd ed. 2014)   | Comprehensive tunneling monograph                         | The only book-length treatment across all domains; covers dissipation, many-body, time problems     |
| Caldeira & Leggett, *Annals of Physics* 149, 374 (1983)                        | Quantum Brownian motion; tunneling in dissipative systems | **Foundational paper** for open-system tunneling; required reading for qubits or biological systems |


### Tier 3 — Domain Reviews


| Domain                   | Paper                                                                      | Notes                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Quantum Computing**    | Blais, Grimsmo, Girvin & Wallraff, *Rev. Mod. Phys.* **93**, 025005 (2021) | Definitive circuit QED review; covers Josephson physics, transmon design, qubit control. DOI: 10.1103/RevModPhys.93.025005 |
| **Biological Tunneling** | Klinman & Kohen, *Annu. Rev. Biochem.* **82**, 471–496 (2013)              | Best entry to enzymatic tunneling; covers KIE methodology and debate                                                       |
| **Nanoscale / TFET**     | Tsang, Pu & Chen, arXiv:2409.18965 (2024)                                  | Current TFET simulation methods; 2D material heterostructures; ML-assisted design                                          |
| **Atomic-Scale Devices** | Schofield et al., *Nano Futures* **9**, 012001 (2025); arXiv:2501.04535    | 94-page community roadmap on atomic-precision tunneling devices                                                            |


### Tier 4 — Cutting-Edge Papers (2023–2026)


| Paper                                                                       | Venue                                                     | Why It Matters                                                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Takayoshi & Oka, "Geometric Effects on Tunneling in Driven Quantum Systems" | *JPSJ* **94**, 111003 (2025); arXiv:2509.03674            | Berry/geometric phase modifies tunneling in Floquet systems — new control knob                         |
| Su et al., "Unraveling Switching Dynamics in Quantum Double-Well"           | *Phys. Rev. A* **112**, 042202 (2025); arXiv:2501.00209   | Challenges monotonic decrease of tunneling rate with barrier height; implications for qubit design     |
| Nishimura & Watanabe, "Quantum Decoherence from Complex Saddle Points"      | *PRL* (2025); arXiv:2408.16627                            | Instanton approach to decoherence — unifies tunneling dynamics and open-system physics                 |
| Choi et al., "ESR with Scanning Tunneling Microscopy"                       | *Nanoscale Advances* **7**, 4551 (2025); arXiv:2505.10079 | STM tunneling current drives single-atom spin resonance — SoTA in atomic-scale sensing                 |
| Zhang & Gu, "Perfect Transmission of a Dirac Particle: Klein Tunneling"     | *Phys. Rev. A* **113**, 032208 (2026); arXiv:2602.23650   | Relativistic tunneling without exponential suppression; graphene / topological materials               |
| Schofield et al., "Roadmap on Atomic-Scale Semiconductor Devices"           | *Nano Futures* **9**, 012001 (2025); arXiv:2501.04535     | Community consensus on where atomic tunneling devices are heading                                      |
| Eslamzadeh & Soroushfar, "Hawking Radiation as Tunneling: A Brief Review"   | *JHAP* **5**(2), 44–56 (2025); arXiv:2512.06361           | Parikh-Wilczek tunneling formalism for black hole horizons — shows universality of tunneling framework |


### Interactive Reading Graph

Hover any node for a paper summary, HPC/QPU access notes, and a direct link. Edges show recommended reading order; dashed edges are skip-tier shortcuts.

<div style="width:100%;overflow:hidden;border:1px solid #30363d;border-radius:6px;margin:1rem 0">
  <iframe
    src="/blog/graphs/quantum-tunneling-reading-graph.html"
    style="width:100%;aspect-ratio:1180/860;border:none;display:block"
    title="Quantum Tunneling Reading Graph — Tiers 2–4"
    loading="lazy"
  ></iframe>
</div>

[Open full-page graph ↗](/blog/graphs/quantum-tunneling-reading-graph.html)

---

### Free Online Resources


| Resource                     | URL                                                    | Best For                                     |
| ---------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| Feynman Lectures Vol. III    | feynmanlectures.caltech.edu                            | Conceptual foundations, free and official    |
| MIT OCW 8.04 (Zwiebach 2016) | ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016 | Full structured course, free                 |
| MIT OCW 8.04 (Adams 2013)    | ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2013 | Same content, different pedagogical style    |
| arXiv quant-ph               | arxiv.org/list/quant-ph/new                            | Daily preprints across all tunneling domains |
| arXiv cond-mat.mes-hall      | arxiv.org/list/cond-mat.mes-hall/new                   | Nanoscale/STM/TFET preprints                 |
| arXiv physics.bio-ph         | arxiv.org/list/physics.bio-ph/new                      | Quantum biology                              |
| IBM Quantum Learning         | learning.quantum.ibm.com                               | Hands-on circuit QED and qubit context       |
| PBS Space Time               | youtube.com/@pbsspacetime                              | Intuition-building video primers (free)      |


### Suggested Study Order


| Phase                       | Duration   | Content                                                                   |
| --------------------------- | ---------- | ------------------------------------------------------------------------- |
| **Phase 1 — Conceptual**    | 2–4 weeks  | Feynman Lectures Vol. III (Ch. 1–2, 9–11) + PBS Space Time                |
| **Phase 2 — Formalism**     | 6–10 weeks | Griffiths Ch. 1–2, 8, 11 + MIT OCW 8.04 problem sets                      |
| **Phase 3 — Graduate Core** | 8–12 weeks | Sakurai (approximation methods) + Landau & Lifshitz Ch. 25                |
| **Phase 4 — Domain**        | 4–8 weeks  | Razavy (selective chapters) + Caldeira & Leggett 1983 + one Tier 3 review |
| **Phase 5 — Frontier**      | Ongoing    | Tier 4 papers + arXiv alerts                                              |


> **Note**: Read Caldeira & Leggett (1983) at the start of Phase 4 regardless of domain — it is the shared theoretical vocabulary of all four frontiers.

---

## 6. Confidence Assessment


| Claim / Area                                            | Confidence                                   | Basis                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| WKB tunneling rates in single-barrier systems           | ✅ Well-established                           | Textbook theory; experimentally verified since 1928                                                     |
| Josephson junction tunneling as qubit mechanism         | ✅ Well-established                           | Decades of SQUIDs and transmons; MQT experimentally confirmed                                           |
| 1.5 ms coherence in superconducting qubits              | ✅ Reported (single group, 2024)              | Reproducibility across fabs not yet established                                                         |
| TFET achieving 60 mV/dec subthreshold swing             | ✅ Well-established                           | Multiple independent demonstrations; theory-consistent                                                  |
| Hydrogen tunneling in DHFR, P450, alcohol dehydrogenase | ✅ Well-established                           | KIE > 2 replicated across labs; multiple theoretical treatments agree                                   |
| Quantum coherence in photosynthetic complexes           | ⚠️ Established; scope contested              | 2D spectroscopy robust; functional role and vibrational vs. electronic origin debated                   |
| TFET drive current gap vs. CMOS                         | ✅ Known limitation                           | Consistent across all TFET demonstrations; no manufacturable solution yet                               |
| Tunneling time as well-defined observable               | ❌ Unresolved                                 | No theoretical consensus; attosecond experiments set bounds but do not discriminate between definitions |
| Significance of tunneling to total enzyme rate (5–50%)  | ⚠️ Actively debated                          | Wide range of estimates from different groups and methods                                               |
| Olfactory tunneling hypothesis                          | ❌ Speculative                                | No reproducible experimental confirmation; mechanism disputed                                           |
| Tunneling as driver of DNA point mutations              | ❌ Highly speculative                         | Computational suggestions only; no direct experimental evidence                                         |
| Hawking radiation as tunneling (formalism)              | ⚠️ Established formalism; unobserved physics | Parikh-Wilczek derivation consistent; Hawking radiation itself is undetected                            |
| Topological / Majorana qubit protection                 | ⚠️ Active research                           | Theoretical framework strong; non-Abelian anyons experimentally preliminary                             |
| Geometric effects on tunneling in Floquet systems       | ⚠️ Emerging                                  | 2025 theoretical results (Takayoshi & Oka); experimental confirmation pending                           |


