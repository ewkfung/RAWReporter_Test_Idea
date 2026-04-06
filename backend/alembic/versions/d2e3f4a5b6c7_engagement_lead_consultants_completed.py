"""engagement_lead_consultants_completed

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-04-06 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add completed_date
    op.add_column("engagements", sa.Column("completed_date", sa.Date(), nullable=True))

    # Add engagement_lead_id (FK to users, SET NULL on delete)
    op.add_column(
        "engagements",
        sa.Column("engagement_lead_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "engagements_engagement_lead_id_fkey",
        "engagements",
        "users",
        ["engagement_lead_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Add consultant_ids as JSONB array (default empty array)
    op.add_column(
        "engagements",
        sa.Column(
            "consultant_ids",
            JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    # Drop the old freetext engagement_lead column
    op.drop_column("engagements", "engagement_lead")


def downgrade() -> None:
    op.add_column(
        "engagements",
        sa.Column("engagement_lead", sa.String(), nullable=True),
    )
    op.drop_column("engagements", "consultant_ids")
    op.drop_constraint(
        "engagements_engagement_lead_id_fkey", "engagements", type_="foreignkey"
    )
    op.drop_column("engagements", "engagement_lead_id")
    op.drop_column("engagements", "completed_date")
