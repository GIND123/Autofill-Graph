"""
18_model_version_pin.py  —  AutoFillGraph §1.18
Pin the exact Mistral model version used in all experiments.
Runs a small reference run (5 fields) and archives the response to document
API behaviour at the time of submission.

Saves: data/standard_benchmarks_lite/model_version_pin.json

Run:  $env:PYTHONUTF8="1"; python "Agentic Fixes/code/18_model_version_pin.py"
"""

import json, os, time
from pathlib import Path
from datetime import datetime

ROOT     = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "standard_benchmarks_lite"

MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "SQl56lauKekmdvLK9IJmgGMMxBbjHpUx")
MISTRAL_MODEL   = "mistral-small-latest"

REFERENCE_FIELDS = [
    ("Full Name",   "Alex Johnson"),
    ("Email",       "alex.johnson@email.com"),
    ("Phone",       "+1-555-123-4567"),
    ("Employer",    "TechCorp Inc."),
    ("University",  "University of California, Berkeley"),
]

USER_PROFILE_BLOB = (
    "full_name: Alex Johnson\n"
    "email: alex.johnson@email.com\n"
    "phone: +1-555-123-4567\n"
    "employer: TechCorp Inc.\n"
    "university: University of California, Berkeley\n"
)

SYSTEM_PROMPT = (
    "You are an autofill assistant. Given a user profile and a form field label, "
    "return ONLY the value. No explanation."
)


def main():
    from mistralai.client import Mistral
    client = Mistral(api_key=MISTRAL_API_KEY)

    print("=== Model Version Pin (§1.18) ===\n")

    # Probe the API to get the model version info
    pin_record = {
        "model_alias":      MISTRAL_MODEL,
        "pin_date":         datetime.utcnow().isoformat() + "Z",
        "reference_fields": [],
        "all_correct":      None,
    }

    all_correct = True
    for label, expected in REFERENCE_FIELDS:
        prompt = f"User profile:\n{USER_PROFILE_BLOB}\nForm field: \"{label}\"\nValue:"
        try:
            r = client.chat.complete(
                model=MISTRAL_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                max_tokens=30,
                temperature=0.0,
            )
            predicted = r.choices[0].message.content.strip()
            ok = expected.lower() in predicted.lower() or predicted.lower() in expected.lower()
            if not ok: all_correct = False
            # Capture model metadata from response
            model_used = getattr(r, "model", MISTRAL_MODEL)
            pin_record["model_version_from_response"] = model_used

            print(f"  [{label}] expected={expected!r}  got={predicted!r}  ok={ok}")
            pin_record["reference_fields"].append({
                "label": label, "expected": expected,
                "predicted": predicted, "ok": ok,
            })
        except Exception as e:
            print(f"  [{label}] ERROR: {e}")
            pin_record["reference_fields"].append({"label": label, "error": str(e)})
            all_correct = False
        time.sleep(0.3)

    pin_record["all_correct"] = all_correct

    out = DATA_DIR / "model_version_pin.json"
    out.write_text(json.dumps(pin_record, indent=2), encoding="utf-8")
    print(f"\nSaved: {out}")
    print(f"Model alias:   {MISTRAL_MODEL}")
    print(f"Model version: {pin_record.get('model_version_from_response', 'N/A')}")
    print(f"All correct:   {all_correct}")
    print(f"Pin date:      {pin_record['pin_date']}")
    print("\nNote: mistral-small-latest resolves to the current production version.")
    print("If results change after submission, this record documents the API state at pin time.")


if __name__ == "__main__":
    main()
