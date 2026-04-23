# AutoFillGraph v3 — System Design & Architecture

> **A Lifelong-Learning Knowledge-Graph Agent for Adaptive Form Autofill**
> Target: ICML 2026 SCALE Workshop — Late-Breaking Track (3 pages + refs/appendix)

---

## 1. Vision & Motivation

**The Problem.** Users fill hundreds of forms over a lifetime — job applications, visa paperwork, medical intake, academic admissions, financial onboarding. Each form asks the same questions in wildly different phrasings ("Email", "Primary Electronic Mail", "How should we reach you digitally?"). Today's autofill systems are flat key-value stores with rigid HTML-attribute matching. They fail on synonym-heavy or adversarial labels, cannot compose answers, cannot generate free-text fields, and forget nothing (but also learn nothing).

**The Insight.** A *personal knowledge graph* with typed, temporal, multi-layered attributes — combined with embedding-based field mapping, a lightweight LLM for generation, and a human-in-the-loop feedback loop — can achieve dramatically higher fill accuracy across label difficulty tiers while remaining deployable on CPU in a browser extension.

**AutoFillGraph** is a lifelong-learning agent that:

1. **Builds** a structured semantic memory (knowledge graph) from every form a user fills.
2. **Routes** each field through an adaptive compute allocator (LinUCB bandit): deterministic lookup → embedding retrieval → LLM generation.
3. **Learns** from explicit user feedback (accept / reject / correct), retracting wrong inferences, consolidating corrections, and calibrating confidence over time.
4. **Scales** — compression ratio grows with graph size, keeping LLM context windows small even as the user's profile expands.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FORM INPUT LAYER                            │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │  Structured   │   │  Form Image  │   │   Browser DOM / API    │  │
│  │  Field List   │   │  (OCR path)  │   │   (future extension)   │  │
│  └──────┬───────┘   └──────┬───────┘   └───────────┬────────────┘  │
│         └──────────────────┴───────────────────────┘                │
│                              │                                      │
│                    ┌─────────▼──────────┐                           │
│                    │   FIELD MAPPER     │                           │
│                    │ Keyword → Substr → │                           │
│                    │ MiniLM Embedding   │                           │
│                    │   (3-phase)        │                           │
│                    └─────────┬──────────┘                           │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      ADAPTIVE ROUTER (LinUCB)                       │
│  Context vector = label_embedding(24) ⊕ domain_onehot(6)           │
│  Active arms: [local, llm_small] | llm_large reserved              │
│  Policy: ε-greedy (decaying) + forced LLM when local=∅             │
│  Reward signal: user feedback (accept=1, reject=0, correct=0.2)    │
├──────────┬─────────────────────┬────────────────────┬───────────────┤
│  ARM 0   │       ARM 0+       │       ARM 1        │   ARM 2       │
│  Direct  │   Compositional    │   Embed-Retrieve   │  LLM Large    │
│  Lookup  │   + Inference      │   + LLM Generate   │  (future)     │
│          │                     │                    │               │
│ KG prop  │ "full_address" =   │ MiniLM top-k facts │ Reserved for  │
│ match    │ city+region+zip    │ → Mistral prompt   │ hard fields   │
│ (0 API)  │ (0 API)            │ (1 API call/batch) │               │
└──────────┴─────────────────────┴────────────────────┴───────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      THREE-TIER MEMORY SYSTEM                       │
│                                                                     │
│  ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────────┐ │
│  │ WORKING MEMORY   │ │ EPISODIC MEMORY  │ │ SEMANTIC MEMORY     │ │
│  │                  │ │                  │ │                      │ │
│  │ • Session scope  │ │ • All past fill  │ │ • Typed temporal KG  │ │
│  │ • Active fields  │ │   episodes       │ │ • NetworkX DiGraph   │ │
│  │ • Partial fills  │ │ • Per-field       │ │ • Layered attributes │ │
│  │ • Bandit contexts│ │   accept/reject  │ │ • Typed document refs │ │
│  │ • User correct-  │ │   history        │ │ • Inference registry │ │
│  │   ions this run  │ │ • Calibrated     │ │ • Retraction set     │ │
│  │                  │ │   confidence     │ │                      │ │
│  │ Resets per form  │ │ Grows forever    │ │ Grows + consolidates │ │
│  └─────────────────┘ └──────────────────┘ └──────────────────────┘ │
│                                                                     │
│  CONSOLIDATION: episodic → semantic (boost/decay/retract/correct)   │
│  FORGETTING: attributes with confidence < 0.2 are expired           │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                    HITL FEEDBACK LOOP                                │
│                                                                     │
│  User reviews filled form → per-field: accept | reject | correct    │
│    ├─ accept  → bandit reward=1.0, confidence boost (+0.05)         │
│    ├─ reject  → bandit reward=0.0, confidence decay (-0.15),        │
│    │            retract source inference                             │
│    └─ correct → bandit reward=0.2, store new value (conf=1.0),      │
│                 retract old inference, re-run inference engine       │
│                                                                     │
│  After feedback: consolidate → re-infer → re-index retrieval        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Descriptions

### 3.1 Field Mapper — Three-Phase Label Resolution

The central challenge: mapping arbitrary form labels to canonical properties. Browser autofill fails here because it relies on HTML `autocomplete` attributes. Real forms use synonyms, periphrasis, and adversarial phrasings.

**Phase 1 — Keyword Exact Match.** A hand-curated synonym index maps 200+ surface forms to 43 canonical properties. Covers Tier 1 (standard) labels reliably.

**Phase 2 — Substring Match.** Bidirectional containment check. Catches partial matches like "Electronic Mail" → "email".

**Phase 3 — Embedding Cosine Similarity.** Each canonical property has a pre-computed MiniLM-L6-v2 embedding of its natural-language description. At query time, the label is encoded and matched by cosine similarity with threshold 0.32. This is the key mechanism for Tier 2 (synonym-heavy) and Tier 3 (adversarial/ambiguous) labels.

| Tier | Example Label | Resolution Path |
|------|--------------|----------------|
| 1 | "Email" | Phase 1: exact match |
| 2 | "Primary Electronic Mail" | Phase 2: substring "mail" |
| 3 | "How should we reach you digitally?" | Phase 3: MiniLM cosine sim → `email` (0.62) |

**Design choice — CPU-friendly.** MiniLM-L6-v2 is 22M parameters, runs in <10ms per encoding on CPU. Property description embeddings are pre-computed once at init (43 vectors). Field label embeddings are cached.

---

### 3.2 Semantic Memory — Typed Temporal Knowledge Graph

The core data structure. A directed graph (NetworkX `DiGraph`) where:

- **Nodes** are typed entities: `Person`, `Organization`, `Location`, `Credential`, `Role`, `Interest`, `Document`.
- **Edges** are typed relations: `AFFILIATED_WITH`, `INTERESTED_IN`, `STUDIED_AT`, etc.
- **Attributes** are per-entity, per-property lists of `AttributeValue` objects with temporal validity (`valid_from`, `valid_until`), confidence scores, source provenance, and sensitivity labels.

**Layered Sensitivity Model.** Eight attribute layers with three sensitivity tiers:

| Layer | Sensitivity | Example Properties |
|-------|------------|-------------------|
| identity | PUBLIC | full_name, display_name |
| contact | PUBLIC | email, phone, address |
| academic | PUBLIC | university, gpa, advisor |
| professional | PUBLIC | employer, job_title, skills |
| medical | RESTRICTED | allergies, blood_type, insurance_id |
| financial | RESTRICTED | ssn, tax_id, annual_income |
| legal | ENCRYPTED | passport_number, visa_status |
| document | RESTRICTED | profile_photo, signature, resume_scan |

The retrieval module respects sensitivity gates — at `PUBLIC` level, SSN and passport data are excluded from LLM context entirely. This is a hard privacy constraint, not a soft preference.

**Temporal Versioning.** When an attribute changes (e.g., address update), the old value is expired (`valid_until` set) and a new record is appended. The `get_current()` method returns only active values. Full history is preserved for auditing and for temporal reasoning ("what was my address when I applied to X?").

---

### 3.3 Inference Engine — Guarded Rule-Based Derivation

Seven deterministic rules that fire after each form ingestion:

| Rule | Input → Output | Confidence | Guard |
|------|---------------|------------|-------|
| `phone_country_code` | +1-xxx → country="United States" | 0.90 | Only if `country` not already set |
| `address_parse_state` | "College Park, MD 20740" → state="MD" | 0.90 | Only if `state` not set |
| `address_parse_city` | Same → city="College Park" | 0.90 | Only if `city` not set |
| `address_parse_zip` | Same → zip_code="20740" | 0.90 | Only if `zip_code` not set |
| `degree_to_department` | "MS in Machine Learning" → dept="Machine Learning" | 0.85 | Only if `department` not set |
| `email_as_work_email` | Copies email to work_email | 0.60 | Only if `work_email` not set |
| `university_as_employer` | If student (has degree/gpa), employer=university | 0.70 | Only if `employer` not set AND student indicators present |

**Deliberately omitted:** `citizenship` from phone country code. This was an active design decision — someone with a US phone number may not be a US citizen. Citizenship should only come from explicit user input or a user correction.

**Retraction mechanism.** When user feedback rejects or corrects an inferred value, the `(field, rule)` pair is added to a retraction set. The inference engine checks this set before firing, preventing re-derivation of discredited inferences.

---

### 3.4 Embedding Retriever — Adaptive Context Compression

Instead of sending the entire knowledge graph to the LLM, we embed all KG triples as sentences using MiniLM-L6-v2 and retrieve only the top-k most relevant facts for the current field batch.

**Triple construction.** Each current attribute becomes a sentence: `"User full_name is Govind"`. Each relation becomes: `"User AFFILIATED_WITH University of Maryland"`.

**Adaptive top-k.** The number of retrieved triples scales with the number of unfilled fields: `k = min(15, max(5, num_fields × 2))`. A minimum similarity threshold of 0.15 filters irrelevant noise.

**Compression ratio.** As the graph grows (more facts about the user), the fraction of facts sent to the LLM *decreases*. In the current `Prototype5` notebook, the indexed graph is about 20 triples and the benchmark's retriever diagnostic averages ~51% compression. Under the same capped top-k policy, compression would exceed 80% once the graph is well past ~50 triples. That >80% regime should be described as a scaling projection, not as a measured large-graph result from the current notebook.

**CPU cost.** Encoding the query (concatenated field labels) takes ~5ms. Dot-product retrieval over the triple embeddings is sub-millisecond even for hundreds of triples.

---

### 3.5 LinUCB Bandit — Adaptive Compute Routing

A contextual bandit that learns, per-field, whether to use local lookup (free) or LLM generation (costly).

**Context vector (30 dims in `Prototype5`).** The notebook uses a compressed 24-dim prefix of the MiniLM label embedding plus a 6-dim one-hot domain encoding (job, academic, visa, medical, financial, general). This keeps the contextual bandit sample-efficient for the current small-data setting.

**Arms in the current notebook:**
- `local` (arm 0): Deterministic lookup + compositional + inference. Zero API cost.
- `llm_small` (arm 1): Mistral Small (~8B). Used for fields with no local evidence and long-form generation.
- `llm_large` (arm 2): Reserved in the API but not actively selected in `Prototype5`; do not claim results for this arm yet.

**Exploration policy.** ε-greedy with decay (ε₀=0.35, decay=0.97, min=0.05) layered on top of LinUCB upper confidence bounds. This ensures early exploration while converging to exploitation.

**Forced override.** When local lookup has no data for a field, the bandit is bypassed and arm 1 (LLM) is selected. This prevents the bandit from "learning" that local is good for fields it simply cannot fill.

**Reward signal.** Directly from HITL feedback: accept → 1.0, reject → 0.0, correct → 0.2.

---

### 3.6 Domain-Aware Unknown Handling

A critical safety feature. For domain-specific fields (medical, financial, legal), the system checks whether the semantic memory contains *any* data for that domain. If the user has never provided medical information, the system will not send "Allergies" or "Blood Type" to the LLM — it will immediately return `UNKNOWN` with confidence 0.0.

This prevents the LLM from fabricating sensitive information. The domains and their guarded properties:

- **medical:** allergies, blood_type, insurance_id, conditions, medications, primary_care
- **financial:** ssn, tax_id, bank_name, annual_income, credit_score
- **legal:** passport_number, visa_status, drivers_license

---

### 3.7 Multimodal — Document Category Routing

Forms often require document uploads: profile photos, passport scans, transcripts, signatures, resumes. In `Prototype5`, these are stored as typed document attributes in the KG as local document paths.

**Current implemented behavior.** The notebook uses strict semantic category matching:
1. **Category gate:** Check if the field label matches one of six predefined image/document categories (profile_photo, signature, transcript_scan, id_scan, passport_scan, resume_scan) using keyword matching.
2. **Typed retrieval:** Return the stored document for that category directly.

This prevents cross-category errors (e.g., matching "Upload Photo" to a stored signature). CLIP is import-checked in the notebook but is not the core retrieval mechanism for the reported results, so the paper should describe this module as typed document routing rather than CLIP ranking.

---

### 3.8 Form Perception — Tesseract OCR with Layout Heuristics

For image-based form inputs (screenshots, scanned PDFs), the current notebook extracts field labels using:
1. **Tesseract OCR text extraction**
2. **Layout-aware line grouping from Tesseract metadata**
3. **Heuristic field-label recovery** with fuzzy matching and OCR-noise normalization

`Prototype5` also checks whether LayoutLMv3 is importable, but the demonstrated pipeline and reported outputs come from Tesseract plus layout heuristics, not a full LayoutLMv3 inference pass.

**Note on deployment.** For the browser extension target, this module is replaced by DOM inspection — the browser provides field labels, `name`/`id` attributes, and `placeholder` text directly. The OCR path is retained for PDF forms and mobile screenshot scenarios.

---

### 3.9 Episodic Memory + Confidence Calibration

Every form-fill session produces a `FillEpisode` recording:
- All field results (value, status, confidence, route, evidence)
- User feedback per field
- Computed accuracy

**Per-field historical tracking.** For each canonical property, episodic memory maintains a rolling list of accept/reject decisions. This feeds into confidence calibration:

```
calibrated_conf = 0.6 × stored_confidence + 0.4 × historical_accuracy
```

If a field has been rejected 3 out of 5 times historically, its confidence is deflated regardless of what the current source says. This creates a self-correcting system: systematically wrong fields get lower confidence → flagged for user review → corrected → improved.

---

### 3.10 Memory Consolidation

Transfers patterns from episodic → semantic memory:

- **Accept:** Boost confidence of matching attribute (+0.05). Mark as verified at ≥0.95.
- **Reject:** Decay confidence (-0.15). Retract source inference.
- **Correct:** Store correction with confidence 1.0. Retract all inferences that produced the wrong value. Re-run inference engine to propagate the correction.
- **Forgetting:** Attributes with confidence < 0.2 are expired (soft delete with temporal tombstone).

---

### 3.11 Compositional Resolver

Some fields are composites of atomic properties:

| Composite Field | Components |
|----------------|-----------|
| full_address | address, city, region, zip_code |
| location | city, region, country |
| academic_info | university, department, degree |
| contact_info | email, phone |
| professional_profile | employer, job_title, years_experience |
| residential_address | address, city, state, zip_code, country |

When a field label matches a composite pattern and ≥2 components are available, the resolver joins them with commas. This fills fields like "Residential Address (Street, City, State, ZIP)" from atomic parts without any LLM call.

---

## 4. Autofill Pipeline — Full Flow

```
Input: field_labels[], form_domain

Phase 1: IMAGE FIELDS
  for each label containing image keywords:
    → typed document-category match against stored document refs
    → if match: IMAGE_FILLED, else: UNKNOWN

Phase 2: LOCAL RESOLUTION (zero API cost)
  for each remaining label:
    a) Field Mapper → canonical property → direct KG lookup
    b) Compositional Resolver → compose from atomic parts
    c) Inference Registry → check derived facts
    d) Domain-Aware Guard → skip if no domain data
    e) LinUCB Bandit → route to local (done) or queue for LLM

Phase 3: LLM BATCH FILL (one API call for all queued fields)
  → Pre-filter: remove domain-guarded fields
  → Embedding Retriever: fetch top-k relevant triples
  → Construct prompt with KG subgraph + inference context
  → Mistral API call (temperature=0, JSON mode)
  → Parse fills, classify status (FILLED/INFERRED/GENERATED/UNKNOWN)
  → Deflate LLM confidence (×0.85 cap at 0.9)

Phase 4: EPISODE LOGGING
  → Record all results to episodic memory
  → Return results + episode for HITL feedback

Phase 5: HITL FEEDBACK (async, after user review)
  → Update bandit rewards
  → Consolidate to semantic memory
  → Re-run inference engine
  → Re-index retrieval embeddings
```

---

## 5. FormBench v2 — Evaluation Suite

A custom benchmark of **15 synthetic forms across 7 domain scenarios** (job, academic, visa, medical, financial, document, general-composite) with **3 difficulty tiers**:

| Tier | Description | Label Style | Example |
|------|------------|------------|---------|
| 1 | Standard | Direct property names | "Email", "Phone Number" |
| 2 | Synonym-heavy | Paraphrased, formal | "Primary Electronic Mail", "Cumulative Academic Score" |
| 3 | Adversarial | Circumlocutory, ambiguous | "How should we reach you digitally?", "Quantitative measure of academic performance" |

**Scoring rules:**
- `FILLED` is correct if value matches ground truth from KG
- `UNKNOWN` is correct if no ground truth exists (correctly abstaining)
- `GENERATED` is correct if non-empty and substantial (>10 chars) for generative fields
- `IMAGE_FILLED` is correct if matched property equals expected canonical

**Baselines in `Prototype5`:**
1. **Browser Autofill** — Flat key-value store with rigid label matching (~30 known mappings)
2. **Pure Lookup** — Keyword-only field mapper, no embedding fallback, no LLM
3. **No Embedding** — Exact + substring matching only, with the rest of the local pipeline intact

**Important scope note.** In the current notebook, `FormBench v2` is run with `use_llm=False`. The benchmark therefore measures the local path only: mapping, composition, inference, domain guards, and document routing. LLM-backed generation is evaluated separately in the long-form QA / research-application blocks and should be written up as a separate experiment, not folded into the headline FormBench numbers.

---

## 6. Key Design Decisions & Trade-offs

### 6.1 Why a Knowledge Graph (not a Vector Store)?

A vector store would embed all user facts and retrieve by similarity. This works for *retrieval* but fails for:
- **Compositional fields:** "Full Address" requires *structured* assembly of city + state + zip.
- **Inference chains:** University → employer (for students) requires relational reasoning.
- **Temporal versioning:** Old address vs. current address requires explicit validity tracking.
- **Sensitivity gating:** Excluding financial data from public contexts requires attribute-level metadata.

The KG provides *structure*; the embedding retriever provides *relevance*. Together they give structured + relevant context to the LLM.

### 6.2 Why LinUCB (not a Learned Router)?

A learned router (e.g., trained classifier) requires labeled training data for "should this field use LLM or not?" This data doesn't exist at system init. LinUCB:
- Starts with no prior knowledge
- Explores via ε-greedy
- Learns from real user feedback (not proxy labels)
- Converges within ~20-30 field decisions
- Has theoretical regret bounds

### 6.3 Why Retraction (not Retraining)?

When the inference engine derives a wrong fact (e.g., `citizenship = United States` from phone code), simply decaying confidence is insufficient — the rule will re-fire on next inference pass. Retraction adds the `(field, rule)` pair to a permanent blocklist, preventing re-derivation. This is computationally free (set lookup) and semantically correct.

### 6.4 Why Confidence Deflation for LLM Outputs?

LLMs are systematically overconfident. A raw confidence of 0.95 from the LLM is deflated to `min(0.9, 0.95 × 0.85) = 0.81`. This ensures LLM-sourced values are always reviewed with more skepticism than locally verified facts, and prevents the system from over-trusting hallucinated fills.

---

## 7. Alignment with ICML SCALE 2026 Topics

| Workshop Topic | AutoFillGraph Contribution |
|---------------|--------------------------|
| **Memory of Agents** | Three-tier memory (working/episodic/semantic) with consolidation, forgetting, and temporal abstractions |
| **Memory consolidation & retrieval** | Episodic → semantic transfer via HITL feedback; MiniLM embedding retrieval with adaptive top-k |
| **Memory-grounded reasoning** | Inference engine derives new facts from KG structure; compositional resolver assembles complex fields |
| **Robustness to noisy inputs** | Three-phase field mapping handles synonym, periphrastic, and adversarial labels |
| **Efficient agentic systems** | LinUCB bandit minimizes API calls; embedding retrieval compresses context; domain-aware skip avoids unnecessary LLM invocations |
| **Adaptive execution** | Bandit learns per-field routing policy from user feedback; epsilon decays over time |
| **Evaluation & benchmarking** | FormBench v2: 15 synthetic cases across 7 domain scenarios, plus a held-out semantic challenge and separate LLM demos |

---

## 8. Lightweight Deployment Plan (Browser Extension)

### 8.1 Architecture Adaptation

```
┌──────────────────────────────────────────────────────────────┐
│                    BROWSER EXTENSION                          │
│                                                               │
│  Content Script                    Background Worker          │
│  ┌─────────────────┐              ┌──────────────────────┐   │
│  │ DOM Inspector   │──fields───▶  │ AutoFillGraph Core   │   │
│  │ (replaces OCR)  │              │                      │   │
│  │                 │◀──fills────  │ • Field Mapper        │   │
│  │ Form Filler     │              │ • Semantic Memory     │   │
│  │ (injects values)│              │ • Inference Engine    │   │
│  └─────────────────┘              │ • Compositional       │   │
│                                    │ • Episodic Memory    │   │
│  Popup UI                          │                      │   │
│  ┌─────────────────┐              │ Bandit Router ──────▶│   │
│  │ Review & Confirm│              │         │             │   │
│  │ (HITL feedback) │              │    if needed:         │   │
│  │ Accept/Reject/  │              │    Mistral API call   │   │
│  │ Correct per     │              └──────────────────────┘   │
│  │ field           │                                          │
│  └─────────────────┘              Storage: IndexedDB         │
│                                    (KG serialized as JSON)   │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 What Changes for Browser

| Component | Research Version | Browser Extension |
|-----------|-----------------|-------------------|
| Form perception | Tesseract OCR + layout heuristics | DOM inspection (`querySelectorAll('input, select, textarea')`) |
| KG storage | In-memory NetworkX | IndexedDB (persistent across sessions) |
| Embeddings | MiniLM-L6-v2 (22M params) | ONNX-quantized MiniLM (INT8, ~6MB) or pre-computed lookup table |
| LLM | Mistral API | Same (API call from background worker) |
| Document routing | Typed document-category matching | Native file picker / typed file references |
| HITL UI | Console print | Popup with per-field review cards |
| Privacy | In-memory | Local-only IndexedDB; API calls send only relevant subgraph (never raw sensitive data) |

### 8.3 Performance Budget

| Operation | Target Latency | Mechanism |
|-----------|---------------|-----------|
| DOM inspection | <50ms | Native browser API |
| Field mapping (Phase 1+2) | <1ms | Dictionary lookup |
| Field mapping (Phase 3) | <15ms | Pre-computed embeddings + cosine sim |
| Local fill (per field) | <1ms | KG property lookup |
| LLM fill (batch) | 500-2000ms | Mistral API (only for unfilled fields) |
| Total form fill | <2s for 10 fields | Dominated by LLM call if needed |

---

## 9. Lifelong Learning Loop

The system improves over every form the user fills:

```
                    ┌─────────────┐
                    │  New Form   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Autofill   │◀── Semantic Memory (current knowledge)
                    │  (attempt)  │◀── Episodic Memory (calibrated confidence)
                    └──────┬──────┘◀── Bandit (learned routing policy)
                           │
                    ┌──────▼──────┐
                    │ User Review │
                    │ (HITL)      │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼────┐ ┌────▼─────┐ ┌────▼─────┐
        │  Accept   │ │  Reject  │ │ Correct  │
        │           │ │          │ │          │
        │ Boost     │ │ Decay    │ │ Store    │
        │ confidence│ │ conf     │ │ new val  │
        │ Reward=1  │ │ Retract  │ │ Retract  │
        │           │ │ inference│ │ old inf  │
        │           │ │ Reward=0 │ │ Reward=0.2│
        └─────┬────┘ └────┬─────┘ └────┬─────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼──────┐
                    │ Consolidate │
                    │ Re-infer    │
                    │ Re-index    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Improved   │
                    │  Memory     │──── Ready for next form
                    └─────────────┘

    Convergence signals:
    • ε (exploration) decays: 0.35 → 0.05 over ~60 decisions
    • Per-field confidence calibrates to historical accuracy
    • Retracted inferences stay permanently blocked
    • Verified attributes (conf ≥ 0.95) skip review
```

---

## 10. Properties for Paper Claims

### 10.1 Claim: Compression scales with graph size
As the KG grows, the embedding retriever sends a *decreasing fraction* of total facts to the LLM. The current notebook demonstrates ~51% average retriever compression on a ~20-triple graph. The >80% regime at larger graph sizes follows analytically from the current capped top-k policy, but it should be labeled as a projection until backed by larger-graph runs.

### 10.2 Claim: Three-phase field mapping handles adversarial labels
Tier 1 (standard): Keyword exact match — near 100%.
Tier 2 (synonym): Substring + embedding — captures paraphrased labels that browser autofill misses entirely.
Tier 3 (adversarial): Embedding similarity — the only mechanism that can map "How should we reach you digitally?" → `email`.

### 10.3 Claim: HITL feedback creates monotonic improvement
Each correction adds a high-confidence fact. Each rejection retracts a wrong inference permanently. Each acceptance calibrates confidence upward. The system cannot "unlearn" a correction — it can only be superseded by a newer correction.

### 10.4 Claim: Domain-aware unknown handling prevents fabrication
The current notebook shows correct `UNKNOWN` behavior on the synthetic medical and financial guard cases when no domain data exists. This is strong evidence for abstention behavior in the local pipeline. A direct Pure-LLM fabrication comparison is not yet included in `Prototype5`, so that contrast should not be claimed unless the baseline is added.

---

## 11. Modules — File/Class Reference

| Module | Class/Function | Notebook Block | Purpose |
|--------|---------------|----------------|---------|
| Schema | `Sensitivity`, `FillStatus`, `Route`, `LAYERS`, `PROPERTIES` | `1.0` | Type system and property registry |
| Data classes | `AttributeValue`, `FillResult`, `FillEpisode` | `2.0` | Core records for memory and evaluation |
| Utilities | `_safe_parse_json()`, `_now()`, `_norm()` | `1.0` | JSON robustness, timestamps, normalization |
| Field Mapper | `FieldMapper` | `2.0` | Three-phase label resolution |
| Retrieval | `EmbeddingRetriever` | `2.0` | MiniLM triple embedding + retrieval diagnostics |
| Bandit | `LinUCBRouter` | `2.0` | Contextual routing with active `{local, llm_small}` evaluation |
| Temporal Memory | `TemporalKG` | `2.0` | Typed temporal KG core |
| Episodic Memory | `EpisodicMemory` | `2.0` | Episode log + field-level history |
| Consolidation | `MemoryConsolidator` | `2.0` | Accept/reject/correct transfer back into the KG |
| Composition | `CompositionalResolver` | `2.0` | Composite field assembly |
| Inference | `InferenceEngine` | `2.0` | Guarded rule-based derivation |
| LLM Client | `MistralClient` | `2.0` | JSON/text generation with usage stats |
| Pipeline | `AutoFillAgent.learn()`, `AutoFillAgent.autofill()`, `AutoFillAgent.feedback()` | `3.0` | Master orchestration |
| OCR / Documents | OCR helpers + document-path routing | `6.0` | Tesseract parsing and typed document autofill |
| Evaluation | `FormBench v2`, baselines, held-out challenge | `7.0`-`8.5` | Local-path benchmark + semantic stress tests |

---

## 12. Limitations & Future Work

**Current limitations:**
- Single-user system (no multi-user KG sharing)
- Inference engine is rule-based (7 rules); doesn't learn new rules from data
- FormBench is synthetic — needs real-world form diversity testing
- FormBench in `Prototype5` is local-path only (`use_llm=False`), so adaptive-routing / generation claims must rely on the separate LLM demos rather than the headline benchmark table
- Long-form "grounding" metrics are lexical proxy checks, not full factuality evaluation
- Multimodal document fills are typed category routing over stored document paths; CLIP ranking is not yet part of the reported results
- No differential privacy on LLM context (sensitive data is excluded but not formally DP)
- LayoutLMv3 is availability-checked, but the demonstrated OCR path is Tesseract plus layout heuristics
- The current bandit uses a compressed 30-dimensional context and reserves `llm_large` rather than evaluating it

**Future directions:**
- Add a true **Pure LLM** baseline and a mixed local-vs-LLM FormBench so the adaptive router is evaluated end-to-end on the same benchmark table
- **Meta-learned inference rules** from episodic memory patterns (if users consistently correct X→Y, learn the rule)
- **Federated KG** — share anonymized form templates across users without sharing personal data
- **On-device LLM** — replace Mistral API with quantized Phi-3 or Gemma-2B for fully offline operation
- **Active learning** — system asks user to provide specific missing data that would unlock the most fields
- **Cross-form transfer** — if user fills a job application, proactively suggest filling LinkedIn profile with same data

---

## 13. Quick-Start: Running the System

```python
# 1. Initialize (Block 1 — runs all model loading)
# 2. Learn from user data
sem = learn_from_form(sem, {"Full Name": "Alice", "Email": "alice@mit.edu", ...},
                      llm_small, context="Profile")

# 3. Autofill a new form
results, episode = autofill_form(sem, epi, wm, llm_small,
                                  ["Applicant Name", "Contact Email", ...],
                                  form_domain="academic")

# 4. Process feedback
process_feedback(episode,
                 {"Applicant Name": "accept", "Contact Email": "correct:alice@gmail.com"},
                 sem, epi, wm, consolidator)

# 5. Next form will be better — the system has learned from the correction
```

---

*AutoFillGraph v3 — Lifelong learning, adaptive routing, structured memory, human-in-the-loop.*
*Designed for ICML SCALE 2026 Workshop. Built for deployment as a browser extension.*
