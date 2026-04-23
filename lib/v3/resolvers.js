(function initAutoFillGraphV3Resolvers(root) {
  "use strict";

  const Schema = root.AutoFillGraphV3Schema;
  const Utils = root.AutoFillGraphV3Utils;
  const Memory = root.AutoFillGraphV3Memory;

  if (!Schema || !Utils || !Memory) {
    throw new Error("Load schema.js, utils.js, and memory.js before resolvers.js");
  }

  class DomainGuard {
    constructor(options = {}) {
      this.guardedDomains = options.guardedDomains || ["medical", "financial", "legal"];
    }

    domainForProperty(property) {
      for (const [domain, properties] of Object.entries(Schema.DOMAIN_PROPERTIES)) {
        if (properties.includes(property)) return domain;
      }
      return "general";
    }

    shouldAbstain(semanticMemory, property) {
      const domain = this.domainForProperty(property);
      if (!this.guardedDomains.includes(domain)) return false;
      return !semanticMemory.hasAnyDomainData(domain);
    }

    resultFor(field, property) {
      return new Memory.FillResult(field, {
        property,
        status: Schema.FillStatus.UNKNOWN,
        route: Schema.Route.DOMAIN_GUARD,
        confidence: 0,
        sensitivity: Schema.getSensitivityForProperty(property),
        reason: "No user-provided data exists for this sensitive domain."
      });
    }
  }

  class CompositionalResolver {
    constructor(options = {}) {
      this.definitions = options.definitions || Schema.COMPOSITE_DEFINITIONS;
    }

    match(fieldLabel) {
      const normalized = Utils.normalizeText(fieldLabel);
      for (const [composite, components] of Object.entries(this.definitions)) {
        const label = Utils.normalizeText(composite);
        if (normalized.includes(label) || label.includes(normalized)) {
          return { composite, components };
        }
      }

      if (normalized.includes("address")) {
        return { composite: "full_address", components: this.definitions.full_address };
      }
      if (normalized.includes("contact")) {
        return { composite: "contact_info", components: this.definitions.contact_info };
      }
      if (normalized.includes("academic")) {
        return { composite: "academic_info", components: this.definitions.academic_info };
      }
      return null;
    }

    resolve(fieldLabel, attrs) {
      const matched = this.match(fieldLabel);
      if (!matched) return null;
      const available = matched.components
        .map((property) => ({ property, value: attrs[property] }))
        .filter((item) => item.value !== undefined && item.value !== null && item.value !== "");

      if (available.length < 2) return null;

      return new Memory.FillResult(fieldLabel, {
        property: matched.composite,
        value: available.map((item) => item.value).join(", "),
        status: Schema.FillStatus.FILLED,
        route: Schema.Route.COMPOSITIONAL,
        confidence: Math.min(0.9, 0.75 + available.length * 0.03),
        evidence: available
      });
    }
  }

  class InferenceEngine {
    infer(semanticMemory) {
      const attrs = semanticMemory.getCurrentAttributes("user", Schema.Sensitivity.ENCRYPTED);
      const inferred = [];

      this.maybeInferAddressParts(semanticMemory, attrs, inferred);
      this.maybeInferPhoneCountry(semanticMemory, attrs, inferred);
      this.maybeInferDegreeDepartment(semanticMemory, attrs, inferred);
      this.maybeInferWorkEmail(semanticMemory, attrs, inferred);
      this.maybeInferStudentEmployer(semanticMemory, attrs, inferred);

      return inferred;
    }

    maybeStore(semanticMemory, property, value, rule, sourceFacts, confidence, inferred) {
      if (!value || semanticMemory.isRetracted(property, rule)) return;
      if (semanticMemory.getCurrentAttribute("user", property, Schema.Sensitivity.ENCRYPTED)) return;
      const attr = semanticMemory.storeAttribute("user", property, value, {
        source: `inferred:${rule}`,
        confidence,
        provenance: sourceFacts,
        expireExisting: false
      });
      inferred.push({ property, value, rule, confidence, attrId: attr.id });
    }

    maybeInferAddressParts(semanticMemory, attrs, inferred) {
      const address = attrs.address;
      if (!address) return;
      const zip = String(address).match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
      const state = String(address).match(/\b[A-Z]{2}\b/)?.[0];
      const city = String(address).match(/,\s*([^,]+)\s+[A-Z]{2}\b/)?.[1]?.trim();
      this.maybeStore(semanticMemory, "zip_code", zip, "address_parse_zip", [address], 0.9, inferred);
      this.maybeStore(semanticMemory, "state", state, "address_parse_state", [address], 0.9, inferred);
      this.maybeStore(semanticMemory, "city", city, "address_parse_city", [address], 0.9, inferred);
    }

    maybeInferPhoneCountry(semanticMemory, attrs, inferred) {
      const phone = attrs.phone;
      if (!phone) return;
      const map = {
        "+1": "United States",
        "+44": "United Kingdom",
        "+91": "India",
        "+49": "Germany",
        "+33": "France"
      };
      const prefix = Object.keys(map).find((item) => String(phone).startsWith(item));
      this.maybeStore(semanticMemory, "country", prefix ? map[prefix] : null, "phone_country_code", [phone], 0.9, inferred);
    }

    maybeInferDegreeDepartment(semanticMemory, attrs, inferred) {
      const degree = attrs.degree;
      if (!degree) return;
      const match = String(degree).match(/\b(?:in|of)\s+(.+)$/i);
      this.maybeStore(semanticMemory, "department", match?.[1]?.trim(), "degree_to_department", [degree], 0.85, inferred);
    }

    maybeInferWorkEmail(semanticMemory, attrs, inferred) {
      this.maybeStore(semanticMemory, "work_email", attrs.email, "email_as_work_email", [attrs.email], 0.6, inferred);
    }

    maybeInferStudentEmployer(semanticMemory, attrs, inferred) {
      if (!attrs.university) return;
      const hasStudentSignal = Boolean(attrs.degree || attrs.gpa || attrs.graduation_date);
      if (hasStudentSignal) {
        this.maybeStore(
          semanticMemory,
          "employer",
          attrs.university,
          "university_as_employer",
          [attrs.university, attrs.degree || attrs.gpa || attrs.graduation_date],
          0.7,
          inferred
        );
      }
    }
  }

  class MemoryConsolidator {
    processFeedback({ episode, feedback, semanticMemory, episodicMemory, router }) {
      const serializedEpisode = episode.toJSON ? episode.toJSON() : episode;
      serializedEpisode.feedback = feedback;

      for (const result of serializedEpisode.results || []) {
        const item = feedback[result.field];
        if (!item) continue;
        const action = typeof item === "string" ? item : item.action;
        episodicMemory.recordFeedback(result.property, action);

        if (router && result.route && result.contextVector) {
          router.update(result.route, result.contextVector, router.rewardFromFeedback(action));
        }

        if (action === Schema.FeedbackAction.CORRECT) {
          const correctedValue = typeof item === "object" ? item.value : null;
          if (correctedValue !== null && result.property) {
            semanticMemory.storeAttribute("user", result.property, correctedValue, {
              source: "feedback:correct",
              confidence: 1.0,
              provenance: [serializedEpisode.id, result.field]
            });
          }
        }

        if (
          (action === Schema.FeedbackAction.REJECT || action === Schema.FeedbackAction.CORRECT) &&
          result.evidence
        ) {
          for (const evidence of result.evidence) {
            if (evidence.rule && result.property) semanticMemory.addRetraction(result.property, evidence.rule);
          }
        }
      }

      episodicMemory.addEpisode(serializedEpisode);
      return serializedEpisode;
    }
  }

  const api = Object.freeze({
    DomainGuard,
    CompositionalResolver,
    InferenceEngine,
    MemoryConsolidator
  });

  root.AutoFillGraphV3Resolvers = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
