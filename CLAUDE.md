# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A project workspace running the **AIBDD (AI-driven Behavior-Driven Development) pipeline** — an automated multi-agent software development system. This workspace uses the skill library in `sdd_skill_factory/` to orchestrate requirements analysis, code generation, and testing through a Hub + Module DAG architecture.

**Current tech stack:** Java (Spring Boot 3.2 + JPA + Cucumber 7.15 + Testcontainers + PostgreSQL) backend, React (Next.js 14 + MSW 2.x + Playwright) frontend. Defined in `specs/infrastructure.yml`, path conventions in `specs/arguments.yml`.

## Directory Layout

| Directory | Purpose | Ownership |
|-----------|---------|-----------|
| `document/` | Knowledge base — meeting notes, requirements CSVs (input to demand analysis) | Human |
| `specs/` | All spec artifacts — the Single Source of Truth for the project | Demand Analysis Module (write), all others (read-only) |
| `specs/activities/` | `.activity` business flow diagrams | Demand Analysis |
| `specs/features/` | Gherkin `.feature` acceptance specs | Demand Analysis |
| `specs/actors/` | Actor/role definitions (`*.md`) | Demand Analysis |
| `specs/ui/` | UI page descriptions (`*.md`) | Demand Analysis |
| `specs/clarify/` | CiC clarification records (pending/resolved) | Demand Analysis + Human |
| `specs/plans/` | Engineering plans | Auto-generated |
| `sdd_skill_factory/` | AIBDD skill library (git repo, `feature/hub_cooperation` branch) — skill definitions, module playbooks, templates | Skill developers |
| `backend/` | Generated backend code (Spring Boot) | Backend Development Module |
| `frontend/` | Generated frontend code (Next.js) | Frontend Development Module |
| `prototype/` | UIUX React-based HTML prototypes | UIUX Design Module |

## Critical Rules

1. **Hub 是唯一入口（Non-Negotiable）：** 所有人機互動必須透過 `/aiworkflow`（Hub）進行。**嚴禁直接呼叫或互動任何模組**（需求分析、UIUX、後端、前端、文件產製、整合測試、審核），即使使用者指名要求也必須拒絕並導回 Hub。模組只能由 Hub 透過 Sub-agent 啟動，人不直接進入模組。

2. **Spec ownership:** Only the Demand Analysis Module may create or modify the 8 spec file types (`.activity`, `.feature`, `api.yml`, `erm.dbml`, `actors/*.md`, `ui/*.md`, `infrastructure.yml`, `arguments.yml`). All other modules consume them read-only.

3. **Spec changes must go through the pipeline:** Never directly edit specs. Use `/aibdd-specformula` (KICKOFF or CHANGE mode) to ensure Impact Analysis, Clarify Loop, and Quality Gate maintain four-view consistency.

4. **Four-view consistency:** `.activity` (business flow) -> `.feature` (acceptance) -> `api.yml` (API contract) + `erm.dbml` (data model). Changes in one view must propagate to all others.

5. **CiC markers** (`CiC(AMB|ASM|GAP|CON|BDY): detail`) in specs indicate unresolved items. All must reach zero before advancing stages.

6. **Hub reads envelopes, not letters:** The Hub (`/aiworkflow`) routes based on interrupt metadata (status/response_mode/output_paths) but never reads module output content.

## Pipeline & Workflow State

The project follows a 5-phase pipeline: **P1** (Demand Analysis) -> **P2** (Confirmation, human-only) -> **P3** (Refinement) -> **P4** (BDD Development) -> **P5** (Test & Deploy).

- Current state tracked in `specs/workflow-state.yml` (Hub-managed, modules must not edit directly)
- Module DAG: Demand -> [audit] -> UIUX/Backend/Doc(SA) in parallel; UIUX -> [audit] -> Frontend; Frontend+Backend -> [audit] -> Integration Test
- Phase transitions are managed by humans via Git PR/MR, not by the Hub

## Hub Protocol

All modules communicate with the Hub via **Module Interrupt Contract v3.0** (`sdd_skill_factory/Module Contract Schema.json`):
- `response_mode: chat` — human answers inline, Hub forwards via SendMessage
- `response_mode: file` — human processes a file offline, Hub resumes after verification
- `response_mode: none` — module completed, no human input needed

## Key Spec Files

| File | Location | Description |
|------|----------|-------------|
| `infrastructure.yml` | `specs/` | Tech stack definition. Frozen after P2 |
| `arguments.yml` | `specs/` | Path conventions + tech stack routing for all skills |
| `api.yml` | `specs/` | OpenAPI 3.0.0 API contract |
| `erm.dbml` | `specs/` | DBML data model |
| `workflow-state.yml` | `specs/` | Hub DAG state — written only by Hub tools |

## Language

All specs, skill content, agent prompts, and documentation are in **Traditional Chinese (zh-TW)**. Maintain this convention.

## Reference Documentation

- Hub architecture & interrupt protocol: `sdd_skill_factory/HUB-PROTOCOL.md`
- Full workflow (P1-P5): `sdd_skill_factory/WORKFLOW.md`
- Skill index: `sdd_skill_factory/SKILLS_OVERVIEW.md`
- Skill library internals: `sdd_skill_factory/CLAUDE.md`
- Tech stack -> skill mapping: `sdd_skill_factory/skill-availability.yml`
