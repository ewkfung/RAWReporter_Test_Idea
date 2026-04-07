"""add_builder_enum_values

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-04-06 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Note: engagement types are stored as JSONB, not a PostgreSQL enum — no ALTER TYPE needed.

    # Add new section types to sectiontypeenum
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'findings'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'report_title'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'scope_and_methodology'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'scope_and_rules_of_engagement'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'methodology'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'attack_path'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'risk_assessment_approach'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'risk_assessment_result'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'compliance_framework_overview'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'compliance_maturity'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'gap_analysis'")
    op.execute("ALTER TYPE sectiontypeenum ADD VALUE IF NOT EXISTS 'remediation_roadmap'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values — no-op
    pass
