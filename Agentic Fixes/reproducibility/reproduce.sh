#!/usr/bin/env bash
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
for script in \
    "Agentic Fixes/code/01_flat_kv_baseline.py" \
    "Agentic Fixes/code/02_ablation_suite.py" \
    "Agentic Fixes/code/03_efficiency_metrics.py" \
    "Agentic Fixes/code/04_bandit_reward_analysis.py" \
    "Agentic Fixes/code/05_kb_level_metrics.py" \
    "Agentic Fixes/code/06_confidence_calibration.py" \
    "Agentic Fixes/code/07_longitudinal_simulation.py" \
    "Agentic Fixes/code/11_error_analysis.py" \
    "Agentic Fixes/code/12_multilingual_xfund.py" \
    "Agentic Fixes/code/14_rule_scalability.py" \
    "Agentic Fixes/code/15_privacy_audit.py" \
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
