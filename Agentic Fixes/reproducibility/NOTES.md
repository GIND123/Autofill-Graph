# AutoFillGraph Reproducibility Notes
# Generated: 2026-06-05

## Random seeds
All non-API scripts use random.seed(42) and numpy.random.seed(42) at the top.
The longitudinal simulation (07) and personal-KB benchmark (17) use fixed seeds
passed to their respective random generators.

## API non-determinism
Scripts 09, 10, 13 call Mistral / OpenAI APIs with temperature=0.0 to minimise
non-determinism.  Results may vary slightly across API versions.  Exact model
versions are pinned in 18_model_version_pin.py.

## Python version
Tested on Python 3.10.x.  Requirements in requirements.txt.

## Run order
Non-API scripts can be run in any order.
API scripts should run after non-API scripts (they read the same CSVs).
Script 08 (main results figure) should run last — it aggregates all results.
