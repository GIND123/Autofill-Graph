"""
16_reproducibility_package.py  —  AutoFillGraph §1.16
Generates the reproducibility package:
  - requirements.txt with pinned versions
  - reproduce.sh  (Linux/Mac) and reproduce.ps1 (Windows)
  - config.json   per experimental run
  - Validates that all data files exist
  - Prints seeding instructions

No API calls, no plots.

Run:  python "Agentic Fixes/code/16_reproducibility_package.py"
"""

import json, subprocess, sys
from pathlib import Path
from datetime import date

ROOT      = Path(__file__).resolve().parents[2]
DATA_DIR  = ROOT / "data" / "standard_benchmarks_lite"
REPRO_DIR = ROOT / "Agentic Fixes" / "reproducibility"
REPRO_DIR.mkdir(parents=True, exist_ok=True)

# ── 1. Pin Python package versions ────────────────────────────────────────
print("=== Reproducibility Package (§1.16) ===\n")
print("Detecting installed package versions...")

REQUIRED_PACKAGES = [
    "mistralai", "openai", "sentence-transformers", "numpy", "matplotlib",
    "scipy", "scikit-learn", "pandas", "difflib", "python-dotenv",
]

# Get actual installed versions
installed = {}
try:
    result = subprocess.run(
        [sys.executable, "-m", "pip", "freeze"],
        capture_output=True, text=True, timeout=30
    )
    for line in result.stdout.splitlines():
        if "==" in line:
            pkg, ver = line.split("==", 1)
            installed[pkg.lower().replace("-", "_")] = f"{pkg}=={ver.strip()}"
except Exception as e:
    print(f"  pip freeze failed: {e}")

reqs_lines = []
for pkg in ["numpy", "matplotlib", "scipy", "scikit-learn", "pandas",
            "sentence-transformers", "mistralai", "openai", "python-dotenv",
            "difflib"]:
    key = pkg.lower().replace("-", "_")
    if key in installed:
        reqs_lines.append(installed[key])
        print(f"  {pkg}: {installed[key].split('==')[1]}")
    else:
        # Check alternative key forms
        found = False
        for k, v in installed.items():
            if pkg.replace("-","").lower() in k:
                reqs_lines.append(v)
                print(f"  {pkg}: {v.split('==')[1]} (via {k})")
                found = True
                break
        if not found:
            # Use known-good versions
            fallback = {
                "numpy": "numpy==1.24.4", "matplotlib": "matplotlib==3.7.3",
                "scipy": "scipy==1.11.3", "scikit-learn": "scikit-learn==1.3.1",
                "pandas": "pandas==2.0.3", "sentence-transformers": "sentence-transformers==2.2.2",
                "mistralai": "mistralai==2.4.9", "openai": "openai==1.35.7",
                "python-dotenv": "python-dotenv==1.0.0",
            }.get(pkg, f"{pkg}>=1.0")
            reqs_lines.append(fallback)
            print(f"  {pkg}: (not found, using {fallback})")

reqs_content = "\n".join(sorted(set(reqs_lines))) + "\n"
(REPRO_DIR / "requirements.txt").write_text(reqs_content, encoding="utf-8")
print(f"\nWrote: reproducibility/requirements.txt")

# ── 2. Experiment configs ──────────────────────────────────────────────────
CONFIGS = {
    "01_flat_kv_baseline": {
        "script": "Agentic Fixes/code/01_flat_kv_baseline.py",
        "description": "Flat key-value baseline on FUNSD + XFUND-DE",
        "expected_outputs": ["data/standard_benchmarks_lite/funsd_fill.csv"],
        "random_seed": 42,
        "requires_api": False,
        "expected_results": {"funsd_fill_acc": 13.5, "xfund_fill_acc": 30.1},
    },
    "02_ablation_suite": {
        "script": "Agentic Fixes/code/02_ablation_suite.py",
        "description": "No-embedding, no-inference, no-bandit ablations",
        "expected_outputs": [],
        "random_seed": 42,
        "requires_api": False,
        "expected_results": {"no_bandit_fill_acc": 43.4, "no_inference_fill_acc": 52.3},
    },
    "03_efficiency_metrics": {
        "script": "Agentic Fixes/code/03_efficiency_metrics.py",
        "description": "API call + latency efficiency analysis",
        "random_seed": 42,
        "requires_api": False,
        "expected_results": {"speedup_ratio": 130, "annual_savings_usd": 0.81},
    },
    "04_bandit_reward_analysis": {
        "script": "Agentic Fixes/code/04_bandit_reward_analysis.py",
        "description": "LinUCB reward formalization and convergence",
        "random_seed": 42,
        "requires_api": False,
        "expected_results": {"local_arm_pct": 94.6, "final_epsilon": 0.05},
    },
    "05_kb_level_metrics": {
        "script": "Agentic Fixes/code/05_kb_level_metrics.py",
        "description": "Triple P/R/F1, stale-fact rate, provenance coverage",
        "random_seed": 42,
        "requires_api": False,
        "expected_results": {
            "funsd_triple_f1": 65.3, "xfund_triple_f1": 90.0,
            "stale_fact_flat_kv": 94.8, "stale_fact_ag": 0.0,
        },
    },
    "06_confidence_calibration": {
        "script": "Agentic Fixes/code/06_confidence_calibration.py",
        "description": "Confidence calibration ECE measurement",
        "random_seed": 42,
        "requires_api": False,
        "expected_results": {"ece_raw": 0.150},
    },
    "07_longitudinal_simulation": {
        "script": "Agentic Fixes/code/07_longitudinal_simulation.py",
        "description": "50-session longitudinal simulation, 4 profile changes",
        "random_seed": 42,
        "requires_api": False,
        "expected_results": {"ag_avg_fill_acc": 62.8, "api_reduction_pct": 73.0},
    },
    "09_full_funsd_llm_comparison": {
        "script": "Agentic Fixes/code/09_full_funsd_llm_comparison.py",
        "description": "Full FUNSD Mistral-small baseline (178 docs / 407 fields)",
        "random_seed": None,
        "requires_api": True,
        "api_model": "mistral-small-latest",
        "expected_outputs": ["data/standard_benchmarks_lite/llm_baseline_funsd_full.csv"],
        "expected_results": {"mistral_fill_acc_full": "see csv"},
    },
    "10_rag_kv_baseline": {
        "script": "Agentic Fixes/code/10_rag_kv_baseline.py",
        "description": "RAG-over-flat-KV (BM25 + Mistral) on FUNSD + XFUND-DE",
        "random_seed": None,
        "requires_api": True,
        "api_model": "mistral-small-latest",
        "expected_outputs": [
            "data/standard_benchmarks_lite/rag_kv_baseline_funsd.csv",
            "data/standard_benchmarks_lite/rag_kv_baseline_xfund_de.csv",
        ],
    },
    "11_error_analysis": {
        "script": "Agentic Fixes/code/11_error_analysis.py",
        "description": "Error categorization across 9 error types",
        "random_seed": 42, "requires_api": False,
    },
    "12_multilingual_xfund": {
        "script": "Agentic Fixes/code/12_multilingual_xfund.py",
        "description": "XFUND-DE full + XFUND-FR simulation",
        "random_seed": 42, "requires_api": False,
    },
    "13_gpt4o_mini_baseline": {
        "script": "Agentic Fixes/code/13_gpt4o_mini_baseline.py",
        "description": "GPT-4o-mini second LLM baseline on full FUNSD",
        "random_seed": None, "requires_api": True, "api_model": "gpt-4o-mini",
        "expected_outputs": ["data/standard_benchmarks_lite/gpt4o_mini_baseline_funsd.csv"],
    },
    "14_rule_scalability": {
        "script": "Agentic Fixes/code/14_rule_scalability.py",
        "description": "9-rule timing + LLM-call reduction on held-out subset",
        "random_seed": 42, "requires_api": False,
    },
    "15_privacy_audit": {
        "script": "Agentic Fixes/code/15_privacy_audit.py",
        "description": "Sensitivity-gating leak audit on 50 synthetic profiles",
        "random_seed": 42, "requires_api": False,
    },
    "17_personal_kb_benchmark": {
        "script": "Agentic Fixes/code/17_personal_kb_benchmark.py",
        "description": "Personal-KB autofill benchmark (DS-160, FAFSA, job app)",
        "random_seed": 42, "requires_api": False,
    },
    "18_model_version_pin": {
        "script": "Agentic Fixes/code/18_model_version_pin.py",
        "description": "Pin Mistral model version + reference run",
        "random_seed": None, "requires_api": True, "api_model": "mistral-small-latest",
    },
}

config_path = REPRO_DIR / "experiment_configs.json"
config_path.write_text(json.dumps(CONFIGS, indent=2), encoding="utf-8")
print(f"Wrote: reproducibility/experiment_configs.json  ({len(CONFIGS)} configs)")

# ── 3. reproduce.sh (Linux/Mac) ────────────────────────────────────────────
SH_CONTENT = """#!/usr/bin/env bash
# AutoFillGraph — Reproducibility script
# Runs all non-API experiments to reproduce main results.
# For API experiments, set MISTRAL_API_KEY and OPENAI_API_KEY first.
set -e
export PYTHONUTF8=1

echo "=== AutoFillGraph Reproducibility ==="
echo "Python: $(python --version)"
echo "Date:   $(date)"
echo ""

pip install -r "Agentic Fixes/reproducibility/requirements.txt" -q

# Non-API experiments (run without API keys)
for script in \\
    "Agentic Fixes/code/01_flat_kv_baseline.py" \\
    "Agentic Fixes/code/02_ablation_suite.py" \\
    "Agentic Fixes/code/03_efficiency_metrics.py" \\
    "Agentic Fixes/code/04_bandit_reward_analysis.py" \\
    "Agentic Fixes/code/05_kb_level_metrics.py" \\
    "Agentic Fixes/code/06_confidence_calibration.py" \\
    "Agentic Fixes/code/07_longitudinal_simulation.py" \\
    "Agentic Fixes/code/11_error_analysis.py" \\
    "Agentic Fixes/code/12_multilingual_xfund.py" \\
    "Agentic Fixes/code/14_rule_scalability.py" \\
    "Agentic Fixes/code/15_privacy_audit.py" \\
    "Agentic Fixes/code/17_personal_kb_benchmark.py"; do
    echo "Running: $script"
    python "$script"
done

# API experiments (require keys)
if [ -n "$MISTRAL_API_KEY" ]; then
    echo "Running Mistral API experiments..."
    python "Agentic Fixes/code/09_full_funsd_llm_comparison.py"
    python "Agentic Fixes/code/10_rag_kv_baseline.py"
    python "Agentic Fixes/code/18_model_version_pin.py"
else
    echo "MISTRAL_API_KEY not set — skipping Mistral API experiments."
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "Running OpenAI API experiments..."
    python "Agentic Fixes/code/13_gpt4o_mini_baseline.py"
else
    echo "OPENAI_API_KEY not set — skipping GPT-4o-mini experiment."
fi

echo ""
echo "All plots saved to: Agentic Fixes/plots/"
echo "Done."
"""
(REPRO_DIR / "reproduce.sh").write_text(SH_CONTENT, encoding="utf-8")
print("Wrote: reproducibility/reproduce.sh")

# ── 4. reproduce.ps1 (Windows PowerShell) ─────────────────────────────────
PS1_CONTENT = """# AutoFillGraph — Reproducibility script (Windows PowerShell)
$env:PYTHONUTF8 = "1"
Write-Host "=== AutoFillGraph Reproducibility ===" -ForegroundColor Cyan
Write-Host "Python: $(python --version)"
Write-Host "Date:   $(Get-Date)"

pip install -r "Agentic Fixes/reproducibility/requirements.txt" -q

$nonApiScripts = @(
    "Agentic Fixes/code/01_flat_kv_baseline.py",
    "Agentic Fixes/code/02_ablation_suite.py",
    "Agentic Fixes/code/03_efficiency_metrics.py",
    "Agentic Fixes/code/04_bandit_reward_analysis.py",
    "Agentic Fixes/code/05_kb_level_metrics.py",
    "Agentic Fixes/code/06_confidence_calibration.py",
    "Agentic Fixes/code/07_longitudinal_simulation.py",
    "Agentic Fixes/code/11_error_analysis.py",
    "Agentic Fixes/code/12_multilingual_xfund.py",
    "Agentic Fixes/code/14_rule_scalability.py",
    "Agentic Fixes/code/15_privacy_audit.py",
    "Agentic Fixes/code/17_personal_kb_benchmark.py"
)
foreach ($script in $nonApiScripts) {
    Write-Host "Running: $script"
    python $script
    if ($LASTEXITCODE -ne 0) { Write-Error "Script failed: $script"; exit 1 }
}

if ($env:MISTRAL_API_KEY) {
    python "Agentic Fixes/code/09_full_funsd_llm_comparison.py"
    python "Agentic Fixes/code/10_rag_kv_baseline.py"
    python "Agentic Fixes/code/18_model_version_pin.py"
} else { Write-Host "MISTRAL_API_KEY not set — skipping Mistral experiments." }

if ($env:OPENAI_API_KEY) {
    python "Agentic Fixes/code/13_gpt4o_mini_baseline.py"
} else { Write-Host "OPENAI_API_KEY not set — skipping GPT-4o-mini experiment." }

Write-Host "All plots saved to: Agentic Fixes/plots/" -ForegroundColor Green
"""
(REPRO_DIR / "reproduce.ps1").write_text(PS1_CONTENT, encoding="utf-8")
print("Wrote: reproducibility/reproduce.ps1")

# ── 5. Validate data files ─────────────────────────────────────────────────
REQUIRED_DATA = [
    "funsd_fill.csv", "funsd_abstain.csv", "funsd_mapping.csv",
    "xfund_de_fill.csv", "xfund_de_abstain.csv", "xfund_de_mapping.csv",
    "llm_baseline_funsd.csv",
]
print("\nData file validation:")
all_ok = True
for fname in REQUIRED_DATA:
    path = DATA_DIR / fname
    status = "OK" if path.exists() else "MISSING"
    if not path.exists(): all_ok = False
    size = f"{path.stat().st_size/1024:.1f} KB" if path.exists() else "-"
    print(f"  {status}  {fname}  ({size})")

if all_ok:
    print("  All required data files present.")
else:
    print("  WARNING: some files missing — run the main evaluation notebook first.")

# ── 6. Seeding instructions ────────────────────────────────────────────────
SEED_NOTES = f"""# AutoFillGraph Reproducibility Notes
# Generated: {date.today()}

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
"""
(REPRO_DIR / "NOTES.md").write_text(SEED_NOTES, encoding="utf-8")
print("\nWrote: reproducibility/NOTES.md")

print("\n=== Package Summary ===")
print(f"  {REPRO_DIR}")
for f in sorted(REPRO_DIR.iterdir()):
    print(f"    {f.name}  ({f.stat().st_size} bytes)")
print(f"\nTotal: {len(CONFIGS)} experiment configs documented.")
