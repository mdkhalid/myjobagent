"""
Centralized LinkedIn DOM selectors (CSS + XPath).

Keep every selector in one place so changes to LinkedIn's DOM are easy to fix.
"""

from selenium.webdriver.common.by import By

# ── Login detection ──────────────────────────────────────────────────────────

LOGIN_INDICATORS = [
    (By.CSS_SELECTOR, "a.nav__button-secondary[href*='login']"),
    (By.XPATH, "//a[contains(@href, 'signup')]"),
]

LOGGED_IN_INDICATORS = [
    (By.CSS_SELECTOR, "img.global-nav__me-photo"),
    (By.CSS_SELECTOR, "div.profile-rail-card__actor-link"),
    (By.CSS_SELECTOR, "a.nav__button-tertiary[href*='mynetwork']"),
    (By.XPATH, "//*[@data-control-name='nav.sales_nav_header_me']"),
]

# ── Search results page ─────────────────────────────────────────────────────

SEARCH_RESULTS_CONTAINER = (
    By.CSS_SELECTOR,
    "div.jobs-search-results-list, ul.jobs-search-results__list, div.scaffold-layout__list-container",
)

JOB_CARDS = [
    (By.CSS_SELECTOR, "li.jobs-search-results__list-item"),
    (By.CSS_SELECTOR, "div.job-card-container"),
    (By.CSS_SELECTOR, "li[data-occludable-job-id]"),
]

JOB_TITLE = [
    (By.CSS_SELECTOR, "a.job-card-list__title"),
    (By.CSS_SELECTOR, "a.job-card-container__link"),
    (By.CSS_SELECTOR, "h3.base-search-card--title"),
]

JOB_COMPANY = [
    (By.CSS_SELECTOR, "a.job-card-container__company-name"),
    (By.CSS_SELECTOR, "span.job-card-container__primary-description"),
    (By.CSS_SELECTOR, "h4.base-search-card--subtitle"),
]

JOB_LOCATION = [
    (By.CSS_SELECTOR, "li.job-card-container__metadata-item"),
    (By.CSS_SELECTOR, "span.job-card-container__metadata-item"),
    (By.CSS_SELECTOR, "span.job-search-card__location"),
]

JOB_LINK = [
    (By.CSS_SELECTOR, "a.job-card-list__title"),
    (By.CSS_SELECTOR, "a.job-card-container__link"),
]

JOB_EASY_APPLY_LABEL = [
    (By.CSS_SELECTOR, "span.job-card-container__easy-apply-label"),
    (By.XPATH, "//span[contains(text(),'Easy Apply')]"),
]

JOB_LIST_SCROLL_AREA = [
    (By.CSS_SELECTOR, "div.jobs-search-results-list"),
    (By.CSS_SELECTOR, "div.scaffold-layout__list"),
    (By.CSS_SELECTOR, "div[data-view-name='jobs-search-results-list']"),
]

# ── Job detail panel (opened after clicking a card) ─────────────────────────

JOB_DETAIL_TITLE = [
    (By.CSS_SELECTOR, "h1.job-details-jobs-unified-top-card__job-title"),
    (By.CSS_SELECTOR, "h2.t-24"),
]

JOB_DETAIL_COMPANY = [
    (By.CSS_SELECTOR, "a.job-details-jobs-unified-top-card__company-name"),
    (By.CSS_SELECTOR, "div.job-details-jobs-unified-top-card__company-name"),
]

JOB_DESCRIPTION = [
    (By.CSS_SELECTOR, "div.job-details-jobs-unified-top-card__description-container"),
    (By.CSS_SELECTOR, "div.job-details--about"),
    (By.CSS_SELECTOR, "section.core-section-container"),
]

EASY_APPLY_BUTTON = [
    (By.XPATH, "//button[contains(@class, 'jobs-apply-button') and .//span[contains(text(),'Easy Apply')]]"),
    (By.CSS_SELECTOR, "button.jobs-apply-button"),
    (By.XPATH, "//button[contains(., 'Easy Apply')]"),
]

SEE_MORE_LINK = [
    (By.XPATH, "//a[contains(@class, 'job-details-jobs-unified-top-card__job-insight-text-button')]"),
    (By.CSS_SELECTOR, "a[data-tracking-control-name='public_jobs_show-more']"),
]

# ── Easy Apply modal ────────────────────────────────────────────────────────

EASY_APPLY_MODAL = [
    (By.CSS_SELECTOR, "div.jobs-easy-apply-modal"),
    (By.CSS_SELECTOR, "div[data-test-modal-id='easy-apply-modal']"),
    (By.CSS_SELECTOR, "div.artdeco-modal"),
]

MODAL_CONTENT = [
    (By.CSS_SELECTOR, "div.jobs-easy-apply-form-section__grouping"),
    (By.CSS_SELECTOR, "div[data-test-form-builder]"),
    (By.CSS_SELECTOR, "form.jobs-easy-apply-form"),
]

MODAL_NEXT_BUTTON = [
    (By.XPATH, "//button[contains(@class, 'artdeco-button') and span[contains(text(),'Next')]]"),
    (By.CSS_SELECTOR, "button[aria-label='Continue to next step']"),
]

MODAL_REVIEW_BUTTON = [
    (By.XPATH, "//button[contains(@class, 'artdeco-button') and span[contains(text(),'Review')]]"),
]

MODAL_SUBMIT_BUTTON = [
    (By.XPATH, "//button[contains(@class, 'artdeco-button') and span[contains(text(),'Submit')]]"),
]

MODAL_CLOSE_BUTTON = [
    (By.XPATH, "//button[@aria-label='Dismiss']"),
    (By.CSS_SELECTOR, "button.artdeco-modal__dismiss"),
]

MODAL_ERROR = [
    (By.CSS_SELECTOR, "p.artdeco-inline-feedback--error"),
    (By.CSS_SELECTOR, "div[data-test-easy-apply-error]"),
]

SUCCESS_MODAL = [
    (By.XPATH, "//span[contains(text(),'Application submitted')]"),
    (By.CSS_SELECTOR, "div.jobs-easy-apply-modal--success"),
    (By.XPATH, "//*[contains(@class, 'artdeco-modal') and .//span[contains(text(),'submitted')]]"),
]

# ── Form fields within Easy Apply modal ─────────────────────────────────────

FORM_TEXT_INPUT = By.CSS_SELECTOR, "input.artdeco-text-input--input, input.fb-text-input, input[type='text']"
FORM_EMAIL_INPUT = By.CSS_SELECTOR, "input[type='email'], input.fb-text-input"
FORM_PHONE_INPUT = By.CSS_SELECTOR, "input[type='tel'], input.fb-text-input"
FORM_TEXTAREA = By.CSS_SELECTOR, "textarea.fb-text-input, textarea.artdeco-text-input--input"
FORM_SELECT = By.CSS_SELECTOR, "select.fb-dropdown, select.artdeco-dropdown"
FORM_RADIO = By.CSS_SELECTOR, "input[type='radio'], div.fb-radio"
FORM_RADIO_LABEL = By.XPATH, ".//span[contains(@class, 'fb-radio')] | .//label[contains(@for, 'radio')]"
FORM_CHECKBOX = By.CSS_SELECTOR, "input[type='checkbox'], div.fb-checkbox"
FORM_FILE_UPLOAD = By.CSS_SELECTOR, "input[type='file'], input[name='file']"
FORM_FIELD_LABEL = By.XPATH, ".//label | .//span[contains(@class, 'fb-form-element-label')] | ancestor::div[contains(@class, 'fb-form-element')]//label"

# ── Visibility helpers ──────────────────────────────────────────────────────

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
