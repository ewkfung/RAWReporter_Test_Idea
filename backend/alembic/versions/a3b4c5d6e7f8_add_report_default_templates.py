"""add_report_default_templates

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-04-06 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

# revision identifiers, used by Alembic.
revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_default_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("engagement_type", sa.String(length=64), nullable=False),
        sa.Column(
            "section_type",
            ENUM(name="sectiontypeenum", create_type=False),
            nullable=False,
        ),
        sa.Column("default_body", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "engagement_type", "section_type", name="uq_template_engagement_section"
        ),
    )


def downgrade() -> None:
    op.drop_table("report_default_templates")
