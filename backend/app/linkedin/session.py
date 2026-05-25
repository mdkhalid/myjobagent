"""
LinkedIn session management.

Checks if the user is logged in by looking for profile indicators,
and handles manual login flow (open browser, wait for user to login).
"""

import logging
import time
from typing import Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from app.linkedin.selectors import LOGGED_IN_INDICATORS, LOGIN_INDICATORS
from app.linkedin.browser import LINKEDIN_BASE, ProfileManager

logger = logging.getLogger(__name__)


class SessionManager:
    """Check and manage LinkedIn login sessions."""

    def __init__(self, driver: Optional[WebDriver] = None, wait: Optional[WebDriverWait] = None):
        self.driver = driver
        self.wait = wait

    def set_driver(self, driver: WebDriver, wait: WebDriverWait) -> None:
        """Set or update the driver reference (used after lazy init)."""
        self.driver = driver
        self.wait = wait

    # ── Login check ──────────────────────────────────────────────────────

    def is_logged_in(self) -> bool:
        """
        Check if LinkedIn session is active by looking for profile indicators.

        Navigates to LinkedIn feed and checks for logged-in elements.
        """
        if not self.driver:
            return False

        try:
            self.driver.get(f"{LINKEDIN_BASE}/feed/")
            time.sleep(3)

            # Check for logged-in indicators
            for by, selector in LOGGED_IN_INDICATORS:
                try:
                    elements = self.driver.find_elements(by, selector)
                    if elements:
                        logger.info("LinkedIn session detected via: %s", selector)
                        return True
                except Exception:
                    continue

            # Check for login page indicators (not logged in)
            for by, selector in LOGIN_INDICATORS:
                try:
                    elements = self.driver.find_elements(by, selector)
                    if elements:
                        logger.info("LinkedIn login page detected — not logged in")
                        return False
                except Exception:
                    continue

            # If we can't determine, check URL
            if "feed" in self.driver.current_url.lower():
                return True

            return False

        except Exception as exc:
            logger.warning("Error checking login status: %s", exc)
            return False

    def wait_for_manual_login(self, timeout_seconds: int = 180) -> bool:
        """
        Open LinkedIn login page and wait for the user to log in manually.

        Polls every 3 seconds for logged-in indicators.
        Returns True once login is detected, False on timeout.
        """
        if not self.driver:
            return False

        self.driver.get(f"{LINKEDIN_BASE}/login")
        time.sleep(2)

        logger.info("Waiting for manual LinkedIn login (timeout: %ds)...", timeout_seconds)

        start = time.time()
        while time.time() - start < timeout_seconds:
            try:
                for by, selector in LOGGED_IN_INDICATORS:
                    try:
                        elements = self.driver.find_elements(by, selector)
                        if elements:
                            logger.info("Manual login detected!")
                            # Give cookies a moment to persist
                            time.sleep(2)
                            return True
                    except Exception:
                        continue

                # Also check URL for redirect away from login
                current = self.driver.current_url.lower()
                if "feed" in current or "checkpoint" in current:
                    logger.info("Login detected via URL redirect")
                    time.sleep(2)
                    return True

            except Exception:
                pass

            time.sleep(3)

        logger.warning("Manual login timeout after %d seconds", timeout_seconds)
        return False
