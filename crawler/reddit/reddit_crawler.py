"""
reddit_crawler.py
Crawls Reddit for marketing opportunities using the public .json API.
Multi-tenant: reads all active apps from Supabase.
"""

import sys
import os
import time
import random
import requests
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config_loader import load_all_apps
from shared.scorer import score_and_reply
from shared.supabase_client import push_opportunity, opportunity_exists, log_crawler_start, log_crawler_end

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0.0.0 Safari/537.36"
}

MAX_POST_AGE_HOURS = 48


def fetch_subreddit_new(subreddit: str, limit: int = 25) -> list[dict]:
    sub = subreddit.lstrip("r/")
    url = f"https://www.reddit.com/r/{sub}/new.json?limit={limit}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("data", {}).get("children", [])
        print(f"[Reddit] {sub} returned {resp.status_code}")
        return []
    except Exception as e:
        print(f"[Reddit] Error fetching {sub}: {e}")
        return []


def search_reddit(query: str, subreddit: str = None, limit: int = 25) -> list[dict]:
    sub = subreddit.lstrip("r/") if subreddit else None
    if sub:
        url = f"https://www.reddit.com/r/{sub}/search.json?q={query}&sort=new&limit={limit}&restrict_sr=1"
    else:
        url = f"https://www.reddit.com/search.json?q={query}&sort=new&limit={limit}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("data", {}).get("children", [])
        return []
    except Exception as e:
        print(f"[Reddit] Search error for '{query}': {e}")
        return []


def is_recent(post_data: dict) -> bool:
    created = post_data.get("created_utc", 0)
    post_time = datetime.fromtimestamp(created, tz=timezone.utc)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_POST_AGE_HOURS)
    return post_time > cutoff


def extract_post_info(child: dict) -> dict:
    data = child.get("data", {})
    text = data.get("selftext", "") or ""
    title = data.get("title", "") or ""
    full_text = f"{title}\n\n{text}".strip()
    return {
        "text": full_text,
        "url": f"https://www.reddit.com{data.get('permalink', '')}",
        "subreddit": data.get("subreddit_name_prefixed", ""),
        "title": title,
        "created_utc": data.get("created_utc", 0),
    }


def crawl_app(app_config: dict):
    app_id = app_config["_id"]
    app_name = app_config["name"]
    reddit_config = app_config.get("reddit", {})
    subreddits = reddit_config.get("subreddits", [])
    keywords = reddit_config.get("keywords", [])
    min_score = app_config.get("scoring", {}).get("min_score", 8.0)

    print(f"\n[Reddit] Crawling for {app_name}...")
    seen_urls = set()
    pushed = 0
    scanned = 0

    run_id = log_crawler_start(app_id, "reddit")

    try:
        # Browse new posts in configured subreddits
        for sub in subreddits:
            posts = fetch_subreddit_new(sub, limit=25)
            for child in posts:
                post = extract_post_info(child)
                if post["url"] in seen_urls:
                    continue
                seen_urls.add(post["url"])
                if not is_recent(child.get("data", {})):
                    continue
                if opportunity_exists(post["url"]):
                    continue

                scanned += 1
                result = score_and_reply(post["text"], app_config, "Reddit")

                if result["score"] >= min_score and result["suggested_reply"]:
                    push_opportunity(
                        app_id=app_id,
                        source="reddit",
                        post_text=post["text"],
                        post_url=post["url"],
                        group_or_sub=post["subreddit"],
                        score=result["score"],
                        suggested_reply=result["suggested_reply"],
                        opportunity_type=result.get("opportunity_type", ""),
                        classification_reason=result.get("reasoning", ""),
                    )
                    pushed += 1
                    print(f"[Reddit] ✓ Score {result['score']} | {post['title'][:60]}")

                time.sleep(random.uniform(1.5, 3.0))

            time.sleep(random.uniform(3, 6))

        # Keyword searches across configured subreddits
        for keyword in keywords[:5]:
            for sub in subreddits[:3]:
                posts = search_reddit(keyword, subreddit=sub, limit=15)
                for child in posts:
                    post = extract_post_info(child)
                    if post["url"] in seen_urls:
                        continue
                    seen_urls.add(post["url"])
                    if not is_recent(child.get("data", {})):
                        continue
                    if opportunity_exists(post["url"]):
                        continue

                    scanned += 1
                    result = score_and_reply(post["text"], app_config, "Reddit")

                    if result["score"] >= min_score and result["suggested_reply"]:
                        push_opportunity(
                            app_id=app_id,
                            source="reddit",
                            post_text=post["text"],
                            post_url=post["url"],
                            group_or_sub=post["subreddit"],
                            score=result["score"],
                            suggested_reply=result["suggested_reply"],
                            opportunity_type=result.get("opportunity_type", ""),
                            classification_reason=result.get("reasoning", ""),
                        )
                        pushed += 1
                        print(f"[Reddit] ✓ Score {result['score']} | {post['title'][:60]}")

                    time.sleep(random.uniform(2, 4))

            time.sleep(random.uniform(4, 8))

        print(f"[Reddit] {app_name}: scanned {scanned}, pushed {pushed} opportunities")
        log_crawler_end(run_id, scanned, pushed)

    except Exception as e:
        print(f"[Reddit] Error crawling {app_name}: {e}")
        log_crawler_end(run_id, scanned, pushed, errors=str(e))


def main():
    apps = load_all_apps()
    if not apps:
        print("[Reddit] No active apps found.")
        return
    for app in apps:
        crawl_app(app)
        time.sleep(10)


if __name__ == "__main__":
    main()
