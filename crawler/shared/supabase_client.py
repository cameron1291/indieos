"""
supabase_client.py - Replaces firebase_client.py.
All function signatures are identical so crawler scripts only need to change the import.
"""

import os
import uuid
from datetime import datetime, timezone

from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def _get_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Opportunities ─────────────────────────────────────────────────────────────

def push_opportunity(
    app_id: str,
    source: str,
    post_text: str,
    post_url: str,
    group_or_sub: str,
    score: float,
    suggested_reply: str,
    opportunity_type: str = "pending",
    classification_reason: str = "",
) -> str:
    """Insert a new opportunity row. Returns the new row UUID."""
    client = _get_client()
    doc_id = str(uuid.uuid4())

    # Fetch user_id from app row (needed for RLS and queries)
    app_result = client.table("apps").select("user_id").eq("id", app_id).single().execute()
    user_id = app_result.data["user_id"] if app_result.data else None

    row = {
        "id": doc_id,
        "app_id": app_id,
        "user_id": user_id,
        "source": source,
        "post_text": post_text[:2000],
        "post_url": post_url,
        "group_or_sub": group_or_sub,
        "score": score,
        "suggested_reply": suggested_reply,
        "classification_reason": classification_reason,
        "opportunity_type": opportunity_type,
        "status": "pending",
    }

    try:
        client.table("opportunities").insert(row).execute()
        print(f"[Supabase] Pushed opportunity {doc_id} ({app_id} | {source} | score {score})")
        return doc_id
    except Exception as e:
        print(f"[Supabase] Error pushing opportunity: {e}")
        return ""


def get_approved_opportunities(source: str = None) -> list[dict]:
    """Fetch all approved opportunities. Optionally filter by source."""
    client = _get_client()
    query = client.table("opportunities").select("*").eq("status", "approved")
    if source:
        query = query.eq("source", source)
    result = query.execute()
    rows = result.data or []
    # Normalize field names to match what poster scripts expect
    for row in rows:
        row["_id"] = row["id"]
        row["app"] = row.get("app_id", "")
        row["group"] = row.get("group_or_sub", "")
    return rows


def mark_posted(doc_id: str):
    client = _get_client()
    try:
        client.table("opportunities").update({
            "status": "posted",
            "posted_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", doc_id).execute()
        print(f"[Supabase] Marked {doc_id} as posted")
    except Exception as e:
        print(f"[Supabase] Error marking posted: {e}")


def mark_failed(doc_id: str, reason: str = ""):
    client = _get_client()
    try:
        client.table("opportunities").update({
            "status": "failed",
            "classification_reason": reason,
        }).eq("id", doc_id).execute()
    except Exception as e:
        print(f"[Supabase] Error marking failed: {e}")


def opportunity_exists(post_url: str) -> bool:
    client = _get_client()
    try:
        result = client.table("opportunities").select("id").eq("post_url", post_url).limit(1).execute()
        return len(result.data or []) > 0
    except Exception as e:
        print(f"[Supabase] Error checking existence: {e}")
        return False


# ── App group lists ───────────────────────────────────────────────────────────

def save_discovered_groups(app_id: str, groups: list[dict]):
    """Save a list of discovered Facebook groups to the app's facebook_groups array."""
    client = _get_client()
    group_urls = [g["url"] for g in groups if g.get("url")]
    try:
        client.table("apps").update({"facebook_groups": group_urls}).eq("id", app_id).execute()
        print(f"[Supabase] Saved {len(group_urls)} groups for app {app_id}")
    except Exception as e:
        print(f"[Supabase] Error saving groups: {e}")


def get_app_groups(app_id: str) -> list[dict]:
    """Return facebook_groups for a given app as list of {url} dicts."""
    client = _get_client()
    try:
        result = client.table("apps").select("facebook_groups").eq("id", app_id).single().execute()
        urls = result.data.get("facebook_groups") or [] if result.data else []
        return [{"url": u} for u in urls]
    except Exception as e:
        print(f"[Supabase] Error fetching groups: {e}")
        return []


# ── Crawler run logging ───────────────────────────────────────────────────────

def log_crawler_start(app_id: str, source: str) -> str:
    """Insert a crawler_run row and return its ID."""
    client = _get_client()
    run_id = str(uuid.uuid4())
    try:
        client.table("crawler_runs").insert({
            "id": run_id,
            "app_id": app_id,
            "source": source,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "posts_scanned": 0,
            "opportunities_found": 0,
        }).execute()
    except Exception as e:
        print(f"[Supabase] Error logging crawler start: {e}")
    return run_id


def log_crawler_end(run_id: str, posts_scanned: int, opportunities_found: int, errors: str = None):
    """Update a crawler_run row with completion info."""
    client = _get_client()
    try:
        client.table("crawler_runs").update({
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "posts_scanned": posts_scanned,
            "opportunities_found": opportunities_found,
            "errors": errors,
        }).eq("id", run_id).execute()
    except Exception as e:
        print(f"[Supabase] Error logging crawler end: {e}")
