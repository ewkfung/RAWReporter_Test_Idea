"""engagement_multi_type_and_archive

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-04-03

- Converts engagements.type from SAEnum to JSONB array (list of strings)
- Adds is_archived, archived_at to engagements
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "c3d4e5f6a1b2"
down_revision = "b2c3d4e5f6a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add a new JSONB column for types
    op.add_column(
        "engagements",
        sa.Column("types", JSONB(), nullable=False, server_default='[]'),
    )

    # 2. Migrate existing single-type values into the new array column
    op.execute(
        """
        UPDATE engagements
        SET types = to_jsonb(ARRAY[type::text])
        WHERE type IS NOT NULL
        """
    )

    # 3. Drop the old enum column
    op.drop_column("engagements", "type")

    # 4. Drop the PostgreSQL enum type if it exists and is no longer used
    op.execute("DROP TYPE IF EXISTS engagementtypeenum")

    # 5. Add archive columns
    op.add_column(
        "engagements",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "engagements",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("engagements", "archived_at")
    op.drop_column("engagements", "is_archived")

    # Recreate the enum type and column (best-effort downgrade)
    op.execute(
        """
        CREATE TYPE engagementtypeenum AS ENUM (
            'pentest', 'gap_assessment', 'vulnerability_assessment',
            'tabletop', 'tsa_directive', 'compliance_assessment'
        )
        """
    )
    op.add_column(
        "engagements",
        sa.Column(
            "type",
            sa.Enum(
                "pentest", "gap_assessment", "vulnerability_assessment",
                "tabletop", "tsa_directive", "compliance_assessment",
                name="engagementtypeenum",
            ),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE engagements
        SET type = (types->>0)::engagementtypeenum
        WHERE jsonb_array_length(types) > 0
        """
    )
    op.drop_column("engagements", "types")
