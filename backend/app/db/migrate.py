"""Schema migration helper.

Ensures all required columns exist on existing database tables.
SQLAlchemy's ``Base.metadata.create_all()`` only creates *new* tables;
it does NOT add columns that were added to models later.

This module runs ``ALTER TABLE … ADD COLUMN IF NOT EXISTS`` for every
column that may be missing after model changes.
"""

import logging
from sqlalchemy import text, inspect
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# ── Column definitions ───────────────────────────────────────────────────────
# (table, column_name, column_def_sql) tuples

MISSING_COLUMNS = [
    # User model — added role + company/jobseeker fields
    ("users", "role", "VARCHAR(20) DEFAULT 'jobseeker' NOT NULL"),
    ("users", "company_name", "VARCHAR"),
    ("users", "company_website", "VARCHAR"),
    ("users", "company_size", "VARCHAR"),
    ("users", "industry", "VARCHAR"),
    ("users", "company_description", "TEXT"),
    ("users", "company_logo_url", "VARCHAR"),
    ("users", "phone", "VARCHAR"),
    ("users", "location", "VARCHAR"),
    ("users", "headline", "VARCHAR"),
    ("users", "linkedin_url", "VARCHAR"),
    ("users", "portfolio_url", "VARCHAR"),
    # Job model — added poster_id
    ("jobs", "poster_id", "UUID REFERENCES users(id) ON DELETE SET NULL"),
]


def run_migration(engine: Engine) -> None:
    """Add any missing columns to existing tables."""
    try:
        inspector = inspect(engine)
        for table, column, col_def in MISSING_COLUMNS:
            # Check if table exists first
            if table not in inspector.get_table_names():
                logger.info("Table '%s' does not exist yet — skipping", table)
                continue
            # Check if column already exists
            existing_cols = {c["name"] for c in inspector.get_columns(table)}
            if column in existing_cols:
                continue

            logger.info("Adding column '%s' to table '%s' …", column, table)
            with engine.connect() as conn:
                conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_def}")
                )
                conn.commit()
            logger.info("  ✓ Column '%s' added to '%s'", column, table)

    except Exception as exc:
        logger.warning("Migration error (non-fatal): %s", exc)
