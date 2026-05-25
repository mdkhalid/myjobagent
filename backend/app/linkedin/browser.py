"""
Browser profile detection and WebDriver setup.

Uses undetected-chromedriver for stealth LinkedIn browsing.
Reuses the user's existing Chrome profile so they stay logged in.
"""

import logging
import os
import platform
import sys
import time
from typing import Optional, Tuple

import undetected_chromedriver as uc
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait

from app.linkedin.selectors import DEFAULT_USER_AGENT

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

LINKEDIN_BASE = "https://www.linkedin.com"


# ── Profile directory detection ─────────────────────────────────────────────


def find_chrome_user_data_dir() -> Optional[str]:
    """Detect the Chrome user-data-dir from common OS paths."""
    system = platform.system()

    if system == "Windows":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        candidates = [
            os.path.join(local_app_data, "Google", "Chrome", "User Data"),
            os.path.join(os.environ.get("USERPROFILE", ""), "AppData", "Local", "Google", "Chrome", "User Data"),
            os.path.join(os.environ.get("USERPROFILE", ""), "Local Settings", "Application Data", "Google", "Chrome", "User Data"),
        ]
    elif system == "Linux":
        home = os.path.expanduser("~")
        candidates = [
            os.path.join(home, ".config", "google-chrome"),
            os.path.join(home, ".var", "app", "com.google.Chrome", "data", ".config", "google-chrome"),
            os.path.join(home, "snap", "chromium", "current", ".config", "chromium"),
        ]
    elif system == "Darwin":
        home = os.path.expanduser("~")
        candidates = [
            os.path.join(home, "Library", "Application Support", "Google", "Chrome"),
        ]
    else:
        candidates = []

    for path in candidates:
        if path and os.path.isdir(path):
            logger.info("Found Chrome user-data-dir: %s", path)
            return path

    logger.warning("Could not find Chrome user-data-dir")
    return None


def find_chrome_profile_name() -> str:
    """Return the default Chrome profile name for the current OS."""
    system = platform.system()
    if system == "Windows":
        return "Default"
    elif system == "Darwin":
        return "Default"
    else:
        return "Default"


def get_temp_profile_dir() -> str:
    """Return a temp profile path for guest sessions (fallback)."""
    system = platform.system()
    home = os.path.expanduser("~")

    if system == "Windows":
        return os.path.join(os.environ.get("TEMP", "C:\\temp"), "auto-job-apply-profile")
    elif system == "Darwin":
        return os.path.join(home, "Library", "Application Support", "Google", "Chrome", "auto-job-apply-profile")
    else:
        return os.path.join(home, ".auto-job-apply-profile")


# ── Chrome version detection (for undetected-chromedriver) ──────────────────


def detect_chrome_version() -> Optional[int]:
    """Detect installed Chrome major version from registry / common paths."""
    system = platform.system()

    if system == "Windows":
        try:
            import winreg
            for key_path in [
                r"SOFTWARE\Google\Chrome\BLBeacon",
                r"SOFTWARE\Wow6432Node\Google\Chrome\BLBeacon",
            ]:
                try:
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path) as key:
                        version = winreg.QueryValueEx(key, "version")[0]
                        logger.info("Detected Chrome version: %s", version)
                        return int(version.split(".")[0])
                except (OSError, ValueError):
                    continue
        except ImportError:
            pass

    # Fallback: try running chrome --version
    try:
        import subprocess
        if system == "Windows":
            chrome_paths = [
                os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
                os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
                os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
            ]
        elif system == "Darwin":
            chrome_paths = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        else:
            chrome_paths = ["google-chrome", "google-chrome-stable", "chromium-browser"]

        for cp in chrome_paths:
            try:
                result = subprocess.run([cp, "--version"], capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    parts = result.stdout.strip().split()
                    for i, p in enumerate(parts):
                        if p.count(".") >= 2:
                            return int(p.split(".")[0])
            except (FileNotFoundError, subprocess.TimeoutExpired):
                continue
    except Exception:
        pass

    logger.warning("Could not detect Chrome version, using default")
    return None


# ── ProfileManager ──────────────────────────────────────────────────────────


class ProfileManager:
    """Manages Chrome profile detection and WebDriver creation."""

    def __init__(self):
        self.driver: Optional[WebDriver] = None
        self.wait: Optional[WebDriverWait] = None
        self._user_data_dir: Optional[str] = None
        self._profile_name: str = "Default"

    # ── Driver setup ─────────────────────────────────────────────────────

    def setup_driver(self, headless: bool = False) -> bool:
        """
        Create an undetected-chromedriver instance using the user's Chrome profile.

        Returns True on success.
        """
        user_data_dir = find_chrome_user_data_dir()
        version_main = detect_chrome_version()

        if user_data_dir:
            self._user_data_dir = user_data_dir
            self._profile_name = find_chrome_profile_name()
            logger.info("Using profile: %s / %s", user_data_dir, self._profile_name)
        else:
            # Fall back to temp profile
            user_data_dir = get_temp_profile_dir()
            self._user_data_dir = user_data_dir
            logger.info("No default profile — using temp profile: %s", user_data_dir)

        options = uc.ChromeOptions()
        options.add_argument(f"--user-data-dir={user_data_dir}")
        options.add_argument(f"--profile-directory={self._profile_name}")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument(f"user-agent={DEFAULT_USER_AGENT}")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-notifications")

        if headless:
            options.add_argument("--headless=new")

        # Preferences to suppress dialogs
        prefs = {
            "credentials_enable_service": False,
            "profile.password_manager_enabled": False,
            "profile.default_content_setting_values.notifications": 2,
        }
        options.add_experimental_option("prefs", prefs)
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        try:
            driver_kwargs = {"options": options, "use_subprocess": True}
            if version_main:
                driver_kwargs["version_main"] = version_main

            self.driver = uc.Chrome(**driver_kwargs)
            self.wait = WebDriverWait(self.driver, 15)
            logger.info("Chrome driver started successfully")
            return True
        except Exception as exc:
            logger.error("Failed to start Chrome driver: %s", exc)
            return False

    # ── Navigation helpers ───────────────────────────────────────────────

    def navigate(self, url: str) -> None:
        """Navigate driver to URL."""
        if self.driver:
            self.driver.get(url)
            time.sleep(2)

    def linkedin_login_page(self) -> None:
        """Navigate to LinkedIn login."""
        self.navigate(f"{LINKEDIN_BASE}/login")

    def linkedin_jobs_page(self) -> None:
        """Navigate to LinkedIn Jobs."""
        self.navigate(f"{LINKEDIN_BASE}/jobs/")

    # ── Cleanup ──────────────────────────────────────────────────────────

    def close(self) -> None:
        """Close the browser driver."""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
            self.wait = None
            logger.info("Chrome driver closed")
