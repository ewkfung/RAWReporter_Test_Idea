"""add_client_fields_and_archive

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-04-03

Renames: industry → company_name, vertical → industry_vertical
Adds: company_address, additional_contacts, client_status, is_archived, archived_at
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "b2c3d4e5f6a1"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename existing columns
    op.alter_column("clients", "industry", new_column_name="company_name")
    op.alter_column("clients", "vertical", new_column_name="industry_vertical")

    # Add new columns
    op.add_column(
        "clients",
        sa.Column("company_address", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "clients",
        sa.Column(
            "additional_contacts",
            JSONB(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "clients",
        sa.Column(
            "client_status",
            sa.String(),
            nullable=False,
            server_default="active",
        ),
    )
    op.add_column(
        "clients",
        sa.Column(
            "is_archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "clients",
        sa.Column(
            "archived_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("clients", "archived_at")
    op.drop_column("clients", "is_archived")
    op.drop_column("clients", "client_status")
    op.drop_column("clients", "additional_contacts")
    op.drop_column("clients", "company_address")
    op.alter_column("clients", "industry_vertical", new_column_name="vertical")
    op.alter_column("clients", "company_name", new_column_name="industry")
