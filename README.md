# IdeaMesh

A multi-agent AI ideation platform that turns a raw software idea into a fully reasoned-out plan, with **branchable** pipelines and **in-context refinement** of any generated content.

Users feed in a seed idea (personal or business) and the platform runs a 6-stage (plus optional pitch deck) LLM pipeline: brainstorm → Q&A → SWOT + critique → competitor research → comparison → blueprint → pitch deck.

Every generated piece of content is **editable in place**: turn on Edit mode, click on a weakness, an audience, a build phase, a slide bullet, type feedback, queue it, then proceed — the platform refines all queued feedback in one coherent pass and (if the change would invalidate downstream stages) forks a new branch so the original timeline stays intact.

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required environment variables

`.env.local`:

```
# LLM
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o

# Web search (Scout stage)
TAVILY_API_KEY=tvly-...

# Supabase (auth + pipeline persistence)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The Supabase project must have the `profiles` and `pipelines` tables created (see `context.md` → Supabase schema). Google OAuth, if used, must be configured in the Supabase dashboard.

---

## Headline features

### 1. The 6+1 ideation pipeline

| # | Stage | Agents |
|---|---|---|
| 1 | Seed | User input (title, description, personal/business) |
| 2 | Mesh | Brainstorm, Q&A |
| 3 | Probe | Pros/Cons, Critique |
| 4 | Scout | Tavily web search (competitors, similar tools) |
| 5 | Compare | Competitor diff, gap analysis |
| 6 | Blueprint | Tech stack, build phases, MVP scope, coding-agent prompts |
| 7 | Pitch Deck | 6–8 slide investor deck (business ideas only) |

Each stage auto-runs on first visit, can be re-run manually, and writes its output back into the `PipelineContext` that downstream stages consume.

### 2. Branching (Copy-on-Write)

Every pipeline is a node in a tree:

- A pipeline can be **forked** at any stage. The fork deep-copies all upstream state, resets downstream stages to `idle`, and links to the parent via `parentId`. The root of the tree is tracked denormalised in `rootId`.
- Branches are visualised in the left sidebar as soft dashed limbs growing off the active spine.
- Click any branch chip to swap the active pipeline; the "Original timeline" chip jumps back to the root.
- Deleting a pipeline cascades to its descendants (Postgres FK `ON DELETE CASCADE`).

### 3. In-context refinement with queued notes

- **Edit mode** toggle in the header turns any wrapped block into a clickable target.
- Clicking opens a floating popover; the user types feedback and **queues** it. The block now wears a sticky-note chip showing the pending feedback.
- Multiple notes can be queued across an entire stage. A floating bottom bar shows the count and a **Proceed with refinements** button.
- On Proceed, the platform:
  1. forks the pipeline at the current stage (only if any downstream stage has already produced output — otherwise no fork),
  2. sends all queued notes to `/api/agents/refine-batch` in a single LLM call so refinements stay internally coherent,
  3. validates each refinement against its original JSON schema (no key add/remove, same primitive type, etc.),
  4. patches the context and saves once.

One batch refinement = at most one fork.

### 4. Mesh expansion opt-in

The Brainstorm agent emits N "expansions" (different angles for the idea). The user toggles each as in-scope or out-of-scope; only the selected ones are emphasised to downstream stages (`PipelineContext.selectedExpansions`). Editing Core Value or Target Audiences still goes through the standard refinement flow.

### 5. Auth + cloud persistence

Supabase Auth (email/password + Google OAuth) gates the workspace. Each user's pipelines are stored in `public.pipelines` with RLS isolating rows by `user_id`. Unauthenticated users get an ephemeral localStorage fallback for local prototyping.

---

## Project layout

```
src/
  app/
    (workspace)/          # Route group: header + StageRail + edit/queue mountpoints
      mesh/   probe/   scout/   compare/   blueprint/   pitchdeck/
      layout.tsx
    api/agents/
      brainstorm/  qa/  probe/  scout/  compare/  blueprint/  pitchdeck/
      refine/             # Single-target refinement (legacy, currently unused by UI)
      refine-batch/       # Batched refinement called by the queue bar
    auth/                 # login / signup / forgot-password / reset-password / callback
    profile/              # Account + saved pipelines
    page.tsx              # Landing page
  components/
    pipeline/StageRail.tsx           # Tree-visualizer sidebar
    stages/{Mesh,Probe,Scout,...}Panel.tsx
    ui/AgentCard.tsx
    ui/EditableBlock.tsx             # Wraps editable regions; renders sticky notes
    ui/EditPopover.tsx               # Floating queue composer
    ui/RefinementQueueBar.tsx        # Bottom bar that drives the batch refine
    ui/UserMenu.tsx
  lib/
    ai/client.ts          # Lazy OpenAI client (getAI/getModel)
    ai/prompts.ts         # Shared context block + per-agent prompts
    jsonPath.ts           # parsePath / getAtPath / setAtPath for refinement
    supabase/{client,server}.ts
    utils.ts              # cn(), safeParseJSON(), formatDuration()
  store/
    pipelineStore.ts      # Zustand: pipeline + savedPipelines + branchPipeline
    editModeStore.ts      # Zustand: edit toggle + refinement queue
  types/pipeline.ts
  proxy.ts                # Next 16 proxy (auth session refresh + route protection)
```

---

## Scripts

```bash
npm run dev      # next dev
npm run build    # next build (Turbopack)
npm run start    # next start
npm run lint     # eslint
```

Both `tsc --noEmit` and `npm run lint` must be clean before a change is considered done.

---

## Architecture deep dive

See [`context.md`](./context.md) for the full architecture, data model, persistence layer, prompt patterns, schema migrations, branching semantics, and gotchas.
