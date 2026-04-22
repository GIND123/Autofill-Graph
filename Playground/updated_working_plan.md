# AutoFillGraph: Updated Working Plan for a Knowledge-Graph-Grounded Agent with Adaptive Memory for Intelligent Form Autofill

## SCALE @ ICML 2026 - Updated Implementation Plan

---

## 1. Vision Statement

**What we are building:** An intelligent autofill agent that learns a user's personal information as a temporal knowledge graph and progressively fills forms across domains such as jobs, academics, visas, medical intake, and finance with improving accuracy and lower marginal compute over time.

**What changed from the earlier draft:** The implementation path is now explicitly optimized for a practical v1. We are **not** using `LayoutLMv3`. Perception is now:
- HTML parsing for normal web forms
- Tesseract-based local OCR for screenshots, scanned forms, and image-heavy inputs
- Mistral vision/OCR fallback only when local extraction is weak or the document structure is too noisy

**Why this matters:** This preserves the core research contribution while removing a heavy component that would otherwise require extra engineering and likely fine-tuning to be useful in practice.

**The research question remains:** *How should an agent structure, query, and evolve its personal knowledge graph to maximize form-fill accuracy while minimizing LLM compute, and how do these tradeoffs change as the graph grows?*

---

## 2. Why This Fits SCALE Perfectly

| SCALE Topic | AutoFillGraph Connection |
|---|---|
| **Memory of Agents** | Personal KG = long-term semantic memory. Working memory = current form session. Episodic memory = fill history with user feedback. Sleep-wake consolidation strengthens stable facts and retracts weak ones. |
| **Efficient Agentic AI** | Graph-topology confidence estimation enables most `LOOKUP` fields to be filled locally with zero LLM cost. Only ambiguous or generative cases trigger Mistral. |
| **Scaling of Multimodal Agents** | Perception is multimodal without requiring heavy local model serving: HTML parsing for web, Tesseract for local OCR, and Mistral vision fallback for difficult images/PDFs. |
| **Evaluation and Benchmarking** | PersonalFormBench still supports accuracy-cost analysis across domains and profile densities. The new implementation path makes the benchmark easier to run repeatedly. |
| **Multimodal Agents for Planning** | Perceive form fields -> classify intent -> query memory -> fill -> collect feedback -> update memory and routing thresholds. |

---

## 3. System Architecture

```text
+----------------------------------------------------------------------------------+
|                             AUTOFILLGRAPH AGENT                                  |
|                                                                                  |
|  LAYER 1: PERCEPTION                                                             |
|                                                                                  |
|    Inputs                                                                        |
|      - Web form DOM                                                              |
|      - PDF / scanned document                                                    |
|      - Screenshot / phone photo                                                  |
|                                                                                  |
|    Extraction routes                                                             |
|      - HTML parser for labels, placeholders, aria-labels, nearby text            |
|      - Tesseract OCR for local image text extraction                             |
|      - Mistral vision/OCR fallback when local OCR confidence is low              |
|                                                                                  |
|    Output                                                                        |
|      - Raw field labels                                                          |
|      - OCR text                                                                  |
|      - Optional confidence / source metadata                                     |
|                                                                                  |
|  LAYER 2: UNDERSTANDING                                                          |
|                                                                                  |
|    One batched Mistral call per form to classify each field into:                |
|      - LOOKUP(entity, attribute)                                                 |
|      - GENERATE(topic)                                                           |
|      - DOCUMENT(doc_type)                                                        |
|      - UNKNOWN                                                                   |
|                                                                                  |
|  LAYER 3: MEMORY                                                                 |
|                                                                                  |
|    3a. Semantic Memory                                                           |
|      - Temporal knowledge graph                                                  |
|      - Typed entities, typed relations, provenance, sensitivity                  |
|                                                                                  |
|    3b. Episodic Memory                                                           |
|      - Per-field fills, feedback, route used, TCE features                       |
|                                                                                  |
|    3c. Working Memory                                                            |
|      - Current session context, form domain, partial fills                       |
|                                                                                  |
|    3d. Document Memory                                                           |
|      - File paths + CLIP embeddings for upload matching                          |
|                                                                                  |
|  LAYER 4: ROUTING                                                                |
|                                                                                  |
|    TCE computes structural confidence from graph features:                       |
|      - high confidence  -> local fill                                            |
|      - medium confidence -> local fill + review flag                             |
|      - low confidence   -> Mistral-assisted fill                                 |
|                                                                                  |
|  LAYER 5: ACTION                                                                 |
|                                                                                  |
|    Field output includes:                                                        |
|      - value                                                                     |
|      - status                                                                    |
|      - confidence                                                                |
|      - evidence chain                                                            |
|      - route used                                                                |
|                                                                                  |
|  LAYER 6: FEEDBACK + CONSOLIDATION                                               |
|                                                                                  |
|    Wake phase                                                                    |
|      - store corrections                                                         |
|      - log episode                                                               |
|      - retract bad inferences                                                    |
|                                                                                  |
|    Sleep phase                                                                   |
|      - calibrate TCE                                                             |
|      - strengthen verified facts                                                 |
|      - decay stale facts                                                         |
|      - blacklist failed rules                                                    |
|      - rebuild retrieval indices                                                 |
+----------------------------------------------------------------------------------+
```

### Key Architectural Decision

The original draft assumed a local form-aware vision model. The updated plan removes that dependency. The production path is:

1. `HTML parser` first when the input is a normal web page.
2. `Tesseract OCR` first when the input is image-heavy.
3. `Mistral vision/OCR` only as a fallback when local extraction is insufficient.

This keeps the system implementable now and still preserves a strong efficiency story because fallback perception is conditional rather than mandatory.

---

## 4. Complete Autofill Pipeline - Step by Step

### Step 1: User Onboarding (Learn Phase)

The user provides initial data through profile forms or uploaded documents.

```text
User inputs:
  Profile form -> {"name": "Priya Sharma", "email": "priya@mit.edu", ...}
  Resume PDF   -> text extracted locally; fallback to Mistral OCR if needed
  Transcript   -> stored as a document for future upload fields
  Passport     -> stored as a document; OCR extracts passport number

System actions:
  1. Store each fact as a graph attribute with metadata
  2. Create typed entity nodes and typed relation edges
  3. Run safe inference rules
  4. Encode uploaded documents with CLIP for document matching
  5. Build embedding retrieval index over graph triples
  6. Log provenance: source, timestamp, confidence, sensitivity
```

### Step 2: Form Encounter (Autofill Phase)

Example Greenhouse application:

```text
Form fields:
  ["Full Name", "Email", "Phone", "Resume/CV",
   "Current Company", "Current Title", "LinkedIn URL",
   "Why are you interested in this role? (2-3 sentences)"]
```

**Phase 1 - Perception**

- If fields are present in the DOM, use HTML extraction directly.
- If the input is a screenshot or scanned PDF page, run Tesseract locally.
- If OCR output is weak, incomplete, or misaligned, invoke Mistral vision/OCR fallback.

**Phase 2 - Understanding**

One Mistral call parses all field labels:

```json
[
  {"field": "Full Name", "intent": "LOOKUP", "entity": "user", "attr": "full_name"},
  {"field": "Email", "intent": "LOOKUP", "entity": "user", "attr": "email"},
  {"field": "Phone", "intent": "LOOKUP", "entity": "user", "attr": "phone"},
  {"field": "Resume/CV", "intent": "DOCUMENT", "doc_type": "resume"},
  {"field": "Current Company", "intent": "LOOKUP", "entity": "user", "attr": "employer"},
  {"field": "Current Title", "intent": "LOOKUP", "entity": "user", "attr": "job_title"},
  {"field": "LinkedIn URL", "intent": "LOOKUP", "entity": "user", "attr": "linkedin"},
  {"field": "Why interested?", "intent": "GENERATE", "topic": "motivation"}
]
```

**Phase 3 - Memory Query + TCE Routing**

| Field | Intent | Graph Has? | TCE Features | Route |
|---|---|---|---|---|
| Full Name | `LOOKUP(user, full_name)` | Yes | strong provenance, verified, direct | LOCAL |
| Email | `LOOKUP(user, email)` | Yes | strong provenance, direct | LOCAL |
| Phone | `LOOKUP(user, phone)` | Yes | direct, slightly older | LOCAL |
| Resume/CV | `DOCUMENT(resume)` | Yes | CLIP match | DOCUMENT |
| Current Company | `LOOKUP(user, employer)` | Yes | direct + corroborated | LOCAL |
| Current Title | `LOOKUP(user, job_title)` | Yes | direct | LOCAL |
| LinkedIn | `LOOKUP(user, linkedin)` | Yes | direct but lightly corroborated | LOCAL |
| Why interested? | `GENERATE(motivation)` | No | not applicable | MISTRAL |

**Expected result**

```text
6 local fills + 1 document match + 1 Mistral generation call
```

**Phase 4 - User Review**

- Accepts correct fields
- Edits weak generated content when needed
- Feedback is logged into episodic memory
- TCE features are recorded for future calibration

### Step 3: Form Encounter #2 (Cross-Domain - Visa Application)

The user later fills a visa form. Identity, contact, education, and passport data are reused from the graph. Fields such as "Purpose of travel" or "Brief description of visit" are still handled as `GENERATE`.

**Important example:** "Name and address of the educational sponsor" should resolve to the sponsoring institution, not the user's own name. This is exactly the class of failure that the intent parser fixes.

### Step 4: Temporal Update

```text
Old:
  address = "77 Mass Ave, Cambridge, MA 02139" [EXPIRED]

New:
  address = "1 Hacker Way, Menlo Park, CA 94025" [CURRENT]
```

Next time a form asks for `City`, the system should fill `Menlo Park`, while still retaining complete history in semantic memory.

### Step 5: Sleep Consolidation (After 10+ Episodes)

The system periodically consolidates memory:

- attributes accepted repeatedly become `verified = true`
- stale or low-value facts decay
- rejected inference chains are blacklisted
- TCE is recalibrated using episodic outcomes
- retrieval indices are refreshed

---

## 5. What Makes This Novel

### vs. Browser Autofill (Chrome, Safari, LastPass)

Browser autofill is a flat key-value system tied to a narrow set of standard fields. AutoFillGraph stores arbitrary typed facts and relations, so it can handle non-standard fields like advisor name, visa status, insurance information, or research interests.

### vs. Zep/Graphiti

Zep and Graphiti focus on agent memory storage and retrieval. AutoFillGraph adds intent-aware field understanding and topology-based compute routing for a concrete task with measurable ground truth.

### vs. Mem0

Mem0 offers memory persistence and retrieval. AutoFillGraph adds field-intent parsing, TCE routing, temporal KG semantics, and form-specific evaluation.

### vs. BEST-Route / RouteLLM

Those systems route based on prompt difficulty. AutoFillGraph routes based on the density and trustworthiness of the agent's own memory. The same field may route differently depending on memory state.

### vs. RAG for form-filling

Flat retrieval loses temporal validity, typed relations, and inference chains. AutoFillGraph preserves graph structure and can distinguish current facts from expired ones while supporting evidence-aware local decisions.

---

## 6. Evaluation Design

### PersonalFormBench

| Property | Value |
|---|---|
| Forms | 13 forms from 5 real-world platforms |
| Fields | 106 total field labels |
| Sources | Greenhouse, Workday, CommonApp, DS-160, Schengen, UK Tier 4, hospital intake, specialist referral, W-4, FAFSA |
| Tiers | T1 standard labels, T2 synonym-heavy labels, T3 adversarial or compound labels |
| Domains | Job, Academic, Visa, Medical, Financial |
| Users | 6 profiles across sparse, medium, dense, and cross-domain settings |

**Critical scoring rule:** Ground truth is canonical and system-independent. If `Employer's Name` is filled with `full_name`, it is wrong even if the graph contains that value.

### Baselines (5 systems)

| Baseline | Description | Characteristics |
|---|---|---|
| **Browser Autofill** | WHATWG autocomplete + fuzzy matching | Flat KV, no LLM |
| **Pure Lookup** | Keyword/substring matching against KG | No intent parsing |
| **RAG** | Flat retrieval of user facts + batch LLM fill | No graph structure |
| **Pure LLM** | Dump all user attributes to Mistral and ask it to fill everything | Highest cost |
| **Mem0-style** | Vector store + basic entity tracking | No TCE routing |

### Ablation Study (4 configs)

| Ablation | What's Disabled | Tests |
|---|---|---|
| `-Intent Parser` | replace intent parsing with keyword/embedding mapping | value of semantic field understanding |
| `-TCE Routing` | send all unresolved fields to Mistral | value of topology-guided routing |
| `-Sleep Consolidation` | no offline learning or calibration | value of progressive memory refinement |
| `-Graph Structure` | flatten memory into key-value attributes | value of typed temporal graph structure |

### Metrics

| Metric | What It Measures |
|---|---|
| Fill Accuracy | percent of fields correctly filled |
| Per-Tier Accuracy | T1, T2, T3 breakdown |
| API Calls | total Mistral invocations |
| Tokens Used | total LLM compute |
| Local Fill Rate | percentage of fields filled without LLM |
| OCR Fallback Rate | how often local OCR was insufficient |
| Latency per Field | wall-clock efficiency |
| Multi-user mean +- std | robustness across profile densities |

### The Signature Experiment: Accuracy-Cost Pareto at Different Graph Densities

Sweep TCE threshold `theta` from all-LLM to mostly-local. Run this for sparse, medium, and dense user profiles.

```text
Accuracy
 1.0 |                 dense ********
 0.9 |            medium  ***** 
 0.8 |       sparse   ****
 0.7 |
 0.6 +------------------------------------------
      0    2    4    6    8   10   12   14
                  API calls
```

**Expected finding:** as the graph becomes denser and better verified, the best operating point shifts toward more local fills and fewer Mistral calls.

---

## 7. Paper Structure (3 Pages + References)

### Page 1

**Title:** AutoFillGraph: Knowledge-Graph-Grounded Agents with Topology-Aware Memory for Adaptive Form Autofill

**Abstract direction:** Emphasize that the system is a memory-grounded agent with topology-aware routing and a practical multimodal perception stack: DOM parsing, local OCR, and conditional Mistral vision fallback.

**Introduction focus:**
- form filling is common and repetitive
- browser autofill is too limited
- pure LLM filling is expensive and memory-poor
- AutoFillGraph combines structured memory, intent parsing, and topology-aware routing

### Page 2

**Method contributions:**

**2.1 Personal Knowledge Graph with Temporal Provenance**
- typed entities and relations
- temporal validity windows
- provenance and sensitivity layers
- guarded inference with retraction support

**2.2 Intent-Aware Field Understanding**
- one Mistral parse per form
- `LOOKUP / GENERATE / DOCUMENT / UNKNOWN`
- solves vocabulary mismatch

**2.3 Topology Confidence Estimator + Sleep-Wake Consolidation**
- 7-feature vector from graph structure
- logistic-style confidence calibration
- offline consolidation and reindexing

### Page 3

**Experiments**
- main comparison table
- ablation table
- Pareto curve across graph densities
- discussion of practical perception choices

**Discussion**
- graph topology can act as a free router
- no heavy vision fine-tuning is required for v1
- the multimodal perception path is practical now
- future work can still explore trained document-understanding models later

### References (separate page, does not count toward 3-page limit)

Key citation categories remain the same:
- agent memory / temporal KG
- routing / adaptive compute
- sleep-inspired consolidation
- multimodal retrieval
- form understanding / document understanding

---

## 8. Implementation Notes

### What to Keep from AutoFillGraph v3

- Semantic memory with typed temporal graph structure
- Episodic memory with feedback logging
- Working memory for session state
- Deterministic resolvers and safe inference rules
- CLIP-based document matching
- MiniLM-based embedding retrieval
- Sensitivity layers and privacy gating
- Extension-side graph management and existing Mistral integration

### What to Replace

- Field mapper based on keyword/embedding heuristics -> **Mistral intent parser**
- LinUCB bandit router -> **Topology Confidence Estimator**
- Naive address parsing -> **structured parser**
- Self-referential feedback simulation -> **canonical ground-truth scoring**
- Any assumption of `LayoutLMv3` in perception -> **HTML + Tesseract + Mistral fallback**

### What to Add

- OCR confidence heuristics for deciding when fallback is needed
- Mistral vision/OCR fallback path for images and difficult PDFs
- TCE feature extraction
- TCE calibration during sleep
- canonical scoring pipeline
- intent parse caching by form template
- better retry/backoff handling for all Mistral calls

### Models Used

- **Mistral Small**: intent parsing and generated field filling
- **Mistral vision/OCR-capable API path**: OCR fallback for noisy images/PDFs
- **MiniLM-L6-v2**: embedding retrieval over graph facts
- **CLIP ViT-B/32**: document and upload matching
- **Tesseract OCR**: primary local OCR engine

### Training Requirements

**For v1, no mandatory training is required.**

- Tesseract is used off the shelf
- MiniLM is pretrained
- CLIP is pretrained
- Mistral is API-served
- TCE can start with fixed weights or simple heuristics, then be calibrated later

**Optional later-stage training**

- TCE can be calibrated from episodic logs using logistic regression
- Perception-specific supervised fine-tuning is not required for the initial system

---

## 9. Figures for the Paper

### Figure 1: Architecture Diagram (Page 1)

Show:

```text
Form Input -> Perception (DOM / Tesseract / Mistral fallback)
           -> Intent Parser
           -> Memory (KG + episodic + document)
           -> TCE Routing
           -> Local / Mistral / Document Fill
           -> Feedback
           -> Consolidation
```

### Figure 2: Accuracy-Cost Pareto Curve (Page 3)

Three curves:
- sparse profile
- medium profile
- dense profile

Annotate the best threshold for each.

### Figure 3: Ablation Bar Chart (Page 3, small)

Show the drop from:
- removing intent parser
- removing TCE routing
- removing sleep consolidation
- removing graph structure

---

## 10. Talking Points for Reviewers

**Q: "Isn't this just a memory wrapper around an LLM?"**  
A: No. The key novelty is not just storing facts. It is using graph topology as a routing signal and using structured field understanding for objective task performance.

**Q: "Why remove LayoutLMv3?"**  
A: Because the system does not need a heavy, fine-tuned local vision model to demonstrate the research contribution. HTML parsing plus local OCR plus conditional Mistral fallback is a cleaner, more practical implementation path.

**Q: "Does this still count as multimodal?"**  
A: Yes. The system handles HTML forms, PDFs, screenshots, and uploaded documents, and routes across text, OCR, and image/document embeddings.

**Q: "Why not just send everything to Mistral?"**  
A: Because cost, latency, and privacy are worse. The graph lets the agent fill many fields locally and reserve LLM calls for ambiguity and generation.

---

## 11. Risk Assessment

| Risk | Mitigation |
|---|---|
| Local OCR quality may be noisy | Use HTML extraction whenever possible, then Tesseract, then Mistral fallback only when needed |
| Mistral OCR fallback may add latency | Cache OCR output by file hash or page hash |
| Intent parser could still misclassify niche fields | Log parser output, keep `UNKNOWN`, and support user correction |
| TCE may be weak initially | Start with rule-based thresholds and calibrate from feedback later |
| API outages or rate limits | Use retry with exponential backoff and preserve partial local functionality |
| 3-page paper space is tight | Keep implementation detail short and focus on routing, memory, and evaluation |

---

## 12. Timeline to Submission / Implementation

| Phase | Task |
|---|---|
| Phase 1 | Finalize field extraction path: DOM first, Tesseract second, Mistral fallback third |
| Phase 2 | Implement intent parser and structured canonical evaluation |
| Phase 3 | Implement TCE features and basic threshold routing |
| Phase 4 | Add episodic logging, sleep calibration, and caching |
| Phase 5 | Run benchmark tables, ablations, and Pareto curves |
| Phase 6 | Write paper and prepare figures |

---

*This document is the updated working plan for the implementation-aligned version of AutoFillGraph. It preserves the original research structure while reflecting the current engineering decisions: no LayoutLMv3, no mandatory training, and a hybrid perception stack centered on HTML parsing, Tesseract, and conditional Mistral fallback.*
