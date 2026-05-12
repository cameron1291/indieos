"""
watcher.py - Polls Supabase for approved opportunities and triggers posters.
Also runs scheduled crawls via APScheduler.
"""

import sys
import os
import time
import subprocess
import logging

from apscheduler.schedulers.background import BackgroundScheduler

sys.path.insert(0, os.path.dirname(__file__))
from shared.supabase_client import _get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [watcher] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "logs", "watcher.log")),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

os.makedirs(os.path.join(os.path.dirname(__file__), "logs"), exist_ok=True)

FACEBOOK_DIR = os.path.join(os.path.dirname(__file__), "facebook")
REDDIT_DIR = os.path.join(os.path.dirname(__file__), "reddit")
CHECK_INTERVAL = 60


def check_and_post():
    """Check Supabase for approved opportunities and run the appropriate poster."""
    try:
        client = _get_client()

        fb_result = client.table("opportunities") \
            .select("id") \
            .eq("status", "approved") \
            .eq("source", "facebook") \
            .limit(1) \
            .execute()
        has_fb = len(fb_result.data or []) > 0

        if has_fb:
            log.info("Found approved Facebook opportunities — running fb_poster.py")
            subprocess.run([sys.executable, os.path.join(FACEBOOK_DIR, "fb_poster.py")], check=False)
        else:
            log.debug("No approved Facebook opportunities.")

        reddit_result = client.table("opportunities") \
            .select("id") \
            .eq("status", "approved") \
            .eq("source", "reddit") \
            .limit(1) \
            .execute()
        has_reddit = len(reddit_result.data or []) > 0

        if has_reddit:
            log.info("Found approved Reddit opportunities — running reddit_poster.py")
            subprocess.run([sys.executable, os.path.join(REDDIT_DIR, "reddit_poster.py")], check=False)
        else:
            log.debug("No approved Reddit opportunities.")

    except Exception as e:
        log.error(f"Watcher error: {e}")


def run_reddit_crawl():
    log.info("Scheduled: Reddit crawl starting")
    subprocess.run([sys.executable, os.path.join(REDDIT_DIR, "reddit_crawler.py")], check=False)


def run_facebook_crawl():
    log.info("Scheduled: Facebook crawl starting")
    subprocess.run([sys.executable, os.path.join(FACEBOOK_DIR, "fb_crawler.py")], check=False)


def main():
    log.info("Watcher started — Facebook + Reddit posting and crawling enabled")

    scheduler = BackgroundScheduler()
    # Reddit crawl: every 4 hours
    scheduler.add_job(run_reddit_crawl, "interval", hours=4, id="reddit_crawl")
    # Facebook crawl: every 6 hours
    scheduler.add_job(run_facebook_crawl, "interval", hours=6, id="facebook_crawl")
    scheduler.start()
    log.info("Scheduler started (Reddit every 4h, Facebook every 6h)")

    while True:
        check_and_post()
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
