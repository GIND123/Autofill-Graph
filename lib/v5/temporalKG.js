(function initAutoFillGraphV5TemporalKG(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;

  if (!Schema || !Utils) throw new Error("Load schema.js and utils.js before temporalKG.js");

  // ── TemporalKG ──────────────────────────────────────────────────────────────
  // JS-native directed graph (adjacency list) mirroring Prototype5's NetworkX
  // TemporalKG.  Each property node stores an AttributeValue list for temporal
  // versioning; organisation/location nodes carry relation edges.

  class TemporalKG {
    constructor(data = {}) {
      // nodes: Map<nodeId, {type, label, layer?, ...}>
      this._nodes = new Map();
      // edges: Array<{from, to, prop?, value?, relation?, valid_from, valid_until, confidence, source}>
      this._edges = [];
      // attrs: Map<prop, AttributeValue[]>  (raw attribute timeline)
      this._attrs = new Map();
      // retractions: Set<"prop:rule">
      this._retractions = new Set();

      // Root "user" node
      this._nodes.set("user", { type: Schema.EntityType.PERSON, label: "User" });

      if (data.nodes) {
        for (const [id, node] of data.nodes) this._nodes.set(id, node);
      }
      if (data.edges) this._edges = [...data.edges];
      if (data.attrs) {
        for (const [prop, vals] of data.attrs) {
          this._attrs.set(prop, vals.map(v => Object.assign(Object.create(_AttrProto), v)));
        }
      }
      if (data.retractions) {
        for (const r of data.retractions) this._retractions.add(r);
      }
    }

    // ── Store a property value with temporal validity ─────────────────────────
    store(prop, value, source = "user", confidence = 1.0, expirePrevious = true) {
      if (!this._attrs.has(prop)) this._attrs.set(prop, []);
      const list = this._attrs.get(prop);

      if (expirePrevious) {
        for (const a of list) {
          if (a.is_current() && String(a.value) !== String(value)) {
            a.valid_until = Utils.nowIso();
          }
        }
      }

      const attr = _makeAttr(prop, value, source, confidence);
      list.push(attr);

      // Mirror to graph
      const nodeId = `prop:${prop}`;
      if (!this._nodes.has(nodeId)) {
        this._nodes.set(nodeId, {
          type: "Property", label: prop,
          layer: Schema.PROP_LAYER[prop] || "general"
        });
      }
      this._edges.push({
        from: "user", to: nodeId, prop, value: String(value),
        valid_from: attr.valid_from, valid_until: null,
        confidence, source
      });
      return attr;
    }

    // ── Add an organisation / location entity and relation edge ───────────────
    addEntity(type, label, relation) {
      const nid = `entity:${type.toLowerCase()}:${Utils.canonicalId(label)}`;
      if (!this._nodes.has(nid)) {
        this._nodes.set(nid, { type, label });
      }
      this._edges.push({
        from: "user", to: nid, relation, valid_from: Utils.nowIso(), valid_until: null
      });
    }

    // ── Current snapshot filtered by sensitivity ──────────────────────────────
    current(maxSens = Schema.Sensitivity.PUBLIC) {
      const rank = {
        [Schema.Sensitivity.PUBLIC]: 0,
        [Schema.Sensitivity.RESTRICTED]: 1,
        [Schema.Sensitivity.ENCRYPTED]: 2
      };
      const out = {};
      for (const [prop, vals] of this._attrs.entries()) {
        const sens = Schema.getSensitivityForProperty(prop);
        if (rank[sens] > rank[maxSens]) continue;
        const active = vals.filter(a => a.is_current());
        if (active.length) {
          // pick most-recently-created active value
          const latest = active.sort(
            (a, b) => new Date(b.valid_from) - new Date(a.valid_from)
          )[0];
          out[prop] = latest.value;
        }
      }
      return out;
    }

    // ── Full temporal history for a property ──────────────────────────────────
    history(prop) { return this._attrs.get(prop) || []; }

    // ── Check if domain has any user-provided data ────────────────────────────
    hasDomainData(domain) {
      const cur = this.current(Schema.Sensitivity.ENCRYPTED);
      const props = Schema.DOMAIN_PROPERTIES[domain] || [];
      return props.some(p => cur[p] !== undefined && cur[p] !== "" && cur[p] !== "UNKNOWN");
    }

    // ── KG triples as natural-language strings (for retriever) ────────────────
    triples(maxSens = Schema.Sensitivity.PUBLIC) {
      const out = [];
      const cur = this.current(maxSens);
      for (const [prop, val] of Object.entries(cur)) {
        out.push(`User ${prop.replace(/_/g, " ")} is ${val}`);
      }
      for (const edge of this._edges) {
        if (edge.relation && this._nodes.has(edge.to)) {
          const node = this._nodes.get(edge.to);
          if (node.type === Schema.EntityType.ORGANIZATION ||
              node.type === Schema.EntityType.LOCATION) {
            out.push(`User ${edge.relation} ${node.label}`);
          }
        }
      }
      return out;
    }

    // ── Graph statistics ──────────────────────────────────────────────────────
    graphStats() {
      return {
        nodes: this._nodes.size,
        edges: this._edges.length,
        current_facts: Object.keys(this.current(Schema.Sensitivity.ENCRYPTED)).length,
        total_records: [...this._attrs.values()].reduce((s, v) => s + v.length, 0),
        retractions: this._retractions.size
      };
    }

    // ── Serialise / deserialise ───────────────────────────────────────────────
    serialize() {
      return {
        nodes: Array.from(this._nodes.entries()),
        edges: this._edges,
        attrs: Array.from(this._attrs.entries()).map(
          ([prop, vals]) => [prop, vals.map(a => ({
            prop: a.prop, value: a.value, valid_from: a.valid_from,
            valid_until: a.valid_until, confidence: a.confidence,
            source: a.source, sensitivity: a.sensitivity
          }))]
        ),
        retractions: Array.from(this._retractions)
      };
    }

    static deserialize(data = {}) {
      return new TemporalKG(data);
    }
  }

  // ── Minimal AttributeValue proto ─────────────────────────────────────────────

  const _AttrProto = {
    is_current() {
      return this.valid_until === null || this.valid_until === undefined;
    }
  };

  function _makeAttr(prop, value, source, confidence) {
    return Object.assign(Object.create(_AttrProto), {
      prop,
      value,
      valid_from: Utils.nowIso(),
      valid_until: null,
      confidence: Number(confidence),
      source,
      sensitivity: Schema.getSensitivityForProperty(prop)
    });
  }

  const api = Object.freeze({ TemporalKG });

  root.AutoFillGraphV5TemporalKG = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
