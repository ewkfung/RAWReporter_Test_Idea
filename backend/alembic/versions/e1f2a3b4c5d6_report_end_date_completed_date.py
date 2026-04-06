"""report_end_date_completed_date

Revision ID: e1f2a3b4c5d6
Revises: 0c48e60f86c2
Create Date: 2026-04-06 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "0c48e60f86c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("reports", "due_date", new_column_name="end_date")
    op.add_column("reports", sa.Column("completed_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "completed_date")
    op.alter_column("reports", "end_date", new_column_name="due_date")
