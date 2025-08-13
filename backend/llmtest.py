# llm.py
from __future__ import annotations

import os
import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
from psycopg2 import OperationalError, sql
from fastapi import HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# Load env
# -----------------------------------------------------------------------------
load_dotenv()

# -----------------------------------------------------------------------------
# Environment helpers
# -----------------------------------------------------------------------------
def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing environment variable: {name}")
    return val

def get_conn():
    """
    Return a psycopg2 connection using either DATABASE_URL (preferred)
    or PG* env variables as fallback. Raises HTTPException with helpful message.
    """
    url = os.getenv("DATABASE_URL")
    try:
        if url:
            # psycopg2 accepts postgres:// or postgresql://
            return psycopg2.connect(url, connect_timeout=int(os.getenv("PGCONNECT_TIMEOUT", "10")))
        # Fallback to individual vars
        host = os.getenv("PGHOST", "localhost")
        port = os.getenv("PGPORT", "5432")
        db   = os.getenv("PGDATABASE", "LLM")
        user = os.getenv("PGUSER", "postgres")
        pwd  = os.getenv("PGPASSWORD", "Guyza5521")
        return psycopg2.connect(
            host=host, port=port, database=db, user=user, password=pwd,
            connect_timeout=int(os.getenv("PGCONNECT_TIMEOUT", "10")),
        )
    except OperationalError as e:
        # อย่าใส่พาส/URL ในข้อความ error
        raise HTTPException(
            status_code=500,
            detail=f"Cannot connect to Postgres. Check DATABASE_URL or PG* envs and network. Error: {e.__class__.__name__}: {e}"
        )

# -----------------------------------------------------------------------------
# Heavy resources (load once)
# -----------------------------------------------------------------------------
try:
    embedder = SentenceTransformer("BAAI/bge-m3")
except Exception as e:
    raise RuntimeError(f"Failed to load sentence-transformers model: {e}")

try:
    client = OpenAI(api_key=_require_env("OPENAI_API_KEY"))
except Exception as e:
    raise RuntimeError(f"Failed to init OpenAI client: {e}")

# -----------------------------------------------------------------------------
# Pydantic models
# -----------------------------------------------------------------------------
class Item(BaseModel):
    start_date: str  # "DD/MM/YYYY"
    end_date: str    # "DD/MM/YYYY"
    text: str

class FixRequest(BaseModel):
    text: str
    itinerary_data: Dict[str, Any]

# -----------------------------------------------------------------------------
# Data / RAG utilities
# -----------------------------------------------------------------------------
def query_documents(query_text: str, k: int = 3) -> List[Tuple[str, float]]:
    """
    Fetch top-k docs by vector distance using pgvector.
    Assumes table:
        documents(content TEXT, embedding VECTOR, ...)
    and extension pgvector is installed.
    """
    query_embedding = embedder.encode(query_text).tolist()
    query_embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT content, embedding <=> %s::vector AS similarity_score
                FROM documents
                ORDER BY similarity_score ASC
                LIMIT %s
                """,
                (query_embedding_str, k),
            )
            return cur.fetchall()

def get_season_data() -> Dict[str, Dict[str, str]]:
    return {
        "Spring: March - May": {
            "description": "Plum blossoms precede cherry blossoms; Tokyo sakura peak late Mar–early Apr.",
            "clothing": "Light layers; light coat at night."
        },
        "Summer: June - August/September": {
            "description": "Rainy season in June; very hot & humid Jul–Sep; many festivals.",
            "clothing": "Light clothes, rain gear."
        },
        "Autumn: September/October - November": {
            "description": "Heat eases; foliage later in season is beautiful.",
            "clothing": "Light jacket/sweater."
        },
        "Winter: December - February": {
            "description": "Cold; great powder snow in central/northern Japan.",
            "clothing": "Coats, sweaters, thick socks."
        },
    }

def _clean_json_text(raw: str) -> str:
    s = (raw or "").strip().replace("\n", "").replace("```", "")
    if s.lower().startswith("json"):
        s = s[4:]
    return s

# -----------------------------------------------------------------------------
# LLM entrypoints
# -----------------------------------------------------------------------------
async def query_llm(text: Item) -> Dict[str, Any]:
    """
    Generate a new itinerary JSON between [start_date, end_date] (DD/MM/YYYY input).
    """
    # Validate dates
    try:
        date_start = datetime.strptime(text.start_date, "%d/%m/%Y")
        date_end = datetime.strptime(text.end_date, "%d/%m/%Y")
    except ValueError:
        raise HTTPException(status_code=400, detail="start_date/end_date must be DD/MM/YYYY")

    if date_end < date_start:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    num_days = (date_end - date_start).days + 1
    query_txt = f"{num_days} days {text.text}"

    # RAG context
    try:
        retrieved_docs = query_documents(query_txt)
    except HTTPException:
        # เด้ง error ต่อ
        raise
    except Exception as e:
        # ไม่อยากล้มทั้งงานถ้า RAG พัง—ส่งต่อแบบไม่มีคอนเท็กซ์
        retrieved_docs = []
    context = [row[0] for row in retrieved_docs]
    season_data = get_season_data()

    json_structure = """
    {
      "itinerary":[
        { "date":"YYYY-MM-DD", "day":"Day x",
          "schedule":[
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0},
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0},
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0},
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0},
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0}
          ]
        }
      ],
      "comments":"notes about season/feasibility"
    }
    """

    prompt = f"""
Generate a detailed travel itinerary in JSON only (no extra text).
- Use dates YYYY-MM-DD between {text.start_date} and {text.end_date} (DD/MM/YYYY given).
- Include "Day 1", "Day 2", etc.
- For each day, include ~5 schedule items with 24h time HH:mm, activity, and lat/lng when place-specific.
- lat/lng may be empty for non-location tasks (e.g., Shopping).
- Add "comments" noting seasonal suitability using: {season_data}.
- Consider context to choose realistic spots: {context}.
- Keep daily travel distances/time reasonable.
- Output must be VALID JSON, no code fences or extra quotes.
json_structure: {json_structure}
Make the itinerary in English.
    """.strip()

    try:
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": "You create realistic trip schedules."},
                {"role": "user", "content": prompt},
            ],
        )
        raw = resp.choices[0].message.content or ""
        cleaned = _clean_json_text(raw)
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse JSON from LLM response")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

def query_llm_fix(req: FixRequest) -> Dict[str, Any]:
    """
    Modify an existing itinerary JSON using a user instruction.
    """
    try:
        retrieved_docs = query_documents(req.text)
    except Exception:
        retrieved_docs = []
    context = "\n".join([row[0] for row in retrieved_docs])
    season_data = get_season_data()
    itinerary_json = json.dumps(req.itinerary_data, ensure_ascii=False)

    json_structure = """
    {
      "itinerary":[
        { "date":"YYYY-MM-DD", "day":"Day x",
          "schedule":[
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0},
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0},
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0},
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0},
            {"time":"HH:mm","activity":"","lat":0.0,"lng":0.0}
          ]
        }
      ],
      "comments":"notes about season/feasibility"
    }
    """

    prompt = f"""
Change the activities in this itinerary JSON: {itinerary_json}

Your task:
1) MODIFY activities based on this user request: {req.text}
2) Use this context to improve choices: {context}
3) REPLACE originals; keep the same day/date/time grid.
4) Use 24h HH:mm times; pick realistic durations/ordering.
5) Add comments about seasonal suitability using: {season_data}
6) lat/lng may be updated or left empty.

Return JSON only. No backticks or extra text.
json_structure: {json_structure}
Make the itinerary in English.
    """.strip()

    try:
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": "You refine & update travel itineraries."},
                {"role": "user", "content": prompt},
            ],
        )
        raw = resp.choices[0].message.content or ""
        cleaned = _clean_json_text(raw)
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse JSON from LLM response")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")
