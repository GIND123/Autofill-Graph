"""
10_rag_kv_baseline.py  —  AutoFillGraph §1.3
RAG-over-flat-KV baseline: given a form field label, retrieve the most
relevant key-value pairs from the user profile using BM25-style TF-IDF
similarity, then prompt Mistral-small to predict the value.

This isolates "structure of the KB" from "having retrieval at all." If
AutoFillGraph doesn't beat RAG-over-KV, the graph structure adds no value.

Saves: data/standard_benchmarks_lite/rag_kv_baseline_funsd.csv
       data/standard_benchmarks_lite/rag_kv_baseline_xfund_de.csv
       plots/10_rag_kv_baseline.{png,pdf}

Run:  $env:PYTHONUTF8="1"; python "Agentic Fixes/code/10_rag_kv_baseline.py"
"""

import csv, os, re, time
from pathlib import Path
from collections import defaultdict
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

# ── Same user profile as §1.1 ──────────────────────────────────────────────
USER_PROFILE = {
    "full_name": "Alex Johnson",
    "first_name": "Alex",
    "last_name": "Johnson",
    "display_name": "Alex J.",
    "email": "alex.johnson@email.com",
    "work_email": "alex.johnson@techcorp.com",
    "phone": "555-123-4567",
    "address": "123 Main Street, Apt 4B",
    "city": "San Francisco",
    "state": "California",
    "zip_code": "94105",
    "country": "United States",
    "employer": "TechCorp Inc.",
    "job_title": "Senior Software Engineer",
    "years_experience": "8",
    "skills": "Python, machine learning, data analysis, cloud computing",
    "linkedin": "linkedin.com/in/alexjohnson",
    "portfolio": "alexjohnson.dev",
    "university": "University of California Berkeley",
    "department": "Computer Science",
    "degree": "Master of Science",
    "gpa": "3.8",
    "graduation_date": "May 2018",
    "thesis": "Deep Learning for Natural Language Processing",
    "advisor": "Dr. Sarah Chen",
    "research_interests": "machine learning, NLP, knowledge graphs",
    "bio": "Senior software engineer with 8 years experience in ML systems.",
    "allergies": "none",
    "blood_type": "O+",
    "insurance_id": "INS-987654321",
    "ssn": "REDACTED",
    "tax_id": "TAX-123456789",
    "bank_name": "First National Bank",
    "annual_income": "120000",
    "passport_number": "REDACTED",
    "visa_status": "US Citizen",
    "citizenship": "United States",
    "drivers_license": "CA-D1234567",
}


def tokenize(text: str):
    return re.findall(r"[a-z0-9]+", text.lower().replace("_", " "))


def bm25_score(query_tokens, doc_tokens, k1=1.5, b=0.75, avg_len=5):
    """Simplified BM25 for short key strings."""
    dl = len(doc_tokens)
    score = 0.0
    freq = {}
    for t in doc_tokens:
        freq[t] = freq.get(t, 0) + 1
    for t in query_tokens:
        if t in freq:
            tf = freq[t] * (k1 + 1) / (freq[t] + k1 * (1 - b + b * dl / avg_len))
            score += tf   # IDF simplified to 1 for short profiles
    return score


def retrieve_top_k(field_label: str, k: int = 5):
    """Return top-k (key, value) pairs ranked by BM25 similarity to label."""
    q_tokens = tokenize(field_label)
    scores = []
    for key, val in USER_PROFILE.items():
        key_tokens = tokenize(key)
        s = bm25_score(q_tokens, key_tokens)
        scores.append((s, key, val))
    scores.sort(key=lambda x: -x[0])
    return [(k, v) for _, k, v in scores[:k]]


SYSTEM_PROMPT = (
    "You are an autofill assistant. You are given a small number of user profile "
    "key-value pairs that are most relevant to a form field. "
    "Return ONLY the value that best fills the form field. "
    "If none of the provided values match, return exactly: UNKNOWN. "
    "No explanation, no extra text."
)


def make_rag_prompt(field_label: str, top_kvs) -> str:
    kv_str = "\n".join(f"  {k.replace('_',' ')}: {v}" for k, v in top_kvs)
    return (
        f"Relevant profile entries:\n{kv_str}\n\n"
        f"Form field: \"{field_label}\"\n"
        f"Value (or UNKNOWN):"
    )


def call_mistral(client, field_label: str) -> str:
    top_kvs = retrieve_top_k(field_label, k=5)
    delays = [2, 5, 10, 20, 40]
    for attempt, delay in enumerate(delays):
        try:
            r = client.chat.complete(
                model=MISTRAL_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": make_rag_prompt(field_label, top_kvs)},
                ],
                max_tokens=60,
                temperature=0.0,
            )
            return r.choices[0].message.content.strip()
        except Exception as e:
            msg = str(e)
            if "429" in msg or "rate" in msg.lower():
                print(f"  Rate limited, waiting {delay}s (attempt {attempt+1})...")
                time.sleep(delay)
            else:
                print(f"  API error: {e}")
                return "UNKNOWN"
    return "UNKNOWN"


def normalize(v: str) -> str:
    return re.sub(r"\s+", " ", v.lower().strip().strip(".,;:"))


def values_match(predicted: str, expected: str) -> bool:
    p, e = normalize(predicted), normalize(expected)
    if p == e: return True
    if p in e or e in p: return True
    p2 = re.sub(r"[\s/\-]", "", p)
    e2 = re.sub(r"[\s/\-]", "", e)
    return p2 == e2 and len(p2) > 0


def load_existing(path: Path):
    if not path.exists():
        return {}
    return {(r["doc_id"], r["question"]): r
            for r in csv.DictReader(open(path, encoding="utf-8"))}


def run_dataset(client, fill_csv: Path, out_path: Path, ds_name: str):
    fill_rows = list(csv.DictReader(open(fill_csv, encoding="utf-8")))
    existing  = load_existing(out_path)
    print(f"\n{ds_name}: {len(fill_rows)} fill rows, {len(existing)} cached.")

    out_rows  = []
    api_calls = 0

    for i, row in enumerate(fill_rows):
        key = (row["doc_id"], row["raw_question"])
        if key in existing:
            out_rows.append(existing[key])
            continue

        predicted = call_mistral(client, row["raw_question"])
        api_calls += 1
        is_unknown = predicted.strip().upper() == "UNKNOWN"
        ok = (not is_unknown) and values_match(predicted, row["expected_value"])

        out_rows.append({
            "doc_id":         row["doc_id"],
            "split":          row["split"],
            "question":       row["raw_question"],
            "expected_prop":  row["expected_prop"],
            "expected_value": row["expected_value"],
            "rag_predicted":  predicted,
            "is_unknown":     str(is_unknown),
            "ok":             str(ok),
        })

        time.sleep(1.2)  # base delay every call

        if api_calls % 20 == 0 or i == len(fill_rows) - 1:
            corr = sum(1 for r in out_rows if r["ok"] == "True")
            print(f"  [{i+1}/{len(fill_rows)}] calls={api_calls}  "
                  f"acc={corr}/{len(out_rows)}={corr/len(out_rows)*100:.1f}%")
            with open(out_path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
                w.writeheader(); w.writerows(out_rows)

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader(); w.writerows(out_rows)

    correct = sum(1 for r in out_rows if r["ok"] == "True")
    unknowns = sum(1 for r in out_rows if r["is_unknown"] == "True")
    fill_acc = correct / len(out_rows) * 100
    abs_sim  = unknowns / len(out_rows) * 100  # fraction that returned UNKNOWN
    print(f"  {ds_name} RAG-KV fill acc: {fill_acc:.1f}%  UNKNOWN rate: {abs_sim:.1f}%")
    return fill_acc, abs_sim, api_calls, len(out_rows)


def main():
    from mistralai.client import Mistral
    client = Mistral(api_key=MISTRAL_API_KEY)

    # Run FUNSD
    funsd_fill_acc, funsd_unknown_rate, funsd_calls, funsd_n = run_dataset(
        client,
        DATA_DIR / "funsd_fill.csv",
        DATA_DIR / "rag_kv_baseline_funsd.csv",
        "FUNSD",
    )

    # Run XFUND-DE
    xfund_fill_acc, xfund_unknown_rate, xfund_calls, xfund_n = run_dataset(
        client,
        DATA_DIR / "xfund_de_fill.csv",
        DATA_DIR / "rag_kv_baseline_xfund_de.csv",
        "XFUND-DE",
    )

    # AutoFillGraph numbers for comparison
    ag_funsd_fill  = 53.8
    ag_xfund_fill  = 83.7
    ag_abs_acc     = 98.4
    ag_api_per_doc = 0.0

    flat_kv_fill_funsd = 13.5
    llm_direct_funsd   = 43.4

    funsd_api_per_doc = funsd_calls / 178
    xfund_api_per_doc = xfund_calls / 52

    print(f"\n=== RAG-over-flat-KV Results ===")
    print(f"FUNSD  RAG-KV: fill={funsd_fill_acc:.1f}%  UNKNOWN rate={funsd_unknown_rate:.1f}%  API/doc={funsd_api_per_doc:.2f}")
    print(f"XFUND  RAG-KV: fill={xfund_fill_acc:.1f}%  UNKNOWN rate={xfund_unknown_rate:.1f}%  API/doc={xfund_api_per_doc:.2f}")

    print(f"\nComparison (FUNSD fill accuracy):")
    print(f"  AutoFillGraph (graph+retrieval): {ag_funsd_fill:.1f}%  API/doc=0")
    print(f"  RAG-over-flat-KV (this):        {funsd_fill_acc:.1f}%  API/doc={funsd_api_per_doc:.2f}")
    print(f"  Mistral-small direct:           {llm_direct_funsd:.1f}%  API/doc=5.07")
    print(f"  Flat-KV no LLM:                 {flat_kv_fill_funsd:.1f}%  API/doc=0")
    print(f"  AG vs RAG-KV: {ag_funsd_fill - funsd_fill_acc:+.1f}pp")

    # ── Plot ───────────────────────────────────────────────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.suptitle("RAG-over-flat-KV Baseline (§1.3)\n"
                 "Isolating graph structure contribution from retrieval",
                 fontsize=11, fontweight="bold")

    COLORS = {
        "AutoFillGraph": "#0072B2",
        "RAG-KV":        "#CC79A7",
        "Mistral direct":"#D55E00",
        "Flat-KV":       "#E69F00",
    }

    # Panel A: FUNSD fill accuracy comparison
    ax = axes[0]
    systems = ["AutoFillGraph\n(graph+retrieval)", "RAG-over-\nflat-KV", "Mistral-small\ndirect", "Flat-KV\n(no LLM)"]
    vals    = [ag_funsd_fill, funsd_fill_acc, llm_direct_funsd, flat_kv_fill_funsd]
    cols    = [COLORS["AutoFillGraph"], COLORS["RAG-KV"], COLORS["Mistral direct"], COLORS["Flat-KV"]]
    bars = ax.bar(systems, vals, color=cols, zorder=3, width=0.55)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.8,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=10, fontweight="bold")
    ax.set_ylabel("Fill Accuracy (%)"); ax.set_ylim(0, 75)
    ax.set_title("FUNSD Fill Accuracy\n(178 docs)", fontsize=10)
    ax.yaxis.grid(True, alpha=0.3); ax.set_axisbelow(True)

    # Panel B: API calls per document
    ax = axes[1]
    api_vals = [ag_api_per_doc, funsd_api_per_doc, 5.07, 0.0]
    bars2 = ax.bar(systems, api_vals, color=cols, zorder=3, width=0.55)
    for bar, val in zip(bars2, api_vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05,
                f"{val:.2f}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    ax.set_ylabel("Avg API Calls per Document"); ax.set_ylim(0, 8)
    ax.set_title("API Call Efficiency\n(FUNSD)", fontsize=10)
    ax.yaxis.grid(True, alpha=0.3); ax.set_axisbelow(True)

    plt.tight_layout()
    for ext in ("png", "pdf"):
        plt.savefig(PLOTS_DIR / f"10_rag_kv_baseline.{ext}", dpi=300, bbox_inches="tight")
    print(f"\nPlot -> plots/10_rag_kv_baseline.{{png,pdf}}")
    plt.close()

    print(f"\n=== Paper-ready numbers (§1.3) ===")
    print(f"  RAG-KV FUNSD fill acc:  {funsd_fill_acc:.1f}%  API/doc={funsd_api_per_doc:.2f}")
    print(f"  RAG-KV XFUND-DE fill acc: {xfund_fill_acc:.1f}%")
    print(f"  AG vs RAG-KV (FUNSD): {ag_funsd_fill - funsd_fill_acc:+.1f}pp")
    print(f"  AG vs RAG-KV (XFUND-DE): {ag_xfund_fill - xfund_fill_acc:+.1f}pp")


if __name__ == "__main__":
    main()
