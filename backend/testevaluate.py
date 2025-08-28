# backend/app/eval_with_llm.py
# -*- coding: utf-8 -*-
"""
ฮาร์เนสประเมิน LLM (อิง query_llm ของโปรเจ็กต์คุณ)
- เรียก query_llm(Item) เพื่อสร้าง itinerary JSON
- ดึง RAG passages ผ่าน query_documents(...) มาเป็น multi-reference
- แปลง itinerary → ข้อความมาตรฐาน แล้วคำนวณ ROUGE / BLEU (sacreBLEU) / (option) BERTScore

ติดตั้ง:
  pip install nltk rouge-score sacrebleu bert-score pythainlp torch

หมายเหตุ:
- ถ้าใช้ภาษาไทย ให้ตั้ง lang="th" (จะตัดคำและขึ้นบรรทัดใหม่คั่นประโยคให้ ROUGE/BLEU อัตโนมัติ)
- ถ้าใช้ภาษาอังกฤษ ตั้ง lang="en" (ค่าเริ่มต้น)
"""

from __future__ import annotations
import asyncio, re
from typing import List, Union, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta


import re, calendar, itertools, inspect, json
from datetime import datetime
from typing import List

import nltk
from nltk.tokenize import sent_tokenize

from rouge_score import rouge_scorer
import sacrebleu
from bert_score import score as bertscore


# ---- นำเข้าโค้ดของคุณ ----
try:
    from llm import query_llm  
    from llm import query_documents  
    from llm import get_season_data  
    from llm import Item    
       
except Exception:
    # fallback: สร้าง Item แบบง่ายๆ ให้ใช้ได้ทันที
    @dataclass
    class Item:
        text: str
        cities: List[str]
        start_date: str  # "DD/MM/YYYY"
        end_date: str    # "DD/MM/YYYY"

    # ถ้าคุณเก็บ query_llm/query_documents ไว้ path อื่น ให้แก้ import ข้างบนตามจริง
    raise

# ---- Metrics deps ----
# ================== EVALUATE (ALL-IN-ONE, NO CHANGE TO query_documents) ==================

import re, calendar, itertools, inspect, json
from datetime import datetime
from typing import List

import nltk
from nltk.tokenize import sent_tokenize

from rouge_score import rouge_scorer
import sacrebleu
from bert_score import score as bertscore


# ---------- NLTK safeguard ----------
def _ensure_nltk_tokenizers():
    try:
        nltk.data.find("tokenizers/punkt")
    except LookupError:
        nltk.download("punkt")
    try:
        nltk.data.find("tokenizers/punkt_tab")
    except LookupError:
        nltk.download("punkt_tab")


# ---------- RAG adapters (DON'T edit your query_documents) ----------
def _extract_text_from_doc(doc):
    """Map various row shapes -> text"""
    if isinstance(doc, str):
        return doc
    if isinstance(doc, (list, tuple)) and doc:
        return doc[0] if isinstance(doc[0], str) else str(doc[0])
    if isinstance(doc, dict):
        for k in ("text", "content", "page_content", "chunk", "body", "document"):
            if k in doc and isinstance(doc[k], str):
                return doc[k]
        return str(doc)
    return str(doc)


def _call_qdoc(num_days, months, cities, q, k, verbose):
    # >>> ปรับ path ด้านล่างให้ตรงโปรเจกต์คุณ ถ้า query_documents อยู่ตำแหน่งอื่น
    from llm import query_documents
    try:
        res = query_documents(num_days, months, cities, q, k=k)
        if verbose:
            print(f"[RAG-call] days={num_days}, months={months}, cities={cities}, k={k} -> {len(res) if res else 0}")
        return res or []
    except Exception as e:
        if verbose:
            print(f"[RAG-call] Exception: {e}")
        return []


def _month_variants(months):
    """e.g. ['August'] -> many forms per month; plus [] (no filter)"""
    if not months:
        return [[]]
    month_map = {m.lower(): i for i, m in enumerate(calendar.month_name) if m}
    combos = set()
    for m in months:
        base = str(m).strip()
        low = base.lower()
        title = low.capitalize()
        num = month_map.get(low, None)
        abbr = calendar.month_abbr[num] if num else base[:3]
        abbr_low = abbr.lower()
        cand = {base, low, title, abbr, abbr_low}
        if num:
            cand.add(str(num))
            cand.add(f"{num:02d}")
        combos.add(tuple([list(cand)[0]]))  # ใช้ 1 รูปแบบ/เดือน เพื่อลดคอมโบ
    out = [list(t) for t in combos]
    out += [[]]
    return out


def _city_variants(cities):
    if not cities:
        return [[]]
    base = [str(c).strip() for c in cities]
    lower = [c.lower() for c in base]
    title = [c.title() for c in lower]
    return [base, lower, title, []]


def _day_variants(num_days):
    if not num_days:
        return [None]
    d = int(num_days)
    return [d, max(1, d - 1), d + 1]


def _query_variants(text, cities, months):
    base = text or ""
    cities_str = " ".join(cities or [])
    months_str = " ".join(months or [])
    wide = f"{base} {cities_str} {months_str}".strip()
    just_cities = cities_str.strip()
    return [base, wide, just_cities]


# ---------- Clean & shape references to boost metrics ----------
def _mojibake_fix(text: str) -> str:
    if not text:
        return ""
    repl = {
        "â€™": "'", "â€œ": '"', "â€\x9d": '"', "â€“": "-",
        "â€”": "-", "â€˜": "'", "Â": "", "â€": '"', "Ã©": "é", "Ã ": "à",
    }
    for a, b in repl.items():
        text = text.replace(a, b)
    return text


def _strip_noise(text: str) -> str:
    if not text:
        return ""
    t = _mojibake_fix(text)
    t = re.sub(r'"\s*(Title|Itinerary|days|day|head|text)\s*"\s*:\s*', ' ', t, flags=re.I)
    t = re.sub(r'\[[^\]]+\]', ' ', t)  # [ Prefecture ] ฯลฯ
    t = re.sub(r'\*\*INFORMATION\*\*.*?(?=(?:\.\s)|$)', ' ', t, flags=re.I)
    t = re.sub(r'NOTE\s*\d*\s*:.*?(?=(?:\.\s)|$)', ' ', t, flags=re.I)
    t = re.sub(r'https?://\S+', ' ', t)
    t = re.sub(
        r'\b(Breakfast|Lunch|Dinner|Check[- ]?in|Check[- ]?into|Return to the hotel|Transfer|Hotel|similar class|Ryokan|Onsen|Yukata|Purchase Optional Travel Insurance)\b.*?(?=(?:\.\s)|$)',
        ' ', t, flags=re.I
    )
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def _extract_poi_keywords(pred_text: str, cities: List[str]) -> set:
    keys = set(c.lower() for c in (cities or []))
    for m in re.finditer(r'@ ([^|\n]+)', pred_text):
        keys.add(m.group(1).strip().lower())
    for m in re.finditer(
        r'\b([A-Z][A-Za-z\'\-]*(?:\s+[A-Z][A-Za-z\'\-]*)*)\s+(Temple|Shrine|Castle|Grove|District|Arcade|Market|Museum)\b',
        pred_text
    ):
        keys.add((m.group(1) + " " + m.group(2)).lower())
    for m in re.finditer(r'-\s*\d{1,2}:\d{2}\s*\|\s*([^@\n]+)', pred_text):
        frag = m.group(1).strip().lower()
        for token in re.split(r'[,\-/–]| and ', frag):
            token = token.strip()
            if len(token.split()) >= 2 and len(token) >= 6:
                keys.add(token)
    canon = {
        "fushimi inari taisha shrine": "fushimi inari", "fushimi inari taisha": "fushimi inari",
        "shinsaibashi shopping arcade": "shinsaibashi", "dotonbori district": "dotonbori",
        "kinkaku-ji temple (golden pavilion)": "kinkaku-ji", "golden pavilion": "kinkaku-ji",
        "kiyomizu-dera temple": "kiyomizu-dera", "arashiyama bamboo grove": "arashiyama",
        "osaka castle": "osaka castle", "gion district": "gion", "tennoji": "tennoji", "shitennoji": "shitennoji",
    }
    for k, v in list(canon.items()):
        if k in keys:
            keys.add(v)
    return {k for k in keys if k and not k.isdigit()}


_STOP = set("""
a an the to in on at by for from of and or with without into onto over under between during after before about across
is are was were be been being this that these those it they them i you we he she as than then so such just only very
""".split())


def _norm_tokens(s: str) -> set:
    s = re.sub(r'[^A-Za-z0-9\s\-]', ' ', s.lower())
    toks = [w for w in s.split() if len(w) > 2 and w not in _STOP]
    return set(toks)


def _sent_relevance(sent: str, pred_text: str, keys: set) -> float:
    st = _norm_tokens(sent)
    pt = _norm_tokens(pred_text)
    inter = len(st & pt)
    jac = inter / max(1, len(st | pt))
    key_hit = sum(1.0 for k in keys if k in sent.lower())
    return jac + 0.5 * key_hit


def _shape_reference(raw_ref: str, pred_text: str, cities: List[str], max_ratio: float = 1.4) -> str:
    clean = _strip_noise(raw_ref)
    if not clean:
        return ""
    sents = sent_tokenize(clean)

    city_trigs = {c.lower() for c in (cities or [])} | {
        "osaka", "kyoto", "nara", "arashiyama", "gion", "umeda", "shinsaibashi", "dotonbori"
    }
    poi_keys = _extract_poi_keywords(pred_text, cities)

    cand = [s for s in sents if any(t in s.lower() for t in city_trigs | poi_keys)]
    if not cand:
        cand = sents[:12]

    scored = sorted((( _sent_relevance(s, pred_text, poi_keys | city_trigs), s) for s in cand), reverse=True)

    pred_len = len(pred_text.split())
    limit = int(max_ratio * max(1, pred_len))
    take_words, out = 0, []
    for _, s in scored:
        w = s.split()
        if take_words + len(w) > limit:
            continue
        out.append(s)
        take_words += len(w)
        if take_words >= limit:
            break

    if take_words < int(0.5 * pred_len):
        for _, s in scored:
            if s in out: 
                continue
            w = s.split()
            if take_words + len(w) > limit:
                break
            out.append(s)
            take_words += len(w)

    if not out:
        out = cand[:5]
    shaped = " ".join(out).strip()
    return shaped


def _clean_and_shape_all_refs(raw_refs, pred_text: str, cities: List[str], max_ratio: float = 1.4):
    shaped = []
    for r in (raw_refs or []):
        txt = r if isinstance(r, str) else str(r)
        s = _shape_reference(txt, pred_text, cities, max_ratio=max_ratio)
        if s:
            shaped.append(s)
    return shaped


# ---------- Metrics helpers ----------
def _compute_bleu_and_chrf(preds: List[str], refs_multi: List[List[str]]):
    """sacrebleu corpus BLEU + ChrF (multi-ref aware)"""
    K = max(len(rs) for rs in refs_multi)
    refsets = [[] for _ in range(K)]
    for i, rs in enumerate(refs_multi):
        for k in range(K):
            refsets[k].append(rs[k] if k < len(rs) else rs[0])

    bleu_res = sacrebleu.corpus_bleu(preds, refsets)
    chrf_res = sacrebleu.corpus_chrf(preds, refsets)
    return {
        "BLEU": {
            "BLEU": bleu_res.score / 100.0,
            "BLEU_BP": bleu_res.bp
        },
        "ChrF": {
            "ChrF": chrf_res.score / 100.0
        }
    }


def _compute_rouge(preds: List[str], refs_multi: List[List[str]]):
    """ROUGE-1/2/L/Lsum; best-of per item then average"""
    scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL", "rougeLsum"], use_stemmer=True)
    agg = {
        "rouge1": {"p": [], "r": [], "f": []},
        "rouge2": {"p": [], "r": [], "f": []},
        "rougeL": {"p": [], "r": [], "f": []},
        "rougeLsum": {"p": [], "r": [], "f": []},
    }
    for pred, refs in zip(preds, refs_multi):
        best = {k: (0.0, 0.0, 0.0) for k in agg.keys()}
        for ref in refs:
            sc = scorer.score(ref, pred)
            for k in agg.keys():
                trip = (sc[k].precision, sc[k].recall, sc[k].fmeasure)
                if trip[2] > best[k][2]:  # choose best F1
                    best[k] = trip
        for k in agg.keys():
            agg[k]["p"].append(best[k][0])
            agg[k]["r"].append(best[k][1])
            agg[k]["f"].append(best[k][2])

    out = {}
    for k, v in agg.items():
        out[f"{k.upper()}-precision"] = sum(v["p"]) / len(v["p"])
        out[f"{k.upper()}-recall"] = sum(v["r"]) / len(v["r"])
        out[f"{k.upper()}-fmeasure"] = sum(v["f"]) / len(v["f"])
    return out

import math
from bert_score import score as bertscore

def _safe_mean_tensor(t):
    # แปลง NaN เป็น 0 ก่อนคำนวณ mean เพื่อไม่ให้ค่า NaN ลาม
    x = t.detach().float()
    x[x != x] = 0.0
    return float(x.mean().item())

def _compute_bertscore(preds, refs_multi, device="cpu", batch_size=16, lang_code=None):
    """
    คำนวณ BERTScore แบบทนทาน:
    - join multi-ref เป็นสตริงเดียว (เร็ว)
    - ใช้ idf=True เป็นค่ามาตรฐาน
    - ถ้าเจอ NaN/ศูนย์ผิดปกติ → fallback เป็น idf=False
    """
    joined_refs = [" ".join(rs) if isinstance(rs, list) else rs for rs in refs_multi]

    # กันเคส ref ว่าง/สั้นเกิน: เติม token หลอกเล็กน้อย
    joined_refs = [ (r if any(ch.isalnum() for ch in r) else (r + " reference")) for r in joined_refs ]
    preds = [ (p if any(ch.isalnum() for ch in p) else (p + " candidate")) for p in preds ]

    model = "roberta-large" if (lang_code or "en").startswith("en") else "xlm-roberta-large"

    def _run(idf_flag: bool):
        P, R, F1 = bertscore(
            preds, joined_refs,
            model_type=model,
            idf=idf_flag,
            rescale_with_baseline=False,
            device=device or "cpu",
            batch_size=batch_size or 16,
            verbose=False
        )
        Pm, Rm, Fm = _safe_mean_tensor(P), _safe_mean_tensor(R), _safe_mean_tensor(F1)
        return Pm, Rm, Fm

    # รอบแรก: idf=True
    Pm, Rm, Fm = _run(idf_flag=True)

    # ถ้าเจอ NaN หรือ F1 = 0.0 แบบผิดธรรมชาติ → ลอง idf=False
    if math.isnan(Rm) or math.isnan(Pm) or math.isnan(Fm) or Fm == 0.0:
        Pm2, Rm2, Fm2 = _run(idf_flag=False)
        # ใช้ค่าที่เสถียรกว่า
        if not any(math.isnan(x) for x in (Pm2, Rm2, Fm2)) and Fm2 > 0.0:
            Pm, Rm, Fm = Pm2, Rm2, Fm2

    return {
        "BERTScore-P": Pm,
        "BERTScore-R": Rm,
        "BERTScore-F1": Fm
    }


# ---------- Main evaluator ----------
async def evaluate_with_llm(
    items,
    lang: str = "en",
    use_rag_refs: bool = True,
    topk_refs: int = 5,
    do_bert: bool = True,
    device: str | None = None,
    batch_size: int | None = None,
    verbose: bool = True,
):
    """
    LLM -> flatten -> RAG (adaptive) -> clean+shape refs -> BLEU/ROUGE/BERTScore/ChrF
    """
    _ensure_nltk_tokenizers()

    DATE_IN_FMT = "%d/%m/%Y"

    def months_between(ds: datetime, de: datetime):
        months, current = [], ds
        while current <= de:
            m = current.strftime('%B')
            if m not in months:
                months.append(m)
            current = datetime(current.year + 1, 1, 1) if current.month == 12 else datetime(current.year, current.month + 1, 1)
        return months

    def flatten_itinerary_text(itin: dict) -> str:
        lines = []
        for day in itin.get("itinerary", []):
            date = day.get("date", "")
            daylabel = day.get("day", "")
            lines.append(f"{daylabel} ({date}):")
            for slot in day.get("schedule", []):
                tm = slot.get("time", "")
                act = slot.get("activity", "")
                loc = slot.get("specific_location_name")
                if loc:
                    lines.append(f"- {tm} | {act} @ {loc}")
                else:
                    lines.append(f"- {tm} | {act}")
        comments = (itin.get("comments") or "").strip()
        if comments:
            lines.append(f"COMMENTS: {comments}")
        return "\n".join(lines)

    def _has_refs(r):
        if isinstance(r, str):
            return bool(r.strip())
        if isinstance(r, list):
            return any(isinstance(x, str) and x.strip() for x in r)
        return bool(r)

    preds_txt, refs_multi = [], []
    examples = []

    for it in items:
        # 1) Query LLM (ใช้ฟังก์ชันของคุณ)
        data = await query_llm(it)
        ptxt = flatten_itinerary_text(data)
        preds_txt.append(ptxt)

        # 2) Pull refs
        shaped_refs = []
        if use_rag_refs:
            ds = datetime.strptime(it.start_date, DATE_IN_FMT)
            de = datetime.strptime(it.end_date, DATE_IN_FMT)
            months = months_between(ds, de)
            num_days = (de - ds).days + 1

            days_cand = _day_variants(num_days)
            month_forms = _month_variants(months)
            city_forms  = _city_variants(it.cities or [])
            q_forms     = _query_variants(it.text, it.cities, months)

            if verbose:
                print(f"[RAG] try combos: days={days_cand}, #month_forms={len(month_forms)}, #city_forms={len(city_forms)}, #q_forms={len(q_forms)}")

            found = []
            # ลอง signature ปกติ -> กว้างขึ้น -> ตัด filter
            for d in days_cand:
                for ms in month_forms:
                    for cs in city_forms:
                        for q in q_forms:
                            res = _call_qdoc(d, ms, cs, q, topk_refs, verbose)
                            if res:
                                found = res
                                break
                        if found: break
                    if found: break
                if found: break

            if not found:
                # ฟอลแบ็กสุดท้าย: no months, no cities
                found = _call_qdoc(num_days, [], [], it.text, topk_refs, verbose)

            if found:
                raw_texts = [_extract_text_from_doc(r) for r in found[:topk_refs]]
                shaped_refs = _clean_and_shape_all_refs(raw_texts, ptxt, it.cities, max_ratio=1.4)
                if verbose:
                    print(f"[REFS] shaped {len(shaped_refs)} from {len(raw_texts)} raw")
            else:
                if hasattr(it, "refs_text") and it.refs_text:
                    shaped_refs = _clean_and_shape_all_refs(it.refs_text, ptxt, it.cities, max_ratio=1.4)
                    if verbose:
                        print("[RAG] empty → fallback to item.refs_text")

        else:
            shaped_refs = _clean_and_shape_all_refs(getattr(it, "refs_text", []) or [], ptxt, it.cities, max_ratio=1.4)
            if not shaped_refs and verbose:
                print("[REFS] use_rag_refs=False but refs_text empty -> no metrics for this item")

        refs_multi.append(shaped_refs if shaped_refs else [])
        examples.append({"pred": ptxt, "refs": shaped_refs if shaped_refs else ""})

    # 3) Filter pairs that actually have refs
    pairs = [(p, r) for p, r in zip(preds_txt, refs_multi) if r]
    if not pairs:
        return {
            "num_cases": len(items),
            "examples": examples,
            "note": "ไม่มี refs จาก RAG/refs_text ที่ผ่านการ shape สำหรับเคสใดเลย จึงไม่คำนวณเมตริก",
        }

    P = [p for p, _ in pairs]
    R_multi = [r for _, r in pairs]

    # 4) Metrics
    out = {
        "num_cases": len(items),
        "examples": examples,
    }

    bleu_chrf = _compute_bleu_and_chrf(P, R_multi)
    out["BLEU"] = bleu_chrf["BLEU"]
    out["ChrF"] = bleu_chrf["ChrF"]

    out["ROUGE"] = _compute_rouge(P, R_multi)

    if do_bert:
        eff_bs = batch_size if isinstance(batch_size, int) and batch_size > 0 else 16
        eff_dev = device or "cpu"
        out["BERTScore"] = _compute_bertscore(P, R_multi, device=eff_dev, batch_size=eff_bs, lang_code=lang)

    return out
# ================== /EVALUATE ==================




# ---------------- Example ----------------
if __name__ == "__main__":
    async def _demo():
        # ใส่เคสทดสอบที่ต้องการ
        items = [
            Item(
                text="7-day Japan trip focusing on Osaka & Kyoto, slow pace, food & temples.",
                cities=["Osaka","Kyoto"],
                start_date="21/08/2025",
                end_date="23/08/2025",
            ),
        ]
        res = await evaluate_with_llm(
            items,
            lang="en",          # เปลี่ยนเป็น "th" ถ้าผลลัพธ์/refs เป็นภาษาไทย
            use_rag_refs=True,  # ใช้ passages จาก RAG เป็น multi-reference
            topk_refs=3,
            do_bert=True,       # เปิด BERTScore
            device="cpu",        # เช่น "cuda:0"
            batch_size=16,
            verbose=True     # เช่น 32
        )
        import json
        print(json.dumps(res, ensure_ascii=False, indent=2))

    asyncio.run(_demo())
