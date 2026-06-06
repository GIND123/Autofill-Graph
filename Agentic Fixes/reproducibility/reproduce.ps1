# AutoFillGraph — Reproducibility script (Windows PowerShell)
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
