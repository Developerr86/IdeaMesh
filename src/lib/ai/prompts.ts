import { PipelineContext, BlueprintOutput } from '@/types/pipeline'

// Emit the brainstorm expansions in the prompt context, distinguishing which
// the user has explicitly selected as in-scope vs. the rest of the suggestions.
function formatExpansions(ctx: PipelineContext): string {
  if (!ctx.brainstorm) return ''
  const all = ctx.brainstorm.expansions
  const selected = ctx.selectedExpansions
  if (!selected || selected.length === 0) {
    return `\n## Brainstorm expansions\n${all.join('\n')}`
  }
  const selectedSet = new Set(selected)
  const inScope = all.filter((e) => selectedSet.has(e))
  const others = all.filter((e) => !selectedSet.has(e))
  const lines: string[] = []
  lines.push('\n## Brainstorm expansions (user-selected — treat as primary)')
  lines.push(inScope.length ? inScope.join('\n') : '(none selected)')
  if (others.length) {
    lines.push('\n### Other expansions (de-emphasised; do not rely on these)')
    lines.push(others.join('\n'))
  }
  return lines.join('\n')
}

function contextBlock(ctx: PipelineContext): string {
  return `
## The idea
Title: ${ctx.idea.title}
Description: ${ctx.idea.description}
Type: ${ctx.idea.type === 'business' ? 'Business / Commercial project' : 'Personal / Hobby project'}
${ctx.userAnswers ? `\n## User's clarifications\n${Object.entries(ctx.userAnswers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')}` : ''}
${ctx.brainstorm ? formatExpansions(ctx) : ''}
${ctx.prosCons ? `\n## Pros/Cons analysis\nPros: ${ctx.prosCons.pros.join(', ')}\nCons: ${ctx.prosCons.cons.join(', ')}` : ''}
${ctx.critique ? `\n## Critique\n${ctx.critique.critique}` : ''}
${ctx.scout ? `\n## Competitor research summary\n${ctx.scout.summary}` : ''}
${ctx.comparison ? `\n## Comparison analysis\nOur edge: ${ctx.comparison.ourEdge.join(', ')}` : ''}
${ctx.blueprint ? `\n## Build blueprint\n${ctx.blueprint.projectName}\nCore features: ${ctx.blueprint.coreFeatures.join(', ')}\nTech stack: ${JSON.stringify(ctx.blueprint.techStack)}\nBuild phases: ${ctx.blueprint.buildPhases.map(p => `${p.name} (${p.duration})`).join(', ')}` : ''}
`.trim()
}

export function brainstormPrompt(ctx: PipelineContext): string {
  return `You are a product ideation expert specialising in software startups and developer tools. Your job is to deeply expand a raw software idea.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences, no preamble, no trailing text. Use this exact schema:
{
  "expansions": ["<3-5 specific ways to expand or evolve this idea>"],
  "angles": ["<3-4 different market or technical angles to approach it from>"],
  "targetAudiences": ["<3-5 specific target audiences with detail>"],
  "coreValueProposition": "<one clear sentence stating the unique value this delivers>"
}
`
}

export function qaPrompt(ctx: PipelineContext): string {
  const isBusiness = ctx.idea.type === 'business'
  const categories = isBusiness
    ? '<scope|audience|technical|business|differentiation>'
    : '<scope|audience|technical|usability|motivation>'
  const extra = isBusiness
    ? ''
    : '\nSince this is a personal project (not a business), do NOT ask about monetization, pricing, business model, or revenue. Focus on user needs, technical approach, learning goals, and scope.'

  return `You are a sharp product strategist conducting a discovery session. Ask the most important clarifying questions about this software idea.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "questions": [
    {
      "question": "<question text>",
      "category": "${categories}",
      "options": ["<option 1>", "<option 2>", "<option 3>", "<option 4>"]
    }
  ]
}

Generate exactly 5 questions. Make them specific and insightful, not generic.
For each question, provide 4 distinct, concrete answer options that cover realistic responses.${extra}
`
}

export function prosConsPrompt(ctx: PipelineContext): string {
  return `You are a rigorous product analyst. Perform a comprehensive SWOT-style analysis of this software idea.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "pros": ["<4-6 concrete strengths>"],
  "cons": ["<4-6 concrete weaknesses or risks>"],
  "opportunities": ["<3-4 market or timing opportunities>"],
  "threats": ["<3-4 competitive or technical threats>"]
}
`
}

export function critiquePrompt(ctx: PipelineContext): string {
  return `You are a brutally honest venture critic. Your job is to poke holes in this software idea and expose weak assumptions. Be direct, not cruel. Be specific, not vague.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "critique": "<3-5 paragraph honest critique of the idea's weaknesses and blind spots>",
  "riskLevel": "<low|medium|high>",
  "tags": ["<3-5 short risk labels like 'market-risk', 'execution-risk', 'needs-validation'>"],
  "keyAssumptions": ["<3-5 unvalidated assumptions the idea relies on>"]
}
`
}

export function scoutSummaryPrompt(ctx: PipelineContext, searchResults: string): string {
  return `You are a market research analyst. You have just run web searches for competitors and similar projects to the idea below. Summarise the findings.

${contextBlock(ctx)}

## Raw search results
${searchResults}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "results": [
    {
      "title": "<project or product name>",
      "url": "<url>",
      "description": "<1-2 sentence description of what it does>",
      "source": "<github|producthunt|twitter|web>"
    }
  ],
  "summary": "<3-4 paragraph narrative summary of the competitive landscape>"
}

Include 4-8 results. Only include real results from the search data provided.
`
}

export function comparisonPrompt(ctx: PipelineContext): string {
  return `You are a product strategist specialising in competitive positioning. Compare the idea against the discovered competitors and identify gaps and edges.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "competitors": [
    {
      "name": "<name>",
      "url": "<url>",
      "overlap": ["<features that overlap with our idea>"],
      "gaps": ["<things they lack that our idea could address>"],
      "differentiator": "<what makes them strong>"
    }
  ],
  "ourEdge": ["<3-5 genuine advantages our idea has>"],
  "improvementSuggestions": ["<3-5 specific features or angles to add based on competitive gaps>"],
  "marketPositioning": "<one paragraph on where this idea should position in the market>"
}
`
}

// ─── Blueprint (3-call strategy) ─────────────────────────────────────────────

export function blueprintCorePrompt(ctx: PipelineContext): string {
  return `You are a senior software architect and technical lead. Based on the full ideation pipeline below, produce a comprehensive technical architecture overview.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "projectName": "<refined, memorable project name>",
  "elevatorPitch": "<3-4 sentences covering: the problem being solved, the solution, who it is for, and the key differentiator>",
  "targetAudience": "<detailed description including role, context, specific pain points, and how they will use this product day-to-day>",
  "coreFeatures": ["<8-12 core features — each described specifically enough that a developer knows exactly what to build>"],
  "techStack": {
    "frontend": ["<specific frameworks and key libraries with version preferences and justification>"],
    "backend": ["<runtime, framework, key packages — be opinionated>"],
    "database": ["<database engine(s) and why, schema approach, ORM/query builder if any>"],
    "infrastructure": ["<hosting platform, CI/CD pipeline, file storage, CDN, observability stack>"],
    "aiTools": ["<specific LLMs, embedding models, vector DB, AI SDK or framework if relevant — or omit section if not applicable>"]
  },
  "mcpSuggestions": [
    {
      "name": "<MCP server name>",
      "purpose": "<2-3 sentences: what this MCP enables, the specific use case in this project, and how to wire it up>",
      "url": "<GitHub or docs URL>"
    }
  ],
  "codingTools": ["<specific VS Code extensions, CLI tools, linters, formatters, testing frameworks — with the reason each one matters>"],
  "estimatedTimeline": "<total build timeline with brief reasoning>",
  "mvpScope": ["<10-15 specific, shippable MVP items concrete enough to put on a sprint board>"]
}

Be specific and opinionated. Use real package names, actual version numbers where known, concrete tool names. No vague generics.
`
}

export function blueprintPhasesPrompt(ctx: PipelineContext): string {
  return `You are a senior software architect creating a detailed phased build plan. Based on the ideation pipeline below, define comprehensive build phases with highly specific, actionable tasks.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "buildPhases": [
    {
      "phase": 1,
      "name": "<descriptive phase name>",
      "duration": "<realistic duration estimate>",
      "tasks": [
        "<each task must be a concrete developer action — include exact CLI commands to run, config files to create, specific components or API routes to build, third-party services to connect, tests to write. Example: 'Run npx create-next-app@14 with TypeScript, Tailwind, and App Router flags', 'Create /api/auth/[...nextauth]/route.ts with GitHub and Google OAuth providers', 'Build <DataTable> component with column sorting, pagination, and row selection'>"
      ],
      "deliverable": "<precise description of what is working, testable, and demonstrable at the end of this phase>"
    }
  ]
}

Generate 4-6 phases that progress logically from project foundation to production launch. Each phase MUST have at minimum 10 tasks — not vague bullet points but concrete, immediately actionable developer steps. Reference real tools, packages, and patterns appropriate to the idea.
`
}

export function blueprintAgentPromptsPrompt(
  ctx: PipelineContext,
  core: Pick<BlueprintOutput, 'projectName' | 'elevatorPitch' | 'techStack' | 'coreFeatures' | 'mvpScope'>,
  phases: BlueprintOutput['buildPhases'],
): string {
  const stack = core.techStack
  const stackSummary = stack
    ? [
        stack.frontend?.length ? `Frontend: ${stack.frontend.join(', ')}` : '',
        stack.backend?.length ? `Backend: ${stack.backend.join(', ')}` : '',
        stack.database?.length ? `Database: ${stack.database.join(', ')}` : '',
        stack.infrastructure?.length ? `Infrastructure: ${stack.infrastructure.join(', ')}` : '',
        stack.aiTools?.length ? `AI/ML: ${stack.aiTools.join(', ')}` : '',
      ].filter(Boolean).join('\n')
    : ''

  const phaseList = phases
    .map((p) => `  Phase ${p.phase} — ${p.name}: ${p.deliverable}`)
    .join('\n')

  return `You are a senior software architect writing ready-to-use prompts for an AI coding agent (Claude Code, Cursor, Copilot Workspace). Each prompt must be fully self-contained — the coding agent should be able to start implementing immediately without needing to ask any clarifying questions.

${contextBlock(ctx)}

## Confirmed architecture
Project: ${core.projectName ?? ctx.idea.title}
Pitch: ${core.elevatorPitch ?? ctx.idea.description}
Tech stack:
${stackSummary}
Core features: ${core.coreFeatures?.join(', ') ?? ''}
MVP scope: ${core.mvpScope?.join(', ') ?? ''}

## Build phases overview
${phaseList}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "codingAgentPrompts": [
    {
      "label": "<specific component, feature, or system name>",
      "prompt": "<self-contained prompt of 200-350 words that must include ALL of: (1) the component's purpose and its role in the overall system, (2) exact tech stack and package names to use, (3) complete list of requirements including edge cases and error states to handle, (4) integration points with other parts of the system and the expected data contracts, (5) expected file structure or API shape, (6) any specific patterns, conventions, or constraints to follow. The agent should produce production-quality code on the first pass with no follow-up questions.>"
    }
  ]
}

Generate 7-10 prompts, each covering a distinct component or system area. Cover ALL of these areas (adapt naming to the project): (1) project scaffolding and monorepo/build configuration, (2) authentication and authorisation, (3) core data models and database schema with migrations, (4) primary feature implementation — split into multiple prompts if complex, (5) API layer and server-side routes, (6) key UI components and page layouts, (7) third-party service integrations, (8) background jobs or real-time features if applicable, (9) test suite setup and critical test cases, (10) deployment and environment configuration. Each prompt must be 200-350 words of dense, actionable detail.
`
}

export function pitchDeckPrompt(ctx: PipelineContext): string {
  return `You are a pitch deck strategist and visual storyteller. Based on the full ideation pipeline below, generate a compelling pitch deck.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "slides": [
    {
      "title": "<slide title>",
      "subtitle": "<optional subtitle or tagline>",
      "content": ["<bullet point 1>", "<bullet point 2>", "<bullet point 3>"],
      "layout": "<title-slide|bullets|two-column|centered|closing>"
    }
  ]
}

Generate 6-8 slides. Cover these areas:
1. Title slide — project name and tagline
2. Problem — what problem is being solved
3. Solution — how the product solves it
4. Market / Opportunity — why now (for business) or vision (for personal)
5. Product — key features and how it works
6. Traction / Business model — for business ideas only
7. Competitive edge — what makes this different
8. Call to action / closing

Use layout types meaningfully: 'title-slide' for the first slide, 'closing' for the last, 'two-column' for comparison slides, 'centered' for key messages, 'bullets' for the rest.
Keep bullet points concise and impactful — 3-5 per slide.
`
}
