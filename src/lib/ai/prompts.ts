import { PipelineContext } from '@/types/pipeline'

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

export function blueprintPrompt(ctx: PipelineContext): string {
  return `You are a senior software architect and technical project lead. Based on the full ideation pipeline below, produce a comprehensive, actionable build plan.

${contextBlock(ctx)}

Respond ONLY with valid JSON. No markdown fences. Schema:
{
  "projectName": "<refined project name>",
  "elevatorPitch": "<2-3 sentence pitch>",
  "targetAudience": "<specific, detailed primary audience>",
  "coreFeatures": ["<5-8 core MVP features>"],
  "techStack": {
    "frontend": ["<frameworks, libraries>"],
    "backend": ["<runtime, frameworks, APIs>"],
    "database": ["<database choices with reasoning>"],
    "infrastructure": ["<hosting, CI/CD, storage>"],
    "aiTools": ["<LLMs, embeddings, vector DBs if relevant>"]
  },
  "mcpSuggestions": [
    { "name": "<MCP server name>", "purpose": "<why it helps>", "url": "<mcp or docs url>" }
  ],
  "codingTools": ["<VS Code extensions, CLI tools, linters, etc>"],
  "buildPhases": [
    {
      "phase": 1,
      "name": "<phase name>",
      "duration": "<estimated duration>",
      "tasks": ["<specific tasks>"],
      "deliverable": "<what gets shipped>"
    }
  ],
  "codingAgentPrompts": [
    { "label": "<task label>", "prompt": "<ready-to-use prompt for a coding agent>" }
  ],
  "estimatedTimeline": "<total estimated build timeline>",
  "mvpScope": ["<what is in MVP>"]
}

  Be specific and opinionated. Name actual packages, actual tools, real version numbers where known.
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
