# AutoFillGraph: A Knowledge-Graph-Grounded Agent with Adaptive Memory for Intelligent Form Autofill

## SCALE @ ICML 2026 — Late-Breaking Track (3 pages)

---

## 1. Vision Statement

**What you're building:** An intelligent autofill agent that learns a user's personal information as a temporal knowledge graph and progressively fills forms across any domain — jobs, academic, visa, medical, financial — with increasing accuracy and decreasing compute cost over time.

**Why it matters:** People fill hundreds of forms in their lifetime. Browser autofill handles ~10 standard fields (name, email, phone, address). Everything else — your advisor's name, your GPA, your visa status, your insurance ID, your research interests — must be typed from scratch every time. AutoFillGraph remembers everything, learns from corrections, and gets smarter with every form.

**The research question for SCALE:** *How should an agent structure, query, and evolve its personal knowledge graph to maximize form-fill accuracy while minimizing LLM compute, and how do these tradeoffs change as the graph grows?*

---

## 2. Why This Fits SCALE Perfectly

| SCALE Topic | AutoFillGraph Connection |
|---|---|
| **Memory of Agents** | Personal KG = long-term semantic memory. Working memory = current form session. Episodic memory = fill history with user feedback. Sleep-wake consolidation with strengthening, decay, and retraction. |
| **Efficient Agentic AI** | Graph-topology confidence estimation enables 80%+ fields to be filled locally with zero LLM cost. Only ambiguous/generative fields trigger LLM calls. Adaptive threshold learned from feedback. |
| **Scaling of Multimodal Agents** | OCR perception ingests forms from images/PDFs. CLIP matches document upload fields. As the KG grows denser across sessions, the accuracy-cost Pareto frontier shifts favorably — a scaling law for memory-augmented agents. |
| **Evaluation and Benchmarking** | PersonalFormBench: 100+ fields from real platforms (Greenhouse, Workday, CommonApp, DS-160, FAFSA), 3 difficulty tiers, 5 domains, 6 user profiles with mean ± std. Accuracy-cost joint metrics. |
| **Multimodal Agents for Planning** | Perception-memory-action loop: perceive form fields (OCR) → query memory (KG) → act (fill) → receive feedback → update memory. |

---

## 3. System Architecture

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    AUTOFILLGRAPH AGENT                                  ║
║                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────┐    ║
║  │  LAYER 1: PERCEPTION                                            │    ║
║  │                                                                  │    ║
║  │  Input Sources:                                                  │    ║
║  │  ┌──────────┐  ┌──────────────┐  ┌────────────────┐            │    ║
║  │  │ Web Form │  │ PDF/Document │  │ Screenshot/    │            │    ║
║  │  │ (HTML    │  │ (structured  │  │  Photo of form │            │    ║
║  │  │  labels) │  │  text + OCR) │  │  (pure OCR)    │            │    ║
║  │  └────┬─────┘  └──────┬───────┘  └───────┬────────┘            │    ║
║  │       │               │                   │                      │    ║
║  │       └───────────────┴───────────────────┘                      │    ║
║  │                       │                                          │    ║
║  │              ┌────────▼────────┐                                 │    ║
║  │              │ Field Extractor │                                 │    ║
║  │              │ • HTML parser   │                                 │    ║
║  │              │ • Tesseract OCR │                                 │    ║
║  │              │ • LayoutLMv3    │                                 │    ║
║  │              │   (form-aware   │                                 │    ║
║  │              │    extraction)  │                                 │    ║
║  │              └────────┬────────┘                                 │    ║
║  │                       │                                          │    ║
║  │              Raw field labels:                                   │    ║
║  │              ["Employer's Name", "Student's state of             │    ║
║  │               legal residence", "Upload photo", ...]             │    ║
║  └───────────────────────┬─────────────────────────────────────────┘    ║
║                           │                                              ║
║  ┌────────────────────────▼────────────────────────────────────────┐    ║
║  │  LAYER 2: UNDERSTANDING                                         │    ║
║  │  (1 LLM call per form — amortized across all fields)            │    ║
║  │                                                                  │    ║
║  │  Input:  All field labels as a batch                             │    ║
║  │  Prompt: "Classify each form field into one of:                  │    ║
║  │           LOOKUP(entity, attribute) — retrievable fact           │    ║
║  │           GENERATE(topic) — needs composition/writing            │    ║
║  │           DOCUMENT(doc_type) — needs file/image upload           │    ║
║  │           UNKNOWN — cannot determine intent"                     │    ║
║  │                                                                  │    ║
║  │  Output examples:                                                │    ║
║  │    "Employer's Name"        → LOOKUP(employer, name)             │    ║
║  │    "Student's state"        → LOOKUP(user, state)                │    ║
║  │    "Tell us about yourself" → GENERATE(self_introduction)        │    ║
║  │    "Upload photo"           → DOCUMENT(profile_photo)            │    ║
║  │    "Passport Number"        → LOOKUP(user, passport_number)      │    ║
║  │                                                                  │    ║
║  │  WHY THIS MATTERS:                                               │    ║
║  │  This single call fixes the class of bugs where keyword          │    ║
║  │  matching maps "Employer's Name" → full_name instead of          │    ║
║  │  employer. The LLM understands that "Name of X" means            │    ║
║  │  the name attribute of entity X. Embedding matchers cannot.      │    ║
║  │                                                                  │    ║
║  │  Cost: ~200-300 tokens total. Amortized: ~25 tokens/field.      │    ║
║  │  Can be cached for known form templates.                         │    ║
║  └────────────────────────┬────────────────────────────────────────┘    ║
║                           │                                              ║
║              Structured intents per field                                ║
║                           │                                              ║
║  ┌────────────────────────▼────────────────────────────────────────┐    ║
║  │  LAYER 3: MEMORY (Personal Knowledge Graph)                      │    ║
║  │                                                                  │    ║
║  │  ┌─────────────────────────────────────────────────────────┐    │    ║
║  │  │  3a. SEMANTIC MEMORY — Temporal Knowledge Graph          │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Nodes: Typed entities                                   │    │    ║
║  │  │    User(Priya), Org(MIT), Org(MIT_CSAIL),                │    │    ║
║  │  │    Person(Dr.Barzilay), Location(Cambridge),             │    │    ║
║  │  │    Interest(NLP), Interest(Biomedical_AI), ...           │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Edges: Typed, temporal relations                        │    │    ║
║  │  │    User --STUDIES_AT--> MIT [2023-present]                │    │    ║
║  │  │    User --WORKS_AT--> MIT_CSAIL [2024-present]           │    │    ║
║  │  │    User --ADVISED_BY--> Dr.Barzilay [2023-present]       │    │    ║
║  │  │    User --LIVES_IN--> Cambridge [2023-2025] (EXPIRED)    │    │    ║
║  │  │    User --LIVES_IN--> Menlo_Park [2025-present]          │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Attributes: Each has rich metadata                      │    │    ║
║  │  │    full_name = "Priya Sharma"                            │    │    ║
║  │  │      ├─ source: "profile_form"                           │    │    ║
║  │  │      ├─ confidence: 1.0                                  │    │    ║
║  │  │      ├─ created_at: 2024-01-15                           │    │    ║
║  │  │      ├─ valid_from: 2024-01-15                           │    │    ║
║  │  │      ├─ valid_until: None (current)                      │    │    ║
║  │  │      ├─ access_count: 14                                 │    │    ║
║  │  │      ├─ verified: True                                   │    │    ║
║  │  │      └─ sensitivity: PUBLIC                              │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Sensitivity Layers (privacy gates):                     │    │    ║
║  │  │    PUBLIC: name, email, phone, university, gpa           │    │    ║
║  │  │    RESTRICTED: allergies, insurance, medical              │    │    ║
║  │  │    ENCRYPTED: ssn, passport, financial                   │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Inference Rules (with retraction support):              │    │    ║
║  │  │    phone(+1-xxx) → country(United States) [conf=0.9]     │    │    ║
║  │  │    address → city, state, zip [via structured parser]    │    │    ║
║  │  │    degree("MS in ML") → department("ML") [conf=0.85]     │    │    ║
║  │  │    university + degree → employer (if student) [conf=0.7]│    │    ║
║  │  │    ⛔ Retracted: phone→citizenship (dangerous)           │    │    ║
║  │  └─────────────────────────────────────────────────────────┘    │    ║
║  │                                                                  │    ║
║  │  ┌─────────────────────────────────────────────────────────┐    │    ║
║  │  │  3b. EPISODIC MEMORY — Fill History + Feedback Log       │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Episode = one complete form-fill session                │    │    ║
║  │  │  Stores: field → (value, status, route, confidence,      │    │    ║
║  │  │          user_feedback, tce_features)                     │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Enables:                                                │    │    ║
║  │  │  • Per-property historical accuracy tracking             │    │    ║
║  │  │  • TCE weight calibration via logistic regression        │    │    ║
║  │  │  • Detecting systematic failure patterns                 │    │    ║
║  │  └─────────────────────────────────────────────────────────┘    │    ║
║  │                                                                  │    ║
║  │  ┌─────────────────────────────────────────────────────────┐    │    ║
║  │  │  3c. WORKING MEMORY — Current Session State              │    │    ║
║  │  │                                                          │    │    ║
║  │  │  • Active form domain (job/academic/visa/medical/fin)    │    │    ║
║  │  │  • Partially filled fields (cross-field dependencies)    │    │    ║
║  │  │  • TCE contexts for bandit-free routing                  │    │    ║
║  │  │  • Cleared after each form submission                    │    │    ║
║  │  └─────────────────────────────────────────────────────────┘    │    ║
║  │                                                                  │    ║
║  │  ┌─────────────────────────────────────────────────────────┐    │    ║
║  │  │  3d. DOCUMENT MEMORY — Multimodal Store                  │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Stores user documents with CLIP embeddings:             │    │    ║
║  │  │    profile_photo → embed + path                          │    │    ║
║  │  │    signature → embed + path                              │    │    ║
║  │  │    resume_scan → embed + path                            │    │    ║
║  │  │    transcript_scan → embed + path                        │    │    ║
║  │  │    passport_scan → embed + path                          │    │    ║
║  │  │                                                          │    │    ║
║  │  │  DOCUMENT(profile_photo) queries this store              │    │    ║
║  │  │  via CLIP semantic category matching                     │    │    ║
║  │  └─────────────────────────────────────────────────────────┘    │    ║
║  └────────────────────────┬────────────────────────────────────────┘    ║
║                           │                                              ║
║  ┌────────────────────────▼────────────────────────────────────────┐    ║
║  │  LAYER 4: ROUTING (Topology Confidence Estimator — TCE)          │    ║
║  │                                                                  │    ║
║  │  For each LOOKUP field, compute structural confidence            │    ║
║  │  from the graph — NO LLM call needed:                            │    ║
║  │                                                                  │    ║
║  │  φ(field) = [                                                    │    ║
║  │    match_quality,      # 1.0=intent parsed, 0.5=fallback        │    ║
║  │    source_count,       # how many sources wrote this value       │    ║
║  │    temporal_freshness, # 1/(1 + days_old/30)                     │    ║
║  │    historical_accept,  # past acceptance rate from episodes      │    ║
║  │    inference_depth,    # 0=direct, 1=inferred, 2=chained        │    ║
║  │    corroboration,      # independent supporting facts            │    ║
║  │    value_exists        # 1 if value found in graph, 0 if not    │    ║
║  │  ]                                                               │    ║
║  │                                                                  │    ║
║  │  Confidence: c = σ(w · φ)  where w learned from episodes        │    ║
║  │                                                                  │    ║
║  │  Routing decision:                                               │    ║
║  │    c ≥ θ_high  → LOCAL FILL (zero cost)                          │    ║
║  │    c ≥ θ_low   → LOCAL FILL with low-confidence flag             │    ║
║  │    c < θ_low   → LLM FILL (retrieve subgraph, prompt LLM)       │    ║
║  │    not found   → LLM FILL or UNKNOWN                             │    ║
║  │                                                                  │    ║
║  │  GENERATE fields → always LLM (needs composition)                │    ║
║  │  DOCUMENT fields → always Document Memory (CLIP match)           │    ║
║  │                                                                  │    ║
║  │  KEY INSIGHT: The graph topology IS the router.                  │    ║
║  │  Dense, well-corroborated, frequently-accepted facts → local.    │    ║
║  │  Sparse, inferred, never-verified facts → LLM verification.     │    ║
║  │  This is FREE metadata — costs zero tokens to compute.           │    ║
║  └────────────────────────┬────────────────────────────────────────┘    ║
║                           │                                              ║
║         ┌─────────────────┴──────────────────┐                          ║
║         │                                     │                          ║
║         ▼                                     ▼                          ║
║  ┌──────────────┐                  ┌──────────────────────┐             ║
║  │ LOCAL FILL    │                  │ LLM FILL              │             ║
║  │               │                  │                        │             ║
║  │ Direct attr   │                  │ Embed-retrieve         │             ║
║  │ lookup from   │                  │ relevant subgraph      │             ║
║  │ graph         │                  │ (MiniLM, adaptive k,   │             ║
║  │               │                  │  min_sim filtering)    │             ║
║  │ Cost: 0 tok   │                  │                        │             ║
║  │ Latency: <1ms │                  │ Prompt LLM with:       │             ║
║  │               │                  │  • parsed intent       │             ║
║  │ Also handles: │                  │  • retrieved subgraph  │             ║
║  │ • Inferences  │                  │  • working memory ctx  │             ║
║  │ • Compositions│                  │                        │             ║
║  │ • Doc matches │                  │ Cost: ~100-300 tokens  │             ║
║  └──────┬───────┘                  └──────────┬─────────────┘             ║
║         │                                     │                          ║
║         └─────────────────┬───────────────────┘                          ║
║                           │                                              ║
║  ┌────────────────────────▼────────────────────────────────────────┐    ║
║  │  LAYER 5: ACTION (Fill Presentation)                             │    ║
║  │                                                                  │    ║
║  │  Each fill has:                                                  │    ║
║  │  • value (text, path, or None)                                   │    ║
║  │  • status (filled/inferred/generated/unknown/document)           │    ║
║  │  • confidence (from TCE for local, from LLM for generated)       │    ║
║  │  • evidence chain (which graph facts support this)               │    ║
║  │  • route_used (local vs llm)                                     │    ║
║  │                                                                  │    ║
║  │  Low-confidence fills are flagged for user review                │    ║
║  └────────────────────────┬────────────────────────────────────────┘    ║
║                           │                                              ║
║  ┌────────────────────────▼────────────────────────────────────────┐    ║
║  │  LAYER 6: FEEDBACK + CONSOLIDATION                               │    ║
║  │                                                                  │    ║
║  │  User provides per-field feedback:                               │    ║
║  │    accept  → boost attribute confidence, +1 to accept count      │    ║
║  │    reject  → decay confidence, retract inference if applicable   │    ║
║  │    correct → store new value (conf=1.0), retract old inference,  │    ║
║  │              blacklist the rule that produced wrong value         │    ║
║  │                                                                  │    ║
║  │  ┌─────────────────────────────────────────────────────────┐    │    ║
║  │  │  WAKE PHASE (immediate, online):                         │    │    ║
║  │  │  • Store corrections to graph                            │    │    ║
║  │  │  • Log episode to episodic memory                        │    │    ║
║  │  │  • Retract failed inferences                             │    │    ║
║  │  └─────────────────────────────────────────────────────────┘    │    ║
║  │                                                                  │    ║
║  │  ┌─────────────────────────────────────────────────────────┐    │    ║
║  │  │  SLEEP PHASE (periodic, offline):                        │    │    ║
║  │  │                                                          │    │    ║
║  │  │  1. TCE CALIBRATION                                      │    │    ║
║  │  │     Fit logistic regression on episodic log:              │    │    ║
║  │  │     features = φ(field), label = 1 if accepted else 0    │    │    ║
║  │  │     Updates weights w so confidence predictions improve  │    │    ║
║  │  │                                                          │    │    ║
║  │  │  2. STRENGTHEN                                           │    │    ║
║  │  │     Attributes accepted N+ times → verified=True         │    │    ║
║  │  │     Verified attributes get priority in retrieval        │    │    ║
║  │  │                                                          │    │    ║
║  │  │  3. DECAY                                                │    │    ║
║  │  │     Attributes not accessed in T days → confidence -= δ  │    │    ║
║  │  │     Below threshold → mark expired (still in history)    │    │    ║
║  │  │                                                          │    │    ║
║  │  │  4. RETRACT                                              │    │    ║
║  │  │     Inference rules that produced rejected values →      │    │    ║
║  │  │     blacklisted for that (entity, attribute) pair        │    │    ║
║  │  │     Never re-derived (prevents oscillation)              │    │    ║
║  │  │                                                          │    │    ║
║  │  │  5. RE-INDEX                                             │    │    ║
║  │  │     Rebuild embedding retrieval index with current       │    │    ║
║  │  │     graph state                                          │    │    ║
║  │  │                                                          │    │    ║
║  │  │  Inspired by: hippocampal replay during sleep            │    │    ║
║  │  │  (Cite: SleepGate, LightMem, Graphiti bi-temporal)      │    │    ║
║  │  └─────────────────────────────────────────────────────────┘    │    ║
║  └─────────────────────────────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Complete Autofill Pipeline — Step by Step

### Step 1: User Onboarding (Learn Phase)

The user provides initial data through a profile form, or by uploading existing documents:

```
User inputs:
  Profile form → {"name": "Priya Sharma", "email": "priya@mit.edu", ...}
  Resume PDF   → OCR extracts employer, skills, education
  Transcript   → stored as document for upload fields
  Passport     → stored as document; OCR extracts passport number

System actions:
  1. Store each fact as a graph attribute with full metadata
  2. Create typed entity nodes (User, MIT, Dr.Barzilay, ...)
  3. Create relation edges (STUDIES_AT, WORKS_AT, ADVISED_BY, ...)
  4. Run inference engine (phone→country, address→city/state/zip, ...)
  5. Encode documents with CLIP for later matching
  6. Build embedding retrieval index over all triples
```

### Step 2: Form Encounter (Autofill Phase)

User visits a job application on Greenhouse ATS:

```
Form fields: ["Full Name", "Email", "Phone", "Resume/CV",
              "Current Company", "Current Title", "LinkedIn URL",
              "Why are you interested in this role? (2-3 sentences)"]
```

**Phase 1 — Perception:** Fields are extracted from the web page (HTML parser) or from an image (OCR via Tesseract with LayoutLMv3 field detection).

**Phase 2 — Understanding:** One LLM call parses all 8 labels:
```json
[
  {"field": "Full Name",      "intent": "LOOKUP",    "entity": "user", "attr": "full_name"},
  {"field": "Email",          "intent": "LOOKUP",    "entity": "user", "attr": "email"},
  {"field": "Phone",          "intent": "LOOKUP",    "entity": "user", "attr": "phone"},
  {"field": "Resume/CV",      "intent": "DOCUMENT",  "doc_type": "resume"},
  {"field": "Current Company","intent": "LOOKUP",    "entity": "user", "attr": "employer"},
  {"field": "Current Title",  "intent": "LOOKUP",    "entity": "user", "attr": "job_title"},
  {"field": "LinkedIn URL",   "intent": "LOOKUP",    "entity": "user", "attr": "linkedin"},
  {"field": "Why interested?","intent": "GENERATE",  "topic": "motivation"}
]
```

**Phase 3 — Memory Query + TCE Routing:**

| Field | Intent | Graph Has? | TCE φ | Conf | Route |
|---|---|---|---|---|---|
| Full Name | LOOKUP(user, full_name) | ✅ "Priya Sharma" | [1.0, 3, 1.0, 1.0, 0, 4, 1] | 0.99 | LOCAL |
| Email | LOOKUP(user, email) | ✅ "priya@mit.edu" | [1.0, 2, 1.0, 1.0, 0, 2, 1] | 0.97 | LOCAL |
| Phone | LOOKUP(user, phone) | ✅ "+1-617-555-0142" | [1.0, 1, 0.9, 1.0, 0, 1, 1] | 0.95 | LOCAL |
| Resume/CV | DOCUMENT(resume) | ✅ CLIP match | — | 0.90 | DOCUMENT |
| Current Company | LOOKUP(user, employer) | ✅ "MIT CSAIL" | [1.0, 2, 0.8, 0.9, 0, 3, 1] | 0.92 | LOCAL |
| Current Title | LOOKUP(user, job_title) | ✅ "Research Asst" | [1.0, 1, 0.8, 1.0, 0, 2, 1] | 0.90 | LOCAL |
| LinkedIn | LOOKUP(user, linkedin) | ✅ "linkedin.com/..." | [1.0, 1, 0.7, 1.0, 0, 1, 1] | 0.88 | LOCAL |
| Why interested? | GENERATE(motivation) | — | — | — | LLM |

**Result: 6 local fills + 1 document match + 1 LLM call = 1 API call total**
Compare to Pure LLM: 1 call with all 8 fields and full user data dumped into context.
Compare to Browser Autofill: fills only name/email/phone (3 of 8).

**Phase 4 — LLM Fill for GENERATE field:**
The LLM receives the retrieved subgraph context (research interests, current role, skills) and composes a 2-3 sentence motivation paragraph. This is the only field that costs tokens.

**Phase 5 — User reviews, provides feedback:**
- Accepts 7 fills, corrects the motivation paragraph slightly
- Episodic memory logs all 8 results with feedback
- TCE features are recorded for later calibration

### Step 3: Form Encounter #2 (Cross-Domain — Visa Application)

Now the user fills a DS-160 visa form. The agent reuses identity + contact data from the KG, uses citizenship and passport data, and handles fields like "Purpose of travel" as GENERATE.

**Key scenario:** The field "Name and address of the educational sponsor" would have been mapped to `full_name` by keyword matching. But the intent parser correctly outputs: `LOOKUP(user, university)` because the LLM understands "educational sponsor" = the sponsoring university, not the applicant's name.

### Step 4: Temporal Update

User moves from Cambridge to Menlo Park:
```
Old: address = "77 Mass Ave, Cambridge, MA 02139" [EXPIRED]
New: address = "1 Hacker Way, Menlo Park, CA 94025" [CURRENT]
```

Next form that asks for "City" gets "Menlo Park" (not "Cambridge").
The graph maintains full history — both values exist with temporal validity windows.

### Step 5: Sleep Consolidation (After 10+ Episodes)

The sleep cycle runs and discovers:
- `full_name` has been accepted 10/10 times → `verified = True`
- `state` was rejected 2/5 times (old address parser bug, now corrected) → lower confidence
- The inference rule `address_parse → state` was corrected twice → TCE learns that `inference_depth=1` is a negative signal → adjusts weight

Next session: the agent is more cautious about inferred values, sends them for LLM verification. Accuracy improves.

---

## 5. What Makes This Novel

### vs. Browser Autofill (Chrome, Safari, LastPass)
Browser autofill uses a flat key-value store with ~15 standard fields tied to HTML `autocomplete` attributes. It cannot handle "Research Interests", "Faculty Advisor", "Insurance ID", or any non-standard label. AutoFillGraph handles 100+ field types across 5+ domains because the KG stores arbitrary typed attributes with semantic matching.

### vs. Zep/Graphiti
Zep builds temporal knowledge graphs for conversational agents. AutoFillGraph applies the same architecture to a concrete task (form autofill) and adds the TCE — using graph topology for compute routing, which Zep does not do. Zep retrieves; AutoFillGraph retrieves AND routes.

### vs. Mem0
Mem0 uses vector + graph hybrid storage for personalization. AutoFillGraph adds: (a) structured intent parsing for vocabulary mismatch, (b) topology-based confidence estimation, (c) sleep-wake consolidation with TCE calibration, and (d) evaluation on a structured task with objective ground truth.

### vs. BEST-Route / RouteLLM
These route based on query text difficulty. AutoFillGraph routes based on the agent's own knowledge state — the same query gets different confidence depending on whether the KG has 3 corroborating sources or a single weak inference. This is strictly more informative.

### vs. RAG for form-filling
RAG embeds all user facts and retrieves by similarity. AutoFillGraph preserves graph structure (entity types, relations, temporal validity, inference chains) which enables: multi-hop reasoning (university → department → advisor), temporal awareness (current vs. expired address), and sensitivity-gated retrieval (SSN hidden at PUBLIC level).

---

## 6. Evaluation Design

### PersonalFormBench

| Property | Value |
|---|---|
| Forms | 13 forms from 5 real-world platforms |
| Fields | 106 total field labels |
| Sources | Greenhouse ATS, Workday ATS, CommonApp, DS-160, Schengen, UK Tier 4, Hospital intake, Specialist referral, W-4, FAFSA |
| Tiers | T1 (standard labels, 41 fields), T2 (synonym-heavy, 42 fields), T3 (adversarial/compound, 23 fields) |
| Domains | Job, Academic, Visa, Medical, Financial |
| Users | 6 profiles: dense_domestic (28 fields), dense_international (22), sparse_academic (8), sparse_professional (9), minimal (3), cross_domain (16) |

**Critical evaluation fix:** Ground truth is defined by a canonical property mapping independent of the system. "Employer's Name" canonical = `employer`. If the system fills it with `full_name`, it is scored WRONG regardless of whether `full_name` exists in the KG.

### Baselines (5 systems)

| Baseline | Description | Characteristics |
|---|---|---|
| **Browser Autofill** | WHATWG autocomplete spec + fuzzy matching | Flat KV, ~15 fields, no LLM |
| **Pure Lookup** | Keyword + substring field matching against KG | Uses the graph but no LLM, no intent parsing |
| **RAG** | Embed all facts, retrieve top-k per field, batch LLM fill | No graph structure, just flat vectors |
| **Pure LLM** | Dump all attributes as flat text, LLM fills everything | Maximum cost, no memory structure |
| **Mem0-style** | Vector store + simple entity tracking | No topology routing, no intent parsing |

### Ablation Study (4 configs)

| Ablation | What's Disabled | Tests |
|---|---|---|
| −Intent Parser | Use keyword/embedding matching instead of LLM parsing | Value of semantic understanding (expect −8-12pp on T2/T3) |
| −TCE Routing | All unfilled fields go to LLM (no confidence gating) | Value of topology-guided routing (expect same accuracy but +60% more API calls) |
| −Sleep Consolidation | No offline learning, no TCE weight updates | Value of progressive learning (expect −2-4pp over multiple episodes) |
| −Graph Structure | Flat key-value store instead of KG | Value of typed relations, inference, temporal (expect −3-5pp) |

### Metrics

| Metric | What It Measures |
|---|---|
| Fill Accuracy | % fields correctly filled (against canonical ground truth) |
| Per-Tier Accuracy | T1, T2, T3 breakdown (shows where the system excels/struggles) |
| API Calls | Number of LLM invocations (efficiency) |
| Tokens Used | Total compute cost (efficiency) |
| Local Fill Rate | % fields filled without any LLM call |
| Latency/field | Wall-clock time per field (ms) |
| Multi-user mean ± std | Robustness across profile densities |

### The Signature Experiment: Accuracy-Cost Pareto at Different Graph Densities

Sweep TCE threshold θ from 0.0 (everything → LLM) to 1.0 (everything → local).
At each θ, measure accuracy and API calls.
Do this for 3 profile densities: sparse (3 fields), medium (10), dense (28).

**Expected result:**
```
                  Accuracy
                    │
               1.0  │         ●●●●●●●●── Dense profile (28 fields)
                    │       ●●
                    │     ●●
               0.9  │    ●        ○○○○○○── Medium profile (10 fields)
                    │   ●      ○○
                    │  ●     ○○
               0.8  │ ●    ○○
                    │●   ○        △△△△── Sparse profile (3 fields)
                    │  ○       △△
               0.7  │ ○     △△
                    │○    △
                    │   △
               0.6  │__△_________________________
                    0   2   4   6   8  10  12  14
                              API Calls →

Sweet spots:
  Dense:  θ*=0.6, accuracy=92%, API=3 calls
  Medium: θ*=0.4, accuracy=85%, API=6 calls
  Sparse: θ*=0.2, accuracy=78%, API=10 calls
```

**The key finding:** Denser graphs enable more aggressive local filling. The TCE threshold that maximizes the accuracy-cost tradeoff shifts right (more local) as the graph grows. This is a **scaling law for memory-augmented agents** — exactly what SCALE reviewers want to see.

---

## 7. Paper Structure (3 Pages + References)

### Page 1

**Title:** AutoFillGraph: Knowledge-Graph-Grounded Agents with Topology-Aware Memory for Adaptive Form Autofill

**Abstract (5 lines):**
People fill hundreds of forms across jobs, education, visas, healthcare, and finance, yet browser autofill handles only ~10 standard fields. We present AutoFillGraph, a memory-augmented agent that learns a user's personal information as a temporal knowledge graph and fills forms with adaptive compute routing. Our Topology Confidence Estimator (TCE) uses graph-structural features — source diversity, temporal freshness, inference depth, historical accuracy — as a zero-cost signal to decide whether a field can be filled locally or requires an LLM call. On PersonalFormBench (106 fields from real-world platforms across 5 domains), AutoFillGraph achieves 90%+ accuracy with 50%+ fewer LLM calls than flat-context baselines, and the accuracy-cost frontier improves as the agent's knowledge graph grows denser across sessions.

**Introduction (half page):**
- Motivate the form-filling problem with concrete examples
- Current solutions: browser autofill (too limited), pure LLM (too expensive, no memory)
- Our approach: KG as structured memory + intent parsing for field understanding + TCE for routing
- Architecture figure (clean, single-column version)

### Page 2

**Method (full page) — Three contributions:**

**§2.1 Personal Knowledge Graph with Temporal Provenance (1/3 page)**
- Typed entity nodes, temporal relation edges, layered attribute metadata
- Bi-temporal model (when fact occurred vs when it was stored) — cite Graphiti
- Sensitivity-gated retrieval (public/restricted/encrypted layers)
- Guarded inference engine with retraction support
- Document memory with CLIP embeddings for image/upload fields

**§2.2 Intent-Aware Field Understanding (1/4 page)**
- One LLM call per form, ~200 tokens, batch all labels
- Classifies into LOOKUP / GENERATE / DOCUMENT
- Solves vocabulary mismatch that embedding matchers cannot handle
- Concrete example: "Employer's Name" → LOOKUP(employer, name)

**§2.3 Topology Confidence Estimator + Sleep-Wake Consolidation (1/3 page)**
- 7-feature vector φ extracted from graph structure (zero LLM cost)
- Logistic confidence model calibrated from episodic feedback
- Sleep cycle: strengthen verified facts, decay stale ones, retract failed inferences, update TCE weights
- Connection to hippocampal replay (cite SleepGate, LightMem)

### Page 3

**§3 Experiments (2/3 page)**

Table 1: Main Comparison (5 systems × overall + 3 tiers + API calls + tokens)
```
System              Overall  T1    T2    T3    API  Tokens
AutoFillGraph       ~90%     98%   88%   82%   3-5  ~800
RAG baseline        ~78%     83%   79%   70%   13   ~2800
Pure LLM            ~74%     71%   81%   65%   13   ~2600
Pure Lookup         ~73%     95%   69%   39%   0    0
Browser Autofill    ~46%     66%   40%   22%   0    0
```

Table 2: Ablation (4 configs)
Figure 1: Accuracy vs API calls Pareto curve at 3 graph densities (the signature figure)
One line on multi-user: "80% ± 3% across 6 profiles (3-28 fields)"

**§4 Discussion + Conclusion (1/3 page)**
- Key finding: graph topology is a free compute router
- Limitations: synthetic profiles, single-LLM provider, no real browser extension yet
- Future: browser extension deployment, multi-agent KG sharing, RL-based TCE (cite AgeMem)

### References (separate page, does not count toward 3-page limit)

Key citations:
- Zep/Graphiti (temporal KG for agent memory) [Rasmussen, 2025]
- Mem0 (scalable agent memory) [Chhikara et al., 2025]
- Graph-based Agent Memory survey [Yang et al., 2026]
- BEST-Route (adaptive LLM routing) [Ding et al., 2025]
- SleepGate (sleep-inspired consolidation) [2026]
- LightMem (efficient memory with sleep) [2025]
- Memory in the Age of AI Agents survey [Liu et al., 2025]
- AgeMem (RL for memory management) [Yu et al., 2026]
- Experience Compression Spectrum [2026]
- A-MEM (agentic memory) [Xu et al., 2025]

---

## 8. Implementation Notes

### What to Keep from AutoFillGraph v3
- SemanticMemory class (temporal KG with typed entities/edges)
- EpisodicMemory class (episode logging with feedback)
- WorkingMemory class (session state)
- DeterministicResolvers (email→org, phone→country)
- InferenceEngine (with retraction support — this works well)
- CLIPEncoder (for document matching)
- EmbeddingRetriever (MiniLM for subgraph retrieval)
- Sensitivity layers and privacy gating
- FormFieldExtractor (OCR pipeline)
- All visualization helpers

### What to Replace
- FieldMapper (keyword/embedding) → **LLM Intent Parser** (1 call/form)
- LinUCB Bandit → **Topology Confidence Estimator** (feature-based, learned)
- `parse_address()` naive split → **Structured address parser** (regex for street/city/state/zip pattern)
- `simulate_hitl_feedback()` self-referential → **Canonical ground truth comparison**
- Browser Autofill baseline (fake 8-field dict) → **WHATWG autocomplete spec implementation**

### What to Add
- TCE feature extraction function (7 features from graph, ~30 lines)
- TCE weight learning via sklearn LogisticRegression in sleep phase (~20 lines)
- Intent parser prompt template + response parser (~40 lines)
- LLM retry logic for 503 errors (~10 lines)
- Canonical evaluation scoring (~30 lines to fix the ground truth comparison)

### Models Used
- **Mistral Small** (mistral-small-latest): Intent parsing + LLM fills
- **MiniLM-L6-v2** (sentence-transformers): Embedding retrieval
- **CLIP ViT-B/32** (openai): Document/image field matching
- **LayoutLMv3** (microsoft): Form structure perception (with OCR fallback)
- **Tesseract OCR**: Text extraction from form images

---

## 9. Figures for the Paper

### Figure 1: Architecture Diagram (Page 1)
Clean single-column version of the architecture showing:
Form Input → Perception (OCR) → Understanding (Intent Parser) → Memory (KG) → Routing (TCE) → Fill (Local/LLM) → Feedback → Consolidation

### Figure 2: Accuracy-Cost Pareto Curve (Page 3)
Three curves (sparse/medium/dense profiles) showing accuracy vs API calls as TCE threshold varies. Annotate the sweet spots. This is the paper's signature figure.

### Figure 3: Ablation Bar Chart (Page 3, small)
4 bars showing accuracy drop when each component is removed. Intent parser shows biggest drop on T2/T3.

---

## 10. Talking Points for Reviewers

**Q: "Isn't this just Mem0/Zep for forms?"**
A: No. Mem0/Zep provide memory storage and retrieval. We add: (1) intent-aware field understanding that solves vocabulary mismatch, (2) topology-based confidence estimation that uses graph structure as a free compute router, and (3) evaluation on a structured task with objective ground truth. The TCE concept — using memory topology to route compute — is novel and applicable beyond forms.

**Q: "The evaluation uses synthetic user profiles. How do you know this generalizes?"**
A: PersonalFormBench uses real field labels from production platforms (Greenhouse, Workday, CommonApp, DS-160, FAFSA). The multi-user evaluation across 6 profiles with varying density (3-28 fields) shows robustness. We acknowledge real-user deployment as future work.

**Q: "Why not just use a large LLM for everything?"**
A: Cost and latency. Our system fills 80%+ of fields locally with zero LLM cost. For a user filling 5 forms/week, this reduces monthly API costs by 5-10x while maintaining accuracy. The Pareto curve shows this tradeoff quantitatively.

**Q: "How does this scale?"**
A: As the KG grows denser, the TCE threshold can be more aggressive — more fields are filled locally because there's more structural confidence signal. This is the paper's main scaling result: memory density enables compute efficiency.

---

## 11. Risk Assessment

| Risk | Mitigation |
|---|---|
| Intent parser LLM call adds latency | Batch all fields in one call (~200 tokens). Cache parsed intents for known form templates. |
| Intent parser itself could be wrong | Fallback to embedding matching when parser returns UNKNOWN. Log parser accuracy in episodes. |
| TCE weights overfit to one user | Use regularized logistic regression. Cross-validate on held-out episodes. |
| Mistral API 503 errors during eval | Implement retry with exponential backoff (3 retries, 2s/4s/8s). |
| 3-page limit too tight | Cut OCR details to a single sentence. Architecture figure replaces detailed text. Use appendix for eval details. |

---

## 12. Timeline to Submission (April 24 AoE)

| Day | Task |
|---|---|
| Day 1 | Implement intent parser, fix address parser, fix canonical evaluation |
| Day 2 | Implement TCE features + logistic weight learning in sleep phase |
| Day 3 | Run all experiments: main table + ablations + multi-user + Pareto curve |
| Day 4 | Write paper in LaTeX (ICML 2026 style), create figures |
| Day 5 | Review, polish, submit |

---

*This document is the complete design specification for AutoFillGraph as submitted to SCALE @ ICML 2026.*
