# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# RAWReporter — Claude Code Project Context

## What this is
RAWReporter is a cybersecurity assessment reporting platform for OT/IT
consulting firms. It generates professional reports (DOCX) from structured
findings data. Target users are cybersecurity consultants doing penetration
tests, gap assessments, vulnerability assessments, tabletop exercises,
TSA directive assessments, and compliance assessments.

## Stack
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL 16
- Auth: FastAPI-Users with JWT
- Document generation: python-docx + Jinja2
- Frontend: React 18, TypeScript, Vite, dnd-kit, Axios, React Query, Zustand
- Local dev: Docker Compose

## Project structure
See rawreporter_project_structure.md for the full directory layout.

## Non-negotiable architecture rules
1. All enums live in backend/rawreporter/utils/enums.py — never define
   enums inline in models or schemas. Always import from enums.py.
2. Business logic lives in services/ — routers must stay thin. No
   severity logic, section assignment, or validation in routers.
3. Document generation lives in generators/ — never in services/ or routers/.
4. All SQLAlchemy models use async sessions. Never use sync SQLAlchemy.
5. All primary keys are UUIDs, never integers.

## Key business logic rules
- severity_effective = severity_override if set, else severity_default
- When a finding is added, section_id is auto-assigned based on severity_effective
  matching report_section.severity_filter
- When is_placement_override = True, override_justification must not be null
  before report generation is allowed
- Report generation is blocked if any finding has is_placement_override = True
  and override_justification IS NULL

## Commands

```bash
# Frontend (test harness)
cd frontend
npm install
npm run dev          # http://localhost:5173

# Backend
cd backend
docker compose up    # starts postgres + backend + frontend
# or run backend only:
uvicorn rawreporter.main:app --reload --port 8000

# Run tests
cd backend
pytest
pytest tests/test_clients.py        # single file
pytest -k "test_finding"            # by name pattern

# Alembic
alembic upgrade head
alembic revision --autogenerate -m "description"
```

## Test harness frontend

A plain React/TypeScript/Axios harness lives in `frontend/` (no dnd-kit or Zustand —
those are production-UI dependencies not yet wired). It hits the backend via a Vite
proxy (`/api` → `http://localhost:8000`). All API calls are in `frontend/src/api.ts`.
Each page is a single component file in `frontend/src/pages/`.

## Current build phase
Phase 1 — Database foundation (start here)
  Step 1: backend/rawreporter/utils/enums.py
  Step 2: backend/rawreporter/models/base.py
  Step 3: All ORM models in order (see project structure doc)
  Step 4: Alembic setup + initial migration
  Step 5: backend/rawreporter/database.py
