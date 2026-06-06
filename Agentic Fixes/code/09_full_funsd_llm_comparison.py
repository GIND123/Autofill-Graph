"""
09_full_funsd_llm_comparison.py  —  AutoFillGraph §1.1
Full FUNSD head-to-head on ALL fill AND abstain decisions.

Fill decisions  (407, 178 docs): LLM asked to retrieve value given full doc context.
Abstain decisions (573, 193 docs): LLM asked about out-of-schema labels not present
                                   in fill context; measures whether it correctly
                                   returns UNKNOWN.

This directly addresses Reviewer K7a2: "comparison runs on only 76 fields (15 docs)."

Saves:
  data/standard_benchmarks_lite/llm_baseline_funsd_full.csv   (fill)
  data/standard_benchmarks_lite/llm_abstain_funsd_full.csv    (abstain)
  plots/09_full_funsd_llm_comparison.{png,pdf}

Run: $env:PYTHONUTF8="1"; python "Agentic Fixes/code/09_full_funsd_llm_comparison.py"
"""

import csv, os, re, time
from collections import defaultdict
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT      = Path(__file__).resolve().parents[2]
DATA_DIR  = ROOT / "data" / "standard_benchmarks_lite"
PLOTS_DIR = ROOT / "Agentic Fixes" / "plots"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "SQl56lauKekmdvLK9IJmgGMMxBbjHpUx")
MISTRAL_MODEL   = "mistral-small-latest"

FILL_SYSTEM = (
    "You are a form-filling assistant. A user has partially filled a form. "
    "You are given all field-value pairs from the form. "
    "Return ONLY the exact value for the requested field label. "
    "If the value is not present, return exactly: UNKNOWN"
)

ABSTAIN_SYSTEM = (
    "You are a form-filling assistant. A user has partially filled a form. "
    "You are given all field-value pairs that were filled. "
    "Return the value for the requested field label. "
    "If the field does not appear in the form data at all, return exactly: UNKNOWN"
)


def make_fill_prompt(context: str, field_label: str, canonical: str) -> str:
    return (
        f"Form fields:\n{context}\n\n"
        f"What is the value for the field \"{canonical}\" (raw label: \"{field_label}\")?\n"
        f"Reply with only the exact value string, or UNKNOWN."
    )


def make_abstain_prompt(context: str, field_label: str) -> str:
    return (
        f"Form fields:\n{context}\n\n"
        f"What is the value for the field \"{field_label}\"?\n"
        f"Reply with only the exact value string, or UNKNOWN if this field is not in the form."
    )


def call_mistral(client, system: str, prompt: str) -> str:
    delays = [3, 6, 12, 24]
    for delay in delays:
        try:
            r = client.chat.complete(
                model=MISTRAL_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user",   "content": prompt},
                ],
                max_tokens=80,
                temperature=0.0,
            )
            return r.choices[0].message.content.strip()
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower():
                print(f"    Rate limit — waiting {delay}s...")
                time.sleep(delay)
            else:
                print(f"    Error: {e}")
                return "UNKNOWN"
    return "UNKNOWN"


def normalize(v: str) -> str:
    return re.sub(r"\s+", " ", v.lower().strip().strip(".,;:"))


def values_match(pred: str, exp: str) -> bool:
    p, e = normalize(pred), normalize(exp)
    if p == e: return True
    if p in e or e in p: return True
    p2 = re.sub(r"[\s/\-()]", "", p)
    e2 = re.sub(r"[\s/\-()]", "", e)
    return p2 == e2 and len(p2) > 2


def load_cache(path: Path) -> dict:
    if not path.exists(): return {}
    return {(r["doc_id"], r["question"]): r
            for r in csv.DictReader(open(path, encoding="utf-8"))}


def build_fill_context(fill_rows: list) -> dict:
    """Per-doc context: all (raw_label, value) pairs from fill CSV."""
    ctx = defaultdict(list)
    for r in fill_rows:
        ctx[r["doc_id"]].append((r["raw_question"], r["expected_value"]))
    return {doc: "\n".join(f'  "{lbl}": {val}' for lbl, val in pairs)
            for doc, pairs in ctx.items()}


# ── PHASE 1: Fill decisions ─────────────────────────────────────────────────
def run_fill(client):
    fill_rows = list(csv.DictReader(open(DATA_DIR / "funsd_fill.csv", encoding="utf-8")))
    context_map = build_fill_context(fill_rows)
    out_path = DATA_DIR / "llm_baseline_funsd_full.csv"
    cache = load_cache(out_path)
    # Keep only rows with a real non-UNKNOWN prediction and matching new schema
    valid_cache = {}
    for k, v in cache.items():
        if v.get("ok") != "True" and v.get("llm_predicted","UNKNOWN").upper() == "UNKNOWN":
            continue  # discard UNKNOWN-only rows from bad runs
        # Backfill canonical column if missing (old cache format)
        if "canonical" not in v:
            v["canonical"] = v.get("question", "")
        valid_cache[k] = v
    print(f"\n[Fill] {len(fill_rows)} decisions | cached valid: {len(valid_cache)}")

    out_rows = []
    api_calls = 0
    for i, row in enumerate(fill_rows):
        key = (row["doc_id"], row["raw_question"])
        if key in valid_cache:
            out_rows.append(valid_cache[key]); continue

        ctx = context_map.get(row["doc_id"], "")
        pred = call_mistral(client, FILL_SYSTEM,
                            make_fill_prompt(ctx, row["raw_question"], row["query"]))
        api_calls += 1
        time.sleep(1.2)

        # correct if predicted matches expected AND is not UNKNOWN
        ok = (pred.upper() != "UNKNOWN") and values_match(pred, row["expected_value"])

        out_rows.append({
            "doc_id":         row["doc_id"],
            "split":          row["split"],
            "question":       row["raw_question"],
            "canonical":      row["query"],
            "expected_prop":  row["expected_prop"],
            "expected_value": row["expected_value"],
            "llm_predicted":  pred,
            "ok":             str(ok),
        })
        if api_calls % 20 == 0 or i == len(fill_rows) - 1:
            corr = sum(1 for r in out_rows if r["ok"] == "True")
            print(f"  [{i+1}/{len(fill_rows)}] calls={api_calls} "
                  f"acc={corr}/{len(out_rows)}={corr/len(out_rows)*100:.1f}%")
            with open(out_path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
                w.writeheader(); w.writerows(out_rows)

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader(); w.writerows(out_rows)

    correct = sum(1 for r in out_rows if r["ok"] == "True")
    print(f"\n[Fill] Done — LLM fill acc: {correct}/{len(out_rows)} = {correct/len(out_rows)*100:.1f}%")
    return out_rows


# ── PHASE 2: Abstain decisions ──────────────────────────────────────────────
def run_abstain(client, fill_context_map: dict):
    """Run LLM on the 573 abstain rows.
    These are out-of-schema FUNSD labels where AutoFillGraph correctly returns UNKNOWN.
    The LLM is given the same fill context (which does NOT contain the abstain label),
    so it must determine that the field is not in the form data.
    """
    abs_rows = list(csv.DictReader(open(DATA_DIR / "funsd_abstain.csv", encoding="utf-8")))
    out_path = DATA_DIR / "llm_abstain_funsd_full.csv"
    cache = load_cache(out_path)
    print(f"\n[Abstain] {len(abs_rows)} decisions | cached: {len(cache)}")

    out_rows = []
    api_calls = 0
    for i, row in enumerate(abs_rows):
        key = (row["doc_id"], row["question"])
        if key in cache:
            out_rows.append(cache[key]); continue

        ctx = fill_context_map.get(row["doc_id"], "(no filled fields for this document)")
        pred = call_mistral(client, ABSTAIN_SYSTEM,
                            make_abstain_prompt(ctx, row["question"]))
        api_calls += 1
        time.sleep(1.2)

        # Correct abstain = LLM returns UNKNOWN
        llm_abstained = pred.strip().upper() == "UNKNOWN"
        ok = llm_abstained  # correct iff LLM says UNKNOWN (matching AG expected UNKNOWN)

        out_rows.append({
            "doc_id":   row["doc_id"],
            "split":    row["split"],
            "question": row["question"],
            "expected": "UNKNOWN",
            "llm_predicted": pred,
            "llm_abstained": str(llm_abstained),
            "ok":       str(ok),
        })
        if api_calls % 20 == 0 or i == len(abs_rows) - 1:
            corr = sum(1 for r in out_rows if r["ok"] == "True")
            print(f"  [{i+1}/{len(abs_rows)}] calls={api_calls} "
                  f"abstain_acc={corr}/{len(out_rows)}={corr/len(out_rows)*100:.1f}%")
            with open(out_path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
                w.writeheader(); w.writerows(out_rows)

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader(); w.writerows(out_rows)

    correct = sum(1 for r in out_rows if r["ok"] == "True")
    llm_abstain_acc = correct / len(out_rows) * 100
    print(f"\n[Abstain] Done — LLM abstain acc: {correct}/{len(out_rows)} = {llm_abstain_acc:.1f}%")
    return out_rows, llm_abstain_acc


# ── Main ────────────────────────────────────────────────────────────────────
def main():
    from mistralai.client import Mistral
    client = Mistral(api_key=MISTRAL_API_KEY)

    # Build fill context once for both phases
    fill_rows = list(csv.DictReader(open(DATA_DIR / "funsd_fill.csv", encoding="utf-8")))
    fill_context_map = build_fill_context(fill_rows)

    # Phase 1: fill
    fill_out = run_fill(client)

    # Phase 2: abstain
    abs_out, llm_abstain_acc = run_abstain(client, fill_context_map)

    # ── AutoFillGraph reference numbers ──────────────────────────────────────
    ag_fill_correct = sum(1 for r in fill_rows if r["ok"].strip().lower() == "true")
    ag_fill_acc     = ag_fill_correct / len(fill_rows) * 100
    ag_abs_rows     = list(csv.DictReader(open(DATA_DIR / "funsd_abstain.csv", encoding="utf-8")))
    ag_abs_correct  = sum(1 for r in ag_abs_rows if r.get("ok","").strip().lower() == "true")
    ag_abs_acc      = ag_abs_correct / len(ag_abs_rows) * 100

    llm_fill_correct = sum(1 for r in fill_out if r["ok"] == "True")
    llm_fill_acc     = llm_fill_correct / len(fill_out) * 100

    n_fill_docs  = len(set(r["doc_id"] for r in fill_rows))
    n_abs_docs   = len(set(r["doc_id"] for r in ag_abs_rows))
    n_total_docs = len(set(r["doc_id"] for r in fill_rows) |
                       set(r["doc_id"] for r in ag_abs_rows))

    # ── Per-category fill breakdown ───────────────────────────────────────────
    CATEGORY = {
        "full_name":"identity","first_name":"identity","last_name":"identity","display_name":"identity",
        "email":"contact","work_email":"contact","phone":"contact","address":"contact",
        "city":"contact","state":"contact","zip_code":"contact","country":"contact",
        "employer":"professional","job_title":"professional","skills":"professional",
        "university":"academic","department":"academic","degree":"academic",
        "gpa":"academic","graduation_date":"academic","advisor":"academic",
    }
    ag_cat  = defaultdict(lambda: [0,0])
    llm_cat = defaultdict(lambda: [0,0])
    for ra, rl in zip(fill_rows, fill_out):
        cat = CATEGORY.get(ra["expected_prop"], "other")
        ag_cat[cat][1]  += 1
        llm_cat[cat][1] += 1
        if ra["ok"].strip().lower() == "true": ag_cat[cat][0] += 1
        if rl["ok"] == "True":                 llm_cat[cat][0] += 1

    print(f"\n=== Full FUNSD Head-to-Head (§1.1) ===")
    print(f"Total FUNSD docs covered: {n_total_docs} (fill: {n_fill_docs}, abstain: {n_abs_docs})")
    print(f"Fill decisions:    {len(fill_rows)}")
    print(f"Abstain decisions: {len(ag_abs_rows)}")
    print()
    print(f"{'Metric':<30} {'AutoFillGraph':>15} {'Mistral-small':>15}")
    print("-"*62)
    print(f"{'Fill accuracy':<30} {ag_fill_acc:>14.1f}% {llm_fill_acc:>14.1f}%")
    print(f"{'Abstain accuracy':<30} {ag_abs_acc:>14.1f}% {llm_abstain_acc:>14.1f}%")
    print(f"{'API calls / doc':<30} {'0':>15} {'~2.29':>15}")
    print()
    print("Per-category fill accuracy:")
    for cat in sorted(ag_cat):
        aa = ag_cat[cat][0]/max(ag_cat[cat][1],1)*100
        la = llm_cat[cat][0]/max(llm_cat[cat][1],1)*100
        print(f"  {cat:12s}  AG={aa:5.1f}% ({ag_cat[cat][0]}/{ag_cat[cat][1]})  "
              f"LLM={la:5.1f}% ({llm_cat[cat][0]}/{llm_cat[cat][1]})")

    # ── Plot ─────────────────────────────────────────────────────────────────
    COLOR_AG  = "#0072B2"
    COLOR_LLM = "#D55E00"

    fig, axes = plt.subplots(1, 3, figsize=(14, 5))
    fig.suptitle(
        f"Full FUNSD Head-to-Head: AutoFillGraph vs. Mistral-small-latest\n"
        f"{n_total_docs} documents · {len(fill_rows)} fill + {len(ag_abs_rows)} abstain decisions",
        fontsize=11, fontweight="bold"
    )

    # Panel A: fill acc + abstain acc side by side
    ax = axes[0]
    metrics  = ["Fill Accuracy", "Abstain Accuracy"]
    ag_vals  = [ag_fill_acc, ag_abs_acc]
    llm_vals = [llm_fill_acc, llm_abstain_acc]
    x = np.arange(2); w = 0.32
    b1 = ax.bar(x - w/2, ag_vals,  w, color=COLOR_AG,  label="AutoFillGraph", zorder=3)
    b2 = ax.bar(x + w/2, llm_vals, w, color=COLOR_LLM, label="Mistral-small",  zorder=3)
    for bar, val in [(b, v) for bg, vs in [(b1,ag_vals),(b2,llm_vals)] for b,v in zip(bg,vs)]:
        ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+1,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=9, fontweight="bold")
    ax.set_xticks(x); ax.set_xticklabels(metrics, fontsize=10)
    ax.set_ylabel("Accuracy (%)"); ax.set_ylim(0, 118)
    ax.set_title(f"Fill + Abstain Accuracy\n({n_total_docs} FUNSD docs)", fontsize=10)
    ax.legend(fontsize=9); ax.yaxis.grid(True, alpha=0.3); ax.set_axisbelow(True)

    # Panel B: per-category fill
    ax = axes[1]
    cats = sorted(c for c in ag_cat if ag_cat[c][1] >= 5)
    ag_cv  = [ag_cat[c][0]/max(ag_cat[c][1],1)*100 for c in cats]
    llm_cv = [llm_cat[c][0]/max(llm_cat[c][1],1)*100 for c in cats]
    x2 = np.arange(len(cats))
    ax.bar(x2-w/2, ag_cv,  w, color=COLOR_AG,  label="AutoFillGraph", zorder=3)
    ax.bar(x2+w/2, llm_cv, w, color=COLOR_LLM, label="Mistral-small",  zorder=3)
    ax.set_xticks(x2); ax.set_xticklabels([c.capitalize() for c in cats], rotation=35, ha="right", fontsize=9)
    ax.set_ylabel("Fill Accuracy (%)"); ax.set_ylim(0, 118)
    ax.set_title("Per-Category Fill Accuracy", fontsize=10)
    ax.legend(fontsize=9); ax.yaxis.grid(True, alpha=0.3); ax.set_axisbelow(True)

    # Panel C: scale comparison — prior 15-doc vs full
    ax = axes[2]
    cats3   = ["Prior\n(15 docs\n76 fill fields)",
               f"Full\n({n_total_docs} docs\n{len(fill_rows)} fill + {len(ag_abs_rows)} abstain)"]
    # prior: fill acc only (abstain not measured in original)
    prior_ag  = [53.8, ag_abs_acc]
    prior_llm = [43.4, 0.0]        # original 15-doc LLM fill; abstain unmeasured → 0
    full_ag   = [ag_fill_acc, ag_abs_acc]
    full_llm  = [llm_fill_acc, llm_abstain_acc]

    x3 = np.arange(2)
    scenarios = ["Fill (prior)", "Fill (full)", "Abstain (full)"]
    # 3-cluster bar: prior-AG, prior-LLM, full-AG, full-LLM (fill only side)
    groups = [
        ("Prior fill\nAG",  53.8,        COLOR_AG,  0.80),
        ("Prior fill\nLLM", 43.4,        COLOR_LLM, 0.80),
        ("Full fill\nAG",   ag_fill_acc, COLOR_AG,  1.00),
        ("Full fill\nLLM",  llm_fill_acc,COLOR_LLM, 1.00),
    ]
    x4 = np.arange(len(groups)); w4 = 0.55
    for gi, g in enumerate(groups):
        b = ax.bar(x4[gi], g[1], color=g[2], alpha=g[3], width=w4, zorder=3)
        ax.text(b[0].get_x()+b[0].get_width()/2, b[0].get_height()+0.8,
                f"{g[1]:.1f}%", ha="center", va="bottom", fontsize=8, fontweight="bold")
    ax.set_xticks(x4); ax.set_xticklabels([g[0] for g in groups], fontsize=8)
    ax.set_ylabel("Fill Accuracy (%)"); ax.set_ylim(0, 80)
    ax.set_title("Scale Comparison\n(Prior 15-doc → Full FUNSD)", fontsize=10)
    ax.yaxis.grid(True, alpha=0.3); ax.set_axisbelow(True)

    plt.tight_layout()
    for ext in ("png", "pdf"):
        plt.savefig(PLOTS_DIR / f"09_full_funsd_llm_comparison.{ext}", dpi=300, bbox_inches="tight")
    print(f"\nPlot -> plots/09_full_funsd_llm_comparison.{{png,pdf}}")
    plt.close()

    print(f"\n=== Paper-ready numbers (§1.1) ===")
    print(f"  Total FUNSD docs: {n_total_docs}  ({n_fill_docs} with fill, {n_abs_docs} with abstain)")
    print(f"  AG   fill acc:     {ag_fill_acc:.1f}%  ({ag_fill_correct}/{len(fill_rows)})")
    print(f"  LLM  fill acc:     {llm_fill_acc:.1f}%  ({llm_fill_correct}/{len(fill_out)})")
    print(f"  AG   abstain acc:  {ag_abs_acc:.1f}%  ({ag_abs_correct}/{len(ag_abs_rows)})")
    print(f"  LLM  abstain acc:  {llm_abstain_acc:.1f}%  (NEW — previously unmeasured)")
    print(f"  Abstain advantage: +{ag_abs_acc - llm_abstain_acc:.1f}pp")
    print(f"  Note: LLM has full form context (oracle). AG fills from KB memory alone.")


if __name__ == "__main__":
    main()
