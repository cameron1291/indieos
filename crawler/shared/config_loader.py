"""
config_loader.py - Loads app configs from Supabase (multi-tenant).
Returns dicts with the same structure as the old YAML configs so
existing crawler scripts need zero changes beyond the import.
"""

import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def _get_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _row_to_config(row: dict) -> dict:
    """Map a Supabase apps row to the dict format crawlers expect."""
    return {
        "_id": row["id"],
        "name": row["name"],
        "description": row.get("description") or "",
        "target_user": row.get("target_user") or "",
        "problem_solved": row.get("problem_solved") or "",
        "tone": row.get("tone") or "casual and helpful",
        "app_url": row.get("app_store_url") or "",
        "site_url": row.get("website_url") or "",
        "reddit": {
            "subreddits": row.get("reddit_subreddits") or [],
            "keywords": row.get("keywords") or [],
            "high_intent_phrases": row.get("high_intent_phrases") or [],
        },
        "facebook": {
            "groups": row.get("facebook_groups") or [],
        },
        "scoring": {
            "min_score": row.get("min_score") or 8.0,
            "boost_keywords": row.get("boost_keywords") or [],
            "penalty_keywords": row.get("penalty_keywords") or [],
            "high_intent_phrases": row.get("high_intent_phrases") or [],
        },
    }


def load_all_apps(user_id: str = None) -> list[dict]:
    """Load all active apps. Optionally filter by user_id."""
    client = _get_client()
    query = client.table("apps").select("*").eq("monitoring_active", True)
    if user_id:
        query = query.eq("user_id", user_id)
    result = query.execute()
    return [_row_to_config(row) for row in (result.data or [])]


def load_app(app_id: str) -> dict:
    """Load a single app by UUID."""
    client = _get_client()
    result = client.table("apps").select("*").eq("id", app_id).single().execute()
    if not result.data:
        raise ValueError(f"No app found with id: {app_id}")
    return _row_to_config(result.data)


def get_app_ids(user_id: str = None) -> list[str]:
    """Return list of active app UUIDs."""
    apps = load_all_apps(user_id=user_id)
    return [a["_id"] for a in apps]


def save_app_groups(app_id: str, groups: list[str]):
    """Save discovered Facebook group URLs to the app record."""
    client = _get_client()
    client.table("apps").update({"facebook_groups": groups}).eq("id", app_id).execute()
    print(f"[Config] Saved {len(groups)} groups for app {app_id}")
