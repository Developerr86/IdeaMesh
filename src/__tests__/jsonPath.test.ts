import { describe, expect, it } from 'vitest'
import { getAtPath, parsePath, setAtPath } from '../lib/jsonPath'
describe('jsonPath', () => {
  it('parses keys and indices and rejects malformed roots', () => {
    expect(parsePath('blueprint.buildPhases[2].tasks[1]')).toEqual(['blueprint','buildPhases',2,'tasks',1])
    expect(() => parsePath('')).toThrow(); expect(() => parsePath('[0]')).toThrow(); expect(() => parsePath('a..b')).toThrow()
  })
  it('gets and immutably sets deep array values', () => {
    const root = { a: [{ b: 'old' }], untouched: { x: 1 } }
    expect(getAtPath(root, 'a[0].b')).toBe('old')
    const next = setAtPath(root, 'a[0].b', 'new')
    expect(next.a[0].b).toBe('new'); expect(root.a[0].b).toBe('old'); expect(next.untouched).toBe(root.untouched)
  })
})
