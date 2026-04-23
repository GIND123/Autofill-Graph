(function initAutoFillGraphV3Memory(root) {
  "use strict";

  const Schema = root.AutoFillGraphV3Schema;
  const Utils = root.AutoFillGraphV3Utils;

  if (!Schema || !Utils) {
    throw new Error("Load schema.js and utils.js before memory.js");
  }

  class AttributeValue {
    constructor(property, value, options = {}) {
      this.id = options.id || Utils.createId("attr");
      this.property = property;
      this.value = value;
      this.valid_from = options.valid_from || Utils.nowIso();
      this.valid_until = options.valid_until || null;
      this.confidence = Number(options.confidence ?? 1.0);
      this.source = options.source || "user";
      this.provenance = options.provenance || [];
      this.layer = options.layer || Schema.getLayerForProperty(property);
      this.sensitivity = options.sensitivity || Schema.getSensitivityForProperty(property);
      this.verified = Boolean(options.verified || this.confidence >= 0.95);
    }

    isCurrent(at = new Date()) {
      const validFrom = new Date(this.valid_from);
      if (at < validFrom) return false;
      if (this.valid_until && at >= new Date(this.valid_until)) return false;
      return true;
    }

    expire(at = Utils.nowIso()) {
      this.valid_until = at;
    }

    toJSON() {
      return {
        id: this.id,
        property: this.property,
        value: this.value,
        valid_from: this.valid_from,
        valid_until: this.valid_until,
        confidence: this.confidence,
        source: this.source,
        provenance: this.provenance,
        layer: this.layer,
        sensitivity: this.sensitivity,
        verified: this.verified
      };
    }
  }

  class FillResult {
    constructor(field, options = {}) {
      this.field = field;
      this.property = options.property || null;
      this.value = options.value ?? null;
      this.status = options.status || Schema.FillStatus.UNKNOWN;
      this.route = options.route || null;
      this.confidence = Number(options.confidence ?? 0);
      this.evidence = options.evidence || [];
      this.reason = options.reason || "";
      this.sensitivity = options.sensitivity || null;
    }

    toJSON() {
      return {
        field: this.field,
        property: this.property,
        value: this.value,
        status: this.status,
        route: this.route,
        confidence: this.confidence,
        evidence: this.evidence,
        reason: this.reason,
        sensitivity: this.sensitivity
      };
    }
  }

  class FillEpisode {
    constructor(options = {}) {
      this.id = options.id || Utils.createId("episode");
      this.form_domain = options.form_domain || "general";
      this.created_at = options.created_at || Utils.nowIso();
      this.fields = options.fields || [];
      this.results = options.results || [];
      this.feedback = options.feedback || {};
      this.accuracy = options.accuracy ?? null;
      this.metadata = options.metadata || {};
    }

    addResult(result) {
      this.results.push(result instanceof FillResult ? result.toJSON() : result);
    }

    toJSON() {
      return {
        id: this.id,
        form_domain: this.form_domain,
        created_at: this.created_at,
        fields: this.fields,
        results: this.results,
        feedback: this.feedback,
        accuracy: this.accuracy,
        metadata: this.metadata
      };
    }
  }

  class SemanticMemory {
    constructor(data = {}) {
      this.entities = new Map(data.entities || [["user", { type: Schema.EntityType.PERSON, display_name: "User" }]]);
      this.attributes = new Map();
      this.relations = data.relations || [];
      this.retractions = new Set(data.retractions || []);

      if (data.attributes) {
        for (const [entityId, attrs] of data.attributes) {
          this.attributes.set(entityId, new Map());
          for (const [property, values] of attrs) {
            this.attributes.get(entityId).set(
              property,
              values.map((value) => new AttributeValue(value.property || property, value.value, value))
            );
          }
        }
      }
    }

    ensureEntity(entityId, type = Schema.EntityType.PERSON, displayName = null, extra = {}) {
      const id = Utils.canonicalId(entityId);
      if (!this.entities.has(id)) {
        this.entities.set(id, {
          type,
          display_name: displayName || entityId,
          aliases: extra.aliases || [],
          created_at: extra.created_at || Utils.nowIso()
        });
      }
      return id;
    }

    addRelation(head, relation, tail, options = {}) {
      const entry = {
        id: options.id || Utils.createId("rel"),
        head: Utils.canonicalId(head),
        relation,
        tail: Utils.canonicalId(tail),
        confidence: Number(options.confidence ?? 1.0),
        source: options.source || "user",
        created_at: options.created_at || Utils.nowIso()
      };
      const exists = this.relations.some(
        (r) => r.head === entry.head && r.tail === entry.tail && r.relation === entry.relation
      );
      if (!exists) this.relations.push(entry);
      return entry;
    }

    storeAttribute(entityId, property, value, options = {}) {
      const id = this.ensureEntity(entityId);
      if (!this.attributes.has(id)) this.attributes.set(id, new Map());
      const entityAttrs = this.attributes.get(id);
      if (!entityAttrs.has(property)) entityAttrs.set(property, []);

      if (options.expireExisting !== false) {
        for (const existing of entityAttrs.get(property)) {
          if (existing.isCurrent() && existing.value !== value) existing.expire();
        }
      }

      const attr = new AttributeValue(property, value, options);
      entityAttrs.get(property).push(attr);
      return attr;
    }

    getCurrentAttribute(entityId, property, maxSensitivity = Schema.Sensitivity.PUBLIC) {
      const attrs = this.getCurrentAttributes(entityId, maxSensitivity);
      return attrs[property] ?? null;
    }

    getCurrentAttributes(entityId = "user", maxSensitivity = Schema.Sensitivity.PUBLIC) {
      const id = Utils.canonicalId(entityId);
      const entityAttrs = this.attributes.get(id);
      const out = {};
      if (!entityAttrs) return out;

      for (const [property, values] of entityAttrs.entries()) {
        const filtered = values.filter((attr) => attr.isCurrent() && this.canExpose(attr.sensitivity, maxSensitivity));
        const latest = Utils.latestByValidFrom(filtered);
        if (latest) out[property] = latest.value;
      }
      return out;
    }

    hasAnyDomainData(domain) {
      const props = Schema.DOMAIN_PROPERTIES[domain] || [];
      const attrs = this.getCurrentAttributes("user", Schema.Sensitivity.ENCRYPTED);
      return props.some((property) => attrs[property] !== undefined && attrs[property] !== null && attrs[property] !== "");
    }

    canExpose(actual, maxSensitivity) {
      if (maxSensitivity === Schema.Sensitivity.ENCRYPTED) return true;
      if (maxSensitivity === Schema.Sensitivity.RESTRICTED) return actual !== Schema.Sensitivity.ENCRYPTED;
      return actual === Schema.Sensitivity.PUBLIC;
    }

    addRetraction(property, rule) {
      this.retractions.add(`${property}:${rule}`);
    }

    isRetracted(property, rule) {
      return this.retractions.has(`${property}:${rule}`);
    }

    toTriples(maxSensitivity = Schema.Sensitivity.PUBLIC) {
      const triples = [];
      for (const [entityId, entityAttrs] of this.attributes.entries()) {
        for (const [property, values] of entityAttrs.entries()) {
          const latest = Utils.latestByValidFrom(
            values.filter((attr) => attr.isCurrent() && this.canExpose(attr.sensitivity, maxSensitivity))
          );
          if (latest) {
            triples.push({
              type: "attribute",
              entity: entityId,
              property,
              value: latest.value,
              sensitivity: latest.sensitivity,
              sentence: `${entityId} ${property} is ${latest.value}`
            });
          }
        }
      }
      for (const relation of this.relations) {
        triples.push({
          type: "relation",
          ...relation,
          sentence: `${relation.head} ${relation.relation} ${relation.tail}`
        });
      }
      return triples;
    }

    serialize() {
      return {
        entities: Array.from(this.entities.entries()),
        attributes: Array.from(this.attributes.entries()).map(([entityId, attrs]) => [
          entityId,
          Array.from(attrs.entries()).map(([property, values]) => [property, values.map((value) => value.toJSON())])
        ]),
        relations: this.relations,
        retractions: Array.from(this.retractions)
      };
    }
  }

  class EpisodicMemory {
    constructor(data = {}) {
      this.episodes = data.episodes || [];
      this.fieldHistory = data.fieldHistory || {};
    }

    addEpisode(episode) {
      const serialized = episode instanceof FillEpisode ? episode.toJSON() : episode;
      this.episodes.push(serialized);
      return serialized;
    }

    recordFeedback(property, action) {
      if (!property) return;
      if (!this.fieldHistory[property]) this.fieldHistory[property] = [];
      this.fieldHistory[property].push({ action, at: Utils.nowIso() });
    }

    historicalAccuracy(property, windowSize = 20) {
      const history = (this.fieldHistory[property] || []).slice(-windowSize);
      if (!history.length) return 1.0;
      const score = history.reduce((total, item) => {
        if (item.action === Schema.FeedbackAction.ACCEPT) return total + 1.0;
        if (item.action === Schema.FeedbackAction.CORRECT) return total + 0.2;
        return total;
      }, 0);
      return score / history.length;
    }

    calibrateConfidence(property, storedConfidence) {
      const historical = this.historicalAccuracy(property);
      return Utils.clamp(0.6 * Number(storedConfidence || 0) + 0.4 * historical, 0, 1);
    }

    serialize() {
      return {
        episodes: this.episodes,
        fieldHistory: this.fieldHistory
      };
    }
  }

  class WorkingMemory {
    constructor() {
      this.reset();
    }

    reset() {
      this.session_id = Utils.createId("session");
      this.active_fields = [];
      this.partial_results = {};
      this.bandit_contexts = {};
      this.started_at = Utils.nowIso();
    }
  }

  const api = Object.freeze({
    AttributeValue,
    FillResult,
    FillEpisode,
    SemanticMemory,
    EpisodicMemory,
    WorkingMemory
  });

  root.AutoFillGraphV3Memory = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
