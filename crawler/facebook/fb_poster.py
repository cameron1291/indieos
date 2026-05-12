"""
fb_poster.py
Posts approved Facebook opportunities as comments/posts using Selenium.
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
    format="%(asctime)s [fb_poster] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "..", "logs", "fb_poster.log")),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

COOKIE_FILE = os.path.join(os.path.dirname(__file__), "..", "fb_cookies.json")
PAGE_TIMEOUT = 40


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


def load_cookies(driver) -> bool:
    if not os.path.exists(COOKIE_FILE):
        return False
    driver.get("https://www.facebook.com")
    human_delay(2, 3)
    with open(COOKIE_FILE, "r") as f:
        for cookie in json.load(f):
            try:
                driver.add_cookie(cookie)
            except Exception:
                pass
    driver.refresh()
    human_delay(3, 5)
    return "login" not in driver.current_url


def save_cookies(driver):
    with open(COOKIE_FILE, "w") as f:
        json.dump(driver.get_cookies(), f)


def ensure_logged_in(driver: webdriver.Chrome) -> webdriver.Chrome:
    if os.path.exists(COOKIE_FILE):
        if load_cookies(driver):
            log.info("Session restored from cookies.")
            return driver
        log.warning("Cookies expired — removing stale session.")
        os.remove(COOKIE_FILE)

    log.warning("No valid session — opening visible browser for login...")
    try:
        driver.quit()
    except Exception:
        pass

    vis_options = Options()
    vis_options.add_argument("--no-sandbox")
    vis_options.add_argument("--disable-dev-shm-usage")
    vis_driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=vis_options)
    vis_driver.set_window_size(1280, 900)
    vis_driver.get("https://www.facebook.com/login")
    print("\n" + "=" * 50)
    print("Please log into Facebook in the browser window.")
    print("Press ENTER here once you can see your feed.")
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
        raise RuntimeError("Login cookies didn't work — please try again.")
    log.info("Fresh headless session started with new cookies.")
    return new_driver


def _try_submit_button(driver, wait) -> bool:
    selectors = [
        "//div[@aria-label='Comment' and @role='button']",
        "//div[@aria-label='Post' and @role='button']",
        "//div[@aria-label='comment' and @role='button']",
        "//div[@role='button' and @aria-label='Post comment']",
        "//span[text()='Post']//ancestor::div[@role='button']",
        "//div[@role='button'][.//span[text()='Post']]",
        "//div[@role='button'][.//span[text()='Comment']]",
    ]
    for selector in selectors:
        try:
            btn = wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
            driver.execute_script("arguments[0].click();", btn)
            log.info(f"Submitted via selector: {selector[:60]}")
            return True
        except (TimeoutException, WebDriverException):
            continue
    return False


def post_reply_to_url(driver, post_url: str, reply_text: str) -> bool:
    log.info(f"Navigating to: {post_url}")
    driver.get(post_url)
    wait = WebDriverWait(driver, PAGE_TIMEOUT)
    human_delay(3, 5)

    comment_box_selectors = [
        "//div[@aria-label='Write a comment…']",
        "//div[@aria-label='Write a comment']",
        "//div[@aria-placeholder='Write a comment…']",
        "//div[@data-lexical-editor='true']",
        "//form//div[@contenteditable='true']",
        "//div[@contenteditable='true' and @role='textbox']",
    ]

    clicked = False
    for selector in comment_box_selectors:
        try:
            box = wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
            driver.execute_script("arguments[0].click();", box)
            clicked = True
            log.info("Clicked comment box.")
            break
        except TimeoutException:
            continue

    if not clicked:
        log.warning(f"Could not find comment box at {post_url}")
        return False

    human_delay(1, 2)

    try:
        active = driver.switch_to.active_element
        for char in reply_text:
            active.send_keys(char)
            if random.random() < 0.05:
                time.sleep(random.uniform(0.05, 0.15))
        log.info(f"Typed reply ({len(reply_text)} chars)")
    except Exception as e:
        log.error(f"Failed to type reply: {e}")
        return False

    human_delay(1, 2)

    if _try_submit_button(driver, WebDriverWait(driver, 8)):
        human_delay(3, 5)
        return True

    log.info("Submit button not found — trying Enter key fallback")
    try:
        active = driver.switch_to.active_element
        active.send_keys(Keys.RETURN)
        human_delay(3, 5)
        log.info("Submitted via Enter key.")
        return True
    except Exception as e:
        log.error(f"Enter key fallback failed: {e}")

    log.warning("Could not submit comment.")
    return False


def post_to_group_wall(driver, group_url: str, message: str) -> bool:
    log.info(f"Posting to group wall: {group_url}")
    driver.get(group_url)
    wait = WebDriverWait(driver, PAGE_TIMEOUT)
    human_delay(3, 5)

    post_box_selectors = [
        "//span[contains(text(), 'Write something')]",
        "//span[contains(text(), \"What's on your mind\")]",
        "//div[@role='button' and contains(@aria-label, 'post')]",
        "//div[@role='button' and contains(@aria-label, 'Write')]",
    ]

    clicked = False
    for selector in post_box_selectors:
        try:
            box = wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
            box.click()
            clicked = True
            break
        except TimeoutException:
            continue

    if not clicked:
        log.warning(f"Could not find post box at {group_url}")
        return False

    human_delay(1, 2)

    try:
        active = driver.switch_to.active_element
        for char in message:
            active.send_keys(char)
            if random.random() < 0.03:
                time.sleep(random.uniform(0.05, 0.2))
    except Exception as e:
        log.error(f"Failed to type post: {e}")
        return False

    human_delay(1, 2)

    post_btn_selectors = [
        "//div[@aria-label='Post' and @role='button']",
        "//div[@role='button'][.//span[text()='Post']]",
        "//span[text()='Post']//ancestor::div[@role='button']",
    ]

    for selector in post_btn_selectors:
        try:
            btn = wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
            driver.execute_script("arguments[0].click();", btn)
            human_delay(3, 5)
            return True
        except TimeoutException:
            continue

    log.warning("Could not find post submit button.")
    return False


def main():
    opportunities = get_approved_opportunities(source="facebook")

    if not opportunities:
        log.info("No approved Facebook opportunities to post.")
        return

    log.info(f"Found {len(opportunities)} approved Facebook opportunities.")
    driver = make_driver(headless=True)

    try:
        driver = ensure_logged_in(driver)

        for opp in opportunities:
            doc_id = opp["_id"]
            app_id = opp.get("app", "unknown")
            post_url = opp.get("post_url", "")
            group = opp.get("group", "")
            reply = opp.get("final_reply") or opp.get("suggested_reply", "")

            log.info(f"Processing: {app_id} | {post_url[:60]}")

            if not reply:
                log.warning(f"No reply text for {doc_id} — marking failed")
                mark_failed(doc_id, "No reply text")
                continue

            if "/posts/" in post_url or "story_fbid" in post_url or "/permalink/" in post_url:
                success = post_reply_to_url(driver, post_url, reply)
            else:
                success = post_to_group_wall(driver, group or post_url, reply)

            if success:
                mark_posted(doc_id)
                log.info(f"✓ Posted {doc_id}")
            else:
                mark_failed(doc_id, "Post action failed")
                log.warning(f"✗ Failed {doc_id}")

            pause = random.uniform(60, 180)
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
