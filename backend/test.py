"""
Minimal RAG pipeline with Hybrid / Dynamic-K selector tailored for itinerary planning.
- Pure Python + numpy only (no external downloads)
- Plug-and-play: replace stubs with real vector DB, cross-encoder, and LLM

Author: ChatGPT (GPT-5 Thinking)
"""
from __future__ import annotations

import math
import re
import random
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any

import numpy as np

# ------------------------------
# Toy corpus (replace with your docs)
# ------------------------------
CORPUS = [
    {
        "id": "tokyo_spots",
        "text": "Tokyo itinerary: Senso-ji, Skytree, Shibuya Crossing, teamLab Planets, sushi in Tsukiji outer market. Best in spring and autumn.",
        "tags": ["city:tokyo", "type:spot"]
    },
    {
        "id": "tokyo_transport",
        "text": "Tokyo transport: Use Suica/Passmo, JR Yamanote line circles the city. Narita Express from NRT, Keisei Skyliner alternative.",
        "tags": ["city:tokyo", "type:transport"]
    },
    {
        "id": "osaka_spots",
        "text": "Osaka highlights: Osaka Castle, Dotonbori street food, Umeda Sky Building, Kaiyukan Aquarium. Nightlife vibrant in Namba.",
        "tags": ["city:osaka", "type:spot"]
    },
    {
        "id": "kyoto_spots",
        "text": "Kyoto cultural route: Fushimi Inari shrine, Kiyomizu-dera, Arashiyama bamboo grove, Gion district. Peak foliage in mid-November.",
        "tags": ["city:kyoto", "type:spot"]
    },
    {
        "id": "winter_snow",
        "text": "Snow in Japan: Hokkaido and Tohoku have reliable snowfall December to March. Consider Niseko, Sapporo, Zao Onsen snow monsters.",
        "tags": ["region:hokkaido", "season:winter"]
    },
    {
        "id": "jr_pass",
        "text": "JR Pass: Nationwide rail pass valid on most JR lines including shinkansen (excluding Nozomi/Mizuho). Activate at major stations; bring passport.",
        "tags": ["type:policy", "type:ticket"]
    },
    {
        "id": "december_weather",
        "text": "December weather: Tokyo 5-12C with rare snow. Osaka similar. Hokkaido averages -6 to 1C with frequent snowfall.",
        "tags": ["type:weather", "season:winter"]
    },
]

STOPWORDS = set("""a an the and or in on at to for with by of from is are was were be been being this that those these it its as about into up out over under more most less few very such have has had do does did will would should can could may might must not no yes you your""".split())

CITY_WORDS = {"tokyo", "osaka", "kyoto", "sapporo", "niseko", "hakodate", "sendai", "nagoya"}
SEASON_WORDS = {"spring", "summer", "autumn", "fall", "winter", "december", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov"}

# ------------------------------
# Simple hash-based TF embedding
# ------------------------------

def tokenize(text: str) -> List[str]:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    toks = [t for t in text.split() if t and t not in STOPWORDS]
    return toks


def build_vocab(docs: List[str]) -> Dict[str, int]:
    vocab = {}
    for d in docs:
        for t in tokenize(d):
            if t not in vocab:
                vocab[t] = len(vocab)
    return vocab


def embed(text: str, vocab: Dict[str, int]) -> np.ndarray:
    v = np.zeros(len(vocab), dtype=float)
    toks = tokenize(text)
    for t in toks:
        if t in vocab:
            v[vocab[t]] += 1.0
    # L2 normalize
    n = np.linalg.norm(v) + 1e-8
    return v / n


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))


# ------------------------------
# Vector search (toy in-memory)
# ------------------------------
class ToyVectorIndex:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = docs
        self.vocab = build_vocab([d["text"] for d in docs])
        self.mat = np.stack([embed(d["text"], self.vocab) for d in docs])

    def search(self, query: str, top_k: int = 10) -> List[Tuple[Dict[str, Any], float]]:
        qv = embed(query, self.vocab)
        sims = self.mat @ qv
        idx = np.argsort(-sims)[:top_k]
        return [(self.docs[i], float(sims[i])) for i in idx]


# ------------------------------
# Cross-encoder re-rank (stub -> reuse cosine with tiny bias)
# ------------------------------

def cross_encoder_rerank(query: str, candidates: List[Tuple[Dict[str, Any], float]], idx: ToyVectorIndex) -> List[Dict[str, Any]]:
    qv = embed(query, idx.vocab)
    scored = []
    for doc, base in candidates:
        dv = embed(doc["text"], idx.vocab)
        # Pretend a stronger relevance by mixing cosine and heuristic tag boosts
        rel = cosine(qv, dv)
        if any(tag.startswith("type:policy") or tag.startswith("type:ticket") for tag in doc.get("tags", [])):
            rel += 0.02  # slight boost for policy/ticket docs
        scored.append({"doc": doc, "rel": rel})
    scored.sort(key=lambda x: x["rel"], reverse=True)
    return scored


# ------------------------------
# Diversity / redundancy helpers
# ------------------------------

def max_cosine(doc_text: str, selected_texts: List[str], vocab: Dict[str, int]) -> float:
    if not selected_texts:
        return 0.0
    dv = embed(doc_text, vocab)
    return max(cosine(dv, embed(t, vocab)) for t in selected_texts)


def redundancy(doc_text: str, selected_texts: List[str], vocab: Dict[str, int]) -> float:
    # Redundancy as maximum cosine similarity
    return max_cosine(doc_text, selected_texts, vocab)


def need_entities(query: str) -> Dict[str, Any]:
    toks = tokenize(query)
    cities = sorted({t for t in toks if t in CITY_WORDS})
    seasons = sorted({t for t in toks if t in SEASON_WORDS or re.match(r"\b\d{1,2}-day\b", t)})
    days = re.findall(r"(\d+)\s*(?:days|day|คืน|วัน)", query.lower())
    return {
        "cities": cities,
        "seasons": seasons,
        "days": int(days[0]) if days else None,
    }


def coverage_gain(doc_text: str, need: Dict[str, Any]) -> float:
    text = doc_text.lower()
    gain = 0.0
    if need["cities"]:
        gain += sum(1.0 for c in need["cities"] if c in text)
    if need["seasons"]:
        gain += sum(0.5 for s in need["seasons"] if s in text)
    if need["days"]:
        gain += 0.5  # weakly favor docs that can help scheduling
    return min(1.0, gain / (len(need["cities"]) + 0.5 + 0.5 if need["cities"] else 1.0))


def tokens_estimate(texts: List[str]) -> int:
    # Rough token estimate ~ 0.75 * words
    words = sum(len(tokenize(t)) for t in texts)
    return int(words * 0.75)


# ------------------------------
# Hybrid / Dynamic-K selection
# ------------------------------
@dataclass
class DynamicKConfig:
    K_min: int = 3
    K_max: int = 8
    K0: int = 16
    eps: float = 0.10
    token_budget: int = 3000
    w_rel: float = 0.5
    w_div: float = 0.3
    w_cov: float = 0.2
    w_red: float = 0.3


def rule_based_upper_bound(query: str, cfg: DynamicKConfig) -> int:
    need = need_entities(query)
    multi_city = len(need["cities"]) >= 2
    long_trip = (need["days"] or 0) >= 6
    season_focus = len(need["seasons"]) > 0

    k = cfg.K_min + 2
    if multi_city:
        k += 2
    if long_trip:
        k += 1
    if season_focus:
        k += 1
    return int(max(cfg.K_min, min(cfg.K_max, k)))


def select_dynamic_K(query: str, index: ToyVectorIndex, cfg: DynamicKConfig) -> List[Dict[str, Any]]:
    # Over-fetch then rerank
    candidates = index.search(query, top_k=cfg.K0)
    reranked = cross_encoder_rerank(query, candidates, index)

    # Hybrid upper bound
    K_upper = rule_based_upper_bound(query, cfg)

    selected: List[Dict[str, Any]] = []
    selected_texts: List[str] = []
    need = need_entities(query)

    for item in reranked:
        doc = item["doc"]
        rel = item["rel"]
        text = doc["text"]
        div = 1.0 - redundancy(text, selected_texts, index.vocab)
        cov = coverage_gain(text, need)
        red = redundancy(text, selected_texts, index.vocab)

        gain = cfg.w_rel*rel + cfg.w_div*div + cfg.w_cov*cov - cfg.w_red*red

        # Always take until K_min
        force_take = len(selected) < cfg.K_min

        if force_take or (gain >= cfg.eps and len(selected) < K_upper):
            selected.append({"doc": doc, "rel": rel, "gain": gain})
            selected_texts.append(text)

        # Stop conditions
        if len(selected) >= K_upper:
            break
        if tokens_estimate(selected_texts) > cfg.token_budget:
            break

    return selected


# ------------------------------
# Simple composer that pretends to be the LLM generator
# ------------------------------

def compose_answer(query: str, contexts: List[Dict[str, Any]]) -> str:
    # This stub just concatenates key sentences as a pseudo-itinerary
    header = f"Plan based on {len(contexts)} context chunks: " + ", ".join(c["doc"]["id"] for c in contexts)
    lines = [header, ""]
    # Choose 5-8 sentences total
    for c in contexts:
        sents = re.split(r"[\.!?]\s+", c["doc"]["text"])[:2]
        for s in sents:
            if s:
                lines.append("- " + s.strip() + ".")
    return "\n".join(lines[:10])


# ------------------------------
# Demo
# ------------------------------
if __name__ == "__main__":
    index = ToyVectorIndex(CORPUS)
    cfg = DynamicKConfig(K_min=3, K_max=8, K0=16, eps=0.08, token_budget=1200)

    queries = [
        "3-day Tokyo winter trip focusing on transport and must-see spots",
        "7-day Osaka + Kyoto foodie and culture itinerary in December, include JR Pass tips",
        "Where to find guaranteed snow in early December near Tokyo? day trip suggestions",
    ]

    for q in queries:
        sel = select_dynamic_K(q, index, cfg)
        ans = compose_answer(q, sel)
        print("\n=== Query ===\n", q)
        print(f"Selected K = {len(sel)} | ids = {[s['doc']['id'] for s in sel]}")
        for s in sel:
            print(f"  + {s['doc']['id']}: rel={s['rel']:.3f}, gain={s['gain']:.3f}")
        print("\n--- Draft itinerary ---\n" + ans)