(function initAutoFillGraphV5InferenceEngine(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;

  if (!Schema || !Utils) throw new Error("Load schema.js and utils.js before inferenceEngine.js");

  // ── InferenceEngine — 7 guarded rules ─────────────────────────────────────
  // Mirrors Prototype5 InferenceEngine exactly:
  //   1. address_parse_zip
  //   2. address_parse_state
  //   3. address_parse_city
  //   4. phone_country_code
  //   5. degree_to_department
  //   6. email_as_work_email
  //   7. university_as_employer
  //
  // Each rule:
  //   - skips if the prop is already set with an explicit (non-inferred) value
  //   - skips if (prop, rule) is retracted
  //   - expires prior inferred value for same rule before writing a new one

  class InferenceEngine {
    run(kg) {
      const cur  = kg.current(Schema.Sensitivity.ENCRYPTED);
      const made = [];

      const maybe = (prop, value, rule, conf) => {
        if (!value || value === "null" || value === "undefined") return;
        const retKey = `${prop}:${rule}`;
        if (kg._retractions.has(retKey)) return;

        const allVals = kg._attrs.get(prop) || [];
        const activeExplicit = allVals.filter(
          a => a.is_current() && !a.source.startsWith("inferred:")
        );
        if (activeExplicit.length) return;

        const activeInferred = allVals.filter(
          a => a.is_current() && a.source === `inferred:${rule}`
        );
        if (activeInferred.length && String(activeInferred[activeInferred.length - 1].value) === String(value)) return;

        for (const a of activeInferred) a.valid_until = Utils.nowIso();

        kg.store(prop, value, `inferred:${rule}`, conf, false);
        made.push({ prop, value, rule });
      };

      // 1 & 2 & 3: address parsing
      const addr = String(cur.address || "");
      if (addr) {
        const zipM = addr.match(/\b(\d{5}(?:-\d{4})?)\b/);
        maybe("zip_code", zipM ? zipM[1] : null, "address_parse_zip", 0.90);

        const stateM = addr.match(/\b([A-Z]{2})\b/);
        maybe("state", stateM ? stateM[1] : null, "address_parse_state", 0.90);

        let cityM = addr.match(/^\s*([A-Za-z .'-]+)\s*,\s*[A-Z]{2}\b/);
        if (!cityM) cityM = addr.match(/,\s*([A-Za-z .'-]+)\s+[A-Z]{2}\b/);
        maybe("city", cityM ? cityM[1].trim() : null, "address_parse_city", 0.90);
      }

      // 4: phone country code
      const phone = String(cur.phone || "");
      if (phone) {
        const prefixMap = {
          "+1": "United States", "+44": "United Kingdom",
          "+91": "India", "+49": "Germany", "+33": "France",
          "+86": "China", "+81": "Japan", "+55": "Brazil"
        };
        const prefix = Object.keys(prefixMap).find(p => phone.startsWith(p));
        maybe("country", prefix ? prefixMap[prefix] : null, "phone_country_code", 0.90);
      }

      // 5: degree → department
      const degree = String(cur.degree || "");
      if (degree) {
        const m = degree.match(/\b(?:in|of)\s+(.+)$/i);
        maybe("department", m ? m[1].trim() : null, "degree_to_department", 0.85);
      }

      // 6: email → work_email
      const email = cur.email;
      if (email) maybe("work_email", email, "email_as_work_email", 0.60);

      // 7: university + student signals → employer
      const univ = cur.university;
      if (univ && (cur.degree || cur.gpa || cur.graduation_date)) {
        maybe("employer", univ, "university_as_employer", 0.70);
      }

      return made;
    }
  }

  const api = Object.freeze({ InferenceEngine });

  root.AutoFillGraphV5InferenceEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
