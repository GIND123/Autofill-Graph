import csv
from pathlib import Path
DATA = Path("data/standard_benchmarks_lite")

fill    = list(csv.DictReader(open(DATA / "funsd_fill.csv")))
abstain = list(csv.DictReader(open(DATA / "funsd_abstain.csv")))
llm     = list(csv.DictReader(open(DATA / "llm_baseline_funsd.csv")))
kv_path = Path("Agentic Fixes") / "code" / "01_flat_kv_results.csv"
kv      = list(csv.DictReader(open(kv_path)))

fill_ok = sum(1 for r in fill if r["ok"] == "True")
abs_ok  = sum(1 for r in abstain if r["ok"] == "True")
llm_ok  = sum(1 for r in llm if r["ok"] == "True")

print("VERIFIED CORE NUMBERS:")
print(f"  AG FUNSD fill acc    : {fill_ok}/{len(fill)} = {fill_ok/len(fill)*100:.1f}%")
print(f"  AG FUNSD abstain acc : {abs_ok}/{len(abstain)} = {abs_ok/len(abstain)*100:.1f}%")
print(f"  LLM fill acc         : {llm_ok}/{len(llm)} = {llm_ok/len(llm)*100:.1f}%")
print(f"  AG advantage vs LLM  : +{fill_ok/len(fill)*100 - llm_ok/len(llm)*100:.1f}pp")

print("\nFLAT-KV BASELINE (NEW — script 01):")
for r in kv:
    ds = r["dataset"]
    fa = float(r["fill_acc"]) * 100
    aa = float(r["abstain_acc"]) * 100
    print(f"  {ds:10s}: fill={fa:.1f}%  abstain={aa:.1f}%")

ag_fill_funsd = fill_ok / len(fill) * 100
kv_fill_funsd = float(next(r for r in kv if r["dataset"] == "FUNSD")["fill_acc"]) * 100
print(f"\n  AG − Flat-KV advantage: +{ag_fill_funsd - kv_fill_funsd:.1f}pp fill accuracy on FUNSD")

filled_rows = [r for r in fill if r["status"] == "FILLED"]
correct     = [r for r in filled_rows if r["ok"] == "True"]
prec = len(correct) / len(filled_rows)
rec  = len(correct) / len(fill)
f1   = 2 * prec * rec / (prec + rec)
print(f"\nKB TRIPLE METRICS:")
print(f"  Precision  = {prec*100:.1f}%  Recall = {rec*100:.1f}%  F1 = {f1*100:.1f}%")
print(f"  Stale-fact : Flat-KV ~94.8%  vs  AutoFillGraph 0%  (from script 05)")
print(f"  Bandit     : LOCAL arm selected 94.6% of 407 episodes  (from script 04)")
print(f"  Efficiency : 0 API calls vs ~1008 calls LLM-only on full FUNSD  (from script 03)")
print(f"  Calibration: ECE=0.150 (fill decisions only)  (from script 06)")
print(f"  Longitudinal: AG avg {ag_fill_funsd:.1f}% fill, +3.5pp over Flat-KV, 73% API reduction  (from script 07)")
