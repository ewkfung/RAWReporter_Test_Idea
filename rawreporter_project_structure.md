# RAWReporter — Project Structure & Stack Setup

## Directory Structure

```
rawreporter/
├── .vscode/
│   ├── settings.json
│   ├── extensions.json
│   └── launch.json
├── backend/
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py
│   ├── rawreporter/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── config.py                # Settings via pydantic-settings
│   │   ├── database.py              # Async SQLAlchemy engine + session
│   │   ├── dependencies.py          # Shared FastAPI dependencies
│   │   │
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── models.py            # User model (FastAPI-Users)
│   │   │   ├── router.py            # Auth routes (login, register, refresh)
│   │   │   └── schemas.py           # User read/create/update schemas
│   │   │
│   │   ├── models/                  # SQLAlchemy ORM models (one file per table)
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # Base declarative + UUID mixin
│   │   │   ├── client.py
│   │   │   ├── engagement.py
│   │   │   ├── report.py
│   │   │   ├── report_section.py
│   │   │   ├── finding.py
│   │   │   ├── finding_reference.py
│   │   │   ├── evidence.py
│   │   │   ├── library_finding.py
│   │   │   └── library_finding_reference.py
│   │   │
│   │   ├── schemas/                 # Pydantic schemas (one file per domain)
│   │   │   ├── __init__.py
│   │   │   ├── client.py
│   │   │   ├── engagement.py
│   │   │   ├── report.py
│   │   │   ├── report_section.py
│   │   │   ├── finding.py
│   │   │   ├── finding_reference.py
│   │   │   ├── evidence.py
│   │   │   ├── library_finding.py
│   │   │   └── library_finding_reference.py
│   │   │
│   │   ├── routers/                 # FastAPI routers (one file per domain)
│   │   │   ├── __init__.py
│   │   │   ├── clients.py
│   │   │   ├── engagements.py
│   │   │   ├── reports.py
│   │   │   ├── sections.py
│   │   │   ├── findings.py
│   │   │   ├── evidence.py
│   │   │   └── library.py
│   │   │
│   │   ├── services/                # Business logic layer (not in routers)
│   │   │   ├── __init__.py
│   │   │   ├── finding_service.py   # Severity logic, section assignment
│   │   │   ├── report_service.py    # Section seeding, validation
│   │   │   ├── library_service.py   # Finding import/copy logic
│   │   │   └── document_service.py  # DOCX generation orchestration
│   │   │
│   │   ├── generators/              # Report generation engine
│   │   │   ├── __init__.py
│   │   │   ├── docx_generator.py    # python-docx + Jinja2 pipeline
│   │   │   ├── context_builder.py   # Builds template context from DB data
│   │   │   └── templates/           # Jinja2 + DOCX templates
│   │   │       ├── technical/
│   │   │       │   └── base.docx
│   │   │       └── executive/
│   │   │           └── base.docx
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── enums.py             # All enum definitions (single source of truth)
│   │       └── exceptions.py        # Custom HTTP exceptions
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py              # Pytest fixtures, test DB setup
│   │   ├── test_clients.py
│   │   ├── test_engagements.py
│   │   ├── test_findings.py
│   │   ├── test_library.py
│   │   └── test_document_generation.py
│   │
│   ├── uploads/                     # Evidence file storage (gitignored)
│   ├── alembic.ini
│   ├── pyproject.toml
│   └── .env                         # Local env vars (gitignored)
│
├── frontend/
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── main.tsx                 # React entry point
│   │   ├── App.tsx                  # Root component, router setup
│   │   ├── vite-env.d.ts
│   │   │
│   │   ├── api/                     # Axios instances + API call functions
│   │   │   ├── client.ts            # Axios base instance + interceptors
│   │   │   ├── auth.ts
│   │   │   ├── clients.ts
│   │   │   ├── engagements.ts
│   │   │   ├── reports.ts
│   │   │   ├── findings.ts
│   │   │   └── library.ts
│   │   │
│   │   ├── components/              # Reusable UI components
│   │   │   ├── ui/                  # Generic (buttons, inputs, modals)
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Badge.tsx        # Severity badges (Critical/High/etc)
│   │   │   │   └── Toggle.tsx       # Section/reference visibility toggles
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Topbar.tsx
│   │   │   │   └── PageWrapper.tsx
│   │   │   │
│   │   │   ├── findings/
│   │   │   │   ├── FindingCard.tsx            # Draggable finding item
│   │   │   │   ├── FindingForm.tsx            # Full finding editor
│   │   │   │   ├── FindingBadge.tsx           # Severity + override indicator
│   │   │   │   ├── ReferenceList.tsx          # CVE/CWE/etc with toggles
│   │   │   │   └── SeverityOverrideModal.tsx  # Override + justification
│   │   │   │
│   │   │   └── report/
│   │   │       ├── ReportBuilder.tsx     # Main drag-and-drop canvas
│   │   │       ├── SectionBlock.tsx      # Draggable section container
│   │   │       ├── SectionHeader.tsx     # Title + visibility toggle
│   │   │       └── GenerateButton.tsx    # Triggers report generation
│   │   │
│   │   ├── pages/                   # Route-level page components
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── RegisterPage.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── DashboardPage.tsx
│   │   │   ├── clients/
│   │   │   │   ├── ClientListPage.tsx
│   │   │   │   └── ClientDetailPage.tsx
│   │   │   ├── engagements/
│   │   │   │   ├── EngagementListPage.tsx
│   │   │   │   └── EngagementDetailPage.tsx
│   │   │   ├── reports/
│   │   │   │   ├── ReportListPage.tsx
│   │   │   │   └── ReportBuilderPage.tsx  # The main working page
│   │   │   └── library/
│   │   │       ├── LibraryPage.tsx
│   │   │       └── LibraryFindingPage.tsx
│   │   │
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useFindings.ts
│   │   │   ├── useReportBuilder.ts  # Drag-and-drop state management
│   │   │   └── useLibrary.ts
│   │   │
│   │   ├── store/                   # Global state (Zustand)
│   │   │   ├── authStore.ts
│   │   │   └── reportBuilderStore.ts
│   │   │
│   │   ├── types/                   # TypeScript type definitions
│   │   │   ├── api.ts               # API response shapes
│   │   │   ├── models.ts            # Domain model types
│   │   │   └── enums.ts             # Frontend enum mirrors
│   │   │
│   │   └── utils/
│   │       ├── severity.ts          # Severity colour mapping, helpers
│   │       └── formatting.ts        # Date formatting, string utils
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── package.json
│   └── .env                         # VITE_API_URL etc (gitignored)
│
├── docker-compose.yml               # Local dev stack
├── docker-compose.prod.yml          # Future prod stack (placeholder)
├── .gitignore
├── .env.example                     # Committed env template
└── README.md
```

---

## Key Architectural Decisions

### Why services/ sits between routers/ and models/

Routers handle HTTP — request parsing, response shaping, HTTP errors.
Services handle business logic — severity assignment, section seeding,
finding import, validation rules. Models handle persistence.

This means finding_service.py owns the logic for:
- Assigning a finding to the correct section based on severity_effective
- Flipping is_placement_override when section and severity don't match
- Blocking report generation when override_justification is missing

If this logic lived in routers, it would be duplicated or scattered.
If it lived in models, models become fat and untestable. Services are
the right home.

### Why enums.py is a single file in utils/

Every enum used across models, schemas, and routers comes from one
place. Python enums are imported, not redefined. This prevents the
classic mistake of defining SeverityEnum in models/finding.py and
then redefining it in schemas/finding.py — they drift, bugs happen.

### Why generators/ is separate from services/

Document generation is IO-heavy, template-dependent, and has its own
failure modes (missing template, corrupt DOCX, Jinja2 render error).
Keeping it isolated means you can swap the generator (DOCX → PDF)
without touching business logic. context_builder.py is the bridge —
it pulls data from the DB and shapes it into the template context,
completely separate from the rendering step.

### Why Zustand for frontend state

React Query handles server state (API data, caching, refetching).
Zustand handles client state (what's being dragged, which panel is
open, local UI state that doesn't belong in the URL). Using Redux for
this would be overkill. Using only React context would cause
unnecessary re-renders in the drag-and-drop builder.

---

## docker-compose.yml (local dev)

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: rawreporter
      POSTGRES_PASSWORD: rawreporter
      POSTGRES_DB: rawreporter
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    restart: unless-stopped
    depends_on:
      - db
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./backend/uploads:/app/uploads
    environment:
      DATABASE_URL: postgresql+asyncpg://rawreporter:rawreporter@db:5432/rawreporter
      SECRET_KEY: dev-secret-change-in-production
      ENVIRONMENT: development
    command: uvicorn rawreporter.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    restart: unless-stopped
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      VITE_API_URL: http://localhost:8000
    command: npm run dev -- --host

volumes:
  postgres_data:
```

---

## backend/pyproject.toml

```toml
[project]
name = "rawreporter"
version = "0.1.0"
requires-python = ">=3.12"

dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
  "sqlalchemy[asyncio]>=2.0",
  "asyncpg>=0.29",
  "alembic>=1.13",
  "pydantic>=2.7",
  "pydantic-settings>=2.3",
  "fastapi-users[sqlalchemy]>=13.0",
  "python-multipart>=0.0.9",
  "python-docx>=1.1",
  "jinja2>=3.1",
  "aiofiles>=23.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "pytest-asyncio>=0.23",
  "httpx>=0.27",
  "pytest-cov>=5.0",
]
```

---

## frontend/package.json (key dependencies)

```json
{
  "name": "rawreporter",
  "private": true,
  "version": "0.1.0",
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6.23",
    "@dnd-kit/core": "^6.1",
    "@dnd-kit/sortable": "^8.0",
    "@dnd-kit/utilities": "^3.2",
    "axios": "^1.7",
    "@tanstack/react-query": "^5.40",
    "zustand": "^4.5",
    "typescript": "^5.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3",
    "vite": "^5.3",
    "vitest": "^1.6",
    "@types/react": "^18.3",
    "@types/react-dom": "^18.3"
  }
}
```

---

## .vscode/extensions.json

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "charliermarsh.ruff",
    "ms-azuretools.vscode-docker",
    "bradlc.vscode-tailwindcss",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "mtxr.sqltools",
    "mtxr.sqltools-driver-pg"
  ]
}
```

---

## .gitignore

```
# Python
__pycache__/
*.pyc
*.pyo
.venv/
*.egg-info/
.pytest_cache/
.coverage
htmlcov/

# Environment
.env
.env.local

# Uploads
backend/uploads/*
!backend/uploads/.gitkeep

# Frontend
frontend/node_modules/
frontend/dist/

# Database
*.db
*.sqlite

# OS
.DS_Store
Thumbs.db

# VS Code
.vscode/settings.json
```

---

## .env.example

```
# Backend
DATABASE_URL=postgresql+asyncpg://rawreporter:rawreporter@localhost:5432/rawreporter
SECRET_KEY=change-this-to-a-random-secret-in-production
ENVIRONMENT=development
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE_MB=20

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## Build Order for Claude Code

Phase 1 — Database foundation
  1. utils/enums.py — all enums first, everything imports from here
  2. models/base.py — UUID primary key mixin, timestamps
  3. models/ — all ORM models in dependency order:
       base → client → engagement → report → report_section
       → library_finding → library_finding_reference
       → finding → finding_reference → evidence
  4. alembic setup + initial migration
  5. database.py — async engine, session factory, get_db dependency

Phase 2 — API skeleton
  6. config.py — pydantic-settings, reads from .env
  7. schemas/ — Pydantic schemas for all models
  8. auth/ — FastAPI-Users setup, user model, auth routes
  9. main.py — FastAPI app, include all routers, CORS config
  10. routers/ — CRUD routes for all domains, no business logic here

Phase 3 — Business logic
  11. services/library_service.py — finding import + copy logic
  12. services/finding_service.py — severity assignment, override logic
  13. services/report_service.py — section seeding on report creation,
                                   generation validation (no missing
                                   justifications before DOCX export)

Phase 4 — Document generation
  14. generators/context_builder.py — DB → template context
  15. generators/docx_generator.py — python-docx + Jinja2 pipeline
  16. generators/templates/ — base DOCX templates

Phase 5 — Frontend
  17. Vite + React scaffold
  18. api/ layer — Axios client + all endpoint functions
  19. Auth pages + useAuth hook
  20. Core layout (Sidebar, Topbar, PageWrapper)
  21. Library pages (browse, search, filter by vertical/severity)
  22. Client + Engagement CRUD pages
  23. ReportBuilderPage — the main feature, built last when
                          all API endpoints exist to support it
  24. dnd-kit integration — sections drag, findings drag within
                            and across sections
  25. SeverityOverrideModal + justification gating
  26. GenerateButton → download DOCX
```
