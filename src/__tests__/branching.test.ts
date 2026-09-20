import { describe, expect, it } from 'vitest'
import { resetDownstream, trimDownstreamContext } from '../store/pipelineStore'
import { STAGES, type PipelineContext, type StageState } from '../types/pipeline'
const stages = Object.fromEntries(STAGES.map(({id}) => [id, { status: 'done' }])) as Record<(typeof STAGES)[number]['id'], StageState>
const context = { idea:{title:'x',description:'x',type:'personal'}, brainstorm:{expansions:[],angles:[],targetAudiences:[],coreValueProposition:'x'}, pitchDeck:{slides:[]} } as PipelineContext
describe('branch helpers', () => {
 it('resets everything after seed', () => { const next=resetDownstream(stages,'seed'); expect(next.seed.status).toBe('done'); expect(next.mesh.status).toBe('idle'); expect(stages.mesh.status).toBe('done') })
 it('resets nothing after pitchdeck', () => { expect(resetDownstream(stages,'pitchdeck')).toEqual(stages) })
 it('trims downstream context without mutating input', () => { const next=trimDownstreamContext(context,'mesh'); expect(next.brainstorm).toBe(context.brainstorm); expect(next.pitchDeck).toBeUndefined(); expect(context.pitchDeck).toBeDefined() })
})
