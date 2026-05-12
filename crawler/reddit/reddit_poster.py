"""
reddit_poster.py
Posts approved Reddit opportunities as comments using Selenium.
Uses old.reddit.com for a simpler, more stable DOM.
"""

import sys
import os
import time
import random
import json
import logging

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.supabase_client import get_approved_opportunities, mark_posted, mark_failed

os.makedirs(os.path.join(os.path.dirname(__file__), "..", "logs"), exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [reddit_poster] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "..", "logs", "reddit_poster.log")),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

COOKIE_FILE = os.path.join(os.path.dirname(__file__), "..", "reddit_cookies.json")
PAGE_TIMEOUT = 30


def make_driver(headless=True) -> webdriver.Chrome:
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument(
        "user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    )
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    driver.set_window_size(1280, 900)
    return driver


def human_delay(lo=1.5, hi=4.0):
    time.sleep(random.uniform(lo, hi))


def to_old_reddit(url: str) -> str:
    return url.replace("https://www.reddit.com", "https://old.reddit.com") \
              .replace("https://reddit.com", "https://old.reddit.com")


def load_cookies(driver) -> bool:
    if not os.path.exists(COOKIE_FILE):
        return False
    driver.get("https://old.reddit.com")
    human_delay(2, 3)
    with open(COOKIE_FILE, "r") as f:
        for cookie in json.load(f):
            try:
                driver.add_cookie(cookie)
            except Exception:
                pass
    driver.refresh()
    human_delay(2, 3)
    return "login" not in driver.current_url and driver.find_elements(By.CSS_SELECTOR, "#header .user a")


def save_cookies(driver):
    with open(COOKIE_FILE, "w") as f:
        json.dump(driver.get_cookies(), f)


def ensure_logged_in(driver: webdriver.Chrome) -> webdriver.Chrome:
    if os.path.exists(COOKIE_FILE):
        if load_cookies(driver):
            log.info("Reddit session restored from cookies.")
            return driver
        log.warning("Reddit cookies expired — removing stale session.")
        os.remove(COOKIE_FILE)

    log.warning("No valid Reddit session — opening visible browser for login...")
    try:
        driver.quit()
    except Exception:
        pass

    vis_options = Options()
    vis_options.add_argument("--no-sandbox")
    vis_options.add_argument("--disable-dev-shm-usage")
    vis_driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=vis_options)
    vis_driver.set_window_size(1280, 900)
    vis_driver.get("https://old.reddit.com/login")
    print("\n" + "=" * 50)
    print("Please log into Reddit in the browser window.")
    print("Press ENTER here once you are logged in.")
    print("=" * 50 + "\n")
    input("Press ENTER when logged in...")
    save_cookies(vis_driver)
    vis_driver.quit()

    new_driver = make_driver(headless=True)
    if not load_cookies(new_driver):
        try:
            new_driver.quit()
        except Exception:
            pass
        raise RuntimeError("Reddit login cookies didn't work — please try again.")
    log.info("Fresh headless Reddit session started.")
    return new_driver


def post_reddit_comment(driver, post_url: str, reply_text: str) -> bool:
    old_url = to_old_reddit(post_url)
    log.info(f"Navigating to: {old_url}")
    driver.get(old_url)
    wait = WebDriverWait(driver, PAGE_TIMEOUT)
    human_delay(3, 5)

    try:
        textarea = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "div.usertext-edit textarea")))
        textarea.click()
        human_delay(0.5, 1.0)
        for char in reply_text:
            textarea.send_keys(char)
            if random.random() < 0.04:
                time.sleep(random.uniform(0.05, 0.15))
        log.info(f"Typed reply ({len(reply_text)} chars)")
    except TimeoutException:
        log.warning(f"Could not find comment textarea at {old_url}")
        return False
    except Exception as e:
        log.error(f"Failed to type reply: {e}")
        return False

    human_delay(1, 2)

    try:
        submit_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "div.usertext-edit button[type='submit']")))
        submit_btn.click()
        log.info("Comment submitted.")
        human_delay(3, 5)
        return True
    except TimeoutException:
        pass

    try:
        textarea.send_keys(Keys.CONTROL, Keys.RETURN)
        human_delay(3, 5)
        log.info("Submitted via Ctrl+Enter.")
        return True
    except Exception as e:
        log.error(f"Submit fallback failed: {e}")

    log.warning("Could not submit Reddit comment.")
    return False


def main():
    reddit_opps = get_approved_opportunities(source="reddit")

    if not reddit_opps:
        log.info("No approved Reddit opportunities.")
        return

    log.info(f"Found {len(reddit_opps)} approved Reddit opportunities.")
    driver = make_driver(headless=True)

    try:
        driver = ensure_logged_in(driver)

        for opp in reddit_opps:
            doc_id = opp["_id"]
            post_url = opp.get("post_url", "")
            reply = opp.get("final_reply") or opp.get("suggested_reply", "")

            if not reply:
                log.warning(f"No reply text for {doc_id} — skipping")
                mark_failed(doc_id, "No reply text")
                continue

            if not post_url:
                log.warning(f"No post URL for {doc_id} — skipping")
                mark_failed(doc_id, "No post URL")
                continue

            success = post_reddit_comment(driver, post_url, reply)

            if success:
                mark_posted(doc_id)
                log.info(f"✓ Posted {doc_id}")
            else:
                mark_failed(doc_id, "Comment submission failed")
                log.warning(f"✗ Failed {doc_id}")

            pause = random.uniform(60, 120)
            log.info(f"Waiting {pause:.0f}s before next post...")
            time.sleep(pause)

    finally:
        try:
            driver.quit()
        except Exception:
            pass
        log.info("Done.")


if __name__ == "__main__":
    main()
