"""Build Prototype7.ipynb from Prototype6 source with targeted improvements."""
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')

nb6 = json.load(open('Prototype6.ipynb', encoding='utf-8'))
cells6 = {c['id']: ''.join(c.get('source', [])) for c in nb6['cells']}

def make_cell(cid, source):
    lines = source.split('\n')
    src = [l + '\n' for l in lines[:-1]] + ([lines[-1]] if lines[-1] else [])
    return {"cell_type": "code", "id": cid, "metadata": {},
            "outputs": [], "source": src, "execution_count": None}

def patch(src, old, new):
    if old not in src:
        print(f"  WARN: patch target not found: {repr(old[:60])}")
    return src.replace(old, new, 1)

def fix_em_dash(s):
    """Replace the cp1252-double-encoded em-dash (U+00E2 U+20AC U+201D) with real em-dash."""
    return s.replace('â€”', '—')

def replace_function(src, funcname, new_code, next_anchor):
    """Replace a top-level function from 'def funcname(' to just before next_anchor."""
    start = src.find(f'def {funcname}(')
    if start < 0:
        print(f"  WARN: function {funcname!r} not found")
        return src
    end = src.find(next_anchor, start)
    if end < 0:
        print(f"  WARN: anchor {next_anchor!r} not found after {funcname!r}")
        return src
    return src[:start] + new_code + '\n\n' + src[end:]

# ==============================================================================
# CELL 0 — init: update banner to v7
# ==============================================================================
c0 = cells6['cell-init']
c0 = patch(c0,
    'AutoFillGraph v6: Agentic Knowledge-Graph Autofill — Soft Metric Edition',
    'AutoFillGraph v7: Person-Centric KG · Multi-Profile · Enhanced Plots    ')
c0 = patch(c0,
    'NetworkX temporal KG · LinUCB bandit · LLM long-form QA · OCR fallback',
    'NetworkX temporal KG · LinUCB bandit · LLM long-form QA · OCR fallback  ')
c0 = patch(c0,
    'import matplotlib; matplotlib.use("Agg")\n    import matplotlib.pyplot as plt\n    import matplotlib.patches as mpatches\n    from matplotlib.gridspec import GridSpec\n    HAS_MPL = True',
    'import matplotlib; matplotlib.use("Agg")\n    import matplotlib.pyplot as plt\n    import matplotlib.patches as mpatches\n    from matplotlib.gridspec import GridSpec\n    import matplotlib.ticker as mticker\n    HAS_MPL = True')

# ==============================================================================
# CELL 1 — components: add TemporalKG.person_name()
# ==============================================================================
c1 = cells6['cell-components']

OLD_GS = '    def graph_stats(self) -> dict:\n        return dict(nodes=self.G.number_of_nodes(), edges=self.G.number_of_edges(),\n                    current_facts=len(self.current(Sensitivity.ENCRYPTED)),\n                    total_records=sum(len(v) for v in self._attrs.values()),\n                    retractions=len(self._retractions))'

NEW_GS = '''    def graph_stats(self) -> dict:
        return dict(nodes=self.G.number_of_nodes(), edges=self.G.number_of_edges(),
                    current_facts=len(self.current(Sensitivity.ENCRYPTED)),
                    total_records=sum(len(v) for v in self._attrs.values()),
                    retractions=len(self._retractions))

    def person_name(self) -> str:
        """Return the most current full_name stored, or 'User' if unknown."""
        active = [a for a in self._attrs.get("full_name", []) if a.is_current()]
        if active:
            return str(sorted(active, key=lambda a: a.valid_from)[-1].value)
        return "User"'''

c1 = patch(c1, OLD_GS, NEW_GS)

# ==============================================================================
# CELL 2 — agent: improve layout, person-centric draw_kg_snapshot, multi-profile
# ==============================================================================
c2 = cells6['cell-agent']

# Fix mojibake em-dash before patching (U+00E2 U+20AC U+201D → U+2014)
c2 = fix_em_dash(c2)

# ── _snapshot_layout: radial with layer-sorted properties ──
OLD_LAYOUT = '''def _snapshot_layout(G: nx.DiGraph) -> Dict[str, np.ndarray]:
    props = sorted([n for n, d in G.nodes(data=True) if d.get("type") == "Property"],
                   key=lambda n: G.nodes[n].get("label", n))
    ents = sorted([n for n, d in G.nodes(data=True) if n != "user" and d.get("type") != "Property"],
                  key=lambda n: G.nodes[n].get("label", n))
    pos = {"user": np.array([0.0, 0.0])}
    if props:
        for i, n in enumerate(props):
            theta = (2 * math.pi * i / max(1, len(props))) - (math.pi / 2)
            pos[n] = np.array([2.9 * math.cos(theta), 2.9 * math.sin(theta)])
    if ents:
        for i, n in enumerate(ents):
            theta = (2 * math.pi * i / max(1, len(ents))) - (math.pi / 2) + (math.pi / max(2, len(ents)))
            pos[n] = np.array([4.9 * math.cos(theta), 4.9 * math.sin(theta)])
    return pos'''

NEW_LAYOUT = '''def _snapshot_layout(G: nx.DiGraph) -> Dict[str, np.ndarray]:
    """Radial layout: person center → properties inner ring → entities outer ring."""
    props = sorted([n for n, d in G.nodes(data=True) if d.get("type") == "Property"],
                   key=lambda n: G.nodes[n].get("layer", "zzz") + G.nodes[n].get("label", n))
    ents = sorted([n for n, d in G.nodes(data=True) if n != "user" and d.get("type") != "Property"],
                  key=lambda n: G.nodes[n].get("label", n))
    pos = {"user": np.array([0.0, 0.0])}
    r_inner = 3.0 + max(0, len(props) - 10) * 0.08
    if props:
        for i, n in enumerate(props):
            theta = (2 * math.pi * i / max(1, len(props))) - (math.pi / 2)
            pos[n] = np.array([r_inner * math.cos(theta), r_inner * math.sin(theta)])
    r_outer = r_inner + 2.0
    if ents:
        for i, n in enumerate(ents):
            theta = (2 * math.pi * i / max(1, len(ents))) - (math.pi / 2) + (math.pi / max(2, len(ents)))
            pos[n] = np.array([r_outer * math.cos(theta), r_outer * math.sin(theta)])
    return pos'''

c2 = patch(c2, OLD_LAYOUT, NEW_LAYOUT)

# ── Patch plot_kg_evolution suptitle (now clean after fix_em_dash) ──
c2 = patch(c2,
    'fig.suptitle("AutoFillGraph v5 — NetworkX KG After Each Major Use", fontsize=15, fontweight="bold")',
    'fig.suptitle("AutoFillGraph v7 — Person-Centric KG After Each Major Use", fontsize=15, fontweight="bold")')

# ── Replace draw_kg_snapshot with person-centric version ──
# Use replace_function() to avoid matching the mojibake body
NEW_DRAW = '''LAYER_COLORS = {
    "identity": "#1d4ed8", "contact": "#0284c7", "academic": "#15803d",
    "professional": "#b45309", "medical": "#dc2626", "financial": "#991b1b",
    "legal": "#6d28d9", "document": "#7e22ce", "general": "#475569",
}
ENTITY_COLORS = {"Organization": "#16a34a", "Location": "#ca8a04",
                 "Document": "#9333ea", "Credential": "#ea580c"}

def _person_label(snapshot: dict) -> str:
    """Resolve the central person label from full_name in the snapshot."""
    hist = snapshot.get("attr_history", {}).get("full_name", [])
    curr = next((h for h in reversed(hist) if h.get("current")), None)
    return str(curr["value"])[:20] if curr else "User"

def draw_kg_snapshot(snapshot: dict, ax=None, show_edge_ts: bool = True):
    """Person-centric KG: identity hub at centre, properties inner ring, entities outer."""
    if not HAS_MPL:
        print("Matplotlib unavailable — cannot plot KG snapshots")
        return None
    G = snapshot["graph"]
    created = str(snapshot.get("captured_at", "")).replace("T", " ")[:19]
    person_lbl = _person_label(snapshot)
    if ax is None:
        fig, ax = plt.subplots(figsize=(11, 8))
    else:
        fig = ax.figure
    pos = _snapshot_layout(G)
    node_colors, node_sizes, labels = [], [], {}
    for n, d in G.nodes(data=True):
        ntype = d.get("type", "Unknown")
        if n == "user":
            node_colors.append("#1e1b4b")
            node_sizes.append(3200)
            labels[n] = f"{person_lbl}\\n(Person)"
        elif ntype == "Property":
            layer = d.get("layer", "general")
            node_colors.append(LAYER_COLORS.get(layer, "#64748b"))
            node_sizes.append(2000)
            labels[n] = _prop_label_for_snapshot(snapshot, d.get("label", n))
        else:
            node_colors.append(ENTITY_COLORS.get(ntype, "#f97316"))
            node_sizes.append(1700)
            label = str(d.get("label", n))
            if len(label) > 20: label = label[:20] + "..."
            labels[n] = f"{ntype}\\n{label}"
    nx.draw_networkx_nodes(G, pos, node_color=node_colors, node_size=node_sizes,
                           edgecolors="#f8fafc", linewidths=1.8, ax=ax)
    nx.draw_networkx_edges(G, pos, edge_color="#94a3b8", width=1.3,
                           arrows=True, arrowsize=15, ax=ax,
                           connectionstyle="arc3,rad=0.05")
    nx.draw_networkx_labels(G, pos, labels=labels, font_size=7.0,
                            font_weight="bold", font_color="white", ax=ax)
    if show_edge_ts:
        edge_labels = {}
        for u, v, d in G.edges(data=True):
            ts = str(d.get("valid_from", "")).replace("T", " ")[:10]
            if d.get("relation"):
                edge_labels[(u, v)] = str(d["relation"])
            elif d.get("prop") and ts:
                edge_labels[(u, v)] = ts
        if edge_labels:
            nx.draw_networkx_edge_labels(
                G, pos, edge_labels=edge_labels, font_size=5.8, rotate=False, ax=ax,
                bbox=dict(boxstyle="round,pad=0.1", fc="white", ec="none", alpha=0.7))
    shown_layers = set(G.nodes[n].get("layer","") for n in G.nodes if G.nodes[n].get("type")=="Property")
    patches = [mpatches.Patch(color=LAYER_COLORS.get(l,"#888"), label=l) for l in sorted(shown_layers) if l]
    patches.append(mpatches.Patch(color=ENTITY_COLORS["Organization"], label="Organization"))
    if patches:
        ax.legend(handles=patches, fontsize=6.5, loc="lower right", framealpha=0.85, ncol=2)
    stats = snapshot.get("stats", {})
    ax.set_title(
        f"{snapshot.get('label', 'KG Snapshot')}\\n"
        f"{created}  |  {stats.get('nodes', G.number_of_nodes())} nodes  |  {stats.get('current_facts', 0)} current facts",
        fontsize=10, fontweight="bold", pad=8)
    ax.set_facecolor("#f1f5f9")
    ax.axis("off")
    return fig'''

c2 = replace_function(c2, 'draw_kg_snapshot', NEW_DRAW, 'def plot_kg_evolution(')

# ── Add draw_multi_profile_kg before AGENT init ──
OLD_AGENT_INIT = 'AGENT = AutoFillAgent(EMBEDDER, LLM)'
NEW_AGENT_INIT = '''def draw_multi_profile_kg(agents_labels: list, title="Multi-Profile Knowledge Graphs"):
    """Side-by-side KG for each (agent, label) pair — one graph per person."""
    if not HAS_MPL: return None
    n = len(agents_labels)
    fig, axes = plt.subplots(1, n, figsize=(11 * n, 9))
    if n == 1: axes = [axes]
    for ax, (agent, lbl) in zip(axes, agents_labels):
        snap = capture_kg_snapshot(agent, lbl)
        draw_kg_snapshot(snap, ax=ax, show_edge_ts=False)
        GRAPH_SNAPSHOTS.pop()
    fig.suptitle(title, fontsize=14, fontweight="bold", y=1.01)
    plt.tight_layout()
    return fig


AGENT = AutoFillAgent(EMBEDDER, LLM)'''

c2 = patch(c2, OLD_AGENT_INIT, NEW_AGENT_INIT)

# ==============================================================================
# CELL 3 — learning: unchanged (suptitle patch is already in c2)
# ==============================================================================
c3 = cells6['cell-learning']

# ==============================================================================
# CELL 4 — multi-profile (NEW: Govind + Devika side-by-side)
# ==============================================================================
C_MULTI = '''# @title 4.5 — Multi-Profile Demonstration (Govind + Devika)
# v7 new: shows two separate person-centric KGs side by side

print("╔" + "═"*66 + "╗")
print("║  Multi-Profile Demo: Govind A  +  Devika R                       ║")
print("║  Each person gets their own Knowledge Graph node as identity hub  ║")
print("╚" + "═"*66 + "╝")

AGENT_DEVIKA = AutoFillAgent(EMBEDDER, LLM)

DEVIKA_R1 = {
    "Full Name":            "Devika R",
    "Primary Email":        "devika.r@mit.edu",
    "Phone Number":         "+1-617-555-0287",
    "Current Address":      "Cambridge, MA 02139",
    "Portfolio URL":        "github.com/devika-ml",
    "Professional Summary": ("ML engineer specializing in multimodal systems and "
                              "efficient inference. Focus: on-device LLMs, quantization, edge AI."),
}
learned_d1, inf_d1 = AGENT_DEVIKA.learn(DEVIKA_R1, "human:profile")
print(f"  Devika R1 — Learned {len(learned_d1)} props | Inferred: {[(p,r) for p,_,r in inf_d1]}")

DEVIKA_R2 = {
    "University Name":     "Massachusetts Institute of Technology",
    "Degree Program":      "PhD in Electrical Engineering and Computer Science",
    "Cumulative GPA":      "4.00",
    "Expected Graduation": "June 2027",
    "Thesis Advisor":      "Prof. Chen Wei",
    "Technical Skills":    "PyTorch, ONNX, TensorRT, CUDA, Quantization, Transformers",
    "Research Interests":  "Efficient inference, on-device ML, model compression, edge deployment",
}
learned_d2, inf_d2 = AGENT_DEVIKA.learn(DEVIKA_R2, "human:academic")
print(f"  Devika R2 — Learned {len(learned_d2)} props | Inferred: {[(p,r) for p,_,r in inf_d2]}")

DEVIKA_R3 = {"Passport Number": "P9876543", "Visa Status": "J-1 Research Scholar", "Citizenship": "India"}
AGENT_DEVIKA.learn(DEVIKA_R3, "human:legal")
print(f"  Devika KG: {AGENT_DEVIKA.kg.graph_stats()}")

DEVIKA_FIELDS = ["Legal Name", "Institutional Email", "Quantitative measure of academic performance",
                 "Faculty mentor supervising thesis work", "What tools can you use?",
                 "Numerical academic performance indicator"]
ep_devika = AGENT_DEVIKA.autofill(DEVIKA_FIELDS, domain="academic", use_llm=False)
show_ep(ep_devika, "Devika — Academic Form Autofill")
AGENT_DEVIKA.feedback(ep_devika, {f: "accept" for f in DEVIKA_FIELDS
                                  if ep_devika.results[f].status != FillStatus.UNKNOWN})

print("\\n── Cross-Profile: same form fields, different answers ──")
SHARED_FIELDS = ["Full Name", "Email", "University", "GPA", "Advisor"]
ep_g = AGENT.autofill(SHARED_FIELDS, domain="academic", use_llm=False)
ep_d = AGENT_DEVIKA.autofill(SHARED_FIELDS, domain="academic", use_llm=False)
print(f"  {\'Field\':<30} {\'Govind\':<35} {\'Devika\'}")
print("  " + "─"*90)
for f in SHARED_FIELDS:
    g_val = str(ep_g.results[f].value)[:33]
    d_val = str(ep_d.results[f].value)[:33]
    print(f"  {f:<30} {g_val:<35} {d_val}")

if HAS_MPL:
    fig_mp = draw_multi_profile_kg(
        [(AGENT, "Govind A — Profile"), (AGENT_DEVIKA, "Devika R — Profile")],
        title="AutoFillGraph v7 — Person-Centric KGs: Two Independent Profiles"
    )
    if fig_mp is not None:
        mp_path = os.path.join(tempfile.gettempdir(), "afg_figures", "multi_profile_kg.png")
        os.makedirs(os.path.dirname(mp_path), exist_ok=True)
        fig_mp.savefig(mp_path, dpi=150, bbox_inches="tight")
        plt.close(fig_mp)
        print(f"\\n  Multi-profile KG saved → {mp_path}")
        try:
            from IPython.display import Image as IPImage, display as ipy_display
            ipy_display(IPImage(mp_path))
        except Exception:
            pass
else:
    print("  Matplotlib unavailable — skipping multi-profile KG plot")

print(f"\\n  Govind  KG: {AGENT.kg.graph_stats()}")
print(f"  Devika  KG: {AGENT_DEVIKA.kg.graph_stats()}")
print(f"  Person names: Govind={AGENT.kg.person_name()!r} | Devika={AGENT_DEVIKA.kg.person_name()!r}")
print("✅ Multi-profile demonstration complete")
'''

# ==============================================================================
# CELL 8 — hard-eval: fix broken box-drawing chars
# ==============================================================================
c8 = cells6['cell-hard-eval']
# Fix box-drawing chars.  The top and bottom separator lines are identical in the
# original (both "????...????"), so we replace by count=1 twice: first → ╔╗, second → ╚╝.
_SEP_OLD = '????????????????????????????????????????????????????????????????????'
_SEP_TOP = '╔' + '═'*68 + '╗'
_SEP_BOT = '╚' + '═'*68 + '╝'
c8 = c8.replace(f'print("{_SEP_OLD}")', f'print("{_SEP_TOP}")', 1)
c8 = c8.replace(f'print("{_SEP_OLD}")', f'print("{_SEP_BOT}")', 1)
c8 = c8.replace(
    'print("?  Held-Out Semantic Stress Test                                 ?")',
    'print("║  Held-Out Semantic Stress Test                                  ║")')
c8 = c8.replace(
    'print("?  Tests paraphrases, composites, documents, and embedding value ?")',
    'print("║  Tests paraphrases, composites, documents, and embedding value  ║")')

c8 = c8.replace('print("? Held-out semantic stress test complete")',
                'print("✅ Held-out semantic stress test complete")')
c8 = c8.replace('# @title 8.5 ? Held-Out Semantic Stress Test | Embedding + Agentic Value',
                '# @title 8.5 — Held-Out Semantic Stress Test | Embedding + Agentic Value')

# ==============================================================================
# CELL 9 — figures-v7: completely replace with beautiful plots
# ==============================================================================
C_FIGURES = r'''# @title 9.0 — Visualisations (AutoFillGraph v7)
# Descriptive titles only — no "Fig X" numbering.

if not HAS_MPL:
    print("Matplotlib unavailable — skipping figures")
else:
    fig_dir = os.path.join(tempfile.gettempdir(), "afg_figures")
    os.makedirs(fig_dir, exist_ok=True)

    PAL = {
        "AutoFillGraph v7":  "#2563eb",
        "Pure Lookup":       "#16a34a",
        "No Embedding":      "#f59e0b",
        "Browser Autofill":  "#dc2626",
    }
    ROUTE_PAL = {
        "local": "#2563eb", "compositional": "#16a34a",
        "domain_guard": "#f59e0b", "image": "#9333ea",
        "retrieval_llm": "#dc2626", "inference": "#0891b2",
    }
    LAYER_PAL = LAYER_COLORS

    def _save(fig, fname, show=True):
        p = os.path.join(fig_dir, fname)
        fig.savefig(p, dpi=150, bbox_inches="tight")
        plt.close(fig)
        if show:
            try:
                from IPython.display import Image as IPImage, display as ipy_display
                ipy_display(IPImage(p))
            except Exception:
                pass
        return p

    saved = []

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 1 — Adversarial Accuracy
    # ══════════════════════════════════════════════════════════════════════════
    if "CHALLENGE_RESULTS" in globals():
        sys_order = ["Pure Lookup", "No Embedding", "AutoFillGraph v7"]
        CR = {("AutoFillGraph v7" if k=="AutoFillGraph v5" else k): v
              for k, v in CHALLENGE_RESULTS.items()}
        accs = [CR.get(s, 0) for s in sys_order]
        n_ch = sum(1 for r in challenge_rows if r["system"] == "AutoFillGraph v5")
        n_forms = len(set(r["case"] for r in challenge_rows if r["system"] == "AutoFillGraph v5"))

        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        ax = axes[0]
        colors = [PAL.get(s, "#888") for s in sys_order]
        bars = ax.barh(sys_order, accs, color=colors, edgecolor="#f8fafc", height=0.5)
        ax.set_xlim(0, 1.22)
        ax.set_xlabel("Accuracy", fontsize=11)
        ax.set_title(f"Agentic Accuracy vs. Field Complexity\n"
                     f"Held-out adversarial fields  (n={n_ch}, {n_forms} forms)", fontweight="bold")
        for bar, acc in zip(bars, accs):
            ax.text(acc + 0.015, bar.get_y() + bar.get_height()/2,
                    f"{acc:.0%}", va="center", fontsize=11, fontweight="bold")
        lift = accs[-1] - max(accs[:-1])
        ax.axvline(1.0, color="#94a3b8", ls="--", lw=1, alpha=0.5)
        ax.text(0.98, 0.06, f"+{lift:.0%} lift\nvs. best baseline",
                transform=ax.transAxes, ha="right", fontsize=9, color="#2563eb",
                bbox=dict(boxstyle="round,pad=0.3", fc="#eff6ff", ec="#2563eb"))
        ax.set_facecolor("#f8fafc")

        ax = axes[1]
        form_names = list(dict.fromkeys(
            r["case"] for r in challenge_rows if r["system"] == "AutoFillGraph v5"))
        x = np.arange(len(form_names)); w = 0.27
        for i, sname in enumerate(["Pure Lookup", "No Embedding", "AutoFillGraph v5"]):
            fa = [sum(r["ok"] for r in challenge_rows if r["system"]==sname and r["case"]==fn)
                  / max(1, sum(1 for r in challenge_rows if r["system"]==sname and r["case"]==fn))
                  for fn in form_names]
            disp = "AutoFillGraph v7" if sname=="AutoFillGraph v5" else sname
            ax.bar(x + i*w, fa, w, label=disp, color=PAL.get(disp, PAL.get(sname,"#888")),
                   edgecolor="#f8fafc", alpha=0.92)
        ax.set_xticks(x + w)
        ax.set_xticklabels([fn.replace("_t4","").replace("_","\n") for fn in form_names], fontsize=9)
        ax.set_ylim(0, 1.25); ax.set_ylabel("Accuracy")
        ax.set_title("Per-Form Accuracy\nHeld-Out Semantic Stress Test", fontweight="bold")
        ax.legend(fontsize=8); ax.axhline(1.0, color="#94a3b8", ls="--", lw=0.8, alpha=0.5)
        ax.set_facecolor("#f8fafc")
        fig.suptitle("AutoFillGraph v7 — Agentic Embedding Lift on Adversarial Forms",
                     fontsize=12, fontweight="bold", color="#1e293b")
        plt.tight_layout()
        saved.append(_save(fig, "plot_adversarial_challenge.png"))
        print("  Saved: Adversarial Challenge")

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 2 — FormBench v2 Quality
    # ══════════════════════════════════════════════════════════════════════════
    if HAS_PANDAS and "baseline_rows" in globals():
        df_bl = pd.DataFrame(baseline_rows)
        df_bl["system"] = df_bl["system"].replace({"AutoFillGraph v5": "AutoFillGraph v7"})
        tiers = sorted(df_bl["tier"].unique())
        sys_order4 = ["Browser Autofill", "Pure Lookup", "No Embedding", "AutoFillGraph v7"]
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        ax = axes[0]
        x = np.arange(len(tiers)); w = 0.20
        for i, sn in enumerate(sys_order4):
            ta = [float(df_bl[(df_bl["system"]==sn) & (df_bl["tier"]==t)]["ok"].mean())
                  if len(df_bl[(df_bl["system"]==sn) & (df_bl["tier"]==t)]) else 0
                  for t in tiers]
            ax.bar(x + i*w, ta, w, label=sn.replace(" Autofill",""),
                   color=PAL[sn], edgecolor="#f8fafc", alpha=0.93)
        ax.set_xticks(x + 1.5*w)
        ax.set_xticklabels([f"Tier {t}" for t in tiers], fontsize=10)
        ax.set_ylim(0, 1.25); ax.set_ylabel("Accuracy"); ax.legend(fontsize=8, loc="lower left")
        ax.text(0.99, 0.97, f"{len(FORMBENCH_V2)} forms · 7 domains · 3 tiers",
                transform=ax.transAxes, ha="right", va="top", fontsize=7, color="#64748b")
        ax.set_title("FormBench v2: Accuracy by Difficulty Tier\n(local path, 0 API calls)", fontweight="bold")
        ax.set_facecolor("#f8fafc")

        ax = axes[1]
        metrics_keys = ["token_f1","char_sim","sem_sim"]
        metrics_lbl  = ["Token F1","Char Sim","Semantic Sim"]
        x2 = np.arange(len(sys_order4)); w2 = 0.25
        for j, (mk, ml) in enumerate(zip(metrics_keys, metrics_lbl)):
            vals = []
            for sn in sys_order4:
                rs_soft = RESULTS_SOFT.get(sn, RESULTS_SOFT.get(sn.replace("v7","v5"), {}))
                vals.append(rs_soft.get(mk, 0) or 0)
            ax.bar(x2 + j*w2, vals, w2, label=ml, edgecolor="#f8fafc", alpha=0.9)
        ax.set_xticks(x2 + w2)
        ax.set_xticklabels([s.replace(" Autofill","").replace("AutoFillGraph ","AFG ")
                             for s in sys_order4], fontsize=8, rotation=15)
        ax.set_ylim(0, 1.15); ax.set_ylabel("Score"); ax.legend(fontsize=8)
        ax.set_title("Soft Metric Comparison\n(fill-only rows, FormBench v2)", fontweight="bold")
        ax.set_facecolor("#f8fafc")
        fig.suptitle("AutoFillGraph v7 — FormBench v2: Local Pipeline Quality",
                     fontsize=12, fontweight="bold", color="#1e293b")
        plt.tight_layout()
        saved.append(_save(fig, "plot_formbench_quality.png"))
        print("  Saved: FormBench Quality")

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 3 — KG Growth Trajectory
    # ══════════════════════════════════════════════════════════════════════════
    if GRAPH_SNAPSHOTS:
        snap_labels = [s["label"].split("—")[-1].strip() for s in GRAPH_SNAPSHOTS]
        snap_nodes  = [s["stats"]["nodes"] for s in GRAPH_SNAPSHOTS]
        snap_facts  = [s["stats"]["current_facts"] for s in GRAPH_SNAPSHOTS]
        snap_rec    = [s["stats"]["total_records"] for s in GRAPH_SNAPSHOTS]
        fig, ax = plt.subplots(figsize=(12, 5))
        xs = np.arange(len(GRAPH_SNAPSHOTS))
        ax.plot(xs, snap_nodes, "o-", color="#2563eb", lw=2.2, ms=7, label="NetworkX nodes")
        ax.plot(xs, snap_facts, "s-", color="#16a34a", lw=2.2, ms=7, label="Current facts")
        ax.plot(xs, snap_rec,   "^-", color="#f59e0b", lw=2.2, ms=7,
                label="Temporal records (incl. expired)")
        for x_, n_, f_ in zip(xs, snap_nodes, snap_facts):
            ax.annotate(f"{n_}", (x_, n_), textcoords="offset points", xytext=(0,6),
                        ha="center", fontsize=8, color="#2563eb")
        ax.set_xticks(xs)
        ax.set_xticklabels([f"R{i}" for i in range(len(GRAPH_SNAPSHOTS))], fontsize=9)
        ax.set_ylabel("Count"); ax.set_xlabel("Snapshot (after each major event)")
        ax.set_title("AutoFillGraph v7 — Lifelong KG Growth Over 7 Rounds",
                     fontweight="bold", fontsize=12)
        ax.legend(fontsize=9); ax.set_facecolor("#f8fafc"); ax.grid(axis="y", alpha=0.3)
        plt.tight_layout()
        saved.append(_save(fig, "plot_kg_growth.png"))
        print("  Saved: KG Growth Trajectory")

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 4 — Retrieval Compression
    # ══════════════════════════════════════════════════════════════════════════
    if "bench_metrics" in globals():
        emp_t = [m["triples"] for m in bench_metrics if m["triples"] > 0]
        emp_c = [m["compression"] for m in bench_metrics if m["triples"] > 0]
        fig, ax = plt.subplots(figsize=(8, 5))
        if emp_t:
            by_size = {}
            for t, c in zip(emp_t, emp_c):
                by_size.setdefault(t, []).append(c)
            su = sorted(by_size); mu = [float(np.mean(by_size[s])) for s in su]
            std_u = [float(np.std(by_size[s])) for s in su]
            ax.errorbar(su, mu, yerr=std_u, fmt="o", color="#2563eb",
                        ms=8, capsize=4, lw=2, zorder=5, label="Measured (FormBench)")
            for s, m_ in zip(su, mu):
                ax.annotate(f"{m_:.0%}", (s, m_), xytext=(4,4),
                            textcoords="offset points", fontsize=8, color="#2563eb")
        k_proj = 6
        px = np.linspace(max(5, min(emp_t or [10])), 80, 60)
        py = np.clip(1 - k_proj / px, 0, 1)
        ax.plot(px, py, "--", color="#94a3b8", lw=1.8, label=f"Analytic projection (k≈{k_proj})")
        ax.axhline(0.8, color="#dc2626", ls=":", lw=1.3, alpha=0.7,
                   label=">80% target (projection)")
        ax.set_xlabel("KG Size (triples)"); ax.set_ylabel("Compression Ratio")
        ax.set_title("Context Compression as Memory Grows\n"
                     "Empirically measured at current scale; projection labeled", fontweight="bold")
        ax.set_ylim(0, 1.05); ax.legend(fontsize=9); ax.set_facecolor("#f8fafc")
        ax.text(0.02, 0.98, "Solid = empirical  |  Dashed = analytic",
                transform=ax.transAxes, va="top", fontsize=8, color="#64748b")
        plt.tight_layout()
        saved.append(_save(fig, "plot_compression.png"))
        print("  Saved: Compression")

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 5 — LinUCB Bandit Behaviour
    # ══════════════════════════════════════════════════════════════════════════
    rewards = getattr(AGENT.bandit, "_reward_log", [])
    decisions = getattr(AGENT.bandit, "_decisions", [])
    if len(rewards) >= 3:
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        ax = axes[0]
        w = max(1, len(rewards)//8)
        sm = [float(np.mean(rewards[max(0,i-w):i+1])) for i in range(len(rewards))]
        ax.plot(rewards, alpha=0.18, color="#94a3b8", lw=0.8)
        ax.plot(sm, color="#2563eb", lw=2.2, label=f"Smoothed (w={w})")
        avg_r = float(np.mean(rewards))
        ax.axhline(avg_r, color="#16a34a", ls="--", lw=1.3, label=f"Mean = {avg_r:.2f}")
        ax.set_xlabel("Decision #"); ax.set_ylabel("Reward"); ax.set_ylim(-0.15, 1.25)
        ax.set_title("HITL Reward Signal — Bandit Learning Trace", fontweight="bold")
        ax.legend(fontsize=9); ax.set_facecolor("#f8fafc")
        ax.text(0.98, 0.06, f"n = {len(rewards)} decisions",
                transform=ax.transAxes, ha="right", fontsize=8, color="#64748b")

        ax = axes[1]
        if decisions:
            local_mask = [1 if d["arm"]==0 else 0 for d in decisions]
            llm_mask   = [1 if d["arm"]==1 else 0 for d in decisions]
            xs = np.arange(len(decisions))
            cum_local = np.cumsum(local_mask)
            cum_llm   = np.cumsum(llm_mask)
            ax.stackplot(xs, cum_local, cum_llm,
                         labels=["Arm 0 (local)", "Arm 1 (LLM)"],
                         colors=["#2563eb", "#f59e0b"], alpha=0.85)
            ax.set_xlabel("Decision #"); ax.set_ylabel("Cumulative arm selections")
            ax.set_title("Arm Selection Accumulation\n(local saves API cost)", fontweight="bold")
            ax.legend(fontsize=9, loc="upper left"); ax.set_facecolor("#f8fafc")
        else:
            ax.text(0.5, 0.5, "No arm data", ha="center", va="center", transform=ax.transAxes)
        fig.suptitle("AutoFillGraph v7 — LinUCB Bandit Behaviour",
                     fontsize=12, fontweight="bold", color="#1e293b")
        plt.tight_layout()
        saved.append(_save(fig, "plot_bandit.png"))
        print("  Saved: Bandit")

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 6 — Temporal Memory & Confidence
    # ══════════════════════════════════════════════════════════════════════════
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    ax = axes[0]
    addr_hist = AGENT.kg.history("address")
    if addr_hist:
        ver_labels = [f"v{i+1}: {a.value[:22]}..." for i,a in enumerate(addr_hist)]
        confs = [a.confidence for a in addr_hist]
        col_v = ["#2563eb" if a.is_current() else "#94a3b8" for a in addr_hist]
        bars = ax.barh(range(len(ver_labels)), confs, color=col_v, edgecolor="#f8fafc", height=0.5)
        ax.set_yticks(range(len(ver_labels))); ax.set_yticklabels(ver_labels, fontsize=8)
        ax.set_xlabel("Confidence"); ax.set_xlim(0, 1.3)
        ax.set_title("Temporal Versioning — Address History\n"
                     "(blue=active · grey=expired)", fontweight="bold")
        for bar, c, a in zip(bars, confs, addr_hist):
            ax.text(bar.get_width()+0.02, bar.get_y()+bar.get_height()/2,
                    f"{c:.2f}  {'ACTIVE' if a.is_current() else 'expired'}",
                    va="center", fontsize=8)
        ax.set_facecolor("#f8fafc")
    else:
        ax.text(0.5,0.5,"No address history",ha="center",va="center",transform=ax.transAxes)

    ax = axes[1]
    tier_confs = {s.value: [] for s in Sensitivity}
    for prop, avals in AGENT.kg._attrs.items():
        s = sensitivity(prop).value
        for a in avals:
            if a.is_current(): tier_confs[s].append(a.confidence)
    pos_map = {"PUBLIC": 0, "RESTRICTED": 1, "ENCRYPTED": 2}
    tier_c = ["#16a34a", "#f59e0b", "#dc2626"]
    for tier, pos in pos_map.items():
        vals = tier_confs.get(tier, [0])
        ax.boxplot(vals, positions=[pos], widths=0.5,
                   patch_artist=True,
                   boxprops=dict(facecolor=tier_c[pos], alpha=0.7),
                   medianprops=dict(color="white", lw=2))
    ax.set_xticks(list(pos_map.values()))
    ax.set_xticklabels(list(pos_map.keys()), fontsize=10)
    ax.set_ylabel("Confidence"); ax.set_ylim(0, 1.1)
    ax.set_title("Confidence Distribution by Sensitivity Layer\n"
                 "(Govind’s KG, current facts only)", fontweight="bold")
    ax.set_facecolor("#f8fafc")
    fig.suptitle("AutoFillGraph v7 — Temporal Memory & Confidence Analysis",
                 fontsize=12, fontweight="bold", color="#1e293b")
    plt.tight_layout()
    saved.append(_save(fig, "plot_temporal_confidence.png"))
    print("  Saved: Temporal + Confidence")

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 7 — Route Distribution
    # ══════════════════════════════════════════════════════════════════════════
    if "bench_rows" in globals():
        route_counts = defaultdict(int)
        for r in bench_rows: route_counts[r["route"]] += 1
        total = sum(route_counts.values())
        ro = sorted(route_counts, key=lambda k: route_counts[k], reverse=True)
        fig, ax = plt.subplots(figsize=(8, 4.5))
        y = np.arange(len(ro))
        fracs = [route_counts[r]/total for r in ro]
        bars = ax.barh(y, fracs, color=[ROUTE_PAL.get(r,"#888") for r in ro],
                       edgecolor="#f8fafc", height=0.55)
        ax.set_yticks(y); ax.set_yticklabels(ro, fontsize=10)
        ax.set_xlabel("Fraction of Fields"); ax.set_xlim(0, 1.2)
        ax.set_title("Fill Route Distribution — FormBench v2\n"
                     "(0 API calls: all local path)", fontweight="bold")
        for bar, frac, cnt in zip(bars, fracs, [route_counts[r] for r in ro]):
            ax.text(bar.get_width()+0.01, bar.get_y()+bar.get_height()/2,
                    f"{frac:.0%}  (n={cnt})", va="center", fontsize=9)
        ax.text(0.99, 0.02, "use_llm=False", transform=ax.transAxes,
                ha="right", va="bottom", fontsize=8, color="#64748b", style="italic")
        ax.set_facecolor("#f8fafc")
        plt.tight_layout()
        saved.append(_save(fig, "plot_route_distribution.png"))
        print("  Saved: Route Distribution")

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 8 — Field Mapper Phase Coverage
    # ══════════════════════════════════════════════════════════════════════════
    if HAS_PANDAS and "bench_rows" in globals():
        df_b = pd.DataFrame(bench_rows)
        tiers = sorted(df_b["tier"].unique())
        phases = ["exact", "substring", "embedding", "unknown"]
        phase_colors = {"exact":"#1d4ed8","substring":"#0284c7","embedding":"#15803d","unknown":"#dc2626"}
        fig, ax = plt.subplots(figsize=(9, 5))
        x = np.arange(len(tiers)); w = 0.20
        for i, ph in enumerate(phases):
            counts = [len(df_b[(df_b["tier"]==t) & (df_b["mapper_phase"]==ph)]) for t in tiers]
            totals = [max(1, len(df_b[df_b["tier"]==t])) for t in tiers]
            fracs  = [c/t for c,t in zip(counts,totals)]
            ax.bar(x + i*w, fracs, w, label=ph.capitalize(),
                   color=phase_colors[ph], edgecolor="#f8fafc", alpha=0.9)
        ax.set_xticks(x + 1.5*w); ax.set_xticklabels([f"Tier {t}" for t in tiers], fontsize=11)
        ax.set_ylabel("Fraction of Fields"); ax.set_ylim(0, 1.15)
        ax.set_title("Field Mapper: Resolution Phase by Difficulty Tier\n"
                     "Tier 3 drives embedding phase — validates Phase 3 contribution",
                     fontweight="bold")
        ax.legend(fontsize=9); ax.set_facecolor("#f8fafc")
        plt.tight_layout()
        saved.append(_save(fig, "plot_mapper_phases.png"))
        print("  Saved: Mapper Phases")

    # ══════════════════════════════════════════════════════════════════════════
    # PLOT 9 — Person-Centric KG Evolution (all snapshots)
    # ══════════════════════════════════════════════════════════════════════════
    if GRAPH_SNAPSHOTS:
        fig = plot_kg_evolution(GRAPH_SNAPSHOTS, max_cols=2)
        if fig is not None:
            saved.append(_save(fig, "plot_kg_evolution.png"))
            print("  Saved: KG Evolution (person-centric)")

    print(f"\n✅ {len(saved)} figures saved to {fig_dir}")
    for p in saved:
        print(f"   {os.path.basename(p)}")
'''

# ==============================================================================
# Assemble the notebook
# ==============================================================================
nb7_cells = [
    make_cell("cell-init",         c0),
    make_cell("cell-components",   c1),
    make_cell("cell-agent",        c2),
    make_cell("cell-learning",     c3),
    make_cell("cell-multiprofile", C_MULTI),
    make_cell("cell-qa",           cells6['cell-qa']),
    make_cell("cell-ocr",          cells6['cell-ocr']),
    make_cell("cell-formbench",    cells6['cell-formbench']),
    make_cell("cell-baselines",    cells6['cell-baselines']),
    make_cell("cell-hard-eval",    c8),
    make_cell("cell-figures-v7",   C_FIGURES),
    make_cell("cell-summary",      cells6['cell-summary']),
]

nb7 = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.10.0"},
        "title": "AutoFillGraph v7 — ICML SCALE 2026"
    },
    "cells": nb7_cells
}

with open("Prototype7.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb7, f, ensure_ascii=False, indent=1)

total_src = sum(len(''.join(c.get('source',[]))) for c in nb7_cells)
print(f"Written Prototype7.ipynb: {len(nb7_cells)} cells, ~{total_src//1000}k chars")
