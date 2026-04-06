"""add_completed_to_engagement_status

Revision ID: 0c48e60f86c2
Revises: d2e3f4a5b6c7
Create Date: 2026-04-06 11:06:28.785525

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c48e60f86c2'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE engagementstatusenum ADD VALUE IF NOT EXISTS 'completed' BEFORE 'closed'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values — downgrade is a no-op.
    pass
