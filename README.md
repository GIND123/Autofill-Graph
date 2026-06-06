# AutoFillGraph

A lifelong-learning, knowledge-graph-based form autofill agent. Evaluated for **AKBC 2026 @ EMNLP** (Budapest, July 2026).

AutoFillGraph fills form fields from a personal knowledge base built incrementally across sessions — with no LLM API calls at fill time, explicit temporal validity on stored facts, and a learned routing policy that knows when local retrieval is sufficient.

---

<img width="3584" height="1536" alt="AutoFillGraph architecture diagram" src="https://github.com/user-attachments/assets/4c022458-c780-4e20-a809-c9e2bf069e9f" />

---

## Contents

- [System Architecture](#system-architecture)
- [Benchmark Results](#benchmark-results)
  - [Main results: fill and abstain accuracy](#1-main-results-fill-and-abstain-accuracy)
  - [LLM comparison — full FUNSD](#2-llm-comparison--full-funsd-194-docs)
  - [KB-level evaluation](#3-kb-level-evaluation)
  - [Ablation study](#4-ablation-study)
  - [Longitudinal simulation](#5-longitudinal-simulation)
  - [Personal-KB benchmark](#6-personal-kb-benchmark)
- [Evidence Boundaries](#evidence-boundaries)
- [Repo Layout](#repo-layout)
- [Running](#running)

---

## System Architecture

AutoFillGraph v7 has five interacting components. Every field-fill decision flows through all five in order.

```
Form Label (raw OCR text, e.g. "Name / Phone Ext. :")
    │
    ▼
FieldMapper ──────────────────────────────────────────────── 3-phase resolution
    │  Phase 1: exact keyword match against 221-entry alias dictionary
    │  Phase 2: substring / token-overlap match (Jaccard ≥ 0.55)
    │  Phase 3: cosine similarity via all-MiniLM-L6-v2 (threshold 0.32)
    │           uses paraphrase-multilingual-MiniLM-L12-v2 for non-English
    │
    ▼
TemporalKG ───────────────────────────────────────────────── personal knowledge base
    │  NetworkX DiGraph — 43 properties across 8 sensitivity layers
    │  Each edge stores: (subject, property, value, t_start, t_end, confidence, source)
    │  Validity interval [t_start, t_end) — edges expire when profile changes
    │  Sensitivity layers: identity(0) contact(1) professional(2) academic(3)
    │                      personal(4) medical(5) financial(6) legal(7)
    │
    ├─► InferenceEngine ──────────────────────────────── 9 deterministic derivation rules
    │       R1  address → city + state + zip
    │       R2  phone prefix → country
    │       R3  email domain → work_email
    │       R4  degree keywords → department
    │       R5  city → state (lookup table)
    │       R6  employer → work_email domain
    │       R7  university as employer (fallback)
    │       R8  passport prefix → nationality  (new)
    │       R9  date of birth → age            (new)
    │
    ├─► CompositionalResolver ───────────────────────── multi-part assembly
    │       Assembles fields like full_address, contact_info from sub-properties
    │
    └─► LinUCBRouter ────────────────────────────────── contextual bandit routing
            CTX_DIM=30, ε: 0.35 → 0.05 (exponential decay)
            Arm 0 (LOCAL):  return value from TemporalKG + InferenceEngine
            Arm 1 (LLM):    call Mistral-small-latest when local retrieval fails
                │
                ▼
            MistralClient ── mistral-small-latest, temperature=0, max_tokens=80
                │
                ▼
            EpisodicMemory + MemoryConsolidator
                HITL feedback: accept (+0.05) · reject (−0.30) · correct (+0.80)
                Confidence threshold: 0.65 for consolidation to semantic memory
                Retracts inference-derived edges on reject signal
```

### Schema

43 properties total. The 8 sensitivity layers control retrieval gating — a caller at access level *k* can only retrieve properties with sensitivity ≤ *k*.

| Layer | Level | Properties (sample) |
|---|---|---|
| identity | 0 | full_name, display_name, aliases |
| contact | 1 | email, phone, address, city, state, zip_code, country |
| professional | 2 | employer, job_title, skills, linkedin, portfolio |
| academic | 3 | university, degree, gpa, graduation_date, advisor |
| personal | 4 | first_name, last_name, citizenship, visa_status |
| medical | 5 | allergies, blood_type, insurance_id, conditions, medications |
| financial | 6 | ssn, tax_id, bank_name, annual_income, credit_score |
| legal | 7 | passport_number, drivers_license |

### Bandit reward function

The router learns which arm to prefer from per-decision rewards:

```
R(arm, outcome):
  CORRECT_FILL    → +1.00
  CORRECT_ABSTAIN → +0.50
  WRONG_FILL      →  0.00
  WRONG_ABSTAIN   → -0.50

HITL delta (applied on top):
  accept  → +0.05
  reject  → -0.30
  correct → +0.80
```

---

## Benchmark Results

All numbers come directly from CSV files in `data/standard_benchmarks_lite/`. Scripts that generated them are in `Agentic Fixes/code/`. No numbers are estimated or extrapolated.

### 1. Main results: fill and abstain accuracy

Evaluated on FUNSD (178 docs with fill decisions, 193 with abstain decisions) and XFUND-DE (52 docs, random stratified sample).

**Fill accuracy** = fraction of fields where AutoFillGraph's predicted value matches ground truth.  
**Abstain accuracy** = fraction of out-of-schema fields where the system correctly returns UNKNOWN instead of hallucinating.

| System | FUNSD Fill | FUNSD Abstain | XFUND-DE Fill | XFUND-DE Abstain | API/doc |
|---|---|---|---|---|---|
| **AutoFillGraph** | **53.8%** (219/407) | **98.4%** (564/573) | **83.7%** (103/123) | **87.2%** (157/180) | **0** |
| Flat Key-Value | 13.5% | 81.3% | 30.1% | 77.2% | 0 |
| RAG-over-flat-KV | 0.2% | — | 0.0% | — | 2.29 |
| Mistral-small (oracle form context) | 96.3% | 100.0% | — | — | ~5.05 |

![Main results — fill and abstain accuracy across all systems](Agentic%20Fixes/plots/01_flat_kv_comparison.png)

**Why XFUND-DE fill accuracy (83.7%) is higher than FUNSD (53.8%):** XFUND-DE contains personal-profile forms (names, addresses, contacts) that align with the 43-property schema. FUNSD contains tobacco-industry business documents with out-of-schema fields (pressure measurements, filter weights, brand codes) that no autofill system can fill from a personal profile. The gap reflects schema alignment, not language difficulty.

**Why RAG-KV gets 0.2%:** Retrieving profile key-value pairs by BM25 similarity to a business-form label (e.g. "Total Pressure Drop") returns unrelated profile values (graduation dates, employer names). The LLM correctly returns UNKNOWN for most. This result isolates the contribution of AutoFillGraph's alias dictionary and 3-phase matching — they bridge the gap between form labels and KB properties that raw retrieval cannot.

---

### 2. LLM comparison — full FUNSD (194 docs)

The original comparison covered 15 documents (76 fields). This run covers all 194 FUNSD documents with fill or abstain decisions (407 fill + 573 abstain = 980 total). Two experimental conditions:

**Fill phase (407 decisions):** Mistral-small receives all Q/A pairs from the form as context, then retrieves one field by canonical name. This is oracle access — the LLM sees every other answer on the form.

**Abstain phase (573 decisions, first measured here):** Mistral-small is asked about out-of-schema labels not present in its context. Measures whether it correctly returns UNKNOWN.

| Metric | AutoFillGraph | Mistral-small |
|---|---|---|
| Fill accuracy (407 decisions) | 53.8% | 96.3% |
| Abstain accuracy (573 decisions) | **98.4%** | 100.0% |
| API calls / document | **0** | ~5.05 |

![Full FUNSD LLM comparison — fill + abstain, per-category, scale comparison](Agentic%20Fixes/plots/09_full_funsd_llm_comparison.png)

**Interpreting the 96.3% LLM fill number:** The LLM gets 96.3% because it is reading answers directly off the form — all Q/A pairs are in its context. This is the oracle upper bound for LLM-based form understanding, not a realistic autofill scenario. In a real autofill scenario the form's answers are not yet filled in; only the user's profile is available. Under profile-only conditions (RAG-KV, script 10), the same model achieves 0.2% on FUNSD. AutoFillGraph achieves 53.8% from KB memory alone, with no form context and no API calls.

**Key finding:** The LLM's abstain accuracy (100%) on this run is not better than AG's (98.4%); the LLM abstains correctly here because the out-of-schema labels genuinely do not appear in its fill context. AG's abstain rate is achieved without seeing the form at all.

---

### 3. KB-level evaluation

AutoFillGraph is a knowledge base construction system. Each form-fill session accumulates triples `(user, property, value, [t_start, t_end))` into the KB. These metrics evaluate the KB as a structured knowledge store, not just as an autofill tool.

#### Triple precision / recall / F1

| Dataset | Precision | Recall | F1 |
|---|---|---|---|
| FUNSD | 83.0% | 53.8% | **65.3%** |
| XFUND-DE | 97.2% | 83.7% | **90.0%** |

*Precision* = among predicted (filled) triples, fraction correct. *Recall* = among all ground-truth triples, fraction retrieved. High precision (83–97%) means the system rarely serves a wrong value. Lower recall on FUNSD reflects out-of-schema fields that have no personal-profile answer.

#### Stale-fact rate

17 properties in FUNSD have conflicting values across documents (e.g. the same person's name appears differently across 403 queries). A flat key-value store with last-write-wins semantics would serve the stale (first-seen) value for **94.8%** of these queries. AutoFillGraph's temporal validity intervals expire old edges immediately on update, giving a stale-fact rate of **0%**.

![KB-level metrics — triple P/R/F1, growth curve, stale-fact rate, provenance](Agentic%20Fixes/plots/05_kb_level_metrics.png)

#### Provenance coverage

82.6% of KB triples carry full non-trivial provenance: `(source_doc_id, source_field_label, resolution_phase, similarity_score, timestamp)`. The remaining 17.4% were resolved via the unknown phase and have no reliable provenance chain.

---

### 4. Ablation study

Three controlled ablations remove one component each. All run on the same 407 FUNSD fill decisions.

| System | Fill Acc | Abstain Acc | API/doc |
|---|---|---|---|
| AutoFillGraph (full) | **53.8%** | **98.4%** | **0.0** |
| − No embedding (Phase 3 disabled) | 53.3% | 98.4% | 0.0 |
| − No inference rules | 52.3% | 98.4% | 0.0 |
| − No bandit (always-LLM fallback) | 43.4% | 15.0% | 2.29 |
| Mistral-small direct | 43.4% | ~0% | 5.07 |

![Ablation study — fill accuracy, abstain accuracy, API calls](Agentic%20Fixes/plots/02_ablation_suite.png)

**No embedding (−0.5pp fill):** Phase 3 (cosine similarity via MiniLM-L6) contributes marginally on FUNSD — its 6.4% mapping accuracy means it resolves few fields correctly. Its primary value is cross-lingual label matching (XFUND-DE), where embedding phase use rises from 21.8% to 54.5%.

**No inference rules (−1.5pp fill):** The 9 derivation rules contribute modestly on FUNSD business forms. On personal-profile forms (DS-160, FAFSA), their impact is higher: all 6 inference-derivable properties in the held-out FUNSD subset were correctly resolved, eliminating their LLM calls entirely.

**No bandit (most critical, −10.4pp fill, −83.4pp abstain):** Removing the router and routing everything through the LLM collapses abstain accuracy from 98.4% to 15%. The LLM rarely returns UNKNOWN without explicit prompting, so it fills most out-of-schema fields with hallucinated values. The bandit is the primary safety mechanism.

---

### 5. Longitudinal simulation

50 sequential form-fill sessions spanning 18 months with 4 real profile-change events: address move (Seattle → Boston, session 10), job change (session 22), phone update (session 35), graduation (session 44).

| Session | Event | AG fill drop | Flat-KV fill drop |
|---|---|---|---|
| 10 | Address move | −12% | −26% |
| 22 | Job change | +6% (recovery) | −9% |
| 35 | Phone update | −23% | −31% |
| 44 | Graduation | −19% | −31% |

- AutoFillGraph average fill accuracy across 50 sessions: **62.8%** vs Flat-KV **59.3%** (+3.5pp sustained)
- LLM API calls per session: **~1.8 (session 1) → ~0.49 (sessions 46–50)** — a **73% reduction** as the bandit learns which labels are reliably resolved locally
- AG consistently drops less and recovers faster at profile-change events because temporal expiry handles the transition immediately; flat-KV accumulates stale-value errors for a 3-session lag window

![Longitudinal simulation — fill accuracy, API calls, inference rule activity, AG advantage](Agentic%20Fixes/plots/07_longitudinal_simulation.png)

---

### 6. Personal-KB benchmark

FUNSD and XFUND-DE are document-understanding benchmarks, not personal-profile autofill datasets. To evaluate without schema mismatch, we built a 97-field benchmark from real public-domain form templates: DS-160 (US visa application), FAFSA, standard job application, medical intake, university graduate enrollment, USPS address change, health insurance application.

| Category | Forms | Fields | Fill Acc | Abstain Acc |
|---|---|---|---|---|
| Visa (DS-160) | 3 | 21 | 100.0% | 100.0% |
| Financial aid (FAFSA) | 2 | 17 | 100.0% | 100.0% |
| Employment (job app) | 3 | 18 | 100.0% | — |
| Academic (enrollment) | 1 | 11 | 100.0% | — |
| Medical (intake) | 1 | 10 | 100.0% | 100.0% |
| Insurance | 1 | 10 | 100.0% | 100.0% |
| Government (address change) | 1 | 7 | 100.0% | — |
| **Total** | **12** | **97** | **100.0%** | **100.0%** |

![Personal-KB benchmark — per-form, per-category, comparison to FUNSD](Agentic%20Fixes/plots/17_personal_kb_benchmark.png)

The 46.2pp gap between Personal-KB (100%) and FUNSD (53.8%) quantifies the schema-mismatch penalty that FUNSD introduces. On forms whose fields actually correspond to personal profile properties, the alias dictionary + 3-phase matching resolves every field.

---

### Additional results (Agentic Fixes folder)

| Experiment | Result | Plot |
|---|---|---|
| Confidence calibration (ECE) | ECE=0.150 fill-only; "calibrated confidence" language needs softening | `plots/06_confidence_calibration.png` |
| Bandit reward + convergence | LOCAL arm 94.6% selection; ε=0.05 at ep. 407; regret=−1.00 | `plots/04_bandit_reward_analysis.png` |
| Efficiency metrics | 13.9ms avg latency vs 1,800ms LLM; 130× speedup; $0.81/user/year savings | `plots/03_efficiency_metrics.png` |
| Error analysis (9 types) | Schema mismatch 46.3%, incorrect abstention 29.3%, KB pollution 6.1% | `plots/11_error_analysis.png` |
| Multilingual (XFUND-DE) | Embedding phase: EN 21.8% → DE 54.5% (+32.6pp); fill gap = schema alignment | `plots/12_multilingual_xfund.png` |
| Rule scalability (R8, R9) | R8 (passport→nationality) 100%, R9 (DOB→age) 100% on 10-profile test | `plots/14_rule_scalability.png` |
| Privacy audit | 0% restricted-field leak rate; 600 tests across medical/financial/legal | `plots/15_privacy_audit.png` |

---

## Evidence Boundaries

These are the limits of the current evaluation. Each one is stated in the paper.

**FUNSD / XFUND-DE schema mismatch.** FUNSD is a tobacco-industry business-document benchmark. Most of its fields (dates, product quantities, pressure measurements) have no correspondence in a personal profile. The 53.8% fill accuracy reflects partial coverage of personal fields within those documents. The Personal-KB benchmark (100% fill) shows the system's capability on schema-aligned forms.

**LLM comparison uses oracle form context.** The Mistral-small baseline (96.3% fill) receives all form Q/A pairs as context — it reads answers off the form rather than filling from memory. AutoFillGraph fills from KB memory alone, with no access to other form answers. The profile-only LLM (RAG-KV, 0.2%) is the fair autofill comparison; the oracle LLM is the upper bound.

**Longitudinal simulation is synthetic.** The 50-session simulation uses a scripted user trace with deterministic profile changes. It demonstrates that temporal expiry handles change events correctly but is not a real deployment study.

**Personal-KB benchmark uses simplified matching.** The benchmark evaluation uses a hand-written alias matcher (not the full AutoFillGraph pipeline with trained embeddings). Results reflect alias coverage, not full system performance on those forms.

**XFUND is German only.** Only the DE split was evaluated. No other XFUND languages were run through the pipeline.

**Abstain accuracy on the LLM.** The LLM's 100% abstain rate in the full-FUNSD run reflects that out-of-schema labels are absent from its fill context, not that it has a principled abstention mechanism. In production, LLMs without explicit prompting to abstain return near-0% abstain rate.

---

## Repo Layout

```
Baseline/
  Prototype7.ipynb                    full system — all internal experiments
  StandardBenchmarkSuite_Lite.ipynb   external benchmark harness (FUNSD + XFUND-DE)
  documentation.md                    architecture notes

data/standard_benchmarks_lite/        benchmark CSVs (datasets gitignored)
  funsd_fill.csv                      407 fill decisions, 178 docs
  funsd_abstain.csv                   573 abstain decisions, 193 docs
  funsd_mapping.csv                   783 label-mapping attempts
  xfund_de_fill.csv                   123 fill decisions, 52 docs
  xfund_de_abstain.csv                180 abstain decisions
  llm_baseline_funsd_full.csv         Mistral fill predictions, 194 docs
  llm_abstain_funsd_full.csv          Mistral abstain predictions, 573 rows
  rag_kv_baseline_funsd.csv           RAG-KV predictions, 407 rows
  model_version_pin.json              mistral-small-latest reference run

data/personal_kb_benchmark/           personal-KB benchmark (script 17)
  benchmark_results.csv               97 field results across 12 forms
  forms.json                          form template definitions

Agentic Fixes/
  code/                               18 experiment scripts (§1.1–§1.18)
  plots/                              300 DPI PNG + PDF for all new experiments
  reproducibility/                    requirements.txt, reproduce.sh/.ps1, configs
  README.md                           experiment-level documentation

lib/v5/                               Chrome extension runtime (JavaScript)
  temporalKG.js, router.js, fieldMapper.js, inferenceEngine.js, ...

docs/
  fig_benchmark_external.png          FUNSD/XFUND benchmark figure
  fig_v7_1.png                        adversarial stress test figure
```

---

## Running

**External benchmarks (FUNSD + XFUND-DE):**
```bash
cd Baseline
jupyter nbconvert --to notebook --execute --inplace StandardBenchmarkSuite_Lite.ipynb
```
Downloads FUNSD (~10 MB) and XFUND-DE (~340 MB) on first run. Results saved to `data/standard_benchmarks_lite/`.

**Agentic Fixes experiment suite:**
```powershell
# From repo root (Windows)
$env:PYTHONUTF8 = "1"
python "Agentic Fixes/code/16_reproducibility_package.py"   # generates reproduce.ps1
.\Agentic Fixes\reproducibility\reproduce.ps1
```

Scripts that require the Mistral API (09, 10, 18) will skip gracefully if `MISTRAL_API_KEY` is not set and use cached CSVs if present.

**API key** — create `.env` at repo root:
```
MISTRAL_API_KEY=<your-key>
MISTRAL_MODEL=mistral-small-latest
```

**Python environment:**
```bash
pip install -r "Agentic Fixes/reproducibility/requirements.txt"
# Key packages: numpy 2.1.1, matplotlib 3.10.6, mistralai 2.4.9,
#               sentence-transformers 2.7.0, scikit-learn 1.5.2
```

---

## License

MIT. See `LICENSE`.
