"""report_overhaul

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-04-03

- Drops audience column from reports
- Replaces reportstatusenum with new values:
    draft, review, editing, final_review, complete
- Adds types (JSONB array), start_date, due_date, is_archived, archived_at
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "d4e5f6a1b2c3"
down_revision = "c3d4e5f6a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop audience column (was a PG enum column)
    op.drop_column("reports", "audience")

    # 2. Convert status to text so we can remap values
    op.execute("ALTER TABLE reports ALTER COLUMN status TYPE text USING status::text")

    # 3. Map old status values to new ones
    op.execute("""
        UPDATE reports SET status = CASE status
            WHEN 'draft'     THEN 'draft'
            WHEN 'in_review' THEN 'review'
            WHEN 'final'     THEN 'complete'
            ELSE 'draft'
        END
    """)

    # 4. Drop old enum type
    op.execute("DROP TYPE IF EXISTS reportstatusenum")
    op.execute("DROP TYPE IF EXISTS audienceenum")

    # 5. Create new status enum and cast column
    op.execute("""
        CREATE TYPE reportstatusenum AS ENUM
        ('draft', 'review', 'editing', 'final_review', 'complete')
    """)
    op.execute("""
        ALTER TABLE reports
        ALTER COLUMN status TYPE reportstatusenum
        USING status::reportstatusenum
    """)

    # 6. Add new columns
    op.add_column(
        "reports",
        sa.Column("types", JSONB(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "reports",
        sa.Column("start_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "reports",
        sa.Column("due_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "reports",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "reports",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reports", "archived_at")
    op.drop_column("reports", "is_archived")
    op.drop_column("reports", "due_date")
    op.drop_column("reports", "start_date")
    op.drop_column("reports", "types")

    op.execute("ALTER TABLE reports ALTER COLUMN status TYPE text USING status::text")
    op.execute("DROP TYPE IF EXISTS reportstatusenum")
    op.execute("""
        CREATE TYPE reportstatusenum AS ENUM ('draft', 'in_review', 'final')
    """)
    op.execute("""
        UPDATE reports SET status = CASE status
            WHEN 'draft'        THEN 'draft'
            WHEN 'review'       THEN 'in_review'
            WHEN 'editing'      THEN 'draft'
            WHEN 'final_review' THEN 'in_review'
            WHEN 'complete'     THEN 'final'
            ELSE 'draft'
        END
    """)
    op.execute("""
        ALTER TABLE reports
        ALTER COLUMN status TYPE reportstatusenum
        USING status::reportstatusenum
    """)

    op.execute("CREATE TYPE audienceenum AS ENUM ('technical', 'executive')")
    op.add_column(
        "reports",
        sa.Column(
            "audience",
            sa.Enum("technical", "executive", name="audienceenum"),
            nullable=True,
        ),
    )
    op.execute("UPDATE reports SET audience = 'technical'")
    op.execute("ALTER TABLE reports ALTER COLUMN audience SET NOT NULL")
