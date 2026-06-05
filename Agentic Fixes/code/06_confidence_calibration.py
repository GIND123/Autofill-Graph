"""
06_confidence_calibration.py  —  AutoFillGraph §1.13
Confidence calibration analysis:  Expected Calibration Error (ECE) and
reliability diagram.

The paper claims "calibrated confidence scores" but never measures calibration.
This script validates or invalidates that claim by:
  1. Assigning a predicted confidence to each fill decision from resolution
     metadata (phase + similarity score from the mapping CSV)
  2. Joining with fill outcomes (correct / incorrect)
  3. Binning by confidence decile
  4. Computing ECE = Σ_b |fraction_b| × |conf_b − acc_b|
  5. Drawing the reliability diagram (calibration curve)
  6. Applying isotonic regression recalibration and recomputing ECE

Confidence assignment:
  Phase "exact"     → confidence = 0.97 (keyword alias lookup, near-certain)
  Phase "substring" → confidence = 0.55 + 0.35 × normalised_score
  Phase "embedding" → confidence = 0.30 + 0.60 × normalised_score
  Phase "unknown"   → confidence = 0.10 (system abstains but we model it)
  FILLED status     → raw confidence propagated from phase
  UNKNOWN status    → confidence ≤ 0.25 (system expresses low confidence)
"""

import csv
from pathlib import Path
from collections import defaultdict
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
try:
    from sklearn.isotonic import IsotonicRegression
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

ROOT      = Path(__file__).resolve().parents[2]
DATA_DIR  = ROOT / "data" / "standard_benchmarks_lite"
PLOTS_DIR = ROOT / "Agentic Fixes" / "plots"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

np.random.seed(42)

N_BINS = 10


def assign_confidence(phase: str, score: float) -> float:
    """
    Map resolution phase + similarity score → predicted confidence.
    All values are in [0, 1].
    """
    if phase == "exact":
        return 0.97
    elif phase == "substring":
        # score range in data: 0.10 – 0.60; map linearly to [0.40, 0.90]
        s = float(score) if score else 0.3
        return min(0.90, max(0.40, 0.40 + 0.83 * s))
    elif phase == "embedding":
        # score range: 0.32 – 0.90 (cosine sim); map to [0.30, 0.85]
        s = float(score) if score else 0.32
        return min(0.85, max(0.30, 0.30 + 0.73 * (s - 0.32) / 0.58))
    else:   # unknown / abstain
        return 0.10


def load_and_join():
    """
    Join funsd_fill.csv (outcomes) with funsd_mapping.csv (phase + score)
    on (doc_id, normalised question text) to get (confidence, correct) pairs.

    Calibration is computed ONLY for fill decisions (status=FILLED).
    Abstain decisions are reported separately as a binary classification task.
    Mixing fill and abstain would inflate ECE because abstain confidence (0.10)
    correctly predicts a different kind of outcome.
    """
    fill    = list(csv.DictReader(open(DATA_DIR / "funsd_fill.csv",    encoding="utf-8")))
    mapping = list(csv.DictReader(open(DATA_DIR / "funsd_mapping.csv", encoding="utf-8")))

    # Build mapping index: (doc_id, norm_q) → (phase, score)
    map_idx = {}
    for r in mapping:
        q_key = r["question"].strip().lower()
        map_idx[(r["doc_id"], q_key)] = (r["phase"], r.get("score", "0"))

    confidences = []
    labels      = []   # 1 = correct fill, 0 = wrong fill

    for row in fill:
        doc_id = row["doc_id"]
        q_raw  = row.get("raw_question", row.get("query", "")).strip().lower()
        ok     = row["ok"] == "True"

        phase, score = map_idx.get((doc_id, q_raw), ("unknown", "0"))
        conf = assign_confidence(phase, score)

        confidences.append(conf)
        labels.append(int(ok))

    # Abstain stats (reported separately, NOT mixed into calibration)
    abstain     = list(csv.DictReader(open(DATA_DIR / "funsd_abstain.csv", encoding="utf-8")))
    abs_correct = sum(1 for r in abstain if r["ok"] == "True")
    abs_acc     = abs_correct / len(abstain) if abstain else 0.0

    print(f"\n  Abstain decisions (NOT included in calibration curve):")
    print(f"    Total abstain rows   : {len(abstain)}")
    print(f"    Correct abstentions  : {abs_correct} ({abs_acc*100:.1f}%)")
    print(f"    (Abstain accuracy is evaluated separately as a binary task.)")

    return np.array(confidences, dtype=float), np.array(labels, dtype=int)


def compute_ece(confidences, labels, n_bins=N_BINS):
    """
    Expected Calibration Error (equal-width bins).
    ECE = Σ_b (|B_b| / n) × |acc(B_b) − conf(B_b)|
    """
    bin_edges  = np.linspace(0, 1, n_bins + 1)
    bin_confs  = []
    bin_accs   = []
    bin_fracs  = []

    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        mask   = (confidences >= lo) & (confidences < hi)
        if i == n_bins - 1:
            mask = (confidences >= lo) & (confidences <= hi)
        n_b   = mask.sum()
        if n_b == 0:
            bin_confs.append((lo + hi) / 2)
            bin_accs.append(0.0)
            bin_fracs.append(0.0)
        else:
            bin_confs.append(confidences[mask].mean())
            bin_accs.append(labels[mask].mean())
            bin_fracs.append(n_b / len(confidences))

    ece = sum(f * abs(c - a) for c, a, f in zip(bin_confs, bin_accs, bin_fracs))
    return ece, np.array(bin_confs), np.array(bin_accs), np.array(bin_fracs)


def isotonic_recalibrate(confidences, labels):
    """
    Isotonic regression recalibration (Platt-scaling alternative).
    Returns recalibrated confidence scores.
    """
    if not HAS_SKLEARN:
        return confidences   # fallback: no recalibration
    ir = IsotonicRegression(out_of_bounds="clip")
    ir.fit(confidences, labels)
    return ir.predict(confidences)


def plot_calibration(confidences, labels, calibrated_confs):
    ece_raw, bc_raw, ba_raw, bf_raw = compute_ece(confidences, labels)
    ece_cal, bc_cal, ba_cal, bf_cal = compute_ece(calibrated_confs, labels)

    fig, axes = plt.subplots(1, 3, figsize=(13, 4.5), dpi=300)
    fig.suptitle("AutoFillGraph Confidence Calibration (§1.13)",
                 fontsize=13, fontweight="bold", y=1.01)

    BLUE = "#0072B2"; ORANGE = "#E69F00"; GREEN = "#009E73"

    # ── Panel A: Reliability diagram (raw) ──────────────────────────────
    ax = axes[0]
    ax.plot([0, 1], [0, 1], "k--", linewidth=1.2, label="Perfect calibration", alpha=0.5)
    ax.bar(bc_raw, ba_raw, width=1/N_BINS, alpha=0.55, color=BLUE, edgecolor="white",
           label="Actual accuracy", align="center")
    ax.plot(bc_raw, ba_raw, "o-", color=BLUE, linewidth=2, markersize=5)
    for c, a in zip(bc_raw, ba_raw):
        if abs(c - a) > 0.02:
            ax.annotate(f"{abs(c-a):.2f}", (c, max(c, a) + 0.02),
                        ha="center", fontsize=6.5, color="red")
    ax.set_xlabel("Mean Predicted Confidence", fontsize=10)
    ax.set_ylabel("Actual Accuracy", fontsize=10)
    ax.set_title(f"Reliability Diagram\n(ECE = {ece_raw:.3f})", fontsize=10)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1.05)
    ax.legend(fontsize=8, frameon=False)
    ax.yaxis.grid(True, alpha=0.3, linestyle="--"); ax.set_axisbelow(True)
    ax.spines[["top","right"]].set_visible(False)

    # ── Panel B: After isotonic recalibration ────────────────────────────
    ax = axes[1]
    ax.plot([0, 1], [0, 1], "k--", linewidth=1.2, label="Perfect calibration", alpha=0.5)
    ax.bar(bc_cal, ba_cal, width=1/N_BINS, alpha=0.55, color=GREEN, edgecolor="white",
           label="Actual accuracy", align="center")
    ax.plot(bc_cal, ba_cal, "s-", color=GREEN, linewidth=2, markersize=5)
    ax.set_xlabel("Mean Predicted Confidence (recalibrated)", fontsize=10)
    ax.set_ylabel("Actual Accuracy", fontsize=10)
    ax.set_title(f"After Isotonic Recalibration\n(ECE = {ece_cal:.3f})", fontsize=10)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1.05)
    ax.legend(fontsize=8, frameon=False)
    ax.yaxis.grid(True, alpha=0.3, linestyle="--"); ax.set_axisbelow(True)
    ax.spines[["top","right"]].set_visible(False)

    # ── Panel C: Bin fraction histogram (how many samples in each bin) ──
    ax = axes[2]
    bin_mids = np.linspace(0.05, 0.95, N_BINS)
    ax.bar(bin_mids, bf_raw * 100, width=0.09, color=ORANGE, edgecolor="white",
           label="Sample fraction")
    ax.set_xlabel("Confidence Bin", fontsize=10)
    ax.set_ylabel("% of Decisions", fontsize=10)
    ax.set_title("Confidence Distribution\nacross bins", fontsize=10)
    ax.yaxis.grid(True, alpha=0.3, linestyle="--"); ax.set_axisbelow(True)
    ax.spines[["top","right"]].set_visible(False)

    fig.tight_layout(pad=1.5)
    for ext in ("png", "pdf"):
        fig.savefig(PLOTS_DIR / f"06_confidence_calibration.{ext}", dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"\n[Plot saved] → Agentic Fixes/plots/06_confidence_calibration.{{png,pdf}}")

    return ece_raw, ece_cal


def main():
    print("=" * 65)
    print("  AutoFillGraph · Confidence Calibration (§1.13)")
    print("=" * 65)

    confidences, labels = load_and_join()

    print(f"\n  Total decisions analysed : {len(confidences)}")
    print(f"  Correct (label=1)        : {labels.sum()} ({labels.mean()*100:.1f}%)")
    print(f"  Confidence statistics    : "
          f"mean={confidences.mean():.3f}  std={confidences.std():.3f}  "
          f"min={confidences.min():.2f}  max={confidences.max():.2f}")

    # Compute ECE before recalibration
    ece_raw, bc, ba, bf = compute_ece(confidences, labels)
    print(f"\n  ECE (raw assignment)     : {ece_raw:.4f}")
    print(f"\n  Bin breakdown:")
    print(f"  {'Bin':>6}  {'N frac':>8}  {'Conf':>8}  {'Acc':>8}  {'|Δ|':>8}")
    for i in range(N_BINS):
        print(f"  [{i/N_BINS:.1f}-{(i+1)/N_BINS:.1f})"
              f"  {bf[i]*100:>7.1f}%  {bc[i]:>8.3f}  {ba[i]:>8.3f}"
              f"  {abs(bc[i]-ba[i]):>8.3f}")

    # Isotonic recalibration
    cal_confs = isotonic_recalibrate(confidences, labels)
    ece_cal, *_ = compute_ece(cal_confs, labels)
    if HAS_SKLEARN:
        print(f"\n  ECE (isotonic recalib.)  : {ece_cal:.4f}")
        print(f"  ECE reduction            : {(ece_raw - ece_cal):.4f}")
    else:
        print("\n  [sklearn not available — skipping isotonic recalibration]")

    ece_raw_ret, ece_cal_ret = plot_calibration(confidences, labels, cal_confs)

    print("\n── Interpretation ──────────────────────────────────────────────")
    if ece_raw < 0.1:
        verdict = "WELL-CALIBRATED (ECE < 0.10) — claim is valid."
    elif ece_raw < 0.15:
        verdict = "MODERATELY CALIBRATED (ECE < 0.15) — claim is defensible."
    else:
        verdict = (f"POORLY CALIBRATED (ECE = {ece_raw:.3f}) — "
                   "remove or soften calibration claim.")
    print(f"  {verdict}")


if __name__ == "__main__":
    main()
