# AutoFillGraph v7 — Implementation Notes

This document covers architecture, benchmark results, and evidence boundaries for the notebook track in `Baseline/`.

---

## System Overview

AutoFillGraph v7 is a **lifelong-learning form autofill agent** built around a typed temporal knowledge graph. It learns from user-provided or form-derived key-value pairs, stores them with temporal validity and sensitivity labels, and retrieves them through a three-phase field mapper and an adaptive routing policy.

The core question the system answers: *given a novel form label, can the agent correctly identify the corresponding property and return the stored value — without calling an LLM?*

---

## Architecture

### FieldMapper — three-phase resolution

1. **Exact keyword** — normalised string lookup against a 43-property alias dictionary
2. **Substring matching** — n-gram overlap with alias entries (handles OCR noise, truncations)
3. **Embedding similarity** — cosine similarity via `all-MiniLM-L6-v2` against property description vectors; threshold 0.32

`mapper.map(label)` returns `(prop, phase, score)` — a 3-tuple in Prototype7 (changed from 2-tuple in Prototype5).

### TemporalKG

NetworkX `DiGraph` with a `user` root node. Each property is stored as an `AttributeValue` with:
- `valid_from` / `valid_until` (ISO timestamps)
- `confidence` (float, shaped by HITL feedback)
- `sensitivity` (PUBLIC / RESTRICTED / ENCRYPTED)

`kg.current(max_sens)` returns only currently-valid values within the sensitivity ceiling.

### InferenceEngine — 7 guarded rules

Deterministic derivation of implicit fields:
1. `full_name` → `first_name`, `last_name`
2. `university` → `department` (from degree via regex)
3. `degree` → `department`
4. `address` → `city`, `state`, `zip_code`
5. `employer` + `job_title` → `bio` preamble
6. `graduation_date` → year extraction
7. `university` → `advisor` backlink guard

### CompositionalResolver

Assembles multi-part fields (`full_address`, `contact_info`, `academic_info`) from individual KG facts.

### LinUCBRouter

Contextual bandit (3 arms: local, llm_small, llm_large). Context vector: 24-dim label embedding + 6-dim domain one-hot (CTX_DIM=30). ε-greedy with decay 0.35→0.05.

In a 7-round learning simulation: 22 arm-0 (local) + 30 arm-1 (LLM) decisions, avg reward 0.78.

### EpisodicMemory + MemoryConsolidator

Each fill attempt generates a `FillEpisode`. Human-in-the-loop accept/reject feedback shapes property confidence values, which influence future retrieval confidence thresholds.

---

## Benchmark Results

### External: FUNSD + XFUND-DE

Run by `StandardBenchmarkSuite_Lite.ipynb` (Prototype7 backbone). Both datasets are public scanned-form benchmarks the system was not designed for.

| Dataset | Docs | Mapping Acc | Fill Acc | Abstain Acc | Embedder |
|---------|------|-------------|----------|-------------|----------|
| FUNSD | 199 | 0.425 | **0.538** | **0.984** | all-MiniLM-L6-v2 |
| XFUND-DE (≤60 docs) | 60 | 0.548 | **0.837** | **0.872** | paraphrase-multilingual-MiniLM-L12-v2 |

**Metric definitions:**
- `mapping_acc` — fraction of form labels correctly mapped to an AutoFillGraph property via 3-phase mapper
- `fill_acc` — fraction of Q/A pairs correctly retrieved after learning (`use_llm=False`, 0 API calls)
- `abstain_acc` — fraction of out-of-schema labels correctly returned as `UNKNOWN`

**Cross-domain caveat:** FUNSD/XFUND are scanned business documents (invoices, receipts, purchase orders). AutoFillGraph targets personal-profile autofill. The `mapping_acc` gap (42–55%) reflects this mismatch. `fill_acc` and `abstain_acc` are meaningful regardless: once a label is mapped, retrieval precision is high; and the system does not hallucinate values for unknown fields.

**Figure — External benchmarks and LLM baseline:**

![External Benchmark Summary](../docs/fig_benchmark_external.png)

### LLM Baseline Comparison (FUNSD, 15 docs)

Both systems receive the same Q/A pairs extracted from each form.

| System | Fill Acc | API Calls (fill) | n pairs |
|--------|----------|------------------|---------|
| AutoFillGraph v7 (KG + Routing) | **0.538** | **0** | 407 |
| Mistral-small (in-context only) | 0.434 | 76 | 76 |

AutoFillGraph achieves **+10.4% fill accuracy** over plain in-context LLM extraction, using zero LLM calls at fill time. The LLM baseline numbers cover only 15 docs (76 pairs); the AutoFillGraph numbers cover all 199 FUNSD docs.

### Internal: Adversarial Semantic Stress Test

12 held-out fields with paraphrased and semantically shifted labels (e.g. "reach you digitally" → `email`, "quantitative measure of academic performance" → `gpa`). Tests embedding generalisation beyond exact-match aliases.

| System | Accuracy |
|--------|----------|
| AutoFillGraph v7 | **100%** (12/12) |
| No Embedding | 42% (5/12) |
| Pure Lookup | 42% (5/12) |

**+58% lift over best non-embedding baseline.** This validates that the embedding similarity stage handles novel surface forms that keyword/substring matching cannot resolve.

**Figure — Adversarial embedding lift:**

![Adversarial Embedding Lift](../docs/fig_v7_1.png)

### Internal: FormBench v2

15 synthetic forms · 7 domains · 3 difficulty tiers · 55 total fields. Evaluated with `use_llm=False`.

| Metric | Value |
|--------|-------|
| Overall accuracy | **100%** (55/55) |
| API calls during evaluation | **0** |
| KG compression ratio | 51.3% |

Tier breakdown vs baselines (local path only):

| Tier | Browser | Pure Lookup | No Embedding | AutoFillGraph v7 |
|------|---------|-------------|--------------|-----------------|
| 1 (direct labels) | 60% | 100% | 100% | **100%** |
| 2 (alias labels) | 15% | 100% | 100% | **100%** |
| 3 (adversarial) | 33% | 93% | 93% | **100%** |

**Limitation:** FormBench is a synthetic suite designed to match the system's property schema. It demonstrates capability under ideal conditions, not generalisation. The external FUNSD/XFUND numbers are the more conservative and informative evidence.

**Soft metrics (Token F1, Char Sim, Semantic Sim) are all exactly 1.000** on FormBench because the system retrieves the exact stored string. These metrics add no signal here; they are meaningful only on the external benchmarks where surface-form variation exists.

---

## Notebook Structure

| Cell ID | Purpose |
|---------|---------|
| `cell-init` | Imports, schema (43 props, 8 layers), utility functions, soft-metric helpers |
| `cell-components` | TemporalKG, FieldMapper, LinUCBRouter, MistralClient, EmbeddingRetriever, InferenceEngine, CompositionalResolver |
| `cell-agent` | AutoFillAgent orchestration class, KG visualisation helpers |
| `cell-learning` | 7-round multi-domain learning simulation with HITL feedback |
| `cell-multiprofile` | Two-user demo (Govind + Devika) showing profile isolation |
| `cell-qa` | Long-form QA from KG facts with LLM revision pass |
| `cell-ocr` | OCR form parsing via Tesseract + multimodal document handling |
| `cell-formbench` | FormBench v2 full evaluation (15 forms, 4 baselines) |
| `cell-baselines` | Ablation: Browser / Pure Lookup / No Embedding vs AutoFillGraph |
| `cell-hard-eval` | Held-out adversarial semantic stress test |
| `cell-figures-v7` | Publication-quality figures (9 plots) |
| `cell-summary` | Final metrics summary table |

---

## Running

```bash
# Run all cells, write outputs back into the notebook
cd Baseline
jupyter nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=600 Prototype7.ipynb

# External benchmarks (downloads datasets on first run, ~340 MB)
jupyter nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=1200 StandardBenchmarkSuite_Lite.ipynb
```

`.env` at repo root must contain:
```
MISTRAL_API_KEY=<key>
MISTRAL_MODEL=mistral-small-latest
```

`load_env()` searches `./` then `../` so the notebook works whether run from `Baseline/` or the repo root.

---

## What Is and Is Not Established

**Measured and reproducible:**
- FormBench v2: 55/55 fields, 0 API calls, local path only
- Adversarial stress test: 100% vs 42% non-embedding baselines (+58% lift)
- FUNSD external: 53.8% fill acc, 98.4% abstain acc, 199 docs
- XFUND-DE external: 83.7% fill acc, 87.2% abstain acc, 60 docs
- LLM baseline comparison: +10.4% lift, 0 vs 76 API calls

**Not established by current evidence:**
- End-to-end mixed local+LLM router performance on held-out forms
- Browser extension production behaviour (extension runtime is v5, notebook is v7)
- Generalisation to languages other than English/German beyond the 60-doc XFUND sample
