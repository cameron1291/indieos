"""
group_finder.py
Discovers relevant Facebook groups for each app using Selenium.
Run this once per app, then join the groups manually.
Groups are saved to Supabase apps.facebook_groups.
"""

import sys
import os
import time
import random
import json

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config_loader import load_all_apps, save_app_groups
from shared.scorer import generate_group_search_terms
from shared.supabase_client import save_discovered_groups

COOKIE_FILE = os.path.join(os.path.dirname(__file__), "..", "fb_cookies.json")
MIN_MEMBERS = 500


def make_driver(headless=False) -> webdriver.Chrome:
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
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    driver.set_window_size(1280, 900)
    return driver


def human_delay(lo=1.5, hi=3.5):
    time.sleep(random.uniform(lo, hi))


def save_cookies(driver):
    with open(COOKIE_FILE, "w") as f:
        json.dump(driver.get_cookies(), f)
    print("[Auth] Cookies saved.")


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


def ensure_logged_in(driver):
    if os.path.exists(COOKIE_FILE):
        print("[Auth] Trying saved cookies...")
        if load_cookies(driver):
            print("[Auth] Session restored.")
            return
        print("[Auth] Cookies expired.")
        os.remove(COOKIE_FILE)

    driver.get("https://www.facebook.com/login")
    print("\n" + "=" * 50)
    print("Please log into Facebook in the browser window.")
    print("Complete any 2FA if needed, then press ENTER here.")
    print("=" * 50 + "\n")
    input("Press ENTER when logged in...")
    human_delay(2, 3)
    save_cookies(driver)


def search_groups(driver, search_term: str) -> list[dict]:
    results = []
    try:
        url = f"https://www.facebook.com/search/groups/?q={search_term.replace(' ', '+')}"
        driver.get(url)
        human_delay(3, 5)

        for _ in range(3):
            driver.execute_script("window.scrollBy(0, 800)")
            human_delay(1.5, 2.5)

        group_cards = driver.find_elements(
            By.XPATH,
            "//a[contains(@href, '/groups/') and not(contains(@href, '/groups/feed'))]"
        )

        seen_urls = set()
        for card in group_cards:
            try:
                href = card.get_attribute("href") or ""
                if "/groups/" not in href or href in seen_urls:
                    continue
                seen_urls.add(href)
                group_url = href.split("?")[0].rstrip("/")
                name = card.text.strip() or "Unknown Group"
                if not name or len(name) < 3:
                    continue
                results.append({"name": name, "url": group_url, "search_term": search_term})
            except Exception:
                continue

    except Exception as e:
        print(f"[GroupFinder] Error searching '{search_term}': {e}")

    return results


def deduplicate_groups(groups: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for g in groups:
        url = g.get("url", "")
        if url and url not in seen:
            seen.add(url)
            unique.append(g)
    return unique


def find_groups_for_app(driver, app_config: dict) -> list[dict]:
    app_id = app_config["_id"]
    app_name = app_config["name"]

    print(f"\n[GroupFinder] Generating AI search terms for {app_name}...")
    ai_terms = generate_group_search_terms(app_config)
    all_terms = list(dict.fromkeys(ai_terms))
    print(f"[GroupFinder] Searching {len(all_terms)} terms for {app_name}")

    all_groups = []
    for term in all_terms:
        print(f"[GroupFinder] Searching: '{term}'")
        groups = search_groups(driver, term)
        all_groups.extend(groups)
        print(f"[GroupFinder] Found {len(groups)} groups for '{term}'")
        human_delay(3, 6)

    unique_groups = deduplicate_groups(all_groups)
    print(f"[GroupFinder] {app_name}: {len(unique_groups)} unique groups found")
    return unique_groups


def main():
    apps = load_all_apps()
    driver = make_driver(headless=False)

    try:
        ensure_logged_in(driver)

        for app_config in apps:
            app_id = app_config["_id"]
            app_name = app_config["name"]

            existing = app_config.get("facebook", {}).get("groups", [])
            if existing:
                print(f"[GroupFinder] {app_name} already has {len(existing)} groups, skipping.")
                continue

            groups = find_groups_for_app(driver, app_config)

            if groups:
                group_urls = [g["url"] for g in groups]
                save_app_groups(app_id, group_urls)
                save_discovered_groups(app_id, groups)

                print(f"\n{'=' * 60}")
                print(f"GROUPS TO JOIN FOR {app_name.upper()}")
                print(f"{'=' * 60}")
                for i, g in enumerate(groups, 1):
                    print(f"{i:3}. {g['name']}")
                    print(f"     {g['url']}")
                print(f"\nJoin these groups manually in Facebook,")
                print(f"then the crawler will start using them automatically.")
                print(f"{'=' * 60}\n")

            time.sleep(10)

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
