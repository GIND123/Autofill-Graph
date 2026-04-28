# AutoFillGraph — Agentic Temporal Knowledge-Graph Autofill

> **Lifelong-Learning Memory Agent for Adaptive Form Autofill**
> Submission target: ICML 2026 SCALE Workshop — Late-Breaking Track (3 pages)

<img width="1330" height="861" alt="AutoFillGraph architecture" src="https://github.com/user-attachments/assets/cf57ce2a-ee6d-4a8b-a7b3-fc997ca5d576" />

---

## What Is AutoFillGraph?

AutoFillGraph is a lifelong-learning agent that fills web and PDF forms intelligently. It maintains a **typed temporal knowledge graph** of the user's personal data and learns from every form the user fills. Unlike browser autofill — a flat key-value store with rigid HTML-attribute matching — AutoFillGraph resolves synonymous, paraphrased, and adversarial field labels, composes multi-part answers from atomic facts, infers missing properties from existing data, and routes each field through the cheapest sufficient compute path.

| What it is | What it is not |
|-----------|---------------|
| A memory-grounded agentic system | A browser password manager |
| A knowledge graph + bandit router | A fine-tuned form-filling model |
| A lifelong learner from HITL feedback | A cloud-synced profile service |
| A privacy-preserving local agent | A web scraper or data broker |

---

## Key Results (Prototype5 / Prototype6)

| Metric | Value |
|--------|-------|
| FormBench v2 accuracy (55 cases) | **100.0%** |
| Correct abstentions (domain guard) | **100.0%** |
| Average retrieval compression | **51.3%** |
| Token F1 vs best lookup baseline | **1.000 vs 0.500** (2× lift) |
| Semantic similarity vs browser autofill | **1.000 vs 0.323** (>3× lift) |
| LLM generation fill rate | **100.0% (4/4 substantial fills)** |
| Canonical properties | **43** |
| Guarded inference rules | **7** |
| Bandit context dimensions | **30** (24 label + 6 domain) |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  INPUTS                                                          │
│  Web / PDF Form  ──┐                                             │
│  User Documents  ──┤──▶  A1: Perception & Field Mapping          │
│  User (HITL)     ──┘         │ (3-phase: keyword → substr → MiniLM)
└────────────────────────────────────────────────────────────────  │
                               │                                   │
               ┌───────────────▼───────────────┐                   │
               │   A2: Memory Retrieval         │                   │
               │   Temporal KG + Episodic Mem  │                   │
               └───────────────┬───────────────┘                   │
                               │                                   │
               ┌───────────────▼───────────────┐                   │
               │   A3: Adaptive Resolver        │                   │
               │   LinUCB Bandit               │                   │
               │   local | LLM-small | reserve  │                   │
               └───────────────┬───────────────┘                   │
                               │                                   │
               ┌───────────────▼───────────────┐                   │
               │   A4: Validation & Feedback    │◀── User review   │
               │   Accept / Reject / Correct    │                   │
               └───────────────┬───────────────┘                   │
                               │                                   │
                    ┌──────────▼──────────┐                        │
                    │  Filled Form Output │                        │
                    └─────────────────────┘                        │
```

### Three-Tier Memory

```
Working Memory        Episodic Memory           Semantic Memory
─────────────         ────────────────          ───────────────────
Session-scoped        All past episodes         Temporal KG (NetworkX)
Active field ctx      Per-field history         43 properties, 7 types
Bandit contexts       Calibrated confidence     Layered sensitivity
User corrections      Grows forever             Temporal versioning
Resets per form                                 Inference registry
                                                Retraction set
```

---

## How It Works

### Field Mapping (Three Phases)

Every form label goes through three resolution phases before being looked up in the KG:

1. **Keyword exact match** — 200+ surface-form synonyms → 43 canonical properties (<1ms)
2. **Substring match** — bidirectional containment for partial matches
3. **MiniLM-L6-v2 embedding cosine similarity** — threshold 0.32, handles adversarial phrasings

| Tier | Example Label | Resolved By | Result |
|------|--------------|-------------|--------|
| 1 | "Email" | Phase 1 | `email` |
| 2 | "Primary Electronic Mail" | Phase 2 | `email` |
| 3 | "How should we reach you digitally?" | Phase 3 (cosine ~0.62) | `email` |

### Adaptive Routing (LinUCB Bandit)

The bandit selects the cheapest arm that can fill each field:

| Arm | Name | Cost | Used For |
|-----|------|------|---------|
| 0 | `local` | $0 | Direct KG lookup, composition, inference |
| 1 | `llm_small` | API | Fields with no local evidence; Mistral-small-latest |
| 2 | `llm_large` | Reserved | Not active in v5 |

Context vector: 30-dim (24-dim MiniLM label prefix + 6-dim domain one-hot). Exploration: ε₀=0.35, decay=0.97, floor=0.05 — converges in ~60 decisions.

### Inference Engine (7 Guarded Rules)

Deterministic rules derive new facts from existing ones, with guards that prevent overwriting explicit user data:

| Rule | Derives | Confidence |
|------|---------|------------|
| Phone prefix (+1) → country | "United States" | 0.90 |
| Address string parsing | city, state, zip | 0.90 |
| Degree string ("MS in X") → department | "X" | 0.85 |
| Email → work_email (copy) | work_email | 0.60 |
| University + student indicators → employer | university name | 0.70 |

Rejected inferences are added to a permanent retraction set — they cannot re-fire.

### Memory Consolidation (HITL Loop)

```
User feedback   →   Semantic memory update   →   Bandit update
─────────────       ──────────────────────       ─────────────
accept          →   confidence +0.05             reward = 1.0
reject          →   confidence −0.15, retract    reward = 0.0
correct         →   new value conf=1.0, retract  reward = 0.2
```

After any feedback: re-run inference engine → re-index embedding retriever.

### Context Compression

The embedding retriever sends only the most relevant KG triples to the LLM:

- top-k = `min(15, max(5, num_fields × 2))`
- Minimum similarity threshold: 0.15
- **Current compression: 51.3%** on a ~20-triple graph
- Scales to >80% compression at 50+ triples — context window stays bounded as profile grows

---

## Benchmarks

### FormBench v2 (Internal, Prototype5)

15 synthetic forms × 7 domains × 3 difficulty tiers = 55 test cases.

**Domains:** job | academic | visa | medical | financial | document | general-composite

**Results (local path, `use_llm=False`):**

| Metric | AutoFillGraph v5 | No Embedding | Pure Lookup | Browser Autofill |
|--------|-----------------|-------------|-------------|-----------------|
| Exact accuracy | **100.0%** | — | — | — |
| Token F1 | **1.000** | 0.500 | 0.500 | 0.186 |
| Char similarity | **1.000** | 0.553 | 0.553 | 0.288 |
| Semantic similarity | **1.000** | 0.556 | 0.556 | 0.323 |
| Abstention accuracy | **100.0%** | — | — | — |

### StandardBenchmarkSuite Lite (External Data, Prototype6)

Real-world noisy form data evaluated using the same agent core:

| Dataset | Description | Embedder |
|---------|-------------|---------|
| FUNSD | Scanned form benchmark, full | all-MiniLM-L6-v2 |
| XFUND-DE | German multilingual subset (40/20 docs cap) | paraphrase-multilingual-MiniLM-L12-v2 |

Evaluated metrics: mapping_acc · fill_acc · abstain_acc

Data budget hard cap: **2 GB total** (CORD v2 excluded — 2.31 GB on HF).

---

## Soft Metrics (Prototype6)

Prototype6 adds three soft metric functions for richer diagnostic evaluation:

| Function | What It Measures |
|----------|----------------|
| `token_f1(pred, gold)` | Bag-of-words overlap — detects right-answer-wrong-format |
| `char_sim(pred, gold)` | Normalized edit distance — handles phone/zip normalization |
| `semantic_sim(pred, gold)` | MiniLM cosine — captures semantically equivalent fills |

Useful interpretation:
- `token_f1 > exact_acc` → correct answer, formatting mismatch
- `char_sim high` → short-code fields match after normalization
- `sem_sim high` → semantically correct fill even when lexically different

---

## Privacy and Safety

### Sensitivity Layers

| Layer | Tier | Properties | LLM Context |
|-------|------|-----------|------------|
| identity, contact, academic, professional | PUBLIC | email, phone, university… | Included |
| medical, financial, document | RESTRICTED | allergies, tax_id, resume… | Excluded |
| legal | ENCRYPTED | passport, visa_status… | Hard excluded |

### Domain-Aware Abstention

For medical, financial, and legal fields: if the KG contains **no data** for that domain, the agent immediately returns `UNKNOWN` — the LLM is never called. This prevents fabrication of SSNs, passport numbers, or medical data.

### LLM Confidence Deflation

LLM outputs are systematically discounted:

```
stored_confidence = min(0.9, raw_confidence × 0.85)
```

LLM-sourced values are always reviewed with more skepticism than locally verified facts.

---

## Repository Structure

```
Autofill-Graph/
│
├── Baseline/
│   ├── Prototype5.ipynb              # v5: complete system implementation
│   ├── Prototype6.ipynb              # v6: + soft metric instrumentation
│   ├── StandardBenchmarkSuite_Lite.ipynb  # FUNSD + XFUND evaluation harness
│   └── documentation.md             # Full technical documentation
│
├── Playground/
│   └── AutoFillGraph_v3_System_Design.md  # Architecture design document
│
├── manifest.json                    # Chrome Manifest V3 configuration
├── background.js                    # Service worker (graph lifecycle)
├── content.js                       # Content script (DOM form detection)
├── lib/
│   ├── knowledgeGraphManager.js     # Core ML engine
│   └── sampleDataLoader.js          # Test data definitions
├── popup/
│   ├── popup.html                   # Extension UI
│   └── popup.js                     # UI logic + event handlers
│
└── README.md                        # This file
```

---

## Browser Extension Quick Start

### Prerequisites
- Chrome / Chromium v100+
- [Mistral API key](https://console.mistral.ai/api-keys/) (free tier: 100 req/month)

### Install (5 minutes)

```bash
git clone https://github.com/GIND123/Autofill-Graph.git
cd Autofill-Graph
cp config.example.js config.js
# Add your Mistral API key to config.js
```

Then in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `Autofill-Graph` folder
4. Click the extension icon → Settings → paste API key → Save

### Usage Flow

```
1. Visit a form page
2. Click "Detect Forms"          ← DOM inspection, <50ms
3. Click "Autofill"              ← local fill + LLM batch if needed, <2s
4. Review and correct fields     ← HITL feedback
5. Click "Learn This Form"       ← update KG, re-infer, re-index
```

### Performance Budget

| Operation | Target |
|-----------|--------|
| DOM field detection | <50ms |
| Keyword / substring mapping | <1ms |
| MiniLM Phase 3 mapping | <15ms |
| Local KG fill | <1ms/field |
| LLM batch fill (all queued fields) | 500–2000ms |
| Full 10-field form | <2s total |

---

## Research Notebook Usage

```python
# In Prototype5.ipynb

# 1. Learn from user data
agent.learn({"Full Name": "Alice", "Email": "alice@mit.edu", ...}, context="Profile")

# 2. Autofill a new form
episode = agent.autofill(
    ["Applicant Name", "Contact Email", "Cumulative Academic Score"],
    domain="academic",
    use_llm=False   # local path; set True to enable LLM generation
)

# 3. Review results
for field, result in episode.results.items():
    print(f"{field}: {result.value} ({result.status}, conf={result.confidence:.2f})")

# 4. Apply HITL feedback — updates KG, re-infers, re-indexes
agent.feedback(episode, {
    "Applicant Name": "accept",
    "Contact Email": "correct:alice@gmail.com",
    "Cumulative Academic Score": "reject"
})

# 5. Next form benefits from corrections automatically
```

---

## ICML SCALE 2026 Alignment

AutoFillGraph contributes to all five SCALE workshop research axes:

| Workshop Topic | This System's Contribution |
|---------------|--------------------------|
| **Memory of Agents** | Three-tier memory with consolidation, temporal versioning, and forgetting (conf < 0.2) |
| **Memory consolidation & retrieval** | HITL-driven episodic → semantic transfer; adaptive top-k MiniLM retrieval (51.3% compression) |
| **Efficient Agentic Systems** | LinUCB bandit minimizes API calls; domain guards skip unnecessary LLM calls |
| **Evaluation & Benchmarking** | FormBench v2 (55 cases, 3 tiers, 7 domains) + FUNSD/XFUND external validation |
| **Robustness to noisy inputs** | Three-phase field mapping handles synonym/periphrastic/adversarial labels; OCR noise normalization |

---

## Limitations

- **FormBench is synthetic** — needs real-world form diversity testing
- **FormBench is local-path only** — `use_llm=False`; adaptive routing claims need mixed-path evaluation
- **No Pure-LLM baseline** — required to justify adaptive router in the paper table
- **Single-user** — no federated KG sharing
- **7 fixed inference rules** — rule learning from episodic patterns is future work
- **llm_large arm unused** — reserved in bandit but not evaluated

---

## Roadmap

- [ ] Pure-LLM baseline + mixed-path FormBench
- [ ] CORD v2 streamed integration (within 2 GB budget)
- [ ] Meta-learned inference rules from episodic memory
- [ ] On-device LLM (quantized Phi-3 / Gemma-2B)
- [ ] MiniWoB++ browser-interaction success rate benchmark
- [ ] Firefox / Edge extension support
- [ ] Federated KG for cross-user template sharing

---

## Citation

If you use AutoFillGraph in your research:

```bibtex
@misc{autofillgraph2026,
  title   = {AutoFillGraph: A Lifelong-Learning Knowledge-Graph Agent for Adaptive Form Autofill},
  author  = {Govind},
  year    = {2026},
  note    = {ICML 2026 SCALE Workshop — Late-Breaking Track submission}
}
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

*AutoFillGraph — Lifelong learning, adaptive routing, structured memory, human-in-the-loop.*
*Designed for ICML SCALE 2026. Built for deployment as a browser extension.*

**Repository:** https://github.com/GIND123/Autofill-Graph
