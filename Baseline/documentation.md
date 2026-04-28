# AutoFillGraph — Technical Documentation

> **System:** AutoFillGraph v5 / v6 — Lifelong-Learning Knowledge-Graph Agent for Adaptive Form Autofill
> **Target venue:** ICML 2026 SCALE Workshop — Late-Breaking Track (3 pages + references/appendix)
> **Date:** April 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Core Modules](#3-core-modules)
   - 3.1 Schema and Type System
   - 3.2 Field Mapper — Three-Phase Label Resolution
   - 3.3 Temporal Knowledge Graph (Semantic Memory)
   - 3.4 Inference Engine
   - 3.5 Embedding Retriever
   - 3.6 LinUCB Bandit Router
   - 3.7 Compositional Resolver
   - 3.8 Episodic Memory + Confidence Calibration
   - 3.9 Memory Consolidator
   - 3.10 Domain-Aware Unknown Handling
   - 3.11 Multimodal Document Routing
   - 3.12 Form Perception (OCR)
   - 3.13 AutoFill Agent — Master Orchestrator
4. [Autofill Pipeline — End-to-End Flow](#4-autofill-pipeline--end-to-end-flow)
5. [Evaluation: FormBench v2](#5-evaluation-formbench-v2)
6. [Evaluation: StandardBenchmarkSuite Lite](#6-evaluation-standardbenchmarksuite-lite)
7. [Prototype5 / Prototype6 / Prototype7 — Version Differences](#7-prototype5--prototype6--prototype7--version-differences)
8. [Baseline Comparisons](#8-baseline-comparisons)
9. [Key Quantitative Results](#9-key-quantitative-results)
10. [Property and Rule Registry](#10-property-and-rule-registry)
11. [ICML SCALE 2026 Alignment](#11-icml-scale-2026-alignment)
12. [Limitations and Future Work](#12-limitations-and-future-work)
13. [File Reference](#13-file-reference)

---

## 1. Project Overview

### Motivation

Users fill hundreds of forms over a lifetime — job applications, visa paperwork, medical intake, academic admissions, financial onboarding. Every form asks the same questions with radically different phrasings:

- "Email" / "Primary Electronic Mail" / "How should we reach you digitally?"
- "Name" / "Applicant" / "Full Legal Name"

Today's browser autofill systems are flat key-value stores with rigid HTML `autocomplete` attribute matching. They fail on synonym-heavy or adversarial labels, cannot compose answers from atomic parts, cannot generate free-text fields, and forget nothing — but also learn nothing.

### Core Insight

A *personal knowledge graph* with typed, temporal, multi-layered attributes — combined with embedding-based field mapping, a contextual bandit for adaptive routing, a lightweight LLM for hard generation tasks, and a human-in-the-loop feedback loop — achieves dramatically higher fill accuracy across label difficulty tiers while remaining deployable on CPU in a browser extension.

### What AutoFillGraph Does

AutoFillGraph is a lifelong-learning agent that:

1. **Builds** a structured semantic memory (knowledge graph) from every form a user fills.
2. **Maps** arbitrary form labels to canonical properties using a three-phase resolver (keyword → substring → MiniLM embedding similarity).
3. **Routes** each field through an adaptive compute allocator (LinUCB bandit): deterministic lookup → embedding retrieval → LLM generation.
4. **Learns** from explicit user feedback (accept / reject / correct), retracting wrong inferences, consolidating corrections, and calibrating confidence over time.
5. **Scales** — compression ratio grows with graph size, keeping LLM context windows small even as the user's profile expands.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         FORM INPUT LAYER                            │
│  ┌─────────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │  Structured     │  │  Form Image   │  │  Browser DOM / API   │  │
│  │  Field List     │  │  (OCR path)   │  │  (extension target)  │  │
│  └────────┬────────┘  └───────┬───────┘  └──────────┬───────────┘  │
│           └───────────────────┴──────────────────────┘              │
│                                │                                    │
│                    ┌───────────▼──────────┐                         │
│                    │     FIELD MAPPER     │                         │
│                    │  Phase 1: Keyword    │                         │
│                    │  Phase 2: Substring  │                         │
│                    │  Phase 3: MiniLM     │                         │
│                    └───────────┬──────────┘                         │
└────────────────────────────────┼───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────┐
│                    ADAPTIVE ROUTER (LinUCB)                         │
│  Context: label_embedding(24-dim) ⊕ domain_onehot(6-dim) = 30-dim  │
│  Arms: local (arm 0) | llm_small (arm 1) | llm_large (reserved)    │
│  Policy: ε-greedy (ε₀=0.35, decay=0.97, min=0.05) + LinUCB UCB    │
│  Reward: accept=1.0 | reject=0.0 | correct=0.2                     │
├──────────────┬──────────────────────────┬───────────────────────────┤
│   ARM 0      │       ARM 0+ (comp)      │         ARM 1             │
│  Direct KG   │  Compositional +         │  MiniLM top-k retrieve    │
│  Lookup      │  Inference Derivation    │  → Mistral generation     │
│  (0 API)     │  (0 API)                 │  (1 batch API call)       │
└──────────────┴──────────────────────────┴───────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────┐
│                    THREE-TIER MEMORY SYSTEM                         │
│                                                                     │
│  ┌──────────────────┐ ┌─────────────────┐ ┌──────────────────────┐  │
│  │  WORKING MEMORY  │ │ EPISODIC MEMORY │ │  SEMANTIC MEMORY     │  │
│  │                  │ │                 │ │                      │  │
│  │  • Session scope │ │ • All fill eps  │ │  • Temporal KG       │  │
│  │  • Active fields │ │ • Per-field     │ │  • NetworkX DiGraph  │  │
│  │  • Bandit ctxs   │ │   accept/reject │ │  • 43 properties     │  │
│  │  • Corrections   │ │ • Calibrated    │ │  • 7 node types      │  │
│  │                  │ │   confidence    │ │  • Temporal validity │  │
│  │  Resets/form     │ │  Grows forever  │ │  Grows + consolidates│  │
│  └──────────────────┘ └─────────────────┘ └──────────────────────┘  │
│  CONSOLIDATION: episodic → semantic (boost/decay/retract/correct)   │
│  FORGETTING: attributes with confidence < 0.2 are expired           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────┐
│                       HITL FEEDBACK LOOP                            │
│  accept  → bandit reward=1.0, confidence +0.05                      │
│  reject  → bandit reward=0.0, confidence −0.15, retract inference   │
│  correct → bandit reward=0.2, store new value (conf=1.0), retract   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Modules

### 3.1 Schema and Type System

**File:** `Prototype5.ipynb` → `cell-init`

The schema defines the complete type system for properties, sensitivity levels, fill statuses, and routing decisions.

#### FillStatus (Enum)
| Value | Meaning |
|-------|---------|
| `FILLED` | Directly retrieved from KG with high confidence |
| `INFERRED` | Derived by the inference engine from existing facts |
| `GENERATED` | Produced by LLM from retrieved KG context |
| `UNKNOWN` | No evidence found; system abstains |
| `IMAGE_FILLED` | Document/file reference returned |

#### Route (Enum)
| Value | Meaning |
|-------|---------|
| `LOCAL` | Direct KG lookup |
| `COMPOSITIONAL` | Assembled from atomic parts |
| `INFERENCE` | Rule-derived |
| `EMBEDDING` | Retrieved via embedding similarity |
| `LLM` | Generated by Mistral API |
| `IMAGE` | Document-category match |

#### Sensitivity Tiers and Layers

| Layer | Sensitivity | Example Properties |
|-------|------------|-------------------|
| `identity` | PUBLIC | full_name, display_name |
| `contact` | PUBLIC | email, phone, address |
| `academic` | PUBLIC | university, gpa, advisor |
| `professional` | PUBLIC | employer, job_title, skills |
| `medical` | RESTRICTED | allergies, blood_type, insurance_id |
| `financial` | RESTRICTED | ssn, tax_id, annual_income |
| `legal` | ENCRYPTED | passport_number, visa_status |
| `document` | RESTRICTED | profile_photo, signature, resume_scan |

RESTRICTED and ENCRYPTED layers are excluded from LLM context when the domain sensitivity level is PUBLIC. This is a hard privacy gate, not a soft preference.

#### PROPERTIES Registry

The system maintains **43 canonical properties** organized across 8 sensitivity layers. Each property is defined with:
- A human-readable display name
- Layer assignment (determines sensitivity gate)
- Whether it participates in compositional resolution
- Whether it has inferrable variants

---

### 3.2 Field Mapper — Three-Phase Label Resolution

**Class:** `FieldMapper` | **File:** `Prototype5.ipynb` → `cell-components`

The central challenge: mapping arbitrary form labels to canonical properties. Browser autofill fails because it relies on HTML `autocomplete` attributes. Real-world forms use synonyms, periphrasis, and adversarial phrasings.

#### Phase 1 — Keyword Exact Match
A hand-curated synonym index maps 200+ surface forms to 43 canonical properties. Covers Tier 1 (standard) labels reliably with dictionary lookup speed (<1ms).

#### Phase 2 — Substring Match
Bidirectional containment check. Catches partial matches:
- "Electronic Mail" → `email`
- "Postal Code" → `zip_code`

#### Phase 3 — MiniLM Embedding Cosine Similarity
Each canonical property has a pre-computed MiniLM-L6-v2 embedding of its natural-language description. At query time:
1. Field label is encoded by MiniLM (~5ms on CPU)
2. Cosine similarity is computed against all 43 property embeddings (sub-ms)
3. Best match above threshold **0.32** is returned

Label embeddings are cached so repeated queries are free.

#### Tier Performance

| Tier | Example Label | Resolution Path | Outcome |
|------|--------------|----------------|---------|
| 1 | "Email" | Phase 1: exact keyword | `email` |
| 2 | "Primary Electronic Mail" | Phase 2: substring "mail" | `email` |
| 3 | "How should we reach you digitally?" | Phase 3: MiniLM cosine ~0.62 | `email` |

**CPU profile:** MiniLM-L6-v2 is 22M parameters, <10ms per encode on CPU. All 43 property embeddings are pre-computed once at init.

---

### 3.3 Temporal Knowledge Graph (Semantic Memory)

**Class:** `TemporalKG` | **File:** `Prototype5.ipynb` → `cell-components`

The core data structure. A directed graph (`networkx.DiGraph`) where:

- **Nodes** are typed entities: `Person`, `Organization`, `Location`, `Credential`, `Role`, `Interest`, `Document`
- **Edges** are typed relations: `AFFILIATED_WITH`, `INTERESTED_IN`, `STUDIED_AT`, `WORKS_AT`, `LIVES_AT`, etc.
- **Attributes** are per-entity, per-property lists of `AttributeValue` objects

#### AttributeValue Schema
```
AttributeValue:
  value:       Any          # the stored value
  confidence:  float        # 0.0–1.0; <0.2 triggers soft expiration
  valid_from:  datetime     # when this value became true
  valid_until: datetime|None  # None = currently active
  source:      str          # provenance tag
  sensitivity: Sensitivity  # PUBLIC / RESTRICTED / ENCRYPTED
  layer:       str          # which of the 8 layers
```

#### Temporal Versioning
When an attribute changes (e.g., address update), the old value receives `valid_until = now()` and a new record is appended. `get_current()` returns only active values (valid_until is None). Full history is preserved for:
- Temporal reasoning ("what was my address when I applied to X?")
- Auditing and provenance tracking
- Confidence calibration from long-term history

#### Forgetting Mechanism
Attributes with `confidence < 0.2` are expired via soft delete (temporal tombstone). They remain in history but are excluded from active retrieval.

---

### 3.4 Inference Engine

**Class:** `InferenceEngine` | **File:** `Prototype5.ipynb` → `cell-components`

Seven deterministic, guarded rules fire after each form ingestion. Each rule has a guard condition that prevents overwriting explicitly-set values.

| Rule | Input → Derived Output | Confidence | Guard |
|------|------------------------|------------|-------|
| `phone_country_code` | +1-xxx → country="United States" | 0.90 | Only if `country` not already set |
| `address_parse_state` | "College Park, MD 20740" → state="MD" | 0.90 | Only if `state` not set |
| `address_parse_city` | Same → city="College Park" | 0.90 | Only if `city` not set |
| `address_parse_zip` | Same → zip_code="20740" | 0.90 | Only if `zip_code` not set |
| `degree_to_department` | "MS in Machine Learning" → dept="Machine Learning" | 0.85 | Only if `department` not set |
| `email_as_work_email` | email → work_email (copy) | 0.60 | Only if `work_email` not set |
| `university_as_employer` | university → employer (student only) | 0.70 | Only if `employer` not set AND student indicators (degree/gpa) present |

**Deliberately omitted:** citizenship derivation from phone country code — someone with a US phone number may not be a US citizen. Citizenship is only accepted from explicit user input.

#### Retraction Mechanism
When user feedback rejects or corrects an inferred value, the `(field, rule)` pair is added to a permanent retraction set. The inference engine checks this set before firing, preventing re-derivation of discredited inferences. This is computationally free (set lookup) and semantically correct — unlike confidence decay alone, retraction prevents the same wrong inference from recurring.

---

### 3.5 Embedding Retriever

**Class:** `EmbeddingRetriever` | **File:** `Prototype5.ipynb` → `cell-components`

Instead of sending the entire knowledge graph to the LLM, the retriever embeds all KG triples as natural-language sentences and retrieves only the top-k most relevant facts for the current field batch.

#### Triple Construction
Each current attribute becomes a sentence:
- `"User full_name is Govind"`
- `"User AFFILIATED_WITH University of Maryland"`
- `"User university is University of Maryland (confidence: 0.95)"`

#### Adaptive top-k Policy
```
k = min(15, max(5, num_unfilled_fields × 2))
```
Minimum similarity threshold: **0.15** (filters irrelevant noise).

#### Compression Ratio
As the graph grows (more facts), the fraction sent to the LLM *decreases*:
- **Current (Prototype5):** ~20-triple graph → **51.3% average compression** (empirically measured)
- **Projection:** >80% compression at 50+ triple graphs under the same capped top-k policy

This is a deliberate scalability property: the LLM context window stays bounded even as the user's profile grows over years.

#### CPU Cost
- Query encoding (concatenated field labels): ~5ms
- Dot-product retrieval over all triple embeddings: sub-millisecond even at hundreds of triples

---

### 3.6 LinUCB Bandit Router

**Class:** `LinUCBRouter` (with `LinUCBArm`) | **File:** `Prototype5.ipynb` → `cell-components`

A contextual bandit that learns, per field type, whether to use local lookup (free) or LLM generation (costly).

#### Context Vector (30 dimensions)
- **Dims 0–23:** 24-dim prefix of the MiniLM label embedding (compressed representation of field semantics)
- **Dims 24–29:** 6-dim one-hot domain encoding — `{job, academic, visa, medical, financial, general}`

#### Active Arms

| Arm | Name | Cost | Behavior |
|-----|------|------|---------|
| 0 | `local` | $0 | Direct KG lookup + composition + inference |
| 1 | `llm_small` | API | Mistral Small (mistral-small-latest); batched generation |
| 2 | `llm_large` | Reserved | Not actively selected in Prototype5 |

#### Exploration Policy
ε-greedy with exponential decay layered on LinUCB upper confidence bounds:
- ε₀ = **0.35** (initial exploration rate)
- Decay factor = **0.97** per decision
- ε_min = **0.05** (permanent exploration floor)
- Converges to near-exploitation in ~60 field decisions

#### Forced Override
When local lookup has no data for a field, the bandit is bypassed and arm 1 (LLM) is selected. This prevents the bandit from "learning" that local is good for fields it simply cannot fill.

#### Reward Signal
Directly from HITL feedback:
- accept → **1.0**
- reject → **0.0**
- correct → **0.2**

---

### 3.7 Compositional Resolver

**Class:** `CompositionalResolver` | **File:** `Prototype5.ipynb` → `cell-components`

Some form fields are composites of atomic properties. When a field label matches a composite pattern and ≥2 components are available, the resolver assembles them without any LLM call.

| Composite Field | Components |
|----------------|-----------|
| `full_address` | address, city, region, zip_code |
| `location` | city, region, country |
| `academic_info` | university, department, degree |
| `contact_info` | email, phone |
| `professional_profile` | employer, job_title, years_experience |
| `residential_address` | address, city, state, zip_code, country |

Example: "Residential Address (Street, City, State, ZIP)" → assembled from atomic KG parts as comma-joined string, zero API calls.

---

### 3.8 Episodic Memory + Confidence Calibration

**Class:** `EpisodicMemory` | **File:** `Prototype5.ipynb` → `cell-components`

Every form-fill session produces a `FillEpisode` recording:
- All field results: value, status, confidence, route, evidence
- User feedback per field
- Session timestamp
- Computed accuracy

#### Per-Field Historical Calibration
For each canonical property, episodic memory maintains a rolling list of accept/reject decisions. This feeds into calibrated confidence:

```
calibrated_conf = 0.6 × stored_confidence + 0.4 × historical_accept_rate
```

If a field has been rejected 3/5 times historically, its confidence is deflated regardless of current source. This creates a self-correcting loop: systematically wrong fields get lower confidence → flagged for user review → corrected → improved.

---

### 3.9 Memory Consolidator

**Class:** `MemoryConsolidator` | **File:** `Prototype5.ipynb` → `cell-components`

Transfers learning from episodic episodes back into semantic memory after user feedback.

| Feedback | Effect on Semantic Memory | Bandit Update |
|----------|--------------------------|---------------|
| `accept` | Boost confidence +0.05; mark verified if ≥ 0.95 | reward = 1.0 |
| `reject` | Decay confidence −0.15; retract source inference | reward = 0.0 |
| `correct` | Store new value at confidence = 1.0; retract all inferences that produced wrong value; re-run inference engine | reward = 0.2 |

After any feedback: consolidate → re-infer → re-index retrieval embeddings.

**Forgetting threshold:** Attributes with `confidence < 0.2` receive a temporal tombstone (soft expiry). They remain auditable in history but are excluded from active retrieval.

---

### 3.10 Domain-Aware Unknown Handling

**File:** `Prototype5.ipynb` → `cell-components` (inside `AutoFillAgent`)

A critical safety feature. For domain-specific fields (medical, financial, legal), the system checks whether the semantic memory contains *any* data for that domain before querying the LLM. If no domain data exists, the system immediately returns `UNKNOWN` with confidence 0.0, never invoking the LLM.

| Domain | Guarded Properties |
|--------|--------------------|
| `medical` | allergies, blood_type, insurance_id, conditions, medications, primary_care |
| `financial` | ssn, tax_id, bank_name, annual_income, credit_score |
| `legal` | passport_number, visa_status, drivers_license |

This hard gate prevents LLM hallucination of sensitive information (fabricated SSNs, passport numbers, etc.).

---

### 3.11 Multimodal Document Routing

**File:** `Prototype5.ipynb` → `cell-ocr` (document path section)

Forms often require document uploads: profile photos, passport scans, transcripts, signatures, resumes. The system stores these as typed document attributes in the KG as local file paths.

#### Category Gate + Typed Retrieval
1. Check if the field label matches one of six predefined document categories using keyword matching
2. Return the stored document reference for that category directly

| Category Key | Trigger Keywords |
|-------------|-----------------|
| `profile_photo` | photo, picture, headshot, portrait |
| `signature` | signature, sign |
| `transcript_scan` | transcript, academic record |
| `id_scan` | id, identity document |
| `passport_scan` | passport |
| `resume_scan` | resume, CV, curriculum vitae |

The category gate prevents cross-category errors (e.g., matching "Upload Photo" to a stored signature). CLIP is import-checked in the notebook but typed keyword routing is the implemented mechanism in reported results.

---

### 3.12 Form Perception (OCR)

**File:** `Prototype5.ipynb` → `cell-ocr`

For image-based form inputs (screenshots, scanned PDFs), the system uses:
1. **Tesseract OCR** for text extraction
2. **Layout-aware line grouping** from Tesseract bounding-box metadata
3. **Heuristic field-label recovery** with fuzzy matching and OCR-noise normalization

LayoutLMv3 is availability-checked in the notebook, but the demonstrated pipeline and all reported results use Tesseract plus layout heuristics.

For the browser extension target, OCR is replaced by DOM inspection — the browser provides field labels, `name`/`id` attributes, and `placeholder` text directly.

---

### 3.13 AutoFill Agent — Master Orchestrator

**Class:** `AutoFillAgent` | **File:** `Prototype5.ipynb` → `cell-agent`

The top-level agent that wires all components together. Key public methods:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `learn()` | `learn(form_dict, context)` | Ingest a key-value form dict into the KG and run inference |
| `autofill()` | `autofill(field_labels, domain, use_llm)` | Run the full autofill pipeline; returns `FillEpisode` |
| `feedback()` | `feedback(episode, feedback_dict)` | Apply HITL feedback, consolidate, re-infer, re-index |

The agent owns: `TemporalKG`, `FieldMapper`, `EmbeddingRetriever`, `LinUCBRouter`, `InferenceEngine`, `EpisodicMemory`, `MemoryConsolidator`, `CompositionalResolver`, and `MistralClient`.

---

## 4. Autofill Pipeline — End-to-End Flow

```
Input: field_labels[], form_domain

Phase 1: IMAGE FIELDS
  for each label containing image keywords:
    → typed document-category match against stored KG document refs
    → if match: status=IMAGE_FILLED, else: UNKNOWN

Phase 2: LOCAL RESOLUTION (zero API cost)
  for each remaining label:
    a) FieldMapper: label → canonical property (3-phase)
    b) CompositionalResolver: compose from atomic parts if ≥2 components
    c) InferenceEngine: check derived facts in registry
    d) Domain-Aware Guard: skip to UNKNOWN if no domain data exists
    e) LinUCBRouter: route to local (done) or queue for LLM

Phase 3: LLM BATCH FILL (one API call for all queued fields)
  → Pre-filter: remove domain-guarded fields
  → EmbeddingRetriever: fetch top-k = min(15, max(5, n×2)) triples
  → Construct prompt: KG subgraph + inference context + field list
  → Mistral API: temperature=0, JSON mode (mistral-small-latest)
  → Parse fills → classify status (FILLED/INFERRED/GENERATED/UNKNOWN)
  → Deflate LLM confidence: cap at min(0.9, raw × 0.85)

Phase 4: EPISODE LOGGING
  → Record all results to EpisodicMemory
  → Return FillEpisode (results + metadata) for HITL feedback

Phase 5: HITL FEEDBACK (async, after user review)
  → Update LinUCB bandit rewards
  → MemoryConsolidator: boost/decay/store/retract
  → Re-run InferenceEngine on updated KG
  → Re-index EmbeddingRetriever triple embeddings
```

---

## 5. Evaluation: FormBench v2

**File:** `Prototype5.ipynb` → cells `cell-formbench`, `cell-baselines`, `cell-hard-eval`

FormBench v2 is a custom benchmark of **15 synthetic forms across 7 domain scenarios** with **3 difficulty tiers**.

### Domain Scenarios
`job` | `academic` | `visa` | `medical` | `financial` | `document` | `general-composite`

### Difficulty Tiers

| Tier | Description | Label Style | Example |
|------|------------|------------|---------|
| 1 | Standard | Direct property names | "Email", "Phone Number" |
| 2 | Synonym-heavy | Paraphrased/formal | "Primary Electronic Mail", "Cumulative Academic Score" |
| 3 | Adversarial | Circumlocutory/ambiguous | "How should we reach you digitally?", "Quantitative measure of academic performance" |

### Scoring Rules
- `FILLED` correct if value matches ground truth from KG
- `UNKNOWN` correct if no ground truth exists (correct abstention)
- `GENERATED` correct if non-empty and substantial (>10 chars) for generative fields
- `IMAGE_FILLED` correct if matched property equals expected canonical

### FormBench v2 Results (Prototype5 — local path, `use_llm=False`)

| Metric | Value |
|--------|-------|
| **Total test cases** | 55 |
| **FormBench accuracy** | **100.0% (55/55)** |
| **Correct abstentions** | **100.0%** |
| **Average retrieval compression** | **51.3%** |
| **QA length-window pass rate** | 100.0% |
| **QA lexical-grounding proxy pass rate** | 100.0% |
| **Graph-long pass rate** | 100.0% |
| **LLM generation fill rate** | 100.0% (4/4 substantial fills) |

**Important scope note:** FormBench v2 in Prototype5 is run with `use_llm=False`. The benchmark measures the local path only: mapping, composition, inference, domain guards, and document routing. LLM-backed generation is evaluated separately in the long-form QA blocks.

---

## 6. Evaluation: StandardBenchmarkSuite Lite

**File:** `Baseline/StandardBenchmarkSuite_Lite.ipynb`

A budget-aware benchmark harness for external standard datasets, designed to validate AutoFillGraph on real-world noisy form data.

### Design Constraints
- Hard on-disk dataset cap: **2 GB total** across all downloaded benchmark data
- Reuse `Prototype5` core agent without forking logic
- Evaluate only the directly comparable task: **memory-grounded key-value autofill**

### Benchmarks Enabled by Default

| Dataset | Status | Notes |
|---------|--------|-------|
| **FUNSD** | Enabled | Official original form benchmark (scanned noisy forms); full download |
| **XFUND-DE** | Enabled | German language subset; capped at train:40 / val:20 docs |
| CORD v2 | Disabled | Official HF card reports 2.31 GB total — would exceed 2 GB cap |

### What Is Scored
1. **mapping_acc** — raw benchmark question text → expected AutoFillGraph property
2. **fill_acc** — exact-fill accuracy after agent learns from benchmark question/value pairs
3. **abstain_acc** — unsupported benchmark questions correctly returned as UNKNOWN

### Embedder Models
- FUNSD: `sentence-transformers/all-MiniLM-L6-v2`
- XFUND: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`

### XFUND Budget Controls
- `XFUND_LANG = "de"` (single language)
- `XFUND_MAX_DOCS = {"train": 40, "val": 20}`
- Pruning removes excess images after JSON truncation to stay under budget

### Data Sources
- FUNSD: `https://guillaumejaume.github.io/FUNSD/dataset.zip`
- XFUND: `https://github.com/doc-analysis/XFUND/releases/tag/v1.0`

---

## 7. Prototype5 / Prototype6 / Prototype7 — Version Differences

### Prototype5 — Core System
Prototype5 is the complete implementation of AutoFillGraph v5 with all modules defined and tested. It is the canonical source notebook for:
- All class and function definitions
- FormBench v2 evaluation (hard exact-match metrics)
- LLM generation demonstrations
- Baseline comparisons

### Prototype6 — Soft Metric Extension
Prototype6 adds **comprehensive soft metric instrumentation** on top of Prototype5. Hard accuracy metrics (100% FormBench) remain identical. New additions:

#### Three Soft Metric Functions

| Function | Metric | Description |
|----------|--------|-------------|
| `token_f1(pred, gold)` | Token F1 | Bag-of-words F1 between tokenized prediction and gold |
| `char_sim(pred, gold)` | Character Similarity | Normalized edit-distance-based character similarity |
| `semantic_sim(pred, gold)` | Semantic Similarity | MiniLM cosine similarity between encoded strings |

`soft_scores(pred, gold)` returns all three in a single call.

#### Prototype6 Soft Metric Results (FormBench fill-only rows)

| Metric | AutoFillGraph v6 |
|--------|-----------------|
| Token F1 | **1.000** |
| Character Similarity | **1.000** |
| Semantic Similarity | **1.000** |

These perfect scores on synthetic FormBench are expected — the soft metrics are most diagnostic for real-world data (FUNSD/XFUND) where OCR noise and phrasing variation create partial matches.

#### Why Soft Metrics Matter for the Paper
- `token_f1 > exact_acc` → agent has the right answer but formatting differs
- `char_sim high` → short-code fields (phone, zip) match after normalization
- `sem_sim high` → semantically correct fills even when lexically different
- Enables fine-grained analysis across field types and error modes

---

### Prototype7 — Diagnostic Instrumentation + Multi-Profile Extension

Prototype7 builds on Prototype6 without forking core logic. Hard accuracy metrics (100% FormBench) and soft metrics (all 1.000) remain identical. New additions:

#### Mapper Phase Tracking
Every `bench_row` produced during FormBench evaluation now records a `mapper_phase` field — one of `exact | substring | embedding | unknown` — capturing which of the three resolution phases resolved each label. This enables per-tier phase breakdown analysis.

#### Strengthened Abstention Assertion
A formal assertion `BENCH_CORRECT_UNK >= 0.90` is added alongside the fill-accuracy assertion, making correct UNKNOWN behavior a first-class testable property rather than a qualitative observation.

#### 7-Round KG Growth Tracking
The evaluation now traces the KG state across **7 sequential rounds** (R0–R6), recording at each snapshot:
- `nodes` — NetworkX node count
- `current_facts` — active attribute values (not expired)
- `total_records` — all temporal records including soft-expired

This provides empirical evidence for the lifelong learning claim: both node count and active fact count grow monotonically, while total records (including expired history) grows faster, demonstrating temporal versioning in action.

#### Multi-Profile Demo (`draw_multi_profile_kg`)
A new `draw_multi_profile_kg(agents_labels, title)` function renders a side-by-side NetworkX visualization for two distinct user agents (e.g., Govind A and Devika R) from a single cell. This demonstrates the person-centric KG model and isolates user profiles structurally. This is a demonstration/narrative cell, not part of the evaluated pipeline.

#### Person-Centric KG Visualization
The `draw_kg_snapshot` / `plot_kg_evolution` rendering now explicitly labels the central Person node as the KG hub, improving readability of multi-entity graph snapshots.

#### New and Enhanced Figures (9 total, vs. 5 in P5/P6)

| Plot File | Status | Content |
|-----------|--------|---------|
| `plot_adversarial_challenge.png` | Updated from P5/P6 | Accuracy vs. baselines on held-out adversarial fields; renamed v5→v7 |
| `plot_formbench_quality.png` | Updated from P5/P6 | Tier-breakdown accuracy + soft metric comparison side-by-side |
| `plot_kg_growth.png` | **NEW** | Time series: nodes / current facts / temporal records across 7 rounds |
| `plot_compression.png` | Enhanced | Scatter with error bars + analytic projection + >80% target line |
| `plot_bandit.png` | Enhanced | Reward trace + **cumulative arm-selection stackplot** (replaces epsilon schedule) |
| `plot_temporal_confidence.png` | **NEW** | Address versioning history (active vs. expired) + confidence by sensitivity tier |
| `plot_route_distribution.png` | **NEW** | Horizontal bar: route fractions across FormBench v2 (all local path) |
| `plot_mapper_phases.png` | **NEW** | Grouped bar: resolution phase (exact/substring/embedding/unknown) by difficulty tier |
| `plot_kg_evolution.png` | Updated | Person-centric multi-snapshot KG evolution with person-hub layout |

---

## 8. Baseline Comparisons

Three baselines implemented directly in Prototype5/6:

| Baseline | Class | Description |
|----------|-------|-------------|
| Browser Autofill | `BrowserAutofillBaseline` | Flat key-value store, ~30 rigid HTML `autocomplete` attribute mappings |
| Pure Lookup | `PureLookupBaseline` | Keyword-only field mapper, no embedding fallback, no LLM |
| No Embedding Ablation | `NoEmbeddingAblation` | Exact + substring matching only, full local pipeline intact |

### Baseline Soft Metric Results (Prototype6)

| System | Token F1 | Char Similarity | Semantic Sim |
|--------|----------|-----------------|--------------|
| **AutoFillGraph v6** | **1.000** | **1.000** | **1.000** |
| No Embedding Ablation | 0.500 | 0.553 | 0.556 |
| Pure Lookup | 0.500 | 0.553 | 0.556 |
| Browser Autofill | 0.186 | 0.288 | 0.323 |

The 2× lift over Pure Lookup and >5× over Browser Autofill demonstrates the contribution of Phase 3 embedding-based field mapping to fill quality.

**Planned addition:** A true "Pure LLM" baseline for a mixed local-vs-LLM FormBench so the adaptive router is evaluated end-to-end on the same table.

---

## 9. Key Quantitative Results

| Metric | Value | Source |
|--------|-------|--------|
| FormBench v2 accuracy | 100.0% (55/55) | Prototype5, cell-formbench |
| Correct abstentions | 100.0% | Prototype5, cell-formbench |
| Retrieval compression | 51.3% avg | Prototype5, cell-formbench |
| LLM generation fill rate | 100.0% (4/4) | Prototype5, cell-qa |
| Token F1 (v6, fill rows) | 1.000 | Prototype6 |
| Char similarity (v6) | 1.000 | Prototype6 |
| Semantic similarity (v6) | 1.000 | Prototype6 |
| Browser autofill token F1 | 0.186 | Prototype6, baseline |
| Pure lookup token F1 | 0.500 | Prototype6, baseline |
| Semantic challenge lift | ≥25% over best lookup baseline | Prototype6 assertion |
| Correct abstentions (asserted) | ≥90% (BENCH_CORRECT_UNK) | Prototype7, abstention assertion |
| KG growth rounds tracked | 7 (R0–R6) | Prototype7, cell-figures-v7 |
| Mapper phase per bench_row | exact / substring / embedding / unknown | Prototype7, bench_rows |
| Context vector dimensions | 30 (24 + 6) | Prototype5, LinUCBRouter |
| Canonical properties | 43 | Prototype5, PROPERTIES |
| Inference rules | 7 | Prototype5, InferenceEngine |
| ε₀ (bandit exploration) | 0.35, decay 0.97, min 0.05 | Prototype5, LinUCBRouter |
| LLM confidence deflation | cap = min(0.9, raw × 0.85) | Prototype5, AutoFillAgent |
| KG forgetting threshold | confidence < 0.2 | Prototype5, TemporalKG |
| Embedding threshold | cosine ≥ 0.32 (Phase 3) | Prototype5, FieldMapper |
| Min retrieval threshold | cosine ≥ 0.15 | Prototype5, EmbeddingRetriever |
| Adaptive top-k | min(15, max(5, n×2)) | Prototype5, EmbeddingRetriever |

---

## 10. Property and Rule Registry

### Full 43-Property Canonical Set (grouped by layer)

**identity:** full_name, display_name, date_of_birth, gender, pronouns
**contact:** email, work_email, phone, address, city, state, zip_code, country
**academic:** university, degree, department, gpa, advisor, graduation_date, student_id
**professional:** employer, job_title, years_experience, skills, linkedin_url
**medical:** allergies, blood_type, insurance_id, conditions, medications, primary_care
**financial:** ssn, tax_id, bank_name, annual_income, credit_score
**legal:** passport_number, visa_status, citizenship, drivers_license
**document:** profile_photo, signature, transcript_scan, resume_scan

### 7 Guarded Inference Rules

1. `phone_country_code` — derives country from +1 phone prefix (conf=0.90)
2. `address_parse_state` — regex-parses state abbreviation from address string (conf=0.90)
3. `address_parse_city` — regex-parses city from address string (conf=0.90)
4. `address_parse_zip` — regex-parses ZIP code from address string (conf=0.90)
5. `degree_to_department` — extracts department from "MS in X" degree string (conf=0.85)
6. `email_as_work_email` — copies email to work_email for non-student contexts (conf=0.60)
7. `university_as_employer` — if student indicators present, sets employer=university (conf=0.70)

---

## 11. ICML SCALE 2026 Alignment

AutoFillGraph maps directly to all five SCALE 2026 topic areas:

| Workshop Topic | AutoFillGraph Contribution |
|---------------|--------------------------|
| **Memory of Agents** | Three-tier memory (working/episodic/semantic) with consolidation, forgetting, and temporal versioning |
| **Memory consolidation & retrieval** | Episodic → semantic transfer via HITL feedback; adaptive top-k MiniLM retrieval with 51.3% compression |
| **Memory-grounded reasoning** | Inference engine derives new facts from KG structure; compositional resolver assembles composite fields |
| **Efficient Agentic AI Systems** | LinUCB bandit minimizes API calls; embedding retrieval compresses context; domain guards avoid unnecessary LLM calls |
| **Adaptive execution** | Bandit learns per-field routing policy from real user feedback; ε decays from 0.35 to 0.05 |
| **Evaluation and Benchmarking** | FormBench v2 (15 synthetic forms, 7 domains, 3 tiers) + StandardBenchmarkSuite Lite (FUNSD + XFUND) |
| **Robustness to noisy inputs** | Three-phase field mapping handles synonym, periphrastic, and adversarial labels; OCR noise normalization |

### Claim Registry (with evidence and caveats)

**Claim 1: Compression scales with graph size**
- Evidence: 51.3% average compression on ~20-triple graph (measured in Prototype5)
- Projection: >80% at 50+ triples follows analytically from capped top-k policy
- Caveat: large-graph empirical runs not yet completed; label projection explicitly

**Claim 2: Three-phase mapping handles adversarial labels**
- Evidence: 100% FormBench v2 accuracy across all 3 tiers (Prototype5)
- Note: FormBench is synthetic — real-world form diversity not yet tested

**Claim 3: HITL feedback creates monotonic improvement**
- Mechanism: corrections add high-confidence facts; rejections retract permanently; acceptances calibrate upward
- Caveat: long-run convergence not empirically measured over multi-session history

**Claim 4: Domain-aware unknown handling prevents fabrication**
- Evidence: 100% correct UNKNOWN behavior on synthetic medical/financial guard cases (Prototype5)
- Caveat: direct Pure-LLM fabrication comparison not yet in Prototype5; add before claiming in paper

---

## 12. Limitations and Future Work

### Current Limitations

1. **Single-user system** — Prototype7 demonstrates separate per-user agent instances side-by-side but there is no shared KG, federation, or cross-profile transfer
2. **Rule-based inference only** — 7 fixed rules; cannot learn new rules from data
3. **Synthetic benchmark** — FormBench v2 needs real-world form diversity testing
4. **Local-path FormBench** — `use_llm=False` in current benchmark; adaptive routing claims need a mixed-path baseline
5. **Lexical-proxy evaluation** — long-form grounding metrics are bag-of-words checks, not factuality evaluation
6. **CLIP not in reported results** — document routing is typed keyword matching, not CLIP ranking
7. **No differential privacy** — sensitive data excluded from LLM context, but not formally DP
8. **Tesseract OCR only** — LayoutLMv3 is availability-checked but not on the demonstrated path
9. **llm_large unused** — arm 2 is reserved in the bandit but not evaluated
10. **No Pure-LLM baseline** — needed to justify adaptive routing value in the paper

### Future Directions

1. **Mixed-path FormBench** — add Pure-LLM baseline and enable `use_llm=True` evaluation
2. **Meta-learned inference rules** — discover rules from episodic memory patterns
3. **Federated KG** — share anonymized form templates across users without sharing personal data
4. **On-device LLM** — replace Mistral API with quantized Phi-3 or Gemma-2B for fully offline operation
5. **Active learning** — system asks user to provide specific missing data that would unlock the most fields
6. **Cross-form transfer** — proactively suggest filling LinkedIn from job application data
7. **CORD v2 integration** — streamed loading to stay under the 2 GB budget for negative-control abstention testing
8. **MiniWoB++ extension** — browser-side form interaction success rate benchmark

---

## 13. File Reference

| File | Purpose |
|------|---------|
| `Baseline/Prototype5.ipynb` | Complete AutoFillGraph v5 implementation; canonical class definitions; FormBench v2; LLM demos |
| `Baseline/Prototype6.ipynb` | Prototype5 + soft metric instrumentation (token F1, char sim, semantic sim); updated baseline comparisons |
| `Baseline/Prototype7.ipynb` | Prototype6 + mapper-phase tracking, 7-round KG growth metrics, abstention assertion, multi-profile demo, 9 diagnostic figures |
| `Baseline/StandardBenchmarkSuite_Lite.ipynb` | FUNSD + XFUND budget-aware external benchmark harness |
| `Playground/AutoFillGraph_v3_System_Design.md` | Architecture design document; module specs; claim registry; ICML alignment |

### Class/Module Quick Reference

| Class | Notebook | Block | Role |
|-------|---------|-------|------|
| `Sensitivity`, `FillStatus`, `Route` | P5 | cell-init | Enum type system |
| `AttributeValue`, `FillResult`, `FillEpisode` | P5 | cell-init | Core data records |
| `FieldMapper` | P5 | cell-components | 3-phase label resolution |
| `TemporalKG` | P5 | cell-components | Typed temporal knowledge graph |
| `EmbeddingRetriever` | P5 | cell-components | MiniLM triple embedding + top-k retrieval |
| `LinUCBArm`, `LinUCBRouter` | P5 | cell-components | Contextual bandit routing |
| `InferenceEngine` | P5 | cell-components | 7 guarded derivation rules |
| `EpisodicMemory` | P5 | cell-components | Episode log + field-level calibration history |
| `MemoryConsolidator` | P5 | cell-components | Accept/reject/correct transfer to KG |
| `CompositionalResolver` | P5 | cell-components | Composite field assembly |
| `MistralClient` | P5 | cell-components | JSON/text generation with usage stats |
| `AutoFillAgent` | P5 | cell-agent | Master orchestration (learn/autofill/feedback) |
| `BrowserAutofillBaseline` | P5 | cell-baselines | Flat-store comparison baseline |
| `PureLookupBaseline` | P5 | cell-baselines | No-embedding ablation baseline |
| `NoEmbeddingAblation` | P5 | cell-baselines | Substring+keyword only ablation |
| `token_f1`, `char_sim`, `semantic_sim` | P6 | v6 additions | Soft metric functions |
| `draw_multi_profile_kg` | P7 | cell-figures-v7 | Side-by-side multi-user KG visualization |
| `plot_kg_evolution` (updated) | P7 | cell-figures-v7 | Person-centric KG evolution across snapshots |

---

*AutoFillGraph — Lifelong learning, adaptive routing, structured memory, human-in-the-loop.*
*Designed for ICML SCALE 2026. Built for deployment as a browser extension.*
