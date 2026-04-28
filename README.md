# AutoFillGraph

> Lifelong-learning knowledge-graph agent for adaptive form autofill.
> Current research notebook: `Prototype7`
> Current browser extension runtime: `v5`

## Overview

AutoFillGraph stores user information in a typed temporal knowledge graph and uses that memory to autofill web and document forms. The core system combines:

- three-phase field mapping: keyword -> substring -> MiniLM embedding similarity
- temporal semantic memory plus episodic feedback history
- deterministic composition and guarded inference
- a LinUCB router that prefers the cheapest sufficient path
- human-in-the-loop correction and confidence calibration

The repo currently has two different maturity levels:

- the research notebook track has progressed to `Baseline/Prototype7.ipynb`
- the shipped extension runtime in `manifest.json` still points to the `v5` implementation under `background_v5.js`, `content_v5.js`, `lib/v5/`, and `popup/popup_v5.*`

That distinction matters. Prototype 7 is not a separate end-to-end production runtime. It is a notebook-layer evolution built on top of the Prototype 6 core.

## Prototype Status

| Prototype | Scope |
|-----------|-------|
| `Prototype5.ipynb` | Canonical core system, FormBench v2, baselines, LLM QA path |
| `Prototype6.ipynb` | Prototype 5 plus soft metrics: `token_f1`, `char_sim`, `semantic_sim` |
| `Prototype7.ipynb` | Prototype 6 plus person-centric KG visualization, multi-profile demo, and expanded figure suite |

`Prototype7.ipynb` is assembled from `Prototype6.ipynb` by the local helper `Baseline/build_p7.py`. That builder:

- patches the notebook banner and KG plotting layout
- adds `TemporalKG.person_name()`
- replaces the KG snapshot renderer with a person-centric view
- adds a multi-profile demo with separate Govind and Devika profiles
- replaces the figure cell with a larger `v7` visualization suite
- reuses the Prototype 6 core, QA, OCR, FormBench, baseline, and summary cells

So the meaningful `v7` delta is presentation and demonstration scope, not a new benchmarked agent core.

## Key Reported Results

These are the reported numbers currently carried forward into the `v7` notebook from the `v5/v6` evaluation path.

| Metric | Value | Scope |
|--------|-------|-------|
| FormBench v2 accuracy | **100.0% (55/55)** | local path, `use_llm=False` |
| Correct abstentions | **100.0%** | domain-guard cases |
| Average retrieval compression | **51.3%** | measured on current graph scale |
| Token F1 | **1.000** | `v6` fill-row metric |
| Character similarity | **1.000** | `v6` fill-row metric |
| Semantic similarity | **1.000** | `v6` fill-row metric |
| Best lookup-baseline token F1 | `0.500` | no-embedding and pure-lookup baselines |
| Browser autofill semantic similarity | `0.323` | baseline comparison |
| LLM generation fill rate | **100.0% (4/4)** | notebook QA/demo path |
| Canonical properties | **43** | property registry |
| Guarded inference rules | **7** | inference engine |
| Bandit context dimensions | **30** | 24 label + 6 domain |

Important scope note: the headline FormBench result is still a local-path benchmark. It does not validate a mixed local-plus-LLM routing benchmark for `v7`.

## What Prototype 7 Adds

Prototype 7 adds notebook-facing improvements that are real, but narrower than a full system-version jump:

- person-centric KG figures with the active person at the center
- side-by-side multi-profile KG visualization
- a multi-profile learning/autofill demo
- enhanced plotting for adversarial lift, KG growth, compression, bandit behavior, route distribution, mapper phases, and temporal confidence

What it does not add:

- a new extension runtime
- a new mixed-path benchmark
- a pure-LLM baseline
- a new underlying benchmark dataset beyond the existing notebook stack

## Repository Layout

```text
Autofill-Graph/
|-- Baseline/
|   |-- Prototype5.ipynb
|   |-- Prototype6.ipynb
|   |-- Prototype7.ipynb
|   |-- StandardBenchmarkSuite_Lite.ipynb
|   |-- documentation.md
|   `-- build_p7.py              # local helper; now listed in .gitignore, still tracked today
|-- Playground/
|   `-- AutoFillGraph_v3_System_Design.md
|-- manifest.json
|-- background_v5.js
|-- content_v5.js
|-- lib/
|   |-- v5/
|   |-- knowledgeGraphManager.js # older extension artifact
|   `-- sampleDataLoader.js
|-- popup/
|   |-- popup_v5.html
|   |-- popup_v5.js
|   |-- popup.html               # older UI artifact
|   `-- popup.js                 # older UI artifact
|-- background.js                # older runtime artifact
|-- content.js                   # older runtime artifact
`-- README.md
```

## Extension Status

The extension entrypoints are still explicitly `v5`:

- `manifest.json` version is `5.0.0`
- service worker: `background_v5.js`
- content script: `content_v5.js`
- popup: `popup/popup_v5.html`
- libraries: `lib/v5/*.js`

The root README previously implied that the repo structure and extension runtime had already moved in lockstep with the notebook track. That was inaccurate. The extension and notebook are related, but they are not at the same version boundary right now.

## Quick Start

### Notebook path

Open `Baseline/Prototype7.ipynb` if you want the latest research notebook view.

Use `Prototype5` and `Prototype6` when you need the earlier canonical evaluation path or want to compare the `v7` additions against the prior notebook state.

### Extension path

1. Load the repo as an unpacked Chrome extension.
2. The active runtime will be the `v5` extension declared in `manifest.json`.
3. Configure the API key through the `v5` popup UI.

## Documentation Status

`Baseline/documentation.md` is still a detailed `v5/v6` technical reference. It remains useful for the core architecture, but it is not a full `Prototype7` changelog. The `v7`-specific changes live primarily in `Baseline/Prototype7.ipynb` and the local builder script that generated it.

## Current Gaps

- FormBench is synthetic and still primarily a notebook benchmark.
- The headline FormBench run is local-path only: `use_llm=False`.
- There is still no pure-LLM baseline for the adaptive-routing claim.
- The extension runtime has not been upgraded from `v5` to a `v7`-aligned implementation.
- `Prototype7` mostly advances visualization and demonstration, not the validated core benchmark stack.

## License

MIT. See `LICENSE`.
