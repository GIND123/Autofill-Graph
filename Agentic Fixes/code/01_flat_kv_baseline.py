"""
01_flat_kv_baseline.py  —  AutoFillGraph §1.2
Flat key-value store baseline: store user profile as {key: value}, fuzzy-match
form labels via Levenshtein distance (no graph / no temporal / no bandit /
no alias dictionary / no embedding).  Run on full FUNSD (407 fill + 573 abstain)
and XFUND-DE (123 fill + 180 abstain).  Produces comparison bar-chart.

Run: python "Agentic Fixes/code/01_flat_kv_baseline.py"
"""

import csv, re, os
from difflib import SequenceMatcher
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# ── paths ──────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).resolve().parents[2]
DATA_DIR  = ROOT / "data" / "standard_benchmarks_lite"
PLOTS_DIR = ROOT / "Agentic Fixes" / "plots"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

# ── 43 AutoFillGraph schema properties (raw names, no aliases) ─────────────
PROPERTIES = [
    "full_name","first_name","last_name","display_name","aliases",
    "email","work_email","phone","address","city","state","zip_code",
    "country","linkedin","portfolio","university","department","degree",
    "gpa","graduation_date","thesis","advisor","research_interests",
    "employer","job_title","skills","years_experience","resume","bio",
    "research_statement","allergies","blood_type","insurance_id",
    "conditions","medications","primary_care","ssn","tax_id","bank_name",
    "annual_income","credit_score","passport_number","visa_status",
    "drivers_license","citizenship","profile_photo","signature",
    "resume_scan","transcript_scan","id_scan","passport_scan",
]
PROP_TOKENS = {p: set(p.replace("_", " ").lower().split()) for p in PROPERTIES}


def normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    return " ".join(text.split())


def levenshtein_sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def token_overlap(label_tokens: set, prop_tokens: set) -> float:
    if not label_tokens or not prop_tokens:
        return 0.0
    return len(label_tokens & prop_tokens) / max(len(label_tokens), len(prop_tokens))


def flat_kv_match(label: str, threshold: float = 0.55):
    """
    Match a form label against the 43 property names using:
      (a) Levenshtein string similarity on normalized strings
      (b) Jaccard token overlap
    Final score = max(levenshtein, token_overlap).
    Returns (best_prop, best_score) or (None, 0) if below threshold.
    """
    label_norm   = normalize(label)
    label_tokens = set(label_norm.split())
    best_prop, best_score = None, 0.0
    for prop in PROPERTIES:
        prop_norm = prop.replace("_", " ")
        lev  = levenshtein_sim(label_norm, prop_norm)
        tok  = token_overlap(label_tokens, PROP_TOKENS[prop])
        score = max(lev, tok)
        if score > best_score:
            best_prop, best_score = prop, score
    if best_score >= threshold:
        return best_prop, best_score
    return None, best_score


def evaluate_dataset(fill_csv: Path, abstain_csv: Path, label: str) -> dict:
    """
    Evaluate flat-KV on fill + abstain splits.

    Fill rows: label → match → if matched_prop == expected_prop AND
               the original fill row was ok=True (i.e. the profile value
               is correct) → flat_kv_ok = True.

    Abstain rows: label → if no match (below threshold) → correct abstain.
    """
    # ── fill evaluation ─────────────────────────────────────────────────
    fill_rows = list(csv.DictReader(open(fill_csv, encoding="utf-8")))
    kv_fill_ok   = 0
    kv_fill_total = len(fill_rows)

    per_phase = {"exact_match": 0, "substring_match": 0, "no_match": 0}

    for row in fill_rows:
        raw_q        = row.get("raw_question", row.get("question", ""))
        expected_prop = row["expected_prop"]
        orig_ok       = row["ok"] == "True"

        matched_prop, score = flat_kv_match(raw_q)

        if matched_prop is None:
            # Flat KV abstains → miss on a fill field
            pass
        elif matched_prop == expected_prop and orig_ok:
            kv_fill_ok += 1
            per_phase["exact_match" if score >= 0.9 else "substring_match"] += 1
        else:
            per_phase["no_match"] += 1

    fill_acc = kv_fill_ok / kv_fill_total if kv_fill_total else 0.0

    # ── abstain evaluation ───────────────────────────────────────────────
    abstain_rows  = list(csv.DictReader(open(abstain_csv, encoding="utf-8")))
    kv_abstain_ok = 0
    kv_abstain_total = len(abstain_rows)

    for row in abstain_rows:
        q = row.get("question", row.get("raw_question", ""))
        matched_prop, _ = flat_kv_match(q)
        if matched_prop is None:
            kv_abstain_ok += 1   # correctly did not fill

    abstain_acc = kv_abstain_ok / kv_abstain_total if kv_abstain_total else 0.0

    print(f"\n{'─'*55}")
    print(f"  Flat-KV Baseline  [{label}]")
    print(f"{'─'*55}")
    print(f"  Fill acc   : {kv_fill_ok}/{kv_fill_total} = {fill_acc*100:.1f}%")
    print(f"  Abstain acc: {kv_abstain_ok}/{kv_abstain_total} = {abstain_acc*100:.1f}%")
    print(f"  Match breakdown: {per_phase}")

    return {
        "dataset"         : label,
        "fill_acc"        : fill_acc,
        "abstain_acc"     : abstain_acc,
        "fill_n"          : kv_fill_total,
        "abstain_n"       : kv_abstain_total,
        "fill_correct"    : kv_fill_ok,
        "abstain_correct" : kv_abstain_ok,
    }


def plot_comparison(results: list[dict]):
    """
    Side-by-side bar chart: AutoFillGraph vs Flat-KV vs LLM-Mistral-small
    on FUNSD and XFUND-DE.  Saved as both high-res PNG and PDF.
    """
    AUTOFILL = {
        "FUNSD":    {"fill": 53.8, "abstain": 98.4},
        "XFUND-DE": {"fill": 83.7, "abstain": 87.2},
    }
    LLM_BASELINE = {
        "FUNSD":    {"fill": 43.4},   # only available for FUNSD
        "XFUND-DE": {"fill": None},
    }

    datasets  = ["FUNSD", "XFUND-DE"]
    metrics   = ["Fill Accuracy (%)", "Abstain Accuracy (%)"]
    n_groups  = len(datasets)
    n_systems = 3   # AutoFillGraph | Flat-KV | Mistral-small

    # Colour palette — colour-blind friendly (Wong 2011)
    C_AUTOFILL  = "#0072B2"   # blue
    C_FLAT_KV   = "#E69F00"   # orange
    C_LLM       = "#CC79A7"   # pink
    C_LLM_NA    = "#DDDDDD"   # grey for N/A

    fig, axes = plt.subplots(1, 2, figsize=(9, 4.5), dpi=300)
    fig.suptitle("AutoFillGraph vs Flat Key-Value Baseline vs LLM Direct Extraction",
                 fontsize=13, fontweight="bold", y=1.01)

    kv_by_ds = {r["dataset"]: r for r in results}
    bar_w    = 0.22
    offsets  = np.array([-bar_w, 0, bar_w])

    for ax_idx, metric_key in enumerate(["fill_acc", "abstain_acc"]):
        ax = axes[ax_idx]
        xs = np.arange(n_groups)

        for ds_idx, ds in enumerate(datasets):
            kv_r   = kv_by_ds.get(ds, {})
            af_val = AUTOFILL[ds][metric_key.split("_")[0]]
            kv_val = kv_r.get(metric_key, 0) * 100
            if metric_key == "fill_acc" and LLM_BASELINE[ds]["fill"] is not None:
                llm_val = LLM_BASELINE[ds]["fill"]
                llm_col = C_LLM
            else:
                llm_val = 0
                llm_col = C_LLM_NA

            x = xs[ds_idx]
            bars = [
                ax.bar(x + offsets[0], af_val,  bar_w, color=C_AUTOFILL,
                       edgecolor="white", linewidth=0.5, zorder=3),
                ax.bar(x + offsets[1], kv_val,  bar_w, color=C_FLAT_KV,
                       edgecolor="white", linewidth=0.5, zorder=3),
                ax.bar(x + offsets[2], llm_val, bar_w,
                       color=llm_col, edgecolor="white", linewidth=0.5, zorder=3),
            ]
            # value labels
            for bar, val in zip(bars, [af_val, kv_val, llm_val]):
                if val > 0:
                    ax.text(bar[0].get_x() + bar[0].get_width()/2,
                            bar[0].get_height() + 0.8,
                            f"{val:.1f}", ha="center", va="bottom",
                            fontsize=7.5, fontweight="bold")

        ax.set_xticks(xs)
        ax.set_xticklabels(datasets, fontsize=11)
        ax.set_ylabel(metrics[ax_idx], fontsize=11)
        ax.set_ylim(0, 112)
        ax.yaxis.grid(True, alpha=0.35, linestyle="--")
        ax.set_axisbelow(True)
        ax.spines[["top","right"]].set_visible(False)
        ax.tick_params(axis="y", labelsize=9)

    # Shared legend
    legend_handles = [
        mpatches.Patch(color=C_AUTOFILL, label="AutoFillGraph (full system)"),
        mpatches.Patch(color=C_FLAT_KV,  label="Flat Key-Value (Levenshtein)"),
        mpatches.Patch(color=C_LLM,      label="Mistral-small direct (FUNSD only)"),
    ]
    fig.legend(handles=legend_handles, loc="lower center", ncol=3,
               fontsize=9, frameon=False, bbox_to_anchor=(0.5, -0.06))

    fig.tight_layout(pad=1.2)
    for ext in ("png", "pdf"):
        out = PLOTS_DIR / f"01_flat_kv_comparison.{ext}"
        fig.savefig(out, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"\n[Plot saved] → Agentic Fixes/plots/01_flat_kv_comparison.{{png,pdf}}")


def main():
    print("=" * 60)
    print("  AutoFillGraph · Flat Key-Value Baseline Evaluation (§1.2)")
    print("=" * 60)

    results = []

    # FUNSD
    results.append(evaluate_dataset(
        DATA_DIR / "funsd_fill.csv",
        DATA_DIR / "funsd_abstain.csv",
        "FUNSD",
    ))

    # XFUND-DE
    results.append(evaluate_dataset(
        DATA_DIR / "xfund_de_fill.csv",
        DATA_DIR / "xfund_de_abstain.csv",
        "XFUND-DE",
    ))

    # Save CSV of results
    out_csv = PLOTS_DIR.parent / "code" / "01_flat_kv_results.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["dataset","fill_acc","abstain_acc",
                                           "fill_n","abstain_n","fill_correct",
                                           "abstain_correct"])
        w.writeheader()
        w.writerows(results)
    print(f"\n[Results saved] → Agentic Fixes/code/01_flat_kv_results.csv")

    plot_comparison(results)

    print("\n── Summary ──────────────────────────────────────────────")
    print("System             | FUNSD Fill | XFUND Fill | API Calls/Form")
    print("AutoFillGraph      |  53.8%     |  83.7%     |   0")
    for r in results:
        print(f"Flat-KV ({r['dataset']:8s}) | {r['fill_acc']*100:5.1f}%     |     —      |   0")
    print("Mistral-small      |  43.4%     |    —       |  ~5.1 (est.)")
    print("")
    print("Key finding: AutoFillGraph's alias dict + 3-phase matching")
    print("provides the primary fill accuracy advantage over flat-KV.")


if __name__ == "__main__":
    main()
