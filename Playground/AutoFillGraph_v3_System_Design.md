# AutoFillGraph v3 Design Notes

## Purpose

This document is a design note, not a results summary. It describes intended structure and implementation direction for the notebook-era system. It should not be cited as evidence that a benchmark, router policy, or end-to-end workflow has been validated.

## Design Intent

The design centers on a memory-backed form autofill workflow with:

- structured field extraction
- field-label normalization and matching
- temporal user-memory storage
- deterministic composition and inference
- optional LLM-backed fallback behavior
- human review and correction

## Main Components

### Field Mapper

The mapper is intended to resolve labels through:

1. exact keyword matching
2. substring matching
3. embedding similarity

This is a design and implementation pattern visible in the notebook code. It is not, by itself, evidence of benchmark superiority.

### Temporal Memory

The system stores user facts in a temporal, typed memory structure so that:

- current values can be retrieved directly
- prior values can remain available as history
- sensitivity or domain gates can be applied during retrieval

### Local Resolution

Before any LLM-backed step, the design tries to use:

- direct property lookup
- compositional assembly
- rule-based derivation
- abstention when the required domain evidence is missing

### Router

The design includes a contextual routing component for selecting between local and LLM-backed paths. In this repo, that component should be understood as implemented or partially implemented notebook logic. This document does not treat it as a benchmark-validated contribution.

### Feedback Loop

The system is intended to support per-field user feedback:

- accept
- reject
- correct

That feedback updates stored values, confidence, and any logic that depends on prior outcomes.

## Boundaries

The current repo does not establish all of the following through a single benchmark:

- end-to-end mixed local-plus-LLM routing quality
- pure-LLM comparison on the same main benchmark
- production browser-extension behavior matching notebook behavior

Where the repo contains design language for those goals, treat it as intent rather than proof.

## Relationship to Current Repo

- the notebook track lives under `Baseline/`
- the currently shipped extension runtime still points to `v5`
- this design note reflects notebook-era architecture ideas more than the current extension packaging state

## Reading Guidance

If this design note conflicts with:

- notebook cells
- code paths
- current manifest wiring

prefer the code and notebooks.
