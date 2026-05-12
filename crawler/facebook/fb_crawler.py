"""
fb_crawler.py - Grabs post text AND permalink together while page is loaded.
Uses passes_strict_filter from scorer.py instead of the old broad trigger list.
"""

import sys
import os
import time
import random
import json
import logging

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config_loader import load_all_apps
from shared.scorer import score_and_reply, passes_strict_filter
from shared.supabase_client import push_opportunity, opportunity_exists, log_crawler_start, log_crawler_end

os.makedirs(os.path.join(os.path.dirname(__file__), "..", "logs"), exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [fb_crawler] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "..", "logs", "fb_crawler.log")),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

COOKIE_FILE = os.path.join(os.path.dirname(__file__), "..", "fb_cookies.json")
MIN_POST_LENGTH = 30


def make_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument("--window-size=1920,1080")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    )
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_script_timeout(15)
    return driver


def human_delay(lo=1.5, hi=4.0):
    time.sleep(random.uniform(lo, hi))


def safe_scroll(driver, amount=500):
    try:
        driver.execute_script(f"window.scrollBy(0, {amount});")
    except Exception:
        pass


def load_cookies(driver) -> bool:
    if not os.path.exists(COOKIE_FILE):
        return False
    driver.get("https://www.facebook.com")
    time.sleep(3)
    with open(COOKIE_FILE) as f:
        for c in json.load(f):
            try:
                driver.add_cookie(c)
            except Exception:
                pass
    driver.refresh()
    time.sleep(5)
    return "login" not in driver.current_url


def save_cookies(driver):
    with open(COOKIE_FILE, "w") as f:
        json.dump(driver.get_cookies(), f)


def ensure_logged_in(driver):
    if os.path.exists(COOKIE_FILE):
        if load_cookies(driver):
            log.info("Session restored from cookies.")
            return
        log.warning("Cookies expired.")
        os.remove(COOKIE_FILE)

    driver.quit()
    vis_options = Options()
    vis_options.add_argument("--no-sandbox")
    vis_service = Service(ChromeDriverManager().install())
    vis_driver = webdriver.Chrome(service=vis_service, options=vis_options)
    vis_driver.set_window_size(1280, 900)
    vis_driver.get("https://www.facebook.com/login")
    print("\n" + "=" * 50)
    print("Log into Facebook in the browser window.")
    print("Press ENTER once you can see your feed.")
    print("=" * 50 + "\n")
    input("Press ENTER when logged in...")
    save_cookies(vis_driver)
    vis_driver.quit()
    raise RuntimeError("Cookies saved — please re-run fb_crawler.py")


def get_posts_with_urls(driver, group_url: str) -> list[dict]:
    results = []
    post_elements = driver.find_elements(By.XPATH, "//div[@role='article']")
    if not post_elements:
        post_elements = driver.find_elements(By.XPATH, "//div[@role='feed']/div/div")

    log.info(f"Found {len(post_elements)} post elements")

    for el in post_elements:
        try:
            text = el.text.strip()
            if not text or len(text) < MIN_POST_LENGTH:
                continue

            links = el.find_elements(By.XPATH, ".//a[contains(@href,'/posts/') or contains(@href,'/permalink/')]")
            post_url = group_url
            for link in links:
                href = link.get_attribute("href") or ""
                if "/posts/" in href or "/permalink/" in href:
                    post_url = href.split("?")[0]
                    break

            results.append({"text": text, "url": post_url})
        except Exception:
            continue

    return results


def crawl_group(driver, group_url: str, app_config: dict) -> tuple[int, int]:
    """Returns (posts_scanned, opportunities_pushed)."""
    app_id = app_config["_id"]
    min_score = app_config.get("scoring", {}).get("min_score", 8.0)
    pushed = 0
    scanned = 0

    log.info(f"Opening: {group_url.split('/groups/')[-1]}")
    try:
        driver.get(group_url)
    except Exception as e:
        log.warning(f"Failed to load: {e}")
        return 0, 0

    human_delay(5, 8)

    body_text = driver.find_element(By.TAG_NAME, "body").text
    if "membership is pending" in body_text.lower():
        log.info("Membership pending — skipping")
        return 0, 0
    if "cancel request" in body_text.lower() and "joined" not in body_text.lower():
        log.info("Not approved yet — skipping")
        return 0, 0

    for _ in range(5):
        safe_scroll(driver, 600)
        human_delay(0.8, 1.5)
    human_delay(2, 3)

    posts = get_posts_with_urls(driver, group_url)
    log.info(f"Got {len(posts)} posts to evaluate")

    for post in posts:
        text = post["text"]
        post_url = post["url"]

        # Use strict filter (replaces old broad trigger list)
        if not passes_strict_filter(text, app_config):
            continue

        if opportunity_exists(post_url):
            continue

        scanned += 1
        result = score_and_reply(text, app_config, "Facebook")
        score = result["score"]
        reply = result["suggested_reply"]

        if score >= min_score and reply:
            group_slug = group_url.rstrip("/").split("/")[-1]
            push_opportunity(
                app_id=app_id,
                source="facebook",
                post_text=text,
                post_url=post_url,
                group_or_sub=group_slug,
                score=score,
                suggested_reply=reply,
                opportunity_type=result.get("opportunity_type", ""),
                classification_reason=result.get("reasoning", ""),
            )
            pushed += 1
            log.info(f"✓ Score {score} | {text[:70]}")

        human_delay(0.5, 1.5)

    return scanned, pushed


def crawl_app(driver, app_config: dict):
    app_name = app_config["name"]
    app_id = app_config["_id"]
    groups = app_config.get("facebook", {}).get("groups", [])

    if not groups:
        log.warning(f"{app_name}: No groups configured.")
        return

    log.info(f"\n{'=' * 50}")
    log.info(f"Crawling {app_name} — {len(groups)} groups")
    log.info(f"{'=' * 50}")

    total_scanned = 0
    total_pushed = 0
    run_id = log_crawler_start(app_id, "facebook")

    try:
        for group_url in groups:
            try:
                scanned, pushed = crawl_group(driver, group_url, app_config)
                total_scanned += scanned
                total_pushed += pushed
            except Exception as e:
                log.error(f"Error crawling {group_url}: {e}")
                continue
            wait = random.uniform(30, 60)
            log.info(f"Waiting {wait:.0f}s...")
            time.sleep(wait)

        log.info(f"{app_name}: {total_pushed} opportunities pushed")
        log_crawler_end(run_id, total_scanned, total_pushed)

    except Exception as e:
        log_crawler_end(run_id, total_scanned, total_pushed, errors=str(e))


def main():
    apps = load_all_apps()
    driver = make_driver()
    try:
        ensure_logged_in(driver)
        log.info("Facebook session confirmed — starting crawl")
        for app_config in apps:
            crawl_app(driver, app_config)
            time.sleep(10)
    finally:
        driver.quit()
        log.info("Done.")


if __name__ == "__main__":
    main()
