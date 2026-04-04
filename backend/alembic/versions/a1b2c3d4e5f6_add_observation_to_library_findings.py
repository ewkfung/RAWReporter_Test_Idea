"""add_observation_to_library_findings

Revision ID: a1b2c3d4e5f6
Revises: 29c0fc77c2fe
Create Date: 2026-04-02 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "29c0fc77c2fe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "library_findings",
        sa.Column(
            "observation",
            sa.Text(),
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    op.drop_column("library_findings", "observation")
