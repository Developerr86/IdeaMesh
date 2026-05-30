# Bug Fix Plan

## Issue #1 — Security: Replace Math.random() with crypto.randomUUID()

### Files to edit
1. `src/store/pipelineStore.ts:15-17`
2. `src/store/editModeStore.ts:52-54`

### Changes
**pipelineStore.ts:**
```ts
// Before:
function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// After:
function generateId(): string {
  return crypto.randomUUID()
}
```

**editModeStore.ts:**
```ts
// Before:
function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// After:
function genId(): string {
  return crypto.randomUUID()
}
```

---

## Issue #4 — jsonPath.ts silently ignores malformed paths

### File to edit
`src/lib/jsonPath.ts`

### Changes
Add validation at the top of `parsePath()`:
```ts
export function parsePath(path: string): PathSegment[] {
  if (!path) throw new Error('parsePath: path must not be empty')
  if (/^[\[\].]/.test(path)) throw new Error(`parsePath: path cannot start with bracket or dot: "${path}"`)
  if (/\..\./.test(path)) throw new Error(`parsePath: path contains empty segment: "${path}"`)

  const segments: PathSegment[] = []
  for (const token of path.split('.')) {
    if (!token) continue
    const re = /([^\[\]]+)|\[(\d+)\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(token)) !== null) {
      if (m[1] !== undefined) segments.push(m[1])
      else if (m[2] !== undefined) segments.push(Number(m[2]))
    }
  }
  return segments
}
```

This throws descriptive errors for:
- Empty strings
- Paths starting with `[`, `]`, or `.`
- Paths containing double dots (empty segment)

---

## Issue #6 — fetchSavedPipelines() returns nothing for unauthenticated users

### File to edit
`src/store/pipelineStore.ts:346-375`

### Changes
Replace the early return with a localStorage fallback:
```ts
fetchSavedPipelines: async () => {
  const user = await getAuthUser()

  if (!user) {
    const metas: SavedPipelineMeta[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DATA_PREFIX)) continue
      try {
        const p: PipelineState = JSON.parse(localStorage.getItem(key)!)
        if (!p.parentId) metas.push(metaFromPipeline(p))
      } catch { /* skip corrupt entries */ }
    }
    set({ savedPipelines: metas.sort((a, b) => b.lastModified - a.lastModified) })
    return
  }

  // ... rest of existing supabase logic unchanged
}
```

---

## Issue #3 — Inconsistent error handling across agent routes

### Files to edit (7 routes)
1. `src/app/api/agents/brainstorm/route.ts`
2. `src/app/api/agents/qa/route.ts`
3. `src/app/api/agents/probe/route.ts`
4. `src/app/api/agents/scout/route.ts`
5. `src/app/api/agents/compare/route.ts`
6. `src/app/api/agents/pitchdeck/route.ts`
7. `src/app/api/agents/blueprint/route.ts`

### Pattern to apply (refine/route.ts is the reference)
Each route should follow this structure:

```ts
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<...>

    if (!body.context) {
      return Response.json({ error: 'Missing required field: context' }, { status: 400 })
    }

    // ... existing agent logic ...

    // If the model returned the fallback (empty/invalid), return 502
    if (/* result is the fallback / empty */) {
      console.error('[route-tag] empty response from model')
      return Response.json({ error: 'Agent returned empty or invalid response' }, { status: 502 })
    }

    return Response.json({ result })
  } catch (err) {
    console.error('[route-tag]', err)
    return Response.json({ error: 'Agent failed' }, { status: 500 })
  }
}
```

### Specific changes per route

#### brainstorm/route.ts
- Add context validation
- Check if result is fallback (expansions: [], angles: [], etc.) → 502

#### qa/route.ts
- Add context validation
- Check if result is fallback (questions: []) → 502

#### probe/route.ts
- Add context validation
- Check if prosCons or critique returned fallback → 502
- (Two parallel calls, check both)

#### scout/route.ts
- Add context validation
- Check if result is fallback (results: [], summary: '') → 502

#### compare/route.ts
- Add context validation
- Check if result is fallback (competitors: [], etc.) → 502

#### pitchdeck/route.ts
- Add context validation
- Check if result is fallback (slides: []) → 502

#### blueprint/route.ts
- Add context validation
- Validate each round independently; if any round returns fallback → 502
- Core, phases, and prompts should all be checked

### Verification
```bash
npm run lint
npm run build
```
