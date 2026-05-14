# IdeaMesh — Project Context

## Purpose
IdeaMesh is a **6-stage (plus optional phase 7) AI-powered software ideation platform**. Users input a raw software idea (classified as personal or business), and the platform runs a multi-agent LLM pipeline to brainstorm, question, critique, research competitors, compare, generate a technical blueprint, and optionally produce a pitch deck.

## Tech Stack
- **Framework:** Next.js 16.2.6 (App Router, `next build` uses Turbopack)
- **Language:** TypeScript 5.x
- **UI Library:** React 19.2.4
- **Styling:** Tailwind CSS 3.4.x (v3 NOT v4)
- **Animations:** framer-motion 12.x
- **Icons:** lucide-react 1.x
- **AI SDK:** openai 6.x (note: v6 validates apiKey eagerly — use lazy client)
- **State:** zustand 5.x with persist middleware
- **Fonts:** geist (via npm package, `--font-geist-sans` / `--font-geist-mono` CSS vars)
- **Utilities:** clsx, tailwind-merge (wrapped as `cn()` in `lib/utils.ts`)

## Architecture

### Directory Structure
```
src/
  app/                    # Next.js App Router pages + API routes
    (workspace)/          # Route group — all stage pages share a layout
      blueprint/page.tsx  # Stage 6
      compare/page.tsx    # Stage 5
      mesh/page.tsx       # Stage 2
      pitchdeck/page.tsx  # Stage 7 (business only)
      probe/page.tsx      # Stage 3
      scout/page.tsx      # Stage 4
      layout.tsx          # Workspace header + StageRail sidebar
    api/agents/
      blueprint/route.ts
      brainstorm/route.ts
      compare/route.ts
      pitchdeck/route.ts
      probe/route.ts
      qa/route.ts
      scout/route.ts
    layout.tsx            # Root layout (Geist fonts, globals.css)
    page.tsx              # Landing page (idea input + saved ideas)
  components/
    pipeline/StageRail.tsx # Sidebar nav showing all stages
    stages/               # One panel component per stage
    ui/                   # Reusable primitives (AgentCard, Tag, StreamingText)
  lib/
    ai/client.ts          # Lazy OpenAI client (getAI, getModel)
    ai/prompts.ts         # All 8 agent system prompts
    ai/stream.ts          # Streaming utilities
    search/tavily.ts      # Tavily search client
    utils.ts              # cn(), formatDuration(), safeParseJSON()
  store/pipelineStore.ts  # Zustand store with persist + localStorage
  types/pipeline.ts       # All shared types, StageId, StageConfig
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
1. **Landing page** (`/`): User enters title, description, and selects Personal/Business. `initPipeline()` creates a `PipelineState` and saves to Zustand + localStorage.
2. **Stage pages** auto-run on mount via `useEffect` (auto-runs once when `idle`).
3. Each page calls its API route(s), receives JSON, calls `updateContext()` to store result in Zustand, then calls `setStageStatus('done')`.
4. `setStageStatus('done'/'error')` triggers `savePipeline()` — persists full pipeline to localStorage (`ideamesh-data-{id}`).
5. User navigates between stages via StageRail sidebar or "Continue to X" buttons.

### Persistence
- **Zustand persist key:** `ideamesh-pipeline` (stores metadata list: `savedPipelines: SavedPipelineMeta[]`)
- **Pipeline data keys:** `ideamesh-data-{id}` (stores full `PipelineState` as JSON)
- Zustand persist version `2` — migrate function handles old v1 state (adds `savedPipelines: []`)
- `loadPipeline()` fills in missing stage states (for forward compatibility when new stages are added)

## Key Implementation Details

### AI Client (`lib/ai/client.ts`)
- Uses **lazy singleton** pattern — `getAI()` / `getModel()` check env vars at call time, not import time
- **Critical:** OpenAI SDK v6 eagerly validates `apiKey` in the constructor. Empty string throws. Always guard with env check.
- Env vars: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`

### Prompts (`lib/ai/prompts.ts`)
- `contextBlock(ctx)` generates a shared context string injected into every prompt
- Each prompt instructs the LLM to return valid JSON only (no markdown fences, no preamble)
- `qaPrompt` is **idea-type-aware**: for personal ideas, it replaces `business` category with `usability`/`motivation` and forbids monetization questions
- `pitchDeckPrompt` generates 6-8 slides with layouts: `title-slide`, `bullets`, `two-column`, `centered`, `closing`

### `safeParseJSON` (`lib/utils.ts`)
- Strips markdown code fences, then `JSON.parse`s. Returns a fallback on failure.
- Used in every API route handler to safely parse LLM output.

### API Route Pattern
Every route follows the same pattern:
```typescript
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
Every stage page follows this pattern:
- Reads `pipeline`, `setStageStatus`, `setCurrentStage`, `updateContext` from store
- `runStage()` callback: sets running, calls API, updates context, sets done
- `useEffect` auto-runs on mount when status is `idle`
- Renders panel component + "Continue to Next" button when done
- Shows "Re-run" button when done
- Redirects to `/` if no pipeline exists

### Store (`pipelineStore.ts`)
- `initPipeline(title, description, ideaType?)` — creates fresh pipeline, marks seed as done
- `setStageStatus(stage, status, error?)` — updates stage state, auto-saves on `done`/`error`
- `setCurrentStage(stage)` — just updates `currentStage`
- `updateContext(patch)` — merges partial context
- `savePipeline()` / `loadPipeline(id)` / `deletePipeline(id)` — localStorage CRUD
- `resetPipeline()` — saves current then clears

### Types (`pipeline.ts`)
- `PipelineContext` carries all stage outputs: `brainstorm`, `qa`, `userAnswers`, `prosCons`, `critique`, `scout`, `comparison`, `blueprint`, `pitchDeck`
- `PipelineState` wraps context with `id`, `currentStage`, `stages` record, timestamps
- `StageId`: `'seed' | 'mesh' | 'probe' | 'scout' | 'compare' | 'blueprint' | 'pitchdeck'`

### Tailwind Theme
- Dark theme only (surface colors: `#0a0a0a` base, `#111` surface-1, `#1a1a1a` surface-2, `#222` surface-3)
- Accent colors: purple, teal, coral, blue, amber, green (each with a `-muted` variant at 12-15% opacity)
- Border colors: `rgba(255,255,255,0.08)` default, `0.05` subtle, `0.15` strong
- Custom animations: `fade-up` (8px slide + opacity), `shimmer`, `cursor-blink`

### Environment Variables (`.env.local`)
```
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
TAVILY_API_KEY=tvly-...
```

## Important Gotchas
- **Next.js 16 has breaking changes** — always check `node_modules/next/dist/docs/` before writing code
- **OpenAI SDK v6** — cannot instantiate `new OpenAI()` without a valid apiKey; use lazy `getAI()`
- **Tailwind v3** — NOT v4. Use `tailwind.config.ts`, NOT `@import "tailwindcss"` CSS syntax
- **All LLM responses must be parsed as JSON** — prompts explicitly forbid markdown fences, but `safeParseJSON` handles them anyway
- **Data migration** — when adding new stages or fields, update `loadPipeline()` to fill defaults; bump Zustand persist version with a `migrate` function
- **StageRail** filters hidden stages with `hiddenStageIds` prop — new stages may need conditional visibility
- **lucide-react** icons — always import from the root `lucide-react` package

## Build & Lint
```bash
npm run build    # next build (Turbopack)
npm run lint     # eslint
```
Both must pass with zero errors before changes are considered complete.
