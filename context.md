# IdeaMesh — Project Context

## Purpose
IdeaMesh is a **6-stage (plus optional pitch deck) AI ideation platform** with two distinguishing capabilities on top of the linear flow:

1. **Copy-on-Write branching.** Any pipeline can be forked at any completed stage. The fork deep-copies the upstream state, resets downstream stages to `idle`, and is linked to the parent via `parentId`. The original timeline is preserved.
2. **In-context refinement with a queued-notes workflow.** Any LLM-generated value (a weakness, an audience, a build phase, a slide bullet, …) can be wrapped as an editable region. The user queues feedback notes across the whole stage and proceeds with all of them in a single batch refinement call — which produces at most one fork.

Users feed in a raw software idea (classified as personal or business) and the platform runs a multi-agent LLM pipeline to brainstorm, question, critique, research competitors, compare, generate a technical blueprint, and optionally produce a pitch deck.

## Tech Stack
- **Framework:** Next.js 16.2.6 (App Router, `next build` uses Turbopack)
- **Language:** TypeScript 5.x
- **UI Library:** React 19.2.4
- **Styling:** Tailwind CSS 3.4.x (v3 NOT v4)
- **Animations:** framer-motion 12.x
- **Icons:** lucide-react 1.x
- **AI SDK:** openai 6.x (note: v6 validates apiKey eagerly — use lazy client)
- **State:** zustand 5.x with persist middleware
- **Auth + DB:** `@supabase/ssr` 0.10.x + `@supabase/supabase-js` 2.x (Postgres + RLS)
- **Fonts:** geist (via npm package, `--font-geist-sans` / `--font-geist-mono` CSS vars)
- **Utilities:** clsx, tailwind-merge (wrapped as `cn()` in `lib/utils.ts`)

## Architecture

### Directory Structure
```
src/
  app/                          # Next.js App Router pages + API routes
    (workspace)/                # Route group — all stage pages share a layout
      blueprint/page.tsx        # Stage 6
      compare/page.tsx          # Stage 5
      mesh/page.tsx             # Stage 2
      pitchdeck/page.tsx        # Stage 7 (business only)
      probe/page.tsx            # Stage 3
      scout/page.tsx            # Stage 4
      layout.tsx                # Header + StageRail + EditPopover + RefinementQueueBar
    api/agents/
      blueprint/route.ts
      brainstorm/route.ts
      compare/route.ts
      pitchdeck/route.ts
      probe/route.ts
      qa/route.ts
      scout/route.ts
      refine/route.ts           # Single-target refinement (kept for completeness; not in UI)
      refine-batch/route.ts     # Batched refinement called by the queue bar
    auth/                       # Supabase auth: login, signup, forgot/reset password, callback
    profile/page.tsx            # Account + list of saved pipelines (roots only, branches nested)
    layout.tsx                  # Root layout (Geist fonts, globals.css)
    page.tsx                    # Landing page (idea input + saved ideas)
  components/
    pipeline/StageRail.tsx      # Tree-visualizer sidebar: active stages + sibling branch limbs
    stages/                     # One panel component per stage
    ui/
      AgentCard.tsx             # Card chrome shared by all stages
      EditableBlock.tsx         # Wraps any editable region; shows sticky notes
      EditPopover.tsx           # Floating note composer
      RefinementQueueBar.tsx    # Floating bottom bar driving the batched refine flow
      StreamingText.tsx
      Tag.tsx
      UserMenu.tsx
  lib/
    ai/client.ts                # Lazy OpenAI client (getAI, getModel)
    ai/prompts.ts               # All agent prompts + shared contextBlock
    ai/stream.ts                # Streaming utilities
    jsonPath.ts                 # parsePath / getAtPath / setAtPath (dotted + [index] only)
    search/tavily.ts            # Tavily search client
    supabase/client.ts          # createBrowserClient (used in store + client components)
    supabase/server.ts          # async createServerClient (used in route handlers)
    utils.ts                    # cn(), formatDuration(), safeParseJSON()
  store/
    pipelineStore.ts            # Zustand: active pipeline, savedPipelines, branching
    editModeStore.ts            # Zustand: edit toggle, active popover target, refinement queue
  types/pipeline.ts             # All shared types, StageId, StageConfig
  proxy.ts                      # Next 16 proxy: session refresh + route protection
```

### Pipeline Stages
| # | Stage ID | Label | Accent | Agents |
|---|----------|-------|--------|--------|
| 1 | seed | Seed | white | Input |
| 2 | mesh | Mesh | purple | Brainstorm, Q&A |
| 3 | probe | Probe | coral | Pros/Cons, Critique |
| 4 | scout | Scout | blue | Web Search (Tavily) |
| 5 | compare | Compare | teal | Comparison |
| 6 | blueprint | Blueprint | amber | Synthesis |
| 7 | pitchdeck | Pitch Deck | green | Pitch Deck (business only) |

- Stage 7 (pitchdeck) is **hidden from StageRail** when `idea.type === 'personal'`
- The "Continue to Pitch Deck" button on the blueprint page only appears for business ideas

### Data Flow
1. **Landing page** (`/`): User enters title, description, and selects Personal/Business. `initPipeline()` creates a `PipelineState` (with `rootId = id`) and saves to Zustand + Supabase (or localStorage if unauthenticated).
2. **Stage pages** auto-run on mount via `useEffect` (auto-runs once when `idle`).
3. Each page calls its API route(s), receives JSON, calls `updateContext()` to store the result in Zustand, then calls `setStageStatus('done')`.
4. `setStageStatus('done'/'error')` triggers `savePipeline()` — upserts the full pipeline to Supabase (or localStorage fallback).
5. User navigates between stages via StageRail sidebar or "Continue to X" buttons. The StageRail also surfaces sibling branches and lets the user swap between them.

### Branching model

Every pipeline belongs to a tree:

- `PipelineState.id` — unique per pipeline.
- `PipelineState.rootId` — id of the topmost ancestor; equal to `id` for roots. **Denormalised** so queries like "show me all pipelines sharing my root" are a single indexed read.
- `PipelineState.parentId` — direct parent (null for roots).
- `PipelineState.branchName` — human-readable label shown in the StageRail's branch chip.
- `PipelineState.forkedAtStage` — the spine stage at which the branch diverged.

`branchPipeline(targetStage, branchName?)` (in `pipelineStore.ts`):

1. Persists the parent first so the FK reference is valid.
2. Deep-clones the context, **trimming downstream fields** (`prosCons`, `critique`, …) so a re-run actually regenerates them.
3. Resets all stages strictly after `targetStage` to `idle`.
4. Inserts the new branch row and swaps it in as the active pipeline.

`fetchBranches(rootId)` returns all rows with that `root_id`, used by `StageRail` to draw branch limbs and by future tree-view UIs.

`fetchSavedPipelines()` returns **only roots** (`parent_id IS NULL`) so the profile page's "Saved" list stays uncluttered; branches are accessed by entering a tree.

### Edit mode + refinement queue

State lives in `src/store/editModeStore.ts`:

```ts
{
  isEditMode: boolean
  activeEdit: EditTarget | null      // currently open popover, or null
  queue: QueuedRefinement[]          // pending feedback notes
}
```

Flow:

1. User toggles **Edit** in the workspace header.
2. Any `<EditableBlock stage path label>` becomes a clickable target — dashed purple outline, pencil affordance on hover.
3. Click opens `<EditPopover>` (single instance, portal-mounted from the workspace layout). The popover composes one feedback note targeting that specific JSON path.
4. Submitting "Queue refinement" calls `enqueue({ pipelineId, stage, path, label, instruction })`. Enqueue **upserts by `(pipelineId, stage, path)`** so repeat clicks edit rather than duplicate.
5. EditableBlock renders a `StickyNoteChip` under its children whenever a queue item matches its path — visible regardless of edit-mode so the user can browse with notes attached.
6. `<RefinementQueueBar>` (floating bottom bar) appears whenever the active pipeline+stage has ≥1 queued item. It shows count, expand/collapse, per-item delete, clear-all, and the **Proceed with refinements** button.
7. Proceed → inline confirm explaining `Fork & apply` vs `Apply` → on confirm:
   1. If any downstream stage's status is `done` for the active stage → `branchPipeline(activeStage)` is called once. After fork, `rekeyQueueFor` rewrites every queue item's `pipelineId` to the new branch's id (so retry-after-failure works on the new branch).
   2. `POST /api/agents/refine-batch` is called once with `fullContext + stage + refinements[]`.
   3. The returned refinements are applied via `setAtPath` and committed with a single `updateContext` + `savePipeline`.
   4. The queue for the active pipeline+stage is cleared.

If the batch refine fails after a fork, the user is left on the new branch with queue items still visible (thanks to the rekey) and can retry without producing a second fork.

### `/api/agents/refine-batch` contract

Request:
```ts
{
  fullContext: PipelineContext
  stage: StageId
  refinements: Array<{ targetPath: string; label: string; instruction: string }>
}
```

Response:
```ts
{ refinements: Array<{ targetPath: string; value: unknown }> }
```

Server-side responsibilities:

- Resolve the current value at each `targetPath` via `getAtPath`.
- Compute a `describeShape(currentValue)` description for each item.
- Build a single prompt instructing the LLM to apply **all** notes coherently and emit `{"refinements":[{"key","value"}…]}`. Each item is given a stable `r1`, `r2`, … key so the response can be matched back to paths.
- Validate each refined value with `sameShape(original, refined)`:
  - primitives: same `typeof`
  - arrays: must remain arrays
  - objects: identical key sets (no add/remove/rename)
- Reject the response with 502 if any item is missing or mismatched.

Limits: max 50 refinements per batch, max 2000 chars per instruction.

### Persistence

**Supabase (authenticated users):**
- `public.profiles` — one row per auth user, auto-created via `on_auth_user_created` trigger.
- `public.pipelines` — full pipeline state with RLS isolating rows per `user_id`. Columns:
  - `id text PK`
  - `user_id uuid REFERENCES auth.users`
  - `title text`, `idea_type text`, `current_stage text`
  - `stages jsonb`, `context jsonb`
  - `parent_id text NULL REFERENCES pipelines(id) ON DELETE CASCADE`
  - `root_id text NOT NULL` (indexed)
  - `branch_name text NULL`
  - `forked_at_stage text NULL`
  - `created_at timestamptz`, `updated_at timestamptz`
- Indexes: `pipelines_root_id_idx`, `pipelines_parent_id_idx`.

**Unauthenticated users** fall back to localStorage:
- Zustand persist key: `ideamesh-pipeline` (current version `4`)
- Pipeline data keys: `ideamesh-data-{id}` (full `PipelineState` JSON)

**Zustand persist migrations:** `migrate(persisted, version)` handles v→v+1 jumps. v4 backfills `rootId = id` for any in-flight pipeline that pre-dates branching.

### Auth

- Email/password + Google OAuth via Supabase Auth.
- `src/proxy.ts` is the Next 16 proxy (replaces the deprecated `middleware.ts`). It refreshes the session cookie and protects workspace routes.
- Auth pages: `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/callback`.
- `<UserMenu>` in the workspace header and landing page surfaces sign-out + profile link.
- Google OAuth requires manual configuration in the Supabase dashboard (Auth → Providers → Google). Site URL + redirect URLs must be configured per environment.

## Key Implementation Details

### AI Client (`lib/ai/client.ts`)
- Uses **lazy singleton** pattern — `getAI()` / `getModel()` check env vars at call time, not import time.
- **Critical:** OpenAI SDK v6 eagerly validates `apiKey` in the constructor. Empty string throws. Always guard with env check.
- Env vars: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`.

### Prompts (`lib/ai/prompts.ts`)
- `contextBlock(ctx)` generates a shared context string injected into every prompt.
- Each prompt instructs the LLM to return valid JSON only (no markdown fences, no preamble).
- `qaPrompt` is **idea-type-aware**: for personal ideas it replaces `business` with `usability`/`motivation` and forbids monetization questions.
- `pitchDeckPrompt` generates 6–8 slides with layouts: `title-slide`, `bullets`, `two-column`, `centered`, `closing`.
- `formatExpansions(ctx)` splits `brainstorm.expansions` into "user-selected (primary)" vs "other (de-emphasised)" sections based on `selectedExpansions`. If `selectedExpansions` is empty/undefined, all expansions are sent as primary (current default).

### `safeParseJSON` (`lib/utils.ts`)
- Strips markdown code fences, then `JSON.parse`s. Extracts the outermost `{…}` / `[…]` block as a fallback for chatty models.
- Used in every API route handler.

### `jsonPath` (`lib/jsonPath.ts`)
- `parsePath('prosCons.cons[0]') → ['prosCons', 'cons', 0]`. Supports dotted keys + numeric brackets only — no wildcards, no quoted keys.
- `getAtPath(root, path)` — safe traversal, returns `undefined` on miss.
- `setAtPath(root, path, value)` — returns a new root with the value replaced. Each level is cloned (object spread / array slice) so React sees new references for changed branches; unchanged branches are structurally shared.

### API Route Pattern
Every agent route follows the same pattern:
```typescript
export const dynamic = 'force-dynamic'
export const maxDuration = 60   // 90 for refine-batch

export async function POST(req: Request) {
  try {
    const { context } = await req.json()
    const completion = await getAI().chat.completions.create({ ... })
    const result = safeParseJSON<OutputType>(content, fallback)
    return Response.json({ result })
  } catch (err) {
    return Response.json({ error: '...' }, { status: 500 })
  }
}
```

### Stage Page Pattern
- Reads `pipeline`, `setStageStatus`, `setCurrentStage`, `updateContext` from the store.
- `runStage()` callback: sets running, calls API, updates context, sets done.
- `useEffect` auto-runs on mount when status is `idle`.
- Renders the panel component + a "Continue to next" button when done.
- Shows a "Re-run" button when done.
- Redirects to `/` if no pipeline exists.

### `pipelineStore.ts`
- `initPipeline(title, description, ideaType?)` — fresh pipeline, marks seed as done, **sets `rootId = id`**.
- `setStageStatus(stage, status, error?)` — updates stage state, auto-saves on `done`/`error`.
- `setCurrentStage(stage)` — just updates `currentStage`.
- `updateContext(patch)` — merges partial context.
- `branchPipeline(targetStage, branchName?)` — see the Branching model section.
- `savePipeline()` / `loadPipeline(id)` / `deletePipeline(id)` — Supabase upsert/select/delete, with localStorage fallback for unauthenticated users.
- `fetchSavedPipelines()` — roots only.
- `fetchBranches(rootId)` — every pipeline sharing that root, ordered by `createdAt`.

### `editModeStore.ts`
- `isEditMode`, `toggleEditMode()`, `setEditMode(on)`.
- `activeEdit`, `openEdit(target)`, `closeEdit()` — drives the popover.
- `queue`, `enqueue(item)` (upsert by `pipelineId+stage+path`), `removeFromQueue(id)`, `clearQueueFor(pipelineId, stage)`, `rekeyQueueFor(old, new, stage)`.

### Types (`pipeline.ts`)
- `PipelineContext`:
  - `idea: { title, description, type }`
  - `userAnswers`, `brainstorm`, **`selectedExpansions: string[]`** (Mesh opt-ins), `qa`,
  - `prosCons`, `critique`, `scout`, `comparison`, `blueprint`, `pitchDeck`
- `PipelineState`:
  - `id`, `createdAt`, `currentStage`, `stages`, `context`
  - **Branching:** `rootId` (required), `parentId?`, `branchName?`, `forkedAtStage?`
- `StageId`: `'seed' | 'mesh' | 'probe' | 'scout' | 'compare' | 'blueprint' | 'pitchdeck'`

### Tree-visualizer StageRail
- Spine = stages of the **active** pipeline, vertically (the "active path" is rendered prominently).
- For each spine stage, sibling branches whose `forkedAtStage` equals that stage render as a dashed CSS-rounded elbow `┗` plus a chip showing branch name + current stage. Inactive branches are muted; hover lifts them.
- "Original timeline" chip at the top of the rail jumps to the root (only shown when the active pipeline is a non-root branch).
- "On branch" badge at the bottom shows the active branch's name + fork stage (non-root only).
- Click any chip → `loadPipeline(id)` and route to that pipeline's `currentStage`.

### Tailwind Theme
- Dark theme only (surface colors: `#0a0a0a` base, `#111` surface-1, `#1a1a1a` surface-2, `#222` surface-3).
- Accent colors: purple, teal, coral, blue, amber, green (each with a `-muted` variant at 12–15 % opacity).
- Border colors: `rgba(255,255,255,0.08)` default, `0.05` subtle, `0.15` strong.
- Custom animations: `fade-up` (8 px slide + opacity), `shimmer`, `cursor-blink`.

### Environment Variables (`.env.local`)
```
# LLM
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o

# Web search
TAVILY_API_KEY=tvly-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Important Gotchas
- **Next.js 16 has breaking changes** — always check `node_modules/next/dist/docs/` before writing code.
- **OpenAI SDK v6** — cannot instantiate `new OpenAI()` without a valid apiKey; use lazy `getAI()`.
- **Tailwind v3** — NOT v4. Use `tailwind.config.ts`, NOT `@import "tailwindcss"` CSS syntax.
- **All LLM responses must be parsed as JSON** — prompts explicitly forbid markdown fences, but `safeParseJSON` handles them anyway.
- **Branching FK** — `pipelines.parent_id` uses `ON DELETE CASCADE`. Deleting a root deletes the entire subtree.
- **Always save the parent before inserting a branch** — `branchPipeline` does this automatically; do not bypass it, or you will create dangling `parent_id` references.
- **Backfill `rootId`** when adding new branching fields or migrating older pipelines: `loadPipeline` falls back to `rootId = id` for rows missing it.
- **Persist version migrations:** when adding new fields to `PipelineState`, bump the Zustand `version` and add a `migrate(...)` clause that backfills sensible defaults.
- **EditableBlock paths must be stable strings** — they're matched against queue items and the JSON schema. Use the literal path you want refinements to write to (e.g. `prosCons.cons[2]`).
- **Refinement schema preservation** — the agent must return values of the same JSON shape. The server-side `sameShape` validator rejects key add/remove/rename and primitive type changes. Editable blocks targeting objects (e.g. a full `comparison.competitors[0]` object) must therefore be intentionally scoped — don't wrap something whose shape the model would naturally want to extend.
- **StageRail** filters hidden stages with `hiddenStageIds` prop — new stages may need conditional visibility.
- **lucide-react** icons — always import from the root `lucide-react` package.
- **No setState-in-effect** — the project's ESLint config (React Compiler rules) bans synchronous `setState` calls inside `useEffect` bodies. Derive state via comparison + `useMemo` (see `MeshPanel`'s `isFullySaved` and the workspace layout's `isPersisted`) rather than reflecting prop changes into state.
- **No ref reads during render** — the same lint config flags `ref.current` reads in render. Use `useState` for values that must drive render output.

## Build & Lint
```bash
npm run build    # next build (Turbopack)
npm run lint     # eslint
npx tsc --noEmit # typecheck (no script alias, run directly)
```
All three must pass with zero errors before changes are considered complete.
