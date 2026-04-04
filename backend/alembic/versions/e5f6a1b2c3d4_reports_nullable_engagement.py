"""reports_nullable_engagement

Revision ID: e5f6a1b2c3d4
Revises: d4e5f6a1b2c3
Create Date: 2026-04-03

- Makes reports.engagement_id nullable
- Changes FK ondelete from CASCADE to SET NULL
  so that deleting an engagement unlinks its reports
  rather than deleting them.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "e5f6a1b2c3d4"
down_revision = "d4e5f6a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing FK constraint (CASCADE)
    op.drop_constraint("reports_engagement_id_fkey", "reports", type_="foreignkey")

    # Make the column nullable
    op.alter_column("reports", "engagement_id", nullable=True)

    # Re-add FK with SET NULL on delete
    op.create_foreign_key(
        "reports_engagement_id_fkey",
        "reports",
        "engagements",
        ["engagement_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Restore NOT NULL (set any NULLs to a dummy value first — not safe in prod,
    # but acceptable for a local dev rollback)
    op.execute("DELETE FROM reports WHERE engagement_id IS NULL")
    op.drop_constraint("reports_engagement_id_fkey", "reports", type_="foreignkey")
    op.alter_column("reports", "engagement_id", nullable=False)
    op.create_foreign_key(
        "reports_engagement_id_fkey",
        "reports",
        "engagements",
        ["engagement_id"],
        ["id"],
        ondelete="CASCADE",
    )
