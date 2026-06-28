# IdeaMesh - Project Context

## Purpose
IdeaMesh is a multi-agent AI ideation platform that turns a raw software idea into a structured plan. It runs a staged pipeline:

1. Seed
2. Mesh
3. Probe
4. Scout
5. Compare
6. Blueprint
7. Pitch Deck

The platform has two core differentiators on top of the linear flow:

1. Copy-on-write branching. Any pipeline can fork at a completed stage. The branch deep-copies upstream state, resets downstream stages to `idle`, and preserves the original timeline.
2. In-context refinement with queued notes. Any generated block can be made editable. Notes are queued across a stage and then applied in one batch refinement call, producing at most one fork.

Users provide a software idea as either personal or business. The app then runs brainstorming, clarification, critique, competitor research, comparison, technical synthesis, and optionally a pitch deck.

## Tech Stack
- Framework: Next.js 16.2.6 with App Router
- Runtime: Node.js server components and route handlers
- Language: TypeScript 5
- UI: React 19.2.4
- Styling: Tailwind CSS 3.4.x
- Motion: framer-motion 12.x
- Icons: lucide-react 1.x
- AI SDK: openai 6.x
- State: zustand 5.x with persist middleware
- Auth and DB: `@supabase/ssr` 0.10.x and `@supabase/supabase-js` 2.x
- Utilities: clsx and tailwind-merge via `cn()`
- Fonts: Geist

Notes:
- `npm run dev` uses `next dev --webpack`.
- `npm run build` uses `next build` and succeeds with the current Linux Vercel build setup.
- Do not add platform-specific SWC packages to the root dependencies. Next already resolves the correct optional binary for the host platform.

## Repository Layout
```text
src/
  app/
    (workspace)/
      layout.tsx
      mesh/page.tsx
      probe/page.tsx
      scout/page.tsx
      compare/page.tsx
      blueprint/page.tsx
      pitchdeck/page.tsx
    api/agents/
      brainstorm/route.ts
      qa/route.ts
      probe/route.ts
      scout/route.ts
      compare/route.ts
      blueprint/route.ts
      pitchdeck/route.ts
      refine/route.ts
      refine-batch/route.ts
    auth/
      login/page.tsx
      signup/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
      callback/route.ts
    profile/page.tsx
    layout.tsx
    page.tsx
  components/
    pipeline/StageRail.tsx
    stages/*.tsx
    ui/AgentCard.tsx
    ui/EditableBlock.tsx
    ui/EditPopover.tsx
    ui/RefinementQueueBar.tsx
    ui/UserMenu.tsx
  lib/
    ai/client.ts
    ai/prompts.ts
    ai/stream.ts
    jsonPath.ts
    search/
      index.ts
      duckduckgo.ts
      tavily.ts
      http.ts
      types.ts
    supabase/
      client.ts
      server.ts
      config.ts
    utils.ts
  store/
    pipelineStore.ts
    editModeStore.ts
  types/pipeline.ts
  proxy.ts
```

## Pipeline Stages
| # | Stage ID | Label | Purpose | Agents |
|---|---|---|---|---|
| 1 | `seed` | Seed | Capture the initial idea | Input |
| 2 | `mesh` | Mesh | Expand and question the idea | Brainstorm, Q&A |
| 3 | `probe` | Probe | Evaluate weaknesses and risks | Pros/Cons, Critique |
| 4 | `scout` | Scout | Research competitors and similar tools | Web Search |
| 5 | `compare` | Compare | Identify overlap and gaps | Comparison |
| 6 | `blueprint` | Blueprint | Produce the build plan and coding guidance | Synthesis |
| 7 | `pitchdeck` | Pitch Deck | Generate a short investor-style deck for business ideas | Pitch Deck |

Pitch Deck is hidden for personal ideas in the StageRail and on stage navigation.

## Data Flow
1. The landing page collects title, description, and idea type.
2. `initPipeline()` creates the initial `PipelineState`, marks Seed as done, and stores it in Zustand.
3. Stage pages auto-run on mount when their status is `idle`.
4. Each stage calls its route handler, parses JSON, updates `PipelineContext`, and marks the stage done or error.
5. `setStageStatus('done' | 'error')` triggers persistence.
6. The workspace layout and StageRail let the user move through stages or swap branches.

## Branching Model
Every pipeline belongs to a tree:

- `PipelineState.id`: unique pipeline id
- `PipelineState.rootId`: topmost ancestor id, equal to `id` for a root pipeline
- `PipelineState.parentId`: direct parent id, or `undefined` for roots
- `PipelineState.branchName`: label shown in the StageRail
- `PipelineState.forkedAtStage`: stage where the branch diverged

Branching behavior in `pipelineStore.ts`:

1. The current pipeline is saved first so the parent row exists before the branch is inserted.
2. The new branch deep-clones the pipeline state.
3. Downstream stages after the fork point are reset to `idle`.
4. Downstream context keys are trimmed so reruns regenerate them instead of reusing stale output.
5. The new branch is persisted and becomes active.

Saved pipeline browsing:
- `fetchSavedPipelines()` returns only root pipelines for the main saved list.
- `fetchBranches(rootId)` returns all pipelines sharing a root, used by the tree view.
- Deleting a pipeline cascades to descendants in Supabase because the foreign key is `ON DELETE CASCADE`.

## Refinement Workflow
State lives in `src/store/editModeStore.ts` and supports:

- `isEditMode`
- `activeEdit`
- `queue`
- `enqueue()`
- `removeFromQueue()`
- `clearQueueFor()`
- `rekeyQueueFor()`

Flow:

1. User enables Edit mode.
2. Editable blocks become clickable.
3. Clicking a block opens `EditPopover`.
4. The note is queued, keyed by pipeline id, stage, and JSON path.
5. `RefinementQueueBar` appears when there are queued items for the current stage.
6. Proceeding applies all notes in one batch refine call.
7. If downstream output already exists, the app forks once before applying refinements.

`/api/agents/refine-batch`:
- Receives `fullContext`, `stage`, and an array of `{ targetPath, label, instruction }`
- Looks up each path with `getAtPath`
- Asks the model to rewrite all queued targets coherently
- Validates that the returned values keep the same JSON shape
- Rejects output if keys are added, removed, renamed, or if primitive types change

Limits:
- Max 50 refinements per batch
- Max 2000 characters per instruction

## Persistence

### Supabase path
For authenticated users, pipeline state is stored in `public.pipelines` and profile data in `public.profiles`.

Pipeline columns:
- `id`
- `user_id`
- `title`
- `idea_type`
- `current_stage`
- `stages`
- `context`
- `parent_id`
- `root_id`
- `branch_name`
- `forked_at_stage`
- `created_at`
- `updated_at`

### Local fallback
If Supabase is not configured, the app runs in local mode:

- Pipeline state falls back to localStorage
- Saved ideas still work locally
- Auth pages and profile page degrade gracefully instead of throwing during build or render

`src/lib/supabase/config.ts` is the single source of truth for whether Supabase is configured. It checks:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The browser and server Supabase clients are only created when configuration is present.

## Auth
- Email/password and Google OAuth use Supabase Auth
- `src/proxy.ts` replaces the deprecated `middleware.ts` style and handles session refresh plus route protection
- Protected routes: `/mesh`, `/probe`, `/scout`, `/compare`, `/blueprint`, `/pitchdeck`, `/profile`
- Auth pages: `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/callback`
- When Supabase is configured, unauthenticated users are redirected to login for protected routes
- When Supabase is not configured, the app stays in local mode and skips auth redirects

## Search and Scout
Scout uses a pluggable search layer in `src/lib/search/`.

Search providers:
- `tavily`
- `duckduckgo`
- `auto`

Resolution rules:
- `SEARCH_PROVIDER=tavily` forces Tavily
- `SEARCH_PROVIDER=duckduckgo` forces DuckDuckGo
- `SEARCH_PROVIDER=auto` prefers Tavily if `TAVILY_API_KEY` is present, otherwise DuckDuckGo

DuckDuckGo behavior:
- First attempt uses `duck-duck-scrape`
- If that provider throws or returns no results, the code falls back to DuckDuckGo HTML or Lite endpoints
- The HTML fallback uses browser-like headers and parses result links/snippets from returned markup

Enrichment:
- `SEARCH_ENRICH_PAGES=true` fetches the top results and appends extracted page text
- Page fetches are time-limited and filtered to avoid obviously unsafe local/private URLs

Scout query generation:
- Uses the idea title and description
- Adds a query from `brainstorm.coreValueProposition` when available

## AI Client
`src/lib/ai/client.ts` uses a lazy singleton pattern. This matters because OpenAI SDK v6 validates `apiKey` eagerly, so the client must not be constructed until a route handler actually needs it.

Env vars:
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`

## Prompts
`src/lib/ai/prompts.ts` defines the shared context block and every stage prompt.

Key behaviors:
- Prompts return JSON only
- Personal ideas are treated differently in Q&A and pitch deck generation
- `selectedExpansions` from the Mesh stage are marked as primary in downstream prompts
- Scout summaries consume formatted search hits and produce structured competitor results plus a narrative summary

## Utilities

### `safeParseJSON`
`src/lib/utils.ts` strips fences, then parses JSON. If parsing fails, it tries to extract the outermost object or array from mixed content responses.

### `jsonPath`
`src/lib/jsonPath.ts` supports dotted keys and numeric array indices only. It is used by the refinement flow to read and write nested values safely.

## Stage Pages
Each stage page follows the same pattern:

1. Read pipeline state from the store.
2. Auto-run when the stage is idle.
3. Set stage status to running.
4. Call the matching API route.
5. Update context and stage status on success.
6. Show retry controls on error.

## StageRail
The StageRail is the left-side tree visualizer:

- Renders the active pipeline spine
- Shows branch chips for sibling pipelines forked at each stage
- Allows switching between branches
- Includes an "Original timeline" action for returning to the root

## Tailwind and UI
- The app uses a dark, utility-first UI
- Accent colors are purple, teal, coral, blue, amber, and green
- Components use small radii and compact spacing
- Page sections are framed by bands rather than nested cards

## Environment Variables
```env
# LLM
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=

# Web search
SEARCH_PROVIDER=auto
TAVILY_API_KEY=
SEARCH_ENRICH_PAGES=true

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Important Gotchas
- Next.js 16 docs should be checked in `node_modules/next/dist/docs/` before changing route handlers or route segment config.
- `serverExternalPackages` is available in `next.config.ts`, but platform-specific SWC binaries should not be added as root dependencies.
- OpenAI client construction must stay lazy because SDK v6 validates envs immediately.
- The app must keep working when Supabase is absent.
- Search can fail transiently, so Scout has a provider fallback path.
- Refinement output must preserve JSON shape.
- The store backfills `rootId` for older pipelines.
- `loadPipeline()` and `fetchSavedPipelines()` intentionally distinguish roots from branches.

## Build and Verification
```bash
npm run build
npm run lint
npx tsc --noEmit
```

Current expectation:
- `npm run build` must pass
- `npm run lint` may still report existing warnings in unrelated files, but there should be no errors
- `npx tsc --noEmit` must pass
